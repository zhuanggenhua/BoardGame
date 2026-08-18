import type { Command, MatchState, PlayerId } from '../../engine/types';
import {
    buildDeterministicAiNoise,
    buildSelectPlayerDecisionActions,
    createAiLegalActionId,
    createProfileAwareActionScorer,
    getAiActionStrategyTags,
    isManualSetupSelectionEnabledForSeat,
    scoreActionAgainstStrategyProfile,
    withAiActionStrategyTags,
} from '../../engine/ai';
import {
    createActionKindScorer,
    createLookaheadLocalAiPolicy,
} from '../../engine/ai';
import {
    OPTIONAL_SKIP_AI_HINT,
    buildTargetAiHint,
    createInteractionHintScorer,
} from '../../engine/ai/semantics';
import type {
    AiDecisionContext,
    AiLegalAction,
    AiStrategyProfile,
    AiEffectIntent,
    AiHint,
    AiSelectPlayerDecisionDescriptor,
    GameAiRuntime,
    LocalAiActionScorer,
    OnlineAiDecisionVisibility,
} from '../../engine/ai';
import type { InteractionDescriptor as EngineInteractionDescriptor, MultistepChoiceData, PromptMultiConfig } from '../../engine/systems/InteractionSystem';
import { DiceThroneDomain } from './domain';
import {
    RESOURCE_IDS,
    STATUS_IDS,
    canAdvancePhase,
    isSetupReadyToStart,
    canSellCard,
    checkPlayCard,
    checkPlayUpgradeCard,
    getActiveDice,
    getAvailableAbilityIds,
    getDefensiveAbilityIds,
    getPlayableCardsInResponseWindow,
    getNextPhase,
} from './domain';
import { DICETHRONE_COMMANDS } from './domain/ids';
import { DICETHRONE_CHARACTER_CATALOG, type SelectableCharacterId } from './domain/types';
import { findPlayerAbility, getPlayerAbilityBaseDamage, getPlayerAbilityEffects } from './domain/abilityLookup';
import { getPlayerPassiveAbilities, isPassiveActionUsable } from './domain/passiveAbility';
import { areTeammates, getOpponents, getPendingBonusSettlementDice, getRollerId } from './domain/rules';
import { isDirectDiceInterferenceActor } from './domain/responseWindowGuards';
import { hasDebuffs, hasPurifyToken, getUsableTokensForTiming } from './domain/tokenResponse';
import { getTokenEffectValue, type EffectAction, type RollDieConditionalEffect, type RollDieDefaultEffect } from './domain/tokenTypes';
import { getDieFaceByValue } from './domain/diceRegistry';
import { getCustomActionMeta } from './domain/effects';
import { isCurrentBonusRollSettlement, resolveCurrentRollContext } from './domain/rollContext';
import type { AbilityEffect, TriggerCondition } from './domain/combat';
import type {
    AbilityCard,
    CharacterDefinition,
    DiceThroneCore,
    DtResponseWindowType,
    PendingBonusDiceSettlement,
    PendingDamage,
    TurnPhase,
} from './domain/types';
import { evaluateDiceThroneBoardState } from './ai/evaluation';
import {
    assessDiceThroneDiceInterferenceResponseGate,
    type DiceInterferenceResponseGate,
} from './ai/responseValueGate';
import {
    getDiceThroneHeroStrategyProfile,
    type DiceThroneHeroStrategyProfile,
} from './ai/profiles';

type DiceThroneState = MatchState<DiceThroneCore>;

const getDiceThronePhaseFromState = (state: DiceThroneState): TurnPhase => (
    state.sys.phase ?? state.sys.flow?.phase ?? 'setup'
) as TurnPhase;

const getAiActiveDice = (
    state: DiceThroneState,
    phase: TurnPhase = getDiceThronePhaseFromState(state),
): DiceThroneCore['dice'] => getActiveDice(state.core, phase);

type DiceThroneStrategyTag =
    | 'damage-race'
    | 'survive-response'
    | 'economy'
    | 'dice-setup'
    | 'upgrade-engine'
    | 'purify-control';

const isDiceThroneCharacterReadyForAiSetup = (character: CharacterDefinition): boolean => (
    !character.badges?.some((badge) => badge.id === 'implementation_in_progress')
);

const AI_SELECTABLE_DICETHRONE_CHARACTER_CATALOG = DICETHRONE_CHARACTER_CATALOG.filter(
    isDiceThroneCharacterReadyForAiSetup,
);

const resolveDiceThroneCurrentDecisionPlayerId = (args: {
    state: MatchState<unknown>;
    fallbackPlayerId: PlayerId | null;
}): PlayerId | null | undefined => {
    const diceThroneState = args.state as DiceThroneState | null | undefined;
    const responseWindowCurrent = diceThroneState?.sys?.responseWindow?.current;
    const currentInteraction = diceThroneState?.sys?.interaction?.current as {
        kind?: unknown;
        playerId?: unknown;
    } | null | undefined;
    if (!responseWindowCurrent && currentInteraction?.kind === 'dt:bonus-dice') {
        return typeof currentInteraction.playerId === 'string' && currentInteraction.playerId.length > 0
            ? currentInteraction.playerId
            : args.fallbackPlayerId ?? undefined;
    }
    const settlement = diceThroneState?.core?.pendingBonusDiceSettlement as PendingBonusDiceSettlement | undefined;
    if (!responseWindowCurrent && settlement && isCurrentBonusRollSettlement(diceThroneState.core, settlement)) {
        return typeof settlement.attackerId === 'string' && settlement.attackerId.length > 0
            ? settlement.attackerId
            : args.fallbackPlayerId ?? undefined;
    }
    if (diceThroneState?.sys?.phase !== 'defensiveRoll') return undefined;
    const defenderId = diceThroneState.core?.pendingAttack?.defenderId;
    return typeof defenderId === 'string' && defenderId.length > 0
        ? defenderId
        : args.fallbackPlayerId ?? undefined;
};

const resolveDiceThroneOnlineDecisionVisibility = (args: {
    playerId: PlayerId;
    sharedState: MatchState<unknown>;
    privateOverlay: MatchState<unknown> | null;
}): OnlineAiDecisionVisibility | null => {
    const sharedState = args.sharedState as DiceThroneState | null | undefined;
    const sharedInteraction = sharedState?.sys?.interaction?.current as {
        kind?: unknown;
        playerId?: unknown;
    } | null | undefined;
    const sharedResponseWindowCurrent = sharedState?.sys?.responseWindow?.current;
    const settlement = sharedState?.core?.pendingBonusDiceSettlement as PendingBonusDiceSettlement | undefined;
    if (
        !sharedResponseWindowCurrent
        && sharedInteraction?.kind === 'dt:bonus-dice'
        && sharedInteraction.playerId === args.playerId
        && settlement?.attackerId === args.playerId
        && isCurrentBonusRollSettlement(sharedState.core, settlement)
    ) {
        return 'shared';
    }

    const sharedDecisionOwnerId = resolveDiceThroneCurrentDecisionPlayerId({
        state: args.sharedState,
        fallbackPlayerId: null,
    });
    if (sharedDecisionOwnerId !== args.playerId) {
        return null;
    }

    return 'private-required';
};

type DiceRequirement =
    | { kind: 'faces'; faces: Record<string, number> }
    | { kind: 'straight'; sequences: number[][] };

type DiceTargetPlan = {
    abilityId: string;
    keepDieIds: number[];
    missingCount: number;
    matchedCount: number;
    totalRequired: number;
    available: boolean;
    strategicScore: number;
    ambitionScore: number;
    profileFitScore: number;
};

type DiceChaseContext = {
    plans: DiceTargetPlan[];
    availablePlan: DiceTargetPlan | null;
    availableAmbition: number;
    remainingRolls: number;
    diceToolCardCount: number;
    heroStrategy: DiceThroneHeroStrategyProfile;
};

type DiceChaseCandidate = {
    plan: DiceTargetPlan;
    chaseScore: number;
};

type DiceInteractionData = MultistepChoiceData<unknown, unknown> & {
    meta?: {
        dtType?: 'modifyDie' | 'selectDie';
        selectCount?: number;
        dieModifyConfig?: {
            mode?: 'set' | 'adjust' | 'copy' | 'any';
            targetValue?: number;
        };
        diceOwnerId?: PlayerId;
        targetOpponentDice?: boolean;
    };
};

type CardInteractionData = {
    type?: string;
    sourceCardId?: string;
    titleKey?: string;
    targetPlayerIds?: PlayerId[];
    selectCount?: number;
    requiresTargetWithStatus?: boolean;
    resolveCustomActionId?: string;
    transferConfig?: {
        sourcePlayerId?: PlayerId;
        statusId?: string;
    };
    tokenGrantConfig?: {
        tokenId: string;
        amount: number;
    };
    tokenGrantConfigs?: Array<{
        tokenId: string;
        amount: number;
    }>;
    statusGrantConfig?: {
        statusId: string;
        amount: number;
    };
    statusGrantConfigs?: Array<{
        statusId: string;
        amount: number;
    }>;
};

type ChoiceOptionValue = {
    statusId?: string;
    tokenId?: string;
    value?: number;
    customId?: string;
    labelKey?: string;
    disabled?: boolean;
    __emergency_skip__?: boolean;
    __emergency_skip_reason__?: string;
};

type SimpleChoiceOption = {
    id?: string;
    label?: string;
    disabled?: boolean;
    value?: ChoiceOptionValue;
    _ai?: AiHint;
};

const createCommand = (playerId: PlayerId, type: string, payload: unknown = {}): Command => ({
    type,
    playerId,
    payload,
    timestamp: 0,
});

const isCommandValid = (state: DiceThroneState, playerId: PlayerId, type: string, payload: unknown = {}): boolean => {
    const result = DiceThroneDomain.validate(state, createCommand(playerId, type, payload) as never);
    return result.valid;
};

const isOffensiveRollRerollBlockedByBindCp = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
): boolean => {
    if (phase !== 'offensiveRoll') return false;
    const bindStacks = state.core.players[playerId]?.statusEffects[STATUS_IDS.BIND] ?? 0;
    const currentCp = state.core.players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    return bindStacks > 0 && state.core.rollCount > 0 && currentCp < 1;
};

const appendAction = (
    actions: AiLegalAction[],
    state: DiceThroneState,
    playerId: PlayerId,
    action: AiLegalAction,
): void => {
    if (action.commands.length === 0) return;
    const commandSpecs = action.commands.map((command) => ({
        type: command.type,
        payload: command.payload,
    }));
    const isValid = commandSpecs.every((command) => isCommandValid(state, playerId, command.type, command.payload));
    if (!isValid) return;
    actions.push(action);
};

const withVisibleStepDelayPolicy = (
    metadata: Record<string, unknown>,
    visibleStepDelayPolicy: 'hidden' | 'visible',
): Record<string, unknown> => ({
    ...metadata,
    visibleStepDelayPolicy,
});

const buildSimpleChoicePayload = (
    optionIds: string[],
    multi: PromptMultiConfig | undefined,
): { optionId?: string; optionIds?: string[] } => {
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

const enumerateArrayCombinations = <T>(
    items: T[],
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

        for (let index = start; index < items.length; index += 1) {
            path.push(items[index]);
            dfs(index + 1);
            path.pop();
        }
    };

    dfs(0);
    return results;
};

const enumeratePerItemValueAssignments = <T>(
    items: T[],
    resolveValues: (item: T, index: number) => number[],
): number[][] => {
    const results: number[][] = [];
    const path: number[] = [];

    const dfs = (index: number) => {
        if (index >= items.length) {
            results.push([...path]);
            return;
        }

        const values = Array.from(new Set(resolveValues(items[index], index)));
        if (values.length === 0) {
            return;
        }

        for (const value of values) {
            path.push(value);
            dfs(index + 1);
            path.pop();
        }
    };

    dfs(0);
    return results;
};

const enumerateOrderedSelections = <T>(
    items: T[],
    count: number,
): T[][] => {
    if (count <= 0) return [[]];
    if (count > items.length) return [];

    const results: T[][] = [];
    const path: T[] = [];
    const used = new Set<number>();

    const dfs = () => {
        if (path.length === count) {
            results.push([...path]);
            return;
        }

        for (let index = 0; index < items.length; index += 1) {
            if (used.has(index)) continue;
            used.add(index);
            path.push(items[index]);
            dfs();
            path.pop();
            used.delete(index);
        }
    };

    dfs();
    return results;
};

const normalizePositiveStepCount = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.max(1, Math.floor(value));
};

const resolveDiceInteractionSelectionBounds = (
    data: DiceInteractionData,
    selectableCount: number,
    completedCount: number,
): { selectCount: number; minSelectionCount: number } | null => {
    if (selectableCount <= 0) return null;

    const metaSelectCount = normalizePositiveStepCount(data.meta?.selectCount);
    const maxSteps = normalizePositiveStepCount(data.maxSteps);
    const minSteps = normalizePositiveStepCount(data.minSteps);
    const totalSelectLimit = Math.max(1, Math.min(metaSelectCount ?? maxSteps ?? 1, selectableCount + completedCount));
    const remainingMaxBySteps = maxSteps !== null
        ? Math.max(0, maxSteps - completedCount)
        : selectableCount;
    const selectCount = Math.min(totalSelectLimit, remainingMaxBySteps, selectableCount);
    if (selectCount <= 0) return null;

    const exactModifyMinSteps = data.meta?.dtType === 'modifyDie' && maxSteps !== null
        ? maxSteps
        : null;
    const requiredTotalMin = minSteps ?? exactModifyMinSteps ?? 1;
    const remainingMin = Math.max(0, requiredTotalMin - completedCount);
    const minSelectionCount = Math.max(1, Math.min(remainingMin > 0 ? remainingMin : 1, selectCount));

    return { selectCount, minSelectionCount };
};

const sumFaceRequirement = (faces: Record<string, number>): number => {
    return Object.values(faces).reduce((sum, count) => sum + count, 0);
};

const mergeFaceRequirements = (requirements: DiceRequirement[]): DiceRequirement | null => {
    const merged: Record<string, number> = {};
    for (const requirement of requirements) {
        if (requirement.kind !== 'faces') return null;
        for (const [face, count] of Object.entries(requirement.faces)) {
            merged[face] = Math.max(merged[face] ?? 0, count);
        }
    }
    return { kind: 'faces', faces: merged };
};

const extractDiceRequirements = (trigger: TriggerCondition | undefined): DiceRequirement[] => {
    if (!trigger) return [];

    switch (trigger.type) {
        case 'diceSet':
            return [{ kind: 'faces', faces: trigger.faces }];
        case 'allSymbolsPresent':
            return [{
                kind: 'faces',
                faces: trigger.symbols.reduce<Record<string, number>>((acc, symbol) => {
                    acc[symbol] = 1;
                    return acc;
                }, {}),
            }];
        case 'smallStraight':
            return [{
                kind: 'straight',
                sequences: [
                    [1, 2, 3, 4],
                    [2, 3, 4, 5],
                    [3, 4, 5, 6],
                ],
            }];
        case 'largeStraight':
            return [{
                kind: 'straight',
                sequences: [
                    [1, 2, 3, 4, 5],
                    [2, 3, 4, 5, 6],
                ],
            }];
        case 'composite': {
            if (trigger.logic === 'or') {
                return trigger.conditions.flatMap((condition) => extractDiceRequirements(condition as TriggerCondition));
            }
            const childRequirements = trigger.conditions
                .flatMap((condition) => extractDiceRequirements(condition as TriggerCondition));
            if (childRequirements.length === 0) return [];
            const merged = mergeFaceRequirements(childRequirements);
            return merged ? [merged] : [];
        }
        default:
            return [];
    }
};

const pickMatchingDiceIds = (dice: DiceThroneCore['dice'], face: string, count: number): number[] => {
    return dice
        .filter((die) => die.symbol === face)
        .sort((left, right) => Number(right.isKept) - Number(left.isKept) || right.value - left.value)
        .slice(0, count)
        .map((die) => die.id);
};

const evaluateDiceRequirement = (
    dice: DiceThroneCore['dice'],
    requirement: DiceRequirement,
): Pick<DiceTargetPlan, 'keepDieIds' | 'missingCount' | 'matchedCount' | 'totalRequired'> => {
    if (requirement.kind === 'faces') {
        const keepDieIds = Object.entries(requirement.faces).flatMap(([face, count]) => {
            return pickMatchingDiceIds(dice, face, count);
        });
        const totalRequired = sumFaceRequirement(requirement.faces);
        return {
            keepDieIds,
            matchedCount: keepDieIds.length,
            missingCount: Math.max(0, totalRequired - keepDieIds.length),
            totalRequired,
        };
    }

    let best = {
        keepDieIds: [] as number[],
        matchedCount: 0,
        missingCount: requirement.sequences[0]?.length ?? 0,
        totalRequired: requirement.sequences[0]?.length ?? 0,
    };

    for (const sequence of requirement.sequences) {
        const keepDieIds: number[] = [];
        for (const value of sequence) {
            const die = dice
                .filter((candidate) => candidate.value === value && !keepDieIds.includes(candidate.id))
                .sort((left, right) => Number(right.isKept) - Number(left.isKept))[0];
            if (die) keepDieIds.push(die.id);
        }

        if (keepDieIds.length > best.keepDieIds.length) {
            best = {
                keepDieIds,
                matchedCount: keepDieIds.length,
                missingCount: Math.max(0, sequence.length - keepDieIds.length),
                totalRequired: sequence.length,
            };
        }
    }

    return best;
};

const getAbilityStrategicScore = (
    state: DiceThroneState,
    playerId: PlayerId,
    abilityId: string,
    phase: TurnPhase,
): number => {
    const match = findPlayerAbility(state.core, playerId, abilityId);
    if (!match) return 0;

    const baseDamage = getPlayerAbilityBaseDamage(state.core, playerId, abilityId);
    const incomingDamage = state.core.pendingDamage?.targetPlayerId === playerId
        ? state.core.pendingDamage.currentDamage
        : 0;
    let score = baseDamage * 25 + (match.variant?.priority ?? 0);

    if (match.ability.type === 'offensive' && phase === 'offensiveRoll') {
        score += 90;
    }
    if ((match.ability.type === 'defensive' || match.ability.tags?.includes('defensive')) && phase === 'defensiveRoll') {
        score += 110 + incomingDamage * 14;
    }
    if (match.ability.tags?.includes('ultimate') || match.variant?.tags?.includes('ultimate')) {
        score += 45;
    }

    return score;
};

const getAbilityAmbitionScore = (
    state: DiceThroneState,
    playerId: PlayerId,
    abilityId: string,
    trigger: TriggerCondition | undefined,
): number => {
    const match = findPlayerAbility(state.core, playerId, abilityId);
    if (!match) return 0;

    if (match.ability.tags?.includes('ultimate') || match.variant?.tags?.includes('ultimate')) {
        return 360;
    }

    if (trigger?.type === 'largeStraight') {
        return 180;
    }

    if (trigger?.type === 'smallStraight') {
        return 70;
    }

    if (trigger?.type === 'diceSet') {
        const totalRequired = sumFaceRequirement(trigger.faces);
        if (totalRequired >= 5) return 240;
        if (totalRequired === 4) return 110;
        if (totalRequired === 3) return -45;
    }

    return 0;
};

const getAbilityProfileFitScore = (
    state: DiceThroneState,
    playerId: PlayerId,
    abilityId: string,
    phase: TurnPhase,
): number => {
    const profile = getDiceThroneStrategyProfile(state, playerId, phase);
    const fit = scoreActionAgainstStrategyProfile({
        profile,
        actionTags: buildAbilityStrategyTags(state, playerId, abilityId),
        weightMultiplier: 14,
    });
    return fit?.score ?? 0;
};

const DICE_TOOL_CUSTOM_ACTION_IDS = new Set([
    'modify-die-to-6',
    'modify-die-copy',
    'modify-die-any-1',
    'modify-die-any-2',
    'modify-die-adjust-1',
    'reroll-die-2',
    'reroll-die-5',
]);

const countAffordableDiceToolCards = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
): number => {
    if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') return 0;
    if (playerId !== getRollerId(state.core, phase)) return 0;

    const player = state.core.players[playerId];
    if (!player) return 0;
    const cp = player.resources[RESOURCE_IDS.CP] ?? 0;

    return player.hand.filter((card) => {
        if (cp < card.cpCost) return false;
        return card.effects?.some((effect) => {
            const customActionId = effect.action?.type === 'custom'
                ? effect.action.customActionId
                : null;
            if (!customActionId || !DICE_TOOL_CUSTOM_ACTION_IDS.has(customActionId)) return false;
            return effect.action?.target !== 'opponent';
        }) ?? false;
    }).length;
};

