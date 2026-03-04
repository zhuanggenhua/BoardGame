/**
 * 召唤师战争 - 交互模式类型定义
 *
 * 事件卡/技能多步骤交互模式的共享类型，
 * 由 useCellInteraction、useEventCardModes、StatusBanners 共用。
 */

import type { CellCoord, EventCard } from '../domain/types';

// ============================================================================
// 事件卡模式
// ============================================================================

/** 事件卡目标选择模式 */
export interface EventTargetModeState {
  cardId: string;
  card: EventCard;
  validTargets: CellCoord[];
}

/** 心灵操控多目标选择模式 */
export interface MindControlModeState {
  cardId: string;
  validTargets: CellCoord[]; // 召唤师2格内的敌方士兵/冠军
  selectedTargets: CellCoord[];
}

/** 交缠颂歌双目标选择模式 */
export interface ChantEntanglementModeState {
  cardId: string;
  validTargets: CellCoord[]; // 召唤师3格内的友方士兵
  selectedTargets: CellCoord[]; // 最多2个
}

/** 撤退模式：选费用→选目标位置 */
export interface WithdrawModeState {
  sourceUnitId: string;
  step: 'selectCost' | 'selectPosition';
  costType?: 'charge' | 'magic';
}

/** 冰川位移多步骤模式：选建筑→选目标位置，循环，最多3个 */
export interface GlacialShiftModeState {
  cardId: string;
  step: 'selectBuilding' | 'selectDestination';
  validBuildings: CellCoord[]; // 召唤师3格内友方建筑
  currentBuilding?: CellCoord;
  recorded: { position: CellCoord; newPosition: CellCoord }[];
}

/** 潜行多步骤模式：选单位→选方向，循环 */
export interface SneakModeState {
  cardId: string;
  step: 'selectUnit' | 'selectDirection';
  validUnits: CellCoord[]; // 所有0费友方非召唤师
  currentUnit?: CellCoord; // 当前选中的单位
  recorded: { position: CellCoord; newPosition: CellCoord }[]; // 已记录的移动
}

/** 震慑目标+终点选择模式 */
export interface StunModeState {
  step: 'selectTarget' | 'selectDestination';
  cardId: string;
  validTargets: CellCoord[]; // 召唤师3格直线内的敌方士兵/冠军
  targetPosition?: CellCoord;
  /** selectDestination 步骤：所有可达终点（附带方向向量和距离） */
  destinations?: { position: CellCoord; moveRow: number; moveCol: number; distance: number }[];
}

/** 催眠引诱目标选择模式 */
export interface HypnoticLureModeState {
  cardId: string;
  validTargets: CellCoord[]; // 所有敌方士兵/冠军
}

// ============================================================================
// 技能模式
// ============================================================================

/** 攻击前待处理能力 */
export interface PendingBeforeAttack {
  abilityId: 'life_drain' | 'holy_arrow' | 'healing';
  sourceUnitId: string;
  targetUnitId?: string;
  targetCardId?: string;
  discardCardIds?: string[];
}

/** 念力推拉方向选择模式（棋盘点击终点） */
export interface TelekinesisTargetModeState {
  abilityId: 'telekinesis' | 'high_telekinesis' | 'high_telekinesis_instead' | 'telekinesis_instead';
  sourceUnitId: string;
  sourcePosition?: CellCoord;
  targetPosition: CellCoord;
  /** 所有可达终点（附带方向向量），供棋盘高亮和 dispatch 使用 */
  destinations: { position: CellCoord; moveRow: number; moveCol: number }[];
}

/** 连续射击确认模式 */
export interface RapidFireModeState {
  sourceUnitId: string;
  sourcePosition: CellCoord;
}
