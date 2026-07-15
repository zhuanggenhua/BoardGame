import type { Command, MatchState, PlayerId } from '../../engine/types';
import {
    buildAiOwnedBlockingInteractionFallbackActions,
    buildDeterministicAiNoise,
    createAiLegalActionId,
    createActionKindScorer,
    createInteractionHintScorer,
    createLookaheadLocalAiPolicy,
    createProfileAwareActionScorer,
    evaluateLocalAiActions,
    getAiActionStrategyTags,
    OPTIONAL_SKIP_AI_HINT,
    pickBestLocalAiActionEvaluation,
    withAiActionStrategyTags,
} from '../../engine/ai';
import type {
    AiAssignmentEvaluation,
    AiDecisionContext,
    AiHint,
    AiLegalAction,
    GameAiRuntime,
    LocalAiActionEvaluation,
    LocalAiActionScorer,
} from '../../engine/ai';
import {
    createActionLogSystem,
    createEventStreamSystem,
    createFlowSystem,
    createInteractionSystem,
    createSimpleChoiceSystem,
} from '../../engine';
import { executePipeline, type PipelineConfig } from '../../engine/pipeline';
import { getFreshSimpleChoiceOptions, type InteractionDescriptor as EngineInteractionDescriptor, type PromptMultiConfig } from '../../engine/systems/InteractionSystem';
import { SmashUpDomain, smashUpFlowHooks } from './domain';
import {
    SU_COMMANDS,
    getCurrentPlayerId,
    type ActionCardDef,
    type AbilityTag,
    type CardInstance,
    type FusionCardDef,
    type SmashUpCore,
    type TriggerInstance,
} from './domain/types';
import type { SmashUpCommand, SmashUpEvent } from './domain/types';
import {
    buildFactionSelectionIdentitySet,
    isSmashUpDiyFaction,
    isSmashUpFactionImplementationInProgress,
    normalizeFactionSelectionId,
    SMASHUP_FACTION_IDS,
} from './domain/ids';
import { getManualSpecialScoringBaseIndices, validate } from './domain/commands';
import { getCardDefActivatableAbilities, hasCardActivatableAbility } from './domain/activationMetadata';
import {
    getSmashUpReactionChoiceOptions,
    isSmashUpReactionChoiceInteraction,
} from './domain/reactionChoiceInteraction';
import { getSmashUpReactionWindowPresentation, hasBlockingLegacyResponseWindow } from './domain/reactionWindowState';
import {
    actionLikeNeedsResponseWindowBase,
    getActionLikeResponseWindowTiming,
    isCardActionLike,
    isCardMinionLike,
} from './domain/utils';
import {
    getEffectiveBreakpoint,
    getPlayerEffectivePowerOnBase,
    getScoringEligibleBaseIndices,
    getTotalEffectivePowerOnBase,
} from './domain/ongoingModifiers';
import { getCardDef, getMinionLikePower, getBaseDef, getFactionCards } from './data/cards';
import { createSmashUpEventSystem } from './domain/systems';
import { ACTION_ALLOWLIST, formatSmashUpActionEntry } from './actionLog';
import {
    getCardStrategyTags,
    getPlayerStrategyProfile,
    getResolvedPlayerFactionIds,
    scoreActionAgainstPlayerProfile,
    scoreFactionSynergy,
} from './aiProfiles';

type SmashUpState = MatchState<SmashUpCore>;
type SmashUpResolvedCardDef = NonNullable<ReturnType<typeof getCardDef>>;
const SMASHUP_AI_INTERACTION_ADAPTER_KINDS = ['simple-choice'];
type BasePowerOverride = { baseIndex: number; playerId: PlayerId; delta: number };
type SmashUpProjectedBaseDelta = { baseIndex: number; playerId?: PlayerId; powerDelta?: number; breakpointDelta?: number };
type SmashUpProjectedPlayerDelta = {
    playerId: PlayerId;
    vpDelta?: number;
    handDelta?: number;
    discardDelta?: number;
    minionsPlayedDelta?: number;
    actionsPlayedDelta?: number;
    minionLimitDelta?: number;
    actionLimitDelta?: number;
};
type SmashUpProjectedStateDelta = {
    baseDeltas?: SmashUpProjectedBaseDelta[];
    playerDeltas?: SmashUpProjectedPlayerDelta[];
    tags?: string[];
};
type SmashUpBasePotential = {
    score: number;
    gapBefore: number;
    breakNow: boolean;
    ownAward: number;
    bestOpponentAward: number;
    ownPower: number;
    bestOpponentPower: number;
    baseValue: number;
};

type SmashUpInteractionOption = {
    id?: string;
    label?: string;
    value?: unknown;
    disabled?: boolean;
    displayMode?: string;
    _ai?: AiHint;
};
type SmashUpCardAiMetrics = {
    extraMinion: number;
    extraAction: number;
    ongoing: number;
    reactive: number;
    burst: number;
    control: number;
};
type SmashUpPlayKind = 'minion' | 'action';
type SmashUpAssignmentMode = 'secure' | 'pressure';
type SmashUpTalentSimulationResult = {
    positionDelta: number;
    unresolved: boolean;
    executedSteps: number;
};

const SMASHUP_AI_SIMULATION_MAX_STEPS = 4;
const smashUpAiSimulationPipelineConfig: PipelineConfig<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
    domain: SmashUpDomain,
    systems: [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        createActionLogSystem<SmashUpCore>({
            commandAllowlist: ACTION_ALLOWLIST,
            formatEntry: formatSmashUpActionEntry,
        }),
        createInteractionSystem(),
        createSimpleChoiceSystem(),
        createEventStreamSystem(),
        createSmashUpEventSystem(),
    ],
};
const smashUpAiSimulationRandom = {
    shuffle: <T>(arr: T[]) => [...arr],
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.floor(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
};
const smashUpTalentSimulationCache = new WeakMap<AiDecisionContext, Map<string, SmashUpTalentSimulationResult | null>>();

const isInteractionControlValue = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { skip?: boolean; done?: boolean; __cancel__?: boolean };
    return candidate.skip === true || candidate.done === true || candidate.__cancel__ === true;
};

const SELECTABLE_FACTIONS = Object.values(SMASHUP_FACTION_IDS).filter((factionId) => (
    factionId !== SMASHUP_FACTION_IDS.MADNESS
    && !isSmashUpFactionImplementationInProgress(factionId)
    && getFactionCards(factionId).length > 0
));

function getSelectableFactions(enabledExpansions: readonly string[] = ['titans', 'diy']): string[] {
    return SELECTABLE_FACTIONS.filter((factionId) =>
        !isSmashUpDiyFaction(factionId) || enabledExpansions.includes('diy'),
    );
}

const EMPTY_CARD_AI_METRICS: SmashUpCardAiMetrics = {
    extraMinion: 0,
    extraAction: 0,
    ongoing: 0,
    reactive: 0,
    burst: 0,
    control: 0,
};

const normalizeAbilityTags = (tags: AbilityTag[] | undefined): Set<AbilityTag> => new Set(tags ?? []);

const getActionPlayKind = (actionKind: string): SmashUpPlayKind | undefined => {
    if (actionKind === 'play-minion' || actionKind === 'response-play-minion') return 'minion';
    if (actionKind === 'play-action' || actionKind === 'response-play-action') return 'action';
    return undefined;
};

const getSmashUpActionStrategyTags = (action: AiLegalAction): string[] => {
    const defId = typeof action.metadata?.defId === 'string' ? action.metadata.defId : undefined;
    const playKind = getActionPlayKind(action.kind);
    return getAiActionStrategyTags(action, {
        fallback: () => {
            if (!defId || !playKind) return [];
            return getCardStrategyTags(defId, playKind);
        },
    });
};

const buildCardAiMetrics = (cardDef: SmashUpResolvedCardDef, count = 1): Partial<SmashUpCardAiMetrics> => {
    if (cardDef.type === 'minion') {
        const tags = normalizeAbilityTags(cardDef.abilityTags);
        const hasScoringWindowSpecial = hasCardActivatableAbility(cardDef.id, { kind: 'special', zone: 'board', window: 'beforeScoring' })
            || hasCardActivatableAbility(cardDef.id, { kind: 'special', zone: 'board', window: 'afterScoring' });
        return {
            extraMinion: tags.has('extra') ? count * 2.2 : 0,
            ongoing: tags.has('ongoing') ? count * 1.6 : 0,
            reactive: cardDef.beforeScoringPlayable ? count * 2.5 : (hasScoringWindowSpecial ? count * 1.2 : 0),
            burst: cardDef.power >= 4 ? count * 1.4 : 0,
        };
    }

    if (cardDef.type === 'action') {
        const tags = normalizeAbilityTags(cardDef.abilityTags);
        const hasManualSpecial = getCardDefActivatableAbilities(cardDef)
            .some(ability => ability.kind === 'special');
        const responseTiming = getActionLikeResponseWindowTiming(cardDef);
        return {
            extraAction: tags.has('extra') ? count * 2.3 : 0,
            ongoing: cardDef.subtype === 'ongoing' || tags.has('ongoing') ? count * 2.1 : 0,
            reactive: responseTiming ? count * 2.3 : (hasManualSpecial ? count * 1.2 : 0),
            control: cardDef.playNeedsMinion || cardDef.ongoingTarget === 'minion' ? count * 1.1 : 0,
        };
    }

    if (cardDef.type === 'fusion') {
        const minionTags = normalizeAbilityTags(cardDef.minionAbilityTags);
        const actionTags = normalizeAbilityTags(cardDef.actionAbilityTags);
        const hasManualActionSpecial = getCardDefActivatableAbilities(cardDef, { face: 'action' })
            .some(ability => ability.kind === 'special');
        const hasScoringWindowFusionSpecial = hasCardActivatableAbility(
            cardDef.id,
            { kind: 'special', zone: 'board', window: 'beforeScoring' },
            { face: 'minion' },
        ) || hasCardActivatableAbility(
            cardDef.id,
            { kind: 'special', zone: 'board', window: 'afterScoring' },
            { face: 'minion' },
        );
        return {
            extraMinion: minionTags.has('extra') ? count * 1.5 : 0,
            extraAction: actionTags.has('extra') ? count * 1.6 : 0,
            ongoing: (
                minionTags.has('ongoing')
                || actionTags.has('ongoing')
                || cardDef.actionSubtype === 'ongoing'
            ) ? count * 1.8 : 0,
            reactive: (
                cardDef.minionBeforeScoringPlayable
                || hasScoringWindowFusionSpecial
                || !!getActionLikeResponseWindowTiming(cardDef)
            ) ? count * 2 : (hasManualActionSpecial ? count * 1.1 : 0),
            burst: cardDef.minionPower >= 4 ? count * 1.1 : 0,
            control: cardDef.actionPlayNeedsMinion || cardDef.actionOngoingTarget === 'minion' ? count : 0,
        };
    }

    return {};
};

const getActionCardAiMetrics = (defId: string | undefined): Partial<SmashUpCardAiMetrics> => {
    if (!defId) return { ...EMPTY_CARD_AI_METRICS };
    const cardDef = getCardDef(defId);
    return cardDef ? buildCardAiMetrics(cardDef, 1) : { ...EMPTY_CARD_AI_METRICS };
};

const createCommand = (playerId: PlayerId, type: string, payload: unknown = {}): Command => ({
    type,
    playerId,
    payload,
    timestamp: 0,
});

const hasPendingScoreBasesSpecialActivation = (state: SmashUpState, playerId: PlayerId): boolean => {
    if (state.sys.phase !== 'scoreBases') return false;

    const eligibleIndices = getManualSpecialScoringBaseIndices(state);
    for (const baseIndex of eligibleIndices) {
        const base = state.core.bases[baseIndex];
        if (!base) continue;
        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            const result = validate(state, createCommand(playerId, SU_COMMANDS.ACTIVATE_SPECIAL, {
                minionUid: minion.uid,
                baseIndex,
            }) as never);
            if (result.valid) return true;
        }


        for (const titan of state.core.titans ?? []) {
            const result = validate(state, createCommand(playerId, SU_COMMANDS.ACTIVATE_SPECIAL, {
                titanUid: titan.uid,
                baseIndex,
            }) as never);
            if (result.valid) return true;
        }
    }

    return false;
};

