import { describe, expect, it } from 'vitest';
import {
    acknowledgePendingCardResolutions,
    applyBetrayalCommand,
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCorpseLootReadyCore,
    createDogTradeReadyCore,
    createExchangeReadyCore,
    createFirstScenarioHauntCore,
    createFirstScenarioReadyToExorciseCore,
    createFirstScenarioReadyToLearnAboutJackCore,
    createFirstScenarioReadyToStudyExorcismCore,
    createDustFeverishAttackReadyCore,
    createDustFeverishNaturalMonsterTurnBeforeRollCore,
    createJackSpiritReviveReadyCore,
    createJackSpiritNaturalMonsterTurnBeforeRollCore,
    createJackSpiritMovementRollReadyCore,
    createJackSpiritPostReviveAttackReadyCore,
    createFirstScenarioReadyToTraitorVictoryCore,
    createStartedFirstScenarioCore,
    createTradeReadyCore,
    playFirstScenarioToSurvivorVictory,
    playFirstScenarioToTraitorVictory,
    setScenarioTestTurnMovement,
} from '../testing/firstScenarioTestUtils';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    EXPLORER_CATALOG,
    isBetrayalRoomInLineOfSight,
    resolveBetrayalMoveCost,
    resolveBetrayalLineOfSightRoomIds,
    resolveBetrayalHauntSpecialActionStatus,
    resolveBetrayalHauntTokenInstances,
    resolveBetrayalPossessionSpecialActionStatus,
    resolveBetrayalRoomSpecialActionStatus,
    resolveBetrayalTradeCardStatus,
    resolveAttackWeaponCardStatuses,
    resolveBetrayalDeathStateSummary,
    resolveBetrayalEndgameReadModel,
    resolveBetrayalHauntRisk,
    resolveBetrayalHauntRevealProtocol,
    resolveBetrayalHauntSetupCommandPreviews,
    resolveBetrayalHauntSetupProgress,
    resolveBetrayalReferenceCardAccess,
    resolveBetrayalMonsterActionPanel,
    resolveBetrayalMonsterActionSet,
    resolveBetrayalMonsterActionSets,
    resolveBetrayalNormalMonsterAttackTargets,
    createBetrayalMonsterFromDefinition,
    createBetrayalMonsterMovementRollGroupResult,
    getBetrayalMonsterDefinition,
    resolveBetrayalMonsterMovementGroups,
    resolveBetrayalMonsterMovementRollGroupPreview,
    resolveBetrayalMonsterDamageOutcome,
    resolveBetrayalMonsterMoveCost,
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterStatuses,
    resolveBetrayalMonsterTurnStartResolutionPreview,
    resolveBetrayalMonsterTurnStartStatus,
    resolveBetrayalMonsterTurnRuntimeState,
    resolveCorpseLootTargets,
    resolveBloodFromStonePeekabooOptions,
    resolveBloodFromStoneSetupPlacementPlan,
    resolveBloodFromStoneMonsterTurnEndPreview,
    resolveBloodFromStoneMonsterTurnStatus,
    resolveBetrayalNumberTracks,
    resolveBetrayalOmenCount,
    resolveBetrayalRoomDrawResolution,
    resolveBetrayalTileStackSearchPreview,
    resolveBetrayalTraitorVolunteerInteraction,
    resolveBetrayalTraitorVolunteerResolutionPreview,
    resolveBetrayalTraitorPowerStatus,
    applyBetrayalTileStackSearch,
    resolveHelpingHandsControllerPlayerId,
    resolveHelpingHandsMonsterTurnStatus,
    resolveHelpingHandsPendingAttackReward,
    resolveHelpingHandsTrollHandAttackOptions,
    resolveHelpingHandsTrollHandMoveOptions,
    resolveRoomTileAdjustmentOptions,
    resolveExplorableRoomSlots,
    resolveMoveTargetRooms,
    resolveRoomPlacementPreview,
    resolveUseEffect,
    type BetrayalCore,
} from '../game';
import {
    BETRAYAL_DISCOVERY_POOLS,
    BETRAYAL_SCENARIO_CARD_IDS,
    BETRAYAL_SCENARIO_CONFIGS,
    DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
    isBetrayalEventRuntimeSupported,
    type BetrayalTraitKey,
    type BetrayalUseEffectSeed,
} from '../scenarioConfig';
import { resolvePossessionAtlasVisual } from '../possessionAtlas';
import { BETRAYAL_ROOM_TILE_VISUALS } from '../roomAtlas';

function findTestExplorer(core: BetrayalCore, playerId: string) {
    const explorer = [core.currentExplorer, ...core.otherExplorers].find((candidate) => candidate.playerId === playerId);
    if (!explorer) {
        throw new Error(`山屋测试夹具缺少玩家 ${playerId}`);
    }
    return explorer;
}

function isMagicCameraTestCard(card: BetrayalCore['currentExplorer']['inventory'][number]): boolean {
    return card.id === 'camera' || card.name === '魔法相机';
}

function removeMagicCameraFromTestExplorer(
    explorer: BetrayalCore['currentExplorer'],
): BetrayalCore['currentExplorer'] {
    return {
        ...explorer,
        inventory: explorer.inventory.filter((card) => !isMagicCameraTestCard(card)),
    };
}

function activateTestExplorer(core: BetrayalCore, playerId: string): void {
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
        throw new Error(`山屋测试夹具不能切到缺失玩家 ${playerId}`);
    }
    core.currentPlayer = playerId;
    core.currentExplorer = active;
    core.otherExplorers = explorers.filter((explorer) => explorer.playerId !== playerId);
    core.activeRoomId = active.roomId;
    core.currentExplorerTraits = { ...active.traits };
    core.currentExplorerInventory = active.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = active.inventory.map((card) => card.id);
}

function activateBloodFromStoneMonsterTurn(core: BetrayalCore, controllerPlayerId = '0'): void {
    activateTestExplorer(core, controllerPlayerId);
    core.scenarioRuntime.hauntCardNumber = 5;
    core.scenarioRuntime.traitorPlayerId = null;
    core.scenarioRuntime.bloodFromStone = {
        monsterTurnAfterPlayerId: controllerPlayerId,
        activeMonsterTurn: true,
        monsterTurnControllerPlayerId: controllerPlayerId,
    };
    core.activePlayerId = controllerPlayerId;
    core.recommendedAction = 'endTurn';
}

function setTestExplorerTraits(
    core: BetrayalCore,
    playerId: string,
    traits: Partial<Record<BetrayalTraitKey, number>>,
): void {
    if (core.currentExplorer.playerId === playerId) {
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, ...traits },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        return;
    }

    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === playerId
            ? {
                ...explorer,
                traits: { ...explorer.traits, ...traits },
                inventory: [],
            }
            : explorer
    ));
}

function setTestExplorerInventory(
    core: BetrayalCore,
    playerId: string,
    inventory: BetrayalCore['currentExplorer']['inventory'],
    availableAtTurnStart = true,
): void {
    const nextInventory = inventory.map((card) => ({ ...card }));
    if (core.currentExplorer.playerId === playerId) {
        core.currentExplorer.inventory = nextInventory;
        core.currentExplorerInventory = nextInventory.map((card) => ({ ...card }));
        if (availableAtTurnStart) {
            core.turnStartInventoryCardIds = nextInventory.map((card) => card.id);
        }
        return;
    }

    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === playerId
            ? { ...explorer, inventory: nextInventory.map((card) => ({ ...card })) }
            : explorer
    ));
}

function setTestRoomDiscoveryDeck(
    core: BetrayalCore,
    deck: BetrayalCore['roomDiscoveryDeck'],
): void {
    const clonedDeck = deck.map((entry) => ({
        floor: entry.floor,
        room: {
            ...entry.room,
            tags: [...entry.room.tags],
            doorways: [...entry.room.doorways],
        },
    }));
    core.roomDiscoveryDeck = clonedDeck;
    core.roomDiscoveryOrderByFloor = {
        ground: clonedDeck.filter((entry) => entry.floor === 'ground').map((entry) => ({ ...entry.room })),
        upper: clonedDeck.filter((entry) => entry.floor === 'upper').map((entry) => ({ ...entry.room })),
        basement: clonedDeck.filter((entry) => entry.floor === 'basement').map((entry) => ({ ...entry.room })),
    };
}

function setTestTraitTrack(
    core: BetrayalCore,
    playerId: string,
    trait: BetrayalTraitKey,
    values: number[],
    position: number,
    startPosition = 3,
): void {
    const explorer = findTestExplorer(core, playerId);
    explorer.traitTracks[trait] = {
        trackId: `test-${playerId}-${trait}`,
        values: [...values],
        position,
        startPosition,
        criticalPosition: 0,
        skullPosition: -1,
        maxPosition: values.length - 1,
    };
    explorer.traits[trait] = values[position] ?? 0;
    if (core.currentExplorer.playerId === playerId) {
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
    }
}

function setHighCapacityPhysicalDamageTracks(
    core: BetrayalCore,
    playerId: string,
    value = 4,
    position = 14,
): void {
    const values = Array.from({ length: position + 2 }, () => value);
    setTestTraitTrack(core, playerId, 'might', values, position, position);
    setTestTraitTrack(core, playerId, 'speed', values, position, position);
}

function setHighCapacityGeneralDamageTracks(
    core: BetrayalCore,
    playerId: string,
    value = 4,
    position = 14,
): void {
    const values = Array.from({ length: position + 2 }, () => value);
    for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
        setTestTraitTrack(core, playerId, trait, values, position, position);
    }
}

function traitTrackPosition(core: BetrayalCore, playerId: string, trait: BetrayalTraitKey): number {
    return findTestExplorer(core, playerId).traitTracks[trait].position;
}

function traitTrackPositionTotal(
    core: BetrayalCore,
    playerId: string,
    traits: BetrayalTraitKey[],
): number {
    const explorer = findTestExplorer(core, playerId);
    return traits.reduce((total, trait) => total + explorer.traitTracks[trait].position, 0);
}

function physicalTraitTotal(core: BetrayalCore, playerId: string): number {
    const explorer = findTestExplorer(core, playerId);
    return explorer.traits.might + explorer.traits.speed;
}

function mentalTraitTotal(core: BetrayalCore, playerId: string): number {
    const explorer = findTestExplorer(core, playerId);
    return explorer.traits.knowledge + explorer.traits.sanity;
}

function repeatTraitsForPendingDamage(
    core: BetrayalCore,
    traits: BetrayalTraitKey[],
): BetrayalTraitKey[] {
    const amount = core.pendingDamageAllocation?.amount ?? 0;
    return Array.from({ length: amount }, (_, index) => traits[index % traits.length]!);
}

function acknowledgeSingleEventEffectResolution(
    core: BetrayalCore,
    cardName: string,
    expectedTextFragment: string,
): BetrayalCore {
    expect(core.pendingCardResolutionQueue).toHaveLength(1);
    expect(core.pendingCardResolutionQueue[0]).toMatchObject({
        deckKind: 'event',
        cardName,
        stepKind: 'event-effect',
        text: expect.stringContaining(expectedTextFragment),
        index: 1,
        total: 1,
    });
    expect(BetrayalDomain.validate(
        { core, sys: {} as never },
        createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, core.currentPlayer, {}),
    )).toMatchObject({
        valid: false,
        error: '请先确认当前翻牌结算。',
    });
    const nextCore = acknowledgePendingCardResolutions(core);
    expect(nextCore.pendingCardResolutionQueue).toEqual([]);
    return nextCore;
}

function acknowledgeAnyPendingCardResolutions(core: BetrayalCore): BetrayalCore {
    if (core.pendingCardResolutionQueue.length === 0) {
        return core;
    }
    const nextCore = acknowledgePendingCardResolutions(core);
    expect(nextCore.pendingCardResolutionQueue).toEqual([]);
    return nextCore;
}

type BetrayalEventDeathRiskTag = 'damage' | 'directTraitLoss';

function collectEventDeathRiskTags(
    effect: BetrayalUseEffectSeed | undefined,
    tags = new Set<BetrayalEventDeathRiskTag>(),
): Set<BetrayalEventDeathRiskTag> {
    if (!effect) {
        return tags;
    }

    switch (effect.mode) {
        case 'generalDamage':
        case 'generalDamageChoice':
        case 'rolledDamage':
            tags.add('damage');
            break;
        case 'trait':
        case 'chosenTrait':
            if (effect.amount < 0) {
                tags.add('directTraitLoss');
            }
            break;
        case 'allTraitChecks':
            if (effect.failAmount > 0) {
                tags.add('directTraitLoss');
            }
            collectEventDeathRiskTags(effect.allPassEffect, tags);
            break;
        case 'compound':
            for (const childEffect of effect.effects) {
                collectEventDeathRiskTags(childEffect, tags);
            }
            break;
        case 'optionalEventRoll':
            for (const branch of effect.roll.branches) {
                collectEventDeathRiskTags(branch.effect, tags);
            }
            break;
        case 'chooseTraitRoll':
            for (const branch of effect.branches) {
                collectEventDeathRiskTags(branch.effect, tags);
            }
            break;
        case 'optionalHauntRoll':
            collectEventDeathRiskTags(effect.failureEffect, tags);
            collectEventDeathRiskTags(effect.skippedOrStartedEffect, tags);
            break;
        default:
            break;
    }

    return tags;
}

function collectEventTemplateDeathRiskTags(event: typeof BETRAYAL_DISCOVERY_POOLS.events[number]): string[] {
    const tags = collectEventDeathRiskTags(event.effect);
    for (const branch of event.roll?.branches ?? []) {
        collectEventDeathRiskTags(branch.effect, tags);
    }
    return [...tags].sort();
}

function collectRuntimePossessionCards(): Array<BetrayalCore['currentExplorer']['inventory'][number]> {
    const cards = [
        ...BETRAYAL_DISCOVERY_POOLS.possessions.item,
        ...BETRAYAL_DISCOVERY_POOLS.possessions.omen,
        ...Object.values(BETRAYAL_SCENARIO_CONFIGS['first-scenario'].startingInventoryByExplorerId).flat(),
    ];
    const byId = new Map<string, BetrayalCore['currentExplorer']['inventory'][number]>();
    for (const card of cards) {
        if (!byId.has(card.id)) {
            byId.set(card.id, card);
        }
    }
    return [...byId.values()];
}

function createPossessionCoverageCore(): BetrayalCore {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.phase = 'haunt';
    core.currentExplorer.inventory = collectRuntimePossessionCards().map((card) => ({ ...card }));
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
    return core;
}

function setDiscoveredTestRoom(
    core: BetrayalCore,
    roomId: string,
    overrides: Partial<BetrayalCore['rooms'][number]>,
): void {
    core.rooms = core.rooms.map((room) => (
        room.id === roomId
            ? {
                ...room,
                state: 'discovered',
                ...overrides,
            }
            : room
    ));
}

function placeActiveTestExplorerInRoom(core: BetrayalCore, playerId: string, roomId: string): void {
    activateTestExplorer(core, playerId);
    core.currentExplorer.roomId = roomId;
    core.activeRoomId = roomId;
    core.turnEndedByDiscovery = false;
    core.pendingEventChoice = null;
    core.pendingDamageAllocation = null;
    core.recentRoll = null;
}

function createOpenFrontierHauntTestCore(activePlayerId: string): BetrayalCore {
    const core = createStartedFirstScenarioCore(['0', '1', '2', '3']);
    core.phase = 'haunt';
    core.scenarioRuntime.hauntTriggered = true;
    core.scenarioRuntime.hauntRevealerPlayerId = '0';
    core.scenarioRuntime.traitorPlayerId = '2';
    core.scenarioRuntime.nextHauntPlayerId = activePlayerId;
    core.scenarioRuntime.hauntCardNumber = 1;
    core.scenarioRuntime.hauntTriggerLabel = '测试作祟';
    core.scenarioRuntime.hauntScenarioCardId = DEFAULT_BETRAYAL_SCENARIO_CARD_ID;
    core.scenarioRuntime.hauntScenarioCardTitle = '赤红杰克归来';
    core.scenarioRuntime.hauntScenarioCardLabel = '作祟 1';
    core.scenarioRuntime.triggeringOmenName = '测试恶兆';
    placeActiveTestExplorerInRoom(core, activePlayerId, 'entrance-hall');
    setScenarioTestTurnMovement(core, 6);
    return core;
}

function lethalTraitsForPendingDamage(core: BetrayalCore, lethalTrait: BetrayalTraitKey): BetrayalTraitKey[] {
    const pending = core.pendingDamageAllocation;
    if (!pending) {
        throw new Error('expected pending damage allocation');
    }
    const explorer = findTestExplorer(core, pending.playerId);
    const orderedTraits = [
        lethalTrait,
        ...pending.allowedTraits.filter((trait) => trait !== lethalTrait),
    ];
    const traits: BetrayalTraitKey[] = [];
    let remaining = pending.amount;
    for (const trait of orderedTraits) {
        if (remaining <= 0) {
            break;
        }
        const track = explorer.traitTracks[trait];
        const floorPosition = pending.allowSkull ? track.skullPosition : track.criticalPosition;
        const assignableSteps = Math.max(0, track.position - floorPosition);
        const take = Math.min(remaining, assignableSteps);
        traits.push(...Array.from({ length: take }, () => trait));
        remaining -= take;
    }
    return traits;
}

function createDustHauntCore(playerIds: string[] = ['0', '1', '2']): BetrayalCore {
    let core = createStartedFirstScenarioCore(playerIds);
    core.drawOrder = ['event'];
    core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一瓶微尘')!];
    core.currentExplorer.inventory = [
        ...core.currentExplorer.inventory,
        { id: 'omen-book', name: '书本', kind: 'omen' },
        { id: 'dog', name: '狗', kind: 'omen' },
        { id: 'mask', name: '面具', kind: 'omen' },
    ];
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
    core = applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
        '0',
        { accept: true },
        100,
        createBetrayalScriptedRandom(3, 3, 3),
    );
    return acknowledgePendingCardResolutions(core);
}

function createFeverishControlReadyCore(): BetrayalCore {
    const core = createDustHauntCore();
    const playerId = '0';
    activateTestExplorer(core, playerId);
    core.currentExplorer.roomId = 'hallway';
    core.activeRoomId = 'hallway';
    core.scenarioRuntime.deadExplorerPlayerIds = Array.from(new Set([
        ...core.scenarioRuntime.deadExplorerPlayerIds,
        playerId,
    ]));
    core.scenarioRuntime.dust!.permanentTraitorPlayerIds = Array.from(new Set([
        ...core.scenarioRuntime.dust!.permanentTraitorPlayerIds,
        playerId,
    ]));
    core.scenarioRuntime.dust!.feverishPlayerIds = Array.from(new Set([
        ...core.scenarioRuntime.dust!.feverishPlayerIds,
        playerId,
    ]));
    core.currentExplorer.inventory = [
        { id: 'medical-kit', name: '急救包', kind: 'item' },
        { id: 'rope', name: '兔脚', kind: 'item' },
    ];
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
    core.monsters = [
        ...core.monsters.filter((monster) => monster.id !== `feverish-${playerId}`),
        {
            id: `feverish-${playerId}`,
            name: '狂热病患',
            portraitAsset: 'betrayal/monsters/spirit',
            roomId: core.currentExplorer.roomId,
            might: 6,
            speed: 5,
            sanity: 3,
            knowledge: 3,
            damage: 1,
        },
    ];
    setScenarioTestTurnMovement(core, 2);
    return core;
}

function createMagicCameraHauntCore(cameraOwnerPlayerId: string | null = '1'): BetrayalCore {
    let core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.drawOrder = ['event'];
    core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '说“茄子”！')!];
    core.currentExplorer = removeMagicCameraFromTestExplorer(core.currentExplorer);
    core.otherExplorers = core.otherExplorers.map(removeMagicCameraFromTestExplorer);
    core.currentExplorer.inventory = [
        ...core.currentExplorer.inventory,
        { id: 'omen-book', name: '书本', kind: 'omen' },
        { id: 'dog', name: '狗', kind: 'omen' },
        { id: 'mask', name: '面具', kind: 'omen' },
    ];
    if (cameraOwnerPlayerId === '0') {
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'camera', name: '魔法相机', kind: 'item' },
        ];
    }
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.otherExplorers = core.otherExplorers.map((explorer) => {
        if (explorer.playerId === cameraOwnerPlayerId) {
            return { ...explorer, inventory: [...explorer.inventory, { id: 'camera', name: '魔法相机', kind: 'item' }] };
        }
        return explorer;
    });
    if (!cameraOwnerPlayerId) {
        core.possessionOrderByKind.item = [
            { id: 'camera', name: '魔法相机', kind: 'item' },
            ...core.possessionOrderByKind.item.filter((card) => card.id !== 'camera'),
        ];
    }

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
    core = applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
        '0',
        { accept: true },
        100,
        createBetrayalScriptedRandom(3, 3, 3),
    );
    return acknowledgePendingCardResolutions(core);
}

function createHelpingHandsHauntCore(playerIds: string[] = ['0', '1', '2']): BetrayalCore {
    let core = createStartedFirstScenarioCore(playerIds);
    core.drawOrder = ['event'];
    core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
    core.currentExplorer.inventory = [
        ...core.currentExplorer.inventory,
        { id: 'omen-book', name: '书本', kind: 'omen' },
        { id: 'dog', name: '狗', kind: 'omen' },
        { id: 'mask', name: '面具', kind: 'omen' },
    ];
    core.currentExplorer.traits.might = 4;
    core.currentExplorer.traits.speed = 4;
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
    core = applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
        '0',
        { accept: true },
        100,
        createBetrayalScriptedRandom(3, 3, 3),
    );
    return acknowledgePendingCardResolutions(core);
}

function discoverBloodFromStoneOutOfSightTestRooms(core: BetrayalCore): void {
    setDiscoveredTestRoom(core, 'ground-north', {
        name: '北侧房间',
        hint: '顽石之血 setup 测试用视线外房间。',
        tags: ['测试', '一层'],
        discoveryReward: null,
        visualId: 'study',
    });
    setDiscoveredTestRoom(core, 'ground-south', {
        name: '南侧房间',
        hint: '顽石之血 setup 测试用视线外房间。',
        tags: ['测试', '一层'],
        discoveryReward: null,
        visualId: 'gallery',
    });
}

function seedBloodFromStoneTrigger(core: BetrayalCore): void {
    core.proposedScenarioCardId = 'blood-from-a-stone';
    core.drawOrder = ['omen'];
    core.possessionOrderByKind.omen = [
        { id: 'mask', name: 'Mask', kind: 'omen' },
    ];
    core.currentExplorer.inventory = [
        { id: 'omen-book', name: '书本', kind: 'omen' },
        { id: 'dog', name: '狗', kind: 'omen' },
        { id: 'skull', name: '头骨', kind: 'omen' },
        { id: 'ring', name: '指环', kind: 'omen' },
    ];
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
}

function createBloodFromStoneTriggeredWithAutoPlacementCore(): BetrayalCore {
    let core = createStartedFirstScenarioCore(['0', '1', '2']);
    discoverBloodFromStoneOutOfSightTestRooms(core);
    seedBloodFromStoneTrigger(core);

    core = applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.EXPLORE_ROOM,
        '0',
        { roomId: 'ground-east' },
        100,
        createBetrayalScriptedRandom(3, 3, 3, 3, 3),
    );

    return acknowledgePendingCardResolutions(core);
}

function createBloodFromStoneManualPlacementGapCore(): BetrayalCore {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    seedBloodFromStoneTrigger(core);
    core.rooms = core.rooms.map((room) => (
        room.id === 'upper-west'
            ? {
                ...room,
                state: 'unexplored',
                name: '未探索',
            }
            : room
    ));
    core.phase = 'haunt';
    core.scenarioRuntime.hauntTriggered = true;
    core.scenarioRuntime.hauntCardNumber = 5;
    core.scenarioRuntime.hauntRevealerPlayerId = '0';
    core.scenarioRuntime.traitorPlayerId = null;
    core.scenarioRuntime.hauntTraitorResolution = {
        hauntCardNumber: 5,
        policy: 'no-traitor',
        traitorPlayerId: null,
        teamModel: 'no-traitor',
        reasonLabel: '无叛徒',
        candidatePlayerIds: [],
        excludedPlayerIds: [],
        tieBreak: 'none',
        representativeOnly: false,
    };
    core.scenarioRuntime.hauntFirstPlayerResolution = {
        hauntCardNumber: 5,
        policy: 'left-of-revealer',
        anchorPlayerId: '0',
        nextPlayerId: '1',
        reasonLabel: '作祟揭秘者左侧玩家先行动',
        representativeOnly: false,
    };
    core.scenarioRuntime.nextHauntPlayerId = '1';
    core.scenarioRuntime.hauntSetupQueue = [];
    core.scenarioRuntime.hauntResolutionRepresentativeOnly = false;
    return core;
}

function createBloodFromStoneMultiGapManualPlacementCore(): BetrayalCore {
    const core = createBloodFromStoneManualPlacementGapCore();
    core.rooms = core.rooms.map((room) => (
        room.id === 'basement-landing'
            ? {
                ...room,
                state: 'unexplored',
                name: '未探索',
            }
            : room
    ));
    return core;
}

function createHelpingHandsExplorerAttackCore(): BetrayalCore {
    const core = createHelpingHandsHauntCore();
    activateTestExplorer(core, '0');
    const sharedRoomId = core.currentExplorer.roomId;
    const defender = findTestExplorer(core, '1');
    defender.roomId = sharedRoomId;
    defender.inventory = [
        { id: 'first-aid-kit', name: '急救包', kind: 'item' },
        { id: 'omen-skull', name: '头骨', kind: 'omen' },
    ];
    setTestTraitTrack(core, '0', 'might', [1, 2, 3], 1, 1);
    setTestTraitTrack(core, '0', 'sanity', [1, 2, 3], 1, 1);
    for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
        setTestTraitTrack(core, '1', trait, [1, 2, 2, 2, 2, 2], 4, 4);
    }
    core.activeRoomId = sharedRoomId;
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
    return core;
}

function startHelpingHandsMonsterTurn(
    core: BetrayalCore,
    random = createBetrayalScriptedRandom(1, 2, 3),
): BetrayalCore {
    activateTestExplorer(core, '0');
    return applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.END_TURN,
        '0',
        {},
        100,
        random,
    );
}
function placeCurrentExplorerInDustResearchRoom(
    core: BetrayalCore,
    discoveryReward: BetrayalCore['rooms'][number]['discoveryReward'] = 'omen',
): BetrayalCore {
    const roomId = 'ground-north';
    core.currentExplorer.roomId = roomId;
    core.activeRoomId = roomId;
    core.rooms = core.rooms.map((room) => (
        room.id === roomId
            ? {
                ...room,
                state: 'discovered',
                name: '实验室',
                hint: '灰尘剧本测试研究板块',
                tags: ['研究'],
                discoveryReward,
                visualId: 'laboratory',
            }
            : room
    ));
    return core;
}

function seedDustFailedActionExchangeTokens(core: BetrayalCore): void {
    if (!core.scenarioRuntime.dust) {
        throw new Error('灰尘失败行动交换测试缺少 dust 运行态');
    }
    core.scenarioRuntime.dust.sicknessTokensByPlayerId = {
        '0': [
            { id: 'sickness-0-a', value: 7 },
            { id: 'sickness-0-b', value: 8 },
            { id: 'sickness-0-c', value: 9 },
        ],
        '1': [
            { id: 'sickness-1-a', value: 4 },
            { id: 'sickness-1-b', value: 5 },
            { id: 'sickness-1-c', value: 6 },
        ],
        '2': [
            { id: 'sickness-2-a', value: 12 },
            { id: 'sickness-2-b', value: 13 },
            { id: 'sickness-2-c', value: 14 },
        ],
        '3': [
            { id: 'sickness-3-a', value: 1 },
            { id: 'sickness-3-b', value: 10 },
            { id: 'sickness-3-c', value: 11 },
        ],
    };
    core.scenarioRuntime.dust.permanentTraitorPlayerIds = ['3'];
    core.scenarioRuntime.dust.exchangedSicknessThisTurnPlayerIds = [];
    core.scenarioRuntime.dust.pendingSicknessExchange = undefined;
    core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
    core.currentExplorer.roomId = 'ground-north';
    core.activeRoomId = 'ground-north';
    core.otherExplorers = core.otherExplorers.map((explorer) => {
        if (explorer.playerId === '0') {
            return { ...explorer, roomId: 'entrance-hall' };
        }
        if (explorer.playerId === '2') {
            return { ...explorer, roomId: 'hallway' };
        }
        if (explorer.playerId === '3') {
            return { ...explorer, roomId: 'upper-landing' };
        }
        return explorer;
    });
}

function seedDustControlImpulsesTokens(core: BetrayalCore): void {
    if (!core.scenarioRuntime.dust) {
        throw new Error('灰尘控制冲动测试缺少 dust 运行态');
    }
    activateTestExplorer(core, '1');
    core.currentExplorer.roomId = 'hallway';
    core.activeRoomId = 'hallway';
    core.otherExplorers = core.otherExplorers.map((explorer) => {
        if (explorer.playerId === '0') {
            return { ...explorer, roomId: 'hallway' };
        }
        return { ...explorer, roomId: 'entrance-hall' };
    });
    core.scenarioRuntime.dust.sicknessTokensByPlayerId = {
        '0': [
            { id: 'sickness-0-a', value: 1 },
            { id: 'sickness-0-b', value: 7 },
            { id: 'sickness-0-c', value: 8 },
        ],
        '1': [
            { id: 'sickness-1-a', value: 4 },
            { id: 'sickness-1-b', value: 5 },
            { id: 'sickness-1-c', value: 6 },
        ],
        '2': [
            { id: 'sickness-2-a', value: 9 },
            { id: 'sickness-2-b', value: 10 },
            { id: 'sickness-2-c', value: 11 },
        ],
    };
    core.scenarioRuntime.dust.permanentTraitorPlayerIds = ['0'];
    core.scenarioRuntime.dust.exchangedSicknessThisTurnPlayerIds = [];
    core.scenarioRuntime.dust.pendingSicknessExchange = undefined;
    core.scenarioRuntime.deadExplorerPlayerIds = [];
}

describe('Betrayal first scenario runtime', () => {
    it('设置阶段必须从五张剧本卡候选中提议并确认，可运行规则未接入的剧本不能开局', () => {
        let core = BetrayalDomain.setup(['0', '1', '2'], BETRAYAL_FIXED_RANDOM);
        expect(core.scenarioCandidateIds).toEqual([...BETRAYAL_SCENARIO_CARD_IDS]);
        expect(core.scenarioCandidateIds).toHaveLength(5);
        expect(core.proposedScenarioCardId).toBe(DEFAULT_BETRAYAL_SCENARIO_CARD_ID);
        expect(core.scenarioCardConfirmations).toEqual({});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '1', { explorerId: 'rebecca-allen' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '1', {});

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前剧本卡。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD, '0', {
            candidateId: 'friends-forever',
        });
        expect(core.proposedScenarioCardId).toBe('friends-forever');
        expect(core.scenarioCardConfirmations).toEqual({});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        expect(core.scenarioCardConfirmations).toEqual({ '0': 'friends-forever' });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前剧本卡。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '1', {});
        expect(core.scenarioCardConfirmations).toEqual({
            '0': 'friends-forever',
            '1': 'friends-forever',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '所选剧本卡的运行时规则尚未接入，不能开始剧本。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD, '0', {
            candidateId: DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
        });
        expect(core.scenarioCardConfirmations).toEqual({});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前剧本卡。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', {});

        expect(core.phase).toBe('preHaunt');
        expect(core.scenarioId).toBe('first-scenario');
    });

    it('回合开始按速度锁定移动力，回合中速度变化不刷新本回合移动力', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 2);
        setTestTraitTrack(core, '1', 'speed', [1, 2, 3, 4, 5], 4);
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
            ],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        setScenarioTestTurnMovement(core, core.currentExplorer.traits.speed);

        expect(core.turnStartSpeed).toBe(3);
        expect(core.movesRemaining).toBe(3);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        expect(core.movesRemaining).toBe(2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'holy-water' });

        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.turnStartSpeed).toBe(3);
        expect(core.movesRemaining).toBe(2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.turnStartSpeed).toBe(5);
        expect(core.movesRemaining).toBe(5);
    });

    it('普通移动只允许门位直连，几何相邻但无连接门位不能移动', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });

        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('grand-staircase');

        core.rooms = core.rooms.map((room) => {
            if (room.id === 'hallway') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'grand-staircase'),
                };
            }
            if (room.id === 'grand-staircase') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'hallway'),
                };
            }
            return room;
        });

        expect(resolveMoveTargetRooms(core).map((room) => room.id)).not.toContain('grand-staircase');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' }),
        )).toMatchObject({
            valid: false,
            error: '目标房间不可移动。',
        });
    });

    it('基础视线只覆盖同楼层同一直线的连续已发现房间', () => {
        const core = createStartedFirstScenarioCore();

        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'hallway')).toBe(true);
        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'entrance-hall')).toBe(true);
        expect(isBetrayalRoomInLineOfSight(core, 'entrance-hall', 'grand-staircase')).toBe(true);
        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'upper-landing')).toBe(false);
        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'basement-landing')).toBe(false);
        expect(isBetrayalRoomInLineOfSight(core, 'upper-landing', 'upper-west')).toBe(true);
        expect(isBetrayalRoomInLineOfSight(core, 'entrance-hall', 'ground-east')).toBe(false);

        const visibleFromStaircase = resolveBetrayalLineOfSightRoomIds(core, 'grand-staircase');
        expect(visibleFromStaircase).toEqual(expect.arrayContaining([
            'grand-staircase',
            'hallway',
            'entrance-hall',
        ]));
        expect(visibleFromStaircase).not.toContain('upper-landing');
        expect(visibleFromStaircase).not.toContain('basement-landing');

        const interruptedLineCore: BetrayalCore = {
            ...core,
            rooms: core.rooms.map((room) => (
                room.id === 'hallway'
                    ? { ...room, state: 'unexplored' as const }
                    : room
            )),
        };
        expect(isBetrayalRoomInLineOfSight(interruptedLineCore, 'grand-staircase', 'entrance-hall')).toBe(false);
        expect(resolveBetrayalLineOfSightRoomIds(interruptedLineCore, 'grand-staircase')).not.toContain('entrance-hall');
    });

    it('属性提升移动属性轨夹子，重复数值位置提升但当前值不一定变化', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'speed', [1, 3, 3, 4, 5], 1);
        const speedBefore = core.currentExplorer.traits.speed;
        const positionBefore = core.currentExplorer.traitTracks.speed.position;
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '测试速度奖励',
            text: '获得 1 点速度。',
            effect: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
        }];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.currentExplorer.traitTracks.speed.position).toBe(positionBefore + 1);
        expect(core.currentExplorer.traits.speed).toBe(speedBefore);
    });

    it('伤害按属性轨步数扣减，重复数值时扣一步但当前值可能不变', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'might', [1, 3, 3, 4, 5], 2);
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        const mightBefore = core.currentExplorer.traits.might;
        const positionBefore = core.currentExplorer.traitTracks.might.position;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = acknowledgeAnyPendingCardResolutions(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            playerId: '0',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['might'] });

        const damagedExplorer = findTestExplorer(core, '0');
        expect(damagedExplorer.traitTracks.might.position).toBe(positionBefore - 1);
        expect(damagedExplorer.traits.might).toBe(mightBefore);
    });

    it('治疗只把低于绿色起点的属性拉回起点，不会降低已高于起点的属性', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
            ],
        };
        setTestTraitTrack(core, '0', 'might', [1, 3, 3, 4, 5, 5], 5);
        setTestTraitTrack(core, '0', 'speed', [1, 3, 3, 4, 5], 1);
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['holy-water'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'holy-water' });

        expect(core.currentExplorer.traitTracks.might.position).toBe(5);
        expect(core.currentExplorer.traits.might).toBe(5);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
    });

    it('作祟前伤害停在临界不死亡，作祟后伤害可推到骷髅并死亡', () => {
        let preHauntCore = createStartedFirstScenarioCore();
        setTestTraitTrack(preHauntCore, '0', 'might', [1, 2, 3, 4], 1);
        preHauntCore.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];

        preHauntCore = applyBetrayalCommand(preHauntCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        preHauntCore = applyBetrayalCommand(preHauntCore, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        preHauntCore = acknowledgeAnyPendingCardResolutions(preHauntCore);
        preHauntCore = applyBetrayalCommand(preHauntCore, BETRAYAL_COMMANDS.END_TURN, '0', {});
        preHauntCore = applyBetrayalCommand(
            preHauntCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: ['might'] },
        );

        const preHauntExplorer = findTestExplorer(preHauntCore, '0');
        expect(preHauntExplorer.traitTracks.might.position).toBe(0);
        expect(preHauntCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');

        let hauntCore = createFirstScenarioReadyToStudyExorcismCore();
        setTestTraitTrack(hauntCore, '0', 'knowledge', [1, 2, 3, 4], 0);
        setTestTraitTrack(hauntCore, '0', 'sanity', [1, 2, 3, 4], 0);

        hauntCore = applyBetrayalCommand(
            hauntCore,
            BETRAYAL_COMMANDS.STUDY_EXORCISM,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(0, 0, 0, 0),
        );

        const deadExplorer = findTestExplorer(hauntCore, '0');
        expect(deadExplorer.traitTracks.knowledge.position).toBe(-1);
        expect(hauntCore.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
    });

    it('正式局内探索会消费 setup 生成的当前局发现池顺序，而不是固定索引序列', () => {
        const reverseRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], reverseRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', {});

        expect(core.drawOrder).toEqual(['omen', 'item', 'event']);
        const expectedFirstUpperRoom = [...BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper].reverse()[0]!;
        expect(core.roomDiscoveryOrderByFloor.upper[0]?.name).toBe(expectedFirstUpperRoom.name);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, createBetrayalScriptedRandom(1));

        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe(expectedFirstUpperRoom.name);
        expect(core.latestRoomDrawResolution?.selectedRoom?.name).toBe(expectedFirstUpperRoom.name);
        expect(core.latestRoomDrawResolution?.buriedRoomTiles.every((room) => room.floor !== 'upper')).toBe(true);
        expect(core.currentExplorer.inventory.at(-1)?.name).toBe('匕首');
        expect(core.pendingCardResolutionQueue).toHaveLength(2);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'omen',
            cardName: '匕首',
            stepKind: 'drawn-card',
            index: 1,
            total: 2,
        });
        expect(core.pendingCardResolutionQueue[1]).toMatchObject({
            deckKind: 'omen',
            cardName: '匕首',
            stepKind: 'haunt-roll',
            index: 2,
            total: 2,
        });
        expect(core.pendingCardResolutionQueue[1]?.text).toContain('作祟检定');

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            stepKind: 'haunt-roll',
            index: 2,
            total: 2,
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
    });

    it('正式发现池只使用已确认正面素材和可渲染房间图集，不再回落到最小代表池', () => {
        const itemIds = BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => card.id);
        const omenIds = BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => card.id);
        const roomVisualIds = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor)
            .flat()
            .map((room) => room.visualId);

        const allDiscoveryRooms = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor).flat();

        expect(itemIds).toHaveLength(12);
        expect(itemIds).toContain('strange-amulet');
        expect(omenIds).toEqual([
            'omen-book',
            'dog',
            'mask',
            'skull',
            'holy-symbol',
            'armor',
            'idol',
            'ring',
            'dagger',
        ]);
        expect(new Set([...itemIds, ...omenIds]).size).toBe(itemIds.length + omenIds.length);
        expect(allDiscoveryRooms).toHaveLength(42);
        expect(allDiscoveryRooms.every((room) => room.doorways.length > 0)).toBe(true);

        for (const card of [
            ...BETRAYAL_DISCOVERY_POOLS.possessions.item,
            ...BETRAYAL_DISCOVERY_POOLS.possessions.omen,
            ...Object.values(BETRAYAL_SCENARIO_CONFIGS['first-scenario'].startingInventoryByExplorerId).flat(),
        ]) {
            expect(resolvePossessionAtlasVisual(card)).not.toBeNull();
        }
        for (const visualId of roomVisualIds) {
            expect(Object.prototype.hasOwnProperty.call(BETRAYAL_ROOM_TILE_VISUALS, visualId)).toBe(true);
        }
    });

    it('搜索特定房间板块会移除目标并重洗剩余房间堆', () => {
        const core = createStartedFirstScenarioCore();
        const targetEntry = core.roomDiscoveryDeck.find((entry) => entry.room.visualId === 'library')!;
        const remainingVisualIds = core.roomDiscoveryDeck
            .filter((entry) => entry.room.visualId !== targetEntry.room.visualId)
            .map((entry) => entry.room.visualId)
            .reverse();

        const result = applyBetrayalTileStackSearch(core, {
            roomName: targetEntry.room.name,
            visualId: targetEntry.room.visualId,
            floor: targetEntry.floor,
        }, {
            random: () => 0.42,
            d: (max) => Math.max(1, Math.min(max, 1)),
            range: (min) => min,
            shuffle: (array) => [...array].reverse(),
        });

        expect(result.result).toMatchObject({
            foundRoom: {
                floor: targetEntry.floor,
                name: targetEntry.room.name,
                visualId: targetEntry.room.visualId,
            },
            searchedCount: core.roomDiscoveryDeck.length,
            remainingCount: core.roomDiscoveryDeck.length - 1,
            reshuffled: true,
        });
        expect(result.core.roomDiscoveryDeck.map((entry) => entry.room.visualId)).toEqual(remainingVisualIds);
        expect(result.core.roomDiscoveryDeck.some((entry) => entry.room.visualId === targetEntry.room.visualId)).toBe(false);
        expect(result.core.roomDiscoveryOrderByFloor.ground.map((room) => room.visualId)).toEqual(
            result.core.roomDiscoveryDeck
                .filter((entry) => entry.floor === 'ground')
                .map((entry) => entry.room.visualId),
        );
    });

    it('房间堆搜索预览会标出命中候选和重洗后果', () => {
        const core = createStartedFirstScenarioCore();
        const targetEntry = core.roomDiscoveryDeck.find((entry) => entry.room.visualId === 'library')!;

        const preview = resolveBetrayalTileStackSearchPreview(core, {
            roomName: targetEntry.room.name,
            visualId: targetEntry.room.visualId,
            floor: targetEntry.floor,
        });

        expect(preview).toMatchObject({
            requestedRoomName: targetEntry.room.name,
            requestedVisualId: targetEntry.room.visualId,
            requestedFloor: targetEntry.floor,
            searchedCount: core.roomDiscoveryDeck.length,
            firstCandidate: {
                floor: targetEntry.floor,
                name: targetEntry.room.name,
                visualId: targetEntry.room.visualId,
            },
            discoveredRooms: [],
            targetAlreadyInHouse: false,
            canSearch: true,
            willRemoveFirstCandidate: true,
            willReshuffleAfterSearch: true,
            remainingCountAfterSearch: core.roomDiscoveryDeck.length - 1,
            reason: null,
        });
        expect(preview.candidateRooms).toEqual([{
            floor: targetEntry.floor,
            name: targetEntry.room.name,
            visualId: targetEntry.room.visualId,
        }]);
        expect(preview.ruleNotes).toEqual(expect.arrayContaining([
            '若从房间堆命中特定板块，应移除该板块并重洗剩余房间堆。',
            '当前读模型只表达搜索候选与重洗后果，不等于玩家可见搜索面板或逐作祟 setup 放置流程完成。',
        ]));
    });

    it('房间堆搜索预览会在目标已在屋内时阻止重复搜索', () => {
        const core = createStartedFirstScenarioCore();

        const preview = resolveBetrayalTileStackSearchPreview(core, {
            roomName: '门厅',
            visualId: 'startHallway',
            floor: 'ground',
        });

        expect(preview).toMatchObject({
            requestedRoomName: '门厅',
            requestedVisualId: 'startHallway',
            requestedFloor: 'ground',
            candidateRooms: [],
            firstCandidate: null,
            discoveredRooms: [{
                roomId: 'hallway',
                floor: 'ground',
                name: '门厅',
                visualId: 'startHallway',
            }],
            targetAlreadyInHouse: true,
            canSearch: false,
            willRemoveFirstCandidate: false,
            willReshuffleAfterSearch: false,
            remainingCountAfterSearch: core.roomDiscoveryDeck.length,
            reason: '目标房间已经在屋内，不需要搜索房间堆。',
        });
    });

    it('搜索不存在的房间板块不会重洗或移除房间堆', () => {
        const core = createStartedFirstScenarioCore();
        const visualIdsBeforeSearch = core.roomDiscoveryDeck.map((entry) => entry.room.visualId);

        const result = applyBetrayalTileStackSearch(core, { roomName: '不存在的房间' }, {
            random: () => 0.42,
            d: (max) => Math.max(1, Math.min(max, 1)),
            range: (min) => min,
            shuffle: (array) => [...array].reverse(),
        });

        expect(result.result).toMatchObject({
            requestedRoomName: '不存在的房间',
            foundRoom: null,
            searchedCount: core.roomDiscoveryDeck.length,
            remainingCount: core.roomDiscoveryDeck.length,
            reshuffled: false,
        });
        expect(result.core.roomDiscoveryDeck.map((entry) => entry.room.visualId)).toEqual(visualIdsBeforeSearch);
    });

    it('区域房间池耗尽时探索会被拒绝，且不消耗移动或结束回合', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core.roomDiscoveryOrderByFloor.ground = [];
        core.movesRemaining = 2;
        core.turnEndedByDiscovery = false;

        expect(resolveRoomPlacementPreview(core, { roomId: 'ground-north' })).toBeNull();

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' }),
        );

        expect(validation).toMatchObject({
            valid: false,
            error: '当前区域没有可发现房间。',
        });
        expect(core.movesRemaining).toBe(2);
        expect(core.turnEndedByDiscovery).toBe(false);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.state).toBe('unexplored');
    });

    it('区域不匹配的房间会先掩埋到底部，并继续翻找当前区域房间', () => {
        let core = createStartedFirstScenarioCore();
        const upperRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'tower')!;
        const basementRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'larder')!;
        const groundRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!;
        core.roomDiscoveryDeck = [
            { floor: 'upper', room: upperRoom },
            { floor: 'basement', room: basementRoom },
            { floor: 'ground', room: groundRoom },
        ];
        core.roomDiscoveryOrderByFloor = {
            ground: [groundRoom],
            upper: [upperRoom],
            basement: [basementRoom],
        };
        core.drawOrder = ['item'];
        core.movesRemaining = 2;
        core.turnEndedByDiscovery = false;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });

        const drawResolution = resolveBetrayalRoomDrawResolution(core, 'ground');
        expect(drawResolution).toMatchObject({
            requestedFloor: 'ground',
            selectedRoom: { name: '火炉房', visualId: 'furnaceRoom' },
            exhausted: false,
            usedUnifiedDeck: true,
        });
        expect(drawResolution.buriedRoomTiles.map((room) => `${room.floor}:${room.name}:${room.reason}`)).toEqual([
            'upper:塔楼:areaMismatch',
            'basement:储物间:areaMismatch',
        ]);
        const preview = resolveRoomPlacementPreview(core, { roomId: 'ground-north' });
        expect(preview?.room.name).toBe('火炉房');
        expect(preview?.buriedRoomNames).toEqual(['塔楼', '储物间']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('火炉房');
        expect(core.latestRoomDrawResolution?.buriedRoomTiles.map((room) => room.name)).toEqual(['塔楼', '储物间']);
        expect(core.buriedRoomTiles.map((room) => `${room.floor}:${room.name}`)).toEqual([
            'upper:塔楼',
            'basement:储物间',
        ]);
        expect(core.roomDiscoveryDeck.map((entry) => `${entry.floor}:${entry.room.name}`)).toEqual([
            'upper:塔楼',
            'basement:储物间',
        ]);
        expect(core.roomDiscoveryOrderByFloor.ground).toEqual([]);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('会封死同区域可探索走廊的房间会被掩埋并继续重抽', () => {
        let core = createStartedFirstScenarioCore();
        const sealedBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'vault')!;
        const openBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!;
        const sealedRoom = {
            ...sealedBaseRoom,
            name: '测试死路房',
            hint: '测试用：只有入口走廊，会封死当前区域',
            tags: ['测试'],
            doorways: ['south' as const],
        };
        const openRoom = {
            ...openBaseRoom,
            name: '测试开放房',
            hint: '测试用：连接入口后仍保留一个开放走廊',
            tags: ['测试'],
            doorways: ['south' as const, 'east' as const],
        };
        core.roomDiscoveryDeck = [
            { floor: 'ground', room: sealedRoom },
            { floor: 'ground', room: openRoom },
        ];
        core.roomDiscoveryOrderByFloor = {
            ground: [sealedRoom, openRoom],
            upper: [],
            basement: [],
        };
        core.drawOrder = ['item'];
        core.turnEndedByDiscovery = false;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core.movesRemaining = 2;
        core.rooms = core.rooms
            .filter((room) => room.id !== 'ground-south' && room.id !== 'ground-east')
            .map((room) => {
                if (room.id === 'hallway') {
                    return {
                        ...room,
                        connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-south'),
                        doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-south'),
                    };
                }
                if (room.id === 'entrance-hall') {
                    return {
                        ...room,
                        connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-east'),
                        doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-east'),
                    };
                }
                return room;
            });

        expect(resolveExplorableRoomSlots(core).map((room) => room.id)).toEqual(['ground-north']);

        const drawResolution = resolveBetrayalRoomDrawResolution(core, 'ground', { roomId: 'ground-north' });
        expect(drawResolution).toMatchObject({
            requestedFloor: 'ground',
            selectedRoom: { name: '测试开放房', visualId: 'furnaceRoom' },
            exhausted: false,
            usedUnifiedDeck: true,
        });
        expect(drawResolution.buriedRoomTiles.map((room) => `${room.name}:${room.reason}`)).toEqual([
            '测试死路房:sealedRegion',
        ]);

        const preview = resolveRoomPlacementPreview(core, { roomId: 'ground-north' });
        expect(preview?.room.name).toBe('测试开放房');
        expect(preview?.buriedRoomNames).toEqual(['测试死路房']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('测试开放房');
        expect(core.latestRoomDrawResolution?.buriedRoomTiles.map((room) => `${room.name}:${room.reason}`)).toEqual([
            '测试死路房:sealedRegion',
        ]);
        expect(core.buriedRoomTiles.map((room) => `${room.name}:${room.reason}`)).toEqual([
            '测试死路房:sealedRegion',
        ]);
        expect(core.roomDiscoveryDeck.map((entry) => `${entry.floor}:${entry.room.name}`)).toEqual([
            'ground:测试死路房',
        ]);
        expect(resolveExplorableRoomSlots(core).some((room) => room.floor === 'ground')).toBe(true);
    });

    it('最后一张同区域房间会封死区域时要求先调整已有板块', () => {
        let core = createStartedFirstScenarioCore();
        const sealedBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'vault')!;
        const sealedRoom = {
            ...sealedBaseRoom,
            name: '测试最后死路房',
            hint: '测试用：最后一张同区域房间仍会封死当前区域',
            tags: ['测试'],
            doorways: ['south' as const],
        };
        core.roomDiscoveryDeck = [
            { floor: 'ground', room: sealedRoom },
        ];
        core.roomDiscoveryOrderByFloor = {
            ground: [sealedRoom],
            upper: [],
            basement: [],
        };
        core.drawOrder = ['item'];
        core.movesRemaining = 2;
        core.turnEndedByDiscovery = false;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core.rooms = core.rooms
            .filter((room) => room.id !== 'ground-south' && room.id !== 'ground-east')
            .map((room) => {
                if (room.id === 'hallway') {
                    return {
                        ...room,
                        connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-south'),
                        doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-south'),
                    };
                }
                if (room.id === 'entrance-hall') {
                    return {
                        ...room,
                        connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-east'),
                        doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-east'),
                    };
                }
                return room;
            });

        expect(resolveExplorableRoomSlots(core).map((room) => room.id)).toEqual(['ground-north']);

        const drawResolution = resolveBetrayalRoomDrawResolution(core, 'ground', { roomId: 'ground-north' });
        expect(drawResolution).toMatchObject({
            requestedFloor: 'ground',
            selectedRoom: { name: '测试最后死路房', visualId: 'vault' },
            exhausted: false,
            requiresTileAdjustment: true,
            usedUnifiedDeck: true,
        });
        expect(drawResolution.buriedRoomTiles).toEqual([]);

        const preview = resolveRoomPlacementPreview(core, { roomId: 'ground-north' });
        expect(preview?.room.name).toBe('测试最后死路房');
        expect(preview?.requiresTileAdjustment).toBe(true);
        expect(preview?.orientationOptions.length).toBeGreaterThan(0);
        expect(preview?.tileAdjustmentOptions.length).toBeGreaterThan(0);

        const movesBeforeRejectedExplore = core.movesRemaining;
        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.EXPLORE_ROOM,
                '0',
                { roomId: 'ground-north', orientationTurns: preview?.defaultOrientationTurns },
            ),
        );

        expect(validation).toMatchObject({
            valid: false,
            error: '需要先调整该区域已有板块，保留至少一个开放走廊。',
        });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.state).toBe('unexplored');
        expect(core.movesRemaining).toBe(movesBeforeRejectedExplore);
        expect(core.turnEndedByDiscovery).toBe(false);

        const adjustmentOptions = resolveRoomTileAdjustmentOptions(core, {
            roomId: 'ground-north',
            orientationTurns: preview?.defaultOrientationTurns,
        });
        const adjustment = adjustmentOptions.find((option) => option.roomName === '入口大厅')
            ?? adjustmentOptions[0]!;
        expect(adjustment.openDoorwayCount).toBeGreaterThan(0);

        const validAdjustedExplore = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.EXPLORE_ROOM,
                '0',
                {
                    roomId: 'ground-north',
                    orientationTurns: preview?.defaultOrientationTurns,
                    roomTileAdjustment: adjustment,
                },
            ),
        );
        expect(validAdjustedExplore).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {
            roomId: 'ground-north',
            orientationTurns: preview?.defaultOrientationTurns,
            roomTileAdjustment: adjustment,
        });

        const placedRoom = core.rooms.find((room) => room.id === 'ground-north');
        const adjustedRoom = core.rooms.find((room) => room.id === adjustment.roomId);
        expect(placedRoom?.name).toBe('测试最后死路房');
        expect(adjustedRoom?.x).toBe(adjustment.x);
        expect(adjustedRoom?.y).toBe(adjustment.y);
        expect(core.rooms.some((room) => room.floor === 'ground' && room.state === 'unexplored')).toBe(true);
        expect(core.latestRoomDrawResolution?.requiresTileAdjustment).toBe(true);
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.activityLog[0]?.text).toContain('先调整房间板块');
    });

    it('火炉房在探索者结束回合时要求受伤玩家分配 1 点物理伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        const speedBefore = core.currentExplorer.traits.speed;
        const speedPositionBefore = core.currentExplorer.traitTracks.speed.position;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('火炉房');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            playerId: '0',
        });
        expect(core.currentPlayer).toBe('0');
        expect(core.activePlayerId).toBe('0');

        const blockedMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' }),
        );
        expect(blockedMove).toMatchObject({ valid: false, error: '请先分配当前伤害。' });

        const wrongPlayer = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '1', { traits: ['speed'] }),
        );
        expect(wrongPlayer).toMatchObject({ valid: false, error: '必须由受伤玩家分配伤害。' });

        const wrongTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['knowledge'] }),
        );
        expect(wrongTrait).toMatchObject({ valid: false, error: '该伤害不能分配到所选属性。' });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] });

        const damagedExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(damagedExplorer.traitTracks.speed.position).toBe(speedPositionBefore - 1);
        expect(damagedExplorer.traits.speed).toBe(speedBefore - 1);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('1');
        expect(core.activityLog[0]?.text).toContain('分配');
        expect(core.activityLog[0]?.text).toContain('火炉房');
    });

    it('礼拜堂在发现板块时让发现者获得 1 点神志', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'chapel')!,
        ];
        const sanityBefore = core.currentExplorer.traits.sanity;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('礼拜堂');
        expect(core.currentExplorer.traits.sanity).toBe(sanityBefore + 1);
        expect(core.pendingCardResolutionQueue).toHaveLength(2);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            cardName: '房间效果：礼拜堂，神志 +1',
            stepKind: 'room-effect',
            text: '房间效果：礼拜堂，神志 +1',
            index: 1,
            total: 2,
        });
        expect(core.pendingCardResolutionQueue[0]?.deckKind).toBeUndefined();
        expect(core.pendingCardResolutionQueue[1]).toMatchObject({
            deckKind: 'event',
            stepKind: 'event-effect',
            index: 2,
            total: 2,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = acknowledgeAnyPendingCardResolutions(core);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        ).valid).toBe(true);
    });

    it('盔甲会把承受的物理伤害降低 1 点', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'armor', name: '盔甲', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;
        const speedBefore = core.currentExplorer.traits.speed;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('火炉房');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const armoredExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(core.pendingDamageAllocation).toBeNull();
        expect(armoredExplorer.traits.might).toBe(mightBefore);
        expect(armoredExplorer.traits.speed).toBe(speedBefore);
        expect(core.currentPlayer).toBe('1');
    });

    it('火炉房伤害不能分配到作祟前已临界的物理属性', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'might', [1, 2, 3], 0, 1);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 2, 1);
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = acknowledgeAnyPendingCardResolutions(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const lockedMight = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['might'] }),
        );
        expect(lockedMight).toMatchObject({ valid: false, error: '不能把伤害分配到已锁定的属性。' });

        const validSpeed = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] }),
        );
        expect(validSpeed).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] });

        const explorer = findTestExplorer(core, '0');
        expect(explorer.traitTracks.might.position).toBe(0);
        expect(explorer.traitTracks.speed.position).toBe(1);
        expect(core.currentPlayer).toBe('1');
    });

    it('盔甲不会阻挡对力量属性的直接降低', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'armor', name: '盔甲', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.currentExplorer.traits.might).toBe(mightBefore - 1);
    });

    it('首剧本事件牌池使用已锁定的官方事件牌，不再沿用项目占位事件', () => {
        const eventNames = BETRAYAL_DISCOVERY_POOLS.events.map((event) => event.name);
        expect(eventNames).toEqual(['标本剥制', '说“茄子”！', '外星几何', '小丑房间', '咬一口！', '吊死鬼', '电话铃声', '小机器人', '嘎吱的木门', '脑状食品', '上古旧宅', '肉质苔癣', '夜幕众星', '一抹鲜红', '一瓶微尘', '大宅饿了', '一条秘密通道', '最深的壁橱', '磁带播放器', '在你背后！', '蜘蛛！', '一种怪异的感觉', '葬礼']);
        expect(eventNames).not.toContain('回廊顺风');
        expect(eventNames).not.toContain('窃窃低语');
        expect(eventNames).not.toContain('旧日手记');
        expect(eventNames).not.toContain('滑落阶梯');
        expect(eventNames).not.toContain('墙中低语');
        expect(eventNames).not.toContain('冷风指路');
        expect(eventNames).not.toContain('阴影扑面');
        expect(eventNames).not.toContain('残留祝福');
    });

    it('正式运行事件牌堆只包含当前已接入运行切片的事件', () => {
        const supportedEventNames = BETRAYAL_DISCOVERY_POOLS.events
            .filter(isBetrayalEventRuntimeSupported)
            .map((event) => event.name);
        const unsupportedEventNames = BETRAYAL_DISCOVERY_POOLS.events
            .filter((event) => !isBetrayalEventRuntimeSupported(event))
            .map((event) => event.name);
        const core = BetrayalDomain.setup(['0', '1', '2'], BETRAYAL_FIXED_RANDOM);

        expect(unsupportedEventNames).toEqual([]);
        expect(supportedEventNames).toContain('一抹鲜红');
        expect(supportedEventNames).toContain('一瓶微尘');
        expect(supportedEventNames).toContain('说“茄子”！');
        expect(supportedEventNames).toContain('大宅饿了');
        expect(core.eventOrder.map((event) => event.name).sort()).toEqual(supportedEventNames.sort());
        expect(core.eventOrder.map((event) => event.name)).toContain('大宅饿了');
        expect(core.deckCounts.event).toBe(supportedEventNames.length);
        expect(core.deckCounts.event).toBe(core.eventOrder.length);
    });

    it('当前 23 张事件牌都登记了灰尘死亡保护风险分类', () => {
        const expectedRiskTagsByEventName: Record<string, string[]> = {
            标本剥制: ['damage'],
            '说“茄子”！': [],
            外星几何: ['directTraitLoss'],
            小丑房间: ['damage'],
            '咬一口！': ['damage'],
            吊死鬼: ['directTraitLoss'],
            电话铃声: ['damage'],
            小机器人: ['damage'],
            嘎吱的木门: [],
            脑状食品: ['damage', 'directTraitLoss'],
            上古旧宅: ['damage'],
            肉质苔癣: ['damage'],
            夜幕众星: ['directTraitLoss'],
            一抹鲜红: ['damage'],
            一瓶微尘: ['directTraitLoss'],
            大宅饿了: [],
            一条秘密通道: ['directTraitLoss'],
            最深的壁橱: ['damage'],
            磁带播放器: ['damage'],
            '在你背后！': ['damage'],
            '蜘蛛！': ['directTraitLoss'],
            一种怪异的感觉: ['directTraitLoss'],
            葬礼: ['directTraitLoss'],
        };
        const actualRiskTagsByEventName = Object.fromEntries(
            BETRAYAL_DISCOVERY_POOLS.events.map((event) => [
                event.name,
                collectEventTemplateDeathRiskTags(event),
            ]),
        );

        expect(Object.keys(expectedRiskTagsByEventName)).toEqual(
            BETRAYAL_DISCOVERY_POOLS.events.map((event) => event.name),
        );
        expect(actualRiskTagsByEventName).toEqual(expectedRiskTagsByEventName);
    });

    it('当前运行持有牌全集覆盖发现牌池和开局额外持有牌，并登记主动/武器能力', () => {
        const discoveryCardIds = new Set([
            ...BETRAYAL_DISCOVERY_POOLS.possessions.item,
            ...BETRAYAL_DISCOVERY_POOLS.possessions.omen,
        ].map((card) => card.id));
        const runtimeCards = collectRuntimePossessionCards();
        const core = createPossessionCoverageCore();
        const attackWeaponCardIds = new Set(resolveAttackWeaponCardStatuses(core).map((status) => status.card.id));
        const actualCoverage = Object.fromEntries(runtimeCards.map((card) => [
            card.id,
            {
                name: card.name,
                kind: card.kind,
                activeUseMode: resolveUseEffect(card)?.mode ?? null,
                attackWeapon: attackWeaponCardIds.has(card.id),
            },
        ]));

        expect(BETRAYAL_DISCOVERY_POOLS.possessions.item).toHaveLength(12);
        expect(BETRAYAL_DISCOVERY_POOLS.possessions.omen).toHaveLength(9);
        expect(runtimeCards.map((card) => card.id)).toEqual([
            'camera',
            'medical-kit',
            'holy-water',
            'flashlight',
            'radio',
            'map',
            'strange-amulet',
            'rope',
            'lockpick-tool',
            'hunting-knife',
            'notebook',
            'manuscript',
            'omen-book',
            'dog',
            'mask',
            'skull',
            'holy-symbol',
            'armor',
            'idol',
            'ring',
            'dagger',
            'lantern',
            'journal',
        ]);
        expect(runtimeCards.filter((card) => !discoveryCardIds.has(card.id)).map((card) => card.name)).toEqual(['灯笼', '日记']);
        expect(actualCoverage).toEqual({
            camera: { name: '魔法相机', kind: 'item', activeUseMode: null, attackWeapon: false },
            'medical-kit': { name: '急救包', kind: 'item', activeUseMode: 'healTraits', attackWeapon: false },
            'holy-water': { name: '奇怪的药品', kind: 'item', activeUseMode: 'healTraits', attackWeapon: false },
            flashlight: { name: '手电筒', kind: 'item', activeUseMode: null, attackWeapon: false },
            radio: { name: '头戴耳机', kind: 'item', activeUseMode: null, attackWeapon: false },
            map: { name: '地图', kind: 'item', activeUseMode: 'placeExplorer', attackWeapon: false },
            'strange-amulet': { name: '奇异护符', kind: 'item', activeUseMode: null, attackWeapon: false },
            rope: { name: '兔脚', kind: 'item', activeUseMode: null, attackWeapon: false },
            'lockpick-tool': { name: '骨制钥匙', kind: 'item', activeUseMode: null, attackWeapon: false },
            'hunting-knife': { name: '砍刀', kind: 'item', activeUseMode: null, attackWeapon: true },
            notebook: { name: '笔记本', kind: 'item', activeUseMode: 'placeExplorer', attackWeapon: false },
            manuscript: { name: '手稿', kind: 'item', activeUseMode: 'placeExplorer', attackWeapon: false },
            'omen-book': { name: '书本', kind: 'omen', activeUseMode: 'nextNonCombatTraitReplacement', attackWeapon: false },
            dog: { name: '狗', kind: 'omen', activeUseMode: null, attackWeapon: false },
            mask: { name: '面具', kind: 'omen', activeUseMode: 'moveOthersInRoom', attackWeapon: false },
            skull: { name: '头骨', kind: 'omen', activeUseMode: null, attackWeapon: false },
            'holy-symbol': { name: '圣符', kind: 'omen', activeUseMode: null, attackWeapon: false },
            armor: { name: '盔甲', kind: 'omen', activeUseMode: null, attackWeapon: false },
            idol: { name: '雕像', kind: 'omen', activeUseMode: null, attackWeapon: false },
            ring: { name: '指环', kind: 'omen', activeUseMode: null, attackWeapon: true },
            dagger: { name: '匕首', kind: 'omen', activeUseMode: null, attackWeapon: true },
            lantern: { name: '灯笼', kind: 'item', activeUseMode: null, attackWeapon: false },
            journal: { name: '日记', kind: 'item', activeUseMode: 'placeExplorer', attackWeapon: false },
        });
    });

    it('当前运行持有牌均登记灰尘交叉规则分类', () => {
        const expectedDustCrossingsByCardId = {
            camera: ['nonCombatKnowledgeReplacement', 'dustDeathBurial'],
            'medical-kit': ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            'holy-water': ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            flashlight: ['eventTraitExtraDice', 'dustDeathBurial'],
            radio: ['mentalDamageReduction', 'dustDeathBurial'],
            map: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
            'strange-amulet': ['otherHauntSetupItem', 'dustDeathBurial'],
            rope: ['rabbitFootReroll', 'dustDeathBurial'],
            'lockpick-tool': ['skeletonKeyMove', 'dustDeathBurial'],
            'hunting-knife': ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            notebook: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
            manuscript: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
            'omen-book': ['passiveKnowledgeBonus', 'turnStartActiveUseLimit', 'bookNonCombatReplacement', 'dustDeathBurial'],
            dog: ['passiveSpeedBonus', 'dogTrade', 'tradeAfterUseLimit', 'dustDeathBurial'],
            mask: ['passiveSpeedBonus', 'turnStartActiveUseLimit', 'moveOthersInRoom', 'dustDeathBurial'],
            skull: ['passiveKnowledgeBonus', 'deathPrevention', 'rabbitFootDeathWindow', 'dustDeathBurial'],
            'holy-symbol': ['passiveSanityBonus', 'holySymbolDiscoveryReplacement', 'dustDeathBurial'],
            armor: ['physicalDamageReduction', 'dustDeathBurial'],
            idol: ['passiveMightBonus', 'idolEventSkip', 'dustDeathBurial'],
            ring: ['passiveSanityBonus', 'attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            dagger: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            lantern: ['eventTraitExtraDice', 'dustDeathBurial'],
            journal: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
        };
        const runtimeCards = collectRuntimePossessionCards();

        expect(Object.keys(expectedDustCrossingsByCardId)).toEqual(runtimeCards.map((card) => card.id));
        expect(expectedDustCrossingsByCardId).toEqual({
            camera: ['nonCombatKnowledgeReplacement', 'dustDeathBurial'],
            'medical-kit': ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            'holy-water': ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            flashlight: ['eventTraitExtraDice', 'dustDeathBurial'],
            radio: ['mentalDamageReduction', 'dustDeathBurial'],
            map: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
            'strange-amulet': ['otherHauntSetupItem', 'dustDeathBurial'],
            rope: ['rabbitFootReroll', 'dustDeathBurial'],
            'lockpick-tool': ['skeletonKeyMove', 'dustDeathBurial'],
            'hunting-knife': ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            notebook: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
            manuscript: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
            'omen-book': ['passiveKnowledgeBonus', 'turnStartActiveUseLimit', 'bookNonCombatReplacement', 'dustDeathBurial'],
            dog: ['passiveSpeedBonus', 'dogTrade', 'tradeAfterUseLimit', 'dustDeathBurial'],
            mask: ['passiveSpeedBonus', 'turnStartActiveUseLimit', 'moveOthersInRoom', 'dustDeathBurial'],
            skull: ['passiveKnowledgeBonus', 'deathPrevention', 'rabbitFootDeathWindow', 'dustDeathBurial'],
            'holy-symbol': ['passiveSanityBonus', 'holySymbolDiscoveryReplacement', 'dustDeathBurial'],
            armor: ['physicalDamageReduction', 'dustDeathBurial'],
            idol: ['passiveMightBonus', 'idolEventSkip', 'dustDeathBurial'],
            ring: ['passiveSanityBonus', 'attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            dagger: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            lantern: ['eventTraitExtraDice', 'dustDeathBurial'],
            journal: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
        });
    });

    it('大宅饿了作祟检定成功会进入剧本12官方开局切片', () => {
        const core = createHelpingHandsHauntCore();
        const helpingHands = core.scenarioRuntime.helpingHands;
        const trollHands = core.monsters.filter((monster) => helpingHands?.trollHandIds.includes(monster.id));
        const monsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'free-for-all',
            traitorPlayerId: null,
            teamModel: 'free-for-all',
            reasonLabel: '自由混战',
            candidatePlayerIds: [],
            excludedPlayerIds: [],
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-revealer',
            anchorPlayerId: '0',
            nextPlayerId: '1',
            reasonLabel: '作祟揭秘者左侧玩家先行动',
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntCardNumber).toBe(12);
        expect(core.currentPlayer).toBe('1');
        expect(helpingHands).toMatchObject({
            strangeAmuletCardId: 'strange-amulet',
            strangeAmuletFoundDuringSetup: true,
            trollHandIds: ['troll-hand-1', 'troll-hand-2'],
            monsterTurnAfterPlayerId: '0',
        });
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('0');
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'strange-amulet')).toBe(true);
        expect(core.possessionOrderByKind.item.some((card) => card.id === 'strange-amulet')).toBe(false);
        expect(core.deckCounts.item).toBe(11);
        expect(trollHands).toHaveLength(2);
        expect(trollHands.map((monster) => [monster.roomId, monster.might, monster.speed, monster.sanity, monster.knowledge])).toEqual([
            ['entrance-hall', 5, 3, 4, 4],
            ['basement-landing', 5, 3, 4, 4],
        ]);
        expect(core.scenarioRuntime.hauntSetupQueue.map((entry) => entry.id)).toEqual([
            'recover-strange-amulet',
            'monster-card-left-of-revealer',
            'place-troll-hands',
            'first-player-left-of-revealer',
        ]);
        expect(monsterTurnStatus).toMatchObject({
            active: false,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
            trollHandIds: ['troll-hand-1', 'troll-hand-2'],
            reason: '等待揭秘者结束回合后开始巨魔手怪物回合。',
        });
    });

    it('一名公开叛徒作祟会给出自愿替代叛徒候选和触发牌转移口径', () => {
        const core = createFirstScenarioHauntCore();
        const interaction = resolveBetrayalTraitorVolunteerInteraction(core);

        expect(interaction).toMatchObject({
            active: true,
            designatedTraitorPlayerId: core.scenarioRuntime.traitorPlayerId,
            volunteerCandidatePlayerIds: ['0', '1'],
            triggerCardId: core.scenarioRuntime.triggeringOmenId,
            requiresPositionSwap: true,
            requiresTriggerCardTransfer: true,
            reason: null,
        });
        expect(interaction.triggerCardHolderPlayerId).toBe(core.scenarioRuntime.traitorPlayerId);
    });

    it('自由混战作祟不会错误进入自愿替代叛徒流程', () => {
        const core = createHelpingHandsHauntCore();

        expect(resolveBetrayalTraitorVolunteerInteraction(core)).toMatchObject({
            active: false,
            designatedTraitorPlayerId: null,
            volunteerCandidatePlayerIds: [],
            requiresPositionSwap: false,
            requiresTriggerCardTransfer: false,
            reason: '只有一名公开叛徒的作祟才使用自愿替代叛徒流程。',
        });
    });

    it('自愿者替代叛徒预览会列出角色变化、换位、触发牌转移和重算缺口', () => {
        const core = createFirstScenarioHauntCore();
        const designatedTraitorPlayerId = core.scenarioRuntime.traitorPlayerId!;
        const volunteerPlayerId = '0';
        const designatedTraitorRoomId = findTestExplorer(core, designatedTraitorPlayerId).roomId;
        const volunteerRoomId = findTestExplorer(core, volunteerPlayerId).roomId;
        const preview = resolveBetrayalTraitorVolunteerResolutionPreview(core, {
            decision: 'volunteer-replaces',
            volunteerPlayerId,
        });

        expect(preview).toMatchObject({
            active: true,
            canResolve: true,
            status: 'ready',
            decision: 'volunteer-replaces',
            designatedTraitorPlayerId,
            volunteerPlayerId,
            resultingTraitorPlayerId: volunteerPlayerId,
            roleChanges: [
                { playerId: designatedTraitorPlayerId, fromSide: 'traitor', toSide: 'hero' },
                { playerId: volunteerPlayerId, fromSide: 'hero', toSide: 'traitor' },
            ],
            positionSwap: {
                required: true,
                designatedTraitorPlayerId,
                volunteerPlayerId,
                fromRoomByPlayerId: {
                    [designatedTraitorPlayerId]: designatedTraitorRoomId,
                    [volunteerPlayerId]: volunteerRoomId,
                },
                toRoomByPlayerId: {
                    [designatedTraitorPlayerId]: volunteerRoomId,
                    [volunteerPlayerId]: designatedTraitorRoomId,
                },
            },
            triggerCardTransfer: {
                required: true,
                cardId: core.scenarioRuntime.triggeringOmenId,
                fromPlayerId: designatedTraitorPlayerId,
                toPlayerId: volunteerPlayerId,
                holderAlreadyCorrect: false,
            },
            requiresTraitorBoostReconciliation: true,
            requiresFirstPlayerReconciliation: true,
            requiresHauntSetupReconciliation: true,
            contractGaps: [
                'formal-command',
                'reveal-ui',
                'traitor-boost-reconciliation',
                'first-player-reconciliation',
                'haunt-setup-reconciliation',
            ],
            previewOnly: true,
            reason: null,
        });
    });

    it('无人自愿替代叛徒预览会保留指定叛徒且不换位不转移触发牌', () => {
        const core = createFirstScenarioHauntCore();
        const designatedTraitorPlayerId = core.scenarioRuntime.traitorPlayerId!;
        const preview = resolveBetrayalTraitorVolunteerResolutionPreview(core, {
            decision: 'no-volunteer',
        });

        expect(preview).toMatchObject({
            active: true,
            canResolve: true,
            status: 'ready',
            decision: 'no-volunteer',
            designatedTraitorPlayerId,
            volunteerPlayerId: null,
            resultingTraitorPlayerId: designatedTraitorPlayerId,
            roleChanges: [],
            positionSwap: { required: false },
            triggerCardTransfer: {
                required: false,
                cardId: core.scenarioRuntime.triggeringOmenId,
                fromPlayerId: designatedTraitorPlayerId,
                toPlayerId: null,
            },
            requiresTraitorBoostReconciliation: false,
            requiresFirstPlayerReconciliation: false,
            requiresHauntSetupReconciliation: false,
            contractGaps: ['formal-command', 'reveal-ui'],
            previewOnly: true,
            reason: null,
        });
    });

    it('自愿替代叛徒预览会阻止非法志愿者和非适用作祟', () => {
        const core = createFirstScenarioHauntCore();
        const designatedTraitorPlayerId = core.scenarioRuntime.traitorPlayerId!;

        expect(resolveBetrayalTraitorVolunteerResolutionPreview(core, {
            decision: 'volunteer-replaces',
            volunteerPlayerId: designatedTraitorPlayerId,
        })).toMatchObject({
            active: true,
            canResolve: false,
            status: 'invalid-volunteer',
            reason: '该玩家不在可自愿替代叛徒列表。',
        });

        expect(resolveBetrayalTraitorVolunteerResolutionPreview(createHelpingHandsHauntCore(), {
            decision: 'volunteer-replaces',
            volunteerPlayerId: '0',
        })).toMatchObject({
            active: false,
            canResolve: false,
            status: 'not-applicable',
            reason: '只有一名公开叛徒的作祟才使用自愿替代叛徒流程。',
        });
    });

    it('事件牌结算后应回到牌堆底部，事件牌堆数量不减少', () => {
        const firstEvent = { name: '第一张测试事件', text: '第一张事件。', effect: { mode: 'none' as const, recommendedAction: 'endTurn' as const } };
        const secondEvent = { name: '第二张测试事件', text: '第二张事件。', effect: { mode: 'none' as const, recommendedAction: 'endTurn' as const } };
        let core = createStartedFirstScenarioCore(['0', '1']);
        core.drawOrder = ['event'];
        core.eventOrder = [firstEvent, secondEvent];
        core.deckCounts.event = core.eventOrder.length;
        const eventDeckBefore = core.deckCounts.event;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('第一张测试事件');
        expect(core.eventOrder.map((event) => event.name)).toEqual(['第二张测试事件', '第一张测试事件']);
        expect(core.deckCounts.event).toBe(eventDeckBefore);
        expect(core.discardCounts.event).toBe(0);
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: 'ground-east' });

        expect(core.latestDiscovery?.title).toBe('第二张测试事件');
        expect(core.eventOrder.map((event) => event.name)).toEqual(['第一张测试事件', '第二张测试事件']);
        expect(core.deckCounts.event).toBe(eventDeckBefore);
        expect(core.discardCounts.event).toBe(0);
    });

    it('剧本3玩家视图只允许本人看到自己的疾病标记数字', () => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.scenarioRuntime.dust = {
            sicknessTokensByPlayerId: {
                '0': [
                    { id: 'sickness-0-a', value: 1 },
                    { id: 'sickness-0-b', value: 4 },
                    { id: 'sickness-0-c', value: 8 },
                ],
                '1': [
                    { id: 'sickness-1-a', value: 2 },
                    { id: 'sickness-1-b', value: 3 },
                    { id: 'sickness-1-c', value: 5 },
                ],
                '2': [
                    { id: 'sickness-2-a', value: 6 },
                    { id: 'sickness-2-b', value: 7 },
                    { id: 'sickness-2-c', value: 9 },
                ],
            },
            permanentTraitorPlayerIds: ['0'],
            researchRoomIds: [],
            exchangedSicknessThisTurnPlayerIds: [],
            feverishPlayerIds: [],
        };

        const viewForPlayer0 = BetrayalDomain.playerView?.(core, '0') as BetrayalCore;
        const viewForPlayer1 = BetrayalDomain.playerView?.(core, '1') as BetrayalCore;

        expect(viewForPlayer0.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([1, 4, 8]);
        expect(viewForPlayer0.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([null, null, null]);
        expect(viewForPlayer1.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([2, 3, 5]);
        expect(viewForPlayer1.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([null, null, null]);
        expect(core.scenarioRuntime.dust.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([2, 3, 5]);
    });

    it('剧本3死亡保护回看也只允许本人看到自己的疾病标记数字', () => {
        const core = createStartedFirstScenarioCore(['0', '1']);
        core.scenarioRuntime.dust = {
            sicknessTokensByPlayerId: {
                '0': [
                    { id: 'sickness-0-a', value: 1 },
                    { id: 'sickness-0-b', value: 4 },
                    { id: 'sickness-0-c', value: 8 },
                ],
                '1': [
                    { id: 'sickness-1-a', value: 2 },
                    { id: 'sickness-1-b', value: 3 },
                    { id: 'sickness-1-c', value: 5 },
                ],
            },
            permanentTraitorPlayerIds: ['0'],
            researchRoomIds: [],
            exchangedSicknessThisTurnPlayerIds: [],
            feverishPlayerIds: [],
        };
        core.recentRoll = {
            id: 'death-prevention-dust-privacy',
            kind: 'deathPrevention',
            playerId: '1',
            sourceTitle: '头骨死亡保护',
            dice: [2, 1],
            passiveBonus: 0,
            latestLabel: '阻止死亡',
            deathPrevention: {
                cardId: 'skull',
                minTotal: 5,
                damageKind: 'physical',
                damageAmount: 1,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
                scenarioRuntimeBeforeDefeat: {
                    ...core.scenarioRuntime,
                    dust: {
                        sicknessTokensByPlayerId: {
                            '0': [
                                { id: 'before-sickness-0-a', value: 1 },
                                { id: 'before-sickness-0-b', value: 4 },
                                { id: 'before-sickness-0-c', value: 8 },
                            ],
                            '1': [
                                { id: 'before-sickness-1-a', value: 2 },
                                { id: 'before-sickness-1-b', value: 3 },
                                { id: 'before-sickness-1-c', value: 5 },
                            ],
                        },
                        permanentTraitorPlayerIds: ['0'],
                        researchRoomIds: [],
                        exchangedSicknessThisTurnPlayerIds: [],
                        feverishPlayerIds: [],
                    },
                },
                monstersBeforeDefeat: core.monsters.map((monster) => ({ ...monster })),
            },
            consumedRabbitFootCardIds: [],
        };

        const viewForPlayer1 = BetrayalDomain.playerView?.(core, '1') as BetrayalCore;
        const deathPreventionDust = viewForPlayer1.recentRoll?.deathPrevention?.scenarioRuntimeBeforeDefeat.dust;

        expect(viewForPlayer1.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([2, 3, 5]);
        expect(viewForPlayer1.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([null, null, null]);
        expect(viewForPlayer1.scenarioRuntime.dust?.permanentTraitorPlayerIds).toEqual([]);
        expect(deathPreventionDust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([2, 3, 5]);
        expect(deathPreventionDust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([null, null, null]);
        expect(deathPreventionDust?.permanentTraitorPlayerIds).toEqual([]);
        expect(core.recentRoll.deathPrevention?.scenarioRuntimeBeforeDefeat.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([1, 4, 8]);
    });

    it('标本剥制按官方锁定文本执行力量检定成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.currentExplorer.traits.might = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('标本剥制');
        expect(core.latestDiscovery?.detail).toContain('力量检定 6');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点神志');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).not.toContain('obstacle');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('标本剥制');
        expect(core.latestDiscovery?.detail).toContain('力量检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 1 点物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置障碍物');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('obstacle');
    });

    it('外星几何按官方锁定文本执行知识检定成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('外星几何');
        expect(core.latestDiscovery?.detail).toContain('知识检定 7');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识');
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.currentExplorer.traits.speed).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('外星几何');
        expect(core.latestDiscovery?.detail).toContain('知识检定 1');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点速度');
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
    });

    it('即时事件效果进入翻牌确认队列，确认前不能结束回合', () => {
        let core = createStartedFirstScenarioCore(['0', '1']);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('外星几何');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：知识检定 7：获得 1 点知识；知识 +1' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '外星几何',
            stepKind: 'event-effect',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });

        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        ).valid).toBe(true);
    });

    it('小丑房间支持无事发生分支与精神伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小丑房间')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小丑房间');
        expect(core.latestDiscovery?.detail).toContain('神志检定 8');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.latestDiscovery?.tone).toBe('accent');
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小丑房间')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('小丑房间');
        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 2 点精神伤害');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.knowledge + core.currentExplorer.traits.sanity).toBe(6);
    });

    it('书本使用后会让事件非战斗检定用知识骰数并消费状态', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小丑房间')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 5,
                sanity: 2,
            },
            inventory: [
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['omen-book'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' });
        expect(core.currentExplorer.traits.sanity).toBe(1);
        expect(core.nextNonCombatTraitReplacement).toMatchObject({
            playerId: '0',
            sourceCardId: 'omen-book',
            replacementTrait: 'knowledge',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小丑房间');
        expect(core.latestDiscovery?.detail).toContain('神志检定 10');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.recentRoll?.dice).toHaveLength(5);
        expect(core.currentExplorer.traits.sanity).toBe(1);
        expect(core.nextNonCombatTraitReplacement).toBeNull();
    });

    it('属性检定最多使用 8 颗山屋骰，且单颗骰面只会是 0/1/2', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '测试高属性检定',
            roll: {
                trait: 'knowledge',
                branches: [
                    { min: 0, label: '记录骰池', effect: { mode: 'none', recommendedAction: 'endTurn' } },
                ],
            },
        }];
        core.currentExplorer.traits.knowledge = 12;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 2, 3, 1, 2, 3, 1, 2, 3, 3),
        );

        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.dice).toEqual([0, 1, 2, 0, 1, 2, 0, 1]);
        expect(core.recentRoll?.passiveBonus).toBe(1);
        expect(core.recentRoll?.dice.every((pip) => pip >= 0 && pip <= 2)).toBe(true);
        expect(core.latestDiscovery?.detail).toContain('知识检定 8');
    });

    it('一种怪异的感觉按固定 2 骰执行成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一种怪异的感觉')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('一种怪异的感觉');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.latestDiscovery?.tone).toBe('accent');
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一种怪异的感觉')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('一种怪异的感觉');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 2');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点神志');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(3);
    });

    it('葬礼按官方锁定文本执行神志检定和已发现墓地放置', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('葬礼');
        expect(core.latestDiscovery?.detail).toContain('神志检定 4');
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.roomId).toBe('ground-north');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 2');
        expect(core.latestDiscovery?.detail).toContain('神志 -1');
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.roomId).toBe('ground-north');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.rooms = core.rooms.map((room) => (
            room.id === 'ground-east'
                ? {
                    ...room,
                    name: '墓园',
                    state: 'discovered',
                    floor: 'ground',
                    visualId: 'graveyard',
                    connectedRoomIds: [...room.connectedRoomIds],
                    doorways: room.doorways.map((doorway) => ({ ...doorway })),
                }
                : room
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('力量 -1');
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.roomId).toBe('ground-east');
    });

    it('电话铃声按固定 2 骰执行增益、骰数精神伤害和骰数物理伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'knowledge', [2, 3, 4, 5, 6], 2, 2);
        const knowledgePositionBeforeMentalDamage = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('电话铃声');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点神志');
        expect(core.currentExplorer.traits.sanity).toBe(5);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 2');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的精神伤害');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeMentalDamage - 1);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'might', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 3, 3);
        const mightPositionBeforePhysicalDamage = traitTrackPosition(core, '0', 'might');
        const speedPositionBeforePhysicalDamage = traitTrackPosition(core, '0', 'speed');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 3, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 0');
        expect(core.latestDiscovery?.detail).toContain('受到两颗骰子的物理伤害');
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforePhysicalDamage - 3);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforePhysicalDamage - 1);
        expect(core.currentExplorer.traits.might).toBe(1);
        expect(core.currentExplorer.traits.speed).toBe(3);
    });

    it('小机器人按官方锁定文本执行抽物品和骰数物理伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const inventoryBefore = core.currentExplorer.inventory.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小机器人');
        expect(core.latestDiscovery?.detail).toContain('知识检定 9');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory).toHaveLength(inventoryBefore + 1);
        expect(core.currentExplorerInventory).toHaveLength(inventoryBefore + 1);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'might', [2, 3, 4, 5, 6], 2, 2);
        const mightPositionBeforeRobotDamage = traitTrackPosition(core, '0', 'might');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 1, 1, 1, 1, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小机器人');
        expect(core.latestDiscovery?.detail).toContain('知识检定 3');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforeRobotDamage - 2);
        expect(core.currentExplorer.traits.might).toBe(2);
        expect(core.currentExplorer.traits.speed).toBe(4);
    });

    it('肉质苔癣按官方锁定文本支持选择不吸入或吸入后投骰结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('肉质苔癣');
        expect(core.latestDiscovery?.detail).toContain('可选择大口吸入芳香');
        expect(core.pendingEventChoice?.sourceTitle).toBe('肉质苔癣');
        expect(core.discardCounts.event).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(false);

        const acceptWithoutTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true }),
        );
        expect(acceptWithoutTrait.valid).toBe(true);

        const mightBeforeSkip = core.currentExplorer.traits.might;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.summary).toBe('不吸入芳香');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.currentExplorer.traits.might).toBe(mightBeforeSkip);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.summary).toBe('大口吸入芳香');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点任意属性');
        expect(core.latestDiscovery?.detail).not.toContain('知识 +1');
        expect(core.pendingEventChoice?.sourceTitle).toBe('肉质苔癣');
        expect(core.pendingEventChoice?.effect.mode).toBe('chosenTrait');
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：知识 +1' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '肉质苔癣',
            stepKind: 'event-effect',
            text: '事件效果：知识 +1',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        ).valid).toBe(true);
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'knowledge', [2, 3, 4, 5, 6], 2, 2);
        const knowledgePositionBeforeMossDamage = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 0');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的精神伤害');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeMossDamage - 2);
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('兔脚重掷肉质苔癣成功分支时保留待选属性而不提前结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, might: 4, knowledge: 4 },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.pendingEventChoice?.effect.mode).toBe('chosenTrait');
        expect(core.recentRoll?.latestLabel).toContain('获得 1 点任意属性');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.dice).toEqual([2, 2]);
        expect(core.pendingEventChoice?.effect.mode).toBe('chosenTrait');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.latestDiscovery?.detail).toContain('获得 1 点任意属性');
        expect(core.latestDiscovery?.detail).not.toContain('知识 +1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
    });

    it('夜幕众星按官方锁定文本支持选择属性检定、所选属性增减和治疗', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('夜幕众星');
        expect(core.latestDiscovery?.detail).toContain('选择一项属性进行检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('夜幕众星');
        expect(core.discardCounts.event).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(false);

        const missingTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {}),
        );
        expect(missingTrait.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.summary).toBe('选择一项属性进行检定');
        expect(core.latestDiscovery?.detail).toContain('知识检定 9');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点所选属性');
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.trait).toBe('knowledge');
        core = acknowledgeSingleEventEffectResolution(core, '夜幕众星', '知识 +1');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 4');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点所选属性');
        expect(core.latestDiscovery?.detail).toContain('速度 -1');
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '夜幕众星', '速度 -1');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        const sanityTemplateValue = core.currentExplorer.traits.sanity;
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 4, sanityTemplateValue, sanityTemplateValue + 1], 1, 3);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'sanity' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('治疗所选属性');
        expect(core.latestDiscovery?.detail).toContain('治疗神志');
        expect(core.currentExplorer.traits.sanity).toBe(sanityTemplateValue);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '夜幕众星', '治疗神志');
    });

    it('一抹鲜红按官方锁定文本支持可选作祟检定、速度奖励和跳过伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'speed', [1, 3, 4, 4, 5], 2, 2);
        const speedPositionBeforeScarletReward = traitTrackPosition(core, '0', 'speed');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('一抹鲜红');
        expect(core.latestDiscovery?.detail).toContain('可选择进行作祟检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一抹鲜红');
        expect(core.discardCounts.event).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.phase).toBe('preHaunt');
        expect(core.latestDiscovery?.detail).toContain('选择进行作祟检定：总点数 0');
        expect(core.latestDiscovery?.detail).toContain('速度 +1');
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforeScarletReward + 1);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '一抹鲜红', '速度 +1');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        const mightBeforeSkip = core.currentExplorer.traits.might;
        const speedBeforeSkip = core.currentExplorer.traits.speed;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('受到 1 颗骰子的物理伤害');
        expect(core.currentExplorer.traits.might + core.currentExplorer.traits.speed).toBe(mightBeforeSkip + speedBeforeSkip - 1);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '一抹鲜红', '物理伤害');
    });

    it('一抹鲜红作祟检定成功会复用正式 haunt 触发链路', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        const extraOmens = [
            { id: 'omen-book', name: '书本', kind: 'omen' as const },
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'mask', name: '面具', kind: 'omen' as const },
        ];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            ...extraOmens,
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === core.currentExplorer.playerId
                ? { ...core.currentExplorer, inventory: [...core.currentExplorer.inventory] }
                : explorer
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('0');
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'haunt-revealer',
            traitorPlayerId: '0',
            teamModel: 'one-traitor',
            reasonLabel: '作祟揭秘者',
            candidatePlayerIds: ['0'],
            excludedPlayerIds: [],
            representativeOnly: false,
        });
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-traitor',
            anchorPlayerId: '0',
            nextPlayerId: '1',
            reasonLabel: '叛徒左侧玩家先行动',
            representativeOnly: false,
        });
        expect(core.scenarioRuntime.hauntCardNumber).toBe(1);
        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Splash of Crimson');
        expect(core.latestDiscovery?.detail).toContain('选择进行作祟检定：总点数 6');
        expect(core.activityLog[0]?.text).toContain('Crimson Jack Returns');
    });

    it('作祟揭示读模型先列公开介绍和设置，再分开阅读秘密目标', () => {
        const core = createFirstScenarioHauntCore();
        const protocol = resolveBetrayalHauntRevealProtocol(core);

        expect(protocol.active).toBe(true);
        expect(protocol.hauntCardNumber).toBe(1);
        expect(protocol.hauntType).toBe('one-traitor');
        expect(protocol.publicSteps.map((step) => step.id)).toEqual([
            'heroes-intro',
            'heroes-setup',
            'traitor-intro',
            'traitor-setup',
        ]);
        expect(protocol.setupQueue.map((entry) => entry.id)).toEqual([
            'assign-revealer-traitor',
            'traitor-remains-in-game',
            'heal-and-boost-traitor',
            'monster-card-left-of-traitor',
            'prepare-jack-spirit-tokens',
            'first-player-left-of-traitor',
        ]);
        expect(protocol.setupQueue.filter((entry) => entry.status === 'resolved').map((entry) => entry.id)).toEqual([
            'assign-revealer-traitor',
            'traitor-remains-in-game',
            'heal-and-boost-traitor',
            'first-player-left-of-traitor',
        ]);
        expect(protocol.secretBoundary).toEqual({
            heroBookVisibleTo: 'heroes',
            traitorBookVisibleTo: 'traitor',
            revealOnUse: true,
        });
    });

    it('参考资料权限读模型按作祟阶段、阵营和怪物运行态开放', () => {
        const preHauntCore = createStartedFirstScenarioCore();
        const preHauntReferences = resolveBetrayalReferenceCardAccess(preHauntCore, '0');
        expect(preHauntReferences.find((entry) => entry.id === 'player-reference-front')).toMatchObject({
            active: true,
            visibleTo: 'all',
            viewerCanOpen: true,
            source: 'base-rule',
        });
        expect(preHauntReferences.find((entry) => entry.id === 'heroes-book')).toMatchObject({
            active: false,
            visibleTo: 'none',
            viewerCanOpen: false,
            reason: '作祟尚未开始，不能打开作祟剧本书。',
        });

        const crimsonJackCore = createFirstScenarioHauntCore();
        const traitorPlayerId = crimsonJackCore.scenarioRuntime.traitorPlayerId!;
        const heroPlayerId = crimsonJackCore.playerIds.find((playerId) => playerId !== traitorPlayerId)!;
        const traitorReferences = resolveBetrayalReferenceCardAccess(crimsonJackCore, traitorPlayerId);
        const heroReferences = resolveBetrayalReferenceCardAccess(crimsonJackCore, heroPlayerId);
        expect(traitorReferences.find((entry) => entry.id === 'traitor-book')).toMatchObject({
            active: true,
            visibleTo: 'traitor',
            viewerSide: 'traitor',
            viewerCanOpen: true,
            source: 'haunt-protocol',
        });
        expect(traitorReferences.find((entry) => entry.id === 'heroes-book')).toMatchObject({
            active: true,
            visibleTo: 'heroes',
            viewerCanOpen: false,
        });
        expect(heroReferences.find((entry) => entry.id === 'heroes-book')).toMatchObject({
            active: true,
            visibleTo: 'heroes',
            viewerSide: 'hero',
            viewerCanOpen: true,
        });
        expect(heroReferences.find((entry) => entry.id === 'traitor-book')).toMatchObject({
            active: true,
            visibleTo: 'traitor',
            viewerCanOpen: false,
        });

        const dustCore = createDustHauntCore();
        const hiddenTraitorReferences = resolveBetrayalReferenceCardAccess(dustCore, '0');
        expect(hiddenTraitorReferences.find((entry) => entry.id === 'heroes-book')).toMatchObject({
            active: true,
            visibleTo: 'all',
            viewerCanOpen: true,
        });
        expect(hiddenTraitorReferences.find((entry) => entry.id === 'traitor-book')).toMatchObject({
            active: false,
            visibleTo: 'none',
            viewerCanOpen: false,
            reason: '该作祟当前没有公开叛徒书入口，避免泄露隐藏身份或不存在的秘密段落。',
        });

        const magicCameraCore = createMagicCameraHauntCore('1');
        expect(resolveBetrayalReferenceCardAccess(magicCameraCore, '0')
            .find((entry) => entry.id === 'monster-reference-card')).toMatchObject({
            active: true,
            visibleTo: 'all',
            viewerCanOpen: true,
            source: 'monster-box',
            representativeOnly: true,
        });
    });

    it('作祟目标计数轨按已建档剧本运行态派生并保留代表边界', () => {
        const crimsonJackCore = createFirstScenarioHauntCore();
        crimsonJackCore.scenarioRuntime.exorcismCircleRoomIds = ['ground-north'];
        const crimsonJackTrack = resolveBetrayalNumberTracks(crimsonJackCore)
            .find((track) => track.id === 'crimson-jack-exorcism-circles');

        expect(crimsonJackTrack).toMatchObject({
            kind: 'haunt-objective',
            label: '驱魔圈',
            value: 1,
            min: 0,
            max: 2,
            targetValue: 2,
            currentLabel: '1/2',
            targetLabel: '2 个驱魔圈',
            statusLabel: '继续研究驱魔',
            progressPercent: 50,
            source: 'haunt-contract',
            representativeOnly: true,
        });

        const dustCore = createDustHauntCore();
        dustCore.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'upper-west'];
        const dustTrack = resolveBetrayalNumberTracks(dustCore)
            .find((track) => track.id === 'dust-research-tokens');

        expect(dustTrack).toMatchObject({
            kind: 'haunt-objective',
            label: '研究 token',
            value: 2,
            max: 8,
            currentLabel: '2/8',
            statusLabel: '治愈检定 +4',
            progressPercent: 25,
            representativeOnly: true,
        });
    });

    it('作祟 token 目录统一列出现有标记、目标、怪物、疾病和尸体', () => {
        const markerCore = createStartedFirstScenarioCore(['0', '1', '2']);
        markerCore.rooms = markerCore.rooms.map((room) => (
            room.id === 'ground-north'
                ? { ...room, markerTokens: ['obstacle', 'secretPassage'] }
                : room
        ));
        const markerTokens = resolveBetrayalHauntTokenInstances(markerCore)
            .filter((token) => token.kind === 'room-marker');
        expect(markerTokens.map((token) => [token.label, token.roomId, token.visibility]).sort()).toEqual([
            ['秘密通道', 'ground-north', 'public'],
            ['障碍物', 'ground-north', 'public'],
        ]);
        expect(markerTokens.every((token) => token.visibleToPlayerIds.length === 3)).toBe(true);

        const crimsonJackCore = createFirstScenarioHauntCore();
        crimsonJackCore.scenarioRuntime.exorcismCircleRoomIds = ['ground-north'];
        expect(resolveBetrayalHauntTokenInstances(crimsonJackCore)
            .find((token) => token.id === 'crimson-jack-exorcism-circle-ground-north')).toMatchObject({
            kind: 'haunt-objective',
            label: '驱魔圈',
            roomId: 'ground-north',
            visibility: 'public',
            source: 'haunt-contract',
            representativeOnly: true,
        });

        const dustCore = createDustHauntCore();
        dustCore.scenarioRuntime.dust!.researchRoomIds = ['ground-north'];
        const dustViewForPlayer1 = BetrayalDomain.playerView?.(dustCore, '1') as BetrayalCore;
        const dustTokens = resolveBetrayalHauntTokenInstances(dustViewForPlayer1);
        const ownSicknessTokens = dustTokens.filter((token) => token.kind === 'sickness' && token.ownerPlayerId === '1');
        const hiddenSicknessTokens = dustTokens.filter((token) => token.kind === 'sickness' && token.ownerPlayerId === '0');
        expect(ownSicknessTokens).toHaveLength(3);
        expect(ownSicknessTokens.every((token) => (
            token.visibility === 'owner-only'
            && token.visibleToPlayerIds.join(',') === '1'
            && token.value !== null
            && !token.valueHidden
        ))).toBe(true);
        expect(hiddenSicknessTokens).toHaveLength(3);
        expect(hiddenSicknessTokens.every((token) => token.value === null && token.valueHidden)).toBe(true);
        expect(dustTokens.find((token) => token.id === 'dust-research-token-ground-north')).toMatchObject({
            kind: 'haunt-objective',
            label: '研究 token',
            roomId: 'ground-north',
            source: 'haunt-contract',
        });

        const helpingHandsCore = createHelpingHandsHauntCore();
        const trollHandTokens = resolveBetrayalHauntTokenInstances(helpingHandsCore)
            .filter((token) => token.kind === 'monster' && token.label === '巨魔手');
        expect(trollHandTokens).toHaveLength(2);
        expect(trollHandTokens.every((token) => (
            token.status === 'active'
            && token.source === 'monster-box'
            && token.asset?.includes('betrayal/tokens/monsters/small-monster-')
        ))).toBe(true);

        const corpseCore = createCorpseLootReadyCore();
        expect(resolveBetrayalHauntTokenInstances(corpseCore)
            .find((token) => token.id === 'corpse-0')).toMatchObject({
            kind: 'corpse',
            label: '杰登·琼斯尸体',
            roomId: 'hallway',
            ownerPlayerId: '0',
            value: 2,
            status: 'lootable',
            source: 'death-rule',
        });
    });

    it('一瓶微尘仍可选择跳过作祟检定并结算原事件效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一瓶微尘')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('一瓶微尘');
        expect(core.latestDiscovery?.detail).toContain('可选择进行作祟检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一瓶微尘');
        expect(core.discardCounts.event).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(false);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('力量 -1');
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：力量 -1；神志 +1' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '一瓶微尘',
            stepKind: 'event-effect',
            text: '事件效果：力量 -1；神志 +1',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('一瓶微尘作祟检定成功会进入灰尘剧本并分发隐藏疾病标记', () => {
        const core = createDustHauntCore();

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'hidden-traitor',
            traitorPlayerId: null,
            teamModel: 'hidden-traitor',
            reasonLabel: '隐藏叛徒',
            candidatePlayerIds: ['0', '1', '2'],
            excludedPlayerIds: [],
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-revealer',
            anchorPlayerId: '0',
            nextPlayerId: '1',
            reasonLabel: '作祟揭秘者左侧玩家先行动',
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntCardNumber).toBe(3);
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Dusty Vial');
        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([1, 2, 3]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']).toHaveLength(3);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']).toHaveLength(3);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds).toEqual(['0']);
    });

    it('灰尘隐藏叛徒作祟揭示不公开叛徒书，但必须保留隐藏身份和 setup 队列', () => {
        const protocol = resolveBetrayalHauntRevealProtocol(createDustHauntCore());

        expect(protocol.active).toBe(true);
        expect(protocol.hauntCardNumber).toBe(3);
        expect(protocol.hauntType).toBe('hidden-traitor');
        expect(protocol.publicSteps.map((step) => step.id)).toEqual([
            'heroes-intro',
            'heroes-setup',
        ]);
        expect(protocol.setupQueue.map((entry) => entry.id)).toEqual([
            'announce-hidden-traitor',
            'deal-secret-sickness-tokens',
            'monster-card-left-of-revealer',
            'first-player-left-of-revealer',
            'prepare-research-tokens',
        ]);
        expect(protocol.setupQueue.find((entry) => entry.id === 'deal-secret-sickness-tokens')?.status).toBe('resolved');
        expect(protocol.setupQueue.find((entry) => entry.id === 'prepare-research-tokens')?.status).toBe('manual-check');
        expect(protocol.secretBoundary).toEqual({
            heroBookVisibleTo: 'all',
            traitorBookVisibleTo: 'none',
            revealOnUse: true,
        });
    });

    it('魔法相机作祟揭示队列必须列出摄影师、相机和 Essence 设置', () => {
        const protocol = resolveBetrayalHauntRevealProtocol(createMagicCameraHauntCore(null));

        expect(protocol.active).toBe(true);
        expect(protocol.hauntCardNumber).toBe(33);
        expect(protocol.hauntType).toBe('one-traitor');
        expect(protocol.setupQueue.map((entry) => entry.id)).toEqual([
            'traitor-remains-in-game',
            'place-phantom-photographers',
            'recover-magic-camera',
            'deal-hero-essence-tokens',
            'first-player-left-of-traitor',
        ]);
        expect(protocol.setupQueue.every((entry) => entry.status === 'resolved')).toBe(true);
    });

    it('作祟 setup 进度读模型汇总已解决和待人工确认状态', () => {
        expect(resolveBetrayalHauntSetupProgress(createStartedFirstScenarioCore())).toMatchObject({
            active: false,
            hauntCardNumber: null,
            status: 'inactive',
            totalCount: 0,
            resolvedCount: 0,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
            needsFormalConfirmationCommand: false,
            representativeOnly: false,
        });

        const dustProgress = resolveBetrayalHauntSetupProgress(createDustHauntCore());
        expect(dustProgress).toMatchObject({
            active: true,
            hauntCardNumber: 3,
            status: 'manual-check-required',
            totalCount: 5,
            resolvedCount: 3,
            manualCheckCount: 2,
            manualCheckEntryIds: ['monster-card-left-of-revealer', 'prepare-research-tokens'],
            needsFormalConfirmationCommand: true,
            representativeOnly: true,
        });

        expect(resolveBetrayalHauntSetupProgress(createMagicCameraHauntCore(null))).toMatchObject({
            active: true,
            hauntCardNumber: 33,
            status: 'resolved',
            totalCount: 5,
            resolvedCount: 5,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
            needsFormalConfirmationCommand: false,
            representativeOnly: true,
        });
    });

    it('作祟 setup 命令预览列出当前证据和待人工确认步骤', () => {
        expect(resolveBetrayalHauntSetupCommandPreviews(createStartedFirstScenarioCore())).toMatchObject({
            active: false,
            hauntCardNumber: null,
            status: 'inactive',
            previews: [],
            readyCount: 0,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
            needsFormalConfirmationCommand: false,
            representativeOnly: false,
        });

        const dustPreview = resolveBetrayalHauntSetupCommandPreviews(createDustHauntCore());
        expect(dustPreview).toMatchObject({
            active: true,
            hauntCardNumber: 3,
            status: 'manual-check-required',
            readyCount: 3,
            manualCheckCount: 2,
            manualCheckEntryIds: ['monster-card-left-of-revealer', 'prepare-research-tokens'],
            needsFormalConfirmationCommand: true,
            representativeOnly: true,
        });
        expect(dustPreview.previews.find((preview) => preview.entryId === 'deal-secret-sickness-tokens')).toMatchObject({
            action: 'deal-secret-tokens',
            targetPlayerIds: ['0', '1', '2'],
            alreadyApplied: true,
            canConfirmFromCurrentState: true,
            requiresManualConfirmation: false,
        });
        expect(dustPreview.previews.find((preview) => preview.entryId === 'prepare-research-tokens')).toMatchObject({
            action: 'prepare-token-pool',
            targetRoomIds: [],
            alreadyApplied: false,
            canConfirmFromCurrentState: false,
            requiresManualConfirmation: true,
            contractGaps: ['token-placement-command', 'room-selection'],
        });
    });

    it('灰尘 setup 可以正式确认怪物参考卡和研究 token 池并更新队列进度', () => {
        const core = createDustHauntCore();

        const confirmed = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY,
            '1',
            { entryId: 'prepare-research-tokens' },
        );

        expect(confirmed.scenarioRuntime.hauntSetupQueue.find((entry) => entry.id === 'prepare-research-tokens')).toMatchObject({
            status: 'resolved',
        });
        expect(resolveBetrayalHauntSetupProgress(confirmed)).toMatchObject({
            status: 'manual-check-required',
            totalCount: 5,
            resolvedCount: 4,
            manualCheckCount: 1,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
            needsFormalConfirmationCommand: true,
        });

        const confirmedPreview = resolveBetrayalHauntSetupCommandPreviews(confirmed);
        expect(confirmedPreview).toMatchObject({
            status: 'manual-check-required',
            readyCount: 4,
            manualCheckCount: 1,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
        expect(confirmedPreview.previews.find((preview) => preview.entryId === 'prepare-research-tokens')).toMatchObject({
            alreadyApplied: true,
            canConfirmFromCurrentState: true,
            requiresManualConfirmation: false,
            contractGaps: ['token-placement-command', 'room-selection'],
        });
        expect(confirmed.activityLog[0]?.text).toContain('确认已准备 8 个研究 token');

        const fullyConfirmed = applyBetrayalCommand(
            confirmed,
            BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY,
            '1',
            { entryId: 'monster-card-left-of-revealer' },
        );
        expect(resolveBetrayalHauntSetupProgress(fullyConfirmed)).toMatchObject({
            status: 'resolved',
            totalCount: 5,
            resolvedCount: 5,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
            needsFormalConfirmationCommand: false,
        });
        expect(resolveBetrayalHauntSetupCommandPreviews(fullyConfirmed)).toMatchObject({
            status: 'ready',
            readyCount: 5,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
        });
        expect(fullyConfirmed.activityLog[0]?.text).toContain('确认怪物参考卡已放在作祟揭秘者左侧');
    });

    it('灰尘 setup 确认命令拒绝无效、非灰尘和重复确认', () => {
        expect(BetrayalDomain.validate(
            { core: createStartedFirstScenarioCore(), sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY, '0', {
                entryId: 'prepare-research-tokens',
            }),
        )).toMatchObject({
            valid: false,
            error: '当前还未进入 haunt 阶段。',
        });

        expect(BetrayalDomain.validate(
            { core: createDustHauntCore(), sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY, '1', {
                entryId: 'unknown-entry' as never,
            }),
        )).toMatchObject({
            valid: false,
            error: '当前 setup 队列没有这个条目。',
        });

        expect(BetrayalDomain.validate(
            { core: createHelpingHandsHauntCore(), sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY, '1', {
                entryId: 'monster-card-left-of-revealer',
            }),
        )).toMatchObject({
            valid: false,
            error: '当前只支持确认灰尘 setup 条目。',
        });

        const confirmed = applyBetrayalCommand(
            createDustHauntCore(),
            BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY,
            '1',
            { entryId: 'prepare-research-tokens' },
        );
        expect(BetrayalDomain.validate(
            { core: confirmed, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY, '1', {
                entryId: 'prepare-research-tokens',
            }),
        )).toMatchObject({
            valid: false,
            error: '该 setup 条目已经确认。',
        });
    });

    it('作祟 setup 命令预览会把代表剧本已放置对象映射成可确认目标', () => {
        const helpingHandsPreview = resolveBetrayalHauntSetupCommandPreviews(createHelpingHandsHauntCore());
        expect(helpingHandsPreview).toMatchObject({
            hauntCardNumber: 12,
            status: 'manual-check-required',
            readyCount: 3,
            manualCheckCount: 1,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
        expect(helpingHandsPreview.previews.find((preview) => preview.entryId === 'recover-strange-amulet')).toMatchObject({
            action: 'recover-card',
            targetPlayerIds: ['0'],
            targetCardIds: ['strange-amulet'],
            alreadyApplied: true,
        });
        expect(helpingHandsPreview.previews.find((preview) => preview.entryId === 'place-troll-hands')).toMatchObject({
            action: 'place-monster-tokens',
            targetMonsterIds: ['troll-hand-1', 'troll-hand-2'],
            targetRoomIds: ['entrance-hall', 'basement-landing'],
            canConfirmFromCurrentState: true,
        });

        const magicCameraPreview = resolveBetrayalHauntSetupCommandPreviews(createMagicCameraHauntCore(null));
        expect(magicCameraPreview).toMatchObject({
            hauntCardNumber: 33,
            status: 'ready',
            readyCount: 5,
            manualCheckCount: 0,
        });
        expect(magicCameraPreview.previews.find((preview) => preview.entryId === 'place-phantom-photographers')).toMatchObject({
            action: 'place-monster-tokens',
            targetMonsterIds: ['phantom-photographer-1', 'phantom-photographer-2', 'phantom-photographer-3'],
            canConfirmFromCurrentState: true,
        });
        expect(magicCameraPreview.previews.find((preview) => preview.entryId === 'deal-hero-essence-tokens')).toMatchObject({
            action: 'deal-secret-tokens',
            targetPlayerIds: ['1', '2'],
            alreadyApplied: true,
        });
    });

    it('顽石之血触发 setup 时每名探索者脚下放 1 个石像小天使，额外石像优先放在英雄视线外', () => {
        const core = createBloodFromStoneTriggeredWithAutoPlacementCore();

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(5);
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-revealer',
            anchorPlayerId: '0',
            nextPlayerId: '1',
        });

        const stoneCherubs = core.monsters.filter((monster) => monster.definitionId === 'blood-from-stone-stone-cherub');
        expect(stoneCherubs).toHaveLength(6);
        expect(stoneCherubs.find((monster) => monster.id === 'stone-cherub-explorer-0')?.roomId).toBe('ground-east');
        expect(stoneCherubs.find((monster) => monster.id === 'stone-cherub-explorer-1')?.roomId).toBe('entrance-hall');
        expect(stoneCherubs.find((monster) => monster.id === 'stone-cherub-explorer-2')?.roomId).toBe('entrance-hall');

        const plan = resolveBloodFromStoneSetupPlacementPlan(core);
        expect(plan).toMatchObject({
            active: true,
            additionalStoneCherubCount: 3,
            totalRequiredStoneCherubCount: 6,
            placedStoneCherubCount: 6,
            pendingPlayerChoiceCount: 0,
            canFullyAutoPlace: true,
        });
        expect(plan.explorerPlacements.map((placement) => placement.monsterId)).toEqual([
            'stone-cherub-explorer-0',
            'stone-cherub-explorer-1',
            'stone-cherub-explorer-2',
        ]);
        expect(plan.automaticExtraPlacements).toHaveLength(3);
        const heroRoomIds = [core.currentExplorer, ...core.otherExplorers].map((explorer) => explorer.roomId);
        for (const placement of plan.automaticExtraPlacements) {
            expect(heroRoomIds.every((roomId) => !isBetrayalRoomInLineOfSight(core, roomId, placement.roomId))).toBe(true);
        }

        expect(resolveBetrayalHauntSetupProgress(core)).toMatchObject({
            hauntCardNumber: 5,
            totalCount: 5,
            resolvedCount: 4,
            manualCheckCount: 1,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
        expect(core.scenarioRuntime.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId['1'])
            .toContain('stone-cherub-explorer-1');
    });

    it('顽石之血会在揭秘者结束回合后自然进入石像小天使怪物回合，并在凝视收口后进入下一玩家', () => {
        let core = createBloodFromStoneTriggeredWithAutoPlacementCore();
        for (const playerId of ['0', '1', '2']) {
            setHighCapacityGeneralDamageTracks(core, playerId);
        }

        expect(core.currentPlayer).toBe('1');
        expect(resolveBloodFromStoneMonsterTurnStatus(core)).toMatchObject({
            active: false,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
        });
        expect(resolveBetrayalMonsterActionPanel(core)).toMatchObject({
            active: false,
            reason: '等待揭秘者结束回合后开始石像小天使怪物回合。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        expect(core.currentPlayer).toBe('2');
        expect(resolveBloodFromStoneMonsterTurnStatus(core).active).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        expect(core.currentPlayer).toBe('0');
        expect(resolveBloodFromStoneMonsterTurnStatus(core).active).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.currentPlayer).toBe('0');
        expect(resolveBloodFromStoneMonsterTurnStatus(core)).toMatchObject({
            active: true,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
        });
        expect(resolveBetrayalMonsterActionPanel(core).active).toBe(true);
        expect(core.activityLog[0]?.text).toContain('石像小天使怪物回合开始');

        const stoneCherubIds = core.monsters
            .filter((monster) => monster.definitionId === 'blood-from-stone-stone-cherub')
            .map((monster) => monster.id);
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: stoneCherubIds,
            skippedMonsterIdsThisTurn: stoneCherubIds,
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        };

        expect(resolveBloodFromStoneMonsterTurnEndPreview(core)).toMatchObject({
            active: true,
            canEnd: true,
            controllerPlayerId: '0',
            nextPlayerId: '1',
        });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1, 1, 1),
        );

        let pendingDamageSafety = 0;
        while (core.pendingDamageAllocation) {
            const playerId = core.pendingDamageAllocation.playerId;
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                playerId,
                { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
            );
            pendingDamageSafety += 1;
            expect(pendingDamageSafety).toBeLessThan(10);
        }

        expect(core.currentPlayer).toBe('1');
        expect(resolveBloodFromStoneMonsterTurnStatus(core)).toMatchObject({
            active: false,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
        });
        expect(resolveBetrayalMonsterActionPanel(core)).toMatchObject({
            active: false,
            reason: '等待揭秘者结束回合后开始石像小天使怪物回合。',
        });
    });

    it('顽石之血额外石像视线外房间不足时必须留下玩家选房缺口', () => {
        const core = createBloodFromStoneManualPlacementGapCore();

        const plan = resolveBloodFromStoneSetupPlacementPlan(core);
        expect(plan).toMatchObject({
            active: true,
            additionalStoneCherubCount: 3,
            totalRequiredStoneCherubCount: 6,
            placedStoneCherubCount: 5,
            pendingPlayerChoiceCount: 1,
            canFullyAutoPlace: false,
        });
        expect(plan.automaticExtraPlacements.map((placement) => placement.roomId)).toEqual([
            'upper-landing',
            'basement-landing',
        ]);
        expect(plan.playerChoiceCandidateRoomIds).toEqual(expect.arrayContaining([
            'entrance-hall',
            'hallway',
            'grand-staircase',
            'upper-landing',
            'basement-landing',
        ]));

        const progress = resolveBetrayalHauntSetupProgress(core);
        expect(progress).toMatchObject({
            hauntCardNumber: 5,
            status: 'manual-check-required',
            manualCheckEntryIds: ['place-additional-stone-cherubs', 'monster-card-left-of-revealer'],
        });

        const preview = resolveBetrayalHauntSetupCommandPreviews(core);
        const additionalPlacement = preview.previews.find((item) => item.entryId === 'place-additional-stone-cherubs');
        expect(additionalPlacement).toMatchObject({
            action: 'place-monster-tokens',
            targetMonsterIds: ['stone-cherub-extra-1', 'stone-cherub-extra-2'],
            targetRoomIds: ['upper-landing', 'basement-landing'],
            canConfirmFromCurrentState: false,
            requiresManualConfirmation: true,
            contractGaps: ['formal-command', 'ui-confirmation', 'token-placement-command', 'room-selection'],
        });
        expect(additionalPlacement?.evidence.join(' ')).toContain('还剩 1 个必须由玩家在屋内合法房间中选择放置');
    });

    it('顽石之血额外石像补放必须选择刚好数量的已发现房间', () => {
        let core = createBloodFromStoneManualPlacementGapCore();

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
                '0',
                { roomIds: [] },
            ),
        )).toMatchObject({
            valid: false,
            error: '必须选择 1 个房间来补放石像小天使。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
                '0',
                { roomIds: ['upper-west'] },
            ),
        )).toMatchObject({
            valid: false,
            error: '石像小天使只能补放到屋内已发现房间。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
            '0',
            { roomIds: ['entrance-hall'] },
        );

        const placedStoneCherub = core.monsters.find((monster) => monster.id === 'stone-cherub-extra-3');
        expect(placedStoneCherub).toMatchObject({
            definitionId: 'blood-from-stone-stone-cherub',
            roomId: 'entrance-hall',
        });

        const plan = resolveBloodFromStoneSetupPlacementPlan(core);
        expect(plan.pendingPlayerChoiceCount).toBe(0);
        expect(plan.playerChoicePlacements).toEqual([
            expect.objectContaining({
                monsterId: 'stone-cherub-extra-3',
                roomId: 'entrance-hall',
                source: 'extra-player-choice',
            }),
        ]);
        expect(resolveBetrayalHauntSetupProgress(core)).toMatchObject({
            hauntCardNumber: 5,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
    });

    it('顽石之血额外石像多缺口时允许把多个石像补放到同一已发现房间', () => {
        let core = createBloodFromStoneMultiGapManualPlacementCore();

        const planBefore = resolveBloodFromStoneSetupPlacementPlan(core);
        expect(planBefore).toMatchObject({
            active: true,
            additionalStoneCherubCount: 3,
            totalRequiredStoneCherubCount: 6,
            placedStoneCherubCount: 4,
            pendingPlayerChoiceCount: 2,
            canFullyAutoPlace: false,
        });
        expect(planBefore.automaticExtraPlacements.map((placement) => placement.roomId)).toEqual([
            'upper-landing',
        ]);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
                '0',
                { roomIds: ['entrance-hall'] },
            ),
        )).toMatchObject({
            valid: false,
            error: '必须选择 2 个房间来补放石像小天使。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
                '0',
                { roomIds: ['entrance-hall', 'entrance-hall'] },
            ),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
            '0',
            { roomIds: ['entrance-hall', 'entrance-hall'] },
        );

        expect(core.monsters.filter(
            (monster) =>
                monster.definitionId === 'blood-from-stone-stone-cherub' &&
                monster.roomId === 'entrance-hall' &&
                (monster.id === 'stone-cherub-extra-2' || monster.id === 'stone-cherub-extra-3'),
        )).toHaveLength(2);
        expect(resolveBloodFromStoneSetupPlacementPlan(core)).toMatchObject({
            pendingPlayerChoiceCount: 0,
            playerChoicePlacements: [
                expect.objectContaining({
                    monsterId: 'stone-cherub-extra-2',
                    roomId: 'entrance-hall',
                    source: 'extra-player-choice',
                }),
                expect.objectContaining({
                    monsterId: 'stone-cherub-extra-3',
                    roomId: 'entrance-hall',
                    source: 'extra-player-choice',
                }),
            ],
        });
        expect(resolveBetrayalHauntSetupProgress(core)).toMatchObject({
            hauntCardNumber: 5,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
    });

    it('灰尘剧本寻找解药成功会在当前恶兆板块放置研究标记', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        setTestExplorerTraits(core, '1', { knowledge: 3 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.scenarioRuntime.dust?.researchRoomIds).toContain('ground-north');
        expect(core.usedCardIdsThisTurn).toContain('search-for-cure');
        expect(core.recentRoll?.latestLabel).toBe('放置研究标记');
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            dice: [2, 2, 2],
            passiveBonus: 0,
        });
        expect(core.recommendedAction).toBe('endTurn');
    });

    it('灰尘剧本寻找解药失败会跳过死亡玩家并与左侧存活玩家随机交换疾病标记', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        setTestExplorerTraits(core, '1', { knowledge: 3 });
        const researchRoomIdsBefore = [...core.scenarioRuntime.dust!.researchRoomIds];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.dust?.researchRoomIds).toEqual(researchRoomIdsBefore);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            latestLabel: '交换疾病标记',
            dice: [0, 0, 0],
        });
        expect(core.activityLog[0]?.text).toContain('与左侧玩家随机交换了疾病标记');
        expect(core.usedCardIdsThisTurn).toContain('search-for-cure');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([7, 8, 9]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([1, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([12, 13, 14]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['3']?.map((token) => token.value)).toEqual([4, 10, 11]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('3');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
    });

    it('灰尘剧本寻找解药失败后若所有存活者都永久感染则叛徒胜利', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0', '2'];
        setTestExplorerTraits(core, '1', { knowledge: 3 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
        });
        expect(core.endgameResult?.winners.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds.sort()).toEqual(['0', '2']);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            latestLabel: '交换疾病标记',
            dice: [0, 0, 0],
        });
    });

    it('灰尘剧本治愈灰尘成功会进入英雄胜利终局', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        setTestExplorerTraits(core, '1', { knowledge: 5 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.endgameResult?.winners).toEqual(['1', '2']);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈成功',
            dice: [2, 2, 2, 2, 2],
            passiveBonus: 4,
        });
    });

    it('灰尘剧本治愈灰尘可选择任意属性并按多个研究标记加值', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway', 'entrance-hall'];
        setTestExplorerTraits(core, '1', {
            might: 6,
            speed: 4,
            knowledge: 2,
            sanity: 2,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'speed' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈成功',
            trait: 'speed',
            rollLabel: '速度检定',
            dice: [2, 2, 2, 2],
            passiveBonus: 6,
        });
    });

    it.each([
        { card: { id: 'omen-book', name: '书本', kind: 'omen' as const }, trait: 'knowledge' as const },
        { card: { id: 'skull', name: '头骨', kind: 'omen' as const }, trait: 'knowledge' as const },
        { card: { id: 'dog', name: '狗', kind: 'omen' as const }, trait: 'speed' as const },
        { card: { id: 'mask', name: '面具', kind: 'omen' as const }, trait: 'speed' as const },
        { card: { id: 'holy-symbol', name: '圣符', kind: 'omen' as const }, trait: 'sanity' as const },
        { card: { id: 'ring', name: '指环', kind: 'omen' as const }, trait: 'sanity' as const },
        { card: { id: 'idol', name: '雕像', kind: 'omen' as const }, trait: 'might' as const },
    ] as const)('灰尘治愈灰尘会计算$card.name的被动检定加值并叠加研究标记', ({ card, trait }) => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        activateTestExplorer(core, '1');
        core = placeCurrentExplorerInDustResearchRoom(core, 'omen');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway', 'entrance-hall'];
        setTestExplorerTraits(core, '1', { [trait]: 4 } as Partial<Record<BetrayalTraitKey, number>>);
        setTestExplorerInventory(core, '1', [card]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈成功',
            trait,
            dice: [2, 2, 2, 2],
            passiveBonus: 7,
        });
    });

    it('灰尘寻找解药会消费书本的下一次非战斗检定替换', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        activateTestExplorer(core, '1');
        core = placeCurrentExplorerInDustResearchRoom(core, 'omen');
        setTestExplorerTraits(core, '1', {
            knowledge: 5,
            sanity: 2,
        });
        setTestExplorerInventory(core, '1', [{ id: 'omen-book', name: '书本', kind: 'omen' }]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'omen-book' });

        expect(core.nextNonCombatTraitReplacement).toMatchObject({
            playerId: '1',
            sourceCardId: 'omen-book',
            replacementTrait: 'knowledge',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'sanity' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            latestLabel: '放置研究标记',
            trait: 'sanity',
            dice: [2, 2, 2, 2, 2],
            passiveBonus: 0,
        });
        expect(core.nextNonCombatTraitReplacement).toBeNull();
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['omen-book', 'search-for-cure']));
    });

    it('灰尘寻找解药的知识检定会使用魔法相机改看更高的神志', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        activateTestExplorer(core, '1');
        core = placeCurrentExplorerInDustResearchRoom(core, 'omen');
        setTestExplorerTraits(core, '1', {
            knowledge: 1,
            sanity: 5,
        });
        setTestExplorerInventory(core, '1', [{ id: 'camera', name: '魔法相机', kind: 'item' }]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            latestLabel: '放置研究标记',
            trait: 'knowledge',
            dice: [2, 2, 2, 2, 2],
            passiveBonus: 0,
        });
        expect(core.scenarioRuntime.dust?.researchRoomIds).toContain('ground-north');
    });

    it('灰尘阶段继续探索事件时，手电筒和灯笼仍只给事件属性检定额外骰', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        setTestTraitTrack(core, '1', 'knowledge', [1, 2, 3, 4], 1, 1);
        setTestExplorerInventory(core, '1', [
            { id: 'flashlight', name: '手电筒', kind: 'item' },
            { id: 'lantern', name: '灯笼', kind: 'item' },
        ]);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '灰尘中的灯光',
            roll: {
                trait: 'knowledge',
                branches: [
                    { min: 10, label: '照亮灰尘，获得 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
                    { min: 0, label: '看不清灰尘，失去 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
                ],
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '灰尘中的灯光',
        });
        expect(core.latestDiscovery?.detail).toContain('知识检定 12');
        expect(core.recentRoll).toMatchObject({
            kind: 'eventTraitCheck',
            sourceTitle: '灰尘中的灯光',
            trait: 'knowledge',
            dice: [2, 2, 2, 2, 2, 2],
            passiveBonus: 0,
        });

        const flashlightUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'flashlight' }),
        );
        const lanternUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'lantern' }),
        );
        expect(flashlightUse.valid).toBe(false);
        expect(lanternUse.valid).toBe(false);
    });

    it('灰尘阶段的物理和精神伤害仍会先应用盔甲与头戴耳机减伤', () => {
        let armorCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(armorCore, '1', 'ground-north');
        setDiscoveredTestRoom(armorCore, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        setTestExplorerInventory(armorCore, '1', [{ id: 'armor', name: '盔甲', kind: 'omen' }]);
        armorCore.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        armorCore.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(armorCore, '1', 'might', [1], 0, 0);
        setTestTraitTrack(armorCore, '1', 'speed', [1], 0, 0);

        armorCore = applyBetrayalCommand(armorCore, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(armorCore.pendingDamageAllocation).toBeNull();
        expect(armorCore.currentPlayer).toBe('2');
        expect(armorCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(armorCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        let radioCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(radioCore, '1', 'entrance-hall');
        setScenarioTestTurnMovement(radioCore, 6);
        setTestTraitTrack(radioCore, '1', 'knowledge', [1], 0, 0);
        setTestTraitTrack(radioCore, '1', 'sanity', [1], 0, 0);
        setTestExplorerInventory(radioCore, '1', [{ id: 'radio', name: '头戴耳机', kind: 'item' }]);
        radioCore.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        radioCore.drawOrder = ['event'];
        radioCore.eventOrder = [{
            name: '灰尘噪音',
            effect: { mode: 'rolledDamage', damageKind: 'mental', dice: 1, recommendedAction: 'endTurn' },
        }];
        radioCore.deckCounts.event = radioCore.eventOrder.length;
        const targetRoomId = resolveExplorableRoomSlots(radioCore)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        radioCore = applyBetrayalCommand(
            radioCore,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(radioCore.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '灰尘噪音',
        });
        expect(findTestExplorer(radioCore, '1').traits).toMatchObject({
            knowledge: 1,
            sanity: 1,
        });
        expect(radioCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(radioCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
    });

    it('灰尘永久感染但仍存活的探索者可以用狗请求交易，狂热病患禁用另有怪物回合守卫', () => {
        let core = createDustHauntCore(['0', '1', '2']);
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'upper-landing', inventory: [] }
                : explorer
        ));
        setTestExplorerInventory(core, '1', [
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'medical-kit', name: '急救包', kind: 'item' },
        ]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];

        const dogTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
                useDog: true,
                targetPlayerId: '0',
                cardIds: ['medical-kit'],
            }),
        );
        expect(dogTrade.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
            useDog: true,
            targetPlayerId: '0',
            cardIds: ['medical-kit'],
        });
        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '1',
            targetPlayerId: '0',
            cardIds: ['medical-kit'],
            useDog: true,
            sourceCardId: 'dog',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '0', { accept: true });

        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['dog']);
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit']);
        expect(core.usedCardIdsThisTurn).toContain('dog');
        expect(core.tradeUsedThisTurnPlayerIds).toContain('1');
    });

    it('灰尘阶段继续探索时圣符仍可埋葬第一张板块并继续发现下一张', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-landing');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '滑落阶梯',
                text: '脚下阶梯突然松动。失去 1 点速度。',
                effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        const collapsedRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!;
        const mysticElevator = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'mysticElevator')!;
        setTestRoomDiscoveryDeck(core, [
            { floor: 'upper', room: collapsedRoom },
            { floor: 'upper', room: mysticElevator },
        ]);
        setTestExplorerInventory(core, '1', [{ id: 'holy-symbol', name: '圣符', kind: 'omen' }]);
        const speedBeforeExplore = core.currentExplorer.traits.speed;

        const holySymbolExplore = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: 'upper-north', useHolySymbol: true }),
        );
        expect(holySymbolExplore.valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: 'upper-north', useHolySymbol: true },
            100,
            createBetrayalScriptedRandom(1),
        );

        expect(core.rooms.find((room) => room.id === 'upper-north')?.visualId).toBe('mysticElevator');
        expect(core.latestDiscovery?.title).toBe('滑落阶梯');
        expect(core.currentExplorer.traits.speed).toBe(speedBeforeExplore - 1);
        expect(core.activityLog[0]?.text).toContain('圣符埋葬倒塌房间');
        expect(core.activityLog[0]?.text).toContain('继续发现神秘电梯');
    });

    it('灰尘阶段继续探索事件符号时雕像仍可跳过事件且不结算事件效果', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        setTestExplorerInventory(core, '1', [{ id: 'idol', name: '雕像', kind: 'omen' }]);
        const mightBefore = core.currentExplorer.traits.might;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        const idolExplore = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: targetRoomId, useIdol: true }),
        );
        expect(idolExplore.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: targetRoomId!, useIdol: true });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.summary).toBe('已用雕像跳过');
        expect(core.latestDiscovery?.detail).toContain('没有抽取或结算事件卡');
        expect(core.currentExplorer.traits.might).toBe(mightBefore);
        expect(core.activityLog[0]?.text).toContain('使用雕像跳过了事件：阴影扑面');
    });

    it('灰尘阶段骨制钥匙仍可穿墙移动到已发现相邻板块，但不能发现新房间', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-landing');
        setScenarioTestTurnMovement(core, 2);
        setTestExplorerInventory(core, '1', [{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }]);
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-landing') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-west'),
                };
            }
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-landing'),
                };
            }
            return room;
        });

        const normalMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'upper-west' }),
        );
        const undiscoveredMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', {
                roomId: 'upper-north',
                useSkeletonKey: true,
            }),
        );
        expect(normalMove.valid).toBe(false);
        expect(undiscoveredMove.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '1',
            { roomId: 'upper-west', useSkeletonKey: true },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(1);
        expect(core.currentExplorer.inventory).toEqual([{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }]);
        expect(core.activityLog[0]?.text).toContain('使用骨制钥匙穿过墙壁');
    });

    it('灰尘阶段主动治疗类持有牌仍按回合开始限制埋葬并治疗', () => {
        let holyWaterCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(holyWaterCore, '1', 'entrance-hall');
        setTestExplorerInventory(holyWaterCore, '1', [{ id: 'holy-water', name: '奇怪的药品', kind: 'item' }]);
        setTestTraitTrack(holyWaterCore, '1', 'might', [1, 2, 3, 4, 5], 1, 3);
        setTestTraitTrack(holyWaterCore, '1', 'speed', [1, 1, 2, 3, 4], 1, 3);

        holyWaterCore = applyBetrayalCommand(holyWaterCore, BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'holy-water' });

        expect(holyWaterCore.currentExplorer.traits.might).toBe(4);
        expect(holyWaterCore.currentExplorer.traits.speed).toBe(3);
        expect(holyWaterCore.currentExplorer.inventory).toEqual([]);
        expect(holyWaterCore.usedCardIdsThisTurn).toContain('holy-water');
        expect(holyWaterCore.activityLog[0]?.text).toContain('埋葬奇怪的药品');

        let medicalKitCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(medicalKitCore, '1', 'hallway');
        setTestExplorerInventory(medicalKitCore, '1', [{ id: 'medical-kit', name: '急救包', kind: 'item' }]);
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(medicalKitCore, '1', trait, [1, 2, 3, 4], 0, 2);
        }

        medicalKitCore = applyBetrayalCommand(medicalKitCore, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
            cardId: 'medical-kit',
            targetPlayerId: '1',
        });

        expect(medicalKitCore.currentExplorer.traits).toMatchObject({
            might: 3,
            speed: 3,
            knowledge: 3,
            sanity: 3,
        });
        expect(medicalKitCore.currentExplorer.inventory).toEqual([]);
        expect(medicalKitCore.usedCardIdsThisTurn).toContain('medical-kit');
        expect(medicalKitCore.activityLog[0]?.text).toContain('埋葬急救包');

        const newlyGainedCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(newlyGainedCore, '1', 'hallway');
        setTestExplorerInventory(newlyGainedCore, '1', [{ id: 'medical-kit', name: '急救包', kind: 'item' }], false);

        const newlyGainedValidation = BetrayalDomain.validate(
            { core: newlyGainedCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'medical-kit', targetPlayerId: '1' }),
        );
        expect(newlyGainedValidation.valid).toBe(false);
        if (!newlyGainedValidation.valid) {
            expect(newlyGainedValidation.error).toContain('本回合新获得的持有物不能立刻使用');
        }
    });

    it('灰尘阶段主动持有牌不能把死亡探索者当治疗或面具目标', () => {
        const medicalKitCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(medicalKitCore, '1', 'hallway');
        setTestExplorerInventory(medicalKitCore, '1', [{ id: 'medical-kit', name: '急救包', kind: 'item' }]);
        medicalKitCore.otherExplorers = medicalKitCore.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        medicalKitCore.scenarioRuntime.deadExplorerPlayerIds = ['0'];

        const healDeadTarget = BetrayalDomain.validate(
            { core: medicalKitCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'medical-kit',
                targetPlayerId: '0',
            }),
        );
        expect(healDeadTarget.valid).toBe(false);
        if (!healDeadTarget.valid) {
            expect(healDeadTarget.error).toContain('急救包只能治疗自己或同板块的另一位探索者');
        }

        const maskCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(maskCore, '1', 'hallway');
        setTestExplorerInventory(maskCore, '1', [{ id: 'mask', name: '面具', kind: 'omen' }]);
        maskCore.otherExplorers = maskCore.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : { ...explorer, roomId: 'upper-landing' }
        ));
        maskCore.scenarioRuntime.deadExplorerPlayerIds = ['0'];

        const moveDeadTarget = BetrayalDomain.validate(
            { core: maskCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'mask',
                targetRoomIdsByTokenId: { '0': 'entrance-hall' },
            }),
        );
        expect(moveDeadTarget.valid).toBe(false);
        if (!moveDeadTarget.valid) {
            expect(moveDeadTarget.error).toContain('当前板块没有可被面具移动的其他角色或怪物');
        }
    });

    it('灰尘阶段面具有多个同房目标时必须逐个指定已发现相邻方向', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'hallway');
        setTestExplorerInventory(core, '1', [{ id: 'mask', name: '面具', kind: 'omen' }]);
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0' || explorer.playerId === '2'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.monsters = [{
            id: 'feverish-patient-1',
            name: '狂热病患',
            portraitAsset: 'betrayal/monsters/feverish-patient',
            tokenAsset: 'betrayal/tokens/monsters/feverish-patient',
            roomId: 'hallway',
            might: 4,
            speed: 5,
            damage: 1,
        }];

        const missingTargetDirection = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'mask',
                targetRoomIdsByTokenId: {
                    '0': 'entrance-hall',
                    'feverish-patient-1': 'grand-staircase',
                },
            }),
        );
        expect(missingTargetDirection.valid).toBe(false);
        if (!missingTargetDirection.valid) {
            expect(missingTargetDirection.error).toContain('面具只能把同板块其他角色移动到已发现的相邻板块');
        }

        const extraTargetDirection = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'mask',
                targetRoomIdsByTokenId: {
                    '0': 'entrance-hall',
                    '2': 'grand-staircase',
                    'ghost-target': 'entrance-hall',
                    'feverish-patient-1': 'entrance-hall',
                },
            }),
        );
        expect(extraTargetDirection.valid).toBe(false);
        if (!extraTargetDirection.valid) {
            expect(extraTargetDirection.error).toContain('面具只能把同板块其他角色移动到已发现的相邻板块');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
            cardId: 'mask',
            targetRoomIdsByTokenId: {
                '0': 'entrance-hall',
                '2': 'grand-staircase',
                'feverish-patient-1': 'entrance-hall',
            },
        });

        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('entrance-hall');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '2')?.roomId).toBe('grand-staircase');
        expect(core.monsters.find((monster) => monster.id === 'feverish-patient-1')?.roomId).toBe('entrance-hall');
        expect(core.currentExplorer.inventory).toEqual([{ id: 'mask', name: '面具', kind: 'omen' }]);
        expect(core.usedCardIdsThisTurn).toContain('mask');
        expect(core.activityLog[0]?.text).toContain('使用面具');
    });

    it.each([
        ['medical-kit', '急救包', 'item'],
        ['holy-water', '奇怪的药品', 'item'],
        ['map', '地图', 'item'],
        ['notebook', '笔记本', 'item'],
        ['manuscript', '手稿', 'item'],
        ['omen-book', '书本', 'omen'],
        ['mask', '面具', 'omen'],
        ['journal', '日记', 'item'],
    ] as const)('灰尘阶段主动持有牌「%s」沿用回合开始和已用限制', (cardId, cardName, kind) => {
        const availableCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(availableCore, '1', 'hallway');
        setTestExplorerInventory(availableCore, '1', [{ id: cardId, name: cardName, kind }]);

        expect(resolveBetrayalPossessionSpecialActionStatus(availableCore, cardId)).toMatchObject({
            active: true,
            canUse: true,
            usedThisTurn: false,
            availableAtTurnStart: true,
            receivedThisTurn: false,
            reason: null,
        });

        const newlyGainedCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(newlyGainedCore, '1', 'hallway');
        setTestExplorerInventory(newlyGainedCore, '1', [{ id: cardId, name: cardName, kind }], false);
        newlyGainedCore.turnStartInventoryCardIds = newlyGainedCore.turnStartInventoryCardIds.filter((id) => id !== cardId);

        expect(resolveBetrayalPossessionSpecialActionStatus(newlyGainedCore, cardId)).toMatchObject({
            active: true,
            canUse: false,
            availableAtTurnStart: false,
            reason: '本回合新获得的持有物不能立刻使用。',
        });

        const usedCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(usedCore, '1', 'hallway');
        setTestExplorerInventory(usedCore, '1', [{ id: cardId, name: cardName, kind }]);
        usedCore.usedCardIdsThisTurn = [cardId];

        expect(resolveBetrayalPossessionSpecialActionStatus(usedCore, cardId)).toMatchObject({
            active: true,
            canUse: false,
            usedThisTurn: true,
            reason: '该持有物本回合已经使用。',
        });
    });

    it.each([
        ['map', '地图'],
        ['notebook', '笔记本'],
        ['journal', '日记'],
        ['manuscript', '手稿'],
    ] as const)('灰尘阶段%s仍可埋葬并把探索者放置到已发现板块', (cardId, cardName) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setTestExplorerInventory(core, '1', [{ id: cardId, name: cardName, kind: 'item' }]);

        const undiscoveredTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId,
                targetRoomId: 'upper-north',
            }),
        );
        expect(undiscoveredTarget.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
            cardId,
            targetRoomId: 'upper-landing',
        });

        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.activeRoomId).toBe('upper-landing');
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain(cardId);
        expect(core.activityLog[0]?.text).toContain(`埋葬${cardName}`);
    });

    it('灰尘阶段面具仍可移动同房目标到已发现相邻板块且不能发现新房间', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'hallway');
        setTestExplorerInventory(core, '1', [{ id: 'mask', name: '面具', kind: 'omen' }]);
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : { ...explorer, roomId: 'upper-landing' }
        ));

        const undiscoveredTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'mask',
                targetRoomId: 'upper-north',
            }),
        );
        expect(undiscoveredTarget.valid).toBe(false);
        if (!undiscoveredTarget.valid) {
            expect(undiscoveredTarget.error).toContain('已发现的相邻板块');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
            cardId: 'mask',
            targetRoomId: 'entrance-hall',
        });

        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('entrance-hall');
        expect(core.currentExplorer.inventory).toEqual([{ id: 'mask', name: '面具', kind: 'omen' }]);
        expect(core.usedCardIdsThisTurn).toContain('mask');
        expect(core.activityLog[0]?.text).toContain('使用面具');
    });

    it('灰尘剧本治愈灰尘失败会按研究加值计算并与左侧存活玩家交换疾病标记', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        setTestExplorerTraits(core, '1', { knowledge: 4 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈失败',
            dice: [0, 0, 0, 0],
            passiveBonus: 4,
        });
        expect(core.activityLog[0]?.text).toContain('尝试治愈灰尘失败');
        expect(core.activityLog[0]?.text).toContain('与左侧玩家随机交换了疾病标记');
        expect(core.usedCardIdsThisTurn).toContain('cure-the-dust');
        expect(core.scenarioRuntime.dust?.researchRoomIds).toEqual(['ground-north', 'hallway']);
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([7, 8, 9]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([1, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([12, 13, 14]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['3']?.map((token) => token.value)).toEqual([4, 10, 11]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('3');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
    });

    it('灰尘剧本治愈灰尘失败后若所有存活者都永久感染则叛徒胜利', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0', '2'];
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        setTestExplorerTraits(core, '1', { knowledge: 4 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
        });
        expect(core.endgameResult?.winners.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds.sort()).toEqual(['0', '2']);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈失败',
            dice: [0, 0, 0, 0],
            passiveBonus: 4,
        });
    });

    it('灰尘终局读模型会标记 If You Win 文本可用和场景专属同时政策', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        setTestExplorerTraits(core, '1', { knowledge: 5 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: true,
            hauntId: 'the-dust',
            hauntTitle: '灰尘',
            outcome: 'survivors',
            winningSideLabel: '英雄',
            winnerPlayerIds: ['1', '2'],
            ifYouWinTextId: 'the-dust.survivors.if-you-win',
            ifYouWinTextStatus: 'available',
            ifYouWinTextAvailable: true,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'scenario-specific',
            tiePolicyStatus: 'scenario-specific',
            representativeOnly: true,
        });
        expect(endgame.ruleNotes).toEqual(expect.arrayContaining([
            '灰尘 If You Win 英文官方原文已接入，中文为正式翻译稿。',
            '灰尘按当前完成的结算事件收口：治愈成功立即英雄胜利；全员感染或死亡只在交换、伤害或死亡事件结算后触发叛徒胜利。',
        ]));
        expect(endgame.ruleNotes).not.toEqual(expect.arrayContaining([
            'If You Win 原文尚未接入；当前只暴露可追踪的胜利文本合同 id。',
        ]));
    });

    it('灰尘叛徒终局读模型同样标记 If You Win 文本可用', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0', '2'];
        setTestExplorerTraits(core, '1', { knowledge: 3 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: true,
            hauntId: 'the-dust',
            outcome: 'traitor',
            winningSideLabel: '叛徒',
            ifYouWinTextId: 'the-dust.traitor.if-you-win',
            ifYouWinTextStatus: 'available',
            ifYouWinTextAvailable: true,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'scenario-specific',
            tiePolicyStatus: 'scenario-specific',
            representativeOnly: true,
        });
        expect([...endgame.winnerPlayerIds].sort()).toEqual(['1', '3']);
        expect(endgame.ruleNotes).toEqual(expect.arrayContaining([
            '灰尘 If You Win 英文官方原文已接入，中文为正式翻译稿。',
        ]));
    });

    it('灰尘治愈成功会按当前行动收口，不被临界叛徒胜利状态覆盖', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0', '3'];
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        setTestExplorerTraits(core, '1', { knowledge: 5 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.endgameResult?.winners).toEqual(['1']);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈成功',
        });
    });

    it('灰尘剧本同意交换后若所有存活者都成为叛徒则叛徒胜利', () => {
        let core = createDustHauntCore();
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            '1',
            { targetPlayerId: '0' },
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
            '0',
            { accept: true },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.winners.sort()).toEqual(['0', '1']);
    });

    it('灰尘剧本控制冲动同意后会随机交换疾病标记并记录本回合已交换', () => {
        let core = createDustHauntCore(['0', '1', '2']);
        seedDustControlImpulsesTokens(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            '1',
            { targetPlayerId: '0' },
        );
        expect(core.activePlayerId).toBe('0');
        expect(core.scenarioRuntime.dust?.pendingSicknessExchange).toMatchObject({
            requesterPlayerId: '1',
            targetPlayerId: '0',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(0, 0),
        );

        expect(core.phase).toBe('haunt');
        expect(core.activePlayerId).toBeNull();
        expect(core.scenarioRuntime.dust?.pendingSicknessExchange).toBeUndefined();
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([4, 7, 8]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([1, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([9, 10, 11]);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['0', '1']);
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds.sort()).toEqual(['0', '1']);
        expect(core.activityLog[0]?.text).toContain('同意了');
    });

    it('灰尘剧本控制冲动被拒绝后不会交换疾病标记或记录本回合已交换', () => {
        let core = createDustHauntCore(['0', '1', '2']);
        seedDustControlImpulsesTokens(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            '1',
            { targetPlayerId: '0' },
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(0, 0),
        );

        expect(core.phase).toBe('haunt');
        expect(core.activePlayerId).toBeNull();
        expect(core.scenarioRuntime.dust?.pendingSicknessExchange).toBeUndefined();
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([1, 7, 8]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([4, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([9, 10, 11]);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
        expect(core.activityLog[0]?.text).toContain('拒绝了');
    });

    it('灰尘剧本回合结束会逐个与同房探索者强制交换疾病标记且不会触发冲动伤害', () => {
        let core = createDustHauntCore(['0', '1', '2', '3']);
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => {
            if (explorer.playerId === '0' || explorer.playerId === '2') {
                return { ...explorer, roomId: 'hallway' };
            }
            return { ...explorer, roomId: 'entrance-hall' };
        });
        core.scenarioRuntime.dust!.sicknessTokensByPlayerId = {
            '0': [
                { id: 'sickness-0-a', value: 1 },
                { id: 'sickness-0-b', value: 7 },
                { id: 'sickness-0-c', value: 8 },
            ],
            '1': [
                { id: 'sickness-1-a', value: 4 },
                { id: 'sickness-1-b', value: 5 },
                { id: 'sickness-1-c', value: 6 },
            ],
            '2': [
                { id: 'sickness-2-a', value: 9 },
                { id: 'sickness-2-b', value: 10 },
                { id: 'sickness-2-c', value: 11 },
            ],
            '3': [
                { id: 'sickness-3-a', value: 12 },
                { id: 'sickness-3-b', value: 13 },
                { id: 'sickness-3-c', value: 14 },
            ],
        };
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = [];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(),
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.phase).toBe('haunt');
        expect(core.activityLog[0]?.text).toContain('交换了 2 次疾病标记');
        expect(core.activityLog[0]?.text).not.toContain('没有交换疾病标记');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['0', '1', '2']);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([4, 7, 8]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([9, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([1, 10, 11]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['3']?.map((token) => token.value)).toEqual([12, 13, 14]);
    });

    it('灰尘剧本同房强制交换后若所有存活者都永久感染则叛徒胜利', () => {
        let core = createDustHauntCore(['0', '1', '2', '3']);
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => {
            if (explorer.playerId === '0' || explorer.playerId === '2') {
                return { ...explorer, roomId: 'hallway' };
            }
            return { ...explorer, roomId: 'entrance-hall' };
        });
        core.scenarioRuntime.deadExplorerPlayerIds = ['3'];
        core.scenarioRuntime.dust!.sicknessTokensByPlayerId = {
            '0': [
                { id: 'sickness-0-a', value: 1 },
                { id: 'sickness-0-b', value: 7 },
                { id: 'sickness-0-c', value: 8 },
            ],
            '1': [
                { id: 'sickness-1-a', value: 4 },
                { id: 'sickness-1-b', value: 5 },
                { id: 'sickness-1-c', value: 6 },
            ],
            '2': [
                { id: 'sickness-2-a', value: 9 },
                { id: 'sickness-2-b', value: 10 },
                { id: 'sickness-2-c', value: 11 },
            ],
            '3': [
                { id: 'sickness-3-a', value: 12 },
                { id: 'sickness-3-b', value: 13 },
                { id: 'sickness-3-c', value: 14 },
            ],
        };
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = [];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(),
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['0', '1', '2'],
        });
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['0', '1', '2']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['3']);
    });

    it('灰尘剧本回合内没有交换疾病时，回合结束进入一般伤害分配并在确认后交接', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : { ...explorer, roomId: 'entrance-hall' }
        ));
        setHighCapacityGeneralDamageTracks(core, '1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '灰尘冲动',
            playerId: '1',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowSkull: true,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            nextPlayerId: '2',
        });
        expect(core.activityLog[0]?.text).toContain('本回合没有交换疾病标记');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
    });

    it('灰尘隐藏叛徒因未交换疾病伤害死亡时，分配确认后才变成狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : { ...explorer, roomId: 'entrance-hall' }
        ));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '灰尘冲动',
            playerId: '1',
            damageKind: 'general',
            amount: 2,
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

    it('灰尘冲动一般伤害分到骷髅时，头骨成功会阻止死亡且不生成狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-general-skull-success',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 2,
            damageTraits: ['might', 'speed'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.endgameResult).toBeNull();
    });

    it('灰尘冲动回合末触发头骨时，先展示死亡保护投掷，确认后才交给下一名玩家', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-general-skull-turn-handoff',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
            nextPlayerId: '2',
            turnLogText: '轮到杰登·琼斯',
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.recentRoll).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
    });

    it('灰尘冲动一般伤害分到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-general-skull-failed',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 2,
            damageTraits: ['might', 'speed'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

    it.each([
        {
            label: '物理攻击伤害',
            sourceTitle: '攻击',
            damageKind: 'physical',
            allowedTraits: ['might', 'speed'] as BetrayalTraitKey[],
            assignedTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
        {
            label: '精神攻击伤害',
            sourceTitle: '精神攻击',
            damageKind: 'mental',
            allowedTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
            assignedTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
        {
            label: '一般伤害',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[],
            assignedTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘永久叛徒受到$label时，头骨成功阻止狂热病患化，失败才生成狂热病患', ({
        sourceTitle,
        damageKind,
        allowedTraits,
        assignedTraits,
    }) => {
        const createCoreWithPendingDamage = () => {
            const core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: `dust-skull-${damageKind}`,
                playerId: '1',
                sourceTitle,
                damageKind,
                amount: 2,
                originalAmount: 2,
                allowedTraits: [...allowedTraits],
                allowSkull: true,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
            };
            return core;
        };

        let protectedCore = createCoreWithPendingDamage();
        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: [...assignedTraits] },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(protectedCore.recentRoll?.kind).toBe('deathPrevention');
        expect(protectedCore.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(protectedCore.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind,
            damageAmount: 2,
            damageTraits: assignedTraits,
        });
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(protectedCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(protectedCore.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();

        let failedCore = createCoreWithPendingDamage();
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: [...assignedTraits] },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(failedCore.recentRoll?.kind).toBe('deathPrevention');
        expect(failedCore.recentRoll?.latestLabel).toBe('正常死亡');
        expect(failedCore.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind,
            damageAmount: 2,
            damageTraits: assignedTraits,
        });
        expect(failedCore.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(failedCore.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(failedCore.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

    it('灰尘永久叛徒头骨失败生成狂热病患后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-skull-rabbit-foot-reroll-success',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
    });

    it('灰尘永久叛徒头骨失败生成狂热病患后，兔脚重掷仍失败会保持死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'first-aid-kit', name: '急救包', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-skull-rabbit-foot-reroll-failure',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

    it('灰尘死亡本会满足叛徒终局时，兔脚窗口先于终局结算', () => {
        const createCoreWithTerminalDeathPrevention = () => {
            const core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
            core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: 'dust-terminal-skull-rabbit-foot-window',
                playerId: '1',
                sourceTitle: '灰尘冲动',
                damageKind: 'general',
                amount: 2,
                originalAmount: 2,
                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                allowSkull: true,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
            };
            return core;
        };

        let protectedCore = createCoreWithTerminalDeathPrevention();
        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(protectedCore.phase).toBe('haunt');
        expect(protectedCore.endgameResult).toBeNull();
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(protectedCore.recentRoll?.kind).toBe('deathPrevention');
        expect(protectedCore.recentRoll?.latestLabel).toBe('正常死亡');
        expect(BetrayalDomain.validate(
            { core: protectedCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(protectedCore.phase).toBe('haunt');
        expect(protectedCore.endgameResult).toBeNull();
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(protectedCore.recentRoll?.latestLabel).toBe('阻止死亡');

        let failedCore = createCoreWithTerminalDeathPrevention();
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(failedCore.phase).toBe('endgame');
        expect(failedCore.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(failedCore.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(failedCore.recentRoll?.latestLabel).toBe('正常死亡');
    });

    it('灰尘兔脚成功回滚终局死亡后，后续再次死亡才触发叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-terminal-rabbit-foot-success-first-death',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 1 }),
        ).valid).toBe(false);

        core.pendingDamageAllocation = {
            id: 'dust-terminal-rabbit-foot-second-death',
            playerId: '1',
            sourceTitle: '灰尘后续伤害',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            102,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
    });

    it('灰尘兔脚成功回滚永久叛徒狂热病患后，最后非叛徒死亡才触发叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        setTestTraitTrack(core, '2', 'might', [1], 0, 0);
        setTestTraitTrack(core, '2', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-traitor-rabbit-foot-success-first-death',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id).sort()).toEqual(['rope', 'skull']);

        const lastExplorer = findTestExplorer(core, '2');
        core.pendingDamageAllocation = {
            id: 'dust-traitor-rabbit-foot-last-hero-death',
            playerId: '2',
            sourceTitle: '灰尘后续伤害',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            traitsBeforeDamage: { ...lastExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: ['might', 'speed'] },
            102,
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['1'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '2']));
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
    });

    it('灰尘普通攻击致死会先等待伤害分配，确认后才变狂热病患并触发叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'hallway' }
                : { ...explorer, roomId: 'entrance-hall' }
        ));
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0', '1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '1',
            amount: 4,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['2']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.endgameResult).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['0'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['1', '2']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

    it('灰尘阶段攻击武器仍按回合开始和已用限制参与攻击并禁止交易', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [{ id: 'hunting-knife', name: '砍刀', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setHighCapacityPhysicalDamageTracks(core, '1');
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['haunt-attack', 'hunting-knife']));
        expect(core.activityLog[0]?.text).toContain('使用砍刀');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '1',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const tradeUsedWeapon = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                cardId: 'hunting-knife',
                targetPlayerId: '1',
            }),
        );
        expect(tradeUsedWeapon.valid).toBe(false);
        expect(tradeUsedWeapon.error).toContain('本回合已经使用过的持有物不能交易');
    });

    it('灰尘阶段武器攻击永久感染者致死后仍生成狂热病患并掩埋遗物', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [{ id: 'ring', name: '指环', kind: 'omen' }],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [{ id: 'hunting-knife', name: '砍刀', kind: 'item' }]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '1',
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        const defeatedTraitor = findTestExplorer(core, '1');
        expect(core.phase).toBe('haunt');
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['haunt-attack', 'hunting-knife']));
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(defeatedTraitor.inventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

    it.each([
        {
            card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 1],
        },
        {
            card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 3, 3, 1],
        },
        {
            card: { id: 'ring', name: '指环', kind: 'omen' as const },
            damageKind: 'mental' as const,
            lethalTrait: 'sanity' as const,
            rollPips: [3, 3, 1],
        },
    ])('灰尘阶段当前攻击武器「$card.name」致死都会生成狂热病患并掩埋遗物', ({
        card,
        damageKind,
        lethalTrait,
        rollPips,
    }) => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [{ id: 'map', name: '地图', kind: 'item' }],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [card]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
        setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: card.id },
            100,
            createBetrayalScriptedRandom(...rollPips),
        );

        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['haunt-attack', card.id]));
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind,
            playerId: '1',
            allowSkull: true,
        });
        expect(findTestExplorer(core, '1').inventory.map((item) => item.id)).toEqual(['map']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

    it.each([
        {
            card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 1],
        },
        {
            card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 3, 3, 1],
        },
        {
            card: { id: 'ring', name: '指环', kind: 'omen' as const },
            damageKind: 'mental' as const,
            lethalTrait: 'sanity' as const,
            rollPips: [3, 3, 1],
        },
    ])('灰尘阶段攻击武器「$card.name」触发头骨失败后，兔脚成功会回滚狂热病患化且不掩埋遗物', ({
        card,
        damageKind,
        lethalTrait,
        rollPips,
    }) => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'map', name: '地图', kind: 'item' },
                    ],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [card]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
        setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: card.id },
            100,
            createBetrayalScriptedRandom(...rollPips),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            damageKind,
            playerId: '1',
            allowSkull: true,
        });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeDefined();
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id)).toEqual(['skull', 'rope', 'map']);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining([card.id, 'rope']));
    });

    it.each([
        {
            card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 1],
        },
        {
            card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 3, 3, 1],
        },
        {
            card: { id: 'ring', name: '指环', kind: 'omen' as const },
            damageKind: 'mental' as const,
            lethalTrait: 'sanity' as const,
            rollPips: [3, 3, 1],
        },
    ])('灰尘阶段攻击武器「$card.name」触发头骨失败后，兔脚仍失败会保持狂热病患化并掩埋遗物', ({
        card,
        damageKind,
        lethalTrait,
        rollPips,
    }) => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'map', name: '地图', kind: 'item' },
                    ],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [card]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
        setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: card.id },
            100,
            createBetrayalScriptedRandom(...rollPips),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            damageKind,
            playerId: '1',
            allowSkull: true,
        });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id)).toEqual(['skull', 'rope', 'map']);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining([card.id, 'rope']));
    });

    it('灰尘永久叛徒因普通攻击伤害死亡时也会变成狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-ordinary-attack-lethal',
            playerId: '1',
            sourceTitle: '攻击',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

    it('灰尘永久叛徒死亡变狂热病患时会掩埋物品和预兆，尸体不可搜刮', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-dead-traitor-buries-possessions',
            playerId: '1',
            sourceTitle: '攻击',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        const deadTraitor = findTestExplorer(core, '1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(deadTraitor.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(corpse).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
    });

    it('灰尘非叛徒死亡时不会掩埋遗物，尸体仍可被同房探索者搜刮', () => {
        let core = createDustHauntCore();
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds).not.toContain('1');

        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-dead-non-traitor-keeps-corpse-loot',
            playerId: '1',
            sourceTitle: '攻击',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        const deadNonTraitor = findTestExplorer(core, '1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(deadNonTraitor.inventory.map((card) => card.id)).toEqual(['map', 'omen-book']);

        activateTestExplorer(core, '2');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';

        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).toContain('1');
        const corpseBeforeLoot = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(corpseBeforeLoot).toMatchObject({
            itemCount: 1,
            omenCount: 1,
            canBeLootedByCurrentExplorer: true,
            lootableCardIds: ['map', 'omen-book'],
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '2', {
            sourcePlayerId: '1',
            cardId: 'map',
        });

        const looter = findTestExplorer(core, '2');
        const corpseAfterLoot = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(looter.inventory.map((card) => card.id)).toContain('map');
        expect(corpseAfterLoot).toMatchObject({
            inventory: [{ id: 'omen-book', name: '书本', kind: 'omen' }],
            itemCount: 0,
            omenCount: 1,
            lootedThisTurn: true,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('1');
    });

    it('灰尘永久叛徒最终死亡变狂热病患时会掩埋全部 23 张运行持有牌', () => {
        const buriedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [{ ...card }];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: `dust-buries-${card.id}`,
                playerId: '1',
                sourceTitle: '攻击',
                damageKind: 'physical',
                amount: 2,
                originalAmount: 2,
                allowedTraits: ['might', 'speed'],
                allowSkull: true,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
            };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: ['might', 'speed'] },
                100,
                createBetrayalScriptedRandom(1, 1, 1),
            );

            const deadTraitor = findTestExplorer(core, '1');
            const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            buriedCardNames.push(card.name);
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(deadTraitor.inventory, card.name).toEqual([]);
            expect(core.currentExplorerInventory, card.name).toEqual([]);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), card.name).not.toContain('1');
            expect(corpse, card.name).toMatchObject({
                itemCount: 0,
                omenCount: 0,
                canBeLootedByCurrentExplorer: false,
                lootableCardIds: [],
            });
        }

        expect(buriedCardNames).toEqual([
            '魔法相机',
            '急救包',
            '奇怪的药品',
            '手电筒',
            '头戴耳机',
            '地图',
            '奇异护符',
            '兔脚',
            '骨制钥匙',
            '砍刀',
            '笔记本',
            '手稿',
            '书本',
            '狗',
            '面具',
            '头骨',
            '圣符',
            '盔甲',
            '雕像',
            '指环',
            '匕首',
            '灯笼',
            '日记',
        ]);
    });

    it('灰尘永久叛徒因作祟后火炉房伤害死亡时也会变成狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'ground-north');
        setDiscoveredTestRoom(core, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            playerId: '1',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });
        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '1', { traits: ['might'] });

        expect(core.currentPlayer).toBe('2');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'ground-north',
        });
        expect(core.endgameResult).toBeNull();
    });

    it('灰尘火炉房伤害本会触发叛徒终局时，兔脚成功会先回滚死亡并交接回合', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'ground-north');
        setDiscoveredTestRoom(core, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            playerId: '1',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.recentRoll).toBeNull();
        expect(core.endgameResult).toBeNull();
    });

    it('灰尘火炉房伤害本会触发叛徒终局时，兔脚仍失败会触发叛徒胜利', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'ground-north');
        setDiscoveredTestRoom(core, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            playerId: '1',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘永久叛徒因作祟后倒塌房间坠落伤害死亡时也会变成狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '倒塌房间',
            hint: '速度检定失败会坠落到地下室起始点。',
            tags: ['上层', '伤害'],
            discoveryReward: null,
            visualId: 'collapsedRoom',
            endTurnEffect: 'speedCheckFallToBasement',
        });
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(1, 3),
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn).toMatchObject({
            roomName: '倒塌房间',
            nextPlayerId: '2',
            previousDestinationRoomId: 'basement-landing',
            previousPhysicalDamage: 2,
        });
        expect(core.pendingDamageAllocation).toBeNull();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            playerId: '1',
            amount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '1', {
            traits: ['might', 'speed'],
        });

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'basement-landing',
        });
        expect(core.endgameResult).toBeNull();
    });

    it('灰尘倒塌房间坠落伤害本会触发叛徒终局时，兔脚成功会先回滚死亡并保留坠落位置', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '倒塌房间',
            hint: '速度检定失败会坠落到地下室起始点。',
            tags: ['上层', '伤害'],
            discoveryReward: null,
            visualId: 'collapsedRoom',
            endTurnEffect: 'speedCheckFallToBasement',
        });
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(1, 3),
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn).toMatchObject({
            roomName: '倒塌房间',
            nextPlayerId: '2',
            previousDestinationRoomId: 'basement-landing',
            previousPhysicalDamage: 2,
        });
        expect(core.pendingDamageAllocation).toBeNull();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            playerId: '1',
            amount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '1')?.roomId).toBe('basement-landing');
        expect(core.recentRoll).toBeNull();
        expect(core.endgameResult).toBeNull();
    });

    it('灰尘倒塌房间坠落伤害本会触发叛徒终局时，兔脚仍失败会保留坠落位置并触发叛徒胜利', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '倒塌房间',
            hint: '速度检定失败会坠落到地下室起始点。',
            tags: ['上层', '伤害'],
            discoveryReward: null,
            visualId: 'collapsedRoom',
            endTurnEffect: 'speedCheckFallToBasement',
        });
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(1, 3),
        );

        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn).toMatchObject({
            roomName: '倒塌房间',
            nextPlayerId: '2',
            previousDestinationRoomId: 'basement-landing',
            previousPhysicalDamage: 2,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            playerId: '1',
            amount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘永久叛徒因事件一般伤害死亡时也会变成狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-lethal',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '1', { traits: ['might'] }),
        );
        expect(validation).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(core.endgameResult).toBeNull();
    });

    it('灰尘真实事件副作用致死后若所有探索者都已是叛徒或死亡则叛徒胜利', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.deckCounts.event = core.eventOrder.length;
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1', '2'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '标本剥制',
        });
        expect(core.latestDiscovery?.detail).toContain('受到 1 点物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置障碍物');
        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
    });

    it('灰尘真实事件副作用致死本会终局时，兔脚成功会先回滚死亡并保留副作用', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2, 1),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '标本剥制',
        });
        expect(core.latestDiscovery?.detail).toContain('受到 1 点物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置障碍物');
        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 2 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 2 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘真实事件副作用致死本会终局时，兔脚仍失败会保留副作用并触发叛徒胜利', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 2 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 2 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘事件一般伤害分到骷髅时也触发头骨死亡保护', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-skull-success',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['might'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.endgameResult).toBeNull();
    });

    it('灰尘事件一般伤害分到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-skull-failed',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['might'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

    it('灰尘事件一般伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'first-aid-kit', name: '急救包', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-skull-rabbit-foot-success',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'first-aid-kit']);
    });

    it('灰尘事件一般伤害头骨失败后，兔脚重掷仍失败会保持死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'first-aid-kit', name: '急救包', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-skull-rabbit-foot-failed',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

    it('灰尘直接降属性事件扣到骷髅时也触发头骨死亡保护', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '直接灰尘降属性',
            text: '阴影扑向你。失去 1 点力量。',
            effect: {
                mode: 'trait',
                trait: 'might',
                amount: -1,
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '直接灰尘降属性',
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['might'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it('灰尘直接降属性事件头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '直接灰尘降属性',
            text: '阴影扑向你。失去 1 点力量。',
            effect: {
                mode: 'trait',
                trait: 'might',
                amount: -1,
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘脑状食品中档失去神志扣到骷髅时也触发头骨死亡保护', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1, 2], 0, 0);
        setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '脑状食品',
        });
        expect(core.latestDiscovery?.detail).toContain('力量检定 1');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点速度并失去 1 点神志');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['sanity'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it('灰尘脑状食品头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1, 2], 0, 0);
        setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it.each([
        {
            eventName: '外星几何',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '失去 1 点速度',
            expectedDamageTraits: ['speed'] as BetrayalTraitKey[],
        },
        {
            eventName: '蜘蛛！',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1, 2], 0, 0);
            },
            randoms: [3, 2, 2, 2],
            expectedDetail: '获得 1 点速度并失去 1 点神志',
            expectedDamageTraits: ['sanity'] as BetrayalTraitKey[],
        },
        {
            eventName: '一种怪异的感觉',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            },
            randoms: [1, 1, 2, 2, 2],
            expectedDetail: '失去 1 点力量',
            expectedDamageTraits: ['might'] as BetrayalTraitKey[],
        },
        {
            eventName: '葬礼',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'sanity', [2], 0, 0);
            },
            randoms: [2, 2, 2, 2, 2],
            expectedDetail: '失去 1 点神志',
            expectedDamageTraits: ['sanity'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘真实直接失去属性事件「$eventName」扣到骷髅时触发头骨死亡保护', ({
        eventName,
        setupTracks,
        randoms,
        expectedDetail,
        expectedDamageTraits,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...randoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });
        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: expectedDamageTraits.length,
            damageTraits: expectedDamageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it.each([
        {
            eventName: '夜幕众星',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'speed', [4], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { trait: 'speed' },
            choiceRandoms: [2, 2, 2, 2, 2, 2, 2],
            expectedDetail: '失去 1 点所选属性',
            expectedDamageTraits: ['speed'] as BetrayalTraitKey[],
        },
        {
            eventName: '一瓶微尘',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1, 2], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { accept: false },
            choiceRandoms: [2, 2, 2],
            expectedDetail: '力量 -1',
            expectedDamageTraits: ['might'] as BetrayalTraitKey[],
        },
        {
            eventName: '一条秘密通道',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [4], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [1, 1, 1, 1],
            choicePayload: { targetRoomId: 'basement-landing' },
            choiceRandoms: [2, 2, 2],
            expectedDetail: '神志 -1',
            expectedDamageTraits: ['sanity'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘真实选择型直接失去属性事件「$eventName」结算后触发头骨死亡保护', ({
        eventName,
        setupTracks,
        exploreRandoms,
        choicePayload,
        choiceRandoms,
        expectedDetail,
        expectedDamageTraits,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...exploreRandoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });
        expect(core.pendingEventChoice?.sourceTitle).toBe(eventName);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            choicePayload,
            101,
            createBetrayalScriptedRandom(...choiceRandoms),
        );

        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: expectedDamageTraits.length,
            damageTraits: expectedDamageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it.each([
        {
            eventName: '标本剥制',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 1 点物理伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
        {
            eventName: '小丑房间',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 2 点精神伤害',
            expectedDamageAmount: 2,
            expectedDamageTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
        {
            eventName: '咬一口！',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 3 点物理伤害',
            expectedDamageAmount: 3,
            expectedDamageTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
        {
            eventName: '磁带播放器',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 1 点精神伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
        {
            eventName: '在你背后！',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 1 点物理伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘真实一般伤害事件「$eventName」扣到骷髅时触发头骨死亡保护', ({
        eventName,
        setupTracks,
        randoms,
        expectedDetail,
        expectedDamageAmount,
        expectedDamageTraits,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...randoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });
        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: expectedDamageAmount,
            damageTraits: expectedDamageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it.each([
        {
            caseName: '电话铃声精神伤害',
            eventName: '电话铃声',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [2, 1, 3, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '受到一颗骰子的精神伤害',
            expectedDamageKind: 'mental' as const,
            expectedDamageAmount: 2,
        },
        {
            caseName: '电话铃声物理伤害',
            eventName: '电话铃声',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            exploreRandoms: [1, 1, 3, 3, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '受到两颗骰子的物理伤害',
            expectedDamageKind: 'physical' as const,
            expectedDamageAmount: 4,
        },
        {
            caseName: '小机器人物理伤害',
            eventName: '小机器人',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            exploreRandoms: [1, 3, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '受到一颗骰子的物理伤害',
            expectedDamageKind: 'physical' as const,
            expectedDamageAmount: 2,
        },
        {
            caseName: '最深的壁橱物理伤害',
            eventName: '最深的壁橱',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            },
            exploreRandoms: [1, 3, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '受到一颗骰子的物理伤害',
            expectedDamageKind: 'physical' as const,
            expectedDamageAmount: 2,
        },
        {
            caseName: '肉质苔癣精神伤害',
            eventName: '肉质苔癣',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { accept: true },
            choiceRandoms: [1, 1, 3, 2, 2, 2],
            expectedDetail: '受到一颗骰子的精神伤害',
            expectedDamageKind: 'mental' as const,
            expectedDamageAmount: 2,
        },
        {
            caseName: '一抹鲜红物理伤害',
            eventName: '一抹鲜红',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { accept: false },
            choiceRandoms: [3, 2, 2, 2],
            expectedDetail: '受到 1 颗骰子的物理伤害',
            expectedDamageKind: 'physical' as const,
            expectedDamageAmount: 2,
        },
    ] as const)('灰尘真实掷骰伤害事件「$caseName」扣到骷髅时触发头骨死亡保护', ({
        eventName,
        setupTracks,
        exploreRandoms,
        choicePayload,
        choiceRandoms,
        expectedDetail,
        expectedDamageKind,
        expectedDamageAmount,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...exploreRandoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });

        if (choicePayload) {
            expect(core.pendingEventChoice?.sourceTitle).toBe(eventName);
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '1',
                choicePayload,
                101,
                createBetrayalScriptedRandom(...choiceRandoms),
            );
        }

        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: expectedDamageKind,
            damageAmount: expectedDamageAmount,
            damageTraits: [],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: core.currentExplorer.roomId,
        });
    });

    it.each([
        {
            caseName: '最深的壁橱精神伤害',
            eventName: '最深的壁橱',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'speed', [2], 0, 0);
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [2, 1, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '受到 1 点精神伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
        {
            caseName: '脑状食品底档通用伤害',
            eventName: '脑状食品',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
            },
            exploreRandoms: [1],
            choicePayload: { traits: ['might', 'knowledge'] as BetrayalTraitKey[] },
            choiceRandoms: [2, 2, 2],
            expectedDetail: '通用伤害 2（力量、知识）',
            expectedDamageAmount: 2,
            expectedDamageTraits: ['might', 'knowledge'] as BetrayalTraitKey[],
        },
        {
            caseName: '上古旧宅地面通用伤害',
            eventName: '上古旧宅',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [3], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { trait: 'might' as const, targetRoomId: 'hallway', traits: ['might'] as BetrayalTraitKey[] },
            choiceRandoms: [2, 2, 2, 2, 2, 2],
            expectedDetail: '通用伤害 1（力量）',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['might'] as BetrayalTraitKey[],
        },
        {
            caseName: '上古旧宅地下精神伤害',
            eventName: '上古旧宅',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'speed', [2], 0, 0);
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { trait: 'speed' as const, targetRoomId: 'basement-landing' },
            choiceRandoms: [1, 1, 2, 2, 2],
            expectedDetail: '受到 1 点精神伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘真实复合/选择伤害事件「$caseName」扣到骷髅时触发头骨死亡保护', ({
        eventName,
        setupTracks,
        exploreRandoms,
        choicePayload,
        choiceRandoms,
        expectedDetail,
        expectedDamageAmount,
        expectedDamageTraits,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...exploreRandoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });

        if (choicePayload) {
            expect(core.pendingEventChoice?.sourceTitle).toBe(eventName);
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '1',
                choicePayload,
                101,
                createBetrayalScriptedRandom(...choiceRandoms),
            );
        }

        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: expectedDamageAmount,
            damageTraits: expectedDamageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: core.currentExplorer.roomId,
        });
    });

    it('灰尘吊死鬼全属性检定失败扣到骷髅时也触发头骨死亡保护', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '吊死鬼',
        });
        expect(core.recentAllTraitCheck?.results.every((result) => !result.passed)).toBe(true);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 4,
            damageTraits: ['might', 'speed', 'knowledge', 'sanity'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it('灰尘固定属性事件一般伤害分到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '固定灰尘伤害',
            text: '固定扣减力量。',
            effect: {
                mode: 'generalDamage',
                amount: 1,
                traits: ['might'],
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '固定灰尘伤害',
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['might'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it('灰尘固定属性事件一般伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '固定灰尘伤害',
            text: '固定扣减力量。',
            effect: {
                mode: 'generalDamage',
                amount: 1,
                traits: ['might'],
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘掷骰事件物理伤害扣到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '掷骰灰尘伤害',
            text: '掷骰造成物理伤害。',
            effect: {
                mode: 'rolledDamage',
                dice: 1,
                damageKind: 'physical',
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '掷骰灰尘伤害',
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'physical',
        });
        expect(core.recentRoll?.deathPrevention?.damageAmount).toBeGreaterThanOrEqual(1);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it('灰尘掷骰事件物理伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '掷骰灰尘伤害',
            text: '掷骰造成物理伤害。',
            effect: {
                mode: 'rolledDamage',
                dice: 1,
                damageKind: 'physical',
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘掷骰事件精神伤害扣到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '掷骰灰尘精神伤害',
            text: '掷骰造成精神伤害。',
            effect: {
                mode: 'rolledDamage',
                dice: 1,
                damageKind: 'mental',
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '掷骰灰尘精神伤害',
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'mental',
        });
        expect(core.recentRoll?.deathPrevention?.damageAmount).toBeGreaterThanOrEqual(1);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

    it('灰尘掷骰事件精神伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '掷骰灰尘精神伤害',
            text: '掷骰造成精神伤害。',
            effect: {
                mode: 'rolledDamage',
                dice: 1,
                damageKind: 'mental',
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘复合事件内嵌一般伤害扣到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '复合灰尘伤害',
            text: '先造成伤害，再放置障碍物。',
            effect: {
                mode: 'compound',
                recommendedAction: 'endTurn',
                effects: [
                    {
                        mode: 'generalDamage',
                        amount: 1,
                        traits: ['might'],
                        recommendedAction: 'endTurn',
                    },
                    {
                        mode: 'placeObstacleToken',
                        recommendedAction: 'endTurn',
                    },
                ],
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '复合灰尘伤害',
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['might'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
    });

    it('灰尘复合事件内嵌一般伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '复合灰尘伤害',
            text: '先造成伤害，再放置障碍物。',
            effect: {
                mode: 'compound',
                recommendedAction: 'endTurn',
                effects: [
                    {
                        mode: 'generalDamage',
                        amount: 1,
                        traits: ['might'],
                        recommendedAction: 'endTurn',
                    },
                    {
                        mode: 'placeObstacleToken',
                        recommendedAction: 'endTurn',
                    },
                ],
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘复合事件内嵌一般伤害头骨失败后，兔脚仍失败会保留副作用并掩埋遗物', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [{
            name: '复合灰尘伤害',
            text: '先造成伤害，再放置障碍物。',
            effect: {
                mode: 'compound',
                recommendedAction: 'endTurn',
                effects: [
                    {
                        mode: 'generalDamage',
                        amount: 1,
                        traits: ['might'],
                        recommendedAction: 'endTurn',
                    },
                    {
                        mode: 'placeObstacleToken',
                        recommendedAction: 'endTurn',
                    },
                ],
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘直接失去属性事件头骨失败后，兔脚仍失败会掩埋非武器遗物且不可搜刮', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '外星几何',
        });
        expect(core.latestDiscovery?.detail).toContain('失去 1 点速度');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['speed'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([
            'skull',
            'rope',
            'map',
            'omen-book',
        ]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((target) => target.playerId)).not.toContain('1');
        expect(corpse).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘掷骰伤害事件头骨失败后，兔脚仍失败会掩埋非武器遗物且不可搜刮', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'first-aid-kit', name: '急救包', kind: 'item' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 3, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '小机器人',
        });
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'physical',
            damageAmount: 2,
            damageTraits: [],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([
            'skull',
            'rope',
            'first-aid-kit',
            'mask',
        ]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((target) => target.playerId)).not.toContain('1');
        expect(corpse).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('灰尘普通伤害死亡后若所有探索者都已是叛徒或死亡则叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1', '2'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-ordinary-damage-completes-traitors',
            playerId: '1',
            sourceTitle: '攻击',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
    });

    it('灰尘剧本发出疾病交换请求后不会重新展示上一次投骰结果', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        setTestExplorerTraits(core, '1', { knowledge: 3 });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: core.currentExplorer.roomId }
                : explorer
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );
        expect(core.recentRoll?.sourceTitle).toBe('寻找解药');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            '1',
            { targetPlayerId: '0' },
        );

        expect(core.scenarioRuntime.dust?.pendingSicknessExchange).toMatchObject({
            requesterPlayerId: '1',
            targetPlayerId: '0',
        });
        expect(core.recentRoll).toBeNull();
    });

    it('大宅饿了作祟检定成功会按官方援手 setup 建立奇异护符和巨魔手', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        const helpingHands = core.scenarioRuntime.helpingHands;
        const trollHands = core.monsters.filter((monster) => helpingHands?.trollHandIds.includes(monster.id));
        const monsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntCardNumber).toBe(12);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.currentPlayer).toBe('1');
        expect(helpingHands).toMatchObject({
            strangeAmuletCardId: 'strange-amulet',
            strangeAmuletFoundDuringSetup: true,
            monsterTurnAfterPlayerId: '0',
        });
        expect(core.scenarioRuntime.hauntSetupQueue.map((entry) => [entry.id, entry.status])).toEqual([
            ['recover-strange-amulet', 'resolved'],
            ['monster-card-left-of-revealer', 'manual-check'],
            ['place-troll-hands', 'resolved'],
            ['first-player-left-of-revealer', 'resolved'],
        ]);
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'strange-amulet')).toBe(true);
        expect(core.possessionOrderByKind.item.some((card) => card.id === 'strange-amulet')).toBe(false);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);
        expect(trollHands).toHaveLength(2);
        expect(trollHands.map((monster) => monster.roomId).sort()).toEqual(['basement-landing', 'entrance-hall']);
        expect(trollHands.every((monster) => (
            monster.name === '巨魔手'
            && monster.might === 5
            && monster.speed === 3
            && monster.sanity === 4
            && monster.knowledge === 4
            && monster.damage === 1
        ))).toBe(true);
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('0');
        expect(monsterTurnStatus).toEqual({
            active: false,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
            trollHandIds: helpingHands?.trollHandIds,
            moveAllowance: 0,
            moveDice: [],
            moveRemainingById: {},
            reason: '等待揭秘者结束回合后开始巨魔手怪物回合。',
        });

        findTestExplorer(core, '0').inventory = findTestExplorer(core, '0').inventory.filter((card) => card.id !== 'strange-amulet');
        expect(resolveHelpingHandsMonsterTurnStatus(core)).toEqual({
            active: false,
            controllerPlayerId: null,
            monsterTurnAfterPlayerId: '0',
            trollHandIds: helpingHands?.trollHandIds,
            moveAllowance: 0,
            moveDice: [],
            moveRemainingById: {},
            reason: '无人持有奇异护符，巨魔手怪物回合跳过。',
        });
    });

    it('大宅饿了 setup 若已有奇异护符持有人，不会从物品牌堆重复找牌', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, inventory: [...explorer.inventory, { id: 'strange-amulet', name: '奇异护符', kind: 'item' }] }
                : explorer
        ));
        core.possessionOrderByKind.item = core.possessionOrderByKind.item.filter((card) => card.id !== 'strange-amulet');
        core.deckCounts.item = core.possessionOrderByKind.item.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.scenarioRuntime.helpingHands).toMatchObject({
            strangeAmuletCardId: 'strange-amulet',
            strangeAmuletFoundDuringSetup: false,
        });
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'strange-amulet')).toBe(false);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'strange-amulet')).toBe(true);
        expect(core.deckCounts.item).toBe(itemDeckBefore);
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('1');
        expect(resolveHelpingHandsMonsterTurnStatus(core).controllerPlayerId).toBe('1');
    });

    it('大宅饿了的巨魔手控制权会随普通交易后的奇异护符换手实时变化', () => {
        let core = createHelpingHandsHauntCore();
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('0');

        activateTestExplorer(core, '0');
        const holderRoomId = core.currentExplorer.roomId;
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: holderRoomId }
                : explorer
        ));
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'strange-amulet',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'strange-amulet')).toBe(false);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'strange-amulet')).toBe(true);
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('1');
        expect(resolveHelpingHandsMonsterTurnStatus(core)).toMatchObject({
            active: false,
            controllerPlayerId: '1',
            monsterTurnAfterPlayerId: '0',
            reason: '等待揭秘者结束回合后开始巨魔手怪物回合。',
        });
    });

    it('大宅饿了会在揭秘者结束回合后开始巨魔手回合，并让两只手共享一次速度骰', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core, createBetrayalScriptedRandom(1, 2, 3));

        const helpingHands = core.scenarioRuntime.helpingHands;
        const monsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);

        expect(monsterTurnStatus.active).toBe(true);
        expect(monsterTurnStatus.controllerPlayerId).toBe('0');
        expect(monsterTurnStatus.moveDice).toHaveLength(3);
        expect(monsterTurnStatus.moveAllowance).toBe(
            Math.max(1, monsterTurnStatus.moveDice.reduce((sum, pip) => sum + pip, 0)),
        );
        expect(monsterTurnStatus.moveRemainingById).toEqual(
            Object.fromEntries(
                (helpingHands?.trollHandIds ?? []).map((monsterId) => [
                    monsterId,
                    monsterTurnStatus.moveAllowance,
                ]),
            ),
        );
        expect(core.currentExplorer.playerId).toBe('0');
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            playerId: '0',
            dice: monsterTurnStatus.moveDice,
        });
    });

    it('怪物移动分组读模型会让同类型巨魔手只建立一个速度骰组', () => {
        const core = createHelpingHandsHauntCore();
        const helpingHands = core.scenarioRuntime.helpingHands;
        const movementGroups = resolveBetrayalMonsterMovementGroups(core);

        expect(movementGroups).toHaveLength(1);
        expect(movementGroups[0]).toMatchObject({
            monsterName: '巨魔手',
            monsterIds: helpingHands?.trollHandIds,
            speed: 3,
            diceCount: 3,
            rollOnceForGroup: true,
            minimumMoveAllowance: 1,
        });
    });

    it('怪物移动骰组预览和结果会按同类型怪物只掷一次并至少移动 1', () => {
        const core = createHelpingHandsHauntCore();
        const helpingHands = core.scenarioRuntime.helpingHands;
        const groupId = '巨魔手:3';
        const preview = resolveBetrayalMonsterMovementRollGroupPreview(core, groupId);

        expect(preview).toMatchObject({
            active: true,
            canRoll: true,
            groupId,
            monsterName: '巨魔手',
            monsterIds: helpingHands?.trollHandIds,
            speed: 3,
            diceCount: 3,
            rollOnceForGroup: true,
            minimumMoveAllowance: 1,
            willWriteMoveAllowanceForMonsterIds: helpingHands?.trollHandIds,
            contractGaps: ['path-preview-ui'],
            previewOnly: true,
            reason: null,
        });

        const result = createBetrayalMonsterMovementRollGroupResult(
            core,
            groupId,
            '0',
            createBetrayalScriptedRandom(1, 2, 3),
        );
        expect(result).toMatchObject({
            groupId,
            monsterName: '巨魔手',
            monsterIds: helpingHands?.trollHandIds,
            playerId: '0',
            speed: 3,
            diceCount: 3,
            dice: [0, 1, 2],
            total: 3,
            moveAllowance: 3,
            rollOnceForGroup: true,
            minimumMoveAllowance: 1,
        });

        expect(createBetrayalMonsterMovementRollGroupResult(
            core,
            groupId,
            '0',
            createBetrayalScriptedRandom(1, 1, 1),
        )).toMatchObject({
            dice: [0, 0, 0],
            total: 0,
            moveAllowance: 1,
        });
        expect(resolveBetrayalMonsterMovementRollGroupPreview(core, 'missing-group')).toMatchObject({
            active: false,
            canRoll: false,
            reason: '当前没有可行动的同类型怪物移动骰组。',
        });
        expect(createBetrayalMonsterMovementRollGroupResult(
            core,
            'missing-group',
            '0',
            BETRAYAL_FIXED_RANDOM,
        )).toBeNull();
    });

    it('大宅饿了无人持有奇异护符时会跳过巨魔手回合并推进到下一名探索者', () => {
        let core = createHelpingHandsHauntCore();
        findTestExplorer(core, '0').inventory = findTestExplorer(core, '0').inventory.filter(
            (card) => card.id !== 'strange-amulet',
        );

        core = startHelpingHandsMonsterTurn(core);

        expect(resolveHelpingHandsMonsterTurnStatus(core)).toMatchObject({
            active: false,
            controllerPlayerId: null,
            reason: '无人持有奇异护符，巨魔手怪物回合跳过。',
        });
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.activityLog.some((entry) => entry.text.includes('巨魔手怪物回合跳过'))).toBe(true);
    });

    it('大宅饿了只有当前奇异护符持有人能移动、攻击或结束巨魔手回合', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);
        const trollHandId = core.scenarioRuntime.helpingHands?.trollHandIds[0];

        const moveValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND, '1', {
                monsterId: trollHandId,
                roomId: 'hallway',
            }),
        );
        const attackValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK, '1', {
                monsterId: trollHandId,
                targetPlayerId: '2',
            }),
        );
        const endValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN, '1', {}),
        );

        expect(moveValidation).toMatchObject({ valid: false });
        expect(moveValidation.error).toContain('当前奇异护符持有人');
        expect(attackValidation).toMatchObject({ valid: false });
        expect(attackValidation.error).toContain('奇异护符持有人');
        expect(endValidation).toMatchObject({ valid: false });
        expect(endValidation.error).toContain('当前奇异护符持有人');
    });

    it('大宅饿了巨魔手只能走已发现真实连接，地下室登陆点能走到大阶梯', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);
        const basementTrollHandId = core.scenarioRuntime.helpingHands?.trollHandIds.find((monsterId) => (
            core.monsters.find((monster) => monster.id === monsterId)?.roomId === 'basement-landing'
        ));
        expect(basementTrollHandId).toBeDefined();

        const moveOptions = resolveHelpingHandsTrollHandMoveOptions(core, basementTrollHandId!);
        expect(moveOptions.map((room) => room.id)).toContain('grand-staircase');
        const monsterMoveTargets = resolveBetrayalMonsterMoveTargetRooms(core, basementTrollHandId!);
        expect(monsterMoveTargets.map((room) => room.id)).toContain('grand-staircase');
        expect(monsterMoveTargets.every((room) => room.state === 'discovered')).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND,
            '0',
            { monsterId: basementTrollHandId, roomId: 'grand-staircase' },
        );

        expect(core.monsters.find((monster) => monster.id === basementTrollHandId)?.roomId).toBe('grand-staircase');
    });

    it('怪物行动集合读模型会表达默认力量攻击和不能持有或探索', () => {
        const core = createHelpingHandsHauntCore();
        const basementTrollHandId = core.scenarioRuntime.helpingHands?.trollHandIds.find((monsterId) => (
            core.monsters.find((monster) => monster.id === monsterId)?.roomId === 'basement-landing'
        ));
        expect(basementTrollHandId).toBeDefined();

        const actionSet = resolveBetrayalMonsterActionSet(core, basementTrollHandId!);

        expect(actionSet).toMatchObject({
            monsterId: basementTrollHandId,
            name: '巨魔手',
            status: 'active',
            canMove: true,
            canAttack: true,
            defaultAttackTrait: 'might',
            usesNormalAttackRules: true,
            canHoldPossessions: false,
            canHoldOmens: false,
            canUsePossessionActions: false,
            canExploreNewRooms: false,
            canDiscoverRoomTiles: false,
            canIgnoreDamagingRoomEffects: true,
            scenarioSpecificOverridesMayApply: true,
        });
        expect(actionSet?.moveTargetRoomIds).toContain('grand-staircase');
    });

    it('大宅饿了巨魔手离开有探索者的房间会消耗两点移动', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);
        const trollHandId = core.scenarioRuntime.helpingHands?.trollHandIds[0];
        const trollHand = core.monsters.find((monster) => monster.id === trollHandId);
        expect(trollHand).toBeDefined();
        findTestExplorer(core, '1').roomId = trollHand!.roomId;

        const targetRoom = resolveHelpingHandsTrollHandMoveOptions(core, trollHandId!)[0];
        const moveRemainingBefore = resolveHelpingHandsMonsterTurnStatus(core)
            .moveRemainingById[trollHandId!];
        expect(targetRoom).toBeDefined();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND,
            '0',
            { monsterId: trollHandId, roomId: targetRoom!.id },
        );

        expect(resolveHelpingHandsMonsterTurnStatus(core).moveRemainingById[trollHandId!])
            .toBe(moveRemainingBefore - 2);
    });

    it('大宅饿了结束巨魔手回合后才推进到揭秘者之后的下一名探索者', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN,
            '0',
            {},
        );

        expect(resolveHelpingHandsMonsterTurnStatus(core).active).toBe(false);
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.recentRoll).toBeNull();
    });

    it('大宅饿了探索者击败巨魔手后，巨魔手仍在场且不能被击晕', () => {
        let core = createHelpingHandsHauntCore();
        activateTestExplorer(core, '1');
        const trollHand = core.monsters.find((monster) => monster.id === 'troll-hand-1');
        expect(trollHand).toBeDefined();
        core.currentExplorer.roomId = trollHand!.roomId;
        core.activeRoomId = trollHand!.roomId;
        setTestExplorerTraits(core, '1', { might: 5 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '1',
            { target: 'troll-hand', targetMonsterId: trollHand!.id },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 0, 0, 0, 0, 0),
        );

        expect(core.monsters.find((monster) => monster.id === trollHand!.id)).toMatchObject({
            id: trollHand!.id,
            roomId: trollHand!.roomId,
        });
        expect(core.recentRoll?.latestLabel).toBe('巨魔手不能被击晕');
        expect(core.activityLog.some((entry) => entry.text.includes('巨魔手不能被击晕'))).toBe(true);
    });

    it('怪物受伤结果原语区分不可击晕、击晕和杀死', () => {
        const helpingHandsCore = createHelpingHandsHauntCore();
        const trollHandOutcome = resolveBetrayalMonsterDamageOutcome(helpingHandsCore, 'troll-hand-1', {
            damageAmount: 2,
            damageTrait: 'might',
        });

        expect(trollHandOutcome).toMatchObject({
            monsterId: 'troll-hand-1',
            name: '巨魔手',
            kind: 'resisted',
            previousStatus: 'active',
            nextStatus: 'active',
            canBeStunned: false,
            stunned: false,
            killed: false,
            removedFromHouse: false,
            logLabel: '巨魔手不能被击晕',
        });

        const magicCameraCore = createMagicCameraHauntCore('1');
        const [killMonsterId, stunMonsterId] = magicCameraCore.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(killMonsterId).toBeDefined();
        expect(stunMonsterId).toBeDefined();

        expect(resolveBetrayalMonsterDamageOutcome(magicCameraCore, killMonsterId!, {
            damageAmount: 2,
            damageTrait: 'might',
        })).toMatchObject({
            monsterId: killMonsterId,
            name: '幻影摄影师',
            kind: 'killed',
            previousStatus: 'active',
            nextStatus: 'killed',
            canBeStunned: true,
            stunned: false,
            killed: true,
            removedFromHouse: true,
            logLabel: '击杀幻影摄影师',
        });

        expect(resolveBetrayalMonsterDamageOutcome(magicCameraCore, stunMonsterId!, {
            damageAmount: 2,
            damageTrait: 'sanity',
        })).toMatchObject({
            monsterId: stunMonsterId,
            name: '幻影摄影师',
            kind: 'stunned',
            previousStatus: 'active',
            nextStatus: 'stunned',
            canBeStunned: true,
            stunned: true,
            killed: false,
            removedFromHouse: false,
            logLabel: '击晕幻影摄影师',
        });
    });

    it('官方怪物定义会驱动石像小天使的固定属性、不可攻击、不会攻击和视线内不移动口径', () => {
        const definition = getBetrayalMonsterDefinition('blood-from-stone-stone-cherub');
        expect(definition).toMatchObject({
            name: '石像小天使',
            hauntNumber: 5,
            traits: {
                might: 8,
                speed: 4,
                sanity: 8,
                knowledge: 8,
            },
            canAttack: false,
            canBeAttacked: false,
            canBeStunned: false,
        });

        const core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        core.currentExplorer.roomId = 'entrance-hall';
        core.otherExplorers = core.otherExplorers.map((explorer) => ({
            ...explorer,
            roomId: 'entrance-hall',
        }));
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition(
                'blood-from-stone-stone-cherub',
                'stone-cherub-1',
                'entrance-hall',
            ),
        ];
        activateBloodFromStoneMonsterTurn(core, '0');

        const status = resolveBetrayalMonsterStatuses(core)
            .find((item) => item.monsterId === 'stone-cherub-1');
        expect(status).toMatchObject({
            name: '石像小天使',
            canAttack: false,
            canBeAttacked: false,
            canBeStunned: false,
            defaultAttackTrait: 'might',
            traits: {
                might: 8,
                speed: 4,
                sanity: 8,
                knowledge: 8,
                usesTraitTrack: false,
            },
        });
        expect(status?.ruleNotes).toContain('该怪物不能被普通攻击。');
        expect(status?.ruleNotes).toContain('该怪物规则明确不会发动攻击。');

        expect(resolveBetrayalMonsterDamageOutcome(core, 'stone-cherub-1', {
            damageAmount: 2,
            damageTrait: 'might',
        })).toMatchObject({
            kind: 'resisted',
            previousStatus: 'active',
            nextStatus: 'active',
            canBeStunned: false,
            logLabel: '石像小天使不能被攻击',
        });

        const actionSet = resolveBetrayalMonsterActionSet(core, 'stone-cherub-1');
        expect(actionSet).toMatchObject({
            name: '石像小天使',
            canMove: false,
            canAttack: false,
            usesNormalAttackRules: false,
            reason: '石像小天使在英雄视线内开始怪物回合，本回合不移动。',
        });
        const panel = resolveBetrayalMonsterActionPanel(core);
        expect(panel.movementGroupIds).not.toContain('石像小天使:4');
        expect(panel.slots.find((slot) => slot.id === 'attack:stone-cherub-1')).toMatchObject({
            enabled: false,
            defaultAttackTrait: 'might',
        });
    });

    it('石像小天使从非视线房间移动到任一英雄视线后会立即停止', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateBloodFromStoneMonsterTurn(core, '0');
        core.currentExplorer.roomId = 'entrance-hall';
        core.otherExplorers = core.otherExplorers.map((explorer) => ({
            ...explorer,
            roomId: 'entrance-hall',
        }));
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition(
                'blood-from-stone-stone-cherub',
                'stone-cherub-1',
                'ground-north',
            ),
        ];
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: ['stone-cherub-1'],
            skippedMonsterIdsThisTurn: [],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {
                'stone-cherub-1': 3,
            },
        };

        expect(isBetrayalRoomInLineOfSight(core, 'ground-north', 'entrance-hall')).toBe(false);
        expect(isBetrayalRoomInLineOfSight(core, 'hallway', 'entrance-hall')).toBe(true);
        expect(resolveBetrayalMonsterMovementGroups(core).map((group) => group.groupId))
            .toContain('石像小天使:4');
        expect(resolveBetrayalMonsterMoveTargetRooms(core, 'stone-cherub-1').map((room) => room.id))
            .toEqual(['hallway']);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '0', {
                monsterId: 'stone-cherub-1',
                roomId: 'hallway',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '0', {
            monsterId: 'stone-cherub-1',
            roomId: 'hallway',
        });

        expect(core.monsters.find((monster) => monster.id === 'stone-cherub-1')?.roomId)
            .toBe('hallway');
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById['stone-cherub-1'])
            .toBe(0);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, 'stone-cherub-1')).toEqual([]);
        expect(resolveBetrayalMonsterActionSet(core, 'stone-cherub-1')).toMatchObject({
            canMove: false,
            canAttack: false,
            reason: '石像小天使在英雄视线内开始怪物回合，本回合不移动。',
        });
    });


    it('英雄进入本回合开始时未在自己视线内的石像小天使视线时受 2 骰一般伤害且每回合最多一次', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateTestExplorer(core, '0');
        findTestExplorer(core, '0').roomId = 'ground-north';
        core.activeRoomId = 'ground-north';
        core.currentExplorerRoomId = 'ground-north';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        setScenarioTestTurnMovement(core, 6);
        setHighCapacityGeneralDamageTracks(core, '0');
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-1', 'entrance-hall'),
        ];
        core.scenarioRuntime.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId = { '0': [] };
        core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn = [];

        expect(isBetrayalRoomInLineOfSight(core, 'ground-north', 'entrance-hall')).toBe(false);
        expect(isBetrayalRoomInLineOfSight(core, 'hallway', 'entrance-hall')).toBe(true);
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('hallway');

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '0',
            { roomId: 'hallway' },
            100,
            createBetrayalScriptedRandom(2, 3),
        );

        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '石像小天使新视线伤害',
            playerId: '0',
            damageKind: 'general',
            amount: 3,
            originalAmount: 3,
            allowSkull: true,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
        });
        expect(core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn).toContain('0');
        expect(core.activityLog[0]?.text).toContain('进入石像小天使新视线');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(core.pendingDamageAllocation).toBeNull();
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '0',
            { roomId: 'entrance-hall' },
            101,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn)
            .toEqual(['0']);
    });
    it('石像小天使怪物回合结束时按每名英雄视线内石像数量排队分配一般伤害', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateBloodFromStoneMonsterTurn(core, '0');
        findTestExplorer(core, '0').roomId = 'entrance-hall';
        findTestExplorer(core, '1').roomId = 'entrance-hall';
        findTestExplorer(core, '2').roomId = 'basement-landing';
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        setHighCapacityGeneralDamageTracks(core, '0');
        setHighCapacityGeneralDamageTracks(core, '1');
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-1', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-2', 'hallway'),
        ];
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: ['stone-cherub-1', 'stone-cherub-2'],
            skippedMonsterIdsThisTurn: ['stone-cherub-1', 'stone-cherub-2'],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        };

        expect(resolveBloodFromStoneMonsterTurnEndPreview(core)).toMatchObject({
            active: true,
            canEnd: true,
            controllerPlayerId: '0',
            nextPlayerId: '1',
            visibleStoneCherubCountsByPlayerId: {
                '0': 2,
                '1': 2,
            },
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN, '0', {}),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 2, 2, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '石像小天使凝视',
            playerId: '0',
            damageKind: 'general',
            amount: 3,
            originalAmount: 3,
            allowSkull: true,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
        });
        expect(core.pendingDamageAllocation?.nextDamageAllocations).toHaveLength(1);
        expect(core.pendingDamageAllocation?.nextDamageAllocations?.[0]).toMatchObject({
            playerId: '1',
            amount: 1,
            nextPlayerId: '1',
            turnLogText: expect.stringContaining('轮到'),
        });
        expect(core.activityLog[0]?.text).toContain('视线内有 2 个石像小天使');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '1',
            amount: 1,
            sourceTitle: '石像小天使凝视',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('1');
    });

    it('石像小天使凝视伤害会排除死亡英雄和不在视线内的英雄', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = ['1'];
        activateBloodFromStoneMonsterTurn(core, '0');
        findTestExplorer(core, '0').roomId = 'entrance-hall';
        findTestExplorer(core, '1').roomId = 'entrance-hall';
        findTestExplorer(core, '2').roomId = 'ground-north';
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        setHighCapacityGeneralDamageTracks(core, '0');
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-1', 'entrance-hall'),
        ];
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: ['stone-cherub-1'],
            skippedMonsterIdsThisTurn: ['stone-cherub-1'],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        };

        expect(isBetrayalRoomInLineOfSight(core, 'ground-north', 'entrance-hall')).toBe(false);
        expect(resolveBloodFromStoneMonsterTurnEndPreview(core)).toMatchObject({
            canEnd: true,
            nextPlayerId: '2',
            visibleStoneCherubCountsByPlayerId: { '0': 1 },
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '0',
            amount: 2,
        });
        expect(core.pendingDamageAllocation?.nextDamageAllocations ?? []).toEqual([]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('2');
    });

    it('英雄持有镜子玩躲猫猫时知识检定获得 +2，成功后移除同房和视线内两只石像小天使', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateTestExplorer(core, '0');
        const hero = findTestExplorer(core, '0');
        hero.roomId = 'entrance-hall';
        setTestTraitTrack(core, '0', 'knowledge', [1, 1, 1], 1, 1);
        hero.inventory = [{ id: 'mirror', name: 'Mirror', kind: 'item' }];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-same-room', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-in-sight', 'hallway'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-spared', 'basement-landing'),
        ];

        expect(isBetrayalRoomInLineOfSight(core, 'entrance-hall', 'hallway')).toBe(true);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.PLAY_PEEKABOO, '0', {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            }),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLAY_PEEKABOO,
            '0',
            {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.monsters.map((monster) => monster.id)).toEqual(['stone-cherub-spared']);
        expect(core.usedCardIdsThisTurn).toContain('play-peekaboo');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '玩躲猫猫',
            trait: 'knowledge',
            passiveBonus: 2,
            latestLabel: '移除石像小天使',
        });
        expect(core.activityLog[0]?.text).toContain('玩躲猫猫成功');
    });

    it('玩躲猫猫移除最后两只石像小天使后英雄立即胜利', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateTestExplorer(core, '0');
        const hero = findTestExplorer(core, '0');
        hero.roomId = 'entrance-hall';
        setTestTraitTrack(core, '0', 'knowledge', [1, 1, 1], 1, 1);
        hero.inventory = [{ id: 'mirror', name: 'Mirror', kind: 'item' }];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-same-room', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-in-sight', 'hallway'),
        ];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLAY_PEEKABOO,
            '0',
            {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.monsters).toEqual([]);
        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'blood-from-a-stone',
            hauntTitle: '顽石之血',
            outcome: 'survivors',
            winners: ['0', '1', '2'],
            traitorPlayerId: '',
            survivorsEscaped: ['0', '1', '2'],
        });
    });

    it('英雄玩躲猫猫失败时进入 2 骰一般伤害分配，且本回合不能再次使用', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateTestExplorer(core, '0');
        const hero = findTestExplorer(core, '0');
        hero.roomId = 'entrance-hall';
        hero.inventory = [];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        setHighCapacityGeneralDamageTracks(core, '0');
        setTestTraitTrack(core, '0', 'knowledge', Array.from({ length: 16 }, () => 1), 14, 14);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-same-room', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-in-sight', 'hallway'),
        ];

        expect(resolveBloodFromStonePeekabooOptions(core, '0')).toMatchObject([{
            sameRoomMonsterId: 'stone-cherub-same-room',
            lineOfSightMonsterId: 'stone-cherub-in-sight',
        }]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.PLAY_PEEKABOO, '0', {
                sameRoomMonsterId: 'stone-cherub-same-room',
            }),
        )).toMatchObject({
            valid: false,
            error: expect.stringContaining('必须选择同房间石像小天使和视线内另一只石像小天使'),
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLAY_PEEKABOO,
            '0',
            {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            },
            100,
            createBetrayalScriptedRandom(1, 3, 2),
        );

        expect(core.monsters.map((monster) => monster.id))
            .toEqual(['stone-cherub-same-room', 'stone-cherub-in-sight']);
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '玩躲猫猫',
            playerId: '0',
            damageKind: 'general',
            amount: 3,
            originalAmount: 3,
            allowSkull: true,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
        });
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '玩躲猫猫',
            trait: 'knowledge',
            passiveBonus: 0,
            latestLabel: '一般伤害',
        });
        expect(core.activityLog[0]?.text).toContain('玩躲猫猫失败');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.PLAY_PEEKABOO, '0', {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            }),
        )).toMatchObject({
            valid: false,
            error: expect.stringContaining('本回合已经使用'),
        });
    });

    it('顽石之血中全部英雄死亡时作祟失败并进入终局', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = ['1', '2'];
        activateTestExplorer(core, '0');
        const hero = findTestExplorer(core, '0');
        hero.roomId = 'entrance-hall';
        hero.inventory = [];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '0', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-same-room', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-in-sight', 'hallway'),
        ];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLAY_PEEKABOO,
            '0',
            {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            },
            100,
            createBetrayalScriptedRandom(1, 3, 3),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '玩躲猫猫',
            playerId: '0',
            amount: 4,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'blood-from-a-stone',
            hauntTitle: '顽石之血',
            outcome: 'haunt',
            winners: [],
            traitorPlayerId: '',
            survivorsEscaped: [],
        });
    });

    it('怪物受伤正式命令复用通用结果并写入可持久化怪物状态', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '2');
        const [killMonsterId, stunMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(killMonsterId).toBeDefined();
        expect(stunMonsterId).toBeDefined();

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '2', {
                monsterId: stunMonsterId,
                damageAmount: 1,
                damageTrait: 'sanity',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '2', {
            monsterId: stunMonsterId,
            damageAmount: 1,
            damageTrait: 'sanity',
        });

        expect(core.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds).toContain(stunMonsterId);
        expect(core.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds).not.toContain(stunMonsterId);
        expect(core.monsters.some((monster) => monster.id === stunMonsterId)).toBe(true);
        expect(core.activityLog.some((entry) => entry.text.includes('击晕幻影摄影师'))).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '2', {
            monsterId: killMonsterId,
            damageAmount: 1,
            damageTrait: 'might',
        });

        expect(core.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds).toContain(killMonsterId);
        expect(core.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds).not.toContain(killMonsterId);
        expect(core.monsters.some((monster) => monster.id === killMonsterId)).toBe(false);
    });

    it('怪物受伤正式命令会用通用状态后端击晕狂热病患并在回合开始翻正跳过', () => {
        let core = createFeverishControlReadyCore();

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '0', {
                monsterId: 'feverish-0',
                damageAmount: 1,
                damageTrait: 'might',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '0', {
            monsterId: 'feverish-0',
            damageAmount: 1,
            damageTrait: 'might',
        });

        expect(resolveBetrayalMonsterStatuses(core).find((status) => status.monsterId === 'feverish-0')).toMatchObject({
            name: '狂热病患',
            status: 'stunned',
            stunned: true,
            slowsHeroMovement: false,
        });
        expect(resolveBetrayalMonsterActionSet(core, 'feverish-0')).toMatchObject({
            canMove: false,
            canAttack: false,
        });
        expect(core.activityLog.some((entry) => entry.text.includes('击晕狂热病患'))).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
            '0',
            { monsterId: 'feverish-0' },
        );

        expect(resolveBetrayalMonsterStatuses(core).find((status) => status.monsterId === 'feverish-0')).toMatchObject({
            status: 'active',
            stunned: false,
        });
        expect(resolveBetrayalMonsterTurnRuntimeState(core)).toMatchObject({
            resolvedStartMonsterIds: ['feverish-0'],
            skippedMonsterIdsThisTurn: ['feverish-0'],
        });
        expect(resolveBetrayalMonsterTurnStartStatus(core, 'feverish-0')).toMatchObject({
            status: 'active',
            canRollMovement: false,
            canAttack: false,
            reason: '该怪物本回合已跳过，不能再次移动或攻击。',
        });
    });

    it('怪物状态读模型把固定属性和不可击晕怪物从探索者属性轨分离', () => {
        const core = createHelpingHandsHauntCore();
        const trollHandStatus = resolveBetrayalMonsterStatuses(core)
            .find((status) => status.monsterId === 'troll-hand-1');

        expect(trollHandStatus).toMatchObject({
            monsterId: 'troll-hand-1',
            name: '巨魔手',
            status: 'active',
            canBeStunned: false,
            stunned: false,
            killed: false,
            slowsHeroMovement: true,
            canHoldPossessions: false,
            canExploreNewRooms: false,
            defaultAttackTrait: 'might',
            traits: {
                might: 5,
                speed: 3,
                sanity: 4,
                knowledge: 4,
                usesTraitTrack: false,
            },
        });

        const jackCore = createFirstScenarioHauntCore();
        jackCore.monsters = [{
            id: 'jack-spirit',
            name: '杰克之灵',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId: 'entrance-hall',
            might: 5,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];
        const jackStatus = resolveBetrayalMonsterStatuses(jackCore)
            .find((status) => status.monsterId === 'jack-spirit');

        expect(jackStatus).toMatchObject({
            name: '杰克之灵',
            canBeStunned: false,
            status: 'active',
            traits: {
                might: 5,
                speed: 3,
                sanity: 4,
                knowledge: 4,
                usesTraitTrack: false,
            },
        });
    });

    it('大宅饿了力量攻击获胜后生成伤害或偷牌选择且不立即扣血', () => {
        let core = createHelpingHandsExplorerAttackCore();
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(resolveHelpingHandsPendingAttackReward(core)).toMatchObject({
            attackerPlayerId: '0',
            defenderPlayerId: '1',
            damageToDefender: 4,
            damageKind: 'physical',
            attackerRoll: 4,
            defenderRoll: 0,
        });
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);
        expect(core.recentRoll?.latestLabel).toBe('可偷牌或造成 4 点伤害');

        const blockedEndTurn = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        );
        expect(blockedEndTurn.valid).toBe(false);
        expect(blockedEndTurn.error).toContain('请先选择造成伤害或偷取物品/预兆');
    });

    it('大宅饿了选择偷取物品或预兆后不造成伤害', () => {
        let core = createHelpingHandsExplorerAttackCore();
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD,
            '0',
            { choice: 'steal', cardId: 'first-aid-kit' },
        );

        expect(resolveHelpingHandsPendingAttackReward(core)).toBeNull();
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'first-aid-kit')).toBe(true);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'first-aid-kit')).toBe(false);
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);
        expect(core.receivedCardIdsThisTurnByPlayerId['0']).toContain('first-aid-kit');
    });

    it('大宅饿了选择造成伤害后由防守者分配才扣属性', () => {
        let core = createHelpingHandsExplorerAttackCore();
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD,
            '0',
            { choice: 'damage' },
        );

        expect(resolveHelpingHandsPendingAttackReward(core)).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '1',
            sourceTitle: '援手攻击',
            damageKind: 'physical',
            amount: 4,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);

        const blockedEndTurn = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        );
        expect(blockedEndTurn).toMatchObject({ valid: false, error: '请先分配当前伤害。' });

        const wrongPlayerAllocation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '0',
                { traits: ['might', 'might', 'speed', 'speed'] },
            ),
        );
        expect(wrongPlayerAllocation).toMatchObject({ valid: false, error: '必须由受伤玩家分配伤害。' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'might', 'speed', 'speed'] },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore - 4);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'first-aid-kit')).toBe(true);
    });

    it('大宅饿了非力量攻击获胜不能偷物品或预兆', () => {
        let core = createHelpingHandsExplorerAttackCore();
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);
        const defenderMentalBefore = traitTrackPositionTotal(core, '1', ['knowledge', 'sanity']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: 'ring' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(resolveHelpingHandsPendingAttackReward(core)).toBeNull();
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);
        expect(traitTrackPositionTotal(core, '1', ['knowledge', 'sanity'])).toBe(defenderMentalBefore - 4);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'first-aid-kit')).toBe(true);
        expect(core.usedCardIdsThisTurn).toContain('ring');
    });

    it('大宅饿了巨魔手同房提供力量8合击并消耗两个巨魔手', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);
        const helpingHands = core.scenarioRuntime.helpingHands;
        expect(helpingHands).toBeDefined();
        const sharedRoomId = 'entrance-hall';
        core.monsters = core.monsters.map((monster) => (
            helpingHands?.trollHandIds.includes(monster.id)
                ? { ...monster, roomId: sharedRoomId }
                : monster
        ));
        const target = findTestExplorer(core, '1');
        target.roomId = sharedRoomId;
        setTestTraitTrack(core, '1', 'might', [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], 10, 10);
        setTestTraitTrack(core, '1', 'speed', [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], 10, 10);

        const combinedOption = resolveHelpingHandsTrollHandAttackOptions(core).find((option) => option.combined);
        expect(combinedOption).toMatchObject({
            label: '巨魔手合击',
            trollHandIds: helpingHands?.trollHandIds,
            roomId: sharedRoomId,
            might: 8,
            targetPlayerIds: expect.arrayContaining(['1']),
        });
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK,
            '0',
            { combined: true, targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 2, 2, 1, 1),
        );

        expect(core.scenarioRuntime.helpingHands?.trollHandAttackUsedIdsThisTurn.sort()).toEqual(
            [...(helpingHands?.trollHandIds ?? [])].sort(),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '1',
            sourceTitle: '巨魔手攻击',
            damageKind: 'physical',
            amount: 8,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);
        expect(resolveHelpingHandsTrollHandAttackOptions(core)).toEqual([]);

        const wrongPlayerAllocation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '0',
                { traits: ['might', 'might', 'might', 'might', 'speed', 'speed', 'speed', 'speed'] },
            ),
        );
        expect(wrongPlayerAllocation).toMatchObject({ valid: false, error: '必须由受伤玩家分配伤害。' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'might', 'might', 'might', 'speed', 'speed', 'speed', 'speed'] },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore - 8);
        const spentAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK, '0', {
                monsterId: helpingHands?.trollHandIds[0],
                targetPlayerId: '1',
            }),
        );
        expect(spentAttack.valid).toBe(false);
        expect(spentAttack.error).toContain('必须选择一个可行动的巨魔手');
    });

    it('说“茄子”！作祟检定成功会进入魔法相机剧本并按相机持有者决定叛徒', () => {
        const core = createMagicCameraHauntCore('1');

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(33);
        expect(core.scenarioRuntime.traitorPlayerId).toBe('1');
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'magic-camera-owner',
            traitorPlayerId: '1',
            teamModel: 'one-traitor',
            reasonLabel: '魔法相机持有者；没有持有者时为作祟揭秘者',
            candidatePlayerIds: ['1'],
            excludedPlayerIds: [],
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-traitor',
            anchorPlayerId: '1',
            nextPlayerId: '2',
            reasonLabel: '叛徒左侧玩家先行动',
            representativeOnly: true,
        });
        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.magicCamera?.cameraHolderPlayerId).toBe('1');
        expect(core.scenarioRuntime.magicCamera?.heroEssencePlayerIds.sort()).toEqual(['0', '2']);
        expect(core.scenarioRuntime.magicCamera?.phantomPhotographerIds).toHaveLength(3);
        expect(core.monsters.filter((monster) => monster.name === '幻影摄影师')).toHaveLength(3);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.name === '魔法相机')).toBe(true);

        const fallbackCore = createMagicCameraHauntCore(null);
        expect(fallbackCore.scenarioRuntime.traitorPlayerId).toBe('0');
        expect(fallbackCore.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'magic-camera-owner',
            traitorPlayerId: '0',
            teamModel: 'one-traitor',
            candidatePlayerIds: ['0'],
        });
        expect(fallbackCore.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-traitor',
            anchorPlayerId: '0',
            nextPlayerId: '1',
        });
        expect(fallbackCore.currentPlayer).toBe('1');
        expect(fallbackCore.scenarioRuntime.magicCamera?.cameraHolderPlayerId).toBe('0');
        expect(findTestExplorer(fallbackCore, '0').inventory.some((card) => card.name === '魔法相机')).toBe(true);
    });

    it('大宅饿了跳过作祟检定后会把属性奖励纳入翻牌确认队列', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('大宅饿了');
        expect(core.pendingEventChoice?.sourceTitle).toBe('大宅饿了');
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false, trait: 'knowledge' },
        );

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：知识 +1' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '大宅饿了',
            stepKind: 'event-effect',
            text: '事件效果：知识 +1',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('说“茄子”！跳过作祟检定仍按事件失败分支抽物品', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '说“茄子”！')!];
        core.possessionOrderByKind.item = [{ id: 'camera', name: '魔法相机', kind: 'item' }];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.phase).toBe('preHaunt');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：抽取一张物品卡' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '说“茄子”！',
            stepKind: 'event-effect',
            text: '事件效果：抽取一张物品卡',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentExplorer.inventory.at(-1)?.name).toBe('魔法相机');
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('魔法相机剧本拍照成功会夺取英雄本质并提升叛徒属性', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.currentExplorer.traits.speed = 6;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.TAKE_PHOTO,
            '1',
            { targetPlayerId: '0', trait: 'might' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );

        expect(core.scenarioRuntime.magicCamera?.heroEssencePlayerIds).not.toContain('0');
        expect(core.scenarioRuntime.magicCamera?.capturedEssencePlayerIds).toContain('0');
        expect(findTestExplorer(core, '1').traits.might).toBe(mightBefore + 1);
        expect(core.recentRoll?.latestLabel).toBe('夺取本质');
    });

    it('魔法相机剧本 Smash the Magic Camera 成功且摄影师全灭时英雄胜利', () => {
        let core = createMagicCameraHauntCore('1');
        const magicCamera = core.scenarioRuntime.magicCamera!;
        core.scenarioRuntime.magicCamera = {
            ...magicCamera,
            killedPhantomPhotographerIds: [...magicCamera.phantomPhotographerIds],
        };
        core.monsters = core.monsters.filter((monster) => !magicCamera.phantomPhotographerIds.includes(monster.id));
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.currentExplorer.traits.sanity = 6;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA,
            '2',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('magic-camera');
        expect(core.endgameResult?.outcome).toBe('survivors');
    });

    it('魔法相机剧本区分幻影摄影师被力量击杀和非力量攻击眩晕', () => {
        let killCore = createMagicCameraHauntCore('1');
        const killMonsterId = killCore.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        killCore.currentExplorer.traits.might = 6;
        killCore.currentExplorerTraits = { ...killCore.currentExplorer.traits };
        killCore.monsters = killCore.monsters.map((monster) => (
            monster.id === killMonsterId
                ? { ...monster, roomId: killCore.currentExplorer.roomId, might: 1 }
                : monster
        ));

        killCore = applyBetrayalCommand(
            killCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'phantom-photographer', targetMonsterId: killMonsterId },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1),
        );

        expect(killCore.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds).toContain(killMonsterId);
        expect(killCore.monsters.some((monster) => monster.id === killMonsterId)).toBe(false);

        let stunCore = createMagicCameraHauntCore('1');
        const stunMonsterId = stunCore.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        stunCore.currentExplorer.inventory = [...stunCore.currentExplorer.inventory, { id: 'ring', name: '指环', kind: 'omen' }];
        stunCore.currentExplorerInventory = [...stunCore.currentExplorer.inventory];
        stunCore.turnStartInventoryCardIds = [...stunCore.turnStartInventoryCardIds, 'ring'];
        stunCore.currentExplorer.traits.sanity = 6;
        stunCore.currentExplorerTraits = { ...stunCore.currentExplorer.traits };
        stunCore.monsters = stunCore.monsters.map((monster) => (
            monster.id === stunMonsterId
                ? { ...monster, roomId: stunCore.currentExplorer.roomId, sanity: 1 }
                : monster
        ));

        stunCore = applyBetrayalCommand(
            stunCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'phantom-photographer', targetMonsterId: stunMonsterId, weaponCardId: 'ring' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1),
        );

        expect(stunCore.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds).toContain(stunMonsterId);
        expect(stunCore.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds).not.toContain(stunMonsterId);
        expect(stunCore.monsters.some((monster) => monster.id === stunMonsterId)).toBe(true);

        activateTestExplorer(stunCore, '1');
        const stunnedAttack = BetrayalDomain.validate(
            { core: stunCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK, '1', {
                monsterId: stunMonsterId,
                targetPlayerId: '2',
            }),
        );
        expect(stunnedAttack.valid).toBe(false);
        expect(stunnedAttack.error).toContain('已被眩晕');
    });

    it('怪物状态读模型区分幻影摄影师眩晕和杀死移除', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        const statuses = resolveBetrayalMonsterStatuses(core);
        const stunnedStatus = statuses.find((status) => status.monsterId === stunnedMonsterId);
        const killedStatus = statuses.find((status) => status.monsterId === killedMonsterId);

        expect(stunnedStatus).toMatchObject({
            name: '幻影摄影师',
            status: 'stunned',
            canBeStunned: true,
            stunned: true,
            killed: false,
            removedFromHouse: false,
            slowsHeroMovement: false,
            canHoldPossessions: false,
            canExploreNewRooms: false,
            traits: {
                usesTraitTrack: false,
            },
        });
        expect(killedStatus).toMatchObject({
            name: '幻影摄影师',
            roomId: null,
            status: 'killed',
            canBeStunned: true,
            stunned: false,
            killed: true,
            removedFromHouse: true,
            slowsHeroMovement: false,
            traits: {
                might: 4,
                speed: 1,
                sanity: 6,
                knowledge: 2,
                usesTraitTrack: false,
            },
        });
        expect(statuses.filter((status) => status.monsterId === killedMonsterId)).toHaveLength(1);
    });

    it('怪物回合开始读模型会让已击晕怪物翻正并跳过本次回合', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        expect(resolveBetrayalMonsterTurnStartStatus(core, stunnedMonsterId!)).toMatchObject({
            monsterId: stunnedMonsterId,
            name: '幻影摄影师',
            status: 'stunned',
            nextStatus: 'active',
            canStartTurn: false,
            mustFlipStunnedSideUp: true,
            mustSkipTurn: true,
            canRollMovement: false,
            canAttack: false,
        });
        expect(resolveBetrayalMonsterTurnStartStatus(core, killedMonsterId!)).toMatchObject({
            status: 'killed',
            nextStatus: 'killed',
            canStartTurn: false,
            mustSkipTurn: true,
            canRollMovement: false,
            canAttack: false,
        });
        expect(resolveBetrayalMonsterTurnStartStatus(core, activeMonsterId!)).toMatchObject({
            status: 'active',
            nextStatus: 'active',
            canStartTurn: true,
            mustFlipStunnedSideUp: false,
            mustSkipTurn: false,
            canRollMovement: true,
            canAttack: true,
            reason: null,
        });
    });

    it('怪物回合开始结算预览会列出翻正跳过和移动骰合同', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        expect(resolveBetrayalMonsterTurnStartResolutionPreview(core, stunnedMonsterId!)).toMatchObject({
            active: true,
            canResolve: true,
            resolutionStatus: 'ready',
            monsterId: stunnedMonsterId,
            name: '幻影摄影师',
            status: 'stunned',
            nextStatus: 'active',
            willFlipStunnedSideUp: true,
            willRemoveStunnedMarker: true,
            willSkipTurn: true,
            willStartTurn: false,
            willRollMovement: false,
            willOpenAttackWindow: false,
            movementGroupId: null,
            movementDiceCount: null,
            minimumMoveAllowance: null,
            contractGaps: ['ui-token-flip'],
            previewOnly: true,
        });
        expect(resolveBetrayalMonsterTurnStartResolutionPreview(core, activeMonsterId!)).toMatchObject({
            active: true,
            canResolve: true,
            resolutionStatus: 'ready',
            monsterId: activeMonsterId,
            status: 'active',
            nextStatus: 'active',
            willFlipStunnedSideUp: false,
            willRemoveStunnedMarker: false,
            willSkipTurn: false,
            willStartTurn: true,
            willRollMovement: true,
            willOpenAttackWindow: true,
            movementGroupId: '幻影摄影师:1',
            movementDiceCount: 1,
            minimumMoveAllowance: 1,
            contractGaps: [],
            previewOnly: true,
            reason: null,
        });
        expect(resolveBetrayalMonsterTurnStartResolutionPreview(core, killedMonsterId!)).toMatchObject({
            active: true,
            canResolve: true,
            resolutionStatus: 'ready',
            status: 'killed',
            nextStatus: 'killed',
            willSkipTurn: true,
            willStartTurn: false,
            willRollMovement: false,
            willOpenAttackWindow: false,
            contractGaps: [],
        });
        expect(resolveBetrayalMonsterTurnStartResolutionPreview(core, 'missing-monster')).toMatchObject({
            active: false,
            canResolve: false,
            resolutionStatus: 'missing-monster',
            status: null,
            nextStatus: null,
            contractGaps: [],
            reason: '当前宅邸中找不到该怪物。',
        });
    });

    it('怪物回合开始正式命令会翻正击晕怪物并记录本次跳过', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const stunnedMonsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId],
        };

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, '1', { monsterId: stunnedMonsterId }),
        );
        expect(validation.valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
            '1',
            { monsterId: stunnedMonsterId },
        );

        expect(core.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds).not.toContain(stunnedMonsterId);
        expect(resolveBetrayalMonsterTurnStartStatus(core, stunnedMonsterId)).toMatchObject({
            status: 'active',
            canRollMovement: false,
            canAttack: false,
            reason: '该怪物本回合已跳过，不能再次移动或攻击。',
        });
        expect(resolveBetrayalMonsterTurnRuntimeState(core)).toMatchObject({
            resolvedStartMonsterIds: [stunnedMonsterId],
            skippedMonsterIdsThisTurn: [stunnedMonsterId],
        });
        expect(resolveBetrayalMonsterMovementGroups(core).flatMap((group) => group.monsterIds))
            .not.toContain(stunnedMonsterId);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, stunnedMonsterId)).toEqual([]);
        expect(resolveBetrayalMonsterActionSet(core, stunnedMonsterId)).toMatchObject({
            canMove: false,
            canAttack: false,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, '1', { monsterId: stunnedMonsterId }),
        )).toMatchObject({
            valid: false,
            error: '该怪物本回合开始步骤已处理。',
        });
        expect(core.activityLog[0]?.text).toContain('翻回正面');
    });

    it('怪物移动骰组正式命令会写入同类型怪物共享移动额度', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const groupId = '幻影摄影师:1';
        const activeMonsterIds = resolveBetrayalMonsterMovementGroups(core)
            .find((group) => group.groupId === groupId)?.monsterIds ?? [];
        expect(activeMonsterIds.length).toBeGreaterThan(1);
        expect(resolveBetrayalMonsterMovementRollGroupPreview(core, groupId)).toMatchObject({
            canRoll: true,
            contractGaps: ['path-preview-ui'],
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            '1',
            { groupId },
            100,
            createBetrayalScriptedRandom(3),
        );

        const monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(monsterTurn.movementRollsByGroupId[groupId]).toMatchObject({
            groupId,
            monsterName: '幻影摄影师',
            monsterIds: activeMonsterIds,
            dice: [2],
            total: 2,
            moveAllowance: 2,
        });
        expect(Object.fromEntries(
            activeMonsterIds.map((monsterId) => [monsterId, monsterTurn.moveRemainingById[monsterId]]),
        )).toEqual(Object.fromEntries(activeMonsterIds.map((monsterId) => [monsterId, 2])));
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            playerId: '1',
            sourceTitle: '幻影摄影师移动',
            latestLabel: '每只可移动 2 间',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP, '1', { groupId }),
        )).toMatchObject({
            valid: false,
            error: '该怪物移动骰组本回合已掷骰。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        expect(resolveBetrayalMonsterTurnRuntimeState(core)).toMatchObject({
            resolvedStartMonsterIds: [],
            skippedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        });
    });

    it('同类型普通怪物共用一次移动骰但逐只独立消耗移动额度', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        activateTestExplorer(core, traitorId);
        const monsterIds = ['test-normal-monster-a', 'test-normal-monster-b'];
        const roomId = 'entrance-hall';
        core.currentExplorer.roomId = roomId;
        core.otherExplorers = core.otherExplorers.map((explorer) => ({ ...explorer, roomId }));
        core.activeRoomId = roomId;
        core.currentExplorerRoomId = roomId;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = monsterIds.map((id) => ({
            id,
            name: '测试怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId,
            might: 4,
            speed: 1,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }));
        const groupId = '测试怪物:1';
        expect(resolveBetrayalMonsterMovementGroups(core)).toEqual([
            expect.objectContaining({
                groupId,
                monsterIds,
                diceCount: 1,
                rollOnceForGroup: true,
                minimumMoveAllowance: 1,
            }),
        ]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId },
            100,
            createBetrayalScriptedRandom(3),
        );

        let monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(monsterTurn.movementRollsByGroupId[groupId]).toMatchObject({
            monsterIds,
            dice: [2],
            moveAllowance: 2,
        });
        expect(monsterTurn.moveRemainingById).toMatchObject({
            [monsterIds[0]!]: 2,
            [monsterIds[1]!]: 2,
        });
        const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, monsterIds[0]!)[0];
        expect(targetRoom).toBeDefined();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            traitorId,
            { monsterId: monsterIds[0]!, roomId: targetRoom!.id },
        );
        monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(core.monsters.find((monster) => monster.id === monsterIds[0])?.roomId).toBe(targetRoom!.id);
        expect(core.monsters.find((monster) => monster.id === monsterIds[1])?.roomId).toBe(roomId);
        expect(monsterTurn.moveRemainingById).toMatchObject({
            [monsterIds[0]!]: 0,
            [monsterIds[1]!]: 2,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, traitorId, {
                monsterId: monsterIds[1]!,
                roomId: targetRoom!.id,
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            traitorId,
            { monsterId: monsterIds[1]!, roomId: targetRoom!.id },
        );
        monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(core.monsters.find((monster) => monster.id === monsterIds[1])?.roomId).toBe(targetRoom!.id);
        expect(monsterTurn.moveRemainingById).toMatchObject({
            [monsterIds[0]!]: 0,
            [monsterIds[1]!]: 0,
        });
    });

    it('多类型普通怪物移动骰组会分开掷骰并在第一组完成后继续开放第二组', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        activateTestExplorer(core, traitorId);
        const roomId = 'entrance-hall';
        core.currentExplorer.roomId = roomId;
        core.otherExplorers = core.otherExplorers.map((explorer) => ({ ...explorer, roomId }));
        core.activeRoomId = roomId;
        core.currentExplorerRoomId = roomId;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            {
                id: 'test-slow-monster',
                name: '慢速怪物',
                portraitAsset: 'betrayal/monsters/spirit',
                tokenAsset: 'betrayal/tokens/monsters/ghost',
                roomId,
                might: 4,
                speed: 1,
                sanity: 4,
                knowledge: 4,
                damage: 1,
            },
            {
                id: 'test-fast-monster',
                name: '快速怪物',
                portraitAsset: 'betrayal/monsters/spirit',
                tokenAsset: 'betrayal/tokens/monsters/ghost',
                roomId,
                might: 4,
                speed: 2,
                sanity: 4,
                knowledge: 4,
                damage: 1,
            },
        ];
        expect(resolveBetrayalMonsterMovementGroups(core).map((group) => group.groupId)).toEqual([
            '慢速怪物:1',
            '快速怪物:2',
        ]);
        let panel = resolveBetrayalMonsterActionPanel(core);
        expect(panel.slots.find((slot) => slot.id === 'movement-roll:慢速怪物:1')).toMatchObject({
            kind: 'movement-roll',
            enabled: true,
        });
        expect(panel.slots.find((slot) => slot.id === 'movement-roll:快速怪物:2')).toMatchObject({
            kind: 'movement-roll',
            enabled: true,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId: '慢速怪物:1' },
            100,
            createBetrayalScriptedRandom(3),
        );

        let monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(monsterTurn.movementRollsByGroupId['慢速怪物:1']).toMatchObject({
            monsterIds: ['test-slow-monster'],
            moveAllowance: 2,
        });
        expect(monsterTurn.movementRollsByGroupId['快速怪物:2']).toBeUndefined();
        panel = resolveBetrayalMonsterActionPanel(core);
        expect(panel.slots.find((slot) => slot.id === 'movement-roll:慢速怪物:1')).toMatchObject({
            enabled: false,
            reason: '该怪物移动骰组本回合已掷骰。',
        });
        expect(panel.slots.find((slot) => slot.id === 'movement-roll:快速怪物:2')).toMatchObject({
            enabled: true,
            reason: null,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId: '快速怪物:2' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(monsterTurn.movementRollsByGroupId['快速怪物:2']).toMatchObject({
            monsterIds: ['test-fast-monster'],
            dice: [2, 2],
            moveAllowance: 4,
        });
        panel = resolveBetrayalMonsterActionPanel(core);
        expect(panel.slots.find((slot) => slot.kind === 'movement-roll' && slot.enabled)).toBeUndefined();
        expect(panel.slots.find((slot) => slot.id === 'move:test-slow-monster')).toMatchObject({
            enabled: true,
            moveRemaining: 2,
        });
        expect(panel.slots.find((slot) => slot.id === 'move:test-fast-monster')).toMatchObject({
            enabled: true,
            moveRemaining: 4,
        });
    });

    it('怪物正式移动命令会消耗移动额度并写回目标房间', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const groupId = '幻影摄影师:1';
        const monsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        core.monsters = core.monsters.map((monster) => (
            monster.id === monsterId
                ? { ...monster, roomId: 'hallway' }
                : monster
        ));
        findTestExplorer(core, '0').roomId = 'hallway';
        const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, monsterId)[0];
        expect(targetRoom).toBeDefined();
        expect(resolveBetrayalMonsterMoveCost(core, monsterId)).toBe(2);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '1', {
                monsterId,
                roomId: targetRoom!.id,
            }),
        )).toMatchObject({
            valid: false,
            error: '该怪物本回合没有剩余移动额度。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            '1',
            { groupId },
            100,
            createBetrayalScriptedRandom(3),
        );
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '1', {
                monsterId,
                roomId: targetRoom!.id,
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            '1',
            { monsterId, roomId: targetRoom!.id },
        );

        expect(core.monsters.find((monster) => monster.id === monsterId)?.roomId).toBe(targetRoom!.id);
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById[monsterId]).toBe(0);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '1', {
                monsterId,
                roomId: 'entrance-hall',
            }),
        )).toMatchObject({
            valid: false,
            error: '该怪物本回合没有剩余移动额度。',
        });
        expect(core.activityLog.some((entry) => entry.text.includes('幻影摄影师') && entry.text.includes('移动到'))).toBe(true);
    });

    it('杰克之灵通过通用怪物移动命令移动时会同步专用房间状态', () => {
        let core = createJackSpiritMovementRollReadyCore();
        const movementGroup = resolveBetrayalMonsterMovementGroups(core)
            .find((group) => group.monsterIds.includes('jack-spirit'));
        expect(movementGroup).toBeDefined();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            '2',
            { groupId: movementGroup!.groupId },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, 'jack-spirit')
            .find((room) => room.id === 'basement-landing');
        expect(targetRoom).toBeDefined();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            '2',
            { monsterId: 'jack-spirit', roomId: targetRoom!.id },
        );

        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('basement-landing');
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.scenarioRuntime.jackSpiritHasMovedSinceRelease).toBe(true);
        expect(core.activeRoomId).toBe('basement-landing');
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById['jack-spirit']).toBeGreaterThanOrEqual(0);
    });

    it('怪物移动分组读模型不会给击晕或已杀死怪物分配移动骰组', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        const movementGroups = resolveBetrayalMonsterMovementGroups(core);

        expect(movementGroups).toHaveLength(1);
        expect(movementGroups[0]).toMatchObject({
            monsterName: '幻影摄影师',
            monsterIds: [activeMonsterId],
            speed: 1,
            diceCount: 1,
            rollOnceForGroup: true,
            minimumMoveAllowance: 1,
        });
        expect(movementGroups[0]?.monsterIds).not.toContain(stunnedMonsterId);
        expect(movementGroups[0]?.monsterIds).not.toContain(killedMonsterId);
    });

    it('怪物移动目标读模型不会让击晕或已杀死怪物移动', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        expect(resolveBetrayalMonsterMoveTargetRooms(core, stunnedMonsterId!)).toEqual([]);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, killedMonsterId!)).toEqual([]);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, activeMonsterId!)
            .every((room) => room.state === 'discovered')).toBe(true);
    });

    it('怪物行动集合读模型不会给击晕或已杀死怪物开放移动和攻击', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        const actionSets = resolveBetrayalMonsterActionSets(core);
        const stunnedActionSet = actionSets.find((actionSet) => actionSet.monsterId === stunnedMonsterId);
        const killedActionSet = actionSets.find((actionSet) => actionSet.monsterId === killedMonsterId);
        const activeActionSet = actionSets.find((actionSet) => actionSet.monsterId === activeMonsterId);

        expect(stunnedActionSet).toMatchObject({
            status: 'stunned',
            canMove: false,
            moveTargetRoomIds: [],
            canAttack: false,
            usesNormalAttackRules: false,
        });
        expect(killedActionSet).toMatchObject({
            status: 'killed',
            roomId: null,
            canMove: false,
            moveTargetRoomIds: [],
            canAttack: false,
            usesNormalAttackRules: false,
        });
        expect(activeActionSet).toMatchObject({
            status: 'active',
            canAttack: true,
            defaultAttackTrait: 'sanity',
        });
    });

    it('怪物动作槽读模型会把击晕翻正跳过和 UI 翻面缺口暴露给界面', () => {
        const core = createMagicCameraHauntCore('1');
        const stunnedMonsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId],
        };

        const panel = resolveBetrayalMonsterActionPanel(core);
        const turnStartSlot = panel.slots.find((slot) => slot.id === `turn-start:${stunnedMonsterId}`);
        const moveSlot = panel.slots.find((slot) => slot.id === `move:${stunnedMonsterId}`);
        const attackSlot = panel.slots.find((slot) => slot.id === `attack:${stunnedMonsterId}`);

        expect(panel.active).toBe(true);
        expect(panel.contractGaps).toContain('ui-token-flip');
        expect(turnStartSlot).toMatchObject({
            kind: 'turn-start',
            command: BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
            enabled: true,
            contractGaps: ['ui-token-flip'],
        });
        expect(moveSlot).toMatchObject({
            enabled: false,
            targetRoomIds: [],
        });
        expect(attackSlot).toMatchObject({
            enabled: false,
            defaultAttackTrait: 'sanity',
        });
    });

    it('普通怪物攻击目标读模型只列出同房存活英雄并可走正式命令', () => {
        const core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const [aliveHeroId, deadHeroId] = core.playerIds.filter((playerId) => playerId !== traitorId);
        expect(aliveHeroId).toBeDefined();
        expect(deadHeroId).toBeDefined();
        const roomId = 'entrance-hall';
        core.monsters = [{
            id: 'test-normal-monster',
            name: '测试怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId,
            might: 4,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];
        findTestExplorer(core, traitorId).roomId = roomId;
        findTestExplorer(core, aliveHeroId!).roomId = roomId;
        findTestExplorer(core, deadHeroId!).roomId = roomId;
        core.scenarioRuntime.deadExplorerPlayerIds = [deadHeroId!];

        const targets = resolveBetrayalNormalMonsterAttackTargets(core, 'test-normal-monster');

        expect(targets).toMatchObject({
            monsterId: 'test-normal-monster',
            monsterName: '测试怪物',
            roomId,
            defaultAttackTrait: 'might',
            targetPlayerIds: [aliveHeroId],
            usesNormalAttackRules: true,
            canResolveWithExistingCommand: true,
            reason: null,
            contractGaps: [],
        });
        expect(targets?.targetPlayerIds).not.toContain(traitorId);
        expect(targets?.targetPlayerIds).not.toContain(deadHeroId);
        expect(targets?.targetLabels).toEqual([findTestExplorer(core, aliveHeroId!).displayName]);
    });

    it('普通怪物正式攻击命令只允许同房存活英雄目标', () => {
        const core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const [aliveHeroId, deadHeroId] = core.playerIds.filter((playerId) => playerId !== traitorId);
        expect(aliveHeroId).toBeDefined();
        expect(deadHeroId).toBeDefined();
        const monsterId = 'test-normal-monster';
        const roomId = 'entrance-hall';
        core.monsters = [{
            id: monsterId,
            name: '测试怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId,
            might: 4,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];
        findTestExplorer(core, traitorId).roomId = roomId;
        findTestExplorer(core, aliveHeroId!).roomId = roomId;
        findTestExplorer(core, deadHeroId!).roomId = roomId;
        core.scenarioRuntime.deadExplorerPlayerIds = [deadHeroId!];

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, core.currentPlayer, {
                monsterId,
                targetPlayerId: aliveHeroId,
            }),
        )).toMatchObject({ valid: true });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, core.currentPlayer, {
                monsterId,
                targetPlayerId: traitorId,
            }),
        )).toMatchObject({ valid: false });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, core.currentPlayer, {
                monsterId,
                targetPlayerId: deadHeroId,
            }),
        )).toMatchObject({ valid: false });

        findTestExplorer(core, aliveHeroId!).roomId = 'hallway';
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, core.currentPlayer, {
                monsterId,
                targetPlayerId: aliveHeroId,
            }),
        )).toMatchObject({ valid: false });
    });

    it('普通怪物正式攻击会进入攻击骰盘、待分配伤害并关闭该怪物攻击槽', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const targetHeroId = core.playerIds.find((playerId) => playerId !== traitorId)!;
        const monsterId = 'test-normal-monster';
        const roomId = 'entrance-hall';
        core.monsters = [{
            id: monsterId,
            name: '测试怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId,
            might: 4,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];
        findTestExplorer(core, targetHeroId).roomId = roomId;
        setHighCapacityPhysicalDamageTracks(core, targetHeroId);
        const heroPhysicalPositionBefore = traitTrackPositionTotal(core, targetHeroId, ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            core.currentPlayer,
            { monsterId, targetPlayerId: targetHeroId },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.recentRoll).toMatchObject({
            kind: 'attackRoll',
            sourceTitle: '测试怪物攻击',
            playerId: core.currentPlayer,
            attack: {
                target: 'hero',
                defenderPlayerId: targetHeroId,
                damageKind: 'physical',
            },
        });
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            playerId: targetHeroId,
            damageKind: 'physical',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.scenarioRuntime.monsterTurn.attackedMonsterIdsThisTurn).toContain(monsterId);
        expect(traitTrackPositionTotal(core, targetHeroId, ['might', 'speed'])).toBe(heroPhysicalPositionBefore);
        expect(resolveBetrayalMonsterActionPanel(core).slots.find((slot) => slot.id === `attack:${monsterId}`)).toMatchObject({
            enabled: false,
            reason: '该怪物本回合已经攻击过。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            targetHeroId,
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );
        expect(core.pendingDamageAllocation).toBeNull();
        expect(traitTrackPositionTotal(core, targetHeroId, ['might', 'speed'])).toBeLessThan(heroPhysicalPositionBefore);
    });

    it('杰克之灵普通攻击目标读模型复用现有攻击命令并排除叛徒和死亡英雄', () => {
        const core = createJackSpiritMovementRollReadyCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const [aliveHeroId, deadHeroId] = core.playerIds.filter((playerId) => playerId !== traitorId);
        expect(aliveHeroId).toBeDefined();
        expect(deadHeroId).toBeDefined();
        const roomId = core.scenarioRuntime.jackSpiritRoomId!;
        findTestExplorer(core, traitorId).roomId = roomId;
        findTestExplorer(core, aliveHeroId!).roomId = roomId;
        findTestExplorer(core, deadHeroId!).roomId = roomId;
        core.scenarioRuntime.deadExplorerPlayerIds = [deadHeroId!];

        const targets = resolveBetrayalNormalMonsterAttackTargets(core, 'jack-spirit');

        expect(targets).toMatchObject({
            monsterId: 'jack-spirit',
            monsterName: '杰克之灵',
            roomId,
            defaultAttackTrait: 'might',
            targetPlayerIds: [aliveHeroId],
            usesNormalAttackRules: true,
            canResolveWithExistingCommand: true,
            reason: null,
            contractGaps: [],
        });
        expect(targets?.targetPlayerIds).not.toContain(traitorId);
        expect(targets?.targetPlayerIds).not.toContain(deadHeroId);
    });

    it('怪物动作槽读模型会先要求掷移动骰，掷完后才开放移动目标', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const groupId = '幻影摄影师:1';
        const monsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        core.monsters = core.monsters.map((monster) => (
            monster.id === monsterId
                ? { ...monster, roomId: 'hallway' }
                : monster
        ));
        findTestExplorer(core, '0').roomId = 'hallway';

        const beforeRoll = resolveBetrayalMonsterActionPanel(core);
        expect(beforeRoll.movementGroupIds).toContain(groupId);
        expect(beforeRoll.slots.find((slot) => slot.id === `movement-roll:${groupId}`)).toMatchObject({
            command: BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            enabled: true,
            contractGaps: ['path-preview-ui'],
        });
        expect(beforeRoll.slots.find((slot) => slot.id === `move:${monsterId}`)).toMatchObject({
            command: BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            enabled: false,
            moveRemaining: 0,
            moveCost: 2,
            reason: '请先为该怪物所属类型掷移动骰，或移动点不足以离开当前房间。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            '1',
            { groupId },
            100,
            createBetrayalScriptedRandom(3),
        );

        const afterRoll = resolveBetrayalMonsterActionPanel(core);
        const moveSlot = afterRoll.slots.find((slot) => slot.id === `move:${monsterId}`);
        expect(moveSlot).toMatchObject({
            enabled: true,
            moveRemaining: 2,
            moveCost: 2,
        });
        expect(moveSlot?.targetRoomIds.length).toBeGreaterThan(0);
        expect(afterRoll.contractGaps).toContain('path-preview-ui');
        expect(afterRoll.slots.find((slot) => slot.id === `attack:${monsterId}`)).toMatchObject({
            command: BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK,
            enabled: true,
            defaultAttackTrait: 'sanity',
            contractGaps: ['attack-target-ui'],
        });
    });

    it('魔法相机剧本幻影摄影师视线攻击可击倒全部英雄并让叛徒胜利', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const monsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        const hero = findTestExplorer(core, '2');
        hero.traits.sanity = 2;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.monsters = core.monsters.map((monster) => (
            monster.id === monsterId
                ? { ...monster, roomId: hero.roomId, sanity: 6 }
                : monster
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK,
            '1',
            { monsterId, targetPlayerId: '2' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('magic-camera');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.winners).toEqual(['1']);
    });

    it('最深的壁橱按官方锁定文本执行抽物品、精神伤害和地下室放置分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('最深的壁橱');
        expect(core.latestDiscovery?.detail).toContain('速度检定 4');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory).toHaveLength(1);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4, sanity: 4, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 1');
        expect(core.latestDiscovery?.detail).toContain('受到 1 点精神伤害');
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, might: 4, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'might', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 1, 3);
        const mightPositionBeforeClosetDamage = traitTrackPosition(core, '0', 'might');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始点');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforeClosetDamage - 2);
        expect(core.currentExplorer.traits.might).toBe(2);
        expect(core.currentExplorer.traits.speed).toBe(2);
    });

    it('嘎吱的木门按官方锁定文本执行知识检定和楼层起始点放置', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('嘎吱的木门');
        expect(core.latestDiscovery?.detail).toContain('知识检定 6');
        expect(core.latestDiscovery?.detail).toContain('放置到上层起始板块');
        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.activeRoomId).toBe('upper-landing');
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 4');
        expect(core.latestDiscovery?.detail).toContain('放置到地面层起始板块');
        expect(core.currentExplorer.roomId).toBe('grand-staircase');
        expect(core.activeRoomId).toBe('grand-staircase');
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 0');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始板块');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('脑状食品按官方锁定文本执行力量检定三档、属性选择和通用伤害分配', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('脑状食品');
        expect(core.latestDiscovery?.detail).toContain('力量检定 6');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点力量或速度');
        expect(core.pendingEventChoice?.sourceTitle).toBe('脑状食品');

        const moveBeforeReadingEvent = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' }),
        );
        expect(moveBeforeReadingEvent.valid).toBe(false);
        if (!moveBeforeReadingEvent.valid) {
            expect(moveBeforeReadingEvent.error).toContain('请先处理当前事件');
        }

        const endTurnBeforeReadingEvent = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        );
        expect(endTurnBeforeReadingEvent.valid).toBe(false);
        if (!endTurnBeforeReadingEvent.valid) {
            expect(endTurnBeforeReadingEvent.error).toContain('请先处理当前事件');
        }

        const missingTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {}),
        );
        expect(missingTrait.valid).toBe(false);

        const speedPositionBeforeChoice = core.currentExplorer.traitTracks.speed.position;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { trait: 'speed' });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforeChoice + 1);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '脑状食品',
            stepKind: 'event-effect',
            text: '事件效果：速度 +1',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.turnEndedByDiscovery).toBe(false);
        expect(core.recentRoll).toBeNull();
        expect(core.recommendedAction).toBe('move');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'speed', [1, 3, 4, 4, 5], 2, 2);
        setTestTraitTrack(core, '0', 'sanity', [1, 3, 4, 4, 5], 2, 2);
        const speedPositionBeforeCompound = core.currentExplorer.traitTracks.speed.position;
        const sanityPositionBeforeCompound = core.currentExplorer.traitTracks.sanity.position;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 2');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点速度并失去 1 点神志');
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforeCompound + 1);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traitTracks.sanity.position).toBe(sanityPositionBeforeCompound - 1);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            setTestTraitTrack(core, '0', trait, [1, 3, 4, 5], 2, 2);
        }
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 2 点通用伤害');
        expect(core.pendingEventChoice?.sourceTitle).toBe('脑状食品');

        const missingDamageTraits = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { traits: ['might'] }),
        );
        expect(missingDamageTraits.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { traits: ['might', 'knowledge'] },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.latestDiscovery?.detail).toContain('通用伤害 2（力量、知识）');
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '脑状食品',
            stepKind: 'event-effect',
            text: '事件效果：通用伤害 2（力量、知识）',
            index: 1,
            total: 1,
        });
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('事件一般伤害不能绕过页面分配到作祟前已临界属性', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'might', [1, 2, 3], 0, 1);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 2, 1);
        core.pendingEventChoice = {
            id: 'test-critical-general-damage-choice',
            playerId: '0',
            sourceTitle: '临界伤害领域校验',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might', 'speed'],
                recommendedAction: 'endTurn',
            },
        };

        const lockedTraitDamage = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { traits: ['might'] }),
        );
        expect(lockedTraitDamage.valid).toBe(false);

        const validSpeedDamage = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { traits: ['speed'] }),
        );
        expect(validSpeedDamage.valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { traits: ['speed'] },
        );

        expect(core.currentExplorer.traitTracks.might.position).toBe(0);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(1);
        expect(core.latestDiscovery?.detail).toContain('通用伤害 1（速度）');
    });

    it('上古旧宅按官方锁定文本选择速度或力量检定、目标板块和伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 5,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 4, 3);
        setTestTraitTrack(core, '0', 'might', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 3, 4, 5], 3, 3);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('上古旧宅');
        expect(core.pendingEventChoice?.sourceTitle).toBe('上古旧宅');
        const missingTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { trait: 'speed' }),
        );
        expect(missingTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'upper-landing' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('速度检定 10');
        expect(core.latestDiscovery?.detail).toContain('放置到任意板块');
        expect(core.latestDiscovery?.detail).toContain('放置到上层起始点');
        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '上古旧宅', '放置到上层起始点');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        const invalidUpperTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'might',
                targetRoomId: 'upper-landing',
                traits: ['might'],
            }),
        );
        expect(invalidUpperTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'might', targetRoomId: 'hallway', traits: ['might'] },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 4');
        expect(core.latestDiscovery?.detail).toContain('放置到任意地面层板块，并受到 1 点通用伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');
        expect(core.latestDiscovery?.detail).toContain('通用伤害 1（力量）');
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '上古旧宅', '通用伤害 1（力量）');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 2,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        const invalidGroundTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'speed',
                targetRoomId: 'hallway',
            }),
        );
        expect(invalidGroundTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'basement-landing' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 2');
        expect(core.latestDiscovery?.detail).toContain('放置到任意地下室板块，并受到 1 点精神伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始点');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '上古旧宅', '精神伤害');
    });

    it('吊死鬼按官方锁定文本执行四项属性连续检定', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 3,
                speed: 3,
                knowledge: 3,
                sanity: 3,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            setTestTraitTrack(core, '0', trait, [1, 2, 2, 3, 4], 3);
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('吊死鬼');
        expect(core.latestDiscovery?.detail).toContain('每项属性各检定一次');
        expect(core.recentAllTraitCheck?.results.map((result) => [result.trait, result.total, result.passed])).toEqual([
            ['might', 4, true],
            ['speed', 0, false],
            ['knowledge', 4, true],
            ['sanity', 0, false],
        ]);
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(2);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(2);
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 3,
                speed: 3,
                knowledge: 3,
                sanity: 3,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            setTestTraitTrack(core, '0', trait, [1, 2, 2, 3, 4], 3);
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2),
        );

        expect(core.recentAllTraitCheck?.results.every((result) => result.passed)).toBe(true);
        expect(core.pendingEventChoice?.sourceTitle).toBe('吊死鬼');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        core = acknowledgeSingleEventEffectResolution(core, '吊死鬼', '知识 +1');
    });

    it('一条秘密通道按官方锁定文本放置秘密通道标志物并选择第二目标板块', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('一条秘密通道');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).not.toContain('secretPassage');

        const invalidSameRoom = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'ground-north' }),
        );
        expect(invalidSameRoom.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'basement-landing' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'basement-landing')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.latestDiscovery?.detail).toContain('在当前板块放置秘密通道标志物');
        expect(core.latestDiscovery?.detail).toContain('在地下室起始点放置秘密通道标志物');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-landing');

        core.movesRemaining = 1;
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '一条秘密通道',
            stepKind: 'event-effect',
            text: expect.stringContaining('秘密通道'),
            index: 1,
            total: 1,
        });
        const moveBeforeAcknowledgingSecretPassage = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' }),
        );
        expect(moveBeforeAcknowledgingSecretPassage.valid).toBe(false);
        if (!moveBeforeAcknowledgingSecretPassage.valid) {
            expect(moveBeforeAcknowledgingSecretPassage.error).toContain('请先确认当前翻牌结算');
        }
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);
        const sameTurnSecretPassageMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' }),
        );
        expect(sameTurnSecretPassageMove.valid).toBe(false);
        if (!sameTurnSecretPassageMove.valid) {
            expect(sameTurnSecretPassageMove.error).toContain('回合已经结束');
        }

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        const invalidUpperTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'upper-landing' }),
        );
        expect(invalidUpperTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'hallway' },
        );

        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'hallway')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '一条秘密通道',
            stepKind: 'event-effect',
            text: expect.stringContaining('秘密通道'),
            index: 1,
            total: 1,
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'basement-landing' },
        );

        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'basement-landing')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '一条秘密通道',
            stepKind: 'event-effect',
            text: expect.stringContaining('秘密通道'),
            index: 1,
            total: 1,
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);
    });

    it('蜘蛛按官方锁定文本选择属性并放置到相邻板块', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '蜘蛛！')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                sanity: 4,
                speed: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'speed', [1, 3, 4, 4, 5], 2, 2);
        setTestTraitTrack(core, '0', 'sanity', [1, 3, 4, 4, 5], 2, 2);
        const speedPositionBeforeSpiderChoice = core.currentExplorer.traitTracks.speed.position;
        const sanityPositionBeforeSpiderChoice = core.currentExplorer.traitTracks.sanity.position;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('蜘蛛！');
        expect(core.pendingEventChoice?.sourceTitle).toBe('蜘蛛！');

        const invalidTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'speed',
                targetRoomId: 'upper-landing',
            }),
        );
        expect(invalidTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'hallway' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforeSpiderChoice + 1);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorerTraits.speed).toBe(core.currentExplorer.traits.speed);
        expect(core.currentExplorer.traitTracks.sanity.position).toBe(sanityPositionBeforeSpiderChoice);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.currentExplorerTraits.sanity).toBe(core.currentExplorer.traits.sanity);
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.latestDiscovery?.detail).toContain('速度 +1');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');
        core = acknowledgeSingleEventEffectResolution(core, '蜘蛛！', '速度 +1');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '蜘蛛！')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                sanity: 4,
                speed: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'speed', [1, 3, 4, 5], 2, 2);
        setTestTraitTrack(core, '0', 'sanity', [1, 3, 4, 5], 2, 2);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1, 1),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '蜘蛛！', '神志 -1');
    });

    it('盔甲和头戴耳机不会阻挡通用伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '通用伤害边界',
                effect: {
                    mode: 'generalDamage',
                    amount: 2,
                    traits: ['might', 'sanity'],
                    recommendedAction: 'endTurn',
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'armor', name: '盔甲', kind: 'omen' },
                { id: 'radio', name: '头戴耳机', kind: 'item' },
            ],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;
        const sanityBefore = core.currentExplorer.traits.sanity;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.might).toBe(mightBefore - 1);
        expect(core.currentExplorer.traits.sanity).toBe(sanityBefore - 1);
    });

    it('雕像发现事件符号板块时可选择不抽事件卡且不结算事件效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['idol'];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north', useIdol: true });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.summary).toBe('已用雕像跳过');
        expect(core.latestDiscovery?.detail).toContain('没有抽取或结算事件卡');
        expect(core.currentExplorer.traits.might).toBe(mightBefore);
        expect(core.discardCounts.event).toBe(0);
        expect(core.activityLog[0]?.text).toContain('使用雕像跳过了事件：阴影扑面');
    });

    it('雕像会让事件中的力量检定结果 +1', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '沉重铁门',
                roll: {
                    trait: 'might',
                    branches: [
                        { min: 5, label: '推开铁门，获得 1 点力量', effect: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被铁门撞伤，失去 1 点力量', effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
            },
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.detail).toContain('力量检定 5');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点力量');
        expect(core.currentExplorer.traits.might).toBe(mightBefore + 1);
    });

    it('没有雕像或不是事件符号板块时，不能声明用雕像跳过事件', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });

        const withoutIdol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north', useIdol: true }),
        );
        expect(withoutIdol.valid).toBe(false);
        if (!withoutIdol.valid) {
            expect(withoutIdol.error).toContain('不能使用雕像');
        }

        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['idol'];
        core.drawOrder = ['item'];

        const nonEventRoom = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north', useIdol: true }),
        );
        expect(nonEventRoom.valid).toBe(false);
        if (!nonEventRoom.valid) {
            expect(nonEventRoom.error).toContain('事件符号板块');
        }
    });

    it('洗衣滑槽在探索者结束回合时放置到地下室起始点', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'laundryChute')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('洗衣滑槽');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const movedExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(movedExplorer.roomId).toBe('basement-landing');
        expect(core.currentPlayer).toBe('1');
    });

    it('密道楼梯发现后会固定连通门厅', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'secretStaircase')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('密道楼梯');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('hallway');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-east');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        expect(core.currentExplorer.roomId).toBe('basement-east');
    });

    it('墓园和地下洞窟发现后会固定连通', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'graveyard')!,
        ];
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'undergroundCavern')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('墓园');
        core = acknowledgePendingCardResolutions(core);

        core = {
            ...core,
            activeRoomId: 'basement-landing',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'basement-landing',
            },
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('地下洞窟');
        core = acknowledgePendingCardResolutions(core);

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('ground-north');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        expect(core.currentExplorer.roomId).toBe('ground-north');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-east');
    });

    it('长廊发现后会固定连通舞厅', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'ballroom')!,
        ];
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'gallery')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('舞厅');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = {
            ...core,
            activeRoomId: 'upper-landing',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'upper-landing',
            },
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('长廊');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('ground-north');
    });

    it('储物间发现时获得 1 点力量', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'larder')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        const mightBefore = core.currentExplorer.traits.might;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });

        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('储物间');
        expect(core.currentExplorer.traits.might).toBe(mightBefore + 1);
    });

    it('体育馆发现时获得 1 点速度', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'gymnasium')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const speedBefore = core.currentExplorer.traits.speed;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });

        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('体育馆');
        expect(core.currentExplorer.traits.speed).toBe(speedBefore + 1);
    });

    it('杂物间发现时会在房间上放置障碍物标记', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'junkRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });

        const junkRoom = core.rooms.find((room) => room.id === 'basement-east');
        expect(junkRoom?.name).toBe('杂物间');
        expect(junkRoom?.markerTokens).toContain('obstacle');
    });

    it('当前所有房间文字直接效果都会先进入翻牌确认队列', () => {
        const cases = [
            {
                floor: 'ground' as const,
                visualId: 'chapel',
                targetRoomId: 'ground-north',
                expectedRoomName: '礼拜堂',
                expectedText: '房间效果：礼拜堂，神志 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                },
            },
            {
                floor: 'upper' as const,
                visualId: 'library',
                targetRoomId: 'upper-north',
                expectedRoomName: '图书馆',
                expectedText: '房间效果：图书馆，知识 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
                },
            },
            {
                floor: 'upper' as const,
                visualId: 'study',
                targetRoomId: 'upper-north',
                expectedRoomName: '书房',
                expectedText: '房间效果：书房，知识 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
                },
            },
            {
                floor: 'upper' as const,
                visualId: 'gymnasium',
                targetRoomId: 'upper-north',
                expectedRoomName: '体育馆',
                expectedText: '房间效果：体育馆，速度 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
                },
            },
            {
                floor: 'basement' as const,
                visualId: 'larder',
                targetRoomId: 'basement-east',
                expectedRoomName: '储物间',
                expectedText: '房间效果：储物间，力量 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
                },
            },
            {
                floor: 'basement' as const,
                visualId: 'junkRoom',
                targetRoomId: 'basement-east',
                expectedRoomName: '杂物间',
                expectedText: '房间效果：杂物间，放置障碍物标记',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
                },
            },
        ];

        for (const testCase of cases) {
            let core = createStartedFirstScenarioCore();
            core.drawOrder = ['item'];
            const roomTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor[testCase.floor]
                .find((room) => room.visualId === testCase.visualId)!;
            core.roomDiscoveryOrderByFloor[testCase.floor] = [roomTemplate];

            core = testCase.moveToFloor(core);
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: testCase.targetRoomId });

            expect(core.rooms.find((room) => room.id === testCase.targetRoomId)?.name).toBe(testCase.expectedRoomName);
            expect(core.latestDiscovery?.resolutionSteps?.[0]).toMatchObject({
                kind: 'room-effect',
                text: testCase.expectedText,
            });
            expect(core.pendingCardResolutionQueue[0]).toMatchObject({
                stepKind: 'room-effect',
                cardName: testCase.expectedText,
                text: testCase.expectedText,
                index: 1,
            });
            expect(core.pendingCardResolutionQueue[0]?.deckKind).toBeUndefined();
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
            )).toMatchObject({
                valid: false,
                error: '请先确认当前翻牌结算。',
            });

            core = acknowledgeAnyPendingCardResolutions(core);
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
            ).valid).toBe(true);
        }
    });

    it('离开带障碍物标记的房间需要 2 点移动', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'junkRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        core = acknowledgeAnyPendingCardResolutions(core);
        core.turnEndedByDiscovery = false;

        core.movesRemaining = 1;
        const blockedMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' }),
        );
        expect(blockedMove.valid).toBe(false);

        core.movesRemaining = 2;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.movesRemaining).toBe(0);
    });

    it('作祟后同房间敌对探索者会作为障碍物，离开需要 2 点移动', () => {
        let core = createStartedFirstScenarioCore();
        core = {
            ...core,
            phase: 'haunt',
            activeRoomId: 'hallway',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'hallway',
            },
            otherExplorers: core.otherExplorers.map((explorer) => (
                explorer.playerId === '1'
                    ? { ...explorer, roomId: 'hallway' }
                    : explorer
            )),
            scenarioRuntime: {
                ...core.scenarioRuntime,
                hauntTriggered: true,
                hauntCardNumber: 1,
                traitorPlayerId: '1',
            },
        };

        expect(resolveBetrayalMoveCost(core)).toBe(2);
        expect(resolveBetrayalMoveCost(core, '2')).toBe(1);
        core.movesRemaining = 1;
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(false);

        core.movesRemaining = 2;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' });
        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.movesRemaining).toBe(0);
    });

    it('自由混战作祟中其他探索者会作为敌对阻碍', () => {
        const baseCore = createStartedFirstScenarioCore();
        const core: BetrayalCore = {
            ...baseCore,
            phase: 'haunt' as const,
            activeRoomId: 'hallway',
            currentExplorer: {
                ...baseCore.currentExplorer,
                roomId: 'hallway',
            },
            otherExplorers: baseCore.otherExplorers.map((explorer) => (
                explorer.playerId === '1'
                    ? { ...explorer, roomId: 'hallway' }
                    : explorer
            )),
            scenarioRuntime: {
                ...baseCore.scenarioRuntime,
                hauntTriggered: true,
                hauntCardNumber: 12,
                traitorPlayerId: null,
                hauntTraitorResolution: {
                    hauntCardNumber: 12,
                    policy: 'free-for-all',
                    traitorPlayerId: null,
                    teamModel: 'free-for-all',
                    reasonLabel: '自由混战',
                    candidatePlayerIds: [],
                    excludedPlayerIds: [],
                    tieBreak: 'none',
                    representativeOnly: false,
                },
            },
        };

        expect(resolveBetrayalMoveCost(core)).toBe(2);
        expect(resolveBetrayalMoveCost(core, '2')).toBe(1);
    });

    it('作祟后同房间怪物会作为英雄障碍物，离开需要 2 点移动', () => {
        let core = createStartedFirstScenarioCore();
        core = {
            ...core,
            phase: 'haunt',
            activeRoomId: 'hallway',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'hallway',
            },
            scenarioRuntime: {
                ...core.scenarioRuntime,
                hauntTriggered: true,
                hauntCardNumber: 12,
                traitorPlayerId: '1',
            },
            monsters: [{
                id: 'test-monster',
                name: '测试怪物',
                portraitAsset: 'betrayal/cards/back-monster',
                roomId: 'hallway',
                might: 3,
                speed: 3,
                damage: 1,
            }],
        };

        expect(resolveBetrayalMoveCost(core)).toBe(2);
        core.movesRemaining = 1;
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(false);

        core.movesRemaining = 2;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' });
        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.movesRemaining).toBe(0);
    });

    it('无叛徒作祟中怪物仍会作为英雄障碍物', () => {
        const baseCore = createStartedFirstScenarioCore();
        const core: BetrayalCore = {
            ...baseCore,
            phase: 'haunt',
            activeRoomId: 'hallway',
            currentExplorer: {
                ...baseCore.currentExplorer,
                roomId: 'hallway',
            },
            scenarioRuntime: {
                ...baseCore.scenarioRuntime,
                hauntTriggered: true,
                hauntCardNumber: 4,
                traitorPlayerId: null,
                hauntTraitorResolution: {
                    hauntCardNumber: 4,
                    policy: 'no-traitor',
                    traitorPlayerId: null,
                    teamModel: 'no-traitor',
                    reasonLabel: '无叛徒',
                    candidatePlayerIds: [],
                    excludedPlayerIds: [],
                    tieBreak: 'none',
                    representativeOnly: true,
                },
            },
            monsters: [{
                id: 'test-monster',
                name: '测试怪物',
                portraitAsset: 'betrayal/cards/back-monster',
                roomId: 'hallway',
                might: 3,
                speed: 3,
                damage: 1,
            }],
        };

        expect(resolveBetrayalMoveCost(core)).toBe(2);
    });

    it('图书馆发现时获得 1 点知识', () => {
        let core = createStartedFirstScenarioCore();
        const libraryTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'library')!;
        core.roomDiscoveryOrderByFloor.upper = [
            libraryTemplate,
            libraryTemplate,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const knowledgeBefore = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('图书馆');
        expect(core.currentExplorer.traits.knowledge).toBe(knowledgeBefore + 1);
    });

    it('书房发现时获得 1 点知识', () => {
        let core = createStartedFirstScenarioCore();
        const studyTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'study')!;
        core.roomDiscoveryOrderByFloor.upper = [
            studyTemplate,
            studyTemplate,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const knowledgeBefore = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('书房');
        expect(core.currentExplorer.traits.knowledge).toBe(knowledgeBefore + 1);
    });

    it('房间文字提升属性后，后续事件属性检定应使用提升后的骰数', () => {
        let core = createStartedFirstScenarioCore();
        const studyTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'study')!;
        core.drawOrder = ['event'];
        core.eventOrder = [
            BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!,
        ];
        core.roomDiscoveryOrderByFloor.upper = [
            studyTemplate,
            studyTemplate,
        ];
        setTestExplorerTraits(core, '0', { might: 3, speed: 3, knowledge: 3, sanity: 3 });
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3, 4, 5, 6], 2, 2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const knowledgePositionBefore = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'upper-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('书房');
        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.rollLabel).toBe('知识检定');
        expect(core.recentRoll?.dice).toEqual([1, 1, 1, 1]);
        expect(core.recentRoll?.latestLabel).toBe('获得 1 点知识');
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBefore + 2);
    });

    it('器械库发现时展示物品牌直到武器，拿取武器并埋葬其余展示牌', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!,
        ];
        core.possessionOrderByKind.item = [
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'medical-kit')!,
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'hunting-knife')!,
        ];
        core.deckCounts.item = core.possessionOrderByKind.item.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('器械库');
        expect(core.currentExplorer.inventory.map((card) => card.name)).toContain('砍刀');
        expect(core.currentExplorer.inventory.some((card) => card.id.startsWith('hunting-knife-armory-'))).toBe(true);
        expect(core.discardCounts.item).toBe(0);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);
        expect(core.possessionOrderByKind.item.map((card) => card.name)).toEqual(['急救包']);
    });

    it('器械库房间文字抽到武器后，仍会再按物品符号抽下一张物品牌', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['item'];
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!,
        ];
        core.possessionOrderByKind.item = [
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'medical-kit')!,
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'hunting-knife')!,
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'flashlight')!,
        ];
        core.deckCounts.item = core.possessionOrderByKind.item.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('器械库');
        expect(core.currentExplorer.inventory.map((card) => card.name)).toEqual(expect.arrayContaining(['砍刀', '手电筒']));
        expect(core.currentExplorer.inventory.some((card) => card.id.startsWith('hunting-knife-armory-'))).toBe(true);
        expect(core.currentExplorer.inventory.some((card) => card.id === 'flashlight-0')).toBe(true);
        expect(core.latestDiscovery?.kind).toBe('item');
        expect(core.latestDiscovery?.title).toBe('手电筒');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => step.text)).toEqual([
            '器械库获得砍刀',
            '展示后埋葬急救包',
            '已加入持有区：手电筒（按卡面规则持有）',
        ]);
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => step.kind)).toEqual([
            'room-discovery-card',
            'buried-room-discovery-card',
            'drawn-card',
        ]);
        expect(core.pendingCardResolutionQueue.map((resolution) => ({
            stepKind: resolution.stepKind,
            text: resolution.text,
            index: resolution.index,
            total: resolution.total,
        }))).toEqual([
            { stepKind: 'room-discovery-card', text: '器械库获得砍刀', index: 1, total: 3 },
            { stepKind: 'buried-room-discovery-card', text: '展示后埋葬急救包', index: 2, total: 3 },
            { stepKind: 'drawn-card', text: '已加入持有区：手电筒（按卡面规则持有）', index: 3, total: 3 },
        ]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue.map((resolution) => resolution.index)).toEqual([2, 3]);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue.map((resolution) => resolution.index)).toEqual([3]);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        ).valid).toBe(true);
        expect(core.discardCounts.item).toBe(0);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 2);
        expect(core.possessionOrderByKind.item.map((card) => card.name)).toEqual(['急救包']);
    });

    it('倒塌房间结束回合速度检定失败时坠落并承受物理伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        const traitsBeforeFall = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 2),
        );

        const fallenExplorer = core.currentExplorer;
        expect(fallenExplorer.roomId).toBe('basement-landing');
        expect(fallenExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn?.nextPlayerId).toBe('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' }),
        ).valid).toBe(false);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {}),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {});
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            playerId: '0',
            allowedTraits: ['might', 'speed'],
            nextPlayerId: '1',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('basement-landing');
        expect(physicalTraitTotal(core, '0')).toBeLessThan(traitsBeforeFall.might + traitsBeforeFall.speed);
    });

    it('兔脚可以重掷倒塌房间结束回合速度检定，并按新结果回算坠落', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
            },
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'rope', name: '兔脚', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'rope'];
        const traitsBeforeFall = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2, 2),
        );

        const fallenExplorer = core.currentExplorer;
        expect(fallenExplorer.roomId).toBe('basement-landing');
        expect(fallenExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.playerId).toBe('0');
        expect(core.recentRoll?.roomEndTurn?.nextPlayerId).toBe('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        const safeExplorer = core.currentExplorer;
        expect(safeExplorer.roomId).toBe('upper-north');
        expect(safeExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.recentRoll?.latestLabel).toContain('没有坠落');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        ).valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('upper-north');
    });

    it('倒塌房间结束回合速度检定成功时不会坠落或受伤', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');
        core = acknowledgeAnyPendingCardResolutions(core);

        const explorerBefore = { ...core.currentExplorer };
        const mightBefore = core.currentExplorer.traits.might;
        const speedBefore = core.currentExplorer.traits.speed;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        const safeExplorer = core.currentExplorer;
        expect(safeExplorer.roomId).toBe(explorerBefore.roomId);
        expect(safeExplorer.traits.might).toBe(mightBefore);
        expect(safeExplorer.traits.speed).toBe(speedBefore);
        expect(core.activityLog[0]?.text).toContain('没有坠落');
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll?.roomEndTurn?.nextPlayerId).toBe('1');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
    });

    it('狗和面具会让倒塌房间速度检定结果 +1', () => {
        const speedBonusOmens = [
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'mask', name: '面具', kind: 'omen' as const },
        ];

        for (const omen of speedBonusOmens) {
            let core = createStartedFirstScenarioCore();
            core.roomDiscoveryOrderByFloor.upper = [
                BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
            ];
            core.currentExplorer = {
                ...core.currentExplorer,
                traits: {
                    ...core.currentExplorer.traits,
                    speed: 4,
                },
                inventory: [omen],
            };
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.currentExplorerInventory = [...core.currentExplorer.inventory];

            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
            core = acknowledgeAnyPendingCardResolutions(core);

            const mightBefore = core.currentExplorer.traits.might;
            const speedBefore = core.currentExplorer.traits.speed;

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.END_TURN,
                '0',
                {},
                100,
                createBetrayalScriptedRandom(2, 2, 2, 2),
            );

            const explorerAfter = core.currentExplorer;
            expect(explorerAfter.roomId).toBe('upper-north');
            expect(explorerAfter.traits.might).toBe(mightBefore);
            expect(explorerAfter.traits.speed).toBe(speedBefore);
            expect(core.currentPlayer).toBe('0');
            expect(core.recentRoll?.roomEndTurn?.nextPlayerId).toBe('1');
        }
    });

    it('普通交易必须先请求，接收方同意后才转移持有物', () => {
        let core = createTradeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'rope',
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: ['rope'],
        });
        expect(core.activePlayerId).toBe('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([]);
        expect(core.activityLog[0]?.text).toContain('同意');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['rope']);
        expect(core.tradeUsedThisTurnPlayerIds).toContain('0');
        expect(core.activityLog[0]?.text).toContain('同意交易');

        const secondTradeSameTurn = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '1',
                cardId: 'omen-book',
            }),
        );

        expect(secondTradeSameTurn.valid).toBe(false);
        if (!secondTradeSameTurn.valid) {
            expect(secondTradeSameTurn.error).toContain('本回合已经完成过交易');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.tradeUsedThisTurnPlayerIds).toEqual([]);
        expect(core.currentPlayer).toBe('1');

        const nextPlayerTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
                targetPlayerId: '0',
                cardId: 'rope',
            }),
        );
        expect(nextPlayerTrade.valid).toBe(true);
    });

    it('移动不会消耗本回合普通交易额度', () => {
        let core = createTradeReadyCore();
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'grand-staircase',
                }
                : explorer
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', {
            roomId: 'grand-staircase',
        });

        expect(core.currentExplorer.roomId).toBe('grand-staircase');
        expect(core.tradeUsedThisTurnPlayerIds).toEqual([]);

        const tradeAfterMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '1',
                cardId: 'rope',
            }),
        );

        expect(tradeAfterMove.valid).toBe(true);
    });

    it('普通交易被接收方拒绝后不会转移持有物', () => {
        let core = createTradeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'rope',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: false,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([]);
        expect(core.activityLog[0]?.text).toContain('拒绝');
    });

    it('同房间交易支持双方交换持有物，且拒绝时双方都不转移', () => {
        let core = createExchangeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'rope',
            targetCardIds: ['map'],
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: ['rope'],
            targetCardIds: ['map'],
        });
        expect(core.activePlayerId).toBe('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: false,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);
        expect(core.activityLog[0]?.text).toContain('拒绝');
    });

    it('同房间交易在接收方同意后会双向交换持有物', () => {
        let core = createExchangeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'rope',
            targetCardIds: ['map'],
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['omen-book', 'map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope']);
        expect(core.receivedCardIdsThisTurnByPlayerId['0']).toContain('map');
        expect(core.receivedCardIdsThisTurnByPlayerId['1']).toContain('rope');
        expect(core.activityLog[0]?.text).toContain('给出兔脚');
        expect(core.activityLog[0]?.text).toContain('给出地图');
        expect(core.activityLog[0]?.text).not.toContain('换回');
    });

    it('同房间交易允许发起方一次给出任意多张持有物，接收方同意后才结算', () => {
        let core = createExchangeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardIds: ['rope', 'omen-book'],
            targetCardIds: ['map'],
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: ['rope', 'omen-book'],
            targetCardIds: ['map'],
        });
        expect(core.activePlayerId).toBe('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'omen-book']);
        expect(core.receivedCardIdsThisTurnByPlayerId['0']).toContain('map');
        expect(core.receivedCardIdsThisTurnByPlayerId['1']).toEqual(expect.arrayContaining(['rope', 'omen-book']));
        expect(core.activityLog[0]?.text).toContain('给出兔脚、书本');
        expect(core.activityLog[0]?.text).toContain('给出地图');
    });

    it('同房间交易允许只拿对方持有物，接收方同意后才结算', () => {
        let core = createExchangeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            targetCardIds: ['map'],
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: [],
            targetCardIds: ['map'],
        });
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['rope', 'omen-book', 'map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull']);
        expect(core.receivedCardIdsThisTurnByPlayerId['0']).toContain('map');
        expect(core.activityLog[0]?.text).toContain('给出地图');
        expect(core.activityLog[0]?.text).not.toContain('索要');
    });

    it('同房间交易不允许双方都不选择持有物', () => {
        const core = createExchangeReadyCore();

        const emptyTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '1',
                cardIds: [],
                targetCardIds: [],
            }),
        );

        expect(emptyTrade.valid).toBe(false);
        if (!emptyTrade.valid) {
            expect(emptyTrade.error).toContain('缺少交易对象或持有物');
        }
    });

    it('狗每回合一次，可请求与 4 格内玩家交易任意数量物品或预兆，同意后才结算', () => {
        let core = createDogTradeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            useDog: true,
            targetPlayerId: '1',
            cardIds: ['medical-kit', 'map'],
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: ['medical-kit', 'map'],
            useDog: true,
            sourceCardId: 'dog',
        });
        expect(core.activePlayerId).toBe('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['dog', 'medical-kit', 'map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([]);
        expect(core.usedCardIdsThisTurn).not.toContain('dog');
        expect(core.activityLog[0]?.text).toContain('同意');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['dog']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['medical-kit', 'map']);
        expect(core.usedCardIdsThisTurn).toContain('dog');
        expect(core.activityLog[0]?.text).toContain('同意交易');
        expect(core.activityLog[0]?.text).toContain('使用狗');

        const secondDogTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                useDog: true,
                targetPlayerId: '1',
                cardIds: ['dog'],
            }),
        );
        expect(secondDogTrade.valid).toBe(false);
    });

    it('交易卡状态区分可交易、已用、狗来源和不存在持有物', () => {
        const core = createDogTradeReadyCore();
        core.usedCardIdsThisTurn = ['medical-kit'];

        expect(resolveBetrayalTradeCardStatus(core, 'map')).toMatchObject({
            sourceKind: 'trade',
            ownerRole: 'requester',
            exists: true,
            canTrade: true,
            reason: null,
        });
        expect(resolveBetrayalTradeCardStatus(core, 'medical-kit')).toMatchObject({
            exists: true,
            canTrade: false,
            usedThisTurn: true,
            reason: '本回合已经使用过的持有物不能交易。',
        });
        expect(resolveBetrayalTradeCardStatus(core, 'dog', { useDogTrade: true })).toMatchObject({
            exists: true,
            canTrade: false,
            reservedAsTradeSource: true,
            reason: '本回合已经使用过的持有物不能交易。',
        });
        expect(resolveBetrayalTradeCardStatus(core, 'missing-card')).toMatchObject({
            exists: false,
            canTrade: false,
            reason: '当前探索者没有这件持有物。',
        });
    });

    it('狗交易沿用正常交易限制：已用牌不能交易，收到的牌本回合不能立刻使用', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [
                { id: 'dog', name: '狗', kind: 'omen' },
                { id: 'medical-kit', name: '急救包', kind: 'item' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'upper-landing', inventory: [] }
                : explorer
        ));
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['dog', 'medical-kit'];
        core.usedCardIdsThisTurn = ['medical-kit'];

        const tradeUsedCard = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                useDog: true,
                targetPlayerId: '1',
                cardIds: ['medical-kit'],
            }),
        );
        expect(tradeUsedCard.valid).toBe(false);
        if (!tradeUsedCard.valid) {
            expect(tradeUsedCard.error).toContain('本回合已经使用过的持有物不能交易');
        }

        core.usedCardIdsThisTurn = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            useDog: true,
            targetPlayerId: '1',
            cardIds: ['medical-kit'],
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const receiverUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'medical-kit' }),
        );
        expect(receiverUse.valid).toBe(false);
        if (!receiverUse.valid) {
            expect(receiverUse.error).toContain('本回合新获得的持有物不能立刻使用');
        }
    });

    it('面具每回合一次，会把同板块其他探险者和怪物移动到已发现相邻板块，且不能发现新板块', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [
                { id: 'mask', name: '面具', kind: 'omen' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'entrance-hall' }
                : explorer.playerId === '2'
                    ? { ...explorer, roomId: 'upper-landing' }
                    : explorer
        ));
        core.monsters = [{
            id: 'jack-spirit',
            name: '杰克之灵',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId: 'entrance-hall',
            might: 5,
            speed: 3,
            damage: 1,
        }];
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['mask'];

        const undiscoveredTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId: 'mask',
                targetRoomId: 'upper-north',
            }),
        );
        expect(undiscoveredTarget.valid).toBe(false);
        if (!undiscoveredTarget.valid) {
            expect(undiscoveredTarget.error).toContain('已发现的相邻板块');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
            cardId: 'mask',
            targetRoomId: 'hallway',
        });

        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '1')?.roomId).toBe('hallway');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '2')?.roomId).toBe('upper-landing');
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('hallway');
        expect(core.currentExplorer.inventory.map((card) => card.id)).toEqual(['mask']);
        expect(core.usedCardIdsThisTurn).toContain('mask');
        expect(core.activityLog[0]?.text).toContain('使用面具');

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId: 'mask',
                targetRoomId: 'hallway',
            }),
        );
        expect(secondUse.valid).toBe(false);
    });

    it('面具可以把同板块不同目标分别移动到不同已发现相邻板块', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [
                { id: 'mask', name: '面具', kind: 'omen' },
            ],
        };
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'hallway' }
                : explorer.playerId === '2'
                    ? { ...explorer, roomId: 'hallway' }
                    : explorer
        ));
        core.monsters = [{
            id: 'jack-spirit',
            name: '杰克之灵',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId: 'hallway',
            might: 5,
            speed: 3,
            damage: 1,
        }];
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['mask'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
            cardId: 'mask',
            targetRoomIdsByTokenId: {
                '1': 'entrance-hall',
                '2': 'grand-staircase',
                'jack-spirit': 'entrance-hall',
            },
        });

        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '1')?.roomId).toBe('entrance-hall');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '2')?.roomId).toBe('grand-staircase');
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('entrance-hall');
        expect(core.usedCardIdsThisTurn).toContain('mask');
        expect(core.activityLog[0]?.text).toContain('使用面具');
    });

    it('神秘电梯进入后可按骰点移动到对应楼层开放门口且每回合只能用一次', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'mysticElevator')!,
        ];

        expect(resolveBetrayalRoomSpecialActionStatus(core)).toMatchObject({
            sourceKind: 'roomEffect',
            active: false,
            canUse: false,
            reason: '当前房间没有可使用的房间效果。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(resolveBetrayalRoomSpecialActionStatus(core)).toMatchObject({
            sourceKind: 'roomEffect',
            sourceId: 'mysticElevator',
            sourceName: '神秘电梯',
            active: true,
            canUse: false,
            usedThisTurn: false,
            turnEndedByDiscovery: true,
            reason: '探索新房间后本回合已结束。',
        });
        core.turnEndedByDiscovery = false;
        core.movesRemaining = 2;
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('神秘电梯');
        core = acknowledgeAnyPendingCardResolutions(core);
        expect(resolveBetrayalRoomSpecialActionStatus(core)).toMatchObject({
            sourceId: 'mysticElevator',
            canUse: true,
            reason: null,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        const elevator = core.rooms.find((room) => room.id === 'upper-north');
        expect(elevator?.floor).toBe('upper');
        expect(elevator?.connectedRoomIds.length).toBeGreaterThan(0);
        expect(core.currentExplorer.roomId).toBe('upper-north');
        expect(core.scenarioRuntime.usedRoomEffectIdsThisTurn).toContain('mysticElevator');
        expect(core.activityLog[0]?.text).toContain('神秘电梯');

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_ROOM_EFFECT, '0', {}),
        );
        expect(secondUse).toMatchObject({
            valid: false,
            error: '该房间效果本回合已经使用。',
        });
        expect(resolveBetrayalRoomSpecialActionStatus(core)).toMatchObject({
            sourceId: 'mysticElevator',
            canUse: false,
            usedThisTurn: true,
            reason: '该房间效果本回合已经使用。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.scenarioRuntime.usedRoomEffectIdsThisTurn).toEqual([]);
    });

    it('兔脚可以重掷神秘电梯刚投过的一颗骰子并重算楼层', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'mysticElevator')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...core.currentExplorer.inventory,
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        core.turnEndedByDiscovery = false;
        core.movesRemaining = 2;
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('神秘电梯');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.recentRoll?.kind).toBe('mysticElevator');
        expect(core.recentRoll?.dice).toEqual([2, 2]);
        expect(core.rooms.find((room) => room.id === 'upper-north')?.floor).toBe('upper');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.dice).toEqual([0, 2]);
        expect(core.rooms.find((room) => room.id === 'upper-north')?.floor).toBe('ground');
        expect(core.currentExplorer.roomId).toBe('upper-north');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('能在第三次恶兆且 haunt roll 达标后进入真实 haunt', () => {
        const core = createFirstScenarioHauntCore();

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('2');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('2');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(1);
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('书本');
        expect(core.scenarioRuntime.triggeringOmenName).toBe('书本');
        expect(core.scenarioRuntime.hauntScenarioCardTitle).toBe('赤红杰克归来');
        expect(core.scenarioRuntime.hauntResolutionMatchedTrigger).toBe(false);
        expect(core.scenarioRuntime.hauntResolutionRepresentativeOnly).toBe(true);
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-traitor',
            anchorPlayerId: '2',
            nextPlayerId: '0',
            representativeOnly: true,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentPlayer).toBe('0');
        expect(core.activityLog[0]?.text).toContain('Crimson Jack Returns');
    });

    it('本回合新获得的物品或预兆不能立刻使用，直到下一次回合开始才可用', () => {
        const fixedItemDrawRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], fixedItemDrawRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', {});
        core.drawOrder = ['item'];
        core.possessionOrderByKind.item = [
            { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, createBetrayalScriptedRandom(1));

        const newCardId = core.currentExplorer.inventory.at(-1)?.id;
        expect(newCardId).toBeTruthy();
        expect(core.latestDiscovery?.summary).toBe('已加入持有区');
        expect(core.turnStartInventoryCardIds).not.toContain(newCardId);

        const pendingCardUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: newCardId }),
        );
        expect(pendingCardUseValidation.valid).toBe(false);
        if (!pendingCardUseValidation.valid) {
            expect(pendingCardUseValidation.error).toContain('请先确认当前翻牌结算');
        }

        core = acknowledgePendingCardResolutions(core);

        const immediateUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: newCardId }),
        );
        expect(immediateUseValidation.valid).toBe(false);
        if (!immediateUseValidation.valid) {
            expect(immediateUseValidation.error).toContain('回合已经结束');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        expect(core.currentPlayer).toBe('0');
        expect(core.turnStartInventoryCardIds).toContain(newCardId);
        const nextTurnUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: newCardId }),
        );
        expect(nextTurnUseValidation.valid).toBe(true);
    });

    it('持有物效果解析会统一处理主动使用牌的抽牌后缀和预览后缀', () => {
        expect(resolveUseEffect({ id: 'holy-water', name: '奇怪的药品', kind: 'item' })).toMatchObject({
            mode: 'healTraits',
            traits: ['might', 'speed'],
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'holy-water-preview-3', name: '奇怪的药品', kind: 'item' })).toMatchObject({
            mode: 'healTraits',
            traits: ['might', 'speed'],
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'holy-water-12', name: '奇怪的药品', kind: 'item' })).toMatchObject({
            mode: 'healTraits',
            traits: ['might', 'speed'],
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'medical-kit', name: '急救包', kind: 'item' })).toMatchObject({
            mode: 'healTraits',
            traits: ['might', 'speed', 'knowledge', 'sanity'],
            consumeOnUse: true,
            target: 'selfOrSameRoomExplorer',
        });
        expect(resolveUseEffect({ id: 'map', name: '地图', kind: 'item' })).toMatchObject({
            mode: 'placeExplorer',
            target: 'anyDiscoveredRoom',
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'notebook', name: '笔记本', kind: 'item' })).toMatchObject({
            mode: 'placeExplorer',
            target: 'anyDiscoveredRoom',
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'journal', name: '日记', kind: 'item' })).toMatchObject({
            mode: 'placeExplorer',
            target: 'anyDiscoveredRoom',
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'manuscript', name: '手稿', kind: 'item' })).toMatchObject({
            mode: 'placeExplorer',
            target: 'anyDiscoveredRoom',
            consumeOnUse: true,
        });
    });

    it('兔脚不能被主动使用成移动加成，真实重掷必须等待骰子明细窗口', () => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        expect(resolveUseEffect({ id: 'rope', name: '兔脚', kind: 'item' })).toBeNull();

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'rope' }),
        );

        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('该持有物没有主动使用效果');
        }
    });

    it('狗、圣符和雕像不能被通用使用入口误当成主动加成', () => {
        const activeCore = createStartedFirstScenarioCore();

        for (const card of [
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'holy-symbol', name: '圣符', kind: 'omen' as const },
            { id: 'idol', name: '雕像', kind: 'omen' as const },
        ]) {
            const core = {
                ...activeCore,
                currentExplorer: { ...activeCore.currentExplorer, inventory: [card] },
                currentExplorerInventory: [card],
                turnStartInventoryCardIds: [card.id],
            };

            expect(resolveUseEffect(card)).toBeNull();

            const validation = BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: card.id }),
            );

            expect(validation.valid).toBe(false);
            if (!validation.valid) {
                expect(validation.error).toContain('该持有物没有主动使用效果');
            }
        }
    });

    it('持有物特殊行动预算区分主动、被动、已用和本回合新获得', () => {
        const holyWater = { id: 'holy-water', name: '奇怪的药品', kind: 'item' as const };
        const armor = { id: 'armor', name: '盔甲', kind: 'omen' as const };
        const activeCore = createStartedFirstScenarioCore();
        let core: BetrayalCore = {
            ...activeCore,
            currentExplorer: {
                ...activeCore.currentExplorer,
                inventory: [holyWater, armor],
            },
            currentExplorerInventory: [holyWater, armor],
            turnStartInventoryCardIds: ['holy-water', 'armor'],
            usedCardIdsThisTurn: [],
            receivedCardIdsThisTurnByPlayerId: {},
        };

        expect(resolveBetrayalPossessionSpecialActionStatus(core, 'holy-water')).toMatchObject({
            active: true,
            canUse: true,
            usedThisTurn: false,
            availableAtTurnStart: true,
            receivedThisTurn: false,
            reason: null,
        });
        expect(resolveBetrayalPossessionSpecialActionStatus(core, 'armor')).toMatchObject({
            active: false,
            canUse: false,
            reason: '该持有物没有主动使用效果。',
        });

        core = { ...core, usedCardIdsThisTurn: ['holy-water'] };
        expect(resolveBetrayalPossessionSpecialActionStatus(core, 'holy-water')).toMatchObject({
            active: true,
            canUse: false,
            usedThisTurn: true,
            reason: '该持有物本回合已经使用。',
        });

        core = {
            ...core,
            usedCardIdsThisTurn: [],
            turnStartInventoryCardIds: ['armor'],
            receivedCardIdsThisTurnByPlayerId: { '0': ['holy-water'] },
        };
        expect(resolveBetrayalPossessionSpecialActionStatus(core, 'holy-water')).toMatchObject({
            active: true,
            canUse: false,
            availableAtTurnStart: false,
            receivedThisTurn: true,
            reason: '本回合新获得的持有物不能立刻使用。',
        });
    });

    it('作祟特殊行动预算由统一读模型解释可用、已用和阶段原因', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');

        expect(resolveBetrayalHauntSpecialActionStatus(core, 'search-for-cure')).toMatchObject({
            sourceKind: 'hauntAction',
            sourceId: 'search-for-cure',
            sourceName: '寻找解药',
            active: true,
            canUse: true,
            usedThisTurn: false,
            phaseEligible: true,
            reason: null,
        });

        core = { ...core, usedCardIdsThisTurn: ['search-for-cure'] };
        expect(resolveBetrayalHauntSpecialActionStatus(core, 'search-for-cure')).toMatchObject({
            active: true,
            canUse: false,
            usedThisTurn: true,
            reason: '该作祟特殊行动本回合已经使用。',
        });

        const preHauntCore = createStartedFirstScenarioCore();
        expect(resolveBetrayalHauntSpecialActionStatus(preHauntCore, 'search-for-cure')).toMatchObject({
            active: false,
            canUse: false,
            phaseEligible: false,
            reason: '作祟前不能使用作祟特殊行动。',
        });

        expect(resolveBetrayalHauntSpecialActionStatus(core, 'unknown-haunt-action')).toMatchObject({
            active: false,
            canUse: false,
            reason: '未知作祟特殊行动。',
        });
    });

    it('未确认的历史占位持有物不能从通用使用入口获得效果', () => {
        for (const card of [
            { id: 'holy-medallion', name: '历史占位护符', kind: 'item' as const },
            { id: 'dark-omen', name: '历史占位预兆', kind: 'omen' as const },
            { id: 'cross', name: '历史占位十字架', kind: 'item' as const },
            { id: 'matches', name: '历史占位火柴', kind: 'item' as const },
        ]) {
            expect(resolveUseEffect(card)).toBeNull();
        }
    });

    it('兔脚会重掷刚刚事件检定的一颗骰子，并回写原事件分支结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '墙中低语',
                roll: {
                    trait: 'knowledge',
                    branches: [
                        { min: 5, label: '抵住低语，获得 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被低语扰乱，失去 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 3,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3, 4, 5], 2, 2);
        const knowledgePositionBeforeWhisper = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 0');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点知识');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeWhisper - 1);
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.recentRoll?.dice).toEqual([0, 0, 0]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 2');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点知识');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeWhisper - 1);
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.recentRoll?.dice).toEqual([2, 0, 0]);
        expect(core.usedCardIdsThisTurn).toContain('rope');

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        );
        expect(secondUse.valid).toBe(false);
    });

    it('兔脚重掷后若跨过事件检定阈值，会撤销旧分支并应用新分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '墙中低语',
                roll: {
                    trait: 'knowledge',
                    branches: [
                        { min: 5, label: '抵住低语，获得 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被低语扰乱，失去 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 3,
            },
            inventory: [
                { id: 'rope', name: '兔脚', kind: 'item' },
                { id: 'flashlight', name: '手电筒', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope', 'flashlight'];
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3, 4, 5], 2, 2);
        const knowledgePositionBeforeCrossThreshold = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 0');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeCrossThreshold - 1);
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.recentRoll?.dice).toEqual([0, 0, 0, 0, 0]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 2');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeCrossThreshold - 1);
        expect(core.currentExplorer.traits.knowledge).toBe(2);

        core.recentRoll = {
            ...core.recentRoll!,
            consumedRabbitFootCardIds: [],
            dice: [2, 2, 2, 0, 0],
            latestLabel: '被低语扰乱，失去 1 点知识',
        };
        core.currentExplorer.traits.knowledge = 2;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3, 4, 5], 1, 2);
        core.usedCardIdsThisTurn = [];
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 3 },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 8');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeCrossThreshold + 1);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
    });

    it('兔脚可以重掷刚刚事件固定投骰，并回写原事件分支结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一种怪异的感觉')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
                sanity: 4,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 0');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点力量');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([0, 0]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(6),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 2');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点神志');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.recentRoll?.dice).toEqual([2, 0]);
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('兔脚可以重掷标本剥制力量检定，并撤销失败分支的伤害和障碍物', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                sanity: 4,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 0');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('obstacle');

        core.recentRoll = {
            ...core.recentRoll!,
            consumedRabbitFootCardIds: [],
            dice: [2, 2, 2, 0],
            latestLabel: '受到 1 点物理伤害；放置障碍物',
        };
        core.usedCardIdsThisTurn = [];
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 3 },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 8');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点神志');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).not.toContain('obstacle');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('兔脚重掷电话铃声时会撤销旧骰数伤害并应用新分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        setTestTraitTrack(core, '0', 'knowledge', [2, 3, 4, 5, 6], 2, 2);
        const knowledgePositionBeforePhoneReroll = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的精神伤害');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforePhoneReroll - 2);
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.currentExplorer.traits.sanity).toBe(4);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(6),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 3');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识');
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforePhoneReroll + 1);
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('兔脚重掷小机器人时会撤销旧抽牌并应用新分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        setTestTraitTrack(core, '0', 'might', [2, 3, 4, 5, 6], 2, 2);
        const mightPositionBeforeRobotReroll = traitTrackPosition(core, '0', 'might');
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 5');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory).toHaveLength(2);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(1, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 3');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        expect(core.currentExplorer.inventory).toEqual([{ id: 'rope', name: '兔脚', kind: 'item' }]);
        expect(core.currentExplorerInventory).toEqual([{ id: 'rope', name: '兔脚', kind: 'item' }]);
        expect(core.deckCounts.item).toBe(itemDeckBefore);
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforeRobotReroll - 2);
        expect(core.currentExplorer.traits.might).toBe(2);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('手电筒只在事件属性检定多投 2 颗骰，不能被主动使用成通用加成', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '墙中低语',
                roll: {
                    trait: 'knowledge',
                    branches: [
                        { min: 5, label: '抵住低语，获得 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被低语扰乱，失去 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 3,
            },
            inventory: [{ id: 'flashlight', name: '手电筒', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['flashlight'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'flashlight' }),
        );
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('没有主动使用效果');
        }

        const knowledgeBefore = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' }, 100, createBetrayalScriptedRandom(3, 3, 3, 1, 1));

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.detail).toContain('知识检定 6');
        expect(core.currentExplorer.traits.knowledge).toBe(knowledgeBefore + 1);
    });

    it('盔甲是被动物理减伤防具，不能被主动使用成通用移动效果', () => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'armor', name: '盔甲', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['armor'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'armor' }),
        );

        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('没有主动使用效果');
        }
    });

    it('头戴耳机会把承受的精神伤害降低 1 点', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [{ id: 'radio', name: '头戴耳机', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.activeRoomId = core.currentExplorer.roomId;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
        const sanityBeforeStudy = core.currentExplorer.traits.sanity;
        const knowledgeBeforeStudy = core.currentExplorer.traits.knowledge;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.STUDY_EXORCISM,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.scenarioRuntime.exorcismCircleRoomIds).toEqual([]);
        expect(core.currentExplorer.traits.sanity + core.currentExplorer.traits.knowledge).toBe(
            sanityBeforeStudy + knowledgeBeforeStudy - 1,
        );
    });

    it('头戴耳机不会阻挡对知识属性的直接降低，也不能被主动使用成通用移动效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '墙中低语',
                text: '墙里的声音扰乱了你的判断。失去 1 点知识。',
                effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'radio', name: '头戴耳机', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['radio'];
        const knowledgeBefore = core.currentExplorer.traits.knowledge;

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'radio' }),
        );
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('没有主动使用效果');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.currentExplorer.traits.knowledge).toBe(knowledgeBefore - 1);
    });

    it('魔法相机会让知识检定改用更高的神志属性，且不能被主动使用成通用属性加成', () => {
        let learnCore = createFirstScenarioReadyToLearnAboutJackCore();
        learnCore.currentExplorer = {
            ...learnCore.currentExplorer,
            traits: {
                ...learnCore.currentExplorer.traits,
                knowledge: 1,
                sanity: 4,
            },
            inventory: [{ id: 'camera', name: '魔法相机', kind: 'item' }],
        };
        learnCore.currentExplorerTraits = { ...learnCore.currentExplorer.traits };
        learnCore.currentExplorerInventory = [...learnCore.currentExplorer.inventory];
        learnCore.turnStartInventoryCardIds = ['camera'];

        const validation = BetrayalDomain.validate(
            { core: learnCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'camera' }),
        );
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('没有主动使用效果');
        }

        learnCore = applyBetrayalCommand(
            learnCore,
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 2, 1),
        );
        expect(learnCore.scenarioRuntime.knowledgeOfJackPlayerIds).toContain('0');

        learnCore.currentExplorer = {
            ...learnCore.currentExplorer,
            roomId: 'upper-west',
        };
        learnCore.activeRoomId = 'upper-west';
        learnCore.currentExplorerRoomId = 'upper-west';
        learnCore.usedCardIdsThisTurn = [];
        learnCore = applyBetrayalCommand(
            learnCore,
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
            '0',
            {},
            101,
            createBetrayalScriptedRandom(3, 3, 2, 1),
        );
        expect(learnCore.scenarioRuntime.knowledgeOfJackPlayerIds).toContain('1');

        let studyCore = createFirstScenarioReadyToStudyExorcismCore();
        studyCore.currentExplorer = {
            ...studyCore.currentExplorer,
            traits: {
                ...studyCore.currentExplorer.traits,
                knowledge: 1,
                sanity: 4,
            },
            inventory: [{ id: 'camera', name: '魔法相机', kind: 'item' }],
        };
        studyCore.currentExplorerTraits = { ...studyCore.currentExplorer.traits };
        studyCore.currentExplorerInventory = [...studyCore.currentExplorer.inventory];
        const circleCountBefore = studyCore.scenarioRuntime.exorcismCircleRoomIds.length;

        studyCore = applyBetrayalCommand(
            studyCore,
            BETRAYAL_COMMANDS.STUDY_EXORCISM,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 2, 1),
        );
        expect(studyCore.scenarioRuntime.exorcismCircleRoomIds).toHaveLength(circleCountBefore + 1);
    });

    it('奇怪的药品会埋葬并治疗当前探索者的力量和速度', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 2,
                speed: 1,
            },
            inventory: [
                { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['holy-water'];
        setTestTraitTrack(core, '0', 'might', [1, 2, 3, 4, 5], 1, 3);
        setTestTraitTrack(core, '0', 'speed', [1, 1, 2, 3, 4], 1, 3);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'holy-water' });

        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain('holy-water');
        expect(core.activityLog[0]?.text).toContain('埋葬奇怪的药品');

        const secondUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'holy-water' }),
        );
        expect(secondUseValidation.valid).toBe(false);
        if (!secondUseValidation.valid) {
            expect(secondUseValidation.error).toContain('当前没有可使用持有物');
        }
    });

    it('急救包会埋葬并治疗当前探索者的所有濒死属性', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 1,
                speed: 1,
                knowledge: 1,
                sanity: 1,
            },
            inventory: [
                { id: 'medical-kit', name: '急救包', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['medical-kit'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'medical-kit', targetPlayerId: '0' });

        expect(core.currentExplorer.traits).toEqual(
            EXPLORER_CATALOG.find((explorer) => explorer.explorerId === core.currentExplorer.explorerId)!.traits,
        );
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain('medical-kit');
        expect(core.activityLog[0]?.text).toContain('埋葬急救包');
    });

    it('急救包可以治疗同板块另一位探索者并从当前探索者持有区移除', () => {
        let core = createStartedFirstScenarioCore();
        const targetPlayerId = core.otherExplorers[0]!.playerId;
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'medical-kit', name: '急救包', kind: 'item' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === targetPlayerId
                ? {
                    ...explorer,
                    roomId: core.currentExplorer.roomId,
                    traits: {
                        ...explorer.traits,
                        might: 1,
                        speed: 1,
                        knowledge: 1,
                        sanity: 1,
                    },
                }
                : explorer
        ));
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['medical-kit'];
        const currentTraitsBefore = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
            cardId: 'medical-kit',
            targetPlayerId,
        });

        const target = core.otherExplorers.find((explorer) => explorer.playerId === targetPlayerId)!;
        expect(target.traits).toEqual(
            EXPLORER_CATALOG.find((explorer) => explorer.explorerId === target.explorerId)!.traits,
        );
        expect(core.currentExplorer.traits).toEqual(currentTraitsBefore);
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain('medical-kit');
        expect(core.activityLog[0]?.text).toContain(target.displayName);
    });

    it('急救包不能治疗不同板块的另一位探索者', () => {
        const core = createStartedFirstScenarioCore();
        const targetPlayerId = core.otherExplorers[0]!.playerId;
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'medical-kit', name: '急救包', kind: 'item' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === targetPlayerId
                ? { ...explorer, roomId: 'upper-landing' }
                : explorer
        ));
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['medical-kit'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId: 'medical-kit',
                targetPlayerId,
            }),
        );

        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('急救包只能治疗自己或同板块的另一位探索者');
        }
    });

    it.each([
        ['map', '地图'],
        ['notebook', '笔记本'],
        ['journal', '日记'],
        ['manuscript', '手稿'],
    ] as const)('%s 会埋葬并把当前探索者放置到任一已发现板块', (cardId, cardName) => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [
                { id: cardId, name: cardName, kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = [cardId];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
            cardId,
            targetRoomId: 'upper-landing',
        });

        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.activeRoomId).toBe('upper-landing');
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain(cardId);
        expect(core.activityLog[0]?.text).toContain(`埋葬${cardName}`);
    });

    it.each([
        ['map', '地图'],
        ['notebook', '笔记本'],
        ['journal', '日记'],
        ['manuscript', '手稿'],
    ] as const)('%s 不能把当前探索者放置到未发现板块', (cardId, cardName) => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer.inventory = [
            { id: cardId, name: cardName, kind: 'item' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = [cardId];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId,
                targetRoomId: 'upper-north',
            }),
        );

        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain(`${cardName}只能把探索者放置到已发现板块`);
        }
    });

    it('骨制钥匙可以穿过墙壁移动到已发现相邻板块，且不会作为主动移动加成使用', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'upper-landing',
            inventory: [{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['lockpick-tool'];
        core.activeRoomId = 'upper-landing';
        core.movesRemaining = 2;
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-landing') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-west'),
                };
            }
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-landing'),
                };
            }
            return room;
        });

        const normalMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' }),
        );
        expect(normalMove.valid).toBe(false);
        expect(resolveUseEffect({ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' })).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '0',
            { roomId: 'upper-west', useSkeletonKey: true },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(1);
        expect(core.currentExplorer.inventory).toEqual([{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }]);
        expect(core.activityLog[0]?.text).toContain('使用骨制钥匙穿过墙壁');
    });

    it('骨制钥匙穿墙投到空白会被埋葬，且不能用于发现新房间', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'upper-landing',
            inventory: [{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['lockpick-tool'];
        core.activeRoomId = 'upper-landing';
        core.movesRemaining = 2;
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-landing') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-west'),
                };
            }
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-landing'),
                };
            }
            return room;
        });

        const undiscoveredMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', {
                roomId: 'upper-north',
                useSkeletonKey: true,
            }),
        );
        expect(undiscoveredMove.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '0',
            { roomId: 'upper-west', useSkeletonKey: true },
            100,
            createBetrayalScriptedRandom(1),
        );

        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(1);
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.activityLog[0]?.text).toContain('骨制钥匙被埋葬');
    });

    it('书本会让知识检定结果 +1，并影响调查杰克和研究法阵', () => {
        let learnCore = createFirstScenarioReadyToLearnAboutJackCore();
        learnCore.currentExplorer = {
            ...learnCore.currentExplorer,
            traits: {
                ...learnCore.currentExplorer.traits,
                knowledge: 4,
            },
            inventory: [
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        learnCore.currentExplorerTraits = { ...learnCore.currentExplorer.traits };
        learnCore.currentExplorerInventory = [...learnCore.currentExplorer.inventory];

        learnCore = applyBetrayalCommand(
            learnCore,
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(learnCore.scenarioRuntime.knowledgeOfJackPlayerIds).toContain('0');
        expect(learnCore.activityLog[0]?.text).toContain('查到了 Crimson Jack 的线索');

        let studyCore = createFirstScenarioReadyToStudyExorcismCore();
        studyCore.currentExplorer = {
            ...studyCore.currentExplorer,
            traits: {
                ...studyCore.currentExplorer.traits,
                knowledge: 4,
            },
            inventory: [
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        studyCore.currentExplorerTraits = { ...studyCore.currentExplorer.traits };
        studyCore.currentExplorerInventory = [...studyCore.currentExplorer.inventory];
        const circleCountBefore = studyCore.scenarioRuntime.exorcismCircleRoomIds.length;

        studyCore = applyBetrayalCommand(
            studyCore,
            BETRAYAL_COMMANDS.STUDY_EXORCISM,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(studyCore.scenarioRuntime.exorcismCircleRoomIds.length).toBe(circleCountBefore + 1);
        expect(studyCore.activityLog[0]?.text).toContain('布置了一处驱魔法阵');
    });

    it('书本每回合一次：失去 1 点神志，并让下一次非战斗检定可用知识替换', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 5,
                sanity: 2,
            },
            inventory: [
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['omen-book'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' });
        expect(core.currentExplorer.traits.sanity).toBe(1);
        expect(core.usedCardIdsThisTurn).toContain('omen-book');
        expect(core.nextNonCombatTraitReplacement).toMatchObject({
            playerId: '0',
            sourceCardId: 'omen-book',
            replacementTrait: 'knowledge',
        });

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' }),
        );
        expect(secondUse.valid).toBe(false);

        core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
        core.scenarioRuntime.jackSpiritReleased = true;
        core.scenarioRuntime.jackSpiritRoomId = core.currentExplorer.roomId;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.nextNonCombatTraitReplacement).toBeNull();
    });

    it('书本替换只作用于非战斗检定，不会让战斗对攻改用知识', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 1,
                knowledge: 6,
                sanity: 2,
            },
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'omen-book'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(core.nextNonCombatTraitReplacement).toMatchObject({
            playerId: '0',
            sourceCardId: 'omen-book',
        });
    });

    it('头骨会让知识检定结果 +1，并影响调查杰克', () => {
        let core = createFirstScenarioReadyToLearnAboutJackCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
            },
            inventory: [
                { id: 'skull', name: '头骨', kind: 'omen' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.scenarioRuntime.knowledgeOfJackPlayerIds).toContain('0');
        expect(core.activityLog[0]?.text).toContain('查到了 Crimson Jack 的线索');
    });

    it('头骨在探索者将要死亡前投 3 骰，4-6 时不死亡并把所有属性调至濒死', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, inventory: [{ id: 'skull', name: '头骨', kind: 'omen' }] }
                : explorer
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '0',
            sourceTitle: '攻击',
            allowSkull: true,
        });
        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
            101,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        const protectedHero = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0')!;
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');
        expect(protectedHero.traits).toEqual({
            might: 1,
            speed: 1,
            knowledge: 1,
            sanity: 1,
        });
        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.activityLog[0]?.text).toContain('头骨投出 4，阻止死亡');
    });

    it('头骨死亡前投 3 骰为 0-3 时仍正常死亡', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, inventory: [{ id: 'skull', name: '头骨', kind: 'omen' }] }
                : explorer
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '0',
            sourceTitle: '攻击',
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
            101,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
    });

    it('兔脚可以重掷头骨死亡保护的一颗骰子，并按新结果阻止死亡', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? {
                    ...explorer,
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                    ],
                }
                : explorer
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '0',
            sourceTitle: '攻击',
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.playerId).toBe('0');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        const protectedHero = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0')!;
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');
        expect(protectedHero.traits).toEqual({
            might: 1,
            speed: 1,
            knowledge: 1,
            sanity: 1,
        });
        expect(core.recentRoll?.latestLabel).toContain('阻止死亡');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        ).valid).toBe(false);
    });

    it('头骨不能被主动使用成通用知识加成', () => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['skull'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'skull' }),
        );

        expect(validation.valid).toBe(false);
    });

    it('首剧本起跑位就是真实运行时，不再保留手工结算口', () => {
        const core = createStartedFirstScenarioCore();

        expect(core.phase).toBe('preHaunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.rooms.some((room) => room.id === 'upper-west' && room.name === '图书馆')).toBe(true);
    });

    it('叛徒能力可忽略火炉房这类伤害性房间效果', () => {
        let core = createFirstScenarioHauntCore();
        placeActiveTestExplorerInRoom(core, '2', 'ground-north');
        setDiscoveredTestRoom(core, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        const traitorTraitsBefore = { ...findTestExplorer(core, '2').traits };

        expect(resolveBetrayalTraitorPowerStatus(core, '2')).toMatchObject({
            active: true,
            isTraitor: true,
            currentRoomName: '火炉房',
            currentTrigger: 'damaging-room-effect',
            canIgnoreDamagingTileEffects: true,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        expect(findTestExplorer(core, '2').traits).toEqual(traitorTraitsBefore);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.activityLog[0]?.text).toContain('叛徒能力忽略房间伤害');
    });

    it('叛徒在倒塌房间仍会坠落，但不承受坠落伤害', () => {
        let core = createFirstScenarioHauntCore();
        placeActiveTestExplorerInRoom(core, '2', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '倒塌房间',
            hint: '速度检定失败会坠落到地下室起始点。',
            tags: ['上层', '伤害'],
            discoveryReward: null,
            visualId: 'collapsedRoom',
            endTurnEffect: 'speedCheckFallToBasement',
        });
        const traitorPhysicalBefore = physicalTraitTotal(core, '2');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '2',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(findTestExplorer(core, '2').roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn?.previousPhysicalDamage).toBe(0);
        expect(core.recentRoll?.latestLabel).toContain('坠落');
        expect(core.activityLog[0]?.text).toContain('叛徒能力忽略坠落伤害');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '2', {});

        expect(core.pendingDamageAllocation).toBeNull();
        expect(physicalTraitTotal(core, '2')).toBe(traitorPhysicalBefore);
    });

    it('叛徒仍必须结算洗衣滑槽这类非伤害性强制房间效果', () => {
        let core = createFirstScenarioHauntCore();
        placeActiveTestExplorerInRoom(core, '2', 'basement-east');
        setDiscoveredTestRoom(core, 'basement-east', {
            name: '洗衣滑槽',
            hint: '结束回合时滑落到地下室起始点。',
            tags: ['地下室', '滑槽'],
            discoveryReward: null,
            visualId: 'laundryChute',
            endTurnEffect: 'moveToBasementLanding',
        });
        const traitorPhysicalBefore = physicalTraitTotal(core, '2');

        expect(resolveBetrayalTraitorPowerStatus(core, '2')).toMatchObject({
            active: true,
            currentRoomName: '洗衣滑槽',
            currentTrigger: 'mandatory-room-effect',
            mustResolveMandatoryTileEffects: true,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        expect(findTestExplorer(core, '2').roomId).toBe('basement-landing');
        expect(physicalTraitTotal(core, '2')).toBe(traitorPhysicalBefore);
        expect(core.activityLog[0]?.text).toContain('洗衣滑槽');
    });

    it('叛徒仍必须结算神秘电梯，作祟后可继续使用既有房间效果命令', () => {
        let core = createFirstScenarioHauntCore();
        placeActiveTestExplorerInRoom(core, '2', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '神秘电梯',
            hint: '投骰后移动电梯板块。',
            tags: ['电梯', '强制房间效果'],
            discoveryReward: null,
            visualId: 'mysticElevator',
            endTurnEffect: undefined,
            enterEffect: 'mysticElevator',
        });

        expect(resolveBetrayalTraitorPowerStatus(core, '2')).toMatchObject({
            active: true,
            currentRoomName: '神秘电梯',
            currentTrigger: 'mandatory-room-effect',
            mustResolveMandatoryTileEffects: true,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_ROOM_EFFECT, '2', {}),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
            '2',
            {},
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.scenarioRuntime.usedRoomEffectIdsThisTurn).toContain('mysticElevator');
        expect(core.recentRoll?.kind).toBe('mysticElevator');
        expect(core.activityLog[0]?.text).toContain('神秘电梯');
    });

    it('叛徒作祟后探索事件符号房间时可选择忽略事件，且不抽取事件牌', () => {
        let core = createOpenFrontierHauntTestCore('2');
        core.drawOrder = ['event'];
        const eventCard: BetrayalCore['eventOrder'][number] = {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        };
        core.eventOrder = [eventCard];
        core.deckCounts.event = core.eventOrder.length;
        const eventOrderBefore = core.eventOrder.map((event) => event.name);
        const discardCountBefore = core.discardCounts.event;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        expect(resolveBetrayalTraitorPowerStatus(core, '2')).toMatchObject({
            active: true,
            canIgnoreEventSymbols: true,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '2', {
                roomId: targetRoomId!,
                ignoreEventSymbolWithTraitorPower: true,
            }),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '2', {
            roomId: targetRoomId!,
            ignoreEventSymbolWithTraitorPower: true,
        });

        expect(core.rooms.find((room) => room.id === targetRoomId)?.state).toBe('discovered');
        expect(core.currentExplorer.roomId).toBe(targetRoomId);
        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '事件符号',
            summary: '跳过事件',
            detail: '没有抽取或结算事件卡',
        });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.discardCounts.event).toBe(discardCountBefore);
        expect(core.eventOrder.map((event) => event.name)).toEqual(eventOrderBefore);
        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.recentRoll?.kind).not.toBe('hauntRoll');
        expect(core.activityLog[0]?.text).toContain('叛徒跳过了事件符号');
    });

    it('叛徒作祟后探索事件符号房间时若不忽略事件，则正常抽取并结算事件牌', () => {
        let core = createOpenFrontierHauntTestCore('2');
        core.drawOrder = ['event'];
        const eventCard: BetrayalCore['eventOrder'][number] = {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        };
        const nextEventCard: BetrayalCore['eventOrder'][number] = {
            name: '远处低语',
            text: '远处传来低语。没有效果。',
            effect: { mode: 'none', recommendedAction: 'endTurn' },
        };
        core.eventOrder = [eventCard, nextEventCard];
        core.deckCounts.event = core.eventOrder.length;
        const mightPositionBefore = traitTrackPosition(core, '2', 'might');
        const discardCountBefore = core.discardCounts.event;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '2', {
            roomId: targetRoomId!,
        });

        expect(core.rooms.find((room) => room.id === targetRoomId)?.state).toBe('discovered');
        expect(core.currentExplorer.roomId).toBe(targetRoomId);
        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '阴影扑面',
            summary: '即时生效',
        });
        expect(core.latestDiscovery?.detail).toContain('力量 -1');
        expect(traitTrackPosition(core, '2', 'might')).toBe(mightPositionBefore - 1);
        expect(core.pendingEventChoice).toBeNull();
        expect(core.discardCounts.event).toBe(discardCountBefore);
        expect(core.eventOrder.map((event) => event.name)).toEqual(['远处低语', '阴影扑面']);
        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.recentRoll?.kind).not.toBe('hauntRoll');
        expect(core.activityLog[0]?.text).toContain('事件：阴影扑面');
    });

    it('叛徒开局按人数获得 {1/1/2/2} 点力量和速度加成', () => {
        const cases = [
            { playerIds: ['0', '1', '2'], expectedBonus: 1 },
            { playerIds: ['0', '1', '2', '3'], expectedBonus: 1 },
            { playerIds: ['0', '1', '2', '3', '4'], expectedBonus: 2 },
            { playerIds: ['0', '1', '2', '3', '4', '5'], expectedBonus: 2 },
        ];

        for (const { playerIds, expectedBonus } of cases) {
            const hauntCore = createFirstScenarioHauntCore(playerIds);
            const traitorPlayerId = hauntCore.scenarioRuntime.traitorPlayerId!;
            const traitorAfterHaunt = hauntCore.currentExplorer.playerId === traitorPlayerId
                ? hauntCore.currentExplorer
                : hauntCore.otherExplorers.find((explorer) => explorer.playerId === traitorPlayerId)!;

            expect(traitorAfterHaunt.traitTracks.might.position).toBe(
                Math.min(traitorAfterHaunt.traitTracks.might.startPosition + expectedBonus, traitorAfterHaunt.traitTracks.might.maxPosition),
            );
            expect(traitorAfterHaunt.traitTracks.speed.position).toBe(
                Math.min(traitorAfterHaunt.traitTracks.speed.startPosition + expectedBonus, traitorAfterHaunt.traitTracks.speed.maxPosition),
            );
        }
    });

    it('英雄线可击倒叛徒、释放杰克之灵并完成驱魔结算', () => {
        const core = playFirstScenarioToSurvivorVictory();

        expect(core.phase).toBe('endgame');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toHaveLength(2);
        expect(core.endgameResult?.hauntTitle).toBe('Crimson Jack Returns');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.endgameResult?.winners).toEqual(['0', '1']);
    });

    it('终局读模型在作祟未完成时保持非激活，不提前展示胜利文本', () => {
        const core = createFirstScenarioHauntCore();
        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: false,
            phase: 'haunt',
            hauntId: null,
            outcome: null,
            winnerPlayerIds: [],
            ifYouWinTextId: null,
            ifYouWinTextStatus: 'inactive',
            ifYouWinTextAvailable: false,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'inactive',
            tiePolicyStatus: 'inactive',
            representativeOnly: false,
        });
    });

    it('首剧本英雄终局读模型只暴露胜方和胜利文本合同 id，不冒充原文已接入', () => {
        const core = playFirstScenarioToSurvivorVictory();
        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: true,
            phase: 'endgame',
            hauntId: 'crimson-jack-returns',
            hauntTitle: 'Crimson Jack Returns',
            outcome: 'survivors',
            winningSideLabel: '英雄',
            winnerPlayerIds: ['0', '1'],
            traitorPlayerId: '2',
            ifYouWinTextId: 'crimson-jack-returns.survivors.if-you-win',
            ifYouWinTextStatus: 'representative-only',
            ifYouWinTextAvailable: false,
            needsIfYouWinTextSource: true,
            simultaneousCompletionPolicyStatus: 'missing-contract',
            tiePolicyStatus: 'missing-contract',
            representativeOnly: true,
        });
        expect(endgame.winnerNames).toHaveLength(2);
        expect(endgame.ruleNotes).toEqual(expect.arrayContaining([
            '终局结果已记录胜方和获胜玩家。',
            '当前只证明代表作祟终局读模型，不代表 50 个作祟终局全部完成。',
        ]));
    });

    it('叛徒线可以通过击倒全部英雄进入终局', () => {
        const core = playFirstScenarioToTraitorVictory();

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.traitorPlayerId).toBe('2');
        expect(core.endgameResult?.winners).toEqual(['2']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
    });

    it('叛徒收尾前一手前置态应停在真实 haunt 运行时，而不是直接进入终局', () => {
        const core = createFirstScenarioReadyToTraitorVictoryCore();
        const livingHeroesInRoom = core.otherExplorers.filter((explorer) => (
            explorer.playerId !== '2'
            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            && explorer.roomId === core.activeRoomId
        ));

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.activeRoomId).toBe('ground-north');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(livingHeroesInRoom.map((explorer) => explorer.playerId)).toEqual(['1']);
    });

    it('恶兆不会在掷骰不足 5 时提前触发 haunt', () => {
        let core = createStartedFirstScenarioCore();
        const lowHauntRoll = createBetrayalScriptedRandom(1, 1, 1, 1, 1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, lowHauntRoll);
        core = acknowledgeAnyPendingCardResolutions(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', {}, 100, lowHauntRoll);

        expect(core.phase).toBe('preHaunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.scenarioRuntime.omensDiscovered).toBe(0);
        expect(core.latestDiscovery?.kind).toBe('item');
    });

    it('图书馆、驱魔法阵和驱魔失败都按真实投骰与伤害结算', () => {
        let core = createFirstScenarioHauntCore();
        const hauntActionRandom = createBetrayalScriptedRandom(
            1, 1, 1, 1, // 图书馆失败
            1, 1, 1, 1, // 驱魔法阵失败
            1, 1, 1, 1, 1, 1, // 驱魔失败
        );

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LEARN_ABOUT_JACK, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.knowledgeOfJackPlayerIds).toEqual([]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
        const mentalPositionsBeforeStudy = traitTrackPositionTotal(core, '0', ['sanity', 'knowledge']);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toEqual([]);
        expect(traitTrackPositionTotal(core, '0', ['sanity', 'knowledge'])).toBe(mentalPositionsBeforeStudy - 2);

        core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
        core.scenarioRuntime.jackSpiritReleased = true;
        core.scenarioRuntime.jackSpiritRoomId = 'upper-north';
        const teammateBefore = core.otherExplorers.find((explorer) => explorer.playerId === '1');
        const actorBefore = { ...core.currentExplorer.traits };
        core.scenarioRuntime.exorcismCircleRoomIds = [];
        const exorciseWithoutCirclesValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}),
        );
        expect(exorciseWithoutCirclesValidation.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}, 100, hauntActionRandom);
        const teammateAfter = core.otherExplorers.find((explorer) => explorer.playerId === '1');

        expect(core.phase).toBe('haunt');
        expect(core.currentExplorer.traits.might + core.currentExplorer.traits.speed).toBeLessThan(
            actorBefore.might + actorBefore.speed,
        );
        expect((teammateAfter?.traits.might ?? 0) + (teammateAfter?.traits.speed ?? 0)).toBeLessThan(
            (teammateBefore?.traits.might ?? 0) + (teammateBefore?.traits.speed ?? 0),
        );
    });

    it('最终驱魔失败只让每名存活英雄各承受 1 点身体伤害且不会误终局', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;
        const traitorId = core.scenarioRuntime.traitorPlayerId!;

        setTestExplorerTraits(core, actorId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        const actorPhysicalBefore = physicalTraitTotal(core, actorId);
        const teammatePhysicalBefore = physicalTraitTotal(core, teammateId);
        const traitorPhysicalBefore = physicalTraitTotal(core, traitorId);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('驱魔失败');
        expect(physicalTraitTotal(core, actorId)).toBe(actorPhysicalBefore - 1);
        expect(physicalTraitTotal(core, teammateId)).toBe(teammatePhysicalBefore - 1);
        expect(physicalTraitTotal(core, traitorId)).toBe(traitorPhysicalBefore);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(actorId);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(teammateId);
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
    });

    it('最终驱魔失败只会让被 1 点身体伤害打到死亡边界的英雄死亡', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;

        setTestExplorerTraits(core, actorId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });
        setTestTraitTrack(core, actorId, 'might', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, actorId, 'speed', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, teammateId, 'might', [1, 2, 3, 4, 5], 0, 3);
        setTestTraitTrack(core, teammateId, 'speed', [1, 2, 3, 4, 5], 3, 3);
        const actorPhysicalBefore = physicalTraitTotal(core, actorId);
        const teammatePhysicalBefore = physicalTraitTotal(core, teammateId);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(physicalTraitTotal(core, actorId)).toBe(actorPhysicalBefore - 1);
        expect(physicalTraitTotal(core, teammateId)).toBe(teammatePhysicalBefore - 1);
        expect(findTestExplorer(core, teammateId).traitTracks.might.position).toBe(
            findTestExplorer(core, teammateId).traitTracks.might.skullPosition,
        );
        expect(findTestExplorer(core, teammateId).traits.might).toBe(0);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(actorId);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain(teammateId);
    });

    it('最终驱魔失败导致全部英雄到死亡边界时才进入叛徒终局', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;
        const traitorId = core.scenarioRuntime.traitorPlayerId!;

        setTestExplorerTraits(core, actorId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });
        setTestTraitTrack(core, actorId, 'might', [1, 2, 3, 4, 5], 0, 3);
        setTestTraitTrack(core, actorId, 'speed', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, teammateId, 'might', [1, 2, 3, 4, 5], 0, 3);
        setTestTraitTrack(core, teammateId, 'speed', [1, 2, 3, 4, 5], 3, 3);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.winners).toEqual([traitorId]);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining([actorId, teammateId]));
    });

    it('圣符和指环会让驱魔神志检定结果 +1', () => {
        const sanityBonusOmens = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' as const },
            { id: 'ring', name: '指环', kind: 'omen' as const },
        ];

        for (const omen of sanityBonusOmens) {
            let core = createFirstScenarioHauntCore();
            core.currentExplorer = {
                ...core.currentExplorer,
                roomId: 'upper-north',
                traits: {
                    ...core.currentExplorer.traits,
                    sanity: 4,
                },
                inventory: [omen],
            };
            core.activeRoomId = 'upper-north';
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.currentExplorerInventory = [...core.currentExplorer.inventory];
            core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
            core.scenarioRuntime.jackSpiritReleased = true;
            core.scenarioRuntime.jackSpiritRoomId = 'upper-north';

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.EXORCISE_JACK,
                '0',
                {},
                100,
                createBetrayalScriptedRandom(2, 2, 2, 2),
            );

            expect(core.activityLog[0]?.text).toContain('杰克之灵被驱散');
            expect(core.endgameResult?.outcome).toBe('survivors');
        }
    });

    it('圣符发现板块时可埋葬第一张板块并继续发现下一张，且不结算第一张效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '滑落阶梯',
                text: '脚下阶梯突然松动。失去 1 点速度。',
                effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        const collapsedRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!;
        const mysticElevator = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'mysticElevator')!;
        setTestRoomDiscoveryDeck(core, [
            { floor: 'upper', room: collapsedRoom },
            { floor: 'upper', room: mysticElevator },
        ]);
        core.currentExplorer.inventory = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['holy-symbol'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const speedBeforeExplore = core.currentExplorer.traits.speed;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'upper-north', useHolySymbol: true },
            100,
            createBetrayalScriptedRandom(1),
        );

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        expect(discoveredRoom?.visualId).toBe('mysticElevator');
        expect(discoveredRoom?.endTurnEffect).toBeUndefined();
        expect(discoveredRoom?.enterEffect).toBe('mysticElevator');
        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.title).toBe('滑落阶梯');
        expect(core.currentExplorer.traits.speed).toBe(speedBeforeExplore - 1);
        expect(core.activityLog[0]?.text).toContain('圣符埋葬倒塌房间');
        expect(core.activityLog[0]?.text).toContain('继续发现神秘电梯');
    });

    it('没有圣符或本回合刚获得圣符时，不能声明埋葬发现板块', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });

        const withoutHolySymbol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north', useHolySymbol: true }),
        );
        expect(withoutHolySymbol.valid).toBe(false);
        if (!withoutHolySymbol.valid) {
            expect(withoutHolySymbol.error).toContain('不能使用圣符');
        }

        core.currentExplorer.inventory = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = [];

        const newlyGainedHolySymbol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north', useHolySymbol: true }),
        );
        expect(newlyGainedHolySymbol.valid).toBe(false);
        if (!newlyGainedHolySymbol.valid) {
            expect(newlyGainedHolySymbol.error).toContain('不能使用圣符');
        }
    });

    it.each(BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((omen) => [omen.name, omen] as const))(
        '抽到预兆「%s」会记录对应作祟检定骰面',
        (_omenName, omen) => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['omen'];
        core.possessionOrderByKind.omen = [
            omen,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerInventory = [];
        const expectedDiceCount = 1 + [core.currentExplorer, ...core.otherExplorers]
            .reduce((count, explorer) => count + explorer.inventory.filter((card) => card.kind === 'omen').length, 0);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.latestDiscovery?.title).toBe(omen.name);
        expect(core.latestDiscovery?.detail).toContain('作祟检定');
        expect(core.latestDiscovery?.detail).toContain('抽到预兆后进行作祟检定');
        expect(core.latestDiscovery?.detail).toContain('5+ 作祟开始');
        expect(core.recentRoll?.kind).toBe('hauntRoll');
        expect(core.recentRoll?.sourceTitle).toBe(omen.name);
        expect(core.recentRoll?.rollLabel).toBe('作祟检定');
        expect(core.recentRoll?.dice).toEqual(Array.from({ length: expectedDiceCount }, () => 1));
        expect(core.recentRoll?.latestLabel).toBe('未触发作祟');
        expect(core.phase).toBe('preHaunt');
        },
    );

    it('最后一张恶兆会自动触发 haunt', () => {
        const core = createStartedFirstScenarioCore();
        core.exploreIndex = 2;
        core.deckCounts.omen = 1;
        core.currentExplorer.roomId = 'hallway';
        const command = createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
        const events = BetrayalDomain.execute({ core, sys: {} as never }, command, createBetrayalScriptedRandom(1));
        const roomExplored = events.find((event) => event.type === 'ROOM_EXPLORED');

        expect(roomExplored?.type).toBe('ROOM_EXPLORED');
        if (roomExplored?.type === 'ROOM_EXPLORED') {
            expect(roomExplored.payload.hauntTriggered).toBe(true);
        }
    });

    it('作祟阶段探索新房间会正常结算发现，但不会再进行作祟检定', () => {
        let core = createOpenFrontierHauntTestCore('0');
        core.drawOrder = ['event'];
        const firstEvent: BetrayalCore['eventOrder'][number] = {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点速度。',
            effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
        };
        const secondEvent: BetrayalCore['eventOrder'][number] = {
            name: '第二张测试事件',
            text: '用于确认事件牌堆顺序。',
            effect: { mode: 'none', recommendedAction: 'endTurn' },
        };
        core.eventOrder = [firstEvent, secondEvent];
        core.deckCounts.event = core.eventOrder.length;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();
        const speedBeforeExplore = findTestExplorer(core, '0').traits.speed;

        expect(core.phase).toBe('haunt');
        expect(core.rooms.some((room) => room.state === 'unexplored')).toBe(true);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: targetRoomId! }),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: targetRoomId! });

        expect(core.rooms.find((room) => room.id === targetRoomId)?.state).toBe('discovered');
        expect(core.currentExplorer.roomId).toBe(targetRoomId);
        expect(core.latestDiscovery?.title).toBe('阴影扑面');
        expect(core.pendingEventChoice).toBeNull();
        expect(findTestExplorer(core, '0').traits.speed).toBe(speedBeforeExplore - 1);
        expect(core.eventOrder.map((event) => event.name)).toEqual(['第二张测试事件', '阴影扑面']);
        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.recentRoll?.kind).not.toBe('hauntRoll');
    });

    it('翻开未知房间时会把新房间门位旋转到当前开放门位，不再靠黄色连接补丁伪造门', () => {
        const reverseRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], reverseRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' }, 100, createBetrayalScriptedRandom(1));

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        expect(discoveredRoom?.entryRoomId).toBe('upper-landing');
        expect(discoveredRoom?.entryEdge).toBe('north');
        expect(discoveredRoom?.doorways.some((doorway) => (
            doorway.edge === 'south' && doorway.connectsToRoomId === 'upper-landing'
        ))).toBe(true);
    });

    it('正式探索会从真实开放门位动态生成下一批未知房间，并在探索后结束当前回合', () => {
        let core = createStartedFirstScenarioCore();

        expect(core.rooms.some((room) => room.id === 'upper-north' && room.state === 'unexplored')).toBe(true);
        expect(core.rooms.some((room) => room.id === 'frontier-upper-north-east')).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' }, 100, createBetrayalScriptedRandom(1));

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        const dynamicFrontier = core.rooms.find((room) => room.id === 'frontier-upper-north-west');
        expect(discoveredRoom?.state).toBe('discovered');
        expect(dynamicFrontier?.state).toBe('unexplored');
        expect(dynamicFrontier?.doorways).toEqual([
            { edge: 'east', connectsToRoomId: 'upper-north' },
        ]);
        expect(discoveredRoom?.doorways.some((doorway) => (
            doorway.edge === 'west' && doorway.connectsToRoomId === 'frontier-upper-north-west'
        ))).toBe(true);
        expect(core.movesRemaining).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.recommendedAction).toBe('endTurn');

        const moveAfterDiscovery = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'frontier-upper-north-west' }),
        );
        expect(moveAfterDiscovery.valid).toBe(false);
        if (!moveAfterDiscovery.valid) {
            expect(moveAfterDiscovery.error).toContain('请先确认当前翻牌结算');
        }

        core = acknowledgeAnyPendingCardResolutions(core);
        const moveAfterResolution = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'frontier-upper-north-west' }),
        );
        expect(moveAfterResolution.valid).toBe(false);
        if (!moveAfterResolution.valid) {
            expect(moveAfterResolution.error).toContain('回合已经结束');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.turnEndedByDiscovery).toBe(false);
    });

    it('Stalk the Prey 只能在未攻击且本回合未用过时发动一次，并且不消耗普通移动', () => {
        let core = createFirstScenarioHauntCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.roomId).toBe('basement-east');

        const movesBeforeStalk = core.movesRemaining;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-west' });
        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(movesBeforeStalk);
        expect(core.usedCardIdsThisTurn).toContain('stalk-the-prey');

        const secondStalkValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'entrance-hall' }),
        );
        expect(secondStalkValidation.valid).toBe(false);

        let afterAttackCore = createFirstScenarioHauntCore();
        afterAttackCore.currentPlayer = '2';
        const traitor = afterAttackCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const hero = afterAttackCore.currentExplorer;
        afterAttackCore.currentExplorer = { ...traitor, roomId: 'hallway' };
        afterAttackCore.otherExplorers = [
            { ...hero, roomId: 'hallway' },
            ...afterAttackCore.otherExplorers.filter((explorer) => explorer.playerId !== '2'),
        ];
        afterAttackCore.activeRoomId = 'hallway';
        afterAttackCore.currentExplorerTraits = { ...afterAttackCore.currentExplorer.traits };
        afterAttackCore.currentExplorerInventory = [...afterAttackCore.currentExplorer.inventory];
        afterAttackCore = applyBetrayalCommand(
            afterAttackCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const afterAttackValidation = BetrayalDomain.validate(
            { core: afterAttackCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-west' }),
        );
        expect(afterAttackValidation.valid).toBe(false);
    });

    it('叛徒死亡后轮到其回合时，应改为操控杰克之灵按相邻房间移动', () => {
        let core = createFirstScenarioHauntCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.currentPlayer).toBe('0');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(core.currentPlayer).toBe('2');
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);
        expect(core.movesRemaining).toBe(2);

        const moveTargets = ['hallway', 'basement-landing', 'basement-east'].map((roomId) => (
            BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId }),
            ).valid
        ));
        expect(moveTargets).toEqual([true, true, false]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });

        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('basement-landing');
    });

    it('上一名英雄结束回合时，会自然进入死叛徒的杰克之灵速度移动骰', () => {
        let core = createJackSpiritNaturalMonsterTurnBeforeRollCore();

        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        const jackSpiritRoomId = core.scenarioRuntime.jackSpiritRoomId;
        expect(jackSpiritRoomId).toBeTruthy();
        expect(core.recentRoll).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.activeRoomId).toBe(jackSpiritRoomId);
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);
        expect(core.movesRemaining).toBe(2);
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            trait: 'speed',
            dice: [1, 1, 0],
        });

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' }),
        ).valid).toBe(true);
    });

    it('杰克之灵控制回合不能使用持有物、兔脚、交易或搜刮尸体', () => {
        const core = createJackSpiritMovementRollReadyCore();
        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);

        core.currentExplorer.inventory = [
            { id: 'medical-kit', name: '急救包', kind: 'item' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' }),
        ).valid).toBe(true);

        const blockedCommands = [
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '2', { cardId: 'medical-kit' }),
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '2', { cardId: 'rope', dieIndex: 0 }),
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '2', {
                cardIds: ['medical-kit'],
                targetPlayerId: '0',
            }),
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '2', { accept: true }),
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '2', {
                sourcePlayerId: '2',
                cardId: 'medical-kit',
            }),
        ];

        blockedCommands.forEach((command) => {
            expect(BetrayalDomain.validate({ core, sys: {} as never }, command)).toMatchObject({
                valid: false,
                error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。',
            });
        });
    });


    it('上一名探索者结束回合时，会自然进入死叛徒的狂热病患速度移动骰并能交接回合', () => {
        let core = createDustFeverishNaturalMonsterTurnBeforeRollCore();

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(3);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('0');
        expect(core.monsters.find((monster) => monster.id === 'feverish-0')?.roomId).toBe('hallway');
        expect(core.recentRoll).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '2',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 1, 1, 1),
        );

        expect(core.currentPlayer).toBe('0');
        expect(core.currentExplorer.playerId).toBe('0');
        expect(core.activeRoomId).toBe('hallway');
        expect(core.movesRemaining).toBe(2);
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            trait: 'speed',
            dice: [1, 1, 0, 0, 0],
        });

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' });
        expect(core.monsters.find((monster) => monster.id === 'feverish-0')?.roomId).toBe('entrance-hall');
        expect(core.activeRoomId).toBe('entrance-hall');
        expect(core.movesRemaining).toBe(1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
    });

    it('狂热病患动作槽可从怪物攻击入口攻击同房英雄', () => {
        let core = createDustFeverishAttackReadyCore();
        const actionPanel = resolveBetrayalMonsterActionPanel(core);
        const attackSlot = actionPanel.slots.find((slot) => (
            slot.kind === 'attack'
            && slot.monsterId === 'feverish-0'
        ));

        expect(core.currentPlayer).toBe('0');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(attackSlot).toMatchObject({
            enabled: true,
            command: BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, '0', {
                monsterId: 'feverish-0',
                targetPlayerId: '1',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            '0',
            {
                monsterId: 'feverish-0',
                targetPlayerId: '1',
            },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.recentRoll).toMatchObject({
            kind: 'attackRoll',
            sourceTitle: '狂热病患攻击',
        });
        expect(core.scenarioRuntime.monsterTurn.attackedMonsterIdsThisTurn).toContain('feverish-0');
        expect(core.pendingDamageAllocation?.playerId).toBe('1');
    });

    it('狂热病患怪物攻击击倒最后一名非叛徒后触发灰尘叛徒胜利', () => {
        let core = createDustFeverishAttackReadyCore();
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0', '2'];
        setTestTraitTrack(core, '1', 'might', [1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1], 1, 1);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            '0',
            {
                monsterId: 'feverish-0',
                targetPlayerId: '1',
            },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '1',
            allowSkull: true,
        });
        expect(core.endgameResult).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['0', '2']);
        expect(core.scenarioRuntime.monsterTurn.attackedMonsterIdsThisTurn).toContain('feverish-0');
    });

    it('狂热病患控制回合同样不能使用持有物、兔脚、交易或搜刮尸体', () => {
        const core = createFeverishControlReadyCore();
        expect(core.currentPlayer).toBe('0');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('0');

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(true);

        const blockedCommands = [
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'medical-kit' }),
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                cardIds: ['medical-kit'],
                targetPlayerId: '1',
            }),
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '0', { accept: true }),
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '0', {
                sourcePlayerId: '0',
                cardId: 'medical-kit',
            }),
        ];

        blockedCommands.forEach((command) => {
            expect(BetrayalDomain.validate({ core, sys: {} as never }, command)).toMatchObject({
                valid: false,
                error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。',
            });
        });
    });

    it('英雄攻击叛徒时应按对攻差值造成 physical damage，平手无伤害，Knowledge of Jack 只在此时加成', () => {
        let tieCore = createFirstScenarioHauntCore();
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        const traitorBeforeTie = tieCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const heroBeforeTie = { ...tieCore.currentExplorer.traits };
        tieCore = applyBetrayalCommand(
            tieCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfterTie = tieCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(tieCore.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(tieCore.currentExplorer.traits).toEqual(heroBeforeTie);
        expect(traitorAfterTie.traits).toEqual(traitorBeforeTie.traits);
        expect(tieCore.usedCardIdsThisTurn).toContain('haunt-attack');
        const secondAttackSameTurn = BetrayalDomain.validate(
            { core: tieCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', { target: 'traitor' }),
        );
        expect(secondAttackSameTurn).toMatchObject({ valid: false, error: '本回合已经攻击过。' });

        let bonusCore = createFirstScenarioHauntCore();
        bonusCore.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        bonusCore = applyBetrayalCommand(
            bonusCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );

        expect(bonusCore.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            playerId: '2',
        });
        expect(bonusCore.scenarioRuntime.jackSpiritReleased).toBe(false);
        bonusCore = applyBetrayalCommand(
            bonusCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(bonusCore, 'might') },
        );

        expect(bonusCore.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(bonusCore.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
    });

    it('致死普通攻击先等待受伤方分配伤害，确认后才释放杰克之灵', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBeTruthy();
    });

    it('兔脚可以重掷刚刚攻击投骰的一颗骰子，并按新结果回算非致死攻击伤害', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'rope'];

        const heroBeforeAttack = { ...core.currentExplorer.traits };
        const traitorBeforeAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2, 2, 2, 2, 2, 1),
        );

        const heroAfterFailedAttack = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0')!;
        const traitorAfterFailedAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.recentRoll?.playerId).toBe('0');
        expect(heroAfterFailedAttack.traits.might + heroAfterFailedAttack.traits.speed).toBeLessThan(
            heroBeforeAttack.might + heroBeforeAttack.speed,
        );
        expect(traitorAfterFailedAttack.traits).toEqual(traitorBeforeAttack.traits);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        const heroAfterReroll = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0')!;
        const traitorAfterReroll = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(heroAfterReroll.traits).toEqual(heroBeforeAttack);
        expect(traitorAfterReroll.traits).toEqual(traitorBeforeAttack.traits);
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.activePlayerId).toBe('2');
        expect(core.recentRoll?.latestLabel).toContain('造成');
        expect(core.usedCardIdsThisTurn).toContain('rope');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const traitorAfterDamageAllocation = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(traitorAfterDamageAllocation.traits.might + traitorAfterDamageAllocation.traits.speed).toBeLessThan(
            traitorBeforeAttack.traits.might + traitorBeforeAttack.traits.speed,
        );
        expect(core.pendingDamageAllocation).toBeNull();

        const useAgain = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        );
        expect(useAgain.valid).toBe(false);
    });

    it('兔脚重掷未确认的攻击伤害时，会替换待分配伤害而不是强制先分配', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'hunting-knife', 'rope'];

        const traitorBeforeAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
        });
        const firstPendingDamageId = core.pendingDamageAllocation?.id;
        const firstPendingDamageAmount = core.pendingDamageAllocation?.originalAmount ?? 0;
        expect(core.activePlayerId).toBe('2');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(2),
        );

        const traitorAfterReroll = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
        });
        expect(core.pendingDamageAllocation?.id).not.toBe(firstPendingDamageId);
        expect(core.pendingDamageAllocation?.originalAmount).toBeGreaterThan(firstPendingDamageAmount);
        expect(core.activePlayerId).toBe('2');
        expect(traitorAfterReroll.traits).toEqual(traitorBeforeAttack.traits);
        expect(core.recentRoll?.latestLabel).toContain('造成');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('砍刀只能作为攻击武器显式使用，攻击结果 +1 且本回合不能交易', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'hunting-knife'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'hunting-knife' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);
        const traitorBeforeAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('hunting-knife');
        expect(core.activityLog[0]?.text).toContain('使用砍刀');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '2')?.traits).toEqual(traitorBeforeAttack.traits);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const traitorAfterAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(traitorAfterAttack.traits.might + traitorAfterAttack.traits.speed).toBeLessThan(
            traitorBeforeAttack.traits.might + traitorBeforeAttack.traits.speed,
        );
        expect(core.pendingDamageAllocation).toBeNull();

        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1' ? { ...explorer, roomId: core.activeRoomId } : explorer
        ));
        const tradeUsedWeapon = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                cardId: 'hunting-knife',
                targetPlayerId: '1',
            }),
        );
        expect(tradeUsedWeapon.valid).toBe(false);
        expect(tradeUsedWeapon.error).toContain('本回合已经使用过的持有物不能交易');
    });

    it('攻击武器读模型保留刚获得和已使用武器并给出不可用原因', () => {
        const core = createFirstScenarioHauntCore();
        core.currentExplorer.inventory = [
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
            { id: 'dagger', name: '匕首', kind: 'omen' },
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = ['hunting-knife', 'ring'];
        core.usedCardIdsThisTurn = ['ring'];

        const statusesByCardId = Object.fromEntries(
            resolveAttackWeaponCardStatuses(core).map((status) => [status.card.id, status]),
        );

        expect(statusesByCardId['hunting-knife']).toMatchObject({
            canUse: true,
            reason: null,
            availableAtTurnStart: true,
            usedThisTurn: false,
        });
        expect(statusesByCardId.dagger).toMatchObject({
            canUse: false,
            reason: '本回合新获得的武器不能立刻使用。',
            availableAtTurnStart: false,
            usedThisTurn: false,
        });
        expect(statusesByCardId.ring).toMatchObject({
            canUse: false,
            reason: '这把武器本回合已经使用。',
            availableAtTurnStart: true,
            usedThisTurn: true,
        });
    });

    it('未声明使用砍刀时，不会只因持有武器自动获得攻击 +1', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('hunting-knife');
    });

    it('匕首只能作为攻击武器显式使用，会失去 1 点速度并额外投 2 颗骰', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'dagger'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'dagger' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);

        const heroSpeedBefore = core.currentExplorer.traits.speed;
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const traitorPhysicalBefore = traitorBefore.traits.might + traitorBefore.traits.speed;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'dagger' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 3, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('dagger');
        expect(core.activityLog[0]?.text).toContain('使用匕首');
        const attackerAfterDagger = core.currentExplorer.playerId === '0'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(attackerAfterDagger.traits.speed).toBe(heroSpeedBefore - 1);
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
            allowedTraits: ['might', 'speed'],
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(traitorAfter.traits.might + traitorAfter.traits.speed).toBeLessThan(traitorPhysicalBefore);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
    });

    it('未声明使用匕首时，不会只因持有武器自动额外投骰或失去速度', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('dagger');
    });

    it('指环只能作为攻击武器显式使用，双方改用神志对攻并造成精神伤害', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'ring'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'ring' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);

        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const traitorPhysicalBefore = traitorBefore.traits.might + traitorBefore.traits.speed;
        const traitorMentalBefore = traitorBefore.traits.knowledge + traitorBefore.traits.sanity;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'ring' },
            100,
            createBetrayalScriptedRandom(2, 1, 1, 1, 1, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('ring');
        expect(core.activityLog[0]?.text).toContain('使用指环');
        expect(core.activityLog[0]?.text).toContain('mental damage');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'mental',
            playerId: '2',
            allowedTraits: ['knowledge', 'sanity'],
            allowSkull: true,
        });
        expect(physicalTraitTotal(core, '2')).toBe(traitorPhysicalBefore);
        expect(mentalTraitTotal(core, '2')).toBe(traitorMentalBefore);

        const attackerCannotEndBeforeDamage = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        );
        expect(attackerCannotEndBeforeDamage).toMatchObject({ valid: false, error: '请先分配当前伤害。' });

        const wrongPlayer = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', {
                traits: repeatTraitsForPendingDamage(core, ['knowledge', 'sanity']),
            }),
        );
        expect(wrongPlayer).toMatchObject({ valid: false, error: '必须由受伤玩家分配伤害。' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: repeatTraitsForPendingDamage(core, ['knowledge', 'sanity']) },
        );

        expect(physicalTraitTotal(core, '2')).toBe(traitorPhysicalBefore);
        expect(mentalTraitTotal(core, '2')).toBeLessThan(traitorMentalBefore);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
    });

    it('未声明使用指环时，不会只因持有武器自动改用神志或造成精神伤害', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('ring');
    });

    it('远程武器可攻击视线内目标，近战和徒手仍限同房间', () => {
        let core = createFirstScenarioHauntCore();
        activateTestExplorer(core, '0');
        const actor = findTestExplorer(core, '0');
        const traitor = findTestExplorer(core, '2');
        actor.roomId = 'grand-staircase';
        traitor.roomId = 'entrance-hall';
        actor.inventory = [
            { id: 'crossbow', name: '弩', kind: 'item' },
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
        ];
        core.activeRoomId = actor.roomId;
        core.currentExplorerInventory = actor.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = actor.inventory.map((card) => card.id);

        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'entrance-hall')).toBe(true);

        const unarmedAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', { target: 'traitor' }),
        );
        expect(unarmedAttack.valid).toBe(false);

        const meleeAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'traitor',
                weaponCardId: 'hunting-knife',
            }),
        );
        expect(meleeAttack.valid).toBe(false);

        const rangedAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'traitor',
                weaponCardId: 'crossbow',
            }),
        );
        expect(rangedAttack.valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'crossbow' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.recentRoll?.attack?.defenderPlayerId).toBe('2');
        expect(core.usedCardIdsThisTurn).toContain('crossbow');
        expect(core.activityLog[0]?.text).toContain('使用弩');

        const blockedCore = createFirstScenarioHauntCore();
        activateTestExplorer(blockedCore, '0');
        const blockedActor = findTestExplorer(blockedCore, '0');
        const blockedTraitor = findTestExplorer(blockedCore, '2');
        blockedActor.roomId = 'grand-staircase';
        blockedTraitor.roomId = 'upper-landing';
        blockedActor.inventory = [{ id: 'crossbow', name: '弩', kind: 'item' }];
        blockedCore.activeRoomId = blockedActor.roomId;
        blockedCore.currentExplorerInventory = blockedActor.inventory.map((card) => ({ ...card }));
        blockedCore.turnStartInventoryCardIds = blockedActor.inventory.map((card) => card.id);

        expect(isBetrayalRoomInLineOfSight(blockedCore, 'grand-staircase', 'upper-landing')).toBe(false);
        const blockedRangedAttack = BetrayalDomain.validate(
            { core: blockedCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'traitor',
                weaponCardId: 'crossbow',
            }),
        );
        expect(blockedRangedAttack.valid).toBe(false);
        expect(blockedRangedAttack.error).toContain('视线');
    });

    it('死叛徒回合攻击英雄时应按 Jack’s Spirit 的房间和数值行动', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);

        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : explorer
        ));
        const attackValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '2', { target: 'hero' }),
        );
        expect(attackValidation.valid).toBe(false);

        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: core.scenarioRuntime.jackSpiritRoomId! }
                : explorer
        ));
        setHighCapacityPhysicalDamageTracks(core, '0');
        const hero = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        const heroPhysicalPositionBefore = traitTrackPositionTotal(core, '0', ['might', 'speed']);
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.recentRoll?.playerId).toBe('2');
        expect(core.recentRoll?.dice.length).toBeGreaterThan(0);
        expect(core.recentRoll?.attack?.target).toBe('hero');
        expect(core.recentRoll?.attack?.defenderPlayerId).toBe('0');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '0',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(heroPhysicalPositionBefore);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const updatedHero = findTestExplorer(core, '0');
        expect(updatedHero.traits.might + updatedHero.traits.speed).toBe(hero.traits.might + hero.traits.speed);
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBeLessThan(heroPhysicalPositionBefore);
        expect(core.pendingDamageAllocation).toBeNull();
    });

    it('英雄持有 Knowledge of Jack 时，被 Jack’s Spirit 攻击也应获得 +2 防御加成', () => {
        let withoutBonus = createFirstScenarioHauntCore();
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(withoutBonus, 'might') },
        );
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.END_TURN, '0', {});
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(2, 2, 1));
        setHighCapacityPhysicalDamageTracks(withoutBonus, '0');
        const noBonusHeroPositionBefore = traitTrackPositionTotal(withoutBonus, '0', ['might', 'speed']);
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        expect(withoutBonus.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '0',
        });
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(withoutBonus, ['might', 'speed']) },
        );
        const noBonusHeroPositionAfter = traitTrackPositionTotal(withoutBonus, '0', ['might', 'speed']);

        let withBonus = createFirstScenarioHauntCore();
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(withBonus, 'might') },
        );
        withBonus.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.END_TURN, '0', {});
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(2, 2, 1));
        setHighCapacityPhysicalDamageTracks(withBonus, '0');
        const bonusHeroPositionBefore = traitTrackPositionTotal(withBonus, '0', ['might', 'speed']);
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        expect(withBonus.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '0',
        });
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(withBonus, ['might', 'speed']) },
        );
        const bonusHeroPositionAfter = traitTrackPositionTotal(withBonus, '0', ['might', 'speed']);

        const noBonusLoss = noBonusHeroPositionBefore - noBonusHeroPositionAfter;
        const bonusLoss = bonusHeroPositionBefore - bonusHeroPositionAfter;

        expect(noBonusLoss).toBeGreaterThan(bonusLoss);
    });

    it('Jack’s Spirit 回到尸体房间后，应在怪物回合开始时复活叛徒并移除 spirit', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(2, 2, 1));

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.recentRoll?.kind).toBe('monsterMoveRoll');
        expect(core.recentRoll?.dice).toEqual([1, 1, 0]);
        expect(core.movesRemaining).toBe(2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.scenarioRuntime.traitorCorpseRoomId).toBe('basement-east');
        expect(core.movesRemaining).toBe(1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-east' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-east');
        expect(core.movesRemaining).toBe(0);

        const moveAfterAllowanceSpent = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' }),
        );
        expect(moveAfterAllowanceSpent.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBeNull();
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')).toBeUndefined();
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.currentExplorer.traits.might).toBeGreaterThan(1);
        const template = EXPLORER_CATALOG.find((explorer) => explorer.explorerId === core.currentExplorer.explorerId)!;
        expect(core.currentExplorer.traits.might).toBe(template.traits.might);
        expect(core.currentExplorer.traits.speed).toBe(template.traits.speed);
    });

    it('同房间尸体上的 Item/Omen 应可每回合搜刮 1 件，且同一尸体同回合不能连续搜刮', () => {
        let core = createCorpseLootReadyCore();
        let deathState = resolveBetrayalDeathStateSummary(core);

        expect(deathState).toMatchObject({
            hauntDeathRulesActive: true,
            livingExplorerPlayerIds: ['1', '2'],
            deadExplorerPlayerIds: ['0'],
            corpseLootedThisTurnPlayerIds: [],
        });
        expect(deathState.corpses[0]).toMatchObject({
            playerId: '0',
            roomId: 'hallway',
            roomName: '门厅',
            shouldLayTokenFlat: true,
            itemCount: 1,
            omenCount: 1,
            lootedThisTurn: false,
            canBeLootedByCurrentExplorer: true,
            lootableCardIds: ['corpse-item-1', 'corpse-omen-1'],
        });

        const missingCardValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0' }),
        );
        expect(missingCardValidation.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-item-1' });

        const lootedByTeammate = core.currentExplorer.playerId === '1'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
        const corpseAfterLoot = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;

        expect(lootedByTeammate.inventory.length).toBeGreaterThan(1);
        expect(corpseAfterLoot.inventory).toHaveLength(1);
        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('0');
        deathState = resolveBetrayalDeathStateSummary(core);
        expect(deathState.corpses[0]).toMatchObject({
            playerId: '0',
            inventory: [{ id: 'corpse-omen-1', name: '黑暗预兆', kind: 'omen' }],
            itemCount: 0,
            omenCount: 1,
            lootedThisTurn: true,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });

        const secondLootValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-omen-1' }),
        );
        expect(secondLootValidation.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        expect(core.currentPlayer).toBe('1');

        const nextTurnLootValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-omen-1' }),
        );
        expect(nextTurnLootValidation.valid).toBe(true);
    });

    it('搜尸前置态应把真实页面停在可点击正式搜尸动作的运行时', () => {
        const core = createCorpseLootReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.activeRoomId).toBe('hallway');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.recommendedAction).toBe('trade');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.inventory).toHaveLength(2);
    });

    it('杰克之灵复活前置态应停在只差结束当前回合就会复活叛徒的运行时', () => {
        const core = createJackSpiritReviveReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.traitorCorpseRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.jackSpiritHasMovedSinceRelease).toBe(true);
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('basement-east');
    });

    it('叛徒复活后的前置态应停在同房间可直接攻击英雄的运行时', () => {
        const core = createJackSpiritPostReviveAttackReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.activeRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(core.currentExplorer.roomId).toBe('basement-east');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('basement-east');
        expect(core.recommendedAction).toBe('move');
    });

    it('作祟风险按所有玩家当前持有预兆总数派生', () => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.currentExplorer.inventory = [
            { id: 'omen-alpha', name: '预兆A', kind: 'omen' },
            { id: 'item-alpha', name: '物品A', kind: 'item' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                { id: `omen-${index + 1}`, name: `预兆${index + 1}`, kind: 'omen' },
            ],
        }));

        const risk = resolveBetrayalHauntRisk(core);

        expect(resolveBetrayalOmenCount(core)).toBe(3);
        expect(risk.omenCount).toBe(3);
        expect(risk.nextRollDiceCount).toBe(4);
        expect(risk.threshold).toBe(5);
        expect(risk.hauntStarted).toBe(false);

        const riskTrack = resolveBetrayalNumberTracks(core).find((track) => track.id === 'haunt-risk');
        expect(riskTrack).toMatchObject({
            kind: 'haunt-risk',
            label: '作祟风险',
            value: 3,
            min: 0,
            max: 5,
            targetValue: 5,
            currentLabel: '预兆 3',
            targetLabel: '5+ 作祟',
            statusLabel: '下次 4 骰',
            progressPercent: 38,
            source: 'base-rule',
            representativeOnly: false,
        });
    });

    it('抽到新预兆时作祟检定骰数和风险读模型一致', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['omen'];
        core.possessionOrderByKind.omen = [
            { id: 'omen-new', name: '新预兆', kind: 'omen' },
        ];
        core.currentExplorer.inventory = [
            { id: 'omen-alpha', name: '预兆A', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                { id: `omen-${index + 1}`, name: `预兆${index + 1}`, kind: 'omen' },
            ],
        }));
        const riskBeforeDraw = resolveBetrayalHauntRisk(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(riskBeforeDraw.omenCount).toBe(3);
        expect(riskBeforeDraw.nextRollDiceCount).toBe(4);
        expect(core.recentRoll?.kind).toBe('hauntRoll');
        expect(core.recentRoll?.dice).toHaveLength(riskBeforeDraw.nextRollDiceCount);
        expect(core.latestDiscovery?.detail).toContain('4 颗骰子');
    });

    it('作祟检定按全员预兆总数请求骰数，但最多只投 8 颗骰', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['omen'];
        core.possessionOrderByKind.omen = [
            { id: 'omen-new', name: '新预兆', kind: 'omen' },
        ];
        core.currentExplorer.inventory = Array.from({ length: 3 }, (_, index) => ({
            id: `omen-current-${index + 1}`,
            name: `当前预兆${index + 1}`,
            kind: 'omen' as const,
        }));
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, explorerIndex) => ({
            ...explorer,
            inventory: Array.from({ length: 3 }, (_, index) => ({
                id: `omen-${explorerIndex + 1}-${index + 1}`,
                name: `预兆${explorerIndex + 1}-${index + 1}`,
                kind: 'omen' as const,
            })),
        }));
        const riskBeforeDraw = resolveBetrayalHauntRisk(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1, 1, 1, 3, 3),
        );

        expect(riskBeforeDraw.omenCount).toBe(9);
        expect(riskBeforeDraw.requestedRollOmenCount).toBe(9);
        expect(riskBeforeDraw.nextRollDiceCount).toBe(8);
        expect(core.recentRoll?.kind).toBe('hauntRoll');
        expect(core.recentRoll?.dice).toHaveLength(8);
        expect(core.recentRoll?.dice).toEqual(Array.from({ length: 8 }, () => 0));
        expect(core.latestDiscovery?.detail).toContain('8 颗骰子');
    });

    it('普通预兆触发作祟时记录开局剧本卡和触发预兆来源', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['omen'];
        core.possessionOrderByKind.omen = [
            { id: 'omen-crimson-splash', name: 'A Splash of Crimson', kind: 'omen' },
        ];
        core.currentExplorer.inventory = [
            { id: 'omen-alpha', name: '预兆A', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                { id: `omen-${index + 1}`, name: `预兆${index + 1}`, kind: 'omen' },
            ],
        }));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('0');
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'haunt-revealer',
            traitorPlayerId: '0',
            teamModel: 'one-traitor',
            reasonLabel: '作祟揭秘者',
            candidatePlayerIds: ['0'],
            excludedPlayerIds: [],
            representativeOnly: false,
        });
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-traitor',
            anchorPlayerId: '0',
            nextPlayerId: '1',
            reasonLabel: '叛徒左侧玩家先行动',
            representativeOnly: false,
        });
        expect(core.scenarioRuntime.hauntCardNumber).toBe(1);
        expect(core.scenarioRuntime.hauntScenarioCardId).toBe(DEFAULT_BETRAYAL_SCENARIO_CARD_ID);
        expect(core.scenarioRuntime.hauntScenarioCardTitle).toBe('赤红杰克归来');
        expect(core.scenarioRuntime.hauntScenarioCardLabel).toBe('NONE');
        expect(core.scenarioRuntime.triggeringOmenId).toMatch(/^omen-crimson-splash/);
        expect(core.scenarioRuntime.triggeringOmenName).toBe('A Splash of Crimson');
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Splash of Crimson');
        expect(core.scenarioRuntime.hauntResolutionMatchedTrigger).toBe(true);
        expect(core.scenarioRuntime.hauntResolutionRepresentativeOnly).toBe(false);
    });

    it('普通预兆触发作祟后仍保留翻牌确认队列，确认前不能继续行动', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['omen'];
        core.possessionOrderByKind.omen = [
            { id: 'omen-crimson-splash', name: 'A Splash of Crimson', kind: 'omen' },
        ];
        core.currentExplorer.inventory = [
            { id: 'omen-alpha', name: '预兆A', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                { id: `omen-${index + 1}`, name: `预兆${index + 1}`, kind: 'omen' },
            ],
        }));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.pendingCardResolutionQueue).toHaveLength(2);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'omen',
            cardName: 'A Splash of Crimson',
            stepKind: 'drawn-card',
            index: 1,
            total: 2,
        });
        expect(core.pendingCardResolutionQueue[1]).toMatchObject({
            deckKind: 'omen',
            cardName: 'A Splash of Crimson',
            stepKind: 'haunt-roll',
            index: 2,
            total: 2,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, core.currentPlayer, {
                roomId: 'hallway',
            }),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            stepKind: 'haunt-roll',
            index: 2,
            total: 2,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
    });
});
