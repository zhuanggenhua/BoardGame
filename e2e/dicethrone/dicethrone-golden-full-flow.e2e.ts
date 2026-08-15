import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import {
    applyDiceValues,
    cleanupDTMatch,
    dispatchDiceThroneCommand,
    ensureDebugPanelClosed,
    maybePassResponse,
    readyAndStartGame,
    selectCharacter,
    setDiceThroneBonusDiceValues,
    setupDTOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { COMMON_CARDS } from '../../src/games/dicethrone/domain/commonCards';
import { MOON_ELF_CARDS } from '../../src/games/dicethrone/heroes/moon_elf/cards';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import {
    expectRightTrayBonusDiceAwaitingResponse,
    expectRightTrayBonusDiceConfirmation,
    settleCurrentBonusDice,
} from './bonus-dice-flow';

const OPEN_TIMEOUT_MS = 180000;
const TEST_TIMEOUT_MS = 480000;
const GOLDEN_TEST_NAME = 'DiceThrone 黄金全流程：覆盖开局、卖牌换CP、攻骰改骰、攻击修正奖励骰、防御响应、伤害、弃牌和回合交接';
const EXPECTED_LONGBOW_ATTACK_ID = 'longbow-4-1';
const MOON_ELF_BOW_VALUES = new Set([1, 2, 3]);
const moonElfFaceForValue = (value: number) => (value <= 3 ? 'bow' : value <= 5 ? 'foot' : 'moon');

type MutableRecord = Record<string, any>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const getGoldenCard = (cardId: string): MutableRecord => {
    const card = [...COMMON_CARDS, ...MOON_ELF_CARDS].find((candidate) => candidate.id === cardId);
    if (!card) {
        throw new Error(`DiceThrone 黄金链缺少卡牌：${cardId}`);
    }
    return clone(card) as MutableRecord;
};

async function screenshotStep(
    page: Page,
    testInfo: TestInfo,
    name: string,
    options: { allowCardSpotlight?: boolean } = {},
): Promise<string> {
    if (!options.allowCardSpotlight) {
        await waitForCardSpotlightClear(page);
    }
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({ path, fullPage: false, timeout: 20000 }));
    return path;
}

async function enableManualBonusDiceResponse(context: BrowserContext, page: Page): Promise<void> {
    const setPreferences = () => {
        localStorage.setItem('dicethrone:autoResponse', 'true');
        localStorage.setItem('dicethrone:bonusDiceResponse', 'true');
    };
    await context.addInitScript(setPreferences);
    await page.evaluate(setPreferences);
}

async function setupOnlineDuel(browser: Browser, baseURL: string | undefined) {
    const setup = await setupDTOnlineMatch(browser, baseURL, {
        skipImageGate: false,
        characterSelectionTimeout: OPEN_TIMEOUT_MS,
    });
    expect(setup, 'DiceThrone 在线双人房创建失败，黄金全流程无法起跑').not.toBeNull();
    if (!setup) throw new Error('DiceThrone 在线双人房创建失败');

    await enableManualBonusDiceResponse(setup.hostContext, setup.hostPage);
    await enableManualBonusDiceResponse(setup.guestContext, setup.guestPage);
    await selectCharacter(setup.hostPage, 'moon_elf');
    await selectCharacter(setup.guestPage, 'barbarian');
    await readyAndStartGame(setup.hostPage, setup.guestPage);
    await waitForGameBoard(setup.hostPage, OPEN_TIMEOUT_MS);
    await waitForGameBoard(setup.guestPage, OPEN_TIMEOUT_MS);
    await waitForDiceThroneHarness(setup.hostPage, 30000);
    await waitForDiceThroneHarness(setup.guestPage, 30000);
    await ensureDebugPanelClosed(setup.hostPage);
    await ensureDebugPanelClosed(setup.guestPage);
    await setup.hostPage.setViewportSize({ width: 1366, height: 768 });
    await setup.guestPage.setViewportSize({ width: 1366, height: 768 });
    return setup;
}

async function updateOnlineState(
    matchId: string,
    page: Page,
    mutate: (root: MutableRecord, core: MutableRecord, sys: MutableRecord) => void,
): Promise<void> {
    const currentState = clone(await getMatchState(matchId, page) as MutableRecord);
    const root = currentState.G && typeof currentState.G === 'object' ? currentState.G : currentState;
    const core = root.core ?? {};
    const sys = root.sys ?? {};
    mutate(root, core, sys);
    root.core = core;
    root.sys = sys;
    await injectMatchState(matchId, currentState, page);
    await page.waitForTimeout(700);
}

