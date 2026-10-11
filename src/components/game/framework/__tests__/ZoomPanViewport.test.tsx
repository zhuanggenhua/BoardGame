/* @vitest-environment happy-dom */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ZoomPanViewport } from '../ZoomPanViewport';

const mockElementBox = (element: HTMLElement, box: { width: number; height: number; left?: number; top?: number }) => {
    Object.defineProperty(element, 'offsetWidth', {
        configurable: true,
        value: box.width,
    });
    Object.defineProperty(element, 'offsetHeight', {
        configurable: true,
        value: box.height,
    });
    element.getBoundingClientRect = vi.fn(() => ({
        width: box.width,
        height: box.height,
        left: box.left ?? 0,
        top: box.top ?? 0,
        right: (box.left ?? 0) + box.width,
        bottom: (box.top ?? 0) + box.height,
        x: box.left ?? 0,
        y: box.top ?? 0,
        toJSON: () => ({}),
    } as DOMRect));
};

const refreshMeasuredSizes = async () => {
    await act(async () => {
        window.dispatchEvent(new Event('resize'));
        await new Promise((resolve) => requestAnimationFrame(resolve));
    });
};

const createAnimationFrameHarness = () => {
    let nextId = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback) => {
            const id = nextId++;
            callbacks.set(id, callback);
            return id;
        });
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame')
        .mockImplementation((id) => {
            callbacks.delete(id);
        });

    return {
        pendingCount: () => callbacks.size,
        flush: async (timestamp: number) => {
            await act(async () => {
                const pendingCallbacks = Array.from(callbacks.entries());
                callbacks.clear();
                pendingCallbacks.forEach(([, callback]) => callback(timestamp));
            });
        },
        restore: () => {
            requestAnimationFrameSpy.mockRestore();
            cancelAnimationFrameSpy.mockRestore();
        },
    };
};

