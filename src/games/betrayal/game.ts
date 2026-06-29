import { createBaseSystems, createGameEngine } from '../../engine';
import { registerCriticalImageResolver } from '../../core';
import type {
    Command,
    DomainCore,
    GameEvent,
    MatchState,
    PlayerId,
    RandomFn,
    ValidationResult,
} from '../../engine/types';
import { betrayalCriticalImageResolver } from './criticalImageResolver';
import {
    BETRAYAL_DISCOVERY_POOLS,
    BETRAYAL_EXPLORER_CATALOG,
    BETRAYAL_SCENARIO_CONFIGS,
    BETRAYAL_SHARED_PRE_HAUNT_SETUP,
    DEFAULT_BETRAYAL_SCENARIO_ID,
    type BetrayalDeckKind as ConfigDeckKind,
    type BetrayalRoomDoorway,
    type BetrayalRoomEdge,
    type BetrayalRoomFloor,
    type BetrayalRoomVisualId,
    type BetrayalEventSeed,
    type BetrayalInventoryKind as ConfigInventoryKind,
    type BetrayalInventorySeed,
    type BetrayalMonsterSeed,
    type BetrayalRecommendedAction as ConfigRecommendedAction,
    type BetrayalRoomDiscoveryTemplate,
    type BetrayalRoomSeed,
    type BetrayalScenarioId,
    type BetrayalScenarioOutcome,
    type BetrayalTraitKey as ConfigTraitKey,
    type BetrayalTraitorSelectionPolicy,
    type BetrayalUseEffectSeed,
    type BetrayalSurvivorSelectionPolicy,
} from './scenarioConfig';

export type BetrayalTraitKey = ConfigTraitKey;
export type BetrayalInventoryKind = ConfigInventoryKind;
export type BetrayalDeckKind = ConfigDeckKind;
export type { BetrayalRoomEdge, BetrayalRoomVisualId, BetrayalRoomFloor };
export type BetrayalPhase = 'characterSelect' | 'preHaunt' | 'haunt' | 'endgame';
export type BetrayalRecommendedAction = ConfigRecommendedAction;

export interface BetrayalInventoryCard {
    id: string;
    name: string;
    kind: BetrayalInventoryKind;
}

export interface BetrayalExplorerTemplate {
    explorerId: string;
    displayName: string;
    portraitAsset: string;
    tokenAsset?: string;
    color: string;
    traits: Record<BetrayalTraitKey, number>;
    abilityName: string;
    abilityText: string;
}

export interface BetrayalExplorerSummary {
    playerId: string;
    explorerId: string;
    displayName: string;
    portraitAsset: string;
    tokenAsset?: string;
    roomId: string;
    traits: Record<BetrayalTraitKey, number>;
    inventory: BetrayalInventoryCard[];
}

export interface BetrayalMonsterSummary {
    id: string;
    name: string;
    portraitAsset: string;
    tokenAsset?: string;
    roomId: string;
    might: number;
    speed: number;
    damage: number;
}

export interface BetrayalRoomNode {
    id: string;
    name: string;
    floor: BetrayalRoomFloor;
    x: number;
    y: number;
    connectedRoomIds: string[];
    state: 'discovered' | 'unexplored';
    startingTile?: boolean;
    hint: string;
    tags: string[];
    discoveryReward: BetrayalDeckKind | null;
    visualId: BetrayalRoomVisualId;
    doorways: BetrayalRoomDoorway[];
    backVisualId: Extract<BetrayalRoomVisualId, 'backUpper' | 'backGround' | 'backBasement'>;
}

export interface BetrayalDiscoverySummary {
    kind: BetrayalDeckKind;
    title: string;
    summary: string;
    detail: string;
    tone: 'neutral' | 'accent' | 'warning';
}

export interface BetrayalActivityEntry {
    id: string;
    text: string;
    tone: BetrayalDiscoverySummary['tone'];
}

export interface BetrayalEndgameResult {
    hauntId: 'crimson-jack-returns';
    hauntTitle: string;
    outcome: BetrayalScenarioOutcome;
    winners: string[];
    traitorPlayerId: string;
    survivorsEscaped: string[];
    reward: {
        stars: number;
        omens: number;
        logs: number;
    };
    stats: {
        roomsExplored: number;
        omensDrawn: number;
        itemsDrawn: number;
        eventsDrawn: number;
    };
}

export interface BetrayalScenarioRuntimeStatus {
    hauntTriggered: boolean;
    hauntRevealerPlayerId: string | null;
    traitorPlayerId: string | null;
    nextHauntPlayerId: string | null;
    hauntRollThreshold: number;
    omensDiscovered: number;
    hauntTriggerLabel: string | null;
    jackSpiritReleased: boolean;
    jackSpiritRoomId: string | null;
    exorcismCircleRoomIds: string[];
    knowledgeOfJackPlayerIds: string[];
    deadExplorerPlayerIds: string[];
    traitorCorpseRoomId: string | null;
}

export interface BetrayalCore {
    scenarioId: BetrayalScenarioId;
    phase: BetrayalPhase;
    playerIds: string[];
    selectedExplorerByPlayerId: Record<string, string>;
    readyPlayerIds: string[];
    currentPlayer: string;
    movesRemaining: number;
    recommendedAction: BetrayalRecommendedAction;
    activeRoomId: string;
    currentExplorer: BetrayalExplorerSummary;
    currentExplorerTraits: Record<BetrayalTraitKey, number>;
    currentExplorerInventory: BetrayalInventoryCard[];
    otherExplorers: BetrayalExplorerSummary[];
    monsters: BetrayalMonsterSummary[];
    deckCounts: Record<BetrayalDeckKind, number>;
    discardCounts: Record<BetrayalDeckKind, number>;
    rooms: BetrayalRoomNode[];
    exploreIndex: number;
    usedCardIdsThisTurn: string[];
    latestDiscovery: BetrayalDiscoverySummary | null;
    latestDiscoveryOwnerPlayerId: string | null;
    highlightedDeckKind: BetrayalDeckKind | null;
    activityLog: BetrayalActivityEntry[];
    scenarioRuntime: BetrayalScenarioRuntimeStatus;
    endgameResult: BetrayalEndgameResult | null;
}

export const BETRAYAL_COMMANDS = {
    SELECT_EXPLORER: 'SELECT_EXPLORER',
    CONFIRM_EXPLORER: 'CONFIRM_EXPLORER',
    START_SCENARIO: 'START_SCENARIO',
    MOVE_TO_ROOM: 'MOVE_TO_ROOM',
    EXPLORE_ROOM: 'EXPLORE_ROOM',
    USE_POSSESSION: 'USE_POSSESSION',
    TRADE_POSSESSION: 'TRADE_POSSESSION',
    END_TURN: 'END_TURN',
    HAUNT_ATTACK: 'HAUNT_ATTACK',
    LEARN_ABOUT_JACK: 'LEARN_ABOUT_JACK',
    STUDY_EXORCISM: 'STUDY_EXORCISM',
    EXORCISE_JACK: 'EXORCISE_JACK',
    COMPLETE_SCENARIO: 'COMPLETE_SCENARIO',
} as const;

export type BetrayalCommandType = typeof BETRAYAL_COMMANDS[keyof typeof BETRAYAL_COMMANDS];

export const BETRAYAL_INITIAL_DECK_COUNTS: Record<BetrayalDeckKind, number> = {
    ...BETRAYAL_SHARED_PRE_HAUNT_SETUP.initialDeckCounts,
};

export type BetrayalCommandMap = {
    [BETRAYAL_COMMANDS.SELECT_EXPLORER]: { explorerId: string };
    [BETRAYAL_COMMANDS.CONFIRM_EXPLORER]: Record<string, never>;
    [BETRAYAL_COMMANDS.START_SCENARIO]: { scenarioId?: BetrayalScenarioId };
    [BETRAYAL_COMMANDS.MOVE_TO_ROOM]: { roomId: string };
    [BETRAYAL_COMMANDS.EXPLORE_ROOM]: { roomId?: string };
    [BETRAYAL_COMMANDS.USE_POSSESSION]: { cardId?: string };
    [BETRAYAL_COMMANDS.TRADE_POSSESSION]: { cardId?: string; targetPlayerId?: string };
    [BETRAYAL_COMMANDS.END_TURN]: Record<string, never>;
    [BETRAYAL_COMMANDS.HAUNT_ATTACK]: { target: 'traitor' | 'hero' | 'jack-spirit' };
    [BETRAYAL_COMMANDS.LEARN_ABOUT_JACK]: Record<string, never>;
    [BETRAYAL_COMMANDS.STUDY_EXORCISM]: Record<string, never>;
    [BETRAYAL_COMMANDS.EXORCISE_JACK]: Record<string, never>;
    [BETRAYAL_COMMANDS.COMPLETE_SCENARIO]: Record<string, never>;
};

export type BetrayalCommand = {
    [Type in keyof BetrayalCommandMap]: Command<Type & string, BetrayalCommandMap[Type]>
}[keyof BetrayalCommandMap];