async function clearHandsBeforeGoldenFixture(matchId: string, page: Page): Promise<void> {
    await updateOnlineState(matchId, page, (_root, core, sys) => {
        const player0 = core.players?.['0'];
        const player1 = core.players?.['1'];
        Object.assign(core, {
            activePlayerId: '0',
            currentPlayerIndex: 0,
            turnOrder: ['0', '1'],
            phase: 'main1',
        });
        Object.assign(sys, {
            phase: 'main1',
            currentPlayerIndex: 0,
            turnOrder: ['0', '1'],
        });
        if (player0) {
            core.players['0'] = {
                ...player0,
                hand: [],
                deck: [],
                discard: [],
            };
        }
        if (player1) {
            core.players['1'] = {
                ...player1,
                hand: [],
                deck: [],
                discard: [],
            };
        }
    });
}

async function prepareGoldenMain1State(matchId: string, page: Page): Promise<void> {
    await clearHandsBeforeGoldenFixture(matchId, page);
    await updateOnlineState(matchId, page, (_root, core, sys) => {
        const player0 = core.players?.['0'] ?? {};
        const player1 = core.players?.['1'] ?? {};
        const hostHandIds = [
            'card-double',
            'card-play-six',
            'card-surprise',
            'volley',
            'card-flick',
            'card-me-too',
            'card-i-can-again',
            'card-worthy-of-me',
            'card-super-double',
            'card-bye-bye',
            'card-give-hand',
            'card-get-away',
        ];
        const guestHandIds = ['card-surprise', 'card-flick'];

        Object.assign(core, {
            activePlayerId: '0',
            currentPlayerIndex: 0,
            turnOrder: ['0', '1'],
            hostStarted: true,
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            phase: 'main1',
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            dice: [],
            currentRollContext: null,
            pendingAttack: null,
            pendingDamage: null,
            selectedAbilityId: null,
            players: {
                ...(core.players ?? {}),
                '0': {
                    ...player0,
                    characterId: 'moon_elf',
                    hand: hostHandIds.map(getGoldenCard),
                    deck: [],
                    discard: [],
                    tokens: { ...(player0.tokens ?? {}) },
                    resources: {
                        ...(player0.resources ?? {}),
                        [RESOURCE_IDS.CP]: 12,
                        [RESOURCE_IDS.HP]: 50,
                    },
                },
                '1': {
                    ...player1,
                    characterId: 'barbarian',
                    hand: guestHandIds.map(getGoldenCard),
                    deck: [],
                    discard: [],
                    tokens: { ...(player1.tokens ?? {}) },
                    resources: {
                        ...(player1.resources ?? {}),
                        [RESOURCE_IDS.CP]: 12,
                        [RESOURCE_IDS.HP]: 50,
                    },
                },
            },
        });

        Object.assign(sys, {
            phase: 'main1',
            currentPlayerIndex: 0,
            turnOrder: ['0', '1'],
            interaction: { current: null, queue: [], isBlocked: false },
            responseWindow: { current: null },
            gameover: null,
        });
    });
}

async function waitForPhase(page: Page, phase: string, timeout = 15000): Promise<void> {
    await page.waitForFunction(
        (expectedPhase) => {
            const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === expectedPhase;
        },
        phase,
        { timeout, polling: 200 },
    );
}

async function waitForState(page: Page, predicate: (state: MutableRecord) => unknown, timeout = 15000) {
    await expect.poll(async () => {
        const state = await page.evaluate(() => (window as Window).__BG_TEST_HARNESS__?.state?.get?.() ?? null);
        return state ? predicate(state) : null;
    }, { timeout }).toBeTruthy();
}

