import clsx from 'clsx';
import { ModalBase } from './ModalBase';

type ConfirmTone = 'warm' | 'cool';

interface ConfirmModalProps {
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    tone?: ConfirmTone;
    overlayClassName?: string;
    containerClassName?: string;
    panelClassName?: string;
    titleClassName?: string;
    descriptionClassName?: string;
    actionsClassName?: string;
    confirmClassName?: string;
    cancelClassName?: string;
}

const overlayToneMap: Record<ConfirmTone, string> = {
    warm: 'bg-[#2b2114]/30',
    cool: 'bg-slate-900/40',
};

export const ConfirmModal = ({
    open,
    title,
    description,
    confirmText = '确认',
    cancelText = '取消',
    showCancel = true,
    onConfirm,
    onCancel,
    tone = 'warm',
    overlayClassName,
    containerClassName,
    panelClassName,
    titleClassName,
    descriptionClassName,
    actionsClassName,
    confirmClassName,
    cancelClassName,
}: ConfirmModalProps) => {
    return (
        <ModalBase
            open={open}
            onClose={onCancel}
            overlayClassName={clsx('z-[60]', overlayToneMap[tone], overlayClassName)}
            containerClassName={clsx('z-[61] p-4', containerClassName)}
        >
            <div
                className={clsx(
                    'bg-[#fcfbf9] border border-[#e5e0d0] shadow-[0_10px_40px_rgba(67,52,34,0.15)] rounded-sm p-6 w-full max-w-sm text-center font-serif pointer-events-auto',
                    panelClassName
                )}
            >
                <div
                    className={clsx(
                        'text-xs text-[#8c7b64] font-bold uppercase tracking-wider mb-2',
                        titleClassName
                    )}
                >
                    {title}
                </div>
                <div
                    className={clsx(
                        'text-[#433422] font-bold text-base mb-5',
                        descriptionClassName
                    )}
                >
                    {description}
                </div>
                <div className={clsx('flex items-center justify-center gap-3', actionsClassName)}>
                    {showCancel && (
                        <button
                            onClick={onCancel}
                            className={clsx(
                                'px-4 py-2 text-xs font-bold uppercase tracking-wider border border-[#e5e0d0] text-[#433422] bg-[#fcfbf9] hover:bg-[#efede6] transition-colors rounded-[4px]',
                                cancelClassName
                            )}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={clsx(
                            'px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#433422] text-[#fcfbf9] hover:bg-[#2b2114] transition-colors rounded-[4px]',
                            confirmClassName
                        )}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
};
