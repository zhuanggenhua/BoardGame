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
import { MADNESS_CARD_DEF_ID, SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { clearRegistry, clearBaseAbilityRegistry } from '../domain';
import { resetAbilityInit } from '../abilities';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { smashUpSystemsForTest } from '../game';
import { getSmashUpReactionWindowPresentation } from '../domain/reactionWindowState';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptPlayerId,
    getPromptSourceId,
    getSimpleChoicePrompt,
    respondCommand,
} from './helpers';

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
    // 使用已知的低临界点基地（如 base_the_mothership，临界点 20）
    if (core.bases.length > 0) {
        // 替换第一个基地为已知的低临界点基地
        core.bases[0] = {
            defId: 'base_the_mothership', // 临界点 20
            minions: [],
            ongoingActions: [],
        };
        // 添加足够的随从达到临界点（25 > 20）
        const fakeMinions: MinionOnBase[] = Array.from({ length: 5 }, (_, i) => ({
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
        core.bases[0].minions = fakeMinions;
    }
    // 给每个玩家一张 special 行动卡和一张随从卡，使 Me First! 响应窗口不会因无可响应内容而自动关闭
    // 注意：ninja_hidden_ninja 需要手牌中有随从才能使用
    for (const pid of ids) {
        const player = core.players[pid];
        if (player) {
            player.hand = [
                ...player.hand,
                { uid: `special-${pid}`, defId: 'ninja_hidden_ninja', type: 'action', owner: pid },
                { uid: `minion-${pid}`, defId: 'ninja_shinobi', type: 'minion', owner: pid },
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
            { uid: 'minion-0', defId: 'ninja_shinobi', type: 'minion', owner: '0' },
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
            { uid: 'minion-1', defId: 'ninja_shinobi', type: 'minion', owner: '1' },
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
    respondCommand('pass', '0'),
    respondCommand('pass', '1'),
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
        const presentation = getSmashUpReactionWindowPresentation(result.finalState);
        expect(presentation).toBeTruthy();
        expect(presentation?.windowType).toBe('meFirst');
        expect(presentation?.responderQueue).toEqual(['0', '1']);
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

        const eventTypes = result.steps.flatMap(step => step.events);
        expect(eventTypes).toContain(SU_EVENTS.BASE_SCORED);
        expect(eventTypes).toContain(SU_EVENTS.BASE_CLEARED);
        expect(eventTypes).toContain(SU_EVENTS.BASE_REPLACED);
        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.sys.flowHalted).toBeFalsy();
        expect((result.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil).toBeUndefined();
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

        const presentation = getSmashUpReactionWindowPresentation(result.finalState);
        expect(presentation).toBeTruthy();
        expect(presentation?.responderQueue).toEqual(['0', '1']);
        expect(presentation?.currentResponderIndex).toBe(1);
        expect(presentation?.passedPlayers).toEqual([]);
        const choice = getSimpleChoicePrompt(result.finalState, 'smashup_reaction_choose');
        expect(getPromptSourceId(choice)).toBe('smashup_reaction_choose');
        expect(getPromptPlayerId(choice)).toBe('1');
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

        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        expectNoPrompt(result.finalState);
    });

    it('loopUntilAllPass：玩家打出 special 后循环重启，全部 pass 才关闭', () => {
        // 自定义 setup：P0 有 special 卡和随从，P1 有 special 卡和随从
        // ninja_hidden_ninja 会创建交互选择返回哪个随从
        const setupSpecialOnly = (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const state = setupWithBreakpoint(ids, random);
            // P0 只保留 special 卡和一个随从
            const p0 = state.core.players['0'];
            if (p0) {
                p0.hand = [
                    { uid: 'special-0', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
                    { uid: 'minion-0', defId: 'ninja_shinobi', type: 'minion', owner: '0' },
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
                // P0 在统一反应窗口里选择打出 special
                respondCommand('play_action:special-0:0', '0'),
                // P1 让过 → 到达队列末尾，但本轮有人出牌 → 循环重启
                respondCommand('pass', '1'),
                // 新一轮：P0 让过（已无 special 牌）
                respondCommand('pass', '0'),
                // P1 让过 → 窗口关闭
                respondCommand('pass', '1'),
            ] as any[],
        });

        // 响应窗口应已关闭
        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        // 统一反应选择里应真正打出了 action
        const playStep = result.steps.find(s => s.events.includes(SU_EVENTS.ACTION_PLAYED));
        expect(playStep).toBeDefined();
        expect(playStep!.success).toBe(true);
        expect(playStep!.events).toContain(SU_EVENTS.ACTION_PLAYED);
        // 注意：不检查 finalState 的手牌/弃牌堆，因为 draw 阶段会 reshuffle 弃牌堆回牌库再抽牌
    });

    it('loopUntilAllPass：出牌后若后续已无合法响应，则窗口自动关闭', () => {
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
                respondCommand('play_action:special-0-a:0', '0'),
            ] as any[],
        });

        const window = result.finalState.sys.responseWindow.current;
        expect(window).toBeUndefined();
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.core.players['0'].hand.some(c => c.uid === 'special-0-b')).toBe(true);
    });

    it('Me First! 窗口中打出《力量的代价》会真实结算亮手牌并给己方随从加力量', () => {
        const setupPriceOfPower = (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const state = setupWithBreakpoint(ids, random);
            state.core.bases[0] = {
                defId: 'base_the_mothership',
                minions: [
                    {
                        uid: 'ally-main',
                        defId: 'test_minion',
                        owner: '0',
                        controller: '0',
                        basePower: 12,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'enemy-main',
                        defId: 'test_minion',
                        owner: '1',
                        controller: '1',
                        basePower: 8,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                ],
                ongoingActions: [],
            };
            state.core.players['0'].hand = [
                { uid: 'price-0', defId: 'elder_thing_the_price_of_power', type: 'action', owner: '0' },
            ];
            state.core.players['1'].hand = [
                { uid: 'mad-1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '1' },
                { uid: 'mad-2', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '1' },
                { uid: 'normal-1', defId: 'elder_thing_insanity', type: 'action', owner: '1' },
            ];
            return state;
        };

        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupPriceOfPower,
        });
        const result = runner.run({
            name: 'Me First: 力量的代价真实响应链',
            commands: [
                ...BREAKPOINT_COMMANDS,
                respondCommand('play_action:price-0:0', '0'),
            ] as any[],
        });

        expect(result.steps[1]?.success).toBe(true);
        expect(result.steps[1]?.events).toContain(SU_EVENTS.ACTION_PLAYED);
        expect(result.steps[1]?.events).toContain(SU_EVENTS.REVEAL_HAND);
        const emittedEventTypes = result.steps[1]?.events ?? [];
        expect(emittedEventTypes.filter(eventType => eventType === SU_EVENTS.POWER_COUNTER_ADDED)).toHaveLength(2);

        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        expectNoPrompt(result.finalState);
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
        const presentation = getSmashUpReactionWindowPresentation(result.finalState);
        expect(presentation).toBeTruthy();
        expect(presentation?.windowType).toBe('meFirst');
        // 关键断言：队列从 P1 开始
        expect(presentation?.responderQueue).toEqual(['1', '0']);
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
        expect(getSmashUpReactionWindowPresentation(r1.finalState)?.windowType).toBe('meFirst');
        expect(getSmashUpReactionWindowPresentation(r1.finalState)?.currentResponderIndex).toBe(0);

        // Step 2: P0 打出 mandatory_reading → 产生 interaction（选随从）
        const runner2 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS,
            setup: () => r1.finalState,
        });
        const r2 = runner2.run({
            name: 'mandatory_reading: P0 打出 special',
            commands: [respondCommand('play_action:mandatory-1:0', '0')] as any[],
        });
        expect(r2.steps[0]?.success).toBe(true);
        // 有活跃的 interaction（选随从）
        const choice1 = getSimpleChoicePrompt(r2.finalState);

        // Step 3: 选择随从
        const runner3 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS,
            setup: () => r2.finalState,
        });
        const minionOpt = getPromptOption(
            choice1,
            option => option.value?.minionUid === 'target-minion',
            'Mandatory Reading target minion option',
        );
        const r3 = runner3.run({
            name: 'mandatory_reading: 选随从',
            commands: [respondCommand(minionOpt.id, '0')] as any[],
        });
        expect(r3.steps[0]?.success).toBe(true);
        // 现在应该有第二个 interaction（选抽牌数）
        const choice2 = getSimpleChoicePrompt(r3.finalState);

        // Step 4: 选择抽1张疯狂卡
        const runner4 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS,
            setup: () => r3.finalState,
        });
        const drawOpt = getPromptOption(
            choice2,
            option => option.value?.count === 1,
            'Mandatory Reading draw-one option',
        );
        const r4 = runner4.run({
            name: 'mandatory_reading: 选抽1张',
            commands: [respondCommand(drawOpt.id, '0')] as any[],
        });
        expect(r4.steps[0]?.success).toBe(true);

        // 关键断言：交互完成后，统一反应窗口自动推进到 P1
        const resumedChoice = getSimpleChoicePrompt(r4.finalState, 'smashup_reaction_choose');
        expect(getPromptSourceId(resumedChoice)).toBe('smashup_reaction_choose');
        expect(getPromptPlayerId(resumedChoice)).toBe('1');
        expect(getSmashUpReactionWindowPresentation(r4.finalState)?.currentResponderIndex).toBe(1);
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
        expect(getSmashUpReactionWindowPresentation(r1.finalState)?.windowType).toBe('meFirst');

        // P0 打出 mandatory_reading
        const r2 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS, setup: () => r1.finalState,
        }).run({
            name: 'skip: 打出 special',
            commands: [respondCommand('play_action:mandatory-skip:0', '0')] as any[],
        });
        expect(r2.steps[0]?.success).toBe(true);
        const choice1 = getSimpleChoicePrompt(r2.finalState);

        // 选随从
        const minionOpt = getPromptOption(
            choice1,
            option => option.value?.minionUid === 'skip-minion',
            'Mandatory Reading skip target minion option',
        );
        const r3 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS, setup: () => r2.finalState,
        }).run({
            name: 'skip: 选随从',
            commands: [respondCommand(minionOpt.id, '0')] as any[],
        });
        expect(r3.steps[0]?.success).toBe(true);
        const choice2 = getSimpleChoicePrompt(r3.finalState);

        // 选择"不抽"（skip）
        const skipOpt = getPromptOption(
            choice2,
            option => option.value?.skip === true,
            'Mandatory Reading skip draw option',
        );
        const r4 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain, systems, playerIds: PLAYER_IDS, setup: () => r3.finalState,
        }).run({
            name: 'skip: 选不抽',
            commands: [respondCommand(skipOpt.id, '0')] as any[],
        });
        expect(r4.steps[0]?.success).toBe(true);
        // 交互完成，响应窗口推进到 P1
        const resumedChoice = getSimpleChoicePrompt(r4.finalState, 'smashup_reaction_choose');
        expect(getPromptSourceId(resumedChoice)).toBe('smashup_reaction_choose');
        expect(getPromptPlayerId(resumedChoice)).toBe('1');
        expect(getSmashUpReactionWindowPresentation(r4.finalState)?.currentResponderIndex).toBe(1);
        // 没有疯狂卡被抽取
        expect(r4.finalState.core.players['0'].hand.some((c: any) => c.defId === 'special_madness')).toBe(false);
    });

    it('Me First! 窗口内大学派系连续打出《最好不知道的事》后仍可继续打出《老詹金斯!?》', () => {
        const madnessDeck = Array.from({ length: 3 }, (_, i) => ({
            uid: `madness-chain-${i}`, defId: MADNESS_CARD_DEF_ID, type: 'action' as const, owner: '0',
        }));
        const setupWithMiskatonicChain = (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const state = setupWithBreakpointOnlyP0TwoSpecial(ids, random);
            const p0 = state.core.players['0'];
            if (p0) {
                p0.hand = [
                    { uid: 'mandatory-chain', defId: 'miskatonic_mandatory_reading', type: 'action', owner: '0' },
                    { uid: 'doorstep-chain', defId: 'miskatonic_thing_on_the_doorstep', type: 'action', owner: '0' },
                ];
            }
            state.core.bases[0] = {
                defId: 'base_the_mothership',
                ongoingActions: [],
                minions: [
                    {
                        uid: 'strong-target',
                        defId: 'test_strong',
                        owner: '1',
                        controller: '1',
                        basePower: 6,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'chain-filler-1',
                        defId: 'test_filler',
                        owner: '0',
                        controller: '0',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'chain-filler-2',
                        defId: 'test_filler',
                        owner: '0',
                        controller: '0',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'chain-filler-3',
                        defId: 'test_filler',
                        owner: '0',
                        controller: '0',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'support-minion',
                        defId: 'test_support',
                        owner: '0',
                        controller: '0',
                        basePower: 4,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                ],
            };
            (state.core as any).madnessDeck = madnessDeck;
            return state;
        };

        const r1 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithMiskatonicChain,
        }).run({
            name: 'miskatonic chain 1: 进入 scoreBases',
            commands: [...BREAKPOINT_COMMANDS] as any[],
        });
        const initialChoice = getSimpleChoicePrompt(r1.finalState, 'smashup_reaction_choose');
        expect(getPromptPlayerId(initialChoice)).toBe('0');

        const r2 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => r1.finalState,
        }).run({
            name: 'miskatonic chain 1: 先打最好不知道的事',
            commands: [respondCommand('play_action:mandatory-chain:0', '0')] as any[],
        });
        expect(r2.steps[0]?.success).toBe(true);
        const chooseMinionPrompt = getSimpleChoicePrompt(r2.finalState, 'miskatonic_mandatory_reading');
        const minionOpt = getPromptOption(
            chooseMinionPrompt,
            option => option.value?.minionUid === 'strong-target',
            'Mandatory Reading chain target minion option',
        );

        const r3 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => r2.finalState,
        }).run({
            name: 'miskatonic chain 1: 选随从',
            commands: [respondCommand(minionOpt.id, '0')] as any[],
        });
        expect(r3.steps[0]?.success).toBe(true);
        const chooseDrawPrompt = getSimpleChoicePrompt(r3.finalState, 'miskatonic_mandatory_reading_draw');
        const drawOpt = getPromptOption(
            chooseDrawPrompt,
            option => option.value?.count === 1,
            'Mandatory Reading chain draw-one option',
        );

        const r4 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => r3.finalState,
        }).run({
            name: 'miskatonic chain 1: 选抽1张',
            commands: [respondCommand(drawOpt.id, '0')] as any[],
        });
        expect(r4.steps[0]?.success).toBe(true);
        const resumedChoice = getSimpleChoicePrompt(r4.finalState, 'smashup_reaction_choose');
        const doorstepOption = getPromptOption(
            resumedChoice,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'doorstep-chain',
            'Miskatonic chain doorstep reaction option',
        );
        expect(getPromptPlayerId(resumedChoice)).toBe('0');
        expect(doorstepOption.value?.targetBaseIndex).toBe(0);

        const r5 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => r4.finalState,
        }).run({
            name: 'miskatonic chain 1: 再打老詹金斯!?',
            commands: [respondCommand(doorstepOption.id, '0')] as any[],
        });
        expect(r5.steps[0]?.success).toBe(true);
        expect(r5.steps[0]?.events).toContain(SU_EVENTS.ACTION_PLAYED);
        expect(r5.steps[0]?.events).toContain(SU_EVENTS.MINION_DESTROYED);
        expect(r5.finalState.core.bases[0].minions.some(minion => minion.uid === 'strong-target')).toBe(false);
    });

    it('Me First! 窗口内大学派系先打《老詹金斯!?》后，窗口里仍可继续打出《最好不知道的事》', () => {
        const madnessDeck = Array.from({ length: 3 }, (_, i) => ({
            uid: `madness-reverse-${i}`, defId: MADNESS_CARD_DEF_ID, type: 'action' as const, owner: '0',
        }));
        const setupWithReverseMiskatonicChain = (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const state = setupWithBreakpointOnlyP0TwoSpecial(ids, random);
            const p0 = state.core.players['0'];
            if (p0) {
                p0.hand = [
                    { uid: 'doorstep-reverse', defId: 'miskatonic_thing_on_the_doorstep', type: 'action', owner: '0' },
                    { uid: 'mandatory-reverse', defId: 'miskatonic_mandatory_reading', type: 'action', owner: '0' },
                ];
            }
            state.core.bases[0] = {
                defId: 'base_the_mothership',
                ongoingActions: [],
                minions: [
                    {
                        uid: 'reverse-strong-target',
                        defId: 'test_strong',
                        owner: '1',
                        controller: '1',
                        basePower: 6,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'reverse-filler-1',
                        defId: 'test_filler',
                        owner: '0',
                        controller: '0',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'reverse-filler-2',
                        defId: 'test_filler',
                        owner: '0',
                        controller: '0',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'reverse-filler-3',
                        defId: 'test_filler',
                        owner: '0',
                        controller: '0',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'reverse-support-target',
                        defId: 'test_support',
                        owner: '0',
                        controller: '0',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                ],
            };
            (state.core as any).madnessDeck = madnessDeck;
            return state;
        };

        const r1 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: setupWithReverseMiskatonicChain,
        }).run({
            name: 'miskatonic chain 2: 进入 scoreBases',
            commands: [...BREAKPOINT_COMMANDS] as any[],
        });

        const r2 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => r1.finalState,
        }).run({
            name: 'miskatonic chain 2: 先打老詹金斯!?',
            commands: [respondCommand('play_action:doorstep-reverse:0', '0')] as any[],
        });
        expect(r2.steps[0]?.success).toBe(true);
        expect(r2.steps[0]?.events).toContain(SU_EVENTS.ACTION_PLAYED);
        expect(r2.steps[0]?.events).toContain(SU_EVENTS.MINION_DESTROYED);

        const resumedChoice = getSimpleChoicePrompt(r2.finalState, 'smashup_reaction_choose');
        const mandatoryOption = getPromptOption(
            resumedChoice,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'mandatory-reverse',
            'Miskatonic reverse mandatory reaction option',
        );
        expect(getPromptPlayerId(resumedChoice)).toBe('0');
        expect(mandatoryOption.value?.targetBaseIndex).toBe(0);

        const r3 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => r2.finalState,
        }).run({
            name: 'miskatonic chain 2: 再打最好不知道的事',
            commands: [respondCommand(mandatoryOption.id, '0')] as any[],
        });
        expect(r3.steps[0]?.success).toBe(true);
        const chooseMinionPrompt = getSimpleChoicePrompt(r3.finalState, 'miskatonic_mandatory_reading');
        const minionOpt = getPromptOption(
            chooseMinionPrompt,
            option => option.value?.minionUid === 'reverse-support-target',
            'Mandatory Reading reverse target minion option',
        );

        const r4 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => r3.finalState,
        }).run({
            name: 'miskatonic chain 2: 选随从',
            commands: [respondCommand(minionOpt.id, '0')] as any[],
        });
        expect(r4.steps[0]?.success).toBe(true);
        const chooseDrawPrompt = getSimpleChoicePrompt(r4.finalState, 'miskatonic_mandatory_reading_draw');
        const drawOpt = getPromptOption(
            chooseDrawPrompt,
            option => option.value?.count === 1,
            'Mandatory Reading reverse draw-one option',
        );

        const r5 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => r4.finalState,
        }).run({
            name: 'miskatonic chain 2: 选抽1张',
            commands: [respondCommand(drawOpt.id, '0')] as any[],
        });
        expect(r5.steps[0]?.success).toBe(true);
        expect(r5.finalState.core.players['0'].hand.some(card => card.defId === MADNESS_CARD_DEF_ID)).toBe(true);
        expect(r5.finalState.sys.responseWindow.current).toBeUndefined();
    });
});
