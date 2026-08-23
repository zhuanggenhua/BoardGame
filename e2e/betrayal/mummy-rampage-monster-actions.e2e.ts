import { expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
    BETRAYAL_COMMANDS,
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterMovementGroups,
    resolveExplorableRoomSlots,
    resolveNextRoomDiscoveryDeckKind,
    type BetrayalCore,
    type BetrayalMonsterMovementRollGroupResult,
} from '../../src/games/betrayal/game';
import {
    BETRAYAL_DISCOVERY_POOLS,
    DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
} from '../../src/games/betrayal/scenarioConfig';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioHauntRuntimeCore,
    createMedicalKitUseReadyRuntimeCore,
    createRuntimeCore,
    dispatchHarnessCommand,
    expectVisiblePhysicalDiceBox,
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
const CURRENT_SCOPE_CANDIDATE_TRAITOR_READER_SCREENSHOT = `${EVIDENCE_DIR}/34-current-scope候选链-叛徒身份与叛徒剧本书.jpg`;
const CURRENT_SCOPE_CANDIDATE_SKIP_EVENT_SCREENSHOT = `${EVIDENCE_DIR}/35-current-scope候选链-叛徒跳过事件说明.jpg`;
const CURRENT_SCOPE_CANDIDATE_NORMAL_MOVE_ROLL_SCREENSHOT = `${EVIDENCE_DIR}/36-current-scope候选链-木乃伊移动骰3点.jpg`;
const CURRENT_SCOPE_CANDIDATE_NORMAL_MOVE_FIRST_STEP_SCREENSHOT = `${EVIDENCE_DIR}/37-current-scope候选链-木乃伊普通移动第一步后仍可继续.jpg`;
const CURRENT_SCOPE_CANDIDATE_NORMAL_MOVE_SECOND_STEP_SCREENSHOT = `${EVIDENCE_DIR}/38-current-scope候选链-木乃伊普通连续移动第二步.jpg`;
const BRIDGED_CANDIDATE_TRAITOR_READER_SCREENSHOT = `${EVIDENCE_DIR}/39-桥接式综合候选链-叛徒身份与剧本书.jpg`;
const BRIDGED_CANDIDATE_SKIP_EVENT_SCREENSHOT = `${EVIDENCE_DIR}/40-桥接式综合候选链-叛徒跳过事件.jpg`;
const BRIDGED_CANDIDATE_FORCED_WEDDING_OMEN_SCREENSHOT = `${EVIDENCE_DIR}/41-桥接式综合候选链-强制婚礼预兆.jpg`;
const BRIDGED_CANDIDATE_MUMMY_MOVE_ROLL_SCREENSHOT = `${EVIDENCE_DIR}/42-桥接式综合候选链-木乃伊3点移动骰.jpg`;
const BRIDGED_CANDIDATE_MUMMY_MOVE_STEP_SCREENSHOT = `${EVIDENCE_DIR}/43-桥接式综合候选链-木乃伊普通连续移动.jpg`;
const BRIDGED_CANDIDATE_ATTACK_REWARD_SCREENSHOT = `${EVIDENCE_DIR}/44-桥接式综合候选链-木乃伊攻击奖励.jpg`;
const BRIDGED_CANDIDATE_GIRL_GIVEN_SCREENSHOT = `${EVIDENCE_DIR}/45-桥接式综合候选链-叛徒交出女孩.jpg`;
const BRIDGED_CANDIDATE_TRAITOR_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/46-桥接式综合候选链-叛徒终局.jpg`;
const GOLDEN_FLOW_OPENING_SCREENSHOT = `${EVIDENCE_DIR}/53-主黄金链-开局牌桌.jpg`;
const GOLDEN_FLOW_EVENT_DISCOVERY_SCREENSHOT = `${EVIDENCE_DIR}/54-主黄金链-翻出事件房并结算事件牌.jpg`;
const GOLDEN_FLOW_ITEM_DISCOVERY_SCREENSHOT = `${EVIDENCE_DIR}/55-主黄金链-翻出物品房并获得物品牌.jpg`;
const GOLDEN_FLOW_ITEM_USE_SCREENSHOT = `${EVIDENCE_DIR}/56-主黄金链-同类物品牌主动使用治疗.jpg`;
const GOLDEN_FLOW_OMEN_DISCOVERY_SCREENSHOT = `${EVIDENCE_DIR}/57-主黄金链-翻出预兆并触发作祟检定.jpg`;
const GOLDEN_FLOW_HERO_READER_SCREENSHOT = `${EVIDENCE_DIR}/58-主黄金链-英雄身份与英雄目标读本.jpg`;
const GOLDEN_FLOW_TRAITOR_READER_SCREENSHOT = `${EVIDENCE_DIR}/59-主黄金链-叛徒身份与敌方情报读本.jpg`;
const GOLDEN_FLOW_SKIP_EVENT_SCREENSHOT = `${EVIDENCE_DIR}/60-主黄金链-作祟后叛徒跳过事件.jpg`;
const GOLDEN_FLOW_MUMMY_MOVE_ROLL_SCREENSHOT = `${EVIDENCE_DIR}/61-主黄金链-木乃伊移动骰3点.jpg`;
const GOLDEN_FLOW_MUMMY_CONTINUOUS_MOVE_SCREENSHOT = `${EVIDENCE_DIR}/62-主黄金链-木乃伊普通连续移动进石棺.jpg`;
const GOLDEN_FLOW_ATTACK_REWARD_SCREENSHOT = `${EVIDENCE_DIR}/63-主黄金链-木乃伊攻击奖励偷圣符.jpg`;
const GOLDEN_FLOW_TRAITOR_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/64-主黄金链-叛徒终局.jpg`;
const goldenFlowProcessScreenshot = (step: number, label: string) =>
    `${EVIDENCE_DIR}/65-主黄金链过程-${String(step).padStart(2, '0')}-${label}.jpg`;
const humanTestUrlForPlayer = (playerId: string) =>
    `/play/betrayal?players=3&playerID=${playerId}&seat0=human&seat1=human&seat2=human`;
const HUMAN_HOTSEAT_TEST_URL = '/play/betrayal?players=3&seat0=human&seat1=human&seat2=human';
const HUMAN_TRAITOR_TEST_URL = humanTestUrlForPlayer('2');
const MUMMY_MONSTER_ID = 'mummy';

const expectGreenDominantHighlightPixels = async (locator: Locator, label: string): Promise<void> => {
    const screenshot = await locator.screenshot({ animations: 'disabled' });
    const { data, info } = await sharp(screenshot)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let greenPixels = 0;
    let yellowPixels = 0;
    const perimeterBand = Math.max(6, Math.ceil(Math.min(info.width, info.height) * 0.22));
    for (let offset = 0; offset < data.length; offset += info.channels) {
        const pixelIndex = offset / info.channels;
        const x = pixelIndex % info.width;
        const y = Math.floor(pixelIndex / info.width);
        const isPerimeterPixel =
            x < perimeterBand ||
            x >= info.width - perimeterBand ||
            y < perimeterBand ||
            y >= info.height - perimeterBand;
        if (!isPerimeterPixel) {
            continue;
        }
        const r = data[offset] ?? 0;
        const g = data[offset + 1] ?? 0;
        const b = data[offset + 2] ?? 0;
        const a = data[offset + 3] ?? 255;
        if (a < 16 || Math.max(r, g, b) < 70 || Math.max(r, g, b) - Math.min(r, g, b) < 24) {
            continue;
        }
        if (g >= 110 && g > r * 1.18 && g > b * 1.15) {
            greenPixels += 1;
        }
        if (r >= 130 && g >= 105 && b <= 145 && r > b * 1.25 && g > b * 1.15 && r < g * 1.65) {
            yellowPixels += 1;
        }
    }
    expect(greenPixels, `${label} 边界区域必须在真实截图像素里出现足够绿色高亮`).toBeGreaterThan(250);
    expect(greenPixels, `${label} 边界区域的绿色像素必须明显压过黄色像素`).toBeGreaterThan(yellowPixels * 2 + 50);
};

const expectSolidTargetOutlineFits = async (
    outline: Locator,
    target: Locator,
    label: string,
    options: { maxCenterDelta?: number; maxSizeDelta?: number } = {},
): Promise<void> => {
    const maxCenterDelta = options.maxCenterDelta ?? 6;
    const maxSizeDelta = options.maxSizeDelta ?? 6;
    await expect(outline, `${label} 必须使用实线高亮语法`).toHaveAttribute('data-highlight-style', 'solid');
    const styles = await outline.evaluate((element) => {
        const computed = window.getComputedStyle(element);
        return {
            boxShadow: computed.boxShadow,
            borderTopWidth: computed.borderTopWidth,
            filter: computed.filter,
            highlightAnchor: element.getAttribute('data-highlight-anchor'),
            highlightLayerCount: element.getAttribute('data-highlight-layer-count'),
        };
    });
    expect(styles.filter, `${label} 不能靠 CSS filter 光晕表达目标边界`).toBe('none');
    expect(styles.boxShadow, `${label} 不能叠加第二层阴影描边`).toBe('none');
    expect(styles.borderTopWidth, `${label} 不能用会压住目标本体的 CSS 内边框`).toBe('0px');
    expect(styles.highlightAnchor, `${label} 必须锚定目标本体表面，不得锚定按钮热区或外挂 token`).toBe('token-surface');
    expect(styles.highlightLayerCount, `${label} 必须是单层绿色实线描边`).toBe('1');

    const [outlineBox, targetBox] = await Promise.all([
        outline.boundingBox(),
        target.boundingBox(),
    ]);
    expect(outlineBox, `${label} 缺少高亮边框 bbox`).toBeTruthy();
    expect(targetBox, `${label} 缺少目标本体 bbox`).toBeTruthy();
    const outlineCenterX = outlineBox!.x + outlineBox!.width / 2;
    const outlineCenterY = outlineBox!.y + outlineBox!.height / 2;
    const targetCenterX = targetBox!.x + targetBox!.width / 2;
    const targetCenterY = targetBox!.y + targetBox!.height / 2;
    expect(Math.abs(outlineCenterX - targetCenterX), `${label} 高亮中心必须贴合目标本体 X`).toBeLessThanOrEqual(maxCenterDelta);
    expect(Math.abs(outlineCenterY - targetCenterY), `${label} 高亮中心必须贴合目标本体 Y`).toBeLessThanOrEqual(maxCenterDelta);
    expect(Math.abs(outlineBox!.width - targetBox!.width), `${label} 高亮宽度不能明显大于目标本体`).toBeLessThanOrEqual(maxSizeDelta);
    expect(Math.abs(outlineBox!.height - targetBox!.height), `${label} 高亮高度不能明显大于目标本体`).toBeLessThanOrEqual(maxSizeDelta);
};

