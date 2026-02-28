/**
 * 大杀四方 - 疯狂卡相关能力测试
 *
 * 覆盖：
 * - 克苏鲁之仆：cthulhu_whispers_in_darkness, cthulhu_seal_is_broken, cthulhu_corruption
 * - 米斯卡塔尼克大学：miskatonic_psychological_profiling, miskatonic_mandatory_reading, miskatonic_lost_knowledge
 * - 印斯茅斯：innsmouth_recruitment
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execute, reduce } from '../domain/reducer';
import { postProcessSystemEvents } from '../domain';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry, resolveAbility } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { applyEvents as _applyEventsHelper } from './helpers';
import type { MatchState, RandomFn } from '../../../engine/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid, defId, controller, owner: owner ?? controller,
        basePower: power, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
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

/** 创建带疯狂牌库的状态 */
function makeStateWithMadness(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        madnessDeck: Array.from({ length: MADNESS_DECK_SIZE }, () => MADNESS_CARD_DEF_ID),
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any } as any;
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

/** 保存最近一次 execute 调用的 matchState 引用 */
let lastMatchState: MatchState<SmashUpCore> | null = null;

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    lastMatchState = ms;
    const events = execute(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    
    // Call postProcessSystemEvents to trigger onPlay abilities
    return postProcessSystemEvents(state, events, random ?? defaultRandom).events;
}

/** 从最近一次 execute 的 matchState 中获取 interactions */
function getLastInteractions(): any[] {
    if (!lastMatchState) return [];
    const interaction = (lastMatchState.sys as any)?.interaction;
    if (!interaction) return [];
    const list: any[] = [];
    if (interaction.current) list.push(interaction.current);
    if (interaction.queue?.length) list.push(...interaction.queue);
    return list;
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// 克苏鲁之仆 - 疯狂卡能力
// ============================================================================

describe('克苏鲁之仆 - 疯狂卡能力', () => {
    describe('cthulhu_whispers_in_darkness（暗中低语：疯狂卡+2额外行动）', () => {
        it('抽1张疯狂卡并获得2个额外行动', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(1);

            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            const actionLimits = limitEvents.filter(e => (e as any).payload.limitType === 'action');
            expect(actionLimits.length).toBe(2);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                        actionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // 手牌应有1张疯狂卡
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
            // 行动额度 = 1(原) + 2(额外) = 3
            expect(newState.players['0'].actionLimit).toBe(3);
            // 疯狂牌库减少1张
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 1);
        });

        it('无疯狂牌库时仍给额外行动', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: [], // 空牌库
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(0); // 无法抽取
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(2); // 仍给2个额外行动
        });
    });

    describe('cthulhu_seal_is_broken（封印已破：疯狂卡+1VP）', () => {
        it('抽1张疯狂卡并获得1VP', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_seal_is_broken', 'action', '0')],
                        vp: 5,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);

            const vpEvents = events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
            expect(vpEvents.length).toBe(1);
            expect((vpEvents[0] as any).payload.amount).toBe(1);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_seal_is_broken', 'action', '0')],
                        vp: 5,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            expect(newState.players['0'].vp).toBe(6);
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
        });
    });

    describe('cthulhu_corruption（腐化：疯狂卡+消灭最弱对手随从）', () => {
        it('多个对手随从时创建 Prompt 选择目标', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '1', 2),
                        makeMinion('m2', 'test', '1', 5),
                        makeMinion('m3', 'test', '0', 1), // 己方，不应被消灭
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);

            // 多个对手随从时应创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('cthulhu_corruption');
        });

        it('单个对手随从时创建 Prompt', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '1', 2),
                        makeMinion('m3', 'test', '0', 1), // 己方
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);

            // 单个对手随从时创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
        });

        it('无对手随从时只抽疯狂卡', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '0', 3), // 己方
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(0);
        });

        it('多个对手随从时创建 Prompt（考虑力量修正）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        { ...makeMinion('m1', 'test', '1', 5), powerModifier: -3 }, // 有效力量 2
                        makeMinion('m2', 'test', '1', 3), // 有效力量 3
                    ], ongoingActions: [],
                }],
            });

            execPlayAction(state, '0', 'a1');
            // 多个对手随从时应创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('cthulhu_corruption');
        });

        it('状态正确（reduce 验证）- 单目标时 Prompt 待决', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test_m', '1', 2),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // 单目标创建 Interaction，m1 未被消灭
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(newState.bases[0].minions.length).toBe(1);
            // P0 手牌有疯狂卡
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
        });
    });
});


