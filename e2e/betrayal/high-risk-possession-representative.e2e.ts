import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
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
    expectPhysicalDiceSeparated,
    expectVisiblePhysicalDiceBox,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-high-risk-possession-representatives');
const ARMORY_DISCOVERY_SCREENSHOT = `${EVIDENCE_DIR}/01-器械库-发现砍刀并进入持有区.png`;
const ARMORY_INVENTORY_SCREENSHOT = `${EVIDENCE_DIR}/02-器械库-关闭发现后持有区砍刀.png`;
const SKULL_FULL_CHAIN_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/山屋惊魂-头骨死亡保护完整链路');
const SKULL_PREVENT_READY_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/01-头骨阻止死亡-攻击前牌桌可操作.jpg`;
const SKULL_PREVENT_TARGET_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/02-头骨阻止死亡-叛徒目标高亮.jpg`;
const SKULL_PREVENT_DICE_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/03-头骨阻止死亡-死亡保护3骰停稳.jpg`;
const SKULL_PREVENT_RESULT_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/04-头骨阻止死亡-结果可见.jpg`;
const SKULL_PREVENT_SETTLED_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/05-头骨阻止死亡-属性濒死未死亡.jpg`;
const SKULL_PREVENT_DISMISSED_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/06-头骨阻止死亡-回牌桌继续操作.jpg`;
const SKULL_DEATH_READY_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/07-头骨未阻止死亡-攻击前牌桌可操作.jpg`;
const SKULL_DEATH_TARGET_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/08-头骨未阻止死亡-叛徒目标高亮.jpg`;
const SKULL_DEATH_DICE_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/09-头骨未阻止死亡-死亡保护3骰停稳.jpg`;
const SKULL_DEATH_RESULT_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/10-头骨未阻止死亡-正常死亡结果可见.jpg`;
const SKULL_DEATH_SETTLED_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/11-头骨未阻止死亡-死亡状态落位.jpg`;
const SKULL_DEATH_DISMISSED_SCREENSHOT = `${SKULL_FULL_CHAIN_EVIDENCE_DIR}/12-头骨未阻止死亡-牌桌仍可查看.jpg`;
const SKULL_PREVENT_RANDOM_QUEUE = [
    0.01, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99,
    0.01, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99,
    0.01, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99,
];
const SKULL_DEATH_RANDOM_QUEUE = [
    0.01, 0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01,
    0.01, 0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01,
    0.01, 0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01,
];

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

const createSkullDeathPreventionAttackReadyCore = () => {
    const core = createFirstScenarioHauntCore();
    const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2');
    if (!traitor) {
        throw new Error('山屋首剧本头骨夹具缺少叛徒');
    }

    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'entrance-hall',
        traits: {
            might: 1,
            speed: 1,
            knowledge: 1,
            sanity: 1,
        },
        inventory: [{ id: 'skull', name: '头骨', kind: 'omen' }],
    };
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === '2'
            ? {
                ...explorer,
                roomId: 'entrance-hall',
                traits: {
                    ...explorer.traits,
                    might: 4,
                },
            }
            : explorer
    ));
    core.activeRoomId = 'entrance-hall';
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.turnStartInventoryCardIds = ['skull'];
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.recentRoll = null;
    return core;
};

const readSkullState = async (page: Page) => page.evaluate(() => {
    const core = (window as Window & {
        __BG_TEST_HARNESS__?: {
            state?: {
                get?: () => {
                    core: {
                        currentExplorer: {
                            playerId: string;
                            traits: { might: number; speed: number; knowledge: number; sanity: number };
                        };
                        scenarioRuntime: { deadExplorerPlayerIds: string[] };
                        recentRoll: { kind: string; dice: number[]; latestLabel?: string } | null;
                    };
                };
            };
        };
    }).__BG_TEST_HARNESS__?.state?.get?.().core;
    if (!core) {
        throw new Error('山屋测试 harness 未返回 core');
    }
    return {
        currentExplorer: {
            playerId: core.currentExplorer.playerId,
            traits: { ...core.currentExplorer.traits },
        },
        deadExplorerPlayerIds: [...core.scenarioRuntime.deadExplorerPlayerIds],
        recentRoll: core.recentRoll
            ? {
                kind: core.recentRoll.kind,
                dice: [...core.recentRoll.dice],
                latestLabel: core.recentRoll.latestLabel,
            }
            : null,
    };
});

const exerciseSkullDeathProtectionFromRealAttack = async (
    page: Page,
    options: {
        randomQueue: number[];
        expectedLabel: '阻止死亡' | '正常死亡';
        readyScreenshot: string;
        targetScreenshot: string;
        diceScreenshot: string;
        resultScreenshot: string;
        settledScreenshot: string;
        dismissedScreenshot: string;
    },
) => {
    await injectCore(page, createSkullDeathPreventionAttackReadyCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('betrayal-inventory-skull')).toBeVisible();
    await expect(page.getByTestId('betrayal-status-chip')).toContainText('当前回合');

    const traitorMapTarget = page.getByTestId('betrayal-room-occupant-entrance-hall-2');
    await expect(traitorMapTarget, '头骨链必须从真实叛徒 token 攻击入口起跑').toBeVisible();
    await expect(traitorMapTarget).toHaveAttribute('data-direct-target', 'true');
    await expect(page.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveAttribute('data-highlight-shape', 'pentagon');
    await saveScreenshot(page, options.readyScreenshot);

    await traitorMapTarget.hover();
    await saveScreenshot(page, options.targetScreenshot);

    await setHarnessRandomQueue(page, options.randomQueue);
    await traitorMapTarget.click();

    const deathRollPanel = page.getByTestId('betrayal-recent-roll-panel');
    await expect(deathRollPanel).toContainText('头骨死亡保护', { timeout: 30000 });
    await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '3');
    await expectVisiblePhysicalDiceBox(deathRollPanel);
    await waitForPhysicalDiceSettled(deathRollPanel);
    await expectPhysicalDiceSeparated(deathRollPanel, { minDiceCount: 3 });
    await saveScreenshot(page, options.diceScreenshot);

    await expect(deathRollPanel).toContainText(options.expectedLabel);
    await saveScreenshot(page, options.resultScreenshot);

    const settledState = await readSkullState(page);
    expect(settledState.recentRoll?.kind).toBe('deathPrevention');
    expect(settledState.recentRoll?.latestLabel).toContain(options.expectedLabel);
    expect(settledState.recentRoll?.dice).toHaveLength(3);
    if (options.expectedLabel === '阻止死亡') {
        expect(settledState.deadExplorerPlayerIds).not.toContain('0');
        expect(settledState.currentExplorer.traits).toEqual({
            might: 1,
            speed: 1,
            knowledge: 1,
            sanity: 1,
        });
    } else {
        expect(settledState.deadExplorerPlayerIds).toContain('0');
    }
    await saveScreenshot(page, options.settledScreenshot);

    await expect(page.getByTestId('betrayal-board')).toBeVisible();
    await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
    await saveScreenshot(page, options.dismissedScreenshot);
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

    test('头骨死亡保护真实链路：攻击失败后投3骰阻止死亡并回牌桌', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-high-risk-skull-death-prevention-prevented');

        await exerciseSkullDeathProtectionFromRealAttack(page, {
            randomQueue: SKULL_PREVENT_RANDOM_QUEUE,
            expectedLabel: '阻止死亡',
            readyScreenshot: SKULL_PREVENT_READY_SCREENSHOT,
            targetScreenshot: SKULL_PREVENT_TARGET_SCREENSHOT,
            diceScreenshot: SKULL_PREVENT_DICE_SCREENSHOT,
            resultScreenshot: SKULL_PREVENT_RESULT_SCREENSHOT,
            settledScreenshot: SKULL_PREVENT_SETTLED_SCREENSHOT,
            dismissedScreenshot: SKULL_PREVENT_DISMISSED_SCREENSHOT,
        });

        assertNoFatalFrontendErrors([{ label: 'betrayal-high-risk-skull-death-prevention-prevented', diagnostics }]);
    });

    test('头骨死亡保护真实链路：攻击失败后投3骰未阻止则正常死亡', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-high-risk-skull-death-prevention-failed');

        await exerciseSkullDeathProtectionFromRealAttack(page, {
            randomQueue: SKULL_DEATH_RANDOM_QUEUE,
            expectedLabel: '正常死亡',
            readyScreenshot: SKULL_DEATH_READY_SCREENSHOT,
            targetScreenshot: SKULL_DEATH_TARGET_SCREENSHOT,
            diceScreenshot: SKULL_DEATH_DICE_SCREENSHOT,
            resultScreenshot: SKULL_DEATH_RESULT_SCREENSHOT,
            settledScreenshot: SKULL_DEATH_SETTLED_SCREENSHOT,
            dismissedScreenshot: SKULL_DEATH_DISMISSED_SCREENSHOT,
        });

        assertNoFatalFrontendErrors([{ label: 'betrayal-high-risk-skull-death-prevention-failed', diagnostics }]);
    });
});
