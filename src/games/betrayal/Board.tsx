import React from 'react';
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Compass,
    Footprints,
    Handshake,
    Hourglass,
    Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ActionBarAction, PlayerPanelData } from '../../core/ui/types';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import {
    ActionBarSkeleton,
    PhaseHudSkeleton,
    PlayerPanelSkeleton,
    ResourceTraySkeleton,
} from '../../components/game/framework';
import type { MatchPlayerInfo } from '../../engine/transport/protocol';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type {
    BetrayalCommandMap,
    BetrayalCore,
    BetrayalDeckKind,
    BetrayalExplorerSummary,
    BetrayalInventoryCard,
    BetrayalRoomNode,
    BetrayalTraitKey,
} from './game';
import { BETRAYAL_COMMANDS, EXPLORER_CATALOG, createBetrayalCharacterSelectCore } from './game';

type Props = GameBoardProps<BetrayalCore, BetrayalCommandMap>;

type DeckTrayItem = {
    id: string;
    label: string;
    count: number;
    asset: string;
};

type PreviewLogEntry = {
    id: string;
    text: string;
    tone: 'neutral' | 'accent' | 'warning';
};

type PreviewState = {
    core: BetrayalCore;
    selectedInventoryCardId: string | null;
    selectedTradeTargetPlayerId: string | null;
    usedCardIdsThisTurn: string[];
    latestDiscovery: PreviewDiscoveryResult | null;
    latestDiscoveryOwnerPlayerId: string | null;
    roomNotes: Partial<Record<string, string>>;
    logEntries: PreviewLogEntry[];
    exploreIndex: number;
    highlightedDeckKind: BetrayalDeckKind | null;
    interactionMode: 'default' | 'move';
};

type PreviewRoomTemplate = {
    name: string;
    hint: string;
    tags: string[];
};

type PreviewUseEffectProfile = {
    mode: 'move' | 'trait';
    amount: number;
    trait?: BetrayalTraitKey;
    recommendedAction: BetrayalCore['recommendedAction'];
};

type PreviewEventTemplate = {
    name: string;
    effect: PreviewUseEffectProfile;
};

type PreviewDiscoveryResult = {
    kind: BetrayalDeckKind;
    title: string;
    summary: string;
    detail: string;
    tone: PreviewLogEntry['tone'];
};

type RoomConnectionDirection = 'north' | 'east' | 'south' | 'west';

type RoomConnectionEdge = {
    targetRoomId: string;
    direction: RoomConnectionDirection;
};

type RoomGridDragState = {
    isDragging: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    hasMoved: boolean;
};

const ROOM_TILE_SIZE = 190;
const ROOM_TILE_STEP_X = 198;
const ROOM_TILE_STEP_Y = 160;
const ROOM_CANVAS_PADDING = 24;
const ROOM_CANVAS_MIN_WIDTH = 840;
const ROOM_CANVAS_MIN_HEIGHT = 760;

const ROOM_VISUAL_LAYOUT: Record<string, { x: number; y: number }> = {
    'upper-north': { x: 2, y: 0 },
    'upper-west': { x: 1, y: 1 },
    'upper-landing': { x: 2, y: 1 },
    'grand-staircase': { x: 2, y: 2 },
    'ground-east': { x: 3, y: 2 },
    'entrance-hall': { x: 2, y: 3 },
    'basement-landing': { x: 3, y: 3 },
    'basement-east': { x: 4, y: 3 },
};

const ASSETS = {
    titleBanner: 'betrayal/ui/title-banner',
    traitTrack: 'betrayal/ui/trait-track-0-9',
    playerReference: {
        front: 'betrayal/cards/player-reference-zh-front',
        back: 'betrayal/cards/player-reference-zh-back',
    },
    traitorBack: 'betrayal/cards/back-traitor',
    deck: {
        omen: 'betrayal/cards/back-omen',
        item: 'betrayal/cards/back-item',
        event: 'betrayal/cards/back-event',
    } satisfies Record<BetrayalDeckKind, string>,
    room: {
        trophyRoom: 'betrayal/rooms/trophy-room',
        sunroom: 'betrayal/rooms/sunroom',
        backGround: 'betrayal/rooms/room-back-ground',
        backBasement: 'betrayal/rooms/room-back-basement',
    },
    trait: {
        might: 'betrayal/markers/might',
        speed: 'betrayal/markers/speed',
        knowledge: 'betrayal/markers/knowledge',
        sanity: 'betrayal/markers/sanity',
    } satisfies Record<BetrayalTraitKey, string>,
} as const;

const ACTION_ICON_BY_ID = {
    move: Footprints,
    explore: Search,
    trade: Handshake,
    use: BookOpen,
    endTurn: Hourglass,
} as const;

const FLOOR_TONE: Record<BetrayalCore['rooms'][number]['floor'], { label: string; accent: string; glow: string }> = {
    ground: { label: '一层', accent: '#c5a56c', glow: 'rgba(197,165,108,0.32)' },
    upper: { label: '二层', accent: '#8ba98d', glow: 'rgba(139,169,141,0.28)' },
    basement: { label: '地下', accent: '#8b6b78', glow: 'rgba(139,107,120,0.26)' },
};

const ROOM_IDENTITY_TONE = {
    starting: {
        stripe: 'bg-[rgba(201,163,94,0.92)]',
        badge: 'border-[#c9a35e] bg-[rgba(201,163,94,0.16)] text-[#f3e0b4]',
    },
    unrevealed: {
        stripe: 'bg-[rgba(92,106,95,0.84)]',
        badge: 'border-[rgba(111,126,116,0.42)] bg-[rgba(18,26,22,0.92)] text-[#9fb6a3]',
    },
    explorable: {
        stripe: 'bg-[rgba(205,173,101,0.92)]',
        badge: 'border-[#c7a96a] bg-[rgba(199,169,106,0.18)] text-[#f2dfb0]',
    },
    event: {
        stripe: 'bg-[rgba(208,140,96,0.92)]',
        badge: 'border-[#d08c60] bg-[rgba(78,43,28,0.84)] text-[#f5d0b8]',
    },
    item: {
        stripe: 'bg-[rgba(201,163,94,0.92)]',
        badge: 'border-[#d2ab61] bg-[rgba(64,47,23,0.84)] text-[#f3e0b4]',
    },
    omen: {
        stripe: 'bg-[rgba(118,189,153,0.92)]',
        badge: 'border-[#76bd99] bg-[rgba(33,65,51,0.82)] text-[#d6f1df]',
    },
} as const;

const PREVIEW_DRAW_ORDER: BetrayalDeckKind[] = ['event', 'item', 'omen'];

