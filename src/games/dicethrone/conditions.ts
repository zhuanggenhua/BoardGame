/**
 * DiceThrone 游戏特定条件注册
 * 
 * 框架层不再默认注册游戏特定条件，由游戏层显式注册。
 * 此文件在游戏初始化时执行一次。
 */

import {
    conditionRegistry,
    evaluateDiceSet,
    evaluateSmallStraight,
    evaluateLargeStraight,
    evaluatePhase,
} from '../../systems/AbilitySystem';

let registered = false;

/**
 * 注册 DiceThrone 用到的技能触发条件
 * 此函数幂等，多次调用不会重复注册
 */
export function registerDiceThroneConditions(): void {
    if (registered) return;
    registered = true;

    // 显式注册游戏扩展条件（框架层不默认启用）
    conditionRegistry.register('diceSet', evaluateDiceSet);
    conditionRegistry.register('smallStraight', evaluateSmallStraight);
    conditionRegistry.register('largeStraight', evaluateLargeStraight);
    conditionRegistry.register('phase', evaluatePhase);
}
