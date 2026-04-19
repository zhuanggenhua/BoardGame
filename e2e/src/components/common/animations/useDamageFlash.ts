/**
 * useDamageFlash — 受击闪光状态管理 Hook
 *
 * 管理 DamageFlash 组件的激活/重置生命周期。
 * 与 useShake / useHitStop 同级的原子 hook。
 *
 * @example
 * ```tsx
 * const { isActive, damage, trigger } = useDamageFlash();
 * // 触发
 * trigger(5);
 * // 渲染
 * <DamageFlash active={isActive} damage={damage} />
 * ```
 */

import { useState, useCallback, useRef } from 'react';

export interface DamageFlashState {
    /** 是否激活 */
    isActive: boolean;
    /** 当前伤害值 */
    damage: number;
    /** 触发闪光 */
    trigger: (damage: number) => void;
}

/**
 * 管理 DamageFlash 激活/自动重置的原子 hook
 * @param resetDelay DamageFlash 内部动画约 800ms，默认 900ms 后重置
 */
export function useDamageFlash(resetDelay = 900): DamageFlashState {
    const [state, setState] = useState({ isActive: false, damage: 0 });
    const timerRef = useRef<number>(0);

    const trigger = useCallback((damage: number) => {
        window.clearTimeout(timerRef.current);
        setState({ isActive: true, damage });
        timerRef.current = window.setTimeout(() => {
            setState({ isActive: false, damage: 0 });
        }, resetDelay);
    }, [resetDelay]);

    return { isActive: state.isActive, damage: state.damage, trigger };
}
