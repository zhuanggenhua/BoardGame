import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';
import { ModalBase } from './ModalBase';
import { UI_Z_INDEX } from '../../../core';

type ConfirmTone = 'warm' | 'cool';

interface ConfirmModalTheme {
    overlay: string;
    container?: string;
    panel: string;
    title: string;
    description: string;
    actions: string;
    confirmButton: string;
    cancelButton: string;
}

interface ConfirmModalProps {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
    tone?: ConfirmTone;
    theme?: Partial<ConfirmModalTheme>;
    closeOnBackdrop?: boolean;
    overlayClassName?: string;
    containerClassName?: string;
    panelClassName?: string;
    titleClassName?: string;
    descriptionClassName?: string;
    actionsClassName?: string;
    confirmClassName?: string;
    cancelClassName?: string;
}

const baseTheme: Omit<ConfirmModalTheme, 'overlay'> = {
    panel: 'bg-parchment-card-bg border border-parchment-card-border/50 shadow-parchment-card-hover rounded-sm p-6 w-full max-w-[20rem] sm:max-w-sm text-center font-serif pointer-events-auto',
    title: 'text-xs sm:text-sm text-parchment-light-text font-bold uppercase tracking-wider mb-2',
    description: 'text-parchment-base-text font-bold text-sm sm:text-base mb-5',
    actions: 'flex items-center justify-center gap-3',
    confirmButton: 'px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown transition-colors rounded-[4px]',
    cancelButton: 'px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border border-parchment-card-border/50 text-parchment-base-text bg-parchment-card-bg hover:bg-parchment-base-bg transition-colors rounded-[4px]',
};

const themeByTone: Record<ConfirmTone, ConfirmModalTheme> = {
    warm: {
        overlay: 'bg-[#2b2114]/30',
        ...baseTheme,
    },
    cool: {
        overlay: 'bg-slate-900/40',
        ...baseTheme,
    },
};

export const ConfirmModal = ({
    title,
    description,
    confirmText,
    cancelText,
    showCancel = true,
    onConfirm,
    onCancel,
    isLoading = false,
    tone = 'warm',
    theme,
    closeOnBackdrop,
    overlayClassName,
    containerClassName,
    panelClassName,
    titleClassName,
    descriptionClassName,
    actionsClassName,
    confirmClassName,
    cancelClassName,
}: ConfirmModalProps) => {
    const { t } = useTranslation('common');
    const [isSubmitting, setIsSubmitting] = useState(isLoading);

    useEffect(() => {
        setIsSubmitting(isLoading);
    }, [isLoading]);

    const mergedTheme = {
        ...themeByTone[tone],
        ...theme,
    };
    const resolvedConfirmText = confirmText ?? t('button.confirm');
    const resolvedCancelText = cancelText ?? t('button.cancel');

    const handleCancel = () => {
        if (isSubmitting) return;
        onCancel();
    };

    const handleConfirm = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onConfirm();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalBase
            onClose={handleCancel}
            closeOnBackdrop={!isSubmitting && closeOnBackdrop}
            overlayClassName={twMerge(mergedTheme.overlay, overlayClassName)}
            overlayStyle={{ zIndex: UI_Z_INDEX.modalOverlay }}
            containerClassName={twMerge('p-4 sm:p-6', mergedTheme.container, containerClassName)}
            containerStyle={{ zIndex: UI_Z_INDEX.modalContent }}
        >
            <div
                className={twMerge(
                    mergedTheme.panel,
                    panelClassName
                )}
            >
                <div
                    className={twMerge(mergedTheme.title, titleClassName)}
                >
                    {title}
                </div>
                <div
                    className={twMerge(mergedTheme.description, descriptionClassName)}
                >
                    {description}
                </div>
                <div className={twMerge(mergedTheme.actions, actionsClassName)}>
                    {showCancel && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                            className={twMerge(
                                mergedTheme.cancelButton,
                                isSubmitting && 'cursor-not-allowed opacity-60 hover:bg-parchment-card-bg',
                                cancelClassName
                            )}
                        >
                            {resolvedCancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            void handleConfirm();
                        }}
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                        className={twMerge(
                            mergedTheme.confirmButton,
                            isSubmitting && 'cursor-not-allowed opacity-60 hover:bg-parchment-base-text',
                            confirmClassName
                        )}
                    >
                        {resolvedConfirmText}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
};
