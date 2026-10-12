import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AbilityCard } from '../../types';
import { DrawDeck } from '../DrawDeck';
import { DiscardPile } from '../DiscardPile';
import {
    isHandCardReleaseOverDiscardPile,
    isHandCardOverDiscardPile,
    resolveHandDragReleaseIntent,
} from '../handDragRelease';
import {
    HandArea,
} from '../HandArea';

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

        const deck = screen.getByTestId('dt-draw-deck-card');
        expect(deck?.style.width).toContain('--mobile-board-shell-inline-unit');
        expect(deck?.style.height).toContain('--mobile-board-shell-inline-unit');
    });

    it('牌库右下角提供手牌隐藏切换按钮', () => {
        const onToggleHandHidden = vi.fn();
        render(<DrawDeck count={18} onToggleHandHidden={onToggleHandHidden} />);

        const toggle = screen.getByTestId('dicethrone-hand-visibility-toggle');
        expect(toggle).toHaveAttribute('aria-label', 'hud.hideHand');
        expect(toggle.style.left).toContain('--mobile-board-shell-inline-unit');
        expect(toggle.style.width).toBe('calc(44px / var(--mobile-board-shell-scale, 1))');
        expect(toggle.style.height).toBe('calc(44px / var(--mobile-board-shell-scale, 1))');
        expect(toggle.style.minWidth).toBe('calc(44px / var(--mobile-board-shell-scale, 1))');
        expect(toggle.style.minHeight).toBe('calc(44px / var(--mobile-board-shell-scale, 1))');
        const visual = screen.getByTestId('dicethrone-hand-visibility-visual');
        expect(visual.className).toContain('border border-cyan-200/70');
        expect(visual.className).toContain('bg-slate-950/88');
        expect(visual.className).toContain('text-cyan-100');
        expect(toggle.className).not.toContain('-translate-x-[34%]');
        expect(toggle.className).not.toContain('-translate-y-[34%]');
        const hitArea = screen.getByTestId('dicethrone-hand-visibility-hit-area');
        expect(hitArea.style.minHeight).toBe('calc(44px / var(--mobile-board-shell-scale, 1))');
        expect(hitArea.style.minWidth).toBe('calc(44px / var(--mobile-board-shell-scale, 1))');
        expect(toggle.querySelector('.lucide-chevron-down')).toHaveClass('board-shell-fixed-icon');
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
        const visual = screen.getByTestId('dicethrone-hand-visibility-visual');
        expect(visual.className).toContain('border-amber-200/80');
        expect(visual.className).toContain('text-amber-100');
        expect(screen.getByTestId('dicethrone-hand-visibility-hit-area')).toBeInTheDocument();
        expect(toggle.querySelector('.lucide-chevron-up')).toHaveClass('board-shell-fixed-icon');
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

        expect(handArea.style.height).toContain('--mobile-board-shell-inline-unit');
        expect(handCard).not.toBeNull();
        expect(handCard?.style.width).toContain('--mobile-board-shell-inline-unit');
        expect(handCard?.style.height).toContain('calc(');
        expect(handCard?.style.height).toContain('--mobile-board-shell-inline-unit');
    });

    it('牌池选择时应取消手牌底部裁切，保持卡牌完整落在视口内', () => {
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

        const defaultCard = document.querySelector('[data-card-id="c1"]') as HTMLElement | null;
        expect(defaultCard?.style.bottom).toContain('* -2');

        rerender(
            <HandArea
                hand={[topCard]}
                playerCp={2}
                canInteract={false}
                preserveCardVisibility
            />,
        );

        const protectedCard = document.querySelector('[data-card-id="c1"]') as HTMLElement | null;
        expect(protectedCard?.style.bottom).toContain('* 0');
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

    it('触控端弃牌堆投放热区放宽，桌面端仍沿用中心点命中', () => {
        const discardRect = {
            left: 820,
            right: 900,
            top: 120,
            bottom: 240,
            width: 80,
            height: 120,
        };
        const nearLeftCardRect = {
            left: 732,
            right: 792,
            top: 150,
            bottom: 248,
            width: 60,
            height: 98,
        };

        expect(isHandCardOverDiscardPile(nearLeftCardRect, discardRect, { isCoarsePointer: false })).toBe(false);
        expect(isHandCardOverDiscardPile(nearLeftCardRect, discardRect, { isCoarsePointer: true })).toBe(true);
    });

    it('反馈回归：主阶段拖牌到弃牌堆时，指针命中弃牌堆也应触发卖牌投放', () => {
        const discardRect = {
            left: 820,
            right: 900,
            top: 120,
            bottom: 240,
            width: 80,
            height: 120,
        };
        const laggingCardRect = {
            left: 600,
            right: 660,
            top: 300,
            bottom: 398,
            width: 60,
            height: 98,
        };

        expect(isHandCardOverDiscardPile(laggingCardRect, discardRect, { isCoarsePointer: false })).toBe(false);
        expect(isHandCardReleaseOverDiscardPile(
            laggingCardRect,
            discardRect,
            { isCoarsePointer: false, pointerPoint: { x: 850, y: 180 } },
        )).toBe(true);
    });

    it('反馈回归：拖到弃牌堆时应优先卖牌，不应被向上拖拽出牌阈值抢走', () => {
        expect(resolveHandDragReleaseIntent({ overDiscard: true, yOffset: -240 })).toBe('sell');
        expect(resolveHandDragReleaseIntent({ overDiscard: false, yOffset: -240 })).toBe('play');
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
