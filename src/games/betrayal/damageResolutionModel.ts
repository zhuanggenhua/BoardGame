import type { RandomFn } from '../../engine/types';
import { rollBetrayalDicePips } from './diceRules';
import { cloneExplorerSummary } from './explorerReadModel';
import { HELPING_HANDS_STRANGE_AMULET_EFFECT_ID } from './hauntScenarioReadModel';
import { cloneMonsterMovementRollResult } from './monsterActionReadModel';
import { resolveInventoryEffectId } from './possessionEffects';
import {
    applyTraitLoss,
    BETRAYAL_TRAIT_KEYS,
    moveExplorerTraitSteps,
    normalizeExplorerTraitTracks,
    resolveTraitDamageAssignableSteps,
    setExplorerTraitPosition,
} from './traitTrackModel';
import type {
    BetrayalExplorerSummary,
    BetrayalMonsterMovementRollResult,
    BetrayalPendingDamageAllocationState,
    BetrayalTraitKey,
} from './game';

const BROOCH_CARD_ID = 'brooch';

const PHYSICAL_DAMAGE_REDUCTION_BY_CARD_ID: Record<string, number> = {
    armor: 1,
};

const MENTAL_DAMAGE_REDUCTION_BY_CARD_ID: Record<string, number> = {
    radio: 1,
};

const DEATH_PREVENTION_ROLL_CARDS_BY_ID: Record<string, { dice: number; minTotal: number }> = {
    skull: { dice: 3, minTotal: 4 },
};

export type BetrayalDeathPreventionRoll = {
    playerId: string;
    prevented: boolean;
    rollTotal: number;
    dice: number[];
    minTotal: number;
    cardId: string;
};

export function clonePendingDamageAllocation(
    pending: BetrayalPendingDamageAllocationState,
): BetrayalPendingDamageAllocationState {
    return {
        ...pending,
        allowedTraits: [...pending.allowedTraits],
        damageReplacement: pending.damageReplacement ? { ...pending.damageReplacement } : undefined,
        forcedTraitSequence: pending.forcedTraitSequence ? [...pending.forcedTraitSequence] : undefined,
        traitsBeforeDamage: { ...pending.traitsBeforeDamage },
        nextDamageAllocations: pending.nextDamageAllocations?.map(clonePendingDamageAllocation),
        monsterMovementRoll: pending.monsterMovementRoll
            ? cloneMonsterMovementRollResult(pending.monsterMovementRoll)
            : pending.monsterMovementRoll,
        skipBloodFromStoneMonsterTurnStart: pending.skipBloodFromStoneMonsterTurnStart,
    };
}

export function isExplorerDead(explorer: BetrayalExplorerSummary): boolean {
    normalizeExplorerTraitTracks(explorer);
    return BETRAYAL_TRAIT_KEYS.some((trait) => {
        const track = explorer.traitTracks[trait];
        return track.position <= track.skullPosition;
    });
}

function resolvePhysicalDamageReduction(explorer: BetrayalExplorerSummary): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((total, cardId) => total + (PHYSICAL_DAMAGE_REDUCTION_BY_CARD_ID[cardId] ?? 0), 0);
}

function resolveMentalDamageReduction(explorer: BetrayalExplorerSummary): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((total, cardId) => total + (MENTAL_DAMAGE_REDUCTION_BY_CARD_ID[cardId] ?? 0), 0);
}

export function applyPhysicalDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    options: { allowSkull?: boolean } = {},
): number {
    const applied = applyTraitLoss(explorer, ['might', 'speed'], Math.max(0, amount - resolvePhysicalDamageReduction(explorer)), options);
    if (applied > 0) {
        applyStrangeAmuletPhysicalDamageBonus(explorer);
    }
    return applied;
}

export function applyMentalDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    options: { allowSkull?: boolean } = {},
): number {
    return applyTraitLoss(explorer, ['knowledge', 'sanity'], Math.max(0, amount - resolveMentalDamageReduction(explorer)), options);
}

