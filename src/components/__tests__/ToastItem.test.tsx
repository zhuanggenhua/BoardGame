import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../../contexts/ToastContext';
import { ToastItem } from '../common/feedback/ToastItem';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const ToastHarness = ({
    actionSpy,
    dismissOnClick = true,
}: {
    actionSpy: () => void;
    dismissOnClick?: boolean;
}) => {
    const toast = useToast();

    return (
        <>
            <button
                type="button"
                onClick={() => toast.info('Message body', 'Toast title', {
                    ttlMs: Infinity,
                    actions: [{
                        label: 'Run action',
                        variant: 'primary',
                        dismissOnClick,
                        onClick: actionSpy,
                    }],
                })}
            >
                show toast
            </button>
            <div>
                {toast.toasts.map((item) => (
                    <ToastItem key={item.id} toast={item} />
                ))}
            </div>
        </>
    );
};

const RewardToastHarness = () => {
    const toast = useToast();

    return (
        <>
            <button
                type="button"
                onClick={() => toast.success({
                    kind: 'reward-points',
                    text: '反馈成功',
                    points: 1,
                })}
            >
                show reward toast
            </button>
            <div>
                {toast.toasts.map((item) => (
                    <ToastItem key={item.id} toast={item} />
                ))}
            </div>
        </>
    );
};

describe('ToastItem actions', () => {
    it('executes the action and dismisses the toast by default', () => {
        const actionSpy = vi.fn();

        render(
            <ToastProvider>
                <ToastHarness actionSpy={actionSpy} />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'show toast' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run action' }));

        expect(actionSpy).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Toast title')).not.toBeInTheDocument();
    });

    it('keeps the toast visible when dismissOnClick is false', () => {
        const actionSpy = vi.fn();

        render(
            <ToastProvider>
                <ToastHarness actionSpy={actionSpy} dismissOnClick={false} />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'show toast' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run action' }));

        expect(actionSpy).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Toast title')).toBeInTheDocument();
    });

    it('renders reward points content with the shared badge', () => {
        render(
            <ToastProvider>
                <RewardToastHarness />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'show reward toast' }));

        expect(screen.getByText('反馈成功')).toBeInTheDocument();
        expect(screen.getByTestId('reward-points-badge')).toHaveTextContent('+1');
    });
});
