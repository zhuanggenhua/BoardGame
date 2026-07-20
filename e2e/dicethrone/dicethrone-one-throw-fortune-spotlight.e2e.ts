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

async function waitForCardSpotlightVisualReady(page: Page, cardId: string) {
    const spotlight = page.locator(`[data-testid="card-spotlight-overlay"][data-card-id="${cardId}"]`).first();
    await expect(spotlight).toBeVisible({ timeout: 15000 });

    await expect.poll(async () => page.evaluate((expectedCardId) => {
        const overlay = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="card-spotlight-overlay"]'))
            .find((node) => node.dataset.cardId === expectedCardId);
        if (!overlay) {
            return { ready: false, reason: 'missing-overlay' };
        }

        const rect = overlay.getBoundingClientRect();
        const atlasFrame = overlay.querySelector<HTMLElement>('[data-card-atlas-frame="true"]');
        const atlasImage = overlay.querySelector<HTMLImageElement>('[data-card-atlas-img="true"]');
        const image = atlasImage ?? overlay.querySelector<HTMLImageElement>('img');
        const hasShimmer = overlay.querySelector('.atlas-shimmer') !== null;
        const imageReady = image ? image.complete && image.naturalWidth > 16 && image.naturalHeight > 16 : false;
        const cardLargeEnough = rect.width > window.innerWidth * 0.1 && rect.height > window.innerHeight * 0.25;
        const settledNearMainView =
            rect.left > window.innerWidth * 0.25
            && rect.right < window.innerWidth * 0.75
            && rect.top > window.innerHeight * 0.05
            && rect.bottom < window.innerHeight * 0.82;

        return {
            ready: Boolean(
                overlay.dataset.cardId === expectedCardId
                && cardLargeEnough
                && settledNearMainView
                && imageReady
                && (atlasFrame ? !hasShimmer : true),
            ),
            cardId: overlay.dataset.cardId ?? null,
            hasShimmer,
            imageReady,
            rectHeight: Math.round(rect.height),
            rectLeft: Math.round(rect.left),
            rectTop: Math.round(rect.top),
            rectWidth: Math.round(rect.width),
            reason: 'not-ready',
        };
    }, cardId), { timeout: 15000, intervals: [100, 200, 500] }).toMatchObject({ ready: true });

    await page.waitForTimeout(500);
    return spotlight;
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

async function cloneAbilityCard(cardId: string): Promise<Record<string, any>> {
    const card = MONK_CARDS.find((nextCard) => nextCard.id === cardId);
    if (!card) {
        throw new Error(`未找到 ${cardId}`);
    }
    return JSON.parse(JSON.stringify(card));
}

async function closeCardSpotlightIfVisible(page: Page): Promise<void> {
    const spotlight = page.locator('[data-testid="card-spotlight-overlay"]');
    if (!await spotlight.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        return;
    }

    await expect(spotlight).toHaveCount(0, { timeout: 7000 });
}

async function dismissBlockingBonusPresentation(page: Page): Promise<void> {
    await closeCardSpotlightIfVisible(page);
}

async function clickConfirmForPlayer(page: Page, playerId: string): Promise<void> {
    const confirmButton = page
        .locator(`[data-player-seat-anchor="${playerId}"]`)
        .getByRole('button', { name: /确认|Confirm/i })
        .last();
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();
}

