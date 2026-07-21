/**
 * useCardSpotlight Hook
 * 
 * 绠＄悊鍗＄墝鐗瑰啓闃熷垪鍜岄澶栭瀛愮壒鍐欏睍绀恒€?
 * 閫氳繃 EventStream 娑堣垂 CARD_PLAYED / ABILITY_REPLACED / BONUS_DIE_ROLLED / BONUS_DIE_REROLLED 浜嬩欢锛?
 * 涓嶅啀浠?core 璇诲彇 lastPlayedCard / lastBonusDieRoll銆?
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerId, EventStreamEntry } from '../../../engine/types';
import type { CardPreviewRef } from '../../../core';
import type { DieFace, CharacterId, BonusDieInfo } from '../domain/types';
import type { CardSpotlightItem } from '../ui/CardSpotlightOverlay';
import { useEventStreamCursor } from '../../../engine/hooks';
import { createScopedLogger } from '../../../lib/logger';
import { getDiceThroneCardPreviewRef } from '../ui/cardPreviewHelper';

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
    /** 阻塞式奖励骰已由 modal stack 接管时，禁止再产出独立奖励骰特写 */
    suppressStandaloneBonusDie?: boolean;
    /** 奖励骰已由骰盘承接时，卡牌特写只展示卡牌本体，不再附带骰子 */
    suppressBonusDiceInCardSpotlight?: boolean;
    /** 缓存作用域，用于区分不同房间/对局，避免未关闭特写串到下一局 */
    cacheScope?: string;
}

const normalizePlayerId = (value: PlayerId | string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    const match = raw.match(/(\d+)$/);
    return match ? match[1] : raw;
};

const resolveSelectableCharacterId = (characterId?: CharacterId) => (
    characterId && characterId !== 'unselected' ? characterId : undefined
);

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
        presentationKey?: string | number;
        presentationKind?: 'roll' | 'choice';
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
interface CardEventPayload { playerId: PlayerId; cardId: string; previewRef?: CardPreviewRef }
interface BonusDiePayload { value: number; face: DieFace; playerId: PlayerId; targetPlayerId?: PlayerId; effectKey?: string; effectParams?: Record<string, string | number>; presentationKind?: 'roll' | 'choice' }
interface BonusDieRerolledPayload { dieIndex: number; newValue: number; newFace: DieFace; playerId: PlayerId; targetPlayerId?: PlayerId; effectKey?: string; effectParams?: Record<string, string | number>; presentationKind?: 'roll' | 'choice' }

/** 鍗＄墝鐗瑰啓鐩稿叧鐨勪簨浠剁被鍨?*/
const CARD_EVENT_TYPES = new Set(['CARD_PLAYED', 'ABILITY_REPLACED']);
const BONUS_DIE_EVENT_TYPES = new Set(['BONUS_DIE_ROLLED', 'BONUS_DIE_REROLLED']);
const CARD_BONUS_BIND_THRESHOLD_MS = 1500;
const spotlightLogger = createScopedLogger('DT_SPOTLIGHT');
type SpotlightBonusDie = NonNullable<CardSpotlightItem['bonusDice']>[number];
const cardSpotlightQueueCache = new Map<string, CardSpotlightItem[]>();
const MAX_CARD_SPOTLIGHT_CACHE_KEYS = 20;

function buildBonusDiePresentationKey(type: string, eventTimestamp: number): string {
    return `${type}:${eventTimestamp}`;
}

function buildCardSpotlightDedupKey(cardId: string, playerId: PlayerId, eventTimestamp: number): string {
    return `${normalizePlayerId(playerId)}|${cardId}|${eventTimestamp}`;
}

function buildCardSpotlightCacheKey(currentPlayerId: PlayerId, isSpectator: boolean, cacheScope?: string): string {
    return `scope:${cacheScope || 'local'}|viewer:${normalizePlayerId(currentPlayerId) || 'local'}|spectator:${isSpectator ? '1' : '0'}`;
}

function getCardIdFromSpotlightItem(item: CardSpotlightItem): string {
    if (item.cardId) {
        return item.cardId;
    }
    const suffix = `-${item.timestamp}`;
    return item.id.endsWith(suffix) ? item.id.slice(0, -suffix.length) : item.id;
}

function buildCardSpotlightDedupKeyFromItem(item: CardSpotlightItem): string {
    return buildCardSpotlightDedupKey(getCardIdFromSpotlightItem(item), item.playerId, item.timestamp);
}