const expectEventChoiceControlsInDecisionZone = async (page: Page, panel: Locator): Promise<void> => {
    const [panelBox, confirmBox, declineBox, summaryBox] = await Promise.all([
        panel.boundingBox(),
        page.getByTestId('betrayal-event-choice-confirm').boundingBox(),
        page.getByTestId('betrayal-event-choice-decline').boundingBox(),
        page.getByTestId('betrayal-event-choice-symbol-summary').boundingBox(),
    ]);
    expect(panelBox, '跳过事件选择面板必须有可测量区域').toBeTruthy();
    expect(summaryBox, '跳过事件选择说明必须可见').toBeTruthy();
    expect(confirmBox, '跳过事件按钮必须有可测量区域').toBeTruthy();
    expect(declineBox, '抽取事件牌按钮必须有可测量区域').toBeTruthy();

    const panelMidY = panelBox!.y + panelBox!.height / 2;
    const summaryBottom = summaryBox!.y + summaryBox!.height;
    for (const [box, label] of [[confirmBox!, '跳过事件'], [declineBox!, '抽取事件牌']] as const) {
        const centerY = box.y + box.height / 2;
        expect(centerY, `${label} 按钮不能停在面板顶部`).toBeGreaterThan(panelMidY);
        expect(box.y, `${label} 按钮必须在事件符号说明之后出现`).toBeGreaterThanOrEqual(summaryBottom - 2);
    }
};

const expectRollContinueButtonUsable = async (page: Page) => {
    const continueButton = page.getByTestId('betrayal-roll-continue');
    await expect(continueButton).toBeVisible();
    const metrics = await continueButton.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const samplePoints = [
            { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            { x: rect.left + rect.width / 2, y: rect.bottom - 4 },
            { x: rect.left + 4, y: rect.top + rect.height / 2 },
            { x: rect.right - 4, y: rect.top + rect.height / 2 },
        ];
        return {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            bottom: rect.bottom,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            hitTestPasses: samplePoints.map((point) => {
                const target = document.elementFromPoint(point.x, point.y);
                return target === button || button.contains(target);
            }),
        };
    });
    expect(metrics.width).toBeGreaterThanOrEqual(88);
    expect(metrics.height).toBeGreaterThanOrEqual(42);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.hitTestPasses.every(Boolean)).toBe(true);
};

type RoomFloor = BetrayalCore['rooms'][number]['floor'];
type RoomTemplate = BetrayalCore['roomDiscoveryDeck'][number]['room'];

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

const cloneRoomTemplate = (room: RoomTemplate): RoomTemplate => ({
    ...room,
    tags: [...room.tags],
    doorways: [...room.doorways],
});

const seedNextGroundRoom = (
    core: BetrayalCore,
    visualId: RoomTemplate['visualId'],
    missingMessage: string,
): void => {
    const room = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find(
        (candidate) => candidate.visualId === visualId,
    );
    if (!room) {
        throw new Error(missingMessage);
    }
    const template = cloneRoomTemplate(room);
    core.roomDiscoveryDeck = [{ floor: 'ground', room: cloneRoomTemplate(template) }];
    core.roomDiscoveryOrderByFloor = {
        ground: [cloneRoomTemplate(template)],
        upper: [],
        basement: [],
    };
    core.buriedRoomTiles = [];
    core.latestRoomDrawResolution = null;
};

const seedNextGroundOmenRoom = (core: BetrayalCore): void => {
    seedNextGroundRoom(core, 'specimenRoom', '木乃伊横行 E2E 缺少一层预兆房：标本室');
};

const seedNextGroundEventRoom = (core: BetrayalCore): void => {
    seedNextGroundRoom(core, 'kitchen', '木乃伊横行 E2E 缺少一层事件房：厨房');
};

const seedNextGroundItemRoom = (core: BetrayalCore): void => {
    seedNextGroundRoom(core, 'vault', '木乃伊横行 E2E 缺少一层物品房：金库');
};

type MummyBridgedCandidateCard = BetrayalCore['currentExplorer']['inventory'][number];

const bridgedCandidateCard = (id: string, name: string, kind: MummyBridgedCandidateCard['kind']): MummyBridgedCandidateCard => ({
    id,
    name,
    kind,
});

type MummyGoldenDiscoveryKind = 'event' | 'item' | 'omen';

const prepareGroundSouthDiscoverySlot = (core: BetrayalCore): void => {
    core.rooms = core.rooms.map((room) => {
        if (room.id === 'ground-south') {
            return {
                ...room,
                state: 'unexplored',
                name: '未探索',
                floor: 'ground',
                discoveryReward: null,
                visualId: 'backGround',
                entryRoomId: 'hallway',
            };
        }
        return room;
    });
};

const createMummyGoldenPreHauntDiscoveryCore = (kind: MummyGoldenDiscoveryKind) => {
    let core = createRuntimeCore();
    core = activateExplorer(core, '0');
    prepareGroundSouthDiscoverySlot(core);
    placeExplorer(core, '0', 'hallway', []);
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === '1'
            ? { ...explorer, roomId: 'entrance-hall' }
            : { ...explorer, roomId: 'foyer' }
    ));
    core.usedCardIdsThisTurn = [];
    core.turnEndedByDiscovery = false;
    core.turnStartSpeed = Math.max(core.currentExplorer.traits.speed, 1);
    core.movesRemaining = core.turnStartSpeed;
    core.recommendedAction = 'explore';

    let expectedCardName = '';
    if (kind === 'event') {
        const eventCard = BETRAYAL_DISCOVERY_POOLS.events.find((candidate) => candidate.name === '外星几何');
        if (!eventCard) {
            throw new Error('木乃伊横行主黄金链缺少正式事件牌：外星几何');
        }
        seedNextGroundEventRoom(core);
        core.drawOrder = ['event'];
        core.eventOrder = [eventCard];
        core.deckCounts.event = core.eventOrder.length;
        expectedCardName = eventCard.name;
    } else if (kind === 'item') {
        seedNextGroundItemRoom(core);
        core.drawOrder = ['item'];
        core.possessionOrderByKind.item = [
            bridgedCandidateCard('medical-kit', '急救包', 'item'),
            bridgedCandidateCard('map', '地图', 'item'),
        ];
        core.deckCounts.item = core.possessionOrderByKind.item.length;
        expectedCardName = '急救包';
    } else {
        seedNextGroundOmenRoom(core);
        core.drawOrder = ['omen'];
        core.possessionOrderByKind.omen = [
            bridgedCandidateCard('omen-book', '书本', 'omen'),
            bridgedCandidateCard('holy-symbol', '圣符', 'omen'),
            bridgedCandidateCard('ring', '指环', 'omen'),
        ];
        core.currentExplorer.inventory = [
            bridgedCandidateCard('dog', '狗', 'omen'),
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                index === 0
                    ? bridgedCandidateCard('mask', '面具', 'omen')
                    : bridgedCandidateCard('skull', '头骨', 'omen'),
            ],
        }));
        core.deckCounts.omen = core.possessionOrderByKind.omen.length;
        expectedCardName = '书本';
    }
    core = dismissBlockingOverlays(core);

    const targetRoom = resolveExplorableRoomSlots(core)[0] ?? null;
    if (!targetRoom) {
        throw new Error(`木乃伊横行主黄金链开局阶段缺少可探索${kind}房门位`);
    }
    if (resolveNextRoomDiscoveryDeckKind(core, { roomId: targetRoom.id }) !== kind) {
        throw new Error(`木乃伊横行主黄金链开局阶段下一张发现必须是 ${kind}`);
    }
    return {
        core,
        kind,
        targetRoomId: targetRoom.id,
        targetRoomFloor: targetRoom.floor,
        expectedCardName,
    };
};

const removeInventoryCardsFromExplorers = (core: BetrayalCore, cardIds: string[]): void => {
    const blockedIds = new Set(cardIds);
    const filterExplorer = (explorer: BetrayalCore['currentExplorer']) => ({
        ...explorer,
        inventory: explorer.inventory.filter((card) => !blockedIds.has(card.id)),
    });
    core.currentExplorer = filterExplorer(core.currentExplorer);
    core.otherExplorers = core.otherExplorers.map(filterExplorer);
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
};

const markAllMonsterActionsDoneForExplorerTurn = (core: BetrayalCore): void => {
    const previous = core.scenarioRuntime.monsterTurn;
    const monsterIds = core.monsters.map((monster) => monster.id);
    core.scenarioRuntime.monsterTurn = {
        resolvedStartMonsterIds: Array.from(new Set([
            ...(previous?.resolvedStartMonsterIds ?? []),
            ...monsterIds,
        ])),
        skippedMonsterIdsThisTurn: Array.from(new Set([
            ...(previous?.skippedMonsterIdsThisTurn ?? []),
            ...monsterIds,
        ])),
        attackedMonsterIdsThisTurn: previous?.attackedMonsterIdsThisTurn ?? [],
        movedMonsterIdsThisTurn: previous?.movedMonsterIdsThisTurn ?? [],
        movementRollsByGroupId: {},
        moveRemainingById: {},
    };
};

const createMummyBridgedCandidateWeddingOmenCore = () => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    if (!traitorId || !core.scenarioRuntime.mummy) {
        throw new Error('木乃伊横行桥接式综合候选链缺少叛徒或木乃伊运行态');
    }
    core = activateExplorer(core, traitorId);
    removeInventoryCardsFromExplorers(core, ['holy-symbol', 'ring']);
    core.drawOrder = ['omen'];
    core.possessionOrderByKind.omen = [
        bridgedCandidateCard('skull', '头骨', 'omen'),
        bridgedCandidateCard('holy-symbol', '圣符', 'omen'),
        bridgedCandidateCard('ring', '指环', 'omen'),
        bridgedCandidateCard('omen-book', '书本', 'omen'),
    ];
    core.usedCardIdsThisTurn = [];
    core.turnEndedByDiscovery = false;
    core.turnStartSpeed = Math.max(core.currentExplorer.traits.speed, 1);
    core.movesRemaining = core.turnStartSpeed;
    core.recommendedAction = 'explore';
    markAllMonsterActionsDoneForExplorerTurn(core);
    core.rooms = core.rooms.map((room) => {
        if (room.id === 'ground-south') {
            return {
                ...room,
                state: 'unexplored',
                name: '未探索',
                floor: 'ground',
                discoveryReward: null,
                visualId: 'backGround',
                entryRoomId: 'hallway',
            };
        }
        return room;
    });
    seedNextGroundOmenRoom(core);
    placeExplorer(core, traitorId, 'hallway', []);
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === traitorId
            ? explorer
            : { ...explorer, roomId: explorer.playerId === core.scenarioRuntime.traitorPlayerId ? 'basement-east' : 'entrance-hall' }
    ));
    core = dismissBlockingOverlays(core);

    const targetRoom = resolveExplorableRoomSlots(core)[0] ?? null;
    if (!targetRoom) {
        throw new Error('木乃伊横行桥接式综合候选链缺少可探索预兆门位');
    }
    if (resolveNextRoomDiscoveryDeckKind(core, { roomId: targetRoom.id }) !== 'omen') {
        throw new Error('木乃伊横行桥接式综合候选链缺少下一张为预兆符号的探索入口');
    }
    return {
        core,
        traitorId,
        targetRoomId: targetRoom.id,
        targetRoomFloor: targetRoom.floor,
        expectedCardId: 'holy-symbol',
        expectedCardName: '圣符',
    };
};

