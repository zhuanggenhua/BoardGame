/**
 * useSpectatorMoves Hook
 * 
 * 引擎层通用 Hook，统一包装 moves，自动拦截观察者操作。
 * 任何使用 boardgame.io 的游戏都可以使用此 Hook 来处理观察者模式。
 * 
 * @example
 * ```typescript
 * const engineMoves = useSpectatorMoves(rawMoves, isSpectator, playerID);
 * // 所有 move 调用会自动被拦截，观察者调用会被阻止并记录日志
 * engineMoves.rollDice();
 * ```
 */

import { useMemo, useRef } from 'react';

const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

/**
 * 观察者 moves 包装配置
 */
export interface SpectatorMovesOptions {
    /** 是否启用开发模式日志（默认 true） */
    enableDevLog?: boolean;
    /** 自定义日志函数 */
    logFn?: (action: string, playerID?: string) => void;
    /** 日志前缀（用于区分不同游戏） */
    logPrefix?: string;
}

/**
 * 包装 moves 对象，为观察者自动拦截所有操作
 * 
 * @param rawMoves - 原始 moves 对象
 * @param isSpectator - 是否为观察者
 * @param playerID - 当前玩家 ID（用于日志）
 * @param options - 配置选项
 * @returns 包装后的 moves 对象，观察者调用会被自动拦截
 */
export function useSpectatorMoves<T extends Record<string, unknown>>(
    rawMoves: T,
    isSpectator: boolean,
    playerID?: string,
    options: SpectatorMovesOptions = {}
): T {
    const { enableDevLog = true, logFn, logPrefix = 'Spectate' } = options;
    
    // 使用 ref 记录已阻止的操作，避免重复日志
    const blockedLogRef = useRef<Set<string>>(new Set());
    
    const logBlocked = (action: string) => {
        if (!enableDevLog || !isDev) return;
        if (blockedLogRef.current.has(action)) return;
        
        blockedLogRef.current.add(action);
        
        if (logFn) {
            logFn(action, playerID);
        } else {
            console.warn(`[${logPrefix}] blocked`, { action, playerID, isSpectator });
        }
    };
    
    // 使用 useMemo 避免每次渲染都创建新的 Proxy 对象
    return useMemo(() => {
        // 非观察者直接返回原始 moves
        if (!isSpectator) {
            return rawMoves;
        }
        
        // 为观察者创建拦截代理
        return new Proxy(rawMoves, {
            get(target, prop: string) {
                const original = target[prop];
                
                // 非函数属性直接返回
                if (typeof original !== 'function') {
                    return original;
                }
                
                // 包装函数，添加观察者检查
                return (..._args: unknown[]) => {
                    logBlocked(prop);
                    // 观察者调用被阻止，不执行原始函数
                    return undefined;
                };
            }
        }) as T;
    }, [rawMoves, isSpectator, playerID, logFn, enableDevLog, logPrefix]);
}
