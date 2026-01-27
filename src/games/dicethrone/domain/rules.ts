/**
 * DiceThrone 共享规则
 * 供 UI 与 domain 层共用的纯函数
 */

import type { PlayerId, ResponseWindowType } from '../../../engine/types';
import { abilityManager, type AbilityContext } from '../../../systems/AbilitySystem';
import { isCustomActionCategory } from './effects';
import type {
    DiceThroneCore,
    Die,
    DieFace,
    TurnPhase,
    AbilityCard,
} from './types';
import { HAND_LIMIT, PHASE_ORDER } from './types';
import { RESOURCE_IDS } from './resources';

// ============================================================================
// 骰子规则
// ============================================================================

/**
 * 根据骰子值获取骰面类型
 * 优先使用 DiceSystem，兼容旧代码回退到硬编码映射
 */
export const getDieFace = (value: number): DieFace => {
    // 硬编码映射作为回退（兼容无 definitionId 的场景）
    if (value === 1 || value === 2) return 'fist';
    if (value === 3) return 'palm';
    if (value === 4 || value === 5) return 'taiji';
    return 'lotus';
};

/**
 * 统计活跃骰子的各骰面数量
 * 优先使用 die.symbol，回退到 getDieFace
 */
export const getFaceCounts = (dice: Die[]): Record<DieFace, number> => {
    return dice.reduce(
        (acc, die) => {
            // 优先使用已解析的 symbol，回退到 getDieFace
            const face = (die.symbol as DieFace) || getDieFace(die.value);
            acc[face] += 1;
            return acc;
        },
        { fist: 0, palm: 0, taiji: 0, lotus: 0 }
    );
};

/**
 * 获取活跃骰子（根据 rollDiceCount）
 */
export const getActiveDice = (state: DiceThroneCore): Die[] => {
    return state.dice.slice(0, state.rollDiceCount);
};

/**
 * 获取玩家某个 Token 的堆叠上限（支持技能永久提高上限，如莲花掌）
 * - player.tokenStackLimits 优先
 * - 回退到 tokenDefinitions.stackLimit
 * - stackLimit=0 表示无限
 */
export const getTokenStackLimit = (state: DiceThroneCore, playerId: PlayerId, tokenId: string): number => {
    const player = state.players[playerId];
    const override = player?.tokenStackLimits?.[tokenId];
    if (typeof override === 'number') {
        return override === 0 ? Infinity : override;
    }

    const def = state.tokenDefinitions.find(t => t.id === tokenId);
    const base = def?.stackLimit;
    if (base === 0) return Infinity;
    return base ?? 99;
};

// ============================================================================
// 玩家顺序规则
// ============================================================================

/**
 * 获取玩家顺序列表
 */
export const getPlayerOrder = (state: DiceThroneCore): PlayerId[] => {
    return Object.keys(state.players);
};

/**
 * 获取下一位玩家 ID
 */
