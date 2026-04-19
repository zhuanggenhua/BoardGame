/**
 * DiceThrone 战斗技能管理器
 * 
 * 使用通用的战斗预设系统，不再依赖旧 AbilitySystem。
 */

import { createCombatAbilityManager, type CombatAbilityManager } from './combat';

/**
 * 全局战斗技能管理器实例（延迟初始化以避免循环依赖）
 *
 * 注意：DiceThrone 的技能定义存储在玩家状态中，
 * 管理器仅负责条件判断与时机计算，不维护技能注册表。
 */
let _combatAbilityManager: CombatAbilityManager | null = null;

export const combatAbilityManager = {
  get instance(): CombatAbilityManager {
    if (!_combatAbilityManager) {
      _combatAbilityManager = createCombatAbilityManager();
    }
    return _combatAbilityManager;
  }
};
