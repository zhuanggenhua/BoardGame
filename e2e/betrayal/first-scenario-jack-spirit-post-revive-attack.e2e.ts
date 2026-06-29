import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createJackSpiritPostReviveAttackReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario-jack-spirit-post-revive-attack';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-叛徒复活后可攻击英雄.png`;
const ATTACKED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-第一剧本-复活叛徒攻击英雄后.png`;

test.describe('山屋惊魂第一剧本叛徒复活后继续战斗', () => {
    test('叛徒复活后，可通过正式房间焦点入口继续攻击同房间英雄', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-jack-spirit-post-revive-attack');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createJackSpiritPostReviveAttackReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid').getByText('Haunt')).toBeVisible();
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('达里尔·海拉');
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText(/攻击杰登·琼斯/);
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/恢复肉身|重新回到宅邸|轮到达里尔/i);
        await saveScreenshot(page, READY_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01]);
        await page.getByTestId('betrayal-room-focus-target').click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/击倒了一名英雄|造成 .* physical damage|扑向英雄/i);
        await saveScreenshot(page, ATTACKED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-jack-spirit-post-revive-attack', diagnostics }]);
    });
});
