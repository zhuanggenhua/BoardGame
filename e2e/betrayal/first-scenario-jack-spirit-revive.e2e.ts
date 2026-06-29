import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createJackSpiritReviveReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario-jack-spirit-revive';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-杰克之灵复活前.png`;
const REVIVED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-第一剧本-叛徒复活后.png`;

test.describe('山屋惊魂第一剧本杰克之灵复活边界', () => {
    test('杰克之灵回尸体房间后，可通过正式结束回合触发叛徒复活', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-jack-spirit-revive');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createJackSpiritReviveReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid').getByText('Haunt')).toBeVisible();
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('丽贝卡·艾伦博士');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/轮到丽贝卡|可前往/i);
        await saveScreenshot(page, READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-endTurn').click();
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('达里尔·海拉');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/恢复肉身|重新回到宅邸/i);
        await saveScreenshot(page, REVIVED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-jack-spirit-revive', diagnostics }]);
    });
});
