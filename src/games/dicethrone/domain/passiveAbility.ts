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
import type { DiceThroneCore, DtResponseWindowType, TurnPhase } from './core-types';
import { RESOURCE_IDS } from './resources';
import { TOKEN_IDS } from './ids';
import { resolveCurrentRollContext } from './rollContext';
import { isPlayerAllowedToPassiveRerollCurrentRoll } from './rollContextPolicy';

// ============================================================================
// 被动能力数据定义
// ============================================================================

/** 被动动作类型 */
export type PassiveActionType = 'rerollDie' | 'drawCard' | 'custom';

/** 被动动作的使用时机 */
export type PassiveActionTiming =
    | 'anytime'           // 任意时刻（自己回合的投掷阶段 + 响应窗口）
    | 'ownRollPhase'      // 仅自己的投掷阶段
    | 'ownUpkeepPhase'    // 仅自己的维持阶段
    | 'responseWindow'    // 仅响应窗口
    | 'ownMainPhase'      // 仅自己的 main1/main2 主阶段
    | 'anyMainPhase';     // 任意玩家的 main1/main2 主阶段

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
    /** 短按钮文案 i18n key；长描述仍放 descriptionKey / 提示板 */
    labelKey?: string;
    /** CP 消耗 */
    cpCost: number;
    /** 可选 Token 消耗，用于树精等主阶段消耗资源动作 */
    tokenCost?: { tokenId: string; amount: number };
    /** 可选多个 Token 消耗，用于同时花费同类或异类资源的动作 */
    tokenCosts?: Array<{ tokenId: string; amount: number }>;
    /** 非消耗 Token 前置条件，用于“必须已有某机器人”等动作 */
    requiresTokens?: Array<{ tokenId: string; amount: number }>;
    /** 要求某 Token 当前数量仍未达到堆叠上限，避免满额时误扣成本 */
    requiresTokenBelowLimit?: { tokenId: string };
    /** 要求某 Token 当前堆叠上限低于指定值，用于升级类动作 */
    requiresTokenLimitBelow?: { tokenId: string; limit: number };
    /** 要求某 Token 当前堆叠上限至少达到指定值，用于高级形态动作 */
    requiresTokenLimitAtLeast?: { tokenId: string; limit: number };
    /** 使用时机 */
    timing: PassiveActionTiming;
    /** 是否允许在已确认骰面的响应窗口中干预对手当前骰区 */
    allowConfirmedRollInterference?: boolean;
    /** 即使当前条件不满足，也保留按钮并以禁用态展示规则入口。 */
    showWhenUnavailable?: boolean;
    /** 描述 i18n key */
    descriptionKey: string;
    /** custom 动作 ID（type='custom' 时必填） */
    customActionId?: string;
    /** custom 动作参数（type='custom' 时可选） */
    customActionParams?: Record<string, unknown>;
    /** 抽牌数量（type='drawCard' 时可选，默认 1） */
    drawCount?: number;
    /** 同一回合内同一 key 只能使用一次 */
    oncePerTurnKey?: string;
    /** 要求当前玩家正在结算一次自己发起的攻击 */
    requiresCurrentAttack?: boolean;
    /** 要求当前攻击已经成功造成过至少 1 点实际伤害 */
    requiresCurrentAttackDamageDealt?: boolean;
    /** 要求场上至少存在一个规则允许移除的状态效果 */
    requiresAnyRemovableStatus?: boolean;
    /** 要求当前骰区里存在至少一颗对手骰子 */
    requiresOpponentRollDice?: boolean;
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

const TREANT_TREE_SPIRIT_TOKEN_IDS = new Set<string>([
    TOKEN_IDS.TREANT_SEEDLING,
    TOKEN_IDS.TREANT_SAPLING,
    TOKEN_IDS.TREANT_DIVINE,
]);

export function isTreantTreeSpiritToken(tokenId: string): boolean {
    return TREANT_TREE_SPIRIT_TOKEN_IDS.has(tokenId);
}

export function hasSpentTreantTreeSpiritThisTurn(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: string,
): boolean {
    return isTreantTreeSpiritToken(tokenId)
        && state.treantSpiritSpentThisTurn?.[playerId]?.[tokenId] === true;
}

