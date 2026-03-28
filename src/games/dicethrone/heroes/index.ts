import { MONK_CARDS, getMonkStartingDeck } from './monk/cards';
import { MONK_ABILITIES } from './monk/abilities';
import { PYROMANCER_CARDS, getPyromancerStartingDeck } from './pyromancer/cards';
import { PYROMANCER_ABILITIES } from './pyromancer/abilities';
import { BARBARIAN_CARDS, getBarbarianStartingDeck } from './barbarian/cards';
import { BARBARIAN_ABILITIES } from './barbarian/abilities';
import { MOON_ELF_CARDS, getMoonElfStartingDeck } from './moon_elf/cards';
import { MOON_ELF_ABILITIES } from './moon_elf/abilities';
import { SHADOW_THIEF_CARDS, getShadowThiefStartingDeck } from './shadow_thief/cards';
import { SHADOW_THIEF_ABILITIES } from './shadow_thief/abilities';
import { PALADIN_CARDS, getPaladinStartingDeck } from './paladin/cards';
import { PALADIN_ABILITIES } from './paladin/abilities';
import { GUNSLINGER_CARDS, getGunslingerStartingDeck } from './gunslinger/cards';
import { GUNSLINGER_ABILITIES } from './gunslinger/abilities';
import { SAMURAI_CARDS, getSamuraiStartingDeck } from './samurai/cards';
import { SAMURAI_ABILITIES } from './samurai/abilities';
import type { AbilityCard } from '../types';
import type { AbilityDef } from '../domain/combat';
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
    pyromancer: {
        cards: PYROMANCER_CARDS,
        abilities: PYROMANCER_ABILITIES,
        getStartingDeck: getPyromancerStartingDeck,
    },
    moon_elf: {
        cards: MOON_ELF_CARDS,
        abilities: MOON_ELF_ABILITIES,
        getStartingDeck: getMoonElfStartingDeck,
    },
    shadow_thief: {
        cards: SHADOW_THIEF_CARDS,
        abilities: SHADOW_THIEF_ABILITIES,
        getStartingDeck: getShadowThiefStartingDeck,
    },
    paladin: {
        cards: PALADIN_CARDS,
        abilities: PALADIN_ABILITIES,
        getStartingDeck: getPaladinStartingDeck,
    },
    gunslinger: {
        cards: GUNSLINGER_CARDS,
        abilities: GUNSLINGER_ABILITIES,
        getStartingDeck: getGunslingerStartingDeck,
    },
    samurai: {
        cards: SAMURAI_CARDS,
        abilities: SAMURAI_ABILITIES,
        getStartingDeck: getSamuraiStartingDeck,
    },
};

export function findHeroCard(cardId: string): AbilityCard | undefined {
    for (const hero of Object.values(HEROES_DATA)) {
        const found = hero.cards.find(c => c.id === cardId);
        if (found) return found;
    }
    return undefined;
}
