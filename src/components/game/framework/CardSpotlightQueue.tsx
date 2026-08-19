/**
 * 通用卡牌特写队列组件
 *
 * 展示玩家打出的卡牌特写，支持队列堆叠。
 * 玩家点击空白背景或关闭按钮后，才关闭当前特写。
 *
 * 面向百游戏设计：
 * - 游戏层通过 renderCard 注入卡牌渲染
 * - 框架层管理队列展示、动画、关闭交互
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { UI_Z_INDEX } from '../../../core';
import type { SpotlightItem } from './hooks/useCardSpotlightQueue';

// ============================================================================
// 类型
// ============================================================================

export interface CardSpotlightQueueProps<TData = unknown> {
    /** 特写队列 */
    queue: SpotlightItem<TData>[];
    /** 关闭指定项 */
    onDismiss: (id: string) => void;
    /** 游戏层卡牌渲染函数 */
    renderCard: (item: SpotlightItem<TData>) => React.ReactNode;
    /** 队列指示器位置（默认 bottom） */
    indicatorPosition?: 'top' | 'bottom';
    /** 点击提示文案（单张时） */
    dismissLabel?: string;
    /** 点击提示文案（多张时，{count} 会被替换） */
    queueLabel?: string;
}

// ============================================================================
// 组件
// ============================================================================

function CardSpotlightQueueInner<TData = unknown>({
    queue,
    onDismiss,
    renderCard,
    indicatorPosition = 'bottom',
    dismissLabel,
    queueLabel,
}: CardSpotlightQueueProps<TData>) {
    const { t } = useTranslation('common');
    const current = queue[0];
    const resolvedDismissLabel = dismissLabel ?? t('cardSpotlightQueue.dismiss');
    const resolvedQueueLabel = queueLabel ?? t('cardSpotlightQueue.queue', { count: queue.length });

    const handleDismiss = useCallback(() => {
        if (current) {
            onDismiss(current.id);
        }
    }, [current, onDismiss]);

    if (!current) return null;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={current.id}
                className="fixed inset-0 pointer-events-auto"
                style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                data-testid="card-spotlight-queue"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                data-interaction-allow
                onClick={handleDismiss}
            >
                <motion.div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    data-testid="card-spotlight-positioner"
                    initial={{ scale: 0.5, opacity: 0, y: -32 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.85, opacity: 0, y: -24 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                    {/* 卡牌内容 */}
                    <div
                        className="relative pointer-events-auto"
                        data-testid="card-spotlight-content"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            aria-label={t('cardSpotlightQueue.closeSpotlight')}
                            title={t('cardSpotlightQueue.closeSpotlight')}
                            className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/65 bg-slate-950/90 text-lg font-bold leading-none text-white shadow-lg transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white pointer-events-auto"
                            onClick={handleDismiss}
                        >
                            ×
                        </button>
                        {renderCard(current)}

                        <div
                            className="absolute left-full top-0 ml-2 flex max-w-[min(42vw,12rem)] flex-col items-start gap-2 pointer-events-none"
                            data-testid="card-spotlight-status"
                        >
                            {/* 队列指示器（多张时显示） */}
                            {queue.length > 1 && (
                                <div
                                    className={`flex gap-1.5 rounded-full bg-black/45 px-2 py-1 ${
                                        indicatorPosition === 'top' ? 'order-1' : 'order-2'
                                    }`}
                                >
                                    {queue.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            className={`w-2 h-2 rounded-full transition-all ${
                                                idx === 0
                                                    ? 'bg-white scale-125'
                                                    : 'bg-white/40'
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* 关闭提示 */}
                            <motion.div
                                className={`rounded-full bg-black/55 px-3 py-1 text-xs text-white/80 shadow pointer-events-none whitespace-nowrap ${
                                    indicatorPosition === 'top' ? 'order-2' : 'order-1'
                                }`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                {queue.length > 1
                                    ? resolvedQueueLabel
                                    : resolvedDismissLabel}
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export const CardSpotlightQueue = React.memo(
    CardSpotlightQueueInner,
) as typeof CardSpotlightQueueInner;