const canAdvancePhase = (state: SmashUpState, playerId: PlayerId): boolean => {
    if (state.sys.interaction?.current) return false;
    if (state.sys.interaction?.isBlocked === true) return false;
    if (getSmashUpReactionWindowPresentation(state)) return false;
    if (hasBlockingLegacyResponseWindow(state)) return false;
    const responseWindow = state.sys.responseWindow?.current as {
        sourceId?: unknown;
        responderQueue?: unknown[];
    } | undefined;
    const hasLiveLegacyResponders = Array.isArray(responseWindow?.responderQueue)
        && responseWindow.responderQueue.length > 0;
    if (responseWindow && responseWindow.sourceId !== 'smashup_reaction_choose' && hasLiveLegacyResponders) {
        return false;
    }
    if (state.sys.phase === 'scoreBases' && hasPendingScoreBasesSpecialActivation(state, playerId)) {
        return false;
    }
    return true;
};

const isCommandValid = (
    state: SmashUpState,
    playerId: PlayerId,
    type: string,
    payload: unknown = {},
): boolean => {
    if (type === 'ADVANCE_PHASE') return canAdvancePhase(state, playerId);
    const result = validate(state, createCommand(playerId, type, payload) as never);
    return result.valid;
};

const getBaseLabel = (state: SmashUpState, baseIndex: number): string => {
    const base = state.core.bases[baseIndex];
    if (!base) return `基地 ${baseIndex + 1}`;
    const baseDef = getBaseDef(base.defId);
    return baseDef?.name ?? base.defId;
};

const getCardLabel = (card: CardInstance): string => {
    const cardDef = getCardDef(card.defId);
    return cardDef?.name ?? card.defId;
};

const getBasePressureMetrics = (state: SmashUpState, baseIndex: number): {
    baseTotalPower: number;
    breakpoint: number;
    gapBefore: number;
    scoringEligible: boolean;
} => {
    const base = state.core.bases[baseIndex];
    const baseTotalPower = base ? getTotalEffectivePowerOnBase(state.core, base, baseIndex) : 0;
    const breakpoint = getEffectiveBreakpoint(state.core, baseIndex);
    return {
        baseTotalPower,
        breakpoint,
        gapBefore: breakpoint - baseTotalPower,
        scoringEligible: getScoringEligibleBaseIndices(state.core).includes(baseIndex),
    };
};

const getSmashUpPlayerIds = (state: SmashUpState): PlayerId[] => (
    Object.keys(state.core.players) as PlayerId[]
);

const buildBasePowerMap = (
    state: SmashUpState,
    baseIndex: number,
    override?: BasePowerOverride,
): Record<PlayerId, number> => {
    const base = state.core.bases[baseIndex];
    if (!base) return {};

    const powerByPlayer = Object.fromEntries(
        getSmashUpPlayerIds(state).map((playerId) => [
            playerId,
            getPlayerEffectivePowerOnBase(state.core, base, baseIndex, playerId),
        ]),
    ) as Record<PlayerId, number>;

    if (override?.baseIndex === baseIndex) {
        powerByPlayer[override.playerId] = (powerByPlayer[override.playerId] ?? 0) + override.delta;
    }

    return powerByPlayer;
};

const baseOverrideToProjectedStateDelta = (override?: BasePowerOverride): SmashUpProjectedStateDelta | undefined => {
    if (!override) return undefined;
    return {
        baseDeltas: [{
            baseIndex: override.baseIndex,
            playerId: override.playerId,
            powerDelta: override.delta,
        }],
    };
};

const getProjectedPlayerState = (
    state: SmashUpState,
    playerId: PlayerId,
    projectedState?: SmashUpProjectedStateDelta,
) => {
    const player = state.core.players[playerId];
    const playerDelta = projectedState?.playerDeltas?.find((delta) => delta.playerId === playerId);
    if (!player) return null;
    return {
        vp: player.vp + (playerDelta?.vpDelta ?? 0),
        handLength: player.hand.length + (playerDelta?.handDelta ?? 0),
        discardLength: player.discard.length + (playerDelta?.discardDelta ?? 0),
        minionsPlayed: player.minionsPlayed + (playerDelta?.minionsPlayedDelta ?? 0),
        actionsPlayed: player.actionsPlayed + (playerDelta?.actionsPlayedDelta ?? 0),
        minionLimit: player.minionLimit + (playerDelta?.minionLimitDelta ?? 0),
        actionLimit: player.actionLimit + (playerDelta?.actionLimitDelta ?? 0),
    };
};

const buildProjectedBasePowerMap = (
    state: SmashUpState,
    baseIndex: number,
    projectedState?: SmashUpProjectedStateDelta,
): Record<PlayerId, number> => {
    const powerByPlayer = buildBasePowerMap(state, baseIndex);
    if (!projectedState?.baseDeltas) return powerByPlayer;

    for (const delta of projectedState.baseDeltas) {
        if (delta.baseIndex !== baseIndex || typeof delta.playerId !== 'string' || !delta.powerDelta) continue;
        powerByPlayer[delta.playerId] = (powerByPlayer[delta.playerId] ?? 0) + delta.powerDelta;
    }

    return powerByPlayer;
};

const getProjectedBreakpoint = (
    state: SmashUpState,
    baseIndex: number,
    projectedState?: SmashUpProjectedStateDelta,
): number => {
    const baseBreakpoint = getEffectiveBreakpoint(state.core, baseIndex);
    const breakpointDelta = projectedState?.baseDeltas
        ?.filter((delta) => delta.baseIndex === baseIndex)
        .reduce((sum, delta) => sum + (delta.breakpointDelta ?? 0), 0) ?? 0;
    return baseBreakpoint + breakpointDelta;
};

const estimateBaseVpAward = (
    baseDef: NonNullable<ReturnType<typeof getBaseDef>>,
    powerByPlayer: Record<PlayerId, number>,
    playerId: PlayerId,
): number => {
    const ownPower = powerByPlayer[playerId] ?? 0;
    if (ownPower <= 0) return 0;

    const strongerPlayers = Object.entries(powerByPlayer)
        .filter(([candidatePlayerId, power]) => candidatePlayerId !== playerId && power > ownPower)
        .length;
    const tiedPlayers = Object.entries(powerByPlayer)
        .filter(([, power]) => power === ownPower)
        .length;
    const awardSlot = strongerPlayers + tiedPlayers - 1;

    return awardSlot < 3 ? (baseDef.vpAwards[awardSlot] ?? 0) : 0;
};

const estimateBestOpponentVpAward = (
    baseDef: NonNullable<ReturnType<typeof getBaseDef>>,
    powerByPlayer: Record<PlayerId, number>,
    playerId: PlayerId,
): number => {
    return (Object.keys(powerByPlayer) as PlayerId[])
        .filter((candidatePlayerId) => candidatePlayerId !== playerId)
        .reduce((best, candidatePlayerId) => {
            return Math.max(best, estimateBaseVpAward(baseDef, powerByPlayer, candidatePlayerId));
        }, 0);
};

const getBaseStrategicValue = (baseDef: NonNullable<ReturnType<typeof getBaseDef>>): number => {
    return (
        baseDef.vpAwards[0] * 18
        + baseDef.vpAwards[1] * 10
        + baseDef.vpAwards[2] * 5
        - baseDef.breakpoint * 0.45
        + (baseDef.minionPowerBonus ?? 0) * 8
    );
};

const evaluateBasePotential = (
    state: SmashUpState,
    playerId: PlayerId,
    baseIndex: number,
    override?: BasePowerOverride,
    projectedState?: SmashUpProjectedStateDelta,
): SmashUpBasePotential | null => {
    const baseDef = getBaseDef(state.core.bases[baseIndex]?.defId);
    if (!baseDef) return null;

    const normalizedProjectedState = projectedState ?? baseOverrideToProjectedStateDelta(override);
    const powerByPlayer = buildProjectedBasePowerMap(state, baseIndex, normalizedProjectedState);
    const ownPower = powerByPlayer[playerId] ?? 0;
    const bestOpponentPower = Object.entries(powerByPlayer)
        .filter(([candidatePlayerId]) => candidatePlayerId !== playerId)
        .reduce((best, [, power]) => Math.max(best, power), 0);
    const totalPower = Object.values(powerByPlayer).reduce((sum, power) => sum + power, 0);
    const projectedBreakpoint = getProjectedBreakpoint(state, baseIndex, normalizedProjectedState);
    const gapBefore = projectedBreakpoint - totalPower;
    const ownAward = estimateBaseVpAward(baseDef, powerByPlayer, playerId);
    const bestOpponentAward = estimateBestOpponentVpAward(baseDef, powerByPlayer, playerId);
    const pressureRatio = projectedBreakpoint > 0
        ? Math.max(0, 1 - Math.max(0, gapBefore) / projectedBreakpoint)
        : 0;
    const baseValue = getBaseStrategicValue(baseDef);
    const breakNow = totalPower >= projectedBreakpoint;

    let score = (
        ownAward * 28
        - bestOpponentAward * 18
        + (ownPower - bestOpponentPower) * 2.5
        + pressureRatio * baseValue * (ownPower > 0 ? 0.26 : 0.08)
    );

    if (breakNow) {
        score += ownAward > 0
            ? baseValue * 0.55 + ownAward * 24
            : -baseValue * 0.42 - bestOpponentAward * 18;
    }

    return {
        score,
        gapBefore,
        breakNow,
        ownAward,
        bestOpponentAward,
        ownPower,
        bestOpponentPower,
        baseValue,
    };
};

const evaluateSmashUpPosition = (
    state: SmashUpState,
    playerId: PlayerId,
    override?: BasePowerOverride,
    projectedState?: SmashUpProjectedStateDelta,
): number => {
    const normalizedProjectedState = projectedState ?? baseOverrideToProjectedStateDelta(override);
    const player = getProjectedPlayerState(state, playerId, normalizedProjectedState);
    if (!player) return 0;

    const bestOpponentVp = getSmashUpPlayerIds(state)
        .filter((candidatePlayerId) => candidatePlayerId !== playerId)
        .reduce((best, candidatePlayerId) => {
            const opponent = getProjectedPlayerState(state, candidatePlayerId, normalizedProjectedState);
            return Math.max(best, opponent?.vp ?? 0);
        }, 0);

    const baseScore = state.core.bases.reduce((sum, _base, baseIndex) => {
        const potential = evaluateBasePotential(state, playerId, baseIndex, undefined, normalizedProjectedState);
        return sum + (potential?.score ?? 0);
    }, 0);

    return (
        (player.vp - bestOpponentVp) * 85
        + baseScore
        + player.handLength * 4
        + player.discardLength * 1.5
        + (player.minionLimit - player.minionsPlayed) * 6
        + (player.actionLimit - player.actionsPlayed) * 4
    );
};

const getProjectedBaseIndex = (action: AiLegalAction): number | null => {
    if (typeof action.metadata?.baseIndex === 'number') {
        return action.metadata.baseIndex;
    }
    if (typeof action.metadata?.targetBaseIndex === 'number') {
        return action.metadata.targetBaseIndex;
    }
    return null;
};

const getSmashUpEvaluatorScale = (context: AiDecisionContext): number => {
    switch (context.difficulty.evaluatorProfile) {
        case 'basic':
            return 0.35;
        case 'balanced':
            return 0.7;
        case 'strong':
            return 1;
        case 'expert':
            return 1.2;
        default:
            return 1;
    }
};

const clampSmashUpAssignmentScore = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(180, Math.max(-120, Number(value.toFixed(3))));
};

const resolveSmashUpAssignmentMode = (args: {
    ownVp: number;
    bestOpponentVp: number;
    hasUrgentPressure: boolean;
}): SmashUpAssignmentMode => {
    const vpDeficit = args.bestOpponentVp - args.ownVp;
    if (vpDeficit >= 1) return 'pressure';
    if (args.hasUrgentPressure && vpDeficit <= 0) return 'secure';
    return 'pressure';
};

const getSmashUpAssignmentSourceId = (action: AiLegalAction): string | null => {
    if (typeof action.metadata?.cardUid === 'string') {
        return `card:${action.metadata.cardUid}`;
    }
    if (typeof action.metadata?.minionUid === 'string') {
        return `minion:${action.metadata.minionUid}`;
    }
    if (typeof action.metadata?.titanUid === 'string') {
        return `titan:${action.metadata.titanUid}`;
    }
    if (typeof action.metadata?.ongoingCardUid === 'string') {
        return `ongoing:${action.metadata.ongoingCardUid}`;
    }
    return null;
};

const canEvaluateSmashUpAssignment = (action: AiLegalAction): boolean => {
    return action.kind === 'play-minion'
        || action.kind === 'play-action'
        || action.kind === 'activate-special'
        || action.kind === 'use-talent';
};

