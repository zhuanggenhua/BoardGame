import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UI_Z_INDEX } from '../../core';
import type { AndroidForceUpdateState } from '../../lib/mobile/androidLiveUpdates';

interface AndroidForceUpdateGateProps {
    state: AndroidForceUpdateState;
    onRetry: () => void;
}

const resolveDescription = (
    state: AndroidForceUpdateState,
    t: ReturnType<typeof useTranslation<'lobby'>>['t'],
) => {
    if (state.message) {
        return state.message;
    }

    switch (state.phase) {
        case 'checking':
            return t('ota.forceUpdate.checkingDescription');
        case 'downloading':
            return t('ota.forceUpdate.downloadingDescription');
        case 'applying':
            return t('ota.forceUpdate.applyingDescription');
        case 'native-update-required':
            return state.requiredNativeVersion
                ? t('ota.forceUpdate.requiredDescriptionWithVersion', { version: state.requiredNativeVersion })
                : t('ota.forceUpdate.requiredDescription');
        case 'error':
            return t('ota.forceUpdate.errorDescription');
        default:
            return '';
    }
};

const resolveTitle = (
    state: AndroidForceUpdateState,
    t: ReturnType<typeof useTranslation<'lobby'>>['t'],
) => {
    if (state.title) {
        return state.title;
    }

    switch (state.phase) {
        case 'checking':
            return t('ota.forceUpdate.checkingTitle');
        case 'downloading':
            return t('ota.forceUpdate.downloadingTitle');
        case 'applying':
            return t('ota.forceUpdate.applyingTitle');
        case 'native-update-required':
            return t('ota.forceUpdate.requiredTitle');
        case 'error':
            return t('ota.forceUpdate.errorTitle');
        default:
            return '';
    }
};

export const AndroidForceUpdateGate = ({
    state,
    onRetry,
}: AndroidForceUpdateGateProps) => {
    const { t } = useTranslation('lobby');

    if (!state.blocking || state.phase === 'hidden') {
        return null;
    }

    const description = resolveDescription(state, t);
    const title = resolveTitle(state, t);
    const progressPercent = typeof state.progressPercent === 'number'
        ? Math.max(0, Math.min(100, Math.round(state.progressPercent)))
        : undefined;
    const hasMeasuredDownloadProgress = state.phase === 'downloading' && typeof progressPercent === 'number';
    const isProgressVisible = state.phase === 'downloading';
    const isRetryVisible = state.phase === 'native-update-required' || state.phase === 'error';

    return (
        <div
            className="fixed inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(214,173,96,0.16),_transparent_38%),linear-gradient(180deg,_#0f0b07_0%,_#17110b_45%,_#090704_100%)]"
            style={{ zIndex: UI_Z_INDEX.modalTooltip + 20 }}
        >
            <div className="absolute inset-0 opacity-40" aria-hidden="true">
                <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,_rgba(255,214,130,0.12),_transparent)]" />
                <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
            </div>

            <div className="relative flex h-full min-h-0 items-center justify-center px-5 py-[max(1.5rem,env(safe-area-inset-top))]">
                <section className="w-full max-w-[24rem] rounded-[18px] border border-amber-200/15 bg-[#161008]/92 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-md">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/20 bg-amber-100/5">
                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-200/20 border-t-amber-300" />
                    </div>

                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
                        {t('ota.forceUpdate.eyebrow')}
                    </p>
                    <h2 className="mt-2 text-[1.45rem] font-bold leading-tight text-amber-50">
                        {title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-amber-100/75">
                        {description}
                    </p>

                    {(state.version || state.currentNativeVersion || state.requiredNativeVersion) && (
                        <div className="mt-5 rounded-2xl border border-amber-200/12 bg-black/20 px-4 py-3 text-left text-xs text-amber-100/70">
                            {state.version && (
                                <div className="flex items-center justify-between gap-3">
                                    <span>{t('ota.forceUpdate.bundleVersion')}</span>
                                    <span className="font-medium text-amber-50">{state.version}</span>
                                </div>
                            )}
                            {state.currentNativeVersion && (
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <span>{t('ota.forceUpdate.currentAppVersion')}</span>
                                    <span className="font-medium text-amber-50">{state.currentNativeVersion}</span>
                                </div>
                            )}
                            {state.requiredNativeVersion && (
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <span>{t('ota.forceUpdate.requiredAppVersion')}</span>
                                    <span className="font-medium text-amber-50">{state.requiredNativeVersion}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {isProgressVisible && (
                        <div className="mt-5">
                            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-amber-100/70">
                                <span>{t('ota.forceUpdate.progressLabel')}</span>
                                <span>
                                    {hasMeasuredDownloadProgress
                                        ? t('ota.forceUpdate.progressPercent', { percent: progressPercent })
                                        : t('ota.forceUpdate.progressPending')}
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                {hasMeasuredDownloadProgress ? (
                                    <div
                                        className="h-full rounded-full bg-[linear-gradient(90deg,_#f9d989_0%,_#f3b24a_55%,_#dd7d1f_100%)] transition-[width] duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                ) : (
                                    <div className="h-full rounded-full bg-[repeating-linear-gradient(90deg,_rgba(249,217,137,0.16)_0px,_rgba(249,217,137,0.16)_10px,_rgba(255,255,255,0.04)_10px,_rgba(255,255,255,0.04)_20px)] opacity-80" />
                                )}
                            </div>
                        </div>
                    )}

                    {state.reason && state.phase !== 'checking' && (
                        <p className="mt-4 rounded-2xl border border-red-400/15 bg-red-500/8 px-3 py-2 text-left text-xs leading-5 text-red-100/80">
                            {state.reason}
                        </p>
                    )}

                    {isRetryVisible && (
                        <div className="mt-5">
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-50/10 px-5 py-2.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-50/16"
                            >
                                <RefreshCw size={16} />
                                <span>{t('ota.forceUpdate.retryAction')}</span>
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AndroidForceUpdateGate;
