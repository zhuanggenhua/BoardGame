import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { CardTier, GemColor, SplendorCommandMap, SplendorCore, TokenColor } from './domain';
import {
    CARD_DEFS_BY_ID,
    GEM_COLORS,
    canAffordCard,
    getPaymentTokens,
    getTokenCount,
} from './domain/rules';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { SPLENDOR_ASSETS, SPLENDOR_TOKEN_IMAGE_BY_COLOR } from './assets';
import { SpritePreview } from './ui/SpritePreview';
import { COLOR_I18N_KEY } from './ui/shared';
import { MarketSection } from './ui/MarketSection';
import { PlayerStatusPanel } from './ui/PlayerStatusPanel';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useGameAudio } from '../../lib/audio/useGameAudio';
import { SPLENDOR_AUDIO_CONFIG } from './audio.config';
import { SPLENDOR_MANIFEST } from './manifest';
import { buildActionLogRows } from '../../components/game/utils/actionLogFormat';
import { ActionLogSegments } from '../../components/game/framework/widgets/ActionLogSegments';
import { getCardPreviewGetter, getCardPreviewMaxDim } from '../../components/game/registry/cardPreviewRegistry';

type Props = GameBoardProps<SplendorCore, SplendorCommandMap>;

const TIERS: CardTier[] = [3, 2, 1];

