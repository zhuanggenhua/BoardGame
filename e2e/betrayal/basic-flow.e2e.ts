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
const CHARACTER_DETAIL_SCROLLED_SCREENSHOT = `${EVIDENCE_DIR}/01b-山屋惊魂-角色详情滚动后看到特性.png`;
const SCENARIO_SELECT_ENTRY_SCREENSHOT = `${EVIDENCE_DIR}/02a-山屋惊魂-基本流程-剧本弹窗入口.png`;
const SCENARIO_SELECT_DETAIL_SCREENSHOT = `${EVIDENCE_DIR}/02b-山屋惊魂-基本流程-书本式剧本阅读首页.png`;
const SCENARIO_SELECT_DETAIL_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/02c-山屋惊魂-基本流程-书本式剧本阅读末页.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-基本流程-运行时.png`;
const INVENTORY_PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-基本流程-持有物放大.png`;
const USE_ITEM_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-基本流程-使用物品.png`;
const MOVE_MODE_SCREENSHOT = `${EVIDENCE_DIR}/06-山屋惊魂-基本流程-移动选目标.png`;
const MOVE_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/07-山屋惊魂-基本流程-移动后.png`;
const MOBILE_CHARACTER_SCREENSHOT = `${EVIDENCE_DIR}/08-山屋惊魂-移动端横屏-角色竖向滚动选中与能力提示.jpg`;
const MOBILE_SCENARIO_ENTRY_SCREENSHOT = `${EVIDENCE_DIR}/09a-山屋惊魂-移动端横屏-剧本弹窗入口.png`;
const MOBILE_SCENARIO_DETAIL_SCREENSHOT = `${EVIDENCE_DIR}/09b-山屋惊魂-移动端横屏-书本式剧本阅读首页.png`;
const MOBILE_SCENARIO_DETAIL_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/09c-山屋惊魂-移动端横屏-书本式剧本阅读末页.png`;

test.describe('山屋惊魂基本流程', () => {
    test('桌面低高视口角色详情必须能滚动到特性', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-character-detail-scroll-target');

        await page.setViewportSize({ width: 1280, height: 620 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 30000 });
        const characterDetailScroll = page.getByTestId('betrayal-character-detail-scroll');
        const abilitySummary = page.getByTestId('betrayal-character-ability-summary');
        await expect(characterDetailScroll).toBeVisible();
        const scrollMetrics = await characterDetailScroll.evaluate((node) => ({
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
            scrollTop: node.scrollTop,
        }));
        expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight + 20);
        expect(scrollMetrics.scrollTop).toBe(0);

        await characterDetailScroll.evaluate((node) => {
            node.scrollTop = node.scrollHeight;
        });
        await expect.poll(async () => characterDetailScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
        await expect(abilitySummary).toBeInViewport();
        await expect(abilitySummary).toContainText('特性');
        await expect(abilitySummary).toContainText(/大胆|攻击投掷/);
        await saveScreenshot(page, CHARACTER_DETAIL_SCROLLED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-character-detail-scroll-target', diagnostics }]);
    });

    test('从角色选择确认到恶兆前运行时', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-basic-flow');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 30000 });
        const characterDetailScroll = page.getByTestId('betrayal-character-detail-scroll');
        await expect(characterDetailScroll).toHaveClass(/overflow-y-auto/);
        await expect(characterDetailScroll).toHaveClass(/overflow-x-hidden/);
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
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-opening')).toContainText('山屋异象');
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-opening')).toContainText('开局记录');
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-heroes')).toContainText('英雄手册');
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-heroes')).toContainText('驱魔法阵');
        await expect(page.getByTestId('betrayal-scenario-reader-page-label-desktop-left')).toHaveText('01');
        await expect(page.getByTestId('betrayal-scenario-reader-prev-zone')).toBeDisabled();
        await expect(page.getByTestId('betrayal-scenario-reader-next-zone')).toBeEnabled();
        await expect(page.getByTestId('betrayal-scenario-reader-dialog').getByRole('button', { name: '上一页' })).toHaveClass(/bg-transparent/);
        await expect(page.getByTestId('betrayal-scenario-reader-dialog').getByRole('button', { name: '下一页' })).toHaveClass(/bg-transparent/);
        await saveScreenshot(page, SCENARIO_SELECT_DETAIL_SCREENSHOT);
        await page.getByTestId('betrayal-scenario-reader-next-zone').click();
        await expect(page.getByTestId('betrayal-scenario-reader-page-label-desktop-left')).toHaveText('03');
        await expect(page.getByTestId('betrayal-scenario-reader-next-zone')).toBeDisabled();
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-exorcism')).toContainText('最终驱魔');
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-exorcism')).toContainText('叛徒手册');
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-traitor')).toContainText('杰克之灵');
        await expect(page.getByTestId('betrayal-scenario-book-section-endingManualLabel')).toContainText('胜负判定');
        await saveScreenshot(page, SCENARIO_SELECT_DETAIL_BOTTOM_SCREENSHOT);
        await page.waitForTimeout(400);
        await page.mouse.click(12, 12);
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).toBeHidden();
        const scenarioSelectDialog = page.getByTestId('betrayal-scenario-select-dialog');
        const scenarioSelectStillOpen = await scenarioSelectDialog.isVisible({ timeout: 800 }).catch(() => false);
        if (scenarioSelectStillOpen) {
            await Promise.race([
                scenarioSelectDialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null),
                page.getByTestId('betrayal-scenario-select-current').click({ timeout: 3000 }).catch(() => null),
            ]);
            await expect(scenarioSelectDialog).toBeHidden({ timeout: 5000 });
        }
        const boardOrConfirm = await Promise.race([
            page.getByTestId('betrayal-board').waitFor({ state: 'visible', timeout: 5000 }).then(() => 'board' as const).catch(() => null),
            page.getByTestId('betrayal-character-confirm').waitFor({ state: 'visible', timeout: 5000 }).then(() => 'confirm' as const).catch(() => null),
        ]);
        if (boardOrConfirm === 'confirm') {
            await page.getByTestId('betrayal-character-confirm').click();
        }

        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-explore')).toBeVisible();
        await expect(page.getByTestId('betrayal-open-scenario')).toBeVisible();
        await expect(page.getByTestId('betrayal-current-ability')).toBeVisible();
        await expect(page.getByTestId('betrayal-current-ability')).toContainText('特性');
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
        await expect(page.getByTestId('betrayal-action-move')).toContainText('取消移动');
        await expect(page.getByTestId('betrayal-room-hallway')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-hallway')).toBeEnabled();
        await saveScreenshot(page, MOVE_MODE_SCREENSHOT);
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('移动到门厅');
        await saveScreenshot(page, MOVE_RESULT_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-basic-flow', diagnostics }]);
    });

    test('移动端横屏角色选择包含竖向滚动、选中态和能力提示', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-basic-flow-mobile-character-select');

        await page.setViewportSize({ width: 896, height: 414 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?bgForceCoarsePointer=1', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 30000 });
        const mobileGrid = page.getByTestId('betrayal-character-mobile-grid');
        await expect(mobileGrid).toBeVisible();
        await expect(mobileGrid).toHaveClass(/grid-cols-3/);
        await expect(mobileGrid.getByTestId('betrayal-character-card-jaden-jones')).toBeVisible();
        await expect(mobileGrid.getByTestId('betrayal-character-card-jaden-jones')).toHaveAttribute('aria-label', /已选择/);
        for (const explorerId of [
            'jaden-jones',
            'rebecca-allen',
            'darryl-highla',
            'oliver-swift',
            'lia-valencia',
            'sam-yin',
        ]) {
            await expect(mobileGrid.getByTestId(`betrayal-character-card-${explorerId}`)).toBeInViewport();
        }
        await expect(page.getByTestId('betrayal-character-mobile-page-label')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-character-page-down')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-character-page-up')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-character-selection-grid')).toBeHidden();

        await expect(page.getByTestId('betrayal-character-ability-summary')).toBeVisible();
        await expect(page.getByTestId('betrayal-character-ability-summary')).toContainText('特性');
        await expect(page.getByTestId('betrayal-character-ability-summary')).toContainText(/大胆|攻击投掷/);
        await expect(page.getByTestId('betrayal-character-ability-summary')).not.toContainText(/Bold|Attack/i);
        await expect(page.getByTestId('betrayal-character-ability-trigger')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-character-ability-tooltip')).toHaveCount(0);
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
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-opening')).toContainText('山屋异象');
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-opening')).toContainText('开局记录');
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-heroes')).toContainText('英雄手册');
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-heroes')).toContainText('驱魔法阵');
        await expect(page.getByTestId('betrayal-scenario-reader-page-label-desktop-left')).toHaveText('01');
        await expect(page.getByTestId('betrayal-scenario-reader-page-label-desktop-right')).toHaveText('02');
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).not.toContainText('沉浸阅读');
        await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_SCREENSHOT);
        await page.getByTestId('betrayal-scenario-reader-next-zone').click();
        await expect(page.getByTestId('betrayal-scenario-reader-page-label-desktop-left')).toHaveText('03');
        await expect(page.getByTestId('betrayal-scenario-reader-page-label-desktop-right')).toHaveText('04');
        await expect(page.getByTestId('betrayal-scenario-reader-next-zone')).toBeDisabled();
        await expect(page.getByTestId('betrayal-scenario-book-page-dossier-traitor')).toContainText('杰克之灵');
        await expect(page.getByTestId('betrayal-scenario-book-section-endingManualLabel')).toContainText('胜负判定');
        await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_BOTTOM_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-basic-flow-mobile-character-select', diagnostics }]);
    });
});
