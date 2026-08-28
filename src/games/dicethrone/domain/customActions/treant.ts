import { createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { hasCurrentChoiceAnchor, registerChoiceEffectHandler } from '../choiceEffects';
import { getPlayerAbilityEffects } from '../abilityLookup';
import { RESOURCE_IDS } from '../resources';
import { buildDrawEvents } from '../deckEvents';
import {
    getAttackMaxDuplicateValueCount,
    getOpponents,
    getPendingBonusSettlementDice,
    getPlayerDieFace,
    getSeatingOrder,
    getTeammateId,
    getTokenStackLimit,
} from '../rules';
import { CP_MAX } from '../types';
import type {
    BonusDamageAddedEvent,
    BonusDieRolledEvent,
    CpChangedEvent,
    DamageDealtEvent,
    DiceThroneEvent,
    HealAppliedEvent,
    PendingAttackUpdatedEvent,
    ChoiceRequestedEvent,
    TokenConsumedEvent,
    TokenGrantedEvent,
} from '../events';
import { TOKEN_IDS, TREANT_DICE_FACE_IDS } from '../ids';
import {
    getDiceThronePlayerChoiceLabel,
    getDiceThronePlayerChoiceListLabel,
} from '../playerDisplay';

const WILD_GROWTH_CHOICE_ID = 'treant-wild-growth-resolve';
const SHATTERING_FIST_CHOICE_ID = 'treant-shattering-fist-resolve';
const SHATTERING_FIST_3_CULTIVATE_CHOICE_ID = 'treant-shattering-fist-3-cultivate-resolve';
const QUIET_CULTIVATION_CHOICE_ID = 'treant-quiet-cultivation-resolve';
const NATURE_TOUCH_CULTIVATE_CHOICE_ID = 'treant-nature-touch-cultivate-resolve';
const ROOTED_CHOICE_ID = 'treant-rooted-resolve';
const TREANT_LIFE_SAP_SETTLEMENT_ID = 'treant-life-sap-roll';
const TREANT_WILD_GROWTH_2_SETTLEMENT_ID = 'treant-wild-growth-2-roll';
const TREANT_TRAMPLE_SETTLEMENT_ID = 'treant-trample-roll';
const TREANT_SOULFIRE_SETTLEMENT_ID = 'treant-soulfire-roll';
const TREANT_MOTHER_TREE_SETTLEMENT_ID = 'treant-mother-tree-roll';
const TREANT_ROOTED_SETTLEMENT_ID = 'treant-rooted-roll';
const FOREST_AWAKENS_CHOICE_ID = 'treant-forest-awakens-resolve';
const TEND_CARE_2_CULTIVATE_CHOICE_ID = 'treant-tend-care-2-cultivate-resolve';
const NATURE_TOUCH_2_MERCY_CHOICE_ID = 'treant-nature-touch-2-mercy-resolve';
const DRINK_DEEP_CHOICE_ID = 'treant-card-drink-deep-resolve';
const HARVEST_CHOICE_ID = 'treant-card-harvest-resolve';
const DOWNPOUR_CHOICE_ID = 'treant-card-downpour-resolve';
const CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT: Record<number, string> = {
    1: 'treant-card-cultivate-1-resolve',
    2: 'treant-card-cultivate-2-resolve',
    3: 'treant-card-cultivate-3-resolve',
    4: 'treant-card-cultivate-4-resolve',
};
const TEND_CARE_CHOICE_ID_BY_AMOUNT: Record<number, string> = {
    3: 'treant-tend-care-3-resolve',
    4: 'treant-tend-care-4-resolve',
};
const WILD_GROWTH_2_CULTIVATE_CHOICE_ID_BY_AMOUNT: Record<number, string> = {
    1: 'treant-wild-growth-2-cultivate-1-resolve',
    2: 'treant-wild-growth-2-cultivate-2-resolve',
    3: 'treant-wild-growth-2-cultivate-3-resolve',
    4: 'treant-wild-growth-2-cultivate-4-resolve',
    5: 'treant-wild-growth-2-cultivate-5-resolve',
};
const WILD_GROWTH_SOURCE_IDS = ['wild-growth'] as const;
const WILD_GROWTH_2_MAIN_SOURCE_IDS = ['wild-growth-2-main', 'wild-roar', 'wild-roar-2-main'] as const;
const SHATTERING_FIST_SOURCE_IDS = ['shattering-fist-3', 'shattering-fist-4', 'shattering-fist-5'] as const;
const NATURE_TOUCH_SOURCE_IDS = ['nature-touch', 'nature-touch-2-main'] as const;
const NATURE_TOUCH_2_MERCY_SOURCE_IDS = ['nature-touch-2-mercy'] as const;
const SHATTERING_FIST_3_CULTIVATE_SOURCE_IDS = ['shattering-fist-3-3', 'shattering-fist-3-4', 'shattering-fist-3-5'] as const;
const QUIET_CULTIVATION_SOURCE_IDS = ['quiet-cultivation'] as const;
const ROOTED_SOURCE_IDS = ['rooted'] as const;
const FOREST_AWAKENS_SOURCE_IDS = ['forest-awakens'] as const;
const DRINK_DEEP_SOURCE_IDS = ['treant-card-drink-deep'] as const;
const HARVEST_SOURCE_IDS = ['treant-card-harvest'] as const;
const DOWNPOUR_SOURCE_IDS = ['treant-card-downpour'] as const;
const CARD_CULTIVATE_SOURCE_IDS = [
    'treant-card-cultivate',
    'treant-card-planting',
    'treant-card-soulfire',
    'treant-card-mother-tree',
] as const;
const CARD_CULTIVATE_ALLOWED_AMOUNTS_BY_SOURCE: Record<(typeof CARD_CULTIVATE_SOURCE_IDS)[number], readonly number[]> = {
    'treant-card-cultivate': [3],
    'treant-card-planting': [3],
    'treant-card-soulfire': [1, 2, 3],
    'treant-card-mother-tree': [4],
};
const TEND_CARE_SOURCE_IDS = ['tend-care', 'tend-care-2-main'] as const;
const TEND_CARE_2_CULTIVATE_SOURCE_IDS = ['tend-care-2-cultivate'] as const;
const NATURE_TOUCH_CULTIVATE_AMOUNT = 2;
const FOREST_AWAKENS_CULTIVATE_AMOUNT = 5;

const buildWildGrowth2SummaryParams = (
    dice: Array<{ face?: string }>,
): Record<string, number> => {
    const branchCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.BRANCH).length;
    const leafCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.LEAF).length;
    const spiritCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.SPIRIT).length;
    return { branchCount, leafCount, spiritCount, bonusDamage: branchCount };
};

type WildGrowthChoice = {
    seedling: number;
    sapling: number;
    divine: number;
    lifeSap: boolean;
};

type ShatteringFistChoice = {
    seedling: number;
    sapling: number;
    divine: number;
};

type SpiritCounts = {
    seedling: number;
    sapling: number;
    divine: number;
};

type SpiritLimits = SpiritCounts;
type TreantSpiritContext = Pick<CustomActionContext, 'attackerId' | 'state'>;

type RootedChoice = {
    seedling: number;
    sapling: number;
    divine: number;
    lifeSapTargetIndex: number;
    requiresCultivate: boolean;
    requiresLifeSap: boolean;
};

type TendCareChoice = {
    seedling: number;
    sapling: number;
    divine: number;
    lifeSapTargetIndex: number;
    thornTargetIndex: number;
};

type HarvestChoice = {
    seedling: number;
    sapling: number;
    divine: number;
    lifeSapTargetMask: number;
};

function normalizeChoiceValue(value?: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}

function isExpectedChoiceSource(sourceAbilityId: string | undefined, expectedSourceIds: readonly string[]): boolean {
    return typeof sourceAbilityId === 'string' && expectedSourceIds.includes(sourceAbilityId);
}

function matchesCurrentPendingAttackSource(
    state: CustomActionContext['state'],
    playerId: string,
    sourceAbilityId: string | undefined,
): sourceAbilityId is string {
    return typeof sourceAbilityId === 'string'
        && hasCurrentChoiceAnchor(state, sourceAbilityId)
        && state.pendingAttack?.attackerId === playerId
        && state.pendingAttack.sourceAbilityId === sourceAbilityId;
}

function matchesCurrentChoiceSource(
    state: CustomActionContext['state'],
    sourceAbilityId: string | undefined,
): sourceAbilityId is string {
    return hasCurrentChoiceAnchor(state, sourceAbilityId);
}

function encodeWildGrowthChoice(choice: WildGrowthChoice): number {
    return choice.seedling + choice.sapling * 10 + choice.divine * 100 + (choice.lifeSap ? 1000 : 0);
}

function decodeWildGrowthChoice(value?: number): WildGrowthChoice {
    const raw = normalizeChoiceValue(value);
    return {
        seedling: raw % 10,
        sapling: Math.floor(raw / 10) % 10,
        divine: Math.floor(raw / 100) % 10,
        lifeSap: Math.floor(raw / 1000) % 10 > 0,
    };
}

function getWildGrowthChoiceLabelKey(choice: WildGrowthChoice): string {
    const parts: string[] = [];
    if (choice.seedling > 0) parts.push(`seedling${choice.seedling}`);
    if (choice.sapling > 0) parts.push(`sapling${choice.sapling}`);
    if (choice.divine > 0) parts.push(`divine${choice.divine}`);
    const tokenKey = parts.length > 0 ? parts.join('_') : 'none';
    return `choices.treantWildGrowth.${tokenKey}${choice.lifeSap ? '_life' : ''}`;
}

function encodeShatteringFistChoice(choice: ShatteringFistChoice): number {
    return encodeSpiritCounts(choice);
}

function decodeShatteringFistChoice(value?: number): ShatteringFistChoice {
    return decodeSpiritCounts(value);
}

function getShatteringFistChoiceLabelKey(choice: ShatteringFistChoice): string {
    if (choice.seedling > 0) return 'choices.treantShatteringFist.seedling';
    if (choice.sapling > 0) return 'choices.treantShatteringFist.sapling';
    if (choice.divine > 0) return 'choices.treantShatteringFist.divine';
    return 'choices.treantShatteringFist.none';
}

function encodeSpiritCounts(counts: SpiritCounts): number {
    return counts.seedling + counts.sapling * 10 + counts.divine * 100;
}

