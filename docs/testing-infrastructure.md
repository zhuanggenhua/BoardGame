# 测试基础设施设计文档

> **目标**：为所有游戏提供统一的测试工具支持，包括骰子注入、状态注入、事件模拟等，确保 E2E 测试稳定可靠。

## 1. 问题分析

### 1.1 当前问题
- **骰子注入缺失**：无法在 E2E 测试中控制随机骰子结果
- **状态注入不稳定**：通过调试面板修改状态后，UI 可能不同步（依赖 WebSocket）
- **测试不可靠**：依赖随机性导致测试不稳定
- **缺乏统一标准**：每个游戏需要单独实现测试工具

### 1.2 需求
1. **骰子注入**：控制骰子投掷结果
2. **状态注入**：直接设置游戏状态（绕过 WebSocket）
3. **事件模拟**：触发特定游戏事件
4. **命令注入**：直接执行游戏命令
5. **时间控制**：控制游戏时间流逝
6. **随机数控制**：控制所有随机数生成

## 2. 架构设计

### 2.1 核心原则
- **框架层实现**：测试工具在引擎/框架层实现，所有游戏自动继承
- **显式启用**：只在测试环境启用，生产环境完全禁用
- **类型安全**：提供完整的 TypeScript 类型定义
- **最小侵入**：不影响正常游戏逻辑

### 2.2 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      测试环境检测                             │
│  window.__E2E_TEST_MODE__ = true                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   测试工具注入层                              │
│  - TestHarness (全局单例)                                    │
│  - 挂载到 window.__BG_TEST_HARNESS__                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   功能模块                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 随机数控制    │  │ 状态注入      │  │ 命令注入      │      │
│  │ RandomInjector│  │ StateInjector │  │ CommandProxy │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 事件模拟      │  │ 时间控制      │  │ 调试工具      │      │
│  │ EventEmitter  │  │ TimeControl   │  │ DebugUtils    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   游戏引擎集成                                │
│  - executePipeline 集成                                      │
│  - random 函数拦截                                           │
│  - dispatch 拦截                                             │
└─────────────────────────────────────────────────────────────┘
```

## 3. 实现方案

### 3.1 测试环境检测

```typescript
// src/engine/testing/environment.ts

/**
 * 检测是否在测试环境
 */
export function isTestEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).__E2E_TEST_MODE__;
}

/**
 * 启用测试模式（由 E2E 测试框架注入）
 */
export function enableTestMode() {
    if (typeof window !== 'undefined') {
        (window as any).__E2E_TEST_MODE__ = true;
    }
}
```

### 3.2 随机数控制

```typescript
// src/engine/testing/RandomInjector.ts

export type RandomFn = () => number;

/**
 * 随机数注入器
 * 
 * 用法：
 * ```typescript
 * // E2E 测试中
 * window.__BG_TEST_HARNESS__.random.setQueue([0.1, 0.5, 0.9]);
 * // 接下来的 3 次 random() 调用将返回 0.1, 0.5, 0.9
 * ```
 */
export class RandomInjector {
    private queue: number[] = [];
    private enabled = false;

    /**
     * 设置随机数队列
     */
    setQueue(values: number[]) {
        this.queue = [...values];
        this.enabled = true;
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
    }

