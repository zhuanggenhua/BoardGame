/**
 * 大杀四方 - 机器人派系能力测试
 *
 * 覆盖：
 * - robot_microbot_reclaimer（微型机回收者：任意数量微型机洗回牌库，可跳过）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['robots', 'pirates'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [{ defId: 'test_base_1', minions: [], ongoingActions: [] }],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return makeMatchStateFromHelpers(core);
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

// ============================================================================
// robot_microbot_reclaimer（微型机回收者）
// ============================================================================

describe('robot_microbot_reclaimer（微型机回收者）', () => {
    it('弃牌堆有微型机时创建多选交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [
                        makeCard('mb1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('mb2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'r1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(result.success).toBe(true);
        const interaction = (result.finalState.sys as any)?.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data?.sourceId).toBe('robot_microbot_reclaimer');
    });

    it('交互 min=0 且包含跳过选项', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [makeCard('mb1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'r1', baseIndex: 0 },
        } as any, defaultRandom);
        const interaction = (result.finalState.sys as any)?.interaction?.current;
        expect(interaction?.data?.multi?.min).toBe(0);
        expect(interaction?.data?.options?.some((o: any) => o.id === 'skip')).toBe(true);
    });

    it('选跳过 → 弃牌堆不变', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [makeCard('mb1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const r1 = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'r1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(r1.success).toBe(true);

        // 解决交互：传空数组（跳过）
        const handler = getInteractionHandler('robot_microbot_reclaimer');
        expect(handler).toBeDefined();
        const result = handler!(r1.finalState, '0', [], undefined, defaultRandom, 1000);
        expect(result.events.length).toBe(0);
        // 弃牌堆中的微型机仍在
        expect(r1.finalState.core.players['0'].discard.some((c: CardInstance) => c.uid === 'mb1')).toBe(true);
    });

    it('选择微型机 → 洗回牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    deck: [makeCard('dk1', 'robot_zapbot', 'minion', '0')],
                    discard: [
                        makeCard('mb1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('mb2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const r1 = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'r1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(r1.success).toBe(true);

        const handler = getInteractionHandler('robot_microbot_reclaimer');
        expect(handler).toBeDefined();
        // 选择 mb1 洗回牌库
        const result = handler!(r1.finalState, '0', [{ cardUid: 'mb1' }], undefined, defaultRandom, 1000);
        const reorderEvents = result.events.filter((e: any) => e.type === SU_EVENTS.DECK_REORDERED);
        expect(reorderEvents.length).toBe(1);
        const deckUids = (reorderEvents[0] as any).payload.deckUids;
        expect(deckUids).toContain('mb1');
        expect(deckUids).toContain('dk1');
        // mb2 未选中，不在牌库中
        expect(deckUids).not.toContain('mb2');
    });

    it('弃牌堆无微型机时不创建交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [makeCard('a1', 'robot_zapbot', 'minion', '0')], // 非微型机
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'r1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(result.success).toBe(true);
        const interaction = (result.finalState.sys as any)?.interaction?.current;
        // 无微型机时不创建交互
        expect(interaction?.data?.sourceId).not.toBe('robot_microbot_reclaimer');
    });
});

// ============================================================================
// robot_microbot_fixer（微型机修理者）— onPlay 额外出牌
// ============================================================================

describe('robot_microbot_fixer（微型机修理者 onPlay）', () => {
    it('第一个随从打出时获得额外随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('f1', 'robot_microbot_fixer', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'f1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(result.success).toBe(true);
        // 第一个随从 → 额外出牌 → minionLimit 从 1 增加到 2
        expect(result.finalState.core.players['0'].minionLimit).toBe(2);
    });

    it('非第一个随从打出时不获得额外额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('f1', 'robot_microbot_fixer', 'minion', '0')],
                    minionsPlayed: 1, // 已打出过一个
                    minionLimit: 2,   // 有额外额度
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'f1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(result.success).toBe(true);
        // 非第一个随从 → 不额外出牌 → minionLimit 保持 2
        expect(result.finalState.core.players['0'].minionLimit).toBe(2);
    });
});

// ============================================================================
// robot_microbot_reclaimer — onPlay 额外出牌验证
// ============================================================================

describe('robot_microbot_reclaimer（微型机回收者 onPlay 额外出牌）', () => {
    it('第一个随从打出时获得额外随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    // 无微型机弃牌，不会创建交互，方便单独验证额外出牌
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'r1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(result.success).toBe(true);
        // 第一个随从 → 额外出牌 → minionLimit 从 1 增加到 2
        expect(result.finalState.core.players['0'].minionLimit).toBe(2);
    });

    it('非第一个随从打出时不获得额外额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 2,
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION, playerId: '0',
            payload: { cardUid: 'r1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(result.success).toBe(true);
        // 非第一个随从 → 不额外出牌 → minionLimit 保持 2
        expect(result.finalState.core.players['0'].minionLimit).toBe(2);
    });
});
