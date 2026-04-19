/**
 * 通用能力框架
 *
 * 提供能力定义、注册、查找、执行器分发和可用性检查的通用骨架。
 * 引擎层不预定义具体的触发类型或效果类型，游戏通过泛型特化。
 *
 * 设计原则：
 * - 泛型驱动：TEffect / TTrigger 由游戏层定义
 * - 每游戏独立实例（非全局单例），避免游戏间污染
 * - 提供 getRegisteredIds() 支持 entity-chain-integrity 测试
 * - 与 primitives/condition、primitives/effects 正交互补
 */

import type { ConditionNode, ConditionHandlerRegistry, ConditionContext } from './condition';
import { evaluateCondition } from './condition';

// ============================================================================
// 能力定义类型
// ============================================================================

/**
 * 通用能力定义
 *
 * @typeParam TEffect  效果定义类型（游戏层定义，如 DiceThrone 的 AbilityEffect）
 * @typeParam TTrigger 触发时机类型（游戏层定义，如 SummonerWars 的 AbilityTrigger 字符串联合）
 */
export interface AbilityDef<TEffect = unknown, TTrigger = string> {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述文本 */
  description?: string;
  /** 触发时机 */
  trigger?: TTrigger;
  /** 触发条件（使用 engine/primitives/condition 的 ConditionNode） */
  condition?: ConditionNode;
  /**
   * 能力约束（推荐使用，替代游戏层手写验证逻辑）
   * 
   * 使用 engine/primitives/abilityConstraints 的通用约束系统。
   * 支持行动消耗、实体状态、资源、使用次数等常见约束。
   * 
   * @example
   * ```typescript
   * constraints: {
   *   actionCost: { type: 'move', count: 1 },
   *   entityState: { notMoved: true },
   *   resource: { charge: { min: 1 } },
   * }
   * ```
   * 
   * @see engine/primitives/abilityConstraints
   */
  constraints?: import('./abilityConstraints').AbilityConstraints;
  /** 效果列表 */
  effects: TEffect[];
  /** 标签（如 'ultimate', 'passive'） */
  tags?: string[];
  /** 资源消耗 { resourceId: amount } */
  cost?: Record<string, number>;
  /** 冷却回合数 */
  cooldown?: number;
  /** 技能变体（同一技能的不同等级/触发条件） */
  variants?: AbilityVariant<TEffect, TTrigger>[];
  /** 游戏特定扩展元数据 */
  meta?: Record<string, unknown>;
}

/**
 * 能力变体定义
 */
export interface AbilityVariant<TEffect = unknown, TTrigger = string> {
  /** 变体 ID */
  id: string;
  /** 变体触发条件 */
  trigger: TTrigger;
  /** 变体效果列表 */
  effects: TEffect[];
  /** 变体专属标签 */
  tags?: string[];
  /** 优先级（数值越大越优先） */
  priority?: number;
}

// ============================================================================
// 执行上下文与结果
// ============================================================================

/**
 * 最小能力执行上下文
 *
 * 游戏层通过 interface 扩展添加游戏特定字段。
 */
export interface AbilityContext {
  /** 能力来源实体 ID */
  sourceId: string;
  /** 能力拥有者（玩家 ID） */
  ownerId: string;
  /** 时间戳 */
  timestamp: number;
  /** 游戏特定扩展 */
  [key: string]: unknown;
}

/**
 * 能力执行结果
 *
 * @typeParam TEvent 事件类型（游戏层定义）
 */
export interface AbilityResult<TEvent = unknown> {
  /** 产生的事件列表 */
  events: TEvent[];
  /** 需要玩家交互时返回交互配置 */
  interaction?: unknown;
}

/**
 * 能力执行器函数签名（命令式模式）
 *
 * 适用于每个能力是独立函数的游戏（如 SmashUp）。
 */
export type AbilityExecutor<
  TCtx extends AbilityContext = AbilityContext,
  TEvent = unknown,
> = (ctx: TCtx) => AbilityResult<TEvent>;

// ============================================================================
// AbilityRegistry — 能力定义注册表
// ============================================================================

/**
 * 通用能力定义注册表
 *
 * 替代各游戏独立实现的 registry/manager 中的注册+查找部分。
 * 每个游戏创建自己的实例，不使用全局单例。
 *
 * 使用示例：
 * ```
 * // SummonerWars
 * const registry = new AbilityRegistry<SWAbilityDef>('sw-abilities');
 * registry.registerAll(necromancerAbilities);
 * registry.getByTrigger('afterAttack');
 *
 * // DiceThrone
 * const registry = new AbilityRegistry<DTAbilityDef>('dt-abilities');
 * registry.register(monkSlashDef);
 * registry.getByTag('ultimate');
 * ```
 */
export class AbilityRegistry<TDef extends AbilityDef = AbilityDef> {
  private definitions = new Map<string, TDef>();
  private label: string;

  constructor(label = 'AbilityRegistry') {
    this.label = label;
  }

  /** 注册能力定义 */
  register(def: TDef): void {
    if (this.definitions.has(def.id)) {
      console.warn(`[${this.label}] "${def.id}" 已存在，将被覆盖`);
    }
    this.definitions.set(def.id, def);
  }

