import type { CSSProperties } from 'react';
import type { HeroState } from '../types';
import type { TranslateFn } from './utils';
import {
    buildLocalizedImageSet,
    buildSpriteBackgroundImage as buildGenericSpriteBackgroundImage,
    isDirectSpriteAsset,
    resolveSpriteAssetUrl as resolveGenericSpriteAssetUrl,
    resolveSpriteAssetUrls as resolveGenericSpriteAssetUrls,
} from '../../../core';
import { createScopedLogger } from '../../../lib/logger';
import { getDiceDefinition, getDieFaceByValue } from '../domain/diceRegistry';

const CHARACTER_ASSET_DIR: Record<string, string> = {
    cursed_pirate: 'cursed',
    artificer: 'artificial',
};

const getCharacterAssetBase = (charId: string = 'monk') => (
    `dicethrone/images/${CHARACTER_ASSET_DIR[charId] ?? charId}`
);

const getPlayerBoardAssetName = (
    charId: string,
    playerBoardFace?: HeroState['playerBoardFace'],
) => {
    if (charId === 'cursed_pirate' && playerBoardFace === 'normal') {
        return 'human-player-board';
    }
    return 'player-board';
};

export const getPlayerBoardAssetPath = (
    charId: string = 'monk',
    playerBoardFace?: HeroState['playerBoardFace'],
) => withExtension(
    `${getCharacterAssetBase(charId)}/${getPlayerBoardAssetName(charId, playerBoardFace)}`,
    charId,
);

const diceAssetsLogger = createScopedLogger('dicethrone:dice-assets');

/**
 * 扩展名处理：仅 barbarian 依然保留原生的 .png 格式（因为其暂未进行优化转换）
 */
const withExtension = (path: string, charId: string) => (
    charId === 'barbarian' ? `${path}.png` : path
);

export const ASSETS = {
    PLAYER_BOARD: (charId: string = 'monk', playerBoardFace?: HeroState['playerBoardFace']) => (
        getPlayerBoardAssetPath(charId, playerBoardFace)
    ),
    TIP_BOARD: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/tip`, charId),
    CARDS_ATLAS: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/ability-cards`, charId),
    HAND_CARDS_ATLAS: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/hand-cards-atlas`, charId),
    DICE_SPRITE: (charId: string = 'monk') => `${getCharacterAssetBase(charId)}/dice`,
    EFFECT_ICONS: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/status-icons-atlas`, charId),
    CARD_BG: 'dicethrone/images/Common/card-background',
    AVATAR: 'dicethrone/images/Common/character-portraits',
    NEW_AVATAR: 'dicethrone/images/Common/characterhead2',
};

const GAME_DATA_DICE_SPRITE_RE = /^\/game-data\/dicethrone\/([^/]+)\/dice-sprite\.png$/i;
const LOGICAL_DICE_SPRITE_RE =
    /^(?:\/assets\/|https?:\/\/[^/]+\/official\/)?(?:i18n\/[^/]+\/)?dicethrone\/images\/([^/]+)\/(?:compressed\/)?(dice(?:-sprite)?)(?:\.(?:png|webp|avif))?$/i;

const normalizeDiceSpriteAssetPath = (assetPath?: string | null) => {
    if (!assetPath) return undefined;

    const trimmed = assetPath.trim();
    if (!trimmed) return undefined;
    const sanitized = trimmed.split('#', 1)[0].split('?', 1)[0];

    const gameDataMatch = sanitized.match(GAME_DATA_DICE_SPRITE_RE);
    if (gameDataMatch?.[1]) {
        const normalized = `dicethrone/images/${gameDataMatch[1]}/dice`;
        diceAssetsLogger.info('normalize-from-game-data', {
            input: trimmed,
            normalized,
        });
        return normalized;
    }

    const logicalMatch = sanitized
        .replace(/^\/+/, '')
        .match(LOGICAL_DICE_SPRITE_RE);
    if (logicalMatch?.[1]) {
        const normalized = `dicethrone/images/${logicalMatch[1]}/dice`;
        diceAssetsLogger.debug('normalize-from-logical', {
            input: trimmed,
            normalized,
        });
        return normalized;
    }

    diceAssetsLogger.debug('normalize-keep-input', {
        input: trimmed,
    });
    return trimmed;
};

const dedupeStringList = (list: Array<string | undefined>) => {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
        if (!item) continue;
        if (seen.has(item)) continue;
        seen.add(item);
        unique.push(item);
    }
    return unique;
};

const getSpriteAssetPathCandidates = (assetPath?: string | null) => {
    const normalized = normalizeDiceSpriteAssetPath(assetPath);
    const directInput = isDirectSpriteAsset(assetPath) ? assetPath.trim() : undefined;
    return dedupeStringList([
        normalized,
        directInput,
    ]);
};

export const resolveSpriteAssetUrls = (assetPath?: string | null, locale?: string) => {
    const paths = getSpriteAssetPathCandidates(assetPath);
    const urls = paths.flatMap((path) => {
        const resolved = resolveGenericSpriteAssetUrls(path, locale);
        diceAssetsLogger.debug(isDirectSpriteAsset(path) ? 'resolve-direct-url' : 'resolve-logical-path', {
            locale: locale ?? null,
            path,
            resolved,
        });
        return resolved;
    });
    const deduped = dedupeStringList(urls);
    diceAssetsLogger.debug('resolve-final-urls', {
        input: assetPath ?? null,
        locale: locale ?? null,
        urls: deduped,
    });
    return deduped;
};

export const resolveSpriteAssetUrl = (assetPath?: string | null, locale?: string) => {
    const urls = resolveSpriteAssetUrls(assetPath, locale);
    return urls[0] ?? resolveGenericSpriteAssetUrl(normalizeDiceSpriteAssetPath(assetPath), locale);
};

