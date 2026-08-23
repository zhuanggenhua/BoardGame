import type { PlayerId, MatchState } from '../../../engine/types';
import {
    createSimpleChoice,
    queueInteraction,
    type PromptOption,
    type SimpleChoiceConfig,
} from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerSimpleAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import {
    addPowerCounter,
    addTempPower,
    buildActionMinionTargetOptions,
    buildBaseTargetOptions,
    buildFieldSourceActionOptions,
    buildFieldSourceToBaseTargetOptions,
    buildFieldSourceToMinionTargetOptions,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
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
import {
    buildActivationPlayedThisTurnMetadata,
    getBoardTalentUseRequirement,
    wasActivationSourcePlayedThisTurn,
} from '../domain/activationMetadata';
import { SU_EVENT_TYPES as SU_EVENTS } from '../domain/events';
import type {
    BaseReplacedEvent,
    CardRemovedFromGameEvent,
    CardsDrawnEvent,
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

function findAttachedOngoingHost(core: SmashUpCore, baseIndex: number, cardUid: string, defId: string) {
    const base = core.bases[baseIndex];
    if (!base) return undefined;
    for (const host of base.minions) {
        const action = host.attachedActions.find(candidate =>
            candidate.uid === cardUid
            && candidate.defId === defId);
        if (action) return { host, action, baseIndex };
    }
    return undefined;
}

function findBaseOngoing(core: SmashUpCore, baseIndex: number, cardUid: string, defId: string) {
    return core.bases[baseIndex]?.ongoingActions.find(action =>
        action.uid === cardUid
        && action.defId === defId);
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
    targetType: 'button' | 'base' | 'hand' | 'minion' | 'generic' | 'field-source-target' | 'field-source-action',
    titleKey?: string,
    continuationContext?: Record<string, unknown>,
    titleParams?: SimpleChoiceConfig['titleParams'],
    config: Partial<Pick<SimpleChoiceConfig, 'autoRefresh' | 'genericIntent' | 'multi' | 'responseValidationMode'>> = {},
): MatchState<SmashUpCore> {
    const interaction = createSimpleChoice(
        `${sourceId}_${now}`,
        playerId,
        title,
        options,
        { ...config, sourceId, targetType, titleKey, titleParams, autoResolveIfSingle: false },
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

type ActionHeroesFinalStandChoice = {
    baseIndex?: number;
    minionUid?: string;
    minionDefId?: string;
    controllerId?: PlayerId;
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

function getActionHeroesFinalStandCandidates(
    core: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
    controllerId: PlayerId,
): ActionHeroesFinalStandChoice[] {
    const base = core.bases[baseIndex];
    if (!base) return [];
    return base.minions
        .filter(minion => minion.controller === controllerId && minion.controller !== playerId)
        .filter(minion => (getMinionDef(minion.defId)?.power ?? minion.basePower) <= 3)
        .map(minion => ({
            baseIndex,
            minionUid: minion.uid,
            minionDefId: minion.defId,
            controllerId,
        }));
}

function getActionHeroesFinalStandControllers(
    core: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
): PlayerId[] {
    return core.turnOrder.filter(controllerId =>
        controllerId !== playerId
        && getActionHeroesFinalStandCandidates(core, baseIndex, playerId, controllerId).length > 0);
}

function queueActionHeroesFinalStandChoice(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    baseIndex: number,
    controllerIds: PlayerId[],
    now: number,
): MatchState<SmashUpCore> {
    const [controllerId, ...remainingControllerIds] = controllerIds;
    const options = controllerId
        ? getActionHeroesFinalStandCandidates(matchState.core, baseIndex, playerId, controllerId).map((candidate, index) => ({
            id: `final-stand-${controllerId}-${index}`,
            label: cardName(candidate.minionDefId ?? ''),
            value: candidate,
            displayMode: 'card' as const,
        }))
        : [];
    return queuePrompt(
        matchState,
        playerId,
        'action_heroes_final_stand',
        '最后一搏：选择要摧毁的随从',
        options,
        now,
        'minion',
        'ui.action_heroes_final_stand_title',
        { baseIndex, remainingControllerIds },
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
    const controllerIds = getActionHeroesFinalStandControllers(ctx.state, baseIndex, ctx.playerId);
    if (controllerIds.length === 0) return { events: [] };
    if (!ctx.matchState) {
        const events = controllerIds.flatMap(controllerId => {
            const target = getActionHeroesFinalStandCandidates(ctx.state, baseIndex, ctx.playerId, controllerId)[0];
            const live = target ? ctx.state.bases[baseIndex]?.minions.find(minion => minion.uid === target.minionUid) : undefined;
            if (!target || !live) return [];
            return buildValidatedDestroyEvents(ctx.state, {
                minionUid: live.uid,
                minionDefId: live.defId,
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
                targetSnapshot: { ownerId: live.owner, controllerId },
            });
        });
        return { events };
    }
    return {
        events: [],
        matchState: queueActionHeroesFinalStandChoice(ctx.matchState, ctx.playerId, baseIndex, controllerIds, ctx.now),
    };
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
    if (!ctx.matchState) return { events };
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
    if (!ctx.matchState) return { events: [] };
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

    registerInteractionHandler('action_heroes_final_stand', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ActionHeroesFinalStandChoice;
        const continuation = data?.continuationContext as {
            baseIndex?: number;
            remainingControllerIds?: PlayerId[];
        } | undefined;
        const baseIndex = continuation?.baseIndex ?? selected.baseIndex;
        const remainingControllerIds = continuation?.remainingControllerIds ?? [];
        const live = baseIndex !== undefined && selected.minionUid
            ? state.core.bases[baseIndex]?.minions.find(minion =>
                minion.uid === selected.minionUid
                && minion.controller === selected.controllerId
                && minion.controller !== playerId
                && (getMinionDef(minion.defId)?.power ?? minion.basePower) <= 3)
            : undefined;
        const events = live && baseIndex !== undefined
            ? buildValidatedDestroyEvents(state.core, {
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: baseIndex,
                destroyerId: playerId,
                reason: 'action_heroes_final_stand',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'action_heroes_final_stand',
                sourceControllerId: playerId,
                sourceBaseIndex: baseIndex,
                sourceKind: 'action',
                targetSnapshot: { ownerId: live.owner, controllerId: live.controller },
            })
            : [];
        return {
            state: baseIndex !== undefined && remainingControllerIds.length > 0
                ? queueActionHeroesFinalStandChoice(state, playerId, baseIndex, remainingControllerIds, timestamp)
                : state,
            events,
        };
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

type ExcellentMoviesCardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    zone?: 'hand' | 'deck' | 'discard';
    skip?: boolean;
};

type ExcellentMoviesMinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    defId?: string;
    baseIndex?: number;
    baseDefId?: string;
    targetBaseIndex?: number;
    targetBaseDefId?: string;
    skip?: boolean;
};

type TeensBrunchBunchChoice = ExcellentMoviesMinionChoice & ExcellentMoviesCardChoice & {
    effect?: 'move' | 'draw' | 'extra-minion' | 'power' | 'discard';
};

type ExcellentMoviesPowerChoice = {
    power?: number;
    baseIndex?: number;
    baseDefId?: string;
    skip?: boolean;
};

function buildCardPoolOptions(
    cards: CardInstance[],
    zone: ExcellentMoviesCardChoice['zone'],
    prefix: string,
): PromptOption<ExcellentMoviesCardChoice>[] {
    return cards.map(card => ({
        id: `${prefix}-${card.uid}`,
        label: cardName(card.defId),
        value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner, zone },
        displayMode: 'card' as const,
    }));
}

function buildTopDeckCardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    count: number,
    predicate: (card: CardInstance) => boolean = () => true,
): PromptOption<ExcellentMoviesCardChoice>[] {
    return buildCardPoolOptions(
        (core.players[playerId]?.deck ?? []).slice(0, count).filter(predicate),
        'deck',
        'deck',
    );
}

function buildDeckCardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    predicate: (card: CardInstance) => boolean = () => true,
): PromptOption<ExcellentMoviesCardChoice>[] {
    return buildCardPoolOptions(
        (core.players[playerId]?.deck ?? []).filter(predicate),
        'deck',
        'deck',
    );
}

function buildDiscardCardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    predicate: (card: CardInstance) => boolean = () => true,
): PromptOption<ExcellentMoviesCardChoice>[] {
    return buildCardPoolOptions(
        (core.players[playerId]?.discard ?? []).filter(predicate),
        'discard',
        'discard',
    );
}

function buildHandCardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    excludeCardUid?: string,
    predicate: (card: CardInstance) => boolean = () => true,
): PromptOption<ExcellentMoviesCardChoice>[] {
    return buildCardPoolOptions(
        (core.players[playerId]?.hand ?? [])
            .filter(card => card.uid !== excludeCardUid && predicate(card)),
        'hand',
        'hand',
    );
}

function buildMinionChoiceOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    sourceDefId: string,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
    effectType: 'affect' | 'move' | 'destroy' | 'return' = 'move',
    sourceKind: 'action' | 'nonAction' = 'action',
): PromptOption<ExcellentMoviesMinionChoice>[] {
    return buildMinionTargetOptions(
        core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => predicate(minion, baseIndex))
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
            sourceDefId,
            sourceKind,
            effectType,
            respectActionProtection: sourceKind === 'action',
        },
    ) as PromptOption<ExcellentMoviesMinionChoice>[];
}

function buildOtherBaseChoiceOptions(core: SmashUpCore, excludedBaseIndex: number): PromptOption<{ baseIndex?: number; baseDefId?: string }>[] {
    return buildBaseTargetOptions(
        core.bases
            .map((_base, baseIndex) => ({ baseIndex, label: baseName(core, baseIndex) }))
            .filter(candidate => candidate.baseIndex !== excludedBaseIndex),
        core,
    );
}

function buildMinionToOtherBaseChoiceOptions(
    core: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): PromptOption<ExcellentMoviesMinionChoice>[] {
    return core.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => predicate(minion, baseIndex))
            .flatMap(minion => core.bases
                .map((_targetBase, targetBaseIndex) => ({ targetBaseIndex, targetBaseDefId: core.bases[targetBaseIndex]?.defId }))
                .filter(target => target.targetBaseIndex !== baseIndex)
                .map(target => ({
                    id: `move-${minion.uid}-${target.targetBaseIndex}`,
                    label: `${cardName(minion.defId)} -> ${baseName(core, target.targetBaseIndex)}`,
                    value: {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        defId: minion.defId,
                        baseIndex,
                        targetBaseIndex: target.targetBaseIndex,
                        targetBaseDefId: target.targetBaseDefId,
                    },
                    displayMode: 'card' as const,
                }))),
    );
}

function buildMoveSelectedMinionEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    selected: ExcellentMoviesMinionChoice,
    targetBaseIndex: number | undefined,
    reason: string,
    now: number,
    sourceCardUid: string | undefined,
    sourceBaseIndex: number | undefined,
    sourceKind: 'action' | 'nonAction',
): SmashUpEvent[] {
    const fromBaseIndex = selected.baseIndex;
    const minionDefId = selected.minionDefId ?? selected.defId;
    if (!selected.minionUid || !minionDefId || fromBaseIndex === undefined || targetBaseIndex === undefined || fromBaseIndex === targetBaseIndex) return [];
    return buildValidatedMoveEvents(core, {
        minionUid: selected.minionUid,
        minionDefId,
        fromBaseIndex,
        toBaseIndex: targetBaseIndex,
        reason,
        now,
        sourcePlayerId: playerId,
        sourceCardUid,
        sourceDefId: reason,
        sourceControllerId: playerId,
        sourceBaseIndex,
        sourceKind,
    });
}

function buildDestroySelectedMinionEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    selected: ExcellentMoviesMinionChoice,
    reason: string,
    now: number,
    sourceCardUid: string | undefined,
    sourceBaseIndex: number | undefined,
    sourceKind: 'action' | 'nonAction',
): SmashUpEvent[] {
    const baseIndex = selected.baseIndex;
    const minionDefId = selected.minionDefId ?? selected.defId;
    if (!selected.minionUid || !minionDefId || baseIndex === undefined) return [];
    return buildValidatedDestroyEvents(core, {
        minionUid: selected.minionUid,
        minionDefId,
        fromBaseIndex: baseIndex,
        destroyerId: playerId,
        reason,
        now,
        sourcePlayerId: playerId,
        sourceCardUid,
        sourceDefId: reason,
        sourceControllerId: playerId,
        sourceBaseIndex,
        sourceKind,
    });
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

function buildOwnMinionTargetOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    sourceDefId: string,
    effectType: 'affect' | 'move' = 'affect',
) {
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
            sourceDefId,
            effectType,
        },
    );
}

function buildHandCardChoiceOptions(core: SmashUpCore, playerId: PlayerId, excludeCardUid?: string) {
    return (core.players[playerId]?.hand ?? [])
        .filter(card => card.uid !== excludeCardUid)
        .map((card, index) => ({
            id: `hand-${index}`,
            label: cardName(card.defId),
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
            displayMode: 'card' as const,
        }));
}

function buildDiscardCardChoiceOptions(core: SmashUpCore, playerId: PlayerId) {
    return (core.players[playerId]?.discard ?? []).map((card, index) => ({
        id: `discard-${index}`,
        label: cardName(card.defId),
        value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
        displayMode: 'card' as const,
    }));
}

function buildWillHaveToDoCounterOptions(core: SmashUpCore, playerId: PlayerId) {
    return core.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId)
            .flatMap(minion => [0, 1].map(slot => ({
                id: `counter-${baseIndex}-${minion.uid}-${slot}`,
                label: `${cardName(minion.defId)} @ ${baseName(core, baseIndex)} +1`,
                value: {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    defId: minion.defId,
                    baseIndex,
                    counterSlot: slot,
                },
                displayMode: 'card' as const,
            }))),
    );
}

