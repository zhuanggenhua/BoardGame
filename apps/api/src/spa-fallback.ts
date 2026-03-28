export const SPA_FALLBACK_EXCLUDE_RE = /^\/(assets|auth|health|social-socket|games|default|lobby-socket|socket\.io|admin|ugc|layout|feedback|review|invite|message|friend|user-settings|sponsors|notifications|game-changelogs)(\/|$)/;

export const isNoCacheSpaEntryPath = (path: string): boolean => /^\/admin\/changelogs\/?$/.test(path);

export const shouldServeSpaFallback = (path: string): boolean => {
    if (isNoCacheSpaEntryPath(path)) {
        return true;
    }

    return !SPA_FALLBACK_EXCLUDE_RE.test(path);
};
