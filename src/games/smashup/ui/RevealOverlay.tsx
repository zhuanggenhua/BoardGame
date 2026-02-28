/**
 * 大杀四方 - 非阻塞卡牌展示浮层
 *
 * 通过 EventStream 消费 REVEAL_HAND / REVEAL_DECK_TOP 事件，
 * 以特写队列形式展示卡牌，点击关闭，不阻塞游戏操作。
 *
 * 与旧的阻塞式 pendingReveal 不同：
 * - 纯客户端行为，不需要服务端确认
 * - 不阻塞其他玩家操作
 * - 点击任意位置关闭
 * - 自动 15 秒后消失
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { UI_Z_INDEX } from '../../../core';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardDef, resolveCardName } from '../data/cards';
import { CardMagnifyOverlay, type CardMagnifyTarget } from './CardMagnifyOverlay';
import { useEventStreamCursor } from '../../../engine/hooks';
import type { EventStreamEntry, PlayerId } from '../../../engine/types';
import { SU_EVENTS } from '../domain/types';

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

interface RevealOverlayProps {
    entries: EventStreamEntry[];
    currentPlayerId: PlayerId;
}

const AUTO_DISMISS_MS = 15_000;

// ============================================================================
// 组件
// ============================================================================

export function RevealOverlay({ entries, currentPlayerId }: RevealOverlayProps) {
    const { t } = useTranslation('game-smashup');
    const [queue, setQueue] = useState<RevealItem[]>([]);
    const [magnifyTarget, setMagnifyTarget] = useState<CardMagnifyTarget | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const TRIGGER_EVENTS = useMemo(() => new Set([
        SU_EVENTS.REVEAL_HAND,
        SU_EVENTS.REVEAL_DECK_TOP,
    ]), []);

    const { consumeNew } = useEventStreamCursor({ entries });

    // 消费新事件
    useEffect(() => {
        const { entries: newEntries, didReset } = consumeNew();
        if (didReset) {
            setQueue([]);
            if (newEntries.length === 0) return;
        }
        if (newEntries.length === 0) return;

        const newItems: RevealItem[] = [];
        for (const entry of newEntries) {
            if (!TRIGGER_EVENTS.has(entry.event.type)) continue;
            const p = entry.event.payload as {
                targetPlayerId: string | string[];
                viewerPlayerId: string | 'all';
                cards: { uid: string; defId: string }[];
                reason: string;
            };
            if (!p?.cards?.length) continue;

            // 权限过滤：单人模式下只有指定查看者能看
            const isAllMode = p.viewerPlayerId === 'all';
            const targetIds = Array.isArray(p.targetPlayerId) ? p.targetPlayerId : [p.targetPlayerId];
            const isTarget = targetIds.includes(currentPlayerId);
            if (!isAllMode && p.viewerPlayerId !== currentPlayerId) continue;
            // 被展示者看不到卡牌内容（但能看到"你的手牌正在被展示"提示）
            // 这里只入队给查看者
            if (isTarget && !isAllMode) continue;

            const revealType = entry.event.type === SU_EVENTS.REVEAL_HAND ? 'hand' : 'deck_top';
            newItems.push({
                id: `reveal-${entry.id}`,
                type: revealType,
                targetPlayerIds: targetIds,
                viewerPlayerId: p.viewerPlayerId,
                cards: isTarget ? [] : p.cards, // 被展示者看不到卡牌内容
                reason: p.reason,
                timestamp: Date.now(),
            });
        }

        if (newItems.length > 0) {
            setQueue(prev => [...prev, ...newItems].slice(-5));
        }
    }, [entries, consumeNew, currentPlayerId, TRIGGER_EVENTS]);

    // 自动消失定时器
    const current = queue[0];
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
        setQueue(prev => prev.slice(1));
    }, [magnifyTarget]);

    if (!current) return null;

    const targetLabel = current.targetPlayerIds.map(id => `P${id}`).join(', ');
    const title = current.type === 'hand'
        ? t('ui.reveal_hand_title', { player: targetLabel, defaultValue: 'P{{player}} 的手牌' })
        : t('ui.reveal_deck_top_title', { player: targetLabel, defaultValue: 'P{{player}} 的牌库顶' });

    const isTarget = current.targetPlayerIds.includes(currentPlayerId);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={current.id}
                className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer"
                style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={handleDismiss}
                data-interaction-allow
            >
                {/* 半透明背景（不完全遮挡） */}
                <div className="absolute inset-0 bg-black/30" />

                {/* 标题 */}
                <motion.h2
                    className="relative text-xl font-black text-amber-100 uppercase tracking-tight mb-5 drop-shadow-lg"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    {title}
                </motion.h2>

                {/* 被展示者提示 */}
                {isTarget && (
                    <div className="relative mb-4 text-sm text-yellow-400/80 font-bold animate-pulse">
                        {t('ui.reveal_your_hand_shown', { defaultValue: '你的手牌正在被展示' })}
                    </div>
                )}

                {/* 卡牌展示区 */}
                {current.cards.length > 0 && (
                    <motion.div
                        className="relative flex gap-4 overflow-x-auto max-w-[90vw] px-8 py-4"
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
                        onClick={e => e.stopPropagation()}
                    >
                        {current.cards.map((card, idx) => {
                            const def = getCardDef(card.defId);
                            const name = def ? resolveCardName(def, t) : card.defId;
                            return (
                                <motion.div
                                    key={card.uid}
                                    initial={{ y: 40, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: idx * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                                    className="flex-shrink-0 flex flex-col items-center gap-1.5 group relative cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMagnifyTarget({ defId: card.defId, type: def?.type ?? 'action' });
                                    }}
                                >
                                    <div className="rounded shadow-xl overflow-hidden ring-1 ring-white/20 hover:ring-amber-400/60 transition-all">
                                        {def?.previewRef ? (
                                            <CardPreview
                                                previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId } }}
                                                className="w-[130px] aspect-[0.714] bg-slate-900 rounded"
                                                alt={name}
                                            />
                                        ) : (
                                            <div className="w-[130px] aspect-[0.714] bg-slate-800 rounded flex items-center justify-center p-2">
                                                <span className="text-white text-xs font-bold text-center">{name}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[11px] font-bold text-white/70 max-w-[130px] truncate text-center">
                                        {name}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* 点击提示 + 队列指示 */}
                <motion.div
                    className="relative mt-5 text-white/50 text-sm pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    {queue.length > 1
                        ? t('ui.reveal_queue_hint', {
                            count: queue.length,
                            defaultValue: '{{count}} 条展示待查看 · 点击继续',
                        })
                        : t('ui.reveal_dismiss_hint', { defaultValue: '点击任意位置关闭' })}
                </motion.div>

                {/* 队列指示器 */}
                {queue.length > 1 && (
                    <div className="relative mt-3 flex gap-1.5">
                        {queue.map((item, idx) => (
                            <div
                                key={item.id}
                                className={`w-2 h-2 rounded-full transition-all ${idx === 0 ? 'bg-white scale-125' : 'bg-white/40'
                                    }`}
                            />
                        ))}
                    </div>
                )}

                {/* 卡牌放大镜 */}
                <CardMagnifyOverlay target={magnifyTarget} onClose={() => setMagnifyTarget(null)} />
            </motion.div>
        </AnimatePresence>
    );
}
