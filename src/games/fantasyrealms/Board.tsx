import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Search } from 'lucide-react';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorialBridge } from '../../contexts/TutorialContext';
import { useGameMode } from '../../contexts/GameModeContext';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { DEFAULT_TUTORIAL_STATE, type TutorialState, type TutorialStepSnapshot } from '../../engine/types';
import { MagnifyOverlay } from '../../components/common/overlays/MagnifyOverlay';
import {
    getFantasyRealmsBaseHandLimit,
    getFantasyRealmsDiscardEndThreshold,
    getFantasyRealmsCardDisplayName,
    getFantasyRealmsCardRuleText,
    type TableCard,
} from './foundation';
import {
    evaluateFantasyRealmsScore,
    getDeckDrawCount,
    isDuelVariant,
    type FantasyRealmsCommandMap,
    type FantasyRealmsCore,
    type FantasyRealmsPlayerState,
} from './domain';
import { getFantasyRealmsCardBackStyle, getFantasyRealmsCardFaceStyle } from './ui/cardAtlas';
import { ScoreBurstBadge } from '../../components/common/animations/ScoreBurstBadge';
import { useTouchInspectGesture } from '../../hooks/ui/useTouchInspectGesture';
import { playSound, useGameAudio } from '../../lib/audio/useGameAudio';
import { ENDGAME_SCORE_STEP_KEY, FANTASY_REALMS_AUDIO_CONFIG } from './audio.config';
import { FANTASY_REALMS_AUDIO_EVENT_KEYS } from './domain/events';
import {
    FANTASY_REALMS_MANIFEST,
    FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_WIDTH_PX,
} from './manifest';

type Props = GameBoardProps<FantasyRealmsCore, FantasyRealmsCommandMap>;
const EMPTY_MATCH_DATA: NonNullable<Props['matchData']> = [];

type CardRowSlot = {
    key: string;
    card?: TableCard;
};

type LiveCenterSlot = {
    key: string;
    card: TableCard | null;
    style: React.CSSProperties;
};

type Translator = (key: string, options?: Record<string, unknown>) => string;

type LiveMotionCueType = 'draw-to-hand' | 'center-to-hand' | 'hand-to-center' | 'opening-deal';

type LiveMotionCue = {
    type: LiveMotionCueType;
    key: number;
    cardIds: string[];
} | null;

type LiveCenterMotionOverlay = {
    type: 'enter' | 'exit';
    playerName: string;
    cueKey: number;
    slotStyle: React.CSSProperties;
    card: TableCard;
} | null;

type LiveCenterHeldCard = {
    cardId: string;
    cueKey: number;
} | null;

type LiveHandHeldCard = {
    cardId: string;
    cueKey: number;
} | null;

type LiveActionButtonConfig = {
    key: string;
    mode: 'draw' | 'take-discard' | 'discard';
    label: string;
    testId: string;
    selected?: boolean;
    disabled?: boolean;
    onClick: () => void;
};

type LiveMotionSnapshot = {
    viewerPlayerId: string | null;
    currentPlayer: string;
    stage: FantasyRealmsCore['stage'];
    handIds: string[];
    handCards: TableCard[];
    discardIds: string[];
    discardCards: TableCard[];
    drawPileCount: number;
    isGameOver: boolean;
};

type LiveMotionWindow = Window & {
    __FR_LIVE_MOTION_LAST_SNAPSHOT__?: LiveMotionSnapshot;
    __FR_OPENING_DEAL_SOUND_GUARD__?: {
        signature: string;
        clearTimer: number;
    };
    __FR_DEBUG_OPENING_LOOP__?: boolean;
};

type EndgameScoreStep = {
    key: string;
    cardId?: string;
    label: string;
    delta: number;
};

type EndgameScoreSequenceState = {
    displayTotal: number;
    activeStep: EndgameScoreStep | null;
    isRunning: boolean;
    isTotalPulsing: boolean;
    steps: EndgameScoreStep[];
};

const ENDGAME_SCORE_STEP_DELAY_MS = 180;
const ENDGAME_SCORE_STEP_MS = 460;
const ENDGAME_SCORE_PULSE_MS = 220;
const ENDGAME_SCORE_SETTLE_MS = 220;
const FANTASY_REALMS_BOARD_SHELL_SCOPE = '[data-game-page][data-game-id="fantasyrealms"][data-mobile-layout-preset="board-shell"][data-mobile-profile="landscape-adapted"]';
const FANTASY_REALMS_LIVE_DESKTOP_BOARD_INLINE_PADDING_PX = 16;
const FANTASY_REALMS_OPENING_HAND_ROW_WIDTH_RATIO = 1180 / FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_WIDTH_PX;
const FANTASY_REALMS_DEFAULT_HAND_ROW_WIDTH_RATIO = 1510 / FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_WIDTH_PX;

function debugFantasyRealmsOpeningLoop(label: string, payload?: Record<string, unknown>): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (!(window as LiveMotionWindow).__FR_DEBUG_OPENING_LOOP__) {
        return;
    }
    console.debug('[FantasyRealmsOpeningLoop]', label, payload ?? {});
}

function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function buildFantasyRealmsEndgameScoreSteps(
    hand: readonly TableCard[],
    discardPile: readonly TableCard[],
    finalScore: number,
    scoringOptions?: Parameters<typeof evaluateFantasyRealmsScore>[2],
): EndgameScoreStep[] {
    const evaluation = evaluateFantasyRealmsScore(hand, discardPile, scoringOptions);
    const cardOrder = new Map(hand.map((card, index) => [card.id, index]));
    const visibleCardSteps: EndgameScoreStep[] = evaluation.cardDeltas
        .filter((entry) => cardOrder.has(entry.cardId) && entry.totalDelta !== 0)
        .sort((left, right) => (cardOrder.get(left.cardId) ?? 0) - (cardOrder.get(right.cardId) ?? 0))
        .map((entry) => ({
            key: `card:${entry.cardId}`,
            cardId: entry.cardId,
            label: entry.label,
            delta: entry.totalDelta,
        }));

    const visibleTotal = visibleCardSteps.reduce((sum, entry) => sum + entry.delta, 0);
    const remainder = finalScore - visibleTotal;
    if (remainder !== 0) {
        visibleCardSteps.push({
            key: `adjustment:${remainder}`,
            label: '额外结算',
            delta: remainder,
        });
    }

    return visibleCardSteps;
}

function buildFantasyRealmsEndgameCardDeltaById(
    hand: readonly TableCard[],
    discardPile: readonly TableCard[],
    scoringOptions?: Parameters<typeof evaluateFantasyRealmsScore>[2],
): Map<string, number> {
    const evaluation = evaluateFantasyRealmsScore(hand, discardPile, scoringOptions);
    return new Map(
        evaluation.cardDeltas
            .filter((entry) => entry.totalDelta !== 0)
            .map((entry) => [entry.cardId, entry.totalDelta] as const),
    );
}

function formatSignedDelta(delta: number): string {
    return delta >= 0 ? `+${delta}` : String(delta);
}

