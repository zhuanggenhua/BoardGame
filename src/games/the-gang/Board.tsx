import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { ListOrdered, SlidersHorizontal, Wrench, X } from 'lucide-react';
import type { GameBoardProps, MatchPlayerInfo, MatchUiEvent } from '../../engine/transport/protocol';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorialBridge } from '../../contexts/TutorialContext';
import { useToast } from '../../contexts/ToastContext';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { ConfirmModal } from '../../components/common/overlays/ConfirmModal';
import { EndgameOverlay, type ContentSlotProps } from '../../components/game/framework/widgets/EndgameOverlay';
import { buildPlayerDisplayNameMap } from '../../components/game/framework/playerDisplay';
import { HudPortal, UI_Z_INDEX } from '../../core';
import { useEndgame } from '../../hooks/game/useEndgame';
import { useGameAudio } from '../../lib/audio/useGameAudio';
import { THE_GANG_AUDIO_CONFIG } from './audio.config';
import { formatCard } from './domain/cards';
import {
    evaluateBestTheGangHand,
    THE_GANG_EXPANDED_HAND_RANK_RULES,
    TEXAS_HOLDEM_HAND_RANK_RULES,
    type PokerHandRankRule,
} from './domain/poker';
import {
    THE_GANG_CHALLENGES,
    THE_GANG_EXIT_CHIP_MODES,
    THE_GANG_GAME_MODES,
    THE_GANG_SPECIALISTS,
    THE_GANG_TOOLS,
    getActiveChallengeLabels,
    isChallengeActive,
    normalizeRulesConfig,
} from './domain/expansions';
import { getChipValues } from './domain/setup';
import {
    allRequiredChipOwnersHaveChips,
    allRequiredFinalTokensAreTaken,
    getChipForHandSlot,
    getCurrentRoundExitChipOwners,
    getRequiredExitChipCount,
    getUnoccupiedChipValues,
    hasExitChipForHandSlot,
    parseChipOwnerKey,
    resolveChipOwnerKey,
    THE_GANG_HAND_SLOTS,
    type TheGangHandSlot,
} from './domain/chips';
import {
    THE_GANG_COMMANDS,
    type PlayingCard,
    type TheGangChallengeId,
    type TheGangCommandMap,
    type TheGangCore,
    type TheGangExitChipMode,
    type TheGangGameMode,
    type TheGangProgressKind,
    type TheGangRound,
    type TheGangRulesConfig,
    type TheGangSpecialistId,
    type TheGangToolId,
} from './domain/types';
import { THE_GANG_MANIFEST } from './manifest';

type Props = GameBoardProps<TheGangCore, TheGangCommandMap>;

const resolveCanConfigureRules = (
    matchData: MatchPlayerInfo[] | undefined,
    playerID: string | null | undefined,
    fallbackOwnerPlayerId: string,
) => {
    const localPlayerId = playerID ?? fallbackOwnerPlayerId;
    const ownerSeat = matchData?.find((player) => player.isOwner === true);
    if (!ownerSeat) return localPlayerId === fallbackOwnerPlayerId;
    return String(ownerSeat.id) === localPlayerId;
};

const ROUND_LABELS = {
    1: '白筹码',
    2: '黄筹码',
    3: '橙筹码',
    4: '红筹码',
};

const CHIP_ASSET_COLORS = {
    1: 'white',
    2: 'yellow',
    3: 'orange',
    4: 'red',
};

const getChipAssetPath = (round: number, value: number) => {
    const color = CHIP_ASSET_COLORS[round as keyof typeof CHIP_ASSET_COLORS] ?? 'white';
    return `the-gang/chips/round-${round}-${color}-${value}`;
};

const EXIT_CHIP_ASSET_PATH = 'the-gang/chips/exit-chip';

const CARD_BACK_ASSET_PATH = 'the-gang/cards/card-back';

const COMMUNITY_CARD_FRAME_CLASSES = [
    'border-yellow-300 bg-yellow-300/18 ring-yellow-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(253,224,71,0.9)]',
    'border-yellow-300 bg-yellow-300/18 ring-yellow-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(253,224,71,0.9)]',
    'border-yellow-300 bg-yellow-300/18 ring-yellow-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(253,224,71,0.9)]',
    'border-orange-400 bg-orange-400/18 ring-orange-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(251,146,60,0.92)]',
    'border-red-500 bg-red-500/18 ring-red-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(239,68,68,0.94)]',
] as const;

const getChallengeAssetPath = (challengeId: TheGangChallengeId) =>
    `the-gang/rule-assets/challenges/${challengeId}`;

const getToolAssetPath = (tool: TheGangToolId) =>
    `the-gang/rule-assets/tools/${tool}`;

const getSpecialistAssetPath = (specialist: TheGangSpecialistId) =>
    `the-gang/rule-assets/specialists/${specialist}`;

const RULE_SURFACE_ASSETS = {
    challengeZone: 'the-gang/rule-assets/surfaces/challenge-zone',
    toolsZone: 'the-gang/rule-assets/surfaces/tools-zone',
    toolsDiscardZone: 'the-gang/rule-assets/surfaces/tools-discard-zone',
    specialistsZone: 'the-gang/rule-assets/surfaces/specialists-zone',
    specialistsDiscardZone: 'the-gang/rule-assets/surfaces/specialists-discard-zone',
} as const;

const TTS_SETUP_TOGGLE_KEYS = ['omaha', 'twoHand', 'automode', 'antiTroll'] as const;
type TtsSetupToggleKey = typeof TTS_SETUP_TOGGLE_KEYS[number];
const THE_GANG_RULES_DIALOG_Z_INDEX = UI_Z_INDEX.emergencyHud + 10;
const TABLE_REMINDER_CHALLENGES = ['retina-scan', 'fingerprint-scan', 'blackout'] as const;

const rulesConfigSignature = (config: TheGangRulesConfig) =>
    JSON.stringify(normalizeRulesConfig(config));

const CARD_RANK_ASSET_NAMES: Partial<Record<PlayingCard['rank'], string>> = {
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    J: 'jack',
    Q: 'queen',
    K: 'king',
    A: 'ace',
};

const getCardAssetPath = (card: PlayingCard) =>
    `the-gang/cards/${CARD_RANK_ASSET_NAMES[card.rank]}-${card.suit}`;

const hasStandardCardAsset = (card: PlayingCard) =>
    card.suit !== 'gear'
    && card.suit !== 'special'
    && CARD_RANK_ASSET_NAMES[card.rank] !== undefined;

const canEvaluateVisibleHand = (
    handCards: PlayingCard[],
    boardCards: PlayingCard[],
    rulesConfig: TheGangRulesConfig,
) => {
    if (rulesConfig.omaha) {
        return handCards.length >= 2 && boardCards.length >= 3;
    }
    return handCards.length + boardCards.length >= 5;
};

const evaluateVisibleHandRankLabel = (
    handCards: PlayingCard[],
    boardCards: PlayingCard[],
    core: TheGangCore,
) => {
    if (!canEvaluateVisibleHand(handCards, boardCards, core.rules.config)) {
        return undefined;
    }

    return evaluateBestTheGangHand(handCards, boardCards, {
        rulesConfig: core.rules.config,
        blankedRank: core.rules.blankedRank,
    }).strength.label;
};

const BGG_LAYOUT_CONTRACT = {
    source: 'BGG electronic DOM/CSS',
    topZone: 'top_zone / plboard',
    middleZone: 'middle_zone / token_pile / card_river',
    bottomZone: 'bottom_zone / vaults_alarms_zone / hand_groupzone',
};

const DEFAULT_HAND_RANK_RULES = TEXAS_HOLDEM_HAND_RANK_RULES;

const UTILITY_BUTTON_CLASS = [
    'flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-amber-200/35',
    'bg-emerald-950/90 px-2.5 text-xs font-black text-amber-100 shadow-[0_0.25rem_0.9rem_rgba(0,0,0,0.34)] backdrop-blur-sm',
    'transition-[transform,background-color,border-color,color] hover:-translate-y-0.5 hover:border-amber-100/65 hover:bg-emerald-900 hover:text-amber-50',
    'active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100',
    'min-[901px]:h-12 min-[901px]:min-w-[5.75rem] min-[901px]:gap-2 min-[901px]:px-4 min-[901px]:text-sm',
].join(' ');

const UTILITY_ICON_CLASS = 'h-4 w-4 shrink-0 min-[901px]:h-5 min-[901px]:w-5';

type TFunction = ReturnType<typeof useTranslation>['t'];

type CardFaceEmphasis = 'table' | 'river' | 'riverCompact' | 'hand' | 'handDense' | 'handCompact' | 'showdown';
type HandSlot = TheGangHandSlot;
type HandRankHints = Partial<Record<HandSlot, string>>;

interface CurrentChipDisplay {
    key: string;
    chip?: number;
    handSlot?: HandSlot;
    exited?: boolean;
}

type ChipDragOrigin = 'pool' | 'local-hand' | 'player-chip';

interface ChipDragSource {
    origin: ChipDragOrigin;
    chip: number;
    handSlot?: HandSlot;
    playerId?: string;
}

interface ChipDropTarget {
    kind: 'pool' | 'local-hand';
    handSlot?: HandSlot;
}

type ChipDropVisualState = 'available' | 'active';
type ChipDropVisualStates = Partial<Record<HandSlot, ChipDropVisualState>>;

interface ChipDragState extends ChipDragSource {
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    dragging: boolean;
    hoverTarget?: ChipDropTarget;
}

interface RemoteChipDragState {
    playerId: string;
    chip: number;
    round: TheGangRound;
    origin?: ChipDragOrigin;
    handSlot?: HandSlot;
    sourcePlayerId?: string;
    x: number;
    y: number;
    updatedAt: number;
}

interface ViewportPoint {
    x: number;
    y: number;
}

interface ChipTransferAnimation {
    id: number;
    playerId?: string;
    chip: number;
    round: TheGangRound;
    from: ViewportPoint;
    to: ViewportPoint;
    settled: boolean;
}

type ChipDragUiAction = 'move' | 'end' | 'transfer';

interface ChipTransferUiTarget {
    kind: 'pool' | 'hand';
    handSlot?: HandSlot;
}

interface ChipDragUiPayload {
    action: ChipDragUiAction;
    chip?: number;
    round?: TheGangRound;
    x?: number;
    y?: number;
    origin?: ChipDragOrigin;
    handSlot?: HandSlot;
    sourcePlayerId?: string;
    target?: ChipTransferUiTarget;
}

interface ChipDragHandlers {
    onPointerDown?: PointerEventHandler<HTMLElement>;
    onPointerMove?: PointerEventHandler<HTMLElement>;
    onPointerUp?: PointerEventHandler<HTMLElement>;
    onPointerCancel?: PointerEventHandler<HTMLElement>;
}

interface CardDragSource {
    slot: HandSlot;
    index: number;
    card: PlayingCard;
}

interface CardDropTarget {
    slot: HandSlot;
    index: number;
}

interface CardDragState extends CardDragSource {
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    dragging: boolean;
    hoverTarget?: CardDropTarget;
}

interface CardDragHandlers {
    onPointerDown?: PointerEventHandler<HTMLElement>;
    onPointerMove?: PointerEventHandler<HTMLElement>;
    onPointerUp?: PointerEventHandler<HTMLElement>;
    onPointerCancel?: PointerEventHandler<HTMLElement>;
}

type ChipClickEvent = ReactMouseEvent<HTMLElement>;

interface ProgressButtonState {
    approvals: string[];
    hasApproved: boolean;
    label: string;
    status: string;
}

const CHIP_DRAG_THRESHOLD = 4;
const CHIP_DRAG_UI_EVENT = 'the-gang:chip-drag';
const CHIP_DROP_TARGET_SELECTOR = '[data-the-gang-chip-drop-target]';
const CARD_DRAG_THRESHOLD = 4;
const CARD_DROP_TARGET_SELECTOR = '[data-the-gang-card-drop-target]';
const REMOTE_CHIP_DRAG_TTL_MS = 1600;
const CHIP_TRANSFER_ANIMATION_MS = 520;

const normalizeViewportPoint = (clientX: number, clientY: number) => {
    if (typeof window === 'undefined') {
        return { x: 0.5, y: 0.5 };
    }
    return {
        x: Math.min(1, Math.max(0, clientX / Math.max(1, window.innerWidth))),
        y: Math.min(1, Math.max(0, clientY / Math.max(1, window.innerHeight))),
    };
};

const denormalizeViewportPoint = (point: ViewportPoint): ViewportPoint => {
    if (typeof window === 'undefined') {
        return point;
    }
    return {
        x: point.x * window.innerWidth,
        y: point.y * window.innerHeight,
    };
};

const getChipTransferPathMetrics = (animation: ChipTransferAnimation) => {
    const dx = animation.to.x - animation.from.x;
    const dy = animation.to.y - animation.from.y;
    return {
        angleDeg: Math.atan2(dy, dx) * (180 / Math.PI),
        length: Math.max(1, Math.hypot(dx, dy)),
        midX: animation.from.x + (dx * 0.54),
        midY: animation.from.y + (dy * 0.54),
    };
};

const isChipDragUiPayload = (payload: unknown): payload is ChipDragUiPayload => (
    !!payload
    && typeof payload === 'object'
    && !Array.isArray(payload)
    && (
        ((payload as ChipDragUiPayload).action === 'move')
        || ((payload as ChipDragUiPayload).action === 'end')
        || ((payload as ChipDragUiPayload).action === 'transfer')
    )
);

const isTheGangRound = (value: unknown): value is TheGangRound => (
    value === 1 || value === 2 || value === 3 || value === 4
);

const resolveChipDropTarget = (element: Element | null): ChipDropTarget | undefined => {
    const target = element?.closest(CHIP_DROP_TARGET_SELECTOR);
    if (!(target instanceof HTMLElement)) return undefined;
    const kind = target.dataset.theGangChipDropTarget;
    if (kind === 'pool') {
        return { kind };
    }
    if (kind === 'local-hand') {
        const handSlot = target.dataset.theGangChipDropHandSlot;
        return handSlot === 'bottom'
            ? { kind, handSlot: 'bottom' }
            : { kind, handSlot: 'top' };
    }
    return undefined;
};

const resolveCardDropTarget = (element: Element | null): CardDropTarget | undefined => {
    const target = element?.closest(CARD_DROP_TARGET_SELECTOR);
    if (!(target instanceof HTMLElement)) return undefined;
    const slot = target.dataset.theGangCardDropSlot;
    const index = Number(target.dataset.theGangCardDropIndex);
    if ((slot === 'top' || slot === 'bottom') && Number.isInteger(index) && index >= 0) {
        return { slot, index };
    }
    return undefined;
};

const chipDropTargetKey = (target?: ChipDropTarget) => (
    target ? `${target.kind}:${target.handSlot ?? 'single'}` : ''
);

const cardDropTargetKey = (target?: CardDropTarget) => (
    target ? `${target.slot}:${target.index}` : ''
);

const orderOpponentPlayerIdsForLocal = (
    playerIds: readonly string[],
    localPlayerId: string,
) => {
    const localIndex = playerIds.indexOf(localPlayerId);
    if (localIndex < 0) return playerIds.filter((id) => id !== localPlayerId);
    return [
        ...playerIds.slice(localIndex + 1),
        ...playerIds.slice(0, localIndex),
    ];
};

const isChipDragSourceActive = (drag: ChipDragState | null, source: ChipDragSource) => {
    if (!drag?.dragging || drag.origin !== source.origin || drag.chip !== source.chip) return false;
    if (source.origin === 'pool') return true;
    if ((drag.handSlot ?? 'top') !== (source.handSlot ?? 'top')) return false;
    if (source.origin === 'local-hand') return true;
    return drag.playerId === source.playerId;
};

const isRemoteChipDragSourceActive = (drag: RemoteChipDragState, source: ChipDragSource) => {
    if (drag.chip !== source.chip) return false;
    if (source.origin === 'pool') {
        return drag.origin === 'pool';
    }
    if (source.origin !== 'player-chip') {
        return false;
    }
    const dragSourcePlayerId = drag.sourcePlayerId ?? drag.playerId;
    const dragHandSlot = drag.handSlot ?? 'top';
    return (drag.origin === 'local-hand' || drag.origin === 'player-chip')
        && dragSourcePlayerId === source.playerId
        && dragHandSlot === (source.handSlot ?? 'top');
};

const isCardDragSourceActive = (drag: CardDragState | null, source: CardDragSource) => (
    !!drag?.dragging && drag.slot === source.slot && drag.index === source.index
);

const getLocalHandChipDropVisualState = (
    drag: ChipDragState | null,
    handSlot: HandSlot,
    activeTargetKey: string,
): ChipDropVisualState | undefined => {
    if (!drag?.dragging) return undefined;
    if (drag.origin === 'local-hand' && (drag.handSlot ?? 'top') === handSlot) return undefined;
    return activeTargetKey === `local-hand:${handSlot}` ? 'active' : 'available';
};

const getCardDropVisualState = (
    drag: CardDragState | null,
    slot: HandSlot,
    index: number,
    activeTargetKey: string,
): ChipDropVisualState | undefined => {
    if (!drag?.dragging || drag.slot === slot) return undefined;
    return activeTargetKey === `${slot}:${index}` ? 'active' : 'available';
};

const getPoolChipDropVisualState = (
    drag: ChipDragState | null,
    activeTargetKey: string,
): ChipDropVisualState | undefined => {
    if (!drag?.dragging || drag.origin !== 'local-hand') return undefined;
    return activeTargetKey === 'pool:single' ? 'active' : 'available';
};

const getElementViewportCenter = (element: Element | null | undefined): ViewportPoint | undefined => {
    if (!element) return undefined;
    const rect = element.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
};

const resolveChipDropTargetElement = (target?: ChipDropTarget): HTMLElement | null => {
    if (!target || typeof document === 'undefined') return null;
    if (target.kind === 'pool') {
        return document.querySelector<HTMLElement>('[data-the-gang-chip-drop-target="pool"]');
    }
    const handSlot = target.handSlot ?? 'top';
    return document.querySelector<HTMLElement>(
        `[data-the-gang-chip-drop-target="local-hand"][data-the-gang-chip-drop-hand-slot="${handSlot}"]`,
    );
};

const isChipTransferUiTarget = (target: unknown): target is ChipTransferUiTarget => (
    !!target
    && typeof target === 'object'
    && !Array.isArray(target)
    && (
        (target as ChipTransferUiTarget).kind === 'pool'
        || (target as ChipTransferUiTarget).kind === 'hand'
    )
);

