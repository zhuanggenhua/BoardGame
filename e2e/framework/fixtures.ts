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
import { assertNoFatalFrontendErrors, attachPageDiagnostics } from '../helpers/common';

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
     * 自动前端致命错误门禁。
     *
     * 默认拦截 React 渲染循环等会让 UI 进入不可信状态的错误。
     */
    fatalFrontendErrors: void;
    
    /**
     * Worker 端口信息
     * 
     * 多 worker 模式下，每个 worker 使用独立的端口。
     * 单 worker 模式下，使用固定端口（6174, 20000, 21000）。
     */
    workerPorts: WorkerPorts;
}

/**
 * 获取当前 worker 的端口信息
 */
function getWorkerPorts(parallelIndex: number): WorkerPorts {
    // 优先使用 runtime 记录的端口；单 worker fallback 到 worker 0
    const ports = loadWorkerPorts(parallelIndex) ?? loadWorkerPorts(0);
    if (ports) {
        return ports;
    }
    
    // 最后兜底到固定默认端口
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
        const { frontend } = workerPorts;
        await use(`http://127.0.0.1:${frontend}`);
    }, { option: true }],

    context: async ({ context, workerPorts }, use) => {
        await context.addInitScript(() => {
            (window as any).__E2E_TEST_MODE__ = true;
        });

        await context.addInitScript((ports) => {
            (window as any).__E2E_WORKER_PORTS__ = ports;
        }, workerPorts);

        await context.addInitScript((ports) => {
            (window as Window & {
                __FORCE_GAME_SERVER_URL__?: string;
                __FORCE_API_SERVER_URL__?: string;
            }).__FORCE_GAME_SERVER_URL__ = `http://127.0.0.1:${ports.gameServer}`;
            (window as Window & {
                __FORCE_GAME_SERVER_URL__?: string;
                __FORCE_API_SERVER_URL__?: string;
            }).__FORCE_API_SERVER_URL__ = `http://127.0.0.1:${ports.apiServer}`;
        }, workerPorts);

        await context.addInitScript(() => {
            (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
        });

        await use(context);
    },

    fatalFrontendErrors: [async ({ context, page }, use) => {
        const trackedPages = new Map<typeof page, {
            label: string;
            diagnostics: ReturnType<typeof attachPageDiagnostics>;
        }>();
        const trackPage = (targetPage: typeof page) => {
            if (trackedPages.has(targetPage)) {
                return;
            }
            trackedPages.set(targetPage, {
                label: `page-${trackedPages.size}`,
                diagnostics: attachPageDiagnostics(targetPage),
            });
        };

        trackPage(page);
        context.pages().forEach(trackPage);
        context.on('page', trackPage);

        try {
            await use();
        } finally {
            context.removeListener('page', trackPage);
            await Promise.resolve();
            await assertNoFatalFrontendErrors(Array.from(trackedPages.values()));
        }
    }, { auto: true }],

    /**
     * workerPorts fixture
     * 
     * 提供当前 worker 的端口信息。
     */
    workerPorts: [async ({ browserName: _browserName }, use, testInfo) => {
        const ports = getWorkerPorts(testInfo.parallelIndex);
        const previousEnv = {
            PW_PORT: process.env.PW_PORT,
            PW_GAME_SERVER_PORT: process.env.PW_GAME_SERVER_PORT,
            PW_API_SERVER_PORT: process.env.PW_API_SERVER_PORT,
            VITE_FRONTEND_URL: process.env.VITE_FRONTEND_URL,
            PW_GAME_SERVER_URL: process.env.PW_GAME_SERVER_URL,
        };

        process.env.PW_PORT = String(ports.frontend);
        process.env.PW_GAME_SERVER_PORT = String(ports.gameServer);
        process.env.PW_API_SERVER_PORT = String(ports.apiServer);
        process.env.VITE_FRONTEND_URL = `http://127.0.0.1:${ports.frontend}`;
        process.env.PW_GAME_SERVER_URL = `http://127.0.0.1:${ports.gameServer}`;

        try {
            await use(ports);
        } finally {
            if (previousEnv.PW_PORT === undefined) delete process.env.PW_PORT;
            else process.env.PW_PORT = previousEnv.PW_PORT;

            if (previousEnv.PW_GAME_SERVER_PORT === undefined) delete process.env.PW_GAME_SERVER_PORT;
            else process.env.PW_GAME_SERVER_PORT = previousEnv.PW_GAME_SERVER_PORT;

            if (previousEnv.PW_API_SERVER_PORT === undefined) delete process.env.PW_API_SERVER_PORT;
            else process.env.PW_API_SERVER_PORT = previousEnv.PW_API_SERVER_PORT;

            if (previousEnv.VITE_FRONTEND_URL === undefined) delete process.env.VITE_FRONTEND_URL;
            else process.env.VITE_FRONTEND_URL = previousEnv.VITE_FRONTEND_URL;

            if (previousEnv.PW_GAME_SERVER_URL === undefined) delete process.env.PW_GAME_SERVER_URL;
            else process.env.PW_GAME_SERVER_URL = previousEnv.PW_GAME_SERVER_URL;
        }
    }, { scope: 'worker', auto: true }],
    
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