function decodeSpiritCounts(value?: number): SpiritCounts {
    const raw = normalizeChoiceValue(value);
    return {
        seedling: raw % 10,
        sapling: Math.floor(raw / 10) % 10,
        divine: Math.floor(raw / 100) % 10,
    };
}

function getSpiritCounts({ attackerId, state }: TreantSpiritContext): SpiritCounts {
    const tokens = state.players[attackerId]?.tokens ?? {};
    return {
        seedling: tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
        sapling: tokens[TOKEN_IDS.TREANT_SAPLING] ?? 0,
        divine: tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0,
    };
}

function getSpiritLimits({ attackerId, state }: TreantSpiritContext): SpiritLimits {
    return {
        seedling: getTokenStackLimit(state, attackerId, TOKEN_IDS.TREANT_SEEDLING),
        sapling: getTokenStackLimit(state, attackerId, TOKEN_IDS.TREANT_SAPLING),
        divine: getTokenStackLimit(state, attackerId, TOKEN_IDS.TREANT_DIVINE),
    };
}

function totalSpirits(counts: SpiritCounts): number {
    return counts.seedling + counts.sapling + counts.divine;
}

function nextCultivateStates(current: SpiritCounts, limits: SpiritLimits): SpiritCounts[] {
    const next: SpiritCounts[] = [];
    if (current.seedling < limits.seedling) {
        next.push({ ...current, seedling: current.seedling + 1 });
    }
    if (current.seedling > 0 && current.sapling < limits.sapling) {
        next.push({ seedling: current.seedling - 1, sapling: current.sapling + 1, divine: current.divine });
    }
    if (current.sapling > 0 && current.divine < limits.divine) {
        next.push({ seedling: current.seedling, sapling: current.sapling - 1, divine: current.divine + 1 });
    }
    return next;
}

function enumerateCultivateOutcomes(current: SpiritCounts, limits: SpiritLimits, amount: number): SpiritCounts[] {
    const outcomes = new Map<number, SpiritCounts>();

    const visit = (counts: SpiritCounts, remaining: number): void => {
        if (remaining <= 0) {
            outcomes.set(encodeSpiritCounts(counts), counts);
            return;
        }

        const nextStates = nextCultivateStates(counts, limits);
        if (nextStates.length === 0) {
            outcomes.set(encodeSpiritCounts(counts), counts);
            return;
        }

        for (const next of nextStates) {
            visit(next, remaining - 1);
        }
    };

    visit(current, amount);
    return Array.from(outcomes.values()).sort((a, b) => {
        const totalDiff = totalSpirits(b) - totalSpirits(a);
        if (totalDiff !== 0) return totalDiff;
        if (a.divine !== b.divine) return b.divine - a.divine;
        if (a.sapling !== b.sapling) return b.sapling - a.sapling;
        return b.seedling - a.seedling;
    });
}

function enumerateDownpourOutcomes(current: SpiritCounts, limits: SpiritLimits): SpiritCounts[] {
    const outcomes = new Map<number, SpiritCounts>();
    outcomes.set(encodeSpiritCounts(current), current);

    const saplingsToDivine = Math.min(current.sapling, Math.max(0, limits.divine - current.divine));
    const remainingSapling = current.sapling - saplingsToDivine;
    const seedlingsToSapling = Math.min(current.seedling, Math.max(0, limits.sapling - remainingSapling));
    const allExistingOnce: SpiritCounts = {
        seedling: current.seedling - seedlingsToSapling,
        sapling: remainingSapling + seedlingsToSapling,
        divine: current.divine + saplingsToDivine,
    };
    outcomes.set(encodeSpiritCounts(allExistingOnce), allExistingOnce);

    return Array.from(outcomes.values()).sort((a, b) => {
        if (a.divine !== b.divine) return b.divine - a.divine;
        if (a.sapling !== b.sapling) return b.sapling - a.sapling;
        return b.seedling - a.seedling;
    });
}

function getCultivateLabelKey(counts: SpiritCounts): string {
    return `choices.treantCultivate.s${counts.seedling}_a${counts.sapling}_d${counts.divine}`;
}

function buildSpiritTransitionEvents(
    ctx: TreantSpiritContext & { sourceAbilityId: string; timestamp: number },
    target: SpiritCounts,
): DiceThroneEvent[] {
    const current = getSpiritCounts(ctx);
    const transitions: Array<{ tokenId: string; current: number; target: number }> = [
        { tokenId: TOKEN_IDS.TREANT_SEEDLING, current: current.seedling, target: target.seedling },
        { tokenId: TOKEN_IDS.TREANT_SAPLING, current: current.sapling, target: target.sapling },
        { tokenId: TOKEN_IDS.TREANT_DIVINE, current: current.divine, target: target.divine },
    ];

    return transitions.flatMap(({ tokenId, current: currentAmount, target: targetAmount }, index) => {
        const delta = targetAmount - currentAmount;
        if (delta === 0) return [];
        if (delta > 0) {
            return [{
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId: ctx.attackerId,
                    tokenId,
                    amount: delta,
                    newTotal: targetAmount,
                    sourceAbilityId: ctx.sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: ctx.timestamp + index * 0.001,
            } as TokenGrantedEvent];
        }

        return [{
            type: 'TOKEN_CONSUMED',
            payload: {
                playerId: ctx.attackerId,
                tokenId,
                amount: Math.abs(delta),
                newTotal: targetAmount,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + index * 0.001,
        } as TokenConsumedEvent];
    });
}

function encodeRootedChoice(choice: RootedChoice): number {
    return encodeSpiritCounts(choice)
        + (choice.lifeSapTargetIndex + 1) * 1000
        + (choice.requiresCultivate ? 10000 : 0)
        + (choice.requiresLifeSap ? 20000 : 0);
}

function decodeRootedChoice(value?: number): RootedChoice {
    let raw = normalizeChoiceValue(value);
    const requiresLifeSap = raw >= 20000;
    if (requiresLifeSap) raw -= 20000;
    const requiresCultivate = raw >= 10000;
    if (requiresCultivate) raw -= 10000;
    return {
        ...decodeSpiritCounts(raw % 1000),
        lifeSapTargetIndex: Math.floor(raw / 1000) - 1,
        requiresCultivate,
        requiresLifeSap,
    };
}

function getRootedChoiceLabelKey(choice: RootedChoice, needsCultivate: boolean, needsLifeSap: boolean): string {
    const cultivateKey = needsCultivate
        ? `s${choice.seedling}_a${choice.sapling}_d${choice.divine}`
        : 'none';
    const targetKey = needsLifeSap
        ? `p${choice.lifeSapTargetIndex}`
        : 'none';
    return `choices.treantRooted.${cultivateKey}_${targetKey}`;
}

function getRootedLifeSapTargetIds(state: CustomActionContext['state'], playerId: string): string[] {
    return [playerId, ...Object.keys(state.players).filter(id => id !== playerId)];
}

function encodeTendCareChoice(choice: TendCareChoice): number {
    return encodeSpiritCounts(choice) + (choice.lifeSapTargetIndex + 1) * 1000 + (choice.thornTargetIndex + 1) * 10000;
}

function encodeHarvestChoice(choice: HarvestChoice): number {
    return encodeSpiritCounts(choice) + choice.lifeSapTargetMask * 1000;
}

function decodeHarvestChoice(value?: number): HarvestChoice {
    const raw = normalizeChoiceValue(value);
    return {
        ...decodeSpiritCounts(raw % 1000),
        lifeSapTargetMask: Math.floor(raw / 1000),
    };
}

function decodeTendCareChoice(value?: number): TendCareChoice {
    const raw = normalizeChoiceValue(value);
    return {
        ...decodeSpiritCounts(raw % 1000),
        lifeSapTargetIndex: Math.floor(raw / 1000) % 10 - 1,
        thornTargetIndex: Math.floor(raw / 10000) % 10 - 1,
    };
}

function getTendCareCultivateAmount(action: CustomActionContext['action']): number {
    const amount = Number(action.cultivateAmount);
    return amount === 4 ? 4 : 3;
}

function getCurrentTendCareCultivateAmount(
    state: CustomActionContext['state'],
    playerId: string,
    sourceAbilityId?: string,
): number | undefined {
    if (sourceAbilityId === 'tend-care-2-main') return 4;
    if (sourceAbilityId === 'tend-care') return 3;

    const effect = getPlayerAbilityEffects(state, playerId, 'tend-care').find(currentEffect => (
        currentEffect.action.type === 'custom'
        && currentEffect.action.customActionId === 'treant-tend-care-choice'
    ));
    const amount = Number(effect?.action?.cultivateAmount);
    if (amount === 4) return 4;
    if (amount === 3) return 3;
    return undefined;
}

function getCurrentCardCultivateAmount(
    state: CustomActionContext['state'],
    playerId: string,
    sourceAbilityId: string | undefined,
    customId?: string,
): number | undefined {
    if (sourceAbilityId === 'treant-card-cultivate' || sourceAbilityId === 'treant-card-planting') {
        return 3;
    }

    if (sourceAbilityId === 'treant-card-soulfire') {
        const expectedAmount = state.currentChoiceContext?.expectedCultivateAmount;
        if (typeof expectedAmount === 'number') return expectedAmount;
        const customAmount = Object.entries(CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT)
            .find(([, choiceId]) => choiceId === customId)?.[0];
        if (customAmount) return Number(customAmount);
    }
    if (sourceAbilityId === 'treant-card-mother-tree' && customId === CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT[4]) {
        return 4;
    }

    const settlement = state.pendingBonusDiceSettlement;
    if (!settlement || settlement.sourceAbilityId !== sourceAbilityId || settlement.attackerId !== playerId) {
        return undefined;
    }

    if (sourceAbilityId === 'treant-card-soulfire') {
        const spiritCount = getPendingBonusSettlementDice(settlement).reduce(
            (count, die) => count + (die.face === TREANT_DICE_FACE_IDS.SPIRIT ? 1 : 0),
            0,
        );
        return spiritCount > 0 ? spiritCount : undefined;
    }

    if (sourceAbilityId === 'treant-card-mother-tree') {
        return getPendingBonusSettlementDice(settlement).some(die => die.face === TREANT_DICE_FACE_IDS.SPIRIT) ? 4 : undefined;
    }

    return undefined;
}

function getTendCareChoiceId(amount: number): string {
    return TEND_CARE_CHOICE_ID_BY_AMOUNT[amount] ?? TEND_CARE_CHOICE_ID_BY_AMOUNT[3];
}

function getTendCareLifeSapTargetIds(state: CustomActionContext['state']): string[] {
    return getSeatingOrder(state);
}

function getChoicePlayerLabel(state: CustomActionContext['state'], playerId: string): string {
    return getDiceThronePlayerChoiceLabel(state, playerId);
}

function getChoicePlayerListLabel(state: CustomActionContext['state'], playerIds: string[]): string {
    return getDiceThronePlayerChoiceListLabel(state, playerIds);
}

function buildWildGrowthChoices({ attackerId, state }: CustomActionContext): ChoiceRequestedEvent['payload']['options'] {
    const tokens = state.players[attackerId]?.tokens ?? {};
    const maxSeedling = Math.min(tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0, 2);
    const maxSapling = Math.min(tokens[TOKEN_IDS.TREANT_SAPLING] ?? 0, 2);
    const maxDivine = Math.min(tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0, 2);
    const hasLifeSap = (tokens[TOKEN_IDS.LIFE_SAP] ?? 0) > 0;
    const choices: WildGrowthChoice[] = [];

    for (let seedling = 0; seedling <= maxSeedling; seedling += 1) {
        for (let sapling = 0; sapling <= maxSapling; sapling += 1) {
            for (let divine = 0; divine <= maxDivine; divine += 1) {
                const treeCount = seedling + sapling + divine;
                if (treeCount > 2) continue;
                choices.push({ seedling, sapling, divine, lifeSap: false });
                if (hasLifeSap) {
                    choices.push({ seedling, sapling, divine, lifeSap: true });
                }
            }
        }
    }

    return choices
        .sort((a, b) => {
            const countA = a.seedling + a.sapling + a.divine;
            const countB = b.seedling + b.sapling + b.divine;
            if (countA !== countB) return countA - countB;
            if (a.lifeSap !== b.lifeSap) return a.lifeSap ? 1 : -1;
            if (a.seedling !== b.seedling) return a.seedling - b.seedling;
            if (a.sapling !== b.sapling) return a.sapling - b.sapling;
            return a.divine - b.divine;
        })
        .map(choice => ({
            value: encodeWildGrowthChoice(choice),
            customId: WILD_GROWTH_CHOICE_ID,
            labelKey: getWildGrowthChoiceLabelKey(choice),
        }));
}

function buildShatteringFistChoices({ attackerId, state }: CustomActionContext): ChoiceRequestedEvent['payload']['options'] {
    const tokens = state.players[attackerId]?.tokens ?? {};
    const choices: ShatteringFistChoice[] = [
        { seedling: 0, sapling: 0, divine: 0 },
    ];
    if ((tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0) > 0) {
        choices.push({ seedling: 1, sapling: 0, divine: 0 });
    }
    if ((tokens[TOKEN_IDS.TREANT_SAPLING] ?? 0) > 0) {
        choices.push({ seedling: 0, sapling: 1, divine: 0 });
    }
    if ((tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0) > 0) {
        choices.push({ seedling: 0, sapling: 0, divine: 1 });
    }

    return choices.map(choice => ({
        value: encodeShatteringFistChoice(choice),
        customId: SHATTERING_FIST_CHOICE_ID,
        labelKey: getShatteringFistChoiceLabelKey(choice),
    }));
}

function hasThreeMatchingDieValues(ctx: CustomActionContext): boolean {
    return getAttackMaxDuplicateValueCount(ctx.state) >= 3;
}

function buildNatureTouchCultivateChoices(ctx: CustomActionContext): ChoiceRequestedEvent['payload']['options'] {
    const outcomes = enumerateCultivateOutcomes(
        getSpiritCounts(ctx),
        getSpiritLimits(ctx),
        NATURE_TOUCH_CULTIVATE_AMOUNT,
    );

    return outcomes.map(outcome => ({
        value: encodeSpiritCounts(outcome),
        customId: NATURE_TOUCH_CULTIVATE_CHOICE_ID,
        labelKey: getCultivateLabelKey(outcome),
    }));
}

function buildTendCareChoices(ctx: CustomActionContext): ChoiceRequestedEvent['payload']['options'] {
    const cultivateAmount = getTendCareCultivateAmount(ctx.action);
    const outcomes = enumerateCultivateOutcomes(
        getSpiritCounts(ctx),
        getSpiritLimits(ctx),
        cultivateAmount,
    );
    const lifeSapTargetIds = getTendCareLifeSapTargetIds(ctx.state);
    const thornTargetIds = getOpponents(ctx.state, ctx.attackerId);

    return outcomes.flatMap((outcome) => lifeSapTargetIds.flatMap((lifeSapTargetId, lifeSapTargetIndex) =>
        thornTargetIds.map((thornTargetId, thornTargetIndex) => ({
            value: encodeTendCareChoice({
                ...outcome,
                lifeSapTargetIndex,
                thornTargetIndex,
            }),
            customId: getTendCareChoiceId(cultivateAmount),
            labelKey: 'choices.treantTendCare.option',
            labelParams: {
                seedling: outcome.seedling,
                sapling: outcome.sapling,
                divine: outcome.divine,
                lifeSapTarget: getChoicePlayerLabel(ctx.state, lifeSapTargetId),
                thornTarget: getChoicePlayerLabel(ctx.state, thornTargetId),
            },
        }))
    ));
}

function buildForestAwakensChoices(ctx: CustomActionContext): ChoiceRequestedEvent['payload']['options'] {
    const outcomes = enumerateCultivateOutcomes(
        getSpiritCounts(ctx),
        getSpiritLimits(ctx),
        FOREST_AWAKENS_CULTIVATE_AMOUNT,
    );

    return outcomes.map(outcome => ({
        value: encodeSpiritCounts(outcome),
        customId: FOREST_AWAKENS_CHOICE_ID,
        labelKey: getCultivateLabelKey(outcome),
    }));
}

function getCardCultivateAmount(action: CustomActionContext['action']): number {
    const amount = Number(action.cultivateAmount);
    if (amount === 1 || amount === 2 || amount === 4) return amount;
    return 3;
}

function getCardCultivateChoiceId(amount: number): string {
    return CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT[amount] ?? CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT[3];
}

function buildCardCultivateChoices(ctx: CustomActionContext, amount: number): ChoiceRequestedEvent['payload']['options'] {
    return enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), amount).map(outcome => ({
        value: encodeSpiritCounts(outcome),
        customId: getCardCultivateChoiceId(amount),
        labelKey: getCultivateLabelKey(outcome),
    }));
}

