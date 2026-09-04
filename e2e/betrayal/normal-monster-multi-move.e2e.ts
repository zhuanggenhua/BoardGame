import { expect, test, type Page } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterMovementGroups,
    type BetrayalMonsterMovementRollGroupResult,
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
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-多怪物同组移动完整链路';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-同组多怪物移动前牌桌可操作.jpg`;
const FIRST_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/02-第一只怪物目标房间高亮.jpg`;
const SECOND_READY_SCREENSHOT = `${EVIDENCE_DIR}/03-第一只移动后第二只仍可移动.jpg`;
const SECOND_MOVED_SCREENSHOT = `${EVIDENCE_DIR}/04-第二只移动后同组额度各自结算.jpg`;
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';
const NORMAL_MONSTER_A_ID = 'test-normal-monster-a';
const NORMAL_MONSTER_B_ID = 'test-normal-monster-b';
const NORMAL_MONSTER_ROOM_ID = 'entrance-hall';

type NormalMonsterMultiMoveFixture = {
    core: BetrayalCore;
    targetRoomId: string;
    targetRoomName: string;
    movementGroupId: string;
};

type NormalMonsterMultiMoveState = {
    currentPlayer?: string;
    movementGroupIds?: string[];
    monsterRooms?: Record<string, string | null>;
    moveRemainingById?: Record<string, number>;
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
        throw new Error(`山屋多怪物移动 E2E 夹具缺少玩家 ${playerId}`);
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

const prepareSharedMonsterMoveSlot = (
    core: BetrayalCore,
    monsterIds: string[],
    moveAllowance = 2,
): { core: BetrayalCore; movementGroupId: string } => {
    const movementGroup = resolveBetrayalMonsterMovementGroups(core)
        .find((group) => monsterIds.every((monsterId) => group.monsterIds.includes(monsterId)));
    if (!movementGroup) {
        throw new Error(`山屋多怪物移动 E2E 夹具找不到同组怪物移动骰组：${monsterIds.join(',')}`);
    }
    const dice = Array.from({ length: movementGroup.diceCount }, (_, index) => (index < moveAllowance ? 1 : 0));
    const movementResult: BetrayalMonsterMovementRollGroupResult = {
        groupId: movementGroup.groupId,
        monsterName: movementGroup.monsterName,
        monsterIds: [...movementGroup.monsterIds],
        playerId: core.currentExplorer.playerId,
        speed: movementGroup.speed,
        diceCount: movementGroup.diceCount,
        dice,
        total: moveAllowance,
        moveAllowance,
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
            ...Object.fromEntries(movementGroup.monsterIds.map((id) => [id, moveAllowance])),
        },
    };
    core.movesRemaining = moveAllowance;
    core.recentRoll = null;
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    return { core, movementGroupId: movementGroup.groupId };
};

const createNormalMonsterMultiMoveReadyCore = (): NormalMonsterMultiMoveFixture => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    if (!traitorId) {
        throw new Error('山屋多怪物移动 E2E 夹具缺少叛徒玩家');
    }
    core = activateExplorer(core, traitorId);
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: NORMAL_MONSTER_ROOM_ID,
    };
    core.otherExplorers = core.otherExplorers.map((explorer) => ({
        ...explorer,
        roomId: NORMAL_MONSTER_ROOM_ID,
    }));
    core.activeRoomId = NORMAL_MONSTER_ROOM_ID;
    core.currentExplorerRoomId = NORMAL_MONSTER_ROOM_ID;
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
    core.pendingDamageAllocation = null;
    core.recommendedAction = 'use';
    core.monsters = [NORMAL_MONSTER_A_ID, NORMAL_MONSTER_B_ID].map((id) => ({
        id,
        name: '测试怪物',
        portraitAsset: 'betrayal/monsters/spirit',
        tokenAsset: 'betrayal/tokens/monsters/ghost',
        roomId: NORMAL_MONSTER_ROOM_ID,
        might: 4,
        speed: 3,
        sanity: 4,
        knowledge: 4,
        damage: 1,
    }));
    const prepared = prepareSharedMonsterMoveSlot(core, [NORMAL_MONSTER_A_ID, NORMAL_MONSTER_B_ID]);
    core = prepared.core;
    const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, NORMAL_MONSTER_A_ID)[0];
    if (!targetRoom) {
        throw new Error('山屋多怪物移动 E2E 夹具缺少相邻目标房间');
    }
    return {
        core,
        targetRoomId: targetRoom.id,
        targetRoomName: targetRoom.name,
        movementGroupId: prepared.movementGroupId,
    };
};

const readNormalMonsterMultiMoveState = async (page: Page): Promise<NormalMonsterMultiMoveState> =>
    page.evaluate(({ monsterIds }) => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            monsters?: Array<{ id: string; roomId: string | null }>;
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
        const rooms = Object.fromEntries(
            (core?.monsters ?? [])
                .filter((monster) => monsterIds.includes(monster.id))
                .map((monster) => [monster.id, monster.roomId]),
        );
        return {
            currentPlayer: core?.currentPlayer,
            movementGroupIds: Object.entries(core?.scenarioRuntime?.monsterTurn?.movementRollsByGroupId ?? {})
                .filter(([, result]) => monsterIds.every((monsterId) => result.monsterIds?.includes(monsterId)))
                .map(([groupId]) => groupId),
            monsterRooms: rooms,
            moveRemainingById: core?.scenarioRuntime?.monsterTurn?.moveRemainingById ?? {},
        };
    }, { monsterIds: [NORMAL_MONSTER_A_ID, NORMAL_MONSTER_B_ID] });

test.describe('山屋惊魂多怪物同组移动真实入口', () => {
    test('同类型怪物共用一次移动骰后，可逐只点怪物 token 移动并各自扣额度', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-normal-monster-multi-move');
        const fixture = createNormalMonsterMultiMoveReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readNormalMonsterMultiMoveState(page)).toMatchObject({
            currentPlayer: '2',
            movementGroupIds: [fixture.movementGroupId],
            monsterRooms: {
                [NORMAL_MONSTER_A_ID]: NORMAL_MONSTER_ROOM_ID,
                [NORMAL_MONSTER_B_ID]: NORMAL_MONSTER_ROOM_ID,
            },
            moveRemainingById: {
                [NORMAL_MONSTER_A_ID]: 2,
                [NORMAL_MONSTER_B_ID]: 2,
            },
        });

        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        const firstMonsterToken = page.getByTestId(`betrayal-room-monster-${NORMAL_MONSTER_ROOM_ID}-${NORMAL_MONSTER_A_ID}`);
        const secondMonsterToken = page.getByTestId(`betrayal-room-monster-${NORMAL_MONSTER_ROOM_ID}-${NORMAL_MONSTER_B_ID}`);
        const targetRoom = page.getByTestId(`betrayal-room-${fixture.targetRoomId}`);
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动测试怪物');
        await expect(firstMonsterToken).toBeVisible();
        await expect(secondMonsterToken).toBeVisible();
        await expect(targetRoom).toBeVisible();
        await saveScreenshot(page, READY_SCREENSHOT);

        await monsterMoveAction.click();
        await expect(monsterMoveAction).toContainText('取消移动');
        await expect(firstMonsterToken).toHaveAttribute('data-direct-target', 'true');
        await expect(secondMonsterToken).toHaveAttribute('data-direct-target', 'true');
        await firstMonsterToken.click();
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.targetRoomId}`)).toBeVisible();
        await saveScreenshot(page, FIRST_TARGET_SCREENSHOT);

        await targetRoom.click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(
            new RegExp(`测试怪物.*移动到${fixture.targetRoomName}`),
        );
        await expect.poll(() => readNormalMonsterMultiMoveState(page)).toMatchObject({
            monsterRooms: {
                [NORMAL_MONSTER_A_ID]: fixture.targetRoomId,
                [NORMAL_MONSTER_B_ID]: NORMAL_MONSTER_ROOM_ID,
            },
            moveRemainingById: {
                [NORMAL_MONSTER_A_ID]: 0,
                [NORMAL_MONSTER_B_ID]: 2,
            },
        });
        await expect(monsterMoveAction).toBeVisible();
        await monsterMoveAction.click();
        const firstMovedToken = page.getByTestId(`betrayal-room-monster-${fixture.targetRoomId}-${NORMAL_MONSTER_A_ID}`);
        await expect(firstMovedToken).not.toHaveAttribute('data-direct-target', 'true');
        await expect(secondMonsterToken).toHaveAttribute('data-direct-target', 'true');
        await secondMonsterToken.click();
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.targetRoomId}`)).toBeVisible();
        await saveScreenshot(page, SECOND_READY_SCREENSHOT);

        await targetRoom.click();
        await expect.poll(() => readNormalMonsterMultiMoveState(page)).toMatchObject({
            monsterRooms: {
                [NORMAL_MONSTER_A_ID]: fixture.targetRoomId,
                [NORMAL_MONSTER_B_ID]: fixture.targetRoomId,
            },
            moveRemainingById: {
                [NORMAL_MONSTER_A_ID]: 0,
                [NORMAL_MONSTER_B_ID]: 0,
            },
        });
        await expect(monsterMoveAction).toHaveCount(0);
        await saveScreenshot(page, SECOND_MOVED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-normal-monster-multi-move', diagnostics }]);
    });
});
