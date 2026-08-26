import type { MatchState, PlayerId } from '../../../engine/types';
import {
    type AbilityRuntimeResult,
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerAbilityProgram, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerDiscardSpecialProvider } from '../domain/discardSpecialAbilities';
import {
    addPermanentPower,
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    buildValidatedControlChangeEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    grantExtraMinion,
    queueMinionPlayEffect,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import {
    registerCardAbilitySuppression,
    registerProtection,
    registerTrigger,
    type ProtectionCheckContext,
    type TriggerContext,
} from '../domain/ongoingEffects';
import { buildOngoingDetachedEvent, buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../domain/ongoingModifiers';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    SU_EVENTS,
    type CardInstance,
    type MinionMetadataUpdatedEvent,
    type MinionOnBase,
    type SmashUpCore,
    type SmashUpEvent,
} from '../domain/types';

type PromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
};

type BaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    skip?: boolean;
};

type ModeChoice = {
    mode?: string;
    skip?: boolean;
};

type CardChoice = {
    cardUid?: string;
    defId?: string;
    zone?: 'deck' | 'discard';
    skip?: boolean;
};

type BoardActionCandidate = {
    uid: string;
    defId: string;
    ownerId: PlayerId;
    baseIndex: number;
    hostMinionUid?: string;
};

type ExtraActionMinionContext = PromptContext & {
    sourceId: string;
    sourceDefId: string;
    title: string;
    candidates: MinionTargetCandidate[];
    count: number;
};

type CheapPopCandidate = MinionTargetCandidate & {
    amount: number;
};

type CheapPopContext = PromptContext & {
    candidates: CheapPopCandidate[];
};

type ChikaraMizuTargetContext = PromptContext & {
    candidates: MinionTargetCandidate[];
    sourceCardUid: string;
};

type ChikaraMizuModeContext = PromptContext & {
    selected: MinionTargetCandidate;
    sourceCardUid: string;
};

type ChikaraMizuDiscardContext = PromptContext & {
    selected: MinionTargetCandidate;
    sourceCardUid: string;
};

type BulkingStewDiscardContext = PromptContext & {
    sourceCardUid: string;
    candidates: MinionTargetCandidate[];
};

type BulkingStewTargetContext = PromptContext & {
    sourceCardUid: string;
    selectedCardUids: string[];
    candidates: MinionTargetCandidate[];
};

type RookieSumoDiscardContext = PromptContext & {
    candidates: MinionTargetCandidate[];
};

type RookieSumoTargetContext = PromptContext & {
    selectedCardUid: string;
    candidates: MinionTargetCandidate[];
};

type MinionTargetCandidate = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type MinionEffectContext = PromptContext & {
    sourceId: string;
    sourceDefId: string;
    title: string;
    candidates: MinionTargetCandidate[];
    effect: 'powerCounter' | 'tempPower';
    amount: number;
    reason: string;
    drawAfter?: number;
    multiMax?: number;
    multiMin?: number;
    singleGetsAll?: boolean;
    extraActionAfter?: boolean;
    extraActionRestrictToSelected?: boolean;
};

type MoveDestinationContext = PromptContext & {
    sourceId: string;
    sourceDefId: string;
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    reason: string;
    tempPowerAfter?: number;
    drawAfter?: number;
    fixedToBaseIndex?: number;
    allowedToBaseIndices?: number[];
};

type MoveMinionContext = PromptContext & {
    sourceId: string;
    sourceDefId: string;
    title: string;
    candidates: MinionTargetCandidate[];
    reason: string;
    tempPowerAfter?: number;
    drawAfter?: number;
    fixedToBaseIndex?: number;
    allowedToBaseIndices?: number[];
};

type NorthernMoverTargetContext = PromptContext & {
    candidates: MinionTargetCandidate[];
};

type NorthernMoverModeContext = PromptContext & {
    selected: MinionTargetCandidate;
};

type BaseEffectContext = PromptContext & {
    sourceId: string;
    title: string;
    baseCandidates: Array<{ baseIndex: number; label: string }>;
    effect: 'ownMinionsTempPower' | 'ownMinionsPowerCounter';
    amount: number;
    reason: string;
    drawAfter?: number;
    extraActionAfter?: boolean;
};

type YokozunaMoveContext = PromptContext & {
    sourceBaseIndex: number;
    sourceCardUid: string;
    sourceDefId: string;
};

type HaichQMoveContext = PromptContext & {
    sourceBaseIndex: number;
    sourceCardUid: string;
};

type SearchActionContext = PromptContext & {
    sourceId: string;
    title: string;
    candidates: Array<CardChoice & { label: string }>;
    extraActionAfter?: boolean;
};

type MuchoslamVsMonstersContext = PromptContext & {
    candidates: Array<CardChoice & { label: string }>;
};

type MuchoslamRecoverActionContext = PromptContext & {
    candidates: Array<CardChoice & { label: string }>;
};

type ReversalDestroyActionsContext = PromptContext & {
    targetMinionUid: string;
    targetBaseIndex: number;
    candidates: BoardActionCandidate[];
};

type SumoHeadButtContext = PromptContext & {
    candidates: BoardActionCandidate[];
};

type OngoingActionChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    baseIndex?: number;
    hostMinionUid?: string;
};

type OutForTheCountChoice = {
    minionUid?: string;
    minionDefId?: string;
    baseIndex?: number;
    actionUid?: string;
    actionDefId?: string;
    actionOwnerId?: PlayerId;
};

type OutForTheCountContext = PromptContext & {
    candidates: Array<OutForTheCountChoice & { label: string }>;
};

type CapaRojaTargetContext = PromptContext & {
    sourceBaseIndex: number;
    sourceCardUid?: string;
};

type HeyaTrainingStableChoice = {
    cardUid?: string;
    minionUid?: string;
    baseIndex?: number;
    skip?: boolean;
};

type HeyaTrainingStableContext = PromptContext & {
    sourceBaseIndex: number;
};

type BaseMoveChoice = {
    minionUid?: string;
    minionDefId?: string;
    fromBaseIndex?: number;
    toBaseIndex?: number;
    skip?: boolean;
};

type BaseMovePromptContext = PromptContext & {
    sourceId: string;
    title: string;
    sourceBaseIndex: number;
    candidates: Array<BaseMoveChoice & { label: string }>;
};

type GreatWhiteNorthContext = PromptContext & {
    sourceBaseIndex: number;
    remainingPlayerIds: PlayerId[];
};

type TagTeamBaseContext = PromptContext & {
    baseCandidates: Array<{ baseIndex: number; label: string }>;
};

const SET_UP_ACTION_IDS = new Set([
    'luchadors_quick_set_up',
    'luchadors_smart_set_up',
    'luchadors_powerful_set_up',
]);

const DIRECT_MINION_AFFECTING_ACTION_IDS = new Set([
    'sumo_wrestlers_technique_prize',
    'sumo_wrestlers_fighting_spirit_prize',
    'sumo_wrestlers_chikara_mizu',
    'musketeers_en_garde',
    'musketeers_biding_time',
    'musketeers_one_for_all',
    'musketeers_last_stand',
    'musketeers_all_for_one',
    'mounties_eh',
    'mounties_power_poutine',
    'mounties_when_calls_the_badge',
    'luchadors_cheap_pop',
]);

const MUSKETEER_ACTION_TRIGGERED_TURN_META = 'internationalIncidentMusketeerActionTriggeredTurn';
const MUSKETEERS_ALL_FOR_ONE_DESTROY_META = 'internationalIncidentAllForOneDestroyAtTurnEnd';
const MOUNTIES_ALWAYS_GET_OUR_MAN_META = 'internationalIncidentAlwaysGetOurMan';
const LUCHADORS_REVERSAL_CONTROL_META = 'internationalIncidentReversalControl';
const BASE_BASTION_USED_TURN_META = 'internationalIncidentBastionSaintGervaisUsedTurn';

type AllForOneDestroyMarker = {
    cardUid: string;
    sourcePlayerId: PlayerId;
    turnNumber: number;
};

function createPromptContext<TExtra extends object>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra: TExtra,
): PromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...extra,
    };
}

function runtimeToAbilityResult(
    result: AbilityRuntimeResult<SmashUpCore, SmashUpEvent>,
): AbilityResult {
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function getBaseLabel(state: SmashUpCore, baseIndex: number): string {
    const baseDefId = state.bases[baseIndex]?.defId;
    return getBaseDef(baseDefId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function getMinionLabel(state: SmashUpCore, minion: MinionOnBase, baseIndex: number): string {
    return `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseLabel(state, baseIndex)}`;
}

function collectMinions(
    state: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): MinionTargetCandidate[] {
    const result: MinionTargetCandidate[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        for (const minion of base.minions) {
            if (!predicate(minion, baseIndex)) continue;
            result.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getMinionLabel(state, minion, baseIndex),
            });
        }
    }
    return result;
}

function collectOwnMinions(state: SmashUpCore, playerId: PlayerId): MinionTargetCandidate[] {
    return collectMinions(state, minion => minion.controller === playerId);
}

function collectOwnMinionsOnBase(state: SmashUpCore, playerId: PlayerId, baseIndex: number): MinionTargetCandidate[] {
    return collectMinions(state, (minion, candidateBaseIndex) => (
        candidateBaseIndex === baseIndex && minion.controller === playerId
    ));
}

function collectOtherPlayersMinionsOnBase(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
): MinionTargetCandidate[] {
    return collectMinions(state, (minion, candidateBaseIndex) => (
        candidateBaseIndex === baseIndex && minion.controller !== playerId
    ));
}

function hasOtherBaseTarget(state: SmashUpCore, sourceBaseIndex: number): boolean {
    return state.bases.some((_base, baseIndex) => baseIndex !== sourceBaseIndex);
}

function buildMoveEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    context: MoveDestinationContext,
    toBaseIndex: number,
    timestamp: number,
): SmashUpEvent[] {
    return buildValidatedMoveEvents(state, {
        minionUid: context.minionUid,
        minionDefId: context.minionDefId,
        fromBaseIndex: context.fromBaseIndex,
        toBaseIndex,
        reason: context.reason,
        now: timestamp,
        sourcePlayerId: context.playerId,
        sourceDefId: context.sourceDefId,
        sourceControllerId: context.playerId,
        sourceBaseIndex: context.fromBaseIndex,
        sourceKind: getCardDef(context.sourceDefId)?.type === 'action' ? 'action' : 'nonAction',
    });
}

function buildMinionMetadataUpdatedEvent(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    timestamp: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
            minionUid,
            baseIndex,
            metadataUpdate,
            reason,
        },
        timestamp,
    };
}

function getActionControllerId(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (typeof action.metadata?.sourceControllerId === 'string'
        ? action.metadata.sourceControllerId
        : action.ownerId) as PlayerId;
}

function minionHasSetUpAction(minion: MinionOnBase): boolean {
    return minion.attachedActions.some(action => SET_UP_ACTION_IDS.has(action.defId));
}

function minionHasSetUpActionControlledBy(minion: MinionOnBase, playerId: PlayerId): boolean {
    return minion.attachedActions.some(action =>
        SET_UP_ACTION_IDS.has(action.defId)
        && getActionControllerId(action) === playerId,
    );
}

function getFirstOtherBaseIndex(state: SmashUpCore, sourceBaseIndex: number): number | undefined {
    return state.bases.findIndex((_base, baseIndex) => baseIndex !== sourceBaseIndex);
}

function nextPlayerTurnStartExpiration(state: SmashUpCore, playerId: PlayerId): number {
    const turnOrder = state.turnOrder ?? [];
    const currentIndex = Number.isInteger(state.currentPlayerIndex)
        ? state.currentPlayerIndex
        : turnOrder.indexOf((state as { currentPlayer?: PlayerId }).currentPlayer ?? '');
    const playerIndex = turnOrder.indexOf(playerId);
    if (turnOrder.length === 0 || currentIndex < 0 || playerIndex < 0) {
        return state.turnNumber + 1;
    }
    return state.turnNumber + (playerIndex > currentIndex ? 0 : 1);
}

function getPrintedPower(state: SmashUpCore, minion: MinionOnBase, baseIndex: number): number {
    const cardDef = getCardDef(minion.defId);
    if (cardDef?.type === 'minion' && typeof cardDef.power === 'number') return cardDef.power;
    return minion.basePower ?? getEffectivePower(state, minion, baseIndex);
}

function buildCardsDiscardedEvent(
    playerId: PlayerId,
    cardUids: string[],
    timestamp: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids },
        timestamp,
    } as SmashUpEvent;
}

function getDiscardableHandCards(
    state: SmashUpCore,
    playerId: PlayerId,
    sourceCardUid: string,
): CardInstance[] {
    return state.players[playerId]?.hand.filter(card => card.uid !== sourceCardUid) ?? [];
}

