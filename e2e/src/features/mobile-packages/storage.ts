import type { GamePackageInstallErrorCode, StoredGamePackageState } from './types';
import { mergeGamePackageState } from './types';
import { normalizeGamePackageAssetBaseUrl } from './assetBaseUrl';

const STORAGE_PREFIX = 'mobile-package-state:';
export const STALE_IN_PROGRESS_ERROR_MESSAGE = '上次下载未完成，请重新发起。';

const getStorage = () => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return null;
    }

    return window.localStorage;
};

const getStorageKey = (gameId: string) => `${STORAGE_PREFIX}${gameId}`;

const isValidStatus = (value: unknown): value is StoredGamePackageState['status'] =>
    value === 'not-installed'
    || value === 'queued'
    || value === 'manifest'
    || value === 'downloading'
    || value === 'verifying'
    || value === 'installed'
    || value === 'failed';

const isValidProgressMode = (value: unknown): value is StoredGamePackageState['progressMode'] =>
    value === undefined || value === 'determinate' || value === 'indeterminate';

const isValidErrorCode = (value: unknown): value is GamePackageInstallErrorCode =>
    value === undefined
    || value === 'network-timeout'
    || value === 'http-error'
    || value === 'resume-not-supported'
    || value === 'checksum-mismatch'
    || value === 'insufficient-storage'
    || value === 'archive-invalid'
    || value === 'file-io'
    || value === 'cancelled'
    || value === 'task-conflict'
    || value === 'manifest-missing'
    || value === 'notification-permission-required'
    || value === 'unsupported-runtime'
    || value === 'unknown';

const sanitizeStoredState = (
    gameId: string,
    raw: unknown,
): Partial<StoredGamePackageState> | null => {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.gameId === 'string' && candidate.gameId !== gameId) {
        return null;
    }

    if (
        !isValidStatus(candidate.status)
        || !isValidProgressMode(candidate.progressMode)
        || !isValidErrorCode(candidate.errorCode)
    ) {
        return null;
    }

    return {
        gameId,
        runtimeChannel: typeof candidate.runtimeChannel === 'string' && candidate.runtimeChannel.trim()
            ? candidate.runtimeChannel.trim()
            : undefined,
        status: candidate.status,
        progressPercent: typeof candidate.progressPercent === 'number' && Number.isFinite(candidate.progressPercent)
            ? candidate.progressPercent
            : undefined,
        progressMode: candidate.progressMode,
        modulePackId: typeof candidate.modulePackId === 'string' && candidate.modulePackId.trim()
            ? candidate.modulePackId.trim()
            : undefined,
        assetPackId: typeof candidate.assetPackId === 'string' && candidate.assetPackId.trim()
            ? candidate.assetPackId.trim()
            : undefined,
        modulePackBytes: typeof candidate.modulePackBytes === 'number' && Number.isFinite(candidate.modulePackBytes)
            ? candidate.modulePackBytes
            : undefined,
        assetPackBytes: typeof candidate.assetPackBytes === 'number' && Number.isFinite(candidate.assetPackBytes)
            ? candidate.assetPackBytes
            : undefined,
        installedVersion: typeof candidate.installedVersion === 'string' && candidate.installedVersion.trim()
            ? candidate.installedVersion.trim()
            : undefined,
        localAssetBaseUrl: typeof candidate.localAssetBaseUrl === 'string' && candidate.localAssetBaseUrl.trim()
            ? normalizeGamePackageAssetBaseUrl(candidate.localAssetBaseUrl.trim())
            : undefined,
        errorCode: candidate.errorCode,
        errorMessage: typeof candidate.errorMessage === 'string' && candidate.errorMessage.trim()
            ? candidate.errorMessage
            : undefined,
        updatedAt: typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
            ? candidate.updatedAt
            : undefined,
    };
};

export const readStoredGamePackageState = (
    gameId: string,
    fallbackState: StoredGamePackageState,
): StoredGamePackageState => {
    const storage = getStorage();
    if (!storage) {
        return fallbackState;
    }

    try {
        const raw = storage.getItem(getStorageKey(gameId));
        if (!raw) {
            return fallbackState;
        }

        const parsed = sanitizeStoredState(gameId, JSON.parse(raw));
        if (!parsed) {
            return fallbackState;
        }

        return mergeGamePackageState(fallbackState, parsed);
    } catch {
        return fallbackState;
    }
};

export const writeStoredGamePackageState = (state: StoredGamePackageState) => {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    try {
        storage.setItem(getStorageKey(state.gameId), JSON.stringify({
            ...state,
            localAssetBaseUrl: normalizeGamePackageAssetBaseUrl(state.localAssetBaseUrl),
        }));
    } catch {
        // 忽略 localStorage 不可用或空间不足
    }
};

export const clearStoredGamePackageState = (gameId: string) => {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    try {
        storage.removeItem(getStorageKey(gameId));
    } catch {
        // 忽略 localStorage 不可用
    }
};
