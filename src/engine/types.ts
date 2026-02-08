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
    /** 本地同屏可跳过领域校验（由适配层注入） */
    skipValidation?: boolean;
}

/**
 * 事件基础接口（权威后果）
 */
export interface GameEvent<TType extends string = string, TPayload = unknown> {
    type: TType;
    payload: TPayload;
    sourceCommandType?: string;
    timestamp: number;
    /** 可选的音效 key（用于音频系统自定义播放） */
    sfxKey?: string;
    /** 事件级音效 key（优先级最高） */
    audioKey?: string;
    /** 事件级音效分类（用于统一映射） */
    audioCategory?: { group: string; sub?: string };
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
 * 事件流条目
 */
export interface EventStreamEntry {
    id: number;
    event: GameEvent;
}

/**
 * 事件流系统状态
 */
export interface EventStreamState {
    entries: EventStreamEntry[];
    maxEntries: number;
    nextId: number;
}

/**
 * 操作日志片段
 * - text: 纯文本
 * - card: 卡牌片段（用于 hover 预览）
 */
export type ActionLogSegment =
    | { type: 'text'; text: string }
    | {
          type: 'card';
          cardId: string;
          previewText?: string;
      };

/**
 * 操作日志条目
 */
export interface ActionLogEntry {
    id: string;
    timestamp: number;
    actorId: PlayerId;
    /** 行为类型（通常为 command type） */
    kind: string;
    segments: ActionLogSegment[];
}

/**
 * 操作日志系统状态
 */
export interface ActionLogState {
    entries: ActionLogEntry[];
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
 * 响应窗口类型
 * - afterRollConfirmed: 确认骰面后（所有有骰子相关卡牌的玩家可响应）
 * - afterCardPlayed: 卡牌打出后（受影响玩家可响应）
 * - thenBreakpoint: "然后"断点（所有玩家可响应）
 */
export type ResponseWindowType = 'afterRollConfirmed' | 'afterCardPlayed' | 'thenBreakpoint' | 'meFirst';

/**
 * 响应窗口状态
 * 支持多玩家响应队列
 */
export interface ResponseWindowState {
    /** 当前响应窗口 */
    current?: {
        /** 窗口唯一 ID */
        id: string;
        /** 窗口类型 */
        windowType: ResponseWindowType;
        /** 来源卡牌/技能 ID（可选） */
        sourceId?: string;
        /** 响应者队列（按顺序轮询） */
        responderQueue: PlayerId[];
        /** 当前响应者索引 */
        currentResponderIndex: number;
        /** 已跳过的玩家 */
        passedPlayers: PlayerId[];
        /** 交互锁：阻止推进直到交互完成（存储交互 ID） */
        pendingInteractionId?: string;
    };
}

// ============================================================================
// 教程系统
// ============================================================================

export type TutorialStepPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface TutorialEventMatcher {
    type: string;
    match?: Record<string, unknown>;
}

export interface TutorialRandomPolicy {
    mode: 'fixed' | 'sequence';
    values: number[];
    cursor?: number;
}

export interface TutorialAiAction {
    commandType: string;
    payload?: unknown;
    /** 覆盖执行者 playerId（教程模式下默认使用 coreCurrentPlayer，此字段可强制指定） */
    playerId?: string;
}

export interface TutorialStepSnapshot {
    id: string;
    content: string;
    highlightTarget?: string;
    position?: TutorialStepPosition;
    requireAction?: boolean;
    showMask?: boolean;
    allowedCommands?: string[];
    blockedCommands?: string[];
    advanceOnEvents?: TutorialEventMatcher[];
    randomPolicy?: TutorialRandomPolicy;
    aiActions?: TutorialAiAction[];
    allowManualSkip?: boolean;
}

export interface TutorialManifest {
    id: string;
    steps: TutorialStepSnapshot[];
    allowManualSkip?: boolean;
    randomPolicy?: TutorialRandomPolicy;
}

export interface TutorialState {
    active: boolean;
    manifestId: string | null;
    stepIndex: number;
    steps: TutorialStepSnapshot[];
    step: TutorialStepSnapshot | null;
    /** manifest 级别配置（用于步骤推进时复用） */
    manifestAllowManualSkip?: boolean;
    manifestRandomPolicy?: TutorialRandomPolicy;
    allowedCommands?: string[];
    blockedCommands?: string[];
    advanceOnEvents?: TutorialEventMatcher[];
    randomPolicy?: TutorialRandomPolicy;
    aiActions?: TutorialAiAction[];
    allowManualSkip?: boolean;
}

export const DEFAULT_TUTORIAL_STATE: TutorialState = {
    active: false,
    manifestId: null,
    stepIndex: 0,
    steps: [],
    step: null,
};

/**
 * 系统状态（G.sys）
 */
export interface SystemState {
    /** Schema 版本（用于迁移） */
    schemaVersion: number;
    /** matchID */
    matchId?: string;
    /** 撤销系统状态 */
    undo: UndoState;
    /** Prompt 系统状态 */
    prompt: PromptState;
    /** 日志系统状态 */
    log: LogState;
    /** 事件流系统状态 */
    eventStream: EventStreamState;
    /** 操作日志系统状态 */
    actionLog: ActionLogState;
    /** 重赛系统状态 */
    rematch: RematchState;
    /** 响应窗口状态 */
    responseWindow: ResponseWindowState;
    /** 教程系统状态 */
    tutorial: TutorialState;
    /** 当前回合数 */
    turnNumber: number;
    /** 当前阶段（单一权威；没有阶段概念的游戏使用空字符串） */
    phase: string;
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

    /** 初始化游戏状态（仅返回 core，sys 由系统层 setup） */
    setup(playerIds: PlayerId[], random: RandomFn): TState;

    /** 验证命令合法性（允许读取 sys 状态，例如 sys.phase） */
    validate(state: MatchState<TState>, command: TCommand): ValidationResult;

    /** 执行命令，产生事件（允许读取 sys 状态，例如 sys.phase） */
    execute(state: MatchState<TState>, command: TCommand, random: RandomFn): TEvent[];

    /** 应用事件，返回新状态（确定性 reducer，仅作用于 core） */
    reduce(state: TState, event: TEvent): TState;

    /** 玩家视图过滤（隐藏信息，仅作用于 core） */
    playerView?(state: TState, playerId: PlayerId): Partial<TState>;

    /** 判断游戏是否结束（仅作用于 core） */
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
