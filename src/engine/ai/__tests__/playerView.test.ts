import { describe, expect, it } from 'vitest';
import { createCompareRollChoice, createInteractionSystem, createSimpleChoice } from '../../systems/InteractionSystem';
import { createResponseWindow, createResponseWindowSystem } from '../../systems/ResponseWindowSystem';
import { applyPlayerViewToState } from '../playerView';
import type { GameEngineConfig } from '../../transport/server';
import type { MatchState } from '../../types';

const engineConfig: GameEngineConfig = {
    gameId: 'test-player-view',
    domain: {
        gameId: 'test-player-view',
        setup: () => ({ hp: 0 }),
        validate: () => ({ valid: true }),
        execute: () => [],
        reduce: (state) => state,
    },
    systems: [createInteractionSystem(), createResponseWindowSystem()],
};

describe('applyPlayerViewToState', () => {
    it('returns isolated seat snapshots for owner-only current and queue interactions', () => {
        const authoritativeState: MatchState<{ hp: number }> = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: createSimpleChoice(
                        'owner-current',
                        '0',
                        '选择要弃掉的手牌',
                        [{ id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' } }],
                        { sourceId: 'super_spies_secret_agent_discard', targetType: 'hand' },
                    ),
                    queue: [
                        createSimpleChoice(
                            'owner-queued',
                            '0',
                            '继续选择要弃掉的手牌',
                            [{ id: 'hand-b', label: '手牌 B', value: { cardUid: 'hand-b' } }],
                            { sourceId: 'super_spies_secret_agent_discard_queue', targetType: 'hand' },
                        ),
                    ],
                    isBlocked: false,
                },
            },
        } as MatchState<{ hp: number }>;

        const ownerView = applyPlayerViewToState(engineConfig, authoritativeState, '0') as any;
        const otherView = applyPlayerViewToState(engineConfig, authoritativeState, '1') as any;

        expect(ownerView.sys.interaction.current.id).toBe('owner-current');
        expect(ownerView.sys.interaction.queue).toHaveLength(1);
        expect(ownerView.sys.interaction.queue[0].id).toBe('owner-queued');
        expect(otherView.sys.interaction.current).toBeUndefined();
        expect(otherView.sys.interaction.queue).toEqual([]);

        ownerView.sys.interaction.queue[0].data.title = 'mutated-owner-queue';
        ownerView.sys.interaction.current.data.title = 'mutated-owner-current';

        expect(authoritativeState.sys.interaction.current.data.title).toBe('选择要弃掉的手牌');
        expect(authoritativeState.sys.interaction.queue[0].data.title).toBe('继续选择要弃掉的手牌');
        expect(otherView.sys.interaction.queue).toEqual([]);
    });

    it('deep-clones nested data for custom owner-only interaction kinds', () => {
        const authoritativeState: MatchState<{ hp: number }> = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: {
                        id: 'dt-card-interaction',
                        kind: 'dt:card-interaction',
                        playerId: '0',
                        data: {
                            title: '选择一张卡牌',
                            cards: [
                                { cardId: 'c1', tags: ['attack', 'bonus'] },
                                { cardId: 'c2', tags: ['defense'] },
                            ],
                            meta: {
                                source: { cardId: 'src-1', nested: { amount: 2 } },
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            },
        } as MatchState<{ hp: number }>;

        const ownerView = applyPlayerViewToState(engineConfig, authoritativeState, '0') as any;
        const otherView = applyPlayerViewToState(engineConfig, authoritativeState, '1') as any;

        expect(ownerView.sys.interaction.current.id).toBe('dt-card-interaction');
        expect(otherView.sys.interaction.current).toBeUndefined();

        ownerView.sys.interaction.current.data.cards[0].tags[0] = 'mutated-tag';
        ownerView.sys.interaction.current.data.meta.source.nested.amount = 99;

        expect(authoritativeState.sys.interaction.current.data.cards[0].tags[0]).toBe('attack');
        expect(authoritativeState.sys.interaction.current.data.meta.source.nested.amount).toBe(2);
    });

    it('only exposes compare-roll-choice as the non-owner interaction visibility exception', () => {
        const authoritativeState: MatchState<{ hp: number }> = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: createCompareRollChoice(
                        'shared-compare-roll-current',
                        '0',
                        {
                            title: '对比掷骰',
                            sourceId: 'duel-current',
                            contestants: [
                                { playerId: '0', label: 'P0', roll: 5 },
                                { playerId: '1', label: 'P1', roll: 3 },
                            ],
                            options: [
                                { id: 'resolve', label: '继续', value: { kind: 'confirm' } },
                            ],
                        },
                    ),
                    queue: [
                        {
                            id: 'owner-only-custom',
                            kind: 'dt:bonus-dice',
                            playerId: '0',
                            data: {
                                title: '奖励骰',
                                contestants: [
                                    { playerId: '0', label: 'fake-visible', roll: 99 },
                                    { playerId: '1', label: 'fake-visible', roll: 1 },
                                ],
                            },
                        },
                        createCompareRollChoice(
                            'shared-compare-roll-queued',
                            '0',
                            {
                                title: '第二次对比',
                                sourceId: 'duel-queued',
                                contestants: [
                                    { playerId: '0', label: 'P0', roll: 2 },
                                    { playerId: '1', label: 'P1', roll: 6 },
                                ],
                                options: [
                                    { id: 'queued-resolve', label: '继续', value: { kind: 'confirm' } },
                                ],
                            },
                        ),
                    ],
                    isBlocked: false,
                },
            },
        } as MatchState<{ hp: number }>;

        const opponentView = applyPlayerViewToState(engineConfig, authoritativeState, '1') as any;
        const spectatorView = applyPlayerViewToState(engineConfig, authoritativeState, '2') as any;

        expect(opponentView.sys.interaction.current.id).toBe('shared-compare-roll-current');
        expect(opponentView.sys.interaction.queue).toHaveLength(1);
        expect(opponentView.sys.interaction.queue[0].id).toBe('shared-compare-roll-queued');
        expect(opponentView.sys.interaction.queue[0].kind).toBe('compare-roll-choice');
        expect(spectatorView.sys.interaction.current).toBeUndefined();
        expect(spectatorView.sys.interaction.queue).toEqual([]);

        opponentView.sys.interaction.current.data.contestants[0].roll = 42;
        opponentView.sys.interaction.queue[0].data.contestants[1].roll = 77;

        expect((authoritativeState.sys.interaction.current as any).data.contestants[0].roll).toBe(5);
        expect((authoritativeState.sys.interaction.queue[1] as any).data.contestants[1].roll).toBe(6);
        expect((authoritativeState.sys.interaction.queue[0] as any).data.title).toBe('奖励骰');
    });

    it('returns isolated response-window snapshots without leaking mutations back to authoritative state', () => {
        const authoritativeState: MatchState<{ hp: number }> = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: createResponseWindow(
                        'rw-owner-only-1',
                        ['0', '1'],
                        'beforeScoring',
                        'secret-volcano',
                    ),
                },
            },
        } as MatchState<{ hp: number }>;

        const ownerView = applyPlayerViewToState(engineConfig, authoritativeState, '0') as any;
        const otherView = applyPlayerViewToState(engineConfig, authoritativeState, '1') as any;

        expect(ownerView.sys.responseWindow.current.windowType).toBe('beforeScoring');
        expect(otherView.sys.responseWindow.current.windowType).toBe('beforeScoring');
        expect(ownerView.sys.responseWindow.current.responderQueue).toEqual(['0', '1']);
        expect(otherView.sys.responseWindow.current.responderQueue).toEqual(['0', '1']);

        ownerView.sys.responseWindow.current.sourceId = 'mutated-source';
        ownerView.sys.responseWindow.current.responderQueue[0] = 'mutated-owner';
        otherView.sys.responseWindow.current.responderQueue[1] = 'mutated-other';

        expect(authoritativeState.sys.responseWindow.current.sourceId).toBe('secret-volcano');
        expect(authoritativeState.sys.responseWindow.current.responderQueue).toEqual(['0', '1']);
        expect(ownerView.sys.responseWindow.current.responderQueue).toEqual(['mutated-owner', '1']);
        expect(otherView.sys.responseWindow.current.responderQueue).toEqual(['0', 'mutated-other']);
    });
});