const EVENTS = {
    EXPLORER_SELECTED: 'EXPLORER_SELECTED',
    EXPLORER_CONFIRMED: 'EXPLORER_CONFIRMED',
    SCENARIO_STARTED: 'SCENARIO_STARTED',
    EXPLORER_MOVED: 'EXPLORER_MOVED',
    ROOM_EXPLORED: 'ROOM_EXPLORED',
    POSSESSION_USED: 'POSSESSION_USED',
    POSSESSION_TRADED: 'POSSESSION_TRADED',
    TURN_ENDED: 'TURN_ENDED',
    HAUNT_TRIGGERED: 'HAUNT_TRIGGERED',
    HAUNT_ATTACK_RESOLVED: 'HAUNT_ATTACK_RESOLVED',
    JACK_LEARNED: 'JACK_LEARNED',
    EXORCISM_STUDIED: 'EXORCISM_STUDIED',
    JACK_EXORCISED: 'JACK_EXORCISED',
    SCENARIO_COMPLETED: 'SCENARIO_COMPLETED',
} as const;

type BetrayalEvent =
    | GameEvent<typeof EVENTS.EXPLORER_SELECTED, { playerId: string; explorerId: string }>
    | GameEvent<typeof EVENTS.EXPLORER_CONFIRMED, { playerId: string }>
    | GameEvent<typeof EVENTS.SCENARIO_STARTED, { playerIds: string[]; scenarioId: BetrayalScenarioId }>
    | GameEvent<typeof EVENTS.EXPLORER_MOVED, { playerId: string; roomId: string; logText: string }>
    | GameEvent<typeof EVENTS.ROOM_EXPLORED, {
        playerId: string;
        roomId: string;
        room: Pick<BetrayalRoomNode, 'name' | 'hint' | 'tags' | 'discoveryReward' | 'visualId' | 'doorways' | 'backVisualId'>;
        deckKind: BetrayalDeckKind;
        drawnCard?: BetrayalInventoryCard;
        eventEffect?: UseEffectProfile;
        discovery: BetrayalDiscoverySummary;
        logText: string;
        hauntTriggered?: boolean;
    }>
    | GameEvent<typeof EVENTS.POSSESSION_USED, { playerId: string; cardId: string; effect: UseEffectProfile; logText: string }>
    | GameEvent<typeof EVENTS.POSSESSION_TRADED, { playerId: string; targetPlayerId: string; cardId: string; logText: string }>
    | GameEvent<typeof EVENTS.TURN_ENDED, { previousPlayerId: string; nextPlayerId: string; logText: string }>
    | GameEvent<typeof EVENTS.HAUNT_TRIGGERED, {
        traitorPlayerId: string;
        nextPlayerId: string;
        hauntTriggerLabel: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HAUNT_ATTACK_RESOLVED, {
        attackerPlayerId: string;
        target: 'traitor' | 'hero' | 'jack-spirit';
        defeatedPlayerId?: string;
        releasedJackSpiritRoomId?: string;
        outcome: 'wound' | 'traitor-defeated' | 'hero-defeated' | 'jack-damaged';
        attackerRoll?: number;
        defenderRoll?: number;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.JACK_LEARNED, {
        playerId: string;
        grantedToPlayerId: string | null;
        rollTotal: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.EXORCISM_STUDIED, {
        playerId: string;
        roomId: string;
        rollTotal: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.JACK_EXORCISED, {
        playerId: string;
        roomId: string;
        rollTotal: number;
        regionBonus: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.SCENARIO_COMPLETED, { result: BetrayalEndgameResult }>;

export const EXPLORER_CATALOG: BetrayalExplorerTemplate[] = BETRAYAL_EXPLORER_CATALOG.map((entry) => ({ ...entry }));

type RoomTemplate = BetrayalRoomDiscoveryTemplate;

type UseEffectProfile = BetrayalUseEffectSeed;

type EventTemplate = BetrayalEventSeed;

const DRAW_ORDER: BetrayalDeckKind[] = [...BETRAYAL_DISCOVERY_POOLS.drawOrder];

const DRAW_POOL: Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]> = {
    item: BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => ({ ...card })),
    omen: BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => ({ ...card })),
};

const ROOM_DISCOVERY_POOL: Record<BetrayalRoomNode['floor'], RoomTemplate[]> = {
    ground: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.map((room) => ({ ...room, tags: [...room.tags] })),
    upper: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.map((room) => ({ ...room, tags: [...room.tags] })),
    basement: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.map((room) => ({ ...room, tags: [...room.tags] })),
};

const USE_EFFECTS: Record<string, UseEffectProfile> = {
    'holy-medallion': { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    flashlight: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    'dark-omen': { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    'omen-book': { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    rope: { mode: 'move', amount: 1, recommendedAction: 'move' },
    notebook: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    ring: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    'medical-kit': { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    camera: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    mask: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    dog: { mode: 'move', amount: 1, recommendedAction: 'move' },
    skull: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    'holy-symbol': { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    dagger: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
    armor: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
    idol: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    map: { mode: 'move', amount: 1, recommendedAction: 'move' },
    lantern: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'move' },
    journal: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    radio: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'move' },
    'holy-water': { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    cross: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
    'lockpick-tool': { mode: 'move', amount: 1, recommendedAction: 'move' },
    matches: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'move' },
    'hunting-knife': { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
    manuscript: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
};

const EVENT_POOL: EventTemplate[] = BETRAYAL_DISCOVERY_POOLS.events.map((event) => ({
    ...event,
    effect: { ...event.effect },
}));

const TRAIT_LABEL: Record<BetrayalTraitKey, string> = {
    might: '力量',
    speed: '速度',
    knowledge: '知识',
    sanity: '神志',
};

const nowEvent = <TType extends string, TPayload>(
    type: TType,
    payload: TPayload,
    timestamp: number,
): GameEvent<TType, TPayload> => ({
    type,
    payload,
    timestamp,
});

function cloneInventoryCard(card: BetrayalInventoryCard): BetrayalInventoryCard {
    return { ...card };
}

function countDrawnCards(core: BetrayalCore, kind: BetrayalDeckKind): number {
    return Math.max(0, BETRAYAL_INITIAL_DECK_COUNTS[kind] - core.deckCounts[kind]);
}

function cloneRoom(room: BetrayalRoomNode): BetrayalRoomNode {
    return {
        ...room,
        connectedRoomIds: [...room.connectedRoomIds],
        tags: [...room.tags],
        doorways: room.doorways.map((doorway) => ({ ...doorway })),
    };
}

function cloneExplorer(explorer: BetrayalExplorerSummary): BetrayalExplorerSummary {
    return {
        ...explorer,
        traits: { ...explorer.traits },
        inventory: explorer.inventory.map(cloneInventoryCard),
    };
}

function cloneMonster(monster: BetrayalMonsterSummary): BetrayalMonsterSummary {
    return { ...monster };
}

function cloneMonsterSeed(monster: BetrayalMonsterSeed): BetrayalMonsterSummary {
    return { ...monster };
}

function cloneInventorySeed(card: BetrayalInventorySeed): BetrayalInventoryCard {
    return { ...card };
}

function createExplorer(
    playerId: string,
    template: BetrayalExplorerTemplate,
    roomId: string,
    inventory: BetrayalInventorySeed[],
): BetrayalExplorerSummary {
    return {
        playerId,
        explorerId: template.explorerId,
        displayName: template.displayName,
        portraitAsset: template.portraitAsset,
        tokenAsset: template.tokenAsset,
        roomId,
        traits: { ...template.traits },
        inventory: inventory.map(cloneInventorySeed),
    };
}

function cloneCore(core: BetrayalCore): BetrayalCore {
    return {
        ...core,
        playerIds: [...core.playerIds],
        selectedExplorerByPlayerId: { ...core.selectedExplorerByPlayerId },
        readyPlayerIds: [...core.readyPlayerIds],
        currentExplorer: cloneExplorer(core.currentExplorer),
        currentExplorerTraits: { ...core.currentExplorerTraits },
        currentExplorerInventory: core.currentExplorerInventory.map(cloneInventoryCard),
        otherExplorers: core.otherExplorers.map(cloneExplorer),
        monsters: core.monsters.map(cloneMonster),
        deckCounts: { ...core.deckCounts },
        discardCounts: { ...core.discardCounts },
        rooms: core.rooms.map(cloneRoom),
        usedCardIdsThisTurn: [...core.usedCardIdsThisTurn],
        latestDiscovery: core.latestDiscovery ? { ...core.latestDiscovery } : null,
        activityLog: core.activityLog.map((entry) => ({ ...entry })),
        scenarioRuntime: {
            ...core.scenarioRuntime,
            exorcismCircleRoomIds: [...core.scenarioRuntime.exorcismCircleRoomIds],
            knowledgeOfJackPlayerIds: [...core.scenarioRuntime.knowledgeOfJackPlayerIds],
            deadExplorerPlayerIds: [...core.scenarioRuntime.deadExplorerPlayerIds],
        },
        endgameResult: core.endgameResult ? {
            ...core.endgameResult,
            winners: [...core.endgameResult.winners],
            survivorsEscaped: [...core.endgameResult.survivorsEscaped],
            reward: { ...core.endgameResult.reward },
            stats: { ...core.endgameResult.stats },
        } : null,
    };
}

function syncCurrentExplorerProjection(core: BetrayalCore): BetrayalCore {
    return {
        ...core,
        currentPlayer: core.currentExplorer.playerId,
        activeRoomId: core.currentExplorer.roomId,
        currentExplorerTraits: { ...core.currentExplorer.traits },
        currentExplorerInventory: core.currentExplorer.inventory.map(cloneInventoryCard),
    };
}

function createInitialScenarioRuntimeStatus(): BetrayalScenarioRuntimeStatus {
    return {
        hauntTriggered: false,
        hauntRevealerPlayerId: null,
        traitorPlayerId: null,
        nextHauntPlayerId: null,
        hauntRollThreshold: 5,
        omensDiscovered: 0,
        hauntTriggerLabel: null,
        jackSpiritReleased: false,
        jackSpiritRoomId: null,
        exorcismCircleRoomIds: [],
        knowledgeOfJackPlayerIds: [],
        deadExplorerPlayerIds: [],
        traitorCorpseRoomId: null,
    };
}

function appendActivity(core: BetrayalCore, text: string, tone: BetrayalActivityEntry['tone']): BetrayalActivityEntry[] {
    return [
        { id: `${core.exploreIndex}-${core.activityLog.length}-${text}`, text, tone },
        ...core.activityLog,
    ].slice(0, 6);
}

function normalizePlayerIds(playerIds: string[]): string[] {
    return playerIds.length >= 3 ? playerIds.map(String) : ['0', '1', '2', '3'];
}

function roomSeedToNode(room: BetrayalRoomSeed): BetrayalRoomNode {
    return {
        ...room,
        connectedRoomIds: [...room.connectedRoomIds],
        tags: [...room.tags],
        doorways: room.doorways.map((doorway) => ({ ...doorway })),
    };
}

function scenarioConfigById(scenarioId: BetrayalScenarioId) {
    return BETRAYAL_SCENARIO_CONFIGS[scenarioId];
}

function scenarioInventoryForExplorer(scenarioId: BetrayalScenarioId, explorerId: string): BetrayalInventorySeed[] {
    return scenarioConfigById(scenarioId).startingInventoryByExplorerId[explorerId]?.map(cloneInventorySeed) ?? [];
}

export function getBetrayalScenarioConfig(scenarioId: BetrayalScenarioId) {
    return scenarioConfigById(scenarioId);
}

function buildRepresentativeRuntimeExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    const representativeRoomIds = ['grand-staircase', 'upper-landing', 'basement-landing', 'entrance-hall', 'upper-landing', 'entrance-hall'];
    return core.playerIds.map((playerId, index) => {
        const template = EXPLORER_CATALOG[index % EXPLORER_CATALOG.length]!;
        return createExplorer(
            playerId,
            template,
            representativeRoomIds[index % representativeRoomIds.length]!,
            scenarioInventoryForExplorer(core.scenarioId, template.explorerId),
        );
    });
}

function makeBaseCore(playerIds: string[], phase: BetrayalPhase): BetrayalCore {
    const normalizedPlayerIds = normalizePlayerIds(playerIds);
    const scenarioId = DEFAULT_BETRAYAL_SCENARIO_ID;
    const rooms = BETRAYAL_SHARED_PRE_HAUNT_SETUP.startingRoomLayout.map(roomSeedToNode);
    const currentExplorer = createExplorer(
        normalizedPlayerIds[0]!,
        EXPLORER_CATALOG[0]!,
        BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
        scenarioInventoryForExplorer(scenarioId, EXPLORER_CATALOG[0]!.explorerId),
    );
    const otherExplorers = normalizedPlayerIds.slice(1).map((playerId, index) => (
        createExplorer(
            playerId,
            EXPLORER_CATALOG[(index + 1) % EXPLORER_CATALOG.length]!,
            BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
            scenarioInventoryForExplorer(
                scenarioId,
                EXPLORER_CATALOG[(index + 1) % EXPLORER_CATALOG.length]!.explorerId,
            ),
        )
    ));

    return syncCurrentExplorerProjection({
        scenarioId,
        phase,
        playerIds: normalizedPlayerIds,
        selectedExplorerByPlayerId: {},
        readyPlayerIds: [],
        currentPlayer: currentExplorer.playerId,
        movesRemaining: 3,
        recommendedAction: 'explore',
        activeRoomId: currentExplorer.roomId,
        currentExplorer,
        currentExplorerTraits: { ...currentExplorer.traits },
        currentExplorerInventory: currentExplorer.inventory.map(cloneInventoryCard),
        otherExplorers,
        monsters: [],
        deckCounts: { ...BETRAYAL_INITIAL_DECK_COUNTS },
        discardCounts: { omen: 0, item: 0, event: 0 },
        rooms,
        exploreIndex: 0,
        usedCardIdsThisTurn: [],
        latestDiscovery: null,
        latestDiscoveryOwnerPlayerId: null,
        highlightedDeckKind: null,
        activityLog: [],
        scenarioRuntime: createInitialScenarioRuntimeStatus(),
        endgameResult: null,
    });
}

export function createBetrayalCharacterSelectCore(playerIds: string[] = ['0', '1', '2', '3']): BetrayalCore {
    return makeBaseCore(playerIds, 'characterSelect');
}

export function createBetrayalFoundationCore(playerIds: string[] = ['0', '1', '2', '3']): BetrayalCore {
    const core = makeBaseCore(playerIds, 'preHaunt');
    return replaceExplorers(core, buildRepresentativeRuntimeExplorers(core), core.playerIds[0]);
}

export function createBetrayalMonsterEncounterCore(playerIds: string[] = ['0', '1', '2', '3']): BetrayalCore {
    const core = createBetrayalFoundationCore(playerIds);
    const previewMonsters = scenarioConfigById(core.scenarioId).runtimePreview?.monsters ?? [];
    return {
        ...core,
        monsters: previewMonsters.map(cloneMonsterSeed),
    };
}

function templateByExplorerId(explorerId: string): BetrayalExplorerTemplate | undefined {
    return EXPLORER_CATALOG.find((template) => template.explorerId === explorerId);
}

function getAllExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    return [core.currentExplorer, ...core.otherExplorers];
}

function getExplorersInTurnOrder(core: BetrayalCore): BetrayalExplorerSummary[] {
    const explorerByPlayerId = new Map(getAllExplorers(core).map((explorer) => [explorer.playerId, explorer]));
    return core.playerIds
        .map((playerId) => explorerByPlayerId.get(playerId))
        .filter((explorer): explorer is BetrayalExplorerSummary => Boolean(explorer));
}

function resolveScenarioTraitor(
    explorers: BetrayalExplorerSummary[],
    fallback: BetrayalExplorerSummary,
    policy: BetrayalTraitorSelectionPolicy,
): BetrayalExplorerSummary {
    switch (policy) {
        case 'current-explorer':
            return explorers.find((explorer) => explorer.playerId === fallback.playerId) ?? fallback;
        case 'last-explorer':
        default:
            return explorers[explorers.length - 1] ?? fallback;
    }
}

function resolveScenarioSurvivors(
    explorers: BetrayalExplorerSummary[],
    traitor: BetrayalExplorerSummary,
    policy: BetrayalSurvivorSelectionPolicy,
): BetrayalExplorerSummary[] {
    switch (policy) {
        case 'current-explorer-only':
            return explorers.filter((explorer) => explorer.playerId === explorers[0]?.playerId);
        case 'all-non-traitor':
        default:
            return explorers.filter((explorer) => explorer.playerId !== traitor.playerId);
    }
}

function replaceExplorers(
    core: BetrayalCore,
    explorers: BetrayalExplorerSummary[],
    nextCurrentPlayerId = core.currentPlayer,
): BetrayalCore {
    const nextCurrent = explorers.find((explorer) => explorer.playerId === nextCurrentPlayerId) ?? explorers[0] ?? core.currentExplorer;
    const nextOthers = explorers.filter((explorer) => explorer.playerId !== nextCurrent.playerId);
    return syncCurrentExplorerProjection({
        ...core,
        currentExplorer: cloneExplorer(nextCurrent),
        otherExplorers: nextOthers.map(cloneExplorer),
    });
}

function buildScenarioExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.playerIds.map((playerId, index) => {
        const selectedExplorerId = core.selectedExplorerByPlayerId[playerId];
        const template = templateByExplorerId(selectedExplorerId ?? '') ?? EXPLORER_CATALOG[index % EXPLORER_CATALOG.length]!;
        return createExplorer(
            playerId,
            template,
            BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
            scenarioInventoryForExplorer(core.scenarioId, template.explorerId),
        );
    });
}

function findExplorerByPlayerId(core: BetrayalCore, playerId: string): BetrayalExplorerSummary | null {
    return getAllExplorers(core).find((explorer) => explorer.playerId === playerId) ?? null;
}

function healExplorerToTemplate(explorer: BetrayalExplorerSummary): void {
    const template = templateByExplorerId(explorer.explorerId);
    if (!template) {
        return;
    }
    explorer.traits = { ...template.traits };
}

function shouldDeadTraitorControlJackSpirit(core: BetrayalCore, playerId: string): boolean {
    return (
        core.scenarioRuntime.traitorPlayerId === playerId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
        && core.scenarioRuntime.jackSpiritReleased
        && Boolean(core.scenarioRuntime.jackSpiritRoomId)
    );
}

function rotateToNextLivingPlayer(core: BetrayalCore, currentPlayerId: string): string {
    const turnEligibleExplorers = getExplorersInTurnOrder(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        || shouldDeadTraitorControlJackSpirit(core, explorer.playerId)
    ));
    if (turnEligibleExplorers.length === 0) {
        return currentPlayerId;
    }
    const currentIndex = turnEligibleExplorers.findIndex((explorer) => explorer.playerId === currentPlayerId);
    const nextExplorer = turnEligibleExplorers[(currentIndex + 1 + turnEligibleExplorers.length) % turnEligibleExplorers.length]
        ?? turnEligibleExplorers[0]!;
    return nextExplorer.playerId;
}

function ensureLibraryPresent(core: BetrayalCore): void {
    const existingLibrary = core.rooms.find((room) => room.name === '图书馆');
    if (existingLibrary) {
        return;
    }
    const upperWest = core.rooms.find((room) => room.id === 'upper-west');
    if (upperWest) {
        upperWest.name = '图书馆';
        upperWest.hint = '翻找旧案、了解 Crimson Jack 的最佳地点';
        upperWest.tags = ['知识', '调查', '图书馆'];
        upperWest.state = 'discovered';
        upperWest.discoveryReward = null;
    }
}

function resolveHauntRollTotal(core: BetrayalCore): number {
    return Math.max(0, getAllExplorers(core).reduce((total, explorer) => (
        total + explorer.inventory.filter((item) => item.kind === 'omen').length
    ), 0));
}

function rollTrait(random: RandomFn, value: number): number {
    let total = 0;
    for (let index = 0; index < Math.max(0, value); index += 1) {
        total += rollBetrayalPip(random);
    }
    return total;
}

function applyTraitLoss(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
    amount: number,
): void {
    let remaining = Math.max(0, amount);
    for (let index = 0; index < traits.length && remaining > 0; index += 1) {
        const trait = traits[index]!;
        const current = explorer.traits[trait];
        const reducible = Math.max(0, current - 1);
        if (reducible <= 0) {
            continue;
        }
        const delta = Math.min(reducible, remaining);
        explorer.traits[trait] -= delta;
        remaining -= delta;
    }
}

function applyPhysicalDamage(explorer: BetrayalExplorerSummary, amount: number): void {
    applyTraitLoss(explorer, ['might', 'speed'], amount);
}

function applyMentalDamage(explorer: BetrayalExplorerSummary, amount: number): void {
    applyTraitLoss(explorer, ['knowledge', 'sanity'], amount);
}

function isExplorerDead(explorer: BetrayalExplorerSummary): boolean {
    return (
        explorer.traits.might <= 1
        || explorer.traits.speed <= 1
        || explorer.traits.knowledge <= 1
        || explorer.traits.sanity <= 1
    );
}

function markDeadExplorer(core: BetrayalCore, playerId: string): void {
    if (core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)) {
        return;
    }
    core.scenarioRuntime.deadExplorerPlayerIds = [
        ...core.scenarioRuntime.deadExplorerPlayerIds,
        playerId,
    ];
}

function resolveRoomRegion(room: BetrayalRoomNode | undefined): BetrayalRoomFloor | null {
    return room?.floor ?? null;
}

function countExorcismCirclesInRegion(core: BetrayalCore, roomId: string): number {
    const currentRoom = core.rooms.find((room) => room.id === roomId);
    const region = resolveRoomRegion(currentRoom);
    if (!region) {
        return 0;
    }
    return core.scenarioRuntime.exorcismCircleRoomIds.filter((circleRoomId) => {
        const circleRoom = core.rooms.find((room) => room.id === circleRoomId);
        return resolveRoomRegion(circleRoom) === region;
    }).length;
}

function resolveConnectedRoomIds(rooms: BetrayalRoomNode[], roomId: string): Set<string> {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) {
        return new Set();
    }
    return new Set(
        room.doorways
            .map((doorway) => doorway.connectsToRoomId)
            .filter((targetRoomId): targetRoomId is string => Boolean(targetRoomId)),
    );
}

