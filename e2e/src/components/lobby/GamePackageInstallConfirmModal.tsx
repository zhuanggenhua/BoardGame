import { AlertTriangle, Download, HardDriveDownload, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalBase } from '../common/overlays/ModalBase';
import type { GamePackageCardState } from '../../features/mobile-packages/types';
import { formatPackageBytes } from './packageManagerFormat';

interface GamePackageInstallConfirmModalProps {
    gameName: string;
    state: GamePackageCardState;
    modulePackId?: string;
    assetPackId?: string;
    modulePackBytes?: number;
    assetPackBytes?: number;
    onConfirm: () => void | Promise<void>;
    onRetry?: () => void | Promise<void>;
    failedActionLabel?: string;
    onClose: () => void | Promise<void>;
    onCancel: () => void | Promise<void>;
    isLoading?: boolean;
    closeOnBackdrop?: boolean;
}

export const GamePackageInstallConfirmModal = ({
    gameName,
    state,
    modulePackId,
    assetPackId,
    modulePackBytes,
    assetPackBytes,
    onConfirm,
    onRetry,
    failedActionLabel,
    onClose,
    onCancel,
    isLoading = false,
    closeOnBackdrop = true,
}: GamePackageInstallConfirmModalProps) => {
    const { t } = useTranslation('lobby');
    const sizeUnknownLabel = t('packageManager.sizeUnknown');
    const packageItems = [
        {
            label: t('packageManager.modulePack'),
            id: modulePackId,
            bytes: modulePackBytes,
        },
        {
            label: t('packageManager.assetPack'),
            id: assetPackId,
            bytes: assetPackBytes,
        },
    ].filter((item) =>
        Boolean(item.id)
        || (typeof item.bytes === 'number' && Number.isFinite(item.bytes)),
    );
    const knownTotalBytes = packageItems.reduce((total, item) => (
        typeof item.bytes === 'number' && Number.isFinite(item.bytes)
            ? total + item.bytes
            : total
    ), 0);
    const totalBytes = packageItems.some((item) => typeof item.bytes === 'number' && Number.isFinite(item.bytes))
        ? knownTotalBytes
        : undefined;
    const progressPercent = Math.max(0, Math.min(100, state.progressPercent ?? 0));
    const progressMode = state.progressMode ?? 'indeterminate';
    const isInProgress = state.status === 'queued'
        || state.status === 'manifest'
        || state.status === 'downloading'
        || state.status === 'verifying';
    const isFailed = state.status === 'failed';
    const isInstalled = state.status === 'installed';
    const isPreview = state.status === 'not-installed';
    const modalTitle = isPreview
        ? t('packageManager.confirmTitle', { game: gameName })
        : isFailed
            ? t('packageManager.failedTitle')
            : isInstalled
                ? t('packageManager.installedTitle')
                : t(`packageManager.progress.${state.status === 'queued' ? 'queuedTitle' : state.status === 'manifest' ? 'manifestTitle' : state.status === 'downloading' ? 'downloadTitle' : 'verifyTitle'}`);
    const modalDescription = isPreview
        ? t('packageManager.confirmDescription')
        : isFailed
            ? (state.errorMessage || t('packageManager.failedHint'))
            : isInstalled
                ? t('packageManager.installedHint', { game: gameName })
                : t(`packageManager.progress.${state.status === 'queued' ? 'queuedHint' : state.status === 'manifest' ? 'manifestHint' : state.status === 'downloading' ? 'downloadHint' : 'verifyHint'}`);
    const PrimaryIcon = isInProgress ? X : isFailed ? RefreshCw : Download;
    const primaryActionLabel = isInProgress
        ? t('packageManager.cancelAction')
        : isFailed
            ? (failedActionLabel || t('packageManager.retryAction'))
            : t('packageManager.confirmAction');
    const isPrimaryDisabled = !isInProgress && isLoading;

    return (
        <ModalBase
            onClose={onClose}
            closeOnBackdrop={closeOnBackdrop}
            overlayClassName="bg-[#2b2114]/30"
            containerClassName="p-4 sm:p-6"
            containerStyle={{
                paddingTop: 'max(1rem, env(safe-area-inset-top))',
                paddingRight: 'max(1rem, env(safe-area-inset-right))',
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            }}
        >
            <section className="pointer-events-auto w-full max-w-[21rem] rounded-sm border border-parchment-card-border/50 bg-parchment-card-bg p-5 font-serif text-parchment-base-text shadow-parchment-card-hover">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-parchment-light-text">
                    {isFailed ? <AlertTriangle size={15} /> : <HardDriveDownload size={15} />}
                    <span>{isPreview ? t('packageManager.confirmEyebrow') : t('packageManager.eyebrow')}</span>
                </div>
                <h3 className="mt-3 text-lg font-bold leading-tight">
                    {modalTitle}
                </h3>
                <p className="mt-2 text-sm leading-6 text-parchment-light-text">
                    {modalDescription}
                </p>

                <div className="mt-4 rounded-[8px] border border-parchment-card-border/35 bg-parchment-base-bg/45 p-3">
                    <div className="flex items-center justify-between gap-3 border-b border-parchment-card-border/20 pb-3">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-parchment-light-text/80">
                                {t('packageManager.totalSize')}
                            </p>
                            <p className="mt-1 text-base font-bold text-parchment-base-text">
                                {formatPackageBytes(totalBytes, sizeUnknownLabel)}
                            </p>
                        </div>
                        <div className="rounded-full border border-parchment-card-border/30 bg-parchment-card-bg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-parchment-light-text">
                            {t('packageManager.mode')}
                        </div>
                    </div>

                    {packageItems.length > 0 && (
                        <div className="mt-3 space-y-2.5">
                            {packageItems.map((item) => (
                                <div key={item.label} className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">{item.label}</p>
                                        <p className="mt-1 text-[11px] leading-5 text-parchment-light-text">
                                            {item.id || t('packageManager.packIdUnknown')}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[11px] font-medium text-parchment-light-text">
                                        {formatPackageBytes(item.bytes, sizeUnknownLabel)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {isInProgress && (
                        <div className="mt-4 border-t border-parchment-card-border/20 pt-3">
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
                                className="mt-2 h-2 overflow-hidden rounded-full bg-parchment-card-bg"
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
                </div>

                <p className="mt-3 text-[11px] leading-5 text-parchment-light-text/85">
                    {isPreview ? t('packageManager.confirmHint') : t('packageManager.modalHint')}
                </p>

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            void onClose();
                        }}
                        disabled={false}
                        className="touch-target-min rounded-[4px] border border-parchment-card-border/50 bg-parchment-card-bg px-4 py-2 text-xs font-bold uppercase tracking-wider text-parchment-base-text transition-colors hover:bg-parchment-base-bg"
                    >
                        {t('common:close')}
                    </button>
                    {!isInstalled && (
                        <button
                            type="button"
                            onClick={() => {
                                if (isInProgress) {
                                    void onCancel();
                                    return;
                                }
                                if (isFailed) {
                                    void onRetry?.();
                                    return;
                                }

                                void onConfirm();
                            }}
                            disabled={isPrimaryDisabled}
                            aria-busy={isLoading}
                            className={[
                                'touch-target-min inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                isInProgress
                                    ? 'border border-amber-800/25 bg-amber-50/92 text-amber-900 hover:bg-amber-100'
                                    : 'bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown',
                            ].join(' ')}
                        >
                            <PrimaryIcon size={14} />
                            <span>{primaryActionLabel}</span>
                        </button>
                    )}
                </div>
            </section>
        </ModalBase>
    );
};

export default GamePackageInstallConfirmModal;
