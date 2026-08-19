import type { Browser, BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath, withJpegEvidenceScreenshotOptions } from '../framework/evidenceScreenshots';
import { waitForTestHarness } from '../helpers/common';
import {
    dispatchDiceThroneCommand,
    ensureDebugPanelClosed,
    maybePassResponse,
    readyAndStartGame,
    readMatchState,
    selectCharacter,
    setupDTOnlineMatch,
    setDiceThroneBonusDiceValues,
    waitForGameBoard,
    waitForDiceThroneHarness,
} from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { COMMON_CARDS } from '../../src/games/dicethrone/domain/commonCards';
import { MOON_ELF_CARDS } from '../../src/games/dicethrone/heroes/moon_elf/cards';
import {
    expectNoCentralBonusDicePresentation,
    expectRightTrayBonusDiceInterferenceView,
    expectRightTrayBonusDiceConfirmation,
    settleCurrentBonusDice,
} from './bonus-dice-flow';

const DICETHRONE_ONLINE_TEST_TIMEOUT_MS = 600000;

type MutableCore = Record<string, any>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const MOON_ELF_BOW_VALUES = new Set([1, 2, 3]);
const moonElfFaceForValue = (value: number) => (value <= 3 ? 'bow' : value <= 5 ? 'foot' : 'moon');
const monkFaceForValue = (value: number) => (value <= 2 ? 'fist' : value === 3 ? 'palm' : value <= 5 ? 'taiji' : 'lotus');

const getCard = (cardId: string): Record<string, any> => {
    const card = [...COMMON_CARDS, ...MOON_ELF_CARDS].find((nextCard) => nextCard.id === cardId);
    if (!card) {
        throw new Error(`未找到卡牌 ${cardId}`);
    }
    return clone(card) as Record<string, any>;
};

async function screenshotStep(
    page: Page,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
    name: string,
): Promise<string> {
    await expectNoCentralBonusDicePresentation(page);
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({ path, fullPage: false, timeout: 20000 }));
    return path;
}

async function openActionLogPanel(page: Page) {
    const panel = page.locator('[data-testid="fab-panel-action-log"]').first();
    if (await panel.isVisible().catch(() => false)) {
        return panel;
    }

    const actionLogButton = page.locator('[data-fab-id="action-log"]').first();
    if (!await actionLogButton.isVisible().catch(() => false)) {
        for (const selector of ['[data-fab-id="chat"]', '[data-fab-id="exit"]', '[data-testid="fab-menu"] [data-fab-id]']) {
            const mainButton = page.locator(selector).first();
            if (await mainButton.isVisible().catch(() => false)) {
                await mainButton.click();
                if (await actionLogButton.isVisible({ timeout: 1200 }).catch(() => false)) {
                    break;
                }
            }
        }
    }

    await expect(actionLogButton).toBeVisible({ timeout: 10000 });
    await actionLogButton.click();
    await expect(panel).toBeVisible({ timeout: 10000 });
    return panel;
}

async function closeActionLogPanel(page: Page): Promise<void> {
    const panel = page.locator('[data-testid="fab-panel-action-log"]').first();
    if (!await panel.isVisible().catch(() => false)) {
        return;
    }
    const actionLogButton = page.locator('[data-fab-id="action-log"]').first();
    await expect(actionLogButton).toBeVisible({ timeout: 5000 });
    await actionLogButton.click();
    await expect(panel).toBeHidden({ timeout: 10000 });
}

async function readActionLogRowTexts(page: Page): Promise<string[]> {
    await openActionLogPanel(page);
    const rows = page.locator('[data-testid="hud-action-log-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const texts = (await rows.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
    await closeActionLogPanel(page);
    return texts;
}

async function screenshotActionLogPanel(
    page: Page,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
    name: string,
): Promise<string> {
    const panel = await openActionLogPanel(page);
    await expect(page.locator('[data-testid="hud-action-log-row"]').first()).toBeVisible({ timeout: 10000 });
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await panel.screenshot(withJpegEvidenceScreenshotOptions({ path, timeout: 20000 }));
    await closeActionLogPanel(page);
    return path;
}

async function readBonusActionLogEntries(page: Page) {
    return page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.actionLog?.entries ?? [];
        return entries
            .filter((entry: any) => (
                entry?.kind === 'BONUS_DIE_ROLLED'
                || entry?.kind === 'BONUS_DICE_SETTLED'
                || entry?.kind === 'CARD_ROLL_RESULT'
            ))
            .map((entry: any) => ({
                kind: entry.kind,
                keys: (entry.segments ?? [])
                    .filter((segment: any) => segment?.type === 'i18n')
                    .map((segment: any) => segment.key),
                diceValues: (entry.segments ?? [])
                    .filter((segment: any) => segment?.type === 'diceResult')
                    .flatMap((segment: any) => (
                        Array.isArray(segment.dice)
                            ? segment.dice.map((die: any) => (typeof die === 'number' ? die : die?.value))
                            : []
                    )),
            }));
    });
}

async function expectVolleyActionLogPendingOnly(page: Page, forbiddenBowCounts: number[]): Promise<void> {
    const entries = await readBonusActionLogEntries(page);
    expect(entries.some((entry: any) => (
        entry.kind === 'BONUS_DIE_ROLLED'
        && entry.keys.includes('actionLog.bonusDiceRolled')
    )), `奖励骰待确认时必须只写“掷出”日志，实际=${JSON.stringify(entries)}`).toBe(true);
    expect(entries.some((entry: any) => entry.kind === 'BONUS_DICE_SETTLED')).toBe(false);
    expect(entries.some((entry: any) => entry.keys.includes('bonusDie.effect.volley.result'))).toBe(false);

    const visibleLog = (await readActionLogRowTexts(page)).join('\n');
    expect(visibleLog).toContain('奖励骰掷出');
    expect(visibleLog).not.toContain('奖励骰确认结果');
    for (const bowCount of forbiddenBowCounts) {
        expect(visibleLog).not.toContain(`${bowCount} 个弓面`);
    }
}

