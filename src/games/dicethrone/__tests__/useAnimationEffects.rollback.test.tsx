import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import type { FxBus } from '../../../engine/fx';
import { useAnimationEffects } from '../hooks/useAnimationEffects';

function HookProbe({
    entries,
    fxBus,
}: {
    entries: EventStreamEntry[];
    fxBus: FxBus;
}) {
    const selfHpRef = React.useRef<HTMLDivElement | null>(null);
    const opponentHpRef = React.useRef<HTMLDivElement | null>(null);
    const selfCpRef = React.useRef<HTMLDivElement | null>(null);
    const opponentCpRef = React.useRef<HTMLDivElement | null>(null);
    const selfBuffRef = React.useRef<HTMLDivElement | null>(null);
    const opponentBuffRef = React.useRef<HTMLDivElement | null>(null);
    const opponentHeaderRef = React.useRef<HTMLDivElement | null>(null);

    useAnimationEffects({
        fxBus,
        players: {
            player: {
                resources: { hp: 20 },
                abilities: [],
                statusEffects: {},
                tokens: {},
            } as any,
            opponent: {
                resources: { hp: 20 },
                abilities: [],
                statusEffects: {},
                tokens: {},
            } as any,
        },
        currentPlayerId: '0',
        opponentId: '1',
        refs: {
            opponentHp: opponentHpRef,
            selfHp: selfHpRef,
            opponentCp: opponentCpRef,
            selfCp: selfCpRef,
            opponentBuff: opponentBuffRef,
            selfBuff: selfBuffRef,
            opponentHeader: opponentHeaderRef,
        },
        getEffectStartPos: () => ({ x: 0, y: 0 }),
        getAbilityStartPos: () => ({ x: 0, y: 0 }),
        locale: 'zh-CN',
        statusIconAtlas: null,
        eventStreamEntries: entries,
    });

    return (
        <div>
            <div ref={selfHpRef} data-testid="self-hp" />
            <div ref={opponentHpRef} data-testid="opponent-hp" />
            <div ref={selfCpRef} data-testid="self-cp" />
            <div ref={opponentCpRef} data-testid="opponent-cp" />
            <div ref={selfBuffRef} data-testid="self-buff" />
            <div ref={opponentBuffRef} data-testid="opponent-buff" />
            <div ref={opponentHeaderRef} data-testid="opponent-header" />
        </div>
    );
}

describe('useAnimationEffects rollback consumer', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('wait-confirm 确认同步后应消费新伤害事件，并按护盾后净伤害播放浮字', async () => {
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

        const fxBus = {
            push: vi.fn(() => 'fx-1'),
        } as unknown as FxBus;

        const oldEntry: EventStreamEntry = {
            id: 1,
            event: {
                type: 'CHOICE_RESOLVED',
                payload: {},
                timestamp: 1000,
            },
        };
        const duelHalfDamageEntry: EventStreamEntry = {
            id: 2,
            event: {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '0',
                    amount: 5,
                    actualDamage: 5,
                    shieldsConsumed: [{ sourceId: 'duel', reductionPercent: 50, absorbed: 3 }],
                    sourceAbilityId: 'harmony',
                },
                timestamp: 2000,
            },
        };

        const view = render(<HookProbe entries={[oldEntry]} fxBus={fxBus} />, { wrapper });

        await waitFor(() => {
            expect(fxBus.push).not.toHaveBeenCalled();
        });

        rollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 1,
        };

        view.rerender(<HookProbe entries={[oldEntry, duelHalfDamageEntry]} fxBus={fxBus} />);

        await waitFor(() => {
            expect(fxBus.push).toHaveBeenCalledTimes(1);
        });
        expect(fxBus.push).toHaveBeenCalledWith(
            'fx.damage',
            {},
            expect.objectContaining({ damage: 2 }),
        );
    });

    it('optimistic rollback 后应清空旧动画队列，并且恢复旧事件时不重播，只消费新的后续事件', async () => {
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

        const fxBus = {
            push: vi.fn(() => 'fx-1'),
        } as unknown as FxBus;

        const oldDamageEntry: EventStreamEntry = {
            id: 1,
            event: {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '1',
                    actualDamage: 3,
                    shieldsConsumed: [],
                    sourceAbilityId: 'test-fireball',
                },
                timestamp: 1000,
            },
        };

        const newDamageEntry: EventStreamEntry = {
            id: 2,
            event: {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '1',
                    actualDamage: 5,
                    shieldsConsumed: [],
                    sourceAbilityId: 'test-icebolt',
                },
                timestamp: 2000,
            },
        };

        const view = render(<HookProbe entries={[]} fxBus={fxBus} />, { wrapper });

        view.rerender(<HookProbe entries={[oldDamageEntry]} fxBus={fxBus} />);

        await waitFor(() => {
            expect(fxBus.push).toHaveBeenCalledTimes(1);
        });

        rollbackValue = {
            watermark: null,
            seq: 1,
            reconcileSeq: 0,
        };

        view.rerender(<HookProbe entries={[]} fxBus={fxBus} />);

        await waitFor(() => {
            expect(fxBus.push).toHaveBeenCalledTimes(1);
        });

        view.rerender(<HookProbe entries={[oldDamageEntry]} fxBus={fxBus} />);

        await waitFor(() => {
            expect(fxBus.push).toHaveBeenCalledTimes(1);
        });

        view.rerender(<HookProbe entries={[oldDamageEntry, newDamageEntry]} fxBus={fxBus} />);

        await waitFor(() => {
            expect(fxBus.push).toHaveBeenCalledTimes(2);
        });
    });
});
