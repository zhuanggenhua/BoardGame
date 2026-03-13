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
    DICE_SPRITE: (charId: string = 'monk') => `${getCharacterAssetBase(charId)}/dice`,
    EFFECT_ICONS: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/status-icons-atlas`, charId),
    CARD_BG: 'dicethrone/images/Common/card-background',
    AVATAR: 'dicethrone/images/Common/character-portraits',
};

const DIRECT_SPRITE_ASSET_RE = /^(?:https?:|data:|blob:)/i;
const GAME_DATA_DICE_SPRITE_RE = /^\/game-data\/dicethrone\/([^/]+)\/dice-sprite\.png$/i;
const LOGICAL_DICE_SPRITE_RE =
    /^(?:\/assets\/|https?:\/\/[^/]+\/official\/)?(?:i18n\/[^/]+\/)?dicethrone\/images\/([^/]+)\/(?:compressed\/)?(dice(?:-sprite)?)(?:\.(?:png|webp|avif))?$/i;

const normalizeDiceSpriteAssetPath = (assetPath?: string | null) => {
    if (!assetPath) return undefined;

    const trimmed = assetPath.trim();
    if (!trimmed) return undefined;

    const gameDataMatch = trimmed.match(GAME_DATA_DICE_SPRITE_RE);
    if (gameDataMatch?.[1]) {
        const normalized = `dicethrone/images/${gameDataMatch[1]}/dice`;
        diceAssetsLogger.info('normalize-from-game-data', {
            input: trimmed,
            normalized,
        });
        return normalized;
    }

    const logicalMatch = trimmed
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
    if (!normalized) return [];
    if (isDirectSpriteAsset(normalized)) return [normalized];
    return [normalized];
};

const getLogicalSpriteUrlCandidates = (assetPath: string, locale?: string) => {
    const localized = getLocalizedImageUrls(assetPath, locale);
    const unlocalized = getLocalizedImageUrls(assetPath);
    const urls = dedupeStringList([
        localized.primary.webp,
        localized.fallback.webp,
        unlocalized.primary.webp,
    ]);
    // DiceThrone 骰图强制不走本地 /assets 回退，统一转成 R2 绝对域名
    const base = getAssetsBaseUrl().replace(/\/+$/, '');
    const toR2AbsoluteUrl = (url: string) => {
        if (url.startsWith('/assets/')) {
            if (base.startsWith('http://') || base.startsWith('https://')) {
                return `${base}/${url.replace(/^\/+assets\/+/, '')}`;
            }
            // base 若不是绝对域名（极端配置），至少保留非 /assets 的同源绝对路径
            return `/${url.replace(/^\/+assets\/+/, '')}`;
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

export interface DiceFaceFallbackSkin {
    faceId?: string;
    glyph: string;
    label: string;
    faceBackground: string;
    badgeBackground: string;
    badgeBorder: string;
    faceBorder: string;
    textColor: string;
    textShadow: string;
    captionColor: string;
}

const FACE_FALLBACK_ABBREVIATIONS: Record<string, string> = {
    bullet: 'BL',
    dash: 'DS',
    bullseye: 'BE',
};

const getFaceFallbackAbbreviation = (faceId: string) => {
    const explicitAbbreviation = FACE_FALLBACK_ABBREVIATIONS[faceId];
    if (explicitAbbreviation) {
        return explicitAbbreviation;
    }

    const abbreviation = faceId
        .split('_')
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2);
    return abbreviation || faceId.slice(0, 1).toUpperCase();
};

const DICE_FACE_FALLBACK_SKINS: Record<string, Omit<DiceFaceFallbackSkin, 'faceId' | 'label'>> = {
    fist: {
        glyph: '拳',
        faceBackground: 'linear-gradient(145deg, #7c2d12 0%, #431407 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(251,146,60,0.95) 0%, rgba(194,65,12,0.92) 100%)',
        badgeBorder: 'rgba(254,215,170,0.48)',
        faceBorder: 'rgba(251,146,60,0.38)',
        textColor: '#fff7ed',
        textShadow: '0 2px 10px rgba(124,45,18,0.45)',
        captionColor: 'rgba(255,237,213,0.82)',
    },
    palm: {
        glyph: '掌',
        faceBackground: 'linear-gradient(145deg, #0c4a6e 0%, #082f49 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(56,189,248,0.95) 0%, rgba(3,105,161,0.92) 100%)',
        badgeBorder: 'rgba(186,230,253,0.52)',
        faceBorder: 'rgba(56,189,248,0.36)',
        textColor: '#f0f9ff',
        textShadow: '0 2px 10px rgba(8,47,73,0.45)',
        captionColor: 'rgba(224,242,254,0.82)',
    },
    taiji: {
        glyph: '☯',
        faceBackground: 'linear-gradient(145deg, #581c87 0%, #312e81 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(196,181,253,0.96) 0%, rgba(139,92,246,0.94) 100%)',
        badgeBorder: 'rgba(233,213,255,0.54)',
        faceBorder: 'rgba(168,85,247,0.38)',
        textColor: '#f5f3ff',
        textShadow: '0 2px 10px rgba(76,29,149,0.45)',
        captionColor: 'rgba(237,233,254,0.84)',
    },
    lotus: {
        glyph: '莲',
        faceBackground: 'linear-gradient(145deg, #14532d 0%, #064e3b 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(52,211,153,0.96) 0%, rgba(5,150,105,0.94) 100%)',
        badgeBorder: 'rgba(187,247,208,0.5)',
        faceBorder: 'rgba(16,185,129,0.36)',
        textColor: '#ecfdf5',
        textShadow: '0 2px 10px rgba(6,78,59,0.45)',
        captionColor: 'rgba(209,250,229,0.84)',
    },
    sword: {
        glyph: '剑',
        faceBackground: 'linear-gradient(145deg, #334155 0%, #1e293b 52%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(226,232,240,0.96) 0%, rgba(100,116,139,0.94) 100%)',
        badgeBorder: 'rgba(226,232,240,0.5)',
        faceBorder: 'rgba(148,163,184,0.34)',
        textColor: '#f8fafc',
        textShadow: '0 2px 10px rgba(15,23,42,0.42)',
        captionColor: 'rgba(226,232,240,0.82)',
    },
    heart: {
        glyph: '心',
        faceBackground: 'linear-gradient(145deg, #881337 0%, #4c0519 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(251,113,133,0.96) 0%, rgba(225,29,72,0.94) 100%)',
        badgeBorder: 'rgba(254,205,211,0.52)',
        faceBorder: 'rgba(244,63,94,0.36)',
        textColor: '#fff1f2',
        textShadow: '0 2px 10px rgba(76,5,25,0.42)',
        captionColor: 'rgba(255,228,230,0.82)',
    },
    strength: {
        glyph: '力',
        faceBackground: 'linear-gradient(145deg, #78350f 0%, #451a03 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(251,191,36,0.96) 0%, rgba(217,119,6,0.94) 100%)',
        badgeBorder: 'rgba(253,230,138,0.52)',
        faceBorder: 'rgba(245,158,11,0.36)',
        textColor: '#fffbeb',
        textShadow: '0 2px 10px rgba(120,53,15,0.42)',
        captionColor: 'rgba(254,243,199,0.82)',
    },
    fire: {
        glyph: '火',
        faceBackground: 'linear-gradient(145deg, #7f1d1d 0%, #4a1212 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(251,113,58,0.96) 0%, rgba(220,38,38,0.94) 100%)',
        badgeBorder: 'rgba(254,202,202,0.5)',
        faceBorder: 'rgba(248,113,113,0.36)',
        textColor: '#fff7ed',
        textShadow: '0 2px 10px rgba(127,29,29,0.42)',
        captionColor: 'rgba(254,226,226,0.82)',
    },
    magma: {
        glyph: '岩',
        faceBackground: 'linear-gradient(145deg, #9a3412 0%, #7c2d12 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(251,146,60,0.96) 0%, rgba(234,88,12,0.94) 100%)',
        badgeBorder: 'rgba(254,215,170,0.5)',
        faceBorder: 'rgba(249,115,22,0.36)',
        textColor: '#fff7ed',
        textShadow: '0 2px 10px rgba(124,45,18,0.42)',
        captionColor: 'rgba(254,215,170,0.82)',
    },
    fiery_soul: {
        glyph: '魂',
        faceBackground: 'linear-gradient(145deg, #831843 0%, #4a044e 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(244,114,182,0.96) 0%, rgba(219,39,119,0.94) 100%)',
        badgeBorder: 'rgba(251,207,232,0.52)',
        faceBorder: 'rgba(236,72,153,0.36)',
        textColor: '#fdf2f8',
        textShadow: '0 2px 10px rgba(80,7,36,0.42)',
        captionColor: 'rgba(252,231,243,0.82)',
    },
    meteor: {
        glyph: '陨',
        faceBackground: 'linear-gradient(145deg, #92400e 0%, #78350f 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(250,204,21,0.96) 0%, rgba(245,158,11,0.94) 100%)',
        badgeBorder: 'rgba(254,240,138,0.52)',
        faceBorder: 'rgba(250,204,21,0.36)',
        textColor: '#fffbeb',
        textShadow: '0 2px 10px rgba(120,53,15,0.42)',
        captionColor: 'rgba(254,249,195,0.82)',
    },
    bow: {
        glyph: '弓',
        faceBackground: 'linear-gradient(145deg, #075985 0%, #172554 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(96,165,250,0.96) 0%, rgba(37,99,235,0.94) 100%)',
        badgeBorder: 'rgba(191,219,254,0.52)',
        faceBorder: 'rgba(96,165,250,0.36)',
        textColor: '#eff6ff',
        textShadow: '0 2px 10px rgba(23,37,84,0.42)',
        captionColor: 'rgba(219,234,254,0.82)',
    },
    foot: {
        glyph: '足',
        faceBackground: 'linear-gradient(145deg, #1d4ed8 0%, #172554 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(147,197,253,0.96) 0%, rgba(59,130,246,0.94) 100%)',
        badgeBorder: 'rgba(219,234,254,0.52)',
        faceBorder: 'rgba(59,130,246,0.36)',
        textColor: '#eff6ff',
        textShadow: '0 2px 10px rgba(30,64,175,0.42)',
        captionColor: 'rgba(219,234,254,0.82)',
    },
    moon: {
        glyph: '月',
        faceBackground: 'linear-gradient(145deg, #3730a3 0%, #312e81 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(165,180,252,0.96) 0%, rgba(99,102,241,0.94) 100%)',
        badgeBorder: 'rgba(224,231,255,0.54)',
        faceBorder: 'rgba(129,140,248,0.36)',
        textColor: '#eef2ff',
        textShadow: '0 2px 10px rgba(49,46,129,0.42)',
        captionColor: 'rgba(224,231,255,0.84)',
    },
    bullet: {
        glyph: '弹',
        faceBackground: 'linear-gradient(145deg, #3f3f46 0%, #27272a 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(228,228,231,0.96) 0%, rgba(113,113,122,0.94) 100%)',
        badgeBorder: 'rgba(244,244,245,0.52)',
        faceBorder: 'rgba(161,161,170,0.36)',
        textColor: '#fafafa',
        textShadow: '0 2px 10px rgba(39,39,42,0.42)',
        captionColor: 'rgba(244,244,245,0.82)',
    },
    dash: {
        glyph: '冲',
        faceBackground: 'linear-gradient(145deg, #0f766e 0%, #134e4a 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(94,234,212,0.96) 0%, rgba(13,148,136,0.94) 100%)',
        badgeBorder: 'rgba(204,251,241,0.52)',
        faceBorder: 'rgba(45,212,191,0.36)',
        textColor: '#f0fdfa',
        textShadow: '0 2px 10px rgba(19,78,74,0.42)',
        captionColor: 'rgba(204,251,241,0.82)',
    },
    bullseye: {
        glyph: '靶',
        faceBackground: 'linear-gradient(145deg, #991b1b 0%, #450a0a 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(252,165,165,0.96) 0%, rgba(220,38,38,0.94) 100%)',
        badgeBorder: 'rgba(254,202,202,0.52)',
        faceBorder: 'rgba(248,113,113,0.36)',
        textColor: '#fef2f2',
        textShadow: '0 2px 10px rgba(69,10,10,0.42)',
        captionColor: 'rgba(254,226,226,0.82)',
    },
    dagger: {
        glyph: '匕',
        faceBackground: 'linear-gradient(145deg, #334155 0%, #0f172a 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(203,213,225,0.96) 0%, rgba(100,116,139,0.94) 100%)',
        badgeBorder: 'rgba(226,232,240,0.5)',
        faceBorder: 'rgba(148,163,184,0.34)',
        textColor: '#f8fafc',
        textShadow: '0 2px 10px rgba(15,23,42,0.42)',
        captionColor: 'rgba(226,232,240,0.82)',
    },
    bag: {
        glyph: '袋',
        faceBackground: 'linear-gradient(145deg, #713f12 0%, #422006 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(253,224,71,0.96) 0%, rgba(234,179,8,0.94) 100%)',
        badgeBorder: 'rgba(254,240,138,0.52)',
        faceBorder: 'rgba(250,204,21,0.36)',
        textColor: '#fefce8',
        textShadow: '0 2px 10px rgba(113,63,18,0.42)',
        captionColor: 'rgba(254,249,195,0.82)',
    },
    card: {
        glyph: '牌',
        faceBackground: 'linear-gradient(145deg, #065f46 0%, #064e3b 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(110,231,183,0.96) 0%, rgba(16,185,129,0.94) 100%)',
        badgeBorder: 'rgba(209,250,229,0.52)',
        faceBorder: 'rgba(52,211,153,0.36)',
        textColor: '#ecfdf5',
        textShadow: '0 2px 10px rgba(6,95,70,0.42)',
        captionColor: 'rgba(209,250,229,0.82)',
    },
    shadow: {
        glyph: '影',
        faceBackground: 'linear-gradient(145deg, #4c1d95 0%, #312e81 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(196,181,253,0.96) 0%, rgba(139,92,246,0.94) 100%)',
        badgeBorder: 'rgba(233,213,255,0.54)',
        faceBorder: 'rgba(167,139,250,0.36)',
        textColor: '#f5f3ff',
        textShadow: '0 2px 10px rgba(76,29,149,0.42)',
        captionColor: 'rgba(237,233,254,0.84)',
    },
    helm: {
        glyph: '盔',
        faceBackground: 'linear-gradient(145deg, #374151 0%, #1f2937 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(229,231,235,0.96) 0%, rgba(107,114,128,0.94) 100%)',
        badgeBorder: 'rgba(243,244,246,0.52)',
        faceBorder: 'rgba(156,163,175,0.36)',
        textColor: '#f9fafb',
        textShadow: '0 2px 10px rgba(31,41,55,0.42)',
        captionColor: 'rgba(229,231,235,0.82)',
    },
    pray: {
        glyph: '祷',
        faceBackground: 'linear-gradient(145deg, #92400e 0%, #78350f 48%, #020617 100%)',
        badgeBackground: 'linear-gradient(145deg, rgba(253,230,138,0.96) 0%, rgba(245,158,11,0.94) 100%)',
        badgeBorder: 'rgba(254,243,199,0.54)',
        faceBorder: 'rgba(251,191,36,0.36)',
        textColor: '#fffbeb',
        textShadow: '0 2px 10px rgba(120,53,15,0.42)',
        captionColor: 'rgba(254,243,199,0.84)',
    },
};

const DEFAULT_DICE_FACE_FALLBACK_SKIN: Omit<DiceFaceFallbackSkin, 'faceId' | 'label'> = {
    glyph: '?',
    faceBackground: 'linear-gradient(145deg, #334155 0%, #1e293b 48%, #020617 100%)',
    badgeBackground: 'linear-gradient(145deg, rgba(203,213,225,0.92) 0%, rgba(71,85,105,0.94) 100%)',
    badgeBorder: 'rgba(226,232,240,0.42)',
    faceBorder: 'rgba(148,163,184,0.28)',
    textColor: '#f8fafc',
    textShadow: '0 2px 10px rgba(15,23,42,0.42)',
    captionColor: 'rgba(226,232,240,0.78)',
};

export const getDiceFaceFallbackGlyph = (
    value: number,
    definitionId?: string,
    characterId?: string,
) => {
    const resolvedDefinitionId = definitionId ?? (characterId ? `${characterId}-dice` : undefined);
    const faceId = resolvedDefinitionId
        ? getDieFaceByValue(resolvedDefinitionId, value)?.symbols?.[0]
        : undefined;
    return faceId ? getFaceFallbackAbbreviation(faceId) : String(value);
};

export const getDiceFaceFallbackSkin = (
    value: number,
    definitionId?: string,
    characterId?: string,
): DiceFaceFallbackSkin => {
    const resolvedDefinitionId = definitionId ?? (characterId ? `${characterId}-dice` : undefined);
    const faceId = resolvedDefinitionId
        ? getDieFaceByValue(resolvedDefinitionId, value)?.symbols?.[0]
        : undefined;
    const baseSkin = (faceId && DICE_FACE_FALLBACK_SKINS[faceId]) || DEFAULT_DICE_FACE_FALLBACK_SKIN;
    return {
        faceId,
        label: faceId ? getFaceFallbackAbbreviation(faceId) : String(value),
        ...baseSkin,
    };
};

// ... 后续绘图逻辑（DICE_ATLAS, PORTRAIT_ATLAS 等）保持不变 ...

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
    vampire_lord: 7,
    cursed_pirate: 8,
    shadow_thief: 9,
    ninja: 10,
    samurai: 11,
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
