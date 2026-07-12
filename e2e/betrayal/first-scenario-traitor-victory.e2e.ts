import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioReadyToTraitorVictoryRuntimeCore,
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
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';

test.describe('山屋惊魂第一剧本叛徒线', () => {
    test('从真实 haunt 运行时进入叛徒终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-traitor-victory');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createFirstScenarioReadyToTraitorVictoryRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('达里尔·海拉');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/轮到达里尔·海拉|可前往/i);
        await saveScreenshot(page, PRE_ENDGAME_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
        const heroMapTarget = page.getByTestId('betrayal-room-occupant-ground-north-1');
        await expect(heroMapTarget, '叛徒收尾攻击主路径必须点击地图上的英雄 token 本体').toBeVisible();
        await expect(heroMapTarget, '英雄 token 必须标记为直选目标').toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-ground-north-1'), '英雄 token 必须有贴合本体的五边形高亮').toHaveAttribute('data-highlight-shape', 'pentagon');
        await heroMapTarget.click();

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen.getByRole('main').getByText('叛徒得逞', { exact: true }).first()).toBeVisible();
        await endgameScreen.screenshot({ path: ENDGAME_SCREENSHOT });

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-traitor-victory', diagnostics }]);
    });
});