const createMummyBridgedCandidateTraitorVictoryCore = () => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const mummyRuntime = core.scenarioRuntime.mummy;
    if (!traitorId || !mummyRuntime) {
        throw new Error('木乃伊横行桥接式综合候选链缺少叛徒或木乃伊运行态');
    }
    core = activateExplorer(core, traitorId);
    const traitorRoomId = core.currentExplorer.roomId;
    const traitorRoom = core.rooms.find((room) => room.id === traitorRoomId);
    if (!traitorRoom) {
        throw new Error(`木乃伊横行桥接式综合候选链缺少叛徒房间 ${traitorRoomId}`);
    }
    placeExplorer(core, traitorId, traitorRoomId, [
        bridgedCandidateCard('holy-symbol', '圣符', 'omen'),
    ]);
    const quietRoomId = core.rooms.find((room) => (
        room.state === 'discovered'
        && room.id !== traitorRoomId
    ))?.id ?? 'entrance-hall';
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === traitorId
            ? explorer
            : { ...explorer, roomId: quietRoomId }
    ));
    core.monsters = core.monsters.map((monster) => (
        monster.id === mummyRuntime.mummyMonsterId || monster.definitionId === 'mummy'
            ? { ...monster, roomId: traitorRoomId }
            : monster
    ));
    core.scenarioRuntime.mummy = {
        ...mummyRuntime,
        sarcophagusRoomId: traitorRoomId,
        girlRoomId: traitorRoomId,
        girlHolderPlayerId: null,
        girlHeldByMummy: false,
        mummyCarriedOmenIds: [],
        mummyCarriedCards: [],
    };
    core.usedCardIdsThisTurn = [];
    core.recommendedAction = 'use';
    markAllMonsterActionsDoneForExplorerTurn(core);
    return {
        core: dismissBlockingOverlays(core),
        traitorId,
        traitorRoomId,
        traitorRoomFloor: traitorRoom.floor,
    };
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

const discoveredConnectedRoomIds = (core: BetrayalCore, roomId: string): string[] => {
    const room = core.rooms.find((candidate) => candidate.id === roomId);
    if (!room) {
        return [];
    }
    return room.doorways
        .map((doorway) => doorway.connectsToRoomId)
        .filter((targetRoomId): targetRoomId is string => {
            if (!targetRoomId) {
                return false;
            }
            const targetRoom = core.rooms.find((candidate) => candidate.id === targetRoomId);
            return targetRoom?.state === 'discovered';
        });
};

const createTraitorHauntExploreRuntimeCore = () => {
    let core = createRuntimeCore();
    const traitorId = createFirstScenarioHauntRuntimeCore().scenarioRuntime.traitorPlayerId;
    if (!traitorId) {
        throw new Error('木乃伊横行 current-scope 候选链缺少叛徒');
    }
    core.phase = 'haunt';
    core.scenarioRuntime.hauntTriggered = true;
    core.scenarioRuntime.hauntRevealerPlayerId = traitorId;
    core.scenarioRuntime.traitorPlayerId = traitorId;
    core.scenarioRuntime.nextHauntPlayerId = traitorId;
    core.scenarioRuntime.hauntCardNumber = 1;
    core.scenarioRuntime.hauntTriggerLabel = '测试作祟';
    core.scenarioRuntime.hauntScenarioCardId = DEFAULT_BETRAYAL_SCENARIO_CARD_ID;
    core.scenarioRuntime.hauntScenarioCardTitle = '木乃伊横行';
    core.scenarioRuntime.hauntScenarioCardLabel = '作祟 1';
    core.scenarioRuntime.triggeringOmenName = '测试恶兆';
    core = activateExplorer(core, traitorId);
    core.drawOrder = ['event'];
    core.eventOrder = [
        {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        },
    ];
    core.deckCounts.event = core.eventOrder.length;
    core.turnEndedByDiscovery = false;
    core.turnStartSpeed = Math.max(core.currentExplorer.traits.speed, 1);
    core.movesRemaining = core.turnStartSpeed;
    core.recommendedAction = 'explore';
    core = dismissBlockingOverlays(core);
    const candidateRooms = core.rooms.filter((room) => room.state === 'discovered');
    let eventExploreRoomId: string | null = null;
    for (const candidateRoom of candidateRooms) {
        const quietRoomId = candidateRooms.find((room) => room.id !== candidateRoom.id)?.id ?? candidateRoom.id;
        placeExplorer(core, traitorId, candidateRoom.id, []);
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === traitorId
                ? explorer
                : { ...explorer, roomId: quietRoomId }
        ));
        if (
            resolveExplorableRoomSlots(core).length > 0
            && resolveNextRoomDiscoveryDeckKind(core) === 'event'
        ) {
            eventExploreRoomId = candidateRoom.id;
            break;
        }
    }
    if (!eventExploreRoomId) {
        throw new Error('木乃伊横行 current-scope 候选链缺少下一张为事件符号的探索入口');
    }
    const targetRoom = resolveExplorableRoomSlots(core)[0] ?? null;
    if (!targetRoom) {
        throw new Error('木乃伊横行 current-scope 候选链缺少可探索门位');
    }
    return {
        core,
        traitorId,
        targetRoomId: targetRoom.id,
        targetRoomFloor: targetRoom.floor,
    };
};

const createMummyPostHauntContractFlowCore = () => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const mummyRuntime = core.scenarioRuntime.mummy;
    if (!traitorId || !mummyRuntime) {
        throw new Error('木乃伊横行作祟后合同段缺少叛徒或木乃伊运行态');
    }
    const [heroTargetId, quietHeroId] = [core.currentExplorer, ...core.otherExplorers]
        .filter((explorer) => explorer.playerId !== traitorId)
        .map((explorer) => explorer.playerId);
    if (!heroTargetId || !quietHeroId) {
        throw new Error('木乃伊横行作祟后合同段缺少英雄目标');
    }

    core = activateExplorer(core, traitorId);
    removeInventoryCardsFromExplorers(core, ['holy-symbol', 'ring']);
    placeExplorer(core, traitorId, 'hallway', []);
    placeExplorer(core, heroTargetId, mummyRuntime.sarcophagusRoomId, [
        { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        { id: 'map', name: '地图', kind: 'item' },
    ]);
    placeExplorer(core, quietHeroId, 'entrance-hall', []);
    setExplorerTraitToMax(core, heroTargetId, 'speed');
    setExplorerTraitToMax(core, heroTargetId, 'might');

    seedNextGroundEventRoom(core);
    core.drawOrder = ['event'];
    core.eventOrder = [
        {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        },
    ];
    core.deckCounts.event = core.eventOrder.length;
    core.turnEndedByDiscovery = false;
    core.turnStartSpeed = Math.max(core.currentExplorer.traits.speed, 1);
    core.movesRemaining = core.turnStartSpeed;
    core.recommendedAction = 'explore';
    core.usedCardIdsThisTurn = [];
    core.scenarioRuntime.deadExplorerPlayerIds = [];
    core.scenarioRuntime.monsterTurn = {
        resolvedStartMonsterIds: [],
        skippedMonsterIdsThisTurn: [],
        attackedMonsterIdsThisTurn: [],
        movedMonsterIdsThisTurn: [],
        movementRollsByGroupId: {},
        moveRemainingById: {},
    };

    const mummyStartRoomId = 'grand-staircase';
    const firstMoveRoomId = 'basement-landing';
    const sarcophagusRoomId = mummyRuntime.sarcophagusRoomId;
    core.monsters = core.monsters.map((monster) => (
        monster.id === mummyRuntime.mummyMonsterId
            ? { ...monster, roomId: mummyStartRoomId }
            : monster
    ));
    core.scenarioRuntime.mummy = {
        ...mummyRuntime,
        girlRoomId: sarcophagusRoomId,
        girlHolderPlayerId: null,
        girlHeldByMummy: false,
        mummyCarriedOmenIds: [],
        mummyCarriedCards: [],
    };
    core = dismissBlockingOverlays(core);

    const eventTargetRoom = resolveExplorableRoomSlots(core)[0] ?? null;
    if (!eventTargetRoom || resolveNextRoomDiscoveryDeckKind(core) !== 'event') {
        throw new Error('木乃伊横行作祟后合同段起点必须能从叛徒真实探索入口跳过事件');
    }
    const roomById = new Map(core.rooms.map((room) => [room.id, room]));
    const mummyStartRoom = roomById.get(mummyStartRoomId);
    const firstMoveRoom = roomById.get(firstMoveRoomId);
    const sarcophagusRoom = roomById.get(sarcophagusRoomId);
    if (!mummyStartRoom || !firstMoveRoom || !sarcophagusRoom) {
        throw new Error('木乃伊横行作祟后合同段缺少木乃伊两步移动房间');
    }
    const firstMoveValid = resolveBetrayalMonsterMoveTargetRooms(core, mummyRuntime.mummyMonsterId)
        .some((room) => room.id === firstMoveRoom.id);
    const afterFirstMoveCore = {
        ...core,
        monsters: core.monsters.map((monster) => (
            monster.id === mummyRuntime.mummyMonsterId
                ? { ...monster, roomId: firstMoveRoom.id }
                : monster
        )),
    };
    const secondMoveValid = resolveBetrayalMonsterMoveTargetRooms(
        afterFirstMoveCore,
        mummyRuntime.mummyMonsterId,
    ).some((room) => room.id === sarcophagusRoom.id);
    if (!firstMoveValid || !secondMoveValid) {
        throw new Error('木乃伊横行作祟后合同段两步普通移动路径不符合运行时规则');
    }
    markAllMonsterActionsDoneForExplorerTurn(core);

    return {
        core,
        traitorId,
        heroTargetId,
        eventTargetRoomId: eventTargetRoom.id,
        eventTargetRoomFloor: eventTargetRoom.floor,
        mummyStartRoomId: mummyStartRoom.id,
        mummyStartRoomFloor: mummyStartRoom.floor,
        firstMoveRoomId: firstMoveRoom.id,
        firstMoveRoomFloor: firstMoveRoom.floor,
        sarcophagusRoomId: sarcophagusRoom.id,
        sarcophagusRoomFloor: sarcophagusRoom.floor,
    };
};

