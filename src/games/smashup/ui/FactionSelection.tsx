import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SU_COMMANDS, getCurrentPlayerId } from '../domain/types';
import type { SmashUpCore } from '../domain/types';
import { FACTION_METADATA } from './factionMeta';
import type { PlayerId } from '../../../engine/types';
import { getFactionCards, resolveCardName } from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { X, Check, Search, Layers, ZoomIn, Pencil, Lock } from 'lucide-react';
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
    const selectionState = core.factionSelection;
    const [focusedFactionId, setFocusedFactionId] = useState<string | null>(null);
    const [viewingCard, setViewingCard] = useState<{ defId: string; type: 'minion' | 'base' | 'action' } | null>(null);

    if (!selectionState) return null;

    const takenFactions = new Set(selectionState.takenFactions);
    const mySelections = playerID ? selectionState.playerSelections[playerID] || [] : [];
    const isMyTurn = playerID === getCurrentPlayerId(core);
    const currentPlayerId = getCurrentPlayerId(core);

    const handleConfirmSelect = (factionId: string) => {
        if (!isMyTurn) return;
        if (takenFactions.has(factionId)) return;
        if (mySelections.length >= 2) return;

        dispatch(SU_COMMANDS.SELECT_FACTION, { factionId });
        setFocusedFactionId(null);
    };

    return (
        <div
            data-tutorial-id="su-faction-select"
            className="absolute inset-0 bg-[#2d1b10] flex flex-col items-center overflow-hidden font-sans selection:bg-amber-500/30"
            style={{ zIndex: UI_Z_INDEX.overlay }}
        >
            {/* Improved CSS Wood Grain (Fallback logic) */}
            <div className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: `url('https://www.transparenttextures.com/patterns/wood-pattern.png'), linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))`,
                    backgroundBlendMode: 'multiply',
                    opacity: 0.5
                }}
            />
            {/* Subtle Vignette */}
            <div className="absolute inset-0 z-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.8)]" />

            {/* HEADLINE AREA - 紧凑布局 */}
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center pt-6 pb-3 relative z-20 w-full max-w-4xl mx-auto flex flex-col items-center"
            >
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] mb-1 uppercase italic">
                    {t('ui.select_factions_title')}
                </h1>

                <p className="text-amber-100/60 text-xs max-w-lg mx-auto font-bold uppercase tracking-tight mb-3">
                    {t('ui.select_factions_desc')}
                </p>

                {/* Turn Status: 紧凑便签样式 */}
                <div className="h-10 relative flex items-center justify-center">
                    <AnimatePresence mode="wait">
                        {isMyTurn ? (
                            <motion.div
                                key="my-turn"
                                initial={{ rotate: -15, scale: 0.5, opacity: 0, y: -30 }}
                                animate={{ rotate: -2, scale: 1, opacity: 1, y: 0 }}
                                exit={{ rotate: 5, scale: 0.8, opacity: 0 }}
                                className="relative bg-[#fef3c7] py-1.5 px-6 shadow-[3px_3px_8px_rgba(0,0,0,0.4)] border-b-2 border-slate-800/10 rounded-sm flex items-center clip-path-jagged"
                            >
                                {/* Pin icon */}
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

            {/* FACTION GRID - 增加垂直空间 */}
            <div className="flex-1 w-full max-w-7xl overflow-y-auto px-6 py-4 relative z-10 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-28">
                    {FACTION_METADATA.map((faction, idx) => {
                        const isTaken = takenFactions.has(faction.id);
                        const isSelectedByMe = mySelections.includes(faction.id);
                        const ownerId = Object.entries(selectionState.playerSelections).find(([_, f]) => f.includes(faction.id))?.[0];

                        // Get first card for preview
                        const cards = getFactionCards(faction.id);
                        const coverCard = cards.find(c => c.type === 'minion') || cards[0];

                        return (
                            <motion.div
                                key={faction.id}
                                initial={{ opacity: 0, y: 20, rotate: (idx % 6) - 3 }}
                                animate={{ opacity: 1, y: 0, rotate: (idx % 4) - 2 }}
                                whileHover={{ rotate: 0, scale: 1.05, zIndex: 30 }}
                                transition={{ delay: idx * 0.03 }}
                                onClick={() => setFocusedFactionId(faction.id)}
                                className={`
                                    group relative flex flex-col items-center cursor-pointer
                                    ${isTaken ? 'opacity-40 grayscale pointer-events-none' : 'z-10'}
                                `}
                            >
                                {/* Card Stack Visual */}
                                <div className="relative w-40 h-56 md:w-48 md:h-64 mb-4">
                                    {/* Main Cover Card */}
                                    <div className={`
                                        absolute inset-0 rounded-sm overflow-hidden shadow-[3px_3px_12px_rgba(0,0,0,0.4)] border-[0.4vw] transition-all
                                        bg-white p-[0.3vw]
                                        ${isSelectedByMe
                                            ? 'border-green-500 scale-105 -translate-y-2'
                                            : isTaken
                                                ? 'border-slate-300'
                                                : 'border-white group-hover:border-amber-400 group-hover:shadow-amber-500/30'
                                        }
                                    `}>
                                        <div className="w-full h-full bg-slate-100 overflow-hidden relative border border-slate-200">
                                            <CardPreview
                                                previewRef={coverCard?.previewRef}
                                                className="w-full h-full object-cover"
                                            />

                                            {/* Taken Status */}
                                            {isTaken && (
                                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-30">
                                                    <div className="mb-2 p-2 bg-slate-700 rounded-full">
                                                        <Lock size={24} className="text-white" strokeWidth={2.5} />
                                                    </div>
                                                    <span className="font-black text-white text-xs uppercase tracking-tight">
                                                        {t('ui.player_taken', { id: ownerId })}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Overlay Gradient for Text Readability */}
                                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />

                                            {/* Faction Name on Card */}
                                            <div className="absolute bottom-2 left-2 right-2 text-left">
                                                <h3 className="text-white font-black text-sm md:text-base leading-none mb-1 drop-shadow-md uppercase italic tracking-tighter">
                                                    {t(faction.nameKey)}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Faction Icon Badge - "Token" style */}
                                        <div className="absolute -top-2 -right-2 z-40 w-10 h-10 bg-slate-900 border-2 border-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                            <faction.icon size={20} strokeWidth={2.5} style={{ color: faction.color }} />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* MODAL: Focused Faction Details */}
            <AnimatePresence>
                {focusedFactionId && (
                    <div
                        className="fixed inset-0 flex items-center justify-center p-4 md:p-8"
                        style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                    >
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setFocusedFactionId(null)}
                            className="absolute inset-0 bg-black/80"
                        />

                        {/* Modal Content - Rulebook/Clipboard style */}
                        <motion.div
                            layoutId={focusedFactionId}
                            className="relative w-full max-w-5xl h-[85vh] bg-[#fdfdfd] border-4 border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-sm overflow-hidden flex flex-col md:flex-row clip-path-jagged"
                            style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1.5vw, #f1f5f9 1.5vw, #f1f5f9 1.6vw)' }}
                            initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
                        >
                            {/* Tape effect on top */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-white/60 z-50 -translate-y-4" />
                            {/* Close Button */}
                            <button
                                onClick={() => setFocusedFactionId(null)}
                                className="absolute top-4 right-4 z-50 p-2 bg-black/20 hover:bg-white/10 rounded-full text-white transition-colors"
                            >
                                <X size={24} />
                            </button>

                            {/* Left Panel: Info & Action - Clipboard header style */}
                            <div className="w-full md:w-1/3 bg-white/80 p-6 md:p-8 flex flex-col border-r-2 border-dashed border-slate-300 relative overflow-hidden">
                                {/* Ambient Background */}
                                <div
                                    className="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none blur-3xl saturate-200"
                                    style={{
                                        backgroundColor: FACTION_METADATA.find(f => f.id === focusedFactionId)?.color || '#334155',
                                        background: `radial-gradient(circle at top right, ${FACTION_METADATA.find(f => f.id === focusedFactionId)?.color}, transparent 70%)`
                                    }}
                                />

                                {(() => {
                                    const meta = FACTION_METADATA.find(f => f.id === focusedFactionId)!;
                                    const cards = getFactionCards(meta.id);
                                    const isTaken = takenFactions.has(meta.id);
                                    const isSelectedByMe = mySelections.includes(meta.id);
                                    const canSelect = isMyTurn && !isTaken && mySelections.length < 2 && !isSelectedByMe;

                                    return (
                                        <>
                                            <div className="relative z-10">
                                                <div className="flex items-center gap-2 mb-2 text-slate-400">
                                                    <Layers size={16} />
                                                    <span className="text-xs font-black uppercase tracking-widest">{t('ui.faction_details')}</span>
                                                </div>
                                                <h2 className="text-4xl font-black text-slate-900 mb-4 uppercase tracking-tighter italic">{t(meta.nameKey)}</h2>

                                                <div className="flex gap-2 mb-6">
                                                    <div className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-800 border border-slate-200 shadow-sm">
                                                        {t('ui.minion_count', { count: cards.filter(c => c.type === 'minion').length })}
                                                    </div>
                                                    <div className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-800 border border-slate-200 shadow-sm">
                                                        {t('ui.action_count', { count: cards.filter(c => c.type === 'action').length })}
                                                    </div>
                                                </div>

                                                <p className="text-slate-600 leading-relaxed mb-8 font-medium">
                                                    {t(meta.descriptionKey)}
                                                </p>
                                            </div>

                                            <div className="mt-auto relative z-10">
                                                {isSelectedByMe ? (
                                                    <div className="w-full py-4 bg-green-100 border-2 border-green-500 rounded text-green-700 font-black text-center flex items-center justify-center gap-2 uppercase italic shadow-md">
                                                        <Check size={20} strokeWidth={3} />
                                                        {t('ui.selected')}
                                                    </div>
                                                ) : isTaken ? (
                                                    <div className="w-full py-4 bg-slate-200 rounded text-slate-500 font-black text-center cursor-not-allowed uppercase shadow-inner">
                                                        {t('ui.taken_by_other')}
                                                    </div>
                                                ) : (
                                                    <GameButton
                                                        onClick={() => handleConfirmSelect(meta.id)}
                                                        disabled={!canSelect}
                                                        variant="primary"
                                                        size="lg"
                                                        fullWidth
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

                            {/* Right Panel: Card Grid - Rulebook content style */}
                            <div className="flex-1 bg-white/50 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                                <h3 className="text-slate-400 text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Search size={14} strokeWidth={3} />
                                    <span>{t('ui.preview_cards')}</span>
                                </h3>

                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {(() => {
                                        const cards = getFactionCards(focusedFactionId);
                                        const meta = FACTION_METADATA.find(f => f.id === focusedFactionId);
                                        return cards.map((card, cidx) => (
                                            <div
                                                key={card.id}
                                                className="group relative aspect-[0.714] rounded-sm overflow-hidden bg-white p-[0.15vw] shadow-md border-2 border-slate-100 transition-all cursor-zoom-in hover:z-20 hover:scale-110 hover:shadow-xl"
                                                style={{ transform: `rotate(${(cidx % 5) - 2}deg)` }}
                                                onClick={() => setViewingCard({ defId: card.id, type: card.type })}
                                            >
                                                <div className="w-full h-full bg-slate-100 overflow-hidden relative">
                                                    <CardPreview
                                                        previewRef={card.previewRef}
                                                        className="w-full h-full object-cover"
                                                    />

                                                    {/* 卡牌数量徽章 */}
                                                    {card.count > 1 && (
                                                        <div className="absolute top-1.5 right-1.5 z-30 min-w-[22px] h-[22px] px-1 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center shadow-md">
                                                            <span className="text-white font-black text-[10px] leading-none">×{card.count}</span>
                                                        </div>
                                                    )}

                                                    {/* Hover Action Icon */}
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 p-1.5 rounded-full text-white z-30">
                                                        <ZoomIn size={16} />
                                                    </div>

                                                    {/* Hover info */}
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
                                        ));
                                    })()}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* FOOTER: Status Bar - Floating Score Sheet style */}
            <div className="absolute bottom-6 inset-x-0 z-40 pointer-events-none">
                <div className="max-w-7xl mx-auto flex items-end justify-center gap-8 px-6">
                    {core.turnOrder.map((pid, pidx) => {
                        const selections = selectionState.playerSelections[pid] || [];
                        const isCurrent = pid === currentPlayerId;

                        return (
                            <motion.div
                                key={pid}
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5 + pidx * 0.1 }}
                                className={`
                                    flex flex-col items-center gap-2 px-6 py-3 rounded-sm border-2 pointer-events-auto transition-all
                                    ${isCurrent
                                        ? 'bg-[#fef3c7] border-amber-500 shadow-[0_10px_25px_rgba(0,0,0,0.5)] -rotate-1 z-10 scale-110'
                                        : 'bg-white/90 border-slate-200 shadow-lg rotate-1 grayscale-[0.3]'}
                                `}
                            >
                                {/* Player Avatar Circle */}
                                <div className={`
                                    w-12 h-12 rounded-full flex items-center justify-center font-black text-lg text-white shadow-inner border-4 border-white
                                    ${pid === '0' ? 'bg-red-500' : pidx === 1 ? 'bg-blue-500' : 'bg-green-500'}
                                `}>
                                    {t('ui.player_short', { id: pid })}
                                </div>

                                {/* Selections */}
                                <div className="flex gap-2">
                                    {[0, 1].map(i => {
                                        const fid = selections[i];
                                        const meta = fid ? FACTION_METADATA.find(f => f.id === fid) : null;

                                        return (
                                            <div
                                                key={i}
                                                className={`
                                                    w-12 h-12 rounded-sm border-2 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm transition-all
                                                    ${!fid ? 'border-dashed border-slate-300 opacity-40' : 'border-slate-800 rotate-[-4deg]'}
                                                `}
                                                title={meta ? t(meta.nameKey) : undefined}
                                                style={{ transform: fid ? `rotate(${(i * 10) - 5}deg)` : 'none' }}
                                            >
                                                {meta?.icon ? (
                                                    <div className="text-slate-900">
                                                        <meta.icon size={28} strokeWidth={2.5} />
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-black">?</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex flex-col items-center">
                                    <span className={`text-[11px] font-black uppercase tracking-tighter leading-none ${isCurrent ? 'text-amber-800' : 'text-slate-50'}`}>
                                        {t('ui.player_short', { id: pid })}
                                    </span>
                                    {isCurrent && (
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1 animate-pulse">
                                            {t('ui.thinking')}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* CARD MAGNIFICATION OVERLAY */}
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
        </div >
    );
};

