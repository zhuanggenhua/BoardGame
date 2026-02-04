/**
 * useAnimationEffects Hook
 * 
 * 统一管理 HP 和状态效果变化的飞行动画效果。
 * 自动追踪变化并触发相应的动画，消除重复的 useEffect 逻辑。
 * 
 * @example
 * ```typescript
 * useAnimationEffects({
 *   players: { player, opponent },
 *   currentPlayerId: rootPid,
 *   opponentId: otherPid,
 *   refs: { opponentHp, selfHp, opponentBuff, selfBuff },
 *   getEffectStartPos,
 *   pushFlyingEffect,
 *   triggerOpponentShake,
 *   locale,
 *   statusIconAtlas
 * });
 * ```
 */

import { useEffect, useRef } from 'react';
import type { HeroState } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import type { StatusIconAtlasConfig } from '../ui/statusEffects';
import { STATUS_EFFECT_META, TOKEN_META, getStatusEffectIconNode } from '../ui/statusEffects';
import { getElementCenter } from '../../../components/common/animations/FlyingEffect';
import { 
    getSlashPresetByDamage, 
    getHitStopPresetByDamage,
    type SlashConfig,
    type HitStopConfig 
} from '../../../components/common/animations';
import { RESOURCE_IDS } from '../domain/resources';

/**
 * 动画效果配置
 */
export interface AnimationEffectsConfig {
    /** 玩家状态（包含自己和对手） */
    players: {
        player: HeroState;
        opponent?: HeroState;
    };
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 对手 ID */
    opponentId: PlayerId;
    /** DOM 引用 */
    refs: {
        opponentHp: React.RefObject<HTMLDivElement | null>;
        selfHp: React.RefObject<HTMLDivElement | null>;
        opponentBuff: React.RefObject<HTMLDivElement | null>;
        selfBuff: React.RefObject<HTMLDivElement | null>;
    };
    /** 获取效果起始位置的函数 */
    getEffectStartPos: (targetId?: string) => { x: number; y: number };
    /** 推送飞行效果的函数 */
    pushFlyingEffect: (effect: {
        type: 'damage' | 'buff';
        content: string | React.ReactNode;
        startPos: { x: number; y: number };
        endPos: { x: number; y: number };
        color?: string;
    }) => void;
    /** 触发对手震动效果的函数（可选） */
    triggerOpponentShake?: () => void;
    /** 触发斜切效果的函数（可选） */
    triggerSlash?: (config: SlashConfig) => void;
    /** 触发钝帧效果的函数（可选） */
    triggerHitStop?: (config: HitStopConfig) => void;
    /** 触发自己受击效果的函数（可选） */
    triggerSelfImpact?: (damage: number) => void;
    /** 当前语言 */
    locale?: string;
    /** 状态图标图集配置 */
    statusIconAtlas?: StatusIconAtlasConfig | null;
}

/**
 * 管理动画效果的 Hook
 * 
 * 自动追踪 HP 和状态效果变化，触发飞行动画
 */
