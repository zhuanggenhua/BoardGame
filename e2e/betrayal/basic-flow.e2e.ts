import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    initBetrayalContext,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-basic-flow';
const CHARACTER_CONFIRM_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-基本流程-角色确认前.png`;
const SCENARIO_SELECT_ENTRY_SCREENSHOT = `${EVIDENCE_DIR}/02a-山屋惊魂-基本流程-剧本弹窗入口.png`;
const SCENARIO_SELECT_DETAIL_SCREENSHOT = `${EVIDENCE_DIR}/02b-山屋惊魂-基本流程-书本式剧本阅读首页.png`;
const SCENARIO_SELECT_DETAIL_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/02c-山屋惊魂-基本流程-书本式剧本阅读末页.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-基本流程-运行时.png`;
const INVENTORY_PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-基本流程-持有物放大.png`;
const USE_ITEM_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-基本流程-使用物品.png`;
const MOVE_MODE_SCREENSHOT = `${EVIDENCE_DIR}/06-山屋惊魂-基本流程-移动选目标.png`;
const MOVE_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/07-山屋惊魂-基本流程-移动后.png`;
const MOBILE_CHARACTER_SCREENSHOT = `${EVIDENCE_DIR}/08-山屋惊魂-移动端横屏-角色翻页与默认角色.png`;
const MOBILE_SCENARIO_ENTRY_SCREENSHOT = `${EVIDENCE_DIR}/09a-山屋惊魂-移动端横屏-剧本弹窗入口.png`;
const MOBILE_SCENARIO_DETAIL_SCREENSHOT = `${EVIDENCE_DIR}/09b-山屋惊魂-移动端横屏-书本式剧本阅读首页.png`;
const MOBILE_SCENARIO_DETAIL_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/09c-山屋惊魂-移动端横屏-书本式剧本阅读末页.png`;

