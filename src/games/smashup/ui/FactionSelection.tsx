import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SU_COMMANDS, getCurrentPlayerId } from '../domain/types';
import type { SmashUpCore } from '../domain/types';
import {
    buildFactionSelectionIdentitySet,
    FACTION_DISPLAY_NAMES,
    isSmashUpDiyFaction,
    normalizeFactionSelectionId,
} from '../domain/ids';
import {
    FACTION_METADATA,
    getFactionMechanicTutorial,
    getFactionMeta,
    getFactionVariantGroupById,
    getPreferredFactionVariant,
    getVisibleFactionVariantGroups,
    isFactionImplementationInProgress,
} from './factionMeta';
import type { PlayerId } from '../../../engine/types';
import {
    getAllBaseDefs,
    getBaseDef,
    getBasePodFactionIds,
    getBasePodVariantId,
    getFactionCards,
    getFactionTitans,
    resolveCardName,
} from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { X, Check, Layers, ZoomIn, Pencil, Lock, BookOpen } from 'lucide-react';
import { UI_Z_INDEX } from '../../../core';
import { GameButton } from './GameButton';
import { CardMagnifyOverlay } from './CardMagnifyOverlay';
import { ImplementationStatusRibbon } from '../../../components/game/framework/ImplementationStatusRibbon';
import { buildSmashUpTakenFactionsFromPlayerSelections } from '../domain/pregameDraft';

interface Props {
    core: SmashUpCore;
    dispatch: (type: string, payload?: unknown) => void;
    playerID: PlayerId | null;
    playerNames: Record<string, string>;
    playerOrder: string[];
    getPlayerOrderLabel: (playerId: string | null | undefined) => string;
}

const DEFAULT_ENABLED_EXPANSIONS = ['titans', 'diy'] as const;

const SearchGlyph: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className={className}
    >
        <circle
            cx="8.25"
            cy="8.25"
            r="4.75"
            stroke="currentColor"
            strokeWidth="2.1"
        />
        <path
            d="M11.8 11.8L16.1 16.1"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
        />
    </svg>
);

const FACTION_GRID_OVERSCAN_ROWS = 2;
const FACTION_GRID_MIN_WINDOW_ROWS = 4;

type SelectionGridMetrics = {
    scrollTop: number;
    viewportHeight: number;
};

function shouldUseCompactPlayerRail(
    viewportSize: { width: number; height: number },
    playerCount: number,
): boolean {
    const isMobileLandscape = viewportSize.width < 1024 && viewportSize.width > viewportSize.height;
    const isLegacyWideTwoPlayerDraft = playerCount <= 2
        && !isMobileLandscape
        && viewportSize.width >= 1500
        && viewportSize.height >= 860;

    if (playerCount <= 2 && (isMobileLandscape || isLegacyWideTwoPlayerDraft)) {
        return false;
    }
    if (playerCount <= 2 && viewportSize.width >= 1280 && viewportSize.height >= 720) {
        return false;
    }

    return playerCount >= 4 || viewportSize.height < 920 || viewportSize.width < 1280;
}

