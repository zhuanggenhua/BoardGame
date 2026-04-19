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
} from '../domain/abilityInteractionHandlers';

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
  });

  describe('处理函数签名验证', () => {
    it('处理函数接收正确的参数', () => {
      let receivedArgs: any = null;

      const handler = (args: any) => {
        receivedArgs = args;
        return { events: [] };
      };

      registerInteractionHandler('test_ability', handler);

      const found = getInteractionHandler('test_ability');
      const testArgs = {
        state: { core: {}, sys: {} },
        optionId: 'option-1',
        sourceId: 'test_ability',
      };

      found?.(testArgs);

      expect(receivedArgs).toEqual(testArgs);
    });

    it('处理函数返回正确的结果格式', () => {
      const handler = () => ({
        events: [{ type: 'test:event', payload: {} }],
        matchState: { core: {}, sys: {} },
      });

      registerInteractionHandler('test_ability', handler);

      const found = getInteractionHandler('test_ability');
      const result = found?.({
        state: { core: {}, sys: {} },
        optionId: 'option-1',
        sourceId: 'test_ability',
      });

      expect(result).toHaveProperty('events');
      expect(Array.isArray(result?.events)).toBe(true);
    });
  });
});
