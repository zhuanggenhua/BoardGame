import { expect, test, type Page } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustSkullDeathPreventionFailedRuntimeCore,
    createDustSkullDeathPreventionSuccessRuntimeCore,
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

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-skull-death-prevention';
const SUCCESS_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-头骨成功-灰尘冲动前.jpg`;
const SUCCESS_DAMAGE_PANEL_SCREENSHOT = `${EVIDENCE_DIR}/02-头骨成功-伤害分配到骷髅.jpg`;
const SUCCESS_DICE_SCREENSHOT = `${EVIDENCE_DIR}/03-头骨成功-死亡保护骰盘.jpg`;
const SUCCESS_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/04-头骨成功-未死亡未狂热病患.jpg`;
const FAILED_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/05-头骨失败-灰尘冲动前.jpg`;
const FAILED_DAMAGE_PANEL_SCREENSHOT = `${EVIDENCE_DIR}/06-头骨失败-伤害分配到骷髅.jpg`;
const FAILED_DICE_SCREENSHOT = `${EVIDENCE_DIR}/07-头骨失败-死亡保护骰盘.jpg`;
const FAILED_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/08-头骨失败-狂热病患生成.jpg`;
const testUrl = (suffix: string) =>
    `/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-skull-death-prevention-${suffix}`;
const SUCCESS_RANDOM_QUEUE = Array.from({ length: 24 }, () => 0.99);
const FAILED_RANDOM_QUEUE = Array.from({ length: 24 }, () => 0.01);

type DustSkullDeathPreventionState = {
    phase?: string;
    currentPlayer?: string;
    pendingDamageAllocation?: {
        playerId?: string;
        sourceTitle?: string;
        damageKind?: string;
        amount?: number;
        allowedTraits?: string[];
        allowSkull?: boolean;
        nextPlayerId?: string | null;
    } | null;
    traitsByPlayerId?: Record<string, { might: number; speed: number; knowledge: number; sanity: number }>;
    deadPlayerIds?: string[];
    feverishPlayerIds?: string[];
    feverishRoomId?: string | null;
    permanentTraitorPlayerIds?: string[];
    recentRoll?: {
        kind?: string;
        sourceTitle?: string;
        dice?: number[];
        latestLabel?: string;
        deathPrevention?: {
            damageKind?: string;
            damageAmount?: number;
            damageTraits?: string[];
        };
    } | null;
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
    latestLog?: string;
};

const readDustSkullDeathPreventionState = async (
    page: Page,
): Promise<DustSkullDeathPreventionState> =>
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
        const feverish = core?.monsters?.find((monster) => monster.id === 'feverish-1');
        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            pendingDamageAllocation: core?.pendingDamageAllocation ?? null,
            traitsByPlayerId: Object.fromEntries(
                explorers.map((explorer) => [explorer.playerId, { ...explorer.traits }]),
            ),
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            feverishPlayerIds: core?.scenarioRuntime?.dust?.feverishPlayerIds ?? [],
            feverishRoomId: feverish?.roomId ?? null,
            permanentTraitorPlayerIds: core?.scenarioRuntime?.dust?.permanentTraitorPlayerIds ?? [],
            recentRoll: core?.recentRoll
                ? {
                    kind: core.recentRoll.kind,
                    sourceTitle: core.recentRoll.sourceTitle,
                    dice: [...core.recentRoll.dice],
                    latestLabel: core.recentRoll.latestLabel,
                    deathPrevention: core.recentRoll.deathPrevention
                        ? {
                            damageKind: core.recentRoll.deathPrevention.damageKind,
                            damageAmount: core.recentRoll.deathPrevention.damageAmount,
                            damageTraits: core.recentRoll.deathPrevention.damageTraits,
                        }
                        : undefined,
                }
                : null,
            endgameResult: core?.endgameResult ?? null,
            latestLog: core?.activityLog?.[0]?.text ?? '',
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

