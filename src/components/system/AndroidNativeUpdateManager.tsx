import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import {
    HIDDEN_ANDROID_NATIVE_UPDATE_STATE,
    checkAndroidNativeUpdateAvailability,
    continueAndroidNativeUpdateInstall,
    mapNativeUpdateEventToState,
    openAndroidUnknownSourcesSettings,
    readPreparedAndroidUpdateState,
    requestAndroidNativeUpdateCheck,
    startAndroidNativeUpdatePreload,
    type AndroidPreparedUpdateState,
    type AndroidNativeUpdateManifest,
    type AndroidNativeUpdateState,
    readAndroidNativeUpdateConfig,
    subscribeAndroidNativeUpdateRequests,
    subscribeAndroidNativeUpdateState,
} from '../../lib/mobile/androidNativeUpdates';
import { logMobileRuntimeCritical } from '../../lib/mobile/mobileRuntimeDebug';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { AndroidNativeUpdateGate } from './AndroidNativeUpdateGate';
import { canActivateMobileUpdate } from '../../lib/mobile/updateActivationSafety';
import { consumeNativeUpdateAfterOta } from '../../lib/mobile/mobileUpdateHandoff';

let hasAutoStartedAndroidNativeUpdateCheck = false;

const shouldAutoResumePreparedUpdate = (state: AndroidPreparedUpdateState) => (
    state.status === 'queued'
    || state.status === 'downloading'
    || state.status === 'verifying'
);


const normalizeRecoveredPreparedUpdate = (state: AndroidPreparedUpdateState): AndroidPreparedUpdateState => {
    if (state.status !== 'installing') {
        return state;
    }

    return {
        ...state,
        status: 'permission-required',
    };
};

const isPrepareResultTaskStatus = (
    status: string | undefined,
): status is AndroidPreparedUpdateState['status'] => (
    status === 'queued'
    || status === 'downloading'
    || status === 'verifying'
    || status === 'prepared'
    || status === 'permission-required'
    || status === 'installing'
    || status === 'error'
);

