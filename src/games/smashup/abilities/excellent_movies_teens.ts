import type { PlayerId, MatchState } from '../../../engine/types';
import {
    createSimpleChoice,
    queueInteraction,
    type PromptOption,
    type SimpleChoiceConfig,
} from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerSimpleAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildActionMinionTargetOptions,
    buildBaseTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    createSkipOption,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    grantExtraAction,
    grantExtraMinion,
    inspectDeck,
    modifyBreakpoint,
    recoverCardsFromDiscard,
    removePowerCounter,
} from '../domain/abilityHelpers';
import {
    getActionControllerId,
    registerCustomBreakpointModifiers,
    registerCustomPowerModifiers,
} from '../domain/ongoingModifiers';
import { registerProtection, registerTrigger, type ProtectionCheckContext, type TriggerContext, type TriggerResult } from '../domain/ongoingEffects';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import { getCardDef, getMinionDef } from '../data/cards';
import { SU_EVENT_TYPES as SU_EVENTS } from '../domain/events';
import type {
    DeckReorderedEvent,
    CardInstance,
    MinionOnBase,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';

function cardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseName(core: SmashUpCore, baseIndex: number): string {
    return core.bases[baseIndex]?.defId ?? `base-${baseIndex}`;
}

function currentPlayerId(core: SmashUpCore): PlayerId | undefined {
    return core.turnOrder[core.currentPlayerIndex];
}

function sourceFor(ctx: Pick<AbilityContext, 'playerId' | 'cardUid' | 'defId' | 'baseIndex'>) {
    return {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    };
}

function onlyOwnMinionAtBase(core: SmashUpCore, baseIndex: number, playerId: PlayerId): MinionOnBase | undefined {
    const minions = core.bases[baseIndex]?.minions.filter(minion => minion.controller === playerId) ?? [];
    return minions.length === 1 ? minions[0] : undefined;
}

function isOnlyOwnMinionHere(core: SmashUpCore, baseIndex: number, playerId: PlayerId, minionUid?: string): boolean {
    const only = onlyOwnMinionAtBase(core, baseIndex, playerId);
    return !!only && (minionUid === undefined || only.uid === minionUid);
}

function reorderDeckWithCardOnTop(core: SmashUpCore, playerId: PlayerId, cardUid: string, reason: string, now: number): SmashUpEvent[] {
    const player = core.players[playerId];
    if (!player) return [];
    const card = player.deck.find(candidate => candidate.uid === cardUid);
    if (!card) return [];
    return [{
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: [card.uid, ...player.deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid)],
            reason,
        },
        timestamp: now,
    } as DeckReorderedEvent];
}

function detachOngoing(
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    reason: string,
    now: number,
    source?: {
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        destination?: 'discard' | 'hand';
    },
): OngoingDetachedEvent {
    return buildOngoingDetachedEvent({ cardUid, defId, ownerId, reason, now, ...source }) as OngoingDetachedEvent;
}

function queuePrompt<T>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceId: string,
    title: string,
    options: PromptOption<T>[],
    now: number,
    targetType: 'button' | 'base' | 'minion' | 'generic',
    titleKey?: string,
    continuationContext?: Record<string, unknown>,
    titleParams?: SimpleChoiceConfig['titleParams'],
): MatchState<SmashUpCore> {
    const interaction = createSimpleChoice(
        `${sourceId}_${now}`,
        playerId,
        title,
        options,
        { sourceId, targetType, titleKey, titleParams },
    );
    return queueInteraction(matchState, {
        ...interaction,
        data: {
            ...interaction.data,
            ...(continuationContext ? { continuationContext } : {}),
        },
    });
}

type ActionHeroesPushingCandidate = {
    baseIndex: number;
    minionUid: string;
    minionDefId: string;
};

function getActionHeroesPushingCandidates(core: SmashUpCore, playerId: PlayerId): ActionHeroesPushingCandidate[] {
    return core.bases.flatMap((_, baseIndex) => {
        const only = onlyOwnMinionAtBase(core, baseIndex, playerId);
        return only ? [{ baseIndex, minionUid: only.uid, minionDefId: only.defId }] : [];
    });
}

function queueActionHeroesPushingChoice(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    candidates: ActionHeroesPushingCandidate[],
    now: number,
): MatchState<SmashUpCore> {
    const [current, ...remaining] = candidates;
    const baseLabel = current ? baseName(matchState.core, current.baseIndex) : 'base';
    return queuePrompt(
        matchState,
        playerId,
        'action_heroes_pushing_the_limit',
        `逼近极限：${baseLabel} 选择指示物或抽牌`,
        [
            {
                id: 'counters',
                label: '+2 指示物',
                labelKey: 'ui.action_heroes_pushing_the_limit_counters_option',
                value: { mode: 'counters', ...current },
                displayMode: 'button' as const,
            },
            {
                id: 'draw',
                label: '抽 1 张牌',
                labelKey: 'ui.action_heroes_pushing_the_limit_draw_option',
                value: { mode: 'draw', ...current },
                displayMode: 'button' as const,
            },
        ],
        now,
        'button',
        'ui.action_heroes_pushing_the_limit_title',
        { remainingCandidates: remaining },
        { base: baseLabel },
    );
}

function getKickboxbroStoredActions(core: SmashUpCore, playerId: PlayerId, kickboxbroUid: string) {
    return (core.players[playerId]?.storedCards ?? []).filter(card =>
        card.storedUnderUid === kickboxbroUid && getCardDef(card.defId)?.type === 'action'
    );
}

function queueKickboxbroStoredActionPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    kickboxbroUid: string,
    now: number,
    sourceBaseIndex?: number,
): MatchState<SmashUpCore> | undefined {
    const storedActions = getKickboxbroStoredActions(matchState.core, playerId, kickboxbroUid);
    if (storedActions.length === 0) return undefined;
    return queuePrompt(
        matchState,
        playerId,
        'action_heroes_kickboxbro_play_stored',
        '踢拳兄弟：选择一张储存行动作为额外行动打出',
        [
            createSkipOption('跳过（不打出储存行动）', 'ui.action_heroes_kickboxbro_play_stored_skip_option'),
            ...storedActions.map((card, index) => ({
                id: `stored-action-${index}`,
                label: cardName(card.defId),
                value: { cardUid: card.uid, defId: card.defId },
            })),
        ],
        now,
        'generic',
        'ui.action_heroes_kickboxbro_play_stored_title',
        { kickboxbroUid, sourceBaseIndex },
    );
}
function actionHeroesAllOutOfBubblegum(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid && minion.controller === ctx.playerId);
    if (!target) return { events: [] };
    const events: SmashUpEvent[] = [
        addTempPower(target.uid, ctx.baseIndex, 2, ctx.defId, ctx.now, sourceFor(ctx)),
    ];
    if (isOnlyOwnMinionHere(ctx.state, ctx.baseIndex, ctx.playerId, target.uid)) {
        events.push(grantContextualExtraAction(ctx, ctx.defId));
    }
    return { events };
}

function actionHeroesCollateralDamage(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    if (!ctx.state.bases[baseIndex]) return { events: [] };
    return { events: [modifyBreakpoint(baseIndex, -5, ctx.defId, ctx.now)] };
}

function actionHeroesFinalStand(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base || !isOnlyOwnMinionHere(ctx.state, baseIndex, ctx.playerId)) return { events: [] };
    const events: SmashUpEvent[] = [];
    const byController = new Map<PlayerId, MinionOnBase[]>();
    for (const minion of base.minions) {
        if (minion.controller === ctx.playerId) continue;
        const printedPower = getMinionDef(minion.defId)?.power ?? minion.basePower;
        if (printedPower > 3) continue;
        byController.set(minion.controller, [...(byController.get(minion.controller) ?? []), minion]);
    }
    for (const [controllerId, candidates] of byController.entries()) {
        const target = candidates[0];
        events.push(...buildValidatedDestroyEvents(ctx.state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: baseIndex,
            destroyerId: ctx.playerId,
            reason: ctx.defId,
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: baseIndex,
            sourceKind: 'action',
            targetSnapshot: { ownerId: target.owner, controllerId },
        }));
    }
    return { events };
}

function actionHeroesFriendsThroughEternity(ctx: AbilityContext): AbilityResult {
    const options = ctx.state.players[ctx.playerId]?.hand.map((card, index) => ({
        id: `discard-${index}`,
        label: cardName(card.defId),
        value: { cardUid: card.uid },
    })) ?? [];
    if (options.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queuePrompt(ctx.matchState, ctx.playerId, ctx.defId, '永恒挚友：弃一张牌以获得两个额外行动', options, ctx.now, 'generic', 'ui.action_heroes_friends_through_eternity_title'),
    };
}

function actionHeroesGetToTheChoppa(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const sourceBaseIndex = ctx.baseIndex;
    const sourceBase = ctx.state.bases[sourceBaseIndex];
    const minion = sourceBase?.minions.find(candidate => candidate.uid === ctx.targetMinionUid && candidate.controller === ctx.playerId);
    if (!sourceBase || !minion) return { events: [] };
    const options = buildBaseTargetOptions(
        ctx.state.bases
            .map((base, baseIndex) => ({ baseIndex, label: baseName(ctx.state, baseIndex) }))
            .filter(candidate => candidate.baseIndex !== sourceBaseIndex),
        ctx.state,
    );
    if (options.length === 0) return { events: [] };
    const matchState = queuePrompt(ctx.matchState, ctx.playerId, ctx.defId, '快上直升机：选择移动目的基地', options, ctx.now, 'base', 'ui.action_heroes_get_to_the_choppa_title', {
        minionUid: minion.uid,
        minionDefId: minion.defId,
        fromBaseIndex: sourceBaseIndex,
        onlyHereBeforeMove: isOnlyOwnMinionHere(ctx.state, sourceBaseIndex, ctx.playerId, minion.uid),
    });
    return { events: [], matchState };
}

function actionHeroesHostageRescue(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minions = player?.deck.filter(card => getCardDef(card.defId)?.type === 'minion') ?? [];
    if (!player || minions.length === 0) return { events: [] };
    const options = minions.map((card, index) => ({
        id: `minion-${index}`,
        label: cardName(card.defId),
        value: { cardUid: card.uid },
    }));
    return {
        events: [inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, ctx.defId, ctx.now)],
        matchState: queuePrompt(ctx.matchState, ctx.playerId, ctx.defId, '人质救援：选择一张随从置于牌库顶', options, ctx.now, 'generic', 'ui.action_heroes_hostage_rescue_title'),
    };
}

function actionHeroesPushingTheLimit(ctx: AbilityContext): AbilityResult {
    const candidates = getActionHeroesPushingCandidates(ctx.state, ctx.playerId);
    if (candidates.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queueActionHeroesPushingChoice(ctx.matchState, ctx.playerId, candidates, ctx.now),
    };
}

function actionHeroesSloMoAttack(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const card = base?.ongoingActions.find(action => action.uid === ctx.cardUid && getActionControllerId(action) === ctx.playerId);
    if (!base || !card) return { events: [] };
    if (!isOnlyOwnMinionHere(ctx.state, ctx.baseIndex, ctx.playerId)) return { events: [] };
    return { events: [modifyBreakpoint(ctx.baseIndex, -3, ctx.defId, ctx.now)] };
}

function actionHeroesTheRightPerson(ctx: AbilityContext): AbilityResult {
    const candidates = ctx.state.bases
        .map((base, baseIndex) => ({ baseIndex, label: baseName(ctx.state, baseIndex) }))
        .filter(candidate => !ctx.state.bases[candidate.baseIndex].minions.some(minion => minion.controller === ctx.playerId));
    const events: SmashUpEvent[] = [grantContextualExtraAction(ctx, ctx.defId)];
    if (candidates.length === 0) return { events };
    if (candidates.length === 1) {
        events.unshift(grantContextualExtraMinion(ctx, ctx.defId, candidates[0].baseIndex));
        return { events };
    }
    return {
        events,
        matchState: queuePrompt(
            ctx.matchState,
            ctx.playerId,
            ctx.defId,
            '合适的人选：选择一个你没有随从的基地以获得额外随从',
            buildBaseTargetOptions(candidates, ctx.state),
            ctx.now,
            'base',
            'ui.action_heroes_the_right_person_title',
        ),
    };
}

