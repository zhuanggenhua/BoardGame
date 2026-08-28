import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import { useCardSpotlight } from '../hooks/useCardSpotlight';

function HookProbe({
    streamEntries,
    selectedCharacters = {
        '0': 'monk',
        '1': 'gunslinger',
    },
    cacheScope,
    suppressStandaloneBonusDie = false,
    suppressBonusDiceInCardSpotlight = false,
}: {
    streamEntries: EventStreamEntry[];
    selectedCharacters?: Record<string, any>;
    cacheScope?: string;
    suppressStandaloneBonusDie?: boolean;
    suppressBonusDiceInCardSpotlight?: boolean;
}) {
    const state = useCardSpotlight({
        eventStreamEntries: streamEntries,
        currentPlayerId: '0',
        opponentName: '对手',
        selectedCharacters,
        cacheScope,
        suppressStandaloneBonusDie,
        suppressBonusDiceInCardSpotlight,
    });

    return (
        <pre data-testid="rollback-card-spotlight-state">
            {JSON.stringify({
                cardSpotlightQueue: state.cardSpotlightQueue,
                bonusDie: state.bonusDie,
            })}
        </pre>
    );
}

function ToggleProbe({
    mounted,
    streamEntries,
    cacheScope,
}: {
    mounted: boolean;
    streamEntries: EventStreamEntry[];
    cacheScope?: string;
}) {
    return mounted ? <HookProbe streamEntries={streamEntries} cacheScope={cacheScope} /> : null;
}

