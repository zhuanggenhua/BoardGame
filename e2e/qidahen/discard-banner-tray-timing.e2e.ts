import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import type { QidahenCore } from '../../src/games/qidahen/domain/types';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    disableTutorial,
    setChineseLocale,
} from '../helpers/common';

const QIDAHEN_BASIC_OPENING_TEST_URL = '/play/qidahen?tutorialSetup=basic-opening&players=3&seat0=human&seat1=human&seat2=human&playerID=0';
const MAP_REGION_POINTS = {
    songjin: { x: 0.6522, y: 0.5913 },
} as const;

type QidahenHarnessState = {
    core: QidahenCore;
};

type QidahenHarnessWindow = Window & {
    __E2E_TEST_MODE__?: boolean;
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => QidahenHarnessState;
            set?: (state: QidahenHarnessState) => Promise<void> | void;
            isRegistered?: () => boolean;
        };
        command?: {
            dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
        };
    };
};

const captureEvidence = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    await page.mouse.move(24, 24);
    const screenshotPath = getEvidenceScreenshotPath(testInfo, name, {
        requireChineseName: true,
        format: 'png',
    });
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: 'disabled',
    });
    return screenshotPath;
};

const waitForHarness = async (page: Page) => {
    await page.waitForFunction(() => (
        (window as QidahenHarnessWindow).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true
    ), { timeout: 20000 });
};

const readRequiredQidahenHarnessState = async (page: Page): Promise<QidahenHarnessState> => (
    page.evaluate(() => {
        const state = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.() ?? null;
        if (!state) {
            throw new Error('qidahen test harness state reader unavailable');
        }
        return state;
    })
);

const openPreparedBoard = async (page: Page) => {
    await page.addInitScript(() => {
        (window as QidahenHarnessWindow).__E2E_TEST_MODE__ = true;
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
    await waitForHarness(page);
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
    const state = await readRequiredQidahenHarnessState(page);
    if (state.core.turnPhase === 'hand-limit-discard' && state.core.handLimitDiscardSelection) {
        const selection = state.core.handLimitDiscardSelection;
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toBeVisible({ timeout: 10000 });
        for (const cardId of selection.candidateCardIds.slice(0, selection.requiredDiscardCount)) {
            await page.locator(`[data-testid="qidahen-hand-card-${cardId}"]`).click();
        }
        await page.locator('[data-testid="qidahen-resolve-hand-limit-discard"]').click();
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toHaveCount(0);
    }
};

const clickMapRegion = async (page: Page, regionId: keyof typeof MAP_REGION_POINTS) => {
    const point = MAP_REGION_POINTS[regionId];
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.evaluate((element, targetPoint) => {
        const rect = element.getBoundingClientRect();
        const init: PointerEventInit = {
            clientX: rect.left + rect.width * targetPoint.x,
            clientY: rect.top + rect.height * targetPoint.y,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
        };
        element.dispatchEvent(new PointerEvent('pointermove', init));
        element.dispatchEvent(new PointerEvent('pointerdown', init));
        element.dispatchEvent(new PointerEvent('pointerup', {
            ...init,
            buttons: 0,
        }));
    }, point);
};

test.describe('七大恨弃牌横幅与托盘时机', () => {
    test('有托盘不叠横幅，无托盘才显示选择弃置的手牌', async ({ page }, testInfo) => {
        test.setTimeout(180000);
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        const diagnostics = attachPageDiagnostics(page);

        await openPreparedBoard(page);
        await page.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.regions = next.core.regions.map((region) => (
                region.id === 'song-jin'
                    ? {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 2,
                        specialTroops: [{
                            id: 'ming-song-jin-cavalry-lv1',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 1,
                        }],
                    }
                    : region
            ));
            return harness.state.set(next);
        });
        await clickMapRegion(page, 'songjin');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-status"]')).toContainText('需弃 1 张');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-hint"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
        await captureEvidence(page, testInfo, '前态-轮盘进攻调度托盘弃牌无横幅');

        const actionPage = await page.context().newPage();
        await openPreparedBoard(actionPage);
        await actionPage.locator('[data-testid="qidahen-action-grant-pardon"]').click();
        await expect(actionPage.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible({ timeout: 15000 });
        await expect(actionPage.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('赐印招安');
        await expect(actionPage.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await expect(actionPage.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
        await expect(actionPage.locator('[data-testid="qidahen-action-payment-panel"]')).not.toContainText('点击底部手牌');
        await captureEvidence(actionPage, testInfo, '中态-势力行动托盘弃牌无横幅');
        await actionPage.close();

        const gaoDiPage = await page.context().newPage();
        await openPreparedBoard(gaoDiPage);
        await gaoDiPage.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            const mingCards = next.core.handCards.filter((card) => card.faction === 'ming' && card.status !== 'disabled');
            if (mingCards.length < 1) {
                throw new Error('missing ming hand cards for gao-di discard');
            }
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 高第调度';
            next.core.turnPhase = 'gao-di-dispatch-choice';
            next.core.selectedRegionId = 'city-region-24';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.confirmedActionId = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.sunYuanhuaTechSelection = null;
            next.core.handLimitDiscardSelection = null;
            next.core.payment = { required: 0, selected: 0, prompt: '' };
            next.core.gaoDiDispatchSelection = {
                source: 'gao-di',
                title: '高第弃牌调度',
                summary: '行动前弃 1 张手牌，可在友方相邻区域间调度 1 格，数量可在 1-6 之间选择。',
                sourceRegionId: 'city-region-24',
                sourceRegionName: '宁远',
                displayAnchorRegionId: 'city-region-24',
                displayAnchorRegionName: '宁远',
                maxTroops: 2,
                maxPopulation: 0,
                candidateCardIds: mingCards.map((card) => card.id),
                selectedCardId: null,
                candidates: [{
                    id: 'gao-di:troops:city-region-24:city-region-25:2',
                    mode: 'troops',
                    targetRegionId: 'city-region-25',
                    targetRegionName: '山海关',
                    totalTravelCost: 1,
                    committedTroops: 2,
                    committedPopulation: 0,
                    movedGenericTroops: 2,
                    movedSpecialTroops: [],
                    resolutionHint: '宁远 → 山海关 · 调度 2 个部队',
                    pathRegionIds: ['city-region-24', 'city-region-25'],
                    pathLabel: '宁远 → 山海关',
                }],
            };
            if (next.sys?.interaction) {
                next.sys.interaction.current = undefined;
                next.sys.interaction.queue = [];
                next.sys.interaction.isBlocked = false;
            }
            return harness.state.set(next);
        });
        await expect(gaoDiPage.locator('[data-testid="qidahen-gao-di-dispatch-selection"]')).toBeVisible();
        await expect(gaoDiPage.locator('[data-testid="qidahen-gao-di-dispatch-selection"]')).toContainText('高第弃牌调度');
        await expect(gaoDiPage.locator('[data-testid="qidahen-gao-di-dispatch-selection"]')).not.toContainText('行动前弃 1 张手牌');
        await expect(gaoDiPage.locator('[data-testid="qidahen-operation-banner"]')).toHaveText('选择弃置的手牌');
        await expect(gaoDiPage.locator('[data-testid="qidahen-hand-interaction-tray"]')).toHaveCount(0);
        await expect(gaoDiPage.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
        await captureEvidence(gaoDiPage, testInfo, '后态-高第无托盘显示选择弃置的手牌横幅');
        await gaoDiPage.close();

        await assertNoFatalFrontendErrors([{ label: 'qidahen-discard-banner-tray-timing', diagnostics }]);
    });
});
