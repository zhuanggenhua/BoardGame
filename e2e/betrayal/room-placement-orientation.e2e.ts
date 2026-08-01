import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/room-placement-orientation';
const TARGETS_SCREENSHOT = `${EVIDENCE_DIR}/01-选择未知门位.jpg`;
const ORIENTATION_SCREENSHOT = `${EVIDENCE_DIR}/02-房间朝向选择.jpg`;
const PLACED_SCREENSHOT = `${EVIDENCE_DIR}/03-确认朝向后放置.jpg`;

type BetrayalHarnessCoreSnapshot = {
    core?: {
        activeRoomId?: string;
        currentExplorer?: {
            roomId?: string;
        };
        rooms?: {
            id: string;
            state?: string;
            orientationTurns?: number;
            doorways?: {
                edge?: string;
                connectsToRoomId?: string;
            }[];
        }[];
    };
};

type BetrayalHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => BetrayalHarnessCoreSnapshot;
        };
    };
};

test.describe('山屋惊魂房间朝向选择', () => {
    test('玩家探索新房间时可旋转房间板块并以确认朝向放置', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-room-placement-orientation');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        await page.getByTestId('betrayal-action-move').click();
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/未探索.*一层/);
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();

        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-south')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/未探索.*一层.*可探索/);
        await saveScreenshot(page, TARGETS_SCREENSHOT);

        await page.getByTestId('betrayal-room-ground-north').click();
        const placementPanel = page.getByTestId('betrayal-room-placement-panel');
        await expect(placementPanel).toBeVisible();
        await expect(placementPanel).toContainText('放置新房间');
        await expect(page.getByTestId('betrayal-room-placement-preview')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-placement-entry-label')).toContainText(/入口/);

        const initialOrientation = await placementPanel.getAttribute('data-room-orientation-turns');
        await page.getByTestId('betrayal-room-placement-rotate-right').click();
        await expect
            .poll(async () => placementPanel.getAttribute('data-room-orientation-turns'))
            .not.toBe(initialOrientation);
        const selectedOrientationText = await placementPanel.getAttribute('data-room-orientation-turns');
        const selectedOrientationTurns = Number(selectedOrientationText);
        const connectingEdge = await placementPanel.getAttribute('data-room-entry-edge');
        expect(selectedOrientationTurns).toBeGreaterThanOrEqual(0);
        expect(selectedOrientationTurns).toBeLessThanOrEqual(3);
        expect(connectingEdge).toMatch(/^(north|east|south|west)$/);
        await expect(page.locator('[data-connecting-door="true"]')).toBeVisible();
        await saveScreenshot(page, ORIENTATION_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.01]);
        await page.getByTestId('betrayal-room-placement-confirm').click();

        await expect(placementPanel).toBeHidden();
        await expect(page.getByTestId('betrayal-room-ground-north')).not.toHaveAccessibleName(/未探索/);
        await expect(page.getByTestId('betrayal-room-occupant-ground-north-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible();
        for (let safety = 0; safety < 4; safety += 1) {
            if (!await page.getByTestId('betrayal-discovery-continue').isVisible().catch(() => false)) {
                break;
            }
            await page.getByTestId('betrayal-discovery-continue').click();
        }
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await saveScreenshot(page, PLACED_SCREENSHOT);

        const placedRoomState = await page.evaluate((expectedRoomId) => {
            const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get?.();
            const room = snapshot?.core?.rooms?.find((item) => item.id === expectedRoomId);
            return {
                activeRoomId: snapshot?.core?.activeRoomId ?? null,
                explorerRoomId: snapshot?.core?.currentExplorer?.roomId ?? null,
                state: room?.state ?? null,
                orientationTurns: room?.orientationTurns ?? null,
                doorways: room?.doorways ?? [],
            };
        }, 'ground-north');

        expect(placedRoomState.state).toBe('discovered');
        expect(placedRoomState.activeRoomId).toBe('ground-north');
        expect(placedRoomState.explorerRoomId).toBe('ground-north');
        expect(placedRoomState.orientationTurns).toBe(selectedOrientationTurns);
        expect(placedRoomState.doorways).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    edge: connectingEdge,
                    connectsToRoomId: 'hallway',
                }),
            ]),
        );

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-placement-orientation', diagnostics }]);
    });
});
