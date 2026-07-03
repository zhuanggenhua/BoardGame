import React from 'react';
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Compass,
    Footprints,
    Handshake,
    House,
    Hourglass,
    RotateCcw,
    Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import type { ActionBarAction } from '../../core/ui/types';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../../components/common/overlays/MagnifyOverlay';
import {
    ActionBarSkeleton,
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
    BetrayalMonsterSummary,
    BetrayalRoomVisualId,
    BetrayalRoomNode,
    BetrayalTraitKey,
    PossessionUseEffectProfile,
} from './game';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    EXPLORER_CATALOG,
    canUseDogForTrade,
    canUseHolySymbolForDiscovery,
    canUseIdolToSkipEvent,
    canUseRabbitFootForRecentRoll,
    canUseSkeletonKeyForMove,
    canUseMysticElevator,
    createBetrayalCharacterSelectCore,
    getBetrayalScenarioConfig,
    resolveAttackWeaponCards,
    resolveDogTradeTargets,
    resolveExplorableRoomSlots,
    resolveUseEffect,
} from './game';
import {
    BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
    buildPossessionAtlasImageStyle,
    resolvePossessionAtlasVisual,
    type BetrayalPossessionAtlasVisual,
} from './possessionAtlas';
import {
    BETRAYAL_ROOM_TILE_VISUALS,
    buildRoomAtlasImageStyle,
    type BetrayalRoomTileVisual,
} from './roomAtlas';

type Props = GameBoardProps<BetrayalCore, BetrayalCommandMap>;

type DeckTrayItem = {
    id: string;
    label: string;
    count: number;
    asset: string;
};

type PreviewState = {
    selectedInventoryCardId: string | null;
    selectedTradeTargetPlayerId: string | null;
    selectedDogTradeCardIds: string[];
    selectedAttackWeaponCardId: string | null;
    selectedInventoryTargetPlayerId: string | null;
    selectedInventoryTargetRoomId: string | null;
    selectedMaskTargetRoomIdsByTokenId: Record<string, string>;
    useHolySymbolForExplore: boolean;
    useIdolForExplore: boolean;
    tradeSelectionTouched: boolean;
    interactionMode: 'default' | 'move' | 'explore';
};

type RoomGridDragState = {
    isDragging: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    hasMoved: boolean;
};

const ROOM_TILE_SIZE = 184;
const ROOM_TILE_STEP_X = 184;
const ROOM_TILE_STEP_Y = 184;
const ROOM_CANVAS_PADDING = 8;
const ROOM_CANVAS_MIN_WIDTH = 780;
const ROOM_CANVAS_MIN_HEIGHT = 560;

const EXPLORER_BOARD_MARKER_RANGE: Record<BetrayalTraitKey, { from: { x: number; y: number }; to: { x: number; y: number } }> = {
    might: { from: { x: 14.5, y: 44.5 }, to: { x: 35.5, y: 23.5 } },
    speed: { from: { x: 18.5, y: 79.5 }, to: { x: 18.5, y: 54.5 } },
    knowledge: { from: { x: 85.5, y: 44.5 }, to: { x: 64.5, y: 23.5 } },
    sanity: { from: { x: 81.5, y: 79.5 }, to: { x: 81.5, y: 54.5 } },
};

const ASSETS = {
    titleBanner: 'betrayal/ui/title-banner',
    cover: 'betrayal/thumbnails/cover',
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
    trait: {
        might: 'betrayal/markers/might',
        speed: 'betrayal/markers/speed',
        knowledge: 'betrayal/markers/knowledge',
        sanity: 'betrayal/markers/sanity',
    } satisfies Record<BetrayalTraitKey, string>,
    marker: {
        altar: 'betrayal/markers/altar',
        blessing: 'betrayal/markers/blessing',
        blood: 'betrayal/markers/blood',
        contract: 'betrayal/markers/contract',
        food: 'betrayal/markers/food',
        hidden: 'betrayal/markers/hidden',
        nest: 'betrayal/markers/nest',
        obstacle: 'betrayal/markers/obstacle',
        off: 'betrayal/markers/off',
        on: 'betrayal/markers/on',
        portal: 'betrayal/markers/portal',
        searched: 'betrayal/markers/searched',
        trait: 'betrayal/markers/trait',
        videotape: 'betrayal/markers/videotape',
    } as const,
    numberMarker: {
        blank: 'betrayal/markers/number-blank',
        1: 'betrayal/markers/number-1',
        2: 'betrayal/markers/number-2',
        3: 'betrayal/markers/number-3',
        4: 'betrayal/markers/number-4',
        5: 'betrayal/markers/number-5',
        6: 'betrayal/markers/number-6',
        7: 'betrayal/markers/number-7',
        8: 'betrayal/markers/number-8',
        9: 'betrayal/markers/number-9',
    } as const,
} as const;

const ACTION_ICON_BY_ID = {
    move: Footprints,
    explore: Search,
    trade: Handshake,
    use: BookOpen,
    roomEffect: RotateCcw,
    endTurn: Hourglass,
} as const;

const ENDGAME_MEDALLION_CLIP_PATH = 'polygon(50% 0%, 85% 11%, 100% 42%, 83% 85%, 50% 100%, 17% 85%, 0% 42%, 15% 11%)';
const REFERENCE_CARD_FRAME_WIDTH = `min(92vw, calc(86vh * ${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO}))`;
const INVENTORY_PREVIEW_FRAME_WIDTH = 'min(84vw, 360px)';
const COMPACT_INVENTORY_CARD_WIDTH = 62;

const FLOOR_TONE: Record<BetrayalCore['rooms'][number]['floor'], { label: string; accent: string; glow: string }> = {
    ground: { label: '一层', accent: '#c5a56c', glow: 'rgba(197,165,108,0.32)' },
    upper: { label: '二层', accent: '#8ba98d', glow: 'rgba(139,169,141,0.28)' },
    basement: { label: '地下', accent: '#8b6b78', glow: 'rgba(139,107,120,0.26)' },
};

const ROOM_IDENTITY_TONE = {
    starting: {
        stripe: 'bg-[rgba(148,163,155,0.28)]',
        badge: 'border-[#6f7f77] bg-[rgba(24,31,28,0.76)] text-[#d6e0d9]',
    },
    unrevealed: {
        stripe: 'bg-[rgba(92,106,95,0.22)]',
        badge: 'border-[rgba(111,126,116,0.42)] bg-[rgba(18,26,22,0.92)] text-[#9fb6a3]',
    },
    explorable: {
        stripe: 'bg-[rgba(144,168,150,0.28)]',
        badge: 'border-[#7fa58c] bg-[rgba(24,35,29,0.76)] text-[#d1e5d8]',
    },
    event: {
        stripe: 'bg-[rgba(134,163,150,0.26)]',
        badge: 'border-[#788f84] bg-[rgba(24,31,28,0.76)] text-[#d7e2dd]',
    },
    item: {
        stripe: 'bg-[rgba(144,168,150,0.24)]',
        badge: 'border-[#7b8e84] bg-[rgba(24,31,28,0.76)] text-[#d8e2dd]',
    },
    omen: {
        stripe: 'bg-[rgba(118,189,153,0.24)]',
        badge: 'border-[#76bd99] bg-[rgba(33,65,51,0.82)] text-[#d6f1df]',
    },
} as const;

const INVENTORY_FACE_TONE = {
    item: {
        cardSurfaceClass: 'border-[rgba(118,74,50,0.58)] bg-[linear-gradient(180deg,rgba(85,40,30,0.96),rgba(35,18,16,0.96))]',
        frameClass: 'border-[rgba(192,110,86,0.24)] bg-[rgba(20,10,10,0.18)]',
        badgeClass: 'border-[rgba(202,124,95,0.34)] bg-[rgba(68,29,22,0.8)] text-[#efc4ad]',
        nameClass: 'text-[#f6e6d8]',
        accentClass: 'text-[#eeb29d]',
        backOpacityClass: 'opacity-[0.14]',
    },
    omen: {
        cardSurfaceClass: 'border-[rgba(88,119,73,0.58)] bg-[linear-gradient(180deg,rgba(53,77,38,0.96),rgba(18,31,20,0.96))]',
        frameClass: 'border-[rgba(140,181,123,0.24)] bg-[rgba(11,20,12,0.18)]',
        badgeClass: 'border-[rgba(126,182,127,0.34)] bg-[rgba(29,61,35,0.78)] text-[#d4f0cb]',
        nameClass: 'text-[#edf4df]',
        accentClass: 'text-[#bdddb7]',
        backOpacityClass: 'opacity-[0.12]',
    },
} as const;

const INVENTORY_CARD_BACK_ASSET: Record<BetrayalInventoryCard['kind'], string> = {
    item: ASSETS.deck.item,
    omen: ASSETS.deck.omen,
};

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
        && (candidate.tokenAsset === undefined || typeof candidate.tokenAsset === 'string')
        && typeof candidate.roomId === 'string'
        && isTraitMap(candidate.traits)
        && Array.isArray(candidate.inventory)
        && candidate.inventory.every(isInventoryCard);
}

function isMonsterSummary(value: unknown): value is BetrayalMonsterSummary {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<BetrayalMonsterSummary>;
    return typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && typeof candidate.portraitAsset === 'string'
        && (candidate.tokenAsset === undefined || typeof candidate.tokenAsset === 'string')
        && typeof candidate.roomId === 'string'
        && typeof candidate.might === 'number'
        && typeof candidate.speed === 'number'
        && typeof candidate.damage === 'number';
}

function isBetrayalCore(value: unknown): value is BetrayalCore {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<BetrayalCore>;
    return (candidate.phase === 'characterSelect' || candidate.phase === 'preHaunt' || candidate.phase === 'haunt' || candidate.phase === 'endgame')
        && typeof candidate.currentPlayer === 'string'
        && typeof candidate.movesRemaining === 'number'
        && typeof candidate.activeRoomId === 'string'
        && isExplorerSummary(candidate.currentExplorer)
        && isTraitMap(candidate.currentExplorerTraits)
        && Array.isArray(candidate.currentExplorerInventory)
        && candidate.currentExplorerInventory.every(isInventoryCard)
        && Array.isArray(candidate.otherExplorers)
        && candidate.otherExplorers.every(isExplorerSummary)
        && Array.isArray(candidate.monsters)
        && candidate.monsters.every(isMonsterSummary)
        && Array.isArray(candidate.rooms);
}

function createInitialPreviewState(core: BetrayalCore): PreviewState {
    const latestDrawnCardId = core.latestDiscovery && core.latestDiscovery.kind !== 'event'
        ? core.currentExplorerInventory[core.currentExplorerInventory.length - 1]?.id ?? null
        : null;
    const firstUsableCardId = core.currentExplorerInventory.find((card) => (
        resolveUseEffect(card)
        && core.turnStartInventoryCardIds.includes(card.id)
        && !core.usedCardIdsThisTurn.includes(card.id)
    ))?.id ?? null;
    return {
        selectedInventoryCardId: core.recommendedAction === 'trade'
            ? null
            : firstUsableCardId ?? latestDrawnCardId ?? core.currentExplorerInventory[0]?.id ?? null,
        selectedTradeTargetPlayerId: core.recommendedAction === 'trade'
            ? null
            : resolveTradeTargets(core)[0]?.playerId ?? null,
        selectedDogTradeCardIds: [],
        selectedAttackWeaponCardId: null,
        selectedInventoryTargetPlayerId: null,
        selectedInventoryTargetRoomId: null,
        selectedMaskTargetRoomIdsByTokenId: {},
        useHolySymbolForExplore: false,
        useIdolForExplore: false,
        tradeSelectionTouched: false,
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

function resolveEndgameExplorerName(
    explorer: Pick<BetrayalExplorerSummary, 'playerId' | 'displayName'>,
    matchData?: MatchPlayerInfo[],
) {
    const displayName = explorer.displayName.trim();
    return resolvePlayerName(explorer.playerId, displayName || '玩家', matchData);
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

type RoomTileSpriteProps = {
    visual: BetrayalRoomTileVisual;
    locale: string;
    alt: string;
    className?: string;
};

function RoomTileSprite({ visual, locale, alt, className }: RoomTileSpriteProps) {
    const imgStyle = React.useMemo(() => buildRoomAtlasImageStyle(visual), [visual]);

    return (
        <div
            className={`relative overflow-hidden ${className ?? ''}`.trim()}
            style={{ aspectRatio: imgStyle.aspectRatio }}
        >
            <OptimizedImage
                src={visual.image}
                locale={locale}
                alt={alt}
                draggable={false}
                className="absolute left-0 top-0 max-w-none select-none"
                style={imgStyle}
            />
        </div>
    );
}

type PossessionAtlasFrameProps = {
    visual: BetrayalPossessionAtlasVisual;
    locale: string;
    alt: string;
    testId?: string;
};

function PossessionAtlasFrame({ visual, locale, alt, testId }: PossessionAtlasFrameProps) {
    const imgStyle = React.useMemo(() => buildPossessionAtlasImageStyle(visual), [visual]);

    return (
        <OptimizedImage
            src={visual.image}
            locale={locale}
            alt={alt}
            data-testid={testId}
            data-asset-src={visual.image}
            draggable={false}
            className="absolute left-0 top-0 max-w-none select-none"
            style={imgStyle}
        />
    );
}

function ExplorerFigureToken({
    explorer,
    locale,
    label,
    tone,
}: {
    explorer: BetrayalExplorerSummary;
    locale: string;
    label: string;
    tone: 'self' | 'ally';
}) {
    const tokenAsset = explorer.tokenAsset ?? explorer.portraitAsset;
    const hasOfficialToken = Boolean(explorer.tokenAsset);
    const outlineColor = tone === 'self'
        ? 'rgba(138,240,95,0.98)'
        : 'rgba(245,204,72,0.98)';
    const tokenShape = 'polygon(50% 0%, 96% 30%, 82% 100%, 18% 100%, 4% 30%)';

    return (
        <span
            className="relative inline-flex h-[54px] w-[50px] items-center justify-center"
            data-testid={`betrayal-explorer-figure-token-${explorer.playerId}`}
        >
            <span
                className="pointer-events-none absolute left-1/2 top-1/2 h-[48px] w-[46px] -translate-x-1/2 -translate-y-1/2"
                data-testid={`betrayal-explorer-figure-token-outline-${explorer.playerId}`}
                style={{
                    clipPath: tokenShape,
                    backgroundColor: outlineColor,
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.32))',
                }}
            />
            <span
                className="relative flex h-[44px] w-[42px] items-center justify-center overflow-hidden bg-transparent"
                style={{
                    clipPath: tokenShape,
                }}
            >
                <OptimizedImage
                    src={tokenAsset}
                    locale={locale}
                    alt={label}
                    className={hasOfficialToken ? 'h-full w-full scale-[1.16] object-cover' : 'h-full w-full scale-[1.08] object-cover'}
                    draggable={false}
                />
            </span>
        </span>
    );
}

function MonsterBoardToken({
    monster,
    locale,
}: {
    monster: BetrayalMonsterSummary;
    locale: string;
}) {
    const tokenAsset = monster.tokenAsset ?? monster.portraitAsset;
    const hasOfficialToken = Boolean(monster.tokenAsset);
    const outlineColor = 'rgba(218,74,57,0.98)';

    return (
        <span
            className="relative inline-flex h-[52px] w-[52px] items-center justify-center"
            data-testid={`betrayal-monster-board-token-${monster.id}`}
        >
            <span
                className="pointer-events-none absolute left-1/2 top-1/2 h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                data-testid={`betrayal-monster-board-token-outline-${monster.id}`}
                style={{
                    backgroundColor: outlineColor,
                    filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.36))',
                }}
            />
            <span
                className="relative flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full bg-transparent"
            >
                <OptimizedImage
                    src={tokenAsset}
                    locale={locale}
                    alt={monster.name}
                    className={hasOfficialToken ? 'h-full w-full scale-[1.18] object-cover brightness-110 saturate-110' : 'h-full w-full scale-[1.08] object-cover brightness-125 saturate-125'}
                    draggable={false}
                />
            </span>
        </span>
    );
}

function resolveFloorLabel(floor: BetrayalRoomNode['floor']): string {
    return FLOOR_TONE[floor].label;
}

function resolveNumberMarkerAsset(value: number): string {
    const clamped = Math.max(1, Math.min(9, Math.round(value))) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    return ASSETS.numberMarker[clamped];
}

