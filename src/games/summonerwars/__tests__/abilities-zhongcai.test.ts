import { describe, expect, it } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { GameEvent, RandomFn } from '../../../engine/types';
import type { BoardUnit, CellCoord, EventCard, PlayerId, SummonerWarsCore, UnitCard } from '../domain/types';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
import { getUnitAbilities, getValidSummonPositionsForCard } from '../domain/helpers';
import { validateCommand } from '../domain/validate';
import { summonerWarsFlowHooks } from '../domain/flowHooks';
import {
  CHAMPION_UNITS_ZHONGCAI,
  COMMON_UNITS_ZHONGCAI,
  EVENT_CARDS_ZHONGCAI,
  SUMMONER_ZHONGCAI,
  createZhongcaiDeck,
} from '../config/factions/zhongcai';
import { createInitializedCore, resetInstanceCounter } from './test-helpers';

const random: RandomFn = {
  shuffle: <T>(items: T[]) => [...items],
  random: () => 0.5,
  d: (max: number) => Math.ceil(max / 2),
  range: (min: number) => min,
};

const timestamp = 20260919;

function createState(): SummonerWarsCore {
  resetInstanceCounter();
  const state = createInitializedCore(['0', '1'], random, {
    faction0: 'zhongcai',
    faction1: 'necromancer',
  });
  for (const row of state.board) {
    for (const cell of row) {
      cell.unit = undefined;
      cell.structure = undefined;
    }
  }
  state.currentPlayer = '0';
  state.phase = 'summon';
  state.players['0'].activeEvents = [];
  state.players['0'].hand = [];
  state.players['0'].discard = [];
  state.players['0'].moveCount = 0;
  state.players['0'].attackCount = 0;
  state.players['0'].hasAttackedEnemy = false;
  return state;
}

function placeUnit(
  state: SummonerWarsCore,
  position: CellCoord,
  card: UnitCard,
  owner: PlayerId,
  overrides: Partial<BoardUnit> = {},
): BoardUnit {
  const unit: BoardUnit = {
    instanceId: overrides.instanceId ?? `${card.id}-${position.row}-${position.col}`,
    cardId: card.id,
    card,
    owner,
    position,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
    wasAttackedThisTurn: overrides.wasAttackedThisTurn,
    suppressedUntilTurnEnd: overrides.suppressedUntilTurnEnd,
  };
  state.board[position.row][position.col].unit = unit;
  return unit;
}

function addEvent(state: SummonerWarsCore, event: EventCard) {
  state.players['0'].hand.push(event);
}

function executeAndReduce(
  state: SummonerWarsCore,
  type: string,
  payload: Record<string, unknown>,
  playerId = state.currentPlayer,
): { events: GameEvent[]; newState: SummonerWarsCore } {
  const events = SummonerWarsDomain.execute(
    { core: state, sys: {} as any },
    { type, payload, playerId, timestamp },
    random,
  );
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { events, newState };
}

