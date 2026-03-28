/**
 * DiceThrone 基础命令覆盖测试
 *
 * 覆盖以下零覆盖命令：
 * 1. TOGGLE_DIE_LOCK — 锁定/解锁骰子
 * 2. REROLL_DIE — 重掷单个骰子（交互上下文中）
 * 3. RESOLVE_CHOICE — 解决选择交互
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { resolveNextLocalAiAction } from '../../../engine/ai';
import { DiceThroneDomain } from '../domain';
import { buildDiceThroneAiLegalActions } from '../ai';
import { engineConfig } from '../game';
import {
    testSystems,
    createQueuedRandom,
    createNoResponseSetup,
    assertState,
    cmd,
    createSetupWithHand,
    fixedRandom,
    type CommandInput,
} from './test-utils';
import type { DiceThroneCore } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { executePipeline } from '../../../engine/pipeline';
import { createInitializedState, injectPendingInteraction } from './test-utils';

const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };

/** 执行命令并返回新状态 */
function execCmd(
    state: MatchState<DiceThroneCore>,
    command: CommandInput,
    random: RandomFn = fixedRandom,
): MatchState<DiceThroneCore> {
    const result = executePipeline(
        pipelineConfig,
        state,
        { type: command.type, playerId: command.playerId, payload: command.payload, timestamp: Date.now() },
        random,
        ['0', '1']
    );
    if (!result.success) {
        throw new Error(`命令执行失败: ${command.type} - ${result.error}`);
    }
    return result.state as MatchState<DiceThroneCore>;
}

/** 尝试执行命令，返回 pipeline 结果 */
function tryCmd(
    state: MatchState<DiceThroneCore>,
    command: CommandInput,
    random: RandomFn = fixedRandom,
) {
    return executePipeline(
        pipelineConfig,
        state,
        { type: command.type, playerId: command.playerId, payload: command.payload, timestamp: Date.now() },
        random,
        ['0', '1']
    );
}


// ============================================================================
// 1. TOGGLE_DIE_LOCK — 掷骰阶段锁定/解锁骰子
// ============================================================================

describe('TOGGLE_DIE_LOCK 锁定/解锁骰子', () => {
    it('GTR: 掷骰后锁定骰子，再次掷骰时锁定骰子不变', () => {
        // 第一次掷骰: [3,3,3,3,3]，锁定 die 0 后第二次掷骰: [1,1,1,1]（die 0 保持 3）
        const diceValues = [3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '锁定骰子后重掷不影响锁定骰',
            commands: [
                cmd('ADVANCE_PHASE', '0'),       // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),            // 掷骰 [3,3,3,3,3]
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }), // 锁定 die 0
                cmd('ROLL_DICE', '0'),            // 再掷，die 0 保持
            ],
        });

        // 验证 die 0 被锁定且值不变
        const core = result.finalState.core;
        expect(core.dice[0].isKept).toBe(true);
        expect(core.dice[0].value).toBe(3);
        // 其他骰子被重掷
        expect(core.rollCount).toBe(2);
    });

    it('GTR: 锁定后解锁骰子', () => {
        const diceValues = [4, 4, 4, 4, 4, 2, 2, 2, 2, 2];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '锁定后解锁骰子',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),  // 锁定
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),  // 解锁
                cmd('ROLL_DICE', '0'),                        // 全部重掷
            ],
        });

        const core = result.finalState.core;
        expect(core.dice[0].isKept).toBe(false);
        // 解锁后 die 0 也被重掷
        expect(core.dice[0].value).toBe(2);
    });

    it('非 offensiveRoll/defensiveRoll 阶段锁定骰子失败', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        // main1 阶段
        const result = tryCmd(state, cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }));
        expect(result.success).toBe(false);
    });



    it('非当前玩家锁定骰子失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '非当前玩家锁定失败',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
            ],
        });

        // 玩家 1 尝试锁定
        const tryResult = tryCmd(result.finalState, cmd('TOGGLE_DIE_LOCK', '1', { dieId: 0 }));
        expect(tryResult.success).toBe(false);
    });

    it('确认掷骰后锁定骰子失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '确认后锁定失败',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ],
        });

        const tryResult = tryCmd(result.finalState, cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }));
        expect(tryResult.success).toBe(false);
    });

    it('不存在的骰子 ID 锁定失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '无效骰子ID',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
            ],
        });

        const tryResult = tryCmd(result.finalState, cmd('TOGGLE_DIE_LOCK', '0', { dieId: 99 }));
        expect(tryResult.success).toBe(false);
    });
});

describe('AI legal actions', () => {
    it('setup 阶段应为本地 AI 生成选角动作', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        const state: MatchState<DiceThroneCore> = {
            core,
            sys: {
                phase: 'setup',
                interaction: { queue: [] },
            } as MatchState<DiceThroneCore>['sys'],
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        expect(actions.some((action) =>
            action.kind === 'setup-select-character'
            && action.commands[0]?.type === 'SELECT_CHARACTER'
        )).toBe(true);
    });

    it('主流程阶段应生成推进回合动作', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(true);
    });

    it('本地 AI runner 应在 setup 阶段选择角色', async () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        const state: MatchState<DiceThroneCore> = {
            core,
            sys: {
                phase: 'setup',
                interaction: { queue: [] },
            } as MatchState<DiceThroneCore>['sys'],
        };

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('setup-select-character');
        expect(resolution?.action.commands[0]).toMatchObject({
            type: 'SELECT_CHARACTER',
            payload: { characterId: 'monk' },
        });
    });

    it('本地 AI 在 main1 应优先打出可用升级牌而不是直接推进阶段', async () => {
        const state = createSetupWithHand(['card-storm-assault-2'], { cp: 1 })(['0', '1'], fixedRandom);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('play-upgrade-card');
        expect(resolution?.action.commands[0]).toMatchObject({
            type: 'PLAY_UPGRADE_CARD',
            payload: {
                cardId: 'card-storm-assault-2',
                targetAbilityId: 'thunder-strike',
            },
        });
    });
});


