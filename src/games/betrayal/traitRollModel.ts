import type { RandomFn } from '../../engine/types';
import { rollBetrayalDicePips } from './diceRules';
import type {
    BetrayalCore,
    BetrayalExplorerSummary,
    BetrayalTraitKey,
} from './game';
import { resolveInventoryEffectId } from './possessionEffects';

export interface BetrayalTraitRollResult {
    total: number;
    dice: number[];
    passiveBonus: number;
}

const TRAIT_CHECK_PASSIVE_BONUSES: Record<string, Partial<Record<BetrayalTraitKey, number>>> = {
    'omen-book': { knowledge: 1 },
    skull: { knowledge: 1 },
    dog: { speed: 1 },
    mask: { speed: 1 },
    'holy-symbol': { sanity: 1 },
    ring: { sanity: 1 },
    idol: { might: 1 },
};

const TRAIT_CHECK_REPLACEMENTS_BY_CARD_ID: Record<string, Partial<Record<BetrayalTraitKey, BetrayalTraitKey>>> = {
    camera: { knowledge: 'sanity' },
};

const EVENT_TRAIT_CHECK_EXTRA_DICE_BY_CARD_ID: Record<string, number> = {
    flashlight: 2,
    lantern: 2,
};

export function rollTrait(random: RandomFn, value: number): number {
    return rollBetrayalDicePips(random, value).reduce((sum, pip) => sum + pip, 0);
}

export function resolveTraitRollPassiveBonus(
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((total, cardId) => total + (TRAIT_CHECK_PASSIVE_BONUSES[cardId]?.[trait] ?? 0), 0);
}

export function resolveTraitCheckValue(
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((bestValue, cardId) => {
        const replacementTrait = TRAIT_CHECK_REPLACEMENTS_BY_CARD_ID[cardId]?.[trait];
        return replacementTrait
            ? Math.max(bestValue, explorer.traits[replacementTrait])
            : bestValue;
    }, explorer.traits[trait]);
}

export function resolveNonCombatTraitCheckValue(
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): number {
    const replacement = core.nextNonCombatTraitReplacement;
    if (
        replacement
        && replacement.playerId === explorer.playerId
        && trait !== replacement.replacementTrait
    ) {
        return Math.max(resolveTraitCheckValue(explorer, trait), explorer.traits[replacement.replacementTrait]);
    }
    return resolveTraitCheckValue(explorer, trait);
}

export function resolveRoomBlessingExtraDice(
    core: BetrayalCore | undefined,
    explorer: BetrayalExplorerSummary,
): number {
    const room = core?.rooms.find((candidate) => candidate.id === explorer.roomId);
    return room?.markerTokens?.includes('blessing') ? 1 : 0;
}

export function rollTraitCheckWithDice(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    core?: BetrayalCore,
): BetrayalTraitRollResult {
    const dice = rollBetrayalDicePips(random, resolveTraitCheckValue(explorer, trait) + resolveRoomBlessingExtraDice(core, explorer));
    const passiveBonus = resolveTraitRollPassiveBonus(explorer, trait);
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0) + passiveBonus,
        dice,
        passiveBonus,
    };
}

export function rollNonCombatTraitCheck(
    random: RandomFn,
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): number {
    const rollTotalReplacement = core.nextNonCombatTraitRollTotalReplacement;
    if (rollTotalReplacement?.playerId === explorer.playerId) {
        return rollTotalReplacement.selectedTotal + resolveTraitRollPassiveBonus(explorer, trait);
    }
    return rollTrait(random, resolveNonCombatTraitCheckValue(core, explorer, trait) + resolveRoomBlessingExtraDice(core, explorer))
        + resolveTraitRollPassiveBonus(explorer, trait);
}

export function rollNonCombatTraitCheckWithDice(
    random: RandomFn,
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): BetrayalTraitRollResult {
    const passiveBonus = resolveTraitRollPassiveBonus(explorer, trait);
    const rollTotalReplacement = core.nextNonCombatTraitRollTotalReplacement;
    if (rollTotalReplacement?.playerId === explorer.playerId) {
        return {
            total: rollTotalReplacement.selectedTotal + passiveBonus,
            dice: [rollTotalReplacement.selectedTotal],
            passiveBonus,
        };
    }
    const dice = rollBetrayalDicePips(random, resolveNonCombatTraitCheckValue(core, explorer, trait) + resolveRoomBlessingExtraDice(core, explorer));
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0) + passiveBonus,
        dice,
        passiveBonus,
    };
}

export function resolveEventTraitCheckExtraDice(explorer: BetrayalExplorerSummary): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((total, cardId) => total + (EVENT_TRAIT_CHECK_EXTRA_DICE_BY_CARD_ID[cardId] ?? 0), 0);
}

export function rollEventTraitCheckWithDice(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    core?: BetrayalCore,
): BetrayalTraitRollResult {
    const passiveBonus = resolveTraitRollPassiveBonus(explorer, trait);
    const rollTotalReplacement = core?.nextNonCombatTraitRollTotalReplacement;
    if (rollTotalReplacement?.playerId === explorer.playerId) {
        return {
            total: rollTotalReplacement.selectedTotal + passiveBonus,
            dice: [rollTotalReplacement.selectedTotal],
            passiveBonus,
        };
    }
    const diceCount = (core
        ? resolveNonCombatTraitCheckValue(core, explorer, trait)
        : resolveTraitCheckValue(explorer, trait))
        + resolveEventTraitCheckExtraDice(explorer)
        + resolveRoomBlessingExtraDice(core, explorer);
    const dice = rollBetrayalDicePips(random, diceCount);
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0) + passiveBonus,
        dice,
        passiveBonus,
    };
}
