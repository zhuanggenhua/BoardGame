import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MagnifyOverlay } from '../overlays/MagnifyOverlay';

describe('MagnifyOverlay', () => {
    it('keeps the close affordance as a top-right X overlay that does not occupy content layout', () => {
        const onClose = vi.fn();

        render(
            <MagnifyOverlay
                isOpen
                onClose={onClose}
                overlayTestId="shared-card-magnify-overlay"
                closeLabel="关闭"
            >
                <div data-testid="magnify-body">放大卡牌</div>
            </MagnifyOverlay>,
        );

        const closeButton = screen.getByTestId('shared-card-magnify-overlay-close');
        expect(closeButton).toHaveClass('absolute');
        expect(closeButton).toHaveClass('right-3');
        expect(closeButton).toHaveClass('top-3');
        expect(closeButton).toHaveTextContent('');
        expect(closeButton.querySelector('svg')).not.toBeNull();
        expect(closeButton.parentElement).not.toBe(screen.getByTestId('magnify-body'));

        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('requires real pointer movement after opening when hover reveal is requested', () => {
        const { rerender } = render(
            <MagnifyOverlay isOpen onClose={() => {}} overlayTestId="magnify" revealCloseAfterPointerMove>
                <div>卡牌</div>
            </MagnifyOverlay>,
        );
        const group = screen.getByTestId('magnify-close').parentElement!;
        expect(group).toHaveAttribute('data-close-pointer-ready', 'false');
        const stationary = new Event('pointermove', { bubbles: true });
        Object.defineProperty(stationary, 'movementX', { value: 0 });
        Object.defineProperty(stationary, 'movementY', { value: 0 });
        fireEvent(group, stationary);
        expect(group).toHaveAttribute('data-close-pointer-ready', 'false');
        const moved = new Event('pointermove', { bubbles: true });
        Object.defineProperty(moved, 'movementX', { value: 1 });
        Object.defineProperty(moved, 'movementY', { value: 0 });
        fireEvent(group, moved);
        expect(group).toHaveAttribute('data-close-pointer-ready', 'true');
        rerender(<MagnifyOverlay isOpen={false} onClose={() => {}} overlayTestId="magnify" revealCloseAfterPointerMove><div>卡牌</div></MagnifyOverlay>);
        rerender(<MagnifyOverlay isOpen onClose={() => {}} overlayTestId="magnify" revealCloseAfterPointerMove><div>卡牌</div></MagnifyOverlay>);
        expect(screen.getByTestId('magnify-close').parentElement).toHaveAttribute('data-close-pointer-ready', 'false');
    });

    it('can keep backdrop clicks from replacing the explicit close button', () => {
        const onClose = vi.fn();

        render(
            <MagnifyOverlay
                isOpen
                onClose={onClose}
                overlayTestId="shared-card-magnify-overlay"
                closeLabel="关闭"
                closeOnBackdrop={false}
            >
                <div data-testid="magnify-body">放大卡牌</div>
            </MagnifyOverlay>,
        );

        const overlay = screen.getByTestId('shared-card-magnify-overlay');
        expect(overlay).toHaveAttribute('data-backdrop-dismiss', 'disabled');
        fireEvent.click(overlay);
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('shared-card-magnify-overlay-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
