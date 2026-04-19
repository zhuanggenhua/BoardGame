/**
 * 召唤师战争 - 技能执行器类型定义
 */

import type { AbilityContext } from '../../../../engine/primitives/ability';
import type { SummonerWarsCore, PlayerId, BoardUnit, CellCoord } from '../types';

/**
 * SummonerWars 技能执行上下文
 *
 * 扩展引擎层 AbilityContext，添加游戏特有字段。
 */
export interface SWAbilityContext extends AbilityContext {
  /** 当前游戏状态 */
  core: SummonerWarsCore;
  /** 技能来源单位 */
  sourceUnit: BoardUnit;
  /** 来源单位位置 */
  sourcePosition: CellCoord;
  /** 命令 payload（包含目标选择等参数） */
  payload: Record<string, unknown>;
}
