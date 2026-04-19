/**
 * 系统层接口定义
 * 
 * 系统以插件方式承载跨游戏能力，通过 hook 参与 command/event 管线。
 * 系统必须满足：确定性、面向纯数据、可按游戏启用/关闭
 */

import type {
    GameEvent,
    MatchState,
    PipelineContext,
    PlayerId,
    SystemState,
} from '../types';

// ============================================================================
// 系统生命周期 Hook
// ============================================================================

/**
 * 系统 Hook 结果
 */
export interface HookResult<TCore = unknown> {
    /** 是否阻止后续执行 */
    halt?: boolean;
    /** 更新后的状态 */
    state?: MatchState<TCore>;
    /** 额外产生的事件 */
    events?: GameEvent[];
    /** 错误信息 */
    error?: string;
}

/**
 * 系统定义接口
 */
export interface EngineSystem<TCore = unknown> {
    /** 系统 ID */
    id: string;

    /** 系统名称 */
    name: string;

    /** 系统优先级（越小越先执行） */
    priority?: number;

    /**
     * 命令执行前 Hook
     * 可用于：验证、日志记录、撤销快照
     */
    beforeCommand?(
        ctx: PipelineContext<TCore>,
    ): HookResult<TCore> | void;

    /**
     * 事件应用后 Hook
     * 可用于：更新系统状态、触发后续逻辑
     */
    afterEvents?(
        ctx: PipelineContext<TCore>,
    ): HookResult<TCore> | void;

    /**
     * 玩家视图过滤 Hook
     * 可用于：隐藏系统敏感信息
     */
    playerView?(
        state: MatchState<TCore>,
        playerId: PlayerId,
    ): Partial<SystemState>;

    /**
     * 初始化系统状态
     */
    setup?(playerIds: PlayerId[]): Partial<SystemState>;
}

// ============================================================================
// 系统注册表
// ============================================================================

/**
 * 系统配置
 */
export interface SystemConfig {
    /** 是否启用 */
    enabled: boolean;
    /** 系统特定配置 */
    options?: Record<string, unknown>;
}

/**
 * 游戏系统配置
 */
export type GameSystemsConfig = Record<string, SystemConfig>;

/**
 * 系统注册表
 */
export class SystemRegistry<TCore = unknown> {
    private systems = new Map<string, EngineSystem<TCore>>();

    /**
     * 注册系统
     */
    register(system: EngineSystem<TCore>): void {
        this.systems.set(system.id, system);
    }

    /**
     * 获取系统
     */
    get(id: string): EngineSystem<TCore> | undefined {
        return this.systems.get(id);
    }

    /**
     * 获取所有系统（按优先级排序）
     */
    getAll(): EngineSystem<TCore>[] {
        return Array.from(this.systems.values()).sort(
            (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
        );
    }

    /**
     * 获取启用的系统
     */
    getEnabled(config: GameSystemsConfig): EngineSystem<TCore>[] {
        return this.getAll().filter(
            (sys) => config[sys.id]?.enabled !== false
        );
    }
}

// ============================================================================
// 内置系统 ID
// ============================================================================

export const SYSTEM_IDS = {
    FLOW: 'flow',
    UNDO: 'undo',
    INTERACTION: 'interaction',
    SIMPLE_CHOICE: 'simple-choice',
    LOG: 'log',
    EVENT_STREAM: 'eventStream',
    ACTION_LOG: 'actionLog',
    REMATCH: 'rematch',
    RESPONSE_WINDOW: 'responseWindow',
    TUTORIAL: 'tutorial',
    CHEAT: 'cheat',
} as const;

export type SystemId = (typeof SYSTEM_IDS)[keyof typeof SYSTEM_IDS];
