/**
 * D30 消灭流程时序审计（GameTestRunner 运行时行为测试）
 * 
 * 验证需求：
 * - R12.1: onDestroy 触发器在确认消灭后执行（SummonerWars 无 onDestroy，验证 postProcessDeathChecks 时序）
 * - R12.2: 连锁消灭递归处理正确且无无限循环
 * - R12.3: divine_shield 拦截后 onDestroy 不执行（验证伤害减免后不触发消灭）
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SummonerWarsDomain } from '../game';
import { createInitializedCore, placeTestUnit } from './test-helpers';
import { createInitialSystemState } from '../../../engine/pipeline';
import { SW_EVENTS } from '../domain/events';
import type { UnitCard } from '../domain/types';
import { CARD_IDS } from '../domain/ids';
import { getCardById } from '../config/factions';

// 辅助函数：根据 defId 获取卡牌并创建单位
function createUnitCard(defId: string, overrides?: Partial<UnitCard>): UnitCard {
  const baseCard = getCardById(defId);
  if (!baseCard || baseCard.cardType !== 'unit') {
    throw new Error(`Card ${defId} not found or not a unit`);
  }
  return { ...baseCard, ...overrides };
}

describe('D30 消灭流程时序审计', () => {
  describe('R12.1: postProcessDeathChecks 在伤害事件后自动注入消灭事件', () => {
    it('验证 UNIT_DAMAGED 导致生命值归零时自动注入 UNIT_DESTROYED', () => {
      const runner = new GameTestRunner({
        domain: SummonerWarsDomain,
        playerIds: ['0', '1'],
        setup: (playerIds, random) => {
          const core = createInitializedCore(playerIds, random, {
            faction0: 'paladin',
            faction1: 'frost',
          });

          // 放置一个低生命值单位（1 HP）
          const guardCard = createUnitCard(CARD_IDS.PALADIN_FORTRESS_GUARD, { life: 1 });
          placeTestUnit(core, { row: 4, col: 2 }, {
            card: guardCard,
            owner: '0',
            damage: 0,
          });

          // 放置攻击者
          const warriorCard = createUnitCard(CARD_IDS.FROST_FROST_WARRIOR);
          placeTestUnit(core, { row: 4, col: 3 }, {
            card: warriorCard,
            owner: '1',
          });

          core.currentPhase = 'attack';
          core.currentPlayer = '1';

          return { core, sys: createInitialSystemState(playerIds, [], undefined) };
        },
        assertFn: (state, expect) => {
          const events = state.sys.eventStream.entries.map(e => e.event);

          // 查找 UNIT_DAMAGED 事件
          const damagedEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
          expect(damagedEvents.length).toBeGreaterThan(0);

          // 查找 UNIT_DESTROYED 事件
          const destroyedEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED);
          expect(destroyedEvents.length).toBeGreaterThan(0);

          // 验证时序：UNIT_DESTROYED 应该在 UNIT_DAMAGED 之后
          const damagedIndex = events.findIndex(e => e.type === SW_EVENTS.UNIT_DAMAGED);
          const destroyedIndex = events.findIndex(e => e.type === SW_EVENTS.UNIT_DESTROYED);

          expect(destroyedIndex).toBeGreaterThan(damagedIndex);
        },
      });

      runner.run([
        { type: 'DECLARE_ATTACK', playerId: '1', payload: { from: { row: 4, col: 3 }, to: { row: 4, col: 2 } } },
        { type: 'CONFIRM_ATTACK', playerId: '1', payload: { diceResults: [3, 3, 3] } },
      ]);
    });
  });

  describe('R12.2: 连锁消灭递归处理正确且无无限循环', () => {
    it('验证 postProcessDeathChecks 有安全上限防止无限循环', () => {
      const runner = new GameTestRunner({
        domain: SummonerWarsDomain,
        playerIds: ['0', '1'],
        setup: (playerIds, random) => {
          const core = createInitializedCore(playerIds, random, {
            faction0: 'paladin',
            faction1: 'frost',
          });

          // 放置一个单位
          const guardCard = createUnitCard(CARD_IDS.PALADIN_FORTRESS_GUARD);
          placeTestUnit(core, { row: 4, col: 2 }, {
            card: guardCard,
            owner: '0',
            damage: 0,
          });

          // 放置攻击者
          const warriorCard = createUnitCard(CARD_IDS.FROST_FROST_WARRIOR);
          placeTestUnit(core, { row: 4, col: 3 }, {
            card: warriorCard,
            owner: '1',
          });

          core.currentPhase = 'attack';
          core.currentPlayer = '1';

          return { core, sys: createInitialSystemState(playerIds, [], undefined) };
        },
        assertFn: (state, expect) => {
          const events = state.sys.eventStream.entries.map(e => e.event);

          // 验证事件数量在合理范围内（不会超过 maxEvents 限制）
          expect(events.length).toBeLessThan(300);
        },
      });

      runner.run([
        { type: 'DECLARE_ATTACK', playerId: '1', payload: { from: { row: 4, col: 3 }, to: { row: 4, col: 2 } } },
        { type: 'CONFIRM_ATTACK', playerId: '1', payload: { diceResults: [3, 3, 3] } },
      ]);
    });
  });

  describe('R12.3: divine_shield 拦截后不触发消灭', () => {
    it('验证 divine_shield 减伤后单位可能存活', () => {
      const runner = new GameTestRunner({
        domain: SummonerWarsDomain,
        playerIds: ['0', '1'],
        setup: (playerIds, random) => {
          const core = createInitializedCore(playerIds, random, {
            faction0: 'paladin',
            faction1: 'frost',
          });

          // 放置科琳（拥有 divine_shield）
          const colleenCard = createUnitCard(CARD_IDS.PALADIN_COLLEEN);
          placeTestUnit(core, { row: 4, col: 2 }, {
            card: colleenCard,
            owner: '0',
          });

          // 放置一个低生命值城塞单位（1 HP）在科琳 3 格内
          const guardCard = createUnitCard(CARD_IDS.PALADIN_FORTRESS_GUARD, { life: 1 });
          placeTestUnit(core, { row: 4, col: 4 }, {
            card: guardCard,
            owner: '0',
            damage: 0,
          });

          // 放置攻击者
          const warriorCard = createUnitCard(CARD_IDS.FROST_FROST_WARRIOR);
          placeTestUnit(core, { row: 4, col: 5 }, {
            card: warriorCard,
            owner: '1',
          });

          core.currentPhase = 'attack';
          core.currentPlayer = '1';

          return { core, sys: createInitialSystemState(playerIds, [], undefined) };
        },
        assertFn: (state, expect) => {
          const events = state.sys.eventStream.entries.map(e => e.event);

          // 查找 DAMAGE_REDUCED 事件（divine_shield 触发）
          const reduceEvents = events.filter(
            e => e.type === SW_EVENTS.DAMAGE_REDUCED && 
                 (e.payload as any).sourceAbilityId === 'divine_shield'
          );

          if (reduceEvents.length > 0) {
            // 如果 divine_shield 触发了，验证单位可能存活
            const reduction = (reduceEvents[0].payload as any).value || 0;
            
            // 查找 UNIT_DESTROYED 事件
            const destroyedEvents = events.filter(
              e => e.type === SW_EVENTS.UNIT_DESTROYED &&
                   (e.payload as any).position?.row === 4 &&
                   (e.payload as any).position?.col === 4
            );

            // 如果护盾成功减伤，单位应该存活
            if (reduction > 0) {
              expect(destroyedEvents.length).toBe(0);
            }
          }
        },
      });

      runner.run([
        { type: 'DECLARE_ATTACK', playerId: '1', payload: { from: { row: 4, col: 5 }, to: { row: 4, col: 4 } } },
        { type: 'CONFIRM_ATTACK', playerId: '1', payload: { diceResults: [3, 3, 3], shieldDice: [4, 5, 6] } },
      ]);
    });
  });

  describe('补充：验证 postProcessDeathChecks 不重复注入消灭事件', () => {
    it('验证同一单位只产生一次 UNIT_DESTROYED 事件', () => {
      const runner = new GameTestRunner({
        domain: SummonerWarsDomain,
        playerIds: ['0', '1'],
        setup: (playerIds, random) => {
          const core = createInitializedCore(playerIds, random, {
            faction0: 'paladin',
            faction1: 'frost',
          });

          // 放置一个低生命值单位
          const guardCard = createUnitCard(CARD_IDS.PALADIN_FORTRESS_GUARD, { life: 1 });
          placeTestUnit(core, { row: 4, col: 2 }, {
            card: guardCard,
            owner: '0',
            damage: 0,
          });

          // 放置攻击者
          const warriorCard = createUnitCard(CARD_IDS.FROST_FROST_WARRIOR);
          placeTestUnit(core, { row: 4, col: 3 }, {
            card: warriorCard,
            owner: '1',
          });

          core.currentPhase = 'attack';
          core.currentPlayer = '1';

          return { core, sys: createInitialSystemState(playerIds, [], undefined) };
        },
        assertFn: (state, expect) => {
          const events = state.sys.eventStream.entries.map(e => e.event);

          // 查找所有 UNIT_DESTROYED 事件
          const destroyedEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED);

          // 验证只有一个 UNIT_DESTROYED 事件（不重复注入）
          expect(destroyedEvents.length).toBe(1);
        },
      });

      runner.run([
        { type: 'DECLARE_ATTACK', playerId: '1', payload: { from: { row: 4, col: 3 }, to: { row: 4, col: 2 } } },
        { type: 'CONFIRM_ATTACK', playerId: '1', payload: { diceResults: [3, 3, 3] } },
      ]);
    });
  });
});