const buildSmashUpAssignmentIntent = (args: {
    action: AiLegalAction;
    mode: SmashUpAssignmentMode;
    basePotential: SmashUpBasePotential;
    gapBefore: number;
    projectedMargin: number | null;
    scoringEligible: boolean;
}): { score: number; reason: string; metadata: Record<string, unknown> } | null => {
    const { action, mode, basePotential, gapBefore, projectedMargin, scoringEligible } = args;
    const baseSwing = basePotential.ownAward - basePotential.bestOpponentAward;
    let score = basePotential.score * 0.16 + baseSwing * 24;

    if (projectedMargin !== null && projectedMargin >= 0) {
        score += 46 + Math.min(20, projectedMargin * 4);
    } else if (gapBefore <= 2) {
        score += 24 - gapBefore * 6;
    } else if (gapBefore >= 8) {
        score -= 14;
    }

    if (scoringEligible) score += 36;

    if (mode === 'secure') {
        score += basePotential.bestOpponentAward > basePotential.ownAward ? 28 : 10;
        if (basePotential.breakNow && basePotential.ownAward === 0) {
            score -= 34 + basePotential.bestOpponentAward * 10;
        }
    } else {
        score += basePotential.ownAward * 22;
        if (basePotential.breakNow && basePotential.ownAward > 0) {
            score += 22 + basePotential.ownAward * 8;
        }
    }

    if (action.kind === 'play-minion') {
        score += 8;
    } else if (action.kind === 'play-action') {
        score += 4;
    } else if (action.kind === 'activate-special' || action.kind === 'use-talent') {
        score += scoringEligible ? 7 : 2;
    }

    if (score === 0) return null;
    return {
        score: clampSmashUpAssignmentScore(score),
        reason: mode === 'secure'
            ? '同一资源优先投向可阻止对手抢分的关键基地'
            : '同一资源优先投向能提升我方 VP swing 的基地',
        metadata: {
            mode,
            baseSwing,
            ownAward: basePotential.ownAward,
            bestOpponentAward: basePotential.bestOpponentAward,
            gapBefore,
            projectedMargin,
            scoringEligible,
        },
    };
};

const evaluateSmashUpAssignments = (args: {
    context: AiDecisionContext;
    baseEvaluations: LocalAiActionEvaluation[];
}): AiAssignmentEvaluation[] => {
    const state = args.context.visibleState as SmashUpState;
    const playerId = args.context.playerId;
    const player = state.core.players[playerId];
    if (!player) return [];

    const bestOpponentVp = getSmashUpPlayerIds(state)
        .filter((candidatePlayerId) => candidatePlayerId !== playerId)
        .reduce((best, candidatePlayerId) => Math.max(best, state.core.players[candidatePlayerId]?.vp ?? 0), 0);

    const hasUrgentPressure = args.baseEvaluations.some((evaluation) => hasUrgentBasePressure(evaluation.action));
    const assignmentMode = resolveSmashUpAssignmentMode({
        ownVp: player.vp,
        bestOpponentVp,
        hasUrgentPressure,
    });

    const groupedAssignments = new Map<string, Array<AiAssignmentEvaluation & { baseScore: number }>>();
    for (const evaluation of args.baseEvaluations) {
        const action = evaluation.action;
        if (!canEvaluateSmashUpAssignment(action)) continue;

        const sourceId = getSmashUpAssignmentSourceId(action);
        if (!sourceId) continue;

        const baseIndex = getProjectedBaseIndex(action);
        if (baseIndex === null) continue;
        const talentSimulation = action.kind === 'use-talent'
            ? simulateSmashUpTalentAction({ context: args.context, action })
            : null;
        if (action.kind === 'use-talent' && (talentSimulation?.positionDelta ?? 0) <= 0) continue;
        const basePotential = evaluateBasePotential(state, playerId, baseIndex);
        if (!basePotential) continue;

        const gapBefore = typeof action.metadata?.gapBefore === 'number'
            ? action.metadata.gapBefore
            : basePotential.gapBefore;
        const projectedMargin = typeof action.metadata?.projectedMargin === 'number'
            ? action.metadata.projectedMargin
            : null;
        const scoringEligible = action.metadata?.scoringEligible === true || action.metadata?.scoringBase === true;
        let intent = buildSmashUpAssignmentIntent({
            action,
            mode: assignmentMode,
            basePotential,
            gapBefore,
            projectedMargin,
            scoringEligible,
        });
        if (!intent) continue;
        if (action.kind === 'use-talent' && talentSimulation) {
            intent = {
                ...intent,
                score: clampSmashUpAssignmentScore(Math.min(
                    intent.score,
                    Math.max(18, Math.min(80, talentSimulation.positionDelta * 2.2)),
                )),
                metadata: {
                    ...(intent.metadata ?? {}),
                    talentSimulation,
                },
            };
        }

        const assignments = groupedAssignments.get(sourceId) ?? [];
        assignments.push({
            actionId: action.actionId,
            score: intent.score,
            reason: intent.reason,
            metadata: {
                ...intent.metadata,
                sourceId,
                baseIndex,
            },
            baseScore: intent.score,
        });
        groupedAssignments.set(sourceId, assignments);
    }

    const finalAssignments: AiAssignmentEvaluation[] = [];
    for (const [sourceId, assignments] of groupedAssignments.entries()) {
        const ranked = [...assignments].sort((left, right) => right.baseScore - left.baseScore);
        for (let index = 0; index < ranked.length; index += 1) {
            const candidate = ranked[index];
            const ordinalAdjustment = index === 0
                ? 12
                : index === 1
                    ? -8
                    : -14 - (index - 2) * 2;
            const score = clampSmashUpAssignmentScore(candidate.baseScore + ordinalAdjustment);
            if (score === 0) continue;
            finalAssignments.push({
                actionId: candidate.actionId,
                score,
                reason: `${candidate.reason}（资源分配排序 #${index + 1}）`,
                metadata: {
                    ...(candidate.metadata ?? {}),
                    sourceId,
                    assignmentMode,
                    assignmentRank: index + 1,
                    ordinalAdjustment,
                },
            });
        }
    }

    return finalAssignments;
};

const RELATIVE_UTILITY_ACTION_KINDS = new Set<AiLegalAction['kind']>([
    'play-minion',
    'play-action',
    'activate-special',
    'use-talent',
]);

const RELATIVE_UTILITY_WEIGHT = 9;
const relativeUtilityByActionIdCache = new WeakMap<AiDecisionContext, Map<string, number>>();

const shouldApplySmashUpRelativeUtility = (context: AiDecisionContext): boolean => {
    if (context.responseWindow) return false;
    const state = context.visibleState as SmashUpState;
    if (getSmashUpReactionWindowPresentation(state)) return false;
    if (hasBlockingLegacyResponseWindow(state)) return false;
    return true;
};

const buildRelativeUtilityByActionId = (context: AiDecisionContext): Map<string, number> => {
    const cached = relativeUtilityByActionIdCache.get(context);
    if (cached) return cached;

    const utilityMap = new Map<string, number>();
    if (!shouldApplySmashUpRelativeUtility(context)) {
        relativeUtilityByActionIdCache.set(context, utilityMap);
        return utilityMap;
    }

    const candidates = context.legalActions.filter((action) => RELATIVE_UTILITY_ACTION_KINDS.has(action.kind));
    if (candidates.length <= 1) {
        relativeUtilityByActionIdCache.set(context, utilityMap);
        return utilityMap;
    }

    const rawScores = candidates.map((action) => ({
        actionId: action.actionId,
        score: projectSmashUpAction({ context, action })?.score ?? 0,
    }));
    const minScore = rawScores.reduce((best, item) => Math.min(best, item.score), Number.POSITIVE_INFINITY);
    const maxScore = rawScores.reduce((best, item) => Math.max(best, item.score), Number.NEGATIVE_INFINITY);
    const denominator = maxScore > minScore ? (maxScore - minScore) : 0;

    for (const item of rawScores) {
        const relativeUtility = denominator > 0 ? (item.score - minScore) / denominator : 1;
        utilityMap.set(item.actionId, Number(relativeUtility.toFixed(3)));
    }

    relativeUtilityByActionIdCache.set(context, utilityMap);
    return utilityMap;
};

const estimateImmediateActionUrgency = (action: AiLegalAction): number => {
    const scoringEligible = action.metadata?.scoringEligible === true || action.metadata?.scoringBase === true;
    const projectedMargin = typeof action.metadata?.projectedMargin === 'number'
        ? action.metadata.projectedMargin
        : null;
    const gapBefore = typeof action.metadata?.gapBefore === 'number'
        ? action.metadata.gapBefore
        : null;

    let score = 0;
    if (scoringEligible) score += 32;
    if (projectedMargin !== null && projectedMargin >= 0) score += 38 + projectedMargin * 6;
    else if (gapBefore !== null && gapBefore <= 2) score += 20 - gapBefore * 4;
    if (action.kind === 'activate-special' || action.kind === 'use-talent') score += 10;
    if (
        (action.kind === 'response-play-minion' || action.kind === 'response-play-action')
        && (
            scoringEligible
            || (projectedMargin !== null && projectedMargin >= 0)
            || (gapBefore !== null && gapBefore <= 2)
        )
    ) {
        score += 16;
    }
    return score;
};

const hasUrgentBasePressure = (action: AiLegalAction): boolean => {
    const scoringEligible = action.metadata?.scoringEligible === true || action.metadata?.scoringBase === true;
    const projectedMargin = typeof action.metadata?.projectedMargin === 'number'
        ? action.metadata.projectedMargin
        : null;
    const gapBefore = typeof action.metadata?.gapBefore === 'number'
        ? action.metadata.gapBefore
        : null;
    return scoringEligible || (projectedMargin !== null && projectedMargin >= 0) || (gapBefore !== null && gapBefore <= 2);
};

const scoreActionStrategyFit = (
    state: SmashUpState,
    playerId: PlayerId,
    action: AiLegalAction,
    legalActions?: AiLegalAction[],
): { score: number; reason: string; tags: string[]; profileSummary: string[] } | null => {
    const cardTags = getSmashUpActionStrategyTags(action);
    if (cardTags.length === 0) return null;

    const profile = getPlayerStrategyProfile(state, playerId);
    const urgentBasePressure = (legalActions ?? [action]).some((candidate) => hasUrgentBasePressure(candidate));
    const scored = scoreActionAgainstPlayerProfile({
        profile,
        actionKind: action.kind,
        cardTags,
        phase: state.sys.phase as string | undefined,
        hasUrgentBasePressure: urgentBasePressure,
    });
    if (!scored) return null;

    return {
        ...scored,
        tags: cardTags,
        profileSummary: profile.summary,
    };
};

const getBaseSwingValue = (potential: SmashUpBasePotential | null): number => {
    if (!potential) return 0;
    return potential.ownAward - potential.bestOpponentAward;
};

const getProjectedPositionDelta = (
    state: SmashUpState,
    playerId: PlayerId,
    override?: BasePowerOverride,
    projectedState?: SmashUpProjectedStateDelta,
): number => {
    const currentPosition = evaluateSmashUpPosition(state, playerId);
    const projectedPosition = evaluateSmashUpPosition(state, playerId, override, projectedState);
    return projectedPosition - currentPosition;
};

const buildAiInteractionSnapshotFromState = (state: SmashUpState) => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current || current.kind !== 'simple-choice') return null;
    const data = current.data as {
        sourceId?: string;
        options?: SmashUpInteractionOption[];
        multi?: PromptMultiConfig;
    } | undefined;
    return {
        id: current.id,
        kind: current.kind,
        sourceId: data?.sourceId,
        playerId: current.playerId,
        options: (data?.options ?? []).map((option) => ({
            id: option.id,
            label: option.label,
            disabled: option.disabled,
            displayMode: option.displayMode,
            _ai: option._ai,
        })),
        multi: data?.multi,
    };
};

const buildAiResponseWindowSnapshotFromState = (state: SmashUpState) => {
    const current = state.sys.responseWindow?.current as {
        windowType?: string;
        sourceId?: string;
        currentResponderIndex?: number;
        responderQueue?: string[];
    } | undefined;
    if (!current) return null;
    return {
        windowType: current.windowType,
        sourceId: current.sourceId,
        currentResponderIndex: current.currentResponderIndex,
        responderQueue: Array.isArray(current.responderQueue) ? [...current.responderQueue] : undefined,
    };
};

