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
 * 
 * 游标管理：
 * - 不使用 useEventStreamCursor（会在首次挂载时跳过历史事件）
 * - 手动管理游标，确保首次挂载时能扫描到历史事件
 */

import { useState, useEffect, useRef } from 'react';
import type { EventStreamEntry } from '../../../engine/types';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';
import { findHeroCard } from '../heroes';

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
function isModifierResetEvent(entry: EventStreamEntry): boolean {
    if (entry.event.type === 'ATTACK_RESOLVED' || entry.event.type === 'TURN_CHANGED') {
        return true;
    }
    if (entry.event.type === FLOW_EVENTS.PHASE_CHANGED) {
        const payload = (entry.event as { payload?: { to?: string } }).payload;
        return payload?.to === 'main2';
    }
    return false;
}

function scanActiveModifiers(entries: EventStreamEntry[]): ActiveModifier[] {
    console.log('[scanActiveModifiers] 开始扫描，总事件数:', entries.length);
    
    // 从后往前找最后一个 ATTACK_RESOLVED
    let lastResolvedIndex = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
        if (isModifierResetEvent(entries[i])) {
            lastResolvedIndex = i;
            console.log('[scanActiveModifiers] 找到最后一个 ATTACK_RESOLVED，索引:', i);
            break;
        }
    }

    // 收集 ATTACK_RESOLVED 之后的所有攻击修正卡
    const modifiers: ActiveModifier[] = [];
    const startIndex = lastResolvedIndex + 1;
    
    console.log('[scanActiveModifiers] 扫描范围:', {
        startIndex,
        endIndex: entries.length - 1,
        eventCount: entries.length - startIndex,
    });
    
    for (let i = startIndex; i < entries.length; i++) {
        const entry = entries[i];
        const { type, payload, timestamp } = entry.event;

        if (type === 'CARD_PLAYED') {
            const p = payload as { cardId: string };
            const card = findHeroCard(p.cardId);
            console.log('[scanActiveModifiers] CARD_PLAYED 事件:', {
                index: i,
                cardId: p.cardId,
                card: card ? { id: card.id, name: card.name, isAttackModifier: card.isAttackModifier } : null,
            });
            if (card && card.isAttackModifier) {
                const modifier = {
                    cardId: p.cardId,
                    nameKey: typeof card.name === 'string' ? card.name : p.cardId,
                    descriptionKey: typeof card.description === 'string' ? card.description : '',
                    timestamp: typeof timestamp === 'number' ? timestamp : 0,
                    eventId: entry.id,
                };
                console.log('[scanActiveModifiers] 找到攻击修正卡:', modifier);
                modifiers.push(modifier);
            }
        }
    }

    console.log('[scanActiveModifiers] 扫描完成，找到修正卡数量:', modifiers.length);
    return modifiers;
}

/**
 * 追踪当前攻击周期中已打出的攻击修正卡
 * 
 * 手动管理游标，不使用 useEventStreamCursor（避免首次挂载时跳过历史事件）
 */
