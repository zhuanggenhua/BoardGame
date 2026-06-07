import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeckDiscardZone } from '../ui/DeckDiscardZone';

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
    PromptOverlay: () => <div data-testid="mock-prompt-overlay" />,
}));

describe('DeckDiscardZone 移动兼容布局', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('牌库、弃牌堆和泰坦 rail 卡片应有显式高度，避免旧 WebView 中压成横条', () => {
        const { getByTestId } = render(
            <DeckDiscardZone
                deckCount={12}
                discard={[{ uid: 'd1', defId: 'pirate_first_mate', type: 'minion', owner: '0' }]}
                isMyTurn
                compactLayout
                setAsideTitans={[
                    {
                        uid: 't1',
                        defId: 'dinosaurs_fort_titanosaurus',
                        faction: 'dinosaurs',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    },
                ]}
                dispatch={vi.fn()}
                playerID="0"
            />,
        );

        const deckCardFrame = getByTestId('su-deck-stack').querySelector<HTMLElement>('.aspect-\\[0\\.714\\]');
        const discardCardFrame = getByTestId('su-discard-toggle').querySelector<HTMLElement>('.aspect-\\[0\\.714\\]');
        const titanCard = getByTestId('su-rail-titan-t1') as HTMLElement;
        const titanFrame = titanCard.parentElement as HTMLElement | null;

        expect(deckCardFrame?.style.height).toContain('calc(');
        expect(discardCardFrame?.style.height).toContain('calc(');
        expect(titanCard.style.height).toBe('100%');
        expect(titanFrame?.style.height).toContain('calc(');
    });
});