function roomDistanceByLayout(a: BetrayalRoomNode, b: BetrayalRoomNode): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function resolveJackSpiritSpawnRoomId(core: BetrayalCore, corpseRoomId: string): string {
    const corpseRoom = core.rooms.find((room) => room.id === corpseRoomId);
    const discoveredRooms = core.rooms.filter((room) => room.state === 'discovered');
    const omenRooms = discoveredRooms.filter((room) => room.discoveryReward === 'omen');
    const candidateRooms = omenRooms.length > 0 ? omenRooms : discoveredRooms;

    if (!corpseRoom || candidateRooms.length === 0) {
        return corpseRoomId;
    }

    const sortedCandidates = [...candidateRooms].sort((left, right) => {
        const distanceDelta = roomDistanceByLayout(right, corpseRoom) - roomDistanceByLayout(left, corpseRoom);
        if (distanceDelta !== 0) {
            return distanceDelta;
        }
        return left.id.localeCompare(right.id);
    });

    return sortedCandidates[0]?.id ?? corpseRoomId;
}

function isStraightLineVisible(a: BetrayalRoomNode, b: BetrayalRoomNode, rooms: BetrayalRoomNode[]): boolean {
    if (a.floor !== b.floor) {
        return false;
    }
    if (a.x !== b.x && a.y !== b.y) {
        return false;
    }
    const candidates = rooms.filter((room) => room.floor === a.floor && room.state === 'discovered');
    if (a.x === b.x) {
        const [start, end] = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
        for (let y = start; y <= end; y += 1) {
            if (!candidates.some((room) => room.x === a.x && room.y === y)) {
                return false;
            }
        }
        return true;
    }
    const [start, end] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
    for (let x = start; x <= end; x += 1) {
        if (!candidates.some((room) => room.x === x && room.y === a.y)) {
            return false;
        }
    }
    return true;
}

