import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import {
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
} from './betrayalTestHelpers';
import { createStartedFirstScenarioCore } from '../../src/games/betrayal/testing/firstScenarioTestUtils';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-floor-switcher');
const UPPER_FLOOR_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-楼层切换-二层默认.jpg`;
const GROUND_FLOOR_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-楼层切换-一层切换后.jpg`;
const MOVE_TARGET_FLOOR_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-楼层切换-移动目标楼层.jpg`;
const STEP_1_SWITCH_FLOOR_SCREENSHOT = `${EVIDENCE_DIR}/山屋惊魂-跨层移动-1右下切层红圈.jpg`;
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
        await expect(page.getByTestId('betrayal-room-floor-switcher')).toBeVisible();
        await expectOnlyFloorVisible(page, 'upper', 'upper-landing', ['grand-staircase', 'basement-landing']);
        await expect(page.getByTestId('betrayal-room-floor-up')).toBeDisabled();
        await expect(page.getByTestId('betrayal-room-floor-down')).toBeEnabled();
        await saveScreenshot(page, UPPER_FLOOR_SCREENSHOT);

        await page.getByTestId('betrayal-room-floor-down').click();
        await expectOnlyFloorVisible(page, 'ground', 'grand-staircase', ['upper-landing', 'basement-landing']);
        await expect(page.getByTestId('betrayal-room-floor-up')).toBeEnabled();
        await expect(page.getByTestId('betrayal-room-floor-down')).toBeDisabled();
        await expect(page.getByTestId('betrayal-room-floor-basement')).toHaveCount(0);
        await page.getByTestId('betrayal-room-floor-down').evaluate((node) => (node as HTMLButtonElement).click());
        await expectOnlyFloorVisible(page, 'ground', 'grand-staircase', ['upper-landing', 'basement-landing']);
        await saveScreenshot(page, GROUND_FLOOR_SCREENSHOT);
    });

    test('站在楼梯格时右下角切层再移动到跨层目标房间', async ({ page }) => {
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
        await expectOnlyFloorVisible(page, 'upper', 'upper-landing', ['grand-staircase', 'basement-landing']);
        await expect(page.getByTestId('betrayal-room-floor-down')).toBeEnabled();
        await addRedCallout(page, 'betrayal-room-floor-down', '1 点右下切层');
        await saveScreenshot(page, STEP_1_SWITCH_FLOOR_SCREENSHOT);

        await clearRedCallouts(page);
        await page.getByTestId('betrayal-room-floor-down').click();
        await expectOnlyFloorVisible(page, 'ground', 'grand-staircase', ['upper-landing', 'basement-landing']);
        await expect(page.getByTestId('betrayal-room-grand-staircase')).toBeDisabled();
        await addRedCallout(page, 'betrayal-action-move', '2 点移动');
        await saveScreenshot(page, STEP_2_MOVE_ACTION_SCREENSHOT);

        await clearRedCallouts(page);
        await page.getByTestId('betrayal-action-move').click();
        await expect(page.getByTestId('betrayal-room-grand-staircase')).toBeEnabled();
        await addRedCallout(page, 'betrayal-room-grand-staircase', '3 点目标房间');
        await saveScreenshot(page, MOVE_TARGET_FLOOR_SCREENSHOT);
        await saveScreenshot(page, STEP_3_TARGET_ROOM_SCREENSHOT);

        await clearRedCallouts(page);
        await page.getByTestId('betrayal-room-grand-staircase').click();
        await expect(page.getByTestId('betrayal-room-occupant-grand-staircase-0')).toBeVisible();
    });
});
