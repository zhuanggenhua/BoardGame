import type { Command, MatchState, PlayerId } from '../../engine/types';
import {
    buildDeterministicAiNoise,
    createAiLegalActionId,
    createActionKindScorer,
    createInteractionHintScorer,
    createLookaheadLocalAiPolicy,
    createProfileAwareActionScorer,
    getAiActionStrategyTags,
    OPTIONAL_SKIP_AI_HINT,
    withAiActionStrategyTags,
} from '../../engine/ai';
import type { AiDecisionContext, AiHint, AiLegalAction, GameAiRuntime, LocalAiActionScorer } from '../../engine/ai';
import { getFreshSimpleChoiceOptions, type InteractionDescriptor as EngineInteractionDescriptor, type PromptMultiConfig } from '../../engine/systems/InteractionSystem';
import {
    SU_COMMANDS,
    getCurrentPlayerId,
    type ActionCardDef,
    type AbilityTag,
    type CardInstance,
    type FusionCardDef,
    type SmashUpCore,
} from './domain/types';
import { SMASHUP_FACTION_IDS } from './domain/ids';
import { validate } from './domain/commands';
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
import { getCardDef, getMinionLikePower, getBaseDef } from './data/cards';
import {
    getCardStrategyTags,
    getPlayerStrategyProfile,
    getResolvedPlayerFactionIds,
    scoreActionAgainstPlayerProfile,
    scoreFactionSynergy,
} from './aiProfiles';

type SmashUpState = MatchState<SmashUpCore>;
type SmashUpResolvedCardDef = NonNullable<ReturnType<typeof getCardDef>>;
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

const isInteractionControlValue = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { skip?: boolean; done?: boolean; __cancel__?: boolean };
    return candidate.skip === true || candidate.done === true || candidate.__cancel__ === true;
};

const SELECTABLE_FACTIONS = Object.values(SMASHUP_FACTION_IDS).filter((factionId) => factionId !== SMASHUP_FACTION_IDS.MADNESS);

const FACTION_PRIORITY = [
    SMASHUP_FACTION_IDS.ROBOTS,
    SMASHUP_FACTION_IDS.WIZARDS,
    SMASHUP_FACTION_IDS.ALIENS,
    SMASHUP_FACTION_IDS.DINOSAURS,
    SMASHUP_FACTION_IDS.ZOMBIES,
    SMASHUP_FACTION_IDS.NINJAS,
    SMASHUP_FACTION_IDS.PIRATES,
    SMASHUP_FACTION_IDS.TRICKSTERS,
    SMASHUP_FACTION_IDS.GHOSTS,
    SMASHUP_FACTION_IDS.STEAMPUNKS,
    SMASHUP_FACTION_IDS.KILLER_PLANTS,
    SMASHUP_FACTION_IDS.BEAR_CAVALRY,
    SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
    SMASHUP_FACTION_IDS.ELDER_THINGS,
    SMASHUP_FACTION_IDS.INNSMOUTH,
    SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY,
    SMASHUP_FACTION_IDS.FRANKENSTEIN,
    SMASHUP_FACTION_IDS.WEREWOLVES,
    SMASHUP_FACTION_IDS.VAMPIRES,
    SMASHUP_FACTION_IDS.GIANT_ANTS,
    SMASHUP_FACTION_IDS.ALIENS_POD,
    SMASHUP_FACTION_IDS.DINOSAURS_POD,
    SMASHUP_FACTION_IDS.GHOSTS_POD,
    SMASHUP_FACTION_IDS.NINJAS_POD,
    SMASHUP_FACTION_IDS.PIRATES_POD,
    SMASHUP_FACTION_IDS.ROBOTS_POD,
    SMASHUP_FACTION_IDS.TRICKSTERS_POD,
    SMASHUP_FACTION_IDS.WIZARDS_POD,
    SMASHUP_FACTION_IDS.ZOMBIES_POD,
    SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD,
    SMASHUP_FACTION_IDS.STEAMPUNKS_POD,
    SMASHUP_FACTION_IDS.KILLER_PLANTS_POD,
    SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU_POD,
    SMASHUP_FACTION_IDS.ELDER_THINGS_POD,
    SMASHUP_FACTION_IDS.INNSMOUTH_POD,
    SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD,
    SMASHUP_FACTION_IDS.FRANKENSTEIN_POD,
    SMASHUP_FACTION_IDS.WEREWOLVES_POD,
    SMASHUP_FACTION_IDS.VAMPIRES_POD,
    SMASHUP_FACTION_IDS.GIANT_ANTS_POD,
];

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
        return {
            extraMinion: tags.has('extra') ? count * 2.2 : 0,
            ongoing: tags.has('ongoing') ? count * 1.6 : 0,
            reactive: cardDef.beforeScoringPlayable ? count * 2.5 : (tags.has('special') ? count * 1.2 : 0),
            burst: cardDef.power >= 4 ? count * 1.4 : 0,
        };
    }

    if (cardDef.type === 'action') {
        const tags = normalizeAbilityTags(cardDef.abilityTags);
        return {
            extraAction: tags.has('extra') ? count * 2.3 : 0,
            ongoing: cardDef.subtype === 'ongoing' || tags.has('ongoing') ? count * 2.1 : 0,
            reactive: (
                cardDef.specialTiming === 'beforeScoring'
                || cardDef.responseWindowTiming === 'beforeScoring'
                || cardDef.subtype === 'special'
            ) ? count * 2.3 : 0,
            control: cardDef.playNeedsMinion || cardDef.ongoingTarget === 'minion' ? count * 1.1 : 0,
        };
    }

    if (cardDef.type === 'fusion') {
        const minionTags = normalizeAbilityTags(cardDef.minionAbilityTags);
        const actionTags = normalizeAbilityTags(cardDef.actionAbilityTags);
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
                || cardDef.actionSpecialTiming === 'beforeScoring'
                || cardDef.actionResponseWindowTiming === 'beforeScoring'
            ) ? count * 2 : 0,
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

    const eligibleIndices = getScoringEligibleBaseIndices(state.core);
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
    if (state.sys.responseWindow?.current) return false;
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

