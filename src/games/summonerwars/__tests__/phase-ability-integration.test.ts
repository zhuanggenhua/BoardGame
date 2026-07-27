/**
 * 召唤师战争 - 阶段触发技能集成测试
 *
 * 回归守卫：确保所有在 PHASE_START_ABILITIES / PHASE_END_ABILITIES 中注册的技能，
 * 经过 triggerPhaseAbilities → resolveAbilityEffects 完整链路后，
 * 生成的每个 ABILITY_TRIGGERED 事件都包含 sourcePosition。
 *
 * 背景：illusion 技能曾因 abilityResolver.ts custom else 分支缺少 sourcePosition
 * 导致 UI 层无法定位单位、无法触发交互。此测试防止同类回归。
 */

import { describe, it, expect } from 'vitest';
import { PHASE_START_ABILITIES, PHASE_END_ABILITIES } from '../domain/flowHooks';
import { resolveAbilityEffects } from '../domain/abilityResolver';
import { abilityRegistry } from '../domain/abilities';
import { SW_EVENTS } from '../domain/types';
import type { SummonerWarsCore, BoardUnit, UnitCard, GamePhase } from '../domain/types';
import type { DiceFaceResult } from '../config/dice';
import type { RandomFn } from '../../../engine/types';
import { createInitializedCore } from './test-helpers';

const fixedTimestamp = 1000;
const testDiceResults: DiceFaceResult[] = [
  { faceIndex: 7, marks: ['melee', 'special'] },
  { faceIndex: 0, marks: ['melee', 'ranged'] },
  { faceIndex: 8, marks: ['melee'] },
];

// ============================================================================
// 辅助
// ============================================================================

function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

/** 创建一个拥有指定技能的测试单位并放置到棋盘 */
function placeTestUnit(
  state: SummonerWarsCore,
  abilityId: string,
  row: number,
  col: number,
  owner: '0' | '1' = '0',
): BoardUnit {
  const unit: BoardUnit = {
    cardId: `test-${abilityId}-${row}-${col}`,
    card: {
      id: `test-card-${abilityId}`,
      cardType: 'unit',
      name: `测试单位(${abilityId})`,
      unitClass: 'champion',
      faction: 'necromancer',
      strength: 3,
      life: 8,
      cost: 5,
      attackType: 'melee',
      attackRange: 1,
      abilities: [abilityId],
      deckSymbols: [],
    } as UnitCard,
    owner,
    position: { row, col },
    damage: 0,
    boosts: abilityId === 'mogu_burst' ? 3 : 2, // 给充能以满足 ice_shards / mogu_burst 等条件
    hasMoved: false,
    hasAttacked: false,
  };
  state.board[row][col].unit = unit;
  return unit;
}

/** 收集所有已注册的阶段触发技能 ID */
function collectPhaseAbilityIds(): { id: string; phase: GamePhase; timing: 'start' | 'end' }[] {
  const result: { id: string; phase: GamePhase; timing: 'start' | 'end' }[] = [];
  for (const [phase, ids] of Object.entries(PHASE_START_ABILITIES)) {
    for (const id of ids) {
      result.push({ id, phase: phase as GamePhase, timing: 'start' });
    }
  }
  for (const [phase, ids] of Object.entries(PHASE_END_ABILITIES)) {
    for (const id of ids) {
      result.push({ id, phase: phase as GamePhase, timing: 'end' });
    }
  }
  return result;
}

// ============================================================================
// 测试
// ============================================================================

