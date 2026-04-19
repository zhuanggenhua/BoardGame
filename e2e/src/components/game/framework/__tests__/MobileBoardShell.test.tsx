import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MobileBattlefieldViewport, MobileBoardShell } from '../MobileBoardShell';

describe('MobileBoardShell', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 900,
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            writable: true,
            value: 500,
        });
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: originalInnerWidth,
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            writable: true,
            value: originalInnerHeight,
        });
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
    });

    it('renders canvas content inside the constrained shell wrapper and optional rails', () => {
        const { container } = render(
            <MobileBoardShell
                topRail={<div>top</div>}
                sideDock={<div>side</div>}
                bottomRail={<div>bottom</div>}
            >
                <div>board</div>
            </MobileBoardShell>,
        );

        expect(screen.getByText('board')).toBeInTheDocument();
        expect(screen.getByText('top')).toBeInTheDocument();
        expect(screen.getByText('side')).toBeInTheDocument();
        expect(screen.getByText('bottom')).toBeInTheDocument();
        expect(container.querySelector('.mobile-board-shell__content')).not.toBeNull();
    });

    it('exposes battlefield zoom ownership on the shell', () => {
        render(
            <MobileBoardShell battlefieldZoomMode="shell-pinch-pan">
                <div>board</div>
            </MobileBoardShell>,
        );

        const shell = document.querySelector('.mobile-board-shell');
        expect(shell?.getAttribute('data-battlefield-zoom-mode')).toBe('shell-pinch-pan');
    });

    it('renders a dedicated battlefield viewport stage for pinch-pan capable games', () => {
        render(
            <MobileBattlefieldViewport zoomMode="shell-pinch-pan" testId="battlefield">
                <div>board</div>
            </MobileBattlefieldViewport>,
        );

        expect(screen.getByTestId('battlefield')).toBeInTheDocument();
        expect(screen.getByTestId('battlefield-stage')).toBeInTheDocument();
    });

    it('can target pinch-pan transforms directly on the marked content layer without adding a stage wrapper', async () => {
        render(
            <MobileBattlefieldViewport
                zoomMode="shell-pinch-pan"
                transformTarget="content"
                testId="battlefield"
            >
                <div data-testid="battlefield-target" data-mobile-battlefield-zoom-target="true">
                    board
                </div>
            </MobileBattlefieldViewport>,
        );

        const viewport = screen.getByTestId('battlefield');

        await waitFor(() => {
            expect(viewport.getAttribute('data-battlefield-zoom-target-mode')).toBe('content');
        });

        expect(screen.queryByTestId('battlefield-stage')).toBeNull();
        expect(viewport.className).toContain('mobile-battlefield-viewport--zoom-enabled');

        act(() => {
            fireEvent.pointerDown(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 120,
                clientY: 120,
            });
            fireEvent.pointerDown(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 220,
                clientY: 120,
            });
        });

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 80,
                clientY: 120,
            });
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 260,
                clientY: 120,
            });
        });

        expect(Number(viewport.getAttribute('data-battlefield-zoom-scale') ?? '1')).toBeGreaterThan(1);
        const root = screen.getByTestId('battlefield-target');
        expect(root.style.getPropertyValue('--mobile-battlefield-target-scale')).not.toBe('1');
        expect(root.style.getPropertyValue('--mobile-battlefield-target-translate-x')).not.toBe('');
    });

    it('supports the smashup-style outer scroll wrapper as the content zoom target', async () => {
        render(
            <MobileBattlefieldViewport
                zoomMode="shell-pinch-pan"
                transformTarget="content"
                testId="battlefield"
            >
                <div
                    data-testid="battlefield-scroll-wrapper"
                    data-mobile-battlefield-zoom-target="true"
                    style={{ overflowX: 'auto' }}
                >
                    <div data-testid="battlefield-inner-strip">board</div>
                </div>
            </MobileBattlefieldViewport>,
        );

        const viewport = screen.getByTestId('battlefield');
        const wrapper = screen.getByTestId('battlefield-scroll-wrapper');

        await waitFor(() => {
            expect(viewport.getAttribute('data-battlefield-zoom-target-mode')).toBe('content');
        });

        act(() => {
            fireEvent.pointerDown(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 120,
                clientY: 120,
            });
            fireEvent.pointerDown(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 220,
                clientY: 120,
            });
        });

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 80,
                clientY: 120,
            });
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 260,
                clientY: 120,
            });
        });

        expect(Number(viewport.getAttribute('data-battlefield-zoom-scale') ?? '1')).toBeGreaterThan(1);
        expect(wrapper.style.getPropertyValue('--mobile-battlefield-target-scale')).not.toBe('1');
        expect(wrapper.style.getPropertyValue('--mobile-battlefield-target-translate-x')).not.toBe('');
    });

    it('clamps centered content-target panning to the actual child bounds instead of exposing empty black margins', async () => {
        render(
            <MobileBattlefieldViewport
                zoomMode="shell-pinch-pan"
                transformTarget="content"
                testId="battlefield"
            >
                <div
                    data-testid="battlefield-scroll-wrapper"
                    data-mobile-battlefield-zoom-target="true"
                    style={{ overflowX: 'auto' }}
                >
                    <div data-testid="battlefield-inner-strip">board</div>
                </div>
            </MobileBattlefieldViewport>,
        );

        const viewport = screen.getByTestId('battlefield');
        const wrapper = screen.getByTestId('battlefield-scroll-wrapper');
        const inner = screen.getByTestId('battlefield-inner-strip');

        await waitFor(() => {
            expect(viewport.getAttribute('data-battlefield-zoom-target-mode')).toBe('content');
        });

        Object.defineProperty(viewport, 'clientWidth', {
            configurable: true,
            value: 600,
        });
        Object.defineProperty(viewport, 'clientHeight', {
            configurable: true,
            value: 400,
        });
        viewport.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            right: 600,
            bottom: 400,
            width: 600,
            height: 400,
            toJSON: () => ({}),
        });

        for (const [property, value] of [
            ['offsetWidth', 600],
            ['clientWidth', 600],
            ['scrollWidth', 600],
            ['offsetHeight', 400],
            ['clientHeight', 400],
            ['scrollHeight', 400],
            ['offsetLeft', 0],
            ['offsetTop', 0],
        ] as const) {
            Object.defineProperty(wrapper, property, {
                configurable: true,
                value,
            });
        }
        const readTransform = () => {
            const scale = Number(wrapper.style.getPropertyValue('--mobile-battlefield-target-scale') || '1');
            const translateX = Number((wrapper.style.getPropertyValue('--mobile-battlefield-target-translate-x') || '0px').replace('px', ''));
            const translateY = Number((wrapper.style.getPropertyValue('--mobile-battlefield-target-translate-y') || '0px').replace('px', ''));
            return { scale, translateX, translateY };
        };
        wrapper.getBoundingClientRect = () => {
            const { scale, translateX, translateY } = readTransform();
            return {
                x: translateX,
                y: translateY,
                left: translateX,
                top: translateY,
                right: translateX + 600 * scale,
                bottom: translateY + 400 * scale,
                width: 600 * scale,
                height: 400 * scale,
                toJSON: () => ({}),
            };
        };

        for (const [property, value] of [
            ['offsetWidth', 320],
            ['clientWidth', 320],
            ['scrollWidth', 320],
            ['offsetHeight', 220],
            ['clientHeight', 220],
            ['scrollHeight', 220],
            ['offsetLeft', 0],
            ['offsetTop', 0],
        ] as const) {
            Object.defineProperty(inner, property, {
                configurable: true,
                value,
            });
        }
        inner.getBoundingClientRect = () => {
            const { scale, translateX, translateY } = readTransform();
            const left = translateX + 140 * scale;
            const top = translateY + 90 * scale;
            const width = 320 * scale;
            const height = 220 * scale;
            return {
                x: left,
                y: top,
                left,
                top,
                right: left + width,
                bottom: top + height,
                width,
                height,
                toJSON: () => ({}),
            };
        };

        act(() => {
            fireEvent.pointerDown(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 180,
                clientY: 180,
            });
            fireEvent.pointerDown(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 280,
                clientY: 180,
            });
        });

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 120,
                clientY: 180,
            });
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 360,
                clientY: 180,
            });
        });

        act(() => {
            fireEvent.pointerUp(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 360,
                clientY: 180,
            });
        });

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 380,
                clientY: 180,
            });
        });

        const translateX = Number(viewport.getAttribute('data-battlefield-translate-x') ?? '0');
        expect(Number(viewport.getAttribute('data-battlefield-zoom-scale') ?? '1')).toBeGreaterThanOrEqual(1.5);
        expect(translateX).toBeCloseTo(-80, 5);
    });

    it('updates battlefield scale when a two-finger touch pointer gesture moves apart on mobile landscape', () => {
        render(
            <MobileBattlefieldViewport zoomMode="shell-pinch-pan" testId="battlefield">
                <div>board</div>
            </MobileBattlefieldViewport>,
        );

        const viewport = screen.getByTestId('battlefield');
        const stage = screen.getByTestId('battlefield-stage');
        expect(viewport.getAttribute('data-battlefield-zoom-scale')).toBe('1.000');

        act(() => {
            fireEvent.pointerDown(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 120,
                clientY: 120,
            });
            fireEvent.pointerDown(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 220,
                clientY: 120,
            });
        });

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 80,
                clientY: 120,
            });
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 260,
                clientY: 120,
            });
        });

        expect(Number(viewport.getAttribute('data-battlefield-zoom-scale') ?? '1')).toBeGreaterThan(1);
        expect(viewport.getAttribute('data-battlefield-touch-mode')).toBe('gesture-lock');
        expect(stage.style.transform).toContain('scale(');
    });

    it('locks the first real pinch center as the zoom anchor instead of following one finger on the first zoom frame', () => {
        render(
            <MobileBattlefieldViewport zoomMode="shell-pinch-pan" testId="battlefield">
                <div>board</div>
            </MobileBattlefieldViewport>,
        );

        const viewport = screen.getByTestId('battlefield');
        const stage = screen.getByTestId('battlefield-stage');

        Object.defineProperty(viewport, 'clientWidth', {
            configurable: true,
            value: 600,
        });
        Object.defineProperty(viewport, 'clientHeight', {
            configurable: true,
            value: 400,
        });
        viewport.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            right: 600,
            bottom: 400,
            width: 600,
            height: 400,
            toJSON: () => ({}),
        });

        for (const [property, value] of [
            ['offsetWidth', 1000],
            ['clientWidth', 1000],
            ['scrollWidth', 1000],
            ['offsetHeight', 600],
            ['clientHeight', 600],
            ['scrollHeight', 600],
            ['offsetLeft', 0],
            ['offsetTop', 0],
        ] as const) {
            Object.defineProperty(stage, property, {
                configurable: true,
                value,
            });
        }
        stage.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            right: 1000,
            bottom: 600,
            width: 1000,
            height: 600,
            toJSON: () => ({}),
        });

        act(() => {
            fireEvent.pointerDown(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 180,
                clientY: 180,
            });
            fireEvent.pointerDown(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 280,
                clientY: 180,
            });
        });

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 288,
                clientY: 180,
            });
        });

        expect(viewport.getAttribute('data-battlefield-zoom-scale')).toBe('1.000');
        expect(viewport.getAttribute('data-battlefield-translate-x')).toBe('0.000');
        expect(viewport.getAttribute('data-battlefield-translate-y')).toBe('0.000');

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 300,
                clientY: 180,
            });
        });

        expect(viewport.getAttribute('data-battlefield-zoom-scale')).toBe('1.000');

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 344,
                clientY: 180,
            });
        });

        const scale = Number(viewport.getAttribute('data-battlefield-zoom-scale') ?? '1');
        const translateX = Number(viewport.getAttribute('data-battlefield-translate-x') ?? '0');

        expect(scale).toBeGreaterThan(1.1);
        expect(translateX).toBeLessThan(-80);
        expect(translateX).toBeGreaterThan(-95);
    });

    it('uses the latest settled two-finger center before activation instead of the second-finger touchdown center', () => {
        render(
            <MobileBattlefieldViewport zoomMode="shell-pinch-pan" testId="battlefield">
                <div>board</div>
            </MobileBattlefieldViewport>,
        );

        const viewport = screen.getByTestId('battlefield');
        const stage = screen.getByTestId('battlefield-stage');

        Object.defineProperty(viewport, 'clientWidth', {
            configurable: true,
            value: 600,
        });
        Object.defineProperty(viewport, 'clientHeight', {
            configurable: true,
            value: 400,
        });
        viewport.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            right: 600,
            bottom: 400,
            width: 600,
            height: 400,
            toJSON: () => ({}),
        });

        for (const [property, value] of [
            ['offsetWidth', 1000],
            ['clientWidth', 1000],
            ['scrollWidth', 1000],
            ['offsetHeight', 600],
            ['clientHeight', 600],
            ['scrollHeight', 600],
            ['offsetLeft', 0],
            ['offsetTop', 0],
        ] as const) {
            Object.defineProperty(stage, property, {
                configurable: true,
                value,
            });
        }
        stage.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            right: 1000,
            bottom: 600,
            width: 1000,
            height: 600,
            toJSON: () => ({}),
        });

        act(() => {
            fireEvent.pointerDown(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 180,
                clientY: 180,
            });
            fireEvent.pointerDown(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 280,
                clientY: 180,
            });
        });

        const settlePairs: Array<[number, number]> = [
            [188, 280],
            [188, 288],
            [196, 288],
            [196, 296],
            [204, 296],
            [204, 304],
            [212, 304],
            [212, 312],
            [220, 312],
            [220, 320],
        ];

        for (const [firstX, secondX] of settlePairs) {
            act(() => {
                fireEvent.pointerMove(viewport, {
                    pointerId: 1,
                    pointerType: 'touch',
                    clientX: firstX,
                    clientY: 180,
                });
            });
            act(() => {
                fireEvent.pointerMove(viewport, {
                    pointerId: 2,
                    pointerType: 'touch',
                    clientX: secondX,
                    clientY: 180,
                });
            });
        }

        expect(viewport.getAttribute('data-battlefield-zoom-scale')).toBe('1.000');
        expect(viewport.getAttribute('data-battlefield-translate-x')).toBe('0.000');

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 200,
                clientY: 180,
            });
        });

        expect(viewport.getAttribute('data-battlefield-zoom-scale')).toBe('1.000');

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 360,
                clientY: 180,
            });
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 160,
                clientY: 180,
            });
            fireEvent.pointerMove(viewport, {
                pointerId: 2,
                pointerType: 'touch',
                clientX: 400,
                clientY: 180,
            });
        });

        const scale = Number(viewport.getAttribute('data-battlefield-zoom-scale') ?? '1');
        const translateX = Number(viewport.getAttribute('data-battlefield-translate-x') ?? '0');

        expect(scale).toBeGreaterThan(1.9);
        expect(translateX).toBeLessThan(-260);
        expect(translateX).toBeGreaterThan(-280);
    });

    it('ignores legacy touch events when touch pointer events are available', () => {
        render(
            <MobileBattlefieldViewport zoomMode="shell-pinch-pan" testId="battlefield">
                <div>board</div>
            </MobileBattlefieldViewport>,
        );

        const viewport = screen.getByTestId('battlefield');

        act(() => {
            fireEvent.touchStart(viewport, {
                changedTouches: [
                    { identifier: 1, clientX: 120, clientY: 120 },
                ],
                touches: [
                    { identifier: 1, clientX: 120, clientY: 120 },
                ],
            });
            fireEvent.pointerDown(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 120,
                clientY: 120,
            });
        });

        act(() => {
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 200,
                clientY: 120,
            });
            fireEvent.pointerMove(viewport, {
                pointerId: 1,
                pointerType: 'touch',
                clientX: 260,
                clientY: 120,
            });
        });

        expect(viewport.getAttribute('data-battlefield-zoom-scale')).toBe('1.000');
        expect(viewport.getAttribute('data-battlefield-touch-mode')).toBe('native-pan');
    });
});
