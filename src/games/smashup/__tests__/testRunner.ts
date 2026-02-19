/**
 * SmashUp 测试运行器
 * 
 * 封装 executePipeline，提供 SmashUp 专用的测试工具函数。
 * 所有测试应该使用这个 runner 而不是直接调用 execute()，
 * 因为 execute() 不会触发 postProcessSystemEvents（onPlay 能力等）。
 * 
 * 注意：不从 ../game 导入，避免循环依赖（game.ts 顶层调用 initAllAbilities）。
 * 系统列表在此内联创建。
 */

import { executePipeline, type PipelineConfig } from '../../../engine/pipeline';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import type { MatchState, RandomFn, GameEvent } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import {
    createFlowSystem,
    createInteractionSystem,
    createSimpleChoiceSystem,
    createEventStreamSystem,
} from '../../../engine';
import { smashUpFlowHooks } from '../domain/index';
import { createSmashUpEventSystem } from '../domain/systems';

// ============================================================================
// 测试用系统列表（内联创建，避免从 game.ts 导入导致循环依赖）
// ============================================================================

export const smashUpTestSystems: EngineSystem<SmashUpCore>[] = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    createInteractionSystem(),
    createSimpleChoiceSystem(),
    createEventStreamSystem(),
    createSmashUpEventSystem(),
];

/**
 * 默认的测试用 RandomFn
 */
export const defaultTestRandom: RandomFn = {
    shuffle: <T>(arr: T[]) => [...arr],
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.floor(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
};

const pipelineConfig: PipelineConfig<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
    domain: SmashUpDomain,
    systems: smashUpTestSystems,
};

export interface RunCommandResult {
    success: boolean;
    finalState: MatchState<SmashUpCore>;
    events: GameEvent[];
    error?: string;
}

/**
 * 通过 executePipeline 执行单个命令。
 * 与直接调用 execute() 不同，这会走完整管线（包括 afterEvents/postProcessSystemEvents）。
 */
export function runCommand(
    initialState: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn = defaultTestRandom,
): RunCommandResult {
    const playerIds = Object.keys(initialState.core.players);
    const result = executePipeline(pipelineConfig, initialState, command, random, playerIds);
    return {
        success: result.success,
        finalState: result.state,
        events: result.events,
        error: result.error,
    };
}

/**
 * 执行多步命令序列
 */
export function runCommands(
    initialState: MatchState<SmashUpCore>,
    commands: SmashUpCommand[],
    random: RandomFn = defaultTestRandom,
): RunCommandResult {
    let state = initialState;
    let allEvents: GameEvent[] = [];
    const playerIds = Object.keys(initialState.core.players);

    for (const command of commands) {
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        allEvents = allEvents.concat(result.events);
        if (!result.success) {
            return { success: false, finalState: state, events: allEvents, error: result.error };
        }
        state = result.state;
    }
    return { success: true, finalState: state, events: allEvents };
}