function resolveExplorerBoardMarkerPosition(trait: BetrayalTraitKey, value: number) {
    const range = EXPLORER_BOARD_MARKER_RANGE[trait];
    const clampedValue = Math.max(1, Math.min(8, Math.round(value)));
    const progress = (clampedValue - 1) / 7;
    return {
        left: `${range.from.x + ((range.to.x - range.from.x) * progress)}%`,
        top: `${range.from.y + ((range.to.y - range.from.y) * progress)}%`,
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

function buildRoomMonsters(core: BetrayalCore): Record<string, BetrayalMonsterSummary[]> {
    const monsters: Record<string, BetrayalMonsterSummary[]> = {};
    for (const monster of core.monsters) {
        monsters[monster.roomId] ??= [];
        monsters[monster.roomId]!.push(monster);
    }
    return monsters;
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

function resolveMoveTargetRooms(core: BetrayalCore): BetrayalRoomNode[] {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return [];
    }
    const connectedIds = resolveConnectedRoomIds(core.rooms, activeRoom.id);
    return core.rooms.filter((room) => room.state === 'discovered' && connectedIds.has(room.id));
}

function formatRoomTargetList(rooms: BetrayalRoomNode[]): string {
    return Array.from(new Set(rooms.map((room) => room.name))).join(' / ');
}

function resolveRoomVisualPosition(room: BetrayalRoomNode): { x: number; y: number } {
    return { x: room.x, y: room.y };
}

const ROOM_VISUAL_BY_ID: Partial<Record<BetrayalRoomVisualId, BetrayalRoomTileVisual>> = {
    startTriple: BETRAYAL_ROOM_TILE_VISUALS.startTripleRoom,
    startHallway: BETRAYAL_ROOM_TILE_VISUALS.startHallway,
    upperLanding: BETRAYAL_ROOM_TILE_VISUALS.startUpperLanding,
    basementLanding: BETRAYAL_ROOM_TILE_VISUALS.startBasementLanding,
    conservatory: BETRAYAL_ROOM_TILE_VISUALS.conservatory,
    bedroom: BETRAYAL_ROOM_TILE_VISUALS.bedroom,
    attic: BETRAYAL_ROOM_TILE_VISUALS.attic,
    study: BETRAYAL_ROOM_TILE_VISUALS.study,
    gallery: BETRAYAL_ROOM_TILE_VISUALS.gallery,
    entranceHall: BETRAYAL_ROOM_TILE_VISUALS.startEntranceHall,
    diningRoom: BETRAYAL_ROOM_TILE_VISUALS.diningRoom,
    foyer: BETRAYAL_ROOM_TILE_VISUALS.startGroundFloorStaircase,
    ballroom: BETRAYAL_ROOM_TILE_VISUALS.ballroom,
    kitchen: BETRAYAL_ROOM_TILE_VISUALS.kitchen,
    chapel: BETRAYAL_ROOM_TILE_VISUALS.chapel,
    larder: BETRAYAL_ROOM_TILE_VISUALS.larder,
    laboratory: BETRAYAL_ROOM_TILE_VISUALS.laboratory,
    graveyard: BETRAYAL_ROOM_TILE_VISUALS.graveyard,
    panicRoom: BETRAYAL_ROOM_TILE_VISUALS.panicRoom,
    undergroundCavern: BETRAYAL_ROOM_TILE_VISUALS.undergroundCavern,
    library: BETRAYAL_ROOM_TILE_VISUALS.library,
    ritualRoom: BETRAYAL_ROOM_TILE_VISUALS.ritualRoom,
    undergroundLake: BETRAYAL_ROOM_TILE_VISUALS.undergroundLake,
    catacombs: BETRAYAL_ROOM_TILE_VISUALS.catacombs,
    secretStaircase: BETRAYAL_ROOM_TILE_VISUALS.secretStaircase,
    furnaceRoom: BETRAYAL_ROOM_TILE_VISUALS.furnaceRoom,
    winterBedroom: BETRAYAL_ROOM_TILE_VISUALS.winterBedroom,
    guestQuarters: BETRAYAL_ROOM_TILE_VISUALS.guestQuarters,
    bloodyRoom: BETRAYAL_ROOM_TILE_VISUALS.bloodyRoom,
    collapsedRoom: BETRAYAL_ROOM_TILE_VISUALS.collapsedRoom,
    junkRoom: BETRAYAL_ROOM_TILE_VISUALS.junkRoom,
    specimenRoom: BETRAYAL_ROOM_TILE_VISUALS.specimenRoom,
    charredRoom: BETRAYAL_ROOM_TILE_VISUALS.charredRoom,
    salon: BETRAYAL_ROOM_TILE_VISUALS.salon,
    primaryBedroom: BETRAYAL_ROOM_TILE_VISUALS.primaryBedroom,
    organRoom: BETRAYAL_ROOM_TILE_VISUALS.organRoom,
    soundproofedRoom: BETRAYAL_ROOM_TILE_VISUALS.soundproofedRoom,
    nursery: BETRAYAL_ROOM_TILE_VISUALS.nursery,
    operatingTheatre: BETRAYAL_ROOM_TILE_VISUALS.operatingTheatre,
    crawlspace: BETRAYAL_ROOM_TILE_VISUALS.crawlspace,
    gameRoom: BETRAYAL_ROOM_TILE_VISUALS.gameRoom,
    gymnasium: BETRAYAL_ROOM_TILE_VISUALS.gymnasium,
    armory: BETRAYAL_ROOM_TILE_VISUALS.armory,
    crampedPassageway: BETRAYAL_ROOM_TILE_VISUALS.crampedPassageway,
    mysticElevator: BETRAYAL_ROOM_TILE_VISUALS.mysticElevator,
    backUpper: BETRAYAL_ROOM_TILE_VISUALS.backUpper,
    backGround: BETRAYAL_ROOM_TILE_VISUALS.backGround,
    backBasement: BETRAYAL_ROOM_TILE_VISUALS.backBasement,
};

function resolveRoomTileVisual(room: BetrayalRoomNode, isDiscovered: boolean): BetrayalRoomTileVisual {
    const visualId = isDiscovered ? room.visualId : room.backVisualId;
    return ROOM_VISUAL_BY_ID[visualId] ?? BETRAYAL_ROOM_TILE_VISUALS.conservatory;
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
    return {
        left: ROOM_CANVAS_PADDING + roomPosition.x * ROOM_TILE_STEP_X,
        top: ROOM_CANVAS_PADDING + roomPosition.y * ROOM_TILE_STEP_Y,
        width: ROOM_TILE_SIZE,
        height: ROOM_TILE_SIZE,
    };
}

function resolveTradeTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.otherExplorers.filter((explorer) => (
        explorer.roomId === core.activeRoomId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
}

function resolveCorpseLootTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.otherExplorers.filter((explorer) => (
        explorer.roomId === core.activeRoomId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        && explorer.inventory.length > 0
        && !core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn.includes(explorer.playerId)
    ));
}

function resolveInventoryCardAccentAsset(card: BetrayalInventoryCard): string {
    const effect = resolveUseEffect(card);
    if (!effect) {
        return ASSETS.trait.knowledge;
    }
    if (effect.mode === 'move') {
        return ASSETS.trait.speed;
    }
    if (effect.mode === 'moveOthersInRoom') {
        return ASSETS.trait.speed;
    }
    if (effect.mode === 'healTraits') {
        return ASSETS.trait.might;
    }
    if (effect.mode === 'placeExplorer') {
        return ASSETS.trait.speed;
    }
    if (effect.mode === 'nextNonCombatTraitReplacement') {
        return ASSETS.trait[effect.replacementTrait];
    }
    return ASSETS.trait[effect.trait ?? 'knowledge'];
}

function formatSignedDelta(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
}

function resolvePreviewUseEffectLabel(
    cardOrEffect: BetrayalInventoryCard | PossessionUseEffectProfile | null,
    t: ReturnType<typeof useTranslation>['t'],
): string {
    if (!cardOrEffect) {
        return t('board.status.noSelectedCard');
    }
    const profile = 'mode' in cardOrEffect
        ? cardOrEffect
        : resolveUseEffect(cardOrEffect);
    if (!profile) {
        return '按卡面规则持有';
    }
    if (profile.mode === 'move') {
        return t('board.useEffects.move', { value: formatSignedDelta(profile.amount) });
    }
    if (profile.mode === 'moveOthersInRoom') {
        return '移动同板块其他角色到相邻板块';
    }
    if (profile.mode === 'healTraits') {
        return `治疗${profile.traits.map((trait) => t(`board.traits.${trait}`)).join('和')}`;
    }
    if (profile.mode === 'placeExplorer') {
        return '放置到已发现板块';
    }
    if (profile.mode === 'nextNonCombatTraitReplacement') {
        return `下一次非战斗检定可用${t(`board.traits.${profile.replacementTrait}`)}替换`;
    }
    return t('board.useEffects.trait', {
        trait: t(`board.traits.${profile.trait}`),
        value: formatSignedDelta(profile.amount),
    });
}

function resolveSelectedTradeTargetPlayerId(
    tradeTargets: BetrayalExplorerSummary[],
    selectedTradeTargetPlayerId: string | null,
): string | null {
    if (selectedTradeTargetPlayerId && tradeTargets.some((explorer) => explorer.playerId === selectedTradeTargetPlayerId)) {
        return selectedTradeTargetPlayerId;
    }
    return null;
}

function resolveSelectedDogTradeCardIds(
    inventory: BetrayalInventoryCard[],
    selectedCardIds: string[],
): string[] {
    const inventoryCardIds = new Set(inventory.map((card) => card.id));
    return selectedCardIds.filter((cardId) => inventoryCardIds.has(cardId) && cardId !== 'dog');
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
    const assetHeightClass = compact ? 'h-[232px]' : 'h-[280px]';
    const widthClass = compact ? 'w-[224px]' : 'w-full max-w-[348px]';
    const stateToneClass = taken && !selected
        ? 'border-[#5c5548] bg-[rgba(14,14,12,0.9)] text-[#8e8371]'
        : ready
            ? 'border-[#77bb77] bg-[rgba(19,43,25,0.92)] text-[#9bea8e]'
            : selected
                ? 'border-[#b5ef42] bg-[rgba(34,55,18,0.94)] text-[#dfff8f]'
                : 'border-[#8b744d] bg-[rgba(22,17,12,0.92)] text-[#e4c983]';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={taken && !selected}
            data-testid={`betrayal-character-card-${explorer.explorerId}`}
            className={`group relative ${widthClass} text-left transition duration-200 ${
                selected
                    ? 'drop-shadow-[0_0_28px_rgba(181,239,66,0.44)]'
                    : taken
                        ? 'opacity-55 grayscale'
                        : 'hover:-translate-y-1 hover:drop-shadow-[0_0_18px_rgba(211,179,109,0.28)]'
            }`}
        >
            <div className={`relative flex w-full items-end justify-center ${assetHeightClass}`}>
                {selected ? (
                    <div className="pointer-events-none absolute inset-x-[10%] inset-y-[7%] rounded-[42%] bg-[rgba(181,239,66,0.18)] blur-2xl" />
                ) : null}
                <div className="pointer-events-none absolute inset-x-[13%] bottom-[7%] h-[18%] rounded-[18px] bg-[linear-gradient(180deg,rgba(9,13,11,0),rgba(8,12,10,0.64))]" />
                <OptimizedImage
                    src={explorer.portraitAsset}
                    locale={effectiveLocale}
                    alt={explorer.displayName}
                    className="relative z-10 h-full w-full object-contain"
                    draggable={false}
                />
            </div>
            <div className={`pointer-events-none absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center justify-center gap-2 rounded-[12px] border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] shadow-[0_8px_18px_rgba(0,0,0,0.32)] ${stateToneClass}`}>
                <span className="grid h-4 w-4 place-items-center rounded-full border border-current/50 text-[10px] leading-none">
                    {taken && !selected ? '×' : ready ? '✓' : selected ? '•' : '•'}
                </span>
                <span>{stateLabel}</span>
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
    const { t } = useTranslation('game-betrayal');
    const selectedExplorer = EXPLORER_CATALOG.find((item) => item.explorerId === selectedExplorerId) ?? EXPLORER_CATALOG[0]!;
    const readySet = new Set(core.readyPlayerIds);
    const isReady = readySet.has(viewerPlayerId);
    const selectedByExplorerId = new Map(
        Object.entries(core.selectedExplorerByPlayerId).map(([playerId, explorerId]) => [explorerId, playerId]),
    );
    const availableExplorer = EXPLORER_CATALOG.find((explorer) => {
        const selectedByPlayer = selectedByExplorerId.get(explorer.explorerId) ?? null;
        return !selectedByPlayer || selectedByPlayer === viewerPlayerId;
    }) ?? EXPLORER_CATALOG[0]!;

    return (
        <div
            data-testid="betrayal-character-select-screen"
            data-tutorial-id="betrayal-character-select-screen"
            className="relative flex h-full min-h-full flex-col overflow-hidden bg-[#09110f] text-[#f1e8d4]"
            style={{
                backgroundImage: [
                    'radial-gradient(circle at 18% 22%, rgba(118,178,82,0.16), transparent 19%)',
                    'radial-gradient(circle at 72% 14%, rgba(196,167,98,0.08), transparent 24%)',
                    'repeating-linear-gradient(90deg, rgba(38,52,44,0.03) 0 2px, rgba(0,0,0,0) 2px 28px)',
                    'linear-gradient(180deg, #10201a 0%, #07100e 100%)',
                ].join(','),
            }}
        >
            <div className="mx-auto flex h-full w-full max-w-[1760px] p-3 md:p-4">
                <div className="relative flex h-full w-full flex-col overflow-hidden border border-[#7d643a] bg-[rgba(8,15,13,0.94)] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
                    <div className="pointer-events-none absolute inset-0 border border-[rgba(216,191,129,0.14)]" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(132,170,82,0.06),transparent_28%)]" />
                    <div className="pointer-events-none absolute left-1 top-1 h-4 w-4 border-l border-t border-[rgba(216,191,129,0.6)]" />
                    <div className="pointer-events-none absolute right-1 top-1 h-4 w-4 border-r border-t border-[rgba(216,191,129,0.6)]" />
                    <div className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 border-b border-l border-[rgba(216,191,129,0.6)]" />
                    <div className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 border-b border-r border-[rgba(216,191,129,0.6)]" />

                    <header className="grid min-h-[104px] grid-cols-[360px_1fr_240px] border-b border-[#6a5637] bg-[linear-gradient(180deg,rgba(10,16,14,0.98),rgba(9,15,13,0.94))]">
                        <div className="relative flex items-center overflow-hidden border-r border-[#5e4b2e] px-6 py-3">
                            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.26),transparent)]" />
                            <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
                            <div className="relative flex h-[72px] w-full items-center overflow-hidden border border-[rgba(214,191,129,0.28)] bg-[linear-gradient(180deg,rgba(8,12,11,0.74),rgba(5,8,7,0.92))] px-3 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.08)]">
                                <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.12)]" />
                                <OptimizedImage src={ASSETS.titleBanner} locale={effectiveLocale} alt={t('title')} className="relative h-[56px] w-full object-contain object-left" draggable={false} />
                            </div>
                        </div>
                        <div className="relative flex items-center justify-center px-6 py-4 text-center">
                            <div className="pointer-events-none absolute left-[16%] top-1/2 flex items-center gap-2">
                                <span className="h-px w-16 bg-[linear-gradient(90deg,transparent,#9f854d)]" />
                                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
                            </div>
                            <div className="pointer-events-none absolute right-[16%] top-1/2 flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
                                <span className="h-px w-16 bg-[linear-gradient(90deg,#9f854d,transparent)]" />
                            </div>
                            <div className="text-[24px] font-semibold uppercase tracking-[0.28em] text-[#e7c783]">
                                {t('board.characterSelect.title')}
                            </div>
                        </div>
                        <div className="border-l border-[#5e4b2e]">
                            <div className="flex h-full flex-col items-center justify-center px-4 py-3 text-center">
                                <div className="text-xs uppercase tracking-[0.2em] text-[#d8bf81]">{t('board.characterSelect.playersLabel')}</div>
                                <div className="mt-1 text-[22px] font-semibold text-[#a8e850]">{core.readyPlayerIds.length}/{core.playerIds.length}</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#9e8c69]">
                                    {t('board.characterSelect.readyCountLabel')}
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="grid min-h-0 flex-1 grid-cols-[440px_minmax(0,1fr)] gap-0 px-5 pb-3 pt-4 xl:grid-cols-[472px_minmax(0,1fr)]">
                        <aside className="relative flex min-h-0 flex-col pr-6">
                            <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),rgba(214,191,129,0.22),transparent)]" />
                            <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-4 pt-4">
                                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28),transparent)]" />
                                <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
                                <div className="flex justify-center px-2 pt-1">
                                    <ExplorerPentagonCard
                                        explorer={selectedExplorer}
                                        selected
                                        ready={isReady}
                                        taken={false}
                                        effectiveLocale={effectiveLocale}
                                    />
                                </div>
                                <section className="relative mt-3 flex-1 overflow-hidden px-2 pb-3 pt-3">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
                                    <div className="grid gap-3">
                                        <h2 className="truncate text-[24px] font-semibold uppercase tracking-[0.14em] text-[#f3dfae]">{selectedExplorer.displayName}</h2>
                                        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[#b9aa84]">
                                            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(214,191,129,0.18)] bg-[rgba(15,16,13,0.42)] px-3 py-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#d8bf81]" />
                                                {t('board.characterSelect.currentSelection')}
                                            </span>
                                            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(110,133,66,0.26)] bg-[rgba(23,33,19,0.36)] px-3 py-1 text-[#b5ef42]">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#b5ef42]" />
                                                {isReady ? t('board.characterSelect.ready') : t('board.characterSelect.pending')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative mt-4 px-1 py-1">
                                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                                        <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d8bf81]">
                                            <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28))]" />
                                            <span>{t('board.characterSelect.traitsTitle')}</span>
                                            <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(214,191,129,0.28),transparent)]" />
                                        </div>
                                        <div className="grid gap-2.5">
                                        {(['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]).map((trait) => (
                                            <div key={trait} className="grid grid-cols-[92px_minmax(0,1fr)_28px] items-center gap-3 text-sm">
                                                <span className={`inline-flex items-center gap-2 font-semibold ${TRAIT_TONE_CLASS[trait].text}`}>
                                                    <OptimizedImage src={ASSETS.trait[trait]} locale={effectiveLocale} alt="" className="h-5 w-5 object-contain opacity-86" draggable={false} />
                                                    {TRAIT_LABEL_LOCAL[trait]}
                                                </span>
                                                <div className="grid grid-cols-6 gap-1.5">
                                                    {Array.from({ length: 6 }).map((_, index) => (
                                                        <span
                                                            key={index}
                                                            className={`h-3.5 rounded-full border ${
                                                                index < selectedExplorer.traits[trait]
                                                                    ? TRAIT_TONE_CLASS[trait].active
                                                                    : TRAIT_TONE_CLASS[trait].inactive
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="text-right text-base font-semibold text-[#f1e8d4]">{selectedExplorer.traits[trait]}</span>
                                            </div>
                                        ))}
                                    </div>
                                    </div>
                                    <div className="mt-5 border-t border-[rgba(78,65,45,0.54)] pt-4">
                                        <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d8bf81]">
                                            <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28))]" />
                                            <span>{t('board.characterSelect.abilityTitle')}</span>
                                            <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(214,191,129,0.28),transparent)]" />
                                        </div>
                                        <div className="px-1 py-1">
                                            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(110,133,66,0.46)] bg-[rgba(23,33,19,0.62)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b5ef42]">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#b5ef42]" />
                                                {selectedExplorer.abilityName}
                                            </div>
                                            <div className="mt-3 max-w-[340px] text-[12px] leading-5 text-[#d6ccb2]">
                                                {selectedExplorer.abilityText}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </section>
                        </aside>

                        <section className="relative flex min-h-0 items-center justify-center px-5">
                            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.16),transparent)]" />
                            <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.12),transparent)]" />
                            <div
                                className="grid min-h-0 max-w-[1056px] grid-cols-3 content-start justify-items-center gap-x-12 gap-y-10 py-4"
                                data-tutorial-id="betrayal-character-selection-grid"
                            >
                                {EXPLORER_CATALOG.slice(1).map((explorer) => {
                                    const selectedByPlayer = selectedByExplorerId.get(explorer.explorerId) ?? null;
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
                            </div>
                        </section>
                    </main>

                    <footer className="grid grid-cols-[minmax(0,1fr)_520px] border-t border-[#6a5637] bg-[linear-gradient(180deg,rgba(10,16,14,0.98),rgba(9,15,13,0.94))]">
                        <div className="grid grid-cols-[124px_repeat(6,minmax(92px,1fr))] overflow-hidden">
                            <div className="flex flex-col justify-center border-r border-[#5e4b2e] px-3 py-3 text-center">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-[#d8bf81]">{t('board.characterSelect.playersLabel')}</div>
                                <div className="mt-1 text-[16px] font-semibold text-[#a8e850]">{core.readyPlayerIds.length}/{core.playerIds.length}</div>
                            </div>
                            {Array.from({ length: 6 }).map((_, seatIndex) => {
                                const playerId = core.playerIds[seatIndex] ?? null;
                                const selectedId = playerId
                                    ? (core.selectedExplorerByPlayerId[playerId]
                                        ?? (playerId === viewerPlayerId ? selectedExplorerId : null))
                                    : null;
                                const playerName = playerId
                                    ? resolvePlayerName(playerId, `玩家${seatIndex + 1}`, matchData)
                                    : '—';
                                const ready = playerId ? readySet.has(playerId) : false;
                                const seatExplorer = selectedId
                                    ? EXPLORER_CATALOG.find((explorer) => explorer.explorerId === selectedId) ?? null
                                    : null;
                                return (
                                    <div
                                        key={playerId ?? `empty-seat-${seatIndex}`}
                                        className={`flex min-w-0 flex-col items-center justify-center border-r border-[#5e4b2e] px-2 py-2 text-center last:border-r-0 ${
                                            selectedId
                                                ? 'bg-[rgba(75,116,59,0.08)] text-[#d9f0b8]'
                                                : 'bg-[rgba(9,13,12,0.22)] text-[#8d8678]'
                                        }`}
                                    >
                                        <div className={`grid h-[66px] w-[66px] place-items-center overflow-hidden ${
                                            selectedId
                                                ? 'bg-[rgba(13,19,16,0.78)]'
                                                : 'bg-[rgba(13,17,15,0.56)]'
                                        }`}>
                                            {seatExplorer ? (
                                                <OptimizedImage
                                                    src={seatExplorer.portraitAsset}
                                                    locale={effectiveLocale}
                                                    alt={seatExplorer.displayName}
                                                    className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.34)]"
                                                    draggable={false}
                                                />
                                            ) : (
                                                <span className="text-[24px] text-[#3f473f]">—</span>
                                            )}
                                        </div>
                                        <div className="mt-1 text-[11px] font-semibold tracking-[0.12em] text-[#d7bf85]">P{seatIndex + 1}</div>
                                        <div className="mt-0.5 max-w-[82px] truncate text-[11px]">{playerName}</div>
                                        <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                                            ready
                                                ? 'border border-[rgba(132,171,82,0.42)] bg-[rgba(39,57,28,0.42)] text-[#b5ef42]'
                                                : selectedId
                                                    ? 'border border-[rgba(214,191,129,0.22)] bg-[rgba(39,31,18,0.28)] text-[#d8bf81]'
                                                    : 'border border-[rgba(93,79,54,0.18)] bg-transparent text-[#676253]'
                                        }`}>
                                            {ready ? t('board.characterSelect.ready') : selectedId ? t('board.characterSelect.pending') : t('board.characterSelect.emptySeat')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="grid grid-cols-[120px_minmax(0,1fr)_108px]">
                            <button
                                type="button"
                                onClick={() => onSelectExplorer(availableExplorer.explorerId)}
                                className="relative inline-flex min-h-[126px] items-center justify-center gap-3 border-l border-[#5e4b2e] text-[16px] font-semibold uppercase tracking-[0.18em] text-[#d8bf81] transition hover:bg-[rgba(214,191,129,0.06)]"
                            >
                                <span className="pointer-events-none absolute inset-y-3 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                                {t('board.characterSelect.random')}
                            </button>
                            <button
                                type="button"
                                onClick={isReady ? onStartScenario : onConfirmExplorer}
                                data-testid="betrayal-character-confirm"
                                data-tutorial-id="betrayal-character-confirm"
                                className="relative inline-flex min-h-[126px] items-center justify-center gap-2 border-l border-[#5e4b2e] bg-[linear-gradient(180deg,rgba(95,135,44,0.24),rgba(54,81,22,0.76))] text-[26px] font-semibold uppercase tracking-[0.18em] text-[#dfff8f] shadow-[inset_0_0_0_1px_rgba(181,239,66,0.12)] transition hover:bg-[linear-gradient(180deg,rgba(108,149,51,0.3),rgba(61,91,25,0.82))]"
                            >
                                <span className="pointer-events-none absolute inset-2 border border-[rgba(181,239,66,0.16)]" />
                                {isReady ? t('board.characterSelect.start') : t('board.characterSelect.confirm')}
                            </button>
                            <button
                                type="button"
                                className="relative inline-flex min-h-[126px] items-center justify-center gap-2 border-l border-[#5e4b2e] px-4 text-[15px] font-semibold uppercase tracking-[0.18em] text-[#d8bf81] transition hover:bg-[rgba(214,191,129,0.06)]"
                            >
                                <span className="pointer-events-none absolute inset-y-3 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                                <ChevronLeft size={18} />
                                {t('board.characterSelect.back')}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}

const TRAIT_LABEL_LOCAL: Record<BetrayalTraitKey, string> = {
    might: '力量',
    speed: '速度',
    knowledge: '知识',
    sanity: '神志',
};

const TRAIT_TONE_CLASS: Record<BetrayalTraitKey, { active: string; inactive: string; text: string }> = {
    might: {
        active: 'border-[#cf715f] bg-[#cf715f]',
        inactive: 'border-[rgba(207,113,95,0.34)] bg-[rgba(34,19,18,0.68)]',
        text: 'text-[#e8b09f]',
    },
    speed: {
        active: 'border-[#d6be67] bg-[#d6be67]',
        inactive: 'border-[rgba(214,190,103,0.34)] bg-[rgba(35,31,18,0.68)]',
        text: 'text-[#ebdca1]',
    },
    knowledge: {
        active: 'border-[#8ebac5] bg-[#8ebac5]',
        inactive: 'border-[rgba(142,186,197,0.32)] bg-[rgba(17,26,28,0.68)]',
        text: 'text-[#cbe4ea]',
    },
    sanity: {
        active: 'border-[#9f7bc5] bg-[#9f7bc5]',
        inactive: 'border-[rgba(159,123,197,0.32)] bg-[rgba(24,19,31,0.68)]',
        text: 'text-[#d9c4ef]',
    },
};

const TRAIT_VALUE_TEXT_CLASS: Record<BetrayalTraitKey, string> = {
    might: 'text-[#f0b29f]',
    speed: 'text-[#f2e09e]',
    knowledge: 'text-[#cbe7ee]',
    sanity: 'text-[#dcc7f1]',
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
    const { t } = useTranslation('game-betrayal');
    const result = core.endgameResult;
    const allExplorers = [core.currentExplorer, ...core.otherExplorers];
    const survivors = result
        ? allExplorers.filter((explorer) => result.survivorsEscaped.includes(explorer.playerId))
        : allExplorers.slice(0, Math.max(1, allExplorers.length - 1));
    const traitor = result
        ? allExplorers.find((explorer) => explorer.playerId === result.traitorPlayerId) ?? allExplorers[allExplorers.length - 1]
        : allExplorers[allExplorers.length - 1];
    const survivorsWon = result?.outcome !== 'traitor';
    const outcomeTitle = survivorsWon ? t('board.endgame.victory') : t('board.endgame.defeat');
    const outcomeSubtitle = survivorsWon ? t('board.endgame.survivorsEscaped') : t('board.endgame.traitorSucceeded');
    const survivorsTitle = survivorsWon ? t('board.endgame.survivorsStatusWin') : t('board.endgame.survivorsStatusLose');
    const traitorTitle = survivorsWon ? t('board.endgame.traitorStatusLose') : t('board.endgame.traitorStatusWin');
    const endgameTraitOrder = ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[];
    const roomsExploredCount = result?.stats.roomsExplored ?? core.rooms.filter((room) => room.state === 'discovered').length;
    const omensDrawnCount = result?.stats.omensDrawn ?? 0;
    const eventsDrawnCount = result?.stats.eventsDrawn ?? 0;

    return (
        <div
            data-testid="betrayal-endgame-screen"
            data-tutorial-id="betrayal-endgame-screen"
            className="relative flex h-full min-h-full flex-col overflow-hidden bg-[#08110f] text-[#f1e8d4]"
            style={{
                backgroundImage: [
                    'radial-gradient(circle at 50% 10%, rgba(156,203,77,0.14), transparent 24%)',
                    'repeating-linear-gradient(90deg, rgba(45,61,50,0.04) 0 2px, rgba(0,0,0,0) 2px 22px)',
                    'repeating-linear-gradient(0deg, rgba(37,52,42,0.03) 0 2px, rgba(0,0,0,0) 2px 24px)',
                    'linear-gradient(180deg, #0d1714 0%, #07100e 100%)',
                ].join(','),
            }}
        >
            <div className="mx-auto flex h-full min-h-full w-full max-w-[1760px] p-3 md:p-4">
                <div className="relative flex min-h-full w-full flex-col overflow-hidden border border-[#876a3c] bg-[rgba(9,15,13,0.95)] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
                    <div className="pointer-events-none absolute inset-0 border border-[rgba(216,191,129,0.14)]" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(132,170,82,0.08),transparent_28%)]" />
                    <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(38,51,44,0.03)_0_2px,rgba(0,0,0,0)_2px_26px)]" />
                    <div className="pointer-events-none absolute left-1 top-1 h-4 w-4 border-l border-t border-[rgba(216,191,129,0.6)]" />
                    <div className="pointer-events-none absolute right-1 top-1 h-4 w-4 border-r border-t border-[rgba(216,191,129,0.6)]" />
                    <div className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 border-b border-l border-[rgba(216,191,129,0.6)]" />
                    <div className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 border-b border-r border-[rgba(216,191,129,0.6)]" />

                    <header className="relative grid min-h-[118px] grid-cols-[minmax(300px,1fr)_1.42fr_minmax(330px,1fr)] divide-x divide-[#5e4b2e] border-b border-[#6a5637] bg-[linear-gradient(180deg,rgba(10,16,14,0.985),rgba(8,14,13,0.95))] px-5 py-3">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.3),transparent)]" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                        <div className="relative flex items-center overflow-hidden px-4 py-2.5">
                            <div className="pointer-events-none absolute inset-y-2 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.42),transparent)]" />
                            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28),transparent)]" />
                            <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.12),transparent)]" />
                            <div className="relative flex h-[74px] w-full items-center overflow-hidden border border-[rgba(214,191,129,0.3)] bg-[linear-gradient(180deg,rgba(8,12,11,0.72),rgba(5,8,7,0.92))] px-3 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.08)]">
                                <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.12)]" />
                                <OptimizedImage src={ASSETS.titleBanner} locale={effectiveLocale} alt={t('title')} className="relative h-[58px] w-full object-contain object-left" draggable={false} />
                            </div>
                        </div>
                        <div className="relative flex flex-col items-center justify-center px-6 py-2 text-center">
                            <div className="text-xs uppercase tracking-[0.34em] text-[#e1c480]">{t('board.endgame.title')}</div>
                            <div className={`mt-1 text-[56px] font-bold tracking-[0.1em] drop-shadow-[0_0_18px_rgba(183,239,116,0.28)] ${
                                survivorsWon ? 'text-[#b7ef74]' : 'text-[#eb8a67]'
                            }`}>
                                {outcomeTitle}
                            </div>
                            <div className="mt-1 text-[17px] tracking-[0.24em] text-[#f1e1bb]">{outcomeSubtitle}</div>
                            <div className="pointer-events-none absolute left-[14%] top-1/2 flex items-center gap-2">
                                <span className="h-px w-16 bg-[linear-gradient(90deg,transparent,#9f854d)]" />
                                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
                            </div>
                            <div className="pointer-events-none absolute right-[14%] top-1/2 flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
                                <span className="h-px w-16 bg-[linear-gradient(90deg,#9f854d,transparent)]" />
                            </div>
                        </div>
                        <div className="relative flex items-stretch overflow-hidden px-4 py-2.5">
                            <div className="pointer-events-none absolute inset-y-2 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.42),transparent)]" />
                            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28),transparent)]" />
                            <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.12),transparent)]" />
                            <div className="relative flex flex-1 overflow-hidden border border-[rgba(214,191,129,0.3)] bg-[linear-gradient(180deg,rgba(8,12,11,0.72),rgba(5,8,7,0.92))] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.08)]">
                                <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.12)]" />
                                <div className="relative hidden w-[148px] overflow-hidden md:block">
                                    <OptimizedImage src={ASSETS.cover} locale={effectiveLocale} alt="" className="h-full w-full object-cover opacity-46" draggable={false} />
                                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,11,0.1),rgba(8,12,11,0.52))]" />
                                </div>
                                <div className="relative flex flex-col justify-center px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.26em] text-[#ddb774]">{t('board.scenario.button')}</div>
                                    <div className="mt-1 text-[28px] font-semibold tracking-[0.08em] text-[#f3e1bd]">{result?.hauntTitle ?? scenarioConfig.hauntTitle}</div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="grid min-h-0 flex-1 grid-cols-[318px_minmax(0,1.18fr)_286px] gap-0 px-4 pb-3 pt-3 xl:grid-cols-[336px_minmax(0,1.22fr)_304px]">
                        <section className="relative flex min-h-0 flex-col gap-3 px-2 pb-1 pt-1 pr-4">
                            <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.2),rgba(214,191,129,0.2),transparent)]" />
                            <div className="relative overflow-hidden px-3 py-3">
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(179,239,116,0.45),transparent)]" />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.16),transparent)]" />
                                <div className="text-center text-[19px] font-semibold uppercase tracking-[0.16em] text-[#b7ef74]">{t('board.endgame.survivors')}</div>
                                <div className="mt-1 text-center text-[13px] uppercase tracking-[0.18em] text-[#d6e3b5]">{survivorsTitle}</div>
                                <div className="mt-4 space-y-2">
                                    {survivors.map((explorer) => (
                                        <div
                                            key={explorer.playerId}
                                            className="relative grid grid-cols-[50px_1fr_38px] items-center gap-3 border-y border-[rgba(126,102,61,0.3)] bg-[linear-gradient(180deg,rgba(15,21,19,0.34),rgba(8,11,10,0.42))] px-2 py-2"
                                        >
                                            <div className="relative grid h-[50px] w-[50px] place-items-center overflow-hidden rounded-full border border-[rgba(177,151,92,0.3)] bg-[radial-gradient(circle_at_50%_38%,rgba(61,89,72,0.18),rgba(8,11,10,0.74)_72%)]">
                                                <OptimizedImage
                                                    src={explorer.portraitAsset}
                                                    locale={effectiveLocale}
                                                    alt={explorer.displayName}
                                                    className="h-[48px] w-[48px] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.32)]"
                                                    draggable={false}
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="min-h-[18px] whitespace-normal pr-2 text-[11px] font-semibold leading-[1.08] tracking-[0.03em] text-[#f4e6c7]" style={{ wordBreak: 'break-word' }}>
                                                    {resolveEndgameExplorerName(explorer, matchData)}
                                                </div>
                                                <div className="mt-1 grid grid-cols-2 gap-1">
                                                    {endgameTraitOrder.map((key) => (
                                                        <span key={key} className="inline-flex items-center gap-1 rounded-full border border-[rgba(112,92,58,0.34)] bg-[rgba(17,15,12,0.42)] px-1 py-0.5 text-[9px] text-[#f3e6c9]">
                                                            <OptimizedImage
                                                                src={ASSETS.trait[key]}
                                                                locale={effectiveLocale}
                                                                alt={TRAIT_LABEL_LOCAL[key]}
                                                                className="h-3.5 w-3.5 object-contain opacity-90"
                                                                draggable={false}
                                                            />
                                                            <span className="font-semibold leading-none">{explorer.traits[key]}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid place-items-center text-center">
                                                <div
                                                    className="relative grid h-[42px] w-[38px] place-items-center border border-[rgba(132,171,82,0.44)] bg-[radial-gradient(circle_at_50%_24%,rgba(182,234,104,0.18),rgba(23,33,19,0.84)_72%)] text-[15px] font-semibold text-[#b7ef74] shadow-[0_8px_14px_rgba(0,0,0,0.18)]"
                                                    style={{ clipPath: ENDGAME_MEDALLION_CLIP_PATH }}
                                                >
                                                    <span
                                                        className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.2)]"
                                                        style={{ clipPath: ENDGAME_MEDALLION_CLIP_PATH }}
                                                    />
                                                    {Object.values(explorer.traits).reduce((sum, value) => sum + value, 0)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="relative overflow-hidden px-2 pb-2 pt-2">
                                <div className="mb-2.5 flex items-center gap-3">
                                    <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(221,183,116,0.34))]" />
                                    <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#ddb774]">{outcomeSubtitle}</div>
                                    <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(221,183,116,0.34),transparent)]" />
                                </div>
                                <div className="relative overflow-hidden border border-[rgba(108,84,53,0.64)] bg-[rgba(3,7,6,0.58)] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.06)]">
                                    <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.08)]" />
                                    <OptimizedImage src={ASSETS.cover} locale={effectiveLocale} alt={outcomeSubtitle} className="h-[104px] w-full object-cover opacity-78" draggable={false} />
                                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,8,0.14),rgba(6,10,8,0.62))]" />
                                    <div className="absolute inset-x-4 bottom-4 flex items-end justify-center">
                                        {survivors.map((explorer, index) => (
                                            <OptimizedImage
                                                key={explorer.playerId}
                                                src={explorer.portraitAsset}
                                                locale={effectiveLocale}
                                                alt={explorer.displayName}
                                                className="h-[56px] w-[56px] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                                                style={{ marginLeft: index === 0 ? 0 : -20 }}
                                                draggable={false}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="relative flex min-h-0 flex-col items-center justify-start gap-3 px-3">
                            <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),rgba(214,191,129,0.22),transparent)]" />
                            <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),rgba(214,191,129,0.22),transparent)]" />
                            <div className="relative w-full max-w-[728px] border border-[#aa864b] bg-[linear-gradient(180deg,rgba(54,40,22,0.98),rgba(28,21,14,0.99))] p-[9px] shadow-[0_22px_48px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(226,185,102,0.12)]">
                                <div className="pointer-events-none absolute inset-1 border border-[rgba(226,185,102,0.28)]" />
                                <div className="pointer-events-none absolute inset-[5px] border border-[rgba(54,38,18,0.86)]" />
                                <div className="pointer-events-none absolute inset-x-3 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(232,190,106,0.62),transparent)]" />
                                <div className="pointer-events-none absolute inset-x-3 bottom-1 h-px bg-[linear-gradient(90deg,transparent,rgba(232,190,106,0.3),transparent)]" />
                                <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                                    <span className="h-10 w-1 rounded-full bg-[linear-gradient(180deg,rgba(232,190,106,0),rgba(232,190,106,0.95),rgba(232,190,106,0))]" />
                                </div>
                                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                                    <span className="h-10 w-1 rounded-full bg-[linear-gradient(180deg,rgba(232,190,106,0),rgba(232,190,106,0.95),rgba(232,190,106,0))]" />
                                </div>

                                <div
                                    className="relative overflow-hidden border border-[#6f5935] px-5 pb-4 pt-4 text-[#2c2419] shadow-[inset_0_0_0_1px_rgba(255,238,198,0.1)]"
                                    style={{
                                        backgroundImage: [
                                            'radial-gradient(circle at 14% 18%, rgba(246,229,187,0.34), transparent 15%)',
                                            'radial-gradient(circle at 86% 18%, rgba(92,65,35,0.3), transparent 18%)',
                                            'radial-gradient(circle at 52% 62%, rgba(62,43,22,0.23), transparent 54%)',
                                            'radial-gradient(circle at 26% 82%, rgba(134,104,66,0.18), transparent 17%)',
                                            'radial-gradient(circle at 72% 80%, rgba(89,67,41,0.16), transparent 16%)',
                                            'linear-gradient(180deg, rgba(52,35,17,0.42) 0%, rgba(0,0,0,0) 9%, rgba(0,0,0,0) 91%, rgba(52,35,17,0.46) 100%)',
                                            'repeating-linear-gradient(0deg, rgba(78,60,35,0.06) 0 2px, rgba(0,0,0,0) 2px 8px)',
                                            'repeating-linear-gradient(90deg, rgba(117,94,58,0.045) 0 1px, rgba(0,0,0,0) 1px 8px)',
                                            'linear-gradient(180deg, #b7a27a 0%, #a79068 25%, #8f7956 66%, #a38c65 100%)',
                                        ].join(','),
                                        boxShadow: 'inset 0 0 0 1px rgba(98,72,40,0.26), inset 0 0 84px rgba(44,30,15,0.32), inset 0 0 22px rgba(255,236,198,0.1)',
                                    }}
                                >
                                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(69,52,29,0.22),rgba(0,0,0,0)_7%,rgba(0,0,0,0)_93%,rgba(69,52,29,0.24))]" />
                                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(52,39,22,0.16),rgba(0,0,0,0)_8%,rgba(0,0,0,0)_92%,rgba(52,39,22,0.2))]" />
                                    <div className="pointer-events-none absolute inset-0 opacity-42 mix-blend-multiply" style={{ backgroundImage: 'radial-gradient(circle at 18% 28%, rgba(120,88,54,0.24) 0 1px, transparent 1px), radial-gradient(circle at 72% 64%, rgba(102,74,45,0.2) 0 1px, transparent 1px), radial-gradient(circle at 42% 78%, rgba(134,102,63,0.16) 0 1px, transparent 1px)', backgroundSize: '128px 96px, 156px 112px, 138px 124px' }} />
                                    <div className="pointer-events-none absolute inset-2 border border-[rgba(74,52,27,0.48)]" />
                                    <div className="pointer-events-none absolute inset-[18px] border border-[rgba(132,108,68,0.24)]" />
                                    <div className="pointer-events-none absolute inset-x-[72px] top-[48px] h-px bg-[linear-gradient(90deg,transparent,rgba(74,52,27,0.42),transparent)]" />
                                    <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-[#6f5830]" />
                                    <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-[#6f5830]" />
                                    <div className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-[#6f5830]" />
                                    <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-[#6f5830]" />

                                    <div className="relative text-center">
                                        <div className="pointer-events-none absolute left-[13%] top-1/2 h-px w-16 -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(73,49,24,0.9))]" />
                                        <div className="pointer-events-none absolute right-[13%] top-1/2 h-px w-16 -translate-y-1/2 bg-[linear-gradient(90deg,rgba(73,49,24,0.9),transparent)]" />
                                        <div className="text-[36px] font-bold tracking-[0.14em] text-[#302315] drop-shadow-[0_1px_0_rgba(229,207,159,0.32)]">{result?.hauntTitle ?? scenarioConfig.hauntTitle}</div>
                                        <div className="pointer-events-none mt-2 flex items-center justify-center gap-2">
                                            <span className="h-px w-20 bg-[linear-gradient(90deg,transparent,rgba(73,49,24,0.78))]" />
                                            <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(73,49,24,0.78)] bg-[rgba(133,108,68,0.24)]" />
                                            <span className="h-px w-20 bg-[linear-gradient(90deg,rgba(73,49,24,0.78),transparent)]" />
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-[1fr_1fr] gap-0 border-t border-[#6f5d3d]">
                                        <div className="relative border-r border-[#6f5d3d] pr-4 pt-4">
                                            <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">{t('board.scenario.objectiveLabel')}</div>
                                            <div className="mt-4 flex h-14 items-center justify-center">
                                                {survivors.slice(0, 2).map((explorer, index) => (
                                                    <OptimizedImage
                                                        key={explorer.playerId}
                                                        src={explorer.portraitAsset}
                                                        locale={effectiveLocale}
                                                        alt={explorer.displayName}
                                                        className="h-14 w-14 object-contain drop-shadow-[0_8px_18px_rgba(64,75,40,0.42)]"
                                                        style={{ marginLeft: index === 0 ? 0 : -20 }}
                                                        draggable={false}
                                                    />
                                                ))}
                                            </div>
                                            <p className="mt-4 text-center text-[14px] font-semibold leading-[1.35] text-[#352a1e]">{t('board.endgame.survivorsEscaped')}。</p>
                                            <div className="mt-4 flex justify-center">
                                                <div className="relative grid h-[72px] w-[72px] rotate-[-11deg] place-items-center rounded-full border-[4px] border-[#476a31] text-[18px] font-bold tracking-[0.08em] text-[#476a31] opacity-90 shadow-[inset_0_0_0_2px_rgba(71,106,49,0.34)]">
                                                    <span className="pointer-events-none absolute inset-[11px] rounded-full border-2 border-[rgba(71,106,49,0.46)]" />
                                                    {t('board.endgame.completedStamp')}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pl-4 pt-4">
                                            <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">{t('board.endgame.resultLabel')}</div>
                                            <div className="mt-4 flex h-14 items-center justify-center">
                                                {survivors.slice(0, 2).map((explorer, index) => (
                                                    <OptimizedImage
                                                        key={explorer.playerId}
                                                        src={explorer.portraitAsset}
                                                        locale={effectiveLocale}
                                                        alt={explorer.displayName}
                                                        className="h-14 w-14 object-contain drop-shadow-[0_8px_18px_rgba(64,75,40,0.42)]"
                                                        style={{ marginLeft: index === 0 ? 0 : -20 }}
                                                        draggable={false}
                                                    />
                                                ))}
                                            </div>
                                            <div className={`mt-4 text-center text-[38px] font-bold tracking-[0.12em] drop-shadow-[0_1px_0_rgba(230,211,163,0.28)] ${survivorsWon ? 'text-[#4d7330]' : 'text-[#92493e]'}`}>
                                                {outcomeTitle}
                                            </div>
                                            <div className="mt-4 border-t border-[#6f5d3d] pt-3">
                                                <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">{t('board.endgame.rewardsLabel')}</div>
                                                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)] text-[32px] leading-none text-[#bf9647] drop-shadow-[0_2px_0_rgba(86,58,22,0.45)]">★</span>
                                                        <div className="text-[30px] font-semibold">{result?.reward.stars ?? 4}</div>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)]">
                                                            <OptimizedImage src={ASSETS.deck.omen} locale={effectiveLocale} alt="" className="h-10 w-7 object-cover" draggable={false} />
                                                        </span>
                                                        <div className="text-[30px] font-semibold">{result?.reward.omens ?? 2}</div>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)]">
                                                            <BookOpen size={28} className="text-[#5d7d8d]" />
                                                        </span>
                                                        <div className="text-[30px] font-semibold">{result?.reward.logs ?? 1}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pointer-events-none absolute left-1/2 top-[82px] bottom-5 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(94,73,42,0),rgba(94,73,42,0.72),rgba(94,73,42,0.72),rgba(94,73,42,0))]" />
                                </div>
                            </div>

                            <div className="flex shrink-0 gap-3 pb-1">
                                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                                    <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                                    <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                                    <RotateCcw size={22} />
                                    <span>{t('board.endgame.rematch')}</span>
                                </button>
                                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                                    <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                                    <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                                    <House size={22} />
                                    <span>{t('board.endgame.lobby')}</span>
                                </button>
                                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                                    <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                                    <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                                    <BookOpen size={22} />
                                    <span>{t('board.endgame.logs')}</span>
                                </button>
                            </div>
                        </section>

                        <section className="relative flex min-h-0 flex-col gap-3 px-2 pb-1 pt-1 pl-4">
                            <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.2),rgba(214,191,129,0.2),transparent)]" />
                            <div className="relative overflow-hidden px-3 pb-2 pt-3">
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(235,114,80,0.42),transparent)]" />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
                                <div className="text-center text-[19px] font-semibold uppercase tracking-[0.16em] text-[#eb7250]">{t('board.endgame.traitor')}</div>
                                <div className="mt-1 text-center text-[13px] uppercase tracking-[0.18em] text-[#f1b49d]">{traitorTitle}</div>
                                {traitor ? (
                                    <div className="relative mt-4 grid grid-cols-[50px_1fr_34px] items-center gap-3 border-y border-[rgba(151,92,74,0.34)] bg-[linear-gradient(180deg,rgba(11,14,12,0.34),rgba(17,10,9,0.48))] px-2 py-2">
                                        <div className="relative grid h-[50px] w-[50px] place-items-center overflow-hidden rounded-full border border-[rgba(177,112,92,0.3)] bg-[radial-gradient(circle_at_50%_38%,rgba(119,50,51,0.16),rgba(11,12,12,0.76)_72%)]">
                                            <OptimizedImage src={traitor.portraitAsset} locale={effectiveLocale} alt={traitor.displayName} className="h-[48px] w-[48px] object-contain" draggable={false} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="min-h-[18px] whitespace-normal pr-2 text-[11px] font-semibold leading-[1.08] tracking-[0.04em] text-[#f3e6c9]" style={{ wordBreak: 'break-word' }}>
                                                {resolveEndgameExplorerName(traitor, matchData)}
                                            </div>
                                        <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#d9a27f]">{result?.hauntTitle ?? scenarioConfig.hauntTitle}</div>
                                        </div>
                                        <div className="grid place-items-center">
                                            <div className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(212,100,82,0.42)] bg-[radial-gradient(circle_at_35%_30%,rgba(214,112,87,0.14),rgba(36,12,11,0.8)_72%)] text-[16px] text-[#ea7659] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.06)]">
                                                ☠
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                                <div className="mt-4 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_38%,rgba(112,35,32,0.14),rgba(17,8,8,0.02)_64%,rgba(0,0,0,0)_72%)] px-4 py-2">
                                    <div className="grid h-[76px] w-[76px] place-items-center rounded-full border border-[rgba(202,85,69,0.2)] text-[34px] font-bold text-[#d55c49] shadow-[inset_0_0_0_7px_rgba(213,92,73,0.05)]">
                                        ☠
                                    </div>
                                    <div className="mt-3 text-[28px] font-bold tracking-[0.08em] text-[#eb7250]">{traitorTitle}</div>
                                </div>
                            </div>

                            <div className="relative overflow-hidden px-2 pb-2 pt-2">
                                <div className="flex items-center gap-3 text-center">
                                    <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(221,183,116,0.34))]" />
                                    <div className="text-[15px] font-semibold uppercase tracking-[0.22em] text-[#ddb774]">{t('board.endgame.statsLabel')}</div>
                                    <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(221,183,116,0.34),transparent)]" />
                                </div>
                                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                                    <div className="border-r border-[rgba(76,60,39,0.44)] pr-2 last:border-r-0">
                                        <Footprints size={28} className="mx-auto text-[#d0af6e]" />
                                        <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">{roomsExploredCount}</div>
                                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">{t('board.endgame.roomsStat')}</div>
                                    </div>
                                    <div className="border-r border-[rgba(76,60,39,0.44)] px-2 last:border-r-0">
                                        <BookOpen size={28} className="mx-auto text-[#c3a166]" />
                                        <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">{omensDrawnCount}</div>
                                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">{t('board.endgame.omensStat')}</div>
                                    </div>
                                    <div className="px-2">
                                        <Search size={28} className="mx-auto text-[#c3a166]" />
                                        <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">{eventsDrawnCount}</div>
                                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">{t('board.endgame.eventsStat')}</div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
}

