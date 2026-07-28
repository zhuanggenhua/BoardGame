import { describe, expect, it } from 'vitest';
import { createInteractionSystem, createSimpleChoice } from '../../systems/InteractionSystem';
import { applyPlayerViewToState } from '../playerView';
import type { GameEngineConfig } from '../../transport/server';
import type { MatchState } from '../../types';
import { SmashUpDomain } from '../../../games/smashup/domain';
import { normalizeSmashUpMatchStateForUi } from '../../../games/smashup/ui/normalizeRuntimeState';

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

const smashUpEngineConfig: GameEngineConfig = {
    gameId: 'smashup',
    domain: {
        gameId: 'smashup',
        setup: () => ({ turnOrder: ['0', '1'] }),
        normalizeRuntimeState: (state) => normalizeSmashUpMatchStateForUi(state),
        validate: () => ({ valid: true }),
        execute: () => [],
        reduce: (state) => state,
    },
    systems: [],
};

const smashUpPrivacyEngineConfig: GameEngineConfig = {
    gameId: 'smashup',
    domain: SmashUpDomain as any,
    systems: [],
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

    it('SmashUp 视图应先规范化 runtime-guard 脏态，避免把 null 数组和旧对象型 madnessDeck 继续下发', () => {
        const authoritativeState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
                currentPlayerIndex: 0,
                turnOrder: ['0', '1'],
                turnNumber: 3,
                nextUid: 5,
                players: {
                    '0': {
                        id: '0',
                        hand: [],
                        deck: [],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        pendingMinionPlayEffects: null,
                        usedDiscardPlayAbilities: null,
                    },
                    '1': {
                        id: '1',
                        hand: [],
                        deck: [],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                    },
                },
                bases: [
                    {
                        defId: 'base_tortuga',
                        minions: [],
                        ongoingActions: [],
                        buriedCards: null,
                    },
                ],
                baseDeck: [],
                baseDiscard: [],
                madnessDeck: [
                    { uid: 'mad-1', defId: 'special_madness', type: 'action', owner: '0' },
                    { uid: 'mad-2', defId: 'special_madness', type: 'action', owner: '0' },
                ],
            },
            sys: {
                phase: 'playCards',
                turnNumber: 3,
                eventStream: { entries: [], nextId: 1 },
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined },
            },
        } as MatchState<unknown>;

        const ownerView = applyPlayerViewToState(smashUpEngineConfig, authoritativeState, '0') as any;
        const spectatorView = applyPlayerViewToState(smashUpEngineConfig, authoritativeState, null) as any;

        expect(ownerView.core.players['0'].pendingMinionPlayEffects).toEqual([]);
        expect(ownerView.core.players['0'].usedDiscardPlayAbilities).toBeUndefined();
        expect(ownerView.core.bases[0].buriedCards).toEqual([]);
        expect(ownerView.core.madnessDeck).toEqual(['special_madness', 'special_madness']);

        expect(spectatorView.core.players['0'].pendingMinionPlayEffects).toEqual([]);
        expect(spectatorView.core.players['0'].usedDiscardPlayAbilities).toBeUndefined();
        expect(spectatorView.core.bases[0].buriedCards).toEqual([]);
        expect(spectatorView.core.madnessDeck).toEqual(['special_madness', 'special_madness']);
    });

    it('SmashUp 玩家视图浅合并后不应泄露对手手牌和牌库内容', () => {
        const authoritativeState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
                currentPlayerIndex: 0,
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 10,
                players: {
                    '0': {
                        id: '0',
                        hand: [{ uid: 'p0-hand-a', defId: 'pirate_first_mate', type: 'minion', owner: '0' }],
                        deck: [{ uid: 'p0-deck-a', defId: 'pirate_full_sail', type: 'action', owner: '0' }],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['pirates', 'aliens'],
                    },
                    '1': {
                        id: '1',
                        hand: [{ uid: 'p1-secret-hand', defId: 'alien_probe', type: 'action', owner: '1' }],
                        deck: [{ uid: 'p1-secret-topdeck', defId: 'alien_invader', type: 'minion', owner: '1' }],
                        discard: [{ uid: 'p1-public-discard', defId: 'alien_scout', type: 'minion', owner: '1' }],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['pirates', 'aliens'],
                    },
                },
                bases: [{ defId: 'base_tortuga', minions: [], ongoingActions: [] }],
                baseDeck: [],
                baseDiscard: [],
            },
            sys: {
                phase: 'playCards',
                turnNumber: 1,
                eventStream: { entries: [], nextId: 1 },
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined },
            },
        } as MatchState<unknown>;

        const playerView = applyPlayerViewToState(smashUpPrivacyEngineConfig, authoritativeState, '0') as any;

        expect(playerView.core.players['0'].hand[0]).toEqual(expect.objectContaining({
            uid: 'p0-hand-a',
            defId: 'pirate_first_mate',
        }));
        expect(playerView.core.players['1'].hand).toEqual([
            expect.objectContaining({ uid: 'hidden_1_hand_0', defId: 'hidden_private_card' }),
        ]);
        expect(playerView.core.players['1'].deck).toEqual([
            expect.objectContaining({ uid: 'hidden_1_deck_0', defId: 'hidden_private_card' }),
        ]);
        expect(playerView.core.players['1'].discard[0]).toEqual(expect.objectContaining({
            uid: 'p1-public-discard',
            defId: 'alien_scout',
        }));
    });
});