const createMummyNormalContinuousMoveCore = () => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const mummyRuntime = core.scenarioRuntime.mummy;
    if (!traitorId || !mummyRuntime) {
        throw new Error('木乃伊横行 current-scope 候选链缺少叛徒或木乃伊运行态');
    }
    const blockedRoomIds = new Set([
        mummyRuntime.girlRoomId,
    ].filter((roomId): roomId is string => Boolean(roomId)));
    const discoveredRooms = core.rooms.filter((room) => (
        room.state === 'discovered'
        && !blockedRoomIds.has(room.id)
    ));
    const roomById = new Map(core.rooms.map((room) => [room.id, room]));
    let path: {
        sourceRoomId: string;
        firstRoomId: string;
        secondRoomId: string;
    } | null = null;
    for (const sourceRoom of discoveredRooms) {
        for (const firstRoomId of discoveredConnectedRoomIds(core, sourceRoom.id)) {
            if (blockedRoomIds.has(firstRoomId) || firstRoomId === sourceRoom.id) {
                continue;
            }
            for (const secondRoomId of discoveredConnectedRoomIds(core, firstRoomId)) {
                if (
                    blockedRoomIds.has(secondRoomId)
                    || secondRoomId === sourceRoom.id
                    || secondRoomId === firstRoomId
                ) {
                    continue;
                }
                path = {
                    sourceRoomId: sourceRoom.id,
                    firstRoomId,
                    secondRoomId,
                };
                break;
            }
            if (path) {
                break;
            }
        }
        if (path) {
            break;
        }
    }
    if (!path) {
        throw new Error('木乃伊横行 current-scope 候选链缺少普通连续移动双步路径');
    }
    const heroRoomId = core.rooms.find((room) => (
        room.state === 'discovered'
        && room.id !== path!.sourceRoomId
        && room.id !== path!.firstRoomId
        && room.id !== path!.secondRoomId
    ))?.id;
    if (!heroRoomId) {
        throw new Error('木乃伊横行 current-scope 候选链缺少英雄避让房间');
    }
    core = activateExplorer(core, traitorId);
    placeExplorer(core, traitorId, path.sourceRoomId);
    for (const explorer of [core.currentExplorer, ...core.otherExplorers]) {
        if (explorer.playerId !== traitorId) {
            placeExplorer(core, explorer.playerId, heroRoomId);
        }
    }
    core.monsters = core.monsters.map((monster) => (
        monster.id === mummyRuntime.mummyMonsterId
            ? { ...monster, roomId: path!.sourceRoomId }
            : monster
    ));
    core.scenarioRuntime.monsterTurn = {
        resolvedStartMonsterIds: [],
        skippedMonsterIdsThisTurn: [],
        attackedMonsterIdsThisTurn: [],
        movedMonsterIdsThisTurn: [],
        movementRollsByGroupId: {},
        moveRemainingById: {},
    };
    core.recommendedAction = 'use';
    core = dismissBlockingOverlays(core);

    const firstTargetValid = resolveBetrayalMonsterMoveTargetRooms(core, mummyRuntime.mummyMonsterId)
        .some((room) => room.id === path!.firstRoomId);
    const afterFirstMoveCore = {
        ...core,
        monsters: core.monsters.map((monster) => (
            monster.id === mummyRuntime.mummyMonsterId
                ? { ...monster, roomId: path!.firstRoomId }
                : monster
        )),
    };
    const secondTargetValid = resolveBetrayalMonsterMoveTargetRooms(
        afterFirstMoveCore,
        mummyRuntime.mummyMonsterId,
    ).some((room) => room.id === path!.secondRoomId);
    if (!firstTargetValid || !secondTargetValid) {
        throw new Error('木乃伊横行 current-scope 候选链双步路径不符合运行时移动目标规则');
    }

    const sourceRoom = roomById.get(path.sourceRoomId);
    const firstRoom = roomById.get(path.firstRoomId);
    const secondRoom = roomById.get(path.secondRoomId);
    if (!sourceRoom || !firstRoom || !secondRoom) {
        throw new Error('木乃伊横行 current-scope 候选链路径房间丢失');
    }

    return {
        core,
        traitorId,
        sourceRoomId: sourceRoom.id,
        sourceRoomName: sourceRoom.name,
        sourceRoomFloor: sourceRoom.floor,
        firstRoomId: firstRoom.id,
        firstRoomName: firstRoom.name,
        firstRoomFloor: firstRoom.floor,
        secondRoomId: secondRoom.id,
        secondRoomName: secondRoom.name,
        secondRoomFloor: secondRoom.floor,
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

const switchRoomMapAwayFromFloor = async (
    page: Page,
    currentFloor: RoomFloor,
): Promise<RoomFloor | null> => {
    for (const candidateFloor of (['upper', 'ground', 'basement'] as RoomFloor[])) {
        if (candidateFloor === currentFloor) {
            continue;
        }
        try {
            await switchRoomMapToFloor(page, candidateFloor);
            if (await page.getByTestId(`betrayal-room-floor-${candidateFloor}`).isVisible({ timeout: 500 }).catch(() => false)) {
                return candidateFloor;
            }
        } catch {
            // 该夹具没有把这个楼层纳入当前地图切换集合，继续尝试其它楼层。
        }
    }
    return null;
};

const expectMonsterMoveActionFocusesMummy = async (
    page: Page,
    fixture: ReturnType<typeof createMummyTeleportReadyCore>,
) => {
    const offFloor = await switchRoomMapAwayFromFloor(page, fixture.mummyRoomFloor);
    expect(offFloor).not.toBeNull();
    await expect(page.getByTestId(`betrayal-room-floor-${fixture.mummyRoomFloor}`)).toHaveCount(0);
    await expect(page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`)).toHaveCount(0);

    const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
    await expect(monsterMoveAction).toBeVisible();
    await expect(monsterMoveAction).toContainText('移动木乃伊');
    await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-action-explore')).toHaveCount(0);
    await monsterMoveAction.click();

    await expect(page.getByTestId(`betrayal-room-floor-${fixture.mummyRoomFloor}`)).toBeVisible();
    const mummyToken = page.getByTestId(`betrayal-room-monster-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
    await expect(mummyToken).toBeVisible();
    await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
    await expectSolidTargetOutlineFits(
        page.getByTestId(`betrayal-room-monster-target-outline-${fixture.mummyRoomId}-${MUMMY_MONSTER_ID}`),
        mummyToken.getByTestId(`betrayal-monster-board-token-surface-${MUMMY_MONSTER_ID}`),
        '木乃伊行动来源目标高亮',
        { maxCenterDelta: 3, maxSizeDelta: 4 },
    );
    return mummyToken;
};

type MummyActionState = {
    currentPlayer?: string;
    phase?: string;
    turnEndedByDiscovery?: boolean;
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
            turnEndedByDiscovery: Boolean(core?.turnEndedByDiscovery),
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

const advanceByRealEndTurnsUntilActivePlayer = async (
    page: Page,
    playerId: string,
    heroTargetId: string,
): Promise<void> => {
    for (let step = 0; step < 6; step += 1) {
        const state = await readMummyActionState(page, heroTargetId);
        if (state.currentPlayer === playerId && state.turnEndedByDiscovery === false) {
            return;
        }
        const endTurnAction = page.getByTestId('betrayal-action-endTurn');
        await expect(endTurnAction, `第 ${step + 1} 次真实结束回合必须可见`).toBeVisible();
        await endTurnAction.click();
        await expect.poll(() => readMummyActionState(page, heroTargetId), {
            message: `第 ${step + 1} 次真实结束回合后当前玩家应推进`,
        }).not.toMatchObject({
            currentPlayer: state.currentPlayer,
            turnEndedByDiscovery: state.turnEndedByDiscovery,
        });
    }
    throw new Error(`木乃伊横行主黄金链未能通过真实结束回合推进到玩家 ${playerId}`);
};

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

const openBetrayalHotseat = async (page: Page): Promise<void> => {
    await page.goto(HUMAN_HOTSEAT_TEST_URL, { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
};

const closeScenarioReaderIfPresent = async (page: Page): Promise<void> => {
    const closeButton = page.getByTestId('betrayal-scenario-reader-close');
    if (await closeButton.first().isVisible({ timeout: 500 }).catch(() => false)) {
        await closeButton.first().click();
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).toHaveCount(0);
    }
};

const dismissHauntRevealIfPresent = async (page: Page): Promise<void> => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.first().isVisible({ timeout: 500 }).catch(() => false)) {
        await closeButton.first().click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

const confirmPendingRoomPlacement = async (page: Page): Promise<void> => {
    const placementPanel = page.getByTestId('betrayal-room-placement-panel');
    await expect(placementPanel).toBeVisible({ timeout: 30000 });
    await page.getByTestId('betrayal-room-placement-confirm').click();
    await expect(placementPanel).toHaveCount(0);
};

type MummyGoldenDiscoveryState = {
    phase?: string;
    currentPlayer?: string;
    traitorPlayerId?: string | null;
    currentRoomId?: string;
    latestDiscoveryKind?: string | null;
    latestDiscoveryTitle?: string | null;
    latestDiscoveryDetail?: string | null;
    currentInventoryNames?: string[];
    eventDiscardCount?: number;
    recentRollKind?: string | null;
    pendingCardResolutionCount?: number;
};

const readMummyGoldenDiscoveryState = async (page: Page): Promise<MummyGoldenDiscoveryState> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            phase?: string;
                            currentPlayer?: string;
                            currentExplorer?: {
                                roomId?: string;
                                inventory?: Array<{ name?: string }>;
                            };
                            scenarioRuntime?: {
                                traitorPlayerId?: string | null;
                            };
                            latestDiscovery?: {
                                kind?: string;
                                title?: string;
                                detail?: string;
                            } | null;
                            discardCounts?: { event?: number };
                            recentRoll?: { kind?: string } | null;
                            pendingCardResolutionQueue?: unknown[];
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.().core;
        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            traitorPlayerId: core?.scenarioRuntime?.traitorPlayerId ?? null,
            currentRoomId: core?.currentExplorer?.roomId,
            latestDiscoveryKind: core?.latestDiscovery?.kind ?? null,
            latestDiscoveryTitle: core?.latestDiscovery?.title ?? null,
            latestDiscoveryDetail: core?.latestDiscovery?.detail ?? null,
            currentInventoryNames: core?.currentExplorer?.inventory?.map((card) => card.name ?? '') ?? [],
            eventDiscardCount: core?.discardCounts?.event ?? 0,
            recentRollKind: core?.recentRoll?.kind ?? null,
            pendingCardResolutionCount: core?.pendingCardResolutionQueue?.length ?? 0,
        };
    });

const acknowledgeRemainingMummyGoldenCardResolutionPlayers = async (page: Page): Promise<void> => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const pending = await page.evaluate(() => {
            const core = (window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                pendingCardResolutionQueue?: Array<{
                                    id?: string;
                                    playerId?: string;
                                    requiredPlayerIds?: string[];
                                    acknowledgedPlayerIds?: string[];
                                }>;
                            };
                        };
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.().core;
            return core?.pendingCardResolutionQueue?.[0] ?? null;
        });
        if (!pending?.id) {
            return;
        }
        const requiredPlayerIds = pending.requiredPlayerIds?.length
            ? pending.requiredPlayerIds
            : pending.playerId
                ? [pending.playerId]
                : [];
        const acknowledgedPlayerIds = new Set(pending.acknowledgedPlayerIds ?? []);
        const nextPlayerId = requiredPlayerIds.find((playerId) => !acknowledgedPlayerIds.has(playerId));
        if (!nextPlayerId) {
            return;
        }
        await dispatchHarnessCommand(
            page,
            BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION,
            nextPlayerId,
            { resolutionId: pending.id },
        );
    }
    throw new Error('木乃伊横行主黄金链发现牌确认队列超过安全上限');
};

const exploreMummyGoldenDiscoveryRoom = async (
    page: Page,
    fixture: ReturnType<typeof createMummyGoldenPreHauntDiscoveryCore>,
    screenshots: { targetReady?: string } = {},
): Promise<void> => {
    await expect(page.getByTestId('betrayal-action-explore')).toContainText('探索');
    await page.getByTestId('betrayal-action-explore').click();
    await switchRoomMapToFloor(page, fixture.targetRoomFloor);
    await expect(page.getByTestId(`betrayal-room-explore-target-${fixture.targetRoomId}`)).toBeVisible();
    if (screenshots.targetReady) {
        await saveScreenshot(page, screenshots.targetReady);
    }
    await page.getByTestId(`betrayal-room-${fixture.targetRoomId}`).click();
    await confirmPendingRoomPlacement(page);
    await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible({ timeout: 30000 });
};