export const AndroidNativeUpdateManager = ({ isPlayRoute = false }: { isPlayRoute?: boolean }) => {
    const toast = useToast();
    const { t } = useTranslation('lobby');
    const isNativeAndroid = isNativeAndroidRuntime();
    const [state, setState] = useState<AndroidNativeUpdateState>(HIDDEN_ANDROID_NATIVE_UPDATE_STATE);
    const pendingManifestRef = useRef<AndroidNativeUpdateManifest | null>(null);
    const interactiveRef = useRef(false);
    const installStartedRef = useRef(false);
    const attemptRef = useRef(0);
    const dismissedRef = useRef(false);
    const toastRef = useRef(toast);
    const tRef = useRef(t);

    useEffect(() => {
        toastRef.current = toast;
        tRef.current = t;
    }, [toast, t]);

    useEffect(() => {
        if (!isNativeAndroid) {
            return;
        }

        let disposed = false;
        let listenerHandlePromise: Promise<{ remove(): Promise<void> } | null> | null = null;
        const publishState = (nextState: AndroidNativeUpdateState) => {
            if (disposed || dismissedRef.current || !interactiveRef.current) {
                return;
            }
            setState(nextState);
        };

        const applyCheck = async (interactive = false) => {
            const attempt = ++attemptRef.current;
            try {
                interactiveRef.current = interactive;
                const config = readAndroidNativeUpdateConfig();
                if (!config.enabled) {
                    pendingManifestRef.current = null;
                    publishState(HIDDEN_ANDROID_NATIVE_UPDATE_STATE);
                    interactiveRef.current = false;
                    if (interactive) {
                        toastRef.current.warning(tRef.current('nativeUpdate.toast.disabled'));
                    }
                    return;
                }

                const availability = await checkAndroidNativeUpdateAvailability();
                if (disposed || dismissedRef.current || attempt !== attemptRef.current) {
                    return;
                }

                if (!availability.available || !availability.manifest) {
                    pendingManifestRef.current = null;
                    publishState(HIDDEN_ANDROID_NATIVE_UPDATE_STATE);
                    interactiveRef.current = false;
                    if (interactive && availability.reason === 'up-to-date') {
                        toastRef.current.success(tRef.current('nativeUpdate.toast.upToDate'), '应用更新', {
                            dedupeKey: 'android-native-update:up-to-date',
                            ttlMs: 4000,
                        });
                    }
                    return;
                }

                pendingManifestRef.current = availability.manifest;
                const preparedState = await readPreparedAndroidUpdateState(availability.manifest.version);
                if (disposed || dismissedRef.current || attempt !== attemptRef.current) {
                    return;
                }

                interactiveRef.current = interactive;
                const shouldBlock = interactive;
                const displayTitle = availability.manifest.forceUpdateTitle || undefined;
                const displayMessage = availability.manifest.forceUpdateMessage || undefined;

                logMobileRuntimeCritical('NativeUpdate', 'manager-apply-check', {
                    interactive,
                    manifestVersion: availability.manifest.version,
                    forceUpdate: availability.manifest.forceUpdate === true,
                    preparedState,
                });

                if (preparedState) {
                    const recoveredState = normalizeRecoveredPreparedUpdate(preparedState);
                    publishState(mapNativeUpdateEventToState(recoveredState, {
                        blocking: shouldBlock,
                        title: displayTitle,
                        message: displayMessage,
                    }));

                    if (
                        !shouldAutoResumePreparedUpdate(preparedState)
                        && !(interactive && preparedState.status === 'error')
                    ) {
                        if (interactive && !installStartedRef.current && !dismissedRef.current && canActivateMobileUpdate() && preparedState.status === 'prepared') {
                            try {
                                installStartedRef.current = true;
                                const installResult = await continueAndroidNativeUpdateInstall(availability.manifest.version);
                                if (disposed) {
                                    return;
                                }
                                logMobileRuntimeCritical('NativeUpdate', 'manager-continue-install-result', {
                                    manifestVersion: availability.manifest.version,
                                    result: installResult,
                                });
                                return;
                            } catch (error) {
                                if (disposed) {
                                    return;
                                }
                                logMobileRuntimeCritical('NativeUpdate', 'manager-continue-install-failed', {
                                    manifestVersion: availability.manifest.version,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                                publishState({
                                    phase: 'error',
                                    blocking: shouldBlock,
                                    version: availability.manifest.version,
                                    reason: error instanceof Error ? error.message : String(error),
                                    title: displayTitle,
                                    message: displayMessage,
                                });
                                return;
                            }
                        }
                        return;
                    }
                }

                publishState({
                    phase: 'checking',
                    blocking: shouldBlock,
                    version: availability.manifest.version,
                    title: displayTitle,
                    message: displayMessage,
                });

                try {
                    const result = await startAndroidNativeUpdatePreload(availability.manifest);
                    if (disposed || dismissedRef.current || attempt !== attemptRef.current) {
                        return;
                    }
                    if (interactive && !installStartedRef.current && !dismissedRef.current && canActivateMobileUpdate() && result.status === 'prepared') {
                        installStartedRef.current = true;
                        await continueAndroidNativeUpdateInstall(availability.manifest.version);
                        return;
                    }
                    logMobileRuntimeCritical('NativeUpdate', 'manager-prepare-result', {
                        manifestVersion: availability.manifest.version,
                        result,
                    });
                    if (isPrepareResultTaskStatus(result.status)) {
                        const recoveredLiveState = normalizeRecoveredPreparedUpdate({
                            version: typeof result.version === 'string' && result.version.trim()
                                ? result.version.trim()
                                : availability.manifest.version,
                            status: result.status,
                            progressPercent: result.progressPercent,
                            progressMode: result.progressMode,
                            errorCode: result.errorCode,
                            errorMessage: result.errorMessage,
                            apkFilePath: result.apkFilePath,
                        });
                        publishState(mapNativeUpdateEventToState(recoveredLiveState, {
                            blocking: shouldBlock,
                            title: displayTitle,
                            message: displayMessage,
                        }));
                    }
                    if (result.status === 'installer-launched' && availability.manifest.forceUpdate !== true) {
                        toastRef.current.info(tRef.current('nativeUpdate.toast.installerOpened'), '应用更新', {
                            dedupeKey: `android-native-update:installer:${availability.manifest.version}`,
                            ttlMs: 5000,
                        });
                    }
                } catch (error) {
                    if (disposed) {
                        return;
                    }
                    logMobileRuntimeCritical('NativeUpdate', 'manager-prepare-failed', {
                        manifestVersion: availability.manifest.version,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    publishState({
                        phase: 'error',
                        blocking: shouldBlock,
                        version: availability.manifest.version,
                        reason: error instanceof Error ? error.message : String(error),
                        title: displayTitle,
                        message: displayMessage,
                    });
                }
            } catch (error) {
                if (disposed) {
                    return;
                }
                const message = error instanceof Error ? error.message : String(error);
                logMobileRuntimeCritical('NativeUpdate', 'manager-check-failed', {
                    interactive,
                    error: message,
                });
                pendingManifestRef.current = null;
                publishState({
                    phase: 'error',
                    blocking: interactive,
                    reason: message,
                    title: tRef.current('nativeUpdate.title.error'),
                    message: tRef.current('nativeUpdate.description.checkFailed'),
                });
                interactiveRef.current = false;
            }
        };

        listenerHandlePromise = subscribeAndroidNativeUpdateState((event) => {
            if (disposed || dismissedRef.current || !pendingManifestRef.current) {
                return;
            }

            const manifest = pendingManifestRef.current;
            if (event.status === 'prepared' && interactiveRef.current && !installStartedRef.current && canActivateMobileUpdate()) {
                installStartedRef.current = true;
                void continueAndroidNativeUpdateInstall(manifest.version).catch((error) => {
                    publishState({ phase: 'error', blocking: true, version: manifest.version,
                        reason: error instanceof Error ? error.message : String(error) });
                });
                return;
            }
            publishState(mapNativeUpdateEventToState(event, {
                blocking: interactiveRef.current,
                title: manifest.forceUpdateTitle || undefined,
                message: manifest.forceUpdateMessage || undefined,
            }));
        });

        const unsubscribeRequest = subscribeAndroidNativeUpdateRequests((request) => {
            dismissedRef.current = false;
            installStartedRef.current = false;
            void applyCheck(request.interactive !== false);
        });

        if (!hasAutoStartedAndroidNativeUpdateCheck) {
            hasAutoStartedAndroidNativeUpdateCheck = true;
            const continueManualUpdate = consumeNativeUpdateAfterOta() && canActivateMobileUpdate();
            void applyCheck(continueManualUpdate);
        }

        return () => {
            disposed = true;
            unsubscribeRequest();
            if (listenerHandlePromise) {
                void listenerHandlePromise.then((handle) => handle?.remove());
            }
        };
    }, [isNativeAndroid]);

    if (!isNativeAndroid || isPlayRoute) {
        return null;
    }

    const handleRetry = () => {
        dismissedRef.current = false;
        requestAndroidNativeUpdateCheck({ interactive: true });
    };

    const handleOpenSettings = () => {
        void openAndroidUnknownSourcesSettings().catch((error) => {
            toastRef.current.error(error instanceof Error ? error.message : tRef.current('nativeUpdate.toast.openSettingsFailed'));
        });
    };

    const handleContinueInstall = () => {
        const manifest = pendingManifestRef.current;
        if (!manifest) {
            toastRef.current.warning(tRef.current('nativeUpdate.toast.missingPreparedUpdate'));
            return;
        }

        void continueAndroidNativeUpdateInstall(manifest.version).catch((error) => {
            setState({
                phase: 'error',
                blocking: true,
                version: manifest.version,
                reason: error instanceof Error ? error.message : String(error),
                title: manifest.forceUpdateTitle || undefined,
                message: manifest.forceUpdateMessage || undefined,
            });
        });
    };

    return (
        <AndroidNativeUpdateGate
            state={state}
            onDismiss={() => {
                dismissedRef.current = true;
                attemptRef.current += 1;
                setState(HIDDEN_ANDROID_NATIVE_UPDATE_STATE);
            }}
            onRetry={handleRetry}
            onOpenSettings={handleOpenSettings}
            onContinueInstall={handleContinueInstall}
        />
    );
};

export default AndroidNativeUpdateManager;
