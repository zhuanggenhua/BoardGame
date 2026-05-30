/**
 * SmashUp 交互处理函数注册表测试
 * 
 * 验证注册表机制正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerInteractionHandler,
  getInteractionHandler,
  clearInteractionHandlers,
  getRegisteredInteractionHandlerIds,
  registerPodInteractionAliases,
} from '../domain/abilityInteractionHandlers';
import { registerAbilityRuntimePrompt } from '../domain/abilityRuntime';

describe('SmashUp 交互处理函数注册表', () => {
  beforeEach(() => {
    clearInteractionHandlers();
  });

  describe('基础功能', () => {
    it('注册后可以查找到处理函数', () => {
      const handler = () => ({ events: [] });
      registerInteractionHandler('test_ability', handler);

      const found = getInteractionHandler('test_ability');
      expect(found).toBe(handler);
    });

    it('未注册的 abilityId 返回 undefined', () => {
      const found = getInteractionHandler('non_existent');
      expect(found).toBeUndefined();
    });

    it('可以注册多个不同的处理函数', () => {
      const handler1 = () => ({ events: [] });
      const handler2 = () => ({ events: [] });

      registerInteractionHandler('ability_1', handler1);
      registerInteractionHandler('ability_2', handler2);

      expect(getInteractionHandler('ability_1')).toBe(handler1);
      expect(getInteractionHandler('ability_2')).toBe(handler2);
    });

    it('重复注册会覆盖旧的处理函数', () => {
      const handler1 = () => ({ events: [] });
      const handler2 = () => ({ events: [] });

      registerInteractionHandler('test_ability', handler1);
      registerInteractionHandler('test_ability', handler2);

      const found = getInteractionHandler('test_ability');
      expect(found).toBe(handler2);
      expect(found).not.toBe(handler1);
    });

    it('clearInteractionHandlers 清空所有注册', () => {
      const handler = () => ({ events: [] });
      registerInteractionHandler('ability_1', handler);
      registerInteractionHandler('ability_2', handler);

      clearInteractionHandlers();

      expect(getInteractionHandler('ability_1')).toBeUndefined();
      expect(getInteractionHandler('ability_2')).toBeUndefined();
    });

    it('POD interaction alias 不应给已是 POD 专用的子 handler 再追加一层 _pod', () => {
      const baseChooseHandler = () => ({ events: [] });
      const podChooseHandler = () => ({ events: [] });

      registerInteractionHandler('alias_card_choose_base', baseChooseHandler);
      registerInteractionHandler('alias_card_pod_choose_base', podChooseHandler);

      registerPodInteractionAliases();

      const ids = getRegisteredInteractionHandlerIds();
      expect(getInteractionHandler('alias_card_choose_base_pod')).toBe(baseChooseHandler);
      expect(ids.has('alias_card_choose_base_pod')).toBe(false);
      expect(ids.has('alias_card_pod_choose_base')).toBe(true);
      expect(getInteractionHandler('alias_card_pod_choose_base_pod')).toBeUndefined();
      expect(ids.has('alias_card_pod_choose_base_pod')).toBe(false);
    });

    it('getRegisteredInteractionHandlerIds 不应暴露无实体的自动 _pod interaction handler id', () => {
      const handler = () => ({ events: [] });

      registerInteractionHandler('helper_choose_base', handler);
      registerPodInteractionAliases();

      const ids = getRegisteredInteractionHandlerIds();
      expect(getInteractionHandler('helper_choose_base_pod')).toBe(handler);
      expect(ids.has('helper_choose_base_pod')).toBe(false);
    });

    it('runtime prompt source 应通过 registry bridge 暴露，但不应伪装成业务 source 的普通 handler', () => {
      const runtimeHandler = () => ({
        state: { core: {} as any, sys: {} as any },
        events: [{ type: 'runtime:bridge' } as any],
      });

      registerAbilityRuntimePrompt('runtime_bridge_test_prompt', runtimeHandler);

      const ids = getRegisteredInteractionHandlerIds();
      expect(ids.has('runtime_bridge_test_prompt')).toBe(true);
      expect(getInteractionHandler('runtime_bridge_test_prompt')).toBeDefined();
      expect(getInteractionHandler('runtime_bridge_test_business_source')).toBeUndefined();
    });
  });

  describe('处理函数签名验证', () => {
    it('处理函数接收正确的参数', () => {
      let receivedArgs: any[] | null = null;

      const handler = (...args: any[]) => {
        receivedArgs = args;
        return { state: { core: {}, sys: {} }, events: [] };
      };

      registerInteractionHandler('test_ability', handler);

      const found = getInteractionHandler('test_ability');
      const matchState = { core: {}, sys: {} } as any;
      const interactionData = { sourceId: 'test_ability', optionId: 'option-1' };
      const random = { random: () => 0.5, d: () => 1, range: (min: number) => min, shuffle: <T>(items: T[]) => items };

      found?.(matchState, '0', { chosen: 'yes' }, interactionData, random, 123);

      expect(receivedArgs).toEqual([
        matchState,
        '0',
        { chosen: 'yes' },
        interactionData,
        random,
        123,
      ]);
    });

    it('处理函数返回正确的结果格式', () => {
      const handler = () => ({
        events: [{ type: 'test:event', payload: {} }],
        state: { core: {}, sys: {} },
      });

      registerInteractionHandler('test_ability', handler);

      const found = getInteractionHandler('test_ability');
      const result = found?.(
        { core: {}, sys: {} } as any,
        '0',
        { chosen: 'yes' },
        { sourceId: 'test_ability', optionId: 'option-1' },
        { random: () => 0.5, d: () => 1, range: (min: number) => min, shuffle: <T>(items: T[]) => items },
        123,
      );

      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('state');
      expect(Array.isArray(result?.events)).toBe(true);
    });
  });
});