export const buildSpriteBackgroundImage = (assetPath?: string | null, locale?: string) => {
    return buildGenericSpriteBackgroundImage(resolveSpriteAssetUrl(assetPath, locale));
};

export const getDiceSpriteAssetPath = (definitionId?: string, characterId: string = 'monk') => {
    const definitionAsset = definitionId
        ? getDiceDefinition(definitionId)?.assets?.spriteSheet
        : undefined;
    return normalizeDiceSpriteAssetPath(definitionAsset ?? ASSETS.DICE_SPRITE(characterId));
};

export const getDiceSpriteUrl = (definitionId?: string, characterId: string = 'monk', locale?: string) => (
    resolveSpriteAssetUrl(getDiceSpriteAssetPath(definitionId, characterId), locale)
);

export const getDiceSpriteUrls = (definitionId?: string, characterId: string = 'monk', locale?: string) => (
    resolveSpriteAssetUrls(getDiceSpriteAssetPath(definitionId, characterId), locale)
);

// @atlas-contract dice.webp 3x3（上行空白），仅使用下两行 6 格；
// 已人工查看图片：上行从左到右为 2/4/5，下行从左到右为 1/3/6。
const DICE_ATLAS: {
    cols: number;
    rows: number;
    faceMap: Record<number, { col: number; row: number }>;
} = {
    cols: 3,
    rows: 3,
    faceMap: {
        1: { col: 0, row: 2 },
        2: { col: 0, row: 1 },
        3: { col: 1, row: 2 },
        4: { col: 1, row: 1 },
        5: { col: 2, row: 1 },
        6: { col: 2, row: 2 },
    },
};

export const DICE_BG_SIZE = `${DICE_ATLAS.cols * 100}% ${DICE_ATLAS.rows * 100}%`;

export const getDiceSpritePosition = (value: number) => {
    const mapping = DICE_ATLAS.faceMap[value] ?? DICE_ATLAS.faceMap[1];
    const xPos = DICE_ATLAS.cols > 1 ? (mapping.col / (DICE_ATLAS.cols - 1)) * 100 : 0;
    const yPos = DICE_ATLAS.rows > 1 ? (mapping.row / (DICE_ATLAS.rows - 1)) * 100 : 0;
    return { xPos, yPos };
};

export const getBonusFaceLabel = (
    value: number | undefined,
    t: TranslateFn,
    options?: { face?: string; definitionId?: string }
) => {
    const face = options?.face
        ?? (options?.definitionId && typeof value === 'number'
            ? getDieFaceByValue(options.definitionId, value)?.symbols?.[0]
            : undefined);
    return face ? (t(`dice.face.${face}`) as string) : (t('bonusDie.title') as string);
};

// @atlas-contract character-portraits.png uses the legacy shared portrait contract for existing heroes.
const PORTRAIT_ATLAS = {
    imageW: 3950,
    imageH: 4096,
    deckX: 0,
    deckY: 0,
    deckW: 3934,
    deckH: 1054,
    cols: 10,
    rows: 2,
};

// @atlas-contract characterhead2.png is a separate 6-column portrait source for newer Dice Throne heroes.
const NEW_PORTRAIT_ATLAS = {
    imageW: 3570,
    imageH: 6042,
    deckX: 0,
    deckY: 0,
    deckW: 3570,
    deckH: 6041,
    cols: 6,
    rows: 7,
};

const CHARACTER_PORTRAIT_INDEX: Record<string, number> = {
    huntress: 0,
    gunslinger: 1,
    treant: 2,
    monk: 3,
    moon_elf: 4,
    paladin: 5,
    pyromancer: 6,
    vampire_lord: 11,
    cursed_pirate: 8,
    shadow_thief: 9,
    ninja: 10,
    samurai: 7,
    barbarian: 13,
    seraph: 14,
};

const NEW_CHARACTER_PORTRAIT_INDEX: Partial<Record<HeroState['characterId'], number>> = {
    ninja: 2,
    zhanshujia: 5,
    cursed_pirate: 6,
    treant: 13,
};

const buildPortraitAtlasStyle = (
    atlas: typeof PORTRAIT_ATLAS,
    imagePath: string,
    index: number,
    locale?: string,
) => {
    const cellW = atlas.deckW / atlas.cols;
    const cellH = atlas.deckH / atlas.rows;
    const safeIndex = index % (atlas.cols * atlas.rows);
    const col = safeIndex % atlas.cols;
    const row = Math.floor(safeIndex / atlas.cols);
    const x = atlas.deckX + col * cellW;
    const y = atlas.deckY + row * cellH;
    const xPos = (x / (atlas.imageW - cellW)) * 100;
    const yPos = (y / (atlas.imageH - cellH)) * 100;

    return {
        backgroundImage: buildLocalizedImageSet(imagePath, locale),
        backgroundSize: `${((atlas.imageW / cellW) * 100).toFixed(4)}% ${((atlas.imageH / cellH) * 100).toFixed(4)}%`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${xPos.toFixed(4)}% ${yPos.toFixed(4)}%`,
    } as CSSProperties;
};

export const getPortraitStyle = (characterId: HeroState['characterId'], locale?: string) => {
    const newPortraitIndex = NEW_CHARACTER_PORTRAIT_INDEX[characterId];
    if (typeof newPortraitIndex === 'number') {
        return buildPortraitAtlasStyle(NEW_PORTRAIT_ATLAS, ASSETS.NEW_AVATAR, newPortraitIndex, locale);
    }

    const index = CHARACTER_PORTRAIT_INDEX[characterId] ?? 0;
    return buildPortraitAtlasStyle(PORTRAIT_ATLAS, ASSETS.AVATAR, index, locale);
};
