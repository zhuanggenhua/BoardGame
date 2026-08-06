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
    /**
     * 每个快照对应的随机数游标，与 snapshots 一一对应。
     * 撤回恢复时用于重建随机序列，确保撤回后重新操作得到相同的随机结果。
     */
    snapshotCursors?: number[];
    /**
     * 撤回恢复后需要重置的随机数游标。
     * 由 UndoSystem 在恢复快照时写入，服务端读取后重建 trackedRandom 并清除此字段。
     */
    restoredRandomCursor?: number;
}

/**
 * @deprecated LogSystem 已移除，保留类型定义仅用于向后兼容（旧快照/存储迁移）
 */
export interface LogEntry {
    timestamp: number;
    type: 'command' | 'event' | 'system';
    data: Command | GameEvent | { message: string };
}

/**
 * @deprecated LogSystem 已移除，保留类型定义仅用于向后兼容
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
 * 数值分解明细行（用于 breakdown tooltip）
 */
export interface BreakdownLine {
    /** 显示标签（纯文本或 i18n key） */
    label: string;
    /** 标签是否为 i18n key（需要翻译） */
    labelIsI18n?: boolean;
    /** i18n namespace（labelIsI18n 为 true 时必填） */
    labelNs?: string;
    /** 数值（正数显示 +，负数显示 -） */
    value: number;
    /** 颜色提示：positive=绿色增益, negative=红色减益, neutral=默认 */
    color?: 'positive' | 'negative' | 'neutral';
}

/**
 * 操作日志片段
 * - text: 纯文本
 * - card: 卡牌片段（用于 hover 预览）
 * - i18n: 延迟翻译片段（存储 key + params，渲染时翻译，支持服务端无 i18n 环境）
 * - breakdown: 带 tooltip 的数值片段（hover 显示构成明细，虚线下划线）
 */
export type ActionLogSegment =
    | { type: 'text'; text: string }
    | {
          type: 'card';
          cardId: string;
          previewText?: string;
          /** 可选：previewText 为 i18n key 时的 namespace，渲染时延迟翻译 */
          previewTextNs?: string;
          /** 可选：直接内联 previewRef，优先于 cardPreviewRegistry 查找 */
          previewRef?: import('../core').CardPreviewRef;
      }
    | {
          type: 'i18n';
          /** i18n namespace（如 'game-example'） */
          ns: string;
          /** i18n key（如 'actionLog.advancePhase'） */
          key: string;
          /** 插值参数 */
          params?: Record<string, string | number>;
          /** 需要先翻译的 params key 列表（值为同 ns 下的 i18n key） */
          paramI18nKeys?: string[];
      }
    | {
          type: 'breakdown';
          /** 显示的数值文本（如 "5"） */
          displayText: string;
          /** 分解明细行 */
          lines: BreakdownLine[];
      }
    | {
          type: 'diceResult';
          /** 精灵图资源路径（不含扩展名，如 'game/images/asset'） */
          spriteAsset: string;
          /** 精灵图网格列数 */
          spriteCols: number;
          /** 精灵图网格行数 */
          spriteRows: number;
          /** 每个骰子的点数 (1-6) 和在精灵图中的位置 */
          dice: Array<{ value: number; col: number; row: number }>;
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
 * 响应窗口类型（引擎层为通用 string，由各游戏自定义具体值）
 */
export type ResponseWindowType = string;

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
        /** 所属 resolution frame（可选；未提供时由系统回退到当前 active frame） */
        resolutionFrameId?: string;
        /** 已跳过的玩家 */
        passedPlayers: PlayerId[];
        /** 交互锁：阻止推进直到交互完成（存储交互 ID） */
        pendingInteractionId?: string;
        /** 本轮是否有人执行了响应动作（用于 loopUntilAllPass 循环判定） */
        actionTakenThisRound?: boolean;
        /** 连续所有人都 pass 的轮数（用于 loopUntilAllPass 循环判定） */
        consecutivePassRounds?: number;
    };
}

