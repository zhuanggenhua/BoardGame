import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import { type BetrayalCore } from '../../src/games/betrayal/game';
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
    dispatchHarnessCommand,
    expectPhysicalDiceSeparated,
    expectVisiblePhysicalDiceBox,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
} from './betrayalTestHelpers';

const ITEM_DISCOVERY_CONFIRMATION_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-item-discovery-confirmation');
const ARMORY_PLACEMENT_SCREENSHOT = `${ITEM_DISCOVERY_CONFIRMATION_EVIDENCE_DIR}/01-器械库-确认房间朝向.jpg`;
const ARMORY_DISCOVERY_FIRST_STEP_SCREENSHOT = `${ITEM_DISCOVERY_CONFIRMATION_EVIDENCE_DIR}/02-器械库-发现确认1-房间获得武器.jpg`;
const ARMORY_DISCOVERY_SECOND_STEP_SCREENSHOT = `${ITEM_DISCOVERY_CONFIRMATION_EVIDENCE_DIR}/03-器械库-发现确认2-展示后掩埋.jpg`;
const ARMORY_DISCOVERY_THIRD_STEP_SCREENSHOT = `${ITEM_DISCOVERY_CONFIRMATION_EVIDENCE_DIR}/04-器械库-发现确认3-符号抽牌入持有区.jpg`;
const ARMORY_INVENTORY_SCREENSHOT = `${ITEM_DISCOVERY_CONFIRMATION_EVIDENCE_DIR}/05-器械库-确认完毕回牌桌持有区.jpg`;
const ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-ordinary-item-discovery-confirmation');
const ORDINARY_ITEM_PLACEMENT_SCREENSHOT = `${ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR}/01-厨房-确认房间朝向.jpg`;
const ORDINARY_ITEM_DISCOVERY_SCREENSHOT = `${ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR}/02-厨房-物品发现确认.jpg`;
const ORDINARY_ITEM_INVENTORY_SCREENSHOT = `${ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR}/03-厨房-确认完毕回牌桌持有区.jpg`;
const ORDINARY_ITEM_MATRIX_FIRST_CARD_SCREENSHOT = `${ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR}/04-当前12张物品矩阵-首张发现确认.jpg`;
const ORDINARY_ITEM_MATRIX_DONE_SCREENSHOT = `${ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR}/05-当前12张物品矩阵-末张确认后持有区.jpg`;
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

type ItemDiscoveryCard = BetrayalCore['possessionOrderByKind']['item'][number];

const CURRENT_ITEM_DISCOVERY_CARDS: ItemDiscoveryCard[] =
    BETRAYAL_DISCOVERY_POOLS.possessions.item.map((item) => ({ ...item }));

const openBetrayalPage = async (page: Page, context: Parameters<typeof initBetrayalContext>[0], label: string) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, label);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
    return diagnostics;
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

const createOrdinaryItemDiscoveryCore = (
    itemCard: ItemDiscoveryCard =
        CURRENT_ITEM_DISCOVERY_CARDS.find((card) => card.id === 'flashlight') ??
        ({ id: 'flashlight', name: '手电筒', kind: 'item' } satisfies ItemDiscoveryCard),
) => {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.drawOrder = ['item'];
    core.roomDiscoveryOrderByFloor.ground = [
        BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'kitchen')!,
    ];
    core.possessionOrderByKind.item = [
        { ...itemCard },
    ];
    core.deckCounts.item = core.possessionOrderByKind.item.length;
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'hallway',
        inventory: [],
    };
    core.activeRoomId = 'hallway';
    core.currentExplorerInventory = [];
    return core;
};

type OrdinaryItemDiscoveryState = {
    latestDiscoveryTitle?: string | null;
    latestDiscoveryKind?: string | null;
    currentInventory?: Array<{
        id?: string;
        name?: string;
        kind?: string;
    }>;
    pendingSteps?: Array<{
        stepKind?: string;
        index?: number;
        total?: number;
        cardName?: string;
    }>;
    rejected?: { commandType?: string; error?: string } | null;
};