function useFantasyRealmsEndgameScoreSequence(
    enabled: boolean,
    hand: readonly TableCard[],
    discardPile: readonly TableCard[],
    finalScore: number,
    scoringOptions?: Parameters<typeof evaluateFantasyRealmsScore>[2],
): EndgameScoreSequenceState {
    const steps = React.useMemo(
        () => (enabled ? buildFantasyRealmsEndgameScoreSteps(hand, discardPile, finalScore, scoringOptions) : []),
        [discardPile, enabled, finalScore, hand, scoringOptions],
    );
    const sequenceSignature = React.useMemo(
        () => (enabled
            ? `${finalScore}:${steps.map((step) => `${step.key}:${step.delta}`).join('|')}`
            : 'disabled'),
        [enabled, finalScore, steps],
    );
    const lastPlayedSignatureRef = React.useRef<string | null>(null);
    const [displayTotal, setDisplayTotal] = React.useState(finalScore);
    const [activeStepIndex, setActiveStepIndex] = React.useState(-1);
    const [isRunning, setIsRunning] = React.useState(false);
    const [isTotalPulsing, setIsTotalPulsing] = React.useState(false);

    React.useEffect(() => {
        if (!enabled) {
            lastPlayedSignatureRef.current = null;
            setDisplayTotal(finalScore);
            setActiveStepIndex(-1);
            setIsRunning(false);
            setIsTotalPulsing(false);
            return undefined;
        }

        if (
            typeof window === 'undefined'
            || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
            || steps.length === 0
        ) {
            lastPlayedSignatureRef.current = sequenceSignature;
            setDisplayTotal(finalScore);
            setActiveStepIndex(-1);
            setIsRunning(false);
            setIsTotalPulsing(false);
            return undefined;
        }

        if (lastPlayedSignatureRef.current === sequenceSignature) {
            setDisplayTotal(finalScore);
            setActiveStepIndex(-1);
            setIsRunning(false);
            setIsTotalPulsing(false);
            return undefined;
        }

        let cumulative = 0;
        const timers: number[] = [];
        setDisplayTotal(0);
        setActiveStepIndex(-1);
        setIsRunning(true);
        setIsTotalPulsing(false);

        steps.forEach((step, index) => {
            const startedAt = ENDGAME_SCORE_STEP_DELAY_MS + (index * ENDGAME_SCORE_STEP_MS);
            timers.push(window.setTimeout(() => {
                cumulative += step.delta;
                setActiveStepIndex(index);
                setDisplayTotal(cumulative);
                setIsTotalPulsing(true);
            }, startedAt));
            timers.push(window.setTimeout(() => {
                setIsTotalPulsing(false);
            }, startedAt + ENDGAME_SCORE_PULSE_MS));
        });

        const finishAt = ENDGAME_SCORE_STEP_DELAY_MS + (steps.length * ENDGAME_SCORE_STEP_MS) + ENDGAME_SCORE_SETTLE_MS;
        timers.push(window.setTimeout(() => {
            setDisplayTotal(finalScore);
            setActiveStepIndex(-1);
            setIsRunning(false);
            setIsTotalPulsing(false);
            lastPlayedSignatureRef.current = sequenceSignature;
        }, finishAt));

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [enabled, finalScore, sequenceSignature, steps]);

    return {
        displayTotal,
        activeStep: activeStepIndex >= 0 ? steps[activeStepIndex] ?? null : null,
        isRunning,
        isTotalPulsing,
        steps,
    };
}

const LIVE_CENTER_ROW_ROW_TOP = 8;
const LIVE_CENTER_DEFAULT_TOP_ROW_CARD_COUNT = 6;
const LIVE_CENTER_CARD_WIDTH_FIT_UNITS = 9.15;
const LIVE_CENTER_CARD_STRIDE_MULTIPLIER = 1.18;
const LIVE_CENTER_SECOND_ROW_COLUMN_OFFSET_MULTIPLIER = -0.5;
const LIVE_CENTER_SECOND_ROW_OVERLAP_MULTIPLIER = 0.41;
const LIVE_CENTER_SECOND_ROW_TOP_CSS_VAR = 'var(--fr-live-center-second-row-top)';
const LIVE_CENTER_CARD_WIDTH_CSS_VAR = 'var(--fr-live-center-card-width)';
const LIVE_CENTER_CARD_STRIDE_CSS_VAR = 'var(--fr-live-center-card-stride)';
const LIVE_CENTER_CARD_WIDTH_PX = 206;
const LIVE_CENTER_CARD_MIN_WIDTH_PX = 96;
const LIVE_CENTER_ROW_Z_STRIDE = 8;

function createFallbackCore(): FantasyRealmsCore {
    const emptyScore = evaluateFantasyRealmsScore([], []);
    return {
        setupConfig: {
            variant: 'duel',
            expansion: 'base',
            cursedHoardSuitsEnabled: false,
        },
        playerIds: ['0', '1'],
        currentPlayer: '0',
        turn: 1,
        stage: 'draw',
        drawPile: [],
        discardPile: [],
        players: {
            '0': {
                id: '0',
                name: '玩家1',
                hand: [],
                score: emptyScore.totalScore,
                scoreBreakdown: emptyScore.scoreBreakdown.map((line) => ({ ...line })),
            },
            '1': {
                id: '1',
                name: '玩家2',
                hand: [],
                score: emptyScore.totalScore,
                scoreBreakdown: emptyScore.scoreBreakdown.map((line) => ({ ...line })),
            },
        },
        focusCardId: null,
    };
}

function isFantasyRealmsPlayerState(value: unknown): value is FantasyRealmsPlayerState {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<FantasyRealmsPlayerState>;
    return typeof candidate.id === 'string'
        && Array.isArray(candidate.hand)
        && typeof candidate.score === 'number'
        && Array.isArray(candidate.scoreBreakdown);
}

function isFantasyRealmsCore(value: unknown): value is FantasyRealmsCore {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<FantasyRealmsCore>;
    return Array.isArray(candidate.drawPile)
        && Array.isArray(candidate.discardPile)
        && typeof candidate.currentPlayer === 'string'
        && (candidate.stage === 'draw' || candidate.stage === 'discard')
        && candidate.players != null
        && typeof candidate.players === 'object'
        && Object.values(candidate.players).every(isFantasyRealmsPlayerState);
}

function buildMinimalLiveCenterTopRowCardCount(totalSlotCount: number): number {
    if (totalSlotCount <= 10) {
        return Math.ceil(totalSlotCount / 2);
    }
    return Math.min(LIVE_CENTER_DEFAULT_TOP_ROW_CARD_COUNT + 1, Math.ceil(totalSlotCount / 2));
}

function buildMinimalLiveCenterCardStyles(slotCount: number, topRowCardCount = LIVE_CENTER_DEFAULT_TOP_ROW_CARD_COUNT): React.CSSProperties[] {
    if (slotCount <= 0) return [];

    const fixedSlotStyles: React.CSSProperties[] = [];
    const topRowCount = Math.min(slotCount, topRowCardCount);
    const pushAbsoluteRow = (rowCount: number, rowIndex: number) => {
        const rowBaseZIndex = rowIndex * LIVE_CENTER_ROW_Z_STRIDE;
        Array.from({ length: rowCount }, (_unused, columnIndex) => {
            const rowWidthExpression = `${LIVE_CENTER_CARD_WIDTH_CSS_VAR} + ((${topRowCardCount - 1}) * ${LIVE_CENTER_CARD_STRIDE_CSS_VAR})`;
            const startExpression = `(${rowWidthExpression}) / -2`;
            const rowOffsetExpression = rowIndex === 1
                ? ` + (${LIVE_CENTER_SECOND_ROW_COLUMN_OFFSET_MULTIPLIER} * ${LIVE_CENTER_CARD_WIDTH_CSS_VAR})`
                : '';
            const columnExpression = columnIndex <= 0 ? '' : ` + (${columnIndex} * ${LIVE_CENTER_CARD_STRIDE_CSS_VAR})`;
            const left = `${startExpression}${rowOffsetExpression}${columnExpression}`;
            const centerBias = Math.abs(columnIndex - ((rowCount - 1) / 2));
            fixedSlotStyles.push({
                left: `calc(50% + ${left})`,
                top: rowIndex === 0 ? `${LIVE_CENTER_ROW_ROW_TOP}px` : LIVE_CENTER_SECOND_ROW_TOP_CSS_VAR,
                zIndex: rowBaseZIndex + (rowCount - Math.round(centerBias)),
            });
        });
    };
    if (slotCount <= topRowCardCount) {
        pushAbsoluteRow(topRowCount, 0);
        return fixedSlotStyles;
    }

    const secondRowCount = Math.min(slotCount - topRowCardCount, topRowCardCount);
    pushAbsoluteRow(topRowCount, 0);
    pushAbsoluteRow(secondRowCount, 1);
    return fixedSlotStyles;
}

function buildMinimalLiveCenterSlots(cards: TableCard[], totalSlotCount: number): LiveCenterSlot[] {
    const slotStyles = buildMinimalLiveCenterCardStyles(totalSlotCount, buildMinimalLiveCenterTopRowCardCount(totalSlotCount));
    if (cards.length === 0) {
        return Array.from({ length: totalSlotCount }, (_unused, index) => ({
            key: `live-center-slot-${index}`,
            card: null,
            style: slotStyles[index] ?? {},
        }));
    }

    return cards.map((card, index) => ({
        key: card.id,
        card,
        style: slotStyles[index] ?? {},
    }));
}

function buildCenteredLiveHandSlots(cards: TableCard[], slotCount: number): CardRowSlot[] {
    if (slotCount <= 0) return [];

    const centeredSlots: CardRowSlot[] = Array.from({ length: slotCount }, (_unused, index) => ({
        key: `live-empty-hand-slot-${index}`,
    }));
    const visibleCards = cards.slice(0, slotCount);
    const startIndex = Math.max(0, Math.floor((slotCount - visibleCards.length) / 2));

    visibleCards.forEach((card, index) => {
        centeredSlots[startIndex + index] = {
            key: `live-hand-${card.id}`,
            card,
        };
    });

    return centeredSlots;
}

function buildMinimalLiveHandCardStyles(cardCount: number, slotCount: number): React.CSSProperties[] {
    if (cardCount <= 0 || slotCount <= 0) return [];
    const startColumn = Math.max(1, Math.floor((slotCount - cardCount) / 2) + 1);
    return Array.from({ length: cardCount }, (_unused, index) => ({
        gridColumn: `${startColumn + index}`,
    }));
}

function getMinimalLiveCenterRowClass(cardCount: number) {
    if (cardCount <= 0) return 'fr-live-center-row--empty';
    return 'fr-live-center-row--spread';
}

function getAddedIds(nextIds: string[], previousIds: string[]): string[] {
    const previousIdSet = new Set(previousIds);
    return nextIds.filter((id) => !previousIdSet.has(id));
}

function getRemovedIds(previousIds: string[], nextIds: string[]): string[] {
    const nextIdSet = new Set(nextIds);
    return previousIds.filter((id) => !nextIdSet.has(id));
}

function renderFallbackCard(card: TableCard, t: Translator, locale?: string) {
    const displayName = getFantasyRealmsCardDisplayName(card);
    return (
        <article
            className="fr-card"
            data-testid="fantasyrealms-card"
            data-card-renderer="fallback"
            aria-label={t('card.ariaLabel', {
                name: displayName,
                suit: card.suit,
                score: card.score,
            })}
        >
            <div aria-hidden="true" className="fr-card-sheen" />
            <div className={`fr-card-suit ${card.toneClass}`}>{card.suit}</div>
            <div className="fr-card-body">
                <div className="fr-card-name">{displayName}</div>
                <div className="fr-card-text">{getFantasyRealmsCardRuleText(card, locale)}</div>
                <div className="fr-card-score">
                    <span>{t('card.baseScore')}</span>
                    <strong>{card.score}</strong>
                </div>
            </div>
        </article>
    );
}

function FantasyRealmsCard({
    card,
    t,
    locale,
}: {
    card: TableCard;
    t: Translator;
    locale?: string;
}) {
    const atlasStyle = getFantasyRealmsCardFaceStyle(card.id, locale);
    const displayName = getFantasyRealmsCardDisplayName(card);
    if (!atlasStyle) {
        return renderFallbackCard(card, t, locale);
    }

    return (
        <article
            className="fr-card fr-card--face"
            data-testid="fantasyrealms-card"
            data-card-renderer="atlas"
            data-atlas-card-id={card.id}
            aria-label={t('card.ariaLabel', {
                name: displayName,
                suit: card.suit,
                score: card.score,
            })}
            style={atlasStyle}
        >
            <div aria-hidden="true" className="fr-card-sheen" />
        </article>
    );
}

function getDrawDeckLabel(core: FantasyRealmsCore, t: Translator): string {
    if (!isDuelVariant(core)) {
        return t('turn.drawDeck.one');
    }
    return getDeckDrawCount(core) > 1 ? t('turn.drawDeck.twoThenDiscardOne') : t('turn.drawDeck.one');
}

function getPlayerDisplayName(
    playerId: string,
    core: FantasyRealmsCore,
    matchData: ReadonlyArray<{ id: string | number; name?: string }>,
    t: Translator,
): string {
    const matchPlayer = matchData.find((player) => String(player.id) === String(playerId));
    if (matchPlayer?.name) return matchPlayer.name;
    if (core.players[playerId]?.name) return core.players[playerId]!.name;
    return t('fallback.unknownPlayer');
}

function renderCardMagnifyButton(
    card: TableCard,
    zone: 'discard' | 'hand',
    openCardMagnify: (card: TableCard) => void,
    t: Translator,
) {
    return (
        <span
            role="button"
            tabIndex={0}
            className="fr-card-magnify-button"
            onClick={(event) => {
                event.stopPropagation();
                openCardMagnify(card);
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                openCardMagnify(card);
            }}
            data-testid={`fantasyrealms-card-magnify-button-${zone}-${card.id}`}
            aria-label={t('actions.openMagnifyAria', { name: getFantasyRealmsCardDisplayName(card) })}
        >
            <Search aria-hidden="true" className="fr-card-magnify-icon" strokeWidth={2.2} />
        </span>
    );
}

export default function FantasyRealmsBoard({ G, dispatch, matchData, playerID, isMultiplayer }: Props) {
    const { t, i18n } = useTranslation('game-fantasyrealms');
    const locale = i18n.language || 'zh-CN';
    const tutorialState = ((G?.sys as { tutorial?: TutorialState | null } | undefined)?.tutorial ?? DEFAULT_TUTORIAL_STATE);
    const runtimeDispatch = React.useMemo(
        () => dispatch as unknown as (type: string, payload?: unknown) => void,
        [dispatch],
    );
    useTutorialBridge(tutorialState, runtimeDispatch);
    const isTutorialMode = useGameMode()?.mode === 'tutorial';
    const currentTutorialStep = tutorialState.step as TutorialStepSnapshot | null;
    const core = React.useMemo(() => (isFantasyRealmsCore(G?.core) ? G.core : createFallbackCore()), [G]);
    const matchPlayers = matchData ?? EMPTY_MATCH_DATA;
    const [liveMotionCue, setLiveMotionCue] = React.useState<LiveMotionCue>(null);
    const [reviewPlayerId, setReviewPlayerId] = React.useState<string | null>(null);
    const [magnifiedCard, setMagnifiedCard] = React.useState<TableCard | null>(null);
    const [hoveredEndgameCardId, setHoveredEndgameCardId] = React.useState<string | null>(null);
    const [selectedEndgameCardId, setSelectedEndgameCardId] = React.useState<string | null>(null);
    const [liveCenterMotionOverlay, setLiveCenterMotionOverlay] = React.useState<LiveCenterMotionOverlay>(null);
    const [liveCenterHeldCard, setLiveCenterHeldCard] = React.useState<LiveCenterHeldCard>(null);
    const [liveHandHeldCard, setLiveHandHeldCard] = React.useState<LiveHandHeldCard>(null);
    const liveMotionSnapshotRef = React.useRef<LiveMotionSnapshot | null>(null);
    const liveMotionSequenceRef = React.useRef(0);
    const openingDealSignatureRef = React.useRef<string | null>(null);
    const autoDeckDrawSignatureRef = React.useRef<string | null>(null);
    const liveTableRef = React.useRef<HTMLDivElement | null>(null);
    const liveHandZoneRef = React.useRef<HTMLElement | null>(null);
    const liveHandRowRef = React.useRef<HTMLDivElement | null>(null);

    const isSpectatorView = playerID == null;
    const viewerPlayerId = isSpectatorView ? null : playerID;
    const gameOver = G?.sys?.gameover as { winner?: string; draw?: boolean; scores?: Record<string, number>; winners?: string[] } | undefined;
    const isGameOver = Boolean(gameOver);
    const discardCards = React.useMemo(() => core.discardPile.map((card) => ({ ...card })), [core.discardPile]);
    const currentPlayerName = React.useMemo(() => {
        const matchPlayer = matchPlayers.find((player) => String(player.id) === String(core.currentPlayer));
        if (matchPlayer?.name) return matchPlayer.name;
        if (core.players[core.currentPlayer]?.name) return core.players[core.currentPlayer]!.name;
        return t('fallback.currentPlayer');
    }, [core.currentPlayer, core.players, matchPlayers, t]);
    const isMyTurn = !isSpectatorView && viewerPlayerId === core.currentPlayer;
    const canDrawFromDeck = isMyTurn && !isGameOver && core.stage === 'draw' && core.drawPile.length >= getDeckDrawCount(core);
    const canTakeDiscard = isMyTurn && !isGameOver && core.stage === 'draw' && core.discardPile.length > 0;
    const canDiscard = isMyTurn && !isGameOver && core.stage === 'discard';
    const tutorialAllowedTargets = currentTutorialStep?.allowedTargets ?? null;
    const isTutorialCommandAllowed = React.useCallback((commandType: string) => {
        if (!isTutorialMode || !currentTutorialStep) return true;
        if (currentTutorialStep.allowedCommands && currentTutorialStep.allowedCommands.length > 0) {
            return currentTutorialStep.allowedCommands.includes(commandType);
        }
        return !currentTutorialStep.infoStep;
    }, [currentTutorialStep, isTutorialMode]);
    const isTutorialTargetAllowed = React.useCallback((targetId: string) => {
        if (!isTutorialMode || !tutorialAllowedTargets || tutorialAllowedTargets.length === 0) {
            return true;
        }
        return tutorialAllowedTargets.includes(targetId);
    }, [isTutorialMode, tutorialAllowedTargets]);
    const shouldAutoDrawFromDeck = canDrawFromDeck && !canTakeDiscard && !isTutorialMode;
    const isTakeDiscardSelectionActive = canTakeDiscard;
    const canTutorialTakeDiscard = isTakeDiscardSelectionActive && isTutorialCommandAllowed('TAKE_FROM_DISCARD');
    const canTutorialDiscard = canDiscard && isTutorialCommandAllowed('DISCARD_CARD');
    const discardThreshold = getFantasyRealmsDiscardEndThreshold(core.playerIds.length, core.setupConfig);
    const winnerIds = React.useMemo(() => {
        if (!gameOver) return new Set<string>();
        if (gameOver.winner) return new Set([gameOver.winner]);
        if (Array.isArray(gameOver.winners)) return new Set(gameOver.winners);
        return new Set<string>();
    }, [gameOver]);
    useGameAudio({
        config: FANTASY_REALMS_AUDIO_CONFIG,
        gameId: FANTASY_REALMS_MANIFEST.id,
        G: core,
        ctx: {
            currentStage: core.stage,
            isGameOver,
            selfPlayerId: viewerPlayerId,
            winnerIds: Array.from(winnerIds),
            isDraw: gameOver?.draw === true,
        },
        eventEntries: G?.sys?.eventStream?.entries ?? [],
    });
    const playerSummaries = React.useMemo(() => core.playerIds.map((id) => ({
        id,
        name: getPlayerDisplayName(id, core, matchPlayers, t),
        handCount: core.players[id]?.hand.length ?? 0,
        score: core.players[id]?.score ?? 0,
        scoreVisible: isGameOver || (!isSpectatorView && id === viewerPlayerId),
        isCurrent: !isGameOver && id === core.currentPlayer,
        isViewer: !isSpectatorView && id === viewerPlayerId,
        isWinner: winnerIds.has(id),
    })), [core, isGameOver, isSpectatorView, matchPlayers, t, viewerPlayerId, winnerIds]);
    const liveScoreOwner = React.useMemo(
        () => playerSummaries.find((player) => player.isViewer)
            ?? playerSummaries.find((player) => player.isCurrent)
            ?? playerSummaries[0]
            ?? null,
        [playerSummaries],
    );
    const finalStandings = React.useMemo(() => {
        if (!isGameOver) return [];
        return core.playerIds
            .map((id) => ({
                id,
                name: getPlayerDisplayName(id, core, matchPlayers, t),
                score: gameOver?.scores?.[id] ?? core.players[id]?.score ?? 0,
                isWinner: winnerIds.has(id),
            }))
            .sort((left, right) => right.score - left.score);
    }, [core, gameOver?.scores, isGameOver, matchPlayers, t, winnerIds]);
    const defaultReviewPlayerId = React.useMemo(() => {
        if (!isGameOver) return null;
        return viewerPlayerId ?? finalStandings[0]?.id ?? core.playerIds[0] ?? null;
    }, [core.playerIds, finalStandings, isGameOver, viewerPlayerId]);
    React.useEffect(() => {
        if (!isGameOver) {
            setReviewPlayerId(null);
            setHoveredEndgameCardId(null);
            return;
        }
        if (!defaultReviewPlayerId) return;
        setReviewPlayerId((current) => {
            if (current && core.players[current]) {
                return current;
            }
            return defaultReviewPlayerId;
        });
    }, [core.players, defaultReviewPlayerId, isGameOver]);
    const displayedPlayerId = isGameOver
        ? (reviewPlayerId && core.players[reviewPlayerId] ? reviewPlayerId : defaultReviewPlayerId)
        : viewerPlayerId;
    const displayedPlayer = displayedPlayerId ? core.players[displayedPlayerId] : undefined;
    const rawDisplayedHandCards = React.useMemo(() => displayedPlayer?.hand ?? [], [displayedPlayer?.hand]);
    const displayedHandCards = React.useMemo(() => {
        if (!liveHandHeldCard) return rawDisplayedHandCards;
        return rawDisplayedHandCards.filter((card) => card.id !== liveHandHeldCard.cardId);
    }, [liveHandHeldCard, rawDisplayedHandCards]);
    const displayedPlayerName = React.useMemo(() => {
        if (!displayedPlayerId) return null;
        return getPlayerDisplayName(displayedPlayerId, core, matchPlayers, t);
    }, [core, displayedPlayerId, matchPlayers, t]);
    const viewerPlayerName = React.useMemo(() => {
        if (!viewerPlayerId) return null;
        return getPlayerDisplayName(viewerPlayerId, core, matchPlayers, t);
    }, [core, matchPlayers, t, viewerPlayerId]);
    const handSlotCount = React.useMemo(() => {
        const baseHandLimit = getFantasyRealmsBaseHandLimit(core.setupConfig);
        const liveDesktopDiscardSlotFloor = isDuelVariant(core) && !isGameOver && core.stage === 'discard'
            ? Math.max(baseHandLimit + 1, 8)
            : baseHandLimit;
        return Math.max(liveDesktopDiscardSlotFloor, displayedHandCards.length);
    }, [core, isGameOver, displayedHandCards.length]);
    const deckBackStyle = React.useMemo(() => getFantasyRealmsCardBackStyle(locale), [locale]);
    const isCompressedHandDensity = false;
    const handRowLayoutStyle = React.useMemo<React.CSSProperties>(() => ({
        '--fr-live-hand-slots': String(handSlotCount),
    } as React.CSSProperties), [handSlotCount]);
    const minimalLiveDiscardRowStyle = undefined;
    const isDuelMode = isDuelVariant(core);
    const isDuelAutoOpeningFlow = !isGameOver
        && isDuelMode
        && core.turn === 1
        && discardCards.length === 0
        && displayedHandCards.length <= 2;
    const rawViewerHandIdsSignature = rawDisplayedHandCards.map((card) => card.id).join('|');
    const discardIdsSignature = discardCards.map((card) => card.id).join('|');
    const shouldPlayOpeningDealMotion = !isSpectatorView
        && !isGameOver
        && !isDuelMode
        && core.turn === 1
        && core.stage === 'draw'
        && discardCards.length === 0
        && displayedHandCards.length > 0;
    const openingDealSignature = React.useMemo(
        () => (shouldPlayOpeningDealMotion
            ? `${viewerPlayerId ?? 'spectator'}:${core.currentPlayer}:${rawViewerHandIdsSignature}:${core.drawPile.length}`
            : null),
        [
            core.currentPlayer,
            core.drawPile.length,
            shouldPlayOpeningDealMotion,
            rawViewerHandIdsSignature,
            viewerPlayerId,
        ],
    );
    const liveTurnStateLabel = React.useMemo(() => {
        if (!isMyTurn || isGameOver) return null;
        if (core.stage === 'discard') return t('turn.compact.discard');
        if (isDuelMode && getDeckDrawCount(core) > 1 && canDrawFromDeck) {
            return t('turn.compact.drawTwo');
        }
        return t('turn.compact.draw');
    }, [canDrawFromDeck, core, isDuelMode, isGameOver, isMyTurn, t]);
    const liveDrawActionLabel = React.useMemo(() => (
        canTakeDiscard && canDrawFromDeck
            ? t('turn.compact.drawChoice')
            : t('turn.compact.draw')
    ), [canDrawFromDeck, canTakeDiscard, t]);
    const liveHandZoneTitle = React.useMemo(() => {
        if (isGameOver && displayedPlayerName) {
            return t('zone.hand.reviewTitle', { player: displayedPlayerName });
        }
        if (isSpectatorView) return t('zone.hand.titleSpectator');
        if (displayedHandCards.length > 0) {
            return t('score.handCount', { count: displayedHandCards.length });
        }
        return t('zone.hand.title', { player: t('fallback.viewer') });
    }, [displayedHandCards.length, displayedPlayerName, isGameOver, isSpectatorView, t]);
    const liveMotionSnapshot = React.useMemo<LiveMotionSnapshot>(() => ({
        viewerPlayerId,
        currentPlayer: core.currentPlayer,
        stage: core.stage,
        handIds: rawViewerHandIdsSignature ? rawViewerHandIdsSignature.split('|') : [],
        handCards: rawDisplayedHandCards.map((card) => ({ ...card })),
        discardIds: discardIdsSignature ? discardIdsSignature.split('|') : [],
        discardCards: discardCards.map((card) => ({ ...card })),
        drawPileCount: core.drawPile.length,
        isGameOver,
    }), [
        core.currentPlayer,
        core.drawPile.length,
        core.stage,
        rawDisplayedHandCards,
        discardCards,
        discardIdsSignature,
        isGameOver,
        rawViewerHandIdsSignature,
        viewerPlayerId,
    ]);

    React.useLayoutEffect(() => {
        if (!openingDealSignature) return undefined;
        if (openingDealSignatureRef.current === openingDealSignature) {
            return undefined;
        }
        if (prefersReducedMotion()) {
            openingDealSignatureRef.current = openingDealSignature;
            return undefined;
        }

        openingDealSignatureRef.current = openingDealSignature;
        liveMotionSequenceRef.current += 1;
        const nextKey = liveMotionSequenceRef.current;
        debugFantasyRealmsOpeningLoop('set-opening-deal-cue', {
            openingDealSignature,
            currentPlayer: core.currentPlayer,
            stage: core.stage,
            turn: core.turn,
            handCount: displayedHandCards.length,
            discardCount: discardCards.length,
        });
        setLiveMotionCue({
            type: 'opening-deal',
            key: nextKey,
            cardIds: displayedHandCards.map((card) => card.id),
        });
        return undefined;
    }, [core.currentPlayer, core.stage, core.turn, discardCards.length, displayedHandCards, openingDealSignature]);

    React.useLayoutEffect(() => {
        const nextSnapshot = liveMotionSnapshot;
        const previousSnapshot = liveMotionSnapshotRef.current
            ?? (typeof window !== 'undefined'
                ? (window as LiveMotionWindow).__FR_LIVE_MOTION_LAST_SNAPSHOT__ ?? null
                : null);
        liveMotionSnapshotRef.current = nextSnapshot;
        if (typeof window !== 'undefined') {
            (window as LiveMotionWindow).__FR_LIVE_MOTION_LAST_SNAPSHOT__ = nextSnapshot;
        }

        if (!previousSnapshot || isSpectatorView || isGameOver) {
            return undefined;
        }

        const handCountDelta = nextSnapshot.handIds.length - previousSnapshot.handIds.length;
        const discardCountDelta = nextSnapshot.discardIds.length - previousSnapshot.discardIds.length;
        const discardIdsChanged = nextSnapshot.discardIds.join('|') !== previousSnapshot.discardIds.join('|');
        const drawCountDelta = nextSnapshot.drawPileCount - previousSnapshot.drawPileCount;
        let nextCueType: LiveMotionCueType | null = null;
        let nextCueCardIds: string[] = [];

        if (
            previousSnapshot.currentPlayer === nextSnapshot.viewerPlayerId
            && nextSnapshot.currentPlayer === nextSnapshot.viewerPlayerId
            && previousSnapshot.stage === 'draw'
            && nextSnapshot.stage === 'discard'
            && handCountDelta > 0
        ) {
            nextCueType = drawCountDelta < 0 ? 'draw-to-hand' : 'center-to-hand';
            nextCueCardIds = getAddedIds(nextSnapshot.handIds, previousSnapshot.handIds);
        } else if (
            previousSnapshot.currentPlayer === nextSnapshot.currentPlayer
            && previousSnapshot.stage === 'draw'
            && nextSnapshot.stage === 'discard'
            && discardCountDelta < 0
        ) {
            nextCueType = 'center-to-hand';
            nextCueCardIds = getRemovedIds(previousSnapshot.discardIds, nextSnapshot.discardIds);
        } else if (
            previousSnapshot.currentPlayer === previousSnapshot.viewerPlayerId
            && previousSnapshot.stage === 'discard'
            && nextSnapshot.stage === 'draw'
            && (discardCountDelta > 0 || discardIdsChanged)
        ) {
            nextCueType = 'hand-to-center';
            nextCueCardIds = getAddedIds(nextSnapshot.discardIds, previousSnapshot.discardIds);
        }

        if (!nextCueType || nextCueCardIds.length === 0) {
            return undefined;
        }

        if (isDuelAutoOpeningFlow && nextCueType === 'draw-to-hand') {
            debugFantasyRealmsOpeningLoop('skip-draw-to-hand-cue-during-duel-auto-opening', {
                currentPlayer: nextSnapshot.currentPlayer,
                stage: nextSnapshot.stage,
                turn: core.turn,
                handCount: nextSnapshot.handIds.length,
                discardCount: nextSnapshot.discardIds.length,
                nextCueType,
                nextCueCardIds,
            });
            return undefined;
        }

        liveMotionSequenceRef.current += 1;
        const nextKey = liveMotionSequenceRef.current;
        debugFantasyRealmsOpeningLoop('set-motion-cue', {
            currentPlayer: nextSnapshot.currentPlayer,
            stage: nextSnapshot.stage,
            turn: core.turn,
            handCount: nextSnapshot.handIds.length,
            discardCount: nextSnapshot.discardIds.length,
            nextCueType,
            nextCueCardIds,
        });
        setLiveMotionCue({ type: nextCueType, key: nextKey, cardIds: nextCueCardIds });
        if (nextCueType === 'center-to-hand') {
            const takenDiscardCardId = getRemovedIds(previousSnapshot.discardIds, nextSnapshot.discardIds)[0] ?? nextCueCardIds[0] ?? null;
            const previousCardIndex = takenDiscardCardId
                ? previousSnapshot.discardIds.findIndex((cardId) => cardId === takenDiscardCardId)
                : -1;
            const previousDiscardCard = takenDiscardCardId
                ? previousSnapshot.discardCards.find((card) => card.id === takenDiscardCardId)
                : null;
            const previousSlotStyle = previousCardIndex >= 0
                ? buildMinimalLiveCenterSlots(
                    previousSnapshot.discardIds.map((cardId) => ({ id: cardId } as TableCard)),
                    discardThreshold,
                )[previousCardIndex]?.style
                : undefined;
            if (!takenDiscardCardId || !previousDiscardCard) {
                return undefined;
            }
            setLiveCenterMotionOverlay({
                type: 'exit',
                playerName: getPlayerDisplayName(previousSnapshot.currentPlayer, core, matchPlayers, t),
                cueKey: nextKey,
                slotStyle: previousSlotStyle ?? {},
                card: previousDiscardCard,
            });
            setLiveCenterHeldCard(null);
            setLiveHandHeldCard({
                cardId: previousDiscardCard.id,
                cueKey: nextKey,
            });
        } else if (nextCueType === 'hand-to-center') {
            const incomingDiscardCardId = nextCueCardIds[0] ?? null;
            const incomingDiscardCardIndex = incomingDiscardCardId
                ? nextSnapshot.discardIds.findIndex((cardId) => cardId === incomingDiscardCardId)
                : -1;
            const incomingDiscardCard = incomingDiscardCardId
                ? nextSnapshot.discardCards.find((card) => card.id === incomingDiscardCardId)
                : null;
            const nextSlotStyle = incomingDiscardCardIndex >= 0
                ? buildMinimalLiveCenterSlots(
                    nextSnapshot.discardIds.map((cardId) => ({ id: cardId } as TableCard)),
                    discardThreshold,
                )[incomingDiscardCardIndex]?.style
                : undefined;
            if (!incomingDiscardCardId || !incomingDiscardCard) {
                return undefined;
            }
            setLiveCenterMotionOverlay({
                type: 'enter',
                playerName: getPlayerDisplayName(previousSnapshot.currentPlayer, core, matchPlayers, t),
                cueKey: nextKey,
                slotStyle: nextSlotStyle ?? {},
                card: incomingDiscardCard,
            });
            setLiveCenterHeldCard({
                cardId: incomingDiscardCard.id,
                cueKey: nextKey,
            });
        }

        return undefined;
    }, [
        isGameOver,
        isDuelAutoOpeningFlow,
        isSpectatorView,
        liveMotionSnapshot,
        core.turn,
        core,
        discardThreshold,
        matchPlayers,
        t,
    ]);

    React.useEffect(() => {
        if (!liveMotionCue) return undefined;

        const cueKey = liveMotionCue.key;
        const clearTimer = window.setTimeout(() => {
            setLiveMotionCue((current) => (current?.key === cueKey ? null : current));
        }, 1350);

        return () => window.clearTimeout(clearTimer);
    }, [liveMotionCue]);

    React.useEffect(() => {
        if (liveMotionCue?.type !== 'opening-deal' || !openingDealSignature) {
            return;
        }
        if (typeof window !== 'undefined') {
            const liveWindow = window as LiveMotionWindow;
            const guard = liveWindow.__FR_OPENING_DEAL_SOUND_GUARD__;
            if (guard && guard.signature === openingDealSignature) {
                return;
            }
            const clearTimer = window.setTimeout(() => {
                const currentGuard = liveWindow.__FR_OPENING_DEAL_SOUND_GUARD__;
                if (currentGuard?.signature === openingDealSignature && currentGuard.clearTimer === clearTimer) {
                    delete liveWindow.__FR_OPENING_DEAL_SOUND_GUARD__;
                }
            }, 0);
            liveWindow.__FR_OPENING_DEAL_SOUND_GUARD__ = {
                signature: openingDealSignature,
                clearTimer,
            };
        }
        playSound(FANTASY_REALMS_AUDIO_EVENT_KEYS.CARD_DRAW_KEY);
    }, [liveMotionCue, openingDealSignature]);

    React.useEffect(() => {
        if (!magnifiedCard) {
            return;
        }

        const visibleCardIds = new Set([
            ...discardCards.map((card) => card.id),
            ...displayedHandCards.map((card) => card.id),
        ]);
        if (!visibleCardIds.has(magnifiedCard.id)) {
            setMagnifiedCard(null);
        }
    }, [discardCards, displayedHandCards, magnifiedCard]);

    React.useEffect(() => {
        if (!isGameOver) {
            setSelectedEndgameCardId(null);
            return;
        }

        if (!selectedEndgameCardId) {
            return;
        }

        const stillVisible = displayedHandCards.some((card) => card.id === selectedEndgameCardId);
        if (!stillVisible) {
            setSelectedEndgameCardId(null);
        }
    }, [displayedHandCards, isGameOver, selectedEndgameCardId]);

    const handleFocusCard = React.useCallback((cardId: string) => {
        dispatch('SET_FOCUS_CARD', { cardId });
    }, [dispatch]);

    const openCardMagnify = React.useCallback((card: TableCard) => {
        handleFocusCard(card.id);
        setMagnifiedCard(card);
    }, [handleFocusCard]);

    const {
        getTouchInspectProps,
        isCoarsePointer,
        shouldBlockInspectClick,
    } = useTouchInspectGesture<string, TableCard>({
        enabled: true,
        onInspect: (_key, card) => {
            openCardMagnify(card);
        },
    });
    const shouldShowInlineMagnifyButton = !isCoarsePointer;
    const tutorialHighlightTarget = isTutorialMode ? currentTutorialStep?.highlightTarget ?? null : null;
    const tutorialHighlightedCardId = React.useMemo(() => {
        if (!tutorialHighlightTarget) return null;
        const handPrefix = 'fantasyrealms-card-hand-';
        const discardPrefix = 'fantasyrealms-card-discard-';
        if (tutorialHighlightTarget.startsWith(handPrefix)) {
            return tutorialHighlightTarget.slice(handPrefix.length);
        }
        if (tutorialHighlightTarget.startsWith(discardPrefix)) {
            return tutorialHighlightTarget.slice(discardPrefix.length);
        }
        return null;
    }, [tutorialHighlightTarget]);
    const shouldShowTutorialSelectedCard = React.useCallback((cardId: string) => {
        if (!isTutorialMode) return true;
        if (!tutorialHighlightedCardId) return false;
        return tutorialHighlightedCardId === cardId;
    }, [isTutorialMode, tutorialHighlightedCardId]);

    const handleDiscardPileClick = React.useCallback((card: TableCard) => {
        const inspectKey = `discard:${card.id}`;
        if (shouldBlockInspectClick(inspectKey)) {
            return;
        }
        if (isTakeDiscardSelectionActive && isTutorialCommandAllowed('TAKE_FROM_DISCARD') && isTutorialTargetAllowed(card.id)) {
            const selectedSlotStyle = buildMinimalLiveCenterSlots(discardCards, discardThreshold)
                .find((slot) => slot.card?.id === card.id)?.style;
            liveMotionSequenceRef.current += 1;
            const nextKey = liveMotionSequenceRef.current;
            setLiveCenterMotionOverlay({
                type: 'exit',
                playerName: viewerPlayerName ?? t('fallback.viewer'),
                cueKey: nextKey,
                slotStyle: selectedSlotStyle ?? {},
                card: { ...card },
            });
            setLiveCenterHeldCard(null);
            handleFocusCard(card.id);
            dispatch('TAKE_FROM_DISCARD', { cardId: card.id });
            return;
        }
        handleFocusCard(card.id);
        if (!isCoarsePointer) {
            setMagnifiedCard(card);
        }
    }, [
        dispatch,
        handleFocusCard,
        isTutorialCommandAllowed,
        isTutorialTargetAllowed,
        isTakeDiscardSelectionActive,
        isCoarsePointer,
        discardCards,
        discardThreshold,
        shouldBlockInspectClick,
        t,
        viewerPlayerName,
    ]);

    const handleHandCardClick = React.useCallback((card: TableCard) => {
        const inspectKey = `hand:${card.id}`;
        if (shouldBlockInspectClick(inspectKey)) {
            return;
        }
        if (isGameOver) {
            handleFocusCard(card.id);
            setSelectedEndgameCardId((current) => (current === card.id ? null : card.id));
            if (!isCoarsePointer) {
                setMagnifiedCard(card);
            }
            return;
        }
        if (canDiscard && isTutorialCommandAllowed('DISCARD_CARD') && isTutorialTargetAllowed(card.id)) {
            handleFocusCard(card.id);
            if (isCoarsePointer && core.focusCardId !== card.id) {
                return;
            }
            dispatch('DISCARD_CARD', { cardId: card.id });
            return;
        }
        handleFocusCard(card.id);
        if (!isCoarsePointer) {
            setMagnifiedCard(card);
        }
    }, [
        canDiscard,
        core.focusCardId,
        dispatch,
        handleFocusCard,
        isGameOver,
        isCoarsePointer,
        isTutorialCommandAllowed,
        isTutorialTargetAllowed,
        shouldBlockInspectClick,
    ]);

    const handleDrawFromDeckAction = React.useCallback(() => {
        if (!isTutorialCommandAllowed('DRAW_FROM_DECK')) {
            return;
        }
        dispatch('DRAW_FROM_DECK', {});
    }, [dispatch, isTutorialCommandAllowed]);
    React.useEffect(() => {
        if (!shouldAutoDrawFromDeck) {
            autoDeckDrawSignatureRef.current = null;
            return;
        }

        const autoDrawSignature = `${viewerPlayerId ?? 'spectator'}:${core.currentPlayer}:${core.turn}:${core.stage}:${core.drawPile.length}:${core.discardPile.length}:${displayedHandCards.length}`;
        if (autoDeckDrawSignatureRef.current === autoDrawSignature) {
            return;
        }

        autoDeckDrawSignatureRef.current = autoDrawSignature;
        dispatch('DRAW_FROM_DECK', {});
    }, [
        core.currentPlayer,
        core.discardPile.length,
        core.drawPile.length,
        core.stage,
        core.turn,
        dispatch,
        displayedHandCards.length,
        shouldAutoDrawFromDeck,
        viewerPlayerId,
    ]);
    const minimalLiveCenterSlots = React.useMemo(
        () => {
            const hiddenAnimatedCenterCardIds = new Set<string>();
            if (liveCenterMotionOverlay) {
                hiddenAnimatedCenterCardIds.add(liveCenterMotionOverlay.card.id);
            }
            if (liveCenterHeldCard) {
                hiddenAnimatedCenterCardIds.add(liveCenterHeldCard.cardId);
            }
            const visibleCenterCards = hiddenAnimatedCenterCardIds.size > 0
                ? discardCards.filter((card) => !hiddenAnimatedCenterCardIds.has(card.id))
                : discardCards;
            return buildMinimalLiveCenterSlots(visibleCenterCards, discardThreshold);
        },
        [discardCards, discardThreshold, liveCenterHeldCard, liveCenterMotionOverlay],
    );
    const shouldShowLiveCenterPlaceholders = false;
    const minimalLiveHandCardStyles = React.useMemo(
        () => buildMinimalLiveHandCardStyles(displayedHandCards.length, handSlotCount),
        [displayedHandCards.length, handSlotCount],
    );
    const winnerStanding = finalStandings.find((player) => player.isWinner) ?? finalStandings[0] ?? null;
    const reviewedStanding = displayedPlayerId
        ? finalStandings.find((player) => player.id === displayedPlayerId) ?? null
        : null;
    const endgameDisplayStanding = reviewedStanding ?? winnerStanding;
    const endgameScoringOptions = React.useMemo(
        () => ({
            setupConfig: core.setupConfig
                ? { cursedHoardSuitsEnabled: core.setupConfig.cursedHoardSuitsEnabled }
                : null,
            playerCount: core.playerIds.length,
        }),
        [core.playerIds.length, core.setupConfig],
    );
    const endgameCardDeltaById = React.useMemo(
        () => (isGameOver
            ? buildFantasyRealmsEndgameCardDeltaById(displayedHandCards, core.discardPile, endgameScoringOptions)
            : new Map<string, number>()),
        [core.discardPile, displayedHandCards, endgameScoringOptions, isGameOver],
    );
    const endgameScoreSequence = useFantasyRealmsEndgameScoreSequence(
        isGameOver && Boolean(displayedPlayerId) && Boolean(endgameDisplayStanding),
        displayedHandCards,
        core.discardPile,
        endgameDisplayStanding?.score ?? 0,
        endgameScoringOptions,
    );
    const activeEndgameScoreStep = endgameScoreSequence.activeStep;
    React.useEffect(() => {
        if (
            !isGameOver
            || !viewerPlayerId
            || displayedPlayerId !== viewerPlayerId
            || !activeEndgameScoreStep?.cardId
        ) {
            return;
        }
        playSound(ENDGAME_SCORE_STEP_KEY);
    }, [activeEndgameScoreStep?.cardId, activeEndgameScoreStep?.key, displayedPlayerId, isGameOver, viewerPlayerId]);
    const liveTopbarTurnLabel = isGameOver
        ? t('turn.reviewChip')
        : isMyTurn
            ? t('turn.live.selfTurn')
            : currentPlayerName;
    const liveTopbarCueLabel = isGameOver ? null : liveTurnStateLabel;
    const liveActionState = canTutorialDiscard
        ? 'discard'
        : canDrawFromDeck && isTutorialCommandAllowed('DRAW_FROM_DECK')
            ? 'draw'
            : canTutorialTakeDiscard
                ? 'take'
                : 'idle';
    const liveDiscardActionLabel = '从手牌弃置一张牌';
    const liveScoreBandLabel = isGameOver
        ? endgameDisplayStanding?.name ?? t('score.panelTitle')
        : t('score.panelTitle');
    const liveScoreBandValue = isGameOver
        ? endgameScoreSequence.displayTotal
        : liveScoreOwner?.scoreVisible
            ? liveScoreOwner.score
            : t('score.hiddenValue');
    const liveActionButtons = React.useMemo<LiveActionButtonConfig[]>(() => {
        if (isGameOver || !isMyTurn) {
            return [];
        }
        if (shouldAutoDrawFromDeck) {
            return [];
        }
        if (isTakeDiscardSelectionActive) {
            return canDrawFromDeck
                && isTutorialCommandAllowed('DRAW_FROM_DECK')
                ? [{
                    key: 'draw',
                    mode: 'draw',
                    label: liveDrawActionLabel,
                    testId: 'fantasyrealms-live-action-draw',
                    onClick: handleDrawFromDeckAction,
                }]
                : [];
        }
        if (canTutorialDiscard) {
            return [{
                key: 'discard',
                mode: 'discard',
                label: liveDiscardActionLabel,
                testId: 'fantasyrealms-live-action-discard',
                disabled: true,
                onClick: () => {},
            }];
        }

        const buttons: LiveActionButtonConfig[] = [];
        if (canDrawFromDeck && isTutorialCommandAllowed('DRAW_FROM_DECK')) {
            buttons.push({
                key: 'draw',
                mode: 'draw',
                label: liveDrawActionLabel,
                testId: 'fantasyrealms-live-action-draw',
                onClick: handleDrawFromDeckAction,
            });
        }
        return buttons;
    }, [
        canDrawFromDeck,
        canTutorialDiscard,
        handleDrawFromDeckAction,
        isGameOver,
        isMyTurn,
        isTutorialCommandAllowed,
        isTakeDiscardSelectionActive,
        liveDiscardActionLabel,
        liveDrawActionLabel,
        shouldAutoDrawFromDeck,
    ]);
    const minimalLiveEndgameSection = isGameOver ? (
        <div
            className="fr-live-endgame fr-live-endgame--docked"
            data-testid="fantasyrealms-live-endgame"
            data-tutorial-id="fantasyrealms-live-endgame"
        >
            <div className="fr-live-endgame-rail" aria-label={t('progress.finalStandings')}>
                <div className="fr-live-endgame-rail-header">
                    <div className="fr-live-endgame-rail-title">{t('progress.finalStandings')}</div>
                </div>
                <div className="fr-live-endgame-rail-list">
                    {finalStandings.map((player, index) => {
                        const isReviewed = player.id === displayedPlayerId;
                        const rankTone = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'plain';
                        return (
                            <button
                                key={player.id}
                                type="button"
                                className={`fr-live-endgame-rank-button fr-live-endgame-rank-button--${rankTone}${isReviewed ? ' fr-live-endgame-rank-button--active' : ''}${player.isWinner ? ' fr-live-endgame-rank-button--winner' : ''}`}
                                onClick={() => setReviewPlayerId(player.id)}
                                aria-pressed={isReviewed}
                                data-testid={`fantasyrealms-endgame-rank-${player.id}`}
                                data-rank-tone={rankTone}
                            >
                                <div className="fr-live-endgame-rank-copy">
                                    <span className={`fr-live-endgame-rank-order fr-live-endgame-rank-order--${rankTone}`}>
                                        {t('progress.rank', { rank: index + 1 })}
                                        {player.isWinner ? (
                                            <Crown
                                                className="fr-live-endgame-rank-crown"
                                                role="img"
                                                aria-label={t('score.badges.winner')}
                                            />
                                        ) : null}
                                    </span>
                                    <span className="fr-live-endgame-rank-name">
                                        {player.name}
                                        {isReviewed ? <i className="fr-score-badge fr-score-badge--rank-review">{t('score.badges.reviewing')}</i> : null}
                                    </span>
                                </div>
                                <strong className="fr-live-endgame-rank-score" data-score-role="final-score">
                                    {player.score}
                                </strong>
                            </button>
                        );
                    })}
                </div>
                {reviewedStanding ? (
                    <div className="fr-live-endgame-reviewed-player" data-testid="fantasyrealms-endgame-reviewed-player">
                        {t('zone.hand.reviewTitle', { player: reviewedStanding.name })}
                    </div>
                ) : null}
            </div>
        </div>
    ) : null;

    const minimalLiveTopbarSection = (
        <div className={`fr-live-topbar${isGameOver ? ' fr-live-topbar--gameover' : ''}`} data-testid="fantasyrealms-live-topbar">
            {canDrawFromDeck ? (
                <div
                    className="fr-live-deck"
                    data-testid="fantasyrealms-live-deck"
                    data-tutorial-id="fantasyrealms-live-deck"
                    data-action-state="resource"
                    aria-label={getDrawDeckLabel(core, t)}
                >
                    <div className="fr-live-deck-stack">
                        <div className="fr-stack-card fr-stack-card--under" style={deckBackStyle} aria-hidden="true" />
                        <div className="fr-stack-card fr-stack-card--mid" style={deckBackStyle} aria-hidden="true" />
                        <div className="fr-stack-card fr-stack-card--top" style={deckBackStyle} aria-hidden="true" />
                        <strong className="fr-live-deck-count">{core.drawPile.length}</strong>
                    </div>
                </div>
            ) : (
                <div
                    className="fr-live-deck"
                    data-testid="fantasyrealms-live-deck"
                    data-tutorial-id="fantasyrealms-live-deck"
                    aria-label={t('deck.remaining')}
                >
                    <div className="fr-live-deck-stack">
                        <div className="fr-stack-card fr-stack-card--under" style={deckBackStyle} aria-hidden="true" />
                        <div className="fr-stack-card fr-stack-card--mid" style={deckBackStyle} aria-hidden="true" />
                        <div className="fr-stack-card fr-stack-card--top" style={deckBackStyle} aria-hidden="true" />
                        <strong className="fr-live-deck-count">{core.drawPile.length}</strong>
                    </div>
                </div>
            )}
            <div className="fr-live-status-strip" data-testid="fantasyrealms-live-status-strip">
                <div
                    className={`fr-live-chip fr-live-chip--turn${isGameOver ? ' fr-live-chip--turn-finished' : ''}${!isGameOver && isMyTurn ? ' fr-live-chip--turn-active' : ''}`}
                    data-turn-state={isGameOver ? 'gameover' : isMyTurn ? liveActionState : 'waiting'}
                >
                    {liveTopbarTurnLabel}
                </div>
                <div className="fr-live-chip fr-live-chip--round">
                    {t('turn.short.round', { turn: core.turn })}
                </div>
                <div className="fr-live-chip fr-live-chip--progress" aria-label={t('progress.panelTitle')}>
                    {isGameOver ? discardThreshold : discardCards.length}/{discardThreshold}
                </div>
                {liveTopbarCueLabel && !isMyTurn ? (
                    <div className="fr-live-chip fr-live-chip--cue">
                        {liveTopbarCueLabel}
                    </div>
                ) : null}
            </div>
            <div className={`fr-live-score-strip${isGameOver ? ' fr-live-score-strip--gameover' : ''}`} aria-label={t('score.tableTitle')} data-testid="fantasyrealms-live-score-strip">
                <div
                    className={`fr-live-score-band${isGameOver ? ' fr-live-score-band--gameover' : ''}`}
                    data-testid="fantasyrealms-live-score-band"
                    data-tutorial-id="fantasyrealms-live-score-band"
                >
                    <div className="fr-live-score-band-kicker">
                        {liveScoreBandLabel}
                    </div>
                    <div className="fr-live-score-band-main">
                        <strong
                            className={`fr-live-score-band-total${endgameScoreSequence.isTotalPulsing ? ' fr-live-score-band-total--pulse' : ''}`}
                            data-testid="fantasyrealms-live-score-total"
                            data-score-animation={isGameOver ? 'settlement-sequence' : 'static'}
                            data-score-current={isGameOver ? String(endgameScoreSequence.displayTotal) : String(liveScoreBandValue)}
                            data-score-target={isGameOver ? String(endgameDisplayStanding?.score ?? 0) : undefined}
                            data-score-running={isGameOver && endgameScoreSequence.isRunning ? 'true' : 'false'}
                        >
                            {liveScoreBandValue}
                        </strong>
                    </div>
                </div>
                {minimalLiveEndgameSection}
            </div>
        </div>
    );

    const minimalLiveCenterRowSection = (
        <section
            className={`fr-live-center-row ${getMinimalLiveCenterRowClass(discardCards.length)}${liveMotionCue?.type === 'hand-to-center' ? ' fr-live-center-row--motion-receive' : ''}`}
            aria-label={t('zone.discard.title')}
            data-motion={liveMotionCue?.type === 'hand-to-center' ? 'hand-to-center' : 'idle'}
            data-testid="fantasyrealms-live-center-row"
            data-tutorial-id="fantasyrealms-live-center-row"
        >
            <div
                className={`fr-discard-row fr-discard-row--live-center${discardCards.length === 0 ? ' fr-discard-row--empty' : ''}${discardCards.length > 0 ? ' fr-discard-row--table-center' : ''}`}
                data-testid="fantasyrealms-discard-row"
                style={minimalLiveDiscardRowStyle}
            >
                {liveCenterMotionOverlay ? (
                    <div
                        className="fr-live-center-selection-notice"
                        style={liveCenterMotionOverlay.slotStyle}
                        data-testid="fantasyrealms-live-center-selection-notice"
                    >
                        <div
                            className={`fr-card-button fr-card-button--live-center ${liveCenterMotionOverlay.type === 'enter' ? 'fr-card-button--motion-center-receive' : 'fr-card-button--motion-center-exit'}`}
                            data-testid={liveCenterMotionOverlay.type === 'enter' ? 'fantasyrealms-live-center-enter-card' : 'fantasyrealms-live-center-exit-card'}
                            aria-hidden="true"
                            onAnimationEnd={() => {
                                const cueKey = liveCenterMotionOverlay.cueKey;
                                const cardId = liveCenterMotionOverlay.card.id;
                                setLiveCenterMotionOverlay((current) => (current?.cueKey === cueKey ? null : current));
                                setLiveCenterHeldCard((current) => (
                                    current?.cueKey === cueKey && current.cardId === cardId ? null : current
                                ));
                                setLiveHandHeldCard((current) => (
                                    current?.cueKey === cueKey && current.cardId === cardId ? null : current
                                ));
                            }}
                        >
                            <FantasyRealmsCard card={liveCenterMotionOverlay.card} t={t} locale={locale} />
                        </div>
                        <div className="fr-endgame-card-delta fr-live-center-selection-notice-label">
                            <span
                                className="fr-endgame-card-delta-text fr-live-center-selection-notice-text"
                                data-testid="fantasyrealms-live-center-selection-notice-badge"
                            >
                                {t(
                                    liveCenterMotionOverlay.type === 'enter'
                                        ? 'actions.centerDiscardNotice'
                                        : 'actions.centerTakeNotice',
                                    { player: liveCenterMotionOverlay.playerName },
                                )}
                            </span>
                        </div>
                    </div>
                ) : null}
                <div
                    className="fr-live-center-slot-grid"
                    data-testid={discardCards.length === 0 ? 'fantasyrealms-discard-empty' : 'fantasyrealms-discard-slot-grid'}
                    aria-hidden={discardCards.length === 0 ? 'true' : undefined}
                >
                    {minimalLiveCenterSlots.map((slot) => (slot.card ? (
                        <button
                            key={slot.key}
                            type="button"
                            className={`fr-card-button fr-card-button--live-center${core.focusCardId === slot.card.id && shouldShowTutorialSelectedCard(slot.card.id) ? ' fr-card-button--selected' : ''}${canTutorialTakeDiscard && isTutorialTargetAllowed(slot.card.id) ? ' fr-card-button--actionable' : ''}${liveMotionCue?.type === 'hand-to-center' && liveMotionCue.cardIds.includes(slot.card.id) ? ' fr-card-button--motion-center-receive' : ''}`}
                            onClick={() => handleDiscardPileClick(slot.card!)}
                            style={slot.style}
                            data-action-state={canTutorialTakeDiscard && isTutorialTargetAllowed(slot.card.id) ? 'take' : 'inspect'}
                            data-tutorial-id={`fantasyrealms-card-discard-${slot.card.id}`}
                            aria-label={canTutorialTakeDiscard && isTutorialTargetAllowed(slot.card.id)
                                ? t('actions.takeDiscardAria', { name: getFantasyRealmsCardDisplayName(slot.card) })
                                : t('actions.inspectDiscardAria', { name: getFantasyRealmsCardDisplayName(slot.card) })}
                            {...getTouchInspectProps(`discard:${slot.card.id}`, slot.card)}
                        >
                            <FantasyRealmsCard card={slot.card} t={t} locale={locale} />
                            {shouldShowInlineMagnifyButton ? renderCardMagnifyButton(slot.card, 'discard', openCardMagnify, t) : null}
                        </button>
                    ) : shouldShowLiveCenterPlaceholders ? (
                        <div
                            key={slot.key}
                            className="fr-card-slot fr-card-slot--live-center-placeholder atlas-shimmer"
                            style={{ ...slot.style, zIndex: 0 }}
                            aria-hidden="true"
                        />
                    ) : null))}
                </div>
            </div>
        </section>
    );

    const minimalLiveHandZoneSection = (
        <section
            ref={liveHandZoneRef}
            className={`fr-live-hand-zone${displayedHandCards.length === 0 ? ' fr-live-hand-zone--empty' : ''}${canTutorialDiscard || canTutorialTakeDiscard ? ' fr-live-hand-zone--actioning' : ''}${liveMotionCue?.type === 'draw-to-hand' ? ' fr-live-hand-zone--motion-draw' : ''}${liveMotionCue?.type === 'center-to-hand' ? ' fr-live-hand-zone--motion-take' : ''}${liveMotionCue?.type === 'opening-deal' ? ' fr-live-hand-zone--motion-opening' : ''}`}
            aria-label={t('zone.hand.ariaLabel')}
            data-motion={liveMotionCue?.type === 'draw-to-hand' || liveMotionCue?.type === 'center-to-hand' || liveMotionCue?.type === 'opening-deal' ? liveMotionCue.type : 'idle'}
            data-selection-state={canTutorialDiscard ? 'discard' : canTutorialTakeDiscard ? 'take-discard' : 'inspect'}
            data-testid="fantasyrealms-live-hand-zone"
            data-tutorial-id="fantasyrealms-live-hand-zone"
        >
            <div className="fr-live-hand-zone-header fr-live-hand-zone-header--solo">
                <div className="fr-live-hand-zone-heading">
                    <div className="fr-live-hand-zone-title">{liveHandZoneTitle}</div>
                </div>
            </div>
            <div className="fr-card-row-wrap">
                <div
                    ref={liveHandRowRef}
                    className="fr-card-row fr-card-row--live-hand-zone"
                    data-testid="fantasyrealms-hand-row"
                    data-slot-count={handSlotCount}
                    data-visible-count={displayedHandCards.length}
                    data-hand-density={isCompressedHandDensity ? 'compressed' : 'default'}
                    style={handRowLayoutStyle}
                >
                    {displayedHandCards.length > 0
                        ? displayedHandCards.map((card, index) => (
                        <button
                            key={`live-hand-${card.id}`}
                            type="button"
                            className={`fr-card-button fr-card-button--live-hand${core.focusCardId === card.id && shouldShowTutorialSelectedCard(card.id) ? ' fr-card-button--selected' : ''}${canTutorialDiscard && isTutorialTargetAllowed(card.id) ? ' fr-card-button--actionable' : ''}${liveMotionCue?.type === 'draw-to-hand' && liveMotionCue.cardIds.includes(card.id) ? ' fr-card-button--motion-hand-draw' : ''}${liveMotionCue?.type === 'center-to-hand' && liveMotionCue.cardIds.includes(card.id) ? ' fr-card-button--motion-hand-take' : ''}${liveMotionCue?.type === 'opening-deal' && liveMotionCue.cardIds.includes(card.id) ? ' fr-card-button--motion-hand-opening' : ''}${isGameOver && endgameScoreSequence.activeStep?.cardId === card.id ? ' fr-card-button--score-settling' : ''}`}
                            onClick={() => handleHandCardClick(card)}
                            onMouseEnter={() => {
                                if (isGameOver && !isCoarsePointer) {
                                    setHoveredEndgameCardId(card.id);
                                }
                            }}
                            onMouseLeave={() => {
                                if (isGameOver && !isCoarsePointer) {
                                    setHoveredEndgameCardId((current) => (current === card.id ? null : current));
                                }
                            }}
                            style={minimalLiveHandCardStyles[index]}
                            data-action-state={canDiscard ? 'discard' : 'inspect'}
                            data-tutorial-id={`fantasyrealms-card-hand-${card.id}`}
                            data-score-settling={isGameOver && endgameScoreSequence.activeStep?.cardId === card.id ? 'true' : 'false'}
                            aria-label={canDiscard
                                ? t('actions.discardHandAria', { name: getFantasyRealmsCardDisplayName(card) })
                                : t('actions.inspectHandAria', { name: getFantasyRealmsCardDisplayName(card) })}
                            {...getTouchInspectProps(`hand:${card.id}`, card)}
                        >
                            <FantasyRealmsCard card={card} t={t} locale={locale} />
                            {isGameOver && endgameScoreSequence.activeStep?.cardId === card.id ? (
                                <ScoreBurstBadge
                                    key={`${endgameScoreSequence.activeStep.key}-${endgameScoreSequence.activeStep.delta}`}
                                    value={formatSignedDelta(endgameScoreSequence.activeStep.delta)}
                                    tone={endgameScoreSequence.activeStep.delta < 0 ? 'crimson' : 'gold'}
                                    emphasis={Math.abs(endgameScoreSequence.activeStep.delta) >= 30 ? 'strong' : 'normal'}
                                    className="fr-endgame-card-delta"
                                    textClassName="fr-endgame-card-delta-text"
                                    testId="fantasyrealms-endgame-card-delta"
                                />
                            ) : isGameOver
                                && !endgameScoreSequence.isRunning
                                && endgameCardDeltaById.has(card.id)
                                && (
                                    hoveredEndgameCardId === card.id
                                    || selectedEndgameCardId === card.id
                                ) ? (
                                    <div className="fr-endgame-card-delta fr-endgame-card-delta--static" data-testid="fantasyrealms-endgame-card-delta">
                                        <span className="fr-endgame-card-delta-text">
                                            {formatSignedDelta(endgameCardDeltaById.get(card.id) ?? 0)}
                                        </span>
                                    </div>
                            ) : null}
                            {shouldShowInlineMagnifyButton ? renderCardMagnifyButton(card, 'hand', openCardMagnify, t) : null}
                        </button>
                        ))
                        : buildCenteredLiveHandSlots([], handSlotCount).map((slot) => (
                            <div
                                key={slot.key}
                                className="fr-card-slot fr-card-slot--live-hand"
                                data-testid="fantasyrealms-card-slot-empty"
                                aria-hidden="true"
                            />
                        ))}
                </div>
            </div>
        </section>
    );

    const shouldUseLegacyMinimalLiveOpeningShell = false;
    const isMinimalLiveOpeningState = shouldUseLegacyMinimalLiveOpeningShell
        && !isDuelAutoOpeningFlow
        && !isGameOver
        && discardCards.length === 0
        && displayedHandCards.length === 0;
    const isMinimalLiveEarlyDrawState = shouldUseLegacyMinimalLiveOpeningShell
        && !isDuelAutoOpeningFlow
        && !isGameOver
        && discardCards.length === 0
        && displayedHandCards.length > 0
        && displayedHandCards.length <= 2;

    React.useEffect(() => {
        debugFantasyRealmsOpeningLoop('render-state', {
            currentPlayer: core.currentPlayer,
            stage: core.stage,
            turn: core.turn,
            handCount: displayedHandCards.length,
            discardCount: discardCards.length,
            shouldAutoDrawFromDeck,
            isDuelAutoOpeningFlow,
            shouldUseLegacyMinimalLiveOpeningShell,
            isMinimalLiveOpeningState,
            isMinimalLiveEarlyDrawState,
            shouldShowLiveCenterPlaceholders,
            liveMotionCueType: liveMotionCue?.type ?? null,
            liveMotionCueKey: liveMotionCue?.key ?? null,
        });
    }, [
        core.currentPlayer,
        core.stage,
        core.turn,
        discardCards.length,
        displayedHandCards.length,
        isDuelAutoOpeningFlow,
        shouldUseLegacyMinimalLiveOpeningShell,
        isMinimalLiveEarlyDrawState,
        isMinimalLiveOpeningState,
        liveMotionCue,
        shouldAutoDrawFromDeck,
        shouldShowLiveCenterPlaceholders,
    ]);

    const liveTableSection = (
        <div
            ref={liveTableRef}
            className={`fr-live-table${isGameOver ? ' fr-live-table--gameover' : ''}${isMinimalLiveOpeningState ? ' fr-live-table--opening' : ''}${isMinimalLiveEarlyDrawState ? ' fr-live-table--early-draw' : ''}`}
            data-testid="fantasyrealms-live-table"
        >
            {minimalLiveTopbarSection}
            {minimalLiveCenterRowSection}
            {minimalLiveHandZoneSection}
            {liveActionButtons.length > 0 ? (
                <div
                    className="fr-live-action-zone"
                    data-testid="fantasyrealms-live-action-zone"
                >
                    {liveActionButtons.map((button) => (
                        <button
                            key={button.key}
                            type="button"
                            className={`fr-live-action-button fr-live-action-button--enabled${button.selected ? ' fr-live-action-button--selected' : ''}`}
                            data-action-mode={button.mode}
                            data-testid={button.testId}
                            data-tutorial-id={button.mode === 'take-discard' ? 'fantasyrealms-live-action-take-discard' : `fantasyrealms-live-action-${button.mode}`}
                            aria-pressed={button.selected}
                            onClick={button.onClick}
                            disabled={button.disabled}
                        >
                            <span className="fr-live-action-button-label">{button.label}</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );

    return (
        <UndoProvider value={{ G, dispatch: runtimeDispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
            <div className="fr-root">
            <style>{`
                .fr-root {
                    --fr-board-shell-reference-width: var(--mobile-board-shell-design-width, ${FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_WIDTH_PX}px);
                    --fr-live-content-width: calc(100vw - ${FANTASY_REALMS_LIVE_DESKTOP_BOARD_INLINE_PADDING_PX * 2}px);
                    --fr-live-opening-hand-row-width: min(1180px, calc(100vw - 240px));
                    --fr-live-center-row-width: var(--fr-live-content-width);
                    --fr-live-desktop-ui-scale: clamp(0.82, calc((100vw - 0px) / 1440px), 1);
                    --fr-live-center-card-width: min(${LIVE_CENTER_CARD_WIDTH_PX}px, max(${LIVE_CENTER_CARD_MIN_WIDTH_PX}px, calc(var(--fr-live-center-row-width) / ${LIVE_CENTER_CARD_WIDTH_FIT_UNITS})));
                    --fr-live-center-card-height: calc(var(--fr-live-center-card-width) / 0.72);
                    --fr-live-center-card-stride: calc(var(--fr-live-center-card-width) * ${LIVE_CENTER_CARD_STRIDE_MULTIPLIER});
                    --fr-live-center-second-row-top: calc(${LIVE_CENTER_ROW_ROW_TOP}px + var(--fr-live-center-card-height) - (var(--fr-live-center-card-width) * ${LIVE_CENTER_SECOND_ROW_OVERLAP_MULTIPLIER}));
                    --fr-live-hand-row-width: min(1510px, calc(var(--fr-live-content-width) - 16px));
                    --fr-live-hand-header-width: var(--fr-live-content-width);
                    --fr-live-action-right-offset: calc(((100vw - var(--fr-live-content-width)) / 2) + 44px);
                    --fr-live-action-bottom-offset: calc(276px * var(--fr-live-desktop-ui-scale));
                    min-height: 100%;
                    overflow-y: auto;
                    padding: 0;
                    color: #f2ead7;
                    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
                    background:
                        radial-gradient(circle at 50% 14%, rgba(96, 157, 130, 0.08), transparent 30%),
                        linear-gradient(180deg, #133730, #0b2520 58%, #081a18);
                }
                .fr-board {
                    width: min(1440px, 100%);
                    margin: 0 auto;
                    border-radius: 16px;
                    padding: 16px;
                    position: relative;
                    overflow: hidden;
                    background:
                        radial-gradient(circle at 50% 36%, rgba(76, 113, 90, 0.28), transparent 30%),
                        linear-gradient(180deg, rgba(53, 87, 69, 0.98), rgba(46, 77, 61, 0.98)),
                        repeating-linear-gradient(135deg, rgba(255,255,255,0.012) 0 2px, rgba(0,0,0,0) 2px 6px);
                    border: none;
                    box-shadow: none;
                }
                .fr-board::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(circle at center, rgba(255,255,255,0.04), transparent 42%),
                        radial-gradient(circle at 18% 18%, rgba(255,255,255,0.03), transparent 16%),
                        radial-gradient(circle at 82% 78%, rgba(0,0,0,0.08), transparent 24%);
                    mix-blend-mode: soft-light;
                    pointer-events: none;
                }
                @media (max-width: 1023px) and (orientation: landscape) {
                    ${FANTASY_REALMS_BOARD_SHELL_SCOPE} .fr-root {
                        height: 100%;
                        min-height: 0;
                        overflow: hidden;
                        --fr-live-content-width: calc(var(--fr-board-shell-reference-width) - ${FANTASY_REALMS_LIVE_DESKTOP_BOARD_INLINE_PADDING_PX * 2}px);
                        --fr-live-opening-hand-row-width: calc(var(--fr-board-shell-reference-width) * ${FANTASY_REALMS_OPENING_HAND_ROW_WIDTH_RATIO.toFixed(6)});
                        --fr-live-center-row-width: var(--fr-live-content-width);
                        --fr-live-hand-row-width: calc(var(--fr-board-shell-reference-width) * ${FANTASY_REALMS_DEFAULT_HAND_ROW_WIDTH_RATIO.toFixed(6)});
                        --fr-live-hand-header-width: var(--fr-live-content-width);
                        --fr-live-desktop-ui-scale: 1;
                        --fr-live-action-right-offset: calc(((var(--fr-board-shell-reference-width) - var(--fr-live-content-width)) / 2) + 44px);
                        --fr-live-center-card-width: min(${LIVE_CENTER_CARD_WIDTH_PX}px, max(${LIVE_CENTER_CARD_MIN_WIDTH_PX}px, calc(var(--fr-live-center-row-width) / ${LIVE_CENTER_CARD_WIDTH_FIT_UNITS})));
                        --fr-live-center-card-height: calc(var(--fr-live-center-card-width) / 0.72);
                        --fr-live-center-card-stride: calc(var(--fr-live-center-card-width) * ${LIVE_CENTER_CARD_STRIDE_MULTIPLIER});
                        --fr-live-center-second-row-top: calc(${LIVE_CENTER_ROW_ROW_TOP}px + var(--fr-live-center-card-height) - (var(--fr-live-center-card-width) * ${LIVE_CENTER_SECOND_ROW_OVERLAP_MULTIPLIER}));
                    }
                    ${FANTASY_REALMS_BOARD_SHELL_SCOPE} .fr-board {
                        width: 100%;
                        max-width: none;
                        height: 100%;
                        min-height: 0;
                    }
                }
                .fr-board--minimal-live {
                    width: calc(100vw - 28px);
                    max-width: none;
                    height: calc(100vh - 28px);
                    min-height: 0;
                    box-sizing: border-box;
                    padding: 18px 24px 22px;
                    border-radius: 22px;
                    background:
                        radial-gradient(circle at 6% 80%, rgba(216, 143, 56, 0.18), transparent 12%),
                        radial-gradient(circle at 95% 20%, rgba(216, 143, 56, 0.14), transparent 12%),
                        linear-gradient(90deg, #110b07, #4f2d16 16%, #2f1a0d 50%, #4f2d16 84%, #110b07);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 223, 156, 0.08),
                        inset 0 0 0 8px rgba(19, 10, 5, 0.28),
                        inset 0 0 64px rgba(0, 0, 0, 0.42),
                        0 22px 52px rgba(0, 0, 0, 0.42);
                }
                .fr-board--minimal-live::before {
                    content: "";
                    position: absolute;
                    inset: 20px 24px 22px;
                    border-radius: 18px;
                    background:
                        radial-gradient(ellipse at 50% 18%, rgba(109, 164, 132, 0.12), transparent 42%),
                        radial-gradient(ellipse at 50% 78%, rgba(0, 0, 0, 0.18), transparent 56%),
                        linear-gradient(180deg, #165044, #0f3b33 58%, #0a2c26);
                    box-shadow:
                        inset 0 0 0 1px rgba(230, 191, 109, 0.16),
                        inset 0 0 0 3px rgba(4, 18, 15, 0.3),
                        inset 0 28px 84px rgba(255, 247, 220, 0.02),
                        inset 0 -72px 120px rgba(0, 0, 0, 0.2);
                    mix-blend-mode: normal;
                    opacity: 1;
                    pointer-events: none;
                }
                .fr-board::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    box-shadow:
                        inset 0 0 120px rgba(8, 12, 10, 0.46);
                    pointer-events: none;
                }
                .fr-board--minimal-live::after {
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 221, 151, 0.12),
                        inset 0 0 120px rgba(0, 0, 0, 0.5);
                }
                .fr-panel--deck-corner {
                    align-self: start;
                }
                .fr-live-table {
                    position: relative;
                    display: grid;
                    grid-template-rows: 116px minmax(0, 1fr) 300px;
                    gap: 10px;
                    height: 100%;
                    min-height: 0;
                }
                .fr-live-table--opening {
                    grid-template-rows: 112px minmax(300px, 1fr) 266px;
                }
                .fr-live-table--gameover {
                    grid-template-rows: auto minmax(0, 1fr) 314px;
                }
                .fr-live-table::before {
                    display: none;
                }
                .fr-live-table::after {
                    display: none;
                }
                .fr-live-topbar {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: 248px minmax(0, 1fr) 172px;
                    box-sizing: border-box;
                    width: 100%;
                    align-items: start;
                    gap: 14px;
                    min-height: 116px;
                    padding: 8px 18px 0;
                }
                .fr-live-topbar--gameover {
                    grid-template-columns: 248px minmax(0, 1fr) 248px;
                    align-items: start;
                    z-index: 8;
                }
                .fr-live-topbar::before {
                    display: none;
                }
                .fr-live-topbar::after {
                    display: none;
                }
                .fr-live-status-strip {
                    position: relative;
                    left: auto;
                    top: auto;
                    transform: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    justify-self: center;
                    gap: 12px;
                    min-width: 0;
                    margin-top: 8px;
                    isolation: isolate;
                }
                .fr-live-status-strip::before {
                    content: "";
                    position: absolute;
                    inset: -6px -12px;
                    border-radius: 14px;
                    background: linear-gradient(180deg, rgba(26, 21, 16, 0.76), rgba(12, 14, 13, 0.74));
                    box-shadow:
                        0 10px 18px rgba(0, 0, 0, 0.12),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                    z-index: -1;
                    pointer-events: none;
                }
                .fr-live-deck {
                    position: relative;
                    left: auto;
                    top: auto;
                    display: grid;
                    justify-items: start;
                    justify-self: start;
                    gap: 10px;
                    min-width: 0;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    cursor: default;
                }
                .fr-live-deck-cue {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    width: 100%;
                    justify-content: flex-start;
                    pointer-events: auto;
                }
                .fr-live-deck::before {
                    content: "";
                    position: absolute;
                    left: -8px;
                    top: -6px;
                    width: 122px;
                    height: 142px;
                    border-radius: 18px;
                    background:
                        radial-gradient(ellipse at 42% 18%, rgba(255, 224, 152, 0.1), transparent 34%),
                        linear-gradient(180deg, rgba(58, 36, 20, 0.32), rgba(10, 10, 9, 0.03));
                    box-shadow:
                        0 18px 28px rgba(0, 0, 0, 0.2),
                        inset 0 0 0 1px rgba(255, 226, 164, 0.06);
                    pointer-events: none;
                }
                .fr-live-deck::after {
                    content: "";
                    position: absolute;
                    left: 8px;
                    top: 10px;
                    width: 86px;
                    height: 116px;
                    border-radius: 14px;
                    box-shadow:
                        8px 8px 0 rgba(52, 25, 13, 0.28),
                        13px 13px 0 rgba(12, 8, 6, 0.22);
                    pointer-events: none;
                }
                .fr-live-deck-stack {
                    position: relative;
                    z-index: 1;
                    width: 96px;
                    height: 132px;
                    border-radius: 12px;
                    flex: 0 0 auto;
                    filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.24));
                    transition: transform 140ms ease;
                }
                .fr-live-deck-stack .fr-stack-card {
                    inset: 0;
                }
                .fr-live-deck-count {
                    position: relative;
                    z-index: 1;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 48px;
                    height: 36px;
                    padding: 0 11px;
                    font-size: 30px;
                    line-height: 1;
                    color: #ffe1a0;
                    border-radius: 11px;
                    border: 1px solid rgba(235, 190, 96, 0.28);
                    background: rgba(12, 14, 11, 0.8);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.08),
                        0 8px 14px rgba(0, 0, 0, 0.18);
                    text-shadow: none;
                }
                .fr-live-chip {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 46px;
                    padding: 0 18px;
                    border-radius: 11px;
                    border: 0;
                    background: linear-gradient(180deg, rgba(42, 33, 24, 0.88), rgba(12, 12, 11, 0.9));
                    box-shadow:
                        0 10px 16px rgba(0, 0, 0, 0.12),
                        inset 0 1px 0 rgba(255,255,255,0.04);
                    color: #f3dfad;
                    font-weight: 800;
                    line-height: 1;
                    white-space: nowrap;
                    text-shadow: none;
                    overflow: hidden;
                }
                .fr-live-chip::before {
                    display: none;
                }
                .fr-live-chip--turn {
                    min-width: 128px;
                    font-size: 28px;
                    padding: 0 22px;
                    background: linear-gradient(180deg, rgba(68, 48, 29, 0.92), rgba(22, 16, 12, 0.94));
                }
                .fr-live-chip--turn-active {
                    min-width: 158px;
                    animation: fr-live-turn-chip-breathe 1800ms ease-in-out infinite;
                }
                .fr-live-chip--turn-finished {
                    min-width: 146px;
                    font-size: 22px;
                    color: #ffe6aa;
                }
                .fr-live-chip--round {
                    min-height: 36px;
                    padding: 0 14px;
                    font-size: 14px;
                    font-weight: 700;
                    color: rgba(255, 237, 197, 0.84);
                    background: rgba(19, 20, 18, 0.82);
                }
                .fr-live-chip--progress {
                    min-width: 96px;
                    font-size: 24px;
                    padding: 0 18px;
                    background: linear-gradient(180deg, rgba(80, 40, 28, 0.92), rgba(30, 16, 12, 0.94));
                }
                .fr-live-chip--cue {
                    min-height: 38px;
                    padding: 0 16px;
                    font-size: 15px;
                    background: linear-gradient(180deg, rgba(24, 68, 60, 0.82), rgba(10, 31, 28, 0.86));
                    color: rgba(255, 242, 207, 0.92);
                }
                .fr-live-score-strip {
                    position: relative;
                    top: auto;
                    right: auto;
                    justify-self: end;
                    width: 172px;
                    margin-top: 8px;
                }
                .fr-live-score-strip--gameover {
                    position: relative;
                    z-index: 8;
                    width: 248px;
                    display: grid;
                    align-content: start;
                    gap: 8px;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    box-shadow: none;
                }
                .fr-live-score-band {
                    position: relative;
                    height: 78px;
                    padding: 12px 14px;
                    border-radius: 9px;
                    border: 0;
                    background: linear-gradient(180deg, rgba(18, 18, 16, 0.92), rgba(6, 6, 6, 0.94));
                    box-shadow:
                        0 14px 24px rgba(0,0,0,0.14),
                        inset 0 1px 0 rgba(255,255,255,0.04);
                }
                .fr-live-score-band--gameover {
                    height: auto;
                    min-height: 0;
                    padding: 0 0 8px;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                    border-bottom: 1px solid rgba(228, 193, 128, 0.16);
                }
                .fr-live-score-band--gameover::before {
                    display: none;
                }
                .fr-live-score-band::before {
                    content: "";
                    position: absolute;
                    inset: 6px;
                    border-radius: 6px;
                    border: 1px solid rgba(227, 188, 106, 0.22);
                    pointer-events: none;
                }
                .fr-live-score-band::after {
                    display: none;
                }
                .fr-live-score-band-kicker {
                    position: relative;
                    z-index: 1;
                    color: rgba(246, 223, 180, 0.72);
                    font-size: 10px;
                    line-height: 1;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                }
                .fr-live-score-band-main {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 12px;
                    margin-top: 10px;
                }
                .fr-live-score-band-main span {
                    color: rgba(246, 223, 180, 0.72);
                    font-size: 14px;
                    font-weight: 700;
                    white-space: nowrap;
                }
                .fr-live-score-band--gameover .fr-live-score-band-kicker {
                    color: rgba(246, 223, 180, 0.72);
                    font-size: 11px;
                    letter-spacing: 0.02em;
                }
                .fr-live-score-band--gameover .fr-live-score-band-main {
                    margin-top: 6px;
                    align-items: center;
                }
                .fr-live-score-band--gameover .fr-live-score-band-total {
                    font-size: 34px;
                }
                .fr-live-score-band--gameover .fr-live-score-band-main span {
                    display: inline;
                    min-height: 0;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    color: rgba(246, 223, 180, 0.84);
                    font-size: 13px;
                }
                .fr-live-score-band-total {
                    color: #ffe4a4;
                    font-family: Georgia, "Times New Roman", "Microsoft YaHei", serif;
                    font-size: 38px;
                    font-weight: 900;
                    line-height: 1;
                    text-shadow: 0 3px 10px rgba(0, 0, 0, 0.22);
                    transform-origin: right center;
                    transition: transform 180ms ease, color 180ms ease;
                }
                .fr-live-score-band-total--pulse {
                    transform: scale(1.15);
                    color: #fff6da;
                    text-shadow:
                        0 3px 10px rgba(0, 0, 0, 0.22),
                        0 0 18px rgba(255, 215, 132, 0.26),
                        0 0 32px rgba(255, 229, 177, 0.18);
                }
                .fr-live-center-row,
                .fr-live-hand-zone {
                    position: relative;
                    z-index: 1;
                    overflow: visible;
                    border-radius: 0;
                    background: transparent;
                    border: none;
                }
                .fr-live-center-row {
                    display: grid;
                    align-items: center;
                    padding-top: 2px;
                }
                .fr-live-center-row--empty {
                    pointer-events: none;
                }
                .fr-live-center-row::before {
                    content: "";
                    position: absolute;
                    left: 13%;
                    right: 13%;
                    top: 58px;
                    bottom: 82px;
                    border-radius: 48%;
                    background:
                        radial-gradient(ellipse at 50% 42%, rgba(255, 233, 178, 0.05), transparent 56%),
                        radial-gradient(ellipse at 50% 76%, rgba(0, 0, 0, 0.16), transparent 72%);
                    filter: blur(3px);
                    pointer-events: none;
                }
                .fr-live-center-row--empty::before {
                    left: 17%;
                    right: 17%;
                    top: 84px;
                    bottom: 118px;
                    background:
                        radial-gradient(ellipse at 50% 42%, rgba(255, 233, 178, 0.025), transparent 60%),
                        radial-gradient(ellipse at 50% 76%, rgba(0, 0, 0, 0.08), transparent 74%);
                }
                .fr-live-hand-zone {
                    display: grid;
                    align-items: end;
                    padding: 4px 24px 16px;
                }
                .fr-live-center-row::after {
                    display: none;
                }
                .fr-live-hand-zone::before {
                    content: "";
                    position: absolute;
                    left: 3.4%;
                    right: 3.4%;
                    top: 70px;
                    bottom: 8px;
                    border-radius: 24px 24px 16px 16px;
                    background:
                        linear-gradient(180deg, rgba(12, 41, 35, 0.01), rgba(4, 18, 15, 0.08) 28%, rgba(2, 10, 9, 0.14)),
                        radial-gradient(ellipse at 50% 6%, rgba(255, 229, 168, 0.02), transparent 48%);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 242, 212, 0.012),
                        inset 0 -16px 24px rgba(0, 0, 0, 0.06);
                    pointer-events: none;
                }
                .fr-live-hand-zone--empty::before {
                    top: 148px;
                    bottom: 12px;
                    left: 4.8%;
                    right: 4.8%;
                    background:
                        linear-gradient(180deg, rgba(11, 30, 26, 0.008), rgba(3, 14, 11, 0.06) 28%, rgba(2, 9, 8, 0.11)),
                        radial-gradient(ellipse at 50% 10%, rgba(255, 229, 168, 0.015), transparent 50%);
                }
                .fr-live-table--opening .fr-live-center-row::before {
                    left: 28%;
                    right: 28%;
                    top: 146px;
                    bottom: 166px;
                    background:
                        radial-gradient(ellipse at 50% 48%, rgba(255, 233, 178, 0.02), transparent 62%),
                        radial-gradient(ellipse at 50% 78%, rgba(0, 0, 0, 0.05), transparent 76%);
                }
                .fr-live-table--opening .fr-live-center-row::after {
                    content: "";
                    position: absolute;
                    left: 34%;
                    right: 34%;
                    top: 206px;
                    height: 2px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, transparent, rgba(255, 229, 170, 0.16), transparent);
                    opacity: 0.42;
                    pointer-events: none;
                }
                .fr-live-table--opening .fr-zone-empty--silent {
                    display: none;
                }
                .fr-live-table--opening .fr-live-hand-zone::before {
                    display: none;
                }
                .fr-live-table--opening .fr-live-hand-zone {
                    padding-top: 2px;
                }
                .fr-live-table--opening .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: var(--fr-live-opening-hand-row-width);
                    gap: 14px;
                    transform: translateY(-18px);
                }
                .fr-live-table--opening .fr-card-slot--live-hand {
                    opacity: 0.9;
                    border-style: solid;
                    border-color: rgba(255, 236, 190, 0.12);
                    background:
                        linear-gradient(180deg, rgba(255, 246, 222, 0.028), rgba(0, 0, 0, 0.02)),
                        rgba(9, 17, 15, 0.02);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 241, 205, 0.02),
                        0 12px 18px rgba(0, 0, 0, 0.05);
                }
                .fr-live-table--opening .fr-card-slot--live-hand:nth-child(3),
                .fr-live-table--opening .fr-card-slot--live-hand:nth-child(4) {
                    opacity: 1;
                    border-color: rgba(255, 229, 170, 0.24);
                    background:
                        linear-gradient(180deg, rgba(255, 244, 214, 0.06), rgba(0, 0, 0, 0.022)),
                        rgba(12, 20, 17, 0.03);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 240, 198, 0.04),
                        0 14px 20px rgba(0, 0, 0, 0.06),
                        0 0 0 1px rgba(255, 232, 180, 0.05);
                }
                .fr-live-hand-zone::after {
                    display: none;
                }
                .fr-live-endgame {
                    width: 100%;
                }
                .fr-live-endgame--docked {
                    position: relative;
                    top: auto;
                    right: auto;
                    z-index: auto;
                    pointer-events: auto;
                }
                .fr-live-endgame-rail {
                    display: grid;
                    gap: 10px;
                    padding: 12px;
                    border-radius: 18px;
                    border: 1px solid rgba(255, 228, 179, 0.12);
                    background:
                        linear-gradient(180deg, rgba(25, 37, 31, 0.94), rgba(16, 24, 20, 0.96));
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 239, 197, 0.04),
                        0 18px 30px rgba(0, 0, 0, 0.22);
                    pointer-events: auto;
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rail {
                    gap: 4px;
                    padding: 0;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                }
                .fr-live-endgame-rail-header {
                    display: grid;
                    gap: 8px;
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rail-header {
                    gap: 0;
                }
                .fr-live-endgame-rail-title {
                    display: flex;
                    align-items: center;
                    color: rgba(242, 234, 215, 0.8);
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rail-title {
                    font-size: 11px;
                    letter-spacing: 0.08em;
                }
                .fr-live-endgame-rail-subtitle {
                    padding: 10px 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    background: rgba(12, 7, 5, 0.24);
                    color: rgba(242, 234, 215, 0.84);
                    font-size: 12px;
                    line-height: 1.45;
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rail-subtitle {
                    display: none;
                }
                .fr-live-endgame-rail-list {
                    display: grid;
                    gap: 8px;
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rail-list {
                    gap: 0;
                }
                .fr-live-endgame-rank-button {
                    width: 100%;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border-radius: 14px;
                    border: 1px solid rgba(228, 193, 128, 0.14);
                    background: rgba(12, 7, 5, 0.24);
                    color: #f2ead7;
                    text-align: left;
                    cursor: pointer;
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 255, 255, 0.02);
                    transition:
                        border-color 140ms ease,
                        background 140ms ease,
                        transform 140ms ease;
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rank-button {
                    gap: 12px;
                    padding: 10px 0;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                    border-bottom: 1px solid rgba(228, 193, 128, 0.12);
                }
                .fr-live-endgame-rank-button:hover {
                    transform: translateY(-1px);
                    border-color: rgba(243, 201, 116, 0.28);
                    background: rgba(44, 28, 13, 0.34);
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rank-button:hover {
                    transform: none;
                    border-color: transparent;
                    background: rgba(255, 236, 189, 0.03);
                }
                .fr-live-endgame-rank-button--active {
                    border-color: rgba(243, 201, 116, 0.42);
                    background: rgba(44, 28, 13, 0.42);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.08),
                        0 10px 18px rgba(0, 0, 0, 0.18);
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rank-button--active {
                    border-color: transparent;
                    background: rgba(255, 231, 173, 0.06);
                    box-shadow: none;
                }
                .fr-live-endgame-rank-button--winner {
                    border-color: rgba(255, 219, 142, 0.42);
                    background:
                        radial-gradient(circle at 94% 20%, rgba(255, 213, 128, 0.18), transparent 34%),
                        rgba(54, 32, 14, 0.5);
                }
                .fr-live-score-strip--gameover .fr-live-endgame-rank-button--winner {
                    border-color: transparent;
                    background:
                        linear-gradient(90deg, rgba(255, 220, 142, 0.12), rgba(255, 220, 142, 0.02));
                }
                .fr-live-endgame-rank-button--silver {
                    border-color: rgba(222, 228, 232, 0.2);
                }
                .fr-live-endgame-rank-button--bronze {
                    border-color: rgba(205, 143, 79, 0.2);
                }
                .fr-live-endgame-rank-copy {
                    min-width: 0;
                    display: grid;
                    gap: 6px;
                }
                .fr-live-endgame-rank-order {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    color: rgba(242, 234, 215, 0.64);
                    font-size: 12px;
                    font-weight: 700;
                    line-height: 1;
                }
                .fr-live-endgame-rank-order--gold {
                    color: #ffd98a;
                }
                .fr-live-endgame-rank-order--silver {
                    color: #dfe8ec;
                }
                .fr-live-endgame-rank-order--bronze {
                    color: #d59a66;
                }
                .fr-live-endgame-rank-name {
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 6px;
                    color: #f2ead7;
                    font-size: 13px;
                    font-weight: 700;
                }
                .fr-live-endgame-rank-crown {
                    width: 1.08em;
                    height: 1.08em;
                    color: #ffd98a;
                    filter: drop-shadow(0 0 6px rgba(255, 217, 138, 0.34));
                    flex: 0 0 auto;
                }
                .fr-live-endgame-rank-score {
                    color: #f2ead7;
                    font-size: 22px;
                    font-weight: 800;
                    line-height: 1;
                    font-variant-numeric: tabular-nums;
                }
                .fr-live-endgame-rank-button--gold .fr-live-endgame-rank-score,
                .fr-live-endgame-rank-button--winner .fr-live-endgame-rank-score {
                    color: #ffe2a1;
                }
                .fr-live-endgame-rank-button--silver .fr-live-endgame-rank-score {
                    color: #edf4f6;
                }
                .fr-live-endgame-rank-button--bronze .fr-live-endgame-rank-score {
                    color: #e6ad78;
                }
                .fr-live-endgame-reviewed-player {
                    color: rgba(242, 234, 215, 0.72);
                    font-size: 12px;
                    text-align: left;
                }
                .fr-live-score-strip--gameover .fr-live-endgame-reviewed-player {
                    padding-top: 4px;
                    color: rgba(242, 234, 215, 0.58);
                    font-size: 11px;
                }
                .fr-discard-row--live-center {
                    position: relative;
                    display: block;
                    width: var(--fr-live-center-row-width);
                    min-height: 342px;
                    height: 100%;
                    margin: 0 auto;
                    padding: 0;
                }
                .fr-zone-empty--silent {
                    min-height: 120px;
                    padding: 0;
                    border: none;
                    background: transparent;
                }
                .fr-live-center-slot-grid {
                    position: absolute;
                    inset: 0;
                    pointer-events: auto;
                }
                .fr-card-button--live-center {
                    position: absolute;
                    width: var(--fr-live-center-card-width);
                    pointer-events: auto;
                }
                .fr-card-button--live-center:not(.fr-card-button--motion-center-receive):not(.fr-card-button--motion-center-exit) {
                    transition:
                        left 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        top 220ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                .fr-card-button--live-center .fr-card {
                    border-radius: 14px;
                    border-color: rgba(255, 238, 199, 0.58);
                    box-shadow:
                        0 28px 38px rgba(0, 0, 0, 0.48),
                        0 9px 15px rgba(0, 0, 0, 0.2),
                        0 0 20px rgba(255, 225, 158, 0.08);
                    transition:
                        box-shadow 140ms ease,
                        border-color 140ms ease,
                        transform 140ms ease;
                }
                .fr-card-button--live-center.fr-card-button--actionable .fr-card,
                .fr-card-button--live-hand.fr-card-button--actionable .fr-card {
                    transform: none;
                }
                .fr-card-button--live-center.fr-card-button--actionable .fr-card {
                    border-color: rgba(255, 238, 201, 0.72);
                    box-shadow:
                        0 20px 34px rgba(0, 0, 0, 0.34),
                        0 0 0 1px rgba(255, 243, 213, 0.16);
                }
                .fr-card-button--armed .fr-card {
                    border-color: rgba(255, 245, 214, 0.94) !important;
                    box-shadow:
                        0 22px 36px rgba(0, 0, 0, 0.34),
                        0 0 0 2px rgba(255, 226, 156, 0.52) !important;
                }
                .fr-live-hand-zone .fr-card-row-wrap {
                    position: relative;
                    padding: 0;
                    gap: 12px;
                }
                .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    position: relative;
                    z-index: 1;
                    width: var(--fr-live-hand-row-width);
                    margin: 0 auto;
                    grid-template-columns: repeat(7, minmax(0, 1fr));
                    justify-content: center;
                    gap: 16px;
                }
                .fr-card-button--live-hand {
                    position: relative;
                    transform: none;
                    width: 100%;
                    max-width: none;
                    transition:
                        transform 180ms ease,
                        opacity 180ms ease;
                }
                .fr-card-slot--live-hand {
                    width: 100%;
                    max-width: none;
                    border-radius: 14px;
                    border: 1px solid rgba(255, 235, 191, 0.04);
                    background:
                        linear-gradient(180deg, rgba(18, 29, 24, 0.03), rgba(8, 14, 11, 0.06)),
                        rgba(7, 12, 10, 0.015);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 245, 214, 0.008),
                        inset 0 10px 18px rgba(255, 255, 255, 0.004);
                }
                .fr-card-button--live-hand .fr-card {
                    border-radius: 14px;
                    border-color: rgba(255, 238, 199, 0.62);
                    box-shadow:
                        0 30px 40px rgba(0, 0, 0, 0.5),
                        0 9px 15px rgba(0, 0, 0, 0.22),
                        0 0 20px rgba(255, 225, 158, 0.08);
                    transition:
                        box-shadow 140ms ease,
                        border-color 140ms ease,
                        transform 140ms ease;
                }
                .fr-card-button--live-hand.fr-card-button--actionable .fr-card {
                    border-color: rgba(255, 238, 201, 0.72);
                    box-shadow:
                        0 20px 30px rgba(0, 0, 0, 0.32),
                        0 0 0 1px rgba(255, 243, 213, 0.16);
                }
                .fr-card-button--live-hand.fr-card-button--pending-discard {
                    transform: translateY(-8px);
                }
                .fr-card-button--live-hand.fr-card-button--pending-discard .fr-card {
                    border-color: rgba(255, 226, 154, 0.92);
                    box-shadow:
                        0 24px 34px rgba(0, 0, 0, 0.38),
                        0 0 0 2px rgba(255, 215, 128, 0.32),
                        0 0 22px rgba(255, 196, 92, 0.18);
                }
                .fr-live-hand-zone-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                    width: var(--fr-live-hand-header-width);
                    margin: 0 auto 6px;
                }
                .fr-live-hand-zone-header--solo {
                    justify-content: center;
                }
                .fr-live-hand-zone-heading {
                    display: grid;
                    gap: 8px;
                    min-height: 46px;
                    min-width: 0;
                }
                .fr-live-hand-zone-title {
                    color: rgba(247, 229, 190, 0.78);
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .fr-live-action-zone {
                    position: relative;
                    z-index: 3;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 10px;
                    flex: 0 0 auto;
                    width: auto;
                    height: auto;
                    min-height: 0;
                    pointer-events: auto;
                }
                .fr-live-action-button {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 176px;
                    height: 52px;
                    padding: 10px 16px;
                    border-radius: 10px;
                    border: 1px solid rgba(226, 184, 96, 0.28);
                    background:
                        radial-gradient(circle at 50% 12%, rgba(255, 236, 178, 0.08), transparent 36%),
                        linear-gradient(180deg, rgba(52, 35, 20, 0.88), rgba(12, 11, 10, 0.92));
                    color: rgba(255, 231, 175, 0.78);
                    text-align: center;
                    box-shadow:
                        0 10px 18px rgba(0,0,0,0.16),
                        inset 0 1px 0 rgba(255,255,255,0.06),
                        inset 0 -12px 20px rgba(0, 0, 0, 0.16);
                    cursor: default;
                    overflow: hidden;
                    transition:
                        box-shadow 140ms ease,
                        background 140ms ease,
                        color 140ms ease,
                        transform 140ms ease;
                }
                .fr-live-action-button::before {
                    display: none;
                }
                .fr-live-action-button::after {
                    display: none;
                }
                .fr-live-action-button-label {
                    position: relative;
                    z-index: 1;
                    max-width: 144px;
                    font-size: 16px;
                    font-weight: 900;
                    line-height: 1.1;
                    letter-spacing: 0;
                    white-space: normal;
                    word-break: keep-all;
                }
                .fr-live-action-button--enabled {
                    background:
                        radial-gradient(circle at 50% 10%, rgba(255, 239, 190, 0.14), transparent 34%),
                        linear-gradient(180deg, rgba(120, 78, 34, 0.94), rgba(58, 33, 15, 0.94));
                    color: #ffecb9;
                    box-shadow:
                        0 12px 20px rgba(0,0,0,0.22),
                        inset 0 1px 0 rgba(255,255,255,0.12),
                        inset 0 -16px 22px rgba(0, 0, 0, 0.18);
                    cursor: pointer;
                }
                .fr-live-action-button--selected {
                    border-color: rgba(255, 226, 154, 0.56);
                    box-shadow:
                        0 14px 26px rgba(0,0,0,0.24),
                        0 0 0 2px rgba(255, 219, 136, 0.16),
                        inset 0 1px 0 rgba(255,255,255,0.16),
                        inset 0 -16px 22px rgba(0, 0, 0, 0.18);
                }
                .fr-live-action-button[data-action-mode="draw"].fr-live-action-button--enabled {
                    background:
                        radial-gradient(circle at 50% 10%, rgba(255, 239, 190, 0.18), transparent 34%),
                        linear-gradient(180deg, rgba(138, 89, 36, 0.96), rgba(72, 41, 16, 0.96));
                }
                .fr-live-action-button[data-action-mode="take-discard"] {
                    border-color: rgba(236, 203, 122, 0.26);
                    color: rgba(255, 235, 188, 0.92);
                    background:
                        radial-gradient(circle at 50% 8%, rgba(255, 226, 154, 0.08), transparent 34%),
                        linear-gradient(180deg, rgba(73, 57, 36, 0.94), rgba(36, 31, 24, 0.96));
                }
                .fr-live-action-button[data-action-mode="discard"].fr-live-action-button--enabled:not(:disabled) {
                    background:
                        radial-gradient(circle at 50% 8%, rgba(255, 242, 205, 0.22), transparent 36%),
                        linear-gradient(180deg, rgba(165, 102, 40, 0.98), rgba(102, 56, 22, 0.98));
                    box-shadow:
                        0 16px 26px rgba(0, 0, 0, 0.28),
                        0 0 0 1px rgba(255, 232, 176, 0.2),
                        inset 0 1px 0 rgba(255, 244, 214, 0.18),
                        0 0 24px rgba(255, 206, 112, 0.12);
                    animation: fr-live-action-ready-pulse 1400ms ease-in-out infinite;
                }
                .fr-live-action-button--enabled:hover {
                    transform: translateY(-1px);
                    box-shadow:
                        0 18px 28px rgba(0,0,0,0.38),
                        inset 0 1px 0 rgba(255,255,255,0.18),
                        inset 0 -18px 28px rgba(0, 0, 0, 0.28);
                }
                .fr-live-action-button--enabled:active {
                    transform: translateY(1px);
                }
                .fr-live-action-button:disabled {
                    pointer-events: none;
                    opacity: 0.52;
                    cursor: default;
                }
                .fr-live-action-button:focus-visible {
                    outline: 2px solid rgba(255, 238, 201, 0.92);
                    outline-offset: 4px;
                }
                .fr-board--minimal-live {
                    padding: 22px 34px 20px;
                    border-radius: 12px;
                    background: #10241f;
                    box-shadow:
                        inset 0 0 0 1px rgba(214, 170, 94, 0.08),
                        0 18px 34px rgba(0, 0, 0, 0.38);
                }
                .fr-board--minimal-live::before {
                    inset: 12px 16px 14px;
                    border-radius: 10px;
                    background:
                        radial-gradient(ellipse at 50% 40%, rgba(36, 105, 86, 0.28), transparent 58%),
                        linear-gradient(180deg, rgba(18, 75, 62, 0.96), rgba(7, 43, 37, 0.98));
                    box-shadow:
                        inset 0 0 0 1px rgba(228, 193, 126, 0.07),
                        inset 0 46px 90px rgba(255, 246, 216, 0.018),
                        inset 0 -70px 110px rgba(0, 0, 0, 0.24);
                }
                .fr-board--minimal-live::after {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-table {
                    grid-template-rows: 132px minmax(248px, 1fr) 392px;
                    gap: 10px;
                }
                .fr-board--minimal-live .fr-live-table--gameover {
                    grid-template-rows: auto minmax(248px, 1fr) 392px;
                }
                .fr-board--minimal-live .fr-live-table--opening {
                    grid-template-rows: 128px minmax(180px, 0.78fr) 438px;
                }
                .fr-board--minimal-live .fr-live-table--early-draw {
                    grid-template-rows: 128px minmax(176px, 0.8fr) 428px;
                }
                .fr-board--minimal-live .fr-live-topbar {
                    grid-template-columns: 204px minmax(0, 1fr) 194px;
                    min-height: 138px;
                    gap: 20px;
                    padding: 12px 24px 0;
                }
                .fr-board--minimal-live .fr-live-topbar--gameover {
                    grid-template-columns: 204px minmax(0, 1fr) 260px;
                }
                .fr-board--minimal-live .fr-live-status-strip {
                    display: grid;
                    grid-auto-flow: column;
                    grid-auto-columns: max-content;
                    gap: 14px;
                    margin-top: 10px;
                }
                .fr-board--minimal-live .fr-live-status-strip::before {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-chip {
                    min-height: 44px;
                    padding: 0 16px;
                    border-radius: 999px;
                    border: 1px solid rgba(224, 181, 97, 0.48);
                    background:
                        radial-gradient(circle at 50% 0%, rgba(255, 231, 168, 0.16), transparent 42%),
                        linear-gradient(180deg, rgba(60, 40, 24, 0.96), rgba(11, 11, 10, 0.98));
                    box-shadow:
                        0 12px 18px rgba(0, 0, 0, 0.26),
                        inset 0 1px 0 rgba(255, 255, 255, 0.12);
                    color: rgba(248, 231, 195, 0.86);
                    font-size: 16px;
                    font-weight: 800;
                    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
                }
                .fr-board--minimal-live .fr-live-chip::before {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-chip--turn {
                    min-width: 136px;
                    font-size: 24px;
                    padding: 0 20px;
                    color: #ffe6aa;
                }
                .fr-board--minimal-live .fr-live-chip--turn-active {
                    min-width: 150px;
                }
                .fr-board--minimal-live .fr-live-chip--round {
                    min-height: 36px;
                    padding: 0 14px;
                    font-size: 12px;
                    color: rgba(245, 226, 190, 0.76);
                    background:
                        radial-gradient(circle at 50% 0%, rgba(255, 231, 168, 0.08), transparent 42%),
                        linear-gradient(180deg, rgba(28, 29, 22, 0.98), rgba(7, 8, 7, 0.99));
                }
                .fr-board--minimal-live .fr-live-chip--progress {
                    min-width: 92px;
                    font-size: 24px;
                    color: #ffde9e;
                }
                .fr-board--minimal-live .fr-live-chip--cue {
                    min-height: 36px;
                    padding: 0 16px;
                    font-size: 15px;
                    background: linear-gradient(180deg, rgba(18, 56, 50, 0.96), rgba(8, 28, 25, 0.98));
                    color: rgba(234, 248, 233, 0.92);
                }
                .fr-board--minimal-live .fr-live-deck {
                    display: grid;
                    align-content: start;
                    justify-items: start;
                    gap: 12px;
                }
                .fr-board--minimal-live .fr-live-deck-cue {
                    width: 182px;
                }
                .fr-board--minimal-live .fr-live-deck::before,
                .fr-board--minimal-live .fr-live-deck::after {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-deck-stack {
                    width: 182px;
                    height: 246px;
                    border-radius: 14px;
                    filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.3));
                }
                .fr-board--minimal-live .fr-live-deck-stack .fr-stack-card {
                    border-radius: 14px;
                }
                .fr-board--minimal-live .fr-live-deck-count {
                    position: absolute;
                    right: 12px;
                    bottom: 12px;
                    transform: none;
                    z-index: 3;
                    min-width: 46px;
                    height: 34px;
                    padding: 0 10px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 229, 166, 0.34);
                    background: rgba(10, 14, 11, 0.82);
                    box-shadow:
                        0 8px 14px rgba(0, 0, 0, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.12);
                    color: #f6dfaa;
                    font-size: 28px;
                    text-shadow: none;
                }
                .fr-board--minimal-live .fr-live-score-strip {
                    top: auto;
                    right: auto;
                    width: 174px;
                }
                .fr-board--minimal-live .fr-live-score-strip--gameover {
                    width: 300px;
                    padding: 12px;
                }
                .fr-board--minimal-live .fr-live-score-band {
                    display: grid;
                    align-content: center;
                    gap: 6px;
                    width: 100%;
                    height: 78px;
                    padding: 12px 14px;
                    border-radius: 9px;
                    border: 0;
                    background: linear-gradient(180deg, rgba(18, 18, 16, 0.92), rgba(6, 6, 6, 0.94));
                    box-shadow:
                        0 14px 20px rgba(0, 0, 0, 0.14),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                }
                .fr-board--minimal-live .fr-live-score-band-kicker {
                    color: rgba(246, 223, 180, 0.56);
                    font-size: 10px;
                    letter-spacing: 0;
                    text-align: left;
                    white-space: nowrap;
                }
                .fr-board--minimal-live .fr-live-score-band-main {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 8px;
                    margin-top: 0;
                }
                .fr-board--minimal-live .fr-live-score-band-total {
                    font-size: 34px;
                    color: rgba(248, 223, 159, 0.94);
                    font-weight: 750;
                    text-shadow: none;
                }
                .fr-board--minimal-live .fr-live-center-row::before {
                    display: block;
                    left: 13%;
                    right: 13%;
                    top: 42px;
                    bottom: 58px;
                    border-radius: 32px;
                    background:
                        linear-gradient(180deg, rgba(7, 17, 15, 0.025), rgba(2, 10, 9, 0.08)),
                        radial-gradient(ellipse at 50% 30%, rgba(255, 232, 178, 0.03), transparent 62%);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 245, 220, 0.015),
                        inset 0 -18px 28px rgba(0, 0, 0, 0.06);
                }
                .fr-board--minimal-live .fr-discard-row--live-center {
                    width: var(--fr-live-center-row-width);
                    min-height: 312px;
                    transform: translateY(0);
                }
                .fr-board--minimal-live .fr-live-center-selection-notice {
                    position: absolute;
                    z-index: 7;
                    width: var(--fr-live-center-card-width);
                    min-height: 1px;
                    overflow: visible;
                    pointer-events: none;
                }
                .fr-board--minimal-live .fr-live-center-selection-notice .fr-card-button--live-center {
                    left: 0;
                    top: 0;
                }
                .fr-board--minimal-live .fr-live-center-selection-notice-label {
                    left: 50%;
                    right: auto;
                    top: calc(-34px * var(--fr-live-desktop-ui-scale));
                    width: max-content;
                    transform: translateX(-50%);
                }
                .fr-board--minimal-live .fr-live-center-selection-notice-text {
                    color: rgba(248, 223, 159, 0.96);
                    font-size: calc(24px * var(--fr-live-desktop-ui-scale));
                    font-weight: 900;
                    line-height: 0.92;
                    letter-spacing: 0;
                    white-space: nowrap;
                    text-shadow:
                        0 2px 0 rgba(35, 23, 15, 0.26),
                        0 8px 16px rgba(0, 0, 0, 0.22);
                }
                .fr-board--minimal-live .fr-discard-row--empty {
                    min-height: 188px;
                }
                .fr-board--minimal-live .fr-zone-empty--silent {
                    display: block;
                    width: min(1120px, 74vw);
                    height: 198px;
                    margin: 52px auto 0;
                    min-height: 0;
                    border: none;
                    border-radius: 24px;
                    background:
                        linear-gradient(180deg, rgba(10, 20, 16, 0.015), rgba(0, 0, 0, 0.04)),
                        radial-gradient(ellipse at 50% 26%, rgba(255, 236, 197, 0.012), transparent 58%);
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.01);
                    position: relative;
                }
                .fr-board--minimal-live .fr-card-slot--live-center-placeholder {
                    position: absolute;
                    width: calc(var(--fr-live-center-card-width) - 4px);
                    pointer-events: none;
                    border-radius: 14px;
                    border: 1px solid rgba(255, 239, 202, 0.035);
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.008), rgba(0, 0, 0, 0.025)),
                        rgba(6, 15, 13, 0.02);
                    box-shadow:
                        0 12px 18px rgba(0, 0, 0, 0.05),
                        inset 0 1px 0 rgba(255, 255, 255, 0.008);
                    opacity: 0.3;
                }
                .fr-board--minimal-live .fr-card-slot--live-center-placeholder.atlas-shimmer::before,
                .fr-card.fr-card--face.atlas-shimmer::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    pointer-events: none;
                    background-color: rgba(255, 245, 224, 0.05);
                    background-image: linear-gradient(
                        100deg,
                        rgba(255, 245, 224, 0.02) 35%,
                        rgba(255, 241, 210, 0.22) 50%,
                        rgba(255, 245, 224, 0.02) 65%
                    );
                    background-size: 220% 100%;
                    transform: translateX(-120%);
                    animation: fr-card-atlas-shimmer-sweep 1200ms ease-in-out infinite;
                }
                .fr-card.fr-card--face.atlas-shimmer {
                    position: relative;
                    overflow: hidden;
                }
                @keyframes fr-card-atlas-shimmer-sweep {
                    0% {
                        transform: translateX(-120%);
                    }
                    100% {
                        transform: translateX(120%);
                    }
                }
                .fr-board--minimal-live .fr-card-button--live-center {
                    width: var(--fr-live-center-card-width);
                }
                .fr-board--minimal-live .fr-card-button--live-center .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand .fr-card {
                    border-radius: 9px;
                    border-color: rgba(255, 238, 199, 0.08);
                    box-shadow:
                        0 12px 18px rgba(0, 0, 0, 0.24),
                        0 2px 5px rgba(0, 0, 0, 0.12);
                    transition:
                        box-shadow 140ms ease,
                        border-color 140ms ease,
                        transform 140ms ease;
                }
                .fr-board--minimal-live .fr-card-button--live-center.fr-card-button--actionable .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand.fr-card-button--actionable .fr-card {
                    border-color: rgba(255, 238, 201, 0.3);
                    box-shadow:
                        0 14px 18px rgba(0, 0, 0, 0.26),
                        0 0 0 1px rgba(255, 243, 213, 0.05);
                }
                .fr-board--minimal-live .fr-card-button--live-center.fr-card-button--actionable:hover .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand.fr-card-button--actionable:hover .fr-card {
                    transform: translateY(-8px);
                    border-color: rgba(255, 241, 203, 0.86);
                    box-shadow:
                        0 22px 30px rgba(0, 0, 0, 0.34),
                        0 0 0 2px rgba(255, 224, 145, 0.18);
                }
                .fr-board--minimal-live .fr-card-button--live-center:active .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand:active .fr-card {
                    transform: translateY(-2px) scale(0.99);
                }
                .fr-board--minimal-live .fr-card-button--live-center:focus-visible,
                .fr-board--minimal-live .fr-card-button--live-hand:focus-visible {
                    outline: 2px solid rgba(255, 238, 201, 0.86);
                    outline-offset: 5px;
                    border-radius: 12px;
                }
                .fr-board--minimal-live .fr-card-button--armed .fr-card {
                    border-color: rgba(255, 235, 180, 0.9) !important;
                    box-shadow:
                        0 22px 30px rgba(0, 0, 0, 0.34),
                        0 0 0 3px rgba(255, 215, 128, 0.46) !important;
                    transform: translateY(-10px);
                }
                .fr-board--minimal-live .fr-card--face {
                    box-shadow: inset 0 0 0 0.5px rgba(255, 250, 239, 0.03);
                }
                .fr-board--minimal-live .fr-card-button--motion-hand-draw {
                    animation: fr-live-hand-arrive-from-deck 920ms cubic-bezier(0.18, 0.9, 0.22, 1) both;
                }
                .fr-board--minimal-live .fr-card-button--motion-hand-draw:nth-child(2n) {
                    animation-delay: 32ms;
                }
                .fr-board--minimal-live .fr-card-button--motion-hand-draw:nth-child(3n) {
                    animation-delay: 64ms;
                }
                .fr-board--minimal-live .fr-card-button--motion-hand-take {
                    animation: fr-live-hand-arrive-from-center 640ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .fr-card-button--motion-hand-opening {
                    animation: fr-live-opening-deal 960ms cubic-bezier(0.16, 0.88, 0.24, 1) both;
                }
                .fr-card-button--motion-hand-opening:nth-child(2n) {
                    animation-delay: 42ms;
                }
                .fr-card-button--motion-hand-opening:nth-child(3n) {
                    animation-delay: 84ms;
                }
                .fr-board--minimal-live .fr-card-button--motion-center-receive {
                    animation: fr-live-center-row-receive-discard 1200ms cubic-bezier(0.18, 0.9, 0.22, 1) both;
                }
                .fr-board--minimal-live .fr-card-button--motion-center-exit {
                    animation: fr-live-center-row-exit-to-hand 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .fr-board--minimal-live .fr-card-button--motion-hand-draw,
                .fr-board--minimal-live .fr-card-button--motion-hand-take,
                .fr-board--minimal-live .fr-card-button--motion-hand-opening,
                .fr-board--minimal-live .fr-card-button--motion-center-receive,
                .fr-board--minimal-live .fr-card-button--motion-center-exit {
                    transform-origin: center center;
                    will-change: transform, opacity;
                }
                @keyframes fr-live-opening-deal {
                    0% {
                        opacity: 0;
                        transform: translate(-210px, -300px) scale(0.82) rotate(-4deg);
                    }
                    56% {
                        opacity: 1;
                        transform: translate(-18px, -24px) scale(1.03) rotate(-1deg);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1) rotate(0deg);
                    }
                }
                @keyframes fr-live-hand-arrive-from-deck {
                    0% {
                        opacity: 0;
                        transform: translate(-220px, -260px) scale(0.88) rotate(-3deg);
                    }
                    52% {
                        opacity: 1;
                        transform: translate(-24px, -28px) scale(1.015) rotate(-1deg);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1) rotate(0deg);
                    }
                }
                @keyframes fr-live-hand-arrive-from-center {
                    0% {
                        opacity: 0.18;
                        transform: translate(0, -172px) scale(0.94) rotate(1.4deg);
                    }
                    54% {
                        opacity: 1;
                        transform: translate(0, -12px) scale(1.015) rotate(0deg);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1) rotate(0deg);
                    }
                }
                @keyframes fr-live-center-row-receive-discard {
                    0% {
                        opacity: 0.2;
                        transform: translate(0, 300px) scale(0.9) rotate(-2deg);
                    }
                    58% {
                        opacity: 1;
                        transform: translate(0, 16px) scale(1.03) rotate(0deg);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1) rotate(0deg);
                    }
                }
                @keyframes fr-live-center-row-exit-to-hand {
                    0% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1) rotate(0deg);
                    }
                    58% {
                        opacity: 0.92;
                        transform: translate(0, 150px) scale(0.96) rotate(-1deg);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(0, 230px) scale(0.88) rotate(-2deg);
                    }
                }
                @keyframes fr-endgame-score-card-bounce {
                    0% {
                        transform: translateY(0) scale(1);
                    }
                    38% {
                        transform: translateY(-24px) scale(1.12);
                    }
                    100% {
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes fr-live-turn-chip-breathe {
                    0%, 100% {
                        box-shadow:
                            0 10px 16px rgba(0, 0, 0, 0.12),
                            inset 0 1px 0 rgba(255,255,255,0.04);
                    }
                    50% {
                        box-shadow:
                            0 14px 22px rgba(0, 0, 0, 0.18),
                            0 0 0 1px rgba(255, 223, 142, 0.14),
                            inset 0 1px 0 rgba(255,255,255,0.08);
                    }
                }
                @keyframes fr-live-action-ready-pulse {
                    0%, 100% {
                        box-shadow:
                            0 16px 26px rgba(0, 0, 0, 0.28),
                            0 0 0 1px rgba(255, 232, 176, 0.2),
                            inset 0 1px 0 rgba(255, 244, 214, 0.18),
                            0 0 14px rgba(255, 206, 112, 0.08);
                    }
                    50% {
                        box-shadow:
                            0 18px 30px rgba(0, 0, 0, 0.3),
                            0 0 0 1px rgba(255, 236, 194, 0.24),
                            inset 0 1px 0 rgba(255, 247, 224, 0.22),
                            0 0 26px rgba(255, 214, 128, 0.18);
                    }
                }
                .fr-live-card-state {
                    position: absolute;
                    right: 8px;
                    top: 8px;
                    z-index: 4;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 44px;
                    min-height: 26px;
                    padding: 0 9px;
                    border-radius: 6px;
                    border: 1px solid rgba(255, 239, 190, 0.76);
                    background: rgba(29, 18, 8, 0.88);
                    color: #ffeab8;
                    font-size: 13px;
                    font-weight: 900;
                    line-height: 1;
                    box-shadow:
                        0 8px 14px rgba(0, 0, 0, 0.28),
                        inset 0 1px 0 rgba(255, 255, 255, 0.16);
                    pointer-events: none;
                }
                .fr-board--minimal-live .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: var(--fr-live-hand-row-width);
                    margin: 0 auto;
                    grid-template-columns: repeat(var(--fr-live-hand-slots, 7), minmax(0, 1fr));
                    justify-content: center;
                    gap: 14px;
                    transform: translateY(-30px);
                }
                .fr-board--minimal-live .fr-card-button--live-hand {
                    width: 100%;
                    max-width: none;
                }
                .fr-board--minimal-live .fr-live-hand-zone {
                    margin-top: -36px;
                    padding: 10px 18px 24px;
                }
                .fr-board--minimal-live .fr-live-hand-zone-header {
                    width: var(--fr-live-hand-header-width);
                    margin: 0 auto 18px;
                    align-items: flex-end;
                }
                .fr-board--minimal-live .fr-live-hand-zone-header--solo {
                    justify-content: center;
                }
                .fr-board--minimal-live .fr-live-hand-zone-title {
                    font-size: 13px;
                    color: rgba(245, 230, 196, 0.68);
                }
                .fr-board--minimal-live .fr-live-hand-zone-heading {
                    flex: 1 1 auto;
                }
                .fr-board--minimal-live .fr-live-hand-zone-header--solo .fr-live-hand-zone-heading {
                    flex: 0 1 auto;
                    justify-items: center;
                }
                .fr-board--minimal-live .fr-card-slot--live-hand {
                    border: 1px solid rgba(255, 235, 191, 0.02);
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.006), rgba(0, 0, 0, 0.02)),
                        rgba(7, 12, 10, 0.014);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 245, 214, 0.006),
                        inset 0 8px 16px rgba(255, 255, 255, 0.003);
                }
                .fr-board--minimal-live .fr-live-action-zone {
                    min-width: 186px;
                    justify-content: flex-end;
                    align-self: end;
                }
                .fr-board--minimal-live .fr-live-action-button {
                    width: 176px;
                    height: 52px;
                    padding: 10px 16px;
                    border-radius: 10px;
                    border-color: rgba(247, 205, 122, 0.12);
                    background: rgba(24, 21, 17, 0.76);
                    box-shadow:
                        0 8px 16px rgba(0, 0, 0, 0.1),
                        inset 0 1px 0 rgba(255, 239, 185, 0.04);
                    color: #ffe8ad;
                    opacity: 1;
                }
                .fr-board--minimal-live .fr-live-hand-zone::before {
                    display: block;
                    left: 3.4%;
                    right: 3.4%;
                    top: 20px;
                    bottom: 8px;
                    border-radius: 28px 28px 18px 18px;
                    background:
                        linear-gradient(180deg, rgba(13, 49, 43, 0.008), rgba(5, 19, 17, 0.06) 18%, rgba(4, 16, 14, 0.12)),
                        radial-gradient(ellipse at 50% 20%, rgba(255, 229, 168, 0.014), transparent 50%);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 242, 212, 0.01),
                        inset 0 -14px 24px rgba(0, 0, 0, 0.06);
                }
                .fr-board--minimal-live .fr-live-hand-zone--empty::before {
                    top: 74px;
                    bottom: 10px;
                    left: 4.8%;
                    right: 4.8%;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-center-row::before {
                    left: 18%;
                    right: 18%;
                    top: 74px;
                    bottom: 86px;
                    border-radius: 30px;
                    background:
                        linear-gradient(180deg, rgba(8, 18, 16, 0.02), rgba(3, 11, 10, 0.08)),
                        radial-gradient(ellipse at 50% 30%, rgba(255, 232, 178, 0.032), transparent 64%);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 245, 220, 0.012),
                        inset 0 -20px 30px rgba(0, 0, 0, 0.06);
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-zone-empty--silent {
                    display: block;
                    width: min(780px, 52vw);
                    height: 154px;
                    margin: 74px auto 0;
                    border-radius: 22px;
                    background:
                        linear-gradient(180deg, rgba(10, 20, 16, 0.02), rgba(0, 0, 0, 0.05)),
                        radial-gradient(ellipse at 50% 22%, rgba(255, 236, 197, 0.014), transparent 56%);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.012),
                        inset 0 -18px 26px rgba(0, 0, 0, 0.04);
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone::before {
                    display: block;
                    top: 52px;
                    bottom: 14px;
                    left: 6.8%;
                    right: 6.8%;
                    border-radius: 28px 28px 18px 18px;
                    background:
                        linear-gradient(180deg, rgba(14, 52, 46, 0.02), rgba(6, 21, 18, 0.1) 24%, rgba(4, 16, 14, 0.16)),
                        radial-gradient(ellipse at 50% 8%, rgba(255, 229, 168, 0.018), transparent 52%);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 242, 212, 0.015),
                        inset 0 -18px 28px rgba(0, 0, 0, 0.08);
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-center-row::after {
                    left: 38%;
                    right: 38%;
                    top: 208px;
                    background: linear-gradient(90deg, transparent, rgba(255, 229, 170, 0.1), transparent);
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone {
                    margin-top: -72px;
                    padding-top: 0;
                    padding-bottom: 22px;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone-header {
                    width: var(--fr-live-opening-hand-row-width);
                    margin: 0 auto 28px;
                    justify-content: center;
                    align-items: center;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone-heading {
                    justify-items: center;
                    gap: 10px;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone-title {
                    font-size: 12px;
                    letter-spacing: 0.12em;
                    color: rgba(245, 230, 196, 0.58);
                    text-transform: uppercase;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: var(--fr-live-opening-hand-row-width);
                    gap: 16px;
                    transform: translateY(-78px);
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-hand {
                    opacity: 0.96;
                    border-style: solid;
                    border-color: rgba(255, 236, 190, 0.14);
                    background:
                        linear-gradient(180deg, rgba(255, 246, 222, 0.032), rgba(0, 0, 0, 0.02)),
                        rgba(9, 17, 15, 0.022);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 241, 205, 0.024),
                        0 14px 22px rgba(0, 0, 0, 0.06);
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-hand:nth-child(3),
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-hand:nth-child(4) {
                    opacity: 1;
                    border-color: rgba(255, 229, 170, 0.28);
                    background:
                        linear-gradient(180deg, rgba(255, 244, 214, 0.072), rgba(0, 0, 0, 0.022)),
                        rgba(12, 20, 17, 0.034);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 240, 198, 0.048),
                        0 18px 26px rgba(0, 0, 0, 0.08),
                        0 0 0 1px rgba(255, 232, 180, 0.06);
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-center-placeholder {
                    opacity: 0.1;
                    width: 186px;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-center-placeholder:nth-child(1),
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-center-placeholder:nth-child(5) {
                    opacity: 0.04;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-center-placeholder:nth-child(2),
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-center-placeholder:nth-child(4) {
                    opacity: 0.08;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-card-slot--live-center-placeholder:nth-child(3) {
                    opacity: 0.12;
                }
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone {
                    margin-top: -108px;
                    padding-top: 4px;
                    padding-bottom: 18px;
                }
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone-header {
                    width: var(--fr-live-opening-hand-row-width);
                    margin: 0 auto 28px;
                    justify-content: center;
                    align-items: center;
                }
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone-heading {
                    flex: 0 1 auto;
                    justify-items: center;
                    gap: 10px;
                }
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone::before {
                    top: 12px;
                    left: 6.4%;
                    right: 6.4%;
                }
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: var(--fr-live-hand-row-width);
                    transform: translateY(-24px);
                }
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-center-row::before {
                    top: 28px;
                    bottom: 42px;
                }
                .fr-board--minimal-live .fr-live-action-button::before,
                .fr-board--minimal-live .fr-live-action-button::after {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-action-button-label {
                    max-width: 140px;
                    font-size: 16px;
                    line-height: 1.05;
                }
                .fr-board--minimal-live .fr-live-action-button--enabled {
                    background: linear-gradient(180deg, rgba(124, 83, 39, 0.94), rgba(70, 42, 18, 0.94));
                    box-shadow:
                        0 12px 20px rgba(0, 0, 0, 0.16),
                        inset 0 1px 0 rgba(255, 239, 185, 0.1);
                }
                .fr-board--minimal-live .fr-live-action-button--enabled:hover {
                    transform: translateY(-2px);
                    box-shadow:
                        0 14px 22px rgba(0, 0, 0, 0.2),
                        inset 0 1px 0 rgba(255, 239, 185, 0.1);
                }
                .fr-board--minimal-live .fr-live-action-button--enabled:active {
                    transform: translateY(1px);
                    box-shadow:
                        0 8px 14px rgba(0, 0, 0, 0.28),
                        inset 0 2px 5px rgba(0, 0, 0, 0.22);
                }
                .fr-board--minimal-live .fr-live-center-row::before,
                .fr-board--minimal-live .fr-live-center-row::after,
                .fr-board--minimal-live .fr-live-hand-zone::before,
                .fr-board--minimal-live .fr-zone-empty--silent,
                .fr-board--minimal-live .fr-live-table--opening .fr-live-center-row::before,
                .fr-board--minimal-live .fr-live-table--opening .fr-live-center-row::after,
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone::before,
                .fr-board--minimal-live .fr-live-table--opening .fr-zone-empty--silent {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-center-row {
                    padding-top: 54px;
                }
                .fr-board--minimal-live .fr-live-hand-zone {
                    margin-top: 0;
                    padding: 0 18px 18px;
                }
                .fr-board--minimal-live .fr-live-hand-zone .fr-card-row--live-hand-zone,
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: min(1320px, calc(100vw - 520px));
                    margin: 0 auto;
                    transform: translateY(0);
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: min(1520px, calc(100vw - 260px));
                    margin: 0 auto;
                    transform: translateY(0);
                }
                .fr-board--minimal-live .fr-live-hand-zone-header,
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone-header,
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone-header {
                    position: absolute;
                    left: 16px;
                    right: 16px;
                    bottom: 8px;
                    width: auto;
                    margin: 0;
                    justify-content: center;
                    align-items: center;
                    pointer-events: none;
                }
                .fr-board--minimal-live .fr-live-hand-zone-heading,
                .fr-board--minimal-live .fr-live-hand-zone-header--solo .fr-live-hand-zone-heading,
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone-heading,
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone-heading {
                    flex: 0 1 auto;
                    width: 100%;
                    justify-items: center;
                    gap: 0;
                }
                .fr-board--minimal-live .fr-live-hand-zone-title,
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone-title {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-action-zone {
                    position: absolute;
                    right: clamp(44px, 4vw, 72px);
                    bottom: 276px;
                    width: auto;
                    min-width: 0;
                    justify-content: flex-end;
                    align-self: auto;
                    pointer-events: auto;
                }
                .fr-board--minimal-live .fr-live-action-button {
                    width: 178px;
                    height: 66px;
                }
                /* 当前 fr-merge-pass2 桌面版：去掉底部说明横幅，保留轻量顶栏与右侧独立主动作。 */
                .fr-board--minimal-live .fr-live-table {
                    grid-template-rows: 132px minmax(0, 1fr) auto;
                    gap: 0;
                    height: 100%;
                }
                .fr-board--minimal-live .fr-live-table--opening {
                    grid-template-rows: 132px minmax(0, 1fr) 0;
                }
                .fr-board--minimal-live .fr-live-table--early-draw {
                    grid-template-rows: 132px minmax(0, 1fr) auto;
                }
                .fr-board--minimal-live .fr-live-topbar {
                    grid-template-columns:
                        calc(118px * var(--fr-live-desktop-ui-scale))
                        minmax(0, 1fr)
                        calc(132px * var(--fr-live-desktop-ui-scale));
                    z-index: 5;
                    min-height: calc(128px * var(--fr-live-desktop-ui-scale));
                    gap: calc(16px * var(--fr-live-desktop-ui-scale));
                    padding: 0 calc(24px * var(--fr-live-desktop-ui-scale));
                    align-items: start;
                }
                .fr-board--minimal-live .fr-live-topbar--gameover {
                    grid-template-columns:
                        calc(118px * var(--fr-live-desktop-ui-scale))
                        minmax(0, 1fr)
                        calc(248px * var(--fr-live-desktop-ui-scale));
                }
                .fr-board--minimal-live {
                    width: 100vw;
                    height: 100vh;
                    padding: 12px 16px 6px;
                    border-radius: 0;
                    background:
                        radial-gradient(ellipse at 50% 12%, rgba(87, 143, 118, 0.08), transparent 28%),
                        linear-gradient(180deg, #15463c, #0e332c 58%, #0a2622);
                    box-shadow: none;
                }
                .fr-board--minimal-live::before {
                    inset: 0;
                    border-radius: 0;
                    background:
                        radial-gradient(ellipse at 50% 18%, rgba(116, 172, 143, 0.05), transparent 36%),
                        linear-gradient(180deg, rgba(24, 82, 69, 0.18), rgba(8, 29, 25, 0.04));
                    box-shadow: none;
                }
                .fr-board--minimal-live::after {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-status-strip {
                    display: flex;
                    gap: 14px;
                    margin-top: 12px;
                }
                .fr-board--minimal-live .fr-live-status-strip::before {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-chip {
                    min-height: 28px;
                    padding: 0 4px;
                    border-radius: 0;
                    border-color: transparent;
                    background: transparent;
                    box-shadow: none;
                    color: rgba(246, 226, 185, 0.72);
                    font-size: 13px;
                    font-weight: 800;
                    text-shadow: none;
                }
                .fr-board--minimal-live .fr-live-chip--turn {
                    min-width: calc(168px * var(--fr-live-desktop-ui-scale));
                    min-height: calc(54px * var(--fr-live-desktop-ui-scale));
                    padding: 0 calc(18px * var(--fr-live-desktop-ui-scale));
                    border: 0;
                    background: transparent;
                    color: #ffe8aa;
                    font-size: calc(34px * var(--fr-live-desktop-ui-scale));
                    font-weight: 900;
                    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.34);
                }
                .fr-board--minimal-live .fr-live-chip--turn-active {
                    min-width: calc(184px * var(--fr-live-desktop-ui-scale));
                    animation: none;
                    box-shadow: none;
                }
                .fr-board--minimal-live .fr-live-chip--round {
                    min-height: 28px;
                    padding: 0 4px;
                    font-size: 12px;
                    color: rgba(245, 226, 190, 0.68);
                    background: transparent;
                }
                .fr-board--minimal-live .fr-live-chip--progress {
                    min-width: calc(74px * var(--fr-live-desktop-ui-scale));
                    font-size: calc(21px * var(--fr-live-desktop-ui-scale));
                    background: transparent;
                    color: #ffde9e;
                }
                .fr-board--minimal-live .fr-live-chip--cue {
                    min-height: 30px;
                    padding: 0 4px;
                    font-size: 14px;
                    background: transparent;
                    color: rgba(232, 255, 235, 0.88);
                }
                .fr-board--minimal-live .fr-live-deck {
                    gap: 0;
                    padding-top: 8px;
                }
                .fr-board--minimal-live .fr-live-deck::before,
                .fr-board--minimal-live .fr-live-deck::after {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-deck-stack {
                    width: calc(96px * var(--fr-live-desktop-ui-scale));
                    height: calc(126px * var(--fr-live-desktop-ui-scale));
                    border-radius: 12px;
                    filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.3));
                }
                .fr-board--minimal-live .fr-live-deck-stack .fr-stack-card {
                    border-radius: 12px;
                }
                .fr-board--minimal-live .fr-live-deck-count {
                    right: 6px;
                    bottom: 7px;
                    min-width: 34px;
                    height: 26px;
                    padding: 0 8px;
                    font-size: 19px;
                    border: none;
                    background: rgba(10, 14, 11, 0.74);
                    box-shadow: none;
                }
                .fr-board--minimal-live .fr-live-score-strip {
                    width: calc(132px * var(--fr-live-desktop-ui-scale));
                }
                .fr-board--minimal-live .fr-live-score-strip--gameover {
                    width: calc(248px * var(--fr-live-desktop-ui-scale));
                    gap: 6px;
                }
                .fr-board--minimal-live .fr-live-score-band {
                    display: block;
                    height: 42px;
                    padding: 0;
                    border-radius: 0;
                    border: none;
                    background: transparent;
                    box-shadow: none;
                }
                .fr-board--minimal-live .fr-live-score-band::before {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-score-band-kicker {
                    color: rgba(246, 223, 180, 0.4);
                    text-align: right;
                }
                .fr-board--minimal-live .fr-live-score-band-main {
                    justify-content: flex-end;
                    margin-top: 2px;
                }
                .fr-board--minimal-live .fr-live-score-band-total {
                    font-size: calc(24px * var(--fr-live-desktop-ui-scale));
                    color: rgba(248, 223, 159, 0.86);
                    font-weight: 800;
                }
                .fr-board--minimal-live .fr-live-score-band--gameover {
                    height: auto;
                    padding: 0 0 6px;
                }
                .fr-board--minimal-live .fr-live-score-band--gameover .fr-live-score-band-kicker {
                    color: rgba(246, 223, 180, 0.44);
                }
                .fr-board--minimal-live .fr-live-score-band--gameover .fr-live-score-band-main {
                    justify-content: flex-end;
                    gap: 8px;
                }
                .fr-board--minimal-live .fr-live-score-band--gameover .fr-live-score-band-main span {
                    font-size: 13px;
                }
                .fr-board--minimal-live .fr-live-score-band--gameover .fr-live-score-band-total {
                    font-size: calc(30px * var(--fr-live-desktop-ui-scale));
                }
                .fr-board--minimal-live .fr-live-score-strip--gameover .fr-live-endgame-rail-title {
                    text-align: right;
                }
                .fr-board--minimal-live .fr-live-score-strip--gameover .fr-live-endgame-rank-button {
                    padding: 8px 0;
                }
                .fr-board--minimal-live .fr-live-hand-zone {
                    margin-top: 0;
                    align-self: end;
                    padding: 0 4px max(2px, env(safe-area-inset-bottom, 0px));
                }
                .fr-board--minimal-live .fr-live-hand-zone .fr-card-row--live-hand-zone,
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    --fr-live-hand-gap: clamp(8px, calc(12px * var(--fr-live-desktop-ui-scale)), 12px);
                    width: var(--fr-live-hand-row-width);
                    margin: 0 auto;
                    transform: translateY(0);
                    align-items: end;
                    gap: var(--fr-live-hand-gap);
                }
                .fr-board--minimal-live .fr-card-button--live-hand {
                    width: 100%;
                    max-width: calc(176px * var(--fr-live-desktop-ui-scale));
                    justify-self: center;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone {
                    padding: 0;
                }
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-hand-zone-header,
                .fr-board--minimal-live .fr-live-table--opening .fr-live-hand-zone-header,
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone-header {
                    position: static;
                    width: 0;
                    height: 0;
                    margin: 0;
                    overflow: visible;
                    pointer-events: none;
                }
                .fr-board--minimal-live .fr-live-hand-zone-heading,
                .fr-board--minimal-live .fr-live-hand-zone-title {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-center-row {
                    padding-top: 18px;
                    padding-bottom: 14px;
                }
                .fr-board--minimal-live .fr-live-action-zone {
                    position: absolute;
                    right: var(--fr-live-action-right-offset);
                    bottom: var(--fr-live-action-bottom-offset);
                    top: auto;
                    transform: none;
                    z-index: 4;
                    width: auto;
                    height: auto;
                    min-height: 0;
                    display: flex;
                    justify-content: flex-end;
                    pointer-events: auto;
                }
                .fr-board--minimal-live .fr-live-action-button {
                    width: calc(224px * var(--fr-live-desktop-ui-scale));
                    min-height: calc(62px * var(--fr-live-desktop-ui-scale));
                    height: auto;
                    padding: calc(12px * var(--fr-live-desktop-ui-scale)) calc(20px * var(--fr-live-desktop-ui-scale));
                    border-radius: 14px;
                    border: none;
                    background: linear-gradient(180deg, rgba(168, 114, 50, 0.98), rgba(110, 68, 26, 0.98));
                    box-shadow:
                        0 16px 28px rgba(0, 0, 0, 0.26),
                        0 0 0 1px rgba(255, 232, 176, 0.16),
                        inset 0 1px 0 rgba(255, 239, 185, 0.16);
                    color: #fff0c6;
                    opacity: 1;
                    pointer-events: auto;
                }
                .fr-board--minimal-live .fr-live-action-button[data-action-mode="take-discard"] {
                    background: linear-gradient(180deg, rgba(104, 93, 70, 0.96), rgba(61, 54, 43, 0.98));
                    color: rgba(255, 240, 204, 0.94);
                }
                .fr-board--minimal-live .fr-live-action-button[data-action-mode="discard"].fr-live-action-button--enabled:not(:disabled) {
                    background: linear-gradient(180deg, rgba(190, 121, 45, 0.98), rgba(128, 74, 24, 0.98));
                    box-shadow:
                        0 18px 30px rgba(0, 0, 0, 0.3),
                        0 0 0 1px rgba(255, 236, 194, 0.18),
                        inset 0 1px 0 rgba(255, 244, 214, 0.18),
                        0 0 28px rgba(255, 204, 108, 0.16);
                    animation: fr-live-action-ready-pulse 1400ms ease-in-out infinite;
                }
                .fr-board--minimal-live .fr-live-action-button:disabled {
                    background: linear-gradient(180deg, rgba(95, 94, 88, 0.9), rgba(58, 58, 55, 0.92));
                    box-shadow:
                        0 10px 20px rgba(0, 0, 0, 0.18),
                        0 0 0 1px rgba(219, 213, 199, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.08);
                    color: rgba(245, 238, 220, 0.72);
                    cursor: not-allowed;
                }
                .fr-board--minimal-live .fr-live-action-button-label {
                    max-width: calc(168px * var(--fr-live-desktop-ui-scale));
                    font-size: calc(20px * var(--fr-live-desktop-ui-scale));
                    line-height: 1.08;
                }
                .fr-live-status-strip .fr-live-action-zone {
                    position: relative;
                    left: auto;
                    right: auto;
                    top: auto;
                    bottom: auto;
                    transform: none;
                    z-index: 1;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: auto;
                    min-width: 0;
                    height: auto;
                    min-height: 0;
                    pointer-events: auto;
                }
                .fr-live-status-strip .fr-live-action-button {
                    width: auto;
                    min-width: 112px;
                    height: 38px;
                    min-height: 38px;
                    padding: 0 16px;
                    border-radius: 11px;
                    border: 1px solid rgba(235, 190, 96, 0.28);
                    background: linear-gradient(180deg, rgba(50, 37, 25, 0.94), rgba(17, 16, 14, 0.96));
                    box-shadow:
                        0 10px 16px rgba(0, 0, 0, 0.12),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
                    color: rgba(255, 230, 173, 0.8);
                    cursor: default;
                }
                .fr-live-status-strip .fr-live-action-button::before,
                .fr-live-status-strip .fr-live-action-button::after {
                    display: none;
                }
                .fr-live-status-strip .fr-live-action-button-label {
                    max-width: none;
                    font-size: inherit;
                    font-weight: inherit;
                    line-height: 1;
                    white-space: nowrap;
                    word-break: normal;
                }
                .fr-live-status-strip .fr-live-action-button--enabled {
                    background: linear-gradient(180deg, rgba(130, 85, 38, 0.96), rgba(73, 43, 18, 0.98));
                    box-shadow:
                        0 12px 18px rgba(0, 0, 0, 0.18),
                        inset 0 1px 0 rgba(255, 245, 214, 0.12);
                    color: #ffe9b1;
                    cursor: pointer;
                }
                .fr-live-status-strip .fr-live-action-button--enabled:hover {
                    transform: translateY(-1px);
                    box-shadow:
                        0 14px 20px rgba(0, 0, 0, 0.22),
                        inset 0 1px 0 rgba(255, 245, 214, 0.16);
                }
                .fr-live-status-strip .fr-live-action-button--enabled:active {
                    transform: translateY(1px);
                }
                @media (prefers-reduced-motion: reduce) {
                    .fr-board--minimal-live .fr-card-button--live-center .fr-card,
                    .fr-board--minimal-live .fr-card-button--live-hand .fr-card,
                    .fr-board--minimal-live .fr-card-button--motion-hand-draw,
                    .fr-board--minimal-live .fr-card-button--motion-hand-take,
                    .fr-board--minimal-live .fr-card-button--motion-hand-opening,
                    .fr-board--minimal-live .fr-card-button--motion-center-receive,
                    .fr-board--minimal-live .fr-card-button--motion-center-exit,
                    .fr-board--minimal-live .fr-live-action-button,
                    .fr-live-chip--turn-active,
                    .fr-board--minimal-live .fr-live-deck-stack {
                        transition: none;
                        animation: none;
                    }
                    .fr-board--minimal-live .fr-card-button--live-center.fr-card-button--actionable:hover .fr-card,
                    .fr-board--minimal-live .fr-card-button--live-hand.fr-card-button--actionable:hover .fr-card,
                    .fr-board--minimal-live .fr-card-button--armed .fr-card,
                    .fr-board--minimal-live .fr-card-button--motion-hand-draw,
                    .fr-board--minimal-live .fr-card-button--motion-hand-take,
                    .fr-board--minimal-live .fr-card-button--motion-hand-opening,
                    .fr-board--minimal-live .fr-card-button--motion-center-receive,
                    .fr-board--minimal-live .fr-card-button--motion-center-exit,
                    .fr-board--minimal-live .fr-live-action-button--enabled:hover,
                    .fr-board--minimal-live .fr-live-action-button--enabled:active {
                        transform: none;
                    }
                }
                @media (pointer: coarse) {
                    .fr-card-magnify-button {
                        width: 46px;
                        height: 46px;
                        top: 8px;
                        right: 8px;
                        transform: none;
                    }
                }
                .fr-panel {
                    overflow: hidden;
                    border-radius: 12px;
                    border: 0;
                    background: rgba(28, 39, 33, 0.78);
                    box-shadow: none;
                }
                .fr-panel-header {
                    padding: 10px 12px 0;
                    font-size: 11px;
                    letter-spacing: 0.04em;
                    text-transform: none;
                    color: rgba(242, 234, 215, 0.78);
                    background: none;
                }
                .fr-panel-body {
                    padding: 12px;
                }
                .fr-panel--deck-corner .fr-panel-body {
                    padding: 10px;
                }
                .fr-panel--deck-corner .fr-stack--deck {
                    aspect-ratio: auto;
                    min-height: 112px;
                }
                .fr-stack {
                    position: relative;
                    overflow: hidden;
                    aspect-ratio: 0.72;
                    border-radius: 12px;
                    border: 0;
                    box-shadow: none;
                }
                .fr-stack--deck {
                    background: rgba(18, 24, 21, 0.78);
                }
                .fr-stack-card {
                    position: absolute;
                    inset: 0;
                    border-radius: 10px;
                    border: 0;
                    box-shadow: none;
                }
                .fr-stack-card--under {
                    transform: translate(18px, -12px) scale(0.95);
                    opacity: 0.36;
                }
                .fr-stack-card--mid {
                    transform: translate(9px, -6px) scale(0.975);
                    opacity: 0.62;
                }
                .fr-stack-card--top {
                    opacity: 0.94;
                }
                .fr-count {
                    color: #f2ead7;
                    font-weight: 700;
                }
                .fr-score-row {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 12px;
                    align-items: center;
                    padding: 9px 10px;
                    border-radius: 10px;
                    background: rgba(13, 19, 16, 0.2);
                    border: 0;
                }
                .fr-score-row--dense {
                    gap: 10px;
                    padding: 8px 10px;
                }
                .fr-score-row--active {
                    background: rgba(255, 255, 255, 0.05);
                }
                .fr-score-row-main {
                    min-width: 0;
                    display: grid;
                    gap: 4px;
                }
                .fr-score-row-name {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 6px;
                    min-width: 0;
                    color: #f2ead7;
                    font-size: 13px;
                    font-weight: 700;
                }
                .fr-score-row-name--dense {
                    gap: 4px;
                    font-size: 12px;
                }
                .fr-score-row-name span:first-child {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .fr-score-row-meta {
                    color: rgba(242, 234, 215, 0.68);
                    font-size: 12px;
                }
                .fr-score-row-meta--dense {
                    font-size: 11px;
                }
                .fr-score-row-total {
                    text-align: right;
                    color: #f2ead7;
                }
                .fr-score-row-total--dense {
                    min-width: 56px;
                }
                .fr-score-row-total strong {
                    display: block;
                    font-size: 24px;
                    line-height: 1;
                }
                .fr-score-row-total--dense strong {
                    font-size: 20px;
                }
                .fr-score-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 20px;
                    padding: 0 8px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: rgba(242, 234, 215, 0.84);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                }
                .fr-score-badge--rank-review {
                    min-height: 16px;
                    padding: 0 6px;
                    background: rgba(255, 255, 255, 0.04);
                    border-color: rgba(255, 255, 255, 0.04);
                    color: rgba(242, 234, 215, 0.62);
                    font-size: 10px;
                    letter-spacing: 0;
                }
                .fr-live-score-strip--gameover .fr-score-badge--rank-review {
                    background: transparent;
                    border-color: transparent;
                    color: rgba(242, 234, 215, 0.54);
                    padding: 0;
                }
                .fr-score-list {
                    display: grid;
                    gap: 8px;
                    font-size: 13px;
                    color: rgba(242, 234, 215, 0.78);
                }
                .fr-score-list--dense {
                    grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
                    gap: 6px;
                    font-size: 12px;
                }
                .fr-score-list span {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                }
                .fr-score-list--dense span {
                    display: grid;
                    gap: 4px;
                    justify-content: initial;
                    padding: 8px 10px;
                    border-radius: 10px;
                    background: rgba(13, 19, 16, 0.22);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .fr-score-list--dense em {
                    font-style: normal;
                    font-size: 11px;
                    color: rgba(242, 234, 215, 0.64);
                }
                .fr-card-row {
                    display: grid;
                    grid-template-columns: repeat(7, minmax(0, 1fr));
                    gap: 12px;
                    min-width: 0;
                }
                .fr-card-row--live-hand-zone {
                    grid-template-columns: repeat(7, minmax(96px, 132px));
                    justify-content: center;
                    align-items: end;
                    gap: 14px;
                }
                .fr-discard-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(96px, 132px));
                    gap: 12px;
                    justify-content: start;
                }
                .fr-discard-row--table-center {
                    grid-template-columns: repeat(5, minmax(96px, 132px));
                    justify-content: center;
                    align-content: center;
                }
                .fr-discard-row--empty {
                    min-height: 180px;
                    align-content: center;
                }
                .fr-card-button {
                    min-width: 0;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    text-align: left;
                    cursor: pointer;
                }
                .fr-card-button--selected .fr-card {
                    border-color: rgba(255, 255, 255, 0.9);
                    box-shadow:
                        0 8px 16px rgba(0, 0, 0, 0.28),
                        0 0 0 2px rgba(255, 255, 255, 0.16);
                }
                .fr-card-button--actionable .fr-card {
                    transform: translateY(-2px);
                    border-color: rgba(255, 255, 255, 0.72);
                    box-shadow:
                        0 10px 18px rgba(0, 0, 0, 0.3),
                        0 0 0 1px rgba(255, 255, 255, 0.12);
                }
                .fr-card-magnify-button {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    z-index: 6;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    width: 44px;
                    height: 44px;
                    border: 1px solid rgba(248, 225, 172, 0.36);
                    border-radius: 999px;
                    background: rgba(18, 14, 10, 0.74);
                    color: rgba(255, 244, 214, 0.96);
                    box-shadow: 0 14px 24px rgba(0, 0, 0, 0.24);
                    opacity: 0;
                    transform: translateY(-2px);
                    transition: opacity 160ms ease, transform 160ms ease, background-color 160ms ease, border-color 160ms ease;
                }
                .fr-card-magnify-icon {
                    width: 18px;
                    height: 18px;
                }
                .fr-card-button:hover .fr-card-magnify-button {
                    display: inline-flex;
                    opacity: 1;
                    transform: translateY(0);
                }
                .fr-card-magnify-button:hover {
                    display: inline-flex;
                    background: rgba(171, 116, 49, 0.92);
                    border-color: rgba(255, 234, 190, 0.72);
                }
                .fr-card-magnify-button:focus-visible {
                    display: inline-flex;
                    opacity: 1;
                    outline: 2px solid rgba(255, 243, 211, 0.98);
                    outline-offset: 2px;
                    transform: translateY(0);
                }
                .fr-card-button--score-settling {
                    z-index: 3;
                }
                .fr-card-button--score-settling .fr-card {
                    animation: fr-endgame-score-card-bounce 100ms cubic-bezier(0.2, 0.82, 0.24, 1) both;
                    transform-origin: center center;
                    border-color: rgba(255, 236, 190, 0.94);
                    box-shadow:
                        0 18px 34px rgba(0, 0, 0, 0.36),
                        0 0 0 2px rgba(255, 229, 158, 0.26),
                        0 0 28px rgba(255, 221, 132, 0.24);
                }
                .fr-card-button:disabled {
                    cursor: default;
                }
                .fr-endgame-card-delta {
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: -48px;
                    z-index: 5;
                    display: flex;
                    justify-content: center;
                    pointer-events: none;
                }
                .fr-endgame-card-delta--static {
                    top: -36px;
                }
                .fr-endgame-card-delta-text {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 38px;
                    font-weight: 900;
                    line-height: 0.92;
                    letter-spacing: 0;
                }
                .fr-card {
                    position: relative;
                    display: block;
                    width: 100%;
                    overflow: hidden;
                    aspect-ratio: 0.72;
                    border-radius: 14px;
                    border: 0;
                    background: linear-gradient(180deg, #ece1c7 0%, #cdb68a 100%);
                    color: #23170f;
                    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.28);
                }
                .fr-card--face {
                    background-color: #1b130f;
                }
                .fr-card-slot {
                    aspect-ratio: 0.72;
                    border-radius: 14px;
                    border: 1px dashed rgba(255, 255, 255, 0.16);
                    background: rgba(13, 19, 16, 0.18);
                    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
                }
                .fr-zone-empty {
                    display: grid;
                    place-items: center;
                    padding: 16px;
                    min-height: 96px;
                    border-radius: 10px;
                    border: 1px dashed rgba(255, 255, 255, 0.12);
                    background: rgba(13, 19, 16, 0.18);
                    color: rgba(242, 234, 215, 0.7);
                    text-align: center;
                    font-size: 12px;
                    line-height: 1.4;
                }
                .fr-card-row-wrap {
                    display: grid;
                    gap: 12px;
                }
                .fr-card-row-note {
                    padding: 8px 10px;
                    border-radius: 10px;
                    border: 1px dashed rgba(255, 255, 255, 0.12);
                    background: rgba(13, 19, 16, 0.18);
                    color: rgba(242, 234, 215, 0.7);
                    font-size: 12px;
                    line-height: 1.4;
                    text-align: center;
                }
                .fr-card-row-note--actionable {
                    border-style: solid;
                    border-color: rgba(243, 201, 116, 0.34);
                    background: rgba(44, 28, 13, 0.42);
                    color: rgba(255, 236, 190, 0.9);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.08),
                        0 10px 18px rgba(0, 0, 0, 0.18);
                }
                .fr-card-sheen {
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(145deg, rgba(255,255,255,0.18), transparent 28%),
                        linear-gradient(180deg, rgba(8, 4, 2, 0), rgba(8, 4, 2, 0.12));
                    pointer-events: none;
                }
                .fr-card-suit {
                    height: 22%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: 700;
                    color: #fbf7ef;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                }
                .fr-suit-land { background: linear-gradient(180deg, #4d7a48 0%, #395f36 100%); }
                .fr-suit-army { background: linear-gradient(180deg, #7d4032 0%, #5a2c22 100%); }
                .fr-suit-artifact { background: linear-gradient(180deg, #6f5d3e 0%, #51422b 100%); }
                .fr-suit-flame { background: linear-gradient(180deg, #9d4a27 0%, #74341c 100%); }
                .fr-suit-flood { background: linear-gradient(180deg, #2f6384 0%, #21465e 100%); }
                .fr-suit-leader { background: linear-gradient(180deg, #7b516d 0%, #57394e 100%); }
                .fr-suit-weapon { background: linear-gradient(180deg, #6f6b73 0%, #4b4850 100%); }
                .fr-suit-wild { background: linear-gradient(180deg, #795a8c 0%, #5f436f 100%); }
                .fr-suit-weather { background: linear-gradient(180deg, #7b7f90 0%, #555969 100%); }
                .fr-suit-beast { background: linear-gradient(180deg, #846330 0%, #614a22 100%); }
                .fr-suit-wizard { background: linear-gradient(180deg, #3d5e90 0%, #2d4467 100%); }
                .fr-suit-building { background: linear-gradient(180deg, #8a6a45 0%, #654b31 100%); }
                .fr-suit-outsider { background: linear-gradient(180deg, #5d4d7f 0%, #41345d 100%); }
                .fr-suit-undead { background: linear-gradient(180deg, #4b705e 0%, #355145 100%); }
                .fr-card-body {
                    height: 78%;
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    gap: 10px;
                    padding: 12px;
                }
                .fr-card-name {
                    font-size: 15px;
                    font-weight: 800;
                }
                .fr-card-text {
                    font-size: 12px;
                    line-height: 1.45;
                    color: #473224;
                }
                .fr-card-score {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: 12px;
                    color: #5a4230;
                }
                .fr-card-score strong {
                    font-size: 20px;
                    color: #2d1b12;
                }
                .fr-focus-panel {
                    display: grid;
                    gap: 14px;
                }
                .fr-focus-spotlight {
                    display: grid;
                    grid-template-columns: minmax(0, 120px) minmax(0, 1fr);
                    gap: 16px;
                    align-items: stretch;
                }
                .fr-focus-preview-shell {
                    position: relative;
                    width: 100%;
                    max-width: 120px;
                    justify-self: start;
                }
                .fr-focus-preview-shell--hidden::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: 16px;
                    background: linear-gradient(180deg, rgba(8, 4, 2, 0.12), rgba(8, 4, 2, 0.34));
                    pointer-events: none;
                }
                .fr-card--focus-preview {
                    height: auto;
                }
                .fr-magnify-shell {
                    width: min(430px, 86vw);
                    background: transparent;
                }
                .fr-magnify-card-wrap {
                    width: 100%;
                }
                .fr-magnify-card-wrap .fr-card {
                    border-radius: 22px;
                    box-shadow:
                        0 26px 48px rgba(0, 0, 0, 0.42),
                        0 0 0 1px rgba(255, 235, 191, 0.14);
                }
                .fr-focus-card {
                    display: grid;
                    gap: 8px;
                    padding: 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(13, 19, 16, 0.28);
                    color: #f2ead7;
                    box-shadow: none;
                }
                .fr-focus-kicker {
                    font-size: 12px;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: rgba(242, 234, 215, 0.62);
                }
                .fr-focus-name {
                    font-size: 22px;
                    font-weight: 800;
                    line-height: 1.15;
                    overflow-wrap: anywhere;
                }
                .fr-focus-score {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    color: rgba(242, 234, 215, 0.72);
                    font-size: 13px;
                }
                .fr-focus-score strong {
                    font-size: 30px;
                    color: #f2ead7;
                    flex-shrink: 0;
                }
                .fr-combo-item {
                    padding: 8px 10px;
                    border-radius: 10px;
                    background: rgba(13, 19, 16, 0.22);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                }
                .fr-endgame-summary {
                    display: grid;
                    gap: 10px;
                }
                .fr-endgame-list {
                    display: grid;
                    gap: 8px;
                }
                .fr-endgame-row {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border-radius: 14px;
                    border: 1px solid rgba(228, 193, 128, 0.14);
                    background: rgba(12, 7, 5, 0.24);
                }
                .fr-endgame-rank {
                    color: rgba(242, 234, 215, 0.64);
                    font-size: 12px;
                    font-weight: 700;
                }
                .fr-endgame-name {
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 6px;
                    color: #f2ead7;
                    font-size: 13px;
                    font-weight: 700;
                }
                .fr-endgame-name span {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .fr-endgame-score {
                    color: #f2ead7;
                    font-size: 22px;
                    font-weight: 800;
                    line-height: 1;
                }
                @media (max-width: 1180px) {
                    .fr-focus-spotlight {
                        grid-template-columns: 1fr;
                    }
                    .fr-card--focus-preview {
                        max-width: 196px;
                    }
                }
                @media (max-width: 860px) {
                    .fr-root {
                        padding: 12px;
                    }
                    .fr-board {
                        padding: 14px;
                        border-width: 10px;
                        border-radius: 22px;
                    }
                    .fr-card-row {
                        grid-template-columns: repeat(7, minmax(96px, 1fr));
                        overflow-x: auto;
                        padding-bottom: 4px;
                    }
                    .fr-card--focus-preview {
                        max-width: 172px;
                    }
                    .fr-live-endgame--docked {
                        top: auto;
                        right: auto;
                        width: 100%;
                    }
                    .fr-live-endgame-rail {
                        gap: 8px;
                        padding: 10px;
                        border-radius: 16px;
                    }
                    .fr-live-endgame-rank-button {
                        padding: 9px 10px;
                    }
                    .fr-live-endgame-rank-score {
                        font-size: 20px;
                    }
                }
                @media (max-height: 520px) {
                    .fr-root {
                        padding: 8px;
                    }
                    .fr-board {
                        padding: 12px;
                        border-width: 8px;
                        border-radius: 18px;
                    }
                    .fr-live-table--gameover {
                        grid-template-rows: auto minmax(0, 1fr) 248px;
                    }
                    .fr-panel-header {
                        padding: 8px 12px 6px;
                        font-size: 11px;
                    }
                    .fr-panel-body {
                        padding: 10px;
                    }
                    .fr-card-row-note {
                        font-size: 11px;
                    }
                    .fr-discard-row {
                        gap: 8px;
                        grid-template-columns: repeat(7, minmax(88px, 1fr));
                        overflow-x: auto;
                        padding-right: 72px;
                    }
                    .fr-discard-row--empty {
                        min-height: 96px;
                    }
                    .fr-zone-empty {
                        min-height: 88px;
                        padding: 12px 10px;
                        font-size: 12px;
                    }
                    .fr-live-endgame-rail {
                        gap: 8px;
                        padding: 10px;
                    }
                    .fr-live-endgame-rail-header {
                        gap: 6px;
                    }
                    .fr-live-endgame-rank-button {
                        gap: 8px;
                        padding: 8px 10px;
                    }
                    .fr-live-endgame-rank-copy {
                        gap: 4px;
                    }
                    .fr-live-endgame-rank-score {
                        font-size: 18px;
                    }
                    .fr-live-endgame-reviewed-player {
                        font-size: 11px;
                    }
                    .fr-card-row-wrap {
                        gap: 8px;
                    }
                    .fr-card-row {
                        grid-template-columns: repeat(7, minmax(84px, 1fr));
                        gap: 8px;
                        padding-right: 72px;
                    }
                    .fr-focus-panel,
                    .fr-endgame-summary,
                    .fr-endgame-list {
                        gap: 8px;
                    }
                    .fr-focus-spotlight {
                        gap: 12px;
                    }
                    .fr-focus-card {
                        gap: 8px;
                        padding: 12px;
                    }
                    .fr-card--focus-preview {
                        min-height: 188px;
                        max-width: 146px;
                    }
                    .fr-focus-kicker,
                    .fr-focus-score span,
                    .fr-endgame-rank,
                    .fr-endgame-name {
                        font-size: 11px;
                    }
                    .fr-focus-name {
                        font-size: 20px;
                    }
                    .fr-focus-score strong {
                        font-size: 26px;
                    }
                    .fr-combo-item {
                        padding: 8px 10px;
                        font-size: 12px;
                    }
                }
            `}</style>

            <div className="fr-board fr-board--minimal-live">
                {liveTableSection}
            </div>
            <MagnifyOverlay
                isOpen={magnifiedCard != null}
                onClose={() => setMagnifiedCard(null)}
                containerClassName="fr-magnify-shell"
                overlayClassName="bg-black/46"
                overlayTestId="fantasyrealms-magnify-overlay"
                closeLabel={t('actions.closePreview')}
            >
                <div className="fr-magnify-card-wrap">
                    {magnifiedCard ? <FantasyRealmsCard card={magnifiedCard} t={t} locale={locale} /> : null}
                </div>
            </MagnifyOverlay>
            </div>
        </UndoProvider>
    );
}