function actionHeroesWalkAwaySlowly(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const candidates = base.minions
        .filter(minion => minion.controller === ctx.playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: cardName(minion.defId),
        }));
    if (candidates.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queuePrompt(
            ctx.matchState,
            ctx.playerId,
            ctx.defId,
            '慢慢走开：选择一个己方随从返回手牌',
            buildActionMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: ctx.defId,
                effectType: 'affect',
            }),
            ctx.now,
            'minion',
            'ui.action_heroes_walk_away_slowly_title',
        ),
    };
}

function actionHeroesWarbro(ctx: AbilityContext): AbilityResult {
    const candidates = ctx.state.bases
        .map((base, baseIndex) => ({ baseIndex, label: baseName(ctx.state, baseIndex) }))
        .filter(candidate => candidate.baseIndex !== ctx.baseIndex && isOnlyOwnMinionHere(ctx.state, candidate.baseIndex, ctx.playerId));
    if (candidates.length === 0) return { events: [] };
    if (candidates.length === 1) return { events: [modifyBreakpoint(candidates[0].baseIndex, -3, ctx.defId, ctx.now)] };
    return {
        events: [],
        matchState: queuePrompt(
            ctx.matchState,
            ctx.playerId,
            ctx.defId,
            '战争兄弟：选择另一个仅有你一个随从的基地',
            buildBaseTargetOptions(candidates, ctx.state),
            ctx.now,
            'base',
            'ui.action_heroes_warbro_title',
        ),
    };
}

function actionHeroesKickboxbroPlayStored(ctx: AbilityContext): AbilityResult {
    const promptState = queueKickboxbroStoredActionPrompt(
        ctx.matchState,
        ctx.playerId,
        ctx.cardUid,
        ctx.now,
        ctx.baseIndex,
    );
    return promptState ? { events: [], matchState: promptState } : { events: [] };
}

function actionHeroesKickboxbroBeforeScoring(ctx: AbilityContext): AbilityResult {
    if (!isOnlyOwnMinionHere(ctx.state, ctx.baseIndex, ctx.playerId, ctx.cardUid)) return { events: [] };
    return actionHeroesKickboxbroPlayStored(ctx);
}

function actionHeroesKickboxbroTurnEnd(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.matchState) {
        return { events: [] };
    }
    const player = ctx.state.players[ctx.sourceControllerId];
    if (!player || player.hand.length === 0) return { events: [] };
    const options = [
        createSkipOption('跳过（不储存手牌）', 'ui.action_heroes_kickboxbro_store_skip_option'),
        ...player.hand.map((card, index) => ({
            id: `store-${index}`,
            label: cardName(card.defId),
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
        })),
    ];
    return {
        events: [],
        matchState: queuePrompt(
            ctx.matchState,
            ctx.sourceControllerId,
            'action_heroes_kickboxbro_store',
            '踢拳兄弟：选择一张手牌储存在本牌下',
            options,
            ctx.now,
            'generic',
            'ui.action_heroes_kickboxbro_store_title',
            {
                kickboxbroUid: ctx.sourceCardUid,
                kickboxbroDefId: 'action_heroes_kickboxbro',
                sourceBaseIndex: ctx.sourceBaseIndex,
            },
        ),
    };
}
function actionHeroesCommandbroTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (!isOnlyOwnMinionHere(ctx.state, ctx.sourceBaseIndex, ctx.sourceControllerId, ctx.sourceCardUid)) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function actionHeroesGracieTurnStart(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (!isOnlyOwnMinionHere(ctx.state, ctx.sourceBaseIndex, ctx.sourceControllerId, ctx.sourceCardUid)) return [];
    const minion = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(candidate => candidate.uid === ctx.sourceCardUid);
    if (!minion) return [];
    const nextCounterCount = (minion.powerCounters ?? 0) + 1;
    return [
        addPowerCounter(minion.uid, ctx.sourceBaseIndex, 1, 'action_heroes_gracie_brones', ctx.now, {
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: minion.uid,
            sourceDefId: 'action_heroes_gracie_brones',
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
        }),
        addTempPower(minion.uid, ctx.sourceBaseIndex, nextCounterCount, 'action_heroes_gracie_brones', ctx.now, {
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: minion.uid,
            sourceDefId: 'action_heroes_gracie_brones',
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
        }),
    ];
}

function actionHeroesRobobroTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.playerId === ctx.sourceControllerId) return [];
    if (ctx.baseIndex !== ctx.sourceBaseIndex && ctx.moveToBaseIndex !== ctx.sourceBaseIndex) return [];
    return [addPowerCounter(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'action_heroes_robobro', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'action_heroes_robobro',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

function registerActionHeroesModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'action_heroes_lone_wolf',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => {
                const attachedCount = helpers.countMinionAttachmentsMatchingRuntimeDefId(ctx, 'action_heroes_lone_wolf');
                if (attachedCount === 0) return 0;
                const ownCount = helpers.countMinionsOnBaseControlledBy(ctx, ctx.minion.controller);
                return attachedCount * (ownCount === 1 ? 4 : 2);
            },
        },
        {
            sourceDefId: 'wraithrustlers_unlicensed_nuclear_accelerator',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, _helpers) => (
                ctx.minion.attachedActions
                    .filter(action => action.defId === 'wraithrustlers_unlicensed_nuclear_accelerator')
                    .reduce((total) => total + 2, 0)
            ),
        },
        {
            sourceDefId: 'wraithrustlers_roy',
            variantPolicy: 'baseOnly',
            compute: (ctx) => {
                if (ctx.minion.defId !== 'wraithrustlers_roy') return 0;
                const turn = ctx.state.turnNumber ?? 0;
                const destroyed = ((ctx.base.metadata as Record<string, unknown> | undefined)?.wraithrustlersDestroyedWraithAction ?? {}) as Record<string, number>;
                return destroyed.__any === turn || destroyed[ctx.minion.controller] === turn ? 2 : 0;
            },
        },
    ]);

    registerCustomBreakpointModifiers([
        {
            sourceDefId: 'action_heroes_rumbro',
            variantPolicy: 'baseOnly',
            compute: (ctx) => {
                const activePlayer = currentPlayerId(ctx.state);
                if (!activePlayer) return 0;
                return isOnlyOwnMinionHere(ctx.state, ctx.baseIndex, activePlayer)
                    && ctx.base.minions.some(minion => minion.defId === 'action_heroes_rumbro' && minion.controller === activePlayer)
                    ? -4
                    : 0;
            },
        },
        {
            sourceDefId: 'wraithrustlers_wraith_breakpoint',
            runtimeIdentity: 'synthetic',
            compute: (ctx) => {
                const wraithCount = ctx.base.ongoingActions.filter(action => {
                    if (action.defId === 'wraithrustlers_ancient_sumerian_god'
                        || action.defId === 'wraithrustlers_demon_dogs'
                        || action.defId === 'wraithrustlers_librarian_haunt'
                        || action.defId === 'wraithrustlers_slimy') {
                        return true;
                    }
                    return false;
                }).length;
                return wraithCount * 3;
            },
        },
    ]);
}

function actionHeroesSloMoProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourceKind !== 'action') return false;
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.ongoingActions.some(action =>
        action.defId === 'action_heroes_slo_mo_attack'
        && getActionControllerId(action) === ctx.targetMinion.controller
    ) ?? false;
}

function handleDiscardForExtraActions(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    timestamp: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const selected = value as { cardUid?: string; skip?: boolean };
    if (selected.skip || !selected.cardUid) return { state, events: [] };
    const card = state.core.players[playerId]?.hand.find(candidate => candidate.uid === selected.cardUid);
    if (!card) return { state, events: [] };
    return {
        state,
        events: [
            {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [card.uid] },
                timestamp,
            } as SmashUpEvent,
            grantExtraAction(playerId, 'action_heroes_friends_through_eternity', timestamp),
            grantExtraAction(playerId, 'action_heroes_friends_through_eternity', timestamp),
        ],
    };
}

function registerActionHeroesInteractionHandlers(): void {
    registerInteractionHandler('action_heroes_friends_through_eternity', (state, playerId, value, _data, _random, timestamp) =>
        handleDiscardForExtraActions(state, playerId, value, timestamp));

    registerInteractionHandler('action_heroes_get_to_the_choppa', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string };
        const ctx = data?.continuationContext as {
            minionUid?: string;
            minionDefId?: string;
            fromBaseIndex?: number;
            onlyHereBeforeMove?: boolean;
        } | undefined;
        if (!ctx?.minionUid || !ctx.minionDefId || ctx.fromBaseIndex === undefined || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const events = buildValidatedMoveEvents(state, {
            minionUid: ctx.minionUid,
            minionDefId: ctx.minionDefId,
            fromBaseIndex: ctx.fromBaseIndex,
            toBaseIndex: selected.baseIndex,
            toBaseDefId: selected.baseDefId,
            reason: 'action_heroes_get_to_the_choppa',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'action_heroes_get_to_the_choppa',
            sourceControllerId: playerId,
            sourceBaseIndex: ctx.fromBaseIndex,
            sourceKind: 'action',
        });
        if (ctx.onlyHereBeforeMove) {
            events.push(grantExtraAction(playerId, 'action_heroes_get_to_the_choppa', timestamp));
        }
        return { state, events };
    });

    registerInteractionHandler('action_heroes_hostage_rescue', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { cardUid?: string };
        if (!selected.cardUid) return { state, events: [] };
        return { state, events: reorderDeckWithCardOnTop(state.core, playerId, selected.cardUid, 'action_heroes_hostage_rescue', timestamp) };
    });

    registerInteractionHandler('action_heroes_pushing_the_limit', (state, playerId, value, data, random, timestamp) => {
        const selected = value as {
            mode?: 'counters' | 'draw';
            baseIndex?: number;
            minionUid?: string;
            minionDefId?: string;
            skip?: boolean;
        };
        const continuation = data?.continuationContext as { remainingCandidates?: ActionHeroesPushingCandidate[] } | undefined;
        const remainingCandidates = continuation?.remainingCandidates ?? [];
        const events: SmashUpEvent[] = [];

        if (!selected.skip && selected.mode === 'counters' && selected.baseIndex !== undefined && selected.minionUid) {
            const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate =>
                candidate.uid === selected.minionUid
                && candidate.controller === playerId
            );
            if (minion && isOnlyOwnMinionHere(state.core, selected.baseIndex, playerId, selected.minionUid)) {
                events.push(addPowerCounter(
                    selected.minionUid,
                    selected.baseIndex,
                    2,
                    'action_heroes_pushing_the_limit',
                    timestamp,
                    {
                        sourcePlayerId: playerId,
                        sourceDefId: 'action_heroes_pushing_the_limit',
                        sourceControllerId: playerId,
                        sourceBaseIndex: selected.baseIndex,
                    },
                ));
            }
        } else if (!selected.skip && selected.mode === 'draw') {
            events.push(...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp));
        }

        return {
            state: remainingCandidates.length > 0
                ? queueActionHeroesPushingChoice(state, playerId, remainingCandidates, timestamp)
                : state,
            events,
        };
    });

    registerInteractionHandler('action_heroes_slo_mo_attack', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { baseIndex?: number };
        if (selected.baseIndex === undefined) return { state, events: [] };
        return { state, events: [modifyBreakpoint(selected.baseIndex, -3, 'action_heroes_slo_mo_attack', timestamp)] };
    });

    registerInteractionHandler('action_heroes_the_right_person', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { baseIndex?: number };
        if (selected.baseIndex === undefined) return { state, events: [] };
        return { state, events: [grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'action_heroes_the_right_person', selected.baseIndex)] };
    });

    registerInteractionHandler('action_heroes_walk_away_slowly', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; minionDefId?: string; baseIndex?: number };
        if (!selected.minionUid || !selected.minionDefId || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedReturnEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId,
                fromBaseIndex: selected.baseIndex,
                reason: 'action_heroes_walk_away_slowly',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'action_heroes_walk_away_slowly',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
                sourceKind: 'action',
            }),
        };
    });

    registerInteractionHandler('action_heroes_warbro', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { baseIndex?: number };
        if (selected.baseIndex === undefined) return { state, events: [] };
        return { state, events: [modifyBreakpoint(selected.baseIndex, -3, 'action_heroes_warbro', timestamp)] };
    });

    registerInteractionHandler('action_heroes_kickboxbro_store', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { cardUid?: string; skip?: boolean };
        const continuation = data?.continuationContext as {
            kickboxbroUid?: string;
            kickboxbroDefId?: string;
            sourceBaseIndex?: number;
        } | undefined;
        if (selected.skip || !selected.cardUid || !continuation?.kickboxbroUid) return { state, events: [] };
        const player = state.core.players[playerId];
        const card = player?.hand.find(candidate => candidate.uid === selected.cardUid);
        const kickboxbroStillInPlay = state.core.bases.some(base =>
            base.minions.some(minion =>
                minion.uid === continuation.kickboxbroUid
                && minion.defId === 'action_heroes_kickboxbro'
                && minion.controller === playerId
            )
        );
        if (!card || !kickboxbroStillInPlay) return { state, events: [] };

        return {
            state,
            events: [{
                type: SU_EVENTS.CARD_STORED,
                payload: {
                    playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    ownerId: card.owner,
                    from: 'hand',
                    storedUnderUid: continuation.kickboxbroUid,
                    storedUnderDefId: continuation.kickboxbroDefId ?? 'action_heroes_kickboxbro',
                    reason: 'action_heroes_kickboxbro',
                },
                timestamp,
            } as SmashUpEvent],
        };
    });

    registerInteractionHandler('action_heroes_kickboxbro_play_stored', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string; skip?: boolean };
        const continuation = data?.continuationContext as { kickboxbroUid?: string } | undefined;
        if (selected.skip || !selected.cardUid || !continuation?.kickboxbroUid) return { state, events: [] };
        const storedAction = getKickboxbroStoredActions(state.core, playerId, continuation.kickboxbroUid)
            .find(card => card.uid === selected.cardUid && (!selected.defId || card.defId === selected.defId));
        if (!storedAction) return { state, events: [] };
        return {
            state,
            events: [grantExtraAction(playerId, 'action_heroes_kickboxbro', timestamp, {
                restrictToCardUid: storedAction.uid,
                restrictToCardDefId: storedAction.defId,
            })],
        };
    });
}

