import { MONK_CARDS, getMonkStartingDeck } from './monk/cards';
import { MONK_ABILITIES } from './monk/abilities';
import { BARBARIAN_CARDS, getBarbarianStartingDeck } from './barbarian/cards';
import { BARBARIAN_ABILITIES } from './barbarian/abilities';
import type { AbilityCard } from '../types';
import type { AbilityDef } from '../../../systems/presets/combat';
import type { RandomFn } from '../../../engine/types';

export interface HeroData {
    cards: AbilityCard[];
    abilities: AbilityDef[];
    getStartingDeck: (random: RandomFn) => AbilityCard[];
}

export const HEROES_DATA: Record<string, HeroData> = {
    monk: {
        cards: MONK_CARDS,
        abilities: MONK_ABILITIES,
        getStartingDeck: getMonkStartingDeck,
    },
    barbarian: {
        cards: BARBARIAN_CARDS,
        abilities: BARBARIAN_ABILITIES,
        getStartingDeck: getBarbarianStartingDeck,
    },
};

export function findHeroCard(cardId: string): AbilityCard | undefined {
    for (const hero of Object.values(HEROES_DATA)) {
        const found = hero.cards.find(c => c.id === cardId);
        if (found) return found;
    }
    return undefined;
}
