import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeckDiscardZone } from '../ui/DeckDiscardZone';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ title }: { title?: string }) => <div data-testid="card-preview">{title ?? 'preview'}</div>,
}));

vi.mock('../../../hooks/ui/useTouchInspectGesture', () => ({
    useTouchInspectGesture: () => ({
        isCoarsePointer: false,
        showDesktopInspectButton: false,
        getTouchInspectProps: () => ({}),
        shouldBlockInspectClick: () => false,
    }),
}));

describe('SmashUp DeckDiscardZone focused titan prompt', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('focusedTitanPrompt 只保留可点击 titan rail，不再暴露 deck/discard 壳层', () => {
        render(
            <DeckDiscardZone
                deckCount={3}
                discard={[]}
                isMyTurn
                setAsideTitans={[
                    {
                        uid: 'time-box-1',
                        defId: 'time_travelers_time_box',
                        faction: 'time_travelers',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                        metadata: { timeBoxCounters: 4 },
                    } as any,
                ]}
                activatableTitanUids={new Set(['time-box-1'])}
                reactionTitanUids={new Set(['time-box-1'])}
                selectedTitanUid={null}
                onSelectTitan={vi.fn()}
                onViewTitan={vi.fn()}
                dispatch={vi.fn()}
                playerID="0"
                playerNames={{ '0': 'Host' }}
                focusedTitanPrompt
            />,
        );

        expect(screen.getByTestId('su-titan-rail')).toBeInTheDocument();
        expect(screen.getByTestId('su-rail-titan-time-box-1')).toBeInTheDocument();
        expect(screen.getByTestId('su-rail-titan-timebox-counter-time-box-1')).toHaveTextContent('4');
        expect(screen.getByTestId('su-rail-titan-badge-time-box-1')).toHaveTextContent('可触发');
        expect(screen.queryByTestId('su-deck-stack')).not.toBeInTheDocument();
        expect(screen.queryByTestId('su-discard-toggle')).not.toBeInTheDocument();
        expect(screen.queryByText('泰坦')).not.toBeInTheDocument();
    });
});