const buildDiceTargetPlans = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    diceOverride?: DiceThroneCore['dice'],
): DiceTargetPlan[] => {
    const player = state.core.players[playerId];
    if (!player) return [];

    const availableIds = new Set(getAvailableAbilityIds(state.core, playerId, phase));
    const expectedType = phase === 'defensiveRoll' ? 'defensive' : phase === 'offensiveRoll' ? 'offensive' : undefined;
    const dice = diceOverride ?? getAiActiveDice(state, phase);
    const plans: DiceTargetPlan[] = [];

    const pushPlan = (abilityId: string, trigger: TriggerCondition | undefined) => {
        const strategicScore = getAbilityStrategicScore(state, playerId, abilityId, phase);
        const ambitionScore = getAbilityAmbitionScore(state, playerId, abilityId, trigger);
        const profileFitScore = getAbilityProfileFitScore(state, playerId, abilityId, phase);
        const requirements = extractDiceRequirements(trigger);
        if (requirements.length === 0) {
            if (!availableIds.has(abilityId)) return;
            plans.push({
                abilityId,
                keepDieIds: [],
                missingCount: 0,
                matchedCount: 0,
                totalRequired: 0,
                available: true,
                strategicScore,
                ambitionScore,
                profileFitScore,
            });
            return;
        }

        for (const requirement of requirements) {
            const evaluation = evaluateDiceRequirement(dice, requirement);
            plans.push({
                abilityId,
                ...evaluation,
                available: diceOverride ? evaluation.missingCount === 0 : availableIds.has(abilityId),
                strategicScore,
                ambitionScore,
                profileFitScore,
            });
        }
    };

    for (const ability of player.abilities) {
        if (expectedType && ability.type !== expectedType) continue;

        if (ability.variants?.length) {
            for (const variant of ability.variants) {
                pushPlan(variant.id, variant.trigger);
            }
            continue;
        }

        pushPlan(ability.id, ability.trigger);
    }

    return plans;
};

const scoreDiceTargetPlan = (
    state: DiceThroneState,
    phase: TurnPhase,
    plan: DiceTargetPlan,
): number => {
    const isRollPhase = phase === 'offensiveRoll' || phase === 'defensiveRoll';
    const remainingRolls = isRollPhase
        ? Math.max(0, state.core.rollLimit - state.core.rollCount)
        : 0;
    const missingPenalty = !isRollPhase
        ? 36
        : state.core.rollConfirmed
            ? 120
            : (remainingRolls <= 0 ? 120 : (remainingRolls === 1 ? 60 : 36));
    const availableBonus = !isRollPhase
        ? 60
        : state.core.rollConfirmed || remainingRolls <= 0
            ? 100
            : 60;

    const canStillChaseHigherPlan = isRollPhase && !state.core.rollConfirmed && remainingRolls > 0;
    const ambitionScore = canStillChaseHigherPlan ? plan.ambitionScore * 0.16 : 0;

    return plan.strategicScore
        + plan.profileFitScore
        + ambitionScore
        + plan.matchedCount * 18
        - plan.missingCount * missingPenalty
        + (plan.available ? availableBonus : 0);
};

const getBestDiceTargetPlan = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    diceOverride?: DiceThroneCore['dice'],
): DiceTargetPlan | null => {
    const plans = buildDiceTargetPlans(state, playerId, phase, diceOverride);
    if (plans.length === 0) return null;

    return [...plans].sort((left, right) => {
        const leftScore = scoreDiceTargetPlan(state, phase, left);
        const rightScore = scoreDiceTargetPlan(state, phase, right);
        if (rightScore !== leftScore) return rightScore - leftScore;
        if (left.missingCount !== right.missingCount) return left.missingCount - right.missingCount;
        return right.strategicScore - left.strategicScore;
    })[0] ?? null;
};

const getBestAvailableDiceTargetPlan = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    diceOverride?: DiceThroneCore['dice'],
): DiceTargetPlan | null => {
    const plans = buildDiceTargetPlans(state, playerId, phase, diceOverride).filter((plan) => plan.available);
    if (plans.length === 0) return null;

    return [...plans].sort((left, right) => {
        const leftScore = scoreDiceTargetPlan(state, phase, left);
        const rightScore = scoreDiceTargetPlan(state, phase, right);
        if (rightScore !== leftScore) return rightScore - leftScore;
        if (right.ambitionScore !== left.ambitionScore) return right.ambitionScore - left.ambitionScore;
        return right.strategicScore - left.strategicScore;
    })[0] ?? null;
};

const getBestStableDiceTargetPlan = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    diceOverride?: DiceThroneCore['dice'],
): DiceTargetPlan | null => {
    const plans = buildDiceTargetPlans(state, playerId, phase, diceOverride);
    if (plans.length === 0) return null;

    const isRollPhase = phase === 'offensiveRoll' || phase === 'defensiveRoll';
    const remainingRolls = isRollPhase
        ? Math.max(0, state.core.rollLimit - state.core.rollCount)
        : 0;
    const missingPenalty = !isRollPhase
        ? 36
        : state.core.rollConfirmed
            ? 120
            : (remainingRolls <= 0 ? 120 : (remainingRolls === 1 ? 60 : 36));
    const availableBonus = !isRollPhase
        ? 60
        : state.core.rollConfirmed || remainingRolls <= 0
            ? 100
            : 60;
    const stableScore = (plan: DiceTargetPlan) => (
        plan.strategicScore
        + plan.profileFitScore
        + plan.matchedCount * 18
        - plan.missingCount * missingPenalty
        + (plan.available ? availableBonus : 0)
    );

    return [...plans].sort((left, right) => {
        const leftScore = stableScore(left);
        const rightScore = stableScore(right);
        if (rightScore !== leftScore) return rightScore - leftScore;
        if (left.missingCount !== right.missingCount) return left.missingCount - right.missingCount;
        return right.strategicScore - left.strategicScore;
    })[0] ?? null;
};

const estimateDiceChaseProbability = (
    plan: DiceTargetPlan,
    remainingRolls: number,
    diceToolCardCount: number,
): number => {
    if (plan.missingCount <= 0) return 1;
    if (remainingRolls <= 0 && diceToolCardCount <= 0) return 0;

    const effectiveAttempts = Math.max(1, remainingRolls + Math.min(1, diceToolCardCount));
    const singleMissingChance = 1 - (5 / 6) ** effectiveAttempts;
    const baseChance = singleMissingChance ** plan.missingCount;
    const cardBoost = diceToolCardCount > 0
        ? Math.min(0.28, diceToolCardCount * 0.08 + (plan.missingCount <= 2 ? 0.12 : 0))
        : 0;

    return Math.min(0.92, Number((baseChance + cardBoost).toFixed(4)));
};

const buildDiceChaseContext = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    currentAbilityId?: string | null,
): DiceChaseContext | null => {
    if (phase !== 'offensiveRoll') return null;
    if (state.core.rollConfirmed) return null;

    const remainingRolls = Math.max(0, state.core.rollLimit - state.core.rollCount);
    if (remainingRolls <= 0) return null;

    const plans = buildDiceTargetPlans(state, playerId, phase);
    const availablePlan = currentAbilityId
        ? plans.find((plan) => plan.abilityId === currentAbilityId && plan.available) ?? null
        : getBestAvailableDiceTargetPlan(state, playerId, phase);

    return {
        plans,
        availablePlan,
        availableAmbition: availablePlan?.ambitionScore ?? 0,
        remainingRolls,
        diceToolCardCount: countAffordableDiceToolCards(state, playerId, phase),
        heroStrategy: getDiceThroneHeroStrategyProfile(state.core, playerId),
    };
};

const scoreHigherAmbitionChasePlan = (
    context: DiceChaseContext,
    plan: DiceTargetPlan,
): number => {
    const { availablePlan, diceToolCardCount, remainingRolls } = context;
    const successChance = estimateDiceChaseProbability(plan, remainingRolls, diceToolCardCount);
    const currentValue = availablePlan?.strategicScore ?? 0;
    const valueGap = plan.strategicScore - currentValue;
    const closeness = plan.totalRequired > 0
        ? plan.matchedCount / plan.totalRequired
        : 0;
    const expectedUpside = successChance * (plan.strategicScore + plan.ambitionScore * 0.65);
    const fallbackRisk = (1 - successChance) * Math.max(0, currentValue - plan.strategicScore * 0.25);
    const nearMissBonus = closeness * plan.ambitionScore * 0.22;
    const heroAmbitionBonus = plan.ambitionScore * closeness * (context.heroStrategy.chaseAmbition - 1) * 0.55;
    const heroFallbackPenalty = Math.max(0, context.heroStrategy.protectFallback - 1) * fallbackRisk * 0.65;
    const diceToolBonus = diceToolCardCount * 45 * context.heroStrategy.resourceLeverage;
    const ultimateNearMissBonus = plan.ambitionScore >= 300 && plan.matchedCount >= 3
        ? 55
        : 0;
    const longShotPenalty = diceToolCardCount === 0 && plan.missingCount >= 3
        ? 120
        : 0;
    const lastRollPenalty = remainingRolls <= 1 && diceToolCardCount === 0 && plan.missingCount >= 2
        ? 60
        : 0;

    return Number((
        expectedUpside
        + plan.profileFitScore * 0.7
        + valueGap * 0.35
        + nearMissBonus
        + heroAmbitionBonus
        + diceToolBonus
        + ultimateNearMissBonus
        + plan.matchedCount * 8
        - plan.missingCount * 32
        - fallbackRisk
        - heroFallbackPenalty
        - longShotPenalty
        - lastRollPenalty
    ).toFixed(3));
};

const buildHigherAmbitionChaseCandidates = (
    context: DiceChaseContext,
): DiceChaseCandidate[] => (
    context.plans
        .filter((plan) => !plan.available)
        .map((plan) => ({
            plan,
            chaseScore: scoreHigherAmbitionChasePlan(context, plan),
        }))
        .filter(({ plan }) => plan.missingCount > 0 && plan.missingCount <= 3)
        .filter(({ plan }) => plan.ambitionScore >= context.availableAmbition + 80)
        .filter(({ plan, chaseScore }) => chaseScore >= getMinimumHigherAmbitionChaseScore(context, plan))
);

const getMinimumHigherAmbitionChaseScore = (
    context: DiceChaseContext,
    plan: DiceTargetPlan,
): number => {
    const baseThreshold = 35;
    const ambitionAdjustment = (1 - context.heroStrategy.chaseAmbition) * 70;
    const fallbackAdjustment = context.availablePlan
        ? Math.max(0, context.heroStrategy.protectFallback - 1) * 55
        : 0;
    const nearMissAdjustment = plan.matchedCount >= 3
        ? -Math.max(0, context.heroStrategy.chaseAmbition - 1) * 45
        : 0;

    return Number((
        baseThreshold
        + ambitionAdjustment
        + fallbackAdjustment
        + nearMissAdjustment
    ).toFixed(3));
};

const pickHigherAmbitionChasePlan = (
    context: DiceChaseContext,
): DiceTargetPlan | null => (
    buildHigherAmbitionChaseCandidates(context).sort((left, right) => {
        if (right.chaseScore !== left.chaseScore) return right.chaseScore - left.chaseScore;
        if (right.plan.ambitionScore !== left.plan.ambitionScore) return right.plan.ambitionScore - left.plan.ambitionScore;
        return left.plan.missingCount - right.plan.missingCount;
    })[0]?.plan ?? null
);

const getHigherAmbitionChasePlan = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    currentAbilityId?: string | null,
): DiceTargetPlan | null => {
    const context = buildDiceChaseContext(state, playerId, phase, currentAbilityId);
    if (!context) return null;

    return pickHigherAmbitionChasePlan(context);
};

const shouldPrioritizeDiceToolBeforeMoreLocking = (
    dice: DiceThroneCore['dice'],
    plan: DiceTargetPlan | null,
    diceToolCardCount: number,
): boolean => {
    if (!plan || diceToolCardCount <= 0) return false;
    return dice.some((die) => plan.keepDieIds.includes(die.id) && die.isKept);
};

const isRemovableStatusId = (state: DiceThroneState, statusId: string): boolean => {
    const def = state.core.tokenDefinitions.find((definition) => definition.id === statusId);
    return def?.passiveTrigger?.removable ?? true;
};

const playerHasStatusOrToken = (state: DiceThroneState, playerId: PlayerId): boolean => {
    const player = state.core.players[playerId];
    if (!player) return false;

    return Object.entries(player.statusEffects ?? {}).some(([statusId, value]) => {
        return value > 0 && isRemovableStatusId(state, statusId);
    }) || Object.entries(player.tokens ?? {}).some(([statusId, value]) => {
        return value > 0 && isRemovableStatusId(state, statusId);
    });
};

const getSelectableStatusIds = (state: DiceThroneState, playerId: PlayerId): string[] => {
    const player = state.core.players[playerId];
    if (!player) return [];

    const effectIds = Object.entries(player.statusEffects ?? {})
        .filter(([statusId, value]) => value > 0 && isRemovableStatusId(state, statusId))
        .map(([statusId]) => statusId);
    const tokenIds = Object.entries(player.tokens ?? {})
        .filter(([statusId, value]) => value > 0 && isRemovableStatusId(state, statusId))
        .map(([statusId]) => statusId);

    return Array.from(new Set([...effectIds, ...tokenIds]));
};

const isFriendlyTarget = (state: DiceThroneState, actingPlayerId: PlayerId, targetPlayerId: PlayerId): boolean => {
    return actingPlayerId === targetPlayerId
        || areTeammates(state.core, actingPlayerId, targetPlayerId);
};

const getCardInteractionById = (
    state: DiceThroneState,
    interactionId: string | null,
): CardInteractionData | null => {
    if (!interactionId) return null;

    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current || current.kind !== 'dt:card-interaction' || current.id !== interactionId) {
        return null;
    }

    return current.data as CardInteractionData;
};

const getEffectCategory = (
    state: DiceThroneState,
    effectId: string,
): 'buff' | 'debuff' | 'consumable' | null => {
    const category = state.core.tokenDefinitions.find((definition) => definition.id === effectId)?.category;
    if (category === 'buff' || category === 'debuff' || category === 'consumable') {
        return category;
    }
    return null;
};

const getGrantedEffectValue = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    targetPlayerId: PlayerId,
    effectId: string,
    amount: number,
): number => {
    const category = getEffectCategory(state, effectId);
    if (!category) return 0;

    const relationSign = isFriendlyTarget(state, actingPlayerId, targetPlayerId) ? 1 : -1;
    const targetBenefitSign = category === 'debuff' ? -1 : 1;
    let score = relationSign * targetBenefitSign * amount * 40;

    const hp = state.core.players[targetPlayerId]?.resources[RESOURCE_IDS.HP] ?? 50;
    if (targetBenefitSign > 0 && relationSign > 0) {
        score += Math.max(0, 40 - hp);
    }
    if (targetBenefitSign < 0 && relationSign < 0) {
        score += Math.max(0, 35 - hp);
    }

    return score;
};

const scoreRemoveAllStatusesTarget = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    targetPlayerId: PlayerId,
): number => {
    const player = state.core.players[targetPlayerId];
    if (!player) return 0;

    const relationSign = isFriendlyTarget(state, actingPlayerId, targetPlayerId) ? 1 : -1;
    let score = 0;
    for (const [effectId, amount] of [
        ...Object.entries(player.statusEffects ?? {}),
        ...Object.entries(player.tokens ?? {}),
    ]) {
        if (amount <= 0) continue;
        if (!isRemovableStatusId(state, effectId)) continue;
        const category = getEffectCategory(state, effectId);
        if (!category) continue;

        const removalValue = category === 'debuff'
            ? relationSign
            : -relationSign;
        score += removalValue * amount * 30;
    }

    return score;
};

const scoreRemoveSingleStatusTarget = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    targetPlayerId: PlayerId,
    effectId: string,
): number => {
    if (!isRemovableStatusId(state, effectId)) return 0;
    const category = getEffectCategory(state, effectId);
    if (!category) return 0;

    const relationSign = isFriendlyTarget(state, actingPlayerId, targetPlayerId) ? 1 : -1;
    const removalValue = category === 'debuff' ? relationSign : -relationSign;
    let score = removalValue * 45;

    const hp = state.core.players[targetPlayerId]?.resources[RESOURCE_IDS.HP] ?? 50;
    if (category === 'debuff' && relationSign > 0) {
        score += Math.max(0, 35 - hp);
    }
    if (category !== 'debuff' && relationSign < 0) {
        score += Math.max(0, 35 - hp);
    }

    return score;
};

const scoreTransferStatusTarget = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    effectId: string,
): number => {
    return scoreRemoveSingleStatusTarget(state, actingPlayerId, fromPlayerId, effectId)
        + getGrantedEffectValue(state, actingPlayerId, toPlayerId, effectId, 1);
};

const buildStatusInteractionStrategyTags = (
    state: DiceThroneState,
    effectId: string,
): DiceThroneStrategyTag[] => {
    const category = getEffectCategory(state, effectId);
    if (!category) return [];
    return ['purify-control'];
};

const getEffectIntentForCategory = (
    category: 'buff' | 'debuff' | 'consumable' | null,
    mode: 'apply' | 'remove',
): AiEffectIntent | null => {
    if (!category) return null;
    if (mode === 'remove') {
        if (category === 'debuff') return 'buff';
        if (category === 'buff') return 'debuff';
        return 'resource';
    }
    if (category === 'debuff') return 'debuff';
    if (category === 'buff') return 'buff';
    return 'resource';
};

const parseTargetPlayerIdFromCustomId = (customId: string | undefined): PlayerId | null => {
    if (!customId?.startsWith('select-target:')) return null;
    const targetPlayerId = customId.slice('select-target:'.length);
    return targetPlayerId ? targetPlayerId : null;
};

const buildPlayerTargetHint = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    targetPlayerId: PlayerId,
    args: {
        effectIntent: AiEffectIntent;
        estimatedSwing?: number;
        tags: string[];
    },
): AiHint => {
    return buildTargetAiHint({
        actorPlayerId: actingPlayerId,
        targetPlayerId,
        relationResolver: ({ actorPlayerId, targetPlayerId }) => {
            if (!actorPlayerId || !targetPlayerId) {
                return undefined;
            }
            if (actorPlayerId === targetPlayerId) {
                return 'self';
            }
            return areTeammates(state.core, actorPlayerId, targetPlayerId) ? 'ally' : 'enemy';
        },
        targetKind: 'player',
        effectIntent: args.effectIntent,
        ...(typeof args.estimatedSwing === 'number' ? { estimatedSwing: args.estimatedSwing } : {}),
        tags: args.tags,
    });
};

const buildSelectPlayerDecisionFromInteraction = (
    state: DiceThroneState,
    playerId: PlayerId,
    current: EngineInteractionDescriptor,
): AiSelectPlayerDecisionDescriptor | null => {
    if (current.kind === 'dt:defender-choice') {
        const data = current.data as {
            options?: Array<{ playerId?: PlayerId; customId?: string; disabled?: boolean }>;
            targetRollValue?: number;
        };
        return {
            kind: 'select-player',
            interactionId: current.id,
            actorPlayerId: playerId,
            sourceId: current.sourceId,
            selection: { min: 1, max: 1 },
            metadata: {
                targetRollValue: data.targetRollValue,
            },
            candidates: (data.options ?? [])
                .filter((option) => option.disabled !== true)
                .map((option, index) => {
                    const defenderId = parseTargetPlayerIdFromCustomId(option.customId) ?? option.playerId ?? null;
                    if (!defenderId) return null;
                    return {
                        id: `defender:${defenderId}:${index}`,
                        playerId: defenderId,
                        actionKeyParts: ['select-defender-target', defenderId, index],
                        label: `选择受击者 ${defenderId}`,
                        aiHints: [buildPlayerTargetHint(state, playerId, defenderId, {
                            effectIntent: 'debuff',
                            tags: ['choice:select-target', 'defender-selection'],
                        })],
                        metadata: {
                            interactionId: current.id,
                            defenderId,
                            targetRollValue: data.targetRollValue,
                        },
                    };
                })
                .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null),
        };
    }

    if (current.kind === 'dt:card-interaction') {
        const data = current.data as CardInteractionData;
        if (data.type !== 'selectPlayer') {
            return null;
        }

        const targetPlayerIds = (data.targetPlayerIds ?? Object.keys(state.core.players) as PlayerId[])
            .filter((targetId) => !!state.core.players[targetId])
            .filter((targetId) => !data.requiresTargetWithStatus || playerHasStatusOrToken(state, targetId));
        const selectCount = Math.max(1, Math.min(data.selectCount ?? 1, targetPlayerIds.length));
        return {
            kind: 'select-player',
            interactionId: current.id,
            actorPlayerId: playerId,
            sourceId: current.sourceId,
            selection: { min: selectCount, max: selectCount },
            candidates: targetPlayerIds.map((targetPlayerId) => ({
                id: targetPlayerId,
                playerId: targetPlayerId,
                actionKeyParts: [targetPlayerId],
                label: targetPlayerId,
                metadata: {
                    interactionId: current.id,
                    targetPlayerId,
                },
            })),
        };
    }

    return null;
};

const buildSelectPlayerInteractionActions = (
    state: DiceThroneState,
    playerId: PlayerId,
    current: EngineInteractionDescriptor,
): AiLegalAction[] | null => {
    const decision = buildSelectPlayerDecisionFromInteraction(state, playerId, current);
    if (!decision) return null;

    if (current.kind === 'dt:defender-choice') {
        return buildSelectPlayerDecisionActions({
            descriptor: decision,
            defaultActionKind: 'interaction-choice',
            emptyAction: (descriptor) => buildEmergencyInteractionCancelAction(descriptor.interactionId, 'empty-options'),
            buildCommands: (selection) => {
                const defenderId = selection[0]?.playerId;
                return defenderId
                    ? [{ type: 'SELECT_DEFENDER_TARGET', payload: { defenderId } }]
                    : [];
            },
            buildMetadata: (selection, descriptor) => ({
                interactionId: descriptor.interactionId,
                defenderId: selection[0]?.playerId,
                targetRollValue: descriptor.metadata?.targetRollValue,
            }),
        });
    }

    if (current.kind === 'dt:card-interaction') {
        const data = current.data as CardInteractionData;
        return buildSelectPlayerDecisionActions({
            descriptor: decision,
            emptyAction: (descriptor) => buildEmergencyInteractionCancelAction(descriptor.interactionId, 'empty-options'),
            buildCommands: (selection) => [{
                type: 'RESOLVE_INTERACTION',
                payload: { selectedPlayerIds: selection.map((candidate) => candidate.playerId) },
            }],
            buildActionKeyParts: (selection) => ['select-player', ...selection.map((candidate) => candidate.playerId)],
            buildLabel: (selection) => `选择玩家 ${selection.map((candidate) => candidate.playerId).join(', ')}`,
            buildAiHints: (selection) => buildSelectPlayerActionAiHints(
                state,
                playerId,
                selection.map((candidate) => candidate.playerId),
                data,
            ),
            buildMetadata: (selection, descriptor) => ({
                interactionId: descriptor.interactionId,
                selectedPlayerIds: selection.map((candidate) => candidate.playerId),
            }),
        });
    }

    return null;
};

