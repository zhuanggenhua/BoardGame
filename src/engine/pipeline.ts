/**
 * Command/Event 执行管线
 * 
 * 管线职责：
 * 1. 接收 Command
 * 2. 执行 Systems.beforeCommand hooks
 * 3. Core.validate
 * 4. Core.execute -> 产生 Events
 * 5. 逐个 Reduce events -> 更新 state.core
 * 6. 执行 Systems.afterEvents hooks -> 更新 state.sys
 * 7. 处理系统追加的领域事件（非 SYS_）并同步 core
 */

import type {
    Command,
    DomainCore,
    GameEvent,
    MatchState,
    PipelineContext,
    PlayerId,
    RandomFn,
    SystemState,
    ValidationResult,
} from './types';
import type { EngineSystem, GameSystemsConfig } from './systems/types';

// ============================================================================
// 管线配置
// ============================================================================

export interface PipelineConfig<TCore, TCommand extends Command, TEvent extends GameEvent> {
    /** 领域内核 */
    domain: DomainCore<TCore, TCommand, TEvent>;
    /** 启用的系统 */
    systems: EngineSystem<TCore>[];
    /** 系统配置 */
    systemsConfig?: GameSystemsConfig;
}

// ============================================================================
// 管线执行结果
// ============================================================================

export interface PipelineResult<TCore> {
    /** 是否成功 */
    success: boolean;
    /** 更新后的状态 */
    state: MatchState<TCore>;
    /** 产生的事件 */
    events: GameEvent[];
    /** 错误信息 */
    error?: string;
}

// ============================================================================
// 创建初始系统状态
// ============================================================================

export function createInitialSystemState(
    playerIds: PlayerId[],
    systems: EngineSystem[],
    matchId?: string
): SystemState {
    let sys: SystemState = {
        schemaVersion: 1,
        matchId,
        undo: {
            snapshots: [],
            maxSnapshots: 50,
        },
        prompt: {
            queue: [],
        },
        log: {
            entries: [],
            maxEntries: 1000,
        },
        rematch: {
            votes: {},
            ready: false,
        },
        turnNumber: 0,
        phase: undefined,
    };

    // 让每个系统初始化自己的状态
    for (const system of systems) {
        if (system.setup) {
            const partial = system.setup(playerIds);
            sys = { ...sys, ...partial };
        }
    }

    return sys;
}

// ============================================================================
// 创建随机数生成器
// ============================================================================

export function createSeededRandom(seed: string): RandomFn {
    // 简单的确定性随机数生成器（xorshift128+）
    let s0 = hashString(seed);
    let s1 = hashString(seed + '_1');

    const next = (): number => {
        let x = s0;
        const y = s1;
        s0 = y;
        x ^= x << 23;
        x ^= x >> 17;
        x ^= y ^ (y >> 26);
        s1 = x;
        return ((x + y) >>> 0) / 0xffffffff;
    };

    return {
        random: next,
        d: (max: number) => Math.floor(next() * max) + 1,
        range: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
        shuffle: <T>(array: T[]): T[] => {
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(next() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },
    };
}

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash) || 1;
}

// ============================================================================
// 执行管线
// ============================================================================

export function executePipeline<
    TCore,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent
>(
    config: PipelineConfig<TCore, TCommand, TEvent>,
    state: MatchState<TCore>,
    command: TCommand,
    random: RandomFn,
    playerIds: PlayerId[]
): PipelineResult<TCore> {
    const { domain, systems } = config;
    let currentState = state;
    const allEvents: GameEvent[] = [];
    const preCommandEvents: GameEvent[] = [];
    const systemEventsToReduce: GameEvent[] = [];

    // 构建管线上下文
    const ctx: PipelineContext<TCore> = {
        state: currentState,
        command,
        events: [],
        random,
        playerIds,
    };

    // 1. 执行 Systems.beforeCommand hooks
    for (const system of systems) {
        if (system.beforeCommand) {
            const result = system.beforeCommand(ctx);
            if (result) {
                if (result.halt) {
                    return {
                        success: !result.error,
                        state: result.state ?? currentState,
                        events: allEvents,
                        error: result.error,
                    };
                }
                if (result.state) {
                    currentState = result.state;
                    ctx.state = currentState;
                }
                if (result.events) {
                    allEvents.push(...result.events);
                    preCommandEvents.push(...result.events);
                }
            }
        }
    }

    // 2. Core.validate
    const validation: ValidationResult = domain.validate(currentState.core, command);
    if (!validation.valid) {
        return {
            success: false,
            state: currentState,
            events: allEvents,
            error: validation.error ?? 'Invalid command',
        };
    }

    // 3. Core.execute -> 产生 Events
    const events = domain.execute(currentState.core, command, random);
    ctx.events = [...preCommandEvents, ...events] as GameEvent[];
    allEvents.push(...events);

    // 4. 逐个 Reduce events -> 更新 state.core
    let core = currentState.core;
    for (const event of events) {
        core = domain.reduce(core, event);
    }
    currentState = { ...currentState, core };
    ctx.state = currentState;

    // 5. 执行 Systems.afterEvents hooks -> 更新 state.sys
    for (const system of systems) {
        if (system.afterEvents) {
            const result = system.afterEvents(ctx);
            if (result) {
                if (result.state) {
                    currentState = result.state;
                    ctx.state = currentState;
                }
                if (result.events) {
                    allEvents.push(...result.events);
                    systemEventsToReduce.push(...result.events);
                }
            }
        }
    }

    if (systemEventsToReduce.length > 0) {
        const reducibleEvents = systemEventsToReduce.filter((event) => !event.type.startsWith('SYS_'));
        if (reducibleEvents.length > 0) {
            let core = currentState.core;
            for (const event of reducibleEvents) {
                core = domain.reduce(core, event as TEvent);
            }
            currentState = { ...currentState, core };
            ctx.state = currentState;
        }
    }

    return {
        success: true,
        state: currentState,
        events: allEvents,
    };
}

// ============================================================================
// 回放管线（用于重放事件）
// ============================================================================

export function replayEvents<
    TCore,
    TEvent extends GameEvent = GameEvent
>(
    domain: DomainCore<TCore, Command, TEvent>,
    initialCore: TCore,
    events: TEvent[]
): TCore {
    let core = initialCore;
    for (const event of events) {
        core = domain.reduce(core, event);
    }
    return core;
}
