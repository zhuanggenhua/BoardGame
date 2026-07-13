import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import { BETRAYAL_COMMANDS } from '../../src/games/betrayal/game';
import { BETRAYAL_DISCOVERY_POOLS } from '../../src/games/betrayal/scenarioConfig';
import {
    applyBetrayalCommand,
    createBetrayalScriptedRandom,
    createFirstScenarioHauntCore,
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
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-high-risk-possession-representatives');
const ARMORY_DISCOVERY_SCREENSHOT = `${EVIDENCE_DIR}/01-器械库-发现砍刀并进入持有区.png`;
const ARMORY_INVENTORY_SCREENSHOT = `${EVIDENCE_DIR}/02-器械库-关闭发现后持有区砍刀.png`;
const SKULL_DEATH_PREVENTION_SCREENSHOT = `${EVIDENCE_DIR}/03-头骨-死亡保护骰盘与阻止死亡.png`;

const openBetrayalPage = async (page: Page, context: Parameters<typeof initBetrayalContext>[0], label: string) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, label);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
    return diagnostics;
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

const createArmoryDiscoveryCore = () => {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.drawOrder = ['item'];
    core.roomDiscoveryOrderByFloor.ground = [
        BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!,
    ];
    core.possessionOrderByKind.item = [
        BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'medical-kit')!,
        BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'hunting-knife')!,
    ];
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'hallway',
        inventory: [],
    };
    core.activeRoomId = 'hallway';
    core.currentExplorerInventory = [];
    return core;
};

const createSkullDeathPreventionCore = () => {
    let core = createFirstScenarioHauntCore();
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === '0'
            ? { ...explorer, inventory: [{ id: 'skull', name: '头骨', kind: 'omen' }] }
            : explorer
    ));
    return applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.HAUNT_ATTACK,
        '2',
        { target: 'hero', targetPlayerId: '0' },
        100,
        createBetrayalScriptedRandom(3, 3, 3, 3, 3, 1, 1, 1, 1, 3, 3, 1),
    );
};

test.describe('山屋惊魂高风险持有物代表链', () => {
    test('器械库代表房间发现抽牌：真实页面显示砍刀并进入持有区', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-high-risk-armory-discovery');

        await injectCore(page, createArmoryDiscoveryCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('betrayal-action-explore').click();
        await page.getByTestId('betrayal-room-ground-north').click();

        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toHaveAttribute('aria-label', /物品牌 砍刀/);
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('已加入持有区');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('探索到器械库');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('拿到了砍刀');
        await expect(page.locator('[data-testid="betrayal-inventory-hunting-knife-armory-0-1"]')).toBeVisible();
        await saveScreenshot(page, ARMORY_DISCOVERY_SCREENSHOT);

        await dismissDiscoveryPanelIfVisible(page);
        await expect(page.locator('[data-testid="betrayal-inventory-hunting-knife-armory-0-1"]')).toBeVisible();
        await saveScreenshot(page, ARMORY_INVENTORY_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-high-risk-armory-discovery', diagnostics }]);
    });

    test('头骨代表死亡保护：真实页面显示 3 骰、总点数和阻止死亡反馈', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-high-risk-skull-death-prevention');

        await injectCore(page, createSkullDeathPreventionCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '3');
        await expect(page.getByTestId('betrayal-recent-roll-detail')).toContainText('骰子合计 4');
        await expect(page.getByTestId('betrayal-recent-roll-total')).toContainText('总点数 4');
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toContainText('头骨死亡保护');
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toContainText('阻止死亡');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('头骨投出 4，阻止死亡');
        await saveScreenshot(page, SKULL_DEATH_PREVENTION_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-high-risk-skull-death-prevention', diagnostics }]);
    });
});