async function readStateSummary(page: Page): Promise<MutableRecord | null> {
    return page.evaluate(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        if (!state) return null;
        const responseWindow = state.sys?.responseWindow?.current;
        const interaction = state.sys?.interaction?.current;
        const pendingAttack = state.core?.pendingAttack;
        const responderQueue = responseWindow?.responderQueue ?? [];
        const responderIndex = responseWindow?.currentResponderIndex ?? 0;
        const abilitySlots = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-testid="player-board-surface"] [data-ability-slot]',
        )).map((node) => ({
            slot: node.getAttribute('data-ability-slot'),
            available: node.getAttribute('data-available-ability-id'),
            resolved: node.getAttribute('data-resolved-ability-id'),
            base: node.getAttribute('data-base-ability-id'),
            selected: node.getAttribute('data-selected-ability-id'),
            canClick: node.getAttribute('data-can-click'),
            shouldHighlight: node.getAttribute('data-should-highlight'),
        }));
        const eventTail = Array.isArray(state.sys?.eventStream?.entries)
            ? state.sys.eventStream.entries.slice(-12).map((entry: MutableRecord) => ({
                type: entry?.event?.type ?? entry?.type,
                payload: entry?.event?.payload ?? entry?.payload,
            }))
            : [];
        return {
            phase: state.sys?.phase,
            activePlayerId: state.core?.activePlayerId,
            currentPlayerIndex: state.core?.currentPlayerIndex,
            focusGuess: responseWindow
                ? responderQueue[responderIndex]
                : interaction?.playerId ?? (state.sys?.phase === 'defensiveRoll' && pendingAttack
                    ? pendingAttack.defenderId
                    : state.core?.activePlayerId),
            responseWindow: responseWindow ? {
                id: responseWindow.id,
                windowType: responseWindow.windowType,
                responderQueue,
                currentResponderIndex: responderIndex,
                pendingInteractionId: responseWindow.pendingInteractionId,
                sourceId: responseWindow.sourceId,
            } : null,
            interaction: interaction ? {
                id: interaction.id,
                kind: interaction.kind,
                playerId: interaction.playerId,
                sourceId: interaction.data?.sourceId,
                dtType: interaction.data?.meta?.dtType,
            } : null,
            pendingAttack: pendingAttack ? {
                attackerId: pendingAttack.attackerId,
                defenderId: pendingAttack.defenderId,
                sourceAbilityId: pendingAttack.sourceAbilityId,
                defenseAbilityId: pendingAttack.defenseAbilityId,
                settlementStage: pendingAttack.settlementStage,
                damage: pendingAttack.damage,
                bonusDamage: pendingAttack.bonusDamage,
                attackModifierBonusDamage: pendingAttack.attackModifierBonusDamage,
                resolvedDamage: pendingAttack.resolvedDamage,
                defenseResolved: pendingAttack.defenseResolved,
                attackDiceValues: pendingAttack.attackDiceValues,
            } : null,
            rollConfirmed: state.core?.rollConfirmed,
            rollCount: state.core?.rollCount,
            dice: Array.isArray(state.core?.dice)
                ? state.core.dice.slice(0, 5).map((die: MutableRecord) => die?.value)
                : [],
            currentRollContext: state.core?.currentRollContext ? {
                kind: state.core.currentRollContext.kind,
                dice: Array.isArray(state.core.currentRollContext.dice)
                    ? state.core.currentRollContext.dice.map((die: MutableRecord) => ({
                        id: die?.id,
                        value: die?.value,
                        ownerId: die?.ownerId,
                    }))
                    : [],
            } : null,
            hp0: state.core?.players?.['0']?.resources?.hp,
            hp1: state.core?.players?.['1']?.resources?.hp,
            cp0: state.core?.players?.['0']?.resources?.cp,
            cp1: state.core?.players?.['1']?.resources?.cp,
            hand0: state.core?.players?.['0']?.hand?.map?.((card: MutableRecord) => card?.id),
            hand1: state.core?.players?.['1']?.hand?.map?.((card: MutableRecord) => card?.id),
            lastResolvedAttackDamage: state.core?.lastResolvedAttackDamage,
            abilitySlots,
            eventTail,
        };
    });
}

function summarizeServerState(state: MutableRecord): MutableRecord {
    const root = state.G && typeof state.G === 'object' ? state.G : state;
    const pendingAttack = root.core?.pendingAttack;
    const entries = Array.isArray(root.sys?.eventStream?.entries) ? root.sys.eventStream.entries : [];
    return {
        phase: root.sys?.phase,
        activePlayerId: root.core?.activePlayerId,
        currentPlayerIndex: root.core?.currentPlayerIndex,
        pendingAttack: pendingAttack ? {
            attackerId: pendingAttack.attackerId,
            defenderId: pendingAttack.defenderId,
            sourceAbilityId: pendingAttack.sourceAbilityId,
            defenseAbilityId: pendingAttack.defenseAbilityId,
            settlementStage: pendingAttack.settlementStage,
            damage: pendingAttack.damage,
            bonusDamage: pendingAttack.bonusDamage,
            attackModifierBonusDamage: pendingAttack.attackModifierBonusDamage,
            resolvedDamage: pendingAttack.resolvedDamage,
            defenseResolved: pendingAttack.defenseResolved,
            attackDiceValues: pendingAttack.attackDiceValues,
        } : null,
        rollConfirmed: root.core?.rollConfirmed,
        rollCount: root.core?.rollCount,
        dice: Array.isArray(root.core?.dice)
            ? root.core.dice.slice(0, 5).map((die: MutableRecord) => die?.value)
            : [],
        currentRollContext: root.core?.currentRollContext ? {
            kind: root.core.currentRollContext.kind,
            ownerPlayerId: root.core.currentRollContext.ownerPlayerId,
            dice: Array.isArray(root.core.currentRollContext.dice)
                ? root.core.currentRollContext.dice.map((die: MutableRecord) => ({
                    id: die?.id,
                    value: die?.value,
                    ownerId: die?.ownerId,
                }))
                : [],
        } : null,
        hp0: root.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP],
        hp1: root.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP],
        discard0: root.core?.players?.['0']?.discard?.map?.((card: MutableRecord) => card.id),
        discard1: root.core?.players?.['1']?.discard?.map?.((card: MutableRecord) => card.id),
        lastResolvedAttackDamage: root.core?.lastResolvedAttackDamage,
        eventTail: entries.slice(-12).map((entry: MutableRecord) => ({
            type: entry?.event?.type ?? entry?.type,
            payload: entry?.event?.payload ?? entry?.payload,
        })),
    };
}

