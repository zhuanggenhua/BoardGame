import type {
    BetrayalRecommendedAction,
    BetrayalTraitKey,
    BetrayalUseEffectSeed,
} from './scenarioConfig';

export type UseEffectProfile = BetrayalUseEffectSeed;

export type PossessionUseEffectProfile = UseEffectProfile | {
    mode: 'nextNonCombatTraitReplacement';
    replacementTrait: BetrayalTraitKey;
    sanityCost: number;
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'healTraits';
    traits: BetrayalTraitKey[];
    consumeOnUse: boolean;
    target: 'self' | 'selfOrSameRoomExplorer';
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'placeExplorer';
    target: 'anyDiscoveredRoom';
    consumeOnUse: boolean;
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'moveOthersInRoom';
    target: 'sameRoomOtherExplorersAndMonsters';
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'extraTurnAfterTurnEnd';
    consumeOnUse: boolean;
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'nextNonCombatTraitRollTotalReplacement';
    minTotal: number;
    maxTotal: number;
    consumeOnUse: boolean;
    recommendedAction: BetrayalRecommendedAction;
};

export const POSSESSION_USE_EFFECTS: Record<string, PossessionUseEffectProfile> = {
    'omen-book': {
        mode: 'nextNonCombatTraitReplacement',
        replacementTrait: 'knowledge',
        sanityCost: 1,
        recommendedAction: 'explore',
    },
    notebook: {
        mode: 'placeExplorer',
        target: 'anyDiscoveredRoom',
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
    'medical-kit': {
        mode: 'healTraits',
        traits: ['might', 'speed', 'knowledge', 'sanity'],
        consumeOnUse: true,
        target: 'selfOrSameRoomExplorer',
        recommendedAction: 'explore',
    },
    mask: {
        mode: 'moveOthersInRoom',
        target: 'sameRoomOtherExplorersAndMonsters',
        recommendedAction: 'move',
    },
    map: {
        mode: 'placeExplorer',
        target: 'anyDiscoveredRoom',
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
    mirror: {
        mode: 'healTraits',
        traits: ['knowledge', 'sanity'],
        consumeOnUse: true,
        target: 'self',
        recommendedAction: 'explore',
    },
    journal: {
        mode: 'placeExplorer',
        target: 'anyDiscoveredRoom',
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
    'holy-water': {
        mode: 'healTraits',
        traits: ['might', 'speed'],
        consumeOnUse: true,
        target: 'self',
        recommendedAction: 'explore',
    },
    manuscript: {
        mode: 'placeExplorer',
        target: 'anyDiscoveredRoom',
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
    'mysterious-stopwatch': {
        mode: 'extraTurnAfterTurnEnd',
        consumeOnUse: true,
        recommendedAction: 'endTurn',
    },
    'angel-feather': {
        mode: 'nextNonCombatTraitRollTotalReplacement',
        minTotal: 0,
        maxTotal: 8,
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
};

export function resolveInventoryEffectId(cardId: string): string {
    return cardId
        .replace(/-preview-\d+$/, '')
        .replace(/-armory-\d+-\d+$/, '')
        .replace(/-\d+$/, '');
}

export function resolveUseEffect(card: { id: string }): PossessionUseEffectProfile | null {
    return POSSESSION_USE_EFFECTS[resolveInventoryEffectId(card.id)] ?? null;
}
