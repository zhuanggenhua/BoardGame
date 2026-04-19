/**
 * 召唤师战争 - 技能执行器注册表（单例）
 *
 * 独立文件，不导入任何派系执行器，避免循环依赖导致 TDZ。
 */

import type { GameEvent } from '../../../../engine/types';
import { AbilityExecutorRegistry } from '../../../../engine/primitives/ability';
import type { SWAbilityContext } from './types';

/** 技能执行器注册表 */
export const abilityExecutorRegistry = new AbilityExecutorRegistry<SWAbilityContext, GameEvent>('sw-executors');