export const FactionSelection: React.FC<Props> = ({ core, dispatch, playerID, playerNames, playerOrder, getPlayerOrderLabel }) => {
    const { t, i18n } = useTranslation('game-smashup');
    const navigate = useNavigate();
    const selectionState = core.factionSelection;
    const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
    const [detailPreviewTab, setDetailPreviewTab] = useState<'hand' | 'bases'>('hand');
    const [viewingCard, setViewingCard] = useState<{ defId: string; type: 'minion' | 'base' | 'action' | 'titan' } | null>(null);
    const selectionGridRef = useRef<HTMLDivElement | null>(null);
    const [selectionGridMetrics, setSelectionGridMetrics] = useState<SelectionGridMetrics>(() => ({
        scrollTop: 0,
        viewportHeight: typeof window === 'undefined' ? 900 : Math.max(1, window.innerHeight),
    }));
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window === 'undefined' ? 1440 : window.innerWidth,
        height: typeof window === 'undefined' ? 900 : window.innerHeight,
    }));
    const [factionSearch, setFactionSearch] = useState('');
    const [selectionPreviewReady, setSelectionPreviewReady] = useState(() => (
        typeof document !== 'undefined' && document.readyState === 'complete'
    ));

    useEffect(() => {
        const updateViewportSize = () => {
            setViewportSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', updateViewportSize);
        window.addEventListener('orientationchange', updateViewportSize);

        return () => {
            window.removeEventListener('resize', updateViewportSize);
            window.removeEventListener('orientationchange', updateViewportSize);
        };
    }, []);

    useEffect(() => {
        if (selectionPreviewReady || typeof window === 'undefined') return;
        if (document.readyState === 'complete') {
            const frameId = window.requestAnimationFrame(() => {
                setSelectionPreviewReady(true);
            });
            return () => {
                window.cancelAnimationFrame(frameId);
            };
        }

        let loadFrameId = 0;
        const handleWindowLoad = () => {
            loadFrameId = window.requestAnimationFrame(() => {
                loadFrameId = 0;
                setSelectionPreviewReady(true);
            });
        };

        window.addEventListener('load', handleWindowLoad, { once: true });
        return () => {
            window.removeEventListener('load', handleWindowLoad);
            if (loadFrameId) {
                window.cancelAnimationFrame(loadFrameId);
            }
        };
    }, [selectionPreviewReady]);

    const mySelections = useMemo(
        () => (playerID && selectionState ? selectionState.playerSelections[playerID] || [] : []),
        [playerID, selectionState],
    );
    const takenFactionIdentities = useMemo(
        () => buildFactionSelectionIdentitySet(
            buildSmashUpTakenFactionsFromPlayerSelections(selectionState?.playerSelections ?? {}),
        ),
        [selectionState],
    );
    const mySelectionIdentities = useMemo(
        () => buildFactionSelectionIdentitySet(mySelections),
        [mySelections],
    );
    const playerSelectionIdentities = useMemo(
        () => Object.fromEntries(
            Object.entries(selectionState?.playerSelections ?? {}).map(([pid, picks]) => [
                pid,
                buildFactionSelectionIdentitySet(picks),
            ]),
        ),
        [selectionState],
    );
    const isMyTurn = playerID === getCurrentPlayerId(core);
    const currentPlayerId = getCurrentPlayerId(core);
    const locale = i18n.language;
    const enabledExpansions = core.enabledExpansions ?? DEFAULT_ENABLED_EXPANSIONS;

    const visibleFactionGroups = useMemo(
        () => getVisibleFactionVariantGroups(locale, enabledExpansions),
        [enabledExpansions, locale],
    );
    const focusedFactionGroup = useMemo(
        () => (focusedGroupId ? getFactionVariantGroupById(focusedGroupId) ?? null : null),
        [focusedGroupId],
    );
    const [activeFactionId, setActiveFactionId] = useState<string | null>(null);
    const resolvedActiveFactionId = useMemo(() => {
        if (!focusedFactionGroup) return null;
        if (activeFactionId && focusedFactionGroup.variants.some((variant) => variant.id === activeFactionId)) {
            return activeFactionId;
        }
        const selectedVariantId = focusedFactionGroup.variants.find((variant) => mySelections.includes(variant.id))?.id;
        const preferredVariantId = getPreferredFactionVariant(focusedFactionGroup.groupId, locale, enabledExpansions)?.id;
        return selectedVariantId ?? preferredVariantId ?? focusedFactionGroup.variants[0]?.id ?? null;
    }, [activeFactionId, enabledExpansions, focusedFactionGroup, locale, mySelections]);

    const isMobileLandscape = viewportSize.width < 1024 && viewportSize.width > viewportSize.height;
    const useLegacyWideDesktopDraftLayout = !isMobileLandscape
        && playerOrder.length <= 2
        && viewportSize.width >= 1500
        && viewportSize.height >= 860;
    const isUltraCompactLandscape = isMobileLandscape && viewportSize.height <= 520;
    const useCompactPlayerRail = shouldUseCompactPlayerRail(viewportSize, playerOrder.length);
    const shouldShowPlayerSelectionRail = true;
    const remainingSelections = Math.max(0, 2 - mySelections.length);
    const focusedFactionMeta = resolvedActiveFactionId ? getFactionMeta(resolvedActiveFactionId) ?? null : null;
    const focusedMechanicTutorial = focusedFactionGroup
        ? getFactionMechanicTutorial(focusedFactionGroup.groupId)
        : undefined;
    const focusedFactionInProgress = focusedFactionGroup
        ? isFactionImplementationInProgress(focusedFactionGroup.groupId)
            || (resolvedActiveFactionId ? isFactionImplementationInProgress(resolvedActiveFactionId) : false)
        : false;
    const detailFactionCards = useMemo(
        () => (focusedFactionMeta ? getFactionCards(focusedFactionMeta.id) : []),
        [focusedFactionMeta],
    );
    const detailFactionTitans = useMemo(
        () => (focusedFactionMeta ? getFactionTitans(focusedFactionMeta.id) : []),
        [focusedFactionMeta],
    );
    const detailFactionBases = useMemo(() => {
        if (!focusedFactionMeta) return [];
        const selectedFactions = new Set([focusedFactionMeta.id]);
        return getAllBaseDefs()
            .filter((base) => base.faction === focusedFactionMeta.id || getBasePodFactionIds(base).includes(focusedFactionMeta.id))
            .map((base) => {
                const resolvedBaseId = getBasePodVariantId(base, selectedFactions) ?? base.id;
                return getBaseDef(resolvedBaseId) ?? base;
            });
    }, [focusedFactionMeta]);

    const factionStatusCounts = useMemo(() => {
        let available = 0;
        let taken = 0;
        let selected = 0;

        for (const group of visibleFactionGroups) {
            const isSelectedByMe = mySelectionIdentities.has(group.groupId);
            const isTakenByOther = takenFactionIdentities.has(group.groupId) && !isSelectedByMe;
            if (isSelectedByMe) {
                selected += 1;
            } else if (isTakenByOther) {
                taken += 1;
            } else {
                available += 1;
            }
        }

        return {
            available,
            taken,
            selected,
            total: visibleFactionGroups.length,
        };
    }, [mySelectionIdentities, takenFactionIdentities, visibleFactionGroups]);

    const normalizedFactionSearch = factionSearch.trim().toLowerCase();
    const shouldShowFactionFilterToolbar = (
        isMobileLandscape
        || viewportSize.width < 960
        || factionStatusCounts.total >= 10
        || factionStatusCounts.taken > 0
        || normalizedFactionSearch.length > 0
    );
    const factionGroupOrder = useMemo(
        () => new Map(visibleFactionGroups.map((group, index) => [group.groupId, index])),
        [visibleFactionGroups],
    );
    useEffect(() => {
        const grid = selectionGridRef.current;
        if (!grid || typeof window === 'undefined') return;
        if (typeof grid.scrollTo === 'function') {
            grid.scrollTo({ top: 0 });
        } else {
            grid.scrollTop = 0;
        }
        const frameId = window.requestAnimationFrame(() => {
            setSelectionGridMetrics((current) => ({ ...current, scrollTop: 0 }));
        });
        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [normalizedFactionSearch]);
    const filteredFactionGroups = useMemo(() => {
        return visibleFactionGroups
            .map((group) => {
                const selectedVariantId = mySelections.find((selectedId) => group.variants.some((variant) => variant.id === selectedId)) ?? null;
                const isSelectedByMe = Boolean(selectedVariantId);
                const isTakenByOther = takenFactionIdentities.has(group.groupId) && !isSelectedByMe;
                const translatedNames = group.variants
                    .map((variant) => t(variant.nameKey))
                    .join(' ')
                    .toLowerCase();
                const variantIds = group.variants.map((variant) => variant.id.toLowerCase()).join(' ');
                const matchesSearch = normalizedFactionSearch.length === 0
                    || translatedNames.includes(normalizedFactionSearch)
                    || group.groupId.toLowerCase().includes(normalizedFactionSearch)
                    || variantIds.includes(normalizedFactionSearch);
                return {
                    group,
                    selectedVariantId,
                    isSelectedByMe,
                    isTakenByOther,
                    isImplementationInProgress: isFactionImplementationInProgress(group.groupId),
                    matchesSearch,
                };
            })
            .filter((group) => group.matchesSearch)
            .sort((left, right) => {
                const inProgressDiff = Number(left.isImplementationInProgress) - Number(right.isImplementationInProgress);
                if (inProgressDiff !== 0) return inProgressDiff;
                return (factionGroupOrder.get(left.group.groupId) ?? Number.MAX_SAFE_INTEGER)
                    - (factionGroupOrder.get(right.group.groupId) ?? Number.MAX_SAFE_INTEGER);
            });
    }, [factionGroupOrder, mySelections, normalizedFactionSearch, t, takenFactionIdentities, visibleFactionGroups]);

    useEffect(() => {
        const grid = selectionGridRef.current;
        if (!grid || typeof window === 'undefined') return;

        let frameId = 0;
        const readMetrics = () => {
            frameId = 0;
            setSelectionGridMetrics({
                scrollTop: grid.scrollTop,
                viewportHeight: Math.max(1, grid.clientHeight || window.innerHeight),
            });
        };
        const scheduleRead = () => {
            if (frameId) return;
            frameId = window.requestAnimationFrame(readMetrics);
        };

        readMetrics();
        grid.addEventListener('scroll', scheduleRead, { passive: true });
        window.addEventListener('resize', scheduleRead);

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(scheduleRead)
            : null;
        resizeObserver?.observe(grid);

        return () => {
            grid.removeEventListener('scroll', scheduleRead);
            window.removeEventListener('resize', scheduleRead);
            resizeObserver?.disconnect();
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [filteredFactionGroups.length]);

    if (!selectionState) return null;

    const handleOpenFactionGroup = (groupId: string, preferredFactionId: string) => {
        setFocusedGroupId(groupId);
        setActiveFactionId(preferredFactionId);
        setDetailPreviewTab('hand');
    };

    const handleCloseDetails = () => {
        setFocusedGroupId(null);
        setActiveFactionId(null);
    };

    const handleConfirmSelect = (factionId: string) => {
        if (!isMyTurn) return;
        if (takenFactionIdentities.has(normalizeFactionSelectionId(factionId))) return;
        if (mySelectionIdentities.has(normalizeFactionSelectionId(factionId))) return;
        if (mySelections.length >= 2) return;

        dispatch(SU_COMMANDS.SELECT_FACTION, { factionId });
        handleCloseDetails();
    };

    const handleCancelSelect = (factionId: string) => {
        if (!isMyTurn) return;
        if (!mySelections.includes(factionId)) return;

        dispatch(SU_COMMANDS.DESELECT_FACTION, { factionId });
        handleCloseDetails();
    };

    const useDesktopLikeLandscapeLayout = isMobileLandscape;
    const useCompactDetailSidebarHeight = viewportSize.width < 768;
    const detailSidebarMaxHeight = 'calc(var(--runtime-viewport-height, 100vh) * 0.42)';
    const useMinimalPlayerRail = !useDesktopLikeLandscapeLayout
        && playerOrder.length <= 2
        && viewportSize.width < 1180
        && viewportSize.height < 820;
    const useFocusedDesktopDraftLayout = !useDesktopLikeLandscapeLayout
        && playerOrder.length <= 2
        && !useLegacyWideDesktopDraftLayout;
    const useCondensedFactionFilterToolbar = !useDesktopLikeLandscapeLayout && useCompactPlayerRail;
    const selectionGridClassName = useDesktopLikeLandscapeLayout
        ? isUltraCompactLandscape
            ? 'mx-auto grid w-fit max-w-none grid-cols-[repeat(5,136px)] justify-center gap-x-4 gap-y-2 pb-3'
            : 'mx-auto grid w-fit max-w-none grid-cols-[repeat(5,160px)] justify-center gap-x-6 gap-y-3.5 pb-4'
        : useFocusedDesktopDraftLayout
            ? 'mx-auto grid w-full max-w-[1020px] grid-cols-6 justify-items-center gap-x-2 gap-y-2 pb-2 lg:max-w-[1140px] xl:max-w-[1240px] xl:grid-cols-6 xl:gap-x-2.5 xl:gap-y-2.5 2xl:grid-cols-7'
        : useCompactPlayerRail
            ? 'mx-auto grid w-full max-w-[860px] grid-cols-4 justify-items-center gap-1.5 pb-2 lg:max-w-none lg:gap-2.5 xl:grid-cols-5 2xl:grid-cols-6'
            : 'mx-auto grid w-full max-w-[920px] grid-cols-4 justify-items-center gap-3 lg:max-w-none xl:grid-cols-4 2xl:grid-cols-5 lg:gap-6 pb-6';
    const selectionCardFrameClassName = useDesktopLikeLandscapeLayout
        ? isUltraCompactLandscape
            ? 'relative mb-1 w-[136px] aspect-[0.727]'
            : 'relative mb-1.5 w-[160px] aspect-[0.727]'
        : useFocusedDesktopDraftLayout
            ? 'relative mb-1 w-full max-w-[108px] lg:max-w-[124px] xl:max-w-[132px] aspect-[0.727]'
        : useCompactPlayerRail
            ? 'relative mb-1 w-full max-w-[116px] lg:max-w-[140px] aspect-[0.727] xl:max-w-[152px]'
            : 'relative mb-2.5 w-full max-w-[148px] lg:max-w-[192px] aspect-[0.727] xl:max-w-[208px]';
    const selectionCardFrameStyle: React.CSSProperties | undefined = useDesktopLikeLandscapeLayout
        ? {
            width: isUltraCompactLandscape ? 136 : 160,
            height: (isUltraCompactLandscape ? 136 : 160) / 0.727,
            aspectRatio: '0.727 / 1',
        }
        : undefined;
    const selectionCardSurfaceClassName = useDesktopLikeLandscapeLayout
        ? 'absolute inset-0 rounded-sm overflow-hidden shadow-[3px_3px_10px_rgba(0,0,0,0.38)] border-[4px] transition-transform duration-150 bg-white p-[3px] will-change-transform'
        : 'absolute inset-0 rounded-sm overflow-hidden shadow-[3px_3px_10px_rgba(0,0,0,0.38)] border-[4px] lg:border-[5px] transition-transform duration-150 bg-white p-[3px] lg:p-[4px] will-change-transform';
    const selectionVirtualColumnCount = useDesktopLikeLandscapeLayout
        ? 5
        : useFocusedDesktopDraftLayout
            ? (viewportSize.width >= 1536 ? 7 : 6)
            : useCompactPlayerRail
                ? (viewportSize.width >= 1536 ? 6 : viewportSize.width >= 1280 ? 5 : 4)
                : (viewportSize.width >= 1536 ? 5 : 4);
    const selectionVirtualRowHeight = useDesktopLikeLandscapeLayout
        ? (isUltraCompactLandscape ? 242 : 292)
        : useFocusedDesktopDraftLayout
            ? (viewportSize.width >= 1536 ? 244 : 232)
            : useCompactPlayerRail
                ? (viewportSize.width >= 1536 ? 292 : viewportSize.width >= 1024 ? 266 : 244)
                : (viewportSize.width >= 1536 ? 354 : 336);
    const selectionVirtualRowCount = Math.ceil(filteredFactionGroups.length / selectionVirtualColumnCount);
    const selectionFirstVisibleRow = Math.max(
        0,
        Math.floor(selectionGridMetrics.scrollTop / selectionVirtualRowHeight) - FACTION_GRID_OVERSCAN_ROWS,
    );
    const selectionLastVisibleRow = Math.min(
        selectionVirtualRowCount,
        Math.max(
            selectionFirstVisibleRow + FACTION_GRID_MIN_WINDOW_ROWS,
            Math.ceil((selectionGridMetrics.scrollTop + selectionGridMetrics.viewportHeight) / selectionVirtualRowHeight)
                + FACTION_GRID_OVERSCAN_ROWS,
        ),
    );
    const selectionVirtualStartIndex = Math.min(
        filteredFactionGroups.length,
        selectionFirstVisibleRow * selectionVirtualColumnCount,
    );
    const selectionVirtualEndIndex = Math.min(
        filteredFactionGroups.length,
        selectionLastVisibleRow * selectionVirtualColumnCount,
    );
    const visibleFactionOptionGroups = filteredFactionGroups.slice(
        selectionVirtualStartIndex,
        selectionVirtualEndIndex,
    );
    const selectionVirtualTopSpacer = selectionFirstVisibleRow * selectionVirtualRowHeight;
    const selectionVirtualBottomSpacer = Math.max(
        0,
        (selectionVirtualRowCount - selectionLastVisibleRow) * selectionVirtualRowHeight,
    );
    const selectionVirtualSpacerStyle: React.CSSProperties = {
        paddingTop: selectionVirtualTopSpacer,
        paddingBottom: selectionVirtualBottomSpacer,
    };
    const selectionIntro = (
        <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={useDesktopLikeLandscapeLayout
                ? isUltraCompactLandscape
                    ? 'text-center pt-2 pb-0.5 relative z-20 w-full max-w-4xl mx-auto flex flex-col items-center'
                    : 'text-center pt-3 pb-1 relative z-20 w-full max-w-4xl mx-auto flex flex-col items-center'
                : useCompactPlayerRail
                    ? 'text-center pt-4 pb-1.5 relative z-20 w-full max-w-4xl mx-auto flex flex-col items-center'
                    : 'text-center pt-6 pb-3 relative z-20 w-full max-w-4xl mx-auto flex flex-col items-center'}
        >
            <h1 className={useDesktopLikeLandscapeLayout
                ? isUltraCompactLandscape
                    ? 'text-[1.6rem] font-black text-white tracking-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.5)] mb-0 uppercase italic'
                    : 'text-[2.05rem] font-black text-white tracking-tighter drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] mb-0.5 uppercase italic'
                : useCompactPlayerRail
                    ? 'text-[2.4rem] md:text-[2.85rem] font-black text-white tracking-tight drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] mb-0.5 uppercase italic'
                    : 'text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] mb-1 uppercase italic'}
            >
                {t('ui.select_factions_title')}
            </h1>

            <p className={useDesktopLikeLandscapeLayout
                ? isUltraCompactLandscape
                    ? 'text-amber-100/60 text-[9px] max-w-md mx-auto font-bold uppercase tracking-tight mb-1'
                    : 'text-amber-100/60 text-[11px] max-w-lg mx-auto font-bold uppercase tracking-tight mb-1.5'
                : useCompactPlayerRail
                    ? 'text-amber-100/60 text-[10px] max-w-lg mx-auto font-bold uppercase tracking-tight mb-2'
                    : 'text-amber-100/60 text-xs max-w-lg mx-auto font-bold uppercase tracking-tight mb-3'}
            >
                {t('ui.select_factions_desc')}
            </p>

            <div className={useDesktopLikeLandscapeLayout ? (isUltraCompactLandscape ? 'h-6 relative flex items-center justify-center' : 'h-7 relative flex items-center justify-center') : useCompactPlayerRail ? 'h-8 relative flex items-center justify-center' : 'h-10 relative flex items-center justify-center'}>
                <AnimatePresence mode="wait">
                    {isMyTurn ? (
                        <motion.div
                            key="my-turn"
                            initial={{ rotate: -15, scale: 0.5, opacity: 0, y: -30 }}
                            animate={{ rotate: -2, scale: 1, opacity: 1, y: 0 }}
                            exit={{ rotate: 5, scale: 0.8, opacity: 0 }}
                            className="relative bg-[#fef3c7] py-1.5 px-6 shadow-[3px_3px_8px_rgba(0,0,0,0.4)] border-b-2 border-slate-800/10 rounded-sm flex items-center clip-path-jagged"
                        >
                            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 opacity-60 shadow-inner" />
                            <span className="text-slate-800 font-black tracking-tight uppercase text-sm italic drop-shadow-sm">
                                {t('ui.your_turn_prompt')}
                            </span>
                            <motion.div
                                animate={{ rotate: [0, -2, 2, 0] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute -right-1.5 -top-1.5 bg-amber-500 rounded-full p-1 shadow-lg"
                            >
                                <Pencil size={12} className="text-white" strokeWidth={3} />
                            </motion.div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="waiting"
                            initial={{ opacity: 0, y: -15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative bg-[#e0f2fe] py-1 px-4 shadow-[2px_2px_6px_rgba(0,0,0,0.3)] border-l-4 border-blue-400 rotate-1 clip-path-jagged"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-slate-800 font-bold uppercase text-[10px] tracking-widest">
                                    {t('ui.waiting_for_player', {
                                        id: playerNames[currentPlayerId] ?? `P${Number(currentPlayerId) + 1}`,
                                        player: playerNames[currentPlayerId] ?? `P${Number(currentPlayerId) + 1}`,
                                    })}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
    const factionOptionNodes = visibleFactionOptionGroups.map(({ group, selectedVariantId, isSelectedByMe, isTakenByOther }, visibleIndex) => {
        const idx = selectionVirtualStartIndex + visibleIndex;
        const ownerId = Object.entries(playerSelectionIdentities).find(([, identities]) => identities.has(group.groupId))?.[0];
        const previewFactionId = selectedVariantId ?? group.defaultVariant.id;
        const cards = getFactionCards(previewFactionId);
        const coverCard = cards.find((card) => card.type === 'minion') || cards[0];
        const labelMeta = selectedVariantId
            ? getFactionMeta(selectedVariantId) ?? group.defaultVariant
            : group.defaultVariant;
        const showImplementationBanner = isFactionImplementationInProgress(group.groupId)
            || (selectedVariantId ? isFactionImplementationInProgress(selectedVariantId) : false);
        const showDiyBadge = isSmashUpDiyFaction(previewFactionId);
        const selectedOverlayText = isMyTurn
            ? t('ui.click_to_cancel_selection')
            : t('ui.selected');

        return (
            <motion.div
                key={group.groupId}
                initial={{ opacity: 0, y: 20, rotate: (idx % 6) - 3 }}
                animate={{ opacity: 1, y: 0, rotate: (idx % 4) - 2 }}
                whileHover={{ rotate: 0, scale: 1.035, zIndex: 30 }}
                transition={{ delay: Math.min(visibleIndex, 8) * 0.015, duration: 0.16 }}
                onClick={() => {
                    if (isSelectedByMe && isMyTurn && selectedVariantId) {
                        handleCancelSelect(selectedVariantId);
                        return;
                    }

                    handleOpenFactionGroup(group.groupId, selectedVariantId ?? group.defaultVariant.id);
                }}
                data-testid={`faction-option-${group.groupId}`}
                className={`
                    group relative flex w-full flex-col items-center cursor-pointer
                    ${isTakenByOther ? 'opacity-40 grayscale pointer-events-none' : 'z-10'}
                `}
            >
                <div className={selectionCardFrameClassName} style={selectionCardFrameStyle}>
                    <div className={`
                        ${selectionCardSurfaceClassName}
                        ${isSelectedByMe
                            ? 'border-green-500 scale-105 -translate-y-2'
                            : isTakenByOther
                                ? 'border-slate-300'
                                : 'border-white'
                        }
                    `}>
                        <div className="w-full h-full bg-slate-100 overflow-hidden relative border border-slate-200">
                            {selectionPreviewReady ? (
                                <CardPreview
                                    previewRef={coverCard ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: coverCard.id } } : undefined}
                                    className="w-full h-full"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_rgba(15,23,42,0.9))]">
                                    <div className="rounded-full border border-white/40 bg-black/25 p-3 text-white/90 shadow-lg">
                                        <group.icon size={28} strokeWidth={2.25} style={{ color: group.color }} />
                                    </div>
                                </div>
                            )}

                            {isTakenByOther && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-30">
                                    <div className="mb-2 p-2 bg-slate-700 rounded-full">
                                        <Lock size={24} className="text-white" strokeWidth={2.5} />
                                    </div>
                                    <span className="font-black text-white text-xs uppercase tracking-tight">
                                        {t('ui.player_taken', {
                                            id: ownerId ? (playerNames[ownerId] ?? `P${Number(ownerId) + 1}`) : '',
                                            player: ownerId ? (playerNames[ownerId] ?? `P${Number(ownerId) + 1}`) : '',
                                            defaultValue: '{{player}} 已占领',
                                        })}
                                    </span>
                                </div>
                            )}

                            {isSelectedByMe && (
                                <div className="absolute inset-0 bg-emerald-950/55 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-30">
                                    <div className="rounded-sm border border-emerald-200/80 bg-emerald-600/90 px-3 py-2 shadow-[0_6px_16px_rgba(6,78,59,0.35)]">
                                        <span className="font-black text-white text-xs uppercase tracking-tight">
                                            {selectedOverlayText}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
                            {!isSelectedByMe && !isTakenByOther && (
                                <div className="pointer-events-none absolute inset-0 z-20 border-[4px] border-amber-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                            )}

                            <div className="absolute bottom-1.5 left-1.5 right-1.5 lg:bottom-2 lg:left-2 lg:right-2 text-left">
                                <h3 className="text-white font-black text-[11px] lg:text-base leading-none mb-0.5 lg:mb-1 drop-shadow-md uppercase italic tracking-tight lg:tracking-tighter">
                                    {t(labelMeta.nameKey)}
                                </h3>
                            </div>

                            {showDiyBadge && (
                                <div
                                    className="absolute left-1.5 top-1.5 z-40 rounded border border-purple-300/65 bg-purple-950/78 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none tracking-[0.12em] text-purple-100 shadow-[0_2px_8px_rgba(88,28,135,0.45)] lg:left-2 lg:top-2 lg:px-2 lg:py-1 lg:text-[10px]"
                                    data-testid={`faction-diy-badge-${group.groupId}`}
                                >
                                    DIY
                                </div>
                            )}

                            {showImplementationBanner && (
                                <ImplementationStatusRibbon
                                    label={t('ui.faction_implementation_in_progress')}
                                    testId={`faction-implementation-banner-${group.groupId}`}
                                />
                            )}
                        </div>

                        <div className="absolute -top-1.5 -right-1.5 lg:-top-2 lg:-right-2 z-40 w-8 h-8 lg:w-10 lg:h-10 bg-slate-900 border-2 border-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <group.icon size={16} strokeWidth={2.5} style={{ color: group.color }} />
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    });
    const selectionFilterToolbar = (
        <div
            data-testid="faction-filter-toolbar"
            className={useDesktopLikeLandscapeLayout
                ? isUltraCompactLandscape
                    ? 'sticky top-0 z-20 mb-2 flex flex-col gap-2 bg-gradient-to-b from-[#2d1b10] via-[#2d1b10]/96 to-transparent pb-2'
                    : 'sticky top-0 z-20 mb-3 flex flex-col gap-2.5 bg-gradient-to-b from-[#2d1b10] via-[#2d1b10]/96 to-transparent pb-3'
                : useCondensedFactionFilterToolbar
                    ? 'sticky top-0 z-20 mb-2 flex flex-col gap-2 bg-gradient-to-b from-[#2d1b10] via-[#2d1b10]/96 to-transparent pb-2'
                : 'sticky top-0 z-20 mb-3 flex flex-col gap-2.5 bg-gradient-to-b from-[#2d1b10] via-[#2d1b10]/96 to-transparent pb-3'}
        >
            <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                    <span
                        data-testid="faction-search-leading-icon"
                        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-amber-200/75"
                    >
                        <SearchGlyph
                            className={useDesktopLikeLandscapeLayout
                                ? isUltraCompactLandscape
                                    ? 'h-[13px] w-[13px]'
                                    : 'h-[15px] w-[15px]'
                                : 'h-4 w-4'}
                        />
                    </span>
                    <input
                        type="search"
                        value={factionSearch}
                        onChange={(event) => setFactionSearch(event.target.value)}
                        placeholder={t('ui.faction_search_placeholder')}
                        data-testid="faction-search-input"
                        className={useDesktopLikeLandscapeLayout
                            ? isUltraCompactLandscape
                                ? 'h-9 w-full rounded border border-amber-200/25 bg-black/28 pl-9 pr-9 text-[12px] font-bold text-white placeholder:text-amber-100/45 focus:border-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-300/25'
                                : 'h-10 w-full rounded border border-amber-200/25 bg-black/28 pl-10 pr-10 text-sm font-bold text-white placeholder:text-amber-100/45 focus:border-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-300/25'
                            : useCondensedFactionFilterToolbar
                                ? 'h-9 w-full rounded border border-amber-200/25 bg-black/28 pl-9 pr-9 text-[12px] font-bold text-white placeholder:text-amber-100/45 focus:border-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-300/25'
                            : 'h-10 w-full rounded border border-amber-200/25 bg-black/28 pl-10 pr-10 text-sm font-bold text-white placeholder:text-amber-100/45 focus:border-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-300/25'}
                    />
                    {factionSearch.trim().length > 0 && (
                        <button
                            type="button"
                            onClick={() => setFactionSearch('')}
                            data-testid="faction-search-clear"
                            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-amber-50 transition-colors hover:bg-white/20"
                            aria-label={t('ui.faction_search_clear')}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {!useCondensedFactionFilterToolbar && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-amber-100/70">
                    <span data-testid="faction-filter-summary">
                        {t('ui.faction_filter_result_count', {
                            visible: filteredFactionGroups.length,
                            total: factionStatusCounts.total,
                        })}
                    </span>
                    <span>
                        {t('ui.faction_available_count', {
                            count: factionStatusCounts.available + factionStatusCounts.selected,
                        })}
                    </span>
                    <span>
                        {t('ui.faction_taken_count', {
                            count: factionStatusCounts.taken,
                        })}
                    </span>
                    <span className={remainingSelections > 0 ? 'text-amber-200' : 'text-emerald-300'}>
                        {remainingSelections > 0
                            ? t('ui.faction_picks_left', { count: remainingSelections })
                            : t('ui.faction_ready_to_start')}
                    </span>
                </div>
            )}
        </div>
    );
    const selectionEmptyState = (
        <div
            className={useDesktopLikeLandscapeLayout
                ? 'mx-auto mt-8 flex max-w-xl flex-col items-center rounded border border-dashed border-amber-200/25 bg-black/18 px-6 py-8 text-center shadow-[0_10px_24px_rgba(0,0,0,0.22)]'
                : 'mx-auto mt-8 flex max-w-xl flex-col items-center rounded border border-dashed border-amber-200/25 bg-black/18 px-6 py-8 text-center shadow-[0_10px_24px_rgba(0,0,0,0.22)]'}
            data-testid="faction-filter-empty"
        >
            <SearchGlyph className="mb-3 h-[18px] w-[18px] text-amber-200/70" />
            <div className="mb-1 text-sm font-black uppercase tracking-[0.12em] text-white">
                {t('ui.faction_filter_empty_title')}
            </div>
            <p className="mb-4 max-w-md text-xs font-bold leading-relaxed text-amber-100/70">
                {t('ui.faction_filter_empty_desc')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
                {factionSearch.trim().length > 0 && (
                    <GameButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        clickSoundKey={null}
                        onClick={() => setFactionSearch('')}
                        data-testid="faction-filter-reset-search"
                    >
                        {t('ui.faction_search_clear')}
                    </GameButton>
                )}
            </div>
        </div>
    );
    const selectionGrid = (
        <div
            ref={selectionGridRef}
            className={useDesktopLikeLandscapeLayout
            ? isUltraCompactLandscape
                ? 'flex-1 min-h-0 w-full overflow-y-auto px-3 pt-1 pb-24 relative z-10 custom-scrollbar'
                : 'flex-1 min-h-0 w-full overflow-y-auto px-5 pt-2 pb-32 relative z-10 custom-scrollbar'
            : useFocusedDesktopDraftLayout
                ? 'flex-1 min-h-0 w-full max-w-7xl mx-auto overflow-y-auto px-4 pt-2 pb-28 lg:px-6 lg:pt-3 lg:pb-32 relative z-10 custom-scrollbar'
            : 'flex-1 min-h-0 w-full max-w-7xl mx-auto overflow-y-auto px-3 pt-3 pb-28 lg:px-6 lg:pt-4 lg:pb-36 relative z-10 custom-scrollbar'}>
            {shouldShowFactionFilterToolbar ? selectionFilterToolbar : null}
            {filteredFactionGroups.length > 0 ? (
                <div
                    data-testid="faction-virtual-window"
                    data-total-factions={filteredFactionGroups.length}
                    data-rendered-factions={visibleFactionOptionGroups.length}
                    data-start-index={selectionVirtualStartIndex}
                    data-end-index={selectionVirtualEndIndex}
                    style={selectionVirtualSpacerStyle}
                >
                    <div className={selectionGridClassName}>{factionOptionNodes}</div>
                </div>
            ) : (
                selectionEmptyState
            )}
        </div>
    );
    const playerSelectionRail = (
        <div
            className={useDesktopLikeLandscapeLayout
                ? isUltraCompactLandscape
                    ? 'absolute inset-x-0 bottom-0 z-30 w-full min-h-[5.75rem] pointer-events-none bg-gradient-to-t from-black/42 via-black/12 to-transparent px-2 pb-2 pt-1.5'
                    : 'absolute inset-x-0 bottom-0 z-30 w-full min-h-[7.5rem] pointer-events-none bg-gradient-to-t from-black/45 via-black/18 to-transparent px-3 pb-4 pt-3'
                : useMinimalPlayerRail
                    ? 'absolute inset-x-0 bottom-0 z-30 w-full min-h-[5.75rem] pointer-events-none bg-gradient-to-t from-black/34 via-black/10 to-transparent px-2.5 pb-1.5 pt-1.5 lg:px-5'
                    : 'absolute inset-x-0 bottom-0 z-30 w-full min-h-[7.5rem] pointer-events-none bg-gradient-to-t from-black/40 via-black/12 to-transparent px-3 pb-4 pt-4 lg:px-6'}
            style={{ zIndex: UI_Z_INDEX.overlay + 1 }}
            data-testid="faction-selection-player-rail"
        >
            <div className={useDesktopLikeLandscapeLayout
                ? isUltraCompactLandscape
                    ? 'mx-auto flex max-w-5xl items-end justify-center gap-2'
                    : 'mx-auto flex max-w-6xl items-end justify-center gap-3'
                : useMinimalPlayerRail
                    ? 'mx-auto flex max-w-4xl items-end justify-center gap-1.5'
                    : 'mx-auto flex max-w-7xl items-end justify-center gap-2.5 lg:gap-4'}>
                {playerOrder.map((pid, pidx) => {
                    const selections = selectionState.playerSelections[pid] || [];
                    const isCurrent = pid === currentPlayerId;
                    const displayName = playerNames[pid] ?? `P${Number(pid) + 1}`;
                    const badgeLabel = getPlayerOrderLabel(pid);

                    return (
                        <motion.div
                            key={pid}
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 + pidx * 0.1 }}
                            data-testid={`faction-selection-player-card-${pid}`}
                            className={`
                                flex rounded-sm border-2 pointer-events-auto transition-all
                                ${isCurrent
                                    ? useMinimalPlayerRail
                                        ? 'w-[112px] flex-col items-center gap-1 px-2.5 py-1.5 bg-[#fef3c7] border-amber-500 shadow-[0_7px_16px_rgba(0,0,0,0.28)] -rotate-[0.5deg] z-10'
                                        : useCompactPlayerRail
                                        ? 'w-[102px] flex-col items-center gap-1 px-2 py-1.5 bg-[#fef3c7] border-amber-500 shadow-[0_7px_16px_rgba(0,0,0,0.3)] -rotate-[0.6deg] z-10'
                                        : useDesktopLikeLandscapeLayout
                                            ? 'w-[128px] flex-col items-center gap-2.5 px-3.5 py-2.5 bg-[#fef3c7] border-amber-500 shadow-[0_10px_22px_rgba(0,0,0,0.42)] -rotate-[0.8deg] z-10'
                                            : 'flex-col items-center gap-2 px-4 py-2.5 lg:px-5 lg:py-3 bg-[#fef3c7] border-amber-500 shadow-[0_10px_22px_rgba(0,0,0,0.42)] -rotate-[0.8deg] z-10'
                                    : useMinimalPlayerRail
                                        ? 'w-[106px] flex-col items-center gap-1 px-2.5 py-1.5 bg-white/92 border-slate-200 shadow-[0_6px_14px_rgba(0,0,0,0.24)] rotate-[0.5deg] grayscale-[0.05] opacity-95'
                                        : useCompactPlayerRail
                                        ? 'w-[96px] flex-col items-center gap-1 px-2 py-1.5 bg-white/92 border-slate-200 shadow-[0_5px_12px_rgba(0,0,0,0.24)] rotate-[0.6deg] grayscale-[0.06] opacity-95'
                                        : useDesktopLikeLandscapeLayout
                                            ? 'w-[124px] flex-col items-center gap-2.5 px-3.5 py-2.5 bg-white/92 border-slate-200 shadow-lg rotate-[0.8deg] grayscale-[0.08] opacity-95'
                                            : 'flex-col items-center gap-2 px-4 py-2.5 lg:px-5 lg:py-3 bg-white/90 border-slate-200 shadow-lg rotate-[0.8deg] grayscale-[0.18]'}
                            `}
                        >
                            <div className={`
                                rounded-full flex items-center justify-center font-black text-white shadow-inner border-4 border-white
                                ${useMinimalPlayerRail
                                    ? 'w-8 h-8 text-[11px]'
                                    : useCompactPlayerRail
                                    ? 'w-8 h-8 text-[11px]'
                                    : useDesktopLikeLandscapeLayout
                                        ? 'w-11 h-11 text-[13px]'
                                        : 'w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-sm sm:text-base md:text-lg'}
                                ${pid === '0' ? 'bg-red-500' : pidx === 1 ? 'bg-blue-500' : 'bg-green-500'}
                            `}>
                                {badgeLabel}
                            </div>

                            <div className={useMinimalPlayerRail ? 'flex gap-1.5 shrink-0' : useCompactPlayerRail ? 'flex gap-1.5 shrink-0' : useDesktopLikeLandscapeLayout ? 'flex gap-2 shrink-0' : 'flex gap-1.5 sm:gap-2'}>
                                {[0, 1].map((i) => {
                                    const fid = selections[i];
                                    const meta = fid ? FACTION_METADATA.find((faction) => faction.id === fid) : null;
                                    const fallbackName = fid ? FACTION_DISPLAY_NAMES[fid] ?? fid : '';
                                    const isAsciiFallbackName = Array.from(fallbackName).every(
                                        (char) => char.charCodeAt(0) <= 0x7f,
                                    );
                                    const fallbackBadge = fallbackName
                                        ? (isAsciiFallbackName
                                            ? fallbackName.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase()
                                            : Array.from(fallbackName.replace(/\s+/g, '')).slice(0, 2).join(''))
                                        : '';

                                    return (
                                        <div
                                            key={i}
                                            className={`
                                                rounded-sm border-2 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm transition-all
                                                ${useMinimalPlayerRail
                                                    ? 'w-7 h-7'
                                                    : useCompactPlayerRail
                                                    ? 'w-7 h-7'
                                                    : useDesktopLikeLandscapeLayout ? 'w-11 h-11' : 'w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12'}
                                                ${!fid ? 'border-dashed border-slate-300 opacity-40' : 'border-slate-800 rotate-[-4deg]'}
                                            `}
                                            title={meta ? t(meta.nameKey) : (fallbackName || undefined)}
                                            style={{ transform: fid ? `rotate(${(i * 10) - 5}deg)` : 'none' }}
                                        >
                                            {meta?.icon ? (
                                                <div className={useMinimalPlayerRail ? 'text-slate-900 scale-[0.82]' : useCompactPlayerRail ? 'text-slate-900 scale-[0.85]' : useDesktopLikeLandscapeLayout ? 'text-slate-900 scale-[0.95]' : 'text-slate-900 scale-90 sm:scale-100'}>
                                                    <meta.icon size={useMinimalPlayerRail ? 18 : useCompactPlayerRail ? 18 : useDesktopLikeLandscapeLayout ? 26 : 28} strokeWidth={2.5} />
                                                </div>
                                            ) : (
                                                <span className={useMinimalPlayerRail ? 'text-[8px] text-slate-500 font-black' : useCompactPlayerRail ? 'text-[9px] text-slate-500 font-black' : useDesktopLikeLandscapeLayout ? 'text-[10px] text-slate-500 font-black' : 'text-[10px] sm:text-xs text-slate-500 font-black'}>{fallbackBadge}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={useDesktopLikeLandscapeLayout ? 'flex min-w-0 flex-col items-center leading-none' : 'flex flex-col items-center'}>
                                <span className={`${useMinimalPlayerRail ? 'max-w-[5.4rem] text-[9px]' : useCompactPlayerRail ? 'max-w-[5.5rem] text-[9.5px]' : useDesktopLikeLandscapeLayout ? 'max-w-[6.5rem] text-[10.5px]' : 'max-w-[6rem] text-[10px] sm:text-[11px]'} truncate font-black tracking-tight sm:tracking-tighter leading-none ${isCurrent ? 'text-amber-800' : 'text-slate-700'}`}>
                                    {displayName}
                                </span>
                                {isCurrent && (
                                    <span className={useMinimalPlayerRail
                                        ? 'text-[7px] font-black text-amber-600 uppercase tracking-[0.05em] mt-0.5 animate-pulse'
                                        : useCompactPlayerRail
                                        ? 'text-[7px] font-black text-amber-600 uppercase tracking-[0.05em] mt-0.5 animate-pulse'
                                        : useDesktopLikeLandscapeLayout
                                        ? 'text-[9px] font-black text-amber-600 uppercase tracking-[0.06em] mt-0.5 animate-pulse'
                                        : 'text-[9px] sm:text-[10px] font-black text-amber-600 uppercase tracking-[0.12em] sm:tracking-widest mt-0.5 sm:mt-1 animate-pulse'}
                                    >
                                        {t('ui.thinking')}
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div
            data-tutorial-id="su-faction-select"
            className="absolute inset-0 bg-[#2d1b10] flex flex-col items-center overflow-hidden font-sans selection:bg-amber-500/30"
            style={{ zIndex: UI_Z_INDEX.overlay }}
        >
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: `url('https://www.transparenttextures.com/patterns/wood-pattern.png'), linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))`,
                    backgroundBlendMode: 'multiply',
                    opacity: 0.5,
                }}
            />
            <div className="absolute inset-0 z-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.8)]" />

            <div
                data-testid={useDesktopLikeLandscapeLayout ? 'faction-selection-main-stage' : undefined}
                className="relative z-10 flex h-full min-h-0 w-full flex-col"
            >
                {selectionIntro}
                {selectionGrid}
                {shouldShowPlayerSelectionRail ? playerSelectionRail : null}
            </div>

            <AnimatePresence>
                {focusedGroupId && focusedFactionGroup && focusedFactionMeta && (
                    <>
                        <motion.button
                            type="button"
                            aria-label={t('ui.close_faction_details')}
                            className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
                            style={{ zIndex: UI_Z_INDEX.overlayRaised - 1 }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCloseDetails}
                            data-testid="faction-detail-backdrop"
                        />
                        <div
                            className="pointer-events-none fixed inset-x-2 top-[5.25rem] bottom-[5.5rem] sm:inset-x-3 sm:top-[5.75rem] sm:bottom-[5.75rem] md:inset-x-4 md:top-[6.25rem] md:bottom-[6rem] flex items-stretch justify-center"
                            style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                        >
                            <div className="pointer-events-auto flex h-full w-full justify-center">
                                <div
                                    className="relative flex h-full items-center justify-center"
                                    style={isMobileLandscape
                                        ? {
                                            width: 'min(calc(var(--mobile-board-shell-design-width, 1500px) * 0.64), 80rem)',
                                            height: '100%',
                                        }
                                        : {
                                            width: 'min(90vw, 80rem)',
                                            maxWidth: '80rem',
                                            height: '100%',
                                        }}
                                >
                                    <div
                                        className="relative h-full w-full"
                                        style={isMobileLandscape
                                            ? undefined
                                            : {
                                                width: '100%',
                                                height: '100%',
                                            }}
                                    >
                                        <motion.div
                                            layoutId={focusedGroupId}
                                            className="relative h-full w-full min-h-0 bg-[#fdfdfd]/98 border-4 border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.55)] rounded-sm overflow-hidden flex flex-col md:flex-row clip-path-jagged backdrop-blur-[2px]"
                                            style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 18px, #f1f5f9 18px, #f1f5f9 19px)' }}
                                            initial={{ x: 32, opacity: 0, scale: 0.97 }}
                                            animate={{ x: 0, opacity: 1, scale: 1 }}
                                            exit={{ x: 32, opacity: 0, scale: 0.97 }}
                                            data-testid="faction-detail-panel"
                                        >
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-white/60 z-50 -translate-y-4" />
                                        <button
                                            onClick={handleCloseDetails}
                                            className="absolute top-3 right-3 md:top-4 md:right-4 z-50 p-2 bg-black/20 hover:bg-white/10 rounded-full text-white transition-colors"
                                            data-testid="faction-detail-close"
                                        >
                                            <X size={24} />
                                        </button>

                                        <div
                                            className="w-full md:w-1/3 min-h-0 shrink-0 bg-white/80 p-4 sm:p-5 md:p-4 lg:p-8 flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-dashed border-slate-300 relative overflow-y-auto"
                                            style={useCompactDetailSidebarHeight ? { maxHeight: detailSidebarMaxHeight } : undefined}
                                        >
                                            <div
                                                className="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none blur-3xl saturate-200"
                                                style={{
                                                    backgroundColor: focusedFactionMeta.color || '#334155',
                                                    background: `radial-gradient(circle at top right, ${focusedFactionMeta.color || '#334155'}, transparent 70%)`,
                                                }}
                                            />

                                            {(() => {
                                                const selectedVariantId = mySelections.find((selectedId) => focusedFactionGroup.variants.some((variant) => variant.id === selectedId)) ?? null;
                                                const isSelectedByMe = Boolean(selectedVariantId);
                                                const isTakenByOther = takenFactionIdentities.has(focusedFactionGroup.groupId) && !isSelectedByMe;
                                                const canSelect = isMyTurn && !isTakenByOther && mySelections.length < 2 && !isSelectedByMe;
                                                const titanGridCols = 'grid-cols-1';

                                                return (
                                                    <>
                                                        <div className="relative z-10">
                                                            <div className="flex items-center gap-2 mb-2 text-slate-400">
                                                                <Layers size={16} />
                                                                <span className="text-xs font-black uppercase tracking-widest">{t('ui.faction_details')}</span>
                                                            </div>
                                                            <div className="mb-3 flex items-start justify-between gap-3">
                                                                <h2 className="text-3xl md:text-3xl lg:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">
                                                                    {t(focusedFactionMeta.nameKey)}
                                                                </h2>
                                                                {focusedMechanicTutorial ? (
                                                                    <GameButton
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        className="shrink-0 gap-1.5 text-[11px]"
                                                                        title={t(focusedMechanicTutorial.descriptionKey)}
                                                                        data-testid="faction-mechanic-tutorial-entry"
                                                                        onClick={() => navigate(`/play/smashup/tutorial/${focusedMechanicTutorial.tutorialId}`)}
                                                                    >
                                                                        <BookOpen size={14} />
                                                                        {t('ui.mechanic_tutorial')}
                                                                    </GameButton>
                                                                ) : null}
                                                            </div>

                                                            {focusedFactionInProgress && (
                                                                <div
                                                                    className="mb-4 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
                                                                    data-testid="faction-detail-implementation-banner"
                                                                >
                                                                    <div className="relative h-10 overflow-hidden rounded-sm border border-amber-200/90 bg-amber-100/60">
                                                                        <ImplementationStatusRibbon
                                                                            label={t('ui.faction_implementation_in_progress')}
                                                                            testId="faction-detail-implementation-banner-label"
                                                                            className="absolute inset-0 z-40 overflow-hidden pointer-events-none"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {focusedFactionGroup.variants.length > 1 && (
                                                                <div className="mb-4 flex flex-wrap gap-2" data-testid="faction-variant-switch">
                                                                    {focusedFactionGroup.variants.map((variant) => {
                                                                        const isActive = variant.id === focusedFactionMeta.id;
                                                                        const variantTestId = variant.id.endsWith('_pod') ? 'faction-variant-pod' : 'faction-variant-base';
                                                                        return (
                                                                            <GameButton
                                                                                key={variant.id}
                                                                                type="button"
                                                                                size="sm"
                                                                                variant={isActive ? 'primary' : 'secondary'}
                                                                                className="min-w-[6.5rem] text-[11px]"
                                                                                onClick={() => {
                                                                                    setActiveFactionId(variant.id);
                                                                                    setDetailPreviewTab('hand');
                                                                                }}
                                                                                data-testid={variantTestId}
                                                                            >
                                                                                {variant.id.endsWith('_pod')
                                                                                    ? t('ui.faction_variant_pod')
                                                                                    : t('ui.faction_variant_base')}
                                                                            </GameButton>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            <div className="flex gap-2 mb-4 lg:mb-6">
                                                                <div className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-800 border border-slate-200 shadow-sm">
                                                                    {t('ui.minion_count', { count: detailFactionCards.filter((card) => card.type === 'minion').length })}
                                                                </div>
                                                                <div className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-800 border border-slate-200 shadow-sm">
                                                                    {t('ui.action_count', { count: detailFactionCards.filter((card) => card.type === 'action').length })}
                                                                </div>
                                                            </div>

                                                            <p className="text-sm md:text-sm lg:text-base text-slate-600 leading-relaxed mb-4 lg:mb-8 font-medium">
                                                                {t(focusedFactionMeta.descriptionKey)}
                                                            </p>

                                                            {focusedFactionMeta.mechanicRule ? (
                                                                <div className="mb-4 lg:mb-6" data-testid="faction-mechanic-rules">
                                                                    <div className="mb-2 flex items-center gap-2 text-slate-400">
                                                                        <BookOpen size={16} />
                                                                        <span className="text-xs font-black uppercase tracking-widest">
                                                                            {t('ui.faction_mechanic_rules')}
                                                                        </span>
                                                                    </div>
                                                                    <div
                                                                        className="rounded-sm border border-slate-200 bg-white/75 px-3 py-2.5 shadow-[0_6px_14px_rgba(15,23,42,0.06)]"
                                                                        style={{
                                                                            borderLeftWidth: 4,
                                                                            borderLeftColor: focusedFactionMeta.color,
                                                                        }}
                                                                        data-testid="faction-mechanic-rule"
                                                                    >
                                                                        <div className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-700">
                                                                            {t(focusedFactionMeta.mechanicRule.titleKey)}
                                                                        </div>
                                                                        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
                                                                            {t(focusedFactionMeta.mechanicRule.descriptionKey)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="relative z-10 mb-4 lg:mb-6">
                                                            <div className="mb-2 flex items-center gap-2 text-slate-400">
                                                                <Layers size={16} />
                                                                <span className="text-xs font-black uppercase tracking-widest">
                                                                    {t('ui.faction_titan_preview')}
                                                                </span>
                                                            </div>

                                                            <div className="rounded-sm border border-slate-200 bg-white/70 p-3 shadow-inner" data-testid="faction-titan-section">
                                                                {detailFactionTitans.length > 0 ? (
                                                                    <div className={`grid ${titanGridCols} gap-3 md:gap-4`}>
                                                                        {detailFactionTitans.map((titan) => {
                                                                            const titanName = resolveCardName(titan, t) || titan.id;
                                                                            return (
                                                                                <button
                                                                                    key={titan.id}
                                                                                    type="button"
                                                                                    onClick={() => setViewingCard({ defId: titan.id, type: 'titan' })}
                                                                                    className="group flex flex-col items-center text-center"
                                                                                    data-testid="faction-titan-card"
                                                                                >
                                                                                    <div className="relative w-full overflow-hidden rounded-sm border-2 border-slate-200 bg-white p-[3px] shadow-md transition-all group-hover:-translate-y-1 group-hover:border-amber-300 group-hover:shadow-lg">
                                                                                        <div className="relative aspect-[0.714] w-full overflow-hidden bg-slate-100">
                                                                                            <CardPreview
                                                                                                previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: titan.id } }}
                                                                                                className="w-full h-full"
                                                                                                title={titanName}
                                                                                            />
                                                                                            <div className="absolute top-2 right-2 rounded-full bg-black/75 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                                                                                <ZoomIn size={14} />
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        className="flex min-h-[12rem] items-center justify-center rounded-sm border border-dashed border-slate-300 bg-slate-50/80 px-4 text-center text-sm font-bold leading-relaxed text-slate-500 md:min-h-[14rem] lg:min-h-[18rem]"
                                                                        data-testid="faction-titan-empty"
                                                                    >
                                                                        {t('ui.faction_titan_missing')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="sticky bottom-0 mt-4 pt-3 lg:mt-6 lg:pt-4 relative z-20 bg-gradient-to-t from-white via-white/95 to-transparent">
                                                            {isSelectedByMe ? (
                                                                isMyTurn ? (
                                                                    <GameButton
                                                                        onClick={() => handleCancelSelect(selectedVariantId!)}
                                                                        type="button"
                                                                        variant="secondary"
                                                                        size="md"
                                                                        className="md:text-base lg:text-xl md:py-3 lg:py-4"
                                                                        fullWidth
                                                                        data-testid="faction-cancel-button"
                                                                    >
                                                                        {t('ui.cancel_selection')}
                                                                    </GameButton>
                                                                ) : (
                                                                    <div className="w-full py-3 lg:py-4 bg-green-100 border-2 border-green-500 rounded text-green-700 font-black text-center flex items-center justify-center gap-2 uppercase italic shadow-md">
                                                                        <Check size={20} strokeWidth={3} />
                                                                        {t('ui.selected')}
                                                                    </div>
                                                                )
                                                            ) : isTakenByOther ? (
                                                                <div className="w-full py-3 lg:py-4 bg-slate-200 rounded text-slate-500 font-black text-center cursor-not-allowed uppercase shadow-inner">
                                                                    {t('ui.taken_by_other')}
                                                                </div>
                                                            ) : (
                                                                <GameButton
                                                                    onClick={() => handleConfirmSelect(focusedFactionMeta.id)}
                                                                    disabled={!canSelect}
                                                                    variant="primary"
                                                                    size="md"
                                                                    className="md:text-base lg:text-xl md:py-3 lg:py-4"
                                                                    fullWidth
                                                                    data-testid="faction-confirm-button"
                                                                >
                                                                    {isMyTurn
                                                                        ? (mySelections.length >= 2 ? t('ui.faction_full') : t('ui.confirm_selection'))
                                                                        : t('ui.wait_turn')}
                                                                </GameButton>
                                                            )}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex-1 min-h-0 bg-white/50 overflow-y-auto p-3 sm:p-4 md:p-8 custom-scrollbar">
                                            <div
                                                className="mb-4 flex flex-wrap items-center gap-2 md:mb-6"
                                                role="tablist"
                                                aria-label={t('ui.preview_cards')}
                                            >
                                                {([
                                                    {
                                                        id: 'hand' as const,
                                                        label: t('ui.preview_cards_hand'),
                                                        count: detailFactionCards.length,
                                                        testId: 'faction-preview-tab-hand',
                                                    },
                                                    {
                                                        id: 'bases' as const,
                                                        label: t('ui.preview_cards_bases'),
                                                        count: detailFactionBases.length,
                                                        testId: 'faction-preview-tab-bases',
                                                    },
                                                ]).map((tab) => {
                                                    const isActive = detailPreviewTab === tab.id;
                                                    return (
                                                        <button
                                                            key={tab.id}
                                                            type="button"
                                                            role="tab"
                                                            aria-selected={isActive}
                                                            onClick={() => setDetailPreviewTab(tab.id)}
                                                            data-testid={tab.testId}
                                                            className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition-colors ${
                                                                isActive
                                                                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                                                                    : 'border-slate-300 bg-white/80 text-slate-500 hover:border-slate-500 hover:text-slate-800'
                                                            }`}
                                                        >
                                                            {tab.label} · {tab.count}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {detailPreviewTab === 'hand' ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4" data-testid="faction-preview-grid">
                                                    {detailFactionCards.map((card, cidx) => (
                                                        <div
                                                            key={card.id}
                                                            className="group relative aspect-[0.714] rounded-sm overflow-hidden bg-white p-[2px] lg:p-[3px] shadow-md border-2 border-slate-100 transition-all cursor-zoom-in hover:z-20 hover:scale-110 hover:shadow-xl"
                                                            style={{ transform: `rotate(${(cidx % 5) - 2}deg)` }}
                                                            onClick={() => setViewingCard({ defId: card.id, type: card.type })}
                                                            data-testid="faction-preview-card"
                                                        >
                                                            <div className="w-full h-full bg-slate-100 overflow-hidden relative">
                                                                <CardPreview
                                                                    previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.id } }}
                                                                    className="w-full h-full"
                                                                />

                                                                {card.count > 1 && (
                                                                    <div className="absolute top-1.5 right-1.5 z-30 min-w-[22px] h-[22px] px-1 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center shadow-md">
                                                                        <span className="text-white font-black text-[10px] leading-none">×{card.count}</span>
                                                                    </div>
                                                                )}

                                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 p-1.5 rounded-full text-white z-30">
                                                                    <ZoomIn size={16} />
                                                                </div>

                                                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                                                                    <div className="text-white font-black text-[10px] uppercase leading-none mb-1">
                                                                        {resolveCardName(card, t)}
                                                                    </div>
                                                                    <div className="text-[8px] text-amber-400 font-bold uppercase tracking-widest">
                                                                        {card.type === 'minion' ? `${t('ui.minion')}: ${(card as import('../domain/types').MinionCardDef).power}` : t('ui.action')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : detailFactionBases.length > 0 ? (
                                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-testid="faction-base-grid">
                                                    {detailFactionBases.map((base, index) => (
                                                        <button
                                                            key={base.id}
                                                            type="button"
                                                            className="group relative aspect-[1.43] rounded-sm overflow-hidden bg-white p-[3px] shadow-md border-2 border-slate-100 transition-all cursor-zoom-in hover:z-20 hover:-translate-y-1 hover:shadow-xl"
                                                            style={{ transform: `rotate(${(index % 4) - 1.5}deg)` }}
                                                            onClick={() => setViewingCard({ defId: base.id, type: 'base' })}
                                                            data-testid="faction-base-card"
                                                        >
                                                            <div className="relative h-full w-full overflow-hidden bg-slate-100">
                                                                <CardPreview
                                                                    previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: base.id } }}
                                                                    className="w-full h-full"
                                                                />

                                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 p-1.5 rounded-full text-white z-30">
                                                                    <ZoomIn size={16} />
                                                                </div>

                                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent p-2 text-left">
                                                                    <div className="text-white font-black text-[10px] uppercase leading-none mb-1">
                                                                        {resolveCardName(base, t)}
                                                                    </div>
                                                                    <div className="text-[8px] text-amber-300 font-bold uppercase tracking-widest">
                                                                        {t('ui.base_stat_line', {
                                                                            breakpoint: base.breakpoint,
                                                                            vp: base.vpAwards.join('/'),
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex min-h-[12rem] items-center justify-center rounded-sm border border-dashed border-slate-300 bg-slate-50/80 px-4 text-center text-sm font-bold leading-relaxed text-slate-500 md:min-h-[14rem]"
                                                    data-testid="faction-base-empty"
                                                >
                                                    {t('ui.preview_bases_empty')}
                                                </div>
                                            )}
                                        </div>
                                        </motion.div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            <CardMagnifyOverlay target={viewingCard} onClose={() => setViewingCard(null)} />

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.1);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 0px;
                    border: 1px solid rgba(0,0,0,0.2);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .clip-path-jagged {
                    clip-path: polygon(
                        0% 0%, 5% 2%, 10% 0%, 15% 3%, 20% 0%, 25% 2%, 30% 0%, 35% 3%, 40% 0%, 45% 2%, 50% 0%, 55% 3%, 60% 0%, 65% 2%, 70% 0%, 75% 3%, 80% 0%, 85% 2%, 90% 0%, 95% 3%, 100% 0%,
                        100% 100%, 95% 98%, 90% 100%, 85% 97%, 80% 100%, 75% 98%, 70% 100%, 65% 97%, 60% 100%, 55% 98%, 50% 100%, 45% 97%, 40% 100%, 35% 98%, 30% 100%, 25% 97%, 20% 100%, 15% 98%, 10% 100%, 5% 97%, 0% 100%
                    );
                }
            `}</style>
        </div>
    );
};