function buildHandCardOptions(cards: CardInstance[]) {
    return cards.map((card, index) => ({
        id: `hand-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function buildMinionControlChangedEvents(state: SmashUpCore, params: {
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
    toControllerId: PlayerId;
    sourcePlayerId: PlayerId;
    sourceDefId: string;
    reason: string;
    now: number;
}): SmashUpEvent[] {
    return buildValidatedControlChangeEvents(state, {
        minionUid: params.minionUid,
        minionDefId: params.minionDefId,
        baseIndex: params.baseIndex,
        toControllerId: params.toControllerId,
        sourcePlayerId: params.sourcePlayerId,
        sourceDefId: params.sourceDefId,
        sourceControllerId: params.sourcePlayerId,
        sourceBaseIndex: params.baseIndex,
        reason: params.reason,
        now: params.now,
    });
}

function buildBaseMetadataUpdatedEvent(
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    timestamp: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.BASE_METADATA_UPDATED,
        payload: { baseIndex, metadataUpdate, reason },
        timestamp,
    } as SmashUpEvent;
}

function buildDeckReorderedEvent(
    playerId: PlayerId,
    deckUids: string[],
    timestamp: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids },
        timestamp,
    } as SmashUpEvent;
}

function collectOtherPlayerActionsAtBase(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
): BoardActionCandidate[] {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return [
        ...base.ongoingActions
            .filter(action => getActionControllerId(action) !== playerId)
            .map(action => ({ ...action, baseIndex })),
        ...base.minions.flatMap(minion =>
            minion.attachedActions
                .filter(action => getActionControllerId(action) !== playerId)
                .map(action => ({ ...action, baseIndex, hostMinionUid: minion.uid })),
        ),
    ];
}

function buildBoardActionOptions(state: SmashUpCore, candidates: BoardActionCandidate[]) {
    return candidates.map((action, index) => {
        const host = action.hostMinionUid
            ? state.bases[action.baseIndex]?.minions.find(minion => minion.uid === action.hostMinionUid)
            : undefined;
        const location = host
            ? getMinionLabel(state, host, action.baseIndex)
            : getBaseLabel(state, action.baseIndex);
        return {
            id: `ongoing-${index}`,
            label: `${getCardDef(action.defId)?.name ?? action.defId} @ ${location}`,
            value: {
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                baseIndex: action.baseIndex,
                ...(action.hostMinionUid ? { hostMinionUid: action.hostMinionUid } : {}),
            },
            displayMode: 'card' as const,
            _source: 'ongoing' as const,
        };
    });
}

function buildOutForTheCountChoices(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<OutForTheCountChoice & { label: string }> {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions.flatMap(minion =>
            minion.attachedActions
                .filter(action => getActionControllerId(action) === playerId)
                .map(action => ({
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    baseIndex,
                    actionUid: action.uid,
                    actionDefId: action.defId,
                    actionOwnerId: action.ownerId,
                    label: `${getMinionLabel(state, minion, baseIndex)} / ${getCardDef(action.defId)?.name ?? action.defId}`,
                })),
        ),
    );
}

function isActionThatDirectlyAffectsMinion(defId?: string): boolean {
    if (!defId) return false;
    if (DIRECT_MINION_AFFECTING_ACTION_IDS.has(defId)) return true;
    const def = getCardDef(defId);
    if (!def || def.type !== 'action') return false;
    return def.playNeedsMinion === true
        || def.ongoingTarget === 'minion'
        || def.specialNeedsBase === true
        || def.specialTiming === 'beforeScoring';
}

function normalizeSourceDefIdFromReason(reason?: string): string | undefined {
    if (!reason) return undefined;
    return reason
        .replace(/_(self_destruct|destroy|discard|expired|return|returned|shuffle|shuffled|detach|detached)$/u, '')
        .replace(/_pod$/u, '_pod');
}

function resolveSourceDefIdFromEvent(event?: SmashUpEvent): string | undefined {
    const payload = (event as { payload?: Record<string, unknown> } | undefined)?.payload;
    if (!payload) return undefined;
    const explicit = payload.sourceDefId;
    if (typeof explicit === 'string' && explicit.length > 0) return explicit;
    if (event?.type === SU_EVENTS.ONGOING_ATTACHED) {
        const attachedDefId = payload.defId;
        if (typeof attachedDefId === 'string' && attachedDefId.length > 0) return attachedDefId;
    }
    const reason = payload.reason;
    return typeof reason === 'string' ? normalizeSourceDefIdFromReason(reason) : undefined;
}

function resolveSourcePlayerIdFromEvent(event?: SmashUpEvent): PlayerId | undefined {
    const payload = (event as { payload?: Record<string, unknown> } | undefined)?.payload;
    if (!payload) return undefined;
    const sourceControllerId = payload.sourceControllerId;
    if (typeof sourceControllerId === 'string') return sourceControllerId;
    const sourcePlayerId = payload.sourcePlayerId;
    return typeof sourcePlayerId === 'string' ? sourcePlayerId : undefined;
}

function findAttachedActionHost(
    state: SmashUpCore,
    cardUid: string,
    preferredBaseIndex?: number,
): { minion: MinionOnBase; baseIndex: number } | undefined {
    const baseOrder = preferredBaseIndex !== undefined
        ? [preferredBaseIndex, ...state.bases.map((_base, index) => index).filter(index => index !== preferredBaseIndex)]
        : state.bases.map((_base, index) => index);
    for (const baseIndex of baseOrder) {
        const minion = state.bases[baseIndex]?.minions.find(candidate =>
            candidate.attachedActions.some(action => action.uid === cardUid),
        );
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function getAllForOneDestroyMarkers(minion: MinionOnBase): AllForOneDestroyMarker[] {
    const raw = minion.metadata?.[MUSKETEERS_ALL_FOR_ONE_DESTROY_META];
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry): entry is AllForOneDestroyMarker => (
        typeof entry === 'object'
        && entry !== null
        && typeof (entry as AllForOneDestroyMarker).cardUid === 'string'
        && typeof (entry as AllForOneDestroyMarker).sourcePlayerId === 'string'
        && typeof (entry as AllForOneDestroyMarker).turnNumber === 'number'
    ));
}

function canSeeOwnMinionOnBase(state: SmashUpCore, playerId: PlayerId, baseIndex: number): boolean {
    return state.bases[baseIndex]?.minions.some(minion => minion.controller === playerId) ?? false;
}

const minionEffectPrompt = createPromptProgram<MinionEffectContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'international_incident_minion_effect',
    buildInteraction: (context) => {
        const options = buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'buff',
        });
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            context.title,
            options,
            {
                sourceId: context.sourceId,
                targetType: 'minion',
                ...(context.multiMax
                    ? { multi: { min: context.multiMin ?? 1, max: Math.min(context.multiMax, options.length) } }
                    : {}),
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: (args) => {
        const { context, value, timestamp } = args;
        const picks = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        const validPicks = picks
            .filter(pick => !pick.skip && pick.minionUid && pick.baseIndex !== undefined)
            .slice(0, context.multiMax ?? 1);
        const events: SmashUpEvent[] = [];
        if (context.drawAfter) {
            events.push(...buildStandardDrawEventsFromRuntimeContext({ ...args, state: context.matchState.core }, context.playerId, context.drawAfter));
        }
        if (validPicks.length === 0) return { events };

        const addEffect = (pick: MinionChoice, amount = context.amount) => {
            if (!pick.minionUid || pick.baseIndex === undefined) return;
            events.push(context.effect === 'powerCounter'
                ? addPowerCounter(pick.minionUid, pick.baseIndex, amount, context.reason, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: pick.baseIndex,
                })
                : addTempPower(pick.minionUid, pick.baseIndex, amount, context.reason, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: pick.baseIndex,
                }));
        };

        if (context.singleGetsAll && validPicks.length === 1 && context.multiMax && context.multiMax > 1) {
            addEffect(validPicks[0], context.amount * context.multiMax);
        } else {
            validPicks.forEach(pick => addEffect(pick));
        }
        if (context.extraActionAfter) {
            const firstPick = validPicks[0];
            events.push(grantContextualExtraAction(
                { playerId: context.playerId, now: timestamp, matchState: context.matchState },
                context.sourceDefId,
                context.extraActionRestrictToSelected && firstPick?.minionUid
                    ? { restrictToMinionUid: firstPick.minionUid }
                    : undefined,
            ));
        }
        return { events };
    },
});

function runMinionEffect(
    ctx: AbilityContext,
    candidates: MinionTargetCandidate[],
    config: Omit<MinionEffectContext, 'matchState' | 'playerId' | 'now' | 'candidates'>,
): AbilityResult {
    const drawEvents = config.drawAfter
        ? buildStandardDrawEvents(ctx.state, ctx.playerId, config.drawAfter, ctx.random, ctx.now)
        : [];
    if (candidates.length === 0) {
        return { events: drawEvents.length ? drawEvents : [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const targetFromCommand = ctx.targetMinionUid
        ? candidates.find(candidate => (
            candidate.uid === ctx.targetMinionUid
            && (ctx.targetBaseIndex === undefined || candidate.baseIndex === ctx.targetBaseIndex)
        ))
        : undefined;
    if (ctx.targetMinionUid && !targetFromCommand) {
        return { events: drawEvents.length ? drawEvents : [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (targetFromCommand && !config.multiMax) {
        return {
            events: [
                ...drawEvents,
                config.effect === 'powerCounter'
                    ? addPowerCounter(targetFromCommand.uid, targetFromCommand.baseIndex, config.amount, config.reason, ctx.now, {
                        sourcePlayerId: ctx.playerId,
                        sourceDefId: config.sourceDefId,
                        sourceControllerId: ctx.playerId,
                        sourceBaseIndex: targetFromCommand.baseIndex,
                    })
                    : addTempPower(targetFromCommand.uid, targetFromCommand.baseIndex, config.amount, config.reason, ctx.now, {
                        sourcePlayerId: ctx.playerId,
                        sourceDefId: config.sourceDefId,
                        sourceControllerId: ctx.playerId,
                        sourceBaseIndex: targetFromCommand.baseIndex,
                    }),
                ...(config.extraActionAfter
                    ? [grantContextualExtraAction(ctx, config.sourceDefId, config.extraActionRestrictToSelected
                        ? { restrictToMinionUid: targetFromCommand.uid }
                        : undefined)]
                    : []),
            ],
        };
    }
    if (!ctx.matchState) return { events: drawEvents };
    return runtimeToAbilityResult(executeAbilityProgram(minionEffectPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
        ...config,
    }));
}

const extraActionMinionPrompt = createPromptProgram<ExtraActionMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'international_incident_extra_action_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'buff',
        }),
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid) return { events: [] };
        return {
            events: Array.from({ length: context.count }, () => grantContextualExtraAction(
                { playerId: context.playerId, now: timestamp, matchState: context.matchState },
                context.sourceDefId,
                { restrictToMinionUid: selected.minionUid },
            )),
        };
    },
});

function runExtraActionsRestrictedToMinion(
    ctx: AbilityContext,
    candidates: MinionTargetCandidate[],
    config: Omit<ExtraActionMinionContext, 'matchState' | 'playerId' | 'now' | 'candidates'>,
): AbilityResult {
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(extraActionMinionPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
        ...config,
    }));
}

const moveDestinationPrompt = createPromptProgram<MoveDestinationContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'international_incident_move_destination',
    buildInteraction: (context) => {
        const allowedTargets = context.allowedToBaseIndices
            ? new Set(context.allowedToBaseIndices)
            : undefined;
        const baseOptions = context.fixedToBaseIndex !== undefined
            ? [{ baseIndex: context.fixedToBaseIndex, label: getBaseLabel(context.matchState.core, context.fixedToBaseIndex) }]
            : context.matchState.core.bases
                .map((_base, baseIndex) => ({ baseIndex, label: getBaseLabel(context.matchState.core, baseIndex) }))
                .filter(base => base.baseIndex !== context.fromBaseIndex)
                .filter(base => !allowedTargets || allowedTargets.has(base.baseIndex));
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_destination_${context.now}`,
            context.playerId,
            '选择目标基地',
            buildBaseTargetOptions(baseOptions, context.matchState.core),
            {
                sourceId: `${context.sourceId}_destination`,
                targetType: 'base',
                titleKey: 'ui.international_incident_move_destination_title',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: (args) => {
        const { state, context, value, timestamp } = args;
        const selected = value as BaseChoice;
        if (selected.baseIndex === undefined) return { events: [] };
        if (context.allowedToBaseIndices && !context.allowedToBaseIndices.includes(selected.baseIndex)) {
            return { events: [] };
        }
        const moveEvents = buildMoveEvents(state, context, selected.baseIndex, timestamp);
        const events: SmashUpEvent[] = [...moveEvents];
        if (moveEvents.length > 0 && context.tempPowerAfter) {
            events.push(addTempPower(context.minionUid, selected.baseIndex, context.tempPowerAfter, context.reason, timestamp, {
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: selected.baseIndex,
            }));
        }
        if (moveEvents.length > 0 && context.drawAfter) {
            events.push(...buildStandardDrawEventsFromRuntimeContext({ ...args, state: state.core }, context.playerId, context.drawAfter));
        }
        return { events };
    },
});

const moveMinionPrompt = createPromptProgram<MoveMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'international_incident_move_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'move',
        }),
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { events: [] };
        }
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.sourceId,
                sourceDefId: context.sourceDefId,
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                reason: context.reason,
                tempPowerAfter: context.tempPowerAfter,
                drawAfter: context.drawAfter,
                fixedToBaseIndex: context.fixedToBaseIndex,
                allowedToBaseIndices: context.allowedToBaseIndices,
            } satisfies MoveDestinationContext,
            nextProgram: moveDestinationPrompt,
        };
    },
});

const northernMoverModePrompt = createPromptProgram<NorthernMoverModeContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mounties_northern_mover_mode',
    buildInteraction: (context) => {
        const canMove = hasOtherBaseTarget(context.matchState.core, context.selected.baseIndex);
        const options = [
            ...(canMove
                ? [{ id: 'move', label: '移动到另一个基地', value: { mode: 'move' }, displayMode: 'button' as const , labelKey: 'ui.mounties_northern_mover_move_option'}]
                : []),
            { id: 'power', label: '直到回合结束 +1 力量', value: { mode: 'power' }, displayMode: 'button' as const , labelKey: 'ui.mounties_northern_mover_power_option'},
        ];
        return createAbilityRuntimeSimpleChoice(
            `mounties_northern_mover_mode_${context.now}`,
            context.playerId,
            '北方搬运者：选择效果',
            options,
            { sourceId: 'mounties_northern_mover_mode', targetType: 'generic' , titleKey: 'ui.mounties_northern_mover_mode_title'},
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as ModeChoice;
        if (selected.mode === 'move' && hasOtherBaseTarget(state.core, context.selected.baseIndex)) {
            return {
                events: [],
                context: {
                    matchState: state,
                    playerId: context.playerId,
                    now: timestamp,
                    sourceId: 'mounties_northern_mover',
                    sourceDefId: 'mounties_northern_mover',
                    minionUid: context.selected.uid,
                    minionDefId: context.selected.defId,
                    fromBaseIndex: context.selected.baseIndex,
                    reason: 'mounties_northern_mover',
                } satisfies MoveDestinationContext,
                nextProgram: moveDestinationPrompt,
            };
        }
        return {
            events: [addTempPower(context.selected.uid, context.selected.baseIndex, 1, 'mounties_northern_mover', timestamp, {
                sourcePlayerId: context.playerId,
                sourceDefId: 'mounties_northern_mover',
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.selected.baseIndex,
            })],
        };
    },
});