const BACKTIMERS_STASIS_REASON = 'backtimers_stasis';

function isBacktimersStasisCard(card: { reason?: string }): boolean {
    return card.reason === BACKTIMERS_STASIS_REASON;
}

function getBacktimersStasisCards(core: SmashUpCore, playerId: PlayerId) {
    return (core.players[playerId]?.storedCards ?? []).filter(isBacktimersStasisCard);
}

function stasisCounterChanged(playerId: PlayerId, cardUid: string, delta: number, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.STORED_CARD_COUNTER_CHANGED,
        payload: { playerId, cardUid, delta, reason },
        timestamp: now,
    } as SmashUpEvent;
}

function buildBacktimersStasisStoreEvent(
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    counters: number,
    sourceId: string,
    now: number,
    from: 'hand' | 'deck' | 'discard' = 'hand',
    storedUnderUid?: string,
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_STORED,
        payload: {
            playerId,
            cardUid,
            defId,
            ownerId,
            from,
            ...(storedUnderUid ? { storedUnderUid } : {}),
            storedUnderDefId: sourceId,
            counters,
            reason: BACKTIMERS_STASIS_REASON,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function buildStoredCardEvent(
    playerId: PlayerId,
    card: CardInstance,
    from: 'hand' | 'deck' | 'discard',
    reason: string,
    now: number,
    options: {
        counters?: number;
        storedUnderUid?: string;
        storedUnderDefId?: string;
    } = {},
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_STORED,
        payload: {
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            from,
            ...(options.storedUnderUid ? { storedUnderUid: options.storedUnderUid } : {}),
            ...(options.storedUnderDefId ? { storedUnderDefId: options.storedUnderDefId } : {}),
            ...(options.counters !== undefined ? { counters: options.counters } : {}),
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function buildCardToDeckTopEvent(
    card: CardInstance,
    ownerId: PlayerId,
    reason: string,
    now: number,
    source?: { sourcePlayerId?: PlayerId; sourceCardUid?: string; sourceDefId?: string; sourceControllerId?: PlayerId; sourceBaseIndex?: number },
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId,
            reason,
            ...(source ?? {}),
        },
        timestamp: now,
    } as SmashUpEvent;
}

function buildCardToDeckBottomEvent(
    card: CardInstance,
    ownerId: PlayerId,
    reason: string,
    now: number,
    source?: { sourcePlayerId?: PlayerId; sourceCardUid?: string; sourceDefId?: string; sourceControllerId?: PlayerId; sourceBaseIndex?: number },
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId,
            reason,
            ...(source ?? {}),
        },
        timestamp: now,
    } as SmashUpEvent;
}

function buildOngoingAttachedEvent(
    card: { uid: string; defId: string; ownerId: PlayerId; metadata?: Record<string, unknown>; talentUsed?: boolean; removeFromDiscard?: boolean },
    targetBaseIndex: number,
    targetType: 'base' | 'minion',
    now: number,
    targetMinionUid?: string,
    sourcePlayerId?: PlayerId,
): SmashUpEvent {
    return {
        type: SU_EVENTS.ONGOING_ATTACHED,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.ownerId,
            targetType,
            targetBaseIndex,
            ...(targetMinionUid ? { targetMinionUid } : {}),
            ...(sourcePlayerId ? { sourcePlayerId } : {}),
            ...(card.removeFromDiscard ? { removeFromDiscard: true } : {}),
            ...(card.metadata ? { metadata: card.metadata } : {}),
            ...(card.talentUsed ? { talentUsed: true } : {}),
        },
        timestamp: now,
    } as SmashUpEvent;
}

function firstOtherBaseIndex(core: SmashUpCore, baseIndex: number): number | undefined {
    return core.bases.findIndex((_, index) => index !== baseIndex) >= 0
        ? core.bases.findIndex((_, index) => index !== baseIndex)
        : undefined;
}

function findCardInZones(core: SmashUpCore, playerId: PlayerId, predicate: (card: CardInstance) => boolean) {
    const player = core.players[playerId];
    if (!player) return undefined;
    for (const zone of ['hand', 'deck', 'discard'] as const) {
        const card = player[zone].find(predicate);
        if (card) return { card, zone };
    }
    return undefined;
}

function isPrintedPower(defId: string, power: number): boolean {
    return getMinionDef(defId)?.power === power;
}

function isPrintedPowerAtMost(defId: string, powerMax: number): boolean {
    const power = getMinionDef(defId)?.power;
    return power !== undefined && power <= powerMax;
}

function buildRecoverOrTransferToHandEvent(playerId: PlayerId, card: CardInstance, zone: 'hand' | 'deck' | 'discard', reason: string, now: number): SmashUpEvent | undefined {
    if (zone === 'hand') return undefined;
    if (zone === 'discard') return recoverCardsFromDiscard(playerId, [card.uid], reason, now);
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            fromPlayerId: playerId,
            toPlayerId: playerId,
            ownerId: card.owner,
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function buildDeckReorderedEvent(playerId: PlayerId, deckUids: string[], reason: string, now: number): DeckReorderedEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids, reason },
        timestamp: now,
    } as DeckReorderedEvent;
}

function findMinionLocation(core: SmashUpCore, minionUid: string): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (const [baseIndex, base] of core.bases.entries()) {
        const minion = base.minions.find(candidate => candidate.uid === minionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function firstOwnMinion(core: SmashUpCore, playerId: PlayerId, predicate: (minion: MinionOnBase, baseIndex: number) => boolean = () => true) {
    for (const [baseIndex, base] of core.bases.entries()) {
        const minion = base.minions.find(candidate => candidate.controller === playerId && predicate(candidate, baseIndex));
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function firstOtherPlayerMinionAtBase(core: SmashUpCore, playerId: PlayerId, baseIndex: number, predicate: (minion: MinionOnBase) => boolean = () => true) {
    const minion = core.bases[baseIndex]?.minions.find(candidate => candidate.controller !== playerId && predicate(candidate));
    return minion ? { minion, baseIndex } : undefined;
}

function firstMinionAtBase(core: SmashUpCore, baseIndex: number, predicate: (minion: MinionOnBase) => boolean = () => true) {
    const minion = core.bases[baseIndex]?.minions.find(predicate);
    return minion ? { minion, baseIndex } : undefined;
}

function firstBaseOngoingAction(core: SmashUpCore, playerId: PlayerId, predicate: (action: { uid: string; defId: string; ownerId: PlayerId }, baseIndex: number) => boolean) {
    for (const [baseIndex, base] of core.bases.entries()) {
        const action = base.ongoingActions.find(candidate => getActionControllerId(candidate) === playerId && predicate(candidate, baseIndex));
        if (action) return { action, baseIndex };
    }
    return undefined;
}

function firstOngoingActionOnBase(core: SmashUpCore, baseIndex: number, predicate: (action: WraithOngoingAction) => boolean = () => true): WraithOngoingAction | undefined {
    return core.bases[baseIndex]?.ongoingActions.find(predicate);
}

function isActionPlayableOnBase(card: CardInstance): boolean {
    const def = getCardDef(card.defId);
    return def?.type === 'action'
        && (
            (def as { ongoingTarget?: string }).ongoingTarget === 'base'
            || (def as { playNeedsBase?: boolean }).playNeedsBase === true
        );
}

function drawSpecificDeckCard(playerId: PlayerId, card: CardInstance, deck: CardInstance[], reason: string, now: number): SmashUpEvent[] {
    return [
        buildDeckReorderedEvent(
            playerId,
            [card.uid, ...deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid)],
            reason,
            now,
        ),
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [card.uid] },
            timestamp: now,
        } as SmashUpEvent,
    ];
}

function playStoredCardAsExtra(playerId: PlayerId, storedCard: CardInstance, reason: string, now: number, baseIndex?: number): SmashUpEvent[] {
    const def = getCardDef(storedCard.defId);
    if (def?.type === 'minion') {
        return [
            grantExtraMinion(playerId, reason, now, baseIndex, {
                specificCardUid: storedCard.uid,
                playTiming: 'immediate',
            }),
        ];
    }
    return [
        grantExtraAction(playerId, reason, now, {
            restrictToCardUid: storedCard.uid,
            restrictToCardDefId: storedCard.defId,
            playTiming: 'immediate',
        }),
    ];
}

function hasBacktimersLastStasisCounterRemovedThisTurn(core: SmashUpCore, playerId: PlayerId): boolean {
    const turnNumber = core.turnNumber ?? 0;
    return getBacktimersStasisCards(core, playerId).some(card => card.lastStasisCounterRemovedTurn === turnNumber);
}

function buildBacktimersOwnMinionCounterOptions(core: SmashUpCore, playerId: PlayerId) {
    return buildActionMinionTargetOptions(
        core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.controller === playerId)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: `${cardName(minion.defId)} @ ${baseName(core, baseIndex)}`,
                })),
        ),
        {
            state: core,
            sourcePlayerId: playerId,
            sourceDefId: 'backtimers',
            effectType: 'affect',
        },
    );
}

function queueBacktimersMinionCounterPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceId: string,
    title: string,
    titleKey: string,
    now: number,
): MatchState<SmashUpCore> | undefined {
    const options = buildBacktimersOwnMinionCounterOptions(matchState.core, playerId);
    if (options.length === 0) return undefined;
    return queuePrompt(
        matchState,
        playerId,
        sourceId,
        title,
        [createSkipOption('跳过（不放置力量指示物）', 'ui.backtimers_minion_counter_skip_option'), ...options],
        now,
        'minion',
        titleKey,
    );
}

function backtimersStoreHandCard(
    ctx: AbilityContext,
    stasisCounters: number,
    sourceId: string,
    options: { may?: boolean; title?: string; titleKey?: string } = {},
): AbilityResult {
    const cardOptions = ctx.state.players[ctx.playerId]?.hand
        .filter(card => card.uid !== ctx.cardUid)
        .map((card, index) => ({
            id: `card-${index}`,
            label: cardName(card.defId),
            value: { cardUid: card.uid, stasisCounters },
        })) ?? [];
    const promptOptions = [
        ...(options.may ? [createSkipOption('跳过（不置入停滞）', 'ui.backtimers_store_skip_option')] : []),
        ...cardOptions,
    ];
    if (promptOptions.length === 0 || (options.may && promptOptions.length === 1)) return { events: [] };
    return {
        events: [],
        matchState: queuePrompt(
            ctx.matchState,
            ctx.playerId,
            sourceId,
            options.title ?? '返时者：选择一张手牌置入停滞',
            promptOptions,
            ctx.now,
            'generic',
            options.titleKey ?? 'ui.backtimers_store_title',
            { sourceId, stasisCounters },
        ),
    };
}