async function expectVolleyActionLogSettled(
    page: Page,
    finalDiceValues: number[],
    finalBowCount: number,
): Promise<void> {
    const entries = await readBonusActionLogEntries(page);
    expect(entries.some((entry: any) => (
        entry.kind === 'BONUS_DICE_SETTLED'
        && entry.keys.includes('actionLog.bonusDiceSettled')
        && entry.keys.includes('bonusDie.effect.volley.result')
        && JSON.stringify(entry.diceValues) === JSON.stringify(finalDiceValues)
    )), `奖励骰确认后必须按最终骰面写最终结果日志，实际=${JSON.stringify(entries)}`).toBe(true);

    const visibleLog = (await readActionLogRowTexts(page)).join('\n');
    expect(visibleLog).toContain('奖励骰确认结果');
    expect(visibleLog).toContain(`${finalBowCount} 个弓面`);
}

async function dispatch(page: Page, type: string, playerId: string, payload: Record<string, unknown> = {}) {
    await dispatchDiceThroneCommand(page, { type, playerId, payload });
    await page.waitForTimeout(350);
}

async function updateOnlineCoreState(matchId: string, page: Page, mutate: (core: MutableCore) => void) {
    const currentState = clone(await getMatchState(matchId, page) as MutableCore);
    const root = currentState.G && typeof currentState.G === 'object' ? currentState.G : currentState;
    const core = clone(root.core ?? {}) as MutableCore;
    mutate(core);
    root.core = {
        ...core,
        phase: typeof core.phase === 'string' ? core.phase : root.sys?.phase,
    };
    root.sys = {
        ...(root.sys ?? {}),
        matchId,
        turnOrder: Array.isArray(root.sys?.turnOrder)
            ? root.sys.turnOrder
            : Array.isArray(core.turnOrder)
                ? core.turnOrder
                : Object.keys(core.players ?? {}),
        currentPlayerIndex: typeof root.sys?.currentPlayerIndex === 'number'
            ? root.sys.currentPlayerIndex
            : Math.max(0, (Array.isArray(core.turnOrder) ? core.turnOrder : Object.keys(core.players ?? {}))
                .indexOf(core.activePlayerId ?? '0')),
    };
    await injectMatchState(matchId, currentState, page);
    await page.waitForTimeout(700);
}

async function updateCoreState(matchId: string, page: Page, mutate: (core: MutableCore) => void) {
    await updateOnlineCoreState(matchId, page, mutate);
}

async function readResponseHintViewportGeometry(page: Page) {
    return page.evaluate(() => {
        const hint = document.querySelector<HTMLElement>('[data-testid="dicethrone-response-window-hint"]');
        const hand = document.querySelector<HTMLElement>('[data-testid="hand-area"]');
        const diceTray = document.querySelector<HTMLElement>('[data-testid="dicethrone-2d-dice-tray"]');
        if (!hint) return null;
        const hintRect = hint.getBoundingClientRect();
        const diceTrayRect = diceTray?.getBoundingClientRect() ?? null;
        const cardRects = hand ? Array.from(hand.querySelectorAll<HTMLElement>('[data-card-id]'))
            .map((card) => card.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? card)
            .map((card) => card.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => rect.top) : [];
        const hoveredCard = hand?.querySelector<HTMLElement>('[data-card-id]:hover') ?? null;
        const hoveredCardVisual = hoveredCard?.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? hoveredCard;
        return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            hintCenterX: hintRect.left + hintRect.width / 2,
            hintTop: hintRect.top,
            hintBottom: hintRect.bottom,
            hintBottomInset: window.innerHeight - hintRect.bottom,
            position: getComputedStyle(hint).position,
            anchor: hint.dataset.anchor ?? null,
            placement: hint.dataset.placement ?? null,
            visibleHandTop: cardRects.length > 0 ? Math.min(...cardRects) : null,
            hoveredHandTop: hoveredCardVisual?.getBoundingClientRect().top ?? null,
            overlapsDiceTray: Boolean(diceTrayRect
                && hintRect.right > diceTrayRect.left
                && hintRect.left < diceTrayRect.right
                && hintRect.bottom > diceTrayRect.top
                && hintRect.top < diceTrayRect.bottom),
        };
    });
}

async function assertResponseHintFixedHandLiftSlot(page: Page): Promise<NonNullable<Awaited<ReturnType<typeof readResponseHintViewportGeometry>>>> {
    const geometry = await readResponseHintViewportGeometry(page);
    expect(geometry).not.toBeNull();
    expect(geometry!.position).toBe('fixed');
    expect(geometry!.anchor).toBe('viewport');
    expect(geometry!.placement).toBe('fixed-hand-lift-slot');
    expect(Math.abs(geometry!.hintCenterX - geometry!.viewportWidth / 2)).toBeLessThan(4);
    expect(geometry!.hintTop).toBeGreaterThan(0);
    expect(geometry!.hintBottom).toBeLessThan(geometry!.viewportHeight);
    expect(geometry!.overlapsDiceTray, '响应提示不能进入右侧骰盘或遮挡骰子').toBe(false);
    expect(geometry!.hintBottom, '响应条应靠近手牌抬起区，不能回到牌桌正中央').toBeGreaterThan(geometry!.viewportHeight * 0.50);
    expect(geometry!.hintBottomInset).toBeGreaterThan(128);
    return geometry!;
}

