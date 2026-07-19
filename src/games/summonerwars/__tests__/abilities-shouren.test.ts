/**
 * 召唤师战争 - 冰苔兽人机制测试
 */

import { describe, expect, it } from 'vitest';
import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createInteractionSystem, INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { createSimpleChoiceSystem } from '../../../engine/systems/SimpleChoiceSystem';
import {
  CHAMPION_UNITS_SHOUREN,
  COMMON_UNITS_SHOUREN,
  EVENT_CARDS_SHOUREN,
  SUMMONER_SHOUREN,
} from '../config/factions/shouren';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import { getEffectiveStrengthValue, getUnitAbilities } from '../domain/abilityResolver';
import {
  calculatePushPullPosition,
  canAttackEnhanced,
  canMoveToEnhanced,
  getForceDestinations,
} from '../domain/helpers';
import { createSummonerWarsInteractionSystem } from '../domain/systems';
import type { BoardUnit, CellCoord, PlayerId, SummonerWarsCore, UnitCard } from '../domain/types';
import { createInitializedCore, generateInstanceId, placeTestUnit } from './test-helpers';

function testRandom(values: number[] = [0]): RandomFn {
  let index = 0;
  return {
    shuffle: <T>(items: T[]) => items,
    random: () => values[Math.min(index++, values.length - 1)] ?? 0,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

function createState(): SummonerWarsCore {
  const state = createInitializedCore(['0', '1'], testRandom(), {
    faction0: 'shouren',
    faction1: 'necromancer',
  });
  for (const row of state.board) {
    for (const cell of row) {
      cell.unit = undefined;
      cell.structure = undefined;
    }
  }
  state.currentPlayer = '0';
  state.players['0'].moveCount = 0;
  state.players['0'].attackCount = 0;
  return state;
}

function place(
  state: SummonerWarsCore,
  position: CellCoord,
  card: UnitCard,
  owner: PlayerId = '0',
  overrides: Partial<BoardUnit> = {},
): BoardUnit {
  return placeTestUnit(state, position, {
    card,
    owner,
    cardId: overrides.cardId ?? card.id,
    instanceId: overrides.instanceId ?? generateInstanceId(card.id),
    ...overrides,
  });
}

function executeAndReduce(
  state: SummonerWarsCore,
  commandType: string,
  payload: Record<string, unknown>,
  random: RandomFn = testRandom(),
): { events: GameEvent[]; newState: SummonerWarsCore } {
  const command = { type: commandType, payload, timestamp: 1000, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute({ core: state } as MatchState<SummonerWarsCore>, command, random);
  const newState = events.reduce(
    (current, event) => SummonerWarsDomain.reduce(current, event),
    state,
  );
  return { events, newState };
}

describe('冰苔兽人 - 恢复', () => {
  it('格鲁纳克移动后仅在未充能时获得 1 点充能', () => {
    const uncharged = createState();
    uncharged.phase = 'move';
    place(uncharged, { row: 4, col: 3 }, SUMMONER_SHOUREN, '0', { boosts: 0 });

    const first = executeAndReduce(uncharged, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 4, col: 4 },
    });
    expect(first.newState.board[4][4].unit?.boosts).toBe(1);

    const charged = createState();
    charged.phase = 'move';
    place(charged, { row: 4, col: 3 }, SUMMONER_SHOUREN, '0', { boosts: 2 });

    const second = executeAndReduce(charged, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 4, col: 4 },
    });
    expect(second.newState.board[4][4].unit?.boosts).toBe(2);
  });
});

describe('冰苔兽人 - 鲜血羁绊', () => {
  it('拉格诺攻击后按所掷特殊标记数量给召唤师充能', () => {
    const state = createState();
    state.phase = 'attack';
    place(state, { row: 1, col: 1 }, SUMMONER_SHOUREN, '0', { boosts: 0 });
    const ragnor = place(state, { row: 4, col: 3 }, CHAMPION_UNITS_SHOUREN[0]);
    place(state, { row: 4, col: 4 }, {
      ...CHAMPION_UNITS_SHOUREN[0],
      id: 'enemy',
      name: '敌方单位',
      faction: 'necromancer',
      abilities: [],
      life: 20,
    }, '1');

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: ragnor.position,
      target: { row: 4, col: 4 },
    }, testRandom([0.2]));

    const attack = events.find(event => event.type === SW_EVENTS.UNIT_ATTACKED);
    expect((attack?.payload as { hits?: number }).hits).toBe(0);
    expect(newState.board[1][1].unit?.boosts).toBe(3);
  });
});

describe('冰苔兽人 - 远射', () => {
  it('塔甘可攻击4格清晰直线内的敌方卡牌，但不能攻击5格外目标', () => {
    const inRange = createState();
    const targan = place(inRange, { row: 1, col: 2 }, CHAMPION_UNITS_SHOUREN[1], '0');
    const fourSpaces = place(inRange, { row: 5, col: 2 }, {
      ...COMMON_UNITS_SHOUREN[2], id: 'targan-four-space-target', name: '四格目标',
      faction: 'necromancer', abilities: [],
    }, '1');
    expect(canAttackEnhanced(inRange, targan.position, fourSpaces.position)).toBe(true);

    const outOfRange = createState();
    const secondTargan = place(outOfRange, { row: 1, col: 2 }, CHAMPION_UNITS_SHOUREN[1], '0');
    const fiveSpaces = place(outOfRange, { row: 6, col: 2 }, {
      ...COMMON_UNITS_SHOUREN[2], id: 'targan-five-space-target', name: '五格目标',
      faction: 'necromancer', abilities: [],
    }, '1');
    expect(canAttackEnhanced(outOfRange, secondTargan.position, fiveSpaces.position)).toBe(false);
  });
});

