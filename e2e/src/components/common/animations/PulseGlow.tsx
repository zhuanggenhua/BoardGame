import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pulseGlowVariants } from './variants';

interface PulseGlowProps {
    children: React.ReactNode;
    isGlowing: boolean;
    className?: string;
    style?: React.CSSProperties;
    glowColor?: string;
    onClick?: () => void;
    loop?: boolean;
    effect?: 'glow' | 'ripple';
}

// 脉冲发光容器组件 - 技能激活时的发光效果
// 统一 DOM 结构：始终用同一个 div 容器，避免 effect 切换时 children 被重新挂载
export const PulseGlow = ({
    children,
    isGlowing,
    className = '',
    style,
    glowColor = 'rgba(251, 191, 36, 0.6)',
    onClick,
    loop = false,
    effect = 'glow',
}: PulseGlowProps) => {
    const defaultGlowColor = 'rgba(251, 191, 36, 0.6)';
    const useRipple = effect === 'ripple';

    const glowBoxShadow = React.useMemo(() => {
        if (useRipple) return undefined;
        const useDefault = glowColor === defaultGlowColor && !loop;
        if (useDefault) return pulseGlowVariants;
        return {
            idle: {
                boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)',
            },
            glow: {
                boxShadow: [
                    `0 0 0 0 ${glowColor.replace('0.6', '0.8')}`,
                    `0 0 30px 10px ${glowColor}`,
                    `0 0 0 0 ${glowColor.replace('0.6', '0')}`,
                ],
                transition: {
                    duration: 0.8,
                    ease: 'easeOut' as const,
                    ...(loop ? { repeat: Infinity, repeatType: 'loop' as const, repeatDelay: 0.8 } : {}),
                },
            },
        };
    }, [glowColor, loop, useRipple]);

    const rippleTransition = React.useMemo(() => ({
        duration: 1.6,
        ease: 'easeOut' as const,
        ...(loop ? { repeat: Infinity, repeatDelay: 0.2 } : {}),
    }), [loop]);

    // glow 模式的动画状态（ripple 模式下固定 idle，不产生 boxShadow）
    const glowAnimate = !useRipple && isGlowing ? 'glow' : 'idle';
    const showRipple = useRipple && isGlowing;

    return (
        <motion.div
            className={className}
            style={{ position: 'relative', overflow: 'visible', ...style }}
            variants={glowBoxShadow}
            animate={glowAnimate}
            onClick={onClick}
        >
            {/* 波纹层：绝对定位在 children 之前（DOM 顺序靠前 = 绘制在下层） */}
            <AnimatePresence>
                {showRipple && (
                    <motion.div
                        key="ripple-container"
                        className="absolute inset-0 pointer-events-none"
                        style={{ overflow: 'visible' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.span
                            className="absolute inset-0 rounded-full border-2"
                            style={{ borderColor: glowColor }}
                            initial={{ opacity: 0.8, scale: 1 }}
                            animate={{ opacity: [0.8, 0], scale: [1, 2.2] }}
                            transition={rippleTransition}
                        />
                        <motion.span
                            className="absolute inset-0 rounded-full border-2"
                            style={{ borderColor: glowColor }}
                            initial={{ opacity: 0.7, scale: 1 }}
                            animate={{ opacity: [0.7, 0], scale: [1, 2.2] }}
                            transition={{ ...rippleTransition, delay: loop ? 0.8 : 0 }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            {children}
        </motion.div>
    );
};

// Hook：管理发光状态
export const usePulseGlow = (duration = 800) => {
    const [isGlowing, setIsGlowing] = React.useState(false);

    const triggerGlow = React.useCallback(() => {
        setIsGlowing(true);
        setTimeout(() => setIsGlowing(false), duration);
    }, [duration]);

    return { isGlowing, triggerGlow };
};