async function readServerStateSummary(matchId: string, page: Page): Promise<MutableRecord> {
    const state = await getMatchState(matchId, page) as MutableRecord;
    return summarizeServerState(state);
}

async function waitForServerState(
    matchId: string,
    page: Page,
    predicate: (summary: MutableRecord) => boolean,
    message: string,
    timeout = 15000,
): Promise<MutableRecord> {
    let latest: MutableRecord | null = null;
    try {
        await expect.poll(async () => {
            latest = await readServerStateSummary(matchId, page);
            return predicate(latest);
        }, {
            message,
            timeout,
        }).toBe(true);
    } catch (error) {
        throw new Error(`${message}；最新服务端摘要=${JSON.stringify(latest, null, 2)}；原始错误=${error instanceof Error ? error.message : String(error)}`);
    }
    return latest!;
}

function getActiveRollDice(state: MutableRecord): MutableRecord[] {
    const contextDice = state.core?.currentRollContext?.dice;
    if (Array.isArray(contextDice) && contextDice.length > 0) return contextDice;

    const dice = Array.isArray(state.core?.dice) ? state.core.dice : [];
    const rollDiceCount = typeof state.core?.rollDiceCount === 'number'
        ? state.core.rollDiceCount
        : dice.length;
    return dice.slice(0, Math.max(0, rollDiceCount));
}

function hasActiveRollDiceValues(state: MutableRecord, values: number[]): boolean {
    const dice = getActiveRollDice(state);
    return dice.length === values.length
        && dice.every((die, index) => die?.value === values[index]);
}