const isBenefitChoiceCustomId = (customId: string | undefined): boolean => {
    if (!customId) return false;
    return customId.startsWith('use-')
        || customId.endsWith('-pay')
        || customId.endsWith('-confirmed');
};

const isEmergencySkipOption = (option: SimpleChoiceOption): boolean => {
    return option.id === '__emergency_skip__'
        || option.value?.__emergency_skip__ === true;
};

const buildChoiceOptionAiHints = (
    state: DiceThroneState,
    playerId: PlayerId,
    option: SimpleChoiceOption,
): AiHint[] => {
    const hints: AiHint[] = [];
    if (option._ai) {
        hints.push(option._ai);
    }

    const value = option.value;
    const customId = typeof value?.customId === 'string' ? value.customId : undefined;
    const optionId = typeof option.id === 'string' ? option.id : undefined;

    if (customId === 'skip' || optionId === 'skip' || optionId === '__cancel__' || isEmergencySkipOption(option)) {
        hints.push(OPTIONAL_SKIP_AI_HINT);
    }

    const targetPlayerId = parseTargetPlayerIdFromCustomId(customId);
    if (targetPlayerId) {
        hints.push(buildPlayerTargetHint(state, playerId, targetPlayerId, {
            effectIntent: 'debuff',
            tags: ['choice:select-target'],
        }));
    }

    const effectId = value?.tokenId ?? value?.statusId;
    const category = effectId ? getEffectCategory(state, effectId) : null;
    const effectMode = (value?.value ?? 1) < 0 && !isBenefitChoiceCustomId(customId)
        ? 'remove'
        : 'apply';
    const effectIntent = getEffectIntentForCategory(category, effectMode);
    if (effectId && effectIntent) {
        hints.push(buildPlayerTargetHint(state, playerId, playerId, {
            effectIntent,
            tags: [
                'choice:effect',
                `effect:${effectId}`,
                ...(category ? [`effect-category:${category}`] : []),
            ],
        }));
    }

    return hints;
};

const buildSelectPlayerActionAiHints = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    selectedPlayerIds: PlayerId[],
    interaction: CardInteractionData,
): AiHint[] => {
    const hints: AiHint[] = [];
    const tokenConfigs = interaction.tokenGrantConfigs ?? (
        interaction.tokenGrantConfig ? [interaction.tokenGrantConfig] : []
    );
    const statusConfigs = interaction.statusGrantConfigs ?? (
        interaction.statusGrantConfig ? [interaction.statusGrantConfig] : []
    );

    for (const targetPlayerId of selectedPlayerIds) {
        for (const config of tokenConfigs) {
            const category = getEffectCategory(state, config.tokenId);
            const effectIntent = getEffectIntentForCategory(category, 'apply');
            if (!effectIntent) continue;
            hints.push(buildPlayerTargetHint(state, actingPlayerId, targetPlayerId, {
                effectIntent,
                estimatedSwing: getGrantedEffectValue(
                    state,
                    actingPlayerId,
                    targetPlayerId,
                    config.tokenId,
                    config.amount,
                ),
                tags: [`grant-token:${config.tokenId}`],
            }));
        }

        for (const config of statusConfigs) {
            const category = getEffectCategory(state, config.statusId);
            const effectIntent = getEffectIntentForCategory(category, 'apply');
            if (!effectIntent) continue;
            hints.push(buildPlayerTargetHint(state, actingPlayerId, targetPlayerId, {
                effectIntent,
                estimatedSwing: getGrantedEffectValue(
                    state,
                    actingPlayerId,
                    targetPlayerId,
                    config.statusId,
                    config.amount,
                ),
                tags: [`grant-status:${config.statusId}`],
            }));
        }

        if (tokenConfigs.length === 0 && statusConfigs.length === 0 && interaction.requiresTargetWithStatus === true) {
            const swing = scoreRemoveAllStatusesTarget(state, actingPlayerId, targetPlayerId);
            if (swing !== 0) {
                hints.push(buildPlayerTargetHint(state, actingPlayerId, targetPlayerId, {
                    effectIntent: 'affect',
                    estimatedSwing: swing,
                    tags: ['remove-status:all'],
                }));
            }
        }
    }

    return hints;
};

const buildRemoveStatusAiHints = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    targetPlayerId: PlayerId,
    statusId: string,
): AiHint[] => {
    const category = getEffectCategory(state, statusId);
    const effectIntent = getEffectIntentForCategory(category, 'remove');
    if (!effectIntent) return [];
    return [buildPlayerTargetHint(state, actingPlayerId, targetPlayerId, {
        effectIntent,
        estimatedSwing: scoreRemoveSingleStatusTarget(state, actingPlayerId, targetPlayerId, statusId),
        tags: [`remove-status:${statusId}`],
    })];
};

const buildTransferStatusAiHints = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    statusId: string,
): AiHint[] => {
    const category = getEffectCategory(state, statusId);
    const removeIntent = getEffectIntentForCategory(category, 'remove');
    const applyIntent = getEffectIntentForCategory(category, 'apply');
    const hints: AiHint[] = [];

    if (removeIntent) {
        hints.push(buildPlayerTargetHint(state, actingPlayerId, fromPlayerId, {
            effectIntent: removeIntent,
            estimatedSwing: scoreRemoveSingleStatusTarget(state, actingPlayerId, fromPlayerId, statusId),
            tags: [`transfer-remove:${statusId}`],
        }));
    }

    if (applyIntent) {
        hints.push(buildPlayerTargetHint(state, actingPlayerId, toPlayerId, {
            effectIntent: applyIntent,
            estimatedSwing: getGrantedEffectValue(state, actingPlayerId, toPlayerId, statusId, 1),
            tags: [`transfer-apply:${statusId}`],
        }));
    }

    return hints;
};

const buildEmergencyInteractionCancelAction = (
    interactionId: string,
    reason: string,
): AiLegalAction => ({
    actionId: createAiLegalActionId('interaction', interactionId, 'emergency-cancel'),
    kind: 'interaction-cancel',
    label: '跳过（无可用选项）',
    commands: [{
        type: 'SYS_INTERACTION_CANCEL',
        payload: { interactionId, reason },
    }],
    metadata: {
        interactionId,
        reason,
    },
});

const buildInteractionActions = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
): AiLegalAction[] | null => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current) return null;
    if (current.kind === 'dt:token-response') {
        const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;
        if (!pendingDamage || pendingDamage.responderId !== playerId) {
            return [];
        }
        return buildResponseActions(state, playerId, phase);
    }

    if (current.kind === 'dt:bonus-dice') {
        if (state.sys.responseWindow?.current || hasPendingTokenResponseForPlayer(state, playerId)) {
            return buildResponseActions(state, playerId, phase);
        }
        const actions = [
            ...buildBonusDicePlayableCardActions(state, playerId, phase),
            ...buildPassiveActions(state, playerId, phase, { rerollOnly: true }),
            ...buildBonusDiceActions(state, playerId),
        ];
        if (actions.length > 0) return actions;
        return current.playerId === playerId
            ? [buildEmergencyInteractionCancelAction(current.id, 'no-legal-actions')]
            : [];
    }

    if (current.playerId !== playerId) return [];

    const selectPlayerActions = buildSelectPlayerInteractionActions(state, playerId, current);
    if (selectPlayerActions) {
        return selectPlayerActions;
    }

    if (current.kind === 'simple-choice') {
        const data = current.data as {
            options?: SimpleChoiceOption[];
            multi?: PromptMultiConfig;
        };
        const availableOptions = (data.options ?? []).filter((option): option is SimpleChoiceOption & { id: string } => {
            return typeof option?.id === 'string' && option.disabled !== true;
        });
        const minCount = data.multi?.min ?? 1;
        const maxCount = data.multi?.max ?? minCount;

        if (availableOptions.length === 0 && minCount > 0) {
            return [buildEmergencyInteractionCancelAction(current.id, 'empty-options')];
        }

        if (data.multi) {
            const actions: AiLegalAction[] = [];
            if (minCount === 0) {
                actions.push({
                    actionId: createAiLegalActionId('interaction', current.id, 'empty-selection'),
                    kind: 'interaction-choice',
                    label: '不选择任何项',
                    commands: [{
                        type: 'SYS_INTERACTION_RESPOND',
                        payload: { interactionId: current.id, optionIds: [] },
                    }],
                    aiHints: [OPTIONAL_SKIP_AI_HINT],
                    metadata: {
                        interactionId: current.id,
                        optionIds: [],
                    },
                });
            }

            const combinations = enumerateInteractionOptionCombinations(
                availableOptions,
                Math.max(1, minCount),
                maxCount,
            );
            if (combinations.length === 0) {
                const emergencySkipOption = availableOptions.find(isEmergencySkipOption);
                if (emergencySkipOption?.id) {
                    return [{
                        actionId: createAiLegalActionId('interaction', current.id, emergencySkipOption.id),
                        kind: 'interaction-choice',
                        label: emergencySkipOption.label ?? '跳过（当前无可执行选项）',
                        commands: [{
                            type: 'SYS_INTERACTION_RESPOND',
                            payload: {
                                interactionId: current.id,
                                ...buildSimpleChoicePayload([emergencySkipOption.id], data.multi),
                            },
                        }],
                        aiHints: [OPTIONAL_SKIP_AI_HINT],
                        metadata: {
                            interactionId: current.id,
                            optionIds: [emergencySkipOption.id],
                        },
                    }];
                }
            }
            actions.push(...combinations.map((combination, index) => {
                const aiHints = combination.flatMap((option) => buildChoiceOptionAiHints(state, playerId, option));
                return {
                    actionId: createAiLegalActionId('interaction', current.id, 'combo', ...combination.map((option) => option.id)),
                    kind: 'interaction-choice',
                    label: combination.map((option) => option.label ?? option.id).join(' + ') || `选择 ${index + 1}`,
                    commands: [{
                        type: 'SYS_INTERACTION_RESPOND',
                        payload: {
                            interactionId: current.id,
                            ...buildSimpleChoicePayload(
                                combination.map((option) => option.id),
                                data.multi,
                            ),
                        },
                    }],
                    ...(aiHints.length > 0 ? { aiHints } : {}),
                    metadata: {
                        interactionId: current.id,
                        optionIds: combination.map((option) => option.id),
                    },
                };
            }));
            return actions;
        }

        return availableOptions.map((option, index) => {
            const aiHints = buildChoiceOptionAiHints(state, playerId, option);
            return {
                actionId: createAiLegalActionId('interaction', current.id, option.id),
                kind: 'interaction-choice',
                label: option.label ?? `选择 ${index + 1}`,
                commands: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload: {
                        interactionId: current.id,
                        ...buildSimpleChoicePayload([option.id], data.multi),
                    },
                }],
                ...(aiHints.length > 0 ? { aiHints } : {}),
                metadata: {
                    interactionId: current.id,
                    optionId: option.id,
                },
            };
        });
    }

    if (current.kind === 'compare-roll-choice') {
        const data = current.data as {
            options?: Array<{ id?: string; label?: string; disabled?: boolean }>;
        };
        const availableOptions = (data.options ?? []).filter((option): option is { id: string; label?: string } => {
            return typeof option?.id === 'string' && option.disabled !== true;
        });

        if (availableOptions.length === 0) {
            return [{
                actionId: createAiLegalActionId('interaction', current.id, 'confirm'),
                kind: 'interaction-choice',
                label: '确认比较结果',
                commands: [{
                type: 'SYS_INTERACTION_CONFIRM',
                    payload: { interactionId: current.id },
                }],
                metadata: {
                    interactionId: current.id,
                },
            }];
        }

        return availableOptions.map((option, index) => ({
            actionId: createAiLegalActionId('interaction', current.id, option.id),
            kind: 'interaction-choice',
            label: option.label ?? `选择 ${index + 1}`,
            commands: [{
                type: 'SYS_INTERACTION_RESPOND',
                payload: { interactionId: current.id, optionId: option.id },
            }],
            metadata: {
                interactionId: current.id,
                optionId: option.id,
            },
        }));
    }

    if (current.kind === 'dt:card-interaction') {
        const data = current.data as CardInteractionData;

        if (data.type === 'selectHandCard') {
            const player = state.core.players[playerId];
            const selectedCardId = player?.hand[0]?.id;
            return selectedCardId
                ? [{
                    actionId: createAiLegalActionId('interaction', current.id, 'select-hand-card', selectedCardId),
                    kind: 'interaction-choice',
                    label: `弃置手牌 ${selectedCardId}`,
                    commands: [{
                        type: 'RESOLVE_INTERACTION',
                        payload: { selectedCardIds: [selectedCardId] },
                    }],
                    metadata: {
                        interactionId: current.id,
                        selectedCardIds: [selectedCardId],
                    },
                }]
                : [buildEmergencyInteractionCancelAction(current.id, 'empty-options')];
        }

        if (data.type === 'selectStatus') {
            const targetPlayerIds = (data.targetPlayerIds ?? Object.keys(state.core.players) as PlayerId[])
                .filter((targetId) => !!state.core.players[targetId]);

            if (data.transferConfig) {
                const transferableActions = targetPlayerIds.flatMap((sourcePlayerId) => {
                    return getSelectableStatusIds(state, sourcePlayerId).flatMap((statusId) => {
                        return targetPlayerIds
                            .filter((targetPlayerId) => targetPlayerId !== sourcePlayerId)
                            .map((targetPlayerId, index) => ({
                                actionId: createAiLegalActionId(
                                    'interaction',
                                    current.id,
                                    'transfer-status',
                                    sourcePlayerId,
                                    statusId,
                                    targetPlayerId,
                                    index,
                                ),
                                kind: 'interaction-transfer-status',
                                label: `转移 ${statusId} 到 ${targetPlayerId}`,
                                commands: [{
                                    type: 'TRANSFER_STATUS',
                                    payload: { fromPlayerId: sourcePlayerId, toPlayerId: targetPlayerId, statusId },
                                }],
                                aiHints: buildTransferStatusAiHints(
                                    state,
                                    playerId,
                                    sourcePlayerId,
                                    targetPlayerId,
                                    statusId,
                                ),
                                metadata: withAiActionStrategyTags({
                                    interactionId: current.id,
                                    fromPlayerId: sourcePlayerId,
                                    toPlayerId: targetPlayerId,
                                    statusId,
                                }, buildStatusInteractionStrategyTags(state, statusId)),
                            }));
                    });
                });

                return transferableActions.length > 0
                    ? transferableActions
                    : [buildEmergencyInteractionCancelAction(current.id, 'empty-options')];
            }

            const actions = targetPlayerIds.flatMap((targetPlayerId) => {
                return getSelectableStatusIds(state, targetPlayerId).map((statusId, index) => ({
                    actionId: createAiLegalActionId('interaction', current.id, 'remove-status', targetPlayerId, statusId, index),
                    kind: 'interaction-remove-status',
                    label: `移除 ${targetPlayerId} 的 ${statusId}`,
                    commands: [{
                        type: 'REMOVE_STATUS',
                        payload: { targetPlayerId, statusId },
                    }],
                    aiHints: buildRemoveStatusAiHints(state, playerId, targetPlayerId, statusId),
                    metadata: withVisibleStepDelayPolicy(withAiActionStrategyTags({
                        interactionId: current.id,
                        targetPlayerId,
                        statusId,
                    }, buildStatusInteractionStrategyTags(state, statusId)), 'hidden'),
                }));
            });
            return actions.length > 0
                ? actions
                : [buildEmergencyInteractionCancelAction(current.id, 'empty-options')];
        }

        if (data.type === 'selectTargetStatus' && data.transferConfig?.sourcePlayerId && data.transferConfig?.statusId) {
            const sourcePlayerId = data.transferConfig.sourcePlayerId;
            const statusId = data.transferConfig.statusId;
            if (!isRemovableStatusId(state, statusId)) {
                return [buildEmergencyInteractionCancelAction(current.id, 'empty-options')];
            }
            const targetPlayerIds = (data.targetPlayerIds ?? Object.keys(state.core.players) as PlayerId[])
                .filter((targetId) => !!state.core.players[targetId])
                .filter((targetId) => targetId !== sourcePlayerId);

            const actions = targetPlayerIds.map((targetPlayerId, index) => ({
                actionId: createAiLegalActionId(
                    'interaction',
                    current.id,
                    'transfer-target-status',
                    sourcePlayerId,
                    statusId,
                    targetPlayerId,
                    index,
                ),
                kind: 'interaction-transfer-status',
                label: `转移 ${statusId} 到 ${targetPlayerId}`,
                commands: [{
                    type: 'TRANSFER_STATUS',
                    payload: { fromPlayerId: sourcePlayerId, toPlayerId: targetPlayerId, statusId },
                }],
                aiHints: buildTransferStatusAiHints(state, playerId, sourcePlayerId, targetPlayerId, statusId),
                metadata: withAiActionStrategyTags({
                    interactionId: current.id,
                    fromPlayerId: sourcePlayerId,
                    toPlayerId: targetPlayerId,
                    statusId,
                }, buildStatusInteractionStrategyTags(state, statusId)),
            }));
            return actions.length > 0
                ? actions
                : [buildEmergencyInteractionCancelAction(current.id, 'empty-options')];
        }

        return [buildEmergencyInteractionCancelAction(current.id, 'no-legal-actions')];
    }

    if (current.kind !== 'multistep-choice') {
        return [buildEmergencyInteractionCancelAction(current.id, 'unsupported-interaction-kind')];
    }

    const data = current.data as DiceInteractionData;
    const meta = data.meta;
    const activeDice = getAiActiveDice(state, phase);
    const interactionId = current.id;
    const allowedDieIds = Array.isArray(data.allowedDieIds) && data.allowedDieIds.length > 0
        ? new Set(data.allowedDieIds.filter((dieId): dieId is number => typeof dieId === 'number'))
        : null;
    const completedDieIds = new Set(
        Array.isArray(data.completedDieIds)
            ? data.completedDieIds.filter((dieId): dieId is number => typeof dieId === 'number')
            : [],
    );
    const selectableDice = activeDice.filter((die) => {
        if (allowedDieIds && !allowedDieIds.has(die.id)) {
            return false;
        }
        return !completedDieIds.has(die.id);
    });
    if (selectableDice.length === 0) {
        return [buildEmergencyInteractionCancelAction(interactionId, 'empty-options')];
    }
    const selectionBounds = resolveDiceInteractionSelectionBounds(data, selectableDice.length, completedDieIds.size);
    if (!selectionBounds) {
        return [buildEmergencyInteractionCancelAction(interactionId, 'empty-options')];
    }
    const { selectCount, minSelectionCount } = selectionBounds;

    if (meta?.dtType === 'selectDie') {
        const selections = enumerateArrayCombinations(selectableDice, minSelectionCount, selectCount);
        return selections.map((selection) => ({
            actionId: createAiLegalActionId('interaction', interactionId, 'reroll', ...selection.map((die) => die.id)),
            kind: 'interaction-multistep',
            label: `重掷骰子 ${selection.map((die) => die.id).join(', ')}`,
            commands: [
                ...selection.map((die) => ({
                    type: 'REROLL_DIE',
                    payload: { dieId: die.id },
                })),
                { type: 'SYS_INTERACTION_CONFIRM', payload: { interactionId } },
            ],
            metadata: withVisibleStepDelayPolicy(withAiActionStrategyTags({
                interactionId,
                dieId: selection[0]?.id,
                dieIds: selection.map((die) => die.id),
            }, ['dice-setup']), 'hidden'),
        }));
    }

    if (meta?.dtType === 'modifyDie') {
        const targetValue = meta.dieModifyConfig?.targetValue ?? 6;
        const mode = meta.dieModifyConfig?.mode;
        if (mode === 'copy') {
            const copySelectionCount = Math.min(2, selectCount);
            if (copySelectionCount < 2 || minSelectionCount > copySelectionCount) {
                return [buildEmergencyInteractionCancelAction(interactionId, 'empty-options')];
            }
            const orderedSelections = enumerateOrderedSelections(selectableDice, copySelectionCount)
                // 复制同值骰不会改变目标骰面；这不是可用的 AI 行动。
                .filter(([sourceDie, targetDie]) => sourceDie?.value !== targetDie?.value);
            if (orderedSelections.length === 0) {
                return [buildEmergencyInteractionCancelAction(interactionId, 'no-effective-copy-target')];
            }
            return orderedSelections.map((selection) => {
                const sourceDie = selection[0];
                const targetDice = selection.slice(1);
                const sourceValue = sourceDie?.value ?? targetValue;
                const diceIds = selection.map((die) => die.id);
                const newValues = selection.map((die, index) => (index === 0 ? die.value : sourceValue));

                return {
                    actionId: createAiLegalActionId('interaction', interactionId, 'copy', ...diceIds),
                    kind: 'interaction-multistep',
                    label: `复制骰值 ${diceIds.join(' -> ')}`,
                    commands: [
                        ...selection.map((die, index) => ({
                            type: 'MODIFY_DIE',
                            payload: {
                                dieId: die.id,
                                newValue: index === 0 ? die.value : sourceValue,
                            },
                        })),
                        { type: 'SYS_INTERACTION_CONFIRM', payload: { interactionId } },
                    ],
                    metadata: withVisibleStepDelayPolicy(withAiActionStrategyTags({
                        interactionId,
                        dieId: sourceDie?.id,
                        dieIds: diceIds,
                        newValue: sourceValue,
                        newValues,
                        mode,
                        sourceDieId: sourceDie?.id,
                        targetDieIds: targetDice.map((die) => die.id),
                    }, ['dice-setup']), 'hidden'),
                };
            });
        }

        const selections = enumerateArrayCombinations(selectableDice, minSelectionCount, selectCount);
        const actions = selections.flatMap((selection) => {
            const valueAssignments = mode === 'any'
                ? enumeratePerItemValueAssignments(selection, (die) =>
                    [1, 2, 3, 4, 5, 6].filter((value) => value !== die.value))
                : mode === 'adjust'
                    ? enumeratePerItemValueAssignments(selection, (die) =>
                        [die.value - 1, die.value + 1].filter((value) => value >= 1 && value <= 6))
                : [selection.map((_die) => {
                    return targetValue;
                })];

            return valueAssignments
                .filter((newValues) => newValues.some((value, index) => value !== selection[index]?.value))
                .map((newValues) => ({
                    actionId: createAiLegalActionId(
                        'interaction',
                        interactionId,
                        'modify',
                        ...selection.flatMap((die, index) => [die.id, newValues[index]]),
                    ),
                    kind: 'interaction-multistep' as const,
                    label: `修改骰子 ${selection.map((die) => die.id).join(', ')}`,
                    commands: [
                        ...selection.map((die, index) => ({
                            type: 'MODIFY_DIE',
                            payload: { dieId: die.id, newValue: newValues[index] },
                        })),
                        { type: 'SYS_INTERACTION_CONFIRM', payload: { interactionId } },
                    ],
                    metadata: withVisibleStepDelayPolicy(withAiActionStrategyTags({
                        interactionId,
                        dieId: selection[0]?.id,
                        dieIds: selection.map((die) => die.id),
                        newValue: newValues[0],
                        newValues,
                        mode,
                    }, ['dice-setup']), 'hidden'),
                }));
        });

        return actions.length > 0
            ? actions
            : [buildEmergencyInteractionCancelAction(interactionId, 'no-legal-actions')];
    }

    return null;
};

