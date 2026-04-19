/**
 * UI 提示系统（引擎层）
 *
 * 提供通用的"可交互实体"查询接口，游戏层实现具体逻辑。
 *
 * 设计原则：
 * - 轻量级：只定义类型和接口，不包含具体实现
 * - 游戏驱动：游戏层实现 getUIHints() 函数
 * - 可选使用：游戏可以选择不使用此系统
 *
 * 使用场景：
 * - 显示"可移动/攻击的单位"（绿色边框）
 * - 显示"可使用技能的单位"（青色波纹）
 * - 显示"可放置卡牌的位置"（高亮格子）
 * - 显示"可选择的目标"（闪烁效果）
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 位置坐标（通用）
 */
export interface Position {
  row: number;
  col: number;
}

/**
 * UI 提示类型
 */
export type UIHintType =
  | 'actionable'    // 可执行操作（移动/攻击）
  | 'ability'       // 可使用技能
  | 'target'        // 可选择目标
  | 'placement'     // 可放置位置
  | 'selection';    // 可选择实体

/**
 * UI 提示定义
 */
export interface UIHint {
  /** 提示类型 */
  type: UIHintType;
  /** 实体位置 */
  position: Position;
  /** 实体 ID（可选） */
  entityId?: string;
  /** 可用的操作列表（可选） */
  actions?: string[];
  /** 额外元数据（游戏特定） */
  meta?: Record<string, unknown>;
}

/**
 * UI 提示过滤器
 */
export interface UIHintFilter {
  /** 只返回指定类型的提示 */
  types?: UIHintType[];
  /** 只返回指定阶段的提示 */
  phase?: string;
  /** 只返回指定玩家的提示 */
  playerId?: string;
  /** 游戏特定过滤条件 */
  custom?: Record<string, unknown>;
}

// ============================================================================
// 游戏层接口
// ============================================================================

/**
 * UI 提示提供者接口
 *
 * 游戏层实现此接口，提供可交互实体的查询功能。
 *
 * 使用示例：
 * ```typescript
 * // 游戏层实现
 * export function getSummonerWarsUIHints(
 *   core: SummonerWarsCore,
 *   filter?: UIHintFilter
 * ): UIHint[] {
 *   const hints: UIHint[] = [];
 *   const pid = filter?.playerId as PlayerId;
 *   const phase = filter?.phase ?? core.phase;
 *
 *   // 可移动/攻击的单位
 *   if (!filter?.types || filter.types.includes('actionable')) {
 *     hints.push(...getActionableUnitHints(core, pid, phase));
 *   }
 *
 *   // 可使用技能的单位
 *   if (!filter?.types || filter.types.includes('ability')) {
 *     hints.push(...getAbilityReadyHints(core, pid, phase));
 *   }
 *
 *   return hints;
 * }
 *
 * // UI 层使用
 * const hints = getSummonerWarsUIHints(core, {
 *   types: ['ability'],
 *   playerId: myPlayerId,
 *   phase: currentPhase,
 * });
 *
 * const abilityReadyPositions = hints.map(h => h.position);
 * ```
 */
export type UIHintProvider<TCore = unknown> = (
  core: TCore,
  filter?: UIHintFilter
) => UIHint[];

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 过滤 UI 提示
 *
 * @param hints  提示列表
 * @param filter 过滤器
 * @returns      过滤后的提示列表
 */
export function filterUIHints(
  hints: UIHint[],
  filter?: UIHintFilter
): UIHint[] {
  if (!filter) return hints;

  let result = hints;

  // 按类型过滤
  if (filter.types && filter.types.length > 0) {
    const typeSet = new Set(filter.types);
    result = result.filter(h => typeSet.has(h.type));
  }

  return result;
}

/**
 * 按类型分组 UI 提示
 *
 * @param hints 提示列表
 * @returns     按类型分组的提示 Map
 */
export function groupUIHintsByType(
  hints: UIHint[]
): Map<UIHintType, UIHint[]> {
  const groups = new Map<UIHintType, UIHint[]>();

  for (const hint of hints) {
    const group = groups.get(hint.type) ?? [];
    group.push(hint);
    groups.set(hint.type, group);
  }

  return groups;
}

/**
 * 提取位置列表
 *
 * @param hints 提示列表
 * @returns     位置列表
 */
export function extractPositions(hints: UIHint[]): Position[] {
  return hints.map(h => h.position);
}