export function useAnimationEffects(config: AnimationEffectsConfig) {
    const {
        players: { player, opponent },
        currentPlayerId,
        opponentId,
        refs,
        getEffectStartPos,
        pushFlyingEffect,
        triggerOpponentShake,
        triggerSlash,
        triggerHitStop,
        triggerSelfImpact,
        locale,
        statusIconAtlas
    } = config;

    // 追踪上一次的 HP 值（防御性读取，player/opponent 可能 undefined）
    const prevOpponentHealthRef = useRef(opponent?.resources?.[RESOURCE_IDS.HP]);
    const prevPlayerHealthRef = useRef(player?.resources?.[RESOURCE_IDS.HP]);

    // 追踪上一次的状态效果
    const prevOpponentStatusRef = useRef<Record<string, number>>({ ...(opponent?.statusEffects || {}) });
    const prevPlayerStatusRef = useRef<Record<string, number>>({ ...(player?.statusEffects || {}) });
    // 追踪上一次的 Token
    const prevOpponentTokensRef = useRef<Record<string, number>>({ ...(opponent?.tokens || {}) });
    const prevPlayerTokensRef = useRef<Record<string, number>>({ ...(player?.tokens || {}) });

    /**
     * 监听对手 HP 变化（伤害动画）
     */
    useEffect(() => {
        if (!opponent) return;
        
        const currentHealth = opponent.resources?.[RESOURCE_IDS.HP] ?? 0;
        const prevHealth = prevOpponentHealthRef.current;
        
        // 检测 HP 下降（受到伤害）
        if (prevHealth !== undefined && currentHealth < prevHealth) {
            const damage = prevHealth - currentHealth;
            pushFlyingEffect({
                type: 'damage',
                content: `-${damage}`,
                startPos: getEffectStartPos(opponentId),
                endPos: getElementCenter(refs.opponentHp.current),
            });
            
            // 触发震动效果
            triggerOpponentShake?.();
            
            // 触发打击感效果（斜切 + 钝帧）
            triggerSlash?.(getSlashPresetByDamage(damage));
            triggerHitStop?.(getHitStopPresetByDamage(damage));
        }
        
        prevOpponentHealthRef.current = currentHealth;
    }, [opponent?.resources, opponent, pushFlyingEffect, triggerOpponentShake, triggerSlash, triggerHitStop, getEffectStartPos, opponentId, refs.opponentHp]);

    /**
     * 监听玩家 HP 变化（伤害动画）
     */
    useEffect(() => {
        if (!player?.resources) return;
        const currentHealth = player.resources[RESOURCE_IDS.HP] ?? 0;
        const prevHealth = prevPlayerHealthRef.current;
        
        // 检测 HP 下降（受到伤害）
        if (prevHealth !== undefined && currentHealth < prevHealth) {
            const damage = prevHealth - currentHealth;
            pushFlyingEffect({
                type: 'damage',
                content: `-${damage}`,
                startPos: getEffectStartPos(currentPlayerId),
                endPos: getElementCenter(refs.selfHp.current),
            });
            
            // 触发自己受击效果
            triggerSelfImpact?.(damage);
        }
        
        prevPlayerHealthRef.current = currentHealth;
    }, [player.resources, pushFlyingEffect, getEffectStartPos, currentPlayerId, triggerSelfImpact, refs.selfHp]);

    /**
     * 监听对手状态效果变化（增益/减益动画）
     */
    useEffect(() => {
        if (!opponent) return;
        
        const prevStatus = prevOpponentStatusRef.current;
        
        // 检查每个状态效果的层数变化
        Object.entries(opponent.statusEffects || {}).forEach(([effectId, stacks]) => {
            const prevStacks = prevStatus[effectId] ?? 0;
            
            // 检测状态增加
            if (stacks > prevStacks) {
                const info = STATUS_EFFECT_META[effectId] || { 
                    icon: '✨', 
                    color: 'from-slate-500 to-slate-600' 
                };
                
                pushFlyingEffect({
                    type: 'buff',
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: info.color,
                    startPos: getEffectStartPos(opponentId),
                    endPos: getElementCenter(refs.opponentBuff.current),
                });
            }
        });
        
        prevOpponentStatusRef.current = { ...opponent.statusEffects };
    }, [opponent?.statusEffects, opponent, pushFlyingEffect, getEffectStartPos, opponentId, locale, statusIconAtlas, refs.opponentBuff]);

    /**
     * 监听玩家状态效果变化（增益/减益动画）
     */
    useEffect(() => {
        const prevStatus = prevPlayerStatusRef.current;
        
        // 检查每个状态效果的层数变化
        Object.entries(player.statusEffects || {}).forEach(([effectId, stacks]) => {
            const prevStacks = prevStatus[effectId] ?? 0;
            
            // 检测状态增加
            if (stacks > prevStacks) {
                const info = STATUS_EFFECT_META[effectId] || { 
                    icon: '✨', 
                    color: 'from-slate-500 to-slate-600' 
                };
                
                pushFlyingEffect({
                    type: 'buff',
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: info.color,
                    startPos: getEffectStartPos(currentPlayerId),
                    endPos: getElementCenter(refs.selfBuff.current),
                });
            }
        });
        
        prevPlayerStatusRef.current = { ...player.statusEffects };
    }, [player.statusEffects, pushFlyingEffect, getEffectStartPos, currentPlayerId, locale, statusIconAtlas, refs.selfBuff]);

    /**
     * 监听对手 Token 变化（增益动画）
     */
    useEffect(() => {
        if (!opponent) return;

        const prevTokens = prevOpponentTokensRef.current;

        Object.entries(opponent.tokens || {}).forEach(([tokenId, stacks]) => {
            const prevStacks = prevTokens[tokenId] ?? 0;
            if (stacks > prevStacks) {
                const info = TOKEN_META[tokenId] || {
                    icon: '✨',
                    color: 'from-slate-500 to-slate-600'
                };

                pushFlyingEffect({
                    type: 'buff',
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: info.color,
                    startPos: getEffectStartPos(opponentId),
                    endPos: getElementCenter(refs.opponentBuff.current),
                });
            }
        });

        prevOpponentTokensRef.current = { ...opponent.tokens };
    }, [opponent?.tokens, opponent, pushFlyingEffect, getEffectStartPos, opponentId, locale, statusIconAtlas, refs.opponentBuff]);

    /**
     * 监听玩家 Token 变化（增益动画）
     */
    useEffect(() => {
        const prevTokens = prevPlayerTokensRef.current;

        Object.entries(player.tokens || {}).forEach(([tokenId, stacks]) => {
            const prevStacks = prevTokens[tokenId] ?? 0;
            if (stacks > prevStacks) {
                const info = TOKEN_META[tokenId] || {
                    icon: '✨',
                    color: 'from-slate-500 to-slate-600'
                };

                pushFlyingEffect({
                    type: 'buff',
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: info.color,
                    startPos: getEffectStartPos(currentPlayerId),
                    endPos: getElementCenter(refs.selfBuff.current),
                });
            }
        });

        prevPlayerTokensRef.current = { ...player.tokens };
    }, [player.tokens, pushFlyingEffect, getEffectStartPos, currentPlayerId, locale, statusIconAtlas, refs.selfBuff]);
}