function simulateSmashUpTalentAction(args: {
    context: AiDecisionContext;
    action: AiLegalAction;
}): SmashUpTalentSimulationResult | null {
    if (args.action.kind !== 'use-talent') return null;

    const cachedByContext = smashUpTalentSimulationCache.get(args.context) ?? new Map<string, SmashUpTalentSimulationResult | null>();
    if (!smashUpTalentSimulationCache.has(args.context)) {
        smashUpTalentSimulationCache.set(args.context, cachedByContext);
    }
    if (cachedByContext.has(args.action.actionId)) {
        return cachedByContext.get(args.action.actionId) ?? null;
    }

    const initialState = args.context.visibleState as SmashUpState;
    let currentState = initialState;
    let currentAction: AiLegalAction | null = args.action;
    let executedSteps = 0;

    while (currentAction && executedSteps < SMASHUP_AI_SIMULATION_MAX_STEPS) {
        const command = currentAction.commands[0];
        if (!command) {
            cachedByContext.set(args.action.actionId, null);
            return null;
        }

        const pipelineResult = executePipeline(
            smashUpAiSimulationPipelineConfig,
            currentState,
            {
                type: command.type,
                playerId: args.context.playerId,
                payload: command.payload,
                timestamp: 0,
            } as SmashUpCommand,
            smashUpAiSimulationRandom,
            Object.keys(currentState.core.players) as PlayerId[],
        );
        if (!pipelineResult.success) {
            cachedByContext.set(args.action.actionId, null);
            return null;
        }

        currentState = pipelineResult.state as SmashUpState;
        executedSteps += 1;

        const nextLegalActions = buildSmashUpAiLegalActions({
            playerId: args.context.playerId,
            state: currentState,
        });
        const hasOwnedInteraction = (currentState.sys.interaction?.current as EngineInteractionDescriptor | undefined)?.playerId === args.context.playerId;
        if (!hasOwnedInteraction || nextLegalActions.length === 0) {
            currentAction = null;
            break;
        }

        const followUpContext: AiDecisionContext = {
            ...args.context,
            visibleState: currentState,
            interaction: buildAiInteractionSnapshotFromState(currentState),
            responseWindow: buildAiResponseWindowSnapshotFromState(currentState),
            legalActions: nextLegalActions,
        };
        const followUpEvaluations = evaluateLocalAiActions(followUpContext, smashUpTalentFollowUpScorers);
        const nextEvaluation = pickBestLocalAiActionEvaluation(followUpEvaluations);
        currentAction = nextEvaluation?.action ?? null;
        if (!currentAction || currentAction.kind === 'advance-phase') {
            break;
        }
    }

    const result: SmashUpTalentSimulationResult = {
        positionDelta: Number((evaluateSmashUpPosition(currentState, args.context.playerId) - evaluateSmashUpPosition(initialState, args.context.playerId)).toFixed(3)),
        unresolved: (currentState.sys.interaction?.current as EngineInteractionDescriptor | undefined)?.playerId === args.context.playerId,
        executedSteps,
    };
    cachedByContext.set(args.action.actionId, result);
    return result;
}

const shouldHoldPhaseForSmashUpAction = (
    context: AiDecisionContext,
    action: AiLegalAction,
): boolean => {
    if (action.kind === 'response-pass' || action.kind === 'discard-to-limit') return false;
    if (action.kind !== 'use-talent') return true;
    const talentSimulation = simulateSmashUpTalentAction({ context, action });
    return (talentSimulation?.positionDelta ?? 0) > 0;
};

const projectSmashUpAction = (args: {
    context: AiDecisionContext;
    action: AiLegalAction;
}): { score: number; reason: string; metadata?: Record<string, unknown> } | null => {
    const state = args.context.visibleState as SmashUpState;
    const playerId = args.context.playerId;
    const scale = getSmashUpEvaluatorScale(args.context);
    const baseIndex = getProjectedBaseIndex(args.action);
    const urgency = estimateImmediateActionUrgency(args.action);
    const phase = state.sys.phase as string | undefined;
    const strategyFit = scoreActionStrategyFit(state, playerId, args.action, args.context.legalActions);
    const strategyBonus = strategyFit?.score ?? 0;

    if (args.action.kind === 'play-minion' || args.action.kind === 'response-play-minion') {
        if (baseIndex === null) return null;

        const power = typeof args.action.metadata?.power === 'number' ? args.action.metadata.power : 0;
        const projectedState: SmashUpProjectedStateDelta = {
            baseDeltas: [{ baseIndex, playerId, powerDelta: power }],
            playerDeltas: [{ playerId, handDelta: -1, minionsPlayedDelta: args.action.kind === 'play-minion' ? 1 : 0 }],
            tags: ['play-minion'],
        };
        const before = evaluateBasePotential(state, playerId, baseIndex);
        const after = evaluateBasePotential(state, playerId, baseIndex, undefined, projectedState);
        if (!before || !after) return null;

        const swingBefore = getBaseSwingValue(before);
        const swingAfter = getBaseSwingValue(after);
        const swingDelta = swingAfter - swingBefore;
        const contestMargin = after.ownAward - after.bestOpponentAward;
        const isHighPressureBase = after.breakNow || before.breakNow || before.gapBefore <= 2 || after.gapBefore <= 2;
        const positionDelta = getProjectedPositionDelta(state, playerId, undefined, projectedState);
        const awardDelta = after.ownAward - before.ownAward;
        const denyDelta = before.bestOpponentAward - after.bestOpponentAward;

        let tacticalScore = (
            after.score * 0.45
            + positionDelta * 0.3
            + (after.score - before.score) * 0.65
            + swingAfter * 30
            + swingDelta * 12
            + after.ownAward * 28
            - after.bestOpponentAward * 18
            + awardDelta * 26
            + denyDelta * 20
            + urgency * 0.6
            + strategyBonus * 0.8
        );

        if (after.breakNow && after.ownAward > before.ownAward) {
            tacticalScore += 32 + after.ownAward * 10;
        }
        if (after.breakNow && after.ownAward === 0) {
            tacticalScore -= 54 + after.bestOpponentAward * 10;
        }
        if (isHighPressureBase && contestMargin > 0) {
            tacticalScore += 42 + contestMargin * 12;
        } else if (isHighPressureBase && contestMargin < 0) {
            tacticalScore -= 42 + Math.abs(contestMargin) * 12;
        }
        if (after.breakNow && after.ownAward > 0 && after.bestOpponentAward === 0) {
            tacticalScore += 18;
        }

        return {
            score: Number((tacticalScore * scale).toFixed(3)),
            reason: after.breakNow && after.ownAward > before.ownAward
                ? '高难度会优先把随从投到能改写名次并直接拿分的基地'
                : '高难度会比较各基地的 VP swing，而不是只看哪里快爆',
            metadata: {
                baseIndex,
                power,
                swingBefore,
                swingAfter,
                swingDelta,
                awardDelta,
                denyDelta,
                contestMargin,
                positionDelta,
                strategyBonus,
                strategyTags: strategyFit?.tags,
                beforeOwnAward: before.ownAward,
                afterOwnAward: after.ownAward,
                beforeOpponentAward: before.bestOpponentAward,
                afterOpponentAward: after.bestOpponentAward,
            },
        };
    }

    if (args.action.kind === 'play-action' || args.action.kind === 'response-play-action') {
        const cardMetrics = getActionCardAiMetrics(typeof args.action.metadata?.defId === 'string' ? args.action.metadata.defId : undefined);
        if (baseIndex === null) {
            const score = args.action.kind === 'response-play-action' && urgency <= 0
                ? Number(((-46 + strategyBonus * 0.2 + (cardMetrics.extraAction ?? 0) * 0.8) * scale).toFixed(3))
                : urgency <= 0
                    ? Number(((-12 + strategyBonus * 0.3 + (cardMetrics.extraAction ?? 0) * 1.4) * scale).toFixed(3))
                    : Number(((urgency * 0.22 + strategyBonus * 0.2) * scale).toFixed(3));
            return score === 0 ? null : {
                score,
                reason: '高难度会优先保留与当前抢分节奏相关的行动牌窗口',
                metadata: { urgency, strategyBonus, strategyTags: strategyFit?.tags },
            };
        }

        const basePotential = evaluateBasePotential(state, playerId, baseIndex);
        if (!basePotential) return null;

        let tacticalScore = (
            basePotential.score * 0.2
            + getBaseSwingValue(basePotential) * 10
            + urgency * 0.75
            + strategyBonus * 0.9
        );
        if (basePotential.gapBefore <= 2) tacticalScore += 18;
        if (basePotential.gapBefore >= 8) tacticalScore -= 16;
        if (cardMetrics.reactive && basePotential.gapBefore <= 2) tacticalScore += (cardMetrics.reactive ?? 0) * 4.5;
        if ((cardMetrics.ongoing ?? 0) > 0 && phase === 'playCards' && basePotential.gapBefore > 3) tacticalScore += (cardMetrics.ongoing ?? 0) * 2.5;
        if (args.action.kind === 'response-play-action' && (basePotential.breakNow || basePotential.gapBefore <= 2)) {
            tacticalScore += 24;
        }
        if (
            args.action.kind === 'response-play-action'
            && urgency <= 0
            && (cardMetrics.reactive ?? 0) <= 0
            && (cardMetrics.extraAction ?? 0) <= 0
        ) {
            tacticalScore -= 36;
        }

        return {
            score: Number((tacticalScore * scale).toFixed(3)),
            reason: args.action.kind === 'response-play-action'
                ? '高难度会优先把响应行动投向能改写当前评分的基地'
                : '高难度会优先把行动牌投向自己仍有机会赢分的基地',
            metadata: {
                baseIndex,
                urgency,
                strategyBonus,
                strategyTags: strategyFit?.tags,
                gapBefore: basePotential.gapBefore,
                ownAward: basePotential.ownAward,
                bestOpponentAward: basePotential.bestOpponentAward,
            },
        };
    }

    if (args.action.kind === 'activate-special' || args.action.kind === 'use-talent') {
        if (baseIndex === null) {
            return urgency <= 0 ? null : {
                score: Number(((urgency * 0.45 + strategyBonus * 0.35) * scale).toFixed(3)),
                reason: '高难度会优先处理临近评分时的主动技能窗口',
                metadata: { urgency, strategyBonus, strategyTags: strategyFit?.tags },
            };
        }

        const basePotential = evaluateBasePotential(state, playerId, baseIndex);
        let tacticalScore = (
            (basePotential?.score ?? 0) * 0.16
            + getBaseSwingValue(basePotential ?? null) * 8
            + urgency * 0.95
            + strategyBonus * 0.55
        );
        if (args.action.kind === 'use-talent') {
            const talentSimulation = simulateSmashUpTalentAction(args);
            if (talentSimulation) {
                tacticalScore += Math.max(-90, Math.min(90, talentSimulation.positionDelta * 0.35));
                if (talentSimulation.positionDelta <= 0) {
                    tacticalScore -= 140;
                    if (talentSimulation.unresolved) {
                        tacticalScore -= 25;
                    }
                }
            }
        }

        return {
            score: Number((tacticalScore * scale).toFixed(3)),
            reason: '高难度会优先在关键基地处理 special / talent 节奏',
            metadata: {
                baseIndex,
                urgency,
                strategyBonus,
                strategyTags: strategyFit?.tags,
                ownAward: basePotential?.ownAward ?? 0,
                bestOpponentAward: basePotential?.bestOpponentAward ?? 0,
                ...(args.action.kind === 'use-talent' ? {
                    talentSimulation: simulateSmashUpTalentAction(args) ?? undefined,
                } : {}),
            },
        };
    }

    if (args.action.kind === 'response-pass') {
        const bestAlternativeUrgency = args.context.legalActions
            .filter((candidate) => candidate.actionId !== args.action.actionId)
            .reduce((best, candidate) => Math.max(best, estimateImmediateActionUrgency(candidate)), 0);
        const bestAlternativeStrategyFit = args.context.legalActions
            .filter((candidate) => candidate.actionId !== args.action.actionId)
            .reduce((best, candidate) => {
                const candidateFit = scoreActionStrategyFit(state, playerId, candidate, args.context.legalActions)?.score ?? 0;
                return Math.max(best, candidateFit);
            }, 0);

        return {
            score: Number(((bestAlternativeUrgency > 0 || bestAlternativeStrategyFit > 20
                ? -42 - bestAlternativeUrgency * 0.7
                : 22) * scale).toFixed(3)),
            reason: bestAlternativeUrgency > 0 || bestAlternativeStrategyFit > 20
                ? '高难度会先检查是否存在能改写本次评分的响应动作'
                : '没有更强响应时可以直接让过',
            metadata: { bestAlternativeUrgency, bestAlternativeStrategyFit },
        };
    }

    if (args.action.kind === 'advance-phase') {
        const bestAlternativeUrgency = args.context.legalActions
            .filter((candidate) => candidate.actionId !== args.action.actionId)
            .filter((candidate) => shouldHoldPhaseForSmashUpAction(args.context, candidate))
            .reduce((best, candidate) => Math.max(best, estimateImmediateActionUrgency(candidate)), 0);

        return {
            score: Number(((bestAlternativeUrgency > 0 ? -18 - bestAlternativeUrgency * 0.4 : 16) * scale).toFixed(3)),
            reason: bestAlternativeUrgency > 0
                ? '高难度会在结束阶段前再看一眼是否还有抢分动作'
                : '当前已接近无事可做，可以结束阶段',
            metadata: { bestAlternativeUrgency },
        };
    }

    return null;
};

