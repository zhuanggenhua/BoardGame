import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioReadyToTraitorVictoryRuntimeCore,
    dispatchHarnessCommand,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario-traitor';
const PRE_ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-叛徒收尾前.png`;
const ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-终局-叛徒得逞.png`;

test.describe('山屋惊魂第一剧本叛徒线', () => {
    test('从真实 haunt 运行时进入叛徒终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-traitor-victory');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createFirstScenarioReadyToTraitorVictoryRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('达里尔·海拉');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/轮到达里尔·海拉|可前往/i);
        await saveScreenshot(page, PRE_ENDGAME_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
        await dispatchHarnessCommand(page, 'HAUNT_ATTACK', '2', { target: 'hero' });

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen.getByRole('main').getByText('叛徒得逞', { exact: true }).first()).toBeVisible();
        await endgameScreen.screenshot({ path: ENDGAME_SCREENSHOT });

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-traitor-victory', diagnostics }]);
    });
});