function rollBetrayalPip(random: RandomFn): number {
    return Math.max(0, Math.min(2, random.d(3) - 1));
}

function shouldTriggerHaunt(
    core: BetrayalCore,
    event: Extract<BetrayalEvent, { type: typeof EVENTS.ROOM_EXPLORED }>,
    random: RandomFn,
): boolean {
    if (core.phase !== 'preHaunt' || core.scenarioRuntime.hauntTriggered || event.payload.deckKind !== 'omen') {
        return false;
    }
    if (core.deckCounts.omen <= 1) {
        return true;
    }
    const omenCountAfterDraw = resolveHauntRollTotal(core) + 1;
    let hauntRollTotal = 0;
    for (let index = 0; index < omenCountAfterDraw; index += 1) {
        hauntRollTotal += rollBetrayalPip(random);
    }
    return hauntRollTotal >= core.scenarioRuntime.hauntRollThreshold;
}

export function resolveMoveTargetRooms(core: BetrayalCore): BetrayalRoomNode[] {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return [];
    }
    const connectedIds = resolveConnectedRoomIds(core.rooms, activeRoom.id);
    return core.rooms.filter((room) => room.state === 'discovered' && connectedIds.has(room.id));
}

export function resolveNextExplorableRoomSlot(core: BetrayalCore): BetrayalRoomNode | null {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return null;
    }
    const connectedIds = resolveConnectedRoomIds(core.rooms, activeRoom.id);
    return core.rooms.find((room) => room.state === 'unexplored' && connectedIds.has(room.id)) ?? null;
}

export function resolveExplorableRoomSlots(core: BetrayalCore): BetrayalRoomNode[] {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return [];
    }
    const connectedIds = resolveConnectedRoomIds(core.rooms, activeRoom.id);
    return core.rooms.filter((room) => room.state === 'unexplored' && connectedIds.has(room.id));
}

export function resolveTradeTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.otherExplorers.filter((explorer) => explorer.roomId === core.activeRoomId);
}

function formatRoomTargetList(rooms: BetrayalRoomNode[]): string {
    return Array.from(new Set(rooms.map((room) => room.name))).join(' / ');
}

function resolveNextDeckKind(core: BetrayalCore): BetrayalDeckKind | null {
    for (let index = 0; index < DRAW_ORDER.length; index += 1) {
        const kind = DRAW_ORDER[(core.exploreIndex + index) % DRAW_ORDER.length]!;
        if (core.deckCounts[kind] > 0) {
            return kind;
        }
    }
    return null;
}

function resolveRoomTemplate(core: BetrayalCore, floor: BetrayalRoomNode['floor']): RoomTemplate {
    const pool = ROOM_DISCOVERY_POOL[floor];
    const discoveredCount = core.rooms.filter((room) => room.floor === floor && room.state === 'discovered' && !room.startingTile).length;
    return pool[(core.exploreIndex + discoveredCount) % pool.length]!;
}

function createDrawnCard(kind: Exclude<BetrayalDeckKind, 'event'>, exploreIndex: number): BetrayalInventoryCard {
    const template = DRAW_POOL[kind][exploreIndex % DRAW_POOL[kind].length]!;
    return {
        id: `${template.id}-${exploreIndex}`,
        name: template.name,
        kind: template.kind,
    };
}

function resolveEvent(index: number): EventTemplate {
    return EVENT_POOL[index % EVENT_POOL.length]!;
}

function resolveUseEffect(card: BetrayalInventoryCard): UseEffectProfile {
    return USE_EFFECTS[card.id.replace(/-\d+$/, '')] ?? { mode: 'move', amount: 1, recommendedAction: 'move' };
}

