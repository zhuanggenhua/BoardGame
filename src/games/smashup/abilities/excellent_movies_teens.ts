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
    inspectDeck,
    modifyBreakpoint,
    recoverCardsFromDiscard,
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

function detachOngoing(cardUid: string, defId: string, ownerId: PlayerId, reason: string, now: number): OngoingDetachedEvent {
    return buildOngoingDetachedEvent({ cardUid, defId, ownerId, reason, now }) as OngoingDetachedEvent;
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
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_STORED,
        payload: {
            playerId,
            cardUid,
            defId,
            ownerId,
            from: 'hand',
            storedUnderDefId: sourceId,
            counters,
            reason: BACKTIMERS_STASIS_REASON,
        },
        timestamp: now,
    } as SmashUpEvent;
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
        const owned = ctx.state.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.controller === ctx.playerId)
                .slice(0, 2)
                .map(minion => addPowerCounter(minion.uid, baseIndex, 1, ctx.defId, ctx.now, sourceFor(ctx))),
        );
        return { events: owned.slice(0, 2) };
    });
    registerSimpleAbility('backtimers_sidelined_girlfriend', 'onPlay', backtimersSidelinedGirlfriend);
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

function registerExtramorphs(): void {
    registerSimpleAbility('extramorphs_close_encounters', 'onPlay', ctx => ({
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            grantContextualExtraAction(ctx, ctx.defId),
        ],
    }));
    registerSimpleAbility('extramorphs_game_over_dude', 'onPlay', ctx => ({
        events: playTopMinionOfPower(ctx.state, ctx.playerId, 4, ctx.targetBaseIndex ?? ctx.baseIndex, ctx.defId, ctx.now),
    }));
    registerSimpleAbility('extramorphs_egg_field', 'talent', ctx => ({
        events: playTopMinionOfPower(ctx.state, ctx.playerId, 2, ctx.baseIndex, ctx.defId, ctx.now),
    }));
    registerSimpleAbility('extramorphs_time_to_go', 'onPlay', ctx => {
        const player = ctx.state.players[ctx.playerId];
        if (!player) return { events: [] };
        const chosen = player.discard.slice(0, 3);
        if (chosen.length === 0) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ctx.playerId,
                    deckUids: ctx.random.shuffle([...ctx.state.players[ctx.playerId].deck, ...chosen]).map(card => card.uid),
                    reason: ctx.defId,
                },
                timestamp: ctx.now,
            } as DeckReorderedEvent],
        };
    });
}

function registerTeens(): void {
    registerSimpleAbility('teens_brain', 'onPlay', ctx => {
        const hasSlacker = ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.defId === 'teens_slacker') ?? false;
        return { events: hasSlacker ? [grantContextualExtraAction(ctx, ctx.defId)] : [] };
    });
    registerSimpleAbility('teens_jock', 'onPlay', ctx => {
        const hasPrep = ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.defId === 'teens_prep') ?? false;
        return { events: hasPrep ? [addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, ctx.defId, ctx.now, sourceFor(ctx))] : [] };
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
}

function isWraith(defId: string): boolean {
    return defId === 'wraithrustlers_ancient_sumerian_god'
        || defId === 'wraithrustlers_demon_dogs'
        || defId === 'wraithrustlers_librarian_haunt'
        || defId === 'wraithrustlers_slimy';
}

function destroyFirstOwnActionOnBase(ctx: AbilityContext, baseIndex = ctx.baseIndex): SmashUpEvent[] {
    const base = ctx.state.bases[baseIndex];
    const action = base?.ongoingActions.find(candidate => getActionControllerId(candidate) === ctx.playerId)
        ?? base?.minions.flatMap(minion => minion.attachedActions.map(action => ({ action, host: minion })))
            .find(({ action }) => action.ownerId === ctx.playerId)?.action;
    if (!action) return [];
    return [detachOngoing(action.uid, action.defId, action.ownerId, ctx.defId, ctx.now)];
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
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId: ctx.playerId, count: 1, cardUids: [wraith.uid] },
                    timestamp: ctx.now,
                } as SmashUpEvent,
            ],
        };
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
        events.push(addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, ctx.defId, ctx.now, sourceFor(ctx)));
        return { events };
    });
    registerSimpleAbility('wraithrustlers_resurgence', 'onPlay', ctx => ({ events: destroyFirstOwnActionOnBase(ctx, ctx.targetBaseIndex ?? ctx.baseIndex) }));
    registerSimpleAbility('wraithrustlers_resurgence', 'special', ctx => ({ events: destroyFirstOwnActionOnBase(ctx, ctx.targetBaseIndex ?? ctx.baseIndex) }));
    registerTrigger('wraithrustlers_ellen', 'onCardDestroyed', ctx => {
        if (!ctx.sourceControllerId || !ctx.triggerCardDefId || !isWraith(ctx.triggerCardDefId)) return [];
        return [grantContextualExtraAction({ playerId: ctx.sourceControllerId, now: ctx.now }, 'wraithrustlers_ellen')];
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger('wraithrustlers_funkman', 'onCardDestroyed', ctx => {
        if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined) return [];
        const base = ctx.state.bases[ctx.sourceBaseIndex];
        return base.minions
            .filter(minion => minion.controller === ctx.sourceControllerId)
            .map(minion => addTempPower(minion.uid, ctx.sourceBaseIndex!, 1, 'wraithrustlers_funkman', ctx.now));
    }, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
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