// ============================================================================
// 2. REROLL_DIE — 交互上下文中重掷单个骰子
// ============================================================================

describe('REROLL_DIE 交互中重掷骰子', () => {
    it('有 pendingInteraction 时重掷骰子成功', () => {
        const diceValues = [3, 3, 3, 3, 3, 5]; // 第 6 个值用于重掷
        const random = createQueuedRandom(diceValues);

        // 先推进到 offensiveRoll 并掷骰
        let state = createInitializedState(['0', '1'], random);
        state = execCmd(state, cmd('ADVANCE_PHASE', '0'), random);
        state = execCmd(state, cmd('ROLL_DICE', '0'), random);

        const dieBefore = state.core.dice[0].value;
        expect(dieBefore).toBe(3);

        // 注入 pendingInteraction（模拟卡牌效果触发重掷交互）
        injectPendingInteraction(state, {
            id: 'reroll-test',
            playerId: '0',
            sourceCardId: 'test-card',
            type: 'rerollDie',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
        });

        // 重掷 die 0
        state = execCmd(state, cmd('REROLL_DIE', '0', { dieId: 0 }), random);
        expect(state.core.dice[0].value).toBe(5);
    });

    it('无 pendingInteraction 时重掷失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        let state = createInitializedState(['0', '1'], random);
        state = execCmd(state, cmd('ADVANCE_PHASE', '0'), random);
        state = execCmd(state, cmd('ROLL_DICE', '0'), random);

        const result = tryCmd(state, cmd('REROLL_DIE', '0', { dieId: 0 }), random);
        expect(result.success).toBe(false);
    });

    it('非交互玩家重掷失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        let state = createInitializedState(['0', '1'], random);
        state = execCmd(state, cmd('ADVANCE_PHASE', '0'), random);
        state = execCmd(state, cmd('ROLL_DICE', '0'), random);

        injectPendingInteraction(state, {
            id: 'reroll-test',
            playerId: '0',
            sourceCardId: 'test-card',
            type: 'rerollDie',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
        });

        // 玩家 1 尝试重掷
        const result = tryCmd(state, cmd('REROLL_DIE', '1', { dieId: 0 }), random);
        expect(result.success).toBe(false);
    });

    it('不存在的骰子 ID 重掷失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        let state = createInitializedState(['0', '1'], random);
        state = execCmd(state, cmd('ADVANCE_PHASE', '0'), random);
        state = execCmd(state, cmd('ROLL_DICE', '0'), random);

        injectPendingInteraction(state, {
            id: 'reroll-test',
            playerId: '0',
            sourceCardId: 'test-card',
            type: 'rerollDie',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
        });

        const result = tryCmd(state, cmd('REROLL_DIE', '0', { dieId: 99 }), random);
        expect(result.success).toBe(false);
    });
});


// ============================================================================
// 3. RESOLVE_CHOICE — 选择交互解决
//
// 注意：RESOLVE_CHOICE 在 execute 层是 no-op（break），validate 始终返回 ok()。
// 实际选择流程通过 SYS_INTERACTION_RESPOND 命令走 InteractionSystem。
// 这里测试 RESOLVE_CHOICE 命令本身的通过性，以及通过 GTR 测试完整选择流程。
// ============================================================================

describe('RESOLVE_CHOICE 选择交互', () => {
    it('RESOLVE_CHOICE 命令始终通过验证（no-op）', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        const result = tryCmd(state, cmd('RESOLVE_CHOICE', '0', { statusId: 'knockdown' }));
        // validate 始终返回 ok()，execute 是 break（no-op）
        expect(result.success).toBe(true);
    });

    it('完整选择流程已在 monk-coverage.test.ts 中覆盖', () => {
        // RESOLVE_CHOICE 在 execute 层是 no-op（break），validate 始终返回 ok()。
        // 实际选择流程通过 SYS_INTERACTION_RESPOND 走 InteractionSystem：
        //   CHOICE_REQUESTED 事件 → InteractionSystem 队列 simple-choice →
        //   SYS_INTERACTION_RESPOND → SYS_INTERACTION_RESOLVED → CHOICE_RESOLVED
        // 完整选择流程（禅忘二选一等）已在 monk-coverage.test.ts 中通过 GTR 覆盖。
        // 这里仅验证 RESOLVE_CHOICE 命令本身的通过性。
        const state = createInitializedState(['0', '1'], fixedRandom);

        // 在任意阶段都能通过验证（因为 validate 始终返回 ok）
        const result1 = tryCmd(state, cmd('RESOLVE_CHOICE', '0', { statusId: 'knockdown' }));
        expect(result1.success).toBe(true);

        // 不同玩家也能通过
        const result2 = tryCmd(state, cmd('RESOLVE_CHOICE', '1', { statusId: 'poison' }));
        expect(result2.success).toBe(true);
    });
});