function buildGenericCultivateChoices(
    ctx: CustomActionContext,
    amount: number,
    customId: string,
): ChoiceRequestedEvent['payload']['options'] {
    return enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), amount).map(outcome => ({
        value: encodeSpiritCounts(outcome),
        customId,
        labelKey: getCultivateLabelKey(outcome),
    }));
}

function bitCount(value: number): number {
    let count = 0;
    let remaining = Math.max(0, Math.floor(value));
    while (remaining > 0) {
        count += remaining & 1;
        remaining >>= 1;
    }
    return count;
}

function getMaskPlayerIds(playerIds: string[], mask: number): string[] {
    return playerIds.filter((_, index) => (mask & (1 << index)) !== 0);
}

function buildHarvestChoices(ctx: CustomActionContext): ChoiceRequestedEvent['payload']['options'] {
    const current = getSpiritCounts(ctx);
    const playerIds = getSeatingOrder(ctx.state);
    const choices: HarvestChoice[] = [];

    for (let seedling = 0; seedling <= Math.min(current.seedling, 3); seedling += 1) {
        for (let sapling = 0; sapling <= Math.min(current.sapling, 3); sapling += 1) {
            for (let divine = 0; divine <= Math.min(current.divine, 3); divine += 1) {
                const removed = seedling + sapling + divine;
                if (removed > 3) continue;

                if (removed < 2) {
                    choices.push({ seedling, sapling, divine, lifeSapTargetMask: 0 });
                    continue;
                }

                const maxMask = 1 << playerIds.length;
                for (let mask = 0; mask < maxMask; mask += 1) {
                    if (bitCount(mask) <= 2) {
                        choices.push({ seedling, sapling, divine, lifeSapTargetMask: mask });
                    }
                }
            }
        }
    }

    return choices.map(choice => {
        const selectedPlayerIds = getMaskPlayerIds(playerIds, choice.lifeSapTargetMask);
        const removed = choice.seedling + choice.sapling + choice.divine;
        return {
            value: encodeHarvestChoice(choice),
            customId: HARVEST_CHOICE_ID,
            labelKey: 'choices.treantHarvest.option',
            labelParams: {
                seedling: choice.seedling,
                sapling: choice.sapling,
                divine: choice.divine,
                cp: removed,
                targets: getChoicePlayerListLabel(ctx.state, selectedPlayerIds),
            },
        };
    });
}