test('一掷千金奖励骰显示在右侧骰盘并可确认', async ({ browser }, testInfo) => {
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
        injectedCore.players['0'].resources.cp = 2;
        injectedCore.players['0'].resources.hp = 50;
        injectedCore.players['0'].hand = [];
        injectedCore.players['1'].resources.cp = 3;
        injectedCore.players['1'].resources.hp = 40;
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

        const hostCardSpotlight = await waitForCardSpotlightVisualReady(hostPage, 'card-one-throw-fortune');
        const hostSpotlightDice = hostPage.locator('[data-testid="card-spotlight-die"]');
        await expect(hostSpotlightDice).toHaveCount(0, { timeout: 5000 });
        await expect(hostPage.locator('[data-testid="bonus-die-overlay"]')).toHaveCount(0);
        await expect(hostCardSpotlight).toHaveAttribute('data-card-id', 'card-one-throw-fortune');
        const hostInitialResultSummary = hostCardSpotlight.locator('[data-testid="card-spotlight-summary-text"]').first();
        await expect(hostInitialResultSummary).toBeVisible({ timeout: 5000 });
        await expect(hostInitialResultSummary).toHaveAttribute('data-effect-key', 'bonusDie.spotlight.initialGainCp');
        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '01-一掷千金卡牌特写保留但无骰子特写', { requireChineseName: true }),
            fullPage: false,
        });

        const readBonusTraySnapshot = async () => guestPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const firstDie = Array.isArray(settlement?.dice) ? settlement.dice[0] : undefined;
            return {
                settlementSource: settlement?.sourceAbilityId ?? null,
                bonusValue: firstDie?.value ?? null,
                bonusCp: firstDie?.effectParams?.cp ?? null,
                allowDiceModification: settlement?.allowDiceModification ?? null,
                windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                guestCp: state?.core?.players?.['1']?.resources?.cp ?? null,
                lastEventTypes: (state?.sys?.eventStream?.entries ?? []).slice(-6).map((entry: any) => entry.event?.type),
            };
        });

        await expect.poll(readBonusTraySnapshot, { timeout: 15000 }).toMatchObject({
            settlementSource: 'card-one-throw-fortune',
            bonusValue: expect.any(Number),
            bonusCp: expect.any(Number),
            allowDiceModification: true,
            windowType: null,
            guestCp: 3,
        });
        const openedBonusSnapshot = await readBonusTraySnapshot();
        const initialBonusValue = openedBonusSnapshot.bonusValue;
        expect(Number.isInteger(initialBonusValue)).toBe(true);
        expect(openedBonusSnapshot.bonusCp).toBe(Math.ceil(initialBonusValue / 2));
        expect(openedBonusSnapshot.lastEventTypes).toContain('CARD_PLAYED');
        expect(openedBonusSnapshot.lastEventTypes).toContain('BONUS_DIE_ROLLED');

        const guestDiceTray = guestPage.locator('[data-player-seat-anchor="1"] [data-tutorial-id="dice-tray"]').first();
        await expect(guestDiceTray).toBeVisible({ timeout: 5000 });
        const bonusDieButton = guestDiceTray.locator('[data-testid="die-button-0"]').first();
        await expect(bonusDieButton).toBeVisible({ timeout: 5000 });
        await expect(bonusDieButton).toHaveAttribute('data-owner-id', '1', { timeout: 5000 });
        await expect(bonusDieButton).toHaveAttribute('data-display-only', 'true', { timeout: 5000 });
        await expect(bonusDieButton).toHaveAttribute('data-display-value', String(initialBonusValue), { timeout: 5000 });
        await expect(guestPage.locator('[data-testid="bonus-die-overlay"]')).toHaveCount(0);

        const confirmBonusButton = guestPage.locator('[data-player-seat-anchor="1"] [data-testid="bonus-dice-confirm-button"]').first();
        await expect(confirmBonusButton).toBeEnabled({ timeout: 5000 });
        await closeCardSpotlightIfVisible(guestPage);
        await expect(guestPage.locator('[data-testid="card-spotlight-overlay"]')).toHaveCount(0, { timeout: 5000 });
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '02-一掷千金奖励骰-右侧骰盘独立显示并可确认', { requireChineseName: true }),
            fullPage: false,
        });

        await confirmBonusButton.click();
        await expect.poll(async () => guestPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return {
                guestCp: state?.core?.players?.['1']?.resources?.cp ?? null,
                pendingSettlement: state?.core?.pendingBonusDiceSettlement ? 'present' : 'none',
                guestDiscardIds: (state?.core?.players?.['1']?.discard ?? []).map((card: any) => card.id),
            };
        }), { timeout: 10000 }).toMatchObject({
            guestCp: 3 + Math.ceil(initialBonusValue / 2),
            pendingSettlement: 'none',
            guestDiscardIds: ['card-one-throw-fortune'],
        });
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '03-一掷千金奖励骰-右侧确认后获得CP', { requireChineseName: true }),
            fullPage: false,
        });
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});

