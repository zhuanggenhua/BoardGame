/**
 * useImpactFeedback — 受击反馈组合 Hook
 *
 * 将震动（useShake）+ 钝帧（useHitStop）+ 裂隙闪光（useDamageFlash）
 * 三件套编排为一次调用，对外只暴露 trigger(damage) 和渲染所需的 props。
 *
 * 游戏层不需要知道内部有几个效果，只管调 trigger 和把 props 传给容器组件。
 *
 * @example
 * ```tsx
 * const impact = useImpactFeedback();
 * // 触发全套受击反馈
 * impact.trigger(5);
 * // 渲染
 * <ShakeContainer isShaking={impact.shake.isShaking}>
 *   <HitStopContainer isActive={impact.hitStop.isActive} {...impact.hitStop.config}>
 *     <Target />
 *     <DamageFlash active={impact.flash.isActive} damage={impact.flash.damage} />
 *   </HitStopContainer>
 * </ShakeContainer>
 * ```
 */

import { useCallback } from 'react';
import { useShake } from './ShakeContainer';
import { useHitStop, getHitStopPresetByDamage, type HitStopConfig } from './HitStopContainer';
import { useDamageFlash } from './useDamageFlash';

export interface ImpactFeedbackEffects {
    /** 启用震动，默认 true */
    shake?: boolean;
    /** 启用钝帧，默认 true */
    hitStop?: boolean;
    /** 启用裂隙闪光，默认 true */
    flash?: boolean;
}

const DEFAULT_EFFECTS: ImpactFeedbackEffects = {
    shake: true,
    hitStop: true,
    flash: true,
};

export interface ImpactFeedbackResult {
    /** 触发全套受击反馈 */
    trigger: (damage: number) => void;
    /** 震动状态（传给 ShakeContainer） */
    shake: { isShaking: boolean };
    /** 钝帧状态（传给 HitStopContainer） */
    hitStop: { isActive: boolean; config: HitStopConfig | undefined };
    /** 闪光状态（传给 DamageFlash） */
    flash: { isActive: boolean; damage: number };
}

/**
 * 受击反馈组合 hook
 * @param effects 启用的效果类型（默认全开）
 */
export function useImpactFeedback(
    effects: ImpactFeedbackEffects = DEFAULT_EFFECTS,
): ImpactFeedbackResult {
    const { isShaking, triggerShake } = useShake(500);
    const { isActive: hitStopActive, config: hitStopConfig, triggerHitStop } = useHitStop(80);
    const { isActive: flashActive, damage: flashDamage, trigger: triggerFlash } = useDamageFlash();

    const trigger = useCallback((damage: number) => {
        if (effects.shake) triggerShake();
        if (effects.hitStop) triggerHitStop(getHitStopPresetByDamage(damage));
        if (effects.flash) triggerFlash(damage);
    }, [effects.shake, effects.hitStop, effects.flash, triggerShake, triggerHitStop, triggerFlash]);

    return {
        trigger,
        shake: { isShaking },
        hitStop: { isActive: hitStopActive, config: hitStopConfig },
        flash: { isActive: flashActive, damage: flashDamage },
    };
}