function handleSaplingHealCp({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    return [
        {
            type: 'HEAL_APPLIED',
            payload: { targetId: attackerId, amount: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as HealAppliedEvent,
        {
            type: 'CP_CHANGED',
            payload: {
                playerId: attackerId,
                delta: currentCp >= CP_MAX ? 0 : 1,
                newValue: Math.min(currentCp + 1, CP_MAX),
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as CpChangedEvent,
    ];
}

function handleSaplingDraw({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    return buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId);
}

function closeoutNonAttackVariant(attackerId: string, timestamp: number): PendingAttackUpdatedEvent {
    return {
        type: 'PENDING_ATTACK_UPDATED',
        payload: {
            attackerId,
            patch: { isDefendable: false },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as PendingAttackUpdatedEvent;
}

function buildDirectDamageEvent(
    state: CustomActionContext['state'],
    sourceAbilityId: string,
    targetId: string,
    amount: number,
    timestamp: number,
): DamageDealtEvent {
    const targetHp = state.players[targetId]?.resources[RESOURCE_IDS.HP] ?? 0;
    return {
        type: 'DAMAGE_DEALT',
        payload: {
            targetId,
            amount,
            actualDamage: Math.min(amount, targetHp),
            sourceAbilityId,
            unblockable: true,
            damageScope: 'direct',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent;
}

function handleLifeSapUse({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const die = {
        index: 0,
        value,
        face,
        effectKey: 'bonusDie.effect.treantLifeSap',
        effectParams: { value, heal: Math.ceil(value / 2) },
    };

    return [
        {
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: attackerId,
                effectKey: 'bonusDie.effect.treantLifeSap',
                effectParams: { value, heal: Math.ceil(value / 2) },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as BonusDieRolledEvent,
        createDisplayOnlySettlement(sourceAbilityId, attackerId, attackerId, [die], timestamp + 1, {
            summaryEffectKey: 'bonusDie.effect.treantLifeSapResult',
            summaryEffectParams: { value, heal: Math.ceil(value / 2) },
            customResolutionId: TREANT_LIFE_SAP_SETTLEMENT_ID,
            continuation: { kind: 'complete' },
        }),
    ];
}

function handleWildGrowthChoice(ctx: CustomActionContext): DiceThroneEvent[] {
    const options = buildWildGrowthChoices(ctx);
    if (options.length <= 1) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantWildGrowth.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleShatteringFistChoice(ctx: CustomActionContext): DiceThroneEvent[] {
    const options = buildShatteringFistChoices(ctx);
    if (options.length <= 1) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantShatteringFist.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleShatteringFist3Cultivate(ctx: CustomActionContext): DiceThroneEvent[] {
    if (!hasThreeMatchingDieValues(ctx)) return [];
    const outcomes = enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), 1);
    if (outcomes.length === 0) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantShatteringFist.cultivateTitle',
            options: outcomes.map(outcome => ({
                value: encodeSpiritCounts(outcome),
                customId: SHATTERING_FIST_3_CULTIVATE_CHOICE_ID,
                labelKey: getCultivateLabelKey(outcome),
            })),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleQuietCultivation(ctx: CustomActionContext): DiceThroneEvent[] {
    const outcomes = enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), 1);
    if (outcomes.length === 0) return [];
    if (outcomes.length === 1) {
        return buildSpiritTransitionEvents(ctx, outcomes[0]);
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantQuietCultivation.title',
            options: outcomes.map(outcome => ({
                value: encodeSpiritCounts(outcome),
                customId: QUIET_CULTIVATION_CHOICE_ID,
                labelKey: getCultivateLabelKey(outcome),
            })),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleNatureTouchCultivate(ctx: CustomActionContext): DiceThroneEvent[] {
    const options = buildNatureTouchCultivateChoices(ctx);
    if (options.length === 0) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantCultivate.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleTendCareChoice(ctx: CustomActionContext): DiceThroneEvent[] {
    const options = buildTendCareChoices(ctx);
    if (options.length === 0) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantTendCare.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleForestAwakensChoice(ctx: CustomActionContext): DiceThroneEvent[] {
    const options = buildForestAwakensChoices(ctx);
    if (options.length === 0) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantForestAwakens.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleTendCare2Cultivate(ctx: CustomActionContext): DiceThroneEvent[] {
    const outcomes = enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), 6);
    if (outcomes.length === 0) {
        return [closeoutNonAttackVariant(ctx.attackerId, ctx.timestamp)];
    }
    if (outcomes.length === 1) {
        return [
            ...buildSpiritTransitionEvents(ctx, outcomes[0]),
            closeoutNonAttackVariant(ctx.attackerId, ctx.timestamp + 1),
        ];
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantCultivate.title',
            options: buildGenericCultivateChoices(ctx, 6, TEND_CARE_2_CULTIVATE_CHOICE_ID),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleNatureTouch2Mercy(ctx: CustomActionContext): DiceThroneEvent[] {
    if (!ctx.random) return [];
    const events: DiceThroneEvent[] = [];
    const currentHp = ctx.state.players[ctx.attackerId]?.resources[RESOURCE_IDS.HP] ?? 0;
    events.push({
        type: 'HEAL_APPLIED',
        payload: {
            targetId: ctx.attackerId,
            amount: 1,
            actualHealing: 1,
            sourceAbilityId: ctx.sourceAbilityId,
            oldValue: currentHp,
            newValue: currentHp + 1,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as HealAppliedEvent);

    const currentCp = ctx.state.players[ctx.attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    events.push({
        type: 'CP_CHANGED',
        payload: {
            playerId: ctx.attackerId,
            delta: currentCp >= CP_MAX ? 0 : 1,
            newValue: Math.min(currentCp + 1, CP_MAX),
            sourceAbilityId: ctx.sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp + 1,
    } as CpChangedEvent);

    events.push(...buildDrawEvents(ctx.state, ctx.attackerId, 1, ctx.random, 'ABILITY_EFFECT', ctx.timestamp + 2, ctx.sourceAbilityId));

    const outcomes = enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), 1);
    if (outcomes.length === 0) {
        events.push(closeoutNonAttackVariant(ctx.attackerId, ctx.timestamp + 3));
        return events;
    }
    if (outcomes.length === 1) {
        events.push(...buildSpiritTransitionEvents(ctx, outcomes[0]));
        events.push(closeoutNonAttackVariant(ctx.attackerId, ctx.timestamp + 4));
        return events;
    }

    events.push({
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantCultivate.title',
            options: buildGenericCultivateChoices(ctx, 1, NATURE_TOUCH_2_MERCY_CHOICE_ID),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp + 3,
    } as ChoiceRequestedEvent);
    return events;
}

function handleVengefulVines2Pain(ctx: CustomActionContext): DiceThroneEvent[] {
    const totalDamage = totalSpirits(getSpiritCounts(ctx));
    const events: DiceThroneEvent[] = [];
    if (ctx.targetId && totalDamage > 0) {
        events.push(buildDirectDamageEvent(ctx.state, ctx.sourceAbilityId, ctx.targetId, totalDamage, ctx.timestamp));
    }
    events.push(closeoutNonAttackVariant(ctx.attackerId, ctx.timestamp + 1));
    return events;
}

function handleWildGrowth2Main(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random } = ctx;
    if (!random) return [];

    const rollDice: Array<{ index: number; value: number; face: string; effectKey: string; effectParams: Record<string, number> }> = [];
    const events: DiceThroneEvent[] = [];

    for (let i = 0; i < 5; i += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        const effectKey = `bonusDie.effect.treantWildGrowth2.${face || 'other'}`;
        const effectParams = { value, index: i };
        rollDice.push({ index: i, value, face, effectKey, effectParams });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: ctx.targetId,
                effectKey,
                effectParams,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, ctx.targetId, rollDice, timestamp + 5, {
        summaryEffectKey: 'bonusDie.effect.treantWildGrowth2.result',
        summaryEffectParams: buildWildGrowth2SummaryParams(rollDice),
        customResolutionId: TREANT_WILD_GROWTH_2_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
    }));
    return events;
}

function handleCardCultivate(ctx: CustomActionContext): DiceThroneEvent[] {
    const amount = getCardCultivateAmount(ctx.action);
    const outcomes = enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), amount);
    if (outcomes.length === 0) return [];
    if (outcomes.length === 1) {
        return buildSpiritTransitionEvents(ctx, outcomes[0]);
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantCultivate.title',
            options: buildCardCultivateChoices(ctx, amount),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleDrinkDeep(ctx: CustomActionContext): DiceThroneEvent[] {
    const playerIds = getSeatingOrder(ctx.state);
    if (playerIds.length === 0) return [];
    if (playerIds.length === 1) {
        const currentLifeSap = ctx.state.players[playerIds[0]]?.tokens[TOKEN_IDS.LIFE_SAP] ?? 0;
        const maxLifeSap = getTokenStackLimit(ctx.state, playerIds[0], TOKEN_IDS.LIFE_SAP);
        return [{
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: playerIds[0],
                tokenId: TOKEN_IDS.LIFE_SAP,
                amount: Math.max(0, Math.min(currentLifeSap + 1, maxLifeSap) - currentLifeSap),
                newTotal: Math.min(currentLifeSap + 1, maxLifeSap),
                sourceAbilityId: ctx.sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp,
        } as TokenGrantedEvent];
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantDrinkDeep.title',
            options: playerIds.map((playerId, index) => ({
                value: index,
                customId: DRINK_DEEP_CHOICE_ID,
                labelKey: 'choices.treantDrinkDeep.option',
                labelParams: { player: getChoicePlayerLabel(ctx.state, playerId) },
            })),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleHarvest(ctx: CustomActionContext): DiceThroneEvent[] {
    const options = buildHarvestChoices(ctx);
    if (options.length === 0) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantHarvest.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleDownpour(ctx: CustomActionContext): DiceThroneEvent[] {
    const outcomes = enumerateDownpourOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx));
    if (outcomes.length === 0) return [];
    if (outcomes.length === 1) {
        return buildSpiritTransitionEvents(ctx, outcomes[0]);
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.treantDownpour.title',
            options: outcomes.map(outcome => ({
                value: encodeSpiritCounts(outcome),
                customId: DOWNPOUR_CHOICE_ID,
                labelKey: getCultivateLabelKey(outcome),
            })),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleTrample(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random } = ctx;
    if (!random) return [];

    const dice: Array<{ index: number; value: number; face: string; effectKey: string; effectParams: Record<string, number> }> = [];
    const events: DiceThroneEvent[] = [];

    for (let i = 0; i < 5; i += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        const effectKey = `bonusDie.effect.treantTrample.${face || 'other'}`;
        const effectParams = { value, index: i };
        dice.push({ index: i, value, face, effectKey, effectParams });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: ctx.targetId,
                effectKey,
                effectParams,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, ctx.targetId, dice, timestamp + 5, {
        summaryEffectKey: 'bonusDie.effect.treantTrample.result',
        customResolutionId: TREANT_TRAMPLE_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
    }));
    return events;
}

function handleSoulfire(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random } = ctx;
    if (!random) return [];

    const dice: Array<{ index: number; value: number; face: string; effectKey: string; effectParams: Record<string, number> }> = [];
    const events: DiceThroneEvent[] = [];

    for (let i = 0; i < 3; i += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        const effectKey = `bonusDie.effect.treantSoulfire.${face || 'other'}`;
        const effectParams = { value, index: i };
        dice.push({ index: i, value, face, effectKey, effectParams });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: ctx.targetId,
                effectKey,
                effectParams,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, ctx.targetId, dice, timestamp + 3, {
        summaryEffectKey: 'bonusDie.effect.treantSoulfire.result',
        customResolutionId: TREANT_SOULFIRE_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
    }));
    return events;
}

function handleMotherTree(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random } = ctx;
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const die = {
        index: 0,
        value,
        face,
        effectKey: `bonusDie.effect.treantMotherTree.${face || 'other'}`,
        effectParams: { value },
    };
    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: attackerId,
            effectKey: die.effectKey,
            effectParams: die.effectParams,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent, createDisplayOnlySettlement(sourceAbilityId, attackerId, attackerId, [die], timestamp + 1, {
        customResolutionId: TREANT_MOTHER_TREE_SETTLEMENT_ID,
        continuation: { kind: 'complete' },
    })];
    return events;
}

function handleRootedDefense(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random, action } = ctx;
    if (!random) return [];

    const diceCount = Math.max(1, Math.floor(action.diceCount ?? 3));
    const rollDice: Array<{ index: number; value: number; face: string; effectKey: string }> = [];
    const events: DiceThroneEvent[] = [];

    for (let i = 0; i < diceCount; i += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';

        rollDice.push({ index: i, value, face, effectKey: `bonusDie.effect.treantRooted.${face}` });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: attackerId,
                effectKey: `bonusDie.effect.treantRooted.${face}`,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, attackerId, rollDice, timestamp, {
        customResolutionId: TREANT_ROOTED_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'afterDefense', markBonusDiceResolved: false },
    }));
    return events;
}

registerChoiceEffectHandler(WILD_GROWTH_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    const player = state.players[playerId];
    if (!isExpectedChoiceSource(sourceAbilityId, WILD_GROWTH_SOURCE_IDS)) return undefined;
    if (!player || !matchesCurrentPendingAttackSource(state, playerId, sourceAbilityId)) return undefined;

    const choice = decodeWildGrowthChoice(value);
    const currentTokens = player.tokens ?? {};
    const removedTreeCount = choice.seedling + choice.sapling + choice.divine;
    if (
        choice.seedling > (currentTokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0)
        || choice.sapling > (currentTokens[TOKEN_IDS.TREANT_SAPLING] ?? 0)
        || choice.divine > (currentTokens[TOKEN_IDS.TREANT_DIVINE] ?? 0)
        || removedTreeCount > 2
        || (choice.lifeSap && (currentTokens[TOKEN_IDS.LIFE_SAP] ?? 0) <= 0)
    ) {
        return undefined;
    }

    const nextTokens = {
        ...currentTokens,
        [TOKEN_IDS.TREANT_SEEDLING]: (currentTokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0) - choice.seedling,
        [TOKEN_IDS.TREANT_SAPLING]: (currentTokens[TOKEN_IDS.TREANT_SAPLING] ?? 0) - choice.sapling,
        [TOKEN_IDS.TREANT_DIVINE]: (currentTokens[TOKEN_IDS.TREANT_DIVINE] ?? 0) - choice.divine,
        [TOKEN_IDS.LIFE_SAP]: (currentTokens[TOKEN_IDS.LIFE_SAP] ?? 0) - (choice.lifeSap ? 1 : 0),
    };

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: nextTokens,
            },
        },
        pendingAttack: {
            ...state.pendingAttack,
            bonusDamage: (state.pendingAttack.bonusDamage ?? 0) + removedTreeCount * 4,
            isDefendable: choice.lifeSap ? false : state.pendingAttack.isDefendable,
            offensiveRollEndTokenResolved: true,
        },
    };
});

registerChoiceEffectHandler(SHATTERING_FIST_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    const player = state.players[playerId];
    if (!isExpectedChoiceSource(sourceAbilityId, SHATTERING_FIST_SOURCE_IDS)) return undefined;
    if (!matchesCurrentPendingAttackSource(state, playerId, sourceAbilityId)) return undefined;
    const thornTargetId = state.pendingAttack?.defenderId ?? getOpponents(state, playerId)[0];
    if (!player || !thornTargetId) return undefined;

    const choice = decodeShatteringFistChoice(value);
    const removedSpiritCount = choice.seedling + choice.sapling + choice.divine;
    if (removedSpiritCount === 0) return {};
    if (removedSpiritCount !== 1) return undefined;

    const currentTokens = player.tokens ?? {};
    if (
        choice.seedling > (currentTokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0)
        || choice.sapling > (currentTokens[TOKEN_IDS.TREANT_SAPLING] ?? 0)
        || choice.divine > (currentTokens[TOKEN_IDS.TREANT_DIVINE] ?? 0)
    ) {
        return undefined;
    }

    const nextPlayers = {
        ...state.players,
        [playerId]: {
            ...player,
            tokens: {
                ...currentTokens,
                [TOKEN_IDS.TREANT_SEEDLING]: (currentTokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0) - choice.seedling,
                [TOKEN_IDS.TREANT_SAPLING]: (currentTokens[TOKEN_IDS.TREANT_SAPLING] ?? 0) - choice.sapling,
                [TOKEN_IDS.TREANT_DIVINE]: (currentTokens[TOKEN_IDS.TREANT_DIVINE] ?? 0) - choice.divine,
            },
        },
    };

    const thornTarget = nextPlayers[thornTargetId];
    if (thornTarget) {
        const currentThorn = thornTarget.tokens[TOKEN_IDS.THORN] ?? 0;
        const maxThorn = getTokenStackLimit(state, thornTargetId, TOKEN_IDS.THORN);
        nextPlayers[thornTargetId] = {
            ...thornTarget,
            tokens: {
                ...thornTarget.tokens,
                [TOKEN_IDS.THORN]: Math.min(currentThorn + 1, maxThorn),
            },
        };
    }

    return { players: nextPlayers };
});

registerChoiceEffectHandler(NATURE_TOUCH_CULTIVATE_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    const player = state.players[playerId];
    if (!isExpectedChoiceSource(sourceAbilityId, NATURE_TOUCH_SOURCE_IDS)) return undefined;
    if (!player || !matchesCurrentPendingAttackSource(state, playerId, sourceAbilityId)) return undefined;

    const choice = decodeSpiritCounts(value);
    const ctx: TreantSpiritContext = { attackerId: playerId, state };
    const legalOutcomes = enumerateCultivateOutcomes(
        getSpiritCounts(ctx),
        getSpiritLimits(ctx),
        NATURE_TOUCH_CULTIVATE_AMOUNT,
    );
    const isLegal = legalOutcomes.some(outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice));
    if (!isLegal) return undefined;

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: {
                    ...player.tokens,
                    [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                    [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                    [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
                },
            },
        },
        pendingAttack: {
            ...state.pendingAttack,
            bonusDamage: (state.pendingAttack.bonusDamage ?? 0) + totalSpirits(choice),
        },
    };
});

registerChoiceEffectHandler(SHATTERING_FIST_3_CULTIVATE_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    const player = state.players[playerId];
    if (!isExpectedChoiceSource(sourceAbilityId, SHATTERING_FIST_3_CULTIVATE_SOURCE_IDS)) return undefined;
    if (!matchesCurrentPendingAttackSource(state, playerId, sourceAbilityId)) return undefined;
    if (!player) return undefined;

    const choice = decodeSpiritCounts(value);
    const ctx: TreantSpiritContext = { attackerId: playerId, state };
    const legalOutcomes = enumerateCultivateOutcomes(
        getSpiritCounts(ctx),
        getSpiritLimits(ctx),
        1,
    );
    const isLegal = legalOutcomes.some(outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice));
    if (!isLegal) return undefined;

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: {
                    ...player.tokens,
                    [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                    [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                    [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
                },
            },
        },
    };
});

