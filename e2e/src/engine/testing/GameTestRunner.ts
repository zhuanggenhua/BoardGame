/**
 * 通用游戏测试运行器（引擎级）
 *
 * 设计目标：
 * - 与具体游戏解耦
 * - 通过 executePipeline 执行：确保 sys/core/Systems 行为一致
 * - 支持自定义断言/可视化
 *
 * 错误断言方式：
 * - errorAtStep: 按绝对步骤索引匹配（旧 API，向后兼容）
 * - expectError: 按命令类型匹配最后一条失败命令（推荐，不依赖步骤索引）
 */

import type { Command, DomainCore, RandomFn, PlayerId, GameEvent, MatchState } from '../types';
import { createInitialSystemState, executePipeline, type PipelineConfig } from '../pipeline';
import type { EngineSystem } from '../systems/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface StateExpectation {
    /** @deprecated 使用 expectError 替代。按绝对步骤索引匹配错误（脆弱：插入/删除命令会导致索引偏移） */
    errorAtStep?: { step: number; error: string };
    /**
     * 按命令类型匹配错误（推荐）。
     * - command: 预期失败的命令类型
     * - error: 预期的错误码
     * 匹配规则：在所有失败步骤中，找到最后一条 command 类型匹配的失败，验证其 error。
     * 如果不指定 command，则匹配最后一条失败命令。
     */
    expectError?: { command?: string; error: string };
}

export interface TestCase<TExpect extends StateExpectation = StateExpectation> {
    name: string;
    commands: Array<{ type: string; playerId: string; payload: unknown }>;
    expect?: TExpect;
    /** 单测自定义初始化（优先级高于全局 setup） */
    setup?: (playerIds: PlayerId[], random: RandomFn) => MatchState<unknown>;
    skip?: boolean;
}

export interface StepLog {
    step: number;
    command: string;
    commandType: string;
    playerId: string;
    success: boolean;
    error?: string;
    events: string[];
}

export interface TestResult<TState> {
    name: string;
    passed: boolean;
    steps: StepLog[];
    finalState: MatchState<TState>;
    assertionErrors: string[];
    expectedErrors: { step: number; error: string }[];
    actualErrors: { step: number; error: string }[];
}

export interface TestRunnerConfig<TState, TCommand extends Command, TEvent extends GameEvent, TExpect extends StateExpectation> {
    domain: DomainCore<TState, TCommand, TEvent>;
    systems?: EngineSystem<TState>[];
    playerIds: PlayerId[];
    /** 全局初始化（可覆盖 domain.setup + createInitialSystemState） */
    setup?: (playerIds: PlayerId[], random: RandomFn) => MatchState<TState>;
    assertFn?: (state: MatchState<TState>, expect: TExpect) => string[];
    visualizeFn?: (state: MatchState<TState>) => void;
    random?: RandomFn;
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
    private currentState?: MatchState<TState>;

    constructor(config: TestRunnerConfig<TState, TCommand, TEvent, TExpect>) {
        this.config = config;
        // Initialize currentState with setup
        const { domain, playerIds, systems = [] } = config;
        const random = config.random ?? defaultRandom;
        const init = config.setup ?? ((ids: PlayerId[], rnd: RandomFn) => {
            const core = domain.setup(ids, rnd);
            const sys = createInitialSystemState(ids, systems, undefined);
            return { sys, core };
        });
        const initialState = init(playerIds, random);
        
        // 确保 sys 对象包含所有必需的系统状态
        if (!initialState.sys.undo) {
            initialState.sys.undo = {
                snapshots: [],
                maxSnapshots: 50,
            };
        }
        if (!initialState.sys.interaction) {
            initialState.sys.interaction = {
                queue: [],
            };
        }
        
        this.currentState = initialState;
    }

    run(testCase: TestCase<TExpect>): TestResult<TState> {
        const { domain, playerIds, assertFn, visualizeFn } = this.config;
        const systems = this.config.systems ?? [];
        const random = this.config.random ?? defaultRandom;

        const pipelineConfig: PipelineConfig<TState, TCommand, TEvent> = {
            domain,
            systems,
        };

        const init = (testCase.setup as ((ids: PlayerId[], rnd: RandomFn) => MatchState<TState>) | undefined)
            ?? this.config.setup
            ?? ((ids: PlayerId[], rnd: RandomFn) => {
                const core = domain.setup(ids, rnd);
                const sys = createInitialSystemState(ids, systems, undefined);
                return { sys, core };
            });

        let state = init(playerIds, random);
        
        // 确保 sys 对象包含所有必需的系统状态
        if (!state.sys.undo) {
            state.sys.undo = {
                snapshots: [],
                maxSnapshots: 50,
            };
        }
        if (!state.sys.interaction) {
            state.sys.interaction = {
                queue: [],
            };
        }

        const steps: StepLog[] = [];
        const actualErrors: { step: number; error: string }[] = [];
        const expectedErrors: { step: number; error: string }[] = [];

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
                timestamp: stepNum,
            } as TCommand;

            const result = executePipeline(
                pipelineConfig,
                state,
                command,
                random,
                playerIds
            );

            const stepLog: StepLog = {
                step: stepNum,
                command: `${cmd.type}(${JSON.stringify(cmd.payload)})`,
                commandType: cmd.type,
                playerId: cmd.playerId,
                success: result.success,
                error: result.error,
                events: result.events.map(e => e.type),
            };

