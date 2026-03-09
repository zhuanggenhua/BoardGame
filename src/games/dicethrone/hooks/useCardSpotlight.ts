/**
 * useCardSpotlight Hook
 * 
 * 绠＄悊鍗＄墝鐗瑰啓闃熷垪鍜岄澶栭瀛愮壒鍐欏睍绀恒€?
 * 閫氳繃 EventStream 娑堣垂 CARD_PLAYED / ABILITY_REPLACED / BONUS_DIE_ROLLED / BONUS_DIE_REROLLED 浜嬩欢锛?
 * 涓嶅啀浠?core 璇诲彇 lastPlayedCard / lastBonusDieRoll銆?
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerId, EventStreamEntry } from '../../../engine/types';
import type { DieFace, CharacterId } from '../domain/types';
import type { CardSpotlightItem } from '../ui/CardSpotlightOverlay';
import { findHeroCard } from '../heroes';
import { useEventStreamCursor } from '../../../engine/hooks';

/**
 * 鍗＄墝鐗瑰啓閰嶇疆
 */
export interface CardSpotlightConfig {
    /** EventStream entries锛堟潵鑷?getEventStreamEntries(rawG)锛?*/
    eventStreamEntries: EventStreamEntry[];
    /** 褰撳墠鐜╁ ID */
    currentPlayerId: PlayerId;
    /** 瀵规墜鍚嶇О */
    opponentName: string;
    /** 鏄惁涓鸿鎴樻ā寮忥紙瑙傛垬鏄剧ず鍏ㄩ儴鐗瑰啓锛?*/
    isSpectator?: boolean;
    /** 鐜╁閫夎鏄犲皠锛堢敤浜庤В鏋愰瀛愬浘闆嗭級 */
    selectedCharacters?: Record<PlayerId, CharacterId>;
}

const normalizePlayerId = (value: PlayerId | string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    const match = raw.match(/(\d+)$/);
    return match ? match[1] : raw;
};

/**
 * 鍗＄墝鐗瑰啓鐘舵€?
 */
export interface CardSpotlightState {
    /** 鍗＄墝鐗瑰啓闃熷垪 */
    cardSpotlightQueue: CardSpotlightItem[];
    /** 鍏抽棴鍗＄墝鐗瑰啓 */
    handleCardSpotlightClose: (id: string) => void;
    /** 棰濆楠板瓙灞曠ず鐘舵€?*/
    bonusDie: {
        value?: number;
        face?: DieFace;
        effectKey?: string;
        effectParams?: Record<string, string | number>;
        show: boolean;
        /** 楠板瓙鎵€灞炶鑹诧紙鐢ㄤ簬鍥鹃泦閫夋嫨锛?*/
        characterId?: string;
    };
    /** 鍏抽棴棰濆楠板瓙鐗瑰啓 */
    handleBonusDieClose: () => void;
}

/** 浜嬩欢 payload 绫诲瀷锛堜粎浠?payload 鎻愬彇闇€瑕佺殑瀛楁锛?*/
interface CardEventPayload { playerId: PlayerId; cardId: string }
interface BonusDiePayload { value: number; face: DieFace; playerId: PlayerId; targetPlayerId?: PlayerId; effectKey?: string; effectParams?: Record<string, string | number> }
interface BonusDieRerolledPayload { newValue: number; newFace: DieFace; playerId: PlayerId; targetPlayerId?: PlayerId; effectKey?: string; effectParams?: Record<string, string | number> }

/** 鍗＄墝鐗瑰啓鐩稿叧鐨勪簨浠剁被鍨?*/
const CARD_EVENT_TYPES = new Set(['CARD_PLAYED', 'ABILITY_REPLACED']);
const BONUS_DIE_EVENT_TYPES = new Set(['BONUS_DIE_ROLLED', 'BONUS_DIE_REROLLED']);

/**
 * 绠＄悊鍗＄墝鍜岄澶栭瀛愮壒鍐欓槦鍒楋紙EventStream 椹卞姩锛?
 */