export const getNextPlayerId = (state: DiceThroneCore): PlayerId => {
    const order = getPlayerOrder(state);
    const currentIndex = order.indexOf(state.activePlayerId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
    return order[nextIndex];
};

/**
 * 获取当前掷骰玩家 ID
 */
export const getRollerId = (state: DiceThroneCore): PlayerId => {
    if (state.turnPhase === 'defensiveRoll' && state.pendingAttack) {
        return state.pendingAttack.defenderId;
    }
    return state.activePlayerId;
};

// ============================================================================
// 阶段规则
// ============================================================================

/**
 * 检查是否可以推进阶段
 */
export const canAdvancePhase = (state: DiceThroneCore): boolean => {
    // 有待处理选择时不可推进
    // 注意：pendingChoice 已迁移到 sys.prompt，这里只检查领域层约束
    
    // 弃牌阶段手牌超限时不可推进
    if (state.turnPhase === 'discard') {
        const player = state.players[state.activePlayerId];
        if (player && player.hand.length > HAND_LIMIT) {
            return false;
        }
    }
    
    return true;
};

/**
 * 获取下一阶段
 */
export const getNextPhase = (state: DiceThroneCore): TurnPhase => {
    const currentIndex = PHASE_ORDER.indexOf(state.turnPhase);
    let nextPhase = PHASE_ORDER[(currentIndex + 1) % PHASE_ORDER.length];
    
    // 第一回合先手玩家跳过 income
    if (
        state.turnPhase === 'upkeep' &&
        state.turnNumber === 1 &&
        state.activePlayerId === state.startingPlayerId
    ) {
        nextPhase = 'main1';
    }
    
    // 进攻阶段结束后的分支
    if (state.turnPhase === 'offensiveRoll') {
        if (state.pendingAttack && state.pendingAttack.isDefendable) {
            nextPhase = 'defensiveRoll';
        } else {
            nextPhase = 'main2';
        }
    }
    
    // 弃牌阶段结束后切换玩家
    if (state.turnPhase === 'discard') {
        nextPhase = 'upkeep';
    }
    
    return nextPhase;
};

// ============================================================================
// 技能规则
// ============================================================================

/**
 * 获取当前可用的技能 ID 列表
 */
export const getAvailableAbilityIds = (
    state: DiceThroneCore,
    playerId: PlayerId
): string[] => {
    const player = state.players[playerId];
    if (!player) return [];
    
    const dice = getActiveDice(state);
    const diceValues = dice.map(d => d.value);
    const faceCounts = getFaceCounts(dice);

    const context: AbilityContext = {
        currentPhase: state.turnPhase,
        diceValues,
        faceCounts,
        resources: { cp: player.resources[RESOURCE_IDS.CP] ?? 0 },
        statusEffects: player.statusEffects,
    };

    // 根据阶段过滤技能类型
    const expectedType = state.turnPhase === 'defensiveRoll'
        ? 'defensive'
        : state.turnPhase === 'offensiveRoll'
            ? 'offensive'
            : undefined;

    // 注意：必须基于玩家当前 abilities（升级卡会替换此处定义）进行判定
    const available: string[] = [];

    for (const def of player.abilities) {
        if (expectedType && def.type !== expectedType) continue;

        if (def.variants?.length) {
            for (const variant of def.variants) {
                if (abilityManager.checkTrigger(variant.trigger, context)) {
                    available.push(variant.id);
                }
            }
            continue;
        }

        if (def.trigger && abilityManager.checkTrigger(def.trigger, context)) {
            available.push(def.id);
        }
    }

    return available;
};

// ============================================================================
// 卡牌规则
// ============================================================================

/** 卡牌打出检查结果 */
export type CardPlayCheckResult = 
    | { ok: true }
    | { ok: false; reason: CardPlayFailReason };

/** 卡牌打出失败原因（用于国际化 key，必须与 i18n 保持一致） */
export type CardPlayFailReason =
    | 'playerNotFound'
    | 'upgradeCardCannotPlay'      // 升级卡缺少目标技能
    | 'upgradeCardSkipLevel'       // 升级卡不能跳级（如 1→3）
    | 'upgradeCardMaxLevel'        // 技能已达到最高级
    | 'wrongPhaseForUpgrade'       // 升级卡只能在主要阶段
    | 'wrongPhaseForMain'          // 主要阶段卡只能在主要阶段
    | 'wrongPhaseForRoll'          // 投掷阶段卡只能在投掷阶段
    | 'notEnoughCp'                // CP 不足
    | 'unknownCardTiming'          // 未知卡牌时机
    | 'wrongPhaseForCard'          // 卡牌需要特定阶段（进攻/防御）
    | 'requireOwnTurn'             // 卡牌需要在自己回合打出
    | 'requireOpponentTurn'        // 卡牌需要在对手回合打出
    | 'requireIsRoller'            // 卡牌需要是当前投掷方
    | 'requireIsNotRoller'         // 卡牌需要不是当前投掷方（响应对手骰面）
    | 'requireHasRolled'           // 卡牌需要已经投掷过
    | 'requireDiceExists'          // 卡牌需要有骰子结果
    | 'requireOpponentDiceExists'  // 卡牌需要对手有骰子结果
    | 'requireRollConfirmed'       // 卡牌需要骰面已确认（响应对手确认后）
    | 'requireNotRollConfirmed';   // 骰面已确认，不能再打出该卡

/**
 * 从升级卡效果中提取目标技能 ID
 */
export const getUpgradeTargetAbilityId = (card: AbilityCard): string | null => {
    if (card.type !== 'upgrade' || !card.effects) return null;
    const replaceAction = card.effects.find(e => e.action?.type === 'replaceAbility')?.action;
    if (replaceAction?.type === 'replaceAbility' && replaceAction.targetAbilityId) {
        return replaceAction.targetAbilityId;
    }
    return null;
};

/**
 * 检查是否可以打出卡牌（返回详细原因）
 */
export const checkPlayCard = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard
): CardPlayCheckResult => {
    const player = state.players[playerId];
    if (!player) return { ok: false, reason: 'playerNotFound' };
    
    const phase = state.turnPhase;
    const playerCp = player.resources[RESOURCE_IDS.CP] ?? 0;
    
    // 升级卡：自动提取目标技能并验证
    if (card.type === 'upgrade') {
        if (phase !== 'main1' && phase !== 'main2') {
            return { ok: false, reason: 'wrongPhaseForUpgrade' };
        }
        
        const targetAbilityId = getUpgradeTargetAbilityId(card);
        if (!targetAbilityId) {
            return { ok: false, reason: 'upgradeCardCannotPlay' };
        }
        
        // 检查技能等级（必须逐级升级）
        const currentLevel = player.abilityLevels[targetAbilityId] ?? 1;
        const replaceAction = card.effects?.find(e => e.action?.type === 'replaceAbility')?.action;
        const desiredLevel = (replaceAction?.type === 'replaceAbility' ? replaceAction.newAbilityLevel : undefined) ?? (currentLevel + 1);
        if (currentLevel >= 3) {
            return { ok: false, reason: 'upgradeCardMaxLevel' };
        }
        if (desiredLevel !== currentLevel + 1) {
            return { ok: false, reason: 'upgradeCardSkipLevel' };
        }
        
        // 计算实际 CP 消耗
        const previousUpgradeCost = player.upgradeCardByAbilityId?.[targetAbilityId]?.cpCost;
        let actualCost = card.cpCost;
        if (previousUpgradeCost !== undefined && currentLevel > 1) {
            actualCost = Math.max(0, card.cpCost - previousUpgradeCost);
        }
        
        if (actualCost > 0 && playerCp < actualCost) {
            return { ok: false, reason: 'notEnoughCp' };
        }
        
        return { ok: true };
    }
    
    // 检查阶段
    if (card.timing === 'main') {
        if (phase !== 'main1' && phase !== 'main2') {
            return { ok: false, reason: 'wrongPhaseForMain' };
        }
    } else if (card.timing === 'roll') {
        if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') {
            return { ok: false, reason: 'wrongPhaseForRoll' };
        }
    } else if (card.timing !== 'instant') {
        return { ok: false, reason: 'unknownCardTiming' };
    }
    
    // 检查 CP
    if (card.cpCost > 0 && playerCp < card.cpCost) {
        return { ok: false, reason: 'notEnoughCp' };
    }
    
    // 检查卡牌的额外打出条件
    if (card.playCondition) {
        const cond = card.playCondition;
        
        // 检查特定阶段（进攻/防御）
        if (cond.phase && phase !== cond.phase) {
            return { ok: false, reason: 'wrongPhaseForCard' };
        }
        
        // 检查是否需要自己回合
        if (cond.requireOwnTurn && playerId !== state.activePlayerId) {
            return { ok: false, reason: 'requireOwnTurn' };
        }
        
        // 检查是否需要对手回合
        if (cond.requireOpponentTurn && playerId === state.activePlayerId) {
            return { ok: false, reason: 'requireOpponentTurn' };
        }
        
        // 检查是否需要是当前投掷方（防御阶段为防御方，进攻阶段为进攻方）
        if (cond.requireIsRoller && playerId !== getRollerId(state)) {
            return { ok: false, reason: 'requireIsRoller' };
        }
        
        // 检查是否需要不是当前投掷方（用于响应对手骰面确认，如"抬一手"）
        if (cond.requireIsNotRoller && playerId === getRollerId(state)) {
            return { ok: false, reason: 'requireIsNotRoller' };
        }
        
        // 检查是否已经投掷过
        if (cond.requireHasRolled && state.rollCount === 0) {
            return { ok: false, reason: 'requireHasRolled' };
        }
        
        // 检查是否有骰子结果
        if (cond.requireDiceExists && state.dice.length === 0) {
            return { ok: false, reason: 'requireDiceExists' };
        }
        
        // 检查最少骰子数量（用于需要多颗骰子才能触发的效果，如"俺也一样"需要2颗）
        if (cond.requireMinDiceCount && state.dice.length < cond.requireMinDiceCount) {
            return { ok: false, reason: 'requireDiceExists' };
        }
        
        // 检查对手是否有骰子结果（用于强制对手重掷）
        if (cond.requireOpponentDiceExists) {
            // 防御阶段时对手是防御方，进攻阶段时对手是进攻方
            // 这里简化处理：只要有骰子就算有
            if (state.dice.length === 0) {
                return { ok: false, reason: 'requireOpponentDiceExists' };
            }
        }
        
        // 检查骰面是否已确认（用于响应对手确认后的卡牌，如"抬一手"）
        if (cond.requireRollConfirmed && !state.rollConfirmed) {
            return { ok: false, reason: 'requireRollConfirmed' };
        }
        
        // 检查骰面是否未确认（用于增加投掷次数的卡牌）
        if (cond.requireNotRollConfirmed && state.rollConfirmed) {
            return { ok: false, reason: 'requireNotRollConfirmed' };
        }
    }
    
    return { ok: true };
};

