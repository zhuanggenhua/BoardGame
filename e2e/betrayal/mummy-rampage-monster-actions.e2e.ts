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
const ATTACK_THEN_MOVE_READY_SCREENSHOT = `${EVIDENCE_DIR}/14-木乃伊攻击后移动入口恢复.jpg`;
const ATTACK_THEN_MOVE_DONE_SCREENSHOT = `${EVIDENCE_DIR}/15-木乃伊攻击后移动到地下室起始点.jpg`;
const ATTACK_STEAL_OMEN_SCREENSHOT = `${EVIDENCE_DIR}/16-木乃伊偷走圣符后反馈.jpg`;
const ATTACK_STEAL_GIRL_SCREENSHOT = `${EVIDENCE_DIR}/17-木乃伊偷走女孩后反馈.jpg`;
const ATTACK_STEAL_RING_SCREENSHOT = `${EVIDENCE_DIR}/18-木乃伊偷走指环后反馈.jpg`;
const ATTACK_ARMOR_DAMAGE_SCREENSHOT = `${EVIDENCE_DIR}/19-木乃伊攻击盔甲减伤分配页.jpg`;
const ATTACK_ARMOR_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/20-木乃伊攻击盔甲减伤结算后反馈.jpg`;
const ATTACK_SKULL_DAMAGE_SCREENSHOT = `${EVIDENCE_DIR}/21-木乃伊攻击头骨死亡保护分配页.jpg`;
const ATTACK_SKULL_DICE_SCREENSHOT = `${EVIDENCE_DIR}/22-木乃伊攻击头骨死亡保护骰盘.jpg`;
const ATTACK_SKULL_PREVENTED_SCREENSHOT = `${EVIDENCE_DIR}/23-木乃伊攻击头骨阻止死亡后反馈.jpg`;
const ATTACK_SKULL_FAILED_DAMAGE_SCREENSHOT = `${EVIDENCE_DIR}/24-木乃伊攻击头骨失败分配页.jpg`;
const ATTACK_SKULL_FAILED_DICE_SCREENSHOT = `${EVIDENCE_DIR}/25-木乃伊攻击头骨失败骰盘.jpg`;
const ATTACK_SKULL_FAILED_FEEDBACK_SCREENSHOT = `${EVIDENCE_DIR}/26-木乃伊攻击头骨失败后反馈.jpg`;
const ATTACK_SKULL_RABBIT_FOOT_READY_SCREENSHOT = `${EVIDENCE_DIR}/27-木乃伊攻击头骨失败后兔脚重掷入口.jpg`;
const ATTACK_SKULL_RABBIT_FOOT_SUCCESS_SCREENSHOT = `${EVIDENCE_DIR}/28-木乃伊攻击兔脚重掷阻止死亡骰盘.jpg`;
const ATTACK_SKULL_RABBIT_FOOT_BOARD_SCREENSHOT = `${EVIDENCE_DIR}/29-木乃伊攻击兔脚阻止死亡后反馈.jpg`;
const ATTACK_BROOCH_FORCED_DAMAGE_SCREENSHOT = `${EVIDENCE_DIR}/30-木乃伊攻击胸针强制伤害分配页.jpg`;
const ATTACK_BROOCH_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/31-木乃伊攻击胸针强制伤害结算后反馈.jpg`;
const RETURN_SARCOPHAGUS_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/32-木乃伊带女孩和圣符回石棺目标高亮.jpg`;
const RETURN_SARCOPHAGUS_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/33-木乃伊回石棺触发叛徒终局.jpg`;
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

