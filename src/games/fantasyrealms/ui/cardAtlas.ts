import type { CSSProperties } from 'react';
import { buildLocalizedImageSet } from '../../../core/AssetLoader';

export const FANTASY_REALMS_CARD_ATLAS_PATH = 'fantasyrealms/cards/atlases/fantasyrealms-base-cards-atlas.png';
export const FANTASY_REALMS_CARD_BACK_PATH = 'fantasyrealms/cards/backs/fantasyrealms-base-card-back.png';
export const FANTASY_REALMS_CURSED_HOARD_CARD_BACK_PATH = 'fantasyrealms/cards/backs/fantasyrealms-cursed-hoard-card-back.png';

type AtlasPosition = {
    column: number;
    row: number;
};

type AtlasFrame = AtlasPosition & {
    image: string;
    columns: number;
    rows: number;
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

// @atlas-contract 诅咒宝藏/新花色中文扩展牌正面来自 fantasyrealms-base-cards-atlas.png 使用的同一张总图；
// 源图为 D:\gongzuo\webgame\gameasset\幻想国度加扩\Mods\Images\所有卡牌.png，尺寸 4096x4026。
// 注意：扩展牌.png 是诅咒物品卡组，不是地牢/天使/食尸鬼这组新花色正面图。
const FANTASY_REALMS_CURSED_HOARD_CARD_ATLAS_POSITION_BY_ID: Record<string, AtlasPosition> = {
    'building-dungeon': { column: 8, row: 0 },
    'outsider-angel': { column: 0, row: 0 },
    'building-bell-tower-ch': { column: 1, row: 0 },
    'building-castle': { column: 2, row: 0 },
    'building-chapel': { column: 3, row: 0 },
    'building-crypt': { column: 4, row: 0 },
    'undead-dark-queen': { column: 5, row: 0 },
    'undead-death-knight': { column: 6, row: 0 },
    'outsider-demon': { column: 7, row: 0 },
    'flood-fountain-of-life-ch': { column: 9, row: 0 },
    'land-garden': { column: 0, row: 1 },
    'outsider-genie': { column: 1, row: 1 },
    'undead-ghoul': { column: 2, row: 1 },
    'flood-great-flood-ch': { column: 3, row: 1 },
    'outsider-judge': { column: 4, row: 1 },
    'outsider-leprechaun': { column: 5, row: 1 },
    'undead-lich': { column: 6, row: 1 },
    'wild-mirage-ch': { column: 7, row: 1 },
    'wizard-necromancer-ch': { column: 8, row: 1 },
    'army-rangers-ch': { column: 9, row: 1 },
    'undead-specter': { column: 0, row: 2 },
    'wild-shapeshifter-ch': { column: 1, row: 2 },
    'artifact-world-tree-ch': { column: 2, row: 2 },
};

const FANTASY_REALMS_CARD_ATLAS_FRAME_BY_ID: Record<string, AtlasFrame> = {
    ...Object.fromEntries(
        Object.entries(FANTASY_REALMS_CARD_ATLAS_POSITION_BY_ID).map(([cardId, position]) => [
            cardId,
            {
                ...position,
                image: FANTASY_REALMS_CARD_ATLAS_PATH,
                columns: 10,
                rows: 7,
            },
        ]),
    ),
    ...Object.fromEntries(
        Object.entries(FANTASY_REALMS_CURSED_HOARD_CARD_ATLAS_POSITION_BY_ID).map(([cardId, position]) => [
            cardId,
            {
                ...position,
                image: FANTASY_REALMS_CARD_ATLAS_PATH,
                columns: 10,
                rows: 7,
            },
        ]),
    ),
};

export function getFantasyRealmsCardFaceStyle(cardId: string, locale?: string): CSSProperties | null {
    const frame = FANTASY_REALMS_CARD_ATLAS_FRAME_BY_ID[cardId];
    if (!frame) {
        return null;
    }

    return {
        backgroundImage: buildLocalizedImageSet(frame.image, locale),
        backgroundSize: `${frame.columns * 100}% ${frame.rows * 100}%`,
        backgroundPosition: `${(frame.column / (frame.columns - 1)) * 100}% ${(frame.row / (frame.rows - 1)) * 100}%`,
        backgroundRepeat: 'no-repeat',
    };
}

export function getFantasyRealmsCardBackStyle(locale?: string, useCursedHoardBack = false): CSSProperties {
    return {
        backgroundImage: buildLocalizedImageSet(
            useCursedHoardBack ? FANTASY_REALMS_CURSED_HOARD_CARD_BACK_PATH : FANTASY_REALMS_CARD_BACK_PATH,
            locale,
        ),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    };
}
