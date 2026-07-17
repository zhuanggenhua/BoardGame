import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioHauntRuntimeCore,
    createFirstScenarioReadyToExorciseRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario';
const HAUNT_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-haunt运行时.png`;
const REFERENCE_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-首剧本查阅-帮助面板.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-第一剧本-haunt牌桌.png`;
const ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-终局-幸存者胜利.png`;

test.describe('山屋惊魂第一剧本', () => {
    test('从真实 haunt 运行时进入幸存者终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createFirstScenarioHauntRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-open-scenario')).toBeVisible();
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await saveScreenshot(page, HAUNT_SCREENSHOT);

        await page.getByTestId('betrayal-open-scenario').click();
        await expect(page.getByTestId('betrayal-reference-overlay')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-objective-page')).toBeVisible();
        await expect(page.getByTestId('betrayal-scenario-objective-page')).toContainText('首剧本查阅');
        await page.getByTestId('betrayal-reference-toggle').click();
        const referenceImage = page.getByTestId('betrayal-reference-card-image');
        await expect(referenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/player-reference-zh-front');
        await page.getByTestId('betrayal-reference-toggle').click();
        await expect(referenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/player-reference-zh-back');
        await page.getByTestId('betrayal-reference-toggle').click();
        await expect(referenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/traitor-reference-zh');
        await page.getByTestId('betrayal-reference-toggle').click();
        await expect(referenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/monster-reference-zh');
        await saveScreenshot(page, REFERENCE_SCREENSHOT);
        await page.getByTestId('betrayal-reference-close').click();
        await expect(page.getByTestId('betrayal-reference-overlay')).toBeHidden();
        await saveScreenshot(page, RUNTIME_SCREENSHOT);

        await injectCore(page, createFirstScenarioReadyToExorciseRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-use')).toContainText(/驱魔|Exorcise/i);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-action-use').click();
        const exorciseRollReview = page.getByTestId('betrayal-exorcise-roll-review');
        await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
        const exorciseRollBackdrop = page.getByTestId('betrayal-roll-review-backdrop');
        await expect(exorciseRollBackdrop).toHaveAttribute('data-backdrop-dismiss', 'disabled');
        await page.mouse.click(16, 16);
        await expect(exorciseRollReview).toBeVisible();
        await page.getByTestId('betrayal-exorcise-roll-continue').click();
        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen.getByRole('main').getByText('幸存者逃脱', { exact: true }).first()).toBeVisible();
        await endgameScreen.screenshot({ path: ENDGAME_SCREENSHOT });

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario', diagnostics }]);
    });
});
