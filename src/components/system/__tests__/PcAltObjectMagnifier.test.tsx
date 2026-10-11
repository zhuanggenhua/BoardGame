import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PcAltObjectMagnifier } from '../PcAltObjectMagnifier';

describe('PcAltObjectMagnifier', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses Alt to show an inspectable object and wheel to adjust its zoom', () => {
        render(
            <>
                <PcAltObjectMagnifier />
                <button
                    data-browse-inspectable="true"
                    data-testid="inspectable-object"
                    style={{ width: 120, height: 180 }}
                >
                    card
                </button>
            </>,
        );

        const target = screen.getByTestId('inspectable-object');
        vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
            width: 120,
            height: 180,
            left: 100,
            top: 100,
            right: 220,
            bottom: 280,
            x: 100,
            y: 100,
            toJSON: () => ({}),
        } as DOMRect);
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: vi.fn(() => target),
        });

        act(() => {
            fireEvent.mouseMove(window, { clientX: 160, clientY: 190 });
            fireEvent.keyDown(window, { key: 'Alt' });
        });

        expect(screen.getByTestId('pc-alt-object-magnifier')).toBeInTheDocument();
        expect(screen.getByTestId('pc-alt-object-magnifier').querySelector('[data-pc-alt-zoom="2.60"]')).not.toBeNull();

        act(() => {
            fireEvent.wheel(window, { deltaY: -100, altKey: true });
        });

        expect(screen.getByTestId('pc-alt-object-magnifier').querySelector('[data-pc-alt-zoom="2.80"]')).not.toBeNull();

        act(() => {
            fireEvent.keyUp(window, { key: 'Alt' });
        });

        expect(screen.queryByTestId('pc-alt-object-magnifier')).toBeNull();
    });

    it('magnifies the object container when the pointer is over its inspect button', () => {
        render(
            <>
                <PcAltObjectMagnifier />
                <div data-secondary-inspect="true" data-testid="object-container">
                    <button data-card-inspect-variant="outline" data-testid="inspect-button">inspect</button>
                </div>
            </>,
        );

        const container = screen.getByTestId('object-container');
        const inspectButton = screen.getByTestId('inspect-button');
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            width: 200,
            height: 100,
            left: 20,
            top: 20,
            right: 220,
            bottom: 120,
            x: 20,
            y: 20,
            toJSON: () => ({}),
        } as DOMRect);
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: vi.fn(() => inspectButton),
        });

        act(() => {
            fireEvent.mouseMove(window, { clientX: 40, clientY: 40, altKey: true });
        });

        expect(screen.getByTestId('pc-alt-object-magnifier')).toBeInTheDocument();
        expect(screen.getByTestId('pc-alt-object-magnifier').innerHTML).not.toContain('data-card-inspect-variant');
    });

    it('magnifies a shared object identity without game-specific browse markers', () => {
        render(
            <>
                <PcAltObjectMagnifier />
                <div data-card-id="shared-card-1" data-testid="shared-object">
                    <span data-testid="shared-object-content">card</span>
                </div>
            </>,
        );

        const object = screen.getByTestId('shared-object');
        const content = screen.getByTestId('shared-object-content');
        vi.spyOn(object, 'getBoundingClientRect').mockReturnValue({
            width: 160,
            height: 240,
            left: 40,
            top: 40,
            right: 200,
            bottom: 280,
            x: 40,
            y: 40,
            toJSON: () => ({}),
        } as DOMRect);
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: vi.fn(() => content),
        });

        act(() => {
            fireEvent.mouseMove(window, { clientX: 80, clientY: 100, altKey: true });
        });

        expect(screen.getByTestId('pc-alt-object-magnifier')).toBeInTheDocument();
    });

    it('does not magnify objects inside the shared ignore contract', () => {
        render(
            <>
                <PcAltObjectMagnifier />
                <div data-card-id="ignored-card-1" data-board-magnify-ignore="true" data-testid="ignored-object">
                    ignored
                </div>
            </>,
        );

        const object = screen.getByTestId('ignored-object');
        vi.spyOn(object, 'getBoundingClientRect').mockReturnValue({
            width: 160,
            height: 240,
            left: 40,
            top: 40,
            right: 200,
            bottom: 280,
            x: 40,
            y: 40,
            toJSON: () => ({}),
        } as DOMRect);
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: vi.fn(() => object),
        });

        act(() => {
            fireEvent.mouseMove(window, { clientX: 80, clientY: 100, altKey: true });
        });

        expect(screen.queryByTestId('pc-alt-object-magnifier')).toBeNull();
    });
});