const appendAction = (
    actions: AiLegalAction[],
    state: SmashUpState,
    playerId: PlayerId,
    action: AiLegalAction,
    options?: { skipValidation?: boolean },
): void => {
    if (action.commands.length === 0) return;
    if (!options?.skipValidation) {
        const isValid = action.commands.every((command) => isCommandValid(state, playerId, command.type, command.payload));
        if (!isValid) return;
    }
    actions.push(action);
};

const buildSimpleChoicePayload = (
    _sourceId: string | undefined,
    interactionId: string,
    optionIds: string[],
    multi: PromptMultiConfig | undefined,
): Record<string, unknown> => {
    if (optionIds.length === 0) {
        return { interactionId, optionIds: [] };
    }
    if (optionIds.length <= 1 && !multi) {
        return { interactionId, optionId: optionIds[0] };
    }
    if (optionIds.length <= 1 && (multi?.min ?? 0) <= 1) {
        return { interactionId, optionId: optionIds[0] };
    }
    return { interactionId, optionIds };
};

const isSmashUpReactionChoiceLiveValidation = (current: EngineInteractionDescriptor): boolean => {
    if (!isSmashUpReactionChoiceInteraction(current)) {
        return false;
    }
    const data = current.data as { responseValidationMode?: unknown; revalidateOnRespond?: unknown };
    return data.responseValidationMode === 'live' || data.revalidateOnRespond === true;
};

const filterOptionsAcceptedByCurrentInteraction = (
    current: EngineInteractionDescriptor,
    options: Array<Required<Pick<SmashUpInteractionOption, 'id'>> & SmashUpInteractionOption>,
): Array<Required<Pick<SmashUpInteractionOption, 'id'>> & SmashUpInteractionOption> => {
    if (!isSmashUpReactionChoiceLiveValidation(current)) {
        return options;
    }

    const currentOptions = Array.isArray((current.data as { options?: unknown }).options)
        ? (current.data as { options: SmashUpInteractionOption[] }).options
        : [];
    const acceptedIds = new Set(
        currentOptions
            .filter((option) => typeof option.id === 'string' && option.disabled !== true)
            .map((option) => option.id as string),
    );
    if (acceptedIds.size === 0) {
        return options;
    }
    return options.filter((option) => acceptedIds.has(option.id));
};

const enumerateInteractionOptionCombinations = <T extends { id: string }>(
    options: T[],
    minCount: number,
    maxCount: number,
): T[][] => {
    const results: T[][] = [];
    const path: T[] = [];

    const dfs = (start: number) => {
        if (path.length >= minCount && path.length <= maxCount) {
            results.push([...path]);
        }
        if (path.length === maxCount) return;

        for (let index = start; index < options.length; index += 1) {
            path.push(options[index]);
            dfs(index + 1);
            path.pop();
        }
    };

    dfs(0);
    return results;
};

const enumerateInteractionOptionPermutations = <T extends { id: string }>(
    options: T[],
    minCount: number,
    maxCount: number,
): T[][] => {
    const results: T[][] = [];
    const path: T[] = [];
    const used = new Set<string>();

    const dfs = () => {
        if (path.length >= minCount && path.length <= maxCount) {
            results.push([...path]);
        }
        if (path.length === maxCount) return;

        for (const option of options) {
            if (used.has(option.id)) continue;
            used.add(option.id);
            path.push(option);
            dfs();
            path.pop();
            used.delete(option.id);
        }
    };

    dfs();
    return results;
};

const buildInteractionActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] | null => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current) return null;
    if (current.playerId !== playerId) return [];
    if (current.kind !== 'simple-choice') {
        return buildAiOwnedBlockingInteractionFallbackActions({
            playerId,
            state: state as MatchState<unknown>,
            legalActions: [],
            adapterInteractionKinds: SMASHUP_AI_INTERACTION_ADAPTER_KINDS,
        });
    }

    const data = current.data as {
        options?: SmashUpInteractionOption[];
        sourceId?: string;
        multi?: PromptMultiConfig;
    };
    const resolvedOptions = isSmashUpReactionChoiceInteraction(current)
        ? getSmashUpReactionChoiceOptions(state, current)
        : getFreshSimpleChoiceOptions(state, current as EngineInteractionDescriptor<unknown>);
    const options = resolvedOptions.filter((option): option is Required<Pick<SmashUpInteractionOption, 'id'>> & SmashUpInteractionOption => {
        return typeof option.id === 'string' && option.disabled !== true;
    });
    const acceptedOptions = filterOptionsAcceptedByCurrentInteraction(current, options);
    const minCount = data.multi?.min ?? 1;
    const maxCount = data.multi?.max ?? minCount;
    const actions: AiLegalAction[] = [];
    const hasExplicitControlOption = acceptedOptions.some((option) => isInteractionControlValue(option.value));

    if (minCount === 0 && !hasExplicitControlOption) {
        actions.push({
            actionId: createAiLegalActionId('interaction', current.id, 'empty-selection'),
            kind: 'interaction-choice',
                label: '不选择任何项',
                commands: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload: buildSimpleChoicePayload(data.sourceId, current.id, [], data.multi),
                }],
            aiHints: [OPTIONAL_SKIP_AI_HINT],
            metadata: {
                interactionId: current.id,
                optionIds: [],
                displayMode: 'button',
                optionValue: [],
                aiHints: [OPTIONAL_SKIP_AI_HINT],
            },
        });
    }

    if (acceptedOptions.length === 0 || acceptedOptions.length < Math.max(1, minCount)) {
        return actions.length > 0
            ? actions
            : [{
                actionId: createAiLegalActionId('interaction', current.id, 'emergency-cancel'),
                kind: 'interaction-cancel',
                label: '取消交互（无可用选项）',
                commands: [{
                    type: 'SYS_INTERACTION_CANCEL',
                    payload: { interactionId: current.id, reason: 'empty-options' },
                }],
                aiHints: [OPTIONAL_SKIP_AI_HINT],
                metadata: {
                    interactionId: current.id,
                    reason: 'empty-options',
                    displayMode: 'button',
                    aiHints: [OPTIONAL_SKIP_AI_HINT],
                },
            }];
    }

    if (data.multi) {
        const combinations = (data.multi.ordered
            ? enumerateInteractionOptionPermutations(acceptedOptions, minCount, maxCount)
            : enumerateInteractionOptionCombinations(acceptedOptions, minCount, maxCount))
            .filter((combination) => {
                if (combination.length === 0) return false;
                const controlOptionCount = combination.filter((option) => isInteractionControlValue(option.value)).length;
                return controlOptionCount === 0 || (controlOptionCount === 1 && combination.length === 1);
            });
        actions.push(...combinations.map((combination, index) => {
            const optionIds = combination.map((option) => option.id);
            const aiHints = combination.flatMap((option) => option._ai ? [option._ai] : []);
            return {
                actionId: createAiLegalActionId('interaction', current.id, 'combo', ...optionIds),
                kind: 'interaction-choice',
                label: combination.map((option) => option.label ?? option.id).join(' + ') || `交互多选 ${index + 1}`,
                commands: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload: buildSimpleChoicePayload(data.sourceId, current.id, optionIds, data.multi),
                }],
                aiHints,
                metadata: {
                    interactionId: current.id,
                    optionIds,
                    optionOrder: index,
                    displayMode: combination[0]?.displayMode,
                    optionValue: combination.map((option) => option.value),
                    aiHints,
                },
            };
        }));
        return actions.length > 0
            ? actions
            : buildAiOwnedBlockingInteractionFallbackActions({
                playerId,
                state: state as MatchState<unknown>,
                legalActions: actions,
                adapterInteractionKinds: SMASHUP_AI_INTERACTION_ADAPTER_KINDS,
            });
    }

    actions.push(...acceptedOptions.map((option, index) => {
        const aiHints = option._ai ? [option._ai] : undefined;
        return {
            actionId: createAiLegalActionId('interaction', current.id, option.id),
            kind: 'interaction-choice',
            label: option.label ?? `交互选择 ${index + 1}`,
            commands: [{
                type: 'SYS_INTERACTION_RESPOND',
                payload: buildSimpleChoicePayload(data.sourceId, current.id, [option.id], data.multi),
            }],
            aiHints,
            metadata: {
                interactionId: current.id,
                optionId: option.id,
                optionOrder: index,
                displayMode: option.displayMode,
                optionValue: option.value,
                aiHints,
            },
        };
    }));

    return actions;
};

const buildFactionSelectActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] => {
    const selection = state.core.factionSelection;
    if (!selection) return [];
    const taken = buildFactionSelectionIdentitySet(selection.takenFactions);
    const actions: AiLegalAction[] = [];
    const selectableFactions = getSelectableFactions(state.core.enabledExpansions ?? ['titans', 'diy']);
    const availableFactions = selectableFactions.filter((factionId) => !taken.has(normalizeFactionSelectionId(factionId)));
    const candidates = availableFactions.length > 0 ? availableFactions : selectableFactions;

    for (const factionId of candidates) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('select-faction', factionId),
            kind: 'select-faction',
            label: `选择派系 ${factionId}`,
            commands: [{
                type: SU_COMMANDS.SELECT_FACTION,
                payload: { factionId },
            }],
            metadata: {
                factionId,
                visibleStepDelayPolicy: 'hidden',
            },
        });
    }

    return actions;
};

const buildPlayMinionAction = (
    state: SmashUpState,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    options?: { fromDiscard?: boolean; inResponseWindow?: boolean },
): AiLegalAction => {
    const power = getMinionLikePower(card.defId) ?? 0;
    const cardStrategyTags = getCardStrategyTags(card.defId, 'minion');
    const {
        baseTotalPower,
        breakpoint,
        gapBefore,
        scoringEligible,
    } = getBasePressureMetrics(state, baseIndex);
    const projectedTotalPower = baseTotalPower + power;
    const base = state.core.bases[baseIndex];
    const ownPowerBefore = base ? getPlayerEffectivePowerOnBase(state.core, base, baseIndex, playerId) : 0;

    return {
        actionId: createAiLegalActionId(
            options?.inResponseWindow ? 'response-play-minion' : 'play-minion',
            card.uid,
            options?.fromDiscard ? 'discard' : 'hand',
            baseIndex,
        ),
        kind: options?.inResponseWindow ? 'response-play-minion' : 'play-minion',
        label: `${options?.fromDiscard ? '从弃牌堆打出' : '打出'}随从 ${getCardLabel(card)} 到 ${getBaseLabel(state, baseIndex)}`,
        commands: [{
            type: SU_COMMANDS.PLAY_MINION,
            payload: {
                cardUid: card.uid,
                baseIndex,
                ...(options?.fromDiscard ? { fromDiscard: true } : {}),
            },
        }],
        metadata: withAiActionStrategyTags({
            cardUid: card.uid,
            defId: card.defId,
            baseIndex,
            power,
            ownPowerBefore,
            baseTotalPower,
            gapBefore,
            projectedTotalPower,
            breakpoint,
            projectedMargin: projectedTotalPower - breakpoint,
            scoringEligible,
            fromDiscard: options?.fromDiscard === true,
        }, cardStrategyTags, { mirrorLegacyCardStrategyTags: true }),
    };
};

