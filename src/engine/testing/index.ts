/**
 * 通用游戏测试运行器（引擎级）
 *
 * 设计目标：
 * - 与具体游戏解耦
 * - 通过 executePipeline 执行：确保 sys/core/Systems 行为一致
 * - 支持自定义断言/可视化
 */

import type { Command, DomainCore, RandomFn, PlayerId, GameEvent, MatchState } from '../types';
import { createInitialSystemState, executePipeline, type PipelineConfig } from '../pipeline';
import type { EngineSystem } from '../systems/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface StateExpectation {
    /** 预期某步出现的错误 */
    errorAtStep?: { step: number; error: string };
}

export interface TestCase<TExpect extends StateExpectation = StateExpectation> {
    name: string;
    commands: Array<{ type: string; playerId: string; payload: unknown }>;
    expect?: TExpect;
    /** 单测自定义初始化（优先级高于全局 setup） */
    setup?: (playerIds: PlayerId[], random: RandomFn) => MatchState<unknown>;
    eventsAtStep?: Array<{ step: number; includes: string[] }>;
    skip?: boolean;
}

export interface StepLog {
    step: number;
    command: string;
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

    constructor(config: TestRunnerConfig<TState, TCommand, TEvent, TExpect>) {
        this.config = config;
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
                timestamp: Date.now(),
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

        if (testCase.eventsAtStep) {
            for (const expectation of testCase.eventsAtStep) {
                const stepLog = steps.find(step => step.step === expectation.step);
                if (!stepLog) {
                    assertionErrors.push(`未找到 Step ${expectation.step} 的事件记录`);
                    continue;
                }
                for (const eventType of expectation.includes) {
                    if (!stepLog.events.includes(eventType)) {
                        assertionErrors.push(`Step ${expectation.step} 缺少事件: ${eventType}`);
                    }
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
}
