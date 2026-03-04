/**
 * useActiveModifiers Hook
 *
 * 追踪投掷阶段打出的攻击修正卡（timing: 'roll'），
 * 在 UI 上显示"已激活修正"指示器，直到攻击结算完成。
 *
 * 通过 EventStream 消费 CARD_PLAYED / ATTACK_RESOLVED 事件驱动。
 * 
 * 撤回处理：
 * - 撤回操作会导致 EventStream 回退，didReset=true
 * - 此时重新扫描当前 EventStream，恢复仍然存在的修正卡
 * - 只有被撤回的修正卡会从 UI 上移除
 * 
 * 刷新恢复：
 * - 首次挂载时扫描 EventStream 历史，恢复未结算的修正卡
 * - 查找最后一个 ATTACK_RESOLVED 事件之后的所有 CARD_PLAYED 事件
 */

import { useState, useEffect, useRef } from 'react';
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
    /** 事件 ID（用于撤回时精确匹配） */
    eventId: number;
}

export interface UseActiveModifiersConfig {
    eventStreamEntries: EventStreamEntry[];
}

/**
 * 从 EventStream 中扫描未结算的攻击修正卡
 * 
 * 逻辑：找到最后一个 ATTACK_RESOLVED 事件之后的所有 CARD_PLAYED 事件
 */
function scanActiveModifiers(entries: EventStreamEntry[]): ActiveModifier[] {
    // 从后往前找最后一个 ATTACK_RESOLVED
    let lastResolvedIndex = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].event.type === 'ATTACK_RESOLVED') {
            lastResolvedIndex = i;
            break;
        }
    }

    // 收集 ATTACK_RESOLVED 之后的所有攻击修正卡
    const modifiers: ActiveModifier[] = [];
    const startIndex = lastResolvedIndex + 1;
    
    for (let i = startIndex; i < entries.length; i++) {
        const entry = entries[i];
        const { type, payload, timestamp } = entry.event;

        if (type === 'CARD_PLAYED') {
            const p = payload as { cardId: string };
            const card = findHeroCard(p.cardId);
            if (card && card.isAttackModifier) {
                modifiers.push({
                    cardId: p.cardId,
                    nameKey: typeof card.name === 'string' ? card.name : p.cardId,
                    descriptionKey: typeof card.description === 'string' ? card.description : '',
                    timestamp: typeof timestamp === 'number' ? timestamp : 0,
                    eventId: entry.id,
                });
            }
        }
    }

    return modifiers;
}

/**
 * 追踪当前攻击周期中已打出的攻击修正卡
 */
export function useActiveModifiers(config: UseActiveModifiersConfig) {
    const { eventStreamEntries } = config;
    const [modifiers, setModifiers] = useState<ActiveModifier[]>([]);
    const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });
    const isFirstMountRef = useRef(true);

    useEffect(() => {
        // 首次挂载：扫描历史事件，恢复未结算的修正卡
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            const restoredModifiers = scanActiveModifiers(eventStreamEntries);
            console.log('[useActiveModifiers] 首次挂载，扫描历史事件:', {
                totalEntries: eventStreamEntries.length,
                restoredModifiers,
            });
            if (restoredModifiers.length > 0) {
                setModifiers(restoredModifiers);
            }
            // ❌ 不要在这里调用 consumeNew()！
            // useEventStreamCursor 首次调用时会自动跳过历史事件
            // 如果这里调用，会导致游标推进两次，后续新事件被跳过
            return;
        }

        const { entries: newEntries, didReset } = consumeNew();
        
        console.log('[useActiveModifiers] consumeNew 结果:', {
            newEntriesCount: newEntries.length,
            didReset,
            totalEntries: eventStreamEntries.length,
        });
        
        // 撤回操作：重新扫描当前 EventStream，恢复仍然存在的修正卡
        if (didReset) {
            const restoredModifiers = scanActiveModifiers(eventStreamEntries);
            console.log('[useActiveModifiers] 撤回操作，重新扫描:', {
                totalEntries: eventStreamEntries.length,
                restoredModifiers,
            });
            setModifiers(restoredModifiers);
            return;
        }
        
        if (newEntries.length === 0) return;

        let shouldClear = false;
        const newModifiers: ActiveModifier[] = [];

        for (const entry of newEntries) {
            const { type, payload, timestamp } = entry.event;

            if (type === 'CARD_PLAYED') {
                const p = payload as { cardId: string };
                const card = findHeroCard(p.cardId);
                console.log('[useActiveModifiers] CARD_PLAYED 事件:', {
                    cardId: p.cardId,
                    card,
                    isAttackModifier: card?.isAttackModifier,
                });
                // 只追踪显式标记为攻击修正的卡（isAttackModifier: true）
                if (card && card.isAttackModifier) {
                    newModifiers.push({
                        cardId: p.cardId,
                        nameKey: typeof card.name === 'string' ? card.name : p.cardId,
                        descriptionKey: typeof card.description === 'string' ? card.description : '',
                        timestamp: typeof timestamp === 'number' ? timestamp : 0,
                        eventId: entry.id,
                    });
                }
            }

            // 攻击结算完成，清空所有修正指示
            if (type === 'ATTACK_RESOLVED') {
                console.log('[useActiveModifiers] ATTACK_RESOLVED 事件，清空修正卡');
                shouldClear = true;
            }
        }

        if (shouldClear) {
            setModifiers([]);
        } else if (newModifiers.length > 0) {
            console.log('[useActiveModifiers] 添加新修正卡:', newModifiers);
            setModifiers(prev => [...prev, ...newModifiers]);
        }
    }, [eventStreamEntries, consumeNew]);

    return { activeModifiers: modifiers };
}
