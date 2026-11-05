import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { AndroidForceUpdateGate } from './AndroidForceUpdateGate';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { isNativeMobileRuntime } from '../../lib/mobile/mobileRuntime';
import {
    type AndroidForceUpdateState,
    registerAndroidLiveUpdateListeners,
    subscribeAndroidLiveUpdateRequests,
    startAndroidLiveUpdateBackgroundCheck,
} from '../../lib/mobile/androidLiveUpdates';
import { requestAndroidNativeUpdateCheck } from '../../lib/mobile/androidNativeUpdates';
import { shouldShowAndroidOtaToastOncePerDay } from '../../lib/mobile/otaToastGate';

let hasAutoStartedAndroidLiveUpdateCheck = false;
const HIDDEN_FORCE_UPDATE_STATE: AndroidForceUpdateState = {
    phase: 'hidden',
    blocking: false,
};

export const AndroidLiveUpdateManager = () => {
    const { t } = useTranslation('lobby');
    const toast = useToast();
    const isNativeAndroid = isNativeAndroidRuntime();
    const isNativeMobile = isNativeAndroid || isNativeMobileRuntime();
    const [forceUpdateState, setForceUpdateState] = useState<AndroidForceUpdateState>(HIDDEN_FORCE_UPDATE_STATE);
    const dismissedRef = useRef(false);

    useEffect(() => {
        if (!isNativeMobile) {
            return;
        }

        let disposed = false;

        void registerAndroidLiveUpdateListeners();
        const publishState = (state: AndroidForceUpdateState) => {
            if (disposed || dismissedRef.current) {
                return;
            }
            setForceUpdateState(state);
        };

        const handleResult = (
            result: Awaited<ReturnType<typeof startAndroidLiveUpdateBackgroundCheck>>,
            options?: { interactive?: boolean },
        ) => {
            if (disposed) return;

            if (result.status === 'queued') {
                return;
            }

            if (result.status === 'up-to-date' && options?.interactive) {
                publishState(HIDDEN_FORCE_UPDATE_STATE);
                if (shouldShowAndroidOtaToastOncePerDay('up-to-date')) {
                    toast.success(t('nativeUpdate.toast.upToDate'), t('nativeUpdate.eyebrow'), {
                        dedupeKey: 'android-ota-up-to-date',
                        ttlMs: 3000,
                    });
                }
                return;
            }

            if (
                result.status === 'up-to-date'
                || result.status === 'disabled'
                || result.status === 'not-native'
            ) {
                publishState(HIDDEN_FORCE_UPDATE_STATE);
                return;
            }

            if (result.status === 'error') {
                console.warn('[OTA] 后台检查失败', result.reason);
                return;
            }

            if (result.status === 'incompatible') {
                console.info('[OTA] 检测到不兼容更新，已跳过', result.reason);
                if (isNativeAndroid) {
                    requestAndroidNativeUpdateCheck({ interactive: options?.interactive === true });
                }
            }
        };

        if (!hasAutoStartedAndroidLiveUpdateCheck) {
            hasAutoStartedAndroidLiveUpdateCheck = true;
            void startAndroidLiveUpdateBackgroundCheck({
                onForceStateChange: (state) => {
                    publishState(state);
                },
                applyMode: 'background',
            }).then((result) => {
                handleResult(result);
            });
        }

        const unsubscribeRequest = subscribeAndroidLiveUpdateRequests((request) => {
            dismissedRef.current = false;
            void startAndroidLiveUpdateBackgroundCheck({
                force: true,
                applyMode: request.applyMode ?? 'immediate',
                initialImmediatePhase: request.initialImmediatePhase,
                onForceStateChange: (state) => {
                    publishState(state);
                },
            }).then((result) => {
                handleResult(result, { interactive: request.interactive });
            });
        });

        return () => {
            disposed = true;
            unsubscribeRequest();
        };
    }, [isNativeAndroid, isNativeMobile, t, toast]);

    if (!isNativeMobile) {
        return null;
    }

    return (
        <AndroidForceUpdateGate
            state={forceUpdateState}
            onDismiss={() => {
                dismissedRef.current = true;
                setForceUpdateState(HIDDEN_FORCE_UPDATE_STATE);
            }}
            onRetry={() => {
                dismissedRef.current = false;
                void startAndroidLiveUpdateBackgroundCheck({
                    force: true,
                    applyMode: 'immediate',
                    onForceStateChange: (state) => {
                        setForceUpdateState(state);
                    },
                });
            }}
        />
    );
};
