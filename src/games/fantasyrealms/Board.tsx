import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import {
    EMPTY_FOCUS_INSIGHT,
    FANTASY_REALMS_DISCARD_END_THRESHOLD,
    FANTASY_REALMS_HAND_CARD_SLOTS,
    HAND_CARDS,
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
        focusInsight: { ...EMPTY_FOCUS_INSIGHT, tips: [...EMPTY_FOCUS_INSIGHT.tips] },
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

function localizeScoreBreakdownLabel(label: string, t: Translator): string {
    return SCORE_LABEL_KEY_BY_LABEL[label] ? t(SCORE_LABEL_KEY_BY_LABEL[label]) : label;
}

function formatSignedDelta(value: number): string {
    return value >= 0 ? `+${value}` : String(value);
}

function renderFallbackCard(card: TableCard, t: Translator) {
    return (
        <article
            className="fr-card"
            data-testid="fantasyrealms-card"
            data-card-renderer="fallback"
            aria-label={t('card.ariaLabel', {
                name: card.name,
                suit: card.suit,
                score: card.score,
            })}
        >
            <div aria-hidden="true" className="fr-card-sheen" />
            <div className={`fr-card-suit ${card.toneClass}`}>{card.suit}</div>
            <div className="fr-card-body">
                <div className="fr-card-name">{card.name}</div>
                <div className="fr-card-text">{card.text}</div>
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
    if (!atlasStyle) {
        return renderFallbackCard(card, t);
    }

    return (
        <article
            className="fr-card fr-card--atlas"
            data-testid="fantasyrealms-card"
            data-card-renderer="atlas"
            data-atlas-card-id={card.id}
            aria-label={t('card.ariaLabel', {
                name: card.name,
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
    viewerPlayerId: string,
    viewerPlayer: FantasyRealmsPlayerState | undefined,
    isGameOver: boolean,
): FocusDisplayState {
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
        card: core.discardPile[core.discardPile.length - 1] ?? viewerPlayer?.hand[0] ?? core.players[viewerPlayerId]?.hand[0],
        hiddenByOtherPlayer: false,
        source: 'fallback',
    };
}

function buildDiscardFocusInsight(
    core: FantasyRealmsCore,
    viewerPlayer: FantasyRealmsPlayerState | undefined,
    focusCard: TableCard,
    t: Translator,
) {
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
            description: t('focus.dynamic.descriptions.discardTakeNow', {
                name: focusCard.name,
                nextScore,
                delta: formatSignedDelta(delta),
            }),
            estimatedDelta: delta,
            tips: positive
                ? [
                    t('focus.dynamic.tips.discardTakeDirectPrimary'),
                    t('focus.dynamic.tips.discardTakeDirectSecondary'),
                ]
                : [
                    t('focus.dynamic.tips.discardNoGainPrimary'),
                    t('focus.dynamic.tips.discardNoGainSecondary'),
                ],
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
            description: t('focus.dynamic.descriptions.discardNoViewerHand', { name: focusCard.name }),
            estimatedDelta: 0,
            tips: [
                t('focus.dynamic.tips.discardNoGainPrimary'),
                t('focus.dynamic.tips.discardNoGainSecondary'),
            ],
        };
    }

    const positive = bestSwap.delta > 0;
    return {
        kicker: positive ? t('focus.dynamic.kickers.discardUpgrade') : t('focus.dynamic.kickers.discardProbe'),
        description: t('focus.dynamic.descriptions.discardSwapBest', {
            name: focusCard.name,
            candidate: bestSwap.candidate.name,
            nextScore: bestSwap.nextScore,
            delta: formatSignedDelta(bestSwap.delta),
        }),
        estimatedDelta: bestSwap.delta,
        tips: positive
            ? [
                t('focus.dynamic.tips.discardSwapPrimary', { candidate: bestSwap.candidate.name }),
                t('focus.dynamic.tips.discardSwapSecondary'),
            ]
            : [
                t('focus.dynamic.tips.discardNoGainPrimary'),
                t('focus.dynamic.tips.discardNoGainSecondary'),
            ],
    };
}

function buildHandFocusInsight(
    core: FantasyRealmsCore,
    viewerPlayer: FantasyRealmsPlayerState | undefined,
    focusCard: TableCard,
    t: Translator,
) {
    const hand = viewerPlayer?.hand ?? [];
    const currentScore = viewerPlayer?.score ?? evaluateFantasyRealmsScore(hand, core.discardPile).totalScore;
    const nextHand = hand.filter((card) => card.id !== focusCard.id).map((card) => ({ ...card }));
    const nextDiscard = [...core.discardPile.map((card) => ({ ...card })), { ...focusCard }];
    const nextScore = evaluateFantasyRealmsScore(nextHand, nextDiscard).totalScore;
    const delta = nextScore - currentScore;

    if (delta > 0) {
        return {
            kicker: t('focus.dynamic.kickers.handDiscard'),
            description: t('focus.dynamic.descriptions.handDiscardNow', {
                name: focusCard.name,
                nextScore,
                delta: formatSignedDelta(delta),
            }),
            estimatedDelta: delta,
            tips: [
                t('focus.dynamic.tips.handDropPrimary'),
                t('focus.dynamic.tips.handDropSecondary'),
            ],
        };
    }

    if (delta < 0) {
        return {
            kicker: t('focus.dynamic.kickers.handKeep'),
            description: t('focus.dynamic.descriptions.handDiscardNow', {
                name: focusCard.name,
                nextScore,
                delta: formatSignedDelta(delta),
            }),
            estimatedDelta: delta,
            tips: [
                t('focus.dynamic.tips.handKeepPrimary'),
                t('focus.dynamic.tips.handKeepSecondary'),
            ],
        };
    }

    return {
        kicker: t('focus.dynamic.kickers.handNeutral'),
        description: t('focus.dynamic.descriptions.handDiscardNow', {
            name: focusCard.name,
            nextScore,
            delta: formatSignedDelta(delta),
        }),
        estimatedDelta: delta,
        tips: [
            t('focus.dynamic.tips.handNeutralPrimary'),
            t('focus.dynamic.tips.handNeutralSecondary'),
        ],
    };
}

function buildBoardFocusInsight(
    core: FantasyRealmsCore,
    viewerPlayer: FantasyRealmsPlayerState | undefined,
    focusDisplay: FocusDisplayState,
    t: Translator,
) {
    if (!focusDisplay.card) {
        return { ...EMPTY_FOCUS_INSIGHT, tips: [...EMPTY_FOCUS_INSIGHT.tips] };
    }
    if (focusDisplay.source === 'discard') {
        return buildDiscardFocusInsight(core, viewerPlayer, focusDisplay.card, t);
    }
    if (focusDisplay.source === 'viewer-hand') {
        return buildHandFocusInsight(core, viewerPlayer, focusDisplay.card, t);
    }
    return {
        kicker: t('focus.dynamic.kickers.reviewCard'),
        description: t('focus.dynamic.descriptions.reviewCard', {
            name: focusDisplay.card.name,
            suit: focusDisplay.card.suit,
        }),
        estimatedDelta: 0,
        tips: [
            t('focus.dynamic.tips.reviewPrimary'),
            t('focus.dynamic.tips.reviewSecondary'),
        ],
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

function getPrimaryActionLabel(
    core: FantasyRealmsCore,
    viewerPlayerId: string,
    t: Translator,
    isGameOver: boolean,
): string {
    if (isGameOver) {
        return t('turn.primaryAction.reviewOnly');
    }
    if (viewerPlayerId !== core.currentPlayer) {
        return t('turn.primaryAction.waiting');
    }
    if (core.stage === 'discard') {
        return t('turn.primaryAction.discardRequired');
    }
    return getDrawDeckLabel(core, t);
}

function getPrimaryActionShortLabel(
    core: FantasyRealmsCore,
    viewerPlayerId: string,
    t: Translator,
    isGameOver: boolean,
): string {
    if (isGameOver) {
        return t('turn.primaryActionShort.reviewOnly');
    }
    if (viewerPlayerId !== core.currentPlayer) {
        return t('turn.primaryActionShort.waiting');
    }
    if (core.stage === 'discard') {
        return t('turn.primaryActionShort.discardRequired');
    }
    if (!isDuelVariant(core)) {
        return t('turn.primaryActionShort.drawOne');
    }
    return getCurrentPlayerHandCount(core) >= 7
        ? t('turn.primaryActionShort.drawOne')
        : t('turn.primaryActionShort.twoThenDiscardOne');
}

function getStageSummary(core: FantasyRealmsCore, t: Translator, isGameOver: boolean): string {
    if (isGameOver) {
        return t('turn.stageSummary.gameOver');
    }
    if (!isDuelVariant(core)) {
        if (core.stage === 'discard') {
            return t('turn.stageSummary.multiplayer.discard');
        }
        if (core.discardPile.length === 0) {
            return t('turn.stageSummary.multiplayer.emptyDiscard');
        }
        return t('turn.stageSummary.multiplayer.standard');
    }

    const handCount = getCurrentPlayerHandCount(core);
    if (core.stage === 'discard') {
        return t('turn.stageSummary.duel.discard');
    }
    if (handCount >= 7) {
        return t('turn.stageSummary.duel.fullHand');
    }
    return t('turn.stageSummary.duel.opening');
}

function getStageBannerText(
    core: FantasyRealmsCore,
    viewerPlayerId: string,
    currentPlayerName: string,
    t: Translator,
    isGameOver: boolean,
): string {
    if (isGameOver) {
        return t('turn.statusBanner.gameOver');
    }
    if (viewerPlayerId !== core.currentPlayer) {
        return t('turn.statusBanner.waiting', { player: currentPlayerName });
    }
    if (core.stage === 'discard') {
        return t('turn.statusBanner.discardSelf');
    }
    if (core.discardPile.length > 0) {
        return t('turn.statusBanner.takeDiscardSelf');
    }
    return t('turn.statusBanner.drawSelf');
}

function getDiscardZoneHint(
    core: FantasyRealmsCore,
    canTakeDiscard: boolean,
    viewerPlayerId: string,
    isGameOver: boolean,
    t: Translator,
): string {
    if (isGameOver) {
        return t('zone.discard.hintReview');
    }
    if (viewerPlayerId !== core.currentPlayer) {
        return t('zone.discard.hintWaiting');
    }
    if (core.stage === 'discard') {
        return t('zone.discard.hintDiscardStage');
    }
    if (canTakeDiscard) {
        return t('zone.discard.hintAvailable');
    }
    if (core.discardPile.length === 0) {
        return t('zone.discard.hintEmpty');
    }
    return t('zone.discard.hintLocked');
}

function getHandZoneHint(
    core: FantasyRealmsCore,
    canDiscard: boolean,
    viewerPlayerId: string,
    isGameOver: boolean,
    t: Translator,
): string {
    if (isGameOver) {
        return t('zone.hand.hintReview');
    }
    if (viewerPlayerId !== core.currentPlayer) {
        return t('zone.hand.hintWaiting');
    }
    if (canDiscard) {
        return t('zone.hand.hintDiscard');
    }
    if (core.stage === 'draw') {
        return t('zone.hand.hintInspect');
    }
    return t('zone.hand.hintDefault');
}

function getDiscardEmptyMessage(
    core: FantasyRealmsCore,
    viewerPlayerId: string,
    isGameOver: boolean,
    t: Translator,
): string {
    if (isGameOver) {
        return t('zone.discard.emptyReview');
    }
    if (viewerPlayerId !== core.currentPlayer) {
        return t('zone.discard.emptyWaiting');
    }
    if (core.stage === 'discard') {
        return t('zone.discard.emptyDiscardStage');
    }
    return t('zone.discard.emptyDrawFirst');
}

function getHandEmptyMessage(
    core: FantasyRealmsCore,
    viewerPlayerId: string,
    isGameOver: boolean,
    t: Translator,
): string {
    if (isGameOver) {
        return t('zone.hand.emptyReview');
    }
    if (viewerPlayerId !== core.currentPlayer) {
        return t('zone.hand.emptyWaiting');
    }
    if (core.stage === 'discard') {
        return t('zone.hand.emptyDiscard');
    }
    return t('zone.hand.emptyDraw');
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

    React.useEffect(() => {
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

    const viewerPlayerId = playerID ?? core.currentPlayer;
    const viewerPlayer = core.players[viewerPlayerId] ?? core.players[core.currentPlayer] ?? Object.values(core.players)[0];
    const gameOver = G?.sys?.gameover as { winner?: string; draw?: boolean; scores?: Record<string, number>; winners?: string[] } | undefined;
    const isGameOver = Boolean(gameOver);
    const handCardSlots = React.useMemo(
        () => buildCardSlots(viewerPlayer?.hand ?? HAND_CARDS, FANTASY_REALMS_HAND_CARD_SLOTS, 'hand'),
        [viewerPlayer?.hand],
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
    const focusKicker = focusDisplay.hiddenByOtherPlayer
        ? t('focus.hiddenKicker')
        : (isGameOver ? t('focus.reviewKicker') : focusInsight.kicker);
    const focusName = focusDisplay.hiddenByOtherPlayer
        ? t('focus.hiddenName')
        : (visibleFocusCard?.name ?? t('focus.setupPhase'));
    const focusDescription = focusDisplay.hiddenByOtherPlayer
        ? t('focus.hiddenDescription')
        : (isGameOver ? t('focus.reviewDescription') : focusInsight.description);
    const focusEstimatedDelta = focusDisplay.hiddenByOtherPlayer
        ? t('focus.hiddenDelta')
        : (isGameOver
            ? t('focus.reviewDelta')
            : (focusInsight.estimatedDelta >= 0 ? `+${focusInsight.estimatedDelta}` : String(focusInsight.estimatedDelta)));
    const focusTips = focusDisplay.hiddenByOtherPlayer
        ? [t('focus.hiddenTipPrimary'), t('focus.hiddenTipSecondary')]
        : (isGameOver ? [t('focus.reviewTipPrimary'), t('focus.reviewTipSecondary')] : focusInsight.tips);
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
        const matchPlayer = matchData.find((player) => String(player.id) === String(viewerPlayerId));
        if (matchPlayer?.name) return matchPlayer.name;
        if (viewerPlayer?.name) return viewerPlayer.name;
        return t('fallback.viewer');
    })();
    const isMyTurn = viewerPlayerId === core.currentPlayer;
    const canDrawFromDeck = isMyTurn && !isGameOver && core.stage === 'draw' && core.drawPile.length > 0;
    const canTakeDiscard = isMyTurn && !isGameOver && core.stage === 'draw' && core.discardPile.length > 0;
    const canDiscard = isMyTurn && !isGameOver && core.stage === 'discard';
    const isLiveMultiplayer = !isGameOver && core.playerIds.length > 2;
    const useCompactDesktopEmptyDiscard = !isStackedViewport && !isGameOver && discardCards.length === 0;
    const useDenseScorePanel = core.playerIds.length >= 5;
    const discardThreshold = isDuelVariant(core) ? FANTASY_REALMS_DISCARD_END_THRESHOLD : 10;
    const discardProgress = Math.min(core.discardPile.length / discardThreshold, 1);
    const handsFilled = core.playerIds.filter((id) => (core.players[id]?.hand.length ?? 0) >= 7).length;
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
        scoreVisible: isGameOver || id === viewerPlayerId,
        isCurrent: !isGameOver && id === core.currentPlayer,
        isViewer: id === viewerPlayerId,
        isWinner: winnerIds.has(id),
    })), [core, isGameOver, matchData, t, viewerPlayerId, winnerIds]);
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
        () => getStageBannerText(core, viewerPlayerId, currentPlayerName, t, isGameOver),
        [core, currentPlayerName, isGameOver, t, viewerPlayerId],
    );
    const primaryActionLabel = React.useMemo(
        () => getPrimaryActionLabel(core, viewerPlayerId, t, isGameOver),
        [core, isGameOver, t, viewerPlayerId],
    );
    const primaryActionShortLabel = React.useMemo(
        () => getPrimaryActionShortLabel(core, viewerPlayerId, t, isGameOver),
        [core, isGameOver, t, viewerPlayerId],
    );
    const isMinimalDesktop = !isStackedViewport;
    const isMinimalLiveDesktop = isMinimalDesktop && !isGameOver;
    const discardZoneHint = React.useMemo(
        () => getDiscardZoneHint(core, canTakeDiscard, viewerPlayerId, isGameOver, t),
        [canTakeDiscard, core, isGameOver, t, viewerPlayerId],
    );
    const handZoneHint = React.useMemo(
        () => getHandZoneHint(core, canDiscard, viewerPlayerId, isGameOver, t),
        [canDiscard, core, isGameOver, t, viewerPlayerId],
    );
    const discardEmptyMessage = React.useMemo(
        () => getDiscardEmptyMessage(core, viewerPlayerId, isGameOver, t),
        [core, isGameOver, t, viewerPlayerId],
    );
    const handEmptyMessage = React.useMemo(
        () => getHandEmptyMessage(core, viewerPlayerId, isGameOver, t),
        [core, isGameOver, t, viewerPlayerId],
    );
    const compactTurnStateLabel = React.useMemo(() => {
        if (isGameOver) return t('turn.compact.review');
        if (!isMyTurn) return t('turn.compact.waiting');
        if (core.stage === 'discard') return t('turn.compact.discard');
        return t('turn.compact.draw');
    }, [core.stage, isGameOver, isMyTurn, t]);

    const handleDrawFromDeck = React.useCallback(() => {
        dispatch('DRAW_FROM_DECK', {});
    }, [dispatch]);

    const handleFocusCard = React.useCallback((cardId: string) => {
        dispatch('SET_FOCUS_CARD', { cardId });
    }, [dispatch]);

    const handleDiscardPileClick = React.useCallback((cardId: string) => {
        if (canTakeDiscard) {
            dispatch('TAKE_FROM_DISCARD', { cardId });
            return;
        }
        handleFocusCard(cardId);
    }, [canTakeDiscard, dispatch, handleFocusCard]);

    const handleHandCardClick = React.useCallback((cardId: string) => {
        if (canDiscard) {
            dispatch('DISCARD_CARD', { cardId });
            return;
        }
        handleFocusCard(cardId);
    }, [canDiscard, dispatch, handleFocusCard]);

    const turnPanelBody = (
        <div className="fr-panel-body fr-chip-list">
            <div className="fr-chip">
                {isGameOver ? t('turn.reviewChip') : t('turn.roundChip', { turn: core.turn, player: currentPlayerName })}
            </div>
            {isMinimalDesktop ? (
                <div className="fr-chip fr-chip--muted">{compactTurnStateLabel}</div>
            ) : (
                <>
                    <div
                        className={`fr-stage-banner${core.stage === 'discard' ? ' fr-stage-banner--discard' : ''}`}
                        aria-live="polite"
                    >
                        {stageBannerText}
                    </div>
                    {!isMyTurn && !isGameOver ? (
                        <div className="fr-observer-note">{t('turn.observerNote')}</div>
                    ) : null}
                    <div className="fr-chip">{getStageSummary(core, t, isGameOver)}</div>
                </>
            )}
            <button
                type="button"
                className={`fr-chip${canDrawFromDeck ? ' fr-chip--actionable' : ''}`}
                onClick={handleDrawFromDeck}
                disabled={!canDrawFromDeck}
            >
                {primaryActionLabel}
            </button>
        </div>
    );

    const turnPanelSection = (
        <section className={`fr-panel${isStackedViewport ? ' fr-stacked-turn-panel' : ' fr-panel--turn-corner'}`}>
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
        <section className={`fr-panel${!isStackedViewport ? ' fr-panel--score-rail' : ''}`}>
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
                                    {player.isCurrent ? <i className="fr-score-badge">{t('score.badges.current')}</i> : null}
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
                <div className={`fr-score-summary-value${useDenseScorePanel ? ' fr-score-summary-value--dense' : ''}`}>
                    <strong>{viewerPlayer?.score ?? 0}</strong>
                    <span>{t('score.totalLabel')}</span>
                </div>
                {!isMinimalDesktop ? (
                    <div className={`fr-score-list${useDenseScorePanel ? ' fr-score-list--dense' : ''}`}>
                        {(viewerPlayer?.scoreBreakdown ?? []).map((line) => (
                            <span key={line.label}>
                                <em>{localizeScoreBreakdownLabel(line.label, t)}</em>
                                <b>{line.value >= 0 ? `+${line.value}` : line.value}</b>
                            </span>
                        ))}
                    </div>
                ) : null}
                {!isMinimalDesktop && isLiveMultiplayer ? (
                    <div className="fr-score-note">{t('score.hiddenReasonLive')}</div>
                ) : null}
            </div>
        </section>
    );

    const discardZoneSection = (
        <section
            className={`fr-zone${useCompactDesktopEmptyDiscard ? ' fr-zone--compact-empty-discard' : ''}${!isStackedViewport ? ' fr-zone--discard-river' : ''}`}
            aria-label={t('zone.discard.ariaLabel')}
        >
            <div className="fr-zone-header">
                <div className="fr-zone-title">{t('zone.discard.title')}</div>
                <div className={`fr-zone-hint${canTakeDiscard ? ' fr-zone-hint--active' : ''}`}>
                    {isMinimalDesktop ? `${discardCards.length}/${discardThreshold}` : discardZoneHint}
                </div>
            </div>
            <div
                className={`fr-discard-row${discardCards.length === 0 ? ' fr-discard-row--empty' : ''}${!isStackedViewport && discardCards.length > 0 ? ' fr-discard-row--table-river' : ''}`}
                data-testid="fantasyrealms-discard-row"
            >
                {discardCards.length === 0 ? (
                    <div
                        className={`fr-zone-empty${useCompactDesktopEmptyDiscard ? ' fr-zone-empty--compact-discard' : ''}`}
                        data-testid="fantasyrealms-discard-empty"
                    >
                        {isMinimalDesktop ? t('zone.discard.emptyCompact') : discardEmptyMessage}
                    </div>
                ) : discardCards.map((card) => (
                    <button
                        key={card.id}
                        type="button"
                        className={`fr-card-button${core.focusCardId === card.id ? ' fr-card-button--selected' : ''}${canTakeDiscard ? ' fr-card-button--actionable' : ''}`}
                        onClick={() => handleDiscardPileClick(card.id)}
                        data-action-state={canTakeDiscard ? 'take' : 'inspect'}
                        aria-label={canTakeDiscard
                            ? t('actions.takeDiscardAria', { name: card.name })
                            : t('actions.inspectDiscardAria', { name: card.name })}
                    >
                        {renderCard(card, t, locale)}
                    </button>
                ))}
            </div>
        </section>
    );

    const handZoneSection = (
        <section className={`fr-zone${!isStackedViewport ? ' fr-zone--hand-band' : ''}`} aria-label={t('zone.hand.ariaLabel')}>
            <div className="fr-zone-header">
                <div className="fr-zone-title">{t('zone.hand.title', { player: viewerPlayerName })}</div>
                <div className={`fr-zone-hint${canDiscard ? ' fr-zone-hint--active' : ''}`}>
                    {isMinimalDesktop ? `${viewerPlayer?.hand.length ?? 0}/${FANTASY_REALMS_HAND_CARD_SLOTS}` : handZoneHint}
                </div>
            </div>
            <div className="fr-card-row-wrap">
                <div
                    className={`fr-card-row${!isStackedViewport ? ' fr-card-row--table-band' : ''}`}
                    data-testid="fantasyrealms-hand-row"
                    data-slot-count={FANTASY_REALMS_HAND_CARD_SLOTS}
                >
                    {handCardSlots.map((slot) => slot.card ? (
                        <button
                            key={slot.key}
                            type="button"
                            className={`fr-card-button${core.focusCardId === slot.card!.id ? ' fr-card-button--selected' : ''}${canDiscard ? ' fr-card-button--actionable' : ''}`}
                            onClick={() => handleHandCardClick(slot.card!.id)}
                            data-action-state={canDiscard ? 'discard' : 'inspect'}
                            aria-label={canDiscard
                                ? t('actions.discardHandAria', { name: slot.card.name })
                                : t('actions.inspectHandAria', { name: slot.card.name })}
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
                {(viewerPlayer?.hand.length ?? 0) === 0 ? (
                    <div className="fr-card-row-note" data-testid="fantasyrealms-hand-empty-note">
                        {isMinimalDesktop ? t('zone.hand.emptyCompact') : handEmptyMessage}
                    </div>
                ) : null}
            </div>
        </section>
    );

    const focusPanelSection = (
        <section className={`fr-panel${!isStackedViewport ? ' fr-panel--focus-note' : ''}`}>
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
                        {!isMinimalDesktop ? <div className="fr-focus-kicker">{focusKicker}</div> : null}
                        <div className="fr-focus-name">{focusName}</div>
                        {!isMinimalDesktop ? (
                            <div className="fr-focus-text">
                                {focusDescription}
                            </div>
                        ) : null}
                        <div className="fr-focus-score">
                            <span>{t('focus.estimatedDelta')}</span>
                            <strong>{focusEstimatedDelta}</strong>
                        </div>
                    </article>
                </div>

                {!isMinimalDesktop ? (
                    <div className="fr-combo-list">
                        {focusTips.map((tip) => (
                            <div key={tip} className="fr-combo-item">{tip}</div>
                        ))}
                    </div>
                ) : null}
            </div>
        </section>
    );

    const progressPanelSection = (
        <section className={`fr-panel${!isStackedViewport ? ' fr-panel--progress-note' : ''}`}>
            <div className="fr-panel-header">{t('progress.panelTitle')}</div>
            <div className="fr-panel-body fr-focus-panel">
                <div className="fr-progress-head">
                    <span>{isDuelVariant(core) ? t('progress.duelThreshold') : t('progress.standardThreshold')}</span>
                    <strong>{core.discardPile.length} / {discardThreshold}</strong>
                </div>
                <div className="fr-progress-track">
                    <div className="fr-progress-fill" style={{ width: `${discardProgress * 100}%` }} />
                </div>
                {!isMinimalDesktop ? (
                    <div className="fr-footer-text">
                        {isGameOver
                            ? t('progress.gameOverReview')
                            : (isDuelVariant(core)
                                ? t('progress.duelStatus', { handsFilled, playerCount: core.playerIds.length })
                                : t('progress.standardStatus', { playerCount: core.playerIds.length }))}
                    </div>
                ) : null}
                {isGameOver ? (
                    <div className="fr-endgame-summary">
                        {!isMinimalDesktop ? (
                            <div className="fr-combo-item">
                                {gameOver?.draw
                                    ? t('progress.gameOverDraw')
                                    : t('progress.gameOverWinner', { winner: winnerName ?? t('fallback.unknownPlayer') })}
                            </div>
                        ) : null}
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

    const minimalLiveTopbarSection = (
        <div className="fr-live-topbar" data-testid="fantasyrealms-live-topbar">
            <div className="fr-live-status-strip" data-testid="fantasyrealms-live-status-strip">
                <div className="fr-live-deck" aria-label={t('deck.panelTitle')}>
                    <div className="fr-live-deck-stack">
                        <div className="fr-stack-card fr-stack-card--under" style={deckBackStyle} aria-hidden="true" />
                        <div className="fr-stack-card fr-stack-card--mid" style={deckBackStyle} aria-hidden="true" />
                        <div className="fr-stack-card fr-stack-card--top" style={deckBackStyle} aria-hidden="true" />
                    </div>
                    <strong className="fr-live-deck-count">{core.drawPile.length}</strong>
                </div>
                <div className="fr-live-turn-strip" aria-label={t('turn.panelTitle')}>
                    <span className="fr-live-turn-round">{t('turn.short.round', { turn: core.turn })}</span>
                    <span className="fr-live-turn-player">{currentPlayerName}</span>
                </div>
                <button
                    type="button"
                    className={`fr-live-action${canDrawFromDeck ? ' fr-live-action--enabled' : ''}`}
                    onClick={handleDrawFromDeck}
                    disabled={!canDrawFromDeck}
                >
                    {primaryActionShortLabel}
                </button>
            </div>
            <div className="fr-live-score-strip" aria-label={t('score.tableTitle')} data-testid="fantasyrealms-live-score-strip">
                {playerSummaries.map((player) => (
                    <div
                        key={player.id}
                        className={`fr-live-score-seat${player.isCurrent ? ' fr-live-score-seat--current' : ''}${player.isViewer ? ' fr-live-score-seat--viewer' : ''}`}
                    >
                        <span className="fr-live-score-seat-name">{player.name}</span>
                        <strong className="fr-live-score-seat-total">
                            {player.scoreVisible ? player.score : t('score.hiddenValue')}
                        </strong>
                    </div>
                ))}
            </div>
        </div>
    );

    const minimalLiveDiscardZoneSection = (
        <section className="fr-live-river" aria-label={t('zone.discard.ariaLabel')} data-testid="fantasyrealms-live-river">
            <div className="fr-live-river-count">{discardCards.length}/{discardThreshold}</div>
            <div
                className={`fr-discard-row fr-discard-row--live-river${discardCards.length === 0 ? ' fr-discard-row--empty' : ''}${discardCards.length > 0 ? ' fr-discard-row--table-river' : ''}`}
                data-testid="fantasyrealms-discard-row"
            >
                {discardCards.length === 0 ? (
                    <div className="fr-zone-empty fr-zone-empty--silent" data-testid="fantasyrealms-discard-empty" aria-hidden="true" />
                ) : discardCards.map((card) => (
                    <button
                        key={card.id}
                        type="button"
                        className={`fr-card-button fr-card-button--live-river${core.focusCardId === card.id ? ' fr-card-button--selected' : ''}${canTakeDiscard ? ' fr-card-button--actionable' : ''}`}
                        onClick={() => handleDiscardPileClick(card.id)}
                        data-action-state={canTakeDiscard ? 'take' : 'inspect'}
                        aria-label={canTakeDiscard
                            ? t('actions.takeDiscardAria', { name: card.name })
                            : t('actions.inspectDiscardAria', { name: card.name })}
                    >
                        {renderCard(card, t, locale)}
                    </button>
                ))}
            </div>
        </section>
    );

    const minimalLiveHandZoneSection = (
        <section className="fr-live-handband" aria-label={t('zone.hand.ariaLabel')} data-testid="fantasyrealms-live-handband">
            <div className="fr-live-hand-count">{viewerPlayer?.hand.length ?? 0}/{FANTASY_REALMS_HAND_CARD_SLOTS}</div>
            <div className="fr-card-row-wrap">
                <div
                    className="fr-card-row fr-card-row--table-band"
                    data-testid="fantasyrealms-hand-row"
                    data-slot-count={FANTASY_REALMS_HAND_CARD_SLOTS}
                >
                    {handCardSlots.map((slot) => slot.card ? (
                        <button
                            key={slot.key}
                            type="button"
                            className={`fr-card-button fr-card-button--live-hand${core.focusCardId === slot.card!.id ? ' fr-card-button--selected' : ''}${canDiscard ? ' fr-card-button--actionable' : ''}`}
                            onClick={() => handleHandCardClick(slot.card!.id)}
                            data-action-state={canDiscard ? 'discard' : 'inspect'}
                            aria-label={canDiscard
                                ? t('actions.discardHandAria', { name: slot.card.name })
                                : t('actions.inspectHandAria', { name: slot.card.name })}
                        >
                            {renderCard(slot.card, t, locale)}
                        </button>
                    ) : (
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

    return (
        <div className="fr-root">
            <style>{`
                .fr-root {
                    min-height: 100%;
                    overflow-y: auto;
                    padding: 16px;
                    color: #f2ead7;
                    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
                    background: #121714;
                }
                .fr-board {
                    width: min(1440px, 100%);
                    margin: 0 auto;
                    border-radius: 16px;
                    padding: 16px;
                    position: relative;
                    overflow: hidden;
                    background: #345445;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: none;
                }
                .fr-table-layout,
                .fr-table-top-left,
                .fr-table-top-right,
                .fr-table-center,
                .fr-table-bottom,
                .fr-table-dock {
                    min-width: 0;
                }
                .fr-table-layout {
                    display: grid;
                    grid-template-columns: 240px minmax(0, 1fr);
                    grid-template-rows: auto auto auto;
                    grid-template-areas:
                        "topLeft topRight"
                        "center center"
                        "bottom bottom";
                    column-gap: 18px;
                    row-gap: 16px;
                    position: relative;
                    z-index: 1;
                    align-items: start;
                    padding-right: 318px;
                }
                .fr-board--minimal-live .fr-table-layout {
                    grid-template-columns: 240px minmax(0, 1fr) 300px;
                    grid-template-areas:
                        "topLeft . topRight"
                        "center center center"
                        "bottom bottom bottom";
                    padding-right: 0;
                }
                .fr-table-top-left {
                    grid-area: topLeft;
                    display: grid;
                    gap: 12px;
                    align-self: start;
                }
                .fr-table-top-right {
                    grid-area: topRight;
                    align-self: start;
                    justify-self: end;
                    width: 300px;
                }
                .fr-table-center {
                    grid-area: center;
                    min-height: 0;
                }
                .fr-table-dock {
                    display: grid;
                    gap: 14px;
                    position: absolute;
                    right: 0;
                    top: 238px;
                    width: 300px;
                }
                .fr-board--minimal-live .fr-table-dock {
                    display: none;
                }
                .fr-table-bottom {
                    grid-area: bottom;
                }
                .fr-panel--turn-corner,
                .fr-panel--deck-corner {
                    align-self: start;
                }
                .fr-board--minimal-live .fr-panel--turn-corner,
                .fr-board--minimal-live .fr-panel--deck-corner,
                .fr-board--minimal-live .fr-panel--score-rail {
                    border: none;
                    background: transparent;
                }
                .fr-board--minimal-live .fr-table-top-left {
                    gap: 10px;
                }
                .fr-board--minimal-live .fr-panel--turn-corner .fr-panel-header,
                .fr-board--minimal-live .fr-panel--deck-corner .fr-panel-header,
                .fr-board--minimal-live .fr-panel--score-rail .fr-panel-header {
                    padding-top: 0;
                    padding-left: 0;
                    padding-right: 0;
                    font-size: 10px;
                    letter-spacing: 0.08em;
                    color: rgba(242, 234, 215, 0.62);
                }
                .fr-board--minimal-live .fr-panel--turn-corner .fr-panel-body,
                .fr-board--minimal-live .fr-panel--deck-corner .fr-panel-body,
                .fr-board--minimal-live .fr-panel--score-rail .fr-panel-body {
                    padding-left: 0;
                    padding-right: 0;
                    padding-bottom: 0;
                }
                .fr-board--minimal-live .fr-panel--turn-corner .fr-panel-body,
                .fr-board--minimal-live .fr-panel--score-rail .fr-panel-body {
                    padding-top: 4px;
                }
                .fr-board--minimal-live .fr-panel--deck-corner .fr-panel-body {
                    padding-top: 6px;
                }
                .fr-board--minimal-live .fr-panel--turn-corner .fr-chip {
                    background: rgba(24, 36, 29, 0.52);
                    border-color: rgba(255, 255, 255, 0.08);
                }
                .fr-board--minimal-live .fr-panel--score-rail {
                    width: 284px;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-summary {
                    gap: 6px;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-table {
                    gap: 4px;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row {
                    padding: 4px 0;
                    gap: 8px;
                    border-radius: 0;
                    background: transparent;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row:last-child {
                    border-bottom: none;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row-main {
                    gap: 2px;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row-name,
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row-meta {
                    gap: 4px;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row-name {
                    font-size: 13px;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row-meta {
                    color: rgba(242, 234, 215, 0.56);
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row-total {
                    min-width: 52px;
                    align-items: flex-end;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row-total strong {
                    font-size: 18px;
                    line-height: 1;
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-row-total span {
                    font-size: 10px;
                    color: rgba(242, 234, 215, 0.54);
                }
                .fr-board--minimal-live .fr-panel--score-rail .fr-score-summary-value {
                    margin-top: 2px;
                    padding: 8px 0 0;
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 0;
                    background: transparent;
                }
                .fr-live-table {
                    position: relative;
                    display: grid;
                    gap: 22px;
                }
                .fr-live-table::before {
                    content: "";
                    position: absolute;
                    inset: 84px 6% 104px;
                    border-radius: 48px;
                    background:
                        radial-gradient(circle at 50% 28%, rgba(248, 230, 175, 0.08), transparent 28%),
                        radial-gradient(circle at center, rgba(255, 255, 255, 0.04), transparent 56%);
                    pointer-events: none;
                }
                .fr-live-topbar {
                    position: relative;
                    z-index: 1;
                    min-height: 92px;
                    padding: 0 188px 0 2px;
                }
                .fr-live-status-strip {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                    min-width: 0;
                }
                .fr-live-deck {
                    display: inline-flex;
                    align-items: flex-end;
                    gap: 10px;
                    min-width: 0;
                }
                .fr-live-deck-stack {
                    position: relative;
                    width: 66px;
                    height: 90px;
                    border-radius: 12px;
                    flex: 0 0 auto;
                    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.22));
                }
                .fr-live-deck-stack .fr-stack-card {
                    inset: 0;
                }
                .fr-live-deck-count {
                    margin-bottom: 6px;
                    font-size: 28px;
                    line-height: 1;
                    color: #f2ead7;
                }
                .fr-live-turn-strip {
                    display: inline-flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                    color: rgba(242, 234, 215, 0.92);
                }
                .fr-live-turn-round {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 26px;
                    padding: 0 10px;
                    border-radius: 999px;
                    background: rgba(17, 27, 22, 0.3);
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    color: rgba(242, 234, 215, 0.64);
                    text-transform: uppercase;
                }
                .fr-live-turn-player {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 26px;
                    font-weight: 700;
                    color: #f2ead7;
                }
                .fr-live-action {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 38px;
                    padding: 0 16px;
                    border-radius: 999px;
                    border: 0;
                    background: rgba(31, 45, 37, 0.7);
                    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.16);
                    color: rgba(242, 234, 215, 0.7);
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                }
                .fr-live-action--enabled {
                    background: linear-gradient(180deg, #8f6a2f 0%, #6e5227 100%);
                    color: #fbf5e8;
                }
                .fr-live-action:disabled {
                    cursor: default;
                }
                .fr-live-score-strip {
                    position: absolute;
                    top: 2px;
                    right: 0;
                    display: grid;
                    gap: 10px;
                    width: 170px;
                    justify-items: stretch;
                }
                .fr-live-score-seat {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: baseline;
                    gap: 10px;
                    opacity: 0.42;
                }
                .fr-live-score-seat--viewer,
                .fr-live-score-seat--current {
                    opacity: 1;
                }
                .fr-live-score-seat-name {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 14px;
                    font-weight: 700;
                    color: rgba(242, 234, 215, 0.78);
                }
                .fr-live-score-seat--current .fr-live-score-seat-name {
                    color: #f2ead7;
                }
                .fr-live-score-seat-total {
                    font-size: 22px;
                    line-height: 1;
                    color: rgba(242, 234, 215, 0.82);
                }
                .fr-live-score-seat--current .fr-live-score-seat-total {
                    font-size: 28px;
                    color: #fbf5e8;
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
                    padding-top: 6px;
                }
                .fr-live-handband {
                    padding-top: 6px;
                }
                .fr-live-river-count,
                .fr-live-hand-count {
                    position: absolute;
                    top: 0;
                    right: 0;
                    font-size: 12px;
                    font-weight: 700;
                    color: rgba(242, 234, 215, 0.72);
                }
                .fr-discard-row--live-river {
                    position: relative;
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    align-content: start;
                    gap: 18px 16px;
                    max-width: 676px;
                    min-height: 264px;
                    margin: 0 auto;
                    padding: 24px 0 0;
                }
                .fr-zone-empty--silent {
                    min-height: 120px;
                    padding: 0;
                    border: none;
                    background: transparent;
                }
                .fr-card-button--live-river {
                    position: relative;
                    width: clamp(110px, 8vw, 126px);
                    flex: 0 0 clamp(110px, 8vw, 126px);
                }
                .fr-card-button--live-river .fr-card {
                    border-radius: 14px;
                    border-color: rgba(255, 255, 255, 0.1);
                    box-shadow: 0 14px 24px rgba(0, 0, 0, 0.24);
                }
                .fr-card-button--live-river.fr-card-button--actionable .fr-card,
                .fr-card-button--live-hand.fr-card-button--actionable .fr-card {
                    transform: none;
                }
                .fr-card-button--live-river.fr-card-button--actionable .fr-card {
                    border-color: rgba(255, 238, 201, 0.58);
                    box-shadow: 0 16px 28px rgba(0, 0, 0, 0.26);
                }
                .fr-live-handband .fr-card-row-wrap {
                    position: relative;
                    padding: 16px 0 0;
                    gap: 0;
                }
                .fr-live-handband .fr-card-row--table-band {
                    grid-template-columns: repeat(7, minmax(100px, 126px));
                    gap: 12px;
                }
                .fr-card-button--live-hand {
                    position: relative;
                    transform: none;
                }
                .fr-card-button--live-hand .fr-card {
                    border-radius: 14px;
                    border-color: rgba(255, 255, 255, 0.1);
                    box-shadow: 0 12px 20px rgba(0, 0, 0, 0.22);
                }
                .fr-card-button--live-hand.fr-card-button--actionable .fr-card {
                    border-color: rgba(255, 238, 201, 0.5);
                    box-shadow: 0 14px 24px rgba(0, 0, 0, 0.24);
                }
                .fr-card-slot--live-hand {
                    border-style: solid;
                    border-color: rgba(255, 255, 255, 0.06);
                    background: rgba(10, 16, 13, 0.12);
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
                .fr-panel--score-rail .fr-panel-body {
                    padding: 10px 12px 12px;
                    max-height: 210px;
                    overflow: auto;
                }
                .fr-panel--score-rail {
                    max-height: 256px;
                }
                .fr-panel--score-rail .fr-score-summary {
                    gap: 8px;
                }
                .fr-panel--score-rail .fr-score-table {
                    gap: 6px;
                }
                .fr-panel--score-rail .fr-score-row {
                    padding: 8px 10px;
                    gap: 10px;
                }
                .fr-panel--score-rail .fr-score-row-total strong {
                    font-size: 20px;
                }
                .fr-panel--score-rail .fr-score-summary-value {
                    padding: 8px 10px;
                    border-radius: 10px;
                    justify-content: space-between;
                    background: rgba(13, 19, 16, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                }
                .fr-panel--score-rail .fr-score-summary-value strong {
                    font-size: 30px;
                }
                .fr-panel--score-rail .fr-score-list {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 6px;
                    font-size: 11px;
                }
                .fr-panel--score-rail .fr-score-list span {
                    display: grid;
                    gap: 4px;
                    justify-content: initial;
                    padding: 8px 10px;
                    border-radius: 10px;
                    background: rgba(13, 19, 16, 0.24);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .fr-panel--score-rail .fr-score-list em {
                    font-style: normal;
                    color: rgba(242, 234, 215, 0.64);
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
                .fr-chip--muted {
                    color: rgba(242, 234, 215, 0.72);
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
                .fr-score-summary-value {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                    color: #f2ead7;
                }
                .fr-score-summary-value--dense {
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 10px;
                    border-radius: 10px;
                    background: rgba(13, 19, 16, 0.24);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                }
                .fr-score-summary-value strong {
                    font-size: 40px;
                    line-height: 1;
                }
                .fr-score-summary-value--dense strong {
                    font-size: 28px;
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
                .fr-score-note,
                .fr-observer-note {
                    padding: 10px 12px;
                    border-radius: 10px;
                    font-size: 12px;
                    line-height: 1.5;
                    color: rgba(242, 234, 215, 0.72);
                    background: rgba(13, 19, 16, 0.24);
                    border: 1px solid rgba(255, 255, 255, 0.06);
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
                .fr-zone--discard-river {
                    min-height: 300px;
                    display: grid;
                    align-content: start;
                }
                .fr-board--minimal-live .fr-zone--discard-river {
                    min-height: 252px;
                }
                .fr-zone--hand-band {
                    padding-top: 14px;
                    background: rgba(28, 39, 33, 0.34);
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
                .fr-zone--discard-river .fr-discard-row--empty {
                    min-height: 112px;
                    align-content: start;
                }
                .fr-discard-row--empty {
                    min-height: 180px;
                    align-content: center;
                }
                .fr-zone--compact-empty-discard .fr-discard-row--empty {
                    min-height: 112px;
                    align-content: start;
                }
                .fr-zone--compact-empty-discard {
                    align-self: start;
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
                .fr-zone-empty--compact-discard {
                    max-width: 520px;
                    min-height: 88px;
                    place-items: start;
                    padding: 14px 16px;
                    text-align: left;
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
                .fr-panel--focus-note .fr-panel-body,
                .fr-panel--progress-note .fr-panel-body {
                    padding: 12px;
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
                .fr-focus-text {
                    font-size: 14px;
                    line-height: 1.5;
                    color: rgba(242, 234, 215, 0.78);
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
                .fr-combo-list {
                    display: grid;
                    gap: 10px;
                    font-size: 13px;
                    color: #f2ead7;
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
                .fr-panel--progress-note {
                    background: rgba(28, 39, 33, 0.78);
                }
                .fr-footer-text {
                    font-size: 13px;
                    line-height: 1.5;
                    color: rgba(242, 234, 215, 0.72);
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
                    .fr-table-layout {
                        display: revert;
                    }
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
                    .fr-observer-note,
                    .fr-score-note,
                    .fr-card-row-note,
                    .fr-footer-text {
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
                    .fr-card-row-wrap {
                        gap: 8px;
                    }
                    .fr-card-row {
                        grid-template-columns: repeat(7, minmax(84px, 1fr));
                        gap: 8px;
                        padding-right: 72px;
                    }
                    .fr-focus-panel,
                    .fr-combo-list,
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
                    .fr-focus-text {
                        font-size: 12px;
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
                ) : isMinimalLiveDesktop ? (
                    <div className="fr-live-table" data-testid="fantasyrealms-live-table">
                        {minimalLiveTopbarSection}
                        {minimalLiveDiscardZoneSection}
                        {minimalLiveHandZoneSection}
                    </div>
                ) : (
                    <div className="fr-table-layout" data-testid="fantasyrealms-table-layout">
                        <aside className="fr-table-top-left" data-testid="fantasyrealms-table-top-left">
                            {deckPanelSection}
                            {turnPanelSection}
                        </aside>

                        <aside className="fr-table-top-right" data-testid="fantasyrealms-table-top-right">
                            {scorePanelSection}
                        </aside>

                        <section className="fr-table-center" data-testid="fantasyrealms-table-center">
                            {discardZoneSection}
                        </section>

                        {!isMinimalLiveDesktop ? (
                            <aside className="fr-table-dock" data-testid="fantasyrealms-table-dock">
                                {focusPanelSection}
                                {progressPanelSection}
                            </aside>
                        ) : null}

                        <section className="fr-table-bottom" data-testid="fantasyrealms-table-bottom">
                            {handZoneSection}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