async function assertResponseHintStableDuringHandHover(
    page: Page,
    cardId: string,
): Promise<void> {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    const initialGeometry = await assertResponseHintFixedHandLiftSlot(page);

    await card.hover();
    await page.waitForTimeout(520);

    const hoveredGeometry = await readResponseHintViewportGeometry(page);
    expect(hoveredGeometry).not.toBeNull();
    expect(hoveredGeometry!.hoveredHandTop, '悬浮手牌应抬起，但响应条不能跟随抬高').not.toBeNull();
    expect(initialGeometry.visibleHandTop, '测试场景必须有可见手牌用于制造 hover 扰动').not.toBeNull();
    expect(hoveredGeometry!.hoveredHandTop!).toBeLessThan(initialGeometry.visibleHandTop! - 20);
    expect(hoveredGeometry!.position).toBe('fixed');
    expect(hoveredGeometry!.anchor).toBe('viewport');
    expect(hoveredGeometry!.placement).toBe('fixed-hand-lift-slot');
    expect(hoveredGeometry!.overlapsDiceTray, '悬浮手牌后响应提示仍不能进入右侧骰盘').toBe(false);
    expect(Math.abs(hoveredGeometry!.hintTop - initialGeometry.hintTop)).toBeLessThan(2);
    expect(Math.abs(hoveredGeometry!.hintBottom - initialGeometry.hintBottom)).toBeLessThan(2);
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
    await page.waitForTimeout(700);
}

async function closeCardSpotlightIfVisible(page: Page): Promise<void> {
    const spotlight = page.locator('[data-testid="card-spotlight-overlay"]');
    if (!await spotlight.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        return;
    }

    await expect(spotlight).toHaveCount(0, { timeout: 8000 });
}