const resolveRemoteChipHandElement = (
    playerId: string,
    localPlayerId: string,
    handSlot: HandSlot | undefined,
    twoHand: boolean,
): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    const slot = handSlot ?? 'top';
    if (playerId === localPlayerId) {
        return document.querySelector<HTMLElement>(`[data-testid="the-gang-local-hand-${slot}"]`);
    }
    return document.querySelector<HTMLElement>(
        `[data-testid="the-gang-player-chip-row-${playerId}-${twoHand ? slot : 'single'}"]`,
    )
        ?? document.querySelector<HTMLElement>(`[data-testid="the-gang-player-chip-strip-${playerId}"]`)
        ?? document.querySelector<HTMLElement>(`[data-testid="the-gang-player-board-${playerId}"]`);
};

const resolveChipTransferTargetElement = (
    playerId: string,
    localPlayerId: string,
    target: ChipTransferUiTarget,
    twoHand: boolean,
): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    if (target.kind === 'pool') {
        return document.querySelector<HTMLElement>('[data-the-gang-chip-drop-target="pool"]')
            ?? document.querySelector<HTMLElement>('[data-bgg-zone="token-pile"]');
    }
    return resolveRemoteChipHandElement(playerId, localPlayerId, target.handSlot, twoHand);
};

const resolveChipTransferSourcePoint = (
    playerId: string,
    localPlayerId: string,
    payload: ChipDragUiPayload,
    twoHand: boolean,
): ViewportPoint | undefined => {
    if (typeof document === 'undefined') return undefined;
    const semanticSource = payload.origin === 'local-hand' || payload.origin === 'player-chip'
        ? resolveRemoteChipHandElement(playerId, localPlayerId, payload.handSlot, twoHand)
        : document.querySelector<HTMLElement>('[data-the-gang-chip-drop-target="pool"]')
            ?? document.querySelector<HTMLElement>('[data-bgg-zone="token-pile"]');
    const semanticPoint = getElementViewportCenter(semanticSource);
    if (semanticPoint) return semanticPoint;
    if (typeof payload.x === 'number' && typeof payload.y === 'number') {
        return denormalizeViewportPoint({
            x: Math.min(1, Math.max(0, payload.x)),
            y: Math.min(1, Math.max(0, payload.y)),
        });
    }
    return undefined;
};

function ProgressVoteDots({
    playerIds,
    approvals,
    label,
}: {
    playerIds: string[];
    approvals: string[];
    label: string;
}) {
    return (
        <div
            aria-label={label}
            className="flex items-center justify-center gap-1.5"
            data-testid="the-gang-progress-vote-dots"
        >
            {playerIds.map((playerId) => {
                const approved = approvals.includes(playerId);
                return (
                    <span
                        key={playerId}
                        aria-label={approved ? `${playerId} approved` : `${playerId} pending`}
                        data-approved={approved ? 'true' : 'false'}
                        className={[
                            'h-2.5 w-2.5 rounded-full transition',
                            approved
                                ? 'bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.68)]'
                                : 'bg-white/28 ring-1 ring-white/18',
                        ].join(' ')}
                    />
                );
            })}
        </div>
    );
}

const getProgressButtonState = (
    core: TheGangCore,
    kind: TheGangProgressKind,
    localPlayerId: string,
    baseLabel: string,
    t: TFunction,
): ProgressButtonState => {
    const approvals = core.pendingProgress?.kind === kind ? core.pendingProgress.approvals : [];
    const hasApproved = approvals.includes(localPlayerId);
    return {
        approvals,
        hasApproved,
        label: hasApproved ? t('board.progressWaiting') : baseLabel,
        status: approvals.length > 0
            ? t('board.progressApprovedCount', { approved: approvals.length, total: core.playerIds.length })
            : t('board.progressNeedsAll'),
    };
};

function CardFace({
    card,
    hidden = false,
    emphasis = 'table',
    revealOrder,
    t,
}: {
    card?: PlayingCard;
    hidden?: boolean;
    emphasis?: CardFaceEmphasis;
    revealOrder?: number;
    t: TFunction;
}) {
    const sizeClassByEmphasis: Record<CardFaceEmphasis, string> = {
        table: 'h-14 w-10 md:h-16 md:w-11 lg:h-24 lg:w-[4.25rem] xl:h-28 xl:w-20',
        river: 'h-20 w-14 md:h-24 md:w-16 lg:h-32 lg:w-[5.5rem] xl:h-40 xl:w-28',
        riverCompact: 'h-14 w-10 md:h-16 md:w-11 lg:h-20 lg:w-14 xl:h-20 xl:w-14',
        hand: 'h-20 w-14 md:h-24 md:w-16 lg:h-32 lg:w-[5.5rem] xl:h-40 xl:w-28',
        handDense: 'h-14 w-10 md:h-16 md:w-11 lg:h-20 lg:w-14 xl:h-24 xl:w-[4.25rem]',
        handCompact: 'h-14 w-10 md:h-16 md:w-11 lg:h-20 lg:w-14 xl:h-20 xl:w-14',
        showdown: 'h-16 w-11 md:h-20 md:w-14 lg:h-24 lg:w-[4.25rem] xl:h-28 xl:w-20',
    };
    const sizeClass = sizeClassByEmphasis[emphasis];
    const cardFaceClassName = `the-gang-card-face the-gang-card-face--${emphasis} ${sizeClass}`;

    const revealDelayMs = revealOrder === undefined ? undefined : `${Math.min(revealOrder, 32) * 90}ms`;
    const revealClass = revealOrder === undefined
        ? ''
        : ' motion-safe:animate-[the-gang-card-reveal_520ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none';
    const revealStyle = revealDelayMs === undefined ? undefined : { animationDelay: revealDelayMs };
    const revealProps = revealOrder === undefined
        ? {}
        : {
            'data-bgg-zone': 'reveal-card',
            'data-reveal-order': String(revealOrder),
            style: revealStyle,
        };

    if (hidden || !card) {
        return (
            <div
                className={`${cardFaceClassName} overflow-hidden rounded-md bg-slate-800 shadow-[0.2rem_0.24rem_0_rgba(0,0,0,0.45)] ring-1 ring-black/70${revealClass}`}
                data-the-gang-card-emphasis={emphasis}
                {...revealProps}
            >
                <OptimizedImage
                    src={CARD_BACK_ASSET_PATH}
                    alt={t('board.cardBackAlt')}
                    className="h-full w-full object-cover"
                    draggable={false}
                    placeholder={false}
                />
            </div>
        );
    }

    if (
        card.kind === 'joker'
        || card.kind === 'wild'
        || card.kind === 'blank'
        || card.suit === 'special'
        || !hasStandardCardAsset(card)
    ) {
        const label = formatCard(card);
        return (
            <div
                className={`${cardFaceClassName} flex items-center justify-center overflow-hidden rounded-md border border-amber-200/45 bg-[radial-gradient(circle_at_50%_24%,rgba(251,191,36,0.34),transparent_42%),linear-gradient(160deg,#111827,#312e18)] px-1 text-center text-[0.62rem] font-black tracking-[0.08em] text-amber-100 shadow-[0.2rem_0.24rem_0_rgba(0,0,0,0.45)] ring-1 ring-black/75 lg:text-xs${revealClass}`}
                data-the-gang-card-emphasis={emphasis}
                aria-label={label}
                {...revealProps}
            >
                {label}
            </div>
        );
    }

    return (
        <div
            className={`${cardFaceClassName} overflow-hidden rounded-md bg-white shadow-[0.2rem_0.24rem_0_rgba(0,0,0,0.45)] ring-1 ring-black/75${revealClass}`}
            data-the-gang-card-emphasis={emphasis}
            {...revealProps}
        >
            <OptimizedImage
                src={getCardAssetPath(card)}
                alt={formatCard(card)}
                className="h-full w-full object-cover"
                draggable={false}
                placeholder={false}
            />
        </div>
    );
}

