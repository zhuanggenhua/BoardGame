import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { CardInstance } from '../domain/types';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardDef as lookupCardDef, getMinionDef as lookupMinionDef, resolveCardName, resolveCardText } from '../data/cards';
import { UI_Z_INDEX } from '../../../core';
import { SMASHUP_CARD_BACK } from '../domain/ids';

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
    /** 是否显示为对手视角（显示牌背） */
    isOpponentView?: boolean;
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
    /** 是否显示为对手视角（显示牌背） */
    isOpponentView: boolean;
    /** 跳过初始动画（用于视角切换） */
    skipAnimation?: boolean;
    onSelect: () => void;
    onViewDetail?: () => void;
};


const HandCard: React.FC<HandCardProps> = ({
    card, index, total, isSelected, isDiscardSelected, isDiscardMode, disableInteraction, isDisabled, isOpponentView, onSelect, onViewDetail
}) => {
    const { t } = useTranslation('game-smashup');
    const [isHovered, setIsHovered] = useState(false);
    const [isShaking, setIsShaking] = useState(false);

    // Lookup Data
    const def = lookupCardDef(card.defId);
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
                relative flex-shrink-0 origin-bottom pointer-events-auto
                hover:!z-50
                ${isOpponentView ? 'cursor-default' : 'cursor-pointer'}
            `}
            style={{
                width: `${CARD_WIDTH_VW}vw`,
                aspectRatio: `${CARD_ASPECT_RATIO}`,
                marginLeft: index === 0 ? 0 : `${spacingVw}vw`,
                zIndex: baseZIndex
            }}
            // 对手视角时完全不使用动画
            initial={isOpponentView ? { opacity: 1, y: 0, scale: 1, rotate: rotationSeed } : { y: 200, opacity: 0, scale: 0.8 }}
            animate={{
                // 弃牌选中时小幅上移（2vw），普通选中时大幅上移（5vw）
                y: isSelected && !isDiscardSelected ? `-${SELECTED_Y_LIFT_VW}vw` : isDiscardSelected ? '-2vw' : '0',
                scale: (isSelected && !isDiscardSelected) ? 1.15 : 1,
                rotate: isShaking ? [0, -6, 6, -4, 4, 0] : ((isSelected && !isDiscardSelected) ? 0 : rotationSeed),
                opacity: 1
            }}
            exit={isOpponentView ? undefined : { y: 200, opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            transition={isOpponentView ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 28 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onClick={() => {
                if (isOpponentView) return; // 对手视角不可点击
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
                ${!isSelected && !isDiscardSelected && !isDisabled && !isOpponentView ? (isDiscardMode ? 'ring-2 ring-red-500/30' : 'hover:ring-2 hover:ring-white hover:shadow-xl') : ''}
            `}>

                {/* Detail View Button (Magnifying Glass) - Appears on hover, inside card top-right */}
                {!isOpponentView && (
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
                )}

                {/* Card Asset Preview */}
                <div className="w-full h-full rounded-md overflow-hidden bg-[#f3f0e8] border border-slate-400/50 shadow-inner relative">
                    <CardPreview
                        previewRef={isOpponentView 
                            ? SMASHUP_CARD_BACK
                            : (def?.previewRef
                                ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId } }
                                : undefined)
                        }
                        className="w-full h-full object-cover"
                        title={isOpponentView ? t('ui.opponent_card') : previewTitle}
                    />
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
    isOpponentView = false,
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
                {/* 对手视角：不使用 AnimatePresence，直接渲染静态卡牌 */}
                {isOpponentView ? (
                    hand.map((card, i) => (
                        <HandCard
                            key={card.uid}
                            card={card}
                            index={i}
                            total={hand.length}
                            isSelected={false}
                            isDiscardSelected={false}
                            isDiscardMode={false}
                            disableInteraction={true}
                            isDisabled={false}
                            isOpponentView={true}
                            onSelect={() => {}}
                            onViewDetail={() => {}}
                        />
                    ))
                ) : (
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
                                isOpponentView={false}
                                onSelect={() => onCardSelect(card)}
                                onViewDetail={() => onCardView?.(card)}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};