import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SU_COMMANDS, getCurrentPlayerId } from '../domain/types';
import type { SmashUpCore } from '../domain/types';
import { FACTION_METADATA } from './factionMeta';
import type { PlayerId } from '../../../engine/types';
import { getFactionCards } from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { X, Check, Search, Layers } from 'lucide-react';

interface Props {
    core: SmashUpCore;
    moves: Record<string, any>;
    playerID: PlayerId | null;
}

export const FactionSelection: React.FC<Props> = ({ core, moves, playerID }) => {
    const { t } = useTranslation('game-smashup');
    const selectionState = core.factionSelection;
    const [focusedFactionId, setFocusedFactionId] = useState<string | null>(null);

    if (!selectionState) return null;

    const takenFactions = new Set(selectionState.takenFactions);
    const mySelections = playerID ? selectionState.playerSelections[playerID] || [] : [];
    const isMyTurn = playerID === getCurrentPlayerId(core);
    const currentPlayerId = getCurrentPlayerId(core);

    const handleConfirmSelect = (factionId: string) => {
        if (!isMyTurn) return;
        if (takenFactions.has(factionId)) return;
        if (mySelections.length >= 2) return;

        moves[SU_COMMANDS.SELECT_FACTION]?.({ factionId });
        setFocusedFactionId(null);
    };

    return (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center overflow-hidden font-sans selection:bg-blue-500/30">
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-80 pointer-events-none" />

            {/* HEADLINE AREA */}
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center pt-8 pb-4 relative z-10 w-full max-w-4xl mx-auto"
            >
                <div className="flex flex-col items-center justify-center mb-2">
                    <span className="text-blue-400 font-bold tracking-widest uppercase text-xs mb-1 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                        {isMyTurn ? t('ui.your_turn_prompt') : t('ui.waiting_for_player', { id: currentPlayerId })}
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-2xl">
                        {t('ui.select_factions_title')}
                    </h1>
                </div>

                <p className="text-slate-400 text-sm max-w-lg mx-auto">
                    {t('ui.select_factions_desc')}
                </p>
            </motion.div>

            {/* FACTION GRID */}
            <div className="flex-1 w-full max-w-7xl overflow-y-auto px-6 py-8 relative z-10 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-32">
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
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                onClick={() => setFocusedFactionId(faction.id)}
                                className={`
                                    group relative flex flex-col items-center cursor-pointer perspective-1000
                                    ${isTaken ? 'opacity-50 grayscale' : 'hover:z-10'}
                                `}
                            >
                                {/* Card Stack Visual */}
                                <div className="relative w-40 h-56 md:w-48 md:h-64 mb-4 transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-2">
                                    {/* Back Cards (Decorations) */}
                                    <div className="absolute inset-0 bg-slate-700 rounded-xl transform rotate-6 translate-x-2 translate-y-1 border border-white/5 opacity-60 shadow-lg" />
                                    <div className="absolute inset-0 bg-slate-600 rounded-xl transform -rotate-3 translate-x-1 translate-y-2 border border-white/5 opacity-80 shadow-lg" />

                                    {/* Main Cover Card */}
                                    <div className={`
                                        absolute inset-0 rounded-xl overflow-hidden shadow-2xl border-2 transition-colors
                                        bg-slate-800
                                        ${isSelectedByMe
                                            ? 'border-green-500 ring-4 ring-green-500/20'
                                            : isTaken
                                                ? 'border-slate-600'
                                                : 'border-white/10 group-hover:border-blue-400/50'
                                        }
                                    `}>
                                        <CardPreview
                                            previewRef={coverCard?.previewRef}
                                            className="w-full h-full object-cover"
                                        />

                                        {/* Overlay Gradient for Text Readability */}
                                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />

                                        {/* Taken Status */}
                                        {isTaken && (
                                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center">
                                                <span className="text-3xl mb-1">🔒</span>
                                                <span className="font-bold text-white text-sm uppercase tracking-wider">
                                                    {t('ui.player_taken', { id: ownerId })}
                                                </span>
                                            </div>
                                        )}

                                        {/* Faction Name on Card */}
                                        <div className="absolute bottom-3 left-3 right-3 text-left">
                                            <h3 className="text-white font-black text-lg leading-none mb-1 text-shadow-sm filter drop-shadow-md">
                                                {faction.name}
                                            </h3>
                                            <div className="flex items-center gap-1">
                                                <div className="h-1 w-8 rounded-full" style={{ backgroundColor: faction.color }} />
                                            </div>
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
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setFocusedFactionId(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />

                        {/* Modal Content */}
                        <motion.div
                            layoutId={focusedFactionId}
                            className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setFocusedFactionId(null)}
                                className="absolute top-4 right-4 z-50 p-2 bg-black/20 hover:bg-white/10 rounded-full text-white transition-colors"
                            >
                                <X size={24} />
                            </button>

                            {/* Left Panel: Info & Action */}
                            <div className="w-full md:w-1/3 bg-slate-950 p-6 md:p-8 flex flex-col border-r border-white/5 relative overflow-hidden">
                                {/* Ambient Background */}
                                <div
                                    className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none blur-3xl saturate-200"
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
                                                <div className="flex items-center gap-2 mb-2 opacity-70">
                                                    <Layers size={16} />
                                                    <span className="text-xs font-bold uppercase tracking-wider">{t('ui.faction_details')}</span>
                                                </div>
                                                <h2 className="text-4xl font-black text-white mb-4">{meta.name}</h2>

                                                <div className="flex gap-2 mb-6">
                                                    <div className="px-2 py-1 bg-white/10 rounded text-xs font-bold text-white border border-white/10">
                                                        {t('ui.minion_count', { count: cards.filter(c => c.type === 'minion').length })}
                                                    </div>
                                                    <div className="px-2 py-1 bg-white/10 rounded text-xs font-bold text-white border border-white/10">
                                                        {t('ui.action_count', { count: cards.filter(c => c.type === 'action').length })}
                                                    </div>
                                                </div>

                                                <p className="text-slate-300 leading-relaxed mb-8">
                                                    {meta.description}
                                                </p>
                                            </div>

                                            <div className="mt-auto relative z-10">
                                                {isSelectedByMe ? (
                                                    <div className="w-full py-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 font-bold text-center flex items-center justify-center gap-2">
                                                        <Check size={20} />
                                                        {t('ui.selected')}
                                                    </div>
                                                ) : isTaken ? (
                                                    <div className="w-full py-4 bg-slate-800 rounded-lg text-slate-400 font-bold text-center cursor-not-allowed">
                                                        {t('ui.taken_by_other')}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleConfirmSelect(meta.id)}
                                                        disabled={!canSelect}
                                                        className={`
                                                            w-full py-4 rounded-lg font-black text-lg tracking-wide uppercase transition-all
                                                            flex items-center justify-center gap-2
                                                            ${canSelect
                                                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/30 active:scale-95'
                                                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'}
                                                        `}
                                                    >
                                                        {isMyTurn
                                                            ? (mySelections.length >= 2 ? t('ui.faction_full') : t('ui.confirm_selection'))
                                                            : t('ui.wait_turn')}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Right Panel: Card Grid */}
                            <div className="flex-1 bg-slate-900 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                                <h3 className="text-white/50 text-sm font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Search size={14} />
                                    <span>{t('ui.preview_cards')}</span>
                                </h3>

                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {getFactionCards(focusedFactionId).map((card) => (
                                        <div key={card.id} className="group relative aspect-[0.714] rounded-lg overflow-hidden bg-slate-800 border border-white/5 shadow-md hover:border-white/30 transition-colors">
                                            <CardPreview
                                                previewRef={card.previewRef}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Hover info */}
                                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
                                                <div className="text-white font-bold text-sm leading-tight mb-1">{card.name}</div>
                                                <div className="text-[10px] text-white/70 uppercase tracking-wider">
                                                    {card.type === 'minion' ? `${t('ui.minion')}: ${(card as any).power}` : t('ui.action')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* FOOTER: Status Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-slate-950 border-t border-white/5 p-4 z-40">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2 md:pb-0">
                        {core.turnOrder.map(pid => {
                            const selections = selectionState.playerSelections[pid] || [];
                            const isCurrent = pid === currentPlayerId;

                            return (
                                <div key={pid} className={`
                                    flex items-center gap-3 px-4 py-2 rounded-full border transition-all min-w-[140px]
                                    ${isCurrent
                                        ? 'bg-blue-900/30 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                        : 'bg-slate-900/50 border-white/5'}
                                `}>
                                    {/* Player Avatar Circle */}
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                        ${isCurrent ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}
                                    `}>
                                        P{pid}
                                    </div>

                                    {/* Selections */}
                                    <div className="flex gap-[-8px]">
                                        {[0, 1].map(i => {
                                            const fid = selections[i];
                                            const meta = fid ? FACTION_METADATA.find(f => f.id === fid) : null;
                                            const card = fid ? getFactionCards(fid).find(c => c.type === 'minion') : null;

                                            return (
                                                <div
                                                    key={i}
                                                    className={`
                                                        w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden
                                                        ${!fid ? 'border-dashed border-slate-700' : ''}
                                                    `}
                                                    title={meta?.name}
                                                    style={{ marginLeft: i > 0 ? '-10px' : '0' }}
                                                >
                                                    {card ? (
                                                        <CardPreview
                                                            previewRef={card.previewRef}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-slate-600">?</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {isCurrent && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse ml-auto" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
};