registerChoiceEffectHandler(QUIET_CULTIVATION_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    const player = state.players[playerId];
    if (!isExpectedChoiceSource(sourceAbilityId, QUIET_CULTIVATION_SOURCE_IDS)) return undefined;
    if (!matchesCurrentChoiceSource(state, sourceAbilityId)) return undefined;
    if (state.activePlayerId !== playerId) return undefined;
    if (!player) return undefined;

    const choice = decodeSpiritCounts(value);
    const ctx: TreantSpiritContext = { attackerId: playerId, state };
    const legalOutcomes = enumerateCultivateOutcomes(
        getSpiritCounts(ctx),
        getSpiritLimits(ctx),
        1,
    );
    const isLegal = legalOutcomes.some(outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice));
    if (!isLegal) return undefined;

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: {
                    ...player.tokens,
                    [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                    [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                    [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
                },
            },
        },
    };
});

const resolveRootedChoice = ({ state, playerId, value, sourceAbilityId, customId }: {
    state: CustomActionContext['state'];
    playerId: string;
    value?: number;
    sourceAbilityId?: string;
    customId: string;
}) => {
    const player = state.players[playerId];
    if (!player) return undefined;
    if (!isExpectedChoiceSource(sourceAbilityId, ROOTED_SOURCE_IDS)) return undefined;
    if (!matchesCurrentChoiceSource(state, sourceAbilityId)) return undefined;
    if (!state.pendingAttack || state.pendingAttack.defenderId !== playerId) return undefined;

    const rootedSettlement = state.pendingBonusDiceSettlement;
    let needsCultivate: boolean;
    let needsLifeSap: boolean;
    if (rootedSettlement) {
        if (rootedSettlement.sourceAbilityId !== 'rooted') return undefined;
        if (rootedSettlement.attackerId !== playerId || rootedSettlement.targetId !== playerId) return undefined;
        const rootedDice = getPendingBonusSettlementDice(rootedSettlement);
        needsCultivate = rootedDice.filter(die => die.face === TREANT_DICE_FACE_IDS.LEAF).length >= 2;
        needsLifeSap = rootedDice.filter(die => die.face === TREANT_DICE_FACE_IDS.SPIRIT).length >= 2;
    } else {
        const choiceContext = state.currentChoiceContext;
        if (typeof choiceContext?.requiresCultivate !== 'boolean'
            || typeof choiceContext.requiresLifeSap !== 'boolean') return undefined;
        needsCultivate = choiceContext.requiresCultivate;
        needsLifeSap = choiceContext.requiresLifeSap;
    }

    const choice = decodeRootedChoice(value);
    const ctx: TreantSpiritContext = { attackerId: playerId, state };
    const legalCultivateOutcomes = enumerateCultivateOutcomes(
        getSpiritCounts(ctx),
        getSpiritLimits(ctx),
        1,
    );
    const currentCounts = getSpiritCounts(ctx);
    const isCultivateOutcome = legalCultivateOutcomes.some(
        outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice),
    );
    const keepsCurrentCounts = encodeSpiritCounts(currentCounts) === encodeSpiritCounts(choice);
    if (choice.requiresCultivate !== needsCultivate) return undefined;
    if (choice.requiresLifeSap !== needsLifeSap) return undefined;
    if (choice.requiresCultivate) {
        if (!isCultivateOutcome) return undefined;
    } else if (!keepsCurrentCounts) {
        return undefined;
    }

    const playerIds = getRootedLifeSapTargetIds(state, playerId);
    if (choice.requiresLifeSap) {
        if (choice.lifeSapTargetIndex < 0 || choice.lifeSapTargetIndex >= playerIds.length) return undefined;
    } else if (choice.lifeSapTargetIndex !== -1) {
        return undefined;
    }
    const lifeSapTargetId = playerIds[choice.lifeSapTargetIndex];
    const nextPlayers = {
        ...state.players,
        [playerId]: {
            ...player,
            tokens: {
                ...player.tokens,
                [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
            },
        },
    };

    if (choice.lifeSapTargetIndex >= 0 && lifeSapTargetId) {
        const target = nextPlayers[lifeSapTargetId];
        const currentLifeSap = target.tokens[TOKEN_IDS.LIFE_SAP] ?? 0;
        const maxLifeSap = getTokenStackLimit(state, lifeSapTargetId, TOKEN_IDS.LIFE_SAP);
        nextPlayers[lifeSapTargetId] = {
            ...target,
            tokens: {
                ...target.tokens,
                [TOKEN_IDS.LIFE_SAP]: Math.min(currentLifeSap + 1, maxLifeSap),
            },
        };
    }

    return { players: nextPlayers };
};