function isSpotlightItemBackedByCurrentEntries(item: CardSpotlightItem, entries: EventStreamEntry[]): boolean {
    const cardId = getCardIdFromSpotlightItem(item);
    const itemPlayerId = normalizePlayerId(item.playerId);

    return entries.some((entry) => {
        if (!CARD_EVENT_TYPES.has(entry.event.type)) return false;
        const payload = entry.event.payload as Partial<CardEventPayload>;
        const eventTimestamp = typeof entry.event.timestamp === 'number' ? entry.event.timestamp : 0;
        return payload.cardId === cardId
            && normalizePlayerId(payload.playerId) === itemPlayerId
            && eventTimestamp === item.timestamp;
    });
}

function restoreCachedCardSpotlightQueue(cacheKey: string | null, entries: EventStreamEntry[]): CardSpotlightItem[] {
    if (!cacheKey) {
        return [];
    }
    const cached = cardSpotlightQueueCache.get(cacheKey) ?? [];
    if (cached.length === 0) {
        return [];
    }
    if (entries.length === 0) {
        return cached;
    }
    const backed = cached.filter((item) => isSpotlightItemBackedByCurrentEntries(item, entries));
    return backed.length > 0 ? backed : cached;
}

function rememberCachedCardSpotlightQueue(cacheKey: string | null, queue: CardSpotlightItem[]): void {
    if (!cacheKey) {
        return;
    }
    if (queue.length === 0) {
        return;
    }

    cardSpotlightQueueCache.set(cacheKey, queue);
    if (cardSpotlightQueueCache.size <= MAX_CARD_SPOTLIGHT_CACHE_KEYS) return;
    const oldestKey = cardSpotlightQueueCache.keys().next().value;
    if (oldestKey) {
        cardSpotlightQueueCache.delete(oldestKey);
    }
}

function forgetCachedCardSpotlightQueue(cacheKey: string | null): void {
    if (!cacheKey) {
        return;
    }
    cardSpotlightQueueCache.delete(cacheKey);
}

function findExistingCardSpotlightIndex(
    queue: CardSpotlightItem[],
    cardId: string,
    playerId: PlayerId,
    eventTimestamp: number,
): number {
    const normalizedPlayerId = normalizePlayerId(playerId);

    for (let index = queue.length - 1; index >= 0; index -= 1) {
        const item = queue[index];
        const timeDiff = Math.abs(item.timestamp - eventTimestamp);
        const playerMatch = normalizePlayerId(item.playerId) === normalizedPlayerId;
        const cardMatch = item.id.startsWith(`${cardId}-`);

        if (playerMatch && cardMatch && timeDiff <= CARD_BONUS_BIND_THRESHOLD_MS) {
            return index;
        }
    }

    return -1;
}

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

