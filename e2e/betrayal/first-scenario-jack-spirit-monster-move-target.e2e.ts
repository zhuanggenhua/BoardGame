import { expect, test, type Page } from '@playwright/test';
import {
    type BetrayalCore,
} from '../../src/games/betrayal/game';
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
    createJackSpiritMovementRollReadyRuntimeCore,
    expectBetrayalTransitionTargetsLocator,
    initBetrayalContext,
    injectCore,
    readLocatorClientRect,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-杰克之灵怪物路径预览完整链路';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-杰克之灵移动前牌桌可操作.jpg`;
const TARGET_SCREENSHOT = `${EVIDENCE_DIR}/02-杰克之灵路径目标高亮.jpg`;
const MOVED_SCREENSHOT = `${EVIDENCE_DIR}/03-杰克之灵移动后反馈.jpg`;
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';

const prepareJackSpiritMoveSlot = (
    core: BetrayalCore,
    moveAllowance = 2,
): BetrayalCore => {
    const monsterId = 'jack-spirit';
    const movementGroup = resolveBetrayalMonsterMovementGroups(core)
        .find((group) => group.monsterIds.includes(monsterId));
    if (!movementGroup) {
        throw new Error('山屋 E2E 夹具找不到杰克之灵移动骰组');
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

const readJackSpiritMoveState = async (page: Page): Promise<{
    currentPlayer?: string;
    jackSpiritRoomId?: string | null;
    jackSpiritMoveRemaining?: number | null;
}> =>
    page.evaluate(() => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            movesRemaining?: number;
                            scenarioRuntime?: {
                                jackSpiritRoomId?: string | null;
                                monsterTurn?: {
                                    moveRemainingById?: Record<string, number>;
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const jackSpiritMoveRemaining =
            core?.scenarioRuntime?.monsterTurn?.moveRemainingById?.['jack-spirit'] ??
            core?.movesRemaining ??
            null;
        return {
            currentPlayer: core?.currentPlayer,
            jackSpiritRoomId: core?.scenarioRuntime?.jackSpiritRoomId ?? null,
            jackSpiritMoveRemaining,
        };
    });

const ensureFloorVisible = async (page: Page, floor: string): Promise<void> => {
    const targetFloor = page.getByTestId(`betrayal-room-floor-${floor}`);
    for (let attempt = 0; attempt < 4; attempt += 1) {
        if (await targetFloor.isVisible().catch(() => false)) {
            return;
        }
        const nextFloor = page.getByTestId('betrayal-room-floor-up');
        const previousFloor = page.getByTestId('betrayal-room-floor-down');
        if (await nextFloor.isEnabled().catch(() => false)) {
            await nextFloor.click();
        } else if (await previousFloor.isEnabled().catch(() => false)) {
            await previousFloor.click();
        } else {
            break;
        }
    }
    await expect(targetFloor).toBeVisible();
};

test.describe('山屋惊魂第一剧本杰克之灵怪物路径预览', () => {
    test('杰克之灵从移动入口进入移动态后，会高亮真实相邻房间并扣减移动', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-jack-spirit-monster-move-target');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const preparedCore = prepareJackSpiritMoveSlot(createJackSpiritMovementRollReadyRuntimeCore());
        const initialJackSpiritRoomId = preparedCore.scenarioRuntime.jackSpiritRoomId;
        if (!initialJackSpiritRoomId) {
            throw new Error('山屋 E2E 夹具缺少杰克之灵起始房间');
        }
        const initialJackSpiritMonsterRoomId = preparedCore.monsters.find(
            (monster) => monster.id === 'jack-spirit',
        )?.roomId;
        if (!initialJackSpiritMonsterRoomId) {
            throw new Error('山屋 E2E 夹具缺少杰克之灵实体房间');
        }
        const initialJackSpiritFloor = preparedCore.rooms.find(
            (room) => room.id === initialJackSpiritMonsterRoomId,
        )?.floor;
        if (!initialJackSpiritFloor) {
            throw new Error('山屋 E2E 夹具缺少杰克之灵所在楼层');
        }
        const target = resolveBetrayalMonsterMoveTargetRooms(preparedCore, 'jack-spirit')[0];
        if (!target) {
            throw new Error('山屋 E2E 夹具缺少杰克之灵移动目标房间');
        }
        const targetRoomId = target.id;
        await injectCore(page, preparedCore);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readJackSpiritMoveState(page)).toMatchObject({
            currentPlayer: '2',
            jackSpiritRoomId: initialJackSpiritRoomId,
            jackSpiritMoveRemaining: 2,
        });

        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动杰克之灵');
        await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
        await ensureFloorVisible(page, initialJackSpiritFloor);
        const jackSpiritToken = page.getByTestId(`betrayal-room-monster-${initialJackSpiritMonsterRoomId}-jack-spirit`);
        await expect(jackSpiritToken).toBeVisible();
        const initialRoom = page.getByTestId(`betrayal-room-${initialJackSpiritMonsterRoomId}`);
        await expect(initialRoom).toBeVisible();
        await expect(page.locator('[data-testid^="betrayal-room-monster-move-target-"]')).toHaveCount(0);
        await saveScreenshot(page, READY_SCREENSHOT);

        await monsterMoveAction.click();
        await expect(monsterMoveAction).toContainText('取消移动');
        await ensureFloorVisible(page, initialJackSpiritFloor);
        await expect(jackSpiritToken).toHaveAttribute('data-direct-target', 'true');
        await jackSpiritToken.click();
        await ensureFloorVisible(page, target.floor);
        const targetRoom = page.getByTestId(`betrayal-room-${targetRoomId}`);
        await expect(targetRoom).toBeVisible();
        await expect(targetRoom).toBeEnabled();
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${targetRoomId}`)).toBeVisible();
        const jackSpiritMoveSourceToken = page.getByTestId('betrayal-monster-board-token-jack-spirit');
        await expect(jackSpiritMoveSourceToken).toBeVisible();
        const jackSpiritSourceRect = await readLocatorClientRect(jackSpiritMoveSourceToken);
        await saveScreenshot(page, TARGET_SCREENSHOT);

        await targetRoom.click();
        const transitionBlocker = page.getByTestId('betrayal-visual-transition-blocker');
        await expect(transitionBlocker).toBeVisible();
        await expect(transitionBlocker).toHaveAttribute('data-transition-kind', 'monster-move');
        await expect(transitionBlocker).toHaveAttribute(
            'data-transition-target-testid',
            `betrayal-room-monster-${targetRoomId}-jack-spirit`,
        );
        const jackSpiritTargetToken = page.getByTestId(`betrayal-room-monster-${targetRoomId}-jack-spirit`);
        await expect(jackSpiritTargetToken).toHaveCount(1);
        await expect(jackSpiritTargetToken).toHaveAttribute(
            'data-visual-transition-anchor-hidden',
            'true',
        );
        await expectBetrayalTransitionTargetsLocator(
            page.locator('[data-testid^="betrayal-visual-transition-transition-"]'),
            jackSpiritTargetToken,
            '山屋惊魂杰克之灵移动动画',
            { sourceRect: jackSpiritSourceRect },
        );
        await expect(page.getByTestId('betrayal-board')).toHaveAttribute('data-betrayal-visual-busy', 'true');
        await expect.poll(() => readJackSpiritMoveState(page)).toMatchObject({
            currentPlayer: '2',
            jackSpiritRoomId: targetRoomId,
            jackSpiritMoveRemaining: 1,
        });
        await expect(page.getByTestId(`betrayal-room-monster-${initialJackSpiritMonsterRoomId}-jack-spirit`)).toHaveCount(0);
        await saveScreenshot(page, `${EVIDENCE_DIR}/03a-杰克之灵移动动画中.jpg`);
        await expect(transitionBlocker).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/杰克之灵.*移动到/);
        await expect(page.getByTestId(`betrayal-room-monster-${initialJackSpiritMonsterRoomId}-jack-spirit`)).toHaveCount(0);
        await expect(page.getByTestId(`betrayal-room-monster-${targetRoomId}-jack-spirit`)).toBeVisible();
        await expect.poll(() => readJackSpiritMoveState(page)).toMatchObject({
            currentPlayer: '2',
            jackSpiritRoomId: targetRoomId,
            jackSpiritMoveRemaining: 1,
        });
        await saveScreenshot(page, MOVED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-jack-spirit-monster-move-target', diagnostics }]);
    });
});
