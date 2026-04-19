import type { Command, MatchState, PlayerId } from '../../engine/types';
import {
    buildDeterministicAiNoise,
    createAiLegalActionId,
    createProfileAwareActionScorer,
    getAiActionStrategyTags,
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
    GameAiRuntime,
    LocalAiActionScorer,
} from '../../engine/ai';
import type { InteractionDescriptor as EngineInteractionDescriptor, MultistepChoiceData, PromptMultiConfig } from '../../engine/systems/InteractionSystem';
import { DiceThroneDomain } from './domain';
import {
    RESOURCE_IDS,
    STATUS_IDS,
    canAdvancePhase,
    canSellCard,
    checkPlayCard,
    checkPlayUpgradeCard,
    getActiveDice,
    getAvailableAbilityIds,
    getDefensiveAbilityIds,
    getNextPhase,
    isCardPlayableInResponseWindow,
} from './domain';
import { DICETHRONE_COMMANDS } from './domain/ids';
import { DICETHRONE_CHARACTER_CATALOG, type SelectableCharacterId } from './domain/types';
import { findPlayerAbility, getPlayerAbilityBaseDamage } from './domain/abilityLookup';
import { getPlayerPassiveAbilities, isPassiveActionUsable } from './domain/passiveAbility';
import { areTeammates, getOpponents } from './domain/rules';
import { isDirectDiceInterferenceActor } from './domain/responseWindowGuards';
import { hasDebuffs, hasPurifyToken, getUsableTokensForTiming } from './domain/tokenResponse';
import { getTokenEffectValue } from './domain/tokenTypes';
import type { TriggerCondition } from './domain/combat';
import type {
    AbilityCard,
    DiceThroneCore,
    DtResponseWindowType,
    PendingBonusDiceSettlement,
    PendingDamage,
    TurnPhase,
} from './domain/types';

type DiceThroneState = MatchState<DiceThroneCore>;
type DiceThroneStrategyTag =
    | 'damage-race'
    | 'survive-response'
    | 'economy'
    | 'dice-setup'
    | 'upgrade-engine'
    | 'purify-control';

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
};

