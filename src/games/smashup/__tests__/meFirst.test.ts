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
import { smashUpFlowHooks } from '../domain/index';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent, MinionOnBase } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { createFlowSystem, createDefaultSystems } from '../../../engine';
import { initAllAbilities } from '../abilities';
import { clearRegistry, clearBaseAbilityRegistry } from '../domain';
import { resetAbilityInit } from '../abilities';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';

const PLAYER_IDS = ['0', '1'];

const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createDefaultSystems<SmashUpCore>(),
];

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
            attachedActions: [],
            talentUsed: false,
        }));
        core.bases[0] = { ...core.bases[0], minions: [...core.bases[0].minions, ...fakeMinions] };
    }
    return { sys, core };
}

/** 蛇形选秀 + 推进到 playCards */
const DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
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
    it('无基地达标时不打开 Me First! 响应窗口，直接推进到 draw', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '无基地达标跳过响应窗口',
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → scoreBases → 无基地达标 → auto-continue → draw
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 无基地达标，scoreBases 直接跳过，推进到 draw
        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        expect(result.finalState.sys.phase).toBe('draw');
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

    it('完整回合循环（无基地达标时跳过 Me First!）', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '完整回合无 meFirst',
            commands: [
                ...DRAFT_COMMANDS,
                // P0 回合：playCards → scoreBases(auto skip) → draw(auto) → endTurn(auto) → startTurn(auto)
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // draw → endTurn → startTurn → playCards
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
            ] as any[],
        });

        // P1 的回合，playCards 阶段
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
    });
});
