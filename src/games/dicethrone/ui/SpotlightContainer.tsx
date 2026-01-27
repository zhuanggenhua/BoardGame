/**
 * 统一特写容器组件
 *
 * 无遮罩、无虚化背景，支持自动关闭和点击确认。
 * 可用于卡牌特写、骰子特写，或两者同时显示。
 */

import React from 'react';
import type { MotionProps } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';

type SpotlightMotion = Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>;

interface SpotlightContainerProps {
    /** 唯一标识 */
    id: string;
    /** 是否显示 */
    isVisible: boolean;
    /** 关闭回调 */
    onClose: () => void;
    /** 自动关闭延迟（毫秒），默认 1000 */
    autoCloseDelay?: number;
    /** 子内容 */
    children: React.ReactNode;
    /** z-index，默认 9999 */
    zIndex?: number;
    /** 内层内容动画（用于卡牌从对手悬浮窗飞入等自定义动画） */
    contentMotion?: SpotlightMotion;
    /** 点击内容是否关闭（默认 true） */
    closeOnContentClick?: boolean;
}

const DEFAULT_CONTENT_MOTION: SpotlightMotion = {
    initial: { scale: 0.5, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
    transition: {
        type: 'spring',
        stiffness: 200,
        damping: 25,
    },
};


export const SpotlightContainer: React.FC<SpotlightContainerProps> = ({
    id,
    isVisible,
    onClose,
    autoCloseDelay = 1000,
    children,
    zIndex = 9999,
    contentMotion,
    closeOnContentClick = true,
}) => {

    // 自动关闭计时器
    React.useEffect(() => {
        if (!isVisible) return;

        const closeTimer = setTimeout(() => {
            onClose();
        }, autoCloseDelay);

        return () => {
            clearTimeout(closeTimer);
        };
    }, [id, isVisible, autoCloseDelay, onClose]);

    if (!isVisible) {
        return null;
    }

    const m = contentMotion ?? DEFAULT_CONTENT_MOTION;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={id}
                className="fixed inset-0 flex items-center justify-center"
                style={{ zIndex }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={onClose}
            >
                {/* 内容容器 */}
                <motion.div
                    className="relative pointer-events-auto"
                    initial={m.initial}
                    animate={m.animate}
                    exit={m.exit}
                    transition={m.transition}
                    onClick={closeOnContentClick ? onClose : (e) => e.stopPropagation()}
                >
                    {children}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default SpotlightContainer;
