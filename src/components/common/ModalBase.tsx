import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ModalBaseProps {
    open: boolean;
    onClose?: () => void;
    overlayClassName?: string;
    containerClassName?: string;
    children: ReactNode;
}

export const ModalBase = ({
    open,
    onClose,
    overlayClassName,
    containerClassName,
    children,
}: ModalBaseProps) => {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className={clsx('fixed inset-0 backdrop-blur-sm', overlayClassName)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className={clsx(
                            'fixed inset-0 flex items-center justify-center pointer-events-none',
                            containerClassName
                        )}
                    >
                        {children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
