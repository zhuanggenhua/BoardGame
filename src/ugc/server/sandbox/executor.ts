/**
 * UGC 服务端沙箱执行器
 * 
 * 使用 vm 模块在隔离环境中执行 UGC 规则代码
 * 注：生产环境建议使用 isolated-vm 获得更强隔离
 */

import type {
    SandboxConfig,
    SandboxResult,
    RandomFn,
    ValidationResult,
    GameOverResult,
    UGCDomainCore,
    RuleExecutionStage,
    SandboxErrorType,
} from './types';
import { DEFAULT_SANDBOX_CONFIG, DISABLED_GLOBALS } from './types';

// ============================================================================
// 伪随机数生成器（确定性）
// ============================================================================

/** 创建基于种子的伪随机数生成器 */
function createSeededRandom(seed: number): RandomFn {
    let state = seed;
    
    const next = (): number => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };

    return {
        random: next,
        d: (max: number) => Math.floor(next() * max) + 1,
        range: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
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

const PERMISSION_PREFIX = 'UGC_PERMISSION:';

const normalizeErrorMessage = (error: unknown, fallback = '执行失败'): string => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const stripErrorPrefix = (message: string): string => {
    if (message.startsWith(PERMISSION_PREFIX)) {
        return message.replace(PERMISSION_PREFIX, '').trim();
    }
    return message;
};

const resolveErrorType = (error: unknown, fallback: SandboxErrorType): SandboxErrorType => {
    if (error instanceof Error && error.message.startsWith(PERMISSION_PREFIX)) {
        return 'permission';
    }
    return fallback;
};

const buildErrorLog = ({
    stage,
    errorType,
    message,
    executionTimeMs,
}: {
    stage: RuleExecutionStage;
    errorType: SandboxErrorType;
    message: string;
    executionTimeMs?: number;
}) => {
    const cost = typeof executionTimeMs === 'number' ? ` costMs=${executionTimeMs}` : '';
    return `[UGC_RULE_EXEC] stage=${stage} type=${errorType} message=${message}${cost}`;
};

const buildErrorResult = <T>({
    stage,
    errorType,
    message,
    startTime = Date.now(),
}: {
    stage: RuleExecutionStage;
    errorType: SandboxErrorType;
    message: string;
    startTime?: number;
}): SandboxResult<T> => {
    const executionTimeMs = Date.now() - startTime;
    const safeMessage = stripErrorPrefix(message);
    return {
        success: false,
        error: safeMessage,
        errorType,
        errorStage: stage,
        errorLog: buildErrorLog({ stage, errorType, message: safeMessage, executionTimeMs }),
        executionTimeMs,
    };
};

function createSafeMath(): Record<string, unknown> {
    const safeMath: Record<string, unknown> = {};
    const mathRef = Math as unknown as Record<string, unknown>;
    for (const key of Object.getOwnPropertyNames(Math)) {
        safeMath[key] = mathRef[key];
    }
    safeMath.random = () => {
        throw new Error(`${PERMISSION_PREFIX}禁止使用 Math.random，请使用 random 参数`);
    };
    return safeMath;
}

// ============================================================================
// 沙箱执行器
// ============================================================================

export class SandboxExecutor {
    private config: SandboxConfig;
    private domainCore: UGCDomainCore | null = null;
    private isLoaded: boolean = false;

    constructor(config: Partial<SandboxConfig> = {}) {
        this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    }

    /** 加载 UGC 规则代码 */
    async loadCode(code: string): Promise<SandboxResult<void>> {
        const startTime = Date.now();
        
        try {
            // 创建沙箱环境
            const sandbox = this.createSandbox();
            
            // 包装代码以导出 DomainCore
            const wrappedCode = `
                return (function() {
                    'use strict';
                    ${code}
                    return typeof domain !== 'undefined' ? domain : null;
                })();
            `;

            // 使用 Function 构造函数在受限环境中执行
            // 注：生产环境应使用 isolated-vm
            const sandboxEntries = Object.entries(sandbox).filter(([key]) => key !== 'import');
            const executor = new Function(...sandboxEntries.map(([key]) => key), wrappedCode);
            const result = executor(...sandboxEntries.map(([, value]) => value));

            if (!result || typeof result !== 'object') {
                return buildErrorResult({
                    stage: 'load',
                    errorType: 'contract',
                    message: 'UGC 代码必须导出 domain 对象',
                    startTime,
                });
            }

            // 验证 DomainCore 契约
            const validation = this.validateDomainCore(result);
            if (!validation.valid) {
                return buildErrorResult({
                    stage: 'load',
                    errorType: 'contract',
                    message: validation.error || 'DomainCore 契约校验失败',
                    startTime,
                });
            }

            this.domainCore = result as UGCDomainCore;
            this.isLoaded = true;

            return {
                success: true,
                executionTimeMs: Date.now() - startTime,
            };
        } catch (error) {
            return buildErrorResult({
                stage: 'load',
                errorType: resolveErrorType(error, 'syntax'),
                message: normalizeErrorMessage(error, '加载代码失败'),
                startTime,
            });
        }
    }

    /** 执行 setup */
    async setup(playerIds: string[], randomSeed: number): Promise<SandboxResult<unknown>> {
        if (!this.isLoaded || !this.domainCore) {
            return buildErrorResult({ stage: 'setup', errorType: 'runtime', message: '代码未加载' });
        }

        const result = await this.executeWithTimeout('setup', () => {
            const random = createSeededRandom(randomSeed);
            return this.domainCore!.setup(playerIds, random);
        });
        if (!result.success || result.result === undefined) return result;
        const serializable = this.ensureSerializable('setup', result.result);
        if (serializable) return serializable;
        return result;
    }

    /** 执行 validate */
    async validate(state: unknown, command: unknown): Promise<SandboxResult<ValidationResult>> {
        if (!this.isLoaded || !this.domainCore) {
            return buildErrorResult({ stage: 'validate', errorType: 'runtime', message: '代码未加载' });
        }

        return this.executeWithTimeout('validate', () => {
            return this.domainCore!.validate(state, command);
        });
    }

    /** 执行 execute */
    async execute(state: unknown, command: unknown, randomSeed: number): Promise<SandboxResult<unknown[]>> {
        if (!this.isLoaded || !this.domainCore) {
            return buildErrorResult({ stage: 'execute', errorType: 'runtime', message: '代码未加载' });
        }

        const result = await this.executeWithTimeout('execute', () => {
            const random = createSeededRandom(randomSeed);
            return this.domainCore!.execute(state, command, random);
        });
        if (!result.success || result.result === undefined) return result;
        const serializable = this.ensureSerializable('execute', result.result);
        if (serializable) return serializable;
        return result;
    }

    /** 执行 reduce */
    async reduce(state: unknown, event: unknown): Promise<SandboxResult<unknown>> {
        if (!this.isLoaded || !this.domainCore) {
            return buildErrorResult({ stage: 'reduce', errorType: 'runtime', message: '代码未加载' });
        }

        const result = await this.executeWithTimeout('reduce', () => {
            return this.domainCore!.reduce(state, event);
        });
        if (!result.success || result.result === undefined) return result;
        const serializable = this.ensureSerializable('reduce', result.result);
        if (serializable) return serializable;
        return result;
    }

    /** 执行 playerView */
    async playerView(state: unknown, playerId: string): Promise<SandboxResult<unknown>> {
        if (!this.isLoaded || !this.domainCore) {
            return buildErrorResult({ stage: 'playerView', errorType: 'runtime', message: '代码未加载' });
        }

        if (!this.domainCore.playerView) {
            return { success: true, result: state };
        }

        const result = await this.executeWithTimeout('playerView', () => {
            return this.domainCore!.playerView!(state, playerId);
        });
        if (!result.success || result.result === undefined) return result;
        const serializable = this.ensureSerializable('playerView', result.result);
        if (serializable) return serializable;
        return result;
    }

    /** 执行 isGameOver */
    async isGameOver(state: unknown): Promise<SandboxResult<GameOverResult | undefined>> {
        if (!this.isLoaded || !this.domainCore) {
            return buildErrorResult({ stage: 'isGameOver', errorType: 'runtime', message: '代码未加载' });
        }

        if (!this.domainCore.isGameOver) {
            return { success: true, result: undefined };
        }

        return this.executeWithTimeout('isGameOver', () => {
            return this.domainCore!.isGameOver!(state);
        });
    }

    /** 获取游戏 ID */
    getGameId(): string | null {
        return this.domainCore?.gameId ?? null;
    }

    /** 获取已加载的 DomainCore（只读） */
    getDomainCore(): UGCDomainCore | null {
        return this.domainCore;
    }

    /** 是否已加载 */
    isCodeLoaded(): boolean {
        return this.isLoaded;
    }

    /** 卸载代码 */
    unload(): void {
        this.domainCore = null;
        this.isLoaded = false;
    }

    // ========== 私有方法 ==========

    /** 创建沙箱环境 */
    private createSandbox(): Record<string, unknown> {
        const sandbox: Record<string, unknown> = {
            // 安全的内置对象
            Math: createSafeMath(),
            JSON,
            Array,
            Object,
            String,
            Number,
            Boolean,
            Date,
            Map,
            Set,
            WeakMap,
            WeakSet,
            Promise,
            Symbol,
            BigInt,
            Reflect,
            Proxy,
            Error,
            TypeError,
            RangeError,
            SyntaxError,
            ReferenceError,
            // 控制台（可选）
            console: this.config.allowConsole ? console : {
                log: () => {},
                warn: () => {},
                error: () => {},
                info: () => {},
                debug: () => {},
            },
            // 自定义全局变量
            ...this.config.globals,
        };

        // 禁用危险 API
        for (const api of DISABLED_GLOBALS) {
            sandbox[api] = undefined;
        }

        return sandbox;
    }

    private ensureSerializable(stage: RuleExecutionStage, value: unknown): SandboxResult<never> | null {
        try {
            JSON.stringify(value);
            return null;
        } catch (error) {
            return buildErrorResult({
                stage,
                errorType: 'contract',
                message: `状态不可序列化: ${normalizeErrorMessage(error, '未知错误')}`,
            });
        }
    }

    /** 验证 DomainCore 契约 */
    private validateDomainCore(obj: unknown): ValidationResult {
        if (!obj || typeof obj !== 'object') {
            return { valid: false, error: 'domain 必须是对象' };
        }

        const domain = obj as Record<string, unknown>;

        if (typeof domain.gameId !== 'string') {
            return { valid: false, error: 'domain.gameId 必须是字符串' };
        }
        if (typeof domain.setup !== 'function') {
            return { valid: false, error: 'domain.setup 必须是函数' };
        }
        if (typeof domain.validate !== 'function') {
            return { valid: false, error: 'domain.validate 必须是函数' };
        }
        if (typeof domain.execute !== 'function') {
            return { valid: false, error: 'domain.execute 必须是函数' };
        }
        if (typeof domain.reduce !== 'function') {
            return { valid: false, error: 'domain.reduce 必须是函数' };
        }

        return { valid: true };
    }

    /** 带超时的执行 */
    private async executeWithTimeout<T>(stage: RuleExecutionStage, fn: () => T): Promise<SandboxResult<T>> {
        const startTime = Date.now();

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                resolve(buildErrorResult({
                    stage,
                    errorType: 'timeout',
                    message: `执行超时（${this.config.timeoutMs}ms）`,
                    startTime,
                }));
            }, this.config.timeoutMs);

            try {
                const result = fn();
                clearTimeout(timeoutId);
                resolve({
                    success: true,
                    result,
                    executionTimeMs: Date.now() - startTime,
                });
            } catch (error) {
                clearTimeout(timeoutId);
                resolve(buildErrorResult({
                    stage,
                    errorType: resolveErrorType(error, 'runtime'),
                    message: normalizeErrorMessage(error, '执行失败'),
                    startTime,
                }));
            }
        });
    }
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 创建沙箱执行器 */
export function createSandboxExecutor(config?: Partial<SandboxConfig>): SandboxExecutor {
    return new SandboxExecutor(config);
}
