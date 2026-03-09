/**
 * 大杀四方 - ongoing 行动卡天赋测试
 *
 * 覆盖：
 * - 米斯卡塔尼克大学：miskatonic_lost_knowledge（通往超凡的门 ongoing talent）
 * - 蒸汽朋克：steampunk_zeppelin（齐柏林飞艇 ongoing talent，含交互选择）
 * - 印斯茅斯：innsmouth_sacred_circle（宗教圆环 ongoing talent）
 * - 验证/reduce/回合重置 全链路
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execute, reduce } from '../domain/reducer';
import { validate } from '../domain/commands';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type { SmashUpCore, OngoingActionOnBase } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import {
    makeMinion, makeCard, makePlayer, makeState, makeMatchState,
    getInteractionsFromMS, applyEvents,
} from './helpers';
import type { RandomFn } from '../../../engine/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

/** 创建带 ongoing 行动卡的基地 */
function makeOngoing(uid: string, defId: string, ownerId: string, talentUsed = false): OngoingActionOnBase {
    return { uid, defId, ownerId, talentUsed };
}

// ============================================================================
// 验证层：ongoing 行动卡天赋
// ============================================================================

describe('ongoing 行动卡天赋 - 验证层', () => {
    it('有天赋的 ongoing 卡可以使用天赋', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
            }],
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(true);
    });

    it('天赋已使用时拒绝', () => {
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0', true)],
            }],
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('已使用');
    });

    it('不是自己的 ongoing 卡时拒绝', () => {
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '1')],
            }],
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(false);
    });

    it('没有 talent 标签的 ongoing 卡拒绝', () => {
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [],
                // block_the_path 没有 talent 标签
                ongoingActions: [makeOngoing('oa1', 'pirate_full_sail', '0')],
            }],
        });
        const ms = makeMatchState(core);
        const result = validate(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(false);
    });

    it('不在出牌阶段时拒绝', () => {
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
            }],
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'draw';
        const result = validate(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(false);
    });
});

// ============================================================================
// 通往超凡的门（miskatonic_lost_knowledge）：抽疯狂卡 + 额外随从到此基地
// ============================================================================

describe('miskatonic_lost_knowledge（通往超凡的门 ongoing talent）', () => {
    it('触发天赋后生成 TALENT_USED + 抽疯狂卡 + 额外随从事件', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
            }],
            madnessDeck: ['madness_0', 'madness_1'],
        });

        const ms = makeMatchState(core);
        const events = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MADNESS_DRAWN);
        expect(types).toContain(SU_EVENTS.LIMIT_MODIFIED);

        // TALENT_USED 事件应包含 ongoingCardUid
        const talentEvt = events.find(e => e.type === SU_EVENTS.TALENT_USED)!;
        expect((talentEvt as any).payload.ongoingCardUid).toBe('oa1');
        expect((talentEvt as any).payload.defId).toBe('miskatonic_lost_knowledge');
    });

    it('reduce 后 talentUsed 标记为 true', () => {
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
            }],
            madnessDeck: ['madness_0'],
        });

        const ms = makeMatchState(core);
        const events = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any, defaultRandom);

        const newCore = applyEvents(core, events);
        expect(newCore.bases[0].ongoingActions[0].talentUsed).toBe(true);
    });

    it('TURN_STARTED 重置 ongoing 卡的 talentUsed', () => {
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0', true)],
            }],
        });

        const newCore = reduce(core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: Date.now(),
        } as any);

        expect(newCore.bases[0].ongoingActions[0].talentUsed).toBe(false);
    });

    it('TURN_STARTED 只重置当前玩家的 ongoing 卡', () => {
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [
                    makeOngoing('oa1', 'miskatonic_lost_knowledge', '0', true),
                    makeOngoing('oa2', 'steampunk_zeppelin', '1', true),
                ],
            }],
        });

        // 玩家 0 的回合开始
        const newCore = reduce(core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: Date.now(),
        } as any);

        expect(newCore.bases[0].ongoingActions[0].talentUsed).toBe(false); // 玩家 0 的卡重置
        expect(newCore.bases[0].ongoingActions[1].talentUsed).toBe(true);  // 玩家 1 的卡不重置
    });
});

// ============================================================================
// 齐柏林飞艇（steampunk_zeppelin）：移动随从（分两步交互）
// ============================================================================

