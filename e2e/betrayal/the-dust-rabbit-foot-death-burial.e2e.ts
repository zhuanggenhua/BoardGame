import { expect, test, type Page } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustRabbitFootDeathBurialRuntimeCore,
    expectPhysicalDiceSeparated,
    expectVisiblePhysicalDiceBox,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-rabbit-foot-death-burial';
const SUCCESS_BEFORE_REROLL_SCREENSHOT = `${EVIDENCE_DIR}/01-兔脚死亡保护重掷前.jpg`;
const SUCCESS_REROLL_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/02-兔脚成功回滚死亡.jpg`;
const SUCCESS_BOARD_SCREENSHOT = `${EVIDENCE_DIR}/03-兔脚成功后遗物保留.jpg`;
const FAILURE_REROLL_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/04-兔脚仍失败保持死亡.jpg`;
const FAILURE_BOARD_SCREENSHOT = `${EVIDENCE_DIR}/05-兔脚仍失败后遗物掩埋不可搜尸.jpg`;
const TEST_URL = '/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-rabbit-foot-death-burial';
const INITIAL_SKULL_FAILURE_QUEUE = Array.from({ length: 24 }, () => 0.5);
const RABBIT_FOOT_SUCCESS_QUEUE = [0.99];
const RABBIT_FOOT_FAILURE_QUEUE = [0.01];

type DustRabbitFootDeathBurialState = {
    phase?: string;
    currentPlayer?: string;
    deadPlayerIds?: string[];
    feverishPlayerIds?: string[];
    feverishRoomId?: string | null;
    playerOneInventory?: string[];
    usedCardIdsThisTurn?: string[];
    recentRoll?: {
        kind?: string;
        dice?: number[];
        latestLabel?: string;
        consumedRabbitFootCardIds?: string[];
    } | null;
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
};

const readDustRabbitFootDeathBurialState = async (
    page: Page,
): Promise<DustRabbitFootDeathBurialState> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: BetrayalCore;
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const explorers = core ? [core.currentExplorer, ...core.otherExplorers] : [];
        const playerOne = explorers.find((explorer) => explorer.playerId === '1');
        const feverish = core?.monsters?.find((monster) => monster.id === 'feverish-1');
        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            feverishPlayerIds: core?.scenarioRuntime?.dust?.feverishPlayerIds ?? [],
            feverishRoomId: feverish?.roomId ?? null,
            playerOneInventory: playerOne?.inventory.map((card) => card.name) ?? [],
            usedCardIdsThisTurn: core?.usedCardIdsThisTurn ?? [],
            recentRoll: core?.recentRoll
                ? {
                    kind: core.recentRoll.kind,
                    dice: [...core.recentRoll.dice],
                    latestLabel: core.recentRoll.latestLabel,
                    consumedRabbitFootCardIds: [...core.recentRoll.consumedRabbitFootCardIds],
                }
                : null,
            endgameResult: core?.endgameResult ?? null,
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

const prepareFailedSkullDeathRoll = async (page: Page) => {
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await dismissHauntRevealCueIfVisible(page);
    await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
    await expect(page.getByTestId('betrayal-inventory-skull')).toBeVisible();
    await expect(page.getByTestId('betrayal-inventory-rope')).toBeVisible();
    await expect(page.getByTestId('betrayal-inventory-map')).toBeVisible();
    await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();

    await page.getByTestId('betrayal-action-endTurn').click();
    const damagePanel = page.getByTestId('betrayal-damage-allocation-panel');
    await expect(damagePanel).toBeVisible();
    await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('灰尘冲动');
    const pendingAmountText = await page.getByTestId('betrayal-damage-allocation-amount').innerText();
    const pendingAmount = Number(pendingAmountText.match(/\d+/)?.[0] ?? 0);
    expect([2, 4]).toContain(pendingAmount);
    for (const trait of ['might', 'speed', 'knowledge', 'sanity'].slice(0, pendingAmount)) {
        await page.getByTestId(`betrayal-damage-allocation-trait-${trait}`).click();
    }
    await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();

    await setHarnessRandomQueue(page, INITIAL_SKULL_FAILURE_QUEUE);
    await page.getByTestId('betrayal-damage-allocation-confirm').click();
    const deathRollPanel = page.getByTestId('betrayal-recent-roll-panel');
    await expect(deathRollPanel).toContainText('头骨死亡保护', { timeout: 30000 });
    await expectVisiblePhysicalDiceBox(deathRollPanel);
    await waitForPhysicalDiceSettled(deathRollPanel);
    await expectPhysicalDiceSeparated(deathRollPanel, { minDiceCount: 3 });
    await expect(deathRollPanel).toContainText('正常死亡');
    await expect.poll(() => readDustRabbitFootDeathBurialState(page)).toMatchObject({
        phase: 'haunt',
        currentPlayer: '1',
        deadPlayerIds: expect.arrayContaining(['1']),
        feverishPlayerIds: expect.arrayContaining(['1']),
        feverishRoomId: 'hallway',
        recentRoll: {
            kind: 'deathPrevention',
            latestLabel: '正常死亡',
        },
    });
    await expect(page.getByTestId('betrayal-inventory-rope')).toHaveAttribute('data-roll-modifier-available', 'true');
    return deathRollPanel;
};

