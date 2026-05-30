import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { UI_Z_INDEX } from '../../../core';
import { useHomeV2CompactLandscape } from '../../../hooks/ui/useHomeV2CompactLandscape';
import { HomeV2PaperModalFrame } from './HomeV2PaperModalFrame';
import {
    homeV2PaperCompactDangerPrimaryButtonClassName,
    homeV2PaperCompactSecondaryButtonClassName,
    homeV2PaperDangerPrimaryButtonClassName,
    homeV2PaperSecondaryButtonClassName,
} from './homeV2PaperModalTheme';

interface HomeV2DangerConfirmModalProps {
    open: boolean;
    title: ReactNode;
    description?: ReactNode;
    subject: ReactNode;
    cancelLabel: ReactNode;
    confirmLabel: ReactNode;
    processingLabel?: ReactNode;
    isProcessing?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    panelTestId: string;
    surfaceTestId: string;
    confirmTestId: string;
    cancelTestId?: string;
}

export const HomeV2DangerConfirmModal = ({
    open,
    title,
    description,
    subject,
    cancelLabel,
    confirmLabel,
    processingLabel,
    isProcessing = false,
    onCancel,
    onConfirm,
    panelTestId,
    surfaceTestId,
    confirmTestId,
    cancelTestId,
}: HomeV2DangerConfirmModalProps) => {
    const isCompactLandscape = useHomeV2CompactLandscape();

    if (!open || typeof document === 'undefined') {
        return null;
    }

    const secondaryButtonClassName = isCompactLandscape
        ? homeV2PaperCompactSecondaryButtonClassName
        : homeV2PaperSecondaryButtonClassName;
    const dangerButtonClassName = isCompactLandscape
        ? homeV2PaperCompactDangerPrimaryButtonClassName
        : homeV2PaperDangerPrimaryButtonClassName;

    return createPortal(
        <div
            data-testid={panelTestId}
            className="fixed inset-0 flex items-center justify-center bg-[rgba(18,13,9,0.56)] p-4 pointer-events-auto backdrop-blur-[2px]"
            style={{ zIndex: UI_Z_INDEX.modalContent }}
        >
            <HomeV2PaperModalFrame
                title={title}
                dataTestId={surfaceTestId}
                surfaceClassName={clsx(
                    'font-serif',
                    isCompactLandscape && 'home-v2-paper-modal-compact',
                    isCompactLandscape ? 'w-[min(15.5rem,calc(100vw-1rem))]' : 'w-[min(24rem,calc(100vw-2rem))]',
                )}
                headerClassName={isCompactLandscape ? 'px-[22px] pb-[9px] pt-[13px]' : 'px-7 pb-3 pt-6'}
                titleClassName={isCompactLandscape ? 'text-[11.8px] tracking-[0.075em]' : undefined}
                dividerClassName={isCompactLandscape ? 'mt-[7px] w-[72%] gap-1.5' : undefined}
            >
                <div className={clsx(
                    'relative z-10 flex flex-col items-center text-center',
                    isCompactLandscape ? 'gap-[8px] px-[22px] pb-[11px]' : 'gap-4 px-7 pb-6',
                )}>
                    {description ? (
                        <div className={clsx(
                            'text-[#5b3823]',
                            isCompactLandscape ? 'max-w-[11.5rem] text-[8.2px] leading-[1.55]' : 'max-w-[18rem] text-[13px] leading-[1.7]',
                        )}>
                            {description}
                        </div>
                    ) : null}
                    <div className={clsx(
                        'w-full rounded-[2px] border border-[#a5743c]/28 bg-[rgba(244,230,206,0.24)] font-semibold text-[#3f2616]',
                        isCompactLandscape ? 'max-w-[11.5rem] px-[8px] py-[6px] text-[8.6px]' : 'max-w-[18rem] px-3 py-2 text-[13px]',
                    )}>
                        {subject}
                    </div>
                    <div className={clsx('flex items-center justify-center', isCompactLandscape ? 'gap-[6px]' : 'gap-3')}>
                        <button
                            type="button"
                            onClick={() => {
                                if (isProcessing) {
                                    return;
                                }
                                onCancel();
                            }}
                            data-testid={cancelTestId}
                            className={clsx(secondaryButtonClassName, 'min-w-[6.75rem]')}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isProcessing}
                            data-testid={confirmTestId}
                            className={clsx(dangerButtonClassName, 'min-w-[7.25rem]')}
                        >
                            {isProcessing && processingLabel ? processingLabel : confirmLabel}
                        </button>
                    </div>
                </div>
            </HomeV2PaperModalFrame>
        </div>,
        document.body,
    );
};