  /** 批量注册 */
  registerAll(defs: TDef[]): void {
    for (const def of defs) {
      this.register(def);
    }
  }

  /** 获取能力定义 */
  get(id: string): TDef | undefined {
    return this.definitions.get(id);
  }

  /** 检查是否已注册 */
  has(id: string): boolean {
    return this.definitions.has(id);
  }

  /** 获取所有已注册的定义 */
  getAll(): TDef[] {
    return Array.from(this.definitions.values());
  }

  /** 按标签筛选（定义的 tags 包含指定 tag） */
  getByTag(tag: string): TDef[] {
    return this.getAll().filter(def => def.tags?.includes(tag));
  }

  /** 按触发时机筛选 */
  getByTrigger(trigger: unknown): TDef[] {
    return this.getAll().filter(def => def.trigger === trigger);
  }

  /** 获取所有已注册的 ID（用于引用完整性验证） */
  getRegisteredIds(): Set<string> {
    return new Set(this.definitions.keys());
  }

  /** 注册表大小 */
  get size(): number {
    return this.definitions.size;
  }

  /** 清空（测试用） */
  clear(): void {
    this.definitions.clear();
  }
}

// ============================================================================
// 交互链声明类型（用于多步交互技能的契约校验）
// ============================================================================

/**
 * 交互步骤声明
 *
 * 描述一个多步交互中的单个步骤：用户需要做什么操作、产出什么 payload 字段。
 * 引擎层通用，游戏层在 AbilityDef 中声明。
 */
export interface InteractionStep {
  /** 步骤 ID（如 'selectBuilding', 'selectDirection'） */
  step: string;
  /** 输入类型 */
  inputType: 'unit' | 'position' | 'card' | 'direction' | 'choice' | 'cards';
  /** 此步骤产出的 payload 字段名 */
  producesField: string;
  /** 是否可选（某些步骤可跳过） */
  optional?: boolean;
}

/**
 * Payload 契约声明
 *
 * 声明执行器期望从 payload 中读取的字段。
 * 用于与 interactionChain.steps 交叉校验。
 */
export interface PayloadContract {
  /** 执行器必需的 payload 字段（缺失则执行器静默返回空事件） */
  required: string[];
  /** 可选字段（有则使用，无则走默认逻辑） */
  optional?: string[];
}

/**
 * 交互链声明
 *
 * 完整描述一个多步交互技能的 UI 交互流程和最终 payload 契约。
 * 引擎层测试工厂自动校验：steps 产出 ⊇ payloadContract.required。
 */
export interface InteractionChain {
  /** 交互步骤列表（按顺序） */
  steps: InteractionStep[];
  /** 最终发送给执行器的 payload 契约 */
  payloadContract: PayloadContract;
}

// ============================================================================
// AbilityExecutorRegistry — 能力执行器注册表
// ============================================================================

/**
 * 能力执行器注册表
 *
 * 将能力 ID（可选 + tag）映射到执行函数。
 * 支持简单 key（id）和复合 key（id + tag），替代 SmashUp 的 `(defId, tag) → executor` 模式。
 *
 * 使用示例：
 * ```
 * // SmashUp 风格（id + tag）
 * const executors = new AbilityExecutorRegistry<SmashUpCtx, SmashUpEvent>('su-executors');
 * executors.register('ninja-master', handleNinjaMasterOnPlay, 'onPlay');
 * executors.register('ninja-master', handleNinjaMasterTalent, 'talent');
 * executors.resolve('ninja-master', 'onPlay');
 *
 * // SummonerWars 风格（纯 id）
 * const executors = new AbilityExecutorRegistry<SWCtx, GameEvent>('sw-executors');
 * executors.register('soul_transfer', handleSoulTransfer);
 * executors.resolve('soul_transfer');
 * ```
 */
export class AbilityExecutorRegistry<
  TCtx extends AbilityContext = AbilityContext,
  TEvent = unknown,
