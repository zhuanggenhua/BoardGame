/**
 * 大杀四方 - 非阻塞卡牌展示浮层
 *
 * 通过 EventStream 消费 REVEAL_HAND / REVEAL_DECK_TOP 事件，
 * 以特写队列形式展示卡牌，通过最小必要控件关闭，不阻塞游戏操作。
 *
 * 与旧的阻塞式 pendingReveal 不同：
 * - 纯客户端行为，不需要服务端确认
 * - 不阻塞其他玩家操作
 * - 不抢整屏点击；只保留最小关闭控件
 * - 自动 15 秒后消失
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { UI_Z_INDEX } from '../../../core';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { useEventStreamRollback } from '../../../engine/hooks/EventStreamRollbackContext';
import { getCardDef, getBaseDef, resolveCardName } from '../data/cards';
import { CardMagnifyOverlay, type CardMagnifyTarget } from './CardMagnifyOverlay';
import type { EventStreamEntry, PlayerId } from '../../../engine/types';
import { SU_EVENTS } from '../domain/types';
import { GameButton } from './GameButton';

// ============================================================================
// 类型
// ============================================================================

interface RevealItem {
    id: string;
    type: 'hand' | 'deck_top';
    targetPlayerIds: string[];
    viewerPlayerId: string | 'all';
    cards: { uid: string; defId: string }[];
    reason: string;
    timestamp: number;
}

export interface RevealSuppressionRule {
    sourceId: string;
    reason: string;
    cardUids: string[];
}

interface RevealOverlayProps {
    entries: EventStreamEntry[];
    currentPlayerId: PlayerId | null;
    playerNames?: Record<string, string>;
    suppressionRules?: RevealSuppressionRule[];
}

const AUTO_DISMISS_MS = 15_000;

const REORDER_PROMPT_REASON_BY_SOURCE_ID: Record<string, string> = {
    super_spies_spy_reorder: 'super_spies_spy',
    super_spies_for_my_eyes_only_reorder: 'super_spies_for_my_eyes_only',
    base_isis_swingin_pad_reorder: 'base_isis_swingin_pad',
};

function extractCardUids(items: unknown): string[] {
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const uid = typeof (item as { uid?: unknown }).uid === 'string'
            ? (item as { uid: string }).uid
            : undefined;
        return uid ? [uid] : [];
    });
}

function extractOperativeRevealCardUids(prompt: Record<string, unknown>): string[] {
    const revealedByPlayer = prompt.revealedByPlayer;
    if (revealedByPlayer && typeof revealedByPlayer === 'object' && !Array.isArray(revealedByPlayer)) {
        const cardUids = Object.values(revealedByPlayer).flatMap((value) =>
            Array.isArray(value) ? value.filter((uid): uid is string => typeof uid === 'string') : [],
        );
        if (cardUids.length > 0) {
            return [...new Set(cardUids)];
        }
    }

    const options = Array.isArray(prompt.options) ? prompt.options : [];
    const optionCardUids = options.flatMap((option) => {
        if (!option || typeof option !== 'object') return [];
        const value = (option as { value?: unknown }).value;
        if (!value || typeof value !== 'object') return [];
        const cardUid = typeof (value as { cardUid?: unknown }).cardUid === 'string'
            ? (value as { cardUid: string }).cardUid
            : undefined;
        return cardUid ? [cardUid] : [];
    });
    return [...new Set(optionCardUids)];
}

export function resolveRevealSuppressionRules(activePrompt: unknown, isPromptOwnedByCurrentPlayer: boolean): RevealSuppressionRule[] {
    if (!isPromptOwnedByCurrentPlayer || !activePrompt || typeof activePrompt !== 'object') {
        return [];
    }

    const prompt = activePrompt as Record<string, unknown>;
    const sourceId = typeof prompt.sourceId === 'string' ? prompt.sourceId : undefined;
    if (!sourceId) return [];

    if (sourceId === 'super_spies_operative_top_bottom') {
        const cardUids = extractOperativeRevealCardUids(prompt);
        return cardUids.length > 0
            ? [{ sourceId, reason: 'super_spies_operative', cardUids }]
            : [];
    }

    const reason = REORDER_PROMPT_REASON_BY_SOURCE_ID[sourceId];
    if (!reason) return [];

    const cardUids = extractCardUids((prompt as { inspectedCards?: unknown }).inspectedCards);
    return cardUids.length > 0
        ? [{ sourceId, reason, cardUids }]
        : [];
}

export function shouldSuppressRevealItem(item: RevealItem, suppressionRules: RevealSuppressionRule[]): boolean {
    if (suppressionRules.length === 0 || item.cards.length === 0) return false;
    return suppressionRules.some((rule) => {
        if (rule.reason !== item.reason || rule.cardUids.length === 0) {
            return false;
        }
        const cardUidSet = new Set(rule.cardUids);
        return item.cards.every((card) => cardUidSet.has(card.uid));
    });
}

// ============================================================================
// 组件
// ============================================================================

export function RevealOverlay({ entries, currentPlayerId, playerNames, suppressionRules = [] }: RevealOverlayProps) {
    const { t } = useTranslation('game-smashup');
    const [queue, setQueue] = useState<RevealItem[]>([]);
    const [magnifyTarget, setMagnifyTarget] = useState<CardMagnifyTarget | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSeenIdRef = useRef<number>(-1);
    const rollback = useEventStreamRollback();
    const lastRollbackSeqRef = useRef<number>(rollback.seq);

    const TRIGGER_EVENTS = useMemo(() => new Set([
        SU_EVENTS.REVEAL_HAND,
        SU_EVENTS.REVEAL_DECK_TOP,
    ]), []);

    useEffect(() => {
        if (rollback.seq === lastRollbackSeqRef.current) {
            return;
        }

        lastRollbackSeqRef.current = rollback.seq;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setQueue([]);
        setMagnifyTarget(null);
        lastSeenIdRef.current = rollback.watermark ?? -1;
    }, [rollback.seq, rollback.watermark]);

    // 消费新事件
    // 注意：展示 UI 需要显示历史的展示事件，所以不跳过历史事件
    // 不使用 useEventStreamCursor（它会跳过历史事件），直接管理游标
    useEffect(() => {
        // 检测 Undo 回退：最大 ID 回退时重置队列和游标
        if (entries.length > 0) {
            const maxId = entries[entries.length - 1].id;
            if (maxId < lastSeenIdRef.current) {
                setQueue([]);
                lastSeenIdRef.current = maxId;
                return;
            }
        }

        // 过滤新事件（id > lastSeenId）
        const newEntries = entries.filter(e => e.id > lastSeenIdRef.current);

        if (newEntries.length === 0) return;

        // 更新游标
        lastSeenIdRef.current = newEntries[newEntries.length - 1].id;

        const newItems: RevealItem[] = [];
        for (const entry of newEntries) {
            if (!TRIGGER_EVENTS.has(entry.event.type)) {
                continue;
            }
            const p = entry.event.payload as {
                targetPlayerId: string | string[];
                viewerPlayerId: string | 'all';
                cards: { uid: string; defId: string }[];
                reason: string;
            };

            if (!p?.cards?.length) {
                continue;
            }

            const isAllMode = p.viewerPlayerId === 'all';
            const targetIds = Array.isArray(p.targetPlayerId) ? p.targetPlayerId : [p.targetPlayerId];
            
            // 权限过滤：
            // - all 模式：所有人都能看
            // - 私有模式：只有明确属于该玩家的页面能看
            if (!isAllMode && (currentPlayerId == null || p.viewerPlayerId !== currentPlayerId)) {
                continue;
            }

            const revealType = entry.event.type === SU_EVENTS.REVEAL_HAND ? 'hand' : 'deck_top';
            const item = {
                id: `reveal-${entry.id}`,
                type: revealType,
                targetPlayerIds: targetIds,
                viewerPlayerId: p.viewerPlayerId,
                cards: p.cards, // all 模式下所有人都能看，单人模式下被展示者已被过滤
                reason: p.reason,
                timestamp: Date.now(),
            };
            newItems.push(item);
        }

        if (newItems.length > 0) {
            setQueue(prev => [...prev, ...newItems].slice(-5));
        }
    }, [entries, currentPlayerId, TRIGGER_EVENTS]);

    const visibleQueue = useMemo(
        () => queue.filter((item) => !shouldSuppressRevealItem(item, suppressionRules)),
        [queue, suppressionRules],
    );
    const current = visibleQueue[0];

    // 自动消失定时器
    useEffect(() => {
        if (!current) return;
        const currentId = current.id;
        timerRef.current = setTimeout(() => {
            setQueue(prev => prev.filter(item => item.id !== currentId));
        }, AUTO_DISMISS_MS);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDismiss = useCallback(() => {
        if (magnifyTarget) {
            setMagnifyTarget(null);
            return;
        }
        if (!current) return;
        setQueue(prev => prev.filter(item => item.id !== current.id));
    }, [current, magnifyTarget]);

    if (!current) return null;

    const targetLabel = current.targetPlayerIds
        .map(id => playerNames?.[id] ?? `P${Number(id) + 1}`)
        .join(', ');
    const title = current.type === 'hand'
        ? t('ui.reveal_hand_title', { player: targetLabel, defaultValue: '{{player}} 的手牌' })
        : t('ui.reveal_deck_top_title', { player: targetLabel, defaultValue: '{{player}} 的牌库顶' });

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={current.id}
                className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                data-interaction-allow
                data-testid="reveal-overlay"
            >
                {/* 半透明背景（不完全遮挡） */}
                <div className="absolute inset-0 bg-black/30 pointer-events-none" />

                {/* 标题 */}
                <motion.h2
                    className="relative mb-6 text-2xl font-black text-amber-100 uppercase tracking-tight drop-shadow-lg"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    {title}
                </motion.h2>

                {/* 卡牌展示区 */}
                {current.cards.length > 0 && (
                    <motion.div
                        className="relative flex max-w-[90vw] gap-4 overflow-x-auto px-8 py-4 pointer-events-auto"
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
                    >
                        {current.cards.map((card, idx) => {
                            const def = getCardDef(card.defId);
                            const baseDef = getBaseDef(card.defId);
                            const isBase = !!baseDef;
                            const name = def ? resolveCardName(def, t) : (baseDef ? resolveCardName(baseDef, t) : card.defId);
                            // 统一使用配置：基地 14vw，行动卡/随从 8.5vw
                            const cardWidth = isBase ? 'w-[14vw]' : 'w-[8.5vw]';
                            const cardAspect = isBase ? 'aspect-[1.43]' : 'aspect-[0.714]';
                            const maxWidth = isBase ? 'max-w-[14vw]' : 'max-w-[8.5vw]';
                            return (
                                <motion.div
                                    key={card.uid}
                                    data-testid="reveal-card"
                                    initial={{ y: 40, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: idx * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                                    className="flex-shrink-0 flex flex-col items-center gap-1.5 group relative cursor-pointer"
                                    onClick={() => {
                                        setMagnifyTarget({ defId: card.defId, type: isBase ? 'base' : (def?.type ?? 'action') });
                                    }}
                                >
                                    <div className="rounded shadow-xl overflow-hidden ring-2 ring-white/20 hover:ring-amber-400/60 transition-all">
                                        {(def?.previewRef || baseDef?.previewRef) ? (
                                            <CardPreview
                                                previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId, cardUid: card.uid } }}
                                                className={`${cardWidth} ${cardAspect} bg-slate-900 rounded`}
                                                alt={name}
                                            />
                                        ) : (
                                            <div className={`${cardWidth} ${cardAspect} bg-slate-800 rounded flex items-center justify-center p-2`}>
                                                <span className="text-white text-xs font-bold text-center">{name}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-xs font-bold text-white/80 ${maxWidth} truncate text-center`}>
                                        {name}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                <motion.div
                    className="relative mt-5 flex flex-col items-center gap-3 pointer-events-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <GameButton
                        variant="secondary"
                        size="sm"
                        onClick={handleDismiss}
                        data-testid="reveal-dismiss-btn"
                    >
                        {t('ui.close', { defaultValue: '关闭' })}
                    </GameButton>

                    <div className="text-sm text-white/50 pointer-events-none">
                        {visibleQueue.length > 1
                            ? t('ui.reveal_queue_hint', {
                                count: visibleQueue.length,
                                defaultValue: '{{count}} 条展示待查看 · 关闭后继续',
                            })
                            : t('ui.reveal_dismiss_hint', { defaultValue: '关闭后可继续操作' })}
                    </div>

                    {/* 队列指示器 */}
                    {visibleQueue.length > 1 && (
                        <div className="flex gap-1.5 pointer-events-none">
                            {visibleQueue.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className={`w-2 h-2 rounded-full transition-all ${idx === 0 ? 'bg-white scale-125' : 'bg-white/40'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* 卡牌放大镜 */}
                <CardMagnifyOverlay target={magnifyTarget} onClose={() => setMagnifyTarget(null)} />
            </motion.div>
        </AnimatePresence>
    );
}
