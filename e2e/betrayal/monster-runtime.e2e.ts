import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createMonsterEncounterCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-monster-runtime';
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-运行时-玩家与怪物同场.png`;
const USE_WITH_MONSTER_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-怪物同场-使用物品后.png`;
const MOVE_WITH_MONSTER_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-怪物同场-移动选目标.png`;
const MOVE_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-怪物同场-移动后.png`;

test.describe('山屋惊魂怪物运行时', () => {
    test('能显示玩家、队友与怪物同场的真实运行时', async ({ page, context }) => {
        test.setTimeout(300000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-monster-runtime');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createMonsterEncounterCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-bottom-teammate-1')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-occupant-grand-staircase-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-explorer-figure-token-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-monster-grand-staircase-werewolf')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-monster-upper-landing-spirit')).toBeVisible();
        await expect(page.getByTestId('betrayal-monster-board-token-werewolf')).toBeVisible();
        await expect(page.getByTestId('betrayal-monster-board-token-spirit')).toBeVisible();
        await expect(page.getByTestId('betrayal-explorer-figure-token-0').locator('img')).toHaveAttribute('data-debug-current-src', /tokens\/explorers\/compressed\/jaden-jones\.webp/);
        await expect(page.getByTestId('betrayal-room-occupant-upper-landing-1').locator('img')).toHaveAttribute('data-debug-current-src', /tokens\/explorers\/compressed\/rebecca-allen\.webp/);
        await expect(page.getByTestId('betrayal-room-occupant-basement-landing-2').locator('img')).toHaveAttribute('data-debug-current-src', /tokens\/explorers\/compressed\/darryl-highla\.webp/);
        await expect(page.getByTestId('betrayal-monster-board-token-werewolf').locator('img')).toHaveAttribute('data-debug-current-src', /tokens\/monsters\/compressed\/werewolf\.webp/);
        await expect(page.getByTestId('betrayal-monster-board-token-spirit').locator('img')).toHaveAttribute('data-debug-current-src', /tokens\/monsters\/compressed\/ghost\.webp/);
        await expect(page.getByTestId('betrayal-monster-summary-werewolf')).toHaveCount(0);
        await saveScreenshot(page, RUNTIME_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await expect(page.getByTestId('betrayal-use-status')).toContainText('本回合已用');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('绳索');
        await expect(page.locator('#betrayal-inventory-section').locator('..').getByText('大楼梯')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-monster-grand-staircase-werewolf')).toBeVisible();
        await saveScreenshot(page, USE_WITH_MONSTER_SCREENSHOT);

        await page.getByTestId('betrayal-action-move').click();
        await expect(page.getByTestId('betrayal-room-move-target-upper-landing')).toBeVisible();
        await saveScreenshot(page, MOVE_WITH_MONSTER_SCREENSHOT);

        await page.getByTestId('betrayal-room-move-target-upper-landing').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('移动到');
        await expect(page.getByTestId('betrayal-room-occupant-upper-landing-0')).toBeVisible();
        await saveScreenshot(page, MOVE_RESULT_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-monster-runtime', diagnostics }]);
    });
});