export function getPassiveActionTokenCosts(action: PassiveActionDef): Array<{ tokenId: string; amount: number }> {
    return [
        ...(action.tokenCost ? [action.tokenCost] : []),
        ...(action.tokenCosts ?? []),
    ];
}

function getArtificerRobotIdFromPassiveAction(action: PassiveActionDef): string | undefined {
    switch (action.customActionId) {
        case 'artificer-build-nanobot':
        case 'artificer-upgrade-nanobot':
            return TOKEN_IDS.NANOBOT;
        case 'artificer-build-shock-bot':
        case 'artificer-upgrade-shock-bot':
            return TOKEN_IDS.SHOCK_BOT;
        case 'artificer-build-heal-bot':
        case 'artificer-upgrade-heal-bot':
            return TOKEN_IDS.HEAL_BOT;
        default:
            return undefined;
    }
}

const isArtificerNanobotPassiveActivation = (
    passiveId: string,
    actionIndex: number,
): boolean => passiveId === 'artificer-workshop' && (actionIndex === 0 || actionIndex === 1);

function getPassiveTokenStackLimit(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: string,
): number {
    const player = state.players[playerId];
    const override = player?.tokenStackLimits?.[tokenId];
    if (typeof override === 'number') return override === 0 ? Infinity : override;
    const base = state.tokenDefinitions?.find(def => def.id === tokenId)?.stackLimit;
    if (base === 0) return Infinity;
    return base ?? 99;
}

function isRemovableStatusEffect(state: DiceThroneCore, id: string): boolean {
    const def = state.tokenDefinitions?.find(entry => entry.id === id);
    return def?.passiveTrigger?.removable ?? true;
}

function hasAnyRemovableStatusEffect(
    state: DiceThroneCore,
): boolean {
    return Object.values(state.players).some((player) => (
        Object.entries(player.statusEffects ?? {}).some(([statusId, amount]) => (
            amount > 0 && isRemovableStatusEffect(state, statusId)
        ))
    ));
}

