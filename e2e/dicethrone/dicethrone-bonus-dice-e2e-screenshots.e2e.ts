import type { Browser, BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath, withJpegEvidenceScreenshotOptions } from '../framework/evidenceScreenshots';
import { waitForTestHarness } from '../helpers/common';
import {
    dispatchDiceThroneCommand,
    ensureDebugPanelClosed,
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
    await page.waitForTimeout(450);
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
            await screenshotStep(hostPage, testInfo, '01-万箭齐发-攻击已选且手牌可见');

            await setDiceThroneBonusDiceValues(hostPage, [1, 2, 3, 4, 5]);
            await dismissAttackShowcaseIfVisible(guestPage);
            await dragHandCardToPlay(hostPage, 'volley');
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
            await expectNoCentralBonusDicePresentation(guestPage);
            await screenshotStep(guestPage, testInfo, '04-万箭齐发-弹一手选择奖励骰改前');

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
            await expectNoCentralBonusDicePresentation(guestPage);
            await screenshotStep(guestPage, testInfo, '05-万箭齐发-弹一手已修改奖励骰');

            await dispatch(guestPage, 'SYS_INTERACTION_CONFIRM', '1');
            const volleyAfterValues = volleyBeforeSnapshot.diceValues
                .map((value, index) => (index === volleyChoice.dieIndex ? volleyChoice.afterValue : value));
            await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 10000 }).toMatchObject({
                windowType: null,
                diceValues: volleyAfterValues,
            });
            await expect(dieButton(hostPage, volleyChoice.dieIndex))
                .toHaveAttribute('data-display-value', String(volleyChoice.afterValue), { timeout: 5000 });
            await expectRightTrayBonusDiceConfirmation(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'volley',
            });
            await expect(hostPage.getByTestId('restore-covered-roll-button')).toHaveCount(0);
            await screenshotStep(hostPage, testInfo, '06-万箭齐发-改后奖励骰等待攻击方确认');

            await settleCurrentBonusDice(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'volley',
            });
            await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 10000 }).toMatchObject({
                sourceAbilityId: null,
                pendingAttackBonusDamage: volleyChoice.afterBowCount,
                defenderEntangle: 1,
            });
            await closeCardSpotlightIfVisible(hostPage);
            await hostPage.waitForTimeout(900);
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
            await setDiceThroneBonusDiceValues(hostPage, [4, 5, 6]);
            await dismissAttackShowcaseIfVisible(guestPage);
            await dispatch(hostPage, 'ADVANCE_PHASE', '0');
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
            await expectNoCentralBonusDicePresentation(guestPage);
            await screenshotStep(guestPage, testInfo, '04-雷霆万钧-弹一手选择奖励骰改前');

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
            await expectNoCentralBonusDicePresentation(guestPage);
            await screenshotStep(guestPage, testInfo, '05-雷霆万钧-弹一手已修改奖励骰');

            await dispatch(guestPage, 'SYS_INTERACTION_CONFIRM', '1');
            const thunderAfterValues = thunderBeforeSnapshot.diceValues
                .map((value, index) => (index === thunderChoice.dieIndex ? thunderChoice.afterValue : value));
            await expect.poll(() => readVisibleBonusSnapshot(hostPage), { timeout: 10000 }).toMatchObject({
                windowType: null,
                diceValues: thunderAfterValues,
            });
            await expectRightTrayBonusDiceConfirmation(hostPage, () => readMatchState(hostPage) as Promise<MutableCore>, {
                sourceAbilityId: 'thunder-strike',
            });
            await expect(hostPage.getByTestId('restore-covered-roll-button')).toHaveCount(0);
            await screenshotStep(hostPage, testInfo, '06-雷霆万钧-改后奖励骰等待攻击方确认');

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
