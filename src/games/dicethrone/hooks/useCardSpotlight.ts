﻿/**
 * useCardSpotlight Hook
 * 
 * 绠＄悊鍗＄墝鐗瑰啓闃熷垪鍜岄澶栭瀛愮壒鍐欏睍绀恒€?
 * 閫氳繃 EventStream 娑堣垂 CARD_PLAYED / ABILITY_REPLACED / BONUS_DIE_ROLLED / BONUS_DIE_REROLLED 浜嬩欢锛?
 * 涓嶅啀浠?core 璇诲彇 lastPlayedCard / lastBonusDieRoll銆?
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerId, EventStreamEntry } from '../../../engine/types';
import type { DieFace, CharacterId, BonusDieInfo } from '../domain/types';
import type { CardSpotlightItem } from '../ui/CardSpotlightOverlay';
import { findHeroCard } from '../heroes';
import { useEventStreamCursor } from '../../../engine/hooks';
import { createScopedLogger } from '../../../lib/logger';

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
        bonusDice?: BonusDieInfo[];
        summaryEffectKey?: string;
        summaryEffectParams?: Record<string, string | number>;
        showTotal?: boolean;
        displayOnly?: boolean;
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
interface BonusDieRerolledPayload { dieIndex: number; newValue: number; newFace: DieFace; playerId: PlayerId; targetPlayerId?: PlayerId; effectKey?: string; effectParams?: Record<string, string | number> }

/** 鍗＄墝鐗瑰啓鐩稿叧鐨勪簨浠剁被鍨?*/
const CARD_EVENT_TYPES = new Set(['CARD_PLAYED', 'ABILITY_REPLACED']);
const BONUS_DIE_EVENT_TYPES = new Set(['BONUS_DIE_ROLLED', 'BONUS_DIE_REROLLED']);
const CARD_BONUS_BIND_THRESHOLD_MS = 1500;
const spotlightLogger = createScopedLogger('DT_SPOTLIGHT');
type SpotlightBonusDie = NonNullable<CardSpotlightItem['bonusDice']>[number];

function countRelatedBonusDiceEvents(
    entries: EventStreamEntry[],
    cardPlayerId: string,
    cardTimestamp: number,
): number {
    return entries.filter((entry) => {
        if (!BONUS_DIE_EVENT_TYPES.has(entry.event.type)) return false;
        const payload = entry.event.payload as Partial<BonusDiePayload & BonusDieRerolledPayload>;
        const bonusPlayerId = normalizePlayerId(payload.playerId);
        if (bonusPlayerId !== cardPlayerId) return false;
        const bonusTimestamp = typeof entry.event.timestamp === 'number' ? entry.event.timestamp : 0;
        return Math.abs(bonusTimestamp - cardTimestamp) <= CARD_BONUS_BIND_THRESHOLD_MS;
    }).length;
}

function resolveBonusDieIndex(payload: Partial<BonusDiePayload & BonusDieRerolledPayload>): number | undefined {
    if (typeof payload.dieIndex === 'number') {
        return payload.dieIndex;
    }
    const effectIndex = payload.effectParams?.index;
    return typeof effectIndex === 'number' ? effectIndex : undefined;
}

