import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    applyCoreStateDirect,
    ensureDebugPanelClosed,
    readyAndStartGame,
    readCoreState,
    selectCharacter,
    setupDTOnlineMatch,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { waitForTestHarness } from '../helpers/common';
import { MONK_CARDS } from '../../src/games/dicethrone/heroes/monk/cards';

const DICETHRONE_ONLINE_TEST_TIMEOUT_MS = 240000;

async function waitForHandCardVisualReady(page: Page, cardId: string): Promise<void> {
    await page.waitForFunction((expectedCardId) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        const card = handArea.querySelector(`[data-card-id="${expectedCardId}"]`);
        if (!card) return false;
        return card.getAttribute('data-is-flipped') === 'true'
            && handArea.querySelectorAll('.atlas-shimmer').length === 0;
    }, cardId, { timeout: 15000, polling: 100 });
    await page.waitForTimeout(900);
}

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

async function waitForRollingSpotlightFrame(page: Page, dieContentTestId = '[data-testid="bonus-die-spotlight-content"]'): Promise<void> {
    await expect.poll(async () => page.locator(dieContentTestId).first().evaluate((node) => {
        const content = node as HTMLElement;
        const dice = content.querySelector('[data-testid="dice-3d"]') as HTMLElement | null;
        const rotatingLayer = content.querySelector('.dice3d-preserve-3d') as HTMLElement | null;
        if (!dice) {
            return false;
        }

        const rect = dice.getBoundingClientRect();
        const transform = rotatingLayer ? getComputedStyle(rotatingLayer).transform : '';
        const animationClass = rotatingLayer?.className ?? '';

        if ((content.dataset.isRolling ?? '') !== 'true' || rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        return transform !== 'none' || animationClass.includes('animate-dice3d');
    }), { timeout: 3000, intervals: [50, 50, 50, 50, 100, 100] }).toBe(true);
}

test('opponent one throw fortune spotlight should visibly roll before settling', async ({ browser }, testInfo) => {
    test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);

    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) {
        test.skip(true, 'online setup unavailable in current environment');
        return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = setup;

    try {
        await selectCharacter(hostPage, 'barbarian');
        await selectCharacter(guestPage, 'monk');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForTestHarness(hostPage, 10000);
        await waitForTestHarness(guestPage, 10000);

        const oneThrowFortune = MONK_CARDS.find((card) => card.id === 'card-one-throw-fortune');
        if (!oneThrowFortune) {
            throw new Error('未找到 card-one-throw-fortune');
        }

        const coreState = await readCoreState(hostPage) as Record<string, any>;
        const injectedCore = JSON.parse(JSON.stringify(coreState));
        injectedCore.activePlayerId = '1';
        injectedCore.rollCount = 0;
        injectedCore.rollConfirmed = false;
        injectedCore.pendingAttack = null;
        injectedCore.pendingBonusDiceSettlement = undefined;
        injectedCore.players['0'].resources.CP = 2;
        injectedCore.players['0'].resources.HP = 50;
        injectedCore.players['1'].resources.CP = 3;
        injectedCore.players['1'].resources.HP = 40;
        injectedCore.players['1'].hand = [JSON.parse(JSON.stringify(oneThrowFortune))];

        await applyCoreStateDirect(hostPage, injectedCore);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return state?.sys?.phase === 'main1'
                && state?.core?.activePlayerId === '1'
                && state?.core?.players?.['1']?.hand?.some((card: any) => card.id === 'card-one-throw-fortune');
        }, { timeout: 15000 });

        await waitForHandCardVisualReady(guestPage, 'card-one-throw-fortune');
        await dragHandCardToPlay(guestPage, 'card-one-throw-fortune');

        const hostCardSpotlight = hostPage.locator('[data-testid="card-spotlight-overlay"]');
        const hostSpotlightDie = hostPage.locator('[data-testid="card-spotlight-die"]');
        const hostSpotlightDieContent = hostSpotlightDie.locator('[data-testid="bonus-die-spotlight-content"]').first();
        await expect(hostCardSpotlight).toBeVisible({ timeout: 15000 });
        await expect(hostSpotlightDie).toHaveCount(1, { timeout: 15000 });

        await expect.poll(async () => hostSpotlightDieContent.evaluate((node) => ({
            isRolling: (node as HTMLElement).dataset.isRolling ?? '',
            presentationKey: (node as HTMLElement).dataset.presentationKey ?? '',
            animationClass: node.querySelector('.dice3d-preserve-3d')?.className ?? '',
        })), { timeout: 2000 }).toMatchObject({
            isRolling: 'true',
        });
        await waitForRollingSpotlightFrame(hostPage, '[data-testid="bonus-die-spotlight-content"]');

        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '01-opponent-one-throw-fortune-rolling'),
            fullPage: false,
        });

        await expect.poll(async () => hostSpotlightDieContent.evaluate((node) => ({
            isRolling: (node as HTMLElement).dataset.isRolling ?? '',
            presentationKey: (node as HTMLElement).dataset.presentationKey ?? '',
            animationClass: node.querySelector('.dice3d-preserve-3d')?.className ?? '',
        })), { timeout: 4000 }).toMatchObject({
            isRolling: 'false',
        });

        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '02-opponent-one-throw-fortune-settled'),
            fullPage: false,
        });

        await expect(hostCardSpotlight).toHaveCount(0, { timeout: 7000 });
        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '03-opponent-one-throw-fortune-closed'),
            fullPage: false,
        });

        const overlayState = await hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return {
                lastEventTypes: (state?.sys?.eventStream?.entries ?? []).slice(-6).map((entry: any) => entry.event?.type),
            };
        });

        expect(overlayState.lastEventTypes).toContain('CARD_PLAYED');
        expect(overlayState.lastEventTypes).toContain('BONUS_DIE_ROLLED');
        await expect(hostPage.locator('[data-testid="bonus-die-overlay"]')).toHaveCount(0);
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});
