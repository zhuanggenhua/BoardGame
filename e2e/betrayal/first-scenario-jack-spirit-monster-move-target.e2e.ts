import { expect, test, type Page } from '@playwright/test';
import {
    resolveBetrayalMonsterMovementGroups,
    type BetrayalCore,
    type BetrayalMonsterMovementRollGroupResult,
} from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createJackSpiritMovementRollReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
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

const ensureBasementFloorVisible = async (page: Page): Promise<void> => {
    const basementFloor = page.getByTestId('betrayal-room-floor-basement');
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await basementFloor.isVisible().catch(() => false)) {
            return;
        }
        const floorDown = page.getByTestId('betrayal-room-floor-down');
        await expect(floorDown).toBeVisible();
        await expect(floorDown).toBeEnabled();
        await floorDown.click();
    }
    await expect(basementFloor).toBeVisible();
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
        return {
            currentPlayer: core?.currentPlayer,
            jackSpiritRoomId: core?.scenarioRuntime?.jackSpiritRoomId ?? null,
            jackSpiritMoveRemaining: core?.scenarioRuntime?.monsterTurn?.moveRemainingById?.['jack-spirit'] ?? null,
        };
    });

test.describe('山屋惊魂第一剧本杰克之灵怪物路径预览', () => {
    test('杰克之灵从怪物移动槽进入移动态后，会高亮真实相邻房间并扣减移动', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-jack-spirit-monster-move-target');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, prepareJackSpiritMoveSlot(createJackSpiritMovementRollReadyRuntimeCore()));
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readJackSpiritMoveState(page)).toMatchObject({
            currentPlayer: '2',
            jackSpiritRoomId: 'basement-east',
            jackSpiritMoveRemaining: 2,
        });

        await ensureBasementFloorVisible(page);
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动杰克之灵');
        const jackSpiritToken = page.getByTestId('betrayal-room-monster-basement-east-jack-spirit');
        const basementLandingRoom = page.getByTestId('betrayal-room-basement-landing');
        await expect(jackSpiritToken).toBeVisible();
        await expect(basementLandingRoom).toBeVisible();
        await expect(page.getByTestId('betrayal-room-monster-move-target-basement-landing')).toHaveCount(0);
        await saveScreenshot(page, READY_SCREENSHOT);

        await monsterMoveAction.click();
        await expect(monsterMoveAction).toContainText('取消移动');
        await expect(jackSpiritToken).toHaveAttribute('data-direct-target', 'true');
        await jackSpiritToken.click();
        await expect(page.getByTestId('betrayal-room-monster-move-target-basement-landing')).toBeVisible();
        await saveScreenshot(page, TARGET_SCREENSHOT);

        await basementLandingRoom.click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/杰克之灵.*移动到地下室起始点/);
        await expect.poll(() => readJackSpiritMoveState(page)).toMatchObject({
            currentPlayer: '2',
            jackSpiritRoomId: 'basement-landing',
            jackSpiritMoveRemaining: 0,
        });
        await saveScreenshot(page, MOVED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-jack-spirit-monster-move-target', diagnostics }]);
    });
});
