import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AbilityCard } from '../../types';
import { DrawDeck } from '../DrawDeck';
import { DiscardPile } from '../DiscardPile';
import { HandArea } from '../HandArea';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../../../components/common/media/OptimizedImage', () => ({
    OptimizedImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img data-testid="mock-optimized-image" {...props} />,
}));

vi.mock('../../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ className }: { className?: string }) => <div data-testid="mock-card-preview" className={className} />,
}));

vi.mock('../../../../hooks/ui/useCoarsePointer', () => ({
    useCoarsePointer: () => false,
}));

afterEach(() => {
    vi.useRealTimers();
});

describe('DiceThrone compatibility sizing', () => {
    it('牌库应提供显式宽高，避免旧 WebView 塌高', () => {
        render(<DrawDeck count={18} />);

        const deck = screen.getByTestId('mock-optimized-image').parentElement?.parentElement as HTMLElement | null;
        expect(deck?.style.width).toBe('10.2vw');
        expect(deck?.style.height).toContain('vw');
    });

    it('牌库右下角提供手牌隐藏切换按钮', () => {
        const onToggleHandHidden = vi.fn();
        render(<DrawDeck count={18} onToggleHandHidden={onToggleHandHidden} />);

        const toggle = screen.getByTestId('dicethrone-hand-visibility-toggle');
        expect(toggle).toHaveAttribute('aria-label', 'hud.hideHand');
        expect(toggle.className).toContain('left-[calc(100%+0.35vw)] bottom-0');
        expect(toggle.className).not.toContain('-translate-x-[34%]');
        expect(toggle.className).not.toContain('-translate-y-[34%]');
        expect(toggle.querySelector('.lucide-chevron-down')).not.toBeNull();
        expect(toggle.querySelector('.lucide-eye')).toBeNull();
        expect(toggle.querySelector('.lucide-eye-off')).toBeNull();

        fireEvent.click(toggle);
        expect(onToggleHandHidden).toHaveBeenCalledTimes(1);
    });

    it('手牌已收起时，切换按钮使用向上图标表示展开', () => {
        render(<DrawDeck count={18} isHandHidden onToggleHandHidden={vi.fn()} />);

        const toggle = screen.getByTestId('dicethrone-hand-visibility-toggle');
        expect(toggle).toHaveAttribute('aria-label', 'hud.showHand');
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        expect(toggle.querySelector('.lucide-chevron-up')).not.toBeNull();
        expect(toggle.querySelector('.lucide-eye')).toBeNull();
        expect(toggle.querySelector('.lucide-eye-off')).toBeNull();
    });

    it('弃牌堆应提供 padding 比例盒兜底高度', () => {
        const topCard: AbilityCard = {
            id: 'c1',
            name: 'Card',
            cpCost: 1,
            previewRef: { type: 'image', src: 'x' },
            effects: [],
        };
        render(
            <DiscardPile
                cards={[topCard]}
                onInspectRecent={vi.fn()}
            />,
        );

        const pile = screen.getByTestId('discard-pile');
        expect(pile.style.paddingTop).toContain('%');
        expect(pile.style.height).toBe('0px');
    });

    it('手牌区应给卡牌提供显式宽高，避免旧 WebView 把扇形手牌压成横条', () => {
        vi.useFakeTimers();

        const topCard: AbilityCard = {
            id: 'c1',
            name: 'Card',
            cpCost: 1,
            previewRef: { type: 'image', src: 'x' },
            effects: [],
        };

        render(
            <HandArea
                hand={[topCard]}
                playerCp={2}
                canInteract={false}
            />,
        );

        act(() => {
            vi.runAllTimers();
        });

        const handArea = screen.getByTestId('hand-area');
        const handCard = document.querySelector('[data-card-id="c1"]') as HTMLElement | null;

        expect(handArea.className).toContain('h-[22vw]');
        expect(handCard).not.toBeNull();
        expect(handCard?.style.width).toBe('12vw');
        expect(handCard?.style.height).toContain('calc(');
        expect(handCard?.style.height).toContain('vw');
    });
});
