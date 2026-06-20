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

export type BetrayalTraitKey = 'might' | 'speed' | 'knowledge' | 'sanity';
export type BetrayalInventoryKind = 'item' | 'omen';
export type BetrayalDeckKind = 'event' | 'item' | 'omen';
export type BetrayalPhase = 'characterSelect' | 'preHaunt' | 'endgame';
export type BetrayalRecommendedAction = 'move' | 'explore' | 'trade' | 'use' | 'endTurn';

export interface BetrayalInventoryCard {
    id: string;
    name: string;
    kind: BetrayalInventoryKind;
}

export interface BetrayalExplorerTemplate {
    explorerId: string;
    displayName: string;
    portraitAsset: string;
    color: string;
    traits: Record<BetrayalTraitKey, number>;
    inventory: BetrayalInventoryCard[];
    abilityName: string;
    abilityText: string;
}

export interface BetrayalExplorerSummary {
    playerId: string;
    explorerId: string;
    displayName: string;
    portraitAsset: string;
    roomId: string;
    traits: Record<BetrayalTraitKey, number>;
    inventory: BetrayalInventoryCard[];
}

export interface BetrayalRoomNode {
    id: string;
    name: string;
    floor: 'ground' | 'upper' | 'basement';
    x: number;
    y: number;
    connectedRoomIds: string[];
    state: 'discovered' | 'unexplored';
    startingTile?: boolean;
    hint: string;
    tags: string[];
    discoveryReward: BetrayalDeckKind | null;
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
    hauntId: 'the-hunger';
    hauntTitle: string;
    outcome: 'survivors';
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

export interface BetrayalCore {
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
    deckCounts: Record<BetrayalDeckKind, number>;
    discardCounts: Record<BetrayalDeckKind, number>;
    rooms: BetrayalRoomNode[];
    exploreIndex: number;
    usedCardIdsThisTurn: string[];
    latestDiscovery: BetrayalDiscoverySummary | null;
    latestDiscoveryOwnerPlayerId: string | null;
    highlightedDeckKind: BetrayalDeckKind | null;
    activityLog: BetrayalActivityEntry[];
    endgameResult: BetrayalEndgameResult | null;
}

export const BETRAYAL_COMMANDS = {
    SELECT_EXPLORER: 'SELECT_EXPLORER',
    CONFIRM_EXPLORER: 'CONFIRM_EXPLORER',
    START_FIRST_SCENARIO: 'START_FIRST_SCENARIO',
    MOVE_TO_ROOM: 'MOVE_TO_ROOM',
    EXPLORE_ROOM: 'EXPLORE_ROOM',
    USE_POSSESSION: 'USE_POSSESSION',
    TRADE_POSSESSION: 'TRADE_POSSESSION',
    END_TURN: 'END_TURN',
    COMPLETE_FIRST_SCENARIO: 'COMPLETE_FIRST_SCENARIO',
} as const;

export type BetrayalCommandType = typeof BETRAYAL_COMMANDS[keyof typeof BETRAYAL_COMMANDS];

export type BetrayalCommandMap = {
    [BETRAYAL_COMMANDS.SELECT_EXPLORER]: { explorerId: string };
    [BETRAYAL_COMMANDS.CONFIRM_EXPLORER]: Record<string, never>;
    [BETRAYAL_COMMANDS.START_FIRST_SCENARIO]: Record<string, never>;
    [BETRAYAL_COMMANDS.MOVE_TO_ROOM]: { roomId: string };
    [BETRAYAL_COMMANDS.EXPLORE_ROOM]: { roomId?: string };
    [BETRAYAL_COMMANDS.USE_POSSESSION]: { cardId?: string };
    [BETRAYAL_COMMANDS.TRADE_POSSESSION]: { cardId?: string; targetPlayerId?: string };
    [BETRAYAL_COMMANDS.END_TURN]: Record<string, never>;
    [BETRAYAL_COMMANDS.COMPLETE_FIRST_SCENARIO]: Record<string, never>;
};

export type BetrayalCommand = {
    [Type in keyof BetrayalCommandMap]: Command<Type & string, BetrayalCommandMap[Type]>
}[keyof BetrayalCommandMap];

const EVENTS = {
    EXPLORER_SELECTED: 'EXPLORER_SELECTED',
    EXPLORER_CONFIRMED: 'EXPLORER_CONFIRMED',
    FIRST_SCENARIO_STARTED: 'FIRST_SCENARIO_STARTED',
    EXPLORER_MOVED: 'EXPLORER_MOVED',
    ROOM_EXPLORED: 'ROOM_EXPLORED',
    POSSESSION_USED: 'POSSESSION_USED',
    POSSESSION_TRADED: 'POSSESSION_TRADED',
    TURN_ENDED: 'TURN_ENDED',
    FIRST_SCENARIO_COMPLETED: 'FIRST_SCENARIO_COMPLETED',
} as const;

type BetrayalEvent =
    | GameEvent<typeof EVENTS.EXPLORER_SELECTED, { playerId: string; explorerId: string }>
    | GameEvent<typeof EVENTS.EXPLORER_CONFIRMED, { playerId: string }>
    | GameEvent<typeof EVENTS.FIRST_SCENARIO_STARTED, { playerIds: string[] }>
    | GameEvent<typeof EVENTS.EXPLORER_MOVED, { playerId: string; roomId: string; logText: string }>
    | GameEvent<typeof EVENTS.ROOM_EXPLORED, {
        playerId: string;
        roomId: string;
        room: Pick<BetrayalRoomNode, 'name' | 'hint' | 'tags' | 'discoveryReward'>;
        deckKind: BetrayalDeckKind;
        drawnCard?: BetrayalInventoryCard;
        eventEffect?: UseEffectProfile;
        discovery: BetrayalDiscoverySummary;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.POSSESSION_USED, { playerId: string; cardId: string; effect: UseEffectProfile; logText: string }>
    | GameEvent<typeof EVENTS.POSSESSION_TRADED, { playerId: string; targetPlayerId: string; cardId: string; logText: string }>
    | GameEvent<typeof EVENTS.TURN_ENDED, { previousPlayerId: string; nextPlayerId: string; logText: string }>
    | GameEvent<typeof EVENTS.FIRST_SCENARIO_COMPLETED, { result: BetrayalEndgameResult }>;

export const EXPLORER_CATALOG: BetrayalExplorerTemplate[] = [
    {
        explorerId: 'jaden-jones',
        displayName: '杰登·琼斯',
        portraitAsset: 'betrayal/explorers/jade-jones',
        color: '#8cc63f',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        inventory: [
            { id: 'rope', name: '绳索', kind: 'item' },
            { id: 'flashlight', name: '手电筒', kind: 'item' },
            { id: 'omen-book', name: '预兆书', kind: 'omen' },
        ],
        abilityName: '大胆',
        abilityText: '攻击投掷 +1。',
    },
    {
        explorerId: 'rebecca-allen',
        displayName: '丽贝卡·艾伦博士',
        portraitAsset: 'betrayal/explorers/xia',
        color: '#3699d3',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        inventory: [
            { id: 'rope', name: '绳索', kind: 'item' },
            { id: 'notebook', name: '调查笔记', kind: 'item' },
            { id: 'ring', name: '古戒', kind: 'omen' },
        ],
        abilityName: '冷静',
        abilityText: '第一次事件检定后可重投 1 颗骰。',
    },
    {
        explorerId: 'darryl-highla',
        displayName: '达里尔·海拉',
        portraitAsset: 'betrayal/explorers/anita-hernandez',
        color: '#b45ca3',
        traits: { might: 3, speed: 4, knowledge: 3, sanity: 5 },
        inventory: [
            { id: 'medical-kit', name: '急救包', kind: 'item' },
            { id: 'camera', name: '相机', kind: 'item' },
            { id: 'mask', name: '骨面具', kind: 'omen' },
        ],
        abilityName: '敏锐',
        abilityText: '探索到事件房间时，知识 +1。',
    },
    {
        explorerId: 'oliver-swift',
        displayName: '奥利弗·斯威夫特',
        portraitAsset: 'betrayal/explorers/oliver-swift',
        color: '#d0603f',
        traits: { might: 4, speed: 3, knowledge: 2, sanity: 4 },
        inventory: [
            { id: 'map', name: '折叠地图', kind: 'item' },
            { id: 'lantern', name: '提灯', kind: 'item' },
            { id: 'pendant', name: '银吊坠', kind: 'omen' },
        ],
        abilityName: '谨慎',
        abilityText: '结束回合时若未探索，移动 +1。',
    },
    {
        explorerId: 'lia-valencia',
        displayName: '莉娅·瓦伦西亚',
        portraitAsset: 'betrayal/explorers/sera-nguyen',
        color: '#d0a23e',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        inventory: [
            { id: 'journal', name: '日志', kind: 'item' },
            { id: 'radio', name: '短波机', kind: 'item' },
            { id: 'coin', name: '异币', kind: 'omen' },
        ],
        abilityName: '专注',
        abilityText: '使用物品后可查看顶牌。',
    },
    {
        explorerId: 'sam-yin',
        displayName: '山姆·尹',
        portraitAsset: 'betrayal/explorers/father-warren-leung',
        color: '#719d4a',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        inventory: [
            { id: 'holy-water', name: '圣水', kind: 'item' },
            { id: 'cross', name: '十字架', kind: 'item' },
            { id: 'bell', name: '丧钟铃', kind: 'omen' },
        ],
        abilityName: '守护',
        abilityText: '同房间队友受伤时可替其承受 1 点。',
    },
    {
        explorerId: 'michelle-monroe',
        displayName: '米歇尔·门罗',
        portraitAsset: 'betrayal/explorers/anita-hernandez',
        color: '#777777',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 6 },
        inventory: [
            { id: 'lockpick-tool', name: '撬锁工具', kind: 'item' },
            { id: 'matches', name: '火柴盒', kind: 'item' },
            { id: 'watch', name: '诡异怀表', kind: 'omen' },
        ],
        abilityName: '沉默',
        abilityText: '暂作首剧本叛徒占位。',
    },
];

const ROOM_LAYOUT: BetrayalRoomNode[] = [
    {
        id: 'upper-landing',
        name: '二层平台',
        floor: 'upper',
        x: 2,
        y: 1,
        connectedRoomIds: ['grand-staircase', 'upper-west', 'upper-north'],
        state: 'discovered',
        startingTile: true,
        hint: '上层起始连接位',
        tags: ['起始', '上层'],
        discoveryReward: null,
    },
    {
        id: 'upper-west',
        name: '未探索',
        floor: 'upper',
        x: 1,
        y: 1,
        connectedRoomIds: ['upper-landing'],
        state: 'unexplored',
        hint: '等待翻出上层房间',
        tags: ['待翻出'],
        discoveryReward: null,
    },
    {
        id: 'upper-north',
        name: '未探索',
        floor: 'upper',
        x: 2,
        y: 0,
        connectedRoomIds: ['upper-landing'],
        state: 'unexplored',
        hint: '等待翻出上层房间',
        tags: ['待翻出'],
        discoveryReward: null,
    },
    {
        id: 'grand-staircase',
        name: '大楼梯',
        floor: 'ground',
        x: 2,
        y: 2,
        connectedRoomIds: ['upper-landing', 'entrance-hall', 'ground-east'],
        state: 'discovered',
        startingTile: true,
        hint: '宅邸中央的楼梯间',
        tags: ['起始', '连接'],
        discoveryReward: null,
    },
    {
        id: 'entrance-hall',
        name: '门厅',
        floor: 'ground',
        x: 2,
        y: 3,
        connectedRoomIds: ['grand-staircase', 'basement-landing'],
        state: 'discovered',
        startingTile: true,
        hint: '进入宅邸后的起始入口',
        tags: ['起始', '入口'],
        discoveryReward: null,
    },
    {
        id: 'ground-east',
        name: '未探索',
        floor: 'ground',
        x: 3,
        y: 2,
        connectedRoomIds: ['grand-staircase'],
        state: 'unexplored',
        hint: '等待翻出一层房间',
        tags: ['待翻出'],
        discoveryReward: null,
    },
    {
        id: 'basement-landing',
        name: '地下平台',
        floor: 'basement',
        x: 2,
        y: 4,
        connectedRoomIds: ['entrance-hall'],
        state: 'discovered',
        startingTile: true,
        hint: '地下入口，通向更深处',
        tags: ['起始', '地下'],
        discoveryReward: null,
    },
    {
        id: 'basement-east',
        name: '未探索',
        floor: 'basement',
        x: 3,
        y: 4,
        connectedRoomIds: ['basement-landing'],
        state: 'unexplored',
        hint: '等待翻出地下房间',
        tags: ['待翻出'],
        discoveryReward: null,
    },
];

type RoomTemplate = {
    name: string;
    hint: string;
    tags: string[];
};

type UseEffectProfile = {
    mode: 'move' | 'trait';
    amount: number;
    trait?: BetrayalTraitKey;
    recommendedAction: BetrayalRecommendedAction;
};

type EventTemplate = {
    name: string;
    effect: UseEffectProfile;
};

const DRAW_ORDER: BetrayalDeckKind[] = ['event', 'item', 'omen'];

const DRAW_POOL: Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]> = {
    item: [
        { id: 'lockpick-tool', name: '撬锁工具', kind: 'item' },
        { id: 'hunting-knife', name: '狩猎短刀', kind: 'item' },
        { id: 'matches', name: '火柴盒', kind: 'item' },
        { id: 'manuscript', name: '旧手稿', kind: 'item' },
    ],
    omen: [
        { id: 'amulet', name: '青铜护符', kind: 'omen' },
        { id: 'feathers', name: '乌鸦羽束', kind: 'omen' },
        { id: 'mirror-shard', name: '碎镜片', kind: 'omen' },
        { id: 'watch', name: '诡异怀表', kind: 'omen' },
    ],
};

