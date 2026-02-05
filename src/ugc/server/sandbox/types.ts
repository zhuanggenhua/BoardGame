/**
 * UGC 服务端沙箱类型定义
 * 
 * 定义沙箱配置、执行结果等类型
 */

// ============================================================================
// 沙箱配置
// ============================================================================

/** 沙箱配置 */
export interface SandboxConfig {
    /** 执行超时时间（毫秒） */
    timeoutMs: number;
    /** 内存限制（MB） */
    memoryLimitMb: number;
    /** 是否允许控制台输出 */
    allowConsole: boolean;
    /** 自定义全局变量 */
    globals?: Record<string, unknown>;
}

/** 默认沙箱配置 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
    timeoutMs: 100,
    memoryLimitMb: 64,
    allowConsole: false,
};

// ============================================================================
// 执行结果
// ============================================================================

export type RuleExecutionStage = 'load' | 'setup' | 'validate' | 'execute' | 'reduce' | 'playerView' | 'isGameOver';

export type SandboxErrorType = 'timeout' | 'memory' | 'permission' | 'runtime' | 'syntax' | 'contract';

/** 沙箱执行结果 */
export interface SandboxResult<T = unknown> {
    /** 是否成功 */
    success: boolean;
    /** 返回值 */
    result?: T;
    /** 错误信息 */
    error?: string;
    /** 错误类型 */
    errorType?: SandboxErrorType;
    /** 失败阶段 */
    errorStage?: RuleExecutionStage;
    /** 最小错误日志 */
    errorLog?: string;
    /** 执行时间（毫秒） */
    executionTimeMs?: number;
    /** 控制台输出 */
    consoleOutput?: string[];
}

// ============================================================================
// DomainCore 契约
// ============================================================================

/** 随机数函数接口 */
export interface RandomFn {
    random(): number;
    d(max: number): number;
    range(min: number, max: number): number;
    shuffle<T>(array: T[]): T[];
}

/** 验证结果 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/** 游戏结束结果 */
export interface GameOverResult {
    winner?: string;
    winners?: string[];
    draw?: boolean;
    scores?: Record<string, number>;
}

/** UGC DomainCore 契约（沙箱内执行） */
export interface UGCDomainCore {
    /** 游戏 ID */
    gameId: string;
    /** 初始化游戏状态 */
    setup(playerIds: string[], random: RandomFn): unknown;
    /** 验证命令合法性 */
    validate(state: unknown, command: unknown): ValidationResult;
    /** 执行命令，产生事件 */
    execute(state: unknown, command: unknown, random: RandomFn): unknown[];
    /** 应用事件，返回新状态 */
    reduce(state: unknown, event: unknown): unknown;
    /** 玩家视图过滤 */
    playerView?(state: unknown, playerId: string): unknown;
    /** 判断游戏是否结束 */
    isGameOver?(state: unknown): GameOverResult | undefined;
}

// ============================================================================
// 沙箱命令
// ============================================================================

/** 沙箱命令类型 */
export type SandboxCommandType = 'setup' | 'validate' | 'execute' | 'reduce' | 'playerView' | 'isGameOver';

/** 沙箱命令 */
export interface SandboxCommand {
    type: SandboxCommandType;
    payload: unknown;
}

/** Setup 命令 */
export interface SetupCommand extends SandboxCommand {
    type: 'setup';
    payload: {
        playerIds: string[];
        randomSeed: number;
    };
}

/** Validate 命令 */
export interface ValidateCommand extends SandboxCommand {
    type: 'validate';
    payload: {
        state: unknown;
        command: unknown;
    };
}

/** Execute 命令 */
export interface ExecuteCommand extends SandboxCommand {
    type: 'execute';
    payload: {
        state: unknown;
        command: unknown;
        randomSeed: number;
    };
}

/** Reduce 命令 */
export interface ReduceCommand extends SandboxCommand {
    type: 'reduce';
    payload: {
        state: unknown;
        event: unknown;
    };
}

// ============================================================================
// 禁用的 API
// ============================================================================

/** 沙箱中禁用的全局 API */
export const DISABLED_GLOBALS = [
    'require',
    'import',
    'eval',
    'Function',
    'process',
    'Buffer',
    '__dirname',
    '__filename',
    'module',
    'exports',
    'global',
    'globalThis',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'Worker',
    'SharedWorker',
    'ServiceWorker',
    'indexedDB',
    'localStorage',
    'sessionStorage',
    'document',
    'window',
    'navigator',
    'location',
    'history',
    'fs',
    'net',
    'child_process',
    'os',
    'path',
    'crypto',
    'http',
    'https',
    'dgram',
    'dns',
    'tls',
    'cluster',
];
