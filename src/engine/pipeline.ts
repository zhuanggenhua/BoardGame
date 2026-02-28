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
    TutorialState,
    ValidationResult,
} from './types';
import { DEFAULT_TUTORIAL_STATE } from './types';
import type { EngineSystem, GameSystemsConfig } from './systems/types';

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
        interaction: {
            queue: [],
        },
        log: {
            entries: [],
            maxEntries: 0, // LogSystem 已移除，保留空壳兼容旧快照
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
        return ((x + y) >>> 0) / 0x100000000;
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
// 管线内部辅助函数
// ============================================================================

/**
 * 将事件 reduce 到 core 状态（含事件拦截/替换）
 * - SYS_ 事件默认不进入 reducer（保留 SYS_PHASE_CHANGED 以同步 core.turnPhase）
 * - 返回 appliedEvents：拦截/替换后的实际事件列表，用于后续系统/日志消费
 */
interface ReduceResult<TCore> {
    core: TCore;
    appliedEvents: GameEvent[];
}

function reduceEventsToCore<TCore, TCommand extends Command, TEvent extends GameEvent>(
    domain: DomainCore<TCore, TCommand, TEvent>,
    core: TCore,
    events: GameEvent[],
): ReduceResult<TCore> {
    const appliedEvents: GameEvent[] = [];

    for (const event of events) {
        const isPureSysEvent =
            event.type.startsWith('SYS_') && event.type !== 'SYS_PHASE_CHANGED';
        if (isPureSysEvent) {
            appliedEvents.push(event);
            continue;
        }

        if (domain.interceptEvent) {
            const result = domain.interceptEvent(core, event as unknown as TEvent);
            if (result === null) {
                continue;
            }
            const batch = Array.isArray(result) ? result : [result];
            for (const ev of batch) {
                core = domain.reduce(core, ev);
                appliedEvents.push(ev as unknown as GameEvent);
            }
        } else {
            core = domain.reduce(core, event as unknown as TEvent);
            appliedEvents.push(event);
        }
    }

    return { core, appliedEvents };
}

/**
 * afterEvents 多轮迭代参数
 */
interface AfterEventsParams<TCore, TCommand extends Command, TEvent extends GameEvent> {
    domain: DomainCore<TCore, TCommand, TEvent>;
    systems: EngineSystem<TCore>[];
    ctx: PipelineContext<TCore>;
    allEvents: GameEvent[];
    systemEventsToReduce: GameEvent[];
    random: RandomFn;
    maxRounds: number;
}

/**
 * 执行 afterEvents 多轮迭代
 *
 * 每轮：调用系统 afterEvents hooks → postProcessSystemEvents → reduce 进 core。
 * 当某轮无新事件产生时停止。会修改 params.ctx / allEvents / systemEventsToReduce。
 * @returns 更新后的 MatchState
 */
function runAfterEventsRounds<TCore, TCommand extends Command, TEvent extends GameEvent>(
    params: AfterEventsParams<TCore, TCommand, TEvent>,
): MatchState<TCore> {
    const { domain, systems, ctx, allEvents, systemEventsToReduce, random, maxRounds } = params;
    let currentState = ctx.state;

    for (let round = 0; round < maxRounds; round++) {
        ctx.afterEventsRound = round;
        let hasNewEvents = false;
        const roundEvents: GameEvent[] = [];

        // 调用每个系统的 afterEvents hook
        for (const system of systems) {
            if (!system.afterEvents) continue;
            const result = system.afterEvents(ctx);
            if (!result) continue;
            if (result.state) {
                currentState = result.state;
                ctx.state = currentState;
            }
            if (result.events && result.events.length > 0) {
                systemEventsToReduce.push(...result.events);
                roundEvents.push(...result.events);
                hasNewEvents = true;
            }
        }

        // 领域层系统事件后处理（如 trigger 回调），在 reduce 前追加派生事件
        if (roundEvents.length > 0 && domain.postProcessSystemEvents) {
            const domainEvents = roundEvents.filter((e) => !e.type.startsWith('SYS_'));
            if (domainEvents.length > 0) {
                const processResult = domain.postProcessSystemEvents(
                    currentState.core,
                    domainEvents as unknown as TEvent[],
                    random,
                    currentState,
                );
                const processed = Array.isArray(processResult)
                    ? processResult as unknown as GameEvent[]
                    : processResult.events as unknown as GameEvent[];
                const newMatchState = !Array.isArray(processResult) ? processResult.matchState : undefined;

                // PPSE 可能过滤事件（如压制 MINION_DESTROYED）并追加派生事件（如 trigger 产生的 POWER_COUNTER_ADDED）
                // 必须用 PPSE 返回的完整事件列表替换 roundEvents 中的领域事件
                const sysOnlyEvents = roundEvents.filter((e) => e.type.startsWith('SYS_'));
                roundEvents.length = 0;
                roundEvents.push(...sysOnlyEvents, ...processed);
                if (newMatchState) {
                    currentState = { ...currentState, sys: newMatchState.sys };
                    ctx.state = currentState;
                }
            }
        }

        // 本轮事件 reduce 进 core
        if (roundEvents.length > 0) {
            const reduced = reduceEventsToCore(domain, currentState.core, roundEvents);
            if (reduced.core !== currentState.core) {
                currentState = { ...currentState, core: reduced.core };
                ctx.state = currentState;
            }
            if (reduced.appliedEvents.length > 0) {
                allEvents.push(...reduced.appliedEvents);
                systemEventsToReduce.push(...reduced.appliedEvents);
                ctx.events = reduced.appliedEvents;
            } else {
                ctx.events = [];
            }
        } else {
            // 本轮无事件需要 reduce（如 PPSE 压制了所有领域事件），
            // 必须清空 ctx.events 防止下一轮系统重复处理上一轮的事件
            ctx.events = [];
        }

        if (!hasNewEvents) break;

        // 下一轮只看本轮产生的新事件（已应用拦截/替换）
    }

    return currentState;
}

// ============================================================================
// 教程随机策略
// ============================================================================

/**
 * 当教程活跃且定义了 randomPolicy 时，用固定/序列值包装原始 random。
 * fixed 模式：所有 d()/range() 返回固定值（values[0]）。
 * sequence 模式：按顺序消费 values，耗尽后使用最后一个值。cursor 通过 _getCursor() 暴露，
 *   由 executePipeline 在命令执行后写回 sys.tutorial.randomPolicy.cursor，实现跨命令持久化。
 * shuffle 保持原始行为（教程不需要控制洗牌）。
 */
interface TutorialRandomFn extends RandomFn {
    /** sequence 模式下获取当前 cursor 位置（用于持久化） */
    _getCursor?: () => number;
}

function applyTutorialRandomPolicy(tutorial: TutorialState | undefined, baseRandom: RandomFn): TutorialRandomFn {
    if (!tutorial?.active || !tutorial.randomPolicy) return baseRandom;
    const policy = tutorial.randomPolicy;
    const { values } = policy;
    if (!values || values.length === 0) return baseRandom;

    if (policy.mode === 'fixed') {
        const fixedValue = values[0];
        return {
            random: () => fixedValue / 6,
            d: (max: number) => Math.min(Math.max(1, fixedValue), max),
            range: (min: number, max: number) => Math.min(Math.max(min, fixedValue), max),
            shuffle: baseRandom.shuffle,
        };
    }

    // sequence 模式：cursor 从 policy.cursor 恢复，跨命令持久化
    let cursor = policy.cursor ?? 0;
    const fallback = values[values.length - 1];
    const fn: TutorialRandomFn = {
        random: () => {
            const raw = values[cursor] ?? fallback;
            cursor += 1;
            return raw / 6;
        },
        d: (max: number) => {
            const raw = values[cursor] ?? fallback;
            cursor += 1;
            return Math.min(Math.max(1, raw), max);
        },
        range: (min: number, max: number) => {
            const raw = values[cursor] ?? fallback;
            cursor += 1;
            return Math.min(Math.max(min, raw), max);
        },
        shuffle: baseRandom.shuffle,
        _getCursor: () => cursor,
    };
    return fn;
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
    const MAX_AFTER_EVENTS_ROUNDS = 10;

    let currentState = state;
    const allEvents: GameEvent[] = [];
    const preCommandEvents: GameEvent[] = [];
    const systemEventsToReduce: GameEvent[] = [];

    // 教程随机策略覆盖：当教程活跃且定义了 randomPolicy 时，用固定/序列值替代原始 random
    const effectiveRandom = applyTutorialRandomPolicy(state.sys.tutorial, random);

    // 辅助：将 sequence 模式的 cursor 写回 sys.tutorial.randomPolicy.cursor
    const persistRandomCursor = (s: MatchState<TCore>): MatchState<TCore> => {
        const getCursor = (effectiveRandom as TutorialRandomFn)._getCursor;
        if (!getCursor || !s.sys.tutorial?.randomPolicy) return s;
        const newCursor = getCursor();
        if (newCursor === (s.sys.tutorial.randomPolicy.cursor ?? 0)) return s;
        return {
            ...s,
            sys: {
                ...s.sys,
                tutorial: {
                    ...s.sys.tutorial,
                    randomPolicy: { ...s.sys.tutorial.randomPolicy, cursor: newCursor },
                },
            },
        };
    };

    // 构建管线上下文
    const ctx: PipelineContext<TCore> = {
        state: currentState,
        command,
        events: [],
        random: effectiveRandom,
        playerIds,
    };

    // 辅助：检测游戏结束并写入 sys.gameover
    const applyGameoverCheck = (s: MatchState<TCore>): MatchState<TCore> => {
        if (!domain.isGameOver) return s;
        const result = domain.isGameOver(s.core);
        // 仅在状态变化时更新（避免无意义的对象创建）
        if (result === s.sys.gameover) return s;
        if (result && !s.sys.gameover) {
            return { ...s, sys: { ...s.sys, gameover: result } };
        }
        if (!result && s.sys.gameover) {
            return { ...s, sys: { ...s.sys, gameover: undefined } };
        }
        return { ...s, sys: { ...s.sys, gameover: result } };
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
            // 1) 将系统产生的非 SYS_ 事件写入 core（含事件拦截/替换）
            // 2) 仍然执行 afterEvents hooks（例如：打开响应窗口、记录日志）
            const reduced = reduceEventsToCore(domain, currentState.core, preCommandEvents);
            if (reduced.core !== currentState.core) {
                currentState = { ...currentState, core: reduced.core };
                ctx.state = currentState;
            }
            allEvents.length = 0;
            allEvents.push(...reduced.appliedEvents);

            ctx.events = [...reduced.appliedEvents];

            // 执行 afterEvents hooks（多轮迭代）
            currentState = runAfterEventsRounds({
                domain, systems, ctx, allEvents, systemEventsToReduce, random: effectiveRandom,
                maxRounds: MAX_AFTER_EVENTS_ROUNDS,
            });

            // 检测游戏结束
            currentState = applyGameoverCheck(currentState);

            // 持久化教程 sequence cursor
            currentState = persistRandomCursor(currentState);

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
    // 使用 effectiveRandom 确保教程随机策略对领域层生效
    const events = domain.execute(currentState, command, effectiveRandom);

    // 4. 逐个 Reduce events -> 更新 state.core（含事件拦截/替换）
    const reduced = reduceEventsToCore(domain, currentState.core, events as unknown as GameEvent[]);
    currentState = { ...currentState, core: reduced.core };
    ctx.state = currentState;

    // 4.5 领域层后处理（如 onPlay 触发链），在 afterEvents 前执行
    let appliedEvents = reduced.appliedEvents;
    if (domain.postProcessSystemEvents && appliedEvents.length > 0) {
        const domainEvents = appliedEvents.filter((e) => !e.type.startsWith('SYS_'));
        if (domainEvents.length > 0) {
            const processResult = domain.postProcessSystemEvents(
                currentState.core,
                domainEvents as unknown as TEvent[],
                effectiveRandom,
                currentState,
            );
            // 兼容两种返回格式
            const processed = Array.isArray(processResult)
                ? processResult as unknown as GameEvent[]
                : processResult.events as unknown as GameEvent[];
            const newMatchState = !Array.isArray(processResult) ? processResult.matchState : undefined;

            if (processed.length > domainEvents.length) {
                const extraEvents = processed.slice(domainEvents.length);
                const extraReduced = reduceEventsToCore(domain, currentState.core, extraEvents);
                if (extraReduced.core !== currentState.core) {
                    currentState = { ...currentState, core: extraReduced.core };
                    ctx.state = currentState;
                }
                appliedEvents = [...appliedEvents, ...extraReduced.appliedEvents];
            }
            // 应用 matchState 变更（如 sys.interaction）
            if (newMatchState) {
                currentState = { ...currentState, sys: newMatchState.sys };
                ctx.state = currentState;
            }
        }
    }

    ctx.events = [...preCommandEvents, ...appliedEvents];
    allEvents.push(...appliedEvents);

    // 5. 执行 Systems.afterEvents hooks -> 更新 state.sys（多轮迭代）
    currentState = runAfterEventsRounds({
        domain, systems, ctx, allEvents, systemEventsToReduce, random: effectiveRandom,
        maxRounds: MAX_AFTER_EVENTS_ROUNDS,
    });


    // 6. 检测游戏结束
    currentState = applyGameoverCheck(currentState);

    // 7. 持久化教程 sequence cursor
    currentState = persistRandomCursor(currentState);

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
