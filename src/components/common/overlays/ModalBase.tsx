import clsx from 'clsx';
import { motion, type Variants } from 'framer-motion';
import { memo, type ReactNode, type CSSProperties } from 'react';
import { UI_Z_INDEX } from '../../../core';

interface ModalBaseProps {
    onClose?: () => void;
    closeOnBackdrop?: boolean;
    overlayClassName?: string;
    overlayStyle?: CSSProperties;
    containerClassName?: string;
    containerStyle?: CSSProperties;
    contentWrapperClassName?: string;
    contentWrapperStyle?: CSSProperties;
    visualStyle?: 'default' | 'home-v2';
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

const homeV2ContentVariants: Variants = {
    initial: { opacity: 0 },
    animate: {
        opacity: 1,
        transition: { duration: 0.18, ease: 'easeOut' },
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.12, ease: 'easeIn' },
    },
};

export const ModalBase = memo(({
    onClose,
    closeOnBackdrop = true,
    overlayClassName,
    overlayStyle,
    containerClassName,
    containerStyle,
    contentWrapperClassName,
    contentWrapperStyle,
    visualStyle = 'default',
    children,
}: ModalBaseProps) => {
    const resolvedOverlayStyle: CSSProperties = { zIndex: UI_Z_INDEX.modalOverlay, ...overlayStyle };
    const resolvedContainerStyle: CSSProperties = { zIndex: UI_Z_INDEX.modalContent, ...containerStyle };
    const resolvedContentVariants = visualStyle === 'home-v2' ? homeV2ContentVariants : contentVariants;
    const resolvedWillChange = visualStyle === 'home-v2' ? 'opacity' : 'transform, opacity';

    const baseContainerClassName = visualStyle === 'home-v2'
        ? 'fixed inset-0 flex items-center justify-center pointer-events-none'
        : 'modal-base-container fixed inset-0 flex items-center justify-center pointer-events-none';
    const homeV2ContainerStyle: CSSProperties | undefined = visualStyle === 'home-v2'
        ? {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            height: '100vh',
            maxHeight: '100vh',
            overflowY: 'visible',
        }
        : undefined;

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
                variants={resolvedContentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={clsx(
                    baseContainerClassName,
                    containerClassName
                )}
                style={{ willChange: resolvedWillChange, ...homeV2ContainerStyle, ...resolvedContainerStyle }}
            >
                <div className={clsx('w-full flex justify-center', contentWrapperClassName)} style={contentWrapperStyle}>
                    {children}
                </div>
            </motion.div>
        </>
    );
});

ModalBase.displayName = 'ModalBase';
