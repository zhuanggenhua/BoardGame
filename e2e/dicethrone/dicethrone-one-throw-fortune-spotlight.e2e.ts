import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    applyCoreStateDirect,
    ensureDebugPanelClosed,
    readyAndStartGame,
    readCoreState,
    readMatchState,
    selectCharacter,
    setupDTOnlineMatch,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { MONK_CARDS } from '../../src/games/dicethrone/heroes/monk/cards';
import {
    expectRightTrayBonusDiceAwaitingResponse,
    expectRightTrayBonusDiceConfirmation,
    getRightTrayDie,
    settleCurrentBonusDice,
} from './bonus-dice-flow';

const DICETHRONE_ONLINE_TEST_TIMEOUT_MS = 240000;

async function enableManualBonusDiceResponse(page: Page): Promise<void> {
    const toggle = page.getByTestId('bonus-dice-response-toggle');
    await expect(toggle).toBeVisible({ timeout: 5000 });
    if (await toggle.getAttribute('aria-pressed') !== 'true') {
        await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
}

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

test('一掷千金没有合法改骰响应时仍等待右侧骰盘普通确认', async ({ browser }, testInfo) => {
    test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);

    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 90000,
    });
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
        const guestStartingCp = 3;
        injectedCore.players['1'].resources.cp = guestStartingCp;
        injectedCore.players['1'].resources.hp = 40;
        injectedCore.players['1'].hand = [JSON.parse(JSON.stringify(oneThrowFortune))];

        await applyCoreStateDirect(hostPage, injectedCore);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        await expect.poll(async () => {
            const state = await readMatchState(guestPage) as Record<string, any>;
            return state?.sys?.phase === 'main1'
                && state?.core?.activePlayerId === '1'
                && state?.core?.players?.['1']?.hand?.some((card: any) => card.id === 'card-one-throw-fortune');
        }, { timeout: 15000 }).toBe(true);
        await ensureDebugPanelClosed(guestPage);

        await waitForHandCardVisualReady(guestPage, 'card-one-throw-fortune');
        await dragHandCardToPlay(guestPage, 'card-one-throw-fortune');

        const readBonusTraySnapshot = async () => {
            const state = await readMatchState(guestPage) as Record<string, any>;
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const firstDie = Array.isArray(settlement?.dice) ? settlement.dice[0] : undefined;
            return {
                settlementSource: settlement?.sourceAbilityId ?? null,
                bonusValue: firstDie?.value ?? null,
                bonusCp: firstDie?.effectParams?.cp ?? null,
                allowDiceModification: settlement?.allowDiceModification ?? null,
                windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                currentRollKind: state?.core?.currentRollContext?.kind ?? null,
                phase: state?.sys?.phase ?? null,
                activePlayerId: state?.core?.activePlayerId ?? null,
                guestCp: state?.core?.players?.['1']?.resources?.cp ?? null,
                guestDiscardIds: (state?.core?.players?.['1']?.discard ?? []).map((card: any) => card.id),
                lastEventTypes: (state?.sys?.eventStream?.entries ?? []).slice(-6).map((entry: any) => entry.event?.type),
            };
        };

        await expect.poll(readBonusTraySnapshot, { timeout: 15000 }).toMatchObject({
            settlementSource: 'card-one-throw-fortune',
            bonusValue: expect.any(Number),
            bonusCp: expect.any(Number),
            allowDiceModification: true,
            windowType: null,
            currentRollKind: 'bonus',
            phase: 'main1',
            activePlayerId: '1',
            guestCp: guestStartingCp,
            guestDiscardIds: ['card-one-throw-fortune'],
        });
        const pendingBonusSnapshot = await readBonusTraySnapshot();
        expect(pendingBonusSnapshot.bonusValue).toBeGreaterThanOrEqual(1);
        expect(pendingBonusSnapshot.bonusValue).toBeLessThanOrEqual(6);
        expect(pendingBonusSnapshot.bonusCp).toBe(Math.ceil(pendingBonusSnapshot.bonusValue / 2));
        expect(pendingBonusSnapshot.lastEventTypes).toContain('CARD_PLAYED');
        expect(pendingBonusSnapshot.lastEventTypes).toContain('BONUS_DIE_ROLLED');
        expect(pendingBonusSnapshot.lastEventTypes).not.toContain('BONUS_DICE_SETTLED');

        await dismissBlockingBonusPresentation(guestPage);
        await expect(guestPage.locator('[data-testid="card-spotlight-overlay"]')).toHaveCount(0, { timeout: 5000 });
        await expectRightTrayBonusDiceConfirmation(
            guestPage,
            () => readMatchState(guestPage) as Promise<Record<string, any>>,
            { sourceAbilityId: 'card-one-throw-fortune' },
        );
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '02-一掷千金奖励骰-无响应等待右侧骰盘普通确认', { requireChineseName: true }),
            fullPage: false,
        });

        await settleCurrentBonusDice(
            guestPage,
            () => readMatchState(guestPage) as Promise<Record<string, any>>,
            { sourceAbilityId: 'card-one-throw-fortune' },
        );
        await expect.poll(readBonusTraySnapshot, { timeout: 10000 }).toMatchObject({
            settlementSource: null,
            bonusValue: null,
            bonusCp: null,
            currentRollKind: 'bonus',
            phase: 'main1',
            activePlayerId: '1',
            guestCp: guestStartingCp + pendingBonusSnapshot.bonusCp,
            guestDiscardIds: ['card-one-throw-fortune'],
        });
        const confirmedBonusSnapshot = await readBonusTraySnapshot();
        expect(confirmedBonusSnapshot.lastEventTypes).toContain('BONUS_DICE_SETTLED');
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '03-一掷千金奖励骰-普通确认后CP才落地', { requireChineseName: true }),
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
    const setup = await setupDTOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 90000,
    });
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
        await enableManualBonusDiceResponse(hostPage);
        await enableManualBonusDiceResponse(guestPage);

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

        await expect.poll(async () => {
            const state = await readMatchState(hostPage) as Record<string, any>;
            return state?.sys?.phase === 'main1'
                && state?.core?.activePlayerId === '1'
                && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-flick');
        }, { timeout: 15000 }).toBe(true);
        await expect.poll(async () => {
            const state = await readMatchState(guestPage) as Record<string, any>;
            return state?.sys?.phase === 'main1'
                && state?.core?.activePlayerId === '1'
                && state?.core?.players?.['1']?.hand?.some((card: any) => card.id === 'card-one-throw-fortune');
        }, { timeout: 15000 }).toBe(true);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        await waitForHandCardVisualReady(hostPage, 'card-flick');
        await waitForHandCardVisualReady(guestPage, 'card-one-throw-fortune');

        await dragHandCardToPlay(guestPage, 'card-one-throw-fortune');

        const readBonusResponseSnapshot = async () => {
            const [hostState, guestState] = await Promise.all([
                readMatchState(hostPage) as Promise<Record<string, any>>,
                readMatchState(guestPage) as Promise<Record<string, any>>,
            ]);
            const settlement = guestState?.core?.pendingBonusDiceSettlement;
            const windowState = hostState?.sys?.responseWindow?.current;
            const firstDie = Array.isArray(settlement?.dice) ? settlement.dice[0] : undefined;
            return {
                settlementSource: settlement?.sourceAbilityId ?? null,
                bonusValue: firstDie?.value ?? null,
                bonusCp: firstDie?.effectParams?.cp ?? null,
                allowDiceModification: settlement?.allowDiceModification ?? null,
                windowType: windowState?.windowType ?? null,
                responderQueue: windowState?.responderQueue ?? null,
                currentResponderId: windowState?.responderQueue?.[windowState.currentResponderIndex] ?? null,
                currentRollContext: guestState?.core?.currentRollContext?.kind ?? null,
                eventTypes: (guestState?.sys?.eventStream?.entries ?? []).slice(-10).map((entry: any) => entry.event?.type),
            };
        };

        await expect.poll(readBonusResponseSnapshot, { timeout: 15000 }).toMatchObject({
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
            currentResponderId: '0',
        });
        const openedBonusSnapshot = await readBonusResponseSnapshot();
        expect(openedBonusSnapshot.settlementSource).toBe('card-one-throw-fortune');
        expect(openedBonusSnapshot.bonusValue).toEqual(expect.any(Number));
        expect(openedBonusSnapshot.bonusCp).toEqual(expect.any(Number));
        expect(openedBonusSnapshot.allowDiceModification).toBe(true);
        const initialBonusValue = openedBonusSnapshot.bonusValue;
        expect(Number.isInteger(initialBonusValue)).toBe(true);
        expect(initialBonusValue).toBeGreaterThanOrEqual(1);
        expect(initialBonusValue).toBeLessThanOrEqual(6);
        expect(openedBonusSnapshot.bonusCp).toBe(Math.ceil(initialBonusValue / 2));
        const shouldIncrementBonusDie = initialBonusValue < 6 && (initialBonusValue === 1 || initialBonusValue % 2 === 0);
        const modifiedBonusValue = initialBonusValue + (shouldIncrementBonusDie ? 1 : -1);
        const modifiedBonusCp = Math.ceil(modifiedBonusValue / 2);

        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);
        await expectRightTrayBonusDiceAwaitingResponse(guestPage, () => readMatchState(guestPage) as Promise<Record<string, any>>, {
            sourceAbilityId: 'card-one-throw-fortune',
        });
        const guestBonusDieDuringResponse = getRightTrayDie(guestPage, 0);
        await expect(guestBonusDieDuringResponse).toBeVisible({ timeout: 5000 });
        await expect(guestBonusDieDuringResponse).toHaveAttribute('data-display-value', String(initialBonusValue), { timeout: 5000 });
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '04a-一掷千金奖励骰-响应窗口期间无确认入口', { requireChineseName: true }),
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

        await expect.poll(async () => {
            const state = await readMatchState(hostPage) as Record<string, any>;
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
        }, { timeout: 10000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            interactionPlayerId: '0',
            dtType: 'modifyDie',
            mode: 'adjust',
            targetOpponentDice: true,
            diceOwnerId: '1',
            allowedDieIds: [0],
        });
        await ensureDebugPanelClosed(hostPage);

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

        const confirmModifyButton = hostPage.getByTestId('dice-interaction-confirm-button').first();
        await expect(confirmModifyButton).toBeEnabled({ timeout: 10000 });
        await expect(confirmModifyButton).toHaveText(/^(确认|Confirm)$/);
        await confirmModifyButton.click();

        await expect.poll(async () => {
            const state = await readMatchState(hostPage) as Record<string, any>;
            return {
                pendingSettlement: state?.core?.pendingBonusDiceSettlement ? 'present' : 'none',
                currentRollKind: state?.core?.currentRollContext?.kind ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                hostDiscardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
                guestCp: state?.core?.players?.['1']?.resources?.cp ?? null,
                guestDiscardIds: (state?.core?.players?.['1']?.discard ?? []).map((card: any) => card.id),
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: 'present',
            currentRollKind: 'bonus',
            interactionKind: 'dt:bonus-dice',
            interactionPlayerId: '1',
            windowType: null,
            hostDiscardIds: ['card-flick'],
            guestCp: guestStartingCp,
            guestDiscardIds: ['card-one-throw-fortune'],
        });
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);
        await dismissBlockingBonusPresentation(guestPage);
        await expectRightTrayBonusDiceConfirmation(guestPage, () => readMatchState(guestPage) as Promise<Record<string, any>>, {
            sourceAbilityId: 'card-one-throw-fortune',
        });

        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '07-一掷千金奖励骰-改骰后仍等待骰主普通确认', { requireChineseName: true }),
            fullPage: false,
        });
        await settleCurrentBonusDice(guestPage, () => readMatchState(guestPage) as Promise<Record<string, any>>, {
            sourceAbilityId: 'card-one-throw-fortune',
        });
        await expect.poll(async () => {
            const state = await readMatchState(guestPage) as Record<string, any>;
            return {
                pendingSettlement: state?.core?.pendingBonusDiceSettlement ? 'present' : 'none',
                currentRollKind: state?.core?.currentRollContext?.kind ?? null,
                guestCp: state?.core?.players?.['1']?.resources?.cp ?? null,
                guestDiscardIds: (state?.core?.players?.['1']?.discard ?? []).map((card: any) => card.id),
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingSettlement: 'none',
            currentRollKind: 'bonus',
            guestCp: guestStartingCp + modifiedBonusCp,
            guestDiscardIds: ['card-one-throw-fortune'],
        });
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '08-一掷千金奖励骰-普通确认后按最终骰面结算', { requireChineseName: true }),
            fullPage: false,
        });
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});