const getFactionPriority = (factionId: string): number => {
    const index = FACTION_PRIORITY.indexOf(factionId as (typeof FACTION_PRIORITY)[number]);
    return index >= 0 ? index : FACTION_PRIORITY.length + 10;
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

    return strongerPlayers < 3 ? (baseDef.vpAwards[strongerPlayers] ?? 0) : 0;
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
        const tacticalScore = (
            (basePotential?.score ?? 0) * 0.16
            + getBaseSwingValue(basePotential ?? null) * 8
            + urgency * 0.95
            + strategyBonus * 0.55
        );

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
    optionIds: string[],
    multi: PromptMultiConfig | undefined,
): Record<string, unknown> => {
    if (optionIds.length <= 1 && !multi) {
        return { optionId: optionIds[0] };
    }
    if (optionIds.length <= 1 && (multi?.min ?? 0) <= 1) {
        return { optionId: optionIds[0] };
    }
    return { optionIds };
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

const buildInteractionActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] | null => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current || current.playerId !== playerId) return null;
    if (current.kind !== 'simple-choice') return null;

    const data = current.data as {
        options?: SmashUpInteractionOption[];
        multi?: PromptMultiConfig;
    };
    const refreshedOptions = getFreshSimpleChoiceOptions(state, current as EngineInteractionDescriptor<unknown>);
    const options = refreshedOptions.filter((option): option is Required<Pick<SmashUpInteractionOption, 'id'>> & SmashUpInteractionOption => {
        return typeof option.id === 'string' && option.disabled !== true;
    });
    const minCount = data.multi?.min ?? 1;
    const maxCount = data.multi?.max ?? minCount;
    const actions: AiLegalAction[] = [];
    const hasExplicitControlOption = options.some((option) => isInteractionControlValue(option.value));

    if (minCount === 0 && !hasExplicitControlOption) {
        actions.push({
            actionId: createAiLegalActionId('interaction', current.id, 'empty-selection'),
            kind: 'interaction-choice',
            label: '不选择任何项',
            commands: [{
                type: 'SYS_INTERACTION_RESPOND',
                payload: { optionIds: [] },
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

    if (options.length === 0 || options.length < Math.max(1, minCount)) {
        return actions.length > 0
            ? actions
            : [{
                actionId: createAiLegalActionId('interaction', current.id, 'emergency-cancel'),
                kind: 'interaction-cancel',
                label: '取消交互（无可用选项）',
                commands: [{
                    type: 'SYS_INTERACTION_CANCEL',
                    payload: { reason: 'empty-options' },
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
        const combinations = enumerateInteractionOptionCombinations(options, minCount, maxCount)
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
                    payload: buildSimpleChoicePayload(optionIds, data.multi),
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
        return actions;
    }

    actions.push(...options.map((option, index) => {
        const aiHints = option._ai ? [option._ai] : undefined;
        return {
            actionId: createAiLegalActionId('interaction', current.id, option.id),
            kind: 'interaction-choice',
            label: option.label ?? `交互选择 ${index + 1}`,
            commands: [{
                type: 'SYS_INTERACTION_RESPOND',
                payload: buildSimpleChoicePayload([option.id], data.multi),
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
    const taken = new Set(selection.takenFactions);
    const actions: AiLegalAction[] = [];
    const availableFactions = SELECTABLE_FACTIONS.filter((factionId) => !taken.has(factionId));
    const candidates = availableFactions.length > 0 ? availableFactions : SELECTABLE_FACTIONS;

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
                priority: getFactionPriority(factionId),
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
            if (ongoing.ownerId !== playerId) continue;
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
                if (attached.ownerId !== playerId) continue;
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
                        scoringBase: getScoringEligibleBaseIndices(state.core).includes(baseIndex),
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
                        scoringBase: getScoringEligibleBaseIndices(state.core).includes(baseIndex),
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

    if (cardDef.type === 'fusion') {
        if (cardDef.actionSubtype === 'ongoing') return 16;
        if (cardDef.actionSubtype === 'special') return 13;
        return 11;
    }

    if (cardDef.subtype === 'ongoing') return 14;
    if (cardDef.subtype === 'special') return 11;
    return 9;
};

const buildResponseWindowActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] | null => {
    const responseWindow = state.sys.responseWindow?.current;
    if (!responseWindow) return null;

    const currentResponderId = responseWindow.responderQueue?.[responseWindow.currentResponderIndex];
    if (currentResponderId !== playerId) return null;

    const actions: AiLegalAction[] = [{
        actionId: createAiLegalActionId('response-pass', responseWindow.windowType, playerId),
        kind: 'response-pass',
        label: '跳过响应',
        commands: [{
            type: 'RESPONSE_PASS',
            payload: {},
        }],
        metadata: {
            windowType: responseWindow.windowType,
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
    id: 'faction-priority',
    score(context, action) {
        if (action.kind !== 'select-faction') return null;
        const priority = typeof action.metadata?.priority === 'number'
            ? action.metadata.priority
            : FACTION_PRIORITY.length + 10;
        const factionId = typeof action.metadata?.factionId === 'string' ? action.metadata.factionId : '';
        const state = context.visibleState as SmashUpState;
        const selectedFactionIds = getResolvedPlayerFactionIds(state, context.playerId);
        const synergy = scoreFactionSynergy(selectedFactionIds, factionId);
        return {
            score: 40 - priority + synergy.score,
            reason: `优先选择 ${String(action.metadata?.factionId ?? '稳定派系')}：${synergy.reason}`,
        };
    },
};

const setupFactionRandomScorer: LocalAiActionScorer = {
    id: 'setup-faction-random',
    score(context, action) {
        if (action.kind !== 'select-faction') return null;
        const amplitude = Math.max(0, Math.min(12, context.difficulty?.randomness ?? 6));
        if (amplitude === 0) {
            return null;
        }
        const noise = buildDeterministicAiNoise(context, action, 'setup');
        return {
            score: Number((noise * amplitude).toFixed(3)),
            reason: '派系选择随机扰动',
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
            return candidate.actionId !== action.actionId
                && candidate.kind !== 'response-pass'
                && candidate.kind !== 'discard-to-limit';
        });

        return {
            score: hasPlayableTempoAction ? -60 : 35,
            reason: hasPlayableTempoAction ? '还有可执行动作，不急着过阶段' : '本阶段可做的事基本做完了',
        };
    },
};

const baselineLocalPolicy = createLookaheadLocalAiPolicy({
    id: 'baseline',
    scorers: [
        actionKindScorer,
        interactionValueScorer,
        interactionOrderScorer,
        strategyProfileScorer,
        factionScorer,
        setupFactionRandomScorer,
        minionTempoScorer,
        actionTempoScorer,
        urgentBaseTempoScorer,
        responsePassScorer,
        discardScorer,
        advancePhaseScorer,
    ],
    maxReasonCount: 3,
    projectAction({ context, action }) {
        return projectSmashUpAction({ context, action });
    },
});

export const smashUpAiRuntime: GameAiRuntime = {
    gameId: 'smashup',
    buildLegalActions: buildSmashUpAiLegalActions,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
