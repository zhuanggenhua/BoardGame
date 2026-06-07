import { getLocalizedImageUrls } from './AssetLoader';

const DIRECT_SPRITE_ASSET_RE = /^(?:https?:|data:|blob:|\/(?:assets|game-data|_capacitor_file_)\/)/i;

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

export const isDirectSpriteAsset = (assetPath?: string | null) => (
    Boolean(assetPath && DIRECT_SPRITE_ASSET_RE.test(assetPath.trim()))
);

export const resolveSpriteAssetUrls = (assetPath?: string | null, locale?: string) => {
    const trimmed = assetPath?.trim();
    if (!trimmed) {
        return [];
    }

    if (isDirectSpriteAsset(trimmed)) {
        return [trimmed];
    }

    const localized = getLocalizedImageUrls(trimmed, locale);
    return dedupeStringList([
        localized.primary.webp,
        localized.fallback.webp,
    ]);
};

export const resolveSpriteAssetUrl = (assetPath?: string | null, locale?: string) => (
    resolveSpriteAssetUrls(assetPath, locale)[0]
);

export const buildSpriteBackgroundImage = (assetPath?: string | null, locale?: string) => {
    const spriteUrl = resolveSpriteAssetUrl(assetPath, locale);
    return spriteUrl ? `url("${spriteUrl}")` : '';
};