const setExplorerPhysicalTraitsNearSkull = (
    core: BetrayalCore,
    playerId: string,
): void => {
    const updateExplorer = (explorer: BetrayalCore['currentExplorer']): BetrayalCore['currentExplorer'] => {
        if (explorer.playerId !== playerId) {
            return explorer;
        }
        const updateTrack = (track: BetrayalCore['currentExplorer']['traitTracks']['might']) => ({
            ...track,
            values: [track.values[track.criticalPosition] ?? 1],
            position: 0,
            startPosition: 0,
            criticalPosition: 0,
            skullPosition: -1,
            maxPosition: 0,
        });
        return {
            ...explorer,
            traits: {
                ...explorer.traits,
                might: explorer.traitTracks.might.values[explorer.traitTracks.might.criticalPosition] ?? explorer.traits.might,
                speed: explorer.traitTracks.speed.values[explorer.traitTracks.speed.criticalPosition] ?? explorer.traits.speed,
            },
            traitTracks: {
                ...explorer.traitTracks,
                might: updateTrack(explorer.traitTracks.might),
                speed: updateTrack(explorer.traitTracks.speed),
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
    const unrevealedRoom = core.rooms.find((room) => room.state !== 'discovered') ?? null;
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
        unrevealedRoomId: unrevealedRoom?.id ?? null,
    };
};

const createMummyReturnToSarcophagusVictoryReadyCore = () => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const mummyRuntime = core.scenarioRuntime.mummy;
    if (!traitorId || !mummyRuntime) {
        throw new Error('木乃伊横行 E2E 夹具缺少叛徒或木乃伊运行态');
    }
    const sarcophagusRoom = core.rooms.find((room) => room.id === mummyRuntime.sarcophagusRoomId);
    const returnStartRoom = core.rooms.find((room) => (
        room.state === 'discovered'
        && room.id !== mummyRuntime.sarcophagusRoomId
    ));
    if (!sarcophagusRoom || !returnStartRoom) {
        throw new Error('木乃伊横行 E2E 夹具缺少石棺房间或回程起点房间');
    }
    const quietRoomId = core.rooms.find((room) => (
        room.state === 'discovered'
        && room.id !== mummyRuntime.sarcophagusRoomId
        && room.id !== returnStartRoom.id
    ))?.id ?? mummyRuntime.sarcophagusRoomId;
    core = activateExplorer(core, traitorId);
    placeExplorer(core, traitorId, mummyRuntime.sarcophagusRoomId);
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === traitorId
            ? explorer
            : { ...explorer, roomId: quietRoomId }
    ));
    core.monsters = core.monsters.map((monster) => (
        monster.id === mummyRuntime.mummyMonsterId
            ? { ...monster, roomId: returnStartRoom.id }
            : monster
    ));
    core.scenarioRuntime.mummy = {
        ...mummyRuntime,
        girlRoomId: null,
        girlHolderPlayerId: null,
        girlHeldByMummy: true,
        mummyCarriedOmenIds: ['holy-symbol'],
        mummyCarriedCards: [{ id: 'holy-symbol', name: '圣符', kind: 'omen' }],
    };
    core.recommendedAction = 'use';
    return {
        core: dismissBlockingOverlays(core),
        traitorId,
        startRoomId: returnStartRoom.id,
        startRoomFloor: returnStartRoom.floor,
        sarcophagusRoomId: mummyRuntime.sarcophagusRoomId,
        sarcophagusRoomFloor: sarcophagusRoom.floor,
        sarcophagusRoomName: sarcophagusRoom.name,
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
    const postAttackMoveRoom = core.rooms.find((room) => (
        room.id === 'basement-landing'
        && room.state === 'discovered'
        && room.id !== mummyRuntime.sarcophagusRoomId
    )) ?? core.rooms.find((room) => (
        room.state === 'discovered'
        && room.id !== mummyRuntime.sarcophagusRoomId
    ));
    if (!postAttackMoveRoom) {
        throw new Error('木乃伊横行 E2E 夹具缺少攻击后可移动目标房间');
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
        postAttackMoveRoomId: postAttackMoveRoom.id,
        postAttackMoveRoomName: postAttackMoveRoom.name,
        postAttackMoveRoomFloor: postAttackMoveRoom.floor,
    };
};

const createMummyNonFatalDamageReadyCore = () => {
    const fixture = createMummyAttackReadyCore();
    fixture.core.scenarioRuntime.deadExplorerPlayerIds = [];
    setExplorerTraitToMax(fixture.core, fixture.heroTargetId, 'speed');
    setExplorerTraitToMax(fixture.core, fixture.heroTargetId, 'might');
    return fixture;
};

const createMummyGirlStealReadyCore = () => {
    const fixture = createMummyNonFatalDamageReadyCore();
    const mummyRuntime = fixture.core.scenarioRuntime.mummy;
    if (!mummyRuntime) {
        throw new Error('木乃伊横行 E2E 女孩偷取夹具缺少木乃伊运行态');
    }
    fixture.core.scenarioRuntime.mummy = {
        ...mummyRuntime,
        girlRoomId: null,
        girlHolderPlayerId: fixture.heroTargetId,
        girlHeldByMummy: false,
    };
    return fixture;
};

