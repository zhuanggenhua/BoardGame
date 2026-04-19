/**
 * Modifier 管线
 *
 * 通用的数值修改器系统，替代各游戏独立实现的 DamageModifier / PowerModifierFn / 硬编码属性修改。
 *
 * 执行顺序：按 priority 升序（小数字先执行），同优先级按添加顺序。
 * 类型执行顺序：flat → percent → override（同一 priority 内按此顺序）。
 *
 * 设计原则：
 * - 纯函数，不可变，返回新容器
 * - 泛型 TCtx 供 computeFn 使用，游戏层传入战斗上下文等
 * - 每游戏创建独立 ModifierStack，非全局单例
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 修改器类型 */
export type ModifierType = 'flat' | 'percent' | 'override' | 'compute';

/**
 * 修改器定义
 *
 * @typeParam TCtx 计算上下文类型（游戏层定义，如战斗上下文）
 */
export interface ModifierDef<TCtx = unknown> {
  /** 唯一标识 */
  id: string;
  /** 修改类型 */
  type: ModifierType;
  /**
   * 静态修改值（flat: +N / percent: *N%）
   * - flat: 加算（baseValue + value）
   * - percent: 乘算百分比（baseValue * (1 + value/100)），如 value=50 表示 +50%
   * - override: 直接覆盖为此值
   * - compute: 忽略此字段，使用 computeFn
   */
  value?: number;
  /**
   * 动态计算函数（type='compute' 时必填）
   *
   * 接收当前值和上下文，返回修改后的值。
   * 用于复杂场景（如 SmashUp 的 PowerModifierFn）。
   */
  computeFn?: (currentValue: number, ctx: TCtx) => number;
  /** 优先级（数字越小越先执行，默认 0） */
  priority?: number;
  /** 来源标识（如能力 ID、卡牌 ID） */
  source?: string;
  /** 剩余持续回合数（undefined = 永久） */
  duration?: number;
  /**
   * 条件函数 — 返回 false 时跳过此修改器
   *
   * 用于条件性修改（如"只在攻击火属性时生效"）
   */
  condition?: (ctx: TCtx) => boolean;
  /** 描述（调试/UI 用） */
  description?: string;
}

/** 修改器容器内部条目（附带插入顺序） */
interface ModifierEntry<TCtx = unknown> {
  def: ModifierDef<TCtx>;
  /** 插入序号，用于同优先级排序 */
  insertOrder: number;
}

/**
 * 修改器栈容器
 *
 * @typeParam TCtx 计算上下文类型
 */
export interface ModifierStack<TCtx = unknown> {
  /** 修改器列表 */
  readonly entries: ReadonlyArray<ModifierEntry<TCtx>>;
  /** 下一个插入序号 */
  readonly nextOrder: number;
}

/** applyModifiers 的结果 */
export interface ApplyResult {
  /** 最终值 */
  finalValue: number;
  /** 应用的修改器 ID 列表（按执行顺序） */
  appliedIds: string[];
  /** 被条件跳过的修改器 ID 列表 */
  skippedIds: string[];
}

/** tickModifiers 的结果 */
export interface TickModifiersResult<TCtx = unknown> {
  /** 更新后的栈 */
  stack: ModifierStack<TCtx>;
  /** 过期被移除的修改器 ID 列表 */
  expired: string[];
}

// ============================================================================
// 排序权重（同 priority 内按 type 排序）
// ============================================================================

const TYPE_ORDER: Record<ModifierType, number> = {
  flat: 0,
  percent: 1,
  compute: 2,
  override: 3,
};

/** 比较两个条目的执行顺序 */
function compareEntries<TCtx>(a: ModifierEntry<TCtx>, b: ModifierEntry<TCtx>): number {
  const priorityA = a.def.priority ?? 0;
  const priorityB = b.def.priority ?? 0;
  if (priorityA !== priorityB) return priorityA - priorityB;

  const typeA = TYPE_ORDER[a.def.type];
  const typeB = TYPE_ORDER[b.def.type];
  if (typeA !== typeB) return typeA - typeB;

  return a.insertOrder - b.insertOrder;
}

// ============================================================================
// 容器操作（纯函数）
// ============================================================================

/** 创建空修改器栈 */
export function createModifierStack<TCtx = unknown>(): ModifierStack<TCtx> {
  return { entries: [], nextOrder: 0 };
}

