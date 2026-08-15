/**
 * 计分阶段 eligible 基地锁定测试
 *
 * 规则（Wiki Phase 3 Step 4）：每次只选择一个达标基地开始计分；只有已经开始
 * 结算的当前基地，即使 beforeScoring 链路中力量被降低到 breakpoint 以下，仍然计分。
 *
 * 验证：
 * 1. 旧锁定字段仍兼容旧快照/夹具
 * 2. 正常计分链使用实时 eligible 查询
 * 3. 只有当前已选择基地会写入锁定事件
 * 4. 已完成一个基地后，会重新检查桌面并丢弃不再达标的旧候选
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import { smashUpSystemsForTest } from '../game';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { getRealtimeScoringEligibleBaseIndices, getScoringEligibleBaseIndices, getTotalEffectivePowerOnBase, getEffectiveBreakpoint } from '../domain/ongoingModifiers';
import { reduce } from '../domain/reduce';
import { createScoringBaseRef, createScoringSession, getScoringSession, setScoringSession } from '../domain/scoringSession';
import type { SmashUpCore, BaseInPlay, PlayerState, MinionOnBase, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { SU_EVENT_TYPES } from '../domain/events';
import { initAllAbilities } from '../abilities';
import { getPromptOption, getSimpleChoicePrompt } from './helpers';
import { getSmashUpReactionWindowPresentation } from '../domain/reactionWindowState';

beforeAll(() => {
    initAllAbilities();
});

// 真实基地 defId（来自 data/cards.ts）
// base_the_jungle: breakpoint=12, vpAwards=[2,0,0]
// base_tar_pits: breakpoint=16, vpAwards=[4,3,2]
// base_ninja_dojo: breakpoint=18, vpAwards=[2,3,2]
const BASE_JUNGLE = 'base_the_jungle';       // breakpoint=12
const BASE_TAR_PITS = 'base_tar_pits';       // breakpoint=16
const BASE_NINJA_DOJO = 'base_ninja_dojo';   // breakpoint=18
const TEST_PLAYER_IDS = ['0', '1'] as const;
const testRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: <T>(arr: T[]) => [...arr],
};

/** 构造最小 SmashUpCore 用于测试 */
function makeMinimalCore(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    const defaultPlayer: PlayerState = {
        id: '0',
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: ['aliens', 'dinosaurs'],
    };
    return {
        players: {
            '0': { ...defaultPlayer, id: '0' },
            '1': { ...defaultPlayer, id: '1' },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function makeMinion(uid: string, controller: string, basePower: number, powerModifier = 0): MinionOnBase {
    return {
        uid,
        defId: `test_minion_${uid}`,
        controller,
        owner: controller,
        basePower,
        powerCounters: 0,
        powerModifier,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

function makeBase(defId: string, minions: MinionOnBase[] = []): BaseInPlay {
    return { defId, minions, ongoingActions: [] };
}

function createRunner(
    setup: (ids: ('0' | '1')[], random: RandomFn) => MatchState<SmashUpCore>,
): GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent> {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: [...TEST_PLAYER_IDS],
        random: testRandom,
        setup,
    });
}

function passResponseWindowToClose(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < 8; i++) {
        const window = getSmashUpReactionWindowPresentation(runner.getState());
        if (!window) return events;
        const passResult = runner.dispatch(SU_COMMANDS.REACTION_PASS, {
            playerId: window.activePlayerId,
            reason: 'player_pass',
        });
        expect(passResult.success, passResult.error).toBe(true);
        events.push(...passResult.events);
    }
    throw new Error('响应窗口未在预期步数内关闭');
}

describe('计分阶段 eligible 基地锁定', () => {
    describe('getScoringEligibleBaseIndices', () => {
        it('有锁定列表时优先返回锁定列表', () => {
            // 基地力量为 0（远低于 breakpoint=12），但锁定列表包含该基地
            const core = makeMinimalCore({
                bases: [makeBase(BASE_JUNGLE)],
                scoringEligibleBaseIndices: [0],
            });
            const result = getScoringEligibleBaseIndices(core);
            expect(result).toEqual([0]);
        });

        it('锁定列表为空数组时回退到实时计算', () => {
            const core = makeMinimalCore({
                bases: [makeBase(BASE_JUNGLE)],  // breakpoint=12, 力量=0
                scoringEligibleBaseIndices: [],
            });
            const result = getScoringEligibleBaseIndices(core);
            expect(result).toEqual([]);  // 力量 0 < breakpoint 12
        });

        it('锁定列表不存在时回退到实时计算', () => {
            const core = makeMinimalCore({
                bases: [
                    makeBase(BASE_JUNGLE, [  // breakpoint=12
                        makeMinion('m1', '0', 6),
                        makeMinion('m2', '1', 8),
                    ]),
                ],
            });
            const result = getScoringEligibleBaseIndices(core);
            // 总力量 14 >= breakpoint 12
            expect(result).toEqual([0]);
        });

        it('力量降低后锁定列表不受影响', () => {
            // 模拟：进入 scoreBases 时力量=14 >= breakpoint=12，锁定了 [0]
            // Me First! 中承受压力降低力量到 10 < 12
            const core = makeMinimalCore({
                bases: [
                    makeBase(BASE_JUNGLE, [  // breakpoint=12
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '1', 5),  // 总力量=10 < 12
                    ]),
                ],
                scoringEligibleBaseIndices: [0],  // 进入阶段时锁定
            });

            // 实时计算应该返回空（力量不够）
            const totalPower = getTotalEffectivePowerOnBase(core, core.bases[0], 0);
            const bp = getEffectiveBreakpoint(core, 0);
            expect(totalPower).toBeLessThan(bp);

            // 但统一查询函数应该返回锁定列表
            const result = getScoringEligibleBaseIndices(core);
            expect(result).toEqual([0]);
        });

        it('实时查询不会返回旧锁定列表里不再达标的未选择基地', () => {
            const core = makeMinimalCore({
                bases: [
                    makeBase(BASE_JUNGLE, [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '1', 5),
                    ]),
                ],
                scoringEligibleBaseIndices: [0],
            });

            expect(getScoringEligibleBaseIndices(core)).toEqual([0]);
            expect(getRealtimeScoringEligibleBaseIndices(core)).toEqual([]);
        });

        it('锁定列表包含重复索引时应保序去重，避免重复计分/重复交互选项', () => {
            const core = makeMinimalCore({
                bases: [
                    makeBase(BASE_JUNGLE),
                    makeBase(BASE_TAR_PITS),
                    makeBase(BASE_NINJA_DOJO),
                ],
                scoringEligibleBaseIndices: [2, 2, 0, 2, 0],
            });

            const result = getScoringEligibleBaseIndices(core);
            expect(result).toEqual([2, 0]);
        });
    });

    describe('正常 scoreBases session 重新检查', () => {
        it('进入 scoreBases 时只建立候选 session，不写阶段级锁定事件', () => {
            const core = makeMinimalCore({
                bases: [
                    makeBase(BASE_JUNGLE, [
                        makeMinion('j0', '0', 6),
                        makeMinion('j1', '1', 8),
                    ]),
                    makeBase(BASE_TAR_PITS, [
                        makeMinion('t0', '0', 9),
                        makeMinion('t1', '1', 8),
                    ]),
                ],
            });
            const sys = createInitialSystemState([...TEST_PLAYER_IDS], smashUpSystemsForTest, undefined);
            sys.phase = 'playCards';
            const state: MatchState<SmashUpCore> = { core, sys };

            const phaseEnter = smashUpFlowHooks.onPhaseEnter?.({
                state,
                from: 'playCards',
                to: 'scoreBases',
                command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 } as any,
                random: testRandom,
            }) as { events: SmashUpEvent[]; updatedState: MatchState<SmashUpCore> };

            expect(phaseEnter.events.map(event => event.type)).not.toContain(SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED);
            expect(phaseEnter.updatedState.core.scoringEligibleBaseIndices).toBeUndefined();
            expect(getScoringSession(phaseEnter.updatedState)?.lockedBaseRefs.map(ref => ref.slotIndex)).toEqual([0, 1]);
        });

        it('已完成一个基地后，会重新检查并丢弃不再达标的旧候选基地', () => {
            const core = makeMinimalCore({
                bases: [
                    makeBase(BASE_JUNGLE, [
                        makeMinion('j0', '0', 6),
                        makeMinion('j1', '1', 8),
                    ]),
                    makeBase(BASE_TAR_PITS, [
                        makeMinion('t0', '0', 4),
                        makeMinion('t1', '1', 4),
                    ]),
                ],
            });
            const sys = createInitialSystemState([...TEST_PLAYER_IDS], smashUpSystemsForTest, undefined);
            sys.phase = 'scoreBases';
            let state: MatchState<SmashUpCore> = { core, sys };
            const completedRef = createScoringBaseRef(core, 0);
            const staleRef = createScoringBaseRef(core, 1);
            expect(completedRef).toBeDefined();
            expect(staleRef).toBeDefined();
            state = setScoringSession(state, {
                ...createScoringSession(core, [0, 1]),
                lockedBaseRefs: [completedRef!, staleRef!],
                completedBaseRefs: [completedRef!],
            });

            const phaseExit = smashUpFlowHooks.onPhaseExit?.({
                state,
                from: 'scoreBases',
                command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 2 } as any,
                random: testRandom,
            }) as { events: SmashUpEvent[]; updatedState: MatchState<SmashUpCore> };

            expect(phaseExit.events.map(event => event.type)).not.toContain(SU_EVENTS.BASE_SCORED);
            expect(getScoringSession(phaseExit.updatedState)).toBeUndefined();
        });
    });

    describe('SCORING_ELIGIBLE_BASES_LOCKED 事件 reduce', () => {
        it('正确写入 scoringEligibleBaseIndices', () => {
            const core = makeMinimalCore({ bases: [makeBase(BASE_JUNGLE)] });
            expect(core.scoringEligibleBaseIndices).toBeUndefined();

            const updated = reduce(core, {
                type: SU_EVENT_TYPES.SCORING_ELIGIBLE_BASES_LOCKED,
                payload: { baseIndices: [0, 2] },
                timestamp: 1,
            } as any);
            expect(updated.scoringEligibleBaseIndices).toEqual([0, 2]);
        });

        it('写入锁定列表时应去重，避免后续重复消费同一基地', () => {
            const core = makeMinimalCore({ bases: [makeBase(BASE_JUNGLE), makeBase(BASE_TAR_PITS)] });

            const updated = reduce(core, {
                type: SU_EVENT_TYPES.SCORING_ELIGIBLE_BASES_LOCKED,
                payload: { baseIndices: [1, 1, 0, 1] },
                timestamp: 1,
            } as any);

            expect(updated.scoringEligibleBaseIndices).toEqual([1, 0]);
        });
    });

    describe('BASE_CLEARED 事件清理锁定列表', () => {
        it('计分后从锁定列表中移除已计分基地', () => {
            const core = makeMinimalCore({
                bases: [
                    makeBase(BASE_JUNGLE),
                    makeBase(BASE_TAR_PITS),
                    makeBase(BASE_NINJA_DOJO),
                ],
                scoringEligibleBaseIndices: [0, 2],
            });

            // 清除基地 0
            const updated = reduce(core, {
                type: SU_EVENT_TYPES.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: BASE_JUNGLE },
                timestamp: 1,
            } as any);
            // 基地 0 被移除，原索引 2 变为 1（数组收缩）
            expect(updated.scoringEligibleBaseIndices).toEqual([1]);
        });

        it('所有基地计分完后锁定列表清空', () => {
            const core = makeMinimalCore({
                bases: [makeBase(BASE_JUNGLE)],
                scoringEligibleBaseIndices: [0],
            });

            const updated = reduce(core, {
                type: SU_EVENT_TYPES.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: BASE_JUNGLE },
                timestamp: 1,
            } as any);
            expect(updated.scoringEligibleBaseIndices).toBeUndefined();
        });
    });

    describe('TURN_STARTED 事件清理锁定列表', () => {
        it('回合开始时清空锁定列表', () => {
            const core = makeMinimalCore({
                bases: [makeBase(BASE_JUNGLE)],
                scoringEligibleBaseIndices: [0],
            });

            const updated = reduce(core, {
                type: SU_EVENT_TYPES.TURN_STARTED,
                payload: { playerId: '0', turnNumber: 2 },
                timestamp: 1,
            } as any);
            expect(updated.scoringEligibleBaseIndices).toBeUndefined();
        });
    });

    describe('完整流程回归', () => {
        it('Me First! 特殊牌把基地压到 breakpoint 以下后，已触发的基地仍然计分并完成收尾', () => {
            const runner = createRunner((ids) => {
                const core = makeMinimalCore({
                    bases: [
                        makeBase(BASE_JUNGLE, [
                            {
                                ...makeMinion('source', '0', 3),
                                defId: 'giant_ant_worker',
                                powerCounters: 3,
                            },
                            {
                                ...makeMinion('enemy', '1', 6),
                                defId: 'ninja_shinobi',
                            },
                        ]),
                        makeBase('base_the_hive', [
                            {
                                ...makeMinion('target', '0', 2),
                                defId: 'robot_microbot_alpha',
                            },
                        ]),
                    ],
                    baseDeck: ['base_the_hill'],
                });
                const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
                sys.phase = 'playCards';
                core.players['0'].hand = [
                    { uid: 'under-pressure', defId: 'giant_ant_under_pressure', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [];
                return { core, sys };
            });

            const advanceResult = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
            expect(advanceResult.success).toBe(true);

            const reactionPrompt = getSimpleChoicePrompt(runner.getState(), 'smashup_reaction_choose');
            const playUnderPressure = getPromptOption(
                reactionPrompt,
                (option: any) => option?.value?.kind === 'play_action'
                    && option?.value?.cardUid === 'under-pressure'
                    && option?.value?.targetBaseIndex === 0,
                'Under Pressure Me First play option',
            );
            const playResult = runner.resolveInteraction('0', { optionId: playUnderPressure.id });
            expect(playResult.success, playResult.error).toBe(true);

            const sourcePrompt = getSimpleChoicePrompt(runner.getState(), 'giant_ant_under_pressure_choose_source');
            const sourceOption = getPromptOption(
                sourcePrompt,
                (option: any) => option?.value?.minionUid === 'source',
                'Under Pressure source minion option',
            );
            const chooseSource = runner.resolveInteraction('0', { optionId: sourceOption.id });
            expect(chooseSource.success, chooseSource.error).toBe(true);

            const targetPrompt = getSimpleChoicePrompt(runner.getState(), 'giant_ant_under_pressure_choose_target');
            const targetOption = getPromptOption(
                targetPrompt,
                (option: any) => option?.value?.minionUid === 'target',
                'Under Pressure target minion option',
            );
            const chooseTarget = runner.resolveInteraction('0', { optionId: targetOption.id });
            expect(chooseTarget.success, chooseTarget.error).toBe(true);

            const chooseAmount = runner.resolveInteraction('0', {
                optionId: 'confirm-transfer',
                mergedValue: { amount: 3, value: 3 },
            });
            expect(chooseAmount.success, chooseAmount.error).toBe(true);

            const passEvents = passResponseWindowToClose(runner);

            const eventTypes = [
                ...advanceResult.events,
                ...playResult.events,
                ...chooseSource.events,
                ...chooseTarget.events,
                ...chooseAmount.events,
                ...passEvents,
            ].map(event => event.type);
            expect(eventTypes).toContain(SU_EVENTS.BASE_SCORED);
            expect(eventTypes).toContain(SU_EVENTS.BASE_CLEARED);
            expect(eventTypes).toContain(SU_EVENTS.BASE_REPLACED);
            expect(runner.getState().sys.phase).not.toBe('scoreBases');
            expect((runner.getState().sys as any).flowHalted).toBeFalsy();
            expect((runner.getState().sys as any)._smashupPostScoringBaseRevealDelayUntil).toBeUndefined();
            expect(runner.getState().core.bases[0]?.defId).toBe('base_the_hill');
            expect(runner.getState().core.scoringEligibleBaseIndices).toBeUndefined();
        });

        it('beforeScoring 触发器把基地压到 breakpoint 以下后，已触发的基地仍然计分并完成收尾', () => {
            const runner = createRunner((ids) => {
                const core = makeMinimalCore({
                    bases: [
                        makeBase(BASE_JUNGLE, [
                            {
                                ...makeMinion('host', '0', 10),
                                defId: 'robot_microbot_alpha',
                                attachedActions: [{ uid: 'dh1', defId: 'elder_thing_dunwich_horror_pod', ownerId: '0' }],
                            },
                            {
                                ...makeMinion('enemy', '1', 2),
                                defId: 'ninja_shinobi',
                            },
                        ]),
                        makeBase('base_the_hive'),
                    ],
                    baseDeck: ['base_secret_garden'],
                });
                const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
                sys.phase = 'playCards';
                core.players['0'].hand = [];
                core.players['1'].hand = [];
                return { core, sys };
            });

            const advanceResult = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
            expect(advanceResult.success).toBe(true);
            expect(getSimpleChoicePrompt(runner.getState(), 'elder_thing_dunwich_horror_pod_choice')).toBeDefined();

            const chooseDestroy = runner.resolveInteraction('0', { optionId: 'destroy' });
            expect(chooseDestroy.success).toBe(true);

            const eventTypes = [
                ...advanceResult.events,
                ...chooseDestroy.events,
            ].map(event => event.type);

            expect(eventTypes).toContain(SU_EVENTS.MINION_DESTROYED);
            expect(eventTypes).toContain(SU_EVENTS.BASE_SCORED);
            expect(eventTypes).toContain(SU_EVENTS.BASE_CLEARED);
            expect(eventTypes).toContain(SU_EVENTS.BASE_REPLACED);
            expect(runner.getState().sys.phase).not.toBe('scoreBases');
            expect((runner.getState().sys as any).flowHalted).toBeFalsy();
            expect((runner.getState().sys as any)._smashupPostScoringBaseRevealDelayUntil).toBeUndefined();
            expect(runner.getState().core.bases[0]?.defId).toBe('base_secret_garden');
            expect(runner.getState().core.scoringEligibleBaseIndices).toBeUndefined();
        });
    });
});
