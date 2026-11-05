import React from 'react';
import { extend } from '@pixi/react';
import { Graphics } from 'pixi.js';
import type { MapSceneSprite } from '../../engine/mapRenderer';

extend({ Graphics });

/** The revealed tile owns this short light-and-mist pass; it never owns input or rule progress. */
export interface DiscoveryMistHandle { renderFrame(progress: number): void }

export const BetrayalDiscoveryMist = React.forwardRef<DiscoveryMistHandle, {
    sprite: MapSceneSprite;
    mapWidth: number;
    mapHeight: number;
}>(({ sprite, mapWidth, mapHeight }, ref) => {
    const graphics = React.useRef<Graphics>(null);
    React.useImperativeHandle(ref, () => ({ renderFrame(t) {
        const g = graphics.current;
        if (!g) return;
        g.clear();
        if (t >= 1) return;
        const fade = Math.sin(Math.PI * t);
        const cx = sprite.x + sprite.width / 2;
        const cy = sprite.y + sprite.height / 2;
        g.rect(0, 0, mapWidth, mapHeight).fill({ color: 0x03110d, alpha: (1 - t) * 0.23 });
        // Nested translucent geometry gives soft light without a second canvas or blur filter.
        for (let layer = 7; layer >= 0; layer--) {
            const spread = 1 + layer * 0.18;
            g.ellipse(cx, cy, sprite.width * (0.43 + t * 0.2) * spread, sprite.height * 0.38 * spread)
                .fill({ color: 0xa2c795, alpha: fade * 0.018 });
        }
        for (let wisp = 0; wisp < 4; wisp++) {
            const direction = wisp % 2 ? 1 : -1;
            const x = cx + direction * sprite.width * (0.1 + t * 0.48);
            const y = cy + (wisp - 1.5) * sprite.height * 0.19;
            for (let layer = 3; layer >= 0; layer--) {
                g.ellipse(x, y, sprite.width * (0.34 + layer * 0.08), sprite.height * (0.045 + layer * 0.026))
                    .fill({ color: 0xc9d4b9, alpha: fade * 0.027 });
            }
        }
    } }), [sprite, mapWidth, mapHeight]);
    return <pixiGraphics ref={graphics} draw={React.useCallback(() => {}, [])} eventMode="none" />;
});
BetrayalDiscoveryMist.displayName = 'BetrayalDiscoveryMist';