describe('冰苔兽人 - 刺骨冰霜', () => {
  it('塔甘只强化相邻友方冰霜单位', () => {
    const state = createState();
    place(state, { row: 3, col: 3 }, CHAMPION_UNITS_SHOUREN[1]);
    const adjacentFrost = place(state, { row: 3, col: 4 }, COMMON_UNITS_SHOUREN[0]);
    const distantFrost = place(state, { row: 5, col: 5 }, COMMON_UNITS_SHOUREN[0]);
    const adjacentNonFrost = place(state, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2]);
    const adjacentEnemyFrost = place(state, { row: 2, col: 3 }, COMMON_UNITS_SHOUREN[0], '1');

    expect(getEffectiveStrengthValue(adjacentFrost, state)).toBe(adjacentFrost.card.strength + 1);
    expect(getEffectiveStrengthValue(distantFrost, state)).toBe(distantFrost.card.strength);
    expect(getEffectiveStrengthValue(adjacentNonFrost, state)).toBe(adjacentNonFrost.card.strength);
    expect(getEffectiveStrengthValue(adjacentEnemyFrost, state)).toBe(adjacentEnemyFrost.card.strength);
  });
});

describe('冰苔兽人 - 狂乱打击', () => {
  it('雄科攻击时以特殊标记数量替代近战标记数量', () => {
    const state = createState();
    state.phase = 'attack';
    const xiongke = place(state, { row: 4, col: 3 }, CHAMPION_UNITS_SHOUREN[2]);
    place(state, { row: 4, col: 4 }, {
      ...CHAMPION_UNITS_SHOUREN[2],
      id: 'enemy',
      name: '敌方单位',
      faction: 'necromancer',
      abilities: [],
      life: 30,
    }, '1');

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: xiongke.position,
      target: { row: 4, col: 4 },
    }, testRandom([0.2]));

    const attack = events.find(event => event.type === SW_EVENTS.UNIT_ATTACKED);
    expect((attack?.payload as { hits?: number }).hits).toBe(8);
  });
});

describe('冰苔兽人 - 北方魔法', () => {
  it('冰霜萨满未掷出特殊标记时不造成伤害，掷出后按远程标记结算', () => {
    const noSpecialState = createState();
    noSpecialState.phase = 'attack';
    const noSpecialShaman = place(noSpecialState, { row: 4, col: 1 }, COMMON_UNITS_SHOUREN[0]);
    place(noSpecialState, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[0],
      id: 'enemy-no-special',
      name: '敌方单位',
      faction: 'necromancer',
      abilities: [],
      life: 20,
    }, '1');

    const noSpecial = executeAndReduce(noSpecialState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: noSpecialShaman.position,
      target: { row: 4, col: 3 },
    }, testRandom([0]));
    expect((noSpecial.events.find(event => event.type === SW_EVENTS.UNIT_ATTACKED)?.payload as { hits?: number }).hits).toBe(0);
    expect(noSpecial.newState.board[4][3].unit?.damage).toBe(0);

    const specialState = createState();
    specialState.phase = 'attack';
    const specialShaman = place(specialState, { row: 4, col: 1 }, COMMON_UNITS_SHOUREN[0]);
    place(specialState, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[0],
      id: 'enemy-special',
      name: '敌方单位',
      faction: 'necromancer',
      abilities: [],
      life: 20,
    }, '1');

    const special = executeAndReduce(specialState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: specialShaman.position,
      target: { row: 4, col: 3 },
    }, testRandom([0.2]));
    expect((special.events.find(event => event.type === SW_EVENTS.UNIT_ATTACKED)?.payload as { hits?: number }).hits).toBe(3);
    expect(special.newState.board[4][3].unit?.damage).toBe(3);
  });
});

describe('冰苔兽人 - 迟钝', () => {
  it('粉碎者被攻击时每个特殊标记额外受到 1 点伤害', () => {
    const state = createState();
    state.phase = 'attack';
    const attacker = place(state, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[2],
      id: 'enemy-attacker',
      name: '敌方攻击者',
      faction: 'necromancer',
      abilities: [],
      strength: 2,
    }, '1');
    place(state, { row: 4, col: 4 }, COMMON_UNITS_SHOUREN[1], '0');
    state.currentPlayer = '1';

    const withSpecial = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: { row: 4, col: 4 },
    }, testRandom([0.7]));
    expect((withSpecial.events.find(event => event.type === SW_EVENTS.UNIT_ATTACKED)?.payload as { hits?: number }).hits).toBe(4);
    expect(withSpecial.newState.board[4][4].unit?.damage).toBe(4);

    const noSpecialState = createState();
    noSpecialState.phase = 'attack';
    noSpecialState.currentPlayer = '1';
    const noSpecialAttacker = place(noSpecialState, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[2],
      id: 'enemy-attacker-plain',
      name: '敌方攻击者',
      faction: 'necromancer',
      abilities: [],
      strength: 2,
    }, '1');
    place(noSpecialState, { row: 4, col: 4 }, COMMON_UNITS_SHOUREN[1], '0');

    const withoutSpecial = executeAndReduce(noSpecialState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: noSpecialAttacker.position,
      target: { row: 4, col: 4 },
    }, testRandom([0]));
    expect((withoutSpecial.events.find(event => event.type === SW_EVENTS.UNIT_ATTACKED)?.payload as { hits?: number }).hits).toBe(2);
    expect(withoutSpecial.newState.board[4][4].unit?.damage).toBe(2);
  });
});

