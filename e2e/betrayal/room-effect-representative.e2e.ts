import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import { BETRAYAL_COMMANDS } from '../../src/games/betrayal/game';
import { BETRAYAL_DISCOVERY_POOLS } from '../../src/games/betrayal/scenarioConfig';
import {
    applyBetrayalCommand,
    createStartedFirstScenarioCore,
} from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-room-effect-representatives');
const CHAPEL_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-礼拜堂-发现前属性栏.png`;
const CHAPEL_AFTER_SCREENSHOT = `${EVIDENCE_DIR}/02-礼拜堂-发现后神志加点.png`;
const FURNACE_HINT_SCREENSHOT = `${EVIDENCE_DIR}/03-火炉房-结束回合前提示.png`;
const FURNACE_RESOLVED_SCREENSHOT = `${EVIDENCE_DIR}/04-火炉房-结算后反馈.png`;
const JUNK_OBSTACLE_SCREENSHOT = `${EVIDENCE_DIR}/05-杂物间-障碍标记.png`;
const JUNK_MOVE_COST_SCREENSHOT = `${EVIDENCE_DIR}/06-杂物间-离开扣2点移动.png`;
const FIXED_LINK_CROSS_FLOOR_HINT_SCREENSHOT = `${EVIDENCE_DIR}/07-密道楼梯-跨层移动切层提示.png`;
const FIXED_LINK_MOVE_RESOLVED_SCREENSHOT = `${EVIDENCE_DIR}/08-密道楼梯-移动到门厅.png`;

const openBetrayalPage = async (page: Page, context: Parameters<typeof initBetrayalContext>[0], label: string) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, label);
    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
    return diagnostics;
};

const clickMoveToRoom = async (page: Page, roomId: string) => {
    await dismissDiscoveryPanelIfVisible(page);
    await page.getByTestId('betrayal-action-move').click();
    await page.getByTestId(`betrayal-room-${roomId}`).click();
};

const dismissDiscoveryPanelIfVisible = async (page: Page) => {
    const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
    if (!await discoveryPanel.isVisible({ timeout: 800 }).catch(() => false)) {
        return;
    }

    const blankPoint = await discoveryPanel.evaluate((panel) => {
        const panelRect = panel.getBoundingClientRect();
        const content = panel.querySelector('[data-testid="betrayal-discovery-panel-content"]');
        const contentRect = content?.getBoundingClientRect();
        const candidates = [
            { x: panelRect.left + 16, y: panelRect.top + 16 },
            { x: panelRect.right - 16, y: panelRect.top + 16 },
            { x: panelRect.left + 16, y: panelRect.bottom - 16 },
            { x: panelRect.right - 16, y: panelRect.bottom - 16 },
        ];
        return candidates.find((point) => !contentRect || (
            point.x < contentRect.left
            || point.x > contentRect.right
            || point.y < contentRect.top
            || point.y > contentRect.bottom
        )) ?? { x: panelRect.left + 8, y: panelRect.top + 8 };
    });
    await page.mouse.click(blankPoint.x, blankPoint.y);
    await expect(discoveryPanel).toBeHidden();
};

test.describe('山屋惊魂房间效果代表链', () => {
    test('礼拜堂代表发现加点 family：真实页面显示属性变化和发现反馈', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-room-effect-chapel');
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'chapel')!,
        ];

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-current-traits')).toContainText('神志');
        await expect(page.getByTestId('betrayal-current-traits')).toContainText('3');
        await saveScreenshot(page, CHAPEL_BEFORE_SCREENSHOT);

        await clickMoveToRoom(page, 'hallway');
        await page.getByTestId('betrayal-action-explore').click();
        await page.getByTestId('betrayal-room-ground-north').click();

        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/礼拜堂/);
        await expect(page.getByTestId('betrayal-current-traits')).toContainText('神志');
        await expect(page.getByTestId('betrayal-current-traits')).toContainText('4');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('礼拜堂');
        await saveScreenshot(page, CHAPEL_AFTER_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-effect-chapel', diagnostics }]);
    });

    test('火炉房代表停留效果 family：真实页面提示结束回合伤害并结算反馈', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-room-effect-furnace-room');
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissDiscoveryPanelIfVisible(page);
        await expect(page.getByTestId('betrayal-room-ground-north')).toHaveAccessibleName(/火炉房/);
        await expect(page.getByTestId('betrayal-room-end-turn-effect-status')).toContainText('火炉房');
        await expect(page.getByTestId('betrayal-room-end-turn-effect-status')).toContainText('1 点物理伤害');
        await expect(page.getByTestId('betrayal-room-end-turn-effect-hint')).toContainText('结束回合受伤');
        await expect(page.getByTestId('betrayal-action-endTurn')).toContainText('结束回合');
        await expect(page.getByTestId('betrayal-action-endTurn')).not.toContainText('结算房间');
        await saveScreenshot(page, FURNACE_HINT_SCREENSHOT);

        await page.getByTestId('betrayal-action-endTurn').click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('火炉房');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('1 点物理伤害');
        await saveScreenshot(page, FURNACE_RESOLVED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-effect-furnace-room', diagnostics }]);
    });

    test('杂物间代表障碍移动 family：真实页面显示障碍标记并离开扣 2 点移动', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-room-effect-junk-room');
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'junkRoom')!,
        ];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        core.turnEndedByDiscovery = false;
        core.movesRemaining = 2;

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-room-floor-basement')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('betrayal-room-basement-east')).toHaveAccessibleName(/杂物间/);
        await expect(page.getByTestId('betrayal-room-marker-basement-east-obstacle')).toBeVisible();
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('剩余移动 2');
        await saveScreenshot(page, JUNK_OBSTACLE_SCREENSHOT);

        await clickMoveToRoom(page, 'basement-landing');

        await expect(page.getByTestId('betrayal-room-occupant-basement-landing-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('剩余移动 0');
        await saveScreenshot(page, JUNK_MOVE_COST_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-effect-junk-room', diagnostics }]);
    });

    test('固定连接代表跨层入口 family：真实页面提示切层并可从密道楼梯移动到门厅', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-room-effect-fixed-link-cross-floor');
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'secretStaircase')!,
        ];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        core.turnEndedByDiscovery = false;
        core.movesRemaining = 2;

        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissDiscoveryPanelIfVisible(page);
        await expect(page.getByTestId('betrayal-room-floor-basement')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('betrayal-room-basement-east')).toHaveAccessibleName(/密道楼梯/);

        await page.getByTestId('betrayal-action-move').click();

        await expect(page.getByTestId('betrayal-room-floor-switcher')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-floor-up')).toBeEnabled();
        await saveScreenshot(page, FIXED_LINK_CROSS_FLOOR_HINT_SCREENSHOT);

        await page.getByTestId('betrayal-room-floor-up').click();

        await expect(page.getByTestId('betrayal-room-floor-ground')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('betrayal-room-hallway')).toBeEnabled();
        await page.getByTestId('betrayal-room-hallway').click();

        await expect(page.getByTestId('betrayal-room-occupant-hallway-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('剩余移动 1');
        await saveScreenshot(page, FIXED_LINK_MOVE_RESOLVED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-room-effect-fixed-link-cross-floor', diagnostics }]);
    });
});