function buildWillHaveToDoStasisOptions(core: SmashUpCore, playerId: PlayerId) {
    return getBacktimersStasisCards(core, playerId)
        .filter(card => (card.counters ?? 0) > 0)
        .flatMap(card => Array.from({ length: Math.min(2, card.counters ?? 0) }, (_, slot) => ({
            id: `stasis-${card.uid}-${slot}`,
            label: `${cardName(card.defId)} -1 停滞`,
            value: { cardUid: card.uid, defId: card.defId, counterSlot: slot },
            displayMode: 'card' as const,
        })));
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

    registerInteractionHandler('backtimers_will_have_to_do_mode', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { mode?: 'counters' | 'stasis'; skip?: boolean };
        if (selected.skip || !selected.mode) return { state, events: [] };
        if (selected.mode === 'counters') {
            const options = buildWillHaveToDoCounterOptions(state.core, playerId);
            if (options.length === 0) return { state, events: [] };
            return {
                state: queuePrompt(
                    state,
                    playerId,
                    'backtimers_will_have_to_do_counters',
                    '将就一下：选择至多两个力量指示物放置位置',
                    options,
                    timestamp,
                    'minion',
                    'ui.backtimers_will_have_to_do_counters_title',
                    undefined,
                    undefined,
                    { autoRefresh: 'field', multi: { min: 0, max: Math.min(2, options.length) }, responseValidationMode: 'live' },
                ),
                events: [],
            };
        }
        const options = buildWillHaveToDoStasisOptions(state.core, playerId);
        if (options.length === 0) return { state, events: [] };
        return {
            state: queuePrompt(
                state,
                playerId,
                'backtimers_will_have_to_do_stasis',
                '将就一下：选择至多两个要移除的停滞指示物',
                options,
                timestamp,
                'generic',
                'ui.backtimers_will_have_to_do_stasis_title',
                undefined,
                undefined,
                { genericIntent: 'card-pool', multi: { min: 0, max: Math.min(2, options.length) }, responseValidationMode: 'live' },
            ),
            events: [],
        };
    });

    registerInteractionHandler('backtimers_will_have_to_do_counters', (state, playerId, value, _data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : value ? [value] : []) as Array<{
            minionUid?: string;
            minionDefId?: string;
            defId?: string;
            baseIndex?: number;
        }>;
        const events = choices.flatMap(choice => {
            const minionDefId = choice.minionDefId ?? choice.defId;
            if (!choice.minionUid || !minionDefId || choice.baseIndex === undefined) return [];
            const live = state.core.bases[choice.baseIndex]?.minions.find(minion =>
                minion.uid === choice.minionUid && minion.controller === playerId
            );
            return live
                ? [addPowerCounter(choice.minionUid, choice.baseIndex, 1, 'backtimers_will_have_to_do', timestamp, {
                    sourcePlayerId: playerId,
                    sourceDefId: 'backtimers_will_have_to_do',
                    sourceControllerId: playerId,
                    sourceBaseIndex: choice.baseIndex,
                })]
                : [];
        });
        return { state, events };
    });

    registerInteractionHandler('backtimers_will_have_to_do_stasis', (state, playerId, value, _data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : value ? [value] : []) as Array<{ cardUid?: string }>;
        const usedByCardUid = new Map<string, number>();
        const events: SmashUpEvent[] = [];
        for (const choice of choices) {
            if (!choice.cardUid) continue;
            const alreadyUsed = usedByCardUid.get(choice.cardUid) ?? 0;
            const card = getBacktimersStasisCards(state.core, playerId).find(candidate => candidate.uid === choice.cardUid);
            if (!card || (card.counters ?? 0) <= alreadyUsed) continue;
            usedByCardUid.set(choice.cardUid, alreadyUsed + 1);
            events.push(stasisCounterChanged(playerId, card.uid, -1, 'backtimers_will_have_to_do', timestamp));
        }
        return { state, events };
    });

    registerInteractionHandler('backtimers_help_from_the_past_discard', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { cardUid?: string; skip?: boolean };
        const continuation = data?.continuationContext as { storedUnderUid?: string } | undefined;
        if (selected.skip || !selected.cardUid || !continuation?.storedUnderUid) return { state, events: [] };
        const card = state.core.players[playerId]?.discard.find(candidate => candidate.uid === selected.cardUid);
        if (!card) return { state, events: [] };
        return {
            state,
            events: [buildStoredCardEvent(playerId, card, 'discard', 'backtimers_help_from_the_past', timestamp, {
                storedUnderUid: continuation.storedUnderUid,
                storedUnderDefId: 'backtimers_help_from_the_past',
            })],
        };
    });

    registerInteractionHandler('backtimers_lifelong_bully', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice & { mode?: 'stasis' | 'deck' };
        if (selected.skip || !selected.cardUid || !selected.mode) return { state, events: [] };
        if (selected.mode === 'stasis') {
            const stasisCard = getBacktimersStasisCards(state.core, playerId).find(card => card.uid === selected.cardUid);
            return stasisCard
                ? { state, events: [stasisCounterChanged(playerId, stasisCard.uid, 1, 'backtimers_lifelong_bully', timestamp)] }
                : { state, events: [] };
        }
        const player = state.core.players[playerId];
        const card = player?.deck.find(candidate => candidate.uid === selected.cardUid);
        return player && card
            ? {
                state,
                events: [
                    inspectDeck(playerId, playerId, Math.min(2, player.deck.length), 'backtimers_lifelong_bully', timestamp),
                    buildBacktimersStasisStoreEvent(playerId, card.uid, card.defId, card.owner, 2, 'backtimers_lifelong_bully', timestamp, 'deck'),
                ],
            }
            : { state, events: [] };
    });

    registerInteractionHandler('backtimers_back_from_the_future', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        if (selected.skip || !selected.cardUid) return { state, events: [] };
        const card = state.core.players[playerId]?.deck.find(candidate => candidate.uid === selected.cardUid);
        return card
            ? {
                state,
                events: [buildBacktimersStasisStoreEvent(playerId, card.uid, card.defId, card.owner, 2, 'backtimers_back_from_the_future', timestamp, 'deck')],
            }
            : { state, events: [] };
    });

    registerInteractionHandler('backtimers_letter_from_another_time_deck', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        const continuation = data?.continuationContext as { storedUnderUid?: string } | undefined;
        if (selected.skip || !selected.cardUid || !continuation?.storedUnderUid) return { state, events: [] };
        const card = state.core.players[playerId]?.deck.find(candidate => candidate.uid === selected.cardUid);
        return card
            ? {
                state,
                events: [
                    inspectDeck(playerId, playerId, state.core.players[playerId]?.deck.length ?? 0, 'backtimers_letter_from_another_time', timestamp),
                    buildStoredCardEvent(playerId, card, 'deck', 'backtimers_letter_from_another_time', timestamp, {
                        storedUnderUid: continuation.storedUnderUid,
                        storedUnderDefId: 'backtimers_letter_from_another_time',
                    }),
                ],
            }
            : { state, events: [] };
    });

    registerInteractionHandler('backtimers_disrupt_the_space_time_continuum', (state, playerId, value, _data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : value ? [value] : []) as Array<{ cardUid?: string }>;
        const selectedCards = choices
            .map(choice => state.core.players[playerId]?.hand.find(card => card.uid === choice.cardUid))
            .filter((card): card is CardInstance => Boolean(card))
            .slice(0, 2);
        const counters = selectedCards.length;
        return {
            state,
            events: selectedCards.map(card => buildBacktimersStasisStoreEvent(
                playerId,
                card.uid,
                card.defId,
                card.owner,
                counters,
                'backtimers_disrupt_the_space_time_continuum',
                timestamp,
            )),
        };
    });

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
        if (ctx.matchState) {
            const modeOptions = [
                ...(buildWillHaveToDoCounterOptions(ctx.state, ctx.playerId).length > 0
                    ? [{
                        id: 'counters',
                        label: '+1 力量指示物',
                        labelKey: 'ui.backtimers_will_have_to_do_counters_option',
                        value: { mode: 'counters' as const },
                        displayMode: 'button' as const,
                    }]
                    : []),
                ...(buildWillHaveToDoStasisOptions(ctx.state, ctx.playerId).length > 0
                    ? [{
                        id: 'stasis',
                        label: '移除停滞指示物',
                        labelKey: 'ui.backtimers_will_have_to_do_stasis_option',
                        value: { mode: 'stasis' as const },
                        displayMode: 'button' as const,
                    }]
                    : []),
            ];
            if (modeOptions.length === 0) return { events: [] };
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'backtimers_will_have_to_do_mode',
                    '将就一下：选择放置力量指示物或移除停滞指示物',
                    [createSkipOption('跳过（不使用效果）', 'ui.backtimers_will_have_to_do_skip_option'), ...modeOptions],
                    ctx.now,
                    'button',
                    'ui.backtimers_will_have_to_do_mode_title',
                ),
            };
        }
        return { events: [] };
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
        const stasisOptions = getBacktimersStasisCards(ctx.state, ctx.playerId).map(card => ({
            id: `stasis-${card.uid}`,
            label: `停滞区：${cardName(card.defId)}`,
            value: { mode: 'stasis' as const, cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
        }));
        const deckOptions = buildTopDeckCardOptions(ctx.state, ctx.playerId, 2).map(option => ({
            ...option,
            id: `deck-choice-${option.value?.cardUid ?? option.id}`,
            label: `牌库顶：${option.label}`,
            value: { ...option.value, mode: 'deck' as const },
        }));
        const options = [
            createSkipOption('跳过（不放置停滞指示物）', 'ui.backtimers_lifelong_bully_skip_option'),
            ...stasisOptions,
            ...deckOptions,
        ] as PromptOption<ExcellentMoviesCardChoice & { mode?: 'stasis' | 'deck' }>[];
        if (options.length <= 1) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                ctx.defId,
                '一生恶霸：选择停滞牌或牌库顶牌放置停滞指示物',
                options,
                ctx.now,
                'generic',
                'ui.backtimers_lifelong_bully_title',
                undefined,
                undefined,
                { genericIntent: 'card-pool', responseValidationMode: 'live' },
            ),
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
        const options = buildTopDeckCardOptions(ctx.state, ctx.playerId, 3);
        if (!player || options.length === 0) return { events: [] };
        return {
            events: [
                inspectDeck(ctx.playerId, ctx.playerId, Math.min(3, player.deck.length), ctx.defId, ctx.now),
            ],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                ctx.defId,
                '从未来回来：选择是否将展示牌之一置入停滞',
                [createSkipOption('跳过（不置入停滞）', 'ui.backtimers_back_from_the_future_skip_option'), ...options],
                ctx.now,
                'generic',
                'ui.backtimers_back_from_the_future_title',
                undefined,
                undefined,
                { genericIntent: 'card-pool', responseValidationMode: 'live' },
            ),
        };
    });
    registerSimpleAbility('backtimers_future_almanac', 'onPlay', ctx => {
        if (ctx.fromStored) {
            return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
        }
        const card = ctx.state.players[ctx.playerId]?.hand.find(candidate => candidate.uid === ctx.cardUid);
        return {
            events: card ? [buildBacktimersStasisStoreEvent(ctx.playerId, card.uid, card.defId, card.owner, 3, ctx.defId, ctx.now, 'discard')] : [],
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
            events: card ? [buildBacktimersStasisStoreEvent(ctx.playerId, card.uid, card.defId, card.owner, 2, ctx.defId, ctx.now, 'discard')] : [],
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
        const events: SmashUpEvent[] = [];
        if (self) events.push(buildBacktimersStasisStoreEvent(ctx.playerId, self.uid, self.defId, self.owner, 3, ctx.defId, ctx.now, 'discard'));
        if (ctx.matchState && self && (ctx.state.players[ctx.playerId]?.discard.length ?? 0) > 0) {
            return {
                events,
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'backtimers_help_from_the_past_discard',
                    '来自过去的帮助：选择弃牌堆中要储存的牌',
                    buildDiscardCardChoiceOptions(ctx.state, ctx.playerId),
                    ctx.now,
                    'generic',
                    'ui.backtimers_help_from_the_past_discard_title',
                    { storedUnderUid: self.uid },
                    undefined,
                    { autoRefresh: 'discard', genericIntent: 'card-pool', responseValidationMode: 'live' },
                ),
            };
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
        const events: SmashUpEvent[] = [];
        if (self) events.push(buildBacktimersStasisStoreEvent(ctx.playerId, self.uid, self.defId, self.owner, 3, ctx.defId, ctx.now, 'discard'));
        const deckOptions = buildDeckCardOptions(ctx.state, ctx.playerId);
        if (self && deckOptions.length > 0) {
            return {
                events,
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'backtimers_letter_from_another_time_deck',
                    '来自另一个时间的信：选择牌库中要储存的牌',
                    deckOptions,
                    ctx.now,
                    'generic',
                    'ui.backtimers_letter_from_another_time_deck_title',
                    { storedUnderUid: self.uid },
                    undefined,
                    { autoRefresh: 'deck', genericIntent: 'card-pool', responseValidationMode: 'live' },
                ),
            };
        }
        return { events };
    });
    registerSimpleAbility('backtimers_letter_from_another_time', 'special', ctx => ({
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 0, ctx.random, ctx.now),
    }));
    registerSimpleAbility('backtimers_disrupt_the_space_time_continuum', 'onPlay', ctx => {
        if (ctx.matchState) {
            const options = buildHandCardChoiceOptions(ctx.state, ctx.playerId, ctx.cardUid);
            if (options.length === 0) return { events: [] };
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    ctx.defId,
                    '扰乱时空连续体：选择至多两张手牌置入停滞',
                    options,
                    ctx.now,
                    'hand',
                    'ui.backtimers_disrupt_the_space_time_continuum_title',
                    undefined,
                    undefined,
                    { autoRefresh: 'hand', multi: { min: 0, max: Math.min(2, options.length) }, responseValidationMode: 'live' },
                ),
            };
        }
        return { events: [] };
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
    matchState?: Pick<MatchState<SmashUpCore>, 'sys'>,
): SmashUpEvent[] {
    const player = core.players[playerId];
    const card = player?.deck.find(candidate => {
        const def = getMinionDef(candidate.defId);
        if (!def) return false;
        return exactPower === undefined ? def.power <= powerMax : def.power === exactPower;
    });
    if (!player || !card) return [];
    return [
        grantContextualExtraMinion({ playerId, now, matchState }, reason, baseIndex, {
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

function buildAvailablePowerOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    powers: number[],
    prefix: string,
): PromptOption<ExcellentMoviesPowerChoice>[] {
    return powers
        .filter(power => (core.players[playerId]?.deck ?? []).some(card => getMinionDef(card.defId)?.power === power))
        .map(power => ({
            id: `${prefix}-${power}`,
            label: `选择力量 ${power}`,
            value: { power },
            displayMode: 'button' as const,
        }));
}

function queueGameOverDudePowerPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceCardUid: string | undefined,
    baseIndex: number,
    now: number,
): MatchState<SmashUpCore> | undefined {
    const options = buildAvailablePowerOptions(matchState.core, playerId, [1, 2, 3, 4], 'power');
    if (options.length === 0) return undefined;
    return queuePrompt(
        matchState,
        playerId,
        'extramorphs_game_over_dude_power',
        '游戏结束了伙计：选择要打出的随从力量',
        options,
        now,
        'button',
        'ui.extramorphs_game_over_dude_power_title',
        { sourceCardUid, sourceBaseIndex: baseIndex },
        undefined,
        { responseValidationMode: 'live' },
    );
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

function registerExtramorphsInteractionHandlers(): void {
    registerInteractionHandler('extramorphs_chestbreaker_power', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesPowerChoice;
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (selected.skip || selected.power === undefined || !continuation?.sourceCardUid || continuation.sourceBaseIndex === undefined) {
            return { state, events: [] };
        }
        const minion = state.core.bases[continuation.sourceBaseIndex]?.minions.find(candidate =>
            candidate.uid === continuation.sourceCardUid
            && candidate.defId === 'extramorphs_chestbreaker'
            && candidate.controller === playerId);
        if (!minion) return { state, events: [] };
        return {
            state,
            events: [
                ...playTopMinionOfPower(
                    state.core,
                    playerId,
                    selected.power,
                    continuation.sourceBaseIndex,
                    'extramorphs_chestbreaker',
                    timestamp,
                    selected.power,
                    state,
                ),
                ...buildValidatedCardToDeckBottomEvents(state.core, {
                    cardUid: continuation.sourceCardUid,
                    defId: 'extramorphs_chestbreaker',
                    ownerId: minion.owner ?? playerId,
                    sourcePlayerId: playerId,
                    sourceCardUid: continuation.sourceCardUid,
                    sourceDefId: 'extramorphs_chestbreaker',
                    sourceControllerId: playerId,
                    sourceBaseIndex: continuation.sourceBaseIndex,
                    reason: 'extramorphs_chestbreaker',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            ],
        };
    });

    registerInteractionHandler('extramorphs_game_over_dude_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesPowerChoice;
        const continuation = data?.continuationContext as { sourceCardUid?: string } | undefined;
        if (selected.skip || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state: queueGameOverDudePowerPrompt(
                state,
                playerId,
                continuation?.sourceCardUid,
                selected.baseIndex,
                timestamp,
            ) ?? state,
            events: [],
        };
    });

    registerInteractionHandler('extramorphs_game_over_dude_power', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesPowerChoice;
        const continuation = data?.continuationContext as { sourceBaseIndex?: number } | undefined;
        if (selected.skip || selected.power === undefined || continuation?.sourceBaseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: playTopMinionOfPower(
                state.core,
                playerId,
                selected.power,
                continuation.sourceBaseIndex,
                'extramorphs_game_over_dude',
                timestamp,
                selected.power,
                state,
            ),
        };
    });

    registerInteractionHandler('extramorphs_extradrone_target', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesMinionChoice;
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (selected.skip || !selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const targetBaseOptions = buildOtherBaseChoiceOptions(state.core, selected.baseIndex);
        if (targetBaseOptions.length === 0) return { state, events: [] };
        return {
            state: queuePrompt(
                state,
                playerId,
                'extramorphs_extradrone_base',
                '额外工蜂：选择敌方随从移动到的基地',
                targetBaseOptions,
                timestamp,
                'base',
                'ui.extramorphs_extradrone_base_title',
                {
                    targetMinionUid: selected.minionUid,
                    targetMinionDefId: selected.minionDefId ?? selected.defId,
                    fromBaseIndex: selected.baseIndex,
                    sourceCardUid: continuation?.sourceCardUid,
                    sourceBaseIndex: continuation?.sourceBaseIndex,
                },
                undefined,
                { autoRefresh: 'base', responseValidationMode: 'live' },
            ),
            events: [],
        };
    });

    registerInteractionHandler('extramorphs_extradrone_base', (state, playerId, value, data, _random, timestamp) => {
        const selectedBase = value as { baseIndex?: number; baseDefId?: string };
        const continuation = data?.continuationContext as {
            targetMinionUid?: string;
            targetMinionDefId?: string;
            fromBaseIndex?: number;
            sourceCardUid?: string;
            sourceBaseIndex?: number;
        } | undefined;
        if (
            selectedBase.baseIndex === undefined
            || !continuation?.targetMinionUid
            || !continuation.targetMinionDefId
            || continuation.fromBaseIndex === undefined
        ) {
            return { state, events: [] };
        }
        const events = buildValidatedMoveEvents(state, {
            minionUid: continuation.targetMinionUid,
            minionDefId: continuation.targetMinionDefId,
            fromBaseIndex: continuation.fromBaseIndex,
            toBaseIndex: selectedBase.baseIndex,
            toBaseDefId: selectedBase.baseDefId,
            reason: 'extramorphs_extradrone',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceCardUid: continuation.sourceCardUid,
            sourceDefId: 'extramorphs_extradrone',
            sourceControllerId: playerId,
            sourceBaseIndex: continuation.sourceBaseIndex,
            sourceKind: 'nonAction',
        });
        const self = continuation.sourceCardUid && continuation.sourceBaseIndex !== undefined
            ? state.core.bases[continuation.sourceBaseIndex]?.minions.find(minion => minion.uid === continuation.sourceCardUid)
            : undefined;
        if (!self || continuation.sourceBaseIndex === selectedBase.baseIndex) return { state, events };
        return {
            state: queuePrompt(
                state,
                playerId,
                'extramorphs_extradrone_self',
                '额外工蜂：选择是否把额外工蜂也移动到该基地',
                [
                    createSkipOption('跳过（不移动额外工蜂）', 'ui.extramorphs_extradrone_self_skip_option'),
                    {
                        id: 'move-self',
                        label: `移动到 ${baseName(state.core, selectedBase.baseIndex)}`,
                        value: { targetBaseIndex: selectedBase.baseIndex, targetBaseDefId: selectedBase.baseDefId },
                        displayMode: 'button' as const,
                    },
                ],
                timestamp,
                'button',
                'ui.extramorphs_extradrone_self_title',
                {
                    sourceCardUid: continuation.sourceCardUid,
                    sourceBaseIndex: continuation.sourceBaseIndex,
                },
                undefined,
                { responseValidationMode: 'live' },
            ),
            events,
        };
    });

    registerInteractionHandler('extramorphs_extradrone_self', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { targetBaseIndex?: number; targetBaseDefId?: string; skip?: boolean };
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (selected.skip || !continuation?.sourceCardUid || continuation.sourceBaseIndex === undefined || selected.targetBaseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: continuation.sourceCardUid,
                minionDefId: 'extramorphs_extradrone',
                fromBaseIndex: continuation.sourceBaseIndex,
                toBaseIndex: selected.targetBaseIndex,
                toBaseDefId: selected.targetBaseDefId,
                reason: 'extramorphs_extradrone',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: continuation.sourceCardUid,
                sourceDefId: 'extramorphs_extradrone',
                sourceControllerId: playerId,
                sourceBaseIndex: continuation.sourceBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('extramorphs_alien_life_form_destroy', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesMinionChoice;
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (selected.skip) return { state, events: [] };
        return {
            state,
            events: buildDestroySelectedMinionEvents(
                state.core,
                playerId,
                selected,
                'extramorphs_alien_life_form',
                timestamp,
                continuation?.sourceCardUid,
                continuation?.sourceBaseIndex,
                'nonAction',
            ),
        };
    });

    registerInteractionHandler('extramorphs_alien_life_form_talent_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string; skip?: boolean };
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (selected.skip || !continuation?.sourceCardUid || continuation.sourceBaseIndex === undefined || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                removePowerCounter(continuation.sourceCardUid, continuation.sourceBaseIndex, 1, 'extramorphs_alien_life_form', timestamp, {
                    sourcePlayerId: playerId,
                    sourceCardUid: continuation.sourceCardUid,
                    sourceDefId: 'extramorphs_alien_life_form',
                    sourceControllerId: playerId,
                    sourceBaseIndex: continuation.sourceBaseIndex,
                }),
                ...buildValidatedMoveEvents(state, {
                    minionUid: continuation.sourceCardUid,
                    minionDefId: 'extramorphs_alien_life_form',
                    fromBaseIndex: continuation.sourceBaseIndex,
                    toBaseIndex: selected.baseIndex,
                    toBaseDefId: selected.baseDefId,
                    reason: 'extramorphs_alien_life_form',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: continuation.sourceCardUid,
                    sourceDefId: 'extramorphs_alien_life_form',
                    sourceControllerId: playerId,
                    sourceBaseIndex: continuation.sourceBaseIndex,
                    sourceKind: 'nonAction',
                }),
            ],
        };
    });

    registerInteractionHandler('extramorphs_distress_call_minion', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesMinionChoice;
        if (selected.skip || !selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const baseOptions = buildOtherBaseChoiceOptions(state.core, selected.baseIndex);
        if (baseOptions.length === 0) return { state, events: [] };
        return {
            state: queuePrompt(
                state,
                playerId,
                'extramorphs_distress_call_base',
                '求救信号：选择移动目的基地',
                baseOptions,
                timestamp,
                'base',
                'ui.extramorphs_distress_call_base_title',
                {
                    minionUid: selected.minionUid,
                    minionDefId: selected.minionDefId ?? selected.defId,
                    fromBaseIndex: selected.baseIndex,
                },
                undefined,
                { autoRefresh: 'base', responseValidationMode: 'live' },
            ),
            events: [],
        };
    });

    registerInteractionHandler('extramorphs_distress_call_base', (state, playerId, value, data, _random, timestamp) => {
        const selectedBase = value as { baseIndex?: number; baseDefId?: string };
        const continuation = data?.continuationContext as { minionUid?: string; minionDefId?: string; fromBaseIndex?: number } | undefined;
        if (selectedBase.baseIndex === undefined || !continuation?.minionUid || !continuation.minionDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: continuation.minionUid,
                minionDefId: continuation.minionDefId,
                fromBaseIndex: continuation.fromBaseIndex,
                toBaseIndex: selectedBase.baseIndex,
                toBaseDefId: selectedBase.baseDefId,
                reason: 'extramorphs_distress_call',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'extramorphs_distress_call',
                sourceControllerId: playerId,
                sourceKind: 'action',
            }),
        };
    });

    registerInteractionHandler('extramorphs_egg_field_head_grabber', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        const continuation = data?.continuationContext as { sourceBaseIndex?: number } | undefined;
        if (selected.skip || !selected.cardUid || !selected.defId || !selected.zone || continuation?.sourceBaseIndex === undefined) {
            return { state, events: [] };
        }
        const minionOptions = buildMinionChoiceOptions(
            state.core,
            playerId,
            'extramorphs_egg_field',
            (minion, baseIndex) => baseIndex === continuation.sourceBaseIndex && isPrintedPowerAtMost(minion.defId, 3),
            'affect',
        );
        if (minionOptions.length === 0) return { state, events: [] };
        return {
            state: queuePrompt(
                state,
                playerId,
                'extramorphs_egg_field_target',
                '卵场：选择抱头虫附着的弱随从',
                minionOptions,
                timestamp,
                'minion',
                'ui.extramorphs_egg_field_target_title',
                {
                    cardUid: selected.cardUid,
                    defId: selected.defId,
                    ownerId: selected.ownerId,
                    zone: selected.zone,
                    sourceBaseIndex: continuation.sourceBaseIndex,
                },
                undefined,
                { autoRefresh: 'field', responseValidationMode: 'live' },
            ),
            events: [],
        };
    });

    registerInteractionHandler('extramorphs_egg_field_target', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesMinionChoice;
        const continuation = data?.continuationContext as {
            cardUid?: string;
            defId?: string;
            ownerId?: PlayerId;
            zone?: 'hand' | 'deck' | 'discard';
            sourceBaseIndex?: number;
        } | undefined;
        if (
            selected.skip
            || !selected.minionUid
            || selected.baseIndex === undefined
            || !continuation?.cardUid
            || !continuation.defId
            || !continuation.ownerId
        ) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                buildActionPlayedEvent({
                    playerId,
                    cardUid: continuation.cardUid,
                    defId: continuation.defId,
                    ownerId: continuation.ownerId,
                    isExtraAction: true,
                    targetBaseIndex: selected.baseIndex,
                    targetMinionUid: selected.minionUid,
                    fromDiscard: continuation.zone === 'discard',
                    timestamp,
                }) as SmashUpEvent,
                ...buildSemanticOngoingAttachEvents(state, {
                    cardUid: continuation.cardUid,
                    defId: continuation.defId,
                    ownerId: continuation.ownerId,
                    sourcePlayerId: playerId,
                    sourceKind: 'action',
                    targetBaseIndex: selected.baseIndex,
                    targetMinionUid: selected.minionUid,
                    metadata: buildActivationPlayedThisTurnMetadata(continuation.defId),
                    removeFromDiscard: continuation.zone === 'discard',
                    onBlockedSourceDestination: 'discard',
                    now: timestamp,
                }),
            ],
        };
    });

    registerInteractionHandler('extramorphs_time_to_go', (state, playerId, value, _data, _random, timestamp) => {
        const selectedCards = ((Array.isArray(value) ? value : value ? [value] : []) as ExcellentMoviesCardChoice[])
            .filter(choice => !choice.skip && choice.cardUid)
            .slice(0, 3)
            .map(choice => state.core.players[playerId]?.discard.find(card => card.uid === choice.cardUid))
            .filter((card): card is CardInstance => Boolean(card));
        return {
            state,
            events: selectedCards.map(card => buildCardToDeckBottomEvent(card, playerId, 'extramorphs_time_to_go', timestamp, {
                sourcePlayerId: playerId,
                sourceDefId: 'extramorphs_time_to_go',
                sourceControllerId: playerId,
            })),
        };
    });

    registerInteractionHandler('extramorphs_close_encounters_hand', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        if (selected.skip || !selected.cardUid) return { state, events: [] };
        const card = state.core.players[playerId]?.hand.find(candidate => candidate.uid === selected.cardUid);
        if (!card) return { state, events: [] };
        return {
            state,
            events: [buildCardToDeckTopEvent(card, playerId, 'extramorphs_close_encounters', timestamp, {
                sourcePlayerId: playerId,
                sourceDefId: 'extramorphs_close_encounters',
                sourceControllerId: playerId,
            })],
        };
    });

    registerInteractionHandler('extramorphs_five_by_five_order', (state, playerId, value, data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : value ? [value] : []) as ExcellentMoviesCardChoice[];
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };
        const used = new Set<string>();
        const selectedCards = choices
            .map(choice => {
                if (!choice.cardUid || used.has(choice.cardUid)) return undefined;
                used.add(choice.cardUid);
                return player.hand.find(card => card.uid === choice.cardUid);
            })
            .filter((card): card is CardInstance => Boolean(card))
            .slice(0, 5);
        return {
            state,
            events: [...selectedCards].reverse().map(card => buildCardToDeckTopEvent(card, playerId, 'extramorphs_five_by_five', timestamp, {
                sourcePlayerId: playerId,
                sourceCardUid: continuation?.sourceCardUid,
                sourceDefId: 'extramorphs_five_by_five',
                sourceControllerId: playerId,
                sourceBaseIndex: continuation?.sourceBaseIndex,
            })),
        };
    });
}