function backtimersSidelinedGirlfriend(ctx: AbilityContext): AbilityResult {
    const minion = ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.cardUid);
    if (minion?.metadata?.playedFrom !== 'stored') return { events: [] };
    return {
        events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, ctx.defId, ctx.now, sourceFor(ctx))],
    };
}

function backtimersZanyProfTurnStart(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceControllerId || !ctx.matchState) return { events: [] };
    const stasisCards = getBacktimersStasisCards(ctx.state, ctx.sourceControllerId);
    if (stasisCards.length === 0) return { events: [] };
    const options = [
        createSkipOption('跳过（不调整停滞指示物）', 'ui.backtimers_zany_prof_skip_option'),
        ...stasisCards
            .filter(card => (card.counters ?? 0) > 0)
            .map((card, index) => ({
                id: `remove-${index}`,
                label: `移除：${cardName(card.defId)} (${card.counters ?? 0})`,
                value: { mode: 'remove', cardUid: card.uid },
            })),
        ...stasisCards.map((card, index) => ({
            id: `add-${index}`,
            label: `增加：${cardName(card.defId)} (${card.counters ?? 0})`,
            value: { mode: 'add', cardUid: card.uid },
        })),
    ];
    return {
        events: [],
        matchState: queuePrompt(
            ctx.matchState,
            ctx.sourceControllerId,
            'backtimers_zany_prof_stasis',
            '疯狂博士：调整一张停滞牌的停滞指示物',
            options,
            ctx.now,
            'generic',
            'ui.backtimers_zany_prof_title',
        ),
    };
}

function registerBacktimersInteractionHandlers(): void {
    const registerStoreHandler = (sourceId: string) => {
        registerInteractionHandler(sourceId, (state, playerId, value, _data, _random, timestamp) => {
            const selected = value as { cardUid?: string; stasisCounters?: number; skip?: boolean };
            if (selected.skip || !selected.cardUid) return { state, events: [] };
            const card = state.core.players[playerId]?.hand.find(candidate => candidate.uid === selected.cardUid);
            if (!card) return { state, events: [] };
            return {
                state,
                events: [buildBacktimersStasisStoreEvent(
                    playerId,
                    card.uid,
                    card.defId,
                    card.owner,
                    selected.stasisCounters ?? 2,
                    sourceId,
                    timestamp,
                )],
            };
        });
    };

    registerStoreHandler('backtimers_99_mph');
    registerStoreHandler('backtimers_alex_p_mcglide');

    registerInteractionHandler('backtimers_zany_prof_stasis', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { mode?: 'add' | 'remove'; cardUid?: string; skip?: boolean };
        if (selected.skip || !selected.cardUid || !selected.mode) return { state, events: [] };
        const stasisCard = getBacktimersStasisCards(state.core, playerId).find(card => card.uid === selected.cardUid);
        if (!stasisCard) return { state, events: [] };
        if (selected.mode === 'remove' && (stasisCard.counters ?? 0) <= 0) return { state, events: [] };
        return {
            state,
            events: [stasisCounterChanged(
                playerId,
                stasisCard.uid,
                selected.mode === 'add' ? 1 : -1,
                'backtimers_zany_prof',
                timestamp,
            )],
        };
    });

    registerInteractionHandler('backtimers_alex_p_mcglide_counter', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; minionDefId?: string; baseIndex?: number; skip?: boolean };
        if (selected.skip || !selected.minionUid || !selected.minionDefId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate =>
            candidate.uid === selected.minionUid && candidate.controller === playerId
        );
        if (!minion) return { state, events: [] };
        return {
            state,
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'backtimers_alex_p_mcglide', timestamp, {
                sourcePlayerId: playerId,
                sourceDefId: 'backtimers_alex_p_mcglide',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
            })],
        };
    });
}

function registerBacktimers(): void {
    registerSimpleAbility('backtimers_99_mph', 'onPlay', ctx => ({
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        ],
        matchState: backtimersStoreHandCard(ctx, 2, 'backtimers_99_mph').matchState,
    }));
    registerSimpleAbility('backtimers_will_have_to_do', 'onPlay', ctx => {
        const stasisTargets = getBacktimersStasisCards(ctx.state, ctx.playerId)
            .filter(card => (card.counters ?? 0) > 0)
            .slice(0, 2);
        if (stasisTargets.length > 0) {
            return {
                events: stasisTargets.map(card => stasisCounterChanged(ctx.playerId, card.uid, -1, ctx.defId, ctx.now)),
            };
        }
        const owned = ctx.state.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.controller === ctx.playerId)
                .map(minion => addPowerCounter(minion.uid, baseIndex, 1, ctx.defId, ctx.now, sourceFor(ctx))),
        );
        return { events: owned.slice(0, 2) };
    });
    registerSimpleAbility('backtimers_sidelined_girlfriend', 'onPlay', backtimersSidelinedGirlfriend);
    registerSimpleAbility('backtimers_sidelined_girlfriend', 'special', ctx => {
        const promptState = queueBacktimersMinionCounterPrompt(
            ctx.matchState,
            ctx.playerId,
            'backtimers_sidelined_girlfriend_counter',
            '被冷落的女友：选择一个己方随从放置 +1 力量指示物',
            'ui.backtimers_sidelined_girlfriend_counter_title',
            ctx.now,
        );
        return promptState ? { events: [], matchState: promptState } : { events: [] };
    });
    registerSimpleAbility('backtimers_lifelong_bully', 'onPlay', ctx => {
        const stasis = getBacktimersStasisCards(ctx.state, ctx.playerId)[0];
        if (stasis) {
            return { events: [stasisCounterChanged(ctx.playerId, stasis.uid, 1, ctx.defId, ctx.now)] };
        }
        const player = ctx.state.players[ctx.playerId];
        const card = player?.deck[0];
        if (!player || !card) return { events: [] };
        return {
            events: [
                inspectDeck(ctx.playerId, ctx.playerId, Math.min(2, player.deck.length), ctx.defId, ctx.now),
                buildBacktimersStasisStoreEvent(ctx.playerId, card.uid, card.defId, card.owner, 2, ctx.defId, ctx.now, 'deck'),
            ],
        };
    });
    registerSimpleAbility('backtimers_alex_p_mcglide', 'onPlay', ctx => backtimersStoreHandCard(ctx, 2, ctx.defId, {
        may: true,
        title: '亚历克斯：选择一张手牌置入停滞',
        titleKey: 'ui.backtimers_alex_p_mcglide_store_title',
    }));
    registerSimpleAbility('backtimers_alex_p_mcglide', 'talent', ctx => {
        if (!hasBacktimersLastStasisCounterRemovedThisTurn(ctx.state, ctx.playerId)) return { events: [] };
        const promptState = queueBacktimersMinionCounterPrompt(
            ctx.matchState,
            ctx.playerId,
            'backtimers_alex_p_mcglide_counter',
            '亚历克斯：选择一个己方随从放置 +1 力量指示物',
            'ui.backtimers_alex_p_mcglide_counter_title',
            ctx.now,
        );
        return promptState ? { events: [], matchState: promptState } : { events: [] };
    });
    registerSimpleAbility('backtimers_back_from_the_future', 'onPlay', ctx => {
        const player = ctx.state.players[ctx.playerId];
        const card = player?.deck[0];
        if (!player || !card) return { events: [] };
        return {
            events: [
                inspectDeck(ctx.playerId, ctx.playerId, Math.min(3, player.deck.length), ctx.defId, ctx.now),
                buildBacktimersStasisStoreEvent(ctx.playerId, card.uid, card.defId, card.owner, 2, ctx.defId, ctx.now, 'deck'),
            ],
        };
    });
    registerSimpleAbility('backtimers_future_almanac', 'onPlay', ctx => {
        if (ctx.fromStored) {
            return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
        }
        const card = ctx.state.players[ctx.playerId]?.hand.find(candidate => candidate.uid === ctx.cardUid);
        return {
            events: card ? [buildBacktimersStasisStoreEvent(ctx.playerId, card.uid, card.defId, card.owner, 3, ctx.defId, ctx.now)] : [],
        };
    });
    registerSimpleAbility('backtimers_future_almanac', 'special', ctx => ({
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
    }));
    registerSimpleAbility('backtimers_lightning_strike', 'onPlay', ctx => {
        const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
        if (ctx.fromStored) {
            const stored = getBacktimersStasisCards(ctx.state, ctx.playerId).find(card => card.uid === ctx.cardUid);
            const reduction = Math.min(5, Math.max(1, stored?.counters ?? 1));
            return { events: [modifyBreakpoint(targetBaseIndex, -reduction, ctx.defId, ctx.now)] };
        }
        const card = ctx.state.players[ctx.playerId]?.hand.find(candidate => candidate.uid === ctx.cardUid);
        return {
            events: card ? [buildBacktimersStasisStoreEvent(ctx.playerId, card.uid, card.defId, card.owner, 2, ctx.defId, ctx.now)] : [],
        };
    });
    registerSimpleAbility('backtimers_lightning_strike', 'special', ctx => {
        const stasis = getBacktimersStasisCards(ctx.state, ctx.playerId).find(card => card.uid === ctx.cardUid);
        return stasis ? { events: [stasisCounterChanged(ctx.playerId, stasis.uid, 1, ctx.defId, ctx.now)] } : { events: [] };
    });
    registerSimpleAbility('backtimers_help_from_the_past', 'onPlay', ctx => {
        const storedSelf = getBacktimersStasisCards(ctx.state, ctx.playerId).find(card => card.uid === ctx.cardUid);
        if (ctx.fromStored || storedSelf) {
            const tucked = (ctx.state.players[ctx.playerId]?.storedCards ?? [])
                .find(card => card.storedUnderUid === ctx.cardUid && card.uid !== ctx.cardUid);
            return tucked ? { events: playStoredCardAsExtra(ctx.playerId, tucked, ctx.defId, ctx.now, ctx.baseIndex) } : { events: [] };
        }
        const self = ctx.state.players[ctx.playerId]?.hand.find(card => card.uid === ctx.cardUid);
        const discardCard = ctx.state.players[ctx.playerId]?.discard[0];
        const events: SmashUpEvent[] = [];
        if (self) events.push(buildBacktimersStasisStoreEvent(ctx.playerId, self.uid, self.defId, self.owner, 3, ctx.defId, ctx.now));
        if (discardCard && self) {
            events.push(buildStoredCardEvent(ctx.playerId, discardCard, 'discard', ctx.defId, ctx.now, {
                storedUnderUid: self.uid,
                storedUnderDefId: ctx.defId,
            }));
        }
        return { events };
    });
    registerSimpleAbility('backtimers_help_from_the_past', 'special', ctx => ({
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 0, ctx.random, ctx.now),
    }));
    registerSimpleAbility('backtimers_letter_from_another_time', 'onPlay', ctx => {
        const storedSelf = getBacktimersStasisCards(ctx.state, ctx.playerId).find(card => card.uid === ctx.cardUid);
        if (ctx.fromStored || storedSelf) {
            const tucked = (ctx.state.players[ctx.playerId]?.storedCards ?? [])
                .find(card => card.storedUnderUid === ctx.cardUid && card.uid !== ctx.cardUid);
            return tucked ? { events: playStoredCardAsExtra(ctx.playerId, tucked, ctx.defId, ctx.now, ctx.baseIndex) } : { events: [] };
        }
        const self = ctx.state.players[ctx.playerId]?.hand.find(card => card.uid === ctx.cardUid);
        const deckCard = ctx.state.players[ctx.playerId]?.deck[0];
        const events: SmashUpEvent[] = [];
        if (self) events.push(buildBacktimersStasisStoreEvent(ctx.playerId, self.uid, self.defId, self.owner, 3, ctx.defId, ctx.now));
        if (deckCard && self) {
            events.push(inspectDeck(ctx.playerId, ctx.playerId, ctx.state.players[ctx.playerId]?.deck.length ?? 0, ctx.defId, ctx.now));
            events.push(buildStoredCardEvent(ctx.playerId, deckCard, 'deck', ctx.defId, ctx.now, {
                storedUnderUid: self.uid,
                storedUnderDefId: ctx.defId,
            }));
        }
        return { events };
    });
    registerSimpleAbility('backtimers_letter_from_another_time', 'special', ctx => ({
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 0, ctx.random, ctx.now),
    }));
    registerSimpleAbility('backtimers_disrupt_the_space_time_continuum', 'onPlay', ctx => {
        const cards = (ctx.state.players[ctx.playerId]?.hand ?? [])
            .filter(card => card.uid !== ctx.cardUid)
            .slice(0, 2);
        const counters = Math.max(1, cards.length);
        return {
            events: cards.map(card => buildBacktimersStasisStoreEvent(
                ctx.playerId,
                card.uid,
                card.defId,
                card.owner,
                counters,
                ctx.defId,
                ctx.now,
            )),
        };
    });
    registerTrigger('backtimers_zany_prof', 'onTurnStart', backtimersZanyProfTurnStart, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerBacktimersInteractionHandlers();
}