/**
 * 检查是否可以打出卡牌（简化版，返回 boolean）
 * @deprecated 使用 checkPlayCard 获取详细原因
 */
export const canPlayCard = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard
): boolean => {
    return checkPlayCard(state, playerId, card).ok;
};

/** 升级卡打出失败原因 */
export type UpgradeCardPlayFailReason =
    | 'playerNotFound'
    | 'notUpgradeCard'
    | 'wrongPhaseForUpgrade'
    | 'upgradeCardCannotPlay'     // 升级卡缺少 replaceAbility 效果
    | 'upgradeCardTargetMismatch' // 目标技能不匹配
    | 'upgradeCardMaxLevel'
    | 'upgradeCardSkipLevel'
    | 'notEnoughCp';

/** 升级卡打出检查结果 */
export type UpgradeCardPlayCheckResult =
    | { ok: true }
    | { ok: false; reason: UpgradeCardPlayFailReason };

/**
 * 检查是否可以打出升级卡（返回详细原因）
 */
export const checkPlayUpgradeCard = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    targetAbilityId: string
): UpgradeCardPlayCheckResult => {
    const player = state.players[playerId];
    if (!player) return { ok: false, reason: 'playerNotFound' };
    
    // 必须是升级卡
    if (card.type !== 'upgrade') return { ok: false, reason: 'notUpgradeCard' };
    
    // 仅 Main Phase 可用
    if (state.turnPhase !== 'main1' && state.turnPhase !== 'main2') {
        return { ok: false, reason: 'wrongPhaseForUpgrade' };
    }

    // 升级卡必须带 replaceAbility 效果
    const replaceAction = card.effects?.find(e => e.action?.type === 'replaceAbility')?.action;
    if (!replaceAction || replaceAction.type !== 'replaceAbility') {
        return { ok: false, reason: 'upgradeCardCannotPlay' };
    }
    
    // 目标技能必须与拖拽目标一致
    if (!replaceAction.targetAbilityId || replaceAction.targetAbilityId !== targetAbilityId) {
        return { ok: false, reason: 'upgradeCardTargetMismatch' };
    }

    // 检查技能等级（必须逐级升级，不允许跳级）
    const currentLevel = player.abilityLevels[targetAbilityId] ?? 1;
    const desiredLevel = replaceAction.newAbilityLevel ?? Math.min(3, currentLevel + 1);
    if (currentLevel >= 3) {
        return { ok: false, reason: 'upgradeCardMaxLevel' };
    }
    if (desiredLevel !== currentLevel + 1) {
        return { ok: false, reason: 'upgradeCardSkipLevel' };
    }

    // 计算实际 CP 消耗
    const previousUpgradeCost = player.upgradeCardByAbilityId?.[targetAbilityId]?.cpCost;
    let actualCost = card.cpCost;
    if (previousUpgradeCost !== undefined && currentLevel > 1) {
        actualCost = Math.max(0, card.cpCost - previousUpgradeCost);
    }
    
    const playerCp = player.resources[RESOURCE_IDS.CP] ?? 0;
    if (actualCost > 0 && playerCp < actualCost) {
        return { ok: false, reason: 'notEnoughCp' };
    }
    
    return { ok: true };
};

