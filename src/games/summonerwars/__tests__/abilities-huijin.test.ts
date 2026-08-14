/**
 * 召唤师战争 - 灰烬机制测试
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { BoardUnit, CellCoord, EventCard, PlayerId, SummonerWarsCore, UnitCard } from '../domain/types';
import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { createInitializedCore, generateInstanceId, placeTestUnit } from './test-helpers';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
import { summonerWarsFlowHooks } from '../domain/flowHooks';
import {
  CHAMPION_UNITS_HUIJIN,
  COMMON_UNITS_HUIJIN,
  EVENT_CARDS_HUIJIN,
  SUMMONER_HUIJIN,
} from '../config/factions/huijin';
import { DECK_SYMBOLS } from '../config/symbols';
import { swDamageSourceResolver } from '../actionLog';

function testRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

function createState(): SummonerWarsCore {
  const state = createInitializedCore(['0', '1'], testRandom(), { faction0: 'huijin', faction1: 'necromancer' });
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
  state.players['0'].activeEvents = [];
  state.players['0'].magic = 10;
  state.players['0'].hasAttackedEnemy = true;
  state.players['1'].hand = [];
  state.players['1'].discard = [];
  state.players['1'].activeEvents = [];
  state.players['1'].magic = 10;
  state.players['1'].hasAttackedEnemy = true;
  return state;
}

function executeAndReduce(
  state: SummonerWarsCore,
  commandType: string,
  payload: Record<string, unknown>,
  random: RandomFn = testRandom(),
): { events: GameEvent[]; newState: SummonerWarsCore } {
  const fullState = { core: state } as MatchState<SummonerWarsCore>;
  const command = { type: commandType, payload, timestamp: 1000, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, random);
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { events, newState };
}

function validateSummon(state: SummonerWarsCore, cardId: string, position: CellCoord) {
  return SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
    type: SW_COMMANDS.SUMMON_UNIT,
    payload: { cardId, position },
    playerId: '0',
  });
}

function unitCard(id: string, name: string, abilities: string[] = [], overrides: Partial<UnitCard> = {}): UnitCard {
  return {
    id,
    cardType: 'unit',
    name,
    unitClass: 'common',
    faction: 'huijin',
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

function eventCard(id: string, name: string, overrides: Partial<EventCard> = {}): EventCard {
  return {
    id,
    cardType: 'event',
    name,
    faction: 'huijin',
    cost: 0,
    playPhase: 'summon',
    effect: '',
    deckSymbols: [],
    ...overrides,
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

function damageEventFor(events: GameEvent[], position: CellCoord, sourceAbilityId: string): GameEvent | undefined {
  return events.find((event) => {
    if (event.type !== SW_EVENTS.UNIT_DAMAGED) return false;
    const payload = event.payload as { position?: CellCoord; sourceAbilityId?: string };
    return payload.sourceAbilityId === sourceAbilityId
      && payload.position?.row === position.row
      && payload.position?.col === position.col;
  });
}

describe('灰烬 - 静态录入与复用能力', () => {
  it('卡牌基础字段与图集 slot 顺序保持一致', () => {
    expect(SUMMONER_HUIJIN).toMatchObject({
      id: 'huijin-summoner',
      name: '玛达莉雅女王',
      strength: 4,
      life: 9,
      attackType: 'ranged',
      spriteAtlas: 'hero',
      spriteIndex: 0,
    });
    expect(SUMMONER_HUIJIN.deckSymbols).toEqual([
      DECK_SYMBOLS.DOUBLE_AXE,
      DECK_SYMBOLS.EMBER,
      DECK_SYMBOLS.PHOENIX,
    ]);

    expect(CHAMPION_UNITS_HUIJIN.map(card => ({
      id: card.id,
      cost: card.cost,
      strength: card.strength,
      life: card.life,
      attackType: card.attackType,
      deckSymbols: card.deckSymbols,
      spriteIndex: card.spriteIndex,
    }))).toEqual([
      { id: 'huijin-helisi', cost: 5, strength: 3, life: 7, attackType: 'ranged', deckSymbols: [DECK_SYMBOLS.EMBER], spriteIndex: 0 },
      { id: 'huijin-flame-dragon-beast', cost: 8, strength: 4, life: 10, attackType: 'ranged', deckSymbols: [DECK_SYMBOLS.EMBER, DECK_SYMBOLS.PHOENIX], spriteIndex: 1 },
      { id: 'huijin-fengnisha', cost: 5, strength: 3, life: 9, attackType: 'melee', deckSymbols: [DECK_SYMBOLS.PHOENIX], spriteIndex: 2 },
    ]);

    expect(COMMON_UNITS_HUIJIN.map(card => ({
      id: card.id,
      cost: card.cost,
      strength: card.strength,
      life: card.life,
      attackType: card.attackType,
      deckSymbols: card.deckSymbols,
      spriteIndex: card.spriteIndex,
    }))).toEqual([
      { id: 'huijin-ash-mage', cost: 1, strength: 2, life: 2, attackType: 'ranged', deckSymbols: [DECK_SYMBOLS.PHOENIX], spriteIndex: 3 },
      { id: 'huijin-royal-guard', cost: 2, strength: 1, life: 4, attackType: 'melee', deckSymbols: [DECK_SYMBOLS.PHOENIX], spriteIndex: 4 },
      { id: 'huijin-ash-beast', cost: 2, strength: 3, life: 3, attackType: 'melee', deckSymbols: [DECK_SYMBOLS.EMBER], spriteIndex: 5 },
      { id: 'huijin-ash-archer', cost: 1, strength: 2, life: 2, attackType: 'ranged', deckSymbols: [DECK_SYMBOLS.PHOENIX], spriteIndex: 6 },
    ]);

    expect(EVENT_CARDS_HUIJIN.map(card => ({
      id: card.id,
      eventType: card.eventType,
      playPhase: card.playPhase,
      cost: card.cost,
      isActive: card.isActive,
      deckSymbols: card.deckSymbols,
      spriteIndex: card.spriteIndex,
    }))).toEqual([
      { id: 'huijin-dazzling-light', eventType: 'common', playPhase: 'magic', cost: 1, isActive: true, deckSymbols: [DECK_SYMBOLS.PHOENIX], spriteIndex: 7 },
      { id: 'huijin-scorch', eventType: 'common', playPhase: 'move', cost: 0, isActive: false, deckSymbols: [DECK_SYMBOLS.EMBER], spriteIndex: 8 },
      { id: 'huijin-divine-revenge', eventType: 'common', playPhase: 'magic', cost: 0, isActive: true, deckSymbols: [DECK_SYMBOLS.EMBER, DECK_SYMBOLS.PHOENIX], spriteIndex: 9 },
      { id: 'huijin-phoenix-soul', eventType: 'legendary', playPhase: 'summon', cost: 0, isActive: true, deckSymbols: [], spriteIndex: 10 },
    ]);
  });

  it('玛达莉雅女王攻击敌方后复用威势给自己充能', () => {
    const state = createState();
    state.phase = 'attack';
    const summoner = place(state, { row: 4, col: 4 }, SUMMONER_HUIJIN);
    place(state, { row: 4, col: 5 }, unitCard('enemy', '敌方单位', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: summoner.position,
      target: { row: 4, col: 5 },
    });

    expect(events.some(e => e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as { abilityId?: string }).abilityId === 'intimidate')).toBe(true);
    expect(newState.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(1);
  });

  it('皇家守卫复用缠斗：相邻敌方离开时受到1点伤害', () => {
    const state = createState();
    state.phase = 'move';
    state.currentPlayer = '1';
    place(state, { row: 4, col: 2 }, unitCard('huijin-royal-guard', '皇家守卫', ['entangle', 'huijin_ram']));
    place(state, { row: 4, col: 3 }, unitCard('enemy-runner', '敌方单位', [], {
      faction: 'necromancer',
      life: 5,
    }), '1');

    const { newState } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 4, col: 5 },
    });

    expect(newState.board[4][5].unit?.damage).toBe(1);
  });
});

describe('灰烬 - 召唤位置扩展', () => {
  it('赫丽丝让友方灰烬单位可召唤到自己相邻空格，并完成召唤结算', () => {
    const state = createState();
    place(state, { row: 4, col: 4 }, unitCard('huijin-helisi', '赫丽丝', ['huijin_ember_summon'], {
      unitClass: 'champion',
    }));
    const archer = unitCard('huijin-ash-archer-hand', '灰烬弓箭手', ['huijin_quick_shot'], {
      cost: 1,
      attackType: 'ranged',
      attackRange: 3,
    });
    state.players['0'].hand.push(archer);

    const target = { row: 4, col: 5 };
    expect(validateSummon(state, archer.id, target).valid).toBe(true);

    const { newState } = executeAndReduce(state, SW_COMMANDS.SUMMON_UNIT, {
      cardId: archer.id,
      position: target,
    });

    expect(newState.board[target.row][target.col].unit?.cardId).toBe(archer.id);
    expect(newState.players['0'].magic).toBe(9);
    expect(newState.players['0'].hand.find(card => card.id === archer.id)).toBeUndefined();
  });

  it('非灰烬单位不能使用赫丽丝的怒焰召唤位置', () => {
    const state = createState();
    place(state, { row: 4, col: 4 }, unitCard('huijin-helisi', '赫丽丝', ['huijin_ember_summon'], {
      unitClass: 'champion',
    }));
    const outsider = unitCard('enemy-common-hand', '非灰烬单位', [], {
      faction: 'necromancer',
      cost: 1,
    });
    state.players['0'].hand.push(outsider);

    expect(validateSummon(state, outsider.id, { row: 4, col: 5 }).valid).toBe(false);
  });

  it('火焰龙兽可用护主召唤到召唤师相邻空格，普通单位不能复用该位置', () => {
    const state = createState();
    place(state, { row: 4, col: 4 }, SUMMONER_HUIJIN);
    const dragon = unitCard('huijin-flame-dragon-beast-hand', '火焰龙兽', ['huijin_guard_master'], {
      unitClass: 'champion',
      cost: 8,
      strength: 4,
      life: 10,
      attackType: 'ranged',
      attackRange: 3,
    });
    const mage = unitCard('huijin-ash-mage-hand', '灰烬法师', ['huijin_shelter'], { cost: 1 });
    state.players['0'].hand.push(dragon, mage);

    const target = { row: 4, col: 5 };
    expect(validateSummon(state, dragon.id, target).valid).toBe(true);
    expect(validateSummon(state, mage.id, target).valid).toBe(false);
  });

  it('灰烬野兽可用烈火降生召唤到友方灰烬单位相邻空格', () => {
    const state = createState();
    place(state, { row: 4, col: 4 }, unitCard('huijin-ash-archer-board', '灰烬弓箭手', ['huijin_quick_shot'], {
      attackType: 'ranged',
      attackRange: 3,
    }));
    const beast = unitCard('huijin-ash-beast-hand', '灰烬野兽', ['huijin_born_of_flame', 'huijin_wildfire'], {
      cost: 2,
      strength: 3,
    });
    state.players['0'].hand.push(beast);

    expect(validateSummon(state, beast.id, { row: 4, col: 5 }).valid).toBe(true);
  });
});

describe('灰烬 - 自动机制', () => {
  it('赫丽丝点燃相邻友方灰烬单位，非相邻单位与赫丽丝自身不加成', () => {
    const state = createState();
    const helisi = place(state, { row: 4, col: 4 }, unitCard('huijin-helisi', '赫丽丝', ['huijin_ignite'], {
      unitClass: 'champion',
      strength: 3,
      attackType: 'ranged',
      attackRange: 3,
    }));
    const adjacentArcher = place(state, { row: 4, col: 5 }, unitCard('huijin-ash-archer', '灰烬弓箭手', [], {
      strength: 2,
      attackType: 'ranged',
      attackRange: 3,
    }));
    const farBeast = place(state, { row: 0, col: 0 }, unitCard('huijin-ash-beast', '灰烬野兽', [], {
      strength: 3,
    }));

    expect(getEffectiveStrengthValue(adjacentArcher, state)).toBe(3);
    expect(getEffectiveStrengthValue(farBeast, state)).toBe(3);
    expect(getEffectiveStrengthValue(helisi, state)).toBe(3);
  });

  it('灰烬法师庇护将本回合首次被攻击伤害限制为1，第二次被攻击不再限制', () => {
    const state = createState();
    state.phase = 'attack';
    state.currentPlayer = '1';
    const mage = place(state, { row: 4, col: 4 }, unitCard('huijin-ash-mage', '灰烬法师', ['huijin_shelter'], {
      life: 6,
    }));
    const firstAttacker = place(state, { row: 4, col: 5 }, unitCard('enemy-a', '敌方甲', [], {
      faction: 'necromancer',
      strength: 4,
    }), '1');
    const secondAttacker = place(state, { row: 5, col: 4 }, unitCard('enemy-b', '敌方乙', [], {
      faction: 'necromancer',
      strength: 4,
    }), '1');

    const first = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: firstAttacker.position,
      target: mage.position,
    });
    const second = executeAndReduce(first.newState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: secondAttacker.position,
      target: mage.position,
    });
    const secondDamage = second.events.find(e => e.type === SW_EVENTS.UNIT_DAMAGED
      && ((e.payload as { position?: CellCoord }).position?.row === mage.position.row)
      && ((e.payload as { position?: CellCoord }).position?.col === mage.position.col));

    expect(first.newState.board[mage.position.row][mage.position.col].unit?.damage).toBe(1);
    expect((secondDamage?.payload as { damage?: number } | undefined)?.damage).toBe(4);
  });

  it('风妮莎被相邻敌方攻击后若仍在场，会对攻击者造成1点还击伤害', () => {
    const state = createState();
    state.phase = 'attack';
    state.currentPlayer = '1';
    const fengnisha = place(state, { row: 4, col: 4 }, unitCard('huijin-fengnisha', '风妮莎', ['huijin_counterattack'], {
      unitClass: 'champion',
      life: 9,
    }));
    const attacker = place(state, { row: 4, col: 5 }, unitCard('enemy-attacker', '敌方攻击者', [], {
      faction: 'necromancer',
      strength: 1,
      life: 5,
    }), '1');

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: fengnisha.position,
    });

    expect(events.some(e => e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as { abilityId?: string }).abilityId === 'huijin_counterattack')).toBe(true);
    expect(newState.board[attacker.position.row][attacker.position.col].unit?.damage).toBe(1);
  });

  it('灰烬野兽在移动阶段开始时对相邻敌方各造成1点野火伤害', () => {
    const state = createState();
    state.phase = 'summon';
    const beast = place(state, { row: 4, col: 4 }, unitCard('huijin-ash-beast', '灰烬野兽', ['huijin_wildfire']));
    const adjacentEnemy = place(state, { row: 4, col: 5 }, unitCard('enemy-near', '相邻敌方', [], {
      faction: 'necromancer',
      life: 5,
    }), '1');
    const farEnemy = place(state, { row: 0, col: 0 }, unitCard('enemy-far', '远处敌方', [], {
      faction: 'necromancer',
      life: 5,
    }), '1');
    const adjacentAlly = place(state, { row: 5, col: 4 }, unitCard('ally-near', '相邻友方'));

    const events = summonerWarsFlowHooks.onPhaseEnter!({
      state: { core: state, sys: {} } as MatchState<SummonerWarsCore>,
      from: 'summon',
      to: 'move',
      command: { type: 'FLOW_PHASE_CHANGED', payload: {}, timestamp: 1000, playerId: '0' },
    });
    let newState = state;
    for (const event of events) {
      newState = SummonerWarsDomain.reduce(newState, event);
    }

    expect(events.some(e => e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as { abilityId?: string }).abilityId === 'huijin_wildfire')).toBe(true);
    expect(newState.board[adjacentEnemy.position.row][adjacentEnemy.position.col].unit?.damage).toBe(1);
    expect(newState.board[farEnemy.position.row][farEnemy.position.col].unit?.damage).toBe(0);
    expect(newState.board[adjacentAlly.position.row][adjacentAlly.position.col].unit?.damage).toBe(0);
    expect(newState.board[beast.position.row][beast.position.col].unit?.damage).toBe(0);
  });
  it('火焰龙兽火焰喷吐可穿过路径单位，并对路径单位造成同次攻击伤害', () => {
    const state = createState();
    state.phase = 'attack';
    const dragon = place(state, { row: 4, col: 1 }, unitCard('huijin-flame-dragon-beast', '火焰龙兽', ['huijin_guard_master', 'huijin_flame_breath'], {
      unitClass: 'champion',
      strength: 4,
      life: 10,
      attackType: 'ranged',
      attackRange: 3,
    }));
    const blocker = place(state, { row: 4, col: 2 }, unitCard('enemy-blocker', '路径敌方', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const target = place(state, { row: 4, col: 4 }, unitCard('enemy-target', '目标敌方', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');

    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: dragon.position, target: target.position },
      playerId: '0',
    }).valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: dragon.position,
      target: target.position,
    });

    expect(events.some(e => e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as { abilityId?: string }).abilityId === 'huijin_flame_breath')).toBe(true);
    expect(newState.board[target.position.row][target.position.col].unit?.damage).toBe(4);
    expect(newState.board[blocker.position.row][blocker.position.col].unit?.damage).toBe(4);
  });

  it('炫目光芒将召唤师受到的攻击伤害替换为攻击骰特殊标记数量', () => {
    const state = createState();
    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['0'].activeEvents.push(eventCard('huijin-dazzling-light', '炫目光芒', { isActive: true }));
    const summoner = place(state, { row: 4, col: 4 }, SUMMONER_HUIJIN);
    const attacker = place(state, { row: 4, col: 5 }, unitCard('enemy-melee', '敌方近战', [], {
      faction: 'necromancer',
      strength: 4,
      life: 5,
    }), '1');
    const specialOnlyRandom: RandomFn = { ...testRandom(), random: () => 0.25 };

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: summoner.position,
    }, specialOnlyRandom);

    expect(events.some(e => e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as { abilityId?: string }).abilityId === 'huijin_dazzling_light')).toBe(true);
    expect(events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED)
      ?.payload).toMatchObject({ hits: 4 });
    expect(newState.board[summoner.position.row][summoner.position.col].unit?.damage).toBe(4);
  });

  it('凤凰之魂让友方单位的非攻击技能伤害额外造成1点伤害', () => {
    const state = createState();
    state.phase = 'summon';
    state.players['0'].activeEvents.push(eventCard('huijin-phoenix-soul', '凤凰之魂', { isActive: true }));
    const beast = place(state, { row: 4, col: 4 }, unitCard('huijin-ash-beast', '灰烬野兽', ['huijin_wildfire']));
    const enemy = place(state, { row: 4, col: 5 }, unitCard('enemy-near', '相邻敌方', [], {
      faction: 'necromancer',
      life: 5,
    }), '1');

    const events = summonerWarsFlowHooks.onPhaseEnter!({
      state: { core: state, sys: {} } as MatchState<SummonerWarsCore>,
      from: 'summon',
      to: 'move',
      command: { type: 'FLOW_PHASE_CHANGED', payload: {}, timestamp: 1000, playerId: '0' },
    });
    let newState = state;
    for (const event of events) {
      newState = SummonerWarsDomain.reduce(newState, event);
    }

    expect(events.some(e => e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as { abilityId?: string }).abilityId === 'huijin_phoenix_soul')).toBe(true);
    expect(newState.board[enemy.position.row][enemy.position.col].unit?.damage).toBe(2);
    expect(newState.board[beast.position.row][beast.position.col].unit?.damage).toBe(0);
  });

  it('阶段被动伤害致死时会经系统后处理补出消灭事件', () => {
    const state = createState();
    state.phase = 'summon';
    place(state, { row: 4, col: 4 }, unitCard('huijin-ash-beast', '灰烬野兽', ['huijin_wildfire']));
    const enemy = place(state, { row: 4, col: 5 }, unitCard('enemy-fragile', '敌方脆弱单位', [], {
      faction: 'necromancer',
      life: 1,
    }), '1');

    const rawEvents = summonerWarsFlowHooks.onPhaseEnter!({
      state: { core: state, sys: {} } as MatchState<SummonerWarsCore>,
      from: 'summon',
      to: 'move',
      command: { type: 'FLOW_PHASE_CHANGED', payload: {}, timestamp: 1000, playerId: '0' },
    }) as GameEvent[];

    expect(damageEventFor(rawEvents, enemy.position, 'huijin_wildfire')).toBeDefined();
    expect(SummonerWarsDomain.postProcessSystemEvents).toBeDefined();

    const processed = SummonerWarsDomain.postProcessSystemEvents!(
      state,
      rawEvents,
      testRandom(),
      { core: state, sys: {} } as MatchState<SummonerWarsCore>,
    );
    const processedEvents = Array.isArray(processed) ? processed : processed.events;
    expect(processedEvents).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: expect.objectContaining({
        instanceId: enemy.instanceId,
        cardId: enemy.cardId,
      }),
    }));

    let newState = state;
    for (const event of processedEvents) {
      newState = SummonerWarsDomain.reduce(newState, event);
    }
    expect(newState.board[enemy.position.row][enemy.position.col].unit).toBeUndefined();
  });

  it('已减过的命令伤害不会在系统后处理中重复补死亡', () => {
    const state = createState();
    state.phase = 'move';
    const archer = place(state, { row: 4, col: 2 }, unitCard('huijin-ash-archer', '灰烬弓箭手', ['huijin_quick_shot'], {
      attackType: 'ranged',
      attackRange: 3,
    }));
    const enemy = place(state, { row: 4, col: 5 }, unitCard('enemy-wounded', '敌方受伤单位', [], {
      faction: 'necromancer',
      life: 2,
    }), '1');

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'huijin_quick_shot',
      sourceUnitId: archer.instanceId,
      targetPosition: enemy.position,
    });

    expect(newState.board[enemy.position.row][enemy.position.col].unit?.damage).toBe(1);
    expect(events.some(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBe(false);
    expect(SummonerWarsDomain.postProcessSystemEvents).toBeDefined();

    const processed = SummonerWarsDomain.postProcessSystemEvents!(
      newState,
      events,
      testRandom(),
      { core: newState, sys: {} } as MatchState<SummonerWarsCore>,
      { inputEventsAlreadyReduced: true },
    );
    const processedEvents = Array.isArray(processed) ? processed : processed.events;
    expect(processedEvents.some(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBe(false);
  });
});

describe('灰烬 - 交互型技能', () => {
  it('玛达莉雅女王可消耗充能召集场上友方士兵到相邻空格', () => {
    const state = createState();
    state.phase = 'attack';
    const summoner = place(state, { row: 4, col: 4 }, SUMMONER_HUIJIN, '0', { boosts: 1 });
    const guard = place(state, { row: 2, col: 2 }, unitCard('huijin-guard-board', '灰烬护卫', [], { cost: 1 }));
    const guardCardInHand = unitCard('huijin-guard-hand', '手牌灰烬护卫', [], { cost: 1 });
    const destination = { row: 4, col: 5 };
    state.players['0'].hand.push(guardCardInHand);

    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_call_guards',
        sourceUnitId: summoner.instanceId,
        targetPosition: guard.position,
        position: destination,
      },
      playerId: '0',
    }).valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'huijin_call_guards',
      sourceUnitId: summoner.instanceId,
      targetPosition: guard.position,
      position: destination,
    });

    expect(events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: expect.objectContaining({ delta: -1, sourceAbilityId: 'huijin_call_guards' }),
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.UNIT_MOVED,
      payload: expect.objectContaining({
        from: guard.position,
        to: destination,
        unitId: guard.instanceId,
        sourceAbilityId: 'huijin_call_guards',
      }),
    }));
    expect(newState.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(0);
    expect(newState.board[guard.position.row][guard.position.col].unit).toBeUndefined();
    expect(newState.board[destination.row][destination.col].unit?.instanceId).toBe(guard.instanceId);
    expect(newState.players['0'].hand.some(card => card.id === guardCardInHand.id)).toBe(true);
    expect(newState.players['0'].moveCount).toBe(state.players['0'].moveCount);
  });

  it('召集护卫没有充能或目标不是场上友方士兵时会被拒绝', () => {
    const noCharge = createState();
    noCharge.phase = 'attack';
    const summonerNoCharge = place(noCharge, { row: 4, col: 4 }, SUMMONER_HUIJIN, '0', { boosts: 0 });
    const guard = place(noCharge, { row: 2, col: 2 }, unitCard('huijin-guard-no-charge', '灰烬护卫'));

    expect(SummonerWarsDomain.validate({ core: noCharge } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_call_guards',
        sourceUnitId: summonerNoCharge.instanceId,
        targetPosition: guard.position,
        position: { row: 4, col: 5 },
      },
      playerId: '0',
    }).valid).toBe(false);

    const nonCommon = createState();
    nonCommon.phase = 'attack';
    const summoner = place(nonCommon, { row: 4, col: 4 }, SUMMONER_HUIJIN, '0', { boosts: 1 });
    const champion = place(nonCommon, { row: 2, col: 2 }, unitCard('huijin-champion-board', '灰烬英雄', [], { unitClass: 'champion', cost: 5 }));

    expect(SummonerWarsDomain.validate({ core: nonCommon } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_call_guards',
        sourceUnitId: summoner.instanceId,
        targetPosition: champion.position,
        position: { row: 4, col: 5 },
      },
      playerId: '0',
    }).valid).toBe(false);

    const enemyTarget = createState();
    enemyTarget.phase = 'attack';
    const summonerEnemyTarget = place(enemyTarget, { row: 4, col: 4 }, SUMMONER_HUIJIN, '0', { boosts: 1 });
    const enemyGuard = place(enemyTarget, { row: 2, col: 2 }, unitCard('enemy-common', '敌方士兵', [], { faction: 'necromancer' }), '1');

    expect(SummonerWarsDomain.validate({ core: enemyTarget } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_call_guards',
        sourceUnitId: summonerEnemyTarget.instanceId,
        targetPosition: enemyGuard.position,
        position: { row: 4, col: 5 },
      },
      playerId: '0',
    }).valid).toBe(false);

    const occupiedDestination = createState();
    occupiedDestination.phase = 'attack';
    const summonerOccupied = place(occupiedDestination, { row: 4, col: 4 }, SUMMONER_HUIJIN, '0', { boosts: 1 });
    const targetGuard = place(occupiedDestination, { row: 2, col: 2 }, unitCard('huijin-guard-board-2', '灰烬护卫'));
    place(occupiedDestination, { row: 4, col: 5 }, unitCard('huijin-blocker', '占位士兵'));

    expect(SummonerWarsDomain.validate({ core: occupiedDestination } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_call_guards',
        sourceUnitId: summonerOccupied.instanceId,
        targetPosition: targetGuard.position,
        position: { row: 4, col: 5 },
      },
      playerId: '0',
    }).valid).toBe(false);
  });

  it('皇家守卫冲撞可把相邻敌方士兵推到目标相邻空格', () => {
    const state = createState();
    state.phase = 'attack';
    const guard = place(state, { row: 4, col: 2 }, unitCard('huijin-royal-guard', '皇家守卫', ['huijin_ram']));
    const enemy = place(state, { row: 4, col: 3 }, unitCard('enemy-common', '敌方士兵', [], {
      faction: 'necromancer',
      life: 4,
    }), '1');
    const enemyStart = { ...enemy.position };
    const destination = { row: 4, col: 4 };

    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_ram',
        sourceUnitId: guard.instanceId,
        targetPosition: enemy.position,
        newPosition: destination,
      },
      playerId: '0',
    }).valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'huijin_ram',
      sourceUnitId: guard.instanceId,
      targetPosition: enemy.position,
      newPosition: destination,
    });

    expect(events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.UNIT_PUSHED,
      payload: expect.objectContaining({
        targetUnitId: enemy.instanceId,
        sourceUnitId: guard.instanceId,
        sourceAbilityId: 'huijin_ram',
      }),
    }));
    expect(newState.board[destination.row][destination.col].unit?.instanceId).toBe(enemy.instanceId);
    expect(newState.board[enemyStart.row][enemyStart.col].unit).toBeUndefined();
  });

  it('冲撞不能选择召唤师、非相邻目标或被占用落点', () => {
    const state = createState();
    state.phase = 'attack';
    const guard = place(state, { row: 4, col: 2 }, unitCard('huijin-royal-guard', '皇家守卫', ['huijin_ram']));
    const enemySummoner = place(state, { row: 4, col: 3 }, unitCard('enemy-summoner', '敌方召唤师', [], {
      faction: 'necromancer',
      unitClass: 'summoner',
    }), '1');
    place(state, { row: 4, col: 4 }, unitCard('occupied', '占位单位'), '0');

    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_ram',
        sourceUnitId: guard.instanceId,
        targetPosition: enemySummoner.position,
        newPosition: { row: 3, col: 3 },
      },
      playerId: '0',
    }).valid).toBe(false);

    const farEnemy = place(state, { row: 2, col: 2 }, unitCard('enemy-far-common', '远处敌方', [], {
      faction: 'necromancer',
    }), '1');
    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_ram',
        sourceUnitId: guard.instanceId,
        targetPosition: farEnemy.position,
        newPosition: { row: 2, col: 3 },
      },
      playerId: '0',
    }).valid).toBe(false);

    const adjacentEnemy = place(state, { row: 5, col: 2 }, unitCard('enemy-adjacent-common', '相邻敌方', [], {
      faction: 'necromancer',
    }), '1');
    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_ram',
        sourceUnitId: guard.instanceId,
        targetPosition: adjacentEnemy.position,
        newPosition: { row: 4, col: 2 },
      },
      playerId: '0',
    }).valid).toBe(false);
  });

  it('灰烬弓箭手快速射击可对 3 格直线视野内目标造成1点伤害', () => {
    const state = createState();
    state.phase = 'move';
    const archer = place(state, { row: 4, col: 2 }, unitCard('huijin-ash-archer', '灰烬弓箭手', ['huijin_quick_shot'], {
      attackType: 'ranged',
      attackRange: 3,
    }));
    const enemy = place(state, { row: 4, col: 5 }, unitCard('enemy-target', '敌方目标', [], {
      faction: 'necromancer',
      life: 4,
    }), '1');

    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_quick_shot',
        sourceUnitId: archer.instanceId,
        targetPosition: enemy.position,
      },
      playerId: '0',
    }).valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'huijin_quick_shot',
      sourceUnitId: archer.instanceId,
      targetPosition: enemy.position,
    });

    expect(damageEventFor(events, enemy.position, 'huijin_quick_shot')).toBeDefined();
    expect(swDamageSourceResolver.resolve('huijin_quick_shot')).toMatchObject({
      label: 'abilities.huijin_quick_shot.name',
      isI18n: true,
    });
    expect(newState.board[enemy.position.row][enemy.position.col].unit?.damage).toBe(1);
  });

  it('快速射击会拒绝非直线、超距或路径被阻挡的目标', () => {
    const diagonal = createState();
    diagonal.phase = 'move';
    const diagonalArcher = place(diagonal, { row: 4, col: 2 }, unitCard('huijin-archer-diagonal', '灰烬弓箭手', ['huijin_quick_shot'], {
      attackType: 'ranged',
      attackRange: 3,
    }));
    const diagonalEnemy = place(diagonal, { row: 5, col: 4 }, unitCard('enemy-diagonal', '斜线目标', [], {
      faction: 'necromancer',
    }), '1');
    expect(SummonerWarsDomain.validate({ core: diagonal } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_quick_shot',
        sourceUnitId: diagonalArcher.instanceId,
        targetPosition: diagonalEnemy.position,
      },
      playerId: '0',
    }).valid).toBe(false);

    const far = createState();
    far.phase = 'move';
    const farArcher = place(far, { row: 4, col: 1 }, unitCard('huijin-archer-far', '灰烬弓箭手', ['huijin_quick_shot'], {
      attackType: 'ranged',
      attackRange: 3,
    }));
    const farEnemy = place(far, { row: 4, col: 5 }, unitCard('enemy-far', '超距目标', [], {
      faction: 'necromancer',
    }), '1');
    expect(SummonerWarsDomain.validate({ core: far } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_quick_shot',
        sourceUnitId: farArcher.instanceId,
        targetPosition: farEnemy.position,
      },
      playerId: '0',
    }).valid).toBe(false);

    const blocked = createState();
    blocked.phase = 'move';
    const blockedArcher = place(blocked, { row: 4, col: 1 }, unitCard('huijin-archer-blocked', '灰烬弓箭手', ['huijin_quick_shot'], {
      attackType: 'ranged',
      attackRange: 3,
    }));
    const blockedEnemy = place(blocked, { row: 4, col: 4 }, unitCard('enemy-blocked', '被遮挡目标', [], {
      faction: 'necromancer',
    }), '1');
    place(blocked, { row: 4, col: 2 }, unitCard('line-blocker', '路径阻挡者'), '0');
    expect(SummonerWarsDomain.validate({ core: blocked } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'huijin_quick_shot',
        sourceUnitId: blockedArcher.instanceId,
        targetPosition: blockedEnemy.position,
      },
      playerId: '0',
    }).valid).toBe(false);
  });
});

describe('灰烬 - 事件牌机制', () => {
  it('炫目光芒只能在魔力阶段打出', () => {
    const state = createState();
    const dazzlingLight = EVENT_CARDS_HUIJIN.find(card => card.id === 'huijin-dazzling-light')!;
    state.players['0'].hand.push(dazzlingLight);

    state.phase = 'summon';
    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.PLAY_EVENT,
      payload: { cardId: 'huijin-dazzling-light' },
      playerId: '0',
    })).toMatchObject({
      valid: false,
      error: '该事件只能在魔力阶段施放',
    });

    state.phase = 'magic';
    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.PLAY_EVENT,
      payload: { cardId: 'huijin-dazzling-light' },
      playerId: '0',
    })).toEqual({ valid: true });
  });

  it('灼烧对召唤师2格内的士兵或英雄造成2点伤害', () => {
    const state = createState();
    state.phase = 'move';
    place(state, { row: 4, col: 4 }, SUMMONER_HUIJIN);
    const enemy = place(state, { row: 2, col: 4 }, unitCard('enemy-common', '敌方士兵', [], {
      faction: 'necromancer',
      life: 5,
    }), '1');
    state.players['0'].hand.push(eventCard('huijin-scorch', '灼烧'));

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'huijin-scorch',
      targets: [enemy.position],
    });

    expect(damageEventFor(events, enemy.position, 'huijin_scorch')).toBeDefined();
    expect(swDamageSourceResolver.resolve('huijin_scorch')).toMatchObject({
      label: 'actionLog.damageReason.huijin_scorch',
      isI18n: true,
    });
    expect(newState.board[enemy.position.row][enemy.position.col].unit?.damage).toBe(2);
    expect(newState.players['0'].discard.find(card => card.id === 'huijin-scorch')).toBeDefined();
  });

  it('神族复仇持续后，玛达莉雅女王被攻击且仍在场时对攻击者造成1点伤害', () => {
    const state = createState();
    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['0'].activeEvents.push(eventCard('huijin-divine-revenge', '神族复仇', { isActive: true }));
    const summoner = place(state, { row: 4, col: 4 }, SUMMONER_HUIJIN);
    const attacker = place(state, { row: 4, col: 5 }, unitCard('enemy-attacker', '敌方攻击者', [], {
      faction: 'necromancer',
      strength: 1,
      life: 5,
    }), '1');

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: summoner.position,
    });

    expect(events.some(e => e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as { abilityId?: string }).abilityId === 'huijin_divine_revenge')).toBe(true);
    expect(swDamageSourceResolver.resolve('huijin_divine_revenge')).toMatchObject({
      label: 'actionLog.damageReason.huijin_divine_revenge',
      isI18n: true,
    });
    expect(newState.board[attacker.position.row][attacker.position.col].unit?.damage).toBe(1);
  });
});