const buildSetupActions = (state: DiceThroneState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selectedCharacter = state.core.selectedCharacters[playerId];
    const hasSelectedCharacter = typeof selectedCharacter === 'string' && selectedCharacter !== 'unselected';
    const isHost = playerId === state.core.hostPlayerId;
    const isReady = state.core.readyPlayers[playerId] === true;
    const aiSeatIdSet = new Set<PlayerId>(
        Array.isArray((state.sys.undo as { aiSeatIds?: unknown } | undefined)?.aiSeatIds)
            ? ((state.sys.undo as { aiSeatIds?: unknown }).aiSeatIds as unknown[])
                .filter((seatId): seatId is PlayerId => typeof seatId === 'string')
            : [],
    );
    const configuredSeatControllers = state.core.seatControllers;
    const currentSeatController = configuredSeatControllers?.[playerId];
    const currentControllerType = currentSeatController?.type;
    const isCurrentSeatAi = currentControllerType === 'local-ai'
        || currentControllerType === 'remote-ai'
        || (currentControllerType !== 'human' && aiSeatIdSet.has(playerId));
    const isCurrentSeatManualSetupSelection = isManualSetupSelectionEnabledForSeat(currentSeatController);

    if (!hasSelectedCharacter) {
        if (isCurrentSeatAi && !isCurrentSeatManualSetupSelection) {
            const hasPendingHumanSelection = Object.entries(state.core.selectedCharacters).some(([pid, characterId]) => {
                const currentPid = pid as PlayerId;
                const controllerType = configuredSeatControllers?.[currentPid]?.type;
                const isAiSeat = controllerType === 'local-ai'
                    || controllerType === 'remote-ai'
                    || (controllerType !== 'human' && aiSeatIdSet.has(currentPid));
                if (isAiSeat) return false;
                return !characterId || characterId === 'unselected';
            });

            if (hasPendingHumanSelection) {
                return actions;
            }
        }

        const takenCharacters = new Set<SelectableCharacterId>();
        for (const value of Object.values(state.core.selectedCharacters)) {
            if (value && value !== 'unselected') {
                takenCharacters.add(value as SelectableCharacterId);
            }
        }
        const availableCharacters = AI_SELECTABLE_DICETHRONE_CHARACTER_CATALOG.filter(
            (character) => !takenCharacters.has(character.id),
        );
        const candidates = availableCharacters.length > 0
            ? availableCharacters
            : AI_SELECTABLE_DICETHRONE_CHARACTER_CATALOG;

        for (const character of candidates) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('setup', 'select-character', character.id),
                kind: 'setup-select-character',
                label: `选择角色 ${character.id}`,
                commands: [{
                    type: 'SELECT_CHARACTER',
                    payload: { characterId: character.id },
                }],
                metadata: { characterId: character.id },
            });
        }

        return actions;
    }

    if (!isHost && !isReady) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('setup', 'player-ready'),
            kind: 'setup-ready',
            label: '准备完成',
            commands: [{ type: 'PLAYER_READY', payload: {} }],
        });
    }

    if (isHost && isSetupReadyToStart({
        playerIds: Object.keys(state.core.players),
        hostPlayerId: state.core.hostPlayerId,
        selectedCharacters: state.core.selectedCharacters,
        readyPlayers: state.core.readyPlayers,
    })) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('setup', 'host-start'),
            kind: 'setup-host-start',
            label: '开始对局',
            commands: [{ type: 'HOST_START_GAME', payload: {} }],
        });
    }

    return actions;
};

const hasPendingTokenResponseForPlayer = (
    state: DiceThroneState,
    playerId: PlayerId,
): boolean => {
    const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;
    return Boolean(pendingDamage && pendingDamage.responderId === playerId);
};

const buildResponseActions = (state: DiceThroneState, playerId: PlayerId, phase: TurnPhase): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const responseWindow = state.sys.responseWindow?.current;
    const player = state.core.players[playerId];
    const hasPendingTokenResponse = hasPendingTokenResponseForPlayer(state, playerId);
    if (!player || (!responseWindow && !hasPendingTokenResponse)) return actions;

    const windowType = responseWindow?.windowType as DtResponseWindowType | undefined;
    const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;
    const currentResponderId = responseWindow
        ? responseWindow.responderQueue?.[responseWindow.currentResponderIndex]
        : undefined;
    const isCurrentResponder = responseWindow && currentResponderId === playerId;
    const canDirectInterfere = responseWindow
        && !isCurrentResponder
        && isDirectDiceInterferenceActor(state.core, responseWindow, playerId);

    if (responseWindow && !isCurrentResponder && !canDirectInterfere && !hasPendingTokenResponse) {
        return actions;
    }

    if (responseWindow && isCurrentResponder && !responseWindow.pendingInteractionId) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('response', 'pass'),
            kind: 'response-pass',
            label: '跳过响应',
            commands: [{ type: 'RESPONSE_PASS', payload: {} }],
        });
    }

    if (hasPendingTokenResponse && pendingDamage) {
        const tokenTiming = pendingDamage.responseType;
        const usableTokens = tokenTiming
            ? getUsableTokensForTiming(state.core, playerId, tokenTiming)
            : [];
        for (const token of usableTokens) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('response', 'token', token.id),
                kind: 'token-response',
                label: `使用 ${token.id}`,
                commands: [{
                    type: 'USE_TOKEN',
                    payload: { tokenId: token.id, amount: 1 },
                }],
                metadata: withAiActionStrategyTags({ tokenId: token.id }, ['survive-response']),
            });
        }

        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('response', 'skip-token'),
            kind: 'skip-token-response',
            label: '跳过 Token 响应',
            commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: {} }],
        });
    }

    if (responseWindow && (isCurrentResponder || canDirectInterfere)) {
        for (const card of getPlayableCardsInResponseWindow(state.core, playerId, windowType ?? 'afterCardPlayed', phase)) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('response', 'play-card', card.id),
                kind: 'response-play-card',
                label: `打出 ${card.id}`,
                commands: [{
                    type: 'PLAY_CARD',
                    payload: { cardId: card.id },
                }],
                metadata: withAiActionStrategyTags({ cardId: card.id }, buildCardStrategyTags(card, 'response-play-card')),
            });
        }
    }

    return actions;
};

const getResponseCardShieldValue = (card: AbilityCard): number => {
    return card.effects?.reduce((sum, effect) => {
        if (effect.action?.type !== 'grantDamageShield') return sum;
        return sum + Number(effect.action.value ?? effect.action.shieldValue ?? 0);
    }, 0) ?? 0;
};

const scoreResponseDefenseAction = (
    state: DiceThroneState,
    playerId: PlayerId,
    action: AiLegalAction,
): number | null => {
    const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;
    const player = state.core.players[playerId];
    if (!pendingDamage || pendingDamage.responderId !== playerId || !player) return null;

    const incomingDamage = pendingDamage.currentDamage ?? 0;
    const hp = player.resources[RESOURCE_IDS.HP] ?? 0;
    const lethal = incomingDamage >= hp;

    if (action.kind === 'token-response') {
        const tokenId = typeof action.metadata?.tokenId === 'string' ? action.metadata.tokenId : null;
        if (!tokenId) return null;
        const tokenDef = state.core.tokenDefinitions?.find((token) => token.id === tokenId);
        const effect = tokenDef?.activeUse?.effect;
        if (!effect) return null;

        if (effect.type === 'modifyDamageReceived') {
            const prevented = Math.max(0, -getTokenEffectValue(effect, 1, effect.value ?? 0));
            const remainingDamage = Math.max(0, incomingDamage - prevented);
            let score = prevented * 55;
            if (remainingDamage < hp) {
                score += lethal ? 150 : 80;
            }
            return score;
        }

        if (effect.type === 'rollToNegate') {
            const range = effect.rollSuccess?.range;
            if (!range) return lethal ? 120 : 45;
            const [min, max] = range;
            const successFaces = Math.max(0, max - min + 1);
            const successRate = Math.min(1, successFaces / 6);
            const expectedPrevent = incomingDamage * successRate;
            let score = expectedPrevent * 42 + successRate * 30;
            if (lethal) {
                score += 110 * successRate + 25;
            }
            return score;
        }

        return null;
    }

    if (action.kind === 'response-play-card') {
        const cardId = typeof action.metadata?.cardId === 'string'
            ? action.metadata.cardId
            : null;
        if (!cardId) return null;
        const card = findPlayerHandCard(state, playerId, cardId);
        if (!card) return null;

        const shieldValue = getResponseCardShieldValue(card);
        const drawCount = getCardDrawCount(card);
        const prevented = Math.min(incomingDamage, shieldValue);
        const remainingDamage = Math.max(0, incomingDamage - prevented);
        let score = prevented * 60 + drawCount * 18;
        if (remainingDamage < hp) {
            score += lethal ? 180 : 90;
        }
        return score;
    }

    return null;
};

const buildBonusDiceActions = (state: DiceThroneState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const settlement = state.core.pendingBonusDiceSettlement as PendingBonusDiceSettlement | undefined;
    if (!settlement || settlement.attackerId !== playerId || !isCurrentBonusRollSettlement(state.core, settlement)) return actions;

    if (settlement.displayOnly === true) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('bonus-die', 'confirm'),
            kind: 'confirm-roll',
            label: '确认当前奖励骰',
            commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
            metadata: withAiActionStrategyTags({
                rollConfirmScope: 'bonus-roll',
                bonusDiceSettlementId: settlement.id,
            }, ['dice-setup']),
        });
        return actions;
    }

    for (const die of getPendingBonusSettlementDice(settlement)) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('bonus-die', 'reroll', die.index),
            kind: 'bonus-die-reroll',
            label: `重掷奖励骰 ${die.index}`,
            commands: [{
                type: 'REROLL_BONUS_DIE',
                payload: { dieIndex: die.index },
            }],
            metadata: withAiActionStrategyTags({ dieIndex: die.index }, ['dice-setup']),
        });
    }

    appendAction(actions, state, playerId, {
        actionId: createAiLegalActionId('bonus-die', 'confirm'),
        kind: 'confirm-roll',
        label: '确认当前奖励骰',
        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
        metadata: withAiActionStrategyTags({
            rollConfirmScope: 'bonus-roll',
            bonusDiceSettlementId: settlement.id,
        }, ['dice-setup']),
    });

    return actions;
};

const buildBonusDicePlayableCardActions = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const settlement = state.core.pendingBonusDiceSettlement as PendingBonusDiceSettlement | undefined;
    const player = state.core.players[playerId];
    if (!player || !settlement || !isCurrentBonusRollSettlement(state.core, settlement)) {
        return actions;
    }

    for (const card of player.hand) {
        const check = checkPlayCard(state.core, playerId, card, phase);
        if (!check.ok) continue;
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('bonus-die', 'play-card', card.id),
            kind: 'play-card',
            label: `打出 ${card.id}`,
            commands: [{
                type: 'PLAY_CARD',
                payload: { cardId: card.id },
            }],
            metadata: withAiActionStrategyTags({ cardId: card.id }, buildCardStrategyTags(card, 'play-card')),
        });
    }

    return actions;
};

const buildPurifyActions = (state: DiceThroneState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    if (!player || !hasPurifyToken(state.core, playerId) || !hasDebuffs(state.core, playerId)) {
        return actions;
    }
    const playerStatusEffects = player.statusEffects ?? {};
    const playerTokens = player.tokens ?? {};

    const removableDebuffs = (state.core.tokenDefinitions ?? [])
        .filter((definition) => definition.category === 'debuff' && (definition.passiveTrigger?.removable ?? true))
        .map((definition) => definition.id)
        .filter((statusId) => (playerStatusEffects[statusId] ?? 0) > 0 || (playerTokens[statusId] ?? 0) > 0);

    for (const statusId of removableDebuffs) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('purify', statusId),
            kind: 'use-purify',
            label: `净化 ${statusId}`,
            commands: [{
                type: 'USE_PURIFY',
                payload: { statusId },
            }],
            metadata: withAiActionStrategyTags({ statusId }, ['purify-control', 'survive-response']),
        });
    }

    return actions;
};

const buildPassiveActions = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    options: { rerollOnly?: boolean } = {},
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const passiveAbilities = getPlayerPassiveAbilities(state.core, playerId);
    const currentRollContext = resolveCurrentRollContext(state.core, phase);
    const activeDice = currentRollContext?.dice ?? getAiActiveDice(state, phase);
    const responseWindowType = state.sys.responseWindow?.current?.windowType as DtResponseWindowType | undefined;

    for (const passive of passiveAbilities) {
        passive.actions.forEach((passiveAction, actionIndex) => {
            if (options.rerollOnly && passiveAction.type !== 'rerollDie') {
                return;
            }
            if (!isPassiveActionUsable(state.core, playerId, passive.id, actionIndex, phase, { responseWindowType })) {
                return;
            }

            // 玩家仍可在规则允许的窗口内手动干预已确认的骰面；AI 不应在主进攻骰
            // 已确认、且没有新的临时骰上下文时自行重掷，避免把确认后的流程重新打开。
            if (
                passiveAction.type === 'rerollDie'
                && state.core.rollConfirmed
                && currentRollContext?.kind === 'offensive'
            ) {
                return;
            }

            if (passiveAction.type === 'rerollDie') {
                activeDice
                    .filter((die) => !die.isKept)
                    .forEach((die) => {
                        appendAction(actions, state, playerId, {
                            actionId: createAiLegalActionId('passive', passive.id, actionIndex, die.id),
                            kind: 'use-passive-ability',
                            label: `使用被动 ${passive.id}`,
                            commands: [{
                                type: 'USE_PASSIVE_ABILITY',
                                payload: {
                                    passiveId: passive.id,
                                    actionIndex,
                                    targetDieId: die.id,
                                },
                            }],
                            metadata: withAiActionStrategyTags({
                                passiveId: passive.id,
                                actionIndex,
                                targetDieId: die.id,
                            }, ['dice-setup']),
                        });
                    });
                return;
            }

            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('passive', passive.id, actionIndex),
                kind: 'use-passive-ability',
                label: `使用被动 ${passive.id}`,
                commands: [{
                    type: 'USE_PASSIVE_ABILITY',
                    payload: {
                        passiveId: passive.id,
                        actionIndex,
                    },
                }],
                metadata: withAiActionStrategyTags({
                    passiveId: passive.id,
                    actionIndex,
                }, passiveAction.type === 'drawCard' ? ['economy'] : []),
            });
        });
    }

    return actions;
};

