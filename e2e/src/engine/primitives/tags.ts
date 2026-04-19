/**
 * 层级 Tag 系统
 *
 * 提供带层数（stacks）、持续时间（duration）的 tag 容器，以及层级前缀匹配。
 * 替代各游戏独立实现的 statusEffects / boosts / tempAbilities。
 *
 * 设计原则：
 * - 纯函数，不可变，返回新容器
 * - 层级 tag 使用 '.' 分隔（如 'Status.Debuff.Stun'）
 * - matchTags('Status.Debuff') 能匹配 'Status.Debuff.Stun'
 * - 每游戏创建独立 TagContainer，非全局单例
 */

// ============================================================================
// 类型定义
// ============================================================================

/** tag 条目 */
export interface TagEntry {
  /** 层数（≥1） */
  stacks: number;
  /** 剩余持续回合数（undefined = 永久） */
  duration?: number;
  /** 来源标识（如能力 ID / 卡牌 ID） */
  source?: string;
  /** 是否可被净化/移除（默认 true） */
  removable?: boolean;
}

/** tag 添加选项 */
export interface TagAddOptions {
  /** 初始层数（默认 1） */
  stacks?: number;
  /** 持续回合数（不填 = 永久） */
  duration?: number;
  /** 来源标识 */
  source?: string;
  /** 是否可被移除（默认 true） */
  removable?: boolean;
  /** 叠加模式：'add' 累加层数（默认）/ 'replace' 替换 / 'max' 取最大层数 */
  stackMode?: 'add' | 'replace' | 'max';
  /** duration 叠加模式：'add' 累加 / 'replace' 替换（默认）/ 'max' 取最大 */
  durationMode?: 'add' | 'replace' | 'max';
}

/** tag 容器（tagId → TagEntry） */
export type TagContainer = Readonly<Record<string, TagEntry>>;

/** tickDurations 的结果 */
export interface TickResult {
  /** 更新后的容器 */
  container: TagContainer;
  /** 本次过期被移除的 tag ID 列表 */
  expired: string[];
}

// ============================================================================
// 层级匹配
// ============================================================================

/** 分隔符 */
const TAG_SEPARATOR = '.';

/**
 * 检查 tagId 是否匹配 pattern（层级前缀匹配）
 *
 * - 精确匹配：'Status.Debuff.Stun' 匹配 'Status.Debuff.Stun'
 * - 前缀匹配：'Status.Debuff.Stun' 匹配 'Status.Debuff'、'Status'
 * - 不匹配：'Status.Debuff.Stun' 不匹配 'Status.De'（必须完整段）
 */
export function isTagMatch(tagId: string, pattern: string): boolean {
  if (tagId === pattern) return true;
  // pattern 必须是 tagId 的前缀，且 tagId 在 pattern 长度处有分隔符
  return tagId.startsWith(pattern) && tagId[pattern.length] === TAG_SEPARATOR;
}

/**
 * 获取 tag 的父级 ID
 *
 * 'Status.Debuff.Stun' → 'Status.Debuff'
 * 'Status' → undefined
 */
export function getParentTag(tagId: string): string | undefined {
  const lastDot = tagId.lastIndexOf(TAG_SEPARATOR);
  return lastDot > 0 ? tagId.slice(0, lastDot) : undefined;
}

/**
 * 获取 tag 的层级深度
 *
 * 'Status' → 1
 * 'Status.Debuff.Stun' → 3
 */
export function getTagDepth(tagId: string): number {
  return tagId.split(TAG_SEPARATOR).length;
}

// ============================================================================
// 容器操作（纯函数）
// ============================================================================

/** 创建空容器 */
export function createTagContainer(): TagContainer {
  return {};
}

/**
 * 添加/叠加 tag
 *
 * 如果 tag 已存在，按 stackMode 处理层数，按 durationMode 处理持续时间。
 * 返回新容器（不可变）。
 */
