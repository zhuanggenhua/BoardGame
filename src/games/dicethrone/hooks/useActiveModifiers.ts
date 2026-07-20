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
import { useEventStreamRollback } from '../../../engine/hooks/EventStreamRollbackContext';
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
    // 从后往前找最后一个 ATTACK_RESOLVED
    let lastResolvedIndex = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
        if (isModifierResetEvent(entries[i])) {
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
                const modifier = {
                    cardId: p.cardId,
                    nameKey: typeof card.name === 'string' ? card.name : p.cardId,
                    descriptionKey: typeof card.description === 'string' ? card.description : '',
                    timestamp: typeof timestamp === 'number' ? timestamp : 0,
                    eventId: entry.id,
                };
                modifiers.push(modifier);
            }
        }
    }

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
    const rollback = useEventStreamRollback();
    // 手动管理游标：记录上次处理的最大事件 ID
    const lastSeenIdRef = useRef<number>(-1);
    const isFirstMountRef = useRef(true);
    const lastRollbackSeqRef = useRef<number>(rollback.seq);

    useEffect(() => {
        if (rollback.seq === lastRollbackSeqRef.current) {
            return;
        }

        lastRollbackSeqRef.current = rollback.seq;
        setModifiers([]);
        lastSeenIdRef.current = rollback.watermark ?? -1;
    }, [rollback]);

    useEffect(() => {
        const curLen = eventStreamEntries.length;

        // 首次挂载：扫描历史事件，恢复未结算的攻击修正卡
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;

            const restoredModifiers = scanActiveModifiers(eventStreamEntries);

            // 更新游标到当前最新位置
            if (curLen > 0) {
                lastSeenIdRef.current = eventStreamEntries[curLen - 1].id;
            }

            if (restoredModifiers.length > 0) {
                setModifiers(restoredModifiers);
            }
            return;
        }

        // entries 为空：检查是否需要重置游标
        if (curLen === 0) {
            if (lastSeenIdRef.current > -1) {
                lastSeenIdRef.current = -1;
            }
            return;
        }

        // Undo 回退检测：最大 ID 真正回退
        const maxId = eventStreamEntries[curLen - 1].id;
        if (maxId < lastSeenIdRef.current) {
            lastSeenIdRef.current = maxId;
            const restoredModifiers = scanActiveModifiers(eventStreamEntries);
            setModifiers(restoredModifiers);
            return;
        }

        // 正常消费：获取新事件
        const newEntries = eventStreamEntries.filter(e => e.id > lastSeenIdRef.current);

        if (newEntries.length === 0) return;

        // 更新游标
        lastSeenIdRef.current = newEntries[newEntries.length - 1].id;

        // 处理新事件：需要区分 ATTACK_RESOLVED 前后的 CARD_PLAYED
        // 逻辑：
        // 1. ATTACK_RESOLVED 之前的 CARD_PLAYED → 添加到当前修正卡列表
        // 2. ATTACK_RESOLVED 事件 → 清空所有修正卡（攻击结算完成）
        // 3. ATTACK_RESOLVED 之后的 CARD_PLAYED → 添加到新的修正卡列表（新攻击周期）

        let attackResolvedIndex = -1;
        for (let i = newEntries.length - 1; i >= 0; i--) {
            if (isModifierResetEvent(newEntries[i])) {
                attackResolvedIndex = i;
                break;
            }
        }

        if (attackResolvedIndex >= 0) {
            // 有 ATTACK_RESOLVED 事件：清空旧修正卡，收集 ATTACK_RESOLVED 之后的新修正卡
            const newModifiers: ActiveModifier[] = [];

            for (let i = attackResolvedIndex + 1; i < newEntries.length; i++) {
                const entry = newEntries[i];
                const { type, payload, timestamp } = entry.event;

                if (type === 'CARD_PLAYED') {
                    const p = payload as { cardId: string };
                    const card = findHeroCard(p.cardId);
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

            setModifiers(newModifiers);
        } else {
            // 没有 ATTACK_RESOLVED 事件：正常添加修正卡
            const newModifiers: ActiveModifier[] = [];

            for (const entry of newEntries) {
                const { type, payload, timestamp } = entry.event;

                if (type === 'CARD_PLAYED') {
                    const p = payload as { cardId: string };
                    const card = findHeroCard(p.cardId);
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
                setModifiers(prev => [...prev, ...newModifiers]);
            }
        }
    }, [eventStreamEntries]); // 移除 modifiers 依赖，避免无限循环

    return { activeModifiers: modifiers };
}