function registerExtramorphs(): void {
    registerExtramorphsInteractionHandlers();

    registerSimpleAbility('extramorphs_close_encounters', 'onPlay', ctx => {
        const drawEvents = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
        const events = [
            ...drawEvents,
            grantContextualExtraAction(ctx, ctx.defId),
        ];
        const drawnCardUids = new Set(drawEvents
            .filter((event): event is CardsDrawnEvent => event.type === SU_EVENTS.CARDS_DRAWN)
            .flatMap(event => event.payload.cardUids));
        const drawnCardOptions = buildCardPoolOptions(
            [
                ...(ctx.state.players[ctx.playerId]?.deck ?? []),
                ...(ctx.state.players[ctx.playerId]?.discard ?? []),
            ].filter(card => drawnCardUids.has(card.uid)),
            'hand',
            'hand',
        );
        const initialHandOptions = buildHandCardOptions(ctx.state, ctx.playerId, ctx.cardUid);
        const initialOptions = [
            ...initialHandOptions,
            ...drawnCardOptions.filter(option =>
                !initialHandOptions.some(existing => existing.value.cardUid === option.value.cardUid)),
        ];
        if (initialOptions.length === 0) {
            return { events };
        }
        return {
            events,
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'extramorphs_close_encounters_hand',
                '近距离接触：选择是否将一张手牌置于牌库顶',
                [createSkipOption('跳过（不放回牌库顶）', 'ui.extramorphs_close_encounters_hand_skip_option'), ...initialOptions],
                ctx.now,
                'hand',
                'ui.extramorphs_close_encounters_hand_title',
                { sourceCardUid: ctx.cardUid },
                undefined,
                {
                    autoRefresh: 'hand',
                    responseValidationMode: 'live',
                },
            ),
        };
    });
    registerSimpleAbility('extramorphs_chestbreaker', 'talent', {
        validateUse: ctx => {
            const minion = ctx.state.bases[ctx.baseIndex]?.minions.find(candidate =>
                candidate.uid === ctx.cardUid
                && candidate.defId === ctx.defId
                && candidate.controller === ctx.playerId);
            if (!minion) return '破胸者必须在基地上才能使用天赋';
            if (
                getBoardTalentUseRequirement(ctx.defId) === 'sourceInPlayAtStartOfTurn'
                && wasActivationSourcePlayedThisTurn(minion)
            ) {
                return '破胸者必须在本回合开始时已经位于基地上才能使用';
            }
            return null;
        },
        execute: ctx => {
            const baseIndex = ctx.baseIndex;
            const options = buildAvailablePowerOptions(ctx.state, ctx.playerId, [3, 4], 'chestbreaker-power');
            if (options.length === 0) return { events: [] };
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'extramorphs_chestbreaker_power',
                    '破胸者：选择要从牌库顶打出的随从力量',
                    options,
                    ctx.now,
                    'button',
                    'ui.extramorphs_chestbreaker_power_title',
                    { sourceCardUid: ctx.cardUid, sourceBaseIndex: baseIndex },
                    undefined,
                    { responseValidationMode: 'live' },
                ),
            };
        },
    });
    registerSimpleAbility('extramorphs_extradrone', 'onPlay', ctx => {
        const events: SmashUpEvent[] = [];
        if (ctx.fromDeck) {
            events.push(addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, ctx.defId, ctx.now, sourceFor(ctx)));
        }
        const options = buildMinionChoiceOptions(
            ctx.state,
            ctx.playerId,
            ctx.defId,
            (minion, baseIndex) =>
                baseIndex === ctx.baseIndex
                && minion.controller !== ctx.playerId
                && isPrintedPowerAtMost(minion.defId, 3)
                && firstOtherBaseIndex(ctx.state, baseIndex) !== undefined,
            'move',
            'nonAction',
        );
        if (options.length === 0) return { events };
        return {
            events,
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'extramorphs_extradrone_target',
                '额外工蜂：选择要移动的敌方弱随从',
                [createSkipOption('跳过（不移动敌方随从）', 'ui.extramorphs_extradrone_skip_option'), ...options],
                ctx.now,
                'minion',
                'ui.extramorphs_extradrone_target_title',
                { sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex },
                undefined,
                { autoRefresh: 'field', responseValidationMode: 'live' },
            ),
        };
    });
    registerSimpleAbility('extramorphs_alien_life_form', 'onPlay', ctx => {
        const events: SmashUpEvent[] = [];
        if (ctx.fromDeck) {
            events.push(addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, ctx.defId, ctx.now, sourceFor(ctx)));
        }
        const options = buildMinionChoiceOptions(
            ctx.state,
            ctx.playerId,
            ctx.defId,
            (minion, baseIndex) =>
                baseIndex === ctx.baseIndex
                && minion.uid !== ctx.cardUid
                && isPrintedPowerAtMost(minion.defId, 3),
            'destroy',
            'nonAction',
        );
        if (options.length === 0) return { events };
        return {
            events,
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'extramorphs_alien_life_form_destroy',
                '异形生命体：选择是否摧毁这里的弱随从',
                [createSkipOption('跳过（不摧毁随从）', 'ui.extramorphs_alien_life_form_destroy_skip_option'), ...options],
                ctx.now,
                'minion',
                'ui.extramorphs_alien_life_form_destroy_title',
                { sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex },
                undefined,
                { autoRefresh: 'field', responseValidationMode: 'live' },
            ),
        };
    });
    registerSimpleAbility('extramorphs_alien_life_form', 'talent', ctx => {
        const minion = ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.cardUid);
        const options = buildOtherBaseChoiceOptions(ctx.state, ctx.baseIndex);
        if (!minion || (minion.powerCounters ?? 0) < 1 || options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'extramorphs_alien_life_form_talent_base',
                '异形生命体：选择移动到的基地',
                options,
                ctx.now,
                'base',
                'ui.extramorphs_alien_life_form_talent_base_title',
                { sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex },
                undefined,
                { autoRefresh: 'base', responseValidationMode: 'live' },
            ),
        };
    });
    registerInteractionHandler('extramorphs_hive_queen', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        if (selected.skip || !selected.cardUid || !selected.defId || !selected.zone) return { state, events: [] };
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };
        if (selected.zone === 'deck') {
            const card = player.deck.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId);
            return {
                state,
                events: card ? drawSpecificDeckCard(playerId, card, player.deck, 'extramorphs_hive_queen', timestamp) : [],
            };
        }
        if (selected.zone === 'discard') {
            const card = player.discard.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId);
            return {
                state,
                events: card ? [recoverCardsFromDiscard(playerId, [card.uid], 'extramorphs_hive_queen', timestamp)] : [],
            };
        }
        return { state, events: [] };
    });
    registerSimpleAbility('extramorphs_hive_queen', 'onPlay', ctx => {
        const player = ctx.state.players[ctx.playerId];
        if (!player) return { events: [] };
        const options = [
            ...buildDeckCardOptions(ctx.state, ctx.playerId, card => card.defId === 'extramorphs_egg_field')
                .map(option => ({ ...option, label: `${option.label}（牌库）` })),
            ...buildDiscardCardOptions(ctx.state, ctx.playerId, card => card.defId === 'extramorphs_egg_field')
                .map(option => ({ ...option, label: `${option.label}（弃牌堆）` })),
        ];
        if (options.length === 0) return { events: [] };
        if (ctx.matchState) {
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'extramorphs_hive_queen',
                    '异形女王：选择牌库或弃牌堆中的卵场加入手牌',
                    [createSkipOption('跳过（不检索卵场）', 'ui.skip'), ...options],
                    ctx.now,
                    'generic',
                    undefined,
                    undefined,
                    undefined,
                    { genericIntent: 'card-pool', responseValidationMode: 'live' },
                ),
            };
        }
        const deckCard = player.deck.find(card => card.defId === 'extramorphs_egg_field');
        if (deckCard) {
            return { events: drawSpecificDeckCard(ctx.playerId, deckCard, player.deck, ctx.defId, ctx.now) };
        }
        const discardCard = player.discard.find(card => card.defId === 'extramorphs_egg_field');
        return { events: discardCard ? [recoverCardsFromDiscard(ctx.playerId, [discardCard.uid], ctx.defId, ctx.now)] : [] };
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
        const options = buildMinionChoiceOptions(
            ctx.state,
            ctx.playerId,
            ctx.defId,
            (_minion, baseIndex) => firstOtherBaseIndex(ctx.state, baseIndex) !== undefined,
            'move',
        );
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'extramorphs_distress_call_minion',
                '求救信号：选择要移动的随从',
                options,
                ctx.now,
                'minion',
                'ui.extramorphs_distress_call_minion_title',
                { sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex },
                undefined,
                { autoRefresh: 'field', responseValidationMode: 'live' },
            ),
        };
    });
    registerSimpleAbility('extramorphs_egg_field', 'onPlay', ctx => {
        const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
        const headGrabberOptions = [
            ...buildHandCardOptions(ctx.state, ctx.playerId, undefined, card => card.defId === 'extramorphs_head_grabber'),
            ...buildDeckCardOptions(ctx.state, ctx.playerId, card => card.defId === 'extramorphs_head_grabber'),
            ...buildDiscardCardOptions(ctx.state, ctx.playerId, card => card.defId === 'extramorphs_head_grabber'),
        ];
        const hasTarget = ctx.state.bases[baseIndex]?.minions.some(minion => isPrintedPowerAtMost(minion.defId, 3)) ?? false;
        if (headGrabberOptions.length === 0 || !hasTarget) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'extramorphs_egg_field_head_grabber',
                '卵场：选择是否检索并打出抱头虫',
                [createSkipOption('跳过（不打出抱头虫）', 'ui.extramorphs_egg_field_skip_option'), ...headGrabberOptions],
                ctx.now,
                'generic',
                'ui.extramorphs_egg_field_head_grabber_title',
                { sourceCardUid: ctx.cardUid, sourceBaseIndex: baseIndex },
                undefined,
                { genericIntent: 'card-pool', responseValidationMode: 'live' },
            ),
        };
    });
    registerSimpleAbility('extramorphs_egg_field', 'talent', ctx => ({
        events: playTopMinionOfPower(ctx.state, ctx.playerId, 2, ctx.baseIndex, ctx.defId, ctx.now, undefined, ctx.matchState),
    }));
    registerSimpleAbility('extramorphs_five_by_five', 'onPlay', ctx => {
        const drawEvents = buildStandardDrawEvents(ctx.state, ctx.playerId, 5, ctx.random, ctx.now);
        const drawnCardUids = new Set(drawEvents
            .filter((event): event is CardsDrawnEvent => event.type === SU_EVENTS.CARDS_DRAWN)
            .flatMap(event => event.payload.cardUids));
        const handOptions = buildHandCardOptions(ctx.state, ctx.playerId, ctx.cardUid);
        const drawnOptions = buildCardPoolOptions(
            (ctx.state.players[ctx.playerId]?.deck ?? []).filter(card => drawnCardUids.has(card.uid)),
            'hand',
            'drawn',
        );
        const options = [
            ...handOptions,
            ...drawnOptions.filter(option => !handOptions.some(existing => existing.value.cardUid === option.value.cardUid)),
        ];
        const requiredCount = Math.min(5, options.length);
        if (requiredCount === 0) {
            return { events: drawEvents };
        }
        return {
            events: drawEvents,
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'extramorphs_five_by_five_order',
                '五乘五：按顺序选择要放回牌库顶的五张手牌',
                options,
                ctx.now,
                'hand',
                undefined,
                { sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex },
                undefined,
                { autoRefresh: 'hand', multi: { min: requiredCount, max: requiredCount, ordered: true }, responseValidationMode: 'live' },
            ),
        };
    });
    registerSimpleAbility('extramorphs_game_over_dude', 'onPlay', ctx => {
        if (ctx.targetBaseIndex === undefined) {
            const options = buildBaseTargetOptions(
                ctx.state.bases.map((_base, baseIndex) => ({ baseIndex, label: baseName(ctx.state, baseIndex) })),
                ctx.state,
            );
            if (options.length === 0) return { events: [] };
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'extramorphs_game_over_dude_base',
                    '游戏结束了伙计：选择一个基地',
                    options,
                    ctx.now,
                    'base',
                    'ui.extramorphs_game_over_dude_base_title',
                    { sourceCardUid: ctx.cardUid },
                    undefined,
                    { autoRefresh: 'base', responseValidationMode: 'live' },
                ),
            };
        }
        const matchState = queueGameOverDudePowerPrompt(ctx.matchState, ctx.playerId, ctx.cardUid, ctx.targetBaseIndex, ctx.now);
        return matchState ? { events: [], matchState } : { events: [] };
    });
    registerSimpleAbility('extramorphs_head_grabber', 'talent', {
        validateUse: ctx => {
            const located = findAttachedOngoingHost(ctx.state, ctx.baseIndex, ctx.cardUid, ctx.defId);
            if (!located) return '抱头虫必须附着在佣兵上才能使用天赋';
            if (
                getBoardTalentUseRequirement(ctx.defId) === 'attachedToOwnMinionOrSourceInPlayAtStartOfTurn'
                && located.host.controller !== ctx.playerId
                && wasActivationSourcePlayedThisTurn(located.action)
            ) {
                return '抱头虫必须在本回合开始时已经附着在该佣兵上，或附着在你的佣兵上，才能使用';
            }
            return null;
        },
        execute: ctx => {
            const located = findAttachedOngoingHost(ctx.state, ctx.baseIndex, ctx.cardUid, ctx.defId);
            if (!located) return { events: [] };
            const { host, baseIndex } = located;
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
                    ...playTopMinionOfPower(ctx.state, ctx.playerId, 4, baseIndex, ctx.defId, ctx.now, undefined, ctx.matchState),
                ],
            };
        },
    });
    registerSimpleAbility('extramorphs_nuke_it_from_orbit', 'talent', {
        validateUse: ctx => {
            const action = findBaseOngoing(ctx.state, ctx.baseIndex, ctx.cardUid, ctx.defId);
            if (!action) return '从轨道核平必须位于基地上才能使用天赋';
            if (
                getBoardTalentUseRequirement(ctx.defId) === 'sourceInPlayAtStartOfTurn'
                && wasActivationSourcePlayedThisTurn(action)
            ) {
                return '从轨道核平必须在本回合开始时已经位于基地上才能使用';
            }
            return null;
        },
        execute: ctx => {
            const base = ctx.state.bases[ctx.baseIndex];
            if (!base) return { events: [] };
            const sourceAction = findBaseOngoing(ctx.state, ctx.baseIndex, ctx.cardUid, ctx.defId);
            if (!sourceAction) return { events: [] };
            const events: SmashUpEvent[] = [
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
                ...base.ongoingActions
                    .filter(action => action.uid !== ctx.cardUid)
                    .map(action => detachOngoing(action.uid, action.defId, action.ownerId, ctx.defId, ctx.now, sourceFor(ctx))),
                {
                    type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
                    payload: {
                        playerId: sourceAction.ownerId,
                        cardUid: sourceAction.uid,
                        defId: sourceAction.defId,
                        reason: ctx.defId,
                    },
                    timestamp: ctx.now,
                } as CardRemovedFromGameEvent,
            ];
            const newBaseDefId = ctx.state.baseDeck[0];
            if (newBaseDefId) {
                events.push({
                    type: SU_EVENTS.BASE_REPLACED,
                    payload: {
                        baseIndex: ctx.baseIndex,
                        oldBaseDefId: base.defId,
                        newBaseDefId,
                    },
                    timestamp: ctx.now,
                } as BaseReplacedEvent);
            }
            return { events };
        },
    });
    registerSimpleAbility('extramorphs_time_to_go', 'onPlay', ctx => {
        const options = buildDiscardCardOptions(ctx.state, ctx.playerId);
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                ctx.defId,
                '该走了：选择至多三张弃牌洗回牌库',
                options,
                ctx.now,
                'generic',
                'ui.extramorphs_time_to_go_title',
                undefined,
                undefined,
                { autoRefresh: 'discard', genericIntent: 'card-pool', multi: { min: 0, max: Math.min(3, options.length) }, responseValidationMode: 'live' },
            ),
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

function countBrunchBunchNames(core: SmashUpCore, playerId: PlayerId, baseIndex: number): number {
    return new Set((core.bases[baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === playerId && isPrintedPower(minion.defId, 3))
        .map(minion => minion.defId)).size;
}

function buildBrunchBunchEffectOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    targetBaseIndex: number,
): PromptOption<TeensBrunchBunchChoice>[] {
    const options: PromptOption<TeensBrunchBunchChoice>[] = [];
    const targetBaseLabel = baseName(core, targetBaseIndex);
    for (const [baseIndex, base] of core.bases.entries()) {
        if (baseIndex === targetBaseIndex) continue;
        for (const minion of base.minions.filter(candidate => candidate.controller === playerId)) {
            options.push({
                id: `move-${minion.uid}-to-${targetBaseIndex}`,
                label: `移动 ${cardName(minion.defId)} 到 ${targetBaseLabel}`,
                value: {
                    effect: 'move',
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    defId: minion.defId,
                    baseIndex,
                    targetBaseIndex,
                    targetBaseDefId: core.bases[targetBaseIndex]?.defId,
                },
                displayMode: 'card',
            });
        }
    }
    if ((core.players[playerId]?.deck.length ?? 0) > 0) {
        options.push({
            id: 'draw-card',
            label: '抓 1 张牌',
            labelKey: 'ui.teens_brunch_bunch_draw_option',
            value: { effect: 'draw' },
            displayMode: 'button',
        });
    }
    if ((core.players[playerId]?.hand ?? []).some(card => getMinionDef(card.defId)?.power === 3)) {
        options.push({
            id: `extra-minion-${targetBaseIndex}`,
            label: `在 ${targetBaseLabel} 打出 1 个力量 3 的额外佣兵`,
            value: { effect: 'extra-minion', targetBaseIndex, targetBaseDefId: core.bases[targetBaseIndex]?.defId },
            displayMode: 'button',
        });
    }
    for (const option of buildMinionChoiceOptions(
        core,
        playerId,
        'teens_brunch_bunch',
        (_minion, baseIndex) => baseIndex === targetBaseIndex,
        'affect',
    )) {
        options.push({
            ...option,
            id: `power-${option.id}`,
            label: `令 ${option.label} +2 战力`,
            value: { ...(option.value ?? {}), effect: 'power' },
        });
    }
    for (const option of buildDiscardCardOptions(core, playerId)) {
        options.push({
            ...option,
            id: `discard-bottom-${option.id}`,
            label: `将 ${option.label} 置于牌库底`,
            value: { ...(option.value ?? {}), effect: 'discard' },
        });
    }
    return options;
}

function queueBrunchBunchEffectPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceCardUid: string | undefined,
    targetBaseIndex: number,
    now: number,
): MatchState<SmashUpCore> | undefined {
    const names = countBrunchBunchNames(matchState.core, playerId, targetBaseIndex);
    if (names <= 0) return undefined;
    const effectOptions = buildBrunchBunchEffectOptions(matchState.core, playerId, targetBaseIndex);
    const effectCount = new Set(effectOptions.map(option => option.value?.effect).filter(Boolean)).size;
    const max = Math.min(names, effectCount);
    if (max <= 0) return undefined;
    return queuePrompt(
        matchState,
        playerId,
        'teens_brunch_bunch_effects',
        '早午餐帮：选择不同效果',
        [createSkipOption('跳过（不选择更多效果）', 'ui.teens_brunch_bunch_skip_option'), ...effectOptions],
        now,
        'generic',
        'ui.teens_brunch_bunch_effects_title',
        { sourceCardUid, sourceBaseIndex: targetBaseIndex },
        undefined,
        { genericIntent: 'composite-context', multi: { min: 0, max }, responseValidationMode: 'live' },
    );
}