function playTopMinionOfPower(
    core: SmashUpCore,
    playerId: PlayerId,
    powerMax: number,
    baseIndex: number,
    reason: string,
    now: number,
    exactPower?: number,
): SmashUpEvent[] {
    const player = core.players[playerId];
    const card = player?.deck.find(candidate => {
        const def = getMinionDef(candidate.defId);
        if (!def) return false;
        return exactPower === undefined ? def.power <= powerMax : def.power === exactPower;
    });
    if (!player || !card) return [];
    return [
        grantContextualExtraMinion({ playerId, now }, reason, baseIndex, {
            powerMax,
            specificCardUid: card.uid,
        }),
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: [card.uid, ...player.deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid)],
                reason,
            },
            timestamp: now,
        } as DeckReorderedEvent,
    ];
}

function extramorphsAncientCrashedShipTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
    if (baseIndex === undefined) return [];
    const base = ctx.state.bases[baseIndex];
    if (!base || base.defId !== 'base_ancient_crashed_ship') return [];
    const minion = ctx.triggerMinion
        ?? base.minions.find(candidate => candidate.uid === ctx.triggerMinionUid);
    if (!minion || !ctx.triggerMinionUid) return [];
    const playedFrom = minion.metadata?.playedFrom as string | undefined;
    if (!playedFrom || playedFrom === 'hand') return [];
    return [addPowerCounter(ctx.triggerMinionUid, baseIndex, 1, 'base_ancient_crashed_ship', ctx.now, {
        sourcePlayerId: minion.controller,
        sourceDefId: 'base_ancient_crashed_ship',
        sourceControllerId: minion.controller,
        sourceBaseIndex: baseIndex,
    })];
}

function registerExtramorphs(): void {
    registerSimpleAbility('extramorphs_close_encounters', 'onPlay', ctx => ({
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            grantContextualExtraAction(ctx, ctx.defId),
            ...((ctx.state.players[ctx.playerId]?.hand ?? [])
                .filter(card => card.uid !== ctx.cardUid)
                .slice(0, 1)
                .map(card => buildCardToDeckTopEvent(card, ctx.playerId, ctx.defId, ctx.now, sourceFor(ctx)))),
        ],
    }));
    registerSimpleAbility('extramorphs_chestbreaker', 'talent', ctx => {
        const baseIndex = ctx.baseIndex;
        const hasExact3 = ctx.state.players[ctx.playerId]?.deck.some(card => getMinionDef(card.defId)?.power === 3) ?? false;
        return { events: playTopMinionOfPower(ctx.state, ctx.playerId, hasExact3 ? 3 : 4, baseIndex, ctx.defId, ctx.now, hasExact3 ? 3 : 4) };
    });
    registerSimpleAbility('extramorphs_extradrone', 'onPlay', ctx => {
        const events: SmashUpEvent[] = [];
        if (ctx.fromDeck) {
            events.push(addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, ctx.defId, ctx.now, sourceFor(ctx)));
        }
        const target = firstOtherPlayerMinionAtBase(ctx.state, ctx.playerId, ctx.baseIndex, minion => isPrintedPowerAtMost(minion.defId, 3));
        const destination = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
        if (target && destination !== undefined) {
            events.push(...buildValidatedMoveEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: ctx.baseIndex,
                toBaseIndex: destination,
                reason: ctx.defId,
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'nonAction',
            }));
            events.push(...buildValidatedMoveEvents(ctx.state, {
                minionUid: ctx.cardUid,
                minionDefId: ctx.defId,
                fromBaseIndex: ctx.baseIndex,
                toBaseIndex: destination,
                reason: ctx.defId,
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'nonAction',
            }));
        }
        return { events };
    });
    registerSimpleAbility('extramorphs_alien_life_form', 'onPlay', ctx => {
        const events: SmashUpEvent[] = [];
        const target = firstOtherPlayerMinionAtBase(ctx.state, ctx.playerId, ctx.baseIndex, minion => isPrintedPowerAtMost(minion.defId, 3))
            ?? firstMinionAtBase(ctx.state, ctx.baseIndex, minion => minion.uid !== ctx.cardUid && isPrintedPowerAtMost(minion.defId, 3));
        if (target) {
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: ctx.playerId,
                reason: ctx.defId,
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'nonAction',
            }));
        }
        if (ctx.fromDeck) {
            events.push(addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, ctx.defId, ctx.now, sourceFor(ctx)));
        }
        return { events };
    });
    registerSimpleAbility('extramorphs_alien_life_form', 'talent', ctx => {
        const minion = ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.cardUid);
        const destination = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
        if (!minion || (minion.powerCounters ?? 0) < 1 || destination === undefined) return { events: [] };
        return {
            events: [
                removePowerCounter(ctx.cardUid, ctx.baseIndex, 1, ctx.defId, ctx.now, sourceFor(ctx)),
                ...buildValidatedMoveEvents(ctx.state, {
                    minionUid: ctx.cardUid,
                    minionDefId: ctx.defId,
                    fromBaseIndex: ctx.baseIndex,
                    toBaseIndex: destination,
                    reason: ctx.defId,
                    now: ctx.now,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                    sourceKind: 'nonAction',
                }),
            ],
        };
    });
    registerSimpleAbility('extramorphs_hive_queen', 'onPlay', ctx => {
        const located = findCardInZones(ctx.state, ctx.playerId, card => card.defId === 'extramorphs_egg_field');
        if (!located) return { events: [] };
        if (located.zone === 'deck') {
            return { events: drawSpecificDeckCard(ctx.playerId, located.card, ctx.state.players[ctx.playerId]?.deck ?? [], ctx.defId, ctx.now) };
        }
        const recovered = buildRecoverOrTransferToHandEvent(ctx.playerId, located.card, located.zone, ctx.defId, ctx.now);
        return { events: recovered ? [recovered] : [] };
    });
    registerSimpleAbility('extramorphs_hive_queen', 'talent', ctx => {
        const eggBases = new Set(ctx.state.bases.flatMap((base, baseIndex) =>
            base.ongoingActions.some(action => action.defId === 'extramorphs_egg_field' && getActionControllerId(action) === ctx.playerId)
                ? [baseIndex]
                : [],
        ));
        return {
            events: [...eggBases].flatMap(baseIndex =>
                ctx.state.bases[baseIndex].minions
                    .filter(minion => minion.controller !== ctx.playerId)
                    .map(minion => addTempPower(minion.uid, baseIndex, -1, ctx.defId, ctx.now, sourceFor(ctx))),
            ),
        };
    });
    registerSimpleAbility('extramorphs_distress_call', 'onPlay', ctx => {
        const located = ctx.targetMinionUid ? findMinionLocation(ctx.state, ctx.targetMinionUid) : undefined;
        const fallback = located ?? firstOwnMinion(ctx.state, ctx.playerId);
        const destination = fallback ? firstOtherBaseIndex(ctx.state, fallback.baseIndex) : undefined;
        if (!fallback || destination === undefined) return { events: [] };
        return { events: buildValidatedMoveEvents(ctx.state, {
            minionUid: fallback.minion.uid,
            minionDefId: fallback.minion.defId,
            fromBaseIndex: fallback.baseIndex,
            toBaseIndex: destination,
            reason: ctx.defId,
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'nonAction',
        }) };
    });
    registerSimpleAbility('extramorphs_egg_field', 'onPlay', ctx => {
        const located = findCardInZones(ctx.state, ctx.playerId, card => card.defId === 'extramorphs_head_grabber');
        const target = firstMinionAtBase(ctx.state, ctx.targetBaseIndex ?? ctx.baseIndex, minion => isPrintedPowerAtMost(minion.defId, 3));
        if (!located || !target) return { events: [] };
        return {
            events: [
                buildOngoingAttachedEvent({
                    uid: located.card.uid,
                    defId: located.card.defId,
                    ownerId: located.card.owner,
                    removeFromDiscard: located.zone === 'discard',
                }, target.baseIndex, 'minion', ctx.now, target.minion.uid, ctx.playerId),
            ],
        };
    });
    registerSimpleAbility('extramorphs_egg_field', 'talent', ctx => ({
        events: playTopMinionOfPower(ctx.state, ctx.playerId, 2, ctx.baseIndex, ctx.defId, ctx.now),
    }));
    registerSimpleAbility('extramorphs_five_by_five', 'onPlay', ctx => {
        const topCards = (ctx.state.players[ctx.playerId]?.hand ?? [])
            .filter(card => card.uid !== ctx.cardUid)
            .slice(0, 5);
        return {
            events: [
                ...buildStandardDrawEvents(ctx.state, ctx.playerId, 5, ctx.random, ctx.now),
                ...topCards.map(card => buildCardToDeckTopEvent(card, ctx.playerId, ctx.defId, ctx.now, sourceFor(ctx))),
            ],
        };
    });
    registerSimpleAbility('extramorphs_game_over_dude', 'onPlay', ctx => ({
        events: playTopMinionOfPower(ctx.state, ctx.playerId, 4, ctx.targetBaseIndex ?? ctx.baseIndex, ctx.defId, ctx.now),
    }));
    registerSimpleAbility('extramorphs_head_grabber', 'talent', ctx => {
        for (const [baseIndex, base] of ctx.state.bases.entries()) {
            const host = base.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.cardUid || action.defId === ctx.defId));
            if (!host) continue;
            return {
                events: [
                    ...buildValidatedDestroyEvents(ctx.state, {
                        minionUid: host.uid,
                        minionDefId: host.defId,
                        fromBaseIndex: baseIndex,
                        destroyerId: ctx.playerId,
                        reason: ctx.defId,
                        now: ctx.now,
                        sourcePlayerId: ctx.playerId,
                        sourceCardUid: ctx.cardUid,
                        sourceDefId: ctx.defId,
                        sourceControllerId: ctx.playerId,
                        sourceBaseIndex: baseIndex,
                        sourceKind: 'nonAction',
                    }),
                    ...playTopMinionOfPower(ctx.state, ctx.playerId, 4, baseIndex, ctx.defId, ctx.now),
                ],
            };
        }
        return { events: [] };
    });
    registerSimpleAbility('extramorphs_nuke_it_from_orbit', 'talent', ctx => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        return {
            events: [
                ...base.minions.flatMap(minion => buildValidatedDestroyEvents(ctx.state, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: ctx.baseIndex,
                    destroyerId: ctx.playerId,
                    reason: ctx.defId,
                    now: ctx.now,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                    sourceKind: 'nonAction',
                })),
                ...base.ongoingActions.map(action => detachOngoing(action.uid, action.defId, action.ownerId, ctx.defId, ctx.now)),
            ],
        };
    });
    registerSimpleAbility('extramorphs_time_to_go', 'onPlay', ctx => {
        const player = ctx.state.players[ctx.playerId];
        if (!player) return { events: [] };
        const chosen = player.discard.slice(0, 3);
        if (chosen.length === 0) return { events: [] };
        return {
            events: chosen.map(card => buildCardToDeckBottomEvent(card, ctx.playerId, ctx.defId, ctx.now, sourceFor(ctx))),
        };
    });
    registerTrigger('base_ancient_crashed_ship', 'onMinionPlayed', extramorphsAncientCrashedShipTrigger, {
        playerContext: 'eventPlayer',
        sourceScope: 'triggerBase',
        canTrigger: (ctx) => {
            const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
            if (baseIndex === undefined || ctx.state.bases[baseIndex]?.defId !== 'base_ancient_crashed_ship') return false;
            const playedFrom = ctx.triggerMinion?.metadata?.playedFrom as string | undefined;
            return !!playedFrom && playedFrom !== 'hand';
        },
    });
}

