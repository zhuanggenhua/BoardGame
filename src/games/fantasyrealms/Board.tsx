import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react';
import { UndoProvider } from '../../contexts/UndoContext';
import type { GameBoardProps } from '../../engine/transport/protocol';
import {
    EMPTY_FOCUS_INSIGHT,
    FANTASY_REALMS_HAND_CARD_SLOTS,
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

type Props = GameBoardProps<FantasyRealmsCore, FantasyRealmsCommandMap>;

type CardRowSlot = {
    key: string;
    card?: TableCard;
};

type Translator = (key: string, options?: Record<string, unknown>) => string;

type FocusDisplayState = {
    card?: TableCard;
    hiddenByOtherPlayer: boolean;
    source: 'discard' | 'viewer-hand' | 'other-visible-hand' | 'fallback';
};

type VisibleFocusInsight = {
    kicker: string;
    estimatedDelta: number;
};

type PendingLiveSelection = {
    source: 'discard' | 'hand';
    cardId: string;
} | null;

type LiveMotionCueType = 'draw-to-hand' | 'center-to-hand' | 'hand-to-center';

type LiveMotionCue = {
    type: LiveMotionCueType;
    key: number;
    cardIds: string[];
} | null;

type LiveMotionSnapshot = {
    viewerPlayerId: string | null;
    currentPlayer: string;
    stage: FantasyRealmsCore['stage'];
    handIds: string[];
    discardIds: string[];
    drawPileCount: number;
    isGameOver: boolean;
};

type LiveMotionWindow = Window & {
    __FR_LIVE_MOTION_LAST_SNAPSHOT__?: LiveMotionSnapshot;
};

function useAnimatedScoreNumber(target: number, durationMs = 1100): number {
    const [displayScore, setDisplayScore] = React.useState(target);

    React.useEffect(() => {
        if (typeof window === 'undefined') {
            setDisplayScore(target);
            return undefined;
        }
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            setDisplayScore(target);
            return undefined;
        }

        let frameId = 0;
        const startedAt = performance.now();
        setDisplayScore(0);

        const tick = (now: number) => {
            const progress = Math.min(1, (now - startedAt) / durationMs);
            const eased = 1 - ((1 - progress) ** 3);
            setDisplayScore(Math.round(target * eased));
            if (progress < 1) {
                frameId = window.requestAnimationFrame(tick);
            }
        };

        frameId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frameId);
    }, [durationMs, target]);

    return displayScore;
}

function AnimatedScoreNumber({ score, className }: { score: number; className?: string }) {
    const displayScore = useAnimatedScoreNumber(score);

    return (
        <span
            className={className}
            data-score-animation="count-up"
            data-target-score={score}
        >
            {displayScore}
        </span>
    );
}

const LIVE_CENTER_ROW_CARD_WIDTH = 190;
const LIVE_CENTER_ROW_PREFERRED_GAP = 108;
const LIVE_CENTER_ROW_MIN_GAP = 16;
const LIVE_CENTER_ROW_MAX_ROW_WIDTH = 1220;
const LIVE_CENTER_ROW_ROW_TOP = 8;
const LIVE_CENTER_ROW_ROW_OFFSET = 202;

function shouldUseCompactLandscapeTableViewport(width: number, height: number): boolean {
    return width > height && width <= 1180;
}
function shouldUseTightCompactLandscapeViewport(width: number, height: number): boolean {
    return width > height && width <= 900 && height <= 520;
}

