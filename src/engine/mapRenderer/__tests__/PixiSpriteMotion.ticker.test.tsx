import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapSceneSprite } from '../types';

const ticker = vi.hoisted(() => ({ callback: null as ((value: { deltaMS: number }) => void) | null }));

vi.mock('@pixi/react', () => ({
    extend: vi.fn(),
    useTick: ({ callback }: { callback: (value: { deltaMS: number }) => void }) => { ticker.callback = callback; },
}));
vi.mock('pixi.js', () => ({ Container: class {}, Graphics: class {} }));

import { PixiSpriteMotion } from '../PixiSpriteMotion';

describe('PixiSpriteMotion ticker lifecycle', () => {
    const originalPosition = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'position');
    const originalScale = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scale');
    const originalClear = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clear');

    afterEach(() => {
        ticker.callback = null;
        for (const [key, descriptor] of [['position', originalPosition], ['scale', originalScale], ['clear', originalClear]] as const) {
            if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
            else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
        }
        vi.restoreAllMocks();
    });

    it('draws separate dark and gold ground ellipses during landing without extending motion', () => {
        const graphic = {ellipse:vi.fn(),stroke:vi.fn()};
        graphic.ellipse.mockReturnValue(graphic); graphic.stroke.mockReturnValue(graphic);
        Object.defineProperty(HTMLElement.prototype, 'position', {configurable:true,get:()=>({set:vi.fn()})});
        Object.defineProperty(HTMLElement.prototype, 'scale', {configurable:true,get:()=>({set:vi.fn()})});
        Object.defineProperty(HTMLElement.prototype, 'clear', {configurable:true,value:()=>graphic});
        const onComplete = vi.fn();
        const sprite:MapSceneSprite={id:'pawn',textureUrls:['/pawn.png'],x:100,y:100,width:80,height:80,motion:{id:'hop',kind:'hop',from:{x:0,y:0},durationMs:300,landingDurationMs:200}};
        render(<PixiSpriteMotion sprite={sprite} onComplete={onComplete}>pawn</PixiSpriteMotion>);
        act(()=>ticker.callback!({deltaMS:300}));
        expect(graphic.ellipse).toHaveBeenCalledTimes(2);
        expect(graphic.stroke.mock.calls[0][0]).toMatchObject({color:0x0b100c,width:6});
        expect(graphic.stroke.mock.calls[1][0]).toMatchObject({color:0xe8ce92,width:3});
        expect(onComplete).not.toHaveBeenCalled();
        act(()=>ticker.callback!({deltaMS:200}));expect(onComplete).toHaveBeenCalledExactlyOnceWith('pawn','hop');
    });

    it('moves a room reveal from its declared source to its destination without reporting a footstep', () => {
        const setPosition = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'position', { configurable: true, get: () => ({ set: setPosition }) });
        Object.defineProperty(HTMLElement.prototype, 'scale', { configurable: true, get: () => ({ set: vi.fn() }) });
        Object.defineProperty(HTMLElement.prototype, 'clear', { configurable: true, value: vi.fn() });
        const onComplete = vi.fn();
        const onPhase = vi.fn();
        const onFrame = vi.fn();
        const sprite: MapSceneSprite = {
            id: 'room-library', textureUrls: ['/library.png'], x: 140, y: 112, width: 80, height: 64,
            motion: { id: 'reveal:13', from: { x: 140, y: 96 }, kind: 'reveal', durationMs: 360, startScale: 0.96 },
        };
        render(<PixiSpriteMotion sprite={sprite} onComplete={onComplete} onPhase={onPhase} onFrame={onFrame}>room</PixiSpriteMotion>);
        expect(setPosition).toHaveBeenLastCalledWith(140, 96);
        act(() => ticker.callback!({ deltaMS: 180 }));
        const [x, y] = setPosition.mock.calls.at(-1)!;
        expect(x).toBe(140);
        expect(y).toBeGreaterThan(96);
        expect(y).toBeLessThan(112);
        expect(onComplete).not.toHaveBeenCalled();
        expect(onFrame).toHaveBeenLastCalledWith('room-library', 'reveal:13', 0.5);
        act(() => ticker.callback!({ deltaMS: 180 }));
        expect(setPosition).toHaveBeenLastCalledWith(140, 112);
        expect(onFrame).toHaveBeenLastCalledWith('room-library', 'reveal:13', 1);
        expect(onComplete).toHaveBeenCalledExactlyOnceWith('room-library', 'reveal:13');
        expect(onPhase).toHaveBeenCalledExactlyOnceWith('room-library', 'reveal:13', 'settled');
    });

    it.each([false, true])('renders the final reveal immediately for reduced motion (mid-animation: %s)', midAnimation => {
        const setPosition = vi.fn();
        const setScale = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'position', { configurable: true, get: () => ({ set: setPosition }) });
        Object.defineProperty(HTMLElement.prototype, 'scale', { configurable: true, get: () => ({ set: setScale }) });
        Object.defineProperty(HTMLElement.prototype, 'clear', { configurable: true, value: vi.fn() });
        const onComplete = vi.fn();
        const sprite: MapSceneSprite = {
            id: 'room-library', textureUrls: ['/library.png'], x: 140, y: 112, width: 80, height: 64, alpha: 0.65,
            motion: { id: 'reveal:14', from: { x: 140, y: 96 }, kind: 'reveal', durationMs: midAnimation ? 360 : 0, startScale: 0.96 },
        };
        const view = render(<PixiSpriteMotion sprite={sprite} onComplete={onComplete}>room</PixiSpriteMotion>);
        if (midAnimation) {
            act(() => ticker.callback!({ deltaMS: 100 }));
            view.rerender(<PixiSpriteMotion sprite={{ ...sprite, motion: { ...sprite.motion!, durationMs: 0 } }} onComplete={onComplete}>room</PixiSpriteMotion>);
        }
        expect(setPosition).toHaveBeenLastCalledWith(140, 112);
        expect(setScale).toHaveBeenLastCalledWith(1);
        expect((view.container.querySelector('pixiContainer') as unknown as { alpha: number }).alpha).toBe(0.65);
        act(() => ticker.callback!({ deltaMS: 16 }));
        act(() => ticker.callback!({ deltaMS: 16 }));
        expect(onComplete).toHaveBeenCalledExactlyOnceWith('room-library', 'reveal:14');
    });

    it('completes an unclipped room reveal only once when the scene ticker advances past its duration', () => {
        Object.defineProperty(HTMLElement.prototype, 'position', { configurable: true, get: () => ({ set: vi.fn() }) });
        Object.defineProperty(HTMLElement.prototype, 'scale', { configurable: true, get: () => ({ set: vi.fn() }) });
        Object.defineProperty(HTMLElement.prototype, 'clear', { configurable: true, value: vi.fn() });
        const sprite: MapSceneSprite = {
            id: 'room-library', textureUrls: ['/library.png'], x: 100, y: 80, width: 80, height: 64, alpha: 0.65,
            motion: { id: 'reveal:12', from: { x: 140, y: 112 }, kind: 'reveal', durationMs: 360, startScale: 0.96 },
        };
        const onComplete = vi.fn();
        const onPhase = vi.fn();
        render(React.createElement(PixiSpriteMotion, {
            sprite,
            onComplete,
            onPhase,
            children: React.createElement('span', null, 'room tile'),
        }));

        expect(ticker.callback).toBeTypeOf('function');
        act(() => ticker.callback!({ deltaMS: 400 }));
        act(() => ticker.callback!({ deltaMS: 400 }));

        expect(onComplete).toHaveBeenCalledExactlyOnceWith('room-library', 'reveal:12');
        expect(onPhase).toHaveBeenCalledExactlyOnceWith('room-library', 'reveal:12', 'settled');
    });
});