export function applyStrangeAmuletPhysicalDamageBonus(explorer: BetrayalExplorerSummary): void {
    const hasStrangeAmulet = explorer.inventory.some((card) => resolveInventoryEffectId(card.id) === HELPING_HANDS_STRANGE_AMULET_EFFECT_ID);
    if (hasStrangeAmulet) {
        moveExplorerTraitSteps(explorer, 'sanity', 1, { allowSkull: true });
    }
}

export function applyAttackDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    damageKind: 'physical' | 'mental',
): void {
    if (damageKind === 'mental') {
        applyMentalDamage(explorer, amount, { allowSkull: true });
        return;
    }
    applyPhysicalDamage(explorer, amount, { allowSkull: true });
}

export function setExplorerTraitsToDeathsDoor(explorer: BetrayalExplorerSummary): void {
    normalizeExplorerTraitTracks(explorer);
    for (const trait of BETRAYAL_TRAIT_KEYS) {
        setExplorerTraitPosition(explorer, trait, explorer.traitTracks[trait].criticalPosition);
    }
}

export function repeatTraitForDamage(trait: BetrayalTraitKey, amount: number): BetrayalTraitKey[] {
    return Array.from({ length: Math.max(0, amount) }, () => trait);
}

export function wouldExplorerDieFromPhysicalDamage(explorer: BetrayalExplorerSummary, amount: number): boolean {
    if (amount <= 0) {
        return false;
    }
    const preview = cloneExplorerSummary(explorer);
    applyPhysicalDamage(preview, amount, { allowSkull: true });
    return isExplorerDead(preview);
}

export function wouldExplorerDieFromMentalDamage(explorer: BetrayalExplorerSummary, amount: number): boolean {
    if (amount <= 0) {
        return false;
    }
    const preview = cloneExplorerSummary(explorer);
    applyMentalDamage(preview, amount, { allowSkull: true });
    return isExplorerDead(preview);
}

export function wouldExplorerDieFromAttackDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    damageKind: 'physical' | 'mental',
): boolean {
    return damageKind === 'mental'
        ? wouldExplorerDieFromMentalDamage(explorer, amount)
        : wouldExplorerDieFromPhysicalDamage(explorer, amount);
}

export function resolveDeathPreventionRollCardId(explorer: BetrayalExplorerSummary): string | null {
    return explorer.inventory
        .map((card) => resolveInventoryEffectId(card.id))
        .find((cardId) => Boolean(DEATH_PREVENTION_ROLL_CARDS_BY_ID[cardId]))
        ?? null;
}

export function rollDeathPrevention(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
): BetrayalDeathPreventionRoll | null {
    const cardId = resolveDeathPreventionRollCardId(explorer);
    if (!cardId) {
        return null;
    }
    const config = DEATH_PREVENTION_ROLL_CARDS_BY_ID[cardId]!;
    const dice = rollBetrayalDicePips(random, config.dice);
    const rollTotal = dice.reduce((sum, pip) => sum + pip, 0);
    return {
        playerId: explorer.playerId,
        cardId,
        dice,
        minTotal: config.minTotal,
        rollTotal,
        prevented: rollTotal >= config.minTotal,
    };
}

export function formatDeathPreventionLog(deathPrevention: {
    cardId: string;
    rollTotal: number;
    prevented: boolean;
} | null | undefined): string {
    if (!deathPrevention) {
        return '';
    }
    const cardName = deathPrevention.cardId === 'skull' ? '头骨' : deathPrevention.cardId;
    return deathPrevention.prevented
        ? `；${cardName}投出 ${deathPrevention.rollTotal}，阻止死亡并将所有属性调至濒死`
        : `；${cardName}投出 ${deathPrevention.rollTotal}，正常死亡`;
}

export function resolveDamageAllocationAllowedTraits(damageKind: BetrayalPendingDamageAllocationState['damageKind']): BetrayalTraitKey[] {
    if (damageKind === 'physical') {
        return ['might', 'speed'];
    }
    if (damageKind === 'mental') {
        return ['knowledge', 'sanity'];
    }
    return ['might', 'speed', 'knowledge', 'sanity'];
}

