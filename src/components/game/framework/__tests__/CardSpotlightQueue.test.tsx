import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardSpotlightQueue } from '../CardSpotlightQueue';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === 'cardSpotlightQueue.dismiss') return '关闭特写';
            if (key === 'cardSpotlightQueue.queue') return `${options?.count} 张特写`;
            if (key === 'cardSpotlightQueue.closeSpotlight') return '关闭特写';
            return key;
        },
    }),
}));

describe('CardSpotlightQueue', () => {
    it('默认短暂展示后自动关闭，关闭按钮仍可立即关闭', () => {
        vi.useFakeTimers();
        const onDismiss = vi.fn();

        render(
            <CardSpotlightQueue
                queue={[{
                    id: 'spotlight-1',
                    playerId: '1',
                    cardData: { defId: 'time_travelers_time_walk' },
                }]}
                onDismiss={onDismiss}
                renderCard={(item) => (
                    <div data-testid="spotlight-card">{item.cardData.defId}</div>
                )}
            />,
        );

        const content = screen.getByTestId('card-spotlight-content');
        const queue = screen.getByTestId('card-spotlight-queue');
        const positioner = screen.getByTestId('card-spotlight-positioner');
        const closeButton = screen.getByRole('button', { name: '关闭特写' });

        expect(screen.getByText('关闭特写')).toBeInTheDocument();
        expect(queue.className).toContain('pointer-events-none');
        expect(positioner.className).toContain('top-');

        fireEvent.click(closeButton);
        expect(onDismiss).toHaveBeenCalledWith('spotlight-1');

        onDismiss.mockClear();
        vi.advanceTimersByTime(800);
        expect(onDismiss).toHaveBeenCalledWith('spotlight-1');
    });

    it('多张队列时应显示统一的特写数量，而不是过程话术', () => {
        render(
            <CardSpotlightQueue
                queue={[
                    { id: 'spotlight-1', playerId: '1', cardData: { defId: 'a' } },
                    { id: 'spotlight-2', playerId: '1', cardData: { defId: 'b' } },
                ]}
                onDismiss={vi.fn()}
                renderCard={(item) => (
                    <div data-testid="spotlight-card">{item.cardData.defId}</div>
                )}
            />,
        );

        expect(screen.getByText('2 张特写')).toBeInTheDocument();
    });
});
