import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapSceneSprite } from '../../../engine/mapRenderer/types';
import { drawRoomLightingMask, roomLightingResolution } from '../roomLightingModel';

const state = vi.hoisted(() => ({
    tick: null as null | { isEnabled: boolean; callback: (ticker: { deltaMS: number }) => void },
    textures: [] as { uid: number; destroy: ReturnType<typeof vi.fn> }[],
}));
vi.mock('@pixi/react', () => ({ extend: vi.fn(), useTick: (value: typeof state.tick) => { state.tick = value; } }));
vi.mock('pixi.js', () => ({ Sprite: class {}, Texture: { from: () => {
    const texture = { uid: state.textures.length, destroy: vi.fn() };
    state.textures.push(texture); return texture;
} } }));
import { BetrayalRoomLighting } from '../roomLightingSurface';

const room: MapSceneSprite = { id: 'library', textureUrls: [], x: 80, y: 100, width: 150, height: 150, rotation: Math.PI / 2 };
const context = () => ({ setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), globalCompositeOperation: '', filter: '', fillStyle: '' });

describe('room silhouette lighting mask', () => {
    it('opens rotated room silhouettes and restores compositing without touching rule state', () => {
        const ctx = context();
        drawRoomLightingMask(ctx as unknown as CanvasRenderingContext2D, [room], 600, 500, 1);
        expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 64, 64);
        expect(ctx.translate).toHaveBeenCalledWith(155, 175);
        expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
        expect(ctx.fillRect).toHaveBeenLastCalledWith(-78, -78, 156, 156);
        expect(ctx.globalCompositeOperation).toBe('source-over');
        expect(ctx.filter).toBe('none');
    });
    it('caps raster dimensions while preserving world-coordinate scale', () => {
        expect(roomLightingResolution(600, 500)).toBe(1);
        expect((8000 + 128) * roomLightingResolution(8000, 5000)).toBe(2048);
    });
});

describe('persistent lighting resource lifecycle', () => {
    beforeEach(() => {
        state.textures = []; state.tick = null;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context() as unknown as CanvasRenderingContext2D);
    });
    afterEach(() => { cleanup(); vi.restoreAllMocks(); });
    const props = { rooms: [room], width: 600, height: 500, ready: true, reducedMotion: false };
    it('caches identical geometry, waits for resource readiness, then releases the old mask', () => {
        const view = render(<BetrayalRoomLighting {...props} />);
        expect(state.textures).toHaveLength(1);
        expect(state.textures[0].destroy).not.toHaveBeenCalled();
        view.rerender(<BetrayalRoomLighting {...props} rooms={[{ ...room }]} />);
        expect(state.textures).toHaveLength(1);
        view.rerender(<BetrayalRoomLighting {...props} ready={false} rooms={[room, { ...room, id: 'new-room', x: 250 }]} />);
        expect(state.textures).toHaveLength(2);
        expect(state.tick?.isEnabled).toBe(false);
        expect(state.textures[0].destroy).not.toHaveBeenCalled();
        view.rerender(<BetrayalRoomLighting {...props} rooms={[room, { ...room, id: 'new-room', x: 250 }]} />);
        expect(state.tick?.isEnabled).toBe(true);
        act(() => state.tick?.callback({ deltaMS: 700 }));
        expect(state.textures[0].destroy).toHaveBeenCalledExactlyOnceWith(true);
        expect(state.textures[1].destroy).not.toHaveBeenCalled();
        expect(state.tick?.isEnabled).toBe(false);
        view.unmount();
        expect(state.textures[1].destroy).toHaveBeenCalledExactlyOnceWith(true);
    });
    it('reduced motion applies the new mask immediately and does not leave an active ticker', () => {
        const view = render(<BetrayalRoomLighting {...props} reducedMotion />);
        view.rerender(<BetrayalRoomLighting {...props} reducedMotion rooms={[]} />);
        expect(state.tick?.isEnabled).toBe(false);
        expect(state.textures[0].destroy).toHaveBeenCalledOnce();
        expect(state.textures[1].destroy).not.toHaveBeenCalled();
    });
    it('survives strict-mode effect replay without retaining a destroyed texture', () => {
        const view = render(<React.StrictMode><BetrayalRoomLighting {...props} /></React.StrictMode>);
        expect(state.textures.at(-1)?.destroy).not.toHaveBeenCalled();
        view.unmount();
        expect(state.textures.every(texture => texture.destroy.mock.calls.length === 1)).toBe(true);
    });
});
