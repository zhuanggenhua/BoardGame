/**
 * useCardSpotlight Hook
 * 
 * 管理卡牌特写队列和额外骰子特写展示。
 * 通过 EventStream 消费 CARD_PLAYED / ABILITY_REPLACED / BONUS_DIE_ROLLED / BONUS_DIE_REROLLED 事件，
 * 不再从 core 读取 lastPlayedCard / lastBonusDieRoll。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerId, EventStreamEntry } from '../../../engine/types';
import type { DieFace, CharacterId } from '../domain/types';
import type { CardSpotlightItem } from '../ui/CardSpotlightOverlay';
import { findHeroCard } from '../heroes';
import { useEventStreamCursor } from '../../../engine/hooks';

/**
 * 卡牌特写配置
 */
export interface CardSpotlightConfig {
    /** EventStream entries（来自 getEventStreamEntries(rawG)） */
    eventStreamEntries: EventStreamEntry[];
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 对手名称 */
    opponentName: string;
    /** 是否为观战模式（观战显示全部特写） */
    isSpectator?: boolean;
    /** 玩家选角映射（用于解析骰子图集） */
    selectedCharacters?: Record<PlayerId, CharacterId>;
}

const normalizePlayerId = (value: PlayerId | string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    const match = raw.match(/(\d+)$/);
    return match ? match[1] : raw;
};

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
        effectKey?: string;
        effectParams?: Record<string, string | number>;
        show: boolean;
        /** 骰子所属角色（用于图集选择） */
        characterId?: string;
    };
    /** 关闭额外骰子特写 */
    handleBonusDieClose: () => void;
}

/** 事件 payload 类型（仅从 payload 提取需要的字段） */
interface CardEventPayload { playerId: PlayerId; cardId: string }
interface BonusDiePayload { value: number; face: DieFace; playerId: PlayerId; targetPlayerId?: PlayerId; effectKey?: string; effectParams?: Record<string, string | number> }
interface BonusDieRerolledPayload { newValue: number; newFace: DieFace; playerId: PlayerId; targetPlayerId?: PlayerId; effectKey?: string; effectParams?: Record<string, string | number> }

/** 卡牌特写相关的事件类型 */
const CARD_EVENT_TYPES = new Set(['CARD_PLAYED', 'ABILITY_REPLACED']);
const BONUS_DIE_EVENT_TYPES = new Set(['BONUS_DIE_ROLLED', 'BONUS_DIE_REROLLED']);

/**
 * 管理卡牌和额外骰子特写队列（EventStream 驱动）
 */