async function clickToolbarButton(page: Page, tutorialId: string): Promise<void> {
    const button = page.locator(`[data-tutorial-id="${tutorialId}"]`).first();
    await expect(button).toBeVisible({ timeout: 15000 });
    const enabled = await button.isEnabled({ timeout: 15000 }).catch(() => false);
    if (!enabled) {
        const summary = await readStateSummary(page);
        throw new Error(`工具栏按钮 ${tutorialId} 禁用，状态摘要：${JSON.stringify(summary, null, 2)}`);
    }
    await button.click();
    await page.waitForTimeout(500);
}

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard, `手牌 ${cardId} 必须在真实手牌区可见`).toBeVisible({ timeout: 15000 });
    await expect(handCard, `手牌 ${cardId} 必须可拖出打出`).toHaveAttribute('data-can-drag', 'true', { timeout: 15000 });
    const cardBox = await page.evaluate((nextCardId: string) => {
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
    if (!draggedCardBox || cardBox.y - draggedCardBox.y < 160) {
        throw new Error(`手牌 ${cardId} 没有真实拖出到打出距离`);
    }
    await page.mouse.up();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(500);
    await closeBoardMagnifyIfVisible(page);
}

async function closeBoardMagnifyIfVisible(page: Page): Promise<void> {
    const overlay = page.getByTestId('board-magnify-overlay');
    if (!(await overlay.isVisible({ timeout: 1000 }).catch(() => false))) return;

    const closeButton = overlay.getByRole('button', { name: /关闭预览|close preview/i }).first();
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();
    await expect(overlay).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(250);
}

async function waitForCardSpotlightClear(page: Page): Promise<void> {
    await page.waitForTimeout(250);
    const overlay = page.getByTestId('card-spotlight-overlay').first();
    if (!(await overlay.isVisible({ timeout: 500 }).catch(() => false))) return;
    await expect(overlay, '阶段截图前卡牌特写必须退场，避免把遮挡图当作流程证据').toBeHidden({ timeout: 7000 });
}

async function clickVisibleDie(page: Page, dieIndex: number): Promise<void> {
    await closeBoardMagnifyIfVisible(page);
    const diceTray = page.getByTestId('dicethrone-2d-dice-tray').first();
    const dieButton = diceTray.getByTestId(`die-button-${dieIndex}`).first();
    await expect(dieButton).toBeVisible({ timeout: 15000 });
    await expect(dieButton).toHaveAttribute('data-clickable', 'true', { timeout: 15000 });
    await dieButton.click();
    await page.waitForTimeout(500);
}

async function clickAbilitySlot(page: Page, abilityId: string): Promise<void> {
    await closeBoardMagnifyIfVisible(page);
    const readMatchingSlotId = async () => page.evaluate((expectedAbilityId) => {
        const slots = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-testid="player-board-surface"] [data-ability-slot]',
        ));
        const matchesAbility = (value: string | null) => (
            typeof value === 'string'
            && (value === expectedAbilityId || value.startsWith(`${expectedAbilityId}-`))
        );
        const slot = slots.find((candidate) => (
            (
                candidate.getAttribute('data-can-click') === 'true'
                || candidate.getAttribute('data-should-highlight') === 'true'
            )
            && (
                matchesAbility(candidate.getAttribute('data-available-ability-id'))
                || matchesAbility(candidate.getAttribute('data-resolved-ability-id'))
                || matchesAbility(candidate.getAttribute('data-base-ability-id'))
            )
        ));
        return slot?.getAttribute('data-ability-slot') ?? null;
    }, abilityId);

    try {
        await expect.poll(readMatchingSlotId, {
            message: `技能 ${abilityId} 必须映射到真实可点或高亮技能槽`,
            timeout: 15000,
        }).not.toBeNull();
    } catch (error) {
        const slots = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(
            '[data-testid="player-board-surface"] [data-ability-slot]',
        )).map((node) => ({
            slot: node.getAttribute('data-ability-slot'),
            available: node.getAttribute('data-available-ability-id'),
            resolved: node.getAttribute('data-resolved-ability-id'),
            base: node.getAttribute('data-base-ability-id'),
            canClick: node.getAttribute('data-can-click'),
            shouldHighlight: node.getAttribute('data-should-highlight'),
            selected: node.getAttribute('data-is-selected'),
        })));
        throw new Error(`技能 ${abilityId} 没有映射到真实可点击面板槽位；当前技能槽=${JSON.stringify(slots)}；原始错误=${error instanceof Error ? error.message : String(error)}`);
    }

    const slotId = await readMatchingSlotId();
    if (!slotId) throw new Error(`技能 ${abilityId} 没有映射到真实可点击面板槽位`);

    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect.poll(async () => {
        return slot.evaluate((node) => (
            node.getAttribute('data-can-click') === 'true'
            || node.getAttribute('data-should-highlight') === 'true'
        )).catch(() => false);
    }, {
        message: `技能 ${abilityId} 对应槽位 ${slotId} 必须是可点击或高亮触发入口`,
        timeout: 15000,
    }).toBe(true);

    const clickPoint = await page.evaluate((targetSlotId: string) => {
        const element = document.querySelector(
            `[data-testid="player-board-surface"] [data-ability-slot="${targetSlotId}"]`,
        ) as HTMLElement | null;
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const xFractions = [0.18, 0.5, 0.82];
        const yFractions = [0.12, 0.28, 0.5, 0.72, 0.88];

        for (const yFraction of yFractions) {
            for (const xFraction of xFractions) {
                const x = rect.left + rect.width * xFraction;
                const y = rect.top + rect.height * yFraction;
                const topElement = document.elementFromPoint(x, y);
                const hitSlot = topElement?.closest?.('[data-ability-slot]');
                if (hitSlot === element) {
                    return { x, y };
                }
            }
        }

        return null;
    }, slotId);

    if (clickPoint) {
        await page.mouse.click(clickPoint.x, clickPoint.y);
    } else {
        await slot.click({ force: true });
    }
    await page.waitForTimeout(700);
}

async function dismissAttackShowcaseIfVisible(page: Page): Promise<void> {
    const showcase = page.getByTestId('attack-showcase-overlay');
    if (!(await showcase.isVisible({ timeout: 1200 }).catch(() => false))) return;
    const continueButton = showcase.getByRole('button', { name: /^(开始防御|继续|Start Defense|Continue)$/i }).first();
    await expect(continueButton).toBeVisible({ timeout: 10000 });
    await continueButton.click();
    await expect(showcase).toBeHidden({ timeout: 10000 }).catch(() => undefined);
}