const useRabbitFootOnFirstDie = async (page: Page, randomQueue: number[]) => {
    const rabbitFootCard = page.getByTestId('betrayal-inventory-rope');
    await rabbitFootCard.click();
    await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toHaveText('兔脚');
    const rabbitFootDice = page.getByTestId('betrayal-rabbit-foot-dice');
    await expect(rabbitFootDice).toBeVisible();
    await expect(rabbitFootDice).toHaveAttribute('data-reroll-target-count', '3');
    const rerollTargetDie = page.getByTestId('betrayal-house-dice-reroll-target-0');
    await expect(rerollTargetDie).toBeVisible();
    await setHarnessRandomQueue(page, randomQueue);
    await rerollTargetDie.click();
    await expect(rabbitFootDice).toBeHidden();
};

test.describe('山屋惊魂作祟3灰尘兔脚死亡回滚与掩埋代表链', () => {
    test('头骨失败后用兔脚重掷成功会回滚死亡和狂热病患并保留遗物', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-rabbit-foot-death-burial-success');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await injectCore(page, createDustRabbitFootDeathBurialRuntimeCore());

        const deathRollPanel = await prepareFailedSkullDeathRoll(page);
        await saveScreenshot(page, SUCCESS_BEFORE_REROLL_SCREENSHOT);
        await useRabbitFootOnFirstDie(page, RABBIT_FOOT_SUCCESS_QUEUE);
        await waitForPhysicalDiceSettled(deathRollPanel);
        await expect(deathRollPanel).toContainText('阻止死亡');
        await expect.poll(() => readDustRabbitFootDeathBurialState(page)).toMatchObject({
            usedCardIdsThisTurn: expect.arrayContaining(['rope']),
            recentRoll: {
                kind: 'deathPrevention',
                latestLabel: '阻止死亡',
                consumedRabbitFootCardIds: expect.arrayContaining(['rope']),
            },
        });
        await saveScreenshot(page, SUCCESS_REROLL_RESULT_SCREENSHOT);

        await page.getByRole('button', { name: /返回牌桌/ }).click();
        await expect(deathRollPanel).toHaveCount(0);
        await expect.poll(() => readDustRabbitFootDeathBurialState(page)).toMatchObject({
            phase: 'haunt',
            deadPlayerIds: expect.not.arrayContaining(['1']),
            feverishPlayerIds: expect.not.arrayContaining(['1']),
            playerOneInventory: expect.arrayContaining(['头骨', '兔脚', '地图']),
            endgameResult: null,
        });
        await expect(page.getByTestId('betrayal-room-monster-hallway-feverish-1')).toHaveCount(0);
        await saveScreenshot(page, SUCCESS_BOARD_SCREENSHOT);
        await assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-rabbit-foot-death-burial-success', diagnostics }]);
    });

    test('头骨失败后用兔脚重掷仍失败会保持死亡并掩埋遗物', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-rabbit-foot-death-burial-failure');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await injectCore(page, createDustRabbitFootDeathBurialRuntimeCore());

        const deathRollPanel = await prepareFailedSkullDeathRoll(page);
        await useRabbitFootOnFirstDie(page, RABBIT_FOOT_FAILURE_QUEUE);
        await waitForPhysicalDiceSettled(deathRollPanel);
        await expect(deathRollPanel).toContainText('正常死亡');
        await expect.poll(() => readDustRabbitFootDeathBurialState(page)).toMatchObject({
            usedCardIdsThisTurn: expect.arrayContaining(['rope']),
            recentRoll: {
                kind: 'deathPrevention',
                latestLabel: '正常死亡',
                consumedRabbitFootCardIds: expect.arrayContaining(['rope']),
            },
        });
        await saveScreenshot(page, FAILURE_REROLL_RESULT_SCREENSHOT);

        await page.getByRole('button', { name: /返回牌桌/ }).click();
        await expect(deathRollPanel).toHaveCount(0);
        await expect.poll(() => readDustRabbitFootDeathBurialState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '2',
            deadPlayerIds: expect.arrayContaining(['1']),
            feverishPlayerIds: expect.arrayContaining(['1']),
            feverishRoomId: 'hallway',
            playerOneInventory: [],
            endgameResult: null,
        });
        await expect(page.getByTestId('betrayal-inventory-rope')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-corpse-loot-card-selector')).toHaveCount(0);
        await saveScreenshot(page, FAILURE_BOARD_SCREENSHOT);
        await assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-rabbit-foot-death-burial-failure', diagnostics }]);
    });
});
