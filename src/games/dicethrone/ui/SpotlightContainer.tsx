/**
 * 统一特写容器组件
 *
 * 无遮罩、无虚化背景，支持自动关闭和点击确认。
 * 可用于卡牌特写、骰子特写，或两者同时显示。
 */

import React from 'react';
import type { MotionProps } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';
import { UI_Z_INDEX } from '../../../core';

type SpotlightMotion = Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>;

interface SpotlightContainerProps {
    /** 唯一标识 */
    id: string;
    /** 是否显示 */
    isVisible: boolean;
    /** 关闭回调 */
    onClose: () => void;
    /** 自动关闭延迟（毫秒），默认 3000 */
    autoCloseDelay?: number;
    /** 子内容 */
    children: React.ReactNode;
    /** z-index，默认 9999 */
    zIndex?: number;
    /** 内层内容动画（用于卡牌从对手悬浮窗飞入等自定义动画） */
    contentMotion?: SpotlightMotion;
    /** 点击内容是否关闭（默认 true） */
    closeOnContentClick?: boolean;
    /** 禁用自动关闭（用于交互模式） */
    disableAutoClose?: boolean;
    /** 禁用点击背景关闭（用于交互模式） */
    disableBackdropClose?: boolean;
    /** 首次挂载后的点击关闭保护时长，避免触发它的同一次点击立刻把特写关掉 */
    closeClickGuardMs?: number;
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
    autoCloseDelay = 3000,
    children,
    zIndex = UI_Z_INDEX.overlayRaised,
    contentMotion,
    closeOnContentClick = true,
    disableAutoClose = false,
    disableBackdropClose = false,
    closeClickGuardMs = 180,
}) => {
    console.log('[SpotlightContainer] 🎬 渲染:', { 
        id, 
        isVisible, 
        closeClickGuardMs,
        timestamp: Date.now(),
    });
    const visibleSinceRef = React.useRef<number>(0);

    React.useEffect(() => {
        if (isVisible) {
            const now = Date.now();
            visibleSinceRef.current = now;
            console.log('[SpotlightContainer] 🟢 变为可见:', {
                id,
                visibleSince: now,
                closeClickGuardMs,
            });
        }
    }, [id, isVisible, closeClickGuardMs]);

    const isCloseClickGuardActive = React.useCallback(() => {
        if (closeClickGuardMs <= 0) return false;
        const elapsed = Date.now() - visibleSinceRef.current;
        const isActive = elapsed < closeClickGuardMs;
        console.log('[SpotlightContainer] 🛡️ 检查点击保护:', {
            id,
            elapsed,
            closeClickGuardMs,
            isActive,
            timestamp: Date.now(),
        });
        return isActive;
    }, [id, closeClickGuardMs]);

    // 自动关闭计时器
    React.useEffect(() => {
        if (!isVisible || disableAutoClose) return;

        const closeTimer = setTimeout(() => {
            onClose();
        }, autoCloseDelay);


        return () => {
            clearTimeout(closeTimer);
        };
    }, [id, isVisible, autoCloseDelay, onClose, disableAutoClose]);

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
                onClick={disableBackdropClose
                    ? undefined
                    : () => {
                        console.log('[SpotlightContainer] 🖱️ 背景点击:', {
                            id,
                            guardActive: isCloseClickGuardActive(),
                            timestamp: Date.now(),
                        });
                        if (isCloseClickGuardActive()) {
                            console.log('[SpotlightContainer] 🛡️ 点击保护生效，忽略关闭');
                            return;
                        }
                        console.log('[SpotlightContainer] ❌ 执行关闭');
                        onClose();
                    }}
            >
                {/* 内容容器 */}
                <motion.div
                    className="relative pointer-events-auto"
                    initial={m.initial}
                    animate={m.animate}
                    exit={m.exit}
                    transition={m.transition}
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log('[SpotlightContainer] 🖱️ 内容点击:', {
                            id,
                            closeOnContentClick,
                            guardActive: isCloseClickGuardActive(),
                            timestamp: Date.now(),
                        });
                        if (!closeOnContentClick) {
                            console.log('[SpotlightContainer] ⏸️ closeOnContentClick=false，不关闭');
                            return;
                        }
                        if (isCloseClickGuardActive()) {
                            console.log('[SpotlightContainer] 🛡️ 点击保护生效，忽略关闭');
                            return;
                        }
                        console.log('[SpotlightContainer] ❌ 执行关闭');
                        onClose();
                    }}
                >
                    {children}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default SpotlightContainer;