    /**
     * 创建包装后的 random 函数
     */
    wrap(originalRandom: RandomFn): RandomFn {
        return () => {
            if (this.enabled && this.queue.length > 0) {
                const value = this.queue.shift()!;
                console.log('[TestHarness] 注入随机数:', value);
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
}
```

### 3.3 骰子注入（基于随机数控制）

```typescript
// src/engine/testing/DiceInjector.ts

/**
 * 骰子注入器
 * 
 * 用法：
 * ```typescript
 * // E2E 测试中
 * window.__BG_TEST_HARNESS__.dice.setValues([3, 3, 3, 1, 1]);
 * // 接下来的骰子投掷将返回这些值
 * ```
 */
export class DiceInjector {
    private values: number[] = [];
    private randomInjector: RandomInjector;

    constructor(randomInjector: RandomInjector) {
        this.randomInjector = randomInjector;
    }

    /**
     * 设置骰子值（1-6）
     * 自动转换为 random() 需要的 0-1 范围
     */
    setValues(values: number[]) {
        // 将骰子值（1-6）转换为随机数（0-1）
        // 假设骰子投掷使用 Math.floor(random() * 6) + 1
        const randomValues = values.map(v => {
            if (v < 1 || v > 6) {
                console.warn('[DiceInjector] 骰子值超出范围 [1,6]:', v);
            }
            // 将 1-6 映射到 0-1 范围
            // v=1 → 0.0-0.166, v=2 → 0.166-0.333, ..., v=6 → 0.833-1.0
            return (v - 1) / 6 + 0.001; // 加小偏移确保落在正确区间
        });
        this.randomInjector.setQueue(randomValues);
        this.values = [...values];
        console.log('[DiceInjector] 设置骰子值:', values, '→ 随机数:', randomValues);
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
}
```

### 3.4 状态注入

```typescript
// src/engine/testing/StateInjector.ts

/**
 * 状态注入器
 * 
 * 用法：
 * ```typescript
 * // E2E 测试中
 * const state = await window.__BG_TEST_HARNESS__.state.get();
 * state.players['0'].resources.hp = 10;
 * await window.__BG_TEST_HARNESS__.state.set(state);
 * ```
 */
export class StateInjector {
    private getStateFn?: () => any;
    private setStateFn?: (state: any) => void;

    /**
     * 注册状态访问器（由游戏引擎调用）
     */
    register(getState: () => any, setState: (state: any) => void) {
        this.getStateFn = getState;
        this.setStateFn = setState;
    }

    /**
     * 获取当前状态
     */
    get(): any {
        if (!this.getStateFn) {
            throw new Error('[StateInjector] 状态访问器未注册');
        }
        return this.getStateFn();
    }

    /**
     * 设置状态
     */
    set(state: any) {
        if (!this.setStateFn) {
            throw new Error('[StateInjector] 状态访问器未注册');
        }
        console.log('[StateInjector] 注入状态:', state);
        this.setStateFn(state);
    }

    /**
     * 修改状态（部分更新）
     */
    patch(patch: any) {
        const current = this.get();
        const updated = { ...current, ...patch };
        this.set(updated);
    }
}
```

### 3.5 命令注入

```typescript
// src/engine/testing/CommandProxy.ts

/**
 * 命令代理
 * 
 * 用法：
 * ```typescript
 * // E2E 测试中
 * await window.__BG_TEST_HARNESS__.command.dispatch({
 *     type: 'ROLL_DICE',
 *     playerId: '0',
 *     payload: {}
 * });
 * ```
 */
export class CommandProxy {
    private dispatchFn?: (command: any) => Promise<void>;

    /**
     * 注册命令分发器（由游戏引擎调用）
     */
    register(dispatch: (command: any) => Promise<void>) {
        this.dispatchFn = dispatch;
    }

    /**
     * 分发命令
     */
    async dispatch(command: any): Promise<void> {
        if (!this.dispatchFn) {
            throw new Error('[CommandProxy] 命令分发器未注册');
        }
        console.log('[CommandProxy] 分发命令:', command);
        await this.dispatchFn(command);
    }
}
```

### 3.6 测试工具集成

```typescript
// src/engine/testing/TestHarness.ts

import { RandomInjector } from './RandomInjector';
import { DiceInjector } from './DiceInjector';
import { StateInjector } from './StateInjector';
import { CommandProxy } from './CommandProxy';
import { isTestEnvironment } from './environment';

/**
 * 测试工具集（全局单例）
 */
export class TestHarness {
    public readonly random: RandomInjector;
    public readonly dice: DiceInjector;
    public readonly state: StateInjector;
    public readonly command: CommandProxy;

    private static instance?: TestHarness;

    private constructor() {
        this.random = new RandomInjector();
        this.dice = new DiceInjector(this.random);
        this.state = new StateInjector();
        this.command = new CommandProxy();
    }

    /**
     * 获取全局单例
     */
    static getInstance(): TestHarness {
        if (!TestHarness.instance) {
            TestHarness.instance = new TestHarness();
        }
        return TestHarness.instance;
    }

    /**
     * 初始化测试工具（挂载到 window）
     */
    static init() {
        if (!isTestEnvironment()) {
            console.warn('[TestHarness] 非测试环境，跳过初始化');
            return;
        }

        const harness = TestHarness.getInstance();
        (window as any).__BG_TEST_HARNESS__ = harness;
        console.log('[TestHarness] 测试工具已初始化');
    }

    /**
     * 重置所有测试工具
     */
    reset() {
        this.random.clear();
        this.dice.clear();
    }
}
```

## 4. 引擎集成

### 4.1 随机数函数包装

```typescript
// src/engine/adapter.ts (修改)

import { TestHarness } from './testing/TestHarness';
import { isTestEnvironment } from './testing/environment';

export function createGameEngine<C, Cmd>(config: GameEngineConfig<C, Cmd>) {
    // ... 现有代码 ...

    // 包装 random 函数
    let random = config.random || Math.random;
    if (isTestEnvironment()) {
        const harness = TestHarness.getInstance();
        random = harness.random.wrap(random);
    }

    // ... 使用包装后的 random ...
}
```

### 4.2 状态访问器注册

```typescript
// src/engine/transport/react.tsx (修改)

import { TestHarness } from '../testing/TestHarness';
import { isTestEnvironment } from '../testing/environment';

export function GameProvider({ children, ...props }: GameProviderProps) {
    // ... 现有代码 ...

    // 注册状态访问器
    useEffect(() => {
        if (isTestEnvironment()) {
            const harness = TestHarness.getInstance();
            harness.state.register(
                () => state,
                (newState) => setState(newState)
            );
        }
    }, [state]);

    // ... 现有代码 ...
}
```

### 4.3 命令分发器注册

```typescript
// src/engine/transport/react.tsx (修改)

export function GameProvider({ children, ...props }: GameProviderProps) {
    // ... 现有代码 ...

    // 注册命令分发器
    useEffect(() => {
        if (isTestEnvironment()) {
            const harness = TestHarness.getInstance();
            harness.command.register(async (command) => {
                await dispatch(command);
            });
        }
    }, [dispatch]);

    // ... 现有代码 ...
}
```

## 5. E2E 测试使用

### 5.1 测试环境初始化

```typescript
// e2e/helpers/common.ts (新增)

/**
 * 启用测试模式（注入到浏览器上下文）
 */
export const enableTestMode = async (context: BrowserContext) => {
    await context.addInitScript(() => {
        (window as any).__E2E_TEST_MODE__ = true;
    });
};

/**
 * 等待测试工具就绪
 */
export const waitForTestHarness = async (page: Page, timeout = 5000) => {
    await page.waitForFunction(
        () => !!(window as any).__BG_TEST_HARNESS__,
        { timeout }
    );
};
```

### 5.2 骰子注入示例

```typescript
// e2e/dicethrone/dicethrone-thunder-strike.e2e.ts (修改后)

test('雷霆万钧技能测试', async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    await enableTestMode(context); // 启用测试模式
    await initContext(context);
    
    const page = await context.newPage();
    await page.goto('/play/dicethrone/match/xxx');
    
    // 等待测试工具就绪
    await waitForTestHarness(page);
    
    // 注入骰子值
    await page.evaluate(() => {
        (window as any).__BG_TEST_HARNESS__.dice.setValues([3, 3, 3, 1, 1]);
    });
    
    // 点击掷骰按钮
    await page.click('[data-tutorial-id="dice-roll-button"]');
    
    // 等待掷骰完成
    await page.waitForTimeout(2000);
    
    // 验证骰子值
    const state = await page.evaluate(() => {
        return (window as any).__BG_TEST_HARNESS__.state.get();
    });
    
    expect(state.dice.map(d => d.value)).toEqual([3, 3, 3, 1, 1]);
});
```

## 6. 类型定义

```typescript
// src/engine/testing/types.ts

declare global {
    interface Window {
        __E2E_TEST_MODE__?: boolean;
        __BG_TEST_HARNESS__?: {
            random: {
                setQueue(values: number[]): void;
                enqueue(...values: number[]): void;
                clear(): void;
                hasQueue(): boolean;
                queueLength(): number;
            };
            dice: {
                setValues(values: number[]): void;
                clear(): void;
                remaining(): number;
            };
            state: {
                get(): any;
                set(state: any): void;
                patch(patch: any): void;
            };
            command: {
                dispatch(command: any): Promise<void>;
            };
            reset(): void;
        };
    }
}
```

## 7. 实施计划

### 阶段 1：核心基础设施（1-2 天）
- [ ] 实现 `TestHarness` 核心类
- [ ] 实现 `RandomInjector`
- [ ] 实现 `DiceInjector`
- [ ] 实现 `StateInjector`
- [ ] 实现 `CommandProxy`
- [ ] 添加类型定义

### 阶段 2：引擎集成（1 天）
- [ ] 修改 `adapter.ts` 集成随机数包装
- [ ] 修改 `react.tsx` 注册状态访问器
- [ ] 修改 `react.tsx` 注册命令分发器
- [ ] 添加测试环境检测

### 阶段 3：E2E 测试工具（1 天）
- [ ] 更新 `e2e/helpers/common.ts`
- [ ] 添加 `enableTestMode`
- [ ] 添加 `waitForTestHarness`
- [ ] 更新所有游戏的 helper 文件

### 阶段 4：测试迁移（2-3 天）
- [ ] 迁移 DiceThrone 测试
- [ ] 迁移 SummonerWars 测试
- [ ] 迁移 SmashUp 测试
- [ ] 验证所有测试通过

### 阶段 5：文档和示例（1 天）
- [ ] 编写使用文档
- [ ] 添加示例测试
- [ ] 更新 `docs/automated-testing.md`

## 8. 优势

1. **统一标准**：所有游戏使用相同的测试工具
2. **类型安全**：完整的 TypeScript 类型支持
3. **最小侵入**：只在测试环境启用，不影响生产代码
4. **易于使用**：简单的 API，清晰的文档
5. **可扩展**：易于添加新的测试工具
6. **稳定可靠**：消除随机性，测试结果可预测

## 9. 注意事项

1. **安全性**：确保测试工具只在测试环境启用
2. **性能**：测试工具不应影响正常游戏性能
3. **兼容性**：确保与现有代码兼容
4. **文档**：保持文档更新
5. **测试**：测试工具本身也需要测试

## 10. 未来扩展

- **时间控制**：控制游戏时间流逝
- **事件模拟**：直接触发游戏事件
- **网络模拟**：模拟网络延迟和断线
- **性能分析**：收集性能数据
- **录制回放**：录制测试过程并回放
