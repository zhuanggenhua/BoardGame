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
});