// ============================================================================
// 米斯卡塔尼克大学 - 疯狂卡能力
// ============================================================================

describe('米斯卡塔尼克大学 - 疯狂卡能力', () => {
    describe('miskatonic_psychological_profiling（这太疯狂了...：抽疯狂卡+全体己方随从+1力量+额外战术）', () => {
        it('抽1张疯狂卡、全体己方随从+1力量、获得额外战术', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [
                        makeMinion('mine1', 'test_a', '0', 2),
                        makeMinion('mine2', 'test_b', '0', 3),
                        makeMinion('enemy1', 'test_c', '1', 5),
                    ],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            // 抽1张疯狂卡
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(1);
            // 己方2个随从各获得+1临时力量
            const tempPowerEvts = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
            expect(tempPowerEvts.length).toBe(2);
            expect(tempPowerEvts.every((e: any) => e.payload.amount === 1)).toBe(true);
            const buffedUids = tempPowerEvts.map((e: any) => e.payload.minionUid).sort();
            expect(buffedUids).toEqual(['mine1', 'mine2']);
            // 额外打出1个战术
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            const actionLimits = limitEvents.filter(e => (e as any).payload.limitType === 'action');
            expect(actionLimits.length).toBe(1);
        });

        it('无己方随从时仍抽疯狂卡和获得额外战术', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [makeMinion('enemy1', 'test', '1', 5)],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            const tempPowerEvts = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
            expect(tempPowerEvts.length).toBe(0); // 无己方随从
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1); // 仍给额外战术
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                        actionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [makeMinion('mine1', 'test', '0', 3)],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // 手牌应有1张疯狂卡
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
            // 行动额度 = 1(原) + 1(额外战术) = 2
            expect(newState.players['0'].actionLimit).toBe(2);
            // 随从获得+1临时力量
            expect(newState.bases[0].minions[0].tempPowerModifier).toBe(1);
            // 疯狂牌库减少1张
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 1);
        });
    });

    describe('miskatonic_mandatory_reading（最好不知道的事：special，选随从+抽疯狂卡+力量加成）', () => {
        /** 直接调用 special 执行器 */
        function execSpecial(state: SmashUpCore, playerId: string, baseIndex: number) {
            const executor = resolveAbility('miskatonic_mandatory_reading', 'special');
            expect(executor).toBeDefined();
            const ms = makeMatchState(state);
            lastMatchState = ms;
            return executor!({
                state, matchState: ms, playerId,
                cardUid: 'special-card', defId: 'miskatonic_mandatory_reading',
                baseIndex, random: defaultRandom, now: Date.now(),
            });
        }

        it('基地有多个随从时创建选择随从的交互', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [
                        makeMinion('m1', 'test_a', '0', 3),
                        makeMinion('m2', 'test_b', '1', 5),
                    ],
                }],
            });

            const result = execSpecial(state, '0', 0);
            expect(result.matchState).toBeDefined();
            const interaction = result.matchState!.sys.interaction;
            const hasInteraction = !!interaction?.current || (interaction?.queue?.length ?? 0) > 0;
            expect(hasInteraction).toBe(true);
            const i = interaction!.current ?? interaction!.queue[0];
            expect((i.data as any).sourceId).toBe('miskatonic_mandatory_reading');
            expect((i.data as any).options.length).toBe(2);
        });

        it('唯一随从时自动选择并创建抽疯狂卡数量交互', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [makeMinion('m1', 'test_a', '0', 3)],
                }],
            });

            const result = execSpecial(state, '0', 0);
            expect(result.matchState).toBeDefined();
            const interaction = result.matchState!.sys.interaction;
            const hasInteraction = !!interaction?.current || (interaction?.queue?.length ?? 0) > 0;
            expect(hasInteraction).toBe(true);
            const i = interaction!.current ?? interaction!.queue[0];
            expect((i.data as any).sourceId).toBe('miskatonic_mandatory_reading_draw');
        });

        it('抽疯狂卡后随从获得力量加成（handler 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [makeMinion('m1', 'test_a', '0', 3)],
                }],
            });

            const handler = getInteractionHandler('miskatonic_mandatory_reading_draw');
            expect(handler).toBeDefined();
            const ms = makeMatchState(state);
            const result = handler!(ms, '0', { count: 2, minionUid: 'm1', baseIndex: 0 }, undefined, defaultRandom, 0);
            // 一次性抽2张疯狂卡（单个 MADNESS_DRAWN 事件，count=2，避免重复 UID）
            const madnessEvents = result.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(2);
            // 随从获得+4力量（2张×2力量）
            const powerEvents = result.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
            expect(powerEvents.length).toBe(1);
            expect((powerEvents[0] as any).payload.minionUid).toBe('m1');
            expect((powerEvents[0] as any).payload.amount).toBe(4);
        });

        it('选择跳过时不产生事件', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [{ defId: 'base_test', ongoingActions: [], minions: [makeMinion('m1', 'test_a', '0', 3)] }],
            });

            const handler = getInteractionHandler('miskatonic_mandatory_reading_draw');
            expect(handler).toBeDefined();
            const ms = makeMatchState(state);
            const result = handler!(ms, '0', { skip: true }, undefined, defaultRandom, 0);
            expect(result.events.length).toBe(0);
        });

        it('状态正确（reduce 验证）- 抽3张疯狂卡后随从+6力量', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [{ defId: 'base_test', ongoingActions: [], minions: [makeMinion('m1', 'test_a', '0', 3)] }],
            });

            const handler = getInteractionHandler('miskatonic_mandatory_reading_draw');
            expect(handler).toBeDefined();
            const ms = makeMatchState(state);
            const result = handler!(ms, '0', { count: 3, minionUid: 'm1', baseIndex: 0 }, undefined, defaultRandom, 0);
            const newState = applyEvents(state, result.events);
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(3);
            expect(newState.bases[0].minions[0].powerModifier).toBe(6);
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 3);
        });

        it('多张疯狂卡 UID 唯一（无重复 key）', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [{ defId: 'base_test', ongoingActions: [], minions: [makeMinion('m1', 'test_a', '0', 3)] }],
            });

            const handler = getInteractionHandler('miskatonic_mandatory_reading_draw');
            expect(handler).toBeDefined();
            const ms = makeMatchState(state);
            const result = handler!(ms, '0', { count: 3, minionUid: 'm1', baseIndex: 0 }, undefined, defaultRandom, 0);
            const newState = applyEvents(state, result.events);
            const madnessCards = newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            expect(madnessCards.length).toBe(3);
            // 所有疯狂牌 UID 必须唯一
            const uids = madnessCards.map(c => c.uid);
            const uniqueUids = new Set(uids);
            expect(uniqueUids.size).toBe(3);
        });
    });

    describe('miskatonic_lost_knowledge（通往超凡的门：ongoing talent，抽疯狂卡+额外随从到此基地）', () => {
        /** 直接调用 talent 执行器 */
        function execTalent(state: SmashUpCore, playerId: string, baseIndex: number) {
            const executor = resolveAbility('miskatonic_lost_knowledge', 'talent');
            expect(executor).toBeDefined();
            const ms = makeMatchState(state);
            lastMatchState = ms;
            return executor!({
                state, matchState: ms, playerId,
                cardUid: 'ongoing-card', defId: 'miskatonic_lost_knowledge',
                baseIndex, random: defaultRandom, now: Date.now(),
            });
        }

        it('抽1张疯狂卡并获得额外随从到此基地', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [{ defId: 'base_test', ongoingActions: [], minions: [makeMinion('m1', 'test', '0', 3)] }],
            });

            const result = execTalent(state, '0', 0);
            const madnessEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(1);
            const limitEvents = result.events.filter((e: any) => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
            expect((limitEvents[0] as any).payload.limitType).toBe('minion');
        });

        it('疯狂牌库为空时仍给额外随从', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [{ defId: 'base_test', ongoingActions: [], minions: [] }],
                madnessDeck: [],
            });

            const result = execTalent(state, '0', 0);
            const madnessEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(0);
            const limitEvents = result.events.filter((e: any) => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0', { minionLimit: 1 }), '1': makePlayer('1') },
                bases: [{ defId: 'base_test', ongoingActions: [], minions: [] }],
            });

            const result = execTalent(state, '0', 0);
            const newState = applyEvents(state, result.events);
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
            // 额外随从限定到基地0（baseLimitedMinionQuota），minionLimit 不变
            expect(newState.players['0'].minionLimit).toBe(1);
            expect((newState.players['0'] as any).baseLimitedMinionQuota?.[0]).toBe(1);
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 1);
        });

        it('无 baseIndex 时仍给额外随从（不限定基地）', () => {
            const executor = resolveAbility('miskatonic_lost_knowledge', 'talent');
            expect(executor).toBeDefined();
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [],
            });
            const ms = makeMatchState(state);
            const result = executor!({
                state, matchState: ms, playerId: '0',
                cardUid: 'ongoing-card', defId: 'miskatonic_lost_knowledge',
                baseIndex: undefined as any, random: defaultRandom, now: Date.now(),
            });
            const limitEvents = result.events.filter((e: any) => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
        });
    });
});