type DiceInteractionData = MultistepChoiceData<unknown, unknown> & {
    meta?: {
        dtType?: 'modifyDie' | 'selectDie';
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

const buildDiceTargetPlans = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
): DiceTargetPlan[] => {
    const player = state.core.players[playerId];
    if (!player) return [];

    const availableIds = new Set(getAvailableAbilityIds(state.core, playerId, phase));
    const expectedType = phase === 'defensiveRoll' ? 'defensive' : phase === 'offensiveRoll' ? 'offensive' : undefined;
    const dice = getActiveDice(state.core);
    const plans: DiceTargetPlan[] = [];

    const pushPlan = (abilityId: string, trigger: TriggerCondition | undefined) => {
        const strategicScore = getAbilityStrategicScore(state, playerId, abilityId, phase);
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
            });
            return;
        }

        for (const requirement of requirements) {
            const evaluation = evaluateDiceRequirement(dice, requirement);
            plans.push({
                abilityId,
                ...evaluation,
                available: availableIds.has(abilityId),
                strategicScore,
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

const getBestDiceTargetPlan = (
    state: DiceThroneState,
    playerId: PlayerId,
    phase: TurnPhase,
): DiceTargetPlan | null => {
    const plans = buildDiceTargetPlans(state, playerId, phase);
    if (plans.length === 0) return null;

    return [...plans].sort((left, right) => {
        const leftScore = left.strategicScore + left.matchedCount * 18 - left.missingCount * 36 + (left.available ? 60 : 0);
        const rightScore = right.strategicScore + right.matchedCount * 18 - right.missingCount * 36 + (right.available ? 60 : 0);
        if (rightScore !== leftScore) return rightScore - leftScore;
        if (left.missingCount !== right.missingCount) return left.missingCount - right.missingCount;
        return right.strategicScore - left.strategicScore;
    })[0] ?? null;
};

const buildPlayerSelectionCombos = (
    playerIds: PlayerId[],
    selectCount: number,
): PlayerId[][] => {
    if (playerIds.length === 0) return [];

    const normalizedCount = Math.max(1, Math.min(selectCount, playerIds.length));
    const combinations: PlayerId[][] = [];
    const current: PlayerId[] = [];

    const dfs = (startIndex: number) => {
        if (current.length === normalizedCount) {
            combinations.push([...current]);
            return;
        }

        for (let i = startIndex; i < playerIds.length; i += 1) {
            current.push(playerIds[i]);
            dfs(i + 1);
            current.pop();
        }
    };

    dfs(0);
    return combinations;
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

const getRelationToActor = (
    state: DiceThroneState,
    actingPlayerId: PlayerId,
    targetPlayerId: PlayerId,
): AiHint['relationToActor'] => {
    if (actingPlayerId === targetPlayerId) return 'self';
    return areTeammates(state.core, actingPlayerId, targetPlayerId) ? 'ally' : 'enemy';
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
        hints.push(buildTargetAiHint({
            actorPlayerId: playerId,
            targetPlayerId,
            relationToActor: getRelationToActor(state, playerId, targetPlayerId),
            targetKind: 'player',
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
        hints.push(buildTargetAiHint({
            actorPlayerId: playerId,
            targetPlayerId: playerId,
            relationToActor: getRelationToActor(state, playerId, playerId),
            targetKind: 'player',
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
            hints.push(buildTargetAiHint({
                actorPlayerId: actingPlayerId,
                targetPlayerId,
                relationToActor: getRelationToActor(state, actingPlayerId, targetPlayerId),
                targetKind: 'player',
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
            hints.push(buildTargetAiHint({
                actorPlayerId: actingPlayerId,
                targetPlayerId,
                relationToActor: getRelationToActor(state, actingPlayerId, targetPlayerId),
                targetKind: 'player',
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
                hints.push(buildTargetAiHint({
                    actorPlayerId: actingPlayerId,
                    targetPlayerId,
                    relationToActor: getRelationToActor(state, actingPlayerId, targetPlayerId),
                    targetKind: 'player',
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
    return [buildTargetAiHint({
        actorPlayerId: actingPlayerId,
        targetPlayerId,
        relationToActor: getRelationToActor(state, actingPlayerId, targetPlayerId),
        targetKind: 'player',
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
        hints.push(buildTargetAiHint({
            actorPlayerId: actingPlayerId,
            targetPlayerId: fromPlayerId,
            relationToActor: getRelationToActor(state, actingPlayerId, fromPlayerId),
            targetKind: 'player',
            effectIntent: removeIntent,
            estimatedSwing: scoreRemoveSingleStatusTarget(state, actingPlayerId, fromPlayerId, statusId),
            tags: [`transfer-remove:${statusId}`],
        }));
    }

    if (applyIntent) {
        hints.push(buildTargetAiHint({
            actorPlayerId: actingPlayerId,
            targetPlayerId: toPlayerId,
            relationToActor: getRelationToActor(state, actingPlayerId, toPlayerId),
            targetKind: 'player',
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
        payload: { reason },
    }],
    metadata: {
        interactionId,
        reason,
    },
});

const buildInteractionActions = (
    state: DiceThroneState,
    playerId: PlayerId,
): AiLegalAction[] | null => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current || current.playerId !== playerId) return null;

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
                        payload: { optionIds: [] },
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
                            payload: buildSimpleChoicePayload([emergencySkipOption.id], data.multi),
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
                        payload: buildSimpleChoicePayload(
                            combination.map((option) => option.id),
                            data.multi,
                        ),
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
                    payload: buildSimpleChoicePayload([option.id], data.multi),
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
                    payload: {},
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
                payload: { optionId: option.id },
            }],
            metadata: {
                interactionId: current.id,
                optionId: option.id,
            },
        }));
    }

    if (current.kind === 'dt:card-interaction') {
        const data = current.data as CardInteractionData;

        if (data.type === 'selectPlayer') {
            const targetPlayerIds = (data.targetPlayerIds ?? Object.keys(state.core.players) as PlayerId[])
                .filter((targetId) => !!state.core.players[targetId])
                .filter((targetId) => !data.requiresTargetWithStatus || playerHasStatusOrToken(state, targetId));
            const selections = buildPlayerSelectionCombos(targetPlayerIds, data.selectCount ?? 1);

            const actions = selections.map((selectedPlayerIds, index) => {
                const aiHints = buildSelectPlayerActionAiHints(state, playerId, selectedPlayerIds, data);
                return {
                    actionId: createAiLegalActionId('interaction', current.id, 'select-player', index),
                    kind: 'interaction-select-player',
                    label: `选择玩家 ${selectedPlayerIds.join(', ')}`,
                    commands: [{
                        type: 'RESOLVE_INTERACTION',
                        payload: { selectedPlayerIds },
                    }],
                    ...(aiHints.length > 0 ? { aiHints } : {}),
                    metadata: {
                        interactionId: current.id,
                        selectedPlayerIds,
                    },
                };
            });
            return actions.length > 0
                ? actions
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
                    metadata: withAiActionStrategyTags({
                        interactionId: current.id,
                        targetPlayerId,
                        statusId,
                    }, buildStatusInteractionStrategyTags(state, statusId)),
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

        return [];
    }

    if (current.kind !== 'multistep-choice') {
        return null;
    }

    const data = current.data as DiceInteractionData;
    const meta = data.meta;
    const activeDice = getActiveDice(state.core);
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
    const selectCount = Math.max(1, Math.min(meta?.selectCount ?? 1, selectableDice.length));

    if (meta?.dtType === 'selectDie') {
        const selections = enumerateArrayCombinations(selectableDice, 1, selectCount);
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
            metadata: withAiActionStrategyTags({
                interactionId,
                dieId: selection[0]?.id,
                dieIds: selection.map((die) => die.id),
            }, ['dice-setup']),
        }));
    }

    if (meta?.dtType === 'modifyDie') {
        const targetValue = meta.dieModifyConfig?.targetValue ?? 6;
        const mode = meta.dieModifyConfig?.mode;
        if (mode === 'copy') {
            if (selectableDice.length < 2) {
                return [buildEmergencyInteractionCancelAction(interactionId, 'empty-options')];
            }
            const orderedSelections = enumerateOrderedSelections(selectableDice, Math.min(2, selectCount));
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
                    metadata: withAiActionStrategyTags({
                        interactionId,
                        dieId: sourceDie?.id,
                        dieIds: diceIds,
                        newValue: sourceValue,
                        newValues,
                        mode,
                        sourceDieId: sourceDie?.id,
                        targetDieIds: targetDice.map((die) => die.id),
                    }, ['dice-setup']),
                };
            });
        }

        const selections = enumerateArrayCombinations(selectableDice, 1, selectCount);
        return selections.map((selection) => {
            const newValues = selection.map((die) => {
                if (mode === 'adjust') {
                    return Math.min(6, Math.max(1, die.value + 1));
                }
                return targetValue;
            });

            return {
                actionId: createAiLegalActionId(
                    'interaction',
                    interactionId,
                    'modify',
                    ...selection.flatMap((die, index) => [die.id, newValues[index]]),
                ),
                kind: 'interaction-multistep',
                label: `修改骰子 ${selection.map((die) => die.id).join(', ')}`,
                commands: [
                    ...selection.map((die, index) => ({
                        type: 'MODIFY_DIE',
                        payload: { dieId: die.id, newValue: newValues[index] },
                    })),
                    { type: 'SYS_INTERACTION_CONFIRM', payload: { interactionId } },
                ],
                metadata: withAiActionStrategyTags({
                    interactionId,
                    dieId: selection[0]?.id,
                    dieIds: selection.map((die) => die.id),
                    newValue: newValues[0],
                    newValues,
                    mode,
                }, ['dice-setup']),
            };
        });
    }

    return null;
};

const buildSetupActions = (state: DiceThroneState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selectedCharacter = state.core.selectedCharacters[playerId];
    const hasSelectedCharacter = typeof selectedCharacter === 'string' && selectedCharacter !== 'unselected';
    const isHost = playerId === state.core.hostPlayerId;
    const isReady = state.core.readyPlayers[playerId] === true;

    if (!hasSelectedCharacter) {
        const takenCharacters = new Set<SelectableCharacterId>();
        for (const value of Object.values(state.core.selectedCharacters)) {
            if (value && value !== 'unselected') {
                takenCharacters.add(value as SelectableCharacterId);
            }
        }
        const availableCharacters = DICETHRONE_CHARACTER_CATALOG.filter(
            (character) => !takenCharacters.has(character.id),
        );
        const candidates = availableCharacters.length > 0
            ? availableCharacters
            : DICETHRONE_CHARACTER_CATALOG;

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

    if (isHost) {
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

    if (responseWindow && isCurrentResponder) {
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
        for (const card of player.hand) {
            if (!isCardPlayableInResponseWindow(state.core, playerId, card, windowType ?? 'afterCardPlayed', phase)) {
                continue;
            }
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
    if (!settlement || settlement.attackerId !== playerId) return actions;

    for (const die of settlement.dice) {
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
        actionId: createAiLegalActionId('bonus-die', 'skip'),
        kind: 'skip-bonus-dice-reroll',
        label: '确认奖励骰',
        commands: [{ type: 'SKIP_BONUS_DICE_REROLL', payload: {} }],
        metadata: withAiActionStrategyTags({}, ['dice-setup']),
    });

    return actions;
};

const buildPurifyActions = (state: DiceThroneState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    if (!player || !hasPurifyToken(state.core, playerId) || !hasDebuffs(state.core, playerId)) {
        return actions;
    }

    const removableDebuffs = (state.core.tokenDefinitions ?? [])
        .filter((definition) => definition.category === 'debuff' && definition.passiveTrigger?.removable)
        .map((definition) => definition.id)
        .filter((statusId) => (player.statusEffects[statusId] ?? 0) > 0);

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

const buildPassiveActions = (state: DiceThroneState, playerId: PlayerId, phase: TurnPhase): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const passiveAbilities = getPlayerPassiveAbilities(state.core, playerId);
    const activeDice = getActiveDice(state.core);

    for (const passive of passiveAbilities) {
        passive.actions.forEach((passiveAction, actionIndex) => {
            if (!isPassiveActionUsable(state.core, playerId, passive.id, actionIndex, phase)) {
                return;
            }

            if (passiveAction.type === 'rerollDie') {
                // 强口径：避免“已确认骰面 → 触发响应窗口 → 关闭后又重掷 → 再次确认 → 再次触发响应窗口”的重复打扰链。
                // 人类玩家可能会这么操作，但本地 AI 需要尽量把重掷决策放在 CONFIRM_ROLL 之前完成，减少 response-window 重触发。
                if (state.core.rollConfirmed) {
                    return;
                }
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

    if ((phase === 'offensiveRoll' || phase === 'defensiveRoll') && state.core.rollCount < state.core.rollLimit && !state.core.rollConfirmed) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('roll', 'dice'),
            kind: 'roll-dice',
            label: '掷骰',
            commands: [{ type: 'ROLL_DICE', payload: {} }],
            metadata: withAiActionStrategyTags({}, ['dice-setup']),
        });
    }

    if (phase === 'offensiveRoll' || phase === 'defensiveRoll') {
        const offensiveAttackAlreadyInitiated = phase === 'offensiveRoll' && Boolean(state.core.pendingAttack);
        if (phase === 'offensiveRoll' && state.core.rollCount > 0 && !state.core.rollConfirmed) {
            for (const die of getActiveDice(state.core)) {
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
            if (state.core.rollCount === 0) {
                // 防御阶段掷骰前允许手动切换防御技能，但本地 AI 不应在已选定后反复切换，
                // 否则会持续偏向高分的 select-ability，卡死在 defensiveRoll。
                if (selectedDefenseAbilityId) {
                    return [];
                }
                return getDefensiveAbilityIds(state.core, playerId);
            }

            return getAvailableAbilityIds(state.core, playerId, phase).filter(
                (abilityId) => abilityId !== selectedDefenseAbilityId,
            );
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
                metadata: withAiActionStrategyTags({}, ['dice-setup']),
            });
        }
    }

    if (phase === 'main1' || phase === 'main2') {
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
            metadata: withAiActionStrategyTags({}, ['survive-response']),
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

    const interactionActions = buildInteractionActions(state, args.playerId);
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

    const bonusDiceActions = buildBonusDiceActions(state, args.playerId);
    if (bonusDiceActions.length > 0) {
        return bonusDiceActions;
    }

    if (state.sys.responseWindow?.current || hasPendingTokenResponseForPlayer(state, args.playerId)) {
        return buildResponseActions(state, args.playerId, phase);
    }

    return [
        ...buildPurifyActions(state, args.playerId),
        ...buildPassiveActions(state, args.playerId, phase),
        ...buildPhaseActions(state, args.playerId, phase),
    ];
}

const getContextPhase = (context: AiDecisionContext): TurnPhase => {
    const state = context.visibleState as DiceThroneState;
    return (state.sys.phase ?? state.sys.flow?.phase ?? 'setup') as TurnPhase;
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

const setupCharacterRandomScorer: LocalAiActionScorer = {
    id: 'setup-character-random',
    score(context, action) {
        if (action.kind !== 'setup-select-character') return null;
        const noise = buildDeterministicAiNoise(context, action, 'setup');
        return {
            score: Number((noise * 20).toFixed(3)),
            reason: '角色选择随机扰动',
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
        let score = baseDamage * 25;

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
            reason: `能力 ${abilityId} 的基础收益更高`,
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

        if (action.kind === 'play-card' || action.kind === 'response-play-card') {
            let score = 35 + card.cpCost * 10 + (card.isAttackModifier ? 30 : 0);
            let reason = card.isAttackModifier
                ? `攻击修正牌 ${cardId} 具有即时收益`
                : `行动牌 ${cardId} 可带来额外收益`;

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
                const keepValue = card.cpCost * 12 + (card.isAttackModifier ? 18 : 0)
                    + (card.type === 'upgrade' ? 25 : 0) + getCardDrawCount(card) * 14;
                return {
                    score: -keepValue,
                    reason: `弃牌阶段卖 ${cardId}：保留价值越低的牌越适合卖`,
                };
            }
            // 主阶段卖牌：卖高费牌可解锁更多操作空间
            return {
                score: 10 + card.cpCost * 8,
                reason: `卖牌 ${cardId} 可换取 CP`,
            };
        }

        if (action.kind === 'discard-card') {
            return {
                // 弃牌评分应为负值：目的是在多张可弃牌中选最该弃的那张（相对排序），
                // 而非让弃牌动作总分超过 advance-phase 导致 AI 在手牌未超限时也优先弃牌。
                // cpCost 越高越该保留，所以弃高费牌应更不被偏好（更负）。
                score: -(card.cpCost * 15 + (card.type === 'action' ? 8 : 0) + (card.isAttackModifier ? 12 : 0) + getCardDrawCount(card) * 10),
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
        const currentInteraction = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
        const targetOpponentDice = currentInteraction?.kind === 'multistep-choice'
            && (!interactionId || currentInteraction.id === interactionId)
            && (currentInteraction.data as DiceInteractionData | undefined)?.meta?.targetOpponentDice === true;
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
            const getDeltaScore = (values: number[], ids: number[]) => {
                return values.reduce((sum, value, index) => {
                    const dieId = ids[index];
                    const die = dieId === undefined
                        ? null
                        : state.core.dice.find((item) => item.id === dieId) ?? null;
                    if (!die) return sum;
                    const delta = value - die.value;
                    const normalized = targetOpponentDice ? -delta : delta;
                    return sum + normalized * 12;
                }, 0);
            };
            if (newValues.length > 0) {
                const deltaScore = getDeltaScore(newValues, dieIds);
                return {
                    score: newValues.reduce((sum, value) => sum + scoreForTargetValue(value) * 18, 0)
                        + newValues.length * 16
                        + deltaScore,
                    reason: targetOpponentDice
                        ? `优先让对手骰面更低，目标点数 ${newValues.join(', ')}`
                        : `优先完成更多骰子调整，累计目标点数 ${newValues.join(', ')}`,
                };
            }
            if (newValue !== null) {
                const deltaScore = getDeltaScore([newValue], dieId !== null ? [dieId] : []);
                return {
                    score: scoreForTargetValue(newValue) * 18 + deltaScore,
                    reason: targetOpponentDice
                        ? `优先把对手骰面压到更低点数 ${newValue}`
                        : `优先把骰子调整到更高点数 ${newValue}`,
                };
            }

            const dieId = typeof action.metadata?.dieId === 'number'
                ? action.metadata.dieId
                : null;
            if (dieIds.length > 0) {
                const totalScore = dieIds.reduce((sum, currentDieId) => {
                    const die = state.core.dice.find((item) => item.id === currentDieId);
                    return sum + (die ? scoreForDieValue(die.value) * 12 : 0);
                }, 0);
                return {
                    score: totalScore + dieIds.length * 18,
                    reason: targetOpponentDice
                        ? `优先处理对手高点骰子 ${dieIds.join(', ')}`
                        : `优先一次处理更多低点骰子 ${dieIds.join(', ')}`,
                };
            }
            if (dieId !== null) {
                const die = state.core.dice.find((item) => item.id === dieId);
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

        if (action.kind === 'bonus-die-reroll') {
            const dieIndex = typeof action.metadata?.dieIndex === 'number'
                ? action.metadata.dieIndex
                : null;
            const die = dieIndex !== null
                ? settlement.dice.find((item) => item.index === dieIndex)
                : null;
            if (!die) return null;
            return {
                score: (4 - die.value) * 35,
                reason: `优先重掷较低的奖励骰 ${die.value}`,
            };
        }

        if (action.kind === 'skip-bonus-dice-reroll') {
            return {
                score: 15,
                reason: '当前奖励骰已足够，直接确认',
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

        const activeDice = getActiveDice(state.core);
        const plan = getBestDiceTargetPlan(state, context.playerId, phase);
        const pendingToggleCount = activeDice.filter((die) => {
            const shouldKeep = plan ? plan.keepDieIds.includes(die.id) : false;
            return shouldKeep !== die.isKept;
        }).length;

        if (action.kind === 'toggle-die-lock') {
            const dieId = typeof action.metadata?.dieId === 'number' ? action.metadata.dieId : null;
            const die = dieId !== null ? activeDice.find((candidate) => candidate.id === dieId) : null;
            if (!die) return null;
            const shouldKeep = plan ? plan.keepDieIds.includes(die.id) : false;
            if (shouldKeep === die.isKept) return null;

            return {
                score: shouldKeep ? 175 : 135,
                reason: shouldKeep
                    ? `先锁住接近 ${plan?.abilityId ?? '高价值技能'} 的关键骰子`
                    : '先解锁无关骰子，再进行下一次重投',
            };
        }

        if (action.kind === 'roll-dice') {
            if (state.core.rollCount === 0) {
                return {
                    score: 45,
                    reason: '先拿到第一手骰面，再决定锁骰与重投路线',
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
            if (pendingToggleCount > 0) {
                return {
                    score: -180,
                    reason: '锁骰方案还没对齐，先别提前确认骰面',
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
            const targetDieId = typeof action.metadata?.targetDieId === 'number'
                ? action.metadata.targetDieId
                : null;
            const die = targetDieId !== null
                ? state.core.dice.find((item) => item.id === targetDieId)
                : null;
            if (!die) return null;

            return {
                score: (4 - die.value) * 30,
                reason: `优先重掷较低点数的骰子 ${die.value}`,
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
            const stacks = statusId ? (player.statusEffects[statusId] ?? 0) : 0;
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
        'skip-bonus-dice-reroll',
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

const countStatusStacks = (player: DiceThroneState['core']['players'][PlayerId]): number => {
    return Object.values(player.statusEffects ?? {}).reduce((sum, value) => sum + value, 0);
};

const countTokenStacks = (player: DiceThroneState['core']['players'][PlayerId]): number => {
    return Object.values(player.tokens ?? {}).reduce((sum, value) => sum + value, 0);
};

const getCardDrawCount = (card: AbilityCard): number => {
    return card.effects?.reduce((sum, effect) => {
        if (effect.action?.type !== 'drawCard') return sum;
        return sum + (effect.action.drawCount ?? effect.action.value ?? 0);
    }, 0) ?? 0;
};

const estimateCardStrategicValue = (
    card: AbilityCard,
    actionKind: AiLegalAction['kind'],
): number => {
    if (actionKind === 'play-upgrade-card') {
        return 90 + card.cpCost * 22;
    }

    if (actionKind === 'play-card' || actionKind === 'response-play-card') {
        return 35 + card.cpCost * 10 + (card.isAttackModifier ? 22 : 0) + getCardDrawCount(card) * 14;
    }

    if (actionKind === 'sell-card') {
        return 10 + card.cpCost * 8;
    }

    if (actionKind === 'discard-card') {
        return card.cpCost * 18 + (card.type === 'action' ? 8 : 0);
    }

    return 0;
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
    const cpAfterSell = currentCp + soldCard.cpCost;
    let best = 0;

    for (const card of player.hand) {
        if (card.id === soldCardId) continue;
        if (currentCp >= card.cpCost || cpAfterSell < card.cpCost) continue;

        best = Math.max(
            best,
            estimateCardStrategicValue(
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
    const self = state.core.players[playerId];
    if (!self) return 0;

    const opponentIds = getOpponentIds(state, playerId);
    const opponentHealth = opponentIds.reduce((sum, opponentId) => {
        return sum + (state.core.players[opponentId]?.resources[RESOURCE_IDS.HP] ?? 0);
    }, 0);
    const opponentCp = opponentIds.reduce((sum, opponentId) => {
        return sum + (state.core.players[opponentId]?.resources[RESOURCE_IDS.CP] ?? 0);
    }, 0);
    const divisor = Math.max(1, opponentIds.length);

    const ownHp = self.resources[RESOURCE_IDS.HP] ?? 0;
    const ownCp = self.resources[RESOURCE_IDS.CP] ?? 0;
    const ownUpgradeCount = Object.keys(self.upgradeCardByAbilityId ?? {}).length;
    const pendingDamage = state.core.pendingDamage;
    const pendingAttack = state.core.pendingAttack;
    const pendingPressure = pendingAttack?.attackerId === playerId
        ? (pendingAttack.damage ?? 0) + (pendingAttack.attackModifierBonusDamage ?? 0)
        : 0;
    const incomingDamage = pendingDamage?.targetPlayerId === playerId
        ? pendingDamage.currentDamage
        : 0;

    return (
        (ownHp - opponentHealth / divisor) * 6
        + (ownCp - opponentCp / divisor) * 3
        + self.hand.length * 7
        + ownUpgradeCount * 18
        + self.damageShields.length * 12
        + countTokenStacks(self) * 3
        - countStatusStacks(self) * 8
        + pendingPressure * 5
        - incomingDamage * 6
    );
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
        const strategicValue = estimateCardStrategicValue(card, args.action.kind);
        const phaseBonus = phase === 'main1' ? 12 : 0;
        return {
            score: Number(((strategicValue * 0.3 + projectedPosition * 0.04 + phaseBonus) * scale).toFixed(3)),
            reason: args.action.kind === 'play-upgrade-card'
                ? '高难度会额外考虑长期成长与后续回合收益'
                : '高难度会额外考虑当前出牌后的持续收益',
            metadata: {
                projectedPosition,
                strategicValue,
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
        const cardValue = estimateCardStrategicValue(card, 'play-card');
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
});

const REMOTE_VISIBLE_MAJOR_ACTION_KINDS = new Set<AiLegalAction['kind']>([
    'setup-select-character',
    'play-card',
    'play-upgrade-card',
    'response-play-card',
    'select-ability',
]);

function shouldUseRemoteDecisionForDiceThrone(context: AiDecisionContext): boolean {
    return context.legalActions.some((action) => REMOTE_VISIBLE_MAJOR_ACTION_KINDS.has(action.kind));
}

export const diceThroneAiRuntime: GameAiRuntime = {
    gameId: 'dicethrone',
    buildLegalActions: buildDiceThroneAiLegalActions,
    localPolicies: {
        baseline: defaultLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
    shouldUseRemoteDecision: shouldUseRemoteDecisionForDiceThrone,
};
