/**
 * useCardSpotlight Hook
 * 
 * 管理卡牌特写队列和额外骰子特写展示。
 * 自动追踪 lastPlayedCard 和 lastBonusDieRoll 的变化，维护特写队列。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerId } from '../../../engine/types';
import type { DieFace } from '../domain/types';
import type { CardSpotlightItem } from '../ui/CardSpotlightOverlay';

/**
 * 卡牌特写配置
 */
export interface CardSpotlightConfig {
    /** 最后打出的卡牌 */
    lastPlayedCard?: {
        timestamp: number;
        cardId: string;
        atlasIndex?: number;
        playerId: PlayerId;
    };
    /** 最后的额外骰子投掷 */
    lastBonusDieRoll?: {
        timestamp: number;
        value: number;
        face?: DieFace;
        playerId: PlayerId;
    };
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 对手名称 */
    opponentName: string;
}

/**
 * 卡牌特写状态
 */
export interface CardSpotlightState {
    /** 卡牌特写队列 */
    cardSpotlightQueue: CardSpotlightItem[];
    /** 关闭卡牌特写 */
    handleCardSpotlightClose: (id: string) => void;
    /** 额外骰子展示状态 */
    bonusDie: {
        value?: number;
        face?: DieFace;
        show: boolean;
    };
    /** 关闭额外骰子特写 */
    handleBonusDieClose: () => void;
}

/**
 * 管理卡牌和额外骰子特写队列
 */
export function useCardSpotlight(config: CardSpotlightConfig): CardSpotlightState {
    const { lastPlayedCard, lastBonusDieRoll, currentPlayerId, opponentName } = config;

    // 卡牌特写队列
    const [cardSpotlightQueue, setCardSpotlightQueue] = useState<CardSpotlightItem[]>([]);
    const cardSpotlightQueueRef = useRef<CardSpotlightItem[]>([]);

    // 额外骰子状态
    const [bonusDieValue, setBonusDieValue] = useState<number | undefined>(undefined);
    const [bonusDieFace, setBonusDieFace] = useState<DieFace | undefined>(undefined);
    const [showBonusDie, setShowBonusDie] = useState(false);

    // 追踪 timestamp 避免重复触发
    const prevLastPlayedCardTimestampRef = useRef<number | undefined>(lastPlayedCard?.timestamp);
    const prevBonusDieTimestampRef = useRef<number | undefined>(lastBonusDieRoll?.timestamp);

    // 同步队列到 ref
    useEffect(() => {
        cardSpotlightQueueRef.current = cardSpotlightQueue;
    }, [cardSpotlightQueue]);

    /**
     * 监听额外骰子投掷
     */
    useEffect(() => {
        const bonusDie = lastBonusDieRoll;
        const prevTimestamp = prevBonusDieTimestampRef.current;

        if (!bonusDie || bonusDie.timestamp === prevTimestamp) {
            return;
        }

        prevBonusDieTimestampRef.current = bonusDie.timestamp;

        // 尝试绑定到卡牌队列（卡左骰右）
        const cardQueue = cardSpotlightQueueRef.current;
        const thresholdMs = 1500;
        const cardCandidate = [...cardQueue]
            .reverse()
            .find((item) => 
                item.playerId === bonusDie.playerId && 
                Math.abs(item.timestamp - bonusDie.timestamp) <= thresholdMs
            );

        if (cardCandidate) {
            // 绑定到卡牌上一起显示
            setCardSpotlightQueue((prev) =>
                prev.map((item) =>
                    item.id === cardCandidate.id
                        ? {
                            ...item,
                            bonusDice: [
                                ...(item.bonusDice || []),
                                { value: bonusDie.value, face: bonusDie.face, timestamp: bonusDie.timestamp },
                            ],
                        }
                        : item
                )
            );
            setShowBonusDie(false);
            return;
        }

        // 否则使用独立骰子特写
        setBonusDieValue(bonusDie.value);
        setBonusDieFace(bonusDie.face);
        setShowBonusDie(true);
    }, [lastBonusDieRoll]);

    /**
     * 监听其他玩家打出卡牌
     */
    useEffect(() => {
        const card = lastPlayedCard;
        const prevTimestamp = prevLastPlayedCardTimestampRef.current;

        if (!card || card.timestamp === prevTimestamp) {
            return;
        }

        // 只展示其他玩家打出的卡牌
        if (card.playerId !== currentPlayerId) {
            const newItem: CardSpotlightItem = {
                id: `${card.cardId}-${card.timestamp}`,
                timestamp: card.timestamp,
                atlasIndex: card.atlasIndex ?? 0,
                playerId: card.playerId,
                playerName: opponentName,
            };
            setCardSpotlightQueue(prev => [...prev, newItem]);
        }

        prevLastPlayedCardTimestampRef.current = card.timestamp;
    }, [lastPlayedCard, currentPlayerId, opponentName]);

    /**
     * 关闭卡牌特写
     */
    const handleCardSpotlightClose = useCallback((id: string) => {
        setCardSpotlightQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    /**
     * 关闭额外骰子特写
     */
    const handleBonusDieClose = useCallback(() => {
        setShowBonusDie(false);
    }, []);

    return {
        cardSpotlightQueue,
        handleCardSpotlightClose,
        bonusDie: {
            value: bonusDieValue,
            face: bonusDieFace,
            show: showBonusDie,
        },
        handleBonusDieClose,
    };
}
