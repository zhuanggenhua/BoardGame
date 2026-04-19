/**
 * DiceThrone Token 响应时序测试
 *
 * 验证：
 * 1. TOKEN_RESPONSE_REQUESTED 之后、关闭前，不应提前产生 DAMAGE_DEALT
 * 2. TOKEN_RESPONSE_CLOSED 之后，才应该产生 DAMAGE_DEALT
 */

import type { Browser } from '@playwright/test';
import { test, expect } from '../framework';
import {
    readCoreState,
    readEventStream,
    applyCoreStateDirect,
    selectCharacter,
    readyAndStartGame,
    setupDTOnlineMatch,
    waitForGameBoard,
} from '../helpers/dicethrone';

async function setupBarbarianVsMoonElfMatch(browser: Browser, baseURL: string | undefined) {
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) return null;

    const { hostPage, guestPage } = setup;

    await selectCharacter(hostPage, 'barbarian');
    await selectCharacter(guestPage, 'moon_elf');
    await readyAndStartGame(hostPage, guestPage);
    await waitForGameBoard(hostPage);
    await waitForGameBoard(guestPage);
    await hostPage.waitForSelector('[data-phase="offensiveRoll"]', { timeout: 15000 });

    return setup;
}

async function driveAttackToTokenWindow(hostPage: import('@playwright/test').Page, guestPage: import('@playwright/test').Page) {
    const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 5000 });
    await rollButton.click();
    await hostPage.waitForTimeout(500);

    const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]');
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();
    await hostPage.waitForTimeout(500);

    const smashButton = hostPage.locator('[data-ability-id="smash"]').first();
    if (await smashButton.isVisible({ timeout: 2000 })) {
        await smashButton.click();
        await hostPage.waitForTimeout(500);
    }

    const advanceButton = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advanceButton).toBeEnabled({ timeout: 5000 });
    await advanceButton.click();
    await hostPage.waitForTimeout(1000);

    await guestPage.waitForSelector('[data-phase="defensiveRoll"]', { timeout: 10000 });

    const defenseRollButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]');
    await expect(defenseRollButton).toBeEnabled({ timeout: 5000 });
    await defenseRollButton.click();
    await guestPage.waitForTimeout(500);

    const defenseConfirmButton = guestPage.locator('[data-tutorial-id="dice-confirm-button"]');
    await expect(defenseConfirmButton).toBeEnabled({ timeout: 5000 });
    await defenseConfirmButton.click();
    await guestPage.waitForTimeout(500);

    const defenseAdvanceButton = guestPage.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(defenseAdvanceButton).toBeEnabled({ timeout: 5000 });
    await defenseAdvanceButton.click();
    await guestPage.waitForTimeout(1500);
}

async function skipTokenResponseIfVisible(guestPage: import('@playwright/test').Page) {
    const skipButton = guestPage.locator('button').filter({
        hasText: /跳过|Skip/i,
    }).first();

    if (await skipButton.isVisible({ timeout: 2000 })) {
        await skipButton.click();
        await guestPage.waitForTimeout(1500);
    }
}

test.describe('DiceThrone Token Response Timing', () => {
    test('Token 响应请求后不应立刻生成伤害事件', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianVsMoonElfMatch(browser, baseURL);

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            const initialState = await readCoreState(hostPage);
            initialState.players['1'].tokens = { evasive: 2 };
            initialState.players['0'].resources.hp = 50;
            initialState.players['1'].resources.hp = 50;
            await applyCoreStateDirect(hostPage, initialState);
            await hostPage.waitForTimeout(500);

            await driveAttackToTokenWindow(hostPage, guestPage);

            const eventsAfterRequest = await readEventStream(guestPage);
            const tokenRequestIndex = eventsAfterRequest.findIndex(
                (entry: any) => entry.event.type === 'TOKEN_RESPONSE_REQUESTED',
            );

            expect(tokenRequestIndex, 'Should have TOKEN_RESPONSE_REQUESTED event').toBeGreaterThanOrEqual(0);

            const tokenCloseIndex = eventsAfterRequest.findIndex(
                (entry: any) => entry.event.type === 'TOKEN_RESPONSE_CLOSED',
            );

            if (tokenCloseIndex === -1) {
                const hasDamageAfterRequest = eventsAfterRequest
                    .slice(tokenRequestIndex + 1)
                    .some((entry: any) => entry.event.type === 'DAMAGE_DEALT');

                expect(
                    hasDamageAfterRequest,
                    'Should NOT have DAMAGE_DEALT after TOKEN_RESPONSE_REQUESTED (before response closed)',
                ).toBe(false);
            }

            await skipTokenResponseIfVisible(guestPage);

            const eventsAfterClose = await readEventStream(guestPage);
            const finalTokenCloseIndex = eventsAfterClose.findIndex(
                (entry: any) => entry.event.type === 'TOKEN_RESPONSE_CLOSED',
            );

            if (finalTokenCloseIndex >= 0) {
                const damageEvent = eventsAfterClose
                    .slice(finalTokenCloseIndex + 1)
                    .find((entry: any) => entry.event.type === 'DAMAGE_DEALT');

                expect(damageEvent, 'Should have DAMAGE_DEALT after TOKEN_RESPONSE_CLOSED').toBeTruthy();
            }

            const finalState = await readCoreState(guestPage);
            expect(finalState.players['1'].resources.hp, 'Defender should take damage').toBeLessThan(50);
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('事件流顺序验证：完整的 Token 响应流程', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianVsMoonElfMatch(browser, baseURL);

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            const initialState = await readCoreState(hostPage);
            initialState.players['1'].tokens = { evasive: 2 };
            await applyCoreStateDirect(hostPage, initialState);
            await hostPage.waitForTimeout(500);

            await driveAttackToTokenWindow(hostPage, guestPage);
            await skipTokenResponseIfVisible(guestPage);

            const allEvents = await readEventStream(guestPage);
            const eventTypes = allEvents.map((entry: any) => entry.event.type);
            const tokenRequestIndex = eventTypes.indexOf('TOKEN_RESPONSE_REQUESTED');
            const tokenCloseIndex = eventTypes.indexOf('TOKEN_RESPONSE_CLOSED');
            const damageIndex = eventTypes.lastIndexOf('DAMAGE_DEALT');

            expect(tokenRequestIndex, 'Should have TOKEN_RESPONSE_REQUESTED').toBeGreaterThanOrEqual(0);
            expect(tokenCloseIndex, 'Should have TOKEN_RESPONSE_CLOSED').toBeGreaterThan(tokenRequestIndex);
            expect(damageIndex, 'Should have DAMAGE_DEALT after TOKEN_RESPONSE_CLOSED').toBeGreaterThan(tokenCloseIndex);
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });
});