const PREVIEW_DRAW_POOL: Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]> = {
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

const PREVIEW_ROOM_DISCOVERY_POOL: Record<BetrayalRoomNode['floor'], PreviewRoomTemplate[]> = {
    ground: [
        { name: '舞厅', hint: '宽敞的一层房间，适合会合与周旋', tags: ['会合', '开阔'] },
        { name: '餐厅', hint: '旧式长桌还在，像有人刚离席', tags: ['搜寻', '线索'] },
        { name: '礼拜堂', hint: '冷清肃穆，像在等待一件不该发生的事', tags: ['神秘', '静压'] },
    ],
    upper: [
        { name: '长廊', hint: '细长上层通道，容易观察别处动静', tags: ['视野', '走位'] },
        { name: '图书馆', hint: '成排旧书和破纸页，是找知识的地方', tags: ['知识', '调查'] },
        { name: '塔楼', hint: '高处带来距离感，也更容易孤立无援', tags: ['高处', '风险'] },
    ],
    basement: [
        { name: '储物间', hint: '堆满旧箱和杂物，翻找起来最像物品点', tags: ['物资', '翻找'] },
        { name: '墓穴', hint: '地下最压抑的角落，预兆感很强', tags: ['预兆', '阴森'] },
        { name: '仪式室', hint: '看得出有人在这里做过不该做的准备', tags: ['仪式', '危险'] },
    ],
};

const PREVIEW_USE_EFFECTS: Record<string, PreviewUseEffectProfile> = {
    rope: { mode: 'move', amount: 1, recommendedAction: 'move' },
    flashlight: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    ring: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    notebook: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    key: { mode: 'move', amount: 1, recommendedAction: 'move' },
    'omen-book': { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    'medical-kit': { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    camera: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    mask: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    map: { mode: 'move', amount: 1, recommendedAction: 'move' },
    lantern: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
    pendant: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    journal: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    radio: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'move' },
    coin: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    'holy-water': { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    cross: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
    bell: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    'lockpick-tool': { mode: 'move', amount: 1, recommendedAction: 'move' },
    'hunting-knife': { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
    matches: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'move' },
    manuscript: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    amulet: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
    feathers: { mode: 'move', amount: 1, recommendedAction: 'move' },
    'mirror-shard': { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
    watch: { mode: 'move', amount: 1, recommendedAction: 'move' },
};

const PREVIEW_EVENT_POOL: PreviewEventTemplate[] = [
    { name: '回廊顺风', effect: { mode: 'move', amount: 1, recommendedAction: 'move' } },
    { name: '窃窃低语', effect: { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' } },
    { name: '旧日手记', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
    { name: '滑落阶梯', effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' } },
];

function isTraitMap(value: unknown): value is Record<BetrayalTraitKey, number> {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return ['might', 'speed', 'knowledge', 'sanity'].every((key) => typeof candidate[key] === 'number');
}

function isInventoryCard(value: unknown): value is BetrayalInventoryCard {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<BetrayalInventoryCard>;
    return typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && (candidate.kind === 'item' || candidate.kind === 'omen');
}

function isExplorerSummary(value: unknown): value is BetrayalExplorerSummary {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<BetrayalExplorerSummary>;
    return typeof candidate.playerId === 'string'
        && typeof candidate.explorerId === 'string'
        && typeof candidate.displayName === 'string'
        && typeof candidate.portraitAsset === 'string'
        && typeof candidate.roomId === 'string'
        && isTraitMap(candidate.traits)
        && Array.isArray(candidate.inventory)
        && candidate.inventory.every(isInventoryCard);
}

function isBetrayalCore(value: unknown): value is BetrayalCore {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<BetrayalCore>;
    return (candidate.phase === 'characterSelect' || candidate.phase === 'preHaunt' || candidate.phase === 'endgame')
        && typeof candidate.currentPlayer === 'string'
        && typeof candidate.movesRemaining === 'number'
        && typeof candidate.activeRoomId === 'string'
        && isExplorerSummary(candidate.currentExplorer)
        && isTraitMap(candidate.currentExplorerTraits)
        && Array.isArray(candidate.currentExplorerInventory)
        && candidate.currentExplorerInventory.every(isInventoryCard)
        && Array.isArray(candidate.otherExplorers)
        && candidate.otherExplorers.every(isExplorerSummary)
        && Array.isArray(candidate.rooms);
}

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

function cloneCore(core: BetrayalCore): BetrayalCore {
    return {
        ...core,
        currentExplorer: cloneExplorer(core.currentExplorer),
        currentExplorerTraits: { ...core.currentExplorerTraits },
        currentExplorerInventory: core.currentExplorerInventory.map(cloneInventoryCard),
        otherExplorers: core.otherExplorers.map(cloneExplorer),
        deckCounts: { ...core.deckCounts },
        discardCounts: { ...core.discardCounts },
        rooms: core.rooms.map(cloneRoom),
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

function appendPreviewLog(
    entries: PreviewLogEntry[],
    text: string,
    tone: PreviewLogEntry['tone'],
): PreviewLogEntry[] {
    return [
        {
            id: `${Date.now()}-${entries.length}`,
            text,
            tone,
        },
        ...entries,
    ].slice(0, 4);
}

function createInitialPreviewState(core: BetrayalCore): PreviewState {
    return {
        core: cloneCore(core),
        selectedInventoryCardId: core.currentExplorerInventory[0]?.id ?? null,
        selectedTradeTargetPlayerId: null,
        usedCardIdsThisTurn: [],
        latestDiscovery: null,
        latestDiscoveryOwnerPlayerId: null,
        roomNotes: {
            [core.activeRoomId]: '待探索',
        },
        logEntries: [],
        exploreIndex: 0,
        highlightedDeckKind: null,
        interactionMode: 'default',
    };
}

function resolvePlayerName(
    playerId: string,
    explorerName: string,
    matchData?: MatchPlayerInfo[],
) {
    const matched = matchData?.find((item) => String(item.id) === String(playerId));
    return matched?.name?.trim() || explorerName;
}

function resolveCompactNameLabel(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '?';
    if (/[\u4e00-\u9fff]/.test(trimmed)) {
        return trimmed.slice(0, 2);
    }
    const parts = trimmed.split(/[\s·-]+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0]!.slice(0, 2).toUpperCase();
    }
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

function buildPanelData(
    explorer: BetrayalExplorerSummary,
    matchData?: MatchPlayerInfo[],
): PlayerPanelData {
    return {
        playerId: explorer.playerId,
        displayName: resolvePlayerName(explorer.playerId, explorer.displayName, matchData),
        resources: { ...explorer.traits },
        statusEffects: {},
    };
}

function buildDeckItems(core: BetrayalCore, t: ReturnType<typeof useTranslation>['t']): DeckTrayItem[] {
    return (['omen', 'item', 'event'] as BetrayalDeckKind[]).map((kind) => ({
        id: `deck-${kind}`,
        label: t(`board.decks.${kind}`),
        count: core.deckCounts[kind],
        asset: ASSETS.deck[kind],
    }));
}

function buildDiscardItems(core: BetrayalCore, t: ReturnType<typeof useTranslation>['t']): DeckTrayItem[] {
    return (['omen', 'item', 'event'] as BetrayalDeckKind[])
        .map((kind) => ({
            id: `discard-${kind}`,
            label: `${t(`board.decks.${kind}`)} · ${t('board.sections.discard')}`,
            count: core.discardCounts[kind],
            asset: ASSETS.deck[kind],
        }));
}

function resolveFloorLabel(floor: BetrayalRoomNode['floor']): string {
    return FLOOR_TONE[floor].label;
}

function resolveNextPreviewDeckKind(core: BetrayalCore, exploreIndex: number): BetrayalDeckKind | null {
    for (let index = 0; index < PREVIEW_DRAW_ORDER.length; index += 1) {
        const kind = PREVIEW_DRAW_ORDER[(exploreIndex + index) % PREVIEW_DRAW_ORDER.length]!;
        if (core.deckCounts[kind] > 0) {
            return kind;
        }
    }
    return null;
}

function createPreviewDrawCard(kind: Exclude<BetrayalDeckKind, 'event'>, exploreIndex: number): BetrayalInventoryCard {
    const template = PREVIEW_DRAW_POOL[kind][exploreIndex % PREVIEW_DRAW_POOL[kind].length]!;
    return {
        id: `${template.id}-preview-${exploreIndex}`,
        name: template.name,
        kind: template.kind,
    };
}

function buildRoomOccupants(core: BetrayalCore): Record<string, BetrayalExplorerSummary[]> {
    const occupants: Record<string, BetrayalExplorerSummary[]> = {};
    for (const explorer of [core.currentExplorer, ...core.otherExplorers]) {
        occupants[explorer.roomId] ??= [];
        occupants[explorer.roomId]!.push(explorer);
    }
    return occupants;
}

function resolveMoveTargetRooms(core: BetrayalCore): BetrayalRoomNode[] {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return [];
    }
    const connectedIds = new Set(activeRoom.connectedRoomIds);
    return core.rooms.filter((room) => room.state === 'discovered' && connectedIds.has(room.id));
}

function formatRoomTargetList(rooms: BetrayalRoomNode[]): string {
    return Array.from(new Set(rooms.map((room) => room.name))).join(' / ');
}

function resolveNextExplorableRoomSlot(core: BetrayalCore): BetrayalRoomNode | null {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return null;
    }
    const connectedIds = new Set(activeRoom.connectedRoomIds);
    return core.rooms.find((room) => room.state === 'unexplored' && connectedIds.has(room.id)) ?? null;
}

function resolveRoomVisualPosition(room: BetrayalRoomNode): { x: number; y: number } {
    return ROOM_VISUAL_LAYOUT[room.id] ?? { x: room.x, y: room.y };
}

function resolveRoomConnectionEdges(
    room: BetrayalRoomNode,
    roomLookup: Map<string, BetrayalRoomNode>,
): RoomConnectionEdge[] {
    const edges: RoomConnectionEdge[] = [];
    const roomPosition = resolveRoomVisualPosition(room);
    for (const targetRoomId of room.connectedRoomIds) {
        const targetRoom = roomLookup.get(targetRoomId);
        if (!targetRoom) {
            continue;
        }
        const targetPosition = resolveRoomVisualPosition(targetRoom);
        const deltaX = targetPosition.x - roomPosition.x;
        const deltaY = targetPosition.y - roomPosition.y;
        let direction: RoomConnectionDirection | null = null;
        if (deltaX === 1 && deltaY === 0) {
            direction = 'east';
        } else if (deltaX === -1 && deltaY === 0) {
            direction = 'west';
        } else if (deltaX === 0 && deltaY === 1) {
            direction = 'south';
        } else if (deltaX === 0 && deltaY === -1) {
            direction = 'north';
        }
        if (direction) {
            edges.push({ targetRoomId, direction });
        }
    }
    return edges;
}

function resolveRoomTileAsset(room: BetrayalRoomNode, isDiscovered: boolean): string {
    if (!isDiscovered) {
        return room.floor === 'basement' ? ASSETS.room.backBasement : ASSETS.room.backGround;
    }

    if (room.id === 'entrance-hall' || room.id === 'ground-east' || room.discoveryReward === 'event') {
        return ASSETS.room.trophyRoom;
    }

    return ASSETS.room.sunroom;
}

function resolveRoomCanvasStyle(rooms: BetrayalRoomNode[]): React.CSSProperties {
    const roomPositions = rooms.map(resolveRoomVisualPosition);
    const minX = Math.min(...roomPositions.map((position) => position.x), 1);
    const maxX = Math.max(...roomPositions.map((position) => position.x), 1);
    const minY = Math.min(...roomPositions.map((position) => position.y), 0);
    const maxY = Math.max(...roomPositions.map((position) => position.y), 1);
    const width = Math.max(
        ROOM_CANVAS_MIN_WIDTH,
        ROOM_CANVAS_PADDING * 2 + (maxX - minX) * ROOM_TILE_STEP_X + ROOM_TILE_SIZE,
    );
    const height = Math.max(
        ROOM_CANVAS_MIN_HEIGHT,
        ROOM_CANVAS_PADDING * 2 + (maxY - minY) * ROOM_TILE_STEP_Y + ROOM_TILE_SIZE,
    );

    return {
        width,
        height,
        minWidth: width,
        minHeight: height,
    };
}

function resolveRoomTileStyle(room: BetrayalRoomNode): React.CSSProperties {
    const roomPosition = resolveRoomVisualPosition(room);
    const minX = Math.min(...Object.values(ROOM_VISUAL_LAYOUT).map((position) => position.x), 1);
    const minY = Math.min(...Object.values(ROOM_VISUAL_LAYOUT).map((position) => position.y), 0);
    return {
        left: ROOM_CANVAS_PADDING + (roomPosition.x - minX) * ROOM_TILE_STEP_X,
        top: ROOM_CANVAS_PADDING + (roomPosition.y - minY) * ROOM_TILE_STEP_Y,
        width: ROOM_TILE_SIZE,
        height: ROOM_TILE_SIZE,
    };
}

function resolveTradeTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.otherExplorers.filter((explorer) => explorer.roomId === core.activeRoomId);
}

function resolveContextualRecommendedAction(
    core: BetrayalCore,
    options: {
        canUseSelectedCard?: boolean;
        preferUse?: boolean;
    } = {},
): BetrayalCore['recommendedAction'] {
    const canMove = core.movesRemaining > 0 && resolveMoveTargetRooms(core).length > 0;
    const canExplore = Boolean(resolveNextExplorableRoomSlot(core));
    const canTrade = core.currentExplorerInventory.length > 0 && resolveTradeTargets(core).length > 0;
    const canUseSelectedCard = options.canUseSelectedCard ?? false;

    if (options.preferUse && canUseSelectedCard) {
        return 'use';
    }
    if (canMove) {
        return 'move';
    }
    if (canExplore) {
        return 'explore';
    }
    if (canTrade) {
        return 'trade';
    }
    if (canUseSelectedCard) {
        return 'use';
    }
    return 'endTurn';
}

function resolvePreviewUseEffectProfile(card: BetrayalInventoryCard): PreviewUseEffectProfile {
    const normalizedCardId = card.id.replace(/-preview-\d+$/, '');
    return PREVIEW_USE_EFFECTS[normalizedCardId]
        ?? (card.kind === 'item'
            ? { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' }
            : { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' });
}

function formatSignedDelta(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
}

function resolvePreviewUseEffectLabel(
    cardOrEffect: BetrayalInventoryCard | PreviewUseEffectProfile | null,
    t: ReturnType<typeof useTranslation>['t'],
): string {
    if (!cardOrEffect) {
        return t('board.status.noSelectedCard');
    }
    const profile = 'mode' in cardOrEffect
        ? cardOrEffect
        : resolvePreviewUseEffectProfile(cardOrEffect);
    if (profile.mode === 'move') {
        return t('board.useEffects.move', { value: formatSignedDelta(profile.amount) });
    }
    return t('board.useEffects.trait', {
        trait: t(`board.traits.${profile.trait}`),
        value: formatSignedDelta(profile.amount),
    });
}

function resolvePreviewEvent(exploreIndex: number): PreviewEventTemplate {
    return PREVIEW_EVENT_POOL[exploreIndex % PREVIEW_EVENT_POOL.length]!;
}

function resolveSelectedTradeTargetPlayerId(
    tradeTargets: BetrayalExplorerSummary[],
    selectedTradeTargetPlayerId: string | null,
): string | null {
    if (selectedTradeTargetPlayerId && tradeTargets.some((explorer) => explorer.playerId === selectedTradeTargetPlayerId)) {
        return selectedTradeTargetPlayerId;
    }
    return tradeTargets[0]?.playerId ?? null;
}

function resolvePreviewRoomTemplate(core: BetrayalCore, floor: BetrayalRoomNode['floor'], exploreIndex: number): PreviewRoomTemplate {
    const pool = PREVIEW_ROOM_DISCOVERY_POOL[floor];
    const discoveredCount = core.rooms.filter((room) => room.floor === floor && room.state === 'discovered' && !room.startingTile).length;
    return pool[(exploreIndex + discoveredCount) % pool.length]!;
}

function ExplorerPentagonCard({
    explorer,
    selected,
    ready,
    taken,
    compact = false,
    effectiveLocale,
    onClick,
}: {
    explorer: typeof EXPLORER_CATALOG[number];
    selected: boolean;
    ready: boolean;
    taken: boolean;
    compact?: boolean;
    effectiveLocale: string;
    onClick?: () => void;
}) {
    const stateLabel = taken && !selected ? '已占用' : ready ? '已就绪' : selected ? '已选择' : '选择';
    const assetHeightClass = compact ? 'h-[230px]' : 'h-[310px]';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={taken && !selected}
            data-testid={`betrayal-character-card-${explorer.explorerId}`}
            className={`group relative flex flex-col items-center text-left transition duration-200 ${
                selected
                    ? 'drop-shadow-[0_0_26px_rgba(181,239,66,0.5)]'
                    : taken
                        ? 'opacity-55 grayscale'
                        : 'hover:-translate-y-1 hover:drop-shadow-[0_0_18px_rgba(211,179,109,0.34)]'
            }`}
        >
            <div className={`relative flex w-full items-center justify-center ${assetHeightClass}`}>
                {selected ? (
                    <div className="pointer-events-none absolute inset-x-[10%] inset-y-[4%] rounded-[42%] bg-[rgba(181,239,66,0.14)] blur-2xl" />
                ) : null}
                <OptimizedImage
                    src={explorer.portraitAsset}
                    locale={effectiveLocale}
                    alt={explorer.displayName}
                    className="relative z-10 h-full w-full object-contain"
                    draggable={false}
                />
            </div>
            <div className={`relative z-20 mt-1 inline-flex min-w-[104px] items-center justify-center rounded-[10px] border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] shadow-[0_8px_18px_rgba(0,0,0,0.32)] ${
                taken && !selected
                    ? 'border-[#5c5548] bg-[rgba(14,14,12,0.86)] text-[#8e8371]'
                    : ready
                        ? 'border-[#77bb77] bg-[rgba(19,43,25,0.9)] text-[#9bea8e]'
                        : selected
                            ? 'border-[#b5ef42] bg-[rgba(34,55,18,0.92)] text-[#dfff8f]'
                            : 'border-[#8b744d] bg-[rgba(22,17,12,0.9)] text-[#e4c983]'
            }`}>
                {stateLabel}
            </div>
        </button>
    );
}

function CharacterSelectScreen({
    core,
    matchData,
    effectiveLocale,
    viewerPlayerId,
    selectedExplorerId,
    onSelectExplorer,
    onConfirmExplorer,
    onStartScenario,
}: {
    core: BetrayalCore;
    matchData?: MatchPlayerInfo[];
    effectiveLocale: string;
    viewerPlayerId: string;
    selectedExplorerId: string;
    onSelectExplorer: (explorerId: string) => void;
    onConfirmExplorer: () => void;
    onStartScenario: () => void;
}) {
    const selectedExplorer = EXPLORER_CATALOG.find((item) => item.explorerId === selectedExplorerId) ?? EXPLORER_CATALOG[0]!;
    const readySet = new Set(core.readyPlayerIds);
    const isReady = readySet.has(viewerPlayerId);
    const availableExplorer = EXPLORER_CATALOG.find((explorer) => {
        const selectedByPlayer = Object.entries(core.selectedExplorerByPlayerId)
            .find(([, explorerId]) => explorerId === explorer.explorerId)?.[0] ?? null;
        return !selectedByPlayer || selectedByPlayer === viewerPlayerId;
    }) ?? EXPLORER_CATALOG[0]!;

    return (
        <div
            data-testid="betrayal-character-select-screen"
            className="relative flex h-full min-h-full flex-col overflow-hidden bg-[#0b1512] text-[#f1e8d4]"
            style={{
                backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(77,128,76,0.28), transparent 26%), linear-gradient(180deg, #10201a 0%, #07100e 100%)',
            }}
        >
            <header className="grid grid-cols-[minmax(220px,1fr)_2fr_minmax(220px,1fr)] border-b border-[#6c5838] bg-[rgba(9,15,13,0.9)]">
                <div className="border-r border-[#57472f] px-6 py-4">
                    <OptimizedImage src={ASSETS.titleBanner} locale={effectiveLocale} alt="山屋惊魂" className="h-16 w-full object-contain object-left" draggable={false} />
                </div>
                <div className="flex items-center justify-center text-3xl font-semibold uppercase tracking-[0.22em] text-[#e7c783]">
                    选择探索者
                </div>
                <div className="flex items-center justify-end gap-5 px-6 py-4">
                    <div className="text-center">
                        <div className="text-xs uppercase tracking-[0.18em] text-[#d8bf81]">玩家</div>
                        <div className="text-2xl font-semibold text-[#a8e850]">{core.readyPlayerIds.length}/{core.playerIds.length}</div>
                    </div>
                    <div className="rounded-[18px] border border-[#6c5838] px-4 py-3 text-2xl">⚙</div>
                </div>
            </header>

            <main className="grid min-h-0 flex-1 grid-cols-[31%_1fr] gap-8 px-12 py-8">
                <aside className="flex min-h-0 flex-col gap-5">
                    <ExplorerPentagonCard
                        explorer={selectedExplorer}
                        selected
                        ready={isReady}
                        taken={false}
                        effectiveLocale={effectiveLocale}
                    />
                    <section className="rounded-[18px] border border-[#6f5b3a] bg-[rgba(9,15,13,0.88)] p-5 shadow-[0_18px_36px_rgba(0,0,0,0.34)]">
                        <h2 className="text-2xl font-semibold uppercase tracking-[0.16em] text-[#f3dfae]">{selectedExplorer.displayName}</h2>
                        <div className="mt-4 grid gap-2">
                            {(['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]).map((trait) => (
                                <div key={trait} className="grid grid-cols-[82px_1fr_24px] items-center gap-3 text-sm">
                                    <span className="font-semibold text-[#d8bf81]">{TRAIT_LABEL_LOCAL[trait]}</span>
                                    <div className="flex gap-2">
                                        {Array.from({ length: 6 }).map((_, index) => (
                                            <span
                                                key={index}
                                                className={`h-3 w-3 rounded-full border ${index < selectedExplorer.traits[trait] ? 'border-[#d4b46d] bg-[#d4b46d]' : 'border-[#62543c] bg-[#111916]'}`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-right text-[#f1e8d4]">{selectedExplorer.traits[trait]}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 border-t border-[#4e412d] pt-4">
                            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b5ef42]">{selectedExplorer.abilityName}</div>
                            <div className="mt-1 text-sm text-[#d6ccb2]">{selectedExplorer.abilityText}</div>
                        </div>
                    </section>
                </aside>

                <section className="grid min-h-0 grid-cols-3 content-start gap-x-10 gap-y-8">
                    {EXPLORER_CATALOG.slice(1).map((explorer) => {
                        const selectedByPlayer = Object.entries(core.selectedExplorerByPlayerId)
                            .find(([, explorerId]) => explorerId === explorer.explorerId)?.[0] ?? null;
                        const selected = explorer.explorerId === selectedExplorerId;
                        const taken = Boolean(selectedByPlayer && selectedByPlayer !== viewerPlayerId);
                        return (
                            <ExplorerPentagonCard
                                key={explorer.explorerId}
                                explorer={explorer}
                                compact
                                selected={selected}
                                ready={selectedByPlayer ? readySet.has(selectedByPlayer) : false}
                                taken={taken}
                                effectiveLocale={effectiveLocale}
                                onClick={() => onSelectExplorer(explorer.explorerId)}
                            />
                        );
                    })}
                </section>
            </main>

            <footer className="grid grid-cols-[1fr_auto] items-center gap-6 border-t border-[#6c5838] bg-[rgba(9,15,13,0.9)] px-12 py-5">
                <div className="flex items-center gap-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d8bf81]">玩家 {core.readyPlayerIds.length}/{core.playerIds.length}</div>
                    {core.playerIds.map((playerId, index) => {
                        const selectedId = core.selectedExplorerByPlayerId[playerId];
                        return (
                            <div
                                key={playerId}
                                className={`flex h-20 w-24 flex-col items-center justify-center rounded-[14px] border text-sm ${
                                    selectedId
                                        ? 'border-[#8abf55] bg-[rgba(75,116,59,0.22)] text-[#d9f0b8]'
                                        : 'border-[#4d4435] bg-[rgba(14,18,16,0.8)] text-[#756f62]'
                                }`}
                            >
                                <span>P{index + 1}</span>
                                <span className="mt-1 max-w-[80px] truncate text-xs">
                                    {resolvePlayerName(playerId, `玩家${index + 1}`, matchData)}
                                </span>
                                <span className="mt-1 text-xs">{readySet.has(playerId) ? '✓' : selectedId ? '待确认' : '-'}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center gap-5">
                    <button
                        type="button"
                        onClick={() => onSelectExplorer(availableExplorer.explorerId)}
                        className="rounded-[16px] border border-[#6f5b3a] bg-[rgba(18,24,20,0.9)] px-7 py-5 text-sm font-semibold uppercase tracking-[0.14em] text-[#d8bf81] transition hover:border-[#d8bf81]"
                    >
                        随机
                    </button>
                    <button
                        type="button"
                        onClick={isReady ? onStartScenario : onConfirmExplorer}
                        data-testid="betrayal-character-confirm"
                        className="rounded-[18px] border border-[#b5ef42] bg-[rgba(116,154,46,0.28)] px-12 py-5 text-2xl font-semibold uppercase tracking-[0.18em] text-[#dfff8f] shadow-[0_0_26px_rgba(181,239,66,0.22)] transition hover:bg-[rgba(116,154,46,0.38)]"
                    >
                        {isReady ? '开始' : '确认'}
                    </button>
                    <button
                        type="button"
                        className="rounded-[16px] border border-[#6f5b3a] bg-[rgba(18,24,20,0.9)] px-7 py-5 text-sm font-semibold uppercase tracking-[0.14em] text-[#d8bf81]"
                    >
                        返回
                    </button>
                </div>
            </footer>
        </div>
    );
}

const TRAIT_LABEL_LOCAL: Record<BetrayalTraitKey, string> = {
    might: '力量',
    speed: '速度',
    knowledge: '知识',
    sanity: '神志',
};

function EndgameScreen({
    core,
    matchData,
    effectiveLocale,
}: {
    core: BetrayalCore;
    matchData?: MatchPlayerInfo[];
    effectiveLocale: string;
}) {
    const result = core.endgameResult;
    const allExplorers = [core.currentExplorer, ...core.otherExplorers];
    const survivors = result
        ? allExplorers.filter((explorer) => result.survivorsEscaped.includes(explorer.playerId))
        : allExplorers.slice(0, Math.max(1, allExplorers.length - 1));
    const traitor = result
        ? allExplorers.find((explorer) => explorer.playerId === result.traitorPlayerId) ?? allExplorers[allExplorers.length - 1]
        : allExplorers[allExplorers.length - 1];

    return (
        <div
            data-testid="betrayal-endgame-screen"
            className="relative flex h-full min-h-full flex-col overflow-hidden bg-[#0b1512] text-[#f1e8d4]"
            style={{
                backgroundImage: 'radial-gradient(circle at 50% 8%, rgba(156,203,77,0.2), transparent 28%), linear-gradient(180deg, #0f1b17 0%, #07100e 100%)',
            }}
        >
            <header className="grid grid-cols-[minmax(260px,1fr)_2fr_minmax(260px,1fr)] border-b border-[#6c5838] bg-[rgba(9,15,13,0.92)]">
                <div className="border-r border-[#57472f] px-6 py-4">
                    <OptimizedImage src={ASSETS.titleBanner} locale={effectiveLocale} alt="山屋惊魂" className="h-16 w-full object-contain object-left" draggable={false} />
                </div>
                <div className="flex flex-col items-center justify-center py-3">
                    <div className="text-xs uppercase tracking-[0.36em] text-[#e7c783]">剧本结果</div>
                    <div className="text-6xl font-bold uppercase tracking-[0.08em] text-[#b5ef75] drop-shadow-[0_0_18px_rgba(181,239,117,0.35)]">胜利</div>
                    <div className="text-lg uppercase tracking-[0.24em] text-[#f0dfb7]">幸存者逃脱</div>
                </div>
                <div className="flex flex-col justify-center border-l border-[#57472f] px-8">
                    <div className="text-xs uppercase tracking-[0.22em] text-[#d8bf81]">剧本</div>
                    <div className="mt-2 text-2xl font-semibold uppercase tracking-[0.12em] text-[#f2e2c0]">{result?.hauntTitle ?? '饥饿'}</div>
                </div>
            </header>

            <main className="grid min-h-0 flex-1 grid-cols-[29%_1fr_29%] gap-7 px-12 py-8">
                <section className="flex min-h-0 flex-col gap-5">
                    <div className="rounded-[18px] border border-[#6f8f44] bg-[rgba(13,30,20,0.82)] p-5">
                        <h2 className="text-center text-2xl font-semibold uppercase tracking-[0.18em] text-[#b8ea74]">幸存者</h2>
                        <div className="mt-5 grid gap-3">
                            {survivors.map((explorer) => (
                                <div key={explorer.playerId} className="grid grid-cols-[72px_1fr_52px] items-center gap-3 rounded-[12px] border border-[#53693b] bg-[rgba(8,17,13,0.72)] p-2">
                                    <OptimizedImage src={explorer.portraitAsset} locale={effectiveLocale} alt={explorer.displayName} className="h-[72px] w-[72px] object-contain" draggable={false} />
                                    <div>
                                        <div className="font-semibold text-[#f3e6c9]">{resolvePlayerName(explorer.playerId, explorer.displayName, matchData)}</div>
                                        <div className="mt-1 flex gap-1 text-xs text-[#b8c89a]">
                                            {Object.values(explorer.traits).map((value, index) => <span key={index} className="rounded-full border border-[#596d43] px-1.5">{value}</span>)}
                                        </div>
                                    </div>
                                    <div className="rounded-full border border-[#8abf55] py-2 text-center text-xl font-semibold text-[#bce879]">✓</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="min-h-[150px] rounded-[18px] border border-[#6f5b3a] bg-[rgba(9,15,13,0.82)] p-5">
                        <div className="text-lg font-semibold uppercase tracking-[0.16em] text-[#d8bf81]">幸存者逃脱</div>
                        <div className="mt-3 flex h-24 items-center justify-center rounded-[14px] border border-[#4d3f2b] bg-[rgba(8,13,11,0.74)]">
                            {survivors.map((explorer, index) => (
                                <OptimizedImage
                                    key={explorer.playerId}
                                    src={explorer.portraitAsset}
                                    locale={effectiveLocale}
                                    alt={explorer.displayName}
                                    className="h-20 w-20 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                                    style={{ marginLeft: index === 0 ? 0 : -22 }}
                                    draggable={false}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                <section className="flex min-h-0 flex-col justify-between rounded-[18px] border border-[#8b744d] bg-[#d8c69d] p-8 text-[#302719] shadow-[0_24px_56px_rgba(0,0,0,0.38)]">
                    <div>
                        <h2 className="text-center text-4xl font-semibold uppercase tracking-[0.16em]">饥饿</h2>
                        <div className="mt-8 grid grid-cols-2 gap-8 border-t border-[#8e7a55] pt-8">
                            <div>
                                <div className="text-lg font-semibold uppercase tracking-[0.16em]">目标</div>
                                <div className="mt-8 flex h-24 items-center">
                                    {survivors.map((explorer, index) => (
                                        <OptimizedImage
                                            key={explorer.playerId}
                                            src={explorer.portraitAsset}
                                            locale={effectiveLocale}
                                            alt={explorer.displayName}
                                            className="h-24 w-24 object-contain drop-shadow-[0_8px_18px_rgba(64,75,40,0.42)]"
                                            style={{ marginLeft: index === 0 ? 0 : -28 }}
                                            draggable={false}
                                        />
                                    ))}
                                </div>
                                <p className="mt-6 text-lg">所有幸存者逃脱。</p>
                                <div className="mt-10 inline-flex rotate-[-8deg] rounded-full border-4 border-[#5c7f39] px-7 py-3 text-2xl font-bold uppercase tracking-[0.14em] text-[#5c7f39]">完成</div>
                            </div>
                            <div className="border-l border-[#8e7a55] pl-8">
                                <div className="text-lg font-semibold uppercase tracking-[0.16em]">结果</div>
                                <div className="mt-8 flex h-24 items-center">
                                    {survivors.map((explorer, index) => (
                                        <OptimizedImage
                                            key={explorer.playerId}
                                            src={explorer.portraitAsset}
                                            locale={effectiveLocale}
                                            alt={explorer.displayName}
                                            className="h-24 w-24 object-contain drop-shadow-[0_8px_18px_rgba(64,75,40,0.42)]"
                                            style={{ marginLeft: index === 0 ? 0 : -28 }}
                                            draggable={false}
                                        />
                                    ))}
                                </div>
                                <div className="mt-6 text-4xl font-semibold uppercase tracking-[0.12em] text-[#5c7f39]">胜利</div>
                                <div className="mt-8 border-t border-[#8e7a55] pt-6">
                                    <div className="text-lg font-semibold uppercase tracking-[0.16em]">奖励</div>
                                    <div className="mt-4 flex gap-6 text-center text-3xl font-semibold">
                                        <span className="inline-flex items-center gap-2">
                                            <OptimizedImage src={ASSETS.room.sunroom} locale={effectiveLocale} alt="" className="h-9 w-9 rounded object-cover" draggable={false} />
                                            {result?.reward.stars ?? 4}
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                            <OptimizedImage src={ASSETS.deck.omen} locale={effectiveLocale} alt="" className="h-10 w-7 rounded object-cover" draggable={false} />
                                            {result?.reward.omens ?? 2}
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                            <OptimizedImage src={ASSETS.playerReference.front} locale={effectiveLocale} alt="" className="h-10 w-7 rounded object-cover" draggable={false} />
                                            {result?.reward.logs ?? 1}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mx-auto mt-8 flex gap-5">
                        <button className="rounded-[16px] border border-[#6f5b3a] bg-[rgba(18,24,20,0.95)] px-10 py-4 text-lg font-semibold uppercase tracking-[0.14em] text-[#d8bf81]">重赛</button>
                        <button className="rounded-[16px] border border-[#6f5b3a] bg-[rgba(18,24,20,0.95)] px-10 py-4 text-lg font-semibold uppercase tracking-[0.14em] text-[#d8bf81]">大厅</button>
                        <button className="rounded-[16px] border border-[#6f5b3a] bg-[rgba(18,24,20,0.95)] px-10 py-4 text-lg font-semibold uppercase tracking-[0.14em] text-[#d8bf81]">日志</button>
                    </div>
                </section>

                <section className="flex min-h-0 flex-col gap-5">
                    <div className="rounded-[18px] border border-[#894331] bg-[rgba(32,12,10,0.74)] p-5">
                        <h2 className="text-center text-2xl font-semibold uppercase tracking-[0.18em] text-[#ec6f50]">叛徒</h2>
                        {traitor ? (
                            <div className="mt-5 grid grid-cols-[88px_1fr_64px] items-center gap-4 rounded-[12px] border border-[#6b3a2f] bg-[rgba(8,12,10,0.68)] p-3">
                                <OptimizedImage src={traitor.portraitAsset} locale={effectiveLocale} alt={traitor.displayName} className="h-[88px] w-[88px] object-contain" draggable={false} />
                                    <div>
                                        <div className="font-semibold text-[#f3e6c9]">{resolvePlayerName(traitor.playerId, traitor.displayName, matchData)}</div>
                                        <div className="mt-1 text-sm uppercase tracking-[0.14em] text-[#d8a180]">饥饿</div>
                                    </div>
                                <OptimizedImage src={ASSETS.traitorBack} locale={effectiveLocale} alt="" className="h-14 w-10 rounded object-cover opacity-80" draggable={false} />
                            </div>
                        ) : null}
                        <OptimizedImage src={ASSETS.traitorBack} locale={effectiveLocale} alt="" className="mx-auto mt-8 h-24 w-16 rounded object-cover opacity-70" draggable={false} />
                        <div className="mt-3 text-center text-3xl font-bold uppercase tracking-[0.14em] text-[#ec6f50]">败退</div>
                    </div>
                    <div className="rounded-[18px] border border-[#6f5b3a] bg-[rgba(9,15,13,0.82)] p-5">
                        <div className="text-center text-lg font-semibold uppercase tracking-[0.18em] text-[#d8bf81]">统计</div>
                        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                            <div>
                                <OptimizedImage src={ASSETS.room.backGround} locale={effectiveLocale} alt="" className="mx-auto h-10 w-10 rounded object-cover" draggable={false} />
                                <div className="mt-2 text-3xl font-semibold text-[#f3e6c9]">{result?.stats.roomsExplored ?? core.rooms.filter((room) => room.state === 'discovered').length}</div>
                                <div className="text-xs uppercase tracking-[0.14em] text-[#d8bf81]">房间</div>
                            </div>
                            <div>
                                <OptimizedImage src={ASSETS.deck.omen} locale={effectiveLocale} alt="" className="mx-auto h-10 w-7 rounded object-cover" draggable={false} />
                                <div className="mt-2 text-3xl font-semibold text-[#f3e6c9]">{result?.stats.omensDrawn ?? 0}</div>
                                <div className="text-xs uppercase tracking-[0.14em] text-[#d8bf81]">预兆</div>
                            </div>
                            <div>
                                <OptimizedImage src={ASSETS.deck.event} locale={effectiveLocale} alt="" className="mx-auto h-10 w-7 rounded object-cover" draggable={false} />
                                <div className="mt-2 text-3xl font-semibold text-[#f3e6c9]">{result?.stats.eventsDrawn ?? 0}</div>
                                <div className="text-xs uppercase tracking-[0.14em] text-[#d8bf81]">事件</div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default function BetrayalBoard({ G, dispatch, playerID, matchData, locale }: Props) {
    const { t } = useTranslation(['game-betrayal', 'common']);
    const effectiveLocale = locale || 'zh-CN';
    const baseCore = React.useMemo(
        () => (isBetrayalCore(G?.core) ? G.core : createBetrayalCharacterSelectCore()),
        [G],
    );
    const viewerPlayerId = String(playerID ?? baseCore.currentPlayer ?? baseCore.playerIds[0] ?? '0');
    const [selectedExplorerId, setSelectedExplorerId] = React.useState(
        () => baseCore.selectedExplorerByPlayerId[viewerPlayerId] ?? EXPLORER_CATALOG[0]!.explorerId,
    );
    const [previewState, setPreviewState] = React.useState<PreviewState>(() => createInitialPreviewState(baseCore));
    const [referenceOpen, setReferenceOpen] = React.useState(false);
    const [referenceSide, setReferenceSide] = React.useState<'front' | 'back'>('front');
    const [scenarioOpen, setScenarioOpen] = React.useState(false);
    const [roomPreviewId, setRoomPreviewId] = React.useState<string | null>(null);
    const roomGridRef = React.useRef<HTMLDivElement | null>(null);
    const roomGridDragRef = React.useRef<RoomGridDragState>({
        isDragging: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
        hasMoved: false,
    });

    React.useEffect(() => {
        setPreviewState(createInitialPreviewState(baseCore));
    }, [baseCore]);

    React.useEffect(() => {
        setSelectedExplorerId(baseCore.selectedExplorerByPlayerId[viewerPlayerId] ?? EXPLORER_CATALOG[0]!.explorerId);
    }, [baseCore, viewerPlayerId]);

    const dispatchCommand = React.useCallback(<Type extends keyof BetrayalCommandMap>(
        type: Type,
        payload: BetrayalCommandMap[Type],
    ) => {
        dispatch(type, payload);
    }, [dispatch]);

    const handleSelectExplorer = React.useCallback((explorerId: string) => {
        setSelectedExplorerId(explorerId);
        dispatchCommand(BETRAYAL_COMMANDS.SELECT_EXPLORER, { explorerId });
    }, [dispatchCommand]);

    const handleConfirmExplorer = React.useCallback(() => {
        if (baseCore.selectedExplorerByPlayerId[viewerPlayerId] !== selectedExplorerId) {
            dispatchCommand(BETRAYAL_COMMANDS.SELECT_EXPLORER, { explorerId: selectedExplorerId });
        }
        dispatchCommand(BETRAYAL_COMMANDS.CONFIRM_EXPLORER, {});
    }, [baseCore.selectedExplorerByPlayerId, dispatchCommand, selectedExplorerId, viewerPlayerId]);

    const handleStartScenario = React.useCallback(() => {
        dispatchCommand(BETRAYAL_COMMANDS.START_FIRST_SCENARIO, {});
    }, [dispatchCommand]);

    const core = previewState.core;
    const roomOccupants = React.useMemo(() => buildRoomOccupants(core), [core]);
    const roomLookup = React.useMemo(
        () => new Map(core.rooms.map((room) => [room.id, room])),
        [core.rooms],
    );
    const roomCanvasStyle = React.useMemo(() => resolveRoomCanvasStyle(core.rooms), [core.rooms]);
    const previewRoom = React.useMemo(
        () => core.rooms.find((room) => room.id === roomPreviewId) ?? null,
        [core.rooms, roomPreviewId],
    );
    const previewRoomAsset = previewRoom
        ? resolveRoomTileAsset(previewRoom, previewRoom.state === 'discovered')
        : null;
    const focusActiveRoomInView = React.useCallback(() => {
        const roomGrid = roomGridRef.current;
        if (!roomGrid) {
            return;
        }
        const activeRoomShell = roomGrid.querySelector<HTMLElement>(`[data-testid="betrayal-room-shell-${core.activeRoomId}"]`);
        if (!activeRoomShell) {
            return;
        }
        activeRoomShell.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'auto',
        });
    }, [core.activeRoomId]);

    React.useEffect(() => {
        if (core.phase !== 'preHaunt') {
            return undefined;
        }
        const frameId = window.requestAnimationFrame(() => {
            focusActiveRoomInView();
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [core.activeRoomId, core.phase, focusActiveRoomInView]);

    const phaseItems = React.useMemo(
        () => [{ id: 'preHaunt', label: t('board.phase.preHaunt') }],
        [t],
    );
    const currentPlayerLabel = t('board.status.currentTurn', {
        player: resolvePlayerName(core.currentPlayer, core.currentExplorer.displayName, matchData),
    });
    const deckItems = React.useMemo(() => buildDeckItems(core, t), [core, t]);
    const discardItems = React.useMemo(() => buildDiscardItems(core, t), [core, t]);
    const selectedInventoryCard = core.currentExplorerInventory.find((item) => item.id === previewState.selectedInventoryCardId)
        ?? core.currentExplorerInventory[0]
        ?? null;
    const latestLogEntry = previewState.logEntries[0] ?? null;
    const earlierLogEntries = React.useMemo(() => previewState.logEntries.slice(1), [previewState.logEntries]);
    const moveTargetRooms = React.useMemo(() => resolveMoveTargetRooms(core), [core]);
    const moveTargetRoomIds = React.useMemo(() => new Set(moveTargetRooms.map((room) => room.id)), [moveTargetRooms]);
    const nextExplorableSlot = React.useMemo(() => resolveNextExplorableRoomSlot(core), [core]);
    const tradeTargets = React.useMemo(() => resolveTradeTargets(core), [core]);
    const selectedTradeTargetPlayerId = React.useMemo(
        () => resolveSelectedTradeTargetPlayerId(tradeTargets, previewState.selectedTradeTargetPlayerId),
        [previewState.selectedTradeTargetPlayerId, tradeTargets],
    );
    const selectedTradeTarget = React.useMemo(
        () => tradeTargets.find((explorer) => explorer.playerId === selectedTradeTargetPlayerId) ?? null,
        [selectedTradeTargetPlayerId, tradeTargets],
    );
    const selectedCardUsedThisTurn = selectedInventoryCard
        ? previewState.usedCardIdsThisTurn.includes(selectedInventoryCard.id)
        : false;
    const tradeStatusText = selectedTradeTarget
        ? t('board.status.tradeTarget', {
            player: resolvePlayerName(
                selectedTradeTarget.playerId,
                selectedTradeTarget.displayName,
                matchData,
            ),
        })
        : t('board.status.noTradeTargets');
    const useStatusText = selectedInventoryCard
        ? selectedCardUsedThisTurn
            ? t('board.status.cardUsedThisTurn')
            : t('board.status.usePreview', {
                effect: resolvePreviewUseEffectLabel(selectedInventoryCard, t),
            })
        : t('board.status.noSelectedCard');
    const shouldShowLatestDiscovery = previewState.latestDiscovery
        && previewState.latestDiscoveryOwnerPlayerId === core.currentExplorer.playerId;
    const latestDiscoveryTitle = previewState.latestDiscovery?.title;
    const turnHintText = previewState.interactionMode === 'move'
        ? t('board.activity.chooseMoveTarget')
        : moveTargetRooms.length > 0
            ? t('board.status.turnHintMove', {
                targets: formatRoomTargetList(moveTargetRooms),
            })
            : nextExplorableSlot
                ? t('board.status.turnHintExplore', {
                    floor: resolveFloorLabel(nextExplorableSlot.floor),
                })
                : t('board.status.turnHintHold');
    const roomFocusState = React.useMemo(() => {
        if (previewState.interactionMode === 'move' && moveTargetRooms.length === 1) {
            return {
                label: t('board.status.focusMoveMode', { room: moveTargetRooms[0]!.name }),
                actionKind: 'move' as const,
                roomId: moveTargetRooms[0]!.id,
            };
        }
        if (core.recommendedAction === 'move' && moveTargetRooms.length === 1) {
            return {
                label: t('board.status.focusMoveTarget', { room: moveTargetRooms[0]!.name }),
                actionKind: 'move' as const,
                roomId: moveTargetRooms[0]!.id,
            };
        }
        if (core.recommendedAction === 'use' && selectedInventoryCard && !selectedCardUsedThisTurn) {
            return {
                label: t('board.status.focusUseCard', { card: selectedInventoryCard.name }),
                actionKind: 'use' as const,
                roomId: null,
            };
        }
        if (core.recommendedAction === 'trade' && tradeTargets.length === 1 && selectedTradeTarget) {
            return {
                label: t('board.status.focusTradeTarget', {
                    player: resolvePlayerName(
                        selectedTradeTarget.playerId,
                        selectedTradeTarget.displayName,
                        matchData,
                    ),
                }),
                actionKind: 'trade' as const,
                roomId: null,
            };
        }
        return null;
    }, [
        core.recommendedAction,
        matchData,
        moveTargetRooms,
        previewState.interactionMode,
        selectedCardUsedThisTurn,
        selectedInventoryCard,
        selectedTradeTarget,
        t,
        tradeTargets.length,
    ]);
    const tradeShortcutState = React.useMemo(() => {
        if (tradeTargets.length !== 1 || !selectedTradeTarget || core.currentExplorerInventory.length === 0) {
            return null;
        }
        if (roomFocusState?.actionKind === 'trade') {
            return null;
        }
        return {
            label: t('board.status.focusTradeTarget', {
                player: resolvePlayerName(
                    selectedTradeTarget.playerId,
                    selectedTradeTarget.displayName,
                    matchData,
                ),
            }),
        };
    }, [
        core.currentExplorerInventory.length,
        matchData,
        roomFocusState?.actionKind,
        selectedTradeTarget,
        t,
        tradeTargets.length,
    ]);
    const actionCueText = React.useMemo(() => {
        if (previewState.interactionMode === 'move') {
            if (moveTargetRooms.length === 1) {
                return t('board.status.actionCueMoveSingle', { room: moveTargetRooms[0]!.name });
            }
            return t('board.status.actionCueMoveMode');
        }
        switch (core.recommendedAction) {
            case 'move':
                if (moveTargetRooms.length === 1) {
                    return t('board.status.actionCueMoveSingle', { room: moveTargetRooms[0]!.name });
                }
                return t('board.status.actionCueMoveMany');
            case 'explore':
                return nextExplorableSlot
                    ? t('board.status.actionCueExplore', {
                        floor: resolveFloorLabel(nextExplorableSlot.floor),
                    })
                    : t('board.status.actionCueExplore', {
                        floor: t('board.rooms.unknown'),
                    });
            case 'use':
                return selectedInventoryCard && !selectedCardUsedThisTurn
                    ? t('board.status.actionCueUseCard', { card: selectedInventoryCard.name })
                    : t('board.status.actionCueUse');
            case 'trade':
                return selectedTradeTarget
                    ? t('board.status.actionCueTradePlayer', {
                        player: resolvePlayerName(
                            selectedTradeTarget.playerId,
                            selectedTradeTarget.displayName,
                            matchData,
                        ),
                    })
                    : t('board.status.actionCueTrade');
            case 'endTurn':
                return t('board.status.actionCueEndTurn');
            default:
                return t('board.status.actionCueMoveMany');
        }
    }, [
        core.recommendedAction,
        matchData,
        moveTargetRooms,
        nextExplorableSlot,
        previewState.interactionMode,
        selectedCardUsedThisTurn,
        selectedInventoryCard,
        selectedTradeTarget,
        t,
    ]);

    const toggleReferenceSide = React.useCallback(() => {
        setReferenceSide((previousSide) => (previousSide === 'front' ? 'back' : 'front'));
    }, []);

    const scrollToSection = React.useCallback((sectionId: string) => {
        if (typeof document === 'undefined') {
            return;
        }
        document.getElementById(sectionId)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    }, []);

    const handleRoomGridPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }
        const grid = roomGridRef.current;
        if (!grid) {
            return;
        }

        roomGridDragRef.current = {
            isDragging: true,
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: grid.scrollLeft,
            scrollTop: grid.scrollTop,
            hasMoved: false,
        };
        grid.setPointerCapture(event.pointerId);
        grid.setAttribute('data-drag-ready', 'true');
    }, []);

    const handleRoomGridPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const grid = roomGridRef.current;
        const dragState = roomGridDragRef.current;
        if (!grid || !dragState.isDragging) {
            return;
        }

        const deltaX = event.clientX - dragState.startX;
        const deltaY = event.clientY - dragState.startY;
        if (!dragState.hasMoved && Math.hypot(deltaX, deltaY) > 4) {
            dragState.hasMoved = true;
            grid.setAttribute('data-dragging', 'true');
        }
        if (dragState.hasMoved) {
            event.preventDefault();
        }
        grid.scrollLeft = dragState.scrollLeft - deltaX;
        grid.scrollTop = dragState.scrollTop - deltaY;
    }, []);

    const handleRoomGridPointerEnd = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const grid = roomGridRef.current;
        const dragState = roomGridDragRef.current;
        if (!grid || !dragState.isDragging) {
            return;
        }

        dragState.isDragging = false;
        grid.removeAttribute('data-drag-ready');
        grid.removeAttribute('data-dragging');
        if (grid.hasPointerCapture(event.pointerId)) {
            grid.releasePointerCapture(event.pointerId);
        }

        if (dragState.hasMoved) {
            const suppressClick = (clickEvent: MouseEvent) => {
                clickEvent.preventDefault();
                clickEvent.stopPropagation();
            };
            grid.addEventListener('click', suppressClick, { capture: true });
            window.setTimeout(() => {
                grid.removeEventListener('click', suppressClick, { capture: true });
            }, 200);
        }
    }, []);

    React.useEffect(() => {
        if (!latestDiscoveryTitle || typeof window === 'undefined' || window.innerWidth >= 768) {
            return;
        }
        document.getElementById('betrayal-room-panel')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    }, [latestDiscoveryTitle]);

    const handleMoveToRoom = React.useCallback((roomId: string) => {
        dispatchCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, { roomId });
        setPreviewState((previousState) => {
            if (previousState.core.movesRemaining <= 0 || roomId === previousState.core.activeRoomId) {
                return previousState;
            }
            const allowedMoveTargetIds = new Set(resolveMoveTargetRooms(previousState.core).map((room) => room.id));
            const nextCore = cloneCore(previousState.core);
            const targetRoom = nextCore.rooms.find((room) => room.id === roomId);
            if (!targetRoom || targetRoom.state !== 'discovered' || !allowedMoveTargetIds.has(roomId)) {
                return previousState;
            }
            const currentExplorerLabel = resolvePlayerName(
                nextCore.currentExplorer.playerId,
                nextCore.currentExplorer.displayName,
                matchData,
            );

            nextCore.currentExplorer.roomId = roomId;
            nextCore.movesRemaining = Math.max(0, nextCore.movesRemaining - 1);
            nextCore.recommendedAction = resolveContextualRecommendedAction(nextCore);

            return {
                ...previousState,
                core: syncCurrentExplorerProjection(nextCore),
                roomNotes: {
                    ...previousState.roomNotes,
                    [roomId]: previousState.roomNotes[roomId] ?? targetRoom.hint,
                },
                highlightedDeckKind: null,
                interactionMode: 'default',
                logEntries: appendPreviewLog(
                    previousState.logEntries,
                    t('board.activity.moveToRoom', {
                        explorer: currentExplorerLabel,
                        room: targetRoom.name,
                    }),
                    'neutral',
                ),
            };
        });
    }, [dispatchCommand, matchData, t]);

    const handleMoveAction = React.useCallback(() => {
        setPreviewState((previousState) => {
            if (previousState.interactionMode === 'move') {
                return {
                    ...previousState,
                    interactionMode: 'default',
                    logEntries: appendPreviewLog(
                        previousState.logEntries,
                        t('board.activity.cancelMoveTarget'),
                        'neutral',
                    ),
                };
            }
            if (previousState.core.movesRemaining <= 0 || resolveMoveTargetRooms(previousState.core).length === 0) {
                return {
                    ...previousState,
                    logEntries: appendPreviewLog(
                        previousState.logEntries,
                        t('board.activity.noMoveTargets'),
                        'warning',
                    ),
                };
            }
            return {
                ...previousState,
                highlightedDeckKind: null,
                interactionMode: 'move',
                logEntries: appendPreviewLog(
                    previousState.logEntries,
                    t('board.activity.chooseMoveTarget'),
                    'neutral',
                ),
            };
        });
    }, [t]);

    const handleExploreAction = React.useCallback(() => {
        dispatchCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, {});
        setPreviewState((previousState) => {
            const nextDeckKind = resolveNextPreviewDeckKind(previousState.core, previousState.exploreIndex);
            if (!nextDeckKind) {
                return {
                    ...previousState,
                    logEntries: appendPreviewLog(
                        previousState.logEntries,
                        t('board.activity.decksEmpty'),
                        'warning',
                    ),
                };
            }
            const nextRoomSlot = resolveNextExplorableRoomSlot(previousState.core);
            if (!nextRoomSlot) {
                return {
                    ...previousState,
                    logEntries: appendPreviewLog(
                        previousState.logEntries,
                        t('board.activity.noExploreSlots'),
                        'warning',
                    ),
                };
            }

            const nextCore = cloneCore(previousState.core);
            const currentExplorerLabel = resolvePlayerName(
                nextCore.currentExplorer.playerId,
                nextCore.currentExplorer.displayName,
                matchData,
            );
            const targetRoom = nextCore.rooms.find((room) => room.id === nextRoomSlot.id);
            if (!targetRoom) {
                return previousState;
            }
            const roomTemplate = resolvePreviewRoomTemplate(previousState.core, targetRoom.floor, previousState.exploreIndex);
            targetRoom.name = roomTemplate.name;
            targetRoom.state = 'discovered';
            targetRoom.hint = roomTemplate.hint;
            targetRoom.tags = [...roomTemplate.tags];
            targetRoom.discoveryReward = nextDeckKind;
            nextCore.currentExplorer.roomId = targetRoom.id;
            nextCore.deckCounts[nextDeckKind] = Math.max(0, nextCore.deckCounts[nextDeckKind] - 1);

            let nextSelectedInventoryCardId = previousState.selectedInventoryCardId;
            let nextLog = '';
            let nextTone: PreviewLogEntry['tone'] = 'accent';
            let nextDiscovery: PreviewDiscoveryResult | null = null;

            if (nextDeckKind === 'event') {
                const eventCard = resolvePreviewEvent(previousState.exploreIndex);
                const eventEffectLabel = resolvePreviewUseEffectLabel(eventCard.effect, t);
                nextCore.discardCounts.event += 1;
                if (eventCard.effect.mode === 'move') {
                    nextCore.movesRemaining = Math.min(5, Math.max(0, nextCore.movesRemaining + eventCard.effect.amount));
                } else {
                    nextCore.currentExplorer.traits[eventCard.effect.trait!] += eventCard.effect.amount;
                }
                nextTone = eventCard.effect.amount < 0 ? 'warning' : 'accent';
                nextLog = t('board.activity.exploreRoomEventResolved', {
                    explorer: currentExplorerLabel,
                    room: targetRoom.name,
                    card: eventCard.name,
                    effect: eventEffectLabel,
                });
                nextDiscovery = {
                    kind: 'event',
                    title: eventCard.name,
                    summary: t('board.discovery.eventResolved'),
                    detail: eventEffectLabel,
                    tone: nextTone,
                };
            } else {
                const drawnCard = createPreviewDrawCard(nextDeckKind, previousState.exploreIndex);
                nextCore.currentExplorer.inventory = [...nextCore.currentExplorer.inventory, drawnCard];
                nextSelectedInventoryCardId = drawnCard.id;
                nextLog = t('board.activity.exploreRoomCard', {
                    explorer: currentExplorerLabel,
                    room: targetRoom.name,
                    card: drawnCard.name,
                });
                nextDiscovery = {
                    kind: nextDeckKind,
                    title: drawnCard.name,
                    summary: t('board.discovery.readyToUse'),
                    detail: resolvePreviewUseEffectLabel(drawnCard, t),
                    tone: 'accent',
                };
            }
            nextCore.recommendedAction = resolveContextualRecommendedAction(nextCore, {
                canUseSelectedCard: nextDeckKind !== 'event',
                preferUse: nextDeckKind !== 'event',
            });

            return {
                ...previousState,
                core: syncCurrentExplorerProjection(nextCore),
                selectedInventoryCardId: nextSelectedInventoryCardId,
                latestDiscovery: nextDiscovery,
                latestDiscoveryOwnerPlayerId: nextCore.currentExplorer.playerId,
                roomNotes: {
                    ...previousState.roomNotes,
                    [targetRoom.id]: roomTemplate.hint,
                },
                exploreIndex: previousState.exploreIndex + 1,
                highlightedDeckKind: nextDeckKind,
                interactionMode: 'default',
                logEntries: appendPreviewLog(previousState.logEntries, nextLog, nextTone),
            };
        });
    }, [dispatchCommand, matchData, t]);

    const handleUseAction = React.useCallback(() => {
        const cardId = selectedInventoryCard?.id;
        dispatchCommand(BETRAYAL_COMMANDS.USE_POSSESSION, cardId ? { cardId } : {});
        setPreviewState((previousState) => {
            const card = previousState.core.currentExplorerInventory.find((item) => item.id === previousState.selectedInventoryCardId)
                ?? previousState.core.currentExplorerInventory[0]
                ?? null;
            if (!card) {
                return previousState;
            }
            if (previousState.usedCardIdsThisTurn.includes(card.id)) {
                return {
                    ...previousState,
                    logEntries: appendPreviewLog(
                        previousState.logEntries,
                        t('board.activity.cardAlreadyUsed', {
                            card: card.name,
                        }),
                        'warning',
                    ),
                };
            }

            const nextCore = cloneCore(previousState.core);
            const currentExplorerLabel = resolvePlayerName(
                nextCore.currentExplorer.playerId,
                nextCore.currentExplorer.displayName,
                matchData,
            );
            const useProfile = resolvePreviewUseEffectProfile(card);
            let nextLog: string;

            if (useProfile.mode === 'move') {
                nextCore.movesRemaining = Math.min(5, Math.max(0, nextCore.movesRemaining + useProfile.amount));
                nextLog = t('board.activity.useCardMove', {
                    explorer: currentExplorerLabel,
                    card: card.name,
                    value: useProfile.amount,
                });
            } else {
                nextCore.currentExplorer.traits[useProfile.trait!] += useProfile.amount;
                nextLog = t('board.activity.useCardTrait', {
                    explorer: currentExplorerLabel,
                    card: card.name,
                    trait: t(`board.traits.${useProfile.trait}`),
                    value: useProfile.amount,
                });
            }
            nextCore.recommendedAction = resolveContextualRecommendedAction(nextCore);

            return {
                ...previousState,
                core: syncCurrentExplorerProjection(nextCore),
                selectedInventoryCardId: card.id,
                usedCardIdsThisTurn: [...previousState.usedCardIdsThisTurn, card.id],
                highlightedDeckKind: null,
                interactionMode: 'default',
                logEntries: appendPreviewLog(
                    previousState.logEntries,
                    nextLog,
                    'accent',
                ),
            };
        });
    }, [dispatchCommand, matchData, selectedInventoryCard?.id, t]);

    const handleTradeAction = React.useCallback(() => {
        const cardId = selectedInventoryCard?.id;
        dispatchCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, {
            ...(cardId ? { cardId } : {}),
            ...(selectedTradeTargetPlayerId ? { targetPlayerId: selectedTradeTargetPlayerId } : {}),
        });
        setPreviewState((previousState) => {
            const card = previousState.core.currentExplorerInventory.find((item) => item.id === previousState.selectedInventoryCardId)
                ?? previousState.core.currentExplorerInventory[0]
                ?? null;
            if (!card) {
                return previousState;
            }
            const tradeTargetsInRoom = resolveTradeTargets(previousState.core);
            const tradeTargetPlayerId = resolveSelectedTradeTargetPlayerId(
                tradeTargetsInRoom,
                previousState.selectedTradeTargetPlayerId,
            );
            const tradeTarget = tradeTargetsInRoom.find((item) => item.playerId === tradeTargetPlayerId) ?? null;
            if (!tradeTarget) {
                return {
                    ...previousState,
                    interactionMode: 'default',
                    logEntries: appendPreviewLog(
                        previousState.logEntries,
                        t('board.activity.noTradeTargets'),
                        'warning',
                    ),
                };
            }

            const nextCore = cloneCore(previousState.core);
            const nextTarget = nextCore.otherExplorers.find((item) => item.playerId === tradeTarget.playerId);
            if (!nextTarget) {
                return previousState;
            }
            const currentExplorerLabel = resolvePlayerName(
                nextCore.currentExplorer.playerId,
                nextCore.currentExplorer.displayName,
                matchData,
            );
            const targetExplorerLabel = resolvePlayerName(
                nextTarget.playerId,
                nextTarget.displayName,
                matchData,
            );

            nextCore.currentExplorer.inventory = nextCore.currentExplorer.inventory.filter((item) => item.id !== card.id);
            nextTarget.inventory = [...nextTarget.inventory, card];
            nextCore.recommendedAction = resolveContextualRecommendedAction(nextCore, {
                canUseSelectedCard: Boolean(nextCore.currentExplorer.inventory[0]),
            });

            return {
                ...previousState,
                core: syncCurrentExplorerProjection(nextCore),
                selectedInventoryCardId: nextCore.currentExplorer.inventory[0]?.id ?? null,
                selectedTradeTargetPlayerId: tradeTarget.playerId,
                highlightedDeckKind: null,
                interactionMode: 'default',
                logEntries: appendPreviewLog(
                    previousState.logEntries,
                    t('board.activity.tradeCard', {
                        from: currentExplorerLabel,
                        to: targetExplorerLabel,
                        card: card.name,
                    }),
                    'neutral',
                ),
            };
        });
    }, [dispatchCommand, matchData, selectedInventoryCard?.id, selectedTradeTargetPlayerId, t]);

    const handleEndTurnAction = React.useCallback(() => {
        dispatchCommand(BETRAYAL_COMMANDS.END_TURN, {});
        setPreviewState((previousState) => {
            const nextCore = cloneCore(previousState.core);
            const rotatedExplorers = [...nextCore.otherExplorers, nextCore.currentExplorer];
            if (rotatedExplorers.length === 0) {
                return previousState;
            }

            nextCore.currentExplorer = cloneExplorer(rotatedExplorers[0]!);
            nextCore.otherExplorers = rotatedExplorers.slice(1).map(cloneExplorer);
            nextCore.movesRemaining = 4;
            nextCore.recommendedAction = 'move';

            const syncedCore = syncCurrentExplorerProjection(nextCore);
            const nextExplorerLabel = resolvePlayerName(
                syncedCore.currentExplorer.playerId,
                syncedCore.currentExplorer.displayName,
                matchData,
            );
            const nextMoveTargets = resolveMoveTargetRooms(syncedCore);
            const nextTurnLog = nextMoveTargets.length > 0
                ? t('board.activity.nextExplorerWithTargets', {
                    explorer: nextExplorerLabel,
                    targets: formatRoomTargetList(nextMoveTargets),
                })
                : t('board.activity.nextExplorer', {
                    explorer: nextExplorerLabel,
                });
            return {
                ...previousState,
                core: syncedCore,
                selectedInventoryCardId: syncedCore.currentExplorerInventory[0]?.id ?? null,
                selectedTradeTargetPlayerId: null,
                usedCardIdsThisTurn: [],
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                interactionMode: 'default',
                logEntries: appendPreviewLog(
                    previousState.logEntries,
                    nextTurnLog,
                    'accent',
                ),
            };
        });
    }, [dispatchCommand, matchData, t]);

    const handleCompleteFirstScenario = React.useCallback(() => {
        dispatchCommand(BETRAYAL_COMMANDS.COMPLETE_FIRST_SCENARIO, {});
    }, [dispatchCommand]);

    const handleRoomFocusAction = React.useCallback(() => {
        if (!roomFocusState) {
            return;
        }
        if (roomFocusState.actionKind === 'move' && roomFocusState.roomId) {
            handleMoveToRoom(roomFocusState.roomId);
            return;
        }
        if (roomFocusState.actionKind === 'trade') {
            handleTradeAction();
            return;
        }
        if (roomFocusState.actionKind === 'use') {
            handleUseAction();
        }
    }, [handleMoveToRoom, handleTradeAction, handleUseAction, roomFocusState]);

    const actionItems = React.useMemo<ActionBarAction[]>(() => ([
        {
            id: 'move',
            label: previewState.interactionMode === 'move' ? t('board.actions.cancelMove') : t('board.actions.move'),
            disabled: core.movesRemaining <= 0,
            variant: 'secondary',
        },
        {
            id: 'explore',
            label: t('board.actions.explore'),
            disabled: !resolveNextPreviewDeckKind(core, previewState.exploreIndex) || !nextExplorableSlot,
            variant: 'primary',
        },
        { id: 'trade', label: t('board.actions.trade'), disabled: core.currentExplorerInventory.length === 0 || tradeTargets.length === 0, variant: 'secondary' },
        { id: 'use', label: t('board.actions.use'), disabled: core.currentExplorerInventory.length === 0 || selectedCardUsedThisTurn, variant: 'secondary' },
        { id: 'endTurn', label: t('board.actions.endTurn'), disabled: false, variant: 'ghost' },
    ]), [core, nextExplorableSlot, previewState.exploreIndex, previewState.interactionMode, selectedCardUsedThisTurn, t, tradeTargets.length]);

    const actionHandlerMap: Record<ActionBarAction['id'], () => void> = {
        move: handleMoveAction,
        explore: handleExploreAction,
        trade: handleTradeAction,
        use: handleUseAction,
        endTurn: handleEndTurnAction,
    };

    if (baseCore.phase === 'characterSelect') {
        return (
            <CharacterSelectScreen
                core={baseCore}
                matchData={matchData}
                effectiveLocale={effectiveLocale}
                viewerPlayerId={viewerPlayerId}
                selectedExplorerId={selectedExplorerId}
                onSelectExplorer={handleSelectExplorer}
                onConfirmExplorer={handleConfirmExplorer}
                onStartScenario={handleStartScenario}
            />
        );
    }

    if (baseCore.phase === 'endgame') {
        return (
            <EndgameScreen
                core={baseCore}
                matchData={matchData}
                effectiveLocale={effectiveLocale}
            />
        );
    }

    return (
        <div
            data-testid="betrayal-board"
            className="relative flex h-full min-h-full flex-col overflow-x-hidden overflow-y-auto bg-[#0c1512] text-[#f1e8d4] xl:overflow-hidden"
            style={{
                backgroundImage: [
                    'radial-gradient(circle at top, rgba(146, 116, 58, 0.18), transparent 30%)',
                    'linear-gradient(180deg, rgba(11, 22, 18, 0.98) 0%, rgba(8, 15, 13, 1) 100%)',
                ].join(','),
            }}
        >
            <div className="mx-auto flex h-full min-h-full w-full max-w-[1800px] flex-col gap-3 px-3 py-3 md:gap-4 md:px-5 md:py-4">
                <header className="overflow-hidden rounded-[20px] border border-[#5b4a32] bg-[rgba(9,15,13,0.94)] shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
                    <div className="grid min-h-[76px] grid-cols-[minmax(220px,1fr)_minmax(220px,1.1fr)_minmax(260px,1fr)_72px] items-stretch divide-x divide-[#3e3528]">
                        <div className="flex items-center px-4">
                            <OptimizedImage
                                src={ASSETS.titleBanner}
                                locale={effectiveLocale}
                                alt={t('title')}
                                className="h-14 w-full max-w-[310px] object-contain object-left"
                                draggable={false}
                            />
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-[11px] uppercase tracking-[0.28em] text-[#b99b5f]">PHASE</span>
                            <span className="mt-1 text-xl font-semibold uppercase tracking-[0.18em] text-[#f0d29a]">
                                {t('board.phase.preHaunt')}
                            </span>
                        </div>
                        <div className="flex items-center justify-end gap-4 px-5" data-testid="betrayal-status-chip">
                            <div className="text-right">
                                <div className="text-[11px] uppercase tracking-[0.24em] text-[#b99b5f]">TURN</div>
                                <div className="mt-1 text-lg font-semibold uppercase tracking-[0.12em] text-[#f0d29a]">
                                    {resolvePlayerName(core.currentPlayer, core.currentExplorer.displayName, matchData)}
                                </div>
                            </div>
                            <div className="grid h-14 w-14 place-items-center rounded-full border border-[#756244] bg-[rgba(25,31,19,0.92)] text-center shadow-[0_0_18px_rgba(130,177,76,0.18)]">
                                <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b5ef42]">MOVE</div>
                                    <div className="text-xl font-bold text-[#c8f05e]">{core.movesRemaining}</div>
                                    <span className="sr-only">
                                        {t('board.status.movesRemaining', { count: core.movesRemaining })}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReferenceOpen(true)}
                            data-testid="betrayal-open-reference"
                            className="grid place-items-center text-[#d8bf81] transition hover:bg-[rgba(64,50,30,0.45)]"
                            title={t('board.reference.button')}
                        >
                            ⚙
                        </button>
                    </div>
                    <PhaseHudSkeleton
                        phases={phaseItems}
                        currentPhaseId={core.phase}
                        statusText={t('board.status.recommendedAction', {
                            action: t(`board.actions.${core.recommendedAction}`),
                        })}
                        currentPlayerLabel={currentPlayerLabel}
                        className="sr-only"
                        renderPhaseItem={(phase) => <span>{phase.label}</span>}
                        renderStatus={(text) => <span>{text}</span>}
                        renderCurrentPlayer={(label) => <span>{label}</span>}
                    />
                </header>

                <main className="grid min-h-0 flex-1 gap-3 overflow-y-auto pb-[13.5rem] xl:grid-cols-[236px_minmax(0,1fr)_220px] xl:overflow-hidden xl:pb-0">
                    <section className="order-2 grid min-h-0 content-start gap-3 xl:order-1 xl:overflow-y-auto xl:pr-1">
                        <article className="rounded-[22px] border border-[#635238] bg-[rgba(16,23,20,0.88)] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] md:p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-[96px] shrink-0 overflow-hidden rounded-[14px] border border-[#6f5b3a] bg-[rgba(22,18,13,0.86)] shadow-[0_10px_28px_rgba(0,0,0,0.32)] md:w-[118px] md:rounded-[16px]">
                                    <OptimizedImage
                                        src={core.currentExplorer.portraitAsset}
                                        locale={effectiveLocale}
                                        alt={core.currentExplorer.displayName}
                                        className="aspect-[3/4] h-auto w-full object-cover"
                                        draggable={false}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#a89d84]">
                                        {t('board.sections.currentExplorer')}
                                    </div>
                                    <div className="mt-1 text-xl font-semibold text-[#f3ead6]">
                                        {resolvePlayerName(core.currentExplorer.playerId, core.currentExplorer.displayName, matchData)}
                                    </div>
                                    <div className="mt-1 text-sm text-[#c6ba9f]">
                                        {core.rooms.find((room) => room.id === core.currentExplorer.roomId)?.name || t('board.rooms.unknown')}
                                    </div>
                                    <div className="mt-2.5 overflow-hidden rounded-[14px] border border-[#58472f] bg-[rgba(33,24,18,0.82)]">
                                        <OptimizedImage
                                            src={ASSETS.traitTrack}
                                            locale={effectiveLocale}
                                            alt={t('board.sections.traits')}
                                            className="h-12 w-full object-cover opacity-90 sm:h-16"
                                            draggable={false}
                                        />
                                    </div>
                                </div>
                            </div>

                            <PlayerPanelSkeleton
                                player={buildPanelData(core.currentExplorer, matchData)}
                                isCurrentPlayer
                                className="mt-3 grid gap-2.5"
                                renderResource={(key, value) => (
                                    <div className="flex items-center gap-3 rounded-[14px] border border-[#5d4f36] bg-[rgba(34,26,20,0.82)] px-3 py-2">
                                        <div className="h-7 w-7 overflow-hidden rounded-full border border-[#7a6746] bg-[rgba(11,15,13,0.78)] md:h-8 md:w-8">
                                            <OptimizedImage
                                                src={ASSETS.trait[key as BetrayalTraitKey]}
                                                locale={effectiveLocale}
                                                alt={t(`board.traits.${key}`)}
                                                className="h-full w-full object-cover"
                                                draggable={false}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs uppercase tracking-[0.14em] text-[#b2a689]">
                                                {t(`board.traits.${key}`)}
                                            </div>
                                        </div>
                                        <div className="text-lg font-semibold text-[#f3ead6]">{value}</div>
                                    </div>
                                )}
                            />
                        </article>

                        <article
                            id="betrayal-inventory-section"
                            className="rounded-[22px] border border-[#635238] bg-[rgba(16,23,20,0.88)] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] md:p-4"
                        >
                            <div className="mb-2.5 flex items-center justify-between gap-3">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-[#a89d84]">
                                    {t('board.sections.inventory')}
                                </div>
                                <div className="sr-only">
                                    {selectedInventoryCard
                                        ? t('board.status.selectedCard', { card: selectedInventoryCard.name })
                                        : t('board.status.noSelectedCard')}
                                </div>
                                <div
                                    className="sr-only"
                                    data-testid="betrayal-use-status"
                                >
                                    {useStatusText}
                                </div>
                            </div>
                            <ResourceTraySkeleton
                                items={core.currentExplorerInventory}
                                canInteract
                                layout="column"
                                className="grid grid-cols-3 gap-2"
                                renderItem={(item) => {
                                    const isSelected = item.id === selectedInventoryCard?.id;
                                    const isUsedThisTurn = previewState.usedCardIdsThisTurn.includes(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setPreviewState((previousState) => ({
                                                ...previousState,
                                                selectedInventoryCardId: item.id,
                                            }))}
                                            data-testid={`betrayal-inventory-${item.id}`}
                                            title={`${item.name} · ${resolvePreviewUseEffectLabel(item, t)}`}
                                            className={`relative overflow-hidden rounded-[12px] border text-left transition ${
                                                isSelected
                                                    ? 'border-[#d2ab61] shadow-[0_0_0_1px_rgba(210,171,97,0.45)]'
                                                    : 'border-[#5d4f36] bg-[rgba(28,20,15,0.86)]'
                                            }`}
                                        >
                                            {isUsedThisTurn ? (
                                                <div className="absolute right-2 top-2 z-10 rounded-full border border-[#7c5941] bg-[rgba(58,31,24,0.92)] px-2 py-1 text-[10px] font-medium text-[#f0c1a2]">
                                                    {t('board.status.cardUsedTag')}
                                                </div>
                                            ) : null}
                                            <OptimizedImage
                                                src={item.kind === 'item' ? ASSETS.deck.item : ASSETS.deck.omen}
                                                locale={effectiveLocale}
                                                alt={item.name}
                                                className={`h-[118px] w-full object-cover sm:h-[132px] ${isUsedThisTurn ? 'opacity-55' : 'opacity-85'}`}
                                                draggable={false}
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.86))] px-3 py-2">
                                                <div className="text-[9px] uppercase tracking-[0.12em] text-[#d8c596]">
                                                    {item.kind === 'item' ? t('board.inventory.item') : t('board.inventory.omen')}
                                                </div>
                                                <div className="truncate text-xs font-medium text-[#f4ecd9]">{item.name}</div>
                                            </div>
                                        </button>
                                    );
                                }}
                            />
                        </article>

                        <article className="rounded-[22px] border border-[#635238] bg-[rgba(16,23,20,0.88)] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] md:p-4">
                            <div className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-[#a89d84]">
                                {t('board.sections.players')}
                            </div>
                            <div className="grid gap-2.5">
                                {core.otherExplorers.map((explorer) => {
                                    const isTradeCandidate = tradeTargets.some((item) => item.playerId === explorer.playerId);
                                    const isSelectedTradeTarget = explorer.playerId === selectedTradeTargetPlayerId;
                                    const panel = (
                                        <PlayerPanelSkeleton
                                            key={explorer.playerId}
                                            player={buildPanelData(explorer, matchData)}
                                            className={`rounded-[16px] border p-3 transition ${
                                                isSelectedTradeTarget
                                                    ? 'border-[#c9a35e] bg-[rgba(55,41,22,0.84)] shadow-[0_0_0_1px_rgba(201,163,94,0.28)]'
                                                    : isTradeCandidate
                                                        ? 'border-[#4f694f] bg-[rgba(25,36,29,0.82)]'
                                                        : 'border-[#564630] bg-[rgba(31,23,18,0.82)]'
                                            }`}
                                            renderPlayerInfo={(player) => (
                                                <div className="flex items-center gap-3">
                                                    <div className="h-14 w-11 overflow-hidden rounded-[10px] border border-[#756244] bg-[rgba(12,14,13,0.7)]">
                                                        <OptimizedImage
                                                            src={explorer.portraitAsset}
                                                            locale={effectiveLocale}
                                                            alt={player.displayName}
                                                            className="h-full w-full object-cover"
                                                            draggable={false}
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="truncate text-sm font-medium text-[#f1e8d4]">
                                                                {player.displayName}
                                                            </div>
                                                            {isTradeCandidate ? (
                                                                <span
                                                                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                                                                        isSelectedTradeTarget
                                                                            ? 'border border-[#d2ab61] bg-[rgba(201,163,94,0.16)] text-[#f3e0b4]'
                                                                            : 'border border-[#5f7b66] bg-[rgba(40,63,50,0.34)] text-[#bddac2]'
                                                                    }`}
                                                                >
                                                                    {isSelectedTradeTarget ? t('board.players.tradeTarget') : t('board.players.sameRoom')}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <div className="text-xs text-[#b7aa92]">
                                                            {core.rooms.find((room) => room.id === explorer.roomId)?.name || t('board.rooms.unknown')}
                                                        </div>
                                                        <div className="text-xs text-[#8db29a]">
                                                            {t('board.players.inventoryCount', { count: explorer.inventory.length })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            renderResource={(key, value) => (
                                                <div className="flex items-center justify-between text-xs text-[#c8bda4]">
                                                    <span>{t(`board.traits.${key}`)}</span>
                                                    <span className="font-semibold text-[#f3ead6]">{value}</span>
                                                </div>
                                            )}
                                        />
                                    );

                                    if (!isTradeCandidate) {
                                        return panel;
                                    }

                                    return (
                                        <button
                                            key={explorer.playerId}
                                            type="button"
                                            onClick={() => setPreviewState((previousState) => ({
                                                ...previousState,
                                                selectedTradeTargetPlayerId: explorer.playerId,
                                            }))}
                                            data-testid={`betrayal-trade-target-${explorer.playerId}`}
                                            className="w-full text-left"
                                        >
                                            {panel}
                                        </button>
                                    );
                                })}
                            </div>
                        </article>
                    </section>

                    <section className="order-1 grid content-start gap-3 xl:order-2 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_auto]">
                        <div className="sr-only">
                            <span data-testid="betrayal-action-cue">{actionCueText}</span>
                            <span data-testid="betrayal-trade-status">{tradeStatusText}</span>
                            <span data-testid="betrayal-turn-hint">{turnHintText}</span>
                        </div>

                        <article
                            id="betrayal-room-panel"
                            className="order-1 flex min-h-[560px] flex-col rounded-[24px] border border-[#3c3328] bg-[rgba(8,15,13,0.76)] p-2 shadow-[0_18px_44px_rgba(0,0,0,0.28)] md:min-h-[700px] md:p-3 xl:min-h-0"
                        >
                            <div className="sr-only">
                                <span data-testid="betrayal-room-latest-feedback">
                                    {latestLogEntry?.text || t('board.feedback.idle')}
                                </span>
                                {shouldShowLatestDiscovery ? (
                                    <span data-testid="betrayal-discovery-panel">
                                        {t('board.discovery.label')}
                                        {' '}
                                        {previewState.latestDiscovery!.title}
                                        {' '}
                                        {previewState.latestDiscovery!.summary}
                                        {' '}
                                        <span data-testid="betrayal-discovery-detail">
                                            {previewState.latestDiscovery!.detail}
                                        </span>
                                    </span>
                                ) : null}
                                {roomFocusState ? (
                                    <button
                                        type="button"
                                        onClick={handleRoomFocusAction}
                                        data-testid="betrayal-room-focus-target"
                                    >
                                        {roomFocusState.label}
                                    </button>
                                ) : null}
                                {tradeShortcutState ? (
                                    <button
                                        type="button"
                                        onClick={handleTradeAction}
                                        data-testid="betrayal-room-trade-shortcut"
                                    >
                                        {tradeShortcutState.label}
                                    </button>
                                ) : null}
                            </div>

                            <div
                                ref={roomGridRef}
                                className="relative min-h-[560px] flex-1 cursor-grab touch-none overflow-auto overscroll-contain rounded-[20px] border border-[#2f2a22] bg-[linear-gradient(180deg,rgba(13,24,20,0.82),rgba(5,10,9,0.96))] shadow-[inset_0_0_30px_rgba(0,0,0,0.34)] [scrollbar-color:#7a6240_rgba(8,12,10,0.72)] active:cursor-grabbing sm:min-h-[600px] md:min-h-[700px]"
                                data-testid="betrayal-room-grid"
                                aria-label={t('board.sections.rooms')}
                                onPointerDown={handleRoomGridPointerDown}
                                onPointerMove={handleRoomGridPointerMove}
                                onPointerUp={handleRoomGridPointerEnd}
                                onPointerCancel={handleRoomGridPointerEnd}
                            >
                                <div
                                    className="relative mx-auto"
                                    data-testid="betrayal-room-canvas"
                                    style={roomCanvasStyle}
                                >
                                    {core.rooms.map((room) => {
                                    const tone = FLOOR_TONE[room.floor];
                                    const isActive = room.id === core.activeRoomId;
                                    const occupants = roomOccupants[room.id] ?? [];
                                    const isDiscovered = room.state === 'discovered';
                                    const isExplorableSlot = nextExplorableSlot?.id === room.id;
                                    const isReachableRoom = moveTargetRoomIds.has(room.id);
                                    const isMoveTarget = previewState.interactionMode === 'move' && moveTargetRoomIds.has(room.id);
                                    const roomTileAsset = resolveRoomTileAsset(room, isDiscovered);
                                    const connectionEdges = resolveRoomConnectionEdges(room, roomLookup);
                                    const identityKey = room.discoveryReward
                                        ? room.discoveryReward
                                        : room.startingTile
                                            ? 'starting'
                                            : isExplorableSlot
                                                ? 'explorable'
                                                : !isDiscovered
                                                    ? 'unrevealed'
                                                    : null;
                                    const identityLabel = room.discoveryReward
                                        ? t(`board.rooms.rewards.${room.discoveryReward}`)
                                        : room.startingTile
                                            ? room.tags[0] ?? t('board.rooms.active')
                                            : isExplorableSlot
                                                ? t('board.rooms.explorable')
                                                : !isDiscovered
                                                    ? t('board.rooms.slotUndiscovered')
                                                    : null;
                                    const identityTone = identityKey ? ROOM_IDENTITY_TONE[identityKey] : null;
                                    const note = isDiscovered
                                        ? previewState.roomNotes[room.id] ?? room.hint
                                        : isExplorableSlot
                                            ? t('board.rooms.slotReady')
                                            : t('board.rooms.slotUndiscovered');
                                    return (
                                        <div
                                            key={room.id}
                                            data-testid={`betrayal-room-shell-${room.id}`}
                                            className="group absolute overflow-visible"
                                            style={resolveRoomTileStyle(room)}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handleMoveToRoom(room.id)}
                                                disabled={
                                                    !isDiscovered
                                                    || isActive
                                                    || core.movesRemaining <= 0
                                                    || !isReachableRoom
                                                }
                                                data-testid={`betrayal-room-${room.id}`}
                                                title={note}
                                                className="relative h-full w-full overflow-visible rounded-[14px] border bg-[#15110d] p-0 text-left transition duration-200 disabled:cursor-default"
                                                style={{
                                                borderColor: isActive
                                                    ? tone.accent
                                                    : isMoveTarget
                                                        ? 'rgba(118, 189, 153, 0.74)'
                                                    : isReachableRoom
                                                        ? 'rgba(96, 155, 125, 0.64)'
                                                    : isExplorableSlot
                                                        ? 'rgba(205, 173, 101, 0.74)'
                                                        : 'rgba(116, 96, 66, 0.58)',
                                                backgroundColor: isDiscovered ? '#15110d' : '#09100d',
                                                boxShadow: isActive
                                                    ? `0 0 0 3px ${tone.accent}, 0 0 34px ${tone.glow}, 0 18px 34px rgba(0,0,0,0.34)`
                                                    : isMoveTarget
                                                        ? '0 0 0 1px rgba(118,189,153,0.48), 0 12px 24px rgba(0,0,0,0.22)'
                                                    : isReachableRoom
                                                        ? '0 0 0 1px rgba(96,155,125,0.34), 0 12px 24px rgba(0,0,0,0.22)'
                                                    : isExplorableSlot
                                                        ? '0 0 0 1px rgba(205,173,101,0.42), 0 12px 24px rgba(0,0,0,0.22)'
                                                    : '0 12px 24px rgba(0,0,0,0.22)',
                                                opacity: !isDiscovered
                                                    ? 1
                                                    : isActive || isMoveTarget || isReachableRoom || isExplorableSlot
                                                        ? 1
                                                        : 0.72,
                                            }}
                                        >
                                            <div className="pointer-events-none absolute -inset-1 -z-10 rounded-[16px] bg-[rgba(0,0,0,0.28)] blur-[2px]" />
                                            <OptimizedImage
                                                src={roomTileAsset}
                                                locale={effectiveLocale}
                                                alt=""
                                                aria-hidden="true"
                                                className={`pointer-events-none absolute inset-0 h-full w-full rounded-[12px] bg-[#15110d] object-contain ${
                                                    isDiscovered ? 'opacity-95' : 'opacity-82'
                                                }`}
                                                draggable={false}
                                            />
                                            <div
                                                className={`pointer-events-none absolute inset-0 rounded-[12px] ${
                                                    isActive
                                                        ? 'bg-[radial-gradient(circle_at_50%_42%,rgba(205,173,101,0.18),transparent_54%),linear-gradient(180deg,rgba(6,11,9,0.02),rgba(4,7,6,0.28))]'
                                                        : isMoveTarget
                                                            ? 'bg-[radial-gradient(circle_at_50%_42%,rgba(118,189,153,0.10),transparent_58%)]'
                                                            : isReachableRoom
                                                                ? 'bg-[radial-gradient(circle_at_50%_42%,rgba(96,155,125,0.07),transparent_58%)]'
                                                                : 'bg-[linear-gradient(180deg,rgba(3,6,5,0.02),rgba(3,5,5,0.16))]'
                                                }`}
                                            />
                                            {identityTone ? (
                                                <div
                                                    data-testid={`betrayal-room-stripe-${room.id}`}
                                                    className={`absolute inset-x-0 top-0 h-1.5 ${identityTone.stripe}`}
                                                />
                                            ) : null}
                                            {connectionEdges.map((edge) => {
                                                const isEdgeToActive = edge.targetRoomId === core.activeRoomId;
                                                const isEdgeToMoveTarget = moveTargetRoomIds.has(edge.targetRoomId);
                                                const isEdgeToExplorable = nextExplorableSlot?.id === edge.targetRoomId;
                                                const isHighlightedMoveEdge = (isActive && isEdgeToMoveTarget)
                                                    || (isReachableRoom && isEdgeToActive);
                                                const isHighlightedExploreEdge = (isActive && isEdgeToExplorable)
                                                    || (isExplorableSlot && isEdgeToActive);
                                                const connectorStyle = edge.direction === 'north'
                                                    ? 'left-1/2 top-0 h-2.5 w-11 -translate-x-1/2 rounded-b-full'
                                                    : edge.direction === 'south'
                                                        ? 'bottom-0 left-1/2 h-2.5 w-11 -translate-x-1/2 rounded-t-full'
                                                        : edge.direction === 'east'
                                                            ? 'right-0 top-1/2 h-11 w-2.5 -translate-y-1/2 rounded-l-full'
                                                            : 'left-0 top-1/2 h-11 w-2.5 -translate-y-1/2 rounded-r-full';
                                                const connectorTone = isHighlightedMoveEdge
                                                    ? 'border-[#76bd99] bg-[rgba(33,65,51,0.9)]'
                                                    : isHighlightedExploreEdge
                                                        ? 'border-[#c7a96a] bg-[rgba(77,61,28,0.92)]'
                                                        : 'border-[rgba(116,96,66,0.76)] bg-[rgba(38,31,24,0.9)]';
                                                return (
                                                    <span
                                                        key={`${room.id}-${edge.targetRoomId}`}
                                                        data-testid={`betrayal-room-connector-${room.id}-${edge.targetRoomId}`}
                                                        className={`pointer-events-none absolute border ${connectorStyle} ${connectorTone}`}
                                                    />
                                                );
                                            })}
                                            <div className="pointer-events-none absolute inset-0 rounded-[12px] ring-1 ring-inset ring-[rgba(222,192,133,0.08)]" />
                                            {isActive ? (
                                                <div className="absolute bottom-3 right-3 z-20 grid h-7 w-7 place-items-center rounded-full border border-[#8af05f] bg-[radial-gradient(circle_at_35%_25%,#b8ff72,#287c36_62%,#0c341b)] shadow-[0_0_16px_rgba(112,255,102,0.58)]">
                                                    <span className="h-3 w-2 rounded-full bg-[rgba(7,26,13,0.36)]" />
                                                </div>
                                            ) : null}
                                            <div className="sr-only">
                                                <span>{room.name}</span>
                                                <span>{tone.label}</span>
                                                {identityTone && identityLabel ? (
                                                    <span data-testid={`betrayal-room-identity-${room.id}`}>
                                                        {identityLabel}
                                                    </span>
                                                ) : null}
                                                {isActive ? <span>{t('board.rooms.active')}</span> : null}
                                            </div>

                                            <div className="pointer-events-none absolute right-2 top-2 z-10 flex min-h-6 flex-wrap justify-center gap-1.5">
                                                {isMoveTarget ? (
                                                    <span
                                                        data-testid={`betrayal-room-move-target-${room.id}`}
                                                        className="h-3 w-3 rounded-full border border-[#76bd99] bg-[#76bd99] shadow-[0_0_14px_rgba(118,189,153,0.8)]"
                                                        title={t('board.rooms.moveTarget')}
                                                    />
                                                ) : isReachableRoom ? (
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full border border-[#6aa986] bg-[rgba(106,169,134,0.58)]"
                                                        title={t('board.rooms.moveTarget')}
                                                    />
                                                ) : null}
                                            </div>

                                            <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex max-w-[92px] flex-wrap justify-start gap-1.5">
                                                {occupants.map((occupant) => (
                                                    <span
                                                        key={occupant.playerId}
                                                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[9px] font-semibold ${
                                                            occupant.playerId === core.currentExplorer.playerId
                                                                ? 'border-[#d2ab61] bg-[rgba(201,163,94,0.2)] text-[#f4e2b2]'
                                                                : 'border-[#4f694f] bg-[rgba(31,52,39,0.46)] text-[#d7e4cc]'
                                                        }`}
                                                        title={resolvePlayerName(occupant.playerId, occupant.displayName, matchData)}
                                                    >
                                                        {resolveCompactNameLabel(resolvePlayerName(occupant.playerId, occupant.displayName, matchData))}
                                                    </span>
                                                ))}
                                            </div>
                                            </button>
                                            <button
                                                type="button"
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setRoomPreviewId(room.id);
                                                }}
                                                data-testid={`betrayal-room-preview-${room.id}`}
                                                className="absolute bottom-2 right-2 z-30 grid h-8 w-8 place-items-center rounded-full border border-[rgba(222,192,133,0.5)] bg-[rgba(7,10,8,0.82)] text-[#f0d29a] opacity-75 shadow-[0_6px_14px_rgba(0,0,0,0.34)] transition hover:bg-[rgba(36,28,19,0.92)] hover:opacity-100 focus:opacity-100"
                                                title={t('board.rooms.preview')}
                                            >
                                                <Search size={15} />
                                                <span className="sr-only">{t('board.rooms.preview')}</span>
                                            </button>
                                        </div>
                                    );
                                    })}
                                </div>
                            </div>
                        </article>

                        <article className="order-2 mx-auto w-full max-w-[760px] rounded-[18px] border border-[#4c3e2c] bg-[rgba(10,14,12,0.88)] p-2 shadow-[0_14px_30px_rgba(0,0,0,0.34)]">
                            <ActionBarSkeleton
                                actions={actionItems}
                                layout="row"
                                align="space-between"
                                className="grid grid-cols-5 gap-2"
                                renderAction={(action) => {
                                    const Icon = ACTION_ICON_BY_ID[action.id as keyof typeof ACTION_ICON_BY_ID] || Compass;
                                    const isRecommended = action.id === core.recommendedAction
                                        || (previewState.interactionMode === 'move' && action.id === 'move');
                                    return (
                                        <button
                                            type="button"
                                            onClick={actionHandlerMap[action.id]}
                                            disabled={action.disabled}
                                            data-testid={`betrayal-action-${action.id}`}
                                            title={actionCueText}
                                            className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-[12px] border px-2 py-2 text-sm font-semibold uppercase tracking-[0.08em] transition ${
                                                action.disabled
                                                    ? 'cursor-not-allowed border-[#332d24] bg-[rgba(17,15,12,0.76)] text-[#5f584d]'
                                                    : isRecommended
                                                        ? 'border-[#c9a35e] bg-[rgba(109,129,31,0.28)] text-[#e9f18b] shadow-[0_0_20px_rgba(181,239,66,0.22)] hover:bg-[rgba(123,147,38,0.34)]'
                                                        : 'border-[#5c4d35] bg-[rgba(24,21,17,0.92)] text-[#d6c498] hover:border-[#8b744d] hover:bg-[rgba(42,33,24,0.96)]'
                                            }`}
                                        >
                                            <Icon size={20} />
                                            <span>{action.label}</span>
                                        </button>
                                    );
                                }}
                            />
                        </article>
                    </section>

                    <section className="order-3 grid min-h-0 content-start gap-3 xl:order-3 xl:overflow-y-auto xl:pl-1">
                        <article
                            id="betrayal-decks-section"
                            className="rounded-[22px] border border-[#635238] bg-[rgba(16,23,20,0.88)] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] md:p-4"
                        >
                            <div className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-[#a89d84]">
                                {t('board.sections.decks')}
                            </div>
                            <ResourceTraySkeleton
                                items={deckItems}
                                canInteract={false}
                                layout="column"
                                className="grid grid-cols-3 gap-2"
                                renderItem={(item) => {
                                    const isHighlighted = item.id === `deck-${previewState.highlightedDeckKind}`;
                                    return (
                                        <div
                                            className={`relative overflow-hidden rounded-[12px] border bg-[rgba(28,20,15,0.86)] ${
                                                isHighlighted ? 'border-[#d2ab61]' : 'border-[#58472f]'
                                            }`}
                                        >
                                            <OptimizedImage
                                                src={item.asset}
                                                locale={effectiveLocale}
                                                alt={item.label}
                                                className="h-[144px] w-full object-cover"
                                                draggable={false}
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.86))] px-2 py-2">
                                                <div className="truncate text-[9px] uppercase tracking-[0.08em] text-[#d8c596]">
                                                    {item.label}
                                                </div>
                                                <div className="text-lg font-semibold text-[#f4ecd9]">{item.count}</div>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        </article>

                        <article className="rounded-[22px] border border-[#635238] bg-[rgba(16,23,20,0.88)] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] md:p-4">
                            <div className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-[#a89d84]">
                                {t('board.sections.discard')}
                            </div>
                            <ResourceTraySkeleton
                                items={discardItems}
                                canInteract={false}
                                layout="column"
                                className="grid grid-cols-3 gap-2"
                                renderItem={(item) => (
                                    <div
                                        className="relative overflow-hidden rounded-[12px] border border-[#564630] bg-[rgba(31,23,18,0.82)]"
                                        title={item.count > 0 ? t('board.decks.faceUp') : t('board.decks.emptySlot')}
                                    >
                                        <OptimizedImage
                                            src={item.asset}
                                            locale={effectiveLocale}
                                            alt={item.label}
                                            className={`h-[118px] w-full object-cover ${item.count === 0 ? 'grayscale opacity-42' : 'opacity-78'}`}
                                            draggable={false}
                                        />
                                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.86))] px-2 py-2">
                                            <div className="truncate text-[9px] uppercase tracking-[0.08em] text-[#d8c596]">
                                                {item.label}
                                            </div>
                                            <div className="text-lg font-semibold text-[#f3ead6]">{item.count}</div>
                                        </div>
                                    </div>
                                )}
                            />
                        </article>

                        <article className="rounded-[22px] border border-transparent bg-transparent p-1">
                            <button
                                type="button"
                                onClick={handleCompleteFirstScenario}
                                data-testid="betrayal-complete-first-scenario"
                                title="结算剧本"
                                className="sr-only"
                            >
                                结算剧本
                            </button>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setScenarioOpen(true)}
                                    data-testid="betrayal-open-scenario"
                                    className="grid h-14 w-14 place-items-center rounded-[10px] border border-[#58472f] bg-[rgba(18,19,15,0.9)] text-[#d8bf81] transition hover:border-[#8b744d]"
                                    title={t('board.scenario.button')}
                                >
                                    <BookOpen size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRoomPreviewId(core.activeRoomId)}
                                    data-testid="betrayal-open-active-room-preview"
                                    className="grid h-14 w-14 place-items-center rounded-[10px] border border-[#58472f] bg-[rgba(18,19,15,0.9)] text-[#d8bf81] transition hover:border-[#8b744d]"
                                    title={t('board.rooms.preview')}
                                >
                                    <Search size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCompleteFirstScenario}
                                    className="grid h-14 w-14 place-items-center rounded-[10px] border border-[#58472f] bg-[rgba(18,19,15,0.9)] text-[#d8bf81] transition hover:border-[#8b744d]"
                                    title="结算剧本"
                                >
                                    <Hourglass size={24} />
                                </button>
                            </div>
                            <div className="sr-only" data-testid="betrayal-activity-list">
                                {earlierLogEntries.length > 0 ? earlierLogEntries.map((entry) => (
                                    <span key={entry.id}>{entry.text}</span>
                                )) : (
                                    <span>{t('board.activity.earlierEmpty')}</span>
                                )}
                            </div>
                        </article>
                    </section>
                </main>

                {referenceOpen ? (
                    <div
                        className="absolute inset-0 z-30 flex items-end justify-center bg-[rgba(3,6,5,0.72)] p-3 md:items-center md:p-6"
                        data-testid="betrayal-reference-overlay"
                    >
                        <div className="relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-[980px] flex-col overflow-hidden rounded-[22px] border border-[#6d5838] bg-[rgba(16,23,20,0.98)] shadow-[0_24px_60px_rgba(0,0,0,0.46)]">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#4d3f2b] bg-[rgba(16,23,20,0.98)] px-4 py-3 md:px-5">
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#a89d84]">
                                        {t('board.reference.button')}
                                    </div>
                                    <div className="mt-1 text-sm text-[#e7dcc3]">
                                        {t(`board.reference.${referenceSide}`)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={toggleReferenceSide}
                                        data-testid="betrayal-reference-toggle"
                                        className="inline-flex items-center gap-1 rounded-full border border-[#5d4f36] bg-[rgba(31,23,18,0.82)] px-3 py-1.5 text-xs font-medium text-[#dbc89f] transition hover:bg-[rgba(48,36,27,0.88)]"
                                    >
                                        {referenceSide === 'front' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                                        <span>{t('board.reference.toggle')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReferenceOpen(false)}
                                        data-testid="betrayal-reference-close"
                                        className="rounded-full border border-[#5d4f36] bg-[rgba(31,23,18,0.82)] px-3 py-1.5 text-xs font-medium text-[#dbc89f] transition hover:bg-[rgba(48,36,27,0.88)]"
                                    >
                                        {t('board.reference.close')}
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-auto p-3 md:p-5">
                                <div className="flex items-center justify-center overflow-hidden rounded-[18px] border border-[#5a4a33] bg-[rgba(10,14,12,0.82)]">
                                    <OptimizedImage
                                        src={referenceSide === 'front' ? ASSETS.playerReference.front : ASSETS.playerReference.back}
                                        locale={effectiveLocale}
                                        alt={t(`board.reference.${referenceSide}`)}
                                        className="h-auto max-h-[72vh] w-full object-contain md:max-h-[78vh]"
                                        draggable={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {previewRoom && previewRoomAsset ? (
                    <div
                        className="absolute inset-0 z-30 flex items-end justify-center bg-[rgba(3,6,5,0.72)] p-3 md:items-center md:p-6"
                        data-testid="betrayal-room-preview-overlay"
                    >
                        <div className="relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-[760px] flex-col overflow-hidden rounded-[22px] border border-[#6d5838] bg-[rgba(16,23,20,0.98)] shadow-[0_24px_60px_rgba(0,0,0,0.46)]">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#4d3f2b] bg-[rgba(16,23,20,0.98)] px-4 py-3 md:px-5">
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#a89d84]">
                                        {t('board.rooms.preview')}
                                    </div>
                                    <div className="mt-1 text-sm text-[#e7dcc3]">
                                        {previewRoom.name}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRoomPreviewId(null)}
                                    data-testid="betrayal-room-preview-close"
                                    className="rounded-full border border-[#5d4f36] bg-[rgba(31,23,18,0.82)] px-3 py-1.5 text-xs font-medium text-[#dbc89f] transition hover:bg-[rgba(48,36,27,0.88)]"
                                >
                                    {t('board.reference.close')}
                                </button>
                            </div>
                            <div className="overflow-auto p-3 md:p-5">
                                <div className="flex items-center justify-center overflow-hidden rounded-[18px] border border-[#5a4a33] bg-[rgba(10,14,12,0.82)]">
                                    <OptimizedImage
                                        src={previewRoomAsset}
                                        locale={effectiveLocale}
                                        alt={previewRoom.name}
                                        className="h-auto max-h-[72vh] w-full object-contain md:max-h-[78vh]"
                                        draggable={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {scenarioOpen ? (
                    <div
                        className="absolute inset-0 z-30 flex items-end justify-center bg-[rgba(3,6,5,0.72)] p-3 md:items-center md:p-6"
                        data-testid="betrayal-scenario-overlay"
                    >
                        <div className="relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-[860px] flex-col overflow-hidden rounded-[22px] border border-[#6d5838] bg-[rgba(16,23,20,0.98)] shadow-[0_24px_60px_rgba(0,0,0,0.46)]">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#4d3f2b] bg-[rgba(16,23,20,0.98)] px-4 py-3 md:px-5">
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#a89d84]">
                                        {t('board.scenario.button')}
                                    </div>
                                    <div className="mt-1 text-sm text-[#e7dcc3]">
                                        {t('board.scenario.title')}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setScenarioOpen(false)}
                                    data-testid="betrayal-scenario-close"
                                    className="rounded-full border border-[#5d4f36] bg-[rgba(31,23,18,0.82)] px-3 py-1.5 text-xs font-medium text-[#dbc89f] transition hover:bg-[rgba(48,36,27,0.88)]"
                                >
                                    {t('board.reference.close')}
                                </button>
                            </div>
                            <div className="grid gap-3 overflow-auto p-4 md:grid-cols-[1.1fr_0.9fr] md:p-5">
                                <section className="rounded-[18px] border border-[#57462f] bg-[rgba(31,23,18,0.72)] p-4">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#a89d84]">
                                        {t('board.scenario.objectiveLabel')}
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-[#e7dcc3]">
                                        {t('board.scenario.objective')}
                                    </p>
                                </section>
                                <section className="rounded-[18px] border border-[#57462f] bg-[rgba(31,23,18,0.72)] p-4">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#a89d84]">
                                        {t('board.scenario.statusLabel')}
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-[#e7dcc3]">
                                        <div>{t('board.scenario.haunt')}: {t('board.scenario.hauntValue')}</div>
                                        <div>{t('board.scenario.rooms')}: {core.rooms.filter((room) => room.state === 'discovered').length}</div>
                                        <div>{t('board.scenario.omens')}: {core.discardCounts.omen}</div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(var(--safe-area-bottom)+0.75rem)] md:hidden">
                    <div className="pointer-events-auto rounded-[18px] border border-[#5f4d31] bg-[rgba(14,20,18,0.92)] p-2 shadow-[0_16px_32px_rgba(0,0,0,0.34)] backdrop-blur-sm">
                        <div className="mb-2 flex items-center gap-2">
                            <div className="min-w-0 flex-1 rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[#a89d84]">
                                    当前选中
                                </div>
                                <div
                                    className="truncate text-sm font-medium text-[#f3ead6]"
                                    data-testid="betrayal-mobile-selected-card"
                                >
                                    {selectedInventoryCard?.name || t('board.status.noSelectedCard')}
                                </div>
                                <div
                                    className={`mt-1 truncate text-[11px] ${selectedCardUsedThisTurn ? 'text-[#f0c1a2]' : 'text-[#8db29a]'}`}
                                    data-testid="betrayal-mobile-use-status"
                                >
                                    {useStatusText}
                                </div>
                                <div
                                    className={`mt-1 truncate text-[11px] ${
                                        selectedTradeTarget ? 'text-[#8db29a]' : 'text-[#b8ae98]'
                                    }`}
                                    data-testid="betrayal-mobile-trade-status"
                                >
                                    {tradeStatusText}
                                </div>
                                <div
                                    className="mt-1 truncate text-[11px] text-[#dbcfae]"
                                    data-testid="betrayal-mobile-action-cue"
                                >
                                    {actionCueText}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => scrollToSection('betrayal-inventory-section')}
                                data-testid="betrayal-mobile-jump-inventory"
                                className="rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2 text-xs font-medium text-[#dbcfae]"
                            >
                                持有区
                            </button>
                            <button
                                type="button"
                                onClick={() => scrollToSection('betrayal-decks-section')}
                                data-testid="betrayal-mobile-jump-decks"
                                className="rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2 text-xs font-medium text-[#dbcfae]"
                            >
                                牌堆区
                            </button>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {actionItems.map((action) => {
                                const Icon = ACTION_ICON_BY_ID[action.id as keyof typeof ACTION_ICON_BY_ID] || Compass;
                                const isRecommended = action.id === core.recommendedAction
                                    || (previewState.interactionMode === 'move' && action.id === 'move');
                                return (
                                    <button
                                        key={`mobile-dock-${action.id}`}
                                        type="button"
                                        onClick={actionHandlerMap[action.id]}
                                        disabled={action.disabled}
                                        data-testid={`betrayal-mobile-dock-${action.id}`}
                                        className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[14px] border px-1.5 py-1.5 text-[10px] font-medium transition ${
                                            action.disabled
                                                ? 'cursor-not-allowed border-[#3e3526] bg-[rgba(22,17,13,0.72)] text-[#6f6758]'
                                                : isRecommended
                                                    ? 'border-[#c9a35e] bg-[rgba(201,163,94,0.16)] text-[#f3e0b4]'
                                                    : 'border-[#5c4d35] bg-[rgba(30,22,17,0.88)] text-[#d8ccb0]'
                                        }`}
                                    >
                                        <Icon size={14} />
                                        <span>{action.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
