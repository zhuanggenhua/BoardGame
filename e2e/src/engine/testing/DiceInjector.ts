/**
 * 骰子注入器
 * 
 * 基于 RandomInjector 实现，将骰子值（1-6）转换为随机数（0-1）。
 * 
 * @example
 * ```typescript
 * // E2E 测试中
 * window.__BG_TEST_HARNESS__.dice.setValues([3, 3, 3, 1, 1]);
 * // 接下来的骰子投掷将返回这些值
 * ```
 */

import type { RandomInjector } from './RandomInjector';

export class DiceInjector {
    private values: number[] = [];
    private randomInjector: RandomInjector;

    constructor(randomInjector: RandomInjector) {
        this.randomInjector = randomInjector;
    }

    /**
     * 设置骰子值（1-6）
     * 自动转换为 random() 需要的 0-1 范围
     * 
     * 假设骰子投掷使用: Math.floor(random() * 6) + 1
     * 因此: v=1 → [0, 1/6), v=2 → [1/6, 2/6), ..., v=6 → [5/6, 1)
     */
    setValues(values: number[]) {
        // 验证骰子值范围
        for (const v of values) {
            if (v < 1 || v > 6 || !Number.isInteger(v)) {
                console.warn('[DiceInjector] 骰子值必须是 1-6 的整数:', v);
            }
        }

        // 将骰子值（1-6）转换为随机数（0-1）
        // v=1 → 0.001, v=2 → 0.167, v=3 → 0.334, v=4 → 0.501, v=5 → 0.668, v=6 → 0.835
        const randomValues = values.map(v => {
            const normalized = Math.max(1, Math.min(6, Math.floor(v)));
            return (normalized - 1) / 6 + 0.001; // 加小偏移确保落在正确区间
        });

        this.randomInjector.setQueue(randomValues);
        this.values = [...values];
    }

    /**
     * 添加骰子值到队列末尾
     */
    enqueue(...values: number[]) {
        const randomValues = values.map(v => {
            const normalized = Math.max(1, Math.min(6, Math.floor(v)));
            return (normalized - 1) / 6 + 0.001;
        });
        this.randomInjector.enqueue(...randomValues);
        this.values.push(...values);
    }

    /**
     * 清空骰子队列
     */
    clear() {
        this.values = [];
        this.randomInjector.clear();
    }

    /**
     * 获取剩余骰子数量
     */
    remaining(): number {
        return this.randomInjector.queueLength();
    }

    /**
     * 获取已设置的骰子值（用于调试）
     */
    getValues(): number[] {
        return [...this.values];
    }
}
