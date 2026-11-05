import React from 'react';
import type { QidahenHandCard, QidahenCore, QidahenFactionId, QidahenHandLimitDiscardSelection } from '../domain';
import type { QidahenMagnifyTarget } from './boardTypes';
import {
    CARD_DIMENSIONS,
    HAND_CARD_KIND_LABELS,
    HAND_CARD_SELECTED_LIFT,
    HAND_CARD_SELECTED_SCALE,
    STAGE_WIDTH,
    HAND_DOCK_WIDTH,
    UI_STYLE,
    UI_SURFACE,
    BOTTOM_DOCK_INSET,
    CARD_BACK_BY_FACTION,
    ASSETS,
} from './boardLayout';
import {
    getQidahenHandCardOverlapPx,
    getQidahenHandCardTutorialTargetId,
    getQidahenMobileLandscapeHandLayout,
} from './boardReadModel';
import { useTranslation } from 'react-i18next';
import { getQidahenHandCardBadgeKind, getQidahenDirectActionIdForHandCard } from '../domain/handCardIdentity';
import { SelectableGameObject } from '../../../components/game/framework';
import { CardPreviewFit, DeckStack } from './CardSurfaces';
import { MOBILE_MAX_VIEWPORT_WIDTH } from '../../../shared/mobileSupport';
import { getCurrentFactionId } from '../domain/factionTurnAccessors';
import { isQidahenFeignedRetreatCardPlayable } from '../domain/feignedRetreatSelection';
import { isQidahenTacticCardPlayableForPendingBattle } from '../domain/commands';
import { isQidahenDefeatInDetailPlayable } from '../domain/defeatInDetail';