function teensPower3Trigger(sourceDefId: string, ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
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
            if (ctx.matchState) {
                const options = buildOwnMinionTargetOptions(ctx.state, ctx.sourceControllerId, sourceDefId, 'affect');
                if (options.length === 0) return [];
                return {
                    events: [],
                    matchState: queuePrompt(
                        ctx.matchState,
                        ctx.sourceControllerId,
                        'teens_prep_power3_trigger',
                        '优等生：选择一个己方佣兵本回合 +2 战力',
                        [createSkipOption('跳过（不加战力）', 'ui.teens_prep_power3_skip_option'), ...options],
                        ctx.now,
                        'minion',
                        'ui.teens_prep_power3_trigger_title',
                        {
                            sourceCardUid: ctx.sourceCardUid,
                            sourceBaseIndex: ctx.sourceBaseIndex,
                        },
                    ),
                };
            }
            const target = firstOwnMinion(ctx.state, ctx.sourceControllerId);
            return target ? [addTempPower(target.minion.uid, target.baseIndex, 2, sourceDefId, ctx.now, sourceInfo)] : [];
        }
        case 'teens_rebel': {
            if (ctx.matchState) {
                const options = buildOwnMinionTargetOptions(ctx.state, ctx.sourceControllerId, sourceDefId, 'move')
                    .filter(option => {
                        const value = option.value as { baseIndex?: number };
                        return value.baseIndex !== undefined && firstOtherBaseIndex(ctx.state, value.baseIndex) !== undefined;
                    });
                if (options.length === 0) return [];
                return {
                    events: [],
                    matchState: queuePrompt(
                        ctx.matchState,
                        ctx.sourceControllerId,
                        'teens_rebel_power3_minion',
                        '叛逆者：选择要移动的己方佣兵',
                        [createSkipOption('跳过（不移动佣兵）', 'ui.teens_rebel_power3_skip_option'), ...options],
                        ctx.now,
                        'minion',
                        'ui.teens_rebel_power3_minion_title',
                        {
                            sourceCardUid: ctx.sourceCardUid,
                            sourceBaseIndex: ctx.sourceBaseIndex,
                        },
                    ),
                };
            }
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
            if (ctx.matchState) {
                const options = buildDiscardCardChoiceOptions(ctx.state, ctx.sourceControllerId);
                if (options.length === 0) return [];
                return {
                    events: [],
                    matchState: queuePrompt(
                        ctx.matchState,
                        ctx.sourceControllerId,
                        'teens_slacker_power3_trigger',
                        '懒散者：选择弃牌堆中要置于牌库底的牌',
                        [createSkipOption('跳过（不放回牌库底）', 'ui.teens_slacker_power3_skip_option'), ...options],
                        ctx.now,
                        'generic',
                        'ui.teens_slacker_power3_trigger_title',
                        {
                            sourceCardUid: ctx.sourceCardUid,
                            sourceBaseIndex: ctx.sourceBaseIndex,
                        },
                        undefined,
                        { autoRefresh: 'discard', genericIntent: 'card-pool', responseValidationMode: 'live' },
                    ),
                };
            }
            return [];
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

function registerTeensInteractionHandlers(): void {
    registerInteractionHandler('teens_prep_power3_trigger', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number; skip?: boolean };
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        const minionDefId = selected.minionDefId ?? selected.defId;
        if (selected.skip || !selected.minionUid || !minionDefId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate =>
            candidate.uid === selected.minionUid && candidate.controller === playerId
        );
        if (!minion) return { state, events: [] };
        return {
            state,
            events: [addTempPower(selected.minionUid, selected.baseIndex, 2, 'teens_prep', timestamp, {
                sourcePlayerId: playerId,
                sourceCardUid: continuation?.sourceCardUid,
                sourceDefId: 'teens_prep',
                sourceControllerId: playerId,
                sourceBaseIndex: continuation?.sourceBaseIndex,
            })],
        };
    });

    registerInteractionHandler('teens_rebel_power3_minion', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number; skip?: boolean };
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        const minionDefId = selected.minionDefId ?? selected.defId;
        if (selected.skip || !selected.minionUid || !minionDefId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate =>
            candidate.uid === selected.minionUid && candidate.controller === playerId
        );
        if (!minion) return { state, events: [] };
        const options = buildBaseTargetOptions(
            state.core.bases
                .map((base, baseIndex) => ({ baseIndex, label: baseName(state.core, baseIndex) }))
                .filter(candidate => candidate.baseIndex !== selected.baseIndex),
            state.core,
        );
        if (options.length === 0) return { state, events: [] };
        return {
            state: queuePrompt(
                state,
                playerId,
                'teens_rebel_power3_base',
                '叛逆者：选择移动目的基地',
                options,
                timestamp,
                'base',
                'ui.teens_rebel_power3_base_title',
                {
                    minionUid: selected.minionUid,
                    minionDefId,
                    fromBaseIndex: selected.baseIndex,
                    sourceCardUid: continuation?.sourceCardUid,
                    sourceBaseIndex: continuation?.sourceBaseIndex,
                },
                undefined,
                { autoRefresh: 'base', responseValidationMode: 'live' },
            ),
            events: [],
        };
    });

    registerInteractionHandler('teens_rebel_power3_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string };
        const continuation = data?.continuationContext as {
            minionUid?: string;
            minionDefId?: string;
            fromBaseIndex?: number;
            sourceCardUid?: string;
            sourceBaseIndex?: number;
        } | undefined;
        if (
            selected.baseIndex === undefined
            || !continuation?.minionUid
            || !continuation.minionDefId
            || continuation.fromBaseIndex === undefined
            || selected.baseIndex === continuation.fromBaseIndex
        ) {
            return { state, events: [] };
        }
        const minion = state.core.bases[continuation.fromBaseIndex]?.minions.find(candidate =>
            candidate.uid === continuation.minionUid && candidate.controller === playerId
        );
        if (!minion) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: continuation.minionUid,
                minionDefId: continuation.minionDefId,
                fromBaseIndex: continuation.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                toBaseDefId: selected.baseDefId,
                reason: 'teens_rebel',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: continuation.sourceCardUid,
                sourceDefId: 'teens_rebel',
                sourceControllerId: playerId,
                sourceBaseIndex: continuation.sourceBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('teens_slacker_power3_trigger', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { cardUid?: string; skip?: boolean };
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (selected.skip || !selected.cardUid) return { state, events: [] };
        const card = state.core.players[playerId]?.discard.find(candidate => candidate.uid === selected.cardUid);
        if (!card) return { state, events: [] };
        return {
            state,
            events: [buildCardToDeckBottomEvent(card, playerId, 'teens_slacker', timestamp, {
                sourcePlayerId: playerId,
                sourceCardUid: continuation?.sourceCardUid,
                sourceDefId: 'teens_slacker',
                sourceControllerId: playerId,
                sourceBaseIndex: continuation?.sourceBaseIndex,
            })],
        };
    });

    registerInteractionHandler('teens_slacker_on_play', (state, playerId, value, data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : value ? [value] : []) as ExcellentMoviesMinionChoice[];
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        const seen = new Set<string>();
        const events: SmashUpEvent[] = [];
        for (const choice of choices) {
            if (choice.skip || !choice.minionUid || seen.has(choice.minionUid)) continue;
            seen.add(choice.minionUid);
            events.push(...buildMoveSelectedMinionEvents(
                state.core,
                playerId,
                choice,
                choice.targetBaseIndex,
                'teens_slacker',
                timestamp,
                continuation?.sourceCardUid,
                continuation?.sourceBaseIndex,
                'nonAction',
            ));
            if (seen.size >= 2) break;
        }
        return { state, events };
    });

    registerInteractionHandler('teens_brunch_bunch_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; skip?: boolean };
        const continuation = data?.continuationContext as { sourceCardUid?: string } | undefined;
        if (selected.skip || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state: queueBrunchBunchEffectPrompt(
                state,
                playerId,
                continuation?.sourceCardUid,
                selected.baseIndex,
                timestamp,
            ) ?? state,
            events: [],
        };
    });

    registerInteractionHandler('teens_brunch_bunch_effects', (state, playerId, value, data, random, timestamp) => {
        const choices = (Array.isArray(value) ? value : value ? [value] : []) as TeensBrunchBunchChoice[];
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (continuation?.sourceBaseIndex === undefined) return { state, events: [] };
        const usedEffects = new Set<NonNullable<TeensBrunchBunchChoice['effect']>>();
        const source = {
            sourcePlayerId: playerId,
            sourceCardUid: continuation.sourceCardUid,
            sourceDefId: 'teens_brunch_bunch',
            sourceControllerId: playerId,
            sourceBaseIndex: continuation.sourceBaseIndex,
        };
        const events: SmashUpEvent[] = [];
        for (const choice of choices) {
            if (choice.skip || !choice.effect || usedEffects.has(choice.effect)) continue;
            usedEffects.add(choice.effect);
            if (choice.effect === 'move') {
                events.push(...buildMoveSelectedMinionEvents(
                    state.core,
                    playerId,
                    choice,
                    continuation.sourceBaseIndex,
                    'teens_brunch_bunch',
                    timestamp,
                    continuation.sourceCardUid,
                    continuation.sourceBaseIndex,
                    'action',
                ));
            } else if (choice.effect === 'draw') {
                events.push(...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp));
            } else if (choice.effect === 'extra-minion') {
                events.push(grantContextualExtraMinion(
                    { playerId, now: timestamp, matchState: state },
                    'teens_brunch_bunch',
                    continuation.sourceBaseIndex,
                    { powerMax: 3 },
                ));
            } else if (choice.effect === 'power') {
                const minionDefId = choice.minionDefId ?? choice.defId;
                const live = choice.baseIndex === undefined || !choice.minionUid
                    ? undefined
                    : state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid && minion.defId === minionDefId);
                if (live && choice.baseIndex === continuation.sourceBaseIndex) {
                    events.push(addTempPower(choice.minionUid!, choice.baseIndex, 2, 'teens_brunch_bunch', timestamp, source));
                }
            } else if (choice.effect === 'discard' && choice.cardUid) {
                const card = state.core.players[playerId]?.discard.find(candidate => candidate.uid === choice.cardUid);
                if (card) events.push(buildCardToDeckBottomEvent(card, playerId, 'teens_brunch_bunch', timestamp, source));
            }
        }
        return { state, events };
    });

    registerInteractionHandler('teens_new_kid_deck', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        if (selected.skip || !selected.cardUid) return { state, events: [] };
        const card = state.core.players[playerId]?.deck.find(candidate =>
            candidate.uid === selected.cardUid && getMinionDef(candidate.defId)?.power === 3);
        return card
            ? {
                state,
                events: [
                    ...reorderDeckWithCardOnTop(state.core, playerId, card.uid, 'teens_new_kid', timestamp),
                    grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'teens_new_kid', undefined, { powerMax: 3, specificCardUid: card.uid }),
                ],
            }
            : { state, events: [] };
    });

    registerInteractionHandler('teens_prep_deck', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        if (selected.skip || !selected.cardUid) return { state, events: [] };
        const card = state.core.players[playerId]?.deck.find(candidate =>
            candidate.uid === selected.cardUid && (!selected.defId || candidate.defId === selected.defId) && isPrintedPower(candidate.defId, 3));
        return card
            ? {
                state,
                events: drawSpecificDeckCard(playerId, card, state.core.players[playerId]?.deck ?? [], 'teens_prep', timestamp),
            }
            : { state, events: [] };
    });

    registerInteractionHandler('teens_principals_office_return', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as ExcellentMoviesMinionChoice;
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (selected.skip) return { state, events: [] };
        const minionDefId = selected.minionDefId ?? selected.defId;
        const returnEvents = selected.minionUid && minionDefId && selected.baseIndex !== undefined
            ? buildValidatedReturnEvents(state, {
                minionUid: selected.minionUid,
                minionDefId,
                fromBaseIndex: selected.baseIndex,
                reason: 'teens_principals_office',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: continuation?.sourceCardUid,
                sourceDefId: 'teens_principals_office',
                sourceControllerId: playerId,
                sourceBaseIndex: continuation?.sourceBaseIndex,
                sourceKind: 'action',
            })
            : [];
        const extraBaseIndex = selected.baseIndex ?? continuation?.sourceBaseIndex ?? 0;
        const extraCard = state.core.players[playerId]?.deck.find(candidate => getMinionDef(candidate.defId)?.power === 3);
        return {
            state,
            events: [
                ...returnEvents,
                ...(extraCard
                    ? [
                        ...reorderDeckWithCardOnTop(state.core, playerId, extraCard.uid, 'teens_principals_office', timestamp),
                        grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'teens_principals_office', extraBaseIndex, {
                            powerMax: 3,
                            specificCardUid: extraCard.uid,
                        }),
                    ]
                    : []),
            ],
        };
    });

    registerInteractionHandler('teens_strange_science_discard', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        if (selected.skip || !selected.cardUid) return { state, events: [] };
        const card = state.core.players[playerId]?.discard.find(candidate =>
            candidate.uid === selected.cardUid && getMinionDef(candidate.defId)?.power === 3);
        return card
            ? {
                state,
                events: [
                    recoverCardsFromDiscard(playerId, [card.uid], 'teens_strange_science', timestamp),
                    grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'teens_strange_science', undefined, { powerMax: 3, specificCardUid: card.uid }),
                ],
            }
            : { state, events: [] };
    });

    registerInteractionHandler('teens_explosion_at_school_discard', (state, playerId, value, _data, random, timestamp) => {
        const choices = (Array.isArray(value) ? value : value ? [value] : []) as ExcellentMoviesCardChoice[];
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };
        const seenDefIds = new Set<string>();
        const selectedCards = choices
            .map(choice => {
                if (!choice.cardUid) return undefined;
                const card = player.discard.find(candidate => candidate.uid === choice.cardUid && isPrintedPower(candidate.defId, 3));
                if (!card || seenDefIds.has(card.defId)) return undefined;
                seenDefIds.add(card.defId);
                return card;
            })
            .filter((card): card is CardInstance => Boolean(card));
        return {
            state,
            events: [
                ...selectedCards.map(card => buildCardToDeckBottomEvent(card, playerId, 'teens_explosion_at_school', timestamp, {
                    sourcePlayerId: playerId,
                    sourceDefId: 'teens_explosion_at_school',
                    sourceControllerId: playerId,
                })),
                ...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
            ],
        };
    });
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
        const options = buildDeckCardOptions(ctx.state, ctx.playerId, card => isPrintedPower(card.defId, 3));
        if (options.length === 0) return { events: [] };
        if (ctx.matchState) {
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'teens_prep_deck',
                    '优等生：选择牌库中的 3 力随从加入手牌',
                    options,
                    ctx.now,
                    'generic',
                    'ui.teens_prep_deck_title',
                    undefined,
                    undefined,
                    { autoRefresh: 'deck', genericIntent: 'card-pool', responseValidationMode: 'live' },
                ),
            };
        }
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
        const options = buildMinionToOtherBaseChoiceOptions(
            ctx.state,
            (minion, baseIndex) => minion.controller === ctx.playerId && firstOtherBaseIndex(ctx.state, baseIndex) !== undefined,
        );
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'teens_slacker_on_play',
                '懒散者：选择至多两个己方佣兵移动到其它基地',
                options,
                ctx.now,
                'generic',
                'ui.teens_slacker_on_play_title',
                { sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex },
                undefined,
                { autoRefresh: 'field', genericIntent: 'composite-context', multi: { min: 0, max: Math.min(2, options.length) }, responseValidationMode: 'live' },
            ),
        };
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
        if (ctx.targetBaseIndex === undefined) {
            const options = buildBaseTargetOptions(
                ctx.state.bases.map((_base, baseIndex) => ({ baseIndex, label: baseName(ctx.state, baseIndex) })),
                ctx.state,
            );
            if (options.length === 0) return { events: [] };
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'teens_brunch_bunch_base',
                    '早午餐帮：选择一个基地',
                    options,
                    ctx.now,
                    'base',
                    'ui.teens_brunch_bunch_base_title',
                    { sourceCardUid: ctx.cardUid },
                    undefined,
                    { autoRefresh: 'base', responseValidationMode: 'live' },
                ),
            };
        }
        const matchState = queueBrunchBunchEffectPrompt(
            ctx.matchState,
            ctx.playerId,
            ctx.cardUid,
            ctx.targetBaseIndex,
            ctx.now,
        );
        return matchState ? { events: [], matchState } : { events: [] };
    });
    registerSimpleAbility('teens_explosion_at_school', 'onPlay', ctx => {
        const options: PromptOption<ExcellentMoviesCardChoice>[] = [];
        const seen = new Set<string>();
        for (const card of ctx.state.players[ctx.playerId]?.discard ?? []) {
            if (!isPrintedPower(card.defId, 3) || seen.has(card.defId)) continue;
            seen.add(card.defId);
            options.push({
                id: `discard-${card.uid}`,
                label: cardName(card.defId),
                value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner, zone: 'discard' },
                displayMode: 'card' as const,
            });
        }
        if (options.length === 0) {
            return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
        }
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'teens_explosion_at_school_discard',
                '学校爆炸：选择任意数量不同名称的 3 力随从洗回牌库',
                options,
                ctx.now,
                'generic',
                undefined,
                undefined,
                undefined,
                { autoRefresh: 'discard', genericIntent: 'card-pool', multi: { min: 0, max: options.length }, responseValidationMode: 'live' },
            ),
        };
    });
    registerSimpleAbility('teens_new_kid', 'onPlay', ctx => {
        const options = buildDeckCardOptions(ctx.state, ctx.playerId, card => getMinionDef(card.defId)?.power === 3);
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'teens_new_kid_deck',
                '新来的孩子：选择牌库中的 3 力随从',
                options,
                ctx.now,
                'generic',
                'ui.teens_new_kid_deck_title',
                undefined,
                undefined,
                { autoRefresh: 'deck', genericIntent: 'card-pool', responseValidationMode: 'live' },
            ),
        };
    });
    registerSimpleAbility('teens_principals_office', 'onPlay', ctx => {
        const target = ctx.targetMinionUid ? findMinionLocation(ctx.state, ctx.targetMinionUid) : undefined;
        if (!target) {
            const options = buildMinionChoiceOptions(
                ctx.state,
                ctx.playerId,
                ctx.defId,
                minion => minion.controller === ctx.playerId,
                'return',
                'action',
            );
            if (options.length === 0) return { events: [] };
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'teens_principals_office_return',
                    '校长办公室：选择要返回手牌的己方佣兵',
                    options,
                    ctx.now,
                    'minion',
                    'ui.teens_principals_office_return_title',
                    { sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex },
                    undefined,
                    { autoRefresh: 'field', responseValidationMode: 'live' },
                ),
            };
        }
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
        const options = buildDiscardCardOptions(ctx.state, ctx.playerId, card => getMinionDef(card.defId)?.power === 3);
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'teens_strange_science_discard',
                '怪科学：选择弃牌堆中的 3 力随从',
                options,
                ctx.now,
                'generic',
                'ui.teens_strange_science_discard_title',
                undefined,
                undefined,
                { autoRefresh: 'discard', genericIntent: 'card-pool', responseValidationMode: 'live' },
            ),
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
    registerTeensInteractionHandlers();
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

