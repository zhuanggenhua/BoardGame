import { Capacitor } from '@capacitor/core';

const CAPACITOR_FILE_PREFIX = '/_capacitor_file_';

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');
const isCapacitorFileUrl = (value: string) => (
    /^https?:\/\/[^/]+\/_capacitor_file_\//i.test(value)
    || value.startsWith(CAPACITOR_FILE_PREFIX)
);

const isNativeCapacitorRuntime = () => {
    try {
        if (Capacitor?.isNativePlatform?.()) {
            return true;
        }
    } catch {
        // Fall through to the window bridge check below.
    }

    try {
        const capacitorBridge = (
            globalThis.window as (Window & { Capacitor?: { isNativePlatform?: () => boolean } }) | undefined
        )?.Capacitor;
        return Boolean(capacitorBridge?.isNativePlatform?.());
    } catch {
        return false;
    }
};

const normalizeConvertedCapacitorFileUrl = (value?: string) => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = trimTrailingSlashes(value.trim());
    return trimmed && isCapacitorFileUrl(trimmed) ? trimmed : undefined;
};

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
    if (isCapacitorFileUrl(value)) {
        return trimTrailingSlashes(value);
    }

    if (value.startsWith(CAPACITOR_FILE_PREFIX)) {
        return trimTrailingSlashes(value);
    }

    if (value.startsWith('/data/')
        || value.startsWith('/storage/')
        || value.startsWith('/sdcard/')) {
        if (isNativeCapacitorRuntime()) {
            const converted = normalizeConvertedCapacitorFileUrl(
                Capacitor.convertFileSrc(`file://${value}`),
            );
            if (converted) {
                return converted;
            }
        }
        return trimTrailingSlashes(`${CAPACITOR_FILE_PREFIX}${value}`);
    }

    if (value.startsWith('file:///')) {
        if (isNativeCapacitorRuntime()) {
            const converted = normalizeConvertedCapacitorFileUrl(
                Capacitor.convertFileSrc(value),
            );
            if (converted) {
                return converted;
            }
        }
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
