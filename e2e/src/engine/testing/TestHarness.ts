/**
 * 测试工具集（全局单例）
 * 
 * 提供统一的测试工具接口，包括随机数控制、骰子注入、状态注入、命令代理等。
 * 
 * @example
 * ```typescript
 * // 在 E2E 测试中使用
 * const harness = window.__BG_TEST_HARNESS__;
 * 
 * // 注入骰子值
 * harness.dice.setValues([3, 3, 3, 1, 1]);
 * 
 * // 修改状态
 * const state = harness.state.get();
 * state.players['0'].resources.hp = 10;
 * harness.state.set(state);
 * 
 * // 分发命令
 * await harness.command.dispatch({
 *     type: 'ROLL_DICE',
 *     playerId: '0',
 *     payload: {}
 * });
 * ```
 */

import { RandomInjector } from './RandomInjector';
import { DiceInjector } from './DiceInjector';
import { StateInjector } from './StateInjector';
import { CommandProxy } from './CommandProxy';
import { isTestEnvironment } from './environment';

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
     * 
     * 只在测试环境中执行，生产环境会跳过。
     */
    static init() {
        if (!isTestEnvironment()) {
            // 生产环境不初始化测试工具
            return;
        }

        const harness = TestHarness.getInstance();
        (window as any).__BG_TEST_HARNESS__ = harness;
    }

    /**
     * 重置所有测试工具
     */
    reset() {
        this.random.clear();
        this.dice.clear();
    }

    /**
     * 获取测试工具状态（用于调试）
     */
    getStatus() {
        return {
            random: {
                enabled: this.random.isEnabled(),
                queueLength: this.random.queueLength(),
                consumed: this.random.consumedLength(),
            },
            dice: {
                remaining: this.dice.remaining(),
                values: this.dice.getValues(),
            },
            state: {
                registered: this.state.isRegistered(),
            },
            command: {
                registered: this.command.isRegistered(),
            },
        };
    }
}