describe('仲裁派系行为合同', () => {
  it('牌组包含正确的召唤师、起始部署和卡牌数量', () => {
    const deck = createZhongcaiDeck();
    expect(deck.summoner.id).toBe(SUMMONER_ZHONGCAI.id);
    expect(deck.summonerPosition).toEqual({ row: 0, col: 3 });
    expect(deck.startingGatePosition).toEqual({ row: 1, col: 3 });
    expect(deck.startingUnits.map(({ unit, position }) => [unit.id, position])).toEqual([
      ['zhongcai-start-justice-arbiter', { row: 2, col: 3 }],
      ['zhongcai-start-peace-arbiter', { row: 2, col: 2 }],
    ]);
    expect(deck.deck).toHaveLength(30);
    expect(deck.deck.filter((card) => card.id.startsWith('zhongcai-obedience-'))).toHaveLength(2);
  });

  it('服从将友方士兵放到召唤师相邻空格且不消耗移动行动', () => {
    const state = createState();
    state.phase = 'attack';
    const summoner = placeUnit(state, { row: 2, col: 3 }, SUMMONER_ZHONGCAI, '0');
    const soldier = placeUnit(state, { row: 2, col: 5 }, COMMON_UNITS_ZHONGCAI[0], '0');
    addEvent(state, { ...EVENT_CARDS_ZHONGCAI[0], id: 'zhongcai-obedience-0' });

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'zhongcai-obedience-0',
      targets: [soldier.position],
      newPosition: { row: 2, col: 4 },
    });

    expect(events.some((event) => event.type === SW_EVENTS.UNIT_MOVED)).toBe(true);
    expect(newState.board[2][4].unit?.instanceId).toBe(soldier.instanceId);
    expect(newState.players['0'].moveCount).toBe(0);
    expect(newState.players['0'].discard.some((card) => card.id === 'zhongcai-obedience-0')).toBe(true);
    expect(summoner.position).toEqual({ row: 2, col: 3 });
  });

  it('忠诚律令给召唤师相邻友方士兵加1战力，自由律令允许跨阶段行动', () => {
    const state = createState();
    state.phase = 'move';
    const summoner = placeUnit(state, { row: 2, col: 3 }, SUMMONER_ZHONGCAI, '0');
    const soldier = placeUnit(state, { row: 2, col: 4 }, COMMON_UNITS_ZHONGCAI[0], '0');
    state.players['0'].activeEvents = [{ ...EVENT_CARDS_ZHONGCAI[2], id: 'zhongcai-loyalty-decree-0' }];
    expect(getEffectiveStrengthValue(soldier, state)).toBe(soldier.card.strength + 1);

    state.players['0'].activeEvents.push({ ...EVENT_CARDS_ZHONGCAI[3], id: 'zhongcai-freedom-decree-0' });
    const enemy = placeUnit(state, { row: 2, col: 5 }, {
      ...COMMON_UNITS_ZHONGCAI[1], id: 'enemy-target', faction: 'necromancer', name: '敌方单位',
    }, '1');
    const attackValidation = validateCommand(
      { core: state, sys: {} as any },
      {
        type: SW_COMMANDS.DECLARE_ATTACK,
        playerId: '0',
        payload: { attacker: soldier.position, target: enemy.position },
      },
    );
    expect(attackValidation.valid).toBe(true);
    const moveValidation = validateCommand(
      { core: state, sys: {} as any },
      {
        type: SW_COMMANDS.MOVE_UNIT,
        playerId: '0',
        payload: { from: soldier.position, to: { row: 3, col: 4 } },
      },
    );
    expect(moveValidation.valid).toBe(true);
    expect(summoner.position).toEqual({ row: 2, col: 3 });
  });

  it('抹消设置临时失去技能状态，并在回合切换时清除', () => {
    const state = createState();
    state.phase = 'move';
    const source = placeUnit(state, { row: 2, col: 3 }, CHAMPION_UNITS_ZHONGCAI[2], '0');
    const target = placeUnit(state, { row: 2, col: 5 }, COMMON_UNITS_ZHONGCAI[0], '0');
    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'zhongcai_erase',
      sourceUnitId: source.instanceId,
      targetPosition: target.position,
    });
    expect(newState.board[2][5].unit?.suppressedUntilTurnEnd).toBe(true);
    expect(getUnitAbilities(newState.board[2][5].unit!, newState)).toEqual([]);

    const cleared = SummonerWarsDomain.reduce(newState, {
      type: SW_EVENTS.TURN_CHANGED,
      payload: { from: '0', to: '1' },
      timestamp,
    });
    expect(cleared.board[2][5].unit?.suppressedUntilTurnEnd).toBeUndefined();
  });

  it('抹消按卡面“一个士兵”允许指定范围内敌方士兵', () => {
    const state = createState();
    state.phase = 'move';
    const source = placeUnit(state, { row: 2, col: 3 }, CHAMPION_UNITS_ZHONGCAI[2], '0');
    const enemy = placeUnit(state, { row: 2, col: 5 }, {
      ...COMMON_UNITS_ZHONGCAI[1],
      id: 'enemy-soldier-for-erase',
      faction: 'necromancer',
      name: '敌方士兵',
    }, '1');

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'zhongcai_erase',
      sourceUnitId: source.instanceId,
      targetPosition: enemy.position,
    });

    expect(events.some((event) => event.type === SW_EVENTS.ABILITY_TRIGGERED)).toBe(true);
    expect(newState.board[2][5].unit?.suppressedUntilTurnEnd).toBe(true);
    expect(getUnitAbilities(newState.board[2][5].unit!, newState)).toEqual([]);
  });

  it('鼓舞只治疗相邻受伤友方士兵', () => {
    const state = createState();
    const source = placeUnit(state, { row: 2, col: 3 }, COMMON_UNITS_ZHONGCAI[2], '0');
    placeUnit(state, { row: 2, col: 4 }, COMMON_UNITS_ZHONGCAI[0], '0', { damage: 1 });
    placeUnit(state, { row: 2, col: 5 }, COMMON_UNITS_ZHONGCAI[1], '0', { damage: 1 });
    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'zhongcai_inspire',
      sourceUnitId: source.instanceId,
      targetPosition: { row: 2, col: 4 },
    });
    expect(events.filter((event) => event.type === SW_EVENTS.UNIT_HEALED)).toHaveLength(1);
    expect(newState.board[2][4].unit?.damage).toBe(0);
    expect(newState.board[2][5].unit?.damage).toBe(1);
  });

  it('圣言完成友方士兵推拉，且高阶变门在移动离开时造成2点伤害', () => {
    const state = createState();
    const source = placeUnit(state, { row: 2, col: 3 }, SUMMONER_ZHONGCAI, '0');
    const ally = placeUnit(state, { row: 2, col: 4 }, COMMON_UNITS_ZHONGCAI[0], '0');
    const wordResult = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'zhongcai_word',
      sourceUnitId: source.instanceId,
      targetPosition: ally.position,
      newPosition: { row: 2, col: 5 },
    });
    expect(wordResult.newState.board[2][5].unit?.instanceId).toBe(ally.instanceId);

    const gateState = createState();
    const gate = placeUnit(gateState, { row: 2, col: 3 }, SUMMONER_ZHONGCAI, '0');
    const enemy = placeUnit(gateState, { row: 2, col: 4 }, {
      ...COMMON_UNITS_ZHONGCAI[1], id: 'enemy-moving', faction: 'necromancer', name: '敌方移动单位',
    }, '1');
    const moveResult = executeAndReduce(gateState, SW_COMMANDS.MOVE_UNIT, {
      from: enemy.position,
      to: { row: 2, col: 5 },
    }, '1');
    expect(moveResult.events.some((event) =>
      event.type === SW_EVENTS.UNIT_DAMAGED
      && (event.payload as { damage?: number }).damage === 2,
    )).toBe(true);
    expect(gate.position).toEqual({ row: 2, col: 3 });
  });

  it('圣言在召唤师移动后发出目标选择触发事件', () => {
    const state = createState();
    const source = placeUnit(state, { row: 2, col: 3 }, SUMMONER_ZHONGCAI, '0');
    placeUnit(state, { row: 2, col: 4 }, COMMON_UNITS_ZHONGCAI[0], '0');

    const { events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: source.position,
      to: { row: 3, col: 3 },
    });

    expect(events.some((event) => event.type === SW_EVENTS.ABILITY_TRIGGERED
      && (event.payload as { abilityId?: string }).abilityId === 'afterMove:zhongcai_word')).toBe(true);
  });

  it('圣言在攻击后对普通单位和召唤师都只触发一次', () => {
    const normalTargetState = createState();
    normalTargetState.phase = 'attack';
    const normalSource = placeUnit(normalTargetState, { row: 2, col: 3 }, SUMMONER_ZHONGCAI, '0');
    placeUnit(normalTargetState, { row: 3, col: 3 }, COMMON_UNITS_ZHONGCAI[0], '0');
    const normalTarget = placeUnit(normalTargetState, { row: 2, col: 5 }, {
      ...COMMON_UNITS_ZHONGCAI[1], id: 'enemy-normal-target', faction: 'necromancer', name: '敌方普通单位',
    }, '1');

    const normalAttack = executeAndReduce(normalTargetState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: normalSource.position,
      target: normalTarget.position,
      resolvedDiceResults: [{ faceIndex: 8, marks: ['melee'] }],
    });
    const normalWordEvents = normalAttack.events.filter((event) => {
      const payload = event.payload as { abilityId?: string; actionId?: string };
      return event.type === SW_EVENTS.ABILITY_TRIGGERED
        && payload.abilityId === 'zhongcai_word'
        && payload.actionId === 'zhongcai_word';
    });
    expect(normalWordEvents).toHaveLength(1);

    const summonerTargetState = createState();
    summonerTargetState.phase = 'attack';
    const summonerSource = placeUnit(summonerTargetState, { row: 2, col: 3 }, SUMMONER_ZHONGCAI, '0');
    placeUnit(summonerTargetState, { row: 3, col: 3 }, COMMON_UNITS_ZHONGCAI[0], '0');
    const enemySummoner = placeUnit(summonerTargetState, { row: 2, col: 5 }, {
      ...SUMMONER_ZHONGCAI,
      id: 'enemy-summoner-target',
      faction: 'necromancer',
      name: '敌方召唤师',
      abilities: [],
    }, '1');

    const summonerAttack = executeAndReduce(summonerTargetState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: summonerSource.position,
      target: enemySummoner.position,
      resolvedDiceResults: [
        { faceIndex: 8, marks: ['melee'] },
        { faceIndex: 8, marks: ['melee'] },
      ],
    });
    const summonerWordEvents = summonerAttack.events.filter((event) => {
      const payload = event.payload as { abilityId?: string; actionId?: string };
      return event.type === SW_EVENTS.ABILITY_TRIGGERED
        && payload.abilityId === 'zhongcai_word'
        && payload.actionId === 'zhongcai_word';
    });
    expect(summonerWordEvents).toHaveLength(1);
  });

  it('治疗灵光只移除攻击阶段结束时范围内友方士兵的1点伤害', () => {
    const state = createState();
    state.phase = 'attack';
    state.players['0'].hasAttackedEnemy = true;
    const source = placeUnit(state, { row: 2, col: 3 }, CHAMPION_UNITS_ZHONGCAI[0], '0');
    const nearSoldier = placeUnit(state, { row: 2, col: 5 }, COMMON_UNITS_ZHONGCAI[0], '0', { damage: 1 });
    const nearChampion = placeUnit(state, { row: 2, col: 4 }, CHAMPION_UNITS_ZHONGCAI[1], '0', { damage: 1 });
    const farSoldier = placeUnit(state, { row: 5, col: 5 }, COMMON_UNITS_ZHONGCAI[1], '0', { damage: 1 });
    const enemySoldier = placeUnit(state, { row: 2, col: 2 }, {
      ...COMMON_UNITS_ZHONGCAI[1], id: 'enemy-near-soldier', faction: 'necromancer', name: '敌方近处士兵',
    }, '1', { damage: 1 });

    const result = summonerWarsFlowHooks.onPhaseExit?.({
      state: { core: state, sys: {} as any },
      from: 'attack',
      to: 'magic',
      command: { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {}, timestamp },
      random,
    } as any);
    const events = Array.isArray(result) ? result : result?.events ?? [];
    const healingEvents = events.filter((event) => event.type === SW_EVENTS.UNIT_HEALED
      && (event.payload as { sourceAbilityId?: string }).sourceAbilityId === 'zhongcai_radiant_healing');
    expect(healingEvents).toHaveLength(1);

    let newState = state;
    for (const event of events) newState = SummonerWarsDomain.reduce(newState, event);
    expect(newState.board[nearSoldier.position.row][nearSoldier.position.col].unit?.damage).toBe(0);
    expect(newState.board[nearChampion.position.row][nearChampion.position.col].unit?.damage).toBe(1);
    expect(newState.board[farSoldier.position.row][farSoldier.position.col].unit?.damage).toBe(1);
    expect(newState.board[enemySoldier.position.row][enemySoldier.position.col].unit?.damage).toBe(1);
  });

  it('护持允许仲裁士兵在护持牧师相邻空格召唤，其他阵营不能复用该位置规则', () => {
    const state = createState();
    state.phase = 'summon';
    state.players['0'].magic = 10;
    placeUnit(state, { row: 4, col: 4 }, COMMON_UNITS_ZHONGCAI[2], '0');
    const summonCard = { ...COMMON_UNITS_ZHONGCAI[0], id: 'zhongcai-justice-hand' };
    state.players['0'].hand = [summonCard];
    const supportPosition = { row: 4, col: 5 };
    expect(getValidSummonPositionsForCard(state, '0', summonCard)).toContainEqual(supportPosition);
    expect(validateCommand(
      { core: state, sys: {} as any },
      {
        type: SW_COMMANDS.SUMMON_UNIT,
        playerId: '0',
        payload: { cardId: summonCard.id, position: supportPosition },
      },
    ).valid).toBe(true);
    const summoned = executeAndReduce(state, SW_COMMANDS.SUMMON_UNIT, {
      cardId: summonCard.id,
      position: supportPosition,
    });
    expect(summoned.newState.board[4][5].unit?.cardId).toBe(summonCard.id);

    const foreignState = createState();
    foreignState.players['0'].magic = 10;
    placeUnit(foreignState, { row: 4, col: 4 }, COMMON_UNITS_ZHONGCAI[2], '0');
    const foreignCard = { ...COMMON_UNITS_ZHONGCAI[0], id: 'foreign-soldier', faction: 'necromancer' };
    expect(getValidSummonPositionsForCard(foreignState, '0', foreignCard)).not.toContainEqual(supportPosition);
  });

  it('战争仲裁官的强健使有效战力增加1', () => {
    const state = createState();
    const warArbiter = placeUnit(state, { row: 2, col: 3 }, COMMON_UNITS_ZHONGCAI[3], '0');
    expect(getEffectiveStrengthValue(warArbiter, state)).toBe(warArbiter.card.strength + 1);
  });

  it('圣戒律令把召唤师受到的多于1点攻击伤害压到1点', () => {
    const state = createState();
    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['0'].activeEvents = [{ ...EVENT_CARDS_ZHONGCAI[1], id: 'zhongcai-holy-decree-0', charges: 1 }];
    const summoner = placeUnit(state, { row: 2, col: 3 }, SUMMONER_ZHONGCAI, '0');
    const attacker = placeUnit(state, { row: 2, col: 2 }, {
      ...COMMON_UNITS_ZHONGCAI[3], id: 'holy-decree-attacker', faction: 'necromancer', name: '敌方攻击者',
    }, '1');

    const result = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: summoner.position,
      resolvedDiceResults: [
        { faceIndex: 8, marks: ['melee'] },
        { faceIndex: 8, marks: ['melee'] },
      ],
    }, '1');
    const attacked = result.events.find((event) => event.type === SW_EVENTS.UNIT_ATTACKED);
    const damaged = result.events.find((event) => event.type === SW_EVENTS.UNIT_DAMAGED
      && (event.payload as { position?: CellCoord }).position?.row === 2
      && (event.payload as { position?: CellCoord }).position?.col === 3);
    expect((attacked?.payload as { hits?: number }).hits).toBe(1);
    expect((damaged?.payload as { damage?: number }).damage).toBe(1);
    expect(result.newState.board[2][3].unit?.damage).toBe(1);
  });

  it('刚硬只减免本回合第一次攻击，赎罪在实际造成伤害后自伤', () => {
    const state = createState();
    state.phase = 'attack';
    state.currentPlayer = '1';
    const sturdy = placeUnit(state, { row: 2, col: 3 }, COMMON_UNITS_ZHONGCAI[1], '0');
    const attackerCard: UnitCard = {
      ...COMMON_UNITS_ZHONGCAI[3], id: 'enemy-attacker', faction: 'necromancer', name: '敌方攻击者',
    };
    const attacker = placeUnit(state, { row: 2, col: 2 }, attackerCard, '1');
    const first = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: sturdy.position,
      resolvedDiceResults: [{ faceIndex: 8, marks: ['melee'] }],
    }, '1');
    expect(first.newState.board[2][3].unit?.damage).toBe(0);
    expect(first.newState.board[2][3].unit?.wasAttackedThisTurn).toBe(true);

    const second = executeAndReduce(first.newState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: sturdy.position,
      resolvedDiceResults: [{ faceIndex: 8, marks: ['melee'] }],
    }, '1');
    expect(second.newState.board[2][3].unit?.damage).toBe(1);

    const repentanceState = createState();
    repentanceState.phase = 'attack';
    const repentant = placeUnit(repentanceState, { row: 2, col: 3 }, COMMON_UNITS_ZHONGCAI[0], '0');
    const victim = placeUnit(repentanceState, { row: 2, col: 4 }, {
      ...COMMON_UNITS_ZHONGCAI[3], id: 'enemy-victim', faction: 'necromancer', name: '受击单位', life: 5,
    }, '1');
    const repentance = executeAndReduce(repentanceState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: repentant.position,
      target: victim.position,
      resolvedDiceResults: [{ faceIndex: 8, marks: ['melee'] }],
    });
    expect(repentance.newState.board[2][4].unit?.damage).toBe(1);
    expect(repentance.newState.board[2][3].unit?.damage).toBe(1);
  });

  it('圣戒律令和忠诚律令在自己回合开始时提供可选弃置提示', () => {
    const state = createState();
    state.currentPlayer = '1';
    state.players['0'].activeEvents = [{ ...EVENT_CARDS_ZHONGCAI[1], id: 'zhongcai-holy-decree-0' }];
    const events = summonerWarsFlowHooks.onPhaseEnter?.({
      state: { core: state, sys: {} as any },
      from: 'draw',
      to: 'summon',
      command: { type: SW_COMMANDS.END_PHASE, payload: {}, timestamp },
    } as any) ?? [];
    expect(events.some((event) => event.type === SW_EVENTS.ZHONGCAI_DECREE_PROMPTED)).toBe(true);
  });
});
