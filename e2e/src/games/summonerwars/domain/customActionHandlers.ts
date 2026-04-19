/**
 * 召唤师战争 - 自定义 Action 处理器注册表
 *
 * 将 abilityResolver.ts 中 case 'custom' 的 if/else 链
 * 重构为引擎层 ActionHandlerRegistry 模式。
 *
 * 设计：
 * - 注册特定 actionId 的处理器（如 soul_transfer_request、judgment_draw）
 * - 未注册的 actionId 使用通用 ABILITY_TRIGGERED 事件（fallback）
 * - 支持 getRegisteredIds() 供完整性测试使用
 */

import { ActionHandlerRegistry } from '../../../engine/primitives/actionRegistry';
import type { GameEvent } from '../../../engine/types';
import type { AbilityContext } from './abilityResolver';
import { SW_EVENTS } from './types';

// ============================================================================
// Handler 上下文与签名
// ============================================================================

/** 自定义 Action 处理器上下文 */
export interface SWCustomActionContext {
    /** 技能效果解析上下文 */
    ctx: AbilityContext;
    /** action 参数（来自 effect.params） */
    params?: Record<string, unknown>;
    /** 来源技能 ID */
    abilityId: string;
    /** 时间戳 */
    timestamp: number;
}

// ============================================================================
// 注册表实例
// ============================================================================

export const swCustomActionRegistry = new ActionHandlerRegistry<SWCustomActionContext, GameEvent[]>(
    'SW-CustomAction',
);

// ============================================================================
// Handler 注册
// ============================================================================

// --- 灵魂转移请求（亡灵法师） ---
swCustomActionRegistry.register('soul_transfer_request', ({ ctx, timestamp }) => [{
    type: SW_EVENTS.SOUL_TRANSFER_REQUESTED,
    payload: {
        sourceUnitId: ctx.sourceUnit.instanceId,
        sourcePosition: ctx.sourcePosition,
        victimPosition: ctx.victimPosition,
        ownerId: ctx.ownerId,
    },
    timestamp,
}]);

// --- 心灵捕获检查（欺心巫族） ---
swCustomActionRegistry.register('mind_capture_check', ({ ctx, timestamp }) => [{
    type: SW_EVENTS.MIND_CAPTURE_REQUESTED,
    payload: {
        sourceUnitId: ctx.sourceUnit.instanceId,
        sourcePosition: ctx.sourcePosition,
        targetPosition: ctx.targetPosition,
        ownerId: ctx.ownerId,
    },
    timestamp,
}]);

// --- 裁决抓牌（圣骑士）：攻击后抓取等于所掷出 special 数量的卡牌 ---
swCustomActionRegistry.register('judgment_draw', ({ ctx, timestamp }) => {
    const specialCount = (ctx.diceResults ?? [])
      .flatMap(r => r.marks)
      .filter(mark => mark === 'special')
      .length;
    if (specialCount <= 0) return [];
    return [{
        type: SW_EVENTS.CARD_DRAWN,
        payload: { playerId: ctx.ownerId, count: specialCount, sourceAbilityId: 'judgment' },
        timestamp,
    }];
});

// --- 指引抓牌（圣骑士） ---
swCustomActionRegistry.register('guidance_draw', ({ ctx, timestamp }) => {
    const guidancePlayer = ctx.state.players[ctx.ownerId];
    const guidanceDraw = Math.min(2, guidancePlayer.deck.length);
    if (guidanceDraw <= 0) return [];
    return [{
        type: SW_EVENTS.CARD_DRAWN,
        payload: { playerId: ctx.ownerId, count: guidanceDraw, sourceAbilityId: 'guidance' },
        timestamp,
    }];
});

// --- 占位 handler（逻辑在 execute.ts 中处理，此处 no-op） ---
swCustomActionRegistry.register('divine_shield_check', () => []);
swCustomActionRegistry.register('healing_convert', () => []);
