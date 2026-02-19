/**
 * 关键图片解析器注册表
 *
 * 各游戏可注册动态解析器，根据对局状态生成需要预加载的关键/暖图片路径列表。
 * 解析器输出会与 GameAssets 中的静态 criticalImages / warmImages 合并。
 */

import type { CriticalImageResolver, CriticalImageResolverResult } from './types';

const resolverRegistry = new Map<string, CriticalImageResolver>();

/**
 * 注册关键图片解析器
 * 应在游戏模块初始化时调用
 */
export function registerCriticalImageResolver(
    gameId: string,
    resolver: CriticalImageResolver,
): void {
    resolverRegistry.set(gameId, resolver);
}

/**
 * 获取已注册的解析器
 */
export function getCriticalImageResolver(
    gameId: string,
): CriticalImageResolver | undefined {
    return resolverRegistry.get(gameId);
}

/**
 * 执行解析器并返回结果，解析失败时返回空列表
 */
export function resolveCriticalImages(
    gameId: string,
    gameState: unknown,
    locale?: string,
    playerID?: string | null,
): CriticalImageResolverResult {
    const resolver = resolverRegistry.get(gameId);
    if (!resolver) {
        return { critical: [], warm: [] };
    }
    try {
        return resolver(gameState, locale, playerID);
    } catch (e) {
        console.warn(`[CriticalImageResolver] 游戏 ${gameId} 解析器执行失败，回退到静态清单`, e);
        return { critical: [], warm: [] };
    }
}