function createFallbackCore(): FantasyRealmsCore {
    const emptyScore = evaluateFantasyRealmsScore([], []);
    return {
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

function buildMinimalLiveCenterCardStyles(cardCount: number): React.CSSProperties[] {
    if (cardCount <= 0) return [];

    const topRowCount = cardCount <= 5 ? cardCount : Math.ceil(cardCount / 2);
    const bottomRowCount = cardCount <= 5 ? 0 : Math.floor(cardCount / 2);
    const styles: React.CSSProperties[] = [];

    const pushRow = (rowCount: number, rowIndex: number) => {
        if (rowCount <= 0) return;

        const availableGap = rowCount <= 1
            ? 0
            : Math.floor((LIVE_CENTER_ROW_MAX_ROW_WIDTH - (rowCount * LIVE_CENTER_ROW_CARD_WIDTH)) / (rowCount - 1));
        const gap = rowCount <= 1
            ? 0
            : Math.max(LIVE_CENTER_ROW_MIN_GAP, Math.min(LIVE_CENTER_ROW_PREFERRED_GAP, availableGap));
        const rowWidth = (rowCount * LIVE_CENTER_ROW_CARD_WIDTH) + ((rowCount - 1) * gap);
        const startOffset = -(rowWidth / 2);

        for (let index = 0; index < rowCount; index += 1) {
            const left = Math.round(startOffset + (index * (LIVE_CENTER_ROW_CARD_WIDTH + gap)));
            styles.push({
                left: `calc(50% + ${left}px)`,
                top: `${LIVE_CENTER_ROW_ROW_TOP + (rowIndex * LIVE_CENTER_ROW_ROW_OFFSET)}px`,
            });
        }
    };

    pushRow(topRowCount, 0);
    pushRow(bottomRowCount, 1);
    return styles;
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

function getAddedIds(nextIds: string[], previousIds: string[]): string[] {
    const previousIdSet = new Set(previousIds);
    return nextIds.filter((id) => !previousIdSet.has(id));
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

function renderCard(card: TableCard, t: Translator, locale?: string) {
    const atlasStyle = getFantasyRealmsCardFaceStyle(card.id, locale);
    const displayName = getFantasyRealmsCardDisplayName(card);
    if (!atlasStyle) {
        return renderFallbackCard(card, t, locale);
    }

    return (
        <article
            className="fr-card fr-card--atlas"
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

function resolveFocusDisplayState(
    core: FantasyRealmsCore,
    viewerPlayerId: string | null,
    viewerPlayer: FantasyRealmsPlayerState | undefined,
    isGameOver: boolean,
): FocusDisplayState {
    if (!isGameOver && core.hiddenFocusCard) {
        return { hiddenByOtherPlayer: true, source: 'fallback' };
    }
    const discardCard = core.discardPile.find((card) => card.id === core.focusCardId);
    if (discardCard) {
        return { card: discardCard, hiddenByOtherPlayer: false, source: 'discard' };
    }
    const viewerHandCard = viewerPlayer?.hand.find((card) => card.id === core.focusCardId);
    if (viewerHandCard) {
        return { card: viewerHandCard, hiddenByOtherPlayer: false, source: 'viewer-hand' };
    }
    if (isGameOver) {
        for (const player of Object.values(core.players)) {
            const handCard = player.hand.find((card) => card.id === core.focusCardId);
            if (handCard) {
                return { card: handCard, hiddenByOtherPlayer: false, source: 'other-visible-hand' };
            }
        }
    }
    if (core.focusCardId) {
        for (const player of Object.values(core.players)) {
            if (player.id !== viewerPlayerId && player.hand.some((card) => card.id === core.focusCardId)) {
                return { hiddenByOtherPlayer: true, source: 'fallback' };
            }
        }
    }
    return {
        card: core.discardPile[core.discardPile.length - 1] ?? viewerPlayer?.hand[0],
        hiddenByOtherPlayer: false,
        source: 'fallback',
    };
}

function buildDiscardFocusInsight(
    core: FantasyRealmsCore,
    viewerPlayer: FantasyRealmsPlayerState | undefined,
    focusCard: TableCard,
    t: Translator,
): VisibleFocusInsight {
    if (!viewerPlayer) {
        return {
            kicker: t('focus.dynamic.kickers.discardProbe'),
            estimatedDelta: 0,
        };
    }

    const hand = viewerPlayer?.hand ?? [];
    const currentScore = viewerPlayer?.score ?? evaluateFantasyRealmsScore(hand, core.discardPile).totalScore;
    const nextDiscardWithoutFocus = core.discardPile
        .filter((card) => card.id !== focusCard.id)
        .map((card) => ({ ...card }));
    const canTakeDirectly = isDuelVariant(core) && hand.length < 7;

    if (canTakeDirectly) {
        const nextScore = evaluateFantasyRealmsScore([...hand, { ...focusCard }], nextDiscardWithoutFocus).totalScore;
        const delta = nextScore - currentScore;
        const positive = delta > 0;

        return {
            kicker: positive ? t('focus.dynamic.kickers.discardUpgrade') : t('focus.dynamic.kickers.discardProbe'),
            estimatedDelta: delta,
        };
    }

    const swapCandidates = hand.map((candidate) => {
        const nextHand = hand
            .filter((card) => card.id !== candidate.id)
            .map((card) => ({ ...card }))
            .concat({ ...focusCard });
        const nextDiscard = [...nextDiscardWithoutFocus, { ...candidate }];
        const nextScore = evaluateFantasyRealmsScore(nextHand, nextDiscard).totalScore;
        return {
            candidate,
            nextScore,
            delta: nextScore - currentScore,
        };
    });
    const bestSwap = swapCandidates.reduce<typeof swapCandidates[number] | null>((best, entry) => {
        if (!best) return entry;
        if (entry.nextScore > best.nextScore) return entry;
        return best;
    }, null);

    if (!bestSwap) {
        return {
            kicker: t('focus.dynamic.kickers.discardProbe'),
            estimatedDelta: 0,
        };
    }

    const positive = bestSwap.delta > 0;
    return {
        kicker: positive ? t('focus.dynamic.kickers.discardUpgrade') : t('focus.dynamic.kickers.discardProbe'),
        estimatedDelta: bestSwap.delta,
    };
}

function buildHandFocusInsight(
    core: FantasyRealmsCore,
    viewerPlayer: FantasyRealmsPlayerState | undefined,
    focusCard: TableCard,
    t: Translator,
): VisibleFocusInsight {
    const hand = viewerPlayer?.hand ?? [];
    const currentScore = viewerPlayer?.score ?? evaluateFantasyRealmsScore(hand, core.discardPile).totalScore;
    const nextHand = hand.filter((card) => card.id !== focusCard.id).map((card) => ({ ...card }));
    const nextDiscard = [...core.discardPile.map((card) => ({ ...card })), { ...focusCard }];
    const nextScore = evaluateFantasyRealmsScore(nextHand, nextDiscard).totalScore;
    const delta = nextScore - currentScore;

    if (delta > 0) {
        return {
            kicker: t('focus.dynamic.kickers.handDiscard'),
            estimatedDelta: delta,
        };
    }

    if (delta < 0) {
        return {
            kicker: t('focus.dynamic.kickers.handKeep'),
            estimatedDelta: delta,
        };
    }

    return {
        kicker: t('focus.dynamic.kickers.handNeutral'),
        estimatedDelta: delta,
    };
}

function buildBoardFocusInsight(
    core: FantasyRealmsCore,
    viewerPlayer: FantasyRealmsPlayerState | undefined,
    focusDisplay: FocusDisplayState,
    t: Translator,
): VisibleFocusInsight {
    if (!focusDisplay.card) {
        return {
            kicker: EMPTY_FOCUS_INSIGHT.kicker,
            estimatedDelta: EMPTY_FOCUS_INSIGHT.estimatedDelta,
        };
    }
    if (focusDisplay.source === 'discard') {
        return buildDiscardFocusInsight(core, viewerPlayer, focusDisplay.card, t);
    }
    if (focusDisplay.source === 'viewer-hand') {
        return buildHandFocusInsight(core, viewerPlayer, focusDisplay.card, t);
    }
    return {
        kicker: t('focus.dynamic.kickers.reviewCard'),
        estimatedDelta: 0,
    };
}

function getCurrentPlayerHandCount(core: FantasyRealmsCore): number {
    return core.players[core.currentPlayer]?.hand.length ?? 0;
}

function getDrawDeckLabel(core: FantasyRealmsCore, t: Translator): string {
    if (!isDuelVariant(core)) {
        return t('turn.drawDeck.one');
    }
    return getCurrentPlayerHandCount(core) >= 7 ? t('turn.drawDeck.one') : t('turn.drawDeck.twoThenDiscardOne');
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

export default function FantasyRealmsBoard({ G, dispatch, matchData, playerID, isMultiplayer }: Props) {
    const { t, i18n } = useTranslation('game-fantasyrealms');
    const locale = i18n.language || 'zh-CN';
    const core = React.useMemo(() => (isFantasyRealmsCore(G?.core) ? G.core : createFallbackCore()), [G]);
    const [isCompactLandscapeTableViewport, setIsCompactLandscapeTableViewport] = React.useState(() => (
        typeof window !== 'undefined'
            ? shouldUseCompactLandscapeTableViewport(window.innerWidth, window.innerHeight)
            : false
    ));
    const [isTightCompactLandscapeViewport, setIsTightCompactLandscapeViewport] = React.useState(() => (
        typeof window !== 'undefined'
            ? shouldUseTightCompactLandscapeViewport(window.innerWidth, window.innerHeight)
            : false
    ));
    const [pendingLiveSelection, setPendingLiveSelection] = React.useState<PendingLiveSelection>(null);
    const [liveMotionCue, setLiveMotionCue] = React.useState<LiveMotionCue>(null);
    const [reviewPlayerId, setReviewPlayerId] = React.useState<string | null>(null);
    const liveMotionSnapshotRef = React.useRef<LiveMotionSnapshot | null>(null);
    const liveMotionSequenceRef = React.useRef(0);

    React.useLayoutEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handleResize = () => {
            const nextIsCompactLandscapeTableViewport = shouldUseCompactLandscapeTableViewport(
                window.innerWidth,
                window.innerHeight,
            );
            const nextIsTightCompactLandscapeViewport = shouldUseTightCompactLandscapeViewport(
                window.innerWidth,
                window.innerHeight,
            );
            setIsCompactLandscapeTableViewport((previous) => (
                previous === nextIsCompactLandscapeTableViewport ? previous : nextIsCompactLandscapeTableViewport
            ));
            setIsTightCompactLandscapeViewport((previous) => (
                previous === nextIsTightCompactLandscapeViewport ? previous : nextIsTightCompactLandscapeViewport
            ));
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isSpectatorView = playerID == null;
    const viewerPlayerId = isSpectatorView ? null : playerID;
    const viewerPlayer = viewerPlayerId ? core.players[viewerPlayerId] : undefined;
    const gameOver = G?.sys?.gameover as { winner?: string; draw?: boolean; scores?: Record<string, number>; winners?: string[] } | undefined;
    const isGameOver = Boolean(gameOver);
    const discardCards = React.useMemo(() => [...core.discardPile].reverse(), [core.discardPile]);
    const currentPlayerName = React.useMemo(() => {
        const matchPlayer = matchData.find((player) => String(player.id) === String(core.currentPlayer));
        if (matchPlayer?.name) return matchPlayer.name;
        if (core.players[core.currentPlayer]?.name) return core.players[core.currentPlayer]!.name;
        return t('fallback.currentPlayer');
    }, [core.currentPlayer, core.players, matchData, t]);
    const isMyTurn = !isSpectatorView && viewerPlayerId === core.currentPlayer;
    const canDrawFromDeck = isMyTurn && !isGameOver && core.stage === 'draw' && core.drawPile.length > 0;
    const canTakeDiscard = isMyTurn && !isGameOver && core.stage === 'draw' && core.discardPile.length > 0;
    const canDiscard = isMyTurn && !isGameOver && core.stage === 'discard';
    const discardThreshold = getFantasyRealmsDiscardEndThreshold(core.playerIds.length);
    const pendingDiscardSelectionId = pendingLiveSelection?.source === 'discard' ? pendingLiveSelection.cardId : null;
    const pendingHandSelectionId = pendingLiveSelection?.source === 'hand' ? pendingLiveSelection.cardId : null;
    const selectedDiscardCard = pendingDiscardSelectionId
        ? discardCards.find((card) => card.id === pendingDiscardSelectionId) ?? null
        : null;
    const winnerIds = React.useMemo(() => {
        if (!gameOver) return new Set<string>();
        if (gameOver.winner) return new Set([gameOver.winner]);
        if (Array.isArray(gameOver.winners)) return new Set(gameOver.winners);
        return new Set<string>();
    }, [gameOver]);
    const playerSummaries = React.useMemo(() => core.playerIds.map((id) => ({
        id,
        name: getPlayerDisplayName(id, core, matchData, t),
        handCount: core.players[id]?.hand.length ?? 0,
        score: core.players[id]?.score ?? 0,
        scoreVisible: isGameOver || (!isSpectatorView && id === viewerPlayerId),
        isCurrent: !isGameOver && id === core.currentPlayer,
        isViewer: !isSpectatorView && id === viewerPlayerId,
        isWinner: winnerIds.has(id),
    })), [core, isGameOver, isSpectatorView, matchData, t, viewerPlayerId, winnerIds]);
    const liveScoreOwner = React.useMemo(
        () => playerSummaries.find((player) => player.isViewer)
            ?? playerSummaries.find((player) => player.isCurrent)
            ?? playerSummaries[0]
            ?? null,
        [playerSummaries],
    );
    const liveDeckDrawCount = React.useMemo(
        () => getDeckDrawCount(core),
        [core],
    );
    const finalStandings = React.useMemo(() => {
        if (!isGameOver) return [];
        return core.playerIds
            .map((id) => ({
                id,
                name: getPlayerDisplayName(id, core, matchData, t),
                score: gameOver?.scores?.[id] ?? core.players[id]?.score ?? 0,
                isWinner: winnerIds.has(id),
            }))
            .sort((left, right) => right.score - left.score);
    }, [core, gameOver?.scores, isGameOver, matchData, t, winnerIds]);
    const defaultReviewPlayerId = React.useMemo(() => {
        if (!isGameOver) return null;
        return viewerPlayerId ?? finalStandings[0]?.id ?? core.playerIds[0] ?? null;
    }, [core.playerIds, finalStandings, isGameOver, viewerPlayerId]);
    React.useEffect(() => {
        if (!isGameOver) {
            setReviewPlayerId(null);
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
    const displayedHandCards = React.useMemo(() => displayedPlayer?.hand ?? [], [displayedPlayer?.hand]);
    const selectedHandCard = pendingHandSelectionId
        ? displayedHandCards.find((card) => card.id === pendingHandSelectionId) ?? null
        : null;
    const displayedPlayerName = React.useMemo(() => {
        if (!displayedPlayerId) return null;
        return getPlayerDisplayName(displayedPlayerId, core, matchData, t);
    }, [core, displayedPlayerId, matchData, t]);
    const handSlotCount = Math.max(FANTASY_REALMS_HAND_CARD_SLOTS, displayedHandCards.length);
    const focusDisplay = React.useMemo(
        () => resolveFocusDisplayState(core, displayedPlayerId, displayedPlayer, isGameOver),
        [core, displayedPlayer, displayedPlayerId, isGameOver],
    );
    const visibleFocusCard = focusDisplay.card;
    const focusInsight = React.useMemo(
        () => buildBoardFocusInsight(core, displayedPlayer, focusDisplay, t),
        [core, displayedPlayer, focusDisplay, t],
    );
    const focusKicker = focusInsight.kicker;
    const focusName = focusDisplay.hiddenByOtherPlayer
        ? t('focus.hiddenName')
        : (getFantasyRealmsCardDisplayName(visibleFocusCard) || t('focus.setupPhase'));
    const focusEstimatedDelta = focusDisplay.hiddenByOtherPlayer
        ? t('focus.hiddenDelta')
        : (isGameOver
            ? t('focus.hiddenDelta')
            : (focusInsight.estimatedDelta >= 0 ? `+${focusInsight.estimatedDelta}` : String(focusInsight.estimatedDelta)));
    const deckBackStyle = React.useMemo(() => getFantasyRealmsCardBackStyle(locale), [locale]);
    const focusFaceStyle = React.useMemo(
        () => (visibleFocusCard ? getFantasyRealmsCardFaceStyle(visibleFocusCard.id, locale) : null),
        [locale, visibleFocusCard],
    );
    const focusPreviewUsesBack = focusDisplay.hiddenByOtherPlayer || !visibleFocusCard || !focusFaceStyle;
    const focusPreviewStyle = focusPreviewUsesBack ? deckBackStyle : focusFaceStyle;
    const shouldShowCompactFocusRail = !isGameOver && (Boolean(core.focusCardId) || core.hiddenFocusCard);
    const shouldShowFocusKicker = !isGameOver && !focusDisplay.hiddenByOtherPlayer;
    const isMinimalLiveDesktop = true;
    const handRowOverflowStyle = React.useMemo<React.CSSProperties | undefined>(() => {
        if (handSlotCount <= FANTASY_REALMS_HAND_CARD_SLOTS) {
            return undefined;
        }
        return {
            gridTemplateColumns: isMinimalLiveDesktop
                ? `repeat(${handSlotCount}, minmax(0, 1fr))`
                : `repeat(${handSlotCount}, minmax(88px, 1fr))`,
        };
    }, [handSlotCount, isMinimalLiveDesktop]);
    const isDuelMode = core.playerIds.length === 2;
    const compactTurnStateLabel = React.useMemo(() => {
        if (!isMyTurn) return null;
        if (core.stage === 'discard') return t('turn.compact.discard');
        if (isDuelMode && displayedHandCards.length === 0 && canDrawFromDeck) {
            return t('turn.compact.drawTwo');
        }
        return t('turn.compact.draw');
    }, [canDrawFromDeck, core.stage, displayedHandCards.length, isDuelMode, isMyTurn, t]);
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
    const viewerHandIdsSignature = displayedHandCards.map((card) => card.id).join('|');
    const discardIdsSignature = discardCards.map((card) => card.id).join('|');
    const liveMotionSnapshot = React.useMemo<LiveMotionSnapshot>(() => ({
        viewerPlayerId,
        currentPlayer: core.currentPlayer,
        stage: core.stage,
        handIds: viewerHandIdsSignature ? viewerHandIdsSignature.split('|') : [],
        discardIds: discardIdsSignature ? discardIdsSignature.split('|') : [],
        drawPileCount: core.drawPile.length,
        isGameOver,
    }), [
        core.currentPlayer,
        core.drawPile.length,
        core.stage,
        discardIdsSignature,
        isGameOver,
        viewerHandIdsSignature,
        viewerPlayerId,
    ]);

    React.useEffect(() => {
        const nextSnapshot = liveMotionSnapshot;
        const previousSnapshot = liveMotionSnapshotRef.current
            ?? (typeof window !== 'undefined'
                ? (window as LiveMotionWindow).__FR_LIVE_MOTION_LAST_SNAPSHOT__ ?? null
                : null);
        liveMotionSnapshotRef.current = nextSnapshot;
        if (typeof window !== 'undefined') {
            (window as LiveMotionWindow).__FR_LIVE_MOTION_LAST_SNAPSHOT__ = nextSnapshot;
        }

        if (!previousSnapshot || !isMinimalLiveDesktop || isSpectatorView || isGameOver) {
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

        liveMotionSequenceRef.current += 1;
        const nextKey = liveMotionSequenceRef.current;
        setLiveMotionCue({ type: nextCueType, key: nextKey, cardIds: nextCueCardIds });

        return undefined;
    }, [
        isGameOver,
        isMinimalLiveDesktop,
        isSpectatorView,
        liveMotionSnapshot,
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
        if (!isMinimalLiveDesktop || !isMyTurn) {
            setPendingLiveSelection(null);
            return;
        }

        if (pendingLiveSelection?.source === 'discard') {
            if (!canTakeDiscard || !selectedDiscardCard) {
                setPendingLiveSelection(null);
            }
            return;
        }

        if (pendingLiveSelection?.source === 'hand' && (!canDiscard || !selectedHandCard)) {
            setPendingLiveSelection(null);
        }
    }, [
        canDiscard,
        canTakeDiscard,
        isMinimalLiveDesktop,
        isMyTurn,
        pendingLiveSelection,
        selectedDiscardCard,
        selectedHandCard,
    ]);

    const handleFocusCard = React.useCallback((cardId: string) => {
        dispatch('SET_FOCUS_CARD', { cardId });
    }, [dispatch]);

    const togglePendingLiveSelection = React.useCallback((source: 'discard' | 'hand', cardId: string) => {
        setPendingLiveSelection((previous) => (
            previous?.source === source && previous.cardId === cardId
                ? null
                : { source, cardId }
        ));
    }, []);

    const handleDiscardPileClick = React.useCallback((cardId: string) => {
        if (isMinimalLiveDesktop && canTakeDiscard) {
            handleFocusCard(cardId);
            togglePendingLiveSelection('discard', cardId);
            return;
        }
        if (canTakeDiscard) {
            dispatch('TAKE_FROM_DISCARD', { cardId });
            return;
        }
        handleFocusCard(cardId);
    }, [canTakeDiscard, dispatch, handleFocusCard, isMinimalLiveDesktop, togglePendingLiveSelection]);

    const handleHandCardClick = React.useCallback((cardId: string) => {
        if (isMinimalLiveDesktop && canDiscard) {
            handleFocusCard(cardId);
            togglePendingLiveSelection('hand', cardId);
            return;
        }
        if (canDiscard) {
            dispatch('DISCARD_CARD', { cardId });
            return;
        }
        handleFocusCard(cardId);
    }, [canDiscard, dispatch, handleFocusCard, isMinimalLiveDesktop, togglePendingLiveSelection]);

    const handleLivePrimaryAction = React.useCallback(() => {
        if (canDiscard) {
            if (!selectedHandCard) return;
            dispatch('DISCARD_CARD', { cardId: selectedHandCard.id });
            setPendingLiveSelection(null);
            return;
        }

        if (selectedDiscardCard) {
            dispatch('TAKE_FROM_DISCARD', { cardId: selectedDiscardCard.id });
            setPendingLiveSelection(null);
            return;
        }
        if (canDrawFromDeck) {
            setPendingLiveSelection(null);
            dispatch('DRAW_FROM_DECK', {});
        }
    }, [canDiscard, canDrawFromDeck, dispatch, selectedDiscardCard, selectedHandCard]);

    const livePrimaryActionLabel = React.useMemo(() => {
        if (canDiscard) {
            return selectedHandCard ? t('actions.confirmDiscard') : t('turn.primaryActionShort.discardRequired');
        }
        if (selectedDiscardCard) {
            return t('actions.confirmTake');
        }
        if (canTakeDiscard) {
            return t('actions.selectDiscardRequired');
        }
        if (canDrawFromDeck) {
            return getDrawDeckLabel(core, t);
        }
        return t('actions.confirmTake');
    }, [canDiscard, canDrawFromDeck, canTakeDiscard, core, selectedDiscardCard, selectedHandCard, t]);
    const livePrimaryActionVisibleLabel = React.useMemo(() => {
        if (canDiscard) {
            return selectedHandCard ? t('actions.confirmDiscard') : (compactTurnStateLabel ?? t('turn.primaryActionShort.discardRequired'));
        }
        if (selectedDiscardCard) {
            return t('actions.confirmTake');
        }
        if (canTakeDiscard) {
            return t('actions.selectDiscardRequired');
        }
        if (canDrawFromDeck) {
            return compactTurnStateLabel ?? livePrimaryActionLabel;
        }
        return livePrimaryActionLabel;
    }, [
        canDiscard,
        canDrawFromDeck,
        canTakeDiscard,
        compactTurnStateLabel,
        livePrimaryActionLabel,
        selectedDiscardCard,
        selectedHandCard,
        t,
    ]);
    const livePrimaryActionMode = React.useMemo(() => {
        if (canDiscard) {
            return selectedHandCard ? 'confirm-discard' : 'select-hand';
        }
        if (selectedDiscardCard) {
            return 'confirm-take';
        }
        if (canTakeDiscard) {
            return 'select-discard';
        }
        if (canDrawFromDeck) {
            return 'draw';
        }
        return 'idle';
    }, [canDiscard, canDrawFromDeck, canTakeDiscard, selectedDiscardCard, selectedHandCard]);
    const minimalLiveCenterCardStyles = React.useMemo(
        () => buildMinimalLiveCenterCardStyles(discardCards.length),
        [discardCards.length],
    );
    const minimalLiveCenterPlaceholderStyles = React.useMemo(
        () => buildMinimalLiveCenterCardStyles(5),
        [],
    );
    const minimalLiveHandCardStyles = React.useMemo(
        () => buildMinimalLiveHandCardStyles(displayedHandCards.length, handSlotCount),
        [displayedHandCards.length, handSlotCount],
    );

    const isLivePrimaryActionDisabled = React.useMemo(() => {
        if (canDiscard) return !selectedHandCard;
        if (selectedDiscardCard) return false;
        if (canTakeDiscard) return true;
        if (canDrawFromDeck) return false;
        return false;
    }, [canDiscard, canDrawFromDeck, canTakeDiscard, selectedDiscardCard, selectedHandCard]);
    const shouldShowMinimalLiveAction = isMyTurn
        && !isGameOver
        && (canDrawFromDeck || canTakeDiscard || canDiscard || Boolean(selectedHandCard) || Boolean(selectedDiscardCard));

    const focusPanelSection = (
        <section className="fr-panel">
            <div className="fr-panel-header">{t('focus.panelTitle')}</div>
            <div className="fr-panel-body fr-focus-panel">
                <div className="fr-focus-spotlight">
                    <div className={`fr-focus-preview-shell${focusDisplay.hiddenByOtherPlayer ? ' fr-focus-preview-shell--hidden' : ''}`}>
                        <div
                            className="fr-card fr-card--atlas fr-card--focus-preview"
                            data-testid="fantasyrealms-focus-preview"
                            data-card-renderer={focusPreviewUsesBack ? 'back' : 'atlas'}
                            data-atlas-card-id={visibleFocusCard?.id ?? ''}
                            aria-label={focusName}
                            style={focusPreviewStyle}
                        >
                            <div aria-hidden="true" className="fr-card-sheen" />
                        </div>
                    </div>
                    <article className="fr-focus-card">
                        {shouldShowFocusKicker ? <div className="fr-focus-kicker">{focusKicker}</div> : null}
                        <div className="fr-focus-name">{focusName}</div>
                        <div className="fr-focus-score">
                            <span>{t('focus.estimatedDelta')}</span>
                            <strong>{focusEstimatedDelta}</strong>
                        </div>
                    </article>
                </div>
            </div>
        </section>
    );
    const compactFocusRailSection = shouldShowCompactFocusRail ? (
        <section className="fr-compact-focus-panel" data-testid="fantasyrealms-compact-focus-rail">
            <div className="fr-compact-focus-header">{t('focus.panelTitle')}</div>
            <div className="fr-compact-focus-body">
                <div className={`fr-compact-focus-preview-shell${focusDisplay.hiddenByOtherPlayer ? ' fr-compact-focus-preview-shell--hidden' : ''}`}>
                    <div
                        className="fr-card fr-card--atlas fr-card--focus-preview fr-card--compact-focus-preview"
                        data-testid="fantasyrealms-focus-preview"
                        data-card-renderer={focusPreviewUsesBack ? 'back' : 'atlas'}
                        data-atlas-card-id={visibleFocusCard?.id ?? ''}
                        aria-label={focusName}
                        style={focusPreviewStyle}
                    >
                        <div aria-hidden="true" className="fr-card-sheen" />
                    </div>
                </div>
                <div className="fr-compact-focus-copy">
                    <div className="fr-compact-focus-name">{focusName}</div>
                    <div className="fr-compact-focus-score">{focusEstimatedDelta}</div>
                </div>
            </div>
        </section>
    ) : null;

    const minimalLiveTopbarSection = !isGameOver ? (
        <div className="fr-live-topbar" data-testid="fantasyrealms-live-topbar">
            <div
                className="fr-live-deck"
                data-testid="fantasyrealms-live-deck"
                aria-label={t('deck.remaining')}
            >
                <div className="fr-live-deck-stack">
                    <div className="fr-stack-card fr-stack-card--under" style={deckBackStyle} aria-hidden="true" />
                    <div className="fr-stack-card fr-stack-card--mid" style={deckBackStyle} aria-hidden="true" />
                    <div className="fr-stack-card fr-stack-card--top" style={deckBackStyle} aria-hidden="true" />
                    <strong className="fr-live-deck-count">{core.drawPile.length}</strong>
                </div>
            </div>
            <div className="fr-live-status-strip" data-testid="fantasyrealms-live-status-strip">
                <div
                    className={`fr-live-chip fr-live-chip--turn${isMyTurn ? ' fr-live-chip--turn-active' : ''}`}
                    data-turn-state={isMyTurn ? livePrimaryActionMode : 'waiting'}
                >
                    {isMyTurn ? t('turn.live.selfTurn') : currentPlayerName}
                </div>
                <div className="fr-live-chip fr-live-chip--round">
                    {t('turn.short.round', { turn: core.turn })}
                </div>
                <div className="fr-live-chip fr-live-chip--progress" aria-label={t('progress.panelTitle')}>
                    {discardCards.length}/{discardThreshold}
                </div>
                {compactTurnStateLabel && !shouldShowMinimalLiveAction ? (
                    <div className="fr-live-chip fr-live-chip--cue">
                        {compactTurnStateLabel}
                    </div>
                ) : null}
            </div>
            <div className="fr-live-score-strip" aria-label={t('score.tableTitle')} data-testid="fantasyrealms-live-score-strip">
                <div className="fr-live-score-band" data-testid="fantasyrealms-live-score-band">
                    <div className="fr-live-score-band-kicker">
                        {t('score.panelTitle')}
                    </div>
                    <div className="fr-live-score-band-main">
                        <strong className="fr-live-score-band-total">
                            {liveScoreOwner?.scoreVisible ? liveScoreOwner.score : t('score.hiddenValue')}
                        </strong>
                        {!liveScoreOwner?.scoreVisible ? (
                            <span>
                                {t('score.hiddenLabel')}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    const minimalLiveCenterRowSection = (
        <section
            className={`fr-live-center-row${discardCards.length === 0 ? ' fr-live-center-row--empty' : ''}${liveMotionCue?.type === 'hand-to-center' ? ' fr-live-center-row--motion-receive' : ''}`}
            aria-label={t('zone.discard.title')}
            data-motion={liveMotionCue?.type === 'hand-to-center' ? 'hand-to-center' : 'idle'}
            data-testid="fantasyrealms-live-center-row"
        >
            <div
                className={`fr-discard-row fr-discard-row--live-center${discardCards.length === 0 ? ' fr-discard-row--empty' : ''}${discardCards.length > 0 ? ' fr-discard-row--table-center' : ''}`}
                data-testid="fantasyrealms-discard-row"
            >
                {discardCards.length === 0 ? (
                    <div className="fr-zone-empty fr-zone-empty--silent" data-testid="fantasyrealms-discard-empty" aria-hidden="true">
                        {minimalLiveCenterPlaceholderStyles.map((style, index) => (
                            <div
                                key={`live-center-empty-${index}`}
                                className="fr-card-slot fr-card-slot--live-center-placeholder"
                                style={style}
                            />
                        ))}
                    </div>
                ) : discardCards.map((card, index) => (
                    <button
                        key={card.id}
                        type="button"
                        className={`fr-card-button fr-card-button--live-center${core.focusCardId === card.id ? ' fr-card-button--selected' : ''}${canTakeDiscard ? ' fr-card-button--actionable' : ''}${pendingDiscardSelectionId === card.id ? ' fr-card-button--armed' : ''}${liveMotionCue?.type === 'hand-to-center' && liveMotionCue.cardIds.includes(card.id) ? ' fr-card-button--motion-center-receive' : ''}`}
                        onClick={() => handleDiscardPileClick(card.id)}
                        style={minimalLiveCenterCardStyles[index]}
                        data-action-state={canTakeDiscard ? 'take' : 'inspect'}
                        aria-label={canTakeDiscard
                            ? t('actions.takeDiscardAria', { name: getFantasyRealmsCardDisplayName(card) })
                            : t('actions.inspectDiscardAria', { name: getFantasyRealmsCardDisplayName(card) })}
                    >
                        {renderCard(card, t, locale)}
                        {pendingDiscardSelectionId === card.id ? (
                            <span className="fr-live-card-state" aria-hidden="true">{t('actions.selected')}</span>
                        ) : null}
                    </button>
                ))}
            </div>
        </section>
    );

    const minimalLiveHandZoneSection = (
        <section
            className={`fr-live-hand-zone${displayedHandCards.length === 0 ? ' fr-live-hand-zone--empty' : ''}${shouldShowMinimalLiveAction ? ' fr-live-hand-zone--actioning' : ''}${liveMotionCue?.type === 'draw-to-hand' ? ' fr-live-hand-zone--motion-draw' : ''}${liveMotionCue?.type === 'center-to-hand' ? ' fr-live-hand-zone--motion-take' : ''}`}
            aria-label={t('zone.hand.ariaLabel')}
            data-motion={liveMotionCue?.type === 'draw-to-hand' || liveMotionCue?.type === 'center-to-hand' ? liveMotionCue.type : 'idle'}
            data-selection-state={pendingLiveSelection ? 'armed' : 'idle'}
            data-testid="fantasyrealms-live-hand-zone"
        >
            <div className={`fr-live-hand-zone-header${shouldShowMinimalLiveAction ? '' : ' fr-live-hand-zone-header--solo'}`}>
                <div className="fr-live-hand-zone-heading">
                    <div className="fr-live-hand-zone-title">{liveHandZoneTitle}</div>
                </div>
                {shouldShowMinimalLiveAction ? (
                    <div
                        className="fr-live-action-zone"
                        data-anchor="right-lower-dock"
                        data-action-mode={livePrimaryActionMode}
                        data-testid="fantasyrealms-live-action-zone"
                    >
                        <button
                            type="button"
                            className={`fr-live-action-button${isLivePrimaryActionDisabled ? '' : ' fr-live-action-button--enabled'}`}
                            onClick={handleLivePrimaryAction}
                            disabled={isLivePrimaryActionDisabled}
                            data-action-mode={livePrimaryActionMode}
                            data-testid="fantasyrealms-live-action-button"
                            aria-label={livePrimaryActionLabel}
                        >
                            <span className="fr-live-action-button-label">{livePrimaryActionVisibleLabel}</span>
                        </button>
                    </div>
                ) : null}
            </div>
            <div className="fr-card-row-wrap">
                <div
                    className="fr-card-row fr-card-row--live-hand-zone"
                    data-testid="fantasyrealms-hand-row"
                    data-slot-count={handSlotCount}
                    data-visible-count={displayedHandCards.length}
                    style={handRowOverflowStyle}
                >
                    {displayedHandCards.length > 0
                        ? displayedHandCards.map((card, index) => (
                        <button
                            key={`live-hand-${card.id}`}
                            type="button"
                            className={`fr-card-button fr-card-button--live-hand${core.focusCardId === card.id ? ' fr-card-button--selected' : ''}${canDiscard ? ' fr-card-button--actionable' : ''}${pendingHandSelectionId === card.id ? ' fr-card-button--armed' : ''}${liveMotionCue?.type === 'draw-to-hand' && liveMotionCue.cardIds.includes(card.id) ? ' fr-card-button--motion-hand-draw' : ''}${liveMotionCue?.type === 'center-to-hand' && liveMotionCue.cardIds.includes(card.id) ? ' fr-card-button--motion-hand-take' : ''}`}
                            onClick={() => handleHandCardClick(card.id)}
                            style={minimalLiveHandCardStyles[index]}
                            data-action-state={canDiscard ? 'discard' : 'inspect'}
                            aria-label={canDiscard
                                ? t('actions.discardHandAria', { name: getFantasyRealmsCardDisplayName(card) })
                                : t('actions.inspectHandAria', { name: getFantasyRealmsCardDisplayName(card) })}
                        >
                            {renderCard(card, t, locale)}
                            {pendingHandSelectionId === card.id ? (
                                <span className="fr-live-card-state" aria-hidden="true">{t('actions.selected')}</span>
                            ) : null}
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

    const reviewedStanding = displayedPlayerId
        ? finalStandings.find((player) => player.id === displayedPlayerId) ?? null
        : null;
    const minimalLiveEndgameSection = isGameOver ? (
        <section className="fr-live-endgame" data-testid="fantasyrealms-live-endgame">
            <div className="fr-live-endgame-rail" aria-label={t('progress.finalStandings')}>
                <div className="fr-live-endgame-rail-header">
                    <div className="fr-live-endgame-rail-title">{t('progress.finalStandings')}</div>
                    <div className="fr-live-endgame-rail-subtitle">
                        {gameOver?.draw
                            ? t('progress.gameOverDraw')
                            : t('progress.gameOverWinner', { winner: finalStandings.find((player) => player.isWinner)?.name ?? t('fallback.unknownPlayer') })}
                    </div>
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
                                     </span>
                                     <span className="fr-live-endgame-rank-name">
                                         {player.name}
                                        {player.isWinner ? (
                                            <Crown
                                                className="fr-live-endgame-rank-crown"
                                                role="img"
                                                aria-label={t('score.badges.winner')}
                                            />
                                        ) : null}
                                        {isReviewed ? <i className="fr-score-badge">{t('score.badges.reviewing')}</i> : null}
                                     </span>
                                 </div>
                                <strong className="fr-live-endgame-rank-score">
                                    <AnimatedScoreNumber score={player.score} />
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
        </section>
    ) : null;

    const isMinimalLiveOpeningState = !isGameOver
        && discardCards.length === 0
        && displayedHandCards.length === 0;
    const isMinimalLiveEarlyDrawState = !isGameOver
        && discardCards.length === 0
        && displayedHandCards.length > 0
        && displayedHandCards.length <= 2;

    const liveTableSection = (
        <div
            className={`fr-live-table${isGameOver ? ' fr-live-table--gameover' : ''}${isMinimalLiveOpeningState ? ' fr-live-table--opening' : ''}${isMinimalLiveEarlyDrawState ? ' fr-live-table--early-draw' : ''}`}
            data-testid="fantasyrealms-live-table"
        >
            {minimalLiveTopbarSection}
            {minimalLiveCenterRowSection}
            {minimalLiveHandZoneSection}
            {minimalLiveEndgameSection}
        </div>
    );

    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
            <div className="fr-root">
            <style>{`
                .fr-root {
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
                    grid-template-rows: minmax(0, 1fr) 314px auto;
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
                    align-items: start;
                    gap: 14px;
                    min-height: 116px;
                    padding: 8px 18px 0;
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
                .fr-live-deck--enabled {
                    cursor: pointer;
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
                .fr-live-score-band-total {
                    color: #ffe4a4;
                    font-family: Georgia, "Times New Roman", "Microsoft YaHei", serif;
                    font-size: 38px;
                    font-weight: 900;
                    line-height: 1;
                    text-shadow: 0 3px 10px rgba(0, 0, 0, 0.22);
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
                    width: min(1180px, calc(100vw - 240px));
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
                    position: absolute;
                    top: 18px;
                    right: 18px;
                    z-index: 3;
                    width: min(320px, 26vw);
                    pointer-events: none;
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
                .fr-live-endgame-rail-header {
                    display: grid;
                    gap: 8px;
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
                .fr-live-endgame-rail-subtitle {
                    padding: 10px 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    background: rgba(12, 7, 5, 0.24);
                    color: rgba(242, 234, 215, 0.84);
                    font-size: 12px;
                    line-height: 1.45;
                }
                .fr-live-endgame-rail-list {
                    display: grid;
                    gap: 8px;
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
                .fr-live-endgame-rank-button:hover {
                    transform: translateY(-1px);
                    border-color: rgba(243, 201, 116, 0.28);
                    background: rgba(44, 28, 13, 0.34);
                }
                .fr-live-endgame-rank-button--active {
                    border-color: rgba(243, 201, 116, 0.42);
                    background: rgba(44, 28, 13, 0.42);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.08),
                        0 10px 18px rgba(0, 0, 0, 0.18);
                }
                .fr-live-endgame-rank-button--winner {
                    border-color: rgba(255, 219, 142, 0.42);
                    background:
                        radial-gradient(circle at 94% 20%, rgba(255, 213, 128, 0.18), transparent 34%),
                        rgba(54, 32, 14, 0.5);
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
                    color: rgba(242, 234, 215, 0.64);
                    font-size: 12px;
                    font-weight: 700;
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
                    width: 1em;
                    height: 1em;
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
                    text-align: right;
                }
                .fr-discard-row--live-center {
                    position: relative;
                    display: block;
                    width: min(1360px, 82vw);
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
                .fr-card-button--live-center {
                    position: absolute;
                    width: 190px;
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
                .fr-card-button--live-center:nth-child(1) { left: calc(50% - 595px); top: 2px; z-index: 1; }
                .fr-card-button--live-center:nth-child(2) { left: calc(50% - 335px); top: 2px; z-index: 1; }
                .fr-card-button--live-center:nth-child(3) { left: calc(50% - 75px); top: 2px; z-index: 1; }
                .fr-card-button--live-center:nth-child(4) { left: calc(50% + 185px); top: 2px; z-index: 1; }
                .fr-card-button--live-center:nth-child(5) { left: calc(50% + 445px); top: 2px; z-index: 1; }
                .fr-card-button--live-center:nth-child(6) { left: calc(50% - 465px); top: 182px; z-index: 2; }
                .fr-card-button--live-center:nth-child(7) { left: calc(50% - 205px); top: 182px; z-index: 2; }
                .fr-card-button--live-center:nth-child(8) { left: calc(50% + 55px); top: 182px; z-index: 2; }
                .fr-card-button--live-center:nth-child(9) { left: calc(50% + 315px); top: 182px; z-index: 2; }
                .fr-card-button--live-center:nth-child(10) { left: calc(50% + 445px); top: 182px; z-index: 2; }
                .fr-card-button--live-center:nth-child(6):nth-last-child(5) { left: calc(50% - 595px); }
                .fr-card-button--live-center:nth-child(7):nth-last-child(4) { left: calc(50% - 335px); }
                .fr-card-button--live-center:nth-child(8):nth-last-child(3) { left: calc(50% - 75px); }
                .fr-card-button--live-center:nth-child(9):nth-last-child(2) { left: calc(50% + 185px); }
                .fr-card-button--live-center:nth-child(10):nth-last-child(1) { left: calc(50% + 445px); }
                .fr-live-hand-zone .fr-card-row-wrap {
                    position: relative;
                    padding: 0;
                    gap: 12px;
                }
                .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    position: relative;
                    z-index: 1;
                    width: min(1500px, calc(100vw - 136px));
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
                .fr-live-hand-zone-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                    width: min(1520px, calc(100vw - 140px));
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
                    content: "";
                    position: absolute;
                    inset: 5px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 225, 160, 0.08);
                    box-shadow:
                        -6px -6px 0 -5px rgba(255, 225, 160, 0.34),
                        6px -6px 0 -5px rgba(255, 225, 160, 0.34),
                        -6px 6px 0 -5px rgba(255, 225, 160, 0.34),
                        6px 6px 0 -5px rgba(255, 225, 160, 0.34);
                    pointer-events: none;
                }
                .fr-live-action-button::after {
                    content: "";
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 0;
                    height: 34px;
                    background: linear-gradient(180deg, rgba(255,255,255,0.1), transparent);
                    pointer-events: none;
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
                .fr-live-action-button[data-action-mode="draw"].fr-live-action-button--enabled {
                    background:
                        radial-gradient(circle at 50% 10%, rgba(255, 239, 190, 0.18), transparent 34%),
                        linear-gradient(180deg, rgba(138, 89, 36, 0.96), rgba(72, 41, 16, 0.96));
                }
                .fr-live-action-button[data-action-mode="select-discard"],
                .fr-live-action-button[data-action-mode="select-hand"] {
                    border-color: rgba(236, 203, 122, 0.26);
                    color: rgba(255, 235, 188, 0.92);
                    background:
                        radial-gradient(circle at 50% 8%, rgba(255, 226, 154, 0.08), transparent 34%),
                        linear-gradient(180deg, rgba(73, 57, 36, 0.94), rgba(36, 31, 24, 0.96));
                }
                .fr-live-action-button[data-action-mode="confirm-take"].fr-live-action-button--enabled,
                .fr-live-action-button[data-action-mode="confirm-discard"].fr-live-action-button--enabled {
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
                }
                .fr-live-action-button--deck {
                    width: 100%;
                    min-width: 0;
                    justify-content: center;
                }
                .fr-live-action-button:focus-visible,
                .fr-live-deck--enabled:focus-visible {
                    outline: 2px solid rgba(255, 238, 201, 0.92);
                    outline-offset: 4px;
                }
                .fr-live-hand-zone[data-selection-state="armed"] .fr-live-action-button[data-action-mode="confirm-take"].fr-live-action-button--enabled,
                .fr-live-hand-zone[data-selection-state="armed"] .fr-live-action-button[data-action-mode="confirm-discard"].fr-live-action-button--enabled {
                    transform: translateY(-2px);
                }
                .fr-live-deck--enabled:hover .fr-live-deck-stack {
                    transform: translateY(-2px) scale(1.02);
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
                    width: min(1460px, 86vw);
                    min-height: 312px;
                    transform: translateY(0);
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
                    width: 202px;
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
                .fr-board--minimal-live .fr-card-button--live-center {
                    width: 206px;
                }
                .fr-board--minimal-live .fr-card-button--live-center .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand .fr-card {
                    border-radius: 9px;
                    border-color: rgba(255, 238, 199, 0.32);
                    box-shadow:
                        0 14px 20px rgba(0, 0, 0, 0.28),
                        0 3px 6px rgba(0, 0, 0, 0.14);
                    transition:
                        box-shadow 140ms ease,
                        border-color 140ms ease,
                        transform 140ms ease;
                }
                .fr-board--minimal-live .fr-card-button--live-center.fr-card-button--actionable .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand.fr-card-button--actionable .fr-card {
                    border-color: rgba(255, 238, 201, 0.64);
                    box-shadow:
                        0 14px 18px rgba(0, 0, 0, 0.26),
                        0 0 0 1px rgba(255, 243, 213, 0.1);
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
                .fr-board--minimal-live .fr-card-button--motion-hand-draw .fr-card {
                    animation: fr-live-hand-arrive-from-deck 920ms cubic-bezier(0.18, 0.9, 0.22, 1) both;
                }
                .fr-board--minimal-live .fr-card-button--motion-hand-draw:nth-child(2n) .fr-card {
                    animation-delay: 32ms;
                }
                .fr-board--minimal-live .fr-card-button--motion-hand-draw:nth-child(3n) .fr-card {
                    animation-delay: 64ms;
                }
                .fr-board--minimal-live .fr-card-button--motion-hand-take .fr-card {
                    animation: fr-live-hand-arrive-from-center 1000ms cubic-bezier(0.18, 0.9, 0.22, 1) both;
                }
                .fr-board--minimal-live .fr-card-button--motion-center-receive .fr-card {
                    animation: fr-live-center-row-receive-discard 1200ms cubic-bezier(0.18, 0.9, 0.22, 1) both;
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
                        opacity: 0.22;
                        transform: translate(0, -230px) scale(0.9) rotate(2deg);
                    }
                    62% {
                        opacity: 1;
                        transform: translate(0, -18px) scale(1.02) rotate(0deg);
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
                    width: min(1460px, calc(100vw - 128px));
                    margin: 0 auto;
                    grid-template-columns: repeat(var(--fr-live-hand-slots, 7), minmax(0, 1fr));
                    justify-content: center;
                    gap: 18px;
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
                    width: min(1460px, calc(100vw - 128px));
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
                    width: min(1180px, calc(100vw - 200px));
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
                    width: min(1280px, calc(100vw - 180px));
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
                    width: min(1180px, calc(100vw - 220px));
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
                    width: min(1380px, calc(100vw - 160px));
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
                    right: 104px;
                    bottom: 112px;
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
                .fr-compact-layout .fr-live-table {
                    min-height: 650px;
                    grid-template-rows: 112px minmax(0, 1fr) 252px;
                }
                .fr-compact-layout .fr-live-topbar {
                    min-height: 108px;
                }
                .fr-compact-layout .fr-live-status-strip {
                    top: 20px;
                    gap: 12px;
                }
                .fr-compact-layout .fr-live-chip--turn {
                    min-width: 96px;
                    font-size: 18px;
                }
                .fr-compact-layout .fr-live-chip--turn-active {
                    min-width: 112px;
                }
                .fr-compact-layout .fr-live-chip--round {
                    font-size: 11px;
                }
                .fr-compact-layout .fr-live-chip--progress {
                    min-width: 62px;
                    font-size: 18px;
                }
                .fr-compact-layout .fr-live-chip--cue {
                    font-size: 13px;
                }
                .fr-compact-layout .fr-live-deck {
                    top: 20px;
                    left: 18px;
                }
                .fr-compact-layout .fr-live-deck-stack {
                    width: 88px;
                    height: 122px;
                }
                .fr-compact-layout .fr-live-deck-count {
                    right: 6px;
                    bottom: 6px;
                    min-width: 32px;
                    height: 24px;
                    padding: 0 7px;
                    font-size: 18px;
                }
                .fr-compact-layout .fr-live-score-strip {
                    top: 20px;
                    right: 18px;
                    width: 112px;
                }
                .fr-compact-layout .fr-discard-row--live-center {
                    width: min(880px, calc(100vw - 96px));
                    min-height: 286px;
                    transform: translateY(6px);
                }
                .fr-compact-layout .fr-card-button--live-center {
                    width: 164px;
                }
                .fr-compact-layout .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: min(920px, calc(100vw - 72px));
                    transform: translateY(-8px);
                }
                .fr-compact-layout .fr-live-action-zone {
                    right: 28px;
                    bottom: 160px;
                    width: 152px;
                    height: 60px;
                    min-height: 60px;
                }
                .fr-compact-layout .fr-live-action-button {
                    width: 152px;
                    height: 60px;
                    padding: 8px 14px;
                }
                .fr-compact-layout .fr-live-action-button-label {
                    max-width: 124px;
                    font-size: 18px;
                }
                .fr-compact-focus-rail {
                    margin-top: -6px;
                }
                /* 当前 fr-merge-pass2 桌面版：去掉底部说明横幅，保留轻量顶栏与右侧独立主动作。 */
                .fr-board--minimal-live .fr-live-table {
                    grid-template-rows: 132px minmax(0, 1fr) 326px;
                    gap: 0;
                }
                .fr-board--minimal-live .fr-live-table--opening {
                    grid-template-rows: 132px minmax(0, 1fr) 0;
                }
                .fr-board--minimal-live .fr-live-table--early-draw {
                    grid-template-rows: 132px minmax(0, 1fr) 326px;
                }
                .fr-board--minimal-live .fr-live-topbar {
                    grid-template-columns: 118px minmax(0, 1fr) 132px;
                    min-height: 128px;
                    gap: 16px;
                    padding: 0 24px;
                    align-items: start;
                }
                .fr-board--minimal-live {
                    width: 100vw;
                    height: 100vh;
                    padding: 12px 16px 16px;
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
                    gap: 16px;
                    margin-top: 18px;
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
                    min-width: 106px;
                    padding: 0 4px;
                    font-size: 20px;
                }
                .fr-board--minimal-live .fr-live-chip--turn-active {
                    min-width: 124px;
                }
                .fr-board--minimal-live .fr-live-chip--round {
                    min-height: 28px;
                    padding: 0 4px;
                    font-size: 12px;
                    color: rgba(245, 226, 190, 0.68);
                    background: transparent;
                }
                .fr-board--minimal-live .fr-live-chip--progress {
                    min-width: 74px;
                    font-size: 21px;
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
                    width: 96px;
                    height: 126px;
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
                    width: 132px;
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
                    font-size: 24px;
                    color: rgba(248, 223, 159, 0.86);
                    font-weight: 800;
                }
                .fr-board--minimal-live .fr-live-hand-zone {
                    margin-top: 0;
                    padding: 0 18px 18px;
                }
                .fr-board--minimal-live .fr-live-hand-zone .fr-card-row--live-hand-zone,
                .fr-board--minimal-live .fr-live-table--early-draw .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: min(1520px, calc(100vw - 260px));
                    margin: 0 auto;
                    transform: translateY(0);
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
                .fr-board--minimal-live .fr-live-action-zone {
                    position: fixed;
                    left: auto;
                    right: clamp(40px, 4vw, 68px);
                    top: auto;
                    bottom: clamp(148px, 16vh, 184px);
                    transform: none;
                    z-index: 4;
                    width: auto;
                    height: auto;
                    min-height: 0;
                    justify-content: flex-end;
                    pointer-events: none;
                }
                .fr-board--minimal-live .fr-live-action-button {
                    width: 224px;
                    min-height: 62px;
                    height: auto;
                    padding: 12px 20px;
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
                .fr-board--minimal-live .fr-live-action-button[data-action-mode="select-discard"],
                .fr-board--minimal-live .fr-live-action-button[data-action-mode="select-hand"] {
                    background: linear-gradient(180deg, rgba(104, 93, 70, 0.96), rgba(61, 54, 43, 0.98));
                    color: rgba(255, 240, 204, 0.94);
                }
                .fr-board--minimal-live .fr-live-action-button[data-action-mode="confirm-take"].fr-live-action-button--enabled,
                .fr-board--minimal-live .fr-live-action-button[data-action-mode="confirm-discard"].fr-live-action-button--enabled {
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
                    max-width: 168px;
                    font-size: 20px;
                    line-height: 1.08;
                }
                .fr-compact-layout .fr-live-table {
                    grid-template-rows: 108px minmax(0, 1fr) 220px;
                    min-height: 0;
                }
                .fr-compact-layout .fr-live-table--opening {
                    grid-template-rows: 108px minmax(0, 1fr) 0;
                }
                .fr-compact-layout .fr-live-table--early-draw {
                    grid-template-rows: 108px minmax(0, 1fr) 220px;
                }
                .fr-compact-layout .fr-live-topbar {
                    grid-template-columns: 128px minmax(0, 1fr) 118px;
                    min-height: 108px;
                    padding: 0 16px;
                }
                .fr-compact-layout .fr-live-status-strip {
                    gap: 12px;
                    margin-top: 12px;
                }
                .fr-compact-layout .fr-live-chip--turn {
                    min-width: 88px;
                    font-size: 17px;
                }
                .fr-compact-layout .fr-live-chip--turn-active {
                    min-width: 104px;
                }
                .fr-compact-layout .fr-live-chip--progress {
                    min-width: 60px;
                    font-size: 18px;
                }
                .fr-compact-layout .fr-live-chip--cue {
                    font-size: 12px;
                }
                .fr-compact-layout .fr-live-deck {
                    padding-top: 10px;
                }
                .fr-compact-layout .fr-live-deck-stack {
                    width: 96px;
                    height: 132px;
                }
                .fr-compact-layout .fr-live-deck-count {
                    min-width: 34px;
                    height: 24px;
                    font-size: 18px;
                }
                .fr-compact-layout .fr-live-score-strip {
                    width: 118px;
                }
                .fr-compact-layout .fr-live-score-band-total {
                    font-size: 18px;
                }
                .fr-compact-layout .fr-discard-row--live-center {
                    min-height: 240px;
                }
                .fr-compact-layout .fr-card-button--live-center {
                    width: 164px;
                }
                .fr-compact-layout .fr-live-hand-zone {
                    padding: 0 14px 10px;
                }
                .fr-compact-layout .fr-live-hand-zone .fr-card-row--live-hand-zone,
                .fr-compact-layout .fr-live-table--early-draw .fr-live-hand-zone .fr-card-row--live-hand-zone {
                    width: min(820px, calc(100vw - 300px));
                    transform: translateY(0);
                }
                .fr-compact-layout .fr-live-action-zone {
                    position: fixed;
                    left: auto;
                    right: 28px;
                    bottom: 116px;
                    transform: none;
                    width: auto;
                    height: auto;
                    min-height: 0;
                    justify-content: flex-end;
                    pointer-events: none;
                }
                .fr-compact-layout .fr-live-action-button {
                    width: 186px;
                    min-height: 56px;
                    height: auto;
                    padding: 10px 16px;
                    pointer-events: auto;
                }
                .fr-compact-layout .fr-live-action-button-label {
                    max-width: 142px;
                    font-size: 18px;
                }
                .fr-compact-focus-rail {
                    position: absolute;
                    left: 24px;
                    bottom: 18px;
                    width: 184px;
                    z-index: 4;
                    margin-top: 0;
                    pointer-events: none;
                }
                .fr-compact-focus-panel {
                    display: grid;
                    gap: 10px;
                    padding: 12px 12px 14px;
                    border-radius: 12px;
                    border: 1px solid rgba(224, 188, 114, 0.14);
                    background: rgba(11, 24, 21, 0.72);
                    box-shadow:
                        0 14px 22px rgba(0, 0, 0, 0.24),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                }
                .fr-compact-focus-header {
                    font-size: 11px;
                    color: rgba(246, 223, 180, 0.72);
                }
                .fr-compact-focus-body {
                    display: grid;
                    grid-template-columns: 86px minmax(0, 1fr);
                    gap: 10px;
                    align-items: center;
                }
                .fr-compact-focus-preview-shell {
                    position: relative;
                    width: 86px;
                    height: 120px;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 10px 16px rgba(0, 0, 0, 0.22);
                }
                .fr-compact-focus-preview-shell--hidden {
                    opacity: 0.92;
                }
                .fr-card--compact-focus-preview {
                    width: 100%;
                    height: 100%;
                    min-height: 0;
                    border-radius: 8px;
                }
                .fr-compact-focus-copy {
                    display: grid;
                    gap: 8px;
                    min-width: 0;
                }
                .fr-compact-focus-name {
                    font-size: 15px;
                    line-height: 1.2;
                    color: #ffe8ad;
                }
                .fr-compact-focus-score {
                    font-size: 20px;
                    line-height: 1;
                    color: rgba(248, 223, 159, 0.9);
                    font-weight: 800;
                }
                .fr-board--minimal-live .fr-live-deck--enabled:active .fr-live-deck-stack {
                    transform: translateY(1px) scale(0.99);
                    filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.28));
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
                    .fr-board--minimal-live .fr-live-action-button,
                    .fr-live-chip--turn-active,
                    .fr-board--minimal-live .fr-live-deck-stack {
                        transition: none;
                        animation: none;
                    }
                    .fr-board--minimal-live .fr-card-button--live-center.fr-card-button--actionable:hover .fr-card,
                    .fr-board--minimal-live .fr-card-button--live-hand.fr-card-button--actionable:hover .fr-card,
                    .fr-board--minimal-live .fr-card-button--armed .fr-card,
                    .fr-board--minimal-live .fr-live-action-button--enabled:hover,
                    .fr-board--minimal-live .fr-live-action-button--enabled:active,
                    .fr-board--minimal-live .fr-live-deck--enabled:hover .fr-live-deck-stack,
                    .fr-board--minimal-live .fr-live-deck--enabled:active .fr-live-deck-stack {
                        transform: none;
                    }
                }
                .fr-panel {
                    overflow: hidden;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
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
                .fr-compact-turn-panel {
                    margin-bottom: 14px;
                }
                .fr-compact-layout {
                    display: grid;
                    gap: 18px;
                }
                .fr-compact-layout--tight-landscape {
                    gap: 12px;
                }
                .fr-compact-insight-grid,
                .fr-compact-support-grid {
                    display: grid;
                    gap: 18px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .fr-stack {
                    position: relative;
                    overflow: hidden;
                    aspect-ratio: 0.72;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: none;
                }
                .fr-stack--deck {
                    background: rgba(18, 24, 21, 0.78);
                }
                .fr-stack-card {
                    position: absolute;
                    inset: 0;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
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
                    border: 1px solid rgba(255, 255, 255, 0.06);
                }
                .fr-score-row--dense {
                    gap: 10px;
                    padding: 8px 10px;
                }
                .fr-score-row--active {
                    border-color: rgba(255, 255, 255, 0.16);
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
                .fr-card-button:disabled {
                    cursor: default;
                }
                .fr-card {
                    position: relative;
                    display: block;
                    width: 100%;
                    overflow: hidden;
                    aspect-ratio: 0.72;
                    border-radius: 14px;
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    background: linear-gradient(180deg, #ece1c7 0%, #cdb68a 100%);
                    color: #23170f;
                    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.28);
                }
                .fr-card--atlas {
                    background-color: #1b130f;
                    background-origin: border-box;
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
                    .fr-compact-insight-grid,
                    .fr-compact-support-grid {
                        grid-template-columns: 1fr;
                    }
                    .fr-card-row {
                        grid-template-columns: repeat(7, minmax(96px, 1fr));
                        overflow-x: auto;
                        padding-bottom: 4px;
                    }
                    .fr-card--focus-preview {
                        max-width: 172px;
                    }
                    .fr-live-endgame {
                        top: 14px;
                        right: 14px;
                        width: min(300px, calc(100vw - 40px));
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
                        grid-template-rows: minmax(0, 1fr) 248px auto;
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
                    .fr-live-endgame {
                        top: 10px;
                        right: 10px;
                        width: min(280px, calc(100vw - 28px));
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

            <div className={`fr-board${isMinimalLiveDesktop ? ' fr-board--minimal-live' : ''}`}>
                {isCompactLandscapeTableViewport ? (
                    <div
                        className={`fr-compact-layout${isTightCompactLandscapeViewport ? ' fr-compact-layout--tight-landscape' : ''}`}
                        data-testid="fantasyrealms-compact-layout"
                    >
                        {liveTableSection}
                        {compactFocusRailSection ? <div className="fr-compact-focus-rail">{compactFocusRailSection}</div> : null}
                    </div>
                ) : liveTableSection}
            </div>
            </div>
        </UndoProvider>
    );
}