function formatEffectLabel(effect: UseEffectProfile): string {
    if (effect.mode === 'move') {
        return `移动 ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
    }
    return `${TRAIT_LABEL[effect.trait!]} ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
}

function resolveRecommendedAction(core: BetrayalCore, options: { preferUse?: boolean; cardId?: string } = {}): BetrayalRecommendedAction {
    if (core.phase === 'haunt') {
        if (core.scenarioRuntime.jackSpiritReleased && core.scenarioRuntime.jackSpiritRoomId === core.currentExplorer.roomId) {
            return core.scenarioRuntime.exorcismCircleRoomIds.length >= 2 ? 'use' : 'move';
        }
        if (
            core.currentExplorer.roomId === 'upper-west'
            && !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(core.currentExplorer.playerId)
        ) {
            return 'use';
        }
        if (core.rooms.find((room) => room.id === core.currentExplorer.roomId)?.discoveryReward === 'event') {
            return 'use';
        }
    }

    const canMove = core.movesRemaining > 0 && resolveMoveTargetRooms(core).length > 0;
    const canExplore = Boolean(resolveNextExplorableRoomSlot(core) && resolveNextDeckKind(core));
    const canTrade = core.currentExplorer.inventory.length > 0 && resolveTradeTargets(core).length > 0;
    const cardId = options.cardId ?? core.currentExplorer.inventory[0]?.id;
    const canUse = Boolean(cardId && !core.usedCardIdsThisTurn.includes(cardId));

    if (options.preferUse && canUse) return 'use';
    if (canMove) return 'move';
    if (canExplore) return 'explore';
    if (canTrade) return 'trade';
    if (canUse) return 'use';
    return 'endTurn';
}

function canUseStalkThePrey(core: BetrayalCore, actor: BetrayalExplorerSummary): boolean {
    if (core.scenarioRuntime.traitorPlayerId !== actor.playerId || core.scenarioRuntime.jackSpiritReleased) {
        return false;
    }
    const room = core.rooms.find((item) => item.id === actor.roomId);
    if (!room || room.floor === 'basement') {
        return false;
    }
    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== core.scenarioRuntime.traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    return !livingHeroes.some((hero) => {
        const heroRoom = core.rooms.find((item) => item.id === hero.roomId);
        return heroRoom ? isStraightLineVisible(room, heroRoom, core.rooms) : false;
    });
}

function resolveStalkThePreyTargets(core: BetrayalCore): BetrayalRoomNode[] {
    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== core.scenarioRuntime.traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    return core.rooms.filter((room) => {
        if (room.state !== 'discovered' || room.floor === 'basement') {
            return false;
        }
        return !livingHeroes.some((hero) => {
            const heroRoom = core.rooms.find((item) => item.id === hero.roomId);
            return heroRoom ? isStraightLineVisible(room, heroRoom, core.rooms) : false;
        });
    });
}

function isPlayersTurn(core: BetrayalCore, playerId: string): boolean {
    return core.currentPlayer === playerId;
}

function validatePreHauntAction(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    if (core.phase !== 'preHaunt') {
        return { valid: false, error: '当前不在运行时阶段。' };
    }
    if (!isPlayersTurn(core, command.playerId)) {
        return { valid: false, error: '还没有轮到该玩家。' };
    }

    switch (command.type) {
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const payload = command.payload;
            const targetRooms = new Set(resolveMoveTargetRooms(core).map((room) => room.id));
            if (core.movesRemaining <= 0 || !targetRooms.has(payload.roomId)) {
                return { valid: false, error: '目标房间不可移动。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const explorableSlots = resolveExplorableRoomSlots(core);
            const nextSlot = explorableSlots[0] ?? null;
            if (!nextSlot || !resolveNextDeckKind(core)) {
                return { valid: false, error: '当前没有可探索房间。' };
            }
            if (command.payload.roomId && !explorableSlots.some((room) => room.id === command.payload.roomId)) {
                return { valid: false, error: '指定房间不是当前开放门位。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION: {
            const cardId = command.payload.cardId ?? core.currentExplorer.inventory[0]?.id;
            if (!cardId || !core.currentExplorer.inventory.some((card) => card.id === cardId)) {
                return { valid: false, error: '当前没有可使用持有物。' };
            }
            if (core.usedCardIdsThisTurn.includes(cardId)) {
                return { valid: false, error: '该持有物本回合已经使用。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION: {
            const cardId = command.payload.cardId ?? core.currentExplorer.inventory[0]?.id;
            const targetPlayerId = command.payload.targetPlayerId ?? resolveTradeTargets(core)[0]?.playerId;
            if (!cardId || !targetPlayerId) {
                return { valid: false, error: '缺少交易对象或持有物。' };
            }
            if (!core.currentExplorer.inventory.some((card) => card.id === cardId)) {
                return { valid: false, error: '当前探索者没有这件持有物。' };
            }
            if (!resolveTradeTargets(core).some((explorer) => explorer.playerId === targetPlayerId)) {
                return { valid: false, error: '只能和同房间队友交易。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.END_TURN:
            return { valid: true };
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK:
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
            return { valid: false, error: '当前还未进入 haunt 阶段。' };
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return { valid: false, error: '真实首剧本不能通过手工结算完成。' };
        default:
            return { valid: false, error: '未知运行时命令。' };
    }
}

function validateHauntAction(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    if (core.phase !== 'haunt') {
        return { valid: false, error: '当前不在 haunt 阶段。' };
    }
    if (!isPlayersTurn(core, command.playerId)) {
        return { valid: false, error: '还没有轮到该玩家。' };
    }

    const actor = findExplorerByPlayerId(core, command.playerId);
    if (!actor) {
        return { valid: false, error: '当前行动者不存在。' };
    }
    const isTraitor = core.scenarioRuntime.traitorPlayerId === command.playerId;
    const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(command.playerId);

    switch (command.type) {
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM:
            if (isDead) {
                if (!core.scenarioRuntime.jackSpiritReleased || actor.playerId !== core.scenarioRuntime.traitorPlayerId) {
                    return { valid: false, error: '该角色已死亡，当前不能移动。' };
                }
                const targetRoom = core.rooms.find((room) => room.id === command.payload.roomId);
                if (!targetRoom || targetRoom.state !== 'discovered') {
                    return { valid: false, error: '目标房间不可移动。' };
                }
                const currentRoom = core.rooms.find((room) => room.id === actor.roomId);
                if (
                    targetRoom.id !== actor.roomId
                    && (
                        currentRoom?.floor !== targetRoom.floor
                        || roomDistanceByLayout(currentRoom, targetRoom) !== 1
                    )
                ) {
                    return { valid: false, error: '杰克之灵只能移动到相邻房间。' };
                }
                return { valid: true };
            }
            if (isTraitor && canUseStalkThePrey(core, actor)) {
                const target = core.rooms.find((room) => room.id === command.payload.roomId);
                if (target && resolveStalkThePreyTargets(core).some((room) => room.id === target.id)) {
                    return { valid: true };
                }
            }
            return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
        case BETRAYAL_COMMANDS.EXPLORE_ROOM:
            return { valid: false, error: 'haunt 阶段不能继续探索新房间。' };
        case BETRAYAL_COMMANDS.USE_POSSESSION:
        case BETRAYAL_COMMANDS.TRADE_POSSESSION:
            return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
        case BETRAYAL_COMMANDS.END_TURN:
            return { valid: true };
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
            if (command.payload.target === 'traitor') {
                const traitor = core.scenarioRuntime.traitorPlayerId
                    ? findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId)
                    : null;
                if (!traitor || traitor.roomId !== actor.roomId) {
                    return { valid: false, error: '必须和叛徒处于同一房间才能攻击。' };
                }
            }
            if (command.payload.target === 'hero') {
                const livingHeroInRoom = getAllExplorers(core).some((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    && explorer.roomId === actor.roomId
                ));
                if (!livingHeroInRoom) {
                    return { valid: false, error: '当前房间没有可攻击的英雄。' };
                }
            }
            if (command.payload.target === 'traitor' && isTraitor) {
                return { valid: false, error: '叛徒不能攻击自己。' };
            }
            if (command.payload.target === 'jack-spirit' && !core.scenarioRuntime.jackSpiritReleased) {
                return { valid: false, error: '杰克之灵尚未出现。' };
            }
            if (command.payload.target === 'jack-spirit' && actor.roomId !== core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '必须和杰克之灵处于同一房间。' };
            }
            if (command.payload.target === 'hero' && !isTraitor && !isDead) {
                return { valid: false, error: '当前只有叛徒侧可主动攻击英雄。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK:
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能调查杰克。' };
            }
            if (actor.roomId !== 'upper-west' && core.rooms.find((room) => room.id === actor.roomId)?.name !== '图书馆') {
                return { valid: false, error: '必须在图书馆才能调查杰克。' };
            }
            if (core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(command.playerId)) {
                return { valid: false, error: '该英雄已经掌握杰克线索。' };
            }
            if (core.usedCardIdsThisTurn.includes('learn-about-jack')) {
                return { valid: false, error: '本回合已经调查过杰克。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能研究驱魔法阵。' };
            }
            if (core.rooms.find((room) => room.id === actor.roomId)?.discoveryReward !== 'event') {
                return { valid: false, error: '必须在带有事件标记的房间才能研究驱魔法阵。' };
            }
            if (core.usedCardIdsThisTurn.includes('study-exorcism')) {
                return { valid: false, error: '本回合已经研究过驱魔法阵。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能驱魔。' };
            }
            if (!core.scenarioRuntime.jackSpiritReleased || !core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '杰克之灵尚未出现。' };
            }
            if (actor.roomId !== core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '必须与杰克之灵处于同一房间。' };
            }
            if (core.scenarioRuntime.exorcismCircleRoomIds.length < 2) {
                return { valid: false, error: '至少需要两处驱魔法阵才能尝试驱魔。' };
            }
            if (core.usedCardIdsThisTurn.includes('exorcise-jack')) {
                return { valid: false, error: '本回合已经尝试过驱魔。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return { valid: false, error: '真实首剧本不能通过手工结算完成。' };
        default:
            return { valid: false, error: '未知 haunt 命令。' };
    }
}

function validateCommand(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    if (command.skipValidation) {
        return { valid: true };
    }
    const core = state.core;
    if (core.phase === 'haunt') {
        return validateHauntAction(state, command);
    }
    switch (command.type) {
        case BETRAYAL_COMMANDS.SELECT_EXPLORER: {
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            const explorerId = command.payload.explorerId;
            if (!templateByExplorerId(explorerId)) return { valid: false, error: '未知探索者。' };
            const takenByAnother = Object.entries(core.selectedExplorerByPlayerId)
                .some(([playerId, selectedExplorerId]) => playerId !== command.playerId && selectedExplorerId === explorerId);
            return takenByAnother ? { valid: false, error: '该探索者已被选择。' } : { valid: true };
        }
        case BETRAYAL_COMMANDS.CONFIRM_EXPLORER:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            return core.selectedExplorerByPlayerId[command.playerId]
                ? { valid: true }
                : { valid: false, error: '请先选择探索者。' };
        case BETRAYAL_COMMANDS.START_SCENARIO:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            if (command.payload.scenarioId && !BETRAYAL_SCENARIO_CONFIGS[command.payload.scenarioId]) {
                return { valid: false, error: '未知剧本。' };
            }
            return Object.keys(core.selectedExplorerByPlayerId).length > 0
                ? { valid: true }
                : { valid: false, error: '至少需要一名玩家选择探索者。' };
        default:
            return validatePreHauntAction(state, command);
    }
}

function executeCommand(state: MatchState<BetrayalCore>, command: BetrayalCommand, random: RandomFn): BetrayalEvent[] {
    const core = state.core;
    const timestamp = command.timestamp ?? Date.now();

    switch (command.type) {
        case BETRAYAL_COMMANDS.SELECT_EXPLORER:
            return [nowEvent(EVENTS.EXPLORER_SELECTED, {
                playerId: command.playerId,
                explorerId: command.payload.explorerId,
            }, timestamp)];
        case BETRAYAL_COMMANDS.CONFIRM_EXPLORER:
            return [nowEvent(EVENTS.EXPLORER_CONFIRMED, { playerId: command.playerId }, timestamp)];
        case BETRAYAL_COMMANDS.START_SCENARIO:
            return [nowEvent(EVENTS.SCENARIO_STARTED, {
                playerIds: core.playerIds,
                scenarioId: command.payload.scenarioId ?? core.scenarioId,
            }, timestamp)];
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const room = core.rooms.find((item) => item.id === command.payload.roomId)!;
            return [nowEvent(EVENTS.EXPLORER_MOVED, {
                playerId: command.playerId,
                roomId: room.id,
                logText: `${core.currentExplorer.displayName}移动到${room.name}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const explorableSlots = resolveExplorableRoomSlots(core);
            const nextSlot = command.payload.roomId
                ? explorableSlots.find((room) => room.id === command.payload.roomId) ?? explorableSlots[0]!
                : explorableSlots[0]!;
            const deckKind = resolveNextDeckKind(core)!;
            const roomTemplate = resolveRoomTemplate(core, nextSlot.floor);

            if (deckKind === 'event') {
                const eventCard = resolveEvent(core.exploreIndex);
                const effectLabel = formatEffectLabel(eventCard.effect);
                return [nowEvent(EVENTS.ROOM_EXPLORED, {
                    playerId: command.playerId,
                    roomId: nextSlot.id,
            room: {
                name: roomTemplate.name,
                hint: roomTemplate.hint,
                tags: roomTemplate.tags,
                discoveryReward: deckKind,
                visualId: roomTemplate.visualId,
                doorways: roomTemplate.doorways.map((edge) => ({ edge })),
                backVisualId: nextSlot.backVisualId,
            },
                    deckKind,
                    eventEffect: eventCard.effect,
                    discovery: {
                        kind: deckKind,
                        title: eventCard.name,
                        summary: '即时生效',
                        detail: effectLabel,
                        tone: eventCard.effect.amount < 0 ? 'warning' : 'accent',
                    },
                    logText: `${core.currentExplorer.displayName}探索到${roomTemplate.name}，事件：${eventCard.name}（${effectLabel}）`,
                    hauntTriggered: false,
                }, timestamp)];
            }

            const drawnCard = createDrawnCard(deckKind, core.exploreIndex);
            return [nowEvent(EVENTS.ROOM_EXPLORED, {
                playerId: command.playerId,
                roomId: nextSlot.id,
                room: {
                    name: roomTemplate.name,
                    hint: roomTemplate.hint,
                    tags: roomTemplate.tags,
                    discoveryReward: deckKind,
                    visualId: roomTemplate.visualId,
                    doorways: roomTemplate.doorways.map((edge) => ({ edge })),
                    backVisualId: nextSlot.backVisualId,
                },
                deckKind,
                drawnCard,
                discovery: {
                    kind: deckKind,
                    title: drawnCard.name,
                    summary: '已选中，可直接使用',
                    detail: formatEffectLabel(resolveUseEffect(drawnCard)),
                    tone: 'accent',
                },
                logText: `${core.currentExplorer.displayName}探索到${roomTemplate.name}，拿到了${drawnCard.name}`,
                hauntTriggered: deckKind === 'omen' ? shouldTriggerHaunt(core, {
                    type: EVENTS.ROOM_EXPLORED,
                    payload: {
                        playerId: command.playerId,
                        roomId: nextSlot.id,
                        room: {
                            name: roomTemplate.name,
                            hint: roomTemplate.hint,
                            tags: roomTemplate.tags,
                            discoveryReward: deckKind,
                            visualId: roomTemplate.visualId,
                            doorways: roomTemplate.doorways.map((edge) => ({ edge })),
                            backVisualId: nextSlot.backVisualId,
                        },
                        deckKind,
                        drawnCard,
                        discovery: {
                            kind: deckKind,
                            title: drawnCard.name,
                            summary: '已选中，可直接使用',
                            detail: formatEffectLabel(resolveUseEffect(drawnCard)),
                            tone: 'accent',
                        },
                        logText: `${core.currentExplorer.displayName}探索到${roomTemplate.name}，拿到了${drawnCard.name}`,
                        hauntTriggered: false,
                    },
                    timestamp,
                }, random) : false,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION: {
            const card = core.currentExplorer.inventory.find((item) => item.id === command.payload.cardId)
                ?? core.currentExplorer.inventory[0]!;
            const effect = resolveUseEffect(card);
            const logText = effect.mode === 'move'
                ? `${core.currentExplorer.displayName}用${card.name}稳住路线，额外获得 ${effect.amount} 点移动`
                : `${core.currentExplorer.displayName}用${card.name}调整状态，${TRAIT_LABEL[effect.trait!]} ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
            return [nowEvent(EVENTS.POSSESSION_USED, {
                playerId: command.playerId,
                cardId: card.id,
                effect,
                logText,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION: {
            const card = core.currentExplorer.inventory.find((item) => item.id === command.payload.cardId)
                ?? core.currentExplorer.inventory[0]!;
            const target = resolveTradeTargets(core).find((item) => item.playerId === command.payload.targetPlayerId)
                ?? resolveTradeTargets(core)[0]!;
            return [nowEvent(EVENTS.POSSESSION_TRADED, {
                playerId: command.playerId,
                targetPlayerId: target.playerId,
                cardId: card.id,
                logText: `${core.currentExplorer.displayName}把${card.name}交给了${target.displayName}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.END_TURN: {
            const nextPlayerId = core.phase === 'haunt'
                ? rotateToNextLivingPlayer(core, core.currentPlayer)
                : (() => {
                    const explorers = getExplorersInTurnOrder(core);
                    const currentIndex = explorers.findIndex((explorer) => explorer.playerId === core.currentPlayer);
                    return (explorers[(currentIndex + 1) % explorers.length] ?? explorers[0]!).playerId;
                })();
            const nextExplorer = findExplorerByPlayerId(core, nextPlayerId) ?? core.currentExplorer;
            const previewCore = replaceExplorers(core, getExplorersInTurnOrder(core), nextExplorer.playerId);
            const targets = resolveMoveTargetRooms(previewCore);
            const logText = targets.length > 0
                ? `轮到${nextExplorer.displayName}，可前往${formatRoomTargetList(targets)}`
                : `轮到${nextExplorer.displayName}`;
            return [nowEvent(EVENTS.TURN_ENDED, {
                previousPlayerId: core.currentPlayer,
                nextPlayerId,
                logText,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.HAUNT_ATTACK: {
            const isTraitor = core.scenarioRuntime.traitorPlayerId === command.playerId;
            const attacker = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            if (!isTraitor && command.payload.target === 'traitor') {
                const releasedJackSpiritRoomId = resolveJackSpiritSpawnRoomId(core, attacker.roomId);
                return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    target: 'traitor',
                    defeatedPlayerId: core.scenarioRuntime.traitorPlayerId ?? undefined,
                    releasedJackSpiritRoomId,
                    outcome: 'traitor-defeated',
                    logText: `${attacker.displayName}击倒了叛徒，杰克之灵被释放到远处房间`,
                }, timestamp)];
            }
            if (isTraitor && command.payload.target === 'hero') {
                const targetHero = getAllExplorers(core).find((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    && explorer.roomId === attacker.roomId
                )) ?? core.otherExplorers[0];
                const attackerRoll = rollTrait(random, attacker.traits.might);
                const defenderRoll = targetHero ? rollTrait(random, targetHero.traits.might) : 0;
                const inflicted = attackerRoll > defenderRoll;
                return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    target: 'hero',
                    defeatedPlayerId: inflicted ? targetHero?.playerId : undefined,
                    outcome: inflicted ? 'hero-defeated' : 'wound',
                    attackerRoll,
                    defenderRoll,
                    logText: inflicted
                        ? `${attacker.displayName}击败了一名英雄`
                        : `${attacker.displayName}发起了攻击，但英雄挡住了这一击`,
                }, timestamp)];
            }
            const heroBonus = core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(attacker.playerId) ? 2 : 0;
            const attackerRoll = rollTrait(random, attacker.traits.might) + heroBonus;
            const jackSpiritDefense = rollTrait(random, 5);
            return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                attackerPlayerId: attacker.playerId,
                target: 'jack-spirit',
                outcome: attackerRoll > jackSpiritDefense ? 'jack-damaged' : 'wound',
                attackerRoll,
                defenderRoll: jackSpiritDefense,
                logText: attackerRoll > jackSpiritDefense
                    ? `${attacker.displayName}压制住了杰克之灵`
                    : `${attacker.displayName}尝试攻击杰克之灵，但没能造成有效压制`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK: {
            const actor = core.currentExplorer;
            const rollTotal = rollTrait(random, actor.traits.knowledge);
            const grantedToPlayerId = rollTotal >= 5
                ? getAllExplorers(core).find((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    && !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(explorer.playerId)
                ))?.playerId ?? actor.playerId
                : null;
            return [nowEvent(EVENTS.JACK_LEARNED, {
                playerId: command.playerId,
                grantedToPlayerId,
                rollTotal,
                success: rollTotal >= 5,
                logText: rollTotal >= 5
                    ? `${actor.displayName}在图书馆查到了 Crimson Jack 的线索`
                    : `${actor.displayName}翻遍了图书馆，但还没找到足够线索`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.STUDY_EXORCISM: {
            const actor = core.currentExplorer;
            const rollTotal = rollTrait(random, actor.traits.knowledge);
            return [nowEvent(EVENTS.EXORCISM_STUDIED, {
                playerId: command.playerId,
                roomId: actor.roomId,
                rollTotal,
                success: rollTotal >= 5,
                logText: rollTotal >= 5
                    ? `${actor.displayName}布置了一处驱魔法阵`
                    : `${actor.displayName}研究驱魔失败，精神受到了反噬`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.EXORCISE_JACK: {
            const actor = core.currentExplorer;
            const regionBonus = countExorcismCirclesInRegion(core, actor.roomId);
            const rollTotal = rollTrait(random, actor.traits.sanity) + regionBonus;
            return [nowEvent(EVENTS.JACK_EXORCISED, {
                playerId: command.playerId,
                roomId: actor.roomId,
                rollTotal,
                regionBonus,
                success: rollTotal >= 7,
                logText: rollTotal >= 7
                    ? `${actor.displayName}成功驱散了杰克之灵`
                    : `${actor.displayName}尝试驱魔失败，杰克之灵反扑了所有英雄`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return [];
        default:
            return [];
    }
}

function reduceEvent(state: BetrayalCore, event: BetrayalEvent): BetrayalCore {
    const core = cloneCore(state);
    switch (event.type) {
        case EVENTS.EXPLORER_SELECTED:
            return {
                ...core,
                selectedExplorerByPlayerId: {
                    ...core.selectedExplorerByPlayerId,
                    [event.payload.playerId]: event.payload.explorerId,
                },
                readyPlayerIds: core.readyPlayerIds.filter((playerId) => playerId !== event.payload.playerId),
            };
        case EVENTS.EXPLORER_CONFIRMED:
            return core.readyPlayerIds.includes(event.payload.playerId)
                ? core
                : { ...core, readyPlayerIds: [...core.readyPlayerIds, event.payload.playerId] };
        case EVENTS.SCENARIO_STARTED: {
            core.scenarioId = event.payload.scenarioId;
            const scenario = scenarioConfigById(event.payload.scenarioId);
            const explorers = buildScenarioExplorers(core);
            core.scenarioRuntime = createInitialScenarioRuntimeStatus();
            ensureLibraryPresent(core);
            return replaceExplorers({
                ...core,
                phase: 'preHaunt',
                movesRemaining: 3,
                recommendedAction: 'explore',
                activeRoomId: explorers[0]?.roomId ?? core.activeRoomId,
                usedCardIdsThisTurn: [],
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                activityLog: [{ id: `scenario-started-${scenario.id}`, text: scenario.logs.scenarioStarted, tone: 'accent' }],
                endgameResult: null,
            }, explorers, explorers[0]?.playerId);
        }
        case EVENTS.EXPLORER_MOVED: {
            core.currentExplorer.roomId = event.payload.roomId;
            core.movesRemaining = Math.max(0, core.movesRemaining - 1);
            core.highlightedDeckKind = null;
            core.latestDiscovery = null;
            core.latestDiscoveryOwnerPlayerId = null;
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.ROOM_EXPLORED: {
            const targetRoom = core.rooms.find((room) => room.id === event.payload.roomId);
            if (targetRoom) {
                targetRoom.name = event.payload.room.name;
                targetRoom.hint = event.payload.room.hint;
                targetRoom.tags = [...event.payload.room.tags];
                targetRoom.state = 'discovered';
                targetRoom.discoveryReward = event.payload.room.discoveryReward;
                targetRoom.visualId = event.payload.room.visualId;
                targetRoom.doorways = event.payload.room.doorways.map((doorway) => ({ ...doorway }));
                targetRoom.backVisualId = event.payload.room.backVisualId;
                if (!targetRoom.connectedRoomIds.includes(core.activeRoomId)) {
                    targetRoom.connectedRoomIds = [...targetRoom.connectedRoomIds, core.activeRoomId];
                }
                if (!targetRoom.doorways.some((doorway) => doorway.connectsToRoomId === core.activeRoomId)) {
                    const reverseDoorway = core.rooms
                        .find((room) => room.id === core.activeRoomId)
                        ?.doorways.find((doorway) => doorway.connectsToRoomId === targetRoom.id);
                    targetRoom.doorways = [
                        ...targetRoom.doorways,
                        {
                            edge: reverseDoorway?.edge === 'north'
                                ? 'south'
                                : reverseDoorway?.edge === 'south'
                                    ? 'north'
                                    : reverseDoorway?.edge === 'east'
                                        ? 'west'
                                        : reverseDoorway?.edge === 'west'
                                            ? 'east'
                                            : targetRoom.doorways[0]?.edge ?? 'west',
                            connectsToRoomId: core.activeRoomId,
                        },
                    ];
                }
            }
            core.currentExplorer.roomId = event.payload.roomId;
            core.deckCounts[event.payload.deckKind] = Math.max(0, core.deckCounts[event.payload.deckKind] - 1);
            core.exploreIndex += 1;
            core.highlightedDeckKind = event.payload.deckKind;
            core.latestDiscovery = { ...event.payload.discovery };
            core.latestDiscoveryOwnerPlayerId = event.payload.playerId;
            if (event.payload.deckKind === 'omen') {
                core.scenarioRuntime.omensDiscovered += 1;
            }

            if (event.payload.deckKind === 'event' && event.payload.eventEffect) {
                core.discardCounts.event += 1;
                if (event.payload.eventEffect.mode === 'move') {
                    core.movesRemaining = Math.min(5, Math.max(0, core.movesRemaining + event.payload.eventEffect.amount));
                } else {
                    core.currentExplorer.traits[event.payload.eventEffect.trait!] += event.payload.eventEffect.amount;
                }
            } else if (event.payload.drawnCard) {
                core.currentExplorer.inventory = [...core.currentExplorer.inventory, cloneInventoryCard(event.payload.drawnCard)];
            }

            const synced = syncCurrentExplorerProjection(core);
            let nextCore = {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced, {
                    preferUse: Boolean(event.payload.drawnCard),
                    cardId: event.payload.drawnCard?.id,
                }),
                activityLog: appendActivity(synced, event.payload.logText, event.payload.discovery.tone),
            };
            if (event.payload.hauntTriggered) {
                const scenario = scenarioConfigById(core.scenarioId);
                const hauntRevealerPlayerId = event.payload.playerId;
                const nextPlayerId = rotateToNextLivingPlayer(core, hauntRevealerPlayerId);
                nextCore = reduceEvent(nextCore, nowEvent(EVENTS.HAUNT_TRIGGERED, {
                    traitorPlayerId: hauntRevealerPlayerId,
                    nextPlayerId,
                    hauntTriggerLabel: scenario.hauntTriggerLabel,
                    logText: scenario.logs.hauntTriggered,
                }, event.timestamp));
            }
            return nextCore;
        }
        case EVENTS.POSSESSION_USED: {
            if (event.payload.effect.mode === 'move') {
                core.movesRemaining = Math.min(5, Math.max(0, core.movesRemaining + event.payload.effect.amount));
            } else {
                core.currentExplorer.traits[event.payload.effect.trait!] += event.payload.effect.amount;
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
            core.latestDiscovery = null;
            core.latestDiscoveryOwnerPlayerId = null;
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.POSSESSION_TRADED: {
            const card = core.currentExplorer.inventory.find((item) => item.id === event.payload.cardId);
            const target = core.otherExplorers.find((explorer) => explorer.playerId === event.payload.targetPlayerId);
            if (!card || !target) {
                return core;
            }
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((item) => item.id !== card.id);
            target.inventory = [...target.inventory, cloneInventoryCard(card)];
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.TURN_ENDED: {
            const explorers = getAllExplorers(core);
            const next = replaceExplorers(core, explorers, event.payload.nextPlayerId);
            return {
                ...next,
                movesRemaining: 4,
                recommendedAction: resolveRecommendedAction({ ...next, movesRemaining: 4 }),
                usedCardIdsThisTurn: [],
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                activityLog: appendActivity(next, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.HAUNT_TRIGGERED: {
            core.phase = 'haunt';
            core.scenarioRuntime.hauntTriggered = true;
            core.scenarioRuntime.hauntRevealerPlayerId = event.payload.traitorPlayerId;
            core.scenarioRuntime.traitorPlayerId = event.payload.traitorPlayerId;
            core.scenarioRuntime.nextHauntPlayerId = event.payload.nextPlayerId;
            core.scenarioRuntime.hauntTriggerLabel = event.payload.hauntTriggerLabel;
            core.movesRemaining = 4;
            core.usedCardIdsThisTurn = [];
            const traitor = findExplorerByPlayerId(core, event.payload.traitorPlayerId);
            if (traitor) {
                healExplorerToTemplate(traitor);
                traitor.traits.might += 1;
                traitor.traits.speed += 1;
                traitor.traits.might += 1;
                traitor.traits.speed += 1;
            }
            const nextCore = replaceExplorers(core, getAllExplorers(core), event.payload.nextPlayerId);
            return {
                ...nextCore,
                currentPlayer: event.payload.nextPlayerId,
                recommendedAction: 'move',
                activityLog: appendActivity(nextCore, event.payload.logText, 'warning'),
            };
        }
        case EVENTS.HAUNT_ATTACK_RESOLVED: {
            if (event.payload.outcome === 'traitor-defeated' && event.payload.defeatedPlayerId) {
                core.scenarioRuntime.deadExplorerPlayerIds = Array.from(new Set([
                    ...core.scenarioRuntime.deadExplorerPlayerIds,
                    event.payload.defeatedPlayerId,
                ]));
                const traitor = findExplorerByPlayerId(core, event.payload.defeatedPlayerId);
                core.scenarioRuntime.traitorCorpseRoomId = traitor?.roomId ?? core.activeRoomId;
                core.scenarioRuntime.jackSpiritReleased = true;
                core.scenarioRuntime.jackSpiritRoomId = event.payload.releasedJackSpiritRoomId
                    ?? resolveJackSpiritSpawnRoomId(core, core.scenarioRuntime.traitorCorpseRoomId ?? core.activeRoomId);
                core.monsters = [{
                    id: 'jack-spirit',
                    name: '杰克之灵',
                    portraitAsset: 'betrayal/monsters/spirit',
                    tokenAsset: 'betrayal/tokens/monsters/ghost',
                    roomId: core.scenarioRuntime.jackSpiritRoomId,
                    might: 5,
                    speed: 3,
                    damage: 1,
                }];
            }
            if (event.payload.outcome === 'hero-defeated' && event.payload.defeatedPlayerId) {
                core.scenarioRuntime.deadExplorerPlayerIds = Array.from(new Set([
                    ...core.scenarioRuntime.deadExplorerPlayerIds,
                    event.payload.defeatedPlayerId,
                ]));
                const livingHeroes = getAllExplorers(core).filter((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                ));
                if (livingHeroes.length === 0) {
                    const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer) ?? core.currentExplorer;
                    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                        result: {
                            hauntId: 'crimson-jack-returns',
                            hauntTitle: scenarioConfigById(core.scenarioId).hauntTitle,
                            outcome: 'traitor',
                            winners: [traitor.playerId],
                            traitorPlayerId: traitor.playerId,
                            survivorsEscaped: [],
                            reward: { stars: 0, omens: countDrawnCards(core, 'omen'), logs: 0 },
                            stats: {
                                roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
                                omensDrawn: countDrawnCards(core, 'omen'),
                                itemsDrawn: countDrawnCards(core, 'item'),
                                eventsDrawn: countDrawnCards(core, 'event'),
                            },
                        },
                    }, event.timestamp));
                }
            }
            const nextPlayerId = rotateToNextLivingPlayer(core, core.currentPlayer);
            const nextCore = replaceExplorers(core, getAllExplorers(core), nextPlayerId);
            return {
                ...nextCore,
                currentPlayer: nextPlayerId,
                recommendedAction: 'move',
                activityLog: appendActivity(nextCore, event.payload.logText, event.payload.outcome === 'hero-defeated' ? 'warning' : 'accent'),
            };
        }
        case EVENTS.JACK_LEARNED: {
            if (event.payload.success && event.payload.grantedToPlayerId) {
                core.scenarioRuntime.knowledgeOfJackPlayerIds = Array.from(new Set([
                    ...core.scenarioRuntime.knowledgeOfJackPlayerIds,
                    event.payload.grantedToPlayerId,
                ]));
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'learn-about-jack'];
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.EXORCISM_STUDIED: {
            if (event.payload.success) {
                core.scenarioRuntime.exorcismCircleRoomIds = [
                    ...core.scenarioRuntime.exorcismCircleRoomIds,
                    event.payload.roomId,
                ].slice(-2);
            } else {
                applyMentalDamage(core.currentExplorer, 2);
                if (isExplorerDead(core.currentExplorer)) {
                    markDeadExplorer(core, core.currentExplorer.playerId);
                }
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'study-exorcism'];
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: core.scenarioRuntime.jackSpiritReleased ? 'move' : 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.JACK_EXORCISED:
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'exorcise-jack'];
            if (!event.payload.success) {
                getAllExplorers(core)
                    .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
                    .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
                    .forEach((explorer) => {
                        applyPhysicalDamage(explorer, 1);
                        if (isExplorerDead(explorer)) {
                            markDeadExplorer(core, explorer.playerId);
                        }
                    });
                const livingHeroes = getAllExplorers(core).filter((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                ));
                if (livingHeroes.length === 0) {
                    const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer) ?? core.currentExplorer;
                    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                        result: {
                            hauntId: 'crimson-jack-returns',
                            hauntTitle: scenarioConfigById(core.scenarioId).hauntTitle,
                            outcome: 'traitor',
                            winners: [traitor.playerId],
                            traitorPlayerId: traitor.playerId,
                            survivorsEscaped: [],
                            reward: { stars: 0, omens: countDrawnCards(core, 'omen'), logs: 0 },
                            stats: {
                                roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
                                omensDrawn: countDrawnCards(core, 'omen'),
                                itemsDrawn: countDrawnCards(core, 'item'),
                                eventsDrawn: countDrawnCards(core, 'event'),
                            },
                        },
                    }, event.timestamp));
                }
                const failedCore = syncCurrentExplorerProjection(core);
                return {
                    ...failedCore,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(failedCore, event.payload.logText, 'warning'),
                };
            }
            return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                result: {
                    hauntId: 'crimson-jack-returns',
                    hauntTitle: scenarioConfigById(core.scenarioId).hauntTitle,
                    outcome: 'survivors',
                    winners: getAllExplorers(core)
                        .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
                        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
                        .map((explorer) => explorer.playerId),
                    traitorPlayerId: core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer,
                    survivorsEscaped: getAllExplorers(core)
                        .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
                        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
                        .map((explorer) => explorer.playerId),
                    reward: {
                        stars: scenarioConfigById(core.scenarioId).completion.reward.stars,
                        omens: Math.max(scenarioConfigById(core.scenarioId).completion.reward.minimumOmens, countDrawnCards(core, 'omen')),
                        logs: scenarioConfigById(core.scenarioId).completion.reward.logs,
                    },
                    stats: {
                        roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
                        omensDrawn: countDrawnCards(core, 'omen'),
                        itemsDrawn: countDrawnCards(core, 'item'),
                        eventsDrawn: countDrawnCards(core, 'event'),
                    },
                },
            }, event.timestamp));
        case EVENTS.SCENARIO_COMPLETED:
            return {
                ...core,
                phase: 'endgame',
                recommendedAction: 'endTurn',
                endgameResult: {
                    ...event.payload.result,
                    winners: [...event.payload.result.winners],
                    survivorsEscaped: [...event.payload.result.survivorsEscaped],
                    reward: { ...event.payload.result.reward },
                    stats: { ...event.payload.result.stats },
                },
                activityLog: appendActivity(core, scenarioConfigById(core.scenarioId).logs.scenarioCompleted, 'accent'),
            };
        default:
            return core;
    }
}

export const BetrayalDomain: DomainCore<BetrayalCore, BetrayalCommand, BetrayalEvent> = {
    gameId: 'betrayal',
    setup: (playerIds: PlayerId[], _random: RandomFn) => createBetrayalCharacterSelectCore(playerIds),
    validate: validateCommand,
    execute: executeCommand,
    reduce: reduceEvent,
    playerView: (state) => state,
    isGameOver: (state) => {
        if (state.phase !== 'endgame' || !state.endgameResult) {
            return undefined;
        }
        return {
            winners: state.endgameResult.winners,
            scores: Object.fromEntries(state.playerIds.map((playerId) => [
                playerId,
                state.endgameResult?.winners.includes(playerId) ? 1 : 0,
            ])),
        };
    },
};

export const engineConfig = createGameEngine<BetrayalCore, BetrayalCommand, BetrayalEvent>({
    domain: BetrayalDomain,
    systems: createBaseSystems<BetrayalCore>(),
    minPlayers: 3,
    maxPlayers: 6,
    commandTypes: Object.values(BETRAYAL_COMMANDS),
    disableUndo: true,
});

registerCriticalImageResolver('betrayal', betrayalCriticalImageResolver);

export default engineConfig;
