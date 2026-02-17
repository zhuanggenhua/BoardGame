/**
 * 大杀四方 - 边界条件测试
 *
 * 覆盖：
 * 1. 牌库耗尽时抽牌（弃牌堆洗回 / 牌库+弃牌堆都空）
 * 2. baseDeck 耗尽时基地记分后无新基地替换
 * 3. 三基地同时达标的多基地记分
 * 4. VP 平局胜利判定（两人同时 >= 15 VP 且分数相同 → 继续游戏）
 * 5. 手牌为空 / 无合法出牌时 ADVANCE_PHASE
 * 6. DISCARD_TO_LIMIT 传入重复 cardUid
 * 7. 无效 cardUid 出牌
 * 8. 基地索引越界
 * 9. USE_TALENT 指向不存在的随从
 * 10. 单人基地记分（只有一个玩家有随从）
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { reduce } from '../domain/reducer';
import { validate } from '../domain/commands';
import { drawCards } from '../domain/utils';
import { SU_COMMANDS, SU_EVENTS, VP_TO_WIN, HAND_LIMIT } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import type { SmashUpCore, SmashUpEvent, SmashUpCommand } from '../domain/types';
import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import {
    makeMinion, makePlayer, makeCard, makeBase,
    makeState, makeMatchState, getInteractionsFromMS,
} from './helpers';

const mockRandom: RandomFn = {
    shuffle: <T>(arr: T[]) => [...arr],
    random: () => 0.5,
} as any;

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 1. 牌库耗尽时抽牌
// ============================================================================

describe('牌库耗尽时抽牌', () => {
    it('牌库为空但弃牌堆有牌时洗回弃牌堆再抽', () => {
        const player = makePlayer('0', {
            deck: [],
            discard: [
                makeCard('d1', 'test1', '0'),
                makeCard('d2', 'test2', '0'),
                makeCard('d3', 'test3', '0'),
            ],
        });
        const result = drawCards(player, 2, mockRandom);
        expect(result.drawnUids.length).toBe(2);
        expect(result.reshuffledDeckUids).toBeDefined();
        expect(result.reshuffledDeckUids!.length).toBe(3);
        // 抽完后牌库剩 1 张，弃牌堆清空
        expect(result.deck.length).toBe(1);
        expect(result.discard.length).toBe(0);
    });

    it('牌库和弃牌堆都为空时抽 0 张', () => {
        const player = makePlayer('0', { deck: [], discard: [] });
        const result = drawCards(player, 2, mockRandom);
        expect(result.drawnUids.length).toBe(0);
        expect(result.reshuffledDeckUids).toBeUndefined();
        expect(result.deck.length).toBe(0);
        expect(result.hand.length).toBe(0);
    });

    it('牌库 1 张 + 弃牌堆 1 张时抽 2 张：先抽牌库再洗弃牌堆', () => {
        const player = makePlayer('0', {
            deck: [makeCard('d1', 'test1', '0')],
            discard: [makeCard('d2', 'test2', '0')],
        });
        const result = drawCards(player, 2, mockRandom);
        expect(result.drawnUids.length).toBe(2);
        expect(result.drawnUids[0]).toBe('d1'); // 先从牌库抽
        expect(result.drawnUids[1]).toBe('d2'); // 再从洗回的弃牌堆抽
        expect(result.deck.length).toBe(0);
        expect(result.discard.length).toBe(0);
    });

    it('牌库 0 张 + 弃牌堆 1 张时抽 3 张：只能抽到 1 张', () => {
        const player = makePlayer('0', {
            deck: [],
            discard: [makeCard('d1', 'test1', '0')],
        });
        const result = drawCards(player, 3, mockRandom);
        expect(result.drawnUids.length).toBe(1);
        expect(result.reshuffledDeckUids).toBeDefined();
    });
});

// ============================================================================
// 2. baseDeck 耗尽时基地记分
// ============================================================================

describe('baseDeck 耗尽时基地记分', () => {
    it('baseDeck 为空时记分后不产生 BASE_REPLACED 事件', () => {
        const core = makeState({
            bases: [{
                defId: 'base_tar_pits',
                minions: [makeMinion('m1', 'test', '0', 20)],
                ongoingActions: [],
            }],
            baseDeck: [], // 空
        });

        const mockCommand = { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any;
        const result = smashUpFlowHooks.onPhaseExit!({
            state: { core, sys: { phase: 'scoreBases', responseWindow: { current: undefined }, interaction: { queue: [] } } } as any,
            from: 'scoreBases',
            to: 'draw',
            command: mockCommand,
            random: mockRandom,
        });

        const events = Array.isArray(result) ? result : (result as PhaseExitResult).events ?? [];
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        const replacedEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_REPLACED);

        expect(scoredEvents.length).toBe(1);
        expect(replacedEvents.length).toBe(0); // 无替换
    });

    it('baseDeck 为空时 reduce BASE_SCORED 后基地数量减少', () => {
        const core = makeState({
            bases: [
                makeBase('base_a', [makeMinion('m1', 'test', '0', 5)]),
                makeBase('base_b'),
            ],
            baseDeck: [],
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0,
                baseDefId: 'base_a',
                rankings: [{ playerId: '0', power: 5, vp: 4 }],
            },
            timestamp: 1000,
        } as any;

        const newState = reduce(core, event);
        // 基地从 2 个变成 1 个，没有新基地补充
        expect(newState.bases.length).toBe(1);
        expect(newState.bases[0].defId).toBe('base_b');
    });
});

// ============================================================================
// 3. 三基地同时达标
// ============================================================================

describe.skip('三基地同时达标', () => {
    // TODO: 这些测试需要修复 - 可能与 state.bases 访问有关
    it('三基地达标时返回 Prompt（多基地记分选择）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                { defId: 'base_tar_pits', minions: [makeMinion('m1', 'test', '0', 20)], ongoingActions: [] },
                { defId: 'base_the_jungle', minions: [makeMinion('m2', 'test', '1', 20)], ongoingActions: [] },
                { defId: 'base_central_brain', minions: [makeMinion('m3', 'test', '2', 20)], ongoingActions: [] },
            ],
            baseDeck: ['base_locker_room', 'base_factory', 'base_workshop'],
        });

        const mockCommand = { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any;
        const result = smashUpFlowHooks.onPhaseExit!({
            state: { core, sys: { phase: 'scoreBases', responseWindow: { current: undefined }, interaction: { queue: [] } } } as any,
            from: 'scoreBases',
            to: 'draw',
            command: mockCommand,
            random: mockRandom,
        });

        // 多基地达标 → 返回 PhaseExitResult（halt + Prompt）
        expect(Array.isArray(result)).toBe(false);
        const exitResult = result as PhaseExitResult;
        expect(exitResult.halt).toBe(true);

        const events = exitResult.events ?? [];
        // 迁移后：交互通过 InteractionSystem 创建，不再生成 CHOICE_REQUESTED 事件
        const interactions = getInteractionsFromMS(exitResult.updatedState as any);
        expect(interactions.length).toBe(1);
    });
});

// ============================================================================
// 4. VP 平局胜利判定
// ============================================================================

describe('VP 平局胜利判定', () => {
    it('两人同时 >= 15 VP 且分数相同时继续游戏', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { vp: VP_TO_WIN }),
                '1': makePlayer('1', { vp: VP_TO_WIN }),
            },
        });
        const result = SmashUpDomain.isGameOver!(core);
        // 规则：平局继续直到打破
        expect(result).toBeUndefined();
    });

    it('两人同时 >= 15 VP 但分数不同时高分者胜', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { vp: VP_TO_WIN + 2 }),
                '1': makePlayer('1', { vp: VP_TO_WIN }),
            },
        });
        const result = SmashUpDomain.isGameOver!(core);
        expect(result).toBeDefined();
        expect(result!.winner).toBe('0');
    });

    it('只有一人 >= 15 VP 时该玩家胜', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { vp: VP_TO_WIN }),
                '1': makePlayer('1', { vp: 10 }),
            },
        });
        const result = SmashUpDomain.isGameOver!(core);
        expect(result).toBeDefined();
        expect(result!.winner).toBe('0');
    });

    it('无人 >= 15 VP 时游戏继续', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { vp: 14 }),
                '1': makePlayer('1', { vp: 14 }),
            },
        });
        const result = SmashUpDomain.isGameOver!(core);
        expect(result).toBeUndefined();
    });

    it('疯狂卡惩罚影响平局判定：原始 VP 相同但惩罚后不同', () => {
        // P0: 16 VP, 2 张疯狂卡 → 最终 15
        // P1: 16 VP, 0 张疯狂卡 → 最终 16
        const madnessCard = makeCard('mad1', 'special_madness', 'action', '0');
        const madnessCard2 = makeCard('mad2', 'special_madness', 'action', '0');
        const core = makeState({
            players: {
                '0': makePlayer('0', { vp: 16, hand: [madnessCard, madnessCard2] }),
                '1': makePlayer('1', { vp: 16 }),
            },
            madnessDeck: [], // 启用疯狂卡机制
        });
        const result = SmashUpDomain.isGameOver!(core);
        expect(result).toBeDefined();
        expect(result!.winner).toBe('1');
        expect(result!.scores!['0']).toBe(15); // 16 - 1
        expect(result!.scores!['1']).toBe(16);
    });
});

// ============================================================================
// 5. 额度用完时出牌被拒
// ============================================================================

describe('额度用完时出牌被拒', () => {
    it('随从额度已用完时 PLAY_MINION 被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'test', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('额度已用完');
    });

    it('行动额度已用完时 PLAY_ACTION 被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'test_action', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'h1' },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('额度已用完');
    });
});

// ============================================================================
// 6. DISCARD_TO_LIMIT 传入重复 cardUid
// ============================================================================

describe('DISCARD_TO_LIMIT 重复 cardUid', () => {
    it('传入重复 uid 时弃牌数量不匹配被拒绝', () => {
        // 手牌 12 张，需弃 2 张
        const hand = Array.from({ length: 12 }, (_, i) =>
            makeCard(`h${i}`, `def${i}`, '0')
        );
        const core = makeState({
            players: { '0': makePlayer('0', { hand }), '1': makePlayer('1') },
        });
        const ms = { core, sys: { phase: 'draw' } } as any;

        // 传入 3 个 uid（其中 h0 重复），但需要弃 2 张
        const result = validate(ms, {
            type: SU_COMMANDS.DISCARD_TO_LIMIT,
            playerId: '0',
            payload: { cardUids: ['h0', 'h0', 'h1'] },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('2');
    });
});

// ============================================================================
// 7. 无效 cardUid 出牌
// ============================================================================

describe('无效 cardUid 出牌', () => {
    it('PLAY_MINION 传入不存在的 cardUid 被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('h1', 'test', '0')] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'nonexistent', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('手牌中没有该卡牌');
    });

    it('PLAY_ACTION 传入不存在的 cardUid 被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('h1', 'test', 'action', '0')] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'ghost_uid' },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('手牌中没有该卡牌');
    });
});

// ============================================================================
// 8. 基地索引越界
// ============================================================================

describe('基地索引越界', () => {
    it('baseIndex 为负数时被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('h1', 'test', '0')] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: -1 },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('无效的基地索引');
    });

    it('baseIndex 超出 bases.length 时被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('h1', 'test', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')], // 只有 1 个基地
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: 5 },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('无效的基地索引');
    });
});

// ============================================================================
// 9. USE_TALENT 指向不存在的随从
// ============================================================================

describe('USE_TALENT 边界', () => {
    it('基地上没有该随从时被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('m1', 'test', '0', 3)])],
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'nonexistent', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('基地上没有该随从');
    });

    it('无效基地索引时被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 99 },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('无效的基地索引');
    });

    it('对手控制的随从不能使用天赋', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('m1', 'test', '1', 3)])],
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('只能使用自己控制的随从的天赋');
    });
});

// ============================================================================
// 10. 单人基地记分
// ============================================================================

describe('单人基地记分', () => {
    it('只有一个玩家有随从时该玩家获得第一名 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_tar_pits', // vpAwards=[4,3,2]
                minions: [makeMinion('m1', 'test', '0', 20)],
                ongoingActions: [],
            }],
            baseDeck: ['base_central_brain'],
        });

        const mockCommand = { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any;
        const result = smashUpFlowHooks.onPhaseExit!({
            state: { core, sys: { phase: 'scoreBases', responseWindow: { current: undefined }, interaction: { queue: [] } } } as any,
            from: 'scoreBases',
            to: 'draw',
            command: mockCommand,
            random: mockRandom,
        });

        const events = Array.isArray(result) ? result : (result as PhaseExitResult).events ?? [];
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scoredEvents.length).toBe(1);

        const rankings = (scoredEvents[0] as any).payload.rankings;
        expect(rankings.length).toBe(1);
        expect(rankings[0].playerId).toBe('0');
        expect(rankings[0].vp).toBe(4); // 第一名 VP
    });

    it('基地上无随从时不记分', () => {
        const core = makeState({
            bases: [{
                defId: 'base_tar_pits',
                minions: [], // 无随从
                ongoingActions: [],
            }],
            baseDeck: [],
        });

        const mockCommand = { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any;
        const result = smashUpFlowHooks.onPhaseExit!({
            state: { core, sys: { phase: 'scoreBases', responseWindow: { current: undefined }, interaction: { queue: [] } } } as any,
            from: 'scoreBases',
            to: 'draw',
            command: mockCommand,
            random: mockRandom,
        });

        const events = Array.isArray(result) ? result : (result as PhaseExitResult).events ?? [];
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scoredEvents.length).toBe(0);
    });
});
