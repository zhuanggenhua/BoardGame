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
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-杰克之灵怪物动作槽攻击完整链路';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-杰克之灵攻击前牌桌可操作.jpg`;
const TARGET_SCREENSHOT = `${EVIDENCE_DIR}/02-杰克之灵与同房英雄目标高亮.jpg`;
const DICE_SCREENSHOT = `${EVIDENCE_DIR}/03-杰克之灵攻击骰盘.jpg`;
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';

const completeMonsterPreparationForAttackSlot = (
    core: BetrayalCore,
    monsterId: string,
): BetrayalCore => {
    const movementGroup = resolveBetrayalMonsterMovementGroups(core)
        .find((group) => group.monsterIds.includes(monsterId));
    if (!movementGroup) {
        throw new Error(`山屋 E2E 夹具找不到 ${monsterId} 的怪物移动骰组`);
    }
    const movementResult: BetrayalMonsterMovementRollGroupResult = {
        groupId: movementGroup.groupId,
        monsterName: movementGroup.monsterName,
        monsterIds: [...movementGroup.monsterIds],
        playerId: core.currentExplorer.playerId,
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
    core.recentRoll = null;
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.usedCardIdsThisTurn = core.usedCardIdsThisTurn.filter((id) => id !== 'haunt-attack');
    return core;
};

type JackSpiritAttackState = {
    currentPlayer?: string;
    traitorPlayerId?: string | null;
    jackSpiritRoomId?: string | null;
    heroTargetPlayerId?: string | null;
    recentRollKind?: string;
};

const readJackSpiritAttackState = async (page: Page): Promise<JackSpiritAttackState> =>
    page.evaluate(() => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            currentExplorer?: { playerId: string; roomId: string };
                            otherExplorers?: Array<{ playerId: string; roomId: string }>;
                            scenarioRuntime?: {
                                traitorPlayerId?: string | null;
                                jackSpiritRoomId?: string | null;
                                deadExplorerPlayerIds?: string[];
                            };
                            recentRoll?: { kind?: string };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const jackSpiritRoomId = core?.scenarioRuntime?.jackSpiritRoomId ?? null;
        const traitorPlayerId = core?.scenarioRuntime?.traitorPlayerId ?? null;
        const deadPlayerIds = core?.scenarioRuntime?.deadExplorerPlayerIds ?? [];
        const heroTarget = [core?.currentExplorer, ...(core?.otherExplorers ?? [])].find((explorer) => (
            explorer
            && explorer.playerId !== traitorPlayerId
            && !deadPlayerIds.includes(explorer.playerId)
            && explorer.roomId === jackSpiritRoomId
        ));
        return {
            currentPlayer: core?.currentPlayer,
            traitorPlayerId,
            jackSpiritRoomId,
            heroTargetPlayerId: heroTarget?.playerId ?? null,
            recentRollKind: core?.recentRoll?.kind,
        };
    });

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

test.describe('山屋惊魂第一剧本杰克之灵怪物动作槽攻击', () => {
    test('杰克之灵从怪物动作槽进入攻击态后，可点地图英雄 token 结算攻击', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-jack-spirit-monster-attack');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, completeMonsterPreparationForAttackSlot(
            createJackSpiritMovementRollReadyRuntimeCore(),
            'jack-spirit',
        ));
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        const initialState = await readJackSpiritAttackState(page);
        expect(initialState).toMatchObject({
            currentPlayer: '2',
            traitorPlayerId: '2',
            jackSpiritRoomId: 'basement-east',
            heroTargetPlayerId: '0',
        });

        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        await expect(monsterAttackAction).toBeVisible();
        await expect(monsterAttackAction).toContainText('杰克之灵攻击');
        await ensureBasementFloorVisible(page);
        const jackSpiritToken = page.getByTestId('betrayal-room-monster-basement-east-jack-spirit');
        const heroTargetToken = page.getByTestId('betrayal-room-occupant-basement-east-0');
        await expect(jackSpiritToken).toBeVisible();
        await expect(heroTargetToken).toBeVisible();
        await expect(heroTargetToken).not.toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-basement-east-0')).toHaveCount(0);
        await saveScreenshot(page, READY_SCREENSHOT);

        await monsterAttackAction.click();
        await expect(monsterAttackAction).toContainText('取消攻击');
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('杰克之灵');
        await expect(jackSpiritToken).toHaveAttribute('data-direct-target', 'true');
        await jackSpiritToken.click();
        await expect(heroTargetToken).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-basement-east-0')).toHaveAttribute('data-highlight-shape', 'pentagon');
        await expect(page.getByTestId('betrayal-bottom-teammate-0')).toContainText('攻击');
        await saveScreenshot(page, TARGET_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01]);
        await heroTargetToken.click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('杰克之灵');
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('攻击投骰');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await saveScreenshot(page, DICE_SCREENSHOT);
        expect((await readJackSpiritAttackState(page)).recentRollKind).toBe('attackRoll');

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-jack-spirit-monster-attack', diagnostics }]);
    });
});
