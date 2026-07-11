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
const SCENARIO_SELECT_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-基本流程-剧本选择.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-基本流程-运行时.png`;
const INVENTORY_PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-基本流程-持有物放大.png`;
const USE_ITEM_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-基本流程-使用物品.png`;
const MOVE_MODE_SCREENSHOT = `${EVIDENCE_DIR}/06-山屋惊魂-基本流程-移动选目标.png`;
const MOVE_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/07-山屋惊魂-基本流程-移动后.png`;
const MOBILE_CHARACTER_SCREENSHOT = `${EVIDENCE_DIR}/08-山屋惊魂-移动端横屏-角色翻页与默认角色.png`;
const MOBILE_SCENARIO_SCREENSHOT = `${EVIDENCE_DIR}/09-山屋惊魂-移动端横屏-剧本选择.png`;

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
        await expect(page.getByTestId('betrayal-character-confirm')).toHaveText(/剧本/);
        await page.getByTestId('betrayal-character-confirm').click();
        await expect(page.getByTestId('betrayal-scenario-select-step')).toBeVisible();
        await expect(page.getByTestId('betrayal-character-confirm')).toHaveText(/开始剧本/);
        await saveScreenshot(page, SCENARIO_SELECT_SCREENSHOT);
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

    test('移动端横屏角色选择包含默认角色、翻页和剧本选择步骤', async ({ page, context }) => {
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
        await expect(mobilePager.getByTestId('betrayal-character-mobile-page-label')).toHaveText('1/4');
        await expect(page.getByTestId('betrayal-character-selection-grid')).toBeHidden();

        await page.getByTestId('betrayal-character-ability-trigger').click();
        await expect(page.getByTestId('betrayal-character-ability-tooltip')).toBeVisible();
        await expect(page.getByTestId('betrayal-character-ability-tooltip')).toContainText('攻击投掷');

        await mobilePager.getByTestId('betrayal-character-page-down').click();
        await expect(mobilePager.getByTestId('betrayal-character-mobile-page-label')).toHaveText('2/4');
        await expect(mobilePager.getByTestId('betrayal-character-card-darryl-highla')).toBeVisible();
        await mobilePager.getByTestId('betrayal-character-page-up').click();
        await expect(mobilePager.getByTestId('betrayal-character-mobile-page-label')).toHaveText('1/4');
        await saveScreenshot(page, MOBILE_CHARACTER_SCREENSHOT);

        await page.getByTestId('betrayal-character-confirm').click();
        await expect(page.getByTestId('betrayal-character-confirm')).toHaveText(/剧本/);
        await page.getByTestId('betrayal-character-confirm').click();
        await expect(page.getByTestId('betrayal-scenario-select-step')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-select-step')).toContainText('赤红杰克归来');
        await saveScreenshot(page, MOBILE_SCENARIO_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-basic-flow-mobile-character-select', diagnostics }]);
    });
});
