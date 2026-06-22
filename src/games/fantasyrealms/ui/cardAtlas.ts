import type { CSSProperties } from 'react';
import { buildLocalizedImageSet } from '../../../core/AssetLoader';

export const FANTASY_REALMS_CARD_ATLAS_PATH = 'fantasyrealms/cards/atlases/fantasyrealms-base-cards-atlas.png';
export const FANTASY_REALMS_CARD_ATLAS_COMPRESSED_PATH = 'fantasyrealms/cards/atlases/compressed/fantasyrealms-base-cards-atlas.webp';
export const FANTASY_REALMS_CARD_BACK_PATH = 'fantasyrealms/cards/backs/fantasyrealms-base-card-back.png';
export const FANTASY_REALMS_CARD_FACE_PATH_PREFIX = 'fantasyrealms/cards/faces';

type AtlasPosition = {
    column: number;
    row: number;
};

// @atlas-contract 基础版中文卡图 fantasyrealms-base-cards-atlas.png 使用 10x7 网格；
// 坐标依据 temp/fantasyrealms-crops/row-1..6.png 与 temp/fantasyrealms-atlas-grid/contact-*.png 人工核对。
const FANTASY_REALMS_CARD_ATLAS_POSITION_BY_ID: Record<string, AtlasPosition> = {
    'land-bell-tower': { column: 1, row: 0 },
    'flood-fountain-of-life': { column: 9, row: 0 },
    'flood-great-flood': { column: 3, row: 1 },
    'wild-mirage': { column: 7, row: 1 },
    'wizard-necromancer': { column: 8, row: 1 },
    'army-rangers': { column: 9, row: 1 },
    'wild-shapeshifter': { column: 1, row: 2 },
    'artifact-world-tree': { column: 2, row: 2 },
    'weather-air-elemental': { column: 3, row: 2 },
    'beast-basilisk': { column: 4, row: 2 },
    'wizard-beastmaster': { column: 5, row: 2 },
    'weather-blizzard': { column: 6, row: 2 },
    'artifact-book-of-changes': { column: 7, row: 2 },
    'flame-candle': { column: 8, row: 2 },
    'land-underground-caverns': { column: 9, row: 2 },
    'wizard-collector': { column: 0, row: 3 },
    'wild-doppelganger': { column: 1, row: 3 },
    'beast-dragon': { column: 2, row: 3 },
    'army-dwarvish-infantry': { column: 3, row: 3 },
    'land-earth-elemental': { column: 4, row: 3 },
    'army-elven-archers': { column: 5, row: 3 },
    'weapon-elven-longbow': { column: 6, row: 3 },
    'leader-empress': { column: 7, row: 3 },
    'wizard-elemental-enchantress': { column: 8, row: 3 },
    'flame-fire-elemental': { column: 9, row: 3 },
    'land-forest': { column: 0, row: 4 },
    'flame-forge': { column: 1, row: 4 },
    'artifact-gem-of-order': { column: 2, row: 4 },
    'beast-hydra': { column: 3, row: 4 },
    'flood-island': { column: 4, row: 4 },
    'leader-king': { column: 5, row: 4 },
    'army-celestial-knights': { column: 6, row: 4 },
    'army-light-cavalry': { column: 7, row: 4 },
    'flame-lightning': { column: 8, row: 4 },
    'weapon-magic-wand': { column: 9, row: 4 },
    'land-mountain': { column: 0, row: 5 },
    'leader-princess': { column: 1, row: 5 },
    'artifact-protection-rune': { column: 2, row: 5 },
    'leader-queen': { column: 3, row: 5 },
    'weather-rainstorm': { column: 4, row: 5 },
    'artifact-shield-of-keth': { column: 5, row: 5 },
    'weather-smoke': { column: 6, row: 5 },
    'flood-swamp': { column: 7, row: 5 },
    'weapon-sword-of-keth': { column: 8, row: 5 },
    'beast-unicorn': { column: 9, row: 5 },
    'weapon-war-dirigible': { column: 0, row: 6 },
    'beast-warhorse': { column: 1, row: 6 },
    'wizard-warlock-lord': { column: 2, row: 6 },
    'leader-warlord': { column: 3, row: 6 },
    'weapon-warship': { column: 4, row: 6 },
    'flood-water-elemental': { column: 5, row: 6 },
    'weather-whirlwind': { column: 6, row: 6 },
    'flame-wildfire': { column: 7, row: 6 },
};

export function getFantasyRealmsCardFaceStyle(cardId: string, locale?: string): CSSProperties | null {
    if (!FANTASY_REALMS_CARD_ATLAS_POSITION_BY_ID[cardId]) {
        return null;
    }

    return {
        backgroundImage: buildLocalizedImageSet(`${FANTASY_REALMS_CARD_FACE_PATH_PREFIX}/${cardId}.png`, locale),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    };
}

export function getFantasyRealmsCardBackStyle(locale?: string): CSSProperties {
    return {
        backgroundImage: buildLocalizedImageSet(FANTASY_REALMS_CARD_BACK_PATH, locale),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    };
}
