import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BETRAYAL_DISCOVERY_POOLS } from '../../src/games/betrayal/scenarioConfig';
import {
    createFirstScenarioHauntCore,
    createStartedFirstScenarioCore,
} from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    expectVisiblePhysicalDiceBox,
    expectPhysicalDiceSeparated,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-non-p0-representatives');
const ORDINARY_ROLL_EVENT_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/01-普通投骰事件-探索目标.jpg`;
const ORDINARY_ROLL_EVENT_CARD_FRONT_SCREENSHOT = `${EVIDENCE_DIR}/02-普通投骰事件-卡牌正面.jpg`;
const ORDINARY_ROLL_EVENT_DICE_SCREENSHOT = `${EVIDENCE_DIR}/03-普通投骰事件-投掷骰子.jpg`;
const ORDINARY_ROLL_EVENT_FULL_SCREENSHOT = `${EVIDENCE_DIR}/04-普通投骰事件-牌面骰盘分支.jpg`;
const IDOL_OPTION_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/05-雕像探索声明-选择前.jpg`;
const IDOL_OPTION_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/06-雕像探索声明-已选择.jpg`;
const IDOL_SKIP_EVENT_SCREENSHOT = `${EVIDENCE_DIR}/07-雕像探索声明-跳过事件.jpg`;
const HUNTING_KNIFE_SELECTOR_SCREENSHOT = `${EVIDENCE_DIR}/08-砍刀攻击武器-选择前.jpg`;
const HUNTING_KNIFE_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/09-砍刀攻击武器-目标高亮.jpg`;
const HUNTING_KNIFE_ATTACK_DICE_SCREENSHOT = `${EVIDENCE_DIR}/10-砍刀攻击武器-攻击投骰.jpg`;
const HUNTING_KNIFE_ATTACK_FEEDBACK_SCREENSHOT = `${EVIDENCE_DIR}/11-砍刀攻击武器-攻击反馈.jpg`;

const openBetrayalPage = async (page: Page, context: Parameters<typeof initBetrayalContext>[0], label: string) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, label);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
    return diagnostics;
};

const saveLocatorScreenshot = async (locator: Locator, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    await locator.screenshot({ path });
};

const createOrdinaryRollEventCore = () => {
    const eventCard = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制');
    if (!eventCard) {
        throw new Error('山屋事件池缺少普通投骰事件：标本剥制');
    }

    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.drawOrder = ['event'];
    core.eventOrder = [eventCard];
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'hallway',
        traits: {
            ...core.currentExplorer.traits,
            might: 4,
            speed: 4,
            knowledge: 4,
            sanity: 4,
        },
        inventory: [],
    };
    core.activeRoomId = 'hallway';
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];
    return core;
};

const createIdolSkipEventCore = () => {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.drawOrder = ['event'];
    core.eventOrder = [
        {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        },
    ];
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'hallway',
        inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
    };
    core.activeRoomId = 'hallway';
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.turnStartInventoryCardIds = ['idol'];
    return core;
};

const createHuntingKnifeAttackCore = () => {
    const core = createFirstScenarioHauntCore();
    const helper = core.otherExplorers.find((explorer) => explorer.playerId === '1');
    const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2');
    if (!helper || !traitor) {
        throw new Error('山屋首剧本攻击夹具缺少英雄或叛徒');
    }

    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'entrance-hall',
        inventory: [{ id: 'hunting-knife', name: '砍刀', kind: 'item' }],
    };
    core.otherExplorers = [
        { ...helper },
        { ...traitor, roomId: 'entrance-hall' },
    ];
    core.activeRoomId = 'entrance-hall';
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.turnStartInventoryCardIds = ['hunting-knife'];
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.recentRoll = null;
    return core;
};

test.describe('山屋惊魂非 P0 发布级代表链', () => {
    test('普通投骰事件代表链：真实页面同屏展示牌面、骰盘和分支结果', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-non-p0-ordinary-roll-event');

        await injectCore(page, createOrdinaryRollEventCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await setHarnessRandomQueue(page, [0.5, 0.01, 0.99, 0.01]);
        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await saveScreenshot(page, ORDINARY_ROLL_EVENT_TARGET_SCREENSHOT);

        await page.getByTestId('betrayal-room-ground-north').click();

        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveAttribute('aria-label', /标本剥制/);
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveAttribute('data-card-testid', 'betrayal-discovery-card-reveal');
        await saveLocatorScreenshot(page.getByTestId('betrayal-discovery-panel-content'), ORDINARY_ROLL_EVENT_CARD_FRONT_SCREENSHOT);

        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText(/检定|投|骰/);
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('力量检定 3');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText(/受到 1 点物理伤害|放置障碍物/);
        const eventRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '4');
        await expect(page.getByTestId('betrayal-recent-roll-subtotal')).toBeVisible();
        await expectVisiblePhysicalDiceBox(eventRollPanel);
        await waitForPhysicalDiceSettled(eventRollPanel);
        await expectPhysicalDiceSeparated(eventRollPanel, { minDiceCount: 4 });
        await saveLocatorScreenshot(eventRollPanel, ORDINARY_ROLL_EVENT_DICE_SCREENSHOT);
        await saveScreenshot(page, ORDINARY_ROLL_EVENT_FULL_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-non-p0-ordinary-roll-event', diagnostics }]);
    });

    test('雕像探索声明代表链：真实页面可声明跳过事件并显示未结算事件效果', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-non-p0-idol-skip-event');

        await injectCore(page, createIdolSkipEventCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-explore-options')).toBeVisible();
        await saveScreenshot(page, IDOL_OPTION_BEFORE_SCREENSHOT);

        await page.getByTestId('betrayal-explore-option-idol').click();
        await expect(page.getByTestId('betrayal-explore-option-idol')).toHaveClass(/underline/);
        await saveScreenshot(page, IDOL_OPTION_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-explore').click();
        await page.getByTestId('betrayal-room-ground-north').click();

        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('没有抽取或结算事件卡');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('使用雕像跳过了事件：阴影扑面');
        await saveScreenshot(page, IDOL_SKIP_EVENT_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-non-p0-idol-skip-event', diagnostics }]);
    });

    test('砍刀攻击武器代表链：真实页面可选择武器并完成攻击反馈', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-non-p0-hunting-knife-attack');

        await injectCore(page, createHuntingKnifeAttackCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-attack-weapon-selector')).toBeVisible();
        await saveScreenshot(page, HUNTING_KNIFE_SELECTOR_SCREENSHOT);

        await page.getByTestId('betrayal-attack-weapon-hunting-knife').click();
        await expect(page.getByTestId('betrayal-room-occupant-entrance-hall-2')).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, HUNTING_KNIFE_TARGET_SCREENSHOT);

        await page.getByTestId('betrayal-room-occupant-entrance-hall-2').click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('使用砍刀');
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toBeVisible();
        await expect(attackRollPanel).toBeVisible();
        await expectVisiblePhysicalDiceBox(attackRollPanel);
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expectPhysicalDiceSeparated(attackRollPanel, { minDiceCount: 4 });
        await saveLocatorScreenshot(attackRollPanel, HUNTING_KNIFE_ATTACK_DICE_SCREENSHOT);
        await saveScreenshot(page, HUNTING_KNIFE_ATTACK_FEEDBACK_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-non-p0-hunting-knife-attack', diagnostics }]);
    });
});
