import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameManifestMobileDelivery } from '../../games/manifest.types';
import { logMobileRuntime, logMobileRuntimeCritical } from '../../lib/mobile/mobileRuntimeDebug';
import { onAppVisible } from '../../lib/mobile/appVisibility';
import {
    buildFallbackGamePackageManifest,
    hasRemoteGamePackageManifestEndpoint,
    resolveGamePackageManifest,
} from './manifestClient';
import {
    getNativeDownloadNotificationPermissionStatus,
    openNativeDownloadNotificationSettings,
} from './nativeGamePackagePlugin';
import {
    cancelGamePackageInstall as cancelGamePackageInstallTask,
    refreshGamePackageStateFromNativeTask,
    resetGamePackageState,
    startGamePackageInstall,
    subscribeGamePackageState,
    syncGamePackageState,
    uninstallGamePackage,
} from './packageManagerService';
import type { GamePackageCardState, PendingGamePackageInstall, ResolvedGamePackageManifest } from './types';
import {
    canInstallResolvedAssetPack,
    createDefaultGamePackageState,
    hasGamePackageUpdateAvailable,
    hasUsableInstalledGamePackageState,
    normalizeGamePackageVersion,
    toGamePackageCardState,
} from './types';

interface UseGamePackageStateOptions {
    gameId: string;
    gameName: string;
    delivery?: GameManifestMobileDelivery;
    enabled?: boolean;
}

interface UseGamePackageStateResult {
    isPackageManaged: boolean;
    cardState: GamePackageCardState;
    pendingInstall: PendingGamePackageInstall | null;
    isConfirmingInstall: boolean;
    requestInstall: () => void;
    dismissInstall: () => void;
    cancelInstall: () => void | Promise<void>;
    uninstallInstall: () => void | Promise<void>;
    confirmInstall: () => Promise<void>;
    retryInstall: () => void;
    notificationPermissionAction: 'retry' | 'settings' | null;
    openNotificationSettings: () => Promise<void>;
}

const mergeManifestIntoCardState = (
    state: GamePackageCardState,
    manifest?: ResolvedGamePackageManifest | null,
): GamePackageCardState => {
    if (!manifest) {
        return state;
    }

    return {
        ...state,
        modulePackId: state.modulePackId ?? manifest.modulePackId,
        assetPackId: state.assetPackId ?? manifest.assetPackId,
        manifestSource: manifest.source,
        modulePackUrl: state.modulePackUrl ?? manifest.modulePackUrl,
        assetPackUrl: state.assetPackUrl ?? manifest.assetPackUrl,
        modulePackBytes: state.modulePackBytes ?? manifest.modulePackBytes,
        assetPackBytes: state.assetPackBytes ?? manifest.assetPackBytes,
    };
};

const isInProgressStatus = (status: GamePackageCardState['status']) => (
    status === 'queued'
    || status === 'manifest'
    || status === 'downloading'
    || status === 'verifying'
);

const resolveManifestAvailableVersion = (
    manifest?: ResolvedGamePackageManifest | null,
) => normalizeGamePackageVersion(
    manifest?.assetPackVersion
    ?? manifest?.modulePackVersion,
);

export const shouldResetGamePackageStateBeforeRetry = (
    state: Pick<GamePackageCardState, 'status' | 'errorCode'>,
) => !(state.status === 'failed' && state.errorCode === 'checksum-mismatch');

const PREVIEW_MANIFEST_RETRY_BASE_DELAY_MS = 3000;
const PREVIEW_MANIFEST_RETRY_MAX_DELAY_MS = 15000;

