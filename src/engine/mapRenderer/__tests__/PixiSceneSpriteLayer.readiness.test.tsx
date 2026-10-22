import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapSceneSprite } from '../types';

const frame = vi.hoisted(() => {
    const listeners = new Set<{ postrender: () => void }>();
    const runner = { add: (listener: { postrender: () => void }) => listeners.add(listener), remove: (listener: { postrender: () => void }) => listeners.delete(listener) };
    return { listeners, app: { renderer: { runners: { postrender: runner } } } };
});
vi.mock('@pixi/react', () => ({ extend: vi.fn(), useApplication: () => ({ app: frame.app, isInitialised: true }) }));
vi.mock('pixi.js', () => ({
    Assets: { load: vi.fn(async () => ({ source: { width: 128, height: 128 }, width: 128, height: 128 })) },
    Container: class {}, Graphics: class {}, Sprite: class {}, Rectangle: class {},
    Texture: class { width = 128; height = 128; source: unknown; constructor(options: { source: unknown }) { this.source = options.source; } destroy() {} },
}));
vi.mock('../PixiSpriteMotion', () => ({ PixiSpriteMotion: () => null }));
import { Assets } from 'pixi.js';
import { PixiSceneSpriteLayer } from '../PixiSceneSpriteLayer';
const room = (url = '/room.webp'): MapSceneSprite => ({ id: 'room', textureUrls: [url], x: 0, y: 0, width: 128, height: 128 });
const draw = () => act(() => { for (const listener of [...frame.listeners]) listener.postrender(); });
afterEach(() => { cleanup(); frame.listeners.clear(); vi.clearAllMocks(); });

describe('sprite resource readiness at first scene render', () => {
    it('does not release map input before loaded sprites have participated in a render', async () => {
        const report = vi.fn();
        const view = render(<PixiSceneSpriteLayer sprites={[room()]} onResourceStateChange={report} />);
        await waitFor(() => expect(view.container.querySelector('[label="room"]')).not.toBeNull());
        expect(report.mock.calls.some(([state]) => state.status === 'ready')).toBe(false);
        draw(); draw();
        expect(report.mock.calls.filter(([state]) => state.status === 'ready')).toHaveLength(1);
        await act(async () => {});
        expect(frame.listeners.size).toBe(0);
    });
    it('cleans up the pending frame listener under StrictMode', async () => {
        const report = vi.fn();
        const view = render(<React.StrictMode><PixiSceneSpriteLayer sprites={[room()]} onResourceStateChange={report} /></React.StrictMode>);
        await waitFor(() => expect(frame.listeners.size).toBe(1));
        draw();
        expect(report.mock.calls.filter(([state]) => state.status === 'ready')).toHaveLength(1);
        view.unmount();
        await act(async () => {});
        expect(frame.listeners.size).toBe(0);
    });
    it('keeps an empty sprite layer nonblocking for background-only consumers', async () => {
        const report = vi.fn();
        render(<PixiSceneSpriteLayer sprites={[]} onResourceStateChange={report} />);
        await waitFor(() => expect(report).toHaveBeenLastCalledWith({ status: 'ready', resourceUrl: '' }));
        expect(frame.listeners.size).toBe(0);
    });
    it('ignores stale source completion and removes listeners when unmounted', async () => {
        const report = vi.fn();
        const view = render(<PixiSceneSpriteLayer sprites={[room()]} onResourceStateChange={report} />);
        await waitFor(() => expect(frame.listeners.size).toBe(1));
        const stale = [...frame.listeners][0];
        view.rerender(<PixiSceneSpriteLayer sprites={[room('/next.webp')]} onResourceStateChange={report} />);
        act(() => stale.postrender());
        expect(report.mock.calls.some(([state]) => state.status === 'ready')).toBe(false);
        await waitFor(() => expect(frame.listeners.size).toBe(1));
        const pending = [...frame.listeners][0];
        view.unmount();
        expect(frame.listeners.size).toBe(0);
        act(() => pending.postrender());
        expect(report.mock.calls.some(([state]) => state.status === 'ready')).toBe(false);
    });
    it('retains the same room surface while its replacement atlas loads, without retaining removed objects', async () => {
        const report = vi.fn();
        const view = render(<PixiSceneSpriteLayer sprites={[room()]} onResourceStateChange={report} />);
        await waitFor(() => expect(view.container.querySelector('[label="room"]')).not.toBeNull());
        draw();
        let complete!: (value: unknown) => void;
        vi.mocked(Assets.load).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        view.rerender(<PixiSceneSpriteLayer sprites={[room('/front.webp')]} onResourceStateChange={report} />);
        expect(view.container.querySelector('[label="room"]')).not.toBeNull();
        expect(report).toHaveBeenLastCalledWith({ status: 'loading', resourceUrl: '/front.webp' });
        view.rerender(<PixiSceneSpriteLayer sprites={[]} onResourceStateChange={report} />);
        expect(view.container.querySelector('[label="room"]')).toBeNull();
        await act(async () => { complete({ source: { width: 128, height: 128 }, width: 128, height: 128 }); });
        expect(view.container.querySelector('[label="room"]')).toBeNull();
    });
    it('does not borrow a removed room surface for a new object waiting on a different atlas', async () => {
        const view = render(<PixiSceneSpriteLayer sprites={[room()]} onResourceStateChange={() => {}} />);
        await waitFor(() => expect(view.container.querySelector('[label="room"]')).not.toBeNull());
        vi.mocked(Assets.load).mockImplementationOnce(() => new Promise(() => {}));
        view.rerender(<PixiSceneSpriteLayer sprites={[{ ...room('/other.webp'), id: 'different-room' }]} onResourceStateChange={() => {}} />);
        expect(view.container.querySelector('[label="room"]')).toBeNull();
        expect(view.container.querySelector('[label="different-room"]')).toBeNull();
    });
    it('reports load failure without waiting indefinitely for a scene frame', async () => {
        const error = new Error('texture unavailable');
        vi.mocked(Assets.load).mockRejectedValueOnce(error);
        const report = vi.fn();
        render(<PixiSceneSpriteLayer sprites={[room()]} onResourceStateChange={report} />);
        await waitFor(() => expect(report).toHaveBeenLastCalledWith({ status: 'error', resourceUrl: '/room.webp', error }));
        expect(frame.listeners.size).toBe(0);
    });
});
