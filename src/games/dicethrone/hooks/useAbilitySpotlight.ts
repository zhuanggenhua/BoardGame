/**
 * useAbilitySpotlight Hook
 * 
 * 管理技能特写队列和额外骰子绑定。
 * 自动追踪 lastActivatedAbility 的变化，维护技能特写队列。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerId } from '../../../engine/types';
import type { DieFace } from '../domain/types';
import type { AbilitySpotlightItem } from '../ui/AbilitySpotlightOverlay';

/**
 * 技能特写配置
 */
export interface AbilitySpotlightConfig {
    /** 最后激活的技能 */
    lastActivatedAbility?: {
        timestamp: number;
        abilityId: string;
        level: number;
        playerId: PlayerId;
        isDefense?: boolean;
    };
    /** 最后的额外骰子投掷（用于尝试绑定） */
    lastBonusDieRoll?: {
        timestamp: number;
        value: number;
        face?: DieFace;
        playerId: PlayerId;
    };
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 对手名称 */
    opponentName: string;
    /** 从卡牌队列中移除已绑定的骰子（由外部触发） */
    onRemoveBoundBonusDie?: () => void;
}

/**
 * 技能特写状态
 */
export interface AbilitySpotlightState {
    /** 技能特写队列 */
    abilitySpotlightQueue: AbilitySpotlightItem[];
    /** 关闭技能特写 */
    handleAbilitySpotlightClose: (id: string) => void;
    /** 尝试绑定骰子到技能（外部调用） */
    tryBindBonusDie: (bonusDie: { value: number; face?: DieFace; timestamp: number; playerId: PlayerId }) => boolean;
}

/**
 * 管理技能特写队列
 */
export function useAbilitySpotlight(config: AbilitySpotlightConfig): AbilitySpotlightState {
    const { lastActivatedAbility, currentPlayerId, opponentName } = config;

    // 技能特写队列
    const [abilitySpotlightQueue, setAbilitySpotlightQueue] = useState<AbilitySpotlightItem[]>([]);
    const abilitySpotlightQueueRef = useRef<AbilitySpotlightItem[]>([]);

    // 追踪 timestamp 避免重复触发
    const prevLastActivatedAbilityTimestampRef = useRef<number | undefined>(lastActivatedAbility?.timestamp);

    // 同步队列到 ref
    useEffect(() => {
        abilitySpotlightQueueRef.current = abilitySpotlightQueue;
    }, [abilitySpotlightQueue]);

    /**
     * 监听其他玩家激活技能
     */
    useEffect(() => {
        const ability = lastActivatedAbility;
        const prevTimestamp = prevLastActivatedAbilityTimestampRef.current;

        if (!ability || ability.timestamp === prevTimestamp) {
            return;
        }

        // 只展示其他玩家激活的技能
        if (ability.playerId !== currentPlayerId) {
            const newItem: AbilitySpotlightItem = {
                id: `${ability.abilityId}-${ability.timestamp}`,
                timestamp: ability.timestamp,
                abilityId: ability.abilityId,
                level: ability.level,
                playerId: ability.playerId,
                playerName: opponentName,
                isDefense: ability.isDefense,
            };
            setAbilitySpotlightQueue(prev => [...prev, newItem]);
        }

        prevLastActivatedAbilityTimestampRef.current = ability.timestamp;
    }, [lastActivatedAbility, currentPlayerId, opponentName]);

    /**
     * 尝试绑定骰子到技能（由外部调用）
     */
    const tryBindBonusDie = useCallback((bonusDie: { value: number; face?: DieFace; timestamp: number; playerId: PlayerId }): boolean => {
        const abilityQueue = abilitySpotlightQueueRef.current;
        const thresholdMs = 1500;
        
        const abilityCandidate = [...abilityQueue]
            .reverse()
            .find((item) => 
                item.playerId === bonusDie.playerId && 
                Math.abs(item.timestamp - bonusDie.timestamp) <= thresholdMs
            );

        if (abilityCandidate) {
            // 绑定到技能上一起显示
            setAbilitySpotlightQueue((prev) =>
                prev.map((item) =>
                    item.id === abilityCandidate.id
                        ? {
                            ...item,
                            bonusDice: [
                                ...(item.bonusDice || []),
                                { value: bonusDie.value, face: bonusDie.face, timestamp: bonusDie.timestamp },
                            ],
                        }
                        : item
                )
            );
            return true; // 绑定成功
        }

        return false; // 未找到合适的技能
    }, []);

    /**
     * 关闭技能特写
     */
    const handleAbilitySpotlightClose = useCallback((id: string) => {
        setAbilitySpotlightQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    return {
        abilitySpotlightQueue,
        handleAbilitySpotlightClose,
        tryBindBonusDie,
    };
}