function resolveSuppressedCardBonusSummary(
    eventType: string,
    value: number,
    effectKey?: string,
    effectParams?: Record<string, string | number>,
): CardSpotlightItem['summaryText'] | undefined {
    if (eventType !== 'BONUS_DIE_ROLLED' || !effectKey) {
        return undefined;
    }

    if (effectKey === 'bonusDie.effect.gainCp') {
        const cp = typeof effectParams?.cp === 'number' ? effectParams.cp : Math.ceil(value / 2);
        return {
            effectKey: 'bonusDie.spotlight.initialGainCp',
            effectParams: {
                ...effectParams,
                value,
                cp,
            },
        };
    }

    return {
        effectKey,
        effectParams: {
            ...effectParams,
            value,
        },
    };
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
        suppressStandaloneBonusDie = false,
        suppressBonusDiceInCardSpotlight = false,
        cacheScope,
    } = config;

    const cardSpotlightCacheKey = cacheScope
        ? buildCardSpotlightCacheKey(currentPlayerId, isSpectator, cacheScope)
        : null;
    const restoredCardSpotlightQueue = restoreCachedCardSpotlightQueue(cardSpotlightCacheKey, eventStreamEntries);

    // 鍗＄墝鐗瑰啓闃熷垪
    const [cardSpotlightQueue, setCardSpotlightQueue] = useState<CardSpotlightItem[]>(restoredCardSpotlightQueue);
    const cardSpotlightQueueRef = useRef<CardSpotlightItem[]>(restoredCardSpotlightQueue);
    const processedCardSpotlightKeysRef = useRef<Set<string>>(
        new Set(restoredCardSpotlightQueue.map(buildCardSpotlightDedupKeyFromItem)),
    );

    // 棰濆楠板瓙鐘舵€?
    const [bonusDieValue, setBonusDieValue] = useState<number | undefined>(undefined);
    const [bonusDieFace, setBonusDieFace] = useState<DieFace | undefined>(undefined);
    const [bonusDieEffectKey, setBonusDieEffectKey] = useState<string | undefined>(undefined);
    const [bonusDieEffectParams, setBonusDieEffectParams] = useState<Record<string, string | number> | undefined>(undefined);
    const [bonusDiceList, setBonusDiceList] = useState<BonusDieInfo[] | undefined>(undefined);
    const [bonusDieSummaryEffectKey, setBonusDieSummaryEffectKey] = useState<string | undefined>(undefined);
    const [bonusDieSummaryEffectParams, setBonusDieSummaryEffectParams] = useState<Record<string, string | number> | undefined>(undefined);
    const [bonusDiePresentationKey, setBonusDiePresentationKey] = useState<string | number | undefined>(undefined);
    const [bonusDiePresentationKind, setBonusDiePresentationKind] = useState<'roll' | 'choice' | undefined>(undefined);
    const [bonusDieShowTotal, setBonusDieShowTotal] = useState<boolean | undefined>(undefined);
    const [bonusDieDisplayOnly, setBonusDieDisplayOnly] = useState<boolean | undefined>(undefined);
    const [bonusDieCharacterId, setBonusDieCharacterId] = useState<string | undefined>(undefined);
    const [showBonusDie, setShowBonusDie] = useState(false);

    const clearBonusDieState = useCallback(() => {
        setShowBonusDie(false);
        setBonusDieValue(undefined);
        setBonusDieFace(undefined);
        setBonusDieEffectKey(undefined);
        setBonusDieEffectParams(undefined);
        setBonusDiceList(undefined);
        setBonusDieSummaryEffectKey(undefined);
        setBonusDieSummaryEffectParams(undefined);
        setBonusDiePresentationKey(undefined);
        setBonusDiePresentationKind(undefined);
        setBonusDieShowTotal(undefined);
        setBonusDieDisplayOnly(undefined);
        setBonusDieCharacterId(undefined);
    }, []);

    // 閫氱敤娓告爣锛堣嚜鍔ㄥ鐞嗛娆℃寕杞借烦杩?+ Undo 閲嶇疆锛?
    const { consumeNew } = useEventStreamCursor({
        entries: eventStreamEntries,
        consumeOnReconcile: true,
    });

    // 鍚屾闃熷垪鍒?ref
    useEffect(() => {
        cardSpotlightQueueRef.current = cardSpotlightQueue;
        rememberCachedCardSpotlightQueue(cardSpotlightCacheKey, cardSpotlightQueue);
    }, [cardSpotlightCacheKey, cardSpotlightQueue]);

    /**
     * 鏍稿績锛氭秷璐?EventStream 涓殑鏂颁簨浠?
     */
    useEffect(() => {
        const { entries: newEntries, didReset, didOptimisticRollback } = consumeNew();
        // Card spotlights are player-readable exhibits. Online reconcile/resync can
        // temporarily move the EventStream watermark backwards without meaning the
        // already-visible opponent card was undone, so keep the queue until the player
        // explicitly closes it. Reset only the short-lived bonus-die animation state.
        if (didReset || didOptimisticRollback) {
            clearBonusDieState();
        }
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
            presentationKey?: string;
            presentationKind?: 'roll' | 'choice';
        } | null = null;
        let pendingStandaloneMultiDice: {
            bonusDice: BonusDieInfo[];
            summaryEffectKey?: string;
            summaryEffectParams?: Record<string, string | number>;
            characterId?: string;
            presentationKey?: string;
            presentationKind?: 'roll' | 'choice';
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
                const selfCardHasRelatedBonusDice = !isSpectator
                    && cardPlayerId === selfId
                    && countRelatedBonusDiceEvents(newEntries, cardPlayerId, eventTimestamp) > 0;
                const skipSelfCardSpotlight = !isSpectator
                    && cardPlayerId === selfId
                    && !selfCardHasRelatedBonusDice;

                spotlightLogger.info('card-event', {
                    eventType: type,
                    cardId: p.cardId,
                    cardPlayerId,
                    selfId,
                    selfCardHasRelatedBonusDice,
                    skipSelfCardSpotlight,
                });

                // 自己打出的普通卡牌默认不显示特写；但会触发奖励骰的自方卡牌仍需要保留卡牌特写承接结果说明。
                if (skipSelfCardSpotlight) continue;

                const existingIndex = findExistingCardSpotlightIndex(
                    nextCardSpotlightQueue,
                    p.cardId,
                    p.playerId,
                    eventTimestamp,
                );
                const dedupKey = buildCardSpotlightDedupKey(p.cardId, p.playerId, eventTimestamp);
                if (processedCardSpotlightKeysRef.current.has(dedupKey)) {
                    spotlightLogger.info('card-event-signature-deduped', {
                        eventType: type,
                        cardId: p.cardId,
                        playerId: p.playerId,
                        dedupKey,
                    });
                    continue;
                }
                if (existingIndex >= 0) {
                    processedCardSpotlightKeysRef.current.add(dedupKey);
                    spotlightLogger.info('card-event-deduped', {
                        eventType: type,
                        cardId: p.cardId,
                        playerId: p.playerId,
                        existingIndex,
                    });
                    continue;
                }

                const previewRef = p.previewRef ?? getDiceThroneCardPreviewRef(
                    p.cardId,
                    resolveSelectableCharacterId(selectedCharacters?.[p.playerId]),
                );

                const newItem: CardSpotlightItem = {
                    id: `${p.cardId}-${eventTimestamp}`,
                    cardId: p.cardId,
                    timestamp: eventTimestamp,
                    previewRef: previewRef ?? undefined,
                    playerId: p.playerId,
                    playerName: opponentName,
                };
                processedCardSpotlightKeysRef.current.add(dedupKey);
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
                let bonusPresentationKind: 'roll' | 'choice' | undefined;
                let bonusDieIndex: number | undefined;

                if (type === 'BONUS_DIE_ROLLED') {
                    const p = payload as BonusDiePayload;
                    bonusValue = p.value;
                    bonusFace = p.face;
                    bonusPlayerId = p.playerId;
                    bonusTargetId = p.targetPlayerId;
                    bonusEffectKey = p.effectKey;
                    bonusEffectParams = p.effectParams;
                    bonusPresentationKind = p.presentationKind;
                    bonusDieIndex = resolveBonusDieIndex(p);
                } else {
                    const p = payload as BonusDieRerolledPayload;
                    bonusValue = p.newValue;
                    bonusFace = p.newFace;
                    bonusPlayerId = p.playerId;
                    bonusTargetId = p.targetPlayerId;
                    bonusEffectKey = p.effectKey;
                    bonusEffectParams = p.effectParams;
                    bonusPresentationKind = p.presentationKind;
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
                    standalonePublicReveal: !canBindToCardSpotlight,
                });

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
                    if (suppressBonusDiceInCardSpotlight && hasBonusDiceSettlement) {
                        const summaryText = resolveSuppressedCardBonusSummary(
                            type,
                            bonusValue,
                            bonusEffectKey,
                            bonusEffectParams,
                        );
                        spotlightLogger.info('bonus-bound-to-card-suppressed', {
                            cardId: cardCandidate.id,
                            eventType: type,
                            reason: 'bonus-dice-routed-to-tray',
                            summaryEffectKey: summaryText?.effectKey,
                        });
                        if (summaryText) {
                            nextCardSpotlightQueue[cardCandidateIndex] = {
                                ...cardCandidate,
                                summaryText,
                            };
                            didUpdateCardSpotlightQueue = true;
                        }
                        continue;
                    }
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
                            presentationKey: buildBonusDiePresentationKey(type, eventTimestamp),
                            presentationKind: bonusPresentationKind,
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
                    const shouldAggregateStandaloneMultiDice = relatedBonusDiceEventCount > 1;

                    if (shouldAggregateStandaloneMultiDice) {
                        if (!pendingStandaloneMultiDice) {
                            pendingStandaloneMultiDice = {
                                bonusDice: [],
                                characterId: resolvedCharacterId,
                                presentationKey: buildBonusDiePresentationKey(type, eventTimestamp),
                                showTotal: false,
                                displayOnly: true,
                                presentationKind: bonusPresentationKind,
                            };
                        } else {
                            pendingStandaloneMultiDice.presentationKey = buildBonusDiePresentationKey(type, eventTimestamp);
                            pendingStandaloneMultiDice.presentationKind = bonusPresentationKind ?? pendingStandaloneMultiDice.presentationKind;
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
                                presentationKind: bonusPresentationKind,
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
                        presentationKey: buildBonusDiePresentationKey(type, eventTimestamp),
                        presentationKind: bonusPresentationKind,
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
            rememberCachedCardSpotlightQueue(cardSpotlightCacheKey, nextCardSpotlightQueue);
            setCardSpotlightQueue(nextCardSpotlightQueue);
            spotlightLogger.info('card-queue-commit', {
                queueSize: nextCardSpotlightQueue.length,
                queueIds: nextCardSpotlightQueue.map(item => item.id),
                queueDiceCounts: nextCardSpotlightQueue.map(item => (item.bonusDice || []).length),
            });
        }

        if (pendingStandaloneMultiDice) {
            if (suppressStandaloneBonusDie) {
                spotlightLogger.info('bonus-multi-state-suppressed', {
                    diceCount: pendingStandaloneMultiDice.bonusDice.length,
                    characterId: pendingStandaloneMultiDice.characterId,
                });
                clearBonusDieState();
                return;
            }
            setBonusDieValue(undefined);
            setBonusDieFace(undefined);
            setBonusDieEffectKey(undefined);
            setBonusDieEffectParams(undefined);
            setBonusDiceList(pendingStandaloneMultiDice.bonusDice);
            setBonusDieSummaryEffectKey(pendingStandaloneMultiDice.summaryEffectKey);
            setBonusDieSummaryEffectParams(pendingStandaloneMultiDice.summaryEffectParams);
            setBonusDiePresentationKey(pendingStandaloneMultiDice.presentationKey);
            setBonusDiePresentationKind(pendingStandaloneMultiDice.presentationKind);
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
            if (suppressStandaloneBonusDie) {
                spotlightLogger.info('bonus-state-suppressed', {
                    value: pendingStandaloneBonusDie.value,
                    face: pendingStandaloneBonusDie.face,
                    effectKey: pendingStandaloneBonusDie.effectKey,
                    characterId: pendingStandaloneBonusDie.characterId,
                });
                clearBonusDieState();
                return;
            }
            setBonusDiceList(undefined);
            setBonusDieSummaryEffectKey(undefined);
            setBonusDieSummaryEffectParams(undefined);
            setBonusDieShowTotal(undefined);
            setBonusDieDisplayOnly(undefined);
            setBonusDieValue(pendingStandaloneBonusDie.value);
            setBonusDieFace(pendingStandaloneBonusDie.face);
            setBonusDieEffectKey(pendingStandaloneBonusDie.effectKey);
            setBonusDieEffectParams(pendingStandaloneBonusDie.effectParams);
            setBonusDiePresentationKey(pendingStandaloneBonusDie.presentationKey);
            setBonusDiePresentationKind(pendingStandaloneBonusDie.presentationKind);
            setBonusDieCharacterId(pendingStandaloneBonusDie.characterId);
            setShowBonusDie(true);
            spotlightLogger.info('bonus-state-commit', {
                value: pendingStandaloneBonusDie.value,
                face: pendingStandaloneBonusDie.face,
                effectKey: pendingStandaloneBonusDie.effectKey,
                characterId: pendingStandaloneBonusDie.characterId,
            });
        }
    }, [cardSpotlightCacheKey, clearBonusDieState, consumeNew, currentPlayerId, eventStreamEntries, isSpectator, opponentName, selectedCharacters, suppressBonusDiceInCardSpotlight, suppressStandaloneBonusDie]);

    useEffect(() => {
        if (!suppressStandaloneBonusDie || !showBonusDie) {
            return;
        }

        spotlightLogger.info('bonus-state-cleared-for-blocking-settlement', {
            currentPlayerId: String(currentPlayerId),
        });
        clearBonusDieState();
    }, [clearBonusDieState, currentPlayerId, showBonusDie, suppressStandaloneBonusDie]);

    /**
     * 鍏抽棴鍗＄墝鐗瑰啓
     */
    const handleCardSpotlightClose = useCallback((id: string) => {
        setCardSpotlightQueue(prev => {
            const next = prev.filter(item => item.id !== id);
            if (next.length === 0) {
                forgetCachedCardSpotlightQueue(cardSpotlightCacheKey);
            } else {
                rememberCachedCardSpotlightQueue(cardSpotlightCacheKey, next);
            }
            return next;
        });
    }, [cardSpotlightCacheKey]);

    /**
     * 鍏抽棴棰濆楠板瓙鐗瑰啓
     */
    const handleBonusDieClose = useCallback(() => {
            spotlightLogger.info('bonus-close', {
                value: bonusDieValue,
                face: bonusDieFace,
                effectKey: bonusDieEffectKey,
                bonusDiceCount: bonusDiceList?.length ?? 0,
                summaryEffectKey: bonusDieSummaryEffectKey,
                characterId: bonusDieCharacterId,
            });
            clearBonusDieState();
        }, [bonusDiceList?.length, bonusDieCharacterId, bonusDieEffectKey, bonusDieFace, bonusDieSummaryEffectKey, bonusDieValue, clearBonusDieState])


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
            presentationKey: bonusDiePresentationKey,
            presentationKind: bonusDiePresentationKind,
            showTotal: bonusDieShowTotal,
            displayOnly: bonusDieDisplayOnly,
            show: showBonusDie,
            characterId: bonusDieCharacterId,
        },
        handleBonusDieClose,
    };
}