export function useCardSpotlight(config: CardSpotlightConfig): CardSpotlightState {
    const {
        eventStreamEntries,
        currentPlayerId,
        opponentName,
        isSpectator = false,
        selectedCharacters,
    } = config;

    // 鍗＄墝鐗瑰啓闃熷垪
    const [cardSpotlightQueue, setCardSpotlightQueue] = useState<CardSpotlightItem[]>([]);
    const cardSpotlightQueueRef = useRef<CardSpotlightItem[]>([]);

    // 棰濆楠板瓙鐘舵€?
    const [bonusDieValue, setBonusDieValue] = useState<number | undefined>(undefined);
    const [bonusDieFace, setBonusDieFace] = useState<DieFace | undefined>(undefined);
    const [bonusDieEffectKey, setBonusDieEffectKey] = useState<string | undefined>(undefined);
    const [bonusDieEffectParams, setBonusDieEffectParams] = useState<Record<string, string | number> | undefined>(undefined);
    const [bonusDieCharacterId, setBonusDieCharacterId] = useState<string | undefined>(undefined);
    const [showBonusDie, setShowBonusDie] = useState(false);

    // 閫氱敤娓告爣锛堣嚜鍔ㄥ鐞嗛娆℃寕杞借烦杩?+ Undo 閲嶇疆锛?
    const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });

    // 鍚屾闃熷垪鍒?ref
    useEffect(() => {
        cardSpotlightQueueRef.current = cardSpotlightQueue;
    }, [cardSpotlightQueue]);

    /**
     * 鏍稿績锛氭秷璐?EventStream 涓殑鏂颁簨浠?
     */
    useEffect(() => {
        const { entries: newEntries } = consumeNew();
        if (newEntries.length === 0) return;

        // 濡傛灉鍚屼竴鎵逛簨浠朵腑鏈?BONUS_DICE_REROLL_REQUESTED锛?
        // 璺宠繃鏃犳硶缁戝畾鍒板崱鐗岀壒鍐欑殑鐙珛 BONUS_DIE_ROLLED 鍗曢鐗瑰啓锛堝楠伴潰鏉垮凡灞曠ず鍏ㄩ儴楠板瓙锛?
        const hasBonusDiceSettlement = newEntries.some(e => e.event.type === 'BONUS_DICE_REROLL_REQUESTED');

        const selfId = normalizePlayerId(currentPlayerId);
        const nextCardSpotlightQueue = [...cardSpotlightQueueRef.current];
        let didUpdateCardSpotlightQueue = false;
        let pendingStandaloneBonusDie: {
            value: number;
            face?: DieFace;
            effectKey?: string;
            effectParams?: Record<string, string | number>;
            characterId?: string;
        } | null = null;

        for (const entry of newEntries) {
            const { type, payload, timestamp } = entry.event;
            const eventTimestamp = typeof timestamp === 'number' ? timestamp : 0;

            // ---- 鍗＄墝鐗瑰啓锛欳ARD_PLAYED / ABILITY_REPLACED ----
            if (CARD_EVENT_TYPES.has(type)) {
                const p = payload as CardEventPayload;
                const cardPlayerId = normalizePlayerId(p.playerId);

                // 鑷繁鎵撶殑鍗′笉鏄剧ず鐗瑰啓锛堣鎴樻ā寮忛櫎澶栵級
                if (!isSpectator && cardPlayerId === selfId) continue;

                // 閫氳繃闈欐€佽〃瑙ｆ瀽 previewRef锛堟浛浠ｅ師 reducer 涓殑 findHeroCard 璋冪敤锛?
                const heroCard = findHeroCard(p.cardId);

                const newItem: CardSpotlightItem = {
                    id: `${p.cardId}-${eventTimestamp}`,
                    timestamp: eventTimestamp,
                    previewRef: heroCard?.previewRef,
                    playerId: p.playerId,
                    playerName: opponentName,
                };
                nextCardSpotlightQueue.push(newItem);
                didUpdateCardSpotlightQueue = true;
            }

            // ---- 濂栧姳楠扮壒鍐欙細BONUS_DIE_ROLLED / BONUS_DIE_REROLLED ----
            if (BONUS_DIE_EVENT_TYPES.has(type)) {
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
                    // BONUS_DIE_REROLLED锛氶噸鎺蜂簨浠朵笉瑙﹀彂鐙珛鐗瑰啓锛堢敤鎴峰凡鍦?BonusDieOverlay 涓湅鍒帮級
                    continue;
                }

                const bonusPid = normalizePlayerId(bonusPlayerId);
                const bonusTid = normalizePlayerId(bonusTargetId ?? bonusPlayerId);
                const shouldShowBonusDie = isSpectator || selfId === bonusPid || selfId === bonusTid;

                if (!shouldShowBonusDie) continue;

                // 浠?selectedCharacters 瑙ｆ瀽楠板瓙鎵€灞炶鑹?
                const resolvedCharacterId = selectedCharacters?.[bonusPid as PlayerId]
                    ?? selectedCharacters?.[bonusPlayerId]
                    ?? undefined;

                // 妫€娴嬫槸鍚︿负姹囨€讳簨浠讹紙effectKey 鍖呭惈 .result锛?
                const isSummaryEvent = bonusEffectKey?.includes('.result');

                // 灏濊瘯缁戝畾鍒板崱鐗岄槦鍒楋紙鍗″乏楠板彸锛?
                const thresholdMs = 1500;
                let cardCandidateIndex = -1;
                for (let index = nextCardSpotlightQueue.length - 1; index >= 0; index -= 1) {
                    const item = nextCardSpotlightQueue[index];
                    if (
                        normalizePlayerId(item.playerId) === bonusPid &&
                        Math.abs(item.timestamp - eventTimestamp) <= thresholdMs
                    ) {
                        cardCandidateIndex = index;
                        break;
                    }
                }

                if (cardCandidateIndex >= 0) {
                    const cardCandidate = nextCardSpotlightQueue[cardCandidateIndex];
                    if (isSummaryEvent) {
                        // 姹囨€讳簨浠讹細娣诲姞鍒?summaryText 瀛楁
                        nextCardSpotlightQueue[cardCandidateIndex] = {
                            ...cardCandidate,
                            summaryText: {
                                effectKey: bonusEffectKey!,
                                effectParams: bonusEffectParams!,
                            },
                        };
                    } else {
                        // 鏅€氶瀛愪簨浠讹細娣诲姞鍒?bonusDice 鏁扮粍
                        nextCardSpotlightQueue[cardCandidateIndex] = {
                            ...cardCandidate,
                            bonusDice: [
                                ...(cardCandidate.bonusDice || []),
                                {
                                    value: bonusValue,
                                    face: bonusFace,
                                    timestamp: eventTimestamp,
                                    effectKey: bonusEffectKey,
                                    effectParams: bonusEffectParams,
                                    characterId: resolvedCharacterId,
                                },
                            ],
                        };
                    }
                    didUpdateCardSpotlightQueue = true;
                } else {
                    // 澶氶闈㈡澘锛圔onusDieOverlay reroll 妯″紡锛夊凡灞曠ず鍏ㄩ儴楠板瓙锛?
                    // 娌℃湁鍗＄墝鐗瑰啓鍙壙杞芥椂锛屾墠璺宠繃鐙珛鍗曢鐗瑰啓
                    if (hasBonusDiceSettlement) continue;
                    // 鐙珛楠板瓙鐗瑰啓锛堜笉缁戝畾鍒板崱鐗岋級
                    pendingStandaloneBonusDie = {
                        value: bonusValue,
                        face: bonusFace,
                        effectKey: bonusEffectKey,
                        effectParams: bonusEffectParams,
                        characterId: resolvedCharacterId,
                    };
                }
            }
        }

        if (didUpdateCardSpotlightQueue) {
            cardSpotlightQueueRef.current = nextCardSpotlightQueue;
            setCardSpotlightQueue(nextCardSpotlightQueue);
        }

        if (pendingStandaloneBonusDie) {
            setBonusDieValue(pendingStandaloneBonusDie.value);
            setBonusDieFace(pendingStandaloneBonusDie.face);
            setBonusDieEffectKey(pendingStandaloneBonusDie.effectKey);
            setBonusDieEffectParams(pendingStandaloneBonusDie.effectParams);
            setBonusDieCharacterId(pendingStandaloneBonusDie.characterId);
            setShowBonusDie(true);
        }
    }, [eventStreamEntries, consumeNew, currentPlayerId, opponentName, isSpectator, selectedCharacters]);

    /**
     * 鍏抽棴鍗＄墝鐗瑰啓
     */
    const handleCardSpotlightClose = useCallback((id: string) => {
        setCardSpotlightQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    /**
     * 鍏抽棴棰濆楠板瓙鐗瑰啓
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

