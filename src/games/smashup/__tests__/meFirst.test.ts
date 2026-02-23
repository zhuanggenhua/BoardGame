/**
 * Me First! 响应窗口测试
 *
 * 覆盖：
 * - Property 10: Me First! 响应机制
 * - 无基地达标时不打开响应窗口（直接跳过 scoreBases）
 * - 有基地达标时打开响应窗口
 * - 所有玩家让过后自动关闭
 * - 完整回合循环
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent, MinionOnBase } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { clearRegistry, clearBaseAbilityRegistry } from '../domain';
import { resetAbilityInit } from '../abilities';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { smashUpSystemsForTest } from '../game';
import { INTERACTION_COMMANDS, asSimpleChoice } from '../../../engine/systems/InteractionSystem';

const PLAYER_IDS = ['0', '1'];

const systems = smashUpSystemsForTest;

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: PLAYER_IDS,
    });
}

/** 创建一个 setup 函数，在标准初始化后给第一个基地注入高力量随从 */
function setupWithBreakpoint(ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> {
    const core = SmashUpDomain.setup(ids, random);
    const sys = createInitialSystemState(ids, systems, undefined);
    core.factionSelection = undefined;
    sys.phase = 'playCards';
    // 给第一个基地注入足够力量的随从使其达到临界点
    if (core.bases.length > 0) {
        const fakeMinions: MinionOnBase[] = Array.from({ length: 10 }, (_, i) => ({
            uid: `fake-${i}`,
            defId: 'test_minion',
            owner: '0',
            controller: '0',
            basePower: 5,
            powerModifier: 0,
            tempPowerModifier: 0,
            attachedActions: [],
            talentUsed: false,
        }));
        core.bases[0] = { ...core.bases[0], minions: [...core.bases[0].minions, ...fakeMinions] };
    }
    // 给每个玩家一张 special 行动卡，使 Me First! 响应窗口不会因无可响应内容而自动关闭
    for (const pid of ids) {
        const player = core.players[pid];
        if (player) {
            player.hand = [
                ...player.hand,
                { uid: `special-${pid}`, defId: 'ninja_hidden_ninja', type: 'action', owner: pid },
            ];
        }
    }
    return { sys, core };
}

/** 达标但没人有特殊行动卡 */
function setupWithBreakpointNoSpecial(ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> {
    const state = setupWithBreakpoint(ids, random);
    for (const pid of ids) {
        const player = state.core.players[pid];
        if (player) {
            player.hand = [];
        }
    }
    return state;
}

/** 达标且仅 0 号玩家有两张特殊行动卡（用于 loopUntilAllPass 边界） */
function setupWithBreakpointOnlyP0TwoSpecial(ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> {
    const state = setupWithBreakpoint(ids, random);
    const p0 = state.core.players['0'];
    if (p0) {
        p0.hand = [
            { uid: 'special-0-a', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
            { uid: 'special-0-b', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
        ];
    }
    const p1 = state.core.players['1'];
    if (p1) {
        p1.hand = [];
    }
    return state;
}

/** 达标且仅 1 号玩家有特殊行动卡 */
function setupWithBreakpointOnlyP1Special(ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> {
    const state = setupWithBreakpoint(ids, random);
    const p0 = state.core.players['0'];
    if (p0) {
        p0.hand = [];
    }
    const p1 = state.core.players['1'];
    if (p1) {
        p1.hand = [
            { uid: 'special-1', defId: 'ninja_hidden_ninja', type: 'action', owner: '1' },
        ];
    }
    return state;
}

/** 蛇形选秀（多轮 afterEvents 自动推进到 playCards） */
const DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
] as any[];

/** 直接从 playCards 推进到 scoreBases（配合 setupWithBreakpoint） */
const BREAKPOINT_COMMANDS = [
    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
] as any[];

/** Me First! 响应：两人都让过 */
const ME_FIRST_PASS_ALL = [
    { type: 'RESPONSE_PASS', playerId: '0', payload: {} },
    { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
] as any[];

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('Me First! 响应窗口', () => {
    it('无基地达标时不打开 Me First! 响应窗口，自动推进到下一回合', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '无基地达标跳过响应窗口',
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → 多轮自动推进（scoreBases→draw→endTurn→startTurn(P1)→playCards(P1)）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 无基地达标，scoreBases 直接跳过，多轮自动推进到 P1 的 playCards
        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
    });

    it('有基地达标时打开 Me First! 响应窗口', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithBreakpoint,
        });
        const result = runner.run({
            name: '有基地达标打开响应窗口',
            commands: [
                // playCards → scoreBases（基地达标，Me First! 打开）
                ...BREAKPOINT_COMMANDS,
            ] as any[],
        });

        // 应该停在 scoreBases，响应窗口打开
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.sys.responseWindow.current).toBeTruthy();
        expect(result.finalState.sys.responseWindow.current?.windowType).toBe('meFirst');
        expect(result.finalState.sys.responseWindow.current?.responderQueue).toEqual(['0', '1']);
    });
    it('有基地达标但无人有特殊行动卡时，响应窗口自动关闭并推进', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithBreakpointNoSpecial,
        });
        const result = runner.run({
            name: '无人可响应自动关闭',
            commands: [
                ...BREAKPOINT_COMMANDS,
            ] as any[],
        });

        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        expect(result.finalState.sys.phase).not.toBe('scoreBases');
        const allEventTypes = result.steps.flatMap(s => s.events);
        expect(allEventTypes).toContain(RESPONSE_WINDOW_EVENTS.OPENED);
        expect(allEventTypes).toContain(RESPONSE_WINDOW_EVENTS.CLOSED);
    });

    it('有基地达标时跳过无特殊牌玩家，从有特殊牌玩家开始响应', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithBreakpointOnlyP1Special,
        });
        const result = runner.run({
            name: '跳过无特殊牌响应者',
            commands: [
                ...BREAKPOINT_COMMANDS,
            ] as any[],
        });

        const window = result.finalState.sys.responseWindow.current;
        expect(window).toBeTruthy();
        expect(window?.responderQueue).toEqual(['0', '1']);
        expect(window?.currentResponderIndex).toBe(1);
        expect(window?.passedPlayers).toEqual(['0']);
    });

    it('有基地达标时所有玩家让过后关闭响应窗口', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithBreakpoint,
        });
        const result = runner.run({
            name: '响应窗口关闭并推进 draw',
            commands: [
                ...BREAKPOINT_COMMANDS,
                ...ME_FIRST_PASS_ALL,
            ] as any[],
        });

        // 响应窗口关闭
        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
    });

    it('事件流中包含 RESPONSE_WINDOW_OPENED 和 RESPONSE_WINDOW_CLOSED', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithBreakpoint,
        });
        const result = runner.run({
            name: '事件流包含响应窗口事件',
            commands: [
                ...BREAKPOINT_COMMANDS,
                ...ME_FIRST_PASS_ALL,
            ] as any[],
        });

        const allEventTypes = result.steps.flatMap(s => s.events);
        expect(allEventTypes).toContain(RESPONSE_WINDOW_EVENTS.OPENED);
        expect(allEventTypes).toContain(RESPONSE_WINDOW_EVENTS.CLOSED);
    });

    it('loopUntilAllPass：玩家打出 special 后循环重启，全部 pass 才关闭', () => {
        // 自定义 setup：P0 只有 special 卡（无随从），P1 有 special 卡
        // ninja_hidden_ninja 在无手牌随从时不产生 Interaction，直接完成
        const setupSpecialOnly = (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const state = setupWithBreakpoint(ids, random);
            // P0 只保留 special 卡，清除其他手牌（确保无随从可选，hidden_ninja 直接完成）
            const p0 = state.core.players['0'];
            if (p0) {
                p0.hand = [
                    { uid: 'special-0', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
                ];
            }
            return state;
        };
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupSpecialOnly,
        });
        const result = runner.run({
            name: 'loopUntilAllPass 循环',
            commands: [
                // 进入 scoreBases，打开 Me First! 窗口
                ...BREAKPOINT_COMMANDS,
                // P0 打出 special 卡（无随从可选，效果为空，但 ACTION_PLAYED 事件触发推进）
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'special-0', targetBaseIndex: 0 } },
                // P1 让过 → 到达队列末尾，但本轮有人出牌 → 循环重启
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
                // 新一轮：P0 无 special 牌被 skipToNextRespondable 跳过 → P1 让过 → 窗口关闭
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
            ] as any[],
        });

        // 响应窗口应已关闭
        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        // PLAY_ACTION 步骤成功且产生了 action_played 事件
        const playStep = result.steps.find(s => s.commandType === SU_COMMANDS.PLAY_ACTION);
        expect(playStep).toBeDefined();
        expect(playStep!.success).toBe(true);
        expect(playStep!.events).toContain(SU_EVENTS.ACTION_PLAYED);
        // 注意：不检查 finalState 的手牌/弃牌堆，因为 draw 阶段会 reshuffle 弃牌堆回牌库再抽牌
    });

    it('loopUntilAllPass：出牌后尾部全被 skip 时应回到队首继续响应', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithBreakpointOnlyP0TwoSpecial,
        });
        const result = runner.run({
            name: 'loopUntilAllPass 尾部 skip 回队首',
            commands: [
                ...BREAKPOINT_COMMANDS,
                // P0 打出第一张 special；P1 无可响应内容，会被自动 skip
                // 正确行为：窗口应重开到 P0（其手里还有第二张 special）
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'special-0-a', targetBaseIndex: 0 } },
            ] as any[],
        });

        const window = result.finalState.sys.responseWindow.current;
        expect(window).toBeTruthy();
        expect(window?.windowType).toBe('meFirst');
        expect(window?.currentResponderIndex).toBe(0);
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.core.players['0'].hand.some(c => c.uid === 'special-0-b')).toBe(true);
    });

    it('loopUntilAllPass：无人出牌时一轮 pass 即关闭', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithBreakpoint,
        });
        const result = runner.run({
            name: 'loopUntilAllPass 一轮全 pass',
            commands: [
                ...BREAKPOINT_COMMANDS,
                // 两人都 pass，无人出牌 → 一轮即关闭（不循环）
                ...ME_FIRST_PASS_ALL,
            ] as any[],
        });

        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        // 两人的 special 卡仍在手牌
        expect(result.finalState.core.players['0'].hand.find(c => c.uid === 'special-0')).toBeTruthy();
        expect(result.finalState.core.players['1'].hand.find(c => c.uid === 'special-1')).toBeTruthy();
    });

    it('完整回合循环（无基地达标时跳过 Me First!）', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '完整回合无 meFirst',
            commands: [
                ...DRAFT_COMMANDS,
                // P0 回合：playCards → 多轮自动推进到 P1 的 playCards
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P1 回合：playCards → 多轮自动推进到 P0 的 playCards
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
            ] as any[],
        });

        // P0 的第二回合，playCards 阶段
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(0);
    });

    it('P1 为当前玩家时，Me First! 响应队列从 P1 开始', () => {
        // 场景：P1 的回合，基地达标，Me First! 打开
        // 预期：responderQueue 应为 ['1', '0']，从当前玩家 P1 开始
        const setupP1Turn = (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const state = setupWithBreakpoint(ids, random);
            // 将当前玩家切换到 P1
            state.core.currentPlayerIndex = 1;
            return state;
        };
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupP1Turn,
        });
        const result = runner.run({
            name: 'P1回合达标打开响应窗口',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('scoreBases');
        const window = result.finalState.sys.responseWindow.current;
        expect(window).toBeTruthy();
        expect(window?.windowType).toBe('meFirst');
        // 关键断言：队列从 P1 开始
        expect(window?.responderQueue).toEqual(['1', '0']);
    });

    it('Me First! 窗口内打出带 interaction 的 special 卡，交互完成后响应窗口正确推进', () => {
        // 场景：P0 在 Me First! 窗口内打出 miskatonic_mandatory_reading（需要选随从+选抽牌数）
        // 预期：打出后响应窗口被 pendingInteractionId 锁定，交互完成后自动推进到 P1
        const MADNESS_DECK = Array.from({ length: 5 }, (_, i) => ({
            uid: `madness-${i}`, defId: 'madness', type: 'action' as const, owner: '0',
        }));
        const setupWithMandatoryReading = (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const state = setupWithBreakpoint(ids, random);
            const p0 = state.core.players['0'];
            if (p0) {
                p0.hand = [
                    { uid: 'mandatory-1', defId: 'miskatonic_mandatory_reading', type: 'action', owner: '0' },
                ];
            }
            // 基地上放一个随从供选择
            state.core.bases[0] = {
                ...state.core.bases[0],
                minions: [
                    ...state.core.bases[0].minions,
                    {
                        uid: 'target-minion', defId: 'test_minion', owner: '0', controller: '0',
                        basePower: 3, powerModifier: 0, tempPowerModifier: 0, attachedActions: [], talentUsed: false,
                    },
                ],
            };
            // 注入疯狂卡牌库
            (state.core as any).madnessDeck = MADNESS_DECK;
            return state;
        };

        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithMandatoryReading,
        });

        // Step 1: 进入 scoreBases，打开 Me First! 窗口
        const r1 = runner.run({
            name: 'mandatory_reading: 进入 scoreBases',
            commands: [...BREAKPOINT_COMMANDS] as any[],
        });
        expect(r1.finalState.sys.responseWindow.current?.windowType).toBe('meFirst');
        expect(r1.finalState.sys.responseWindow.current?.currentResponderIndex).toBe(0);

        // Step 2: P0 打出 mandatory_reading → 产生 interaction（选随从）
        const runner2 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS,
            setup: () => r1.finalState,
        });
        const r2 = runner2.run({
            name: 'mandatory_reading: P0 打出 special',
            commands: [{ type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'mandatory-1', targetBaseIndex: 0 } }] as any[],
        });
        expect(r2.steps[0]?.success).toBe(true);
        // 响应窗口应被锁定（pendingInteractionId 已设置）
        expect(r2.finalState.sys.responseWindow.current?.pendingInteractionId).toBeTruthy();
        // 有活跃的 interaction（选随从）
        const choice1 = asSimpleChoice(r2.finalState.sys.interaction.current);
        expect(choice1).toBeDefined();

        // Step 3: 选择随从
        const runner3 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS,
            setup: () => r2.finalState,
        });
        const minionOpt = choice1!.options.find((o: any) => o.value?.minionUid === 'target-minion');
        expect(minionOpt).toBeDefined();
        const r3 = runner3.run({
            name: 'mandatory_reading: 选随从',
            commands: [{ type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: minionOpt!.id } }] as any[],
        });
        expect(r3.steps[0]?.success).toBe(true);
        // 现在应该有第二个 interaction（选抽牌数）
        const choice2 = asSimpleChoice(r3.finalState.sys.interaction.current);
        expect(choice2).toBeDefined();
        // 响应窗口仍被锁定（第二步 interaction 还未完成）
        expect(r3.finalState.sys.responseWindow.current?.pendingInteractionId).toBeTruthy();

        // Step 4: 选择抽1张疯狂卡
        const runner4 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS,
            setup: () => r3.finalState,
        });
        const drawOpt = choice2!.options.find((o: any) => o.value?.count === 1);
        expect(drawOpt).toBeDefined();
        const r4 = runner4.run({
            name: 'mandatory_reading: 选抽1张',
            commands: [{ type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: drawOpt!.id } }] as any[],
        });
        expect(r4.steps[0]?.success).toBe(true);

        // 关键断言：交互完成后，响应窗口应自动推进到 P1（pendingInteractionId 清除，currentResponderIndex=1）
        expect(r4.finalState.sys.interaction.current).toBeUndefined();
        expect(r4.finalState.sys.responseWindow.current?.pendingInteractionId).toBeUndefined();
        expect(r4.finalState.sys.responseWindow.current?.currentResponderIndex).toBe(1);
        // 疯狂卡已抽到 P0 手牌（defId 为 MADNESS_CARD_DEF_ID = 'special_madness'）
        expect(r4.finalState.core.players['0'].hand.some((c: any) => c.defId === 'special_madness')).toBe(true);
    });

    it('Me First! 窗口内打出带 interaction 的 special 卡，选择跳过时响应窗口也正确推进', () => {
        // 场景：P0 打出 miskatonic_mandatory_reading，第二步选择"不抽"（skip）
        // 预期：skip 后响应窗口同样推进到 P1，不卡死
        const MADNESS_DECK_SKIP = Array.from({ length: 3 }, (_, i) => ({
            uid: `madness-skip-${i}`, defId: 'special_madness', type: 'action' as const, owner: '0',
        }));
        const setupSkip = (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const state = setupWithBreakpoint(ids, random);
            const p0 = state.core.players['0'];
            if (p0) {
                p0.hand = [{ uid: 'mandatory-skip', defId: 'miskatonic_mandatory_reading', type: 'action', owner: '0' }];
            }
            state.core.bases[0] = {
                ...state.core.bases[0],
                minions: [...state.core.bases[0].minions, {
                    uid: 'skip-minion', defId: 'test_minion', owner: '0', controller: '0',
                    basePower: 3, powerModifier: 0, tempPowerModifier: 0, attachedActions: [], talentUsed: false,
                }],
            };
            (state.core as any).madnessDeck = MADNESS_DECK_SKIP;
            return state;
        };

        const r1 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS, setup: setupSkip,
        }).run({ name: 'skip: 进入 scoreBases', commands: [...BREAKPOINT_COMMANDS] as any[] });
        expect(r1.finalState.sys.responseWindow.current?.windowType).toBe('meFirst');

        // P0 打出 mandatory_reading
        const r2 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS, setup: () => r1.finalState,
        }).run({
            name: 'skip: 打出 special',
            commands: [{ type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'mandatory-skip', targetBaseIndex: 0 } }] as any[],
        });
        expect(r2.steps[0]?.success).toBe(true);
        const choice1 = asSimpleChoice(r2.finalState.sys.interaction.current);
        expect(choice1).toBeDefined();

        // 选随从
        const minionOpt = choice1!.options.find((o: any) => o.value?.minionUid === 'skip-minion');
        const r3 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS, setup: () => r2.finalState,
        }).run({
            name: 'skip: 选随从',
            commands: [{ type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: minionOpt!.id } }] as any[],
        });
        expect(r3.steps[0]?.success).toBe(true);
        const choice2 = asSimpleChoice(r3.finalState.sys.interaction.current);
        expect(choice2).toBeDefined();

        // 选择"不抽"（skip）
        const skipOpt = choice2!.options.find((o: any) => o.value?.skip === true);
        expect(skipOpt).toBeDefined();
        const r4 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS, setup: () => r3.finalState,
        }).run({
            name: 'skip: 选不抽',
            commands: [{ type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: skipOpt!.id } }] as any[],
        });
        expect(r4.steps[0]?.success).toBe(true);
        // 交互完成，响应窗口推进到 P1
        expect(r4.finalState.sys.interaction.current).toBeUndefined();
        expect(r4.finalState.sys.responseWindow.current?.pendingInteractionId).toBeUndefined();
        expect(r4.finalState.sys.responseWindow.current?.currentResponderIndex).toBe(1);
        // 没有疯狂卡被抽取
        expect(r4.finalState.core.players['0'].hand.some((c: any) => c.defId === 'special_madness')).toBe(false);
    });
});