export const useGamePackageState = ({
    gameId,
    gameName,
    delivery,
    enabled = true,
}: UseGamePackageStateOptions): UseGamePackageStateResult => {
    const { t } = useTranslation('lobby');
    const normalizedDelivery = useMemo(() => {
        if (!delivery) {
            return undefined;
        }

        return {
            mode: delivery.mode,
            runtimeChannel: delivery.runtimeChannel?.trim(),
            modulePackId: delivery.modulePackId?.trim(),
            assetPackId: delivery.assetPackId?.trim(),
            modulePackBytes: delivery.modulePackBytes,
            assetPackBytes: delivery.assetPackBytes,
        } satisfies GameManifestMobileDelivery;
    }, [
        delivery?.mode,
        delivery?.runtimeChannel,
        delivery?.modulePackId,
        delivery?.assetPackId,
        delivery?.modulePackBytes,
        delivery?.assetPackBytes,
    ]);
    const isPackageManaged = enabled && normalizedDelivery?.mode === 'package-managed';
    const fallbackState = useMemo(
        () => createDefaultGamePackageState(gameId, normalizedDelivery),
        [gameId, normalizedDelivery],
    );
    const fallbackManifest = useMemo(
        () => buildFallbackGamePackageManifest(gameId, normalizedDelivery),
        [gameId, normalizedDelivery],
    );
    const [cardState, setCardState] = useState<GamePackageCardState>(() =>
        toGamePackageCardState(
            isPackageManaged
                ? syncGamePackageState(gameId, fallbackState)
                : fallbackState,
        ),
    );
    const [pendingInstall, setPendingInstall] = useState<PendingGamePackageInstall | null>(null);
    const [isConfirmingInstall, setIsConfirmingInstall] = useState(false);
    const [previewManifest, setPreviewManifest] = useState<ResolvedGamePackageManifest | null>(null);
    const [notificationPermissionAction, setNotificationPermissionAction] = useState<'retry' | 'settings' | null>(null);
    const requestSerialRef = useRef(0);
    const confirmInFlightRef = useRef(false);

    const refreshNotificationPermissionAction = useCallback(async () => {
        const permissionStatus = await getNativeDownloadNotificationPermissionStatus();
        const nextAction = permissionStatus?.required === true && permissionStatus.granted === false
            ? (permissionStatus.canPrompt ? 'retry' : 'settings')
            : null;
        setNotificationPermissionAction(nextAction);
        return permissionStatus;
    }, []);

    useEffect(() => {
        logMobileRuntime('UseGamePackageState', 'hook-init', {
            gameId,
            gameName,
            enabled,
            isPackageManaged,
            delivery: normalizedDelivery,
            fallbackManifest,
        });
    }, [enabled, fallbackManifest, gameId, gameName, isPackageManaged, normalizedDelivery]);

    useEffect(() => {
        if (!isPackageManaged) {
            logMobileRuntime('UseGamePackageState', 'disable-package-managed', {
                gameId,
                fallbackState,
            });
            setPreviewManifest(null);
            setPendingInstall(null);
            setNotificationPermissionAction(null);
            setCardState(toGamePackageCardState(fallbackState));
            return;
        }

        logMobileRuntime('UseGamePackageState', 'sync-package-state', {
            gameId,
            fallbackState,
        });
        logMobileRuntimeCritical('UseGamePackageState', 'sync-package-state-critical', {
            gameId,
            fallbackStatus: fallbackState.status,
            fallbackUpdatedAt: fallbackState.updatedAt,
        });
        setPendingInstall(null);
        setCardState(toGamePackageCardState(syncGamePackageState(gameId, fallbackState)));
        void refreshNotificationPermissionAction();
        void refreshGamePackageStateFromNativeTask(gameId, fallbackState).catch((error) => {
            logMobileRuntime('UseGamePackageState', 'refresh-native-state-failed', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            }, 'warn');
            logMobileRuntimeCritical('UseGamePackageState', 'refresh-native-state-initial-failed', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });

        const cleanupVisible = onAppVisible(() => {
            logMobileRuntimeCritical('UseGamePackageState', 'app-visible-refresh-start', {
                gameId,
            });
            void refreshGamePackageStateFromNativeTask(gameId, fallbackState).catch((error) => {
                logMobileRuntime('UseGamePackageState', 'refresh-native-state-on-visible-failed', {
                    gameId,
                    error: error instanceof Error ? error.message : String(error),
                }, 'warn');
                logMobileRuntimeCritical('UseGamePackageState', 'app-visible-refresh-failed', {
                    gameId,
                    error: error instanceof Error ? error.message : String(error),
                });
            });
            void refreshNotificationPermissionAction();
        });

        const unsubscribeState = subscribeGamePackageState(gameId, (state) => {
            logMobileRuntime('UseGamePackageState', 'subscribe-state-changed', {
                gameId,
                state,
            });
            setCardState(toGamePackageCardState(state));
        });

        return () => {
            cleanupVisible();
            unsubscribeState();
        };
    }, [fallbackState, gameId, isPackageManaged, refreshNotificationPermissionAction]);

    useEffect(() => {
        if (cardState.errorCode !== 'notification-permission-required') {
            if (notificationPermissionAction !== null) {
                setNotificationPermissionAction(null);
            }
            return;
        }

        void refreshNotificationPermissionAction().then((permissionStatus) => {
            if (!permissionStatus || permissionStatus.required === true && permissionStatus.granted === false) {
                return;
            }

            resetGamePackageState(gameId, fallbackState);
        });
    }, [
        cardState.errorCode,
        fallbackState,
        gameId,
        notificationPermissionAction,
        refreshNotificationPermissionAction,
    ]);

    useEffect(() => {
        if (!isPackageManaged || !hasRemoteGamePackageManifestEndpoint) {
            setPreviewManifest(null);
            return;
        }

        let isDisposed = false;
        let retryAttempt = 0;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        setPreviewManifest(null);

        const resolvePreviewManifest = async () => {
            const resolvedManifest = await resolveGamePackageManifest(gameId, normalizedDelivery);
            if (isDisposed) {
                return;
            }

            logMobileRuntime('UseGamePackageState', 'preview-manifest-resolved', {
                gameId,
                resolvedManifest,
                retryAttempt,
            });
            setPreviewManifest(resolvedManifest);

            if (resolvedManifest.source === 'remote') {
                retryAttempt = 0;
                return;
            }

            const retryDelayMs = Math.min(
                PREVIEW_MANIFEST_RETRY_BASE_DELAY_MS * (2 ** retryAttempt),
                PREVIEW_MANIFEST_RETRY_MAX_DELAY_MS,
            );
            retryAttempt += 1;
            logMobileRuntimeCritical('UseGamePackageState', 'preview-manifest-retry-scheduled', {
                gameId,
                retryDelayMs,
                nextRetryAttempt: retryAttempt,
            });
            retryTimer = setTimeout(() => {
                retryTimer = null;
                if (isDisposed) {
                    return;
                }
                void resolvePreviewManifest();
            }, retryDelayMs);
        };

        void resolvePreviewManifest();

        return () => {
            isDisposed = true;
            if (retryTimer !== null) {
                clearTimeout(retryTimer);
            }
        };
    }, [gameId, isPackageManaged, normalizedDelivery]);

    useEffect(() => {
        if (!pendingInstall) {
            return;
        }

        if (!hasUsableInstalledGamePackageState(cardState)) {
            return;
        }

        const pendingInstallAvailableVersion = resolveManifestAvailableVersion(pendingInstall);
        if (hasGamePackageUpdateAvailable(cardState.installedVersion, pendingInstallAvailableVersion)) {
            return;
        }

        requestSerialRef.current += 1;
        setPendingInstall(null);
        confirmInFlightRef.current = false;
        setIsConfirmingInstall(false);
    }, [cardState.installedVersion, cardState.localAssetBaseUrl, cardState.status, pendingInstall]);

    const displayCardState = useMemo(
        () => {
            const manifest = previewManifest ?? fallbackManifest;
            const availableVersion = resolveManifestAvailableVersion(manifest);

            return {
                ...mergeManifestIntoCardState(cardState, manifest),
                previewResolved: Boolean(previewManifest),
                availableVersion,
                isUpdateAvailable: hasGamePackageUpdateAvailable(cardState.installedVersion, availableVersion),
            };
        },
        [cardState, fallbackManifest, previewManifest],
    );

    const requestInstall = useCallback(() => {
        logMobileRuntimeCritical('UseGamePackageState', 'request-install-clicked', {
            gameId,
            isPackageManaged,
        });
        if (!isPackageManaged) {
            logMobileRuntime('UseGamePackageState', 'request-install-skipped', {
                gameId,
                reason: 'not-package-managed',
            }, 'warn');
            return;
        }

        const requestSerial = requestSerialRef.current + 1;
        requestSerialRef.current = requestSerial;
        logMobileRuntime('UseGamePackageState', 'request-install', {
            gameId,
            requestSerial,
            fallbackManifest,
            previewManifest,
        });
        const initialInstallManifest = previewManifest ?? fallbackManifest;
        setPendingInstall({
            gameName,
            ...initialInstallManifest,
        });

        if (!hasRemoteGamePackageManifestEndpoint) {
            logMobileRuntime('UseGamePackageState', 'request-install-no-remote-endpoint', {
                gameId,
                requestSerial,
            }, 'warn');
            return;
        }

        if (previewManifest?.source === 'remote') {
            logMobileRuntime('UseGamePackageState', 'request-install-use-preview-manifest', {
                gameId,
                requestSerial,
                hasAssetPackUrl: Boolean(previewManifest.assetPackUrl),
            });
            return;
        }

        void resolveGamePackageManifest(gameId, normalizedDelivery).then((resolvedManifest) => {
            logMobileRuntime('UseGamePackageState', 'request-install-remote-manifest-resolved', {
                gameId,
                requestSerial,
                resolvedManifest,
            });
            setPendingInstall((current) => {
                if (!current || requestSerialRef.current !== requestSerial) {
                    logMobileRuntime('UseGamePackageState', 'request-install-remote-manifest-stale', {
                        gameId,
                        requestSerial,
                        currentExists: Boolean(current),
                        latestRequestSerial: requestSerialRef.current,
                    }, 'warn');
                    return current;
                }

                return {
                    gameName,
                    ...resolvedManifest,
                };
            });
        });
    }, [fallbackManifest, gameId, gameName, isPackageManaged, normalizedDelivery, previewManifest]);

    const cancelInstall = useCallback(async () => {
        requestSerialRef.current += 1;
        const cancelSource = new Error('UseGamePackageState.cancelInstall source');
        logMobileRuntime('UseGamePackageState', 'cancel-install', {
            gameId,
            latestRequestSerial: requestSerialRef.current,
            currentStatus: cardState.status,
            sourceStack: cancelSource.stack,
        });
        setPendingInstall(null);
        if (!isInProgressStatus(cardState.status)) {
            logMobileRuntimeCritical('UseGamePackageState', 'cancel-install-skip-native-not-in-progress', {
                gameId,
                currentStatus: cardState.status,
                latestRequestSerial: requestSerialRef.current,
                sourceStack: cancelSource.stack,
            });
            return;
        }

        try {
            await cancelGamePackageInstallTask(gameId, fallbackState);
        } catch (error) {
            logMobileRuntimeCritical('UseGamePackageState', 'cancel-install-native-failed', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }, [cardState.status, fallbackState, gameId]);

    const dismissInstall = useCallback(() => {
        requestSerialRef.current += 1;
        logMobileRuntime('UseGamePackageState', 'dismiss-install', {
            gameId,
            latestRequestSerial: requestSerialRef.current,
            currentStatus: cardState.status,
        });
        setPendingInstall(null);
    }, [cardState.status, gameId]);

    const uninstallInstall = useCallback(async () => {
        requestSerialRef.current += 1;
        logMobileRuntimeCritical('UseGamePackageState', 'uninstall-install', {
            gameId,
            latestRequestSerial: requestSerialRef.current,
            currentStatus: cardState.status,
        });
        setPendingInstall(null);
        try {
            const nextState = await uninstallGamePackage(gameId, fallbackState);
            setCardState(toGamePackageCardState(nextState));
        } catch (error) {
            logMobileRuntimeCritical('UseGamePackageState', 'uninstall-install-failed', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }, [cardState.status, fallbackState, gameId]);

    const confirmInstall = useCallback(async () => {
        logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-clicked', {
            gameId,
            hasPendingInstall: Boolean(pendingInstall),
            isConfirmingInstall,
            confirmInFlight: confirmInFlightRef.current,
        });
        if (confirmInFlightRef.current || isConfirmingInstall) {
            logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-ignored', {
                gameId,
                reason: confirmInFlightRef.current ? 'confirm-ref-locked' : 'already-confirming',
            });
            return;
        }
        if (!pendingInstall) {
            logMobileRuntime('UseGamePackageState', 'confirm-install-skipped', {
                gameId,
                reason: 'no-pending-install',
            }, 'warn');
            return;
        }

        confirmInFlightRef.current = true;
        setIsConfirmingInstall(true);
        let installManifest = pendingInstall;

        try {
            logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-started', {
                gameId,
                manifestSource: installManifest.source,
                hasAssetPackUrl: Boolean(installManifest.assetPackUrl),
                assetPackVersion: installManifest.assetPackVersion,
                hasAssetPackFileIndexUrl: Boolean(installManifest.assetPackFileIndexUrl),
                assetPackDiffOnly: installManifest.assetPackDiffOnly === true,
                hasSharedAudioPackUrl: Boolean(installManifest.sharedAudioPackUrl),
                sharedAudioPackVersion: installManifest.sharedAudioPackVersion,
            });

            if (!canInstallResolvedAssetPack(installManifest) && hasRemoteGamePackageManifestEndpoint) {
                logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-re-resolve', {
                    gameId,
                    reason: 'missing-asset-pack-url',
                });
                try {
                    const resolved = await resolveGamePackageManifest(gameId, normalizedDelivery);
                    installManifest = { ...installManifest, ...resolved };
                    setPendingInstall(installManifest);
                    logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-manifest-resolved', {
                        gameId,
                        manifestSource: installManifest.source,
                        hasAssetPackUrl: Boolean(installManifest.assetPackUrl),
                        assetPackVersion: installManifest.assetPackVersion,
                        hasAssetPackFileIndexUrl: Boolean(installManifest.assetPackFileIndexUrl),
                        assetPackDiffOnly: installManifest.assetPackDiffOnly === true,
                        hasSharedAudioPackUrl: Boolean(installManifest.sharedAudioPackUrl),
                        sharedAudioPackVersion: installManifest.sharedAudioPackVersion,
                    });
                } catch {
                    logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-re-resolve-failed', { gameId });
                }
            }

            if (!canInstallResolvedAssetPack(installManifest)) {
                logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-manifest-still-missing-url', {
                    gameId,
                    manifestSource: installManifest.source,
                    assetPackId: installManifest.assetPackId,
                    assetPackVersion: installManifest.assetPackVersion,
                    hasAssetPackUrl: Boolean(installManifest.assetPackUrl),
                    hasAssetPackFileIndexUrl: Boolean(installManifest.assetPackFileIndexUrl),
                    assetPackDiffOnly: installManifest.assetPackDiffOnly === true,
                    hasSharedAudioPackUrl: Boolean(installManifest.sharedAudioPackUrl),
                    sharedAudioPackVersion: installManifest.sharedAudioPackVersion,
                });
                const state = await startGamePackageInstall(installManifest, t('packageManager.runtimeUnsupported'));
                logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-blocked-before-native', {
                    gameId,
                    resultStatus: state.status,
                    errorCode: state.errorCode,
                    errorMessage: state.errorMessage,
                });
                return;
            }

            logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-start-install', {
                gameId,
                manifestSource: installManifest.source,
                hasAssetPackUrl: Boolean(installManifest.assetPackUrl),
                assetPackDiffOnly: installManifest.assetPackDiffOnly === true,
                hasAssetPackFileIndexUrl: Boolean(installManifest.assetPackFileIndexUrl),
                assetPackVersion: installManifest.assetPackVersion,
                hasSharedAudioPackUrl: Boolean(installManifest.sharedAudioPackUrl),
                sharedAudioPackVersion: installManifest.sharedAudioPackVersion,
            });
            const state = await startGamePackageInstall(installManifest, t('packageManager.runtimeUnsupported'));
            logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-finished', {
                gameId,
                resultStatus: state.status,
                errorMessage: state.errorMessage,
                installedVersion: state.installedVersion,
            });
        } catch (error) {
            logMobileRuntimeCritical('UseGamePackageState', 'confirm-install-rejected', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            confirmInFlightRef.current = false;
            setIsConfirmingInstall(false);
        }
    }, [gameId, isConfirmingInstall, normalizedDelivery, pendingInstall, t]);

    const retryInstall = useCallback(() => {
        if (!isPackageManaged) {
            logMobileRuntime('UseGamePackageState', 'retry-install-skipped', {
                gameId,
                reason: 'not-package-managed',
            }, 'warn');
            return;
        }

        logMobileRuntime('UseGamePackageState', 'retry-install', {
            gameId,
            pendingInstall,
            fallbackState,
            currentStatus: cardState.status,
            currentErrorCode: cardState.errorCode,
        });
        if (shouldResetGamePackageStateBeforeRetry(cardState)) {
            resetGamePackageState(gameId, fallbackState);
        } else {
            logMobileRuntimeCritical('UseGamePackageState', 'retry-preserve-checksum-failure-for-full-fallback', {
                gameId,
                currentStatus: cardState.status,
                currentErrorCode: cardState.errorCode,
            });
        }
        if (pendingInstall) {
            void confirmInstall();
            return;
        }

        requestInstall();
    }, [cardState, confirmInstall, fallbackState, gameId, isPackageManaged, pendingInstall, requestInstall]);

    const openNotificationSettings = useCallback(async () => {
        await openNativeDownloadNotificationSettings();
    }, []);

    return {
        isPackageManaged,
        cardState: displayCardState,
        pendingInstall,
        isConfirmingInstall,
        requestInstall,
        dismissInstall,
        cancelInstall,
        uninstallInstall,
        confirmInstall,
        retryInstall,
        notificationPermissionAction,
        openNotificationSettings,
    };
};
