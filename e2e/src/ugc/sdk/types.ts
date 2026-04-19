/**
 * UGC SDK 类型定义
 * 
 * 定义 UGC 视图与宿主之间的通信协议
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 玩家 ID */
export type PlayerId = string;

/** UGC 游戏包 ID */
export type PackageId = string;

/** 组件 ID */
export type ComponentId = string;

/** 效果 ID */
export type EffectId = string;

// ============================================================================
// SDK Message Schema
// ============================================================================

/**
 * 消息来源类型
 */
export type MessageSource = 'ugc-view' | 'ugc-host';

/**
 * 基础消息结构
 */
export interface BaseMessage {
    /** 消息 ID（用于请求-响应匹配） */
    id: string;
    /** 消息来源 */
    source: MessageSource;
    /** 时间戳 */
    timestamp: number;
}

// ============================================================================
// 视图 → 宿主 消息（请求）
// ============================================================================

/**
 * 视图发起的命令类型
 */
export type ViewCommandType =
    | 'PLAY_CARD'           // 打出卡牌
    | 'SELECT_TARGET'       // 选择目标
    | 'END_PHASE'           // 结束阶段
    | 'END_TURN'            // 结束回合
    | 'DRAW_CARD'           // 摸牌
    | 'DISCARD_CARD'        // 弃牌
    | 'USE_ABILITY'         // 使用技能
    | 'RESPOND'             // 响应（如闪避、格挡）
    | 'PASS'                // 跳过
    | 'BID'                 // 叫分
    | 'CALL_LANDLORD'       // 抢地主
    | 'CUSTOM';             // 自定义命令

/**
 * 视图 → 宿主：执行命令请求
 */
export interface ViewCommandMessage extends BaseMessage {
    source: 'ugc-view';
    type: 'COMMAND';
    payload: {
        /** 命令类型 */
        commandType: ViewCommandType;
        /** 执行者玩家 ID */
        playerId: PlayerId;
        /** 命令参数 */
        params: Record<string, unknown>;
    };
}

/**
 * 视图 → 宿主：请求游戏状态
 */
export interface ViewStateRequestMessage extends BaseMessage {
    source: 'ugc-view';
    type: 'STATE_REQUEST';
}

/**
 * 视图 → 宿主：播放音效请求
 */
export interface ViewPlaySfxMessage extends BaseMessage {
    source: 'ugc-view';
    type: 'PLAY_SFX';
    payload: {
        /** 音效 key */
        sfxKey: string;
        /** 音量（0-1） */
        volume?: number;
    };
}

/**
 * 视图 → 宿主：视图已就绪
 */
export interface ViewReadyMessage extends BaseMessage {
    source: 'ugc-view';
    type: 'VIEW_READY';
}

/**
 * 视图发送的所有消息类型
 */
export type ViewMessage =
    | ViewCommandMessage
    | ViewStateRequestMessage
    | ViewPlaySfxMessage
    | ViewReadyMessage;

// ============================================================================
// 宿主 → 视图 消息（响应/推送）
// ============================================================================

/**
 * 宿主 → 视图：命令执行结果
 */
export interface HostCommandResultMessage extends BaseMessage {
    source: 'ugc-host';
    type: 'COMMAND_RESULT';
    payload: {
        /** 请求消息 ID */
        requestId: string;
        /** 是否成功 */
        success: boolean;
        /** 错误信息 */
        error?: string;
        /** 产生的事件 */
        events?: GameEventData[];
    };
}

/**
 * 宿主 → 视图：状态更新推送
 */
export interface HostStateUpdateMessage extends BaseMessage {
    source: 'ugc-host';
    type: 'STATE_UPDATE';
    payload: {
        /** 游戏状态（视图可见部分） */
        state: UGCGameState;
    };
}

/**
 * 宿主 → 视图：初始化数据
 */
export interface HostInitMessage extends BaseMessage {
    source: 'ugc-host';
    type: 'INIT';
    payload: {
        /** 游戏包 ID */
        packageId: PackageId;
        /** 当前玩家 ID */
        currentPlayerId: PlayerId;
        /** 所有玩家 ID */
        playerIds: PlayerId[];
        /** 初始状态 */
        state: UGCGameState;
        /** SDK 版本 */
        sdkVersion: string;
    };
}

/**
 * 宿主 → 视图：错误通知
 */
export interface HostErrorMessage extends BaseMessage {
    source: 'ugc-host';
    type: 'ERROR';
    payload: {
        /** 错误代码 */
        code: string;
        /** 错误信息 */
        message: string;
    };
}

/**
 * 宿主发送的所有消息类型
 */
export type HostMessage =
    | HostCommandResultMessage
    | HostStateUpdateMessage
    | HostInitMessage
    | HostErrorMessage;

/**
 * 所有消息类型
 */
export type SDKMessage = ViewMessage | HostMessage;

// ============================================================================
// 游戏状态类型
// ============================================================================

/**
 * UGC 游戏状态（视图可见部分）
 */
export interface UGCGameState {
    /** 当前阶段 */
    phase: string;
    /** 当前回合玩家 */
    activePlayerId: PlayerId;
    /** 回合数 */
    turnNumber: number;
    /** 玩家状态 */
    players: Record<PlayerId, PlayerState>;
    /** 公共区域（如弃牌堆） */
    publicZones?: Record<string, unknown>;
    /** 游戏结束信息 */
    gameOver?: {
        winner?: PlayerId;
        draw?: boolean;
    };
}

/**
 * 玩家状态
 */
export interface PlayerState {
    /** 资源（如生命值、法力值） */
    resources: Record<string, number>;
    /** 手牌数量（不暴露具体手牌） */
    handCount: number;
    /** 牌库剩余数量 */
    deckCount: number;
    /** 弃牌堆数量 */
    discardCount: number;
    /** 状态效果 */
    statusEffects: Record<string, number>;
    /** 其他公开信息 */
    public?: Record<string, unknown>;
}

/**
 * 游戏事件数据
 */
export interface GameEventData {
    /** 事件类型 */
    type: string;
    /** 事件数据 */
    data: Record<string, unknown>;
}

// ============================================================================
// 宿主校验策略
// ============================================================================

/**
 * 命令校验结果
 */
export interface ValidationResult {
    /** 是否有效 */
    valid: boolean;
    /** 错误信息 */
    error?: string;
}

/**
 * 宿主校验策略配置
 */
export interface HostValidationConfig {
    /** 允许的命令类型白名单（空表示允许所有） */
    allowedCommands?: ViewCommandType[];
    /** 命令频率限制（毫秒） */
    commandRateLimitMs?: number;
    /** 最大消息大小（字节） */
    maxMessageSize?: number;
    /** 是否校验玩家回合 */
    validateTurn?: boolean;
}

/**
 * 默认校验配置
 */
export const DEFAULT_VALIDATION_CONFIG: HostValidationConfig = {
    commandRateLimitMs: 100,
    maxMessageSize: 64 * 1024, // 64KB
    validateTurn: true,
};

// ============================================================================
// SDK 版本
// ============================================================================

export const SDK_VERSION = '1.0.0';
