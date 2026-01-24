import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 抽牌动画数据结构
export interface CardDrawData {
    id: string;
    atlasIndex: number;
    // 起始位置（牌库中心，卡牌从这里开始）
    startPos: { x: number; y: number };
    // 起始尺寸（牌库卡牌大小）
    startSize: { width: number; height: number };
    // 结束位置（手牌区域中心）
    endPos: { x: number; y: number };
    // 结束尺寸（手牌卡牌大小）
    endSize: { width: number; height: number };
    // 卡背图片
    cardBackImage: string;
    // 卡面图集图片
    cardFrontImage: string;
    // 图集样式
    atlasStyle: React.CSSProperties;
}

// 单张卡牌抽取动画（从牌库飞出、放大、3D翻转）
const CardDrawItem = ({
    card,
    delay,
    onComplete,
}: {
    card: CardDrawData;
    delay: number;
    onComplete: (id: string) => void;
}) => {
    const [phase, setPhase] = React.useState<'flying' | 'flipping' | 'done'>('flying');

    // 飞行阶段完成后进入翻面阶段
    const handleFlyComplete = () => {
        setPhase('flipping');
    };

    // 翻面阶段完成后标记完成
    const handleFlipComplete = () => {
        setPhase('done');
        onComplete(card.id);
    };

    // 计算起始和结束的尺寸缩放比例
    const startScale = card.startSize.width / card.endSize.width;

    return (
        <motion.div
            className="fixed z-[9998] pointer-events-none"
            style={{
                // 定位到起始位置中心（减去卡牌一半尺寸）
                left: card.startPos.x - card.endSize.width / 2,
                top: card.startPos.y - card.endSize.height / 2,
                width: card.endSize.width,
                height: card.endSize.height,
                transformOrigin: 'center center',
            }}
            initial={{
                x: 0,
                y: 0,
                scale: startScale,
                opacity: 1,
            }}
            animate={{
                x: card.endPos.x - card.startPos.x,
                y: card.endPos.y - card.startPos.y,
                scale: 1,
                opacity: 1,
            }}
            transition={{
                delay,
                duration: 0.5,
                ease: [0.25, 0.46, 0.45, 0.94],
            }}
            onAnimationComplete={() => {
                if (phase === 'flying') handleFlyComplete();
            }}
        >
            {/* 3D翻转容器 - 使用 perspective 在父容器上 */}
            <div
                className="relative w-full h-full"
                style={{ perspective: '1000px' }}
            >
                <motion.div
                    className="relative w-full h-full rounded-[0.8vw] shadow-2xl"
                    style={{ transformStyle: 'preserve-3d' }}
                    initial={{ rotateY: 0 }}
                    animate={phase === 'flipping' || phase === 'done' ? { rotateY: 180 } : { rotateY: 0 }}
                    transition={{
                        duration: 0.4,
                        ease: 'easeInOut',
                    }}
                    onAnimationComplete={() => {
                        if (phase === 'flipping') handleFlipComplete();
                    }}
                >
                    {/* 卡背（初始可见） */}
                    <div
                        className="absolute inset-0 w-full h-full rounded-[0.8vw] overflow-hidden border-2 border-amber-900/50"
                        style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            backgroundImage: card.cardBackImage,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundColor: '#1e293b',
                        }}
                    />
                    {/* 卡面（翻转后可见） */}
                    <div
                        className="absolute inset-0 w-full h-full rounded-[0.8vw] overflow-hidden border-2 border-slate-600"
                        style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            backgroundImage: card.cardFrontImage,
                            backgroundRepeat: 'no-repeat',
                            backgroundColor: '#1e293b',
                            ...card.atlasStyle,
                        }}
                    />
                </motion.div>
            </div>
        </motion.div>
    );
};

// 抽牌动画层
export const CardDrawAnimationLayer = ({
    cards,
    onCardComplete,
}: {
    cards: CardDrawData[];
    onCardComplete: (id: string) => void;
}) => {
    return (
        <AnimatePresence>
            {cards.map((card, index) => (
                <CardDrawItem
                    key={card.id}
                    card={card}
                    delay={index * 0.15}
                    onComplete={onCardComplete}
                />
            ))}
        </AnimatePresence>
    );
};

// Hook: 管理抽牌动画状态
export const useCardDrawAnimation = () => {
    const [drawingCards, setDrawingCards] = React.useState<CardDrawData[]>([]);

    const pushDrawCard = React.useCallback((card: Omit<CardDrawData, 'id'> & { id?: string }) => {
        const id = card.id || `draw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setDrawingCards(prev => [...prev, { ...card, id }]);
    }, []);

    const removeDrawCard = React.useCallback((id: string) => {
        setDrawingCards(prev => prev.filter(c => c.id !== id));
    }, []);

    const clearAll = React.useCallback(() => {
        setDrawingCards([]);
    }, []);

    return { drawingCards, pushDrawCard, removeDrawCard, clearAll };
};
