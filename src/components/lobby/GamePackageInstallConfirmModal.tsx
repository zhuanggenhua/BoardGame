import { AlertTriangle, Download, HardDriveDownload, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalBase } from '../common/overlays/ModalBase';
import type { GamePackageCardState } from '../../features/mobile-packages/types';
import { formatPackageBytes } from './packageManagerFormat';
import {
    resolveGamePackageFailureActionLabel,
    resolveGamePackageFailureMessage,
} from '../../features/mobile-packages/errorMessages';

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
    visualStyle?: 'default' | 'home-v2';
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
    visualStyle = 'default',
}: GamePackageInstallConfirmModalProps) => {
    const { t } = useTranslation('lobby');
    const isHomeV2Style = visualStyle === 'home-v2';
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
    const isUpdatePreview = state.status === 'installed' && state.isUpdateAvailable === true;
    const isInstalled = state.status === 'installed' && !isUpdatePreview;
    const isPreview = state.status === 'not-installed' || isUpdatePreview;
    const progressTitleKey = state.status === 'queued'
        ? 'packageManager.progress.queuedTitle'
        : state.status === 'manifest'
            ? 'packageManager.progress.manifestTitle'
            : state.status === 'downloading'
                ? 'packageManager.progress.downloadTitle'
                : 'packageManager.progress.verifyTitle';
    const progressHintKey = state.status === 'queued'
        ? 'packageManager.progress.queuedHint'
        : state.status === 'manifest'
            ? 'packageManager.progress.manifestHint'
            : state.status === 'downloading'
                ? 'packageManager.progress.downloadHint'
                : 'packageManager.progress.verifyHint';
    const modalTitle = isPreview
        ? t('packageManager.confirmTitle', { game: gameName })
        : isFailed
            ? t('packageManager.failedTitle')
            : isInstalled
                ? t('packageManager.installedTitle')
                : t(progressTitleKey);
    const modalDescription = isPreview
        ? t('packageManager.confirmDescription')
        : isFailed
            ? resolveGamePackageFailureMessage(t, state.errorCode, state.errorMessage)
            : isInstalled
                ? t('packageManager.installedHint', { game: gameName })
                : t(progressHintKey);
    const PrimaryIcon = isInProgress ? X : isFailed ? RefreshCw : Download;
    const primaryActionLabel = isInProgress
        ? t('packageManager.cancelAction')
        : isFailed
            ? (failedActionLabel || resolveGamePackageFailureActionLabel(t, state.errorCode, state.errorMessage))
            : t('packageManager.confirmAction');
    const isPrimaryDisabled = !isInProgress && isLoading;

    return (
        <ModalBase
            onClose={onClose}
            closeOnBackdrop={closeOnBackdrop}
            visualStyle={isHomeV2Style ? 'home-v2' : 'default'}
            overlayClassName={isHomeV2Style ? 'bg-[rgba(24,14,8,0.58)] backdrop-blur-[1px]' : 'bg-[#2b2114]/30'}
            containerClassName={isHomeV2Style ? 'p-[10px]' : 'p-4 sm:p-6'}
            containerStyle={{
                paddingTop: isHomeV2Style ? 'max(0.5rem, env(safe-area-inset-top))' : 'max(1rem, env(safe-area-inset-top))',
                paddingRight: isHomeV2Style ? 'max(0.5rem, env(safe-area-inset-right))' : 'max(1rem, env(safe-area-inset-right))',
                paddingBottom: isHomeV2Style ? 'max(0.5rem, env(safe-area-inset-bottom))' : 'max(1rem, env(safe-area-inset-bottom))',
                paddingLeft: isHomeV2Style ? 'max(0.5rem, env(safe-area-inset-left))' : 'max(1rem, env(safe-area-inset-left))',
            }}
        >
            <section
                data-testid="game-details-mobile-package-install-confirm-modal"
                className={isHomeV2Style
                    ? 'pointer-events-auto max-h-[calc(var(--runtime-viewport-height,100vh)-1rem)] w-full max-w-[min(25.5rem,calc(100vw-1.25rem))] overflow-y-auto rounded-[6px] border border-[#8e6140]/54 bg-[linear-gradient(180deg,#f6dfb8_0%,#ecc797_100%)] px-[18px] py-[14px] font-serif text-[#3f2718] shadow-[0_14px_28px_rgba(40,24,13,0.30),inset_0_1px_0_rgba(255,246,225,0.72)]'
                    : 'pointer-events-auto w-full max-w-[21rem] rounded-sm border border-parchment-card-border/50 bg-parchment-card-bg p-5 font-serif text-parchment-base-text shadow-parchment-card-hover'}
            >
                <div className={isHomeV2Style ? 'inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#7a6248]' : 'inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-parchment-light-text'}>
                    {isFailed ? <AlertTriangle size={15} /> : <HardDriveDownload size={15} />}
                    <span>{isPreview ? t('packageManager.confirmEyebrow') : t('packageManager.eyebrow')}</span>
                </div>
                <h3 className={isHomeV2Style ? 'mt-2 text-[17px] font-bold leading-tight' : 'mt-3 text-lg font-bold leading-tight'}>
                    {modalTitle}
                </h3>
                <p className={[
                    isHomeV2Style ? 'mt-1.5 text-[11px] leading-[1.55] text-[#7a6248]' : 'mt-2 text-sm leading-6 text-parchment-light-text',
                    isFailed ? 'whitespace-pre-line' : '',
                ].join(' ')}>
                    {modalDescription}
                </p>

                <div className={isHomeV2Style ? 'mt-3 rounded-[4px] border border-[#9d773f]/26 bg-[#fff4da]/36 p-2.5' : 'mt-4 rounded-[8px] border border-parchment-card-border/35 bg-parchment-base-bg/45 p-3'}>
                    <div className={isHomeV2Style ? 'flex items-center justify-between gap-3 border-b border-[#9d773f]/20 pb-2' : 'flex items-center justify-between gap-3 border-b border-parchment-card-border/20 pb-3'}>
                        <div>
                            <p className={isHomeV2Style ? 'text-[8px] font-semibold uppercase tracking-[0.12em] text-[#7a6248]/82' : 'text-[10px] font-semibold uppercase tracking-[0.16em] text-parchment-light-text/80'}>
                                {t('packageManager.totalSize')}
                            </p>
                            <p className={isHomeV2Style ? 'mt-0.5 text-[14px] font-bold text-[#3f2718]' : 'mt-1 text-base font-bold text-parchment-base-text'}>
                                {formatPackageBytes(totalBytes, sizeUnknownLabel)}
                            </p>
                        </div>
                        <div className={isHomeV2Style ? 'rounded-[3px] border border-[#9d773f]/28 bg-[#fff9ea]/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#7a6248]' : 'rounded-full border border-parchment-card-border/30 bg-parchment-card-bg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-parchment-light-text'}>
                            {t('packageManager.mode')}
                        </div>
                    </div>

                    {packageItems.length > 0 && (
                        <div className={isHomeV2Style ? 'mt-2 grid grid-cols-2 gap-2' : 'mt-3 space-y-2.5'}>
                            {packageItems.map((item) => (
                                <div key={item.label} className={isHomeV2Style ? 'min-w-0 border-l border-[#9d773f]/22 pl-2' : 'flex items-start justify-between gap-3'}>
                                    <div className="min-w-0">
                                        <p className={isHomeV2Style ? 'text-[12px] font-semibold leading-tight' : 'text-sm font-semibold'}>{item.label}</p>
                                        <p className={isHomeV2Style ? 'mt-1 truncate text-[9px] leading-tight text-[#7a6248]' : 'mt-1 text-[11px] leading-5 text-parchment-light-text'}>
                                            {item.id || t('packageManager.packIdUnknown')}
                                        </p>
                                    </div>
                                    <span className={isHomeV2Style ? 'mt-1 block shrink-0 text-[9px] font-medium text-[#7a6248]' : 'shrink-0 text-[11px] font-medium text-parchment-light-text'}>
                                        {formatPackageBytes(item.bytes, sizeUnknownLabel)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {isInProgress && (
                        <div className={isHomeV2Style ? 'mt-3 border-t border-[#9d773f]/20 pt-2' : 'mt-4 border-t border-parchment-card-border/20 pt-3'}>
                            <div className={isHomeV2Style ? 'flex items-center justify-between gap-3 text-[10px] font-medium text-[#7a6248]' : 'flex items-center justify-between gap-3 text-[11px] font-medium text-parchment-light-text'}>
                                <span>{t('packageManager.progress.label')}</span>
                                <span>
                                    {progressMode === 'determinate'
                                        ? t('packageManager.progress.percent', { percent: Math.round(progressPercent) })
                                        : t('packageManager.progress.pendingPercent')}
                                </span>
                            </div>
                            <div
                                data-testid="game-details-mobile-package-progress-track"
                                className={isHomeV2Style ? 'mt-1.5 h-1.5 overflow-hidden rounded-[2px] bg-[#fff9ea]/82' : 'mt-2 h-2 overflow-hidden rounded-full bg-parchment-card-bg'}
                            >
                                <div
                                    data-testid="game-details-mobile-package-progress-fill"
                                    className={[
                                        isHomeV2Style ? 'h-full rounded-[2px] bg-[#5a371f]/85 transition-[width] duration-300' : 'h-full rounded-full bg-parchment-base-text/85 transition-[width] duration-300',
                                        progressMode === 'indeterminate' ? 'w-2/3 animate-pulse' : '',
                                    ].filter(Boolean).join(' ')}
                                    style={progressMode === 'determinate' ? { width: `${progressPercent}%` } : undefined}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <p className={isHomeV2Style ? 'mt-2 line-clamp-2 text-[10px] leading-[1.45] text-[#7a6248]/86' : 'mt-3 text-[11px] leading-5 text-parchment-light-text/85'}>
                    {isPreview ? t('packageManager.confirmHint') : t('packageManager.modalHint')}
                </p>

                <div className={isHomeV2Style ? 'mt-3 flex items-center justify-end gap-2' : 'mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'}>
                    <button
                        type="button"
                        onClick={() => {
                            void onClose();
                        }}
                        disabled={false}
                        className={isHomeV2Style ? 'inline-flex h-[31px] min-w-[66px] items-center justify-center rounded-[2px] border border-[#9d773f]/38 bg-[#fff4da]/70 px-3 text-[10px] font-bold tracking-[0.06em] text-[#4b2d1a] transition-colors hover:bg-[#f4dfb8]' : 'touch-target-min rounded-[4px] border border-parchment-card-border/50 bg-parchment-card-bg px-4 py-2 text-xs font-bold uppercase tracking-wider text-parchment-base-text transition-colors hover:bg-parchment-base-bg'}
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
                                isHomeV2Style ? 'inline-flex h-[31px] min-w-[92px] items-center justify-center gap-1.5 rounded-[2px] px-3 text-[10px] font-bold tracking-[0.06em] transition-colors disabled:cursor-not-allowed disabled:opacity-60' : 'touch-target-min inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