test('一掷千金奖励骰结算前会给弹一手真实介入窗口', async ({ browser }, testInfo) => {
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

        const oneThrowFortune = await cloneAbilityCard('card-one-throw-fortune');
        const flick = await cloneAbilityCard('card-flick');
        const guestStartingCp = 5;

        const coreState = await readCoreState(hostPage) as Record<string, any>;
        const injectedCore = JSON.parse(JSON.stringify(coreState));
        injectedCore.activePlayerId = '1';
        injectedCore.rollCount = 0;
        injectedCore.rollConfirmed = false;
        injectedCore.pendingAttack = null;
        injectedCore.pendingBonusDiceSettlement = undefined;
        injectedCore.players['0'].resources.cp = 2;
        injectedCore.players['0'].resources.hp = 50;
        injectedCore.players['0'].hand = [flick];
        injectedCore.players['1'].resources.cp = guestStartingCp;
        injectedCore.players['1'].resources.hp = 40;
        injectedCore.players['1'].hand = [oneThrowFortune];

        await applyCoreStateDirect(hostPage, injectedCore);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return state?.sys?.phase === 'main1'
                && state?.core?.activePlayerId === '1'
                && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-flick');
        }, { timeout: 15000 });
        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return state?.sys?.phase === 'main1'
                && state?.core?.activePlayerId === '1'
                && state?.core?.players?.['1']?.hand?.some((card: any) => card.id === 'card-one-throw-fortune');
        }, { timeout: 15000 });

        await waitForHandCardVisualReady(hostPage, 'card-flick');
        await waitForHandCardVisualReady(guestPage, 'card-one-throw-fortune');

        await dragHandCardToPlay(guestPage, 'card-one-throw-fortune');

        const readBonusResponseSnapshot = async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const windowState = state?.sys?.responseWindow?.current;
            const firstDie = Array.isArray(settlement?.dice) ? settlement.dice[0] : undefined;
            return {
                settlementSource: settlement?.sourceAbilityId ?? null,
                bonusValue: firstDie?.value ?? null,
                bonusCp: firstDie?.effectParams?.cp ?? null,
                allowDiceModification: settlement?.allowDiceModification ?? null,
                windowType: windowState?.windowType ?? null,
                responderQueue: windowState?.responderQueue ?? null,
                currentResponderId: windowState?.responderQueue?.[windowState.currentResponderIndex] ?? null,
            };
        });

        await expect.poll(readBonusResponseSnapshot, { timeout: 15000 }).toMatchObject({
            settlementSource: 'card-one-throw-fortune',
            bonusValue: expect.any(Number),
            bonusCp: expect.any(Number),
            allowDiceModification: true,
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
            currentResponderId: '0',
        });
        const openedBonusSnapshot = await readBonusResponseSnapshot();
        const initialBonusValue = openedBonusSnapshot.bonusValue;
        expect(Number.isInteger(initialBonusValue)).toBe(true);
        expect(initialBonusValue).toBeGreaterThanOrEqual(1);
        expect(initialBonusValue).toBeLessThanOrEqual(6);
        expect(openedBonusSnapshot.bonusCp).toBe(Math.ceil(initialBonusValue / 2));
        const shouldIncrementBonusDie = initialBonusValue < 6 && (initialBonusValue === 1 || initialBonusValue % 2 === 0);
        const modifiedBonusValue = initialBonusValue + (shouldIncrementBonusDie ? 1 : -1);
        const modifiedBonusCp = Math.ceil(modifiedBonusValue / 2);

        await expect(hostPage.locator('[data-testid="bonus-die-overlay"]')).toHaveCount(0);
        await expect(guestPage.locator('[data-testid="bonus-die-overlay"]')).toHaveCount(0);
        await expect(hostPage.locator('[data-testid="card-spotlight-die"]')).toHaveCount(0, { timeout: 5000 });

        const guestDiceTrayDuringResponse = guestPage.locator('[data-player-seat-anchor="1"] [data-tutorial-id="dice-tray"]').first();
        await expect(guestDiceTrayDuringResponse).toBeVisible({ timeout: 5000 });
        const guestBonusDieDuringResponse = guestDiceTrayDuringResponse.locator('[data-testid="die-button-0"]').first();
        await expect(guestBonusDieDuringResponse).toBeVisible({ timeout: 5000 });
        await expect(guestBonusDieDuringResponse).toHaveAttribute('data-display-value', String(initialBonusValue), { timeout: 5000 });
        const guestConfirmDuringResponse = guestPage.locator('[data-player-seat-anchor="1"] [data-testid="bonus-dice-confirm-button"]').first();
        await expect(guestConfirmDuringResponse).toBeDisabled({ timeout: 5000 });
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '04a-一掷千金奖励骰-响应窗口期间攻击方右侧确认禁用', { requireChineseName: true }),
            fullPage: false,
        });

        await dismissBlockingBonusPresentation(hostPage);
        const flickCard = hostPage.locator('[data-testid="hand-area"] [data-card-id="card-flick"]').first();
        await expect(flickCard).toBeVisible({ timeout: 10000 });
        await expect(hostPage.getByRole('button', { name: /跳过|Pass/i }).first()).toBeVisible({ timeout: 5000 });
        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '04-一掷千金奖励骰-弹一手响应窗口可见', { requireChineseName: true }),
            fullPage: false,
        });

        await dragHandCardToPlay(hostPage, 'card-flick');

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            const interaction = state?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                interactionKind: interaction?.kind ?? null,
                interactionPlayerId: interaction?.playerId ?? null,
                dtType: meta?.dtType ?? null,
                mode: meta?.dieModifyConfig?.mode ?? null,
                targetOpponentDice: meta?.targetOpponentDice ?? null,
                diceOwnerId: meta?.diceOwnerId ?? null,
                allowedDieIds: interaction?.data?.allowedDieIds ?? null,
                pendingInteractionId: state?.sys?.responseWindow?.current?.pendingInteractionId ?? null,
            };
        }), { timeout: 10000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            interactionPlayerId: '0',
            dtType: 'modifyDie',
            mode: 'adjust',
            targetOpponentDice: true,
            diceOwnerId: '1',
            allowedDieIds: [0],
        });

        const diceTray = hostPage.locator('[data-tutorial-id="dice-tray"]').first();
        await expect(diceTray).toBeVisible({ timeout: 5000 });
        const bonusDieButton = diceTray.locator('[data-testid="die-button-0"]').first();
        await expect(bonusDieButton).toBeVisible({ timeout: 5000 });
        await expect(bonusDieButton).toHaveAttribute('data-owner-id', '1', { timeout: 5000 });
        await expect(bonusDieButton).toHaveAttribute('data-clickable', 'true', { timeout: 5000 });
        await expect(bonusDieButton).toHaveAttribute('data-display-value', String(initialBonusValue), { timeout: 5000 });
        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '05-一掷千金奖励骰-弹一手选择奖励骰', { requireChineseName: true }),
            fullPage: false,
        });

        const adjustButton = diceTray
            .getByTestId(shouldIncrementBonusDie ? 'die-adjust-increment-0' : 'die-adjust-decrement-0')
            .first();
        await expect(adjustButton).toBeEnabled({ timeout: 5000 });
        await expect(adjustButton.locator('xpath=ancestor::*[@data-tutorial-id="dice-tray"][1]')).toHaveCount(1);
        await adjustButton.click();
        await expect(bonusDieButton).toHaveAttribute('data-display-value', String(modifiedBonusValue), { timeout: 5000 });
        await expect(bonusDieButton).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '06-一掷千金奖励骰-弹一手已改骰', { requireChineseName: true }),
            fullPage: false,
        });

        await clickConfirmForPlayer(hostPage, '0');

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const firstDie = Array.isArray(settlement?.dice) ? settlement.dice[0] : undefined;
            return {
                bonusValue: firstDie?.value ?? null,
                bonusCp: firstDie?.effectParams?.cp ?? null,
                customResolutionId: settlement?.customResolutionId ?? null,
                attackerId: settlement?.attackerId ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                hostDiscardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
            };
        }), { timeout: 10000 }).toMatchObject({
            bonusValue: modifiedBonusValue,
            bonusCp: modifiedBonusCp,
            customResolutionId: 'one-throw-fortune-cp',
            attackerId: '1',
            interactionKind: null,
            windowType: null,
            hostDiscardIds: ['card-flick'],
        });

        await closeCardSpotlightIfVisible(guestPage);
        await expect(guestPage.locator('[data-testid="bonus-die-overlay"]')).toHaveCount(0);
        const guestDiceTrayAfterFlick = guestPage.locator('[data-player-seat-anchor="1"] [data-tutorial-id="dice-tray"]').first();
        await expect(guestDiceTrayAfterFlick).toBeVisible({ timeout: 5000 });
        const guestBonusDieAfterFlick = guestDiceTrayAfterFlick.locator('[data-testid="die-button-0"]').first();
        await expect(guestBonusDieAfterFlick).toHaveAttribute('data-display-value', String(modifiedBonusValue), { timeout: 5000 });
        await expect(guestBonusDieAfterFlick).toHaveAttribute('data-display-only', 'true', { timeout: 5000 });
        const guestConfirmAfterFlick = guestPage.locator('[data-player-seat-anchor="1"] [data-testid="bonus-dice-confirm-button"]').first();
        await expect(guestConfirmAfterFlick).toBeEnabled({ timeout: 5000 });
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '07-一掷千金奖励骰-攻击方右侧确认可用', { requireChineseName: true }),
            fullPage: false,
        });
        await guestConfirmAfterFlick.click();

        await expect.poll(async () => guestPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return {
                guestCp: state?.core?.players?.['1']?.resources?.cp ?? null,
                pendingSettlement: state?.core?.pendingBonusDiceSettlement ? 'present' : 'none',
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                guestDiscardIds: (state?.core?.players?.['1']?.discard ?? []).map((card: any) => card.id),
            };
        }), { timeout: 10000 }).toMatchObject({
            guestCp: guestStartingCp + modifiedBonusCp,
            pendingSettlement: 'none',
            interactionKind: null,
            windowType: null,
            guestDiscardIds: ['card-one-throw-fortune'],
        });

        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '08-一掷千金奖励骰-按修改后获得CP', { requireChineseName: true }),
            fullPage: false,
        });
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});