export default function SplendorBoard({ G, dispatch, playerID, matchData, isMultiplayer }: Props) {
    const selfId = playerID ?? G.core.currentPlayer;
    const self = G.core.players[selfId];
    const pending = G.core.pendingResolution;
    const isMyTurn = G.core.currentPlayer === selfId;
    const isOnlineMatch = isMultiplayer === true;
    const seatedPlayerCount = matchData?.filter((player) => player.name).length ?? G.core.setupPlayerCount;
    const areAllSeatsOccupied = !isOnlineMatch || seatedPlayerCount >= G.core.setupPlayerCount;
    const isHostPlayer = String(playerID ?? '') === String(G.core.hostPlayerId);
    const canAct = isMyTurn && (!isOnlineMatch || G.core.hostStarted);
    const reserveDisabled = self.reservedCardIds.length >= 3;
    const { t, i18n } = useTranslation('game-splendor');
    const nobleTitleChars = Array.from('贵族板块');

    const selectionScopeKey = `${selfId}:${G.core.currentPlayer}:${pending?.type ?? 'none'}`;
    const [takeSelection, setTakeSelection] = useState<{ scopeKey: string; colors: GemColor[] }>(() => ({
        scopeKey: selectionScopeKey,
        colors: [],
    }));
    const selectedTakeColors = takeSelection.scopeKey === selectionScopeKey ? takeSelection.colors : [];
    const setSelectedTakeColors = useCallback((nextColors: React.SetStateAction<GemColor[]>) => {
        setTakeSelection((current) => {
            const baseColors = current.scopeKey === selectionScopeKey ? current.colors : [];
            const resolvedColors = typeof nextColors === 'function' ? nextColors(baseColors) : nextColors;
            return {
                scopeKey: selectionScopeKey,
                colors: resolvedColors,
            };
        });
    }, [selectionScopeKey]);
    const [highlightedMarketCardIds, setHighlightedMarketCardIds] = useState<string[]>([]);
    const [isActionLogExpanded, setIsActionLogExpanded] = useState(true);
    useTutorialBridge(G.sys.tutorial, dispatch);
    const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();

    useGameAudio({
        config: SPLENDOR_AUDIO_CONFIG,
        gameId: SPLENDOR_MANIFEST.id,
        G: G.core,
        ctx: {
            selfPlayerId: selfId,
            currentPlayer: G.core.currentPlayer,
            pendingType: pending?.type ?? null,
            endgameTriggered: G.core.endgame.triggered,
            isGameOver: !!G.core.gameResult,
        },
        eventEntries: G.sys.eventStream.entries,
    });

    const pulseMarketCard = useCallback((cardId: string) => {
        setHighlightedMarketCardIds((current) => current.includes(cardId) ? current : [...current, cardId]);
        window.setTimeout(() => {
            setHighlightedMarketCardIds((current) => current.filter((id) => id !== cardId));
        }, 700);
    }, []);

    const renderPlayerName = useCallback((id: string) =>
        matchData?.find((player) => String(player.id) === id)?.name || t('player.guest', { number: Number(id) + 1 }), [matchData, t]);
    const startingPlayerName = renderPlayerName(G.core.startingPlayerId);

    const getCardPreviewRef = useMemo(() => getCardPreviewGetter(SPLENDOR_MANIFEST.id), []);
    const cardPreviewMaxDim = useMemo(() => getCardPreviewMaxDim(SPLENDOR_MANIFEST.id), []);
    const actionLogRows = useMemo(() => {
        const entries = G.sys.actionLog?.entries ?? [];
        return buildActionLogRows(entries, {
            getPlayerLabel: (playerId) => renderPlayerName(String(playerId)),
        });
    }, [G.sys.actionLog?.entries, renderPlayerName]);

    const isCommandAllowed = (commandType: string) => {
        if (!isTutorialActive || !tutorialStep) return true;
        if (!tutorialStep.allowedCommands || tutorialStep.allowedCommands.length === 0) return !tutorialStep.infoStep;
        return tutorialStep.allowedCommands.includes(commandType);
    };

    const dispatchNextFrame = useCallback(<T extends keyof SplendorCommandMap>(type: T, payload: SplendorCommandMap[T]) => {
        window.requestAnimationFrame(() => {
            dispatch(type, payload);
        });
    }, [dispatch]);

    const formatPaymentText = (player: SplendorCore['players'][string], cardId: string): { affordable: boolean; text: string } => {
        const card = CARD_DEFS_BY_ID[cardId];
        const affordable = !!card && canAffordCard(player, card);
        const payment = card ? getPaymentTokens(player, card) : {};

        if (!affordable) {
            return { affordable, text: t('market.cannotAfford') };
        }

        if (Object.keys(payment).length === 0) {
            return { affordable, text: t('market.freePurchase') };
        }

        return {
            affordable,
            text: t('market.paymentText', {
                payment: Object.entries(payment)
                    .map(([color, count]) => `${t(COLOR_I18N_KEY[color as TokenColor])} ${count}`)
                    .join(' / '),
            }),
        };
    };

    const confirmTakeDifferentGems = () => {
        if (!canAct) {
            return;
        }
        if (selectedTakeColors.length < 1) {
            return;
        }
        setSelectedTakeColors([]);
        dispatchNextFrame('TAKE_THREE_DIFFERENT_GEMS', { colors: selectedTakeColors });
    };

    const confirmTakeTwoSame = (color: GemColor) => {
        if (!canAct) {
            return;
        }
        dispatchNextFrame('TAKE_TWO_SAME_GEMS', { color });
        setSelectedTakeColors([]);
    };

    const handleBankTokenClick = (color: TokenColor) => {
        if (!G.core.hostStarted && isOnlineMatch) return;
        if (!isMyTurn) return;

        if (pending?.type === 'discardToLimit') {
            if (self.tokens[color] <= 0) return;
            dispatchNextFrame('DISCARD_GEMS_TO_LIMIT', { color });
            return;
        }

        if (!isCommandAllowed('TAKE_THREE_DIFFERENT_GEMS') && !isCommandAllowed('TAKE_TWO_SAME_GEMS')) return;
        if (pending || getTokenCount(self) > 10) return;
        if (color === 'gold') return;
        if (G.core.bank[color] <= 0) return;

        const gemColor = color as GemColor;

        if (selectedTakeColors.length === 1 && selectedTakeColors[0] === color && G.core.bank[color] >= 4) {
            setSelectedTakeColors([]);
            dispatchNextFrame('TAKE_TWO_SAME_GEMS', { color: gemColor });
            return;
        }

        if (selectedTakeColors.includes(color)) {
            setSelectedTakeColors((current) => current.filter((item) => item !== color));
            return;
        }

        if (selectedTakeColors.length >= 3) return;

        const next = [...selectedTakeColors, color];
        if (next.length === 3) {
            setSelectedTakeColors([]);
            dispatchNextFrame('TAKE_THREE_DIFFERENT_GEMS', { colors: next });
            return;
        }

        setSelectedTakeColors(next);
    };

    const handleReserveDeckTop = useCallback((tier: CardTier) => {
        dispatchNextFrame('RESERVE_DECK_TOP_CARD', { tier });
    }, [dispatchNextFrame]);

    const handleReserveOpen = useCallback((tier: CardTier, cardId: string) => {
        dispatchNextFrame('RESERVE_OPEN_CARD', { tier, cardId });
    }, [dispatchNextFrame]);

    const handleBuyOpen = useCallback((tier: CardTier, cardId: string) => {
        pulseMarketCard(cardId);
        dispatchNextFrame('BUY_OPEN_CARD', { tier, cardId });
    }, [dispatchNextFrame, pulseMarketCard]);

    const handleBuyReserved = useCallback((cardId: string) => {
        dispatchNextFrame('BUY_RESERVED_CARD', { cardId });
    }, [dispatchNextFrame]);

    return (
        <div className="relative h-full min-h-full overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top,#1e293b,#020617_60%)] p-2 text-white md:p-3 xl:p-4">
            <div className="absolute inset-0 opacity-20">
                <OptimizedImage src={SPLENDOR_ASSETS.BOARD_DESK} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="absolute inset-0 bg-slate-950/55" />

            <div className="relative mx-auto flex max-w-[1360px] flex-col gap-3 origin-top xl:gap-4">
                {pending?.type === 'chooseNoble' ? (
                    <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-lg">
                        {t('banner.chooseNoble')}
                    </div>
                ) : null}

                {G.core.endgame.triggered ? (
                    <div className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100 shadow-lg">
                        {t('banner.endgameTriggered')}
                    </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg" data-tutorial-id="sp-header">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold">{t('title')}</h1>
                            <p className="text-sm text-white/70">
                                {t('status.currentTurn', { player: renderPlayerName(G.core.currentPlayer), round: G.core.round })}
                            </p>
                        </div>
                        <div className="text-sm text-white/70">
                            {G.core.gameResult
                                ? t('status.gameOver', { winners: G.core.gameResult.winners?.map(renderPlayerName).join(' / ') })
                                : isOnlineMatch && !G.core.hostStarted
                                    ? (areAllSeatsOccupied ? t('status.waitHostStart') : t('status.waitPlayers'))
                                : pending?.type === 'discardToLimit'
                                    ? t('status.discardPending', { excess: pending.excess })
                                    : pending?.type === 'chooseNoble'
                                        ? t('status.waitChooseNoble')
                                        : isMyTurn
                                            ? t('status.yourTurn')
                                            : t('status.waitOpponent')}
                        </div>
                    </div>
                </div>

                {isOnlineMatch && !G.core.hostStarted ? (
                    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
                        <div
                            className="pointer-events-auto flex w-full max-w-[720px] items-center justify-between gap-4 rounded-2xl border border-amber-400/35 bg-slate-950/72 px-4 py-3 shadow-[0_18px_48px_rgba(2,6,23,0.45)] backdrop-blur-xl"
                            data-testid="splendor-pregame-panel"
                        >
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-amber-100">
                                    {areAllSeatsOccupied ? t('pregame.readyTitle') : t('pregame.waitPlayersTitle')}
                                </div>
                                <div className="mt-1 text-xs text-white/70">
                                    {areAllSeatsOccupied
                                        ? (isHostPlayer ? t('pregame.hostCanStart') : t('pregame.waitHostStart'))
                                        : t('pregame.waitPlayersBody', { seated: seatedPlayerCount, total: G.core.setupPlayerCount })}
                                </div>
                                <div
                                    className="mt-2 text-xs font-medium text-amber-200/90"
                                    data-testid="splendor-starting-player"
                                >
                                    {t('pregame.startingPlayer', { player: startingPlayerName })}
                                </div>
                                <div className="mt-1 text-[11px] text-white/55">
                                    {t('pregame.startingPlayerHint')}
                                </div>
                            </div>
                            {areAllSeatsOccupied && isHostPlayer ? (
                                <button
                                    type="button"
                                    data-testid="splendor-start-game"
                                    className="shrink-0 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg transition-colors hover:bg-amber-400"
                                    onClick={() => dispatch('HOST_START_GAME', {})}
                                >
                                    {t('pregame.startGame')}
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                <div className="flex flex-col gap-4">
                    <div className="grid gap-4 xl:grid-cols-[50%_50%] xl:items-start">
                        <section className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg" data-tutorial-id="sp-nobles">
                            <div className="flex items-start gap-4">
                                <div className="flex shrink-0 flex-col items-center rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm font-semibold tracking-[0.18em] text-white/80">
                                    {nobleTitleChars.map((char) => (
                                        <span key={char} className="leading-tight">
                                            {char}
                                        </span>
                                    ))}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="grid grid-cols-3 gap-3">
                                        {G.core.nobleIds.map((nobleId) => {
                                            return (
                                                <div
                                                    key={nobleId}
                                                    className="relative flex flex-col items-center rounded-lg bg-white/5 p-2 transition-transform duration-200 hover:z-20 hover:scale-[1.2]"
                                                >
                                                    <div className="block w-24 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                                                        <SpritePreview preview={{ kind: 'noble', nobleId }} />
                                                    </div>
                                                    {pending?.type === 'chooseNoble' && pending.nobleIds.includes(nobleId) && canAct ? (
                                                        <button
                                                            data-testid={`splendor-choose-noble-${nobleId}`}
                                                            className="mt-2 rounded bg-fuchsia-600 px-2 py-0.5 text-[10px] text-white"
                                                            onClick={() => dispatch('CHOOSE_NOBLE', { nobleId })}
                                                        >
                                                            {t('actions.choose')}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {pending?.type === 'chooseNoble' ? (
                                        <div className="mt-3 text-xs text-white/55">
                                            {t('actions.chooseNobleHint')}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg" data-tutorial-id="sp-actions">
                            <h2 className="mb-3 text-lg font-semibold">{t('sections.actions')}</h2>
                            {isOnlineMatch && !G.core.hostStarted ? (
                                <div className="text-sm text-white/60">{t('actions.waitPlayers')}</div>
                            ) : !isMyTurn ? (
                                <div className="text-sm text-white/60">{t('actions.notYourTurn')}</div>
                            ) : pending?.type === 'discardToLimit' ? (
                                <div className="text-sm text-white/70">{t('actions.discardHint')}</div>
                            ) : pending?.type === 'chooseNoble' ? (
                                <div className="text-sm text-white/70">{t('actions.chooseNobleHint')}</div>
                            ) : (
                                <div className="grid gap-4">
                                    <div className="rounded-lg bg-white/5 p-3 text-xs text-white/70">
                                        {t('actions.reserveStatus', {
                                            remain: Math.max(0, 3 - self.reservedCardIds.length),
                                            gold: G.core.bank.gold,
                                        })}
                                    </div>
                                    <div className="text-sm text-white/70">{t('actions.reserveDeckHint')}</div>
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[60%_12%_28%] xl:items-stretch">
                        <MarketSection
                            core={G.core}
                            tiers={TIERS}
                            canAct={canAct}
                            pending={pending}
                            reserveDisabled={reserveDisabled}
                            canReserveDeckTop={isCommandAllowed('RESERVE_DECK_TOP_CARD')}
                            canBuyOpen={isCommandAllowed('BUY_OPEN_CARD')}
                            canReserveOpen={isCommandAllowed('RESERVE_OPEN_CARD')}
                            highlightedCardIds={highlightedMarketCardIds}
                            formatPaymentText={(cardId) => formatPaymentText(self, cardId)}
                            onReserveDeckTop={handleReserveDeckTop}
                            onBuyOpen={handleBuyOpen}
                            onReserveOpen={handleReserveOpen}
                        />

                        <section className="rounded-2xl border border-white/10 bg-black/20 p-3 shadow-lg">
                            <h2 className="mb-3 text-center text-sm font-semibold" data-tutorial-id="sp-bank">{t('sections.bank')}</h2>
                            <div className="grid gap-2">
                                {Object.entries(G.core.bank).map(([color, count]) => {
                                    const tokenColor = color as TokenColor;
                                    const gemColor = color as GemColor;
                                    const isSelected = selectedTakeColors.includes(gemColor);
                                    const isDiscardMode = pending?.type === 'discardToLimit';
                                    const tokenLimitExceeded = getTokenCount(self) > 10;
                                    const isClickable = isDiscardMode
                                        ? isMyTurn && self.tokens[tokenColor] > 0
                                        : canAct
                                            && !pending
                                            && !tokenLimitExceeded
                                            && count > 0
                                            && color !== 'gold'
                                            && (isCommandAllowed('TAKE_THREE_DIFFERENT_GEMS') || isCommandAllowed('TAKE_TWO_SAME_GEMS'));

                                    return (
                                        <button
                                            key={color}
                                            type="button"
                                            disabled={!isClickable}
                                            data-testid={`splendor-bank-token-${tokenColor}`}
                                            className={`rounded-lg p-2 text-left transition-all ${
                                                isSelected
                                                    ? 'bg-sky-500/20 ring-2 ring-sky-300'
                                                    : 'bg-white/5 hover:bg-white/10'
                                            } ${isClickable ? 'cursor-pointer' : 'cursor-default opacity-70 disabled:opacity-70'}`}
                                            onClick={() => handleBankTokenClick(tokenColor)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
                                                    <OptimizedImage
                                                        src={SPLENDOR_TOKEN_IMAGE_BY_COLOR[tokenColor]}
                                                        alt={t(COLOR_I18N_KEY[tokenColor])}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm text-white/80">{count}</div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-3 rounded-lg bg-white/5 p-2" data-tutorial-id="sp-bank-confirm">
                                <div className="mb-2 text-center text-xs font-medium text-white/70">{t('bank.confirmTitle')}</div>
                                {pending?.type === 'discardToLimit' ? (
                                    <div className="text-center text-xs text-white/55">
                                        {t('bank.discardPending', { excess: pending.excess })}
                                    </div>
                                ) : selectedTakeColors.length > 0 ? (
                                    <div className="grid gap-2">
                                        <div className="flex flex-wrap justify-center gap-1">
                                            {selectedTakeColors.map((color) => (
                                                <span key={color} className="rounded bg-sky-500/20 px-2 py-1 text-xs text-sky-100">
                                                    {t(COLOR_I18N_KEY[color as TokenColor])}
                                                </span>
                                            ))}
                                        </div>
                                        {selectedTakeColors.length === 1 && G.core.bank[selectedTakeColors[0]] >= 4 ? (
                                            <button
                                                className="rounded bg-indigo-500 px-2 py-2 text-xs font-medium text-slate-950"
                                                data-testid={`splendor-take-two-${selectedTakeColors[0]}`}
                                                onClick={() => confirmTakeTwoSame(selectedTakeColors[0])}
                                            >
                                                {t('bank.takeTwoSame')}
                                            </button>
                                        ) : null}
                                        <button
                                            className="rounded bg-sky-500 px-2 py-2 text-xs font-medium text-slate-950 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50"
                                            data-testid="splendor-bank-confirm-different"
                                            disabled={
                                                selectedTakeColors.length === 0
                                                || (selectedTakeColors.length < 3 && GEM_COLORS.filter((bankColor) => G.core.bank[bankColor] > 0).length >= 3)
                                            }
                                            onClick={confirmTakeDifferentGems}
                                        >
                                            {t('bank.takeDifferent')}
                                        </button>
                                        <button
                                            className="rounded border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80"
                                            data-testid="splendor-bank-clear-selection"
                                            onClick={() => setSelectedTakeColors([])}
                                        >
                                            {t('bank.clear')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center text-xs text-white/45">{t('bank.pickHint')}</div>
                                )}
                            </div>
                            <div className="mt-3 text-center text-[11px] text-white/45">
                                {pending?.type === 'discardToLimit'
                                    ? t('bank.discardHint')
                                    : getTokenCount(self) > 10
                                        ? t('bank.overLimitHint')
                                        : t('bank.selectHint')}
                            </div>
                        </section>

                        <PlayerStatusPanel
                            key={selfId}
                            core={G.core}
                            selfId={selfId}
                            self={self}
                            canAct={canAct}
                            pending={pending}
                            canBuyReserved={isCommandAllowed('BUY_RESERVED_CARD')}
                            renderPlayerName={renderPlayerName}
                            formatPaymentText={(cardId) => formatPaymentText(self, cardId)}
                            onBuyReserved={handleBuyReserved}
                        />

                        <section className="rounded-2xl border border-white/10 bg-black/20 p-3 shadow-lg" data-tutorial-id="sp-action-log">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between text-left"
                                onClick={() => setIsActionLogExpanded((value) => !value)}
                            >
                                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                                    {t('sections.actionLog')}
                                </h2>
                                <span className="text-xs text-white/45">
                                    {isActionLogExpanded ? t('common.collapse') : t('common.expand')}
                                </span>
                            </button>
                            <div className={`overflow-hidden transition-[max-height] duration-200 ${isActionLogExpanded ? 'mt-3 max-h-[22rem]' : 'max-h-0'}`}>
                                {actionLogRows.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-5 text-center text-xs text-white/45">
                                        {t('actionLog.empty')}
                                    </div>
                                ) : (
                                    <div className="max-h-[20rem] space-y-2 overflow-y-auto pr-1">
                                        {actionLogRows.map((row) => (
                                            <div key={row.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5" data-testid="splendor-action-log-row">
                                                <div className="text-xs leading-relaxed text-white/90">
                                                    <span className="font-medium text-white/70">{row.playerLabel}：</span>
                                                    <ActionLogSegments
                                                        segments={row.segments}
                                                        locale={i18n.language}
                                                        getCardPreviewRef={getCardPreviewRef}
                                                        cardPreviewMaxDim={cardPreviewMaxDim}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                </div>
            </div>
        </div>
    );
}
