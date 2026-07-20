import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeckDiscardZone } from '../ui/DeckDiscardZone';

let latestPromptOverlayProps: Record<string, unknown> | null = null;

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

vi.mock('../ui/PromptOverlay', () => ({
    PromptOverlay: (props: Record<string, unknown>) => {
        latestPromptOverlayProps = props;
        return <div data-testid="mock-prompt-overlay" />;
    },
}));

describe('DeckDiscardZone 牌库查看', () => {
    beforeEach(() => {
        latestPromptOverlayProps = null;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('点击牌库后应按派系固定顺序聚合剩余卡牌，并带数量徽章数据', async () => {
        render(
            <DeckDiscardZone
                deckCount={5}
                deckQueryEnabled
                deckCards={[
                    { uid: 'deck-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                    { uid: 'deck-2', defId: 'alien_scout', type: 'minion', owner: '0' },
                    { uid: 'deck-3', defId: 'alien_invader', type: 'minion', owner: '0' },
                    { uid: 'deck-4', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                    { uid: 'deck-5', defId: 'alien_scout', type: 'minion', owner: '0' },
                ]}
                deckFactions={['aliens', 'pirates']}
                discard={[]}
                isMyTurn
                dispatch={vi.fn()}
                playerID="0"
            />,
        );

        fireEvent.click(screen.getByTestId('su-deck-stack'));

        await waitFor(() => {
            expect(screen.getByTestId('mock-prompt-overlay')).toBeInTheDocument();
        });

        const displayCards = latestPromptOverlayProps?.displayCards as {
            cards: Array<{ defId: string; count?: number }>;
            title: string;
        } | undefined;

        expect(displayCards?.title).toBe('牌库 (5)');
        expect(displayCards?.cards).toEqual([
            { uid: 'deck-alien_invader', defId: 'alien_invader', count: 1 },
            { uid: 'deck-alien_scout', defId: 'alien_scout', count: 2 },
            { uid: 'deck-pirate_first_mate', defId: 'pirate_first_mate', count: 2 },
        ]);
    });

    it('余牌查询关闭时仍显示数量，但不能打开牌库详情', async () => {
        render(
            <DeckDiscardZone
                deckCount={5}
                deckQueryEnabled={false}
                deckCards={[
                    { uid: 'deck-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                    { uid: 'deck-2', defId: 'alien_scout', type: 'minion', owner: '0' },
                ]}
                deckFactions={['aliens', 'pirates']}
                discard={[]}
                isMyTurn
                dispatch={vi.fn()}
                playerID="0"
            />,
        );

        expect(screen.getByTestId('su-deck-count-badge')).toHaveTextContent('5');

        fireEvent.click(screen.getByTestId('su-deck-stack'));

        await waitFor(() => {
            expect(screen.queryByTestId('mock-prompt-overlay')).toBeNull();
        });
        expect(latestPromptOverlayProps).toBeNull();
    });

    it('弃牌堆多选 prompt 应把已选集合和确认动作传给展示层', async () => {
        const onSelectCard = vi.fn();
        const onConfirmSelection = vi.fn();

        render(
            <DeckDiscardZone
                deckCount={5}
                discard={[
                    { uid: 'discard-1', defId: 'rock_stars_groupie', type: 'minion', owner: '0' },
                    { uid: 'discard-2', defId: 'rock_stars_classic_rocker', type: 'minion', owner: '0' },
                    { uid: 'discard-3', defId: 'rock_stars_rick_roll', type: 'minion', owner: '0' },
                ]}
                isMyTurn
                autoOpenPanel
                playableCards={[
                    { uid: 'discard-1', defId: 'rock_stars_groupie', label: '伴唱粉丝' },
                    { uid: 'discard-2', defId: 'rock_stars_classic_rocker', label: '经典摇滚客' },
                    { uid: 'discard-3', defId: 'rock_stars_rick_roll', label: '瑞克摇滚' },
                ]}
                selectedUids={new Set(['discard-1', 'discard-2'])}
                onSelectCard={onSelectCard}
                onConfirmSelection={onConfirmSelection}
                minSelections={0}
                maxSelections={3}
                dispatch={vi.fn()}
                playerID="0"
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('mock-prompt-overlay')).toBeInTheDocument();
        });

        const displayCards = latestPromptOverlayProps?.displayCards as {
            cards: Array<{ uid: string; defId: string }>;
            selectedUids?: Set<string>;
            onSelect?: (uid: string | null) => void;
            onConfirmSelection?: () => void;
            minSelections?: number;
            maxSelections?: number;
        } | undefined;

        expect(displayCards?.cards.map(card => card.uid)).toEqual(['discard-3', 'discard-2', 'discard-1']);
        expect(displayCards?.selectedUids).toEqual(new Set(['discard-1', 'discard-2']));
        expect(displayCards?.minSelections).toBe(0);
        expect(displayCards?.maxSelections).toBe(3);

        displayCards?.onSelect?.('discard-3');
        displayCards?.onConfirmSelection?.();

        expect(onSelectCard).toHaveBeenCalledWith('discard-3');
        expect(onConfirmSelection).toHaveBeenCalledTimes(1);
    });
});
