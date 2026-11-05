import React from 'react';
import { extend, useTick } from '@pixi/react';
import { Sprite, Texture } from 'pixi.js';
import type { MapSceneSprite } from '../../engine/mapRenderer/types';
import { drawRoomLightingMask, roomLightingResolution, ROOM_LIGHTING_PADDING, ROOM_LIGHTING_TRANSITION_MS } from './roomLightingModel';

extend({ Sprite });

/** Cached 2D masks are composited by the existing Pixi camera. No second camera/input owner. */
export function BetrayalRoomLighting({ rooms, width, height, ready, reducedMotion }: {
    rooms: readonly MapSceneSprite[];
    width: number;
    height: number;
    ready: boolean;
    reducedMotion: boolean;
}) {
    const [layers, setLayers] = React.useState<{ current: Texture; previous: Texture | null } | null>(null);
    const allocated = React.useRef(new Set<Texture>());
    const currentSprite = React.useRef<Sprite>(null);
    const previousSprite = React.useRef<Sprite>(null);
    const elapsed = React.useRef(0);
    // Geometry, rather than array identity or camera pose, owns rasterization.
    const geometry = JSON.stringify(rooms.map(({ x, y, width, height, rotation }) => ({ x, y, width, height, rotation })));
    React.useLayoutEffect(() => {
        const canvas = document.createElement('canvas');
        const resolution = roomLightingResolution(width, height);
        canvas.width = Math.ceil((width + ROOM_LIGHTING_PADDING * 2) * resolution);
        canvas.height = Math.ceil((height + ROOM_LIGHTING_PADDING * 2) * resolution);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Room lighting requires a 2D canvas context');
        drawRoomLightingMask(context, JSON.parse(geometry), width, height, resolution);
        const texture = Texture.from(canvas);
        allocated.current.add(texture);
        elapsed.current = 0;
        setLayers(previous => ({ current: texture, previous: !reducedMotion && previous && allocated.current.has(previous.current) ? previous.current : null }));
    }, [geometry, width, height, reducedMotion]);
    React.useEffect(() => {
        if (!layers) return;
        for (const texture of allocated.current) {
            if (texture !== layers?.current && texture !== layers?.previous) {
                texture.destroy(true);
                allocated.current.delete(texture);
            }
        }
    }, [layers]);
    React.useEffect(() => () => {
        for (const texture of allocated.current) texture.destroy(true);
        allocated.current.clear();
    }, []);
    useTick({
        isEnabled: ready && !reducedMotion && Boolean(layers?.previous),
        callback: ticker => {
            if (!layers?.previous || !currentSprite.current || !previousSprite.current) return;
            elapsed.current += ticker.deltaMS;
            const t = Math.min(1, elapsed.current / ROOM_LIGHTING_TRANSITION_MS);
            const eased = t * t * (3 - 2 * t);
            currentSprite.current.alpha = eased;
            previousSprite.current.alpha = 1 - eased;
            if (t === 1) setLayers(current => current?.current === layers.current ? { ...current, previous: null } : current);
        },
    });
    const bounds = { x: -ROOM_LIGHTING_PADDING, y: -ROOM_LIGHTING_PADDING, width: width + ROOM_LIGHTING_PADDING * 2, height: height + ROOM_LIGHTING_PADDING * 2 };
    return <>
        {layers?.previous ? <pixiSprite key={`old:${layers.previous.uid}`} ref={previousSprite} texture={layers.previous} {...bounds} alpha={1} eventMode="none" /> : null}
        {layers ? <pixiSprite key={`new:${layers.current.uid}`} ref={currentSprite} texture={layers.current} {...bounds} alpha={layers.previous ? 0 : 1} eventMode="none" /> : null}
    </>;
}