function hasTeensMinionAtBase(core: SmashUpCore, baseIndex: number, defId: string, playerId: PlayerId): boolean {
    return core.bases[baseIndex]?.minions.some(minion => minion.defId === defId && minion.controller === playerId) ?? false;
}

function firstOwnDifferentNamePrintedPower3Minion(core: SmashUpCore, playerId: PlayerId, baseIndex: number, defId: string) {
    return firstMinionAtBase(core, baseIndex, minion =>
        minion.controller === playerId
        && minion.defId !== defId
        && isPrintedPower(minion.defId, 3)
    );
}

function playExtraPrintedPower3FromDeck(ctx: AbilityContext, baseIndex = ctx.baseIndex, excludedDefId?: string): SmashUpEvent[] {
    const card = ctx.state.players[ctx.playerId]?.deck.find(candidate =>
        candidate.defId !== excludedDefId && isPrintedPower(candidate.defId, 3)
    );
    if (!card) return [];
    return [
        ...reorderDeckWithCardOnTop(ctx.state, ctx.playerId, card.uid, ctx.defId, ctx.now),
        grantContextualExtraMinion(ctx, ctx.defId, baseIndex, {
            powerMax: 3,
            specificCardUid: card.uid,
        }),
    ];
}

function moveFirstOwnMinionAway(ctx: AbilityContext, baseIndex = ctx.baseIndex): SmashUpEvent[] {
    const candidate = firstOwnMinion(ctx.state, ctx.playerId, (_minion, index) => index === baseIndex);
    const destination = firstOtherBaseIndex(ctx.state, baseIndex);
    if (!candidate || destination === undefined) return [];
    return buildValidatedMoveEvents(ctx.state, {
        minionUid: candidate.minion.uid,
        minionDefId: candidate.minion.defId,
        fromBaseIndex: baseIndex,
        toBaseIndex: destination,
        reason: ctx.defId,
        now: ctx.now,
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
        sourceKind: 'nonAction',
    });
}

function teensPower3Trigger(sourceDefId: string, ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined) return [];
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    if (!ctx.triggerMinionDefId || !isPrintedPower(ctx.triggerMinionDefId, 3)) return [];
    if (ctx.triggerMinionUid && ctx.triggerMinionUid === ctx.sourceCardUid) return [];
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source) return [];
    const sourceInfo = {
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    };
    switch (sourceDefId) {
        case 'teens_brain':
            return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
        case 'teens_jock':
            return [addPowerCounter(source.uid, ctx.sourceBaseIndex, 1, sourceDefId, ctx.now, sourceInfo)];
        case 'teens_prep': {
            const target = firstOwnMinion(ctx.state, ctx.sourceControllerId);
            return target ? [addTempPower(target.minion.uid, target.baseIndex, 2, sourceDefId, ctx.now, sourceInfo)] : [];
        }
        case 'teens_rebel': {
            const target = firstOwnMinion(ctx.state, ctx.sourceControllerId);
            const destination = target ? firstOtherBaseIndex(ctx.state, target.baseIndex) : undefined;
            if (!target || destination === undefined) return [];
            return buildValidatedMoveEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                toBaseIndex: destination,
                reason: sourceDefId,
                now: ctx.now,
                sourcePlayerId: ctx.sourceControllerId,
                sourceCardUid: ctx.sourceCardUid,
                sourceDefId,
                sourceControllerId: ctx.sourceControllerId,
                sourceBaseIndex: ctx.sourceBaseIndex,
                sourceKind: 'nonAction',
            });
        }
        case 'teens_slacker': {
            const card = ctx.state.players[ctx.sourceControllerId]?.discard[0];
            return card ? [buildCardToDeckBottomEvent(card, ctx.sourceControllerId, sourceDefId, ctx.now, sourceInfo)] : [];
        }
        default:
            return [];
    }
}

function teensBabysitterProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.minions
        .some(minion => minion.controller === ctx.targetMinion.controller
            && minion.attachedActions.some(action => action.defId === 'teens_babysitter')) ?? false;
}

function registerTeensModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'base_cabin_in_the_woods',
            runtimeIdentity: 'synthetic',
            compute: (ctx) => {
                if (ctx.base.defId !== 'base_cabin_in_the_woods') return 0;
                const count = ctx.base.minions.filter(minion => minion.controller === ctx.minion.controller).length;
                return count >= 2 ? 2 : 0;
            },
        },
    ]);
}

