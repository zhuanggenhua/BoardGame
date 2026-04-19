/**
 * 召唤师战争 - 技能执行器注册表入口
 *
 * 注册表实例在 registry.ts 中创建（避免循环依赖 TDZ），
 * 各派系执行器在各自文件中通过 import registry 注册。
 * 本文件负责统一导入派系文件（触发副作用注册）并 re-export 注册表。
 */

// 注册表 re-export
export { abilityExecutorRegistry } from './registry';

// 按派系注册执行器（import 触发副作用注册）
import './necromancer';
import './trickster';
import './goblin';
import './paladin';
import './frost';
import './barbaric';
