import type { CSSProperties } from 'react';
import type { HeroState } from '../types';
import type { TranslateFn } from './utils';
import { buildLocalizedImageSet, getAssetsBaseUrl, getLocalizedImageUrls } from '../../../core';
import { createScopedLogger } from '../../../lib/logger';
import { getDiceDefinition, getDieFaceByValue } from '../domain/diceRegistry';

const getCharacterAssetBase = (charId: string = 'monk') => (
    `dicethrone/images/${charId}`
);
const diceAssetsLogger = createScopedLogger('dicethrone:dice-assets');

/**
 * 扩展名处理：仅 barbarian 依然保留原生的 .png 格式（因为其暂未进行优化转换）
 */
const withExtension = (path: string, charId: string) => (
    charId === 'barbarian' ? `${path}.png` : path
);

export const ASSETS = {
    PLAYER_BOARD: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/player-board`, charId),
    TIP_BOARD: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/tip`, charId),
    CARDS_ATLAS: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/ability-cards`, charId),
    HAND_CARDS_ATLAS: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/hand-cards-atlas`, charId),
    DICE_SPRITE: (charId: string = 'monk') => `${getCharacterAssetBase(charId)}/dice`,
    EFFECT_ICONS: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/status-icons-atlas`, charId),
    CARD_BG: 'dicethrone/images/Common/card-background',
    AVATAR: 'dicethrone/images/Common/character-portraits',
};

const DIRECT_SPRITE_ASSET_RE = /^(?:https?:|data:|blob:|\/game-data\/)/i;
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

const getLogicalSpriteUrlCandidates = (assetPath: string, locale?: string) => {
    const localized = getLocalizedImageUrls(assetPath, locale);
    const urls = dedupeStringList([
        localized.primary.webp,
        localized.fallback.webp,
    ]);
    // DiceThrone 骰图优先走语言化压缩资源；
    // 但如果定义里给的是 /game-data 直链，resolveSpriteAssetUrls 仍会把原始 PNG 保留为最后回退，
    // 避免某些角色的压缩资源链路缺失时整块骰面空白。
    // 这里依然不追加未语言化的本地 /assets 回退，避免 dev server 把 SPA HTML 误探测成图片。
    const base = getAssetsBaseUrl().replace(/\/+$/, '');
    const toR2AbsoluteUrl = (url: string) => {
        if (url.startsWith('/assets/')) {
            if (base.startsWith('http://') || base.startsWith('https://')) {
                return `${base}/${url.replace(/^\/+assets\/+/, '')}`;
            }
            return url;
        }
        if (url.startsWith('/')) {
            if (base.startsWith('http://') || base.startsWith('https://')) {
                return `${base}/${url.replace(/^\/+/, '')}`;
            }
            return url;
        }
        return url;
    };

    const candidates = dedupeStringList(urls.map(toR2AbsoluteUrl));
    diceAssetsLogger.debug('logical-url-candidates', {
        assetPath,
        locale: locale ?? null,
        base,
        candidates,
    });
    return candidates;
};

export const isDirectSpriteAsset = (assetPath?: string | null) => (
    Boolean(assetPath && DIRECT_SPRITE_ASSET_RE.test(assetPath.trim()))
);

export const resolveSpriteAssetUrls = (assetPath?: string | null, locale?: string) => {
    const paths = getSpriteAssetPathCandidates(assetPath);
    const urls: string[] = [];
    for (const path of paths) {
        if (isDirectSpriteAsset(path)) {
            diceAssetsLogger.debug('resolve-direct-url', {
                locale: locale ?? null,
                path,
            });
            urls.push(path);
            continue;
        }
        diceAssetsLogger.debug('resolve-logical-path', {
            locale: locale ?? null,
            path,
        });
        urls.push(...getLogicalSpriteUrlCandidates(path, locale));
    }
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
    return urls[0];
};

export const buildSpriteBackgroundImage = (assetPath?: string | null, locale?: string) => {
    const spriteUrl = resolveSpriteAssetUrl(assetPath, locale);
    return spriteUrl ? `url("${spriteUrl}")` : '';
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

const PORTRAIT_CELL_W = PORTRAIT_ATLAS.deckW / PORTRAIT_ATLAS.cols;
const PORTRAIT_CELL_H = PORTRAIT_ATLAS.deckH / PORTRAIT_ATLAS.rows;
const PORTRAIT_BG_SIZE = {
    x: (PORTRAIT_ATLAS.imageW / PORTRAIT_CELL_W) * 100,
    y: (PORTRAIT_ATLAS.imageH / PORTRAIT_CELL_H) * 100,
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

const getPortraitAtlasPosition = (index: number) => {
    const safeIndex = index % (PORTRAIT_ATLAS.cols * PORTRAIT_ATLAS.rows);
    const col = safeIndex % PORTRAIT_ATLAS.cols;
    const row = Math.floor(safeIndex / PORTRAIT_ATLAS.cols);
    const x = PORTRAIT_ATLAS.deckX + col * PORTRAIT_CELL_W;
    const y = PORTRAIT_ATLAS.deckY + row * PORTRAIT_CELL_H;
    const xPos = (x / (PORTRAIT_ATLAS.imageW - PORTRAIT_CELL_W)) * 100;
    const yPos = (y / (PORTRAIT_ATLAS.imageH - PORTRAIT_CELL_H)) * 100;
    return { xPos, yPos };
};

export const getPortraitStyle = (characterId: HeroState['characterId'], locale?: string) => {
    const index = CHARACTER_PORTRAIT_INDEX[characterId] ?? 0;
    const { xPos, yPos } = getPortraitAtlasPosition(index);
    return {
        backgroundImage: buildLocalizedImageSet(ASSETS.AVATAR, locale),
        backgroundSize: `${PORTRAIT_BG_SIZE.x}% ${PORTRAIT_BG_SIZE.y}%`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${xPos.toFixed(4)}% ${yPos.toFixed(4)}%`,
    } as CSSProperties;
};
