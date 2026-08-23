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
        expect(toggle.className).toContain('left-[calc(100%+0.55vw)] bottom-[0.15vw]');
        expect(toggle.className).toContain('h-[2.65vw] min-h-[44px] w-[2.65vw] min-w-[44px]');
        expect(toggle.className).toContain('border-2');
        expect(toggle.className).toContain('bg-cyan-200');
        expect(toggle.className).toContain('text-slate-950');
        expect(toggle.className).not.toContain('-translate-x-[34%]');
        expect(toggle.className).not.toContain('-translate-y-[34%]');
        expect(toggle.className).not.toContain('bg-slate-950/88');
        expect(toggle.className).not.toContain('text-cyan-100');
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
        expect(toggle.className).toContain('bg-amber-200');
        expect(toggle.className).toContain('text-slate-950');
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

    it('隐藏手牌时只隐藏 UI，不卸载手牌区导致重新发牌', () => {
        vi.useFakeTimers();

        const topCard: AbilityCard = {
            id: 'c1',
            name: 'Card',
            cpCost: 1,
            previewRef: { type: 'image', src: 'x' },
            effects: [],
        };

        const { rerender } = render(
            <HandArea
                hand={[topCard]}
                playerCp={2}
                canInteract={false}
            />,
        );

        act(() => {
            vi.runAllTimers();
        });

        const firstHandArea = screen.getByTestId('hand-area');
        const firstHandCard = document.querySelector('[data-card-id="c1"]') as HTMLElement | null;
        const firstCardKey = firstHandCard?.getAttribute('data-card-key');

        expect(firstHandArea.style.display).toBe('');
        expect(firstCardKey).toBeTruthy();

        rerender(
            <HandArea
                hand={[topCard]}
                playerCp={2}
                canInteract={false}
                isHidden
            />,
        );

        const hiddenHandArea = screen.getByTestId('hand-area');
        const hiddenHandCard = document.querySelector('[data-card-id="c1"]') as HTMLElement | null;
        expect(hiddenHandArea).toHaveAttribute('data-hand-hidden', 'true');
        expect(hiddenHandArea.style.display).toBe('none');
        expect(hiddenHandCard?.getAttribute('data-card-key')).toBe(firstCardKey);

        rerender(
            <HandArea
                hand={[topCard]}
                playerCp={2}
                canInteract={false}
            />,
        );

        const restoredHandArea = screen.getByTestId('hand-area');
        const restoredHandCard = document.querySelector('[data-card-id="c1"]') as HTMLElement | null;
        expect(restoredHandArea).toHaveAttribute('data-hand-hidden', 'false');
        expect(restoredHandArea.style.display).toBe('');
        expect(restoredHandCard?.getAttribute('data-card-key')).toBe(firstCardKey);
    });

    it('普通点击手牌仍只打开预览，不直接出牌', () => {
        vi.useFakeTimers();

        const topCard: AbilityCard = {
            id: 'c1',
            name: 'Card',
            cpCost: 1,
            previewRef: { type: 'image', src: 'x' },
            effects: [],
        };
        const onMagnifyCard = vi.fn();
        const onPlayCard = vi.fn();

        render(
            <HandArea
                hand={[topCard]}
                playerCp={2}
                onMagnifyCard={onMagnifyCard}
                onPlayCard={onPlayCard}
            />,
        );

        act(() => {
            vi.runAllTimers();
        });

        const handCard = document.querySelector('[data-card-id="c1"]') as HTMLElement | null;
        expect(handCard).not.toBeNull();
        fireEvent.click(handCard!);

        expect(onMagnifyCard).toHaveBeenCalledWith(topCard);
        expect(onPlayCard).not.toHaveBeenCalled();
    });

    it('教程单击出牌模式会直接出牌并跳过预览层', () => {
        vi.useFakeTimers();

        const topCard: AbilityCard = {
            id: 'c1',
            name: 'Card',
            cpCost: 1,
            previewRef: { type: 'image', src: 'x' },
            effects: [],
        };
        const onMagnifyCard = vi.fn();
        const onPlayCard = vi.fn(() => true);

        render(
            <HandArea
                hand={[topCard]}
                playerCp={2}
                onMagnifyCard={onMagnifyCard}
                onPlayCard={onPlayCard}
                playCardOnClick
            />,
        );

        act(() => {
            vi.runAllTimers();
        });

        const handCard = document.querySelector('[data-card-id="c1"]') as HTMLElement | null;
        expect(handCard).not.toBeNull();
        fireEvent.click(handCard!);

        expect(onPlayCard).toHaveBeenCalledWith(topCard);
        expect(onMagnifyCard).not.toHaveBeenCalled();

        act(() => {
            vi.runOnlyPendingTimers();
        });
    });
});