function resolveReducedDamageAmount(
    explorer: BetrayalExplorerSummary,
    damageKind: BetrayalPendingDamageAllocationState['damageKind'],
    amount: number,
): number {
    if (damageKind === 'physical') {
        return Math.max(0, amount - resolvePhysicalDamageReduction(explorer));
    }
    if (damageKind === 'mental') {
        return Math.max(0, amount - resolveMentalDamageReduction(explorer));
    }
    return Math.max(0, amount);
}

export function resolveAssignableDamageAmount(
    explorer: BetrayalExplorerSummary,
    allowedTraits: BetrayalTraitKey[],
    amount: number,
    options: { allowSkull?: boolean } = {},
): number {
    const assignableSteps = allowedTraits.reduce(
        (total, trait) => total + resolveTraitDamageAssignableSteps(explorer, trait, options),
        0,
    );
    return Math.min(Math.max(0, amount), assignableSteps);
}

export function createPendingDamageAllocation(params: {
    id: string;
    explorer: BetrayalExplorerSummary;
    sourceTitle: string;
    damageKind: BetrayalPendingDamageAllocationState['damageKind'];
    amount: number;
    allowSkull?: boolean;
    forcedTraitSequence?: BetrayalTraitKey[];
    nextPlayerId?: string;
    nextDamageAllocations?: BetrayalPendingDamageAllocationState[];
    monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
    turnLogText?: string;
    helpingHandsMonsterTurnControllerPlayerId?: string;
    skipBloodFromStoneMonsterTurnStart?: boolean;
}): BetrayalPendingDamageAllocationState | null {
    const allowedTraits = resolveDamageAllocationAllowedTraits(params.damageKind);
    const reducedAmount = resolveReducedDamageAmount(params.explorer, params.damageKind, params.amount);
    const damageReductionAmount = Math.max(0, params.amount - reducedAmount);
    const assignableAmount = resolveAssignableDamageAmount(
        params.explorer,
        allowedTraits,
        reducedAmount,
        { allowSkull: params.allowSkull },
    );
    if (assignableAmount <= 0) {
        return null;
    }
    return {
        id: params.id,
        playerId: params.explorer.playerId,
        sourceTitle: params.sourceTitle,
        damageKind: params.damageKind,
        amount: assignableAmount,
        originalAmount: params.amount,
        damageReductionAmount,
        allowedTraits,
        damageReplacement: resolveBroochDamageReplacement(params.explorer, params.damageKind),
        forcedTraitSequence: params.forcedTraitSequence
            ? [...params.forcedTraitSequence].slice(0, assignableAmount)
            : undefined,
        allowSkull: Boolean(params.allowSkull),
        traitsBeforeDamage: { ...params.explorer.traits },
        nextPlayerId: params.nextPlayerId,
        nextDamageAllocations: params.nextDamageAllocations?.map(clonePendingDamageAllocation),
        monsterMovementRoll: params.monsterMovementRoll,
        turnLogText: params.turnLogText,
        helpingHandsMonsterTurnControllerPlayerId: params.helpingHandsMonsterTurnControllerPlayerId,
        skipBloodFromStoneMonsterTurnStart: params.skipBloodFromStoneMonsterTurnStart,
    };
}

export function chainPendingDamageAllocations(
    allocations: BetrayalPendingDamageAllocationState[],
): BetrayalPendingDamageAllocationState | null {
    const [first, ...rest] = allocations.map(clonePendingDamageAllocation);
    if (!first) {
        return null;
    }
    return {
        ...first,
        nextDamageAllocations: rest,
    };
}

function resolveBroochDamageReplacement(
    explorer: BetrayalExplorerSummary,
    damageKind: BetrayalPendingDamageAllocationState['damageKind'],
): BetrayalPendingDamageAllocationState['damageReplacement'] {
    if (damageKind === 'general') {
        return undefined;
    }
    const card = explorer.inventory.find((inventoryCard) => resolveInventoryEffectId(inventoryCard.id) === BROOCH_CARD_ID);
    return card
        ? {
            kind: 'brooch-general-damage',
            cardId: card.id,
            cardName: card.name,
        }
        : undefined;
}
