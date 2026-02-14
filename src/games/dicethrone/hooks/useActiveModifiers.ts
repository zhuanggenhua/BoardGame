/**
 * useActiveModifiers Hook
 *
 * 追踪投掷阶段打出的攻击修正卡（timing: 'roll'），
 * 在 UI 上显示"已激活修正"指示器，直到攻击结算完成。
 *
 * 通过 EventStream 消费 CARD_PLAYED / ATTACK_RESOLVED 事件驱动。
 */

import { useState, useEffect, useRef } from 'react';
import type { EventStreamEntry } from '../../../engine/types';
import { findHeroCard } from '../heroes';

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
    const lastSeenIdRef = useRef<number>(-1);
    const isFirstMountRef = useRef(true);

    // 首次挂载跳过历史
    useEffect(() => {
        if (isFirstMountRef.current && eventStreamEntries.length > 0) {
            lastSeenIdRef.current = eventStreamEntries[eventStreamEntries.length - 1].id;
            isFirstMountRef.current = false;
        }
    }, [eventStreamEntries]);

    useEffect(() => {
        if (isFirstMountRef.current) return;
        if (eventStreamEntries.length === 0) return;

        const lastSeenId = lastSeenIdRef.current;
        const newEntries = eventStreamEntries.filter(e => e.id > lastSeenId);
        if (newEntries.length === 0) return;

        lastSeenIdRef.current = newEntries[newEntries.length - 1].id;

        let shouldClear = false;
        const newModifiers: ActiveModifier[] = [];

        for (const entry of newEntries) {
            const { type, payload, timestamp } = entry.event;

            if (type === 'CARD_PLAYED') {
                const p = payload as { cardId: string };
                const card = findHeroCard(p.cardId);
                // 只追踪 timing: 'roll' 的卡牌（攻击修正卡）
                if (card && card.timing === 'roll' && card.type === 'action') {
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
    }, [eventStreamEntries]);

    return { activeModifiers: modifiers };
}