const createMummyRingStealReadyCore = () => {
    const fixture = createMummyNonFatalDamageReadyCore();
    placeExplorer(fixture.core, fixture.heroTargetId, fixture.mummyRoomId, [
        { id: 'map', name: '地图', kind: 'item' },
        { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        { id: 'ring', name: '指环', kind: 'omen' },
    ]);
    return fixture;
};

const createMummyArmorDamageReadyCore = () => {
    const fixture = createMummyNonFatalDamageReadyCore();
    placeExplorer(fixture.core, fixture.heroTargetId, fixture.mummyRoomId, [
        { id: 'map', name: '地图', kind: 'item' },
        { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        { id: 'armor', name: '盔甲', kind: 'omen' },
    ]);
    return fixture;
};

const createMummyBroochDamageReadyCore = () => {
    const fixture = createMummyNonFatalDamageReadyCore();
    placeExplorer(fixture.core, fixture.heroTargetId, fixture.mummyRoomId, [
        { id: 'map', name: '地图', kind: 'item' },
        { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        { id: 'brooch', name: '胸针', kind: 'item' },
    ]);
    return fixture;
};

const createMummySkullDeathPreventionReadyCore = () => {
    const fixture = createMummyAttackReadyCore();
    fixture.core.scenarioRuntime.deadExplorerPlayerIds = [];
    placeExplorer(fixture.core, fixture.heroTargetId, fixture.mummyRoomId, [
        { id: 'map', name: '地图', kind: 'item' },
        { id: 'skull', name: '头骨', kind: 'omen' },
    ]);
    setExplorerPhysicalTraitsNearSkull(fixture.core, fixture.heroTargetId);
    return fixture;
};

const createMummySkullRabbitFootDeathPreventionReadyCore = () => {
    const fixture = createMummySkullDeathPreventionReadyCore();
    placeExplorer(fixture.core, fixture.heroTargetId, fixture.mummyRoomId, [
        { id: 'map', name: '地图', kind: 'item' },
        { id: 'skull', name: '头骨', kind: 'omen' },
        { id: 'rope', name: '兔脚', kind: 'item' },
    ]);
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
    phase?: string;
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
    pendingDamageOriginalAmount?: number | null;
    pendingDamageKind?: string | null;
    pendingDamageAllowedTraits?: string[];
    pendingDamageForcedTraits?: string[];
    pendingDamageReplacementKind?: string | null;
    pendingDamageReplacementCardId?: string | null;
    recentRollLatestLabel?: string | null;
    recentRollDeathPreventionDamageKind?: string | null;
    recentRollDeathPreventionDamageAmount?: number | null;
    recentRollDeathPreventionDamageTraits?: string[];
    recentRollConsumedRabbitFootCardIds?: string[];
    heroPhysicalTraitTotal?: number | null;
    heroPhysicalTrackPositionTotal?: number | null;
    heroHasMap?: boolean;
    heroHasHolySymbol?: boolean;
    heroInventoryIds?: string[];
    girlHolderPlayerId?: string | null;
    mummyCarriedCardIds?: string[];
    mummyCarriedOmenIds?: string[];
    deadPlayerIds?: string[];
    endgameOutcome?: string | null;
    usedCardIdsThisTurn?: string[];
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
                                originalAmount?: number;
                                damageKind?: string;
                                allowedTraits?: string[];
                                forcedTraitSequence?: string[];
                                damageReplacement?: {
                                    kind?: string;
                                    cardId?: string;
                                };
                            } | null;
                            recentRoll?: {
                                kind?: string;
                                latestLabel?: string;
                                consumedRabbitFootCardIds?: string[];
                                deathPrevention?: {
                                    damageKind?: string;
                                    damageAmount?: number;
                                    damageTraits?: string[];
                                };
                            };
                            scenarioRuntime?: {
                                deadExplorerPlayerIds?: string[];
                                monsterTurn?: { moveRemainingById?: Record<string, number> };
                                mummy?: {
                                    girlHeldByMummy?: boolean;
                                    girlRoomId?: string | null;
                                    girlHolderPlayerId?: string | null;
                                    mummyCarriedCards?: Array<{ id: string }>;
                                    mummyCarriedOmenIds?: string[];
                                    pendingAttackReward?: {
                                        damageToHero?: number;
                                        stealableCardIds?: string[];
                                    } | null;
                                };
                            };
                            endgameResult?: { outcome?: string } | null;
                            usedCardIdsThisTurn?: string[];
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
            phase: core?.phase,
            mummyRoomId: monster?.roomId ?? null,
            girlHeldByMummy: mummy?.girlHeldByMummy ?? false,
            girlRoomId: mummy?.girlRoomId ?? null,
            moveRemaining: core?.scenarioRuntime?.monsterTurn?.moveRemainingById?.[monsterId] ?? null,
            recentRollKind: core?.recentRoll?.kind ?? null,
            recentRollLatestLabel: core?.recentRoll?.latestLabel ?? null,
            recentRollDeathPreventionDamageKind: core?.recentRoll?.deathPrevention?.damageKind ?? null,
            recentRollDeathPreventionDamageAmount: core?.recentRoll?.deathPrevention?.damageAmount ?? null,
            recentRollDeathPreventionDamageTraits: core?.recentRoll?.deathPrevention?.damageTraits ?? [],
            recentRollConsumedRabbitFootCardIds: core?.recentRoll?.consumedRabbitFootCardIds ?? [],
            pendingRewardDamage: mummy?.pendingAttackReward?.damageToHero ?? null,
            pendingRewardStealableCardIds: mummy?.pendingAttackReward?.stealableCardIds ?? [],
            pendingDamagePlayerId: core?.pendingDamageAllocation?.playerId ?? null,
            pendingDamageSourceTitle: core?.pendingDamageAllocation?.sourceTitle ?? null,
            pendingDamageAmount: core?.pendingDamageAllocation?.amount ?? null,
            pendingDamageOriginalAmount: core?.pendingDamageAllocation?.originalAmount ?? null,
            pendingDamageKind: core?.pendingDamageAllocation?.damageKind ?? null,
            pendingDamageAllowedTraits: core?.pendingDamageAllocation?.allowedTraits ?? [],
            pendingDamageForcedTraits: core?.pendingDamageAllocation?.forcedTraitSequence ?? [],
            pendingDamageReplacementKind: core?.pendingDamageAllocation?.damageReplacement?.kind ?? null,
            pendingDamageReplacementCardId: core?.pendingDamageAllocation?.damageReplacement?.cardId ?? null,
            heroHasMap: hero?.inventory.some((card) => card.id === 'map') ?? false,
            heroHasHolySymbol: hero?.inventory.some((card) => card.id === 'holy-symbol') ?? false,
            heroInventoryIds: hero?.inventory.map((card) => card.id) ?? [],
            heroPhysicalTraitTotal: hero ? hero.traits.might + hero.traits.speed : null,
            heroPhysicalTrackPositionTotal: hero
                ? hero.traitTracks.might.position + hero.traitTracks.speed.position
                : null,
            girlHolderPlayerId: mummy?.girlHolderPlayerId ?? null,
            mummyCarriedCardIds: mummy?.mummyCarriedCards?.map((card) => card.id) ?? [],
            mummyCarriedOmenIds: mummy?.mummyCarriedOmenIds ?? [],
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            endgameOutcome: core?.endgameResult?.outcome ?? null,
            usedCardIdsThisTurn: core?.usedCardIdsThisTurn ?? [],
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
        await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-explore')).toHaveCount(0);
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
        await waitForPhysicalDiceSettled(rollPanel);
        await expect(rollPanel.getByTestId('betrayal-house-dice-physics-source')).toHaveAttribute('data-dice-settled', 'true');
        await expect(rollPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-physics-ready', 'true');
        await expect(rollPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-preload-state', 'none');
        await saveScreenshot(page, MOVE_ROLL_SCREENSHOT);

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动木乃伊');
        await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-explore')).toHaveCount(0);
        await monsterMoveAction.click();
        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('只限已发现房间');
        await expect(page.getByTestId('betrayal-turn-hint')).toContainText('不能探索新房间');
        if (fixture.unrevealedRoomId) {
            await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.unrevealedRoomId}`)).toHaveCount(0);
        }
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
        await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-explore')).toHaveCount(0);
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
        await waitForPhysicalDiceSettled(rollPanel);
        await expect(rollPanel.getByTestId('betrayal-house-dice-physics-source')).toHaveAttribute('data-dice-settled', 'true');
        await expect(rollPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-physics-ready', 'true');
        await expect(rollPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-preload-state', 'none');
        await saveScreenshot(page, MOVE_ONE_ROLL_SCREENSHOT);

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page)).toMatchObject({ moveRemaining: 1 });
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动木乃伊');
        await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-explore')).toHaveCount(0);
        await monsterMoveAction.click();
        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('只限已发现房间');
        await expect(page.getByTestId('betrayal-turn-hint')).toContainText('不能探索新房间');
        if (fixture.unrevealedRoomId) {
            await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.unrevealedRoomId}`)).toHaveCount(0);
        }
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

    test('木乃伊带女孩和圣符时，可从真实怪物移动入口回到石棺并触发叛徒胜利', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-return-sarcophagus-victory');
        const fixture = createMummyReturnToSarcophagusVictoryReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.startRoomId,
            girlHeldByMummy: true,
            mummyCarriedOmenIds: expect.arrayContaining(['holy-symbol']),
            endgameOutcome: null,
        });

        await switchRoomMapToFloor(page, fixture.startRoomFloor);
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
        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page)).toMatchObject({ moveRemaining: 1 });

        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动木乃伊');
        await monsterMoveAction.click();
        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.startRoomId}-${MUMMY_MONSTER_ID}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await switchRoomMapToFloor(page, fixture.sarcophagusRoomFloor);
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.sarcophagusRoomId}`)).toBeVisible();
        await saveScreenshot(page, RETURN_SARCOPHAGUS_TARGET_SCREENSHOT);

        await page.getByTestId(`betrayal-room-${fixture.sarcophagusRoomId}`).click({ position: { x: 8, y: 8 } });
        const endgame = page.getByTestId('betrayal-endgame-screen');
        await expect(endgame).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            phase: 'endgame',
            mummyRoomId: fixture.sarcophagusRoomId,
            girlHeldByMummy: true,
            mummyCarriedOmenIds: expect.arrayContaining(['holy-symbol']),
            endgameOutcome: 'traitor',
        });
        await expect(endgame.getByTestId('betrayal-endgame-ending-narration')).toContainText('小女孩瑟缩于角落');
        await expect(endgame.getByTestId('betrayal-endgame-ending-narration')).toContainText('木乃伊怀中的小女孩');
        await saveScreenshot(page, RETURN_SARCOPHAGUS_ENDING_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-return-sarcophagus-victory', diagnostics }]);
    });

    test('木乃伊与英雄同房时，真实怪物动作槽必须先攻击并可选择偷走地图', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-reward');
        const fixture = createMummyNonFatalDamageReadyCore();
        placeExplorer(fixture.core, fixture.deadHeroId, fixture.mummyRoomId);
        fixture.core.scenarioRuntime.deadExplorerPlayerIds = [fixture.deadHeroId];

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
        const traitorToken = page.getByTestId(`betrayal-room-occupant-${fixture.mummyRoomId}-${fixture.traitorId}`);
        const deadHeroToken = page.getByTestId(`betrayal-room-occupant-${fixture.mummyRoomId}-${fixture.deadHeroId}`);
        await expect(mummyToken).toBeVisible();
        await expect(heroToken).toBeVisible();
        await expect(traitorToken).toBeVisible();
        await expect(deadHeroToken).toBeVisible();
        await saveScreenshot(page, ATTACK_READY_SCREENSHOT);

        await monsterAttackAction.click();
        await expect(monsterAttackAction).toContainText('取消攻击');
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');
        await expect(traitorToken).not.toHaveAttribute('data-direct-target', 'true');
        await expect(deadHeroToken).not.toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${fixture.mummyRoomId}-${fixture.heroTargetId}`)).toHaveAttribute(
            'data-highlight-shape',
            'pentagon',
        );
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${fixture.mummyRoomId}-${fixture.traitorId}`)).toHaveCount(0);
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${fixture.mummyRoomId}-${fixture.deadHeroId}`)).toHaveCount(0);
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

    test('木乃伊攻击奖励可从真实页面偷走圣符并写入木乃伊携带预兆', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-steal-omen');
        const fixture = createMummyNonFatalDamageReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroHasHolySymbol: true,
            mummyCarriedOmenIds: [],
        });

        await switchRoomMapToFloor(page, fixture.mummyRoomFloor);
        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        await expect(monsterAttackAction).toBeVisible();
        await monsterAttackAction.click();

        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        const heroToken = page.getByTestId(`betrayal-room-occupant-${fixture.mummyRoomId}-${fixture.heroTargetId}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');

        await setHarnessRandomQueue(page, [
            0.5, 0.5, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
            0.01, 0.01, 0.01, 0.01,
        ]);
        await heroToken.click();
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('木乃伊攻击');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardStealableCardIds: expect.arrayContaining(['holy-symbol']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await expect(page.getByTestId('betrayal-mummy-reward-steal-holy-symbol')).toContainText('偷走圣符');

        await page.getByTestId('betrayal-mummy-reward-steal-holy-symbol').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('夺走圣符');
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            heroHasHolySymbol: false,
            heroInventoryIds: ['map'],
            mummyCarriedCardIds: expect.arrayContaining(['holy-symbol']),
            mummyCarriedOmenIds: expect.arrayContaining(['holy-symbol']),
            rewardPending: false,
        });
        await saveScreenshot(page, ATTACK_STEAL_OMEN_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-steal-omen', diagnostics }]);
    });

    test('木乃伊攻击奖励可从真实页面偷走指环并写入木乃伊携带预兆', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-steal-ring');
        const fixture = createMummyRingStealReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroInventoryIds: expect.arrayContaining(['map', 'holy-symbol', 'ring']),
            mummyCarriedOmenIds: [],
        });

        await switchRoomMapToFloor(page, fixture.mummyRoomFloor);
        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        await expect(monsterAttackAction).toBeVisible();
        await monsterAttackAction.click();

        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        const heroToken = page.getByTestId(`betrayal-room-occupant-${fixture.mummyRoomId}-${fixture.heroTargetId}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');

        await setHarnessRandomQueue(page, [
            0.5, 0.5, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
            0.01, 0.01, 0.01, 0.01,
        ]);
        await heroToken.click();
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('木乃伊攻击');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardStealableCardIds: expect.arrayContaining(['ring']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await expect(page.getByTestId('betrayal-mummy-reward-steal-ring')).toContainText('偷走指环');

        await page.getByTestId('betrayal-mummy-reward-steal-ring').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('夺走指环');
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            heroInventoryIds: ['map', 'holy-symbol'],
            mummyCarriedCardIds: expect.arrayContaining(['ring']),
            mummyCarriedOmenIds: expect.arrayContaining(['ring']),
            rewardPending: false,
        });
        await saveScreenshot(page, ATTACK_STEAL_RING_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-steal-ring', diagnostics }]);
    });

    test('木乃伊攻击奖励可从真实页面夺走被英雄持有的女孩', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-steal-girl');
        const fixture = createMummyGirlStealReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            girlHolderPlayerId: fixture.heroTargetId,
            girlHeldByMummy: false,
        });

        await switchRoomMapToFloor(page, fixture.mummyRoomFloor);
        await expect(page.getByTestId(`betrayal-room-haunt-token-${fixture.mummyRoomId}-mummy-girl-token`)).toHaveAttribute(
            'data-token-status',
            'held-by-player',
        );
        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        await expect(monsterAttackAction).toBeVisible();
        await monsterAttackAction.click();

        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        const heroToken = page.getByTestId(`betrayal-room-occupant-${fixture.mummyRoomId}-${fixture.heroTargetId}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');

        await setHarnessRandomQueue(page, [
            0.5, 0.5, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
            0.01, 0.01, 0.01, 0.01,
        ]);
        await heroToken.click();
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('木乃伊攻击');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardStealableCardIds: expect.arrayContaining(['mummy-girl-token']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await expect(page.getByTestId('betrayal-mummy-reward-steal-mummy-girl-token')).toContainText('偷走女孩');

        await page.getByTestId('betrayal-mummy-reward-steal-mummy-girl-token').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('夺走女孩');
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect(page.getByTestId(`betrayal-room-haunt-token-${fixture.mummyRoomId}-mummy-girl-token`)).toHaveAttribute(
            'data-token-status',
            'held-by-mummy',
        );
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            girlHolderPlayerId: null,
            girlHeldByMummy: true,
            heroInventoryIds: expect.arrayContaining(['map', 'holy-symbol']),
            rewardPending: false,
        });
        await saveScreenshot(page, ATTACK_STEAL_GIRL_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-steal-girl', diagnostics }]);
    });

    test('木乃伊同房先攻击结算后，可从真实怪物动作槽恢复移动并瞬移离开', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-then-move');
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
        await monsterAttackAction.click();

        const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        const heroToken = page.getByTestId(`betrayal-room-occupant-${fixture.mummyRoomId}-${fixture.heroTargetId}`);
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');

        await setHarnessRandomQueue(page, [
            0.5, 0.5, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
            0.01, 0.01, 0.01, 0.01,
        ]);
        await heroToken.click();
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('木乃伊攻击');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await page.getByTestId('betrayal-mummy-reward-steal-map').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('夺走地图');

        const restoredMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(restoredMoveAction).toBeVisible();
        await expect(restoredMoveAction).toContainText('移动木乃伊');
        await saveScreenshot(page, ATTACK_THEN_MOVE_READY_SCREENSHOT);

        await restoredMoveAction.click();
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await switchRoomMapToFloor(page, fixture.postAttackMoveRoomFloor);
        await expect(page.getByTestId(`betrayal-room-monster-move-target-${fixture.postAttackMoveRoomId}`)).toBeVisible();
        await page.getByTestId(`betrayal-room-${fixture.postAttackMoveRoomId}`).click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(
            new RegExp(`木乃伊.*${fixture.postAttackMoveRoomName}`),
        );
        await expect(page.getByTestId(`betrayal-room-monster-${fixture.postAttackMoveRoomId}-${MUMMY_MONSTER_ID}`)).toBeVisible();
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            mummyRoomId: fixture.postAttackMoveRoomId,
            rewardPending: false,
        });
        await saveScreenshot(page, ATTACK_THEN_MOVE_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-attack-then-move', diagnostics }]);
    });

    test('木乃伊攻击奖励造成伤害时，盔甲会在真实伤害分配页减免 1 点物理伤害', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-armor-damage');
        const fixture = createMummyArmorDamageReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroInventoryIds: expect.arrayContaining(['map', 'holy-symbol', 'armor']),
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
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardDamage: expect.any(Number),
            pendingRewardStealableCardIds: expect.arrayContaining(['armor']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await page.getByTestId('betrayal-mummy-reward-damage').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            rewardPending: false,
            pendingDamagePlayerId: fixture.heroTargetId,
            pendingDamageSourceTitle: '木乃伊攻击',
            pendingDamageKind: 'physical',
            pendingDamageAllowedTraits: expect.arrayContaining(['might', 'speed']),
        });

        const afterDamageChoice = await readMummyActionState(page, fixture.heroTargetId);
        const originalDamageAmount = afterDamageChoice.pendingDamageOriginalAmount ?? 0;
        const reducedDamageAmount = afterDamageChoice.pendingDamageAmount ?? 0;
        expect(originalDamageAmount).toBeGreaterThan(0);
        expect(reducedDamageAmount).toBe(originalDamageAmount - 1);
        expect(afterDamageChoice.pendingDamageForcedTraits ?? []).toHaveLength(reducedDamageAmount);

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
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('木乃伊攻击');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText(`${reducedDamageAmount} 点物理伤害`);
        await expect(page.getByTestId('betrayal-damage-allocation-reduction')).toContainText(
            `原始 ${originalDamageAmount} 点物理伤害`,
        );
        await expect(page.getByTestId('betrayal-damage-allocation-reduction')).toContainText('盔甲减免 1 点');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
        await saveScreenshot(page, ATTACK_ARMOR_DAMAGE_SCREENSHOT);

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
        expect(afterAllocation.heroPhysicalTrackPositionTotal ?? 0).toBe(
            physicalTrackPositionTotalBefore - reducedDamageAmount,
        );
        expect(afterAllocation.currentPlayer).toBe(fixture.traitorId);
        await saveScreenshot(page, ATTACK_ARMOR_SETTLED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-attack-armor-damage', diagnostics }]);
    });

    test('木乃伊攻击奖励造成强制伤害时，持有胸针也不能改为通用伤害', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-brooch-forced-damage');
        const fixture = createMummyBroochDamageReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroInventoryIds: expect.arrayContaining(['map', 'holy-symbol', 'brooch']),
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
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardDamage: expect.any(Number),
            pendingRewardStealableCardIds: expect.arrayContaining(['brooch']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await page.getByTestId('betrayal-mummy-reward-damage').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            rewardPending: false,
            pendingDamagePlayerId: fixture.heroTargetId,
            pendingDamageSourceTitle: '木乃伊攻击',
            pendingDamageKind: 'physical',
            pendingDamageAllowedTraits: ['might', 'speed'],
            pendingDamageReplacementKind: 'brooch-general-damage',
            pendingDamageReplacementCardId: 'brooch',
        });

        const afterDamageChoice = await readMummyActionState(page, fixture.heroTargetId);
        const forcedDamageTraits = afterDamageChoice.pendingDamageForcedTraits ?? [];
        expect(forcedDamageTraits).toHaveLength(afterDamageChoice.pendingDamageAmount ?? 0);
        expect(forcedDamageTraits[0]).toBe('speed');
        expect(forcedDamageTraits.every((trait) => trait === 'speed' || trait === 'might')).toBe(true);
        const coreAfterDamageChoice = await readInjectedCore(page);
        const physicalTrackPositionTotalBefore = afterDamageChoice.heroPhysicalTrackPositionTotal ?? 0;
        const damageAmount = afterDamageChoice.pendingDamageAmount ?? 0;

        await openBetrayalAsPlayer(page, fixture.heroTargetId);
        await injectCore(page, coreAfterDamageChoice);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('木乃伊攻击');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText(`${damageAmount} 点物理伤害`);
        await expect(page.getByTestId('betrayal-damage-allocation-brooch')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('力量');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('速度');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).not.toContainText('知识');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).not.toContainText('神志');
        await saveScreenshot(page, ATTACK_BROOCH_FORCED_DAMAGE_SCREENSHOT);

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
            heroInventoryIds: expect.arrayContaining(['map', 'holy-symbol', 'brooch']),
            usedCardIdsThisTurn: expect.not.arrayContaining(['brooch']),
        });
        const afterAllocation = await readMummyActionState(page, fixture.heroTargetId);
        expect(afterAllocation.heroPhysicalTrackPositionTotal ?? 0).toBe(
            physicalTrackPositionTotalBefore - damageAmount,
        );
        expect(afterAllocation.currentPlayer).toBe(fixture.traitorId);
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await saveScreenshot(page, ATTACK_BROOCH_SETTLED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-attack-brooch-forced-damage', diagnostics }]);
    });

    test('木乃伊攻击奖励造成致死伤害时，头骨会在真实页面投骰阻止死亡', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-skull-death-prevention');
        const fixture = createMummySkullDeathPreventionReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroInventoryIds: expect.arrayContaining(['map', 'skull']),
            deadPlayerIds: [],
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
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardDamage: expect.any(Number),
            pendingRewardStealableCardIds: expect.arrayContaining(['skull']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await page.getByTestId('betrayal-mummy-reward-damage').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            rewardPending: false,
            pendingDamagePlayerId: fixture.heroTargetId,
            pendingDamageSourceTitle: '木乃伊攻击',
            pendingDamageKind: 'physical',
            pendingDamageAmount: 2,
            pendingDamageAllowedTraits: expect.arrayContaining(['might', 'speed']),
            pendingDamageForcedTraits: ['speed', 'might'],
        });

        const afterDamageChoice = await readMummyActionState(page, fixture.heroTargetId);
        const forcedDamageTraits = afterDamageChoice.pendingDamageForcedTraits ?? [];
        expect(forcedDamageTraits).toEqual(['speed', 'might']);
        const coreAfterDamageChoice = await readInjectedCore(page);

        await openBetrayalAsPlayer(page, fixture.heroTargetId);
        await injectCore(page, coreAfterDamageChoice);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('木乃伊攻击');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText('2 点物理伤害');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
        await saveScreenshot(page, ATTACK_SKULL_DAMAGE_SCREENSHOT);

        for (const trait of forcedDamageTraits) {
            await page.getByTestId(`betrayal-damage-allocation-trait-${trait}`).click();
        }
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
        await setHarnessRandomQueue(page, Array.from({ length: 12 }, () => 0.99));
        await page.getByTestId('betrayal-damage-allocation-confirm').click();
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveCount(0);

        const deathRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(deathRollPanel).toContainText('头骨死亡保护', { timeout: 30000 });
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '3');
        await waitForPhysicalDiceSettled(deathRollPanel);
        await expect(deathRollPanel).toContainText('阻止死亡');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            pendingDamageSourceTitle: null,
            recentRollKind: 'deathPrevention',
            recentRollLatestLabel: '阻止死亡',
            recentRollDeathPreventionDamageKind: 'physical',
            recentRollDeathPreventionDamageAmount: 2,
            recentRollDeathPreventionDamageTraits: ['speed', 'might'],
            deadPlayerIds: [],
            endgameOutcome: null,
        });
        await saveScreenshot(page, ATTACK_SKULL_DICE_SCREENSHOT);

        await page.getByRole('button', { name: /返回牌桌/ }).click();
        await expect(deathRollPanel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-endgame-screen')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            deadPlayerIds: [],
            endgameOutcome: null,
        });
        await saveScreenshot(page, ATTACK_SKULL_PREVENTED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-attack-skull-death-prevention', diagnostics }]);
    });

    test('木乃伊攻击奖励造成致死伤害时，头骨失败后目标英雄会死亡但不直接外推终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-skull-death-failed');
        const fixture = createMummySkullDeathPreventionReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroInventoryIds: expect.arrayContaining(['map', 'skull']),
            deadPlayerIds: [],
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
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardDamage: expect.any(Number),
            pendingRewardStealableCardIds: expect.arrayContaining(['skull']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await page.getByTestId('betrayal-mummy-reward-damage').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            rewardPending: false,
            pendingDamagePlayerId: fixture.heroTargetId,
            pendingDamageSourceTitle: '木乃伊攻击',
            pendingDamageKind: 'physical',
            pendingDamageAmount: 2,
            pendingDamageAllowedTraits: expect.arrayContaining(['might', 'speed']),
            pendingDamageForcedTraits: ['speed', 'might'],
        });

        const afterDamageChoice = await readMummyActionState(page, fixture.heroTargetId);
        const forcedDamageTraits = afterDamageChoice.pendingDamageForcedTraits ?? [];
        expect(forcedDamageTraits).toEqual(['speed', 'might']);
        const coreAfterDamageChoice = await readInjectedCore(page);

        await openBetrayalAsPlayer(page, fixture.heroTargetId);
        await injectCore(page, coreAfterDamageChoice);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('木乃伊攻击');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText('2 点物理伤害');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
        await saveScreenshot(page, ATTACK_SKULL_FAILED_DAMAGE_SCREENSHOT);

        for (const trait of forcedDamageTraits) {
            await page.getByTestId(`betrayal-damage-allocation-trait-${trait}`).click();
        }
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
        await setHarnessRandomQueue(page, Array.from({ length: 12 }, () => 0.01));
        await page.getByTestId('betrayal-damage-allocation-confirm').click();
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveCount(0);

        const deathRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(deathRollPanel).toContainText('头骨死亡保护', { timeout: 30000 });
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '3');
        await waitForPhysicalDiceSettled(deathRollPanel);
        await expect(deathRollPanel).toContainText('正常死亡');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            pendingDamageSourceTitle: null,
            recentRollKind: 'deathPrevention',
            recentRollLatestLabel: '正常死亡',
            recentRollDeathPreventionDamageKind: 'physical',
            recentRollDeathPreventionDamageAmount: 2,
            recentRollDeathPreventionDamageTraits: ['speed', 'might'],
            deadPlayerIds: expect.arrayContaining([fixture.heroTargetId]),
            endgameOutcome: null,
        });
        await saveScreenshot(page, ATTACK_SKULL_FAILED_DICE_SCREENSHOT);

        await page.getByRole('button', { name: /返回牌桌/ }).click();
        await expect(deathRollPanel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-endgame-screen')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            deadPlayerIds: expect.arrayContaining([fixture.heroTargetId]),
            endgameOutcome: null,
        });
        await saveScreenshot(page, ATTACK_SKULL_FAILED_FEEDBACK_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-attack-skull-death-failed', diagnostics }]);
    });

    test('木乃伊攻击奖励造成致死伤害时，头骨失败后可用兔脚重掷阻止死亡', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-monster-attack-skull-rabbit-foot');
        const fixture = createMummySkullRabbitFootDeathPreventionReadyCore();

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsTraitor(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            mummyRoomId: fixture.mummyRoomId,
            heroInventoryIds: expect.arrayContaining(['map', 'skull', 'rope']),
            deadPlayerIds: [],
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
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'attackRoll',
            pendingRewardDamage: expect.any(Number),
            pendingRewardStealableCardIds: expect.arrayContaining(['skull']),
        });

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await page.getByTestId('betrayal-mummy-reward-damage').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            rewardPending: false,
            pendingDamagePlayerId: fixture.heroTargetId,
            pendingDamageSourceTitle: '木乃伊攻击',
            pendingDamageKind: 'physical',
            pendingDamageAmount: 2,
            pendingDamageAllowedTraits: expect.arrayContaining(['might', 'speed']),
            pendingDamageForcedTraits: ['speed', 'might'],
        });

        const afterDamageChoice = await readMummyActionState(page, fixture.heroTargetId);
        const forcedDamageTraits = afterDamageChoice.pendingDamageForcedTraits ?? [];
        expect(forcedDamageTraits).toEqual(['speed', 'might']);
        const coreAfterDamageChoice = await readInjectedCore(page);

        await openBetrayalAsPlayer(page, fixture.heroTargetId);
        await injectCore(page, coreAfterDamageChoice);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute(
            'data-player-id',
            fixture.heroTargetId,
        );
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('木乃伊攻击');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText('2 点物理伤害');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();

        for (const trait of forcedDamageTraits) {
            await page.getByTestId(`betrayal-damage-allocation-trait-${trait}`).click();
        }
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
        await setHarnessRandomQueue(page, [0.01, 0.5, 0.99]);
        await page.getByTestId('betrayal-damage-allocation-confirm').click();
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveCount(0);

        const deathRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(deathRollPanel).toContainText('头骨死亡保护', { timeout: 30000 });
        await expect(page.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '3');
        await waitForPhysicalDiceSettled(deathRollPanel);
        await expect(deathRollPanel).toContainText('正常死亡');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            pendingDamageSourceTitle: null,
            recentRollKind: 'deathPrevention',
            recentRollLatestLabel: '正常死亡',
            recentRollDeathPreventionDamageKind: 'physical',
            recentRollDeathPreventionDamageAmount: 2,
            recentRollDeathPreventionDamageTraits: ['speed', 'might'],
            deadPlayerIds: expect.arrayContaining([fixture.heroTargetId]),
            endgameOutcome: null,
        });
        await expect(page.getByTestId('betrayal-inventory-rope')).toHaveAttribute('data-roll-modifier-available', 'true');
        await saveScreenshot(page, ATTACK_SKULL_RABBIT_FOOT_READY_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-rope').click();
        await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toHaveText('兔脚');
        const rabbitFootDice = page.getByTestId('betrayal-rabbit-foot-dice');
        await expect(rabbitFootDice).toBeVisible();
        await expect(rabbitFootDice).toHaveAttribute('data-reroll-target-count', '3');
        const rerollTargetDie = page.getByTestId('betrayal-house-dice-reroll-target-0');
        await expect(rerollTargetDie).toBeVisible();
        await setHarnessRandomQueue(page, [0.99]);
        await rerollTargetDie.click();
        await expect(rabbitFootDice).toBeHidden();

        await waitForPhysicalDiceSettled(deathRollPanel);
        await expect(deathRollPanel).toContainText('阻止死亡');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            recentRollKind: 'deathPrevention',
            recentRollLatestLabel: '阻止死亡',
            recentRollConsumedRabbitFootCardIds: expect.arrayContaining(['rope']),
            usedCardIdsThisTurn: expect.arrayContaining(['rope']),
            deadPlayerIds: expect.not.arrayContaining([fixture.heroTargetId]),
            heroInventoryIds: expect.arrayContaining(['map', 'skull', 'rope']),
            endgameOutcome: null,
        });
        await saveScreenshot(page, ATTACK_SKULL_RABBIT_FOOT_SUCCESS_SCREENSHOT);

        await page.getByRole('button', { name: /返回牌桌/ }).click();
        await expect(deathRollPanel).toHaveCount(0);
        await expect(page.getByTestId('betrayal-endgame-screen')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            usedCardIdsThisTurn: expect.arrayContaining(['rope']),
            deadPlayerIds: expect.not.arrayContaining([fixture.heroTargetId]),
            endgameOutcome: null,
        });
        await saveScreenshot(page, ATTACK_SKULL_RABBIT_FOOT_BOARD_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-monster-attack-skull-rabbit-foot', diagnostics }]);
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
