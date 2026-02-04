import { AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { type ReactNode } from 'react';
import { ModalBase } from '../../../../components/common/overlays/ModalBase';

interface GameModalProps {
    isOpen: boolean;
    onClose?: () => void;
    title?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    width?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    closeOnBackdrop?: boolean;
}

export const GameModal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    width = 'md',
    className,
    closeOnBackdrop = true,
}: GameModalProps) => {

    const widthClass = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-xl',
        xl: 'max-w-3xl'
    }[width];

    return (
        <AnimatePresence>
            {isOpen && (
                <ModalBase
                    onClose={onClose}
                    closeOnBackdrop={closeOnBackdrop}
                    overlayClassName="z-[1000] !bg-black/85"
                    containerClassName="z-[1001]"
                >
                    <div
                        className={clsx(
                            "relative bg-slate-950 border-2 border-amber-500/40 pointer-events-auto",
                            "shadow-[0_0_50px_rgba(0,0,0,0.8)]",
                            "rounded-2xl overflow-visible flex flex-col w-full mx-4",
                            // Dynamic background pattern
                            "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] before:from-slate-800/50 before:to-transparent before:pointer-events-none",
                            widthClass,
                            className
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        {title && (
                            <div className="relative px-6 py-5 bg-black/20 border-b border-white/5 flex items-center justify-center shrink-0">
                                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-600 drop-shadow-md text-center">
                                    {title}
                                </h2>
                                {/* Decorative elements */}
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-amber-500/50 border border-amber-300" />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-amber-500/50 border border-amber-300" />
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-6 sm:p-8 text-slate-300 leading-relaxed text-center relative z-10 flex flex-col items-center">
                            {children}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div className="p-6 pt-0 sm:pt-0 sm:pb-8 flex gap-4 justify-center relative z-10">
                                {footer}
                            </div>
                        )}
                    </div>
                </ModalBase>
            )}
        </AnimatePresence>
    );
};