function HandCardRows({
    primaryCards,
    secondaryCards = [],
    emphasis = 'table',
    t,
    testIdPrefix,
    revealOrderBase,
    winningHandSlot,
    showLabels = false,
    singleRowSlot,
    singleRowLabel,
    rankHints,
    canDragSwapCards = false,
    cardDrag,
    cardDropActiveKey = '',
    getCardDragHandlers,
    chipDisplays,
    chipRoundHistory,
    currentRound,
    chipOwnerId,
    chipDropStates,
    chipDropActiveSlot,
    chipDrag,
    canReturnCurrentChip = false,
    onReturnCurrentChip,
    getChipDragHandlers,
}: {
    primaryCards: PlayingCard[];
    secondaryCards?: PlayingCard[];
    emphasis?: CardFaceEmphasis;
    t: TFunction;
    testIdPrefix: string;
    revealOrderBase?: number;
    winningHandSlot?: HandSlot;
    showLabels?: boolean;
    singleRowSlot?: HandSlot;
    singleRowLabel?: string;
    rankHints?: HandRankHints;
    canDragSwapCards?: boolean;
    cardDrag?: CardDragState | null;
    cardDropActiveKey?: string;
    getCardDragHandlers?: (source: CardDragSource) => CardDragHandlers;
    chipDisplays?: CurrentChipDisplay[];
    chipRoundHistory?: TheGangCore['roundHistory'];
    currentRound?: number;
    chipOwnerId?: string;
    chipDropStates?: ChipDropVisualStates;
    chipDropActiveSlot?: HandSlot;
    chipDrag?: ChipDragState | null;
    canReturnCurrentChip?: boolean;
    onReturnCurrentChip?: (handSlot: HandSlot, event?: ChipClickEvent) => void;
    getChipDragHandlers?: (source: ChipDragSource) => ChipDragHandlers;
}) {
    const hasSecondaryRows = secondaryCards.length > 0;
    const rows = [
        {
            slot: hasSecondaryRows ? 'top' as const : singleRowSlot ?? 'top' as const,
            cards: primaryCards,
            label: hasSecondaryRows ? t('board.topHand') : singleRowLabel ?? t('board.singleHand'),
        },
        ...(hasSecondaryRows
            ? [{ slot: 'bottom' as const, cards: secondaryCards, label: t('board.bottomHand') }]
            : []),
    ];
    let revealOffset = 0;

    return (
        <div className="flex flex-col items-center justify-center gap-1.5 lg:gap-2" data-testid={`${testIdPrefix}-rows`}>
            {rows.map((row) => {
                const startOffset = revealOffset;
                revealOffset += row.cards.length;
                const isWinning = winningHandSlot === row.slot;
                const rankHint = rankHints?.[row.slot];
                const translatedRankHint = rankHint
                    ? t('board.handRankForSlot', { slot: row.label, rank: rankHint })
                    : '';
                const visibleRankHint = showLabels
                    ? rankHint
                    : translatedRankHint === 'board.handRankForSlot'
                    ? `${row.label}：${rankHint}`
                    : translatedRankHint;
                const chipDropState = chipDropStates?.[row.slot]
                    ?? (chipDropActiveSlot === row.slot ? 'active' : undefined);
                const chipDropTargetAttrs = chipOwnerId
                    ? {
                        'data-the-gang-chip-drop-target': 'local-hand',
                        'data-the-gang-chip-drop-hand-slot': row.slot,
                        'data-the-gang-chip-drop-state': chipDropState,
                    } as const
                    : {};
                const chipDropTargetClass = chipDropState
                    ? `the-gang-open-drop-target the-gang-open-drop-target--${chipDropState}`
                    : '';
                return (
                    <div
                        key={row.slot}
                        className={[
                            'relative flex items-center justify-center gap-2 overflow-visible rounded-2xl transition-[background-color,box-shadow,outline-color] lg:gap-3 xl:gap-4',
                            chipDropState ? 'the-gang-chip-drop-surface' : '',
                            chipDropTargetClass,
                        ].join(' ')}
                        data-testid={`${testIdPrefix}-${row.slot}`}
                        data-hand-slot={row.slot}
                        data-winning-hand={isWinning ? 'true' : undefined}
                        data-the-gang-drop-range-ui={chipDropState ? 'open-right-gradient' : undefined}
                        {...chipDropTargetAttrs}
                    >
                        {showLabels ? (
                            <span className={[
                                'min-w-10 rounded-full border px-2 py-0.5 text-center text-[0.58rem] font-black tracking-[0.1em]',
                                isWinning
                                    ? 'border-amber-200 bg-amber-300 text-emerald-950'
                                    : 'border-amber-200/24 bg-black/20 text-amber-100/78',
                            ].join(' ')}
                            >
                                {row.label}
                            </span>
                        ) : (
                            <span className="sr-only">{row.label}</span>
                        )}
                        {rankHint ? (
                            <span
                                className="min-w-14 rounded-full border border-emerald-100/35 bg-emerald-950/82 px-2 py-0.5 text-center text-[0.58rem] font-black tracking-[0.06em] text-amber-100 shadow-[0_0.35rem_0.9rem_rgba(0,0,0,0.28)] lg:text-[0.68rem]"
                                data-rank-label={rankHint}
                                data-testid={`${testIdPrefix}-${row.slot}-rank`}
                            >
                                {visibleRankHint}
                            </span>
                        ) : null}
                        <div
                            className="relative flex items-center justify-center gap-2 overflow-visible rounded-xl md:gap-3"
                            data-testid={`${testIdPrefix}-${row.slot}-cards`}
                        >
                            {chipOwnerId && chipRoundHistory && currentRound !== undefined ? (
                                <HandChipRail
                                    roundHistory={chipRoundHistory}
                                    currentRound={currentRound}
                                    currentChips={chipDisplays ?? []}
                                    playerId={chipOwnerId}
                                    handSlot={row.slot}
                                    variant="attached"
                                    attachedPlacement={hasSecondaryRows ? 'right' : 'above'}
                                    canReturnCurrentChip={canReturnCurrentChip}
                                    onReturnCurrentChip={onReturnCurrentChip}
                                    getChipDragHandlers={getChipDragHandlers}
                                    chipDrag={chipDrag}
                                    testId={`${testIdPrefix}-${row.slot}-chip-rail`}
                                />
                            ) : null}
                            {row.cards.map((card, index) => {
                                const dragSource = { slot: row.slot, index, card };
                                const cardDropState = canDragSwapCards
                                    ? getCardDropVisualState(cardDrag ?? null, row.slot, index, cardDropActiveKey)
                                    : undefined;
                                const hiddenWhileDragging = canDragSwapCards
                                    && isCardDragSourceActive(cardDrag ?? null, dragSource);
                                const cardDropTargetClass = cardDropState
                                    ? `the-gang-open-drop-target the-gang-open-drop-target--${cardDropState}`
                                    : '';
                                const cardFace = (
                                    <CardFace
                                        card={card}
                                        emphasis={emphasis}
                                        revealOrder={revealOrderBase === undefined ? undefined : revealOrderBase + startOffset + index}
                                        t={t}
                                    />
                                );
                                if (!canDragSwapCards || !getCardDragHandlers) {
                                    return (
                                        <div key={`${row.slot}-${card.rank}-${card.suit}-${index}`}>
                                            {cardFace}
                                        </div>
                                    );
                                }
                                return (
                                    <button
                                        key={`${row.slot}-${card.rank}-${card.suit}-${index}`}
                                        type="button"
                                        aria-label={t('board.dragSwapCardLabel', {
                                            slot: row.label,
                                            index: index + 1,
                                            card: formatCard(card),
                                        })}
                                        className={[
                                            'relative overflow-visible rounded-lg p-0.5 transition-[background-color,box-shadow,opacity,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 touch-none',
                                            hiddenWhileDragging ? 'opacity-0' : '',
                                            cardDropTargetClass,
                                            cardDropState
                                                ? ''
                                                : 'hover:-translate-y-1 hover:bg-emerald-300/10 hover:ring-2 hover:ring-emerald-200/58',
                                            !hiddenWhileDragging ? 'cursor-grab active:cursor-grabbing' : '',
                                        ].join(' ')}
                                        data-testid={`${testIdPrefix}-${row.slot}-card-${index}`}
                                        data-the-gang-card-drop-target="hand-card"
                                        data-the-gang-card-drop-slot={row.slot}
                                        data-the-gang-card-drop-index={index}
                                        data-the-gang-card-drop-state={cardDropState}
                                        data-the-gang-drop-range-ui={cardDropState ? 'open-right-gradient' : undefined}
                                        data-drag-source-hidden={hiddenWhileDragging ? 'true' : undefined}
                                        draggable={false}
                                        {...getCardDragHandlers(dragSource)}
                                    >
                                        {cardFace}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function LayoutContractBadge() {
    const { t } = useTranslation('game-the-gang');

    return (
        <span className="sr-only" data-testid="the-gang-layout-contract">
            {t('board.layoutContract')}
        </span>
    );
}

function TableReminderBadges({ config }: { config: TheGangRulesConfig }) {
    const reminders = TABLE_REMINDER_CHALLENGES.filter((challengeId) => isChallengeActive(config, challengeId));
    if (reminders.length === 0) return null;

    return (
        <div className="flex flex-wrap justify-end gap-1.5" data-testid="the-gang-table-reminders" data-bgg-zone="table-reminders">
            {reminders.map((challengeId) => (
                <span
                    key={challengeId}
                    className="rounded-full border border-amber-200/28 bg-black/24 px-2 py-0.5 text-[0.62rem] font-black tracking-[0.08em] text-amber-100/88"
                    title={THE_GANG_CHALLENGES[challengeId].summary}
                >
                    {THE_GANG_CHALLENGES[challengeId].label}
                </span>
            ))}
        </div>
    );
}

function HandRankReference({ rules = DEFAULT_HAND_RANK_RULES }: { rules?: readonly PokerHandRankRule[] }) {
    const { t } = useTranslation('game-the-gang');
    const orderedRules = [...rules].sort((left, right) => left.category - right.category);

    return (
        <details
            className="pointer-events-auto group relative z-30 text-xs font-black text-amber-50/94 lg:text-sm"
            data-tutorial-id="the-gang-hand-rank-reference"
            data-bgg-zone="hand-rank-reference"
        >
            <summary className={`${UTILITY_BUTTON_CLASS} list-none marker:hidden group-open:border-amber-100 group-open:bg-amber-200 group-open:text-emerald-950 [&::-webkit-details-marker]:hidden`} aria-label={t('board.handRankReferenceAria')}>
                <ListOrdered aria-hidden="true" className={UTILITY_ICON_CLASS} strokeWidth={2.25} />
                <span className="hidden sm:inline">{t('board.handRankReference')}</span>
            </summary>
            <div className="absolute bottom-full left-0 mb-2 w-[20rem] max-w-[calc(100vw-1rem)] rounded-lg bg-emerald-950/94 p-2 shadow-[0_0.35rem_1.2rem_rgba(0,0,0,0.42)] ring-1 ring-amber-200/28">
                <div className="mb-1 flex items-center justify-between gap-3 text-[0.58rem] tracking-[0.12em] text-amber-200/72 lg:text-[0.66rem]">
                    <span>{t('board.handRankWeak')}</span>
                    <span>{t('board.handRankStrong')}</span>
                </div>
                <ol className="grid grid-cols-2 gap-x-4 gap-y-0.5" aria-label={t('board.handRankListAria')}>
                    {orderedRules.map((rule, index) => (
                        <li key={rule.category} className="flex items-center gap-1.5 whitespace-nowrap rounded-sm px-1 py-0.5 leading-tight odd:bg-amber-50/[0.04]">
                            <span className="w-3 text-right text-amber-200/70 tabular-nums">{index + 1}</span>
                            <span className="text-amber-50">{rule.label}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </details>
    );
}

function RulesConfigPanel({
    config,
    restartOnChange,
    canConfigure,
    playerCount,
    onChange,
    onBlockedEdit,
}: {
    config: TheGangRulesConfig;
    restartOnChange: boolean;
    canConfigure: boolean;
    playerCount: number;
    onChange: (config: TheGangRulesConfig) => void;
    onBlockedEdit: () => void;
}) {
    const { t } = useTranslation('game-the-gang');
    const [isOpen, setIsOpen] = useState(false);
    const [draftConfig, setDraftConfig] = useState<TheGangRulesConfig>(() => normalizeRulesConfig(config));
    const [showRestartConfirm, setShowRestartConfirm] = useState(false);
    const normalized = normalizeRulesConfig(config);
    const draft = normalizeRulesConfig(draftConfig);
    const hasPendingChanges = rulesConfigSignature(draft) !== rulesConfigSignature(normalized);
    const activeLabels = getActiveChallengeLabels(draft);
    const challengeIds = Object.keys(THE_GANG_CHALLENGES)
        .filter((challengeId) => THE_GANG_CHALLENGES[challengeId as TheGangChallengeId].runtimeStatus === 'implemented') as TheGangChallengeId[];
    const rulesDialogHint = !canConfigure
        ? 'board.rulesDialogGuestHint'
        : restartOnChange ? 'board.rulesDialogRestartHostHint' : 'board.rulesDialogHostHint';

    const updateMode = (gameMode: TheGangGameMode) => {
        setDraftConfig((current) => normalizeRulesConfig({ ...current, gameMode }));
    };

    const updateExitChipMode = (exitChipMode: TheGangExitChipMode) => {
        setDraftConfig((current) => normalizeRulesConfig({ ...current, exitChipMode }));
    };

    const toggleSetupOption = (option: TtsSetupToggleKey) => {
        setDraftConfig((current) => {
            const currentDraft = normalizeRulesConfig(current);
            return normalizeRulesConfig({ ...currentDraft, [option]: !currentDraft[option] });
        });
    };

    const toggleChallenge = (challengeId: TheGangChallengeId) => {
        setDraftConfig((currentConfig) => {
            const currentDraft = normalizeRulesConfig(currentConfig);
            const current = currentDraft.challenges[challengeId] ?? 0;
            return normalizeRulesConfig({
                ...currentDraft,
                challenges: {
                    ...currentDraft.challenges,
                    [challengeId]: current > 0 ? 0 : 1,
                },
            });
        });
    };

    const canEdit = canConfigure;

    const tryEdit = (action: () => void) => {
        if (!canEdit) {
            onBlockedEdit();
            return;
        }
        action();
    };

    const openDialog = () => {
        setDraftConfig(normalized);
        setShowRestartConfirm(false);
        setIsOpen(true);
    };

    const closeDialog = () => {
        setShowRestartConfirm(false);
        setIsOpen(false);
        setDraftConfig(normalized);
    };

    const applyDraftConfig = () => {
        if (!canEdit) {
            onBlockedEdit();
            return;
        }
        if (!hasPendingChanges) {
            closeDialog();
            return;
        }
        if (restartOnChange) {
            setShowRestartConfirm(true);
            return;
        }
        onChange(draft);
        closeDialog();
    };

    const confirmRestartAndApply = () => {
        onChange(draft);
        closeDialog();
    };

    return (
        <div
            className="pointer-events-auto relative z-50 max-w-[22rem] text-xs font-black text-amber-50/94 lg:text-sm"
            data-bgg-zone="rules-config"
            data-testid="the-gang-rules-config"
        >
            <button
                type="button"
                onClick={openDialog}
                className={UTILITY_BUTTON_CLASS}
                aria-label={t('board.rulesConfig')}
                aria-haspopup="dialog"
            >
                <SlidersHorizontal aria-hidden="true" className={UTILITY_ICON_CLASS} strokeWidth={2.25} />
                <span className="hidden sm:inline">{t('board.rulesConfig')}</span>
            </button>
            {isOpen && (
                <HudPortal>
                    <div
                        className="fixed inset-0 flex items-center justify-center bg-black/62 px-2 py-2 backdrop-blur-sm min-[901px]:px-4 min-[901px]:py-5"
                        data-testid="the-gang-rules-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('board.rulesDialogTitle')}
                        style={{ zIndex: THE_GANG_RULES_DIALOG_Z_INDEX }}
                    >
                    <div
                        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-amber-200/30 bg-[#102319] text-amber-50 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.62)] min-[901px]:max-h-[88vh] min-[901px]:rounded-2xl"
                        data-testid="the-gang-rules-modal-panel"
                    >
                        <header
                            className="flex shrink-0 items-start justify-between gap-3 border-b border-amber-200/18 bg-[radial-gradient(circle_at_18%_0%,rgba(245,214,132,0.16),transparent_32%),linear-gradient(135deg,rgba(16,35,25,0.96),rgba(6,14,10,0.98))] px-3 py-2.5 min-[901px]:gap-4 min-[901px]:px-5 min-[901px]:py-4 lg:px-7"
                            data-testid="the-gang-rules-modal-header"
                        >
                            <div className="min-w-0">
                                <div className="text-[0.68rem] uppercase tracking-[0.24em] text-amber-200/72">
                                    {t('board.rulesDialogEyebrow')}
                                </div>
                                <h2 className="mt-0.5 text-base font-black tracking-[0.12em] text-amber-100 min-[901px]:mt-1 min-[901px]:text-xl lg:text-2xl">
                                    {t('board.rulesDialogTitle')}
                                </h2>
                                <p className="mt-1 max-w-3xl text-[0.68rem] font-bold leading-snug text-amber-50/72 min-[901px]:mt-2 min-[901px]:text-xs min-[901px]:leading-relaxed lg:text-sm">
                                    {t(rulesDialogHint)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeDialog}
                                className="inline-flex h-11 min-h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-black/24 text-2xl leading-none text-amber-100 transition hover:bg-amber-200 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                                aria-label={t('board.closeRulesDialog')}
                                data-testid="the-gang-rules-modal-close"
                            >
                                ×
                            </button>
                        </header>
                        <div
                            className="min-h-0 flex-1 overflow-y-auto px-3 py-3 min-[901px]:px-5 min-[901px]:py-4 lg:px-7 lg:py-5"
                            data-testid="the-gang-rules-modal-scroll"
                        >
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-[0.68rem] font-black tracking-[0.08em] text-amber-100">
                                    {t('board.activeGameMode', { mode: THE_GANG_GAME_MODES[draft.gameMode].label })}
                                </span>
                                <span className="inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-[0.68rem] font-black tracking-[0.08em] text-amber-100">
                                    {t('board.activeExitChipMode', { mode: THE_GANG_EXIT_CHIP_MODES[draft.exitChipMode].label })}
                                </span>
                            </div>
                            {restartOnChange && canConfigure && (
                                <div className="mb-4 rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs font-bold leading-relaxed text-amber-100/88">
                                    {t('board.rulesRestartNotice')}
                                </div>
                            )}
                            <section className="grid gap-3 lg:grid-cols-3" aria-label={t('board.gameMode')}>
                                {(Object.keys(THE_GANG_GAME_MODES) as TheGangGameMode[]).map((modeId) => {
                                    const mode = THE_GANG_GAME_MODES[modeId];
                                    const active = draft.gameMode === modeId;
                                    return (
                                        <button
                                            key={modeId}
                                            type="button"
                                            aria-disabled={!canEdit}
                                            onClick={() => tryEdit(() => updateMode(modeId))}
                                            aria-pressed={active}
                                            className={[
                                                'relative min-h-[7rem] rounded-xl border p-4 text-left transition',
                                                canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                                                active
                                                    ? 'border-amber-200 bg-emerald-900/78 text-amber-50 shadow-[0_0_1.5rem_rgba(245,214,132,0.20)] ring-2 ring-amber-200/80'
                                                    : 'border-amber-200/22 bg-black/20 text-amber-50 hover:border-amber-200/55 hover:bg-emerald-900/55',
                                            ].join(' ')}
                                            data-state={active ? 'selected' : 'idle'}
                                            data-testid={`the-gang-mode-${modeId}`}
                                        >
                                            {active && (
                                                <span className="absolute right-3 top-3 rounded-full bg-emerald-950 px-2 py-0.5 text-[0.58rem] font-black tracking-[0.12em] text-amber-100">
                                                    {t('board.rulesSelected')}
                                                </span>
                                            )}
                                            <span className="block text-base font-black tracking-[0.08em]">{mode.label}</span>
                                            <span className="mt-2 block text-[0.68rem] font-bold leading-relaxed opacity-78 lg:text-xs">
                                                {t(`board.gameModeDescriptions.${modeId}`)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </section>

                            <section className="mt-5 rounded-xl border border-amber-200/18 bg-black/16 p-3 lg:p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-black tracking-[0.14em] text-amber-100 lg:text-base">
                                        {t('board.ttsSetupOptions')}
                                    </h3>
                                    <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[0.62rem] text-amber-100/76">
                                        {t('board.ttsSetupOptionsSource')}
                                    </span>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                    {TTS_SETUP_TOGGLE_KEYS.map((option) => {
                                        const active = draft[option];
                                        const twoHandUnavailable = draft.gameMode !== 'texas-holdem' || playerCount > 5;
                                        const disabledByRule = option === 'twoHand' && twoHandUnavailable;
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                disabled={disabledByRule}
                                                aria-disabled={!canEdit || disabledByRule}
                                                onClick={() => tryEdit(() => toggleSetupOption(option))}
                                                aria-pressed={active}
                                                className={[
                                                    'relative min-h-[5.8rem] rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55',
                                                    canEdit && !disabledByRule ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                                                    active
                                                        ? 'border-amber-200 bg-emerald-900/78 text-amber-50 shadow-[0_0_1.2rem_rgba(245,214,132,0.18)] ring-2 ring-amber-200/70'
                                                        : 'border-amber-200/22 bg-black/20 text-amber-50 hover:border-amber-200/55 hover:bg-emerald-900/55',
                                                ].join(' ')}
                                                data-state={active ? 'selected' : 'idle'}
                                                data-testid={`the-gang-rule-toggle-${option}`}
                                            >
                                                <span className="block text-sm font-black tracking-[0.08em]">
                                                    {t(active ? 'board.ttsSetupOptionSelectedPrefix' : 'board.ttsSetupOptionIdlePrefix')}
                                                    {t(`board.ttsSetupOptionLabels.${option}`)}
                                                </span>
                                                <span className="mt-2 block text-[0.66rem] font-bold leading-relaxed opacity-78 lg:text-xs">
                                                    {t(`board.ttsSetupOptionDescriptions.${option}`)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="mt-5 rounded-xl border border-amber-200/18 bg-black/16 p-3 lg:p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-black tracking-[0.14em] text-amber-100 lg:text-base">
                                        {t('board.exitChipMode')}
                                    </h3>
                                    <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[0.62rem] text-amber-100/76">
                                        {t(`board.exitChipModeSummaries.${draft.exitChipMode}`)}
                                    </span>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    {(Object.keys(THE_GANG_EXIT_CHIP_MODES) as TheGangExitChipMode[]).map((modeId) => {
                                        const mode = THE_GANG_EXIT_CHIP_MODES[modeId];
                                        const active = draft.exitChipMode === modeId;
                                        return (
                                            <button
                                                key={modeId}
                                                type="button"
                                                aria-disabled={!canEdit}
                                                onClick={() => tryEdit(() => updateExitChipMode(modeId))}
                                                aria-pressed={active}
                                                className={[
                                                    'relative min-h-[5.8rem] rounded-xl border p-3 text-left transition',
                                                    canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                                                    active
                                                        ? 'border-amber-200 bg-emerald-900/78 text-amber-50 shadow-[0_0_1.2rem_rgba(245,214,132,0.18)] ring-2 ring-amber-200/70'
                                                        : 'border-amber-200/22 bg-black/20 text-amber-50 hover:border-amber-200/55 hover:bg-emerald-900/55',
                                                ].join(' ')}
                                                data-state={active ? 'selected' : 'idle'}
                                                data-testid={`the-gang-exit-mode-${modeId}`}
                                            >
                                                {active && (
                                                    <span className="absolute right-3 top-3 rounded-full bg-emerald-950 px-2 py-0.5 text-[0.58rem] font-black tracking-[0.12em] text-amber-100">
                                                        {t('board.rulesSelected')}
                                                    </span>
                                                )}
                                                <span className="block text-sm font-black tracking-[0.08em]">{mode.label}</span>
                                                <span className="mt-2 block text-[0.66rem] font-bold leading-relaxed opacity-78 lg:text-xs">
                                                    {t(`board.exitChipModeDescriptions.${modeId}`)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="mt-5 rounded-xl border border-amber-200/18 bg-black/16 p-3 lg:p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-black tracking-[0.14em] text-amber-100 lg:text-base">
                                        {t('board.challengeSettings')}
                                    </h3>
                                    <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[0.62rem] text-amber-100/76">
                                        {activeLabels.length > 0 ? activeLabels.join(' / ') : t('board.noChallenges')}
                                    </span>
                                </div>
                                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                                    {challengeIds.map((challengeId) => {
                                        const challenge = THE_GANG_CHALLENGES[challengeId];
                                        const active = isChallengeActive(draft, challengeId);
                                        return (
                                            <button
                                                key={challengeId}
                                                type="button"
                                                aria-disabled={!canEdit}
                                                onClick={() => tryEdit(() => toggleChallenge(challengeId))}
                                                aria-pressed={active}
                                                className={[
                                                    'group relative overflow-hidden rounded-xl border bg-black/28 p-1.5 text-left transition-[transform,background-color,border-color,box-shadow,filter,opacity]',
                                                    canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                                                    active
                                                        ? 'z-10 scale-[1.015] border-amber-100 shadow-[0_0_0_0.16rem_rgba(6,14,10,0.96),0_0_0_0.42rem_rgba(251,191,36,0.88),0_0_1.6rem_rgba(251,191,36,0.72)]'
                                                        : 'border-amber-200/14 opacity-78 saturate-[0.78] hover:border-amber-200/70 hover:opacity-100 hover:saturate-100 hover:shadow-[0_0.55rem_1.25rem_rgba(0,0,0,0.36)]',
                                                ].join(' ')}
                                                data-state={active ? 'selected' : 'idle'}
                                                data-testid={`the-gang-challenge-${challengeId}`}
                                                style={active
                                                    ? {
                                                        backgroundColor: 'rgba(252, 211, 77, 0.16)',
                                                        borderColor: 'rgb(254, 243, 199)',
                                                    }
                                                    : undefined}
                                            >
                                                <OptimizedImage
                                                    src={getChallengeAssetPath(challengeId)}
                                                    alt={challenge.label}
                                                    className={[
                                                        'aspect-[3/4] w-full rounded-lg bg-stone-950 object-contain transition',
                                                        active ? 'brightness-[1.15] saturate-[1.25]' : 'group-hover:brightness-110',
                                                    ].join(' ')}
                                                    draggable={false}
                                                />
                                                {active && (
                                                    <>
                                                        <span
                                                            aria-hidden="true"
                                                            className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_0_0.12rem_rgba(6,78,59,0.92),0_0_1.4rem_rgba(251,191,36,0.95)]"
                                                            data-testid={`the-gang-challenge-${challengeId}-selected-frame`}
                                                            style={{
                                                                borderColor: 'rgb(254, 243, 199)',
                                                                borderStyle: 'solid',
                                                                borderWidth: '4px',
                                                            }}
                                                        />
                                                        <span
                                                            className="absolute left-2 top-2 rounded-md border border-amber-50/80 bg-amber-300 px-2.5 py-1 text-[0.62rem] font-black tracking-[0.14em] text-emerald-950 shadow-[0_0.45rem_1rem_rgba(0,0,0,0.45)]"
                                                            data-testid={`the-gang-challenge-${challengeId}-selected-badge`}
                                                        >
                                                            {t('board.challengeEnabled')}
                                                        </span>
                                                    </>
                                                )}
                                                <span className="sr-only">{challenge.summary}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-amber-200/18 bg-black/20 px-5 py-3 lg:px-7">
                            <div className="text-[0.68rem] font-black tracking-[0.08em] text-amber-100/72">
                                {t('board.rulesDialogSource')}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeDialog}
                                    className="min-h-11 rounded-full border border-amber-200/35 bg-black/20 px-5 py-2 text-sm font-black text-amber-100 transition hover:border-amber-100 hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                                    data-testid="the-gang-cancel-rules-config"
                                >
                                    {t('board.cancelRulesDialog')}
                                </button>
                                <button
                                    type="button"
                                    onClick={applyDraftConfig}
                                    className="min-h-11 rounded-full border border-amber-200/55 bg-amber-300 px-5 py-2 text-sm font-black text-emerald-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                                    data-testid="the-gang-apply-rules-config"
                                >
                                    {t('board.applyRulesDialog')}
                                </button>
                            </div>
                        </footer>
                    </div>
                    {showRestartConfirm && (
                        <ConfirmModal
                            title={t('board.rulesRestartConfirmTitle')}
                            description={t('board.confirmRulesRestart')}
                            confirmText={t('board.applyRulesRestart')}
                            cancelText={t('board.cancelRulesRestart')}
                            onConfirm={confirmRestartAndApply}
                            onCancel={() => setShowRestartConfirm(false)}
                            closeOnBackdrop
                            tone="warm"
                            overlayClassName="bg-black/58 backdrop-blur-sm"
                            panelClassName="max-w-[23rem] rounded-2xl border border-amber-200/45 bg-emerald-950/96 p-5 text-center font-sans text-amber-50 shadow-[0_1.5rem_3.5rem_rgba(0,0,0,0.62),0_0_0_1px_rgba(251,191,36,0.18)]"
                            titleClassName="mb-2 text-sm font-black tracking-[0.14em] text-amber-100"
                            descriptionClassName="mb-5 text-sm font-bold leading-relaxed text-amber-50/88"
                            actionsClassName="flex flex-row items-center justify-center gap-3"
                            cancelClassName="min-h-11 rounded-full border border-amber-200/35 bg-black/24 px-4 py-2 text-sm font-black text-amber-100 transition hover:border-amber-100 hover:bg-emerald-900"
                            confirmClassName="min-h-11 rounded-full border border-amber-200/65 bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950 shadow-[0_0.75rem_1.4rem_rgba(245,158,11,0.28)] transition hover:bg-amber-200"
                        />
                    )}
                    </div>
                </HudPortal>
            )}
        </div>
    );
}

function ToolCardBadge({
    tool,
    active = false,
    onUse,
    actionLabel,
}: {
    tool: TheGangToolId;
    active?: boolean;
    onUse?: (tool: TheGangToolId) => void;
    actionLabel?: string;
}) {
    const { t } = useTranslation('game-the-gang');
    const rule = THE_GANG_TOOLS[tool];
    const implemented = rule.runtimeStatus === 'implemented';
    const canUse = implemented && !active && !!onUse;
    const statusLabel = active
        ? t('board.toolActiveBadge')
        : (implemented ? t('board.toolUsableBadge') : t('board.toolDrawOnlyBadge'));
    const className = [
        'group relative block w-full max-w-[9.5rem] rounded-lg border bg-transparent p-0 shadow-[0_0.55rem_1.25rem_rgba(0,0,0,0.34)] transition',
        active
            ? 'border-emerald-200/80 shadow-[0_0_0_0.15rem_rgba(110,231,183,0.3),0_0.55rem_1.25rem_rgba(0,0,0,0.36)]'
            : implemented ? 'border-amber-200/34' : 'border-stone-400/28 grayscale-[0.25]',
        canUse ? 'hover:border-amber-100 hover:brightness-110' : 'cursor-default',
    ].join(' ');
    const content = (
        <>
            <OptimizedImage
                src={getToolAssetPath(tool)}
                alt={rule.label}
                className="aspect-[3/4] w-full min-w-[7.5rem] rounded-lg object-contain brightness-110 contrast-110"
                data-testid={`the-gang-tool-card-image-${tool}`}
                draggable={false}
                placeholder={false}
            />
            <span className="absolute bottom-1 left-1 right-1 rounded bg-black/78 px-1.5 py-1 text-center text-[0.58rem] font-black tracking-[0.08em] text-amber-50 ring-1 ring-white/10">
                {statusLabel}
            </span>
            <span className="sr-only">{active ? t('board.toolActiveBadge') : t('board.toolBadge')}</span>
            <span className="sr-only">{rule.summary}</span>
        </>
    );

    if (!canUse) {
        return (
            <span className={className} title={rule.summary}>
                {content}
            </span>
        );
    }

    return (
        <button
            type="button"
            className={className}
            onClick={() => onUse(tool)}
            title={rule.summary}
            aria-label={`${rule.label}，${actionLabel ?? t('board.useTool')}`}
        >
            {content}
        </button>
    );
}

function NightVisionCardPicker({
    cards,
    onSelect,
    onCancel,
}: {
    cards: PlayingCard[];
    onSelect: (cardIndex: number) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation('game-the-gang');

    return (
        <section
            className="mb-3 rounded-lg border border-amber-200/28 bg-amber-200/10 p-3"
            data-testid="the-gang-night-vision-picker"
            aria-label={t('board.nightVisionPickerTitle')}
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-black tracking-[0.12em] text-amber-100">
                        {t('board.nightVisionPickerTitle')}
                    </h3>
                    <p className="mt-1 text-[0.68rem] font-bold leading-relaxed text-amber-50/72">
                        {t('board.nightVisionPickerHint')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-full border border-amber-100/32 bg-black/24 px-3 py-1.5 text-[0.68rem] font-black text-amber-100 transition hover:border-amber-100/70 hover:bg-emerald-900"
                >
                    {t('board.cancelNightVisionPicker')}
                </button>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
                {cards.map((card, index) => (
                    <button
                        key={`${card.rank}-${card.suit}-${index}`}
                        type="button"
                        onClick={() => onSelect(index)}
                        className="rounded-lg border border-amber-200/38 bg-black/18 p-2 transition hover:border-amber-100 hover:bg-emerald-900/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                        aria-label={t('board.chooseNightVisionCard', { card: formatCard(card), index: index + 1 })}
                    >
                        <CardFace card={card} emphasis="showdown" t={t} />
                    </button>
                ))}
            </div>
        </section>
    );
}

function SpecialistCardBadge({ specialist }: { specialist: TheGangSpecialistId }) {
    const rule = THE_GANG_SPECIALISTS[specialist];
    return (
        <span
            className="relative block w-full max-w-[9.5rem] rounded-lg border border-sky-200/34 bg-transparent p-0 shadow-[0_0.55rem_1.25rem_rgba(0,0,0,0.34)]"
            title={rule.summary}
        >
            <OptimizedImage
                src={getSpecialistAssetPath(specialist)}
                alt={rule.label}
                className="aspect-[3/4] w-full min-w-[7.5rem] rounded-lg object-contain brightness-110 contrast-110"
                data-testid={`the-gang-specialist-card-image-${specialist}`}
                draggable={false}
                placeholder={false}
            />
            <span className="sr-only">{rule.summary}</span>
        </span>
    );
}

function ToolsPanel({
    core,
    localPlayerId,
    canConfigure,
    onDealTools,
    onResetTools,
    onResetSpecialists,
    onUseTool,
    onBlockedHostAction,
    onToolsAlreadyDealt,
}: {
    core: TheGangCore;
    localPlayerId: string;
    canConfigure: boolean;
    onDealTools: () => void;
    onResetTools: () => void;
    onResetSpecialists: () => void;
    onUseTool: (tool: TheGangToolId, cardIndex?: number) => void;
    onBlockedHostAction: () => void;
    onToolsAlreadyDealt: () => void;
}) {
    const { t } = useTranslation('game-the-gang');
    const [isOpen, setIsOpen] = useState(false);
    const [nightVisionPickerOpen, setNightVisionPickerOpen] = useState(false);
    const localPlayer = core.players[localPlayerId];
    const toolsDealt = core.playerIds.some((id) => core.players[id].toolCards.length > 0);
    const activeToolLabels = localPlayer.activeTools.map((tool) => THE_GANG_TOOLS[tool].label);
    const localToolCount = localPlayer.toolCards.length;
    const localSpecialistCount = localPlayer.specialistCards.length;
    const canDealTools = canConfigure && !toolsDealt && core.toolDeck.length >= core.playerIds.length;

    const handleDealTools = () => {
        if (!canConfigure) {
            onBlockedHostAction();
            return;
        }
        if (toolsDealt) {
            onToolsAlreadyDealt();
            return;
        }
        onDealTools();
    };

    const handleResetTools = () => {
        if (!canConfigure) {
            onBlockedHostAction();
            return;
        }
        onResetTools();
    };

    const handleResetSpecialists = () => {
        if (!canConfigure) {
            onBlockedHostAction();
            return;
        }
        onResetSpecialists();
    };

    const handleUseTool = (tool: TheGangToolId) => {
        if (tool === 'night-vision-goggles') {
            setNightVisionPickerOpen(true);
            return;
        }
        onUseTool(tool);
    };

    return (
        <div
            className="pointer-events-auto relative z-50 text-xs font-black text-amber-50/94 lg:text-sm"
            data-bgg-zone="tools-panel"
            data-testid="the-gang-tools-panel"
        >
            <button
                type="button"
                aria-expanded={isOpen}
                aria-label={t('board.toolPanelSummary', { tools: localToolCount, specialists: localSpecialistCount })}
                aria-haspopup="dialog"
                onClick={() => setIsOpen(true)}
                className={UTILITY_BUTTON_CLASS}
            >
                <Wrench aria-hidden="true" className={UTILITY_ICON_CLASS} strokeWidth={2.25} />
                <span className="hidden sm:inline">{t('board.toolsPanel')}</span>
                <span aria-hidden="true" className="hidden rounded bg-black/24 px-1.5 py-0.5 text-[0.62rem] tabular-nums text-amber-100/88 lg:inline-flex">
                    {localToolCount}/{localSpecialistCount}
                </span>
                <span className="sr-only">
                    {t('board.toolPanelSummary', { tools: localToolCount, specialists: localSpecialistCount })}
                </span>
            </button>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/62 px-2 py-2 backdrop-blur-sm min-[901px]:px-5 min-[901px]:py-4"
                    data-testid="the-gang-tools-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('board.toolsPanel')}
                >
                    <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-amber-200/30 bg-[#102319] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.62)] min-[901px]:max-h-[90dvh]">
                        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200/18 bg-black/18 px-3 py-2.5 min-[901px]:gap-4 min-[901px]:px-5 min-[901px]:py-3">
                            <div className="min-w-0">
                                <h2 className="text-base font-black text-amber-100 min-[901px]:text-xl">{t('board.toolsPanel')}</h2>
                                <div className="truncate text-[0.68rem] text-amber-100/72">
                                    {t('board.toolPanelSummary', { tools: localToolCount, specialists: localSpecialistCount })}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-black/24 text-amber-100 transition hover:bg-amber-200 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                                aria-label={t('board.closeToolsPanel')}
                            >
                                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                            </button>
                        </header>
                        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 min-[901px]:gap-4 min-[901px]:p-4 lg:p-5">
                            <section className="min-w-0 rounded-lg border border-amber-200/16 bg-black/12 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                            <div className="text-[0.58rem] uppercase tracking-[0.18em] text-amber-200/62">{t('board.toolsPanel')}</div>
                            <div className="text-amber-100">{t('board.toolDeck', { count: core.toolDeck.length })}</div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                            <button
                                type="button"
                                aria-disabled={!canDealTools}
                                onClick={handleDealTools}
                                className={[
                                    'rounded-full border px-2.5 py-1 text-[0.62rem] font-black transition',
                                    canDealTools
                                        ? 'cursor-pointer border-amber-200/55 bg-amber-300 text-emerald-950 hover:bg-amber-200'
                                        : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400',
                                ].join(' ')}
                            >
                                {toolsDealt ? t('board.toolsDealt') : t('board.dealTools')}
                            </button>
                            <button
                                type="button"
                                aria-disabled={!canConfigure}
                                onClick={handleResetTools}
                                className={[
                                    'rounded-full border px-2.5 py-1 text-[0.62rem] font-black transition',
                                    canConfigure
                                        ? 'cursor-pointer border-amber-100/32 bg-emerald-900/82 text-amber-100 hover:border-amber-100/70 hover:bg-emerald-800'
                                        : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400',
                                ].join(' ')}
                            >
                                {t('board.resetTools')}
                            </button>
                        </div>
                    </div>
                    <div className="mb-2 rounded-md bg-black/18 px-2 py-1 text-amber-100">
                        {activeToolLabels.length > 0
                            ? t('board.activeTools', { tools: activeToolLabels.join(' / ') })
                            : t('board.noActiveTools')}
                    </div>
                    <div className="mb-3 rounded-md border border-amber-200/16 bg-black/16 px-2 py-1.5 text-[0.68rem] font-bold leading-relaxed text-amber-50/72" data-testid="the-gang-tools-deal-status">
                        {toolsDealt
                            ? t('board.toolsDealtStatus', { players: core.playerIds.length })
                            : t(canConfigure ? 'board.toolsReadyToDealStatus' : 'board.toolsGuestStatus')}
                    </div>
                    {nightVisionPickerOpen && localPlayer.toolCards.includes('night-vision-goggles') && (
                        <NightVisionCardPicker
                            cards={localPlayer.pocketCards}
                            onCancel={() => setNightVisionPickerOpen(false)}
                            onSelect={(cardIndex) => {
                                onUseTool('night-vision-goggles', cardIndex);
                                setNightVisionPickerOpen(false);
                            }}
                        />
                    )}
                        <div
                            className="relative rounded-lg border border-amber-200/18 bg-black/12 p-2"
                            data-testid="the-gang-local-tools"
                        >
                            {localPlayer.toolCards.length === 0 ? (
                                <OptimizedImage
                                    src={RULE_SURFACE_ASSETS.toolsZone}
                                    alt=""
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75"
                                    draggable={false}
                                    placeholder={false}
                                />
                            ) : (
                                <OptimizedImage
                                    src={RULE_SURFACE_ASSETS.toolsZone}
                                    alt=""
                                    aria-hidden="true"
                                    className="pointer-events-none absolute right-2 top-2 h-14 w-10 rounded opacity-18"
                                    draggable={false}
                                    placeholder={false}
                                />
                            )}
                            <div className="relative z-10">
                                {localPlayer.toolCards.length > 0 ? (
                                    <div className="flex flex-wrap justify-center gap-2 lg:gap-3" data-testid="the-gang-tool-card-grid">
                                        {localPlayer.toolCards.map((tool, index) => (
                                            <ToolCardBadge
                                                key={`${tool}-${index}`}
                                                tool={tool}
                                                active={localPlayer.activeTools.includes(tool)}
                                                onUse={handleUseTool}
                                                actionLabel={tool === 'night-vision-goggles' ? t('board.chooseHandCardForTool') : t('board.useTool')}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex min-h-[8.5rem] items-end justify-center rounded-md border border-amber-200/18 bg-black/8 px-2 pb-2 text-center text-amber-100/88 lg:min-h-[10.5rem]">
                                        {t('board.noTools')}
                                    </div>
                                )}
                            </div>
                        </div>
                            </section>
                        <section className="min-w-0 rounded-lg border border-sky-200/16 bg-black/12 p-3" data-testid="the-gang-local-specialists">
                            <div className="mb-1 flex items-center justify-between gap-2">
                                <div>
                                    <div className="text-[0.58rem] uppercase tracking-[0.18em] text-sky-100/72">
                                        {t('board.specialistZone')}
                                    </div>
                                    <div className="text-[0.58rem] text-sky-100/82">
                                        {t('board.specialistDeck', { count: core.specialistDeck.length })}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    aria-disabled={!canConfigure}
                                    onClick={handleResetSpecialists}
                                    className={[
                                        'rounded-full border px-2.5 py-1 text-[0.62rem] font-black transition',
                                        canConfigure
                                            ? 'cursor-pointer border-sky-100/32 bg-sky-950/72 text-sky-100 hover:border-sky-100/70 hover:bg-sky-900'
                                            : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400',
                                    ].join(' ')}
                                >
                                    {t('board.resetSpecialists')}
                                </button>
                            </div>
                            <div className="relative rounded-lg border border-sky-200/18 bg-black/12 p-2">
                                {localPlayer.specialistCards.length === 0 ? (
                                    <OptimizedImage
                                        src={RULE_SURFACE_ASSETS.specialistsZone}
                                        alt=""
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75"
                                        draggable={false}
                                        placeholder={false}
                                    />
                                ) : (
                                    <OptimizedImage
                                        src={RULE_SURFACE_ASSETS.specialistsZone}
                                        alt=""
                                        aria-hidden="true"
                                        className="pointer-events-none absolute right-2 top-2 h-14 w-10 rounded opacity-18"
                                        draggable={false}
                                        placeholder={false}
                                    />
                                )}
                                <div className="relative z-10">
                                    {localPlayer.specialistCards.length > 0 ? (
                                        <div className="flex flex-wrap justify-center gap-2 lg:gap-3" data-testid="the-gang-specialist-card-grid">
                                            {localPlayer.specialistCards.map((specialist, index) => (
                                                <SpecialistCardBadge key={`${specialist}-${index}`} specialist={specialist} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex min-h-[8.5rem] items-end justify-center rounded-md border border-sky-200/18 bg-black/8 px-2 pb-2 text-center text-sky-100/88 lg:min-h-[10.5rem]">
                                            {t('board.noSpecialists')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ChipDisc({
    round,
    value,
    size = 'md',
    className = '',
    zone,
}: {
    round: number;
    value: number;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
    zone?: string;
}) {
    const sizeClass = {
        xs: 'h-5 w-5 lg:h-6 lg:w-6',
        sm: 'h-7 w-7 lg:h-8 lg:w-8',
        md: 'h-8 w-8 md:h-9 md:w-9 lg:h-12 lg:w-12',
        lg: 'h-10 w-10 md:h-12 md:w-12 lg:h-16 lg:w-16',
    }[size];
    const { t } = useTranslation('game-the-gang');
    const roundLabel = t(`board.roundLabels.${round}`, { defaultValue: ROUND_LABELS[round as keyof typeof ROUND_LABELS] ?? t('board.chip') });
    const label = t('board.chipLabel', { round: roundLabel, value });

    return (
        <span
            className={['the-gang-chip-disc', `the-gang-chip-disc--${size}`, 'relative inline-flex rounded-full', sizeClass, className].join(' ')}
            aria-label={label}
            data-bgg-zone={zone}
        >
            <OptimizedImage
                src={getChipAssetPath(round, value)}
                alt={label}
                className="h-full w-full rounded-full object-contain drop-shadow-[0.12rem_0.16rem_0_rgba(0,0,0,0.5)]"
                draggable={false}
                placeholder={false}
            />
        </span>
    );
}

function ChipButton({
    round,
    value,
    owner,
    selected,
    onClick,
    dragHandlers,
    hiddenWhileDragging = false,
    disabled: forceDisabled = false,
}: {
    round: number;
    value: number;
    owner?: string;
    selected: boolean;
    onClick: (event: ChipClickEvent) => void;
    dragHandlers?: ChipDragHandlers;
    hiddenWhileDragging?: boolean;
    disabled?: boolean;
}) {
    const disabled = forceDisabled || (!!owner && !selected);
    const { t } = useTranslation('game-the-gang');
    const roundLabel = t(`board.roundLabels.${round}`, { defaultValue: ROUND_LABELS[round as keyof typeof ROUND_LABELS] ?? t('board.chip') });
    const label = t('board.chipLabel', { round: roundLabel, value });
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            {...dragHandlers}
            aria-label={label}
            title={owner && !selected ? t('board.chipTakenByPlayer', { label, player: Number(owner) + 1 }) : label}
            className={[
                'relative rounded-full p-0 transition',
                selected ? 'scale-110 drop-shadow-[0_0_20px_rgba(252,211,77,0.8)]' : '',
                !selected && !disabled ? 'hover:scale-105 hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.55)]' : '',
                dragHandlers && !disabled ? 'cursor-grab touch-none active:cursor-grabbing' : '',
                disabled ? 'cursor-not-allowed opacity-35 grayscale' : '',
                hiddenWhileDragging ? 'opacity-0' : '',
            ].join(' ')}
            data-chip-value={value}
            data-drag-source-hidden={hiddenWhileDragging ? 'true' : undefined}
        >
            <ChipDisc round={round} value={value} />
        </button>
    );
}

function ExitChipToken({
    compact = false,
    size,
    zone = 'exit-chip-token',
}: {
    compact?: boolean;
    size?: 'xs' | 'sm' | 'md';
    zone?: string;
}) {
    const { t } = useTranslation('game-the-gang');
    const label = t('board.exitChipShort');
    const resolvedSize = size ?? (compact ? 'xs' : 'md');
    const sizeClass = {
        xs: 'h-4 w-4 lg:h-5 lg:w-5',
        sm: 'h-7 w-7 lg:h-8 lg:w-8',
        md: 'h-8 w-8 md:h-9 md:w-9 lg:h-12 lg:w-12',
    }[resolvedSize];
    return (
        <span
            className={[
                'inline-flex rounded-full drop-shadow-[0_0_0.55rem_rgba(248,113,113,0.58)]',
                sizeClass,
            ].join(' ')}
            data-bgg-zone={zone}
            aria-label={label}
        >
            <OptimizedImage
                src={EXIT_CHIP_ASSET_PATH}
                alt={label}
                className="h-full w-full rounded-full object-contain"
                draggable={false}
                placeholder={false}
            />
        </span>
    );
}

function ExitChipBadge({
    compact = false,
    size,
}: {
    compact?: boolean;
    size?: 'xs' | 'sm' | 'md';
}) {
    return (
        <span
            className="inline-flex items-center justify-center"
            data-testid="the-gang-exit-chip-badge"
        >
            <ExitChipToken compact={compact} size={size} zone="exit-chip-badge-token" />
        </span>
    );
}

function ExitChipButton({
    index,
    total,
    selected,
    disabled,
    onClick,
}: {
    index: number;
    total: number;
    selected: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    const { t } = useTranslation('game-the-gang');
    const label = selected ? t('board.exitChipTakenLabel', { index, total }) : t('board.exitChipLabel', { index, total });
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            title={label}
            data-testid={`the-gang-exit-chip-button-${index}`}
            className={[
                'relative flex h-9 w-9 items-center justify-center rounded-full p-0 transition md:h-10 md:w-10 lg:h-12 lg:w-12',
                selected ? 'scale-105 drop-shadow-[0_0_1rem_rgba(248,113,113,0.86)]' : '',
                !selected && !disabled ? 'hover:scale-105 hover:drop-shadow-[0_0_1rem_rgba(248,113,113,0.9)]' : '',
                disabled && !selected ? 'cursor-not-allowed opacity-35 grayscale' : '',
                selected ? 'cursor-not-allowed' : '',
            ].join(' ')}
        >
            <ExitChipToken />
        </button>
    );
}

function AlarmTrack({ failures }: { failures: number }) {
    const { t } = useTranslation('game-the-gang');

    return (
        <span
            className="text-rose-100"
            aria-label={t('board.failuresLabel', { failures })}
        >
            <span className="sr-only">{t('board.failures')}</span>
            <span className="font-bold">{t('board.alarmTrack', { failures })}</span>
        </span>
    );
}

function SuccessTrack({ successes }: { successes: number }) {
    const { t } = useTranslation('game-the-gang');

    return (
        <span
            className="text-amber-100"
            aria-label={t('board.successesLabel', { successes })}
        >
            <span className="sr-only">{t('board.successes')}</span>
            <span className="font-bold">{t('board.vaultTrack', { successes })}</span>
        </span>
    );
}

function RoundChipColumn({
    round,
    chipValues,
    selectedChip,
    onTakeChip,
    getChipDragHandlers,
    chipDrag,
    remotePoolDragChipValues,
    active,
}: {
    round: number;
    chipValues: number[];
    selectedChip?: number;
    onTakeChip: (chip: number, event?: ChipClickEvent) => void;
    getChipDragHandlers?: (source: ChipDragSource) => ChipDragHandlers;
    chipDrag?: ChipDragState | null;
    remotePoolDragChipValues?: ReadonlySet<number>;
    active: boolean;
}) {
    if (!active) {
        return null;
    }

    return (
        <>
            {chipValues.map((chip, index) => {
                return (
                    <ChipButton
                        key={`${round}-${chip}-${index}`}
                        round={round}
                        value={chip}
                        onClick={(event) => onTakeChip(chip, event)}
                        dragHandlers={getChipDragHandlers?.({ origin: 'pool', chip })}
                        hiddenWhileDragging={isChipDragSourceActive(chipDrag ?? null, { origin: 'pool', chip })
                            || remotePoolDragChipValues?.has(chip) === true}
                        selected={selectedChip === chip}
                    />
                );
            })}
        </>
    );
}

function VaultsAlarmsZone({ successes, failures }: { successes: number; failures: number }) {
    const { t } = useTranslation('game-the-gang');
    const label = t('board.vaultsAlarmsLabel', { successes, failures });

    return (
        <section
            className="sr-only"
            data-bgg-zone="vaults-alarms-zone"
            aria-label={label}
        >
            {label}
        </section>
    );
}

function ShowdownResultPanel({
    lastShowdown,
    communityCards,
    playerName,
    onNextHeist,
    nextHeistProgress,
    playerIds,
}: {
    lastShowdown: NonNullable<TheGangCore['lastShowdown']>;
    communityCards: TheGangCore['communityCards'];
    playerName: (id: string) => string;
    onNextHeist: () => void;
    nextHeistProgress: ProgressButtonState;
    playerIds: string[];
}) {
    const success = lastShowdown.outcome === 'success';
    const { t } = useTranslation('game-the-gang');
    const getResultKey = (result: (typeof lastShowdown.results)[number]) => (
        result.handSlot ? `${result.playerId}:${result.handSlot}` : result.playerId
    );
    const playerResultIndex = new Map(lastShowdown.results.map((result, index) => [getResultKey(result), index]));

    return (
        <section
            className="pointer-events-auto fixed inset-0 z-[80] h-dvh overflow-y-auto overscroll-contain bg-[#06110d] bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_50%_58%,rgba(6,78,59,0.72),rgba(6,17,13,0.98)_62%,#06110d_100%)] px-3 py-4 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)] md:px-6 md:py-6"
            data-bgg-zone="reveal-zone"
            aria-label={t('board.showdownSettlement')}
        >
            <div
                className="relative mx-auto flex min-h-full w-full max-w-[104rem] flex-col items-center justify-start gap-4 overflow-visible px-1 py-4 md:gap-5 md:px-3 md:py-6"
                data-bgg-zone="reveal-action"
                data-tutorial-id="the-gang-showdown-result"
            >
                <div className="flex items-center justify-center gap-3" data-bgg-zone="reveal-more-holder">
                    <span className={['text-5xl font-black leading-none md:text-7xl', success ? 'text-amber-300' : 'text-rose-400'].join(' ')}>
                        {success ? '✓' : '!'}
                    </span>
                    <h2 className="whitespace-nowrap text-3xl font-black tracking-tight md:text-5xl" data-bgg-zone="reveal-currentrank">
                        {success ? t('board.heistSuccess') : t('board.heistFailure')}
                    </h2>
                </div>

                <div
                    className="flex w-full flex-col items-center gap-2 overflow-visible px-2 py-2"
                    data-bgg-zone="reveal-community-cards"
                    data-tutorial-id="the-gang-showdown-community-cards"
                    aria-label={t('board.communityCards')}
                >
                    <span className="text-xs font-black tracking-[0.12em] text-amber-100 md:text-sm">
                        {t('board.communityCards')}
                    </span>
                    <div className="flex justify-center gap-2 md:gap-3">
                        {communityCards.map((card, index) => (
                            <CardFace
                                key={`${card.rank}-${card.suit}-${index}`}
                                card={card}
                                emphasis="showdown"
                                t={t}
                            />
                        ))}
                    </div>
                </div>

                <div
                    className="grid w-full max-w-[72rem] grid-cols-1 gap-4 overflow-visible md:grid-cols-2"
                    data-bgg-zone="reveal-players"
                    data-tutorial-id="the-gang-showdown-hole-cards"
                >
                    {lastShowdown.results.map((result) => {
                        const resultKey = getResultKey(result);
                        const handLabel = result.handSlot === 'bottom'
                            ? t('board.bottomHand')
                            : result.handSlot === 'top'
                                ? t('board.topHand')
                                : undefined;
                        return (
                            <div
                                key={resultKey}
                                className="flex min-w-0 flex-col gap-3 overflow-visible rounded-[1.25rem] bg-emerald-950/34 px-3 py-3 outline outline-1 outline-amber-100/10 shadow-[0_0_34px_rgba(251,191,36,0.14),0_14px_34px_rgba(0,0,0,0.28)] md:px-4 md:py-4"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="truncate text-sm font-black text-stone-100 md:text-base">
                                        {playerName(result.playerId)}
                                        {handLabel && ` · ${handLabel}`}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <ChipDisc round={4} value={result.chip} size="md" zone="plreveal-token" />
                                        {result.exited && <ExitChipBadge />}
                                        <span className="text-xs font-black tracking-[0.08em] text-amber-100 md:text-sm">
                                            {result.strength.label}
                                            {result.winningHandSlot === 'bottom' && ` · ${t('board.winningBottomHand')}`}
                                            {result.winningHandSlot === 'top' && ` · ${t('board.winningTopHand')}`}
                                        </span>
                                    </div>
                                </div>
                                <div
                                    className="flex justify-center overflow-visible"
                                    data-bgg-zone="reveal-pocket-cards"
                                    aria-label={`${playerName(result.playerId)} ${result.strength.label}`}
                                >
                                    <HandCardRows
                                        primaryCards={result.pocketCards}
                                        secondaryCards={result.secondaryPocketCards}
                                        emphasis="showdown"
                                        t={t}
                                        testIdPrefix={`the-gang-showdown-hand-${resultKey.replace(':', '-')}`}
                                        revealOrderBase={(playerResultIndex.get(resultKey) ?? 0) * 4}
                                        winningHandSlot={result.winningHandSlot}
                                        showLabels={!!handLabel || !!result.secondaryPocketCards?.length}
                                        singleRowSlot={result.handSlot}
                                        singleRowLabel={handLabel}
                                    />
                                </div>
                        </div>
                        );
                    })}
                </div>

                <div className="sr-only" data-bgg-zone="safe-zone">
                    {t('board.safeSettlement')}
                </div>

                <button
                    type="button"
                    onClick={onNextHeist}
                    disabled={nextHeistProgress.hasApproved}
                    className="rounded-full border border-emerald-100/60 bg-emerald-300 px-6 py-3 text-base font-black tracking-[0.08em] text-emerald-950 shadow-[0_12px_28px_rgba(16,185,129,0.32)] transition hover:-translate-y-0.5 hover:bg-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 disabled:cursor-not-allowed disabled:border-stone-600/70 disabled:bg-stone-700/75 disabled:text-stone-400 disabled:shadow-none disabled:hover:translate-y-0 md:px-8 md:text-lg"
                >
                    {nextHeistProgress.label}
                </button>
                <ProgressVoteDots
                    approvals={nextHeistProgress.approvals}
                    label={nextHeistProgress.status}
                    playerIds={playerIds}
                />
            </div>
        </section>
    );
}

function PlayerChipStrip({
    roundHistory,
    currentRound,
    currentChips,
    playerId,
    localPlayerId,
    onTakeCurrentChip,
    getChipDragHandlers,
    chipDrag,
}: {
    roundHistory: TheGangCore['roundHistory'];
    currentRound: number;
    currentChips: CurrentChipDisplay[];
    playerId: string;
    localPlayerId: string;
    onTakeCurrentChip?: (chip: number, event?: ChipClickEvent) => void;
    getChipDragHandlers?: (source: ChipDragSource) => ChipDragHandlers;
    chipDrag?: ChipDragState | null;
}) {
    const hasTwoHandRows = currentChips.some((display) => display.handSlot)
        || roundHistory.some((entry) => Object.keys(entry.chipsByPlayer).some((ownerKey) => {
            const owner = parseChipOwnerKey(ownerKey);
            return owner.playerId === playerId && owner.handSlot !== undefined;
        }));
    const visibleCurrentChips = playerId === localPlayerId ? [] : currentChips;
    const canTakeCurrentChip = playerId !== localPlayerId && !!onTakeCurrentChip;

    if (playerId === localPlayerId) {
        return null;
    }

    return (
        <div
            className={[
                'flex min-h-8 items-center justify-center gap-1.5 lg:min-h-12 lg:gap-2',
                hasTwoHandRows ? 'w-full max-w-[14rem] flex-col lg:max-w-[18rem]' : '',
            ].join(' ')}
            data-bgg-zone="player-tokens"
            data-testid={`the-gang-player-chip-strip-${playerId}`}
        >
            {(hasTwoHandRows ? THE_GANG_HAND_SLOTS : (['top'] as const)).map((handSlot) => (
                <HandChipRail
                    key={handSlot}
                    roundHistory={roundHistory}
                    currentRound={currentRound}
                    currentChips={visibleCurrentChips}
                    playerId={playerId}
                    handSlot={handSlot}
                    variant="player"
                    showLabel={hasTwoHandRows}
                    showEmpty={hasTwoHandRows}
                    canTakeCurrentChip={canTakeCurrentChip}
                    onTakeCurrentChip={onTakeCurrentChip}
                    getChipDragHandlers={getChipDragHandlers}
                    chipDrag={chipDrag}
                    testId={`the-gang-player-chip-row-${playerId}-${hasTwoHandRows ? handSlot : 'single'}`}
                />
            ))}
        </div>
    );
}

function HandChipRail({
    roundHistory,
    currentRound,
    currentChips,
    playerId,
    handSlot,
    variant,
    attachedPlacement = 'right',
    showLabel = false,
    showEmpty = false,
    canTakeCurrentChip = false,
    onTakeCurrentChip,
    canReturnCurrentChip = false,
    onReturnCurrentChip,
    getChipDragHandlers,
    chipDrag,
    testId,
}: {
    roundHistory: TheGangCore['roundHistory'];
    currentRound: number;
    currentChips: CurrentChipDisplay[];
    playerId: string;
    handSlot: HandSlot;
    variant: 'attached' | 'player';
    attachedPlacement?: 'above' | 'right';
    showLabel?: boolean;
    showEmpty?: boolean;
    canTakeCurrentChip?: boolean;
    onTakeCurrentChip?: (chip: number, event?: ChipClickEvent) => void;
    canReturnCurrentChip?: boolean;
    onReturnCurrentChip?: (handSlot: HandSlot, event?: ChipClickEvent) => void;
    getChipDragHandlers?: (source: ChipDragSource) => ChipDragHandlers;
    chipDrag?: ChipDragState | null;
    testId: string;
}) {
    const { t } = useTranslation('game-the-gang');
    const label = handSlot === 'bottom' ? t('board.bottomHand') : t('board.topHand');
    const previousChips = roundHistory.flatMap((entry) => (
        Object.entries(entry.chipsByPlayer)
            .filter(([ownerKey]) => {
                const owner = parseChipOwnerKey(ownerKey);
                return owner.playerId === playerId && (owner.handSlot ?? 'top') === handSlot;
            })
            .map(([ownerKey, chip]) => ({
                key: `${entry.round}-${ownerKey}-${chip}`,
                round: entry.round,
                chip,
                exited: entry.exitChipOwners?.includes(ownerKey) ?? false,
            }))
    ));
    const currentChip = currentChips.find((display) => (
        display.chip !== undefined && (display.handSlot ?? 'top') === handSlot
    ));

    if (!showEmpty && previousChips.length === 0 && currentChip === undefined) {
        return null;
    }

    const isAttached = variant === 'attached';
    const canInteractWithCurrentChip = currentChip?.chip !== undefined
        && ((canTakeCurrentChip && !!onTakeCurrentChip) || (canReturnCurrentChip && !!onReturnCurrentChip));
    const chipHolderClass = isAttached
        ? attachedPlacement === 'above'
            ? `${canInteractWithCurrentChip ? 'pointer-events-auto' : 'pointer-events-none'} absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-[calc(100%+0.35rem)] flex-nowrap items-start justify-center gap-0.5 lg:gap-1`
            : `${canInteractWithCurrentChip ? 'pointer-events-auto' : 'pointer-events-none'} absolute left-full top-0 z-20 ml-1 flex flex-nowrap items-start justify-start gap-0.5 lg:ml-1.5 lg:gap-1`
        : 'flex min-h-7 w-full items-center justify-between gap-1 px-1.5 py-0.5 lg:min-h-8 lg:px-2';
    const chipListClass = isAttached
        ? 'flex flex-nowrap items-center justify-center gap-0.5 lg:gap-1'
        : 'flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1';
    const currentChipSize = isAttached ? 'sm' : 'sm';
    const previousChipSize = isAttached ? 'xs' : 'xs';

    const currentChipNode = currentChip?.chip !== undefined ? (
        <span className="relative inline-flex items-center justify-center gap-0.5 lg:gap-1">
            <ChipDisc
                round={currentRound}
                value={currentChip.chip}
                size={currentChipSize}
                className={isAttached
                    ? 'scale-105 drop-shadow-[0_0_14px_rgba(252,211,77,0.72)]'
                    : 'drop-shadow-[0_0_12px_rgba(252,211,77,0.62)]'}
                zone={isAttached ? 'hand-current-chip' : 'player-current-token'}
            />
            {currentChip.exited && (
                <ExitChipBadge size={isAttached ? 'sm' : 'xs'} compact={!isAttached} />
            )}
        </span>
    ) : null;
    const currentChipDragHandlers = currentChip?.chip !== undefined
        ? getChipDragHandlers?.({
            origin: isAttached ? 'local-hand' : 'player-chip',
            chip: currentChip.chip,
            handSlot: currentChip.handSlot ?? handSlot,
            playerId,
        })
        : undefined;
    const currentChipDragSource = currentChip?.chip !== undefined
        ? {
            origin: isAttached ? 'local-hand' as const : 'player-chip' as const,
            chip: currentChip.chip,
            handSlot: currentChip.handSlot ?? handSlot,
            playerId,
        }
        : undefined;
    const currentChipHiddenWhileDragging = currentChipDragSource
        ? isChipDragSourceActive(chipDrag ?? null, currentChipDragSource)
        : false;
    const currentChipActionLabel = currentChip?.chip !== undefined
        ? t(isAttached ? 'board.returnCurrentChipLabel' : 'board.takeCurrentChipLabel', { chip: currentChip.chip })
        : undefined;

    return (
        <div
            className={chipHolderClass}
            data-testid={testId}
            data-hand-slot={handSlot}
            data-bgg-zone={isAttached ? 'hand-chips' : undefined}
        >
            {showLabel && (
                <span className="shrink-0 text-[0.52rem] font-black leading-none tracking-[0.08em] text-amber-100/72 lg:text-[0.6rem]">
                    {label}
                </span>
            )}
            <span className={chipListClass}>
                {previousChips.map((entry) => (
                    <span key={entry.key} className="relative inline-flex">
                        <ChipDisc
                            round={entry.round}
                            value={entry.chip}
                            size={previousChipSize}
                            zone={isAttached ? 'hand-chips-previous' : 'player-token'}
                        />
                        {entry.exited && (
                            <span className="absolute -bottom-1 -right-1">
                                <ExitChipBadge compact />
                            </span>
                        )}
                    </span>
                ))}
                {canInteractWithCurrentChip && currentChip?.chip !== undefined ? (
                    <button
                        type="button"
                        className={[
                            'rounded-full transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 cursor-grab touch-none active:cursor-grabbing',
                            currentChipHiddenWhileDragging ? 'opacity-0' : '',
                        ].join(' ')}
                        aria-label={currentChipActionLabel}
                        title={currentChipActionLabel}
                        data-drag-source-hidden={currentChipHiddenWhileDragging ? 'true' : undefined}
                        data-testid={isAttached
                            ? `the-gang-return-local-chip-${currentChip.handSlot ?? handSlot}`
                            : `the-gang-take-player-chip-${playerId}-${currentChip.handSlot ?? 'single'}`}
                        onClick={(event) => {
                            if (isAttached) {
                                onReturnCurrentChip?.(currentChip.handSlot ?? handSlot, event);
                                return;
                            }
                            onTakeCurrentChip?.(currentChip.chip, event);
                        }}
                        {...currentChipDragHandlers}
                    >
                        {currentChipNode}
                    </button>
                ) : (
                    currentChipNode
                )}
                {previousChips.length === 0 && currentChip === undefined && (
                    <span
                        className="h-4 w-10 rounded-full border border-dashed border-amber-100/16 bg-black/10 lg:h-5"
                        aria-label={label}
                    />
                )}
            </span>
        </div>
    );
}

function buildCurrentChipDisplays(core: TheGangCore, playerId: string): CurrentChipDisplay[] {
    if (!core.rules.config.twoHand) {
        return [{ key: playerId, chip: core.currentRoundChips[playerId], exited: hasExitChipForHandSlot(core, playerId) }];
    }

    return THE_GANG_HAND_SLOTS.map((handSlot) => ({
        key: resolveChipOwnerKey(core, playerId, handSlot),
        handSlot,
        chip: getChipForHandSlot(core, playerId, handSlot),
        exited: hasExitChipForHandSlot(core, playerId, handSlot),
    }));
}

function ChipHandSelector({
    activeSlot,
    onSelect,
}: {
    activeSlot: HandSlot;
    onSelect: (slot: HandSlot) => void;
}) {
    const { t } = useTranslation('game-the-gang');

    return (
        <div
            className="flex flex-col items-center justify-center gap-0.5"
            style={{
                transform: 'scale(var(--mobile-board-shell-inverse-scale, 1))',
                transformOrigin: 'center center',
            }}
            data-testid="the-gang-chip-hand-selector"
            aria-label={t('board.chipHandSelector')}
        >
            {THE_GANG_HAND_SLOTS.map((slot) => {
                const active = activeSlot === slot;
                const label = slot === 'bottom' ? t('board.chipTargetBottomHand') : t('board.chipTargetTopHand');
                return (
                    <button
                        key={slot}
                        type="button"
                        aria-pressed={active}
                        aria-label={label}
                        data-testid={`the-gang-chip-hand-selector-${slot}`}
                        onClick={() => onSelect(slot)}
                        style={{ minHeight: 44 }}
                        className="group flex min-h-11 min-h-[44px] min-w-14 cursor-pointer items-center justify-center rounded-full bg-transparent p-0 font-black leading-none tracking-[0.02em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 lg:min-w-20"
                    >
                        <span
                            data-testid={`the-gang-chip-hand-selector-surface-${slot}`}
                            className={[
                                'inline-flex h-5 min-w-[2.35rem] items-center justify-center rounded-full border px-1 text-[0.56rem] transition-colors lg:h-6 lg:min-w-[3.25rem] lg:px-1.5 lg:text-[0.68rem]',
                                active
                                    ? 'border-amber-100 bg-amber-300/90 text-emerald-950 shadow-[0_0_0_0.04rem_rgba(251,191,36,0.28),0_0_0.24rem_rgba(251,191,36,0.24)]'
                                    : 'border-amber-100/24 bg-black/28 text-amber-100/78 group-hover:border-amber-100/58 group-hover:bg-emerald-900/78',
                            ].join(' ')}
                        >
                            {label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function TheGangEndgameContent({
    result,
    successes,
    failures,
}: ContentSlotProps & {
    successes: number;
    failures: number;
}) {
    const { t } = useTranslation('game-the-gang');
    const clearedAllCases = Array.isArray(result?.winners) && result.winners.length > 0;
    const title = clearedAllCases
        ? t('board.endgame.winTitle')
        : t('board.endgame.loseTitle');
    const subtitle = clearedAllCases
        ? t('board.endgame.winSubtitle')
        : t('board.endgame.loseSubtitle');

    return (
        <div className="mb-6 text-center">
            <div className="mb-3 inline-flex rounded-full border border-amber-200/40 bg-amber-200/12 px-4 py-1 text-xs font-black tracking-[0.18em] text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.28)]">
                {t('title.primary')}
            </div>
            <h2
                data-testid="the-gang-endgame-title"
                className={[
                    'text-4xl font-black tracking-[0.2em] drop-shadow-[0_5px_18px_rgba(0,0,0,0.85)] md:text-5xl',
                    clearedAllCases ? 'text-emerald-300' : 'text-rose-300',
                ].join(' ')}
            >
                {title}
            </h2>
            <p className="mt-3 text-base font-bold text-stone-100 drop-shadow-lg md:text-lg">
                {subtitle}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 text-sm font-black tracking-[0.12em]">
                <span className="rounded-full border border-emerald-300/40 bg-emerald-300/12 px-4 py-2 text-emerald-100">
                    {t('board.endgame.casesClosed', { successes })}
                </span>
                <span className="rounded-full border border-rose-300/40 bg-rose-300/12 px-4 py-2 text-rose-100">
                    {t('board.endgame.alarms', { failures })}
                </span>
            </div>
        </div>
    );
}

export default function TheGangBoard({
    G,
    dispatch,
    playerID,
    reset,
    matchData,
    seatControllers,
    isMultiplayer,
    sendUiEvent,
    subscribeUiEvent,
}: Props) {
    const core = G.core;
    const { t } = useTranslation('game-the-gang');
    const toast = useToast();
    useTutorialBridge(G.sys.tutorial, dispatch);
    useGameAudio({
        config: THE_GANG_AUDIO_CONFIG,
        gameId: THE_GANG_MANIFEST.id,
        G: core,
        ctx: {
            isGameOver: !!G.sys.gameover || !!core.gameResult,
        },
        eventEntries: G.sys.eventStream?.entries,
        meta: {
            playerID,
            isMultiplayer: isMultiplayer === true,
        },
    });
    const { overlayProps: endgameProps } = useEndgame({
        result: G.sys.gameover || undefined,
        playerID,
        reset,
        matchData,
        isMultiplayer,
    });

    const hasAiSeat = Object.values(seatControllers ?? {}).some((controller) => controller.type !== 'human');
    const localHumanPlayerId = core.playerIds.find((id) => (seatControllers?.[id]?.type ?? 'human') === 'human')
        ?? core.playerIds[0];
    const localPlayerId = isMultiplayer
        ? (playerID ?? core.playerIds[0])
        : (hasAiSeat ? (playerID ?? localHumanPlayerId) : (playerID ?? core.playerIds[0]));
    const localPlayer = core.players[localPlayerId];
    const hasSecondaryHand = (localPlayer?.secondaryPocketCards?.length ?? 0) > 0;
    const [activeChipHandSlot, setActiveChipHandSlot] = useState<HandSlot>('top');
    const [chipDrag, setChipDrag] = useState<ChipDragState | null>(null);
    const [cardDrag, setCardDrag] = useState<CardDragState | null>(null);
    const [chipTransferAnimations, setChipTransferAnimations] = useState<ChipTransferAnimation[]>([]);
    const [remoteChipDrags, setRemoteChipDrags] = useState<Record<string, RemoteChipDragState>>({});
    const chipDragRef = useRef<ChipDragState | null>(null);
    const cardDragRef = useRef<CardDragState | null>(null);
    const chipTransferAnimationIdRef = useRef(0);
    const chipTransferTimersRef = useRef<number[]>([]);
    const suppressNextChipClickRef = useRef(false);
    const lastChipDragBroadcastAtRef = useRef(0);
    const chipDragGlobalCleanupRef = useRef<(() => void) | null>(null);
    const heistStarted = core.heistStarted === true;
    const setupOpen = core.phase === 'chip-selection' && !heistStarted;
    const allPlayersHaveChip = allRequiredChipOwnersHaveChips(core);
    const allFinalTokensTaken = allRequiredFinalTokensAreTaken(core);
    const requiredExitChipCount = getRequiredExitChipCount(core);
    const currentExitChipOwners = getCurrentRoundExitChipOwners(core);
    const takenExitChipCount = currentExitChipOwners.length;
    const remainingExitChipCount = Math.max(0, requiredExitChipCount - takenExitChipCount);
    const localActiveChipOwnerKey = resolveChipOwnerKey(core, localPlayerId, activeChipHandSlot);
    const localCanTakeExitChip = core.phase === 'chip-selection'
        && heistStarted
        && core.round === 4
        && requiredExitChipCount > 0
        && core.currentRoundChips[localActiveChipOwnerKey] !== undefined
        && !currentExitChipOwners.includes(localActiveChipOwnerKey)
        && takenExitChipCount < requiredExitChipCount;
    const nextRoundProgress = getProgressButtonState(core, 'end-round', localPlayerId, t('board.nextRound'), t);
    const revealShowdownProgress = getProgressButtonState(core, 'reveal-showdown', localPlayerId, t('board.revealShowdown'), t);
    const nextHeistProgress = getProgressButtonState(core, 'start-next-heist', localPlayerId, t('board.nextHeist'), t);
    const canDragSwapCards = core.phase === 'chip-selection' && core.rules.config.twoHand && hasSecondaryHand;
    const chipValues = getChipValues(core.playerIds.length, core.rules.config, core.round);
    const availableChipValues = getUnoccupiedChipValues(chipValues, core.currentRoundChips);
    const localCurrentChips = buildCurrentChipDisplays(core, localPlayerId);
    const localSelectedChip = core.currentRoundChips[resolveChipOwnerKey(core, localPlayerId, activeChipHandSlot)];
    const chipInteractionOpen = core.phase === 'chip-selection' && heistStarted;
    const activeChipDropTargetKey = chipDrag?.dragging ? chipDropTargetKey(chipDrag.hoverTarget) : '';
    const localHandChipDropStates: ChipDropVisualStates = {
        top: getLocalHandChipDropVisualState(chipDrag, 'top', activeChipDropTargetKey),
        bottom: getLocalHandChipDropVisualState(chipDrag, 'bottom', activeChipDropTargetKey),
    };
    const poolChipDropState = getPoolChipDropVisualState(chipDrag, activeChipDropTargetKey);
    const activeCardDropTargetKey = cardDrag?.dragging ? cardDropTargetKey(cardDrag.hoverTarget) : '';
    const poolChipDropTargetClass = poolChipDropState
        ? `the-gang-open-drop-target the-gang-open-drop-target--${poolChipDropState}`
        : '';
    const remotePoolDragChipValues = new Set(Object.values(remoteChipDrags)
        .filter((drag) => drag.origin === 'pool' && drag.round === core.round)
        .map((drag) => drag.chip));
    const localCanChooseRoundChipSlot = availableChipValues.length > 0
        && THE_GANG_HAND_SLOTS.some((slot) => core.currentRoundChips[resolveChipOwnerKey(core, localPlayerId, slot)] === undefined);
    const localCanChooseExitChipSlot = core.round === 4
        && requiredExitChipCount > 0
        && takenExitChipCount < requiredExitChipCount
        && THE_GANG_HAND_SLOTS.some((slot) => {
            const ownerKey = resolveChipOwnerKey(core, localPlayerId, slot);
            return core.currentRoundChips[ownerKey] !== undefined && !currentExitChipOwners.includes(ownerKey);
        });
    const showChipHandSelector = heistStarted
        && core.phase === 'chip-selection'
        && core.rules.config.twoHand
        && (localCanChooseRoundChipSlot || localCanChooseExitChipSlot);
    const rulesChangeRestarts = core.heistNumber !== 1
        || core.round !== 1
        || core.phase !== 'chip-selection'
        || heistStarted
        || Object.keys(core.currentRoundChips).length > 0
        || core.heistHistory.length > 0
        || core.roundHistory.length > 0;
    const canConfigureRules = resolveCanConfigureRules(matchData, playerID, core.playerIds[0]);
    const twoHandChipSelectionLayout = core.phase === 'chip-selection' && core.rules.config.twoHand;
    const handRankRules = isChallengeActive(core.rules.config, 'grinding-gears') || isChallengeActive(core.rules.config, 'the-joker') || isChallengeActive(core.rules.config, 'master-key')
        ? THE_GANG_EXPANDED_HAND_RANK_RULES
        : TEXAS_HOLDEM_HAND_RANK_RULES;
    const opponentPlayerIds = orderOpponentPlayerIdsForLocal(core.playerIds, localPlayerId);
    const localHandCardEmphasis: CardFaceEmphasis = hasSecondaryHand
        ? 'handDense'
        : 'hand';
    const localBoardCards = localPlayer
        ? [...(localPlayer.communityCards ?? core.communityCards), ...localPlayer.flashlightCards]
        : [];
    const localTopHandRankHint = localPlayer
        ? evaluateVisibleHandRankLabel(
            [...localPlayer.pocketCards, ...localPlayer.nightVisionCards],
            localBoardCards,
            core,
        )
        : undefined;
    const localBottomHandRankHint = hasSecondaryHand && localPlayer
        ? evaluateVisibleHandRankLabel(localPlayer.secondaryPocketCards ?? [], localBoardCards, core)
        : undefined;
    const localHandRankHints: HandRankHints | undefined = localTopHandRankHint || localBottomHandRankHint
        ? {
            ...(localTopHandRankHint ? { top: localTopHandRankHint } : {}),
            ...(localBottomHandRankHint ? { bottom: localBottomHandRankHint } : {}),
        }
        : undefined;
    const twoHandChipSelectionOffsetVar = core.communityCards.length > 0
        ? '--the-gang-twohand-chip-selection-river-offset'
        : '--the-gang-twohand-chip-selection-token-offset';
    const middleCenterStyle = twoHandChipSelectionLayout
        ? {
            transform: `translateY(var(${twoHandChipSelectionOffsetVar}, clamp(4.5rem, 17vh, 5.25rem)))`,
            gap: core.communityCards.length > 0 ? 'clamp(1.25rem, 5vh, 2rem)' : '2rem',
        }
        : undefined;

    const playerNames = buildPlayerDisplayNameMap(
        core.playerIds,
        matchData,
        (id) => t('board.playerFallback', { player: Number(id) + 1 }),
    );
    const playerName = (id: string) => playerNames[id] ?? t('board.playerFallback', { player: Number(id) + 1 });

    const enqueueChipTransferAnimation = useCallback((
        chip: number,
        round: TheGangRound,
        from: ViewportPoint | undefined,
        to: ViewportPoint | undefined,
        playerId = localPlayerId,
    ) => {
        if (!from || !to) return;

        const id = chipTransferAnimationIdRef.current + 1;
        chipTransferAnimationIdRef.current = id;
        setChipTransferAnimations((current) => ([
            ...current,
            {
                id,
                playerId,
                chip,
                round,
                from,
                to,
                settled: false,
            },
        ]));

        const settleTimer = window.setTimeout(() => {
            setChipTransferAnimations((current) => current.map((animation) => (
                animation.id === id
                    ? { ...animation, settled: true }
                    : animation
            )));
        }, 0);
        const cleanupTimer = window.setTimeout(() => {
            setChipTransferAnimations((current) => current.filter((animation) => animation.id !== id));
        }, CHIP_TRANSFER_ANIMATION_MS + 90);
        chipTransferTimersRef.current.push(settleTimer, cleanupTimer);
    }, [localPlayerId]);

    useEffect(() => {
        if (!subscribeUiEvent) return undefined;
        return subscribeUiEvent((event: MatchUiEvent) => {
            if (event.type !== CHIP_DRAG_UI_EVENT || event.playerId === localPlayerId) return;
            if (!isChipDragUiPayload(event.payload)) return;

            if (event.payload.action === 'end') {
                setRemoteChipDrags((current) => {
                    const next = { ...current };
                    delete next[event.playerId];
                    return next;
                });
                return;
            }

            if (event.payload.action === 'transfer') {
                const { chip, round, target } = event.payload;
                if (typeof chip !== 'number' || !isTheGangRound(round) || !isChipTransferUiTarget(target)) {
                    return;
                }
                enqueueChipTransferAnimation(
                    chip,
                    round,
                    resolveChipTransferSourcePoint(event.playerId, localPlayerId, event.payload, core.rules.config.twoHand),
                    getElementViewportCenter(resolveChipTransferTargetElement(
                        event.playerId,
                        localPlayerId,
                        target,
                        core.rules.config.twoHand,
                    )),
                    event.playerId,
                );
                return;
            }

            const { chip, round, x, y } = event.payload;
            if (typeof chip !== 'number' || !isTheGangRound(round) || typeof x !== 'number' || typeof y !== 'number') {
                return;
            }

            setRemoteChipDrags((current) => ({
                ...current,
                [event.playerId]: {
                    playerId: event.playerId,
                    chip,
                    round,
                    origin: event.payload.origin,
                    handSlot: event.payload.handSlot,
                    sourcePlayerId: event.payload.sourcePlayerId,
                    x: Math.min(1, Math.max(0, x)),
                    y: Math.min(1, Math.max(0, y)),
                    updatedAt: Date.now(),
                },
            }));
        });
    }, [core.rules.config.twoHand, enqueueChipTransferAnimation, localPlayerId, subscribeUiEvent]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const now = Date.now();
            setRemoteChipDrags((current) => Object.fromEntries(
                Object.entries(current).filter(([, drag]) => now - drag.updatedAt < REMOTE_CHIP_DRAG_TTL_MS),
            ));
        }, REMOTE_CHIP_DRAG_TTL_MS);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => () => {
        chipTransferTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        chipTransferTimersRef.current = [];
        chipDragGlobalCleanupRef.current?.();
        chipDragGlobalCleanupRef.current = null;
    }, []);

    const tutorialOpponentTargetId = core.playerIds.find((id) => id !== localPlayerId);
    const showWarning = (
        key:
            | 'board.toastStartBeforeChip'
            | 'board.toastHostOnlyStart'
            | 'board.toastHostOnlyRedeal'
            | 'board.toastToolsHostOnly'
            | 'board.toastToolsAlreadyDealt',
        dedupeKey: string,
    ) => {
        const options = { dedupeKey: `the-gang.${dedupeKey}` };
        if (key === 'board.toastStartBeforeChip') {
            toast.warning({ kind: 'i18n', ns: 'game-the-gang', key: 'board.toastStartBeforeChip' }, undefined, options);
            return;
        }
        if (key === 'board.toastHostOnlyStart') {
            toast.warning({ kind: 'i18n', ns: 'game-the-gang', key: 'board.toastHostOnlyStart' }, undefined, options);
            return;
        }
        if (key === 'board.toastHostOnlyRedeal') {
            toast.warning({ kind: 'i18n', ns: 'game-the-gang', key: 'board.toastHostOnlyRedeal' }, undefined, options);
            return;
        }
        if (key === 'board.toastToolsHostOnly') {
            toast.warning({ kind: 'i18n', ns: 'game-the-gang', key: 'board.toastToolsHostOnly' }, undefined, options);
            return;
        }
        toast.warning({ kind: 'i18n', ns: 'game-the-gang', key: 'board.toastToolsAlreadyDealt' }, undefined, options);
    };
    const showRulesBlockedToast = () => {
        toast.warning({ kind: 'i18n', ns: 'game-the-gang', key: 'board.toastHostOnlySetup' }, undefined, {
            dedupeKey: 'the-gang.host-only-setup',
        });
    };

    const dispatchForPlayer = <K extends string & keyof TheGangCommandMap>(
        type: K,
        payload: TheGangCommandMap[K],
        commandPlayerId = localPlayerId,
    ) => {
        if (isMultiplayer) {
            dispatch(type, payload);
            return;
        }

        dispatch(type, {
            ...(payload as Record<string, unknown>),
            __internalPlayerId: commandPlayerId,
        } as TheGangCommandMap[K]);
    };

    const updateChipDrag = (next: ChipDragState | null) => {
        chipDragRef.current = next;
        setChipDrag(next);
    };

    const emitChipDragMove = (drag: ChipDragState, event: { clientX: number; clientY: number }) => {
        if (!sendUiEvent || !drag.dragging) return;
        const now = Date.now();
        if (now - lastChipDragBroadcastAtRef.current < 48) return;
        lastChipDragBroadcastAtRef.current = now;
        const point = normalizeViewportPoint(event.clientX, event.clientY);
        sendUiEvent(CHIP_DRAG_UI_EVENT, {
            action: 'move',
            chip: drag.chip,
            round: core.round,
            origin: drag.origin,
            ...(drag.handSlot ? { handSlot: drag.handSlot } : {}),
            ...(drag.playerId ? { sourcePlayerId: drag.playerId } : {}),
            x: point.x,
            y: point.y,
        } satisfies ChipDragUiPayload);
    };

    const emitChipDragEnd = () => {
        if (!sendUiEvent) return;
        lastChipDragBroadcastAtRef.current = 0;
        sendUiEvent(CHIP_DRAG_UI_EVENT, {
            action: 'end',
        } satisfies ChipDragUiPayload);
    };

    const emitChipTransfer = (
        chip: number,
        origin: ChipDragOrigin,
        target: ChipTransferUiTarget,
        handSlot: HandSlot | undefined,
        sourcePlayerId: string | undefined,
        source?: ViewportPoint | Element | null,
    ) => {
        if (!sendUiEvent) return;
        const sourcePoint = source && 'nodeType' in source
            ? getElementViewportCenter(source)
            : source ?? undefined;
        const normalizedSource = sourcePoint
            ? normalizeViewportPoint(sourcePoint.x, sourcePoint.y)
            : undefined;
        sendUiEvent(CHIP_DRAG_UI_EVENT, {
            action: 'transfer',
            chip,
            round: core.round,
            origin,
            ...(handSlot ? { handSlot } : {}),
            ...(sourcePlayerId ? { sourcePlayerId } : {}),
            target,
            ...(normalizedSource ? { x: normalizedSource.x, y: normalizedSource.y } : {}),
        } satisfies ChipDragUiPayload);
    };

    const shouldSuppressChipClick = () => {
        if (!suppressNextChipClickRef.current) return false;
        suppressNextChipClickRef.current = false;
        return true;
    };

    const startChipTransferAnimation = (
        chip: number,
        round: TheGangRound,
        from: ViewportPoint | undefined,
        target: ChipDropTarget,
        playerId = localPlayerId,
    ) => {
        enqueueChipTransferAnimation(
            chip,
            round,
            from,
            getElementViewportCenter(resolveChipDropTargetElement(target)),
            playerId,
        );
    };

    const maybeAnimateChipTransfer = (
        chip: number,
        target: ChipDropTarget,
        from?: ViewportPoint | Element | null,
    ) => {
        const fromPoint = from && 'nodeType' in from
            ? getElementViewportCenter(from)
            : from ?? undefined;
        startChipTransferAnimation(chip, core.round, fromPoint, target);
    };

    const takeChipForHandSlot = (chip: number, handSlot = activeChipHandSlot, source?: ViewportPoint | Element | null) => {
        if (!heistStarted) {
            showWarning('board.toastStartBeforeChip', 'start-before-chip');
            return;
        }
        maybeAnimateChipTransfer(chip, { kind: 'local-hand', handSlot }, source);
        emitChipTransfer(chip, 'pool', { kind: 'hand', handSlot }, handSlot, undefined, source);
        dispatchForPlayer(THE_GANG_COMMANDS.TAKE_CHIP, {
            chip,
            ...(core.rules.config.twoHand ? { handSlot } : {}),
        });
    };

    const takeChip = (chip: number, event?: ChipClickEvent) => {
        if (shouldSuppressChipClick()) return;
        takeChipForHandSlot(chip, activeChipHandSlot, event?.currentTarget);
    };

    const returnChipForHandSlot = (handSlot = activeChipHandSlot, source?: ViewportPoint | Element | null) => {
        if (!chipInteractionOpen) return;
        const ownerKey = resolveChipOwnerKey(core, localPlayerId, handSlot);
        const chip = core.currentRoundChips[ownerKey];
        if (chip !== undefined) {
            maybeAnimateChipTransfer(chip, { kind: 'pool' }, source);
            emitChipTransfer(chip, 'local-hand', { kind: 'pool' }, handSlot, localPlayerId, source);
        }
        dispatchForPlayer(THE_GANG_COMMANDS.RETURN_CHIP, {
            ...(core.rules.config.twoHand ? { handSlot } : {}),
        });
    };

    const returnChip = (handSlot: HandSlot, event?: ChipClickEvent) => {
        if (shouldSuppressChipClick()) return;
        returnChipForHandSlot(handSlot, event?.currentTarget);
    };

    const getDropTargetAtPoint = (clientX: number, clientY: number) => (
        typeof document === 'undefined'
            ? undefined
            : (typeof document.elementsFromPoint === 'function'
                ? document.elementsFromPoint(clientX, clientY)
                : [document.elementFromPoint(clientX, clientY)].filter((element): element is Element => !!element))
                .map((element) => resolveChipDropTarget(element))
                .find((target): target is ChipDropTarget => !!target)
    );

    const resolveChipDrop = (source: ChipDragSource, target?: ChipDropTarget, sourcePoint?: ViewportPoint) => {
        if (!target) return;
        const dragSourcePoint = sourcePoint ?? {
            x: chipDragRef.current?.x ?? 0,
            y: chipDragRef.current?.y ?? 0,
        };
        if (target.kind === 'pool') {
            if (source.origin === 'local-hand') {
                returnChipForHandSlot(source.handSlot ?? activeChipHandSlot, dragSourcePoint);
            }
            return;
        }
        if (target.kind === 'local-hand') {
            const targetHandSlot = target.handSlot ?? activeChipHandSlot;
            if (source.origin === 'local-hand' && (source.handSlot ?? 'top') === targetHandSlot) return;
            takeChipForHandSlot(source.chip, targetHandSlot, dragSourcePoint);
        }
    };

    const clearChipDragGlobalEndListeners = () => {
        chipDragGlobalCleanupRef.current?.();
        chipDragGlobalCleanupRef.current = null;
    };

    const cancelChipDrag = (current: ChipDragState) => {
        clearChipDragGlobalEndListeners();
        if (current.dragging) {
            emitChipDragEnd();
        }
        updateChipDrag(null);
    };

    const finishChipDrag = (
        current: ChipDragState,
        target: ChipDropTarget | undefined,
        sourcePoint: ViewportPoint,
        event?: { preventDefault?: () => void },
    ) => {
        clearChipDragGlobalEndListeners();
        if (!current.dragging) {
            updateChipDrag(null);
            return;
        }

        suppressNextChipClickRef.current = true;
        updateChipDrag(null);
        resolveChipDrop(current, target, sourcePoint);
        emitChipDragEnd();
        event?.preventDefault?.();
    };

    const bindChipDragGlobalEndListeners = (pointerId: number) => {
        if (typeof window === 'undefined') return;
        clearChipDragGlobalEndListeners();

        const handlePointerUp = (event: PointerEvent) => {
            const current = chipDragRef.current;
            if (!current || current.pointerId !== pointerId) return;
            finishChipDrag(current, getDropTargetAtPoint(event.clientX, event.clientY), {
                x: event.clientX,
                y: event.clientY,
            }, event);
        };
        const handlePointerCancel = () => {
            const current = chipDragRef.current;
            if (!current || current.pointerId !== pointerId) return;
            cancelChipDrag(current);
        };

        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerCancel);
        chipDragGlobalCleanupRef.current = () => {
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerCancel);
        };
    };

    const getChipDragHandlers = (source: ChipDragSource): ChipDragHandlers => ({
        onPointerDown: (event) => {
            if (event.button !== 0 || !chipInteractionOpen) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            updateChipDrag({
                ...source,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                x: event.clientX,
                y: event.clientY,
                dragging: false,
            });
            bindChipDragGlobalEndListeners(event.pointerId);
        },
        onPointerMove: (event) => {
            const current = chipDragRef.current;
            if (!current || current.pointerId !== event.pointerId) return;
            const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
            const dragging = current.dragging || moved >= CHIP_DRAG_THRESHOLD;
            const nextDrag = {
                ...current,
                x: event.clientX,
                y: event.clientY,
                dragging,
                hoverTarget: dragging ? getDropTargetAtPoint(event.clientX, event.clientY) : undefined,
            };
            updateChipDrag(nextDrag);
            emitChipDragMove(nextDrag, event);
        },
        onPointerUp: (event) => {
            const current = chipDragRef.current;
            if (!current || current.pointerId !== event.pointerId) return;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            finishChipDrag(current, getDropTargetAtPoint(event.clientX, event.clientY), {
                x: event.clientX,
                y: event.clientY,
            }, event);
        },
        onPointerCancel: (event) => {
            const current = chipDragRef.current;
            if (!current || current.pointerId !== event.pointerId) return;
            cancelChipDrag(current);
        },
    });

    const updateCardDrag = (next: CardDragState | null) => {
        cardDragRef.current = next;
        setCardDrag(next);
    };

    const getCardDropTargetAtPoint = (clientX: number, clientY: number) => (
        typeof document === 'undefined'
            ? undefined
            : resolveCardDropTarget(document.elementFromPoint(clientX, clientY))
    );

    const swapDraggedCards = (source: CardDragSource, target?: CardDropTarget) => {
        if (!canDragSwapCards || !target || source.slot === target.slot) return;
        dispatchForPlayer(THE_GANG_COMMANDS.CONFIRM_HAND_SWAP, {
            topIndex: source.slot === 'top' ? source.index : target.index,
            bottomIndex: source.slot === 'bottom' ? source.index : target.index,
        });
    };

    const getCardDragHandlers = (source: CardDragSource): CardDragHandlers => ({
        onPointerDown: (event) => {
            if (event.button !== 0 || !canDragSwapCards) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            updateCardDrag({
                ...source,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                x: event.clientX,
                y: event.clientY,
                dragging: false,
            });
        },
        onPointerMove: (event) => {
            const current = cardDragRef.current;
            if (!current || current.pointerId !== event.pointerId) return;
            const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
            const dragging = current.dragging || moved >= CARD_DRAG_THRESHOLD;
            const nextDrag = {
                ...current,
                x: event.clientX,
                y: event.clientY,
                dragging,
                hoverTarget: dragging ? getCardDropTargetAtPoint(event.clientX, event.clientY) : undefined,
            };
            updateCardDrag(nextDrag);
            if (dragging) {
                event.preventDefault();
            }
        },
        onPointerUp: (event) => {
            const current = cardDragRef.current;
            if (!current || current.pointerId !== event.pointerId) return;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            if (current.dragging) {
                swapDraggedCards(current, getCardDropTargetAtPoint(event.clientX, event.clientY));
                event.preventDefault();
            }
            updateCardDrag(null);
        },
        onPointerCancel: (event) => {
            const current = cardDragRef.current;
            if (!current || current.pointerId !== event.pointerId) return;
            updateCardDrag(null);
        },
    });

    const takeExitChip = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.TAKE_EXIT_CHIP, {
            ...(core.rules.config.twoHand ? { handSlot: activeChipHandSlot } : {}),
        });
    };

    const setRulesConfig = (config: TheGangRulesConfig) => {
        dispatchForPlayer(THE_GANG_COMMANDS.SET_RULES_CONFIG, { config });
    };

    const dealTools = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.DEAL_TOOLS, {});
    };

    const resetTools = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.RESET_TOOLS, {});
    };

    const resetSpecialists = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.RESET_SPECIALISTS, {});
    };

    const useTool = (tool: TheGangToolId, cardIndex?: number) => {
        dispatchForPlayer(THE_GANG_COMMANDS.USE_TOOL, {
            tool,
            ...(typeof cardIndex === 'number' ? { cardIndex } : {}),
        });
    };

    const endRound = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.END_ROUND, {});
    };

    const revealShowdown = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.REVEAL_SHOWDOWN, {});
    };

    const startHeist = () => {
        if (!canConfigureRules) {
            showWarning('board.toastHostOnlyStart', 'host-only-start');
            return;
        }
        dispatchForPlayer(THE_GANG_COMMANDS.START_HEIST, {});
    };

    const redealHeist = () => {
        if (!canConfigureRules) {
            showWarning('board.toastHostOnlyRedeal', 'host-only-redeal');
            return;
        }
        dispatchForPlayer(THE_GANG_COMMANDS.REDEAL_HEIST, {});
    };

    const startNextHeist = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.START_NEXT_HEIST, {});
    };

    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!G.sys.gameover, isLocalMode: !isMultiplayer }}>
        <main
            className="the-gang-desktop-table h-full min-h-0 overflow-hidden bg-[#203b23] text-stone-50"
            data-game-ui="the-gang"
            data-the-gang-phase={core.phase}
            data-the-gang-two-hand={core.rules.config.twoHand ? 'true' : 'false'}
        >
            <section
                className="relative flex h-full min-h-0 w-full flex-col gap-1 overflow-hidden bg-[#203b23] px-4 pb-0 pt-3 lg:gap-2 lg:px-8 lg:pb-0 lg:pt-5 xl:gap-3 xl:px-12 xl:pb-0 xl:pt-7"
                data-layout-contract="bgg-electronic"
                data-layout-source={BGG_LAYOUT_CONTRACT.source}
                data-bgg-top-zone={BGG_LAYOUT_CONTRACT.topZone}
                data-bgg-middle-zone={BGG_LAYOUT_CONTRACT.middleZone}
                data-bgg-bottom-zone={BGG_LAYOUT_CONTRACT.bottomZone}
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(245,214,132,0.16),transparent_36%),radial-gradient(circle_at_50%_112%,rgba(5,8,5,0.55),transparent_42%),linear-gradient(90deg,rgba(245,214,132,0.06),transparent_18%,transparent_82%,rgba(245,214,132,0.06)),repeating-linear-gradient(135deg,rgba(255,255,255,0.028)_0,rgba(255,255,255,0.028)_1px,transparent_1px,transparent_20px)] opacity-80" />

                {chipDrag?.dragging && (
                    <HudPortal>
                        <div
                            className="pointer-events-none fixed -translate-x-1/2 -translate-y-1/2 scale-110 opacity-95 drop-shadow-[0_1.2rem_1.6rem_rgba(0,0,0,0.52)]"
                            data-testid="the-gang-chip-drag-ghost"
                            style={{
                                left: chipDrag.x,
                                top: chipDrag.y,
                                zIndex: UI_Z_INDEX.emergencyHud + 20,
                            }}
                        >
                            <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-100/60 bg-emerald-950/92 px-2 py-0.5 text-[0.62rem] font-black tracking-[0.08em] text-amber-100 shadow-[0_0.35rem_1rem_rgba(0,0,0,0.38)]">
                                {playerName(localPlayerId)}
                            </span>
                            <ChipDisc round={core.round} value={chipDrag.chip} size="lg" className="drop-shadow-[0_0_1.5rem_rgba(251,191,36,0.72)]" />
                        </div>
                    </HudPortal>
                )}

                {cardDrag?.dragging && (
                    <HudPortal>
                        <div
                            className="pointer-events-none fixed -translate-x-1/2 -translate-y-1/2 scale-110 opacity-95 drop-shadow-[0_1.35rem_1.8rem_rgba(0,0,0,0.58)]"
                            data-testid="the-gang-card-drag-ghost"
                            style={{
                                left: cardDrag.x,
                                top: cardDrag.y,
                                zIndex: UI_Z_INDEX.emergencyHud + 21,
                            }}
                        >
                            <CardFace card={cardDrag.card} emphasis={localHandCardEmphasis} t={t} />
                        </div>
                    </HudPortal>
                )}

                {chipTransferAnimations.length > 0 && (
                    <HudPortal>
                        {chipTransferAnimations.map((animation) => {
                            const position = animation.settled ? animation.to : animation.from;
                            const path = getChipTransferPathMetrics(animation);
                            const transferAriaLabel = animation.playerId
                                ? `${playerName(animation.playerId)} · ${animation.chip}★`
                                : `${animation.chip}★`;
                            return (
                                <div key={animation.id} className="contents">
                                    <span
                                        aria-hidden="true"
                                        className="the-gang-chip-transfer-line"
                                        data-testid="the-gang-chip-transfer-line"
                                        data-player-id={animation.playerId}
                                        data-chip-value={animation.chip}
                                        style={{
                                            animationDuration: `${CHIP_TRANSFER_ANIMATION_MS}ms`,
                                            left: animation.from.x,
                                            top: animation.from.y,
                                            transform: `translate3d(0, -50%, 0) rotate(${path.angleDeg}deg)`,
                                            width: path.length,
                                            zIndex: UI_Z_INDEX.emergencyHud + 18,
                                        }}
                                    />
                                    <div
                                        aria-label={transferAriaLabel}
                                        className="pointer-events-none fixed left-0 top-0 drop-shadow-[0_1rem_1.45rem_rgba(0,0,0,0.46)] transition-[transform,opacity] ease-out motion-reduce:transition-none"
                                        data-testid="the-gang-chip-transfer-animation"
                                        data-player-id={animation.playerId}
                                        data-chip-value={animation.chip}
                                        style={{
                                            opacity: animation.settled ? 0 : 0.98,
                                            transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) scale(${animation.settled ? 0.86 : 1.08})`,
                                            transitionDuration: `${CHIP_TRANSFER_ANIMATION_MS}ms`,
                                            zIndex: UI_Z_INDEX.emergencyHud + 19,
                                        }}
                                    >
                                        <ChipDisc
                                            round={animation.round}
                                            value={animation.chip}
                                            size="lg"
                                            className="drop-shadow-[0_0_1.35rem_rgba(251,191,36,0.72)]"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </HudPortal>
                )}

                {Object.values(remoteChipDrags).length > 0 && (
                    <HudPortal>
                        {Object.values(remoteChipDrags)
                            .sort((left, right) => core.playerIds.indexOf(left.playerId) - core.playerIds.indexOf(right.playerId))
                            .map((drag, index) => {
                                const offsetX = ((index % 3) - 1) * 16;
                                const offsetY = Math.floor(index / 3) * 14;
                                return (
                                    <div
                                        key={drag.playerId}
                                        className="pointer-events-none fixed opacity-[0.92] drop-shadow-[0_1.2rem_1.6rem_rgba(0,0,0,0.48)]"
                                        data-testid={`the-gang-remote-chip-drag-${drag.playerId}`}
                                        data-player-id={drag.playerId}
                                        data-chip-value={drag.chip}
                                        style={{
                                            left: `${drag.x * 100}vw`,
                                            top: `${drag.y * 100}vh`,
                                            transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(1.05)`,
                                            zIndex: UI_Z_INDEX.emergencyHud + 18 + index,
                                        }}
                                    >
                                        <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-100/65 bg-slate-950/94 px-2.5 py-0.5 text-[0.68rem] font-black tracking-[0.08em] text-sky-100 shadow-[0_0.35rem_1rem_rgba(0,0,0,0.4)] lg:text-xs">
                                            {`${playerName(drag.playerId)} · ${drag.chip}★`}
                                        </span>
                                        <ChipDisc round={drag.round} value={drag.chip} size="lg" className="drop-shadow-[0_0_1.35rem_rgba(125,211,252,0.62)]" />
                                    </div>
                                );
                            })}
                    </HudPortal>
                )}

                <HudPortal>
                    <div
                        className="pointer-events-none fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))] z-50 flex flex-col items-start gap-1.5 min-[901px]:gap-2 lg:bottom-[max(1rem,env(safe-area-inset-bottom))] lg:left-[max(1rem,env(safe-area-inset-left))]"
                        data-bgg-zone="utility-dock"
                        data-testid="the-gang-utility-dock"
                    >
                        <HandRankReference rules={handRankRules} />
                        <RulesConfigPanel
                            config={core.rules.config}
                            restartOnChange={rulesChangeRestarts}
                            canConfigure={canConfigureRules}
                            playerCount={core.playerIds.length}
                            onChange={setRulesConfig}
                            onBlockedEdit={showRulesBlockedToast}
                        />
                        <ToolsPanel
                            core={core}
                            localPlayerId={localPlayerId}
                            canConfigure={canConfigureRules}
                            onDealTools={dealTools}
                            onResetTools={resetTools}
                            onResetSpecialists={resetSpecialists}
                            onUseTool={useTool}
                            onBlockedHostAction={() => showWarning('board.toastToolsHostOnly', 'tools-host-only')}
                            onToolsAlreadyDealt={() => showWarning('board.toastToolsAlreadyDealt', 'tools-already-dealt')}
                        />
                    </div>
                </HudPortal>

                <div className="sr-only" data-tutorial-id="the-gang-title">
                    <p>{t('title.secondary')}</p>
                    <h1>{t('title.primary')}</h1>
                </div>

                <HudPortal>
                    <div className="pointer-events-none fixed right-[max(0.875rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex max-w-[min(42rem,calc(100vw-1.75rem))] flex-wrap justify-end gap-3 text-[0.7rem] font-black tracking-[0.08em] lg:right-[max(1.375rem,env(safe-area-inset-right))] lg:top-[max(1.125rem,env(safe-area-inset-top))] lg:gap-4 lg:text-sm xl:text-base" data-tutorial-id="the-gang-score-track">
                        <span className="text-amber-100">{t('board.heistNumber', { heist: core.heistNumber })}</span>
                        <SuccessTrack successes={core.successes} />
                        <AlarmTrack failures={core.failures} />
                        <TableReminderBadges config={core.rules.config} />
                    </div>
                </HudPortal>

                <section
                    className={[
                        'pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-visible lg:gap-2 xl:gap-3',
                        twoHandChipSelectionLayout
                            ? 'pb-28 lg:pb-[clamp(15rem,30vh,20rem)] xl:pb-[clamp(16rem,32vh,22rem)]'
                            : 'pb-[clamp(5.5rem,22vh,9rem)] lg:pb-[clamp(8.5rem,20vh,13.5rem)]',
                    ].join(' ')}
                    data-testid="the-gang-bgg-board"
                >
                    <section
                        className="pointer-events-auto flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-1 overflow-visible lg:gap-x-8 lg:gap-y-2"
                        data-bgg-zone="top-zone"
                        data-tutorial-id="the-gang-player-list"
                    >
                        {opponentPlayerIds.map((id) => {
                            return (
                                <div
                                    key={id}
                                    className="flex min-w-0 basis-[10rem] flex-col items-center gap-0.5 lg:basis-[15rem] lg:gap-1 xl:basis-[18rem]"
                                    data-bgg-zone="plboard"
                                    data-testid={`the-gang-player-board-${id}`}
                                    data-tutorial-id={id === tutorialOpponentTargetId ? 'the-gang-opponent-state' : undefined}
                                >
                                    <span className="truncate text-xs font-black tracking-[0.08em] text-stone-100/72 lg:text-sm">
                                        {playerName(id)}
                                    </span>
                                    <PlayerChipStrip
                                        roundHistory={core.roundHistory}
                                        currentRound={core.round}
                                        currentChips={buildCurrentChipDisplays(core, id)}
                                        playerId={id}
                                        localPlayerId={localPlayerId}
                                        onTakeCurrentChip={heistStarted && core.phase === 'chip-selection' ? takeChip : undefined}
                                        getChipDragHandlers={getChipDragHandlers}
                                        chipDrag={chipDrag}
                                    />
                                </div>
                            );
                        })}
                    </section>

                    <section
                        className={[
                            'pointer-events-none relative z-20 flex min-h-0 flex-1 justify-center overflow-visible',
                            'items-center',
                        ].join(' ')}
                        data-tutorial-id="the-gang-round-panel"
                        data-bgg-zone="middle-zone"
                    >
                        <div
                            className={[
                                'pointer-events-none relative z-20 flex min-h-0 items-center justify-center overflow-visible',
                                twoHandChipSelectionLayout
                                    ? 'flex-col gap-8 lg:gap-5'
                                    : 'flex-col gap-3 lg:gap-6',
                            ].join(' ')}
                            style={middleCenterStyle}
                            data-bgg-zone="middle-center"
                        >
                             <div
                                 className={[
                                     'pointer-events-auto relative z-30 flex flex-wrap items-center justify-center overflow-visible',
                                     twoHandChipSelectionLayout
                                         ? 'w-auto max-w-none flex-nowrap gap-2 lg:gap-3'
                                         : 'w-full max-w-[29rem] gap-3 lg:max-w-[44rem] lg:gap-5',
                                     poolChipDropTargetClass,
                                 ].join(' ')}
                                 data-tutorial-id="the-gang-chip-row"
                                 data-bgg-zone="token-pile"
                                 data-the-gang-chip-drop-target="pool"
                                 data-the-gang-chip-drop-state={poolChipDropState}
                                 data-the-gang-drop-range-ui={poolChipDropState ? 'open-right-gradient' : undefined}
                                 title={t('board.dragChipHint')}
                             >
                                <LayoutContractBadge />
                                {[1, 2, 3, 4].map((round) => (
                                    <RoundChipColumn
                                        key={round}
                                        round={round}
                                        chipValues={availableChipValues}
                                        selectedChip={localSelectedChip}
                                        onTakeChip={takeChip}
                                        getChipDragHandlers={getChipDragHandlers}
                                        chipDrag={chipDrag}
                                        remotePoolDragChipValues={remotePoolDragChipValues}
                                        active={core.phase === 'chip-selection' && core.round === round}
                                    />
                                ))}
                                {core.phase === 'chip-selection' && core.round === 4 && remainingExitChipCount > 0 && (
                                    <div
                                        className="flex flex-wrap items-center justify-center gap-2 border-l border-sky-100/25 pl-2 lg:gap-3 lg:pl-3"
                                        data-testid="the-gang-exit-chip-row"
                                        aria-label={t('board.exitChipRowLabel', { count: requiredExitChipCount })}
                                    >
                                        {Array.from({ length: remainingExitChipCount }, (_, index) => {
                                            const exitIndex = takenExitChipCount + index + 1;
                                            return (
                                                <ExitChipButton
                                                    key={`exit-chip-${exitIndex}`}
                                                    index={exitIndex}
                                                    total={requiredExitChipCount}
                                                    selected={false}
                                                    disabled={!localCanTakeExitChip}
                                                    onClick={takeExitChip}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div
                                className="pointer-events-none flex w-full max-w-[48rem] flex-nowrap justify-center gap-3 lg:max-w-[72rem] lg:gap-5 xl:max-w-[80rem]"
                                data-bgg-zone="card-river"
                                aria-label={t('board.communityCardsSlot')}
                            >
                                {core.communityCards.map((card, index) => (
                                    <div
                                        key={index}
                                        className={[
                                            'rounded-xl border-[0.35rem] p-1 ring-2 transition-colors',
                                            COMMUNITY_CARD_FRAME_CLASSES[index] ?? COMMUNITY_CARD_FRAME_CLASSES[4],
                                        ].join(' ')}
                                        data-community-card-frame={index < 3 ? 'yellow' : index === 3 ? 'orange' : 'red'}
                                    >
                                        <CardFace card={card} emphasis="river" t={t} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-end justify-center overflow-visible pb-0" data-bgg-zone="bottom-zone">
                        <VaultsAlarmsZone successes={core.successes} failures={core.failures} />

                        <div
                            className="pointer-events-auto relative flex flex-col items-center gap-1.5 lg:gap-2"
                            data-bgg-zone="hand-groupzone"
                            data-tutorial-id="the-gang-hand"
                        >
                            <span className="sr-only">{t('board.myHand')}</span>
                            <div className="relative flex items-center justify-center overflow-visible" data-bgg-zone="hand-cards">
                                {showChipHandSelector && (
                                    <div
                                        className="pointer-events-auto absolute bottom-12 right-[calc(100%+3rem)] z-50 flex justify-center lg:right-[calc(100%+1.5rem)]"
                                        data-bgg-zone="chip-hand-selector-dock"
                                    >
                                        <ChipHandSelector
                                            activeSlot={activeChipHandSlot}
                                            onSelect={setActiveChipHandSlot}
                                        />
                                    </div>
                                )}
                                <HandCardRows
                                    primaryCards={localPlayer?.pocketCards ?? []}
                                    secondaryCards={localPlayer?.secondaryPocketCards}
                                    emphasis={localHandCardEmphasis}
                                    t={t}
                                    testIdPrefix="the-gang-local-hand"
                                    showLabels={hasSecondaryHand}
                                    rankHints={localHandRankHints}
                                    canDragSwapCards={canDragSwapCards}
                                    cardDrag={cardDrag}
                                    cardDropActiveKey={activeCardDropTargetKey}
                                    getCardDragHandlers={getCardDragHandlers}
                                    chipDisplays={localCurrentChips}
                                    chipRoundHistory={core.roundHistory}
                                    currentRound={core.round}
                                    chipOwnerId={localPlayerId}
                                    chipDropStates={localHandChipDropStates}
                                    chipDrag={chipDrag}
                                    chipDropActiveSlot={activeChipDropTargetKey === 'local-hand:top'
                                        ? 'top'
                                        : activeChipDropTargetKey === 'local-hand:bottom'
                                        ? 'bottom'
                                        : undefined}
                                    canReturnCurrentChip={chipInteractionOpen}
                                    onReturnCurrentChip={returnChip}
                                    getChipDragHandlers={getChipDragHandlers}
                                />
                            </div>
                            {(localPlayer?.flashlightCards.length ?? 0) + (localPlayer?.nightVisionCards.length ?? 0) > 0 && (
                                <div className="flex items-center justify-center gap-2" data-bgg-zone="tool-cards" data-testid="the-gang-tool-cards">
                                    {localPlayer?.flashlightCards.map((card, index) => (
                                        <CardFace key={`flashlight-${card.rank}-${card.suit}-${index}`} card={card} t={t} />
                                    ))}
                                    {localPlayer?.nightVisionCards.map((card, index) => (
                                        <CardFace key={`night-vision-${card.rank}-${card.suit}-${index}`} card={card} t={t} />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pointer-events-auto absolute bottom-0 right-24 flex min-w-[7rem] flex-col items-center gap-1 lg:right-28" data-bgg-zone="action-dock">
                            {setupOpen && (
                                <>
                                    <button
                                        type="button"
                                        aria-disabled={!canConfigureRules}
                                        onClick={redealHeist}
                                        data-testid="the-gang-redeal-heist"
                                        className={[
                                            'min-w-[5.75rem] rounded-full border px-4 py-1.5 text-xs font-black tracking-[0.08em] shadow-[0_0.25rem_1rem_rgba(0,0,0,0.34)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 lg:min-w-[7rem] lg:px-5 lg:py-2 lg:text-sm',
                                            canConfigureRules
                                                ? 'cursor-pointer border-amber-100/35 bg-emerald-950/92 text-amber-100 hover:-translate-y-0.5 hover:border-amber-100 hover:bg-emerald-900'
                                                : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400 shadow-none',
                                        ].join(' ')}
                                    >
                                        {t(canConfigureRules ? 'board.redealHeist' : 'board.setupWaitingHost')}
                                    </button>
                                    <button
                                        type="button"
                                        aria-disabled={!canConfigureRules}
                                        onClick={startHeist}
                                        data-testid="the-gang-start-heist"
                                        data-tutorial-id="the-gang-start-heist"
                                        className={[
                                            'min-w-[5.75rem] rounded-full border px-5 py-2.5 text-base font-black tracking-[0.08em] shadow-[0_12px_28px_rgba(245,158,11,0.36)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 lg:min-w-[7rem] lg:px-7 lg:py-3.5 lg:text-lg',
                                            canConfigureRules
                                                ? 'cursor-pointer border-amber-200/75 bg-amber-300 text-stone-950 hover:-translate-y-0.5 hover:bg-amber-200'
                                                : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400 shadow-none',
                                        ].join(' ')}
                                    >
                                        {t(canConfigureRules ? 'board.startHeist' : 'board.setupWaitingHost')}
                                    </button>
                                </>
                            )}
                            {heistStarted && core.phase === 'chip-selection' && core.round < 4 && (
                                <button
                                    type="button"
                                    disabled={!allPlayersHaveChip || nextRoundProgress.hasApproved}
                                    onClick={endRound}
                                    data-tutorial-id="the-gang-next-round"
                                    className="min-w-[5.75rem] rounded-full border border-amber-200/75 bg-amber-300 px-5 py-2.5 text-base font-black tracking-[0.08em] text-stone-950 shadow-[0_12px_28px_rgba(245,158,11,0.36)] transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 disabled:cursor-not-allowed disabled:border-stone-600/70 disabled:bg-stone-700/75 disabled:text-stone-400 disabled:shadow-none disabled:hover:translate-y-0 lg:min-w-[7rem] lg:px-7 lg:py-3.5 lg:text-lg"
                                >
                                    {nextRoundProgress.label}
                                </button>
                            )}
                            {heistStarted && core.phase === 'chip-selection' && core.round === 4 && (
                                <button
                                    type="button"
                                    disabled={!allFinalTokensTaken || revealShowdownProgress.hasApproved}
                                    onClick={revealShowdown}
                                    data-tutorial-id="the-gang-reveal-showdown"
                                    className="min-w-[5.75rem] rounded-full border border-rose-200/80 bg-rose-400 px-5 py-2.5 text-base font-black tracking-[0.08em] text-stone-950 shadow-[0_12px_30px_rgba(244,63,94,0.38)] transition hover:-translate-y-0.5 hover:bg-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-100 disabled:cursor-not-allowed disabled:border-stone-600/70 disabled:bg-stone-700/75 disabled:text-stone-400 disabled:shadow-none disabled:hover:translate-y-0 lg:min-w-[7rem] lg:px-7 lg:py-3.5 lg:text-lg"
                                >
                                    {revealShowdownProgress.label}
                                </button>
                            )}
                            {heistStarted && (core.round < 4 ? allPlayersHaveChip : allFinalTokensTaken) && core.phase === 'chip-selection' && (
                                <ProgressVoteDots
                                    approvals={core.round < 4 ? nextRoundProgress.approvals : revealShowdownProgress.approvals}
                                    label={core.round < 4 ? nextRoundProgress.status : revealShowdownProgress.status}
                                    playerIds={core.playerIds}
                                />
                            )}
                        </div>

                    </section>

                    <div data-tutorial-id="the-gang-showdown-area">
                        {core.lastShowdown && (
                            <ShowdownResultPanel
                                lastShowdown={core.lastShowdown}
                                communityCards={core.communityCards}
                                playerName={playerName}
                                onNextHeist={startNextHeist}
                                nextHeistProgress={nextHeistProgress}
                                playerIds={core.playerIds}
                            />
                        )}
                    </div>
                </section>
            </section>
            <EndgameOverlay
                {...endgameProps}
                renderContent={(props) => (
                    <TheGangEndgameContent
                        {...props}
                        successes={core.successes}
                        failures={core.failures}
                    />
                )}
            />
        </main>
        <style>{`
            @keyframes the-gang-card-reveal {
                0% {
                    opacity: 0;
                    transform: perspective(42rem) rotateY(78deg) translateY(0.65rem) scale(0.94);
                    filter: brightness(0.72) saturate(0.85);
                }
                54% {
                    opacity: 1;
                    transform: perspective(42rem) rotateY(-8deg) translateY(-0.1rem) scale(1.03);
                    filter: brightness(1.12) saturate(1.08);
                }
                100% {
                    opacity: 1;
                    transform: perspective(42rem) rotateY(0deg) translateY(0) scale(1);
                    filter: brightness(1) saturate(1);
                }
            }
        `}</style>
        </UndoProvider>
    );
}