describe('冰苔兽人 - 冻结', () => {
  it('冻结按单位实例清空技能，事件离场后自动恢复', () => {
    const state = createState();
    const frozen = place(state, { row: 4, col: 3 }, CHAMPION_UNITS_SHOUREN[1], '1');
    const sameCard = place(state, { row: 5, col: 3 }, CHAMPION_UNITS_SHOUREN[1], '1');
    state.players['0'].activeEvents.push({
      id: 'shouren-freeze-0-1',
      cardType: 'event',
      faction: 'shouren',
      name: '冻结',
      eventType: 'common',
      playPhase: 'summon',
      cost: 0,
      isActive: true,
      effect: '',
      deckSymbols: [],
      targetUnitId: frozen.instanceId,
    });

    expect(getUnitAbilities(frozen, state)).toEqual([]);
    expect(getUnitAbilities(sameCard, state).map(ability => ability.id)).toContain('ranged');

    state.players['0'].activeEvents = [];
    expect(getUnitAbilities(frozen, state).map(ability => ability.id)).toContain('ranged');
  });

  it('冻结单位不会进入移动候选且移动命令被拒绝', () => {
    const state = createState();
    state.phase = 'move';
    const frozen = place(state, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    state.players['0'].activeEvents.push({
      id: 'shouren-freeze-0-1',
      cardType: 'event',
      faction: 'shouren',
      name: '冻结',
      eventType: 'common',
      playPhase: 'summon',
      cost: 0,
      isActive: true,
      effect: '',
      deckSymbols: [],
      targetUnitId: frozen.instanceId,
    });

    const destination = { row: 4, col: 4 };
    expect(canMoveToEnhanced(state, frozen.position, destination)).toBe(false);
    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.MOVE_UNIT,
      payload: { from: frozen.position, to: destination },
      playerId: '0',
    }).valid).toBe(false);
  });

  it('冻结单位不会进入攻击者候选且攻击命令被拒绝', () => {
    const state = createState();
    state.phase = 'attack';
    const frozen = place(state, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    place(state, { row: 4, col: 4 }, COMMON_UNITS_SHOUREN[2], '1');
    state.players['0'].activeEvents.push({
      id: 'shouren-freeze-0-1', cardType: 'event', faction: 'shouren', name: '冻结',
      eventType: 'common', playPhase: 'summon', cost: 0, isActive: true,
      effect: '', deckSymbols: [], targetUnitId: frozen.instanceId,
    });

    const target = { row: 4, col: 4 };
    expect(canAttackEnhanced(state, frozen.position, target)).toBe(false);
    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: frozen.position, target },
      playerId: '0',
    }).valid).toBe(false);
  });

  it('冻结单位不会进入攻击目标候选且不能成为攻击目标', () => {
    const state = createState();
    state.phase = 'attack';
    const attacker = place(state, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    const frozen = place(state, { row: 4, col: 4 }, COMMON_UNITS_SHOUREN[2], '1');
    state.players['0'].activeEvents.push({
      id: 'shouren-freeze-0-1', cardType: 'event', faction: 'shouren', name: '冻结',
      eventType: 'common', playPhase: 'summon', cost: 0, isActive: true,
      effect: '', deckSymbols: [], targetUnitId: frozen.instanceId,
    });

    expect(canAttackEnhanced(state, attacker.position, frozen.position)).toBe(false);
    expect(SummonerWarsDomain.validate({ core: state } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: attacker.position, target: frozen.position },
      playerId: '0',
    }).valid).toBe(false);
  });

  it('冻结单位没有推拉候选且权威状态拒绝推拉事件', () => {
    const state = createState();
    const frozen = place(state, { row: 4, col: 4 }, COMMON_UNITS_SHOUREN[2], '1');
    state.players['0'].activeEvents.push({
      id: 'shouren-freeze-0-1', cardType: 'event', faction: 'shouren', name: '冻结',
      eventType: 'common', playPhase: 'summon', cost: 0, isActive: true,
      effect: '', deckSymbols: [], targetUnitId: frozen.instanceId,
    });

    expect(calculatePushPullPosition(state, frozen.position, { row: 4, col: 3 }, 1, 'push')).toBeNull();
    expect(getForceDestinations(state, frozen.position, 1)).toEqual([]);

    const reduced = SummonerWarsDomain.reduce(state, {
      type: SW_EVENTS.UNIT_PUSHED,
      payload: { targetPosition: frozen.position, newPosition: { row: 4, col: 5 } },
      timestamp: 1000,
    });
    expect(reduced.board[4][4].unit?.instanceId).toBe(frozen.instanceId);
    expect(reduced.board[4][5].unit).toBeUndefined();
  });

  it('冻结通过事件交互选择召唤师三格内任意阵营的未充能士兵或英雄', () => {
    const core = createState();
    core.phase = 'summon';
    place(core, { row: 4, col: 2 }, SUMMONER_SHOUREN, '0');
    const enemy = place(core, { row: 4, col: 4 }, COMMON_UNITS_SHOUREN[2], '1', { boosts: 0 });
    const charged = place(core, { row: 3, col: 2 }, COMMON_UNITS_SHOUREN[2], '0', { boosts: 1 });
    const far = place(core, { row: 0, col: 0 }, COMMON_UNITS_SHOUREN[2], '1', { boosts: 0 });
    core.players['0'].hand.push({ ...EVENT_CARDS_SHOUREN[0], id: 'shouren-freeze-0-1' });

    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const requested = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: SW_COMMANDS.REQUEST_EVENT_INTERACTION, playerId: '0', payload: { cardId: 'shouren-freeze-0-1' } },
      testRandom(),
      ['0', '1'],
    );
    expect(requested.success).toBe(true);
    state = requested.state;
    const current = state.sys.interaction.current;
    const optionIds = ((current?.data as { options?: Array<{ id: string }> })?.options ?? []).map(option => option.id);
    expect(optionIds).toContain('pos:4,4');
    expect(optionIds).not.toContain(`pos:${charged.position.row},${charged.position.col}`);
    expect(optionIds).not.toContain(`pos:${far.position.row},${far.position.col}`);

    const resolved = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'pos:4,4' } },
      testRandom(),
      ['0', '1'],
    );
    expect(resolved.success).toBe(true);
    expect(resolved.state.core.players['0'].activeEvents).toContainEqual(expect.objectContaining({
      id: 'shouren-freeze-0-1',
      targetUnitId: enemy.instanceId,
    }));
  });
});

