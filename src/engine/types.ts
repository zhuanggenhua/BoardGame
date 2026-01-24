/**
 * 引擎层核心类型定义
 * 
 * 设计原则：
 * - 游戏无关的抽象
 * - 确定性与可序列化
 * - 支持撤销/回放/审计
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 玩家 ID
 */
export type PlayerId = string;

/**
 * 命令基础接口（玩家意图）
 */
export interface Command<TType extends string = string, TPayload = unknown> {
    type: TType;
    playerId: PlayerId;
    payload: TPayload;
    timestamp?: number;
}

/**
 * 事件基础接口（权威后果）
 */
export interface GameEvent<TType extends string = string, TPayload = unknown> {
    type: TType;
    payload: TPayload;
    sourceCommandType?: string;
    timestamp: number;
}

/**
 * 随机事件（特殊事件，记录随机结果）
 */
export interface RandomEvent extends GameEvent<'RANDOM'> {
    payload: {
        seed?: string;
        results: number[];
    };
}

// ============================================================================
// 系统状态（G.sys）
// ============================================================================

/**
 * 撤销系统状态
 */
export interface UndoState {
    /** 历史快照栈 */
    snapshots: unknown[];
    /** 最大快照数 */
    maxSnapshots: number;
    /** 撤销请求（多人握手） */
    pendingRequest?: {
        requesterId: PlayerId;
        approvals: PlayerId[];
        requiredApprovals: number;
    };
}

/**
 * Prompt 选项
 */
export interface PromptOption<T = unknown> {
    id: string;
    label: string;
    value: T;
    disabled?: boolean;
}

/**
 * Prompt 系统状态
 */
export interface PromptState<T = unknown> {
    /** 当前 prompt */
    current?: {
        id: string;
        playerId: PlayerId;
        title: string;
        options: PromptOption<T>[];
        sourceId?: string;
        timeout?: number;
    };
    /** prompt 队列 */
    queue: PromptState<T>['current'][];
}

/**
 * 日志条目
 */
export interface LogEntry {
    timestamp: number;
    type: 'command' | 'event' | 'system';
    data: Command | GameEvent | { message: string };
}

/**
 * 日志系统状态
 */
export interface LogState {
    entries: LogEntry[];
    maxEntries: number;
}

/**
 * 重赛系统状态
 */
export interface RematchState {
    /** 各玩家投票状态 */
    votes: Record<PlayerId, boolean>;
    /** 双方是否都已投票 */
    ready: boolean;
}

/**
 * 系统状态（G.sys）
 */
export interface SystemState {
    /** Schema 版本（用于迁移） */
    schemaVersion: number;
    /** Match ID */
    matchId?: string;
    /** 撤销系统状态 */
    undo: UndoState;
    /** Prompt 系统状态 */
    prompt: PromptState;
    /** 日志系统状态 */
    log: LogState;
    /** 重赛系统状态 */
    rematch: RematchState;
    /** 当前回合数 */
    turnNumber: number;
    /** 当前阶段 */
    phase?: string;
}

// ============================================================================
// 统一状态形状
// ============================================================================

/**
 * 统一游戏状态（G.sys + G.core）
 */
export interface MatchState<TCore = unknown> {
    sys: SystemState;
    core: TCore;
}

// ============================================================================
// 领域内核接口
// ============================================================================

/**
 * 命令验证结果
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * 领域内核定义（每个游戏实现）
 */
export interface DomainCore<
    TState = unknown,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent
> {
    /** 游戏 ID */
    gameId: string;

    /** 初始化游戏状态 */
    setup(playerIds: PlayerId[], seed?: string): TState;

    /** 验证命令合法性 */
    validate(state: TState, command: TCommand): ValidationResult;

    /** 执行命令，产生事件 */
    execute(state: TState, command: TCommand, random: RandomFn): TEvent[];

    /** 应用事件，返回新状态（确定性 reducer） */
    reduce(state: TState, event: TEvent): TState;

    /** 玩家视图过滤（隐藏信息） */
    playerView?(state: TState, playerId: PlayerId): Partial<TState>;

    /** 判断游戏是否结束 */
    isGameOver?(state: TState): GameOverResult | undefined;
}

/**
 * 游戏结束结果
 */
export interface GameOverResult {
    winner?: PlayerId;
    winners?: PlayerId[];
    draw?: boolean;
    scores?: Record<PlayerId, number>;
}

/**
 * 随机数生成函数
 */
export type RandomFn = {
    /** 返回 [0, 1) 的随机数 */
    random(): number;
    /** 返回 [1, max] 的随机整数（骰子） */
    d(max: number): number;
    /** 返回 [min, max] 的随机整数 */
    range(min: number, max: number): number;
    /** 洗牌 */
    shuffle<T>(array: T[]): T[];
};

// ============================================================================
// 管线上下文
// ============================================================================

/**
 * 管线执行上下文
 */
export interface PipelineContext<TCore = unknown> {
    /** 当前完整状态 */
    state: MatchState<TCore>;
    /** 当前命令 */
    command: Command;
    /** 产生的事件 */
    events: GameEvent[];
    /** 随机数生成器 */
    random: RandomFn;
    /** 玩家列表 */
    playerIds: PlayerId[];
}

// ============================================================================
// 导出
// ============================================================================

export type {
    Command as EngineCommand,
    GameEvent as EngineEvent,
};
