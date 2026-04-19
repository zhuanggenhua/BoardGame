import { DECK_VARIANT_IDS, type DeckVariantId } from './domain/ids';

type CardImageRef = {
    imagePath?: string;
    imageIndex?: number;
    baseInfluence?: number;
    defId?: string;
};

const DECK_CARD_COUNT = 16;
const LOCATION_CARD_COUNT = 8;

export const CARDIA_IMAGE_PATHS = {
    BOARD_BACKGROUND: 'cardia/board/background',
    THUMBNAIL_TITLE: 'cardia/thumbnails/title',
    HELPER_1: 'cardia/help/helper1',
    HELPER_2: 'cardia/help/helper2',
    DECK1_BACK: 'cardia/cards/common/deck1-back',
} as const;

function clampImageIndex(index: number, max: number): number {
    if (!Number.isFinite(index)) return 1;
    if (index < 1) return 1;
    if (index > max) return max;
    return Math.floor(index);
}

function inferCardFolder(defId?: string): 'deck1' | 'deck2' | 'locations' {
    if (!defId) return 'deck1';
    if (defId.startsWith('location_')) return 'locations';
    if (defId.startsWith('deck_ii_')) return 'deck2';
    return 'deck1';
}

export function getCardiaDeckCardPath(deckVariant: DeckVariantId, imageIndex: number): string {
    const deckFolder = deckVariant === DECK_VARIANT_IDS.II ? 'deck2' : 'deck1';
    const clampedIndex = clampImageIndex(imageIndex, DECK_CARD_COUNT);
    return `cardia/cards/${deckFolder}/${clampedIndex}`;
}

export function getCardiaLocationPath(imageIndex: number): string {
    const clampedIndex = clampImageIndex(imageIndex, LOCATION_CARD_COUNT);
    return `cardia/cards/locations/${clampedIndex}`;
}

export function getCardiaDeckCardPaths(deckVariant: DeckVariantId): string[] {
    return Array.from({ length: DECK_CARD_COUNT }, (_, i) => getCardiaDeckCardPath(deckVariant, i + 1));
}

export function getCardiaLocationPaths(): string[] {
    return Array.from({ length: LOCATION_CARD_COUNT }, (_, i) => getCardiaLocationPath(i + 1));
}

export function resolveCardiaCardImagePath(card: CardImageRef): string | undefined {
    if (card.imagePath) {
        return card.imagePath;
    }

    const rawIndex = typeof card.imageIndex === 'number' ? card.imageIndex : card.baseInfluence;
    if (typeof rawIndex !== 'number') {
        return undefined;
    }

    const folder = inferCardFolder(card.defId);
    if (folder === 'locations') {
        return getCardiaLocationPath(rawIndex);
    }

    const deckVariant = folder === 'deck2' ? DECK_VARIANT_IDS.II : DECK_VARIANT_IDS.I;
    return getCardiaDeckCardPath(deckVariant, rawIndex);
}
