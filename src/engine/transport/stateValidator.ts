/**
 * 状态验证器
 * 
 * 用于验证注入的对局状态是否合法（必需字段、类型正确、游戏特定规则）
 */

import type { MatchState } from '../types';
import type { MatchStorage } from './storage';

/**
 * 验证错误
 */
export interface ValidationError {
    /** 错误字段路径（如 'sys.matchId'） */
    field: string;
    /** 错误描述 */
    message: string;
    /** 期望值 */
    expected?: unknown;
    /** 实际值 */
    actual?: unknown;
}

/**
 * 验证结果
 */
export interface ValidationResult {
    /** 是否验证通过 */
    valid: boolean;
    /** 验证错误列表 */
    errors: ValidationError[];
}

export type StateCoreValidator = (core: unknown, errors: ValidationError[]) => void;
export type StateValidatorRegistry = Record<string, StateCoreValidator | undefined>;

/**
 * 验证对局状态的完整性和正确性
 * 
 * @param matchId 对局 ID
 * @param state 待验证的状态
 * @param storage 存储层（用于获取游戏元数据）
 * @param validators 游戏状态校验器注册表
 * @returns 验证结果
 */
export async function validateMatchState(
    matchId: string,
    state: MatchState<unknown>,
    storage: MatchStorage,
    validators: StateValidatorRegistry = {},
): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // 1. 检查必需字段
    if (!state.sys) {
        errors.push({ field: 'sys', message: 'Missing sys field' });
    }
    if (!state.core) {
        errors.push({ field: 'core', message: 'Missing core field' });
    }

    // 2. 检查 sys 必需字段
    if (state.sys) {
        const sys = state.sys as unknown as Record<string, unknown>;
        
        if (!sys.matchId) {
            errors.push({ field: 'sys.matchId', message: 'Missing matchId' });
        } else if (sys.matchId !== matchId) {
            errors.push({
                field: 'sys.matchId',
                message: 'matchId mismatch',
                expected: matchId,
                actual: sys.matchId,
            });
        }

        if (!sys.turnOrder || !Array.isArray(sys.turnOrder)) {
            errors.push({ field: 'sys.turnOrder', message: 'Missing or invalid turnOrder' });
        }

        if (sys.currentPlayerIndex === undefined || typeof sys.currentPlayerIndex !== 'number') {
            errors.push({ field: 'sys.currentPlayerIndex', message: 'Missing or invalid currentPlayerIndex' });
        }
    }

    // 3. 获取游戏配置并验证游戏特定字段（只有当 core 存在时才验证）
    if (state.core) {
        const metadata = await storage.fetch(matchId, { metadata: true });
        if (metadata.metadata) {
            const gameId = metadata.metadata.gameName;
            
            validators[gameId]?.(state.core, errors);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * 深度合并对象（用于部分状态注入）
 * 
 * @param target 目标对象
 * @param source 源对象（部分字段）
 * @returns 合并后的对象
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceValue = source[key];
            const targetValue = result[key];

            if (
                sourceValue &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue) &&
                targetValue &&
                typeof targetValue === 'object' &&
                !Array.isArray(targetValue)
            ) {
                result[key] = deepMerge(targetValue, sourceValue as any);
            } else {
                result[key] = sourceValue as any;
            }
        }
    }

    return result;
}
