import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import {
    BETRAYAL_FLOOR_OVERLAY_RESTORE_EVIDENCE_DIR,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalFloatingTextGone,
    waitForBetrayalPageReady,
} from './betrayalTestHelpers';
import { createStartedFirstScenarioCore } from '../../src/games/betrayal/testing/firstScenarioTestUtils';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-floor-switcher');
const UPPER_FLOOR_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-楼层切换-二层默认.jpg`;
const GROUND_FLOOR_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-楼层切换-一层切换后.jpg`;
const MOVE_TARGET_FLOOR_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-楼层切换-移动目标楼层.jpg`;
const STEP_1_SWITCH_FLOOR_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-跨层移动-1侧边切层按钮红圈.jpg`;
const STEP_2_MOVE_ACTION_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-跨层移动-2移动按钮红圈.jpg`;
const STEP_3_TARGET_ROOM_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-跨层移动-3目标房间红圈.jpg`;

const expectOnlyFloorVisible = async (
    page: Page,
    selectedFloor: 'upper' | 'ground' | 'basement',
    visibleRoomId: string,
    hiddenRoomIds: string[],
) => {
    await expect(page.getByTestId(`betrayal-room-floor-${selectedFloor}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId(`betrayal-room-shell-${visibleRoomId}`)).toBeVisible();
    await expect(page.getByTestId(`betrayal-room-${visibleRoomId}`)).toBeVisible();
    for (const hiddenRoomId of hiddenRoomIds) {
        await expect(page.getByTestId(`betrayal-room-shell-${hiddenRoomId}`)).toHaveCount(0);
        await expect(page.getByTestId(`betrayal-room-${hiddenRoomId}`)).toHaveCount(0);
    }
};

const clearRedCallouts = async (page: Page) => {
    await page.locator('[data-e2e-red-callout="true"]').evaluateAll((nodes) => {
        for (const node of nodes) {
            node.remove();
        }
    });
};

const addRedCallout = async (page: Page, testId: string, label: string) => {
    await clearRedCallouts(page);
    await page.getByTestId(testId).scrollIntoViewIfNeeded();
    await page.evaluate(({ targetTestId, calloutLabel }) => {
        const target = document.querySelector(`[data-testid="${targetTestId}"]`);
        if (!target) {
            throw new Error(`missing callout target: ${targetTestId}`);
        }
        const rect = target.getBoundingClientRect();
        const pad = 10;
        const ring = document.createElement('div');
        ring.dataset.e2eRedCallout = 'true';
        Object.assign(ring.style, {
            position: 'fixed',
            left: `${rect.left - pad}px`,
            top: `${rect.top - pad}px`,
            width: `${rect.width + pad * 2}px`,
            height: `${rect.height + pad * 2}px`,
            border: '5px solid #ef4444',
            borderRadius: '999px',
            boxShadow: '0 0 0 4px rgba(255,255,255,0.82), 0 0 22px rgba(239,68,68,0.95)',
            pointerEvents: 'none',
            zIndex: '2147483647',
        });
        const tag = document.createElement('div');
        tag.dataset.e2eRedCallout = 'true';
        tag.textContent = calloutLabel;
        Object.assign(tag.style, {
            position: 'fixed',
            left: `${Math.max(12, rect.left - pad)}px`,
            top: `${Math.max(12, rect.top - 44)}px`,
            padding: '5px 10px',
            background: '#ef4444',
            color: '#fff',
            font: '700 16px Microsoft YaHei, sans-serif',
            borderRadius: '999px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
            zIndex: '2147483647',
        });
        document.body.append(ring, tag);
    }, { targetTestId: testId, calloutLabel: label });
};

type FloorSwitcherGeometry = {
    switcherCenterY: number;
    switcherLeft: number;
    switcherRight: number;
    switcherBottom: number;
    overlayBottom: number;
    actionDockBottom: number;
    gridCenterX: number;
    gridCenterY: number;
    gridLeft: number;
    gridRight: number;
    gridBottom: number;
    gridHeight: number;
};

const expectFloorSwitcherPinnedToMapOverlayBottom = async (
    page: Page,
    previous?: FloorSwitcherGeometry,
): Promise<FloorSwitcherGeometry> => {
    const geometry = await page.getByTestId('betrayal-room-floor-switcher').evaluate((switcher) => {
        const grid = document.querySelector('[data-testid="betrayal-room-grid"]');
        const overlay = switcher.parentElement;
        const dock =
            document.querySelector('[data-testid="betrayal-action-endTurn"]') ??
            document.querySelector('[data-testid="betrayal-action-rail"]');
        if (!grid) {
            throw new Error('missing betrayal-room-grid');
        }
        if (!overlay) {
            throw new Error('missing floor switcher overlay parent');
        }
        if (!dock) {
            throw new Error('missing betrayal action dock');
        }
        const switcherRect = switcher.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();
        const dockRect = dock.getBoundingClientRect();
        return {
            switcherCenterY: switcherRect.top + switcherRect.height / 2,
            switcherLeft: switcherRect.left,
            switcherRight: switcherRect.right,
            switcherBottom: switcherRect.bottom,
            overlayBottom: overlayRect.bottom,
            actionDockBottom: dockRect.bottom,
            gridCenterX: gridRect.left + gridRect.width / 2,
            gridCenterY: gridRect.top + gridRect.height / 2,
            gridLeft: gridRect.left,
            gridRight: gridRect.right,
            gridBottom: gridRect.bottom,
            gridHeight: gridRect.height,
        };
    });

    expect(geometry.gridRight - geometry.switcherRight).toBeGreaterThanOrEqual(160);
    expect(geometry.gridRight - geometry.switcherRight).toBeLessThan(320);
    expect(geometry.switcherLeft).toBeGreaterThan(geometry.gridCenterX);
    expect(geometry.overlayBottom - geometry.switcherBottom).toBeGreaterThanOrEqual(4);
    expect(geometry.overlayBottom - geometry.switcherBottom).toBeLessThan(36);
    expect(geometry.actionDockBottom - geometry.switcherBottom).toBeGreaterThan(12);
    expect(geometry.switcherCenterY).toBeGreaterThan(geometry.gridCenterY);
    if (previous) {
        expect(Math.abs(geometry.switcherRight - previous.switcherRight)).toBeLessThanOrEqual(2);
        expect(Math.abs(geometry.switcherBottom - previous.switcherBottom)).toBeLessThanOrEqual(2);
    }
    return geometry;
};

test.describe('山屋惊魂楼层切换视觉验收', () => {
    test.beforeEach(async ({ context, page }) => {
        await initBetrayalContext(context);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
    });

    test('地图主视区楼层切换 UI 会避免跨楼层同坐标房间叠住', async ({ page }) => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        const upperLanding = core.rooms.find((room) => room.id === 'upper-landing')!;
        const grandStaircase = core.rooms.find((room) => room.id === 'grand-staircase')!;
        const basementLanding = core.rooms.find((room) => room.id === 'basement-landing')!;
        upperLanding.x = 2;
        upperLanding.y = 1;
        grandStaircase.x = 2;
        grandStaircase.y = 1;
        basementLanding.x = 2;
        basementLanding.y = 1;
        core.currentExplorer.roomId = 'upper-landing';
        core.activeRoomId = 'upper-landing';
        core.otherExplorers[0]!.roomId = 'grand-staircase';
        core.otherExplorers[1]!.roomId = 'upper-landing';

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForBetrayalFloatingTextGone(page);
        await expect(page.getByTestId('betrayal-room-floor-switcher')).toBeVisible();
        await expectOnlyFloorVisible(page, 'upper', 'upper-landing', ['grand-staircase', 'basement-landing']);
        await expect(page.getByTestId('betrayal-room-floor-up')).toBeDisabled();
        await expect(page.getByTestId('betrayal-room-floor-down')).toBeEnabled();
        const upperSwitcherGeometry = await expectFloorSwitcherPinnedToMapOverlayBottom(page);
        await saveScreenshot(page, UPPER_FLOOR_SCREENSHOT);

        await page.getByTestId('betrayal-room-floor-down').click();
        await expectOnlyFloorVisible(page, 'ground', 'grand-staircase', ['upper-landing', 'basement-landing']);
        await expect(page.getByTestId('betrayal-room-floor-up')).toBeEnabled();
        await expect(page.getByTestId('betrayal-room-floor-down')).toBeDisabled();
        await expect(page.getByTestId('betrayal-room-floor-basement')).toHaveCount(0);
        await expectFloorSwitcherPinnedToMapOverlayBottom(page, upperSwitcherGeometry);
        await page.getByTestId('betrayal-room-floor-down').evaluate((node) => (node as HTMLButtonElement).click());
        await expectOnlyFloorVisible(page, 'ground', 'grand-staircase', ['upper-landing', 'basement-landing']);
        await saveScreenshot(page, GROUND_FLOOR_SCREENSHOT);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await expectFloorSwitcherPinnedToMapOverlayBottom(page);
        await saveScreenshot(
            page,
            `${BETRAYAL_FLOOR_OVERLAY_RESTORE_EVIDENCE_DIR}/03-PC-1920x1080-一层切换后仍贴地图底边.jpg`,
        );
    });

    test('站在楼梯格时移动模式下用侧边切层选择跨层目标房间', async ({ page }) => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        const upperLanding = core.rooms.find((room) => room.id === 'upper-landing')!;
        const grandStaircase = core.rooms.find((room) => room.id === 'grand-staircase')!;
        const basementLanding = core.rooms.find((room) => room.id === 'basement-landing')!;
        upperLanding.x = 2;
        upperLanding.y = 1;
        grandStaircase.x = 2;
        grandStaircase.y = 1;
        basementLanding.x = 2;
        basementLanding.y = 1;
        core.currentExplorer.roomId = 'upper-landing';
        core.activeRoomId = 'upper-landing';
        core.otherExplorers[0]!.roomId = 'upper-landing';
        core.otherExplorers[1]!.roomId = 'upper-landing';

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForBetrayalFloatingTextGone(page);
        await expectOnlyFloorVisible(page, 'upper', 'upper-landing', ['grand-staircase', 'basement-landing']);
        await expect(page.getByTestId('betrayal-room-floor-down')).toBeEnabled();
        const switcherGeometry = await expectFloorSwitcherPinnedToMapOverlayBottom(page);
       await addRedCallout(page, 'betrayal-room-floor-down', '1 点切层按钮');
       await saveScreenshot(page, STEP_1_SWITCH_FLOOR_SCREENSHOT);

       await clearRedCallouts(page);
       await addRedCallout(page, 'betrayal-action-move', '2 点移动');
       await saveScreenshot(page, STEP_2_MOVE_ACTION_SCREENSHOT);

       await clearRedCallouts(page);
       await page.getByTestId('betrayal-action-move').click();
        await expectOnlyFloorVisible(page, 'upper', 'upper-landing', ['grand-staircase', 'basement-landing']);
        await expectFloorSwitcherPinnedToMapOverlayBottom(page, switcherGeometry);
        await page.getByTestId('betrayal-room-floor-down').click();
        await expectOnlyFloorVisible(page, 'ground', 'grand-staircase', ['upper-landing', 'basement-landing']);
        await expectFloorSwitcherPinnedToMapOverlayBottom(page, switcherGeometry);
       await expect(page.getByTestId('betrayal-room-grand-staircase')).toBeEnabled();
       await addRedCallout(page, 'betrayal-room-grand-staircase', '3 点目标房间');
        await saveScreenshot(page, MOVE_TARGET_FLOOR_SCREENSHOT);
        await saveScreenshot(page, STEP_3_TARGET_ROOM_SCREENSHOT);

        await clearRedCallouts(page);
        await page.getByTestId('betrayal-room-grand-staircase').click();
        await expect(page.getByTestId('betrayal-room-occupant-grand-staircase-0')).toBeVisible();
    });
});