export default function BetrayalBoard({ G, dispatch, playerID, matchData, locale }: Props) {
    const { t } = useTranslation(['game-betrayal', 'common']);
    const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();
    useTutorialBridge(G?.sys?.tutorial, dispatch as (type: string, payload?: unknown) => void);
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
    const [roomPreviewId, setRoomPreviewId] = React.useState<string | null>(null);
    const [inventoryPreviewCardId, setInventoryPreviewCardId] = React.useState<string | null>(null);
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
        setPreviewState((previousState) => {
            if (baseCore.recommendedAction === 'trade') {
                return createInitialPreviewState(baseCore);
            }
            if (baseCore.currentExplorerInventory.some((card) => card.id === previousState.selectedInventoryCardId)) {
                return {
                    ...createInitialPreviewState(baseCore),
                    selectedInventoryCardId: previousState.selectedInventoryCardId,
                };
            }
            return createInitialPreviewState(baseCore);
        });
        setInventoryPreviewCardId(null);
    }, [baseCore]);

    React.useEffect(() => {
        setSelectedExplorerId(baseCore.selectedExplorerByPlayerId[viewerPlayerId] ?? EXPLORER_CATALOG[0]!.explorerId);
    }, [baseCore, viewerPlayerId]);

    const scenarioConfig = React.useMemo(() => getBetrayalScenarioConfig(baseCore.scenarioId), [baseCore.scenarioId]);
    const dispatchCommand = React.useCallback(<Type extends keyof BetrayalCommandMap>(
        type: Type,
        payload: BetrayalCommandMap[Type],
    ) => {
        dispatch(type, payload);
    }, [dispatch]);
    const applyOptimisticPreviewAfterCommand = React.useCallback(<Type extends keyof BetrayalCommandMap>(
        type: Type,
        payload: BetrayalCommandMap[Type],
        options: { keepSelectedInventoryCardId?: string | null } = {},
    ) => {
        const command = {
            type,
            payload,
            playerId: viewerPlayerId,
            timestamp: Date.now(),
        } as Parameters<typeof BetrayalDomain.execute>[1];
        const validation = BetrayalDomain.validate({ core: baseCore, sys: {} as never }, command);
        if (!validation.valid) {
            return;
        }
        const nextCore = BetrayalDomain.execute({ core: baseCore, sys: {} as never }, command)
            .reduce((currentCore, event) => BetrayalDomain.reduce(currentCore, event), baseCore);
        const nextPreviewState = createInitialPreviewState(nextCore);
        setPreviewState({
            ...nextPreviewState,
            selectedInventoryCardId: options.keepSelectedInventoryCardId
                ?? nextPreviewState.selectedInventoryCardId,
        });
    }, [baseCore, viewerPlayerId]);

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
        dispatchCommand(BETRAYAL_COMMANDS.START_SCENARIO, { scenarioId: baseCore.scenarioId });
    }, [baseCore.scenarioId, dispatchCommand]);
    const core = baseCore;
    const roomOccupants = React.useMemo(() => buildRoomOccupants(core), [core]);
    const roomMonsters = React.useMemo(() => buildRoomMonsters(core), [core]);
    const roomCanvasStyle = React.useMemo(() => resolveRoomCanvasStyle(core.rooms), [core.rooms]);
    const previewRoom = React.useMemo(
        () => core.rooms.find((room) => room.id === roomPreviewId) ?? null,
        [core.rooms, roomPreviewId],
    );
    const previewRoomVisual = previewRoom
        ? resolveRoomTileVisual(previewRoom, previewRoom.state === 'discovered')
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

    const focusRoomInView = React.useCallback((roomId: string, behavior: ScrollBehavior = 'smooth') => {
        const roomGrid = roomGridRef.current;
        if (!roomGrid) {
            return;
        }
        const roomShell = roomGrid.querySelector<HTMLElement>(`[data-testid="betrayal-room-shell-${roomId}"]`);
        if (!roomShell) {
            return;
        }
        roomShell.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior,
        });
    }, []);

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
        () => [
            { id: 'preHaunt', label: t('board.phase.preHaunt') },
            { id: 'haunt', label: t('board.phase.haunt') },
            { id: 'endgame', label: t('board.phase.endgame') },
        ],
        [t],
    );
    const phaseLabel = React.useMemo(
        () => phaseItems.find((item) => item.id === core.phase)?.label ?? t('board.phase.preHaunt'),
        [core.phase, phaseItems, t],
    );
    const deckItems = React.useMemo(() => buildDeckItems(core, t), [core, t]);
    const discardItems = React.useMemo(() => buildDiscardItems(core, t), [core, t]);
    const selectedInventoryCard = core.currentExplorerInventory.find((item) => item.id === previewState.selectedInventoryCardId)
        ?? null;
    const selectedInventoryUseEffect = selectedInventoryCard ? resolveUseEffect(selectedInventoryCard) : null;
    const previewInventoryCard = core.currentExplorerInventory.find((item) => item.id === inventoryPreviewCardId) ?? null;
    const inventoryGroups = React.useMemo(
        () => ({
            item: core.currentExplorerInventory.filter((item) => item.kind === 'item'),
            omen: core.currentExplorerInventory.filter((item) => item.kind === 'omen'),
        }),
        [core.currentExplorerInventory],
    );
    const visibleActivityEntries = React.useMemo(
        () => core.activityLog.filter((entry) => !entry.id.startsWith('scenario-started-')),
        [core.activityLog],
    );
    const latestLogEntry = visibleActivityEntries[0] ?? null;
    const earlierLogEntries = React.useMemo(() => visibleActivityEntries.slice(1, 4), [visibleActivityEntries]);
    const normalMoveTargetRooms = React.useMemo(() => resolveMoveTargetRooms(core), [core]);
    const skeletonKeyMoveTargetRooms = React.useMemo(
        () => core.rooms.filter((room) => canUseSkeletonKeyForMove(core, room.id)),
        [core],
    );
    const skeletonKeyMoveTargetRoomIds = React.useMemo(
        () => new Set(skeletonKeyMoveTargetRooms.map((room) => room.id)),
        [skeletonKeyMoveTargetRooms],
    );
    const moveTargetRooms = React.useMemo(() => {
        const byId = new Map<string, BetrayalRoomNode>();
        for (const room of normalMoveTargetRooms) {
            byId.set(room.id, room);
        }
        for (const room of skeletonKeyMoveTargetRooms) {
            byId.set(room.id, room);
        }
        return [...byId.values()];
    }, [normalMoveTargetRooms, skeletonKeyMoveTargetRooms]);
    const moveTargetRoomIds = React.useMemo(() => new Set(moveTargetRooms.map((room) => room.id)), [moveTargetRooms]);
    const maskTargetRooms = React.useMemo(() => resolveMoveTargetRooms(core), [core]);
    const inventoryTargetRooms = React.useMemo(
        () => core.rooms.filter((room) => room.state === 'discovered'),
        [core.rooms],
    );
    const maskTargetTokens = React.useMemo(() => {
        if (selectedInventoryUseEffect?.mode !== 'moveOthersInRoom') {
            return [];
        }
        return [
            ...core.otherExplorers
                .filter((explorer) => (
                    explorer.roomId === core.currentExplorer.roomId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                ))
                .map((explorer) => ({
                    id: explorer.playerId,
                    name: resolvePlayerName(explorer.playerId, explorer.displayName, matchData),
                    kind: 'explorer' as const,
                })),
            ...core.monsters
                .filter((monster) => monster.roomId === core.currentExplorer.roomId)
                .map((monster) => ({
                    id: monster.id,
                    name: monster.name,
                    kind: 'monster' as const,
                })),
        ];
    }, [
        core.currentExplorer.roomId,
        core.monsters,
        core.otherExplorers,
        core.scenarioRuntime.deadExplorerPlayerIds,
        matchData,
        selectedInventoryUseEffect?.mode,
    ]);
    const selectedMaskTargetRoomIdsByTokenId = React.useMemo(() => {
        if (selectedInventoryUseEffect?.mode !== 'moveOthersInRoom') {
            return {};
        }
        const fallbackRoomId = maskTargetRooms[0]?.id ?? null;
        return Object.fromEntries(
            maskTargetTokens.map((token) => [
                token.id,
                previewState.selectedMaskTargetRoomIdsByTokenId[token.id] ?? fallbackRoomId ?? '',
            ]),
        );
    }, [
        maskTargetRooms,
        maskTargetTokens,
        previewState.selectedMaskTargetRoomIdsByTokenId,
        selectedInventoryUseEffect?.mode,
    ]);
    const selectedInventoryTargetRoomId = selectedInventoryUseEffect?.mode === 'moveOthersInRoom'
        ? maskTargetTokens[0]
            ? selectedMaskTargetRoomIdsByTokenId[maskTargetTokens[0].id] ?? null
            : null
        : selectedInventoryUseEffect?.mode === 'placeExplorer'
            ? previewState.selectedInventoryTargetRoomId ?? inventoryTargetRooms[0]?.id ?? null
            : null;
    const explorableRoomSlots = React.useMemo(() => resolveExplorableRoomSlots(core), [core]);
    const explorableRoomSlotIds = React.useMemo(() => new Set(explorableRoomSlots.map((room) => room.id)), [explorableRoomSlots]);
    const nextDeckKind = React.useMemo(() => {
        for (let index = 0; index < core.drawOrder.length; index += 1) {
            const kind = core.drawOrder[(core.exploreIndex + index) % core.drawOrder.length]!;
            if (core.deckCounts[kind] > 0) {
                return kind;
            }
        }
        return null;
    }, [core.deckCounts, core.drawOrder, core.exploreIndex]);
    const canDeclareHolySymbolExplore = canUseHolySymbolForDiscovery(core);
    const canDeclareIdolExplore = canUseIdolToSkipEvent(core) && nextDeckKind === 'event';
    const useHolySymbolForExplore = previewState.useHolySymbolForExplore && canDeclareHolySymbolExplore;
    const useIdolForExplore = previewState.useIdolForExplore && canDeclareIdolExplore;
    const tradeTargets = React.useMemo(() => resolveTradeTargets(core), [core]);
    const canUseDogTrade = canUseDogForTrade(core);
    const dogTradeTargets = React.useMemo(() => resolveDogTradeTargets(core), [core]);
    const activeTradeTargets = canUseDogTrade && dogTradeTargets.length > 0 ? dogTradeTargets : tradeTargets;
    const corpseLootTargets = React.useMemo(() => resolveCorpseLootTargets(core), [core]);
    const selectedTradeTargetPlayerId = React.useMemo(
        () => resolveSelectedTradeTargetPlayerId(activeTradeTargets, previewState.selectedTradeTargetPlayerId),
        [previewState.selectedTradeTargetPlayerId, activeTradeTargets],
    );
    const selectedDogTradeCardIds = React.useMemo(
        () => resolveSelectedDogTradeCardIds(core.currentExplorerInventory, previewState.selectedDogTradeCardIds),
        [core.currentExplorerInventory, previewState.selectedDogTradeCardIds],
    );
    const useDogTrade = canUseDogTrade && dogTradeTargets.length > 0 && selectedDogTradeCardIds.length > 0;
    const attackWeaponCards = React.useMemo(() => resolveAttackWeaponCards(core), [core]);
    const selectedAttackWeaponCardId = attackWeaponCards.some((card) => card.id === previewState.selectedAttackWeaponCardId)
        ? previewState.selectedAttackWeaponCardId
        : null;
    const healTargetExplorers = React.useMemo(() => {
        if (selectedInventoryUseEffect?.mode !== 'healTraits' || selectedInventoryUseEffect.target !== 'selfOrSameRoomExplorer') {
            return [];
        }
        return [
            core.currentExplorer,
            ...core.otherExplorers.filter((explorer) => (
                explorer.roomId === core.currentExplorer.roomId
                && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            )),
        ];
    }, [
        core.currentExplorer,
        core.otherExplorers,
        core.scenarioRuntime.deadExplorerPlayerIds,
        selectedInventoryUseEffect,
    ]);
    const selectedInventoryTargetPlayerId = selectedInventoryUseEffect?.mode === 'healTraits'
        && selectedInventoryUseEffect.target === 'selfOrSameRoomExplorer'
        ? previewState.selectedInventoryTargetPlayerId ?? healTargetExplorers[0]?.playerId ?? null
        : null;

    React.useEffect(() => {
        if (inventoryPreviewCardId && !previewInventoryCard) {
            setInventoryPreviewCardId(null);
        }
    }, [inventoryPreviewCardId, previewInventoryCard]);
    const selectedTradeTarget = React.useMemo(
        () => activeTradeTargets.find((explorer) => explorer.playerId === selectedTradeTargetPlayerId) ?? null,
        [selectedTradeTargetPlayerId, activeTradeTargets],
    );
    const selectedTradeTargetName = selectedTradeTarget
        ? resolvePlayerName(
            selectedTradeTarget.playerId,
            selectedTradeTarget.displayName,
            matchData,
        )
        : null;
    const tradeSelectionReady = Boolean((useDogTrade || selectedInventoryCard) && selectedTradeTarget);
    const selectedCorpseLootTarget = React.useMemo(
        () => corpseLootTargets.find((explorer) => explorer.playerId === selectedTradeTargetPlayerId) ?? corpseLootTargets[0] ?? null,
        [corpseLootTargets, selectedTradeTargetPlayerId],
    );
    const selectedCardUsedThisTurn = selectedInventoryCard
        ? core.usedCardIdsThisTurn.includes(selectedInventoryCard.id)
        : false;
    const selectedCardAvailableThisTurn = selectedInventoryCard
        ? core.turnStartInventoryCardIds.includes(selectedInventoryCard.id)
        : false;
    const selectedCardCanUseRabbitFoot = selectedInventoryCard
        ? canUseRabbitFootForRecentRoll(core, core.currentExplorer.playerId, selectedInventoryCard.id)
        : false;
    const selectedCardNeedsTargetRoom = selectedInventoryUseEffect?.mode === 'moveOthersInRoom';
    const selectedCardUseDisabled = Boolean(selectedInventoryCard && (
        (!selectedInventoryUseEffect && !selectedCardCanUseRabbitFoot)
        || !selectedCardAvailableThisTurn
        || selectedCardUsedThisTurn
        || (
            selectedCardNeedsTargetRoom
            && (
                maskTargetTokens.length === 0
                || maskTargetTokens.some((token) => !selectedMaskTargetRoomIdsByTokenId[token.id])
            )
        )
    ));
    const tradeStatusText = selectedTradeTarget
        ? t('board.status.tradeTarget', {
            player: selectedTradeTargetName,
        })
        : selectedCorpseLootTarget
            ? t('board.status.lootTarget', {
                player: resolvePlayerName(
                    selectedCorpseLootTarget.playerId,
                    selectedCorpseLootTarget.displayName,
                    matchData,
                ),
            })
            : activeTradeTargets.length > 0
                ? t('board.status.tradeTargetsAvailable', { count: activeTradeTargets.length })
                : t('board.status.noTradeTargets');
    const shouldShowMobileTradeStatus = core.recommendedAction !== 'trade'
        || Boolean(selectedCorpseLootTarget)
        || tradeTargets.length === 0;
    const useStatusText = selectedInventoryCard
        ? selectedCardUsedThisTurn
            ? t('board.status.cardUsedThisTurn')
            : selectedCardAvailableThisTurn
                ? t('board.status.usePreview', {
                    effect: resolvePreviewUseEffectLabel(selectedInventoryCard, t),
                })
                : t('board.status.cardUnavailableThisTurn')
        : t('board.status.noSelectedCard');
    const hauntActionContext = React.useMemo(() => {
        if (core.phase !== 'haunt') {
            return null;
        }
        const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
        const isTraitor = core.scenarioRuntime.traitorPlayerId === core.currentExplorer.playerId;
        const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(core.currentExplorer.playerId);
        const canLearnAboutJack = !isTraitor
            && !isDead
            && core.activeRoomId === 'upper-west'
            && !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(core.currentExplorer.playerId)
            && !core.usedCardIdsThisTurn.includes('learn-about-jack');
        const canStudyExorcism = !isTraitor
            && !isDead
            && activeRoom?.discoveryReward === 'event'
            && !core.usedCardIdsThisTurn.includes('study-exorcism');
        const canExorciseJack = !isTraitor
            && !isDead
            && Boolean(core.scenarioRuntime.jackSpiritReleased)
            && core.activeRoomId === core.scenarioRuntime.jackSpiritRoomId
            && core.scenarioRuntime.exorcismCircleRoomIds.length >= 2
            && !core.usedCardIdsThisTurn.includes('exorcise-jack');
        const canAttackTraitor = !isTraitor
            && !isDead
            && core.otherExplorers.some((explorer) => (
                explorer.playerId === core.scenarioRuntime.traitorPlayerId
                && explorer.roomId === core.activeRoomId
            ));
        const heroAttackTargets = isTraitor
            ? core.otherExplorers.filter((explorer) => (
                !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                && explorer.roomId === core.activeRoomId
            ))
            : [];

        if (canExorciseJack) {
            return {
                actionKind: 'use' as const,
                label: t('board.status.focusExorciseJack'),
                cue: t('board.status.actionCueExorciseJack'),
            };
        }
        if (canLearnAboutJack) {
            return {
                actionKind: 'use' as const,
                label: t('board.status.focusLearnAboutJack'),
                cue: t('board.status.actionCueLearnAboutJack'),
            };
        }
        if (canStudyExorcism) {
            return {
                actionKind: 'use' as const,
                label: t('board.status.focusStudyExorcism'),
                cue: t('board.status.actionCueStudyExorcism'),
            };
        }
        if (canAttackTraitor) {
            return {
                actionKind: 'attack-traitor' as const,
                label: t('board.status.focusAttackTraitor'),
                cue: t('board.status.actionCueAttackTraitor'),
            };
        }
        if (heroAttackTargets.length > 0) {
            const heroTarget = heroAttackTargets.find((explorer) => explorer.playerId === selectedTradeTargetPlayerId) ?? heroAttackTargets[0]!;
            return {
                actionKind: 'attack-hero' as const,
                label: t('board.status.focusAttackHero', {
                    player: resolvePlayerName(heroTarget.playerId, heroTarget.displayName, matchData),
                }),
                cue: t('board.status.actionCueAttackHero', {
                    player: resolvePlayerName(heroTarget.playerId, heroTarget.displayName, matchData),
                }),
                targetPlayerId: heroTarget.playerId,
            };
        }
        return null;
    }, [core, matchData, selectedTradeTargetPlayerId, t]);
    const shouldShowLatestDiscovery = Boolean(
        core.latestDiscovery
        && core.latestDiscoveryOwnerPlayerId === core.currentExplorer.playerId,
    );
    const latestDiscoveryTitle = core.latestDiscovery?.title;
    const turnHintText = previewState.interactionMode === 'move'
        ? t('board.activity.chooseMoveTarget')
        : previewState.interactionMode === 'explore'
            ? t('board.activity.chooseExploreTarget')
        : moveTargetRooms.length > 0
            ? t('board.status.turnHintMove', {
                targets: formatRoomTargetList(moveTargetRooms),
            })
            : explorableRoomSlots.length > 0
                ? t('board.status.turnHintExplore', {
                    floor: resolveFloorLabel(explorableRoomSlots[0]!.floor),
                })
                : t('board.status.turnHintHold');
    const roomFocusState = (() => {
        if (previewState.interactionMode === 'move' && moveTargetRooms.length === 1) {
            return {
                label: t('board.status.focusMoveMode', { room: moveTargetRooms[0]!.name }),
                actionKind: 'move' as const,
                roomId: moveTargetRooms[0]!.id,
            };
        }
        if (hauntActionContext?.actionKind === 'use') {
            return {
                label: hauntActionContext.label,
                actionKind: 'use' as const,
                roomId: null,
            };
        }
        if (hauntActionContext?.actionKind === 'attack-traitor') {
            return {
                label: hauntActionContext.label,
                actionKind: 'attack-traitor' as const,
                roomId: null,
            };
        }
        if (hauntActionContext?.actionKind === 'attack-hero') {
            return {
                label: hauntActionContext.label,
                actionKind: 'attack-hero' as const,
                roomId: null,
                targetPlayerId: hauntActionContext.targetPlayerId ?? null,
            };
        }
        if (core.recommendedAction === 'move' && moveTargetRooms.length === 1) {
            return {
                label: t('board.status.focusMoveTarget', { room: moveTargetRooms[0]!.name }),
                actionKind: 'move' as const,
                roomId: moveTargetRooms[0]!.id,
            };
        }
        if (core.recommendedAction === 'use' && selectedInventoryCard && !selectedCardUseDisabled) {
            return {
                label: t('board.status.focusUseCard', { card: selectedInventoryCard.name }),
                actionKind: 'use' as const,
                roomId: null,
            };
        }
        return null;
    })();
    const tradeShortcutState = (() => {
        if (core.recommendedAction === 'trade') {
            return null;
        }
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
    })();
    const actionCueText = (() => {
        if (hauntActionContext?.cue) {
            return hauntActionContext.cue;
        }
        if (previewState.interactionMode === 'move') {
            if (moveTargetRooms.length === 1) {
                return t('board.status.actionCueMoveSingle', { room: moveTargetRooms[0]!.name });
            }
            return t('board.status.actionCueMoveMode');
        }
        if (previewState.interactionMode === 'explore') {
            return explorableRoomSlots.length > 0
                ? t('board.status.actionCueExploreSelect')
                : t('board.status.actionCueExplore', {
                    floor: t('board.rooms.unknown'),
                });
        }
        switch (core.recommendedAction) {
            case 'move':
                if (moveTargetRooms.length === 1) {
                    return t('board.status.actionCueMoveSingle', { room: moveTargetRooms[0]!.name });
                }
                return t('board.status.actionCueMoveMany');
            case 'explore':
                return explorableRoomSlots.length > 0
                    ? t('board.status.actionCueExplore', {
                        floor: resolveFloorLabel(explorableRoomSlots[0]!.floor),
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
    })();
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
        dispatchCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, {
            roomId,
            ...(skeletonKeyMoveTargetRoomIds.has(roomId) ? { useSkeletonKey: true } : {}),
        });
        setPreviewState((previousState) => ({
            ...previousState,
            interactionMode: 'default',
        }));
    }, [dispatchCommand, skeletonKeyMoveTargetRoomIds]);

    const handleMoveAction = React.useCallback(() => {
        setPreviewState((previousState) => {
            if (previousState.interactionMode === 'move') {
                return {
                    ...previousState,
                    interactionMode: 'default',
                };
            }
            if (core.movesRemaining <= 0 || moveTargetRooms.length === 0) {
                return previousState;
            }
            return {
                ...previousState,
                interactionMode: 'move',
            };
        });
    }, [core.movesRemaining, moveTargetRooms.length]);

    const handleExploreAction = React.useCallback(() => {
        setPreviewState((previousState) => {
            if (previousState.interactionMode === 'explore') {
                return {
                    ...previousState,
                    interactionMode: 'default',
                };
            }
            if (explorableRoomSlots.length === 0) {
                return previousState;
            }
            if (explorableRoomSlots.length === 1) {
                dispatchCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, {
                    roomId: explorableRoomSlots[0]!.id,
                    ...(useHolySymbolForExplore ? { useHolySymbol: true } : {}),
                    ...(useIdolForExplore ? { useIdol: true } : {}),
                });
                return {
                    ...previousState,
                    useHolySymbolForExplore: false,
                    useIdolForExplore: false,
                    interactionMode: 'default',
                };
            }
            return {
                ...previousState,
                interactionMode: 'explore',
            };
        });
    }, [dispatchCommand, explorableRoomSlots, useHolySymbolForExplore, useIdolForExplore]);

    const handleExploreRoom = React.useCallback((roomId: string) => {
        dispatchCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, {
            roomId,
            ...(useHolySymbolForExplore ? { useHolySymbol: true } : {}),
            ...(useIdolForExplore ? { useIdol: true } : {}),
        });
        setPreviewState((previousState) => ({
            ...previousState,
            useHolySymbolForExplore: false,
            useIdolForExplore: false,
            interactionMode: 'default',
        }));
    }, [dispatchCommand, useHolySymbolForExplore, useIdolForExplore]);

    const handleToggleHolySymbolExplore = React.useCallback(() => {
        if (!canDeclareHolySymbolExplore) {
            return;
        }
        setPreviewState((previousState) => ({
            ...previousState,
            useHolySymbolForExplore: !previousState.useHolySymbolForExplore,
        }));
    }, [canDeclareHolySymbolExplore]);

    const handleToggleIdolExplore = React.useCallback(() => {
        if (!canDeclareIdolExplore) {
            return;
        }
        setPreviewState((previousState) => ({
            ...previousState,
            useIdolForExplore: !previousState.useIdolForExplore,
        }));
    }, [canDeclareIdolExplore]);

    const handleSelectMaskTargetRoom = React.useCallback((tokenId: string, roomId: string) => {
        setPreviewState((previousState) => ({
            ...previousState,
            selectedMaskTargetRoomIdsByTokenId: {
                ...previousState.selectedMaskTargetRoomIdsByTokenId,
                [tokenId]: roomId,
            },
        }));
    }, []);

    const handleSelectInventoryTargetRoom = React.useCallback((roomId: string) => {
        setPreviewState((previousState) => ({
            ...previousState,
            selectedInventoryTargetRoomId: roomId,
        }));
    }, []);

    const handleSelectInventoryTargetPlayer = React.useCallback((playerId: string) => {
        setPreviewState((previousState) => ({
            ...previousState,
            selectedInventoryTargetPlayerId: playerId,
        }));
    }, []);

    const handleSelectAttackWeapon = React.useCallback((cardId: string | null) => {
        setPreviewState((previousState) => ({
            ...previousState,
            selectedAttackWeaponCardId: previousState.selectedAttackWeaponCardId === cardId ? null : cardId,
        }));
    }, []);

    const handleUseAction = () => {
        if (core.phase === 'haunt' && hauntActionContext?.actionKind === 'use') {
            if (core.activeRoomId === 'upper-west' && !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(core.currentExplorer.playerId)) {
                dispatchCommand(BETRAYAL_COMMANDS.LEARN_ABOUT_JACK, {});
            } else if (
                core.scenarioRuntime.jackSpiritReleased
                && core.activeRoomId === core.scenarioRuntime.jackSpiritRoomId
                && core.scenarioRuntime.exorcismCircleRoomIds.length >= 2
            ) {
                dispatchCommand(BETRAYAL_COMMANDS.EXORCISE_JACK, {});
            } else {
                dispatchCommand(BETRAYAL_COMMANDS.STUDY_EXORCISM, {});
            }
            setInventoryPreviewCardId(null);
            setPreviewState((previousState) => ({
                ...previousState,
                interactionMode: 'default',
            }));
            return;
        }
        const cardId = selectedInventoryCard?.id;
        if (cardId && selectedCardCanUseRabbitFoot) {
            setInventoryPreviewCardId(null);
            return;
        }
        const payload = cardId
            ? {
                cardId,
                ...(selectedInventoryTargetPlayerId ? { targetPlayerId: selectedInventoryTargetPlayerId } : {}),
                ...(selectedInventoryTargetRoomId ? { targetRoomId: selectedInventoryTargetRoomId } : {}),
                ...(selectedInventoryUseEffect?.mode === 'moveOthersInRoom'
                    ? { targetRoomIdsByTokenId: selectedMaskTargetRoomIdsByTokenId }
                    : {}),
            }
            : {};
        applyOptimisticPreviewAfterCommand(BETRAYAL_COMMANDS.USE_POSSESSION, payload, {
            keepSelectedInventoryCardId: cardId ?? null,
        });
        dispatchCommand(BETRAYAL_COMMANDS.USE_POSSESSION, payload);
        setInventoryPreviewCardId(null);
    };

    const handleTradeAction = () => {
        if (selectedCorpseLootTarget) {
            const cardId = selectedCorpseLootTarget.inventory[0]?.id;
            dispatchCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, {
                sourcePlayerId: selectedCorpseLootTarget.playerId,
                ...(cardId ? { cardId } : {}),
            });
            setInventoryPreviewCardId(null);
            setPreviewState((previousState) => ({
                ...previousState,
                interactionMode: 'default',
            }));
            return;
        }
        if (!tradeSelectionReady || !previewState.tradeSelectionTouched) {
            setPreviewState((previousState) => ({
                ...previousState,
                tradeSelectionTouched: true,
            }));
            return;
        }
        const cardId = selectedInventoryCard?.id;
        dispatchCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, {
            ...(useDogTrade ? { useDog: true, cardIds: selectedDogTradeCardIds } : cardId ? { cardId } : {}),
            ...(selectedTradeTargetPlayerId ? { targetPlayerId: selectedTradeTargetPlayerId } : {}),
        });
        setInventoryPreviewCardId(null);
        setPreviewState((previousState) => ({
            ...previousState,
            selectedDogTradeCardIds: [],
            tradeSelectionTouched: false,
            interactionMode: 'default',
        }));
    };

    const handleToggleDogTradeCard = React.useCallback((cardId: string) => {
        setPreviewState((previousState) => {
            const selected = new Set(previousState.selectedDogTradeCardIds);
            if (selected.has(cardId)) {
                selected.delete(cardId);
            } else {
                selected.add(cardId);
            }
            return {
                ...previousState,
                selectedDogTradeCardIds: Array.from(selected),
                tradeSelectionTouched: true,
            };
        });
    }, []);

    const handleAttackAction = React.useCallback((target: 'traitor' | 'hero' | 'jack-spirit', targetPlayerId?: string | null) => {
        dispatchCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, {
            target,
            ...(targetPlayerId ? { targetPlayerId } : {}),
            ...(selectedAttackWeaponCardId ? { weaponCardId: selectedAttackWeaponCardId } : {}),
        });
        setInventoryPreviewCardId(null);
        setPreviewState((previousState) => ({
            ...previousState,
            selectedAttackWeaponCardId: null,
            interactionMode: 'default',
        }));
    }, [dispatchCommand, selectedAttackWeaponCardId]);

    const handleEndTurnAction = React.useCallback(() => {
        dispatchCommand(BETRAYAL_COMMANDS.END_TURN, {});
        setInventoryPreviewCardId(null);
        setPreviewState((previousState) => ({
            ...previousState,
            selectedTradeTargetPlayerId: null,
            tradeSelectionTouched: false,
            interactionMode: 'default',
        }));
    }, [dispatchCommand]);

    const handleRoomEffectAction = React.useCallback(() => {
        dispatchCommand(BETRAYAL_COMMANDS.USE_ROOM_EFFECT, {});
        setInventoryPreviewCardId(null);
        setPreviewState((previousState) => ({
            ...previousState,
            selectedTradeTargetPlayerId: null,
            tradeSelectionTouched: false,
            interactionMode: 'default',
        }));
    }, [dispatchCommand]);

    const handleRoomFocusAction = () => {
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
        if (roomFocusState.actionKind === 'attack-traitor') {
            handleAttackAction('traitor');
            return;
        }
        if (roomFocusState.actionKind === 'attack-hero') {
            handleAttackAction('hero', roomFocusState.targetPlayerId ?? undefined);
            return;
        }
        if (roomFocusState.actionKind === 'use') {
            handleUseAction();
        }
    };

    const canUseRoomEffect = canUseMysticElevator(core);
    const actionItems: ActionBarAction[] = [
        {
            id: 'move',
            label: previewState.interactionMode === 'move' ? t('board.actions.cancelMove') : t('board.actions.move'),
            disabled: core.movesRemaining <= 0,
            variant: 'secondary',
        },
        {
            id: 'explore',
            label: t('board.actions.explore'),
            disabled: explorableRoomSlots.length === 0,
            variant: 'primary',
        },
        {
            id: 'trade',
            label: selectedCorpseLootTarget ? t('board.actions.loot') : t('board.actions.trade'),
            disabled: selectedCorpseLootTarget
                ? false
                : core.currentExplorerInventory.length === 0 || activeTradeTargets.length === 0,
            variant: 'secondary',
        },
        {
            id: 'use',
            label: hauntActionContext?.actionKind === 'use'
                ? (
                    core.activeRoomId === 'upper-west'
                        ? t('board.actions.learnAboutJack')
                        : core.scenarioRuntime.jackSpiritReleased
                            && core.activeRoomId === core.scenarioRuntime.jackSpiritRoomId
                            && core.scenarioRuntime.exorcismCircleRoomIds.length >= 2
                            ? t('board.actions.exorciseJack')
                            : t('board.actions.studyExorcism')
                )
                : t('board.actions.use'),
            disabled: hauntActionContext?.actionKind === 'use'
                ? false
                : core.currentExplorerInventory.length === 0 || selectedCardUseDisabled,
            variant: 'secondary',
        },
        {
            id: 'roomEffect',
            label: t('board.actions.roomEffectMysticElevator'),
            disabled: !canUseRoomEffect,
            variant: 'secondary',
        },
        { id: 'endTurn', label: t('board.actions.endTurn'), disabled: false, variant: 'ghost' },
    ];
    const visibleActionItems = actionItems.filter((action) => {
        if (action.id === 'trade' && core.recommendedAction === 'trade') {
            return false;
        }
        if (action.id === 'roomEffect') {
            return canUseRoomEffect;
        }
        return true;
    });

    const tutorialMapTargetRoomId = React.useMemo(() => {
        const target = tutorialStep?.highlightTarget;
        if (!isTutorialActive || !target) {
            return null;
        }
        if (target.startsWith('betrayal-room-move-target-')) {
            return target.replace('betrayal-room-move-target-', '');
        }
        return null;
    }, [isTutorialActive, tutorialStep?.highlightTarget]);

    const actionHandlerMap: Record<ActionBarAction['id'], () => void> = {
        move: handleMoveAction,
        explore: handleExploreAction,
        trade: handleTradeAction,
        use: handleUseAction,
        roomEffect: handleRoomEffectAction,
        endTurn: handleEndTurnAction,
    };
    const renderInventoryCard = (
        item: BetrayalInventoryCard,
        options: {
            layout: 'focus' | 'compact' | 'preview';
            testId?: string;
            compactDenseNoFront?: boolean;
        },
    ) => {
        const isSelected = item.id === selectedInventoryCard?.id;
        const isUsedThisTurn = core.usedCardIdsThisTurn.includes(item.id);
        const isAvailableThisTurn = core.turnStartInventoryCardIds.includes(item.id);
        const isUnavailableThisTurn = !isUsedThisTurn && !isAvailableThisTurn;
        const tone = INVENTORY_FACE_TONE[item.kind];
        const frontVisual = resolvePossessionAtlasVisual(item);
        const backAsset = INVENTORY_CARD_BACK_ASSET[item.kind];
        const accentAsset = resolveInventoryCardAccentAsset(item);
        const isFocus = options.layout === 'focus';
        const isPreview = options.layout === 'preview';
        const isCompact = options.layout === 'compact';
        const isTradeCompact = isCompact && core.recommendedAction === 'trade';
        const isDenseNoFrontCompact = isCompact && !frontVisual && Boolean(options.compactDenseNoFront);
        const isCompactDenseOmen = isDenseNoFrontCompact && item.kind === 'omen';
        const shellRadiusClass = isPreview ? 'rounded-[16px]' : isFocus ? 'rounded-[10px]' : 'rounded-[6px]';
        const cardWidthStyle = isPreview
            ? { width: '100%' }
            : isCompact
                ? { width: `${COMPACT_INVENTORY_CARD_WIDTH}px` }
                : undefined;
        const showSelectedState = !isPreview && isSelected;
        const titleClass = isPreview
            ? `min-h-[52px] text-[18px] font-semibold leading-[22px] ${frontVisual ? 'text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]' : 'text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]'}`
            : isFocus
                ? `min-h-[34px] text-[13px] font-semibold leading-[16px] ${frontVisual ? 'text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]' : 'text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]'}`
                : `min-h-[16px] text-[8px] font-semibold leading-[9px] ${frontVisual ? 'text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]' : 'text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]'}`;

        const compactStackStyle = isCompact
            ? {
                zIndex: showSelectedState ? 12 : 2,
            }
            : undefined;
        const tradeCompactSelectedClass = showSelectedState && core.recommendedAction === 'trade'
            ? 'drop-shadow-[0_0_10px_rgba(255,224,110,0.58)]'
            : '';
        const selectedTradeCardStyle = showSelectedState && core.recommendedAction === 'trade'
            ? {
                borderRadius: '8px',
                boxShadow: '0 0 0 2px rgba(255,224,110,0.96), 0 0 10px rgba(255,224,110,0.48)',
            }
            : {};

        return (
            <button
                key={`${options.layout}-${item.id}`}
                type="button"
                onClick={() => {
                    if (isPreview) {
                        return;
                    }
                    setPreviewState((previousState) => ({
                        ...previousState,
                        selectedInventoryCardId: item.id,
                        selectedInventoryTargetPlayerId: null,
                        selectedInventoryTargetRoomId: null,
                        selectedMaskTargetRoomIdsByTokenId: {},
                        tradeSelectionTouched: true,
                    }));
                    setInventoryPreviewCardId((previousCardId) => (
                        core.recommendedAction === 'trade'
                            ? null
                            : previousCardId === item.id && isSelected
                                ? null
                                : item.id
                    ));
                }}
                data-testid={options.testId}
                title={`${item.name} · ${resolvePreviewUseEffectLabel(item, t)} · 点击放大`}
                className={`relative overflow-visible text-left transition ${
                    showSelectedState
                            ? core.recommendedAction === 'trade'
                                ? 'z-30 -translate-y-0.5 rounded-[8px]'
                            : 'z-30 -translate-y-1 scale-[1.035] outline outline-[5px] outline-offset-[4px] outline-[#ffe06e] drop-shadow-[0_12px_24px_rgba(255,224,110,0.34)]'
                        : isPreview
                            ? 'z-10'
                            : 'z-10 hover:-translate-y-0.5'
                } ${tradeCompactSelectedClass} ${isCompact ? 'shrink-0' : 'w-full'}`}
                aria-pressed={isPreview ? undefined : isSelected}
                style={{
                    ...cardWidthStyle,
                    ...compactStackStyle,
                    ...selectedTradeCardStyle,
                }}
            >
                {isUsedThisTurn || isUnavailableThisTurn ? (
                    <div className={`absolute right-2 top-2 z-10 rounded-full border border-[#7c5941] bg-[rgba(58,31,24,0.92)] ${isFocus ? 'px-2 py-1 text-[10px]' : 'px-1.5 py-0.5 text-[9px]'} font-medium text-[#f0c1a2]`}>
                        {t(isUsedThisTurn ? 'board.status.cardUsedTag' : 'board.status.cardUnavailableTag')}
                    </div>
                ) : null}
                {showSelectedState && core.recommendedAction !== 'trade' ? (
                    <div
                        data-testid={options.testId ? `${options.testId}-selected-halo` : undefined}
                        className="pointer-events-none absolute inset-[-10px] z-50 rounded-[12px] opacity-100"
                        style={{
                            borderColor: '#ffe06e',
                            borderStyle: 'solid',
                            borderWidth: 4,
                            boxShadow: '0 0 0 3px rgba(255,255,221,0.86), 0 0 18px rgba(255,224,110,0.44)',
                        }}
                        />
                    ) : null}
                <div
                    data-testid={options.testId ? `${options.testId}-shell` : undefined}
                    className={`relative flex w-full flex-col overflow-hidden ${shellRadiusClass} border ${
                        showSelectedState
                                ? core.recommendedAction === 'trade'
                                    ? 'border-[#ffe06e] bg-transparent shadow-[inset_0_0_0_4px_rgba(255,224,110,1),inset_0_0_0_6px_rgba(255,255,221,0.96)]'
                                : 'border-[#fff6bf] bg-[rgba(255,224,110,0.10)] shadow-[0_0_0_3px_rgba(255,255,221,0.98),0_0_0_8px_rgba(255,224,110,0.92),0_0_22px_rgba(255,224,110,0.48)]'
                            : frontVisual
                                ? isCompact
                                    ? 'border-[rgba(120,105,76,0.18)] bg-[rgba(10,8,6,0.18)]'
                                    : 'border-[rgba(60,47,32,0.82)] bg-[rgba(10,8,6,0.96)]'
                                : isCompact
                                    ? 'border-[rgba(98,92,71,0.18)] bg-[rgba(13,15,11,0.18)]'
                                    : tone.cardSurfaceClass
                    } ${isUsedThisTurn || isUnavailableThisTurn ? 'opacity-60' : ''}`}
                    style={{ aspectRatio: BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO }}
                >
                    {showSelectedState ? (
                        <>
                            <div
                                data-testid={options.testId ? `${options.testId}-selected-ring` : undefined}
                                className={`pointer-events-none absolute inset-[1px] z-50 rounded-[inherit] ring-inset ring-[#ffe06e] ${
                                  core.recommendedAction === 'trade' ? 'ring-[4px]' : 'ring-[5px]'
                                  }`}
                              />
                            <div className="pointer-events-none absolute inset-[5px] z-50 rounded-[4px] ring-[1px] ring-inset ring-[rgba(255,255,221,0.94)]" />
                            {core.recommendedAction === 'trade' ? (
                                <div className="pointer-events-none absolute inset-[9px] z-50 rounded-[3px] ring-[1px] ring-inset ring-[#ffe06e]" />
                            ) : null}
                            <div
                                data-testid={options.testId ? `${options.testId}-selected-label` : undefined}
                                className="pointer-events-none absolute right-1 top-1 z-50 rounded-[4px] bg-[#ffe06e] px-1.5 py-0.5 text-[9px] font-black tracking-[0.08em] text-[#261c05] shadow-[0_0_0_1px_rgba(255,255,221,0.9)]"
                            >
                                {t('board.status.selected')}
                            </div>
                        </>
                    ) : null}
                    {frontVisual ? (
                        <>
                            <div className={`absolute overflow-hidden ${
                                isCompact
                                    ? 'inset-[3px] rounded-[5px] bg-transparent'
                                    : 'inset-0 bg-[rgba(10,8,6,0.96)]'
                            }`}>
                                <PossessionAtlasFrame
                                    visual={frontVisual}
                                    locale={effectiveLocale}
                                    alt={item.name}
                                    testId={options.testId ? `${options.testId}-front-atlas` : undefined}
                                />
                                {isTradeCompact ? null : (
                                    <div className={`pointer-events-none absolute inset-0 ${
                                        isCompact
                                            ? 'bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.02)_50%,rgba(7,6,5,0.1)_78%,rgba(7,6,5,0.54))]'
                                            : 'bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.02)_30%,rgba(0,0,0,0.08)_66%,rgba(7,6,5,0.72))]'
                                    }`} />
                                )}
                            </div>
                            <div className={`pointer-events-none absolute inset-0 ring-1 ring-inset ${
                                isCompact ? 'ring-[rgba(227,206,170,0.04)]' : 'ring-[rgba(227,206,170,0.14)]'
                            }`} />
                        </>
                    ) : (
                        <>
                            <div className={`absolute overflow-hidden ${
                                isCompact
                                    ? 'inset-[3px] rounded-[5px]'
                                    : 'inset-0'
                            }`}>
                                {isCompact ? (
                                    <>
                                        <OptimizedImage
                                            src={backAsset}
                                            locale={effectiveLocale}
                                            alt=""
                                            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16]"
                                            draggable={false}
                                        />
                                        <div className={`pointer-events-none absolute inset-0 ${
                                            item.kind === 'item'
                                                ? 'bg-[radial-gradient(circle_at_50%_24%,rgba(230,186,159,0.12),transparent_34%),linear-gradient(180deg,rgba(42,22,18,0.94),rgba(17,11,10,0.98))]'
                                                : 'bg-[radial-gradient(circle_at_50%_24%,rgba(194,232,178,0.1),transparent_34%),linear-gradient(180deg,rgba(24,40,25,0.94),rgba(12,20,13,0.98))]'
                                        }`} />
                                        <div className="pointer-events-none absolute inset-x-0 top-[10%] flex justify-center">
                                            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold tracking-[0.08em] ${
                                                item.kind === 'item'
                                                    ? 'border-[rgba(215,162,134,0.24)] bg-[rgba(43,24,20,0.78)] text-[#f0ccb9]'
                                                    : 'border-[rgba(173,212,161,0.2)] bg-[rgba(20,34,22,0.82)] text-[#d6ebd1]'
                                            }`}>
                                                {t('board.status.frontMissing')}
                                            </span>
                                        </div>
                                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0.01)_40%,rgba(7,7,6,0.16)_58%,rgba(7,7,6,0.78))]" />
                                    </>
                                ) : (
                                    <>
                                        <div className="pointer-events-none absolute inset-0 bg-[rgba(11,12,10,0.96)]" />
                                        <OptimizedImage
                                            src={backAsset}
                                            locale={effectiveLocale}
                                            alt=""
                                            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18]"
                                            draggable={false}
                                        />
                                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(239,226,188,0.1),transparent_34%),linear-gradient(180deg,rgba(14,15,11,0.5),rgba(8,10,7,0.82)_54%,rgba(7,6,5,0.94))]" />
                                    </>
                                )}
                            </div>
                            <div
                                className={`pointer-events-none absolute border ${tone.frameClass} ${
                                    isCompact
                                        ? 'inset-[3px] rounded-[5px] opacity-36'
                                        : 'inset-[8px] rounded-[8px] opacity-90'
                                }`}
                            />
                            {isPreview || isFocus ? (
                                <div className={`pointer-events-none absolute inset-x-[14px] top-1/2 -translate-y-1/2 text-center font-semibold ${isPreview ? 'text-[24px] leading-[28px]' : 'text-[18px] leading-[22px]'} ${tone.nameClass} drop-shadow-[0_2px_4px_rgba(0,0,0,0.72)]`}>
                                    {item.name}
                                </div>
                            ) : null}
                            {isCompact ? (
                                null
                            ) : (
                                <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full border ${tone.badgeClass} ${isPreview ? 'bottom-16 px-3 py-1 text-[10px]' : isFocus ? 'bottom-11 px-2 py-0.5 text-[9px]' : 'bottom-8 px-1.5 py-0.5 text-[8px]'} uppercase tracking-[0.12em]`}>
                                    {t('board.status.frontMissing')}
                                </div>
                            )}
                        </>
                    )}
                    {isCompact ? (
                        <>
                            <div className="relative flex-1" />
                            <div className={`relative mt-auto ${isTradeCompact && frontVisual ? 'px-1 pb-1' : isCompactDenseOmen ? 'px-1 pb-1' : 'px-2 pb-2'} ${
                                frontVisual
                                    ? 'pt-2'
                                    : isCompactDenseOmen
                                        ? 'pt-0.5'
                                        : isDenseNoFrontCompact
                                            ? 'pt-1.5'
                                            : 'pt-2.5'
                            } ${
                                frontVisual
                                    ? isTradeCompact
                                        ? 'bg-transparent'
                                        : 'bg-[linear-gradient(180deg,rgba(8,7,6,0),rgba(8,7,6,0.08)_56%,rgba(8,7,6,0.7))]'
                                    : 'bg-[linear-gradient(180deg,rgba(8,7,6,0),rgba(8,7,6,0.18)_46%,rgba(8,7,6,0.82))]'
                            }`}>
                                <div className="min-w-0">
                                    <div className={`${
                                        isTradeCompact && frontVisual
                                            ? 'sr-only'
                                            : isCompactDenseOmen
                                            ? 'min-h-[26px] rounded-[4px] border border-[rgba(177,201,161,0.14)] bg-[rgba(234,226,206,0.92)] px-1 py-[3px] text-[8px] leading-[9px] line-clamp-2 text-[#2f291e] drop-shadow-none'
                                            : isDenseNoFrontCompact
                                                ? 'min-h-[18px] truncate whitespace-nowrap text-[9px] leading-[10px]'
                                                : 'min-h-[26px] text-[11px] leading-[12px]'
                                    } font-semibold ${isCompactDenseOmen ? '' : 'text-[#ede2c8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.62)]'}`}>
                                        {item.name}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={`relative flex items-center justify-between ${isPreview ? 'px-4 pt-4' : 'px-3 pt-3'}`}>
                                <span className={`inline-flex rounded-full border ${isPreview ? 'px-2.5 py-1 text-[10px]' : isFocus ? 'px-2.5 py-1 text-[10px]' : 'px-2 py-0.5 text-[9px]'} uppercase tracking-[0.12em] ${tone.badgeClass}`}>
                                    {item.kind === 'item' ? t('board.inventory.item') : t('board.inventory.omen')}
                                </span>
                                <span className={`inline-flex ${isPreview ? 'h-8 w-8' : isFocus ? 'h-7 w-7' : 'h-6 w-6'} items-center justify-center rounded-full border ${
                                    frontVisual
                                        ? 'border-[rgba(227,206,170,0.28)] bg-[rgba(14,12,10,0.78)]'
                                        : tone.frameClass
                                }`}>
                                    <OptimizedImage
                                        src={accentAsset}
                                        locale={effectiveLocale}
                                        alt=""
                                        className={isPreview ? 'h-5 w-5 object-contain opacity-90' : isFocus ? 'h-[18px] w-[18px] object-contain opacity-90' : 'h-4 w-4 object-contain opacity-90'}
                                        draggable={false}
                                    />
                                </span>
                            </div>
                            <div className={`relative flex flex-1 items-end justify-start ${isPreview ? 'px-6 py-5' : isFocus ? 'px-4 py-4' : 'px-4 py-3'}`} />
                            <div className={`${isPreview ? 'px-4 pb-4 pt-2' : isFocus ? 'px-4 pb-4 pt-2.5' : 'px-3 pb-3 pt-1.5'} relative`}>
                                <div className={titleClass}>
                                    {item.name}
                                </div>
                                {frontVisual ? null : (
                                    <>
                                        <div className={`${isPreview ? 'mt-2 text-[11px]' : isFocus ? 'mt-2 text-[11px]' : 'mt-1.5 text-[10px]'} uppercase tracking-[0.1em] ${tone.accentClass}`}>
                                            {item.kind === 'item' ? t('board.inventory.item') : t('board.inventory.omen')}
                                        </div>
                                        {isFocus ? (
                                            <div className="mt-2 inline-flex rounded-full border border-[rgba(111,140,102,0.26)] bg-[rgba(20,30,21,0.72)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#d4e5cf]">
                                                {t('board.status.frontMissing')}
                                            </div>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </button>
        );
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
                <header className="relative overflow-hidden border border-[rgba(114,91,52,0.56)] bg-[linear-gradient(180deg,rgba(10,16,14,0.985),rgba(8,13,11,0.95))] shadow-[0_18px_34px_rgba(0,0,0,0.28)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.32),transparent)]" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                    <div
                        className="grid min-h-[108px] grid-cols-[minmax(260px,1fr)_minmax(250px,1.12fr)_minmax(312px,1fr)] items-stretch divide-x divide-[rgba(77,64,44,0.92)]"
                        data-testid="betrayal-runtime-header-grid"
                    >
                        <div className="relative flex items-center px-4">
                            <div className="pointer-events-none absolute inset-y-2 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.36),transparent)]" />
                            <div className="pointer-events-none absolute inset-y-2 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.16),transparent)]" />
                            <OptimizedImage
                                src={ASSETS.titleBanner}
                                locale={effectiveLocale}
                                alt={t('title')}
                                className="h-16 w-full max-w-[340px] object-contain object-left"
                                draggable={false}
                            />
                        </div>
                        <div className="relative flex flex-col items-center justify-center px-6 py-4 text-center">
                            <div className="pointer-events-none absolute inset-y-3 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),transparent)]" />
                            <div className="pointer-events-none absolute inset-y-3 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),transparent)]" />
                            <span className="text-[11px] uppercase tracking-[0.28em] text-[#b99b5f]">{t('board.hud.phaseLabel')}</span>
                            <span className="mt-1 text-[28px] font-semibold uppercase tracking-[0.2em] text-[#f0d29a]">
                                {phaseLabel}
                            </span>
                        </div>
                        <div className="relative flex items-center justify-end gap-4 px-5" data-testid="betrayal-status-chip">
                            <div className="pointer-events-none absolute inset-y-3 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),transparent)]" />
                            <div className="pointer-events-none absolute inset-y-3 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),transparent)]" />
                            <div className="text-right">
                                <div className="text-[11px] uppercase tracking-[0.24em] text-[#b99b5f]">{t('board.hud.turnLabel')}</div>
                                <div className="mt-1 text-[21px] font-semibold uppercase tracking-[0.14em] text-[#f0d29a]">
                                    {resolvePlayerName(core.currentPlayer, core.currentExplorer.displayName, matchData)}
                                </div>
                            </div>
                            <div
                                className="grid h-[72px] w-[72px] place-items-center rounded-full border border-[#756244] bg-[radial-gradient(circle_at_35%_30%,rgba(190,233,97,0.22),rgba(20,28,18,0.94)_72%)] text-center shadow-[0_0_18px_rgba(130,177,76,0.18)]"
                                data-tutorial-id="betrayal-moves-remaining"
                            >
                                <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b5ef42]">{t('board.hud.moveLabel')}</div>
                                    <div className="text-[28px] font-bold text-[#c8f05e]">{core.movesRemaining}</div>
                                    <span className="sr-only">
                                        {t('board.status.movesRemaining', { count: core.movesRemaining })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="relative grid min-h-0 flex-1 gap-3 overflow-y-auto pb-[12rem] xl:grid-cols-[286px_minmax(0,1fr)_216px] xl:overflow-hidden xl:pb-0">
                    <section className="relative z-10 order-2 grid min-h-0 content-start gap-2 xl:order-1 xl:overflow-visible">
                        <article className="relative overflow-visible bg-transparent px-1 py-1 xl:min-h-[860px]">
                            <div className="mx-auto flex w-full max-w-[252px] flex-col gap-1 pb-1 pt-1 xl:mx-0">
                                <div className="relative mx-auto w-full max-w-[188px]">
                                    <div className="pointer-events-none absolute inset-[12%] rounded-full bg-[rgba(77,138,92,0.18)] blur-3xl" />
                                    <OptimizedImage
                                        src={core.currentExplorer.portraitAsset}
                                        locale={effectiveLocale}
                                        alt={core.currentExplorer.displayName}
                                        className="relative z-10 aspect-[1/1.05] h-auto w-full object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.38)]"
                                        draggable={false}
                                    />
                                    {(Object.entries(core.currentExplorer.traits) as [BetrayalTraitKey, number][]).map(([key, value]) => {
                                        const markerPosition = resolveExplorerBoardMarkerPosition(key, value);
                                        return (
                                            <div
                                                key={`explorer-board-marker-${key}`}
                                                className="pointer-events-none absolute z-20 h-7 w-7 -translate-x-1/2 -translate-y-1/2"
                                                style={markerPosition}
                                            >
                                                <OptimizedImage
                                                    src={resolveNumberMarkerAsset(value)}
                                                    locale={effectiveLocale}
                                                    alt={`${TRAIT_LABEL_LOCAL[key]} ${value}`}
                                                    className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.38)]"
                                                    draggable={false}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="-mt-4 flex justify-center px-2">
                                    <div className="relative inline-flex min-w-[174px] max-w-[194px] items-center justify-between gap-2 overflow-hidden rounded-[7px] border border-[rgba(103,82,48,0.62)] bg-[linear-gradient(180deg,rgba(14,18,16,0.9),rgba(9,12,10,0.96))] px-2.5 py-1.5 shadow-[0_8px_16px_rgba(0,0,0,0.14)]">
                                        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                                        <div className="min-w-0">
                                            <div className="text-[8px] uppercase tracking-[0.18em] text-[#95876d]">
                                                {t('board.hud.locationLabel')}
                                            </div>
                                            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[#efe2c4]">
                                                {core.rooms.find((room) => room.id === core.currentExplorer.roomId)?.name || t('board.rooms.unknown')}
                                            </div>
                                        </div>
                                        <div className="shrink-0 self-center rounded-full border border-[rgba(105,83,47,0.58)] bg-[radial-gradient(circle_at_35%_25%,rgba(227,211,168,0.12),rgba(18,15,12,0.95))] px-2 py-0.5 text-center shadow-[0_4px_10px_rgba(0,0,0,0.14)]">
                                            <div className="text-[7px] uppercase tracking-[0.16em] text-[#98886a]">{t('board.hud.holdingLabel')}</div>
                                            <div className="text-[15px] font-semibold leading-none text-[#f0e2c0]">{core.currentExplorerInventory.length}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-1.5">
                                    <div
                                        className="relative overflow-hidden rounded-[10px] border border-[rgba(93,79,54,0.42)] bg-[rgba(13,17,15,0.52)] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.04)]"
                                        data-testid="betrayal-current-traits"
                                        data-tutorial-id="betrayal-current-traits"
                                    >
                                        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                                        <div className="mb-1 flex items-center justify-between border-b border-[rgba(96,80,54,0.42)] pb-1">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8bf81]">{t('board.hud.currentTraitsLabel')}</span>
                                            <span className="rounded-full border border-[rgba(181,239,66,0.28)] bg-[rgba(40,58,21,0.52)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-[#d9ff97]">
                                                {resolvePlayerName(core.currentExplorer.playerId, core.currentExplorer.displayName, matchData)}
                                            </span>
                                        </div>
                                        <div className="grid gap-0.5">
                                            {(['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]).map((trait) => (
                                                <div key={trait} className="grid grid-cols-[66px_minmax(0,1fr)_24px] items-center gap-1.5 text-[12px]">
                                                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#d8bf81]">
                                                        <OptimizedImage src={ASSETS.trait[trait]} locale={effectiveLocale} alt="" className="h-4 w-4 object-contain opacity-86" draggable={false} />
                                                        <span className="truncate">{TRAIT_LABEL_LOCAL[trait]}</span>
                                                    </span>
                                                    <div className="grid grid-cols-6 gap-1">
                                                        {Array.from({ length: 6 }).map((_, index) => {
                                                            const isFilled = index < core.currentExplorer.traits[trait];
                                                            const isDangerSlot = index === 0;
                                                            return (
                                                                <span
                                                                    key={`${trait}-${index}`}
                                                                    title={isDangerSlot ? t('board.hud.dangerZone') : undefined}
                                                                    className={`h-2.5 rounded-full border ${
                                                                        isDangerSlot
                                                                            ? isFilled
                                                                                ? 'border-[#bd5545] bg-[linear-gradient(180deg,#e07159,#9e3b32)] shadow-[0_0_6px_rgba(213,78,57,0.28)]'
                                                                                : 'border-[#73362f] bg-[rgba(91,31,28,0.5)]'
                                                                            : isFilled
                                                                                ? 'border-[#d4b46d] bg-[linear-gradient(180deg,#ddc171,#cda95d)]'
                                                                                : 'border-[#62543c] bg-[rgba(17,25,22,0.76)]'
                                                                    }`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    <span className={`text-right text-[14px] font-semibold ${TRAIT_VALUE_TEXT_CLASS[trait]}`}>
                                                        {core.currentExplorer.traits[trait]}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </article>

                        <article className="hidden px-2 py-1 md:px-1 xl:hidden">
                            <div className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-[#a89d84]">
                                {t('board.sections.players')}
                            </div>
                            <div className="grid gap-1.5">
                                {core.otherExplorers.map((explorer) => {
                                    const isTradeCandidate = activeTradeTargets.some((item) => item.playerId === explorer.playerId);
                                    const isSelectedTradeTarget = explorer.playerId === selectedTradeTargetPlayerId;
                                    const isSameRoom = core.currentExplorer.roomId === explorer.roomId;
                                    const isDogTradeTarget = dogTradeTargets.some((item) => item.playerId === explorer.playerId);
                                    const panel = (
                                        <div
                                            key={explorer.playerId}
                                            className={`grid grid-cols-[50px_minmax(0,1fr)_52px] items-center gap-2 rounded-[8px] px-1.5 py-2 transition ${
                                                isSelectedTradeTarget
                                                    ? 'bg-transparent outline outline-[4px] outline-offset-[3px] outline-[#9fe1a7] shadow-[0_0_0_5px_rgba(255,255,221,0.30)]'
                                                    : isTradeCandidate
                                                        ? 'bg-transparent hover:bg-[rgba(255,224,138,0.06)]'
                                                        : 'bg-transparent'
                                            }`}
                                        >
                                            <div className="h-12 w-12 overflow-hidden">
                                                <OptimizedImage
                                                    src={explorer.portraitAsset}
                                                    locale={effectiveLocale}
                                                    alt={explorer.displayName}
                                                    className="h-full w-full object-contain"
                                                    draggable={false}
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="truncate text-sm font-medium text-[#f1e8d4]">
                                                        {resolvePlayerName(explorer.playerId, explorer.displayName, matchData)}
                                                    </div>
                                                    {isTradeCandidate ? (
                                                        <span
                                                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                                isSelectedTradeTarget
                                                                    ? 'bg-transparent text-[#ffe4a0]'
                                                                    : 'bg-transparent text-[#bddac2]'
                                                            }`}
                                                        >
                                                            {isDogTradeTarget && !isSameRoom ? '狗' : isSameRoom ? t('board.players.sameRoom') : t('board.players.tradeTarget')}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="text-xs text-[#b7aa92]">
                                                    {core.rooms.find((room) => room.id === explorer.roomId)?.name || t('board.rooms.unknown')}
                                                </div>
                                                <div className="text-[11px] text-[#8db29a]">
                                                    {t('board.players.inventoryCount', { count: explorer.inventory.length })}
                                                </div>
                                            </div>
                                            <div className="grid gap-0.5 text-[10px] text-[#c8bda4]">
                                                {(['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]).map((key) => (
                                                    <div key={key} className="flex items-center justify-between gap-2">
                                                        <span>{t(`board.traits.${key}`)}</span>
                                                        <span className="font-semibold text-[#f3ead6]">{explorer.traits[key]}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
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
                                                tradeSelectionTouched: true,
                                            }))}
                                            data-testid={`betrayal-trade-target-${explorer.playerId}`}
                                            className="w-full cursor-pointer text-left"
                                        >
                                            {panel}
                                        </button>
                                    );
                                })}
                            </div>
                        </article>
                    </section>
                    <div
                        id="betrayal-inventory-section"
                        data-testid="betrayal-inventory-section"
                        data-tutorial-id="betrayal-inventory-zone"
                        className="order-4 mt-1 px-0.5 xl:absolute xl:bottom-0 xl:left-1 xl:z-20 xl:mt-0 xl:w-[calc(62px*5.35+0.5rem*4+0.75rem)] xl:max-w-[calc(62px*5.35+0.5rem*4+0.75rem)] xl:px-0"
                    >
                        <div className="mb-1 flex items-center justify-between gap-3 px-1 xl:pr-4">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#a89d84]">
                                <span className="h-px w-3 bg-[rgba(214,191,129,0.22)]" />
                                {t('board.sections.inventory')}
                                <span className="h-px w-8 bg-[rgba(214,191,129,0.12)]" />
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
                        <div className="grid gap-2 px-1 xl:px-0 xl:pr-2">
                            <section data-testid="betrayal-inventory-group-item">
                                <div
                                    className="flex max-w-[calc(62px*4.35+0.375rem*3)] min-h-[92px] min-w-0 items-end gap-1.5 overflow-x-auto overflow-y-hidden pb-2 pr-1 smashup-h-scrollbar xl:max-w-[calc(62px*5.35+0.5rem*4)] xl:gap-2"
                                    data-testid="betrayal-inventory-row-item"
                                >
                                    {inventoryGroups.item.map((item) => renderInventoryCard(item, {
                                        layout: 'compact',
                                        testId: `betrayal-inventory-${item.id}`,
                                    }))}
                                </div>
                            </section>
                            <section data-testid="betrayal-inventory-group-omen">
                                <div
                                    className="flex max-w-[calc(62px*4.35+0.375rem*3)] min-h-[92px] min-w-0 items-end gap-1.5 overflow-x-auto overflow-y-hidden pb-2 pr-1 smashup-h-scrollbar xl:max-w-[calc(62px*5.35+0.5rem*4)] xl:gap-2"
                                    data-testid="betrayal-inventory-row-omen"
                                >
                                    {inventoryGroups.omen.map((item) => renderInventoryCard(item, {
                                        layout: 'compact',
                                        testId: `betrayal-inventory-${item.id}`,
                                        compactDenseNoFront: true,
                                    }))}
                                </div>
                            </section>
                        </div>
                        {selectedInventoryCard ? (
                            <div className="sr-only" data-testid="betrayal-selected-inventory-card-name">
                                {selectedInventoryCard.name}
                            </div>
                        ) : null}
                    </div>

                    <section className="relative z-0 order-1 grid content-start gap-3 xl:order-2 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_auto]">
                        <div className="sr-only">
                            <span data-testid="betrayal-action-cue">{actionCueText}</span>
                            <span data-testid="betrayal-trade-status">{tradeStatusText}</span>
                            <span data-testid="betrayal-turn-hint">{turnHintText}</span>
                        </div>

                        <article
                            id="betrayal-room-panel"
                            data-testid="betrayal-room-panel"
                            data-tutorial-id="betrayal-room-board"
                            className="order-1 flex min-h-[500px] flex-col bg-transparent p-0 md:min-h-[580px] xl:min-h-0"
                        >
                            <div className="sr-only">
                                <span data-testid="betrayal-room-latest-feedback">
                                    {latestLogEntry?.text || t('board.feedback.idle')}
                                </span>
                                {shouldShowLatestDiscovery ? (
                                    <span
                                        data-testid="betrayal-discovery-panel"
                                        data-tutorial-id="betrayal-latest-discovery"
                                    >
                                        {t('board.discovery.label')}
                                        {' '}
                                        {core.latestDiscovery!.title}
                                        {' '}
                                        {core.latestDiscovery!.summary}
                                        {' '}
                                        <span data-testid="betrayal-discovery-detail">
                                            {core.latestDiscovery!.detail}
                                        </span>
                                    </span>
                                ) : null}
                                {roomFocusState ? (
                                    <button
                                        type="button"
                                        onClick={handleRoomFocusAction}
                                    >
                                        {roomFocusState.label}
                                    </button>
                                ) : null}
                                {tradeShortcutState ? (
                                    <button
                                        type="button"
                                        onClick={handleTradeAction}
                                    >
                                        {tradeShortcutState.label}
                                    </button>
                                ) : null}
                            </div>

                            {(roomFocusState || (tradeShortcutState && core.recommendedAction !== 'trade') || selectedCardCanUseRabbitFoot || useDogTrade || (canUseDogTrade && dogTradeTargets.length > 0) || (hauntActionContext?.actionKind?.startsWith('attack-') && attackWeaponCards.length > 0) || (selectedInventoryUseEffect?.mode === 'healTraits' && healTargetExplorers.length > 1) || ((canDeclareHolySymbolExplore || canDeclareIdolExplore) && explorableRoomSlots.length > 0) || (selectedInventoryUseEffect?.mode === 'placeExplorer' && inventoryTargetRooms.length > 0) || (selectedCardNeedsTargetRoom && maskTargetTokens.length > 0 && maskTargetRooms.length > 0)) ? (
                                <div className="relative z-30 mb-2 flex flex-wrap items-center gap-1.5 px-2 pb-1 pt-1">
                                    {roomFocusState ? (
                                        <button
                                            type="button"
                                            onClick={handleRoomFocusAction}
                                            data-testid="betrayal-room-focus-target"
                                            className="rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold text-[#eef4a8] underline decoration-[#c9a35e] decoration-2 underline-offset-4 shadow-none transition hover:text-[#f6ffc4]"
                                        >
                                            {roomFocusState.label}
                                        </button>
                                    ) : null}
                                    {tradeShortcutState && core.recommendedAction !== 'trade' ? (
                                        <button
                                            type="button"
                                            onClick={handleTradeAction}
                                            data-testid="betrayal-room-trade-shortcut"
                                            className="rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold text-[#d4ead0] underline decoration-[#9fe1a7] decoration-2 underline-offset-4 shadow-none transition hover:text-[#e8f7e4]"
                                        >
                                            {tradeShortcutState.label}
                                        </button>
                                    ) : null}
                                    {canUseDogTrade && dogTradeTargets.length > 0 ? (
                                        <div
                                            data-testid="betrayal-dog-trade-selector"
                                            className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                                        >
                                            <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">狗</span>
                                            {core.currentExplorerInventory
                                                .filter((card) => card.id !== 'dog' && !core.usedCardIdsThisTurn.includes(card.id))
                                                .map((card) => {
                                                    const isDogCardSelected = selectedDogTradeCardIds.includes(card.id);
                                                    return (
                                                        <button
                                                            key={card.id}
                                                            type="button"
                                                            onClick={() => handleToggleDogTradeCard(card.id)}
                                                            data-testid={`betrayal-dog-trade-card-${card.id}`}
                                                            className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                                                                isDogCardSelected
                                                                    ? 'text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4'
                                                                    : 'text-[#d6c498] hover:text-[#f0dfad]'
                                                            }`}
                                                        >
                                                            {card.name}
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    ) : null}
                                    {selectedInventoryUseEffect?.mode === 'placeExplorer' && inventoryTargetRooms.length > 0 ? (
                                        <div
                                            data-testid="betrayal-inventory-target-room-selector"
                                            className="inline-flex max-w-[min(720px,calc(100vw-2rem))] flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                                        >
                                            <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">地图</span>
                                            {inventoryTargetRooms.map((room) => {
                                                const isSelectedRoom = selectedInventoryTargetRoomId === room.id;
                                                return (
                                                    <button
                                                        key={room.id}
                                                        type="button"
                                                        onClick={() => handleSelectInventoryTargetRoom(room.id)}
                                                        data-testid={`betrayal-inventory-target-room-${room.id}`}
                                                        className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                                                            isSelectedRoom
                                                                ? 'text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4'
                                                                : 'text-[#d6c498] hover:text-[#f0dfad]'
                                                        }`}
                                                    >
                                                        {room.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                    {selectedInventoryUseEffect?.mode === 'healTraits' && healTargetExplorers.length > 1 ? (
                                        <div
                                            data-testid="betrayal-inventory-target-player-selector"
                                            className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                                        >
                                            <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">治疗</span>
                                            {healTargetExplorers.map((explorer) => {
                                                const isSelectedPlayer = selectedInventoryTargetPlayerId === explorer.playerId;
                                                return (
                                                    <button
                                                        key={explorer.playerId}
                                                        type="button"
                                                        onClick={() => handleSelectInventoryTargetPlayer(explorer.playerId)}
                                                        data-testid={`betrayal-inventory-target-player-${explorer.playerId}`}
                                                        className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                                                            isSelectedPlayer
                                                                ? 'text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4'
                                                                : 'text-[#d6c498] hover:text-[#f0dfad]'
                                                        }`}
                                                    >
                                                        {resolvePlayerName(explorer.playerId, explorer.displayName, matchData)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                    {hauntActionContext?.actionKind?.startsWith('attack-') && attackWeaponCards.length > 0 ? (
                                        <div
                                            data-testid="betrayal-attack-weapon-selector"
                                            className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                                        >
                                            <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">武器</span>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectAttackWeapon(null)}
                                                data-testid="betrayal-attack-weapon-none"
                                                className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                                                    selectedAttackWeaponCardId === null
                                                        ? 'text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4'
                                                        : 'text-[#d6c498] hover:text-[#f0dfad]'
                                                }`}
                                            >
                                                徒手
                                            </button>
                                            {attackWeaponCards.map((card) => {
                                                const isSelectedWeapon = selectedAttackWeaponCardId === card.id;
                                                return (
                                                    <button
                                                        key={card.id}
                                                        type="button"
                                                        onClick={() => handleSelectAttackWeapon(card.id)}
                                                        data-testid={`betrayal-attack-weapon-${card.id}`}
                                                        className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                                                            isSelectedWeapon
                                                                ? 'text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4'
                                                                : 'text-[#d6c498] hover:text-[#f0dfad]'
                                                        }`}
                                                    >
                                                        {card.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                    {selectedCardCanUseRabbitFoot && core.recentRoll ? (
                                        <div
                                            data-testid="betrayal-rabbit-foot-dice"
                                            className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                                        >
                                            <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">兔脚</span>
                                            {core.recentRoll.dice.map((pip, dieIndex) => (
                                                <button
                                                    key={`${core.recentRoll!.id}-${dieIndex}`}
                                                    type="button"
                                                    onClick={() => {
                                                        dispatchCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, {
                                                            cardId: selectedInventoryCard?.id,
                                                            dieIndex,
                                                        });
                                                        setInventoryPreviewCardId(null);
                                                    }}
                                                    data-testid={`betrayal-rabbit-foot-die-${dieIndex}`}
                                                    className="min-h-[28px] min-w-[28px] rounded-none border-0 bg-transparent px-1 text-[12px] font-bold text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4 shadow-none transition hover:text-[#f6ffc4]"
                                                    title={`重掷第 ${dieIndex + 1} 颗骰子`}
                                                >
                                                    {pip}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                    {(canDeclareHolySymbolExplore || canDeclareIdolExplore) && explorableRoomSlots.length > 0 ? (
                                        <div
                                            data-testid="betrayal-explore-options"
                                            className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                                        >
                                            <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">探索</span>
                                            {canDeclareHolySymbolExplore ? (
                                                <button
                                                    type="button"
                                                    onClick={handleToggleHolySymbolExplore}
                                                    data-testid="betrayal-explore-option-holy-symbol"
                                                    className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                                                        useHolySymbolForExplore
                                                            ? 'text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4'
                                                            : 'text-[#d6c498] hover:text-[#f0dfad]'
                                                    }`}
                                                >
                                                    圣符
                                                </button>
                                            ) : null}
                                            {canDeclareIdolExplore ? (
                                                <button
                                                    type="button"
                                                    onClick={handleToggleIdolExplore}
                                                    data-testid="betrayal-explore-option-idol"
                                                    className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                                                        useIdolForExplore
                                                            ? 'text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4'
                                                            : 'text-[#d6c498] hover:text-[#f0dfad]'
                                                    }`}
                                                >
                                                    雕像
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    {selectedCardNeedsTargetRoom && maskTargetTokens.length > 0 && maskTargetRooms.length > 0 ? (
                                        <div
                                            data-testid="betrayal-mask-target-selector"
                                            className="inline-flex max-w-[min(720px,calc(100vw-2rem))] flex-wrap items-center gap-2 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                                        >
                                            <span className="px-1 text-[11px] font-semibold text-[#d9c68f]">面具</span>
                                            {maskTargetTokens.map((token) => (
                                                <div
                                                    key={token.id}
                                                    data-testid={`betrayal-mask-target-row-${token.id}`}
                                                    className="inline-flex items-center gap-1"
                                                >
                                                    <span className="max-w-[84px] truncate text-[11px] text-[#ead7a5]">{token.name}</span>
                                                    {maskTargetRooms.map((room) => {
                                                        const isSelectedRoom = selectedMaskTargetRoomIdsByTokenId[token.id] === room.id;
                                                        return (
                                                            <button
                                                                key={`${token.id}-${room.id}`}
                                                                type="button"
                                                                onClick={() => handleSelectMaskTargetRoom(token.id, room.id)}
                                                                data-testid={`betrayal-mask-target-${token.id}-${room.id}`}
                                                                className={`min-h-[26px] rounded-[7px] border px-2 text-[11px] font-semibold transition ${
                                                                    isSelectedRoom
                                                                        ? 'border-[#c9a35e] bg-[rgba(139,164,51,0.30)] text-[#eef4a8] shadow-[0_0_0_1px_rgba(201,163,94,0.28)]'
                                                                        : 'border-[#5f5031] bg-[rgba(22,19,15,0.42)] text-[#d6c498] hover:bg-[rgba(139,164,51,0.18)]'
                                                                }`}
                                                            >
                                                                {room.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            <div
                                ref={roomGridRef}
                                className="relative min-h-[500px] flex-1 cursor-grab touch-none overflow-auto overscroll-contain bg-transparent [scrollbar-color:#7a6240_rgba(8,12,10,0.72)] active:cursor-grabbing sm:min-h-[540px] md:min-h-[580px]"
                                data-testid="betrayal-room-grid"
                                aria-label={t('board.sections.rooms')}
                                onPointerDown={handleRoomGridPointerDown}
                                onPointerMove={handleRoomGridPointerMove}
                                onPointerUp={handleRoomGridPointerEnd}
                                onPointerCancel={handleRoomGridPointerEnd}
                            >
                                <div
                                    className="relative mx-auto xl:ml-0 xl:mr-auto"
                                    data-testid="betrayal-room-canvas"
                                    style={roomCanvasStyle}
                                >
                                    {core.rooms.map((room) => {
                                    const tone = FLOOR_TONE[room.floor];
                                    const isActive = room.id === core.activeRoomId;
                                    const occupants = roomOccupants[room.id] ?? [];
                                    const monsters = roomMonsters[room.id] ?? [];
                                    const isDiscovered = room.state === 'discovered';
                                    const isExplorableSlot = explorableRoomSlotIds.has(room.id);
                                    const isReachableRoom = moveTargetRoomIds.has(room.id);
                                    const isSkeletonKeyMoveTarget = skeletonKeyMoveTargetRoomIds.has(room.id);
                                    const isMoveTarget = previewState.interactionMode === 'move' && moveTargetRoomIds.has(room.id);
                                    const isExploreTarget = previewState.interactionMode === 'explore' && explorableRoomSlotIds.has(room.id);
                                    const roomTileVisual = resolveRoomTileVisual(room, isDiscovered);
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
                                        ? room.hint
                                        : isExplorableSlot
                                            ? t('board.rooms.slotReady')
                                            : t('board.rooms.slotUndiscovered');
                                    return (
                                        <div
                                            key={room.id}
                                            data-testid={`betrayal-room-shell-${room.id}`}
                                            className="group absolute overflow-visible"
                                            style={{
                                                ...resolveRoomTileStyle(room),
                                                zIndex: isMoveTarget || isExploreTarget ? 30 : isActive ? 25 : isReachableRoom ? 20 : 1,
                                            }}
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
                                                className="relative h-full w-full overflow-visible rounded-[4px] border p-0 text-left transition duration-200 disabled:cursor-default"
                                                style={{
                                                borderColor: isMoveTarget
                                                    ? 'rgba(118, 189, 153, 0.22)'
                                                    : isReachableRoom
                                                        ? 'rgba(96, 155, 125, 0.12)'
                                                        : isExploreTarget || isExplorableSlot
                                                            ? 'rgba(164, 141, 84, 0.16)'
                                                            : 'rgba(0, 0, 0, 0)',
                                                backgroundColor: 'transparent',
                                                boxShadow: isActive
                                                    ? '0 0 16px rgba(105,174,128,0.14), 0 12px 22px rgba(0,0,0,0.22)'
                                                    : isMoveTarget
                                                        ? '0 0 0 1px rgba(118,189,153,0.14), 0 8px 16px rgba(0,0,0,0.18)'
                                                        : isReachableRoom
                                                            ? '0 0 0 1px rgba(96,155,125,0.08), 0 8px 16px rgba(0,0,0,0.16)'
                                                            : isExploreTarget || isExplorableSlot
                                                                ? '0 0 0 1px rgba(164,141,84,0.12), 0 8px 16px rgba(0,0,0,0.16)'
                                                                : '0 8px 16px rgba(0,0,0,0.14)',
                                                opacity: !isDiscovered
                                                    ? 1
                                                    : isActive || isMoveTarget || isReachableRoom || isExplorableSlot || isExploreTarget
                                                        ? 1
                                                        : 0.92,
                                            }}
                                        >
                                            <div className="pointer-events-none absolute -inset-0.5 -z-10 rounded-[6px] bg-[rgba(0,0,0,0.12)] blur-[1px]" />
                                            <RoomTileSprite
                                                visual={roomTileVisual}
                                                locale={effectiveLocale}
                                                alt=""
                                                className={`pointer-events-none absolute inset-0 rounded-[3px] bg-[#15110d] ${
                                                    isDiscovered ? 'opacity-95' : 'opacity-82'
                                                }`}
                                            />
                                            <div
                                                className={`pointer-events-none absolute inset-0 rounded-[3px] ${
                                                    isActive
                                                    ? 'bg-[radial-gradient(circle_at_50%_42%,rgba(126,189,145,0.12),transparent_58%),linear-gradient(180deg,rgba(6,11,9,0.02),rgba(4,7,6,0.24))]'
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
                                                    className={`absolute left-2 top-2 h-2 w-2 rounded-full border border-white/10 ${identityTone.stripe}`}
                                                />
                                            ) : null}
                                            <div className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-inset ring-[rgba(222,192,133,0.05)]" />
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

                                            {(() => {
                                                const hasPlayers = occupants.length > 0;
                                                const hasMonsters = monsters.length > 0;
                                                const tokenClusterClass = hasPlayers && hasMonsters
                                                    ? 'gap-1.5'
                                                    : 'gap-0';
                                                const playerContainerClass = hasMonsters
                                                    ? 'items-center'
                                                    : 'items-center';
                                                const monsterContainerClass = hasPlayers
                                                    ? 'items-center'
                                                    : 'items-center';
                                                return (
                                                    <div className={`pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center ${tokenClusterClass}`}>
                                                        {hasPlayers ? (
                                                            <div className={`flex max-h-[146px] flex-col justify-center gap-2 ${playerContainerClass}`}>
                                                                {occupants.map((occupant) => (
                                                                    <span
                                                                        key={occupant.playerId}
                                                                        data-testid={`betrayal-room-occupant-${room.id}-${occupant.playerId}`}
                                                                        title={resolvePlayerName(occupant.playerId, occupant.displayName, matchData)}
                                                                    >
                                                                        <ExplorerFigureToken
                                                                            explorer={occupant}
                                                                            locale={effectiveLocale}
                                                                            label={resolvePlayerName(occupant.playerId, occupant.displayName, matchData)}
                                                                            tone={occupant.playerId === core.currentExplorer.playerId ? 'self' : 'ally'}
                                                                        />
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                        {hasMonsters ? (
                                                            <div className={`flex max-h-[146px] flex-col justify-center gap-2 ${monsterContainerClass}`}>
                                                                {monsters.map((monster) => (
                                                                    <span
                                                                        key={monster.id}
                                                                        data-testid={`betrayal-room-monster-${room.id}-${monster.id}`}
                                                                        title={`${monster.name} · 力量 ${monster.might} · 速度 ${monster.speed}`}
                                                                    >
                                                                        <MonsterBoardToken monster={monster} locale={effectiveLocale} />
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })()}
                                            </button>
                                            <div className="absolute right-2 top-2 z-30 flex min-h-6 flex-wrap justify-center gap-1.5">
                                                {isMoveTarget ? (
                                                    <button
                                                        type="button"
                                                        onPointerDown={(event) => {
                                                            event.stopPropagation();
                                                        }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleMoveToRoom(room.id);
                                                }}
                                                data-testid={`betrayal-room-move-target-${room.id}`}
                                                data-tutorial-id={tutorialMapTargetRoomId === room.id ? tutorialStep?.highlightTarget : undefined}
                                                className="grid h-4 w-4 place-items-center rounded-full border border-[#76bd99] bg-[#76bd99] shadow-[0_0_14px_rgba(118,189,153,0.8)]"
                                                title={isSkeletonKeyMoveTarget ? '使用骨制钥匙穿墙移动' : t('board.rooms.moveTarget')}
                                            >
                                                        <span className="sr-only">{isSkeletonKeyMoveTarget ? '使用骨制钥匙穿墙移动' : t('board.rooms.moveTarget')}</span>
                                                    </button>
                                                ) : isReachableRoom ? (
                                                    <span
                                                        className="pointer-events-none h-2.5 w-2.5 rounded-full border border-[#6aa986] bg-[rgba(106,169,134,0.58)]"
                                                        title={isSkeletonKeyMoveTarget ? '使用骨制钥匙穿墙移动' : t('board.rooms.moveTarget')}
                                                    />
                                                ) : isExploreTarget ? (
                                                    <button
                                                        type="button"
                                                        onPointerDown={(event) => {
                                                            event.stopPropagation();
                                                        }}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleExploreRoom(room.id);
                                                        }}
                                                        data-testid={`betrayal-room-explore-target-${room.id}`}
                                                        className="grid h-4 w-4 place-items-center rounded-full border border-[#d3b36d] bg-[#d3b36d] shadow-[0_0_14px_rgba(211,179,109,0.76)]"
                                                        title={t('board.rooms.explorable')}
                                                    >
                                                        <span className="sr-only">{t('board.rooms.explorable')}</span>
                                                    </button>
                                                ) : null}
                                            </div>
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
                                                className="absolute bottom-2 right-2 z-30 grid h-7 w-7 place-items-center rounded-full border border-[rgba(222,192,133,0.34)] bg-[rgba(7,10,8,0.7)] text-[#f0d29a] opacity-0 shadow-[0_5px_10px_rgba(0,0,0,0.24)] transition group-hover:opacity-78 hover:bg-[rgba(36,28,19,0.88)] hover:opacity-100 focus:opacity-100"
                                                title={t('board.rooms.preview')}
                                            >
                                                <Search size={13} />
                                                <span className="sr-only">{t('board.rooms.preview')}</span>
                                            </button>
                                        </div>
                                    );
                                    })}
                                </div>
                            </div>
                        </article>

                        <article className="relative z-30 order-2 mx-auto w-full max-w-[700px] bg-transparent p-0 pt-0">
                            <div className="relative mx-auto max-w-[676px] px-2 pt-0 pb-1">
                                <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.18),transparent)]" />
                                {core.recommendedAction === 'trade' ? (
                                    <div
                                        data-testid="betrayal-trade-flow-banner"
                                        data-tutorial-id="betrayal-actions-zone"
                                        aria-label={t('board.status.tradeFlowStart')}
                                        className="flex flex-wrap items-center justify-center gap-3 rounded-none border-0 bg-transparent p-0 text-[12px] shadow-none outline-none"
                                        style={{
                                            appearance: 'none',
                                            WebkitAppearance: 'none',
                                            backgroundColor: 'transparent',
                                            backgroundImage: 'none',
                                            border: '0',
                                            boxShadow: 'none',
                                            filter: 'none',
                                        }}
                                    >
                                        <button
                                            type="button"
                                            data-testid="betrayal-trade-flow-item-step"
                                            onClick={() => scrollToSection('betrayal-inventory-section')}
                                            className={`inline-flex min-h-[28px] appearance-none items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold shadow-none outline-none transition ${
                                                selectedInventoryCard
                                                    ? 'text-[#ffe06e] underline decoration-[#ffe06e] decoration-2 underline-offset-5'
                                                    : 'text-[#ead7a5] hover:text-[#fff1a8]'
                                            }`}
                                            style={{
                                                appearance: 'none',
                                                WebkitAppearance: 'none',
                                                backgroundColor: 'transparent',
                                                backgroundImage: 'none',
                                                border: '0',
                                                boxShadow: 'none',
                                                filter: 'none',
                                            }}
                                        >
                                            <span className="text-[#d5b66e]">{t('board.status.tradeStepItem')}</span>
                                            <span>{selectedInventoryCard?.name ?? t('board.status.tradeStepPending')}</span>
                                        </button>
                                        <span className="select-none text-[12px] font-semibold text-[#bca05f]">-&gt;</span>
                                        <button
                                            type="button"
                                            data-testid="betrayal-trade-flow-target-step"
                                            onClick={() => {
                                                const firstTradeTarget = tradeTargets[0];
                                                if (firstTradeTarget) {
                                                    focusRoomInView(firstTradeTarget.roomId);
                                                }
                                            }}
                                            className={`inline-flex min-h-[28px] appearance-none items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold shadow-none outline-none transition ${
                                                selectedTradeTarget
                                                    ? 'text-[#9fe1a7] underline decoration-[#9fe1a7] decoration-2 underline-offset-5'
                                                    : 'text-[#ead7a5] hover:text-[#d4ead0]'
                                            }`}
                                            style={{
                                                appearance: 'none',
                                                WebkitAppearance: 'none',
                                                backgroundColor: 'transparent',
                                                backgroundImage: 'none',
                                                border: '0',
                                                boxShadow: 'none',
                                                filter: 'none',
                                            }}
                                        >
                                            <span className="text-[#d5b66e]">{t('board.status.tradeStepTarget')}</span>
                                            <span>{selectedTradeTargetName ?? t('board.status.tradeStepPending')}</span>
                                        </button>
                                        <span className="select-none text-[12px] font-semibold text-[#bca05f]">-&gt;</span>
                                        <button
                                            type="button"
                                            onClick={handleTradeAction}
                                            disabled={!tradeSelectionReady || !previewState.tradeSelectionTouched}
                                            data-testid="betrayal-action-trade"
                                            data-tutorial-id="betrayal-action-trade"
                                            title={actionCueText}
                                            className={`inline-flex min-h-[28px] min-w-[64px] appearance-none items-center justify-center rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold shadow-none outline-none transition ${
                                                tradeSelectionReady && previewState.tradeSelectionTouched
                                                    ? 'text-[#ffe06e] underline decoration-[#ffe06e] decoration-2 underline-offset-5 hover:text-[#fff1a8]'
                                                    : 'cursor-default text-[#b9aa82] opacity-60'
                                            }`}
                                            style={{
                                                appearance: 'none',
                                                WebkitAppearance: 'none',
                                                backgroundColor: 'transparent',
                                                backgroundImage: 'none',
                                                border: '0',
                                                boxShadow: 'none',
                                                filter: 'none',
                                            }}
                                        >
                                            {selectedCorpseLootTarget ? t('board.actions.loot') : t('board.status.tradeFlowConfirm')}
                                        </button>
                                    </div>
                                ) : (
                                    <ActionBarSkeleton
                                        actions={actionItems}
                                        layout="row"
                                        align="space-between"
                                        containerProps={{ 'data-tutorial-id': 'betrayal-actions-zone' }}
                                        className="flex flex-wrap items-center justify-center gap-1.5"
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
                                                    className={`relative inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.06em] transition ${
                                                        action.disabled
                                                            ? 'cursor-not-allowed bg-[rgba(20,18,14,0.3)] text-[#6f6758]'
                                                            : isRecommended
                                                                ? 'bg-[rgba(139,164,51,0.24)] text-[#eef4a8] shadow-[0_0_0_1px_rgba(201,163,94,0.34),0_0_18px_rgba(181,239,66,0.16)] hover:bg-[rgba(139,164,51,0.34)]'
                                                                : 'bg-[rgba(22,19,15,0.24)] text-[#d6c498] shadow-[0_0_0_1px_rgba(140,116,77,0.18)] hover:bg-[rgba(38,30,22,0.34)]'
                                                    }`}
                                                >
                                                    <Icon size={13} />
                                                    <span>{action.label}</span>
                                                </button>
                                            );
                                        }}
                                    />
                                )}
                            </div>
                        </article>

                    </section>

                    <section className="relative z-10 order-3 flex min-h-0 flex-col gap-2 px-1 py-1 md:px-1 xl:order-3 xl:overflow-y-auto">
                        <article
                            id="betrayal-decks-section"
                            className="relative ml-auto w-full max-w-[198px] overflow-visible bg-transparent px-0 pb-2 pt-3"
                        >
                            <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.32))]" />
                                <div className="text-[11px] uppercase tracking-[0.24em] text-[#c4a265]">
                                    {t('board.sections.decks')}
                                </div>
                                <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(196,162,101,0.32),transparent)]" />
                            </div>
                            <ResourceTraySkeleton
                                items={deckItems}
                                canInteract={false}
                                layout="column"
                                className="mt-3 grid grid-cols-3 gap-2.5"
                                renderItem={(item) => {
                                    const isHighlighted = item.id === `deck-${core.highlightedDeckKind}`;
                                    const deckTiltClass = item.kind === 'omen'
                                        ? '-rotate-[1.25deg]'
                                        : item.kind === 'item'
                                            ? 'rotate-[0.85deg]'
                                            : '-rotate-[0.55deg]';
                                    return (
                                        <div className="relative pt-2 text-center">
                                            <span className="pointer-events-none absolute left-1/2 top-[10px] h-[122px] w-[70%] -translate-x-1/2 translate-x-[2px] bg-[rgba(12,10,8,0.18)]" />
                                            <span className="pointer-events-none absolute left-1/2 top-[6px] h-[122px] w-[70%] -translate-x-1/2 -translate-x-[2px] bg-[rgba(18,14,11,0.16)]" />
                                            <div
                                                className={`relative overflow-hidden bg-[rgba(28,20,15,0.34)] shadow-[0_10px_18px_rgba(0,0,0,0.16)] ${deckTiltClass} ${
                                                    isHighlighted ? 'shadow-[0_0_0_1px_rgba(210,171,97,0.38),0_10px_20px_rgba(0,0,0,0.2)]' : ''
                                                }`}
                                            >
                                                <OptimizedImage
                                                    src={item.asset}
                                                    locale={effectiveLocale}
                                                    alt={item.label}
                                                    className="h-[124px] w-full object-cover"
                                                    draggable={false}
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.9))] px-2 py-2">
                                                    <div className="truncate text-[8px] uppercase tracking-[0.12em] text-[#d8c596]">
                                                        {item.label}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="-mt-2.5 inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-[#6f5933] bg-[radial-gradient(circle_at_35%_25%,rgba(229,210,174,0.14),rgba(21,18,14,0.92))] px-2 text-[20px] font-semibold text-[#e3d2ae] shadow-[0_6px_12px_rgba(0,0,0,0.16)]">
                                                {item.count}
                                            </div>
                                        </div>
                                    );
                                }}
                            />

                            <div className="mt-5 flex items-center gap-2">
                                <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.24))]" />
                                <div className="text-[11px] uppercase tracking-[0.24em] text-[#c4a265]">
                                    {t('board.sections.discard')}
                                </div>
                                <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(196,162,101,0.24),transparent)]" />
                            </div>
                            <ResourceTraySkeleton
                                items={discardItems}
                                canInteract={false}
                                layout="column"
                                className="mt-3 grid grid-cols-3 gap-2.5"
                                renderItem={(item) => (
                                    <div className="relative pt-1 text-center">
                                        <span className="pointer-events-none absolute left-1/2 top-[8px] h-[94px] w-[70%] -translate-x-1/2 translate-x-[2px] bg-[rgba(16,13,11,0.12)]" />
                                        <div
                                            className="relative overflow-hidden bg-[rgba(31,23,18,0.28)] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                                            title={item.count > 0 ? t('board.decks.faceUp') : t('board.decks.emptySlot')}
                                        >
                                            <OptimizedImage
                                                src={item.asset}
                                                locale={effectiveLocale}
                                                alt={item.label}
                                                className={`h-[96px] w-full object-cover ${item.count === 0 ? 'grayscale opacity-22' : 'opacity-38'}`}
                                                draggable={false}
                                            />
                                        </div>
                                        <div className="mt-1 text-[10px] text-[#c5b693]">{item.count}</div>
                                    </div>
                                )}
                            />
                        </article>

                        <article className="bg-transparent pt-1">
                            <div className="mt-0.5 flex justify-start gap-1.5">
                            <button
                                type="button"
                                onClick={() => setReferenceOpen(true)}
                                data-testid="betrayal-open-scenario"
                                data-tutorial-id="betrayal-reference-entry"
                                className="inline-flex h-[40px] min-w-[84px] items-center gap-1.5 rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] px-2.5 text-[#d8bf81] transition hover:border-[#8b744d]"
                                title={scenarioConfig.presentation.referenceTitle}
                            >
                                <BookOpen size={15} />
                                <span className="text-[11px] font-semibold tracking-[0.06em]">{scenarioConfig.presentation.referenceTitle}</span>
                            </button>
                                <button
                                    type="button"
                                    onClick={() => setRoomPreviewId(core.activeRoomId)}
                                    data-testid="betrayal-open-active-room-preview"
                                    className="grid h-[40px] w-[40px] place-items-center rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] text-[#d8bf81] transition hover:border-[#8b744d]"
                                    title={t('board.rooms.preview')}
                                >
                                    <House size={16} />
                                </button>
                            </div>
                            <div className="mt-3 hidden xl:block">
                                <div className="flex items-center gap-2">
                                    <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.18))]" />
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89d84]">
                                        {t('board.hud.teammatesLabel')}
                                    </div>
                                </div>
                                <div className="mt-2 grid gap-1.5">
                                    {core.otherExplorers.map((explorer) => {
                                        const isTradeCandidate = tradeTargets.some((item) => item.playerId === explorer.playerId);
                                        const isSelectedTradeTarget = explorer.playerId === selectedTradeTargetPlayerId;
                                        const isSameRoom = core.currentExplorer.roomId === explorer.roomId;
                                        const roomName = core.rooms.find((room) => room.id === explorer.roomId)?.name || t('board.rooms.unknown');
                                        const tradeTargetLooseButtonClass = core.recommendedAction === 'trade' && isTradeCandidate
                                            ? `group relative inline-flex min-h-[26px] w-max max-w-full items-center gap-1.5 rounded-none border-0 bg-transparent px-0 py-0 text-left text-[12px] font-semibold shadow-none outline-none transition ${
                                                isSelectedTradeTarget
                                                    ? 'text-[#9fe1a7] underline decoration-[#9fe1a7] decoration-2 underline-offset-4'
                                                    : 'text-[#d4ead0] hover:text-[#efffe8]'
                                            }`
                                            : `group relative grid grid-cols-[34px_minmax(0,1fr)] items-start gap-2 rounded-[8px] px-1.5 py-1.5 text-left transition ${
                                                isSelectedTradeTarget
                                                    ? 'bg-transparent outline outline-[4px] outline-offset-[3px] outline-[#9fe1a7] shadow-[0_0_0_5px_rgba(255,255,221,0.30)]'
                                                    : isTradeCandidate
                                                        ? 'bg-transparent hover:bg-[rgba(255,224,138,0.06)]'
                                                        : 'hover:bg-[rgba(28,24,19,0.18)]'
                                            }`;
                                        return (
                                            <button
                                                key={`sidebar-teammate-${explorer.playerId}`}
                                                type="button"
                                                onClick={() => {
                                                    focusRoomInView(explorer.roomId);
                                                    setPreviewState((previousState) => ({
                                                        ...previousState,
                                                        selectedTradeTargetPlayerId: isTradeCandidate ? explorer.playerId : previousState.selectedTradeTargetPlayerId,
                                                        tradeSelectionTouched: isTradeCandidate ? true : previousState.tradeSelectionTouched,
                                                    }));
                                                }}
                                                data-testid={`betrayal-bottom-teammate-${explorer.playerId}`}
                                                className={tradeTargetLooseButtonClass}
                                                style={core.recommendedAction === 'trade' && isTradeCandidate
                                                    ? {
                                                        appearance: 'none',
                                                        WebkitAppearance: 'none',
                                                        backgroundColor: 'transparent',
                                                        backgroundImage: 'none',
                                                        border: '0',
                                                        boxShadow: 'none',
                                                    }
                                                    : undefined}
                                                title={`定位到 ${roomName}`}
                                            >
                                                {core.recommendedAction === 'trade' && isTradeCandidate ? null : (
                                                    <div className={`relative h-[34px] w-[34px] overflow-hidden rounded-full border ${
                                                        isTradeCandidate ? 'border-[rgba(118,189,153,0.62)]' : 'border-[rgba(117,98,68,0.42)]'
                                                    } bg-[rgba(12,14,13,0.62)]`}>
                                                        <OptimizedImage
                                                            src={explorer.portraitAsset}
                                                            locale={effectiveLocale}
                                                            alt={explorer.displayName}
                                                            className="h-full w-full object-contain"
                                                            draggable={false}
                                                        />
                                                        <span
                                                            className={`pointer-events-none absolute inset-0 rounded-full ring-1 ${
                                                                isSameRoom ? 'ring-[rgba(174,230,133,0.38)]' : 'ring-transparent'
                                                            }`}
                                                        />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className={`truncate tracking-[0.04em] ${
                                                            core.recommendedAction === 'trade' && isTradeCandidate
                                                                ? 'text-[12px] font-semibold'
                                                                : 'text-[11px] font-medium text-[#efe5cf]'
                                                        }`}>
                                                            {resolvePlayerName(explorer.playerId, explorer.displayName, matchData)}
                                                        </div>
                                                        {isTradeCandidate ? (
                                                            core.recommendedAction === 'trade' ? (
                                                                <span className="shrink-0 text-[12px] font-semibold text-[#bca05f]">
                                                                    {isSelectedTradeTarget ? t('board.status.selected') : t('board.status.tradeStepTarget')}
                                                                </span>
                                                            ) : (
                                                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] ${
                                                                     isSelectedTradeTarget
                                                                         ? 'bg-[#fff1a8] text-[#2a2108]'
                                                                         : 'bg-[rgba(40,63,50,0.18)] text-[#bddac2]'
                                                                 }`}>
                                                                    {isSameRoom ? t('board.players.sameRoom') : t('board.players.tradeTarget')}
                                                                </span>
                                                            )
                                                        ) : null}
                                                    </div>
                                                    {core.recommendedAction === 'trade' && isTradeCandidate ? null : (
                                                        <>
                                                            <div className="mt-0.5 truncate text-[10px] text-[#b7aa92]">{roomName}</div>
                                                            <div className="mt-1 flex items-center gap-1">
                                                                {(['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]).map((key) => (
                                                                    <span
                                                                        key={`${explorer.playerId}-${key}`}
                                                                        className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[rgba(21,18,14,0.84)] px-1 text-[9px] font-semibold ${TRAIT_VALUE_TEXT_CLASS[key]}`}
                                                                        title={`${TRAIT_LABEL_LOCAL[key]} ${explorer.traits[key]}`}
                                                                    >
                                                                        {explorer.traits[key]}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
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

                <MagnifyOverlay
                    isOpen={referenceOpen}
                    onClose={() => setReferenceOpen(false)}
                    overlayTestId="betrayal-reference-overlay"
                    overlayClassName="bg-[rgba(3,6,5,0.82)] p-3 md:p-6"
                    containerClassName="rounded-none overflow-visible bg-transparent"
                >
                    <div
                        className="pointer-events-auto relative"
                        style={{
                            width: REFERENCE_CARD_FRAME_WIDTH,
                            aspectRatio: `${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO} / 1`,
                        }}
                    >
                        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={toggleReferenceSide}
                                data-testid="betrayal-reference-toggle"
                                className="inline-flex items-center gap-1 rounded-full bg-[rgba(9,13,12,0.84)] px-3 py-1.5 text-xs font-medium text-[#f3e0b4] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.92)]"
                            >
                                {referenceSide === 'front' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                                <span>{t('board.reference.toggle')}</span>
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReferenceOpen(false)}
                            data-testid="betrayal-reference-close"
                            className="absolute right-3 top-3 z-10 rounded-full bg-[rgba(9,13,12,0.84)] px-3 py-1.5 text-xs font-medium text-[#f3e0b4] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.92)]"
                        >
                            {t('board.reference.close')}
                        </button>
                        <OptimizedImage
                            src={referenceSide === 'front' ? ASSETS.playerReference.front : ASSETS.playerReference.back}
                            locale={effectiveLocale}
                            alt={t(`board.reference.${referenceSide}`)}
                            className="h-full w-full object-contain shadow-[0_24px_56px_rgba(0,0,0,0.44)]"
                            draggable={false}
                        />
                    </div>
                </MagnifyOverlay>

                {previewRoom && previewRoomVisual ? (
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
                                    <RoomTileSprite
                                        visual={previewRoomVisual}
                                        locale={effectiveLocale}
                                        alt={previewRoom.name}
                                        className="aspect-square w-full max-w-[72vh] md:max-w-[78vh]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                <MagnifyOverlay
                    isOpen={Boolean(previewInventoryCard)}
                    onClose={() => setInventoryPreviewCardId(null)}
                    overlayTestId="betrayal-inventory-preview-overlay"
                    overlayClassName="bg-[rgba(3,6,5,0.74)] p-4 md:p-6"
                    containerClassName="rounded-none overflow-visible bg-transparent"
                >
                    {previewInventoryCard ? (
                        <div
                            className="pointer-events-auto relative"
                            style={{
                                width: INVENTORY_PREVIEW_FRAME_WIDTH,
                                aspectRatio: `${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO} / 1`,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setInventoryPreviewCardId(null)}
                                data-testid="betrayal-inventory-preview-close"
                                className="absolute -right-3 -top-3 z-10 rounded-full bg-[rgba(9,13,12,0.88)] px-3 py-1.5 text-xs font-medium text-[#f3e0b4] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.92)]"
                            >
                                {t('board.reference.close')}
                            </button>
                            <div className="pointer-events-none">
                                {renderInventoryCard(previewInventoryCard, { layout: 'preview', testId: 'betrayal-inventory-preview-card' })}
                            </div>
                        </div>
                    ) : null}
                </MagnifyOverlay>

                {core.recommendedAction === 'trade' ? null : (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(var(--safe-area-bottom)+0.75rem)] md:hidden">
                    <div className="pointer-events-auto rounded-[18px] border border-[#5f4d31] bg-[rgba(14,20,18,0.92)] p-2 shadow-[0_16px_32px_rgba(0,0,0,0.34)] backdrop-blur-sm">
                        <div className="mb-2 flex items-center gap-2">
                            <div className="min-w-0 flex-1 rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[#a89d84]">
                                    {t('board.mobile.selectedLabel')}
                                </div>
                                <div
                                    className="truncate text-sm font-medium text-[#f3ead6]"
                                    data-testid="betrayal-mobile-selected-card"
                                >
                                    {selectedInventoryCard?.name || t('board.status.noSelectedCard')}
                                </div>
                                <div
                                    className={`mt-1 truncate text-[11px] ${selectedCardUseDisabled ? 'text-[#f0c1a2]' : 'text-[#8db29a]'}`}
                                    data-testid="betrayal-mobile-use-status"
                                >
                                    {useStatusText}
                                </div>
                                {shouldShowMobileTradeStatus ? (
                                    <div
                                        className={`mt-1 truncate text-[11px] ${
                                            selectedTradeTarget ? 'text-[#8db29a]' : 'text-[#b8ae98]'
                                        }`}
                                        data-testid="betrayal-mobile-trade-status"
                                    >
                                        {tradeStatusText}
                                    </div>
                                ) : null}
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
                                {t('board.sections.inventory')}
                            </button>
                            <button
                                type="button"
                                onClick={() => scrollToSection('betrayal-decks-section')}
                                data-testid="betrayal-mobile-jump-decks"
                                className="rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2 text-xs font-medium text-[#dbcfae]"
                            >
                                {t('board.sections.decks')}
                            </button>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {visibleActionItems.map((action) => {
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
                )}
            </div>
        </div>
    );
}