/**
 * 检查是否可以打出升级卡（简化版，返回 boolean）
 * @deprecated 使用 checkPlayUpgradeCard 获取详细原因
 */
export const canPlayUpgradeCard = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    targetAbilityId: string
): boolean => {
    return checkPlayUpgradeCard(state, playerId, card, targetAbilityId).ok;
};

/**
 * 检查是否可以售卖卡牌
 */
export const canSellCard = (
    state: DiceThroneCore,
    playerId: PlayerId
): boolean => {
    // 仅当前玩家可售卖
    return playerId === state.activePlayerId;
};

/**
 * 检查是否可以撤回售卖
 */
export const canUndoSell = (
    state: DiceThroneCore,
    playerId: PlayerId
): boolean => {
    return playerId === state.activePlayerId && !!state.lastSoldCardId;
};

// ============================================================================
// 响应窗口检测
// ============================================================================

/**
 * 检查卡牌效果是否对对手生效
 * 用于决定打出卡牌后是否需要触发响应窗口
 */
export const hasOpponentTargetEffect = (card: AbilityCard): boolean => {
    if (!card.effects || card.effects.length === 0) return false;
    
    return card.effects.some(effect => {
        if (!effect.action) return false;
        return effect.action.target === 'opponent';
    });
};

/**
 * 检查卡牌在当前响应窗口类型下是否可用
 * 基于 windowType 和卡牌的 playCondition 精确检测
 */
