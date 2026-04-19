/**
 * 骰子操作工具函数
 *
 * 从 systems/DiceSystem 提取为纯函数 API。
 * 骰子定义由游戏层作为常量提供，不使用全局注册器。
 *
 * 设计原则：
 * - 纯函数，不可变
 * - randomFn 由调用者注入（支持确定性随机和测试 mock）
 * - 不使用 class/singleton
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 随机函数接口 */
export interface RandomFn {
  /** 返回 1~sides 的整数 */
  d: (sides: number) => number;
}

/** 骰面定义 */
export interface DieFaceDefinition {
  /** 点数（1-N，用于数值计算、顺子判断） */
  value: number;
  /** 符号列表（可多个，同符号重复表示数量） */
  symbols: string[];
  /** 图标资源路径（可选） */
  icon?: string;
}

/** 骰子定义（模板） */
export interface DiceDefinition {
  /** 唯一标识 */
  id: string;
  /** 显示名称（可选） */
  name?: string;
  /** 面数 */
  sides: number;
  /** 各面定义（长度应等于 sides） */
  faces: DieFaceDefinition[];
  /** 分类标签（用于骰子池筛选） */
  category?: string;
  /** 视觉资源 */
  assets?: {
    /** 精灵图/贴图 */
    spriteSheet?: string;
  };
}

/** 骰子实例（运行时状态） */
export interface Die {
  /** 实例 ID */
  id: number;
  /** 骰子定义 ID */
  definitionId: string;
  /** 当前点数 */
  value: number;
  /** 当前主符号 */
  symbol: string | null;
  /** 当前所有符号 */
  symbols: string[];
  /** 是否锁定（保留不重掷） */
  isKept: boolean;
}

/** 掷骰统计 */
export interface RollStats {
  /** 点数总和 */
  total: number;
  /** 符号计数 */
  symbolCounts: Record<string, number>;
  /** 点数计数（用于判断 N 个相同） */
  valueCounts: Record<number, number>;
  /** 是否有小顺（4 个连续） */
  hasSmallStraight: boolean;
  /** 是否有大顺（5 个连续） */
  hasLargeStraight: boolean;
  /** 最大相同点数数量 */
  maxOfAKind: number;
}

/** 掷骰结果 */
export interface RollResult {
  /** 掷骰后的骰子列表 */
  dice: Die[];
  /** 统计信息 */
  stats: RollStats;
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 生成随机点数 (1 到 sides) */
function randomValue(sides: number, random?: RandomFn): number {
  if (random) return random.d(sides);
  return Math.floor(Math.random() * sides) + 1;
}

/** 根据点数获取骰面定义 */
export function getFaceByValue(
  definition: DiceDefinition,
  value: number,
): DieFaceDefinition | undefined {
  return definition.faces.find(f => f.value === value);
}

/** 检查是否有 N 个连续数字 */
function checkStraight(values: Set<number>, length: number): boolean {
  const sorted = Array.from(values).sort((a, b) => a - b);
  for (let i = 0; i <= sorted.length - length; i++) {
    let consecutive = true;
    for (let j = 1; j < length; j++) {
      if (sorted[i + j] !== sorted[i] + j) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) return true;
  }
  return false;
}

// ============================================================================
// 核心操作
// ============================================================================

/** 创建骰子实例 */
export function createDie(
  definition: DiceDefinition,
  id: number,
  options?: { initialValue?: number; isKept?: boolean },
  random?: RandomFn,
): Die {
  const value = options?.initialValue ?? randomValue(definition.sides, random);
  const face = getFaceByValue(definition, value);
  const symbols = face?.symbols ?? [];

  return {
    id,
    definitionId: definition.id,
    value,
    symbol: symbols[0] ?? null,
    symbols,
    isKept: options?.isKept ?? false,
  };
}

/** 掷单个骰子（返回新骰子，不修改原骰子） */
export function rollDie(
  die: Die,
  definition: DiceDefinition,
  random?: RandomFn,
): Die {
  if (die.isKept) return die; // 锁定的骰子不重掷

  const value = randomValue(definition.sides, random);
  const face = getFaceByValue(definition, value);
  const symbols = face?.symbols ?? [];

  return {
    ...die,
    value,
    symbol: symbols[0] ?? null,
    symbols,
  };
}

/** 批量掷骰（返回掷骰结果，锁定的骰子保持不变） */
export function rollDice(
  dice: Die[],
  definition: DiceDefinition,
  random?: RandomFn,
): RollResult {
  const rolledDice = dice.map(d => rollDie(d, definition, random));
  const stats = calculateDiceStats(rolledDice);
  return { dice: rolledDice, stats };
}

/** 计算骰子统计信息 */
export function calculateDiceStats(dice: Die[]): RollStats {
  const symbolCounts: Record<string, number> = {};
  const valueCounts: Record<number, number> = {};
  let total = 0;

  for (const die of dice) {
    total += die.value;
    valueCounts[die.value] = (valueCounts[die.value] ?? 0) + 1;
    for (const symbol of die.symbols) {
      symbolCounts[symbol] = (symbolCounts[symbol] ?? 0) + 1;
    }
  }

  const maxOfAKind = Math.max(0, ...Object.values(valueCounts));
  const values = new Set(dice.map(d => d.value));
  const hasSmallStraight = checkStraight(values, 4);
  const hasLargeStraight = checkStraight(values, 5);

  return {
    total,
    symbolCounts,
    valueCounts,
    hasSmallStraight,
    hasLargeStraight,
    maxOfAKind,
  };
}

// ============================================================================
// 触发条件检查
// ============================================================================

/** 检查符号组合是否满足要求 */
export function checkSymbolsTrigger(
  symbolCounts: Record<string, number>,
  required: Record<string, number>,
): boolean {
  return Object.entries(required).every(
    ([symbol, count]) => (symbolCounts[symbol] ?? 0) >= count,
  );
}

/** 检查点数总和是否在范围内 */
export function checkTotalTrigger(
  total: number,
  min?: number,
  max?: number,
): boolean {
  if (min !== undefined && total < min) return false;
  if (max !== undefined && total > max) return false;
  return true;
}
