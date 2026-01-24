import type { ReactNode } from 'react';

export const MagnifyOverlay = ({
    isOpen,
    onClose,
    children,
    containerClassName = '',
    overlayClassName = '',
    closeLabel,
    closeButtonClassName = '',
}: {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    containerClassName?: string;
    overlayClassName?: string;
    closeLabel?: string;
    closeButtonClassName?: string;
}) => {
    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-8 backdrop-blur-md animate-in fade-in duration-200 ${overlayClassName}`}
            onClick={onClose}
        >
            <div
                className={`relative shadow-2xl border border-white/10 rounded-[1vw] overflow-hidden group/modal ${containerClassName}`}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
                {closeLabel && (
                    <button
                        className={`absolute -top-12 right-0 text-white/50 hover:text-white text-sm flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full transition-colors ${closeButtonClassName}`}
                        onClick={onClose}
                    >
                        {closeLabel}
                    </button>
                )}
            </div>
        </div>
    );
};
