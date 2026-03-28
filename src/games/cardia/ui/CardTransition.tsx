/**
 * Cardia 卡牌过渡动画组件
 * 
 * 提供卡牌进出场、位置变化的流畅过渡动画
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CardTransitionProps {
    children: React.ReactNode;
    cardUid: string;
    /** 动画类型：hand（手牌）、field（场上）、discard（弃牌堆） */
    type?: 'hand' | 'field' | 'discard';
    /** 是否启用布局动画（位置变化时的平滑过渡） */
    layoutAnimation?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * 卡牌过渡动画包装器
 * 
 * 使用 framer-motion 的 AnimatePresence + layoutId 实现：
 * - 进场：从透明淡入 + 轻微缩放
 * - 退场：淡出 + 缩小
 * - 位置变化：平滑过渡（通过 layoutId）
 */
export const CardTransition: React.FC<CardTransitionProps> = ({
    children,
    cardUid,
    type = 'hand',
    layoutAnimation = true,
    className,
    style,
}) => {
    // 根据类型定制动画参数
    const animationConfig = {
        hand: {
            initial: { opacity: 0, scale: 0.8, y: 20 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.8, y: -20 },
            transition: { duration: 0.3, ease: 'easeOut' },
        },
        field: {
            initial: { opacity: 0, scale: 0.9 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.9 },
            transition: { duration: 0.25, ease: 'easeInOut' },
        },
        discard: {
            initial: { opacity: 0, scale: 0.7, rotate: -10 },
            animate: { opacity: 1, scale: 1, rotate: 0 },
            exit: { opacity: 0, scale: 0.7, rotate: 10 },
            transition: { duration: 0.2, ease: 'easeIn' },
        },
    };

    const config = animationConfig[type];

    return (
        <motion.div
            key={cardUid}
            layoutId={layoutAnimation ? `card-${cardUid}` : undefined}
            initial={config.initial}
            animate={config.animate}
            exit={config.exit}
            transition={config.transition}
            layout={layoutAnimation}
            className={className}
            style={{ overflow: 'visible', ...style }}
        >
            {children}
        </motion.div>
    );
};

/**
 * 卡牌列表过渡容器
 * 
 * 包装 AnimatePresence，用于管理多张卡牌的进出场动画
 */
interface CardListTransitionProps {
    children: React.ReactNode;
    /** 是否启用初始动画（首次渲染时） */
    initial?: boolean;
}

export const CardListTransition: React.FC<CardListTransitionProps> = ({
    children,
    initial = false,
}) => {
    return (
        <AnimatePresence initial={initial} mode="popLayout">
            {children}
        </AnimatePresence>
    );
};
