import type { TFunction } from 'i18next';
import packageJson from '../../../package.json';
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
    errorMessage?: string,
) => {
    switch (resolveGamePackageFailureErrorCode(errorCode, errorMessage)) {
        case 'manifest-fetch-failed':
            return 'packageManager.manifestFetchFailedHint';
        case 'manifest-missing':
            return 'packageManager.manifestMissingHint';
        case 'checksum-mismatch':
            return 'packageManager.checksumMismatchHint';
        case 'resume-not-supported':
            return 'packageManager.resumeNotSupportedHint';
        default:
            return 'packageManager.failedHint';
    }
};

const appVersion = packageJson.version;
const androidVersionCode = packageJson.androidVersionCode;

const normalizeErrorMessage = (errorMessage?: string) => (
    typeof errorMessage === 'string' ? errorMessage.trim() : ''
);

export const resolveGamePackageFailureErrorCode = (
    errorCode?: GamePackageInstallErrorCode,
    errorMessage?: string,
): GamePackageInstallErrorCode | undefined => {
    const normalizedMessage = normalizeErrorMessage(errorMessage);
    if (
        /拒绝增量续传/u.test(normalizedMessage)
        || /拒绝续传/u.test(normalizedMessage)
        || /不可续传/u.test(normalizedMessage)
        || /range not satisfiable/i.test(normalizedMessage)
    ) {
        return 'resume-not-supported';
    }
    if (
        /增量文件(?:校验失败|大小不符)/u.test(normalizedMessage)
        || /本地临时文件.*校验/u.test(normalizedMessage)
        || /checksum/i.test(normalizedMessage)
    ) {
        return 'checksum-mismatch';
    }
    return errorCode;
};

const shouldUseStructuredFailureMessage = (
    errorCode?: GamePackageInstallErrorCode,
    errorMessage?: string,
) => {
    const resolvedErrorCode = resolveGamePackageFailureErrorCode(errorCode, errorMessage);
    return resolvedErrorCode === 'checksum-mismatch'
        || resolvedErrorCode === 'resume-not-supported';
};

export const resolveGamePackageFailureMessage = (
    t: TFunction<'lobby'>,
    errorCode?: GamePackageInstallErrorCode,
    errorMessage?: string,
) => {
    if (!shouldUseStructuredFailureMessage(errorCode, errorMessage)) {
        const normalizedMessage = normalizeErrorMessage(errorMessage);
        if (normalizedMessage) {
            return normalizedMessage;
        }
    }

    return t(getGamePackageFailureMessageKey(errorCode, errorMessage), {
        version: appVersion,
        versionCode: androidVersionCode,
    });
};

export const resolveGamePackageFailureActionLabel = (
    t: TFunction<'lobby'>,
    errorCode?: GamePackageInstallErrorCode,
    errorMessage?: string,
) => {
    const resolvedErrorCode = resolveGamePackageFailureErrorCode(errorCode, errorMessage);
    if (resolvedErrorCode === 'checksum-mismatch' || resolvedErrorCode === 'resume-not-supported') {
        return t('packageManager.retryFullDownloadAction');
    }

    return t('packageManager.retryAction');
};
