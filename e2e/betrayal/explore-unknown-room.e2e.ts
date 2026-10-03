import { expect, test } from '@playwright/test';
import { BETRAYAL_COMMANDS } from '../../src/games/betrayal/commands';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    clickDiscoveryBackdropAndExpectStillVisible,
    createRuntimeCore,
    dispatchHarnessCommand,
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
const ROOM_PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-日志房间名悬停卡图.jpg`;

test.describe('山屋惊魂未知房间探索', () => {
    test('玩家可从真实牌桌入口选择未知房间并翻开新房间', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-explore-unknown-room');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(
            '/play/betrayal?players=3&seat0=human&seat1=human&seat2=human'
                + '&player0Name=%E8%96%87%E8%96%87%E5%AE%89&player1Name=%E5%B8%83%E5%85%B0%E7%99%BB&player2Name=%E4%BD%90%E4%BC%8A',
            { waitUntil: 'domcontentloaded' },
        );
        await waitForBetrayalPageReady(page);

        await injectCore(page, createRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        await page.getByTestId('betrayal-action-move').click();
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('当前回合');
        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/未探索.*一层/);
        await expect(page.getByTestId('betrayal-room-ground-south')).toHaveAccessibleName(/未探索.*一层/);
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-explore-target-ground-south')).toHaveCount(0);
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
        for (let attempt = 0; attempt < 4; attempt += 1) {
            if (!(await discoveryPanel.isVisible().catch(() => false))) {
                break;
            }
            const pending = await page.evaluate(() => {
                const snapshot = (window as Window & {
                    __BG_TEST_HARNESS__?: { state?: { get?: () => { core?: {
                        pendingCardResolutionQueue?: Array<{
                            id?: string;
                            requiredPlayerIds?: string[];
                            acknowledgedPlayerIds?: string[];
                        }>;
                        playerIds?: string[];
                    } } } };
                }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
                const step = snapshot?.pendingCardResolutionQueue?.[0];
                return step
                    ? {
                        id: step.id ?? null,
                        requiredPlayerIds: step.requiredPlayerIds ?? snapshot?.playerIds ?? [],
                        acknowledgedPlayerIds: step.acknowledgedPlayerIds ?? [],
                    }
                    : null;
            });
            if (!pending?.id) {
                break;
            }
            const acknowledged = new Set(pending.acknowledgedPlayerIds);
            for (const playerId of pending.requiredPlayerIds) {
                if (!acknowledged.has(playerId)) {
                    await dispatchHarnessCommand(
                        page,
                        BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION,
                        playerId,
                        { resolutionId: pending.id },
                    );
                }
            }
        }
        await expect(discoveryPanel).toBeHidden();
        await expect(page.getByTestId('betrayal-room-ground-north')).toBeVisible();

        const fabMenu = page.getByTestId('fab-menu');
        await fabMenu.locator('button').first().click();
        const actionLogButton = page.locator('button[data-fab-id="action-log"]');
        await expect(actionLogButton).toBeVisible();
        await actionLogButton.click();
        const logPanel = page.getByTestId('fab-panel-action-log');
        await expect(logPanel).toBeVisible();
        const discoveryLogRow = logPanel.getByTestId('hud-action-log-row').filter({ hasText: /探索到|获得|物品|预兆|事件/ }).first();
        await expect(discoveryLogRow).toContainText(/探索到|获得|物品|预兆|事件/);
        await expect(discoveryLogRow).toContainText('薇薇安');
        await expect(discoveryLogRow).toContainText('书本');
        const previewAnchors = logPanel.getByTestId('card-preview-tooltip-anchor');
        expect(await previewAnchors.count()).toBeGreaterThan(0);
        const roomPreviewAnchor = previewAnchors.filter({ hasText: '观测台' }).first();
        await expect(roomPreviewAnchor).toBeVisible();
        await roomPreviewAnchor.hover();
        await expect(page.getByTestId('card-preview-tooltip')).toBeVisible();
        await saveScreenshot(page, ROOM_PREVIEW_SCREENSHOT);
        const itemPreviewAnchor = previewAnchors.filter({ hasText: '书本' }).first();
        await expect(itemPreviewAnchor).toBeVisible();
        await itemPreviewAnchor.hover();
        await expect(page.getByTestId('card-preview-tooltip')).toBeVisible();
        await saveScreenshot(page, DISMISSED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-explore-unknown-room', diagnostics }]);
    });
});