describe('冰苔兽人 - 无上荣耀', () => {
  it('持续期间只让友方士兵动态获得鲁莽打击和战力加成，离场后恢复', () => {
    const state = createState();
    const common = place(state, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    const champion = place(state, { row: 4, col: 4 }, CHAMPION_UNITS_SHOUREN[0], '0');
    const enemyCommon = place(state, { row: 5, col: 3 }, COMMON_UNITS_SHOUREN[2], '1');
    state.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[3], id: 'shouren-supreme-glory-0-1' });

    expect(getUnitAbilities(common, state).map(ability => ability.id)).toContain('shouren_reckless_strike');
    expect(getEffectiveStrengthValue(common, state)).toBe(common.card.strength + 2);
    expect(getUnitAbilities(champion, state).map(ability => ability.id)).not.toContain('shouren_reckless_strike');
    expect(getEffectiveStrengthValue(champion, state)).toBe(champion.card.strength);
    expect(getUnitAbilities(enemyCommon, state).map(ability => ability.id)).not.toContain('shouren_reckless_strike');

    state.players['0'].activeEvents = [];
    expect(getUnitAbilities(common, state).map(ability => ability.id)).not.toContain('shouren_reckless_strike');
    expect(getEffectiveStrengthValue(common, state)).toBe(common.card.strength);
  });

  it('鲁莽打击在0或1个特殊标记且造成伤害时对自身造成等量伤害', () => {
    const state = createState();
    state.phase = 'attack';
    state.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[3], id: 'shouren-supreme-glory-0-1' });
    const attacker = place(state, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[2],
      id: 'reckless-attacker',
      name: '鲁莽攻击者',
      life: 10,
    }, '0');
    place(state, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[2],
      id: 'reckless-target',
      name: '鲁莽目标',
      faction: 'necromancer',
      abilities: [],
      life: 20,
    }, '1');

    const result = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: { row: 4, col: 4 },
    }, testRandom([0.7, 0, 0, 0]));

    expect(result.newState.board[4][4].unit?.damage).toBe(4);
    expect(result.newState.board[4][3].unit?.damage).toBe(4);
  });

  it('鲁莽打击在特殊标记超过1个时不对自身造成伤害', () => {
    const state = createState();
    state.phase = 'attack';
    state.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[3], id: 'shouren-supreme-glory-0-1' });
    const attacker = place(state, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[2], id: 'reckless-safe-attacker', name: '鲁莽攻击者', life: 10,
    }, '0');
    place(state, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[2], id: 'reckless-safe-target', name: '鲁莽目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');

    const result = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: { row: 4, col: 4 },
    }, testRandom([0.7, 0.7, 0, 0]));

    expect(result.newState.board[4][4].unit?.damage).toBe(4);
    expect(result.newState.board[4][3].unit?.damage).toBe(0);
  });
});