const resolveDustImpulseToSkull = async (
    page: Page,
    options: {
        randomQueue: number[];
        expectedLabel: '阻止死亡' | '正常死亡';
        beforeScreenshot: string;
        damagePanelScreenshot: string;
        diceScreenshot: string;
        resultScreenshot: string;
    },
) => {
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await dismissHauntRevealCueIfVisible(page);
    await expect(page.getByTestId('betrayal-inventory-skull')).toBeVisible();
    await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
    await expect.poll(() => readDustSkullDeathPreventionState(page)).toMatchObject({
        phase: 'haunt',
        currentPlayer: '1',
        pendingDamageAllocation: null,
        traitsByPlayerId: {
            '1': {
                might: 1,
                speed: 1,
                knowledge: 1,
                sanity: 1,
            },
        },
    });
    await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
    await saveScreenshot(page, options.beforeScreenshot);

    await page.getByTestId('betrayal-action-endTurn').click();

    const damagePanel = page.getByTestId('betrayal-damage-allocation-panel');
    await expect(damagePanel).toBeVisible();
    await expect(damagePanel).toHaveAttribute('data-player-id', '1');
    await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('灰尘冲动');
    await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('力量');
    await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('速度');
    await expect.poll(() => readDustSkullDeathPreventionState(page)).toMatchObject({
        currentPlayer: '1',
        pendingDamageAllocation: {
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            nextPlayerId: '2',
        },
    });
    const pendingState = await readDustSkullDeathPreventionState(page);
    const pendingAmount = pendingState.pendingDamageAllocation?.amount ?? 0;
    expect([2, 4]).toContain(pendingAmount);
    await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText(`${pendingAmount} 点一般伤害`);
    const selectedTraits = ['might', 'speed', 'knowledge', 'sanity'].slice(0, pendingAmount);
    for (const trait of selectedTraits) {
        await page.getByTestId(`betrayal-damage-allocation-trait-${trait}`).click();
        await expect(page.getByTestId(`betrayal-damage-allocation-trait-${trait}`)).toHaveAttribute('data-damage-selected-count', '1');
    }
    await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
    await saveScreenshot(page, options.damagePanelScreenshot);

    await setHarnessRandomQueue(page, options.randomQueue);
    await page.getByTestId('betrayal-damage-allocation-confirm').click();

    const deathRollPanel = page.getByTestId('betrayal-recent-roll-panel');
    await expect(deathRollPanel).toContainText('头骨死亡保护', { timeout: 30000 });
    await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '3');
    await expectVisiblePhysicalDiceBox(deathRollPanel);
    await waitForPhysicalDiceSettled(deathRollPanel);
    await expectPhysicalDiceSeparated(deathRollPanel, { minDiceCount: 3 });
    await saveScreenshot(page, options.diceScreenshot);

    await expect(deathRollPanel).toContainText(options.expectedLabel);
    await expect.poll(() => readDustSkullDeathPreventionState(page)).toMatchObject({
        pendingDamageAllocation: null,
        recentRoll: {
            kind: 'deathPrevention',
            sourceTitle: '头骨死亡保护',
            latestLabel: options.expectedLabel,
            deathPrevention: {
                damageKind: 'general',
                damageAmount: pendingAmount,
                damageTraits: selectedTraits,
            },
        },
    });
    await page.getByRole('button', { name: /返回牌桌/ }).click();
    await expect(deathRollPanel).toHaveCount(0);
    await saveScreenshot(page, options.resultScreenshot);
};

test.describe('山屋惊魂作祟3灰尘头骨死亡保护代表链', () => {
    test('灰尘冲动一般伤害分到骷髅时，头骨成功会阻止死亡且不生成狂热病患', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-skull-death-prevention-success');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(testUrl('success'), { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await injectCore(page, createDustSkullDeathPreventionSuccessRuntimeCore());

        await resolveDustImpulseToSkull(page, {
            randomQueue: SUCCESS_RANDOM_QUEUE,
            expectedLabel: '阻止死亡',
            beforeScreenshot: SUCCESS_BEFORE_SCREENSHOT,
            damagePanelScreenshot: SUCCESS_DAMAGE_PANEL_SCREENSHOT,
            diceScreenshot: SUCCESS_DICE_SCREENSHOT,
            resultScreenshot: SUCCESS_RESULT_SCREENSHOT,
        });

        await expect(page.getByTestId('betrayal-endgame-screen')).toHaveCount(0);
        await expect.poll(() => readDustSkullDeathPreventionState(page)).toMatchObject({
            currentPlayer: '2',
            deadPlayerIds: [],
            feverishPlayerIds: [],
            traitsByPlayerId: {
                '1': {
                    might: 1,
                    speed: 1,
                    knowledge: 1,
                    sanity: 1,
                },
            },
            endgameResult: null,
        });
        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-skull-death-prevention-success', diagnostics }]);
    });

    test('灰尘冲动一般伤害分到骷髅时，头骨失败后才变狂热病患并交接下一名玩家', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-skull-death-prevention-failed');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(testUrl('failed'), { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await injectCore(page, createDustSkullDeathPreventionFailedRuntimeCore());

        await resolveDustImpulseToSkull(page, {
            randomQueue: FAILED_RANDOM_QUEUE,
            expectedLabel: '正常死亡',
            beforeScreenshot: FAILED_BEFORE_SCREENSHOT,
            damagePanelScreenshot: FAILED_DAMAGE_PANEL_SCREENSHOT,
            diceScreenshot: FAILED_DICE_SCREENSHOT,
            resultScreenshot: FAILED_RESULT_SCREENSHOT,
        });

        await expect(page.getByTestId('betrayal-endgame-screen')).toHaveCount(0);
        await expect.poll(() => readDustSkullDeathPreventionState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '2',
            deadPlayerIds: expect.arrayContaining(['1']),
            feverishPlayerIds: expect.arrayContaining(['1']),
            feverishRoomId: 'hallway',
            endgameResult: null,
        });
        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-skull-death-prevention-failed', diagnostics }]);
    });
});
