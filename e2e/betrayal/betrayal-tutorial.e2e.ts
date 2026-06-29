import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    initBetrayalContext,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-tutorial';
const STEP_01 = `${EVIDENCE_DIR}/01-山屋惊魂-教程-角色选择.png`;
const STEP_02 = `${EVIDENCE_DIR}/02-山屋惊魂-教程-恶兆前动作区.png`;
const STEP_03 = `${EVIDENCE_DIR}/03-山屋惊魂-教程-持有区与帮助入口.png`;
const STEP_04 = `${EVIDENCE_DIR}/04-山屋惊魂-教程-房间主视区.png`;
const STEP_05 = `${EVIDENCE_DIR}/05-山屋惊魂-教程-haunt收尾前.png`;
const STEP_06 = `${EVIDENCE_DIR}/06-山屋惊魂-教程-终局页.png`;

const waitForStep = async (page: Parameters<typeof test>[0]['page'], stepId: string, timeout = 15000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

const waitForHauntRuntime = async (page: Parameters<typeof test>[0]['page'], timeout = 30000) => {
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout });
    await expect(page.getByTestId('betrayal-runtime-header-grid').getByText('Haunt')).toBeVisible({ timeout });
};

const clickNext = async (page: Parameters<typeof test>[0]['page']) => {
    const nextButton = page.getByTestId('tutorial-next-button');
    await expect(nextButton).toBeVisible({ timeout: 10000 });
    await nextButton.click();
};

test.describe('山屋惊魂教程最小真实链路', () => {
    test('教程路由会复用真实角色选择 真实运行时与真实终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal/tutorial', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 30000 });
        await waitForStep(page, 'select-explorer');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('真实角色选择页');
        await expect(page.locator('[data-tutorial-id="betrayal-character-selection-grid"]')).toBeVisible();
        await saveScreenshot(page, STEP_01);

        await clickNext(page);
        await waitForStep(page, 'confirm-start');
        await page.getByTestId('betrayal-character-confirm').click();
        await waitForStep(page, 'start-scenario');
        await page.getByTestId('betrayal-character-confirm').click();

        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForStep(page, 'runtime-overview');
        await expect(page.locator('[data-tutorial-id="betrayal-actions-zone"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('底部 5 个主动作');
        await saveScreenshot(page, STEP_02);

        await clickNext(page);
        await waitForStep(page, 'inventory-and-help');
        await expect(page.locator('[data-tutorial-id="betrayal-inventory-zone"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="betrayal-reference-entry"]')).toBeVisible();
        await saveScreenshot(page, STEP_03);

        await clickNext(page);
        await waitForStep(page, 'room-board');
        await expect(page.locator('[data-tutorial-id="betrayal-room-board"]')).toBeVisible();
        await saveScreenshot(page, STEP_04);

        await clickNext(page);
        await waitForStep(page, 'finish');
        await clickNext(page);
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0, { timeout: 10000 });

        await page.goto('/play/betrayal/tutorial/haunt-actions-and-finish', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await waitForHauntRuntime(page, 30000);
        await waitForStep(page, 'help-entry');
        await expect(page.locator('[data-tutorial-id="betrayal-reference-entry"]')).toBeVisible();
        await clickNext(page);

        await waitForStep(page, 'haunt-actions');
        await expect(page.getByTestId('betrayal-action-use')).toContainText(/驱魔|Exorcise/i);
        await clickNext(page);

        await waitForStep(page, 'exorcise-jack');
        await saveScreenshot(page, STEP_05);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-action-use').click();

        await waitForStep(page, 'endgame-review', 30000);
        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('幸存者逃脱');
        await saveScreenshot(page, STEP_06);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial', diagnostics }]);
    });
});
