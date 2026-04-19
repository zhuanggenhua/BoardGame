/**
 * DamageCalculation PassiveTrigger 增强 — 属性测试
 *
 * Feature: unified-damage-buff-system
 * Property 2: PassiveTrigger custom/PREVENT_DAMAGE 处理
 * Property 3: PassiveTrigger removeStatus 处理
 *
 * **Validates: Requirements 1.2, 1.3, 3.3, 3.4, 3.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createDamageCalculation,
  type PassiveTriggerHandler,
} from '../damageCalculation';
import type { GameEvent } from '../../types';

// ============================================================================
// 生成器
// ============================================================================

/**
 * 生成基础伤害值（0~100 的整数，覆盖 0 边界）
 */
const arbBaseDamage = () => fc.integer({ min: 0, max: 100 });

/**
 * 生成 preventAmount（0~50 的整数，覆盖 0 和超过 baseDamage 的场景）
 */
const arbPreventAmount = () => fc.integer({ min: 0, max: 50 });

/**
 * 生成 token/status 层数（1~10，至少 1 层才会触发 passiveTrigger）
 */
const arbStacks = () => fc.integer({ min: 1, max: 10 });

/**
 * 生成 tokenId（合法标识符字符串）
 */
const arbTokenId = () => fc.stringMatching(/^[a-z][a-z0-9_]{2,15}$/);

/**
 * 生成 statusId（用于 removeStatus 目标）
 */
const arbStatusId = () => fc.stringMatching(/^[a-z][a-z0-9_]{2,15}$/);

/**
 * 生成 customActionId
 */
const arbCustomActionId = () => fc.stringMatching(/^[A-Z][A-Z0-9_]{2,20}$/);

/**
 * 生成 handler 产生的副作用事件数量（0~5）
 */
const arbSideEffectCount = () => fc.integer({ min: 0, max: 5 });

/**
 * 生成 removeStatus 动作的 value（移除层数）
 * undefined 表示移除全部
 */
const arbRemoveValue = () =>
  fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined });

/**
 * 生成目标玩家当前拥有的状态层数（0~10）
 * 0 表示目标没有该状态
 */
const arbCurrentStatusStacks = () => fc.integer({ min: 0, max: 10 });


// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 构造带 passiveTrigger 的游戏状态
 */
function makeState(opts: {
  targetId: string;
  attackerId: string;
  targetStatusEffects?: Record<string, number>;
  targetTokens?: Record<string, number>;
  tokenDefs: any[];
}) {
  return {
    core: {
      players: {
        [opts.attackerId]: { tokens: {}, statusEffects: {}, damageShields: [] },
        [opts.targetId]: {
          tokens: opts.targetTokens ?? {},
          statusEffects: opts.targetStatusEffects ?? {},
          damageShields: [],
        },
      },
      tokenDefinitions: opts.tokenDefs,
    },
  };
}

/**
 * 创建一个可追踪的 PassiveTriggerHandler
 * 返回固定的 preventAmount 和指定数量的副作用事件
 */
function createTrackingHandler(
  preventAmount: number,
  sideEffectCount: number,
): { handler: PassiveTriggerHandler; calls: any[] } {
  const calls: any[] = [];
  const handler: PassiveTriggerHandler = {
    handleCustomAction(actionId, context) {
      calls.push({ actionId, context });
      const events: GameEvent[] = [];
      for (let i = 0; i < sideEffectCount; i++) {
        events.push({
          type: preventAmount > 0 ? 'PREVENT_DAMAGE' : `SIDE_EFFECT_${i}`,
          payload: {
            amount: preventAmount,
            targetId: context.targetId,
            index: i,
          },
          sourceCommandType: 'ABILITY_EFFECT',
          timestamp: context.timestamp,
        });
      }
      return { events, preventAmount };
    },
  };
  return { handler, calls };
}

// ============================================================================
// Property 2: PassiveTrigger custom/PREVENT_DAMAGE 处理
// ============================================================================

