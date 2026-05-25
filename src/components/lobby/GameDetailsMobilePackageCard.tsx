import { AlertTriangle, Download, HardDriveDownload, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    hasUsableInstalledGamePackageVersion,
    type GamePackageCardState,
    type GamePackageInstallStatus,
} from '../../features/mobile-packages/types';

export type GamePackageCardStatus = GamePackageInstallStatus;
export type { GamePackageCardState };

interface GameDetailsMobilePackageCardProps {
    gameName: string;
    state: GamePackageCardState;
    onInstall: () => void;
    onRetry?: () => void;
    failedActionLabel?: string;
    onCancel?: () => void;
    onCollapse?: () => void;
    presentation?: 'install' | 'update-required';
    requiredAppVersion?: string;
    visualStyle?: 'default' | 'home-v2';
    className?: string;
}

const getProgressTitleKey = (status: Extract<GamePackageCardStatus, 'queued' | 'manifest' | 'downloading' | 'verifying'>) => {
    switch (status) {
        case 'queued':
            return 'packageManager.progress.queuedTitle';
        case 'manifest':
            return 'packageManager.progress.manifestTitle';
        case 'downloading':
            return 'packageManager.progress.downloadTitle';
        case 'verifying':
        default:
            return 'packageManager.progress.verifyTitle';
    }
};

const getProgressHintKey = (status: Extract<GamePackageCardStatus, 'queued' | 'manifest' | 'downloading' | 'verifying'>) => {
    switch (status) {
        case 'queued':
            return 'packageManager.progress.queuedHint';
        case 'manifest':
            return 'packageManager.progress.manifestHint';
        case 'downloading':
            return 'packageManager.progress.downloadHint';
        case 'verifying':
        default:
            return 'packageManager.progress.verifyHint';
    }
};

const getStatusMeta = (
    status: GamePackageCardStatus,
    t: ReturnType<typeof useTranslation<'lobby'>>['t'],
    gameName: string,
    errorMessage?: string,
    failedActionLabel?: string,
    presentation: 'install' | 'update-required' = 'install',
    requiredAppVersion?: string,
) => {
    if (presentation === 'update-required') {
        return {
            title: t('packageManager.updateRequiredTitle'),
            description: requiredAppVersion
                ? t('packageManager.updateRequiredHintWithVersion', { game: gameName, version: requiredAppVersion })
                : t('packageManager.updateRequiredHint', { game: gameName }),
            actionLabel: null,
            icon: AlertTriangle,
            iconClassName: '',
            iconToneClassName: 'border-amber-800/20 bg-amber-50/70 text-amber-900',
        };
    }

    switch (status) {
        case 'queued':
            return {
                title: t(getProgressTitleKey(status)),
                description: t(getProgressHintKey(status)),
                actionLabel: null,
                icon: LoaderCircle,
                iconClassName: 'animate-spin',
                iconToneClassName: 'border-parchment-card-border/40 bg-parchment-base-bg/60 text-parchment-base-text',
            };
        case 'manifest':
            return {
                title: t(getProgressTitleKey(status)),
                description: t(getProgressHintKey(status)),
                actionLabel: null,
                icon: HardDriveDownload,
                iconClassName: '',
                iconToneClassName: 'border-parchment-card-border/40 bg-parchment-base-bg/60 text-parchment-base-text',
            };
        case 'downloading':
            return {
                title: t(getProgressTitleKey(status)),
                description: t(getProgressHintKey(status)),
                actionLabel: null,
                icon: Download,
                iconClassName: '',
                iconToneClassName: 'border-parchment-card-border/40 bg-parchment-base-bg/60 text-parchment-base-text',
            };
        case 'verifying':
            return {
                title: t(getProgressTitleKey(status)),
                description: t(getProgressHintKey(status)),
                actionLabel: null,
                icon: LoaderCircle,
                iconClassName: 'animate-spin',
                iconToneClassName: 'border-parchment-card-border/40 bg-parchment-base-bg/60 text-parchment-base-text',
            };
        case 'failed':
            return {
                title: t('packageManager.failedTitle'),
                description: errorMessage || t('packageManager.failedHint'),
                actionLabel: failedActionLabel || t('packageManager.retryAction'),
                icon: AlertTriangle,
                iconClassName: '',
                iconToneClassName: 'border-amber-800/20 bg-amber-50/70 text-amber-900',
            };
        case 'installed':
            return {
                title: t('packageManager.installedTitle'),
                description: t('packageManager.installedHint', { game: gameName }),
                actionLabel: null,
                icon: HardDriveDownload,
                iconClassName: '',
                iconToneClassName: 'border-emerald-700/20 bg-emerald-50/70 text-emerald-900',
            };
        case 'not-installed':
        default:
            return {
                title: t('packageManager.notInstalled'),
                description: t('packageManager.notInstalledHint', { game: gameName }),
                actionLabel: t('packageManager.installAction'),
                icon: Download,
                iconClassName: '',
                iconToneClassName: 'border-parchment-base-text/15 bg-parchment-base-text text-parchment-card-bg',
            };
    }
};

