import React from 'react';
import { extend, useTick } from '@pixi/react';
import { Container, Graphics } from 'pixi.js';
import type { MapSceneSprite, MapSceneSpriteMotionPhaseCallback, MapSceneSpriteMotionFrameCallback } from './types';
import { collectSpriteMotionPhases, resolveSpriteMotionFrame, resolveLandingRippleGeometry } from './spriteMotionModel';

extend({ Container, Graphics });

/** The scene ticker is the sole clock; completion comes from the rendered landing, never a UI timeout. */
export function PixiSpriteMotion({ sprite, onComplete, onPhase, onFrame, children }: {
    sprite: MapSceneSprite;
    onComplete?: (spriteId: string, motionId: string) => void;
    onPhase?: MapSceneSpriteMotionPhaseCallback;
    onFrame?: MapSceneSpriteMotionFrameCallback;
    children: React.ReactNode;
}) {
    const root = React.useRef<Container>(null);
    const ripple = React.useRef<Graphics>(null);
    const elapsed = React.useRef(0);
    const finished = React.useRef(false);
    const phaseState = React.useRef({ landingEmitted: false, settledEmitted: false });
    const currentMotionId = React.useRef<string | null>(null);
    const callback = React.useRef(onComplete);
    const phaseCallback = React.useRef(onPhase);
    React.useLayoutEffect(() => { callback.current = onComplete; }, [onComplete]);
    React.useLayoutEffect(() => { phaseCallback.current = onPhase; }, [onPhase]);
    const frameCallback = React.useRef(onFrame);
    React.useLayoutEffect(() => { frameCallback.current = onFrame; }, [onFrame]);
    const motion = sprite.motion;
    const instantReveal = motion?.kind === 'reveal' && motion.durationMs <= 0;
    React.useLayoutEffect(() => {
        currentMotionId.current = motion?.id ?? null;
        elapsed.current = 0;
        finished.current = false;
        phaseState.current = { landingEmitted: false, settledEmitted: false };
        if (root.current) {
            root.current.position.set(instantReveal ? sprite.x : motion?.from.x ?? sprite.x, instantReveal ? sprite.y : motion?.from.y ?? sprite.y);
            root.current.alpha = motion?.kind === 'reveal' && !instantReveal ? 0 : sprite.alpha ?? 1;
            root.current.scale.set(motion?.kind === 'reveal' && !instantReveal ? motion.startScale ?? 0.96 : 1);
        }
        ripple.current?.clear();
        return () => {
            if (currentMotionId.current === motion?.id) currentMotionId.current = null;
        };
    }, [motion?.id, motion?.kind, motion?.startScale, motion?.from.x, motion?.from.y, sprite.x, sprite.y, sprite.alpha, instantReveal]);
    React.useLayoutEffect(() => {
        if (motion?.landingDurationMs === 0) ripple.current?.clear();
    }, [motion?.id, motion?.landingDurationMs]);
    useTick({
        isEnabled: Boolean(motion),
        callback: ticker => {
            if (!root.current || !motion || currentMotionId.current !== motion.id || finished.current) return;
            elapsed.current += ticker.deltaMS;
            const frame = resolveSpriteMotionFrame(elapsed.current, motion);
            const t = frame.progress;
            if (motion.kind === 'reveal') {
                const eased = 1 - (1 - t) ** 3;
                root.current.position.set(
                    motion.from.x + (sprite.x - motion.from.x) * eased,
                    motion.from.y + (sprite.y - motion.from.y) * eased,
                );
                root.current.alpha = (sprite.alpha ?? 1) * t;
                root.current.scale.set((motion.startScale ?? 0.96) + (1 - (motion.startScale ?? 0.96)) * eased);
            } else if (motion.kind === 'fade') {
                const position = t < 0.5 ? motion.from : sprite;
                root.current.position.set(position.x, position.y);
                root.current.alpha = Math.abs(2 * t - 1) * (sprite.alpha ?? 1);
            } else {
                const eased = t * t * (3 - 2 * t);
                root.current.position.set(
                    motion.from.x + (sprite.x - motion.from.x) * eased,
                    motion.from.y + (sprite.y - motion.from.y) * eased - Math.sin(Math.PI * t) * (motion.arcHeight ?? 16),
                );
            }
            if (frame.shouldRenderRipple && ripple.current && motion.kind === 'hop') {
                const ring = resolveLandingRippleGeometry(sprite.width, sprite.height, frame.landingProgress);
                ripple.current.clear().ellipse(ring.x, ring.y, ring.radiusX, ring.radiusY)
                    .stroke({ color: 0x0b100c, width: 6, alpha: ring.alpha * .8 })
                    .ellipse(ring.x, ring.y, ring.radiusX, ring.radiusY)
                    .stroke({ color: 0xe8ce92, width: 3, alpha: ring.alpha });
            }
            frameCallback.current?.(sprite.id, motion.id, t);
            const phases = collectSpriteMotionPhases(frame, motion.kind, phaseState.current);
            if (frame.complete) {
                finished.current = true;
                ripple.current?.clear();
            }
            for (const phase of phases) phaseCallback.current?.(sprite.id, motion.id, phase);
            if (frame.complete) callback.current?.(sprite.id, motion.id);
        },
    });
    return <pixiContainer ref={root} x={sprite.x} y={sprite.y} alpha={sprite.alpha ?? 1} eventMode="none">
        <pixiGraphics ref={ripple} draw={React.useCallback(() => {}, [])} eventMode="none" />
        {children}
    </pixiContainer>;
}
