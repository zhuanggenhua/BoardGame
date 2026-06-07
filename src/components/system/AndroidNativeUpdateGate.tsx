import { useTranslation } from 'react-i18next';
import { UI_Z_INDEX } from '../../core';
import type { AndroidNativeUpdateState } from '../../lib/mobile/androidNativeUpdates';

interface AndroidNativeUpdateGateProps {
    state: AndroidNativeUpdateState;
    onRetry: () => void;
    onOpenSettings: () => void;
    onContinueInstall: () => void;
}

const resolveTitle = (
    state: AndroidNativeUpdateState,
    t: ReturnType<typeof useTranslation<'lobby'>>['t'],
) => {
    if (state.title) {
        return state.title;
    }

    switch (state.phase) {
        case 'checking':
            return t('nativeUpdate.title.checking');
        case 'downloading':
            return t('nativeUpdate.title.downloading');
        case 'verifying':
            return t('nativeUpdate.title.verifying');
        case 'permission-required':
            return t('nativeUpdate.title.permission');
        case 'installing':
            return t('nativeUpdate.title.installing');
        case 'error':
            return t('nativeUpdate.title.error');
        default:
            return t('nativeUpdate.title.default');
    }
};

const resolveDescription = (
    state: AndroidNativeUpdateState,
    t: ReturnType<typeof useTranslation<'lobby'>>['t'],
) => {
    if (state.message) {
        return state.message;
    }

    switch (state.phase) {
        case 'checking':
            return t('nativeUpdate.description.checking');
        case 'downloading':
            return t('nativeUpdate.description.downloading');
        case 'verifying':
            return t('nativeUpdate.description.verifying');
        case 'permission-required':
            return t('nativeUpdate.description.permission');
        case 'installing':
            return t('nativeUpdate.description.installing');
        case 'error':
            return t('nativeUpdate.description.error');
        default:
            return t('nativeUpdate.description.default');
    }
};

export const AndroidNativeUpdateGate = ({
    state,
    onRetry,
    onOpenSettings,
    onContinueInstall,
}: AndroidNativeUpdateGateProps) => {
    const { t } = useTranslation('lobby');

    if (!state.blocking || state.phase === 'hidden') {
        return null;
    }

    const title = resolveTitle(state, t);
    const description = resolveDescription(state, t);
    const progressPercent = typeof state.progressPercent === 'number'
        ? Math.max(0, Math.min(100, Math.round(state.progressPercent)))
        : undefined;
    const showProgress = state.phase === 'downloading' || state.phase === 'verifying';
    const showPermissionActions = state.phase === 'permission-required';
    const showRetry = state.phase === 'error';
    const hasMeasuredProgress = typeof progressPercent === 'number';

    return (
        <div
            className="fixed inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(129,162,255,0.16),_transparent_40%),linear-gradient(180deg,_#0a0f1a_0%,_#0b1220_45%,_#070a12_100%)]"
            style={{ zIndex: UI_Z_INDEX.modalTooltip + 20 }}
        >
            <div className="absolute inset-0 opacity-40" aria-hidden="true">
                <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,_rgba(140,185,255,0.12),_transparent)]" />
                <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
            </div>

            <div className="relative flex h-full min-h-0 items-center justify-center px-5 py-[max(1.5rem,env(safe-area-inset-top))]">
                <section className="w-full max-w-[24rem] rounded-[18px] border border-sky-200/15 bg-[#0f1422]/92 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-md">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-sky-300/20 bg-sky-100/5">
                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-sky-200/20 border-t-sky-300" />
                    </div>

                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/70">
                        {t('nativeUpdate.eyebrow')}
                    </p>
                    <h2 className="mt-2 text-[1.45rem] font-bold leading-tight text-sky-50">
                        {title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-sky-100/75">
                        {description}
                    </p>

                    {state.version && (
                        <div className="mt-5 rounded-2xl border border-sky-200/12 bg-black/20 px-4 py-3 text-left text-xs text-sky-100/70">
                            <div className="flex items-center justify-between gap-3">
                                <span>{t('nativeUpdate.bundleVersion')}</span>
                                <span className="font-medium text-sky-50">{state.version}</span>
                            </div>
                        </div>
                    )}

                    {showProgress && (
                        <div className="mt-5">
                            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-sky-100/70">
                                <span>{t('nativeUpdate.progressLabel')}</span>
                                <span>
                                    {hasMeasuredProgress
                                        ? t('nativeUpdate.progressPercent', { percent: progressPercent })
                                        : t('nativeUpdate.progressPending')}
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                {hasMeasuredProgress ? (
                                    <div
                                        className="h-full rounded-full bg-[linear-gradient(90deg,_#8dd1ff_0%,_#5da8ff_55%,_#3d7bff_100%)] transition-[width] duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                ) : (
                                    <div className="h-full rounded-full bg-[repeating-linear-gradient(90deg,_rgba(141,209,255,0.16)_0px,_rgba(141,209,255,0.16)_10px,_rgba(255,255,255,0.04)_10px,_rgba(255,255,255,0.04)_20px)] opacity-80" />
                                )}
                            </div>
                            {!hasMeasuredProgress && (
                                <p className="mt-2 text-left text-[11px] leading-5 text-sky-100/55">
                                    {t('nativeUpdate.progressHint')}
                                </p>
                            )}
                        </div>
                    )}

                    {state.reason && state.phase !== 'checking' && (
                        <p className="mt-4 rounded-2xl border border-red-400/15 bg-red-500/8 px-3 py-2 text-left text-xs leading-5 text-red-100/80">
                            {state.reason}
                        </p>
                    )}

                    {showPermissionActions && (
                        <div className="mt-5 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={onOpenSettings}
                                className="inline-flex min-h-11 items-center justify-center rounded-full border border-sky-200/20 bg-sky-50/10 px-5 py-2.5 text-sm font-semibold text-sky-50 transition-colors hover:bg-sky-50/16"
                            >
                                {t('nativeUpdate.openSettings')}
                            </button>
                            <button
                                type="button"
                                onClick={onContinueInstall}
                                className="inline-flex min-h-11 items-center justify-center rounded-full border border-sky-200/20 bg-sky-500/20 px-5 py-2.5 text-sm font-semibold text-sky-50 transition-colors hover:bg-sky-500/30"
                            >
                                {t('nativeUpdate.continueInstall')}
                            </button>
                        </div>
                    )}

                    {showRetry && (
                        <div className="mt-5">
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex min-h-11 items-center justify-center rounded-full border border-sky-200/20 bg-sky-50/10 px-5 py-2.5 text-sm font-semibold text-sky-50 transition-colors hover:bg-sky-50/16"
                            >
                                {t('nativeUpdate.retryAction')}
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AndroidNativeUpdateGate;