describe('冰苔兽人 - 粗暴蛮力', () => {
  it('持续期间只让友方单位动态获得蛮力冲击，离场后恢复', () => {
    const state = createState();
    const common = place(state, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    const champion = place(state, { row: 4, col: 4 }, CHAMPION_UNITS_SHOUREN[0], '0');
    const enemy = place(state, { row: 5, col: 3 }, COMMON_UNITS_SHOUREN[2], '1');
    state.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[1], id: 'shouren-brute-force-0-1' });

    expect(getUnitAbilities(common, state).map(ability => ability.id)).toContain('shouren_brute_impact');
    expect(getUnitAbilities(champion, state).map(ability => ability.id)).toContain('shouren_brute_impact');
    expect(getUnitAbilities(enemy, state).map(ability => ability.id)).not.toContain('shouren_brute_impact');

    state.players['0'].activeEvents = [];
    expect(getUnitAbilities(common, state).map(ability => ability.id)).not.toContain('shouren_brute_impact');
  });

  it('蛮力冲击造成伤害后提供远离攻击者1格与跳过选项，跳过不移动目标', () => {
    const core = createState();
    core.phase = 'attack';
    core.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[1], id: 'shouren-brute-force-0-1' });
    const attacker = place(core, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    const target = place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[2], id: 'brute-impact-target', name: '蛮力冲击目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: attacker.position, target: target.position } },
      testRandom([0]),
      ['0', '1'],
    );
    expect(attacked.success).toBe(true);
    const current = attacked.state.sys.interaction.current;
    const optionIds = ((current?.data as { options?: Array<{ id: string }> })?.options ?? []).map(option => option.id);
    expect(optionIds).toContain('pos:4,5');
    expect(optionIds).toContain('skip');

    const skipped = executePipeline(
      { domain: SummonerWarsDomain, systems },
      attacked.state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'skip' } },
      testRandom(),
      ['0', '1'],
    );
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][4].unit?.instanceId).toBe(target.instanceId);
    expect(skipped.state.core.board[4][5].unit).toBeUndefined();
  });

  it('蛮力冲击选择远离格后移动受伤目标并完成交互', () => {
    const core = createState();
    core.phase = 'attack';
    core.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[1], id: 'shouren-brute-force-0-1' });
    const attacker = place(core, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    const target = place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[2], id: 'brute-impact-moved-target', name: '蛮力冲击目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: attacker.position, target: target.position } },
      testRandom([0]),
      ['0', '1'],
    );
    const current = attacked.state.sys.interaction.current;
    const moved = executePipeline(
      { domain: SummonerWarsDomain, systems },
      attacked.state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'pos:4,5' } },
      testRandom(),
      ['0', '1'],
    );

    expect(moved.success).toBe(true);
    expect(moved.state.sys.interaction.current).toBeUndefined();
    expect(moved.state.core.board[4][4].unit).toBeUndefined();
    expect(moved.state.core.board[4][5].unit?.instanceId).toBe(target.instanceId);
  });

  it('蛮力冲击未造成伤害时不创建交互', () => {
    const core = createState();
    core.phase = 'attack';
    core.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[1], id: 'shouren-brute-force-0-1' });
    const attacker = place(core, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[2], id: 'brute-impact-miss-target', name: '蛮力冲击目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: attacker.position, target: { row: 4, col: 4 } } },
      testRandom([0.2, 0.2]),
      ['0', '1'],
    );

    expect(attacked.success).toBe(true);
    expect(attacked.state.core.board[4][4].unit?.damage).toBe(0);
    expect(attacked.state.sys.interaction.current).toBeUndefined();
  });
});

describe('冰苔兽人 - 血腥急袭', () => {
  it('冰苔冲锋者召唤后有合法位移时提供位移与跳过，跳过不自伤也不移动', () => {
    const core = createState();
    core.phase = 'summon';
    core.board[4][2].structure = {
      cardId: 'shouren-test-gate',
      card: {
        id: 'shouren-test-gate', cardType: 'structure', name: '测试城门', faction: 'shouren',
        cost: 0, life: 10, isGate: true, deckSymbols: [],
      },
      owner: '0', position: { row: 4, col: 2 }, damage: 0,
    };
    core.players['0'].hand.push({ ...COMMON_UNITS_SHOUREN[2], id: 'shouren-charger-hand' });
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];

    const summoned = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.SUMMON_UNIT, playerId: '0', payload: { cardId: 'shouren-charger-hand', position: { row: 4, col: 3 } } },
      testRandom(),
      ['0', '1'],
    );
    expect(summoned.success).toBe(true);
    const current = summoned.state.sys.interaction.current;
    const optionIds = ((current?.data as { options?: Array<{ id: string }> })?.options ?? []).map(option => option.id);
    expect(optionIds).toContain('pos:4,4');
    expect(optionIds).toContain('skip');

    const skipped = executePipeline(
      { domain: SummonerWarsDomain, systems },
      summoned.state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'skip' } },
      testRandom(),
      ['0', '1'],
    );
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][3].unit?.damage).toBe(0);
    expect(skipped.state.core.board[4][3].unit?.cardId).toBe('shouren-charger-hand');
    expect(skipped.state.core.board[4][4].unit).toBeUndefined();
  });

  it('血腥急袭选择位移后自伤1并移动同一单位实例', () => {
    const core = createState();
    core.phase = 'summon';
    core.board[4][2].structure = {
      cardId: 'shouren-test-gate',
      card: { id: 'shouren-test-gate', cardType: 'structure', name: '测试城门', faction: 'shouren', cost: 0, life: 10, isGate: true, deckSymbols: [] },
      owner: '0', position: { row: 4, col: 2 }, damage: 0,
    };
    core.players['0'].hand.push({ ...COMMON_UNITS_SHOUREN[2], id: 'shouren-charger-move-hand' });
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const summoned = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.SUMMON_UNIT, playerId: '0', payload: { cardId: 'shouren-charger-move-hand', position: { row: 4, col: 3 } } },
      testRandom(),
      ['0', '1'],
    );
    const sourceId = summoned.state.core.board[4][3].unit?.instanceId;
    const current = summoned.state.sys.interaction.current;
    const moved = executePipeline(
      { domain: SummonerWarsDomain, systems },
      summoned.state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'pos:4,4' } },
      testRandom(),
      ['0', '1'],
    );

    expect(moved.success).toBe(true);
    expect(moved.state.sys.interaction.current).toBeUndefined();
    expect(moved.state.core.board[4][3].unit).toBeUndefined();
    expect(moved.state.core.board[4][4].unit?.instanceId).toBe(sourceId);
    expect(moved.state.core.board[4][4].unit?.damage).toBe(1);
  });

  it('血腥急袭没有合法位移时不创建空交互', () => {
    const core = createState();
    core.phase = 'summon';
    const blockerCard = { ...COMMON_UNITS_SHOUREN[2], id: 'rush-blocker', name: '阻挡单位', abilities: [] };
    place(core, { row: 3, col: 3 }, blockerCard, '0');
    place(core, { row: 5, col: 3 }, blockerCard, '0');
    place(core, { row: 4, col: 4 }, blockerCard, '0');
    core.board[4][2].structure = {
      cardId: 'shouren-test-gate',
      card: { id: 'shouren-test-gate', cardType: 'structure', name: '测试城门', faction: 'shouren', cost: 0, life: 10, isGate: true, deckSymbols: [] },
      owner: '0', position: { row: 4, col: 2 }, damage: 0,
    };
    core.players['0'].hand.push({ ...COMMON_UNITS_SHOUREN[2], id: 'shouren-charger-blocked-hand' });
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const summoned = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.SUMMON_UNIT, playerId: '0', payload: { cardId: 'shouren-charger-blocked-hand', position: { row: 4, col: 3 } } },
      testRandom(),
      ['0', '1'],
    );

    expect(summoned.success).toBe(true);
    expect(summoned.state.core.board[4][3].unit?.damage).toBe(0);
    expect(summoned.state.sys.interaction.current).toBeUndefined();
  });
});