describe('ZoomPanViewport', () => {
    it('notifies the host when the user changes the viewport by wheel zooming', async () => {
        const onUserViewportChange = vi.fn();

        render(
            <ZoomPanViewport
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                containerTestId="viewport"
                contentTestId="content"
                onUserViewportChange={onUserViewportChange}
            >
                <div>map</div>
            </ZoomPanViewport>,
        );

        await act(async () => {
            fireEvent.wheel(screen.getByTestId('viewport'), {
                deltaY: -100,
                clientX: 120,
                clientY: 90,
            });
        });

        expect(onUserViewportChange).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(screen.getByTestId('content').style.transform).toContain('scale(1.1');
        });
    });

    it('keeps DOM camera updates imperative for enabled uncontrolled viewports', async () => {
        render(
            <ZoomPanViewport
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                panBoundsMode="free"
                imperativeRender
                containerTestId="viewport"
                contentTestId="content"
            >
                <div>map</div>
            </ZoomPanViewport>,
        );

        const viewport = screen.getByTestId('viewport');
        const content = screen.getByTestId('content');

        await act(async () => {
            fireEvent.wheel(viewport, {
                deltaY: -100,
                clientX: 120,
                clientY: 90,
            });
        });

        await waitFor(() => {
            expect(content.style.transform).toContain('scale(1.1');
        });

        await act(async () => {
            fireEvent.mouseDown(viewport, { button: 0, clientX: 0, clientY: 0 });
            fireEvent.mouseMove(window, { clientX: 140, clientY: 70 });
        });

        expect(content.style.transform).toContain('translate(140px, 70px)');

        await act(async () => {
            fireEvent.mouseUp(window);
        });
    });

    it('coalesces controlled viewport updates to one animation-frame commit', async () => {
        const animationFrame = createAnimationFrameHarness();
        const onControlledViewportChange = vi.fn();

        try {
            render(
                <ZoomPanViewport
                    initialScale={1}
                    minScale={0.5}
                    maxScale={3}
                    panBoundsMode="free"
                    controlledViewport={{ zoomLevel: 1, position: { x: 0, y: 0 } }}
                    onControlledViewportChange={onControlledViewportChange}
                    controlledViewportSchedule="animation-frame"
                    inertiaEnabled={false}
                    containerTestId="viewport"
                    contentTestId="content"
                >
                    <div>map</div>
                </ZoomPanViewport>,
            );

            await animationFrame.flush(0);

            const viewport = screen.getByTestId('viewport');
            await act(async () => {
                fireEvent.mouseDown(viewport, { button: 0, clientX: 0, clientY: 0 });
                fireEvent.mouseMove(window, { clientX: 120, clientY: 40 });
                fireEvent.mouseMove(window, { clientX: 240, clientY: -160 });
                fireEvent.mouseUp(window);
            });

            expect(onControlledViewportChange).not.toHaveBeenCalled();

            await animationFrame.flush(16);

            expect(onControlledViewportChange).toHaveBeenCalledTimes(1);
            expect(onControlledViewportChange).toHaveBeenLastCalledWith({
                zoomLevel: 1,
                position: { x: 240, y: -160 },
            });
        } finally {
            animationFrame.restore();
        }
    });

    it('keeps panning free when pan bounds mode is free', async () => {
        render(
            <ZoomPanViewport
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                panBoundsMode="free"
                containerTestId="viewport"
                contentTestId="content"
            >
                <div>map</div>
            </ZoomPanViewport>,
        );

        const viewport = screen.getByTestId('viewport');
        const content = screen.getByTestId('content');

        await act(async () => {
            fireEvent.mouseDown(viewport, {
                button: 0,
                clientX: 0,
                clientY: 0,
            });
            fireEvent.mouseMove(window, {
                clientX: 420,
                clientY: 260,
            });
            fireEvent.mouseUp(window);
        });

        await waitFor(() => {
            expect(content.style.transform).toContain('translate(420px, 260px)');
        });
    });

    it('can use a cover base scale for map-camera viewports', async () => {
        render(
            <ZoomPanViewport
                initialScale={1}
                minScale={1}
                maxScale={3}
                baseScaleMode="cover"
                containerTestId="viewport"
                contentTestId="content"
            >
                <div>wide map</div>
            </ZoomPanViewport>,
        );

        const viewport = screen.getByTestId('viewport');
        const content = screen.getByTestId('content');
        mockElementBox(viewport, { width: 400, height: 300 });
        mockElementBox(content, { width: 200, height: 100 });
        await refreshMeasuredSizes();

        await waitFor(() => {
            expect(content.style.transform).toContain('scale(3');
        });
    });

    it('continues a fast drag with short inertial panning after release', async () => {
        const animationFrame = createAnimationFrameHarness();
        const dateNowSpy = vi.spyOn(Date, 'now');
        let now = 0;
        dateNowSpy.mockImplementation(() => now);

        try {
            render(
                <ZoomPanViewport
                    initialScale={1}
                    minScale={0.5}
                    maxScale={3}
                    panBoundsMode="free"
                    containerTestId="viewport"
                    contentTestId="content"
                >
                    <div>map</div>
                </ZoomPanViewport>,
            );

            await animationFrame.flush(0);

            const viewport = screen.getByTestId('viewport');
            const content = screen.getByTestId('content');
            await act(async () => {
                fireEvent.mouseDown(viewport, { button: 0, clientX: 0, clientY: 0 });
                now = 16;
                fireEvent.mouseMove(window, { clientX: 100, clientY: 0 });
                now = 32;
                fireEvent.mouseMove(window, { clientX: 200, clientY: 0 });
                fireEvent.mouseUp(window);
            });

            expect(content.style.transform).toContain('translate(200px, 0px)');
            expect(animationFrame.pendingCount()).toBeGreaterThan(0);

            await animationFrame.flush(48);
            const transformedX = Number(content.style.transform.match(/translate\(([-\d.]+)px/)?.[1]);
            expect(transformedX).toBeGreaterThan(200);
        } finally {
            dateNowSpy.mockRestore();
            animationFrame.restore();
        }
    });

    it('cancels an in-flight inertial pan when a new drag begins', async () => {
        const animationFrame = createAnimationFrameHarness();
        const dateNowSpy = vi.spyOn(Date, 'now');
        let now = 0;
        dateNowSpy.mockImplementation(() => now);

        try {
            render(
                <ZoomPanViewport
                    initialScale={1}
                    minScale={0.5}
                    maxScale={3}
                    panBoundsMode="free"
                    containerTestId="viewport"
                    contentTestId="content"
                >
                    <div>map</div>
                </ZoomPanViewport>,
            );

            await animationFrame.flush(0);

            const viewport = screen.getByTestId('viewport');
            const content = screen.getByTestId('content');
            await act(async () => {
                fireEvent.mouseDown(viewport, { button: 0, clientX: 0, clientY: 0 });
                now = 16;
                fireEvent.mouseMove(window, { clientX: 100, clientY: 0 });
                now = 32;
                fireEvent.mouseMove(window, { clientX: 200, clientY: 0 });
                fireEvent.mouseUp(window);
            });

            expect(animationFrame.pendingCount()).toBeGreaterThan(0);
            await animationFrame.flush(48);
            const positionBeforeNewDrag = Number(content.style.transform.match(/translate\(([-\d.]+)px/)?.[1]);

            await act(async () => {
                fireEvent.mouseDown(viewport, {
                    button: 0,
                    clientX: positionBeforeNewDrag,
                    clientY: 0,
                });
            });

            await animationFrame.flush(64);
            const positionAfterCancel = Number(content.style.transform.match(/translate\(([-\d.]+)px/)?.[1]);
            expect(positionAfterCancel).toBe(positionBeforeNewDrag);
        } finally {
            dateNowSpy.mockRestore();
            animationFrame.restore();
        }
    });

    it('resets to the initial camera when receiving zoompan:reset-center', async () => {
        const animationFrame = createAnimationFrameHarness();
        const dateNowSpy = vi.spyOn(Date, 'now');
        let now = 0;
        dateNowSpy.mockImplementation(() => now);

        try {
            render(
                <ZoomPanViewport
                    initialScale={0.6}
                    minScale={0.5}
                    maxScale={3}
                    panBoundsMode="free"
                    containerTestId="viewport"
                    contentTestId="content"
                >
                    <div>map</div>
                </ZoomPanViewport>,
            );

            await animationFrame.flush(0);

            const viewport = screen.getByTestId('viewport');
            const content = screen.getByTestId('content');
            await act(async () => {
                fireEvent.mouseDown(viewport, { button: 0, clientX: 0, clientY: 0 });
                now = 16;
                fireEvent.mouseMove(window, { clientX: 180, clientY: -120 });
                now = 32;
                fireEvent.mouseMove(window, { clientX: 240, clientY: -160 });
                fireEvent.mouseUp(window);
            });

            expect(content.style.transform).toContain('translate(240px, -160px)');

            await act(async () => {
                viewport.dispatchEvent(new Event('zoompan:reset-center'));
            });

            expect(content.style.transform).toContain('translate(0px, 0px)');
            expect(content.style.transform).toContain('scale(0.6)');
        } finally {
            dateNowSpy.mockRestore();
            animationFrame.restore();
        }
    });

    it('keeps the current pan and zoom when interaction is disabled', async () => {
        const animationFrame = createAnimationFrameHarness();
        const dateNowSpy = vi.spyOn(Date, 'now');
        let now = 0;
        dateNowSpy.mockImplementation(() => now);

        try {
            const view = render(
                <ZoomPanViewport
                    initialScale={1}
                    minScale={0.5}
                    maxScale={3}
                    panBoundsMode="free"
                    inertiaEnabled={false}
                    containerTestId="viewport"
                    contentTestId="content"
                >
                    <div>map</div>
                </ZoomPanViewport>,
            );

            await animationFrame.flush(0);

            const viewport = screen.getByTestId('viewport');
            const content = screen.getByTestId('content');
            await act(async () => {
                fireEvent.mouseDown(viewport, { button: 0, clientX: 0, clientY: 0 });
                now = 16;
                fireEvent.mouseMove(window, { clientX: 180, clientY: -120 });
                now = 32;
                fireEvent.mouseMove(window, { clientX: 240, clientY: -160 });
                fireEvent.mouseUp(window);
            });

            expect(content.style.transform).toContain('translate(240px, -160px)');
            expect(content.style.transform).toContain('scale(1)');

            view.rerender(
                <ZoomPanViewport
                    initialScale={1}
                    minScale={0.5}
                    maxScale={3}
                    panBoundsMode="free"
                    inertiaEnabled={false}
                    interactionDisabled
                    containerTestId="viewport"
                    contentTestId="content"
                >
                    <div>map</div>
                </ZoomPanViewport>,
            );

            await animationFrame.flush(48);

            expect(content.style.transform).toContain('translate(240px, -160px)');
            expect(content.style.transform).toContain('scale(1)');

            await act(async () => {
                viewport.dispatchEvent(new Event('zoompan:reset-center'));
            });

            expect(content.style.transform).toContain('translate(0px, 0px)');
            expect(content.style.transform).toContain('scale(1)');
        } finally {
            dateNowSpy.mockRestore();
            animationFrame.restore();
        }
    });

    it('imperatively paints the reset-center transform without waiting for React style', async () => {
        const animationFrame = createAnimationFrameHarness();
        const dateNowSpy = vi.spyOn(Date, 'now');
        let now = 0;
        dateNowSpy.mockImplementation(() => now);

        try {
            render(
                <ZoomPanViewport
                    initialScale={0.6}
                    minScale={0.5}
                    maxScale={3}
                    panBoundsMode="free"
                    imperativeRender
                    containerTestId="viewport"
                    contentTestId="content"
                >
                    <div>map</div>
                </ZoomPanViewport>,
            );

            await animationFrame.flush(0);

            const viewport = screen.getByTestId('viewport');
            const content = screen.getByTestId('content');
            await act(async () => {
                fireEvent.mouseDown(viewport, { button: 0, clientX: 0, clientY: 0 });
                now = 16;
                fireEvent.mouseMove(window, { clientX: 180, clientY: -120 });
                now = 32;
                fireEvent.mouseMove(window, { clientX: 240, clientY: -160 });
                fireEvent.mouseUp(window);
            });

            expect(content.style.transform).toContain('translate(240px, -160px)');

            await act(async () => {
                viewport.dispatchEvent(new Event('zoompan:reset-center'));
            });

            expect(content.style.transform).toContain('translate(0px, 0px)');
            expect(content.style.transform).toContain('scale(0.6)');
        } finally {
            dateNowSpy.mockRestore();
            animationFrame.restore();
        }
    });

    it('disables inertial panning when reduced motion is preferred', async () => {
        const animationFrame = createAnimationFrameHarness();
        const dateNowSpy = vi.spyOn(Date, 'now');
        const originalMatchMedia = window.matchMedia;
        let now = 0;
        dateNowSpy.mockImplementation(() => now);
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn((query: string) => ({
                matches: query === '(prefers-reduced-motion: reduce)',
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });

        try {
            render(
                <ZoomPanViewport
                    initialScale={1}
                    minScale={0.5}
                    maxScale={3}
                    panBoundsMode="free"
                    containerTestId="viewport"
                    contentTestId="content"
                >
                    <div>map</div>
                </ZoomPanViewport>,
            );

            await animationFrame.flush(0);

            const viewport = screen.getByTestId('viewport');
            const content = screen.getByTestId('content');
            expect(content.style.transition).toBe('none');
            await act(async () => {
                fireEvent.mouseDown(viewport, { button: 0, clientX: 0, clientY: 0 });
                now = 16;
                fireEvent.mouseMove(window, { clientX: 100, clientY: 0 });
                now = 32;
                fireEvent.mouseMove(window, { clientX: 200, clientY: 0 });
                fireEvent.mouseUp(window);
            });

            await animationFrame.flush(48);
            const transformedX = Number(content.style.transform.match(/translate\(([-\d.]+)px/)?.[1]);
            expect(transformedX).toBe(200);
        } finally {
            Object.defineProperty(window, 'matchMedia', {
                configurable: true,
                value: originalMatchMedia,
            });
            dateNowSpy.mockRestore();
            animationFrame.restore();
        }
    });

    it('can fit the default camera inside provided content insets', async () => {
        render(
            <ZoomPanViewport
                initialScale={1}
                minScale={1}
                maxScale={3}
                baseScaleMode="contain"
                fitInsets={{ bottom: 100 }}
                containerTestId="viewport"
                contentTestId="content"
            >
                <div>map</div>
            </ZoomPanViewport>,
        );

        const viewport = screen.getByTestId('viewport');
        const content = screen.getByTestId('content');
        mockElementBox(viewport, { width: 400, height: 300 });
        mockElementBox(content, { width: 400, height: 300 });
        await refreshMeasuredSizes();

        await waitFor(() => {
            expect(content.style.transform).toContain('translate(0px, -50px)');
            expect(content.style.transform).toContain('scale(0.666');
        });
    });

    it('only handles the same pan target instruction once', async () => {
        const { rerender } = render(
            <ZoomPanViewport
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                panToTarget={null}
                containerTestId="viewport"
                contentTestId="content"
            >
                <div data-zoom-pan-target="room-a">room a</div>
            </ZoomPanViewport>,
        );

        const viewport = screen.getByTestId('viewport');
        const content = screen.getByTestId('content');
        const target = screen.getByText('room a');
        mockElementBox(viewport, { width: 200, height: 200 });
        mockElementBox(content, { width: 400, height: 400 });
        mockElementBox(target, { width: 40, height: 40, left: 300, top: 300 });
        await refreshMeasuredSizes();

        rerender(
            <ZoomPanViewport
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                panToTarget="room-a"
                panToScale={1.5}
                containerTestId="viewport"
                contentTestId="content"
            >
                <div data-zoom-pan-target="room-a">room a</div>
            </ZoomPanViewport>,
        );

        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });

        await waitFor(() => {
            expect(content.style.transform).toContain('scale(0.75');
        });

        await act(async () => {
            fireEvent.wheel(viewport, {
                deltaY: 100,
                clientX: 120,
                clientY: 90,
            });
        });

        rerender(
            <ZoomPanViewport
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                panToTarget="room-a"
                panToScale={1.5}
                containerTestId="viewport"
                contentTestId="content"
            >
                <div data-zoom-pan-target="room-a">room a</div>
            </ZoomPanViewport>,
        );

        expect(content.style.transform).toContain('scale(0.7');
    });

    it('centers a focused target from its current rendered screen position', async () => {
        render(
            <ZoomPanViewport
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                panBoundsMode="free"
                panToTarget="room-a"
                containerTestId="viewport"
                contentTestId="content"
            >
                <div data-zoom-pan-target="room-a">room a</div>
            </ZoomPanViewport>,
        );

        const viewport = screen.getByTestId('viewport');
        const content = screen.getByTestId('content');
        const target = screen.getByText('room a');
        mockElementBox(viewport, { width: 400, height: 300 });
        mockElementBox(content, { width: 800, height: 600, left: 100, top: 20 });
        mockElementBox(target, { width: 40, height: 40, left: 180, top: 50 });
        await refreshMeasuredSizes();

        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });

        await waitFor(() => {
            expect(content.style.transform).toContain('translate(0px, 160px)');
        });
    });

    it('centers a focused target inside the usable viewport after HUD insets', async () => {
        render(
            <ZoomPanViewport
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                panBoundsMode="free"
                fitInsets={{ left: 100, bottom: 100 }}
                panToTarget="room-a"
                containerTestId="viewport"
                contentTestId="content"
            >
                <div data-zoom-pan-target="room-a">room a</div>
            </ZoomPanViewport>,
        );

        const viewport = screen.getByTestId('viewport');
        const content = screen.getByTestId('content');
        const target = screen.getByText('room a');
        mockElementBox(viewport, { width: 400, height: 300 });
        mockElementBox(content, { width: 800, height: 600, left: 100, top: 20 });
        mockElementBox(target, { width: 40, height: 40, left: 300, top: 50 });
        await refreshMeasuredSizes();

        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });

        await waitFor(() => {
            expect(content.style.transform).toContain('translate(-160px, 40px)');
        });
    });
});
