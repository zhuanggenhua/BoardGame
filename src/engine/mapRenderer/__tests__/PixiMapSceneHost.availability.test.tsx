import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapSceneResourceStatus } from '../types';

const support = vi.hoisted(() => ({ webgl: vi.fn(), webgpu: vi.fn() }));
const scene = vi.hoisted(() => ({ child: null as React.ReactElement<{ interactive: boolean; wheelZoomFactor?: number; onSpriteResourceStateChange: (state: MapSceneResourceStatus) => void }> | null }));
vi.mock('@pixi/react', () => ({
    extend: vi.fn(), useApplication: vi.fn(), useTick: vi.fn(),
    Application: ({ children }: { children: React.ReactNode }) => {
        scene.child = React.Children.toArray(children).find(child => React.isValidElement(child) && 'onSpriteResourceStateChange' in (child.props as object)) as NonNullable<typeof scene.child>;
        return <div data-testid="application-mounted" />;
    },
}));
vi.mock('pixi.js', () => ({
    Assets: { load: vi.fn() }, Container: class {}, Graphics: class {}, Rectangle: class {}, Sprite: class {},
    Texture: { EMPTY: {} }, isWebGLSupported: support.webgl, isWebGPUSupported: support.webgpu,
}));
vi.mock('../PixiSceneSpriteLayer', () => ({ PixiSceneSpriteLayer: () => null }));
import { PixiMapSceneHost } from '../PixiMapSceneHost';

const props = { mapWidth: 100, mapHeight: 100, viewport: { panX: 0, panY: 0, zoom: 1 } };

describe('map renderer availability', () => {
    beforeEach(() => { vi.clearAllMocks(); scene.child = null; support.webgl.mockReturnValue(false); support.webgpu.mockResolvedValue(false); });

    it('reports an error instead of mounting an unavailable renderer', async () => {
        const onResourceStateChange = vi.fn();
        render(<PixiMapSceneHost {...props} onResourceStateChange={onResourceStateChange} />);
        await waitFor(() => expect(onResourceStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' })));
        expect(screen.queryByTestId('application-mounted')).not.toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('WebGL');
    });

    it('allows WebGL without requiring WebGPU', async () => {
        support.webgl.mockReturnValue(true);
        render(<PixiMapSceneHost {...props} />);
        await screen.findByTestId('application-mounted');
        expect(support.webgpu).not.toHaveBeenCalled();
    });

    it('waits for WebGPU when WebGL is unavailable without claiming resources are ready', async () => {
        let resolveGpu!: (value: boolean) => void;
        support.webgpu.mockReturnValue(new Promise<boolean>(resolve => { resolveGpu = resolve; }));
        const onResourceStateChange = vi.fn();
        render(<PixiMapSceneHost {...props} onResourceStateChange={onResourceStateChange} />);
        expect(screen.queryByTestId('application-mounted')).not.toBeInTheDocument();
        await act(async () => { resolveGpu(true); });
        expect(screen.getByTestId('application-mounted')).toBeInTheDocument();
        expect(onResourceStateChange.mock.calls.some(([state]) => state.status === 'ready')).toBe(false);
    });

    it('reports a failed support probe through the existing error contract', async () => {
        support.webgpu.mockRejectedValue(new Error('adapter unavailable'));
        const onResourceStateChange = vi.fn();
        render(<PixiMapSceneHost {...props} onResourceStateChange={onResourceStateChange} />);
        await waitFor(() => expect(onResourceStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' })));
        expect(screen.queryByTestId('application-mounted')).not.toBeInTheDocument();
    });

    it('ignores a late support result after unmount', async () => {
        let resolveGpu!: (value: boolean) => void;
        support.webgpu.mockReturnValue(new Promise<boolean>(resolve => { resolveGpu = resolve; }));
        const onResourceStateChange = vi.fn();
        const view = render(<PixiMapSceneHost {...props} onResourceStateChange={onResourceStateChange} />);
        view.unmount();
        onResourceStateChange.mockClear();
        await act(async () => { resolveGpu(false); });
        expect(onResourceStateChange).not.toHaveBeenCalled();
    });

    it('enables scene input only after its actual resource owner reports ready', async () => {
        support.webgl.mockReturnValue(true);
        const onResourceStateChange = vi.fn();
        const view = render(<PixiMapSceneHost {...props} interactive onResourceStateChange={onResourceStateChange} />);
        await screen.findByTestId('application-mounted');
        const host = view.getByTestId('pixi-map-scene-canvas-host');
        expect(scene.child!.props.interactive).toBe(false);
        expect(host).toHaveStyle({ pointerEvents: 'none' });
        act(() => scene.child!.props.onSpriteResourceStateChange({ status: 'ready', resourceUrl: '/atlas.webp' }));
        expect(onResourceStateChange).toHaveBeenLastCalledWith({ status: 'ready', resourceUrl: '/atlas.webp' });
        expect(scene.child!.props.interactive).toBe(true);
        expect(host).toHaveStyle({ pointerEvents: 'auto' });
        act(() => scene.child!.props.onSpriteResourceStateChange({ status: 'loading', resourceUrl: '/next.webp' }));
        expect(scene.child!.props.interactive).toBe(false);
        expect(host).toHaveStyle({ pointerEvents: 'none' });
        act(() => scene.child!.props.onSpriteResourceStateChange({ status: 'error', resourceUrl: '/next.webp', error: new Error('texture failed') }));
        expect(scene.child!.props.interactive).toBe(false);
        expect(screen.getByRole('alert')).toHaveTextContent('地图资源加载失败');
    });
    it('forwards an explicit wheel factor while keeping the default unspecified', async () => {
        support.webgl.mockReturnValue(true);
        const view = render(<PixiMapSceneHost {...props} wheelZoomFactor={1.14} />);
        await screen.findByTestId('application-mounted');
        expect(scene.child!.props.wheelZoomFactor).toBe(1.14);
        view.rerender(<PixiMapSceneHost {...props} />);
        expect(scene.child!.props.wheelZoomFactor).toBeUndefined();
    });

});
