/**
 * ShakeContainer — 震动容器（共享 FX 帧时钟驱动）
 *
 * 通过统一 FX 帧时钟驱动 transform 实现震动，
 * 支持 paused prop 冻结在当前偏移位置（用于钝帧卡肉）。
 *
 * framer-motion variant 方案无法实现"冻在当前位置"——
 * 切到 idle 时会平滑过渡回原点，达不到卡肉效果。
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { scheduleFxFrameCallback, subscribeFxFrame, type FxFrameSubscription } from '../../../engine/fx';

interface ShakeContainerProps {
    children: React.ReactNode;
    /** 是否正在震动 */
    isShaking: boolean;
    /** 是否暂停（冻结在当前偏移位置，用于钝帧） */
    paused?: boolean;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

/**
 * 预计算的震动关键帧（与原 framer-motion shakeVariants 一致的手感）
 * 每帧间隔约 60ms（~500ms / 8帧），XY 双轴 + 微旋转
 */
const KEYFRAMES = [
    { x: -14, y: 0, r: 0 },
    { x: 12, y: -6, r: -1.5 },
    { x: -10, y: 4, r: 1 },
    { x: 8, y: -3, r: -0.8 },
    { x: -6, y: 2, r: 0.5 },
    { x: 4, y: -1, r: 0 },
    { x: -2, y: 0, r: 0 },
    { x: 0, y: 0, r: 0 },
];

/** 在两个关键帧之间线性插值 */
function lerpFrame(a: typeof KEYFRAMES[0], b: typeof KEYFRAMES[0], t: number) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        r: a.r + (b.r - a.r) * t,
    };
}

// 震动容器组件 - 包裹子元素并在触发时震动
export const ShakeContainer = ({
    children,
    isShaking,
    paused = false,
    className = '',
    style,
    onClick,
}: ShakeContainerProps) => {
    const elRef = useRef<HTMLDivElement>(null);
    const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
    // 震动进度（0~1），用于暂停/恢复
    const progressRef = useRef(0);
    const startTimeRef = useRef(0);
    const pausedRef = useRef(false);

    const DURATION = 500; // ms，与原 shakeVariants 一致

    const stopTick = useCallback(() => {
        unsubscribeRef.current?.();
        unsubscribeRef.current = undefined;
    }, []);

    const applyTransform = useCallback((progress: number) => {
        const el = elRef.current;
        if (!el) return;

        if (progress >= 1) {
            el.style.transform = '';
            return;
        }

        // 根据 progress 找到当前在哪两个关键帧之间
        const totalFrames = KEYFRAMES.length - 1;
        const rawIdx = progress * totalFrames;
        const idx = Math.min(Math.floor(rawIdx), totalFrames - 1);
        const localT = rawIdx - idx;

        const frame = lerpFrame(KEYFRAMES[idx], KEYFRAMES[idx + 1], localT);
        el.style.transform = `translate3d(${frame.x.toFixed(1)}px, ${frame.y.toFixed(1)}px, 0) rotate(${frame.r.toFixed(2)}deg)`;
    }, []);

    // isShaking 变化时启动/停止
    useEffect(() => {
        const el = elRef.current;
        if (!el) return;

        if (!isShaking) {
            stopTick();
            el.style.transform = '';
            progressRef.current = 0;
            pausedRef.current = false;
            return;
        }

        // 开始新的震动
        progressRef.current = 0;
        pausedRef.current = false;
        startTimeRef.current = performance.now();

        const tick = (now: number) => {
            if (pausedRef.current) return;

            const elapsed = now - startTimeRef.current;
            const p = Math.min(elapsed / DURATION, 1);
            progressRef.current = p;
            applyTransform(p);

            if (p >= 1) {
                stopTick();
            }
        };

        stopTick();
        unsubscribeRef.current = subscribeFxFrame(({ now }) => tick(now));

        return stopTick;
    }, [isShaking, applyTransform, stopTick]);

    // paused 变化时暂停/恢复
    useEffect(() => {
        if (!isShaking) return;

        if (paused && !pausedRef.current) {
            // 暂停：停止帧订阅，transform 保持当前值
            pausedRef.current = true;
            stopTick();
        } else if (!paused && pausedRef.current) {
            // 恢复：从当前进度继续
            pausedRef.current = false;
            const fromP = progressRef.current;
            if (fromP >= 1) return;

            startTimeRef.current = performance.now();

            const tick = (now: number) => {
                if (pausedRef.current) return;

                const elapsed = now - startTimeRef.current;
                const p = Math.min(fromP + elapsed / DURATION, 1);
                progressRef.current = p;
                applyTransform(p);

                if (p >= 1) {
                    stopTick();
                }
            };

            stopTick();
            unsubscribeRef.current = subscribeFxFrame(({ now }) => tick(now));
        }
    }, [paused, isShaking, applyTransform, stopTick]);

    return (
        <div
            ref={elRef}
            className={className}
            style={style}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

// Hook：管理震动状态
export const useShake = (duration = 500) => {
    const [isShaking, setIsShaking] = React.useState(false);
    const cancelResetRef = React.useRef<FxFrameSubscription | undefined>(undefined);

    React.useEffect(() => () => {
        cancelResetRef.current?.();
        cancelResetRef.current = undefined;
    }, []);

    const triggerShake = React.useCallback(() => {
        cancelResetRef.current?.();
        setIsShaking(true);
        cancelResetRef.current = scheduleFxFrameCallback(duration, () => {
            setIsShaking(false);
            cancelResetRef.current = undefined;
        });
    }, [duration]);

    return { isShaking, triggerShake };
};
