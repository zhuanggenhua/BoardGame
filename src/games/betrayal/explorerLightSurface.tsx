import React from 'react';
import { extend, useTick } from '@pixi/react';
import { Graphics } from 'pixi.js';
import type { MapSceneSprite } from '../../engine/mapRenderer/types';

extend({ Graphics });

export function resolveExplorerLightPosition(sprite: MapSceneSprite, progress = 1) {
    const t = Math.min(1, Math.max(0, progress));
    const motion = sprite.motion;
    const eased = motion?.kind === 'fade' ? (t < .5 ? 0 : 1) : t * t * (3 - 2 * t);
    return {
        x: (motion ? motion.from.x + (sprite.x - motion.from.x) * eased : sprite.x) + sprite.width / 2,
        y: (motion ? motion.from.y + (sprite.y - motion.from.y) * eased : sprite.y) + sprite.height / 2,
    };
}

export interface ExplorerLightHandle { presentMotion(spriteId: string, motionId: string, progress: number): void }

/** Follows the rendered move clock, not the authoritative destination or a second animation timer. */
export const BetrayalExplorerLight = React.forwardRef<ExplorerLightHandle, {
    sprite: MapSceneSprite;
    ready: boolean;
    reducedMotion: boolean;
}>(({ sprite, ready, reducedMotion }, ref) => {
    const graphics = React.useRef<Graphics>(null);
    const elapsed = React.useRef(0);
    const [pulsing, setPulsing] = React.useState(!reducedMotion);
    React.useLayoutEffect(() => {
        const point = resolveExplorerLightPosition(sprite, sprite.motion ? 0 : 1);
        graphics.current?.position.set(point.x, point.y);
    }, [sprite]);
    React.useLayoutEffect(() => {
        elapsed.current = 0;
        setPulsing(!reducedMotion);
        graphics.current?.scale.set(reducedMotion ? 1 : 140 / 190);
    }, [sprite.id, reducedMotion]);
    React.useImperativeHandle(ref, () => ({ presentMotion(spriteId, motionId, progress) {
        if (spriteId !== sprite.id || motionId !== sprite.motion?.id) return;
        const point = resolveExplorerLightPosition(sprite, progress);
        graphics.current?.position.set(point.x, point.y);
    } }), [sprite]);
    useTick({ isEnabled: ready && pulsing && !reducedMotion, callback: ticker => {
        elapsed.current += ticker.deltaMS;
        const t = Math.min(1, elapsed.current / 900);
        graphics.current?.scale.set((140 + 50 * (1 - (1 - t) ** 3)) / 190);
        if (t === 1) setPulsing(false);
    } });
    const draw = React.useCallback((g: Graphics) => {
        g.clear();
        for (let ring = 16; ring >= 1; ring--) {
            g.circle(0, 0, 190 * ring / 16).fill({ color: 0xc5b483, alpha: .006 });
        }
    }, []);
    return <pixiGraphics ref={graphics} draw={draw} eventMode="none" />;
});
BetrayalExplorerLight.displayName = 'BetrayalExplorerLight';
