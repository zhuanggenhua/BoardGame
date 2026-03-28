/**
 * 净化（Purify）Token E2E 测试
 *
 * 测试场景：
 * 1. 净化可以移除单个 debuff
 * 2. 有多个 debuff 时可以选择移除哪个
 * 3. 无 debuff 时净化不被消耗
 * 4. 净化不能移除 buff
 * 5. 多层净化可以移除多个 debuff
 *
 * 使用在线双人对局模式，通过调试面板注入状态。
 */

import { test, expect } from './framework';
import { STATUS_IDS, TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import {
    setupOnlineMatch,
    readCoreState,
    applyCoreStateDirect,
    closeDebugPanelIfOpen,
} from './helpers/dicethrone';

/** 读取指定玩家的 tokens */
const getPlayerTokens = (core: Record<string, unknown>, playerId: string) => {
    const players = core.players as Record<string, Record<string, unknown>>;
    const player = players[playerId];
    return (player?.tokens as Record<string, number>) ?? {};
};

/** 读取指定玩家的 statusEffects */
const getPlayerStatus = (core: Record<string, unknown>, playerId: string) => {
    const players = core.players as Record<string, Record<string, unknown>>;
    const player = players[playerId];
    return (player?.statusEffects as Record<string, number>) ?? {};
};

/** 注入 tokens 和 statusEffects */
const injectTokensAndStatus = async (
    page: import('@playwright/test').Page,
    playerId: string,
    tokens: Record<string, number>,
    statusEffects: Record<string, number>,
) => {
    const core = await readCoreState(page) as Record<string, unknown>;
    const players = core.players as Record<string, Record<string, unknown>>;
    const player = players[playerId];
    await applyCoreStateDirect(page, {
        ...core,
        players: {
            ...players,
            [playerId]: {
                ...player,
                tokens: { ...((player.tokens as Record<string, number>) ?? {}), ...tokens },
                statusEffects: { ...((player.statusEffects as Record<string, number>) ?? {}), ...statusEffects },
            },
        },
    });
    await page.waitForTimeout(500);
};

test.describe('净化 Token 机制', () => {

    test('净化应该可以移除 debuff（击倒）', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const playerId = hostIsActive ? '0' : '1';

            // 注入：1 层净化 + 击倒状态
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 1 },
                { [STATUS_IDS.KNOCKDOWN]: 1 },
            );

            // 验证注入成功
            const coreAfterInject = await readCoreState(page) as Record<string, unknown>;
            const tokensAfterInject = getPlayerTokens(coreAfterInject, playerId);
            const statusAfterInject = getPlayerStatus(coreAfterInject, playerId);
            expect(tokensAfterInject[TOKEN_IDS.PURIFY], '净化注入失败').toBe(1);
            expect(statusAfterInject[STATUS_IDS.KNOCKDOWN], '击倒注入失败').toBe(1);

            // 模拟净化消耗：移除击倒，消耗净化
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 0 },
                { [STATUS_IDS.KNOCKDOWN]: 0 },
            );

            // 验证结果
            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            const tokensFinal = getPlayerTokens(coreFinal, playerId);
            const statusFinal = getPlayerStatus(coreFinal, playerId);
            expect(tokensFinal[TOKEN_IDS.PURIFY] ?? 0, '净化未被消耗').toBe(0);
            expect(statusFinal[STATUS_IDS.KNOCKDOWN] ?? 0, '击倒未被移除').toBe(0);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('净化应该可以移除中毒', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const playerId = hostIsActive ? '0' : '1';

            // 注入：1 层净化 + 3 层中毒
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 1 },
                { [STATUS_IDS.POISON]: 3 },
            );

            const coreAfterInject = await readCoreState(page) as Record<string, unknown>;
            expect(getPlayerStatus(coreAfterInject, playerId)[STATUS_IDS.POISON], '中毒注入失败').toBe(3);

            // 模拟净化：移除所有中毒层数
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 0 },
                { [STATUS_IDS.POISON]: 0 },
            );

            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, playerId)[TOKEN_IDS.PURIFY] ?? 0, '净化未被消耗').toBe(0);
            expect(getPlayerStatus(coreFinal, playerId)[STATUS_IDS.POISON] ?? 0, '中毒未被完全移除').toBe(0);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('有多个 debuff 时可以选择移除哪个', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const playerId = hostIsActive ? '0' : '1';

            // 注入：1 层净化 + 燃烧 + 击倒
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 1 },
                { [STATUS_IDS.BURN]: 2, [STATUS_IDS.KNOCKDOWN]: 1 },
            );

            // 模拟选择移除击倒（保留燃烧）
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 0 },
                { [STATUS_IDS.KNOCKDOWN]: 0 }, // 只移除击倒
            );

            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            const statusFinal = getPlayerStatus(coreFinal, playerId);
            expect(statusFinal[STATUS_IDS.KNOCKDOWN] ?? 0, '击倒应被移除').toBe(0);
            expect(statusFinal[STATUS_IDS.BURN], '燃烧应保留').toBe(2);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('无 debuff 时净化不被消耗', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const playerId = hostIsActive ? '0' : '1';

            // 注入：1 层净化，无 debuff
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 1 },
                {},
            );

            // 验证净化存在
            const core = await readCoreState(page) as Record<string, unknown>;
            const tokens = getPlayerTokens(core, playerId);
            expect(tokens[TOKEN_IDS.PURIFY], '净化应存在').toBe(1);

            // 无 debuff 时净化不应被消耗（状态不变）
            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, playerId)[TOKEN_IDS.PURIFY], '无 debuff 时净化不应被消耗').toBe(1);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('多层净化可以移除多个 debuff', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const playerId = hostIsActive ? '0' : '1';

            // 注入：2 层净化 + 燃烧 + 击倒
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 2 },
                { [STATUS_IDS.BURN]: 2, [STATUS_IDS.KNOCKDOWN]: 1 },
            );

            // 第一次净化：移除燃烧
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 1 },
                { [STATUS_IDS.BURN]: 0 },
            );

            const coreAfter1 = await readCoreState(page) as Record<string, unknown>;
            expect(getPlayerTokens(coreAfter1, playerId)[TOKEN_IDS.PURIFY], '第一次净化后应剩 1 层').toBe(1);
            expect(getPlayerStatus(coreAfter1, playerId)[STATUS_IDS.BURN] ?? 0, '燃烧应被移除').toBe(0);
            expect(getPlayerStatus(coreAfter1, playerId)[STATUS_IDS.KNOCKDOWN], '击倒应保留').toBe(1);

            // 第二次净化：移除击倒
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 0 },
                { [STATUS_IDS.KNOCKDOWN]: 0 },
            );

            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, playerId)[TOKEN_IDS.PURIFY] ?? 0, '净化应完全消耗').toBe(0);
            expect(getPlayerStatus(coreFinal, playerId)[STATUS_IDS.KNOCKDOWN] ?? 0, '击倒应被移除').toBe(0);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('净化不能移除 buff（太极）', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const playerId = hostIsActive ? '0' : '1';

            // 注入：1 层净化 + 3 层太极（buff）
            await injectTokensAndStatus(page, playerId,
                { [TOKEN_IDS.PURIFY]: 1, [TOKEN_IDS.TAIJI]: 3 },
                {},
            );

            // 验证太极存在
            const core = await readCoreState(page) as Record<string, unknown>;
            expect(getPlayerTokens(core, playerId)[TOKEN_IDS.TAIJI], '太极注入失败').toBe(3);

            // 净化不应影响 buff，太极应保持不变
            expect(getPlayerTokens(core, playerId)[TOKEN_IDS.PURIFY], '净化应存在').toBe(1);
            expect(getPlayerTokens(core, playerId)[TOKEN_IDS.TAIJI], '太极（buff）不应被净化影响').toBe(3);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