/**
 * 连续结算阻塞来源
 */
export interface ResolutionBlocker {
    type: 'interaction' | 'response-window' | 'post-reduce' | 'external' | 'child-frame';
    id?: string;
    reason?: string;
}

export type ResolutionOrdering =
    | 'stack'
    | 'queue'
    | 'explicit'
    | 'nested-body'
    | 'explicit-order'
    | 'responder-round';

export type ResolutionStatus =
    | 'running'
    | 'blocked'
    | 'suspended'
    | 'completed';

export interface ResolutionOwnerRef {
    system: 'interaction' | 'response-window' | 'modal' | 'game' | 'external';
    id: string;
    kind?: string;
    gameId?: string;
    namespace?: string;
    resolutionFrameId?: string;
    blocksProgress?: boolean;
}

/**
 * 连续结算帧
 *
 * 用于表达一条跨事件批 / 交互 / 响应窗口的长事务。
 * 当前先作为通用引擎骨架存在，允许游戏渐进式迁移接入。
 */
export interface ResolutionFrame {
    id: string;
    kind: string;
    ownerGame?: string;
    ownerSystem?: string;
    /** 供 UI / Interaction / ResponseWindow 对齐 owner 时使用的稳定 token */
    ownerToken?: string;
    /** 当前前台阻塞 owner；仅表达前台 ownership，不表达业务完成 */
    foregroundOwner?: ResolutionOwnerRef;
    /** 父 frame；child 完成后优先恢复该父 frame */
    parentFrameId?: string;
    /** 当当前 frame 让父 frame 挂起时，记录被当前 frame 挂起的来源 */
    suspendedByFrameId?: string;
    ordering: ResolutionOrdering;
    status: ResolutionStatus;
    step?: string;
    phase?: string;
    phaseGate?: 'none' | 'block-advance-when-blocked';
    blockedBy?: ResolutionBlocker;
    deferredEvents?: Array<{ type: string; payload: unknown; timestamp: number }>;
    deferredActions?: unknown[];
    metadata?: Record<string, unknown>;
}

/**
 * 连续结算栈状态
 */
export interface ResolutionState {
    frames: ResolutionFrame[];
    activeFrameId?: string;
}

// ============================================================================
// 教程系统
// ============================================================================

export type TutorialStepPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type TutorialHighlightFrame = 'ring' | 'none';

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
    /**
     * Controls only the tutorial-drawn frame around the target.
     * Use `none` when the target is already a self-explanatory game object
     * and an extra rectangle would read as fake UI.
     */
    highlightFrame?: TutorialHighlightFrame;
    position?: TutorialStepPosition;
    requireAction?: boolean;
    showMask?: boolean;
    allowedCommands?: string[];
    /**
     * 允许交互的目标 ID 列表（UI 层卡牌/单位级门控）
     *
     * 设置后，只有 ID 在此列表中的目标可交互，其余置灰。
     * 各游戏自行定义 "目标" 含义（SmashUp = cardUid, TTT = cellId 等）。
     * 引擎不感知此字段，门控逻辑在 Board 组件中实现。
     */
    allowedTargets?: string[];
    advanceOnEvents?: TutorialEventMatcher[];
    randomPolicy?: TutorialRandomPolicy;
    aiActions?: TutorialAiAction[];
    /**
     * AI actions 执行完成后是否自动推进。
     *
     * 默认保持旧行为：没有 advanceOnEvents 的 AI 步骤会自动推进。
     * 某些教程步骤需要 AI 先补齐桌面状态，但仍停留在当前说明页等待玩家阅读。
     */
    autoAdvanceAfterAi?: boolean;
    allowManualSkip?: boolean;
    /** 是否等待动画完成后才推进到下一步 */
    waitForAnimation?: boolean;
    /**
     * 纯说明步骤模式：自动禁止所有游戏命令（除了系统命令）
     * 
     * 设置为 true 时，等同于 `allowedCommands: []`，但更语义化。
     * 优先级：allowedCommands > infoStep
     */
    infoStep?: boolean;
    /**
     * 教程视角切换：指定此步骤期间以哪个玩家的视角观看
     *
     * 设置后，MatchRoom 会自动切换 debugPlayerID 到指定玩家。
     * 步骤结束（推进到下一步）时，MatchRoom 自动恢复到玩家自己的视角（'0'）。
     * 适用于"对手回合"等需要展示对手视角的步骤。
     */
    viewAs?: string;
}

