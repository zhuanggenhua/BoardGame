/**
 * 通用游戏测试运行器
 * 
 * 设计目标：
 * - 与具体游戏解耦，可复用于任意 DomainCore
 * - 支持自定义断言函数
 * - 支持自定义可视化
 * - 输出详细的错误日志
 */

import type { Command, DomainCore, RandomFn, PlayerId, GameEvent } from '../types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 状态断言基础接口（游戏特定断言继承此接口）
 */
export interface StateExpectation {
    /** 预期某步出现的错误 */
    errorAtStep?: { step: number; error: string };
}

/**
 * 测试用例
 */
export interface TestCase<TExpect extends StateExpectation = StateExpectation> {
    /** 测试名称 */
    name: string;
    /** 命令序列 */
    commands: Array<{
        type: string;
        playerId: string;
        payload: unknown;
    }>;
    /** 预期结果 */
    expect?: TExpect;
    /** 跳过此测试 */
    skip?: boolean;
}

/**
 * 步骤日志
 */
export interface StepLog {
    step: number;
    command: string;
    playerId: string;
    valid: boolean;
    error?: string;
    events: string[];
}

/**
 * 测试结果
 */
export interface TestResult<TState> {
    name: string;
    passed: boolean;
    steps: StepLog[];
    finalState: TState;
    assertionErrors: string[];
    expectedErrors: { step: number; error: string }[];
    actualErrors: { step: number; error: string }[];
}

/**
 * 测试运行器配置
 */
export interface TestRunnerConfig<TState, TCommand extends Command, TEvent extends GameEvent, TExpect extends StateExpectation> {
    /** 领域内核 */
    domain: DomainCore<TState, TCommand, TEvent>;
    /** 玩家列表 */
    playerIds: PlayerId[];
    /** 状态断言函数 */
    assertFn?: (state: TState, expect: TExpect) => string[];
    /** 状态可视化函数 */
    visualizeFn?: (state: TState) => void;
    /** 随机数生成器（可选，默认返回固定值） */
    random?: RandomFn;
    /** 是否静默模式（不输出日志） */
    silent?: boolean;
}

// ============================================================================
// 默认随机数生成器
// ============================================================================

const defaultRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: (arr) => [...arr],
};

// ============================================================================
// 测试运行器
// ============================================================================

export class GameTestRunner<
    TState,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
    TExpect extends StateExpectation = StateExpectation
> {
    private config: TestRunnerConfig<TState, TCommand, TEvent, TExpect>;

    constructor(config: TestRunnerConfig<TState, TCommand, TEvent, TExpect>) {
        this.config = config;
    }

    private log(...args: unknown[]) {
        if (!this.config.silent) {
            console.log(...args);
        }
    }

    /**
     * 运行单个测试
     */
    run(testCase: TestCase<TExpect>): TestResult<TState> {
        const { domain, playerIds, assertFn, visualizeFn } = this.config;
        const random = this.config.random ?? defaultRandom;

        let state = domain.setup(playerIds, random);
        const steps: StepLog[] = [];
        const actualErrors: { step: number; error: string }[] = [];
        const expectedErrors: { step: number; error: string }[] = [];

        this.log(`\n${'='.repeat(60)}`);
        this.log(`📋 测试: ${testCase.name}`);
        this.log('='.repeat(60));

        if (testCase.expect?.errorAtStep) {
            expectedErrors.push(testCase.expect.errorAtStep);
        }

        for (let i = 0; i < testCase.commands.length; i++) {
            const cmd = testCase.commands[i];
            const stepNum = i + 1;

            const command = {
                type: cmd.type,
                playerId: cmd.playerId,
                payload: cmd.payload,
                timestamp: Date.now(),
            } as TCommand;

            const validation = domain.validate(state, command);

            const stepLog: StepLog = {
                step: stepNum,
                command: `${cmd.type}(${JSON.stringify(cmd.payload)})`,
                playerId: cmd.playerId,
                valid: validation.valid,
                error: validation.error,
                events: [],
            };

            if (!validation.valid) {
                this.log(`  ❌ Step ${stepNum}: P${cmd.playerId} | ${cmd.type} | 错误: ${validation.error}`);
                actualErrors.push({ step: stepNum, error: validation.error ?? 'unknown' });
                steps.push(stepLog);
                continue;
            }

            const events = domain.execute(state, command, random);
            stepLog.events = events.map(e => e.type);

            for (const event of events) {
                state = domain.reduce(state, event);
            }

            this.log(`  ✅ Step ${stepNum}: P${cmd.playerId} | ${cmd.type} | 事件: ${stepLog.events.join(', ')}`);
            steps.push(stepLog);

            if (domain.isGameOver) {
                const gameOver = domain.isGameOver(state);
                if (gameOver) {
                    if (gameOver.winner) {
                        this.log(`  🏆 游戏结束: 玩家 ${gameOver.winner} 获胜!`);
                    } else if (gameOver.draw) {
                        this.log(`  🤝 游戏结束: 平局!`);
                    }
                    break;
                }
            }
        }

        if (visualizeFn && !this.config.silent) {
            visualizeFn(state);
        }

        let assertionErrors: string[] = [];
        if (testCase.expect && assertFn) {
            assertionErrors = assertFn(state, testCase.expect);
        }

        if (expectedErrors.length > 0) {
            for (const expected of expectedErrors) {
                const actual = actualErrors.find(e => e.step === expected.step);
                if (!actual) {
                    assertionErrors.push(`预期 Step ${expected.step} 出错 (${expected.error})，但没有出错`);
                } else if (actual.error !== expected.error) {
                    assertionErrors.push(`Step ${expected.step} 错误不匹配: 预期 "${expected.error}", 实际 "${actual.error}"`);
                }
            }
        }

        if (assertionErrors.length > 0) {
            this.log('\n  ⚠️ 断言失败:');
            for (const err of assertionErrors) {
                this.log(`    - ${err}`);
            }
        } else if (testCase.expect) {
            this.log('\n  ✅ 所有断言通过');
        }

        return {
            name: testCase.name,
            passed: assertionErrors.length === 0,
            steps,
            finalState: state,
            assertionErrors,
            expectedErrors,
            actualErrors,
        };
    }

    /**
     * 运行所有测试
     */
    runAll(testCases: TestCase<TExpect>[]): TestResult<TState>[] {
        const results: TestResult<TState>[] = [];

        for (const testCase of testCases) {
            if (testCase.skip) {
                this.log(`\n⏭️ 跳过: ${testCase.name}`);
                continue;
            }
            results.push(this.run(testCase));
        }

        this.log('\n' + '='.repeat(60));
        this.log('📊 测试汇总');
        this.log('='.repeat(60));

        let passed = 0;
        let failed = 0;

        for (const result of results) {
            const status = result.passed ? '✅ 通过' : '❌ 失败';
            this.log(`  ${status}: ${result.name}`);

            if (result.passed) passed++;
            else failed++;
        }

        this.log(`\n总计: ${passed} 通过, ${failed} 失败`);

        if (failed > 0) {
            this.log('\n❌ 存在失败的测试用例\n');
            if (typeof process !== 'undefined') {
                process.exit(1);
            }
        } else {
            this.log('\n✅ 所有测试通过\n');
        }

        return results;
    }
}
