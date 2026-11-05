import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PixiMapSceneHostProps } from '../../../engine/mapRenderer/PixiMapSceneHost';

const capture = vi.hoisted(() => ({ props: null as PixiMapSceneHostProps | null }));
vi.mock('../../../engine/mapRenderer', () => ({
    PixiMapSceneHost: (props: PixiMapSceneHostProps) => { capture.props = props; return null; },
}));
vi.mock('../discoveryMistSurface', () => ({ BetrayalDiscoveryMist: () => null }));
vi.mock('../roomLightingSurface', () => ({ BetrayalRoomLighting: () => null }));
vi.mock('../explorerLightSurface', () => ({ BetrayalExplorerLight: () => null }));
import { BetrayalPixiRoomViewport } from '../pixiRoomViewportSurface';

describe('Betrayal camera focus ownership', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
    it('keeps map actions hidden and inert until ready, and cancels movement on a resource error', () => {
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
        const onResourceError = vi.fn();
        const view = render(<BetrayalPixiRoomViewport sprites={[]} width={780} height={560} focusPoint={null} onResourceError={onResourceError} ariaLabel="地图">
            <button>移动到房间</button>
        </BetrayalPixiRoomViewport>);
        const overlay = view.getByTestId('betrayal-room-canvas');
        expect(overlay).toHaveAttribute('inert');
        expect(overlay).not.toBeVisible();
        act(() => capture.props!.onResourceStateChange!({ status: 'ready', resourceUrl: '' }));
        expect(overlay).not.toHaveAttribute('inert');
        expect(overlay).toBeVisible();
        act(() => capture.props!.onResourceStateChange!({ status: 'error', resourceUrl: '', error: new Error('renderer unavailable') }));
        expect(overlay).toHaveAttribute('inert');
        expect(overlay).not.toBeVisible();
        expect(onResourceError).toHaveBeenCalledOnce();
    });
    it('keeps the saved zoom and centers a newly selected floor layout', () => {
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
        let preservedZoom: number | undefined;
        const props = { sprites: [], width: 780, height: 560, focusPoint: null, focusKey: 1, onZoomChange: (zoom: number) => { preservedZoom = zoom; }, ariaLabel: '地图', children: null };
        const firstFloor = render(<BetrayalPixiRoomViewport {...props} />);
        expect(capture.props!.viewport.zoom).toBe(1);
        act(() => capture.props!.onViewportChange!({ zoom: 1.25, panX: 0, panY: 0 }));
        expect(preservedZoom).toBe(1.25);
        firstFloor.unmount();

        render(<BetrayalPixiRoomViewport {...props} width={900} height={600} initialZoom={preservedZoom} />);
        expect(capture.props!.viewport).toEqual({ zoom: 1.25, panX: -62.5, panY: -25 });
    });

    it('does not let automatic movement focus steal a manually controlled camera', () => {
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
        const ManualOwnershipHarness: React.FC<{ focusKey: number }> = ({ focusKey }) => {
            const [manualCameraOwned, setManualCameraOwned] = React.useState(false);
            return <BetrayalPixiRoomViewport
                sprites={[]}
                width={780}
                height={560}
                focusPoint={{ x: 3000, y: 2000 }}
                focusKey={focusKey}
                focusMode="automatic"
                manualCameraOwned={manualCameraOwned}
                onManualCameraInteraction={() => setManualCameraOwned(true)}
                ariaLabel="地图"
            />;
        };
        const { rerender } = render(<ManualOwnershipHarness focusKey={1} />);
        const manuallyPanned = { zoom: 1, panX: -900, panY: -600 };
        act(() => {
            capture.props!.onDisplayViewportChange!(manuallyPanned);
            capture.props!.onViewportChange!(manuallyPanned);
            capture.props!.onManualCameraInteraction!();
        });
        rerender(<ManualOwnershipHarness focusKey={2} />);
        expect(capture.props!.viewport).toEqual(manuallyPanned);
    });

    it('lets an explicit focus reclaim the camera and center its target', () => {
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
        render(<BetrayalPixiRoomViewport
            sprites={[]}
            width={780}
            height={560}
            focusPoint={{ x: 300, y: 200 }}
            focusKey={1}
            focusMode="explicit"
            manualCameraOwned
            ariaLabel="地图"
        />);
        expect(capture.props!.viewport.panX + 300 * capture.props!.viewport.zoom).toBe(500);
        expect(capture.props!.viewport.panY + 200 * capture.props!.viewport.zoom).toBe(350);
    });
});