const buildPhaseActions = (state: DiceThroneState, playerId: PlayerId, phase: TurnPhase): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    if (!player) return actions;
    const rerollBlockedByBindCp = isOffensiveRollRerollBlockedByBindCp(state, playerId, phase);

    if (phase === 'discard') {
        // 规则口径（Rulepop）：弃牌阶段应"卖牌得 CP"而非纯弃牌。
        // AI 优先卖牌（得 1 CP），只有无法卖牌时才纯弃牌。
        if (canSellCard(state.core, playerId)) {
            for (const card of player.hand) {
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('sell-card', card.id),
                    kind: 'sell-card',
                    label: `卖出 ${card.id}`,
                    commands: [{
                        type: 'SELL_CARD',
                        payload: { cardId: card.id },
                    }],
                    metadata: withAiActionStrategyTags({ cardId: card.id }, buildCardStrategyTags(card, 'sell-card')),
                });
            }
        }
        // 纯弃牌作为兜底（当卖牌不可用时）
        for (const card of player.hand) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('discard', card.id),
                kind: 'discard-card',
                label: `弃置 ${card.id}`,
                commands: [{
                    type: 'DISCARD_CARD',
                    payload: { cardId: card.id },
                }],
                metadata: withAiActionStrategyTags({ cardId: card.id }, buildCardStrategyTags(card, 'discard-card')),
            });
        }
    }

    if (
        (phase === 'offensiveRoll' || phase === 'targetingRoll' || phase === 'defensiveRoll')
        && state.core.rollCount < state.core.rollLimit
        && !state.core.rollConfirmed
        && !rerollBlockedByBindCp
    ) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('roll', 'dice'),
            kind: 'roll-dice',
            label: '掷骰',
            commands: [{ type: 'ROLL_DICE', payload: {} }],
            metadata: withAiActionStrategyTags({}, ['dice-setup']),
        });
    }

    if (phase === 'targetingRoll') {
        if (state.core.rollCount > 0 && !state.core.rollConfirmed) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('roll', 'confirm-targeting'),
                kind: 'confirm-roll',
                label: '确认目标骰面',
                commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                metadata: withAiActionStrategyTags({
                    rollConfirmScope: 'main-roll',
                    rollConfirmPhase: phase,
                }, ['dice-setup']),
            });
        }
    }

    if (phase === 'offensiveRoll' || phase === 'defensiveRoll') {
        const offensiveAttackAlreadyInitiated = phase === 'offensiveRoll' && Boolean(state.core.pendingAttack);
        const canPlayRollCardsInPhase = phase === 'defensiveRoll' || !offensiveAttackAlreadyInitiated;
        if (phase === 'offensiveRoll'
            && state.core.rollCount > 0
            && !state.core.rollConfirmed
            && !rerollBlockedByBindCp
        ) {
            for (const die of getAiActiveDice(state, phase)) {
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('toggle-die-lock', die.id, die.isKept ? 'unlock' : 'lock'),
                    kind: 'toggle-die-lock',
                    label: `${die.isKept ? '解锁' : '锁定'}骰子 ${die.id}`,
                    commands: [{
                        type: 'TOGGLE_DIE_LOCK',
                        payload: { dieId: die.id },
                    }],
                    metadata: withAiActionStrategyTags({
                        dieId: die.id,
                        isKept: die.isKept,
                        dieValue: die.value,
                        dieSymbol: die.symbol,
                    }, ['dice-setup']),
                });
            }
        }

        if (canPlayRollCardsInPhase) {
            for (const card of player.hand) {
                const check = checkPlayCard(state.core, playerId, card, phase);
                if (!check.ok) continue;
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('play-card', card.id),
                    kind: 'play-card',
                    label: `打出 ${card.id}`,
                    commands: [{
                        type: 'PLAY_CARD',
                        payload: { cardId: card.id },
                    }],
                    metadata: withAiActionStrategyTags({ cardId: card.id }, buildCardStrategyTags(card, 'play-card')),
                });
            }
        }

        const abilityIds = (() => {
            if (offensiveAttackAlreadyInitiated) {
                // 攻击已发起（pendingAttack 已创建）后，offensiveRoll 阶段不应再允许重复选技能。
                // 否则在线 AI 可能在状态同步抖动时反复发 SELECT_ABILITY，
                // 触发 attack_already_initiated 拒绝并造成“动画回放/卡死”观感。
                return [];
            }
            if (phase === 'offensiveRoll') {
                return getAvailableAbilityIds(state.core, playerId, phase);
            }

            const selectedDefenseAbilityId = state.core.pendingAttack?.defenseAbilityId;
            // 防御技能一旦选定，本地 AI 不再生成 select-ability，避免在可选防御技间来回切换卡死。
            if (selectedDefenseAbilityId) {
                return [];
            }

            if (state.core.rollCount === 0) {
                return getDefensiveAbilityIds(state.core, playerId);
            }

            return getAvailableAbilityIds(state.core, playerId, phase);
        })();
        for (const abilityId of abilityIds) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('ability', abilityId),
                kind: 'select-ability',
                label: `选择技能 ${abilityId}`,
                commands: [{
                    type: 'SELECT_ABILITY',
                    payload: { abilityId },
                }],
                metadata: withAiActionStrategyTags({ abilityId }, buildAbilityStrategyTags(state, playerId, abilityId)),
            });
        }

        if (!offensiveAttackAlreadyInitiated) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('roll', 'confirm'),
                kind: 'confirm-roll',
                label: '确认骰面',
                commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                metadata: withAiActionStrategyTags({
                    rollConfirmScope: 'main-roll',
                    rollConfirmPhase: phase,
                }, ['dice-setup']),
            });
        }
    }

    if (phase === 'main1' || phase === 'main2') {
        // 主阶段出牌/卖牌只属于当前行动玩家。
        // 若让非当前玩家先枚举候选，再依赖最终 validate 拒绝，会制造大量误导性 player_mismatch 日志。
        if (playerId !== state.core.activePlayerId) {
            return actions;
        }

        for (const card of player.hand) {
            if (card.type === 'upgrade') {
                const targetAbilityId = card.effects?.find((effect) => effect.action?.type === 'replaceAbility')?.action?.targetAbilityId;
                if (!targetAbilityId) continue;
                const check = checkPlayUpgradeCard(state.core, playerId, card, targetAbilityId, phase);
                if (!check.ok) continue;
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('play-upgrade', card.id, targetAbilityId),
                    kind: 'play-upgrade-card',
                    label: `升级 ${card.id}`,
                    commands: [{
                        type: 'PLAY_UPGRADE_CARD',
                        payload: { cardId: card.id, targetAbilityId },
                    }],
                    metadata: withAiActionStrategyTags({ cardId: card.id, targetAbilityId }, buildCardStrategyTags(card, 'play-upgrade-card')),
                });
                continue;
            }

            const check = checkPlayCard(state.core, playerId, card, phase);
            if (!check.ok) continue;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('play-card', card.id),
                kind: 'play-card',
                label: `打出 ${card.id}`,
                commands: [{
                    type: 'PLAY_CARD',
                    payload: { cardId: card.id },
                }],
                metadata: withAiActionStrategyTags({ cardId: card.id }, buildCardStrategyTags(card, 'play-card')),
            });
        }

        if (canSellCard(state.core, playerId)) {
            const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
            const projectedCoreAfterSell: DiceThroneCore = {
                ...state.core,
                players: {
                    ...state.core.players,
                    [playerId]: {
                        ...player,
                        resources: {
                            ...player.resources,
                            [RESOURCE_IDS.CP]: currentCp + 1,
                        },
                    },
                },
            };
            for (const card of player.hand) {
                const unlocksImmediatePlay = player.hand.some((candidate) => {
                    if (candidate.id === card.id) return false;
                    if (currentCp >= candidate.cpCost || currentCp + 1 < candidate.cpCost) return false;

                    if (candidate.type === 'upgrade') {
                        const targetAbilityId = candidate.effects?.find((effect) => effect.action?.type === 'replaceAbility')?.action?.targetAbilityId;
                        if (!targetAbilityId) return false;
                        return checkPlayUpgradeCard(projectedCoreAfterSell, playerId, candidate, targetAbilityId, phase).ok;
                    }

                    return checkPlayCard(projectedCoreAfterSell, playerId, candidate, phase).ok;
                });
                if (!unlocksImmediatePlay) {
                    continue;
                }

                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('sell-card', card.id),
                    kind: 'sell-card',
                    label: `卖出 ${card.id}`,
                    commands: [{
                        type: 'SELL_CARD',
                        payload: { cardId: card.id },
                    }],
                    metadata: withAiActionStrategyTags({ cardId: card.id }, buildCardStrategyTags(card, 'sell-card')),
                });
            }
        }

        // 强口径：AI 不生成 UNDO_SELL_CARD。
        // 原因：撤回卖牌属于“人类 UI 纠错手段”，对 AI 来说容易形成 sell ↔ undo 的循环动作，
        // 尤其远程 AI / 模型策略不稳定时，会造成无限重复交互与卡死体验。
        // 真人玩家仍可通过 UI 使用 UNDO_SELL_CARD；这里只是从 AI 的 legalActions 中移除。
    }

    if ((phase === 'upkeep' || phase === 'income' || phase === 'main1')
        && (state.core.players[playerId]?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0) > 0
        && (state.core.players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0) >= 2
    ) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('status', 'remove-knockdown'),
            kind: 'pay-remove-knockdown',
            label: '花费 2CP 移除击倒',
            commands: [{
                type: DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN,
                payload: {},
            }],
            metadata: withVisibleStepDelayPolicy(withAiActionStrategyTags({}, ['survive-response']), 'hidden'),
        });
    }

    if (canAdvancePhase(state.core, phase)) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('phase', 'advance', phase, getNextPhase(state.core, phase)),
            kind: 'advance-phase',
            label: `推进到 ${getNextPhase(state.core, phase)}`,
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
            metadata: withAiActionStrategyTags({ phase, nextPhase: getNextPhase(state.core, phase) }, []),
        });
    }

    return actions;
};

export function buildDiceThroneAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as DiceThroneState;
    const player = state.core.players[args.playerId];
    if (!player) return [];

    const phase = (state.sys.phase ?? state.sys.flow?.phase ?? 'setup') as TurnPhase;

    const interactionActions = buildInteractionActions(state, args.playerId, phase);
    if (interactionActions !== null) {
        const validInteractionActions = interactionActions.filter((action) =>
            action.commands.every((command) => isCommandValid(state, args.playerId, command.type, command.payload)),
        );
        if (validInteractionActions.length > 0) {
            return validInteractionActions;
        }

        const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
        if (current?.playerId === args.playerId) {
            return [buildEmergencyInteractionCancelAction(current.id, 'no-legal-actions')];
        }

        return [];
    }

    if (phase === 'setup') {
        return buildSetupActions(state, args.playerId);
    }

    if (state.sys.responseWindow?.current || hasPendingTokenResponseForPlayer(state, args.playerId)) {
        return buildResponseActions(state, args.playerId, phase);
    }

    const settlement = state.core.pendingBonusDiceSettlement as PendingBonusDiceSettlement | undefined;
    const hasActiveBonusDiceSettlement = Boolean(
        settlement && isCurrentBonusRollSettlement(state.core, settlement),
    );
    if (hasActiveBonusDiceSettlement) {
        const bonusDiceActions = [
            ...buildBonusDicePlayableCardActions(state, args.playerId, phase),
            ...buildPassiveActions(state, args.playerId, phase, { rerollOnly: true }),
            ...buildBonusDiceActions(state, args.playerId),
        ];
        if (bonusDiceActions.length > 0) {
            return bonusDiceActions;
        }
        return [];
    }

    return [
        ...buildPurifyActions(state, args.playerId),
        ...buildPassiveActions(state, args.playerId, phase),
        ...buildPhaseActions(state, args.playerId, phase),
    ];
}

const getContextPhase = (context: AiDecisionContext): TurnPhase => {
    const state = context.visibleState as DiceThroneState;
    return getDiceThronePhaseFromState(state);
};

const pushDiceThroneStrategyTag = (
    tags: DiceThroneStrategyTag[],
    tag: DiceThroneStrategyTag,
): void => {
    if (!tags.includes(tag)) {
        tags.push(tag);
    }
};

const addDiceThroneStrategyWeight = (
    weights: Partial<Record<DiceThroneStrategyTag, number>>,
    tag: DiceThroneStrategyTag,
    value: number,
): void => {
    weights[tag] = Number(((weights[tag] ?? 0) + value).toFixed(3));
};

const findPlayerHandCard = (
    state: DiceThroneState,
    playerId: PlayerId,
    cardId: string,
): AbilityCard | null => {
    return state.core.players[playerId]?.hand.find((card) => card.id === cardId) ?? null;
};

const getDiceThroneStrategyProfile = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
): AiStrategyProfile<DiceThroneStrategyTag> => {
    const player = state.core.players[playerId];
    if (!player) {
        return { tags: [], tagWeights: {}, summary: [] };
    }

    const hp = player.resources[RESOURCE_IDS.HP] ?? 0;
    const cp = player.resources[RESOURCE_IDS.CP] ?? 0;
    const handSize = player.hand.length;
    const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;
    const incomingDamage = pendingDamage?.targetPlayerId === playerId
        ? pendingDamage.currentDamage ?? 0
        : 0;
    const pressured = incomingDamage >= Math.max(4, Math.floor(hp / 2));
    const lethal = incomingDamage >= hp && hp > 0;
    const opponentIds = getOpponentIds(state, playerId);
    const lowestOpponentHp = opponentIds.reduce((best, opponentId) => {
        const opponentHp = state.core.players[opponentId]?.resources[RESOURCE_IDS.HP] ?? 999;
        return Math.min(best, opponentHp);
    }, 999);
    const weights: Partial<Record<DiceThroneStrategyTag, number>> = {};
    const summary: string[] = [];

    if (lethal) {
        addDiceThroneStrategyWeight(weights, 'survive-response', 2.6);
        addDiceThroneStrategyWeight(weights, 'purify-control', 1.1);
        summary.push('先保命');
    } else if (pressured) {
        addDiceThroneStrategyWeight(weights, 'survive-response', 2.1);
        addDiceThroneStrategyWeight(weights, 'purify-control', 0.9);
        summary.push('先稳住血线');
    } else {
        addDiceThroneStrategyWeight(weights, 'damage-race', 1.2);
    }

    if (lowestOpponentHp <= 8) {
        addDiceThroneStrategyWeight(weights, 'damage-race', 1.4);
        summary.push('逼近斩杀线');
    }

    if (phase === 'offensiveRoll' || phase === 'defensiveRoll') {
        addDiceThroneStrategyWeight(weights, 'dice-setup', phase === 'offensiveRoll' ? 2 : 1.5);
        summary.push('优先做骰面规划');
    }

    if (phase === 'main1' || phase === 'main2') {
        if (cp <= 1 || handSize <= 2) {
            addDiceThroneStrategyWeight(weights, 'economy', 1.4);
            summary.push('主阶段优先补资源');
        }
        if (handSize > 0) {
            addDiceThroneStrategyWeight(weights, 'upgrade-engine', 1.1);
        }
    }

    if (hasDebuffs(state.core, playerId)) {
        addDiceThroneStrategyWeight(weights, 'purify-control', 1.2);
    }

    const tags = (Object.entries(weights) as Array<[DiceThroneStrategyTag, number]>)
        .filter(([, weight]) => weight >= 0.9)
        .map(([tag]) => tag);

    return {
        tags,
        tagWeights: weights,
        summary: summary.length > 0 ? [...new Set(summary)] : ['平衡进攻、资源与防守'],
    };
};

const buildCardStrategyTags = (
    card: AbilityCard,
    actionKind: AiLegalAction['kind'],
): DiceThroneStrategyTag[] => {
    const tags: DiceThroneStrategyTag[] = [];

    if (actionKind === 'play-upgrade-card') {
        pushDiceThroneStrategyTag(tags, 'upgrade-engine');
        return tags;
    }

    if (actionKind === 'sell-card' || actionKind === 'discard-card') {
        pushDiceThroneStrategyTag(tags, 'economy');
        return tags;
    }

    if (card.isAttackModifier) {
        pushDiceThroneStrategyTag(tags, 'damage-race');
    }
    if (getCardDrawCount(card) > 0) {
        pushDiceThroneStrategyTag(tags, 'economy');
    }

    return tags;
};

const buildAbilityStrategyTags = (
    state: DiceThroneState,
    playerId: PlayerId,
    abilityId: string,
): DiceThroneStrategyTag[] => {
    const tags: DiceThroneStrategyTag[] = [];
    const match = findPlayerAbility(state.core, playerId, abilityId);
    if (!match) return tags;

    if (match.ability.type === 'offensive') {
        pushDiceThroneStrategyTag(tags, 'damage-race');
        pushDiceThroneStrategyTag(tags, 'dice-setup');
    }
    if (match.ability.type === 'defensive' || match.ability.tags?.includes('defensive')) {
        pushDiceThroneStrategyTag(tags, 'survive-response');
        pushDiceThroneStrategyTag(tags, 'dice-setup');
    }
    return tags;
};

const diceThroneKindScorer = createActionKindScorer('kind-weight', {
    'interaction-choice': 240,
    'interaction-multistep': 240,
    'use-purify': 210,
    'pay-remove-knockdown': 195,
    'token-response': 160,
    'response-play-card': 150,
    'use-passive-ability': 135,
    'select-ability': 220,
    'toggle-die-lock': 185,
    'roll-dice': 170,
    'confirm-roll': 120,
    'bonus-die-reroll': 105,
    'skip-bonus-dice-reroll': 15,
    'setup-select-character': 180,
    'setup-ready': 160,
    'setup-host-start': 150,
    'play-upgrade-card': 200,
    'play-card': 120,
    'sell-card': 30,
    'undo-sell-card': -40,
    'discard-card': 0,
    'skip-token-response': 30,
    'response-pass': 20,
    'advance-phase': 10,
});

const setupCharacterProfileScorer: LocalAiActionScorer = {
    id: 'setup-character-neutral',
    score(_context, action) {
        if (action.kind !== 'setup-select-character') return null;
        return {
            score: 0,
            reason: '从已完成角色池中随机选择',
        };
    },
};

const setupCharacterRandomScorer: LocalAiActionScorer = {
    id: 'setup-character-random',
    score(context, action) {
        if (action.kind !== 'setup-select-character') return null;
        const noise = buildDeterministicAiNoise(context, action, 'setup');
        return {
            score: Number((noise * 8).toFixed(3)),
            reason: '已完成角色池内保留可复现随机',
            metadata: { noise },
        };
    },
};

const abilityValueScorer: LocalAiActionScorer = {
    id: 'ability-value',
    score(context, action) {
        if (action.kind !== 'select-ability') return null;
        const abilityId = typeof action.metadata?.abilityId === 'string'
            ? action.metadata.abilityId
            : null;
        if (!abilityId) return null;

        const state = context.visibleState as DiceThroneState;
        const match = findPlayerAbility(state.core, context.playerId, abilityId);
        if (!match) return null;

        const phase = getContextPhase(context);
        const baseDamage = getPlayerAbilityBaseDamage(state.core, context.playerId, abilityId);
        const effectValue = estimateEffectsStrategicValue(
            state,
            context.playerId,
            getPlayerAbilityEffects(state.core, context.playerId, abilityId),
        );
        let score = Math.max(baseDamage * 25, effectValue);

        if (match.ability.type === 'offensive' && phase === 'offensiveRoll') {
            score += 90;
        }
        if ((match.ability.type === 'defensive' || match.ability.tags?.includes('defensive')) && phase === 'defensiveRoll') {
            score += 110;
        }
        if (match.ability.tags?.includes('ultimate')) {
            score += 45;
        }

        return {
            score,
            reason: effectValue > baseDamage * 25
                ? `能力 ${abilityId} 的动态效果收益更高`
                : `能力 ${abilityId} 的基础收益更高`,
        };
    },
};

const cardValueScorer: LocalAiActionScorer = {
    id: 'card-value',
    score(context, action) {
        const cardId = typeof action.metadata?.cardId === 'string'
            ? action.metadata.cardId
            : null;
        if (!cardId) return null;

        const state = context.visibleState as DiceThroneState;
        const card = findPlayerHandCard(state, context.playerId, cardId);
        if (!card) return null;

        if (action.kind === 'play-upgrade-card') {
            return {
                score: 70 + card.cpCost * 18,
                reason: `优先打出升级牌 ${cardId}`,
            };
        }

        const drawCount = card.effects?.reduce((sum, effect) => {
            if (effect.action?.type !== 'drawCard') return sum;
            return sum + (effect.action.drawCount ?? effect.action.value ?? 0);
        }, 0) ?? 0;
        const phase = getContextPhase(context);

        if (action.kind === 'play-card' || action.kind === 'response-play-card') {
            let score = estimateCardStrategicValue(state, context.playerId, card, action.kind)
                + (card.isAttackModifier ? 8 : 0);
            let reason = card.isAttackModifier
                ? `攻击修正牌 ${cardId} 具有即时收益`
                : `行动牌 ${cardId} 可带来额外收益`;

            const diceInteractionValue = estimateDiceInterferenceCardValue(state, context.playerId, card, phase);
            if (diceInteractionValue) {
                score += diceInteractionValue.score;
                reason = diceInteractionValue.reason;
            }

            if (drawCount > 0) {
                const handSize = state.core.players[context.playerId]?.hand.length ?? 0;
                score += Math.max(0, drawCount * 18 - handSize * 4);
                reason = `补牌牌 ${cardId} 在手牌偏少时收益更高`;
            }

            if (action.kind === 'response-play-card') {
                score += 15;
                reason = `${reason}（响应窗口）`;
            }

            return {
                score,
                reason,
            };
        }

        if (action.kind === 'sell-card') {
            const phase = getContextPhase(context);
            if (phase === 'discard') {
                // 弃牌阶段卖牌策略：卖掉最不值得保留的牌（低费、无特殊效果的牌得分更高）
                // 每张牌卖价固定 1 CP，所以卖高费牌是亏的（失去高费牌只换 1 CP）
                const keepValue = estimateCardStrategicValue(state, context.playerId, card, 'discard-card')
                    + (card.type === 'upgrade' ? 25 : 0);
                return {
                    score: -keepValue,
                    reason: `弃牌阶段卖 ${cardId}：保留价值越低的牌越适合卖`,
                };
            }
            // 主阶段卖牌：卖高费牌可解锁更多操作空间
            return {
                score: 10 + card.cpCost * 8 - estimateCardStrategicValue(state, context.playerId, card, 'sell-card') * 0.2,
                reason: `卖牌 ${cardId} 可换取 CP`,
            };
        }

        if (action.kind === 'discard-card') {
            return {
                // 弃牌评分应为负值：目的是在多张可弃牌中选最该弃的那张（相对排序），
                // 而非让弃牌动作总分超过 advance-phase 导致 AI 在手牌未超限时也优先弃牌。
                // cpCost 越高越该保留，所以弃高费牌应更不被偏好（更负）。
                score: -estimateCardStrategicValue(state, context.playerId, card, 'discard-card'),
                reason: `弃牌 ${cardId}：费用/收益越高的牌越不舍得弃`,
            };
        }

        return null;
    },
};

