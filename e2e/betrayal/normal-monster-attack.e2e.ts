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
    createFirstScenarioHauntRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-普通怪物攻击完整链路';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-普通怪物攻击前牌桌可操作.jpg`;
const TARGET_SCREENSHOT = `${EVIDENCE_DIR}/02-普通怪物与同房英雄目标高亮.jpg`;
const DICE_SCREENSHOT = `${EVIDENCE_DIR}/03-普通怪物攻击骰盘.jpg`;
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';
const NORMAL_MONSTER_ID = 'test-normal-monster';
const NORMAL_MONSTER_ROOM_ID = 'entrance-hall';

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
        throw new Error(`山屋普通怪物 E2E 夹具缺少玩家 ${playerId}`);
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

const completeMonsterPreparationForAttackSlot = (
    core: BetrayalCore,
    monsterId: string,
): BetrayalCore => {
    const movementGroup = resolveBetrayalMonsterMovementGroups(core)
        .find((group) => group.monsterIds.includes(monsterId));
    if (!movementGroup) {
        throw new Error(`山屋普通怪物 E2E 夹具找不到 ${monsterId} 的怪物移动骰组`);
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

const createNormalMonsterAttackReadyCore = (): BetrayalCore => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    if (!traitorId) {
        throw new Error('山屋普通怪物 E2E 夹具缺少叛徒玩家');
    }
    core = activateExplorer(core, traitorId);
    const heroes = [core.currentExplorer, ...core.otherExplorers]
        .filter((explorer) => explorer.playerId !== traitorId);
    const [heroTarget, deadHero] = heroes;
    if (!heroTarget || !deadHero) {
        throw new Error('山屋普通怪物 E2E 夹具缺少英雄目标');
    }
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
    core.scenarioRuntime.deadExplorerPlayerIds = [deadHero.playerId];
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
    return completeMonsterPreparationForAttackSlot(core, NORMAL_MONSTER_ID);
};

type NormalMonsterAttackState = {
    currentPlayer?: string;
    traitorPlayerId?: string | null;
    heroTargetPlayerId?: string | null;
    deadHeroPlayerId?: string | null;
    monsterRoomId?: string | null;
    recentRollKind?: string | null;
    pendingDamageSourceTitle?: string | null;
    attackedMonsterIdsThisTurn?: string[];
};

const readNormalMonsterAttackState = async (page: Page): Promise<NormalMonsterAttackState> =>
    page.evaluate(({ monsterId }) => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            currentExplorer?: { playerId: string; roomId: string };
                            otherExplorers?: Array<{ playerId: string; roomId: string }>;
                            monsters?: Array<{ id: string; roomId: string | null }>;
                            pendingDamageAllocation?: { sourceTitle?: string } | null;
                            recentRoll?: { kind?: string };
                            scenarioRuntime?: {
                                traitorPlayerId?: string | null;
                                deadExplorerPlayerIds?: string[];
                                monsterTurn?: { attackedMonsterIdsThisTurn?: string[] };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const traitorPlayerId = core?.scenarioRuntime?.traitorPlayerId ?? null;
        const deadPlayerIds = core?.scenarioRuntime?.deadExplorerPlayerIds ?? [];
        const monster = core?.monsters?.find((candidate) => candidate.id === monsterId);
        const heroes = [core?.currentExplorer, ...(core?.otherExplorers ?? [])]
            .filter((explorer): explorer is { playerId: string; roomId: string } => Boolean(explorer)
                && explorer.playerId !== traitorPlayerId);
        const heroTarget = heroes.find((explorer) => !deadPlayerIds.includes(explorer.playerId)
            && explorer.roomId === monster?.roomId);
        const deadHero = heroes.find((explorer) => deadPlayerIds.includes(explorer.playerId));
        return {
            currentPlayer: core?.currentPlayer,
            traitorPlayerId,
            heroTargetPlayerId: heroTarget?.playerId ?? null,
            deadHeroPlayerId: deadHero?.playerId ?? null,
            monsterRoomId: monster?.roomId ?? null,
            recentRollKind: core?.recentRoll?.kind ?? null,
            pendingDamageSourceTitle: core?.pendingDamageAllocation?.sourceTitle ?? null,
            attackedMonsterIdsThisTurn: core?.scenarioRuntime?.monsterTurn?.attackedMonsterIdsThisTurn ?? [],
        };
    }, { monsterId: NORMAL_MONSTER_ID });

test.describe('山屋惊魂普通怪物正式攻击命令真实入口', () => {
    test('普通怪物从动作槽进入攻击态后，可点地图英雄 token 结算攻击', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-normal-monster-attack');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createNormalMonsterAttackReadyCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        const initialState = await readNormalMonsterAttackState(page);
        expect(initialState).toMatchObject({
            currentPlayer: '2',
            traitorPlayerId: '2',
            monsterRoomId: NORMAL_MONSTER_ROOM_ID,
            heroTargetPlayerId: '0',
            deadHeroPlayerId: '1',
        });

        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        await expect(monsterAttackAction).toBeVisible();
        await expect(monsterAttackAction).toContainText('测试怪物攻击');
        const monsterToken = page.getByTestId(`betrayal-room-monster-${NORMAL_MONSTER_ROOM_ID}-${NORMAL_MONSTER_ID}`);
        const heroTargetToken = page.getByTestId(`betrayal-room-occupant-${NORMAL_MONSTER_ROOM_ID}-0`);
        const traitorToken = page.getByTestId(`betrayal-room-occupant-${NORMAL_MONSTER_ROOM_ID}-2`);
        const deadHeroToken = page.getByTestId(`betrayal-room-occupant-${NORMAL_MONSTER_ROOM_ID}-1`);
        await expect(monsterToken).toBeVisible();
        await expect(heroTargetToken).toBeVisible();
        await expect(traitorToken).toBeVisible();
        await expect(deadHeroToken).toBeVisible();
        await expect(heroTargetToken).not.toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${NORMAL_MONSTER_ROOM_ID}-0`)).toHaveCount(0);
        await saveScreenshot(page, READY_SCREENSHOT);

        await monsterAttackAction.click();
        await expect(monsterAttackAction).toContainText('取消攻击');
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('测试怪物');
        await expect(monsterToken).toHaveAttribute('data-direct-target', 'true');
        await monsterToken.click();
        await expect(heroTargetToken).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${NORMAL_MONSTER_ROOM_ID}-0`)).toHaveAttribute('data-highlight-shape', 'pentagon');
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${NORMAL_MONSTER_ROOM_ID}-2`)).toHaveCount(0);
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${NORMAL_MONSTER_ROOM_ID}-1`)).toHaveCount(0);
        await expect(page.getByTestId('betrayal-bottom-teammate-0')).toContainText('攻击');
        await saveScreenshot(page, TARGET_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01]);
        await heroTargetToken.click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('测试怪物');
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('测试怪物攻击');
        await expect(attackRollPanel).toContainText('攻击投骰');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await saveScreenshot(page, DICE_SCREENSHOT);
        const afterAttack = await readNormalMonsterAttackState(page);
        expect(afterAttack.recentRollKind).toBe('attackRoll');
        expect(afterAttack.pendingDamageSourceTitle).toBe('攻击');
        expect(afterAttack.attackedMonsterIdsThisTurn).toContain(NORMAL_MONSTER_ID);

        assertNoFatalFrontendErrors([{ label: 'betrayal-normal-monster-attack', diagnostics }]);
    });
});