registerChoiceEffectHandler(ROOTED_CHOICE_ID, resolveRootedChoice);

registerChoiceEffectHandler(FOREST_AWAKENS_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    const player = state.players[playerId];
    if (!isExpectedChoiceSource(sourceAbilityId, FOREST_AWAKENS_SOURCE_IDS)) return undefined;
    if (!matchesCurrentPendingAttackSource(state, playerId, sourceAbilityId)) return undefined;
    if (!player) return undefined;

    const choice = decodeSpiritCounts(value);
    const ctx: TreantSpiritContext = { attackerId: playerId, state };
    const legalOutcomes = enumerateCultivateOutcomes(
        getSpiritCounts(ctx),
        getSpiritLimits(ctx),
        FOREST_AWAKENS_CULTIVATE_AMOUNT,
    );
    const isLegal = legalOutcomes.some(outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice));
    if (!isLegal) return undefined;

    const teammateId = getTeammateId(state, playerId);
    const thornTargetId = state.pendingAttack?.defenderId ?? getOpponents(state, playerId)[0];
    if (!thornTargetId) return undefined;

    const nextPlayers = {
        ...state.players,
        [playerId]: {
            ...player,
            tokens: {
                ...player.tokens,
                [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
            },
        },
    };

    for (const targetId of [playerId, teammateId].filter((id): id is string => !!id)) {
        const target = nextPlayers[targetId];
        if (!target) continue;
        const currentLifeSap = target.tokens[TOKEN_IDS.LIFE_SAP] ?? 0;
        const maxLifeSap = getTokenStackLimit(state, targetId, TOKEN_IDS.LIFE_SAP);
        nextPlayers[targetId] = {
            ...target,
            tokens: {
                ...target.tokens,
                [TOKEN_IDS.LIFE_SAP]: Math.min(currentLifeSap + 1, maxLifeSap),
            },
        };
    }

    const thornTarget = nextPlayers[thornTargetId];
    if (thornTarget) {
        const currentThorn = thornTarget.tokens[TOKEN_IDS.THORN] ?? 0;
        const maxThorn = getTokenStackLimit(state, thornTargetId, TOKEN_IDS.THORN);
        nextPlayers[thornTargetId] = {
            ...thornTarget,
            tokens: {
                ...thornTarget.tokens,
                [TOKEN_IDS.THORN]: Math.min(currentThorn + 1, maxThorn),
            },
        };
    }

    return { players: nextPlayers };
});

function resolveCardCultivateChoice(amount: number) {
    return ({
        state,
        playerId,
        value,
        sourceAbilityId,
        customId,
    }: {
        state: CustomActionContext['state'];
        playerId: string;
        value?: number;
        sourceAbilityId?: string;
        customId: string;
    }) => {
        const player = state.players[playerId];
        if (!isExpectedChoiceSource(sourceAbilityId, CARD_CULTIVATE_SOURCE_IDS)) return undefined;
        if (!matchesCurrentChoiceSource(state, sourceAbilityId)) return undefined;
        if (!CARD_CULTIVATE_ALLOWED_AMOUNTS_BY_SOURCE[sourceAbilityId].includes(amount)) return undefined;
        if (state.activePlayerId !== playerId) return undefined;
        if (!player) return undefined;
        if (getCurrentCardCultivateAmount(state, playerId, sourceAbilityId, customId) !== amount) return undefined;

        const choice = decodeSpiritCounts(value);
        const ctx: TreantSpiritContext = { attackerId: playerId, state };
        const legalOutcomes = enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), amount);
        const isLegal = legalOutcomes.some(outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice));
        if (!isLegal) return undefined;

        return {
            players: {
                ...state.players,
                [playerId]: {
                    ...player,
                    tokens: {
                        ...player.tokens,
                        [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                        [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                        [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
                    },
                },
            },
        };
    };
}

registerChoiceEffectHandler(DRINK_DEEP_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    if (!isExpectedChoiceSource(sourceAbilityId, DRINK_DEEP_SOURCE_IDS)) return undefined;
    if (!matchesCurrentChoiceSource(state, sourceAbilityId)) return undefined;
    if (state.activePlayerId !== playerId) return undefined;
    const playerIds = getSeatingOrder(state);
    const targetIndex = Number.isFinite(value) ? Math.floor(value as number) : -1;
    if (targetIndex < 0 || targetIndex >= playerIds.length) return undefined;
    const targetId = playerIds[targetIndex];
    const target = targetId ? state.players[targetId] : undefined;
    if (!targetId || !target) return undefined;

    const currentLifeSap = target.tokens[TOKEN_IDS.LIFE_SAP] ?? 0;
    const maxLifeSap = getTokenStackLimit(state, targetId, TOKEN_IDS.LIFE_SAP);
    return {
        players: {
            ...state.players,
            [targetId]: {
                ...target,
                tokens: {
                    ...target.tokens,
                    [TOKEN_IDS.LIFE_SAP]: Math.min(currentLifeSap + 1, maxLifeSap),
                },
            },
        },
    };
});

registerChoiceEffectHandler(HARVEST_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    const player = state.players[playerId];
    if (!isExpectedChoiceSource(sourceAbilityId, HARVEST_SOURCE_IDS)) return undefined;
    if (!matchesCurrentChoiceSource(state, sourceAbilityId)) return undefined;
    if (state.activePlayerId !== playerId) return undefined;
    if (!player) return undefined;

    const choice = decodeHarvestChoice(value);
    const current = getSpiritCounts({ attackerId: playerId, state });
    const removed = choice.seedling + choice.sapling + choice.divine;
    const playerIds = getSeatingOrder(state);
    const maxMask = 1 << playerIds.length;
    if (
        choice.seedling > current.seedling
        || choice.sapling > current.sapling
        || choice.divine > current.divine
        || removed > 3
        || (removed < 2 && choice.lifeSapTargetMask !== 0)
        || bitCount(choice.lifeSapTargetMask) > 2
        || choice.lifeSapTargetMask >= maxMask
    ) {
        return undefined;
    }

    const selectedTargetIds = getMaskPlayerIds(playerIds, choice.lifeSapTargetMask);
    const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
    const nextPlayers = {
        ...state.players,
        [playerId]: {
            ...player,
            resources: {
                ...player.resources,
                [RESOURCE_IDS.CP]: Math.min(currentCp + removed, CP_MAX),
            },
            tokens: {
                ...player.tokens,
                [TOKEN_IDS.TREANT_SEEDLING]: current.seedling - choice.seedling,
                [TOKEN_IDS.TREANT_SAPLING]: current.sapling - choice.sapling,
                [TOKEN_IDS.TREANT_DIVINE]: current.divine - choice.divine,
            },
        },
    };

    for (const targetId of selectedTargetIds) {
        const target = nextPlayers[targetId];
        if (!target) return undefined;
        const currentLifeSap = target.tokens[TOKEN_IDS.LIFE_SAP] ?? 0;
        const maxLifeSap = getTokenStackLimit(state, targetId, TOKEN_IDS.LIFE_SAP);
        nextPlayers[targetId] = {
            ...target,
            tokens: {
                ...target.tokens,
                [TOKEN_IDS.LIFE_SAP]: Math.min(currentLifeSap + 1, maxLifeSap),
            },
        };
    }

    return { players: nextPlayers };
});

registerChoiceEffectHandler(DOWNPOUR_CHOICE_ID, ({ state, playerId, value, sourceAbilityId }) => {
    const player = state.players[playerId];
    if (!isExpectedChoiceSource(sourceAbilityId, DOWNPOUR_SOURCE_IDS)) return undefined;
    if (!matchesCurrentChoiceSource(state, sourceAbilityId)) return undefined;
    if (state.activePlayerId !== playerId) return undefined;
    if (!player) return undefined;

    const choice = decodeSpiritCounts(value);
    const ctx: TreantSpiritContext = { attackerId: playerId, state };
    const legalOutcomes = enumerateDownpourOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx));
    const isLegal = legalOutcomes.some(outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice));
    if (!isLegal) return undefined;

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: {
                    ...player.tokens,
                    [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                    [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                    [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
                },
            },
        },
    };
});