const northernMoverTargetPrompt = createPromptProgram<NorthernMoverTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mounties_northern_mover_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mounties_northern_mover_target_${context.now}`,
        context.playerId,
        '北方搬运者：选择另一个己方随从',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'mounties_northern_mover',
            effectType: 'move',
        }),
        {
            sourceId: 'mounties_northern_mover_target',
            targetType: 'minion',
            titleKey: 'ui.mounties_northern_mover_target_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as MinionChoice;
        const candidate = context.candidates.find(entry => entry.uid === selected.minionUid);
        if (!candidate) return { events: [] };
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: timestamp,
                selected: candidate,
            } satisfies NorthernMoverModeContext,
            nextProgram: northernMoverModePrompt,
        };
    },
});

const chikaraMizuDiscardPrompt = createPromptProgram<ChikaraMizuDiscardContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_chikara_mizu_discard',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sumo_wrestlers_chikara_mizu_discard_${context.now}`,
        context.playerId,
        '力量满溢：弃 1 张牌，使所选随从直到回合结束 +4 力量',
        buildHandCardOptions(getDiscardableHandCards(
            context.matchState.core,
            context.playerId,
            context.sourceCardUid,
        )),
        { sourceId: 'sumo_wrestlers_chikara_mizu_discard', targetType: 'hand' , titleKey: 'ui.sumo_wrestlers_chikara_mizu_discard_title'},
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selectedCard = value as CardChoice;
        const discardable = getDiscardableHandCards(state.core, context.playerId, context.sourceCardUid);
        const card = discardable.find(entry => entry.uid === selectedCard.cardUid);
        if (!card) return { events: [] };
        return {
            events: [
                buildCardsDiscardedEvent(context.playerId, [card.uid], timestamp),
                addTempPower(context.selected.uid, context.selected.baseIndex, 4, 'sumo_wrestlers_chikara_mizu', timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'sumo_wrestlers_chikara_mizu',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.selected.baseIndex,
                }),
            ],
        };
    },
});

const chikaraMizuModePrompt = createPromptProgram<ChikaraMizuModeContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_chikara_mizu_mode',
    buildInteraction: (context) => {
        const canDiscard = getDiscardableHandCards(
            context.matchState.core,
            context.playerId,
            context.sourceCardUid,
        ).length > 0;
        return createAbilityRuntimeSimpleChoice(
            `sumo_wrestlers_chikara_mizu_mode_${context.now}`,
            context.playerId,
            '力量满溢：选择 +2 或弃牌改为 +4',
            [
                { id: 'power-2', label: '直到回合结束 +2 力量', value: { mode: 'power2' }, displayMode: 'button' as const , labelKey: 'ui.sumo_wrestlers_chikara_mizu_power2_option'},
                ...(canDiscard
                    ? [{ id: 'discard-power-4', label: '弃 1 张牌，改为 +4 力量', value: { mode: 'discardPower4' }, displayMode: 'button' as const , labelKey: 'ui.sumo_wrestlers_chikara_mizu_discard_power4_option'}]
                    : []),
            ],
            {
                sourceId: 'sumo_wrestlers_chikara_mizu_mode',
                targetType: 'generic',
                titleKey: 'ui.sumo_wrestlers_chikara_mizu_mode_title',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as ModeChoice;
        if (selected.mode === 'discardPower4') {
            return {
                events: [],
                context: {
                    matchState: context.matchState,
                    playerId: context.playerId,
                    now: timestamp,
                    selected: context.selected,
                    sourceCardUid: context.sourceCardUid,
                } satisfies ChikaraMizuDiscardContext,
                nextProgram: chikaraMizuDiscardPrompt,
            };
        }
        return {
            events: [addTempPower(context.selected.uid, context.selected.baseIndex, 2, 'sumo_wrestlers_chikara_mizu', timestamp, {
                sourcePlayerId: context.playerId,
                sourceDefId: 'sumo_wrestlers_chikara_mizu',
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.selected.baseIndex,
            })],
        };
    },
});

const chikaraMizuTargetPrompt = createPromptProgram<ChikaraMizuTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_chikara_mizu_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sumo_wrestlers_chikara_mizu_target_${context.now}`,
        context.playerId,
        '力量满溢：选择你的一个随从',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'sumo_wrestlers_chikara_mizu',
            effectType: 'buff',
        }),
        {
            sourceId: 'sumo_wrestlers_chikara_mizu_target',
            targetType: 'minion',
            titleKey: 'ui.sumo_wrestlers_chikara_mizu_target_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as MinionChoice;
        const candidate = context.candidates.find(entry => entry.uid === selected.minionUid);
        if (!candidate) return { events: [] };
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: timestamp,
                selected: candidate,
                sourceCardUid: context.sourceCardUid,
            } satisfies ChikaraMizuModeContext,
            nextProgram: chikaraMizuModePrompt,
        };
    },
});

const bulkingStewTargetPrompt = createPromptProgram<BulkingStewTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_bulking_stew_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sumo_wrestlers_bulking_stew_target_${context.now}`,
        context.playerId,
        '炖肉：选择一个己方随从放置力量指示物',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'sumo_wrestlers_bulking_stew',
            effectType: 'buff',
        }),
        {
            sourceId: 'sumo_wrestlers_bulking_stew_target',
            targetType: 'minion',
            titleKey: 'ui.sumo_wrestlers_bulking_stew_target_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice;
        const target = context.candidates.find(candidate => candidate.uid === selected.minionUid);
        if (!target || context.selectedCardUids.length === 0) return { events: [] };
        const discardable = getDiscardableHandCards(state.core, context.playerId, context.sourceCardUid);
        const selectedCards = discardable.filter(card => context.selectedCardUids.includes(card.uid));
        if (selectedCards.length === 0) return { events: [] };
        return {
            events: [
                buildCardsDiscardedEvent(context.playerId, selectedCards.map(card => card.uid), timestamp),
                addPowerCounter(target.uid, target.baseIndex, selectedCards.length, 'sumo_wrestlers_bulking_stew', timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'sumo_wrestlers_bulking_stew',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: target.baseIndex,
                }),
            ],
        };
    },
});

const bulkingStewDiscardPrompt = createPromptProgram<BulkingStewDiscardContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_bulking_stew_discard',
    buildInteraction: (context) => {
        const discardable = getDiscardableHandCards(
            context.matchState.core,
            context.playerId,
            context.sourceCardUid,
        );
        const options = buildHandCardOptions(discardable);
        return createAbilityRuntimeSimpleChoice(
            `sumo_wrestlers_bulking_stew_discard_${context.now}`,
            context.playerId,
            '炖肉：选择任意数量手牌弃掉',
            options,
            {
                sourceId: 'sumo_wrestlers_bulking_stew_discard',
                targetType: 'hand',
                multi: { min: 0, max: options.length },
                titleKey: 'ui.sumo_wrestlers_bulking_stew_discard_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = (Array.isArray(value) ? value : [value]) as CardChoice[];
        const discardable = getDiscardableHandCards(state.core, context.playerId, context.sourceCardUid);
        const selectedCardUids = [...new Set(selected
            .map(card => card.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string'))]
            .filter(cardUid => discardable.some(card => card.uid === cardUid));
        if (selectedCardUids.length === 0) return { events: [] };
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: timestamp,
                sourceCardUid: context.sourceCardUid,
                selectedCardUids,
                candidates: context.candidates,
            } satisfies BulkingStewTargetContext,
            nextProgram: bulkingStewTargetPrompt,
        };
    },
});

function runMoveMinion(
    ctx: AbilityContext,
    candidates: MinionTargetCandidate[],
    config: Omit<MoveMinionContext, 'matchState' | 'playerId' | 'now' | 'candidates'>,
): AbilityResult {
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(moveMinionPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
        ...config,
    }));
}

const baseEffectPrompt = createPromptProgram<BaseEffectContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'international_incident_base_effect',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildBaseTargetOptions(context.baseCandidates, context.matchState.core),
        { sourceId: context.sourceId, targetType: 'base', autoResolveIfSingle: false },
    ),
    onResolve: (args) => {
        const { context, value, timestamp } = args;
        const selected = value as BaseChoice;
        if (selected.baseIndex === undefined) return { events: [] };
        const ownMinions = context.matchState.core.bases[selected.baseIndex]?.minions
            .filter(minion => minion.controller === context.playerId) ?? [];
        const events: SmashUpEvent[] = [];
        for (const minion of ownMinions) {
            events.push(context.effect === 'ownMinionsPowerCounter'
                ? addPowerCounter(minion.uid, selected.baseIndex, context.amount, context.reason, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: selected.baseIndex,
                })
                : addTempPower(minion.uid, selected.baseIndex, context.amount, context.reason, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: selected.baseIndex,
                }));
        }
        if (context.extraActionAfter) {
            events.push(grantContextualExtraAction(context, context.reason));
        }
        if (context.drawAfter) {
            events.push(...buildStandardDrawEventsFromRuntimeContext({ ...args, state: context.matchState.core }, context.playerId, context.drawAfter));
        }
        return { events };
    },
});

function runBaseEffect(
    ctx: AbilityContext,
    baseCandidates: Array<{ baseIndex: number; label: string }>,
    config: Omit<BaseEffectContext, 'matchState' | 'playerId' | 'now' | 'baseCandidates'>,
): AbilityResult {
    if (baseCandidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!ctx.matchState) {
        return { events: config.drawAfter ? buildStandardDrawEvents(ctx.state, ctx.playerId, config.drawAfter, ctx.random, ctx.now) : [] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(baseEffectPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseCandidates,
        ...config,
    }));
}

const yokozunaModePrompt = createPromptProgram<YokozunaMoveContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_yokozuna_mode',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sumo_wrestlers_yokozuna_mode_${context.now}`,
        context.playerId,
        '横纲：选择天赋效果',
        [
            { id: 'draw', label: '抽 1 张牌', value: { mode: 'draw' }, displayMode: 'button' as const , labelKey: 'ui.sumo_wrestlers_yokozuna_draw_option'},
            { id: 'move', label: '移动这里的其他玩家随从', value: { mode: 'move' }, displayMode: 'button' as const , labelKey: 'ui.sumo_wrestlers_yokozuna_move_option'},
        ],
            {
                sourceId: 'sumo_wrestlers_yokozuna_mode',
                targetType: 'generic',
                titleKey: 'ui.sumo_wrestlers_yokozuna_mode_title',
                autoResolveIfSingle: false,
            },
    ),
    onResolve: (args) => {
        const { context, value, timestamp } = args;
        const selected = value as ModeChoice;
        if (selected.mode === 'draw') {
            return { events: buildStandardDrawEventsFromRuntimeContext({ ...args, state: context.matchState.core }, context.playerId, 1) };
        }
        const candidates = collectOtherPlayersMinionsOnBase(context.matchState.core, context.playerId, context.sourceBaseIndex);
        if (candidates.length === 0) return { events: [] };
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: timestamp,
                sourceId: 'sumo_wrestlers_yokozuna_move',
                sourceDefId: 'sumo_wrestlers_yokozuna',
                title: '横纲：选择要移动的其他玩家随从',
                candidates,
                reason: 'sumo_wrestlers_yokozuna',
            } satisfies MoveMinionContext,
            nextProgram: moveMinionPrompt,
        };
    },
});

function sumoYokozunaTalent(ctx: AbilityContext): AbilityResult {
    const moveCandidates = collectOtherPlayersMinionsOnBase(ctx.state, ctx.playerId, ctx.baseIndex);
    if (moveCandidates.length === 0 || !hasOtherBaseTarget(ctx.state, ctx.baseIndex)) {
        return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
    }
    return runtimeToAbilityResult(executeAbilityProgram(yokozunaModePrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceBaseIndex: ctx.baseIndex,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
    })));
}

function sumoTechniquePrize(ctx: AbilityContext): AbilityResult {
    return runMinionEffect(ctx, collectOwnMinions(ctx.state, ctx.playerId), {
        sourceId: 'sumo_wrestlers_technique_prize',
        sourceDefId: 'sumo_wrestlers_technique_prize',
        title: '技术奖：选择你的一个随从放置 3 个 +1 力量指示物',
        effect: 'powerCounter',
        amount: 3,
        reason: 'sumo_wrestlers_technique_prize',
    });
}

function sumoPerformancePrize(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now) };
}

function sumoFightingSpiritPrize(ctx: AbilityContext): AbilityResult {
    return runMinionEffect(ctx, collectOwnMinions(ctx.state, ctx.playerId), {
        sourceId: 'sumo_wrestlers_fighting_spirit_prize',
        sourceDefId: 'sumo_wrestlers_fighting_spirit_prize',
        title: '斗志奖：分配 2 个 +1 力量指示物',
        effect: 'powerCounter',
        amount: 1,
        reason: 'sumo_wrestlers_fighting_spirit_prize',
        drawAfter: 2,
        multiMax: 2,
        singleGetsAll: true,
    });
}

const sumoHeadButtPrompt = createPromptProgram<SumoHeadButtContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_head_butt',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sumo_wrestlers_head_butt_${context.now}`,
        context.playerId,
        '头槌：选择要摧毁的另一位玩家行动',
        buildBoardActionOptions(context.matchState.core, context.candidates),
        {
            sourceId: 'sumo_wrestlers_head_butt',
            targetType: 'ongoing',
            titleKey: 'ui.sumo_wrestlers_head_butt_title',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as OngoingActionChoice | undefined;
        if (!selected?.cardUid || typeof selected.baseIndex !== 'number') return { events: [] };
        const target = context.candidates.find(candidate =>
            candidate.uid === selected.cardUid
            && candidate.baseIndex === selected.baseIndex
            && getActionControllerId(candidate) !== context.playerId);
        if (!target) return { events: [] };
        return {
            events: buildValidatedOngoingDetachEvents(state.core, {
                cardUid: target.uid,
                reason: 'sumo_wrestlers_head_butt',
                now: timestamp,
                expectedLocation: 'any',
                sourcePlayerId: context.playerId,
                sourceDefId: 'sumo_wrestlers_head_butt',
                sourceControllerId: context.playerId,
                sourceBaseIndex: target.baseIndex,
            }),
        };
    },
});

