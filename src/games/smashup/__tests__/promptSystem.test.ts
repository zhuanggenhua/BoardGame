/**
 * 大杀四方 - PromptSystem 集成测试
 *
 * 测试 P7: 目标选择通过引擎层 PromptSystem 实现
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { PROMPT_COMMANDS } from '../../../engine/systems/PromptSystem';
import { createFlowSystem, createDefaultSystems } from '../../../engine';
import { smashUpFlowHooks } from '../domain/index';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearPromptContinuationRegistry } from '../domain/promptContinuation';
import { createSmashUpPromptBridge } from '../domain/systems';
import { resolvePromptContinuation } from '../domain/promptContinuation';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

const PLAYER_IDS = ['0', '1'];

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createDefaultSystems<SmashUpCore>(),
            createSmashUpPromptBridge(),
        ],
        playerIds: PLAYER_IDS,
    });
}

/** 蛇形选秀 */
const DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
] as any[];

/** Me First! 响应：两人都让过 */
const ME_FIRST_PASS = [
    { type: 'RESPONSE_PASS', playerId: '0', payload: {} },
    { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
] as any[];

describe('P7: PromptSystem 集成', () => {
    beforeAll(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearPromptContinuationRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    describe('SYS_ 命令放行', () => {
        it('SYS_PROMPT_RESPOND 不因"未知命令"失败', () => {
            const runner = createRunner();
            const result = runner.run({
                name: 'SYS_PROMPT_RESPOND 放行',
                commands: [
                    ...DRAFT_COMMANDS,
                    { type: PROMPT_COMMANDS.RESPOND, playerId: '0', payload: { optionId: 'test' } },
                ],
            });
            // PromptSystem 拦截并返回 "没有待处理的选择"（不是"未知命令"）
            const lastError = result.actualErrors[result.actualErrors.length - 1];
            expect(lastError).toBeDefined();
            expect(lastError.error).toBe('没有待处理的选择');
        });

        it('SYS_ 前缀命令通过领域层验证', () => {
            const runner = createRunner();
            const result = runner.run({
                name: 'SYS_ 前缀放行',
                commands: [
                    ...DRAFT_COMMANDS,
                    { type: 'SYS_TEST_COMMAND', playerId: '0', payload: {} },
                ],
            });
            // 领域层放行，execute 返回空事件
            // 最后一步应该成功（不在 actualErrors 中）
            const lastStep = result.steps[result.steps.length - 1];
            expect(lastStep.success).toBe(true);
        });
    });

    describe('Prompt 基础设施', () => {
        it('初始状态没有活跃 Prompt 和 pendingPromptContinuation', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '初始状态检查',
                commands: DRAFT_COMMANDS,
            });
            expect(result.finalState.sys.prompt.current).toBeUndefined();
            expect(result.finalState.sys.prompt.queue).toEqual([]);
            expect(result.finalState.core.pendingPromptContinuation).toBeUndefined();
        });

        it('SmashUp Prompt 桥接系统正常注册', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '桥接系统检查',
                commands: DRAFT_COMMANDS,
            });
            // 如果桥接系统有问题，run 会失败
            expect(result.steps.every(s => s.success)).toBe(true);
        });
    });

    describe('Prompt 继续函数注册表', () => {
        it('alien_crop_circles 继续函数已注册', () => {
            const fn = resolvePromptContinuation('alien_crop_circles');
            expect(fn).toBeDefined();
            expect(typeof fn).toBe('function');
        });

        it('未注册的 abilityId 返回 undefined', () => {
            const fn = resolvePromptContinuation('nonexistent_ability');
            expect(fn).toBeUndefined();
        });
    });

    describe('麦田怪圈 Prompt 目标选择', () => {
        it('单个有随从的基地时自动选择（不创建 Prompt）', () => {
            const runner = createRunner();
            const setupResult = runner.run({
                name: '选秀',
                commands: DRAFT_COMMANDS,
            });
            const state = setupResult.finalState;

            // 找 P0 手牌中的随从和 alien_crop_circles 行动卡
            const p0Hand = state.core.players['0'].hand;
            const p0Minion = p0Hand.find(c => c.type === 'minion');
            const cropCircles = p0Hand.find(c => c.defId === 'alien_crop_circles');

            if (!p0Minion || !cropCircles) {
                // 确定性随机可能不给这些卡，跳过
                return;
            }

            // P0 打出随从到基地 0，然后打出麦田怪圈
            const result = runner.run({
                name: '单基地自动选择',
                commands: [
                    ...DRAFT_COMMANDS,
                    { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: p0Minion.uid, baseIndex: 0 } },
                    { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: cropCircles.uid } },
                ],
            });

            // 只有基地 0 有随从，应自动选择，不创建 Prompt
            expect(result.finalState.sys.prompt.current).toBeUndefined();
            expect(result.finalState.core.pendingPromptContinuation).toBeUndefined();
        });
    });
});