describe('冰苔兽人 - 狂暴', () => {
  it('技能骰出现特殊标记后可位移并获得一次额外攻击，额外攻击不递归触发狂暴', () => {
    const core = createState();
    core.phase = 'attack';
    const fighter = place(core, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[3], '0');
    place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'berserk-first-target', name: '狂暴目标一',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    place(core, { row: 3, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'berserk-extra-target', name: '狂暴目标二',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: fighter.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0, 0.7]),
      ['0', '1'],
    );
    expect(attacked.success).toBe(true);
    state = attacked.state;
    const current = state.sys.interaction.current;
    const optionIds = ((current?.data as { options?: Array<{ id: string }> })?.options ?? []).map(option => option.id);
    expect(optionIds).toContain('pos:3,3');
    expect(optionIds).toContain('skip');

    const moved = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'pos:3,3' } },
      testRandom(),
      ['0', '1'],
    );
    expect(moved.success).toBe(true);
    expect(moved.state.core.board[3][3].unit?.instanceId).toBe(fighter.instanceId);
    expect(moved.state.core.board[3][3].unit?.extraAttacks).toBe(1);
    expect(moved.state.core.board[3][3].unit?.hasAttacked).toBe(false);

    const extraAttack = executePipeline(
      { domain: SummonerWarsDomain, systems },
      moved.state,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: { row: 3, col: 3 }, target: { row: 3, col: 4 } } },
      testRandom([0, 0, 0.7]),
      ['0', '1'],
    );
    expect(extraAttack.success).toBe(true);
    expect(extraAttack.state.core.board[3][3].unit?.extraAttacks).toBe(0);
    expect(extraAttack.state.sys.interaction.current).toBeUndefined();
  });

  it('激励可重掷狂暴技能骰并按重掷结果决定是否出现位移', () => {
    const core = createState();
    core.phase = 'attack';
    place(core, { row: 2, col: 3 }, SUMMONER_SHOUREN, '0', { boosts: 1 });
    const fighter = place(core, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[3], '0');
    place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'berserk-encourage-target', name: '狂暴目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const attackPending = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: fighter.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0]),
      ['0', '1'],
    );
    state = attackPending.state;
    const firstEncourage = state.sys.interaction.current;
    const attackKept = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: firstEncourage!.id, optionId: 'keep' } },
      testRandom([0.7]),
      ['0', '1'],
    );

    expect(attackKept.state.core.pendingAttackRoll?.kind).toBe('ability');
    expect(attackKept.state.core.pendingAttackRoll?.abilityId).toBe('shouren_berserk');
    const abilityEncourage = attackKept.state.sys.interaction.current;
    expect((abilityEncourage?.data as { sw?: { type?: string } })?.sw?.type).toBe('shouren_encourage');

    const abilityRerolled = executePipeline(
      { domain: SummonerWarsDomain, systems },
      attackKept.state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: abilityEncourage!.id, optionId: 'reroll' } },
      testRandom([0]),
      ['0', '1'],
    );
    expect(abilityRerolled.success).toBe(true);
    expect(abilityRerolled.state.core.pendingAttackRoll).toBeUndefined();
    expect(abilityRerolled.state.core.board[2][3].unit?.boosts).toBe(0);
    expect(abilityRerolled.state.sys.interaction.current).toBeUndefined();
  });

  it('技能骰没有特殊标记时不出现位移交互', () => {
    const core = createState();
    core.phase = 'attack';
    const fighter = place(core, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[3], '0');
    place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'berserk-no-special-target', name: '狂暴目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];

    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: fighter.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0, 0]),
      ['0', '1'],
    );

    expect(attacked.success).toBe(true);
    expect(attacked.state.sys.interaction.current).toBeUndefined();
  });

  it('技能骰成功时可以跳过，跳过后不移动也不获得额外攻击', () => {
    const core = createState();
    core.phase = 'attack';
    const fighter = place(core, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[3], '0');
    place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'berserk-skip-target', name: '狂暴目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: fighter.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0, 0.7]),
      ['0', '1'],
    );
    const current = attacked.state.sys.interaction.current;
    const skipped = executePipeline(
      { domain: SummonerWarsDomain, systems },
      attacked.state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'skip' } },
      testRandom(),
      ['0', '1'],
    );

    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][3].unit?.instanceId).toBe(fighter.instanceId);
    expect(skipped.state.core.board[4][3].unit?.extraAttacks ?? 0).toBe(0);
  });

  it('攻击相邻敌方建筑后也会掷狂暴技能骰', () => {
    const core = createState();
    core.phase = 'attack';
    const fighter = place(core, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[3], '0');
    core.board[4][4].structure = {
      cardId: 'berserk-enemy-gate',
      card: {
        id: 'berserk-enemy-gate', cardType: 'structure', name: '敌方建筑', faction: 'necromancer',
        cost: 0, life: 20, isGate: true, deckSymbols: [],
      },
      owner: '1', position: { row: 4, col: 4 }, damage: 0,
    };
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: fighter.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0, 0.7]),
      ['0', '1'],
    );

    expect(attacked.success).toBe(true);
    expect(attacked.state.sys.interaction.current?.id).toContain('sw-shouren-berserk');
  });
});

