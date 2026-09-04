import { expect, test, type Page } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterMovementGroups,
} from '../../src/games/betrayal/monsterActionReadModel';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioHauntRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-多类型怪物移动骰组真实入口';
const FIRST_ROLL_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-慢速怪物移动骰入口.jpg`;
const FIRST_ROLL_PANEL_SCREENSHOT = `${EVIDENCE_DIR}/02-慢速怪物移动骰结果.jpg`;
const SECOND_ROLL_READY_SCREENSHOT = `${EVIDENCE_DIR}/03-快速怪物移动骰入口.jpg`;
const BOTH_GROUPS_READY_SCREENSHOT = `${EVIDENCE_DIR}/04-两组掷完后怪物移动入口.jpg`;
const SLOW_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/05-慢速怪物目标房间高亮.jpg`;
const FAST_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/06-快速怪物目标房间高亮.jpg`;
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';
const MONSTER_ROOM_ID = 'entrance-hall';
const SLOW_MONSTER_ID = 'test-slow-monster';
const FAST_MONSTER_ID = 'test-fast-monster';
const SLOW_GROUP_ID = '慢速怪物:1';
const FAST_GROUP_ID = '快速怪物:2';

type MonsterMovementGroupsFixture = {
    core: BetrayalCore;
    slowTargetRoomId: string;
    fastTargetRoomId: string;
};

type MonsterMovementGroupsState = {
    currentPlayer?: string;
    enabledMovementGroups?: string[];
    rolledMovementGroups?: string[];
    monsterRooms?: Record<string, string | null>;
    moveRemainingById?: Record<string, number>;
    recentRollTitle?: string | null;
};

const activateExplorer = (core: BetrayalCore, playerId: string): BetrayalCore => {
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
    const active = explorers.find((explorer) => explorer.playerId === playerId);
    if (!active) {
        throw new Error(`山屋多类型怪物移动骰 E2E 夹具缺少玩家 ${playerId}`);
    }
    core.currentPlayer = playerId;
    core.currentExplorer = active;
    core.otherExplorers = explorers.filter((explorer) => explorer.playerId !== playerId);
    core.activeRoomId = active.roomId;
    core.currentExplorerRoomId = active.roomId;
    core.currentExplorerTraits = { ...active.traits };
    core.currentExplorerInventory = active.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = active.inventory.map((card) => card.id);
    return core;
};

const createMonsterMovementGroupsCore = (): MonsterMovementGroupsFixture => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    if (!traitorId) {
        throw new Error('山屋多类型怪物移动骰 E2E 夹具缺少叛徒玩家');
    }
    core = activateExplorer(core, traitorId);
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: MONSTER_ROOM_ID,
    };
    core.otherExplorers = core.otherExplorers.map((explorer) => ({
        ...explorer,
        roomId: MONSTER_ROOM_ID,
    }));
    core.activeRoomId = MONSTER_ROOM_ID;
    core.currentExplorerRoomId = MONSTER_ROOM_ID;
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
    core.pendingDamageAllocation = null;
    core.recommendedAction = 'use';
    core.recentRoll = null;
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.monsters = [
        {
            id: SLOW_MONSTER_ID,
            name: '慢速怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId: MONSTER_ROOM_ID,
            might: 4,
            speed: 1,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        },
        {
            id: FAST_MONSTER_ID,
            name: '快速怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId: MONSTER_ROOM_ID,
            might: 4,
            speed: 2,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        },
    ];
    core.scenarioRuntime.monsterTurn = {
        ...core.scenarioRuntime.monsterTurn,
        resolvedStartMonsterIds: [SLOW_MONSTER_ID, FAST_MONSTER_ID],
        movementRollsByGroupId: {},
        moveRemainingById: {},
    };

    const groupIds = resolveBetrayalMonsterMovementGroups(core).map((group) => group.groupId);
    expect(groupIds).toEqual([SLOW_GROUP_ID, FAST_GROUP_ID]);
    const slowTarget = resolveBetrayalMonsterMoveTargetRooms(core, SLOW_MONSTER_ID)[0];
    const fastTarget = resolveBetrayalMonsterMoveTargetRooms(core, FAST_MONSTER_ID)[0];
    if (!slowTarget || !fastTarget) {
        throw new Error('山屋多类型怪物移动骰 E2E 夹具缺少相邻目标房间');
    }
    return {
        core,
        slowTargetRoomId: slowTarget.id,
        fastTargetRoomId: fastTarget.id,
    };
};

const readMonsterMovementGroupsState = async (page: Page): Promise<MonsterMovementGroupsState> =>
    page.evaluate(({ monsterIds, groupIds }) => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            monsters?: Array<{ id: string; roomId: string | null }>;
                            recentRoll?: { sourceTitle?: string | null } | null;
                            scenarioRuntime?: {
                                monsterTurn?: {
                                    movementRollsByGroupId?: Record<string, { monsterIds?: string[] }>;
                                    moveRemainingById?: Record<string, number>;
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const movementRolls = core?.scenarioRuntime?.monsterTurn?.movementRollsByGroupId ?? {};
        const rolledMovementGroups = Object.keys(movementRolls);
        const rooms = Object.fromEntries(
            (core?.monsters ?? [])
                .filter((monster) => monsterIds.includes(monster.id))
                .map((monster) => [monster.id, monster.roomId]),
        );
        return {
            currentPlayer: core?.currentPlayer,
            enabledMovementGroups: groupIds.filter((groupId) => !rolledMovementGroups.includes(groupId)),
            rolledMovementGroups,
            monsterRooms: rooms,
            moveRemainingById: core?.scenarioRuntime?.monsterTurn?.moveRemainingById ?? {},
            recentRollTitle: core?.recentRoll?.sourceTitle ?? null,
        };
    }, { monsterIds: [SLOW_MONSTER_ID, FAST_MONSTER_ID], groupIds: [SLOW_GROUP_ID, FAST_GROUP_ID] });

const closeRecentRollPanel = async (page: Page) => {
    const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
    await expect(rollPanel).toBeVisible();
    await page.getByTestId('betrayal-roll-continue').click();
    await expect(rollPanel).toHaveCount(0);
};

test.describe('山屋惊魂多类型怪物移动骰组真实入口', () => {
    test('不同名称或速度的怪物会连续开放各自移动骰，并在全部掷完后进入真实 token 移动', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-normal-monster-movement-groups');
        const fixture = createMonsterMovementGroupsCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMonsterMovementGroupsState(page)).toMatchObject({
            currentPlayer: '2',
            enabledMovementGroups: [SLOW_GROUP_ID, FAST_GROUP_ID],
            rolledMovementGroups: [],
            monsterRooms: {
                [SLOW_MONSTER_ID]: MONSTER_ROOM_ID,
                [FAST_MONSTER_ID]: MONSTER_ROOM_ID,
            },
        });

        const movementRollAction = page.getByTestId('betrayal-action-monsterMovementRoll');
        await expect(movementRollAction).toBeVisible();
        await expect(movementRollAction).toContainText('慢速怪物移动骰');
        await expect(page.getByTestId('betrayal-action-monsterMove')).toHaveCount(0);
        await saveScreenshot(page, FIRST_ROLL_READY_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99]);
        await movementRollAction.click();
        const firstRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(firstRollPanel).toContainText('慢速怪物移动');
        await saveScreenshot(page, FIRST_ROLL_PANEL_SCREENSHOT);
        await expect.poll(() => readMonsterMovementGroupsState(page)).toMatchObject({
            rolledMovementGroups: [SLOW_GROUP_ID],
            moveRemainingById: {
                [SLOW_MONSTER_ID]: 2,
            },
            recentRollTitle: '慢速怪物移动',
        });
        await closeRecentRollPanel(page);

        await expect(movementRollAction).toBeVisible();
        await expect(movementRollAction).toContainText('快速怪物移动骰');
        await saveScreenshot(page, SECOND_ROLL_READY_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99]);
        await movementRollAction.click();
        const secondRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(secondRollPanel).toContainText('快速怪物移动');
        await expect.poll(() => readMonsterMovementGroupsState(page)).toMatchObject({
            rolledMovementGroups: [SLOW_GROUP_ID, FAST_GROUP_ID],
            moveRemainingById: {
                [SLOW_MONSTER_ID]: 2,
                [FAST_MONSTER_ID]: 4,
            },
            recentRollTitle: '快速怪物移动',
        });
        await closeRecentRollPanel(page);

        await expect(movementRollAction).toHaveCount(0);
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        const slowMonsterToken = page.getByTestId(`betrayal-room-monster-${MONSTER_ROOM_ID}-${SLOW_MONSTER_ID}`);
        const fastMonsterToken = page.getByTestId(`betrayal-room-monster-${MONSTER_ROOM_ID}-${FAST_MONSTER_ID}`);
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动慢速怪物');
        await expect(slowMonsterToken).toBeVisible();
        await expect(fastMonsterToken).toBeVisible();
        await saveScreenshot(page, BOTH_GROUPS_READY_SCREENSHOT);

        await monsterMoveAction.click();
        await expect(slowMonsterToken).toHaveAttribute('data-direct-target', 'true');
        await expect(fastMonsterToken).toHaveAttribute('data-direct-target', 'true');
        await slowMonsterToken.click();
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.slowTargetRoomId}`)).toBeVisible();
        await saveScreenshot(page, SLOW_TARGET_SCREENSHOT);

        await fastMonsterToken.click();
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.fastTargetRoomId}`)).toBeVisible();
        await saveScreenshot(page, FAST_TARGET_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-normal-monster-movement-groups', diagnostics }]);
    });
});
