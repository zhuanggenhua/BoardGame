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
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-搜尸前.png`;
const LOOTED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-第一剧本-搜尸后.png`;
const BLOCKED_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-第一剧本-搜尸二次限制.png`;

test.describe('山屋惊魂第一剧本搜尸边界', () => {
    test('同房间尸体可通过正式搜尸动作拿走 1 张牌', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-corpse-loot');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createCorpseLootReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('丽贝卡·艾伦博士');
        await expect(page.getByTestId('betrayal-action-trade')).toContainText('搜尸');
        await expect(page.getByTestId('betrayal-trade-status')).toContainText(/可搜刮|尸体/i);
        await saveScreenshot(page, READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-trade').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/尸体|拿走|匕首|黑暗预兆/i);
        await expect(page.getByTestId('betrayal-action-trade')).toContainText('交易');
        await saveScreenshot(page, LOOTED_SCREENSHOT);

        await expect(page.getByTestId('betrayal-action-trade')).toBeDisabled();
        await expect(page.getByTestId('betrayal-trade-status')).toContainText(/当前没有同房间队友|没有/);
        await saveScreenshot(page, BLOCKED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-corpse-loot', diagnostics }]);
    });
});
