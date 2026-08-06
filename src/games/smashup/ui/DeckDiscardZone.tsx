import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Hourglass, Library, Trash2 } from 'lucide-react';
import type { CardInstance, TitanState } from '../domain/types';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { PromptOverlay } from './PromptOverlay';
import { UI_Z_INDEX } from '../../../core';
import { SMASHUP_CARD_BACK } from '../domain/ids';
import { getCardDef, getTitanDef, resolveCardName } from '../data/cards';
import { MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE } from '../domain/types';
import {
    getMunchkinSpecialCardDescriptor,
    MUNCHKIN_MONSTER_DECK_PREVIEW_DEF_ID,
    MUNCHKIN_MONSTER_DECK_SIZE,
    MUNCHKIN_TREASURE_DECK_PREVIEW_DEF_ID,
    MUNCHKIN_TREASURE_DECK_SIZE,
} from '../data/factions/munchkin';
import { useTouchInspectGesture } from '../../../hooks/ui/useTouchInspectGesture';
import { getAccessoryChromeClass, getAccessorySurfaceClass } from './accessoryHighlight';

const CARD_ASPECT_RATIO = 0.714;
const DECK_DISCARD_LAYER_Z_INDEX = UI_Z_INDEX.hud + 1;

function cardHeight(width: string): string {
    return `calc(${width} / ${CARD_ASPECT_RATIO})`;
}

function getTimeBoxCounterLabel(titan: TitanState): string | null {
    if (titan.defId !== 'time_travelers_time_box') return null;
    const counters = Number(titan.metadata?.timeBoxCounters ?? 0);
    if (!Number.isFinite(counters) || counters <= 0) return null;
    return String(counters);
}

type Props = {
    deckCount: number;
    deckQueryEnabled?: boolean;
    deckCards?: CardInstance[];
    deckFactions?: string[];
    madnessSupplyCount?: number;
    monsterDeckCount?: number;
    treasureDeckCount?: number;
    discard: CardInstance[];
    isMyTurn: boolean;
    compactLayout?: boolean;
    onViewCard?: (card: CardInstance) => void;
    /** 弃牌堆中有可从弃牌堆打出的卡牌时为 true（仅用于视觉提示） */
    hasPlayableFromDiscard?: boolean;
    /** 是否为 interaction 驱动的弃牌堆选择（僵尸领主等），自动打开面板 */
    autoOpenPanel?: boolean;
    /** 可从弃牌堆打出的卡牌列表；uid 是选择态唯一真相源。 */
    playableCards?: { uid: string; defId: string; label: string }[];
    /** 当前选中的卡牌 uid */
    selectedUid?: string | null;
    /** 多选时当前选中的卡牌 uid 集合 */
    selectedUids?: Set<string>;
    /** 选中卡牌回调 */
    onSelectCard?: (uid: string | null) => void;
    /** 选中提示文本 */
    selectHint?: string;
    /** 多选确认回调 */
    onConfirmSelection?: () => void;
    confirmDisabled?: boolean;
    minSelections?: number;
    maxSelections?: number;
    /** 关闭弃牌堆面板的回调（含清理逻辑） */
    onClosePanel?: () => void;
    setAsideTitans?: TitanState[];
    activatableTitanUids?: Set<string>;
    reactionTitanUids?: Set<string>;
    selectedTitanUid?: string | null;
    onSelectTitan?: (titanUid: string) => void;
    onViewTitan?: (defId: string) => void;
    dispatch: (type: string, payload?: unknown) => void;
    playerID: string | null;
    playerNames?: Record<string, string>;
    focusedTitanPrompt?: boolean;
};