export function useActiveModifiers(config: UseActiveModifiersConfig) {
    const { eventStreamEntries } = config;
    const [modifiers, setModifiers] = useState<ActiveModifier[]>([]);
    // 手动管理游标：记录上次处理的最大事件 ID
    const lastSeenIdRef = useRef<number>(-1);
    const isFirstMountRef = useRef(true);

    console.log('[useActiveModifiers] Hook 被调用，isFirstMount:', isFirstMountRef.current, 'totalEntries:', eventStreamEntries.length);

    useEffect(() => {
        const curLen = eventStreamEntries.length;
        console.log('[useActiveModifiers] useEffect 触发，isFirstMount:', isFirstMountRef.current, 'totalEntries:', curLen);
        
        // 首次挂载：扫描历史事件，恢复未结算的攻击修正卡
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            console.log('[useActiveModifiers] 执行首次挂载逻辑');
            
            // 详细日志：列出所有事件类型
            const eventTypes = eventStreamEntries.map(e => e.event.type);
            console.log('[useActiveModifiers] 首次挂载，EventStream 事件类型:', eventTypes);
            
            const restoredModifiers = scanActiveModifiers(eventStreamEntries);
            console.log('[useActiveModifiers] 首次挂载，扫描历史事件:', {
                totalEntries: curLen,
                restoredModifiers,
                restoredCount: restoredModifiers.length,
            });
            
            // 更新游标到当前最新位置
            if (curLen > 0) {
                lastSeenIdRef.current = eventStreamEntries[curLen - 1].id;
                console.log('[useActiveModifiers] 首次挂载，更新游标到:', lastSeenIdRef.current);
            }
            
            if (restoredModifiers.length > 0) {
                console.log('[useActiveModifiers] 首次挂载，设置 modifiers:', restoredModifiers);
                setModifiers(restoredModifiers);
            } else {
                console.log('[useActiveModifiers] 首次挂载，没有找到攻击修正卡');
            }
            return;
        }
        
        // entries 为空：检查是否需要重置游标
        if (curLen === 0) {
            if (lastSeenIdRef.current > -1) {
                console.log('[useActiveModifiers] EventStream 被清空，重置游标');
                lastSeenIdRef.current = -1;
            }
            return;
        }
        
        // Undo 回退检测：最大 ID 真正回退
        const maxId = eventStreamEntries[curLen - 1].id;
        if (maxId < lastSeenIdRef.current) {
            console.log('[useActiveModifiers] 检测到 Undo 回退，重新扫描');
            lastSeenIdRef.current = maxId;
            const restoredModifiers = scanActiveModifiers(eventStreamEntries);
            console.log('[useActiveModifiers] Undo 回退，重新扫描:', {
                totalEntries: curLen,
                restoredModifiers,
            });
            setModifiers(restoredModifiers);
            return;
        }
        
        // 正常消费：获取新事件
        const newEntries = eventStreamEntries.filter(e => e.id > lastSeenIdRef.current);
        
        console.log('[useActiveModifiers] 正常消费:', {
            cursor: lastSeenIdRef.current,
            totalEntries: curLen,
            maxId,
            newEntriesCount: newEntries.length,
            allEventIds: eventStreamEntries.map(e => e.id),
            newEventIds: newEntries.map(e => e.id),
        });
        
        if (newEntries.length === 0) return;
        
        // 更新游标
        lastSeenIdRef.current = newEntries[newEntries.length - 1].id;
        console.log('[useActiveModifiers] 更新游标到:', lastSeenIdRef.current);

        // 处理新事件：需要区分 ATTACK_RESOLVED 前后的 CARD_PLAYED
        // 逻辑：
        // 1. ATTACK_RESOLVED 之前的 CARD_PLAYED → 添加到当前修正卡列表
        // 2. ATTACK_RESOLVED 事件 → 清空所有修正卡（攻击结算完成）
        // 3. ATTACK_RESOLVED 之后的 CARD_PLAYED → 添加到新的修正卡列表（新攻击周期）
        
        // 详细日志：列出所有新事件类型
        const newEventTypes = newEntries.map(e => e.event.type);
        console.log('[useActiveModifiers] 新事件类型:', newEventTypes);
        
        let attackResolvedIndex = -1;
        for (let i = newEntries.length - 1; i >= 0; i--) {
            if (isModifierResetEvent(newEntries[i])) {
                attackResolvedIndex = i;
                console.log('[useActiveModifiers] 找到 ATTACK_RESOLVED 事件，索引:', i);
                break;
            }
        }

        if (attackResolvedIndex >= 0) {
            // 有 ATTACK_RESOLVED 事件：清空旧修正卡，收集 ATTACK_RESOLVED 之后的新修正卡
            const newModifiers: ActiveModifier[] = [];
            
            console.log('[useActiveModifiers] 处理 ATTACK_RESOLVED，清空旧修正卡');
            
            for (let i = attackResolvedIndex + 1; i < newEntries.length; i++) {
                const entry = newEntries[i];
                const { type, payload, timestamp } = entry.event;
                
                if (type === 'CARD_PLAYED') {
                    const p = payload as { cardId: string };
                    const card = findHeroCard(p.cardId);
                    console.log('[useActiveModifiers] ATTACK_RESOLVED 后的 CARD_PLAYED:', {
                        cardId: p.cardId,
                        isAttackModifier: card?.isAttackModifier,
                    });
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
            }
            
            console.log('[useActiveModifiers] ATTACK_RESOLVED 后的新修正卡:', newModifiers, '（应该清空旧的）');
            setModifiers(newModifiers);
        } else {
            // 没有 ATTACK_RESOLVED 事件：正常添加修正卡
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
            }

            if (newModifiers.length > 0) {
                console.log('[useActiveModifiers] 添加新修正卡:', newModifiers);
                setModifiers(prev => [...prev, ...newModifiers]);
            }
        }
    }, [eventStreamEntries]); // 移除 modifiers 依赖，避免无限循环

    return { activeModifiers: modifiers };
}