export interface TutorialManifest {
    id: string;
    steps: TutorialStepSnapshot[];
    allowManualSkip?: boolean;
    randomPolicy?: TutorialRandomPolicy;
    /**
     * 教程运行时需要的真实玩家人数。
     *
     * 默认不填时回退到引擎最小人数；像 3 人教程这种不能再靠页面层硬编码猜测。
     */
    numPlayers?: number;
    /**
     * 步骤前置条件校验器（通用防卡住机制）
     *
     * 引擎在两个时机调用：
     * 1. 进入新步骤时 — 返回 false 则跳过该步骤
     * 2. 每次命令执行后 — 返回 false 则自动推进到下一步
     *
     * 注意：函数不可序列化，不会存入 TutorialState。
     */
    stepValidator?: (state: MatchState<unknown>, step: TutorialStepSnapshot) => boolean;
}

export interface TutorialCollectionEntry {
    title?: string;
    titleKey?: string;
    description?: string;
    descriptionKey?: string;
    /**
     * 是否从玩家可见的教程目录中隐藏。
     *
     * 适用于仍需保留直达路由、测试入口或补充分支案例，
     * 但不应作为玩家主章节平级暴露的教程。
     */
    hiddenFromCatalog?: boolean;
    /**
     * 当前教程完成后，自动衔接到的下一个教程路由。
     *
     * 用于把多个真实预设局面串成一个玩家章节，
     * 避免为了保留真实局面而把同一章拆成多个平级目录项。
     */
    nextTutorialId?: string;
    manifest: TutorialManifest;
}

export interface TutorialCollection {
    defaultTutorialId: string;
    tutorials: Record<string, TutorialCollectionEntry>;
}

export type GameTutorialSource = TutorialManifest | TutorialCollection;

export interface TutorialState {
    active: boolean;
    manifestId: string | null;
    stepIndex: number;
    steps: TutorialStepSnapshot[];
    step: TutorialStepSnapshot | null;
    /** manifest 级别配置（用于步骤推进时复用） */
    manifestAllowManualSkip?: boolean;
    manifestRandomPolicy?: TutorialRandomPolicy;
    /** 派生值：结合 step + manifest 得出的有效随机策略 */
    randomPolicy?: TutorialRandomPolicy;
    /** 可变运行时：AI 动作队列（消费后清除） */
    aiActions?: TutorialAiAction[];
    /** 派生值：结合 step + manifest 得出的是否允许手动跳过 */
    allowManualSkip?: boolean;
    /** 动画等待：事件已匹配，正在等待动画完成 */
    pendingAnimationAdvance?: boolean;
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
    /** 当前可决策面的显式版本号；交互/响应窗口等决策面变化时递增 */
    decisionEpoch?: number;
    /** 撤销系统状态 */
    undo: UndoState;
    /** 交互系统状态（替代旧 PromptSystem） */
    interaction: import('./systems/InteractionSystem').InteractionState;
    /**
     * @deprecated LogSystem 已移除。保留空壳字段用于向后兼容旧快照/存储。
     * 生产日志由 Winston（server/logger.ts）独立记录。
     */
    log: LogState;
    /** 事件流系统状态 */
    eventStream: EventStreamState;
    /** 操作日志系统状态 */
    actionLog: ActionLogState;
    /** 重赛系统状态 */
    rematch: RematchState;
    /** 响应窗口状态 */
    responseWindow: ResponseWindowState;
    /** 连续结算栈（通用长事务骨架，游戏可渐进接入） */
    resolution?: ResolutionState;
    /** 教程系统状态 */
    tutorial: TutorialState;
    /** 当前回合数 */
    turnNumber: number;
    /** 当前阶段（单一权威；没有阶段概念的游戏使用空字符串） */
    phase: string;
    /** FlowSystem: onPhaseExit 返回 halt 后置为 true，阶段成功推进后置为 false */
    flowHalted?: boolean;
    /** 游戏结束结果（由管线在每次命令执行后自动检测并写入） */
    gameover?: GameOverResult;
    /** SmashUp: postProcessSystemEvents 去重标记（防止 MINION_PLAYED/ACTION_PLAYED 被处理两次） */
    _processedPlayedEvents?: Set<string>;
    /** SmashUp: postProcessSystemEvents 去重标记（防止 MINION_DESTROYED 被处理两次） */
    _processedDestroyEvents?: Set<string>;
    /** SmashUp: postProcessSystemEvents 去重标记（防止 MINION_DESTROYED 被处理两次） */
    _processedDestroyEvents?: Set<string>;
    /** SummonerWars: 交互辅助缓存（阶段结束技能已处理标记） */
    summonerWars?: {
        phaseEndAbilityResolved?: Record<string, true>;
    };
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
    setup(playerIds: PlayerId[], random: RandomFn, setupData?: unknown): TState;

