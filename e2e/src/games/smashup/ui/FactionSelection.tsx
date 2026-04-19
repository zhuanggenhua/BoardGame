import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SU_COMMANDS, getCurrentPlayerId } from '../domain/types';
import type { SmashUpCore } from '../domain/types';
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
import { getFactionCards, getFactionTitans, resolveCardName } from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { X, Check, Search, Layers, ZoomIn, Pencil, Lock, BookOpen } from 'lucide-react';
import { UI_Z_INDEX } from '../../../core';
import { GameButton } from './GameButton';
import { CardMagnifyOverlay } from './CardMagnifyOverlay';

interface Props {
    core: SmashUpCore;
    dispatch: (type: string, payload?: unknown) => void;
    playerID: PlayerId | null;
}

export const FactionSelection: React.FC<Props> = ({ core, dispatch, playerID }) => {
    const { t, i18n } = useTranslation('game-smashup');
    const navigate = useNavigate();
    const selectionState = core.factionSelection;
    const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
    const [viewingCard, setViewingCard] = useState<{ defId: string; type: 'minion' | 'base' | 'action' | 'titan' } | null>(null);
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window === 'undefined' ? 1440 : window.innerWidth,
        height: typeof window === 'undefined' ? 900 : window.innerHeight,
    }));

    useEffect(() => {
        const updateViewportSize = () => {
            setViewportSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        updateViewportSize();
        window.addEventListener('resize', updateViewportSize);
        window.addEventListener('orientationchange', updateViewportSize);

        return () => {
            window.removeEventListener('resize', updateViewportSize);
            window.removeEventListener('orientationchange', updateViewportSize);
        };
    }, []);

    const takenFactions = new Set(selectionState?.takenFactions ?? []);
    const mySelections = useMemo(
        () => (playerID && selectionState ? selectionState.playerSelections[playerID] || [] : []),
        [playerID, selectionState],
    );
    const isMyTurn = playerID === getCurrentPlayerId(core);
    const currentPlayerId = getCurrentPlayerId(core);
    const locale = i18n.language;

    const visibleFactionGroups = useMemo(() => getVisibleFactionVariantGroups(locale), [locale]);
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
        const preferredVariantId = getPreferredFactionVariant(focusedFactionGroup.groupId, locale)?.id;
        return selectedVariantId ?? preferredVariantId ?? focusedFactionGroup.variants[0]?.id ?? null;
    }, [activeFactionId, focusedFactionGroup, locale, mySelections]);

    const isMobileLandscape = viewportSize.width < 1024 && viewportSize.width > viewportSize.height;
    const focusedFactionMeta = resolvedActiveFactionId ? getFactionMeta(resolvedActiveFactionId) ?? null : null;
    const focusedMechanicTutorial = focusedFactionGroup
        ? getFactionMechanicTutorial(focusedFactionGroup.groupId)
        : undefined;
    const focusedFactionInProgress = focusedFactionGroup
        ? isFactionImplementationInProgress(focusedFactionGroup.groupId)
            || (resolvedActiveFactionId ? isFactionImplementationInProgress(resolvedActiveFactionId) : false)
        : false;

    if (!selectionState) return null;

    const handleOpenFactionGroup = (groupId: string, preferredFactionId: string) => {
        setFocusedGroupId(groupId);
        setActiveFactionId(preferredFactionId);
    };

    const handleCloseDetails = () => {
        setFocusedGroupId(null);
        setActiveFactionId(null);
    };

    const handleConfirmSelect = (factionId: string) => {
        if (!isMyTurn) return;
        if (takenFactions.has(factionId)) return;
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
    const selectionGridClassName = useDesktopLikeLandscapeLayout
        ? 'mx-auto grid w-fit max-w-none grid-cols-[repeat(5,160px)] justify-center gap-x-6 gap-y-3.5 pb-28'
        : 'mx-auto grid w-full max-w-[920px] grid-cols-4 justify-items-center gap-3 lg:max-w-none xl:grid-cols-4 2xl:grid-cols-5 lg:gap-6 pb-24 lg:pb-28';
    const selectionCardFrameClassName = useDesktopLikeLandscapeLayout
        ? 'relative mb-1.5 w-[160px] aspect-[0.727]'
        : 'relative mb-2.5 w-full max-w-[148px] lg:max-w-[192px] aspect-[0.727] xl:max-w-[208px]';
    const selectionCardSurfaceClassName = useDesktopLikeLandscapeLayout
        ? 'absolute inset-0 rounded-sm overflow-hidden shadow-[3px_3px_10px_rgba(0,0,0,0.38)] border-[4px] transition-all bg-white p-[3px]'
        : 'absolute inset-0 rounded-sm overflow-hidden shadow-[3px_3px_10px_rgba(0,0,0,0.38)] border-[4px] lg:border-[5px] transition-all bg-white p-[3px] lg:p-[4px]';
    const selectionIntro = (
        <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={useDesktopLikeLandscapeLayout
                ? 'text-center pt-3 pb-1 relative z-20 w-full max-w-4xl mx-auto flex flex-col items-center'
                : 'text-center pt-6 pb-3 relative z-20 w-full max-w-4xl mx-auto flex flex-col items-center'}
        >
            <h1 className={useDesktopLikeLandscapeLayout
                ? 'text-[2.05rem] font-black text-white tracking-tighter drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] mb-0.5 uppercase italic'
                : 'text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] mb-1 uppercase italic'}
            >
                {t('ui.select_factions_title')}
            </h1>

            <p className={useDesktopLikeLandscapeLayout
                ? 'text-amber-100/60 text-[11px] max-w-lg mx-auto font-bold uppercase tracking-tight mb-1.5'
                : 'text-amber-100/60 text-xs max-w-lg mx-auto font-bold uppercase tracking-tight mb-3'}
            >
                {t('ui.select_factions_desc')}
            </p>

            <div className={useDesktopLikeLandscapeLayout ? 'h-7 relative flex items-center justify-center' : 'h-10 relative flex items-center justify-center'}>
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
                                    {t('ui.waiting_for_player', { id: currentPlayerId })}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
    const factionOptionNodes = visibleFactionGroups.map((group, idx) => {
        const selectedVariantId = group.variants.find((variant) => mySelections.includes(variant.id))?.id ?? null;
        const takenVariantId = group.variants.find((variant) => takenFactions.has(variant.id))?.id ?? null;
        const ownerId = takenVariantId
            ? Object.entries(selectionState.playerSelections).find(([_, picks]) => picks.includes(takenVariantId))?.[0]
            : undefined;
        const isSelectedByMe = Boolean(selectedVariantId);
        const isTakenByOther = Boolean(takenVariantId) && !isSelectedByMe;
        const previewFactionId = selectedVariantId ?? group.defaultVariant.id;
        const cards = getFactionCards(previewFactionId);
        const coverCard = cards.find((card) => card.type === 'minion') || cards[0];
        const labelMeta = selectedVariantId
            ? getFactionMeta(selectedVariantId) ?? group.defaultVariant
            : group.defaultVariant;
        const showImplementationBanner = isFactionImplementationInProgress(group.groupId)
            || (selectedVariantId ? isFactionImplementationInProgress(selectedVariantId) : false);
        const selectedOverlayText = isMyTurn
            ? t('ui.click_to_cancel_selection', { defaultValue: '点击取消选择' })
            : t('ui.selected', { defaultValue: '已选' });

        return (
            <motion.div
                key={group.groupId}
                initial={{ opacity: 0, y: 20, rotate: (idx % 6) - 3 }}
                animate={{ opacity: 1, y: 0, rotate: (idx % 4) - 2 }}
                whileHover={{ rotate: 0, scale: 1.05, zIndex: 30 }}
                transition={{ delay: idx * 0.03 }}
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
                <div className={selectionCardFrameClassName}>
                    <div className={`
                        ${selectionCardSurfaceClassName}
                        ${isSelectedByMe
                            ? 'border-green-500 scale-105 -translate-y-2'
                            : takenVariantId
                                ? 'border-slate-300'
                                : 'border-white group-hover:border-amber-400 group-hover:shadow-amber-500/30'
                        }
                    `}>
                        <div className="w-full h-full bg-slate-100 overflow-hidden relative border border-slate-200">
                            <CardPreview
                                previewRef={coverCard ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: coverCard.id } } : undefined}
                                className="w-full h-full"
                            />

                            {isTakenByOther && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-30">
                                    <div className="mb-2 p-2 bg-slate-700 rounded-full">
                                        <Lock size={24} className="text-white" strokeWidth={2.5} />
                                    </div>
                                    <span className="font-black text-white text-xs uppercase tracking-tight">
                                        {t('ui.player_taken', { id: ownerId })}
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

                            <div className="absolute bottom-1.5 left-1.5 right-1.5 lg:bottom-2 lg:left-2 lg:right-2 text-left">
                                <h3 className="text-white font-black text-[11px] lg:text-base leading-none mb-0.5 lg:mb-1 drop-shadow-md uppercase italic tracking-tight lg:tracking-tighter">
                                    {t(labelMeta.nameKey)}
                                </h3>
                            </div>

                            {showImplementationBanner && (
                                <div
                                    className="absolute left-1.5 top-1.5 z-40 rounded-sm border border-amber-100/80 bg-amber-500/95 px-2 py-1 shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
                                    data-testid={`faction-implementation-banner-${group.groupId}`}
                                >
                                    <span className="text-[9px] font-black uppercase tracking-wide text-slate-900">
                                        {t('ui.faction_implementation_in_progress', { defaultValue: '实施中' })}
                                    </span>
                                </div>
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
    const selectionGrid = (
        <div className={useDesktopLikeLandscapeLayout
            ? 'flex-1 w-full overflow-y-auto px-5 py-2 relative z-10 custom-scrollbar'
            : 'flex-1 w-full max-w-7xl mx-auto overflow-y-auto px-3 py-3 lg:px-6 lg:py-4 relative z-10 custom-scrollbar'}>
            <div className={selectionGridClassName}>{factionOptionNodes}</div>
        </div>
    );
    const playerSelectionRail = (
        <div
            className={useDesktopLikeLandscapeLayout ? 'absolute bottom-[17px] inset-x-0 z-40 pointer-events-none' : 'absolute bottom-3 inset-x-0 z-40 pointer-events-none'}
            data-testid="faction-selection-player-rail"
        >
            <div className={useDesktopLikeLandscapeLayout ? 'max-w-6xl mx-auto flex items-end justify-center gap-5 px-3' : 'max-w-7xl mx-auto flex items-end justify-center gap-3 px-3 lg:gap-8 lg:px-6'}>
                {core.turnOrder.map((pid, pidx) => {
                    const selections = selectionState.playerSelections[pid] || [];
                    const isCurrent = pid === currentPlayerId;

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
                                    ? useDesktopLikeLandscapeLayout
                                        ? 'w-[128px] flex-col items-center gap-2.5 px-3.5 py-2.5 bg-[#fef3c7] border-amber-500 shadow-[0_10px_22px_rgba(0,0,0,0.42)] -rotate-[0.8deg] z-10'
                                        : 'flex-col items-center gap-2 px-4 py-2.5 lg:px-6 lg:py-3 bg-[#fef3c7] border-amber-500 shadow-[0_10px_25px_rgba(0,0,0,0.5)] -rotate-1 z-10 scale-110'
                                    : useDesktopLikeLandscapeLayout
                                        ? 'w-[124px] flex-col items-center gap-2.5 px-3.5 py-2.5 bg-white/92 border-slate-200 shadow-lg rotate-[0.8deg] grayscale-[0.08] opacity-95'
                                        : 'flex-col items-center gap-2 px-4 py-2.5 lg:px-6 lg:py-3 bg-white/90 border-slate-200 shadow-lg rotate-1 grayscale-[0.3]'}
                            `}
                        >
                            <div className={`
                                rounded-full flex items-center justify-center font-black text-white shadow-inner border-4 border-white
                                ${useDesktopLikeLandscapeLayout ? 'w-11 h-11 text-[13px]' : 'w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-sm sm:text-base md:text-lg'}
                                ${pid === '0' ? 'bg-red-500' : pidx === 1 ? 'bg-blue-500' : 'bg-green-500'}
                            `}>
                                {t('ui.player_short', { id: pid })}
                            </div>

                            <div className={useDesktopLikeLandscapeLayout ? 'flex gap-2 shrink-0' : 'flex gap-1.5 sm:gap-2'}>
                                {[0, 1].map((i) => {
                                    const fid = selections[i];
                                    const meta = fid ? FACTION_METADATA.find((faction) => faction.id === fid) : null;

                                    return (
                                        <div
                                            key={i}
                                            className={`
                                                rounded-sm border-2 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm transition-all
                                                ${useDesktopLikeLandscapeLayout ? 'w-11 h-11' : 'w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12'}
                                                ${!fid ? 'border-dashed border-slate-300 opacity-40' : 'border-slate-800 rotate-[-4deg]'}
                                            `}
                                            title={meta ? t(meta.nameKey) : undefined}
                                            style={{ transform: fid ? `rotate(${(i * 10) - 5}deg)` : 'none' }}
                                        >
                                            {meta?.icon ? (
                                                <div className={useDesktopLikeLandscapeLayout ? 'text-slate-900 scale-[0.95]' : 'text-slate-900 scale-90 sm:scale-100'}>
                                                    <meta.icon size={useDesktopLikeLandscapeLayout ? 26 : 28} strokeWidth={2.5} />
                                                </div>
                                            ) : (
                                                <span className={useDesktopLikeLandscapeLayout ? 'text-[10px] text-slate-400 font-black' : 'text-[10px] sm:text-xs text-slate-400 font-black'}>?</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={useDesktopLikeLandscapeLayout ? 'flex min-w-0 flex-col items-center leading-none' : 'flex flex-col items-center'}>
                                <span className={`${useDesktopLikeLandscapeLayout ? 'text-[10.5px]' : 'text-[10px] sm:text-[11px]'} font-black uppercase tracking-tight sm:tracking-tighter leading-none ${isCurrent ? 'text-amber-800' : 'text-slate-700'}`}>
                                    {t('ui.player_short', { id: pid })}
                                </span>
                                {isCurrent && (
                                    <span className={useDesktopLikeLandscapeLayout
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
                className="relative z-10 flex h-full w-full flex-col"
            >
                {selectionIntro}
                {selectionGrid}
                {playerSelectionRail}
            </div>

            <AnimatePresence>
                {focusedGroupId && focusedFactionGroup && focusedFactionMeta && (
                    <>
                        <motion.button
                            type="button"
                            aria-label={t('ui.close_faction_details', { defaultValue: '关闭派系详情' })}
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

                                        <div className="w-full md:w-1/3 max-h-[42dvh] md:max-h-none min-h-0 shrink-0 bg-white/80 p-4 sm:p-5 md:p-4 lg:p-8 flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-dashed border-slate-300 relative overflow-y-auto">
                                            <div
                                                className="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none blur-3xl saturate-200"
                                                style={{
                                                    backgroundColor: focusedFactionMeta.color || '#334155',
                                                    background: `radial-gradient(circle at top right, ${focusedFactionMeta.color || '#334155'}, transparent 70%)`,
                                                }}
                                            />

                                            {(() => {
                                                const cards = getFactionCards(focusedFactionMeta.id);
                                                const titans = getFactionTitans(focusedFactionMeta.id);
                                                const selectedVariantId = focusedFactionGroup.variants.find((variant) => mySelections.includes(variant.id))?.id ?? null;
                                                const takenVariantId = focusedFactionGroup.variants.find((variant) => takenFactions.has(variant.id))?.id ?? null;
                                                const isSelectedByMe = Boolean(selectedVariantId);
                                                const isTakenByOther = Boolean(takenVariantId) && !isSelectedByMe;
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
                                                                        {t('ui.mechanic_tutorial', { defaultValue: '机制教程' })}
                                                                    </GameButton>
                                                                ) : null}
                                                            </div>

                                                            {focusedFactionInProgress && (
                                                                <div
                                                                    className="mb-4 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
                                                                    data-testid="faction-detail-implementation-banner"
                                                                >
                                                                    <p className="text-xs font-black uppercase tracking-wide text-amber-900">
                                                                        {t('ui.faction_implementation_in_progress', { defaultValue: '实施中' })}
                                                                    </p>
                                                                    <p className="mt-1 text-[11px] font-semibold leading-relaxed text-amber-900/90">
                                                                        {t('ui.faction_implementation_in_progress_hint', { defaultValue: '该派系正在分批实施，规则与交互会持续完善。' })}
                                                                    </p>
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
                                                                                onClick={() => setActiveFactionId(variant.id)}
                                                                                data-testid={variantTestId}
                                                                            >
                                                                                {variant.id.endsWith('_pod')
                                                                                    ? t('ui.faction_variant_pod', { defaultValue: 'POD版' })
                                                                                    : t('ui.faction_variant_base', { defaultValue: '原版' })}
                                                                            </GameButton>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            <div className="flex gap-2 mb-4 lg:mb-6">
                                                                <div className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-800 border border-slate-200 shadow-sm">
                                                                    {t('ui.minion_count', { count: cards.filter((card) => card.type === 'minion').length })}
                                                                </div>
                                                                <div className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-800 border border-slate-200 shadow-sm">
                                                                    {t('ui.action_count', { count: cards.filter((card) => card.type === 'action').length })}
                                                                </div>
                                                            </div>

                                                            <p className="text-sm md:text-sm lg:text-base text-slate-600 leading-relaxed mb-4 lg:mb-8 font-medium">
                                                                {t(focusedFactionMeta.descriptionKey)}
                                                            </p>
                                                        </div>

                                                        <div className="relative z-10 mb-4 lg:mb-6">
                                                            <div className="mb-2 flex items-center gap-2 text-slate-400">
                                                                <Layers size={16} />
                                                                <span className="text-xs font-black uppercase tracking-widest">
                                                                    {t('ui.faction_titan_preview', { defaultValue: '泰坦预览' })}
                                                                </span>
                                                            </div>

                                                            <div className="rounded-sm border border-slate-200 bg-white/70 p-3 shadow-inner" data-testid="faction-titan-section">
                                                                {titans.length > 0 ? (
                                                                    <div className={`grid ${titanGridCols} gap-3 md:gap-4`}>
                                                                        {titans.map((titan) => {
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
                                                                        {t('ui.faction_titan_missing', { defaultValue: '该种族泰坦暂未接入' })}
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
                                            <h3 className="text-slate-400 text-sm font-black uppercase tracking-widest mb-4 md:mb-6 flex items-center gap-2">
                                                <Search size={14} strokeWidth={3} />
                                                <span>{t('ui.preview_cards')}</span>
                                            </h3>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4" data-testid="faction-preview-grid">
                                                {getFactionCards(focusedFactionMeta.id).map((card, cidx) => (
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
