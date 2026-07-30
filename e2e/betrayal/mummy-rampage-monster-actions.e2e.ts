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

const EVIDENCE_DIR = 'evidence/山屋惊魂-木乃伊怪物行动真实入口';
const MOVE_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-木乃伊怪物回合开始前.jpg`;
const MOVE_ROLL_SCREENSHOT = `${EVIDENCE_DIR}/02-木乃伊移动骰0点.jpg`;
const MOVE_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/03-木乃伊瞬移女孩房间目标高亮.jpg`;
const MOVE_DONE_SCREENSHOT = `${EVIDENCE_DIR}/04-木乃伊瞬移后女孩由木乃伊持有.jpg`;
const MOVE_ONE_ROLL_SCREENSHOT = `${EVIDENCE_DIR}/11-木乃伊移动骰1点.jpg`;
const MOVE_ONE_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/12-木乃伊1点瞬移女孩房间目标高亮.jpg`;
const MOVE_ONE_DONE_SCREENSHOT = `${EVIDENCE_DIR}/13-木乃伊1点瞬移后女孩由木乃伊持有.jpg`;
const ATTACK_READY_SCREENSHOT = `${EVIDENCE_DIR}/05-木乃伊同房先攻击前.jpg`;
const ATTACK_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/06-木乃伊同房英雄目标高亮.jpg`;
const ATTACK_REWARD_SCREENSHOT = `${EVIDENCE_DIR}/07-木乃伊攻击奖励入口.jpg`;
const ATTACK_STEAL_SCREENSHOT = `${EVIDENCE_DIR}/08-木乃伊偷走地图后反馈.jpg`;
const ATTACK_DAMAGE_SCREENSHOT = `${EVIDENCE_DIR}/09-木乃伊选择造成伤害后分配页.jpg`;
const ATTACK_DAMAGE_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/10-木乃伊造成伤害分配后回到牌桌.jpg`;
const humanTestUrlForPlayer = (playerId: string) =>
    `/play/betrayal?players=3&playerID=${playerId}&seat0=human&seat1=human&seat2=human`;
const HUMAN_TRAITOR_TEST_URL = humanTestUrlForPlayer('2');
const MUMMY_MONSTER_ID = 'mummy';

type RoomFloor = BetrayalCore['rooms'][number]['floor'];

const cloneExplorer = (explorer: BetrayalCore['currentExplorer']) => ({
    ...explorer,
    traits: { ...explorer.traits },
    traitTracks: Object.fromEntries(
        Object.entries(explorer.traitTracks).map(([trait, track]) => [
            trait,
            { ...track, values: [...track.values] },
        ]),
    ) as BetrayalCore['currentExplorer']['traitTracks'],
    inventory: explorer.inventory.map((card) => ({ ...card })),
});

const activateExplorer = (core: BetrayalCore, playerId: string): BetrayalCore => {
    const explorers = [core.currentExplorer, ...core.otherExplorers].map(cloneExplorer);
    const active = explorers.find((explorer) => explorer.playerId === playerId);
    if (!active) {
        throw new Error(`木乃伊横行 E2E 夹具缺少玩家 ${playerId}`);
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

const dismissBlockingOverlays = (core: BetrayalCore): BetrayalCore => {
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.pendingEventChoice = null;
    core.pendingDamageAllocation = null;
    core.recentRoll = null;
    core.activePlayerId = null;
    return core;
};

const placeExplorer = (
    core: BetrayalCore,
    playerId: string,
    roomId: string,
    inventory?: BetrayalCore['currentExplorer']['inventory'],
): void => {
    if (core.currentExplorer.playerId === playerId) {
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId,
            inventory: inventory?.map((card) => ({ ...card })) ?? core.currentExplorer.inventory,
        };
        core.activeRoomId = roomId;
        core.currentExplorerRoomId = roomId;
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        return;
    }
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === playerId
            ? {
                ...explorer,
                roomId,
                inventory: inventory?.map((card) => ({ ...card })) ?? explorer.inventory,
            }
            : explorer
    ));
};

const setExplorerTraitToMax = (
    core: BetrayalCore,
    playerId: string,
    trait: 'might' | 'speed',
): void => {
    const updateExplorer = (explorer: BetrayalCore['currentExplorer']): BetrayalCore['currentExplorer'] => {
        if (explorer.playerId !== playerId) {
            return explorer;
        }
        const currentValue = explorer.traits[trait];
        const values = Array.from({ length: 25 }, () => currentValue);
        const position = 20;
        return {
            ...explorer,
            traits: {
                ...explorer.traits,
                [trait]: currentValue,
            },
            traitTracks: {
                ...explorer.traitTracks,
                [trait]: {
                    ...explorer.traitTracks[trait],
                    values,
                    position,
                    startPosition: position,
                    criticalPosition: 0,
                    skullPosition: -1,
                    maxPosition: values.length - 1,
                },
            },
        };
    };
    if (core.currentExplorer.playerId === playerId) {
        core.currentExplorer = updateExplorer(core.currentExplorer);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        return;
    }
    core.otherExplorers = core.otherExplorers.map(updateExplorer);
};

const completeMonsterPreparationForAttackSlot = (
    core: BetrayalCore,
    monsterId: string,
): BetrayalCore => {
    const movementGroup = resolveBetrayalMonsterMovementGroups(core)
        .find((group) => group.monsterIds.includes(monsterId));
    if (!movementGroup) {
        throw new Error(`木乃伊横行 E2E 夹具找不到 ${monsterId} 的怪物移动骰组`);
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
    core.usedCardIdsThisTurn = core.usedCardIdsThisTurn.filter((id) => id !== 'haunt-attack');
    return core;
};

const createMummyTeleportReadyCore = () => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const mummyRuntime = core.scenarioRuntime.mummy;
    if (!traitorId || !mummyRuntime?.girlRoomId) {
        throw new Error('木乃伊横行 E2E 夹具缺少叛徒或女孩房间');
    }
    const mummyRoom = core.rooms.find((room) => room.id === mummyRuntime.sarcophagusRoomId);
    const girlRoom = core.rooms.find((room) => room.id === mummyRuntime.girlRoomId);
    if (!mummyRoom || !girlRoom) {
        throw new Error('木乃伊横行 E2E 夹具缺少木乃伊或女孩所在房间');
    }
    const quietRoomId = core.rooms.find((room) => (
        room.state === 'discovered'
        && room.id !== mummyRuntime.sarcophagusRoomId
        && room.id !== mummyRuntime.girlRoomId
    ))?.id ?? 'entrance-hall';
    core = activateExplorer(core, traitorId);
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === traitorId ? explorer : { ...explorer, roomId: quietRoomId }
    ));
    core.monsters = core.monsters.map((monster) => (
        monster.id === mummyRuntime.mummyMonsterId
            ? { ...monster, roomId: mummyRuntime.sarcophagusRoomId }
            : monster
    ));
    core.recommendedAction = 'use';
    return {
        core: dismissBlockingOverlays(core),
        traitorId,
        mummyRoomId: mummyRuntime.sarcophagusRoomId,
        mummyRoomFloor: mummyRoom.floor,
        girlRoomId: mummyRuntime.girlRoomId,
        girlRoomFloor: girlRoom.floor,
        girlRoomName: girlRoom.name,
    };
};

const createMummyAttackReadyCore = () => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const mummyRuntime = core.scenarioRuntime.mummy;
    if (!traitorId || !mummyRuntime) {
        throw new Error('木乃伊横行 E2E 夹具缺少叛徒或木乃伊运行态');
    }
    const mummyRoom = core.rooms.find((room) => room.id === mummyRuntime.sarcophagusRoomId);
    if (!mummyRoom) {
        throw new Error('木乃伊横行 E2E 夹具缺少木乃伊所在房间');
    }
    const heroIds = [core.currentExplorer, ...core.otherExplorers]
        .filter((explorer) => explorer.playerId !== traitorId)
        .map((explorer) => explorer.playerId);
    const [heroTargetId, deadHeroId] = heroIds;
    if (!heroTargetId || !deadHeroId) {
        throw new Error('木乃伊横行 E2E 夹具缺少英雄目标');
    }
    core = activateExplorer(core, traitorId);
    core.monsters = core.monsters.map((monster) => (
        monster.id === mummyRuntime.mummyMonsterId
            ? { ...monster, roomId: mummyRuntime.sarcophagusRoomId }
            : monster
    ));
    placeExplorer(core, traitorId, mummyRuntime.sarcophagusRoomId);
    placeExplorer(core, heroTargetId, mummyRuntime.sarcophagusRoomId, [
        { id: 'map', name: '地图', kind: 'item' },
        { id: 'holy-symbol', name: '圣符', kind: 'omen' },
    ]);
    placeExplorer(core, deadHeroId, 'entrance-hall');
    core.scenarioRuntime.deadExplorerPlayerIds = [deadHeroId];
    core.scenarioRuntime.mummy = {
        ...mummyRuntime,
        girlRoomId: null,
        girlHolderPlayerId: null,
        girlHeldByMummy: false,
    };
    core.recommendedAction = 'use';
    return {
        core: dismissBlockingOverlays(
            completeMonsterPreparationForAttackSlot(core, mummyRuntime.mummyMonsterId),
        ),
        traitorId,
        heroTargetId,
        deadHeroId,
        mummyRoomId: mummyRuntime.sarcophagusRoomId,
        mummyRoomFloor: mummyRoom.floor,
    };
};

const createMummyNonFatalDamageReadyCore = () => {
    const fixture = createMummyAttackReadyCore();
    fixture.core.scenarioRuntime.deadExplorerPlayerIds = [];
    setExplorerTraitToMax(fixture.core, fixture.heroTargetId, 'speed');
    setExplorerTraitToMax(fixture.core, fixture.heroTargetId, 'might');
    return fixture;
};

const switchRoomMapToFloor = async (page: Page, floor: RoomFloor): Promise<void> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        if (await page.getByTestId(`betrayal-room-floor-${floor}`).isVisible({ timeout: 500 }).catch(() => false)) {
            return;
        }
        const upperVisible = await page.getByTestId('betrayal-room-floor-upper')
            .isVisible({ timeout: 250 })
            .catch(() => false);
        const basementVisible = await page.getByTestId('betrayal-room-floor-basement')
            .isVisible({ timeout: 250 })
            .catch(() => false);
        if (floor === 'upper' || (floor === 'ground' && basementVisible)) {
            await page.getByTestId('betrayal-room-floor-up').click();
        } else if (floor === 'basement' || (floor === 'ground' && upperVisible)) {
            await page.getByTestId('betrayal-room-floor-down').click();
        }
    }
    await expect(page.getByTestId(`betrayal-room-floor-${floor}`)).toBeVisible();
};

type MummyActionState = {
    currentPlayer?: string;
    mummyRoomId?: string | null;
    girlHeldByMummy?: boolean;
    girlRoomId?: string | null;
    moveRemaining?: number | null;
    recentRollKind?: string | null;
    pendingRewardDamage?: number | null;
    pendingRewardStealableCardIds?: string[];
    pendingDamagePlayerId?: string | null;
    pendingDamageSourceTitle?: string | null;
    pendingDamageAmount?: number | null;
    pendingDamageKind?: string | null;
    pendingDamageAllowedTraits?: string[];
    pendingDamageForcedTraits?: string[];
    heroPhysicalTraitTotal?: number | null;
    heroPhysicalTrackPositionTotal?: number | null;
    heroHasMap?: boolean;
    rewardPending?: boolean;
};

const readMummyActionState = async (page: Page, heroTargetId?: string): Promise<MummyActionState> =>
    page.evaluate(({ targetHeroId, monsterId }) => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            monsters?: Array<{ id: string; roomId: string | null }>;
                            currentExplorer?: {
                                playerId: string;
                                traits: { might: number; speed: number };
                                traitTracks: { might: { position: number }; speed: { position: number } };
                                inventory: Array<{ id: string }>;
                            };
                            otherExplorers?: Array<{
                                playerId: string;
                                traits: { might: number; speed: number };
                                traitTracks: { might: { position: number }; speed: { position: number } };
                                inventory: Array<{ id: string }>;
                            }>;
                            pendingDamageAllocation?: {
                                playerId?: string;
                                sourceTitle?: string;
                                amount?: number;
                                damageKind?: string;
                                allowedTraits?: string[];
                                forcedTraitSequence?: string[];
                            } | null;
                            recentRoll?: { kind?: string };
                            scenarioRuntime?: {
                                monsterTurn?: { moveRemainingById?: Record<string, number> };
                                mummy?: {
                                    girlHeldByMummy?: boolean;
                                    girlRoomId?: string | null;
                                    pendingAttackReward?: {
                                        damageToHero?: number;
                                        stealableCardIds?: string[];
                                    } | null;
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const mummy = core?.scenarioRuntime?.mummy;
        const monster = core?.monsters?.find((candidate) => candidate.id === monsterId);
        const hero = [core?.currentExplorer, ...(core?.otherExplorers ?? [])]
            .find((explorer) => explorer?.playerId === targetHeroId);
        return {
            currentPlayer: core?.currentPlayer,
            mummyRoomId: monster?.roomId ?? null,
            girlHeldByMummy: mummy?.girlHeldByMummy ?? false,
            girlRoomId: mummy?.girlRoomId ?? null,
            moveRemaining: core?.scenarioRuntime?.monsterTurn?.moveRemainingById?.[monsterId] ?? null,
            recentRollKind: core?.recentRoll?.kind ?? null,
            pendingRewardDamage: mummy?.pendingAttackReward?.damageToHero ?? null,
            pendingRewardStealableCardIds: mummy?.pendingAttackReward?.stealableCardIds ?? [],
            pendingDamagePlayerId: core?.pendingDamageAllocation?.playerId ?? null,
            pendingDamageSourceTitle: core?.pendingDamageAllocation?.sourceTitle ?? null,
            pendingDamageAmount: core?.pendingDamageAllocation?.amount ?? null,
            pendingDamageKind: core?.pendingDamageAllocation?.damageKind ?? null,
            pendingDamageAllowedTraits: core?.pendingDamageAllocation?.allowedTraits ?? [],
            pendingDamageForcedTraits: core?.pendingDamageAllocation?.forcedTraitSequence ?? [],
            heroHasMap: hero?.inventory.some((card) => card.id === 'map') ?? false,
            heroPhysicalTraitTotal: hero ? hero.traits.might + hero.traits.speed : null,
            heroPhysicalTrackPositionTotal: hero
                ? hero.traitTracks.might.position + hero.traitTracks.speed.position
                : null,
            rewardPending: Boolean(mummy?.pendingAttackReward),
        };
    }, { targetHeroId: heroTargetId, monsterId: MUMMY_MONSTER_ID });

const readInjectedCore = async (page: Page): Promise<BetrayalCore> => {
    const core = await page.evaluate(() => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => { core?: unknown };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core ?? null;
    });
    if (!core) {
        throw new Error('木乃伊横行 E2E 未读到当前注入 core');
    }
    return core as BetrayalCore;
};

const openBetrayalAsTraitor = async (page: Page): Promise<void> => {
    await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
};

const openBetrayalAsPlayer = async (page: Page, playerId: string): Promise<void> => {
    await page.goto(humanTestUrlForPlayer(playerId), { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
};

test.describe('山屋惊魂木乃伊横行怪物行动真实入口', () => {
    test('木乃伊移动骰为 0 时，可从怪物动作槽瞬移到女孩房间并拾起女孩', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-teleport');
        const fixture = createMummyTeleportReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            girlRoomId: fixture.girlRoomId,
            girlHeldByMummy: false,
        });

        await switchRoomMapToFloor(page, fixture.mummyRoomFloor);
        const monsterTurnStartAction = page.getByTestId('betrayal-action-monsterTurnStart');
        await expect(monsterTurnStartAction).toBeVisible();
        await expect(monsterTurnStartAction).toContainText('木乃伊开回合');
        await expect(page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`)).toBeVisible();
        await saveScreenshot(page, MOVE_READY_SCREENSHOT);

        await monsterTurnStartAction.click();
        const movementRollAction = page.getByTestId('betrayal-action-monsterMovementRoll');
        await expect(movementRollAction).toBeVisible();
        await expect(movementRollAction).toContainText('木乃伊移动骰');
        await setHarnessRandomQueue(page, [0.01, 0.01, 0.01]);
        await movementRollAction.click();
        const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toBeVisible();
        await expect(rollPanel).toContainText('木乃伊移动');
        await expect(rollPanel).toContainText('可移动 0 间');
        await saveScreenshot(page, MOVE_ROLL_SCREENSHOT);

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动木乃伊');
        await monsterMoveAction.click();
        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await switchRoomMapToFloor(page, fixture.girlRoomFloor);
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.girlRoomId}`)).toBeVisible();
        await saveScreenshot(page, MOVE_TARGET_SCREENSHOT);

        await page.getByTestId(`betrayal-room-${fixture.girlRoomId}`).click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(
            new RegExp(`木乃伊.*${fixture.girlRoomName}`),
        );
        await expect(page.getByTestId(`betrayal-room-monster-${fixture.girlRoomId}-${MUMMY_MONSTER_ID}`)).toBeVisible();
        await expect(page.getByTestId(`betrayal-room-haunt-token-${fixture.girlRoomId}-mummy-girl-token`)).toHaveAttribute(
            'data-token-status',
            'held-by-mummy',
        );
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            mummyRoomId: fixture.girlRoomId,
            girlHeldByMummy: true,
        });
        await saveScreenshot(page, MOVE_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-teleport', diagnostics }]);
    });

    test('木乃伊移动骰为 1 时，仍可从怪物动作槽瞬移到女孩房间并拾起女孩', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-teleport-one');
        const fixture = createMummyTeleportReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            girlRoomId: fixture.girlRoomId,
            girlHeldByMummy: false,
        });

        await switchRoomMapToFloor(page, fixture.mummyRoomFloor);
        const monsterTurnStartAction = page.getByTestId('betrayal-action-monsterTurnStart');
        await expect(monsterTurnStartAction).toBeVisible();
        await expect(monsterTurnStartAction).toContainText('木乃伊开回合');
        await monsterTurnStartAction.click();
        const movementRollAction = page.getByTestId('betrayal-action-monsterMovementRoll');
        await expect(movementRollAction).toBeVisible();
        await expect(movementRollAction).toContainText('木乃伊移动骰');
        await setHarnessRandomQueue(page, [0.5, 0.01, 0.01]);
        await movementRollAction.click();
        const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toBeVisible();
        await expect(rollPanel).toContainText('木乃伊移动');
        await expect(rollPanel).toContainText('可移动 1 间');
        await saveScreenshot(page, MOVE_ONE_ROLL_SCREENSHOT);

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page)).toMatchObject({ moveRemaining: 1 });
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动木乃伊');
        await monsterMoveAction.click();
        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await switchRoomMapToFloor(page, fixture.girlRoomFloor);
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.girlRoomId}`)).toBeVisible();
        await saveScreenshot(page, MOVE_ONE_TARGET_SCREENSHOT);

        await page.getByTestId(`betrayal-room-${fixture.girlRoomId}`).click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(
            new RegExp(`木乃伊.*${fixture.girlRoomName}`),
        );
        await expect(page.getByTestId(`betrayal-room-monster-${fixture.girlRoomId}-${MUMMY_MONSTER_ID}`)).toBeVisible();
        await expect(page.getByTestId(`betrayal-room-haunt-token-${fixture.girlRoomId}-mummy-girl-token`)).toHaveAttribute(
            'data-token-status',
            'held-by-mummy',
        );
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            mummyRoomId: fixture.girlRoomId,
            girlHeldByMummy: true,
        });
        await saveScreenshot(page, MOVE_ONE_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-teleport-one', diagnostics }]);
    });

    test('木乃伊与英雄同房时，真实怪物动作槽必须先攻击并可选择偷走地图', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-reward');
        const fixture = createMummyNonFatalDamageReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroHasMap: true,
        });

        await switchRoomMapToFloor(page, fixture.mummyRoomFloor);
        await expect(page.getByTestId('betrayal-action-monsterMove')).toHaveCount(0);
        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        await expect(monsterAttackAction).toBeVisible();
        await expect(monsterAttackAction).toContainText('木乃伊攻击');
        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        const heroToken = page.getByTestId(`betrayal-room-occupant-${fixture.mummyRoomId}-${fixture.heroTargetId}`);
        await expect(mummyToken).toBeVisible();
        await expect(heroToken).toBeVisible();
        await saveScreenshot(page, ATTACK_READY_SCREENSHOT);

        await monsterAttackAction.click();
        await expect(monsterAttackAction).toContainText('取消攻击');
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${fixture.mummyRoomId}-${fixture.heroTargetId}`)).toHaveAttribute(
            'data-highlight-shape',
            'pentagon',
        );
        await saveScreenshot(page, ATTACK_TARGET_SCREENSHOT);

        await setHarnessRandomQueue(page, [
            0.5, 0.5, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
            0.01, 0.01, 0.01, 0.01,
        ]);
        await heroToken.click();
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('木乃伊攻击');
        await expect(attackRollPanel).toContainText('攻击投骰');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('可造成');
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardStealableCardIds: expect.arrayContaining(['map']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await expect(page.getByTestId('betrayal-mummy-reward-steal-map')).toContainText('偷走地图');
        await saveScreenshot(page, ATTACK_REWARD_SCREENSHOT);

        await page.getByTestId('betrayal-mummy-reward-steal-map').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('夺走地图');
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            heroHasMap: false,
            rewardPending: false,
            pendingDamageSourceTitle: null,
        });
        await saveScreenshot(page, ATTACK_STEAL_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-attack-reward', diagnostics }]);
    });

    test('木乃伊攻击奖励选择造成伤害后，真实页面进入受伤英雄伤害分配并结算回牌桌', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-damage-reward');
        const fixture = createMummyNonFatalDamageReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroHasMap: true,
        });

        await switchRoomMapToFloor(page, fixture.mummyRoomFloor);
        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        await expect(monsterAttackAction).toBeVisible();
        await expect(monsterAttackAction).toContainText('木乃伊攻击');
        await monsterAttackAction.click();

        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        const heroToken = page.getByTestId(`betrayal-room-occupant-${fixture.mummyRoomId}-${fixture.heroTargetId}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');

        await setHarnessRandomQueue(page, [
            0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99,
            0.01, 0.01, 0.01, 0.01,
        ]);
        await heroToken.click();
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('木乃伊攻击');
        await expect(attackRollPanel).toContainText('攻击投骰');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('可造成');
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardDamage: expect.any(Number),
            pendingRewardStealableCardIds: expect.arrayContaining(['map']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await expect(page.getByTestId('betrayal-mummy-reward-damage')).toContainText('造成');

        await page.getByTestId('betrayal-mummy-reward-damage').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        const damagePanel = page.getByTestId('betrayal-damage-allocation-panel');
        await expect(damagePanel).toBeVisible();
        await expect(damagePanel).toHaveAttribute('data-player-id', fixture.heroTargetId);
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('木乃伊攻击');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText('物理伤害');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('力量');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('速度');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            rewardPending: false,
            pendingDamagePlayerId: fixture.heroTargetId,
            pendingDamageSourceTitle: '木乃伊攻击',
            pendingDamageKind: 'physical',
            pendingDamageAllowedTraits: expect.arrayContaining(['might', 'speed']),
        });
        const afterDamageChoice = await readMummyActionState(page, fixture.heroTargetId);
        expect(afterDamageChoice.pendingDamageAmount ?? 0).toBeGreaterThan(0);
        expect(afterDamageChoice.pendingDamageForcedTraits ?? []).toHaveLength(afterDamageChoice.pendingDamageAmount ?? 0);
        await saveScreenshot(page, ATTACK_DAMAGE_SCREENSHOT);

        const coreAfterDamageChoice = await readInjectedCore(page);
        const forcedDamageTraits = afterDamageChoice.pendingDamageForcedTraits ?? [];
        const physicalTrackPositionTotalBefore = afterDamageChoice.heroPhysicalTrackPositionTotal ?? 0;

        await openBetrayalAsPlayer(page, fixture.heroTargetId);
        await injectCore(page, coreAfterDamageChoice);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
        for (const trait of forcedDamageTraits) {
            await page.getByTestId(`betrayal-damage-allocation-trait-${trait}`).click();
        }
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
        await page.getByTestId('betrayal-damage-allocation-confirm').click();
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            rewardPending: false,
            pendingDamageSourceTitle: null,
        });
        const afterAllocation = await readMummyActionState(page, fixture.heroTargetId);
        expect(afterAllocation.heroPhysicalTrackPositionTotal ?? 0).toBeLessThan(physicalTrackPositionTotalBefore);
        expect(afterAllocation.currentPlayer).toBe(fixture.traitorId);
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await saveScreenshot(page, ATTACK_DAMAGE_SETTLED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-attack-damage-reward', diagnostics }]);
    });
});
