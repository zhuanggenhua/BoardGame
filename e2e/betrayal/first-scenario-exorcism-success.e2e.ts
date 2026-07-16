import { resolve } from 'path';
import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    createFirstScenarioReadyToExorciseRuntimeCore,
    expectVisiblePhysicalDiceBox,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/山屋惊魂-驱魔成功终局完整链路');
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-驱魔成功前牌桌可操作.jpg`;
const TARGET_SCREENSHOT = `${EVIDENCE_DIR}/02-杰克之灵目标高亮.jpg`;
const DICE_SCREENSHOT = `${EVIDENCE_DIR}/03-驱魔成功骰盘停稳.jpg`;
const RESULT_SCREENSHOT = `${EVIDENCE_DIR}/04-驱魔成功结果可见.jpg`;
const CONTINUE_SCREENSHOT = `${EVIDENCE_DIR}/05-确认进入终局前.jpg`;
const ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/06-幸存者终局页可见.jpg`;

type HarnessSnapshot = {
    core: BetrayalCore;
};

type HarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => HarnessSnapshot;
        };
    };
};

async function readCoreState(page: Page): Promise<BetrayalCore> {
    return page.evaluate(() => {
        const snapshot = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        if (!snapshot?.core) {
            throw new Error('betrayal test harness state reader unavailable');
        }
        return snapshot.core;
    });
}

test.describe('山屋惊魂驱魔成功终局完整链路', () => {
    test('最终驱魔成功从真实入口到幸存者终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-exorcism-success-full-chain');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createFirstScenarioReadyToExorciseRuntimeCore();
        const actorId = core.currentExplorer.playerId;
        const traitorId = core.scenarioRuntime.traitorPlayerId;

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('驱魔');
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText(/驱魔|驱散杰克之灵/);
        await expect(page.getByTestId('betrayal-room-basement-landing')).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-focus-card-highlight-basement-landing')).toHaveAttribute('data-highlight-shape', 'room');
        await saveScreenshot(page, READY_SCREENSHOT);

        await saveScreenshot(page, TARGET_SCREENSHOT);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-room-basement-landing').click();

        const exorciseRollReview = page.getByTestId('betrayal-exorcise-roll-review');
        await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
        const rollPanel = exorciseRollReview.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toContainText('驱魔');
        await expect(rollPanel).toContainText('神志检定');
        await expectVisiblePhysicalDiceBox(rollPanel);
        await waitForPhysicalDiceSettled(rollPanel);
        await expect(rollPanel).toContainText('驱魔成功');
        await saveScreenshot(page, DICE_SCREENSHOT);

        const afterSuccessCore = await readCoreState(page);
        expect(afterSuccessCore.phase).toBe('endgame');
        expect(afterSuccessCore.recentRoll?.latestLabel).toBe('驱魔成功');
        expect(afterSuccessCore.endgameResult?.outcome).toBe('survivors');
        expect(afterSuccessCore.endgameResult?.traitorPlayerId).toBe(traitorId);
        expect(afterSuccessCore.endgameResult?.winners).toContain(actorId);
        expect(afterSuccessCore.scenarioRuntime.jackSpiritReleased).toBe(true);
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/驱魔成功|杰克之灵被驱散/);
        await saveScreenshot(page, RESULT_SCREENSHOT);

        await expect(page.getByTestId('betrayal-exorcise-roll-continue')).toContainText(/进入终局|查看终局|继续/);
        await saveScreenshot(page, CONTINUE_SCREENSHOT);
        await page.getByTestId('betrayal-exorcise-roll-continue').click();

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen.getByRole('main').getByText('幸存者逃脱', { exact: true }).first()).toBeVisible();
        await expect(endgameScreen).toContainText(/杰克之灵|幸存者/);
        await saveScreenshot(page, ENDGAME_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-exorcism-success-full-chain', diagnostics }]);
    });
});
