/**
 * 通用游戏系统模块导出
 */

// 注意：StatusEffectSystem 与 AbilitySystem 都定义了 EffectTiming。
// 为避免在聚合导出中产生命名冲突，这里显式导出 StatusEffectSystem 的成员（不导出 EffectTiming）。
export {
    StatusEffectManager,
    statusEffectManager,
    type StatusEffectDef,
    type StatusEffectInstance,
    type EffectAction,
    type EffectType,
    type RollDieConditionalEffect,
} from './StatusEffectSystem';

// AbilitySystem 仍按原样导出
export * from './AbilitySystem/index';