export function useCardSpotlight(config: CardSpotlightConfig): CardSpotlightState {
    const {
        eventStreamEntries,
        currentPlayerId,
        opponentName,
        isSpectator = false,
        selectedCharacters,
    } = config;

    // 卡牌特写队列
    const [cardSpotlightQueue, setCardSpotlightQueue] = useState<CardSpotlightItem[]>([]);
    const cardSpotlightQueueRef = useRef<CardSpotlightItem[]>([]);

    // 额外骰子状态
    const [bonusDieValue, setBonusDieValue] = useState<number | undefined>(undefined);
    const [bonusDieFace, setBonusDieFace] = useState<DieFace | undefined>(undefined);
    const [bonusDieEffectKey, setBonusDieEffectKey] = useState<string | undefined>(undefined);
    const [bonusDieEffectParams, setBonusDieEffectParams] = useState<Record<string, string | number> | undefined>(undefined);
    const [bonusDieCharacterId, setBonusDieCharacterId] = useState<string | undefined>(undefined);
    const [showBonusDie, setShowBonusDie] = useState(false);

    // 通用游标（自动处理首次挂载跳过 + Undo 重置）
    const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });

    // 同步队列到 ref
    useEffect(() => {
        cardSpotlightQueueRef.current = cardSpotlightQueue;
    }, [cardSpotlightQueue]);

    /**
     * 核心：消费 EventStream 中的新事件
     */
    useEffect(() => {
        const { entries: newEntries } = consumeNew();
        if (newEntries.length === 0) return;

        // 如果同一批事件中有 BONUS_DICE_REROLL_REQUESTED，
        // 跳过 BONUS_DIE_ROLLED 的单骰特写（多骰面板已展示全部骰子）
        const hasBonusDiceSettlement = newEntries.some(e => e.event.type === 'BONUS_DICE_REROLL_REQUESTED');

        const selfId = normalizePlayerId(currentPlayerId);

        for (const entry of newEntries) {
            const { type, payload, timestamp } = entry.event;
            const eventTimestamp = typeof timestamp === 'number' ? timestamp : 0;

            // ---- 卡牌特写：CARD_PLAYED / ABILITY_REPLACED ----
            if (CARD_EVENT_TYPES.has(type)) {
                const p = payload as CardEventPayload;
                const cardPlayerId = normalizePlayerId(p.playerId);

                // 自己打的卡不显示特写（观战模式除外）
                if (!isSpectator && cardPlayerId === selfId) continue;

                // 通过静态表解析 previewRef（替代原 reducer 中的 findHeroCard 调用）
                const heroCard = findHeroCard(p.cardId);

                const newItem: CardSpotlightItem = {
                    id: `${p.cardId}-${eventTimestamp}`,
                    timestamp: eventTimestamp,
                    previewRef: heroCard?.previewRef,
                    playerId: p.playerId,
                    playerName: opponentName,
                };
                setCardSpotlightQueue(prev => [...prev, newItem]);
            }

            // ---- 奖励骰特写：BONUS_DIE_ROLLED / BONUS_DIE_REROLLED ----
            if (BONUS_DIE_EVENT_TYPES.has(type)) {
                // 多骰面板（BonusDieOverlay reroll 模式）已展示全部骰子，跳过单骰特写
                if (hasBonusDiceSettlement) continue;
                let bonusValue: number;
                let bonusFace: DieFace | undefined;
                let bonusPlayerId: PlayerId;
                let bonusTargetId: PlayerId | undefined;
                let bonusEffectKey: string | undefined;
                let bonusEffectParams: Record<string, string | number> | undefined;

                if (type === 'BONUS_DIE_ROLLED') {
                    const p = payload as BonusDiePayload;
                    bonusValue = p.value;
                    bonusFace = p.face;
                    bonusPlayerId = p.playerId;
                    bonusTargetId = p.targetPlayerId;
                    bonusEffectKey = p.effectKey;
                    bonusEffectParams = p.effectParams;
                } else {
                    // BONUS_DIE_REROLLED：重掷事件不触发独立特写（用户已在 BonusDieOverlay 中看到）
                    continue;
                }

                const bonusPid = normalizePlayerId(bonusPlayerId);
                const bonusTid = normalizePlayerId(bonusTargetId ?? bonusPlayerId);
                const shouldShowBonusDie = isSpectator || selfId === bonusPid || selfId === bonusTid;

                if (!shouldShowBonusDie) continue;

                // 从 selectedCharacters 解析骰子所属角色
                const resolvedCharacterId = selectedCharacters?.[bonusPid as PlayerId]
                    ?? selectedCharacters?.[bonusPlayerId]
                    ?? undefined;

                // 尝试绑定到卡牌队列（卡左骰右）
                const cardQueue = cardSpotlightQueueRef.current;
                const thresholdMs = 1500;
                const cardCandidate = [...cardQueue]
                    .reverse()
                    .find((item) =>
                        normalizePlayerId(item.playerId) === bonusPid &&
                        Math.abs(item.timestamp - eventTimestamp) <= thresholdMs
                    );

                if (cardCandidate) {
                    setCardSpotlightQueue(prev =>
                        prev.map(item =>
                            item.id === cardCandidate.id
                                ? {
                                    ...item,
                                    bonusDice: [
                                        ...(item.bonusDice || []),
                                        {
                                            value: bonusValue,
                                            face: bonusFace,
                                            timestamp: eventTimestamp,
                                            effectKey: bonusEffectKey,
                                            effectParams: bonusEffectParams,
                                            characterId: resolvedCharacterId,
                                        },
                                    ],
                                }
                                : item
                        )
                    );
                } else {
                    // 独立骰子特写
                    setBonusDieValue(bonusValue);
                    setBonusDieFace(bonusFace);
                    setBonusDieEffectKey(bonusEffectKey);
                    setBonusDieEffectParams(bonusEffectParams);
                    setBonusDieCharacterId(resolvedCharacterId);
                    setShowBonusDie(true);
                }
            }
        }
    }, [eventStreamEntries, consumeNew, currentPlayerId, opponentName, isSpectator, selectedCharacters]);

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
            effectKey: bonusDieEffectKey,
            effectParams: bonusDieEffectParams,
            show: showBonusDie,
            characterId: bonusDieCharacterId,
        },
        handleBonusDieClose,
    };
}

