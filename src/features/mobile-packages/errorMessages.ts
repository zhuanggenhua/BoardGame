import type { TFunction } from 'i18next';
import type { GamePackageInstallErrorCode, ResolvedGamePackageManifest } from './types';

export const resolveMissingAssetPackErrorCode = (
    manifest: Pick<ResolvedGamePackageManifest, 'source'>,
): GamePackageInstallErrorCode => (
    manifest.source === 'fallback'
        ? 'manifest-fetch-failed'
        : 'manifest-missing'
);

export const getGamePackageFailureMessageKey = (
    errorCode?: GamePackageInstallErrorCode,
) => {
    switch (errorCode) {
        case 'manifest-fetch-failed':
            return 'packageManager.manifestFetchFailedHint';
        case 'manifest-missing':
            return 'packageManager.manifestMissingHint';
        default:
            return 'packageManager.failedHint';
    }
};

export const resolveGamePackageFailureMessage = (
    t: TFunction<'lobby'>,
    errorCode?: GamePackageInstallErrorCode,
    errorMessage?: string,
) => {
    if (typeof errorMessage === 'string' && errorMessage.trim()) {
        return errorMessage;
    }

    return t(getGamePackageFailureMessageKey(errorCode));
};
