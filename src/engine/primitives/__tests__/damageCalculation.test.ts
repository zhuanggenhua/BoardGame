/**
 * 伤害计算管线单元测试
 */

import { describe, expect, it } from 'vitest';
import {
  createDamageCalculation,
  createBatchDamageCalculation,
  type DamageCalculationConfig,
} from '../damageCalculation';

// ============================================================================
// Mock 数据工厂
// ============================================================================

function mockState(overrides?: any) {
  return {
    core: {
      players: {
        '0': {
          tokens: {},
          statusEffects: {},
          damageShields: [],
        },
        '1': {
          tokens: {},
          statusEffects: {},
          damageShields: [],
        },
      },
      tokenDefinitions: [],
      ...overrides?.core,
    },
    ...overrides,
  };
}

function mockStateWithTokens(playerId: string, tokens: Record<string, number>) {
  const state = mockState();
  state.core.players[playerId].tokens = tokens;
  state.core.tokenDefinitions = [
    { id: 'fire_mastery', name: 'tokens.fire_mastery.name', damageBonus: 1 },
    { id: 'taiji', name: 'tokens.taiji.name', damageBonus: 1 },
  ];
  return state;
}

function mockStateWithStatus(playerId: string, statusEffects: Record<string, number>) {
  const state = mockState();
  state.core.players[playerId].statusEffects = statusEffects;
  state.core.tokenDefinitions = [
    { id: 'armor', name: 'status.armor.name', damageReduction: 1 },
    { id: 'burn', name: 'status.burn.name' },
  ];
  return state;
}

function mockStateWithShield(shieldValue: number) {
  const state = mockState();
  state.core.players['1'].damageShields = [
    { value: shieldValue, sourceId: 'test-shield' },
  ];
  return state;
}

// ============================================================================
// 测试套件
// ============================================================================