type WraithActionLocation = {
    action: WraithOngoingAction;
    baseIndex: number;
    hostUid?: string;
};

type WraithEffectSourceInfo = {
    sourcePlayerId?: PlayerId;
    sourceCardUid?: string;
    sourceDefId?: string;
    sourceControllerId?: PlayerId;
    sourceBaseIndex?: number;
};

type WraithStoredCardChoice = {
    cardUid?: string;
    defId?: string;
    zone?: 'hand' | 'discard';
    skip?: boolean;
};

type WraithActionChoice = {
    cardUid?: string;
    ongoingUid?: string;
    sourceUid?: string;
    sourceBaseIndex?: number;
    fromBaseIndex?: number;
    baseIndex?: number;
    targetBaseIndex?: number;
    baseDefId?: string;
    mode?: 'destroy' | 'transfer' | 'reveal';
    skip?: boolean;
};

function actionController(action: WraithOngoingAction): PlayerId {
    return getActionControllerId(action);
}

function collectActionsOnBase(
    core: SmashUpCore,
    baseIndex: number,
    predicate: (location: WraithActionLocation) => boolean = () => true,
): WraithActionLocation[] {
    const base = core.bases[baseIndex];
    if (!base) return [];
    const locations: WraithActionLocation[] = [];
    for (const action of base.ongoingActions) {
        locations.push({ action, baseIndex });
    }
    for (const minion of base.minions) {
        for (const action of minion.attachedActions) {
            locations.push({ action, baseIndex, hostUid: minion.uid });
        }
    }
    return locations.filter(predicate);
}