function hasOpponentRollDice(
    state: DiceThroneCore,
    playerId: PlayerId,
    phase: TurnPhase,
): boolean {
    const currentRollContext = resolveCurrentRollContext(state, phase);
    if (!currentRollContext || currentRollContext.policy.rerollableBy === 'none') {
        return false;
    }
    return currentRollContext.dice.some((die) => (
        (die.ownerId ?? currentRollContext.ownerPlayerId) !== playerId
    ));
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
    context: { responseWindowType?: DtResponseWindowType } = {},
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
    if (
        action.oncePerTurnKey
        && state.passiveActionUsedThisTurn?.[playerId]?.[action.oncePerTurnKey] === true
    ) {
        return false;
    }
    if (action.requiresCurrentAttack) {
        if (!state.pendingAttack || state.pendingAttack.attackerId !== playerId) return false;
    }
    if (action.requiresCurrentAttackDamageDealt) {
        if (!state.pendingAttack || state.pendingAttack.attackerId !== playerId) return false;
        if ((state.pendingAttack.resolvedDamage ?? 0) <= 0) return false;
    }
    if (action.requiresAnyRemovableStatus && !hasAnyRemovableStatusEffect(state)) {
        return false;
    }
    if (action.requiresOpponentRollDice && !hasOpponentRollDice(state, playerId, phase)) {
        return false;
    }
    if (isArtificerNanobotPassiveActivation(passiveId, actionIndex)) {
        const botState = player.artificerBotState?.[TOKEN_IDS.NANOBOT];
        const activationsUsed = botState?.activationsUsedThisTurn ?? 0;
        if (!botState?.built || activationsUsed >= 1) return false;
    }
    const passiveTokenCosts = getPassiveActionTokenCosts(action).filter((cost) => (
        !isArtificerNanobotPassiveActivation(passiveId, actionIndex) || cost.tokenId !== TOKEN_IDS.NANOBOT
    ));
    for (const cost of passiveTokenCosts) {
        if ((player.tokens[cost.tokenId] ?? 0) < cost.amount) return false;
        if (hasSpentTreantTreeSpiritThisTurn(state, playerId, cost.tokenId)) return false;
    }
    for (const requirement of action.requiresTokens ?? []) {
        if (
            isArtificerNanobotPassiveActivation(passiveId, actionIndex)
            && requirement.tokenId === TOKEN_IDS.NANOBOT
        ) {
            const botState = player.artificerBotState?.[TOKEN_IDS.NANOBOT];
            const activationsUsed = botState?.activationsUsedThisTurn ?? 0;
            if (!botState?.built || activationsUsed >= 1) return false;
            continue;
        }
        if ((player.tokens[requirement.tokenId] ?? 0) < requirement.amount) return false;
    }
    const artificerRobotId = getArtificerRobotIdFromPassiveAction(action);
    if (artificerRobotId) {
        const botState = player.artificerBotState?.[artificerRobotId];
        if (action.customActionId?.startsWith('artificer-build-')) {
            if (botState?.built) return false;
        }
        if (action.customActionId?.startsWith('artificer-upgrade-')) {
            if (!botState?.built || botState.upgraded) return false;
        }
    }
    if (action.requiresTokenBelowLimit) {
        const tokenId = action.requiresTokenBelowLimit.tokenId;
        if ((player.tokens[tokenId] ?? 0) >= getPassiveTokenStackLimit(state, playerId, tokenId)) return false;
    }
    if (action.requiresTokenLimitBelow) {
        const { tokenId, limit } = action.requiresTokenLimitBelow;
        if (getPassiveTokenStackLimit(state, playerId, tokenId) >= limit) return false;
    }
    if (action.requiresTokenLimitAtLeast) {
        const { tokenId, limit } = action.requiresTokenLimitAtLeast;
        if (getPassiveTokenStackLimit(state, playerId, tokenId) < limit) return false;
    }

    // rerollDie 额外检查：只能重掷当前骰区里规则允许自己重掷的骰子。
    // 锁定只影响普通投骰时“保留哪些骰子”，不限制花费 Token / 被动动作指定重掷某颗骰子。
    if (action.type === 'rerollDie') {
        const currentRollContext = resolveCurrentRollContext(state, phase);
        if (!currentRollContext) return false;
        if (!isPlayerAllowedToPassiveRerollCurrentRoll(state, currentRollContext, playerId, {
            ...context,
            allowConfirmedRollInterference: action.allowConfirmedRollInterference === true,
        })) return false;
        // 旧主骰兼容路径仍要求已投掷过；显式 currentRollContext（如闪避/奖励骰）以自身存在为准。
        if (!state.currentRollContext && state.rollCount === 0) return false;
        if (currentRollContext.dice.length === 0) return false;
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
    if (action.timing === 'ownUpkeepPhase') {
        return playerId === state.activePlayerId && phase === 'upkeep';
    }
    if (action.timing === 'ownMainPhase') {
        return playerId === state.activePlayerId && (phase === 'main1' || phase === 'main2');
    }
    if (action.timing === 'anyMainPhase') {
        return phase === 'main1' || phase === 'main2';
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
    context: { responseWindowType?: DtResponseWindowType } = {},
): boolean {
    const passives = getPlayerPassiveAbilities(state, playerId);
    for (const passive of passives) {
        for (let i = 0; i < passive.actions.length; i++) {
            if (isPassiveActionUsable(state, playerId, passive.id, i, phase, context)) {
                return true;
            }
        }
    }
    return false;
}

/** 只识别明确要求玩家在维护阶段操作的被动动作。 */
export function hasUsableOwnUpkeepPassiveAction(
    state: DiceThroneCore,
    playerId: PlayerId,
): boolean {
    const passives = getPlayerPassiveAbilities(state, playerId);
    return passives.some((passive) => passive.actions.some((action, actionIndex) => (
        action.timing === 'ownUpkeepPhase'
        && isPassiveActionUsable(state, playerId, passive.id, actionIndex, 'upkeep')
    )));
}

/** 只识别能实际改变当前骰区的被动动作，用于决定是否要暂停奖励骰结算。 */
export function hasUsableDiceRerollPassiveAction(
    state: DiceThroneCore,
    playerId: PlayerId,
    phase: TurnPhase,
    context: { responseWindowType?: DtResponseWindowType } = {},
): boolean {
    const passives = getPlayerPassiveAbilities(state, playerId);
    return passives.some((passive) => passive.actions.some((action, actionIndex) => (
        action.type === 'rerollDie'
        && isPassiveActionUsable(state, playerId, passive.id, actionIndex, phase, context)
    )));
}
