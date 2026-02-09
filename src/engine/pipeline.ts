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
import { DEFAULT_TUTORIAL_STATE } from './types';
import type { EngineSystem, GameSystemsConfig } from './systems/types';

const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
const logDev = (...args: unknown[]) => {
    if (isDev) {
        console.log(...args);
    }
};

function sortSystems<TCore>(systems: EngineSystem<TCore>[]): EngineSystem<TCore>[] {
    // 稳定排序：priority 越小越先执行；priority 相同按传入顺序
    return systems
        .map((system, index) => ({ system, index }))
        .sort((a, b) => {
            const pa = a.system.priority ?? 100;
            const pb = b.system.priority ?? 100;
            if (pa !== pb) return pa - pb;
            return a.index - b.index;
        })
        .map((x) => x.system);
}

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
    const sortedSystems = sortSystems(systems);

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
        eventStream: {
            entries: [],
            maxEntries: 200,
            nextId: 1,
        },
        actionLog: {
            entries: [],
            maxEntries: 50,
        },
        rematch: {
            votes: {},
            ready: false,
        },
        responseWindow: {
            current: undefined,
        },
        tutorial: { ...DEFAULT_TUTORIAL_STATE },
        turnNumber: 0,
        phase: '',
    };

    // 让每个系统初始化自己的状态（按 priority 排序）
    for (const system of sortedSystems) {
        if (system.setup) {
            logDev(`[Pipeline] Calling setup for system: ${system.id || system.name || 'unknown'}`);
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
    const { domain } = config;
    const systems = sortSystems(config.systems);

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
        if (!system.beforeCommand) continue;

        const result = system.beforeCommand(ctx);
        if (!result) continue;

        // 先应用 state / events，再决定是否 halt
        if (result.state) {
            currentState = result.state;
            ctx.state = currentState;
        }
        if (result.events && result.events.length > 0) {
            allEvents.push(...result.events);
            preCommandEvents.push(...result.events);
        }

        if (result.halt) {
            // 有错误：立即返回，不再执行后续
            if (result.error) {
                return {
                    success: false,
                    state: currentState,
                    events: allEvents,
                    error: result.error,
                };
            }

            // 无错误：命令被系统消费。此时需要：
            // 1) 将系统产生的非 SYS_ 事件写入 core（确定性 reducer）
            // 2) 仍然执行 afterEvents hooks（例如：打开响应窗口、记录日志）
            // 注意：SYS_PHASE_CHANGED 需要传递给 reducer 以同步 core.turnPhase
            const reducible = preCommandEvents.filter((e) => 
                !e.type.startsWith('SYS_') || e.type === 'SYS_PHASE_CHANGED'
            );
            if (reducible.length > 0) {
                let core = currentState.core;
                for (const ev of reducible) {
                    core = domain.reduce(core, ev as unknown as TEvent);
                }
                currentState = { ...currentState, core };
                ctx.state = currentState;
            }

            ctx.events = [...preCommandEvents];

            // 执行 afterEvents hooks
            for (const s of systems) {
                if (!s.afterEvents) continue;
                const r = s.afterEvents(ctx);
                if (r?.state) {
                    currentState = r.state;
                    ctx.state = currentState;
                }
                if (r?.events && r.events.length > 0) {
                    allEvents.push(...r.events);
                    systemEventsToReduce.push(...r.events);
                    ctx.events = [...ctx.events, ...r.events];
                }
            }

            if (systemEventsToReduce.length > 0) {
                // 注意：SYS_PHASE_CHANGED 需要传递给 reducer 以同步 core.turnPhase
                const reducibleEvents = systemEventsToReduce.filter((e) => 
                    !e.type.startsWith('SYS_') || e.type === 'SYS_PHASE_CHANGED'
                );
                if (reducibleEvents.length > 0) {
                    let core = currentState.core;
                    for (const ev of reducibleEvents) {
                        core = domain.reduce(core, ev as unknown as TEvent);
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
    }

    // 2. Core.validate
    // 本地同屏：跳过权限校验，但保留规则校验（避免非法动作直通）
    if (command.skipValidation) {
        const validation: ValidationResult = domain.validate(currentState, command);
        if (!validation.valid) {
            // 本地同屏允许越权操作，但不允许违反规则
            if (validation.error !== 'player_mismatch') {
                console.warn('[Pipeline] 命令验证失败 (skipValidation=true):', {
                    commandType: command.type,
                    playerId: command.playerId,
                    error: validation.error,
                    payload: command.payload,
                });
                return {
                    success: false,
                    state: currentState,
                    events: allEvents,
                    error: validation.error,
                };
            }
        }
    } else {
        const validation: ValidationResult = domain.validate(currentState, command);
        if (!validation.valid) {
            console.warn('[Pipeline] 命令验证失败:', {
                commandType: command.type,
                playerId: command.playerId,
                error: validation.error,
                payload: command.payload,
            });
            return {
                success: false,
                state: currentState,
                events: allEvents,
                error: validation.error,
            };
        }
    }

    // 3. Core.execute -> 产生 Events
    const events = domain.execute(currentState, command, random);
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
                    if (result.events.length > 0) {
                        ctx.events = [...ctx.events, ...result.events];
                    }
                }
            }
        }
    }

    if (systemEventsToReduce.length > 0) {
        // 注意：SYS_PHASE_CHANGED 需要传递给 reducer 以同步 core.turnPhase
        const reducibleEvents = systemEventsToReduce.filter((event) => 
            !event.type.startsWith('SYS_') || event.type === 'SYS_PHASE_CHANGED'
        );
        if (reducibleEvents.length > 0) {
            let core = currentState.core;
            for (const event of reducibleEvents) {
                core = domain.reduce(core, event as unknown as TEvent);
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