describe('DamageCalculation', () => {
  describe('基础功能', () => {
    it('无修正时返回基础伤害', () => {
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 5,
        state: mockState(),
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: false,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(5);
      expect(result.modifiers).toHaveLength(0);
      expect(result.breakdown.base.value).toBe(5);
      expect(result.breakdown.steps).toHaveLength(0);
    });
    
    it('加法修正正确应用', () => {
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 5,
        state: mockState(),
        additionalModifiers: [
          { id: 'mod1', type: 'flat', value: 3, source: 'token1' },
          { id: 'mod2', type: 'flat', value: 2, source: 'token2' },
        ],
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: false,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(10); // 5 + 3 + 2
      expect(result.modifiers).toHaveLength(2);
      expect(result.breakdown.steps).toHaveLength(2);
      expect(result.breakdown.steps[1].runningTotal).toBe(10);
    });
    
    it('乘法修正在加法后应用', () => {
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 5,
        state: mockState(),
        additionalModifiers: [
          { id: 'mod1', type: 'flat', value: 3, source: 'token', priority: 10 },
          { id: 'mod2', type: 'percent', value: 100, source: 'status', priority: 20 },
        ],
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: false,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(16); // (5 + 3) * 2
      expect(result.breakdown.steps).toHaveLength(2);
    });
    
    it('护盾减免在最后应用', () => {
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 10,
        state: mockStateWithShield(3),
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: true,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(7); // 10 - 3
      expect(result.actualDamage).toBe(7);
    });
    
    it('伤害不会为负数', () => {
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 3,
        state: mockStateWithShield(10),
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: true,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(0);
      expect(result.actualDamage).toBe(0);
    });
  });
  
  describe('自动收集', () => {
    it('自动收集 Token 修正', () => {
      const state = mockStateWithTokens('0', { fire_mastery: 3 });
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 5,
        state,
        autoCollectTokens: true,
        autoCollectStatus: false,
        autoCollectShields: false,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(8); // 5 + 3
      expect(result.modifiers.some(m => m.sourceId === 'fire_mastery')).toBe(true);
    });
    
    it('自动收集状态修正', () => {
      const state = mockStateWithStatus('1', { armor: 2 });
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 10,
        state,
        autoCollectTokens: false,
        autoCollectStatus: true,
        autoCollectShields: false,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(8); // 10 - 2
    });
    
    it('自动收集多个护盾', () => {
      const state = mockState();
      state.core.players['1'].damageShields = [
        { value: 2, sourceId: 'shield1' },
        { value: 3, sourceId: 'shield2' },
      ];
      
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 10,
        state,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectShields: true,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(5); // 10 - 5
    });
  });
  
  describe('条件修正', () => {
    it('条件满足时应用修正', () => {
      const state = mockStateWithStatus('1', { burn: 1 });
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 5,
        state,
        additionalModifiers: [
          {
            id: 'burn-bonus',
            type: 'flat',
            value: 2,
            source: 'burn-bonus',
            condition: (ctx) => {
              const targetPlayer = ctx.state.core.players[ctx.target.playerId];
              return (targetPlayer.statusEffects.burn || 0) > 0;
            },
          },
        ],
        autoCollectStatus: false,
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(7); // 5 + 2
    });
    
    it('条件不满足时跳过修正', () => {
      const state = mockState();
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 5,
        state,
        additionalModifiers: [
          {
            id: 'burn-bonus',
            type: 'flat',
            value: 2,
            source: 'burn-bonus',
            condition: (ctx) => {
              const targetPlayer = ctx.state.core.players[ctx.target.playerId];
              return (targetPlayer.statusEffects.burn || 0) > 0;
            },
          },
        ],
      });
      
      const result = calc.resolve();
      expect(result.finalDamage).toBe(5); // 条件不满足，不加成
    });
  });
  
  describe('事件生成', () => {
    it('生成标准 DAMAGE_DEALT 事件', () => {
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'test' },
        target: { playerId: '1' },
        baseDamage: 5,
        state: mockState(),
        timestamp: 1000,
      });
      
      const events = calc.toEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('DAMAGE_DEALT');
      expect(events[0].payload.targetId).toBe('1');
      expect(events[0].payload.amount).toBe(5);
      expect(events[0].payload.breakdown).toBeDefined();
      expect(events[0].timestamp).toBe(1000);
    });
    
    it('breakdown 包含完整计算链路', () => {
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'flame-strike' },
        target: { playerId: '1' },
        baseDamage: 5,
        state: mockState(),
        additionalModifiers: [
          { 
            id: 'fm', 
            type: 'flat', 
            value: 3, 
            source: 'fire_mastery', 
            description: 'tokens.fire_mastery.name' 
          },
        ],
      });
      
      const events = calc.toEvents();
      const breakdown = events[0].payload.breakdown;
      
      expect(breakdown.base.value).toBe(5);
      expect(breakdown.base.sourceId).toBe('flame-strike');
      expect(breakdown.steps).toHaveLength(1);
      expect(breakdown.steps[0].value).toBe(3);
      expect(breakdown.steps[0].sourceId).toBe('fire_mastery');
      expect(breakdown.steps[0].runningTotal).toBe(8);
    });
  });
  
  describe('批处理', () => {
    it('批量计算多个目标的伤害', () => {
      const calcs = createBatchDamageCalculation({
        source: { playerId: '0', abilityId: 'aoe' },
        targets: [
          { playerId: '1' },
          { playerId: '2' },
        ],
        baseDamage: 5,
        state: mockState({
          core: {
            players: {
              '0': { tokens: {}, statusEffects: {}, damageShields: [] },
              '1': { tokens: {}, statusEffects: {}, damageShields: [] },
              '2': { tokens: {}, statusEffects: {}, damageShields: [] },
            },
            tokenDefinitions: [],
          },
        }),
      });
      
      expect(calcs).toHaveLength(2);
      expect(calcs[0].resolve().finalDamage).toBe(5);
      expect(calcs[1].resolve().finalDamage).toBe(5);
    });
  });
  
  describe('复杂场景', () => {
    it('Token + 状态 + 护盾的完整链路', () => {
      const state = mockState({
        core: {
          players: {
            '0': {
              tokens: { fire_mastery: 3 },
              statusEffects: {},
              damageShields: [],
            },
            '1': {
              tokens: {},
              statusEffects: { armor: 1 },
              damageShields: [{ value: 2, sourceId: 'shield' }],
            },
          },
          tokenDefinitions: [
            { id: 'fire_mastery', name: 'tokens.fire_mastery.name', damageBonus: 1 },
            { id: 'armor', name: 'status.armor.name', damageReduction: 1 },
          ],
        },
      });
      
      const calc = createDamageCalculation({
        source: { playerId: '0', abilityId: 'flame-strike' },
        target: { playerId: '1' },
        baseDamage: 5,
        state,
      });
      
      const result = calc.resolve();
      
      // 5 (base) + 3 (fire_mastery) - 1 (armor) - 2 (shield) = 5
      expect(result.finalDamage).toBe(5);
      expect(result.breakdown.steps.length).toBeGreaterThan(0);
    });
  });

  describe('PassiveTrigger 增强', () => {
    // 辅助：构造带 passiveTrigger 的 tokenDefinition
    function makePassiveTriggerState(opts: {
      targetStatusEffects?: Record<string, number>;
      targetTokens?: Record<string, number>;
      tokenDefs: any[];
    }) {
      return mockState({
        core: {
          players: {
            '0': { tokens: {}, statusEffects: {}, damageShields: [] },
            '1': {
              tokens: opts.targetTokens ?? {},
              statusEffects: opts.targetStatusEffects ?? {},
              damageShields: [],
            },
          },
          tokenDefinitions: opts.tokenDefs,
        },
      });
    }

    describe('removeStatus 动作', () => {
      it('生成 STATUS_REMOVED 事件并添加到 sideEffectEvents', () => {
        const state = makePassiveTriggerState({
          targetStatusEffects: { poison: 2, burn: 3 },
          tokenDefs: [{
            id: 'poison',
            name: '中毒',
            category: 'debuff',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'removeStatus', statusId: 'burn', value: 1 },
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 5,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
          timestamp: 1000,
        });

        const result = calc.resolve();
        expect(result.finalDamage).toBe(5); // removeStatus 不影响伤害
        expect(result.sideEffectEvents).toHaveLength(1);
        expect(result.sideEffectEvents[0].type).toBe('STATUS_REMOVED');
        expect(result.sideEffectEvents[0].payload).toEqual({
          targetId: '1',
          statusId: 'burn',
          stacks: 1,
        });
        expect(result.sideEffectEvents[0].timestamp).toBe(1000);
      });

      it('移除层数不超过当前层数', () => {
        const state = makePassiveTriggerState({
          targetStatusEffects: { poison: 1, burn: 2 },
          tokenDefs: [{
            id: 'poison',
            name: '中毒',
            category: 'debuff',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'removeStatus', statusId: 'burn', value: 5 }, // 请求移除 5 层，但只有 2 层
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 5,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
        });

        const result = calc.resolve();
        expect(result.sideEffectEvents).toHaveLength(1);
        expect(result.sideEffectEvents[0].payload.stacks).toBe(2); // min(5, 2)
      });

      it('目标无该状态时不生成事件', () => {
        const state = makePassiveTriggerState({
          targetStatusEffects: { poison: 1 },
          tokenDefs: [{
            id: 'poison',
            name: '中毒',
            category: 'debuff',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'removeStatus', statusId: 'burn' }, // 目标没有 burn
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 5,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
        });

        const result = calc.resolve();
        expect(result.sideEffectEvents).toHaveLength(0);
      });

      it('未指定 value 时移除全部层数', () => {
        const state = makePassiveTriggerState({
          targetStatusEffects: { poison: 1, burn: 4 },
          tokenDefs: [{
            id: 'poison',
            name: '中毒',
            category: 'debuff',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'removeStatus', statusId: 'burn' }, // 无 value，移除全部
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 5,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
        });

        const result = calc.resolve();
        expect(result.sideEffectEvents).toHaveLength(1);
        expect(result.sideEffectEvents[0].payload.stacks).toBe(4);
      });
    });

    describe('custom 动作', () => {
      it('调用 handler 并将 preventAmount 转为负值 flat modifier', () => {
        const state = makePassiveTriggerState({
          targetTokens: { evasion: 2 },
          tokenDefs: [{
            id: 'evasion',
            name: '闪避',
            category: 'token',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'custom', customActionId: 'PREVENT_DAMAGE' },
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 10,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
          passiveTriggerHandler: {
            handleCustomAction: (_actionId, ctx) => ({
              events: [{
                type: 'PREVENT_DAMAGE',
                payload: { amount: 3, targetId: ctx.targetId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: ctx.timestamp,
              }],
              preventAmount: 3,
            }),
          },
          timestamp: 1000,
        });

        const result = calc.resolve();
        expect(result.finalDamage).toBe(7); // 10 - 3
        expect(result.sideEffectEvents).toHaveLength(1);
        expect(result.sideEffectEvents[0].type).toBe('PREVENT_DAMAGE');
      });

      it('未注入 handler 时跳过 custom 动作（向后兼容）', () => {
        const state = makePassiveTriggerState({
          targetTokens: { evasion: 1 },
          tokenDefs: [{
            id: 'evasion',
            name: '闪避',
            category: 'token',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'custom', customActionId: 'PREVENT_DAMAGE' },
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 10,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
          // 不注入 passiveTriggerHandler
        });

        const result = calc.resolve();
        expect(result.finalDamage).toBe(10); // 无 handler，不减伤
        expect(result.sideEffectEvents).toHaveLength(0);
      });

      it('handler 抛出异常时跳过该动作，伤害计算继续', () => {
        const state = makePassiveTriggerState({
          targetTokens: { evasion: 1 },
          tokenDefs: [{
            id: 'evasion',
            name: '闪避',
            category: 'token',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'custom', customActionId: 'BROKEN_ACTION' },
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 10,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
          passiveTriggerHandler: {
            handleCustomAction: () => {
              throw new Error('handler 内部错误');
            },
          },
        });

        const result = calc.resolve();
        expect(result.finalDamage).toBe(10); // 异常被捕获，伤害不变
        expect(result.sideEffectEvents).toHaveLength(0);
      });

      it('handler 传入正确的上下文参数', () => {
        let capturedContext: any = null;
        const state = makePassiveTriggerState({
          targetTokens: { evasion: 3 },
          tokenDefs: [{
            id: 'evasion',
            name: '闪避',
            category: 'token',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'custom', customActionId: 'TEST_ACTION' },
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'flame-strike' },
          target: { playerId: '1' },
          baseDamage: 8,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
          passiveTriggerHandler: {
            handleCustomAction: (actionId, ctx) => {
              capturedContext = { actionId, ...ctx };
              return { events: [], preventAmount: 0 };
            },
          },
          timestamp: 2000,
        });

        calc.resolve();
        expect(capturedContext).not.toBeNull();
        expect(capturedContext.actionId).toBe('TEST_ACTION');
        expect(capturedContext.targetId).toBe('1');
        expect(capturedContext.attackerId).toBe('0');
        expect(capturedContext.sourceAbilityId).toBe('flame-strike');
        expect(capturedContext.damageAmount).toBe(8);
        expect(capturedContext.tokenId).toBe('evasion');
        expect(capturedContext.tokenStacks).toBe(3);
        expect(capturedContext.timestamp).toBe(2000);
      });

      it('preventAmount 为 0 时不添加 modifier', () => {
        const state = makePassiveTriggerState({
          targetTokens: { evasion: 1 },
          tokenDefs: [{
            id: 'evasion',
            name: '闪避',
            category: 'token',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'custom', customActionId: 'NO_PREVENT' },
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 10,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
          passiveTriggerHandler: {
            handleCustomAction: () => ({
              events: [{ type: 'SOME_EVENT', payload: {}, sourceCommandType: 'ABILITY_EFFECT', timestamp: 0 }],
              preventAmount: 0,
            }),
          },
        });

        const result = calc.resolve();
        expect(result.finalDamage).toBe(10); // preventAmount=0，不减伤
        expect(result.sideEffectEvents).toHaveLength(1); // 但副作用事件仍然收集
      });
    });

    describe('混合动作', () => {
      it('同一 PassiveTrigger 包含 modifyStat + removeStatus + custom', () => {
        const state = makePassiveTriggerState({
          targetStatusEffects: { thorns: 2, burn: 1 },
          tokenDefs: [{
            id: 'thorns',
            name: '荆棘',
            category: 'debuff',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [
                { type: 'modifyStat', value: -1 },       // 每层减 1 伤害
                { type: 'removeStatus', statusId: 'burn' }, // 移除 burn
                { type: 'custom', customActionId: 'REFLECT' },
              ],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 10,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
          passiveTriggerHandler: {
            handleCustomAction: () => ({
              events: [{ type: 'REFLECT_DAMAGE', payload: { amount: 2 }, sourceCommandType: 'ABILITY_EFFECT', timestamp: 0 }],
              preventAmount: 2,
            }),
          },
        });

        const result = calc.resolve();
        // 10 - 2 (modifyStat: -1 * 2 stacks) - 2 (custom preventAmount) = 6
        expect(result.finalDamage).toBe(6);
        // sideEffectEvents: STATUS_REMOVED + REFLECT_DAMAGE
        expect(result.sideEffectEvents).toHaveLength(2);
        expect(result.sideEffectEvents[0].type).toBe('STATUS_REMOVED');
        expect(result.sideEffectEvents[1].type).toBe('REFLECT_DAMAGE');
      });
    });

    describe('debuff vs token category', () => {
      it('debuff category 从 statusEffects 取层数', () => {
        const state = makePassiveTriggerState({
          targetStatusEffects: { armor: 3 },
          targetTokens: {},
          tokenDefs: [{
            id: 'armor',
            name: '护甲',
            category: 'debuff',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [{ type: 'modifyStat', value: -1 }],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 10,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
        });

        const result = calc.resolve();
        expect(result.finalDamage).toBe(7); // 10 - 3
      });

      it('非 debuff category 从 tokens 取层数', () => {
        const state = makePassiveTriggerState({
          targetStatusEffects: {},
          targetTokens: { evasion: 2 },
          tokenDefs: [{
            id: 'evasion',
            name: '闪避',
            category: 'token',
            passiveTrigger: {
              timing: 'onDamageReceived',
              actions: [{ type: 'modifyStat', value: -2 }],
            },
          }],
        });

        const calc = createDamageCalculation({
          source: { playerId: '0', abilityId: 'test' },
          target: { playerId: '1' },
          baseDamage: 10,
          state,
          autoCollectTokens: false,
          autoCollectShields: false,
        });

        const result = calc.resolve();
        expect(result.finalDamage).toBe(6); // 10 - (2 * 2)
      });
    });
  });
});