describe('阶段触发技能集成测试 - ABILITY_TRIGGERED 事件 payload 完整性', () => {
  const phaseAbilities = collectPhaseAbilityIds();
  const phaseStartEquivalentSystemConsumers = new Set([
    // 永恒议会「探寻」来自持续事件，当前由 systems.ts 监听 PHASE_CHANGED 后创建确认/跳过抓牌交互。
    // 它不走棋盘单位 PHASE_START_ABILITIES，但必须显式登记为等价阶段开始消费链，避免被误判为漏审灰区。
    'yongheng_search',
  ]);

  it.each(phaseAbilities)(
    '$id（$phase 阶段$timing）的 ABILITY_TRIGGERED 事件必须包含 sourcePosition',
    ({ id }) => {
      const def = abilityRegistry.get(id);
      expect(def, `技能 ${id} 未在 abilityRegistry 中注册`).toBeDefined();

      // 创建最小棋盘状态
      const state = createInitializedCore(['0', '1'], createTestRandom(), {
        faction0: 'necromancer',
        faction1: 'necromancer',
      });

      // 清理中心区域，放置测试单位
      const testRow = 4;
      const testCol = 3;
      state.board[testRow][testCol].unit = undefined;
      state.board[testRow][testCol].structure = undefined;

      const unit = placeTestUnit(state, id, testRow, testCol, '0');

      // 确保牌组有牌（guidance 需要）
      state.players['0'].deck = Array.from({ length: 5 }, (_, i) => ({
        id: `deck-card-${i}`,
        cardType: 'unit' as const,
        name: '填充牌',
        unitClass: 'common' as const,
        faction: 'necromancer',
        strength: 1,
        life: 2,
        cost: 0,
        attackType: 'melee' as const,
        attackRange: 1,
        deckSymbols: [],
      }));

      // 调用 resolveAbilityEffects（模拟 triggerPhaseAbilities 的核心路径）
      const events = resolveAbilityEffects(def!, {
        state,
        sourceUnit: unit,
        sourcePosition: { row: testRow, col: testCol },
        ownerId: '0',
        timestamp: fixedTimestamp,
      });

      // 所有 ABILITY_TRIGGERED 事件都必须包含 sourcePosition
      const triggerEvents = events.filter(e => e.type === SW_EVENTS.ABILITY_TRIGGERED);
      expect(triggerEvents.length).toBeGreaterThanOrEqual(1);

      for (const event of triggerEvents) {
        const payload = event.payload as Record<string, unknown>;
        expect(
          payload.sourcePosition,
          `技能 ${id} 的 ABILITY_TRIGGERED 事件缺少 sourcePosition（payload keys: ${Object.keys(payload).join(', ')}）`
        ).toBeDefined();
        expect(payload.sourcePosition).toEqual({ row: testRow, col: testCol });
      }
    }
  );

  it('PHASE_START_ABILITIES 和 PHASE_END_ABILITIES 中的所有技能都已在 abilityRegistry 注册', () => {
    for (const { id } of phaseAbilities) {
      expect(
        abilityRegistry.get(id),
        `技能 ${id} 在 PHASE_*_ABILITIES 中声明但未在 abilityRegistry 注册`
      ).toBeDefined();
    }
  });

  it('PHASE_START_ABILITIES 中的技能 trigger 必须为 onPhaseStart', () => {
    for (const [, ids] of Object.entries(PHASE_START_ABILITIES)) {
      for (const id of ids) {
        const def = abilityRegistry.get(id);
        if (def) {
          expect(def.trigger, `技能 ${id} 的 trigger 应为 onPhaseStart，实际为 ${def.trigger}`).toBe('onPhaseStart');
        }
      }
    }
  });

  it('PHASE_END_ABILITIES 中的技能 trigger 必须为 onPhaseEnd', () => {
    for (const [, ids] of Object.entries(PHASE_END_ABILITIES)) {
      for (const id of ids) {
        const def = abilityRegistry.get(id);
        if (def) {
          expect(def.trigger, `技能 ${id} 的 trigger 应为 onPhaseEnd，实际为 ${def.trigger}`).toBe('onPhaseEnd');
        }
      }
    }
  });

  it('所有 onPhaseEnd 技能都必须显式登记到 PHASE_END_ABILITIES', () => {
    const declared = new Set(Object.values(PHASE_END_ABILITIES).flat());
    const missing = abilityRegistry.getAll()
      .filter(def => def.trigger === 'onPhaseEnd')
      .map(def => def.id)
      .filter(id => !declared.has(id));

    expect(missing, `onPhaseEnd 技能未接入真实阶段退出链：${missing.join(', ')}`).toEqual([]);
  });

  it('所有 onPhaseStart 技能都必须登记到 PHASE_START_ABILITIES 或声明等价系统消费链', () => {
    const declared = new Set(Object.values(PHASE_START_ABILITIES).flat());
    const missing = abilityRegistry.getAll()
      .filter(def => def.trigger === 'onPhaseStart')
      .map(def => def.id)
      .filter(id => !declared.has(id) && !phaseStartEquivalentSystemConsumers.has(id));

    expect(missing, `onPhaseStart 技能未接入真实阶段进入链或等价系统消费链：${missing.join(', ')}`).toEqual([]);
  });
});

