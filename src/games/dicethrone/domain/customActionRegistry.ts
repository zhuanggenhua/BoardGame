import type { EffectContext } from './effects';
import type { PlayerId, RandomFn } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneEvent } from './types';
import type { EffectAction } from './tokenTypes';

// ============================================================================
// Custom Action 处理器注册表
// ============================================================================

/**
 * Custom Action 处理器上下文
 */
export interface CustomActionContext {
    ctx: EffectContext;
    targetId: PlayerId;
    attackerId: PlayerId;
    sourceAbilityId: string;
    state: DiceThroneCore;
    timestamp: number;
    random?: RandomFn;
    /** 触发此 Custom Action 的原始 EffectAction 配置（包含 params 等额外参数） */
    action: EffectAction;
}

/**
 * Custom Action 处理器函数类型
 * 返回生成的事件数组
 */
export type CustomActionHandler = (context: CustomActionContext) => DiceThroneEvent[];

/**
 * Custom Action 效果分类
 * - dice: 骰子相关（修改、重掷、增加投掷次数）
 * - status: 状态效果相关（移除、转移）
 * - resource: 资源相关（CP）
 * - token: Token 相关
 * - damage: 伤害相关
 * - defense: 防御相关
 * - card: 卡牌相关
 * - choice: 选择类效果
 * - other: 其他
 */
export type CustomActionCategory =
    'dice' | 'status' | 'resource' | 'token' | 'damage' | 'defense' | 'card' | 'choice' | 'passive' | 'other';

/**
 * Custom Action 元数据
 * 用于效果分类、响应窗口过滤等
 */
export interface CustomActionMeta {
    /** 效果分类（支持多分类） */
    categories: CustomActionCategory[];
    /** 是否需要玩家交互 */
    requiresInteraction?: boolean;
    /** 该处理器在跨阶段攻击结算中读取攻击骰结果，必须使用 pendingAttack 中的攻击快照。 */
    usesAttackDiceSnapshot?: boolean;
    /** 是否依赖当前已选中的单一 defender（常见于 2v2 攻击修正/主阶段对手卡） */
    requiresSelectedDefender?: boolean;
    /** 可用阶段（不指定则不限制） */
    phases?: string[];
    /**
     * 预估伤害回调（可选）
     *
     * 用于 Token 门控等需要在 custom action 执行前估算伤害的场景。
     * 例如：暴击 Token 需要判断技能伤害是否 ≥5，但 CP 系伤害在执行前无法确定。
     *
     * @param state - 当前游戏状态（类型为 Record 以避免循环依赖）
     * @param playerId - 使用技能的玩家 ID
     * @returns 预估的伤害值
     */
    estimateDamage?: (state: Record<string, unknown>, playerId: string) => number;
}

/**
 * Custom Action 注册项（处理器 + 元数据）
 */
export interface CustomActionEntry {
    handler: CustomActionHandler;
    meta: CustomActionMeta;
}

/**
 * Custom Action 处理器注册表
 * 存储 handler 和 meta
 */
export const customActionRegistry: Map<string, CustomActionEntry> = new Map();

/**
 * 注册 Custom Action 处理器及元数据
 * @param actionId 唯一标识
 * @param handler 处理器函数
 * @param meta 元数据（分类、交互等）
 */
export function registerCustomActionHandler(
    actionId: string,
    handler: CustomActionHandler,
    meta: CustomActionMeta,
): void {
    if (customActionRegistry.has(actionId)) {
        console.warn(`[DiceThrone] CustomAction "${actionId}" 已存在，将被覆盖`);
    }
    customActionRegistry.set(actionId, { handler, meta });
}

/**
 * 获取 Custom Action 处理器
 */
export function getCustomActionHandler(actionId: string): CustomActionHandler | undefined {
    return customActionRegistry.get(actionId)?.handler;
}

/**
 * 获取 Custom Action 元数据
 * 用于效果分类查询（如 hasAnyDiceEffect）
 */
export function getCustomActionMeta(actionId: string): CustomActionMeta | undefined {
    return customActionRegistry.get(actionId)?.meta;
}

/**
 * 检查 Custom Action 是否属于指定分类
 */
export function isCustomActionCategory(actionId: string, category: CustomActionCategory): boolean {
    const meta = customActionRegistry.get(actionId)?.meta;
    return meta?.categories.includes(category) ?? false;
}

/**
 * 获取所有已注册的 Custom Action ID（用于完整性测试）
 */
export function getRegisteredCustomActionIds(): Set<string> {
    return new Set(customActionRegistry.keys());
}
