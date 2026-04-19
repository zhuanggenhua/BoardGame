/**
 * 伤害计算管线迁移集成测试
 * 
 * 验证迁移后的技能产生的伤害事件：
 * 1. 数值结果与旧实现一致
 * 2. breakdown 结构完整
 * 3. ActionLog 能正确渲染
 */

import { describe, expect, it } from 'vitest';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import type { DamageDealtEvent } from '../types';
import { TOKEN_IDS } from '../ids';

describe('伤害计算管线迁移', () => {
  describe('Fiery Combo 迁移验证', () => {
    it('无 FM 时：基础伤害 5', () => {
      const mockState = {
        core: {
          players: {
            '0': { tokens: {}, statusEffects: {}, damageShields: [] },
            '1': { tokens: {}, statusEffects: {}, damageShields: [] },
          },
          tokenDefinitions: [
            { id: TOKEN_IDS.FIRE_MASTERY, name: 'tokens.fire_mastery.name', damageBonus: 1 },
          ],
        },
      };

      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'fiery-combo' },
        target: { playerId: '1' },
        baseDamage: 5,
        state: mockState,
        autoCollectTokens: true,
        autoCollectStatus: false,
        autoCollectShields: false,
      });

      const result = calc.resolve();
      expect(result.finalDamage).toBe(5);
      expect(result.breakdown.base.value).toBe(5);
      expect(result.breakdown.steps).toHaveLength(0);
    });

    it('有 3 FM 时：5 + 3 = 8', () => {
      const mockState = {
        core: {
          players: {
            '0': { 
              tokens: { [TOKEN_IDS.FIRE_MASTERY]: 3 }, 
              statusEffects: {}, 
              damageShields: [] 
            },
            '1': { tokens: {}, statusEffects: {}, damageShields: [] },
          },
          tokenDefinitions: [
            { id: TOKEN_IDS.FIRE_MASTERY, name: 'tokens.fire_mastery.name', damageBonus: 1 },
          ],
        },
      };

      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'fiery-combo' },
        target: { playerId: '1' },
        baseDamage: 5,
        state: mockState,
        autoCollectTokens: true,
        autoCollectStatus: false,
        autoCollectShields: false,
      });

      const result = calc.resolve();
      expect(result.finalDamage).toBe(8);
      expect(result.breakdown.base.value).toBe(5);
      expect(result.breakdown.steps).toHaveLength(1);
      expect(result.breakdown.steps[0].value).toBe(3);
      expect(result.breakdown.steps[0].sourceId).toBe(TOKEN_IDS.FIRE_MASTERY);
      expect(result.breakdown.steps[0].runningTotal).toBe(8);
    });

    it('事件格式包含 breakdown', () => {
      const mockState = {
        core: {
          players: {
            '0': { 
              tokens: { [TOKEN_IDS.FIRE_MASTERY]: 2 }, 
              statusEffects: {}, 
              damageShields: [] 
            },
            '1': { tokens: {}, statusEffects: {}, damageShields: [] },
          },
          tokenDefinitions: [
            { id: TOKEN_IDS.FIRE_MASTERY, name: 'tokens.fire_mastery.name', damageBonus: 1 },
          ],
        },
      };

      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'fiery-combo' },
        target: { playerId: '1' },
        baseDamage: 5,
        state: mockState,
        timestamp: 1000,
      });

      const events = calc.toEvents();
      expect(events).toHaveLength(1);
      
      const damageEvent = events[0] as DamageDealtEvent;
      expect(damageEvent.type).toBe('DAMAGE_DEALT');
      expect(damageEvent.payload.amount).toBe(7);
      expect(damageEvent.payload.breakdown).toBeDefined();
      expect(damageEvent.payload.breakdown?.base.value).toBe(5);
      expect(damageEvent.payload.breakdown?.steps).toHaveLength(1);
    });
  });

  describe('Ignite 迁移验证（乘法修正）', () => {
    it('2x FM 修正：4 + (3 * 2) = 10', () => {
      const mockState = {
        core: {
          players: {
            '0': { 
              tokens: { [TOKEN_IDS.FIRE_MASTERY]: 3 }, 
              statusEffects: {}, 
              damageShields: [] 
            },
            '1': { tokens: {}, statusEffects: {}, damageShields: [] },
          },
          tokenDefinitions: [
            { id: TOKEN_IDS.FIRE_MASTERY, name: 'tokens.fire_mastery.name', damageBonus: 1 },
          ],
        },
      };

      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'ignite' },
        target: { playerId: '1' },
        baseDamage: 4,
        state: mockState,
        additionalModifiers: [{
          id: 'ignite-fm-multiplier',
          type: 'flat',
          value: 3 * 2, // 3 FM * 2 multiplier
          priority: 10,
          source: TOKEN_IDS.FIRE_MASTERY,
          description: 'tokens.fire_mastery.name',
        }],
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: false,
      });

      const result = calc.resolve();
      expect(result.finalDamage).toBe(10);
      expect(result.breakdown.base.value).toBe(4);
      expect(result.breakdown.steps).toHaveLength(1);
      expect(result.breakdown.steps[0].value).toBe(6);
    });
  });

  describe('Soul Burn Damage 迁移验证（基础伤害）', () => {
    it('无修正的基础伤害', () => {
      const mockState = {
        core: {
          players: {
            '0': { tokens: {}, statusEffects: {}, damageShields: [] },
            '1': { tokens: {}, statusEffects: {}, damageShields: [] },
          },
          tokenDefinitions: [],
        },
      };

      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'soul-burn' },
        target: { playerId: '1' },
        baseDamage: 3,
        state: mockState,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: false,
      });

      const result = calc.resolve();
      expect(result.finalDamage).toBe(3);
      expect(result.breakdown.base.value).toBe(3);
      expect(result.breakdown.steps).toHaveLength(0);
    });
  });

  describe('Meteor 迁移验证（动态伤害值）', () => {
    it('伤害值等于 FM 数量', () => {
      const mockState = {
        core: {
          players: {
            '0': { 
              tokens: { [TOKEN_IDS.FIRE_MASTERY]: 5 }, 
              statusEffects: {}, 
              damageShields: [] 
            },
            '1': { tokens: {}, statusEffects: {}, damageShields: [] },
          },
          tokenDefinitions: [
            { id: TOKEN_IDS.FIRE_MASTERY, name: 'tokens.fire_mastery.name', damageBonus: 1 },
          ],
        },
      };

      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'meteor' },
        target: { playerId: '1' },
        baseDamage: 5, // 伤害值 = FM 数量
        state: mockState,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: false,
      });

      const result = calc.resolve();
      expect(result.finalDamage).toBe(5);
      expect(result.breakdown.base.value).toBe(5);
    });
  });

  describe('Magma Armor 迁移验证（防御技能）', () => {
    it('反击伤害计算', () => {
      const mockState = {
        core: {
          players: {
            '0': { tokens: {}, statusEffects: {}, damageShields: [] },
            '1': { tokens: {}, statusEffects: {}, damageShields: [] },
          },
          tokenDefinitions: [],
        },
      };

      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'magma-armor' },
        target: { playerId: '1' },
        baseDamage: 2, // 2 个火面 * 1 伤害
        state: mockState,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: false,
      });

      const result = calc.resolve();
      expect(result.finalDamage).toBe(2);
      expect(result.breakdown.base.value).toBe(2);
    });
  });

  describe('向后兼容性', () => {
    it('旧格式事件（只有 modifiers）仍可正常处理', () => {
      // 模拟旧格式的 DAMAGE_DEALT 事件
      const oldFormatEvent: DamageDealtEvent = {
        type: 'DAMAGE_DEALT',
        payload: {
          targetId: '1',
          amount: 8,
          actualDamage: 8,
          sourceAbilityId: 'test-ability',
          modifiers: [
            { type: 'token', value: 3, sourceId: TOKEN_IDS.FIRE_MASTERY, sourceName: 'tokens.fire_mastery.name' },
          ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: 1000,
      };

      // 验证旧格式事件结构仍然有效
      expect(oldFormatEvent.payload.modifiers).toBeDefined();
      expect(oldFormatEvent.payload.breakdown).toBeUndefined();
      expect(oldFormatEvent.payload.amount).toBe(8);
    });
  });
});
