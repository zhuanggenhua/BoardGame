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
        expect(closeButton).toHaveClass('right-2');
        expect(closeButton).toHaveClass('top-2');
        expect(closeButton).toHaveTextContent('');
        expect(closeButton.querySelector('svg')).not.toBeNull();
        expect(closeButton.parentElement).not.toBe(screen.getByTestId('magnify-body'));

        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
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
