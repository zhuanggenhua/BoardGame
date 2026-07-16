import { AlertTriangle, Download, HardDriveDownload, LoaderCircle, RefreshCw, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    hasUsableInstalledGamePackageVersion,
    type GamePackageCardState,
    type GamePackageInstallStatus,
} from '../../features/mobile-packages/types';
import {
    resolveGamePackageFailureActionLabel,
    resolveGamePackageFailureMessage,
} from '../../features/mobile-packages/errorMessages';

export type GamePackageCardStatus = GamePackageInstallStatus;
export type { GamePackageCardState };

interface GameDetailsMobilePackageCardProps {
    gameName: string;
    state: GamePackageCardState;
    onInstall: () => void;
    onUpdateApp?: () => void;
    onRetry?: () => void;
    onUninstall?: () => void;
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
    errorCode: GamePackageCardState['errorCode'],
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
            actionLabel: t('packageManager.updateAppAction'),
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
                description: resolveGamePackageFailureMessage(t, errorCode, errorMessage),
                actionLabel: failedActionLabel || resolveGamePackageFailureActionLabel(t, errorCode, errorMessage),
                icon: AlertTriangle,
                iconClassName: '',
                iconToneClassName: 'border-amber-800/20 bg-amber-50/70 text-amber-900',
            };
        case 'installed':
            return {
                title: t('packageManager.installedTitle'),
                description: t('packageManager.installedHint', { game: gameName }),
                actionLabel: t('packageManager.uninstallAction'),
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
    onUpdateApp,
    onRetry,
    onUninstall,
    failedActionLabel,
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
        state.errorCode,
        state.errorMessage,
        failedActionLabel,
        presentation,
        requiredAppVersion,
    );
    const StatusIcon = statusMeta.icon;
    const showLeadingStatusIcon = presentation === 'update-required' || state.status !== 'not-installed';
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
    const showProgressAction = isInProgress && typeof onCollapse === 'function';
    const actionHandler = showProgressAction
        ? onCollapse
        : presentation === 'update-required'
            ? (onUpdateApp ?? onInstall)
            : state.status === 'failed'
            ? (onRetry ?? onInstall)
            : state.status === 'installed' && onUninstall
                ? onUninstall
                : onInstall;
    const actionLabel = showProgressAction
        ? t('common:close')
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
                    ? 'pointer-events-auto w-full rounded-[4px] border border-[#a5743c]/58 bg-[linear-gradient(180deg,_rgba(246,224,190,0.99)_0%,_rgba(235,203,159,0.99)_100%)] px-3 py-2 font-serif text-[#3f2718] shadow-[0_7px_14px_rgba(55,34,18,0.14),inset_0_1px_0_rgba(255,246,225,0.56)]'
                    : 'pointer-events-auto w-full rounded-[8px] border border-parchment-card-border/45 bg-parchment-card-bg/96 p-3 shadow-[0_14px_28px_rgba(56,41,22,0.18)] backdrop-blur-sm',
                className,
            ].filter(Boolean).join(' ')}
            aria-label={t('packageManager.cardLabel', { game: gameName })}
        >
            <div className={showLeadingStatusIcon ? (isHomeV2Style ? 'flex items-start gap-2' : 'flex items-start gap-3') : 'flex items-start'}>
                {showLeadingStatusIcon && (
                    <div
                        className={[
                            isHomeV2Style
                                ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border'
                                : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                            isHomeV2Style && state.status === 'installed'
                                ? 'border-[#526d3d]/28 bg-[#edf3dc]/70 text-[#315c27]'
                                : statusMeta.iconToneClassName,
                        ].join(' ')}
                    >
                        <StatusIcon size={isHomeV2Style ? 15 : 18} strokeWidth={2.2} className={statusMeta.iconClassName} />
                    </div>
                )}

                <div className="min-w-0 flex-1">
                    <div className={isHomeV2Style ? 'flex min-w-0 flex-col gap-1.5' : 'flex items-start justify-between gap-3'}>
                        <div className="min-w-0">
                            <p className={[
                                isHomeV2Style ? 'text-[8px] font-semibold uppercase tracking-[0.14em]' : 'text-[10px] font-semibold uppercase tracking-[0.16em]',
                                isHomeV2Style ? 'text-[#8d7354]' : 'text-parchment-light-text/80',
                            ].join(' ')}>
                                {presentation === 'update-required' ? t('packageManager.updateRequiredEyebrow') : t('packageManager.eyebrow')}
                            </p>
                            <p className={[
                                isHomeV2Style ? 'mt-0.5 text-[13px] font-bold leading-tight' : 'mt-1 text-sm font-bold leading-tight',
                                isHomeV2Style ? 'text-[#3f2718]' : 'text-parchment-base-text',
                            ].join(' ')}>
                                {statusMeta.title}
                            </p>
                        </div>
                        <div className={isHomeV2Style ? 'flex min-w-0 items-center justify-between gap-2' : 'flex shrink-0 items-start gap-2'}>
                            <span className={[
                                isHomeV2Style ? 'min-w-0 truncate rounded-[3px] border px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.08em]' : 'min-w-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
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
                                        isHomeV2Style
                                            ? 'inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border transition-colors focus-visible:outline-none focus-visible:ring-2'
                                            : 'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2',
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
                        isHomeV2Style ? 'mt-1 line-clamp-2 text-[10px] leading-[1.45]' : 'mt-1 text-[11px] leading-5',
                        isHomeV2Style ? 'text-[#7a6248]' : 'text-parchment-light-text',
                    ].join(' ')}>
                        {statusMeta.description}
                    </p>

                    {isInProgress && (
                        <div className={isHomeV2Style ? 'mt-2' : 'mt-3'}>
                            <div className={[
                                isHomeV2Style ? 'flex items-center justify-between gap-3 text-[10px] font-medium' : 'flex items-center justify-between gap-3 text-[11px] font-medium',
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
                                    isHomeV2Style ? 'mt-1.5 h-1.5 overflow-hidden rounded-[2px]' : 'mt-2 h-2 overflow-hidden rounded-full',
                                    isHomeV2Style ? 'bg-[#fff8e6]/80' : 'bg-parchment-base-bg/80',
                                ].join(' ')}
                            >
                                <div
                                    data-testid="game-details-mobile-package-progress-fill"
                                    className={[
                                        isHomeV2Style ? 'h-full rounded-[2px] transition-[width] duration-300' : 'h-full rounded-full transition-[width] duration-300',
                                        isHomeV2Style ? 'bg-[#5a371f]/85' : 'bg-parchment-base-text/85',
                                        progressMode === 'indeterminate' ? 'w-2/3 animate-pulse' : '',
                                    ].filter(Boolean).join(' ')}
                                    style={progressMode === 'determinate' ? { width: `${progressPercent}%` } : undefined}
                                />
                            </div>
                        </div>
                    )}

                    {actionLabel && (
                        <div className={isHomeV2Style ? 'mt-2' : 'mt-3'}>
                            <button
                                type="button"
                                onClick={actionHandler}
                                className={[
                                    isHomeV2Style ? 'inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] px-2.5 py-1.5 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2' : 'inline-flex cursor-pointer items-center gap-2 rounded-[4px] px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2',
                                    isHomeV2Style
                                        ? showProgressAction
                                            ? 'border border-[#9d773f]/30 bg-[#fff4da]/80 text-[#6b4219] hover:bg-[#f4dfb8] focus-visible:ring-[#6b4328]/20'
                                            : 'bg-[#4d2c17] text-[#f5dfbc] hover:bg-[#5d351b] focus-visible:ring-[#6b4328]/24'
                                        : showProgressAction
                                        ? 'border border-amber-800/25 bg-amber-50/92 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-900/20'
                                        : 'bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown focus-visible:ring-parchment-base-text/30',
                                ].join(' ')}
                            >
                                {showProgressAction
                                    ? <X size={13} />
                                    : presentation === 'update-required'
                                        ? <Download size={13} />
                                    : state.status === 'failed'
                                        ? <RefreshCw size={13} />
                                        : state.status === 'installed'
                                            ? <Trash2 size={13} />
                                            : <Download size={13} />}
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
