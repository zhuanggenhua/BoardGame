import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createCorpseLootReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario-corpse-loot';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-搜尸前.jpg`;
const SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-第一剧本-选择尸体和预兆.jpg`;
const LOOTED_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-第一剧本-搜尸后并限制二次搜刮.jpg`;

type BetrayalHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => {
                core?: {
                    currentPlayer?: string;
                    currentExplorer?: { playerId?: string };
                };
            };
        };
    };
};

test.describe('山屋惊魂第一剧本搜尸边界', () => {
    test('同房间尸体可通过正式搜尸动作拿走 1 张牌', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-corpse-loot');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createCorpseLootReadyRuntimeCore());
        await page.waitForFunction(() => {
            const core = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.().core;
            return core?.currentPlayer === '1' && core?.currentExplorer?.playerId === '1';
        });
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('丽贝卡·艾伦博士');
        await expect(page.getByTestId('betrayal-action-trade')).toContainText('搜尸');
        await expect(page.getByTestId('betrayal-trade-status')).toContainText(/可搜刮|尸体/i);
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-hallway-0')).toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-trade').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText(/拿走了/);
        await page.getByTestId('betrayal-room-occupant-hallway-0').click();
        await expect(page.getByTestId('betrayal-corpse-loot-card-selector')).toBeVisible();
        await page.getByTestId('betrayal-corpse-loot-card-corpse-omen-1').click();
        await expect(page.getByTestId('betrayal-corpse-loot-card-corpse-omen-1')).toHaveClass(/underline/);
        await saveScreenshot(page, SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-trade').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/尸体|拿走|黑暗预兆/i);
        await expect(page.getByTestId('betrayal-action-trade')).toContainText('交易');
        await expect(page.getByTestId('betrayal-action-trade')).toBeDisabled();
        await expect(page.getByTestId('betrayal-trade-status')).toContainText(/当前没有同房间队友|没有/);
        await saveScreenshot(page, LOOTED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-corpse-loot', diagnostics }]);
    });
});