function sumoHeadButt(ctx: AbilityContext): AbilityResult {
    const basesWithOwnMinions = ctx.state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => canSeeOwnMinionOnBase(ctx.state, ctx.playerId, baseIndex));
    const candidates = basesWithOwnMinions.flatMap(baseIndex =>
        collectOtherPlayerActionsAtBase(ctx.state, ctx.playerId, baseIndex),
    );
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(sumoHeadButtPrompt, createPromptContext(
        ctx.matchState,
        ctx.playerId,
        ctx.now,
        { candidates },
    )));
}

function buildOutForTheCountEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    selected: OutForTheCountChoice,
    timestamp: number,
): SmashUpEvent[] {
    if (!selected.minionUid || typeof selected.baseIndex !== 'number' || !selected.actionUid) return [];
    const liveMinion = state.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
    const ownAction = liveMinion?.attachedActions.find(action =>
        action.uid === selected.actionUid
        && getActionControllerId(action) === playerId);
    if (!liveMinion || !ownAction) return [];
    return {
        events: [
            buildOngoingDetachedEvent({
                cardUid: ownAction.uid,
                defId: ownAction.defId,
                ownerId: ownAction.ownerId,
                reason: 'luchadors_out_for_the_count_return_action',
                destination: 'hand',
                now: timestamp,
            }),
            ...buildValidatedDestroyEvents(state, {
                minionUid: liveMinion.uid,
                minionDefId: liveMinion.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'luchadors_out_for_the_count',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'luchadors_out_for_the_count',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
                sourceKind: 'action',
            }),
        ],
    }.events;
}

function buildSearchCardToHandEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    selected: CardChoice,
    reason: string,
    random: { shuffle<T>(items: T[]): T[] },
    timestamp: number,
): SmashUpEvent[] {
    if (!selected.cardUid || !selected.defId) return [];
    const player = state.players[playerId];
    if (!player) return [];
    if (selected.zone === 'discard') {
        const card = player.discard.find(entry => entry.uid === selected.cardUid && entry.defId === selected.defId);
        return card ? [recoverCardsFromDiscard(playerId, [card.uid], reason, timestamp)] : [];
    }
    if (selected.zone === 'deck') {
        const card = player.deck.find(entry => entry.uid === selected.cardUid && entry.defId === selected.defId);
        if (!card) return [];
        const remainingDeck = random.shuffle(player.deck.filter(entry => entry.uid !== selected.cardUid));
        return [
            {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: 1, cardUids: [card.uid] },
                timestamp,
            } as SmashUpEvent,
            buildDeckReorderedEvent(playerId, remainingDeck.map(entry => entry.uid), timestamp),
        ];
    }
    return [];
}

function sumoBulkingStew(ctx: AbilityContext): AbilityResult {
    const candidates = collectOwnMinions(ctx.state, ctx.playerId);
    const discardable = getDiscardableHandCards(ctx.state, ctx.playerId, ctx.cardUid);
    if (candidates.length === 0 || discardable.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(bulkingStewDiscardPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceCardUid: ctx.cardUid,
        candidates,
    })));
}

function sumoBodySlam(ctx: AbilityContext): AbilityResult {
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        if (!canSeeOwnMinionOnBase(ctx.state, ctx.playerId, baseIndex)) continue;
        const opponentId = ctx.state.bases[baseIndex]?.minions.find(minion => minion.controller !== ctx.playerId)?.controller;
        if (!opponentId) continue;
        const toBaseIndex = getFirstOtherBaseIndex(ctx.state, baseIndex);
        if (toBaseIndex === undefined || toBaseIndex < 0) continue;
        const minionsToMove = ctx.state.bases[baseIndex].minions.filter(minion => minion.controller === opponentId);
        return {
            events: minionsToMove.flatMap(minion => buildValidatedMoveEvents(ctx.state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: baseIndex,
                toBaseIndex,
                reason: 'sumo_wrestlers_body_slam',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'sumo_wrestlers_body_slam',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
                sourceKind: 'action',
            })),
        };
    }
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
}

function sumoChikaraMizu(ctx: AbilityContext): AbilityResult {
    const candidates = collectOwnMinions(ctx.state, ctx.playerId);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(chikaraMizuTargetPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        candidates,
        sourceCardUid: ctx.cardUid,
    })));
}

function sumoGraspTheBelt(ctx: AbilityContext): AbilityResult {
    const sourceBases = new Set(
        ctx.state.bases
            .map((_base, baseIndex) => baseIndex)
            .filter(baseIndex => canSeeOwnMinionOnBase(ctx.state, ctx.playerId, baseIndex)),
    );
    const candidates = collectMinions(ctx.state, (_minion, baseIndex) => sourceBases.has(baseIndex));
    return runMoveMinion(ctx, candidates, {
        sourceId: 'sumo_wrestlers_grasp_the_belt',
        sourceDefId: 'sumo_wrestlers_grasp_the_belt',
        title: '抓住腰带：选择要移动的随从',
        reason: 'sumo_wrestlers_grasp_the_belt',
    });
}

function sumoThirdTierTalent(ctx: AbilityContext): AbilityResult {
    const toBaseIndex = getFirstOtherBaseIndex(ctx.state, ctx.baseIndex);
    const candidates = collectOtherPlayersMinionsOnBase(ctx.state, ctx.playerId, ctx.baseIndex)
        .filter(candidate => {
            const minion = ctx.state.bases[candidate.baseIndex]?.minions.find(entry => entry.uid === candidate.uid);
            return !!minion && getEffectivePower(ctx.state, minion, candidate.baseIndex) <= 3;
        });
    return runMoveMinion(ctx, candidates, {
        sourceId: 'sumo_wrestlers_third_tier',
        sourceDefId: 'sumo_wrestlers_third_tier',
        title: '关胁：选择这里力量 3 或以下的其他玩家随从',
        reason: 'sumo_wrestlers_third_tier',
        drawAfter: 1,
        fixedToBaseIndex: toBaseIndex !== undefined && toBaseIndex >= 0 ? toBaseIndex : undefined,
    });
}

function sumoTopTierOnCardsDiscarded(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.playerId !== ctx.sourceControllerId || ctx.discardedFromZone !== 'hand') return [];
    if (!ctx.discardedCards || ctx.discardedCards.length === 0) return [];
    return [addPowerCounter(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'sumo_wrestlers_top_tier', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceDefId: 'sumo_wrestlers_top_tier',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

const rookieSumoTargetPrompt = createPromptProgram<RookieSumoTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_rookie_sumo_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sumo_wrestlers_rookie_sumo_target_${context.now}`,
        context.playerId,
        '相扑新人：选择一个己方随从放置 2 个力量指示物',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'sumo_wrestlers_rookie_sumo',
            effectType: 'buff',
        }),
        {
            sourceId: 'sumo_wrestlers_rookie_sumo_target',
            targetType: 'minion',
            titleKey: 'ui.sumo_wrestlers_rookie_sumo_target_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        const selectedCard = state.core.players[context.playerId]?.hand.find(card => card.uid === context.selectedCardUid);
        if (!selectedCard) return { events: [] };
        const target = collectOwnMinions(state.core, context.playerId).find(candidate =>
            candidate.uid === selected.minionUid
            && candidate.baseIndex === selected.baseIndex);
        if (!target) return { events: [] };
        return {
            events: [
                buildCardsDiscardedEvent(context.playerId, [selectedCard.uid], timestamp),
                addPowerCounter(target.uid, target.baseIndex, 2, 'sumo_wrestlers_rookie_sumo', timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'sumo_wrestlers_rookie_sumo',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: target.baseIndex,
                }),
            ],
        };
    },
});

const rookieSumoDiscardPrompt = createPromptProgram<RookieSumoDiscardContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sumo_wrestlers_rookie_sumo_discard',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sumo_wrestlers_rookie_sumo_discard_${context.now}`,
        context.playerId,
        '相扑新人：选择要弃掉的手牌',
        buildHandCardOptions(context.matchState.core.players[context.playerId]?.hand ?? []),
        {
            sourceId: 'sumo_wrestlers_rookie_sumo_discard',
            targetType: 'hand',
            titleKey: 'ui.sumo_wrestlers_rookie_sumo_discard_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as CardChoice;
        if (!selected.cardUid) return { events: [] };
        const selectedCard = state.core.players[context.playerId]?.hand.find(card => card.uid === selected.cardUid);
        if (!selectedCard) return { events: [] };
        const candidates = collectOwnMinions(state.core, context.playerId);
        if (candidates.length === 0) return { events: [] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                selectedCardUid: selectedCard.uid,
                candidates,
            } satisfies RookieSumoTargetContext,
            nextProgram: rookieSumoTargetPrompt,
        };
    },
});

function sumoRookieSumoTalent(ctx: AbilityContext): AbilityResult {
    const hasDiscardCandidate = (ctx.state.players[ctx.playerId]?.hand.length ?? 0) > 0;
    const candidates = collectOwnMinions(ctx.state, ctx.playerId);
    if (!hasDiscardCandidate || candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(rookieSumoDiscardPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            candidates,
        })));
    }
    return { events: [] };
}

function musketeersEnGarde(ctx: AbilityContext): AbilityResult {
    return runMinionEffect(ctx, collectMinions(ctx.state, () => true), {
        sourceId: 'musketeers_en_garde',
        sourceDefId: 'musketeers_en_garde',
        title: '预备姿势：选择一个随从直到回合结束 +1 力量',
        effect: 'tempPower',
        amount: 1,
        reason: 'musketeers_en_garde',
        drawAfter: 1,
    });
}

function musketeersOnARoll(ctx: AbilityContext): AbilityResult {
    return runExtraActionsRestrictedToMinion(ctx, collectMinions(ctx.state, () => true), {
        sourceId: 'musketeers_on_a_roll',
        sourceDefId: 'musketeers_on_a_roll',
        title: '连连获胜：选择一个随从作为额外行动影响目标',
        count: 2,
    });
}

function musketeersBidingTime(ctx: AbilityContext): AbilityResult {
    return runMinionEffect(ctx, collectMinions(ctx.state, () => true), {
        sourceId: 'musketeers_biding_time',
        sourceDefId: 'musketeers_biding_time',
        title: '等待时机：选择一个随从直到回合结束 +2 力量',
        effect: 'tempPower',
        amount: 2,
        reason: 'musketeers_biding_time',
        extraActionAfter: true,
        extraActionRestrictToSelected: true,
    });
}

function musketeersToBattle(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            queueMinionPlayEffect(ctx.playerId, 'grantExtraActionForPlayedMinion', 1, ctx.now, 'musketeers_to_battle'),
            grantExtraMinion(ctx.playerId, 'musketeers_to_battle', ctx.now, undefined, {
                playTiming: 'immediate',
                consumePendingMinionPlayEffectOnSkip: true,
            }),
        ],
    };
}

function musketeersMakeWay(ctx: AbilityContext): AbilityResult {
    const result = runMoveMinion(ctx, collectOwnMinions(ctx.state, ctx.playerId), {
        sourceId: 'musketeers_make_way',
        sourceDefId: 'musketeers_make_way',
        title: '让路：选择你的一个随从移动',
        reason: 'musketeers_make_way',
    });
    return { events: [...result.events, grantContextualExtraAction(ctx, 'musketeers_make_way')], matchState: result.matchState };
}

function musketeersOneForAll(ctx: AbilityContext): AbilityResult {
    const baseCandidates = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: getBaseLabel(ctx.state, baseIndex) }))
        .filter(base => collectOwnMinionsOnBase(ctx.state, ctx.playerId, base.baseIndex).length > 0);
    return runBaseEffect(ctx, baseCandidates, {
        sourceId: 'musketeers_one_for_all',
        title: '一为全：选择一个基地',
        effect: 'ownMinionsTempPower',
        amount: 1,
        reason: 'musketeers_one_for_all',
        extraActionAfter: true,
    });
}

function musketeersLastStand(ctx: AbilityContext): AbilityResult {
    const candidates = collectOwnMinionsOnBase(ctx.state, ctx.playerId, ctx.baseIndex);
    return runMinionEffect(ctx, candidates, {
        sourceId: 'musketeers_last_stand',
        sourceDefId: 'musketeers_last_stand',
        title: '最后一搏：选择计分基地上你的一个随从',
        effect: 'tempPower',
        amount: 2,
        reason: 'musketeers_last_stand',
        drawAfter: 1,
    });
}

function musketeersAllForOneOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, 'musketeers_all_for_one')] };
}

function musketeersAllForOneTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || !ctx.sourceCardUid || !ctx.affectEvent) return [];
    const host = findAttachedActionHost(ctx.state, ctx.sourceCardUid, ctx.sourceBaseIndex);
    if (!host || ctx.triggerMinionUid !== host.minion.uid) return [];
    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!actionDefId || actionDefId === 'musketeers_all_for_one') return [];
    if (!isActionThatDirectlyAffectsMinion(actionDefId)) return [];
    if (resolveSourcePlayerIdFromEvent(ctx.affectEvent) !== ctx.sourceControllerId) return [];
    const nextMarkers = [
        ...getAllForOneDestroyMarkers(host.minion).filter(marker => marker.cardUid !== ctx.sourceCardUid),
        { cardUid: ctx.sourceCardUid, sourcePlayerId: ctx.sourceControllerId, turnNumber: ctx.state.turnNumber },
    ];
    return [
        addTempPower(host.minion.uid, host.baseIndex, 1, 'musketeers_all_for_one', ctx.now, {
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: 'musketeers_all_for_one',
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: host.baseIndex,
        }),
        buildMinionMetadataUpdatedEvent(
            host.minion.uid,
            host.baseIndex,
            { [MUSKETEERS_ALL_FOR_ONE_DESTROY_META]: nextMarkers },
            'musketeers_all_for_one_mark_destroy',
            ctx.now,
        ),
    ];
}

function musketeersAllForOneTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.playerId || !ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    const host = findAttachedActionHost(ctx.state, ctx.sourceCardUid, ctx.sourceBaseIndex);
    if (!host) return [];
    const markers = getAllForOneDestroyMarkers(host.minion);
    const shouldDestroy = markers.some(marker =>
        marker.cardUid === ctx.sourceCardUid
        && marker.sourcePlayerId === ctx.playerId
        && marker.turnNumber === ctx.state.turnNumber,
    );
    if (!shouldDestroy) return [];
    return [
        ...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: ctx.sourceCardUid,
            reason: 'musketeers_all_for_one_turn_end_destroy',
            now: ctx.now,
            expectedLocation: 'minion',
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: 'musketeers_all_for_one',
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: host.baseIndex,
        }),
        buildMinionMetadataUpdatedEvent(
            host.minion.uid,
            host.baseIndex,
            {
                [MUSKETEERS_ALL_FOR_ONE_DESTROY_META]: markers.filter(marker => marker.cardUid !== ctx.sourceCardUid),
            },
            'musketeers_all_for_one_clear_destroy_mark',
            ctx.now,
        ),
    ];
}

function musketeerActionAffectsThisMinion(ctx: TriggerContext): boolean {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.affectEvent) return false;
    if (ctx.triggerMinionUid !== ctx.sourceCardUid) return false;
    if (resolveSourcePlayerIdFromEvent(ctx.affectEvent) !== ctx.sourceControllerId) return false;
    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    return isActionThatDirectlyAffectsMinion(actionDefId);
}

function musketeersAthosTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.affectEvent) return [];
    if (ctx.triggerMinionUid === ctx.sourceCardUid) return [];
    if (resolveSourcePlayerIdFromEvent(ctx.affectEvent) !== ctx.sourceControllerId) return [];
    if (ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isActionThatDirectlyAffectsMinion(actionDefId)) return [];
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return [];
    return [addTempPower(ctx.triggerMinionUid, ctx.baseIndex, 1, 'musketeers_athos', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceDefId: 'musketeers_athos',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

function musketeersDartagnanTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || !musketeerActionAffectsThisMinion(ctx)) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function musketeersYoungMusketeerTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !musketeerActionAffectsThisMinion(ctx)) return [];
    const sourceMinion = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!sourceMinion) return [];
    const usedTurn = Number(sourceMinion.metadata?.[MUSKETEER_ACTION_TRIGGERED_TURN_META] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return [];
    return [
        buildMinionMetadataUpdatedEvent(
            sourceMinion.uid,
            ctx.sourceBaseIndex,
            { [MUSKETEER_ACTION_TRIGGERED_TURN_META]: ctx.state.turnNumber },
            'musketeers_young_musketeer_once_per_turn',
            ctx.now,
        ),
        addTempPower(sourceMinion.uid, ctx.sourceBaseIndex, 1, 'musketeers_young_musketeer', ctx.now),
    ];
}

function musketeersAramisTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !musketeerActionAffectsThisMinion(ctx)) return [];
    const currentPlayerId = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
    if (currentPlayerId !== ctx.sourceControllerId) return [];
    const sourceMinion = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!sourceMinion) return [];
    const usedTurn = Number(sourceMinion.metadata?.[MUSKETEER_ACTION_TRIGGERED_TURN_META] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return [];
    return [
        buildMinionMetadataUpdatedEvent(
            sourceMinion.uid,
            ctx.sourceBaseIndex,
            { [MUSKETEER_ACTION_TRIGGERED_TURN_META]: ctx.state.turnNumber },
            'musketeers_aramis_once_per_turn',
            ctx.now,
        ),
        grantContextualExtraAction(
            { playerId: ctx.sourceControllerId, now: ctx.now, matchState: ctx.matchState },
            'musketeers_aramis',
            { playTiming: 'immediate', restrictToMinionUid: sourceMinion.uid },
        ),
    ];
}

function canTriggerMusketeersAramis(ctx: TriggerContext): boolean {
    if (!ctx.sourceControllerId || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !musketeerActionAffectsThisMinion(ctx)) return false;
    const currentPlayerId = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
    if (currentPlayerId !== ctx.sourceControllerId) return false;
    const sourceMinion = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!sourceMinion) return false;
    return Number(sourceMinion.metadata?.[MUSKETEER_ACTION_TRIGGERED_TURN_META] ?? -1) !== ctx.state.turnNumber;
}

function mountiesWhenCallsTheBadge(ctx: AbilityContext): AbilityResult {
    const baseCandidates = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: getBaseLabel(ctx.state, baseIndex) }))
        .filter(base => collectOwnMinionsOnBase(ctx.state, ctx.playerId, base.baseIndex).length > 0);
    return runBaseEffect(ctx, baseCandidates, {
        sourceId: 'mounties_when_calls_the_badge',
        title: '呼叫警徽：选择一个基地给你的每个随从 +1 指示物',
        effect: 'ownMinionsPowerCounter',
        amount: 1,
        reason: 'mounties_when_calls_the_badge',
    });
}

function mountiesPowerPoutine(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const candidates = collectOwnMinionsOnBase(ctx.state, ctx.playerId, baseIndex);
    return runMinionEffect(ctx, candidates, {
        sourceId: 'mounties_power_poutine',
        sourceDefId: 'mounties_power_poutine',
        title: '力量肉汁薯条：选择至多两个你的随从 +2 力量',
        effect: 'tempPower',
        amount: 2,
        reason: 'mounties_power_poutine',
        multiMax: 2,
        multiMin: 0,
    });
}

function mountiesMoveAboot(ctx: AbilityContext): AbilityResult {
    const destinationBases = ctx.state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => ctx.state.bases[baseIndex].minions.some(minion => minion.controller !== ctx.playerId));
    const candidates = collectOwnMinions(ctx.state, ctx.playerId)
        .filter(candidate => destinationBases.some(baseIndex => baseIndex !== candidate.baseIndex));
    return runMoveMinion(ctx, destinationBases.length === 1
        ? candidates.filter(candidate => candidate.baseIndex !== destinationBases[0])
        : candidates, {
        sourceId: 'mounties_move_aboot',
        sourceDefId: 'mounties_move_aboot',
        title: '挪过去：选择要移动的己方随从',
        reason: 'mounties_move_aboot',
        tempPowerAfter: 2,
        allowedToBaseIndices: destinationBases,
    });
}

function mountiesAlwaysGetOurMan(ctx: AbilityContext): AbilityResult {
    for (const own of collectOwnMinions(ctx.state, ctx.playerId)) {
        const ownMinion = ctx.state.bases[own.baseIndex]?.minions.find(minion => minion.uid === own.uid);
        if (!ownMinion) continue;
        for (let targetBaseIndex = 0; targetBaseIndex < ctx.state.bases.length; targetBaseIndex += 1) {
            if (targetBaseIndex === own.baseIndex) continue;
            const target = ctx.state.bases[targetBaseIndex].minions.find(minion =>
                minion.controller !== ctx.playerId
                && getEffectivePower(ctx.state, minion, targetBaseIndex) < getEffectivePower(ctx.state, ownMinion, own.baseIndex),
            );
            if (!target) continue;
            const moveEvents = buildValidatedMoveEvents(ctx.state, {
                minionUid: ownMinion.uid,
                minionDefId: ownMinion.defId,
                fromBaseIndex: own.baseIndex,
                toBaseIndex: targetBaseIndex,
                reason: 'mounties_always_get_our_man',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'mounties_always_get_our_man',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: own.baseIndex,
                sourceKind: 'action',
            });
            return {
                events: [
                    ...moveEvents,
                    buildMinionMetadataUpdatedEvent(target.uid, targetBaseIndex, {
                        [MOUNTIES_ALWAYS_GET_OUR_MAN_META]: {
                            sourcePlayerId: ctx.playerId,
                            sourceDefId: 'mounties_always_get_our_man',
                            turnNumber: ctx.state.turnNumber,
                        },
                    }, 'mounties_always_get_our_man_mark', ctx.now),
                ],
            };
        }
    }
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
}

function mountiesAlwaysGetOurManTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        for (const minion of ctx.state.bases[baseIndex].minions) {
            const marker = minion.metadata?.[MOUNTIES_ALWAYS_GET_OUR_MAN_META] as
                | { sourcePlayerId?: PlayerId; sourceDefId?: string; turnNumber?: number }
                | undefined;
            if (!marker || marker.sourcePlayerId !== ctx.playerId || marker.turnNumber !== ctx.state.turnNumber) continue;
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: baseIndex,
                destroyerId: ctx.playerId,
                reason: 'mounties_always_get_our_man',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: marker.sourceDefId ?? 'mounties_always_get_our_man',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
                sourceKind: 'action',
            }));
        }
    }
    return events;
}

function mountiesNorthernMoverTalent(ctx: AbilityContext): AbilityResult {
    const candidates = collectOwnMinions(ctx.state, ctx.playerId).filter(candidate => candidate.uid !== ctx.cardUid);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(northernMoverTargetPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        candidates,
    })));
}

function mountiesWarCanuckTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base?.minions.some(minion => minion.controller !== ctx.playerId)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    return {
        events: [addPermanentPower(ctx.cardUid, ctx.baseIndex, 2, 'mounties_war_canuck', ctx.now, {
            expiresOnTurnNumber: nextPlayerTurnStartExpiration(ctx.state, ctx.playerId),
            expiresOnPlayerId: ctx.playerId,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: 'mounties_war_canuck',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        })],
    };
}

function mountiesDudleeTalent(ctx: AbilityContext): AbilityResult {
    const destinationBases = ctx.state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => baseIndex !== ctx.baseIndex && ctx.state.bases[baseIndex].minions.some(minion => minion.controller !== ctx.playerId));
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!self || destinationBases.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(moveDestinationPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceId: 'mounties_dudlee',
        sourceDefId: 'mounties_dudlee',
        minionUid: self.uid,
        minionDefId: self.defId,
        fromBaseIndex: ctx.baseIndex,
        reason: 'mounties_dudlee',
        tempPowerAfter: 1,
        allowedToBaseIndices: destinationBases,
    })));
}

const haichQMovePrompt = createPromptProgram<HaichQMoveContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mounties_haich_q_move',
    buildInteraction: (context) => {
        const candidates = collectOwnMinions(context.matchState.core, context.playerId)
            .filter(candidate => candidate.baseIndex === context.sourceBaseIndex || context.sourceBaseIndex !== candidate.baseIndex);
        return createAbilityRuntimeSimpleChoice(
            `mounties_haich_q_move_${context.now}`,
            context.playerId,
            'Haich-Q：选择一个己方随从移到此基地或从此基地移走',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'mounties_haich_q',
                effectType: 'move',
            }),
            { sourceId: 'mounties_haich_q_move', targetType: 'minion' , titleKey: 'ui.mounties_haich_q_move_title'},
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const fixedToBaseIndex = selected.baseIndex === context.sourceBaseIndex ? undefined : context.sourceBaseIndex;
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: timestamp,
                sourceId: 'mounties_haich_q',
                sourceDefId: 'mounties_haich_q',
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                reason: 'mounties_haich_q',
                fixedToBaseIndex,
            } satisfies MoveDestinationContext,
            nextProgram: moveDestinationPrompt,
        };
    },
});

function mountiesHaichQTalent(ctx: AbilityContext): AbilityResult {
    const candidates = collectOwnMinions(ctx.state, ctx.playerId);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(haichQMovePrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceBaseIndex: ctx.baseIndex,
        sourceCardUid: ctx.cardUid,
    })));
}

function mountiesEhSpecial(ctx: AbilityContext): AbilityResult {
    const candidates = collectOwnMinions(ctx.state, ctx.playerId);
    const effect = runMinionEffect(ctx, candidates, {
        sourceId: 'mounties_eh',
        sourceDefId: 'mounties_eh',
        title: '嗯？：选择你的一个随从直到回合结束 +1 力量',
        effect: 'tempPower',
        amount: 1,
        reason: 'mounties_eh',
    });
    return {
        events: [
            ...effect.events,
            {
                type: SU_EVENTS.DISCARD_ABILITY_USED,
                payload: { playerId: ctx.playerId, sourceId: 'mounties_eh' },
                timestamp: ctx.now,
            } as SmashUpEvent,
            recoverCardsFromDiscard(ctx.playerId, [ctx.cardUid], 'mounties_eh', ctx.now),
        ],
        matchState: effect.matchState,
    };
}

function luchadorsQuickSetUpOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, 'luchadors_quick_set_up')] };
}

const tagTeamBasePrompt = createPromptProgram<TagTeamBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'luchadors_tag_team_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `luchadors_tag_team_base_${context.now}`,
        context.playerId,
        '团队标记：选择额外随从要打出的基地',
        buildBaseTargetOptions(context.baseCandidates, context.matchState.core),
        {
            sourceId: 'luchadors_tag_team_base',
            targetType: 'base',
            titleKey: 'ui.luchadors_tag_team_base_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as BaseChoice;
        if (selected.baseIndex === undefined) return { events: [] };
        return {
            events: [grantContextualExtraMinion({
                playerId: context.playerId,
                now: timestamp,
                matchState: context.matchState,
            }, 'luchadors_tag_team', selected.baseIndex)],
        };
    },
});

const cheapPopPrompt = createPromptProgram<CheapPopContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'luchadors_cheap_pop',
    buildInteraction: (context) => {
        const options = buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'luchadors_cheap_pop',
            effectType: 'buff',
        }).map(option => {
            const candidate = context.candidates.find(entry => entry.uid === option.value.minionUid);
            const amount = candidate?.amount ?? 2;
            return {
                ...option,
                label: `${option.label}（+${amount}）`,
                value: { ...option.value, amount },
            };
        });
        return createAbilityRuntimeSimpleChoice(
            `luchadors_cheap_pop_${context.now}`,
            context.playerId,
            '廉价欢呼：选择你的一个随从',
            options,
            {
                sourceId: 'luchadors_cheap_pop',
                targetType: 'minion',
                titleKey: 'ui.luchadors_cheap_pop_title',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selected = value as MinionChoice & { amount?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [addTempPower(
                selected.minionUid,
                selected.baseIndex,
                selected.amount ?? 2,
                'luchadors_cheap_pop',
                timestamp,
            )],
        };
    },
});

