import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { CardInstance } from '../domain/types';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { User, Swords } from 'lucide-react';
import { getCardDef as lookupCardDef, getMinionDef as lookupMinionDef, resolveCardName, resolveCardText } from '../data/cards';
import { UI_Z_INDEX } from '../../../core';

// ============================================================================
// Layout Constants
// ============================================================================
const CARD_WIDTH_VW = 8.5; // Reduced from 10 to fit better and look less overwhelming
const CARD_ASPECT_RATIO = 0.714;

const SELECTED_Y_LIFT_VW = 5;

type Props = {
    hand: CardInstance[];
    selectedCardUid: string | null;
    onCardSelect: (card: CardInstance) => void;
    onCardView?: (card: CardInstance) => void;
    isDiscardMode?: boolean;
    discardSelection?: Set<string>;
    disableInteraction?: boolean;
    /** 被禁用的卡牌 uid 集合（置灰 + 摇头） */
    disabledCardUids?: Set<string>;
};

// New prop for viewing details
type HandCardProps = {
    card: CardInstance;
    index: number;
    total: number;
    isSelected: boolean;
    isDiscardSelected: boolean;
    isDiscardMode: boolean;
    disableInteraction: boolean;
    /** 此卡被单独禁用（置灰 + 摇头） */
    isDisabled: boolean;
    onSelect: () => void;
    onViewDetail?: () => void;
};