const buildPlayActionCandidates = (
    state: SmashUpState,
    card: CardInstance,
    options?: { inResponseWindow?: boolean },
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const cardDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    const responseTiming = cardDef ? getActionLikeResponseWindowTiming(cardDef) : undefined;
    const needsBaseInWindow = cardDef ? actionLikeNeedsResponseWindowBase(cardDef) : false;
    const cardStrategyTags = getCardStrategyTags(card.defId, 'action');
    const labelPrefix = options?.inResponseWindow ? '响应打出' : '打出';
    const kind = options?.inResponseWindow ? 'response-play-action' : 'play-action';

    actions.push({
        actionId: createAiLegalActionId(kind, card.uid, 'self'),
        kind,
        label: `${labelPrefix}行动 ${getCardLabel(card)}`,
        commands: [{
            type: SU_COMMANDS.PLAY_ACTION,
            payload: { cardUid: card.uid },
        }],
        metadata: withAiActionStrategyTags({
            cardUid: card.uid,
            defId: card.defId,
            responseTiming,
            needsBaseInWindow,
        }, cardStrategyTags, { mirrorLegacyCardStrategyTags: true }),
    });

    for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
        const { baseTotalPower, breakpoint, gapBefore, scoringEligible } = getBasePressureMetrics(state, baseIndex);
        actions.push({
            actionId: createAiLegalActionId(kind, card.uid, 'base', baseIndex),
            kind,
            label: `${labelPrefix}行动 ${getCardLabel(card)} 到 ${getBaseLabel(state, baseIndex)}`,
            commands: [{
                type: SU_COMMANDS.PLAY_ACTION,
                payload: {
                    cardUid: card.uid,
                    targetBaseIndex: baseIndex,
                },
            }],
            metadata: withAiActionStrategyTags({
                cardUid: card.uid,
                defId: card.defId,
                targetBaseIndex: baseIndex,
                responseTiming,
                needsBaseInWindow,
                baseTotalPower,
                breakpoint,
                gapBefore,
                scoringEligible,
            }, cardStrategyTags, { mirrorLegacyCardStrategyTags: true }),
        });

        for (const minion of state.core.bases[baseIndex].minions) {
            actions.push({
                actionId: createAiLegalActionId(kind, card.uid, 'base', baseIndex, 'minion', minion.uid),
                kind,
                label: `${labelPrefix}行动 ${getCardLabel(card)} 指向 ${minion.defId}`,
                commands: [{
                    type: SU_COMMANDS.PLAY_ACTION,
                    payload: {
                        cardUid: card.uid,
                        targetBaseIndex: baseIndex,
                        targetMinionUid: minion.uid,
                    },
                }],
                metadata: withAiActionStrategyTags({
                    cardUid: card.uid,
                    defId: card.defId,
                    targetBaseIndex: baseIndex,
                    targetMinionUid: minion.uid,
                    targetMinionDefId: minion.defId,
                    responseTiming,
                    needsBaseInWindow,
                    baseTotalPower,
                    breakpoint,
                    gapBefore,
                    scoringEligible,
                }, cardStrategyTags, { mirrorLegacyCardStrategyTags: true }),
            });
        }
    }

    return actions;
};

const buildPlayableCardActions = (
    state: SmashUpState,
    playerId: PlayerId,
    options?: { inResponseWindow?: boolean },
): AiLegalAction[] => {
    const player = state.core.players[playerId];
    if (!player) return [];

    const actions: AiLegalAction[] = [];
    for (const card of player.hand) {
        if (isCardMinionLike(card)) {
            for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
                appendAction(actions, state, playerId, buildPlayMinionAction(state, playerId, card, baseIndex, {
                    inResponseWindow: options?.inResponseWindow,
                }));
            }
        }

        if (isCardActionLike(card)) {
            for (const action of buildPlayActionCandidates(state, card, {
                inResponseWindow: options?.inResponseWindow,
            })) {
                appendAction(actions, state, playerId, action);
            }
        }
    }

    for (const card of player.discard) {
        if (!isCardMinionLike(card)) continue;
        for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
            appendAction(actions, state, playerId, buildPlayMinionAction(state, playerId, card, baseIndex, {
                fromDiscard: true,
                inResponseWindow: options?.inResponseWindow,
            }));
        }
    }

    return actions;
};

const buildTalentActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];

    state.core.bases.forEach((base, baseIndex) => {
        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('use-talent', 'minion', minion.uid, baseIndex),
                kind: 'use-talent',
                label: `发动随从天赋 ${minion.defId}`,
                commands: [{
                    type: SU_COMMANDS.USE_TALENT,
                    payload: { minionUid: minion.uid, baseIndex },
                }],
                metadata: {
                    baseIndex,
                    minionUid: minion.uid,
                    defId: minion.defId,
                    sourceType: 'minion',
                },
            });
        }

        for (const ongoing of base.ongoingActions) {
            const ongoingControllerId =
                (ongoing.metadata as { sourceControllerId?: string } | undefined)?.sourceControllerId
                ?? ongoing.ownerId;
            if (ongoingControllerId !== playerId) continue;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('use-talent', 'ongoing', ongoing.uid, baseIndex),
                kind: 'use-talent',
                label: `发动持续行动天赋 ${ongoing.defId}`,
                commands: [{
                    type: SU_COMMANDS.USE_TALENT,
                    payload: { ongoingCardUid: ongoing.uid, baseIndex },
                }],
                metadata: {
                    baseIndex,
                    ongoingCardUid: ongoing.uid,
                    defId: ongoing.defId,
                    sourceType: 'ongoing',
                },
            });
        }

        for (const minion of base.minions) {
            for (const attached of minion.attachedActions) {
                const attachedControllerId =
                    (attached.metadata as { sourceControllerId?: string } | undefined)?.sourceControllerId
                    ?? attached.ownerId;
                if (attachedControllerId !== playerId) continue;
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('use-talent', 'attached', attached.uid, baseIndex),
                    kind: 'use-talent',
                    label: `发动附着行动天赋 ${attached.defId}`,
                    commands: [{
                        type: SU_COMMANDS.USE_TALENT,
                        payload: { ongoingCardUid: attached.uid, baseIndex },
                    }],
                    metadata: {
                        baseIndex,
                        ongoingCardUid: attached.uid,
                        defId: attached.defId,
                        sourceType: 'attached',
                    },
                });
            }
        }
    });

    return actions;
};

const buildSpecialActions = (
    state: SmashUpState,
    playerId: PlayerId,
    options?: { includeMinions?: boolean; includeTitans?: boolean },
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const includeMinions = options?.includeMinions ?? true;
    const includeTitans = options?.includeTitans ?? true;
    const manualScoringBaseIndices = new Set(getManualSpecialScoringBaseIndices(state));

    state.core.bases.forEach((base, baseIndex) => {
        if (includeMinions) {
            for (const minion of base.minions) {
                if (minion.controller !== playerId) continue;
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('activate-special', minion.uid, baseIndex),
                    kind: 'activate-special',
                    label: `激活特殊能力 ${minion.defId}`,
                    commands: [{
                        type: SU_COMMANDS.ACTIVATE_SPECIAL,
                        payload: { minionUid: minion.uid, baseIndex },
                    }],
                    metadata: {
                        baseIndex,
                        minionUid: minion.uid,
                        defId: minion.defId,
                        scoringBase: manualScoringBaseIndices.has(baseIndex),
                    },
                });
            }
        }

        if (includeTitans) {
            for (const titan of state.core.titans ?? []) {
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('activate-special', 'titan', titan.uid, baseIndex),
                    kind: 'activate-special',
                    label: `激活泰坦特殊能力 ${titan.defId}`,
                    commands: [{
                        type: SU_COMMANDS.ACTIVATE_SPECIAL,
                        payload: { titanUid: titan.uid, baseIndex },
                    }],
                    metadata: {
                        baseIndex,
                        titanUid: titan.uid,
                        defId: titan.defId,
                        sourceType: 'titan',
                        scoringBase: manualScoringBaseIndices.has(baseIndex),
                    },
                });
            }
        }
    });

    return actions;
};

const buildDiscardActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] => {
    const player = state.core.players[playerId];
    if (!player) return [];
    const excess = player.hand.length - 10;
    if (excess <= 0) return [];

    if (excess === 1) {
        return player.hand.map((card) => ({
            actionId: createAiLegalActionId('discard-to-limit', card.uid),
            kind: 'discard-to-limit',
            label: `弃掉 ${getCardLabel(card)}`,
            commands: [{
                type: SU_COMMANDS.DISCARD_TO_LIMIT,
                payload: { cardUids: [card.uid] },
            }],
            metadata: {
                cardUids: [card.uid],
                discardPriority: -estimateCardKeepValue(card),
            },
        })).filter((action) => isCommandValid(state, playerId, action.commands[0].type, action.commands[0].payload));
    }

    const sorted = [...player.hand].sort((a, b) => estimateCardKeepValue(a) - estimateCardKeepValue(b));
    const discardCards = sorted.slice(0, excess);
    return [{
        actionId: createAiLegalActionId('discard-to-limit', ...discardCards.map((card) => card.uid)),
        kind: 'discard-to-limit',
        label: `弃掉 ${discardCards.map((card) => getCardLabel(card)).join('、')}`,
        commands: [{
            type: SU_COMMANDS.DISCARD_TO_LIMIT,
            payload: { cardUids: discardCards.map((card) => card.uid) },
        }],
        metadata: {
            cardUids: discardCards.map((card) => card.uid),
            discardPriority: -discardCards.reduce((sum, card) => sum + estimateCardKeepValue(card), 0),
        },
    }].filter((action) => isCommandValid(state, playerId, action.commands[0].type, action.commands[0].payload));
};

const buildAdvancePhaseAction = (state: SmashUpState, playerId: PlayerId): AiLegalAction | null => {
    if (!isCommandValid(state, playerId, 'ADVANCE_PHASE')) return null;
    return {
        actionId: createAiLegalActionId('advance-phase', state.sys.phase, playerId),
        kind: 'advance-phase',
        label: '结束当前阶段',
        commands: [{
            type: 'ADVANCE_PHASE',
            payload: {},
        }],
        metadata: {
            phase: state.sys.phase,
        },
    };
};

const estimateCardKeepValue = (card: CardInstance): number => {
    if (isCardMinionLike(card)) {
        return (getMinionLikePower(card.defId) ?? 1) * 10;
    }

    const cardDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!cardDef) return 5;
    const hasManualSpecial = cardDef.type === 'fusion'
        ? getCardDefActivatableAbilities(cardDef, { face: 'action' }).some(ability => ability.kind === 'special')
        : getCardDefActivatableAbilities(cardDef).some(ability => ability.kind === 'special');
    const hasResponseTiming = !!getActionLikeResponseWindowTiming(cardDef);

    if (cardDef.type === 'fusion') {
        if (cardDef.actionSubtype === 'ongoing') return 16;
        if (hasResponseTiming || hasManualSpecial) return 13;
        return 11;
    }

    if (cardDef.subtype === 'ongoing') return 14;
    if (hasResponseTiming || hasManualSpecial) return 11;
    return 9;
};

const buildResponseWindowActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] | null => {
    const reactionWindow = getSmashUpReactionWindowPresentation(state);
    if (reactionWindow) {
        if (reactionWindow.activePlayerId !== playerId) return null;
        const actions: AiLegalAction[] = [{
            actionId: createAiLegalActionId('response-pass', reactionWindow.windowType, playerId),
            kind: 'response-pass',
            label: '跳过响应',
            commands: [{
                type: 'RESPONSE_PASS',
                payload: {},
            }],
            metadata: {
                windowType: reactionWindow.windowType,
            },
        }];

        actions.push(...buildPlayableCardActions(state, playerId, { inResponseWindow: true }));
        return actions;
    }

    const responseWindow = state.sys.responseWindow?.current as {
        sourceId?: unknown;
        responderQueue?: unknown[];
        currentResponderIndex?: number;
        windowType?: string;
    } | undefined;
    if (!responseWindow || responseWindow.sourceId === 'smashup_reaction_choose') return null;

    const currentResponderId = responseWindow.responderQueue?.[responseWindow.currentResponderIndex ?? 0];
    if (currentResponderId !== playerId) return null;
    const windowType = responseWindow.windowType ?? 'response';

    const actions: AiLegalAction[] = [{
        actionId: createAiLegalActionId('response-pass', windowType, playerId),
        kind: 'response-pass',
        label: '跳过响应',
        commands: [{
            type: 'RESPONSE_PASS',
            payload: {},
        }],
        metadata: {
            windowType,
        },
    }];

    actions.push(...buildPlayableCardActions(state, playerId, { inResponseWindow: true }));
    return actions;
};

