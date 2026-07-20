import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardSpotlightQueue } from '../CardSpotlightQueue';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === 'cardSpotlightQueue.dismiss') return '看清后可关闭';
            if (key === 'cardSpotlightQueue.queue') return `${options?.count} 张待查看 · 看清后可关闭`;
            if (key === 'cardSpotlightQueue.closeSpotlight') return '关闭特写';
            return key;
        },
    }),
}));

describe('CardSpotlightQueue', () => {
    it('只允许明确关闭按钮关闭，并保留更紧凑的默认提示文案', () => {
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
        const closeButton = screen.getByRole('button', { name: '关闭特写' });

        expect(screen.getByText('看清后可关闭')).toBeInTheDocument();
        expect(screen.getByTestId('card-spotlight-queue').className).toContain('pointer-events-none');

        fireEvent.click(content);
        expect(onDismiss).not.toHaveBeenCalled();

        fireEvent.click(closeButton);
        expect(onDismiss).toHaveBeenCalledWith('spotlight-1');
    });

    it('多张队列时应显示统一的待查看提示，而不是额外动作暗示', () => {
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

        expect(screen.getByText('2 张待查看 · 看清后可关闭')).toBeInTheDocument();
    });
});
