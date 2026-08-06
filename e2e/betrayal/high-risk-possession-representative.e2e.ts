import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import {
    resolveBetrayalMonsterMovementGroups,
    type BetrayalCore,
    type BetrayalMonsterMovementRollGroupResult,
} from '../../src/games/betrayal/game';
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
const ARMORY_INVENTORY_SCREENSHOT = `${ITEM_DISCOVERY_CONFIRMATION_EVIDENCE_DIR}/04-器械库-确认完毕回牌桌持有区.jpg`;
const ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-ordinary-item-discovery-confirmation');
const ORDINARY_ITEM_PLACEMENT_SCREENSHOT = `${ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR}/01-金库-确认房间朝向.jpg`;
const ORDINARY_ITEM_DISCOVERY_SCREENSHOT = `${ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR}/02-金库-物品发现确认.jpg`;
const ORDINARY_ITEM_INVENTORY_SCREENSHOT = `${ORDINARY_ITEM_DISCOVERY_EVIDENCE_DIR}/03-金库-确认完毕回牌桌持有区.jpg`;
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
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';
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
const MUMMY_ATTACK_RANDOM_QUEUE = [
    0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99,
    0.01, 0.01, 0.01, 0.01,
];

type ItemDiscoveryCard = BetrayalCore['possessionOrderByKind']['item'][number];

const CURRENT_ITEM_DISCOVERY_CARDS: ItemDiscoveryCard[] =
    BETRAYAL_DISCOVERY_POOLS.possessions.item.map((item) => ({ ...item }));

const openBetrayalPage = async (
    page: Page,
    context: Parameters<typeof initBetrayalContext>[0],
    label: string,
    route = '/play/betrayal',
) => {
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, label);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
    return diagnostics;
};

const openBetrayalAsPlayer = async (page: Page, playerId: string) => {
    await page.goto(
        `/play/betrayal?players=3&playerID=${playerId}&seat0=human&seat1=human&seat2=human`,
        { waitUntil: 'domcontentloaded' },
    );
    await waitForBetrayalPageReady(page);
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
        BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'vault')!,
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
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    if (!traitorId) {
        throw new Error('山屋首剧本头骨夹具缺少叛徒');
    }

    const explorers = [core.currentExplorer, ...core.otherExplorers].map((explorer) => ({
        ...explorer,
        traits: { ...explorer.traits },
        traitTracks: Object.fromEntries(
            Object.entries(explorer.traitTracks).map(([trait, track]) => [
                trait,
                { ...track, values: [...track.values] },
            ]),
        ) as BetrayalCore['currentExplorer']['traitTracks'],
        inventory: explorer.inventory.map((card) => ({ ...card })),
    }));
    const traitor = explorers.find((explorer) => explorer.playerId === traitorId);
    if (!traitor) {
        throw new Error(`山屋首剧本头骨夹具缺少叛徒玩家 ${traitorId}`);
    }
    const skullTarget = explorers.find((explorer) => explorer.playerId !== traitorId);
    if (!skullTarget) {
        throw new Error('山屋首剧本头骨夹具缺少可被攻击的英雄');
    }

    const attackRoomId = 'entrance-hall';
    const attackMonster = core.monsters.find((monster) => monster.id !== 'jack-spirit') ?? core.monsters[0];
    if (!attackMonster) {
        throw new Error('山屋首剧本头骨夹具缺少可攻击怪物');
    }

    core.currentPlayer = traitorId;
    core.currentExplorer = {
        ...traitor,
        roomId: attackRoomId,
    };
    core.otherExplorers = explorers
        .filter((explorer) => explorer.playerId !== traitorId)
        .map((explorer) => ({ ...explorer, roomId: attackRoomId }));
    core.monsters = core.monsters.map((monster) => (
        monster.id === attackMonster.id
            ? { ...monster, roomId: attackRoomId }
            : monster
    ));
    core.activeRoomId = attackRoomId;
    core.currentExplorerRoomId = attackRoomId;
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);

    const movementGroup = resolveBetrayalMonsterMovementGroups(core)
        .find((group) => group.monsterIds.includes(attackMonster.id));
    if (!movementGroup) {
        throw new Error(`山屋首剧本头骨夹具找不到 ${attackMonster.name} 的移动骰组`);
    }
    const movementResult: BetrayalMonsterMovementRollGroupResult = {
        groupId: movementGroup.groupId,
        monsterName: movementGroup.monsterName,
        monsterIds: [...movementGroup.monsterIds],
        playerId: traitorId,
        speed: movementGroup.speed,
        diceCount: movementGroup.diceCount,
        dice: Array.from({ length: movementGroup.diceCount }, () => 0),
        total: 0,
        moveAllowance: 0,
        rollOnceForGroup: true,
        minimumMoveAllowance: movementGroup.minimumMoveAllowance,
    };
    core.scenarioRuntime.monsterTurn = {
        ...core.scenarioRuntime.monsterTurn,
        resolvedStartMonsterIds: Array.from(new Set([
            ...core.scenarioRuntime.monsterTurn.resolvedStartMonsterIds,
            ...movementGroup.monsterIds,
        ])),
        movementRollsByGroupId: {
            ...core.scenarioRuntime.monsterTurn.movementRollsByGroupId,
            [movementGroup.groupId]: movementResult,
        },
        moveRemainingById: {
            ...core.scenarioRuntime.monsterTurn.moveRemainingById,
            ...Object.fromEntries(movementGroup.monsterIds.map((id) => [id, 0])),
        },
    };

    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: attackRoomId,
        inventory: core.currentExplorer.inventory.filter((card) => card.id !== 'skull'),
    };
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === skullTarget.playerId
            ? {
                ...explorer,
                roomId: attackRoomId,
                traits: {
                    ...explorer.traits,
                    might: 1,
                },
                inventory: [{ id: 'skull', name: '头骨', kind: 'omen' }],
            }
            : explorer
    ));
    core.activeRoomId = attackRoomId;
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.recentRoll = null;
    return core;
};