const interactionValueScorer: LocalAiActionScorer = {
    id: 'interaction-value',
    score(context, action) {
        const state = context.visibleState as DiceThroneState;
        const interactionId = typeof action.metadata?.interactionId === 'string'
            ? action.metadata.interactionId
            : null;
        const phase = getContextPhase(context);
        const currentInteraction = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
        const currentInteractionData = currentInteraction?.kind === 'multistep-choice'
            ? currentInteraction.data as DiceInteractionData | undefined
            : undefined;
        const currentDice = getAiActiveDice(state, phase);
        const targetOpponentDice = currentInteraction?.kind === 'multistep-choice'
            && (!interactionId || currentInteraction.id === interactionId)
            && currentInteractionData?.meta?.targetOpponentDice === true;
        const scoreForTargetValue = (value: number) => (targetOpponentDice ? (7 - value) : value);
        const scoreForDieValue = (value: number) => (targetOpponentDice ? value : (7 - value));

        if (action.kind === 'interaction-multistep') {
            const dieIds = Array.isArray(action.metadata?.dieIds)
                ? action.metadata.dieIds.filter((dieId): dieId is number => typeof dieId === 'number')
                : [];
            const newValues = Array.isArray(action.metadata?.newValues)
                ? action.metadata.newValues.filter((value): value is number => typeof value === 'number')
                : [];
            const newValue = typeof action.metadata?.newValue === 'number'
                ? action.metadata.newValue
                : null;
            const dieId = typeof action.metadata?.dieId === 'number'
                ? action.metadata.dieId
                : null;
            const getDeltaScore = (values: number[], ids: number[]) => {
                return values.reduce((sum, value, index) => {
                    const dieId = ids[index];
                    const die = dieId === undefined
                        ? null
                        : currentDice.find((item) => item.id === dieId) ?? null;
                    if (!die) return sum;
                    const delta = value - die.value;
                    const normalized = targetOpponentDice ? -delta : delta;
                    return sum + normalized * 12;
                }, 0);
            };
            if (newValues.length > 0) {
                const deltaScore = getDeltaScore(newValues, dieIds);
                const projection = dieIds.length === newValues.length
                    ? evaluateDiceProjection(
                        state,
                        context.playerId,
                        phase,
                        targetOpponentDice,
                        buildProjectedDice(
                            currentDice,
                            dieIds.map((currentDieId, index) => ({ dieId: currentDieId, newValue: newValues[index] })),
                        ),
                    )
                    : null;
                const projectionDriven = currentInteractionData?.meta?.dtType === 'modifyDie' && !!projection;
                return {
                    score: projectionDriven
                        ? (projection?.score ?? 0) + newValues.length * 14
                        : newValues.reduce((sum, value) => sum + scoreForTargetValue(value) * 18, 0)
                            + newValues.length * 16
                            + deltaScore
                            + (projection?.score ?? 0),
                    reason: projection && projection.planDelta > 0
                        ? (targetOpponentDice
                            ? `优先把对手从 ${projection.currentPlanId ?? '当前技能线'} 拉离，目标点数 ${newValues.join(', ')}`
                            : `优先把骰面调整到更接近 ${projection.projectedPlanId ?? '目标技能'} 的路线`)
                        : (targetOpponentDice
                            ? `优先让对手骰面更低，目标点数 ${newValues.join(', ')}`
                            : `优先完成更多骰子调整，累计目标点数 ${newValues.join(', ')}`),
                };
            }
            if (newValue !== null) {
                const deltaScore = getDeltaScore([newValue], dieId !== null ? [dieId] : []);
                const projection = dieId !== null
                    ? evaluateDiceProjection(
                        state,
                        context.playerId,
                        phase,
                        targetOpponentDice,
                        buildProjectedDice(currentDice, [{ dieId, newValue }]),
                    )
                    : null;
                const projectionDriven = currentInteractionData?.meta?.dtType === 'modifyDie' && !!projection;
                return {
                    score: projectionDriven
                        ? (projection?.score ?? 0) + 14
                        : scoreForTargetValue(newValue) * 18 + deltaScore + (projection?.score ?? 0),
                    reason: projection && projection.planDelta > 0
                        ? (targetOpponentDice
                            ? `优先把对手从 ${projection.currentPlanId ?? '当前技能线'} 拉开`
                            : `优先把骰子改到更接近 ${projection.projectedPlanId ?? '目标技能'} 的值`)
                        : (targetOpponentDice
                            ? `优先把对手骰面压到更低点数 ${newValue}`
                            : `优先把骰子调整到更高点数 ${newValue}`),
                };
            }

            if (dieIds.length > 0) {
                const totalScore = dieIds.reduce((sum, currentDieId) => {
                    const die = currentDice.find((item) => item.id === currentDieId);
                    return sum + (die ? scoreForDieValue(die.value) * 12 : 0);
                }, 0);
                return {
                    score: totalScore + dieIds.length * 18 + (
                        currentInteractionData?.meta?.dtType === 'selectDie'
                            ? (evaluateExpectedRerollSelection(
                                state,
                                context.playerId,
                                phase,
                                targetOpponentDice,
                                currentDice.filter((die) => dieIds.includes(die.id)),
                            )?.score ?? 0)
                            : 0
                    ),
                    reason: currentInteractionData?.meta?.dtType === 'selectDie'
                        ? (targetOpponentDice
                            ? `优先重掷最能打断对手技能线的骰子 ${dieIds.join(', ')}`
                            : `优先重掷最能改善当前技能线的骰子 ${dieIds.join(', ')}`)
                        : (targetOpponentDice
                            ? `优先处理对手高点骰子 ${dieIds.join(', ')}`
                            : `优先一次处理更多低点骰子 ${dieIds.join(', ')}`),
                };
            }
            if (dieId !== null) {
                const die = currentDice.find((item) => item.id === dieId);
                if (die) {
                    return {
                        score: scoreForDieValue(die.value) * 12,
                        reason: targetOpponentDice
                            ? `优先重掷对手高点骰子 ${die.value}`
                            : `优先重掷较低点数的骰子 ${die.value}`,
                    };
                }
            }
        }

        if (action.kind === 'interaction-choice') {
            const optionId = typeof action.metadata?.optionId === 'string'
                ? action.metadata.optionId
                : '';
            if (optionId.includes('confirm') || optionId.includes('accept')) {
                return {
                    score: 20,
                    reason: '确认类交互通常代表当前方案已经可执行',
                };
            }
            return {
                score: 5,
                reason: '普通交互选项保留轻微优先级',
            };
        }

        if (action.kind === 'interaction-select-player') {
            const selectedPlayerIds = Array.isArray(action.metadata?.selectedPlayerIds)
                ? action.metadata.selectedPlayerIds.filter((playerId): playerId is PlayerId => typeof playerId === 'string')
                : [];
            if (selectedPlayerIds.length === 0) return null;

            const interaction = getCardInteractionById(state, interactionId);

            if (interaction) {
                const tokenConfigs = interaction.tokenGrantConfigs ?? (
                    interaction.tokenGrantConfig ? [interaction.tokenGrantConfig] : []
                );
                const statusConfigs = interaction.statusGrantConfigs ?? (
                    interaction.statusGrantConfig ? [interaction.statusGrantConfig] : []
                );

                const grantScore = selectedPlayerIds.reduce((sum, targetPlayerId) => {
                    const tokenScore = tokenConfigs.reduce((inner, config) => {
                        return inner + getGrantedEffectValue(
                            state,
                            context.playerId,
                            targetPlayerId,
                            config.tokenId,
                            config.amount,
                        );
                    }, 0);
                    const statusScore = statusConfigs.reduce((inner, config) => {
                        return inner + getGrantedEffectValue(
                            state,
                            context.playerId,
                            targetPlayerId,
                            config.statusId,
                            config.amount,
                        );
                    }, 0);
                    return sum + tokenScore + statusScore;
                }, 0);

                if (grantScore !== 0) {
                    return {
                        score: grantScore,
                        reason: '选人交互会优先把增益交给友方、把减益交给敌方',
                    };
                }

                const isRemoveAllStatuses =
                    interaction.requiresTargetWithStatus === true
                    && !interaction.resolveCustomActionId
                    && tokenConfigs.length === 0
                    && statusConfigs.length === 0;
                if (isRemoveAllStatuses) {
                    const cleanupScore = selectedPlayerIds.reduce((sum, targetPlayerId) => {
                        return sum + scoreRemoveAllStatusesTarget(state, context.playerId, targetPlayerId);
                    }, 0);

                    if (cleanupScore !== 0) {
                        return {
                            score: cleanupScore,
                            reason: '移除状态会优先清理己方减益或敌方增益更重的目标',
                        };
                    }
                }
            }

            const allTargetsAreOpponents = selectedPlayerIds.every((targetPlayerId) => {
                return !isFriendlyTarget(state, context.playerId, targetPlayerId);
            });
            if (!allTargetsAreOpponents) return null;

            const pressureScore = selectedPlayerIds.reduce((sum, targetPlayerId) => {
                const hp = state.core.players[targetPlayerId]?.resources[RESOURCE_IDS.HP] ?? 50;
                return sum + Math.max(0, 60 - hp);
            }, 0);

            return {
                score: pressureScore,
                reason: '敌方目标选择优先压低血量更低的一侧',
            };
        }

        if (action.kind === 'interaction-remove-status') {
            const targetPlayerId = typeof action.metadata?.targetPlayerId === 'string'
                ? action.metadata.targetPlayerId
                : null;
            const statusId = typeof action.metadata?.statusId === 'string'
                ? action.metadata.statusId
                : null;
            if (!targetPlayerId || !statusId) return null;

            const score = scoreRemoveSingleStatusTarget(state, context.playerId, targetPlayerId, statusId);
            if (score === 0) return null;

            return {
                score,
                reason: '移除状态会优先清理己方减益或敌方关键增益',
            };
        }

        if (action.kind === 'interaction-transfer-status') {
            const fromPlayerId = typeof action.metadata?.fromPlayerId === 'string'
                ? action.metadata.fromPlayerId
                : null;
            const toPlayerId = typeof action.metadata?.toPlayerId === 'string'
                ? action.metadata.toPlayerId
                : null;
            const statusId = typeof action.metadata?.statusId === 'string'
                ? action.metadata.statusId
                : null;
            if (!fromPlayerId || !toPlayerId || !statusId) return null;

            const score = scoreTransferStatusTarget(state, context.playerId, fromPlayerId, toPlayerId, statusId);
            if (score === 0) return null;

            return {
                score,
                reason: '转移状态会优先把己方减益甩给敌方，或把敌方增益剥离出去',
            };
        }

        return null;
    },
};

const interactionHintScorer = createInteractionHintScorer({
    id: 'interaction-ai-hints',
    actionKinds: [
        'interaction-choice',
        'interaction-select-player',
        'interaction-remove-status',
        'interaction-transfer-status',
    ],
    skipPenaltyWhenAlternativesExist: 35,
});

const bonusDieScorer: LocalAiActionScorer = {
    id: 'bonus-die',
    score(context, action) {
        const state = context.visibleState as DiceThroneState;
        const settlement = state.core.pendingBonusDiceSettlement as PendingBonusDiceSettlement | undefined;
        if (!settlement) return null;
        const currentValue = evaluateBonusDiceSettlementValue(state, settlement);
        const bestRerollDelta = getPendingBonusSettlementDice(settlement).reduce((best, die) => {
            const expectedValue = evaluateExpectedBonusDieRerollValue(state, settlement, die.index);
            if (expectedValue === null) return best;
            return Math.max(best, expectedValue - currentValue);
        }, Number.NEGATIVE_INFINITY);

        if (action.kind === 'bonus-die-reroll') {
            const dieIndex = typeof action.metadata?.dieIndex === 'number'
                ? action.metadata.dieIndex
                : null;
            const die = dieIndex !== null
                ? getPendingBonusSettlementDice(settlement).find((item) => item.index === dieIndex)
                : null;
            if (!die) return null;
            const expectedValue = evaluateExpectedBonusDieRerollValue(state, settlement, die.index);
            if (expectedValue === null) return null;
            const delta = expectedValue - currentValue;
            return {
                score: delta > 0
                    ? 120 + delta
                    : -220 + delta,
                reason: delta > 0
                    ? `这颗奖励骰重掷后有更高结算期望，当前 ${die.value} 点值得搏一下`
                    : `这颗奖励骰重掷期望反而更差，当前 ${die.value} 点更适合保留`,
            };
        }

        if (action.kind === 'confirm-roll' || action.kind === 'skip-bonus-dice-reroll') {
            return {
                score: bestRerollDelta > 0
                    ? -140 + currentValue * 0.05
                    : 80 + currentValue * 0.05,
                reason: bestRerollDelta > 0
                    ? '仍有更优的奖励骰重掷线，暂时不该直接确认'
                    : '当前奖励骰已经接近最优，直接确认收益更稳',
            };
        }

        return null;
    },
};

const dicePlanScorer: LocalAiActionScorer = {
    id: 'dice-plan',
    score(context, action) {
        const phase = getContextPhase(context);
        if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') return null;

        const state = context.visibleState as DiceThroneState;
        if (state.core.rollConfirmed) return null;

        const activeDice = getAiActiveDice(state, phase);
        const plan = getBestDiceTargetPlan(state, context.playerId, phase);
        const chasePlan = getHigherAmbitionChasePlan(state, context.playerId, phase);
        const effectivePlan = chasePlan ?? plan;
        const pendingToggleCount = activeDice.filter((die) => {
            const shouldKeep = effectivePlan ? effectivePlan.keepDieIds.includes(die.id) : false;
            return shouldKeep !== die.isKept;
        }).length;
        const shouldSpendDiceToolBeforeMoreLocking = shouldPrioritizeDiceToolBeforeMoreLocking(
            activeDice,
            effectivePlan,
            countAffordableDiceToolCards(state, context.playerId, phase),
        );
        const rerollBlockedByBindCp = isOffensiveRollRerollBlockedByBindCp(state, context.playerId, phase);

        if (action.kind === 'toggle-die-lock') {
            const dieId = typeof action.metadata?.dieId === 'number' ? action.metadata.dieId : null;
            const die = dieId !== null ? activeDice.find((candidate) => candidate.id === dieId) : null;
            if (!die) return null;
            const shouldKeep = effectivePlan ? effectivePlan.keepDieIds.includes(die.id) : false;
            if (shouldKeep === die.isKept) return null;
            if (rerollBlockedByBindCp) {
                return {
                    score: -240,
                    reason: '紧缚且 CP 不足，已经不能继续重投，锁骰调整没有收益',
                };
            }

            return {
                score: shouldSpendDiceToolBeforeMoreLocking
                    ? (shouldKeep
                        ? 80 + (effectivePlan?.ambitionScore ?? 0) * 0.12
                        : 70)
                    : (shouldKeep
                        ? 175 + (effectivePlan?.ambitionScore ?? 0) * 0.45
                        : 135),
                reason: shouldKeep
                    ? (shouldSpendDiceToolBeforeMoreLocking
                        ? `已经锁住一颗关键骰，先用改骰牌推进 ${effectivePlan?.abilityId ?? '高价值技能'}，不继续空锁`
                        : `先锁住接近 ${effectivePlan?.abilityId ?? '高价值技能'} 的关键骰子`)
                    : (shouldSpendDiceToolBeforeMoreLocking
                        ? '已经有关键骰和改骰牌，先打牌而不是继续整理锁骰'
                        : '先解锁无关骰子，再进行下一次重投'),
            };
        }

        if (action.kind === 'roll-dice') {
            if (state.core.rollCount === 0) {
                return {
                    score: 45,
                    reason: '先拿到第一手骰面，再决定锁骰与重投路线',
                };
            }
            if (rerollBlockedByBindCp) {
                return {
                    score: -220,
                    reason: '紧缚要求额外消耗 CP，但当前 CP 不足，不能继续重投',
                };
            }
            if (pendingToggleCount > 0) {
                return {
                    score: -140,
                    reason: '还有锁骰调整没做完，先别急着直接重投',
                };
            }
            if (state.core.rollCount >= state.core.rollLimit) {
                return {
                    score: -90,
                    reason: '已经没有重投次数，不应继续尝试掷骰',
                };
            }
            if (chasePlan) {
                return {
                    score: 160 + chasePlan.ambitionScore * 0.35 - chasePlan.missingCount * 18,
                    reason: `已有可发动技能，但仍值得继续追 ${chasePlan.abilityId}`,
                };
            }
            if (plan && !plan.available) {
                return {
                    score: 115 - plan.missingCount * 18,
                    reason: `继续重投，追求更高价值的 ${plan.abilityId}`,
                };
            }
            return {
                score: -35,
                reason: '当前骰面已经够好，没有必要继续重投',
            };
        }

        if (action.kind === 'confirm-roll') {
            if (rerollBlockedByBindCp) {
                return {
                    score: 160,
                    reason: '紧缚且 CP 不足，无法继续重投，应直接确认当前骰面',
                };
            }
            if (pendingToggleCount > 0) {
                return {
                    score: -180,
                    reason: '锁骰方案还没对齐，先别提前确认骰面',
                };
            }
            if (chasePlan) {
                return {
                    score: -140 - chasePlan.ambitionScore * 0.25,
                    reason: `仍有机会追 ${chasePlan.abilityId}，不应满足低阶技能就提前确认`,
                };
            }
            if (plan?.available) {
                return {
                    score: 125 + Number((plan.strategicScore * 0.05).toFixed(3)),
                    reason: `当前已满足 ${plan.abilityId}，可以确认骰面进入结算`,
                };
            }
            if (state.core.rollCount >= state.core.rollLimit) {
                return {
                    score: 95,
                    reason: '已无重投次数，只能确认当前最优结果',
                };
            }
            return {
                score: -70,
                reason: '还没接近目标技能，应该继续优化骰面',
            };
        }

        return null;
    },
};

const passiveValueScorer: LocalAiActionScorer = {
    id: 'passive-value',
    score(context, action) {
        if (action.kind !== 'use-passive-ability') return null;

        const passiveId = typeof action.metadata?.passiveId === 'string'
            ? action.metadata.passiveId
            : null;
        const actionIndex = typeof action.metadata?.actionIndex === 'number'
            ? action.metadata.actionIndex
            : null;
        if (!passiveId || actionIndex === null) return null;

        const state = context.visibleState as DiceThroneState;
        const passive = getPlayerPassiveAbilities(state.core, context.playerId).find((item) => item.id === passiveId);
        const passiveAction = passive?.actions[actionIndex];
        if (!passiveAction) return null;

        if (passiveAction.type === 'rerollDie') {
            const phase = getContextPhase(context);
            const targetDieId = typeof action.metadata?.targetDieId === 'number'
                ? action.metadata.targetDieId
                : null;
            const die = targetDieId !== null
                ? getAiActiveDice(state, phase).find((item) => item.id === targetDieId)
                : null;
            if (!die) return null;
            const currentPlan = (phase === 'offensiveRoll' || phase === 'defensiveRoll')
                ? getBestStableDiceTargetPlan(state, context.playerId, phase)
                : null;
            if (currentPlan?.keepDieIds.includes(die.id)) {
                return {
                    score: currentPlan.available ? -220 : -140,
                    reason: currentPlan.available
                        ? `这颗骰子已经是当前成型 ${currentPlan.abilityId} 的关键符号，不该再重掷`
                        : `这颗骰子正是追当前技能线要保留的关键符号，不该只看点数就重掷`,
                };
            }
            const projection = (phase === 'offensiveRoll' || phase === 'defensiveRoll')
                ? evaluateExpectedRerollSelection(
                    state,
                    context.playerId,
                    phase,
                    false,
                    [die],
                )
                : null;
            const projectionScore = projection?.score ?? 0;

            return {
                score: projectionScore > 0
                    ? 70 + projectionScore
                    : -120 + projectionScore,
                reason: projection && projection.planDelta > 0
                    ? `这颗骰子重掷后更有机会把技能线推进到 ${projection.projectedPlanId ?? '更优结果'}`
                    : (projectionScore > 0
                        ? `这颗骰子重掷后有正期望收益，不该只按当前点数判断`
                        : `这颗骰子当前更适合保留，重掷期望并不划算`),
            };
        }

        if (passiveAction.type === 'drawCard') {
            const handSize = state.core.players[context.playerId]?.hand.length ?? 0;
            const responseWindowActive = !!state.sys.responseWindow?.current;
            return {
                score: Math.max(0, 120 - handSize * 20) + (responseWindowActive ? 15 : 0),
                reason: responseWindowActive ? '响应窗口内手牌偏少时优先补牌' : '手牌偏少时优先补牌',
            };
        }

        return null;
    },
};

const criticalResponseScorer: LocalAiActionScorer = {
    id: 'critical-response',
    score(context, action) {
        const state = context.visibleState as DiceThroneState;
        const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;
        const player = state.core.players[context.playerId];
        if (!pendingDamage || !player || pendingDamage.targetPlayerId !== context.playerId) {
            return null;
        }

        const incomingDamage = pendingDamage.currentDamage ?? 0;
        const hp = player.resources[RESOURCE_IDS.HP] ?? 0;
        const lethal = incomingDamage >= hp;
        const pressured = lethal || incomingDamage >= Math.max(4, Math.floor(hp / 2));

        if (action.kind === 'response-pass' || action.kind === 'skip-token-response') {
            if (!pressured) return null;
            return {
                score: lethal ? -220 : -95,
                reason: lethal ? '存在致命伤害，不能直接放弃响应' : '当前伤害压力较高，先检查可用响应',
            };
        }

        if (action.kind === 'token-response' || action.kind === 'response-play-card') {
            if (!pressured) return null;
            const defenseScore = scoreResponseDefenseAction(state, context.playerId, action) ?? 0;
            return {
                score: (lethal ? 185 : 110) + defenseScore,
                reason: lethal
                    ? '存在致命伤害，优先选择更能保命的响应'
                    : '当前伤害较高，优先选择减伤收益更高的响应',
            };
        }

        return null;
    },
};

const statusScorer: LocalAiActionScorer = {
    id: 'status-priority',
    score(context, action) {
        const state = context.visibleState as DiceThroneState;
        const player = state.core.players[context.playerId];
        if (!player) return null;

        if (action.kind === 'use-purify') {
            const statusId = typeof action.metadata?.statusId === 'string'
                ? action.metadata.statusId
                : null;
            const stacks = statusId
                ? (player.statusEffects[statusId] ?? 0) + (player.tokens[statusId] ?? 0)
                : 0;
            return {
                score: 90 + stacks * 20,
                reason: `优先净化减益 ${statusId ?? ''}`,
            };
        }

        if (action.kind === 'pay-remove-knockdown') {
            return {
                score: 110,
                reason: '优先解除击倒以恢复行动能力',
            };
        }

        return null;
    },
};

const phaseTempoScorer: LocalAiActionScorer = {
    id: 'phase-tempo',
    score(context, action) {
        const phase = getContextPhase(context);

        if (action.kind === 'advance-phase') {
            if (phase === 'main1' || phase === 'main2') {
                return {
                    score: -20,
                    reason: '主阶段仍优先尝试创造收益，而不是过早结束阶段',
                };
            }
            if (phase === 'discard') {
                return {
                    score: 40,
                    reason: '弃牌阶段优先推进，避免不必要弃牌',
                };
            }
            return 5;
        }

        if (action.kind === 'confirm-roll' && phase === 'offensiveRoll') {
            return {
                score: 20,
                reason: '无更优能力时尽快确认当前骰面',
            };
        }

        return null;
    },
};

const strategyProfileScorer = createProfileAwareActionScorer<DiceThroneStrategyTag>({
    id: 'strategy-profile-fit',
    allowedKinds: [
        'token-response',
        'response-play-card',
        'use-purify',
        'pay-remove-knockdown',
        'bonus-die-reroll',
        'use-passive-ability',
        'roll-dice',
        'toggle-die-lock',
        'select-ability',
        'confirm-roll',
        'play-upgrade-card',
        'play-card',
        'sell-card',
        'undo-sell-card',
        'discard-card',
        'interaction-remove-status',
        'interaction-transfer-status',
    ],
    getProfile(context) {
        const state = context.visibleState as DiceThroneState;
        return getDiceThroneStrategyProfile(state, context.playerId, getContextPhase(context));
    },
});

const DICETHRONE_PROJECTABLE_ACTION_KINDS = new Set<AiLegalAction['kind']>([
    'play-upgrade-card',
    'play-card',
    'sell-card',
    'advance-phase',
    'select-ability',
    'discard-card',
]);