const exerciseEventSymbolSkipAfterRoomReveal = async (
    page: Page,
    fixture: { targetRoomId: string; targetRoomFloor: RoomFloor },
    screenshots: {
        exploreReady?: string;
        targetReady?: string;
        choiceReady?: string;
        settled?: string;
    } = {},
): Promise<void> => {
    await expect(page.getByTestId('betrayal-explore-option-traitor-event-skip')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-action-explore')).toContainText('探索');
    if (screenshots.exploreReady) {
        await saveScreenshot(page, screenshots.exploreReady);
    }
    await page.getByTestId('betrayal-action-explore').click();
    await switchRoomMapToFloor(page, fixture.targetRoomFloor);
    await expect(page.getByTestId(`betrayal-room-explore-target-${fixture.targetRoomId}`)).toBeVisible();
    if (screenshots.targetReady) {
        await saveScreenshot(page, screenshots.targetReady);
    }
    await page.getByTestId(`betrayal-room-${fixture.targetRoomId}`).click();
    await confirmPendingRoomPlacement(page);

    const choicePanel = page.getByTestId('betrayal-event-choice-panel');
    await expect(choicePanel).toBeVisible({ timeout: 30000 });
    await expect(choicePanel).toHaveAttribute('aria-label', /事件符号/);
    await expect(page.getByTestId('betrayal-event-choice-card-front-atlas')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-event-choice-card-front-missing')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-event-choice-symbol-summary')).toContainText('已翻出带事件符号的房间');
    await expect(page.getByTestId('betrayal-event-choice-confirm')).toContainText('跳过事件');
    await expect(page.getByTestId('betrayal-event-choice-decline')).toContainText('抽取事件牌');
    await expectEventChoiceControlsInDecisionZone(page, choicePanel);
    const discoveryDetail = page.getByTestId('betrayal-discovery-detail');
    if (await discoveryDetail.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(discoveryDetail).toContainText(/可选择跳过事件|等待选择是否跳过事件/);
    }
    if (screenshots.choiceReady) {
        await saveScreenshot(page, screenshots.choiceReady);
    }

    await page.getByTestId('betrayal-event-choice-confirm').click();
    await expect(page.getByTestId('betrayal-event-choice-panel')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-discovery-card-front-atlas')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-discovery-card-front-missing')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-discovery-no-card-result')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/跳过了事件|跳过事件/);
    await expect(page.getByTestId('betrayal-board')).toBeVisible();
    if (screenshots.settled) {
        await saveScreenshot(page, screenshots.settled);
    }
};

