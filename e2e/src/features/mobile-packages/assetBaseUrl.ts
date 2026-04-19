const CAPACITOR_FILE_PREFIX = '/_capacitor_file_';

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export const normalizeNativeAssetRootPath = (assetRootPath?: string) => {
    if (!assetRootPath) {
        return undefined;
    }

    const trimmed = assetRootPath.trim();
    if (!trimmed) {
        return undefined;
    }

    if (trimmed.startsWith('/')) {
        return trimTrailingSlashes(trimmed);
    }

    if (/^file:\/\/[^/]/i.test(trimmed)) {
        return trimTrailingSlashes(trimmed.replace(/^file:\/\//i, 'file:///'));
    }

    if (/^file:\/[^/]/i.test(trimmed)) {
        return trimTrailingSlashes(trimmed.replace(/^file:\//i, 'file:///'));
    }

    return trimTrailingSlashes(trimmed);
};

const toCapacitorFileUrl = (value: string) => {
    if (/^https?:\/\/[^/]+\/_capacitor_file_\//i.test(value)) {
        return trimTrailingSlashes(value);
    }

    if (value.startsWith(CAPACITOR_FILE_PREFIX)) {
        return trimTrailingSlashes(value);
    }

    if (value.startsWith('/data/')
        || value.startsWith('/storage/')
        || value.startsWith('/sdcard/')) {
        return trimTrailingSlashes(`${CAPACITOR_FILE_PREFIX}${value}`);
    }

    if (value.startsWith('file:///')) {
        return trimTrailingSlashes(`${CAPACITOR_FILE_PREFIX}${value.replace(/^file:\/+/, '/')}`);
    }

    return undefined;
};

export const normalizeGamePackageAssetBaseUrl = (assetBaseUrl?: string) => {
    if (!assetBaseUrl) {
        return undefined;
    }

    const normalized = normalizeNativeAssetRootPath(assetBaseUrl);
    if (!normalized) {
        return undefined;
    }

    const capacitorFileUrl = toCapacitorFileUrl(normalized);
    if (capacitorFileUrl) {
        return capacitorFileUrl;
    }

    return normalized;
};
