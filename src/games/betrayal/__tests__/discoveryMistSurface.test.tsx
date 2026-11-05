import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapSceneSprite } from '../../../engine/mapRenderer/types';

vi.mock('@pixi/react', () => ({ extend: vi.fn() }));
vi.mock('pixi.js', () => ({ Graphics: class {} }));
import { BetrayalDiscoveryMist, type DiscoveryMistHandle } from '../discoveryMistSurface';

const methods = ['clear', 'rect', 'ellipse', 'fill'] as const;
const originals = methods.map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
afterEach(() => {
    cleanup();
    for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
    }
});

describe('discovery mist follows the rendered room clock', () => {
    it('waits for room progress and clears on the actual final frame', () => {
        const calls = Object.fromEntries(methods.map(key => [key, vi.fn(function (this: HTMLElement) { return this; })]));
        for (const key of methods) Object.defineProperty(HTMLElement.prototype, key, { configurable: true, value: calls[key] });
        const sprite: MapSceneSprite = {
            id: 'new-room', textureUrls: ['/cold-atlas.webp'], x: 0, y: 0, width: 100, height: 100,
            motion: { id: 'discovery-1', kind: 'reveal', from: { x: 50, y: 50 }, durationMs: 360 },
        };
        const ref = React.createRef<DiscoveryMistHandle>();
        render(<BetrayalDiscoveryMist ref={ref} sprite={sprite} mapWidth={500} mapHeight={400} />);
        // No independent timer/ticker can consume the effect while its texture is still loading.
        expect(calls.ellipse).not.toHaveBeenCalled();
        act(() => ref.current!.renderFrame(0.5));
        expect(calls.ellipse).toHaveBeenCalled();
        const shapes = calls.ellipse.mock.calls.length;
        act(() => ref.current!.renderFrame(1));
        expect(calls.clear).toHaveBeenCalledTimes(2);
        expect(calls.ellipse).toHaveBeenCalledTimes(shapes);
    });
});
