import type { Variants } from 'framer-motion';

// 通用动画变体 - 供多游戏复用

/** 飞行动画变体（抛物线轨迹） */
export const flyToTargetVariants: Variants = {
    initial: {
        scale: 1,
        opacity: 1,
    },
    animate: (custom: { endX: number; endY: number }) => ({
        x: custom.endX,
        y: custom.endY,
        scale: [1, 1.3, 1],
        opacity: 1,
        transition: {
            duration: 0.6,
            ease: [0.34, 1.56, 0.64, 1],
            scale: {
                times: [0, 0.5, 1],
            },
        },
    }),
    exit: {
        scale: 2,
        opacity: 0,
        transition: { duration: 0.3 },
    },
};

/** 冲击消散动画变体 */
export const impactVariants: Variants = {
    initial: { scale: 1, opacity: 1 },
    animate: {
        scale: 2,
        opacity: 0,
        transition: { duration: 0.3, ease: 'easeOut' },
    },
};

/** 震动动画变体 — 加强版，XY 双轴 + 微旋转 */
export const shakeVariants: Variants = {
    idle: { x: 0, y: 0, rotate: 0 },
    shake: {
        x: [-14, 12, -10, 8, -6, 4, -2, 0],
        y: [0, -6, 4, -3, 2, -1, 0],
        rotate: [0, -1.5, 1, -0.8, 0.5, 0],
        transition: {
            duration: 0.5,
            ease: 'easeOut',
        },
    },
};

/** 脉冲发光动画变体（技能激活） */
export const pulseGlowVariants: Variants = {
    idle: {
        boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)',
    },
    glow: {
        boxShadow: [
            '0 0 0 0 rgba(251, 191, 36, 0.8)',
            '0 0 30px 10px rgba(251, 191, 36, 0.6)',
            '0 0 0 0 rgba(251, 191, 36, 0)',
        ],
        transition: {
            duration: 0.8,
            ease: 'easeOut',
        },
    },
};

/** 淡入滑动动画变体 */
export const fadeSlideVariants: Variants = {
    initial: { opacity: 0, y: -20 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: 'easeOut' },
    },
    exit: {
        opacity: 0,
        y: -10,
        transition: { duration: 0.2 },
    },
};

/** 缩放弹出动画变体 */
export const scalePopVariants: Variants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: {
        scale: 1,
        opacity: 1,
        transition: { duration: 0.2, ease: 'easeOut' },
    },
    exit: {
        scale: 0.8,
        opacity: 0,
        transition: { duration: 0.15 },
    },
};
