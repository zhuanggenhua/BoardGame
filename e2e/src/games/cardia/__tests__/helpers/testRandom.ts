/**
 * 测试辅助函数 - 创建固定的随机数生成器
 * 
 * 用于测试中需要可预测的随机行为
 */

import type { RandomFn } from '../../../../engine/types';

/**
 * 创建一个固定值的随机数生成器
 * 
 * @param value - 固定返回的随机值 (0-1 之间)
 * @returns 完整的 RandomFn 对象
 * 
 * @example
 * ```typescript
 * const runner = new GameTestRunner({
 *     domain: CardiaDomain,
 *     playerIds: ['0', '1'],
 *     systems: Cardia.systems,
 *     random: createFixedRandom(0), // 总是返回 0
 * });
 * ```
 */
export function createFixedRandom(value: number = 0): RandomFn {
    return {
        random: () => value,
        d: (max) => Math.max(1, Math.floor(value * max) + 1),
        range: (min, max) => Math.floor(min + value * (max - min + 1)),
        shuffle: (arr) => [...arr], // 不打乱顺序
    };
}

/**
 * 创建一个可追踪调用次数的随机数生成器
 * 
 * @param value - 固定返回的随机值 (0-1 之间)
 * @returns { random: RandomFn, callCount: { value: number } }
 * 
 * @example
 * ```typescript
 * const { random, callCount } = createTrackableRandom(0);
 * const runner = new GameTestRunner({
 *     domain: CardiaDomain,
 *     playerIds: ['0', '1'],
 *     systems: Cardia.systems,
 *     random,
 * });
 * // ... 执行测试
 * expect(callCount.value).toBe(2); // 验证随机数被调用了2次
 * ```
 */
export function createTrackableRandom(value: number = 0): {
    random: RandomFn;
    callCount: { value: number };
} {
    const callCount = { value: 0 };
    
    return {
        random: {
            random: () => {
                callCount.value++;
                return value;
            },
            d: (max) => {
                callCount.value++;
                return Math.max(1, Math.floor(value * max) + 1);
            },
            range: (min, max) => {
                callCount.value++;
                return Math.floor(min + value * (max - min + 1));
            },
            shuffle: (arr) => {
                callCount.value++;
                return [...arr];
            },
        },
        callCount,
    };
}
