/**
 * 测试工具类型定义
 * 
 * 扩展 Window 接口，添加测试工具相关的全局变量。
 */

declare global {
    interface Window {
        /**
         * 测试模式标志（由 E2E 测试框架注入）
         */
        __E2E_TEST_MODE__?: boolean;

        /**
         * 测试工具集
         */
        __BG_TEST_HARNESS__?: {
            /**
             * 随机数控制
             */
            random: {
                /** 设置随机数队列 */
                setQueue(values: number[]): void;
                /** 添加随机数到队列末尾 */
                enqueue(...values: number[]): void;
                /** 清空队列 */
                clear(): void;
                /** 检查是否有待消费的随机数 */
                hasQueue(): boolean;
                /** 获取剩余队列长度 */
                queueLength(): number;
                /** 获取已消费的随机数数量 */
                consumedLength(): number;
                /** 是否启用注入 */
                isEnabled(): boolean;
            };

            /**
             * 骰子注入
             */
            dice: {
                /** 设置骰子值（1-6） */
                setValues(values: number[]): void;
                /** 添加骰子值到队列末尾 */
                enqueue(...values: number[]): void;
                /** 清空骰子队列 */
                clear(): void;
                /** 获取剩余骰子数量 */
                remaining(): number;
                /** 获取已设置的骰子值 */
                getValues(): number[];
            };

            /**
             * 状态注入
             */
            state: {
                /** 获取当前状态 */
                get(): any;
                /** 设置状态（完全替换） */
                set(state: any): void;
                /** 修改状态（部分更新） */
                patch(patch: any): void;
                /** 检查状态访问器是否已注册 */
                isRegistered(): boolean;
            };

            /**
             * 命令代理
             */
            command: {
                /** 分发命令 */
                dispatch(command: any): Promise<void>;
                /** 检查命令分发器是否已注册 */
                isRegistered(): boolean;
            };

            /**
             * 重置所有测试工具
             */
            reset(): void;

            /**
             * 获取测试工具状态
             */
            getStatus(): {
                random: {
                    enabled: boolean;
                    queueLength: number;
                    consumed: number;
                };
                dice: {
                    remaining: number;
                    values: number[];
                };
                state: {
                    registered: boolean;
                };
                command: {
                    registered: boolean;
                };
            };
        };
    }
}

export {};