> {
  private entries = new Map<string, AbilityExecutor<TCtx, TEvent>>();
  private contracts = new Map<string, PayloadContract>();
  private label: string;

  constructor(label = 'AbilityExecutorRegistry') {
    this.label = label;
  }

  /** 构建内部 key */
  private makeKey(abilityId: string, tag?: string): string {
    return tag ? `${abilityId}::${tag}` : abilityId;
  }

  /**
   * 注册执行器
   *
   * @param abilityId 技能 ID
   * @param executor  执行函数
   * @param tagOrOptions tag 字符串（向后兼容）或 { tag?, payloadContract? } 选项
   */
  register(
    abilityId: string,
    executor: AbilityExecutor<TCtx, TEvent>,
    tagOrOptions?: string | { tag?: string; payloadContract?: PayloadContract },
  ): void {
    const tag = typeof tagOrOptions === 'string' ? tagOrOptions : tagOrOptions?.tag;
    const contract = typeof tagOrOptions === 'object' ? tagOrOptions?.payloadContract : undefined;
    const key = this.makeKey(abilityId, tag);
    // HMR 会重新执行模块导致重复注册，静默覆盖即可
    // 真正的 ID 冲突应在测试阶段通过注册表完整性审计发现
    this.entries.set(key, executor);
    if (contract) {
      this.contracts.set(key, contract);
    }
  }

  /** 查找执行器 */
  resolve(abilityId: string, tag?: string): AbilityExecutor<TCtx, TEvent> | undefined {
    return this.entries.get(this.makeKey(abilityId, tag));
  }

  /** 检查是否已注册 */
  has(abilityId: string, tag?: string): boolean {
    return this.entries.has(this.makeKey(abilityId, tag));
  }

  /**
   * 获取所有已注册的 key（用于引用完整性验证）
   *
   * 返回格式：无 tag 时为 "abilityId"，有 tag 时为 "abilityId::tag"
   */
  getRegisteredIds(): Set<string> {
    return new Set(this.entries.keys());
  }

  /**
   * 获取执行器声明的 payload 契约
   *
   * 用于交互链完整性测试：校验 UI 交互步骤是否覆盖了执行器所需字段。
   */
  getPayloadContract(abilityId: string, tag?: string): PayloadContract | undefined {
    return this.contracts.get(this.makeKey(abilityId, tag));
  }

  /**
   * 获取所有已声明 payload 契约的映射
   *
   * 返回 Map<key, PayloadContract>，用于批量审计。
   */
  getAllPayloadContracts(): Map<string, PayloadContract> {
    return new Map(this.contracts);
  }

  /** 注册表大小 */
  get size(): number {
    return this.entries.size;
  }

  /** 清空（测试用） */
  clear(): void {
    this.entries.clear();
    this.contracts.clear();
  }
}

// ============================================================================
// 可用性检查工具函数
// ============================================================================

/**
 * 检查资源是否满足能力消耗
 *
 * @param def       能力定义（需含 cost 字段）
 * @param resources 当前可用资源 { resourceId: amount }
 * @returns         资源是否足够
 */
export function checkAbilityCost(
  def: Pick<AbilityDef, 'cost'>,
  resources: Record<string, number>,
): boolean {
  if (!def.cost) return true;
  for (const [resourceId, required] of Object.entries(def.cost)) {
    if ((resources[resourceId] ?? 0) < required) return false;
  }
  return true;
}

/**
 * 过滤被标签阻塞的能力
 *
 * @param defs        能力定义列表
 * @param blockedTags 被阻塞的标签集合
 * @returns           未被阻塞的能力定义
 */
export function filterByTags<TDef extends AbilityDef>(
  defs: TDef[],
  blockedTags: ReadonlySet<string> | readonly string[],
): TDef[] {
  const blocked = blockedTags instanceof Set
    ? blockedTags
    : new Set(blockedTags);
  if (blocked.size === 0) return defs;
  return defs.filter(def =>
    !def.tags?.some(tag => blocked.has(tag)),
  );
}

/**
 * 检查能力条件是否满足
 *
 * 将 AbilityDef.condition（ConditionNode）委托给 primitives/condition 评估。
 * 无条件时视为满足。
 *
 * @param def              能力定义
 * @param conditionCtx     条件评估上下文
 * @param conditionRegistry 自定义条件处理器注册表（CustomCondition 需要）
 * @returns                条件是否满足
 */
export function checkAbilityCondition(
  def: Pick<AbilityDef, 'condition'>,
  conditionCtx: ConditionContext,
  conditionRegistry?: ConditionHandlerRegistry,
): boolean {
  if (!def.condition) return true;
  return evaluateCondition(def.condition, conditionCtx, conditionRegistry);
}

// ============================================================================
// 工厂函数（便捷创建）
// ============================================================================

/** 创建能力定义注册表 */
export function createAbilityRegistry<TDef extends AbilityDef = AbilityDef>(
  label?: string,
): AbilityRegistry<TDef> {
  return new AbilityRegistry<TDef>(label);
}

/** 创建能力执行器注册表 */
export function createAbilityExecutorRegistry<
  TCtx extends AbilityContext = AbilityContext,
  TEvent = unknown,
>(label?: string): AbilityExecutorRegistry<TCtx, TEvent> {
  return new AbilityExecutorRegistry<TCtx, TEvent>(label);
}

// ============================================================================
// i18n key 生成辅助
// ============================================================================

/**
 * 生成技能 i18n key
 *
 * 用于 AbilityDef 的 name/description 字段，存储 i18n key 而非硬编码文本。
 * 各游戏共用，避免每个英雄/派系文件重复定义。
 *
 * @example
 * abilityText('frost_axe', 'name')       // => 'abilities.frost_axe.name'
 * abilityText('frost_axe', 'description') // => 'abilities.frost_axe.description'
 */
export const abilityText = (id: string, field: 'name' | 'description'): string =>
  `abilities.${id}.${field}`;

/**
 * 生成技能效果 i18n key
 *
 * 用于 AbilityDef 中效果描述的 i18n key 生成。
 *
 * @example
 * abilityEffectText('slash', 'damage') // => 'abilities.slash.effects.damage'
 */
export const abilityEffectText = (id: string, field: string): string =>
  `abilities.${id}.effects.${field}`;
