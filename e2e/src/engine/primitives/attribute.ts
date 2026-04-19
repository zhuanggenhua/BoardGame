/**
 * 属性系统（AttributeSet）
 *
 * 提供 base value + modifier stack → current value 的属性管理。
 * 与 modifier.ts 集成：每个属性维护自己的 ModifierStack。
 *
 * 设计原则：
 * - 纯函数，不可变，返回新容器
 * - 与 resources.ts 互补：resources 管消耗品（MP/金币），attribute 管可被 buff 修改的属性（攻击力/移动力）
 * - 每游戏创建独立 AttributeSet，非全局单例
 */

import type { ModifierDef, ModifierStack } from './modifier';
import {
  createModifierStack,
  addModifier as addMod,
  removeModifier as removeMod,
  removeModifiersBySource as removeModsBySource,
  applyModifiers,
  tickModifiers,
} from './modifier';

// ============================================================================
// 类型定义
// ============================================================================

/** 属性定义 */
export interface AttributeDef {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 初始基础值 */
  initialValue: number;
  /** 最小值（应用 modifier 后的下限） */
  min?: number;
  /** 最大值（应用 modifier 后的上限） */
  max?: number;
}

/** 单个属性的运行时状态 */
export interface AttributeState<TCtx = unknown> {
  /** 基础值 */
  baseValue: number;
  /** 属性定义（不变引用） */
  def: AttributeDef;
  /** 修改器栈 */
  modifiers: ModifierStack<TCtx>;
}

/** 属性集合容器 */
export interface AttributeSet<TCtx = unknown> {
  /** 属性 ID → 运行时状态 */
  readonly attributes: Readonly<Record<string, AttributeState<TCtx>>>;
}

/** tickAttributeModifiers 的结果 */
export interface TickAttributeResult<TCtx = unknown> {
  /** 更新后的属性集合 */
  set: AttributeSet<TCtx>;
  /** 各属性过期的修改器 { attrId: expiredModIds[] } */
  expired: Record<string, string[]>;
}

// ============================================================================
// 创建
// ============================================================================

/** 从属性定义列表创建属性集合 */
export function createAttributeSet<TCtx = unknown>(
  defs: AttributeDef[],
): AttributeSet<TCtx> {
  const attributes: Record<string, AttributeState<TCtx>> = {};
  for (const def of defs) {
    attributes[def.id] = {
      baseValue: def.initialValue,
      def,
      modifiers: createModifierStack<TCtx>(),
    };
  }
  return { attributes };
}

// ============================================================================
// 基础值操作
// ============================================================================

/** 获取属性基础值 */
export function getBase<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
): number {
  const state = set.attributes[attrId];
  if (!state) {
    console.warn(`[AttributeSet] 属性 "${attrId}" 不存在`);
    return 0;
  }
  return state.baseValue;
}

/** 设置属性基础值 */
export function setBase<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
  value: number,
): AttributeSet<TCtx> {
  const state = set.attributes[attrId];
  if (!state) {
    console.warn(`[AttributeSet] 属性 "${attrId}" 不存在`);
    return set;
  }
  return {
    attributes: {
      ...set.attributes,
      [attrId]: { ...state, baseValue: value },
    },
  };
}

/** 修改属性基础值（增减） */
export function modifyBase<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
  delta: number,
): AttributeSet<TCtx> {
  const state = set.attributes[attrId];
  if (!state) {
    console.warn(`[AttributeSet] 属性 "${attrId}" 不存在`);
    return set;
  }
  return setBase(set, attrId, state.baseValue + delta);
}

// ============================================================================
// 当前值计算
// ============================================================================

/**
 * 获取属性当前值（base + modifiers，钳制到 min/max）
 *
 * 每次调用都会重新计算（无缓存），适合在需要时调用。
 * 如果需要频繁访问，调用方可自行缓存结果。
 */
