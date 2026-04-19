/**
 * 通用英雄被动能力系统
 *
 * 设计目标：数据驱动的被动能力框架，支持任意英雄复用。
 * 被动能力 = 一组可主动使用的"动作"（花费 CP 重掷/抽牌等）+ 可选的被动触发器。
 *
 * 与 AbilityDef（战斗技能）互补：
 * - AbilityDef：骰面触发的进攻/防御技能
 * - PassiveAbilityDef：任意时刻可花费资源使用的被动动作 + 条件触发的被动效果
 */

import type { PlayerId } from '../../../engine/types';
import type { DiceThroneCore, TurnPhase } from './core-types';
import { RESOURCE_IDS } from './resources';

// ============================================================================
// 被动能力数据定义
// ============================================================================

/** 被动动作类型 */
export type PassiveActionType = 'rerollDie' | 'drawCard';

/** 被动动作的使用时机 */
export type PassiveActionTiming =
    | 'anytime'           // 任意时刻（自己回合的投掷阶段 + 响应窗口）
    | 'ownRollPhase'      // 仅自己的投掷阶段
    | 'responseWindow';   // 仅响应窗口

/** 被动触发器条件 */
export interface PassiveTriggerDef {
    /** 触发时机 */
    on: 'abilityActivatedWithFace';
    /** 需要的骰面（如 'pray'） */
    requiredFace: string;
    /** 触发效果：获得 CP */
    grantCp: number;
    /** 仅在自己的进攻投掷阶段触发 */
    ownOffensiveOnly?: boolean;
}

/** 单个被动动作定义 */
export interface PassiveActionDef {
    /** 动作类型 */
    type: PassiveActionType;
    /** CP 消耗 */
    cpCost: number;
    /** 使用时机 */
    timing: PassiveActionTiming;
    /** 描述 i18n key */
    descriptionKey: string;
}

/** 被动能力定义（一个英雄可有多个被动能力，如教皇税） */
export interface PassiveAbilityDef {
    /** 唯一 ID */
    id: string;
    /** 名称 i18n key */
    nameKey: string;
    /** 可主动使用的动作列表 */
    actions: PassiveActionDef[];
    /** 被动触发器（可选，如"激活祈祷技能时获得 CP"） */
    trigger?: PassiveTriggerDef;
}

// ============================================================================
// 运行时查询
// ============================================================================

/**
 * 获取玩家当前的被动能力定义列表
 * 从 player.passiveAbilities 读取（由 HERO_INITIALIZED 写入）
 */
export function getPlayerPassiveAbilities(
    state: DiceThroneCore,
    playerId: PlayerId
): PassiveAbilityDef[] {
    const player = state.players[playerId];
    return player?.passiveAbilities ?? [];
}

/**
 * 检查被动动作在当前阶段是否可用
 */
export function isPassiveActionUsable(
    state: DiceThroneCore,
    playerId: PlayerId,
    passiveId: string,
    actionIndex: number,
    phase: TurnPhase,
): boolean {
    const passives = getPlayerPassiveAbilities(state, playerId);
    const passive = passives.find(p => p.id === passiveId);
    if (!passive) return false;

    const action = passive.actions[actionIndex];
    if (!action) return false;

    // CP 检查
    const player = state.players[playerId];
    if (!player) return false;
    const cp = player.resources[RESOURCE_IDS.CP] ?? 0;
    if (cp < action.cpCost) return false;

    // rerollDie 额外检查：只能在投掷阶段重掷"自己的骰子"（和 roll 手牌一致）
    if (action.type === 'rerollDie') {
        // 阶段限制：必须在投掷阶段
        if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') return false;
        // 内联 rollerId 判断，避免循环依赖 rules.ts
        const rollerId = phase === 'defensiveRoll'
            ? (state.pendingAttack?.defenderId ?? state.activePlayerId)
            : state.activePlayerId;
        if (rollerId !== playerId) return false;
        // 必须已投掷过至少一次才能重掷（防止防御阶段未投掷就重掷）
        if (state.rollCount === 0) return false;
        // 还需要有活跃骰子（rollDiceCount 范围内且未锁定的骰子）
        const hasUnlockedDie = state.dice.some((d, i) => i < state.rollDiceCount && !d.isKept);
        if (!hasUnlockedDie) return false;
    }

    // 时机检查
    if (action.timing === 'anytime') {
        // "任意时刻" = 自己回合的投掷阶段 + 任何响应窗口
        // 具体的响应窗口可用性由 hasRespondableContent 判断
        return true;
    }
    if (action.timing === 'ownRollPhase') {
        return playerId === state.activePlayerId &&
            (phase === 'offensiveRoll' || phase === 'defensiveRoll');
    }
    return true;
}

/**
 * 检查玩家是否有任何可用的被动动作（用于响应窗口检测）
 */
export function hasUsablePassiveAction(
    state: DiceThroneCore,
    playerId: PlayerId,
    phase: TurnPhase,
): boolean {
    const passives = getPlayerPassiveAbilities(state, playerId);
    for (const passive of passives) {
        for (let i = 0; i < passive.actions.length; i++) {
            if (isPassiveActionUsable(state, playerId, passive.id, i, phase)) {
                return true;
            }
        }
    }
    return false;
}