function luchadorsCheapPop(ctx: AbilityContext): AbilityResult {
    const candidates = collectOwnMinions(ctx.state, ctx.playerId);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const boosted = candidates.map(candidate => {
        const base = ctx.state.bases[candidate.baseIndex];
        const hasSetup = base.minions.some(minion => minionHasSetUpAction(minion));
        return { ...candidate, amount: hasSetup ? 4 : 2 };
    });
    if (!ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(cheapPopPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        candidates: boosted,
    })));
}

function luchadorsTagTeam(ctx: AbilityContext): AbilityResult {
    const baseCandidates = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: getBaseLabel(ctx.state, baseIndex) }))
        .filter(candidate => canSeeOwnMinionOnBase(ctx.state, ctx.playerId, candidate.baseIndex));
    if (baseCandidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(tagTeamBasePrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        baseCandidates,
    })));
}

const muchoslamRecoverActionPrompt = createPromptProgram<MuchoslamRecoverActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'luchadors_senor_muchoslam',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `luchadors_senor_muchoslam_${context.now}`,
        context.playerId,
        '穆乔摔先生：选择要从弃牌堆回收的行动',
        context.candidates.map((card, index) => ({
            id: `discard-${index}`,
            label: card.label,
            value: { cardUid: card.cardUid, defId: card.defId, zone: 'discard' },
            displayMode: 'card' as const,
            _source: 'discard' as const,
        })),
        {
            sourceId: 'luchadors_senor_muchoslam',
            targetType: 'discard',
            titleKey: 'ui.luchadors_senor_muchoslam_recover_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as CardChoice;
        if (!selected.cardUid) return { events: [] };
        const selectedAction = state.core.players[context.playerId]?.discard.find(card =>
            card.uid === selected.cardUid
            && getCardDef(card.defId)?.type === 'action');
        if (!selectedAction) return { events: [] };
        return {
            events: [recoverCardsFromDiscard(context.playerId, [selectedAction.uid], 'luchadors_senor_muchoslam', timestamp)],
        };
    },
});

function luchadorsSenorMuchoslamOnPlay(ctx: AbilityContext): AbilityResult {
    const discardActions = ctx.state.players[ctx.playerId]?.discard.filter(card => getCardDef(card.defId)?.type === 'action') ?? [];
    if (discardActions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(muchoslamRecoverActionPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            candidates: discardActions.map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                zone: 'discard' as const,
                label: getCardDef(card.defId)?.name ?? card.defId,
            })),
        })));
    }
    return { events: [] };
}

function luchadorsSenorMuchoslamTalent(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, 'luchadors_senor_muchoslam')] };
}

const reversalDestroyActionsPrompt = createPromptProgram<ReversalDestroyActionsContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'luchadors_reversal_destroy_actions',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `luchadors_reversal_destroy_actions_${context.now}`,
        context.playerId,
        '逆转：选择任意数量你的 Set-Up 行动摧毁',
        context.candidates.map((action, index) => ({
            id: `ongoing-${index}`,
            label: getCardDef(action.defId)?.name ?? action.defId,
            value: { cardUid: action.uid, defId: action.defId },
            displayMode: 'card' as const,
            _source: 'ongoing' as const,
        })),
        {
            sourceId: 'luchadors_reversal_destroy_actions',
            targetType: 'ongoing',
            multi: { min: 0, max: context.candidates.length },
            titleKey: 'ui.luchadors_reversal_destroy_actions_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = (Array.isArray(value) ? value : [value]) as CardChoice[];
        const selectedCardUids = new Set(selected
            .map(card => card.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string'));
        const target = state.core.bases[context.targetBaseIndex]?.minions.find(minion => minion.uid === context.targetMinionUid);
        if (!target) return { events: [] };
        const controlEvents = buildMinionControlChangedEvents(state.core, {
            minionUid: target.uid,
            minionDefId: target.defId,
            baseIndex: context.targetBaseIndex,
            toControllerId: context.playerId,
            sourcePlayerId: context.playerId,
            sourceDefId: 'luchadors_reversal',
            reason: 'luchadors_reversal',
            now: timestamp,
        });
        if (controlEvents.length === 0) return { events: [] };
        return {
            events: [
                ...controlEvents,
                buildMinionMetadataUpdatedEvent(target.uid, context.targetBaseIndex, {
                    [LUCHADORS_REVERSAL_CONTROL_META]: {
                        sourcePlayerId: context.playerId,
                        originalControllerId: target.controller,
                        turnNumber: state.core.turnNumber,
                    },
                }, 'luchadors_reversal_mark', timestamp),
                ...context.candidates
                    .filter(action => selectedCardUids.has(action.uid))
                    .flatMap(action => buildValidatedOngoingDetachEvents(state.core, {
                        cardUid: action.uid,
                        reason: 'luchadors_reversal_destroy_actions',
                        now: timestamp,
                        expectedLocation: 'minion',
                        sourcePlayerId: context.playerId,
                        sourceDefId: 'luchadors_reversal',
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: context.targetBaseIndex,
                    })),
            ],
        };
    },
});

function luchadorsReversal(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const ownPower = getPlayerEffectivePowerOnBase(ctx.state, base, ctx.baseIndex, ctx.playerId);
    const bestPower = Math.max(...ctx.state.turnOrder.map(playerId =>
        getPlayerEffectivePowerOnBase(ctx.state, base, ctx.baseIndex, playerId),
    ));
    if (ownPower >= bestPower) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    const target = base.minions.find(minion =>
        minion.controller !== ctx.playerId
        && minionHasSetUpActionControlledBy(minion, ctx.playerId),
    );
    if (!target) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const ownAttachedActions = target.attachedActions.filter(action => getActionControllerId(action) === ctx.playerId);
    return runtimeToAbilityResult(executeAbilityProgram(reversalDestroyActionsPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        targetMinionUid: target.uid,
        targetBaseIndex: ctx.baseIndex,
        candidates: ownAttachedActions.map(action => ({
            uid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            baseIndex: ctx.baseIndex,
        })),
    })));
}

function luchadorsReversalTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        for (const minion of ctx.state.bases[baseIndex].minions) {
            const marker = minion.metadata?.[LUCHADORS_REVERSAL_CONTROL_META] as
                | { sourcePlayerId?: PlayerId; originalControllerId?: PlayerId; turnNumber?: number }
                | undefined;
            if (!marker || marker.sourcePlayerId !== ctx.playerId || marker.turnNumber !== ctx.state.turnNumber) continue;
            if (!marker.originalControllerId || minion.controller === marker.originalControllerId) continue;
            events.push(...buildMinionControlChangedEvents(ctx.state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                baseIndex,
                toControllerId: marker.originalControllerId,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'luchadors_reversal',
                reason: 'luchadors_reversal_restore',
                now: ctx.now,
            }));
        }
    }
    return events;
}

const muchoslamVsMonstersPrompt = createPromptProgram<MuchoslamVsMonstersContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'luchadors_senor_muchoslam_vs_the_monsters',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `luchadors_senor_muchoslam_vs_the_monsters_${context.now}`,
        context.playerId,
        '穆乔摔先生大战怪物：选择任意数量弃牌堆行动',
        context.candidates.map((card, index) => ({
            id: `discard-${index}`,
            label: card.label,
            value: { cardUid: card.cardUid, defId: card.defId, zone: 'discard' },
            displayMode: 'card' as const,
            _source: 'discard' as const,
        })),
        {
            sourceId: 'luchadors_senor_muchoslam_vs_the_monsters',
            targetType: 'discard',
            multi: { min: 0, max: context.candidates.length },
            titleKey: 'ui.luchadors_senor_muchoslam_vs_the_monsters_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp, random }) => {
        const selected = (Array.isArray(value) ? value : [value]) as CardChoice[];
        const selectedCardUids = [...new Set(selected
            .map(card => card.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string'))];
        if (selectedCardUids.length === 0) return { events: [] };
        const player = state.core.players[context.playerId];
        if (!player) return { events: [] };
        const selectedActions = player.discard.filter(card =>
            selectedCardUids.includes(card.uid)
            && getCardDef(card.defId)?.type === 'action',
        );
        if (selectedActions.length === 0) return { events: [] };
        const playableOnMinion = selectedActions.find(card => {
            const def = getCardDef(card.defId);
            return def?.type === 'action' && (def.playNeedsMinion === true || def.ongoingTarget === 'minion');
        });
        const rest = selectedActions.filter(card => card.uid !== playableOnMinion?.uid);
        const shuffledRest = random.shuffle(rest);
        return {
            events: [
                ...(playableOnMinion
                    ? [recoverCardsFromDiscard(context.playerId, [playableOnMinion.uid], 'luchadors_senor_muchoslam_vs_the_monsters', timestamp)]
                    : []),
                ...(shuffledRest.length > 0
                    ? [buildDeckReorderedEvent(context.playerId, [
                        ...player.deck.map(card => card.uid),
                        ...shuffledRest.map(card => card.uid),
                    ], timestamp)]
                    : []),
            ],
        };
    },
});

function luchadorsSenorMuchoslamVsTheMonsters(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const discardActions = player?.discard.filter(card => getCardDef(card.defId)?.type === 'action') ?? [];
    if (!player || discardActions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(muchoslamVsMonstersPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        candidates: discardActions.map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            zone: 'discard' as const,
            label: getCardDef(card.defId)?.name ?? card.defId,
        })),
    })));
}

const searchActionPrompt = createPromptProgram<SearchActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'international_incident_search_action',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            createSkipOption(),
            ...context.candidates.map((card, index) => ({
                id: `${card.zone}-${index}`,
                label: card.label,
                value: { cardUid: card.cardUid, defId: card.defId, zone: card.zone },
                displayMode: 'card' as const,
                _source: card.zone,
            })),
        ],
        { sourceId: 'international_incident_base_move', targetType: 'generic' },
    ),
    onResolve: ({ state, context, value, timestamp, random }) => {
        const selected = value as CardChoice;
        if (selected.skip || !selected.cardUid || !selected.defId) return { events: [] };
        const searchEvents = buildSearchCardToHandEvents(state.core, context.playerId, selected, context.sourceId, random, timestamp);
        if (searchEvents.length === 0) return { events: [] };
        return {
            events: [
                ...searchEvents,
                ...(context.extraActionAfter
                    ? [grantContextualExtraAction(
                        { playerId: context.playerId, now: timestamp, matchState: context.matchState },
                        context.sourceId,
                    )]
                    : []),
            ],
        };
    },
});

const capaRojaTargetPrompt = createPromptProgram<CapaRojaTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'luchadors_capa_roja',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.sourceBaseIndex];
        const candidates = (base?.minions ?? [])
            .filter(minion => minion.controller !== context.playerId)
            .filter(minion => getPrintedPower(context.matchState.core, minion, context.sourceBaseIndex) <= 3)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.sourceBaseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        const minionOptions = buildMinionTargetOptions(candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'luchadors_capa_roja',
            sourceKind: 'nonAction',
            effectType: 'destroy',
        });
        const distinctControllers = new Set(
            minionOptions
                .map(option => base?.minions.find(minion => minion.uid === option.value.minionUid)?.controller)
                .filter((controller): controller is PlayerId => typeof controller === 'string'),
        );
        return createAbilityRuntimeSimpleChoice(
            `luchadors_capa_roja_${context.sourceCardUid ?? 'source'}_${context.now}`,
            context.playerId,
            'Capa Roja：选择每位其他玩家至多一个印制力量 3 或以下随从',
            [
                createSkipOption('跳过（不消灭随从）', 'ui.international_incident_skip_destroy_minion_option'),
                ...minionOptions,
            ],
            {
                sourceId: 'luchadors_capa_roja',
                targetType: 'minion',
                multi: { min: 0, max: Math.max(distinctControllers.size, 1) },
                titleKey: 'ui.luchadors_capa_roja_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        const seenControllers = new Set<PlayerId>();
        const events: SmashUpEvent[] = [];
        for (const pick of selected) {
            if (pick.skip || !pick.minionUid || pick.baseIndex !== context.sourceBaseIndex) continue;
            const minion = state.core.bases[context.sourceBaseIndex]?.minions.find(entry => entry.uid === pick.minionUid);
            if (!minion || minion.controller === context.playerId || seenControllers.has(minion.controller)) continue;
            if (getPrintedPower(state.core, minion, context.sourceBaseIndex) > 3) continue;
            seenControllers.add(minion.controller);
            events.push(...buildValidatedDestroyEvents(state.core, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: context.sourceBaseIndex,
                destroyerId: context.playerId,
                reason: 'luchadors_capa_roja',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: 'luchadors_capa_roja',
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.sourceBaseIndex,
                sourceKind: 'nonAction',
            }));
        }
        return { events };
    },
});

const heyaTrainingStablePrompt = createPromptProgram<HeyaTrainingStableContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_heya_training_stable',
    buildInteraction: (context) => {
        const hand = context.matchState.core.players[context.playerId]?.hand ?? [];
        const minions = collectOwnMinionsOnBase(context.matchState.core, context.playerId, context.sourceBaseIndex);
        const options = hand.flatMap((card, cardIndex) => minions.map((minion, minionIndex) => ({
            id: `heya-${cardIndex}-${minionIndex}`,
            label: `弃置 ${getCardDef(card.defId)?.name ?? card.defId}，给 ${minion.label} 放置 +1 指示物`,
            value: {
                cardUid: card.uid,
                defId: card.defId,
                minionUid: minion.uid,
                minionDefId: minion.defId,
                baseIndex: minion.baseIndex,
            },
            displayMode: 'button' as const,
        })));
        return createAbilityRuntimeSimpleChoice(
            `base_heya_training_stable_${context.playerId}_${context.now}`,
            context.playerId,
            '训练馆：可以弃 1 张牌给这里的己方随从放置 +1 指示物',
            [createSkipOption('跳过（不弃牌）', 'ui.international_incident_skip_discard_option'), ...options],
            { sourceId: 'base_heya_training_stable', targetType: 'generic' , titleKey: 'ui.base_heya_training_stable_title'},
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as HeyaTrainingStableChoice;
        if (selected.skip || !selected.cardUid || !selected.minionUid || selected.baseIndex !== context.sourceBaseIndex) {
            return { events: [] };
        }
        const card = state.core.players[context.playerId]?.hand.find(entry => entry.uid === selected.cardUid);
        const minion = state.core.bases[context.sourceBaseIndex]?.minions.find(entry => (
            entry.uid === selected.minionUid && entry.controller === context.playerId
        ));
        if (!card || !minion) return { events: [] };
        return {
            events: [
                buildCardsDiscardedEvent(context.playerId, [card.uid], timestamp),
                addPowerCounter(minion.uid, context.sourceBaseIndex, 1, 'base_heya_training_stable', timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'base_heya_training_stable',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                }),
            ],
        };
    },
});

