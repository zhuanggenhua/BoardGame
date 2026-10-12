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
const PLAYER_ID_TO_FACTION = {
    '0': 'ming',
    '1': 'mongol',
    '2': 'jin',
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

const dispatchHarnessCommand = async (
    page: Page,
    command: { type: string; playerId: string; payload: Record<string, unknown> },
) => {
    await page.evaluate((nextCommand) => {
        const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
        return harness?.command?.dispatch(nextCommand);
    }, command);
};

const resolveInitialHandLimitDiscardIfPresent = async (page: Page) => {
    const state = await readRequiredQidahenHarnessState(page);
    if (state.core.turnPhase !== 'hand-limit-discard' || !state.core.handLimitDiscardSelection) {
        return;
    }
    const selection = state.core.handLimitDiscardSelection;
    await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toBeVisible({ timeout: 10000 });
    const candidateCardIds = selection.candidateCardIds.slice(0, selection.requiredDiscardCount);
    for (const cardId of candidateCardIds) {
        await page.locator(`[data-testid="qidahen-hand-card-${cardId}"]`).click();
    }
    await page.locator('[data-testid="qidahen-resolve-hand-limit-discard"]').click();
    await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toHaveCount(0);
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

const seedRegionCavalry = async (
    page: Page,
    regionId: string,
    faction: 'ming' | 'mongol' | 'jin',
    count: number,
    level = 1,
) => {
    await waitForHarness(page);
    await page.evaluate(({ regionId: targetRegionId, faction: targetFaction, count: troopCount, level: troopLevel }) => {
        const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
        const snapshot = harness?.state?.get();
        if (!snapshot || !harness?.state?.set) {
            throw new Error('qidahen test harness state injector unavailable');
        }
        const factionLabel = targetFaction === 'ming' ? '大明' : targetFaction === 'mongol' ? '蒙古' : '后金';
        const next = structuredClone(snapshot);
        next.core.regions = next.core.regions.map((region) => (
            region.id === targetRegionId
                ? {
                    ...region,
                    controller: targetFaction,
                    controlLabel: factionLabel,
                    troops: troopCount,
                    specialTroops: [
                        {
                            id: `${targetFaction}-${targetRegionId}-cavalry-lv${troopLevel}`,
                            label: `${factionLabel}骑兵`,
                            faction: targetFaction,
                            troopKind: 'cavalry',
                            count: troopCount,
                            level: troopLevel,
                        },
                    ],
                }
                : region
        ));
        return harness.state.set(next);
    }, { regionId, faction, count, level });
};

const readMapViewport = async (page: Page) => {
    const mapLayer = page.locator('[data-testid="qidahen-map-layer"]');
    return {
        zoom: await mapLayer.getAttribute('data-map-zoom'),
        panX: await mapLayer.getAttribute('data-map-pan-x'),
        panY: await mapLayer.getAttribute('data-map-pan-y'),
    };
};

test.describe('七大恨地点军备详情与轮盘弃牌', () => {
    test('地图地点与军备弃牌可查看且轮盘进攻调度先弃牌', async ({ page }, testInfo) => {
        test.setTimeout(120000);
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as QidahenHarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await waitForHarness(page);
        await resolveInitialHandLimitDiscardIfPresent(page);

        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).not.toContainText('军备详情');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).not.toContainText('火炮技术');
        await expect(page.locator('[data-testid="qidahen-armaments-ming"]')).toHaveCount(0);

        await clickMapRegion(page, 'songjin');
        const mapTip = page.locator('[data-testid="qidahen-map-region-tip"]');
        await expect(mapTip).toBeVisible();
        await expect(mapTip).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-map-region-population-label"]')).toHaveText('人口');
        await expect(page.locator('[data-testid="qidahen-map-region-population-value"]')).toHaveText('2');
        await expect(mapTip).not.toContainText('兵力');
        await expect(page.locator('[data-testid^="qidahen-map-token-"][data-qidahen-map-token-type="army"][data-qidahen-map-token-region="song-jin"]')).toHaveCount(2);
        await expect(mapTip).not.toContainText('点击查看地点详情');
        await expect(mapTip).not.toContainText('接边');
        await expect(mapTip).not.toContainText('暂无');
        await expect(page.locator('[data-testid="qidahen-map-overlay"]')).not.toContainText('海岸/水路');
        await expect(page.locator('[data-testid="qidahen-runtime-region-graph"]')).not.toContainText('接边');

        await page.locator('[data-testid="qidahen-player-ming"]').hover();
        const playerTip = page.locator('[data-testid="qidahen-player-inspect-tip-ming"]');
        await expect(playerTip).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).not.toContainText('火炮技术');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).not.toContainText('炮兵');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toBeVisible();
        await captureEvidence(page, testInfo, '前态-地图地点与军备悬浮提示可见');

        const viewportBeforeInspect = await readMapViewport(page);
        await mapTip.click();
        await expect(page.locator('[data-testid="qidahen-inspect-overlay"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-inspect-panel"]')).toHaveAttribute('data-inspect-kind', 'region');
        await expect(page.locator('[data-testid="qidahen-inspect-region-song-jin"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-inspect-region-song-jin"]')).toContainText('地点详情');
        await expect(page.locator('[data-testid="qidahen-inspect-stat-troops-label"]')).toHaveText('兵力');
        await expect(page.locator('[data-testid="qidahen-inspect-stat-troops-value"]')).toHaveText('2');
        await expect(page.locator('[data-testid="qidahen-inspect-stat-population-label"]')).toHaveText('人口');
        await expect(page.locator('[data-testid="qidahen-inspect-stat-population-value"]')).toHaveText('2');
        await expect(page.locator('[data-testid="qidahen-inspect-region-song-jin"]')).not.toContainText('兵力 2 · 人口');
        const viewportAfterRegionInspect = await readMapViewport(page);
        expect(viewportAfterRegionInspect).toEqual(viewportBeforeInspect);
        await captureEvidence(page, testInfo, '中态-地点详情人口分格可读');

        await page.locator('[data-testid="qidahen-inspect-close"]').click();
        await expect(page.locator('[data-testid="qidahen-inspect-overlay"]')).toHaveCount(0);

        await page.locator('[data-testid="qidahen-player-ming"]').click();
        await expect(page.locator('[data-testid="qidahen-inspect-overlay"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-inspect-panel"]')).toHaveAttribute('data-inspect-kind', 'faction');
        await expect(page.locator('[data-testid="qidahen-inspect-faction-ming"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-inspect-stat-vp-label"]')).toHaveText('胜利点');
        await expect(page.locator('[data-testid="qidahen-inspect-stat-vp-value"]')).toHaveText(/^\d+$/);
        await expect(page.locator('[data-testid="qidahen-inspect-stat-hand-label"]')).toHaveText('手牌');
        await expect(page.locator('[data-testid="qidahen-inspect-stat-hand-value"]')).toHaveText(/^\d+\/\d+$/);
        await expect(page.locator('[data-testid="qidahen-inspect-stat-troops-label"]')).toHaveText('兵力');
        await expect(page.locator('[data-testid="qidahen-inspect-stat-troops-value"]')).toHaveText(/^\d+$/);
        await expect(page.locator('[data-testid="qidahen-inspect-stat-grain-label"]')).toHaveText('粮');
        await expect(page.locator('[data-testid="qidahen-inspect-stat-grain-value"]')).toHaveText(/^\d+$/);
        await expect(page.locator('[data-testid="qidahen-inspect-faction-ming"]')).not.toContainText('VP0');
        await expect(page.locator('[data-testid="qidahen-inspect-faction-ming"]')).not.toContainText('· 手牌');
        await expect(page.locator('[data-testid="qidahen-inspect-armaments-ming"]')).toBeVisible();
        const artilleryCard = page.locator('[data-testid="qidahen-inspect-armament-artillery-tech"]');
        await expect(artilleryCard).toBeVisible();
        await expect(artilleryCard.locator('[data-card-atlas-frame="true"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-inspect-armaments-ming"]')).not.toContainText('Lv.0');
        await expect(page.locator('[data-testid="qidahen-inspect-armaments-ming"]')).not.toContainText('炮兵');
        await artilleryCard.hover();
        await expect(page.locator('[data-testid="qidahen-inspect-armament-tip-artillery-tech"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-inspect-discard-ming"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-inspect-discard-count-ming"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toBeVisible();
        const viewportAfterFactionInspect = await readMapViewport(page);
        expect(viewportAfterFactionInspect).toEqual(viewportBeforeInspect);
        await captureEvidence(page, testInfo, '中态-详情弹窗显示军备与弃牌堆');

        await page.locator('[data-testid="qidahen-inspect-close"]').click();
        await expect(page.locator('[data-testid="qidahen-inspect-overlay"]')).toHaveCount(0);

        await seedRegionCavalry(page, 'song-jin', 'ming', 2);
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();

        const paymentPanel = page.locator('[data-testid="qidahen-wheel-dispatch-payment-panel"]');
        await expect(paymentPanel).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-status"]')).toContainText('需弃 1 张');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-hint"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-confirm"]')).toContainText('确认弃牌');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toHaveCount(0);
        await captureEvidence(page, testInfo, '后态-轮盘进攻调度弃牌提示可用');

        const paymentState = await readRequiredQidahenHarnessState(page);
        const currentPlayerId = paymentState.core.currentPlayer as keyof typeof PLAYER_ID_TO_FACTION;
        const currentFaction = PLAYER_ID_TO_FACTION[currentPlayerId];
        const paymentCard = paymentState.core.handCards.find((card) => (
            card.faction === currentFaction && card.status !== 'disabled'
        ));
        if (!paymentCard) {
            throw new Error('进攻调度弃牌时当前势力没有可弃手牌');
        }
        const visibleCard = page.locator(`[data-testid="qidahen-hand-card-${paymentCard.id}"]`);
        if (await visibleCard.count()) {
            await visibleCard.click();
        } else {
            await dispatchHarnessCommand(page, {
                type: 'SELECT_PAYMENT_CARD',
                playerId: currentPlayerId,
                payload: { cardId: paymentCard.id },
            });
        }
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-status"]')).toContainText('已选 1 张');
        await page.locator('[data-testid="qidahen-wheel-dispatch-payment-confirm"]').click();
        await expect(paymentPanel).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toContainText('选择参与部队');

        assertNoFatalFrontendErrors([{ label: 'qidahen-inspect-and-wheel-discard', diagnostics }]);
    });
});
