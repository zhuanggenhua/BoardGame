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
const IDOL_FULL_CHAIN_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/山屋惊魂-雕像探索声明完整链路');
const IDOL_OPTION_BEFORE_SCREENSHOT = `${IDOL_FULL_CHAIN_EVIDENCE_DIR}/01-雕像声明前牌桌可操作.jpg`;
const IDOL_OPTION_SELECTED_SCREENSHOT = `${IDOL_FULL_CHAIN_EVIDENCE_DIR}/02-雕像探索声明已选中.jpg`;
const IDOL_EXPLORE_TARGET_SCREENSHOT = `${IDOL_FULL_CHAIN_EVIDENCE_DIR}/03-选择未知房间前.jpg`;
const IDOL_SKIP_EVENT_SCREENSHOT = `${IDOL_FULL_CHAIN_EVIDENCE_DIR}/04-雕像跳过事件结果可见.jpg`;
const IDOL_SKIP_SETTLED_SCREENSHOT = `${IDOL_FULL_CHAIN_EVIDENCE_DIR}/05-雕像跳过事件结算未扣力量.jpg`;
const IDOL_DISMISSED_SCREENSHOT = `${IDOL_FULL_CHAIN_EVIDENCE_DIR}/06-关闭后回牌桌状态清空.jpg`;
const HUNTING_KNIFE_SELECTOR_SCREENSHOT = `${EVIDENCE_DIR}/08-砍刀攻击武器-选择前.jpg`;
const HUNTING_KNIFE_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/09-砍刀攻击武器-目标高亮.jpg`;
const HUNTING_KNIFE_ATTACK_DICE_SCREENSHOT = `${EVIDENCE_DIR}/10-砍刀攻击武器-攻击投骰.jpg`;
const HUNTING_KNIFE_ATTACK_FEEDBACK_SCREENSHOT = `${EVIDENCE_DIR}/11-砍刀攻击武器-攻击反馈.jpg`;
const UNARMED_ATTACK_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/山屋惊魂-无武器攻击完整链路');
const UNARMED_ATTACK_READY_SCREENSHOT = `${UNARMED_ATTACK_EVIDENCE_DIR}/01-无武器攻击前牌桌可操作.jpg`;
const UNARMED_ATTACK_DEFAULT_SCREENSHOT = `${UNARMED_ATTACK_EVIDENCE_DIR}/02-无武器直接攻击提示可见.jpg`;
const UNARMED_ATTACK_TARGET_SCREENSHOT = `${UNARMED_ATTACK_EVIDENCE_DIR}/03-叛徒目标高亮.jpg`;
const UNARMED_ATTACK_DICE_SCREENSHOT = `${UNARMED_ATTACK_EVIDENCE_DIR}/04-无武器4骰攻击骰盘停稳.jpg`;
const UNARMED_ATTACK_RESULT_SCREENSHOT = `${UNARMED_ATTACK_EVIDENCE_DIR}/05-物理伤害结算结果可见.jpg`;
const UNARMED_ATTACK_SETTLED_SCREENSHOT = `${UNARMED_ATTACK_EVIDENCE_DIR}/06-无武器攻击后回牌桌继续可操作.jpg`;
const RING_SANITY_ATTACK_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/山屋惊魂-指环神志攻击完整链路');
const RING_ATTACK_READY_SCREENSHOT = `${RING_SANITY_ATTACK_EVIDENCE_DIR}/01-指环攻击前牌桌可操作.jpg`;
const RING_ATTACK_SELECTED_SCREENSHOT = `${RING_SANITY_ATTACK_EVIDENCE_DIR}/02-指环武器已选中.jpg`;
const RING_ATTACK_TARGET_SCREENSHOT = `${RING_SANITY_ATTACK_EVIDENCE_DIR}/03-叛徒目标高亮.jpg`;
const RING_ATTACK_DICE_SCREENSHOT = `${RING_SANITY_ATTACK_EVIDENCE_DIR}/04-指环神志攻击骰盘停稳.jpg`;
const RING_ATTACK_RESULT_SCREENSHOT = `${RING_SANITY_ATTACK_EVIDENCE_DIR}/05-精神伤害结算结果可见.jpg`;
const RING_ATTACK_SETTLED_SCREENSHOT = `${RING_SANITY_ATTACK_EVIDENCE_DIR}/06-指环攻击后回牌桌继续可操作.jpg`;
const DAGGER_ATTACK_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/山屋惊魂-匕首攻击完整链路');
const DAGGER_ATTACK_READY_SCREENSHOT = `${DAGGER_ATTACK_EVIDENCE_DIR}/01-匕首攻击前牌桌可操作.jpg`;
const DAGGER_ATTACK_SELECTED_SCREENSHOT = `${DAGGER_ATTACK_EVIDENCE_DIR}/02-匕首武器已选中.jpg`;
const DAGGER_ATTACK_TARGET_SCREENSHOT = `${DAGGER_ATTACK_EVIDENCE_DIR}/03-叛徒目标高亮.jpg`;
const DAGGER_ATTACK_DICE_SCREENSHOT = `${DAGGER_ATTACK_EVIDENCE_DIR}/04-匕首6骰攻击骰盘停稳.jpg`;
const DAGGER_ATTACK_RESULT_SCREENSHOT = `${DAGGER_ATTACK_EVIDENCE_DIR}/05-物理伤害与速度花费结果可见.jpg`;
const DAGGER_ATTACK_SETTLED_SCREENSHOT = `${DAGGER_ATTACK_EVIDENCE_DIR}/06-匕首攻击后回牌桌继续可操作.jpg`;

const openBetrayalPage = async (page: Page, context: Parameters<typeof initBetrayalContext>[0], label: string) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, label);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human', { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
    return diagnostics;
};

const saveLocatorScreenshot = async (locator: Locator, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    await locator.screenshot({ path });
};

const dismissDiscoveryPanel = async (page: Page) => {
    const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
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
        const outsideContent = candidates.find((point) => (
            !contentRect
            || point.x < contentRect.left
            || point.x > contentRect.right
            || point.y < contentRect.top
            || point.y > contentRect.bottom
        ));
        return outsideContent ?? { x: panelRect.left + 8, y: panelRect.top + 8 };
    });
    await page.mouse.click(blankPoint.x, blankPoint.y);
    await expect(discoveryPanel).toBeHidden();
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

const createUnarmedAttackCore = () => {
    const core = createFirstScenarioHauntCore();
    const helper = core.otherExplorers.find((explorer) => explorer.playerId === '1');
    const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2');
    if (!helper || !traitor) {
        throw new Error('山屋首剧本无武器攻击夹具缺少英雄或叛徒');
    }

    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'entrance-hall',
        traits: {
            might: 4,
            speed: 4,
            knowledge: 4,
            sanity: 4,
        },
        inventory: [],
    };
    core.otherExplorers = [
        { ...helper },
        {
            ...traitor,
            roomId: 'entrance-hall',
            traits: {
                might: 8,
                speed: 8,
                knowledge: 4,
                sanity: 4,
            },
        },
    ];
    core.currentPlayer = core.currentExplorer.playerId;
    core.activeRoomId = 'entrance-hall';
    core.currentExplorerInventory = [];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.turnStartInventoryCardIds = [];
    core.usedCardIdsThisTurn = [];
    core.activityLog = [];
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.recentRoll = null;
    return core;
};

const createRingAttackCore = () => {
    const core = createFirstScenarioHauntCore();
    const helper = core.otherExplorers.find((explorer) => explorer.playerId === '1');
    const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2');
    if (!helper || !traitor) {
        throw new Error('山屋首剧本指环攻击夹具缺少英雄或叛徒');
    }

    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'entrance-hall',
        traits: {
            might: 4,
            speed: 4,
            knowledge: 4,
            sanity: 4,
        },
        inventory: [{ id: 'ring', name: '指环', kind: 'omen' }],
    };
    core.otherExplorers = [
        { ...helper },
        {
            ...traitor,
            roomId: 'entrance-hall',
            traits: {
                might: 4,
                speed: 4,
                knowledge: 8,
                sanity: 8,
            },
        },
    ];
    core.currentPlayer = core.currentExplorer.playerId;
    core.activeRoomId = 'entrance-hall';
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.turnStartInventoryCardIds = ['ring'];
    core.usedCardIdsThisTurn = [];
    core.activityLog = [];
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.recentRoll = null;
    return core;
};

const createDaggerAttackCore = () => {
    const core = createFirstScenarioHauntCore();
    const helper = core.otherExplorers.find((explorer) => explorer.playerId === '1');
    const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2');
    if (!helper || !traitor) {
        throw new Error('山屋首剧本匕首攻击夹具缺少英雄或叛徒');
    }

    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'entrance-hall',
        traits: {
            might: 4,
            speed: 4,
            knowledge: 4,
            sanity: 4,
        },
        inventory: [{ id: 'dagger', name: '匕首', kind: 'omen' }],
    };
    core.otherExplorers = [
        { ...helper },
        {
            ...traitor,
            roomId: 'entrance-hall',
            traits: {
                might: 4,
                speed: 8,
                knowledge: 4,
                sanity: 4,
            },
        },
    ];
    core.currentPlayer = core.currentExplorer.playerId;
    core.activeRoomId = 'entrance-hall';
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.turnStartInventoryCardIds = ['dagger'];
    core.usedCardIdsThisTurn = [];
    core.activityLog = [];
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.recentRoll = null;
    return core;
};

const readWeaponAttackState = async (page: Page) => page.evaluate(() => {
    const core = (window as Window & {
        __BG_TEST_HARNESS__?: { state?: { get?: () => { core: {
            currentExplorer: {
                playerId: string;
                roomId: string;
                inventory: { id: string }[];
                traits: { might: number; speed: number; knowledge: number; sanity: number };
            };
            otherExplorers: Array<{
                playerId: string;
                traits: { might: number; speed: number; knowledge: number; sanity: number };
            }>;
            usedCardIdsThisTurn: string[];
            recentRoll: {
                kind: string;
                dice: number[];
                latestLabel: string;
                attack?: {
                    damageKind?: string;
                    weaponCardId?: string;
                    weaponAttackTrait?: string;
                    weaponExtraDice?: number;
                    weaponSpeedCost?: number;
                    previousDamageToDefender?: number;
                    previousDamageToAttacker?: number;
                };
            } | null;
        } } } };
    }).__BG_TEST_HARNESS__?.state?.get?.().core;
    if (!core) {
        throw new Error('山屋测试 harness 未返回 core');
    }
    const attacker = [core.currentExplorer, ...core.otherExplorers].find((explorer) => explorer.playerId === '0');
    const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2');
    if (!attacker) {
        throw new Error('山屋攻击夹具缺少攻击者状态');
    }
    if (!traitor) {
        throw new Error('山屋攻击夹具缺少叛徒状态');
    }
    return {
        attackerRoomId: attacker.roomId,
        attackerInventoryIds: attacker.inventory.map((card) => card.id),
        attackerTraits: { ...attacker.traits },
        traitorTraits: { ...traitor.traits },
        usedCardIdsThisTurn: [...core.usedCardIdsThisTurn],
        recentRoll: core.recentRoll
            ? {
                kind: core.recentRoll.kind,
                dice: [...core.recentRoll.dice],
                latestLabel: core.recentRoll.latestLabel,
                attack: core.recentRoll.attack
                    ? { ...core.recentRoll.attack }
                    : undefined,
            }
            : null,
    };
});

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

    test('雕像探索声明真实链路从声明到跳过事件结算关闭', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-non-p0-idol-skip-event');

        await injectCore(page, createIdolSkipEventCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-explore-options')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-idol')).toBeVisible();
        await expect(page.getByTestId('betrayal-explore-option-idol')).toBeVisible();
        await expect(page.getByTestId('betrayal-explore-option-idol')).not.toHaveClass(/underline/);
        await saveScreenshot(page, IDOL_OPTION_BEFORE_SCREENSHOT);

        await page.getByTestId('betrayal-explore-option-idol').click();
        await expect(page.getByTestId('betrayal-explore-option-idol')).toHaveClass(/underline/);
        await expect(page.getByTestId('betrayal-action-explore')).toBeEnabled();
        await saveScreenshot(page, IDOL_OPTION_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-explore').click();
        await expect(page.getByTestId('betrayal-room-explore-target-ground-north')).toBeVisible();
        await saveScreenshot(page, IDOL_EXPLORE_TARGET_SCREENSHOT);
        await page.getByTestId('betrayal-room-ground-north').click();

        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
        await expect(discoveryPanel).toHaveAttribute('aria-label', /事件牌 阴影扑面/);
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('没有抽取或结算事件卡');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('使用雕像跳过了事件：阴影扑面');
        await saveScreenshot(page, IDOL_SKIP_EVENT_SCREENSHOT);

        const coreAfterSkip = await page.evaluate(() => (window as Window & {
            __BG_TEST_HARNESS__?: { state?: { get?: () => { core: {
                currentExplorer: { traits: { might: number }; inventory: { id: string }[] };
                discardCounts: { event: number };
            } } } };
        }).__BG_TEST_HARNESS__!.state!.get!().core);
        expect(coreAfterSkip.currentExplorer.traits.might).toBe(4);
        expect(coreAfterSkip.discardCounts.event).toBe(0);
        expect(coreAfterSkip.currentExplorer.inventory.some((card) => card.id === 'idol')).toBe(true);
        await saveScreenshot(page, IDOL_SKIP_SETTLED_SCREENSHOT);

        await dismissDiscoveryPanel(page);
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-event-choice-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-occupant-ground-north-0')).toBeVisible();
        await saveScreenshot(page, IDOL_DISMISSED_SCREENSHOT);

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

    test('无武器攻击真实链路：默认徒手目标高亮后4骰攻击并造成物理伤害', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-non-p0-unarmed-attack');

        await injectCore(page, createUnarmedAttackCore());
        await expect.poll(async () => {
            const state = await readWeaponAttackState(page);
            return {
                roomId: state.attackerRoomId,
                inventoryIds: state.attackerInventoryIds,
            };
        }, { timeout: 30000 }).toEqual({
            roomId: 'entrance-hall',
            inventoryIds: [],
        });
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('匕首');
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('指环');
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('砍刀');
        const beforeAttack = await readWeaponAttackState(page);
        expect(beforeAttack.recentRoll).toBeNull();
        await saveScreenshot(page, UNARMED_ATTACK_READY_SCREENSHOT);

        await expect(page.getByTestId('betrayal-action-cue')).toContainText('点攻击叛徒');
        await expect(page.getByTestId('betrayal-attack-weapon-selector')).toHaveCount(0);
        await saveScreenshot(page, UNARMED_ATTACK_DEFAULT_SCREENSHOT);

        const traitorToken = page.getByTestId('betrayal-room-occupant-entrance-hall-2');
        await expect(traitorToken).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, UNARMED_ATTACK_TARGET_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.5, 0.5, 0.5, 0.5, 0, 0, 0, 0]);
        await traitorToken.click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('physical damage');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText('使用匕首');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText('使用指环');
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('攻击投骰');
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '4');
        await expectVisiblePhysicalDiceBox(attackRollPanel);
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expectPhysicalDiceSeparated(attackRollPanel, { minDiceCount: 4 });
        await saveScreenshot(page, UNARMED_ATTACK_DICE_SCREENSHOT);

        const afterAttack = await readWeaponAttackState(page);
        expect(afterAttack.recentRoll?.kind).toBe('attackRoll');
        expect(afterAttack.recentRoll?.dice).toHaveLength(4);
        expect(afterAttack.recentRoll?.attack?.damageKind).toBe('physical');
        expect(afterAttack.recentRoll?.attack?.weaponCardId).toBeUndefined();
        expect(afterAttack.recentRoll?.attack?.weaponAttackTrait).toBeUndefined();
        expect(afterAttack.recentRoll?.attack?.weaponExtraDice).toBeUndefined();
        expect(afterAttack.recentRoll?.attack?.weaponSpeedCost).toBeUndefined();
        expect(afterAttack.recentRoll?.attack?.previousDamageToDefender).toBeGreaterThan(0);
        expect(afterAttack.recentRoll?.attack?.previousDamageToAttacker).toBe(0);
        expect(afterAttack.usedCardIdsThisTurn).toContain('haunt-attack');
        expect(afterAttack.usedCardIdsThisTurn).not.toContain('dagger');
        expect(afterAttack.usedCardIdsThisTurn).not.toContain('ring');
        expect(afterAttack.traitorTraits.might + afterAttack.traitorTraits.speed).toBeLessThan(
            beforeAttack.traitorTraits.might + beforeAttack.traitorTraits.speed,
        );
        expect(afterAttack.traitorTraits.knowledge + afterAttack.traitorTraits.sanity).toBe(
            beforeAttack.traitorTraits.knowledge + beforeAttack.traitorTraits.sanity,
        );
        expect(afterAttack.attackerTraits).toEqual(beforeAttack.attackerTraits);
        await saveScreenshot(page, UNARMED_ATTACK_RESULT_SCREENSHOT);

        const attackRollBackdrop = page.getByTestId('betrayal-roll-review-backdrop');
        await expect(attackRollBackdrop).toHaveAttribute('data-backdrop-dismiss', 'enabled');
        await attackRollBackdrop.click({ position: { x: 16, y: 16 } });
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await saveScreenshot(page, UNARMED_ATTACK_SETTLED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-non-p0-unarmed-attack', diagnostics }]);
    });

    test('指环神志攻击真实链路：选择指环后用神志对攻并造成精神伤害', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-non-p0-ring-sanity-attack');

        const injectedCore = createRingAttackCore();
        expect(injectedCore.currentExplorer.inventory.map((card) => card.id)).toEqual(['ring']);
        await injectCore(page, injectedCore);
        await expect.poll(async () => {
            const state = await readWeaponAttackState(page);
            return {
                roomId: state.attackerRoomId,
                inventoryIds: state.attackerInventoryIds,
            };
        }, { timeout: 30000 }).toEqual({
            roomId: 'entrance-hall',
            inventoryIds: ['ring'],
        });
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-inventory-ring')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-section')).toContainText('指环');
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('兔脚');
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('地图');
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('魔法相机');
        await expect(page.getByTestId('betrayal-attack-weapon-selector')).toBeVisible();
        await expect(page.getByTestId('betrayal-attack-weapon-ring')).toBeVisible();
        await expect(page.getByTestId('betrayal-attack-weapon-none')).toHaveClass(/underline/);
        const beforeAttack = await readWeaponAttackState(page);
        expect(beforeAttack.recentRoll).toBeNull();
        await saveScreenshot(page, RING_ATTACK_READY_SCREENSHOT);

        await page.getByTestId('betrayal-attack-weapon-ring').click();
        await expect(page.getByTestId('betrayal-attack-weapon-ring')).toHaveClass(/underline/);
        await saveScreenshot(page, RING_ATTACK_SELECTED_SCREENSHOT);

        const traitorToken = page.getByTestId('betrayal-room-occupant-entrance-hall-2');
        await expect(traitorToken).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, RING_ATTACK_TARGET_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.5, 0.5, 0.5, 0.5, 0, 0, 0, 0]);
        await traitorToken.click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('使用指环');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('mental damage');
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('攻击投骰');
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '4');
        await expectVisiblePhysicalDiceBox(attackRollPanel);
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expectPhysicalDiceSeparated(attackRollPanel, { minDiceCount: 4 });
        await saveScreenshot(page, RING_ATTACK_DICE_SCREENSHOT);

        const afterAttack = await readWeaponAttackState(page);
        expect(afterAttack.recentRoll?.kind).toBe('attackRoll');
        expect(afterAttack.recentRoll?.dice).toHaveLength(4);
        expect(afterAttack.recentRoll?.attack?.damageKind).toBe('mental');
        expect(afterAttack.recentRoll?.attack?.weaponCardId).toBe('ring');
        expect(afterAttack.recentRoll?.attack?.weaponAttackTrait).toBe('sanity');
        expect(afterAttack.recentRoll?.attack?.previousDamageToDefender).toBeGreaterThan(0);
        expect(afterAttack.recentRoll?.attack?.previousDamageToAttacker).toBe(0);
        expect(afterAttack.usedCardIdsThisTurn).toContain('ring');
        expect(afterAttack.traitorTraits.might + afterAttack.traitorTraits.speed).toBe(
            beforeAttack.traitorTraits.might + beforeAttack.traitorTraits.speed,
        );
        expect(afterAttack.traitorTraits.knowledge + afterAttack.traitorTraits.sanity).toBeLessThan(
            beforeAttack.traitorTraits.knowledge + beforeAttack.traitorTraits.sanity,
        );
        expect(afterAttack.attackerTraits).toEqual(beforeAttack.attackerTraits);
        await saveScreenshot(page, RING_ATTACK_RESULT_SCREENSHOT);

        await expect(page.getByTestId('betrayal-attack-weapon-ring')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await saveScreenshot(page, RING_ATTACK_SETTLED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-non-p0-ring-sanity-attack', diagnostics }]);
    });

    test('匕首攻击真实链路：选择匕首后6骰攻击并花费速度造成物理伤害', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-non-p0-dagger-attack');

        const injectedCore = createDaggerAttackCore();
        expect(injectedCore.currentExplorer.inventory.map((card) => card.id)).toEqual(['dagger']);
        await injectCore(page, injectedCore);
        await expect.poll(async () => {
            const state = await readWeaponAttackState(page);
            return {
                roomId: state.attackerRoomId,
                inventoryIds: state.attackerInventoryIds,
            };
        }, { timeout: 30000 }).toEqual({
            roomId: 'entrance-hall',
            inventoryIds: ['dagger'],
        });
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-inventory-dagger')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-section')).toContainText('匕首');
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('指环');
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('兔脚');
        await expect(page.getByTestId('betrayal-inventory-section')).not.toContainText('地图');
        await expect(page.getByTestId('betrayal-attack-weapon-selector')).toBeVisible();
        await expect(page.getByTestId('betrayal-attack-weapon-dagger')).toBeVisible();
        await expect(page.getByTestId('betrayal-attack-weapon-none')).toHaveClass(/underline/);
        const beforeAttack = await readWeaponAttackState(page);
        expect(beforeAttack.recentRoll).toBeNull();
        await saveScreenshot(page, DAGGER_ATTACK_READY_SCREENSHOT);

        await page.getByTestId('betrayal-attack-weapon-dagger').click();
        await expect(page.getByTestId('betrayal-attack-weapon-dagger')).toHaveClass(/underline/);
        await saveScreenshot(page, DAGGER_ATTACK_SELECTED_SCREENSHOT);

        const traitorToken = page.getByTestId('betrayal-room-occupant-entrance-hall-2');
        await expect(traitorToken).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, DAGGER_ATTACK_TARGET_SCREENSHOT);

        await setHarnessRandomQueue(page, [
            0.5, 0, 0, 0, 0, 0,
            0, 0, 0, 0,
        ]);
        await traitorToken.click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('使用匕首');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('physical damage');
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('攻击投骰');
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '6');
        await expectVisiblePhysicalDiceBox(attackRollPanel);
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expectPhysicalDiceSeparated(attackRollPanel, { minDiceCount: 6 });
        await saveScreenshot(page, DAGGER_ATTACK_DICE_SCREENSHOT);

        const afterAttack = await readWeaponAttackState(page);
        expect(afterAttack.recentRoll?.kind).toBe('attackRoll');
        expect(afterAttack.recentRoll?.dice).toHaveLength(6);
        expect(afterAttack.recentRoll?.attack?.damageKind).toBe('physical');
        expect(afterAttack.recentRoll?.attack?.weaponCardId).toBe('dagger');
        expect(afterAttack.recentRoll?.attack?.weaponAttackTrait).toBe('might');
        expect(afterAttack.recentRoll?.attack?.weaponExtraDice).toBe(2);
        expect(afterAttack.recentRoll?.attack?.weaponSpeedCost).toBe(1);
        expect(afterAttack.recentRoll?.attack?.previousDamageToDefender).toBeGreaterThan(0);
        expect(afterAttack.recentRoll?.attack?.previousDamageToAttacker).toBe(0);
        expect(afterAttack.usedCardIdsThisTurn).toContain('dagger');
        expect(afterAttack.attackerTraits.speed).toBe(beforeAttack.attackerTraits.speed - 1);
        expect(afterAttack.traitorTraits.might + afterAttack.traitorTraits.speed).toBeLessThan(
            beforeAttack.traitorTraits.might + beforeAttack.traitorTraits.speed,
        );
        expect(afterAttack.traitorTraits.knowledge + afterAttack.traitorTraits.sanity).toBe(
            beforeAttack.traitorTraits.knowledge + beforeAttack.traitorTraits.sanity,
        );
        await saveScreenshot(page, DAGGER_ATTACK_RESULT_SCREENSHOT);

        await expect(page.getByTestId('betrayal-attack-weapon-dagger')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await saveScreenshot(page, DAGGER_ATTACK_SETTLED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-non-p0-dagger-attack', diagnostics }]);
    });
});