/** 添加修改器 */
export function addModifier<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
  def: ModifierDef<TCtx>,
): ModifierStack<TCtx> {
  // 检查重复 ID
  const filtered = stack.entries.filter(e => e.def.id !== def.id);
  const newEntry: ModifierEntry<TCtx> = {
    def,
    insertOrder: stack.nextOrder,
  };
  return {
    entries: [...filtered, newEntry],
    nextOrder: stack.nextOrder + 1,
  };
}

/** 批量添加修改器 */
export function addModifiers<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
  defs: ModifierDef<TCtx>[],
): ModifierStack<TCtx> {
  let current = stack;
  for (const def of defs) {
    current = addModifier(current, def);
  }
  return current;
}

/** 移除修改器 */
export function removeModifier<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
  id: string,
): ModifierStack<TCtx> {
  const filtered = stack.entries.filter(e => e.def.id !== id);
  if (filtered.length === stack.entries.length) return stack; // 未找到，返回原容器
  return { entries: filtered, nextOrder: stack.nextOrder };
}

/** 按来源移除所有修改器 */
export function removeModifiersBySource<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
  source: string,
): ModifierStack<TCtx> {
  const filtered = stack.entries.filter(e => e.def.source !== source);
  if (filtered.length === stack.entries.length) return stack;
  return { entries: filtered, nextOrder: stack.nextOrder };
}

// ============================================================================
// 查询
// ============================================================================

/** 获取修改器定义 */
export function getModifier<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
  id: string,
): ModifierDef<TCtx> | undefined {
  return stack.entries.find(e => e.def.id === id)?.def;
}

/** 按来源查询修改器 */
export function getModifiersBySource<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
  source: string,
): ModifierDef<TCtx>[] {
  return stack.entries
    .filter(e => e.def.source === source)
    .map(e => e.def);
}

/** 获取所有修改器定义 */
export function getAllModifiers<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
): ModifierDef<TCtx>[] {
  return stack.entries.map(e => e.def);
}

/** 获取修改器数量 */
export function getModifierCount<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
): number {
  return stack.entries.length;
}

// ============================================================================
// 管线执行
// ============================================================================

/**
 * 执行修改器管线
 *
 * 按 priority 排序后依次应用：
 * 1. flat: baseValue += value
 * 2. percent: baseValue *= (1 + value/100)
 * 3. compute: baseValue = computeFn(baseValue, ctx)
 * 4. override: baseValue = value
 *
 * 有 condition 的修改器会先检查条件，不满足则跳过。
 */
export function applyModifiers<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
  baseValue: number,
  ctx?: TCtx,
): ApplyResult {
  // 排序
  const sorted = [...stack.entries].sort(compareEntries);

  let currentValue = baseValue;
  const appliedIds: string[] = [];
  const skippedIds: string[] = [];

  for (const entry of sorted) {
    const { def } = entry;

    // 检查条件
    if (def.condition && ctx !== undefined) {
      if (!def.condition(ctx)) {
        skippedIds.push(def.id);
        continue;
      }
    }

    // 应用修改
    switch (def.type) {
      case 'flat':
        currentValue += def.value ?? 0;
        break;
      case 'percent':
        currentValue *= 1 + (def.value ?? 0) / 100;
        break;
      case 'compute':
        if (def.computeFn && ctx !== undefined) {
          currentValue = def.computeFn(currentValue, ctx);
        }
        break;
      case 'override':
        if (def.value !== undefined) {
          currentValue = def.value;
        }
        break;
    }

    appliedIds.push(def.id);
  }

  return { finalValue: currentValue, appliedIds, skippedIds };
}

/**
 * 简化版 applyModifiers — 只返回最终值
 */
export function computeModifiedValue<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
  baseValue: number,
  ctx?: TCtx,
): number {
  return applyModifiers(stack, baseValue, ctx).finalValue;
}

// ============================================================================
// 回合结算
// ============================================================================

/**
 * 回合结算 — 扣减所有有限持续时间的修改器，到期的自动移除
 */
export function tickModifiers<TCtx = unknown>(
  stack: ModifierStack<TCtx>,
): TickModifiersResult<TCtx> {
  const expired: string[] = [];
  const remaining: ModifierEntry<TCtx>[] = [];

  for (const entry of stack.entries) {
    if (entry.def.duration === undefined) {
      // 永久修改器不受影响
      remaining.push(entry);
      continue;
    }

    const newDuration = entry.def.duration - 1;
    if (newDuration <= 0) {
      expired.push(entry.def.id);
    } else {
      remaining.push({
        ...entry,
        def: { ...entry.def, duration: newDuration },
      });
    }
  }

  return {
    stack: { entries: remaining, nextOrder: stack.nextOrder },
    expired,
  };
}