// ============================================================================
// 全量守卫：所有技能的 ABILITY_TRIGGERED 事件都必须包含 sourcePosition
// ============================================================================

describe('全量技能 ABILITY_TRIGGERED 事件 sourcePosition 守卫', () => {
  /**
   * 遍历 abilityRegistry 中所有技能，对每个技能调用 resolveAbilityEffects，
   * 验证产出的每个 ABILITY_TRIGGERED 事件都包含 sourcePosition。
   * 
   * 这是根因级防护：不管技能是阶段触发、攻击触发还是被动触发，
   * 只要它经过 resolveAbilityEffects 产出 ABILITY_TRIGGERED 事件，
   * 就必须带 sourcePosition，否则 UI 层无法定位来源单位。
   */
  const allAbilities = abilityRegistry.getAll();

  // 过滤掉纯被动/占位技能（effects 为空或全是不产出事件的占位）
  const testableAbilities = allAbilities.filter(def => def.effects.length > 0);

  it.each(testableAbilities.map(a => ({ id: a.id, name: a.name, trigger: a.trigger })))(
    '技能 $id ($name) 的所有 ABILITY_TRIGGERED 事件必须包含 sourcePosition',
    ({ id }) => {
      const def = abilityRegistry.get(id)!;

      const state = createInitializedCore(['0', '1'], createTestRandom(), {
        faction0: 'necromancer',
        faction1: 'necromancer',
      });

      const testRow = 4;
      const testCol = 3;
      state.board[testRow][testCol].unit = undefined;
      state.board[testRow][testCol].structure = undefined;

      // 放置一个敌方单位在相邻位置（满足 afterAttack 等需要 target 的技能）
      const enemyRow = 4;
      const enemyCol = 4;
      state.board[enemyRow][enemyCol].unit = undefined;
      state.board[enemyRow][enemyCol].structure = undefined;
      const enemyUnit: BoardUnit = {
        cardId: 'test-enemy',
        card: {
          id: 'test-enemy-card',
          cardType: 'unit',
          name: '敌方测试单位',
          unitClass: 'common',
          faction: 'goblin',
          strength: 2,
          life: 3,
          cost: 0,
          attackType: 'melee',
          attackRange: 1,
          abilities: [],
          deckSymbols: [],
        } as UnitCard,
        owner: '1',
        position: { row: enemyRow, col: enemyCol },
        damage: 0,
        boosts: 0,
        hasMoved: false,
        hasAttacked: false,
      };
      state.board[enemyRow][enemyCol].unit = enemyUnit;

      const unit = placeTestUnit(state, id, testRow, testCol, '0');

      // 确保牌组有牌
      state.players['0'].deck = Array.from({ length: 5 }, (_, i) => ({
        id: `deck-card-${i}`,
        cardType: 'unit' as const,
        name: '填充牌',
        unitClass: 'common' as const,
        faction: 'necromancer',
        strength: 1,
        life: 2,
        cost: 0,
        attackType: 'melee' as const,
        attackRange: 1,
        deckSymbols: [],
      }));

      // 确保魔力充足
      state.players['0'].magic = 10;

      const events = resolveAbilityEffects(def, {
        state,
        sourceUnit: unit,
        sourcePosition: { row: testRow, col: testCol },
        ownerId: '0',
        targetUnit: enemyUnit,
        targetPosition: { row: enemyRow, col: enemyCol },
        victimUnit: enemyUnit,
        victimPosition: { row: enemyRow, col: enemyCol },
        diceResults: testDiceResults,
        timestamp: fixedTimestamp,
      });

      // 检查所有 ABILITY_TRIGGERED 事件
      const triggerEvents = events.filter(e => e.type === SW_EVENTS.ABILITY_TRIGGERED);
      for (const event of triggerEvents) {
        const payload = event.payload as Record<string, unknown>;
        expect(
          payload.sourcePosition,
          `技能 ${id} 产出的 ABILITY_TRIGGERED 事件缺少 sourcePosition（abilityId=${payload.abilityId}, payload keys: ${Object.keys(payload).join(', ')}）`
        ).toBeDefined();
      }
    }
  );
});
