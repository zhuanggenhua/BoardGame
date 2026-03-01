/**
 * Cardia 能力执行动画组件
 * 
 * 包含：
 * - 能力激活视觉反馈
 * - 修正标记放置动画
 * - 持续标记放置动画
 * - 印戒移动动画
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlyingEffectsLayer, useFlyingEffects, getElementCenter } from '../../../components/common/animations/FlyingEffect';
import type { FlyingEffectData } from '../../../components/common/animations/FlyingEffect';

// ============================================================================
// 能力激活闪光效果
// ============================================================================

interface AbilityActivationFlashProps {
    active: boolean;
    onComplete: () => void;
}

export const AbilityActivationFlash: React.FC<AbilityActivationFlashProps> = ({ active, onComplete }) => {
    React.useEffect(() => {
        if (active) {
            const timer = setTimeout(onComplete, 600);
            return () => clearTimeout(timer);
        }
    }, [active, onComplete]);

    if (!active) return null;

    return (
        <motion.div
            className="fixed inset-0 pointer-events-none z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 0.6, times: [0, 0.2, 1] }}
        >
            <div className="absolute inset-0 bg-gradient-radial from-purple-500/30 via-transparent to-transparent" />
        </motion.div>
    );
};

// ============================================================================
// 修正标记飞行动画
// ============================================================================

interface ModifierTokenAnimationProps {
    sourceElement: HTMLElement | null;
    targetElement: HTMLElement | null;
    value: number;
    onComplete: () => void;
}

export const ModifierTokenAnimation: React.FC<ModifierTokenAnimationProps> = ({
    sourceElement,
    targetElement,
    value,
    onComplete,
}) => {
    const { effects, pushEffect, removeEffect } = useFlyingEffects();

    React.useEffect(() => {
        if (!sourceElement || !targetElement) {
            onComplete();
            return;
        }

        const startPos = getElementCenter(sourceElement);
        const endPos = getElementCenter(targetElement);

        const effect: Omit<FlyingEffectData, 'id'> = {
            type: value > 0 ? 'buff' : 'damage',
            content: value > 0 ? `+${value}` : `${value}`,
            color: value > 0 ? 'rgba(52, 211, 153, 0.8)' : 'rgba(239, 68, 68, 0.8)',
            startPos,
            endPos,
            intensity: Math.abs(value) / 3,
            onImpact: onComplete,
        };

        pushEffect(effect);
    }, [sourceElement, targetElement, value, pushEffect, onComplete]);

    return <FlyingEffectsLayer effects={effects} onEffectComplete={removeEffect} />;
};

// ============================================================================
// 持续标记放置动画
// ============================================================================

interface OngoingMarkerAnimationProps {
    targetElement: HTMLElement | null;
    onComplete: () => void;
}

export const OngoingMarkerAnimation: React.FC<OngoingMarkerAnimationProps> = ({
    targetElement,
    onComplete,
}) => {
    React.useEffect(() => {
        if (!targetElement) {
            onComplete();
            return;
        }

        const timer = setTimeout(onComplete, 800);
        return () => clearTimeout(timer);
    }, [targetElement, onComplete]);

    if (!targetElement) return null;

    const rect = targetElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    return (
        <motion.div
            className="fixed pointer-events-none z-[100]"
            style={{
                left: centerX,
                top: centerY,
                transform: 'translate(-50%, -50%)',
            }}
            initial={{ scale: 0, opacity: 0, rotate: 0 }}
            animate={{
                scale: [0, 1.5, 1],
                opacity: [0, 1, 0.8, 0],
                rotate: [0, 180, 360],
            }}
            transition={{
                duration: 0.8,
                times: [0, 0.3, 0.6, 1],
                ease: 'easeOut',
            }}
        >
            <div className="text-6xl">🔄</div>
        </motion.div>
    );
};

// ============================================================================
// 印戒移动动画
// ============================================================================

interface SignetMoveAnimationProps {
    fromElement: HTMLElement | null;
    toElement: HTMLElement | null;
    onComplete: () => void;
}

export const SignetMoveAnimation: React.FC<SignetMoveAnimationProps> = ({
    fromElement,
    toElement,
    onComplete,
}) => {
    const { effects, pushEffect, removeEffect } = useFlyingEffects();

    React.useEffect(() => {
        if (!fromElement || !toElement) {
            onComplete();
            return;
        }

        const startPos = getElementCenter(fromElement);
        const endPos = getElementCenter(toElement);

        const effect: Omit<FlyingEffectData, 'id'> = {
            type: 'custom',
            content: '🏆',
            color: 'rgba(251, 191, 36, 0.8)',
            startPos,
            endPos,
            intensity: 2,
            onImpact: onComplete,
        };

        pushEffect(effect);
    }, [fromElement, toElement, pushEffect, onComplete]);

    return <FlyingEffectsLayer effects={effects} onEffectComplete={removeEffect} />;
};

// ============================================================================
// 组合动画管理 Hook
// ============================================================================

export interface AbilityAnimationState {
    abilityFlash: boolean;
    modifierTokens: Array<{
        id: string;
        sourceElement: HTMLElement | null;
        targetElement: HTMLElement | null;
        value: number;
    }>;
    ongoingMarkers: Array<{
        id: string;
        targetElement: HTMLElement | null;
    }>;
    signetMoves: Array<{
        id: string;
        fromElement: HTMLElement | null;
        toElement: HTMLElement | null;
    }>;
}

export const useAbilityAnimations = () => {
    const [state, setState] = React.useState<AbilityAnimationState>({
        abilityFlash: false,
        modifierTokens: [],
        ongoingMarkers: [],
        signetMoves: [],
    });

    const triggerAbilityFlash = React.useCallback(() => {
        setState(prev => ({ ...prev, abilityFlash: true }));
    }, []);

    const clearAbilityFlash = React.useCallback(() => {
        setState(prev => ({ ...prev, abilityFlash: false }));
    }, []);

    const addModifierToken = React.useCallback((
        sourceElement: HTMLElement | null,
        targetElement: HTMLElement | null,
        value: number,
    ) => {
        const id = `modifier-${Date.now()}-${Math.random()}`;
        setState(prev => ({
            ...prev,
            modifierTokens: [...prev.modifierTokens, { id, sourceElement, targetElement, value }],
        }));
    }, []);

    const removeModifierToken = React.useCallback((id: string) => {
        setState(prev => ({
            ...prev,
            modifierTokens: prev.modifierTokens.filter(t => t.id !== id),
        }));
    }, []);

    const addOngoingMarker = React.useCallback((targetElement: HTMLElement | null) => {
        const id = `ongoing-${Date.now()}-${Math.random()}`;
        setState(prev => ({
            ...prev,
            ongoingMarkers: [...prev.ongoingMarkers, { id, targetElement }],
        }));
    }, []);

    const removeOngoingMarker = React.useCallback((id: string) => {
        setState(prev => ({
            ...prev,
            ongoingMarkers: prev.ongoingMarkers.filter(m => m.id !== id),
        }));
    }, []);

    const addSignetMove = React.useCallback((
        fromElement: HTMLElement | null,
        toElement: HTMLElement | null,
    ) => {
        const id = `signet-${Date.now()}-${Math.random()}`;
        setState(prev => ({
            ...prev,
            signetMoves: [...prev.signetMoves, { id, fromElement, toElement }],
        }));
    }, []);

    const removeSignetMove = React.useCallback((id: string) => {
        setState(prev => ({
            ...prev,
            signetMoves: prev.signetMoves.filter(s => s.id !== id),
        }));
    }, []);

    return {
        state,
        triggerAbilityFlash,
        clearAbilityFlash,
        addModifierToken,
        removeModifierToken,
        addOngoingMarker,
        removeOngoingMarker,
        addSignetMove,
        removeSignetMove,
    };
};

// ============================================================================
// 动画渲染层组件
// ============================================================================

interface AbilityAnimationsLayerProps {
    state: AbilityAnimationState;
    onAbilityFlashComplete: () => void;
    onModifierTokenComplete: (id: string) => void;
    onOngoingMarkerComplete: (id: string) => void;
    onSignetMoveComplete: (id: string) => void;
}

export const AbilityAnimationsLayer: React.FC<AbilityAnimationsLayerProps> = ({
    state,
    onAbilityFlashComplete,
    onModifierTokenComplete,
    onOngoingMarkerComplete,
    onSignetMoveComplete,
}) => {
    return (
        <>
            {/* 能力激活闪光 */}
            <AbilityActivationFlash
                active={state.abilityFlash}
                onComplete={onAbilityFlashComplete}
            />

            {/* 修正标记动画 */}
            <AnimatePresence>
                {state.modifierTokens.map(token => (
                    <ModifierTokenAnimation
                        key={token.id}
                        sourceElement={token.sourceElement}
                        targetElement={token.targetElement}
                        value={token.value}
                        onComplete={() => onModifierTokenComplete(token.id)}
                    />
                ))}
            </AnimatePresence>

            {/* 持续标记动画 */}
            <AnimatePresence>
                {state.ongoingMarkers.map(marker => (
                    <OngoingMarkerAnimation
                        key={marker.id}
                        targetElement={marker.targetElement}
                        onComplete={() => onOngoingMarkerComplete(marker.id)}
                    />
                ))}
            </AnimatePresence>

            {/* 印戒移动动画 */}
            <AnimatePresence>
                {state.signetMoves.map(move => (
                    <SignetMoveAnimation
                        key={move.id}
                        fromElement={move.fromElement}
                        toElement={move.toElement}
                        onComplete={() => onSignetMoveComplete(move.id)}
                    />
                ))}
            </AnimatePresence>
        </>
    );
};
