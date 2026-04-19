/**
 * 调试测试：两个弓箭手连续射击
 * 
 * 复现场景：弓箭手A 攻击 → rapid_fire → 额外攻击 → 弓箭手B 攻击 → rapid_fire → 额外攻击
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type {
  SummonerWarsCore, CellCoord, BoardUnit, UnitCard,
  PlayerId,
} from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { createInitializedCore, generateInstanceId } from './test-helpers';

function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

const fixedTimestamp = 1000;

function createBarbaricState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'barbaric',
    faction1: 'necromancer',
  });
}

function placeUnit(
  state: SummonerWarsCore,
  pos: CellCoord,
  overrides: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId }
): BoardUnit {
  const cardId = overrides.cardId ?? `test-${pos.row}-${pos.col}`;
  const unit: BoardUnit = {
    instanceId: overrides.instanceId ?? generateInstanceId(cardId),
    cardId,
    card: overrides.card,
    owner: overrides.owner,
    position: pos,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
  };
  state.board[pos.row][pos.col].unit = unit;
  return unit;
}

function clearArea(state: SummonerWarsCore, rows: number[], cols: number[]) {
  for (const r of rows) {
    for (const c of cols) {
      state.board[r][c].unit = undefined;
      state.board[r][c].structure = undefined;
    }
  }
}

function makeArcher(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '边境弓箭手', unitClass: 'soldier',
    faction: 'barbaric', strength: 2, life: 4, cost: 2,
    attackType: 'ranged', attackRange: 3,
    abilities: ['prepare', 'rapid_fire'], deckSymbols: [],
  };
}

function makeZombie(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '测试僵尸', unitClass: 'soldier',
    faction: 'necromancer', strength: 1, life: 3, cost: 1,
    attackType: 'melee', attackRange: 1,
    abilities: [], deckSymbols: [],
  };
}

function executeAndReduce(
  state: SummonerWarsCore,
  commandType: string,
  payload: Record<string, unknown>
): { newState: SummonerWarsCore; events: GameEvent[] } {
  const fullState = { core: state, sys: {} as any };
  const command = { type: commandType, payload, timestamp: fixedTimestamp, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, createTestRandom());
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { newState, events };
}

describe('两个弓箭手连续射击', () => {
  it('弓箭手A rapid_fire 后，弓箭手B 也能使用 rapid_fire', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 弓箭手A 在 (4,1)，有1充能
    const archerA = placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'archer-a', card: makeArcher('archer-a'), owner: '0',
      boosts: 1,
    });

    // 弓箭手B 在 (4,3)，有1充能
    const archerB = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'archer-b', card: makeArcher('archer-b'), owner: '0',
      boosts: 1,
    });

    // 敌方目标在 (2,1) 和 (2,3)
    placeUnit(state, { row: 2, col: 1 }, {
      cardId: 'zombie-1', card: makeZombie('zombie-1'), owner: '1',
    });
    placeUnit(state, { row: 2, col: 3 }, {
      cardId: 'zombie-2', card: makeZombie('zombie-2'), owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    console.log('=== 步骤1：弓箭手A 攻击 ===');
    const { newState: s1, events: e1 } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 1 },
      target: { row: 2, col: 1 },
    });
    console.log('attackCount after A attack:', s1.players['0'].attackCount);
    console.log('archerA hasAttacked:', s1.board[4][1].unit?.hasAttacked);
    console.log('rapid_fire triggered:', e1.some(e => 
      e.type === SW_EVENTS.ABILITY_TRIGGERED && 
      (e.payload as any).actionId === 'rapid_fire_extra_attack'
    ));

    console.log('=== 步骤2：弓箭手A 确认 rapid_fire ===');
    const { newState: s2, events: e2 } = executeAndReduce(s1, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'rapid_fire',
      sourceUnitId: archerA.instanceId,
    });
    console.log('attackCount after A rapid_fire:', s2.players['0'].attackCount);
    console.log('archerA hasAttacked:', s2.board[4][1].unit?.hasAttacked);
    console.log('archerA extraAttacks:', s2.board[4][1].unit?.extraAttacks);
    console.log('archerA boosts:', s2.board[4][1].unit?.boosts);
    console.log('usageCount:', JSON.stringify(s2.abilityUsageCount));

    console.log('=== 步骤3：弓箭手A 额外攻击 ===');
    const { newState: s3, events: e3 } = executeAndReduce(s2, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 1 },
      target: { row: 2, col: 1 },
    });
    console.log('attackCount after A extra attack:', s3.players['0'].attackCount);
    console.log('archerA hasAttacked:', s3.board[4][1].unit?.hasAttacked);
    console.log('archerA extraAttacks:', s3.board[4][1].unit?.extraAttacks);

    console.log('=== 步骤4：弓箭手B 攻击 ===');
    // 先验证弓箭手B 可以攻击
    const validateB = SummonerWarsDomain.validate(
      { core: s3, sys: {} as any },
      { type: SW_COMMANDS.DECLARE_ATTACK, payload: { attacker: { row: 4, col: 3 }, target: { row: 2, col: 3 } }, playerId: '0', timestamp: fixedTimestamp }
    );
    console.log('弓箭手B 攻击验证:', validateB);
    expect(validateB.valid).toBe(true);

    const { newState: s4, events: e4 } = executeAndReduce(s3, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 3 },
      target: { row: 2, col: 3 },
    });
    console.log('attackCount after B attack:', s4.players['0'].attackCount);
    console.log('archerB hasAttacked:', s4.board[4][3].unit?.hasAttacked);
    console.log('rapid_fire triggered for B:', e4.some(e => 
      e.type === SW_EVENTS.ABILITY_TRIGGERED && 
      (e.payload as any).actionId === 'rapid_fire_extra_attack'
    ));
    console.log('usageCount after B attack:', JSON.stringify(s4.abilityUsageCount));

    // 关键：弓箭手B 的 rapid_fire usageCount 应该是 0（独立追踪）
    expect(s4.abilityUsageCount[`${archerB.instanceId}:rapid_fire`]).toBeUndefined();

    console.log('=== 步骤5：弓箭手B 确认 rapid_fire ===');
    const validateBRapid = SummonerWarsDomain.validate(
      { core: s4, sys: {} as any },
      { type: SW_COMMANDS.ACTIVATE_ABILITY, payload: { abilityId: 'rapid_fire', sourceUnitId: archerB.instanceId }, playerId: '0', timestamp: fixedTimestamp }
    );
    console.log('弓箭手B rapid_fire 验证:', validateBRapid);
    expect(validateBRapid.valid).toBe(true);

    const { newState: s5, events: e5 } = executeAndReduce(s4, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'rapid_fire',
      sourceUnitId: archerB.instanceId,
    });
    console.log('attackCount after B rapid_fire:', s5.players['0'].attackCount);
    console.log('archerB hasAttacked:', s5.board[4][3].unit?.hasAttacked);
    console.log('archerB extraAttacks:', s5.board[4][3].unit?.extraAttacks);
    console.log('archerB boosts:', s5.board[4][3].unit?.boosts);

    // 弓箭手B 应该获得额外攻击
    expect(s5.board[4][3].unit?.hasAttacked).toBe(false);
    expect(s5.board[4][3].unit?.extraAttacks).toBe(1);
    expect(s5.board[4][3].unit?.boosts).toBe(0); // 充能消耗了

    console.log('=== 步骤6：弓箭手B 额外攻击 ===');
    const validateBExtra = SummonerWarsDomain.validate(
      { core: s5, sys: {} as any },
      { type: SW_COMMANDS.DECLARE_ATTACK, payload: { attacker: { row: 4, col: 3 }, target: { row: 2, col: 3 } }, playerId: '0', timestamp: fixedTimestamp }
    );
    console.log('弓箭手B 额外攻击验证:', validateBExtra);
    expect(validateBExtra.valid).toBe(true);

    const { newState: s6 } = executeAndReduce(s5, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 3 },
      target: { row: 2, col: 3 },
    });
    console.log('attackCount after B extra attack:', s6.players['0'].attackCount);
    // 额外攻击不计入 attackCount
    expect(s6.players['0'].attackCount).toBe(2); // A普通攻击 + B普通攻击 = 2
  });
});
