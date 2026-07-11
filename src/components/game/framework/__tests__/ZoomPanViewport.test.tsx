/* @vitest-environment happy-dom */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ZoomPanViewport } from '../ZoomPanViewport';

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
});