const exerciseMummyGoldenMedicalKitUse = async (
    page: Page,
    screenshots: {
        ready?: string;
        selected?: string;
        targetReady?: string;
        useReady?: string;
        settled?: string;
    } = {},
): Promise<void> => {
    await injectCore(page, createMedicalKitUseReadyRuntimeCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    const beforeUseCore = await readInjectedCore(page);
    const beforeTargetExplorer = [beforeUseCore.currentExplorer, ...beforeUseCore.otherExplorers]
        .find((explorer) => explorer.playerId === '1');
    if (!beforeTargetExplorer) {
        throw new Error('急救包 E2E 缺少被治疗目标玩家 1');
    }
    const beforeTargetTraitTotal = beforeTargetExplorer.traits.might
        + beforeTargetExplorer.traits.speed
        + beforeTargetExplorer.traits.knowledge
        + beforeTargetExplorer.traits.sanity;
    await expect(page.getByTestId('betrayal-inventory-medical-kit')).toBeVisible();
    await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
    if (screenshots.ready) {
        await saveScreenshot(page, screenshots.ready);
    }

    await page.getByTestId('betrayal-inventory-medical-kit').click();
    await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toContainText('急救包');
    await expect(page.getByTestId('betrayal-inventory-target-player-selector')).toContainText('急救包');
    if (screenshots.selected) {
        await saveScreenshot(page, screenshots.selected);
    }
    const teammateTarget = page.getByTestId('betrayal-room-occupant-hallway-1');
    await expect(teammateTarget).toHaveAttribute('data-direct-target', 'true');
    const teammateTargetOutline = page.getByTestId('betrayal-room-occupant-target-outline-hallway-1');
    await expect(teammateTargetOutline).toHaveAttribute('data-highlight-shape', 'pentagon');
    await expect(teammateTargetOutline).toHaveAttribute('data-highlight-color', 'green');
    await expectSolidTargetOutlineFits(
        teammateTargetOutline,
        teammateTarget.getByTestId('betrayal-explorer-figure-token-surface-1'),
        '急救包治疗目标高亮',
    );
    await expectGreenDominantHighlightPixels(teammateTargetOutline, '急救包治疗目标高亮');
    if (screenshots.targetReady) {
        await saveScreenshot(page, screenshots.targetReady);
    }
    await teammateTarget.click();
    await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
    if (screenshots.useReady) {
        await saveScreenshot(page, screenshots.useReady);
    }
    await page.getByTestId('betrayal-action-use').click();

    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/急救包|治疗/);
    await expect(page.getByTestId('betrayal-visible-feedback')).toHaveCount(0);
    const targetFeedback = page.getByTestId('betrayal-room-occupant-feedback-hallway-1');
    await expect(targetFeedback).toBeVisible();
    await expect(targetFeedback).toHaveAttribute('data-feedback-style', 'floating-text');
    await expect(targetFeedback).toHaveAttribute('data-feedback-anchor', 'target-token');
    await expect(targetFeedback).toContainText(/治疗\s*\+4$/);
    await expect(targetFeedback).not.toContainText('力量 / 速度 / 知识 / 神志');
    await expect(page.getByTestId('betrayal-inventory-medical-kit')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toHaveCount(0);
    const afterUseCore = await readInjectedCore(page);
    const afterTargetExplorer = [afterUseCore.currentExplorer, ...afterUseCore.otherExplorers]
        .find((explorer) => explorer.playerId === '1');
    if (!afterTargetExplorer) {
        throw new Error('急救包 E2E 结算后缺少被治疗目标玩家 1');
    }
    const afterTargetTraitTotal = afterTargetExplorer.traits.might
        + afterTargetExplorer.traits.speed
        + afterTargetExplorer.traits.knowledge
        + afterTargetExplorer.traits.sanity;
    expect(afterTargetTraitTotal).toBeGreaterThan(beforeTargetTraitTotal);
    if (screenshots.settled) {
        await saveScreenshot(page, screenshots.settled);
    }
};

const moveMummyThroughRealRoomTarget = async (
    page: Page,
    source: { roomId: string; floor: RoomFloor },
    target: { roomId: string; floor: RoomFloor },
    screenshots: { targetReady?: string } = {},
): Promise<void> => {
    await switchRoomMapToFloor(page, target.floor);
    const targetMarker = page.getByTestId(`betrayal-room-monster-move-target-${target.roomId}`);
    if (!(await targetMarker.isVisible({ timeout: 750 }).catch(() => false))) {
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
        const actionText = await monsterMoveAction.textContent();
        if (!actionText?.includes('取消')) {
            await expect(monsterMoveAction).toContainText('移动木乃伊');
            await monsterMoveAction.click();
        }

        await switchRoomMapToFloor(page, source.floor);
        const mummyToken = page.getByTestId(`betrayal-room-monster-${source.roomId}-${MUMMY_MONSTER_ID}`);
        await expect(mummyToken).toBeVisible();
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();

        await switchRoomMapToFloor(page, target.floor);
        await expect(targetMarker).toBeVisible();
    }
    if (screenshots.targetReady) {
        await saveScreenshot(page, screenshots.targetReady);
    }
    await page.getByTestId(`betrayal-room-${target.roomId}`).click({ position: { x: 12, y: 12 } });
};

test.describe('山屋惊魂木乃伊横行怪物行动真实入口', () => {
    test('主黄金链：开局、三类发现、作祟、木乃伊行动、叛徒终局', async ({ page, context }) => {
        test.setTimeout(300000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-full-golden-flow');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalHotseat(page);

        const eventFixture = createMummyGoldenPreHauntDiscoveryCore('event');
        await injectCore(page, eventFixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyGoldenDiscoveryState(page)).toMatchObject({
            phase: 'preHaunt',
            currentPlayer: '0',
            currentRoomId: 'hallway',
        });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟前|Pre-Haunt/i);
        await expect(page.getByTestId('betrayal-action-explore')).toContainText('探索');
        await saveScreenshot(page, goldenFlowProcessScreenshot(1, '开局牌桌-探索入口可见'));
        await saveScreenshot(page, GOLDEN_FLOW_OPENING_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await exploreMummyGoldenDiscoveryRoom(page, eventFixture, {
            targetReady: goldenFlowProcessScreenshot(2, '事件房探索目标高亮-点击前'),
        });
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveAttribute(
            'aria-label',
            /事件牌 外星几何/,
        );
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('知识检定');
        const openingEventRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(openingEventRollPanel).toContainText('总点数');
        await expect(openingEventRollPanel).toContainText('获得 1 点知识');
        await waitForPhysicalDiceSettled(openingEventRollPanel);
        await expect.poll(() => readMummyGoldenDiscoveryState(page)).toMatchObject({
            latestDiscoveryKind: 'event',
            latestDiscoveryTitle: eventFixture.expectedCardName,
            recentRollKind: 'eventTraitCheck',
        });
        await saveScreenshot(page, goldenFlowProcessScreenshot(3, '事件牌结算结果-知识检定后'));
        await saveScreenshot(page, GOLDEN_FLOW_EVENT_DISCOVERY_SCREENSHOT);

        const itemFixture = createMummyGoldenPreHauntDiscoveryCore('item');
        await injectCore(page, itemFixture.core);
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await saveScreenshot(page, goldenFlowProcessScreenshot(4, '物品段开局牌桌-探索入口可见'));
        await exploreMummyGoldenDiscoveryRoom(page, itemFixture, {
            targetReady: goldenFlowProcessScreenshot(5, '物品房探索目标高亮-点击前'),
        });
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveAttribute(
            'aria-label',
            /物品牌 急救包/,
        );
        await expect(page.getByTestId('betrayal-discovery-panel')).toContainText('已加入持有区');
        await expect.poll(() => readMummyGoldenDiscoveryState(page)).toMatchObject({
            latestDiscoveryKind: 'item',
            latestDiscoveryTitle: itemFixture.expectedCardName,
            currentInventoryNames: expect.arrayContaining([itemFixture.expectedCardName]),
            pendingCardResolutionCount: 1,
        });
        await saveScreenshot(page, goldenFlowProcessScreenshot(6, '物品牌获得结果-急救包进入持有区'));
        await saveScreenshot(page, GOLDEN_FLOW_ITEM_DISCOVERY_SCREENSHOT);

        await exerciseMummyGoldenMedicalKitUse(page, {
            ready: goldenFlowProcessScreenshot(7, '急救包使用前-持有区可选'),
            selected: goldenFlowProcessScreenshot(8, '急救包已选中-等待选择治疗目标'),
            targetReady: goldenFlowProcessScreenshot(9, '急救包治疗目标高亮-点击前'),
            useReady: goldenFlowProcessScreenshot(10, '急救包确认使用按钮可用'),
            settled: goldenFlowProcessScreenshot(11, '急救包使用后-治疗反馈与移除'),
        });
        await saveScreenshot(page, GOLDEN_FLOW_ITEM_USE_SCREENSHOT);

        const omenFixture = createMummyGoldenPreHauntDiscoveryCore('omen');
        await injectCore(page, omenFixture.core);
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await saveScreenshot(page, goldenFlowProcessScreenshot(12, '预兆段开局牌桌-探索入口可见'));
        await exploreMummyGoldenDiscoveryRoom(page, omenFixture, {
            targetReady: goldenFlowProcessScreenshot(13, '预兆房探索目标高亮-点击前'),
        });
        const omenDiscoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveAttribute(
            'aria-label',
            /预兆牌 书本/,
        );
        await expect(page.getByTestId('betrayal-discovery-panel')).toContainText('已加入持有区');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('作祟检定');
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('已触发');
        const omenHauntRollPanel = omenDiscoveryPanel.getByTestId('betrayal-recent-roll-panel');
        await expect(omenHauntRollPanel).toContainText('作祟开始', { timeout: 30000 });
        await expect(omenHauntRollPanel).toContainText('总点数');
        await expectVisiblePhysicalDiceBox(omenHauntRollPanel);
        await waitForPhysicalDiceSettled(omenHauntRollPanel);
        await expect.poll(() => readMummyGoldenDiscoveryState(page)).toMatchObject({
            phase: 'haunt',
            latestDiscoveryKind: 'omen',
            latestDiscoveryTitle: omenFixture.expectedCardName,
            pendingCardResolutionCount: 1,
            recentRollKind: 'hauntRoll',
        });
        await saveScreenshot(page, goldenFlowProcessScreenshot(14, '预兆书本翻出-作祟检定已触发'));
        await saveScreenshot(page, GOLDEN_FLOW_OMEN_DISCOVERY_SCREENSHOT);

        await omenDiscoveryPanel.getByTestId('betrayal-discovery-continue').click();
        await acknowledgeRemainingMummyGoldenCardResolutionPlayers(page);
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        const triggeredHauntCore = await readInjectedCore(page);
        const triggeredTraitorPlayerId = triggeredHauntCore.scenarioRuntime.traitorPlayerId;
        if (!triggeredTraitorPlayerId) {
            throw new Error('木乃伊横行主黄金链真实触发作祟后未写入叛徒玩家');
        }
        const triggeredHeroReaderPlayerId = triggeredHauntCore.playerIds.find(
            (playerId) => playerId !== triggeredTraitorPlayerId,
        );
        if (!triggeredHeroReaderPlayerId) {
            throw new Error('木乃伊横行主黄金链真实触发作祟后缺少英雄读本视角');
        }

        await closeScenarioReaderIfPresent(page);
        await openBetrayalAsPlayer(page, triggeredHeroReaderPlayerId);
        await injectCore(page, triggeredHauntCore);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        let scenarioReader = page.getByTestId('betrayal-scenario-reader-dialog');
        if (!(await scenarioReader.isVisible({ timeout: 1000 }).catch(() => false))) {
            await page.getByTestId('betrayal-open-scenario').click();
        }
        await expect(scenarioReader).toBeVisible({ timeout: 30000 });
        const heroReader = scenarioReader;
        await expect(
            heroReader.getByTestId('betrayal-scenario-objective-page'),
        ).toHaveAttribute('data-scenario-reader-scope', 'heroes');
        await expect(
            heroReader.getByTestId('betrayal-scenario-reader-role'),
        ).toContainText('英雄剧本书');
        await expect(heroReader.getByTestId('betrayal-scenario-book-section-traitor')).toHaveCount(0);
        if (await heroReader.getByTestId('betrayal-scenario-opening-stage').isVisible({ timeout: 1000 }).catch(() => false)) {
            await saveScreenshot(page, goldenFlowProcessScreenshot(15, '作祟后英雄剧本开场-继续前'));
            await heroReader.getByTestId('betrayal-scenario-reader-next-zone').click();
        }
        await expect(heroReader.getByTestId('betrayal-scenario-book')).toBeVisible({ timeout: 30000 });
        await expect(heroReader.getByTestId('betrayal-scenario-objective-page')).not.toContainText('木乃伊横行');
        await expect(heroReader.getByTestId('betrayal-scenario-book-section-title-heroes')).toContainText('敌方情报 / 胜利条件');
        await expect(heroReader.getByTestId('betrayal-scenario-book-section-heroes')).toContainText('将木乃伊驱逐回亡者之国');
        await expect(heroReader.getByTestId('betrayal-scenario-book-section-traitor')).toHaveCount(0);
        await saveScreenshot(page, goldenFlowProcessScreenshot(16, '英雄目标读本正文-段落标题可读'));
        await saveScreenshot(page, GOLDEN_FLOW_HERO_READER_SCREENSHOT);

        await closeScenarioReaderIfPresent(page);
        await openBetrayalAsPlayer(page, triggeredTraitorPlayerId);
        await injectCore(page, triggeredHauntCore);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        scenarioReader = page.getByTestId('betrayal-scenario-reader-dialog');
        if (!(await scenarioReader.isVisible({ timeout: 1000 }).catch(() => false))) {
            await page.getByTestId('betrayal-open-scenario').click();
        }
        await expect(scenarioReader).toBeVisible({ timeout: 30000 });
        const traitorReader = scenarioReader;
        await expect(
            traitorReader.getByTestId('betrayal-scenario-objective-page'),
        ).toHaveAttribute('data-scenario-reader-scope', 'traitor');
        await expect(
            traitorReader.getByTestId('betrayal-scenario-reader-role'),
        ).toContainText('你是叛徒：叛徒剧本书');
        if (await traitorReader.getByTestId('betrayal-scenario-opening-stage').isVisible({ timeout: 1000 }).catch(() => false)) {
            await saveScreenshot(page, goldenFlowProcessScreenshot(17, '作祟后叛徒剧本开场-继续前'));
            await traitorReader.getByTestId('betrayal-scenario-reader-next-zone').click();
        }
        await expect(traitorReader.getByTestId('betrayal-scenario-book')).toBeVisible({ timeout: 30000 });
        await expect(traitorReader.getByTestId('betrayal-scenario-objective-page')).not.toContainText('木乃伊横行');
        await expect(traitorReader.getByTestId('betrayal-scenario-book-section-title-traitor')).toContainText('敌方情报 / 胜利条件');
        await expect(traitorReader.getByTestId('betrayal-scenario-book-section-traitor')).toContainText('敌方情报 / 胜利条件');
        await expect(traitorReader.getByTestId('betrayal-scenario-book-section-traitor')).toContainText('他们妄图将木乃伊驱逐回亡者之国');
        await expect(traitorReader.getByTestId('betrayal-scenario-book-section-heroes')).toHaveCount(0);
        await saveScreenshot(page, goldenFlowProcessScreenshot(18, '叛徒读本正文-敌方情报可读'));
        await saveScreenshot(page, GOLDEN_FLOW_TRAITOR_READER_SCREENSHOT);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);

        const fixture = createMummyPostHauntContractFlowCore();
        await openBetrayalHotseat(page);
        await injectCore(page, fixture.core);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);
        await expect(page.getByTestId('betrayal-discovery-panel')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            currentPlayer: fixture.traitorId,
            phase: 'haunt',
            mummyRoomId: fixture.mummyStartRoomId,
            girlRoomId: fixture.sarcophagusRoomId,
            girlHeldByMummy: false,
            heroHasHolySymbol: true,
        });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟中|恶兆后|Haunt/i);
        await exerciseEventSymbolSkipAfterRoomReveal(page, {
            targetRoomId: fixture.eventTargetRoomId,
            targetRoomFloor: fixture.eventTargetRoomFloor,
        }, {
            exploreReady: goldenFlowProcessScreenshot(19, '作祟后事件符号-探索入口可见'),
            targetReady: goldenFlowProcessScreenshot(20, '事件房探索目标高亮-点击前'),
            choiceReady: goldenFlowProcessScreenshot(21, '翻出事件符号后-是否跳过事件弹窗'),
            settled: goldenFlowProcessScreenshot(22, '跳过事件后回到牌桌-无结果面板'),
        });
        await saveScreenshot(page, GOLDEN_FLOW_SKIP_EVENT_SCREENSHOT);
        await advanceByRealEndTurnsUntilActivePlayer(page, fixture.traitorId, fixture.heroTargetId);

        await switchRoomMapToFloor(page, fixture.mummyStartRoomFloor);
        await expect(page.getByTestId(`betrayal-room-monster-${fixture.mummyStartRoomId}-${MUMMY_MONSTER_ID}`)).toBeVisible();
        const monsterTurnStartAction = page.getByTestId('betrayal-action-monsterTurnStart');
        await expect(monsterTurnStartAction).toBeVisible();
        await expect(monsterTurnStartAction).toContainText('木乃伊开回合');
        await saveScreenshot(page, goldenFlowProcessScreenshot(23, '叛徒回合-木乃伊开回合入口可见'));
        await monsterTurnStartAction.click();
        const movementRollAction = page.getByTestId('betrayal-action-monsterMovementRoll');
        await expect(movementRollAction).toBeVisible();
        await expect(movementRollAction).toContainText('木乃伊移动骰');
        await saveScreenshot(page, goldenFlowProcessScreenshot(24, '木乃伊开回合后-移动骰入口可见'));
        await setHarnessRandomQueue(page, [0.5, 0.5, 0.5]);
        await movementRollAction.click();
        const movementRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(movementRollPanel).toContainText('木乃伊移动', { timeout: 30000 });
        await expect(movementRollPanel).toContainText('可移动 3 间');
        await expectVisiblePhysicalDiceBox(movementRollPanel);
        await waitForPhysicalDiceSettled(movementRollPanel);
        await saveScreenshot(page, goldenFlowProcessScreenshot(25, '木乃伊移动骰结果-三点停稳'));
        await saveScreenshot(page, GOLDEN_FLOW_MUMMY_MOVE_ROLL_SCREENSHOT);
        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            moveRemaining: 3,
            mummyRoomId: fixture.mummyStartRoomId,
        });

        await moveMummyThroughRealRoomTarget(
            page,
            { roomId: fixture.mummyStartRoomId, floor: fixture.mummyStartRoomFloor },
            { roomId: fixture.firstMoveRoomId, floor: fixture.firstMoveRoomFloor },
            { targetReady: goldenFlowProcessScreenshot(26, '木乃伊普通移动第一步-目标房间高亮') },
        );
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('消耗 1 点移动');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText('瞬移');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            mummyRoomId: fixture.firstMoveRoomId,
            moveRemaining: 2,
            girlHeldByMummy: false,
        });
        await expect(page.getByTestId('betrayal-action-monsterMove')).toBeVisible();
        await saveScreenshot(page, goldenFlowProcessScreenshot(27, '木乃伊普通移动第一步后-剩余两点'));

        await moveMummyThroughRealRoomTarget(
            page,
            { roomId: fixture.firstMoveRoomId, floor: fixture.firstMoveRoomFloor },
            { roomId: fixture.sarcophagusRoomId, floor: fixture.sarcophagusRoomFloor },
            { targetReady: goldenFlowProcessScreenshot(28, '木乃伊普通移动第二步-石棺目标高亮') },
        );
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('消耗 1 点移动');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('木乃伊拾起女孩');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText('瞬移');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            mummyRoomId: fixture.sarcophagusRoomId,
            moveRemaining: 1,
            girlHeldByMummy: true,
            heroHasHolySymbol: true,
        });
        await expect(page.getByTestId('betrayal-action-monsterMove')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-monsterAttack')).toBeVisible();
        await saveScreenshot(page, goldenFlowProcessScreenshot(29, '木乃伊普通移动第二步后-拾起女孩并可攻击'));
        await saveScreenshot(page, GOLDEN_FLOW_MUMMY_CONTINUOUS_MOVE_SCREENSHOT);

        await switchRoomMapToFloor(page, fixture.sarcophagusRoomFloor);
        const mummyToken = page.getByTestId(
            `betrayal-room-monster-${fixture.sarcophagusRoomId}-${MUMMY_MONSTER_ID}`,
        );
        const heroToken = page.getByTestId(
            `betrayal-room-occupant-${fixture.sarcophagusRoomId}-${fixture.heroTargetId}`,
        );
        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        await expect(monsterAttackAction).toContainText('木乃伊攻击');
        await page.getByTestId(`betrayal-bottom-teammate-${fixture.heroTargetId}`).click();
        await expect(page.getByTestId('betrayal-observed-inventory-zone')).toHaveCount(0);
        const observedInventory = page.getByTestId('betrayal-inventory-section');
        await expect(observedInventory).toHaveAttribute('data-observed-player', 'true');
        await expect(observedInventory).toHaveAttribute('data-player-id', fixture.heroTargetId);
        const heroInventoryHolySymbol = page.getByTestId('betrayal-inventory-holy-symbol');
        await expect(heroInventoryHolySymbol).toBeVisible();
        await expect(heroInventoryHolySymbol).toContainText('圣符');
        await expect(heroInventoryHolySymbol).toHaveAttribute('data-inventory-read-only', 'true');
        await saveScreenshot(
            page,
            goldenFlowProcessScreenshot(30, '攻击前-切换观察目标英雄后圣符可见'),
        );
        await saveScreenshot(
            page,
            goldenFlowProcessScreenshot(31, '同房后-木乃伊攻击入口可见'),
        );
        await monsterAttackAction.click();
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await saveScreenshot(page, goldenFlowProcessScreenshot(32, '木乃伊攻击-选择木乃伊攻击者'));
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');
        await saveScreenshot(page, goldenFlowProcessScreenshot(33, '木乃伊攻击-同房英雄目标高亮'));
        await setHarnessRandomQueue(page, [
            0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
            0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
        ]);
        await heroToken.click();
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toContainText('木乃伊攻击', { timeout: 30000 });
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await saveScreenshot(page, goldenFlowProcessScreenshot(34, '木乃伊攻击骰结果-可选择伤害或偷取'));
        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await expect(page.getByTestId('betrayal-mummy-reward-steal-holy-symbol')).toContainText('偷走圣符');
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            rewardPending: true,
            pendingRewardStealableCardIds: expect.arrayContaining(['holy-symbol']),
        });
        await saveScreenshot(page, goldenFlowProcessScreenshot(35, '木乃伊攻击奖励-偷圣符入口可见'));
        await saveScreenshot(page, GOLDEN_FLOW_ATTACK_REWARD_SCREENSHOT);
        await page.getByTestId('betrayal-mummy-reward-steal-holy-symbol').click();

        const endgame = page.getByTestId('betrayal-endgame-screen');
        await expect(endgame).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page, fixture.heroTargetId)).toMatchObject({
            phase: 'endgame',
            mummyRoomId: fixture.sarcophagusRoomId,
            girlHeldByMummy: true,
            heroHasHolySymbol: false,
            mummyCarriedOmenIds: expect.arrayContaining(['holy-symbol']),
            endgameOutcome: 'traitor',
        });
        await expect(endgame.getByTestId('betrayal-endgame-ending-narration')).toContainText('小女孩');
        await saveScreenshot(page, goldenFlowProcessScreenshot(36, '偷走圣符后-叛徒终局朗读'));
        await saveScreenshot(page, GOLDEN_FLOW_TRAITOR_ENDING_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-golden-traitor-flow', diagnostics }]);
    });

    test('桥接式综合候选链：叛徒读本、跳过事件、婚礼预兆、木乃伊行动、叛徒终局', async ({ page, context }) => {
        test.setTimeout(240000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-bridged-candidate-chain');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);

        const readerCore = createFirstScenarioHauntRuntimeCore();
        const traitorId = readerCore.scenarioRuntime.traitorPlayerId;
        expect(traitorId, '桥接式综合候选链必须能识别叛徒视角').toBeTruthy();
        await openBetrayalAsPlayer(page, traitorId!);
        await injectCore(page, readerCore);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        const traitorReader = page.getByTestId('betrayal-scenario-reader-dialog');
        await expect(traitorReader).toBeVisible({ timeout: 30000 });
        await expect(traitorReader.getByTestId('betrayal-scenario-objective-page')).toHaveAttribute(
            'data-scenario-reader-scope',
            'traitor',
        );
        await expect(traitorReader.getByTestId('betrayal-scenario-reader-role')).toContainText('你是叛徒：叛徒剧本书');
        await traitorReader.getByTestId('betrayal-scenario-reader-next-zone').click();
        await expect(traitorReader.getByTestId('betrayal-scenario-book-section-traitor')).toContainText('敌方情报 / 胜利条件');
        await expect(traitorReader.getByTestId('betrayal-scenario-book-section-heroes')).toHaveCount(0);
        await saveScreenshot(page, BRIDGED_CANDIDATE_TRAITOR_READER_SCREENSHOT);
        await closeScenarioReaderIfPresent(page);

        const eventExploreFixture = createTraitorHauntExploreRuntimeCore();
        await injectCore(page, eventExploreFixture.core);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await exerciseEventSymbolSkipAfterRoomReveal(page, {
            targetRoomId: eventExploreFixture.targetRoomId,
            targetRoomFloor: eventExploreFixture.targetRoomFloor,
        }, {
            choiceReady: BRIDGED_CANDIDATE_SKIP_EVENT_SCREENSHOT,
        });
        const omenExploreFixture = createMummyBridgedCandidateWeddingOmenCore();
        await injectCore(page, omenExploreFixture.core);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-explore')).toContainText('探索');
        await page.getByTestId('betrayal-action-explore').click();
        await switchRoomMapToFloor(page, omenExploreFixture.targetRoomFloor);
        await expect(page.getByTestId(`betrayal-room-explore-target-${omenExploreFixture.targetRoomId}`)).toBeVisible();
        await page.getByTestId(`betrayal-room-${omenExploreFixture.targetRoomId}`).click();
        await confirmPendingRoomPlacement(page);
        const omenDiscoveryPanel = page.getByTestId('betrayal-discovery-panel');
        await expect(omenDiscoveryPanel).toBeVisible({ timeout: 30000 });
        await expect(omenDiscoveryPanel).toHaveAttribute('aria-label', new RegExp(`预兆牌 ${omenExploreFixture.expectedCardName}`));
        await expect(page.getByTestId('betrayal-discovery-detail')).toContainText('叛徒首次需要预兆');
        await expect(omenDiscoveryPanel).toContainText('已加入持有区');
        await expect.poll(() => page.evaluate(() => {
            const core = (window as Window & {
                __BG_TEST_HARNESS__?: { state?: { get?: () => { core: {
                    currentExplorer: { inventory: Array<{ id: string; name?: string }> };
                    latestDiscovery?: { title?: string } | null;
                } } } };
            }).__BG_TEST_HARNESS__!.state!.get!().core;
            return {
                inventoryCards: core.currentExplorer.inventory.map((card) => ({ id: card.id, name: card.name ?? null })),
                latestDiscoveryTitle: core.latestDiscovery?.title ?? null,
            };
        })).toMatchObject({
            inventoryCards: expect.arrayContaining([
                expect.objectContaining({ name: omenExploreFixture.expectedCardName }),
            ]),
            latestDiscoveryTitle: omenExploreFixture.expectedCardName,
        });
        await saveScreenshot(page, BRIDGED_CANDIDATE_FORCED_WEDDING_OMEN_SCREENSHOT);

        const moveFixture = createMummyNormalContinuousMoveCore();
        await injectCore(page, moveFixture.core);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await switchRoomMapToFloor(page, moveFixture.sourceRoomFloor);
        await expect(page.getByTestId(`betrayal-room-monster-${moveFixture.sourceRoomId}-${MUMMY_MONSTER_ID}`)).toBeVisible();
        await page.getByTestId('betrayal-action-monsterTurnStart').click();
        await expect(page.getByTestId('betrayal-action-monsterMovementRoll')).toContainText('木乃伊移动骰');
        await setHarnessRandomQueue(page, [0.5, 0.5, 0.5]);
        await page.getByTestId('betrayal-action-monsterMovementRoll').click();
        const movementRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(movementRollPanel).toContainText('木乃伊移动', { timeout: 30000 });
        await expect(movementRollPanel).toContainText('可移动 3 间');
        await expectVisiblePhysicalDiceBox(movementRollPanel);
        await waitForPhysicalDiceSettled(movementRollPanel);
        await saveScreenshot(page, BRIDGED_CANDIDATE_MUMMY_MOVE_ROLL_SCREENSHOT);
        await page.getByTestId('betrayal-roll-continue').click();
        await expect.poll(() => readMummyActionState(page)).toMatchObject({ moveRemaining: 3 });
        await moveMummyThroughRealRoomTarget(
            page,
            { roomId: moveFixture.sourceRoomId, floor: moveFixture.sourceRoomFloor },
            { roomId: moveFixture.firstRoomId, floor: moveFixture.firstRoomFloor },
        );
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            mummyRoomId: moveFixture.firstRoomId,
            moveRemaining: 2,
        });
        await moveMummyThroughRealRoomTarget(
            page,
            { roomId: moveFixture.firstRoomId, floor: moveFixture.firstRoomFloor },
            { roomId: moveFixture.secondRoomId, floor: moveFixture.secondRoomFloor },
        );
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('消耗 1 点移动');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText('瞬移');
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            mummyRoomId: moveFixture.secondRoomId,
            moveRemaining: 1,
        });
        await saveScreenshot(page, BRIDGED_CANDIDATE_MUMMY_MOVE_STEP_SCREENSHOT);

        const attackFixture = createMummyNonFatalDamageReadyCore();
        await injectCore(page, attackFixture.core);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await switchRoomMapToFloor(page, attackFixture.mummyRoomFloor);
        const mummyToken = page.getByTestId(`betrayal-room-monster-${attackFixture.mummyRoomId}-${MUMMY_MONSTER_ID}`);
        const heroToken = page.getByTestId(`betrayal-room-occupant-${attackFixture.mummyRoomId}-${attackFixture.heroTargetId}`);
        await expect(page.getByTestId('betrayal-action-monsterAttack')).toContainText('木乃伊攻击');
        await page.getByTestId('betrayal-action-monsterAttack').click();
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await mummyToken.click();
        await expect(heroToken).toHaveAttribute('data-direct-target', 'true');
        await setHarnessRandomQueue(page, [
            0.5, 0.5, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
            0.01, 0.01, 0.01, 0.01,
        ]);
        await heroToken.click();
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toContainText('木乃伊攻击', { timeout: 30000 });
        await waitForPhysicalDiceSettled(attackRollPanel);
        await expect(attackRollPanel).toContainText('伤害或偷取');
        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-mummy-reward-banner')).toContainText('木乃伊：伤害或偷取');
        await expect(page.getByTestId('betrayal-mummy-reward-steal-map')).toContainText('偷走地图');
        await saveScreenshot(page, BRIDGED_CANDIDATE_ATTACK_REWARD_SCREENSHOT);
        await page.getByTestId('betrayal-mummy-reward-steal-map').click();
        await expect.poll(() => readMummyActionState(page, attackFixture.heroTargetId)).toMatchObject({
            heroHasMap: false,
            rewardPending: false,
        });

        const victoryFixture = createMummyBridgedCandidateTraitorVictoryCore();
        await injectCore(page, victoryFixture.core);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await switchRoomMapToFloor(page, victoryFixture.traitorRoomFloor);
        const girlToken = page.getByTestId(`betrayal-room-haunt-token-${victoryFixture.traitorRoomId}-mummy-girl-token`);
        await expect(girlToken).toHaveAttribute('data-token-status', 'placed');
        await expect(page.getByTestId('betrayal-action-use')).toContainText('拾起女孩');
        await page.getByTestId('betrayal-action-use').click();
        await expect(girlToken).toHaveAttribute('data-token-status', 'held-by-player');
        await expect(page.getByTestId('betrayal-action-use')).toContainText('交出女孩');
        await page.getByTestId('betrayal-action-use').click();
        await expect(girlToken).toHaveAttribute('data-token-status', 'held-by-mummy');
        await expect(page.getByTestId('betrayal-action-use')).toContainText('交出圣符');
        await saveScreenshot(page, BRIDGED_CANDIDATE_GIRL_GIVEN_SCREENSHOT);
        await page.getByTestId('betrayal-action-use').click();
        const endgame = page.getByTestId('betrayal-endgame-screen');
        await expect(endgame).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            phase: 'endgame',
            girlHeldByMummy: true,
            mummyCarriedOmenIds: expect.arrayContaining(['holy-symbol']),
            endgameOutcome: 'traitor',
        });
        await expect(endgame.getByTestId('betrayal-endgame-ending-narration')).toContainText('小女孩');
        await saveScreenshot(page, BRIDGED_CANDIDATE_TRAITOR_ENDING_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-bridged-candidate-chain', diagnostics }]);
    });

    test('current-scope 候选链：叛徒读本、跳过事件、木乃伊3点普通连续移动', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-current-scope-candidate-chain');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);

        const readerCore = createFirstScenarioHauntRuntimeCore();
        const traitorId = readerCore.scenarioRuntime.traitorPlayerId;
        expect(traitorId, 'current-scope 候选链必须能识别叛徒视角').toBeTruthy();
        await openBetrayalAsPlayer(page, traitorId!);
        await injectCore(page, readerCore);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });

        const revealCue = page.getByTestId('betrayal-haunt-reveal-cue');
        if (await revealCue.isVisible({ timeout: 1000 }).catch(() => false)) {
            await expect(page.getByTestId('betrayal-haunt-reveal-viewer-role')).toContainText('你是叛徒');
        }
        const traitorReader = page.getByTestId('betrayal-scenario-reader-dialog');
        await expect(traitorReader).toBeVisible({ timeout: 30000 });
        await expect(
            traitorReader.getByTestId('betrayal-scenario-objective-page'),
        ).toHaveAttribute('data-scenario-reader-scope', 'traitor');
        await expect(
            traitorReader.getByTestId('betrayal-scenario-reader-role'),
        ).toContainText('你是叛徒：叛徒剧本书');
        await traitorReader.getByTestId('betrayal-scenario-reader-next-zone').click();
        await expect(traitorReader.getByTestId('betrayal-scenario-book')).toBeVisible({ timeout: 30000 });
        await expect(
            traitorReader.getByTestId('betrayal-scenario-book-section-traitor'),
        ).toContainText('敌方情报 / 胜利条件');
        await expect(
            traitorReader.getByTestId('betrayal-scenario-book-section-traitor'),
        ).toContainText('他们妄图将木乃伊驱逐回亡者之国');
        await expect(
            traitorReader.getByTestId('betrayal-scenario-book-section-heroes'),
        ).toHaveCount(0);
        await saveScreenshot(page, CURRENT_SCOPE_CANDIDATE_TRAITOR_READER_SCREENSHOT);
        await closeScenarioReaderIfPresent(page);

        const exploreFixture = createTraitorHauntExploreRuntimeCore();
        await injectCore(page, exploreFixture.core);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟中|恶兆后|Haunt/i);
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            currentPlayer: exploreFixture.traitorId,
            phase: 'haunt',
        });
        await exerciseEventSymbolSkipAfterRoomReveal(page, {
            targetRoomId: exploreFixture.targetRoomId,
            targetRoomFloor: exploreFixture.targetRoomFloor,
        }, {
            choiceReady: CURRENT_SCOPE_CANDIDATE_SKIP_EVENT_SCREENSHOT,
        });
        const afterSkippedEvent = await page.evaluate(() => {
            const core = (window as Window & {
                __BG_TEST_HARNESS__?: { state?: { get?: () => { core: {
                    eventOrder: Array<{ name: string }>;
                    discardCounts: { event: number };
                    recentRoll: null | { kind: string };
                    currentExplorer: { roomId: string };
                } } } };
            }).__BG_TEST_HARNESS__!.state!.get!().core;
            return {
                eventOrder: core.eventOrder.map((event) => event.name),
                eventDiscardCount: core.discardCounts.event,
                recentRollKind: core.recentRoll?.kind ?? null,
                currentExplorerRoomId: core.currentExplorer.roomId,
            };
        });
        expect(afterSkippedEvent).toMatchObject({
            eventOrder: ['阴影扑面'],
            eventDiscardCount: 0,
            recentRollKind: null,
            currentExplorerRoomId: exploreFixture.targetRoomId,
        });
        const moveFixture = createMummyNormalContinuousMoveCore();
        await injectCore(page, moveFixture.core);
        await closeScenarioReaderIfPresent(page);
        await dismissHauntRevealIfPresent(page);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await switchRoomMapToFloor(page, moveFixture.sourceRoomFloor);
        await expect(page.getByTestId(`betrayal-room-monster-${moveFixture.sourceRoomId}-${MUMMY_MONSTER_ID}`)).toBeVisible();
        await expect(page.getByTestId(`betrayal-room-occupant-${moveFixture.sourceRoomId}-${moveFixture.traitorId}`)).toBeVisible();
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            currentPlayer: moveFixture.traitorId,
            mummyRoomId: moveFixture.sourceRoomId,
            moveRemaining: null,
        });

        const monsterTurnStartAction = page.getByTestId('betrayal-action-monsterTurnStart');
        await expect(monsterTurnStartAction).toBeVisible();
        await expect(monsterTurnStartAction).toContainText('木乃伊开回合');
        await monsterTurnStartAction.click();
        const movementRollAction = page.getByTestId('betrayal-action-monsterMovementRoll');
        await expect(movementRollAction).toBeVisible();
        await expect(movementRollAction).toContainText('木乃伊移动骰');
        await setHarnessRandomQueue(page, [0.5, 0.5, 0.5]);
        await movementRollAction.click();
        const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toBeVisible();
        await expect(rollPanel).toContainText('木乃伊移动');
        await expect(rollPanel).toContainText('可移动 3 间');
        await expectVisiblePhysicalDiceBox(rollPanel);
        await waitForPhysicalDiceSettled(rollPanel);
        await saveScreenshot(page, CURRENT_SCOPE_CANDIDATE_NORMAL_MOVE_ROLL_SCREENSHOT);
        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page)).toMatchObject({ moveRemaining: 3 });

        await moveMummyThroughRealRoomTarget(
            page,
            { roomId: moveFixture.sourceRoomId, floor: moveFixture.sourceRoomFloor },
            { roomId: moveFixture.firstRoomId, floor: moveFixture.firstRoomFloor },
        );
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('消耗 1 点移动');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText('瞬移');
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            mummyRoomId: moveFixture.firstRoomId,
            moveRemaining: 2,
        });
        await expect(page.getByTestId('betrayal-action-monsterMove')).toBeVisible();
        await saveScreenshot(page, CURRENT_SCOPE_CANDIDATE_NORMAL_MOVE_FIRST_STEP_SCREENSHOT);

        await moveMummyThroughRealRoomTarget(
            page,
            { roomId: moveFixture.firstRoomId, floor: moveFixture.firstRoomFloor },
            { roomId: moveFixture.secondRoomId, floor: moveFixture.secondRoomFloor },
        );
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('消耗 1 点移动');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText('瞬移');
        await expect.poll(() => readMummyActionState(page)).toMatchObject({
            mummyRoomId: moveFixture.secondRoomId,
            moveRemaining: 1,
        });
        await saveScreenshot(page, CURRENT_SCOPE_CANDIDATE_NORMAL_MOVE_SECOND_STEP_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-current-scope-candidate-chain', diagnostics }]);
    });

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
        await expectVisiblePhysicalDiceBox(rollPanel);
        await waitForPhysicalDiceSettled(rollPanel);
        await expect(rollPanel.getByTestId('betrayal-house-dice-physics-source')).toHaveAttribute('data-dice-settled', 'true');
        await expect(rollPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-physics-ready', 'true');
        await expect(rollPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-preload-state', 'none');
        await expectRollContinueButtonUsable(page);
        await saveScreenshot(page, MOVE_ROLL_SCREENSHOT);

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动木乃伊');
        await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-explore')).toHaveCount(0);
        const mummyToken = await expectMonsterMoveActionFocusesMummy(page, fixture);
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
        await expectVisiblePhysicalDiceBox(rollPanel);
        await waitForPhysicalDiceSettled(rollPanel);
        await expect(rollPanel.getByTestId('betrayal-house-dice-physics-source')).toHaveAttribute('data-dice-settled', 'true');
        await expect(rollPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-physics-ready', 'true');
        await expect(rollPanel.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-preload-state', 'none');
        await expectRollContinueButtonUsable(page);
        await saveScreenshot(page, MOVE_ONE_ROLL_SCREENSHOT);

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await expect.poll(() => readMummyActionState(page)).toMatchObject({ moveRemaining: 1 });
        const monsterMoveAction = page.getByTestId('betrayal-action-monsterMove');
        await expect(monsterMoveAction).toBeVisible();
        await expect(monsterMoveAction).toContainText('移动木乃伊');
        await expect(page.getByTestId('betrayal-action-move')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-explore')).toHaveCount(0);
        const mummyToken = await expectMonsterMoveActionFocusesMummy(page, fixture);
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
        await expectSolidTargetOutlineFits(
            page.getByTestId(`betrayal-room-monster-target-outline-${fixture.startRoomId}-${MUMMY_MONSTER_ID}`),
            mummyToken.getByTestId(`betrayal-monster-board-token-surface-${MUMMY_MONSTER_ID}`),
            '携带女孩和圣符时木乃伊目标高亮',
            { maxCenterDelta: 3, maxSizeDelta: 4 },
        );
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
        await expect(page.getByTestId('betrayal-roll-modifier-confirm')).toHaveText('确认使用兔脚');
        await page.getByTestId('betrayal-roll-modifier-confirm').click();
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
