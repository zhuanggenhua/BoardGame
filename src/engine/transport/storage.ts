/**
 * 存储层接口定义
 *
 * 提供项目自有的存储抽象。
 * MongoStorage / HybridStorage 将适配此接口。
 */

// ============================================================================
// 元数据类型
// ============================================================================

/**
 * 玩家元数据
 */
export interface PlayerMetadata {
    name?: string;
    credentials?: string;
    isConnected?: boolean;
}

/**
 * 对局元数据
 */
export interface MatchMetadata {
    gameName: string;
    players: Record<string, PlayerMetadata>;
    createdAt: number;
    updatedAt: number;
    gameover?: unknown;
    setupData?: unknown;
    /** 内存房间断线时间戳（HybridStorage 使用） */
    disconnectedSince?: number | null;
}

// ============================================================================
// 存储状态类型
// ============================================================================

/**
 * 存储中的对局状态
 *
 * 只需要 G（即 MatchState<TCore>）和一个递增版本号。
 */
export interface StoredMatchState {
    /** 游戏状态（MatchState<TCore> 的序列化形式） */
    G: unknown;
    /** 状态版本号（每次 setState 递增，用于并发检测） */
    _stateID: number;
    /** 随机种子（用于服务端重启后恢复确定性随机序列） */
    randomSeed?: string;
    /** 随机游标（累计消耗次数） */
    randomCursor?: number;
}

// ============================================================================
// 创建对局参数
// ============================================================================

/**
 * 创建对局的初始数据
 */
export interface CreateMatchData {
    initialState: StoredMatchState;
    metadata: MatchMetadata;
}

// ============================================================================
// Fetch 选项与结果
// ============================================================================

/**
 * fetch 选项（按需获取字段，减少 IO）
 */
export interface FetchOpts {
    state?: boolean;
    metadata?: boolean;
}

/**
 * fetch 结果
 */
export interface FetchResult {
    state?: StoredMatchState;
    metadata?: MatchMetadata;
}

// ============================================================================
// 列表查询选项
// ============================================================================

export interface ListMatchesOpts {
    gameName?: string;
    where?: {
        isGameover?: boolean;
        updatedBefore?: number;
        updatedAfter?: number;
    };
}

// ============================================================================
// 核心存储接口
// ============================================================================

/**
 * 对局存储接口
 *
 * 所有存储实现（MongoStorage、HybridStorage）必须实现此接口。
 */
export interface MatchStorage {
    /** 连接存储后端 */
    connect(): Promise<void>;

    /** 创建对局 */
    createMatch(matchID: string, data: CreateMatchData): Promise<void>;

    /** 更新对局状态 */
    setState(matchID: string, state: StoredMatchState): Promise<void>;

    /** 更新对局元数据 */
    setMetadata(matchID: string, metadata: MatchMetadata): Promise<void>;

    /** 获取对局数据（按需获取字段） */
    fetch(matchID: string, opts: FetchOpts): Promise<FetchResult>;

    /** 删除对局 */
    wipe(matchID: string): Promise<void>;

    /** 列出对局 ID */
    listMatches(opts?: ListMatchesOpts): Promise<string[]>;
}
