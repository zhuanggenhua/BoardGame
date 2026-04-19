import { AlertTriangle, Download, HardDriveDownload, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    hasUsableInstalledGamePackageVersion,
    type GamePackageCardState,
    type GamePackageInstallStatus,
} from '../../features/mobile-packages/types';
import { formatPackageBytes, hasKnownPackageBytes } from './packageManagerFormat';

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
    className = 'md:hidden',
}: GameDetailsMobilePackageCardProps) => {
    const { t } = useTranslation('lobby');
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
    const knownTotalBytes = [state.modulePackBytes, state.assetPackBytes].reduce((total, value) => (
        typeof value === 'number' && Number.isFinite(value)
            ? total + value
            : total
    ), 0);
    const hasAnyKnownBytes = [state.modulePackBytes, state.assetPackBytes].some((value) => hasKnownPackageBytes(value));
    const totalBytes = hasAnyKnownBytes
        ? knownTotalBytes
        : undefined;
    const isSyncingPreview = state.status === 'not-installed'
        && state.previewResolved !== true
        && !hasKnownPackageBytes(totalBytes);
    const isUnpublishedPreview = state.status === 'not-installed'
        && state.previewResolved === true
        && state.manifestSource === 'fallback';
    const sizeFallbackLabel = isUnpublishedPreview
        ? t('packageManager.packageUnpublished')
        : isSyncingPreview
            ? t('packageManager.packageSyncing')
            : t('packageManager.sizeUnknown');
    const sizeLabel = formatPackageBytes(totalBytes, sizeFallbackLabel);
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
            : sizeLabel;

    return (
        <section
            data-testid="game-details-mobile-package-card"
            data-status={state.status}
            className={[
                'pointer-events-auto w-full rounded-[8px] border border-parchment-card-border/45 bg-parchment-card-bg/96 p-3 shadow-[0_14px_28px_rgba(56,41,22,0.18)] backdrop-blur-sm',
                className,
            ].filter(Boolean).join(' ')}
            aria-label={t('packageManager.cardLabel', { game: gameName })}
        >
            <div className={showLeadingStatusIcon ? 'flex items-start gap-3' : 'flex items-start'}>
                {showLeadingStatusIcon && (
                    <div
                        className={[
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                            statusMeta.iconToneClassName,
                        ].join(' ')}
                    >
                        <StatusIcon size={18} strokeWidth={2.2} className={statusMeta.iconClassName} />
                    </div>
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-parchment-light-text/80">
                                {presentation === 'update-required' ? t('packageManager.updateRequiredEyebrow') : t('packageManager.eyebrow')}
                            </p>
                            <p className="mt-1 text-sm font-bold leading-tight text-parchment-base-text">
                                {statusMeta.title}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                            <span className="rounded-full border border-parchment-card-border/35 bg-parchment-base-bg/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-parchment-light-text">
                                {badgeLabel}
                            </span>
                            {onCollapse && (
                                <button
                                    type="button"
                                    data-testid="game-details-mobile-package-card-dismiss"
                                    onClick={onCollapse}
                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-parchment-card-border/35 bg-parchment-base-bg/60 text-parchment-light-text transition-colors hover:bg-parchment-base-bg hover:text-parchment-base-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-parchment-base-text/20"
                                    aria-label={t('common:close')}
                                    title={t('common:close')}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <p className="mt-1 text-[11px] leading-5 text-parchment-light-text">
                        {statusMeta.description}
                    </p>

                    {isInProgress && (
                        <div className="mt-3">
                            <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-parchment-light-text">
                                <span>{t('packageManager.progress.label')}</span>
                                <span>
                                    {progressMode === 'determinate'
                                        ? t('packageManager.progress.percent', { percent: Math.round(progressPercent) })
                                        : t('packageManager.progress.pendingPercent')}
                                </span>
                            </div>
                            <div
                                data-testid="game-details-mobile-package-progress-track"
                                className="mt-2 h-2 overflow-hidden rounded-full bg-parchment-base-bg/80"
                            >
                                <div
                                    data-testid="game-details-mobile-package-progress-fill"
                                    className={[
                                        'h-full rounded-full bg-parchment-base-text/85 transition-[width] duration-300',
                                        progressMode === 'indeterminate' ? 'w-2/3 animate-pulse' : '',
                                    ].filter(Boolean).join(' ')}
                                    style={progressMode === 'determinate' ? { width: `${progressPercent}%` } : undefined}
                                />
                            </div>
                        </div>
                    )}

                    {actionLabel && !isUnpublishedPreview && (
                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={actionHandler}
                                className={[
                                    'inline-flex cursor-pointer items-center gap-2 rounded-[4px] px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2',
                                    showCancelAction
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
