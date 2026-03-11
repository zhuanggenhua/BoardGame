import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from '../common/overlays/ConfirmModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'button.confirm') return 'confirm';
            if (key === 'button.cancel') return 'cancel';
            return key;
        },
    }),
}));

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const MotionDiv = ({ children, ...rest }: { children?: React.ReactNode }) => (
        React.createElement('div', rest, children)
    );

    return {
        motion: { div: MotionDiv },
        AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
            React.createElement(React.Fragment, null, children)
        ),
    };
});

describe('ConfirmModal', () => {
    it('renders title, description, and default button text', () => {
        const html = renderToStaticMarkup(
            <ConfirmModal
                title="leave match"
                description="match in progress"
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );

        expect(html).toContain('leave match');
        expect(html).toContain('match in progress');
        expect(html).toContain('confirm');
        expect(html).toContain('cancel');
    });

    it('supports custom button text and hiding cancel button', () => {
        const html = renderToStaticMarkup(
            <ConfirmModal
                title="leave"
                description="confirm leave"
                confirmText="ok"
                cancelText="later"
                showCancel={false}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );

        expect(html).toContain('leave');
        expect(html).toContain('confirm leave');
        expect(html).toContain('ok');
        expect(html).not.toContain('later');
    });

    it('disables actions and blocks repeated confirm while pending', async () => {
        let resolveConfirm: (() => void) | null = null;
        const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
            resolveConfirm = resolve;
        }));

        render(
            <ConfirmModal
                title="destroy room"
                description="confirm destroy room"
                onConfirm={onConfirm}
                onCancel={() => {}}
            />
        );

        const confirmButton = screen.getByRole('button', { name: 'confirm' });
        const cancelButton = screen.getByRole('button', { name: 'cancel' });

        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(confirmButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();

        resolveConfirm?.();

        await waitFor(() => {
            expect(confirmButton).not.toBeDisabled();
            expect(cancelButton).not.toBeDisabled();
        });
    });
});