    /**
     * 可选：命令进入 pipeline 前的权威状态归一化。
     *
     * 用于兼容旧快照/线上脏数据，确保 systems.beforeCommand 与后续领域逻辑
     * 看到的是同一份语义稳定的 runtime state。
     */
    normalizeRuntimeState?(state: MatchState<TState>): MatchState<TState>;

    /** 验证命令合法性（允许读取 sys 状态，例如 sys.phase） */
    validate(state: MatchState<TState>, command: TCommand): ValidationResult;

    /** 执行命令，产生事件（允许读取 sys 状态，例如 sys.phase） */
    execute(state: MatchState<TState>, command: TCommand, random: RandomFn): TEvent[];

    /** 应用事件，返回新状态（确定性 reducer，仅作用于 core） */
    reduce(state: TState, event: TEvent): TState;

    /**
     * 可选：系统事件后处理（afterEvents 轮中，reduce 前）
     *
     * 典型用途：系统（如 PromptBridge）产生的领域事件需要触发领域层后处理
     * （如消灭→onDestroy 触发、移动→onMove 触发），但这些事件不经过 execute()。
     * pipeline 在每轮 afterEvents 收集完系统事件后、reduce 前调用此钩子，
     * 允许领域层追加派生事件（如 trigger 回调产生的额外事件）。
     * 返回值可以是事件数组（向后兼容），也可以是 { events, matchState } 对象（支持状态变更）。
     */
    postProcessSystemEvents?(state: TState, events: TEvent[], random: RandomFn, matchState?: MatchState<TState>): TEvent[] | { events: TEvent[]; matchState?: MatchState<TState> };

    /**
     * 可选：reduce 前的单事件拦截/替换
     * 
     * 典型用途：替代效果（Replacement Effects），如「若你将受到伤害，改为…」。
     * - 返回原事件：不拦截
     * - 返回新事件/事件数组：替换
     * - 返回 null：吞噬该事件
     */
    interceptEvent?(state: TState, event: TEvent): TEvent | TEvent[] | null;

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
    /** 获取当前随机数游标（可选，由 trackedRandom 提供，用于撤回时恢复随机序列） */
    getCursor?(): number;
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
    /** afterEvents 多轮迭代的当前轮次（0 = 首轮，>0 = 后续轮次） */
    afterEventsRound?: number;
}

// ============================================================================
// 导出
// ============================================================================

export type {
    Command as EngineCommand,
    GameEvent as EngineEvent,
};
