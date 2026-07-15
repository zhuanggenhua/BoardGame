/**
 * 召唤师战争 - 莫古机制测试
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { BoardUnit, CellCoord, EventCard, PlayerId, SummonerWarsCore, UnitCard } from '../domain/types';
import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { createInitializedCore, generateInstanceId, placeTestUnit } from './test-helpers';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
import { CHAMPION_UNITS_MOGU, COMMON_UNITS_MOGU, EVENT_CARDS_MOGU } from '../config/factions/mogu';

function testRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

function createState(): SummonerWarsCore {
  const state = createInitializedCore(['0', '1'], testRandom(), { faction0: 'mogu', faction1: 'necromancer' });
  for (const row of state.board) {
    for (const cell of row) {
      cell.unit = undefined;
      cell.structure = undefined;
    }
  }
  state.currentPlayer = '0';
  state.phase = 'summon';
  state.players['0'].hand = [];
  state.players['0'].discard = [];
  state.players['0'].magic = 10;
  state.players['0'].hasAttackedEnemy = true;
  return state;
}

function executeAndReduce(
  state: SummonerWarsCore,
  commandType: string,
  payload: Record<string, unknown>,
): { events: GameEvent[]; newState: SummonerWarsCore } {
  const fullState = { core: state } as MatchState<SummonerWarsCore>;
  const command = { type: commandType, payload, timestamp: 1000, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, testRandom());
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { events, newState };
}

function unitCard(id: string, name: string, abilities: string[] = [], overrides: Partial<UnitCard> = {}): UnitCard {
  return {
    id,
    cardType: 'unit',
    name,
    unitClass: 'common',
    faction: 'mogu',
    strength: 2,
    life: 3,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities,
    deckSymbols: [],
    ...overrides,
  };
}

function eventCard(id: string, name: string): EventCard {
  return {
    id,
    cardType: 'event',
    name,
    faction: 'mogu',
    cost: 0,
    playPhase: 'any',
    effect: '',
    deckSymbols: [],
  };
}

function place(
  state: SummonerWarsCore,
  pos: CellCoord,
  card: UnitCard,
  owner: PlayerId = '0',
  overrides: Partial<BoardUnit> = {},
): BoardUnit {
  return placeTestUnit(state, pos, {
    card,
    owner,
    cardId: overrides.cardId ?? card.id,
    instanceId: overrides.instanceId ?? generateInstanceId(card.id),
    ...overrides,
  });
}

function allUnits(state: SummonerWarsCore): BoardUnit[] {
  return state.board.flatMap(row => row.flatMap(cell => cell.unit ? [cell.unit] : []));
}

describe('莫古 - 血腥绽放与血腥狂怒', () => {
  it('库鞭克在2格内友方死亡后给2格内友方单位充能，且不充能召唤师和死亡单位', () => {
    const state = createState();
    state.phase = 'move';
    const summoner = place(state, { row: 4, col: 4 }, unitCard('mogu-summoner', '库鞭克', ['mogu_blood_bloom'], {
      unitClass: 'summoner',
      life: 7,
    }));
    const allyNear = place(state, { row: 4, col: 5 }, unitCard('ally-near', '近处友方'));
    const allyFar = place(state, { row: 0, col: 0 }, unitCard('ally-far', '远处友方'));
    const victim = place(state, { row: 5, col: 4 }, unitCard('victim', '牺牲友方'), '0', { damage: 2 });
    const mage = place(state, { row: 7, col: 4 }, unitCard('mogu-withering-mage-real', '枯萎法师', ['mogu_blood_infusion']));

    const validation = SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'mogu_blood_infusion',
        sourceUnitId: mage.instanceId,
        targetPosition: victim.position,
      },
      playerId: '0',
    });
    expect(validation.valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mogu_blood_infusion',
      sourceUnitId: mage.instanceId,
      targetPosition: victim.position,
    });

    expect(events.some(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBe(true);
    expect(newState.board[allyNear.position.row][allyNear.position.col].unit?.boosts).toBe(1);
    expect(newState.board[allyFar.position.row][allyFar.position.col].unit?.boosts ?? 0).toBe(0);
    expect(newState.board[summoner.position.row][summoner.position.col].unit?.boosts ?? 0).toBe(0);
    expect(newState.board[victim.position.row][victim.position.col].unit).toBeUndefined();
  });

  it('托恩在自己回合有单位死亡时充能，回合结束移除至多2点充能，力量强化最多+5', () => {
    const state = createState();
    state.phase = 'move';
    const tuoEn = place(state, { row: 4, col: 4 }, unitCard('mogu-tuo-en', '托恩', [
      'mogu_blood_rage',
      'power_up',
      'mogu_blood_rage_decay',
    ], {
      unitClass: 'champion',
      strength: 2,
      life: 6,
    }), '0', { boosts: 6 });
    const victim = place(state, { row: 5, col: 4 }, unitCard('victim', '牺牲友方'), '0', { damage: 2 });
    const mage = place(state, { row: 7, col: 4 }, unitCard('mogu-withering-mage-real', '枯萎法师', ['mogu_blood_infusion']));

    const validation = SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'mogu_blood_infusion',
        sourceUnitId: mage.instanceId,
        targetPosition: victim.position,
      },
      playerId: '0',
    });
    expect(validation.valid).toBe(true);

    const first = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mogu_blood_infusion',
      sourceUnitId: mage.instanceId,
      targetPosition: victim.position,
    });
    expect(first.newState.board[tuoEn.position.row][tuoEn.position.col].unit?.boosts).toBe(7);

    first.newState.phase = 'draw';
    const second = executeAndReduce(first.newState, SW_COMMANDS.END_PHASE, {});
    expect(second.newState.board[tuoEn.position.row][tuoEn.position.col].unit?.boosts).toBe(5);
    expect(getEffectiveStrengthValue({ ...tuoEn, boosts: 9 }, state)).toBe(7);
  });
});

describe('莫古 - 疫病体与菌化野兽', () => {
  it('菌袍疫病体在魔力阶段结束时3+充能会消灭，2充能不会消灭', () => {
    const state = createState();
    state.phase = 'magic';
    const body3 = place(state, { row: 4, col: 4 }, unitCard('mogu-spore-plague-body', '菌袍疫病体', [
      'mogu_burst',
      'mogu_fungal_mutation',
    ]), '0', { boosts: 3 });
    const body2 = place(state, { row: 4, col: 5 }, unitCard('mogu-spore-plague-body-2', '菌袍疫病体', [
      'mogu_burst',
      'mogu_fungal_mutation',
    ]), '0', { boosts: 2 });

    const { newState } = executeAndReduce(state, SW_COMMANDS.END_PHASE, {});

    expect(newState.board[body3.position.row][body3.position.col].unit).toBeUndefined();
    expect(newState.board[body2.position.row][body2.position.col].unit).toBeDefined();
  });

  it('菌袍疫病体3+充能死亡后可用弃牌堆菌化野兽替换', () => {
    const state = createState();
    state.phase = 'magic';
    const body = place(state, { row: 4, col: 4 }, unitCard('mogu-spore-plague-body', '菌袍疫病体', [
      'mogu_burst',
      'mogu_fungal_mutation',
    ]), '0', { boosts: 3 });
    state.players['0'].discard.push(unitCard('mogu-fungal-beast-discard', '菌化野兽', [
      'mogu_infection',
      'mogu_parasite',
    ]));

    const { newState } = executeAndReduce(state, SW_COMMANDS.END_PHASE, {});

    expect(newState.board[body.position.row][body.position.col].unit?.card.name).toBe('菌化野兽');
    expect(newState.players['0'].discard.find(c => c.id === 'mogu-fungal-beast-discard')).toBeUndefined();
  });

  it('菌化野兽击杀后用弃牌堆菌袍疫病体替换被消灭单位', () => {
    const state = createState();
    state.phase = 'attack';
    const beast = place(state, { row: 4, col: 4 }, unitCard('mogu-fungal-beast', '菌化野兽', [
      'mogu_infection',
      'mogu_parasite',
    ], { strength: 5 }), '0');
    const enemy = place(state, { row: 4, col: 5 }, unitCard('enemy', '敌方单位', [], {
      faction: 'necromancer',
      life: 1,
    }), '1');
    state.players['0'].discard.push(unitCard('mogu-spore-plague-body-discard', '菌袍疫病体'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: beast.position,
      target: enemy.position,
    });

    expect(newState.board[enemy.position.row][enemy.position.col].unit?.card.name).toBe('菌袍疫病体');
    expect(newState.players['0'].discard.find(c => c.id === 'mogu-spore-plague-body-discard')).toBeUndefined();
  });

  it('菌化野兽攻击阶段结束时优先消耗1充能，没有充能才自伤', () => {
    const chargedState = createState();
    chargedState.phase = 'attack';
    chargedState.players['0'].hasAttackedEnemy = true;
    const charged = place(chargedState, { row: 4, col: 4 }, unitCard('mogu-fungal-beast', '菌化野兽', ['mogu_parasite']), '0', {
      boosts: 1,
    });

    const chargedResult = executeAndReduce(chargedState, SW_COMMANDS.END_PHASE, {});
    expect(chargedResult.newState.board[charged.position.row][charged.position.col].unit?.boosts).toBe(0);
    expect(chargedResult.newState.board[charged.position.row][charged.position.col].unit?.damage).toBe(0);

    const emptyState = createState();
    emptyState.phase = 'attack';
    emptyState.players['0'].hasAttackedEnemy = true;
    const empty = place(emptyState, { row: 4, col: 4 }, unitCard('mogu-fungal-beast-empty', '菌化野兽', ['mogu_parasite']));

    const emptyResult = executeAndReduce(emptyState, SW_COMMANDS.END_PHASE, {});
    expect(emptyResult.newState.board[empty.position.row][empty.position.col].unit?.damage).toBe(1);
  });
});

describe('莫古 - 主动技能与事件牌', () => {
  it('静态录入字段与完整单卡主裁图一致', () => {
    expect(CHAMPION_UNITS_MOGU.map(card => ({
      id: card.id,
      cost: card.cost,
      strength: card.strength,
      life: card.life,
      attackType: card.attackType,
    }))).toEqual([
      { id: 'mogu-tuo-en', cost: 6, strength: 2, life: 7, attackType: 'melee' },
      { id: 'mogu-malformed-giant', cost: 3, strength: 5, life: 13, attackType: 'melee' },
      { id: 'mogu-ma-shuo-da', cost: 3, strength: 3, life: 8, attackType: 'melee' },
    ]);

    expect(COMMON_UNITS_MOGU.map(card => ({
      id: card.id,
      cost: card.cost,
      strength: card.strength,
      life: card.life,
      attackType: card.attackType,
    }))).toEqual([
      { id: 'mogu-withering-mage', cost: 2, strength: 4, life: 3, attackType: 'ranged' },
      { id: 'mogu-blood-shaman', cost: 1, strength: 3, life: 2, attackType: 'ranged' },
      { id: 'mogu-fungal-beast', cost: 3, strength: 3, life: 5, attackType: 'melee' },
      { id: 'mogu-spore-plague-body', cost: 0, strength: 2, life: 2, attackType: 'melee' },
    ]);

    expect(EVENT_CARDS_MOGU.map(card => ({
      id: card.id,
      eventType: card.eventType,
      playPhase: card.playPhase,
      cost: card.cost,
      isActive: card.isActive,
    }))).toEqual([
      { id: 'mogu-command', eventType: 'legendary', playPhase: 'attack', cost: 0, isActive: false },
      { id: 'mogu-symbiotic-self-healing', eventType: 'common', playPhase: 'move', cost: 0, isActive: false },
      { id: 'mogu-fanatical-fungus', eventType: 'common', playPhase: 'summon', cost: 0, isActive: true },
      { id: 'mogu-release-spores', eventType: 'legendary', playPhase: 'magic', cost: 0, isActive: false },
    ]);
  });

  it('畸形巨怪召唤时消灭5+充能菌化野兽，并在其位置替换登场', () => {
    const state = createState();
    state.phase = 'summon';
    const beast = place(state, { row: 4, col: 4 }, unitCard('mogu-fungal-beast', '菌化野兽', [
      'mogu_infection',
      'mogu_parasite',
    ]), '0', { boosts: 5 });
    const giant = unitCard('mogu-malformed-giant', '畸形巨怪', ['mogu_final_form'], {
      unitClass: 'champion',
      life: 8,
      cost: 6,
    });
    state.players['0'].hand.push(giant);

    const validation = SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.SUMMON_UNIT,
      payload: {
        cardId: giant.id,
        position: beast.position,
        sacrificeUnitId: beast.instanceId,
      },
      playerId: '0',
    });
    expect(validation.valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.SUMMON_UNIT, {
      cardId: giant.id,
      position: beast.position,
      sacrificeUnitId: beast.instanceId,
    });

    expect(events.find(e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as { reason?: string }).reason === 'mogu_final_form')).toBeDefined();
    expect(newState.board[beast.position.row][beast.position.col].unit?.card.name).toBe('畸形巨怪');
    expect(newState.board[3][3].unit).toBeUndefined();
  });

  it('畸形巨怪没有指定5+充能菌化野兽时不能按普通召唤格登场', () => {
    const state = createState();
    state.phase = 'summon';
    const beast = place(state, { row: 4, col: 4 }, unitCard('mogu-fungal-beast-low', '菌化野兽', [
      'mogu_infection',
      'mogu_parasite',
    ]), '0', { boosts: 4 });
    const giant = unitCard('mogu-malformed-giant', '畸形巨怪', ['mogu_final_form'], {
      unitClass: 'champion',
      life: 8,
      cost: 3,
    });
    state.players['0'].hand.push(giant);

    const missingTargetValidation = SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.SUMMON_UNIT,
      payload: { cardId: giant.id, position: { row: 3, col: 3 } },
      playerId: '0',
    });
    const lowChargeValidation = SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.SUMMON_UNIT,
      payload: { cardId: giant.id, position: beast.position, sacrificeUnitId: beast.instanceId },
      playerId: '0',
    });
    const { events, newState } = executeAndReduce(state, SW_COMMANDS.SUMMON_UNIT, {
      cardId: giant.id,
      position: { row: 3, col: 3 },
    });

    expect(missingTargetValidation.valid).toBe(false);
    expect(lowChargeValidation.valid).toBe(false);
    expect(events).toHaveLength(0);
    expect(newState.players['0'].magic).toBe(10);
    expect(newState.players['0'].hand.find(c => c.id === giant.id)).toBeDefined();
    expect(newState.board[3][3].unit).toBeUndefined();
  });

  it('畸形巨怪有多个5+充能菌化野兽时只替换玩家指定的那个', () => {
    const state = createState();
    state.phase = 'summon';
    const beastA = place(state, { row: 4, col: 4 }, unitCard('mogu-fungal-beast-a', '菌化野兽', [
      'mogu_infection',
      'mogu_parasite',
    ]), '0', { boosts: 5 });
    const beastB = place(state, { row: 5, col: 4 }, unitCard('mogu-fungal-beast-b', '菌化野兽', [
      'mogu_infection',
      'mogu_parasite',
    ]), '0', { boosts: 6 });
    const giant = unitCard('mogu-malformed-giant', '畸形巨怪', ['mogu_final_form'], {
      unitClass: 'champion',
      life: 8,
      cost: 3,
    });
    state.players['0'].hand.push(giant);

    const { newState } = executeAndReduce(state, SW_COMMANDS.SUMMON_UNIT, {
      cardId: giant.id,
      position: beastB.position,
      sacrificeUnitId: beastB.instanceId,
    });

    expect(newState.board[beastA.position.row][beastA.position.col].unit?.card.id).toBe('mogu-fungal-beast-a');
    expect(newState.board[beastB.position.row][beastB.position.col].unit?.card.name).toBe('畸形巨怪');
    expect(newState.players['0'].magic).toBe(7);
  });

  it('狂热菌菇可把移动后的友方单位推拉1格，然后充能并造成1伤害', () => {
    const state = createState();
    state.phase = 'move';
    const target = place(state, { row: 4, col: 4 }, unitCard('ally', '友方单位'));
    const newPosition = { row: 4, col: 5 };

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mogu_fanatical_fungus',
      sourceUnitId: target.instanceId,
      targetPosition: target.position,
      newPosition,
    });

    expect(events.find(e => e.type === SW_EVENTS.UNIT_PUSHED)).toBeDefined();
    expect(newState.board[target.position.row][target.position.col].unit).toBeUndefined();
    expect(newState.board[newPosition.row][newPosition.col].unit?.boosts).toBe(1);
    expect(newState.board[newPosition.row][newPosition.col].unit?.damage).toBe(1);
  });

  it('狂热菌菇可以不推拉，仍只对移动后的单位充能并造成1伤害', () => {
    const state = createState();
    state.phase = 'move';
    const target = place(state, { row: 4, col: 4 }, unitCard('ally', '友方单位'));

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mogu_fanatical_fungus',
      sourceUnitId: target.instanceId,
      targetPosition: target.position,
    });

    expect(events.find(e => e.type === SW_EVENTS.UNIT_PUSHED)).toBeUndefined();
    expect(newState.board[target.position.row][target.position.col].unit?.boosts).toBe(1);
    expect(newState.board[target.position.row][target.position.col].unit?.damage).toBe(1);
  });

  it('玛硕达在移动阶段结束时自伤，若仍在场则给相邻友方2充能', () => {
    const state = createState();
    state.phase = 'move';
    const maShuoDa = place(state, { row: 4, col: 4 }, unitCard('mogu-ma-shuo-da', '玛硕达', ['mogu_decay'], {
      unitClass: 'champion',
      life: 6,
    }));
    const ally = place(state, { row: 4, col: 5 }, unitCard('ally', '友方单位'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.END_PHASE, {});

    expect(newState.board[maShuoDa.position.row][maShuoDa.position.col].unit?.damage).toBe(1);
    expect(newState.board[ally.position.row][ally.position.col].unit?.boosts).toBe(2);
  });

  it('枯萎法师在移动阶段给2格内友方充能并造成1伤害', () => {
    const state = createState();
    state.phase = 'move';
    const mage = place(state, { row: 4, col: 3 }, unitCard('mogu-withering-mage', '枯萎法师', ['mogu_blood_infusion']));
    const ally = place(state, { row: 4, col: 5 }, unitCard('ally', '友方单位'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mogu_blood_infusion',
      sourceUnitId: mage.instanceId,
      targetPosition: ally.position,
    });

    expect(newState.board[ally.position.row][ally.position.col].unit?.boosts).toBe(1);
    expect(newState.board[ally.position.row][ally.position.col].unit?.damage).toBe(1);
  });

  it('鲜血萨满可以在2格内转移充能', () => {
    const state = createState();
    state.phase = 'move';
    const shaman = place(state, { row: 4, col: 4 }, unitCard('mogu-blood-shaman', '鲜血萨满', ['mogu_transmission']), '0', {
      boosts: 3,
    });
    const ally = place(state, { row: 4, col: 5 }, unitCard('ally', '友方单位'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mogu_transmission',
      sourceUnitId: shaman.instanceId,
      mode: 'self_to_target',
      toPosition: ally.position,
      amount: 2,
    });

    expect(newState.board[shaman.position.row][shaman.position.col].unit?.boosts).toBe(1);
    expect(newState.board[ally.position.row][ally.position.col].unit?.boosts).toBe(2);
  });

  it('鲜血萨满选择转移0充能时不会改变权威状态', () => {
    const state = createState();
    state.phase = 'move';
    const shaman = place(state, { row: 4, col: 4 }, unitCard('mogu-blood-shaman', '鲜血萨满', ['mogu_transmission']), '0', {
      boosts: 3,
    });
    const ally = place(state, { row: 4, col: 5 }, unitCard('ally', '友方单位'));

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mogu_transmission',
      sourceUnitId: shaman.instanceId,
      mode: 'self_to_target',
      toPosition: ally.position,
      amount: 0,
    });

    expect(events.find(e => e.type === SW_EVENTS.UNIT_CHARGED)).toBeUndefined();
    expect(newState.board[shaman.position.row][shaman.position.col].unit?.boosts).toBe(3);
    expect(newState.board[ally.position.row][ally.position.col].unit?.boosts ?? 0).toBe(0);
  });

  it('命令授予召唤师3格内友方士兵一次额外攻击，目标不会在打出事件时立刻死亡', () => {
    const state = createState();
    state.phase = 'attack';
    const summoner = place(state, { row: 4, col: 3 }, unitCard('mogu-summoner', '库鞭克', [], {
      unitClass: 'summoner',
      life: 7,
    }));
    const target = place(state, { row: 4, col: 5 }, unitCard('ally', '友方士兵'));
    state.players['0'].hand.push(eventCard('mogu-command', '命令'));

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-command',
      targets: [target.position],
    });

    expect(summoner).toBeDefined();
    expect(events.some(e => e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED)).toBe(true);
    expect(newState.board[target.position.row][target.position.col].unit?.extraAttacks).toBe(1);
    expect(newState.board[target.position.row][target.position.col].unit?.destroyAfterExtraAttackSource).toBe('mogu_command');
  });

  it('命令授予的友方士兵可以横向攻击相邻敌人，攻击完成后再被消灭', () => {
    const state = createState();
    state.phase = 'attack';
    place(state, { row: 4, col: 2 }, unitCard('mogu-summoner', '库鞭克', [], {
      unitClass: 'summoner',
      life: 7,
    }));
    const target = place(state, { row: 4, col: 4 }, unitCard('ally-horizontal', '友方士兵'));
    const enemy = place(state, { row: 4, col: 5 }, unitCard('enemy-horizontal', '横向相邻敌方单位', [], {
      faction: 'necromancer',
      life: 5,
    }), '1');
    state.players['0'].hand.push(eventCard('mogu-command', '命令'));

    const commandResult = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-command',
      targets: [target.position],
    });
    const validation = SummonerWarsDomain.validate({ core: commandResult.newState } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: target.position, target: enemy.position },
      playerId: '0',
    });
    const attackResult = executeAndReduce(commandResult.newState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: target.position,
      target: enemy.position,
    });

    expect(validation.valid).toBe(true);
    expect(attackResult.events.some(e => e.type === SW_EVENTS.UNIT_ATTACKED)).toBe(true);
    expect(attackResult.events.find(e => e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as { reason?: string }).reason === 'mogu_command')).toBeDefined();
    expect(attackResult.newState.board[target.position.row][target.position.col].unit).toBeUndefined();
  });

  it('共生自愈治疗多个已受伤友方士兵和英雄并充能', () => {
    const state = createState();
    const common = place(state, { row: 4, col: 3 }, unitCard('common', '友方士兵'), '0', { damage: 1 });
    const champion = place(state, { row: 4, col: 4 }, unitCard('champion', '友方英雄', [], {
      unitClass: 'champion',
      life: 5,
    }), '0', { damage: 2 });
    const summoner = place(state, { row: 4, col: 5 }, unitCard('summoner', '召唤师', [], {
      unitClass: 'summoner',
      life: 7,
    }), '0', { damage: 2 });
    state.players['0'].hand.push(eventCard('mogu-symbiotic-self-healing', '共生自愈'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-symbiotic-self-healing',
      targets: [common.position, champion.position, summoner.position],
    });

    expect(newState.board[common.position.row][common.position.col].unit?.damage).toBe(0);
    expect(newState.board[common.position.row][common.position.col].unit?.boosts).toBe(1);
    expect(newState.board[champion.position.row][champion.position.col].unit?.damage).toBe(1);
    expect(newState.board[champion.position.row][champion.position.col].unit?.boosts).toBe(1);
    expect(newState.board[summoner.position.row][summoner.position.col].unit?.damage).toBe(2);
    expect(newState.board[summoner.position.row][summoner.position.col].unit?.boosts ?? 0).toBe(0);
  });

  it('共生自愈空选时只消耗事件牌，不改变场上单位状态', () => {
    const state = createState();
    const common = place(state, { row: 4, col: 3 }, unitCard('common', '友方士兵'), '0', { damage: 1 });
    state.players['0'].hand.push(eventCard('mogu-symbiotic-self-healing', '共生自愈'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-symbiotic-self-healing',
      targets: [],
    });

    expect(newState.board[common.position.row][common.position.col].unit?.damage).toBe(1);
    expect(newState.board[common.position.row][common.position.col].unit?.boosts ?? 0).toBe(0);
    expect(newState.players['0'].hand.find(c => c.id === 'mogu-symbiotic-self-healing')).toBeUndefined();
    expect(newState.players['0'].discard.find(c => c.id === 'mogu-symbiotic-self-healing')).toBeDefined();
  });

  it('释放菌袍从弃牌堆拿至多两张菌袍疫病体放到召唤师相邻空格', () => {
    const state = createState();
    const summoner = place(state, { row: 4, col: 4 }, unitCard('mogu-summoner', '库鞭克', [], {
      unitClass: 'summoner',
      life: 7,
    }));
    const bodyA = unitCard('mogu-spore-plague-body-a', '菌袍疫病体');
    const bodyB = unitCard('mogu-spore-plague-body-b', '菌袍疫病体');
    const bodyC = unitCard('mogu-spore-plague-body-c', '菌袍疫病体');
    state.players['0'].discard.push(bodyA, bodyB, bodyC);
    state.players['0'].hand.push(eventCard('mogu-release-spores', '释放菌袍'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-release-spores',
      targets: [
        { row: summoner.position.row - 1, col: summoner.position.col },
        { row: summoner.position.row + 1, col: summoner.position.col },
      ],
    });

    expect(newState.board[3][4].unit?.card.name).toBe('菌袍疫病体');
    expect(newState.board[5][4].unit?.card.name).toBe('菌袍疫病体');
    expect(newState.players['0'].discard.filter(c => c.name === '菌袍疫病体')).toHaveLength(1);
  });

  it('释放菌袍空选时只消耗事件牌，不从弃牌堆召唤疫病体', () => {
    const state = createState();
    place(state, { row: 4, col: 4 }, unitCard('mogu-summoner', '库鞭克', [], {
      unitClass: 'summoner',
      life: 7,
    }));
    const bodyA = unitCard('mogu-spore-plague-body-a', '菌袍疫病体');
    const bodyB = unitCard('mogu-spore-plague-body-b', '菌袍疫病体');
    state.players['0'].discard.push(bodyA, bodyB);
    state.players['0'].hand.push(eventCard('mogu-release-spores', '释放菌袍'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-release-spores',
      cardIds: [],
      targets: [],
    });

    expect(newState.players['0'].discard.filter(c => c.name === '菌袍疫病体')).toHaveLength(2);
    expect(newState.players['0'].hand.find(c => c.id === 'mogu-release-spores')).toBeUndefined();
    expect(newState.players['0'].discard.find(c => c.id === 'mogu-release-spores')).toBeDefined();
  });

  it('共生自愈只治疗并充能合法目标，事件牌消耗后不重复结算', () => {
    const state = createState();
    const common = place(state, { row: 4, col: 2 }, unitCard('common-repeat', '友方士兵'), '0', { damage: 1 });
    const enemy = place(state, { row: 4, col: 3 }, unitCard('enemy-repeat', '敌方士兵', [], {
      faction: 'necromancer',
    }), '1', { damage: 1 });
    const fullLife = place(state, { row: 4, col: 4 }, unitCard('full-life-repeat', '未受伤友方'));
    state.players['0'].hand.push(eventCard('mogu-symbiotic-self-healing', '共生自愈'));

    const first = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-symbiotic-self-healing',
      targets: [common.position, enemy.position, fullLife.position],
    });
    const second = executeAndReduce(first.newState, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-symbiotic-self-healing',
      targets: [common.position, fullLife.position],
    });

    expect(first.newState.board[common.position.row][common.position.col].unit?.damage).toBe(0);
    expect(first.newState.board[common.position.row][common.position.col].unit?.boosts).toBe(1);
    expect(first.newState.board[enemy.position.row][enemy.position.col].unit?.damage).toBe(1);
    expect(first.newState.board[enemy.position.row][enemy.position.col].unit?.boosts ?? 0).toBe(0);
    expect(first.newState.board[fullLife.position.row][fullLife.position.col].unit?.damage ?? 0).toBe(0);
    expect(first.newState.board[fullLife.position.row][fullLife.position.col].unit?.boosts).toBe(1);
    expect(first.newState.players['0'].hand.find(c => c.id === 'mogu-symbiotic-self-healing')).toBeUndefined();
    expect(second.events).toHaveLength(0);
    expect(second.newState.board[common.position.row][common.position.col].unit?.boosts).toBe(1);
  });

  it('释放菌袍只消耗显式选择的至多两张疫病体，重复打出不会再次召唤', () => {
    const state = createState();
    const summoner = place(state, { row: 4, col: 4 }, unitCard('mogu-summoner-repeat', '库鞭克', [], {
      unitClass: 'summoner',
      life: 7,
    }));
    const bodyA = unitCard('mogu-spore-plague-body-repeat-a', '菌袍疫病体');
    const bodyB = unitCard('mogu-spore-plague-body-repeat-b', '菌袍疫病体');
    const bodyC = unitCard('mogu-spore-plague-body-repeat-c', '菌袍疫病体');
    state.players['0'].discard.push(bodyA, bodyB, bodyC);
    state.players['0'].hand.push(eventCard('mogu-release-spores', '释放菌袍'));

    const first = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-release-spores',
      cardIds: [bodyA.id, bodyC.id],
      targets: [
        { row: summoner.position.row - 1, col: summoner.position.col },
        { row: summoner.position.row, col: summoner.position.col - 1 },
      ],
    });
    const second = executeAndReduce(first.newState, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'mogu-release-spores',
      cardIds: [bodyB.id],
      targets: [{ row: summoner.position.row + 1, col: summoner.position.col }],
    });

    expect(first.newState.board[3][4].unit?.card.id).toBe(bodyA.id);
    expect(first.newState.board[4][3].unit?.card.id).toBe(bodyC.id);
    expect(first.newState.players['0'].discard.map(c => c.id)).toEqual([bodyB.id, 'mogu-release-spores']);
    expect(first.newState.players['0'].hand.find(c => c.id === 'mogu-release-spores')).toBeUndefined();
    expect(second.events).toHaveLength(0);
    expect(second.newState.board[5][4].unit).toBeUndefined();
  });

  it('菌袍疫病体爆裂和菌化变异同一阶段只替换一次，并清理弃牌堆来源', () => {
    const state = createState();
    state.phase = 'magic';
    const body = place(state, { row: 4, col: 4 }, unitCard('mogu-spore-plague-body-l4', '菌袍疫病体', [
      'mogu_burst',
      'mogu_fungal_mutation',
    ]), '0', { boosts: 3 });
    const beastA = unitCard('mogu-fungal-beast-l4-a', '菌化野兽', ['mogu_infection', 'mogu_parasite']);
    const beastB = unitCard('mogu-fungal-beast-l4-b', '菌化野兽', ['mogu_infection', 'mogu_parasite']);
    state.players['0'].discard.push(beastA, beastB);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.END_PHASE, {});
    const mutationSummons = events.filter(e => e.type === SW_EVENTS.UNIT_SUMMONED
      && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_fungal_mutation');

    expect(mutationSummons).toHaveLength(1);
    expect(newState.board[body.position.row][body.position.col].unit?.card.id).toBe(beastA.id);
    expect(newState.players['0'].discard.map(c => c.id)).toEqual([beastB.id, body.card.id]);
    expect(allUnits(newState).filter(unit => unit.card.name === '菌袍疫病体')).toHaveLength(0);
    expect(newState.phase).toBe('draw');
  });

  it('菌化野兽真实击杀替换后，被消灭单位不会残留，弃牌堆疫病体只消耗一次', () => {
    const state = createState();
    state.phase = 'attack';
    const beast = place(state, { row: 4, col: 4 }, unitCard('mogu-fungal-beast-l4', '菌化野兽', [
      'mogu_infection',
      'mogu_parasite',
    ], { strength: 5 }), '0');
    const enemy = place(state, { row: 4, col: 5 }, unitCard('enemy-l4', '敌方单位', [], {
      faction: 'necromancer',
      life: 1,
    }), '1');
    const bodyA = unitCard('mogu-spore-plague-body-l4-a', '菌袍疫病体');
    const bodyB = unitCard('mogu-spore-plague-body-l4-b', '菌袍疫病体');
    state.players['0'].discard.push(bodyA, bodyB);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: beast.position,
      target: enemy.position,
    });
    const infectionSummons = events.filter(e => e.type === SW_EVENTS.UNIT_SUMMONED
      && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_infection');

    expect(infectionSummons).toHaveLength(1);
    expect(newState.board[enemy.position.row][enemy.position.col].unit?.card.id).toBe(bodyA.id);
    expect(allUnits(newState).find(unit => unit.instanceId === enemy.instanceId)).toBeUndefined();
    expect(newState.players['0'].discard.map(c => c.id)).toEqual([bodyB.id]);
  });

  it('托恩回合结束衰减按当前充能收口，并随换人进入下一回合', () => {
    const state = createState();
    state.phase = 'draw';
    const tuoEn = place(state, { row: 4, col: 4 }, unitCard('mogu-tuo-en-l4', '托恩', [
      'mogu_blood_rage_decay',
    ], {
      unitClass: 'champion',
      life: 6,
    }), '0', { boosts: 1 });

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.END_PHASE, {});
    const decayEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED
      && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_blood_rage_decay');

    expect(decayEvents).toHaveLength(1);
    expect(newState.board[tuoEn.position.row][tuoEn.position.col].unit?.boosts).toBe(0);
    expect(newState.currentPlayer).toBe('1');
    expect(newState.phase).toBe('summon');
  });

  it('玛硕达移动阶段结束若被腐坏自伤杀死，不再给相邻友方充能', () => {
    const state = createState();
    state.phase = 'move';
    const maShuoDa = place(state, { row: 4, col: 4 }, unitCard('mogu-ma-shuo-da-dies', '玛硕达', ['mogu_decay'], {
      unitClass: 'champion',
      life: 1,
    }));
    const ally = place(state, { row: 4, col: 5 }, unitCard('ally-decay-l4', '友方单位'));

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.END_PHASE, {});
    const decayChargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED
      && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_decay');

    expect(newState.board[maShuoDa.position.row][maShuoDa.position.col].unit).toBeUndefined();
    expect(newState.board[ally.position.row][ally.position.col].unit?.boosts ?? 0).toBe(0);
    expect(decayChargeEvents).toHaveLength(0);
    expect(newState.phase).toBe('build');
  });

  it('腐坏给菌袍疫病体补到3充能后，后续魔力阶段结束会触发爆裂并菌化变异', () => {
    const state = createState();
    state.phase = 'move';
    place(state, { row: 4, col: 4 }, unitCard('mogu-ma-shuo-da-chain', '玛硕达', ['mogu_decay'], {
      unitClass: 'champion',
      life: 6,
    }));
    const body = place(state, { row: 4, col: 5 }, unitCard('mogu-spore-plague-body-chain', '菌袍疫病体', [
      'mogu_burst',
      'mogu_fungal_mutation',
    ]), '0', { boosts: 1 });
    const beast = unitCard('mogu-fungal-beast-chain', '菌化野兽', ['mogu_infection', 'mogu_parasite']);
    state.players['0'].discard.push(beast);

    const afterMoveEnd = executeAndReduce(state, SW_COMMANDS.END_PHASE, {});
    expect(afterMoveEnd.newState.board[body.position.row][body.position.col].unit?.boosts).toBe(3);

    afterMoveEnd.newState.phase = 'magic';
    const afterMagicEnd = executeAndReduce(afterMoveEnd.newState, SW_COMMANDS.END_PHASE, {});
    const burstDestroy = afterMagicEnd.events.find(e => e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_burst');

    expect(burstDestroy).toBeDefined();
    expect(afterMagicEnd.newState.board[body.position.row][body.position.col].unit?.card.id).toBe(beast.id);
    expect(afterMagicEnd.newState.players['0'].discard.find(c => c.id === beast.id)).toBeUndefined();
  });
});
