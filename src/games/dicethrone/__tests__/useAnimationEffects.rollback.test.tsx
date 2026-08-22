import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import type { FxBus } from '../../../engine/fx';
import { useAnimationEffects } from '../hooks/useAnimationEffects';
import type { UseVisualStateBufferReturn } from '../../../components/game/framework/hooks/useVisualStateBuffer';

function HookProbe({
    entries,
    fxBus,
    selfHp = 20,
    opponentHp = 20,
    onBuffer,
}: {
    entries: EventStreamEntry[];
    fxBus: FxBus;
    selfHp?: number;
    opponentHp?: number;
    onBuffer?: (buffer: UseVisualStateBufferReturn) => void;
}) {
    const selfHpRef = React.useRef<HTMLDivElement | null>(null);
    const opponentHpRef = React.useRef<HTMLDivElement | null>(null);
    const selfCpRef = React.useRef<HTMLDivElement | null>(null);
    const opponentCpRef = React.useRef<HTMLDivElement | null>(null);
    const selfBuffRef = React.useRef<HTMLDivElement | null>(null);
    const opponentBuffRef = React.useRef<HTMLDivElement | null>(null);
    const opponentHeaderRef = React.useRef<HTMLDivElement | null>(null);

    const { damageBuffer } = useAnimationEffects({
        fxBus,
        players: {
            player: {
                resources: { hp: selfHp },
                abilities: [],
                statusEffects: {},
                tokens: {},
            } as any,
            opponent: {
                resources: { hp: opponentHp },
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

    React.useEffect(() => {
        onBuffer?.(damageBuffer);
    }, [damageBuffer, onBuffer]);

    return (
        <div>
            <div data-testid="visual-self-hp">{damageBuffer.get('hp-0', selfHp)}</div>
            <div data-testid="visual-opponent-hp">{damageBuffer.get('hp-1', opponentHp)}</div>
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

    it('wait-confirm 确认同步后应消费新伤害事件，并直接按 reducer 回填的净掉血播放浮字', async () => {
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
                    actualDamage: 2,
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

    it('正式 HP 先同步到 core，动画期间只冻结显示值，impact 后回到正式 HP', async () => {
        const fxBus = {
            push: vi.fn(() => 'fx-1'),
        } as unknown as FxBus;
        let latestBuffer: UseVisualStateBufferReturn | null = null;

        const damageEntry: EventStreamEntry = {
            id: 1,
            event: {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '0',
                    amount: 5,
                    actualDamage: 2,
                    sourceAbilityId: 'test-attack',
                },
                timestamp: 1000,
            },
        };

        const view = render(
            <HookProbe
                entries={[]}
                fxBus={fxBus}
                selfHp={20}
                onBuffer={(buffer) => {
                    latestBuffer = buffer;
                }}
            />,
        );

        view.rerender(
            <HookProbe
                entries={[damageEntry]}
                fxBus={fxBus}
                selfHp={18}
                onBuffer={(buffer) => {
                    latestBuffer = buffer;
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('visual-self-hp').textContent).toBe('20');
        });

        expect(fxBus.push).toHaveBeenCalledWith(
            'fx.damage',
            {},
            expect.objectContaining({ damage: 2 }),
        );

        act(() => {
            latestBuffer?.release(['hp-0']);
        });

        await waitFor(() => {
            expect(screen.getByTestId('visual-self-hp').textContent).toBe('18');
        });
    });

    it('首次可见时已有伤害事件，也应作为必播动画消费', async () => {
        const fxBus = {
            push: vi.fn(() => 'fx-1'),
        } as unknown as FxBus;

        const damageEntry: EventStreamEntry = {
            id: 7,
            event: {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '1',
                    amount: 3,
                    actualDamage: 2,
                    sourceAbilityId: 'pickpocket',
                },
                timestamp: 1000,
            },
        };

        render(
            <HookProbe
                entries={[damageEntry]}
                fxBus={fxBus}
                opponentHp={47}
            />,
        );

        await waitFor(() => {
            expect(fxBus.push).toHaveBeenCalledTimes(1);
        });
        expect(fxBus.push).toHaveBeenCalledWith(
            'fx.damage',
            {},
            expect.objectContaining({ damage: 2 }),
        );
    });

    it('FX 没有成功入队时应立即释放 HP 冻结，避免血量 UI 卡在旧值', async () => {
        const fxBus = {
            push: vi.fn(() => null),
        } as unknown as FxBus;

        const damageEntry: EventStreamEntry = {
            id: 1,
            event: {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '1',
                    amount: 3,
                    actualDamage: 2,
                    sourceAbilityId: 'pickpocket',
                },
                timestamp: 1000,
            },
        };

        const view = render(
            <HookProbe
                entries={[]}
                fxBus={fxBus}
                opponentHp={49}
            />,
        );

        view.rerender(
            <HookProbe
                entries={[damageEntry]}
                fxBus={fxBus}
                opponentHp={47}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('visual-opponent-hp').textContent).toBe('47');
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