function collectOwnActionsOnBase(core: SmashUpCore, playerId: PlayerId, baseIndex: number): WraithActionLocation[] {
    return collectActionsOnBase(core, baseIndex, location => actionController(location.action) === playerId);
}

function collectOwnActionsOutsideBase(core: SmashUpCore, playerId: PlayerId, excludedBaseIndex: number): WraithActionLocation[] {
    return core.bases.flatMap((_base, baseIndex) =>
        baseIndex === excludedBaseIndex ? [] : collectOwnActionsOnBase(core, playerId, baseIndex));
}

function firstOwnActionOnBase(core: SmashUpCore, playerId: PlayerId, baseIndex: number): WraithActionLocation | undefined {
    return collectOwnActionsOnBase(core, playerId, baseIndex)[0];
}

function findActionLocationByUid(core: SmashUpCore, cardUid: string, baseIndex?: number): WraithActionLocation | undefined {
    const indexes = baseIndex === undefined
        ? core.bases.map((_base, index) => index)
        : [baseIndex];
    for (const index of indexes) {
        const found = collectActionsOnBase(core, index, location => location.action.uid === cardUid)[0];
        if (found) return found;
    }
    return undefined;
}

function selectedActionUid(selected: WraithActionChoice): string | undefined {
    return selected.cardUid ?? selected.ongoingUid ?? selected.sourceUid;
}

function selectedSourceBaseIndex(selected: WraithActionChoice): number | undefined {
    return selected.sourceBaseIndex ?? selected.fromBaseIndex;
}

function wraithActionSource(location: WraithActionLocation) {
    return {
        type: 'ongoing' as const,
        uid: location.action.uid,
        defId: location.action.defId,
        fromBaseIndex: location.baseIndex,
    };
}

function buildWraithActionSourceActionOptions(
    locations: WraithActionLocation[],
): PromptOption<WraithActionChoice>[] {
    return locations.flatMap(location => buildFieldSourceActionOptions({
        ...wraithActionSource(location),
        label: cardName(location.action.defId),
    })) as PromptOption<WraithActionChoice>[];
}

function buildWraithActionTransferOptions(
    core: SmashUpCore,
    locations: WraithActionLocation[],
    targetBases: { baseIndex: number; label: string }[],
): PromptOption<WraithActionChoice>[] {
    return locations.flatMap(location => buildFieldSourceToBaseTargetOptions(
        wraithActionSource(location),
        targetBases,
        core,
    )) as PromptOption<WraithActionChoice>[];
}

function queueWraithFieldSourceActionPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceId: string,
    title: string,
    options: PromptOption<WraithActionChoice>[],
    now: number,
    continuationContext?: Record<string, unknown>,
): MatchState<SmashUpCore> {
    return queuePrompt(
        matchState,
        playerId,
        sourceId,
        title,
        options,
        now,
        'field-source-action',
        undefined,
        continuationContext,
        undefined,
        { responseValidationMode: 'live' },
    );
}

function queueWraithFieldSourceTargetPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceId: string,
    title: string,
    options: PromptOption<WraithActionChoice>[],
    now: number,
    continuationContext?: Record<string, unknown>,
): MatchState<SmashUpCore> {
    return queuePrompt(
        matchState,
        playerId,
        sourceId,
        title,
        options,
        now,
        'field-source-target',
        undefined,
        continuationContext,
        undefined,
        { responseValidationMode: 'live' },
    );
}

function wraithSourceInfo(
    playerId: PlayerId,
    sourceDefId: string,
    sourceCardUid?: string,
    sourceBaseIndex?: number,
): WraithEffectSourceInfo {
    return {
        sourcePlayerId: playerId,
        sourceCardUid,
        sourceDefId,
        sourceControllerId: playerId,
        sourceBaseIndex,
    };
}

function sourceInfoFromContinuation(
    playerId: PlayerId,
    continuation: Record<string, unknown> | undefined,
    fallbackDefId: string,
): WraithEffectSourceInfo {
    return wraithSourceInfo(
        playerId,
        typeof continuation?.sourceDefId === 'string' ? continuation.sourceDefId : fallbackDefId,
        typeof continuation?.sourceCardUid === 'string' ? continuation.sourceCardUid : undefined,
        typeof continuation?.sourceBaseIndex === 'number' ? continuation.sourceBaseIndex : undefined,
    );
}

function buildDestroyActionLocationEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    location: WraithActionLocation,
    reason: string,
    now: number,
    sourceInfo: WraithEffectSourceInfo,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [
        detachOngoing(location.action.uid, location.action.defId, location.action.ownerId, reason, now, sourceInfo),
    ];
    if (isWraith(location.action.defId)) {
        const marker = markWraithActionDestroyedOnBase(core, location.baseIndex, playerId, reason, now);
        if (marker) events.push(marker);
    }
    return events;
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

function buildWatsonRevealWraithEvents(core: SmashUpCore, playerId: PlayerId, reason: string, now: number): SmashUpEvent[] {
    const player = core.players[playerId];
    const wraith = player?.deck.find(card => isWraith(card.defId));
    if (!player || !wraith) return [];
    return [
        inspectDeck(playerId, playerId, player.deck.length, reason, now),
        buildDeckReorderedEvent(playerId, [
            wraith.uid,
            ...player.deck.filter(card => card.uid !== wraith.uid).map(card => card.uid),
        ], reason, now),
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [wraith.uid] },
            timestamp: now,
        } as SmashUpEvent,
    ];
}

function findAttachedActionHost(core: SmashUpCore, actionUid: string, baseIndex: number): MinionOnBase | undefined {
    return core.bases[baseIndex]?.minions.find(minion => minion.attachedActions.some(action => action.uid === actionUid));
}

function buildTransferOngoingActionEventsWithSource(
    action: WraithOngoingAction,
    fromBaseIndex: number,
    toBaseIndex: number,
    reason: string,
    now: number,
    sourceInfo: WraithEffectSourceInfo,
): SmashUpEvent[] {
    if (fromBaseIndex === toBaseIndex) return [];
    return [
        detachOngoing(action.uid, action.defId, action.ownerId, reason, now, sourceInfo),
        buildOngoingAttachedEvent({
            uid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            metadata: action.metadata,
            talentUsed: action.talentUsed,
            removeFromDiscard: true,
        }, toBaseIndex, 'base', now, undefined, sourceInfo.sourcePlayerId),
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

function buildWraithStoredCardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    predicate: (card: CardInstance) => boolean,
): PromptOption<WraithStoredCardChoice>[] {
    const player = core.players[playerId];
    if (!player) return [];
    const candidates = [
        ...player.hand.map(card => ({ card, zone: 'hand' as const })),
        ...player.discard.map(card => ({ card, zone: 'discard' as const })),
    ].filter(({ card }) => predicate(card));
    return candidates.map(({ card, zone }) => ({
        id: `${zone}-${card.uid}`,
        label: cardName(card.defId),
        value: { cardUid: card.uid, defId: card.defId, zone },
        displayMode: 'card',
    }));
}

function resolveWraithTransferChoice(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selected: WraithActionChoice,
    continuation: Record<string, unknown> | undefined,
    fallbackSourceId: string,
    requireOwnAction: boolean,
    timestamp: number,
): SmashUpEvent[] {
    if (selected.skip) return [];
    const actionUid = selectedActionUid(selected);
    const fromBaseIndex = selectedSourceBaseIndex(selected);
    const toBaseIndex = selected.targetBaseIndex ?? selected.baseIndex;
    if (!actionUid || fromBaseIndex === undefined || toBaseIndex === undefined || !state.core.bases[toBaseIndex]) return [];
    const location = findActionLocationByUid(state.core, actionUid, fromBaseIndex);
    if (!location) return [];
    if (requireOwnAction && actionController(location.action) !== playerId) return [];
    const sourceInfo = sourceInfoFromContinuation(playerId, continuation, fallbackSourceId);
    return buildTransferOngoingActionEventsWithSource(
        location.action,
        location.baseIndex,
        toBaseIndex,
        sourceInfo.sourceDefId ?? fallbackSourceId,
        timestamp,
        sourceInfo,
    );
}

function resolveWraithDestroyChoice(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selected: WraithActionChoice,
    continuation: Record<string, unknown> | undefined,
    fallbackSourceId: string,
    requireOwnAction: boolean,
    timestamp: number,
): SmashUpEvent[] {
    if (selected.skip) return [];
    const actionUid = selectedActionUid(selected);
    const baseIndex = selectedSourceBaseIndex(selected);
    if (!actionUid || baseIndex === undefined) return [];
    const location = findActionLocationByUid(state.core, actionUid, baseIndex);
    if (!location) return [];
    if (requireOwnAction && actionController(location.action) !== playerId) return [];
    const sourceInfo = sourceInfoFromContinuation(playerId, continuation, fallbackSourceId);
    return buildDestroyActionLocationEvents(
        state.core,
        playerId,
        location,
        sourceInfo.sourceDefId ?? fallbackSourceId,
        timestamp,
        sourceInfo,
    );
}

function registerWraithrustlersInteractionHandlers(): void {
    registerInteractionHandler('wraithrustlers_roy', (state, playerId, value, data, _random, timestamp) => {
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const events = resolveWraithTransferChoice(
            state,
            playerId,
            value as WraithActionChoice,
            continuation,
            'wraithrustlers_roy',
            true,
            timestamp,
        );
        return { state, events };
    });

    registerInteractionHandler('wraithrustlers_funkman', (state, playerId, value, data, _random, timestamp) => {
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const events = resolveWraithTransferChoice(
            state,
            playerId,
            value as WraithActionChoice,
            continuation,
            'wraithrustlers_funkman',
            false,
            timestamp,
        );
        return { state, events };
    });

    registerInteractionHandler('wraithrustlers_ellen_destroy_action', (state, playerId, value, data, _random, timestamp) => {
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const events = resolveWraithDestroyChoice(
            state,
            playerId,
            value as WraithActionChoice,
            continuation,
            'wraithrustlers_ellen',
            true,
            timestamp,
        );
        if (events.length === 0) return { state, events };
        const sourceBaseIndex = typeof continuation?.sourceBaseIndex === 'number'
            ? continuation.sourceBaseIndex
            : selectedSourceBaseIndex(value as WraithActionChoice);
        return {
            state,
            events: sourceBaseIndex === undefined
                ? events
                : [...events, modifyBreakpoint(sourceBaseIndex, -3, 'wraithrustlers_ellen', timestamp)],
        };
    });

    registerInteractionHandler('wraithrustlers_unlicensed_nuclear_accelerator_destroy_action', (state, playerId, value, data, _random, timestamp) => {
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const events = resolveWraithDestroyChoice(
            state,
            playerId,
            value as WraithActionChoice,
            continuation,
            'wraithrustlers_unlicensed_nuclear_accelerator',
            true,
            timestamp,
        );
        if (events.length === 0) return { state, events };
        const sourceCardUid = typeof continuation?.sourceCardUid === 'string' ? continuation.sourceCardUid : undefined;
        const sourceBaseIndex = typeof continuation?.sourceBaseIndex === 'number' ? continuation.sourceBaseIndex : undefined;
        const host = sourceCardUid !== undefined && sourceBaseIndex !== undefined
            ? findAttachedActionHost(state.core, sourceCardUid, sourceBaseIndex)
            : undefined;
        return {
            state,
            events: host
                ? [...events, addPowerCounter(host.uid, sourceBaseIndex!, 1, 'wraithrustlers_unlicensed_nuclear_accelerator', timestamp, wraithSourceInfo(playerId, 'wraithrustlers_unlicensed_nuclear_accelerator', sourceCardUid, sourceBaseIndex))]
                : events,
        };
    });

    registerInteractionHandler('wraithrustlers_demon_dogs_store_minion', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as WraithStoredCardChoice;
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        if (selected.skip || !selected.cardUid || !selected.zone) return { state, events: [] };
        const card = state.core.players[playerId]?.[selected.zone]?.find(candidate => candidate.uid === selected.cardUid);
        if (!card || getMinionDef(card.defId)?.power === undefined || (getMinionDef(card.defId)?.power ?? 99) > 3) {
            return { state, events: [] };
        }
        return {
            state,
            events: [buildStoredCardEvent(playerId, card, selected.zone, 'wraithrustlers_demon_dogs', timestamp, {
                storedUnderUid: typeof continuation?.sourceCardUid === 'string' ? continuation.sourceCardUid : undefined,
                storedUnderDefId: 'wraithrustlers_demon_dogs',
            })],
        };
    });

    registerInteractionHandler('wraithrustlers_ancient_sumerian_god_store_action', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as WraithStoredCardChoice;
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        if (selected.skip || !selected.cardUid) return { state, events: [] };
        const card = state.core.players[playerId]?.discard.find(candidate => candidate.uid === selected.cardUid);
        if (!card || !isActionPlayableOnBase(card)) return { state, events: [] };
        return {
            state,
            events: [buildStoredCardEvent(playerId, card, 'discard', 'wraithrustlers_ancient_sumerian_god', timestamp, {
                storedUnderUid: typeof continuation?.sourceCardUid === 'string' ? continuation.sourceCardUid : undefined,
                storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
            })],
        };
    });

    registerInteractionHandler('wraithrustlers_resurgence_choose_action', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as WraithActionChoice;
        const actionUid = selectedActionUid(selected);
        const sourceBaseIndex = selectedSourceBaseIndex(selected);
        if (!actionUid || sourceBaseIndex === undefined) return { state, events: [] };
        const location = findActionLocationByUid(state.core, actionUid, sourceBaseIndex);
        if (!location) return { state, events: [] };
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const otherBases = state.core.bases
            .map((_base, baseIndex) => ({ baseIndex, label: baseName(state.core, baseIndex) }))
            .filter(candidate => candidate.baseIndex !== location.baseIndex);
        const options: PromptOption<WraithActionChoice>[] = [
            { id: 'destroy', label: '摧毁此行动', labelKey: 'ui.wraithrustlers_resurgence_destroy_option', value: { mode: 'destroy', cardUid: actionUid, sourceBaseIndex: location.baseIndex }, displayMode: 'button' },
            ...(otherBases.length > 0 ? [{ id: 'transfer', label: '转移到另一个基地', labelKey: 'ui.wraithrustlers_resurgence_transfer_option', value: { mode: 'transfer', cardUid: actionUid, sourceBaseIndex: location.baseIndex }, displayMode: 'button' as const }] : []),
        ];
        return {
            state: queuePrompt(
                state,
                playerId,
                'wraithrustlers_resurgence_choose_mode',
                '复苏：选择摧毁或转移此行动',
                options,
                timestamp,
                'button',
                undefined,
                {
                    ...(continuation ?? {}),
                    selectedActionUid: actionUid,
                    selectedActionBaseIndex: location.baseIndex,
                },
                undefined,
                { responseValidationMode: 'live' },
            ),
            events: [],
        };
    });

    registerInteractionHandler('wraithrustlers_resurgence_choose_mode', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as WraithActionChoice;
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const actionUid = typeof continuation?.selectedActionUid === 'string' ? continuation.selectedActionUid : selected.cardUid;
        const sourceBaseIndex = typeof continuation?.selectedActionBaseIndex === 'number' ? continuation.selectedActionBaseIndex : selected.sourceBaseIndex;
        if (!actionUid || sourceBaseIndex === undefined) return { state, events: [] };
        const location = findActionLocationByUid(state.core, actionUid, sourceBaseIndex);
        if (!location) return { state, events: [] };
        if (selected.mode === 'destroy') {
            return {
                state,
                events: buildDestroyActionLocationEvents(
                    state.core,
                    playerId,
                    location,
                    'wraithrustlers_resurgence',
                    timestamp,
                    sourceInfoFromContinuation(playerId, continuation, 'wraithrustlers_resurgence'),
                ),
            };
        }
        if (selected.mode !== 'transfer') return { state, events: [] };
        const options = buildWraithActionTransferOptions(
            state.core,
            [location],
            state.core.bases
                .map((_base, baseIndex) => ({ baseIndex, label: baseName(state.core, baseIndex) }))
                .filter(candidate => candidate.baseIndex !== location.baseIndex),
        );
        if (options.length === 0) return { state, events: [] };
        return {
            state: queueWraithFieldSourceTargetPrompt(
                state,
                playerId,
                'wraithrustlers_resurgence_choose_destination',
                '复苏：选择行动转移到的基地',
                options,
                timestamp,
                continuation,
            ),
            events: [],
        };
    });

    registerInteractionHandler('wraithrustlers_resurgence_choose_destination', (state, playerId, value, data, _random, timestamp) => {
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const events = resolveWraithTransferChoice(
            state,
            playerId,
            value as WraithActionChoice,
            continuation,
            'wraithrustlers_resurgence',
            false,
            timestamp,
        );
        return { state, events };
    });

    registerInteractionHandler('wraithrustlers_watson_choose_mode', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as WraithActionChoice;
        if (selected.skip || !selected.mode) return { state, events: [] };
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        if (selected.mode === 'reveal') {
            return { state, events: buildWatsonRevealWraithEvents(state.core, playerId, 'wraithrustlers_watson', timestamp) };
        }
        if (selected.mode !== 'destroy') return { state, events: [] };
        const sourceBaseIndex = typeof continuation?.sourceBaseIndex === 'number' ? continuation.sourceBaseIndex : selected.sourceBaseIndex;
        if (sourceBaseIndex === undefined) return { state, events: [] };
        const options = buildWraithActionSourceActionOptions(collectOwnActionsOnBase(state.core, playerId, sourceBaseIndex));
        if (options.length === 0) return { state, events: [] };
        return {
            state: queueWraithFieldSourceActionPrompt(
                state,
                playerId,
                'wraithrustlers_watson_destroy_action',
                '沃森：选择要摧毁的己方行动',
                options,
                timestamp,
                {
                    ...(continuation ?? {}),
                    sourceBaseIndex,
                    sourceDefId: 'wraithrustlers_watson',
                },
            ),
            events: [],
        };
    });

    registerInteractionHandler('wraithrustlers_watson_destroy_action', (state, playerId, value, data, _random, timestamp) => {
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        return {
            state,
            events: resolveWraithDestroyChoice(
                state,
                playerId,
                value as WraithActionChoice,
                continuation,
                'wraithrustlers_watson',
                true,
                timestamp,
            ),
        };
    });

    registerInteractionHandler('wraithrustlers_ectoplasm_one_choose_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as WraithActionChoice;
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const actionUid = selectedActionUid(selected);
        const sourceBaseIndex = selectedSourceBaseIndex(selected);
        const targetBaseIndex = selected.targetBaseIndex ?? selected.baseIndex;
        if (
            selected.skip
            || !actionUid
            || sourceBaseIndex === undefined
            || targetBaseIndex === undefined
            || sourceBaseIndex === targetBaseIndex
        ) {
            return { state, events: [] };
        }
        const location = findActionLocationByUid(state.core, actionUid, sourceBaseIndex);
        if (!location || location.action.defId !== 'wraithrustlers_ectoplasm_one' || actionController(location.action) !== playerId) {
            return { state, events: [] };
        }
        const minionOptions = buildFieldSourceToMinionTargetOptions(
            wraithActionSource(location),
            (state.core.bases[sourceBaseIndex]?.minions ?? [])
                .filter(minion => minion.controller === playerId)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: sourceBaseIndex,
                    label: cardName(minion.defId),
                })),
            {
                state: state.core,
                sourcePlayerId: playerId,
                sourceDefId: 'wraithrustlers_ectoplasm_one',
                sourceKind: 'action',
                effectType: 'move',
            },
            { targetBaseIndex },
        );
        if (minionOptions.length === 0) return { state, events: [] };
        return {
            state: queueWraithFieldSourceTargetPrompt(
                state,
                playerId,
                'wraithrustlers_ectoplasm_one_choose_minion',
                '灵质一号：选择要移动到目标基地的己方佣兵',
                minionOptions as PromptOption<WraithActionChoice>[],
                timestamp,
                {
                    ...(continuation ?? {}),
                    sourceCardUid: actionUid,
                    sourceDefId: 'wraithrustlers_ectoplasm_one',
                    sourceBaseIndex,
                    targetBaseIndex,
                },
            ),
            events: [],
        };
    });

    registerInteractionHandler('wraithrustlers_ectoplasm_one_choose_minion', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as WraithActionChoice & { targetMinionUid?: string; targetMinionDefId?: string };
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        const actionUid = typeof continuation?.sourceCardUid === 'string' ? continuation.sourceCardUid : selectedActionUid(selected);
        const sourceBaseIndex = typeof continuation?.sourceBaseIndex === 'number' ? continuation.sourceBaseIndex : selectedSourceBaseIndex(selected);
        const targetBaseIndex = typeof continuation?.targetBaseIndex === 'number' ? continuation.targetBaseIndex : selected.targetBaseIndex;
        const targetMinionUid = selected.targetMinionUid;
        const targetMinionDefId = selected.targetMinionDefId ?? selected.defId;
        if (
            selected.skip
            || !actionUid
            || sourceBaseIndex === undefined
            || targetBaseIndex === undefined
            || !targetMinionUid
            || !targetMinionDefId
        ) {
            return { state, events: [] };
        }
        const location = findActionLocationByUid(state.core, actionUid, sourceBaseIndex);
        const minion = state.core.bases[sourceBaseIndex]?.minions.find(candidate =>
            candidate.uid === targetMinionUid && candidate.controller === playerId
        );
        if (!location || location.action.defId !== 'wraithrustlers_ectoplasm_one' || !minion) {
            return { state, events: [] };
        }
        const events = [
            ...buildTransferOngoingActionEventsWithSource(
                location.action,
                sourceBaseIndex,
                targetBaseIndex,
                'wraithrustlers_ectoplasm_one',
                timestamp,
                wraithSourceInfo(playerId, 'wraithrustlers_ectoplasm_one', actionUid, sourceBaseIndex),
            ),
            ...buildValidatedMoveEvents(state, {
                minionUid: targetMinionUid,
                minionDefId: targetMinionDefId,
                fromBaseIndex: sourceBaseIndex,
                toBaseIndex: targetBaseIndex,
                reason: 'wraithrustlers_ectoplasm_one',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: actionUid,
                sourceDefId: 'wraithrustlers_ectoplasm_one',
                sourceControllerId: playerId,
                sourceBaseIndex,
                sourceKind: 'nonAction',
            }),
        ];
        const destroyOptions = [
            createSkipOption('跳过（不摧毁行动）', 'ui.wraithrustlers_ectoplasm_one_destroy_skip_option'),
            ...buildWraithActionSourceActionOptions(collectActionsOnBase(
                state.core,
                targetBaseIndex,
                locationOnBase => locationOnBase.action.uid !== actionUid,
            )),
        ] as PromptOption<WraithActionChoice>[];
        return {
            state: queueWraithFieldSourceActionPrompt(
                state,
                playerId,
                'wraithrustlers_ectoplasm_one_destroy_action',
                '灵质一号：选择是否摧毁新基地上的行动',
                destroyOptions,
                timestamp,
                {
                    sourceCardUid: actionUid,
                    sourceDefId: 'wraithrustlers_ectoplasm_one',
                    sourceBaseIndex: targetBaseIndex,
                },
            ),
            events,
        };
    });

    registerInteractionHandler('wraithrustlers_ectoplasm_one_destroy_action', (state, playerId, value, data, _random, timestamp) => {
        const continuation = data?.continuationContext as Record<string, unknown> | undefined;
        return {
            state,
            events: resolveWraithDestroyChoice(
                state,
                playerId,
                value as WraithActionChoice,
                continuation,
                'wraithrustlers_ectoplasm_one',
                false,
                timestamp,
            ),
        };
    });

    registerInteractionHandler('wraithrustlers_the_tools_and_the_talent_deck', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ExcellentMoviesCardChoice;
        if (selected.skip || !selected.cardUid) return { state, events: [] };
        const player = state.core.players[playerId];
        const card = player?.deck.find(candidate =>
            candidate.uid === selected.cardUid && (!selected.defId || candidate.defId === selected.defId));
        return player && card
            ? {
                state,
                events: [
                    inspectDeck(playerId, playerId, player.deck.length, 'wraithrustlers_the_tools_and_the_talent', timestamp),
                    buildDeckReorderedEvent(playerId, [
                        card.uid,
                        ...player.deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid),
                    ], 'wraithrustlers_the_tools_and_the_talent', timestamp),
                ],
            }
            : { state, events: [] };
    });
}