describe('冰苔兽人 - 原始狂怒', () => {
  it('召唤师攻击相邻敌方卡牌后提供1至2格位移与跳过，跳过不授予额外攻击', () => {
    const core = createState();
    core.phase = 'attack';
    core.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[2], id: 'shouren-primal-fury-0-1' });
    const summoner = place(core, { row: 4, col: 3 }, SUMMONER_SHOUREN, '0');
    place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'primal-fury-target', name: '原始狂怒目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: summoner.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0, 0]),
      ['0', '1'],
    );
    const current = attacked.state.sys.interaction.current;
    const optionIds = ((current?.data as { options?: Array<{ id: string }> })?.options ?? []).map(option => option.id);
    expect(optionIds).toContain('pos:4,2');
    expect(optionIds).toContain('pos:4,1');
    expect(optionIds).toContain('skip');

    const skipped = executePipeline(
      { domain: SummonerWarsDomain, systems },
      attacked.state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'skip' } },
      testRandom(),
      ['0', '1'],
    );
    expect(skipped.success).toBe(true);
    expect(skipped.state.core.board[4][3].unit?.instanceId).toBe(summoner.instanceId);
    expect(skipped.state.core.board[4][3].unit?.extraAttacks ?? 0).toBe(0);
  });

  it('选择2格位移后移动同一召唤师并授予一次不会递归触发原始狂怒的额外攻击', () => {
    const core = createState();
    core.phase = 'attack';
    core.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[2], id: 'shouren-primal-fury-0-1' });
    const summoner = place(core, { row: 4, col: 3 }, SUMMONER_SHOUREN, '0');
    place(core, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'primal-fury-first-target', name: '原始狂怒目标一',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    place(core, { row: 4, col: 0 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'primal-fury-extra-target', name: '原始狂怒目标二',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const attacked = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: summoner.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0, 0]),
      ['0', '1'],
    );
    const current = attacked.state.sys.interaction.current;
    const moved = executePipeline(
      { domain: SummonerWarsDomain, systems },
      attacked.state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'pos:4,1' } },
      testRandom(),
      ['0', '1'],
    );
    expect(moved.success).toBe(true);
    expect(moved.state.core.board[4][1].unit?.instanceId).toBe(summoner.instanceId);
    expect(moved.state.core.board[4][1].unit?.extraAttacks).toBe(1);

    const extraAttack = executePipeline(
      { domain: SummonerWarsDomain, systems },
      moved.state,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: { row: 4, col: 1 }, target: { row: 4, col: 0 } } },
      testRandom([0, 0, 0]),
      ['0', '1'],
    );
    expect(extraAttack.success).toBe(true);
    expect(extraAttack.state.core.board[4][1].unit?.extraAttacks).toBe(0);
    expect(extraAttack.state.sys.interaction.current).toBeUndefined();
  });

  it('事件不在场或攻击者不是召唤师时不触发原始狂怒', () => {
    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    const withoutEvent = createState();
    withoutEvent.phase = 'attack';
    const summoner = place(withoutEvent, { row: 4, col: 3 }, SUMMONER_SHOUREN, '0');
    place(withoutEvent, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'primal-fury-no-event-target', name: '原始狂怒目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const noEventAttack = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core: withoutEvent, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: summoner.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0, 0]),
      ['0', '1'],
    );
    expect(noEventAttack.state.sys.interaction.current).toBeUndefined();

    const nonSummonerState = createState();
    nonSummonerState.phase = 'attack';
    nonSummonerState.players['0'].activeEvents.push({ ...EVENT_CARDS_SHOUREN[2], id: 'shouren-primal-fury-0-1' });
    const fighter = place(nonSummonerState, { row: 4, col: 3 }, COMMON_UNITS_SHOUREN[2], '0');
    place(nonSummonerState, { row: 4, col: 4 }, {
      ...COMMON_UNITS_SHOUREN[3], id: 'primal-fury-non-summoner-target', name: '原始狂怒目标',
      faction: 'necromancer', abilities: [], life: 20,
    }, '1');
    const nonSummonerAttack = executePipeline(
      { domain: SummonerWarsDomain, systems },
      { core: nonSummonerState, sys: createInitialSystemState(['0', '1'], systems) },
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: fighter.position, target: { row: 4, col: 4 } } },
      testRandom([0, 0, 0]),
      ['0', '1'],
    );
    expect(nonSummonerAttack.state.sys.interaction.current).toBeUndefined();
  });
});

