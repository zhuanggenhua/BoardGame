/**
 * E2E 测试框架 - Fixtures
 * 
 * 提供自动化的测试环境设置和清理，集成 GameTestContext。
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

import { test as base, expect as baseExpect } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';
import { GameTestContext } from './GameTestContext';

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
}

/**
 * 扩展 Playwright test，添加 game fixture
 */
export const test = base.extend<FrameworkFixtures>({
    /**
     * game fixture
     * 
     * 自动创建 GameTestContext，测试结束后自动清理。
     * 同时注入测试模式标志，启用 TestHarness。
     */
    game: async ({ page, context }, use) => {
        // 注入测试模式标志（启用 TestHarness）
        await context.addInitScript(() => {
            (window as any).__E2E_TEST_MODE__ = true;
        });

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
export type { GameTestContext };