function resolveCultivateOnlyChoice(
    expectedSourceIds: readonly string[],
    amount: number,
    opts?: { closeout?: boolean; bonusDamageBySpiritCount?: boolean },
) {
    return ({
        state,
        playerId,
        value,
        sourceAbilityId,
    }: {
        state: CustomActionContext['state'];
        playerId: string;
        value?: number;
        sourceAbilityId?: string;
    }) => {
        const player = state.players[playerId];
        if (!isExpectedChoiceSource(sourceAbilityId, expectedSourceIds)) return undefined;
        if (!matchesCurrentChoiceSource(state, sourceAbilityId)) return undefined;
        if (state.activePlayerId !== playerId) return undefined;
        if (!player) return undefined;
        const expectedAmount = state.currentChoiceContext?.expectedCultivateAmount;
        if (typeof expectedAmount === 'number' && expectedAmount !== amount) return undefined;

        const choice = decodeSpiritCounts(value);
        const ctx: TreantSpiritContext = { attackerId: playerId, state };
        const legalOutcomes = enumerateCultivateOutcomes(
            getSpiritCounts(ctx),
            getSpiritLimits(ctx),
            amount,
        );
        const isLegal = legalOutcomes.some(outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice));
        if (!isLegal) return undefined;

        return {
            players: {
                ...state.players,
                [playerId]: {
                    ...player,
                    tokens: {
                        ...player.tokens,
                        [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                        [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                        [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
                    },
                },
            },
            ...(opts?.bonusDamageBySpiritCount && state.pendingAttack ? {
                pendingAttack: {
                    ...state.pendingAttack,
                    bonusDamage: (state.pendingAttack.bonusDamage ?? 0) + totalSpirits(choice),
                },
            } : {}),
            ...(opts?.closeout && state.pendingAttack ? {
                pendingAttack: {
                    ...(opts?.bonusDamageBySpiritCount
                        ? {
                            ...state.pendingAttack,
                            bonusDamage: (state.pendingAttack.bonusDamage ?? 0) + totalSpirits(choice),
                        }
                        : state.pendingAttack),
                    isDefendable: false,
                },
            } : {}),
        };
    };
}

function resolveTendCareChoice(amount: number) {
    return ({
        state,
        playerId,
        value,
        sourceAbilityId,
    }: {
        state: CustomActionContext['state'];
        playerId: string;
        value?: number;
        sourceAbilityId?: string;
    }) => {
        const player = state.players[playerId];
        if (!isExpectedChoiceSource(sourceAbilityId, TEND_CARE_SOURCE_IDS)) return undefined;
        if (!matchesCurrentChoiceSource(state, sourceAbilityId)) return undefined;
        if (state.activePlayerId !== playerId) return undefined;
        if (!player) return undefined;
        if (getCurrentTendCareCultivateAmount(state, playerId, sourceAbilityId) !== amount) return undefined;

        const choice = decodeTendCareChoice(value);
        const ctx: TreantSpiritContext = { attackerId: playerId, state };
        const legalOutcomes = enumerateCultivateOutcomes(
            getSpiritCounts(ctx),
            getSpiritLimits(ctx),
            amount,
        );
        const isLegal = legalOutcomes.some(outcome => encodeSpiritCounts(outcome) === encodeSpiritCounts(choice));
        if (!isLegal) return undefined;

        const lifeSapTargetIds = getTendCareLifeSapTargetIds(state);
        const thornTargetIds = getOpponents(state, playerId);
        const lifeSapTargetId = lifeSapTargetIds[choice.lifeSapTargetIndex];
        const thornTargetId = thornTargetIds[choice.thornTargetIndex];
        if (!lifeSapTargetId || !thornTargetId) return undefined;

        const nextPlayers = {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: {
                    ...player.tokens,
                    [TOKEN_IDS.TREANT_SEEDLING]: choice.seedling,
                    [TOKEN_IDS.TREANT_SAPLING]: choice.sapling,
                    [TOKEN_IDS.TREANT_DIVINE]: choice.divine,
                },
            },
        };

        const lifeSapTarget = nextPlayers[lifeSapTargetId];
        if (lifeSapTarget) {
            const currentLifeSap = lifeSapTarget.tokens[TOKEN_IDS.LIFE_SAP] ?? 0;
            const maxLifeSap = getTokenStackLimit(state, lifeSapTargetId, TOKEN_IDS.LIFE_SAP);
            nextPlayers[lifeSapTargetId] = {
                ...lifeSapTarget,
                tokens: {
                    ...lifeSapTarget.tokens,
                    [TOKEN_IDS.LIFE_SAP]: Math.min(currentLifeSap + 1, maxLifeSap),
                },
            };
        }

        const thornTarget = nextPlayers[thornTargetId];
        if (thornTarget) {
            const currentThorn = thornTarget.tokens[TOKEN_IDS.THORN] ?? 0;
            const maxThorn = getTokenStackLimit(state, thornTargetId, TOKEN_IDS.THORN);
            nextPlayers[thornTargetId] = {
                ...thornTarget,
                tokens: {
                    ...thornTarget.tokens,
                    [TOKEN_IDS.THORN]: Math.min(currentThorn + 1, maxThorn),
                },
            };
        }

        return { players: nextPlayers };
    };
}

function buildTreantCultivateChoiceOptions(
    state: CustomActionContext['state'],
    attackerId: string,
    amount: number,
    customId: string,
): ChoiceRequestedEvent['payload']['options'] {
    const ctx: TreantSpiritContext = { attackerId, state };
    return enumerateCultivateOutcomes(getSpiritCounts(ctx), getSpiritLimits(ctx), amount).map(outcome => ({
        value: encodeSpiritCounts(outcome),
        customId,
        labelKey: getCultivateLabelKey(outcome),
    }));
}

function buildTreantSpiritSettlementContext(
    state: CustomActionContext['state'],
    attackerId: string,
    sourceAbilityId: string,
    timestamp: number,
): TreantSpiritContext & { sourceAbilityId: string; timestamp: number } {
    return { attackerId, state, sourceAbilityId, timestamp };
}

function registerTreantBonusDiceSettlementHandlers(): void {
    registerBonusDiceSettlementHandler(TREANT_LIFE_SAP_SETTLEMENT_ID, ({ settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0, followupEvents: [] };
        return {
            totalDamage: 0,
            followupEvents: [{
                type: 'HEAL_APPLIED',
                payload: {
                    targetId: settlement.attackerId,
                    amount: Math.ceil(die.value / 2),
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as HealAppliedEvent],
        };
    });

    registerBonusDiceSettlementHandler(TREANT_WILD_GROWTH_2_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const dice = getPendingBonusSettlementDice(settlement);
        const branchCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.BRANCH).length;
        const leafCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.LEAF).length;
        const spiritCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.SPIRIT).length;
        const followupEvents: DiceThroneEvent[] = [];

        if (branchCount > 0) {
            followupEvents.push({
                type: 'BONUS_DAMAGE_ADDED',
                payload: {
                    playerId: settlement.attackerId,
                    amount: branchCount,
                    sourceCardId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as BonusDamageAddedEvent);
        }

        if (leafCount > 0) {
            const currentLifeSap = state.players[settlement.attackerId]?.tokens[TOKEN_IDS.LIFE_SAP] ?? 0;
            const maxLifeSap = getTokenStackLimit(state, settlement.attackerId, TOKEN_IDS.LIFE_SAP);
            const newTotal = Math.min(currentLifeSap + 1, maxLifeSap);
            followupEvents.push({
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId: settlement.attackerId,
                    tokenId: TOKEN_IDS.LIFE_SAP,
                    amount: Math.max(0, newTotal - currentLifeSap),
                    newTotal,
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp: timestamp + 1,
            } as TokenGrantedEvent);
        }

        if (spiritCount > 0) {
            const choiceId = WILD_GROWTH_2_CULTIVATE_CHOICE_ID_BY_AMOUNT[spiritCount];
            if (choiceId) {
                const options = buildTreantCultivateChoiceOptions(state, settlement.attackerId, spiritCount, choiceId);
                if (options.length === 1) {
                    followupEvents.push(...buildSpiritTransitionEvents(
                        buildTreantSpiritSettlementContext(state, settlement.attackerId, settlement.sourceAbilityId, timestamp + 2),
                        decodeSpiritCounts(options[0].value),
                    ));
                } else if (options.length > 1) {
                    followupEvents.push({
                        type: 'CHOICE_REQUESTED',
                        payload: {
                            playerId: settlement.attackerId,
                            sourceAbilityId: settlement.sourceAbilityId,
                            titleKey: 'choices.treantCultivate.title',
                            choiceContext: { expectedCultivateAmount: spiritCount },
                            options,
                        },
                        sourceCommandType: 'BONUS_DICE_SETTLED',
                        timestamp: timestamp + 2,
                    } as ChoiceRequestedEvent);
                }
            }
        }

        return { totalDamage: 0, followupEvents };
    });

    registerBonusDiceSettlementHandler(TREANT_TRAMPLE_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const branchCount = getPendingBonusSettlementDice(settlement)
            .filter(die => die.face === TREANT_DICE_FACE_IDS.BRANCH).length;
        const followupEvents: DiceThroneEvent[] = [];
        if (branchCount > 0) {
            followupEvents.push({
                type: 'BONUS_DAMAGE_ADDED',
                payload: {
                    playerId: settlement.attackerId,
                    amount: branchCount,
                    sourceCardId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as BonusDamageAddedEvent);
        }

        if (branchCount >= 3) {
            const thornTargetId = state.pendingAttack?.defenderId ?? settlement.targetId ?? getOpponents(state, settlement.attackerId)[0];
            if (thornTargetId) {
                const currentThorn = state.players[thornTargetId]?.tokens[TOKEN_IDS.THORN] ?? 0;
                const maxThorn = getTokenStackLimit(state, thornTargetId, TOKEN_IDS.THORN);
                const newTotal = Math.min(currentThorn + 1, maxThorn);
                followupEvents.push({
                    type: 'TOKEN_GRANTED',
                    payload: {
                        targetId: thornTargetId,
                        tokenId: TOKEN_IDS.THORN,
                        amount: Math.max(0, newTotal - currentThorn),
                        newTotal,
                        sourceAbilityId: settlement.sourceAbilityId,
                    },
                    sourceCommandType: 'BONUS_DICE_SETTLED',
                    timestamp: timestamp + 1,
                } as TokenGrantedEvent);
            }
        }

        return { totalDamage: 0, followupEvents };
    });

    registerBonusDiceSettlementHandler(TREANT_SOULFIRE_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const dice = getPendingBonusSettlementDice(settlement);
        const branchCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.BRANCH).length;
        const leafCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.LEAF).length;
        const spiritCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.SPIRIT).length;
        const followupEvents: DiceThroneEvent[] = [];

        if (branchCount > 0) {
            for (const [index, opponentId] of getOpponents(state, settlement.attackerId).entries()) {
                followupEvents.push(buildDirectDamageEvent(
                    state,
                    settlement.sourceAbilityId,
                    opponentId,
                    branchCount,
                    timestamp + index,
                ));
            }
        }

        if (leafCount > 0) {
            const currentLifeSap = state.players[settlement.attackerId]?.tokens[TOKEN_IDS.LIFE_SAP] ?? 0;
            const maxLifeSap = getTokenStackLimit(state, settlement.attackerId, TOKEN_IDS.LIFE_SAP);
            const newTotal = Math.min(currentLifeSap + leafCount, maxLifeSap);
            followupEvents.push({
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId: settlement.attackerId,
                    tokenId: TOKEN_IDS.LIFE_SAP,
                    amount: Math.max(0, newTotal - currentLifeSap),
                    newTotal,
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp: timestamp + 2,
            } as TokenGrantedEvent);
        }

        if (spiritCount > 0) {
            const choiceId = getCardCultivateChoiceId(Math.min(spiritCount, 4));
            const options = buildTreantCultivateChoiceOptions(state, settlement.attackerId, spiritCount, choiceId);
            if (options.length === 1) {
                followupEvents.push(...buildSpiritTransitionEvents(
                    buildTreantSpiritSettlementContext(state, settlement.attackerId, settlement.sourceAbilityId, timestamp + 3),
                    decodeSpiritCounts(options[0].value),
                ));
            } else if (options.length > 1) {
                followupEvents.push({
                    type: 'CHOICE_REQUESTED',
                    payload: {
                        playerId: settlement.attackerId,
                        sourceAbilityId: settlement.sourceAbilityId,
                        titleKey: 'choices.treantSoulfire.title',
                        choiceContext: { expectedCultivateAmount: spiritCount },
                        options,
                    },
                    sourceCommandType: 'BONUS_DICE_SETTLED',
                    timestamp: timestamp + 3,
                } as ChoiceRequestedEvent);
            }
        }

        return { totalDamage: 0, followupEvents };
    });

    registerBonusDiceSettlementHandler(TREANT_MOTHER_TREE_SETTLEMENT_ID, ({ state, settlement, timestamp, random }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0, followupEvents: [] };
        if (die.face !== TREANT_DICE_FACE_IDS.SPIRIT) {
            return {
                totalDamage: 0,
                followupEvents: random
                    ? buildDrawEvents(state, settlement.attackerId, 1, random, 'BONUS_DICE_SETTLED', timestamp, settlement.sourceAbilityId)
                    : [],
            };
        }

        const options = buildTreantCultivateChoiceOptions(
            state,
            settlement.attackerId,
            4,
            CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT[4],
        );
        if (options.length === 1) {
            return {
                totalDamage: 0,
                followupEvents: buildSpiritTransitionEvents(
                    buildTreantSpiritSettlementContext(state, settlement.attackerId, settlement.sourceAbilityId, timestamp + 1),
                    decodeSpiritCounts(options[0].value),
                ),
            };
        }
        return {
            totalDamage: 0,
            followupEvents: options.length > 1
                ? [{
                    type: 'CHOICE_REQUESTED',
                    payload: {
                        playerId: settlement.attackerId,
                        sourceAbilityId: settlement.sourceAbilityId,
                        titleKey: 'choices.treantMotherTree.title',
                        choiceContext: { expectedCultivateAmount: 4 },
                        options,
                    },
                    sourceCommandType: 'BONUS_DICE_SETTLED',
                    timestamp: timestamp + 1,
                } as ChoiceRequestedEvent]
                : [],
        };
    });

    registerBonusDiceSettlementHandler(TREANT_ROOTED_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const dice = getPendingBonusSettlementDice(settlement);
        const branchCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.BRANCH).length;
        const leafCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.LEAF).length;
        const spiritCount = dice.filter(die => die.face === TREANT_DICE_FACE_IDS.SPIRIT).length;
        const needsCultivate = leafCount >= 2;
        const needsLifeSap = spiritCount >= 2;
        const followupEvents: DiceThroneEvent[] = [];
        const originalAttackerId = state.pendingAttack?.attackerId;
        const preventAmount = branchCount + spiritCount;

        if (preventAmount > 0 && originalAttackerId) {
            followupEvents.push({
                type: 'PENDING_ATTACK_UPDATED',
                payload: {
                    attackerId: originalAttackerId,
                    patch: {
                        bonusDamage: (state.pendingAttack?.bonusDamage ?? 0) - preventAmount,
                    },
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as PendingAttackUpdatedEvent);
        }

        if (needsCultivate || needsLifeSap) {
            const cultivateOutcomes = needsCultivate
                ? enumerateCultivateOutcomes(
                    getSpiritCounts({ attackerId: settlement.attackerId, state }),
                    getSpiritLimits({ attackerId: settlement.attackerId, state }),
                    1,
                )
                : [getSpiritCounts({ attackerId: settlement.attackerId, state })];
            const playerIds = needsLifeSap
                ? getRootedLifeSapTargetIds(state, settlement.attackerId)
                : [settlement.attackerId];
            const options = cultivateOutcomes.flatMap(outcome => playerIds.map((_, targetIndex) => {
                const choice: RootedChoice = {
                    ...outcome,
                    lifeSapTargetIndex: needsLifeSap ? targetIndex : -1,
                    requiresCultivate: needsCultivate,
                    requiresLifeSap: needsLifeSap,
                };
                return {
                    value: encodeRootedChoice(choice),
                    customId: ROOTED_CHOICE_ID,
                    labelKey: getRootedChoiceLabelKey(choice, needsCultivate, needsLifeSap),
                };
            }));

            if (options.length > 0) {
                followupEvents.push({
                    type: 'CHOICE_REQUESTED',
                    payload: {
                        playerId: settlement.attackerId,
                        sourceAbilityId: settlement.sourceAbilityId,
                        titleKey: 'choices.treantRooted.title',
                        choiceContext: { requiresCultivate: needsCultivate, requiresLifeSap: needsLifeSap },
                        options,
                    },
                    sourceCommandType: 'BONUS_DICE_SETTLED',
                    timestamp: timestamp + 1,
                } as ChoiceRequestedEvent);
            }
        }

        return { totalDamage: 0, followupEvents };
    });
}

