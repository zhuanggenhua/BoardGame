/**
 * DiceThrone 交互系统类型定义
 * 
 * 基于 InteractionSystem 的统一交互模式
 */

import type { PlayerId } from '../../../../engine/types';
import type { DiceThroneEvent } from '../types';

/**
 * 选择玩家交互配置
 */
export interface SelectPlayerInteractionConfig {
    /** 发起交互的玩家 ID */
    playerId: PlayerId;
    /** 来源技能/卡牌 ID */
    sourceAbilityId: string;
    /** 选择数量 */
    count: number;
    /** 可选目标玩家 ID 列表（默认所有玩家） */
    targetPlayerIds?: PlayerId[];
    /** 交互标题 i18n key */
    titleKey?: string;
    /** 解决回调：接收选中的玩家 ID，返回后续事件 */
    onResolve: (selectedPlayerIds: PlayerId[]) => DiceThroneEvent[];
}

/**
 * 选择骰子交互配置
 */
export interface SelectDieInteractionConfig {
    /** 发起交互的玩家 ID */
    playerId: PlayerId;
    /** 来源技能/卡牌 ID */
    sourceAbilityId: string;
    /** 选择数量 */
    count: number;
    /** 可选骰子 ID 列表（默认所有骰子） */
    allowedDiceIds?: number[];
    /** 交互标题 i18n key */
    titleKey?: string;
    /** 解决回调：接收选中的骰子 ID，返回后续事件 */
    onResolve: (selectedDiceIds: number[]) => DiceThroneEvent[];
}

/**
 * 修改骰子交互配置
 */
export interface ModifyDieInteractionConfig {
    /** 发起交互的玩家 ID */
    playerId: PlayerId;
    /** 来源技能/卡牌 ID */
    sourceAbilityId: string;
    /** 目标骰子 ID */
    dieId: number;
    /** 允许的骰面值列表 */
    allowedValues: number[];
    /** 交互标题 i18n key */
    titleKey?: string;
    /** 解决回调：接收新骰面值，返回后续事件 */
    onResolve: (newValue: number) => DiceThroneEvent[];
}

/**
 * 选择状态交互配置
 */
export interface SelectStatusInteractionConfig {
    /** 发起交互的玩家 ID */
    playerId: PlayerId;
    /** 来源技能/卡牌 ID */
    sourceAbilityId: string;
    /** 当前游戏状态（用于生成选项列表） */
    state: any; // DiceThroneCore，但为了避免循环依赖使用 any
    /** 可选目标玩家 ID 列表（默认所有玩家） */
    targetPlayerIds?: PlayerId[];
    /** 状态过滤器（可选） */
    filter?: (statusId: string) => boolean;
    /** 交互标题 i18n key */
    titleKey?: string;
    /** 解决回调：接收选中的状态，返回后续事件 */
    onResolve: (selection: { playerId: PlayerId; statusId: string }) => DiceThroneEvent[];
}

/**
 * 转移状态交互配置
 */
export interface TransferStatusInteractionConfig {
    /** 发起交互的玩家 ID */
    playerId: PlayerId;
    /** 来源技能/卡牌 ID */
    sourceAbilityId: string;
    /** 源玩家 ID */
    sourcePlayerId: PlayerId;
    /** 状态 ID */
    statusId: string;
    /** 交互标题 i18n key */
    titleKey?: string;
    /** 解决回调：接收目标玩家 ID，返回后续事件 */
    onResolve: (targetPlayerId: PlayerId) => DiceThroneEvent[];
}