// ============================================================================
// 印斯茅斯 - 疯狂卡能力
// ============================================================================

describe('印斯茅斯 - 疯狂卡能力', () => {
    describe('innsmouth_recruitment（招募：抽疯狂卡换额外随从）', () => {
        it('抽3张疯狂卡并获得3个额外随从', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            execPlayAction(state, '0', 'a1');
            // 应创建选择交互
            const interactions = getLastInteractions();
            expect(interactions.length).toBeGreaterThan(0);
            const current = interactions[0];
            expect(current?.data?.sourceId).toBe('innsmouth_recruitment');

            // 通过 handler 选择抽 3 张
            const handler = getInteractionHandler('innsmouth_recruitment');
            expect(handler).toBeDefined();
            const ms = makeMatchState(state);
            const result = handler!(ms, '0', { count: 3 }, undefined, defaultRandom, 0);
            const madnessEvents = result.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(3);

            const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            const minionLimits = limitEvents.filter(e => (e as any).payload.limitType === 'minion');
            expect(minionLimits.length).toBe(3);
        });

        it('疯狂牌库不足3张时按实际数量', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID], // 只有2张
            });

            execPlayAction(state, '0', 'a1');
            // 通过 handler 选择抽 3 张（实际只能抽 2 张）
            const handler = getInteractionHandler('innsmouth_recruitment');
            expect(handler).toBeDefined();
            const ms = makeMatchState(state);
            // 修改 madnessDeck 为只有 2 张
            (ms.core as any).madnessDeck = [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID];
            const result = handler!(ms, '0', { count: 3 }, undefined, defaultRandom, 0);
            const madnessEvents = result.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(2); // 只能抽2张

            const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            const minionLimits = limitEvents.filter(e => (e as any).payload.limitType === 'minion');
            expect(minionLimits.length).toBe(2); // 只有2个额外随从
        });

        it('疯狂牌库为空时无效果', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: [],
            });

            const events = execPlayAction(state, '0', 'a1');
            // 疯狂牌库为空，不创建交互
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(0);
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(0);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_recruitment', 'action', '0')],
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 通过 handler 验证 reduce
            const handler = getInteractionHandler('innsmouth_recruitment');
            expect(handler).toBeDefined();
            const ms = makeMatchState(state);
            const result = handler!(ms, '0', { count: 3 }, undefined, defaultRandom, 0);
            // 先 apply ACTION_PLAYED 事件
            const playEvents: SmashUpEvent[] = [
                { type: SU_EVENTS.ACTION_PLAYED, payload: { playerId: '0', cardUid: 'a1', defId: 'innsmouth_recruitment' }, timestamp: 0 } as any,
                ...result.events,
            ];
            const newState = applyEvents(state, playEvents);
            // 手牌有3张疯狂卡
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(3);
            // 随从额度 = 1(原) + 3(额外) = 4
            expect(newState.players['0'].minionLimit).toBe(4);
            // 疯狂牌库减少3张
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 3);
        });
    });
});
