/**
 * 效果执行框架
 *
 * 不预定义效果类型（不定义 damage/heal/summon 等），
 * 游戏注册自己的效果处理器，引擎只提供调度框架。
 *
 * 设计原则：
 * - 引擎不关心效果的语义，只负责"找到处理器并调用"
 * - 所有状态变更通过处理器返回新 state（纯函数）
 * - 处理器返回的事件列表用于 UI 层消费
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 效果定义（游戏层构造，引擎层调度）
 *
 * type 字段由游戏层定义（如 'damage'、'heal'、'summon'），
 * 其余字段作为 params 传给对应处理器。
 */
export interface EffectDef {
  type: string;
  [key: string]: unknown;
}

/**
 * 效果执行结果
 */
export interface EffectResult<TState = unknown, TEvent = unknown> {
  /** 更新后的状态 */
  state: TState;
  /** 产生的事件列表（用于 UI/音效消费） */
  events: TEvent[];
}

// ============================================================================
// 效果处理器注册
// ============================================================================

/**
 * 效果处理器函数类型
 *
 * @param effect 效果定义（包含 type 和游戏特定参数）
 * @param state  当前游戏状态
 * @returns      执行结果（新状态 + 事件列表）
 */
export type EffectHandler<TState = unknown, TEvent = unknown> = (
  effect: EffectDef,
  state: TState,
) => EffectResult<TState, TEvent>;

/**
 * 效果处理器注册表
 */
export interface EffectHandlerRegistry<TState = unknown, TEvent = unknown> {
  handlers: Map<string, EffectHandler<TState, TEvent>>;
}

/** 创建空的效果处理器注册表 */
export function createEffectHandlerRegistry<
  TState = unknown,
  TEvent = unknown,
>(): EffectHandlerRegistry<TState, TEvent> {
  return { handlers: new Map() };
}

/** 注册效果处理器 */
export function registerEffectHandler<TState = unknown, TEvent = unknown>(
  registry: EffectHandlerRegistry<TState, TEvent>,
  type: string,
  handler: EffectHandler<TState, TEvent>,
): void {
  registry.handlers.set(type, handler);
}

// ============================================================================
// 效果执行
// ============================================================================

/**
 * 执行单个效果
 *
 * @param effect   效果定义
 * @param state    当前游戏状态
 * @param registry 效果处理器注册表
 * @returns        执行结果
 * @throws         未注册的效果类型
 */
export function executeEffect<TState, TEvent>(
  effect: EffectDef,
  state: TState,
  registry: EffectHandlerRegistry<TState, TEvent>,
): EffectResult<TState, TEvent> {
  const handler = registry.handlers.get(effect.type);
  if (!handler) {
    throw new Error(`未注册的效果类型: ${effect.type}`);
  }
  return handler(effect, state);
}

/**
 * 顺序执行多个效果（前一个效果的输出 state 作为下一个的输入）
 *
 * @param effects  效果定义列表
 * @param state    初始游戏状态
 * @param registry 效果处理器注册表
 * @returns        最终状态 + 所有事件列表
 */
export function executeEffects<TState, TEvent>(
  effects: EffectDef[],
  state: TState,
  registry: EffectHandlerRegistry<TState, TEvent>,
): EffectResult<TState, TEvent> {
  let currentState = state;
  const allEvents: TEvent[] = [];

  for (const effect of effects) {
    const result = executeEffect(effect, currentState, registry);
    currentState = result.state;
    allEvents.push(...result.events);
  }

  return { state: currentState, events: allEvents };
}
