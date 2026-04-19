/**
 * 召唤师战争 - 欺心巫族 execute 流程补充测试
 *
 * 覆盖 abilities-trickster.test.ts 中缺失的 ACTIVATE_ABILITY 流程：
 * - mind_capture_resolve（心灵捕获决策）：控制 vs 伤害
 * - telekinesis / high_telekinesis（念力/高阶念力）：推拉目标
 * - mind_transmission（读心传念）：给友方士兵额外攻击
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, PlayerId } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { createInitializedCore, generateInstanceId } from './test-helpers';

// ============================================================================
// 辅助函数
// ============================================================================

function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

const fixedTimestamp = 1000;

function createTricksterState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'trickster',
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

function makeSummoner(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '泰珂露', unitClass: 'summoner',
    faction: 'trickster', strength: 3, life: 13, cost: 0,
    attackType: 'ranged', attackRange: 3,
    abilities: ['mind_capture'], deckSymbols: [],
  };
}

function makeTelekinetic(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '掷术师', unitClass: 'common',
    faction: 'trickster', strength: 1, life: 4, cost: 1,
    attackType: 'ranged', attackRange: 3,
    abilities: ['evasion', 'rebound', 'telekinesis'], deckSymbols: [],
  };
}

function makeKara(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '卡拉', unitClass: 'champion',
    faction: 'trickster', strength: 4, life: 8, cost: 7,
    attackType: 'ranged', attackRange: 3,
    abilities: ['high_telekinesis', 'stable', 'mind_transmission'], deckSymbols: [],
  };
}

function makeEnemy(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: '敌方单位', unitClass: 'common',
    faction: 'necromancer', strength: 2, life: 3, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
    ...overrides,
  };
}

function makeAllyCommon(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '友方士兵', unitClass: 'common',
    faction: 'trickster', strength: 2, life: 3, cost: 1,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
  };
}

function makeMindWitch(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '心灵女巫', unitClass: 'common',
    faction: 'trickster', strength: 1, life: 3, cost: 1,
    attackType: 'ranged', attackRange: 3,
    abilities: ['illusion'], deckSymbols: [],
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


// ============================================================================
// 心灵捕获决策 (mind_capture_resolve) 测试
// ============================================================================

describe('泰珂露 - 心灵捕获决策 (mind_capture_resolve)', () => {
  it('选择控制：转移目标控制权', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_capture_resolve',
      sourceUnitId: summoner.instanceId,
      choice: 'control',
      targetPosition: { row: 4, col: 4 },
    });

    // 应有控制权转移事件
    const ctEvents = events.filter(e => e.type === SW_EVENTS.CONTROL_TRANSFERRED);
    expect(ctEvents.length).toBe(1);
    expect((ctEvents[0].payload as any).newOwner).toBe('0');

    // 目标单位应变为玩家0控制
    expect(newState.board[4][4].unit?.owner).toBe('0');
  });

  it('选择伤害：对目标造成伤害', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 5 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_capture_resolve',
      sourceUnitId: summoner.instanceId,
      choice: 'damage',
      targetPosition: { row: 4, col: 4 },
      hits: 3,
    });

    // 应有伤害事件
    const damageEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED
        && (e.payload as any).position?.row === 4
        && (e.payload as any).position?.col === 4
    );
    expect(damageEvents.length).toBe(1);
    expect((damageEvents[0].payload as any).damage).toBe(3);

    // 目标受到3点伤害
    expect(newState.board[4][4].unit?.damage).toBe(3);
  });

  it('选择伤害且致命时消灭目标', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 2 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_capture_resolve',
      sourceUnitId: summoner.instanceId,
      choice: 'damage',
      targetPosition: { row: 4, col: 4 },
      hits: 3,
    });

    // 应有消灭事件
    const destroyEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED);
    expect(destroyEvents.length).toBe(1);
    expect(newState.board[4][4].unit).toBeUndefined();
  });

  it('无效选择时验证拒绝', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'mind_capture_resolve',
        sourceUnitId: summoner.instanceId,
        choice: 'invalid',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
  });

  it('验证层：持有 mind_capture 的单位可激活 mind_capture_resolve', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'mind_capture_resolve',
        sourceUnitId: summoner.instanceId,
        choice: 'control',
        targetPosition: { row: 4, col: 4 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });

    expect(result.valid).toBe(true);
  });

  it('验证层：未持有 mind_capture 的单位不能激活 mind_capture_resolve', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const telekinetic = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'mind_capture_resolve',
        sourceUnitId: telekinetic.instanceId,
        choice: 'control',
        targetPosition: { row: 4, col: 4 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('该单位没有此技能');
  });

  it('方案A：心灵捕获决策结算后才触发 afterAttack', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: { ...makeSummoner('test-summoner'), abilities: ['mind_capture', 'imposing'] },
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 1 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const attackResult = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 4 },
    });

    const mindCaptureRequested = attackResult.events.find(e => e.type === SW_EVENTS.MIND_CAPTURE_REQUESTED);
    expect(mindCaptureRequested).toBeDefined();

    const earlyAfterAttack = attackResult.events.find(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'imposing'
    );
    expect(earlyAfterAttack).toBeUndefined();

    const requestPayload = mindCaptureRequested!.payload as { hits: number };
    const resolveResult = executeAndReduce(attackResult.newState, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_capture_resolve',
      sourceUnitId: summoner.instanceId,
      choice: 'control',
      targetPosition: { row: 4, col: 4 },
      hits: requestPayload.hits,
    });

    const afterAttackTriggered = resolveResult.events.find(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'imposing'
    );
    expect(afterAttackTriggered).toBeDefined();

    const chargeEvent = resolveResult.events.find(e =>
      e.type === SW_EVENTS.UNIT_CHARGED
      && (e.payload as Record<string, unknown>).sourceAbilityId === 'imposing'
    );
    expect(chargeEvent).toBeDefined();
    expect(resolveResult.newState.board[4][2].unit?.boosts).toBe(1);
  });
});

// ============================================================================
// 念力 (telekinesis) ACTIVATE_ABILITY 测试
// ============================================================================

describe('掷术师 - 念力 (telekinesis) ACTIVATE_ABILITY', () => {
  it('推拉2格内敌方士兵1格', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const telekinetic = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis',
      sourceUnitId: telekinetic.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'push',
    });

    // 应有推拉事件
    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(1);

    // 敌方被推到 (4,5)
    expect(newState.board[4][5].unit?.cardId).toBe('test-enemy');
    expect(newState.board[4][4].unit).toBeUndefined();
  });

  it('推拉导致远离缠斗单位时，伤害应作用在推拉后的位置', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const telekinetic = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    // 目标敌方单位（被推拉者）
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    // 与目标相邻的友方缠斗单位（rebound），目标被推走后会远离它
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-rebound',
      card: makeEnemy('test-rebound', { abilities: ['rebound'] }),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis',
      sourceUnitId: telekinetic.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'push',
    });

    const entangleDamageEvents = events.filter((event) => {
      if (event.type !== SW_EVENTS.UNIT_DAMAGED) return false;
      const payload = event.payload as { position?: CellCoord; reason?: string };
      return payload.reason === 'entangle';
    });
    expect(entangleDamageEvents.length).toBe(1);
    const damagePayload = entangleDamageEvents[0].payload as { position: CellCoord; damage: number };
    expect(damagePayload.position).toEqual({ row: 4, col: 5 });
    expect(damagePayload.damage).toBe(1);

    // 目标被推到新位置并在该位置受伤
    expect(newState.board[4][5].unit?.cardId).toBe('test-enemy');
    expect(newState.board[4][5].unit?.damage).toBe(1);
  });

  it('拉近敌方士兵1格', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const telekinetic = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis',
      sourceUnitId: telekinetic.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'pull',
    });

    // 应有拉动事件
    const pullEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PULLED);
    expect(pullEvents.length).toBe(1);

    // 敌方被拉到 (4,3)
    expect(newState.board[4][3].unit?.cardId).toBe('test-enemy');
    expect(newState.board[4][4].unit).toBeUndefined();
  });

  it('稳固单位免疫推拉', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const telekinetic = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    // 稳固单位
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-stable',
      card: makeEnemy('test-stable', { abilities: ['stable'] }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis',
      sourceUnitId: telekinetic.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'push',
    });

    // 不应有推拉事件（稳固免疫）
    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(0);

    // 单位不动
    expect(newState.board[4][4].unit?.cardId).toBe('test-stable');
  });

  it('不能推拉召唤师', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const telekinetic = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy-summoner',
      card: makeEnemy('test-enemy-summoner', { unitClass: 'summoner' }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'telekinesis',
        sourceUnitId: telekinetic.instanceId,
        targetPosition: { row: 4, col: 3 },
        direction: 'push',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('召唤师');
  });

  it('超过2格时验证拒绝', () => {
    const state = createTricksterState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const telekinetic = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    placeUnit(state, { row: 1, col: 2 }, {
      cardId: 'test-far-enemy',
      card: makeEnemy('test-far-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'telekinesis',
        sourceUnitId: telekinetic.instanceId,
        targetPosition: { row: 1, col: 2 },
        direction: 'push',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2格');
  });
});

// ============================================================================
// 高阶念力 (high_telekinesis) ACTIVATE_ABILITY 测试
// ============================================================================

describe('卡拉 - 高阶念力 (high_telekinesis) ACTIVATE_ABILITY', () => {
  it('推拉3格内敌方士兵1格', () => {
    const state = createTricksterState();
    // 清除包括 row 0，确保推拉目标位置为空
    clearArea(state, [0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const kara = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kara',
      card: makeKara('test-kara'),
      owner: '0',
    });

    // 3格距离的敌方
    placeUnit(state, { row: 1, col: 2 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'high_telekinesis',
      sourceUnitId: kara.instanceId,
      targetPosition: { row: 1, col: 2 },
      direction: 'push',
    });

    // 应有推拉事件
    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(1);

    // 敌方被推到 (0,2)
    expect(newState.board[0][2].unit?.cardId).toBe('test-enemy');
  });

  it('超过3格时验证拒绝', () => {
    const state = createTricksterState();
    clearArea(state, [0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5]);

    const kara = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kara',
      card: makeKara('test-kara'),
      owner: '0',
    });

    placeUnit(state, { row: 0, col: 2 }, {
      cardId: 'test-far-enemy',
      card: makeEnemy('test-far-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'high_telekinesis',
        sourceUnitId: kara.instanceId,
        targetPosition: { row: 0, col: 2 },
        direction: 'push',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3格');
  });
});

// ============================================================================
// 读心传念 (mind_transmission) ACTIVATE_ABILITY 测试
// ============================================================================

describe('卡拉 - 读心传念 (mind_transmission) ACTIVATE_ABILITY', () => {
  it('给3格内友方士兵额外攻击', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const kara = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kara',
      card: makeKara('test-kara'),
      owner: '0',
    });

    const ally = placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-ally',
      card: makeAllyCommon('test-ally'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_transmission',
      sourceUnitId: kara.instanceId,
      targetPosition: { row: 4, col: 4 },
    });

    // 应有额外攻击事件
    const extraAttackEvents = events.filter(e => e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED);
    expect(extraAttackEvents.length).toBe(1);
    expect((extraAttackEvents[0].payload as any).targetUnitId).toBe(ally.instanceId);
    expect((extraAttackEvents[0].payload as any).sourceAbilityId).toBe('mind_transmission');
  });

  it('不能给敌方单位额外攻击', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const kara = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kara',
      card: makeKara('test-kara'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'mind_transmission',
        sourceUnitId: kara.instanceId,
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('友方');
  });

  it('不能给冠军单位额外攻击（只能选择士兵）', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const kara = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kara',
      card: makeKara('test-kara'),
      owner: '0',
    });

    // 友方冠军
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-champion',
      card: { ...makeAllyCommon('test-champion'), unitClass: 'champion' },
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'mind_transmission',
        sourceUnitId: kara.instanceId,
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('士兵');
  });

  it('超过3格时验证拒绝', () => {
    const state = createTricksterState();
    clearArea(state, [0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5]);

    const kara = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kara',
      card: makeKara('test-kara'),
      owner: '0',
    });

    placeUnit(state, { row: 0, col: 2 }, {
      cardId: 'test-far-ally',
      card: makeAllyCommon('test-far-ally'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'mind_transmission',
        sourceUnitId: kara.instanceId,
        targetPosition: { row: 0, col: 2 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3格');
  });
});


// ============================================================================
// 幻化 (illusion) 测试
// ============================================================================

describe('心灵女巫 - 幻化 (illusion)', () => {
  it('复制3格内士兵的技能', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [2, 3, 4, 5]);

    // 心灵女巫在 (4,3)
    const witch = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-witch',
      card: makeMindWitch('test-witch'),
      owner: '0',
    });

    // 目标士兵在 (4,5)，距离2，有 ranged 和 charge 技能
    placeUnit(state, { row: 4, col: 5 }, {
      cardId: 'test-target',
      card: makeEnemy('test-target', {
        abilities: ['ranged', 'charge'],
      }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'illusion',
      sourceUnitId: witch.instanceId,
      targetPosition: { row: 4, col: 5 },
    });

    // 应有 ABILITIES_COPIED 事件
    const copyEvents = events.filter(e => e.type === SW_EVENTS.ABILITIES_COPIED);
    expect(copyEvents.length).toBe(1);
    expect((copyEvents[0].payload as any).copiedAbilities).toEqual(['ranged', 'charge']);

    // 心灵女巫应获得临时技能
    const updatedWitch = newState.board[4][3].unit!;
    expect(updatedWitch.tempAbilities).toEqual(['ranged', 'charge']);
  });

  it('目标必须是士兵（common），不能是召唤师或冠军', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [2, 3, 4, 5]);

    const witch = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-witch',
      card: makeMindWitch('test-witch'),
      owner: '0',
    });

    // 放一个召唤师作为目标
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'illusion',
        sourceUnitId: witch.instanceId,
        targetPosition: { row: 4, col: 4 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('士兵');
  });

  it('目标必须在3格以内', () => {
    const state = createTricksterState();
    clearArea(state, [1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5]);

    const witch = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-witch',
      card: makeMindWitch('test-witch'),
      owner: '0',
    });

    // 距离4的士兵 (row 1, col 2) -> 曼哈顿距离 = |4-1| + |3-2| = 4
    placeUnit(state, { row: 1, col: 2 }, {
      cardId: 'test-far',
      card: makeEnemy('test-far', { abilities: ['ranged'] }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'illusion',
        sourceUnitId: witch.instanceId,
        targetPosition: { row: 1, col: 2 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3格');
  });

  it('只能在移动阶段使用', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [2, 3, 4, 5]);

    const witch = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-witch',
      card: makeMindWitch('test-witch'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-target',
      card: makeEnemy('test-target', { abilities: ['charge'] }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'illusion',
        sourceUnitId: witch.instanceId,
        targetPosition: { row: 4, col: 4 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('移动阶段');
  });

  it('回合切换时清除 tempAbilities', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [2, 3, 4, 5]);

    // 先给心灵女巫设置临时技能
    const witch = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-witch',
      card: makeMindWitch('test-witch'),
      owner: '0',
    });
    witch.tempAbilities = ['ranged', 'charge'];

    // 模拟回合切换事件
    const turnEvent: GameEvent = {
      type: SW_EVENTS.TURN_CHANGED,
      payload: { nextPlayer: '1' },
      timestamp: fixedTimestamp,
    };
    const newState = SummonerWarsDomain.reduce(state, turnEvent);

    // tempAbilities 应被清除
    const updatedWitch = newState.board[4][3].unit!;
    expect(updatedWitch.tempAbilities).toBeUndefined();
  });

  it('getUnitAbilities 合并 tempAbilities', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [2, 3, 4, 5]);

    const witch = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-witch',
      card: makeMindWitch('test-witch'),
      owner: '0',
    });
    witch.tempAbilities = ['charge', 'ferocity'];

    // 验证合并：原始技能 illusion + 临时技能 charge, ferocity
    const abilities = [...(witch.card.abilities ?? []), ...(witch.tempAbilities ?? [])];
    expect(abilities).toContain('illusion');
    expect(abilities).toContain('charge');
    expect(abilities).toContain('ferocity');
  });

  it('目标没有技能时不生成 ABILITIES_COPIED 事件', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [2, 3, 4, 5]);

    const witch = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-witch',
      card: makeMindWitch('test-witch'),
      owner: '0',
    });

    // 无技能的士兵
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-noability',
      card: makeEnemy('test-noability', { abilities: [] }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'illusion',
      sourceUnitId: witch.instanceId,
      targetPosition: { row: 4, col: 4 },
    });

    const copyEvents = events.filter(e => e.type === SW_EVENTS.ABILITIES_COPIED);
    expect(copyEvents.length).toBe(0);
  });

  it('复制的技能应去重（目标有重复技能时）', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [2, 3, 4, 5]);

    const witch = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-witch',
      card: makeMindWitch('test-witch'),
      owner: '0',
    });

    // 目标士兵：card.abilities=['ranged']，tempAbilities=['ranged', 'charge']
    // 模拟通过力量颂歌获得了自己已有的技能
    const target = placeUnit(state, { row: 4, col: 5 }, {
      cardId: 'test-target',
      card: makeEnemy('test-target', { abilities: ['ranged'] }),
      owner: '1',
    });
    target.tempAbilities = ['ranged', 'charge']; // 包含重复的 ranged

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'illusion',
      sourceUnitId: witch.instanceId,
      targetPosition: { row: 4, col: 5 },
    });

    // 应有 ABILITIES_COPIED 事件
    const copyEvents = events.filter(e => e.type === SW_EVENTS.ABILITIES_COPIED);
    expect(copyEvents.length).toBe(1);
    
    // copiedAbilities 应去重：['ranged', 'charge']，不应有两个 ranged
    const copiedAbilities = (copyEvents[0].payload as any).copiedAbilities as string[];
    expect(copiedAbilities).toEqual(['ranged', 'charge']);
    expect(copiedAbilities.filter(a => a === 'ranged').length).toBe(1); // 只有一个 ranged

    // 心灵女巫的 tempAbilities 也应去重
    const updatedWitch = newState.board[4][3].unit!;
    expect(updatedWitch.tempAbilities).toEqual(['ranged', 'charge']);
    expect(updatedWitch.tempAbilities!.filter(a => a === 'ranged').length).toBe(1);
  });
});


// ============================================================================
// 念力代替攻击 (telekinesis_instead) ACTIVATE_ABILITY 测试
// ============================================================================

function makeWindMage(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '清风法师', unitClass: 'common',
    faction: 'trickster', strength: 1, life: 3, cost: 1,
    attackType: 'ranged', attackRange: 3,
    abilities: ['telekinesis', 'telekinesis_instead'], deckSymbols: [],
  };
}

describe('清风法师 - 念力代替攻击 (telekinesis_instead)', () => {
  it('代替攻击推拉2格内敌方士兵1格', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const windmage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-windmage',
      card: makeWindMage('test-windmage'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'telekinesis_instead',
      sourceUnitId: windmage.instanceId,
      targetPosition: { row: 4, col: 4 },
      direction: 'push',
    });

    // 应有推拉事件
    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(1);

    // 敌方被推到 (4,5)
    expect(newState.board[4][5].unit?.cardId).toBe('test-enemy');
    expect(newState.board[4][4].unit).toBeUndefined();
  });

  it('已攻击的单位不能使用代替攻击', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4, 5]);

    const windmage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-windmage',
      card: makeWindMage('test-windmage'),
      owner: '0',
      hasAttacked: true,
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'telekinesis_instead',
        sourceUnitId: windmage.instanceId,
        targetPosition: { row: 4, col: 3 },
        direction: 'push',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('已攻击');
  });

  it('攻击次数用完时不能使用代替攻击', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4, 5]);

    const windmage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-windmage',
      card: makeWindMage('test-windmage'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 3;

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'telekinesis_instead',
        sourceUnitId: windmage.instanceId,
        targetPosition: { row: 4, col: 3 },
        direction: 'push',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('攻击次数');
  });

  it('超过2格时验证拒绝', () => {
    const state = createTricksterState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const windmage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-windmage',
      card: makeWindMage('test-windmage'),
      owner: '0',
    });

    placeUnit(state, { row: 1, col: 2 }, {
      cardId: 'test-far-enemy',
      card: makeEnemy('test-far-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'telekinesis_instead',
        sourceUnitId: windmage.instanceId,
        targetPosition: { row: 1, col: 2 },
        direction: 'push',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2格');
  });

  it('不能推拉召唤师', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const windmage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-windmage',
      card: makeWindMage('test-windmage'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy-summoner',
      card: makeEnemy('test-enemy-summoner', { unitClass: 'summoner' }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'telekinesis_instead',
        sourceUnitId: windmage.instanceId,
        targetPosition: { row: 4, col: 3 },
        direction: 'push',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('召唤师');
  });
});
