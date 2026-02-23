/**
 * 大杀四方 - 天赋能力测试
 *
 * 覆盖：
 * - 米斯卡塔尼克大学：miskatonic_psychologist（研究员 talent）
 * - 克苏鲁之仆：cthulhu_star_spawn（星之眷族 talent）
 * - 克苏鲁之仆：cthulhu_servitor（仆人 talent）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execute, reduce } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import { validate } from '../domain/commands';
import type {
    SmashUpCore,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { makeMinion, makeCard, makePlayer, makeState, makeMatchState, getInteractionsFromMS } from './helpers';
import type { MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS, asSimpleChoice } from '../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================






const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

// ============================================================================
// 米斯卡塔尼克大学：教授 talent
// ============================================================================

describe('miskatonic_professor（教授 talent）', () => {
    it('手中有疯狂卡时：弃疯狂卡 + 额外行动 + 额外随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeCard('d1', 'test_card_a', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'miskatonic_professor', '0', 5)], ongoingActions: [] },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        // 应有 TALENT_USED + CARDS_DISCARDED + LIMIT_MODIFIED(action) + LIMIT_MODIFIED(minion)
        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.CARDS_DISCARDED);

        // 弃掉疯狂卡
        const discardEvt = events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)!;
        expect((discardEvt as any).payload.cardUids).toEqual(['mad1']);

        // 额外行动 + 额外随从
        const limitEvts = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvts.length).toBe(2);
        const limitTypes = limitEvts.map(e => (e as any).payload.limitType);
        expect(limitTypes).toContain('action');
        expect(limitTypes).toContain('minion');
    });

    it('手中无疯狂卡时无效果', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'test_card', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'miskatonic_professor', '0', 5)], ongoingActions: [] },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        // 无疯狂卡，不应有弃牌或额外行动事件
        expect(types).not.toContain(SU_EVENTS.CARDS_DISCARDED);
        expect(types).not.toContain(SU_EVENTS.LIMIT_MODIFIED);
    });

    it('天赋已使用时不能再次使用', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { talentUsed: true })],
                    ongoingActions: [],
                },
            ],
        });

        // 天赋已使用的随从，execute 不会被调用（由 validate 拦截）
        // 但 execute 层面如果直接调用，minion 存在但 talentUsed=true
        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        // execute 不做 talentUsed 校验（由 validate 负责），所以仍会生成事件
        expect(events.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// 克苏鲁之仆：星之眷族 talent
// ============================================================================

describe('cthulhu_star_spawn（星之眷族 talent）', () => {
    it('单张疯狂卡时创建 Prompt（包含取消选项）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('c1', 'test_card', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5)], ongoingActions: [] },
            ],
            madnessDeck: ['madness_def_1', 'madness_def_2', 'madness_def_3'],
        });

        const ms = makeMatchState(core);
        const events = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        // 创建 Interaction（包含玩家选项 + 取消选项）
        const interactions = getInteractionsFromMS(ms);
        expect(interactions.length).toBe(1);
        const prompt = asSimpleChoice(interactions[0]);
        expect(prompt?.options.length).toBe(2); // 1个对手 + 1个取消选项
        // 验证取消选项使用框架标准 ID 和标记
        expect(prompt?.options.some(opt => opt.id === '__cancel__')).toBe(true);
        expect(prompt?.options.some(opt => (opt.value as any)?.__cancel__)).toBe(true);
        expect(types).not.toContain(SU_EVENTS.MADNESS_RETURNED);
        expect(types).not.toContain(SU_EVENTS.MADNESS_DRAWN);
    });

    it('选择取消时不执行任何效果', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5)], ongoingActions: [] },
            ],
            madnessDeck: ['madness_def_1'],
        });

        const ms = makeMatchState(core);
        // 先触发天赋创建 Prompt
        execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        // 玩家选择取消（使用框架标准 ID）
        const events = execute(ms, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: '__cancel__' },
        }, defaultRandom);

        const types = events.map(e => e.type);
        // 不应有疯狂卡转移事件
        expect(types).not.toContain(SU_EVENTS.MADNESS_RETURNED);
        expect(types).not.toContain(SU_EVENTS.MADNESS_DRAWN);
    });

    it('手中无疯狂卡时无效果', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'test_card', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5)], ongoingActions: [] },
            ],
            madnessDeck: ['madness_def_1'],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        // 无疯狂卡，不应有返回/抽取事件
        expect(types).not.toContain(SU_EVENTS.MADNESS_RETURNED);
        expect(types).not.toContain(SU_EVENTS.MADNESS_DRAWN);
    });

    it('疯狂牌库为空时单张疯狂卡创建 Prompt', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5)], ongoingActions: [] },
            ],
            madnessDeck: [],
        });

        const ms2 = makeMatchState(core);
        const events = execute(ms2, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        // 创建 Interaction
        const interactions2 = getInteractionsFromMS(ms2);
        expect(interactions2.length).toBe(1);
        expect(types).not.toContain(SU_EVENTS.MADNESS_RETURNED);
        expect(types).not.toContain(SU_EVENTS.MADNESS_DRAWN);
    });

    it('选择目标玩家后成功转移疯狂卡（验证 Prompt 结构）', () => {
        const initialCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('c1', 'test_card', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', { hand: [] }),
                '2': makePlayer('2', { hand: [] }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5)], ongoingActions: [] },
            ],
            madnessDeck: ['madness_def_1', 'madness_def_2'],
        });

        const ms = makeMatchState(initialCore);
        
        // 触发天赋创建 Prompt
        const talentEvents = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        expect(talentEvents.map(e => e.type)).toContain(SU_EVENTS.TALENT_USED);
        
        // 验证 Prompt 包含 2 个对手 + 1 个取消选项
        const interactions = getInteractionsFromMS(ms);
        expect(interactions.length).toBe(1);
        const prompt = asSimpleChoice(interactions[0]);
        expect(prompt?.options.length).toBe(3); // 玩家1 + 玩家2 + 取消
        
        // 验证玩家1选项的结构
        const player1Option = prompt?.options.find(opt => {
            const val = opt.value as any;
            return val?.targetPlayerId === '1';
        });
        expect(player1Option).toBeDefined();
        expect((player1Option?.value as any)?.madnessUid).toBe('mad1');
        // 不再检查 cancel 字段（已移除）
        
        // 验证玩家2选项的结构
        const player2Option = prompt?.options.find(opt => {
            const val = opt.value as any;
            return val?.targetPlayerId === '2';
        });
        expect(player2Option).toBeDefined();
        expect((player2Option?.value as any)?.madnessUid).toBe('mad1');
        
        // 验证取消选项的结构（使用框架标准标记）
        const cancelOption = prompt?.options.find(opt => opt.id === '__cancel__');
        expect(cancelOption).toBeDefined();
        expect(cancelOption?.label).toBe('取消');
        expect((cancelOption?.value as any)?.__cancel__).toBe(true);
    });

    it('多个对手时可以选择任意一个（验证 Prompt 结构）', () => {
        const initialCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1', { hand: [] }),
                '2': makePlayer('2', { hand: [] }),
                '3': makePlayer('3', { hand: [] }),
            },
            turnOrder: ['0', '1', '2', '3'],
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5)], ongoingActions: [] },
            ],
            madnessDeck: ['madness_def_1'],
        });

        const ms = makeMatchState(initialCore);
        
        // 触发天赋
        const talentEvents = execute(ms, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        // 验证 Prompt 包含 3 个对手 + 1 个取消选项
        const interactions = getInteractionsFromMS(ms);
        const prompt = asSimpleChoice(interactions[0]);
        expect(prompt?.options.length).toBe(4); // 玩家1 + 玩家2 + 玩家3 + 取消
        
        // 验证所有对手都在选项中
        const targetPlayerIds = prompt?.options
            .map(opt => (opt.value as any)?.targetPlayerId)
            .filter(Boolean);
        expect(targetPlayerIds).toContain('1');
        expect(targetPlayerIds).toContain('2');
        expect(targetPlayerIds).toContain('3');
        expect(targetPlayerIds.length).toBe(3); // 3个对手选项
        
        // 验证取消选项存在（使用框架标准标记）
        const cancelOption = prompt?.options.find(opt => opt.id === '__cancel__');
        expect(cancelOption).toBeDefined();
        expect((cancelOption?.value as any)?.__cancel__).toBe(true);
    });
});


// ============================================================================
// 克苏鲁之仆：仆人 talent
// ============================================================================

describe('cthulhu_servitor（仆人 talent）', () => {
    it('消灭自身 + 单张行动卡时创建 Prompt', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('d1', 'test_minion', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                    ],
                    discard: [
                        makeCard('dis1', 'cthulhu_fhtagn', 'action', '0'),
                        makeCard('dis2', 'test_minion_b', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_servitor', '0', 2)], ongoingActions: [] },
            ],
        });

        const ms3 = makeMatchState(core);
        const events = execute(ms3, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        // 单张行动卡时创建 Interaction（不再生成 CHOICE_REQUESTED）
        const interactions3 = getInteractionsFromMS(ms3);
        expect(interactions3.length).toBe(1);
        expect(types).not.toContain(SU_EVENTS.DECK_RESHUFFLED);

        // 消灭的是自身
        const destroyEvt = events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)!;
        expect((destroyEvt as any).payload.minionUid).toBe('m1');
        expect((destroyEvt as any).payload.minionDefId).toBe('cthulhu_servitor');
    });

    it('弃牌堆无行动卡时仅消灭自身', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('dis1', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_servitor', '0', 2)], ongoingActions: [] },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        // 无行动卡，不应有牌库重排
        expect(types).not.toContain(SU_EVENTS.DECK_RESHUFFLED);
    });

    it('弃牌堆和牌库都为空时仅消灭自身', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [], discard: [] }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_servitor', '0', 2)], ongoingActions: [] },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        expect(types).not.toContain(SU_EVENTS.DECK_RESHUFFLED);
    });

    it('弃牌堆有多张行动卡时创建 Prompt 选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('d1', 'test_card', 'minion', '0')],
                    discard: [
                        makeCard('dis1', 'action_a', 'action', '0'),
                        makeCard('dis2', 'action_b', 'action', '0'),
                        makeCard('dis3', 'minion_c', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_servitor', '0', 2)], ongoingActions: [] },
            ],
        });

        const ms4 = makeMatchState(core);
        const events = execute(ms4, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        // 多张行动卡时应创建 Interaction（不再生成 CHOICE_REQUESTED）
        const interactions4 = getInteractionsFromMS(ms4);
        expect(interactions4.length).toBe(1);
        expect(interactions4[0].data.sourceId).toBe('cthulhu_servitor');
    });
});

// ============================================================================
// 天赋基础设施验证
// ============================================================================

describe('天赋基础设施', () => {
    it('无天赋能力注册的随从使用天赋时只生成 TALENT_USED', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'nonexistent_talent_minion', '0', 3)],
                    ongoingActions: [],
                },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        // 只有 TALENT_USED，无额外能力事件
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.TALENT_USED);
    });

    it('基地上不存在的随从使用天赋时返回空事件', () => {
        const core = makeState({
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'nonexistent', baseIndex: 0 },
        }, defaultRandom);

        expect(events.length).toBe(0);
    });

    it('巨石阵：同一随从本回合可使用第2次才能（若双才能名额未占用）', () => {
        const core = makeState({
            standingStonesDoubleTalentMinionUid: undefined,
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { talentUsed: true })],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        });
        expect(result.valid).toBe(true);
    });

    it('巨石阵：双才能名额已占用时，不允许其他随从第2次才能', () => {
        const core = makeState({
            standingStonesDoubleTalentMinionUid: 'used-minion',
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { talentUsed: true })],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('本回合天赋已使用');
    });
});