async function waitForResponseWindow(page: Page, responderId: string): Promise<void> {
    await page.waitForFunction(
        (expectedResponderId) => {
            const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.responseWindow?.current;
            if (!current) return false;
            const responderQueue = current.responderQueue ?? [];
            const currentResponder = responderQueue[current.currentResponderIndex ?? 0];
            return currentResponder === expectedResponderId;
        },
        responderId,
        { timeout: 15000, polling: 200 },
    );
}

async function changeVisibleDieByOne(page: Page, dieIndex: number, direction: 'increment' | 'decrement'): Promise<void> {
    await closeBoardMagnifyIfVisible(page);
    const diceTray = page.getByTestId('dicethrone-2d-dice-tray').first();
    const dieButton = diceTray.getByTestId(`die-button-${dieIndex}`).first();
    await expect(dieButton).toBeVisible({ timeout: 15000 });

    let adjustButton = diceTray.getByTestId(`die-adjust-${direction}-${dieIndex}`).first();
    if (!(await adjustButton.isVisible({ timeout: 1000 }).catch(() => false))) {
        await dieButton.click();
        adjustButton = diceTray.getByTestId(`die-adjust-${direction}-${dieIndex}`).first();
    }
    await expect(adjustButton).toBeVisible({ timeout: 10000 });
    await adjustButton.click();
    const confirmModifyButton = page.getByTestId('dice-interaction-confirm-button').first();
    await expect(confirmModifyButton).toBeEnabled({ timeout: 10000 });
    await confirmModifyButton.click();
    await page.waitForTimeout(700);
}

async function ensureFistTechniqueAttackSelected(hostPage: Page): Promise<void> {
    const selectedAttackId = await hostPage.evaluate(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.pendingAttack?.sourceAbilityId ?? null;
    });
    if (selectedAttackId === EXPECTED_FIST_TECHNIQUE_ID) return;
    if (typeof selectedAttackId === 'string' && selectedAttackId.startsWith('fist-technique')) {
        const summary = await readStateSummary(hostPage);
        throw new Error(`冲拳必须选择 4 拳变体 ${EXPECTED_FIST_TECHNIQUE_ID}，实际选择=${selectedAttackId}；页面摘要=${JSON.stringify(summary, null, 2)}`);
    }

    const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]').first();
    if (await confirmButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await expect(confirmButton).toBeEnabled({ timeout: 10000 });
        await confirmButton.click();
        await hostPage.waitForTimeout(500);
    }
    await clickAbilitySlot(hostPage, EXPECTED_FIST_TECHNIQUE_ID);
    await expect.poll(async () => {
        const summary = await readStateSummary(hostPage);
        return summary?.pendingAttack?.sourceAbilityId ?? null;
    }, {
        message: `选择冲拳后必须进入 ${EXPECTED_FIST_TECHNIQUE_ID} 攻击；页面摘要=${JSON.stringify(await readStateSummary(hostPage), null, 2)}`,
        timeout: 10000,
    }).toBe(EXPECTED_FIST_TECHNIQUE_ID);
}

async function clickFirstVisibleHandCardToDiscard(page: Page): Promise<void> {
    const card = page.locator('[data-testid="hand-area"] [data-card-id]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const cardId = await card.getAttribute('data-card-id');
    if (!cardId) {
        throw new Error('弃牌阶段未读到可点击手牌 ID');
    }
    await card.click();
    await page.waitForTimeout(700);
}

async function getHandCount(page: Page, playerId: string): Promise<number> {
    const count = await page.evaluate((targetPlayerId) => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.players?.[targetPlayerId]?.hand?.length;
    }, playerId);
    if (typeof count !== 'number') {
        throw new Error(`未能读取玩家 ${playerId} 的手牌数量`);
    }
    return count;
}

async function discardUntilHandLimit(page: Page, playerId: string, handLimit = 6): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const handCount = await getHandCount(page, playerId);
        if (handCount <= handLimit) return;
        await clickFirstVisibleHandCardToDiscard(page);
        await expect.poll(() => getHandCount(page, playerId), {
            message: `弃牌后玩家 ${playerId} 手牌数必须减少`,
            timeout: 10000,
        }).toBeLessThan(handCount);
    }

    throw new Error(`连续弃牌后玩家 ${playerId} 手牌仍超过上限 ${handLimit}`);
}

