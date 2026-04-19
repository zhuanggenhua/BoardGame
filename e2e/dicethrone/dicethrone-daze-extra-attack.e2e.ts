/**
 * 晕眩额外攻击机制 E2E 测试
 *
 * 覆盖：
 * 1. 晕眩在攻击结束后触发额外攻击
 * 2. 额外攻击结束后恢复原回合
 * 3. 晕眩层数上限仍只触发一次
 * 4. 净化移除晕眩时不触发额外攻击
 */

import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    setupDTOnlineMatch,
    selectCharacter,
    readyAndStartGame,
    waitForGameBoard,
} from '../helpers/dicethrone';

async function setupBarbarianMatch(
    browser: Browser,
    baseURL: string | undefined,
    opponentCharacter: 'paladin' | 'monk',
) {
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) return null;

    const { hostPage, guestPage } = setup;

    await selectCharacter(hostPage, 'barbarian');
    await selectCharacter(guestPage, opponentCharacter);
    await readyAndStartGame(hostPage, guestPage);
    await waitForGameBoard(hostPage);
    await waitForGameBoard(guestPage);

    return setup;
}

async function dispatchLegacy(page: Page, action: Record<string, unknown>): Promise<void> {
    const dispatched = await page.evaluate((payload) => {
        const dispatch = (window as any).__BG_DISPATCH__;
        if (!dispatch) return false;
        dispatch(payload);
        return true;
    }, action);

    expect(dispatched).toBe(true);
}

async function getLegacyActivePlayerId(page: Page): Promise<string> {
    return await page.evaluate(() => {
        const state = (window as any).__BG_STATE__;
        return state?.activePlayerId ?? state?.core?.activePlayerId ?? '';
    });
}

async function getLegacyPhase(page: Page): Promise<string> {
    return await page.evaluate(() => {
        const state = (window as any).__BG_STATE__;
        return state?.phase ?? state?.sys?.phase ?? '';
    });
}

test.describe('晕眩额外攻击机制', () => {
    test('晕眩应该在攻击结束后触发额外攻击', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianMatch(browser, baseURL, 'paladin');

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        const page = hostPage;

        try {
            await dispatchLegacy(page, {
                type: 'CHEAT_MODIFY_TOKENS',
                payload: { playerId: '0', tokenId: 'daze', amount: 1 },
            });
            await page.waitForTimeout(500);

            const dazeToken = page.locator('[data-token-id="daze"]').first();
            await expect(dazeToken).toBeVisible();
            await expect(await getLegacyActivePlayerId(page)).toBe('0');

            await dispatchLegacy(page, {
                type: 'CHEAT_ADVANCE_PHASE',
                payload: { targetPhase: 'main' },
            });
            await page.waitForTimeout(1500);

            await expect(dazeToken).not.toBeVisible();
            await expect(await getLegacyActivePlayerId(page)).toBe('1');
            await expect(await getLegacyPhase(page)).toBe('offensiveRoll');
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('额外攻击结束后应恢复原回合', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianMatch(browser, baseURL, 'paladin');

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        const page = hostPage;

        try {
            await dispatchLegacy(page, {
                type: 'CHEAT_MODIFY_TOKENS',
                payload: { playerId: '0', tokenId: 'daze', amount: 1 },
            });
            await page.waitForTimeout(500);

            await dispatchLegacy(page, {
                type: 'CHEAT_ADVANCE_PHASE',
                payload: { targetPhase: 'main' },
            });
            await page.waitForTimeout(1500);
            await expect(await getLegacyActivePlayerId(page)).toBe('1');

            await dispatchLegacy(page, {
                type: 'CHEAT_ADVANCE_PHASE',
                payload: { targetPhase: 'main' },
            });
            await page.waitForTimeout(1500);

            await expect(await getLegacyActivePlayerId(page)).toBe('0');
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('多层晕眩应该只触发一次额外攻击', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianMatch(browser, baseURL, 'paladin');

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        const page = hostPage;

        try {
            await dispatchLegacy(page, {
                type: 'CHEAT_MODIFY_TOKENS',
                payload: { playerId: '0', tokenId: 'daze', amount: 2 },
            });
            await page.waitForTimeout(500);

            const dazeToken = page.locator('[data-token-id="daze"]').first();
            await expect(dazeToken).toBeVisible();
            await expect(dazeToken).toContainText('1');

            await dispatchLegacy(page, {
                type: 'CHEAT_ADVANCE_PHASE',
                payload: { targetPhase: 'main' },
            });
            await page.waitForTimeout(1500);

            await expect(await getLegacyActivePlayerId(page)).toBe('1');
            await expect(dazeToken).not.toBeVisible();
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('晕眩应该可以被净化移除而不触发额外攻击', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianMatch(browser, baseURL, 'monk');

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        const page = hostPage;

        try {
            await dispatchLegacy(page, {
                type: 'CHEAT_MODIFY_TOKENS',
                payload: { playerId: '0', tokenId: 'daze', amount: 1 },
            });
            await page.waitForTimeout(500);

            await dispatchLegacy(page, {
                type: 'CHEAT_MODIFY_TOKENS',
                payload: { playerId: '0', tokenId: 'purify', amount: 1 },
            });
            await page.waitForTimeout(500);

            await dispatchLegacy(page, {
                type: 'USE_TOKEN',
                payload: {
                    tokenId: 'purify',
                    amount: 1,
                    targetStatusId: 'daze',
                },
            });
            await page.waitForTimeout(1000);

            const dazeToken = page.locator('[data-token-id="daze"]').first();
            await expect(dazeToken).not.toBeVisible();

            await dispatchLegacy(page, {
                type: 'CHEAT_ADVANCE_PHASE',
                payload: { targetPhase: 'main' },
            });
            await page.waitForTimeout(1500);

            await expect(await getLegacyActivePlayerId(page)).toBe('1');
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });
});