test.describe('山屋惊魂基本流程', () => {
    test('从角色选择确认到恶兆前运行时', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-basic-flow');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-character-confirm')).toHaveText(/确认/);
        await saveScreenshot(page, CHARACTER_CONFIRM_SCREENSHOT);

        await page.getByTestId('betrayal-character-confirm').click();
        await expect(page.getByTestId('betrayal-character-confirm')).toHaveText(/开始剧本/);
        await expect(page.getByTestId('betrayal-character-scenario-button')).toContainText('赤红杰克归来');
        await page.getByTestId('betrayal-character-scenario-button').click();
        await expect(page.getByTestId('betrayal-scenario-select-dialog')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-option-first-scenario')).toContainText('赤红杰克归来');
        await expect(page.getByTestId('betrayal-scenario-detail-toggle')).toContainText('阅读完整剧本');
        await saveScreenshot(page, SCENARIO_SELECT_ENTRY_SCREENSHOT);
        await page.getByTestId('betrayal-scenario-detail-toggle').click();
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-detail-panel')).not.toContainText('作祟档案');
        await expect(page.getByTestId('betrayal-scenario-book')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-book-cover-page')).toContainText('赤红杰克归来');
        await expect(page.getByTestId('betrayal-scenario-reader-page-label')).toHaveText('1/5');
        await expect(page.getByTestId('betrayal-scenario-reader-prev')).toBeDisabled();
        await expect(page.getByTestId('betrayal-scenario-reader-next')).toBeEnabled();
        await saveScreenshot(page, SCENARIO_SELECT_DETAIL_SCREENSHOT);
        for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
            await page.getByTestId('betrayal-scenario-reader-next').click();
        }
        await expect(page.getByTestId('betrayal-scenario-reader-page-label')).toHaveText('5/5');
        await expect(page.getByTestId('betrayal-scenario-reader-next')).toBeDisabled();
        await expect(page.getByTestId('betrayal-scenario-book-page-endingManualLabel')).toContainText('胜负判定');
        await saveScreenshot(page, SCENARIO_SELECT_DETAIL_BOTTOM_SCREENSHOT);
        await page.getByTestId('betrayal-scenario-reader-close').click();
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).toBeHidden();
        await expect(page.getByTestId('betrayal-scenario-select-current')).toBeVisible();
        await page.getByTestId('betrayal-scenario-select-current').click();
        await expect(page.getByTestId('betrayal-scenario-select-dialog')).toBeHidden();
        await page.getByTestId('betrayal-character-confirm').click();

        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-explore')).toBeVisible();
        await expect(page.getByTestId('betrayal-open-scenario')).toBeVisible();
        await saveScreenshot(page, RUNTIME_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-omen-book-magnify').click();
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).toBeVisible();
        await saveScreenshot(page, INVENTORY_PREVIEW_SCREENSHOT);
        await page.mouse.click(24, 24);
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).toBeHidden();
        await page.getByTestId('betrayal-inventory-omen-book').click();
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await page.getByTestId('betrayal-action-use').click();
        await expect(page.getByTestId('betrayal-use-status')).toContainText('本回合已用');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('书本');
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await saveScreenshot(page, USE_ITEM_SCREENSHOT);

        await page.getByTestId('betrayal-action-move').click();
        await expect(page.getByTestId('betrayal-room-hallway')).toBeVisible();
        await saveScreenshot(page, MOVE_MODE_SCREENSHOT);
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('移动到门厅');
        await saveScreenshot(page, MOVE_RESULT_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-basic-flow', diagnostics }]);
    });

    test('移动端横屏角色选择包含默认角色、翻页和剧本弹窗', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-basic-flow-mobile-character-select');

        await page.setViewportSize({ width: 896, height: 414 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?bgForceCoarsePointer=1', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 30000 });
        const mobilePager = page.getByTestId('betrayal-character-mobile-pager');
        await expect(mobilePager).toBeVisible();
        await expect(mobilePager.getByTestId('betrayal-character-card-jaden-jones')).toBeVisible();
        await expect(mobilePager.getByTestId('betrayal-character-mobile-page-label')).toHaveText('1/2');
        await expect(page.getByTestId('betrayal-character-selection-grid')).toBeHidden();

        await page.getByTestId('betrayal-character-ability-trigger').click();
        await expect(page.getByTestId('betrayal-character-ability-tooltip')).toBeVisible();
        await expect(page.getByTestId('betrayal-character-ability-tooltip')).toContainText('攻击投掷');

        await mobilePager.getByTestId('betrayal-character-page-down').click();
        await expect(mobilePager.getByTestId('betrayal-character-mobile-page-label')).toHaveText('2/2');
        await expect(mobilePager.getByTestId('betrayal-character-card-michelle-monroe')).toBeVisible();
        await mobilePager.getByTestId('betrayal-character-page-up').click();
        await expect(mobilePager.getByTestId('betrayal-character-mobile-page-label')).toHaveText('1/2');
        await saveScreenshot(page, MOBILE_CHARACTER_SCREENSHOT);

        await page.getByTestId('betrayal-character-confirm').click();
        await expect(page.getByTestId('betrayal-character-confirm')).toHaveText(/开始剧本/);
        await expect(page.getByTestId('betrayal-character-scenario-button')).toContainText('赤红杰克归来');
        await page.getByTestId('betrayal-character-scenario-button').click();
        await expect(page.getByTestId('betrayal-scenario-select-dialog')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-option-first-scenario')).toContainText('赤红杰克归来');
        await expect(page.getByTestId('betrayal-scenario-detail-toggle')).toContainText('阅读完整剧本');
        await saveScreenshot(page, MOBILE_SCENARIO_ENTRY_SCREENSHOT);
        await page.getByTestId('betrayal-scenario-detail-toggle').click();
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-detail-panel')).not.toContainText('作祟档案');
        await expect(page.getByTestId('betrayal-scenario-book')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-book-cover-page-mobile')).toContainText('赤红杰克归来');
        await expect(page.getByTestId('betrayal-scenario-reader-page-label-mobile')).toHaveText('1 / 9');
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).not.toContainText('沉浸阅读');
        await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_SCREENSHOT);
        for (let pageIndex = 0; pageIndex < 8; pageIndex += 1) {
            await page.getByTestId('betrayal-scenario-reader-next').click();
        }
        await expect(page.getByTestId('betrayal-scenario-reader-page-label-mobile')).toHaveText('9 / 9');
        await expect(page.getByTestId('betrayal-scenario-reader-next')).toBeDisabled();
        await expect(page.getByTestId('betrayal-scenario-book-page-endingManualLabel-mobile')).toContainText('胜负判定');
        await expect(page.getByTestId('betrayal-scenario-book-page-endingManualLabel-mobile')).not.toContainText('08 / 胜负判定');
        await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_BOTTOM_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-basic-flow-mobile-character-select', diagnostics }]);
    });
});
