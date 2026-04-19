import { useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { AndroidForceUpdateGate } from './AndroidForceUpdateGate';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
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
    const toast = useToast();
    const isNativeAndroid = isNativeAndroidRuntime();
    const [forceUpdateState, setForceUpdateState] = useState<AndroidForceUpdateState>(HIDDEN_FORCE_UPDATE_STATE);

    useEffect(() => {
        if (!isNativeAndroid) {
            return;
        }

        let disposed = false;

        void registerAndroidLiveUpdateListeners();

        const handleResult = (
            result: Awaited<ReturnType<typeof startAndroidLiveUpdateBackgroundCheck>>,
            options?: { interactive?: boolean },
        ) => {
            if (disposed) return;

            if (result.status === 'queued') {
                return;
            }

            if (result.status === 'up-to-date' && options?.interactive) {
                setForceUpdateState(HIDDEN_FORCE_UPDATE_STATE);
                if (shouldShowAndroidOtaToastOncePerDay('up-to-date')) {
                    toast.success('当前已经是最新版本。', '应用更新', {
                        dedupeKey: 'android-ota-up-to-date',
                        ttlMs: 3000,
                    });
                }
                return;
            }

            if (
                result.status === 'up-to-date'
                || result.status === 'disabled'
                || result.status === 'manifest-missing'
                || result.status === 'not-native'
            ) {
                setForceUpdateState(HIDDEN_FORCE_UPDATE_STATE);
                return;
            }

            if (result.status === 'error') {
                console.warn('[OTA] 后台检查失败', result.reason);
                if (options?.interactive) {
                    if (shouldShowAndroidOtaToastOncePerDay('error')) {
                        toast.error(result.reason, '应用更新');
                    }
                }
                return;
            }

            if (result.status === 'incompatible') {
                console.info('[OTA] 检测到不兼容更新，已跳过', result.reason);
                requestAndroidNativeUpdateCheck({ interactive: options?.interactive === true });
            }
        };

        if (!hasAutoStartedAndroidLiveUpdateCheck) {
            hasAutoStartedAndroidLiveUpdateCheck = true;
            void startAndroidLiveUpdateBackgroundCheck({
                onForceStateChange: (state) => {
                    if (disposed) return;
                    setForceUpdateState(state);
                },
                applyMode: 'background',
            }).then((result) => {
                handleResult(result);
            });
        }

        const unsubscribeRequest = subscribeAndroidLiveUpdateRequests((request) => {
            void startAndroidLiveUpdateBackgroundCheck({
                force: true,
                applyMode: request.applyMode ?? 'immediate',
                initialImmediatePhase: request.initialImmediatePhase,
                onForceStateChange: (state) => {
                    if (disposed) return;
                    setForceUpdateState(state);
                },
            }).then((result) => {
                handleResult(result, { interactive: request.interactive });
            });
        });

        return () => {
            disposed = true;
            unsubscribeRequest();
        };
    }, [isNativeAndroid, toast]);

    if (!isNativeAndroid) {
        return null;
    }

    return (
        <AndroidForceUpdateGate
            state={forceUpdateState}
            onRetry={() => {
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