export function addTag(
  container: TagContainer,
  tagId: string,
  options: TagAddOptions = {},
): TagContainer {
  const {
    stacks = 1,
    duration,
    source,
    removable,
    stackMode = 'add',
    durationMode = 'replace',
  } = options;

  const existing = container[tagId];

  if (!existing) {
    // 新增
    const entry: TagEntry = { stacks };
    if (duration !== undefined) entry.duration = duration;
    if (source !== undefined) entry.source = source;
    if (removable !== undefined) entry.removable = removable;
    return { ...container, [tagId]: entry };
  }

  // 叠加 — 计算新层数
  let newStacks: number;
  switch (stackMode) {
    case 'replace':
      newStacks = stacks;
      break;
    case 'max':
      newStacks = Math.max(existing.stacks, stacks);
      break;
    case 'add':
    default:
      newStacks = existing.stacks + stacks;
      break;
  }

  // 叠加 — 计算新持续时间
  let newDuration: number | undefined;
  if (duration === undefined) {
    // 新的没有 duration → 变为永久
    newDuration = undefined;
  } else if (existing.duration === undefined) {
    // 旧的是永久 → 保持永久
    newDuration = undefined;
  } else {
    switch (durationMode) {
      case 'add':
        newDuration = existing.duration + duration;
        break;
      case 'max':
        newDuration = Math.max(existing.duration, duration);
        break;
      case 'replace':
      default:
        newDuration = duration;
        break;
    }
  }

  const entry: TagEntry = {
    stacks: newStacks,
    // 保留旧的 source/removable，新的有值则覆盖
    source: source ?? existing.source,
    removable: removable ?? existing.removable,
  };
  if (newDuration !== undefined) entry.duration = newDuration;

  return { ...container, [tagId]: entry };
}

/**
 * 移除 tag（减少层数）
 *
 * stacks 未指定则移除全部层数。
 * 层数降为 0 或以下时从容器中删除。
 */
export function removeTag(
  container: TagContainer,
  tagId: string,
  stacks?: number,
): TagContainer {
  const existing = container[tagId];
  if (!existing) return container;

  if (stacks === undefined || existing.stacks <= stacks) {
    // 完全移除
    const { [tagId]: _, ...rest } = container;
    return rest;
  }

  // 减少层数
  return {
    ...container,
    [tagId]: { ...existing, stacks: existing.stacks - stacks },
  };
}

/**
 * 按层级前缀批量移除
 *
 * removeTagsByPattern(container, 'Status.Debuff') 移除所有 Status.Debuff.*
 */
export function removeTagsByPattern(
  container: TagContainer,
  pattern: string,
): TagContainer {
  const result: Record<string, TagEntry> = {};
  for (const [tagId, entry] of Object.entries(container)) {
    if (!isTagMatch(tagId, pattern)) {
      result[tagId] = entry;
    }
  }
  return result;
}

// ============================================================================
// 查询
// ============================================================================

/**
 * 检查是否拥有 tag（支持层级前缀匹配）
 *
 * hasTag(container, 'Status.Debuff') 在存在 'Status.Debuff.Stun' 时返回 true
 */
export function hasTag(container: TagContainer, pattern: string): boolean {
  // 精确匹配快速路径
  if (container[pattern]) return true;
  // 前缀匹配
  return Object.keys(container).some(tagId => isTagMatch(tagId, pattern));
}

/**
 * 获取精确 tag 的层数（不做前缀匹配）
 *
 * 不存在返回 0
 */
export function getStacks(container: TagContainer, tagId: string): number {
  return container[tagId]?.stacks ?? 0;
}

/**
 * 按层级前缀匹配获取所有匹配的 tag
 *
 * matchTags(container, 'Status.Debuff') → [['Status.Debuff.Stun', entry], ...]
 */
export function matchTags(
  container: TagContainer,
  pattern: string,
): Array<[string, TagEntry]> {
  return Object.entries(container).filter(([tagId]) =>
    isTagMatch(tagId, pattern),
  );
}

/** 获取所有 tag ID */
export function getTagIds(container: TagContainer): string[] {
  return Object.keys(container);
}

/** 获取容器中 tag 数量 */
export function getTagCount(container: TagContainer): number {
  return Object.keys(container).length;
}

/**
 * 获取可移除的 tag（removable !== false）
 *
 * 用于净化/驱散类效果
 */
export function getRemovable(
  container: TagContainer,
): Array<[string, TagEntry]> {
  return Object.entries(container).filter(
    ([, entry]) => entry.removable !== false,
  );
}

// ============================================================================
// 回合结算
// ============================================================================

/**
 * 回合结算 — 扣减所有有限持续时间的 tag，到期的自动移除
 *
 * 返回更新后的容器和过期 tag 列表。
 */
export function tickDurations(container: TagContainer): TickResult {
  const expired: string[] = [];
  const result: Record<string, TagEntry> = {};

  for (const [tagId, entry] of Object.entries(container)) {
    if (entry.duration === undefined) {
      // 永久 tag 不受影响
      result[tagId] = entry;
      continue;
    }

    const newDuration = entry.duration - 1;
    if (newDuration <= 0) {
      // 到期，移除
      expired.push(tagId);
    } else {
      result[tagId] = { ...entry, duration: newDuration };
    }
  }

  return { container: result, expired };
}