registerChoiceEffectHandler(CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT[1], resolveCardCultivateChoice(1));
registerChoiceEffectHandler(CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT[2], resolveCardCultivateChoice(2));
registerChoiceEffectHandler(CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT[3], resolveCardCultivateChoice(3));
registerChoiceEffectHandler(CARD_CULTIVATE_CHOICE_ID_BY_AMOUNT[4], resolveCardCultivateChoice(4));
registerChoiceEffectHandler(TEND_CARE_CHOICE_ID_BY_AMOUNT[3], resolveTendCareChoice(3));
registerChoiceEffectHandler(TEND_CARE_CHOICE_ID_BY_AMOUNT[4], resolveTendCareChoice(4));
registerChoiceEffectHandler(TEND_CARE_2_CULTIVATE_CHOICE_ID, resolveCultivateOnlyChoice(TEND_CARE_2_CULTIVATE_SOURCE_IDS, 6, { closeout: true }));
registerChoiceEffectHandler(NATURE_TOUCH_2_MERCY_CHOICE_ID, resolveCultivateOnlyChoice(NATURE_TOUCH_2_MERCY_SOURCE_IDS, 1, { closeout: true }));
registerChoiceEffectHandler(WILD_GROWTH_2_CULTIVATE_CHOICE_ID_BY_AMOUNT[1], resolveCultivateOnlyChoice(WILD_GROWTH_2_MAIN_SOURCE_IDS, 1));
registerChoiceEffectHandler(WILD_GROWTH_2_CULTIVATE_CHOICE_ID_BY_AMOUNT[2], resolveCultivateOnlyChoice(WILD_GROWTH_2_MAIN_SOURCE_IDS, 2));
registerChoiceEffectHandler(WILD_GROWTH_2_CULTIVATE_CHOICE_ID_BY_AMOUNT[3], resolveCultivateOnlyChoice(WILD_GROWTH_2_MAIN_SOURCE_IDS, 3));
registerChoiceEffectHandler(WILD_GROWTH_2_CULTIVATE_CHOICE_ID_BY_AMOUNT[4], resolveCultivateOnlyChoice(WILD_GROWTH_2_MAIN_SOURCE_IDS, 4));
registerChoiceEffectHandler(WILD_GROWTH_2_CULTIVATE_CHOICE_ID_BY_AMOUNT[5], resolveCultivateOnlyChoice(WILD_GROWTH_2_MAIN_SOURCE_IDS, 5));

export function registerTreantCustomActions(): void {
    registerTreantBonusDiceSettlementHandlers();
    registerCustomActionHandler('treant-sapling-heal-cp', handleSaplingHealCp, { categories: ['resource', 'token'] });
    registerCustomActionHandler('treant-sapling-draw', handleSaplingDraw, { categories: ['card', 'token'] });
    registerCustomActionHandler('treant-life-sap-use', handleLifeSapUse, { categories: ['dice', 'resource', 'token'] });
    registerCustomActionHandler('treant-shattering-fist-choice', handleShatteringFistChoice, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-shattering-fist-3-cultivate', handleShatteringFist3Cultivate, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-quiet-cultivation', handleQuietCultivation, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-rooted-defense', handleRootedDefense, {
        categories: ['dice', 'defense', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-nature-touch-cultivate', handleNatureTouchCultivate, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-tend-care-choice', handleTendCareChoice, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-forest-awakens-choice', handleForestAwakensChoice, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-tend-care-2-cultivate', handleTendCare2Cultivate, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-nature-touch-2-mercy', handleNatureTouch2Mercy, {
        categories: ['choice', 'resource', 'card', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-vengeful-vines-2-pain', handleVengefulVines2Pain, {
        categories: ['damage', 'token'],
        requiresSelectedDefender: true,
        estimateDamage: (state, playerId) => {
            const player = state.players?.[playerId] as { tokens?: Record<string, number> } | undefined;
            const tokens = player?.tokens ?? {};
            return (tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0)
                + (tokens[TOKEN_IDS.TREANT_SAPLING] ?? 0)
                + (tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0);
        },
    });
    registerCustomActionHandler('treant-wild-growth-2-main', handleWildGrowth2Main, {
        categories: ['dice', 'damage', 'token', 'choice'],
        requiresInteraction: true,
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('treant-wild-growth-choice', handleWildGrowthChoice, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-card-cultivate', handleCardCultivate, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-card-drink-deep', handleDrinkDeep, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-card-harvest', handleHarvest, {
        categories: ['choice', 'resource', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-card-downpour', handleDownpour, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('treant-card-trample-roll', handleTrample, {
        categories: ['dice', 'token'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('treant-card-soulfire-roll', handleSoulfire, {
        categories: ['dice', 'token'],
    });
    registerCustomActionHandler('treant-card-mother-tree-roll', handleMotherTree, {
        categories: ['dice', 'card', 'choice', 'token'],
        requiresInteraction: true,
    });
}