describe('steampunk_zeppelin（齐柏林飞艇 ongoing talent - 分两步交互）', () => {
    it('触发天赋后创建第一步交互：选择要移动的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'pirate_first_mate', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [makeOngoing('oa1', 'steampunk_zeppelin', '0')],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('m2', 'pirate_saucy_wench', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const ms = makeMatchState(core);
        const events = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any, defaultRandom);

        // 应有 TALENT_USED 事件
        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);

        // 应创建第一步交互（选择随从）
        const interactions = getInteractionsFromMS(ms);
        expect(interactions.length).toBeGreaterThan(0);

        const interaction = interactions[0];
        expect(interaction.data?.sourceId).toBe('steampunk_zeppelin_choose_minion');
        expect(interaction.data?.targetType).toBe('minion');
        expect(interaction.data?.options?.length).toBeGreaterThan(0);
    });

    it('无己方随从可移动时返回反馈事件', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'steampunk_zeppelin', '0')],
                },
            ],
        });

        const ms = makeMatchState(core);
        const events = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any, defaultRandom);

        // 应有 TALENT_USED + ABILITY_FEEDBACK（无有效目标）
        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.ABILITY_FEEDBACK);
    });

    it('第二步若目标已离开来源基地则不再移动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'pirate_first_mate', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [makeOngoing('oa1', 'steampunk_zeppelin', '0')],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('m2', 'pirate_saucy_wench', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const ms = makeMatchState(core);
        execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any, defaultRandom);

        const chooseMinionInteraction = getInteractionsFromMS(ms)[0];
        expect(chooseMinionInteraction?.data?.sourceId).toBe('steampunk_zeppelin_choose_minion');

        const chooseMinion = getInteractionHandler('steampunk_zeppelin_choose_minion');
        const chooseBase = getInteractionHandler('steampunk_zeppelin_choose_base');
        const legacyHandler = getInteractionHandler('steampunk_zeppelin');
        expect(chooseMinion).toBeDefined();
        expect(chooseBase).toBeDefined();
        expect(legacyHandler).toBeDefined();

        const step1 = chooseMinion!(
            ms,
            '0',
            { minionUid: 'm2', baseIndex: 1 },
            chooseMinionInteraction?.data,
            defaultRandom,
            2100,
        );
        const chooseBaseInteraction = (step1?.state.sys as any).interaction?.queue?.[0];
        expect(chooseBaseInteraction?.data?.sourceId).toBe('steampunk_zeppelin_choose_base');

        const staleCore = makeState({
            ...core,
            players: {
                ...core.players,
                '0': makePlayer('0', {
                    ...core.players['0'],
                    discard: [makeCard('m2', 'pirate_saucy_wench', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                core.bases[0],
                {
                    ...core.bases[1],
                    minions: [],
                },
            ],
        });

        const step2 = chooseBase!(
            makeMatchState(staleCore),
            '0',
            { baseIndex: 0 },
            chooseBaseInteraction?.data,
            defaultRandom,
            2101,
        );
        expect(step2?.events ?? []).toHaveLength(0);

        const legacy = legacyHandler!(
            makeMatchState(staleCore),
            '0',
            { minionUid: 'm2', minionDefId: 'pirate_saucy_wench', fromBase: 1, toBase: 0 },
            undefined,
            defaultRandom,
            2102,
        );
        expect(legacy?.events ?? []).toHaveLength(0);
    });

    it('reduce 后 talentUsed 标记为 true', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'pirate_first_mate', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [makeOngoing('oa1', 'steampunk_zeppelin', '0')],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const ms = makeMatchState(core);
        const events = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any, defaultRandom);

        const newCore = applyEvents(core, events);
        expect(newCore.bases[0].ongoingActions[0].talentUsed).toBe(true);
    });
});

// ============================================================================
// 宗教圆环（innsmouth_sacred_circle）：额外打出同名随从到此基地
// ============================================================================

describe('innsmouth_sacred_circle（宗教圆环 ongoing talent）', () => {
    it('基地有随从且手牌有同名随从时给额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'innsmouth_deep_one', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('m1', 'innsmouth_deep_one', '0', 2, { powerModifier: 0 })],
                ongoingActions: [makeOngoing('oa1', 'innsmouth_sacred_circle', '0')],
            }],
        });

        const ms = makeMatchState(core);
        const events = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.LIMIT_MODIFIED);

        // 验证 LIMIT_MODIFIED 包含 sameNameOnly 和 restrictToBase 约束
        const limitEvt = events.find(e => e.type === SU_EVENTS.LIMIT_MODIFIED) as any;
        expect(limitEvt.payload.sameNameOnly).toBe(true);
        expect(limitEvt.payload.restrictToBase).toBe(0);
    });

    it('手牌无同名随从时返回反馈', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('m1', 'innsmouth_deep_one', '0', 2, { powerModifier: 0 })],
                ongoingActions: [makeOngoing('oa1', 'innsmouth_sacred_circle', '0')],
            }],
        });

        const ms = makeMatchState(core);
        const events = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as any, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.ABILITY_FEEDBACK);
    });
});

// ============================================================================
// 随从天赋回归测试：确保原有随从天赋不受影响
// ============================================================================

describe('随从天赋回归测试', () => {
    it('随从天赋仍然正常工作（教授）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        } as any, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.CARDS_DISCARDED);

        // TALENT_USED 事件应包含 minionUid（不是 ongoingCardUid）
        const talentEvt = events.find(e => e.type === SU_EVENTS.TALENT_USED)!;
        expect((talentEvt as any).payload.minionUid).toBe('m1');
        expect((talentEvt as any).payload.ongoingCardUid).toBeUndefined();
    });

    it('随从天赋 reduce 后 talentUsed 标记正确', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        } as any, defaultRandom);

        const newCore = applyEvents(core, events);
        expect(newCore.bases[0].minions[0].talentUsed).toBe(true);
    });
});