function registerTeens(): void {
    registerSimpleAbility('teens_brain', 'onPlay', ctx => {
        const hasSlacker = hasTeensMinionAtBase(ctx.state, ctx.baseIndex, 'teens_slacker', ctx.playerId);
        return { events: hasSlacker ? [grantContextualExtraAction(ctx, ctx.defId)] : [] };
    });
    registerSimpleAbility('teens_jock', 'onPlay', ctx => {
        const hasPrep = hasTeensMinionAtBase(ctx.state, ctx.baseIndex, 'teens_prep', ctx.playerId);
        return { events: hasPrep ? [addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, ctx.defId, ctx.now, sourceFor(ctx))] : [] };
    });
    registerSimpleAbility('teens_prep', 'onPlay', ctx => {
        if (!hasTeensMinionAtBase(ctx.state, ctx.baseIndex, 'teens_brain', ctx.playerId)) return { events: [] };
        const card = ctx.state.players[ctx.playerId]?.deck.find(candidate => isPrintedPower(candidate.defId, 3));
        if (!card) return { events: [] };
        return { events: drawSpecificDeckCard(ctx.playerId, card, ctx.state.players[ctx.playerId]?.deck ?? [], ctx.defId, ctx.now) };
    });
    registerSimpleAbility('teens_rebel', 'onPlay', ctx => {
        if (!hasTeensMinionAtBase(ctx.state, ctx.baseIndex, 'teens_jock', ctx.playerId)) return { events: [] };
        return { events: playExtraPrintedPower3FromDeck(ctx, ctx.baseIndex, ctx.defId) };
    });
    registerSimpleAbility('teens_slacker', 'onPlay', ctx => {
        if (!hasTeensMinionAtBase(ctx.state, ctx.baseIndex, 'teens_rebel', ctx.playerId)) return { events: [] };
        return { events: ctx.state.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.controller === ctx.playerId)
                .slice(0, 2)
                .flatMap(minion => {
                    const destination = firstOtherBaseIndex(ctx.state, baseIndex);
                    return destination === undefined ? [] : buildValidatedMoveEvents(ctx.state, {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        fromBaseIndex: baseIndex,
                        toBaseIndex: destination,
                        reason: ctx.defId,
                        now: ctx.now,
                        sourcePlayerId: ctx.playerId,
                        sourceCardUid: ctx.cardUid,
                        sourceDefId: ctx.defId,
                        sourceControllerId: ctx.playerId,
                        sourceBaseIndex: ctx.baseIndex,
                        sourceKind: 'nonAction',
                    });
                }),
        ).slice(0, 2) };
    });
    registerSimpleAbility('teens_abe_frohman', 'talent', ctx => {
        const host = firstOwnMinion(ctx.state, ctx.playerId, minion =>
            minion.attachedActions.some(action => action.uid === ctx.cardUid || action.defId === ctx.defId)
        );
        if (!host) return { events: [] };
        const names = ctx.state.bases.flatMap(base =>
            base.minions.filter(minion => minion.controller === ctx.playerId && minion.uid !== host.minion.uid).map(minion => minion.defId)
        );
        return [{
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: {
                minionUid: host.minion.uid,
                baseIndex: host.baseIndex,
                metadataUpdate: {
                    teensAbeFrohmanNames: names,
                    teensAbeFrohmanTurn: ctx.state.turnNumber,
                },
                reason: ctx.defId,
            },
            timestamp: ctx.now,
        } as SmashUpEvent];
    });
    registerSimpleAbility('teens_brunch_bunch', 'onPlay', ctx => {
        const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
        const printedPower3Minions = ctx.state.bases[baseIndex]?.minions
            .filter(minion => minion.controller === ctx.playerId && isPrintedPower(minion.defId, 3)) ?? [];
        const names = new Set(printedPower3Minions.map(minion => minion.defId));
        const events: SmashUpEvent[] = [];
        if (names.size >= 1) {
            const moved = moveFirstOwnMinionAway(ctx, baseIndex);
            events.push(...moved);
        }
        if (names.size >= 2) events.push(...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now));
        if (names.size >= 3) events.push(...playExtraPrintedPower3FromDeck(ctx, baseIndex));
        if (names.size >= 4) {
            const movedUid = events.find(event => event.type === SU_EVENTS.MINION_MOVED)?.payload?.minionUid;
            const target = printedPower3Minions.find(minion => minion.uid !== movedUid) ?? printedPower3Minions[0];
            if (target) events.push(addTempPower(target.uid, baseIndex, 2, ctx.defId, ctx.now, sourceFor(ctx)));
        }
        if (names.size >= 5) {
            const card = ctx.state.players[ctx.playerId]?.discard[0];
            if (card) events.push(buildCardToDeckBottomEvent(card, ctx.playerId, ctx.defId, ctx.now, sourceFor(ctx)));
        }
        return { events };
    });
    registerSimpleAbility('teens_explosion_at_school', 'onPlay', ctx => {
        const unique: CardInstance[] = [];
        const seen = new Set<string>();
        for (const card of ctx.state.players[ctx.playerId]?.discard ?? []) {
            if (!isPrintedPower(card.defId, 3) || seen.has(card.defId)) continue;
            seen.add(card.defId);
            unique.push(card);
        }
        return {
            events: [
                ...unique.map(card => buildCardToDeckBottomEvent(card, ctx.playerId, ctx.defId, ctx.now, sourceFor(ctx))),
                ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            ],
        };
    });
    registerSimpleAbility('teens_new_kid', 'onPlay', ctx => {
        const card = ctx.state.players[ctx.playerId]?.deck.find(candidate => getMinionDef(candidate.defId)?.power === 3);
        if (!card) return { events: [] };
        return {
            events: [
                ...reorderDeckWithCardOnTop(ctx.state, ctx.playerId, card.uid, ctx.defId, ctx.now),
                grantContextualExtraMinion(ctx, ctx.defId, undefined, { powerMax: 3, specificCardUid: card.uid }),
            ],
        };
    });
    registerSimpleAbility('teens_principals_office', 'onPlay', ctx => {
        const target = ctx.targetMinionUid ? findMinionLocation(ctx.state, ctx.targetMinionUid) : firstOwnMinion(ctx.state, ctx.playerId);
        return {
            events: [
                ...(target ? buildValidatedReturnEvents(ctx.state, {
                    minionUid: target.minion.uid,
                    minionDefId: target.minion.defId,
                    fromBaseIndex: target.baseIndex,
                    reason: ctx.defId,
                    now: ctx.now,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                    sourceKind: 'nonAction',
                }) : []),
                ...playExtraPrintedPower3FromDeck(ctx, target?.baseIndex ?? ctx.baseIndex),
            ],
        };
    });
    registerSimpleAbility('teens_strange_science', 'onPlay', ctx => {
        const card = ctx.state.players[ctx.playerId]?.discard.find(candidate => getMinionDef(candidate.defId)?.power === 3);
        if (!card) return { events: [] };
        return {
            events: [
                recoverCardsFromDiscard(ctx.playerId, [card.uid], ctx.defId, ctx.now),
                grantContextualExtraMinion(ctx, ctx.defId, undefined, { powerMax: 3, specificCardUid: card.uid }),
            ],
        };
    });
    for (const defId of ['teens_brain', 'teens_jock', 'teens_prep', 'teens_rebel', 'teens_slacker']) {
        registerTrigger(defId, 'onMinionPlayed', ctx => teensPower3Trigger(defId, ctx), {
            perInstance: true,
            playerContext: 'sourceController',
            sourceScope: 'triggerBase',
        });
    }
    registerTrigger('teens_booty_trap', 'onMinionPlayed', ctx => {
        if (!ctx.sourceControllerId || ctx.playerId !== ctx.sourceControllerId) return [];
        if (!ctx.triggerMinionDefId || !isPrintedPower(ctx.triggerMinionDefId, 3)) return [];
        return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('teens_booty_trap', 'onMinionMoved', ctx => {
        if (!ctx.sourceControllerId || ctx.playerId !== ctx.sourceControllerId) return [];
        if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex) return [];
        if (!ctx.triggerMinionDefId || !isPrintedPower(ctx.triggerMinionDefId, 3)) return [];
        return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('base_montridge_high', 'onMinionPlayed', ctx => {
        const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
        if (baseIndex === undefined) return [];
        const target = ctx.triggerMinionDefId
            ? firstOwnDifferentNamePrintedPower3Minion(ctx.state, ctx.playerId, baseIndex, ctx.triggerMinionDefId)
            : undefined;
        return target ? [addPowerCounter(target.minion.uid, baseIndex, 1, 'base_montridge_high', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'base_montridge_high',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: baseIndex,
        })] : [];
    }, { playerContext: 'eventPlayer', sourceScope: 'triggerBase' });
    registerProtection('teens_babysitter', 'affect', teensBabysitterProtection);
    registerProtection('teens_babysitter', 'destroy', teensBabysitterProtection);
    registerProtection('teens_babysitter', 'move', teensBabysitterProtection);
    registerTeensModifiers();
}

function isWraith(defId: string): boolean {
    return defId === 'wraithrustlers_ancient_sumerian_god'
        || defId === 'wraithrustlers_demon_dogs'
        || defId === 'wraithrustlers_librarian_haunt'
        || defId === 'wraithrustlers_slimy';
}

type WraithOngoingAction = {
    uid: string;
    defId: string;
    ownerId: PlayerId;
    metadata?: Record<string, unknown>;
    talentUsed?: boolean;
};

function firstOwnActionOnBase(core: SmashUpCore, playerId: PlayerId, baseIndex: number): { action: WraithOngoingAction; hostUid?: string } | undefined {
    const base = core.bases[baseIndex];
    if (!base) return undefined;
    const baseAction = base.ongoingActions.find(candidate => getActionControllerId(candidate) === playerId);
    if (baseAction) return { action: baseAction };
    for (const minion of base.minions) {
        const attached = minion.attachedActions.find(action => action.ownerId === playerId);
        if (attached) return { action: attached, hostUid: minion.uid };
    }
    return undefined;
}

function baseWraithDestroyedMap(core: SmashUpCore, baseIndex: number): Record<string, number> {
    const metadata = core.bases[baseIndex]?.metadata as Record<string, unknown> | undefined;
    return { ...((metadata?.wraithrustlersDestroyedWraithAction ?? {}) as Record<string, number>) };
}

function markWraithActionDestroyedOnBase(core: SmashUpCore, baseIndex: number, playerId: PlayerId, reason: string, now: number): SmashUpEvent | undefined {
    const base = core.bases[baseIndex];
    if (!base) return undefined;
    return {
        type: SU_EVENTS.BASE_METADATA_UPDATED,
        payload: {
            baseIndex,
            baseInstanceId: base.instanceId,
            metadataUpdate: {
                wraithrustlersDestroyedWraithAction: {
                    ...baseWraithDestroyedMap(core, baseIndex),
                    __any: core.turnNumber ?? 0,
                    [playerId]: core.turnNumber ?? 0,
                },
            },
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function destroyFirstOwnActionOnBase(ctx: AbilityContext, baseIndex = ctx.baseIndex): SmashUpEvent[] {
    const found = firstOwnActionOnBase(ctx.state, ctx.playerId, baseIndex);
    if (!found) return [];
    const events: SmashUpEvent[] = [
        detachOngoing(found.action.uid, found.action.defId, found.action.ownerId, ctx.defId, ctx.now, sourceFor(ctx)),
    ];
    if (isWraith(found.action.defId)) {
        const marker = markWraithActionDestroyedOnBase(ctx.state, baseIndex, ctx.playerId, ctx.defId, ctx.now);
        if (marker) events.push(marker);
    }
    return events;
}

function findAttachedActionHost(core: SmashUpCore, actionUid: string, baseIndex: number): MinionOnBase | undefined {
    return core.bases[baseIndex]?.minions.find(minion => minion.attachedActions.some(action => action.uid === actionUid));
}

function buildTransferOngoingActionEvents(
    ctx: AbilityContext,
    action: WraithOngoingAction,
    fromBaseIndex: number,
    toBaseIndex: number,
): SmashUpEvent[] {
    if (fromBaseIndex === toBaseIndex) return [];
    return [
        detachOngoing(action.uid, action.defId, action.ownerId, ctx.defId, ctx.now, sourceFor(ctx)),
        buildOngoingAttachedEvent({
            uid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            metadata: action.metadata,
            talentUsed: action.talentUsed,
            removeFromDiscard: true,
        }, toBaseIndex, 'base', ctx.now, undefined, ctx.playerId),
    ];
}

function wraithDestroyedMarker(ctx: Pick<TriggerContext, 'state' | 'baseIndex' | 'sourceBaseIndex' | 'sourceControllerId' | 'triggerCardOwnerId' | 'now'>, reason: string): SmashUpEvent[] {
    const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
    const playerId = ctx.sourceControllerId ?? ctx.triggerCardOwnerId;
    const marker = baseIndex === undefined || !playerId
        ? undefined
        : markWraithActionDestroyedOnBase(ctx.state, baseIndex, playerId, reason, ctx.now);
    return marker ? [marker] : [];
}

function wraithAncientSumerianGodDestroyed(ctx: Pick<TriggerContext, 'state' | 'baseIndex' | 'sourceBaseIndex' | 'sourceControllerId' | 'triggerCardOwnerId' | 'sourceCardUid' | 'now'>): SmashUpEvent[] {
    const playerId = ctx.sourceControllerId ?? ctx.triggerCardOwnerId;
    if (!playerId || !ctx.sourceCardUid) return wraithDestroyedMarker(ctx, 'wraithrustlers_ancient_sumerian_god');
    const storedActions = (ctx.state.players[playerId]?.storedCards ?? [])
        .filter(card => card.storedUnderUid === ctx.sourceCardUid && getCardDef(card.defId)?.type === 'action');
    const releaseEvents = storedActions
        .slice(0, ctx.state.bases.length)
        .flatMap((card, index) => [
            {
                type: SU_EVENTS.STORED_CARD_RELEASED,
                payload: { playerId, cardUid: card.uid, reason: 'wraithrustlers_ancient_sumerian_god' },
                timestamp: ctx.now,
            } as SmashUpEvent,
            grantExtraAction(playerId, 'wraithrustlers_ancient_sumerian_god', ctx.now, {
                restrictToCardUid: card.uid,
                restrictToCardDefId: card.defId,
                restrictToBase: index,
                playTiming: 'immediate',
            }),
        ]);
    return [...wraithDestroyedMarker(ctx, 'wraithrustlers_ancient_sumerian_god'), ...releaseEvents];
}

function wraithDemonDogsDestroyed(ctx: Pick<TriggerContext, 'state' | 'baseIndex' | 'sourceBaseIndex' | 'sourceControllerId' | 'triggerCardOwnerId' | 'sourceCardUid' | 'now'>): SmashUpEvent[] {
    const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
    const playerId = ctx.sourceControllerId ?? ctx.triggerCardOwnerId;
    if (baseIndex === undefined || !playerId || !ctx.sourceCardUid) return [];
    const stored = (ctx.state.players[playerId]?.storedCards ?? [])
        .find(card => card.storedUnderUid === ctx.sourceCardUid && getCardDef(card.defId)?.type === 'minion');
    return stored ? playStoredCardAsExtra(playerId, stored, 'wraithrustlers_demon_dogs', ctx.now, baseIndex) : [];
}

function rooftopPortalUsedTurnByPlayer(core: SmashUpCore, baseIndex: number): Record<PlayerId, number> {
    const metadata = core.bases[baseIndex]?.metadata as Record<string, unknown> | undefined;
    return { ...((metadata?.rooftopPortalUsedTurnByPlayer ?? {}) as Record<PlayerId, number>) };
}

function markRooftopPortalUsed(
    core: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
    reason: string,
    now: number,
): SmashUpEvent {
    const base = core.bases[baseIndex];
    return {
        type: SU_EVENTS.BASE_METADATA_UPDATED,
        payload: {
            baseIndex,
            ...(base?.instanceId ? { baseInstanceId: base.instanceId } : {}),
            metadataUpdate: {
                rooftopPortalUsedTurnByPlayer: {
                    ...rooftopPortalUsedTurnByPlayer(core, baseIndex),
                    [playerId]: core.turnNumber ?? 0,
                },
            },
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function wraithrustlersRooftopPortalTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
    if (baseIndex === undefined) return [];
    const base = ctx.state.bases[baseIndex];
    if (!base || base.defId !== 'base_rooftop_portal') return [];
    const playerId = ctx.destroyerId ?? ctx.sourceControllerId ?? ctx.playerId;
    if (!playerId) return [];
    const currentTurn = ctx.state.turnNumber ?? 0;
    if (rooftopPortalUsedTurnByPlayer(ctx.state, baseIndex)[playerId] === currentTurn) return [];
    return [
        markRooftopPortalUsed(ctx.state, baseIndex, playerId, 'base_rooftop_portal', ctx.now),
        ...buildStandardDrawEvents(ctx.state, playerId, 1, ctx.random, ctx.now),
    ];
}

function registerWraithrustlers(): void {
    registerSimpleAbility('wraithrustlers_watson', 'onPlay', ctx => {
        const destroyEvents = destroyFirstOwnActionOnBase(ctx);
        if (destroyEvents.length > 0) return { events: destroyEvents };
        const player = ctx.state.players[ctx.playerId];
        const wraith = player?.deck.find(card => isWraith(card.defId));
        if (!player || !wraith) return { events: [] };
        return {
            events: [
                inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, ctx.defId, ctx.now),
                buildDeckReorderedEvent(ctx.playerId, [
                    wraith.uid,
                    ...player.deck.filter(card => card.uid !== wraith.uid).map(card => card.uid),
                ], ctx.defId, ctx.now),
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId: ctx.playerId, count: 1, cardUids: [wraith.uid] },
                    timestamp: ctx.now,
                } as SmashUpEvent,
            ],
        };
    });
    registerSimpleAbility('wraithrustlers_roy', 'onPlay', ctx => {
        const from = firstBaseOngoingAction(ctx.state, ctx.playerId, (_action, baseIndex) => baseIndex !== ctx.baseIndex);
        return { events: from ? buildTransferOngoingActionEvents(ctx, from.action, from.baseIndex, ctx.baseIndex) : [] };
    });
    registerSimpleAbility('wraithrustlers_ellen', 'talent', ctx => {
        const events = destroyFirstOwnActionOnBase(ctx);
        if (events.length === 0) return { events: [] };
        events.push(modifyBreakpoint(ctx.baseIndex, -3, ctx.defId, ctx.now));
        return { events };
    });
    registerSimpleAbility('wraithrustlers_unlicensed_nuclear_accelerator', 'talent', ctx => {
        const events = destroyFirstOwnActionOnBase(ctx);
        if (events.length === 0) return { events: [] };
        const host = findAttachedActionHost(ctx.state, ctx.cardUid, ctx.baseIndex);
        if (host) {
            events.push(addPowerCounter(host.uid, ctx.baseIndex, 1, ctx.defId, ctx.now, sourceFor(ctx)));
        }
        return { events };
    });
    registerSimpleAbility('wraithrustlers_resurgence', 'onPlay', ctx => {
        const sourceBaseIndex = ctx.baseIndex;
        const action = firstOngoingActionOnBase(ctx.state, sourceBaseIndex);
        if (!action) return { events: [] };
        const destination = ctx.targetBaseIndex;
        return {
            events: destination !== undefined && destination !== sourceBaseIndex && ctx.state.bases[destination]
                ? buildTransferOngoingActionEvents(ctx, action, sourceBaseIndex, destination)
                : [
                    detachOngoing(action.uid, action.defId, action.ownerId, ctx.defId, ctx.now, sourceFor(ctx)),
                    ...(isWraith(action.defId) ? wraithDestroyedMarker({
                        state: ctx.state,
                        baseIndex: sourceBaseIndex,
                        sourceBaseIndex,
                        sourceControllerId: ctx.playerId,
                        triggerCardOwnerId: action.ownerId,
                        now: ctx.now,
                    }, ctx.defId) : []),
                ],
        };
    });
    registerSimpleAbility('wraithrustlers_resurgence', 'special', ctx => {
        const sourceBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
        const action = firstOngoingActionOnBase(ctx.state, sourceBaseIndex);
        const destination = firstOtherBaseIndex(ctx.state, sourceBaseIndex);
        return {
            events: action && destination !== undefined
                ? buildTransferOngoingActionEvents(ctx, action, sourceBaseIndex, destination)
                : [],
        };
    });
    registerSimpleAbility('wraithrustlers_funkman', 'special', ctx => {
        const sourceBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
        const action = firstOngoingActionOnBase(ctx.state, sourceBaseIndex);
        const destination = firstOtherBaseIndex(ctx.state, sourceBaseIndex);
        return { events: action && destination !== undefined ? buildTransferOngoingActionEvents(ctx, action, sourceBaseIndex, destination) : [] };
    });
    registerSimpleAbility('wraithrustlers_ancient_sumerian_god', 'onPlay', _ctx => ({
        events: [],
    }));
    registerSimpleAbility('wraithrustlers_ancient_sumerian_god', 'talent', ctx => ({
        events: (() => {
            const card = ctx.state.players[ctx.playerId]?.discard.find(isActionPlayableOnBase);
            return card ? [buildStoredCardEvent(ctx.playerId, card, 'discard', ctx.defId, ctx.now, {
                storedUnderUid: ctx.cardUid,
                storedUnderDefId: ctx.defId,
            })] : [];
        })(),
    }));
    registerSimpleAbility('wraithrustlers_ancient_sumerian_god', 'onDestroy', ctx => ({
        events: wraithAncientSumerianGodDestroyed({
            state: ctx.state,
            baseIndex: ctx.baseIndex,
            sourceBaseIndex: ctx.baseIndex,
            sourceControllerId: ctx.playerId,
            triggerCardOwnerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            now: ctx.now,
        }),
    }));
    registerSimpleAbility('wraithrustlers_demon_dogs', 'onPlay', ctx => {
        const player = ctx.state.players[ctx.playerId];
        const located = (player?.hand ?? [])
            .map(card => ({ card, zone: 'hand' as const }))
            .find(({ card }) => getMinionDef(card.defId)?.power !== undefined && (getMinionDef(card.defId)?.power ?? 99) <= 3)
            ?? (player?.discard ?? [])
                .map(card => ({ card, zone: 'discard' as const }))
                .find(({ card }) => getMinionDef(card.defId)?.power !== undefined && (getMinionDef(card.defId)?.power ?? 99) <= 3);
        return {
            events: located
                ? [buildStoredCardEvent(ctx.playerId, located.card, located.zone, ctx.defId, ctx.now, {
                    storedUnderUid: ctx.cardUid,
                    storedUnderDefId: ctx.defId,
                })]
                : [],
        };
    });
    registerSimpleAbility('wraithrustlers_demon_dogs', 'onDestroy', ctx => ({
        events: [
            ...wraithDestroyedMarker({
                state: ctx.state,
                baseIndex: ctx.baseIndex,
                sourceBaseIndex: ctx.baseIndex,
                sourceControllerId: ctx.playerId,
                triggerCardOwnerId: ctx.playerId,
                now: ctx.now,
            }, ctx.defId),
            ...wraithDemonDogsDestroyed({
            state: ctx.state,
            baseIndex: ctx.baseIndex,
            sourceBaseIndex: ctx.baseIndex,
            sourceControllerId: ctx.playerId,
            triggerCardOwnerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            now: ctx.now,
            }),
        ],
    }));
    registerSimpleAbility('wraithrustlers_ectoplasm_one', 'talent', ctx => {
        const targetBaseIndex = ctx.targetBaseIndex;
        const self = ctx.state.bases[ctx.baseIndex]?.ongoingActions.find(action => action.uid === ctx.cardUid);
        if (self && targetBaseIndex !== undefined && targetBaseIndex !== ctx.baseIndex && ctx.state.bases[targetBaseIndex]) {
            const minion = ctx.targetMinionUid
                ? ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.targetMinionUid && candidate.controller === ctx.playerId)
                : ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.controller === ctx.playerId);
            const moved = minion ? buildValidatedMoveEvents(ctx.state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: ctx.baseIndex,
                toBaseIndex: targetBaseIndex,
                reason: ctx.defId,
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'nonAction',
            }) : [];
            const destroyable = moved.length > 0
                ? firstOngoingActionOnBase(ctx.state, targetBaseIndex, action => action.uid !== ctx.cardUid)
                : undefined;
            return {
                events: [
                    ...buildTransferOngoingActionEvents(ctx, self, ctx.baseIndex, targetBaseIndex),
                    ...moved,
                    ...(destroyable ? [detachOngoing(destroyable.uid, destroyable.defId, destroyable.ownerId, ctx.defId, ctx.now, sourceFor(ctx))] : []),
                ],
            };
        }
        return { events: [] };
    });
    registerSimpleAbility('wraithrustlers_librarian_haunt', 'onDestroy', ctx => ({
        events: [
            ...wraithDestroyedMarker({
                state: ctx.state,
                baseIndex: ctx.baseIndex,
                sourceBaseIndex: ctx.baseIndex,
                sourceControllerId: ctx.playerId,
                triggerCardOwnerId: ctx.playerId,
                now: ctx.now,
            }, ctx.defId),
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now),
        ],
    }));
    registerSimpleAbility('wraithrustlers_slimy', 'onDestroy', ctx => ({
        events: [
            ...wraithDestroyedMarker({
                state: ctx.state,
                baseIndex: ctx.baseIndex,
                sourceBaseIndex: ctx.baseIndex,
                sourceControllerId: ctx.playerId,
                triggerCardOwnerId: ctx.playerId,
                now: ctx.now,
            }, ctx.defId),
            ...(ctx.state.bases[ctx.baseIndex]?.minions ?? [])
                .filter(minion => minion.controller === ctx.playerId)
                .map(minion => addTempPower(minion.uid, ctx.baseIndex, 2, ctx.defId, ctx.now, sourceFor(ctx))),
        ],
    }));
    registerSimpleAbility('wraithrustlers_the_tools_and_the_talent', 'onPlay', ctx => {
        const player = ctx.state.players[ctx.playerId];
        const card = player?.deck.at(-1);
        return {
            events: player && card
                ? [
                    inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, ctx.defId, ctx.now),
                    buildDeckReorderedEvent(ctx.playerId, [
                        card.uid,
                        ...player.deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid),
                    ], ctx.defId, ctx.now),
                ]
                : [],
        };
    });
    registerTrigger('wraithrustlers_ancient_sumerian_god', 'onCardDestroyed', ctx => {
        if (ctx.triggerCardDefId !== 'wraithrustlers_ancient_sumerian_god') return [];
        return wraithAncientSumerianGodDestroyed(ctx);
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('wraithrustlers_demon_dogs', 'onCardDestroyed', ctx => {
        if (ctx.triggerCardDefId !== 'wraithrustlers_demon_dogs') return [];
        return [...wraithDestroyedMarker(ctx, 'wraithrustlers_demon_dogs'), ...wraithDemonDogsDestroyed(ctx)];
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('wraithrustlers_librarian_haunt', 'onCardDestroyed', ctx => {
        if (!ctx.sourceControllerId || ctx.triggerCardDefId !== 'wraithrustlers_librarian_haunt') return [];
        return [
            ...wraithDestroyedMarker(ctx, 'wraithrustlers_librarian_haunt'),
            ...buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 3, ctx.random, ctx.now),
        ];
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('wraithrustlers_slimy', 'onCardDestroyed', ctx => {
        if (!ctx.sourceControllerId || ctx.baseIndex === undefined || ctx.triggerCardDefId !== 'wraithrustlers_slimy') return [];
        return [
            ...wraithDestroyedMarker(ctx, 'wraithrustlers_slimy'),
            ...ctx.state.bases[ctx.baseIndex].minions
                .filter(minion => minion.controller === ctx.sourceControllerId)
                .map(minion => addTempPower(minion.uid, ctx.baseIndex!, 2, 'wraithrustlers_slimy', ctx.now)),
        ];
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('wraithrustlers_ellen', 'onCardDestroyed', ctx => {
        if (!ctx.sourceControllerId || !ctx.triggerCardDefId || !isWraith(ctx.triggerCardDefId)) return [];
        return [grantContextualExtraAction({ playerId: ctx.sourceControllerId, now: ctx.now }, 'wraithrustlers_ellen')];
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('wraithrustlers_funkman', 'onCardDestroyed', ctx => {
        if (!ctx.sourceControllerId || ctx.baseIndex === undefined || !ctx.triggerCardDefId || getCardDef(ctx.triggerCardDefId)?.type !== 'action') return [];
        const base = ctx.state.bases[ctx.baseIndex];
        return base.minions
            .filter(minion => minion.controller === ctx.sourceControllerId)
            .map(minion => addTempPower(minion.uid, ctx.baseIndex!, 1, 'wraithrustlers_funkman', ctx.now));
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('base_rooftop_portal', 'onCardDestroyed', wraithrustlersRooftopPortalTrigger, {
        playerContext: 'eventPlayer',
        sourceScope: 'triggerBase',
        canTrigger: (ctx) => {
            const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
            if (baseIndex === undefined || ctx.state.bases[baseIndex]?.defId !== 'base_rooftop_portal') return false;
            const playerId = ctx.destroyerId ?? ctx.sourceControllerId ?? ctx.playerId;
            if (!playerId) return false;
            return rooftopPortalUsedTurnByPlayer(ctx.state, baseIndex)[playerId] !== (ctx.state.turnNumber ?? 0);
        },
    });
}

export function registerExcellentMoviesTeensAbilities(): void {
    registerSimpleAbility('action_heroes_all_out_of_bubblegum', 'onPlay', actionHeroesAllOutOfBubblegum);
    registerSimpleAbility('action_heroes_collateral_damage', 'onPlay', actionHeroesCollateralDamage);
    registerSimpleAbility('action_heroes_final_stand', 'special', actionHeroesFinalStand);
    registerSimpleAbility('action_heroes_friends_through_eternity', 'onPlay', actionHeroesFriendsThroughEternity);
    registerSimpleAbility('action_heroes_get_to_the_choppa', 'onPlay', actionHeroesGetToTheChoppa);
    registerSimpleAbility('action_heroes_hostage_rescue', 'onPlay', actionHeroesHostageRescue);
    registerSimpleAbility('action_heroes_kickboxbro', 'talent', actionHeroesKickboxbroPlayStored);
    registerSimpleAbility('action_heroes_kickboxbro', 'special', actionHeroesKickboxbroBeforeScoring);
    registerSimpleAbility('action_heroes_pushing_the_limit', 'onPlay', actionHeroesPushingTheLimit);
    registerSimpleAbility('action_heroes_slo_mo_attack', 'talent', actionHeroesSloMoAttack);
    registerSimpleAbility('action_heroes_the_right_person', 'onPlay', actionHeroesTheRightPerson);
    registerSimpleAbility('action_heroes_walk_away_slowly', 'special', actionHeroesWalkAwaySlowly);
    registerSimpleAbility('action_heroes_warbro', 'talent', actionHeroesWarbro);

    registerTrigger('action_heroes_commandbro', 'onTurnEnd', actionHeroesCommandbroTurnEnd, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('action_heroes_gracie_brones', 'onTurnStart', actionHeroesGracieTurnStart, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('action_heroes_robobro', 'onMinionPlayed', actionHeroesRobobroTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('action_heroes_robobro', 'onMinionMoved', actionHeroesRobobroTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('action_heroes_kickboxbro', 'onTurnEnd', actionHeroesKickboxbroTurnEnd, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    registerProtection('action_heroes_slo_mo_attack', 'affect', actionHeroesSloMoProtection);
    registerProtection('action_heroes_slo_mo_attack', 'destroy', actionHeroesSloMoProtection);
    registerProtection('action_heroes_slo_mo_attack', 'move', actionHeroesSloMoProtection);
    registerActionHeroesModifiers();
    registerActionHeroesInteractionHandlers();
    registerBacktimers();
    registerExtramorphs();
    registerTeens();
    registerWraithrustlers();
}