describe('Property 2: PassiveTrigger custom/PREVENT_DAMAGE 处理', () => {
  it(
    // Feature: unified-damage-buff-system, Property 2: PassiveTrigger custom/PREVENT_DAMAGE 处理
    '对任意 baseDamage 和 preventAmount，finalDamage = max(0, baseDamage - preventAmount)，且 sideEffectEvents 包含 handler 产生的所有事件',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPreventAmount(),
          arbStacks(),
          arbTokenId(),
          arbCustomActionId(),
          arbSideEffectCount(),
          (baseDamage, preventAmount, stacks, tokenId, actionId, sideEffectCount) => {
            // 构造带 custom passiveTrigger 的 tokenDef
            const tokenDef = {
              id: tokenId,
              name: `Token ${tokenId}`,
              category: 'token', // 非 debuff → 从 tokens 取层数
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'custom', customActionId: actionId }],
              },
            };

            const state = makeState({
              targetId: '1',
              attackerId: '0',
              targetTokens: { [tokenId]: stacks },
              tokenDefs: [tokenDef],
            });

            const { handler, calls } = createTrackingHandler(preventAmount, sideEffectCount);

            const calc = createDamageCalculation({
              source: { playerId: '0', abilityId: 'test-ability' },
              target: { playerId: '1' },
              baseDamage,
              state,
              autoCollectTokens: false,
              autoCollectStatus: true, // collectStatusModifiers 处理 passiveTrigger
              autoCollectShields: false,
              passiveTriggerHandler: handler,
              timestamp: 1000,
            });

            const result = calc.resolve();

            // 属性 1: finalDamage = max(0, baseDamage - preventAmount)
            const expectedDamage = Math.max(0, baseDamage - preventAmount);
            expect(result.finalDamage).toBe(expectedDamage);

            // 属性 2: handler 被调用恰好一次
            expect(calls).toHaveLength(1);
            expect(calls[0].actionId).toBe(actionId);

            // 属性 3: sideEffectEvents 包含 handler 产生的所有事件
            expect(result.sideEffectEvents).toHaveLength(sideEffectCount);

            // 属性 4: 每个副作用事件的 targetId 正确
            for (const evt of result.sideEffectEvents) {
              expect((evt.payload as any).targetId).toBe('1');
              expect(evt.timestamp).toBe(1000);
            }
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  it(
    // Feature: unified-damage-buff-system, Property 2 补充: preventAmount=0 时不添加 modifier 但仍收集副作用事件
    'preventAmount=0 时 finalDamage 等于 baseDamage，副作用事件仍被收集',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbStacks(),
          arbTokenId(),
          arbSideEffectCount().filter(n => n > 0), // 至少 1 个副作用事件
          (baseDamage, stacks, tokenId, sideEffectCount) => {
            const tokenDef = {
              id: tokenId,
              name: `Token ${tokenId}`,
              category: 'token',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'custom', customActionId: 'NO_PREVENT' }],
              },
            };

            const state = makeState({
              targetId: '1',
              attackerId: '0',
              targetTokens: { [tokenId]: stacks },
              tokenDefs: [tokenDef],
            });

            const { handler } = createTrackingHandler(0, sideEffectCount);

            const calc = createDamageCalculation({
              source: { playerId: '0' },
              target: { playerId: '1' },
              baseDamage,
              state,
              autoCollectTokens: false,
              autoCollectStatus: true,
              autoCollectShields: false,
              passiveTriggerHandler: handler,
              timestamp: 1000,
            });

            const result = calc.resolve();

            // preventAmount=0 → 不减伤
            expect(result.finalDamage).toBe(baseDamage);
            // 副作用事件仍被收集
            expect(result.sideEffectEvents).toHaveLength(sideEffectCount);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: unified-damage-buff-system, Property 2 补充: handler 上下文参数正确传递
    'handler 接收的上下文参数与 DamageCalculation 配置一致',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbStacks(),
          arbTokenId(),
          arbCustomActionId(),
          (baseDamage, stacks, tokenId, actionId) => {
            const tokenDef = {
              id: tokenId,
              name: `Token ${tokenId}`,
              category: 'token',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'custom', customActionId: actionId }],
              },
            };

            const state = makeState({
              targetId: '1',
              attackerId: '0',
              targetTokens: { [tokenId]: stacks },
              tokenDefs: [tokenDef],
            });

            const { handler, calls } = createTrackingHandler(0, 0);

            const calc = createDamageCalculation({
              source: { playerId: '0', abilityId: 'my-ability' },
              target: { playerId: '1' },
              baseDamage,
              state,
              autoCollectTokens: false,
              autoCollectStatus: true,
              autoCollectShields: false,
              passiveTriggerHandler: handler,
              timestamp: 5000,
            });

            calc.resolve();

            expect(calls).toHaveLength(1);
            const ctx = calls[0].context;
            expect(ctx.targetId).toBe('1');
            expect(ctx.attackerId).toBe('0');
            expect(ctx.sourceAbilityId).toBe('my-ability');
            expect(ctx.damageAmount).toBe(baseDamage);
            expect(ctx.tokenId).toBe(tokenId);
            expect(ctx.tokenStacks).toBe(stacks);
            expect(ctx.timestamp).toBe(5000);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});


// ============================================================================
// Property 3: PassiveTrigger removeStatus 处理
// ============================================================================

