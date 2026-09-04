import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    clickDiscoveryBackdropAndExpectStillVisible,
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-未知房间探索';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-未知房间-探索前.png`;
const TARGETS_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-未知房间-选择门位.png`;
const REVEALED_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-未知房间-翻开后.png`;
const DISMISSED_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-未知房间-发现牌关闭后.png`;

test.describe('山屋惊魂未知房间探索', () => {
    test('玩家可从真实牌桌入口选择未知房间并翻开新房间', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-explore-unknown-room');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        await page.getByTestId('betrayal-action-move').click();
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('杰登·琼斯');
        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/未探索.*一层/);
        await expect(page.getByTestId('betrayal-room-ground-south')).toHaveAccessibleName(/未探索.*一层/);
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await saveScreenshot(page, READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-south')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/未探索.*一层.*可探索/);
        await expect(page.getByTestId('betrayal-room-ground-south')).toHaveAccessibleName(/未探索.*一层.*可探索/);
        await saveScreenshot(page, TARGETS_SCREENSHOT);

        await page.getByTestId('betrayal-room-ground-north').click();
        await expect(page.getByTestId('betrayal-room-placement-panel')).toBeVisible();
        await setHarnessRandomQueue(page, [0.01]);
        await page.getByTestId('betrayal-room-placement-confirm').click();

        await expect(page.getByTestId('betrayal-room-ground-north')).not.toHaveAccessibleName(/未探索/);
        await expect(page.getByTestId('betrayal-room-occupant-ground-north-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/探索|发现|获得|事件|物品|预兆/);
        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toBeVisible();
        await expect(discoveryPanel).toHaveAttribute('data-backdrop-dismiss', 'disabled');
        await expect(page.getByTestId('betrayal-discovery-panel-content')).toBeVisible();
        await saveScreenshot(page, REVEALED_SCREENSHOT);

        await clickDiscoveryBackdropAndExpectStillVisible(page, discoveryPanel);
        const continueButton = page.getByTestId('betrayal-discovery-continue');
        await expect(continueButton).toBeEnabled();
        await continueButton.click();
        await expect(discoveryPanel).toBeHidden();
        await expect(page.getByTestId('betrayal-room-ground-north')).toBeVisible();
        await saveScreenshot(page, DISMISSED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-explore-unknown-room', diagnostics }]);
    });
});
