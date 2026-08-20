import { describe, expect, it } from 'vitest';
import { createInteractionSystem, createSimpleChoice } from '../../systems/InteractionSystem';
import { applyPlayerViewToState } from '../playerView';
import type { GameEngineConfig } from '../../transport/engineConfig';
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
    systems: [createInteractionSystem()],
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

    it('spectator 视角不应直接看到 owner-only current 与 queue 交互', () => {
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

        const spectatorView = applyPlayerViewToState(engineConfig, authoritativeState, null) as any;

        expect(spectatorView.sys.interaction.current).toBeUndefined();
        expect(spectatorView.sys.interaction.queue).toEqual([]);
        expect(spectatorView.sys.interaction.isBlocked).toBe(true);
    });

    it('deep-clones nested data for custom owner-only interaction kinds', () => {
        const authoritativeState: MatchState<{ hp: number }> = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: {
                        id: 'test-card-interaction',
                        kind: 'test:card-interaction',
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

        expect(ownerView.sys.interaction.current.id).toBe('test-card-interaction');
        expect(otherView.sys.interaction.current).toBeUndefined();

        ownerView.sys.interaction.current.data.cards[0].tags[0] = 'mutated-tag';
        ownerView.sys.interaction.current.data.meta.source.nested.amount = 99;

        expect(authoritativeState.sys.interaction.current.data.cards[0].tags[0]).toBe('attack');
        expect(authoritativeState.sys.interaction.current.data.meta.source.nested.amount).toBe(2);
    });
});