describe('useCardSpotlight rollback consumer', () => {
    it('uses the card preview from the play event instead of recalculating by viewer state', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
                {children}
            </EventStreamRollbackContext.Provider>
        );

        const playedByGunslingerEntry: EventStreamEntry = {
            id: 1,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'card-next-time',
                    previewRef: {
                        type: 'atlas',
                        atlasId: 'dicethrone-gunslinger-cards',
                        index: 9,
                    },
                },
                timestamp: 1000,
            },
        };

        const view = render(
            <HookProbe
                streamEntries={[]}
                selectedCharacters={{
                    '0': 'monk',
                    // Simulates a stale or missing opponent hero mapping in PvP.
                    '1': 'monk',
                }}
            />,
            { wrapper },
        );

        view.rerender(
            <HookProbe
                streamEntries={[playedByGunslingerEntry]}
                selectedCharacters={{
                    '0': 'monk',
                    // Simulates a stale or missing opponent hero mapping in PvP.
                    '1': 'monk',
                }}
            />,
        );

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].previewRef).toEqual({
                type: 'atlas',
                atlasId: 'dicethrone-gunslinger-cards',
                index: 9,
            });
        });
    });

    it('keeps opponent card spotlight visible across optimistic rollback signal and does not replay restored old events', async () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={rollbackValue}>
                {children}
            </EventStreamRollbackContext.Provider>
        );

        const oldCardEntry: EventStreamEntry = {
            id: 1,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'card-next-time',
                },
                timestamp: 1000,
            },
        };

        const oldBonusEntry: EventStreamEntry = {
            id: 2,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '0',
                    targetPlayerId: '1',
                    value: 4,
                    face: 'sword',
                    effectKey: 'totalDamageContribution',
                    effectParams: { value: 4 },
                },
                timestamp: 1500,
            },
        };

        const newCardEntry: EventStreamEntry = {
            id: 3,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'watch-out',
                },
                timestamp: 3000,
            },
        };

        const newBonusEntry: EventStreamEntry = {
            id: 4,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '0',
                    targetPlayerId: '1',
                    value: 6,
                    face: 'crit',
                    effectKey: 'totalDamageContribution',
                    effectParams: { value: 6 },
                },
                timestamp: 4000,
            },
        };

        const view = render(<HookProbe streamEntries={[]} />, { wrapper });

        view.rerender(<HookProbe streamEntries={[oldCardEntry, oldBonusEntry]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-1000');
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(4);
        });

        rollbackValue = {
            watermark: null,
            seq: 1,
            reconcileSeq: 0,
        };

        view.rerender(<HookProbe streamEntries={[]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-1000');
            expect(state.bonusDie.show).toBe(false);
        });

        view.rerender(<HookProbe streamEntries={[oldCardEntry, oldBonusEntry]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-1000');
            expect(state.bonusDie.show).toBe(false);
        });

        view.rerender(<HookProbe streamEntries={[oldCardEntry, oldBonusEntry, newCardEntry, newBonusEntry]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(2);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-1000');
            expect(state.cardSpotlightQueue[1].id).toBe('watch-out-3000');
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(6);
        });
    });

    it('keeps an already visible opponent card spotlight when EventStream ids move backward', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
                {children}
            </EventStreamRollbackContext.Provider>
        );

        const visibleCardEntry: EventStreamEntry = {
            id: 10,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'card-next-time',
                },
                timestamp: 1000,
            },
        };

        const lowerWatermarkEntry: EventStreamEntry = {
            id: 2,
            event: {
                type: 'TURN_PHASE_CHANGED',
                payload: { phase: 'main' },
                timestamp: 2000,
            },
        };

        const view = render(<HookProbe streamEntries={[]} />, { wrapper });

        view.rerender(<HookProbe streamEntries={[visibleCardEntry]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-1000');
        });

        view.rerender(<HookProbe streamEntries={[lowerWatermarkEntry]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-1000');
        });
    });

    it('restores an explicitly unclosed opponent card spotlight after the hook remounts on sync', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
                {children}
            </EventStreamRollbackContext.Provider>
        );

        const playedCardEntry: EventStreamEntry = {
            id: 20,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'card-next-time',
                },
                timestamp: 9000,
            },
        };

        const cacheScope = 'remount-card-next-time';
        const firstView = render(<HookProbe streamEntries={[]} cacheScope={cacheScope} />, { wrapper });
        firstView.rerender(<HookProbe streamEntries={[playedCardEntry]} cacheScope={cacheScope} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-9000');
        });

        firstView.unmount();

        render(<HookProbe streamEntries={[playedCardEntry]} cacheScope={cacheScope} />, { wrapper });

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-9000');
        });
    });

    it('does not drop the unclosed cache when sync remounts with an empty EventStream before entries recover', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
                {children}
            </EventStreamRollbackContext.Provider>
        );

        const playedCardEntry: EventStreamEntry = {
            id: 30,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'watch-out',
                },
                timestamp: 11000,
            },
        };

        const cacheScope = 'empty-sync-watch-out';
        const view = render(<ToggleProbe mounted={true} streamEntries={[]} cacheScope={cacheScope} />, { wrapper });
        view.rerender(<ToggleProbe mounted={true} streamEntries={[playedCardEntry]} cacheScope={cacheScope} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('watch-out-11000');
        });

        view.rerender(<ToggleProbe mounted={false} streamEntries={[]} cacheScope={cacheScope} />);
        view.rerender(<ToggleProbe mounted={true} streamEntries={[]} cacheScope={cacheScope} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('watch-out-11000');
        });

        view.rerender(<ToggleProbe mounted={true} streamEntries={[playedCardEntry]} cacheScope={cacheScope} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('watch-out-11000');
        });
    });

    it('奖励骰路由到右侧骰盘时，对手分批骰事件不得再附加到中央卡牌特写', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
                {children}
            </EventStreamRollbackContext.Provider>
        );

        const cardEntry: EventStreamEntry = {
            id: 40,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'watch-out',
                    previewRef: {
                        type: 'atlas',
                        atlasId: 'dicethrone-moon_elf-cards',
                        index: 4,
                    },
                },
                timestamp: 4800,
            },
        };
        const firstBonusEntry: EventStreamEntry = {
            id: 41,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '1',
                    targetPlayerId: '0',
                    value: 1,
                    face: 'bow',
                    effectKey: 'bonusDie.effect.watchOut.bow',
                    effectParams: { value: 1, index: 0 },
                },
                timestamp: 5000,
            },
        };
        const secondBonusEntry: EventStreamEntry = {
            id: 42,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '1',
                    targetPlayerId: '0',
                    value: 2,
                    face: 'bow',
                    effectKey: 'bonusDie.effect.watchOut.bow',
                    effectParams: { value: 2, index: 1 },
                },
                timestamp: 5001,
            },
        };
        const summaryEntry: EventStreamEntry = {
            id: 43,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '1',
                    targetPlayerId: '0',
                    value: 2,
                    face: 'bow',
                    effectKey: 'bonusDie.effect.watchOut.result',
                    effectParams: { value: 2 },
                },
                timestamp: 5002,
            },
        };

        const view = render(
            <HookProbe
                streamEntries={[]}
                suppressStandaloneBonusDie
                suppressBonusDiceInCardSpotlight
            />,
            { wrapper },
        );
        view.rerender(
            <HookProbe
                streamEntries={[cardEntry]}
                suppressStandaloneBonusDie
                suppressBonusDiceInCardSpotlight
            />,
        );

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0]).toMatchObject({
                id: 'watch-out-4800',
                playerId: '1',
            });
            expect(state.bonusDie.show).toBe(false);
        });

        view.rerender(
            <HookProbe
                streamEntries={[cardEntry, firstBonusEntry, secondBonusEntry, summaryEntry]}
                suppressStandaloneBonusDie
                suppressBonusDiceInCardSpotlight
            />,
        );

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('watch-out-4800');
            expect(state.cardSpotlightQueue[0].bonusDice ?? []).toHaveLength(0);
            expect(state.cardSpotlightQueue[0].summaryText).toBeUndefined();
            expect(state.bonusDie.show).toBe(false);
        });
    });

    it('对手打出精力充沛并路由奖励骰时，卡牌特写仍保留给玩家阅读', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
                {children}
            </EventStreamRollbackContext.Provider>
        );
        const cardEntry: EventStreamEntry = {
            id: 50,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'card-energetic',
                    previewRef: {
                        type: 'atlas',
                        atlasId: 'dicethrone-barbarian-cards',
                        index: 1,
                    },
                },
                timestamp: 6000,
            },
        };
        const bonusEntry: EventStreamEntry = {
            id: 51,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '1',
                    targetPlayerId: '0',
                    value: 1,
                    face: 'strength',
                    effectKey: 'bonusDie.effect.energeticStrength',
                    effectParams: { value: 1, index: 0 },
                },
                timestamp: 6001,
            },
        };
        const settlementEntry: EventStreamEntry = {
            id: 52,
            event: {
                type: 'BONUS_DICE_REROLL_REQUESTED',
                payload: {
                    settlement: {
                        id: 'barbarian-energetic-6000',
                        sourceAbilityId: 'card-energetic',
                        attackerId: '1',
                        targetId: '0',
                        dice: [{ index: 0, value: 1, face: 'strength' }],
                        rerollCostTokenId: '',
                        rerollCostAmount: 0,
                        rerollCount: 0,
                        maxRerollCount: 0,
                        readyToSettle: false,
                        displayOnly: true,
                        allowDiceModification: true,
                    },
                },
                timestamp: 6001,
            },
        };

        const view = render(
            <HookProbe
                streamEntries={[]}
                selectedCharacters={{ '0': 'lieren', '1': 'barbarian' }}
                suppressStandaloneBonusDie
                suppressBonusDiceInCardSpotlight
            />,
            { wrapper },
        );
        view.rerender(
            <HookProbe
                streamEntries={[cardEntry, bonusEntry, settlementEntry]}
                selectedCharacters={{ '0': 'lieren', '1': 'barbarian' }}
                suppressStandaloneBonusDie
                suppressBonusDiceInCardSpotlight
            />,
        );

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0]).toMatchObject({
                id: 'card-energetic-6000',
                cardId: 'card-energetic',
                playerId: '1',
                previewRef: {
                    type: 'atlas',
                    atlasId: 'dicethrone-barbarian-cards',
                    index: 1,
                },
            });
            expect(state.cardSpotlightQueue[0].bonusDice ?? []).toHaveLength(0);
            expect(state.cardSpotlightQueue[0].summaryText).toBeUndefined();
            expect(state.bonusDie.show).toBe(false);
        });
    });

    it('自己打出会投奖励骰的卡时，只保留右侧骰盘，不再创建中央卡牌或奖励骰展示', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
                {children}
            </EventStreamRollbackContext.Provider>
        );
        const cardEntry: EventStreamEntry = {
            id: 50,
            event: {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-tianshi-supreme-holiness' },
                timestamp: 6000,
            },
        };
        const bonusEntry: EventStreamEntry = {
            id: 51,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '0',
                    targetPlayerId: '1',
                    value: 1,
                    face: 'blade',
                    effectKey: 'bonusDie.effect.tianshi.supremeHoliness',
                    effectParams: { value: 1, index: 0 },
                },
                timestamp: 6001,
            },
        };
        const settlementEntry: EventStreamEntry = {
            id: 52,
            event: {
                type: 'BONUS_DICE_REROLL_REQUESTED',
                payload: {
                    settlement: {
                        id: 'tianshi-supreme-holiness-6000',
                        sourceAbilityId: 'card-tianshi-supreme-holiness',
                        attackerId: '0',
                        targetId: '1',
                        dice: [{ index: 0, value: 1, face: 'blade' }],
                        rerollCostTokenId: '__tianshi_no_reroll__',
                        rerollCostAmount: 1,
                        rerollCount: 0,
                        maxRerollCount: 0,
                        readyToSettle: false,
                        displayOnly: true,
                        allowDiceModification: true,
                    },
                },
                timestamp: 6001,
            },
        };

        const view = render(
            <HookProbe
                streamEntries={[]}
                suppressStandaloneBonusDie
                suppressBonusDiceInCardSpotlight
            />,
            { wrapper },
        );
        view.rerender(
            <HookProbe
                streamEntries={[cardEntry, bonusEntry, settlementEntry]}
                suppressStandaloneBonusDie
                suppressBonusDiceInCardSpotlight
            />,
        );

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toEqual([]);
            expect(state.bonusDie.show).toBe(false);
        });
    });
});