            steps.push(stepLog);

            if (!result.success) {
                actualErrors.push({ step: stepNum, error: result.error ?? 'unknown' });
                // 失败步不推进状态（保持与旧 runner 一致：继续执行后续命令）
                continue;
            }

            state = result.state;

            if (domain.isGameOver) {
                const gameOver = domain.isGameOver(state.core);
                if (gameOver) {
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

        // errorAtStep 断言（旧 API，向后兼容）
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

        // expectError 断言（新 API，按命令类型匹配）
        if (testCase.expect?.expectError) {
            const { command: expectedCmd, error: expectedError } = testCase.expect.expectError;
            // 从失败步骤中找匹配的命令
            const failedSteps = steps.filter(s => !s.success);
            let matched: StepLog | undefined;
            if (expectedCmd) {
                // 找最后一条匹配命令类型的失败步骤
                for (let i = failedSteps.length - 1; i >= 0; i--) {
                    if (failedSteps[i].commandType === expectedCmd) {
                        matched = failedSteps[i];
                        break;
                    }
                }
                if (!matched) {
                    assertionErrors.push(`预期命令 ${expectedCmd} 失败 (${expectedError})，但该命令未失败`);
                } else if (matched.error !== expectedError) {
                    assertionErrors.push(`命令 ${expectedCmd} 错误不匹配: 预期 "${expectedError}", 实际 "${matched.error}"`);
                }
            } else {
                // 不指定命令类型时，匹配最后一条失败
                const lastFailed = failedSteps[failedSteps.length - 1];
                if (!lastFailed) {
                    assertionErrors.push(`预期出错 (${expectedError})，但所有命令都成功了`);
                } else if (lastFailed.error !== expectedError) {
                    assertionErrors.push(`最后失败命令错误不匹配: 预期 "${expectedError}", 实际 "${lastFailed.error}"`);
                }
            }
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

    runAll(testCases: TestCase<TExpect>[]): TestResult<TState>[] {
        const results: TestResult<TState>[] = [];

        for (const testCase of testCases) {
            if (testCase.skip) continue;
            results.push(this.run(testCase));
        }

        return results;
    }

    /**
     * 设置当前状态（测试辅助方法）
     * 用于测试中快速构造特定场景
     */
    setState(state: MatchState<TState>): void {
        this.currentState = state;
    }

    /**
     * 部分更新当前状态（测试辅助方法）
     * 用于测试中快速修改状态的部分字段
     */
    patchState(partial: Partial<MatchState<TState>>): void {
        if (!this.currentState) {
            throw new Error('Cannot patch state: no current state. Call setState() or run() first.');
        }
        // Deep merge core and sys
        const newCore = partial.core ? { ...this.currentState.core as object, ...partial.core as object } : this.currentState.core;
        const newSys = partial.sys ? { ...this.currentState.sys, ...partial.sys } : this.currentState.sys;
        this.currentState = {
            ...this.currentState,
            ...partial,
            core: newCore as TState,
            sys: newSys,
        };
    }

    /**
     * 分发命令（测试辅助方法）
     * 基于当前状态执行命令并更新状态
     */
    dispatch(commandType: string, payload: { playerId: string; [key: string]: unknown }): {
        success: boolean;
        error?: string;
        events: Array<{ type: string; payload: unknown; timestamp: number }>;
        finalState: MatchState<TState>;
    } {
        if (!this.currentState) {
            throw new Error('Cannot dispatch: no current state. Call setState() or patchState() first.');
        }

        const { domain, playerIds } = this.config;
        const systems = this.config.systems ?? [];
        const random = this.config.random ?? defaultRandom;

        const pipelineConfig: PipelineConfig<TState, TCommand, TEvent> = {
            domain,
            systems,
        };

        const command = {
            type: commandType,
            playerId: payload.playerId,
            payload,
            timestamp: Date.now(),
        } as TCommand;

        const result = executePipeline(
            pipelineConfig,
            this.currentState,
            command,
            random,
            playerIds
        );

        if (result.success) {
            this.currentState = result.state;
        }

        return {
            success: result.success,
            error: result.error,
            events: result.events,
            finalState: result.success ? result.state : this.currentState,
        };
    }

    /**
     * 执行命令（别名，向后兼容）
     */
    executeCommand(commandType: string, payload: { playerId: string; [key: string]: unknown }): {
        success: boolean;
        error?: string;
        events: Array<{ type: string; payload: unknown; timestamp: number }>;
        finalState: MatchState<TState>;
    } {
        return this.dispatch(commandType, payload);
    }

    /**
     * 获取当前状态（测试辅助方法）
     */
    getState(): MatchState<TState> {
        if (!this.currentState) {
            throw new Error('Cannot get state: no current state. Call setState() or run() first.');
        }
        return this.currentState;
    }

    /**
     * 解决交互（测试辅助方法）
     * 用于测试中模拟玩家响应交互
     */
    resolveInteraction(playerId: string, value: unknown): {
        success: boolean;
        error?: string;
        events: Array<{ type: string; payload: unknown; timestamp: number }>;
        finalState: MatchState<TState>;
    } {
        // 将 value 展开到 payload 中，而不是嵌套在 value 字段下
        // SimpleChoiceSystem 期望 payload 直接包含 optionId/optionIds/mergedValue
        return this.dispatch('SYS_INTERACTION_RESPOND', { playerId, ...(value as object) });
    }
}
