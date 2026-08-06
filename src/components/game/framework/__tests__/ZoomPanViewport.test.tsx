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

    it('accounts for content offset and base scale when centering a focused target', async () => {
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
            expect(content.style.transform).toContain('translate(-150px, -45px)');
        });
    });
});
