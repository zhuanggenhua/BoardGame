/**
 * useActiveModifiers Hook
 *
 * 追踪投掷阶段打出的攻击修正卡（timing: 'roll'），
 * 在 UI 上显示"已激活修正"指示器，直到攻击结算完成。
 *
 * 通过 EventStream 消费 CARD_PLAYED / ATTACK_RESOLVED 事件驱动。
 */

import { useState, useEffect } from 'react';
import type { EventStreamEntry } from '../../../engine/types';
import { findHeroCard } from '../heroes';
import { useEventStreamCursor } from '../../../engine/hooks';

/** 已激活的修正卡信息 */
export interface ActiveModifier {
    cardId: string;
    /** 卡牌名称 i18n key */
    nameKey: string;
    /** 卡牌效果描述 i18n key */
    descriptionKey: string;
    timestamp: number;
}

export interface UseActiveModifiersConfig {
    eventStreamEntries: EventStreamEntry[];
}

/**
 * 追踪当前攻击周期中已打出的攻击修正卡
 */
export function useActiveModifiers(config: UseActiveModifiersConfig) {
    const { eventStreamEntries } = config;
    const [modifiers, setModifiers] = useState<ActiveModifier[]>([]);
    const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });

    useEffect(() => {
        const { entries: newEntries } = consumeNew();
        if (newEntries.length === 0) return;

        let shouldClear = false;
        const newModifiers: ActiveModifier[] = [];

        for (const entry of newEntries) {
            const { type, payload, timestamp } = entry.event;

            if (type === 'CARD_PLAYED') {
                const p = payload as { cardId: string };
                const card = findHeroCard(p.cardId);
                // 只追踪显式标记为攻击修正的卡（isAttackModifier: true）
                if (card && card.isAttackModifier) {
                    newModifiers.push({
                        cardId: p.cardId,
                        nameKey: typeof card.name === 'string' ? card.name : p.cardId,
                        descriptionKey: typeof card.description === 'string' ? card.description : '',
                        timestamp: typeof timestamp === 'number' ? timestamp : 0,
                    });
                }
            }

            // 攻击结算完成，清空所有修正指示
            if (type === 'ATTACK_RESOLVED') {
                shouldClear = true;
            }
        }

        if (shouldClear) {
            setModifiers([]);
        } else if (newModifiers.length > 0) {
            setModifiers(prev => [...prev, ...newModifiers]);
        }
    }, [eventStreamEntries, consumeNew]);

    return { activeModifiers: modifiers };
}
