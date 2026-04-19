/**
 * 随机数注入器
 * 
 * 用于在测试环境中控制随机数生成，确保测试结果可预测。
 * 
 * @example
 * ```typescript
 * // E2E 测试中
 * window.__BG_TEST_HARNESS__.random.setQueue([0.1, 0.5, 0.9]);
 * // 接下来的 3 次 random() 调用将返回 0.1, 0.5, 0.9
 * ```
 */

export type RandomFn = () => number;

export class RandomInjector {
    private queue: number[] = [];
    private enabled = false;
    private consumedCount = 0;

    /**
     * 设置随机数队列（替换现有队列）
     */
    setQueue(values: number[]) {
        this.queue = [...values];
        this.enabled = true;
        this.consumedCount = 0;
    }

    /**
     * 添加随机数到队列末尾
     */
    enqueue(...values: number[]) {
        this.queue.push(...values);
        this.enabled = true;
    }

    /**
     * 清空队列并禁用注入
     */
    clear() {
        this.queue = [];
        this.enabled = false;
        this.consumedCount = 0;
    }

    /**
     * 创建包装后的 random 函数
     */
    wrap(originalRandom: RandomFn): RandomFn {
        return () => {
            if (this.enabled && this.queue.length > 0) {
                const value = this.queue.shift()!;
                this.consumedCount++;
                return value;
            }
            return originalRandom();
        };
    }

    /**
     * 检查是否有待消费的随机数
     */
    hasQueue(): boolean {
        return this.queue.length > 0;
    }

    /**
     * 获取剩余队列长度
     */
    queueLength(): number {
        return this.queue.length;
    }

    /**
     * 获取已消费的随机数数量
     */
    consumedLength(): number {
        return this.consumedCount;
    }

    /**
     * 是否启用注入
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}