export const isCardPlayableInResponseWindow = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    windowType: ResponseWindowType
): boolean => {
    // 升级卡不能在响应窗口打出
    if (card.type === 'upgrade') return false;
    
    const player = state.players[playerId];
    if (!player) return false;
    
    const playerCp = player.resources[RESOURCE_IDS.CP] ?? 0;
    if (card.cpCost > playerCp) return false;
    
    const phase = state.turnPhase;
    const isOwnTurn = playerId === state.activePlayerId;
    
    // 检查卡牌的基础 timing
    if (card.timing === 'main') {
        // 主要阶段卡不能在响应窗口打出
        return false;
    }
    
    if (card.timing === 'roll') {
        // 投掷阶段卡只能在投掷阶段的响应窗口打出
        if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') {
            return false;
        }
    }
    
    // instant 卡牌可以在任何响应窗口打出，但仍需检查 playCondition
    
    // 检查卡牌的 playCondition
    const cond = card.playCondition;
    if (cond) {
        // 检查特定阶段
        if (cond.phase && phase !== cond.phase) {
            return false;
        }
        
        // 检查是否需要自己回合
        if (cond.requireOwnTurn && !isOwnTurn) {
            return false;
        }
        
        // 检查是否需要对手回合
        if (cond.requireOpponentTurn && isOwnTurn) {
            return false;
        }
        
        // 检查是否需要是当前投掷方
        if (cond.requireIsRoller && playerId !== getRollerId(state)) {
            return false;
        }
        
        // 检查是否需要不是当前投掷方（用于响应对手骰面确认，如"抬一手"）
        if (cond.requireIsNotRoller && playerId === getRollerId(state)) {
            return false;
        }
        
        // 检查是否已经投掷过
        if (cond.requireHasRolled && state.rollCount === 0) {
            return false;
        }
        
        // 检查是否有骰子结果（例如"弹一手"需要有骰子才能改骰面）
        if (cond.requireDiceExists && state.dice.length === 0) {
            return false;
        }
        
        // 检查最少骰子数量（用于需要多颗骰子才能触发的效果）
        if (cond.requireMinDiceCount && state.dice.length < cond.requireMinDiceCount) {
            return false;
        }
        
        // 检查对手是否有骰子结果
        if (cond.requireOpponentDiceExists && state.dice.length === 0) {
            return false;
        }
        
        // 检查骰面是否已确认（用于响应对手确认后的卡牌，如"抬一手"）
        if (cond.requireRollConfirmed && !state.rollConfirmed) {
            return false;
        }
        
        // 检查骰面是否未确认（用于增加投掷次数的卡牌）
        if (cond.requireNotRollConfirmed && state.rollConfirmed) {
            return false;
        }
    }
    
    // ========== 响应窗口类型过滤规则 ==========
    // 设计原则：只有当卡牌效果能够对当前情境产生有意义的影响时，才允许在响应窗口中使用
    // 这样可以避免频繁打断游戏流程，同时保留关键的战术响应机会
    
    switch (windowType) {
        case 'afterRollConfirmed': {
            // 确认骰面后的响应窗口
            // 目的：允许对手在看到骰面后使用骰子修改卡
            // 限制：
            //   1. 只有具有骰子相关效果的 instant/roll 卡才能使用
            //   2. 卡牌必须能作用于对手骰子：
            //      - target='opponent' 的卡（强制修改对手骰子）
            //      - target='any' 的卡（可选择任意玩家的骰子）
            //      - target='self' 的卡不允许，因为此时场上是对手的骰子，没有合法目标
            //   3. 玩家必须是对手（非 rollerId）
            if (card.timing !== 'instant' && card.timing !== 'roll') {
                return false;
            }
            // 检查卡牌是否有骰子相关效果（通过元数据分类判断）
            if (!hasAnyDiceEffect(card)) {
                return false;
            }
            // 检查卡牌目标是否能作用于对手骰子
            const diceEffectTarget = getDiceEffectTarget(card);
            if (diceEffectTarget !== 'opponent' && diceEffectTarget !== 'any') {
                // 只允许 target='opponent' 或 target='any' 的卡牌
                // target='self' 的卡不允许，因为此时场上是对手的骰子
                return false;
            }
            // 检查玩家是否是对手
            const rollerId = getRollerId(state);
            const isRoller = playerId === rollerId;
            if (isRoller) {
                // rollerId 不能在响应窗口中出牌，应该在确认骰面前主动出牌
                return false;
            }
            break;
        }
            
        case 'preResolve':
            // @deprecated 已废弃 - 不再使用"最后机会"窗口设计
            // 设计原则：响应窗口必须有明确的效果覆盖，玩家想打牌应在防御阶段主动打出
            // 保留此 case 仅为类型完整性，实际不会触发
            return false;
            
        case 'afterCardPlayed':
            // 卡牌打出后的响应窗口
            // 目的：允许对手响应刚打出的卡牌效果
            // 限制：只有 instant 卡可以响应（快速反应）
            // 注意：响应窗口中打出的卡牌不会再触发新的响应窗口（避免无限嵌套）
            // TODO: 考虑限制为只有骰子/对手目标效果的 instant 卡才能响应
            if (card.timing !== 'instant') {
                return false;
            }
            break;
            
        case 'thenBreakpoint':
            // "然后" 断点响应窗口
            // 目的：在技能效果的 "then" 连接词处插入响应时机
            // 策略：允许 instant/roll 卡，因为是技能流程的关键断点
            // TODO: 考虑限制为只有响应效果的卡牌才能响应
            break;
    }
    
    return true;
};