describe('Property 3: PassiveTrigger removeStatus 处理', () => {
  it(
    // Feature: unified-damage-buff-system, Property 3: PassiveTrigger removeStatus 处理
    '对任意 removeStatus 配置，sideEffectEvents 包含 STATUS_REMOVED 事件，statusId 和 stacks 与配置一致',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbStacks(),
          arbTokenId(),
          arbStatusId(),
          arbRemoveValue(),
          arbCurrentStatusStacks(),
          (baseDamage, triggerStacks, tokenId, targetStatusId, removeValue, currentStacks) => {
            // 确保 tokenId 和 targetStatusId 不同（触发器 token 和被移除的 status 是不同的）
            const safeStatusId = targetStatusId === tokenId ? `${targetStatusId}_x` : targetStatusId;

            const tokenDef = {
              id: tokenId,
              name: `Token ${tokenId}`,
              category: 'debuff', // debuff → 从 statusEffects 取层数
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [
                  {
                    type: 'removeStatus',
                    statusId: safeStatusId,
                    ...(removeValue !== undefined ? { value: removeValue } : {}),
                  },
                ],
              },
            };

            const state = makeState({
              targetId: '1',
              attackerId: '0',
              targetStatusEffects: {
                [tokenId]: triggerStacks,       // 触发器自身的层数
                [safeStatusId]: currentStacks,  // 被移除的状态层数
              },
              tokenDefs: [tokenDef],
            });

            const calc = createDamageCalculation({
              source: { playerId: '0' },
              target: { playerId: '1' },
              baseDamage,
              state,
              autoCollectTokens: false,
              autoCollectStatus: true,
              autoCollectShields: false,
              timestamp: 2000,
            });

            const result = calc.resolve();

            if (currentStacks <= 0) {
              // 目标没有该状态 → 不生成 STATUS_REMOVED 事件
              const removeEvents = result.sideEffectEvents.filter(
                e => e.type === 'STATUS_REMOVED' && (e.payload as any).statusId === safeStatusId,
              );
              expect(removeEvents).toHaveLength(0);
            } else {
              // 目标有该状态 → 生成 STATUS_REMOVED 事件
              const removeEvents = result.sideEffectEvents.filter(
                e => e.type === 'STATUS_REMOVED' && (e.payload as any).statusId === safeStatusId,
              );
              expect(removeEvents).toHaveLength(1);

              const evt = removeEvents[0];
              const payload = evt.payload as any;
              // statusId 与配置一致
              expect(payload.statusId).toBe(safeStatusId);
              // targetId 正确
              expect(payload.targetId).toBe('1');
              // stacks = min(removeValue ?? currentStacks, currentStacks)
              const expectedStacks = Math.min(removeValue ?? currentStacks, currentStacks);
              expect(payload.stacks).toBe(expectedStacks);
              // timestamp 正确
              expect(evt.timestamp).toBe(2000);
            }

            // removeStatus 不影响伤害计算（除非 tokenDef 同时有 modifyStat）
            // 这里只有 removeStatus 动作，所以 finalDamage = baseDamage
            expect(result.finalDamage).toBe(baseDamage);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  it(
    // Feature: unified-damage-buff-system, Property 3 补充: 多个 removeStatus 动作独立生成事件
    '同一 PassiveTrigger 包含多个 removeStatus 动作时，每个独立生成 STATUS_REMOVED 事件',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbStacks(),
          fc.integer({ min: 2, max: 5 }), // 2~5 个不同的 removeStatus 动作
          (baseDamage, triggerStacks, actionCount) => {
            // 生成不同的 statusId
            const statusIds = Array.from({ length: actionCount }, (_, i) => `status_${i}`);
            const statusStacks: Record<string, number> = { trigger_token: triggerStacks };
            for (const sid of statusIds) {
              statusStacks[sid] = 2; // 每个状态 2 层
            }

            const tokenDef = {
              id: 'trigger_token',
              name: '触发器',
              category: 'debuff',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: statusIds.map(sid => ({
                  type: 'removeStatus',
                  statusId: sid,
                  value: 1,
                })),
              },
            };

            const state = makeState({
              targetId: '1',
              attackerId: '0',
              targetStatusEffects: statusStacks,
              tokenDefs: [tokenDef],
            });

            const calc = createDamageCalculation({
              source: { playerId: '0' },
              target: { playerId: '1' },
              baseDamage,
              state,
              autoCollectTokens: false,
              autoCollectStatus: true,
              autoCollectShields: false,
              timestamp: 3000,
            });

            const result = calc.resolve();

            // 每个 removeStatus 动作生成一个 STATUS_REMOVED 事件
            const removeEvents = result.sideEffectEvents.filter(
              e => e.type === 'STATUS_REMOVED',
            );
            expect(removeEvents).toHaveLength(actionCount);

            // 每个事件的 statusId 唯一且与配置一致
            const eventStatusIds = removeEvents.map(e => (e.payload as any).statusId);
            expect(new Set(eventStatusIds).size).toBe(actionCount);
            for (const sid of statusIds) {
              expect(eventStatusIds).toContain(sid);
            }

            // 每个事件移除 1 层
            for (const evt of removeEvents) {
              expect((evt.payload as any).stacks).toBe(1);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