const isDiceThroneProjectableActionKind = (kind: AiLegalAction['kind']): boolean => {
    return DICETHRONE_PROJECTABLE_ACTION_KINDS.has(kind);
};

const getEvaluatorScale = (context: AiDecisionContext): number => {
    switch (context.difficulty.evaluatorProfile) {
        case 'basic':
            return 0.45;
        case 'balanced':
            return 0.75;
        case 'strong':
            return 1;
        case 'expert':
            return 1.2;
        default:
            return 1;
    }
};

const getOpponentIds = (state: DiceThroneState, playerId: PlayerId): PlayerId[] => {
    return getOpponents(state.core, playerId);
};

const getPreferredOpponentTargetId = (
    state: DiceThroneState,
    playerId: PlayerId,
): PlayerId | null => {
    const opponents = getOpponentIds(state, playerId);
    if (opponents.length === 0) return null;

    return opponents.reduce((best, candidate) => {
        if (!best) return candidate;
        const bestHp = state.core.players[best]?.resources[RESOURCE_IDS.HP] ?? 999;
        const candidateHp = state.core.players[candidate]?.resources[RESOURCE_IDS.HP] ?? 999;
        return candidateHp < bestHp ? candidate : best;
    }, opponents[0] ?? null);
};

const getCardDrawCount = (card: AbilityCard): number => {
    return card.effects?.reduce((sum, effect) => {
        if (effect.action?.type !== 'drawCard') return sum;
        return sum + (effect.action.drawCount ?? effect.action.value ?? 0);
    }, 0) ?? 0;
};

const getDrawStrategicValue = (
    state: DiceThroneState,
    playerId: PlayerId,
    drawCount: number,
): number => {
    if (drawCount <= 0) return 0;
    const handSize = state.core.players[playerId]?.hand.length ?? 0;
    return Math.max(0, drawCount * 18 - handSize * 4);
};

const getCpStrategicValue = (
    state: DiceThroneState,
    playerId: PlayerId,
    amount: number,
): number => {
    if (amount <= 0) return 0;
    const cp = state.core.players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const shortageBonus = cp <= 1 ? 6 : (cp <= 3 ? 2 : 0);
    return amount * 14 + shortageBonus;
};

const getHealStrategicValue = (
    state: DiceThroneState,
    playerId: PlayerId,
    amount: number,
): number => {
    if (amount <= 0) return 0;
    const hp = state.core.players[playerId]?.resources[RESOURCE_IDS.HP] ?? 50;
    const missingHp = Math.max(0, 50 - hp);
    return Math.min(amount, missingHp) * 22 + (hp <= 10 ? amount * 6 : 0);
};

const getShieldStrategicValue = (
    state: DiceThroneState,
    playerId: PlayerId,
    shieldValue: number,
): number => {
    if (shieldValue <= 0) return 0;
    const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;
    if (pendingDamage?.targetPlayerId === playerId) {
        const prevented = Math.min(shieldValue, pendingDamage.currentDamage ?? 0);
        return prevented * 60;
    }
    return shieldValue * 18;
};

const resolveSupportEffectTargetId = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    effectId: string,
    explicitTarget: 'self' | 'opponent' | undefined,
): PlayerId | null => {
    if (explicitTarget === 'self') return actingPlayerId;
    if (explicitTarget === 'opponent') return getPreferredOpponentTargetId(state, actingPlayerId);

    const category = getEffectCategory(state, effectId);
    if (category === 'debuff') {
        return getPreferredOpponentTargetId(state, actingPlayerId);
    }
    return actingPlayerId;
};

const estimateChoiceOptionStrategicValue = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    option: { statusId?: string; tokenId?: string; value?: number },
): number => {
    const amount = typeof option.value === 'number' ? option.value : 0;
    if (option.statusId) {
        const targetPlayerId = resolveSupportEffectTargetId(state, actingPlayerId, option.statusId, undefined);
        return targetPlayerId ? getGrantedEffectValue(state, actingPlayerId, targetPlayerId, option.statusId, amount) : 0;
    }
    if (option.tokenId) {
        const targetPlayerId = resolveSupportEffectTargetId(state, actingPlayerId, option.tokenId, undefined);
        return targetPlayerId ? getGrantedEffectValue(state, actingPlayerId, targetPlayerId, option.tokenId, amount) : 0;
    }
    return 0;
};

const estimateRollOutcomeStrategicValue = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    effect: RollDieConditionalEffect | RollDieDefaultEffect,
): number => {
    const conditionalEffect = effect as Partial<RollDieConditionalEffect>;
    let score = 0;
    score += (conditionalEffect.bonusDamage ?? 0) * 24;
    score += getHealStrategicValue(state, actingPlayerId, effect.heal ?? 0);
    score += getCpStrategicValue(state, actingPlayerId, effect.cp ?? 0);
    score += getDrawStrategicValue(state, actingPlayerId, effect.drawCard ?? 0);
    score += getShieldStrategicValue(state, actingPlayerId, conditionalEffect.grantDamageShield?.value ?? 0);

    if (effect.grantStatus) {
        const targetPlayerId = resolveSupportEffectTargetId(
            state,
            actingPlayerId,
            effect.grantStatus.statusId,
            effect.grantStatus.target,
        );
        if (targetPlayerId) {
            score += getGrantedEffectValue(
                state,
                actingPlayerId,
                targetPlayerId,
                effect.grantStatus.statusId,
                effect.grantStatus.value,
            );
        }
    }

    if (effect.grantToken) {
        const targetPlayerId = resolveSupportEffectTargetId(
            state,
            actingPlayerId,
            effect.grantToken.tokenId,
            effect.grantToken.target,
        );
        if (targetPlayerId) {
            score += getGrantedEffectValue(
                state,
                actingPlayerId,
                targetPlayerId,
                effect.grantToken.tokenId,
                effect.grantToken.value,
            );
        }
    }

    for (const grantToken of conditionalEffect.grantTokens ?? []) {
        const targetPlayerId = resolveSupportEffectTargetId(
            state,
            actingPlayerId,
            grantToken.tokenId,
            grantToken.target,
        );
        if (!targetPlayerId) continue;
        score += getGrantedEffectValue(
            state,
            actingPlayerId,
            targetPlayerId,
            grantToken.tokenId,
            grantToken.value,
        );
    }

    if (conditionalEffect.triggerChoice?.options?.length) {
        const bestChoice = conditionalEffect.triggerChoice.options.reduce((best, option) => {
            return Math.max(best, estimateChoiceOptionStrategicValue(state, actingPlayerId, option));
        }, 0);
        score += bestChoice;
    }

    return score;
};

const estimateCustomActionStrategicValue = (args: {
    state: DiceThroneState;
    playerId: PlayerId;
    action: EffectAction;
}): number => {
    const customActionId = args.action.customActionId;
    if (!customActionId) return 0;

    const meta = getCustomActionMeta(customActionId);
    if (!meta) return 0;

    let score = 0;
    const estimatedDamage = meta.estimateDamage?.(args.state.core as unknown as Record<string, unknown>, args.playerId) ?? 0;
    if (estimatedDamage > 0) {
        score += estimatedDamage * 24;
    } else if (meta.categories.includes('damage')) {
        score += 45;
    }

    if (meta.categories.includes('resource')) {
        const cpMatch = customActionId.match(/(?:grant|gain)-cp(?:-(\d+))?$/);
        const cpAmount = cpMatch ? Number(cpMatch[1] ?? 1) : 0;
        score += cpAmount > 0 ? getCpStrategicValue(args.state, args.playerId, cpAmount) : 24;
    }
    if (meta.categories.includes('card')) {
        score += 20;
    }
    if (meta.categories.includes('status')) {
        score += 22;
    }
    if (meta.categories.includes('defense')) {
        score += (args.state.core.pendingDamage?.targetPlayerId === args.playerId ? 34 : 18);
    }
    if (meta.categories.includes('token')) {
        score += 18;
    }
    if (meta.categories.includes('choice')) {
        score += 8;
    }
    if (meta.categories.includes('other')) {
        score += 6;
    }

    return score;
};

const estimateEffectActionStrategicValue = (args: {
    state: DiceThroneState;
    playerId: PlayerId;
    action: EffectAction;
}): number => {
    const { state, playerId, action } = args;
    const preferredOpponentId = getPreferredOpponentTargetId(state, playerId);

    switch (action.type) {
        case 'damage': {
            const amount = Number(action.value ?? 0);
            if (amount <= 0) return 0;
            const multiplier = action.target === 'allOpponents'
                ? Math.max(1, getOpponentIds(state, playerId).length)
                : 1;
            return amount * 24 * multiplier + (action.unblockable ? 8 : 0);
        }
        case 'heal':
            return getHealStrategicValue(state, playerId, Number(action.value ?? 0));
        case 'drawCard':
            return getDrawStrategicValue(state, playerId, action.drawCount ?? action.value ?? 0);
        case 'grantDamageShield':
            return getShieldStrategicValue(state, playerId, Number(action.shieldValue ?? action.value ?? 0));
        case 'grantStatus': {
            if (!action.statusId) return 0;
            const targetPlayerId = resolveSupportEffectTargetId(state, playerId, action.statusId, action.target === 'self' || action.target === 'opponent' ? action.target : undefined);
            return targetPlayerId
                ? getGrantedEffectValue(state, playerId, targetPlayerId, action.statusId, Number(action.value ?? 1))
                : 0;
        }
        case 'grantToken': {
            if (!action.tokenId) return 0;
            const targetPlayerId = resolveSupportEffectTargetId(state, playerId, action.tokenId, action.target === 'self' || action.target === 'opponent' ? action.target : undefined);
            return targetPlayerId
                ? getGrantedEffectValue(state, playerId, targetPlayerId, action.tokenId, Number(action.value ?? 1))
                : 0;
        }
        case 'removeStatus': {
            if (!action.statusId) return 0;
            const targetPlayerId = action.target === 'opponent'
                ? preferredOpponentId
                : playerId;
            return targetPlayerId
                ? scoreRemoveSingleStatusTarget(state, playerId, targetPlayerId, action.statusId)
                : 0;
        }
        case 'removeAllStatus': {
            const targetPlayerId = action.target === 'opponent'
                ? preferredOpponentId
                : playerId;
            return targetPlayerId ? scoreRemoveAllStatusesTarget(state, playerId, targetPlayerId) : 0;
        }
        case 'transferStatus':
            return action.statusId && preferredOpponentId
                ? scoreTransferStatusTarget(state, playerId, playerId, preferredOpponentId, action.statusId)
                : 28;
        case 'rollDie': {
            const diceCount = Math.max(1, Number(action.diceCount ?? 1));
            const conditionalEffects = action.conditionalEffects ?? [];
            const conditionalTotal = conditionalEffects.reduce((sum, effect) => {
                return sum + estimateRollOutcomeStrategicValue(state, playerId, effect);
            }, 0);
            const defaultValue = action.defaultEffect
                ? estimateRollOutcomeStrategicValue(state, playerId, action.defaultEffect)
                : 0;
            const unresolvedFaces = Math.max(0, 6 - conditionalEffects.length);
            const expectedSingleRollValue = conditionalEffects.length > 0 || action.defaultEffect
                ? (conditionalTotal + unresolvedFaces * defaultValue) / 6
                : 0;
            const sumDamageValue = action.damageMode === 'sumValues'
                ? diceCount * 3.5 * 18
                : 0;
            return Number((expectedSingleRollValue * diceCount + sumDamageValue).toFixed(3));
        }
        case 'custom':
            return estimateCustomActionStrategicValue({ state, playerId, action });
        default:
            return 0;
    }
};

const estimateEffectsStrategicValue = (
    state: DiceThroneState,
    playerId: PlayerId,
    effects: AbilityEffect[] | undefined,
): number => {
    return effects?.reduce((sum, effect) => {
        if (!effect.action) return sum;
        return sum + estimateEffectActionStrategicValue({
            state,
            playerId,
            action: effect.action,
        });
    }, 0) ?? 0;
};

const evaluateBonusDiceSettlementValue = (
    state: DiceThroneState,
    settlement: PendingBonusDiceSettlement,
    diceOverride?: PendingBonusDiceSettlement['dice'],
): number => {
    const dice = diceOverride ?? getPendingBonusSettlementDice(settlement);
    const total = dice.reduce((sum, die) => sum + die.value, 0);
    const thresholdTriggered = settlement.threshold ? total >= settlement.threshold : false;

    const convertedDamage = (() => {
        if (settlement.resolutionMode === 'none') return 0;
        if (settlement.resolutionMode === 'attackBonus') {
            return settlement.attackBonusScale === 'halfUp'
                ? Math.ceil(total / 2)
                : total;
        }
        return total;
    })();

    let score = convertedDamage * 24;
    score += (settlement.postSettleBonusDamageAdds ?? []).reduce((sum, item) => sum + item.amount * 24, 0);

    if (thresholdTriggered && settlement.thresholdEffect === 'knockdown') {
        score += getGrantedEffectValue(
            state,
            settlement.attackerId,
            settlement.targetId,
            STATUS_IDS.KNOCKDOWN,
            1,
        );
    }

    return Number(score.toFixed(3));
};

const evaluateExpectedBonusDieRerollValue = (
    state: DiceThroneState,
    settlement: PendingBonusDiceSettlement,
    dieIndex: number,
): number | null => {
    const settlementDice = getPendingBonusSettlementDice(settlement);
    const die = settlementDice.find((item) => item.index === dieIndex);
    if (!die) return null;

    const outcomes = [1, 2, 3, 4, 5, 6].map((value) => {
        const projectedDice = settlementDice.map((item) => (
            item.index === dieIndex ? { ...item, value } : item
        ));
        return evaluateBonusDiceSettlementValue(state, settlement, projectedDice);
    });

    return Number((outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length).toFixed(3));
};

const estimateCardStrategicValue = (
    state: DiceThroneState,
    playerId: PlayerId,
    card: AbilityCard,
    actionKind: AiLegalAction['kind'],
): number => {
    if (actionKind === 'play-upgrade-card') {
        return 90 + card.cpCost * 22;
    }

    if (actionKind === 'play-card' || actionKind === 'response-play-card') {
        return 35
            + card.cpCost * 10
            + (card.isAttackModifier ? 22 : 0)
            + estimateEffectsStrategicValue(state, playerId, card.effects);
    }

    if (actionKind === 'sell-card') {
        return 10 + card.cpCost * 8 + estimateEffectsStrategicValue(state, playerId, card.effects) * 0.55;
    }

    if (actionKind === 'discard-card') {
        return card.cpCost * 18 + (card.type === 'action' ? 8 : 0) + estimateEffectsStrategicValue(state, playerId, card.effects) * 0.7;
    }

    return 0;
};

type DiceProjectionSummary = {
    score: number;
    rawDelta: number;
    planDelta: number;
    currentPlanId: string | null;
    projectedPlanId: string | null;
};

const buildProjectedDice = (
    dice: DiceThroneCore['dice'],
    updates: Array<{ dieId: number; newValue: number }>,
): DiceThroneCore['dice'] => {
    if (updates.length === 0) return dice;

    const updateMap = new Map<number, number>();
    for (const update of updates) {
        updateMap.set(update.dieId, update.newValue);
    }

    return dice.map((die) => {
        const nextValue = updateMap.get(die.id);
        if (nextValue === undefined || nextValue === die.value) {
            return die;
        }
        const face = getDieFaceByValue(die.definitionId, nextValue);
        return {
            ...die,
            value: nextValue,
            symbol: face?.symbols[0] ?? die.symbol,
        };
    });
};

const getDiceProjectionRawDelta = (
    currentDice: DiceThroneCore['dice'],
    projectedDice: DiceThroneCore['dice'],
    targetOpponentDice: boolean,
): number => {
    const currentById = new Map(currentDice.map((die) => [die.id, die]));
    return projectedDice.reduce((sum, die) => {
        const current = currentById.get(die.id);
        if (!current) return sum;
        const delta = die.value - current.value;
        return sum + (targetOpponentDice ? -delta : delta);
    }, 0);
};

const getDicePlanAnchorPlayerId = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    targetOpponentDice: boolean,
): PlayerId => {
    return targetOpponentDice ? getRollerId(state.core, phase) : playerId;
};

const evaluateDiceProjection = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    targetOpponentDice: boolean,
    projectedDice: DiceThroneCore['dice'],
): DiceProjectionSummary => {
    const currentDice = getAiActiveDice(state, phase);
    const anchorPlayerId = getDicePlanAnchorPlayerId(state, playerId, phase, targetOpponentDice);
    const useConfirmedOpponentThreat = targetOpponentDice
        && state.core.rollConfirmed
        && state.sys.responseWindow?.current?.windowType === 'afterRollConfirmed';
    const currentPlan = useConfirmedOpponentThreat
        ? getBestAvailableDiceTargetPlan(state, anchorPlayerId, phase)
        : getBestDiceTargetPlan(state, anchorPlayerId, phase);
    const projectedPlan = useConfirmedOpponentThreat
        ? getBestAvailableDiceTargetPlan(state, anchorPlayerId, phase, projectedDice)
        : getBestDiceTargetPlan(state, anchorPlayerId, phase, projectedDice);
    const currentPlanScore = currentPlan ? scoreDiceTargetPlan(state, phase, currentPlan) : 0;
    const projectedPlanScore = projectedPlan ? scoreDiceTargetPlan(state, phase, projectedPlan) : 0;
    const rawDelta = getDiceProjectionRawDelta(currentDice, projectedDice, targetOpponentDice);
    const planDelta = targetOpponentDice
        ? currentPlanScore - projectedPlanScore
        : projectedPlanScore - currentPlanScore;

    return {
        score: Number((rawDelta * 28 + planDelta * 2.4).toFixed(3)),
        rawDelta,
        planDelta,
        currentPlanId: currentPlan?.abilityId ?? null,
        projectedPlanId: projectedPlan?.abilityId ?? null,
    };
};

const evaluateBestProjectedDice = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    targetOpponentDice: boolean,
    projectedDiceList: DiceThroneCore['dice'][],
): DiceProjectionSummary | null => {
    let best: DiceProjectionSummary | null = null;
    for (const projectedDice of projectedDiceList) {
        const candidate = evaluateDiceProjection(state, playerId, phase, targetOpponentDice, projectedDice);
        if (!best || candidate.score > best.score) {
            best = candidate;
        }
    }
    return best;
};

const enumerateModifyProjectedDice = (
    dice: DiceThroneCore['dice'],
    customActionId: string,
): DiceThroneCore['dice'][] => {
    if (dice.length === 0) return [];

    switch (customActionId) {
        case 'modify-die-to-6':
            return dice
                .filter((die) => die.value !== 6)
                .map((die) => buildProjectedDice(dice, [{ dieId: die.id, newValue: 6 }]));
        case 'modify-die-copy':
            return enumerateOrderedSelections(dice, 2)
                .filter(([sourceDie, targetDie]) => !!sourceDie && !!targetDie && sourceDie.value !== targetDie.value)
                .map(([sourceDie, targetDie]) => {
                    return buildProjectedDice(dice, [{ dieId: targetDie.id, newValue: sourceDie.value }]);
                });
        case 'modify-die-any-1':
            return enumerateArrayCombinations(dice, 1, 1).flatMap((selection) => {
                return enumeratePerItemValueAssignments(selection, (die) =>
                    [1, 2, 3, 4, 5, 6].filter((value) => value !== die.value))
                    .map((newValues) => buildProjectedDice(dice, [{
                        dieId: selection[0].id,
                        newValue: newValues[0],
                    }]));
            });
        case 'modify-die-any-2':
            return enumerateArrayCombinations(dice, 1, Math.min(2, dice.length)).flatMap((selection) => {
                return enumeratePerItemValueAssignments(selection, (die) =>
                    [1, 2, 3, 4, 5, 6].filter((value) => value !== die.value))
                    .map((newValues) => {
                        return buildProjectedDice(dice, selection.map((die, index) => ({
                            dieId: die.id,
                            newValue: newValues[index],
                        })));
                    });
            });
        case 'modify-die-adjust-1':
            return enumerateArrayCombinations(dice, 1, 1).flatMap((selection) => {
                return enumeratePerItemValueAssignments(selection, (die) =>
                    [die.value - 1, die.value + 1].filter((value) => value >= 1 && value <= 6))
                    .map((newValues) => buildProjectedDice(dice, [{
                        dieId: selection[0].id,
                        newValue: newValues[0],
                    }]));
            });
        default:
            return [];
    }
};

const enumerateRerollSelectionsForAction = (
    dice: DiceThroneCore['dice'],
    customActionId: string,
): DiceThroneCore['dice'][][] => {
    if (dice.length === 0) return [];

    switch (customActionId) {
        case 'reroll-opponent-die-1':
            return enumerateArrayCombinations(dice, 1, 1);
        case 'reroll-die-2':
            return enumerateArrayCombinations(dice, 1, Math.min(2, dice.length));
        case 'reroll-die-5':
            return enumerateArrayCombinations(dice, 1, Math.min(5, dice.length));
        default:
            return [];
    }
};

