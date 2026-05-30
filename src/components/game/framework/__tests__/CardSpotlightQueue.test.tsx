import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardSpotlightQueue } from '../CardSpotlightQueue';

describe('CardSpotlightQueue', () => {
    it('保持非阻塞壳层，并用更紧凑的默认提示文案', () => {
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

        const queue = screen.getByTestId('card-spotlight-queue');
        const content = screen.getByTestId('card-spotlight-content');

        expect(queue.className).toContain('pointer-events-none');
        expect(content.className).toContain('pointer-events-auto');
        expect(screen.getByText('关闭后继续')).toBeInTheDocument();

        fireEvent.click(content);
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

        expect(screen.getByText('2 张待查看 · 关闭后继续')).toBeInTheDocument();
    });
});