export function getCurrent<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
  ctx?: TCtx,
): number {
  const state = set.attributes[attrId];
  if (!state) {
    console.warn(`[AttributeSet] 属性 "${attrId}" 不存在`);
    return 0;
  }

  const { finalValue } = applyModifiers(state.modifiers, state.baseValue, ctx);

  // 钳制到边界
  let result = finalValue;
  if (state.def.min !== undefined && result < state.def.min) {
    result = state.def.min;
  }
  if (state.def.max !== undefined && result > state.def.max) {
    result = state.def.max;
  }

  return result;
}

/**
 * 批量获取所有属性的当前值
 */
export function getAllCurrent<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  ctx?: TCtx,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const attrId of Object.keys(set.attributes)) {
    result[attrId] = getCurrent(set, attrId, ctx);
  }
  return result;
}

// ============================================================================
// 修改器管理
// ============================================================================

/** 为属性添加修改器 */
export function addAttributeModifier<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
  modifier: ModifierDef<TCtx>,
): AttributeSet<TCtx> {
  const state = set.attributes[attrId];
  if (!state) {
    console.warn(`[AttributeSet] 属性 "${attrId}" 不存在`);
    return set;
  }
  return {
    attributes: {
      ...set.attributes,
      [attrId]: {
        ...state,
        modifiers: addMod(state.modifiers, modifier),
      },
    },
  };
}

/** 移除属性的修改器 */
export function removeAttributeModifier<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
  modifierId: string,
): AttributeSet<TCtx> {
  const state = set.attributes[attrId];
  if (!state) {
    console.warn(`[AttributeSet] 属性 "${attrId}" 不存在`);
    return set;
  }
  return {
    attributes: {
      ...set.attributes,
      [attrId]: {
        ...state,
        modifiers: removeMod(state.modifiers, modifierId),
      },
    },
  };
}

/** 按来源移除属性的所有修改器 */
export function removeAttributeModifiersBySource<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
  source: string,
): AttributeSet<TCtx> {
  const state = set.attributes[attrId];
  if (!state) {
    console.warn(`[AttributeSet] 属性 "${attrId}" 不存在`);
    return set;
  }
  return {
    attributes: {
      ...set.attributes,
      [attrId]: {
        ...state,
        modifiers: removeModsBySource(state.modifiers, source),
      },
    },
  };
}

/**
 * 按来源移除所有属性上的修改器
 *
 * 用于移除某个 buff/技能施加的所有属性修改
 */
export function removeAllModifiersBySource<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  source: string,
): AttributeSet<TCtx> {
  const attributes: Record<string, AttributeState<TCtx>> = {};
  let changed = false;

  for (const [attrId, state] of Object.entries(set.attributes)) {
    const newModifiers = removeModsBySource(state.modifiers, source);
    if (newModifiers !== state.modifiers) {
      attributes[attrId] = { ...state, modifiers: newModifiers };
      changed = true;
    } else {
      attributes[attrId] = state;
    }
  }

  return changed ? { attributes } : set;
}

// ============================================================================
// 回合结算
// ============================================================================

/** 回合结算 — 对所有属性的修改器执行 tick */
export function tickAttributeModifiers<TCtx = unknown>(
  set: AttributeSet<TCtx>,
): TickAttributeResult<TCtx> {
  const attributes: Record<string, AttributeState<TCtx>> = {};
  const expired: Record<string, string[]> = {};

  for (const [attrId, state] of Object.entries(set.attributes)) {
    const result = tickModifiers(state.modifiers);
    if (result.expired.length > 0) {
      expired[attrId] = result.expired;
      attributes[attrId] = { ...state, modifiers: result.stack };
    } else {
      attributes[attrId] = state;
    }
  }

  return { set: { attributes }, expired };
}

// ============================================================================
// 查询
// ============================================================================

/** 获取属性定义 */
export function getAttributeDef<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
): AttributeDef | undefined {
  return set.attributes[attrId]?.def;
}

/** 获取所有属性 ID */
export function getAttributeIds<TCtx = unknown>(
  set: AttributeSet<TCtx>,
): string[] {
  return Object.keys(set.attributes);
}

/** 检查属性是否存在 */
export function hasAttribute<TCtx = unknown>(
  set: AttributeSet<TCtx>,
  attrId: string,
): boolean {
  return attrId in set.attributes;
}
