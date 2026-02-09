/**
 * 大杀四方 - 天赋能力测试
 *
 * 覆盖：
 * - 米斯卡塔尼克大学：miskatonic_fellow（研究员 talent）
 * - 克苏鲁之仆：cthulhu_star_spawn（星之眷族 talent）
 * - 克苏鲁之仆：cthulhu_servitor（仆人 talent）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execute } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type {
    SmashUpCore,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import type { MatchState, RandomFn } from '../../../engine/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, opts?: Partial<MinionOnBase>): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0, talentUsed: false, attachedActions: [],
        ...opts,
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return { core, sys: { phase: 'playCards' } as any } as any;
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

// ============================================================================
// 米斯卡塔尼克大学：研究员 talent
// ============================================================================

describe('miskatonic_fellow（研究员 talent）', () => {
    it('使用天赋：抽1张牌 + 额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('d1', 'test_card_a', 'action', '0'),
                        makeCard('d2', 'test_card_b', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'miskatonic_fellow', '0', 3)], ongoingActions: [] },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        // 应有 TALENT_USED + CARDS_DRAWN + LIMIT_MODIFIED
        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.CARDS_DRAWN);
        expect(types).toContain(SU_EVENTS.LIMIT_MODIFIED);

        // 抽1张牌
        const drawEvt = events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)!;
        expect((drawEvt as any).payload.count).toBe(1);
        expect((drawEvt as any).payload.cardUids).toEqual(['d1']);

        // 额外行动
        const limitEvt = events.find(e => e.type === SU_EVENTS.LIMIT_MODIFIED)!;
        expect((limitEvt as any).payload.limitType).toBe('action');
        expect((limitEvt as any).payload.delta).toBe(1);
    });

    it('牌库为空时仍给额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [] }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [makeMinion('m1', 'miskatonic_fellow', '0', 3)], ongoingActions: [] },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).not.toContain(SU_EVENTS.CARDS_DRAWN);
        expect(types).toContain(SU_EVENTS.LIMIT_MODIFIED);
    });

    it('天赋已使用时不能再次使用', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'miskatonic_fellow', '0', 3, { talentUsed: true })],
                    ongoingActions: [],
                },
            ],
        });

        // 天赋已使用的随从，execute 不会被调用（由 validate 拦截）
        // 但 execute 层面如果直接调用，minion 存在但 talentUsed=true
        // 这里测试 execute 仍然会生成事件（validate 是在 commands.ts 中）
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
    it('将手中疯狂卡转给对手', () => {
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

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        // 返回疯狂卡
        expect(types).toContain(SU_EVENTS.MADNESS_RETURNED);
        // 对手抽疯狂卡
        expect(types).toContain(SU_EVENTS.MADNESS_DRAWN);

        const returnEvt = events.find(e => e.type === SU_EVENTS.MADNESS_RETURNED)!;
        expect((returnEvt as any).payload.playerId).toBe('0');
        expect((returnEvt as any).payload.cardUid).toBe('mad1');

        const drawEvt = events.find(e => e.type === SU_EVENTS.MADNESS_DRAWN)!;
        expect((drawEvt as any).payload.playerId).toBe('1');
        expect((drawEvt as any).payload.count).toBe(1);
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

    it('疯狂牌库为空时只返回不抽取', () => {
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

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MADNESS_RETURNED);
        // 疯狂牌库空，对手无法抽取
        expect(types).not.toContain(SU_EVENTS.MADNESS_DRAWN);
    });
});


// ============================================================================
// 克苏鲁之仆：仆人 talent
// ============================================================================

describe('cthulhu_servitor（仆人 talent）', () => {
    it('消灭自身 + 弃牌堆行动卡放牌库顶', () => {
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

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        expect(types).toContain(SU_EVENTS.DECK_RESHUFFLED);

        // 消灭的是自身
        const destroyEvt = events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)!;
        expect((destroyEvt as any).payload.minionUid).toBe('m1');
        expect((destroyEvt as any).payload.minionDefId).toBe('cthulhu_servitor');

        // 牌库重排：弃牌堆行动卡放顶部
        const reshuffleEvt = events.find(e => e.type === SU_EVENTS.DECK_RESHUFFLED)!;
        const newDeckUids = (reshuffleEvt as any).payload.deckUids;
        // 第一张应该是弃牌堆的行动卡
        expect(newDeckUids[0]).toBe('dis1');
        // 后面是原牌库
        expect(newDeckUids[1]).toBe('d1');
        expect(newDeckUids[2]).toBe('d2');
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

    it('弃牌堆有多张行动卡时选第一张', () => {
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

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const reshuffleEvt = events.find(e => e.type === SU_EVENTS.DECK_RESHUFFLED)!;
        const newDeckUids = (reshuffleEvt as any).payload.deckUids;
        // MVP：选第一张行动卡 dis1
        expect(newDeckUids[0]).toBe('dis1');
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
});