/**
 * 检查卡牌是否有骰子相关效果
 * 
 * 通过元数据查询判断，不依赖命名约定
 * - 通用 action 类型：rollDie / modifyDie / rerollDie / grantExtraRoll / addRollCount / setDieValue
 * - custom action：通过 isCustomActionCategory(actionId, 'dice') 查询元数据
 */
const hasAnyDiceEffect = (card: AbilityCard): boolean => {
    if (!card.effects || card.effects.length === 0) return false;
    
    return card.effects.some(effect => {
        if (!effect.action) return false;
        const action = effect.action;
        
        // 通用骰子 action 类型（已实现 + 预留）
        // 注：预留类型待实现后添加 - rollDie, modifyDie, rerollDie, grantExtraRoll, addRollCount, setDieValue
        // 当前仅通过 custom action 实现骰子相关效果
        
        // custom action：通过元数据查询分类
        if (action.type === 'custom' && action.customActionId) {
            return isCustomActionCategory(action.customActionId, 'dice');
        }
        
        return false;
    });
};

/**
 * 获取卡牌骰子效果的目标
 * 返回 'self' / 'opponent' / 'any' / 'unknown'
 * 
 * 用于 afterRollConfirmed 响应窗口中检查卡牌是否可用：
 * - 'self' 的卡牌：只有骰子主人（rollerId）能用
 * - 'opponent' 的卡牌：只有对手能用
 * - 'any' 的卡牌：可以选择任意玩家的骰子
 */