const HandCard: React.FC<HandCardProps> = ({
    card, index, total, isSelected, isDiscardSelected, isDiscardMode, disableInteraction, isDisabled, onSelect, onViewDetail
}) => {
    const { t, i18n } = useTranslation('game-smashup');
    const [isHovered, setIsHovered] = useState(false);
    const [isShaking, setIsShaking] = useState(false);

    // Lookup Data
    const def = lookupCardDef(card.defId);
    const isMinion = card.type === 'minion';
    const minionDef = isMinion ? lookupMinionDef(card.defId) : null;
    const resolvedName = resolveCardName(def, t) || t('ui.card_placeholder');
    const resolvedText = resolveCardText(def, t);
    const previewTitle = resolvedText ? `${resolvedName}\n${resolvedText}` : resolvedName;

    // "Paper Chaos" - Tiny random rotation
    const rotationSeed = useMemo(() => {
        const sum = card.uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return (sum % 4) - 2; // -2 to 2 degrees
    }, [card.uid]);

    // Dynamic Spacing: 
    // Standard gap: 0.8vw
    // If crowded (> 7 cards), start overlapping
    // Max overlap at 10 cards
    const spacingVw = total <= 7 ? 0.8 : -1 * ((total - 7) * 0.8);

    // zIndex 用 CSS hover 提升，避免 state 变化触发 layout 重算导致抽搐
    // 弃牌选中时不提升 z-index，避免遮挡其他卡牌选择
    const baseZIndex = isSelected && !isDiscardSelected ? 100 : index;

    return (
        <motion.div
            className={`
                relative flex-shrink-0 origin-bottom cursor-pointer pointer-events-auto
                hover:!z-50
            `}
            style={{
                width: `${CARD_WIDTH_VW}vw`,
                aspectRatio: `${CARD_ASPECT_RATIO}`,
                marginLeft: index === 0 ? 0 : `${spacingVw}vw`,
                zIndex: baseZIndex
            }}
            initial={{ y: 200, opacity: 0, scale: 0.8 }}
            animate={{
                // 弃牌选中时小幅上移（2vw），普通选中时大幅上移（5vw）
                y: isSelected && !isDiscardSelected ? `-${SELECTED_Y_LIFT_VW}vw` : isDiscardSelected ? '-2vw' : '0',
                scale: (isSelected && !isDiscardSelected) ? 1.15 : 1,
                rotate: isShaking ? [0, -6, 6, -4, 4, 0] : ((isSelected && !isDiscardSelected) ? 0 : rotationSeed),
                opacity: 1
            }}
            exit={{ y: 200, opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onClick={() => {
                if (disableInteraction || isDisabled) {
                    // 不可操作时摇头抖动
                    setIsShaking(true);
                    setTimeout(() => setIsShaking(false), 400);
                    return;
                }
                onSelect();
            }}
        >
            {/* Card Container */}
            <div className={`
                w-full h-full relative rounded-md shadow-md transition-all duration-200
                ${isDisabled ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                ${isSelected ? 'ring-4 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]' : 'shadow-black/30'}
                ${isDiscardSelected ? 'ring-4 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]' : ''}
                ${!isSelected && !isDiscardSelected && !isDisabled ? (isDiscardMode ? 'ring-2 ring-red-500/30' : 'hover:ring-2 hover:ring-white hover:shadow-xl') : ''}
            `}>

                {/* Detail View Button (Magnifying Glass) - Appears on hover, inside card top-right */}
                <button
                    className={`absolute top-[0.3vw] right-[0.3vw] w-[2vw] h-[2vw] flex items-center justify-center bg-black/70 hover:bg-amber-500/90 text-white rounded-full shadow-xl border-2 border-white/30 z-50 cursor-zoom-in transition-[opacity,background-color] duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewDetail?.();
                    }}
                >
                    <svg className="w-[1.1vw] h-[1.1vw] fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </button>

                {/* 1. Real Asset Preview */}
                <div className="w-full h-full rounded-md overflow-hidden bg-[#f3f0e8] border border-slate-400/50 shadow-inner relative">
                    <CardPreview
                        previewRef={def?.previewRef
                            ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId } }
                            : undefined}
                        className="w-full h-full object-cover"
                        title={previewTitle}
                    />

                    {/* 2. Fallback UI - ONLY shown if NO previewRef (Strict check) */}
                    {!def?.previewRef && (
                        <div className="absolute inset-0 p-[0.4vw] flex flex-col pointer-events-none z-20">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-1 h-[20%]">
                                <div className={`px-1 py-0.5 rounded-sm text-[0.5vw] font-black uppercase tracking-wider shadow-sm border border-black/10 transform -rotate-1 
                                    ${isMinion ? 'bg-blue-100/90 text-blue-900' : 'bg-red-100/90 text-red-900'}`}>
                                    {isMinion ? t('ui.minion') : t('ui.action')}
                                </div>
                                {isMinion && (
                                    <div className="w-[1.4vw] h-[1.4vw] rounded-full bg-yellow-400 text-black font-black flex items-center justify-center text-[0.8vw] shadow-md border border-white transform rotate-3">
                                        {minionDef?.power}
                                    </div>
                                )}
                            </div>

                            {/* Center Icon */}
                            <div className="flex-1 flex items-center justify-center opacity-10 rotate-12">
                                {isMinion ? <User size={'3vw'} color="#333" strokeWidth={3} /> : <Swords size={'3vw'} color="#333" strokeWidth={3} />}
                            </div>

                            {/* Footer Text */}
                            <div className="mt-auto bg-white/95 rounded p-[0.4vw] border border-slate-300 shadow-sm rotate-1 relative">
                                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-yellow-200/50 -rotate-2"></div>
                                <div className="text-[0.55vw] font-black text-slate-800 truncate uppercase tracking-tight">{resolvedName}</div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </motion.div>
    );
};

export const HandArea: React.FC<Props> = ({
    hand,
    selectedCardUid,
    onCardSelect,
    onCardView,
    isDiscardMode = false,
    discardSelection,
    disableInteraction = false,
    disabledCardUids,
}) => {
    // Basic mount animation
    const [isLoaded, setIsLoaded] = useState(false);
    useEffect(() => { setIsLoaded(true); }, []);
    if (!isLoaded) return null;

    return (
        <div
            className="absolute bottom-4 left-0 right-0 h-[20vh] flex flex-col justify-end items-center pointer-events-none"
            style={{ zIndex: UI_Z_INDEX.hud }}
            data-testid="su-hand-area"
        >
            <div className="flex items-end justify-center px-4 max-w-[90vw] perspective-[1000px]" data-tutorial-id="su-hand-area">
                <AnimatePresence>
                    {hand.map((card, i) => (
                        <HandCard
                            key={card.uid}
                            card={card}
                            index={i}
                            total={hand.length}
                            isSelected={selectedCardUid === card.uid}
                            isDiscardSelected={!!discardSelection?.has(card.uid)}
                            isDiscardMode={isDiscardMode}
                            disableInteraction={disableInteraction}
                            isDisabled={!!disabledCardUids?.has(card.uid)}
                            onSelect={() => onCardSelect(card)}
                            onViewDetail={() => onCardView?.(card)}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};