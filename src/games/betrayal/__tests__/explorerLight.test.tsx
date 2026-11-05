import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapSceneSprite } from '../../../engine/mapRenderer/types';
const clock = vi.hoisted(() => ({ value: null as null | { isEnabled: boolean; callback: (ticker: { deltaMS: number }) => void } }));
vi.mock('@pixi/react', () => ({ extend: vi.fn(), useTick: (value: typeof clock.value) => { clock.value = value; } }));
vi.mock('pixi.js', () => ({ Graphics: class {} }));
import { BetrayalExplorerLight, resolveExplorerLightPosition, type ExplorerLightHandle } from '../explorerLightSurface';

const sprite: MapSceneSprite = { id: 'player:0', textureUrls: [], x: 200, y: 100, width: 40, height: 50,
    motion: { id: 'step:1', kind: 'hop', from: { x: 0, y: 0 }, durationMs: 300, arcHeight: 16 } };
const originals = ['position', 'scale'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
afterEach(() => {
    cleanup(); clock.value = null;
    for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
    }
});
describe('explorer light follows presented movement', () => {
    it('follows the ground position through each hop instead of jumping ahead or lifting with the token', () => {
        expect(resolveExplorerLightPosition(sprite, 0)).toEqual({ x: 20, y: 25 });
        expect(resolveExplorerLightPosition(sprite, .5)).toEqual({ x: 120, y: 75 });
        expect(resolveExplorerLightPosition(sprite, 1)).toEqual({ x: 220, y: 125 });
    });
    it('teleport lighting switches at the same midpoint as the presented token', () => {
        const teleport = { ...sprite, motion: { ...sprite.motion!, kind: 'fade' as const } };
        expect(resolveExplorerLightPosition(teleport, .4)).toEqual({ x: 20, y: 25 });
        expect(resolveExplorerLightPosition(teleport, .6)).toEqual({ x: 220, y: 125 });
    });
    it('ignores stale motion frames, waits for ready, and stops its entrance pulse', () => {
        const position = vi.fn(), scale = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'position', { configurable: true, get: () => ({ set: position }) });
        Object.defineProperty(HTMLElement.prototype, 'scale', { configurable: true, get: () => ({ set: scale }) });
        const ref = React.createRef<ExplorerLightHandle>();
        const view = render(<BetrayalExplorerLight ref={ref} sprite={sprite} ready={false} reducedMotion={false} />);
        expect(clock.value?.isEnabled).toBe(false);
        act(() => ref.current?.presentMotion('player:1', 'step:1', .5));
        expect(position).toHaveBeenCalledTimes(1);
        act(() => ref.current?.presentMotion('player:0', 'step:1', .5));
        expect(position).toHaveBeenLastCalledWith(120, 75);
        view.rerender(<BetrayalExplorerLight ref={ref} sprite={sprite} ready reducedMotion={false} />);
        expect(clock.value?.isEnabled).toBe(true);
        act(() => clock.value?.callback({ deltaMS: 900 }));
        expect(scale).toHaveBeenLastCalledWith(1);
        expect(clock.value?.isEnabled).toBe(false);
        view.rerender(<BetrayalExplorerLight ref={ref} sprite={sprite} ready reducedMotion />);
        expect(clock.value?.isEnabled).toBe(false);
    });
});