export const DeckDiscardZone: React.FC<Props> = ({
    deckCount,
    deckQueryEnabled = false,
    deckCards = [],
    deckFactions = [],
    madnessSupplyCount,
    monsterDeckCount,
    treasureDeckCount,
    discard,
    isMyTurn,
    compactLayout = false,
    onViewCard,
    hasPlayableFromDiscard,
    autoOpenPanel,
    playableCards,
    selectedUid,
    selectedUids,
    onSelectCard,
    selectHint,
    onConfirmSelection,
    confirmDisabled,
    minSelections,
    maxSelections,
    onClosePanel,
    setAsideTitans = [],
    activatableTitanUids,
    reactionTitanUids,
    selectedTitanUid,
    onSelectTitan,
    onViewTitan,
    dispatch,
    playerID,
    playerNames,
    focusedTitanPrompt = false,
}) => {
    const { t } = useTranslation('game-smashup');
    const [showDeck, setShowDeck] = useState(false);
    const [showDiscard, setShowDiscard] = useState(false);
    const clampedMadnessSupplyCount = typeof madnessSupplyCount === 'number'
        ? Math.max(0, Math.min(MADNESS_DECK_SIZE, madnessSupplyCount))
        : undefined;
    const clampedMonsterDeckCount = typeof monsterDeckCount === 'number'
        ? Math.max(0, Math.min(MUNCHKIN_MONSTER_DECK_SIZE, monsterDeckCount))
        : undefined;
    const clampedTreasureDeckCount = typeof treasureDeckCount === 'number'
        ? Math.max(0, Math.min(MUNCHKIN_TREASURE_DECK_SIZE, treasureDeckCount))
        : undefined;
    const monsterDeckPreview = getMunchkinSpecialCardDescriptor(MUNCHKIN_MONSTER_DECK_PREVIEW_DEF_ID);
    const treasureDeckPreview = getMunchkinSpecialCardDescriptor(MUNCHKIN_TREASURE_DECK_PREVIEW_DEF_ID);
    const supplyBadges = [
        ...(clampedMadnessSupplyCount !== undefined
            ? [{
                key: 'madness',
                testId: 'su-madness-supply',
                countTestId: 'su-madness-supply-count',
                title: `疯狂牌剩余 ${clampedMadnessSupplyCount}`,
                count: clampedMadnessSupplyCount,
                previewRef: { type: 'renderer' as const, rendererId: 'smashup-card-renderer', payload: { defId: MADNESS_CARD_DEF_ID, cardUid: 'madness-supply-preview' } },
                cardClassName: 'h-8 w-[22px]',
            }]
            : []),
        ...(clampedMonsterDeckCount !== undefined && monsterDeckPreview
            ? [{
                key: 'monster',
                testId: 'su-munchkin-monster-supply',
                countTestId: 'su-munchkin-monster-supply-count',
                title: `怪物牌库剩余 ${clampedMonsterDeckCount}`,
                count: clampedMonsterDeckCount,
                previewRef: monsterDeckPreview.previewRef,
                cardClassName: 'h-8 w-[46px]',
            }]
            : []),
        ...(clampedTreasureDeckCount !== undefined && treasureDeckPreview
            ? [{
                key: 'treasure',
                testId: 'su-munchkin-treasure-supply',
                countTestId: 'su-munchkin-treasure-supply-count',
                title: `宝藏牌库剩余 ${clampedTreasureDeckCount}`,
                count: clampedTreasureDeckCount,
                previewRef: treasureDeckPreview.previewRef,
                cardClassName: 'h-8 w-[22px]',
            }]
            : []),
    ];
    const stackWidth = compactLayout ? '8.6vw' : '7.5vw';
    const titanWidth = compactLayout ? '5.6vw' : '4.8vw';
    const labelMinHeight = compactLayout ? '24px' : '20px';
    const labelFontSize = compactLayout ? '11px' : '10px';
    const titanAbilityBadgeFontSize = compactLayout ? '10px' : '9px';

    const aggregatedDeckCards = useMemo(() => {
        if (!deckQueryEnabled || deckCards.length === 0) return [];

        const factionOrder = new Map(deckFactions.map((factionId, index) => [factionId, index] as const));
        const grouped = new Map<string, { uid: string; defId: string; count: number; factionOrder: number; name: string }>();

        for (const card of deckCards) {
            const cardDef = getCardDef(card.defId);
            const existing = grouped.get(card.defId);
            const cardFactionOrder = factionOrder.get(cardDef?.faction ?? '') ?? Number.MAX_SAFE_INTEGER;
            const resolvedName = cardDef ? (resolveCardName(cardDef, t) || card.defId) : card.defId;

            if (existing) {
                existing.count += 1;
                continue;
            }

            grouped.set(card.defId, {
                uid: `deck-${card.defId}`,
                defId: card.defId,
                count: 1,
                factionOrder: cardFactionOrder,
                name: resolvedName,
            });
        }

        return Array.from(grouped.values())
            .sort((left, right) => {
                if (left.factionOrder !== right.factionOrder) return left.factionOrder - right.factionOrder;
                const nameOrder = left.name.localeCompare(right.name, 'zh-CN');
                if (nameOrder !== 0) return nameOrder;
                return left.defId.localeCompare(right.defId);
            })
            .map(({ uid, defId, count }) => ({ uid, defId, count }));
    }, [deckCards, deckFactions, deckQueryEnabled, t]);

    // interaction 驱动的弃牌堆选择（僵尸领主等）：自动打开/关闭面板
    const prevAutoOpen = React.useRef(false);
    useEffect(() => {
        let cancelled = false;
        if (autoOpenPanel && !prevAutoOpen.current) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setShowDiscard(true);
                }
            });
        } else if (!autoOpenPanel && prevAutoOpen.current) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setShowDiscard(false);
                }
            });
        }
        prevAutoOpen.current = !!autoOpenPanel;
        return () => {
            cancelled = true;
        };
    }, [autoOpenPanel]);

    // 使用 discard 数组的长度作为 topCard 判断依据，避免在中间状态（弃牌堆暂时为空）时渲染错误
    // zombie_mall_crawl 等卡牌会先调整牌库顺序（DECK_REORDERED），随后弃牌区可能因后续事件再变化
    // 如果直接读取 discard[discard.length - 1]，在中间状态会得到 undefined
    const topCard = discard.length > 0 ? discard[discard.length - 1] : null;

    const handleCloseDiscard = useCallback(() => {
        setShowDiscard(false);
        onSelectCard?.(null);
        onClosePanel?.();
    }, [onSelectCard, onClosePanel]);

    const handleCloseDeck = useCallback(() => {
        setShowDeck(false);
    }, []);

    // portal 容器 ref，用于点击外部关闭检测
    const portalRef = React.useRef<HTMLDivElement | null>(null);

    const displayCardsData = useMemo(() => {
        if (!showDiscard || discard.length === 0) return undefined;

        return {
            title: `${t('ui.discard_pile', { defaultValue: '弃牌堆' })} (${discard.length})`,
            panelKind: 'discard' as const,
            // 反转顺序：最新弃掉的卡在左边
            cards: [...discard].reverse().map(c => ({ uid: c.uid, defId: c.defId })),
            onClose: handleCloseDiscard,
            // 有可打出的卡牌时，传递选择相关 props
            ...(playableCards && playableCards.length > 0 && {
                selectedUid,
                selectedUids,
                onSelect: onSelectCard,
                selectHint: selectHint || t('ui.click_base_to_deploy'),
                playableUids: new Set(playableCards.map(c => c.uid)),
                onConfirmSelection,
                confirmDisabled,
                minSelections,
                maxSelections,
            }),
        };
    }, [showDiscard, discard, playableCards, selectedUid, selectedUids, onSelectCard, selectHint, onConfirmSelection, confirmDisabled, minSelections, maxSelections, t, handleCloseDiscard]);

    const deckDisplayCardsData = useMemo(() => {
        if (!showDeck || !deckQueryEnabled || aggregatedDeckCards.length === 0) return undefined;

        return {
            title: `${t('ui.deck', { defaultValue: '牌库' })} (${deckCount})`,
            panelKind: 'deck' as const,
            cards: aggregatedDeckCards,
            onClose: handleCloseDeck,
        };
    }, [showDeck, deckQueryEnabled, aggregatedDeckCards, t, deckCount, handleCloseDeck]);

    // 点击面板外部关闭弃牌堆查看（interaction 驱动时不关闭，因为用户需要点击基地）
    useEffect(() => {
        if (!showDeck && !showDiscard) return;
        if (!showDeck && autoOpenPanel) return; // interaction 模式下不监听外部点击
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // 点击在面板内部（含 portal）、切换按钮、或放大镜遮罩上，不关闭
            if (
                target.closest('[data-discard-view-panel]')
                || target.closest('[data-card-view-panel]')
                || target.closest('[data-discard-toggle]')
                || target.closest('[data-deck-toggle]')
                || target.closest('[data-interaction-allow]')
            ) return;
            // 额外检查 portal ref（防止 closest 在 portal 中失效）
            if (portalRef.current?.contains(target)) return;
            if (showDeck) setShowDeck(false);
            if (showDiscard && !autoOpenPanel) setShowDiscard(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDeck, showDiscard, autoOpenPanel]);

    const handleTitanClick = useCallback((titan: TitanState) => {
        if (activatableTitanUids?.has(titan.uid) && onSelectTitan) {
            onSelectTitan(titan.uid);
            return;
        }
        onViewTitan?.(titan.defId);
    }, [activatableTitanUids, onSelectTitan, onViewTitan]);
    const {
        isCoarsePointer: isCoarseTitanPointer,
        showDesktopInspectButton: showDesktopTitanInspectButton,
        getTouchInspectProps: getTitanTouchInspectProps,
        shouldBlockInspectClick: shouldBlockTitanClick,
    } = useTouchInspectGesture<string, { defId: string }>({
        enabled: setAsideTitans.length > 0,
        onInspect: (_key, payload) => {
            onViewTitan?.(payload.defId);
        },
    });
    const {
        showDesktopInspectButton: showDesktopDiscardInspectButton,
        getTouchInspectProps: getDiscardTouchInspectProps,
        shouldBlockInspectClick: shouldBlockDiscardClick,
    } = useTouchInspectGesture<string, CardInstance>({
        enabled: Boolean(topCard) && Boolean(onViewCard),
        onInspect: (_cardUid, card) => {
            onViewCard?.(card);
        },
    });

    const titanRailContent = setAsideTitans.length > 0 ? (
        <div className="flex flex-col items-start pointer-events-auto" data-testid="su-titan-rail">
            <div className="flex items-end gap-2">
                {setAsideTitans.map((titan) => {
                    const titanDef = getTitanDef(titan.defId);
                    const titanName = titanDef ? resolveCardName(titanDef, t) || titan.defId : titan.defId;
                    const isSelected = selectedTitanUid === titan.uid;
                    const isReactionTitan = !!reactionTitanUids?.has(titan.uid);
                    const isActivatable = !!activatableTitanUids?.has(titan.uid) && (isMyTurn || isReactionTitan);
                    const hostAccentHighlightActive = isSelected || isActivatable;
                    const hostAccessoryChromeClass = getAccessoryChromeClass(hostAccentHighlightActive, 'border border-white shadow-md');
                    const showTitanInspectButton = showDesktopTitanInspectButton || isCoarseTitanPointer;
                    const timeBoxCounterLabel = getTimeBoxCounterLabel(titan);
                    return (
                        <div
                            key={titan.uid}
                            className="group relative"
                            style={{
                                width: titanWidth,
                                height: cardHeight(titanWidth),
                                aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
                            }}
                        >
                            <button
                                type="button"
                                data-testid={`su-rail-titan-${titan.uid}`}
                                {...getTitanTouchInspectProps(`rail-titan-${titan.uid}`, { defId: titan.defId })}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (shouldBlockTitanClick(`rail-titan-${titan.uid}`)) return;
                                    handleTitanClick(titan);
                                }}
                                className={`relative aspect-[0.714] h-full w-full rounded-sm overflow-hidden shadow-lg border transition-all cursor-pointer ${
                                    isSelected
                                        ? 'border-purple-400 ring-2 ring-purple-400 -translate-y-1 shadow-[0_0_18px_rgba(168,85,247,0.65)]'
                                        : isActivatable
                                        ? 'border-green-400 ring-1 ring-green-300/90 hover:-translate-y-1 shadow-[0_0_12px_rgba(74,222,128,0.28)]'
                                        : 'border-slate-300 hover:-translate-y-1'
                                }`}
                                title={titanName}
                                style={{ height: '100%' }}
                            >
                                <CardPreview
                                    previewRef={titanDef?.previewRef
                                        ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: titan.defId, cardUid: titan.uid } }
                                        : undefined}
                                    className="h-full w-full"
                                    title={titanName}
                                />
                                {timeBoxCounterLabel && (
                                    <div className="absolute inset-x-0 -top-1 z-20 flex justify-center pointer-events-none">
                                        <div
                                            data-testid={`su-rail-titan-timebox-counter-${titan.uid}`}
                                            className={`flex items-center gap-1 whitespace-nowrap rounded-full ${hostAccessoryChromeClass} ${getAccessorySurfaceClass(hostAccentHighlightActive, 'bg-sky-300', 'bg-sky-300/95')} px-1.5 py-[1px] font-black leading-none text-sky-950`}
                                            style={{ fontSize: titanAbilityBadgeFontSize }}
                                            title={`时间盒子计数：${timeBoxCounterLabel}`}
                                        >
                                            <span className="flex h-[1em] w-[1em] shrink-0 items-center justify-center">
                                                <Hourglass aria-hidden className="block h-full w-full" strokeWidth={3} />
                                            </span>
                                            <span className="flex items-center justify-center leading-none tabular-nums">{timeBoxCounterLabel}</span>
                                        </div>
                                    </div>
                                )}
                                {isActivatable && (
                                    <div className="absolute bottom-1 inset-x-0 z-20 flex justify-center px-1 pointer-events-none">
                                        <div
                                            data-testid={`su-rail-titan-badge-${titan.uid}`}
                                            className={`whitespace-nowrap rounded-sm ${hostAccessoryChromeClass} ${getAccessorySurfaceClass(hostAccentHighlightActive, 'bg-amber-300', 'bg-amber-300/95')} px-1.5 py-[1px] font-black leading-none text-slate-900`}
                                            style={{ fontSize: titanAbilityBadgeFontSize }}
                                        >
                                            {isReactionTitan
                                                ? t('ui.titan_reaction_available', { defaultValue: '可触发' })
                                                : t('ui.titan_play_available', { defaultValue: '可打出' })}
                                        </div>
                                    </div>
                                )}
                            </button>
                            {showTitanInspectButton && (
                                <span
                                    data-testid={`su-rail-titan-magnify-${titan.uid}`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onViewTitan?.(titan.defId);
                                    }}
                                    className={isCoarseTitanPointer
                                        ? 'absolute top-1 right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-100 pointer-events-auto shadow-lg hover:bg-amber-500/80 cursor-zoom-in'
                                        : 'absolute top-1 right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white opacity-0 shadow-lg transition-[opacity,background-color] duration-200 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-amber-500/80 cursor-zoom-in'}
                                >
                                    <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            {!focusedTitanPrompt && (
                <div
                    className="mt-2 bg-black/60 px-2 py-0.5 rounded text-white font-bold uppercase tracking-wider"
                    style={{ minHeight: labelMinHeight, fontSize: labelFontSize }}
                >
                    {t('ui.titan', { defaultValue: '泰坦' })}
                </div>
            )}
        </div>
    ) : null;

    if (focusedTitanPrompt) {
        return (
            <div
                data-tutorial-id="su-deck-discard"
                className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none"
                style={{ zIndex: UI_Z_INDEX.hud }}
            >
                {titanRailContent}
            </div>
        );
    }

    return (
        <div
            data-tutorial-id="su-deck-discard"
            className="absolute bottom-4 left-[2vw] right-[2vw] flex justify-between items-end pointer-events-none"
            style={{ zIndex: DECK_DISCARD_LAYER_Z_INDEX }}
        >
            <div className="flex items-end gap-3 pointer-events-auto">
                {/* 牌库 - 左侧 */}
                <div
                    className={`flex flex-col items-center group ${deckQueryEnabled && aggregatedDeckCards.length > 0 ? 'cursor-pointer' : ''}`}
                    data-testid="su-deck-stack"
                    data-tutorial-id="su-deck-stack"
                    data-deck-toggle
                    onClick={() => {
                        if (!deckQueryEnabled || aggregatedDeckCards.length === 0) return;
                        setShowDiscard(false);
                        setShowDeck(prev => !prev);
                    }}
                >
                    <div
                        className="relative aspect-[0.714]"
                        style={{
                            width: stackWidth,
                            height: cardHeight(stackWidth),
                            aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
                        }}
                    >
                        {supplyBadges.length > 0 && (
                            <div
                                className="pointer-events-none absolute inset-x-0 -top-7 z-20 flex justify-center gap-2"
                                data-testid="su-special-supply-row"
                            >
                                {supplyBadges.map((badge) => (
                                    <div
                                        key={badge.key}
                                        className="flex items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                                        data-testid={badge.testId}
                                        title={badge.title}
                                    >
                                        <div className={`${badge.cardClassName} overflow-hidden rounded-[3px]`}>
                                            <CardPreview
                                                previewRef={badge.previewRef}
                                                className="h-full w-full"
                                            />
                                        </div>
                                        <span
                                            className="whitespace-nowrap text-[11px] font-black tabular-nums text-fuchsia-100"
                                            data-testid={badge.countTestId}
                                        >
                                            x {badge.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-slate-700 rounded-sm border border-slate-600 shadow-sm translate-x-1 -translate-y-1 rotate-1" />
                        <div className="absolute inset-0 bg-slate-800 rounded-sm border-2 border-slate-500 shadow-xl overflow-hidden z-10 transition-transform group-hover:-translate-y-2">
                            <CardPreview previewRef={SMASHUP_CARD_BACK} className="w-full h-full" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div
                                    className="w-8 h-8 rounded-full bg-slate-900/80 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg"
                                    data-testid="su-deck-count-badge"
                                >
                                    <span className="text-white font-black font-mono text-base">{deckCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        className="mt-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-white font-bold uppercase tracking-wider flex items-center gap-1"
                        style={{ minHeight: labelMinHeight, fontSize: labelFontSize }}
                    >
                        <Library size={10} /> {t('ui.deck', { defaultValue: '牌库' })}
                    </div>
                </div>
                {titanRailContent}
            </div>

            {/* 弃牌堆 - 右侧 */}
            <div
                className="flex flex-col items-center pointer-events-auto group cursor-pointer relative"
                data-testid="su-discard-toggle"
                data-tutorial-id="su-discard-stack"
                data-discard-toggle
                onClick={() => {
                    if (autoOpenPanel) return;
                    if (topCard && shouldBlockDiscardClick(topCard.uid)) return;
                    setShowDiscard(prev => !prev);
                }}
            >
                <div
                    className="relative aspect-[0.714]"
                    style={{
                        width: stackWidth,
                        height: cardHeight(stackWidth),
                        aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
                    }}
                >
                    {hasPlayableFromDiscard && (
                        <div className="absolute -inset-2 rounded-lg z-0 pointer-events-none">
                            <div className="absolute inset-0 rounded-lg bg-green-400/40 animate-ping" />
                            <div className="absolute inset-0 rounded-lg bg-green-400/30 animate-pulse shadow-[0_0_20px_6px_rgba(74,222,128,0.45)]" />
                        </div>
                    )}
                    {discard.length > 0 ? (
                        <>
                            <div className="absolute inset-0 bg-white rounded-sm border border-slate-300 shadow-sm -translate-x-1 -translate-y-1 -rotate-1" />
                            <div
                                className={`absolute inset-0 bg-white rounded-sm shadow-xl transition-transform group-hover:-translate-y-2 group-hover:rotate-1 border overflow-hidden z-10 ${hasPlayableFromDiscard ? 'border-green-400 border-2' : 'border-slate-200'}`}
                                {...(topCard ? getDiscardTouchInspectProps(topCard.uid, topCard) : {})}
                            >
                                <CardPreview
                                    previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: topCard!.defId, cardUid: topCard!.uid } }}
                                    className="w-full h-full"
                                />
                            </div>
                            {topCard && showDesktopDiscardInspectButton && (
                                <button
                                    type="button"
                                    data-testid={`su-discard-card-inspect-${topCard.uid}`}
                                    className="absolute top-1 right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white opacity-0 shadow-lg transition-[opacity,background-color] duration-200 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-amber-500/80 cursor-zoom-in"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onViewCard?.(topCard);
                                    }}
                                    onPointerDown={(event) => {
                                        event.stopPropagation();
                                    }}
                                >
                                    <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-black/20 rounded-sm border-2 border-dashed border-white/30 flex items-center justify-center">
                            <Trash2 className="text-white/30" />
                        </div>
                    )}
                </div>
                <div
                    className={`mt-2 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${hasPlayableFromDiscard ? 'bg-green-600/85 text-white animate-pulse' : showDiscard ? 'bg-purple-700/85 text-purple-50' : 'bg-black/60 text-white group-hover:text-purple-300'}`}
                    style={{ minHeight: labelMinHeight, fontSize: labelFontSize }}
                >
                    <Trash2 size={10} /> {t('ui.discard')} ({discard.length})
                    {hasPlayableFromDiscard && <span className="text-[9px] ml-1">⚡</span>}
                    {(!isMyTurn && !hasPlayableFromDiscard) && <span className="text-purple-300 text-[9px]">({t('ui.viewing')})</span>}
                </div>
            </div>

            {/* 弃牌堆查看：复用 PromptOverlay 通用卡牌展示模式，Portal 到 body 避免被手牌区域 stacking context 遮挡 */}
            {(deckDisplayCardsData || displayCardsData) && createPortal(
                <div ref={portalRef}>
                    <PromptOverlay
                        interaction={undefined}
                        dispatch={dispatch}
                        playerID={playerID}
                        playerNames={playerNames}
                        displayCards={deckDisplayCardsData ?? displayCardsData}
                    />
                </div>,
                document.body,
            )}
        </div>
    );
};