export const HandCard: React.FC<{
    card: QidahenHandCard;
    locale?: string;
    selected?: boolean;
    stackIndex: number;
    totalCards: number;
    width?: number;
    height?: number;
    overlapPx?: number;
    multiSelectMode?: boolean;
    onClick?: () => void;
    onMagnify?: (target: QidahenMagnifyTarget) => void;
}> = ({
    card,
    locale,
    selected = false,
    stackIndex,
    totalCards,
    width = CARD_DIMENSIONS.hand.width,
    height = CARD_DIMENSIONS.hand.height,
    overlapPx = getQidahenHandCardOverlapPx(totalCards),
    multiSelectMode = false,
    onClick,
    onMagnify,
}) => {
    const { t } = useTranslation('game-qidahen');
    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressActivatedRef = React.useRef(false);
    const disabled = card.status === 'disabled';
    const cardKindBadgeKind = getQidahenHandCardBadgeKind(card);
    const cardKindBadge = cardKindBadgeKind ? HAND_CARD_KIND_LABELS[cardKindBadgeKind] : null;
    const selectedLift = multiSelectMode && selected ? 30 : HAND_CARD_SELECTED_LIFT;
    const selectedTransform = selected
        ? `translateY(-${selectedLift}px) scale(${HAND_CARD_SELECTED_SCALE})`
        : undefined;
    const clearLongPressTimer = React.useCallback(() => {
        if (longPressTimerRef.current != null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (longPressResetTimerRef.current != null) {
            window.clearTimeout(longPressResetTimerRef.current);
            longPressResetTimerRef.current = null;
        }
    }, []);
    const inspectTarget = {
        previewRef: card.previewRef,
        title: card.label,
        rawWidth: CARD_DIMENSIONS.hand.rawWidth,
        rawHeight: CARD_DIMENSIONS.hand.rawHeight,
    } satisfies QidahenMagnifyTarget;

    React.useEffect(
        () => () => {
            clearLongPressTimer();
        },
        [clearLongPressTimer],
    );

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        clearLongPressTimer();
        longPressActivatedRef.current = false;
        if (event.pointerType !== 'touch' || disabled || !onMagnify) {
            return;
        }
        longPressTimerRef.current = window.setTimeout(() => {
            longPressTimerRef.current = null;
            longPressActivatedRef.current = true;
            onMagnify(inspectTarget);
        }, 620);
    };

    const handlePointerEnd = () => {
        clearLongPressTimer();
        if (longPressActivatedRef.current) {
            longPressResetTimerRef.current = window.setTimeout(() => {
                longPressActivatedRef.current = false;
                longPressResetTimerRef.current = null;
            }, 500);
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (longPressActivatedRef.current) {
            if (longPressResetTimerRef.current != null) {
                window.clearTimeout(longPressResetTimerRef.current);
                longPressResetTimerRef.current = null;
            }
            event.preventDefault();
            event.stopPropagation();
            longPressActivatedRef.current = false;
            return;
        }
        onClick?.();
    };

    return (
        <div
            className="relative shrink-0 rounded-[11px]"
            data-qidahen-hand-card-selected={selected ? 'true' : undefined}
            data-testid={`qidahen-hand-card-shell-${card.id}`}
            style={{
                width,
                height,
                zIndex: selected && !multiSelectMode ? totalCards + 12 : stackIndex + 1,
                marginLeft: stackIndex === 0 ? 0 : overlapPx,
                transform: selectedTransform,
                transformOrigin: 'bottom center',
                transition: 'transform 180ms ease-out',
            }}
        >
            <SelectableGameObject
                aria-label={card.label}
                disabled={disabled}
                selected={selected}
                available={Boolean(onClick)}
                data-testid={`qidahen-hand-card-${card.id}`}
                data-tutorial-id={getQidahenHandCardTutorialTargetId(card)}
                data-qidahen-hand-card-touch-inspect="long-press"
                tabIndex={disabled ? -1 : 0}
                className={`z-20 h-full w-full origin-bottom rounded-[9px] bg-transparent hover:z-50 hover:brightness-[1.03] ${selected ? 'brightness-[1.08]' : 'hover:-translate-y-[18px]'}`}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
                onContextMenu={(event) => {
                    if (longPressActivatedRef.current) {
                        event.preventDefault();
                    }
                }}
                style={{
                    background: 'transparent',
                    borderRadius: 9,
                    touchAction: 'manipulation',
                }}
            >
                <span
                    className="pointer-events-none absolute inset-0 z-0 rounded-[9px]"
                    style={{
                        boxShadow: selected
                            ? '0 0 0 4px rgba(255,226,157,0.98), 0 12px 22px rgba(56,35,15,0.42), 0 0 24px rgba(255,226,157,0.82)'
                            : '0 8px 16px rgba(56,35,15,0.18)',
                    }}
                />
                <span className="pointer-events-none relative z-10 block h-full w-full overflow-hidden rounded-[9px]">
                    <CardPreviewFit
                        previewRef={card.previewRef}
                        locale={locale}
                        title={card.label}
                        width={width}
                        height={height}
                        rawWidth={CARD_DIMENSIONS.hand.rawWidth}
                        rawHeight={CARD_DIMENSIONS.hand.rawHeight}
                    />
                </span>
                {selected ? (
                    <span
                        className="pointer-events-none absolute inset-0 z-20 rounded-[9px] bg-amber-300/15"
                        data-testid={`qidahen-hand-card-selected-wash-${card.id}`}
                    />
                ) : null}
                {selected ? (
                    <span
                        className="pointer-events-none absolute bottom-2 left-2 z-40 rounded border-[2px] border-[#fff0b0] bg-[rgba(104,57,20,0.96)] px-2 py-1 text-[12px] font-black tracking-wide text-[#fff4c9] shadow-[0_3px_8px_rgba(56,35,15,0.42)]"
                        data-testid={`qidahen-hand-card-selected-badge-${card.id}`}
                    >
                        {t('board.handInteraction.selectedSeal', { defaultValue: '已选' })}
                    </span>
                ) : null}
                {cardKindBadge ? (
                    <span
                        className="pointer-events-none absolute left-2 top-2 z-30 rounded border-[2px] px-2 py-0.5 text-[11px] font-black"
                        data-testid={`qidahen-hand-card-kind-${card.id}`}
                        style={{
                            borderColor: '#4d3620',
                            background: 'rgba(245, 231, 206, 0.92)',
                            color: '#402a18',
                            boxShadow: '0 3px 8px rgba(56,35,15,0.18)',
                        }}
                    >
                        {cardKindBadge}
                    </span>
                ) : null}
            </SelectableGameObject>
        </div>
    );
};

export const HandZone: React.FC<{
    core: QidahenCore;
    pendingTargetAction: QidahenCore['pendingTargetAction'];
    viewerFactionId: QidahenFactionId | null;
    playerID: string | null;
    locale?: string;
    mapTargetSelectionActive?: boolean;
    actionPaymentPreviewVisible: boolean;
    selectedPaymentCardIds: string[];
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null;
    selectedHandLimitCardIds: string[];
    onTogglePaymentCard: (cardId: string) => void;
    onToggleHandLimitDiscardCard: (cardId: string) => void;
    onSelectSunYuanhuaTechCard: (cardId: string) => void;
    onSelectGaoDiDispatchCard: (cardId: string) => void;
    onPlayTacticCard: (cardId: string) => void;
    onPlayBattleResponseEventCard: (cardId: string) => void;
    onPreviewActionFromHandCard: (card: QidahenHandCard) => void;
    onMagnifyCard?: (target: QidahenMagnifyTarget) => void;
}> = ({
    core,
    pendingTargetAction,
    viewerFactionId,
    playerID,
    locale,
    mapTargetSelectionActive = false,
    actionPaymentPreviewVisible,
    selectedPaymentCardIds,
    handLimitDiscardSelection,
    selectedHandLimitCardIds,
    onTogglePaymentCard,
    onToggleHandLimitDiscardCard,
    onSelectSunYuanhuaTechCard,
    onSelectGaoDiDispatchCard,
    onPlayTacticCard,
    onPlayBattleResponseEventCard,
    onPreviewActionFromHandCard,
    onMagnifyCard,
}) => {
    const { t } = useTranslation('game-qidahen');
    const [isMobileLandscapeViewport, setIsMobileLandscapeViewport] = React.useState(
        () =>
            typeof window !== 'undefined' &&
            window.innerWidth <= MOBILE_MAX_VIEWPORT_WIDTH &&
            window.innerWidth > window.innerHeight,
    );
    const [mobileViewportWidth, setMobileViewportWidth] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth : STAGE_WIDTH,
    );
    const [selectedTacticCardId, setSelectedTacticCardId] = React.useState<string | null>(null);
    React.useEffect(() => {
        const updateViewportMode = () => {
            setIsMobileLandscapeViewport(
                window.innerWidth <= MOBILE_MAX_VIEWPORT_WIDTH && window.innerWidth > window.innerHeight,
            );
            setMobileViewportWidth(window.innerWidth);
        };
        updateViewportMode();
        window.addEventListener('resize', updateViewportMode);
        return () => {
            window.removeEventListener('resize', updateViewportMode);
        };
    }, []);
    const currentFactionId =
        handLimitDiscardSelection?.factionId ??
        (playerID == null ? (viewerFactionId ?? getCurrentFactionId(core)) : viewerFactionId);
    if (!currentFactionId) {
        return null;
    }
    const currentFaction = core.factions[currentFactionId];
    const currentHandCards = core.handCards.filter((card) => card.faction === currentFactionId);
    const selectedTacticCard = currentHandCards.find((card) => card.id === selectedTacticCardId) ?? null;
    const handDockWidth = isMobileLandscapeViewport ? Math.max(360, mobileViewportWidth - 190) : HAND_DOCK_WIDTH;
    const handDockMaxWidth: number | string = isMobileLandscapeViewport ? handDockWidth : 'calc(100vw - 320px)';
    const mobileHandLayout = getQidahenMobileLandscapeHandLayout(handDockWidth);
    const handCardWidth = isMobileLandscapeViewport ? mobileHandLayout.width : CARD_DIMENSIONS.hand.width;
    const handCardHeight = isMobileLandscapeViewport ? mobileHandLayout.height : CARD_DIMENSIONS.hand.height;
    const handCardSelectedLift = isMobileLandscapeViewport ? 36 : HAND_CARD_SELECTED_LIFT;
    const bottomDockHeight = handCardHeight + handCardSelectedLift + 4;
    const multiSelectMode = actionPaymentPreviewVisible || handLimitDiscardSelection != null;
    const handCardOverlapPx = multiSelectMode
        ? 0
        : getQidahenHandCardOverlapPx(
              currentHandCards.length,
              handCardWidth,
              isMobileLandscapeViewport ? mobileHandLayout.availableWidth : undefined,
          );
    const isHandCardSelected = (card: QidahenHandCard): boolean =>
        selectedPaymentCardIds.includes(card.id) ||
        selectedHandLimitCardIds.includes(card.id) ||
        (core.sunYuanhuaTechSelection?.selectedCardIds.includes(card.id) ?? false) ||
        core.gaoDiDispatchSelection?.selectedCardId === card.id ||
        selectedTacticCardId === card.id;
    const dockBottomInset = 'var(--qidahen-mobile-bottom-inset, 0px)';

    return (
        <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[80]"
            data-testid="qidahen-bottom-dock"
            style={{
                height: bottomDockHeight,
                bottom: dockBottomInset,
            }}
        >
            {selectedTacticCard ? (
                <div
                    className="pointer-events-auto absolute left-1/2 z-[96] flex items-center justify-between gap-3 border-[3px] px-4 py-3"
                    data-testid="qidahen-tactic-card-selection-panel"
                    data-ui-anchor="bottom-hand"
                    style={{
                        bottom: handCardHeight + handCardSelectedLift + 12,
                        transform: 'translateX(-50%)',
                        width: Math.min(620, handDockWidth - 48),
                        borderColor: UI_STYLE.oldGold,
                        background: UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <div
                            className="truncate text-[13px] font-black leading-5"
                            data-testid="qidahen-selected-tactic-card-label"
                        >
                            {t('board.handInteraction.selectedTacticCard', {
                                card: selectedTacticCard.label,
                                defaultValue: '已选战术牌「{{card}}」',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.handInteraction.tacticCardHint', {
                                defaultValue: '点击“打出战术牌”确认；再次点击这张手牌可取消选中。',
                            })}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            data-testid="qidahen-confirm-tactic-card"
                            data-tutorial-id="qidahen-confirm-tactic-card"
                            className="inline-flex min-h-[40px] min-w-[128px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={() => onPlayTacticCard(selectedTacticCard.id)}
                            style={{
                                borderColor: UI_STYLE.mapInk,
                                background: UI_SURFACE.paper,
                                color: UI_STYLE.ink,
                                boxShadow: UI_SURFACE.hardShadow,
                                borderRadius: 3,
                            }}
                        >
                            {t('board.handInteraction.confirmTacticCard', { defaultValue: '打出战术牌' })}
                        </button>
                        <button
                            type="button"
                            data-testid="qidahen-cancel-tactic-card"
                            className="inline-flex min-h-[40px] min-w-[88px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={() => setSelectedTacticCardId(null)}
                            style={{
                                borderColor: UI_STYLE.mapInk,
                                background: UI_SURFACE.paper,
                                color: UI_STYLE.ink,
                                boxShadow: UI_SURFACE.hardShadow,
                                borderRadius: 3,
                            }}
                        >
                            {t('board.handInteraction.cancelTacticCard', { defaultValue: '取消' })}
                        </button>
                    </div>
                </div>
            ) : null}
            <div
                className="pointer-events-auto absolute left-[44px]"
                data-testid="qidahen-draw-anchor"
                style={{ bottom: BOTTOM_DOCK_INSET, left: 'calc(44px - var(--qidahen-mobile-edge-pull, 0px))' }}
            >
                <DeckStack
                    src={CARD_BACK_BY_FACTION[currentFactionId]}
                    label={`${currentFaction.name}抽牌`}
                    count={currentFaction.drawPileCount}
                    testId="qidahen-draw-pile"
                />
            </div>
            <div
                className={`${mapTargetSelectionActive ? 'pointer-events-none' : 'pointer-events-auto'} absolute left-1/2 flex items-end ${isMobileLandscapeViewport ? 'justify-start' : 'justify-center'} overflow-x-auto overflow-y-visible`}
                data-testid="qidahen-hand-zone"
                data-tutorial-id="qidahen-hand-zone"
                data-ui-role="qidahen-hand-dock"
                data-map-target-selection-active={mapTargetSelectionActive ? 'true' : undefined}
                style={{
                    bottom: BOTTOM_DOCK_INSET,
                    transform: 'translateX(-50%)',
                    height: bottomDockHeight,
                    width: handDockWidth,
                    maxWidth: handDockMaxWidth,
                }}
            >
                <div className="mx-auto flex min-w-max items-end justify-center px-2" data-testid="qidahen-hand-row">
                    {currentHandCards.map((card, index) => {
                        const selectableForHandLimit =
                            handLimitDiscardSelection?.candidateCardIds.includes(card.id) ?? false;
                        const sunYuanhuaSelection = core.sunYuanhuaTechSelection;
                        const selectableForSunYuanhua =
                            sunYuanhuaSelection?.candidateCardIds.includes(card.id) ?? false;
                        const gaoDiSelection = core.gaoDiDispatchSelection;
                        const selectableForGaoDi = gaoDiSelection?.candidateCardIds.includes(card.id) ?? false;
                        const tacticSide =
                            pendingTargetAction?.attackerFactionId === card.faction
                                ? 'attacker'
                                : pendingTargetAction?.defenderFactionId === card.faction
                                  ? 'defender'
                                  : null;
                        const selectableForTactic =
                            !actionPaymentPreviewVisible &&
                            !selectableForHandLimit &&
                            !selectableForSunYuanhua &&
                            !selectableForGaoDi &&
                            pendingTargetAction != null &&
                            tacticSide != null &&
                            card.cardKind === 'tactic' &&
                            card.status !== 'disabled' &&
                            (isQidahenFeignedRetreatCardPlayable(core, card) ||
                                isQidahenTacticCardPlayableForPendingBattle(
                                    core,
                                    card,
                                    pendingTargetAction,
                                    tacticSide,
                                ));
                        const selectableForBattleResponseEvent =
                            !actionPaymentPreviewVisible &&
                            !selectableForHandLimit &&
                            !selectableForSunYuanhua &&
                            !selectableForGaoDi &&
                            pendingTargetAction != null &&
                            isQidahenDefeatInDetailPlayable(core, card, pendingTargetAction);
                        const selectableForActionPayment = actionPaymentPreviewVisible && card.status !== 'disabled';
                        const selectableForDirectHandAction =
                            !actionPaymentPreviewVisible &&
                            !selectableForHandLimit &&
                            !selectableForSunYuanhua &&
                            !selectableForGaoDi &&
                            !selectableForBattleResponseEvent &&
                            getQidahenDirectActionIdForHandCard(card) != null;
                        return (
                            <HandCard
                                key={card.id}
                                card={card}
                                locale={locale}
                                selected={isHandCardSelected(card)}
                                stackIndex={index}
                                totalCards={currentHandCards.length}
                                width={handCardWidth}
                                height={handCardHeight}
                                overlapPx={handCardOverlapPx}
                                multiSelectMode={multiSelectMode}
                                onMagnify={onMagnifyCard}
                                onClick={
                                    selectableForHandLimit
                                        ? () => onToggleHandLimitDiscardCard(card.id)
                                        : selectableForSunYuanhua
                                          ? () => onSelectSunYuanhuaTechCard(card.id)
                                          : selectableForGaoDi
                                            ? () => onSelectGaoDiDispatchCard(card.id)
                                            : selectableForBattleResponseEvent
                                              ? () => onPlayBattleResponseEventCard(card.id)
                                              : selectableForTactic
                                                ? () =>
                                                      setSelectedTacticCardId((current) =>
                                                          current === card.id ? null : card.id,
                                                      )
                                                : selectableForDirectHandAction
                                                  ? () => onPreviewActionFromHandCard(card)
                                                  : selectableForActionPayment
                                                    ? () => onTogglePaymentCard(card.id)
                                                    : undefined
                                }
                            />
                        );
                    })}
                </div>
            </div>
            <div
                className="pointer-events-none absolute left-1/2 flex items-end justify-center overflow-visible"
                style={{
                    bottom: BOTTOM_DOCK_INSET,
                    transform: 'translateX(-50%)',
                    height: bottomDockHeight,
                    width: handDockWidth,
                    maxWidth: handDockMaxWidth,
                }}
            >
                <div className="mx-auto flex min-w-max items-end justify-center px-2">
                    {currentHandCards.map((card, index) => {
                        const selected = isHandCardSelected(card);
                        return (
                            <div
                                key={`magnify-${card.id}`}
                                className="pointer-events-none relative shrink-0"
                                style={{
                                    width: handCardWidth,
                                    height: handCardHeight,
                                    zIndex: selected
                                        ? currentHandCards.length + 48
                                        : currentHandCards.length + index + 24,
                                    marginLeft: index === 0 ? 0 : handCardOverlapPx,
                                    transform: selected
                                        ? `translateY(-${handCardSelectedLift}px) scale(${HAND_CARD_SELECTED_SCALE})`
                                        : undefined,
                                    transformOrigin: 'bottom center',
                                    transition: 'transform 180ms ease-out',
                                }}
                            >
                                <button
                                    type="button"
                                    data-testid={`qidahen-hand-card-magnify-${card.id}`}
                                    aria-label={t('board.magnifyCardAria', { card: card.label })}
                                    className={`${mapTargetSelectionActive || handLimitDiscardSelection != null ? 'pointer-events-none' : 'pointer-events-auto'} absolute right-1 top-1 inline-flex items-center justify-center rounded-full border-[2px] text-[11px] font-black transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30 ${isMobileLandscapeViewport ? 'h-11 min-w-11' : 'h-[26px] min-w-[26px]'}`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onMagnifyCard?.({
                                            previewRef: card.previewRef,
                                            title: card.label,
                                            rawWidth: CARD_DIMENSIONS.hand.rawWidth,
                                            rawHeight: CARD_DIMENSIONS.hand.rawHeight,
                                        });
                                    }}
                                    style={{
                                        borderColor: '#4d3620',
                                        background: 'rgba(245, 231, 206, 0.92)',
                                        color: '#402a18',
                                        boxShadow: '0 3px 8px rgba(56,35,15,0.18)',
                                    }}
                                >
                                    {t('board.magnifyButton')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div
                className="absolute right-[44px]"
                data-testid="qidahen-discard-anchor"
                style={{ bottom: BOTTOM_DOCK_INSET, right: 'calc(44px - var(--qidahen-mobile-edge-pull, 0px))' }}
            >
                <DeckStack
                    src={ASSETS.coverCard}
                    label={`${currentFaction.name}弃牌`}
                    count={currentFaction.discardPileCount}
                    tone="red"
                    testId="qidahen-discard-pile"
                />
            </div>
        </div>
    );
};
