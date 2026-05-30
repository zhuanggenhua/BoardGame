import type { RandomFn } from '../../../../engine/types';
import { COMMON_CARDS, TREANT_NINJA_COMMON_ATLAS_INDEX, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS } from '../../domain/ids';
import type { AbilityCard } from '../../types';

export const CURSED_PIRATE_CARDS: AbilityCard[] = [
    ...injectCommonCardPreviewRefs(
        COMMON_CARDS,
        DICETHRONE_CARD_ATLAS_IDS.CURSED_PIRATE,
        TREANT_NINJA_COMMON_ATLAS_INDEX,
    ),
];

export const getCursedPirateStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = CURSED_PIRATE_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
