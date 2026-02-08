/**
 * Me First! 响应窗口测试
 *
 * 覆盖：
 * - Property 10: Me First! 响应机制
 * - 响应窗口打开/关闭流程
 * - 所有玩家让过后自动关闭
 * - 记分在 Me First! 完成后执行
 * - 响应窗口期间命令阻塞
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { createFlowSystem, createDefaultSystems } from '../../../engine';
import { initAllAbilities } from '../abilities';
import { clearRegistry, clearBaseAbilityRegistry } from '../domain';
import { resetAbilityInit } from '../abilities';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';

const PLAYER_IDS = ['0', '1'];

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createDefaultSystems<SmashUpCore>(),
        ],
        playerIds: PLAYER_IDS,
    });
}

/** 蛇形选秀 + 推进到 playCards */
const DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'aliens' } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'pirates' } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'ninjas' } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'dinosaurs' } },
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
    it('进入 scoreBases 时打开 Me First! 响应窗口', () => {
        const runner = createRunner();
        const result = runner.run({
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → scoreBases
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 应该停在 scoreBases，响应窗口打开
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.sys.responseWindow.current).toBeTruthy();
        expect(result.finalState.sys.responseWindow.current?.windowType).toBe('meFirst');
        expect(result.finalState.sys.responseWindow.current?.responderQueue).toEqual(['0', '1']);
    });

    it('所有玩家让过后关闭响应窗口并推进到 draw', () => {
        const runner = createRunner();
        const result = runner.run({
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → scoreBases（Me First! 打开）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 两人都让过
                ...ME_FIRST_PASS_ALL,
            ] as any[],
        });

        // 响应窗口关闭，auto-continue 到 draw
        expect(result.finalState.sys.responseWindow.current).toBeUndefined();
        expect(result.finalState.sys.phase).toBe('draw');
    });

    it('响应窗口期间阻塞非响应命令', () => {
        const runner = createRunner();
        const result = runner.run({
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → scoreBases（Me First! 打开）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 尝试在响应窗口期间打出随从（应被阻塞）
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: '0',
                    payload: { cardUid: 'any', baseIndex: 0 },
                },
            ] as any[],
        });

        // 仍然停在 scoreBases，响应窗口仍然打开
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.sys.responseWindow.current).toBeTruthy();
    });

    it('非当前响应者无法让过', () => {
        const runner = createRunner();
        const result = runner.run({
            commands: [
                ...DRAFT_COMMANDS,
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P1 尝试先让过（但当前响应者是 P0）
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
            ] as any[],
        });

        // 响应窗口仍然打开，当前响应者仍是 P0
        expect(result.finalState.sys.responseWindow.current).toBeTruthy();
        expect(result.finalState.sys.responseWindow.current?.currentResponderIndex).toBe(0);
    });

    it('P0 让过后轮到 P1 响应', () => {
        const runner = createRunner();
        const result = runner.run({
            commands: [
                ...DRAFT_COMMANDS,
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P0 让过
                { type: 'RESPONSE_PASS', playerId: '0', payload: {} },
            ] as any[],
        });

        // 响应窗口仍然打开，当前响应者变为 P1
        expect(result.finalState.sys.responseWindow.current).toBeTruthy();
        expect(result.finalState.sys.responseWindow.current?.currentResponderIndex).toBe(1);
        expect(result.finalState.sys.responseWindow.current?.passedPlayers).toContain('0');
    });

    it('完整回合循环包含 Me First! 响应', () => {
        const runner = createRunner();
        const result = runner.run({
            commands: [
                ...DRAFT_COMMANDS,
                // P0 回合：playCards → scoreBases
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // Me First! 响应
                ...ME_FIRST_PASS_ALL,
                // auto-continue: scoreBases → draw → endTurn → startTurn
                // draw 阶段手牌不超限，auto-continue 到 endTurn → startTurn
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
            ] as any[],
        });

        // P1 的回合，playCards 阶段
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
    });

    it('事件流中包含 RESPONSE_WINDOW_OPENED 和 RESPONSE_WINDOW_CLOSED', () => {
        const runner = createRunner();
        const result = runner.run({
            commands: [
                ...DRAFT_COMMANDS,
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ...ME_FIRST_PASS_ALL,
            ] as any[],
        });

        // 收集所有步骤的事件类型
        const allEventTypes = result.steps.flatMap(s => s.events);
        expect(allEventTypes).toContain(RESPONSE_WINDOW_EVENTS.OPENED);
        expect(allEventTypes).toContain(RESPONSE_WINDOW_EVENTS.CLOSED);
    });
});