const getDiceEffectTarget = (card: AbilityCard): 'self' | 'opponent' | 'any' | 'unknown' => {
    if (!card.effects || card.effects.length === 0) return 'unknown';
    
    // 查找第一个骰子相关效果的 target
    for (const effect of card.effects) {
        if (!effect.action) continue;
        const action = effect.action;
        
        // 检查是否是骰子效果
        if (action.type === 'custom' && action.customActionId) {
            if (isCustomActionCategory(action.customActionId, 'dice')) {
                // 返回效果目标
                if (action.target === 'self') return 'self';
                if (action.target === 'opponent') return 'opponent';
                if (action.target === 'any') return 'any';
            }
        }
    }
    
    return 'unknown';
};

/**
 * 检测玩家是否有可响应的内容（卡牌或消耗性状态效果）
 * 用于决定是否将玩家加入响应队列
 * 
 * @param state 游戏状态
 * @param playerId 要检测的玩家 ID
 * @param windowType 窗口类型
 * @param _sourceId 来源卡牌/技能 ID（预留）
 */
export const hasRespondableContent = (
    state: DiceThroneCore,
    playerId: PlayerId,
    windowType: ResponseWindowType,
    _sourceId?: string
): boolean => {
    const player = state.players[playerId];
    if (!player) return false;

    // 检查手牌中是否有可响应的卡牌
    for (const card of player.hand) {
        if (isCardPlayableInResponseWindow(state, playerId, card, windowType)) {
            return true;
        }
    }

    // 检查是否有可消耗的状态效果（timing=manual）
    for (const statusDef of state.statusDefinitions) {
        if (statusDef.timing !== 'manual') continue;
        const stacks = player.statusEffects[statusDef.id] ?? 0;
        if (stacks > 0) {
            return true;
        }
    }

    return false;
};

/**
 * 获取响应窗口的有效响应者队列
 * 只包含有可响应内容的玩家
 * 
 * @param state 游戏状态
 * @param windowType 窗口类型
 * @param triggerId 触发响应的玩家 ID（这个玩家在队列中排在最前）
 * @param sourceId 来源卡牌/技能 ID
 * @param excludeId 要排除的玩家 ID（通常是当前行动玩家，因为可以主动出牌）
 */
export const getResponderQueue = (
    state: DiceThroneCore,
    windowType: ResponseWindowType,
    triggerId: PlayerId,
    sourceId?: string,
    excludeId?: PlayerId
): PlayerId[] => {
    // 规则 4.4：终极技能行动锁定 - 对手不能采取任何行动
    // 影响的窗口：afterRollConfirmed
    if (state.pendingAttack?.isUltimate && windowType === 'afterRollConfirmed') {
        // 终极技能激活后，对手不能响应，返回空队列
        return [];
    }
    
    const allPlayers = Object.keys(state.players) as PlayerId[];
    const queue: PlayerId[] = [];
    
    // 触发者优先（如果有可响应内容且未被排除）
    if (triggerId !== excludeId && hasRespondableContent(state, triggerId, windowType, sourceId)) {
        queue.push(triggerId);
    }
    
    // 其他玩家（排除 excludeId）
    for (const pid of allPlayers) {
        if (pid === triggerId) continue;
        if (pid === excludeId) continue;
        if (hasRespondableContent(state, pid, windowType, sourceId)) {
            queue.push(pid);
        }
    }
    
    return queue;
};

// ============================================================================
// 权限检查
// ============================================================================

/**
 * 检查玩家是否有权执行操作
 */
export const isMoveAllowed = (
    playerId: PlayerId | null | undefined,
    expectedId: PlayerId | undefined
): boolean => {
    if (playerId === null || playerId === undefined) return true;
    return expectedId !== undefined && playerId === expectedId;
};