const baseMovePrompt = createPromptProgram<BaseMovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'international_incident_base_move',
    interactionSourceIds: ['base_the_dohyo', 'base_strategic_syrup_reserve'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.playerId}_${context.now}`,
        context.playerId,
        context.title,
        [
            createSkipOption('跳过（不移动随从）', 'ui.international_incident_skip_move_minion_option'),
            ...context.candidates.map((candidate, index) => ({
                id: `move-${index}`,
                label: candidate.label,
                value: {
                    minionUid: candidate.minionUid,
                    minionDefId: candidate.minionDefId,
                    fromBaseIndex: candidate.fromBaseIndex,
                    toBaseIndex: candidate.toBaseIndex,
                },
                displayMode: 'button' as const,
            })),
        ],
        { sourceId: 'international_incident_base_move', targetType: 'generic' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseMoveChoice;
        if (
            selected.skip
            || !selected.minionUid
            || !selected.minionDefId
            || selected.fromBaseIndex === undefined
            || selected.toBaseIndex === undefined
        ) {
            return { events: [] };
        }
        if (!state.core.bases[selected.toBaseIndex]) return { events: [] };
        const minion = state.core.bases[selected.fromBaseIndex]?.minions.find(entry => (
            entry.uid === selected.minionUid
            && entry.defId === selected.minionDefId
            && entry.controller !== context.playerId
        ));
        if (!minion) return { events: [] };
        if (context.sourceId === 'base_the_dohyo' && selected.fromBaseIndex !== context.sourceBaseIndex) return { events: [] };
        if (context.sourceId === 'base_strategic_syrup_reserve') {
            if (selected.toBaseIndex !== context.sourceBaseIndex) return { events: [] };
            if (!canSeeOwnMinionOnBase(state.core, context.playerId, selected.fromBaseIndex)) return { events: [] };
        }
        return {
            events: buildValidatedMoveEvents(state.core, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.fromBaseIndex,
                toBaseIndex: selected.toBaseIndex,
                reason: context.sourceId,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.sourceBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    },
});

const greatWhiteNorthPrompt = createPromptProgram<GreatWhiteNorthContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_great_white_north_eh',
    buildInteraction: (context) => {
        const candidates = collectOwnMinionsOnBase(context.matchState.core, context.playerId, context.sourceBaseIndex);
        const destinationIndices = context.matchState.core.bases
            .map((_base, baseIndex) => baseIndex)
            .filter(baseIndex => baseIndex !== context.sourceBaseIndex);
        const options = candidates.flatMap((candidate, candidateIndex) => destinationIndices.map((toBaseIndex, destinationIndex) => ({
            id: `north-${candidateIndex}-${destinationIndex}`,
            label: `${candidate.label} → ${getBaseLabel(context.matchState.core, toBaseIndex)}`,
            value: {
                minionUid: candidate.uid,
                minionDefId: candidate.defId,
                fromBaseIndex: context.sourceBaseIndex,
                toBaseIndex,
            },
            displayMode: 'button' as const,
        })));
        return createAbilityRuntimeSimpleChoice(
            `base_great_white_north_eh_${context.playerId}_${context.now}`,
            context.playerId,
            '大白北方，嗯？：可以移动你在这里的一个随从并使其 +1',
            [createSkipOption('跳过（不移动随从）', 'ui.international_incident_skip_move_minion_option'), ...options],
            { sourceId: 'base_great_white_north_eh', targetType: 'generic' , titleKey: 'ui.base_great_white_north_eh_title'},
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseMoveChoice;
        const events: SmashUpEvent[] = [];
        if (
            !selected.skip
            && selected.minionUid
            && selected.minionDefId
            && selected.fromBaseIndex === context.sourceBaseIndex
            && selected.toBaseIndex !== undefined
            && selected.toBaseIndex !== context.sourceBaseIndex
            && state.core.bases[selected.toBaseIndex]
        ) {
            const minion = state.core.bases[context.sourceBaseIndex]?.minions.find(entry => (
                entry.uid === selected.minionUid
                && entry.defId === selected.minionDefId
                && entry.controller === context.playerId
            ));
            if (minion) {
                const moveEvents = buildValidatedMoveEvents(state.core, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: context.sourceBaseIndex,
                    toBaseIndex: selected.toBaseIndex,
                    reason: 'base_great_white_north_eh',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'base_great_white_north_eh',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                    sourceKind: 'nonAction',
                });
                events.push(...moveEvents);
                if (moveEvents.length > 0) {
                    events.push(addTempPower(minion.uid, selected.toBaseIndex, 1, 'base_great_white_north_eh', timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: 'base_great_white_north_eh',
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: selected.toBaseIndex,
                    }));
                }
            }
        }

        const [nextPlayerId, ...remainingPlayerIds] = context.remainingPlayerIds;
        if (!nextPlayerId) return { events };
        return {
            events,
            context: {
                matchState: state,
                playerId: nextPlayerId,
                now: timestamp,
                sourceBaseIndex: context.sourceBaseIndex,
                remainingPlayerIds,
            } satisfies GreatWhiteNorthContext,
            nextProgram: greatWhiteNorthPrompt,
        };
    },
});

function buildActionSearchCandidates(
    state: SmashUpCore,
    playerId: PlayerId,
    predicate: (card: CardInstance) => boolean,
): Array<CardChoice & { label: string }> {
    const player = state.players[playerId];
    if (!player) return [];
    return [
        ...player.deck.filter(predicate).map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            zone: 'deck' as const,
            label: getCardDef(card.defId)?.name ?? card.defId,
        })),
        ...player.discard.filter(predicate).map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            zone: 'discard' as const,
            label: getCardDef(card.defId)?.name ?? card.defId,
        })),
    ];
}

function luchadorsYellowDemon(ctx: AbilityContext): AbilityResult {
    const candidates = buildActionSearchCandidates(ctx.state, ctx.playerId, card => SET_UP_ACTION_IDS.has(card.defId));
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(searchActionPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceId: 'luchadors_yellow_demon',
        title: '黄色恶魔：选择一张 Set-Up 行动加入手牌',
        candidates,
    })));
}

function musketeersTokenOfAffection(ctx: AbilityContext): AbilityResult {
    const candidates = buildActionSearchCandidates(ctx.state, ctx.playerId, card => isActionThatDirectlyAffectsMinion(card.defId));
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(searchActionPrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceId: 'musketeers_token_of_affection',
        title: '情谊信物：选择一个直接影响随从的行动加入手牌',
        candidates,
        extraActionAfter: true,
    })));
}

const luchadorsOutForTheCountPrompt = createPromptProgram<OutForTheCountContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'luchadors_out_for_the_count',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `luchadors_out_for_the_count_${context.now}`,
        context.playerId,
        '点名出局：选择随从和要返回的行动',
        context.candidates.map((candidate, index) => ({
            id: `out-for-the-count-${index}`,
            label: candidate.label,
            value: candidate,
            displayMode: 'card' as const,
            _source: 'ongoing' as const,
        })),
        {
            sourceId: 'luchadors_out_for_the_count',
            targetType: 'ongoing',
            titleKey: 'ui.luchadors_out_for_the_count_title',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as OutForTheCountChoice | undefined;
        const candidate = context.candidates.find(entry =>
            entry.minionUid === selected?.minionUid
            && entry.actionUid === selected?.actionUid
            && entry.baseIndex === selected?.baseIndex);
        return { events: candidate ? buildOutForTheCountEvents(state.core, context.playerId, candidate, timestamp) : [] };
    },
});

function luchadorsOutForTheCount(ctx: AbilityContext): AbilityResult {
    const candidates = buildOutForTheCountChoices(ctx.state, ctx.playerId);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(luchadorsOutForTheCountPrompt, createPromptContext(
        ctx.matchState,
        ctx.playerId,
        ctx.now,
        { candidates },
    )));
}

function luchadorsSmartSetUpTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    if (ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    const sourceBase = ctx.state.bases[ctx.sourceBaseIndex];
    const host = sourceBase?.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.sourceCardUid));
    if (!host || host.controller === ctx.sourceControllerId) return [];
    const totalPlayedOnBase = ctx.state.turnOrder.reduce(
        (sum, playerId) => sum + (ctx.state.players[playerId]?.minionsPlayedPerBase?.[ctx.sourceBaseIndex!] ?? 0),
        0,
    );
    if (totalPlayedOnBase !== 1) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function mountiesBringEmInTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.moveToBaseIndex === undefined) return [];
    if (ctx.triggerMinionUid === undefined) return [];
    const movedMinion = ctx.state.bases[ctx.moveToBaseIndex]?.minions.find(minion => minion.uid === ctx.triggerMinionUid);
    if (!movedMinion?.attachedActions.some(action => action.uid === ctx.sourceCardUid)) return [];
    return [addPowerCounter(movedMinion.uid, ctx.moveToBaseIndex, 1, 'mounties_bring_em_in', ctx.now)];
}

function protectionHasYokozuna(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases.some(base => base.minions.some(minion =>
        minion.defId === 'sumo_wrestlers_yokozuna'
        && minion.controller === ctx.targetMinion.controller,
    ));
}

function porthosProtection(ctx: ProtectionCheckContext): boolean {
    return ctx.targetMinion.defId === 'musketeers_porthos'
        && ctx.sourcePlayerId !== ctx.targetMinion.controller
        && ctx.sourceKind === 'action';
}

function battleMooseProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.minions.some(minion =>
        minion.controller === ctx.targetMinion.controller
        && minion.attachedActions.some(action => action.defId === 'mounties_battle_moose'),
    );
}

function pinSuppression(state: SmashUpCore): string[] {
    const suppressed: string[] = [];
    for (const base of state.bases) {
        for (const minion of base.minions) {
            if (minion.attachedActions.some(action => action.defId === 'luchadors_pin')) {
                suppressed.push(minion.uid);
            }
        }
    }
    return suppressed;
}

function luchadorsCapaRojaBeforeScoring(ctx: TriggerContext) {
    if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    if (!ctx.matchState) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base) return [];
    const sourceBaseIndex = ctx.sourceBaseIndex;
    const candidates = base.minions.filter(minion => (
        minion.controller !== ctx.sourceControllerId
        && getPrintedPower(ctx.state, minion, sourceBaseIndex) <= 3
    ));
    if (candidates.length === 0) return [];
    return executeAbilityProgram(capaRojaTargetPrompt, createPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
        sourceBaseIndex,
        sourceCardUid: ctx.sourceCardUid,
    }));
}

function canTriggerLuchadorsCapaRojaBeforeScoring(ctx: TriggerContext): boolean {
    if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return false;
    if (!ctx.matchState) return false;
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base) return false;
    const sourceBaseIndex = ctx.sourceBaseIndex;
    return base.minions.some(minion =>
        minion.controller !== ctx.sourceControllerId
        && getPrintedPower(ctx.state, minion, sourceBaseIndex) <= 3,
    );
}

function baseHeyaTrainingStableTurnStart(ctx: TriggerContext) {
    if (ctx.sourceBaseIndex === undefined) return [];
    if (!ctx.matchState) return [];
    const hasCardToDiscard = (ctx.state.players[ctx.playerId]?.hand.length ?? 0) > 0;
    const hasTarget = collectOwnMinionsOnBase(ctx.state, ctx.playerId, ctx.sourceBaseIndex).length > 0;
    if (!hasCardToDiscard || !hasTarget) return [];
    return executeAbilityProgram(heyaTrainingStablePrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceBaseIndex: ctx.sourceBaseIndex,
    }));
}

function canTriggerBaseHeyaTrainingStableTurnStart(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || !ctx.matchState) return false;
    const hasCardToDiscard = (ctx.state.players[ctx.playerId]?.hand.length ?? 0) > 0;
    const hasTarget = collectOwnMinionsOnBase(ctx.state, ctx.playerId, ctx.sourceBaseIndex).length > 0;
    return hasCardToDiscard && hasTarget;
}

function baseTheDohyoMinionPlayed(ctx: TriggerContext) {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    if (!ctx.matchState) return [];
    const playedCount = ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.sourceBaseIndex] ?? 1;
    if (playedCount !== 1) return [];
    const destinationIndices = ctx.state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => baseIndex !== ctx.sourceBaseIndex);
    const candidates = collectOtherPlayersMinionsOnBase(ctx.state, ctx.playerId, ctx.sourceBaseIndex)
        .flatMap(target => destinationIndices.map(toBaseIndex => ({
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: ctx.sourceBaseIndex,
            toBaseIndex,
            label: `${target.label} → ${getBaseLabel(ctx.state, toBaseIndex)}`,
        })));
    if (candidates.length === 0) return [];
    return executeAbilityProgram(baseMovePrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceId: 'base_the_dohyo',
        title: '土俵：可以将这里另一位玩家的一个随从移动到另一个基地',
        sourceBaseIndex: ctx.sourceBaseIndex,
        candidates,
    }));
}

function canTriggerBaseTheDohyoMinionPlayed(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex || !ctx.matchState) return false;
    const playedCount = ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.sourceBaseIndex] ?? 1;
    if (playedCount !== 1) return false;
    const hasDestination = ctx.state.bases.some((_base, baseIndex) => baseIndex !== ctx.sourceBaseIndex);
    return hasDestination && collectOtherPlayersMinionsOnBase(ctx.state, ctx.playerId, ctx.sourceBaseIndex).length > 0;
}

function baseBastionSaintGervaisMinionAffected(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex || !ctx.affectEvent) return [];
    const actingPlayerId = resolveSourcePlayerIdFromEvent(ctx.affectEvent) ?? ctx.playerId;
    if (ctx.triggerMinion?.controller !== actingPlayerId) return [];
    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isActionThatDirectlyAffectsMinion(actionDefId)) return [];
    const key = `${BASE_BASTION_USED_TURN_META}_${actingPlayerId}`;
    if (ctx.state.bases[ctx.sourceBaseIndex]?.metadata?.[key] === ctx.state.turnNumber) return [];
    return [
        buildBaseMetadataUpdatedEvent(ctx.sourceBaseIndex, { [key]: ctx.state.turnNumber }, 'base_bastion_saint_gervais', ctx.now),
        grantContextualExtraAction({ playerId: actingPlayerId, now: ctx.now, matchState: ctx.matchState }, 'base_bastion_saint_gervais'),
    ];
}

function canTriggerBaseBastionSaintGervaisMinionAffected(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex || !ctx.affectEvent) return false;
    const actingPlayerId = resolveSourcePlayerIdFromEvent(ctx.affectEvent) ?? ctx.playerId;
    if (ctx.triggerMinion?.controller !== actingPlayerId) return false;
    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isActionThatDirectlyAffectsMinion(actionDefId)) return false;
    const key = `${BASE_BASTION_USED_TURN_META}_${actingPlayerId}`;
    return ctx.state.bases[ctx.sourceBaseIndex]?.metadata?.[key] !== ctx.state.turnNumber;
}

function baseTheGoldenLilyTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined) return [];
    if (!canSeeOwnMinionOnBase(ctx.state, ctx.playerId, ctx.sourceBaseIndex)) return [];
    return buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
}

function baseStrategicSyrupReserveMinionPlayed(ctx: TriggerContext) {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    if (!ctx.matchState) return [];
    const sourceBases = ctx.state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => baseIndex !== ctx.sourceBaseIndex && canSeeOwnMinionOnBase(ctx.state, ctx.playerId, baseIndex));
    const candidates = sourceBases.flatMap(baseIndex => ctx.state.bases[baseIndex].minions
        .filter(minion => minion.controller !== ctx.playerId)
        .map(minion => ({
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: baseIndex,
            toBaseIndex: ctx.sourceBaseIndex,
            label: `${getMinionLabel(ctx.state, minion, baseIndex)} → ${getBaseLabel(ctx.state, ctx.sourceBaseIndex!)}`,
        })));
    if (candidates.length === 0) return [];
    return executeAbilityProgram(baseMovePrompt, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceId: 'base_strategic_syrup_reserve',
        title: '战略枫糖储备：可以将另一位玩家的一个随从移动到这里',
        sourceBaseIndex: ctx.sourceBaseIndex,
        candidates,
    }));
}

function canTriggerBaseStrategicSyrupReserveMinionPlayed(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex || !ctx.matchState) return false;
    return ctx.state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => baseIndex !== ctx.sourceBaseIndex && canSeeOwnMinionOnBase(ctx.state, ctx.playerId, baseIndex))
        .some(baseIndex => ctx.state.bases[baseIndex].minions.some(minion => minion.controller !== ctx.playerId));
}

function baseGreatWhiteNorthBeforeScoring(ctx: TriggerContext) {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    if (!ctx.matchState) return [];
    if (!hasOtherBaseTarget(ctx.state, ctx.sourceBaseIndex)) return [];
    const eligiblePlayerIds = ctx.state.turnOrder.filter(playerId => (
        collectOwnMinionsOnBase(ctx.state, playerId, ctx.sourceBaseIndex!).length > 0
    ));
    const [firstPlayerId, ...remainingPlayerIds] = eligiblePlayerIds;
    if (!firstPlayerId) return [];
    return executeAbilityProgram(greatWhiteNorthPrompt, createPromptContext(ctx.matchState, firstPlayerId, ctx.now, {
        sourceBaseIndex: ctx.sourceBaseIndex,
        remainingPlayerIds,
    }));
}

function canTriggerBaseGreatWhiteNorthBeforeScoring(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex || !ctx.matchState) return false;
    if (!hasOtherBaseTarget(ctx.state, ctx.sourceBaseIndex)) return false;
    return ctx.state.turnOrder.some(playerId =>
        collectOwnMinionsOnBase(ctx.state, playerId, ctx.sourceBaseIndex!).length > 0,
    );
}

function baseTheSquaredCircleMinionPlayed(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    const playedCount = ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.sourceBaseIndex] ?? 1;
    if (playedCount !== 1) return [];
    const discardActions = ctx.state.players[ctx.playerId]?.discard.filter(card => getCardDef(card.defId)?.type === 'action') ?? [];
    if (discardActions.length === 0) return [];
    const [picked] = ctx.random.shuffle(discardActions);
    if (!picked) return [];
    return [recoverCardsFromDiscard(ctx.playerId, [picked.uid], 'base_the_squared_circle', ctx.now)];
}

function baseRingsideTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.affectEvent) return [];
    if (ctx.sourceDefId !== 'base_ringside') return [];
    const actingPlayerId = resolveSourcePlayerIdFromEvent(ctx.affectEvent) ?? ctx.playerId;
    if (ctx.triggerMinion?.controller === actingPlayerId) return [];
    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isActionThatDirectlyAffectsMinion(actionDefId)) return [];
    return buildStandardDrawEvents(ctx.state, actingPlayerId, 1, ctx.random, ctx.now);
}

function registerBaseSkeletonAbilities(): void {
    registerTrigger('base_heya_training_stable', 'onTurnStart', baseHeyaTrainingStableTurnStart, {
        perInstance: false,
        sourceScope: 'triggerBase',
        canTrigger: canTriggerBaseHeyaTrainingStableTurnStart,
    });
    registerTrigger('base_the_dohyo', 'onMinionPlayed', baseTheDohyoMinionPlayed, {
        perInstance: false,
        sourceScope: 'triggerBase',
        canTrigger: canTriggerBaseTheDohyoMinionPlayed,
    });
    registerTrigger('base_bastion_saint_gervais', 'onMinionAffected', baseBastionSaintGervaisMinionAffected, {
        perInstance: false,
        sourceScope: 'triggerBase',
        canTrigger: canTriggerBaseBastionSaintGervaisMinionAffected,
    });
    registerTrigger('base_the_golden_lily', 'onTurnEnd', baseTheGoldenLilyTurnEnd, {
        perInstance: false,
        sourceScope: 'triggerBase',
    });
    registerTrigger('base_strategic_syrup_reserve', 'onMinionPlayed', baseStrategicSyrupReserveMinionPlayed, {
        perInstance: false,
        sourceScope: 'triggerBase',
        canTrigger: canTriggerBaseStrategicSyrupReserveMinionPlayed,
    });
    registerTrigger('base_great_white_north_eh', 'beforeScoring', baseGreatWhiteNorthBeforeScoring, {
        perInstance: false,
        sourceScope: 'triggerBase',
        canTrigger: canTriggerBaseGreatWhiteNorthBeforeScoring,
    });
    registerTrigger('base_ringside', 'onMinionAffected', baseRingsideTrigger, {
        perInstance: false,
        sourceScope: 'triggerBase',
    });
    registerTrigger('base_the_squared_circle', 'onMinionPlayed', baseTheSquaredCircleMinionPlayed, {
        perInstance: false,
        sourceScope: 'triggerBase',
    });
}

export function registerInternationalIncidentAbilities(): void {
    registerAbilityProgram('sumo_wrestlers_technique_prize', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoTechniquePrize),
    });
    registerAbilityProgram('sumo_wrestlers_performance_prize', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoPerformancePrize),
    });
    registerAbilityProgram('sumo_wrestlers_head_butt', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoHeadButt),
    });
    registerAbilityProgram('sumo_wrestlers_bulking_stew', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoBulkingStew),
    });
    registerAbilityProgram('sumo_wrestlers_body_slam', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoBodySlam),
    });
    registerAbilityProgram('sumo_wrestlers_fighting_spirit_prize', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoFightingSpiritPrize),
    });
    registerAbilityProgram('sumo_wrestlers_chikara_mizu', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoChikaraMizu),
    });
    registerAbilityProgram('sumo_wrestlers_grasp_the_belt', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoGraspTheBelt),
    });
    registerAbilityProgram('sumo_wrestlers_yokozuna', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoYokozunaTalent),
    });
    registerProtection('sumo_wrestlers_yokozuna', 'move', protectionHasYokozuna);
    registerAbilityProgram('sumo_wrestlers_third_tier', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoThirdTierTalent),
    });
    registerTrigger('sumo_wrestlers_top_tier', 'onCardsDiscarded', sumoTopTierOnCardsDiscarded, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerAbilityProgram('sumo_wrestlers_rookie_sumo', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sumoRookieSumoTalent),
    });

    registerAbilityProgram('musketeers_en_garde', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersEnGarde),
    });
    registerAbilityProgram('musketeers_on_a_roll', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersOnARoll),
    });
    registerAbilityProgram('musketeers_make_way', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersMakeWay),
    });
    registerAbilityProgram('musketeers_biding_time', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersBidingTime),
    });
    registerAbilityProgram('musketeers_to_battle', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersToBattle),
    });
    registerAbilityProgram('musketeers_one_for_all', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersOneForAll),
    });
    registerAbilityProgram('musketeers_last_stand', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersLastStand),
    });
    registerAbilityProgram('musketeers_all_for_one', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersAllForOneOnPlay),
    });
    registerAbilityProgram('musketeers_token_of_affection', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(musketeersTokenOfAffection),
    });
    registerProtection('musketeers_porthos', 'action', porthosProtection);
    registerTrigger('musketeers_athos', 'onMinionAffected', musketeersAthosTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('musketeers_dartagnan', 'onMinionAffected', musketeersDartagnanTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('musketeers_young_musketeer', 'onMinionAffected', musketeersYoungMusketeerTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('musketeers_aramis', 'onMinionAffected', musketeersAramisTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerMusketeersAramis,
    });
    registerTrigger('musketeers_all_for_one', 'onMinionAffected', musketeersAllForOneTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('musketeers_all_for_one', 'onTurnEnd', musketeersAllForOneTurnEnd, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });

    registerAbilityProgram('mounties_eh', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesEhSpecial),
    });
    registerDiscardSpecialProvider({
        id: 'mounties_eh',
        getActivatableCards(core, playerId) {
            const currentTurnPlayerId = core.turnOrder[core.currentPlayerIndex];
            if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return [];
            const player = core.players[playerId];
            if (!player || player.actionsPlayed < 1) return [];
            if (player.usedDiscardPlayAbilities?.includes('mounties_eh')) return [];
            const ownMinions = collectOwnMinions(core, playerId);
            if (ownMinions.length === 0) return [];
            return player.discard
                .filter(card => card.defId === 'mounties_eh')
                .map(card => ({
                    card,
                    allowedBaseIndices: [...new Set(ownMinions.map(minion => minion.baseIndex))],
                    allowedMinionUids: ownMinions.map(minion => minion.uid),
                    sourceId: 'mounties_eh',
                    defId: card.defId,
                    name: getCardDef(card.defId)?.name ?? card.defId,
                }));
        },
    });
    registerAbilityProgram('mounties_when_calls_the_badge', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesWhenCallsTheBadge),
    });
    registerAbilityProgram('mounties_when_calls_the_badge', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesWhenCallsTheBadge),
    });
    registerAbilityProgram('mounties_power_poutine', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesPowerPoutine),
    });
    registerAbilityProgram('mounties_move_aboot', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesMoveAboot),
    });
    registerAbilityProgram('mounties_always_get_our_man', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesAlwaysGetOurMan),
    });
    registerTrigger('mounties_always_get_our_man', 'onTurnEnd', mountiesAlwaysGetOurManTurnEnd, {
        global: true,
        globalZones: ['discard'],
    });
    registerAbilityProgram('mounties_northern_mover', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesNorthernMoverTalent),
    });
    registerAbilityProgram('mounties_war_canuck', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesWarCanuckTalent),
    });
    registerAbilityProgram('mounties_dudlee', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesDudleeTalent),
    });
    registerAbilityProgram('mounties_haich_q', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mountiesHaichQTalent),
    });
    registerTrigger('mounties_bring_em_in', 'onMinionMoved', mountiesBringEmInTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerProtection('mounties_battle_moose', 'destroy', battleMooseProtection);

    registerAbilityProgram('luchadors_quick_set_up', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsQuickSetUpOnPlay),
    });
    registerAbilityProgram('luchadors_yellow_demon', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsYellowDemon),
    });
    registerAbilityProgram('luchadors_reversal', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsReversal),
    });
    registerTrigger('luchadors_reversal', 'onTurnEnd', luchadorsReversalTurnEnd, {
        global: true,
        globalZones: ['discard'],
    });
    registerAbilityProgram('luchadors_tag_team', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsTagTeam),
    });
    registerAbilityProgram('luchadors_senor_muchoslam', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsSenorMuchoslamOnPlay),
    });
    registerAbilityProgram('luchadors_senor_muchoslam', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsSenorMuchoslamTalent),
    });
    registerAbilityProgram('luchadors_senor_muchoslam_vs_the_monsters', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsSenorMuchoslamVsTheMonsters),
    });
    registerAbilityProgram('luchadors_cheap_pop', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsCheapPop),
    });
    registerAbilityProgram('luchadors_out_for_the_count', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(luchadorsOutForTheCount),
    });
    registerTrigger('luchadors_smart_set_up', 'onMinionPlayed', luchadorsSmartSetUpTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('luchadors_capa_roja', 'beforeScoring', luchadorsCapaRojaBeforeScoring, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerLuchadorsCapaRojaBeforeScoring,
    });
    registerCardAbilitySuppression('luchadors_pin', pinSuppression);

    registerBaseSkeletonAbilities();
}

export function isMinionPinnedForPowerContribution(minion: MinionOnBase): boolean {
    return minion.attachedActions.some(action => action.defId === 'luchadors_pin');
}
