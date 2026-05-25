import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardInstance } from '../domain/types';
import { HandArea } from '../ui/HandArea';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    }),
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ className, title }: { className?: string; title?: string }) => (
        <div className={className} data-testid="mock-card-preview">{title ?? 'card'}</div>
    ),
}));

const makeHand = (count: number): CardInstance[] => (
    Array.from({ length: count }, (_, index) => ({
        uid: `hand-card-${index}`,
        defId: index % 2 === 0 ? 'alien_invader' : 'pirate_first_mate',
        type: index % 2 === 0 ? 'minion' : 'action',
        owner: '0',
    }))
);

function renderHandArea(props: Partial<React.ComponentProps<typeof HandArea>> = {}) {
    return render(
        <HandArea
            hand={makeHand(12)}
            selectedCardUid={null}
            onCardSelect={vi.fn()}
            {...props}
        />,
    );
}

function getCardMargins(container: HTMLElement): number[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-card-uid]'))
        .slice(1)
        .map((card) => Number.parseFloat(card.style.marginLeft));
}

describe('SmashUp HandArea discard layout', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('弃牌选择态与普通手牌态使用一致的多牌间距', async () => {
        const discardView = renderHandArea({ isDiscardMode: true });
        const normalView = renderHandArea({ isDiscardMode: false });

        await waitFor(() => {
            expect(discardView.container.querySelectorAll('[data-card-uid]')).toHaveLength(12);
            expect(normalView.container.querySelectorAll('[data-card-uid]')).toHaveLength(12);
        });

        const scroller = discardView.container.querySelector<HTMLElement>('[data-tutorial-id="su-hand-area"]');
        expect(scroller?.className).not.toContain('overflow-x-auto');
        expect(scroller?.className).not.toContain('smashup-h-scrollbar');
        expect(getCardMargins(discardView.container)).toEqual(getCardMargins(normalView.container));
        expect(getCardMargins(discardView.container).some((margin) => margin < 0)).toBe(true);
        expect(Math.min(...getCardMargins(discardView.container))).toBeGreaterThanOrEqual(-3.4);
        const firstCard = discardView.container.querySelector<HTMLElement>('[data-card-uid]');
        expect(firstCard?.style.width).toBeTruthy();
        expect(firstCard?.style.height).toBeTruthy();
    });
});
