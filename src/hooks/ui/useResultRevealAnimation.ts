import React from 'react';

export type ResultRevealPresentationKey = string | number;

interface UseResultRevealAnimationOptions<TValue> {
    /** 最终展示结果；未提供 presentationKey 时，结果变化会触发新一轮揭示。 */
    value: TValue;
    /** 表现事件身份；变化时即使 value 相同也触发新一轮揭示。 */
    presentationKey?: ResultRevealPresentationKey;
    /** 揭示动画持续时间。 */
    durationMs: number;
    /** 首次挂载时是否播放揭示动画。 */
    animateOnMount?: boolean;
    /** false 时立即停止动画，并只同步基线值。 */
    isActive?: boolean;
    /** 自定义结果相等判断；默认使用 Object.is。 */
    isEqual?: (previous: TValue, next: TValue) => boolean;
}

interface ResultRevealAnimationState {
    isRevealing: boolean;
}

/**
 * 管理“结果揭示型”动画生命周期。
 *
 * value 决定最终展示什么；presentationKey 决定是否发生了新的可见事件。
 */
export function useResultRevealAnimation<TValue>({
    value,
    presentationKey,
    durationMs,
    animateOnMount = true,
    isActive = true,
    isEqual = Object.is,
}: UseResultRevealAnimationOptions<TValue>): ResultRevealAnimationState {
    const [isRevealing, setIsRevealing] = React.useState(animateOnMount && isActive);
    const mountedRef = React.useRef(false);
    const previousValueRef = React.useRef(value);
    const previousPresentationKeyRef = React.useRef(presentationKey);

    React.useEffect(() => {
        let shouldStartReveal = false;

        if (!isActive) {
            mountedRef.current = true;
            previousValueRef.current = value;
            previousPresentationKeyRef.current = presentationKey;
            setIsRevealing(false);
            return undefined;
        }

        if (!mountedRef.current) {
            mountedRef.current = true;
            shouldStartReveal = animateOnMount;
        } else if (presentationKey !== undefined) {
            shouldStartReveal = previousPresentationKeyRef.current !== presentationKey;
        } else {
            shouldStartReveal = !isEqual(previousValueRef.current, value);
        }

        previousValueRef.current = value;
        previousPresentationKeyRef.current = presentationKey;

        if (!shouldStartReveal) {
            setIsRevealing(false);
            return undefined;
        }

        setIsRevealing(true);
        const stopReveal = window.setTimeout(() => {
            setIsRevealing(false);
        }, durationMs);

        return () => window.clearTimeout(stopReveal);
    }, [animateOnMount, durationMs, isActive, isEqual, presentationKey, value]);

    return { isRevealing };
}
