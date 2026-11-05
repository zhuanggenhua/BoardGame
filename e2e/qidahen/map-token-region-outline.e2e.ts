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
    shanhaiguan: { x: 0.4292, y: 0.6181 },
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
    };
};

const captureEvidence = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
    options?: { keepPointer?: boolean },
): Promise<string> => {
    if (!options?.keepPointer) {
        await page.mouse.move(24, 24);
    }
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

const pointerOnMapRegion = async (
    page: Page,
    regionId: keyof typeof MAP_REGION_POINTS,
    click: boolean,
) => {
    const point = MAP_REGION_POINTS[regionId];
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.evaluate((element, payload) => {
        const rect = element.getBoundingClientRect();
        const init: PointerEventInit = {
            clientX: rect.left + rect.width * payload.point.x,
            clientY: rect.top + rect.height * payload.point.y,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: payload.click ? 1 : 0,
            bubbles: true,
            cancelable: true,
        };
        element.dispatchEvent(new PointerEvent('pointermove', init));
        if (payload.click) {
            element.dispatchEvent(new PointerEvent('pointerdown', init));
            element.dispatchEvent(new PointerEvent('pointerup', {
                ...init,
                buttons: 0,
            }));
        }
    }, { point, click });
};

const assertRegionOverlayPainted = async (page: Page) => {
    const overlay = page.locator('[data-testid="qidahen-map-region-mask-overlay"]');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-qidahen-region-outline', 'true');
    await expect.poll(async () => overlay.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const context = canvas.getContext('2d');
        if (!context) {
            return 0;
        }
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let opaqueCount = 0;
        for (let index = 3; index < pixels.length; index += 4) {
            if (pixels[index] > 80) {
                opaqueCount += 1;
            }
        }
        return opaqueCount;
    }), { timeout: 15000 }).toBeGreaterThan(1000);
};

test.describe('七大恨棋子与地区描边', () => {
    test('行动窗口棋子和地区边界可从地图里分开', async ({ page }, testInfo) => {
        test.setTimeout(180000);
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        const diagnostics = attachPageDiagnostics(page);

        await openPreparedBoard(page);
        await assertRegionOverlayPainted(page);
        await expect(page.locator('[data-qidahen-map-token-outlined="true"]')).not.toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-map-token-"][data-qidahen-map-token-type="army"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await page.mouse.move(24, 24);
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toHaveCount(0);
        await captureEvidence(page, testInfo, '前态-行动窗口棋子地区描边无多余横幅', { keepPointer: true });

        await pointerOnMapRegion(page, 'shanhaiguan', true);
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关');
        await expect(page.locator('[data-qidahen-map-token-outlined="true"][data-qidahen-map-token-region="city-region-25"]')).not.toHaveCount(0);
        await captureEvidence(page, testInfo, '中态-点选山海关地区描边与棋子描边', { keepPointer: true });

        await pointerOnMapRegion(page, 'songjin', false);
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛', { timeout: 10000 });
        await expect(page.locator('[data-qidahen-map-token-outlined="true"]')).not.toHaveCount(0);
        await captureEvidence(page, testInfo, '后态-悬浮皮岛地区描边棋子仍可辨', { keepPointer: true });

        await assertNoFatalFrontendErrors([{ label: 'qidahen-map-token-region-outline', diagnostics }]);
    });
});