const readCurrentCore = async (page: Page): Promise<BetrayalCore> => {
    const core = await page.evaluate(() => (
        window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: { get?: () => { core?: BetrayalCore } };
            };
        }
    ).__BG_TEST_HARNESS__?.state?.get?.().core);
    if (!core) {
        throw new Error('山屋测试 harness 未返回当前 core');
    }
    return core;
};

const acknowledgeOtherPlayersForResolution = async (
    page: Page,
    resolutionId: string,
) => {
    for (let safety = 0; safety < 12; safety += 1) {
        const core = await readCurrentCore(page);
        const pending = core.pendingCardResolutionQueue?.[0];
        if (!pending || pending.id !== resolutionId) {
            return;
        }
        const requiredPlayerIds = pending.requiredPlayerIds?.length
            ? pending.requiredPlayerIds
            : [pending.playerId];
        const acknowledgedPlayerIds = new Set(pending.acknowledgedPlayerIds ?? []);
        const nextPlayerId = requiredPlayerIds.find((playerId) => !acknowledgedPlayerIds.has(playerId));
        if (!nextPlayerId) {
            return;
        }
        await dispatchHarnessCommand(
            page,
            'ACKNOWLEDGE_CARD_RESOLUTION',
            nextPlayerId,
            { resolutionId },
        );
    }
    throw new Error(`山屋测试 harness 确认队列未能完成：${resolutionId}`);
};