async function dismissAttackShowcaseIfVisible(page: Page): Promise<void> {
    const attackShowcase = page.getByTestId('attack-showcase-overlay').first();
    if (!await attackShowcase.isVisible({ timeout: 1500 }).catch(() => false)) {
        return;
    }

    const continueButton = attackShowcase.getByRole('button', { name: /开始防御|继续|Defend|Continue/i }).first();
    await expect(continueButton).toBeVisible({ timeout: 5000 });
    await continueButton.click();
    await expect(page.getByTestId('attack-showcase-overlay')).toHaveCount(0, { timeout: 8000 });
}

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    await expect(handCard).toHaveAttribute('data-can-drag', 'true', { timeout: 10000 });
    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        const startX = rect.x + (rect.width / 2);
        const startY = rect.y + (rect.height * 0.78);
        const hit = document.elementFromPoint(startX, startY) as HTMLElement | null;
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            hitCardId: hit?.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null,
        };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0 || cardBox.hitCardId !== cardId) {
        throw new Error(`未能获取手牌 ${cardId} 的真实拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    const draggedCardBox = await handCard.boundingBox();
    if (!draggedCardBox || cardBox.y - draggedCardBox.y < 150) {
        throw new Error(`手牌 ${cardId} 没有真实拖出到打出距离`);
    }
    await page.mouse.up();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(450);
}

async function readPlayedCardAndBonusState(page: Page, cardId: string, playerId: string) {
    return page.evaluate(({ expectedCardId, expectedPlayerId }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const player = state?.core?.players?.[expectedPlayerId] ?? {};
        const entries = state?.sys?.eventStream?.entries ?? [];
        const responseWindow = state?.sys?.responseWindow?.current;
        const responderQueue = Array.isArray(responseWindow?.responderQueue)
            ? responseWindow.responderQueue
            : [];
        const currentResponderIndex = Number.isInteger(responseWindow?.currentResponderIndex)
            ? responseWindow.currentResponderIndex
            : 0;
        return {
            handContains: Array.isArray(player?.hand)
                ? player.hand.some((card: any) => card?.id === expectedCardId)
                : null,
            discardContains: Array.isArray(player?.discard)
                ? player.discard.some((card: any) => card?.id === expectedCardId)
                : null,
            cardPlayedEvent: entries.some((entry: any) => (
                entry?.event?.type === 'CARD_PLAYED'
                && entry?.event?.payload?.playerId === expectedPlayerId
                && entry?.event?.payload?.cardId === expectedCardId
            )),
            sourceAbilityId: state?.core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null,
            customResolutionId: state?.core?.pendingBonusDiceSettlement?.customResolutionId ?? null,
            bonusDiceCount: Array.isArray(state?.core?.pendingBonusDiceSettlement?.dice)
                ? state.core.pendingBonusDiceSettlement.dice.length
                : 0,
            windowType: responseWindow?.windowType ?? null,
            currentResponderId: responderQueue[currentResponderIndex] ?? null,
            recentEvents: entries.slice(-8).map((entry: any) => ({
                type: entry?.event?.type,
                payload: entry?.event?.payload,
            })),
        };
    }, { expectedCardId: cardId, expectedPlayerId: playerId });
}

async function waitForAttackModifierBonusDiceReady(page: Page, cardId: string, playerId: string): Promise<void> {
    await expect.poll(
        () => readPlayedCardAndBonusState(page, cardId, playerId),
        {
            message: `${cardId} 必须真实打出：手牌移除、进弃牌堆、事件流记录 CARD_PLAYED，并创建右侧奖励骰骰盘`,
            timeout: 15000,
        },
    ).toMatchObject({
        handContains: false,
        discardContains: true,
        cardPlayedEvent: true,
        sourceAbilityId: cardId,
        customResolutionId: 'moon-elf-volley',
        bonusDiceCount: 5,
        windowType: null,
    });
}

async function setupTwoPageDicethrone(
    browser: Browser,
    baseURL: string | undefined,
    characters: { host: string; guest: string },
) {
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup?.guestPage || !setup.guestContext) {
        return null;
    }

    await enableManualBonusDiceResponse(setup.hostContext, setup.hostPage);
    await enableManualBonusDiceResponse(setup.guestContext, setup.guestPage);
    await selectCharacter(setup.hostPage, characters.host);
    await selectCharacter(setup.guestPage, characters.guest);
    await readyAndStartGame(setup.hostPage, setup.guestPage);
    await waitForGameBoard(setup.hostPage);
    await waitForGameBoard(setup.guestPage);
    await waitForDiceThroneHarness(setup.hostPage, 10000);
    await waitForDiceThroneHarness(setup.guestPage, 10000);
    await waitForTestHarness(setup.hostPage, 10000);
    await waitForTestHarness(setup.guestPage, 10000);
    await ensureDebugPanelClosed(setup.hostPage);
    await ensureDebugPanelClosed(setup.guestPage);

    return setup;
}

async function enableManualBonusDiceResponse(context: BrowserContext, page: Page) {
    const setPreferences = () => {
        localStorage.setItem('dicethrone:autoResponse', 'true');
    };
    await context.addInitScript(setPreferences);
    await page.evaluate(setPreferences);
}

async function readVisibleBonusSnapshot(page: Page) {
    return page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const settlement = state?.core?.pendingBonusDiceSettlement;
        const windowState = state?.sys?.responseWindow?.current;
        const damageBadge = document.querySelector<HTMLElement>('[data-testid="current-total-damage-badge"]');
        const readNumber = (value: string | undefined): number | null => {
            if (value === undefined || value === '') return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };
        return {
            phase: state?.sys?.phase ?? null,
            sourceAbilityId: settlement?.sourceAbilityId ?? null,
            customResolutionId: settlement?.customResolutionId ?? null,
            allowDiceModification: settlement?.allowDiceModification ?? null,
            windowType: windowState?.windowType ?? null,
            currentResponderId: Array.isArray(windowState?.responderQueue)
                ? windowState.responderQueue[windowState.currentResponderIndex]
                : null,
            diceValues: Array.isArray(settlement?.dice) ? settlement.dice.map((die: any) => die.value) : [],
            diceFaces: Array.isArray(settlement?.dice) ? settlement.dice.map((die: any) => die.face) : [],
            pendingAttackBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
            defenderHp: state?.core?.players?.['1']?.resources?.hp
                ?? state?.core?.players?.['1']?.resources?.HP
                ?? null,
            defenderEntangle: state?.core?.players?.['1']?.statusEffects?.entangle
                ?? state?.core?.players?.['1']?.tokens?.entangle
                ?? 0,
            currentTotalDamageBadge: damageBadge
                ? {
                    currentDamage: readNumber(damageBadge.dataset.currentDamage),
                    originalDamage: readNumber(damageBadge.dataset.originalDamage),
                    text: damageBadge.textContent?.replace(/\s+/g, ' ').trim() ?? '',
                }
                : null,
            interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
            allowedDieIds: state?.sys?.interaction?.current?.data?.allowedDieIds ?? null,
        };
    });
}

async function hasPendingBonusDieModifiedEvent(page: Page, oldValue: number, newValue: number): Promise<boolean> {
    return page.evaluate(({ expectedOldValue, expectedNewValue }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.eventStream?.entries ?? [];
        return entries.some((entry: any) => (
            entry?.event?.type === 'DIE_MODIFIED'
            && entry?.event?.payload?.target === 'pendingBonusDie'
            && entry?.event?.payload?.oldValue === expectedOldValue
            && entry?.event?.payload?.newValue === expectedNewValue
        ));
    }, { expectedOldValue: oldValue, expectedNewValue: newValue });
}

function chooseVolleyBoundaryDie(snapshot: Awaited<ReturnType<typeof readVisibleBonusSnapshot>>) {
    const indexWithThree = snapshot.diceValues.findIndex((value) => value === 3);
    if (indexWithThree >= 0) {
        return {
            dieIndex: indexWithThree,
            beforeValue: 3,
            afterValue: 4,
            direction: 'increment' as const,
            beforeBowCount: snapshot.diceValues.filter((value) => MOON_ELF_BOW_VALUES.has(value)).length,
            afterBowCount: snapshot.diceValues
                .map((value, index) => (index === indexWithThree ? 4 : value))
                .filter((value) => MOON_ELF_BOW_VALUES.has(value)).length,
        };
    }

    const indexWithFour = snapshot.diceValues.findIndex((value) => value === 4);
    if (indexWithFour >= 0) {
        return {
            dieIndex: indexWithFour,
            beforeValue: 4,
            afterValue: 3,
            direction: 'decrement' as const,
            beforeBowCount: snapshot.diceValues.filter((value) => MOON_ELF_BOW_VALUES.has(value)).length,
            afterBowCount: snapshot.diceValues
                .map((value, index) => (index === indexWithFour ? 3 : value))
                .filter((value) => MOON_ELF_BOW_VALUES.has(value)).length,
        };
    }

    throw new Error(`万箭齐发奖励骰没有可用的一步边界骰（3↔4），实际值：${snapshot.diceValues.join(',')}`);
}

function chooseThunderDie(snapshot: Awaited<ReturnType<typeof readVisibleBonusSnapshot>>) {
    const dieIndex = snapshot.diceValues.findIndex((value) => value === 6);
    if (dieIndex >= 0) {
        const beforeValue = snapshot.diceValues[dieIndex];
        return {
            dieIndex,
            beforeValue,
            afterValue: beforeValue - 1,
            direction: 'decrement' as const,
            beforeTotal: snapshot.diceValues.reduce((sum, value) => sum + value, 0),
            afterTotal: snapshot.diceValues.reduce((sum, value, index) => sum + (index === dieIndex ? beforeValue - 1 : value), 0),
        };
    }

    const fallbackDieIndex = snapshot.diceValues.findIndex((value) => value > 1);
    if (fallbackDieIndex >= 0) {
        const beforeValue = snapshot.diceValues[fallbackDieIndex];
        return {
            dieIndex: fallbackDieIndex,
            beforeValue,
            afterValue: beforeValue - 1,
            direction: 'decrement' as const,
            beforeTotal: snapshot.diceValues.reduce((sum, value) => sum + value, 0),
            afterTotal: snapshot.diceValues.reduce((sum, value, index) => sum + (index === fallbackDieIndex ? beforeValue - 1 : value), 0),
        };
    }

    return {
        dieIndex: 0,
        beforeValue: snapshot.diceValues[0],
        afterValue: snapshot.diceValues[0] + 1,
        direction: 'increment' as const,
        beforeTotal: snapshot.diceValues.reduce((sum, value) => sum + value, 0),
        afterTotal: snapshot.diceValues.reduce((sum, value, index) => sum + (index === 0 ? value + 1 : value), 0),
    };
}

async function normalizePendingBonusDice(
    matchId: string,
    page: Page,
    diceValues: number[],
    faceForValue: (value: number) => string,
) {
    await updateCoreState(matchId, page, (core) => {
        const settlement = core.pendingBonusDiceSettlement;
        if (!settlement) {
            throw new Error('当前没有待确认的奖励骰结算');
        }
        const previousDice = Array.isArray(settlement.dice) ? settlement.dice : [];
        settlement.dice = diceValues.map((value, index) => ({
            ...(previousDice[index] ?? {}),
            index,
            value,
            face: faceForValue(value),
            effectParams: {
                ...(previousDice[index]?.effectParams ?? {}),
                value,
            },
        }));
        if (settlement.customResolutionId === 'moon-elf-volley' || settlement.sourceAbilityId === 'volley') {
            const bowCount = diceValues.filter((value) => MOON_ELF_BOW_VALUES.has(value)).length;
            settlement.summaryEffectKey = 'bonusDie.effect.volley.result';
            settlement.summaryEffectParams = {
                ...(settlement.summaryEffectParams ?? {}),
                bowCount,
                bonusDamage: bowCount,
            };
        }
        if (core.currentRollContext && Array.isArray(core.currentRollContext.dice)) {
            core.currentRollContext = {
                ...core.currentRollContext,
                dice: core.currentRollContext.dice.map((die: Record<string, unknown>, index: number) => {
                    const value = diceValues[index] ?? Number(die.value ?? 1);
                    const face = faceForValue(value);
                    return {
                        ...die,
                        value,
                        symbol: face,
                        symbols: [face],
                        isKept: false,
                    };
                }),
            };
        }
    });
    await ensureDebugPanelClosed(page);
    await page.waitForTimeout(350);
}

async function normalizeCurrentDice(
    matchId: string,
    page: Page,
    diceValues: number[],
    faceForValue: (value: number) => string,
) {
    await updateCoreState(matchId, page, (core) => {
        const previousDice = Array.isArray(core.dice) ? core.dice : [];
        const normalizedDice = previousDice.map((die: Record<string, unknown>, index: number) => {
            const value = diceValues[index] ?? Number(die.value ?? 1);
            const face = faceForValue(value);
            return {
                ...die,
                value,
                symbol: face,
                symbols: [face],
                isKept: false,
            };
        });
        core.dice = normalizedDice;
        if (core.currentRollContext && Array.isArray(core.currentRollContext.dice)) {
            core.currentRollContext = {
                ...core.currentRollContext,
                dice: normalizedDice,
            };
        }
        core.rollConfirmed = true;
    });
    await ensureDebugPanelClosed(page);
    await page.waitForTimeout(350);
}

async function getThunderStrikeSlot(page: Page) {
    const byResolvedAbility = page.locator('[data-ability-slot][data-resolved-ability-id="thunder-strike"]').first();
    if (await byResolvedAbility.isVisible({ timeout: 2000 }).catch(() => false)) {
        return byResolvedAbility;
    }
    return page.locator('[data-ability-slot="lotus"]').first();
}

function dieButton(page: Page, dieIndex: number) {
    return page.locator(`[data-testid="die-button-${dieIndex}"][data-owner-id="0"]:visible`).first();
}

test.describe('DiceThrone 奖励骰被弹一手改骰后的结算截图链', () => {
    test('万箭齐发：弹一手修改奖励骰后按改后弓面数加伤并施加缠绕', async ({ browser }, testInfo) => {
        test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);
        await clearEvidenceScreenshotsForTest(testInfo);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPageDicethrone(browser, baseURL, { host: 'moon_elf', guest: 'barbarian' });
        if (!setup) {
            test.skip(true, 'online setup unavailable in current environment');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            await updateCoreState(setup.matchId, hostPage, (core) => {
                core.players['0'].hand = [];
                core.players['0'].resources.cp = 5;
                core.players['0'].resources.CP = 5;
                core.players['0'].resources.hp = 50;
                core.players['0'].resources.HP = 50;
                core.players['1'].hand = [];
                core.players['1'].resources.cp = 5;
                core.players['1'].resources.CP = 5;
                core.players['1'].resources.hp = 50;
                core.players['1'].resources.HP = 50;
                core.players['1'].statusEffects = {};
                core.activePlayerId = '0';
                core.pendingBonusDiceSettlement = undefined;
                core.pendingDamage = null;
            });
            await ensureDebugPanelClosed(hostPage);
            await ensureDebugPanelClosed(guestPage);

            await dispatch(hostPage, 'ADVANCE_PHASE', '0');
            await dispatch(hostPage, 'ROLL_DICE', '0');
            await dispatch(hostPage, 'CONFIRM_ROLL', '0');
            await normalizeCurrentDice(setup.matchId, hostPage, [1, 1, 1, 1, 4], moonElfFaceForValue);
            await dispatch(hostPage, 'SELECT_ABILITY', '0', { abilityId: 'longbow' });

            await updateCoreState(setup.matchId, hostPage, (core) => {
                core.players['0'].hand = [getCard('volley')];
                core.players['1'].hand = [getCard('card-flick')];
                core.pendingAttack = {
                    ...(core.pendingAttack ?? {}),
                    attackerId: '0',
                    defenderId: '1',
                    settlementStage: core.pendingAttack?.settlementStage ?? 'preDamage',
                    isDefendable: false,
                    sourceAbilityId: core.pendingAttack?.sourceAbilityId ?? 'longbow',
                    isUltimate: core.pendingAttack?.isUltimate ?? false,
                    damageResolved: core.pendingAttack?.damageResolved ?? false,
                    resolvedDamage: core.pendingAttack?.resolvedDamage ?? 0,
                    attackDiceFaceCounts: core.pendingAttack?.attackDiceFaceCounts ?? { bow: 4, foot: 1 },
                    attackDiceValues: core.pendingAttack?.attackDiceValues ?? [1, 1, 1, 1, 4],
                    damage: core.pendingAttack?.damage ?? 5,
                    bonusDamage: core.pendingAttack?.bonusDamage ?? 0,
                    attackModifierBonusDamage: core.pendingAttack?.attackModifierBonusDamage ?? 0,
                };
            });
            await ensureDebugPanelClosed(hostPage);
            await ensureDebugPanelClosed(guestPage);

            await expect.poll(async () => hostPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
                return {
                    phase: state?.sys?.phase ?? null,
                    pendingAttack: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                    isDefendable: state?.core?.pendingAttack?.isDefendable ?? null,
                    hostHand: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                    guestHand: (state?.core?.players?.['1']?.hand ?? []).map((card: any) => card.id),
                };
            }), { timeout: 10000 }).toMatchObject({
                phase: 'offensiveRoll',
                pendingAttack: 'longbow',
                isDefendable: false,
                hostHand: ['volley'],
                guestHand: ['card-flick'],
            });

            await waitForHandCardVisualReady(hostPage, 'volley');
            await expect(hostPage.getByText('该技能当前不可用', { exact: true })).toHaveCount(0, { timeout: 5000 });
            await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 5000 }).toMatchObject({
                currentTotalDamageBadge: {
                    currentDamage: 5,
                    originalDamage: 5,
                },
            });
            await screenshotStep(hostPage, testInfo, '01-万箭齐发-攻击已选且手牌可见');

            const longbowResponse = await readVisibleBonusSnapshot(guestPage);
            if (longbowResponse.currentResponderId === '1') {
                const responsePassed = await maybePassResponse(guestPage, 5000);
                expect(responsePassed, '长弓选定后的防御方响应窗口必须先真实让过，攻击方才可打万箭齐发').toBe(true);
                await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 10000 }).toMatchObject({
                    currentResponderId: null,
                });
            }

            await setDiceThroneBonusDiceValues(hostPage, [1, 2, 3, 4, 5]);
            await dismissAttackShowcaseIfVisible(guestPage);
            await dragHandCardToPlay(hostPage, 'volley');
            await waitForAttackModifierBonusDiceReady(hostPage, 'volley', '0');
            await dismissAttackShowcaseIfVisible(guestPage);
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 15000 }).toMatchObject({
                sourceAbilityId: 'volley',
                customResolutionId: 'moon-elf-volley',
                allowDiceModification: true,
                windowType: null,
            });
            await expectRightTrayBonusDiceConfirmation(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'volley',
            });
            await expectRightTrayBonusDiceInterferenceView(guestPage, () => readMatchState(guestPage) as Promise<MutableCore>, {
                sourceAbilityId: 'volley',
            });
            await screenshotStep(guestPage, testInfo, '02-万箭齐发-无中央特写且右侧2D奖励骰盘可见');
            await normalizePendingBonusDice(setup.matchId, hostPage, [1, 2, 3, 4, 5], moonElfFaceForValue);
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 10000 }).toMatchObject({
                diceValues: [1, 2, 3, 4, 5],
            });
            const volleyBeforeSnapshot = await readVisibleBonusSnapshot(guestPage);
            const volleyChoice = chooseVolleyBoundaryDie(volleyBeforeSnapshot);
            expect(volleyChoice.beforeBowCount).not.toBe(volleyChoice.afterBowCount);
            await closeCardSpotlightIfVisible(guestPage);
            await expectRightTrayBonusDiceInterferenceView(guestPage, () => readMatchState(guestPage) as Promise<MutableCore>, {
                sourceAbilityId: 'volley',
            });
            await waitForHandCardVisualReady(guestPage, 'card-flick');
            await screenshotStep(guestPage, testInfo, '03-万箭齐发-防御方可直接用手牌介入奖励骰');

            await dispatch(guestPage, 'PLAY_CARD', '1', { cardId: 'card-flick' });
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 10000 }).toMatchObject({
                interactionKind: 'multistep-choice',
                interactionPlayerId: '1',
                allowedDieIds: [0, 1, 2, 3, 4],
            });
            const selectedVolleyDie = dieButton(guestPage, volleyChoice.dieIndex);
            await expect(selectedVolleyDie).toBeVisible({ timeout: 5000 });
            await expect(selectedVolleyDie).toHaveAttribute('data-owner-id', '0', { timeout: 5000 });
            await expect(selectedVolleyDie).toHaveAttribute('data-clickable', 'true', { timeout: 5000 });
            await expect(selectedVolleyDie).toHaveAttribute('data-display-value', String(volleyChoice.beforeValue), { timeout: 5000 });
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 5000 }).toMatchObject({
                currentTotalDamageBadge: {
                    currentDamage: 5 + volleyChoice.beforeBowCount,
                    originalDamage: 5,
                },
            });
            await expectNoCentralBonusDicePresentation(guestPage);
            await screenshotStep(guestPage, testInfo, '04-万箭齐发-弹一手选择奖励骰改前且总伤害按当前弓面显示');

            await dispatch(guestPage, 'MODIFY_DIE', '1', {
                dieId: volleyChoice.dieIndex,
                newValue: volleyChoice.afterValue,
            });
            await expect(selectedVolleyDie).toHaveAttribute('data-display-value', String(volleyChoice.afterValue), { timeout: 5000 });
            await expect.poll(() => hasPendingBonusDieModifiedEvent(
                guestPage,
                volleyChoice.beforeValue,
                volleyChoice.afterValue,
            ), { timeout: 5000 }).toBe(true);
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 5000 }).toMatchObject({
                currentTotalDamageBadge: {
                    currentDamage: 5 + volleyChoice.afterBowCount,
                    originalDamage: 5,
                },
            });
            await expectNoCentralBonusDicePresentation(guestPage);
            await screenshotStep(guestPage, testInfo, '05-万箭齐发-弹一手已修改奖励骰且总伤害实时变化');

            await dispatch(guestPage, 'SYS_INTERACTION_CONFIRM', '1');
            const volleyAfterValues = volleyBeforeSnapshot.diceValues
                .map((value, index) => (index === volleyChoice.dieIndex ? volleyChoice.afterValue : value));
            await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 10000 }).toMatchObject({
                windowType: null,
                diceValues: volleyAfterValues,
                currentTotalDamageBadge: {
                    currentDamage: 5 + volleyChoice.afterBowCount,
                    originalDamage: 5,
                },
            });
            await expect(dieButton(hostPage, volleyChoice.dieIndex))
                .toHaveAttribute('data-display-value', String(volleyChoice.afterValue), { timeout: 5000 });
            await expectRightTrayBonusDiceConfirmation(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'volley',
            });
            await expect(hostPage.getByTestId('restore-covered-roll-button')).toHaveCount(0);
            await expectVolleyActionLogPendingOnly(hostPage, [
                volleyChoice.beforeBowCount,
                volleyChoice.afterBowCount,
            ]);
            await screenshotActionLogPanel(hostPage, testInfo, '06A-万箭齐发-确认前日志只显示奖励骰掷出不显示最终结果');
            await screenshotStep(hostPage, testInfo, '06-万箭齐发-改后奖励骰等待攻击方确认且总伤害已更新');

            await settleCurrentBonusDice(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'volley',
            });
            await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 10000 }).toMatchObject({
                sourceAbilityId: null,
                pendingAttackBonusDamage: volleyChoice.afterBowCount,
                defenderEntangle: 1,
                currentTotalDamageBadge: {
                    currentDamage: 5 + volleyChoice.afterBowCount,
                    originalDamage: 5,
                },
            });
            await closeCardSpotlightIfVisible(hostPage);
            await hostPage.waitForTimeout(900);
            await expectVolleyActionLogSettled(hostPage, volleyAfterValues, volleyChoice.afterBowCount);
            await screenshotActionLogPanel(hostPage, testInfo, '07A-万箭齐发-确认后日志按改后奖励骰写最终结果');
            await screenshotStep(hostPage, testInfo, '07-万箭齐发-改后弓面数已写入加伤并施加缠绕');
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('武僧雷霆万钧：弹一手修改奖励骰后按改后点数和造成伤害', async ({ browser }, testInfo) => {
        test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);
        await clearEvidenceScreenshotsForTest(testInfo);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPageDicethrone(browser, baseURL, { host: 'monk', guest: 'barbarian' });
        if (!setup) {
            test.skip(true, 'online setup unavailable in current environment');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            await updateCoreState(setup.matchId, hostPage, (core) => {
                core.players['0'].hand = [];
                core.players['0'].tokens = {};
                core.players['0'].resources.cp = 0;
                core.players['0'].resources.CP = 0;
                core.players['0'].resources.hp = 50;
                core.players['0'].resources.HP = 50;
                core.players['1'].hand = [];
                core.players['1'].tokens = {};
                core.players['1'].resources.cp = 5;
                core.players['1'].resources.CP = 5;
                core.players['1'].resources.hp = 50;
                core.players['1'].resources.HP = 50;
                core.activePlayerId = '0';
                core.pendingBonusDiceSettlement = undefined;
                core.pendingDamage = null;
            });
            await ensureDebugPanelClosed(hostPage);
            await ensureDebugPanelClosed(guestPage);

            await dispatch(hostPage, 'ADVANCE_PHASE', '0');
            await dispatch(hostPage, 'ROLL_DICE', '0');
            await dispatch(hostPage, 'CONFIRM_ROLL', '0');
            await normalizeCurrentDice(setup.matchId, hostPage, [3, 3, 3, 1, 1], monkFaceForValue);
            const thunderStrikeSlot = await getThunderStrikeSlot(hostPage);
            await expect(thunderStrikeSlot).toBeVisible({ timeout: 10000 });
            await expect(thunderStrikeSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await screenshotStep(hostPage, testInfo, '01-雷霆万钧-三掌骰面已确认技能可选');

            await dispatch(hostPage, 'SELECT_ABILITY', '0', { abilityId: 'thunder-strike' });
            await updateCoreState(setup.matchId, hostPage, (core) => {
                core.players['1'].hand = [getCard('card-flick')];
                core.players['1'].resources.cp = 5;
                core.players['1'].resources.CP = 5;
                core.pendingAttack = {
                    ...(core.pendingAttack ?? {}),
                    attackerId: '0',
                    defenderId: '1',
                    settlementStage: core.pendingAttack?.settlementStage ?? 'preDamage',
                    isDefendable: false,
                    sourceAbilityId: core.pendingAttack?.sourceAbilityId ?? 'thunder-strike',
                    isUltimate: core.pendingAttack?.isUltimate ?? false,
                    damageResolved: core.pendingAttack?.damageResolved ?? false,
                    resolvedDamage: core.pendingAttack?.resolvedDamage ?? 0,
                    attackDiceFaceCounts: core.pendingAttack?.attackDiceFaceCounts ?? { palm: 3, fist: 2 },
                    attackDiceValues: core.pendingAttack?.attackDiceValues ?? [3, 3, 3, 1, 1],
                    damage: core.pendingAttack?.damage ?? 0,
                    bonusDamage: core.pendingAttack?.bonusDamage ?? 0,
                    attackModifierBonusDamage: core.pendingAttack?.attackModifierBonusDamage ?? 0,
                };
            });
            await ensureDebugPanelClosed(hostPage);
            await ensureDebugPanelClosed(guestPage);
            await screenshotStep(hostPage, testInfo, '02-雷霆万钧-技能已触发并让对手持有弹一手');

            const preBonusResponse = await readVisibleBonusSnapshot(guestPage);
            if (preBonusResponse.currentResponderId === '1') {
                await dispatch(guestPage, 'RESPONSE_PASS', '1');
            }
            await dispatch(hostPage, 'ADVANCE_PHASE', '0');
            await dismissAttackShowcaseIfVisible(guestPage);

            await setDiceThroneBonusDiceValues(guestPage, [1, 1, 1, 1, 1]);
            await dispatch(guestPage, 'ROLL_DICE', '1');
            await dispatch(guestPage, 'CONFIRM_ROLL', '1');
            const defenseResponse = await readVisibleBonusSnapshot(guestPage);
            if (defenseResponse.currentResponderId === '1') {
                await dispatch(guestPage, 'RESPONSE_PASS', '1');
            }

            await setDiceThroneBonusDiceValues(guestPage, [4, 5, 6]);
            await dispatch(guestPage, 'ADVANCE_PHASE', '1');
            await dismissAttackShowcaseIfVisible(guestPage);

            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 15000 }).toMatchObject({
                sourceAbilityId: 'thunder-strike',
                allowDiceModification: true,
                windowType: null,
            });
            await expectRightTrayBonusDiceConfirmation(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'thunder-strike',
            });
            await normalizePendingBonusDice(setup.matchId, hostPage, [4, 5, 6], monkFaceForValue);
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 10000 }).toMatchObject({
                diceValues: [4, 5, 6],
            });
            const thunderBeforeSnapshot = await readVisibleBonusSnapshot(guestPage);
            const thunderChoice = chooseThunderDie(thunderBeforeSnapshot);
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 5000 }).toMatchObject({
                currentTotalDamageBadge: {
                    currentDamage: thunderChoice.beforeTotal,
                    originalDamage: 0,
                },
            });
            await expectRightTrayBonusDiceInterferenceView(guestPage, () => readMatchState(guestPage) as Promise<MutableCore>, {
                sourceAbilityId: 'thunder-strike',
            });
            await waitForHandCardVisualReady(guestPage, 'card-flick');
            await screenshotStep(guestPage, testInfo, '03-雷霆万钧-防御方可直接用手牌介入奖励骰');

            await dispatch(guestPage, 'PLAY_CARD', '1', { cardId: 'card-flick' });
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 10000 }).toMatchObject({
                interactionKind: 'multistep-choice',
                interactionPlayerId: '1',
                allowedDieIds: [0, 1, 2],
            });
            const selectedThunderDie = dieButton(guestPage, thunderChoice.dieIndex);
            await expect(selectedThunderDie).toBeVisible({ timeout: 5000 });
            await expect(selectedThunderDie).toHaveAttribute('data-owner-id', '0', { timeout: 5000 });
            await expect(selectedThunderDie).toHaveAttribute('data-clickable', 'true', { timeout: 5000 });
            await expect(selectedThunderDie).toHaveAttribute('data-display-value', String(thunderChoice.beforeValue), { timeout: 5000 });
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 5000 }).toMatchObject({
                currentTotalDamageBadge: {
                    currentDamage: thunderChoice.beforeTotal,
                    originalDamage: 0,
                },
            });
            await expectNoCentralBonusDicePresentation(guestPage);
            await screenshotStep(guestPage, testInfo, '04-雷霆万钧-弹一手选择奖励骰改前且总伤害按当前点数和显示');

            await dispatch(guestPage, 'MODIFY_DIE', '1', {
                dieId: thunderChoice.dieIndex,
                newValue: thunderChoice.afterValue,
            });
            await expect(selectedThunderDie).toHaveAttribute('data-display-value', String(thunderChoice.afterValue), { timeout: 5000 });
            await expect.poll(() => hasPendingBonusDieModifiedEvent(
                guestPage,
                thunderChoice.beforeValue,
                thunderChoice.afterValue,
            ), { timeout: 5000 }).toBe(true);
            await expect.poll(() => readVisibleBonusSnapshot(guestPage), { timeout: 5000 }).toMatchObject({
                currentTotalDamageBadge: {
                    currentDamage: thunderChoice.afterTotal,
                    originalDamage: 0,
                },
            });
            await expectNoCentralBonusDicePresentation(guestPage);
            await screenshotStep(guestPage, testInfo, '05-雷霆万钧-弹一手已修改奖励骰且总伤害实时变化');

            await dispatch(guestPage, 'SYS_INTERACTION_CONFIRM', '1');
            const thunderAfterValues = thunderBeforeSnapshot.diceValues
                .map((value, index) => (index === thunderChoice.dieIndex ? thunderChoice.afterValue : value));
            await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 10000 }).toMatchObject({
                windowType: null,
                diceValues: thunderAfterValues,
                currentTotalDamageBadge: {
                    currentDamage: thunderChoice.afterTotal,
                    originalDamage: 0,
                },
            });
            await expectRightTrayBonusDiceConfirmation(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'thunder-strike',
            });
            await expect(hostPage.getByTestId('restore-covered-roll-button')).toHaveCount(0);
            await screenshotStep(hostPage, testInfo, '06-雷霆万钧-改后奖励骰等待攻击方确认且总伤害已更新');

            await settleCurrentBonusDice(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'thunder-strike',
            });
            await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 10000 }).toMatchObject({
                phase: 'main2',
                sourceAbilityId: null,
                defenderHp: 50 - thunderChoice.afterTotal,
            });
            await closeCardSpotlightIfVisible(hostPage);
            await hostPage.waitForTimeout(900);
            await screenshotStep(hostPage, testInfo, '07-雷霆万钧-按改后点数和造成伤害');
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });
});
