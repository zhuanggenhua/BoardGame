export const SPA_FALLBACK_EXCLUDE_RE = /^\/(assets|fonts|logos|game-data|locales|manifest\.webmanifest|auth|health|social-socket|games|default|lobby-socket|socket\.io|admin|ugc|layout|feedback|review|invite|message|friend|user-settings|sponsors|notifications|game-changelogs)(\/|$)/;
export const NO_CACHE_HEADER = 'no-cache, no-store, must-revalidate';
export const LONG_CACHE_MAX_AGE = '1y';
export const LONG_CACHE_IMMUTABLE_HEADER = 'public, max-age=31536000, immutable';
export const SHORT_CACHE_HEADER = 'public, max-age=604800';

const normalizeFsPath = (value: string) => value.replace(/\\/g, '/');
const VERSION_PARAM = 'v';
const IMMUTABLE_PUBLIC_ASSET_RE = /\.(avif|webp|png|jpe?g|gif|svg|ogg|mp3|wav|m4a|aac|webm|mp4|woff2?|ttf|otf)$/i;

export const isNoCacheSpaEntryPath = (path: string): boolean =>
    /^\/admin\/(?:changelogs|release-center|mobile-release)\/?$/.test(path);
export const isNoCacheStaticFilePath = (filePath: string): boolean => {
    const normalized = normalizeFsPath(filePath);
    return normalized.endsWith('.html') || normalized.endsWith('/summonerwars.layout.json');
};

export const shouldUseImmutablePublicAssetCache = (requestPath: string): boolean => {
    if (!requestPath) {
        return false;
    }

    const [pathname, query = ''] = requestPath.split('?', 2);
    if (!IMMUTABLE_PUBLIC_ASSET_RE.test(pathname)) {
        return false;
    }

    const params = new URLSearchParams(query);
    return params.has(VERSION_PARAM);
};

export const getPublicAssetCacheControl = (requestPath: string): string => {
    return shouldUseImmutablePublicAssetCache(requestPath)
        ? LONG_CACHE_IMMUTABLE_HEADER
        : SHORT_CACHE_HEADER;
};

export const shouldServeSpaFallback = (path: string): boolean => {
    if (isNoCacheSpaEntryPath(path)) {
        return true;
    }

    return !SPA_FALLBACK_EXCLUDE_RE.test(path);
};