export function buildSmashUpAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as SmashUpState;
    const playerId = args.playerId;

    if (state.core.gameResult) return [];

    const interactionActions = buildInteractionActions(state, playerId);
    if (interactionActions && interactionActions.length > 0) {
        return interactionActions;
    }

    const responseActions = buildResponseWindowActions(state, playerId);
    if (responseActions && responseActions.length > 0) {
        return responseActions;
    }

    const currentPlayerId = getCurrentPlayerId(state.core);
    if (currentPlayerId !== playerId) {
        return [];
    }

    const phase = state.sys.phase as string;
    const actions: AiLegalAction[] = [];

    if (phase === 'factionSelect') {
        return buildFactionSelectActions(state, playerId);
    }

    if (phase === 'playCards') {
        actions.push(...buildSpecialActions(state, playerId, { includeMinions: true, includeTitans: true }));
        actions.push(...buildTalentActions(state, playerId));
        actions.push(...buildPlayableCardActions(state, playerId));
        const advanceAction = buildAdvancePhaseAction(state, playerId);
        if (advanceAction) actions.push(advanceAction);
        return actions;
    }

    if (phase === 'scoreBases') {
        actions.push(...buildSpecialActions(state, playerId, { includeMinions: true, includeTitans: true }));
        const advanceAction = buildAdvancePhaseAction(state, playerId);
        if (advanceAction) actions.push(advanceAction);
        return actions;
    }

    if (phase === 'draw') {
        const discardActions = buildDiscardActions(state, playerId);
        if (discardActions.length > 0) return discardActions;
        const advanceAction = buildAdvancePhaseAction(state, playerId);
        return advanceAction ? [advanceAction] : [];
    }

    const advanceAction = buildAdvancePhaseAction(state, playerId);
    return advanceAction ? [advanceAction] : [];
}

const actionKindScorer = createActionKindScorer('action-kind', {
    'interaction-choice': 200,
    'response-play-action': 52,
    'response-play-minion': 72,
    'response-pass': 18,
    'activate-special': 70,
    'use-talent': 60,
    'play-minion': 55,
    'play-action': 30,
    'discard-to-limit': 25,
    'select-faction': 20,
    'advance-phase': -40,
});

const factionScorer: LocalAiActionScorer = {
    id: 'setup-faction-composition',
    score(context, action) {
        if (action.kind !== 'select-faction') return null;
        const factionId = typeof action.metadata?.factionId === 'string' ? action.metadata.factionId : '';
        const state = context.visibleState as SmashUpState;
        const selectedFactionIds = getResolvedPlayerFactionIds(state, context.playerId);
        const synergy = scoreFactionSynergy(selectedFactionIds, factionId);
        return {
            score: synergy.score,
            reason: `按派系组合选择 ${String(action.metadata?.factionId ?? '候选派系')}：${synergy.reason}`,
        };
    },
};

const setupFactionRandomScorer: LocalAiActionScorer = {
    id: 'setup-faction-random',
    score(context, action) {
        if (action.kind !== 'select-faction') return null;
        const state = context.visibleState as SmashUpState;
        const selectedFactionIds = getResolvedPlayerFactionIds(state, context.playerId);
        const factionId = typeof action.metadata?.factionId === 'string' ? action.metadata.factionId : '';
        const identityAction = selectedFactionIds.length === 0 && factionId
            ? {
                ...action,
                actionId: createAiLegalActionId('select-faction-identity', normalizeFactionSelectionId(factionId)),
            }
            : action;
        const amplitude = 12;
        const noise = buildDeterministicAiNoise(context, identityAction, 'setup');
        return {
            score: Number((noise * amplitude).toFixed(3)),
            reason: selectedFactionIds.length === 0
                ? '首个派系从合法身份池中随机选择'
                : '相近派系组合之间保留可复现变化',
        };
    },
};

const minionTempoScorer: LocalAiActionScorer = {
    id: 'minion-tempo',
    score(context, action) {
        if (action.kind !== 'play-minion' && action.kind !== 'response-play-minion') return null;
        const state = context.visibleState as SmashUpState;
        const player = state.core.players[context.playerId];
        if (!player) return null;

        const projectedMargin = typeof action.metadata?.projectedMargin === 'number'
            ? action.metadata.projectedMargin
            : -99;
        const power = typeof action.metadata?.power === 'number' ? action.metadata.power : 0;
        const fromDiscard = action.metadata?.fromDiscard === true;
        const actionKindBonus = action.kind === 'response-play-minion' ? 8 : 0;

        let score = power * 2 + actionKindBonus;
        if (player.minionsPlayed < player.minionLimit) score += 22;
        if (projectedMargin >= 0) score += 18 + Math.min(10, projectedMargin);
        else score += Math.max(0, 10 + projectedMargin);
        if (fromDiscard) score += 6;

        return {
            score,
            reason: `优先用随从抢节奏，预计力量差 ${projectedMargin}`,
        };
    },
};

const actionTempoScorer: LocalAiActionScorer = {
    id: 'action-tempo',
    score(context, action) {
        if (action.kind !== 'play-action' && action.kind !== 'response-play-action') return null;
        const state = context.visibleState as SmashUpState;
        const player = state.core.players[context.playerId];
        if (!player) return null;

        const otherPlayableMinions = context.legalActions.some((candidate) => candidate.kind === 'play-minion');
        const targetBaseIndex = typeof action.metadata?.targetBaseIndex === 'number'
            ? action.metadata.targetBaseIndex
            : undefined;
        const responseTiming = typeof action.metadata?.responseTiming === 'string'
            ? action.metadata.responseTiming
            : undefined;
        const cardMetrics = getActionCardAiMetrics(typeof action.metadata?.defId === 'string' ? action.metadata.defId : undefined);
        const pressureBonus = targetBaseIndex !== undefined
            ? Math.max(
                0,
                6 - (
                    getEffectiveBreakpoint(state.core, targetBaseIndex)
                    - getTotalEffectivePowerOnBase(state.core, state.core.bases[targetBaseIndex], targetBaseIndex)
                ),
            )
            : 0;

        if (action.kind === 'response-play-action' && targetBaseIndex === undefined) {
            const hasRealResponseTempo = responseTiming === 'meFirst'
                || (cardMetrics.reactive ?? 0) > 0
                || (cardMetrics.extraAction ?? 0) > 0
                || action.metadata?.scoringEligible === true;

            return {
                score: hasRealResponseTempo ? 4 : -42,
                reason: hasRealResponseTempo
                    ? '这是可在响应窗口兑现的行动牌，保留轻微倾向'
                    : '当前响应窗口没有明确收益，空放行动牌应让位于 response-pass',
            };
        }

        let score = 10 + pressureBonus;
        if (player.minionsPlayed >= player.minionLimit || !otherPlayableMinions) {
            score += 14;
        } else {
            score -= 6;
        }

        if (action.kind === 'response-play-action') score += 10;

        return {
            score,
            reason: targetBaseIndex !== undefined
                ? `行动目标基地压力更高（${targetBaseIndex}）`
                : '补足本回合行动节奏',
        };
    },
};

const interactionValueScorer: LocalAiActionScorer = createInteractionHintScorer({
    id: 'interaction-value',
});

type SmashUpReactionChoiceValue = {
    kind?: string;
    triggerId?: string;
    cardUid?: string;
    targetBaseIndex?: number;
    baseIndex?: number;
    minionUid?: string;
    titanUid?: string;
};

type SmashUpInteractionVisibilityOption = {
    value?: {
        kind?: unknown;
    };
    disabled?: boolean;
};

function shouldUseSharedDecisionViewForReactionOrdering(args: {
    playerId: PlayerId;
    sharedState: MatchState<unknown>;
}): boolean {
    const currentInteraction = (args.sharedState.sys?.interaction as {
        current?: {
            playerId?: unknown;
            kind?: unknown;
            data?: {
                sourceId?: unknown;
                options?: unknown;
            } | null;
        } | null;
    } | undefined)?.current;

    if (!currentInteraction || currentInteraction.playerId !== args.playerId) {
        return false;
    }
    if (currentInteraction.kind !== 'simple-choice') {
        return false;
    }

    const data = currentInteraction.data;
    if (data?.sourceId !== 'smashup_reaction_choose') {
        return false;
    }

    const options = Array.isArray(data.options)
        ? data.options.filter((option): option is SmashUpInteractionVisibilityOption => Boolean(option))
        : [];
    const enabledOptions = options.filter(option => option.disabled !== true);
    if (enabledOptions.length === 0) {
        return false;
    }

    return enabledOptions.every((option) => {
        const kind = option.value?.kind;
        return kind === 'trigger' || kind === 'pass';
    });
}

const readSmashUpReactionChoiceValue = (action: AiLegalAction): SmashUpReactionChoiceValue | null => {
    const rawValue = action.metadata?.optionValue;
    if (!rawValue || typeof rawValue !== 'object') return null;
    return rawValue as SmashUpReactionChoiceValue;
};

const getSmashUpReactionTriggerById = (
    state: SmashUpState,
    triggerId: string | undefined,
): TriggerInstance | null => {
    if (!triggerId) return null;
    return state.core.triggerQueue?.find((trigger) => trigger.id === triggerId) ?? null;
};

const getSmashUpTriggerRelevantBaseIndices = (trigger: TriggerInstance): number[] => {
    const candidates = [
        trigger.sourceBaseIndex,
        trigger.baseIndex,
        trigger.actionTargetBaseIndex,
    ].filter((value): value is number => typeof value === 'number' && value >= 0);
    return [...new Set(candidates)];
};

const estimateSmashUpReactionChoiceUrgency = (
    state: SmashUpState,
    playerId: PlayerId,
    action: AiLegalAction,
): { score: number; reason: string } | null => {
    if (action.kind !== 'interaction-choice') return null;

    const choiceValue = readSmashUpReactionChoiceValue(action);
    if (!choiceValue) return null;

    const normalizedKind = typeof choiceValue.kind === 'string'
        ? choiceValue.kind
        : typeof choiceValue.triggerId === 'string'
            ? 'trigger'
            : null;
    if (!normalizedKind || normalizedKind === 'pass') return null;

    if (normalizedKind === 'trigger') {
        const optionOrder = typeof action.metadata?.optionOrder === 'number'
            ? action.metadata.optionOrder
            : 0;
        const triggerId = typeof choiceValue.triggerId === 'string' ? choiceValue.triggerId : '';
        const liveTrigger = getSmashUpReactionTriggerById(state, triggerId);
        let score = 18 - optionOrder * 3;
        if (triggerId.includes('afterScoring')) score += 6;
        if (triggerId.includes('beforeScoring')) score += 4;
        if (liveTrigger) {
            let bestBaseUrgency = 0;
            for (const baseIndex of getSmashUpTriggerRelevantBaseIndices(liveTrigger)) {
                const { scoringEligible, gapBefore, baseTotalPower, breakpoint } = getBasePressureMetrics(state, baseIndex);
                let baseUrgency = 0;
                if (scoringEligible) baseUrgency += 36;
                else if (gapBefore <= 2) baseUrgency += 16 - gapBefore * 5;
                else if (gapBefore >= 8) baseUrgency -= 6;

                if (baseTotalPower >= breakpoint) baseUrgency += 10;
                bestBaseUrgency = Math.max(bestBaseUrgency, baseUrgency);
            }

            score += bestBaseUrgency;
            if (liveTrigger.ownerPlayerId === playerId) score += 8;
            if (liveTrigger.sourceControllerId === playerId) score += 10;
        }
        return {
            score: Number(score.toFixed(3)),
            reason: liveTrigger
                ? '统一反应入口里的 trigger 应按 live trigger 对当前基地结算的真实影响排序'
                : '统一反应入口里的触发顺序默认沿用当前队列优先级',
        };
    }

    if (normalizedKind === 'play_action') {
        const player = state.core.players[playerId];
        const card = player?.hand.find((candidate) => candidate.uid === choiceValue.cardUid);
        const defId = card?.defId;
        const cardMetrics = getActionCardAiMetrics(defId);
        const strategyTags = defId ? getCardStrategyTags(defId, 'action') : [];
        const targetBaseIndex = typeof choiceValue.targetBaseIndex === 'number'
            ? choiceValue.targetBaseIndex
            : undefined;

        let score = 10;
        if (strategyTags.includes('burst-scoring')) score += 56;
        if ((cardMetrics.reactive ?? 0) > 0) score += (cardMetrics.reactive ?? 0) * 9;
        if ((cardMetrics.extraAction ?? 0) > 0) score += (cardMetrics.extraAction ?? 0) * 6;

        if (targetBaseIndex !== undefined) {
            const { scoringEligible, gapBefore } = getBasePressureMetrics(state, targetBaseIndex);
            if (scoringEligible) score += 84;
            if (gapBefore <= 2) score += 42 - gapBefore * 10;
            if (gapBefore >= 8) score -= 20;
        }

        return {
            score: Number(score.toFixed(3)),
            reason: targetBaseIndex !== undefined
                ? '统一反应入口中存在可直接改写当前计分结果的行动牌'
                : '统一反应入口中的行动牌具备即时收益',
        };
    }

    if (normalizedKind === 'play_minion') {
        const player = state.core.players[playerId];
        const card = player?.hand.find((candidate) => candidate.uid === choiceValue.cardUid)
            ?? player?.discard.find((candidate) => candidate.uid === choiceValue.cardUid);
        const targetBaseIndex = typeof choiceValue.baseIndex === 'number'
            ? choiceValue.baseIndex
            : undefined;
        const power = getMinionLikePower(card?.defId) ?? 0;

        let score = 8 + power * 6;
        if (targetBaseIndex !== undefined) {
            const { scoringEligible, gapBefore, baseTotalPower, breakpoint } = getBasePressureMetrics(state, targetBaseIndex);
            const projectedMargin = baseTotalPower + power - breakpoint;
            if (scoringEligible) score += 68;
            if (projectedMargin >= 0) score += 54;
            else if (gapBefore <= 2) score += 24 - gapBefore * 6;
        }

        return {
            score: Number(score.toFixed(3)),
            reason: '统一反应入口中的随从落点可能直接改写当前基地胜负',
        };
    }

    if (normalizedKind === 'activate_special') {
        const baseIndex = typeof choiceValue.baseIndex === 'number'
            ? choiceValue.baseIndex
            : undefined;
        const scoringEligible = baseIndex !== undefined
            ? getBasePressureMetrics(state, baseIndex).scoringEligible
            : false;
        return {
            score: scoringEligible ? 72 : 24,
            reason: scoringEligible
                ? '统一反应入口中的特殊能力直接作用于当前计分基地'
                : '统一反应入口中的特殊能力仍可能改变后续局面',
        };
    }

    return null;
};