test.describe('DiceThrone 黄金全流程 E2E', () => {
    test(GOLDEN_TEST_NAME, async ({ browser }, testInfo) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await clearEvidenceScreenshotsForTest(testInfo);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupOnlineDuel(browser, baseURL);

        try {
            const { hostPage, guestPage, matchId } = setup;

            await prepareGoldenMain1State(matchId, hostPage);
            await waitForPhase(hostPage, 'main1');
            await waitForPhase(guestPage, 'main1');
            await screenshotStep(hostPage, testInfo, '01-开局牌桌-攻击方主要阶段可操作');

            await clickToolbarButton(hostPage, 'advance-phase-button');
            await waitForPhase(hostPage, 'offensiveRoll');
            await waitForPhase(guestPage, 'offensiveRoll');
            await screenshotStep(hostPage, testInfo, '02-主阶段结束-进入进攻投骰阶段');

            await clickToolbarButton(hostPage, 'dice-roll-button');
            await waitForState(hostPage, (state) => (state.core?.dice?.length ?? 0) === 5);
            await applyDiceValues(hostPage, [1, 1, 1, 1, 3]);
            await waitForState(hostPage, (state) => state.core?.dice?.[4]?.value === 3);
            await screenshotStep(hostPage, testInfo, '03-进攻投骰后-五颗骰子已落定');

            await dragHandCardToPlay(hostPage, 'card-play-six');
            await waitForState(hostPage, (state) => state.sys?.interaction?.current?.data?.meta?.dtType === 'modifyDie');
            await screenshotStep(hostPage, testInfo, '04-进攻方打出改骰牌-等待选择骰子');
            await clickVisibleDie(hostPage, 4);
            await waitForState(hostPage, (state) => state.core?.dice?.[4]?.value === 6 && !state.sys?.interaction?.current);
            await screenshotStep(hostPage, testInfo, '05-进攻方改骰完成-一颗骰子改为六');

            await clickToolbarButton(hostPage, 'dice-confirm-button');
            await waitForState(hostPage, (state) => state.core?.rollConfirmed === true);
            await waitForResponseWindow(guestPage, '1');
            await dismissAttackShowcaseIfVisible(hostPage);
            await dismissAttackShowcaseIfVisible(guestPage);
            await screenshotStep(guestPage, testInfo, '06-进攻骰确认后-防御方响应窗口出现');

            await dragHandCardToPlay(guestPage, 'card-surprise');
            await waitForState(guestPage, (state) => state.sys?.interaction?.current?.data?.meta?.dtType === 'modifyDie');
            await screenshotStep(guestPage, testInfo, '07-防御方打出惊不惊喜-选择修改进攻骰');
            await changeVisibleDieByOne(guestPage, 4, 'decrement');
            await waitForState(hostPage, (state) => (
                !state.sys?.interaction?.current
                && !state.sys?.responseWindow?.current
                && state.core?.dice?.[4]?.value === 5
                && state.core?.rollConfirmed === false
            ));
            await screenshotStep(hostPage, testInfo, '08-防御方改我投骰后-攻击方需要重新确认骰面');

            await clickToolbarButton(hostPage, 'dice-confirm-button');
            await waitForState(hostPage, (state) => (
                state.core?.rollConfirmed === true
                && !state.sys?.responseWindow?.current
            ));
            await screenshotStep(hostPage, testInfo, '09-攻击方重新确认改后骰-冲拳技能可选');

            await clickAbilitySlot(hostPage, EXPECTED_FIST_TECHNIQUE_ID);
            await ensureFistTechniqueAttackSelected(hostPage);
            await waitForServerState(
                matchId,
                hostPage,
                (summary) => summary.pendingAttack?.sourceAbilityId === EXPECTED_FIST_TECHNIQUE_ID,
                `服务端必须记录 ${EXPECTED_FIST_TECHNIQUE_ID}，不能只停在冲拳父技能或客户端预测态`,
            );
            await dismissAttackShowcaseIfVisible(hostPage);
            await dismissAttackShowcaseIfVisible(guestPage);
            await screenshotStep(hostPage, testInfo, '10-攻击技能确认后-准备进入防御');

            const resolveAttackButton = hostPage.getByRole('button', { name: /^(结算攻击|Resolve Attack)$/i }).first();
            if (await resolveAttackButton.isVisible({ timeout: 2500 }).catch(() => false)) {
                await expect(resolveAttackButton).toBeEnabled({ timeout: 10000 });
                await resolveAttackButton.click();
            } else {
                await clickToolbarButton(hostPage, 'advance-phase-button');
            }
            await waitForPhase(guestPage, 'defensiveRoll');
            await screenshotStep(guestPage, testInfo, '11-进入防御阶段-防御方可投防御骰');

            await clickToolbarButton(guestPage, 'dice-roll-button');
            await waitForState(guestPage, (state) => getActiveRollDice(state).length === 3);
            // Barbarian 4/5 are heart faces. Use no-heart defense dice so Thick Skin
            // cannot heal the defender back to full HP and hide the real damage result.
            await applyDiceValues(guestPage, [1, 1, 1]);
            await waitForState(guestPage, (state) => hasActiveRollDiceValues(state, [1, 1, 1]));
            await screenshotStep(guestPage, testInfo, '12-防御方投骰后-无心面防御骰已落定');

            await clickToolbarButton(guestPage, 'dice-confirm-button');
            await waitForResponseWindow(hostPage, '0');
            await dismissAttackShowcaseIfVisible(hostPage);
            await dismissAttackShowcaseIfVisible(guestPage);
            await screenshotStep(hostPage, testInfo, '13-防御骰确认后-攻击方响应窗口出现');

            await dragHandCardToPlay(hostPage, 'card-surprise');
            await waitForState(hostPage, (state) => state.sys?.interaction?.current?.data?.meta?.dtType === 'modifyDie');
            await screenshotStep(hostPage, testInfo, '14-攻击方响应防御骰-准备修改对方防御骰');
            await changeVisibleDieByOne(hostPage, 0, 'increment');
            await waitForState(guestPage, (state) => (
                !state.sys?.interaction?.current
                && !state.sys?.responseWindow?.current
                && hasActiveRollDiceValues(state, [2, 1, 1])
            ));
            await screenshotStep(guestPage, testInfo, '15-防御骰被攻击方修改后-防御方需要重新确认');

            await clickToolbarButton(guestPage, 'dice-confirm-button');
            await waitForState(guestPage, (state) => (
                !state.sys?.interaction?.current
                && state.core?.rollConfirmed === true
                && hasActiveRollDiceValues(state, [2, 1, 1])
            ));
            await waitForResponseWindow(hostPage, '0');
            await screenshotStep(hostPage, testInfo, '16-防御方重新确认后-攻击方二次响应窗口出现');
            const passed = await maybePassResponse(hostPage);
            expect(passed, '防御方重新确认改后骰后，攻击方响应窗口必须能通过真实跳过按钮让过').toBe(true);
            await waitForState(guestPage, (state) => !state.sys?.responseWindow?.current);
            await screenshotStep(guestPage, testInfo, '17-攻击方跳过二次响应后-防御方可结束防御');

            await clickToolbarButton(guestPage, 'advance-phase-button');
            await waitForPhase(hostPage, 'main2');
            await waitForPhase(guestPage, 'main2');
            await waitForState(hostPage, (state) => state.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] < 50);
            await waitForServerState(
                matchId,
                guestPage,
                (summary) => summary.phase === 'main2' && summary.hp1 < 50 && summary.lastResolvedAttackDamage > 0,
                '防御结束后服务端必须完成冲拳伤害结算，不能只让客户端预测态掉血',
                20000,
            );
            await screenshotStep(hostPage, testInfo, '18-伤害结算完成-进入攻击方第二主要阶段');

            await clickToolbarButton(hostPage, 'advance-phase-button');
            await waitForPhase(hostPage, 'discard');
            await screenshotStep(hostPage, testInfo, '19-进入弃牌阶段-手牌超限需要弃牌');

            await discardUntilHandLimit(hostPage, '0');
            await waitForState(hostPage, (state) => (state.core?.players?.['0']?.hand?.length ?? 0) <= 6);
            await screenshotStep(hostPage, testInfo, '20-弃牌后-手牌回到上限');

            const afterDiscardSummary = await readStateSummary(hostPage);
            if (!(afterDiscardSummary?.phase === 'main1' && afterDiscardSummary?.activePlayerId === '1')) {
                await clickToolbarButton(hostPage, 'advance-phase-button');
            }
            await waitForPhase(guestPage, 'main1', 20000);
            await waitForState(guestPage, (state) => state.core?.activePlayerId === '1' || state.core?.currentPlayerIndex === 1);
            await screenshotStep(guestPage, testInfo, '21-回合交接完成-防御方成为下一回合玩家');

            await waitForServerState(
                matchId,
                guestPage,
                (summary) => summary.phase === 'main1' && summary.activePlayerId === '1' && summary.hp1 < 50,
                '最终服务端权威状态必须完成回合交接且保留防御方掉血结果',
                20000,
            );
            const finalState = await getMatchState(matchId, guestPage) as MutableRecord;
            const root = finalState.G && typeof finalState.G === 'object' ? finalState.G : finalState;
            expect(root.sys?.phase).toBe('main1');
            expect(root.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP]).toBeLessThan(50);
            expect(root.core?.players?.['0']?.discard?.map((card: MutableRecord) => card.id)).toEqual(expect.arrayContaining([
                'card-play-six',
                'card-surprise',
            ]));
            expect(root.core?.players?.['1']?.discard?.map((card: MutableRecord) => card.id)).toContain('card-surprise');
        } finally {
            await cleanupDTMatch(setup);
        }
    });
});