const readOrdinaryItemDiscoveryState = async (
    page: Page,
): Promise<OrdinaryItemDiscoveryState> =>
    page.evaluate(() => {
        const holder = window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentExplorer?: {
                                inventory?: Array<{
                                    id?: string;
                                    name?: string;
                                    kind?: string;
                                }>;
                            };
                            latestDiscovery?: {
                                title?: string;
                                kind?: string;
                            } | null;
                            pendingCardResolutionQueue?: Array<{
                                stepKind?: string;
                                index?: number;
                                total?: number;
                                cardName?: string;
                            }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { commandType?: string; error?: string } | null;
        };
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.()?.core;
        return {
            latestDiscoveryTitle: core?.latestDiscovery?.title ?? null,
            latestDiscoveryKind: core?.latestDiscovery?.kind ?? null,
            currentInventory: core?.currentExplorer?.inventory?.map((card) => ({
                id: card.id,
                name: card.name,
                kind: card.kind,
            })) ?? [],
            pendingSteps: core?.pendingCardResolutionQueue?.map((step) => ({
                stepKind: step.stepKind,
                index: step.index,
                total: step.total,
                cardName: step.cardName,
            })) ?? [],
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    });

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
    test('普通物品符号房间发现抽牌：真实页面显示单步获得物品确认', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-ordinary-item-discovery');

        await injectCore(page, createOrdinaryItemDiscoveryCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('betrayal-action-explore').click();
        await page.getByTestId('betrayal-room-ground-north').click();

        const placementPanel = page.getByTestId('betrayal-room-placement-panel');
        await expect(placementPanel).toBeVisible();
        await expect(placementPanel).toContainText('厨房');
        await expect(page.getByTestId('betrayal-room-placement-preview')).toBeVisible();
        await saveScreenshot(page, ORDINARY_ITEM_PLACEMENT_SCREENSHOT);

        await page.getByTestId('betrayal-room-placement-confirm').click();

        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
        await expect(discoveryPanel).toHaveAttribute('aria-label', /物品牌 手电筒/);
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('已加入持有区');
        await expect(discoveryPanel).toContainText('手电筒');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step')).toHaveCount(1);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText('已加入持有区');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText('手电筒');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute('data-pending-card-resolution-step', '1/1');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('探索到厨房');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('拿到了手电筒');
        await expect(page.locator('[data-testid="betrayal-inventory-flashlight-0"]')).toBeVisible();
        await saveScreenshot(page, ORDINARY_ITEM_DISCOVERY_SCREENSHOT);

        const ordinaryResolutionId = (await readCurrentCore(page)).pendingCardResolutionQueue?.[0]?.id;
        if (!ordinaryResolutionId) {
            throw new Error('普通物品发现缺少待确认结算');
        }
        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeOtherPlayersForResolution(page, ordinaryResolutionId);
        await expect(discoveryPanel).toHaveCount(0);
        await expect(page.locator('[data-testid="betrayal-inventory-flashlight-0"]')).toBeVisible();
        await expect(page.getByTestId('betrayal-deck-resolution-ledger')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-deck-resolution-ledger-step')).toHaveCount(0);
        await saveScreenshot(page, ORDINARY_ITEM_INVENTORY_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-ordinary-item-discovery', diagnostics }]);
    });

    test('当前12张物品在普通物品符号房间发现时均显示单步确认并进入持有区', async ({ page, context }) => {
        test.setTimeout(300000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-ordinary-item-discovery-matrix');

        for (const [index, itemCard] of CURRENT_ITEM_DISCOVERY_CARDS.entries()) {
            await injectCore(page, createOrdinaryItemDiscoveryCore(itemCard));
            await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
            await page.getByTestId('betrayal-action-explore').click();
            await page.getByTestId('betrayal-room-ground-north').click();

            const placementPanel = page.getByTestId('betrayal-room-placement-panel');
            await expect(placementPanel, `物品「${itemCard.name}」发现前应先确认厨房朝向`).toBeVisible();
            await expect(placementPanel).toContainText('厨房');
            await page.getByTestId('betrayal-room-placement-confirm').click();

            const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
            await expect(discoveryPanel, `物品「${itemCard.name}」应显示发现确认面板`).toBeVisible({
                timeout: 30000,
            });
            await expect(discoveryPanel).toHaveAttribute('aria-label', new RegExp(`物品牌 ${itemCard.name}`));
            await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('已加入持有区');
            await expect(discoveryPanel).toContainText(itemCard.name);
            await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step')).toHaveCount(1);
            await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText(
                '已加入持有区',
            );
            await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText(
                itemCard.name,
            );
            await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认');
            await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute(
                'data-pending-card-resolution-step',
                '1/1',
            );
            await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('探索到厨房');
            await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(`拿到了${itemCard.name}`);
            await expect(page.getByTestId('betrayal-inventory-row-item')).toContainText(itemCard.name);
            await expect.poll(() => readOrdinaryItemDiscoveryState(page)).toMatchObject({
                latestDiscoveryTitle: itemCard.name,
                latestDiscoveryKind: 'item',
                pendingSteps: [
                    { stepKind: 'drawn-card', index: 1, total: 1, cardName: itemCard.name },
                ],
                rejected: null,
            });

            if (index === 0) {
                await saveScreenshot(page, ORDINARY_ITEM_MATRIX_FIRST_CARD_SCREENSHOT);
            }

            const matrixResolutionId = (await readCurrentCore(page)).pendingCardResolutionQueue?.[0]?.id;
            if (!matrixResolutionId) {
                throw new Error(`物品「${itemCard.name}」缺少待确认结算`);
            }
            await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
            await acknowledgeOtherPlayersForResolution(page, matrixResolutionId);
            await expect(discoveryPanel).toHaveCount(0);
            await expect(page.getByTestId('betrayal-inventory-row-item')).toContainText(itemCard.name);
            await expect(page.getByTestId('betrayal-deck-resolution-ledger')).toHaveCount(0);
            await expect(page.getByTestId('betrayal-deck-resolution-ledger-step')).toHaveCount(0);
            await expect.poll(async () => {
                const state = await readOrdinaryItemDiscoveryState(page);
                return Boolean(
                    state.currentInventory?.some((card) => (
                        card.kind === 'item' &&
                        card.id?.startsWith(itemCard.id) &&
                        card.name === itemCard.name
                    )),
                );
            }).toBe(true);
            await expect.poll(() => readOrdinaryItemDiscoveryState(page)).toMatchObject({
                pendingSteps: [],
                rejected: null,
            });

            if (index === CURRENT_ITEM_DISCOVERY_CARDS.length - 1) {
                await saveScreenshot(page, ORDINARY_ITEM_MATRIX_DONE_SCREENSHOT);
            }
        }

        assertNoFatalFrontendErrors([{ label: 'betrayal-ordinary-item-discovery-matrix', diagnostics }]);
    });

    test('器械库代表房间发现抽牌：真实页面显示砍刀并进入持有区', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-high-risk-armory-discovery');

        await injectCore(page, createArmoryDiscoveryCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('betrayal-action-explore').click();
        await page.getByTestId('betrayal-room-ground-north').click();

        const placementPanel = page.getByTestId('betrayal-room-placement-panel');
        await expect(placementPanel).toBeVisible();
        await expect(placementPanel).toContainText('器械库');
        await expect(page.getByTestId('betrayal-room-placement-preview')).toBeVisible();
        await saveScreenshot(page, ARMORY_PLACEMENT_SCREENSHOT);

        await page.getByTestId('betrayal-room-placement-confirm').click();

        const discoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
        await expect(discoveryPanel).toHaveAttribute('aria-label', /物品牌 急救包/);
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('器械库获得砍刀');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('展示后埋葬急救包');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('已加入持有区');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step')).toHaveCount(3);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText('器械库获得砍刀');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(1)).toContainText('展示后埋葬急救包');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(2)).toContainText('已加入持有区');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(2)).toContainText('急救包');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('探索到器械库');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('拿到了砍刀、急救包');
        await expect(page.locator('[data-testid="betrayal-inventory-hunting-knife-armory-0-1"]')).toBeVisible();
        await expect(page.locator('[data-testid="betrayal-inventory-medical-kit-0"]')).toBeVisible();
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认本步（步骤 1/3）');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute('data-pending-card-resolution-step', '1/3');
        await saveScreenshot(page, ARMORY_DISCOVERY_FIRST_STEP_SCREENSHOT);

        const armoryFirstResolutionId = (await readCurrentCore(page)).pendingCardResolutionQueue?.[0]?.id;
        if (!armoryFirstResolutionId) {
            throw new Error('器械库第一步缺少待确认结算');
        }
        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeOtherPlayersForResolution(page, armoryFirstResolutionId);
        await expect(discoveryPanel).toBeVisible();
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认本步（步骤 2/3）');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute('data-pending-card-resolution-step', '2/3');
        await saveScreenshot(page, ARMORY_DISCOVERY_SECOND_STEP_SCREENSHOT);

        const armorySecondResolutionId = (await readCurrentCore(page)).pendingCardResolutionQueue?.[0]?.id;
        if (!armorySecondResolutionId) {
            throw new Error('器械库第二步缺少待确认结算');
        }
        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeOtherPlayersForResolution(page, armorySecondResolutionId);
        await expect(discoveryPanel).toBeVisible();
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认本步（步骤 3/3）');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute('data-pending-card-resolution-step', '3/3');
        await saveScreenshot(page, ARMORY_DISCOVERY_THIRD_STEP_SCREENSHOT);

        const armoryThirdResolutionId = (await readCurrentCore(page)).pendingCardResolutionQueue?.[0]?.id;
        if (!armoryThirdResolutionId) {
            throw new Error('器械库第三步缺少待确认结算');
        }
        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeOtherPlayersForResolution(page, armoryThirdResolutionId);
        await expect(discoveryPanel).toHaveCount(0);
        await expect(page.locator('[data-testid="betrayal-inventory-hunting-knife-armory-0-1"]')).toBeVisible();
        await expect(page.locator('[data-testid="betrayal-inventory-medical-kit-0"]')).toBeVisible();
        await expect(page.getByTestId('betrayal-deck-resolution-ledger')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-deck-resolution-ledger-step')).toHaveCount(0);
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
