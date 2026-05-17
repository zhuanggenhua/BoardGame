import clsx from 'clsx';
import { motion, type Variants } from 'framer-motion';
import { memo, type ReactNode, type CSSProperties } from 'react';
import { UI_Z_INDEX } from '../../../core';
import { OverlayLayerProvider } from './OverlayLayerContext';

interface ModalBaseProps {
    onClose?: () => void;
    closeOnBackdrop?: boolean;
    overlayClassName?: string;
    overlayStyle?: CSSProperties;
    containerClassName?: string;
    containerStyle?: CSSProperties;
    preserveKeyboardLayout?: boolean;
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
    overlayStyle,
    containerClassName,
    containerStyle,
    preserveKeyboardLayout = false,
    children,
}: ModalBaseProps) => {
    const resolvedOverlayStyle: CSSProperties = { zIndex: UI_Z_INDEX.modalOverlay, ...overlayStyle };
    const lockedLayoutContainerStyle = preserveKeyboardLayout
        ? ({
            '--modal-active-viewport-height': 'var(--layout-viewport-height, var(--runtime-viewport-height, 100dvh))',
            '--modal-active-bottom-inset': 'var(--safe-area-bottom)',
            '--modal-max-height': 'calc(var(--layout-viewport-height, var(--runtime-viewport-height, 100dvh)) - max(1rem, var(--safe-area-top)) - max(1rem, var(--safe-area-bottom)))',
        } as CSSProperties)
        : undefined;
    const resolvedContainerStyle: CSSProperties = {
        zIndex: UI_Z_INDEX.modalContent,
        ...lockedLayoutContainerStyle,
        ...containerStyle,
    };

    return (
        <>
            <motion.div
                variants={overlayVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onClick={closeOnBackdrop ? onClose : undefined}
                className={clsx(
                    'fixed inset-0 bg-black/50 backdrop-blur-sm',
                    overlayClassName
                )}
                style={{ willChange: 'opacity', ...resolvedOverlayStyle }}
            />

            <motion.div
                variants={contentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={clsx(
                    'modal-base-container fixed inset-0 flex items-center justify-center pointer-events-none',
                    containerClassName
                )}
                data-lock-layout-viewport={preserveKeyboardLayout ? 'true' : undefined}
                style={{ willChange: 'transform, opacity', ...resolvedContainerStyle }}
            >
                <div className="w-full flex justify-center">
                    <OverlayLayerProvider tooltipZIndex={UI_Z_INDEX.modalTooltip}>
                        {children}
                    </OverlayLayerProvider>
                </div>
            </motion.div>
        </>
    );
});

ModalBase.displayName = 'ModalBase';
