/**
 * DiceThrone 共享规则
 * 供 UI 与 domain 层共用的纯函数
 */

import type { PlayerId } from '../../../engine/types';
import { abilityManager, type AbilityContext } from '../../../systems/AbilitySystem';
import type {
    DiceThroneCore,
    Die,
    DieFace,
    TurnPhase,
    AbilityCard,
} from './types';
import { HAND_LIMIT, PHASE_ORDER } from './types';

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
        resources: { cp: player.cp },
        statusEffects: player.statusEffects,
    };

    const abilityIds = player.abilities.map(a => a.id);
    
    // 根据阶段过滤技能类型
    const expectedType = state.turnPhase === 'defensiveRoll'
        ? 'defensive'
        : state.turnPhase === 'offensiveRoll'
            ? 'offensive'
            : undefined;
            
    const filteredAbilityIds = expectedType
        ? abilityIds.filter(id => abilityManager.getDefinition(id)?.type === expectedType)
        : abilityIds;
    
    return abilityManager.getAvailableAbilities(filteredAbilityIds, context);
};

// ============================================================================
// 卡牌规则
// ============================================================================

/**
 * 检查是否可以打出卡牌
 */
export const canPlayCard = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard
): boolean => {
    const player = state.players[playerId];
    if (!player) return false;
    
    // 升级卡走单独流程
    if (card.type === 'upgrade') return false;
    
    // 检查 CP
    if (player.cp < card.cpCost) return false;
    
    // 检查时机
    const phase = state.turnPhase;
    const validTiming =
        (card.timing === 'main' && (phase === 'main1' || phase === 'main2')) ||
        (card.timing === 'roll' && (phase === 'offensiveRoll' || phase === 'defensiveRoll')) ||
        card.timing === 'instant';
    
    return validTiming;
};

/**
 * 检查是否可以打出升级卡
 */
export const canPlayUpgradeCard = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    targetAbilityId: string
): boolean => {
    const player = state.players[playerId];
    if (!player) return false;
    
    // 仅 Main Phase 可用
    if (state.turnPhase !== 'main1' && state.turnPhase !== 'main2') return false;
    
    // 必须是升级卡
    if (card.type !== 'upgrade') return false;
    
    // 检查技能等级
    const currentLevel = player.abilityLevels[targetAbilityId] ?? 1;
    if (currentLevel >= 3) return false;
    
    // 计算实际 CP 消耗
    let actualCost = card.cpCost;
    if (currentLevel === 2 && card.cpCost > 3) {
        actualCost = card.cpCost - 3;
    }
    
    return player.cp >= actualCost;
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
