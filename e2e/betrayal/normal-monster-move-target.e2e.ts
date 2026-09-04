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
    expectBetrayalTransitionTargetsLocator,
    initBetrayalContext,
    injectCore,
    readLocatorClientRect,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-普通怪物路径预览完整链路';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-普通怪物移动前牌桌可操作.jpg`;
const TARGET_SCREENSHOT = `${EVIDENCE_DIR}/02-普通怪物路径目标高亮.jpg`;
const MOVED_SCREENSHOT = `${EVIDENCE_DIR}/03-普通怪物移动后反馈.jpg`;
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';
const NORMAL_MONSTER_ID = 'test-normal-monster';
const NORMAL_MONSTER_ROOM_ID = 'entrance-hall';

type NormalMonsterMoveFixture = {
    core: BetrayalCore;
    targetRoomId: string;
    targetRoomName: string;
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
        throw new Error(`山屋普通怪物移动 E2E 夹具缺少玩家 ${playerId}`);
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

const prepareMonsterMoveSlot = (
    core: BetrayalCore,
    monsterId: string,
    moveAllowance = 2,
): BetrayalCore => {
    const movementGroup = resolveBetrayalMonsterMovementGroups(core)
        .find((group) => group.monsterIds.includes(monsterId));
    if (!movementGroup) {
        throw new Error(`山屋普通怪物移动 E2E 夹具找不到 ${monsterId} 的怪物移动骰组`);
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
    return core;
};

const createNormalMonsterMoveReadyCore = (): NormalMonsterMoveFixture => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    if (!traitorId) {
        throw new Error('山屋普通怪物移动 E2E 夹具缺少叛徒玩家');
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
    core.monsters = [{
        id: NORMAL_MONSTER_ID,
        name: '测试怪物',
        portraitAsset: 'betrayal/monsters/spirit',
        tokenAsset: 'betrayal/tokens/monsters/ghost',
        roomId: NORMAL_MONSTER_ROOM_ID,
        might: 4,
        speed: 3,
        sanity: 4,
        knowledge: 4,
        damage: 1,
    }];
    core = prepareMonsterMoveSlot(core, NORMAL_MONSTER_ID);
    const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, NORMAL_MONSTER_ID)[0];
    if (!targetRoom) {
        throw new Error('山屋普通怪物移动 E2E 夹具缺少相邻目标房间');
    }
    return {
        core,
        targetRoomId: targetRoom.id,
        targetRoomName: targetRoom.name,
    };
};

type NormalMonsterMoveState = {
    currentPlayer?: string;
    monsterRoomId?: string | null;
    moveRemaining?: number | null;
};

const readNormalMonsterMoveState = async (page: Page): Promise<NormalMonsterMoveState> =>
    page.evaluate(({ monsterId }) => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            monsters?: Array<{ id: string; roomId: string | null }>;
                            scenarioRuntime?: {
                                monsterTurn?: { moveRemainingById?: Record<string, number> };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const monster = core?.monsters?.find((candidate) => candidate.id === monsterId);
        return {
            currentPlayer: core?.currentPlayer,
            monsterRoomId: monster?.roomId ?? null,
            moveRemaining: core?.scenarioRuntime?.monsterTurn?.moveRemainingById?.[monsterId] ?? null,
        };
    }, { monsterId: NORMAL_MONSTER_ID });

test.describe('山屋惊魂普通怪物路径预览真实入口', () => {
    test('普通怪物从移动槽进入移动态后，会高亮真实相邻房间并扣减移动', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-normal-monster-move-target');
        const fixture = createNormalMonsterMoveReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readNormalMonsterMoveState(page)).toMatchObject({
            currentPlayer: '2',
            monsterRoomId: NORMAL_MONSTER_ROOM_ID,
            moveRemaining: 2,
        });

        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动测试怪物');
        const monsterToken = page.getByTestId(`betrayal-room-monster-${NORMAL_MONSTER_ROOM_ID}-${NORMAL_MONSTER_ID}`);
        const targetRoom = page.getByTestId(`betrayal-room-${fixture.targetRoomId}`);
        await expect(monsterToken).toBeVisible();
        await expect(targetRoom).toBeVisible();
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.targetRoomId}`)).toHaveCount(0);
        await saveScreenshot(page, READY_SCREENSHOT);

        await monsterMoveAction.click();
        await expect(monsterMoveAction).toContainText('取消移动');
        await expect(monsterToken).toHaveAttribute('data-direct-target', 'true');
        await monsterToken.click();
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.targetRoomId}`)).toBeVisible();
        const monsterMoveSourceToken = page.getByTestId(`betrayal-monster-board-token-${NORMAL_MONSTER_ID}`);
        await expect(monsterMoveSourceToken).toBeVisible();
        const monsterMoveSourceRect = await readLocatorClientRect(monsterMoveSourceToken);
        await saveScreenshot(page, TARGET_SCREENSHOT);

        await targetRoom.click();
        const transitionBlocker = page.getByTestId('betrayal-visual-transition-blocker');
        await expect(transitionBlocker).toBeVisible();
        await expect(transitionBlocker).toHaveAttribute('data-transition-kind', 'monster-move');
        await expect(transitionBlocker).toHaveAttribute(
            'data-transition-target-testid',
            `betrayal-room-monster-${fixture.targetRoomId}-${NORMAL_MONSTER_ID}`,
        );
        const targetMonsterToken = page.getByTestId(`betrayal-room-monster-${fixture.targetRoomId}-${NORMAL_MONSTER_ID}`);
        await expect(targetMonsterToken).toHaveCount(1);
        await expect(targetMonsterToken).toHaveAttribute('data-visual-transition-anchor-hidden', 'true');
        await expectBetrayalTransitionTargetsLocator(
            page.locator('[data-testid^="betrayal-visual-transition-transition-"]'),
            targetMonsterToken,
            '山屋惊魂普通怪物移动动画',
            { sourceRect: monsterMoveSourceRect },
        );
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(
            new RegExp(`测试怪物.*移动到${fixture.targetRoomName}`),
        );
        await expect.poll(() => readNormalMonsterMoveState(page)).toMatchObject({
            currentPlayer: '2',
            monsterRoomId: fixture.targetRoomId,
            moveRemaining: 0,
        });
        await expect(transitionBlocker).toHaveCount(0);
        await saveScreenshot(page, MOVED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-normal-monster-move-target', diagnostics }]);
    });
});