const evaluateExpectedRerollSelection = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    targetOpponentDice: boolean,
    selectedDice: DiceThroneCore['dice'],
): DiceProjectionSummary | null => {
    if (selectedDice.length === 0) return null;
    const outcomeCount = 6 ** selectedDice.length;
    if (outcomeCount > 216) {
        return null;
    }

    const baseDice = getAiActiveDice(state, phase);
    const totals = {
        score: 0,
        rawDelta: 0,
        planDelta: 0,
    };
    const projectedPlanScores = new Map<string, number>();
    const currentPlanScores = new Map<string, number>();

    const outcomes = enumeratePerItemValueAssignments(selectedDice, () => [1, 2, 3, 4, 5, 6]);
    for (const outcomeValues of outcomes) {
        const projectedDice = buildProjectedDice(baseDice, selectedDice.map((die, index) => ({
            dieId: die.id,
            newValue: outcomeValues[index],
        })));
        const summary = evaluateDiceProjection(state, playerId, phase, targetOpponentDice, projectedDice);
        totals.score += summary.score;
        totals.rawDelta += summary.rawDelta;
        totals.planDelta += summary.planDelta;
        if (summary.projectedPlanId) {
            projectedPlanScores.set(summary.projectedPlanId, (projectedPlanScores.get(summary.projectedPlanId) ?? 0) + 1);
        }
        if (summary.currentPlanId) {
            currentPlanScores.set(summary.currentPlanId, (currentPlanScores.get(summary.currentPlanId) ?? 0) + 1);
        }
    }

    const pickMostCommonPlan = (plans: Map<string, number>): string | null => {
        let bestPlanId: string | null = null;
        let bestCount = -1;
        for (const [planId, count] of plans.entries()) {
            if (count > bestCount) {
                bestPlanId = planId;
                bestCount = count;
            }
        }
        return bestPlanId;
    };

    return {
        score: Number((totals.score / outcomes.length).toFixed(3)),
        rawDelta: Number((totals.rawDelta / outcomes.length).toFixed(3)),
        planDelta: Number((totals.planDelta / outcomes.length).toFixed(3)),
        currentPlanId: pickMostCommonPlan(currentPlanScores),
        projectedPlanId: pickMostCommonPlan(projectedPlanScores),
    };
};

const evaluateBestRerollProjection = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
    targetOpponentDice: boolean,
    customActionId: string,
): DiceProjectionSummary | null => {
    const currentDice = getAiActiveDice(state, phase);
    const selections = enumerateRerollSelectionsForAction(currentDice, customActionId);
    let best: DiceProjectionSummary | null = null;

    for (const selection of selections) {
        const candidate = evaluateExpectedRerollSelection(state, playerId, phase, targetOpponentDice, selection);
        if (!candidate) continue;
        if (!best || candidate.score > best.score) {
            best = candidate;
        }
    }

    return best;
};

const estimateDiceModificationDelta = (
    values: number[],
    customActionId: string,
    targetOpponentDice: boolean,
): number => {
    if (values.length === 0) return 0;
    const asc = [...values].sort((a, b) => a - b);
    const desc = [...values].sort((a, b) => b - a);

    if (customActionId === 'modify-die-to-6') {
        return Math.max(0, 6 - asc[0]);
    }
    if (customActionId === 'modify-die-copy') {
        return Math.max(0, desc[0] - asc[0]);
    }
    if (customActionId === 'modify-die-any-1') {
        return targetOpponentDice
            ? Math.max(0, desc[0] - 1)
            : Math.max(0, 6 - asc[0]);
    }
    if (customActionId === 'modify-die-any-2') {
        if (targetOpponentDice) {
            return desc.slice(0, 2).reduce((sum, value) => sum + Math.max(0, value - 1), 0);
        }
        return asc.slice(0, 2).reduce((sum, value) => sum + Math.max(0, 6 - value), 0);
    }
    if (customActionId === 'modify-die-adjust-1') {
        return targetOpponentDice
            ? (desc[0] > 1 ? 1 : 0)
            : (asc[0] < 6 ? 1 : 0);
    }

    return 0;
};

const estimateDiceRerollDelta = (
    values: number[],
    customActionId: string,
    targetOpponentDice: boolean,
): number => {
    if (values.length === 0) return 0;

    const rerollCount = customActionId === 'reroll-opponent-die-1'
        ? 1
        : (customActionId === 'reroll-die-2' ? 2 : 5);
    const orderedValues = [...values].sort((a, b) => targetOpponentDice ? b - a : a - b);
    const selectedValues = orderedValues.slice(0, Math.min(rerollCount, orderedValues.length));
    const expectedTarget = 3.5;

    return selectedValues.reduce((sum, value) => {
        const improvement = targetOpponentDice
            ? value - expectedTarget
            : expectedTarget - value;
        return sum + Math.max(0, improvement);
    }, 0);
};

const mergeDiceInterferenceResponseGate = (
    baseScore: number,
    baseReason: string,
    gate: DiceInterferenceResponseGate | null,
): { score: number; reason: string } => {
    if (!gate) {
        return {
            score: Math.round(baseScore),
            reason: baseReason,
        };
    }

    if (!gate.shouldSpend) {
        return {
            score: Math.min(Math.round(baseScore + gate.score), -240),
            reason: `${gate.reason}；${baseReason}`,
        };
    }

    return {
        score: Math.round(baseScore + gate.score),
        reason: `${gate.reason}；${baseReason}`,
    };
};

const estimateDiceInterferenceCardValue = (
    state: DiceThroneState,
    playerId: PlayerId,
    card: AbilityCard,
    phase: TurnPhase,
): { score: number; reason: string } | null => {
    const activeDice = getAiActiveDice(state, phase);
    const diceValues = activeDice.map((die) => die.value);
    if (diceValues.length === 0) return null;

    for (const effect of card.effects ?? []) {
        if (effect.action?.type !== 'custom' || !effect.action.customActionId) {
            continue;
        }

        const targetOpponentDice = effect.action.target === 'opponent'
            || (effect.action.target === 'select' && playerId !== getRollerId(state.core, phase));
        const modifyProjection = evaluateBestProjectedDice(
            state,
            playerId,
            phase,
            targetOpponentDice,
            enumerateModifyProjectedDice(activeDice, effect.action.customActionId),
        );
        const rerollProjection = evaluateBestRerollProjection(
            state,
            playerId,
            phase,
            targetOpponentDice,
            effect.action.customActionId,
        );
        const delta = estimateDiceModificationDelta(diceValues, effect.action.customActionId, targetOpponentDice);
        const rerollDelta = estimateDiceRerollDelta(diceValues, effect.action.customActionId, targetOpponentDice);

        switch (effect.action.customActionId) {
            case 'modify-die-to-6':
            case 'modify-die-copy':
            case 'modify-die-any-1':
            case 'modify-die-any-2':
            case 'modify-die-adjust-1':
                if ((modifyProjection?.score ?? Number.NEGATIVE_INFINITY) <= 0 && delta <= 0) {
                    return {
                        score: -260,
                        reason: '当前没有可产生实际变化的改骰收益，不该白白浪费这张牌',
                    };
                }
                return mergeDiceInterferenceResponseGate(
                    Math.max(delta * 32 + (targetOpponentDice ? 24 : 18), modifyProjection?.score ?? 0),
                    modifyProjection && modifyProjection.planDelta > 0
                        ? (targetOpponentDice
                            ? `这张改骰牌能把对手从 ${modifyProjection.currentPlanId ?? '当前技能线'} 拉开`
                            : `这张改骰牌能把己方骰面推向 ${modifyProjection.projectedPlanId ?? '更优技能线'}`)
                        : (targetOpponentDice
                            ? `这张改骰牌当前能实际压低对手骰面 ${delta} 点`
                            : `这张改骰牌当前能实际提升己方骰面 ${delta} 点`),
                    assessDiceThroneDiceInterferenceResponseGate({
                        state,
                        responderId: playerId,
                        phase,
                        targetOpponentDice,
                        projection: modifyProjection,
                        fallbackDelta: delta,
                        cardCpCost: card.cpCost,
                    }),
                );
            case 'reroll-opponent-die-1':
            case 'reroll-die-2':
            case 'reroll-die-5':
                if ((rerollProjection?.score ?? Number.NEGATIVE_INFINITY) <= 0 && rerollDelta <= 0) {
                    return {
                        score: -220,
                        reason: '当前重掷预期没有正收益，不该为了出牌而出牌',
                    };
                }
                return mergeDiceInterferenceResponseGate(
                    Math.max(rerollDelta * 28 + (targetOpponentDice ? 20 : 12), rerollProjection?.score ?? 0),
                    rerollProjection && rerollProjection.planDelta > 0
                        ? (targetOpponentDice
                            ? `这张重掷牌有机会打断对手的 ${rerollProjection.currentPlanId ?? '当前技能线'}`
                            : `这张重掷牌更有机会把己方骰面转进 ${rerollProjection.projectedPlanId ?? '更优技能线'}`)
                        : (targetOpponentDice
                            ? `这张重掷牌当前能实际逼对手重掷高点骰，预期收益 ${rerollDelta.toFixed(1)}`
                            : `这张重掷牌当前能实际优化己方低点骰，预期收益 ${rerollDelta.toFixed(1)}`),
                    assessDiceThroneDiceInterferenceResponseGate({
                        state,
                        responderId: playerId,
                        phase,
                        targetOpponentDice,
                        projection: rerollProjection,
                        fallbackDelta: rerollDelta,
                        cardCpCost: card.cpCost,
                    }),
                );
            default:
                break;
        }
    }

    return null;
};

const estimateBestUnlockedCardValue = (
    state: DiceThroneState,
    playerId: PlayerId,
    soldCardId: string,
): number => {
    const player = state.core.players[playerId];
    const soldCard = findPlayerHandCard(state, playerId, soldCardId);
    if (!player || !soldCard) return 0;

    const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
    const cpAfterSell = currentCp + 1;
    let best = 0;

    for (const card of player.hand) {
        if (card.id === soldCardId) continue;
        if (currentCp >= card.cpCost || cpAfterSell < card.cpCost) continue;

        best = Math.max(
            best,
            estimateCardStrategicValue(
                state,
                playerId,
                card,
                card.type === 'upgrade' ? 'play-upgrade-card' : 'play-card',
            ),
        );
    }

    return best;
};

const evaluateDiceThronePosition = (
    state: DiceThroneState,
    playerId: PlayerId,
): number => {
    return evaluateDiceThroneBoardState(state, playerId).total;
};

const projectDiceThroneAction = (args: {
    context: AiDecisionContext;
    action: AiLegalAction;
}): { score: number; reason: string; metadata?: Record<string, unknown> } | null => {
    if (!isDiceThroneProjectableActionKind(args.action.kind)) {
        return null;
    }

    const state = args.context.visibleState as DiceThroneState;
    const player = state.core.players[args.context.playerId];
    if (!player) return null;

    const scale = getEvaluatorScale(args.context);
    const phase = getContextPhase(args.context);

    if (args.action.kind === 'play-upgrade-card' || args.action.kind === 'play-card') {
        const cardId = typeof args.action.metadata?.cardId === 'string'
            ? args.action.metadata.cardId
            : null;
        const card = cardId ? findPlayerHandCard(state, args.context.playerId, cardId) : null;
        if (!card) return null;

        const projectedPosition = evaluateDiceThronePosition(state, args.context.playerId);
        const strategicValue = estimateCardStrategicValue(state, args.context.playerId, card, args.action.kind);
        const tacticalDiceValue = args.action.kind === 'play-card'
            ? estimateDiceInterferenceCardValue(state, args.context.playerId, card, phase)?.score ?? 0
            : 0;
        const phaseBonus = phase === 'main1' ? 12 : 0;
        return {
            score: Number(((strategicValue * 0.24 + tacticalDiceValue * 0.7 + projectedPosition * 0.04 + phaseBonus) * scale).toFixed(3)),
            reason: args.action.kind === 'play-upgrade-card'
                ? '高难度会额外考虑长期成长与后续回合收益'
                : '高难度会额外考虑当前出牌后的即时收益与持续收益',
            metadata: {
                projectedPosition,
                strategicValue,
                tacticalDiceValue,
            },
        };
    }

    if (args.action.kind === 'sell-card') {
        const cardId = typeof args.action.metadata?.cardId === 'string'
            ? args.action.metadata.cardId
            : null;
        if (!cardId) return null;

        const unlockedValue = estimateBestUnlockedCardValue(state, args.context.playerId, cardId);
        const score = unlockedValue > 0
            ? Number((unlockedValue * 0.45 * scale).toFixed(3))
            : Number((-12 * scale).toFixed(3));

        return {
            score,
            reason: unlockedValue > 0
                ? '卖牌后若能解锁更高价值动作，高难度会更愿意先转资源'
                : '卖牌后若不能立刻换来更优动作，高难度会压低优先级',
            metadata: {
                unlockedValue,
            },
        };
    }

    if (args.action.kind === 'discard-card') {
        const cardId = typeof args.action.metadata?.cardId === 'string'
            ? args.action.metadata.cardId
            : null;
        if (!cardId) return null;

        const handSize = player.hand.length;
        const handLimit = 6; // DiceThrone HAND_LIMIT
        const needsDiscard = handSize > handLimit;
        const card = findPlayerHandCard(state, args.context.playerId, cardId);
        if (!card) return null;

        // 弃牌后的局势投影：弃牌本身是负收益（失去手牌资源），
        // 只有在手牌超限时才是必须动作。
        const cardValue = estimateCardStrategicValue(state, args.context.playerId, card, 'play-card');
        const penalty = needsDiscard
            ? Number((-cardValue * 0.15 * scale).toFixed(3))
            : Number((-cardValue * 0.6 * scale).toFixed(3));

        return {
            score: penalty,
            reason: needsDiscard
                ? '手牌超限必须弃牌，高难度会尽量少损失价值'
                : '手牌未超限时弃牌是纯损失，高难度会极力避免',
            metadata: {
                cardValue,
                needsDiscard,
                handSize,
            },
        };
    }

    if (args.action.kind === 'advance-phase') {
        const bestSellUnlock = args.context.legalActions
            .filter((candidate) => candidate.kind === 'sell-card')
            .reduce((best, candidate) => {
                const cardId = typeof candidate.metadata?.cardId === 'string' ? candidate.metadata.cardId : null;
                if (!cardId) return best;
                return Math.max(best, estimateBestUnlockedCardValue(state, args.context.playerId, cardId));
            }, 0);
        const proactiveActionCount = args.context.legalActions.filter((candidate) => {
            return candidate.actionId !== args.action.actionId
                && candidate.kind !== 'response-pass'
                && candidate.kind !== 'discard-card'
                && candidate.kind !== 'undo-sell-card';
        }).length;

        const score = proactiveActionCount > 0
            ? Number(((-20 - bestSellUnlock * 0.35) * scale).toFixed(3))
            : Number((18 * scale).toFixed(3));

        return {
            score,
            reason: proactiveActionCount > 0
                ? '高难度会在结束阶段前多看一眼是否还能转出更好的线'
                : '当前已经接近无事可做，可以结束阶段',
            metadata: {
                proactiveActionCount,
                bestSellUnlock,
            },
        };
    }

    if (args.action.kind === 'select-ability') {
        const abilityId = typeof args.action.metadata?.abilityId === 'string'
            ? args.action.metadata.abilityId
            : null;
        if (!abilityId) return null;
        const chasePlan = getHigherAmbitionChasePlan(state, args.context.playerId, phase, abilityId);
        if (chasePlan) {
            return {
                score: Number((-95 - chasePlan.ambitionScore * 0.35).toFixed(3)),
                reason: `当前可发动技能不是最优路线，仍有机会追 ${chasePlan.abilityId}`,
                metadata: {
                    chasePlanId: chasePlan.abilityId,
                    missingCount: chasePlan.missingCount,
                    ambitionScore: chasePlan.ambitionScore,
                },
            };
        }
        const opponentIds = getOpponentIds(state, args.context.playerId);
        const lowestOpponentHp = opponentIds.reduce((best, opponentId) => {
            const hp = state.core.players[opponentId]?.resources[RESOURCE_IDS.HP] ?? 999;
            return Math.min(best, hp);
        }, 999);
        const baseDamage = getPlayerAbilityBaseDamage(state.core, args.context.playerId, abilityId);
        if (baseDamage <= 0) return null;

        return {
            score: lowestOpponentHp <= baseDamage
                ? Number((55 * scale).toFixed(3))
                : Number((baseDamage * 8 * scale).toFixed(3)),
            reason: lowestOpponentHp <= baseDamage
                ? '高难度会放大接近斩杀的技能价值'
                : '高难度会额外看重技能造成的确定性收益',
            metadata: {
                baseDamage,
                lowestOpponentHp,
            },
        };
    }

    return null;
};

const diceThroneLocalPolicyScorers: LocalAiActionScorer[] = [
    diceThroneKindScorer,
    setupCharacterProfileScorer,
    setupCharacterRandomScorer,
    abilityValueScorer,
    cardValueScorer,
    interactionValueScorer,
    interactionHintScorer,
    bonusDieScorer,
    dicePlanScorer,
    passiveValueScorer,
    criticalResponseScorer,
    statusScorer,
    phaseTempoScorer,
    strategyProfileScorer,
];

const defaultLocalPolicy = createLookaheadLocalAiPolicy({
    id: 'baseline',
    scorers: diceThroneLocalPolicyScorers,
    relativeUtility: {
        enabled: true,
        weight: 10,
        minimumUtility: 0.08,
    },
    rankProjectionCandidate({ context, action }) {
        if (!isDiceThroneProjectableActionKind(action.kind)) {
            return 0;
        }
        const state = context.visibleState as DiceThroneState;
        const profile = getDiceThroneStrategyProfile(state, context.playerId, getContextPhase(context));
        const fit = scoreActionAgainstStrategyProfile({
            profile,
            actionTags: getAiActionStrategyTags<DiceThroneStrategyTag>(action),
            weightMultiplier: 12,
        });
        return fit?.score ?? 0;
    },
    projectAction({ context, action }) {
        return projectDiceThroneAction({ context, action });
    },
    candidateLoop: {
        enabled: true,
        maxIterations: 3,
        batchSize: 4,
        stopOnUtility: 0.9,
    },
});

const REMOTE_VISIBLE_MAJOR_ACTION_KINDS = new Set<AiLegalAction['kind']>([
    'play-card',
    'play-upgrade-card',
    'select-ability',
]);

function shouldUseRemoteDecisionForDiceThrone(context: AiDecisionContext): boolean {
    return context.legalActions.some((action) => REMOTE_VISIBLE_MAJOR_ACTION_KINDS.has(action.kind));
}

function getInitialKeyDieLockActionForDiceThrone(args: {
    context: AiDecisionContext;
    proposedAction: AiLegalAction;
}): AiLegalAction | null {
    if (args.proposedAction.kind !== 'play-card') return null;

    const phase = getContextPhase(args.context);
    if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') return null;

    const state = args.context.visibleState as DiceThroneState;
    if (state.core.rollConfirmed) return null;
    if (args.context.playerId !== getRollerId(state.core, phase)) return null;

    const plan = getBestStableDiceTargetPlan(state, args.context.playerId, phase)
        ?? getHigherAmbitionChasePlan(state, args.context.playerId, phase)
        ?? getBestDiceTargetPlan(state, args.context.playerId, phase);
    if (!plan || plan.keepDieIds.length === 0) return null;

    const activeDice = getAiActiveDice(state, phase);
    if (activeDice.filter((die) => die.isKept).length >= 3) return null;

    const hasLockedKeyDie = activeDice.some((die) => plan.keepDieIds.includes(die.id) && die.isKept);
    if (hasLockedKeyDie) return null;

    const firstUnlockedKeyDie = activeDice.find((die) => plan.keepDieIds.includes(die.id) && !die.isKept);
    if (!firstUnlockedKeyDie) return null;

    return args.context.legalActions.find((action) => (
        action.kind === 'toggle-die-lock'
        && action.metadata?.dieId === firstUnlockedKeyDie.id
    )) ?? null;
}

function refineDiceThroneAiAction(args: {
    context: AiDecisionContext;
    proposedAction: AiLegalAction;
}): AiLegalAction {
    const phase = getContextPhase(args.context);
    const initialKeyDieLockAction = getInitialKeyDieLockActionForDiceThrone(args);
    if (initialKeyDieLockAction) {
        return initialKeyDieLockAction;
    }

    if (
        (args.proposedAction.kind === 'toggle-die-lock' || args.proposedAction.kind === 'roll-dice')
        && isOffensiveRollRerollBlockedByBindCp(
            args.context.visibleState as DiceThroneState,
            args.context.playerId,
            phase,
        )
    ) {
        const confirmRollAction = args.context.legalActions.find((action) => action.kind === 'confirm-roll');
        if (confirmRollAction) {
            return confirmRollAction;
        }
    }

    return args.proposedAction;
}

export const diceThroneAiRuntime: GameAiRuntime = {
    gameId: 'dicethrone',
    buildLegalActions: buildDiceThroneAiLegalActions,
    defaultMinimumActionDelayMs: 1000,
    localHiddenCommandTypes: [
        'REROLL_BONUS_DIE',
        'SKIP_BONUS_DICE_REROLL',
    ],
    localVisibleStepDelayConfig: {
        mode: 'whitelist',
        actionKinds: [
            'play-card',
            'play-upgrade-card',
            'use-passive-ability',
            'select-ability',
            'roll-dice',
            'bonus-die-reroll',
        ],
    },
    localPolicies: {
        baseline: defaultLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
    refineAiAction({ context, proposedAction }) {
        return refineDiceThroneAiAction({
            context,
            proposedAction,
        });
    },
    resolveCurrentDecisionPlayerId: resolveDiceThroneCurrentDecisionPlayerId,
    resolveOnlineDecisionVisibility: resolveDiceThroneOnlineDecisionVisibility,
    shouldUseRemoteDecision: shouldUseRemoteDecisionForDiceThrone,
};