export const GameDetailsMobilePackageCard = ({
    gameName,
    state,
    onInstall,
    onRetry,
    failedActionLabel,
    onCancel,
    onCollapse,
    presentation = 'install',
    requiredAppVersion,
    visualStyle = 'default',
    className = 'md:hidden',
}: GameDetailsMobilePackageCardProps) => {
    const { t } = useTranslation('lobby');
    const isHomeV2Style = visualStyle === 'home-v2';
    const statusMeta = getStatusMeta(
        state.status,
        t,
        gameName,
        state.errorMessage,
        failedActionLabel,
        presentation,
        requiredAppVersion,
    );
    const StatusIcon = statusMeta.icon;
    const showLeadingStatusIcon = state.status !== 'not-installed';
    const isInProgress = state.status === 'queued'
        || state.status === 'manifest'
        || state.status === 'downloading'
        || state.status === 'verifying';
    const progressMode = state.progressMode ?? 'indeterminate';
    const progressPercent = Math.max(0, Math.min(100, state.progressPercent ?? 0));
    const syncStatusLabel = state.previewResolved !== true
        ? t('packageManager.packageSyncing')
        : state.manifestSource === 'remote'
            ? t('packageManager.packageSyncCompleted')
            : t('packageManager.packageSyncFailed');
    const showCancelAction = isInProgress && typeof onCancel === 'function';
    const actionHandler = showCancelAction
        ? onCancel
        : state.status === 'failed'
            ? (onRetry ?? onInstall)
            : onInstall;
    const actionLabel = showCancelAction
        ? t('packageManager.cancelAction')
        : statusMeta.actionLabel;
    const badgeLabel = presentation === 'update-required'
        ? t('packageManager.updateRequiredBadge')
        : state.status === 'installed'
            ? hasUsableInstalledGamePackageVersion(state.installedVersion)
                ? t('packageManager.installedVersionBadge', { version: state.installedVersion?.trim() })
                : t('packageManager.installedCompletedBadge')
            : syncStatusLabel;

    return (
        <section
            data-testid="game-details-mobile-package-card"
            data-status={state.status}
            className={[
                isHomeV2Style
                    ? 'pointer-events-auto w-full rounded-[8px] border border-[#8e6140]/45 bg-[linear-gradient(180deg,_rgba(246,224,190,0.97)_0%,_rgba(236,202,157,0.97)_100%)] p-3 font-serif text-[#3f2718] shadow-[0_18px_32px_rgba(55,34,18,0.22),inset_0_1px_0_rgba(255,246,225,0.55)]'
                    : 'pointer-events-auto w-full rounded-[8px] border border-parchment-card-border/45 bg-parchment-card-bg/96 p-3 shadow-[0_14px_28px_rgba(56,41,22,0.18)] backdrop-blur-sm',
                className,
            ].filter(Boolean).join(' ')}
            aria-label={t('packageManager.cardLabel', { game: gameName })}
        >
            <div className={showLeadingStatusIcon ? 'flex items-start gap-3' : 'flex items-start'}>
                {showLeadingStatusIcon && (
                    <div
                        className={[
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                            isHomeV2Style && state.status === 'installed'
                                ? 'border-[#526d3d]/24 bg-[#edf3dc]/70 text-[#315c27]'
                                : statusMeta.iconToneClassName,
                        ].join(' ')}
                    >
                        <StatusIcon size={18} strokeWidth={2.2} className={statusMeta.iconClassName} />
                    </div>
                )}

                <div className="min-w-0 flex-1">
                    <div className={isHomeV2Style ? 'flex min-w-0 flex-col gap-2' : 'flex items-start justify-between gap-3'}>
                        <div className="min-w-0">
                            <p className={[
                                'text-[10px] font-semibold uppercase tracking-[0.16em]',
                                isHomeV2Style ? 'text-[#8d7354]' : 'text-parchment-light-text/80',
                            ].join(' ')}>
                                {presentation === 'update-required' ? t('packageManager.updateRequiredEyebrow') : t('packageManager.eyebrow')}
                            </p>
                            <p className={[
                                'mt-1 text-sm font-bold leading-tight',
                                isHomeV2Style ? 'text-[#3f2718]' : 'text-parchment-base-text',
                            ].join(' ')}>
                                {statusMeta.title}
                            </p>
                        </div>
                        <div className={isHomeV2Style ? 'flex min-w-0 items-center justify-between gap-2' : 'flex shrink-0 items-start gap-2'}>
                            <span className={[
                                'min-w-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                                isHomeV2Style
                                    ? 'border-[#9d773f]/22 bg-[#fff4da]/54 text-[#7a6248]'
                                    : 'border-parchment-card-border/35 bg-parchment-base-bg/55 text-parchment-light-text',
                            ].join(' ')}>
                                {badgeLabel}
                            </span>
                            {onCollapse && (
                                <button
                                    type="button"
                                    data-testid="game-details-mobile-package-card-dismiss"
                                    onClick={onCollapse}
                                    className={[
                                        'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2',
                                        isHomeV2Style
                                            ? 'border-[#9d773f]/24 bg-[#fff4da]/54 text-[#7a6248] hover:bg-[#f4dfb8] hover:text-[#3f2718] focus-visible:ring-[#6b4328]/20'
                                            : 'border-parchment-card-border/35 bg-parchment-base-bg/60 text-parchment-light-text hover:bg-parchment-base-bg hover:text-parchment-base-text focus-visible:ring-parchment-base-text/20',
                                    ].join(' ')}
                                    aria-label={t('common:close')}
                                    title={t('common:close')}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <p className={[
                        'mt-1 text-[11px] leading-5',
                        isHomeV2Style ? 'text-[#7a6248]' : 'text-parchment-light-text',
                    ].join(' ')}>
                        {statusMeta.description}
                    </p>

                    {isInProgress && (
                        <div className="mt-3">
                            <div className={[
                                'flex items-center justify-between gap-3 text-[11px] font-medium',
                                isHomeV2Style ? 'text-[#7a6248]' : 'text-parchment-light-text',
                            ].join(' ')}>
                                <span>{t('packageManager.progress.label')}</span>
                                <span>
                                    {progressMode === 'determinate'
                                        ? t('packageManager.progress.percent', { percent: Math.round(progressPercent) })
                                        : t('packageManager.progress.pendingPercent')}
                                </span>
                            </div>
                            <div
                                data-testid="game-details-mobile-package-progress-track"
                                className={[
                                    'mt-2 h-2 overflow-hidden rounded-full',
                                    isHomeV2Style ? 'bg-[#fff8e6]/80' : 'bg-parchment-base-bg/80',
                                ].join(' ')}
                            >
                                <div
                                    data-testid="game-details-mobile-package-progress-fill"
                                    className={[
                                        'h-full rounded-full transition-[width] duration-300',
                                        isHomeV2Style ? 'bg-[#5a371f]/85' : 'bg-parchment-base-text/85',
                                        progressMode === 'indeterminate' ? 'w-2/3 animate-pulse' : '',
                                    ].filter(Boolean).join(' ')}
                                    style={progressMode === 'determinate' ? { width: `${progressPercent}%` } : undefined}
                                />
                            </div>
                        </div>
                    )}

                    {actionLabel && (
                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={actionHandler}
                                className={[
                                    'inline-flex cursor-pointer items-center gap-2 rounded-[4px] px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2',
                                    isHomeV2Style
                                        ? showCancelAction
                                            ? 'border border-[#9d773f]/30 bg-[#fff4da]/80 text-[#6b4219] hover:bg-[#f4dfb8] focus-visible:ring-[#6b4328]/20'
                                            : 'bg-[#4d2c17] text-[#f5dfbc] hover:bg-[#5d351b] focus-visible:ring-[#6b4328]/24'
                                        : showCancelAction
                                        ? 'border border-amber-800/25 bg-amber-50/92 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-900/20'
                                        : 'bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown focus-visible:ring-parchment-base-text/30',
                                ].join(' ')}
                            >
                                {showCancelAction ? <X size={13} /> : state.status === 'failed' ? <RefreshCw size={13} /> : <Download size={13} />}
                                <span>{actionLabel}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default GameDetailsMobilePackageCard;
