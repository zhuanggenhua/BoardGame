
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Library, Trash2, X } from 'lucide-react';
import type { CardInstance } from '../domain/types';
import { getCardDef } from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { useDelayedBackdropBlur } from '../../../hooks/ui/useDelayedBackdropBlur';

type Props = {
    deckCount: number;
    discard: CardInstance[];
    myPlayerId: string;
    isMyTurn: boolean;
};

export const DeckDiscardZone: React.FC<Props> = ({ deckCount, discard, isMyTurn }) => {
    const { t } = useTranslation('game-smashup');
    const [showDiscard, setShowDiscard] = useState(false);
    const topCard = discard.length > 0 ? discard[discard.length - 1] : null;
    const topDef = topCard ? getCardDef(topCard.defId) : null;

    const handleDiscardClick = () => {
        if (!isMyTurn) {
            // Optional: You could show a toast here, or just allow viewing regardless of turn.
            // Requirement says "friendly hint if not own turn" but usually viewing discard is allowed anytime.
            // If the user meant "cannot operate", viewing is passive.
            // Assuming "operate" means "discard to limit".
            // If "operate" means "viewing", then we show a hint.
            // But usually discard pile is public info. 
            // Let's assume viewing is always allowed, but maybe "Discard to Limit" is the operation?
            // The prompt "discard to limit" is handled in Board.tsx. 
            // So here we likely just View. 
            // However, the user said "operate on non-turn should have hint". 
            // If this zone is JUST for viewing, then it's fine. 
            // If the user tries to click the "Discard" button in the overlay (which doesn't exist yet)?
            // The user request: "then non-self turn operations should have friendly prompt".
            // Maybe they mean clicking the deck/discard should warn if it's not relevant? 
            // But viewing is always relevant. 
            // Let's allow viewing always, but visual feedback might only be strong on my turn.
        }
        setShowDiscard(true);
    };

    return (
        <>
            {/* Deck Pile - Bottom Left */}
            <div className="absolute bottom-4 left-[2vw] z-30 flex flex-col items-center pointer-events-auto group">
                <div className="relative w-[7.5vw] aspect-[0.714]">
                    {/* Consistent Stack Effect */}
                    <div className="absolute inset-0 bg-slate-700 rounded-sm border border-slate-600 shadow-sm translate-x-1 -translate-y-1 rotate-1" />

                    {/* Top Card Back */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] bg-slate-800 rounded-sm border-2 border-slate-500 shadow-xl flex items-center justify-center z-10 transition-transform group-hover:-translate-y-2">
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center">
                            <span className="text-white font-bold font-mono text-sm">{deckCount}</span>
                        </div>
                    </div>
                </div>
                <div className="mt-2 h-5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Library size={10} /> {t('ui.deck')}
                </div>
            </div>

            {/* Discard Pile - Bottom Right */}
            <div
                className="absolute bottom-4 right-[2vw] z-30 flex flex-col items-center pointer-events-auto group cursor-pointer"
                onClick={handleDiscardClick}
            >
                <div className="relative w-[7.5vw] aspect-[0.714]">
                    {discard.length > 0 ? (
                        <>
                            {/* Symmetric Stack Effect */}
                            <div className="absolute inset-0 bg-white rounded-sm border border-slate-300 shadow-sm -translate-x-1 -translate-y-1 -rotate-1" />

                            {/* Top Card */}
                            <div className="absolute inset-0 bg-white rounded-sm shadow-xl transition-transform group-hover:-translate-y-2 group-hover:rotate-1 border border-slate-200 overflow-hidden">
                                <CardPreview
                                    previewRef={topDef?.previewRef}
                                    className="w-full h-full object-cover"
                                />
                                {!topDef?.previewRef && (
                                    <div className="absolute inset-0 flex items-center justify-center p-1 text-center">
                                        <span className="text-[0.5vw] font-bold leading-none">{topDef?.name || topCard?.defId}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-black/20 rounded-sm border-2 border-dashed border-white/30 flex items-center justify-center">
                            <Trash2 className="text-white/30" />
                        </div>
                    )}
                </div>
                <div className="mt-2 h-5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 group-hover:text-red-400 transition-colors">
                    <Trash2 size={10} /> {t('ui.discard')} ({discard.length}) {(!isMyTurn) && <span className="text-yellow-400 text-[9px]">({t('ui.viewing')})</span>}
                </div>
            </div>

            {/* Discard List Overlay */}
            <AnimatePresence>
                {
                    showDiscard && (
                        <DiscardListOverlay
                            matches={discard}
                            onClose={() => setShowDiscard(false)}
                        />
                    )
                }
            </AnimatePresence >
        </>
    );
};

// Generic-ish Card List Overlay
const DiscardListOverlay: React.FC<{
    matches: CardInstance[];
    onClose: () => void;
}> = ({ matches, onClose }) => {
    const { t } = useTranslation('game-smashup');
    // Standard backdrop blur handling according to AGENTS.md
    const blurActive = useDelayedBackdropBlur(true);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // Apply delay-loaded blur class and ensure pointer events are enabled
            className={`fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-10 cursor-pointer pointer-events-auto ${blurActive ? 'backdrop-blur-md' : ''}`}
            onClick={(e) => {
                // Ensure we are clicking the backdrop div itself
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-[#3e2723] w-full max-w-5xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border-4 border-[#5d4037] relative cursor-auto"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside content
                style={{
                    backgroundImage: 'url(https://www.transparenttextures.com/patterns/wood-pattern.png)'
                }}
            >
                {/* Header */}
                <div className="p-6 bg-black/20 flex justify-between items-center border-b border-[#5d4037]">
                    <h2 className="text-2xl font-black text-[#d7ccc8] uppercase tracking-widest flex items-center gap-3">
                        <Trash2 /> {t('ui.discard_pile')} ({matches.length})
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-[#d7ccc8] hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors z-50 pointer-events-auto cursor-pointer"
                    >
                        <X size={32} />
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#5d4037] scrollbar-track-transparent">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {matches.map((card) => {
                            const def = getCardDef(card.defId);
                            return (
                                <div key={card.uid} className="relative aspect-[0.714] bg-white rounded shadow-lg hover:scale-105 transition-transform group">
                                    <div className="w-full h-full rounded overflow-hidden relative bg-slate-200">
                                        <CardPreview
                                            previewRef={def?.previewRef}
                                            className="w-full h-full object-cover"
                                            title={def?.name}
                                        />
                                        {!def?.previewRef && (
                                            <div className="p-2 text-center text-xs font-bold">{def?.name}</div>
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                </div>
                            );
                        })}
                        {matches.length === 0 && (
                            <div className="col-span-full h-40 flex items-center justify-center text-[#d7ccc8]/50 text-xl font-bold italic">
                                {t('ui.empty_pile')}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
