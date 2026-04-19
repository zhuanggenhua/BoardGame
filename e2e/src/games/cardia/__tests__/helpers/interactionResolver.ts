/**
 * 测试辅助函数：交互解决器
 * 
 * 用于简化测试中的交互解决模式。
 * 当执行器返回交互对象时，自动解决交互并返回最终事件。
 */

import type { CardiaCore } from '../../domain/core-types';
import type { CardiaAbilityContext } from '../../domain/abilityExecutor';
import type { MatchState, RandomFn } from '../../../../engine/types';
import { getInteractionHandler } from '../../domain/abilityInteractionHandlers';

/**
 * 执行能力并自动解决交互
 * 
 * @param executorFn 能力执行器函数
 * @param context 能力上下文
 * @param interactionResponse 交互响应（如果执行器返回交互）
 * @returns 最终的执行结果（包含事件）
 */
export function executeAndResolveInteraction(
  executorFn: (ctx: CardiaAbilityContext) => { events: any[]; interaction?: any },
  context: CardiaAbilityContext,
  interactionResponse?: any
): { events: any[] } {
  const result = executorFn(context);
  
  // 如果没有交互，直接返回结果
  if (!result.interaction) {
    return { events: result.events || [] };
  }
  
  // 如果有交互但没有提供响应，抛出错误
  if (!interactionResponse) {
    throw new Error(
      `执行器返回了交互 (type: ${result.interaction.type})，但测试未提供交互响应。` +
      `请提供 interactionResponse 参数。`
    );
  }
  
  // 获取交互处理器
  const handler = getInteractionHandler(context.abilityId);
  
  if (!handler) {
    throw new Error(`未找到能力 ${context.abilityId} 的交互处理器`);
  }
  
  // 创建 MatchState
  const state: MatchState<CardiaCore> = {
    core: context.core,
    sys: {
      interaction: {
        current: null,
        queue: [],
      },
      gameover: null,
    },
  };
  
  // 创建 RandomFn
  const random: RandomFn = {
    random: context.random || (() => 0.5),
    d: (max: number) => Math.floor((context.random?.() || 0.5) * max) + 1,
    range: (min: number, max: number) => Math.floor((context.random?.() || 0.5) * (max - min + 1)) + min,
    shuffle: <T>(array: T[]) => {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor((context.random?.() || 0.5) * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
  };
  
  // 调用 handler 解决交互
  const resolved = handler(state, context.playerId, interactionResponse, undefined, random, context.timestamp);
  
  if (!resolved) {
    throw new Error(`交互处理器返回 undefined`);
  }
  
  // 合并初始事件和解决后的事件
  const allEvents = [...(result.events || []), ...(resolved.events || [])];
  
  return {
    events: allEvents,
  };
}

