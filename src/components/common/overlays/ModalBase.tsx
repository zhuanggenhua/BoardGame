import clsx from 'clsx';
import { motion, type Variants } from 'framer-motion';
import { memo, type ReactNode } from 'react';
import { useDeferredRender } from '../../../hooks/ui/useDeferredRender';
import { useDelayedBackdropBlur } from '../../../hooks/ui/useDelayedBackdropBlur';

interface ModalBaseProps {
    /** 
     * @deprecated 现在由 ModalStackRoot 控制挂载
     */
    open?: boolean;
    onClose?: () => void;
    closeOnBackdrop?: boolean;
    overlayClassName?: string;
    containerClassName?: string;
    children: ReactNode;
}

const overlayVariants: Variants = {
    initial: { opacity: 0 },
    animate: {
        opacity: 1,
        transition: { duration: 0.2, ease: "easeOut" }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.15 }
    }
};

const contentVariants: Variants = {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: {
        opacity: 1, scale: 1, y: 0,
        transition: { type: 'spring', stiffness: 300, damping: 30, mass: 1 }
    },
    exit: {
        opacity: 0, scale: 0.98,
        transition: { duration: 0.1 }
    }
};

export const ModalBase = memo(({
    onClose,
    closeOnBackdrop = true,
    overlayClassName,
    containerClassName,
    children,
}: ModalBaseProps) => {
    const contentReady = useDeferredRender(true);
    const blurEnabled = useDelayedBackdropBlur(true, 200);

    return (
        <>
            <motion.div
                variants={overlayVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onClick={closeOnBackdrop ? onClose : undefined}
                className={clsx(
                    'fixed inset-0 bg-black/50',
                    blurEnabled && 'backdrop-blur-sm',
                    overlayClassName
                )}
                style={{ willChange: 'opacity' }}
            />

            <motion.div
                variants={contentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={clsx(
                    'fixed inset-0 flex items-center justify-center pointer-events-none',
                    containerClassName
                )}
                style={{ willChange: 'transform, opacity' }}
            >
                {contentReady && (
                    <div className="w-full flex justify-center">
                        {children}
                    </div>
                )}
            </motion.div>
        </>
    );
});

ModalBase.displayName = 'ModalBase';
