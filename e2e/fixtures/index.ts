/**
 * Playwright Fixtures for E2E Tests
 * 
 * 提供自动化的测试环境设置和清理，减少重复代码。
 * 
 * 使用方式：
 * ```typescript
 * import { test, expect } from './fixtures';
 * 
 * test('测试名称', async ({ smashupMatch }) => {
 *   const { hostPage, guestPage, matchId } = smashupMatch;
 *   // 测试代码
 * });
 * ```
 */

import { test as base, expect as baseExpect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import {
    setupSmashUpOnlineMatch,
} from '../helpers/smashup';
import {
    setupDTOnlineMatch,
    cleanupDTMatch,
    type DTMatchSetup,
} from '../helpers/dicethrone';
import {
    setupSWOnlineMatch,
    type SWMatchSetup,
} from '../helpers/summonerwars';

// ============================================================================
// Fixture 类型定义
// ============================================================================

interface SmashUpMatchSetup {
    matchId: string;
    hostPage: Page;
    guestPage: Page;
    hostContext: BrowserContext;
    guestContext: BrowserContext;
}

interface GameFixtures {
    /**
     * SmashUp 在线对局（已完成派系选择，进入游戏）
     * 
     * 默认配置：
     * - Host: 派系 [0, 1]
     * - Guest: 派系 [2, 3]
     */
    smashupMatch: SmashUpMatchSetup;

    /**
     * DiceThrone 在线对局（已完成角色选择，进入游戏）
     * 
     * 默认配置：
     * - Host: Monk
     * - Guest: Barbarian
     */
    dicethroneMatch: DTMatchSetup;

    /**
     * SummonerWars 在线对局（已完成阵营选择，进入游戏）
     * 
     * 默认配置：
     * - Host: Necromancer
     * - Guest: Trickster
     */
    summonerwarsMatch: SWMatchSetup;
}

// ============================================================================
// Fixture 实现
// ============================================================================

export const test = base.extend<GameFixtures>({
    /**
     * SmashUp 对局 fixture
     * 
     * 自动创建房间、加入玩家、完成派系选择，测试结束后自动清理。
     */
    smashupMatch: async ({ browser }, runFixture, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupSmashUpOnlineMatch(browser, baseURL);

        if (!setup) {
            throw new Error('Failed to setup SmashUp match - server unavailable or room creation failed');
        }

        await runFixture({
            matchId: setup.matchId,
            hostPage: setup.hostPage,
            guestPage: setup.guestPage,
            hostContext: setup.hostContext,
            guestContext: setup.guestContext,
        });

        // 自动清理
        await setup.hostContext.close().catch(() => {});
        await setup.guestContext.close().catch(() => {});
    },

    /**
     * DiceThrone 对局 fixture
     * 
     * 自动创建房间、加入玩家、完成角色选择，测试结束后自动清理。
     */
    dicethroneMatch: async ({ browser }, runFixture, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser, baseURL);

        if (!setup) {
            throw new Error('Failed to setup DiceThrone match - server unavailable or room creation failed');
        }

        await runFixture(setup);

        // 自动清理
        await cleanupDTMatch(setup).catch(() => {});
    },
    /**
     * SummonerWars 对局 fixture
     * 
     * 自动创建房间、加入玩家、完成阵营选择，测试结束后自动清理。
     */
    summonerwarsMatch: async ({ browser }, runFixture, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupSWOnlineMatch(browser, baseURL, 'necromancer', 'trickster');

        if (!setup) {
            throw new Error('Failed to setup SummonerWars match - server unavailable or room creation failed');
        }

        await runFixture(setup);

        // 自动清理
        await setup.hostContext.close().catch(() => {});
        await setup.guestContext.close().catch(() => {});
    },
});

// 重新导出 expect，保持一致的导入方式
export { baseExpect as expect };

// ============================================================================
// 工厂函数（用于需要自定义配置的场景）
// ============================================================================

/**
 * 创建自定义 SmashUp 对局
 * 
 * @param browser Browser 实例
 * @param baseURL 基础 URL
 * @param options 自定义选项
 * @returns 对局设置或 null（失败时）
 */
export async function createSmashUpMatch(
    browser: Browser,
    baseURL: string | undefined,
    options?: {
        hostFactions?: [number, number];
        guestFactions?: [number, number];
    }
): Promise<SmashUpMatchSetup | null> {
    return await setupSmashUpOnlineMatch(browser, baseURL, options);
}

/**
 * 创建自定义 DiceThrone 对局
 * 
 * @param browser Browser 实例
 * @param baseURL 基础 URL
 * @returns 对局设置或 null（失败时）
 */
export async function createDiceThroneMatch(
    browser: Browser,
    baseURL: string | undefined
): Promise<DTMatchSetup | null> {
    return await setupDTOnlineMatch(browser, baseURL);
}

/**
 * 创建自定义 SummonerWars 对局
 * 
 * @param browser Browser 实例
 * @param baseURL 基础 URL
 * @param hostFactionId Host 阵营 ID
 * @param guestFactionId Guest 阵营 ID
 * @returns 对局设置或 null（失败时）
 */
export async function createSummonerWarsMatch(
    browser: Browser,
    baseURL: string | undefined,
    hostFactionId: string,
    guestFactionId: string
): Promise<SWMatchSetup | null> {
    return await setupSWOnlineMatch(browser, baseURL, hostFactionId, guestFactionId);
}