const ROOM_DISCOVERY_POOL: Record<BetrayalRoomNode['floor'], RoomTemplate[]> = {
    ground: [
        { name: '舞厅', hint: '宽敞的一层房间，适合会合与周旋', tags: ['会合', '开阔'] },
        { name: '礼拜堂', hint: '冷清肃穆，像在等待一件不该发生的事', tags: ['神秘', '静压'] },
    ],
    upper: [
        { name: '长廊', hint: '细长上层通道，容易观察别处动静', tags: ['视野', '走位'] },
        { name: '图书馆', hint: '成排旧书和破纸页，是找知识的地方', tags: ['知识', '调查'] },
    ],
    basement: [
        { name: '储物间', hint: '堆满旧箱和杂物，翻找起来最像物品点', tags: ['物资', '翻找'] },
        { name: '仪式室', hint: '看得出有人在这里做过不该做的准备', tags: ['仪式', '危险'] },
    ],
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
    map: { mode: 'move', amount: 1, recommendedAction: 'move' },
    lantern: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'move' },
    pendant: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    journal: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    radio: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'move' },
    coin: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    'holy-water': { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    cross: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
    bell: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    'lockpick-tool': { mode: 'move', amount: 1, recommendedAction: 'move' },
    matches: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'move' },
    watch: { mode: 'move', amount: 1, recommendedAction: 'move' },
    'hunting-knife': { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
    manuscript: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    'mirror-shard': { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    amulet: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    feathers: { mode: 'move', amount: 1, recommendedAction: 'move' },
};

const EVENT_POOL: EventTemplate[] = [
    { name: '回廊顺风', effect: { mode: 'move', amount: 1, recommendedAction: 'move' } },
    { name: '窃窃低语', effect: { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' } },
    { name: '旧日手记', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
    { name: '滑落阶梯', effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' } },
];

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

function cloneRoom(room: BetrayalRoomNode): BetrayalRoomNode {
    return {
        ...room,
        connectedRoomIds: [...room.connectedRoomIds],
        tags: [...room.tags],
    };
}

function cloneExplorer(explorer: BetrayalExplorerSummary): BetrayalExplorerSummary {
    return {
        ...explorer,
        traits: { ...explorer.traits },
        inventory: explorer.inventory.map(cloneInventoryCard),
    };
}

function createExplorer(playerId: string, template: BetrayalExplorerTemplate, roomId: string): BetrayalExplorerSummary {
    return {
        playerId,
        explorerId: template.explorerId,
        displayName: template.displayName,
        portraitAsset: template.portraitAsset,
        roomId,
        traits: { ...template.traits },
        inventory: template.inventory.map(cloneInventoryCard),
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
        deckCounts: { ...core.deckCounts },
        discardCounts: { ...core.discardCounts },
        rooms: core.rooms.map(cloneRoom),
        usedCardIdsThisTurn: [...core.usedCardIdsThisTurn],
        latestDiscovery: core.latestDiscovery ? { ...core.latestDiscovery } : null,
        activityLog: core.activityLog.map((entry) => ({ ...entry })),
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

function appendActivity(core: BetrayalCore, text: string, tone: BetrayalActivityEntry['tone']): BetrayalActivityEntry[] {
    return [
        { id: `${core.exploreIndex}-${core.activityLog.length}-${text}`, text, tone },
        ...core.activityLog,
    ].slice(0, 6);
}

function normalizePlayerIds(playerIds: string[]): string[] {
    return playerIds.length >= 3 ? playerIds.map(String) : ['0', '1', '2', '3'];
}

function makeBaseCore(playerIds: string[], phase: BetrayalPhase): BetrayalCore {
    const normalizedPlayerIds = normalizePlayerIds(playerIds);
    const rooms = ROOM_LAYOUT.map(cloneRoom);
    const currentExplorer = createExplorer(normalizedPlayerIds[0]!, EXPLORER_CATALOG[0]!, 'grand-staircase');
    const otherExplorers = normalizedPlayerIds.slice(1).map((playerId, index) => (
        createExplorer(
            playerId,
            EXPLORER_CATALOG[(index + 1) % EXPLORER_CATALOG.length]!,
            index === 0 ? 'upper-landing' : index === 1 ? 'basement-landing' : 'entrance-hall',
        )
    ));

    return syncCurrentExplorerProjection({
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
        deckCounts: { omen: 13, item: 15, event: 17 },
        discardCounts: { omen: 0, item: 0, event: 0 },
        rooms,
        exploreIndex: 0,
        usedCardIdsThisTurn: [],
        latestDiscovery: null,
        latestDiscoveryOwnerPlayerId: null,
        highlightedDeckKind: null,
        activityLog: [],
        endgameResult: null,
    });
}

export function createBetrayalCharacterSelectCore(playerIds: string[] = ['0', '1', '2', '3']): BetrayalCore {
    return makeBaseCore(playerIds, 'characterSelect');
}

export function createBetrayalFoundationCore(playerIds: string[] = ['0', '1', '2', '3']): BetrayalCore {
    return makeBaseCore(playerIds, 'preHaunt');
}

function templateByExplorerId(explorerId: string): BetrayalExplorerTemplate | undefined {
    return EXPLORER_CATALOG.find((template) => template.explorerId === explorerId);
}

function getAllExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    return [core.currentExplorer, ...core.otherExplorers];
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
    const startingRooms = ['grand-staircase', 'upper-landing', 'basement-landing', 'entrance-hall', 'upper-landing', 'entrance-hall'];
    return core.playerIds.map((playerId, index) => {
        const selectedExplorerId = core.selectedExplorerByPlayerId[playerId];
        const template = templateByExplorerId(selectedExplorerId ?? '') ?? EXPLORER_CATALOG[index % EXPLORER_CATALOG.length]!;
        return createExplorer(playerId, template, startingRooms[index % startingRooms.length]!);
    });
}

export function resolveMoveTargetRooms(core: BetrayalCore): BetrayalRoomNode[] {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return [];
    }
    const connectedIds = new Set(activeRoom.connectedRoomIds);
    return core.rooms.filter((room) => room.state === 'discovered' && connectedIds.has(room.id));
}

export function resolveNextExplorableRoomSlot(core: BetrayalCore): BetrayalRoomNode | null {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return null;
    }
    const connectedIds = new Set(activeRoom.connectedRoomIds);
    return core.rooms.find((room) => room.state === 'unexplored' && connectedIds.has(room.id)) ?? null;
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
            const nextSlot = resolveNextExplorableRoomSlot(core);
            if (!nextSlot || !resolveNextDeckKind(core)) {
                return { valid: false, error: '当前没有可探索房间。' };
            }
            if (command.payload.roomId && command.payload.roomId !== nextSlot.id) {
                return { valid: false, error: '指定房间不是当前可探索槽位。' };
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
        case BETRAYAL_COMMANDS.COMPLETE_FIRST_SCENARIO:
            return core.exploreIndex >= 2
                ? { valid: true }
                : { valid: false, error: '首剧本需要至少完成两次探索后才能结算。' };
        default:
            return { valid: false, error: '未知运行时命令。' };
    }
}

function validateCommand(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    if (command.skipValidation) {
        return { valid: true };
    }
    const core = state.core;
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
        case BETRAYAL_COMMANDS.START_FIRST_SCENARIO:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            return Object.keys(core.selectedExplorerByPlayerId).length > 0
                ? { valid: true }
                : { valid: false, error: '至少需要一名玩家选择探索者。' };
        default:
            return validatePreHauntAction(state, command);
    }
}

function executeCommand(state: MatchState<BetrayalCore>, command: BetrayalCommand, _random: RandomFn): BetrayalEvent[] {
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
        case BETRAYAL_COMMANDS.START_FIRST_SCENARIO:
            return [nowEvent(EVENTS.FIRST_SCENARIO_STARTED, { playerIds: core.playerIds }, timestamp)];
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const room = core.rooms.find((item) => item.id === command.payload.roomId)!;
            return [nowEvent(EVENTS.EXPLORER_MOVED, {
                playerId: command.playerId,
                roomId: room.id,
                logText: `${core.currentExplorer.displayName}移动到${room.name}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const nextSlot = resolveNextExplorableRoomSlot(core)!;
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
            const explorers = getAllExplorers(core);
            const currentIndex = explorers.findIndex((explorer) => explorer.playerId === core.currentPlayer);
            const nextExplorer = explorers[(currentIndex + 1) % explorers.length] ?? explorers[0]!;
            const previewCore = replaceExplorers(core, explorers, nextExplorer.playerId);
            const targets = resolveMoveTargetRooms(previewCore);
            const logText = targets.length > 0
                ? `轮到${nextExplorer.displayName}，可前往${formatRoomTargetList(targets)}`
                : `轮到${nextExplorer.displayName}`;
            return [nowEvent(EVENTS.TURN_ENDED, {
                previousPlayerId: core.currentPlayer,
                nextPlayerId: nextExplorer.playerId,
                logText,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.COMPLETE_FIRST_SCENARIO: {
            const explorers = getAllExplorers(core);
            const traitor = explorers[explorers.length - 1] ?? core.currentExplorer;
            const survivors = explorers.filter((explorer) => explorer.playerId !== traitor.playerId);
            const result: BetrayalEndgameResult = {
                hauntId: 'the-hunger',
                hauntTitle: '饥饿',
                outcome: 'survivors',
                winners: survivors.map((explorer) => explorer.playerId),
                traitorPlayerId: traitor.playerId,
                survivorsEscaped: survivors.map((explorer) => explorer.playerId),
                reward: {
                    stars: 4,
                    omens: Math.max(1, 2 - core.deckCounts.omen),
                    logs: 1,
                },
                stats: {
                    roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
                    omensDrawn: 12 - core.deckCounts.omen,
                    itemsDrawn: 9 - core.deckCounts.item,
                    eventsDrawn: 10 - core.deckCounts.event,
                },
            };
            return [nowEvent(EVENTS.FIRST_SCENARIO_COMPLETED, { result }, timestamp)];
        }
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
        case EVENTS.FIRST_SCENARIO_STARTED: {
            const explorers = buildScenarioExplorers(core);
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
                activityLog: [{ id: 'scenario-started', text: '首剧本开始：恶兆前探索', tone: 'accent' }],
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
            }
            core.currentExplorer.roomId = event.payload.roomId;
            core.deckCounts[event.payload.deckKind] = Math.max(0, core.deckCounts[event.payload.deckKind] - 1);
            core.exploreIndex += 1;
            core.highlightedDeckKind = event.payload.deckKind;
            core.latestDiscovery = { ...event.payload.discovery };
            core.latestDiscoveryOwnerPlayerId = event.payload.playerId;

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
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced, {
                    preferUse: Boolean(event.payload.drawnCard),
                    cardId: event.payload.drawnCard?.id,
                }),
                activityLog: appendActivity(synced, event.payload.logText, event.payload.discovery.tone),
            };
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
        case EVENTS.FIRST_SCENARIO_COMPLETED:
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
                activityLog: appendActivity(core, '首剧本完成：幸存者逃脱', 'accent'),
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
