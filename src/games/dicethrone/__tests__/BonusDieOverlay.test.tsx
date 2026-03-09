import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { EventStreamEntry } from '../../../engine/types';
import type { BonusDieInfo } from '../domain/types';
import { useCardSpotlight } from '../hooks/useCardSpotlight';
import { BonusDieOverlay } from '../ui/BonusDieOverlay';
import { SpotlightContainer } from '../ui/SpotlightContainer';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string | number>) => {
            if (!options) return key;
            const params = Object.entries(options)
                .map(([paramKey, value]) => `${paramKey}=${value}`)
                .join(',');
            return `${key}:${params}`;
        },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('framer-motion', () => {
    const motion = new Proxy({}, {
        get: (_target, tag) => {
            return ({ children, ...rest }: { children?: React.ReactNode }) => (
                React.createElement(tag as string, rest, children)
            );
        },
    });

    return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => (
            <>{children}</>
        ),
    };
});

const buildBonusDice = (): BonusDieInfo[] => [
    { index: 0, value: 4, face: 'taiji' },
    { index: 1, value: 4, face: 'taiji' },
    { index: 2, value: 4, face: 'taiji' },
];

afterEach(() => {
    vi.useRealTimers();
});

describe('BonusDieOverlay', () => {
    it('有太极时显示重掷提示与确认伤害按钮', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                canReroll
                onReroll={vi.fn()}
                onSkipReroll={vi.fn()}
                showTotal
                rerollCostAmount={2}
                rerollCostTokenId="taiji"
            />
        );

        expect(html).toContain('bonusDie.selectToReroll:cost=2,token=tokens.taiji.name');
        expect(html).toContain('bonusDie.confirmDamage');
        expect(html).toContain('bonusDie.total');
        expect(html).toContain('cursor-pointer');
        expect(html).toContain('bg-amber-600/80');
        expect(html).toContain('(bonusDie.knockdownTrigger)');
    });

    it('无太极时显示无法重掷提示与继续按钮', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                canReroll={false}
                onReroll={vi.fn()}
                onSkipReroll={vi.fn()}
                showTotal
                rerollCostAmount={2}
                rerollCostTokenId="taiji"
            />
        );

        expect(html).toContain('bonusDie.noTokenToReroll:token=tokens.taiji.name');
        expect(html).toContain('bonusDie.continue');
        expect(html).not.toContain('bonusDie.confirmDamage');
        expect(html).not.toContain('cursor-pointer');
        expect(html).not.toContain('bg-amber-600/80');
    });

    it('同批卡牌与额外骰事件会把骰子绑定到卡牌特写，而不是直接丢失', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'volley',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '0',
                        value: 4,
                        face: 'taiji',
                        effectKey: 'bonusDie.effect.volley',
                    },
                    timestamp: 1100,
                },
            },
            {
                id: 3,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '0',
                        value: 3,
                        face: 'taiji',
                        effectKey: 'bonusDie.effect.volley',
                    },
                    timestamp: 1150,
                },
            },
            {
                id: 4,
                event: {
                    type: 'BONUS_DICE_REROLL_REQUESTED',
                    payload: {
                        settlement: {
                            id: 'settlement-1',
                            attackerId: '1',
                            dice: [
                                { index: 0, value: 4, face: 'taiji' },
                                { index: 1, value: 3, face: 'taiji' },
                            ],
                            rerollCount: 0,
                            displayOnly: true,
                        },
                    },
                    timestamp: 1200,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'moon-elf',
                },
            });

            return (
                <pre data-testid="spotlight-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                        bonusDie: state.bonusDie,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].bonusDice).toHaveLength(2);
            expect(state.cardSpotlightQueue[0].bonusDice[0].value).toBe(4);
            expect(state.cardSpotlightQueue[0].bonusDice[1].value).toBe(3);
            expect(state.bonusDie.show).toBe(false);
        });
    });

    it('自己打出的 Watch Out 单骰事件应显示独立骰子特写', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '0',
                        cardId: 'watch-out',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '0',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'bow',
                        effectKey: 'bonusDie.effect.watchOut',
                        effectParams: { value: 1 },
                    },
                    timestamp: 1100,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'moon_elf',
                    '1': 'barbarian',
                },
            });

            return (
                <pre data-testid="watch-out-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                        bonusDie: state.bonusDie,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('watch-out-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(0);
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(1);
            expect(state.bonusDie.face).toBe('bow');
            expect(state.bonusDie.effectKey).toBe('bonusDie.effect.watchOut');
        });
    });

    it('自己打出的 Get Fired Up 单骰事件也应显示独立骰子特写', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '0',
                        cardId: 'card-get-fired-up',
                    },
                    timestamp: 2000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '0',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'fire',
                        effectKey: 'bonusDie.effect.fire',
                    },
                    timestamp: 2100,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'pyromancer',
                    '1': 'barbarian',
                },
            });

            return (
                <pre data-testid="get-fired-up-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                        bonusDie: state.bonusDie,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('get-fired-up-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(0);
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(1);
            expect(state.bonusDie.face).toBe('fire');
            expect(state.bonusDie.effectKey).toBe('bonusDie.effect.fire');
        });
    });

    it('首次挂载后的短时间点击不应立刻关闭特写', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();

        render(
            <SpotlightContainer
                id="bonus-die-test"
                isVisible
                onClose={onClose}
                autoCloseDelay={10000}
            >
                <button type="button" data-testid="spotlight-content">关闭</button>
            </SpotlightContainer>
        );

        fireEvent.click(screen.getByTestId('spotlight-content'));
        expect(onClose).not.toHaveBeenCalled();

        vi.advanceTimersByTime(250);
        fireEvent.click(screen.getByTestId('spotlight-content'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
