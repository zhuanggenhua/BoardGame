import React from 'react';
import { useTranslation } from 'react-i18next';
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

type LiveMotionCueType = 'draw-to-hand' | 'discard-to-hand' | 'hand-to-river';

type LiveMotionCue = {
    type: LiveMotionCueType;
    key: number;
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

const LIVE_RIVER_CARD_WIDTH = 190;
const LIVE_RIVER_PREFERRED_GAP = 108;
const LIVE_RIVER_MIN_GAP = 16;
const LIVE_RIVER_MAX_ROW_WIDTH = 1220;
const LIVE_RIVER_ROW_TOP = 8;
const LIVE_RIVER_ROW_OFFSET = 202;

function shouldUseStackedViewport(width: number, _height: number): boolean {
    return width <= 1180;
}

function shouldUseCompactLandscapeViewport(width: number, height: number): boolean {
    return width > height && width <= 900 && height <= 520;
}

const SCORE_LABEL_KEY_BY_LABEL: Record<string, string> = {
    有效基础分: 'score.labels.activeBase',
    总加分: 'score.labels.totalBonus',
    总减分: 'score.labels.totalPenalty',
};

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

function buildCardSlots(cards: TableCard[], slotCount: number, prefix: string): CardRowSlot[] {
    const slots: CardRowSlot[] = cards.slice(0, slotCount).map((card) => ({
        key: `${prefix}-${card.id}`,
        card,
    }));

    while (slots.length < slotCount) {
        slots.push({ key: `${prefix}-empty-${slots.length}` });
    }

    return slots;
}

function buildMinimalLiveRiverCardStyles(cardCount: number): React.CSSProperties[] {
    if (cardCount <= 0) return [];

    const topRowCount = cardCount <= 5 ? cardCount : Math.ceil(cardCount / 2);
    const bottomRowCount = cardCount <= 5 ? 0 : Math.floor(cardCount / 2);
    const styles: React.CSSProperties[] = [];

    const pushRow = (rowCount: number, rowIndex: number) => {
        if (rowCount <= 0) return;

        const availableGap = rowCount <= 1
            ? 0
            : Math.floor((LIVE_RIVER_MAX_ROW_WIDTH - (rowCount * LIVE_RIVER_CARD_WIDTH)) / (rowCount - 1));
        const gap = rowCount <= 1
            ? 0
            : Math.max(LIVE_RIVER_MIN_GAP, Math.min(LIVE_RIVER_PREFERRED_GAP, availableGap));
        const rowWidth = (rowCount * LIVE_RIVER_CARD_WIDTH) + ((rowCount - 1) * gap);
        const startOffset = -(rowWidth / 2);

        for (let index = 0; index < rowCount; index += 1) {
            const left = Math.round(startOffset + (index * (LIVE_RIVER_CARD_WIDTH + gap)));
            styles.push({
                left: `calc(50% + ${left}px)`,
                top: `${LIVE_RIVER_ROW_TOP + (rowIndex * LIVE_RIVER_ROW_OFFSET)}px`,
            });
        }
    };

    pushRow(topRowCount, 0);
    pushRow(bottomRowCount, 1);
    return styles;
}

function buildMinimalLiveHandCardStyles(cardCount: number, slotCount: number): React.CSSProperties[] {
    if (cardCount <= 0 || slotCount <= 0) return [];
    const startColumn = Math.max(1, Math.floor((slotCount - cardCount) / 2) + 1);
    return Array.from({ length: cardCount }, (_, index) => ({
        gridColumn: `${startColumn + index}`,
    }));
}

function createLiveMotionSnapshot(
    core: FantasyRealmsCore,
    viewerPlayerId: string | null,
    handCards: TableCard[],
    discardCards: TableCard[],
    isGameOver: boolean,
): LiveMotionSnapshot {
    return {
        viewerPlayerId,
        currentPlayer: core.currentPlayer,
        stage: core.stage,
        handIds: handCards.map((card) => card.id),
        discardIds: discardCards.map((card) => card.id),
        drawPileCount: core.drawPile.length,
        isGameOver,
    };
}

function localizeScoreBreakdownLabel(label: string, t: Translator): string {
    return SCORE_LABEL_KEY_BY_LABEL[label] ? t(SCORE_LABEL_KEY_BY_LABEL[label]) : label;
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

function getStageBannerText(
    core: FantasyRealmsCore,
    viewerPlayerId: string | null,
    currentPlayerName: string,
    t: Translator,
): string {
    if (viewerPlayerId !== core.currentPlayer) {
        return t('turn.statusBanner.waiting', { player: currentPlayerName });
    }
    if (core.stage === 'discard') {
        return t('turn.statusBanner.discardSelf');
    }
    return t('turn.live.selfTurn');
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

export default function FantasyRealmsBoard({ G, dispatch, matchData, playerID }: Props) {
    const { t, i18n } = useTranslation('game-fantasyrealms');
    const locale = i18n.language || 'zh-CN';
    const core = React.useMemo(() => (isFantasyRealmsCore(G?.core) ? G.core : createFallbackCore()), [G]);
    const [isStackedViewport, setIsStackedViewport] = React.useState(() => (
        typeof window !== 'undefined' ? shouldUseStackedViewport(window.innerWidth, window.innerHeight) : false
    ));
    const [isCompactLandscapeViewport, setIsCompactLandscapeViewport] = React.useState(() => (
        typeof window !== 'undefined' ? shouldUseCompactLandscapeViewport(window.innerWidth, window.innerHeight) : false
    ));
    const [pendingLiveSelection, setPendingLiveSelection] = React.useState<PendingLiveSelection>(null);
    const [liveMotionCue, setLiveMotionCue] = React.useState<LiveMotionCue>(null);
    const liveMotionSnapshotRef = React.useRef<LiveMotionSnapshot | null>(null);
    const liveMotionSequenceRef = React.useRef(0);

    React.useLayoutEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handleResize = () => {
            const nextIsStackedViewport = shouldUseStackedViewport(window.innerWidth, window.innerHeight);
            const nextIsCompactLandscapeViewport = shouldUseCompactLandscapeViewport(window.innerWidth, window.innerHeight);
            setIsStackedViewport((previous) => (previous === nextIsStackedViewport ? previous : nextIsStackedViewport));
            setIsCompactLandscapeViewport((previous) => (
                previous === nextIsCompactLandscapeViewport ? previous : nextIsCompactLandscapeViewport
            ));
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isSpectatorView = playerID == null;
    const viewerPlayerId = isSpectatorView ? null : playerID;
    const viewerPlayer = viewerPlayerId ? core.players[viewerPlayerId] : undefined;
    const viewerHandCards = React.useMemo(() => viewerPlayer?.hand ?? [], [viewerPlayer?.hand]);
    const gameOver = G?.sys?.gameover as { winner?: string; draw?: boolean; scores?: Record<string, number>; winners?: string[] } | undefined;
    const isGameOver = Boolean(gameOver);
    const handSlotCount = Math.max(FANTASY_REALMS_HAND_CARD_SLOTS, viewerHandCards.length);
    const handCardSlots = React.useMemo(
        () => buildCardSlots(viewerHandCards, handSlotCount, 'hand'),
        [handSlotCount, viewerHandCards],
    );
    const focusDisplay = React.useMemo(
        () => resolveFocusDisplayState(core, viewerPlayerId, viewerPlayer, isGameOver),
        [core, isGameOver, viewerPlayer, viewerPlayerId],
    );
    const visibleFocusCard = focusDisplay.card;
    const focusInsight = React.useMemo(
        () => buildBoardFocusInsight(core, viewerPlayer, focusDisplay, t),
        [core, focusDisplay, t, viewerPlayer],
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
    const discardCards = React.useMemo(() => [...core.discardPile].reverse(), [core.discardPile]);
    const currentPlayerName = React.useMemo(() => {
        const matchPlayer = matchData.find((player) => String(player.id) === String(core.currentPlayer));
        if (matchPlayer?.name) return matchPlayer.name;
        if (core.players[core.currentPlayer]?.name) return core.players[core.currentPlayer]!.name;
        return t('fallback.currentPlayer');
    }, [core.currentPlayer, core.players, matchData, t]);
    const viewerPlayerName = (() => {
        if (isSpectatorView) return t('fallback.spectator');
        const matchPlayer = matchData.find((player) => String(player.id) === String(viewerPlayerId));
        if (matchPlayer?.name) return matchPlayer.name;
        if (viewerPlayer?.name) return viewerPlayer.name;
        return t('fallback.viewer');
    })();
    const isMyTurn = !isSpectatorView && viewerPlayerId === core.currentPlayer;
    const canDrawFromDeck = isMyTurn && !isGameOver && core.stage === 'draw' && core.drawPile.length > 0;
    const canTakeDiscard = isMyTurn && !isGameOver && core.stage === 'draw' && core.discardPile.length > 0;
    const canDiscard = isMyTurn && !isGameOver && core.stage === 'discard';
    const useDenseScorePanel = core.playerIds.length >= 5;
    const discardThreshold = getFantasyRealmsDiscardEndThreshold(core.playerIds.length);
    const discardProgress = Math.min(core.discardPile.length / discardThreshold, 1);
    const pendingDiscardSelectionId = pendingLiveSelection?.source === 'discard' ? pendingLiveSelection.cardId : null;
    const pendingHandSelectionId = pendingLiveSelection?.source === 'hand' ? pendingLiveSelection.cardId : null;
    const selectedDiscardCard = pendingDiscardSelectionId
        ? discardCards.find((card) => card.id === pendingDiscardSelectionId) ?? null
        : null;
    const selectedHandCard = pendingHandSelectionId
        ? viewerHandCards.find((card) => card.id === pendingHandSelectionId) ?? null
        : null;
    const winnerName = gameOver?.winner
        ? getPlayerDisplayName(gameOver.winner, core, matchData, t)
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
    const canRevealViewerLiveScore = !isSpectatorView && Boolean(viewerPlayer);
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
    const stageBannerText = React.useMemo(
        () => getStageBannerText(core, viewerPlayerId, currentPlayerName, t),
        [core, currentPlayerName, t, viewerPlayerId],
    );
    const shouldShowFocusKicker = !isGameOver && !focusDisplay.hiddenByOtherPlayer;
    const isMinimalLiveDesktop = !isStackedViewport;
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
    const compactTurnStateLabel = React.useMemo(() => {
        if (!isMyTurn) return null;
        if (core.stage === 'discard') return t('turn.compact.discard');
        return t('turn.compact.draw');
    }, [core.stage, isMyTurn, t]);
    const viewerHandIdsSignature = viewerHandCards.map((card) => card.id).join('|');
    const discardIdsSignature = discardCards.map((card) => card.id).join('|');

    React.useEffect(() => {
        const nextSnapshot = createLiveMotionSnapshot(core, viewerPlayerId, viewerHandCards, discardCards, isGameOver);
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

        if (
            previousSnapshot.currentPlayer === viewerPlayerId
            && nextSnapshot.currentPlayer === viewerPlayerId
            && previousSnapshot.stage === 'draw'
            && nextSnapshot.stage === 'discard'
            && handCountDelta > 0
        ) {
            nextCueType = drawCountDelta < 0 ? 'draw-to-hand' : 'discard-to-hand';
        } else if (
            previousSnapshot.currentPlayer === previousSnapshot.viewerPlayerId
            && previousSnapshot.stage === 'discard'
            && nextSnapshot.stage === 'draw'
            && (discardCountDelta > 0 || discardIdsChanged)
        ) {
            nextCueType = 'hand-to-river';
        }

        if (!nextCueType) {
            return undefined;
        }

        liveMotionSequenceRef.current += 1;
        const nextKey = liveMotionSequenceRef.current;
        setLiveMotionCue({ type: nextCueType, key: nextKey });
        const clearTimer = window.setTimeout(() => {
            setLiveMotionCue((current) => (current?.key === nextKey ? null : current));
        }, 1350);

        return () => window.clearTimeout(clearTimer);
    }, [
        core.currentPlayer,
        core.drawPile.length,
        core.stage,
        discardIdsSignature,
        isGameOver,
        isMinimalLiveDesktop,
        isSpectatorView,
        viewerHandIdsSignature,
        viewerPlayerId,
    ]);

    const handleDrawFromDeck = React.useCallback(() => {
        dispatch('DRAW_FROM_DECK', {});
    }, [dispatch]);

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

    }, [canDiscard, dispatch, selectedDiscardCard, selectedHandCard]);

    const handleDeckStackClick = React.useCallback(() => {
        if (!canDrawFromDeck || !isMyTurn) return;
        setPendingLiveSelection(null);
        dispatch('DRAW_FROM_DECK', {});
    }, [canDrawFromDeck, dispatch, isMyTurn]);

    const livePrimaryActionLabel = React.useMemo(() => {
        if (canDiscard) {
            return selectedHandCard ? t('actions.confirmDiscard') : t('turn.primaryActionShort.discardRequired');
        }
        return t('actions.confirmTake');
    }, [canDiscard, selectedHandCard, t]);
    const minimalLiveRiverCardStyles = React.useMemo(
        () => buildMinimalLiveRiverCardStyles(discardCards.length),
        [discardCards.length],
    );
    const minimalLiveHandCardStyles = React.useMemo(
        () => buildMinimalLiveHandCardStyles(viewerHandCards.length, handSlotCount),
        [handSlotCount, viewerHandCards.length],
    );

    const isLivePrimaryActionDisabled = React.useMemo(() => {
        if (canDiscard) return !selectedHandCard;
        return false;
    }, [canDiscard, selectedHandCard]);

    const turnPanelBody = isGameOver ? (
        <div className="fr-panel-body fr-chip-list">
            <div className="fr-chip">{t('turn.reviewChip')}</div>
        </div>
    ) : (
        <div className="fr-panel-body fr-chip-list">
            <div className="fr-chip">{t('turn.roundChip', { turn: core.turn })}</div>
            <div
                className={`fr-stage-banner${core.stage === 'discard' ? ' fr-stage-banner--discard' : ''}`}
                aria-live="polite"
            >
                {stageBannerText}
            </div>
            {canDrawFromDeck ? (
                <button
                    type="button"
                    className="fr-chip fr-chip--actionable"
                    onClick={handleDrawFromDeck}
                >
                    {getDrawDeckLabel(core, t)}
                </button>
            ) : null}
        </div>
    );

    const turnPanelSection = (
        <section className="fr-panel fr-stacked-turn-panel">
            <div className="fr-panel-header">{t('turn.panelTitle')}</div>
            {turnPanelBody}
        </section>
    );

    const deckPanelSection = (
        <section className="fr-panel fr-panel--deck-corner">
            <div className="fr-panel-header">{t('deck.panelTitle')}</div>
            <div className="fr-panel-body">
                <div className={`fr-stack fr-stack--deck${isStackedViewport ? ' fr-stack--deck-compact' : ''}`}>
                    <div className="fr-stack-card fr-stack-card--under" style={deckBackStyle} aria-hidden="true" />
                    <div className="fr-stack-card fr-stack-card--mid" style={deckBackStyle} aria-hidden="true" />
                    <div className="fr-stack-card fr-stack-card--top" style={deckBackStyle} aria-hidden="true" />
                    <div className="fr-stack-label">
                        <span>{t('deck.remaining')}</span>
                        <strong className="fr-count">{core.drawPile.length}</strong>
                    </div>
                </div>
            </div>
        </section>
    );

    const scorePanelSection = (
        <section className="fr-panel">
            <div className="fr-panel-header">{t('score.panelTitle')}</div>
            <div className={`fr-panel-body fr-score-summary${useDenseScorePanel ? ' fr-score-summary--dense' : ''}`}>
                <div className={`fr-score-table${useDenseScorePanel ? ' fr-score-table--dense' : ''}`} aria-label={t('score.tableTitle')}>
                    {playerSummaries.map((player) => (
                        <div
                            key={player.id}
                            className={`fr-score-row${player.isCurrent ? ' fr-score-row--active' : ''}${useDenseScorePanel ? ' fr-score-row--dense' : ''}`}
                        >
                            <div className="fr-score-row-main">
                                <div className={`fr-score-row-name${useDenseScorePanel ? ' fr-score-row-name--dense' : ''}`}>
                                    <span>{player.name}</span>
                                    {player.isViewer ? <i className="fr-score-badge">{t('score.badges.you')}</i> : null}
                                    {player.isWinner ? <i className="fr-score-badge">{t('score.badges.winner')}</i> : null}
                                </div>
                                <div className={`fr-score-row-meta${useDenseScorePanel ? ' fr-score-row-meta--dense' : ''}`}>
                                    {t('score.handCount', { count: player.handCount })}
                                </div>
                            </div>
                            <div className={`fr-score-row-total${useDenseScorePanel ? ' fr-score-row-total--dense' : ''}`}>
                                {player.scoreVisible ? (
                                    <>
                                        <strong>{player.score}</strong>
                                        <span>{t('score.totalLabel')}</span>
                                    </>
                                ) : (
                                    <>
                                        <strong>{t('score.hiddenValue')}</strong>
                                        <span>{t('score.hiddenLabel')}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {canRevealViewerLiveScore ? (
                    <div className={`fr-score-list${useDenseScorePanel ? ' fr-score-list--dense' : ''}`}>
                        {(viewerPlayer?.scoreBreakdown ?? []).map((line) => (
                            <span key={line.label}>
                                <em>{localizeScoreBreakdownLabel(line.label, t)}</em>
                                <b>{line.value >= 0 ? `+${line.value}` : line.value}</b>
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
        </section>
    );

    const discardZoneSection = (
        <section
            className="fr-zone"
            aria-label={t('zone.discard.title')}
        >
            <div className="fr-zone-header">
                <div className="fr-zone-title">{t('zone.discard.title')}</div>
                <div className={`fr-zone-hint${canTakeDiscard ? ' fr-zone-hint--active' : ''}`}>
                    {`${discardCards.length}/${discardThreshold}`}
                </div>
            </div>
            <div
                className={`fr-discard-row${discardCards.length === 0 ? ' fr-discard-row--empty' : ''}`}
                data-testid="fantasyrealms-discard-row"
            >
                {discardCards.length === 0 ? (
                    <div
                        className="fr-zone-empty"
                        data-testid="fantasyrealms-discard-empty"
                    >
                        {t('zone.discard.emptyCompact')}
                    </div>
                ) : discardCards.map((card) => (
                    <button
                        key={card.id}
                        type="button"
                        className={`fr-card-button${core.focusCardId === card.id ? ' fr-card-button--selected' : ''}${canTakeDiscard ? ' fr-card-button--actionable' : ''}`}
                        onClick={() => handleDiscardPileClick(card.id)}
                        data-action-state={canTakeDiscard ? 'take' : 'inspect'}
                        aria-label={canTakeDiscard
                            ? t('actions.takeDiscardAria', { name: getFantasyRealmsCardDisplayName(card) })
                            : t('actions.inspectDiscardAria', { name: getFantasyRealmsCardDisplayName(card) })}
                    >
                        {renderCard(card, t, locale)}
                    </button>
                ))}
            </div>
        </section>
    );

    const handZoneSection = (
        <section className="fr-zone" aria-label={t('zone.hand.ariaLabel')}>
            <div className="fr-zone-header">
                <div className="fr-zone-title">
                    {isSpectatorView && !isGameOver ? t('zone.hand.titleSpectator') : t('zone.hand.title', { player: viewerPlayerName })}
                </div>
                {isSpectatorView && !isGameOver ? null : (
                    <div className={`fr-zone-hint${canDiscard ? ' fr-zone-hint--active' : ''}`}>
                        {`${viewerHandCards.length}/${FANTASY_REALMS_HAND_CARD_SLOTS}`}
                    </div>
                )}
            </div>
            <div className="fr-card-row-wrap">
                <div
                    className="fr-card-row"
                    data-testid="fantasyrealms-hand-row"
                    data-slot-count={handSlotCount}
                    style={handRowOverflowStyle}
                >
                    {handCardSlots.map((slot) => slot.card ? (
                        <button
                            key={slot.key}
                            type="button"
                            className={`fr-card-button${core.focusCardId === slot.card!.id ? ' fr-card-button--selected' : ''}${canDiscard ? ' fr-card-button--actionable' : ''}`}
                            onClick={() => handleHandCardClick(slot.card!.id)}
                            data-action-state={canDiscard ? 'discard' : 'inspect'}
                            aria-label={canDiscard
                                ? t('actions.discardHandAria', { name: getFantasyRealmsCardDisplayName(slot.card) })
                                : t('actions.inspectHandAria', { name: getFantasyRealmsCardDisplayName(slot.card) })}
                        >
                            {renderCard(slot.card, t, locale)}
                        </button>
                    ) : (
                        <div
                            key={slot.key}
                            className="fr-card-slot"
                            data-testid="fantasyrealms-card-slot-empty"
                            aria-hidden="true"
                        />
                    ))}
                </div>
                {viewerHandCards.length === 0 ? (
                    <div className="fr-card-row-note" data-testid="fantasyrealms-hand-empty-note">
                        {t('zone.hand.emptyCompact')}
                    </div>
                ) : null}
            </div>
        </section>
    );

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

    const progressPanelSection = (
        <section className="fr-panel">
            <div className="fr-panel-header">{t('progress.panelTitle')}</div>
            <div className="fr-panel-body fr-focus-panel">
                <div className="fr-progress-head">
                    <span>{isDuelVariant(core) ? t('progress.duelThreshold') : t('progress.standardThreshold')}</span>
                    <strong>{core.discardPile.length} / {discardThreshold}</strong>
                </div>
                <div className="fr-progress-track">
                    <div className="fr-progress-fill" style={{ width: `${discardProgress * 100}%` }} />
                </div>
                {isGameOver ? (
                    <div className="fr-endgame-summary">
                        <div className="fr-combo-item">
                            {gameOver?.draw
                                ? t('progress.gameOverDraw')
                                : t('progress.gameOverWinner', { winner: winnerName ?? t('fallback.unknownPlayer') })}
                        </div>
                        <div className="fr-endgame-title">
                            <span>{t('progress.finalStandings')}</span>
                            {gameOver?.draw ? <i className="fr-score-badge">{t('progress.drawBadge')}</i> : null}
                        </div>
                        <div className="fr-endgame-list" aria-label={t('progress.finalStandings')}>
                            {finalStandings.map((player, index) => (
                                <div key={player.id} className="fr-endgame-row">
                                    <div className="fr-endgame-rank">{t('progress.rank', { rank: index + 1 })}</div>
                                    <div className="fr-endgame-name">
                                        <span>{player.name}</span>
                                        {player.isWinner ? <i className="fr-score-badge">{t('score.badges.winner')}</i> : null}
                                    </div>
                                    <div className="fr-endgame-score">{player.score}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );

    const minimalLiveTopbarSection = !isGameOver ? (
        <div className="fr-live-topbar" data-testid="fantasyrealms-live-topbar">
            <button
                type="button"
                className={`fr-live-deck${canDrawFromDeck ? ' fr-live-deck--enabled' : ''}`}
                data-testid="fantasyrealms-live-deck"
                aria-label={getDrawDeckLabel(core, t)}
                onClick={handleDeckStackClick}
                disabled={!canDrawFromDeck}
            >
                <div className="fr-live-deck-stack">
                    <div className="fr-stack-card fr-stack-card--under" style={deckBackStyle} aria-hidden="true" />
                    <div className="fr-stack-card fr-stack-card--mid" style={deckBackStyle} aria-hidden="true" />
                    <div className="fr-stack-card fr-stack-card--top" style={deckBackStyle} aria-hidden="true" />
                    <strong className="fr-live-deck-count">{core.drawPile.length}</strong>
                </div>
            </button>
            <div className="fr-live-status-strip" data-testid="fantasyrealms-live-status-strip">
                <div className={`fr-live-chip fr-live-chip--turn${isMyTurn ? ' fr-live-chip--turn-active' : ''}`}>
                    {isMyTurn ? t('turn.live.selfTurn') : currentPlayerName}
                </div>
                <div className="fr-live-chip fr-live-chip--round">
                    {t('turn.short.round', { turn: core.turn })}
                </div>
                <div className="fr-live-chip fr-live-chip--progress" aria-label={t('progress.panelTitle')}>
                    {discardCards.length}/{discardThreshold}
                </div>
                {compactTurnStateLabel ? (
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
                            <span className="fr-live-score-band-rank">
                                {t('score.hiddenLabel')}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    const shouldShowMinimalLiveAction = isMyTurn
        && !isGameOver
        && (Boolean(selectedHandCard) || Boolean(selectedDiscardCard));

    const minimalLiveActionZoneSection = shouldShowMinimalLiveAction ? (
        <div
            className="fr-live-action-zone"
            data-anchor="bottom-right"
            data-testid="fantasyrealms-live-action-zone"
        >
            <button
                type="button"
                className={`fr-live-action-button${isLivePrimaryActionDisabled ? '' : ' fr-live-action-button--enabled'}`}
                onClick={handleLivePrimaryAction}
                disabled={isLivePrimaryActionDisabled}
                data-testid="fantasyrealms-live-action-button"
            >
                <span className="fr-live-action-button-label">{livePrimaryActionLabel}</span>
            </button>
        </div>
    ) : null;

    const minimalLiveDiscardZoneSection = (
        <section
            className={`fr-live-river${liveMotionCue?.type === 'hand-to-river' ? ' fr-live-river--motion-receive' : ''}`}
            aria-label={t('zone.discard.title')}
            data-motion={liveMotionCue?.type === 'hand-to-river' ? 'hand-to-river' : 'idle'}
            data-testid="fantasyrealms-live-river"
        >
            <div
                className={`fr-discard-row fr-discard-row--live-river${discardCards.length === 0 ? ' fr-discard-row--empty' : ''}${discardCards.length > 0 ? ' fr-discard-row--table-river' : ''}`}
                data-testid="fantasyrealms-discard-row"
            >
                {discardCards.length === 0 ? (
                    <div className="fr-zone-empty fr-zone-empty--silent" data-testid="fantasyrealms-discard-empty" aria-hidden="true" />
                ) : discardCards.map((card, index) => (
                    <button
                        key={card.id}
                        type="button"
                        className={`fr-card-button fr-card-button--live-river${core.focusCardId === card.id ? ' fr-card-button--selected' : ''}${canTakeDiscard ? ' fr-card-button--actionable' : ''}${pendingDiscardSelectionId === card.id ? ' fr-card-button--armed' : ''}`}
                        onClick={() => handleDiscardPileClick(card.id)}
                        style={minimalLiveRiverCardStyles[index]}
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
            className={`fr-live-handband${liveMotionCue?.type === 'draw-to-hand' ? ' fr-live-handband--motion-draw' : ''}${liveMotionCue?.type === 'discard-to-hand' ? ' fr-live-handband--motion-take' : ''}`}
            aria-label={t('zone.hand.ariaLabel')}
            data-motion={liveMotionCue?.type === 'draw-to-hand' || liveMotionCue?.type === 'discard-to-hand' ? liveMotionCue.type : 'idle'}
            data-testid="fantasyrealms-live-handband"
        >
            <div className="fr-card-row-wrap">
                <div
                    className="fr-card-row fr-card-row--table-band"
                    data-testid="fantasyrealms-hand-row"
                    data-slot-count={handSlotCount}
                    data-visible-count={viewerHandCards.length}
                    style={handRowOverflowStyle}
                >
                    {viewerHandCards.map((card, index) => (
                        <button
                            key={`live-hand-${card.id}`}
                            type="button"
                            className={`fr-card-button fr-card-button--live-hand${core.focusCardId === card.id ? ' fr-card-button--selected' : ''}${canDiscard ? ' fr-card-button--actionable' : ''}${pendingHandSelectionId === card.id ? ' fr-card-button--armed' : ''}`}
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
                    ))}
                </div>
            </div>
        </section>
    );

    const minimalLiveEndgameSection = isGameOver ? (
        <section className="fr-live-endgame" data-testid="fantasyrealms-live-endgame">
            <div className="fr-live-endgame-header">{t('turn.reviewChip')}</div>
            <div className="fr-live-endgame-grid">
                <section className="fr-live-endgame-focus-block" aria-label={t('focus.panelTitle')}>
                    <div className="fr-live-endgame-section-title">{t('focus.panelTitle')}</div>
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
                            <div className="fr-focus-name">{focusName}</div>
                            <div className="fr-focus-score">
                                <span>{t('focus.estimatedDelta')}</span>
                                <strong>{focusEstimatedDelta}</strong>
                            </div>
                        </article>
                    </div>
                </section>
                <section className="fr-live-endgame-summary-block">
                    <div className="fr-live-endgame-section-title">
                        <span>{t('progress.finalStandings')}</span>
                        {gameOver?.draw ? <i className="fr-score-badge">{t('progress.drawBadge')}</i> : null}
                    </div>
                    <div className="fr-endgame-summary">
                        <div className="fr-combo-item">
                            {gameOver?.draw
                                ? t('progress.gameOverDraw')
                                : t('progress.gameOverWinner', { winner: winnerName ?? t('fallback.unknownPlayer') })}
                        </div>
                        <div className="fr-endgame-list" aria-label={t('progress.finalStandings')}>
                            {finalStandings.map((player, index) => (
                                <div key={player.id} className="fr-endgame-row">
                                    <div className="fr-endgame-rank">{t('progress.rank', { rank: index + 1 })}</div>
                                    <div className="fr-endgame-name">
                                        <span>{player.name}</span>
                                        {player.isWinner ? <i className="fr-score-badge">{t('score.badges.winner')}</i> : null}
                                    </div>
                                    <div className="fr-endgame-score">{player.score}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </section>
    ) : null;

    return (
        <div className="fr-root">
            <style>{`
                .fr-root {
                    min-height: 100%;
                    overflow-y: auto;
                    padding: 14px;
                    color: #f2ead7;
                    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
                    background:
                        radial-gradient(circle at 4% 74%, rgba(255, 188, 84, 0.22), transparent 10%),
                        radial-gradient(circle at 95% 24%, rgba(219, 146, 53, 0.18), transparent 13%),
                        linear-gradient(90deg, rgba(5, 8, 7, 0.72), transparent 18%, transparent 82%, rgba(5, 8, 7, 0.72)),
                        repeating-linear-gradient(90deg, rgba(255, 213, 137, 0.034) 0 1px, transparent 1px 20px),
                        linear-gradient(90deg, #100b08, #5b3419 50%, #100a07);
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
                    padding: 20px 30px 24px;
                    border-radius: 24px;
                    background:
                        radial-gradient(circle at 4% 78%, rgba(255, 178, 70, 0.26), transparent 11%),
                        radial-gradient(circle at 96% 18%, rgba(221, 146, 53, 0.22), transparent 13%),
                        radial-gradient(ellipse at 50% -6%, rgba(178, 103, 43, 0.5), transparent 34%),
                        radial-gradient(ellipse at 50% 106%, rgba(10, 4, 2, 0.64), transparent 34%),
                        repeating-linear-gradient(90deg, rgba(255, 225, 165, 0.052) 0 1px, transparent 1px 18px),
                        linear-gradient(90deg, #0d0805, #6a3d1d 18%, #3b210f 50%, #6a3d1d 82%, #0d0805);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 223, 156, 0.12),
                        inset 0 0 0 10px rgba(19, 10, 5, 0.34),
                        inset 0 0 78px rgba(0, 0, 0, 0.58),
                        0 22px 52px rgba(0, 0, 0, 0.5);
                }
                .fr-board--minimal-live::before {
                    content: "";
                    position: absolute;
                    inset: 22px 32px 26px;
                    border-radius: 20px;
                    background:
                        radial-gradient(ellipse at 50% 16%, rgba(152, 214, 174, 0.22), transparent 34%),
                        radial-gradient(ellipse at 50% 74%, rgba(0, 10, 8, 0.46), transparent 54%),
                        radial-gradient(circle at 9% 87%, rgba(236, 157, 61, 0.1), transparent 18%),
                        radial-gradient(circle at 93% 12%, rgba(236, 157, 61, 0.08), transparent 18%),
                        linear-gradient(90deg, rgba(255, 240, 190, 0.08), transparent 8%, transparent 92%, rgba(0, 0, 0, 0.28)),
                        repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.022) 0 1px, transparent 1px 12px),
                        repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.028) 0 1px, transparent 1px 6px),
                        linear-gradient(180deg, #16483b, #0d332b 56%, #08241f);
                    box-shadow:
                        inset 0 0 0 1px rgba(238, 196, 108, 0.28),
                        inset 0 0 0 3px rgba(2, 15, 12, 0.42),
                        inset 0 0 0 14px rgba(10, 40, 33, 0.28),
                        inset 0 44px 96px rgba(255, 246, 210, 0.035),
                        inset 0 -96px 150px rgba(0, 0, 0, 0.34);
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
                    grid-template-rows: 98px minmax(0, 1fr) 292px;
                    gap: 8px;
                    height: 100%;
                    min-height: 0;
                }
                .fr-live-table--gameover {
                    grid-template-rows: minmax(0, 1fr) 292px auto;
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
                    min-height: 96px;
                }
                .fr-live-topbar::before {
                    display: none;
                }
                .fr-live-topbar::after {
                    display: none;
                }
                .fr-live-status-strip {
                    position: absolute;
                    left: 50%;
                    top: 18px;
                    transform: translateX(-50%);
                    display: inline-flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                    isolation: isolate;
                }
                .fr-live-status-strip::before {
                    content: "";
                    position: absolute;
                    inset: -10px -22px;
                    border-radius: 18px;
                    background:
                        radial-gradient(ellipse at 50% 0%, rgba(255, 226, 152, 0.16), transparent 44%),
                        linear-gradient(180deg, rgba(56, 36, 22, 0.98), rgba(10, 11, 10, 0.98));
                    box-shadow:
                        0 20px 28px rgba(0, 0, 0, 0.34),
                        inset 0 0 0 1px rgba(240, 190, 92, 0.28),
                        inset 0 0 0 4px rgba(17, 12, 9, 0.38),
                        inset 0 2px 0 rgba(255, 241, 199, 0.08);
                    z-index: -1;
                    pointer-events: none;
                }
                .fr-live-deck {
                    position: absolute;
                    left: 0;
                    top: 2px;
                    display: inline-flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    cursor: default;
                }
                .fr-live-deck::before {
                    content: "";
                    position: absolute;
                    left: -10px;
                    top: -8px;
                    width: 114px;
                    height: 128px;
                    border-radius: 16px;
                    background:
                        radial-gradient(ellipse at 42% 20%, rgba(255, 220, 142, 0.12), transparent 36%),
                        linear-gradient(180deg, rgba(58, 36, 20, 0.5), rgba(10, 10, 9, 0.08));
                    box-shadow:
                        0 24px 34px rgba(0, 0, 0, 0.42),
                        inset 0 0 0 1px rgba(255, 226, 164, 0.1);
                    pointer-events: none;
                }
                .fr-live-deck::after {
                    content: "";
                    position: absolute;
                    left: 5px;
                    top: 9px;
                    width: 76px;
                    height: 104px;
                    border-radius: 14px;
                    box-shadow:
                        8px 8px 0 rgba(52, 25, 13, 0.42),
                        13px 13px 0 rgba(12, 8, 6, 0.34);
                    pointer-events: none;
                }
                .fr-live-deck--enabled {
                    cursor: pointer;
                }
                .fr-live-deck-stack {
                    position: relative;
                    z-index: 1;
                    width: 76px;
                    height: 104px;
                    border-radius: 14px;
                    flex: 0 0 auto;
                    filter:
                        drop-shadow(0 20px 26px rgba(0, 0, 0, 0.34))
                        drop-shadow(0 3px 0 rgba(255, 226, 168, 0.08));
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
                    min-width: 50px;
                    height: 40px;
                    padding: 0 12px;
                    font-size: 34px;
                    line-height: 1;
                    color: #ffe1a0;
                    border-radius: 14px;
                    border: 1px solid rgba(235, 190, 96, 0.72);
                    background:
                        radial-gradient(circle at 36% 20%, rgba(255, 234, 174, 0.18), transparent 40%),
                        linear-gradient(180deg, rgba(48, 32, 21, 0.99), rgba(8, 8, 7, 0.99));
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.14),
                        inset 0 -14px 20px rgba(0, 0, 0, 0.32),
                        0 14px 24px rgba(0, 0, 0, 0.38);
                    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.34);
                }
                .fr-live-chip {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 48px;
                    padding: 0 20px;
                    border-radius: 14px;
                    border: 1px solid rgba(231, 184, 92, 0.74);
                    background:
                        radial-gradient(circle at 50% 0%, rgba(255, 231, 168, 0.18), transparent 40%),
                        linear-gradient(180deg, rgba(64, 41, 24, 0.99), rgba(10, 11, 10, 0.99));
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,0.16),
                        inset 0 -14px 24px rgba(0, 0, 0, 0.36),
                        0 14px 26px rgba(0,0,0,0.38);
                    color: #ffe4a6;
                    font-weight: 800;
                    line-height: 1;
                    white-space: nowrap;
                    text-shadow: 0 3px 10px rgba(0, 0, 0, 0.24);
                    overflow: hidden;
                }
                .fr-live-chip::before {
                    content: "";
                    position: absolute;
                    inset: 4px 7px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 236, 188, 0.14);
                    box-shadow: inset 0 1px 0 rgba(255, 250, 220, 0.04);
                    pointer-events: none;
                }
                .fr-live-chip--turn {
                    min-width: 128px;
                    font-size: 24px;
                    padding: 0 22px;
                    background:
                        radial-gradient(circle at 50% 0%, rgba(255, 231, 168, 0.24), transparent 42%),
                        linear-gradient(180deg, rgba(94, 58, 25, 0.99), rgba(19, 14, 10, 0.99));
                }
                .fr-live-chip--turn-active {
                    min-width: 152px;
                }
                .fr-live-chip--round {
                    min-height: 34px;
                    padding: 0 14px;
                    font-size: 13px;
                    font-weight: 700;
                    color: rgba(255, 237, 197, 0.84);
                    border-color: rgba(207, 174, 116, 0.34);
                    background:
                        radial-gradient(circle at 50% 0%, rgba(255, 231, 168, 0.12), transparent 42%),
                        linear-gradient(180deg, rgba(29, 29, 22, 0.98), rgba(7, 8, 7, 0.99));
                }
                .fr-live-chip--progress {
                    min-width: 96px;
                    font-size: 24px;
                    padding: 0 20px;
                    background:
                        radial-gradient(circle at 50% 0%, rgba(255, 231, 168, 0.18), transparent 42%),
                        linear-gradient(180deg, rgba(102, 45, 31, 0.98), rgba(35, 17, 14, 0.99));
                }
                .fr-live-chip--cue {
                    min-height: 40px;
                    padding: 0 18px;
                    font-size: 18px;
                    border-color: rgba(191, 162, 109, 0.34);
                    background:
                        radial-gradient(circle at 50% 0%, rgba(105, 179, 153, 0.16), transparent 42%),
                        linear-gradient(180deg, rgba(20, 63, 57, 0.98), rgba(9, 29, 27, 0.99));
                    color: rgba(255, 242, 207, 0.92);
                }
                .fr-live-score-strip {
                    position: absolute;
                    top: 2px;
                    right: 0;
                    width: 312px;
                }
                .fr-live-score-band {
                    position: relative;
                    height: 100px;
                    padding: 14px 20px 12px;
                    border-radius: 6px;
                    border: 1px solid rgba(218, 174, 84, 0.76);
                    background:
                        radial-gradient(circle at 16% 0%, rgba(255, 226, 158, 0.2), transparent 36%),
                        radial-gradient(circle at 84% 100%, rgba(124, 72, 28, 0.22), transparent 42%),
                        linear-gradient(180deg, rgba(48, 34, 20, 0.99), rgba(5, 5, 5, 0.99));
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,0.14),
                        inset 0 -20px 32px rgba(0, 0, 0, 0.42),
                        0 18px 30px rgba(0,0,0,0.44),
                        0 0 22px rgba(237, 183, 88, 0.08);
                }
                .fr-live-score-band::before {
                    content: "";
                    position: absolute;
                    inset: 8px 10px;
                    border-radius: 3px;
                    border: 1px solid rgba(255, 229, 169, 0.14);
                    box-shadow:
                        -5px -5px 0 -4px rgba(255, 221, 145, 0.7),
                        5px -5px 0 -4px rgba(255, 221, 145, 0.7),
                        -5px 5px 0 -4px rgba(255, 221, 145, 0.7),
                        5px 5px 0 -4px rgba(255, 221, 145, 0.7);
                    pointer-events: none;
                }
                .fr-live-score-band::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    background:
                        linear-gradient(90deg, rgba(232, 178, 84, 0.3), transparent 12%, transparent 88%, rgba(232, 178, 84, 0.3)),
                        linear-gradient(180deg, rgba(255, 238, 183, 0.08), transparent 24%, transparent 76%, rgba(0, 0, 0, 0.18));
                    mix-blend-mode: screen;
                    opacity: 0.34;
                    pointer-events: none;
                }
                .fr-live-score-band-kicker {
                    position: relative;
                    z-index: 1;
                    color: rgba(246, 223, 180, 0.72);
                    font-size: 11px;
                    line-height: 1;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                }
                .fr-live-score-band-main {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 12px;
                    margin-top: 16px;
                }
                .fr-live-score-band-total {
                    color: #ffe4a4;
                    font-family: Georgia, "Times New Roman", "Microsoft YaHei", serif;
                    font-size: 42px;
                    font-weight: 900;
                    line-height: 1;
                    text-shadow: 0 4px 14px rgba(0, 0, 0, 0.34);
                }
                .fr-live-river,
                .fr-live-handband {
                    position: relative;
                    z-index: 1;
                    overflow: visible;
                    border-radius: 0;
                    background: transparent;
                    border: none;
                }
                .fr-live-river {
                    display: grid;
                    align-items: center;
                    padding-top: 0;
                }
                .fr-live-river::before {
                    content: "";
                    position: absolute;
                    left: 10%;
                    right: 10%;
                    top: 50px;
                    bottom: 74px;
                    border-radius: 42%;
                    background:
                        radial-gradient(ellipse at 50% 42%, rgba(255, 233, 178, 0.08), transparent 54%),
                        radial-gradient(ellipse at 50% 74%, rgba(0, 0, 0, 0.28), transparent 68%);
                    filter: blur(2px);
                    pointer-events: none;
                }
                .fr-live-handband {
                    display: grid;
                    align-items: end;
                    padding-top: 0;
                }
                .fr-live-river::after {
                    display: none;
                }
                .fr-live-handband::before {
                    content: "";
                    position: absolute;
                    left: 3%;
                    right: 7%;
                    bottom: 8px;
                    height: 104px;
                    border-radius: 50%;
                    background:
                        radial-gradient(ellipse at 50% 62%, rgba(0, 0, 0, 0.34), transparent 66%),
                        linear-gradient(180deg, transparent, rgba(255, 215, 143, 0.035));
                    pointer-events: none;
                }
                .fr-live-handband::after {
                    display: none;
                }
                .fr-live-endgame {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    gap: 14px;
                    padding: 14px 10px 2px;
                }
                .fr-live-endgame-header {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    color: rgba(242, 234, 215, 0.8);
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .fr-live-endgame-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
                    gap: 14px;
                    align-items: start;
                }
                .fr-live-endgame-focus-block,
                .fr-live-endgame-summary-block {
                    display: grid;
                    gap: 10px;
                    padding: 14px;
                    border-radius: 18px;
                    border: 1px solid rgba(255, 228, 179, 0.12);
                    background:
                        linear-gradient(180deg, rgba(25, 37, 31, 0.94), rgba(16, 24, 20, 0.96));
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 239, 197, 0.04),
                        0 18px 30px rgba(0, 0, 0, 0.22);
                }
                .fr-live-endgame-section-title {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: rgba(242, 234, 215, 0.66);
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .fr-discard-row--live-river {
                    position: relative;
                    display: block;
                    width: min(1240px, 72vw);
                    min-height: 446px;
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
                .fr-card-button--live-river {
                    position: absolute;
                    width: 190px;
                }
                .fr-card-button--live-river .fr-card {
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
                .fr-card-button--live-river.fr-card-button--actionable .fr-card,
                .fr-card-button--live-hand.fr-card-button--actionable .fr-card {
                    transform: none;
                }
                .fr-card-button--live-river.fr-card-button--actionable .fr-card {
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
                .fr-card-button--live-river:nth-child(1) { left: calc(50% - 595px); top: 2px; z-index: 1; }
                .fr-card-button--live-river:nth-child(2) { left: calc(50% - 335px); top: 2px; z-index: 1; }
                .fr-card-button--live-river:nth-child(3) { left: calc(50% - 75px); top: 2px; z-index: 1; }
                .fr-card-button--live-river:nth-child(4) { left: calc(50% + 185px); top: 2px; z-index: 1; }
                .fr-card-button--live-river:nth-child(5) { left: calc(50% + 445px); top: 2px; z-index: 1; }
                .fr-card-button--live-river:nth-child(6) { left: calc(50% - 465px); top: 182px; z-index: 2; }
                .fr-card-button--live-river:nth-child(7) { left: calc(50% - 205px); top: 182px; z-index: 2; }
                .fr-card-button--live-river:nth-child(8) { left: calc(50% + 55px); top: 182px; z-index: 2; }
                .fr-card-button--live-river:nth-child(9) { left: calc(50% + 315px); top: 182px; z-index: 2; }
                .fr-card-button--live-river:nth-child(10) { left: calc(50% + 445px); top: 182px; z-index: 2; }
                .fr-card-button--live-river:nth-child(6):nth-last-child(5) { left: calc(50% - 595px); }
                .fr-card-button--live-river:nth-child(7):nth-last-child(4) { left: calc(50% - 335px); }
                .fr-card-button--live-river:nth-child(8):nth-last-child(3) { left: calc(50% - 75px); }
                .fr-card-button--live-river:nth-child(9):nth-last-child(2) { left: calc(50% + 185px); }
                .fr-card-button--live-river:nth-child(10):nth-last-child(1) { left: calc(50% + 445px); }
                .fr-live-handband .fr-card-row-wrap {
                    position: relative;
                    padding: 0;
                    gap: 0;
                }
                .fr-live-handband .fr-card-row--table-band {
                    position: relative;
                    z-index: 1;
                    width: min(1652px, calc(100vw - 316px));
                    margin: 0 172px 0 auto;
                    grid-template-columns: repeat(7, minmax(0, 234px));
                    justify-content: center;
                    gap: 0;
                }
                .fr-card-button--live-hand {
                    position: relative;
                    transform: none;
                    width: 100%;
                    max-width: 234px;
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
                /* 主动作固定在右侧中段操作坞，贴近公共区/手牌确认循环，同时避开右下 HUD 浮球。 */
                .fr-live-action-zone {
                    position: fixed;
                    right: clamp(38px, 2.7vw, 64px);
                    top: clamp(476px, 47.6vh, 526px);
                    z-index: 4;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 176px;
                    height: 104px;
                    min-height: 104px;
                    pointer-events: none;
                }
                .fr-live-action-button {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 176px;
                    height: 104px;
                    padding: 18px 22px;
                    border-radius: 18px;
                    border: 1px solid rgba(226, 184, 96, 0.82);
                    background:
                        radial-gradient(circle at 50% 12%, rgba(255, 236, 178, 0.16), transparent 36%),
                        linear-gradient(180deg, rgba(64, 42, 24, 0.99), rgba(12, 11, 10, 0.99));
                    color: #ffe7af;
                    text-align: center;
                    box-shadow:
                        0 28px 42px rgba(0,0,0,0.48),
                        inset 0 1px 0 rgba(255,255,255,0.12),
                        inset 0 -20px 28px rgba(0, 0, 0, 0.34),
                        0 0 0 4px rgba(20, 13, 8, 0.24);
                    pointer-events: auto;
                    cursor: default;
                    overflow: hidden;
                    transition:
                        box-shadow 140ms ease,
                        background 140ms ease,
                        color 140ms ease;
                }
                .fr-live-action-button::before {
                    content: "";
                    position: absolute;
                    inset: 6px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 225, 160, 0.16);
                    box-shadow:
                        -6px -6px 0 -5px rgba(255, 225, 160, 0.68),
                        6px -6px 0 -5px rgba(255, 225, 160, 0.68),
                        -6px 6px 0 -5px rgba(255, 225, 160, 0.68),
                        6px 6px 0 -5px rgba(255, 225, 160, 0.68);
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
                    max-width: 124px;
                    font-size: clamp(20px, 1.12vw, 24px);
                    font-weight: 900;
                    line-height: 1.1;
                    letter-spacing: 0;
                    white-space: normal;
                    word-break: keep-all;
                }
                .fr-live-action-button--enabled {
                    background:
                        radial-gradient(circle at 50% 10%, rgba(255, 239, 190, 0.2), transparent 34%),
                        linear-gradient(180deg, rgba(76, 49, 28, 0.99), rgba(14, 13, 11, 0.99));
                    color: #ffecb9;
                    box-shadow:
                        0 30px 46px rgba(0,0,0,0.5),
                        inset 0 1px 0 rgba(255,255,255,0.16),
                        inset 0 -22px 32px rgba(0, 0, 0, 0.34),
                        0 0 0 4px rgba(20, 13, 8, 0.24);
                    cursor: pointer;
                }
                .fr-live-action-button--enabled:hover {
                    transform: none;
                    box-shadow:
                        0 32px 48px rgba(0,0,0,0.38),
                        inset 0 1px 0 rgba(255,255,255,0.18),
                        inset 0 -18px 28px rgba(0, 0, 0, 0.28);
                }
                .fr-live-action-button--enabled:active {
                    transform: none;
                }
                .fr-live-action-button:focus-visible,
                .fr-live-deck--enabled:focus-visible {
                    outline: 2px solid rgba(255, 238, 201, 0.92);
                    outline-offset: 4px;
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
                    grid-template-rows: 132px minmax(0, 1fr) 326px;
                    gap: 0;
                }
                .fr-board--minimal-live .fr-live-topbar {
                    min-height: 128px;
                }
                .fr-board--minimal-live .fr-live-status-strip {
                    top: 28px;
                    gap: 16px;
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
                .fr-board--minimal-live .fr-live-chip::before {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-chip--turn {
                    min-width: 106px;
                    font-size: 20px;
                    padding: 0 4px;
                    background: transparent;
                    color: #ffe6aa;
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
                    top: 24px;
                    left: 52px;
                    gap: 0;
                }
                .fr-board--minimal-live .fr-live-deck::before,
                .fr-board--minimal-live .fr-live-deck::after {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-deck-stack {
                    width: 122px;
                    height: 168px;
                    border-radius: 12px;
                    filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.34));
                }
                .fr-board--minimal-live .fr-live-deck-stack .fr-stack-card {
                    border-radius: 12px;
                }
                .fr-board--minimal-live .fr-live-deck-count {
                    position: absolute;
                    right: 8px;
                    bottom: 10px;
                    transform: none;
                    z-index: 3;
                    min-width: 42px;
                    height: 32px;
                    padding: 0 9px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 229, 166, 0.34);
                    background: rgba(10, 14, 11, 0.82);
                    box-shadow:
                        0 8px 14px rgba(0, 0, 0, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.12);
                    color: #f6dfaa;
                    font-size: 24px;
                    text-shadow: none;
                }
                .fr-board--minimal-live .fr-live-score-strip {
                    top: 28px;
                    right: 36px;
                    width: 156px;
                }
                .fr-board--minimal-live .fr-live-score-band {
                    height: 42px;
                    padding: 0;
                    border-radius: 0;
                    border: none;
                    background: transparent;
                    box-shadow: none;
                }
                .fr-board--minimal-live .fr-live-score-band::before,
                .fr-board--minimal-live .fr-live-score-band::after {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-score-band-kicker {
                    color: rgba(246, 223, 180, 0.48);
                    font-size: 10px;
                    letter-spacing: 0;
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
                    text-shadow: none;
                }
                .fr-board--minimal-live .fr-live-river::before {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-handband::before {
                    display: none;
                }
                .fr-board--minimal-live .fr-discard-row--live-river {
                    width: min(1230px, 74vw);
                    min-height: 408px;
                    transform: translateY(18px);
                }
                .fr-board--minimal-live .fr-discard-row--empty {
                    min-height: 0;
                }
                .fr-board--minimal-live .fr-zone-empty--silent {
                    display: none;
                }
                .fr-board--minimal-live .fr-card-button--live-river {
                    width: 190px;
                }
                .fr-board--minimal-live .fr-card-button--live-river .fr-card,
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
                .fr-board--minimal-live .fr-card-button--live-river.fr-card-button--actionable .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand.fr-card-button--actionable .fr-card {
                    border-color: rgba(255, 238, 201, 0.64);
                    box-shadow:
                        0 14px 18px rgba(0, 0, 0, 0.26),
                        0 0 0 1px rgba(255, 243, 213, 0.1);
                }
                .fr-board--minimal-live .fr-card-button--live-river.fr-card-button--actionable:hover .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand.fr-card-button--actionable:hover .fr-card {
                    transform: translateY(-8px);
                    border-color: rgba(255, 241, 203, 0.86);
                    box-shadow:
                        0 22px 30px rgba(0, 0, 0, 0.34),
                        0 0 0 2px rgba(255, 224, 145, 0.18);
                }
                .fr-board--minimal-live .fr-card-button--live-river:active .fr-card,
                .fr-board--minimal-live .fr-card-button--live-hand:active .fr-card {
                    transform: translateY(-2px) scale(0.99);
                }
                .fr-board--minimal-live .fr-card-button--live-river:focus-visible,
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
                .fr-board--minimal-live .fr-live-handband--motion-draw .fr-card-button--live-hand .fr-card {
                    animation: fr-live-hand-arrive-from-deck 1200ms cubic-bezier(0.18, 0.9, 0.22, 1) both;
                }
                .fr-board--minimal-live .fr-live-handband--motion-take .fr-card-button--live-hand .fr-card {
                    animation: fr-live-hand-arrive-from-river 1000ms cubic-bezier(0.18, 0.9, 0.22, 1) both;
                }
                .fr-board--minimal-live .fr-live-river--motion-receive .fr-card-button--live-river .fr-card {
                    animation: fr-live-river-receive-discard 1200ms cubic-bezier(0.18, 0.9, 0.22, 1) both;
                }
                @keyframes fr-live-hand-arrive-from-deck {
                    0% {
                        opacity: 0.18;
                        transform: translate(-620px, -540px) scale(0.82) rotate(-5deg);
                    }
                    58% {
                        opacity: 1;
                        transform: translate(-18px, -18px) scale(1.02) rotate(-1deg);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1) rotate(0deg);
                    }
                }
                @keyframes fr-live-hand-arrive-from-river {
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
                @keyframes fr-live-river-receive-discard {
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
                .fr-board--minimal-live .fr-live-handband .fr-card-row--table-band {
                    width: min(1540px, calc(100vw - 260px));
                    margin: 0 auto;
                    grid-template-columns: repeat(var(--fr-live-hand-slots, 7), minmax(0, 1fr));
                    justify-content: center;
                    gap: 0;
                    transform: translateY(-18px);
                }
                .fr-board--minimal-live .fr-card-button--live-hand {
                    width: 100%;
                    max-width: none;
                }
                .fr-board--minimal-live .fr-live-action-zone {
                    right: clamp(96px, 6.2vw, 132px);
                    top: auto;
                    bottom: clamp(224px, 22vh, 254px);
                    width: 178px;
                    height: 68px;
                    min-height: 68px;
                }
                .fr-board--minimal-live .fr-live-action-button {
                    width: 178px;
                    height: 68px;
                    padding: 10px 18px;
                    border-radius: 8px;
                    border-color: rgba(247, 205, 122, 0.42);
                    background: rgba(50, 36, 20, 0.9);
                    box-shadow:
                        0 12px 20px rgba(0, 0, 0, 0.28),
                        inset 0 1px 0 rgba(255, 239, 185, 0.12);
                    color: #ffe8ad;
                    opacity: 0.88;
                }
                .fr-board--minimal-live .fr-live-action-button::before,
                .fr-board--minimal-live .fr-live-action-button::after {
                    display: none;
                }
                .fr-board--minimal-live .fr-live-action-button-label {
                    max-width: 142px;
                    font-size: 20px;
                    line-height: 1.05;
                }
                .fr-board--minimal-live .fr-live-action-button--enabled {
                    background: rgba(126, 75, 24, 0.96);
                    box-shadow:
                        0 16px 24px rgba(0, 0, 0, 0.34),
                        inset 0 1px 0 rgba(255, 239, 185, 0.2);
                    opacity: 1;
                }
                .fr-board--minimal-live .fr-live-action-button--enabled:hover {
                    transform: translateY(-2px);
                    box-shadow:
                        0 18px 26px rgba(0, 0, 0, 0.34),
                        inset 0 1px 0 rgba(255, 239, 185, 0.2);
                }
                .fr-board--minimal-live .fr-live-action-button--enabled:active {
                    transform: translateY(1px);
                    box-shadow:
                        0 8px 14px rgba(0, 0, 0, 0.28),
                        inset 0 2px 5px rgba(0, 0, 0, 0.22);
                }
                .fr-board--minimal-live .fr-live-deck--enabled:active .fr-live-deck-stack {
                    transform: translateY(1px) scale(0.99);
                    filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.28));
                }
                @media (prefers-reduced-motion: reduce) {
                    .fr-board--minimal-live .fr-card-button--live-river .fr-card,
                    .fr-board--minimal-live .fr-card-button--live-hand .fr-card,
                    .fr-board--minimal-live .fr-live-action-button,
                    .fr-board--minimal-live .fr-live-deck-stack {
                        transition: none;
                        animation: none;
                    }
                    .fr-board--minimal-live .fr-card-button--live-river.fr-card-button--actionable:hover .fr-card,
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
                .fr-stacked-turn-panel {
                    margin-bottom: 14px;
                }
                .fr-stacked-layout {
                    display: grid;
                    gap: 18px;
                }
                .fr-stacked-layout--compact-landscape {
                    gap: 12px;
                }
                .fr-stacked-insight-grid,
                .fr-stacked-support-grid {
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
                .fr-stack--deck-compact {
                    aspect-ratio: auto;
                    min-height: 120px;
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
                .fr-stack-label {
                    position: absolute;
                    left: 12px;
                    right: 12px;
                    bottom: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    border-radius: 10px;
                    font-size: 13px;
                    color: #f2ead7;
                    background: rgba(18, 24, 21, 0.72);
                }
                .fr-count {
                    color: #f2ead7;
                    font-weight: 700;
                }
                .fr-chip-list {
                    display: grid;
                    gap: 12px;
                }
                .fr-chip {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 34px;
                    padding: 0 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(13, 19, 16, 0.28);
                    color: #f2ead7;
                    font-size: 13px;
                    font-weight: 600;
                }
                .fr-chip--actionable {
                    box-shadow: none;
                    border-color: rgba(255, 255, 255, 0.16);
                    background: rgba(255, 255, 255, 0.06);
                }
                .fr-chip:disabled {
                    opacity: 0.48;
                    cursor: default;
                }
                .fr-stage-banner {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(13, 19, 16, 0.3);
                    color: #f2ead7;
                    font-size: 13px;
                    line-height: 1.45;
                    box-shadow: none;
                }
                .fr-stage-banner::before {
                    content: "";
                    width: 8px;
                    height: 8px;
                    flex: 0 0 auto;
                    border-radius: 999px;
                    background: rgba(242, 234, 215, 0.7);
                    box-shadow: none;
                }
                .fr-stage-banner--discard {
                    border-color: rgba(255, 255, 255, 0.12);
                    background: rgba(44, 31, 23, 0.32);
                }
                .fr-stage-banner--discard::before {
                    background: rgba(242, 234, 215, 0.9);
                    box-shadow: none;
                }
                .fr-score-summary {
                    display: grid;
                    gap: 10px;
                }
                .fr-score-summary--dense {
                    gap: 8px;
                }
                .fr-score-table {
                    display: grid;
                    gap: 8px;
                }
                .fr-score-table--dense {
                    gap: 6px;
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
                .fr-zone {
                    min-width: 0;
                    padding: 14px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(28, 39, 33, 0.24);
                }
                .fr-zone-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 14px;
                }
                .fr-zone-title {
                    font-size: 13px;
                    letter-spacing: 0.04em;
                    text-transform: none;
                    color: #f2ead7;
                }
                .fr-zone-hint {
                    font-size: 12px;
                    color: rgba(242, 234, 215, 0.62);
                }
                .fr-zone-hint--active {
                    color: #f2ead7;
                    font-weight: 700;
                }
                .fr-card-row {
                    display: grid;
                    grid-template-columns: repeat(7, minmax(0, 1fr));
                    gap: 12px;
                    min-width: 0;
                }
                .fr-card-row--table-band {
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
                .fr-discard-row--table-river {
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
                .fr-progress-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    font-size: 13px;
                    color: rgba(242, 234, 215, 0.8);
                }
                .fr-progress-track {
                    height: 8px;
                    border-radius: 999px;
                    overflow: hidden;
                    background: rgba(13, 19, 16, 0.4);
                }
                .fr-progress-fill {
                    height: 100%;
                    background: #f2ead7;
                }
                .fr-endgame-summary {
                    display: grid;
                    gap: 10px;
                }
                .fr-endgame-title {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    color: #f2ead7;
                    font-size: 13px;
                    font-weight: 700;
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
                    .fr-zone-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }
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
                    .fr-stacked-insight-grid,
                    .fr-stacked-support-grid {
                        grid-template-columns: 1fr;
                    }
                    .fr-live-endgame-grid {
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
                    .fr-chip-list {
                        gap: 8px;
                    }
                    .fr-chip {
                        min-height: 34px;
                        font-size: 12px;
                        padding: 0 10px;
                    }
                    .fr-stage-banner {
                        padding: 9px 10px;
                        font-size: 12px;
                    }
                    .fr-stage-banner::before {
                        width: 8px;
                        height: 8px;
                    }
                    .fr-card-row-note {
                        font-size: 11px;
                    }
                    .fr-zone {
                        padding: 10px;
                        border-radius: 18px;
                    }
                    .fr-zone-header {
                        margin-bottom: 8px;
                        gap: 8px;
                    }
                    .fr-zone-title {
                        font-size: 12px;
                    }
                    .fr-zone-hint {
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
                        gap: 10px;
                        padding-top: 10px;
                    }
                    .fr-live-endgame-focus-block,
                    .fr-live-endgame-summary-block {
                        gap: 8px;
                        padding: 12px;
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
                    .fr-progress-head,
                    .fr-endgame-title,
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
                    .fr-progress-track {
                        height: 8px;
                    }
                    .fr-stack--deck-compact {
                        min-height: 88px;
                    }
                    .fr-stack-label {
                        left: 8px;
                        right: 8px;
                        bottom: 8px;
                        padding: 8px 10px;
                        font-size: 12px;
                    }
                }
            `}</style>

            <div className={`fr-board${isMinimalLiveDesktop ? ' fr-board--minimal-live' : ''}`}>
                {isStackedViewport ? turnPanelSection : null}
                {isStackedViewport ? (
                    <div
                        className={`fr-stacked-layout${isCompactLandscapeViewport ? ' fr-stacked-layout--compact-landscape' : ''}`}
                        data-testid="fantasyrealms-stacked-layout"
                    >
                        {isCompactLandscapeViewport ? (
                            <>
                                {handZoneSection}
                                <div className="fr-stacked-insight-grid" data-testid="fantasyrealms-stacked-insight-grid">
                                    {discardZoneSection}
                                    {focusPanelSection}
                                </div>
                                <div className="fr-stacked-support-grid" data-testid="fantasyrealms-stacked-support-grid">
                                    {scorePanelSection}
                                    {progressPanelSection}
                                </div>
                                {deckPanelSection}
                            </>
                        ) : (
                            <>
                                {discardZoneSection}
                                <div className="fr-stacked-insight-grid" data-testid="fantasyrealms-stacked-insight-grid">
                                    {focusPanelSection}
                                    {scorePanelSection}
                                </div>
                                {handZoneSection}
                                <div className="fr-stacked-support-grid" data-testid="fantasyrealms-stacked-support-grid">
                                    {progressPanelSection}
                                    {deckPanelSection}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div
                        className={`fr-live-table${isGameOver ? ' fr-live-table--gameover' : ''}`}
                        data-testid="fantasyrealms-live-table"
                    >
                        {minimalLiveTopbarSection}
                        {minimalLiveDiscardZoneSection}
                        {minimalLiveHandZoneSection}
                        {minimalLiveActionZoneSection}
                        {minimalLiveEndgameSection}
                    </div>
                )}
            </div>
        </div>
    );
}
