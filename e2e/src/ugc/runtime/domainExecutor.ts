/**
 * UGC 运行时规则执行器（浏览器版）
 *
 * 在浏览器中加载并执行 UGC domain 规则代码，保持与服务端沙箱一致的契约。
 */

import type { UGCGameState, PlayerId } from '../sdk/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface RuntimeCommand {
  type: string;
  playerId: PlayerId;
  payload: Record<string, unknown>;
  timestamp?: number;
}

export interface RuntimeGameEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp?: number;
  sourceCommandType?: string;
  sfxKey?: string;
}

export interface RandomFn {
  random(): number;
  d(max: number): number;
  range(min: number, max: number): number;
  shuffle<T>(array: T[]): T[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface RuntimeGameOverResult {
  winner?: string;
  winners?: string[];
  draw?: boolean;
  scores?: Record<string, number>;
}

export interface RuntimeDomainCore {
  gameId: string;
  setup(playerIds: PlayerId[], random: RandomFn): UGCGameState;
  validate(state: UGCGameState, command: RuntimeCommand): ValidationResult;
  execute(state: UGCGameState, command: RuntimeCommand, random: RandomFn): RuntimeGameEvent[];
  reduce(state: UGCGameState, event: RuntimeGameEvent): UGCGameState;
  playerView?(state: UGCGameState, playerId: PlayerId): Partial<UGCGameState>;
  isGameOver?(state: UGCGameState): RuntimeGameOverResult | undefined;
}

export type RuleExecutionStage = 'load' | 'setup' | 'validate' | 'execute' | 'reduce' | 'isGameOver';

export type SandboxErrorType = 'timeout' | 'runtime' | 'syntax' | 'contract' | 'permission';

export interface SandboxResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  errorType?: SandboxErrorType;
  errorStage?: RuleExecutionStage;
  errorLog?: string;
  executionTimeMs?: number;
}

export interface RuntimeSandboxConfig {
  timeoutMs: number;
  allowConsole: boolean;
}

const DEFAULT_SANDBOX_CONFIG: RuntimeSandboxConfig = {
  timeoutMs: 100,
  allowConsole: false,
};

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

const DISABLED_GLOBALS = [
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

// ============================================================================
// 随机数生成器（确定性）
// ============================================================================

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

export class RuntimeDomainExecutor {
  private config: RuntimeSandboxConfig;
  private domainCore: RuntimeDomainCore | null = null;
  private isLoaded = false;

  constructor(config: Partial<RuntimeSandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  }

  async loadCode(code: string): Promise<SandboxResult<void>> {
    const startTime = Date.now();
    try {
      const sandbox = this.createSandbox();
      const wrappedCode = `
        return (function() {
          'use strict';
          ${code}
          return typeof domain !== 'undefined' ? domain : null;
        })();
      `;
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
      const validation = this.validateDomainCore(result);
      if (!validation.valid) {
        return buildErrorResult({
          stage: 'load',
          errorType: 'contract',
          message: validation.error || 'DomainCore 契约校验失败',
          startTime,
        });
      }
      this.domainCore = result as RuntimeDomainCore;
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

  async setup(playerIds: PlayerId[], randomSeed: number): Promise<SandboxResult<UGCGameState>> {
    if (!this.isLoaded || !this.domainCore) {
      return buildErrorResult({ stage: 'setup', errorType: 'runtime', message: '代码未加载' });
    }
    const result = await this.executeWithTimeout('setup', () => {
      const random = createSeededRandom(randomSeed);
      return this.domainCore!.setup(playerIds, random);
    });
    if (!result.success || !result.result) return result;
    const serializable = this.ensureSerializable('setup', result.result);
    if (serializable) return serializable;
    return result;
  }

  async validate(state: UGCGameState, command: RuntimeCommand): Promise<SandboxResult<ValidationResult>> {
    if (!this.isLoaded || !this.domainCore) {
      return buildErrorResult({ stage: 'validate', errorType: 'runtime', message: '代码未加载' });
    }
    return this.executeWithTimeout('validate', () => this.domainCore!.validate(state, command));
  }

  async execute(state: UGCGameState, command: RuntimeCommand, randomSeed: number): Promise<SandboxResult<RuntimeGameEvent[]>> {
    if (!this.isLoaded || !this.domainCore) {
      return buildErrorResult({ stage: 'execute', errorType: 'runtime', message: '代码未加载' });
    }
    const result = await this.executeWithTimeout('execute', () => {
      const random = createSeededRandom(randomSeed);
      return this.domainCore!.execute(state, command, random);
    });
    if (!result.success || !result.result) return result;
    const serializable = this.ensureSerializable('execute', result.result);
    if (serializable) return serializable;
    return result;
  }

  async reduce(state: UGCGameState, event: RuntimeGameEvent): Promise<SandboxResult<UGCGameState>> {
    if (!this.isLoaded || !this.domainCore) {
      return buildErrorResult({ stage: 'reduce', errorType: 'runtime', message: '代码未加载' });
    }
    const result = await this.executeWithTimeout('reduce', () => this.domainCore!.reduce(state, event));
    if (!result.success || !result.result) return result;
    const serializable = this.ensureSerializable('reduce', result.result);
    if (serializable) return serializable;
    return result;
  }

  async isGameOver(state: UGCGameState): Promise<SandboxResult<RuntimeGameOverResult | undefined>> {
    if (!this.isLoaded || !this.domainCore) {
      return buildErrorResult({ stage: 'isGameOver', errorType: 'runtime', message: '代码未加载' });
    }
    if (!this.domainCore.isGameOver) {
      return { success: true, result: undefined };
    }
    return this.executeWithTimeout('isGameOver', () => this.domainCore!.isGameOver!(state));
  }

  getDomainCore(): RuntimeDomainCore | null {
    return this.domainCore;
  }

  unload(): void {
    this.domainCore = null;
    this.isLoaded = false;
  }

  private createSandbox(): Record<string, unknown> {
    const sandbox: Record<string, unknown> = {
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
      console: this.config.allowConsole
        ? console
        : {
            log: () => {},
            warn: () => {},
            error: () => {},
            info: () => {},
            debug: () => {},
          },
    };
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

  private async executeWithTimeout<T>(stage: RuleExecutionStage, fn: () => T): Promise<SandboxResult<T>> {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const timeoutId = globalThis.setTimeout(() => {
        resolve(buildErrorResult({
          stage,
          errorType: 'timeout',
          message: `执行超时（${this.config.timeoutMs}ms）`,
          startTime,
        }));
      }, this.config.timeoutMs);

      try {
        const result = fn();
        globalThis.clearTimeout(timeoutId);
        resolve({
          success: true,
          result,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        globalThis.clearTimeout(timeoutId);
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