describe('冰苔兽人 - 激励待结算攻击', () => {
  it('激励选择完成前不产生攻击、伤害或攻击次数消耗，保留后只结算一次', () => {
    const state = createState();
    state.phase = 'attack';
    place(state, { row: 3, col: 2 }, SUMMONER_SHOUREN, '0', { boosts: 1 });
    const attacker = place(state, { row: 4, col: 2 }, COMMON_UNITS_SHOUREN[2]);
    place(state, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[2],
      id: 'encourage-enemy',
      name: '敌方单位',
      faction: 'necromancer',
      abilities: [],
      life: 10,
    }, '1');

    const pending = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: { row: 4, col: 3 },
    }, testRandom([0]));

    expect(pending.events.filter(event => event.type === SW_EVENTS.ATTACK_ROLL_PENDING)).toHaveLength(1);
    expect(pending.events.some(event => event.type === SW_EVENTS.UNIT_ATTACKED)).toBe(false);
    expect(pending.events.some(event => event.type === SW_EVENTS.UNIT_DAMAGED)).toBe(false);
    expect(pending.newState.pendingAttackRoll?.attackerId).toBe(attacker.instanceId);
    expect(pending.newState.board[4][2].unit?.hasAttacked).toBe(false);
    expect(pending.newState.board[4][3].unit?.damage).toBe(0);
    expect(pending.newState.players['0'].attackCount).toBe(0);

    const resolved = executeAndReduce(pending.newState, SW_COMMANDS.RESOLVE_PENDING_ATTACK, {
      choice: 'keep',
    }, testRandom([0.9]));

    expect(resolved.events.filter(event => event.type === SW_EVENTS.UNIT_ATTACKED)).toHaveLength(1);
    expect(resolved.newState.pendingAttackRoll).toBeUndefined();
    expect(resolved.newState.board[4][2].unit?.hasAttacked).toBe(true);
    expect(resolved.newState.board[4][3].unit?.damage).toBe(2);
    expect(resolved.newState.players['0'].attackCount).toBe(1);
    expect(resolved.newState.board[3][2].unit?.boosts).toBe(1);
  });

  it('选择重掷时消耗 1 点充能并使用新骰面，待结算期间拒绝其它领域命令', () => {
    const state = createState();
    state.phase = 'attack';
    place(state, { row: 3, col: 2 }, SUMMONER_SHOUREN, '0', { boosts: 1 });
    const attacker = place(state, { row: 4, col: 2 }, COMMON_UNITS_SHOUREN[2]);
    place(state, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[2],
      id: 'reroll-enemy',
      name: '敌方单位',
      faction: 'necromancer',
      abilities: [],
      life: 10,
    }, '1');

    const pending = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: attacker.position,
      target: { row: 4, col: 3 },
    }, testRandom([0.2]));

    const blocked = SummonerWarsDomain.validate({ core: pending.newState } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.END_PHASE,
      payload: {},
      playerId: '0',
    });
    expect(blocked.valid).toBe(false);

    const allowed = SummonerWarsDomain.validate({ core: pending.newState } as MatchState<SummonerWarsCore>, {
      type: SW_COMMANDS.RESOLVE_PENDING_ATTACK,
      payload: { choice: 'reroll' },
      playerId: '0',
    });
    expect(allowed.valid).toBe(true);

    const resolved = executeAndReduce(pending.newState, SW_COMMANDS.RESOLVE_PENDING_ATTACK, {
      choice: 'reroll',
    }, testRandom([0]));
    expect(resolved.events.filter(event => event.type === SW_EVENTS.UNIT_ATTACKED)).toHaveLength(1);
    expect(resolved.newState.board[4][3].unit?.damage).toBe(2);
    expect(resolved.newState.board[3][2].unit?.boosts).toBe(0);
  });

  it('领域待结算事件通过 sys.interaction 提供重掷与保留并完成响应', () => {
    const core = createState();
    core.phase = 'attack';
    place(core, { row: 3, col: 2 }, SUMMONER_SHOUREN, '0', { boosts: 1 });
    const attacker = place(core, { row: 4, col: 2 }, COMMON_UNITS_SHOUREN[2]);
    place(core, { row: 4, col: 3 }, {
      ...COMMON_UNITS_SHOUREN[2],
      id: 'interaction-enemy',
      name: '敌方单位',
      faction: 'necromancer',
      abilities: [],
      life: 10,
    }, '1');

    const systems = [
      createInteractionSystem<SummonerWarsCore>(),
      createSimpleChoiceSystem<SummonerWarsCore>(),
      createSummonerWarsInteractionSystem(),
    ];
    let state: MatchState<SummonerWarsCore> = {
      core,
      sys: createInitialSystemState(['0', '1'], systems),
    };

    const requested = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: attacker.position, target: { row: 4, col: 3 } } },
      testRandom([0]),
      ['0', '1'],
    );
    expect(requested.success).toBe(true);
    state = requested.state;
    const current = state.sys.interaction.current;
    expect((current?.data as { sw?: { type?: string } })?.sw?.type).toBe('shouren_encourage');
    const optionIds = ((current?.data as { options?: Array<{ id: string }> })?.options ?? []).map(option => option.id);
    expect(optionIds).toEqual(['reroll', 'keep']);

    const kept = executePipeline(
      { domain: SummonerWarsDomain, systems },
      state,
      { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { interactionId: current!.id, optionId: 'keep' } },
      testRandom([0.9]),
      ['0', '1'],
    );
    expect(kept.success).toBe(true);
    expect(kept.state.sys.interaction.current).toBeUndefined();
    expect(kept.state.core.pendingAttackRoll).toBeUndefined();
    expect(kept.state.core.board[4][3].unit?.damage).toBe(2);
  });
});