function upsertIndexedDie<T extends { index?: number }>(dice: T[], nextDie: T): T[] {
    if (typeof nextDie.index !== 'number') {
        return [...dice, nextDie];
    }

    const targetIndex = dice.findIndex((die) => die.index === nextDie.index);
    if (targetIndex < 0) {
        return [...dice, nextDie];
    }

    const nextDice = [...dice];
    nextDice[targetIndex] = nextDie;
    return nextDice;
}

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
    const [bonusDiceList, setBonusDiceList] = useState<BonusDieInfo[] | undefined>(undefined);
    const [bonusDieSummaryEffectKey, setBonusDieSummaryEffectKey] = useState<string | undefined>(undefined);
    const [bonusDieSummaryEffectParams, setBonusDieSummaryEffectParams] = useState<Record<string, string | number> | undefined>(undefined);
    const [bonusDieShowTotal, setBonusDieShowTotal] = useState<boolean | undefined>(undefined);
    const [bonusDieDisplayOnly, setBonusDieDisplayOnly] = useState<boolean | undefined>(undefined);
    const [bonusDieCharacterId, setBonusDieCharacterId] = useState<string | undefined>(undefined);
    const [showBonusDie, setShowBonusDie] = useState(false);

    // 閫氱敤娓告爣锛堣嚜鍔ㄥ鐞嗛娆℃寕杞借烦杩?+ Undo 閲嶇疆锛?
    const { consumeNew } = useEventStreamCursor({
        entries: eventStreamEntries,
        consumeOnReconcile: true,
    });

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
        let pendingStandaloneMultiDice: {
            bonusDice: BonusDieInfo[];
            summaryEffectKey?: string;
            summaryEffectParams?: Record<string, string | number>;
            characterId?: string;
            showTotal?: boolean;
            displayOnly?: boolean;
        } | null = null;

        spotlightLogger.info('consume', {
            currentPlayerId: String(currentPlayerId),
            selfId,
            isSpectator,
            entryCount: newEntries.length,
            eventTypes: newEntries.map((entry) => entry.event.type),
            hasBonusDiceSettlement,
        });

        for (const entry of newEntries) {
            const { type, payload, timestamp } = entry.event;
            const eventTimestamp = typeof timestamp === 'number' ? timestamp : 0;

            // ---- 鍗＄墝鐗瑰啓锛欳ARD_PLAYED / ABILITY_REPLACED ----
            if (CARD_EVENT_TYPES.has(type)) {
                const p = payload as CardEventPayload;
                const cardPlayerId = normalizePlayerId(p.playerId);
                const skipSelfCardSpotlight = !isSpectator && cardPlayerId === selfId;

                spotlightLogger.info('card-event', {
                    eventType: type,
                    cardId: p.cardId,
                    cardPlayerId,
                    selfId,
                    skipSelfCardSpotlight,
                });

                // 自己打出的卡牌默认不显示特写；自方多骰改走独立多骰面板聚合
                if (skipSelfCardSpotlight) continue;

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
                let bonusDieIndex: number | undefined;

                if (type === 'BONUS_DIE_ROLLED') {
                    const p = payload as BonusDiePayload;
                    bonusValue = p.value;
                    bonusFace = p.face;
                    bonusPlayerId = p.playerId;
                    bonusTargetId = p.targetPlayerId;
                    bonusEffectKey = p.effectKey;
                    bonusEffectParams = p.effectParams;
                    bonusDieIndex = resolveBonusDieIndex(p);
                } else {
                    const p = payload as BonusDieRerolledPayload;
                    bonusValue = p.newValue;
                    bonusFace = p.newFace;
                    bonusPlayerId = p.playerId;
                    bonusTargetId = p.targetPlayerId;
                    bonusEffectKey = p.effectKey;
                    bonusEffectParams = p.effectParams;
                    bonusDieIndex = resolveBonusDieIndex(p);
                }

                const bonusPid = normalizePlayerId(bonusPlayerId);
                const bonusTid = normalizePlayerId(bonusTargetId ?? bonusPlayerId);
                const viewerInvolved = isSpectator || selfId === bonusPid || selfId === bonusTid;

                let cardCandidateIndex = -1;
                for (let index = nextCardSpotlightQueue.length - 1; index >= 0; index -= 1) {
                    const item = nextCardSpotlightQueue[index];
                    const timeDiff = Math.abs(item.timestamp - eventTimestamp);
                    const playerMatch = normalizePlayerId(item.playerId) === bonusPid;

                    spotlightLogger.info('bonus-card-match-attempt', {
                        index,
                        cardId: item.id,
                        cardTimestamp: item.timestamp,
                        diceTimestamp: eventTimestamp,
                        timeDiff,
                        thresholdMs: CARD_BONUS_BIND_THRESHOLD_MS,
                        playerMatch,
                        withinThreshold: timeDiff <= CARD_BONUS_BIND_THRESHOLD_MS,
                    });

                    if (playerMatch && timeDiff <= CARD_BONUS_BIND_THRESHOLD_MS) {
                        cardCandidateIndex = index;
                        break;
                    }
                }

                const canBindToCardSpotlight = cardCandidateIndex >= 0;
                const shouldShowBonusDie = viewerInvolved || canBindToCardSpotlight;

                spotlightLogger.info('bonus-event', {
                    eventType: type,
                    value: bonusValue,
                    face: bonusFace,
                    effectKey: bonusEffectKey,
                    eventPlayerId: String(bonusPlayerId),
                    eventTargetPlayerId: bonusTargetId === undefined ? undefined : String(bonusTargetId),
                    bonusPid,
                    bonusTid,
                    selfId,
                    viewerInvolved,
                    canBindToCardSpotlight,
                    shouldShowBonusDie,
                });

                if (!shouldShowBonusDie) {
                    spotlightLogger.info('bonus-skip', {
                        reason: 'viewer-not-involved-and-no-card-candidate',
                        eventType: type,
                        bonusPid,
                        bonusTid,
                        selfId,
                    });
                    continue;
                }

                // 浠?selectedCharacters 瑙ｆ瀽楠板瓙鎵€灞炶鑹?
                const resolvedCharacterId = selectedCharacters?.[bonusPid as PlayerId]
                    ?? selectedCharacters?.[bonusPlayerId]
                    ?? undefined;

                // 妫€娴嬫槸鍚︿负姹囨€讳簨浠讹紙effectKey 鍖呭惈 .result锛?
                const isSummaryEvent = bonusEffectKey?.includes('.result');

                spotlightLogger.info('bonus-match', {
                    eventType: type,
                    cardCandidateIndex,
                    queueSize: nextCardSpotlightQueue.length,
                    isSummaryEvent,
                    resolvedCharacterId,
                });

                if (cardCandidateIndex >= 0) {
                    const cardCandidate = nextCardSpotlightQueue[cardCandidateIndex];
                    if (isSummaryEvent) {
                        // 汇总事件：添加到 summaryText 字段
                        spotlightLogger.info('bonus-summary-event', {
                            cardId: cardCandidate.id,
                            effectKey: bonusEffectKey,
                            effectParams: bonusEffectParams,
                        });
                        nextCardSpotlightQueue[cardCandidateIndex] = {
                            ...cardCandidate,
                            summaryText: {
                                effectKey: bonusEffectKey!,
                                effectParams: bonusEffectParams!,
                            },
                        };
                    } else {
                        // 普通骰子事件：添加到 bonusDice 数组
                        const currentDice = cardCandidate.bonusDice || [];
                        const nextBonusDie: SpotlightBonusDie = {
                            index: bonusDieIndex ?? currentDice.length,
                            value: bonusValue,
                            face: bonusFace,
                            timestamp: eventTimestamp,
                            effectKey: bonusEffectKey,
                            effectParams: bonusEffectParams,
                            characterId: resolvedCharacterId,
                        };
                        spotlightLogger.info('bonus-dice-event', {
                            cardId: cardCandidate.id,
                            diceIndex: nextBonusDie.index,
                            value: bonusValue,
                            face: bonusFace,
                            effectKey: bonusEffectKey,
                            hasEffectKey: !!bonusEffectKey,
                        });
                        nextCardSpotlightQueue[cardCandidateIndex] = {
                            ...cardCandidate,
                            bonusDice: upsertIndexedDie(currentDice, nextBonusDie),
                        };
                    }
                    didUpdateCardSpotlightQueue = true;
                    const finalDiceCount = isSummaryEvent 
                        ? (cardCandidate.bonusDice || []).length 
                        : (nextCardSpotlightQueue[cardCandidateIndex].bonusDice || []).length;
                    spotlightLogger.info('bonus-bound-to-card', {
                        eventType: type,
                        cardCandidateIndex,
                        isSummaryEvent,
                        finalDiceCount,
                    });
                } else {
                    // 澶氶闈㈡澘锛圔onusDieOverlay reroll 妯″紡锛夊凡灞曠ず鍏ㄩ儴楠板瓙锛?
                    // 娌℃湁鍗＄墝鐗瑰啓鍙壙杞芥椂锛屾墠璺宠繃鐙珛鍗曢鐗瑰啓
                    if (hasBonusDiceSettlement) {
                        spotlightLogger.info('bonus-skip', {
                            reason: 'reroll-settlement-present',
                            eventType: type,
                        });
                        continue;
                    }

                    const relatedBonusDiceEventCount = countRelatedBonusDiceEvents(newEntries, bonusPid, eventTimestamp);
                    const shouldAggregateStandaloneMultiDice =
                        !isSpectator
                        && bonusPid === selfId
                        && relatedBonusDiceEventCount > 1;

                    if (shouldAggregateStandaloneMultiDice) {
                        if (!pendingStandaloneMultiDice) {
                            pendingStandaloneMultiDice = {
                                bonusDice: [],
                                characterId: resolvedCharacterId,
                                showTotal: false,
                                displayOnly: true,
                            };
                        }

                        if (isSummaryEvent && bonusEffectKey && bonusEffectParams) {
                            pendingStandaloneMultiDice.summaryEffectKey = bonusEffectKey;
                            pendingStandaloneMultiDice.summaryEffectParams = bonusEffectParams;
                        } else {
                            pendingStandaloneMultiDice.bonusDice = upsertIndexedDie(pendingStandaloneMultiDice.bonusDice, {
                                index: bonusDieIndex ?? pendingStandaloneMultiDice.bonusDice.length,
                                value: bonusValue,
                                face: bonusFace ?? '',
                                effectKey: bonusEffectKey,
                            });
                        }

                        spotlightLogger.info('bonus-standalone-multi', {
                            eventType: type,
                            isSummaryEvent,
                            relatedBonusDiceEventCount,
                            diceCount: pendingStandaloneMultiDice.bonusDice.length,
                            effectKey: bonusEffectKey,
                            resolvedCharacterId,
                        });
                        continue;
                    }

                    // 鐙珛楠板瓙鐗瑰啓锛堜笉缁戝畾鍒板崱鐗岋級
                    pendingStandaloneBonusDie = {
                        value: bonusValue,
                        face: bonusFace,
                        effectKey: bonusEffectKey,
                        effectParams: bonusEffectParams,
                        characterId: resolvedCharacterId,
                    };
                    spotlightLogger.info('bonus-standalone', {
                        eventType: type,
                        value: bonusValue,
                        face: bonusFace,
                        effectKey: bonusEffectKey,
                        resolvedCharacterId,
                    });
                }
            }
        }

        if (didUpdateCardSpotlightQueue) {
            cardSpotlightQueueRef.current = nextCardSpotlightQueue;
            setCardSpotlightQueue(nextCardSpotlightQueue);
            spotlightLogger.info('card-queue-commit', {
                queueSize: nextCardSpotlightQueue.length,
                queueIds: nextCardSpotlightQueue.map(item => item.id),
                queueDiceCounts: nextCardSpotlightQueue.map(item => (item.bonusDice || []).length),
            });
        }

        if (pendingStandaloneMultiDice) {
            setBonusDieValue(undefined);
            setBonusDieFace(undefined);
            setBonusDieEffectKey(undefined);
            setBonusDieEffectParams(undefined);
            setBonusDiceList(pendingStandaloneMultiDice.bonusDice);
            setBonusDieSummaryEffectKey(pendingStandaloneMultiDice.summaryEffectKey);
            setBonusDieSummaryEffectParams(pendingStandaloneMultiDice.summaryEffectParams);
            setBonusDieShowTotal(pendingStandaloneMultiDice.showTotal);
            setBonusDieDisplayOnly(pendingStandaloneMultiDice.displayOnly);
            setBonusDieCharacterId(pendingStandaloneMultiDice.characterId);
            setShowBonusDie(true);
            spotlightLogger.info('bonus-multi-state-commit', {
                diceCount: pendingStandaloneMultiDice.bonusDice.length,
                summaryEffectKey: pendingStandaloneMultiDice.summaryEffectKey,
                characterId: pendingStandaloneMultiDice.characterId,
            });
            return;
        }

        if (pendingStandaloneBonusDie) {
            setBonusDiceList(undefined);
            setBonusDieSummaryEffectKey(undefined);
            setBonusDieSummaryEffectParams(undefined);
            setBonusDieShowTotal(undefined);
            setBonusDieDisplayOnly(undefined);
            setBonusDieValue(pendingStandaloneBonusDie.value);
            setBonusDieFace(pendingStandaloneBonusDie.face);
            setBonusDieEffectKey(pendingStandaloneBonusDie.effectKey);
            setBonusDieEffectParams(pendingStandaloneBonusDie.effectParams);
            setBonusDieCharacterId(pendingStandaloneBonusDie.characterId);
            setShowBonusDie(true);
            spotlightLogger.info('bonus-state-commit', {
                value: pendingStandaloneBonusDie.value,
                face: pendingStandaloneBonusDie.face,
                effectKey: pendingStandaloneBonusDie.effectKey,
                characterId: pendingStandaloneBonusDie.characterId,
            });
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
            console.log('[handleBonusDieClose] 被调用');
            spotlightLogger.info('bonus-close', {
                value: bonusDieValue,
                face: bonusDieFace,
                effectKey: bonusDieEffectKey,
                bonusDiceCount: bonusDiceList?.length ?? 0,
                summaryEffectKey: bonusDieSummaryEffectKey,
                characterId: bonusDieCharacterId,
            });
            console.log('[handleBonusDieClose] 设置 showBonusDie=false');
            setShowBonusDie(false);
            // 清除所有骰子状态，防止 useEffect 重新触发时又弹出
            console.log('[handleBonusDieClose] 清除所有骰子状态');
            setBonusDieValue(undefined);
            setBonusDieFace(undefined);
            setBonusDieEffectKey(undefined);
            setBonusDieEffectParams(undefined);
            setBonusDiceList(undefined);
            setBonusDieSummaryEffectKey(undefined);
            setBonusDieSummaryEffectParams(undefined);
            setBonusDieShowTotal(undefined);
            setBonusDieDisplayOnly(undefined);
            setBonusDieCharacterId(undefined);
            console.log('[handleBonusDieClose] 完成');
        }, [bonusDiceList?.length, bonusDieCharacterId, bonusDieEffectKey, bonusDieFace, bonusDieSummaryEffectKey, bonusDieValue])


    return {
        cardSpotlightQueue,
        handleCardSpotlightClose,
        bonusDie: {
            value: bonusDieValue,
            face: bonusDieFace,
            effectKey: bonusDieEffectKey,
            effectParams: bonusDieEffectParams,
            bonusDice: bonusDiceList,
            summaryEffectKey: bonusDieSummaryEffectKey,
            summaryEffectParams: bonusDieSummaryEffectParams,
            showTotal: bonusDieShowTotal,
            displayOnly: bonusDieDisplayOnly,
            show: showBonusDie,
            characterId: bonusDieCharacterId,
        },
        handleBonusDieClose,
    };
}