const readSkullState = async (page: Page, targetPlayerId: string) => page.evaluate((targetId) => {
    const core = (window as Window & {
        __BG_TEST_HARNESS__?: {
            state?: {
                get?: () => {
                    core: {
                        currentExplorer: {
                            playerId: string;
                            traits: { might: number; speed: number; knowledge: number; sanity: number };
                        };
                        otherExplorers: Array<{
                            playerId: string;
                            traits: { might: number; speed: number; knowledge: number; sanity: number };
                        }>;
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
    const target = [core.currentExplorer, ...core.otherExplorers].find(
        (explorer) => explorer.playerId === targetId,
    );
    if (!target) {
        throw new Error(`山屋测试 harness 未返回头骨目标 ${targetId}`);
    }
    return {
        currentExplorer: {
            playerId: target.playerId,
            traits: { ...target.traits },
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
}, targetPlayerId);

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
    const preparedCore = await readCurrentCore(page);
    const skullTarget = [preparedCore.currentExplorer, ...preparedCore.otherExplorers].find(
        (explorer) => explorer.inventory.some((card) => card.id === 'skull'),
    );
    if (!skullTarget) {
        throw new Error('头骨真实链路夹具没有把头骨放入英雄持有区');
    }
    expect(skullTarget.playerId).not.toBe(preparedCore.scenarioRuntime.traitorPlayerId);
    await expect(page.getByTestId('betrayal-status-chip')).toContainText('当前回合');

    await page.getByTestId('betrayal-action-monsterAttack').click();

    const skullTargetToken = page.getByTestId(`betrayal-room-occupant-entrance-hall-${skullTarget.playerId}`);
    await expect(skullTargetToken, '头骨链必须从真实英雄 token 攻击入口起跑').toBeVisible();
    await expect(skullTargetToken).toHaveAttribute('data-direct-target', 'true');
    await expect(page.getByTestId(`betrayal-room-occupant-target-outline-entrance-hall-${skullTarget.playerId}`)).toHaveAttribute('data-highlight-shape', 'pentagon');
    await saveScreenshot(page, options.readyScreenshot);

    await skullTargetToken.hover();
    await saveScreenshot(page, options.targetScreenshot);

    await setHarnessRandomQueue(page, MUMMY_ATTACK_RANDOM_QUEUE);
    await skullTargetToken.click();

    const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
    await expect(attackRollPanel).toContainText('木乃伊攻击', { timeout: 30000 });
    await waitForPhysicalDiceSettled(attackRollPanel);
    await expect(attackRollPanel).toContainText('伤害或偷取');
    await page.getByTestId('betrayal-roll-continue').click();
    await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
    await page.getByTestId('betrayal-mummy-reward-damage').click();
    await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
        'data-player-id',
        skullTarget.playerId,
    );
    const coreAfterDamageChoice = await readCurrentCore(page);
    const forcedDamageTraits = coreAfterDamageChoice.pendingDamageAllocation?.forcedTraitSequence ?? [];
    expect(forcedDamageTraits.length).toBeGreaterThan(0);
    await openBetrayalAsPlayer(page, skullTarget.playerId);
    await injectCore(page, coreAfterDamageChoice);
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
        'data-player-id',
        skullTarget.playerId,
    );
    await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('木乃伊攻击');
    await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
    for (const trait of forcedDamageTraits) {
        await page.getByTestId(`betrayal-damage-allocation-trait-${trait}`).click();
    }
    await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
    await setHarnessRandomQueue(
        page,
        options.expectedLabel === '阻止死亡'
            ? Array.from({ length: 12 }, () => 0.99)
            : Array.from({ length: 12 }, () => 0.01),
    );
    await page.getByTestId('betrayal-damage-allocation-confirm').click();

    const deathRollPanel = page.getByTestId('betrayal-recent-roll-panel');
    await expect(deathRollPanel).toContainText('头骨死亡保护', { timeout: 30000 });
    await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '3');
    await expectVisiblePhysicalDiceBox(deathRollPanel);
    await waitForPhysicalDiceSettled(deathRollPanel);
    await expectPhysicalDiceSeparated(deathRollPanel, { minDiceCount: 3 });
    await saveScreenshot(page, options.diceScreenshot);

    await expect(deathRollPanel).toContainText(options.expectedLabel);
    await saveScreenshot(page, options.resultScreenshot);

    const settledState = await readSkullState(page, skullTarget.playerId);
    expect(settledState.recentRoll?.kind).toBe('deathPrevention');
    expect(settledState.recentRoll?.latestLabel).toContain(options.expectedLabel);
    expect(settledState.recentRoll?.dice).toHaveLength(3);
    if (options.expectedLabel === '阻止死亡') {
        expect(settledState.deadExplorerPlayerIds).not.toContain(skullTarget.playerId);
        expect(settledState.currentExplorer.traits.might).toBe(1);
    } else {
        expect(settledState.deadExplorerPlayerIds).toContain(skullTarget.playerId);
    }
    await saveScreenshot(page, options.settledScreenshot);

    await expect(page.getByTestId('betrayal-board')).toBeVisible();
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
        await expect(placementPanel).toContainText('金库');
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
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('探索到金库');
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
            await expect(placementPanel, `物品「${itemCard.name}」发现前应先确认金库朝向`).toBeVisible();
            await expect(placementPanel).toContainText('金库');
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
            await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('探索到金库');
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
        await expect(discoveryPanel).toHaveAttribute('aria-label', /物品牌 砍刀/);
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('器械库获得砍刀');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('展示后埋葬急救包');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step')).toHaveCount(2);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(0)).toContainText('器械库获得砍刀');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-resolution-step').nth(1)).toContainText('展示后埋葬急救包');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('探索到器械库');
        await expect(page.locator('[data-testid="betrayal-inventory-hunting-knife-armory-0-1"]')).toBeVisible();
        await expect(page.locator('[data-testid="betrayal-inventory-medical-kit-0"]')).toHaveCount(0);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认本步（步骤 1/2）');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute('data-pending-card-resolution-step', '1/2');
        await saveScreenshot(page, ARMORY_DISCOVERY_FIRST_STEP_SCREENSHOT);

        const armoryFirstResolutionId = (await readCurrentCore(page)).pendingCardResolutionQueue?.[0]?.id;
        if (!armoryFirstResolutionId) {
            throw new Error('器械库第一步缺少待确认结算');
        }
        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeOtherPlayersForResolution(page, armoryFirstResolutionId);
        await expect(discoveryPanel).toBeVisible();
        await expect(discoveryPanel).toHaveAttribute('aria-label', /物品牌 急救包/);
        await expect(discoveryPanel.getByTestId('betrayal-discovery-card-front-atlas')).toBeVisible();
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toContainText('确认本步（步骤 2/2）');
        await expect(discoveryPanel.getByTestId('betrayal-discovery-continue')).toHaveAttribute('data-pending-card-resolution-step', '2/2');
        await saveScreenshot(page, ARMORY_DISCOVERY_SECOND_STEP_SCREENSHOT);

        const armorySecondResolutionId = (await readCurrentCore(page)).pendingCardResolutionQueue?.[0]?.id;
        if (!armorySecondResolutionId) {
            throw new Error('器械库第二步缺少待确认结算');
        }
        await discoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeOtherPlayersForResolution(page, armorySecondResolutionId);
        await expect(discoveryPanel).toHaveCount(0);
        await expect(page.locator('[data-testid="betrayal-inventory-hunting-knife-armory-0-1"]')).toBeVisible();
        await expect(page.locator('[data-testid="betrayal-inventory-medical-kit-0"]')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-deck-resolution-ledger')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-deck-resolution-ledger-step')).toHaveCount(0);
        await saveScreenshot(page, ARMORY_INVENTORY_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-high-risk-armory-discovery', diagnostics }]);
    });

    test('头骨死亡保护真实链路：攻击失败后投3骰阻止死亡并回牌桌', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-high-risk-skull-death-prevention-prevented', HUMAN_TRAITOR_TEST_URL);

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
        const diagnostics = await openBetrayalPage(page, context, 'betrayal-high-risk-skull-death-prevention-failed', HUMAN_TRAITOR_TEST_URL);

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