function registerWraithrustlers(): void {
    registerWraithrustlersInteractionHandlers();

    registerSimpleAbility('wraithrustlers_watson', 'onPlay', ctx => {
        const canDestroy = collectOwnActionsOnBase(ctx.state, ctx.playerId, ctx.baseIndex).length > 0;
        const canReveal = ctx.state.players[ctx.playerId]?.deck.some(card => isWraith(card.defId)) ?? false;
        const options: PromptOption<WraithActionChoice>[] = [
            createSkipOption('跳过（不使用沃森效果）', 'ui.wraithrustlers_watson_skip_option'),
            ...(canDestroy ? [{
                id: 'destroy',
                label: '摧毁本基地上的己方行动',
                labelKey: 'ui.wraithrustlers_watson_destroy_option',
                value: { mode: 'destroy' as const, sourceBaseIndex: ctx.baseIndex },
                displayMode: 'button' as const,
            }] : []),
            ...(canReveal ? [{
                id: 'reveal',
                label: '展示牌库直到找到怨灵',
                labelKey: 'ui.wraithrustlers_watson_reveal_option',
                value: { mode: 'reveal' as const },
                displayMode: 'button' as const,
            }] : []),
        ] as PromptOption<WraithActionChoice>[];
        if (options.length <= 1) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_watson_choose_mode',
                '沃森：选择摧毁己方行动或展示牌库寻找怨灵',
                options,
                ctx.now,
                'button',
                undefined,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex: ctx.baseIndex },
            ),
        };
    });
    registerSimpleAbility('wraithrustlers_roy', 'onPlay', ctx => {
        const options = buildWraithActionTransferOptions(
            ctx.state,
            collectOwnActionsOutsideBase(ctx.state, ctx.playerId, ctx.baseIndex),
            [{ baseIndex: ctx.baseIndex, label: baseName(ctx.state, ctx.baseIndex) }],
        );
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queueWraithFieldSourceTargetPrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_roy',
                '罗伊：选择要转移到此基地的己方行动',
                options,
                ctx.now,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex: ctx.baseIndex },
            ),
        };
    });
    registerSimpleAbility('wraithrustlers_ellen', 'talent', ctx => {
        const options = buildWraithActionSourceActionOptions(collectOwnActionsOnBase(ctx.state, ctx.playerId, ctx.baseIndex));
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queueWraithFieldSourceActionPrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_ellen_destroy_action',
                '艾伦：选择要摧毁的己方行动',
                options,
                ctx.now,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex: ctx.baseIndex },
            ),
        };
    });
    registerSimpleAbility('wraithrustlers_unlicensed_nuclear_accelerator', 'talent', ctx => {
        const options = buildWraithActionSourceActionOptions(collectOwnActionsOnBase(ctx.state, ctx.playerId, ctx.baseIndex));
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queueWraithFieldSourceActionPrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_unlicensed_nuclear_accelerator_destroy_action',
                '未授权核加速器：选择要摧毁的己方行动',
                options,
                ctx.now,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex: ctx.baseIndex },
            ),
        };
    });
    registerSimpleAbility('wraithrustlers_resurgence', 'onPlay', ctx => {
        const sourceBaseIndex = ctx.baseIndex;
        const options = buildWraithActionSourceActionOptions(collectActionsOnBase(ctx.state, sourceBaseIndex));
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queueWraithFieldSourceActionPrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_resurgence_choose_action',
                '复苏：选择一个基地上的行动',
                options,
                ctx.now,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex },
            ),
        };
    });
    registerSimpleAbility('wraithrustlers_resurgence', 'special', ctx => {
        const sourceBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
        const options = buildWraithActionSourceActionOptions(collectActionsOnBase(ctx.state, sourceBaseIndex));
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queueWraithFieldSourceActionPrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_resurgence_choose_action',
                '复苏：选择一个基地上的行动',
                options,
                ctx.now,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex },
            ),
        };
    });
    registerSimpleAbility('wraithrustlers_funkman', 'special', ctx => {
        const sourceBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
        const options = buildWraithActionTransferOptions(
            ctx.state,
            collectActionsOnBase(ctx.state, sourceBaseIndex),
            ctx.state.bases
                .map((_base, baseIndex) => ({ baseIndex, label: baseName(ctx.state, baseIndex) }))
                .filter(candidate => candidate.baseIndex !== sourceBaseIndex),
        );
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queueWraithFieldSourceTargetPrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_funkman',
                '芬克曼：选择行动转移到的基地',
                options,
                ctx.now,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex },
            ),
        };
    });
    registerSimpleAbility('wraithrustlers_ancient_sumerian_god', 'onPlay', _ctx => ({
        events: [],
    }));
    registerSimpleAbility('wraithrustlers_ancient_sumerian_god', 'talent', ctx => {
        const options = (ctx.state.players[ctx.playerId]?.discard ?? [])
            .filter(isActionPlayableOnBase)
            .map(card => ({
                id: `discard-${card.uid}`,
                label: cardName(card.defId),
                value: { cardUid: card.uid, defId: card.defId, zone: 'discard' as const },
                displayMode: 'card' as const,
            })) as PromptOption<WraithStoredCardChoice>[];
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_ancient_sumerian_god_store_action',
                '古苏美尔神：选择要储存的基地行动',
                options,
                ctx.now,
                'generic',
                undefined,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex: ctx.baseIndex },
                undefined,
                { autoRefresh: 'discard', genericIntent: 'card-pool', responseValidationMode: 'live' },
            ),
        };
    });
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
        const storeOptions = buildWraithStoredCardOptions(ctx.state, ctx.playerId, card =>
            getMinionDef(card.defId)?.power !== undefined && (getMinionDef(card.defId)?.power ?? 99) <= 3);
        if (storeOptions.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queuePrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_demon_dogs_store_minion',
                '恶魔犬：选择要储存在此牌下方的弱随从',
                [createSkipOption(), ...storeOptions] as PromptOption<WraithStoredCardChoice>[],
                ctx.now,
                'generic',
                undefined,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex: ctx.baseIndex },
                undefined,
                { autoRefresh: 'hand_or_discard', genericIntent: 'card-pool', responseValidationMode: 'live' },
            ),
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
        const self = ctx.state.bases[ctx.baseIndex]?.ongoingActions.find(action => action.uid === ctx.cardUid);
        if (!self || !ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.controller === ctx.playerId)) return { events: [] };
        const options = buildWraithActionTransferOptions(
            ctx.state,
            [{ action: self, baseIndex: ctx.baseIndex }],
            ctx.state.bases
                .map((_base, baseIndex) => ({ baseIndex, label: baseName(ctx.state, baseIndex) }))
                .filter(candidate => candidate.baseIndex !== ctx.baseIndex),
        );
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            matchState: queueWraithFieldSourceTargetPrompt(
                ctx.matchState,
                ctx.playerId,
                'wraithrustlers_ectoplasm_one_choose_base',
                '灵质一号：选择此行动转移到的基地',
                options,
                ctx.now,
                { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex: ctx.baseIndex },
            ),
        };
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
        const options = buildDeckCardOptions(ctx.state, ctx.playerId);
        if (options.length === 0) return { events: [] };
        if (ctx.matchState) {
            return {
                events: [],
                matchState: queuePrompt(
                    ctx.matchState,
                    ctx.playerId,
                    'wraithrustlers_the_tools_and_the_talent_deck',
                    '工具与天赋：选择牌库中的一张牌置于牌库顶',
                    options,
                    ctx.now,
                    'generic',
                    undefined,
                    undefined,
                    undefined,
                    { autoRefresh: 'deck', genericIntent: 'card-pool', responseValidationMode: 'live' },
                ),
            };
        }
        const card = player?.deck[player.deck.length - 1];
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
        return [grantContextualExtraAction({ playerId: ctx.sourceControllerId, now: ctx.now, matchState: ctx.matchState }, 'wraithrustlers_ellen')];
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
