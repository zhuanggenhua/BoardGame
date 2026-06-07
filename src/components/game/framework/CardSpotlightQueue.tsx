/**
 * 通用卡牌特写队列组件
 *
 * 展示其他玩家打出的卡牌特写，支持队列堆叠。
 * 点击空白背景或卡牌本体均可关闭当前特写。
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
                className="fixed inset-0 flex items-center justify-center"
                style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                data-testid="card-spotlight-queue"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                data-interaction-allow
            >
                {/* 半透明背景 */}
                <button
                    type="button"
                    aria-label={t('cardSpotlightQueue.closeSpotlight')}
                    className="absolute inset-0 bg-black/20"
                    onClick={handleDismiss}
                />

                {/* 卡牌内容 */}
                <motion.div
                    className="relative cursor-pointer"
                    data-testid="card-spotlight-content"
                    initial={{ scale: 0.5, opacity: 0, y: 40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: -20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    onClick={handleDismiss}
                >
                    {renderCard(current)}
                </motion.div>

                {/* 队列指示器（多张时显示） */}
                {queue.length > 1 && (
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 ${
                            indicatorPosition === 'top' ? 'top-[8vh]' : 'bottom-[8vh]'
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

                {/* 点击提示 */}
                <motion.div
                    className={`absolute left-1/2 -translate-x-1/2 ${
                        indicatorPosition === 'top' ? 'bottom-[8vh]' : 'top-[8vh]'
                    } text-white/50 text-sm pointer-events-none`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    {queue.length > 1
                        ? resolvedQueueLabel
                        : resolvedDismissLabel}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export const CardSpotlightQueue = React.memo(
    CardSpotlightQueueInner,
) as typeof CardSpotlightQueueInner;
