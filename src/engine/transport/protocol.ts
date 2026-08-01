/**
 * 传输层协议定义
 *
 * 定义客户端与服务端之间的 socket.io 事件协议和共享类型。
 */

// ============================================================================
// 玩家信息
// ============================================================================

/**
 * 对局中的玩家信息（广播给客户端）
 */
export interface MatchPlayerInfo {
    id: number;
    name?: string;
    isConnected?: boolean;
    /** 当前座位是否为房主。 */
    isOwner?: boolean;
}

export interface SyncStateMeta {
    /** 当前全量同步对应的权威 stateID */
    stateID: number;
}

export interface RandomSyncMeta {
    /** 随机种子 */
    seed: string;
    /** 当前随机游标 */
    cursor: number;
}

export interface StateUpdateMeta {
    /** 当前权威状态版本 */
    stateID?: number;
    /** 最近一条命令的发送者 */
    lastCommandPlayerId?: string;
    /** 当前随机游标 */
    randomCursor?: number;
}

export interface StatePatchMeta {
    /** 当前权威状态版本 */
    stateID: number;
    /** 最近一条命令的发送者 */
    lastCommandPlayerId?: string;
    /** 当前随机游标 */
    randomCursor: number;
}

export interface MatchUiEvent {
    type: string;
    playerId: string;
    payload: unknown;
    sentAt?: number;
}

export interface BatchDispatchMeta {
    /** 客户端发起这批命令时所基于的权威 stateID */
    expectedStateID?: number;
}

// ============================================================================
// 客户端 → 服务端 事件
// ============================================================================

export interface ClientToServerEvents {
    /** 同步请求：客户端连接/重连后请求当前状态 */
    'sync': (matchID: string, playerID: string | null, credentials?: string) => void;

    /** 发送命令 */
    'command': (matchID: string, commandType: string, payload: unknown, credentials?: string) => void;

    /** 批量命令：将多个命令合并为一次网络请求发送 */
    'batch': (
        matchID: string,
        batchId: string,
        commands: Array<{ type: string; payload: unknown }>,
        credentials?: string,
        meta?: BatchDispatchMeta,
    ) => void;

    /** 临时 UI 事件：只转发给同局客户端，不进入权威游戏状态 */
    'ui:event': (matchID: string, eventType: string, payload: unknown, credentials?: string) => void;
}

// ============================================================================
// 服务端 → 客户端 事件
// ============================================================================

export interface ServerToClientEvents {
    /** 完整状态同步（连接/重连时） */
    'state:sync': (
        matchID: string,
        state: unknown,
        matchPlayers: MatchPlayerInfo[],
        /** 随机数同步元数据（种子+游标），供客户端乐观引擎构建同步随机数生成器 */
        randomMeta?: RandomSyncMeta,
        /** 全量同步基线元数据，供客户端建立后续 patch 连续性校验基线 */
        syncMeta?: SyncStateMeta,
    ) => void;

    /** 增量状态更新（命令执行后） */
    'state:update': (
        matchID: string,
        state: unknown,
        matchPlayers: MatchPlayerInfo[],
        /** 元数据，用于乐观更新校验 */
        meta?: StateUpdateMeta,
    ) => void;

    /** 增量状态 patch（命令执行后，状态变化较小时） */
    'state:patch': (
        matchID: string,
        patches: import('fast-json-patch').Operation[],
        matchPlayers: MatchPlayerInfo[],
        /** 元数据，用于乐观更新校验 */
        meta: StatePatchMeta,
    ) => void;

    /** 命令执行错误 */
    'error': (matchID: string, error: string) => void;

    /** 玩家连接状态变更 */
    'player:connected': (matchID: string, playerID: string) => void;
    'player:disconnected': (matchID: string, playerID: string) => void;

    /** 批次确认（返回权威状态） */
    'batch:confirmed': (matchID: string, batchId: string, state: unknown) => void;

    /** 批次拒绝 */
    'batch:rejected': (matchID: string, batchId: string, reason: string) => void;

    /** 临时 UI 事件：例如拖拽预览、指示器等非权威表现 */
    'ui:event': (matchID: string, event: MatchUiEvent) => void;
}

// ============================================================================
// Board Props 契约
// ============================================================================

/**
 * 游戏 Board 组件的标准 Props
 *
 * 提供类型安全的命令分发。
 * TCore: 游戏核心状态类型
 * TCommandMap: 命令名→payload 映射类型（可选，默认 Record<string, unknown>）
 */
export interface GameBoardProps<
    TCore = unknown,
    TCommandMap extends Record<string, unknown> = Record<string, unknown>,
> {
    /** 完整游戏状态（包含 core + sys） */
    G: import('../types').MatchState<TCore>;

    /** 类型安全的命令分发 */
    dispatch: <K extends string & keyof TCommandMap>(
        type: K,
        payload: TCommandMap[K],
    ) => void;

    /** 当前玩家 ID（在线模式为实际 playerID，本地模式为 null） */
    playerID: string | null;

    /** 对局中的玩家信息（名称、连接状态） */
    matchData?: MatchPlayerInfo[];

    /** 本地/在线座位控制器：human / local-ai / remote-ai，供 Board 区分热座与人机局 */
    seatControllers?: Record<string, import('../ai/types').AiSeatController>;

    /** 是否为多人在线模式 */
    isMultiplayer?: boolean;

    /** 是否已连接到服务端 */
    isConnected?: boolean;

    /** 当前语言代码（用于本地化资源路径与 UI 文案） */
    locale?: string;

    /** 重置游戏回调（用于重赛） */
    reset?: () => void;

    /** 发送临时 UI 事件；仅在线模式实际转发，本地模式为 no-op */
    sendUiEvent?: (type: string, payload: unknown) => void;

    /** 订阅同局其它客户端发来的临时 UI 事件 */
    subscribeUiEvent?: (listener: (event: MatchUiEvent) => void) => () => void;
}
