/**
 * E2E 测试框架 - Fixtures
 * 
 * 提供自动化的测试环境设置和清理，集成 GameTestContext。
 * 支持单 worker 和多 worker 模式。
 * 
 * 使用方式：
 * ```typescript
 * import { test, expect } from '@/e2e/framework';
 * 
 * test('测试名称', async ({ game }) => {
 *   await game.setupScene({ ... });
 *   await game.playCard('wizard_portal');
 *   await game.expectCardInHand('alien_invader');
 * });
 * ```
 */

/* eslint-disable react-hooks/rules-of-hooks */

import { test as base, expect as baseExpect } from '@playwright/test';
import { GameTestContext } from './GameTestContext';
import { loadWorkerPorts } from '../../scripts/infra/port-allocator.js';
import { E2E_SINGLE_WORKER_PORTS } from '../../scripts/infra/e2e-port-config.js';

/**
 * Worker 端口信息
 */
interface WorkerPorts {
    frontend: number;
    gameServer: number;
    apiServer: number;
}

/**
 * 框架 Fixtures
 */
interface FrameworkFixtures {
    /**
     * 游戏测试上下文
     * 
     * 提供统一的测试 API，封装状态注入、游戏动作、断言等功能。
     */
    game: GameTestContext;
    
    /**
     * Worker 端口信息
     * 
     * 多 worker 模式下，每个 worker 使用独立的端口。
     * 单 worker 模式下，使用固定端口（6173, 20000, 21000）。
     */
    workerPorts: WorkerPorts;
}

/**
 * 获取当前 worker 的端口信息
 */
function getWorkerPorts(parallelIndex: number): WorkerPorts {
    // 多 worker 模式：从文件读取动态分配的端口
    const ports = loadWorkerPorts(parallelIndex);
    if (ports) {
        return ports;
    }
    
    // 单 worker 模式：使用固定端口
    return {
        frontend: E2E_SINGLE_WORKER_PORTS.frontend,
        gameServer: E2E_SINGLE_WORKER_PORTS.gameServer,
        apiServer: E2E_SINGLE_WORKER_PORTS.apiServer,
    };
}

/**
 * 扩展 Playwright test，添加 game 和 workerPorts fixtures
 */
export const test = base.extend<FrameworkFixtures>({
    baseURL: [async ({ workerPorts }, use) => {
        await use(`http://127.0.0.1:${workerPorts.frontend}`);
    }, { option: true }],

    /**
     * workerPorts fixture
     * 
     * 提供当前 worker 的端口信息。
     */
    workerPorts: [async (_: any, use, testInfo) => {
        const ports = getWorkerPorts(testInfo.parallelIndex);
        await use(ports);
    }, { scope: 'worker' }],
    
    /**
     * game fixture
     * 
     * 自动创建 GameTestContext，测试结束后自动清理。
     * 同时注入测试模式标志，启用 TestHarness。
     */
    game: async ({ page, context, workerPorts }, use) => {
         
        // 注入测试模式标志（启用 TestHarness）
        await context.addInitScript(() => {
            (window as any).__E2E_TEST_MODE__ = true;
        });
        
        // 注入 worker 端口信息（供测试代码使用）
        await context.addInitScript((ports) => {
            (window as any).__E2E_WORKER_PORTS__ = ports;
        }, workerPorts);

        const game = new GameTestContext(page);
        await use(game);
        // 清理逻辑（如果需要）
    },
});

/**
 * 重新导出 expect，保持一致的导入方式
 */
export { baseExpect as expect };

/**
 * 导出 GameTestContext 类型，供测试文件使用
 */
export type { GameTestContext, WorkerPorts };