const smashUpReactionChoiceScorer: LocalAiActionScorer = {
    id: 'smashup-reaction-choice',
    score(context, action) {
        if (action.kind !== 'interaction-choice') return null;
        if (context.interaction?.sourceId !== 'smashup_reaction_choose') return null;

        const choiceValue = readSmashUpReactionChoiceValue(action);
        if (!choiceValue) return null;

        if (choiceValue.kind === 'pass') {
            const state = context.visibleState as SmashUpState;
            const bestAlternativeUrgency = context.legalActions.reduce((best, candidate) => {
                if (candidate.actionId === action.actionId) return best;
                const candidateUrgency = estimateSmashUpReactionChoiceUrgency(state, context.playerId, candidate);
                return Math.max(best, candidateUrgency?.score ?? 0);
            }, 0);

            if (bestAlternativeUrgency >= 70) {
                return {
                    score: -96,
                    reason: '统一反应入口里存在能明显改写当前计分的动作，不能直接让过',
                };
            }
            if (bestAlternativeUrgency >= 36) {
                return {
                    score: -28,
                    reason: '统一反应入口里仍有值得优先处理的动作，Pass 仅作次选',
                };
            }
            return {
                score: 18,
                reason: '当前统一反应入口没有足够强的收益动作，Pass 可以作为稳妥收口',
            };
        }

        return estimateSmashUpReactionChoiceUrgency(
            context.visibleState as SmashUpState,
            context.playerId,
            action,
        );
    },
};

const interactionOrderScorer: LocalAiActionScorer = {
    id: 'interaction-order',
    score(_context, action) {
        if (action.kind !== 'interaction-choice') return null;
        const hints = Array.isArray(action.aiHints) ? action.aiHints : [];
        if (hints.length > 0) return null;

        const optionOrder = typeof action.metadata?.optionOrder === 'number'
            ? action.metadata.optionOrder
            : null;
        if (optionOrder === null) return null;

        return {
            score: 18 - optionOrder * 3,
            reason: '在无额外语义时，沿用刷新后的候选顺序稳定决策',
        };
    },
};

const strategyProfileScorer = createProfileAwareActionScorer({
    id: 'strategy-profile-fit',
    allowedKinds: [
        'play-minion',
        'play-action',
        'response-play-minion',
        'response-play-action',
        'activate-special',
        'use-talent',
    ],
    getProfile(context) {
        return getPlayerStrategyProfile(context.visibleState as SmashUpState, context.playerId);
    },
    getActionTags(_context, action) {
        return getSmashUpActionStrategyTags(action);
    },
    evaluate({ context, action, profile, actionTags }) {
        const state = context.visibleState as SmashUpState;
        const urgentBasePressure = context.legalActions.some((candidate) => hasUrgentBasePressure(candidate));
        const scored = scoreActionAgainstPlayerProfile({
            profile,
            actionKind: action.kind,
            cardTags: actionTags,
            phase: state.sys.phase as string | undefined,
            hasUrgentBasePressure: urgentBasePressure,
        });
        if (!scored) return null;
        return {
            score: scored.score,
            reason: scored.reason,
            matchedTags: actionTags,
        };
    },
    formatReason(fit) {
        return fit.profileSummary.length > 0
            ? `${fit.reason}（当前牌组：${fit.profileSummary.join(' / ')}）`
            : fit.reason;
    },
});

const urgentBaseTempoScorer: LocalAiActionScorer = {
    id: 'urgent-base-tempo',
    score(context, action) {
        const scoringEligible = action.metadata?.scoringEligible === true;
        const gapBefore = typeof action.metadata?.gapBefore === 'number'
            ? action.metadata.gapBefore
            : null;
        const projectedMargin = typeof action.metadata?.projectedMargin === 'number'
            ? action.metadata.projectedMargin
            : null;

        if (action.kind === 'play-minion' || action.kind === 'response-play-minion') {
            let score = 0;
            if (projectedMargin !== null && projectedMargin >= 0) {
                score += 65 + Math.min(18, projectedMargin * 2);
            } else if (gapBefore !== null && gapBefore <= 2) {
                score += 26 - gapBefore * 8;
            }
            if (scoringEligible) score += 55;
            if (gapBefore !== null && gapBefore >= 8) score -= 12;
            if (action.kind === 'response-play-minion' && (scoringEligible || (projectedMargin ?? -99) >= 0)) {
                score += 45;
            }

            if (score === 0) return null;
            return {
                score,
                reason: projectedMargin !== null && projectedMargin >= 0
                    ? '临近评分时优先用随从完成或改写基地结算'
                    : '临近评分时优先把力量投向高压基地',
            };
        }

        if (action.kind === 'play-action' || action.kind === 'response-play-action') {
            const targetBaseIndex = typeof action.metadata?.targetBaseIndex === 'number'
                ? action.metadata.targetBaseIndex
                : null;

            if (targetBaseIndex === null) {
                const hasPlayableMinion = context.legalActions.some((candidate) => candidate.kind === 'play-minion');
                if (!hasPlayableMinion) return null;
                return {
                    score: -12,
                    reason: '当前有更直接的随从节奏，不急于空放关键行动牌',
                };
            }

            let score = 0;
            if (scoringEligible) score += 38;
            if (gapBefore !== null && gapBefore <= 3) score += 30 - gapBefore * 6;
            if (gapBefore !== null && gapBefore >= 8) score -= 18;
            if (action.kind === 'response-play-action' && (scoringEligible || (gapBefore !== null && gapBefore <= 2))) {
                score += 70;
            }
            if (score === 0) return null;

            return {
                score,
                reason: action.kind === 'response-play-action'
                    ? '响应窗口内优先处理即将评分的基地'
                    : '行动牌优先投向临近评分的基地窗口',
            };
        }

        if (action.kind === 'response-pass') {
            const urgentResponseExists = context.legalActions.some((candidate) => {
                if (candidate.actionId === action.actionId) return false;
                const candidateGapBefore = typeof candidate.metadata?.gapBefore === 'number'
                    ? candidate.metadata.gapBefore
                    : null;
                const candidateProjectedMargin = typeof candidate.metadata?.projectedMargin === 'number'
                    ? candidate.metadata.projectedMargin
                    : null;
                return candidate.metadata?.scoringEligible === true
                    || (candidateProjectedMargin !== null && candidateProjectedMargin >= 0)
                    || (candidateGapBefore !== null && candidateGapBefore <= 2);
            });

            if (!urgentResponseExists) return null;
            return {
                score: -160,
                reason: '响应窗口里存在立即抢分或改写评分的动作，不能直接让过',
            };
        }

        return null;
    },
};

const limitedRelativeUtilityScorer: LocalAiActionScorer = {
    id: 'relative-utility-smashup-limited',
    score(context, action) {
        if (!RELATIVE_UTILITY_ACTION_KINDS.has(action.kind)) return null;
        if (!shouldApplySmashUpRelativeUtility(context)) return null;

        const utilityMap = buildRelativeUtilityByActionId(context);
        if (utilityMap.size <= 1) return null;

        const relativeUtility = utilityMap.get(action.actionId);
        if (relativeUtility === undefined) return null;

        const score = Number((((relativeUtility - 0.5) * 2) * RELATIVE_UTILITY_WEIGHT).toFixed(3));
        if (score === 0) return null;
        return {
            score,
            reason: `阶段内相对效用 ${(relativeUtility * 100).toFixed(0)}%`,
        };
    },
};

const responsePassScorer: LocalAiActionScorer = {
    id: 'response-pass-control',
    score(context, action) {
        if (action.kind !== 'response-pass') return null;
        const otherResponses = context.legalActions.filter((candidate) => candidate.kind !== 'response-pass');
        const bestAlternativeUrgency = otherResponses.reduce(
            (best, candidate) => Math.max(best, estimateImmediateActionUrgency(candidate)),
            0,
        );
        return {
            score: otherResponses.length === 0
                ? 24
                : bestAlternativeUrgency > 0
                    ? -36 - Math.min(40, bestAlternativeUrgency * 0.8)
                    : 26,
            reason: otherResponses.length === 0
                ? '没有更好的响应，直接让过'
                : bestAlternativeUrgency > 0
                    ? '还有能立刻改写评分的响应，不能直接让过'
                    : '虽然手里还有响应牌，但当前窗口不值得空耗资源',
        };
    },
};

const discardScorer: LocalAiActionScorer = {
    id: 'discard-priority',
    score(_context, action) {
        if (action.kind !== 'discard-to-limit') return null;
        const discardPriority = typeof action.metadata?.discardPriority === 'number'
            ? action.metadata.discardPriority
            : -50;
        return {
            score: discardPriority,
            reason: '优先弃掉保留价值较低的牌',
        };
    },
};

const advancePhaseScorer: LocalAiActionScorer = {
    id: 'advance-when-done',
    score(context, action) {
        if (action.kind !== 'advance-phase') return null;
        const hasPlayableTempoAction = context.legalActions.some((candidate) => {
            return candidate.actionId !== action.actionId && shouldHoldPhaseForSmashUpAction(context, candidate);
        });

        return {
            score: hasPlayableTempoAction ? -60 : 35,
            reason: hasPlayableTempoAction ? '还有可执行动作，不急着过阶段' : '本阶段可做的事基本做完了',
        };
    },
};

const smashUpTalentFollowUpScorers: LocalAiActionScorer[] = [
    actionKindScorer,
    interactionValueScorer,
    smashUpReactionChoiceScorer,
    interactionOrderScorer,
    strategyProfileScorer,
    minionTempoScorer,
    actionTempoScorer,
    urgentBaseTempoScorer,
    responsePassScorer,
    discardScorer,
    advancePhaseScorer,
];

const baselineLocalPolicy = createLookaheadLocalAiPolicy({
    id: 'baseline',
    scorers: [
        actionKindScorer,
        interactionValueScorer,
        smashUpReactionChoiceScorer,
        interactionOrderScorer,
        strategyProfileScorer,
        factionScorer,
        setupFactionRandomScorer,
        minionTempoScorer,
        actionTempoScorer,
        urgentBaseTempoScorer,
        limitedRelativeUtilityScorer,
        responsePassScorer,
        discardScorer,
        advancePhaseScorer,
    ],
    maxReasonCount: 3,
    projectAction({ context, action }) {
        return projectSmashUpAction({ context, action });
    },
    candidateLoop: {
        enabled: true,
        maxIterations: 3,
        batchSize: 5,
        stopOnUtility: 0.9,
    },
    evaluateAssignments({ context, baseEvaluations }) {
        return evaluateSmashUpAssignments({
            context,
            baseEvaluations,
        });
    },
});

export const smashUpAiRuntime: GameAiRuntime = {
    gameId: 'smashup',
    buildLegalActions: buildSmashUpAiLegalActions,
    defaultMinimumActionDelayMs: 3000,
    resolveOnlineDecisionVisibility(args) {
        if (shouldUseSharedDecisionViewForReactionOrdering({
            playerId: args.playerId,
            sharedState: args.sharedState,
        })) {
            return 'shared';
        }
        return undefined;
    },
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
