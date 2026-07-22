/**
 * 召唤师战争 - 永恒议会机制测试
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { BoardUnit, CellCoord, EventCard, PlayerId, SummonerWarsCore, UnitCard } from '../domain/types';
import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createInteractionSystem } from '../../../engine/systems/InteractionSystem';
import { createSimpleChoiceSystem } from '../../../engine/systems/SimpleChoiceSystem';
import { createFlowSystem, FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import type { EngineSystem } from '../../../engine/systems/types';
import {
  createInitializedCore,
  createPromptResponseCommand,
  generateInstanceId,
  getPromptOptionIds,
  getPromptPlayerId,
  getPromptSwType,
  hasActivePrompt,
  placeTestUnit,
} from './test-helpers';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
import { summonerWarsFlowHooks } from '../domain/flowHooks';
import { createSummonerWarsInteractionSystem } from '../domain/systems';
import {
  CHAMPION_UNITS_YONGHENG,
  COMMON_UNITS_YONGHENG,
  EVENT_CARDS_YONGHENG,
  SPRITE_INDEX_YONGHENG,
  SUMMONER_YONGHENG,
} from '../config/factions/yongheng';
import { DECK_SYMBOLS } from '../config/symbols';
import { CARD_IDS } from '../domain/ids';

function testRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

function createState(): SummonerWarsCore {
  const state = createInitializedCore(['0', '1'], testRandom(), { faction0: 'yongheng', faction1: 'necromancer' });
  for (const row of state.board) {
    for (const cell of row) {
      cell.unit = undefined;
      cell.structure = undefined;
    }
  }
  state.currentPlayer = '0';
  state.phase = 'summon';
  state.players['0'].hand = [];
  state.players['0'].deck = [];
  state.players['0'].discard = [];
  state.players['0'].activeEvents = [];
  state.players['0'].magic = 10;
  state.players['0'].hasAttackedEnemy = true;
  state.players['1'].hand = [];
  state.players['1'].deck = [];
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
    faction: 'yongheng',
    strength: 2,
    life: 5,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities,
    deckSymbols: [],
    ...overrides,
  };
}

function activeEvent(baseId: string, name: string, charges = 0): EventCard {
  return {
    id: baseId,
    cardType: 'event',
    name,
    faction: 'yongheng',
    cost: 0,
    playPhase: 'summon',
    effect: '',
    isActive: true,
    charges,
    deckSymbols: [],
  };
}

function eventCard(id: string, name: string, overrides: Partial<EventCard> = {}): EventCard {
  return {
    id,
    cardType: 'event',
    name,
    faction: 'necromancer',
    cost: 0,
    playPhase: 'summon',
    effect: '',
    isActive: false,
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

function abilityTriggered(events: GameEvent[], abilityId: string): boolean {
  return events.some(event =>
    event.type === SW_EVENTS.ABILITY_TRIGGERED
    && (event.payload as { abilityId?: string }).abilityId === abilityId
  );
}

function chargeEvents(events: GameEvent[], sourceAbilityId: string): GameEvent[] {
  return events.filter(event =>
    event.type === SW_EVENTS.UNIT_CHARGED
    && (event.payload as { sourceAbilityId?: string }).sourceAbilityId === sourceAbilityId
  );
}

function createInteractionSystems(): EngineSystem<SummonerWarsCore>[] {
  return [
    createInteractionSystem<SummonerWarsCore>(),
    createSimpleChoiceSystem<SummonerWarsCore>(),
    createSummonerWarsInteractionSystem(),
  ];
}

function createFlowInteractionSystems(): EngineSystem<SummonerWarsCore>[] {
  return [
    createFlowSystem<SummonerWarsCore>({ hooks: summonerWarsFlowHooks }),
    ...createInteractionSystems(),
  ];
}

function createPipelineState(core: SummonerWarsCore, systems = createInteractionSystems()): MatchState<SummonerWarsCore> {
  return {
    core,
    sys: createInitialSystemState(['0', '1'], systems),
  };
}

function createPipelineStateAtPhase(
  core: SummonerWarsCore,
  systems: EngineSystem<SummonerWarsCore>[],
  phase: string,
): MatchState<SummonerWarsCore> {
  const state = createPipelineState(core, systems);
  return {
    ...state,
    sys: { ...state.sys, phase },
  };
}

function runPipeline(
  state: MatchState<SummonerWarsCore>,
  systems: EngineSystem<SummonerWarsCore>[],
  command: { type: string; playerId: PlayerId; payload: Record<string, unknown> },
  random: RandomFn = testRandom(),
): MatchState<SummonerWarsCore> {
  const result = executePipeline(
    { domain: SummonerWarsDomain, systems },
    state,
    command,
    random,
    ['0', '1'],
  );
  expect(result.success).toBe(true);
  return result.state;
}

function currentOptionIds(state: MatchState<SummonerWarsCore>): string[] {
  return getPromptOptionIds(state);
}

function currentSwType(state: MatchState<SummonerWarsCore>): string | undefined {
  return getPromptSwType(state);
}

function respondCurrent(
  state: MatchState<SummonerWarsCore>,
  systems: EngineSystem<SummonerWarsCore>[],
  playerId: PlayerId,
  optionId: string,
): MatchState<SummonerWarsCore> {
  return runPipeline(
    state,
    systems,
    createPromptResponseCommand(state, playerId, optionId),
  );
}

describe('永恒议会 - 静态录入', () => {
  it('卡牌基础字段与图集 slot 顺序保持一致', () => {
    expect(SUMMONER_YONGHENG).toMatchObject({
      id: 'yongheng-summoner',
      name: '大议长艾迪雅',
      strength: 3,
      life: 13,
      attackType: 'ranged',
      spriteAtlas: 'hero',
      spriteIndex: 0,
    });
    expect(SUMMONER_YONGHENG.deckSymbols).toEqual([
      DECK_SYMBOLS.DOUBLE_AXE,
      DECK_SYMBOLS.COUNCIL,
      DECK_SYMBOLS.EYE,
    ]);

    expect(CHAMPION_UNITS_YONGHENG.map(card => ({
      id: card.id,
      cost: card.cost,
      strength: card.strength,
      life: card.life,
      attackType: card.attackType,
      spriteIndex: card.spriteIndex,
    }))).toEqual([
      { id: 'yongheng-supervisor-maruna', cost: 3, strength: 5, life: 8, attackType: 'melee', spriteIndex: SPRITE_INDEX_YONGHENG.CHAMPION_SUPERVISOR_MARUNA },
      { id: 'yongheng-supervisor-ovi', cost: 2, strength: 4, life: 6, attackType: 'ranged', spriteIndex: SPRITE_INDEX_YONGHENG.CHAMPION_SUPERVISOR_OVI },
      { id: 'yongheng-supervisor-katu', cost: 2, strength: 6, life: 10, attackType: 'ranged', spriteIndex: SPRITE_INDEX_YONGHENG.CHAMPION_SUPERVISOR_KATU },
    ]);

    expect(COMMON_UNITS_YONGHENG.map(card => ({
      id: card.id,
      cost: card.cost,
      strength: card.strength,
      life: card.life,
      attackType: card.attackType,
      spriteIndex: card.spriteIndex,
    }))).toEqual([
      { id: 'yongheng-fortress-advisor', cost: 2, strength: 1, life: 3, attackType: 'ranged', spriteIndex: SPRITE_INDEX_YONGHENG.COMMON_FORTRESS_ADVISOR },
      { id: 'yongheng-psychic-knight', cost: 2, strength: 2, life: 4, attackType: 'melee', spriteIndex: SPRITE_INDEX_YONGHENG.COMMON_PSYCHIC_KNIGHT },
      { id: 'yongheng-ancient-scholar', cost: 3, strength: 1, life: 2, attackType: 'melee', spriteIndex: SPRITE_INDEX_YONGHENG.COMMON_ANCIENT_SCHOLAR },
      { id: 'yongheng-mystery-sage', cost: 3, strength: 2, life: 4, attackType: 'ranged', spriteIndex: SPRITE_INDEX_YONGHENG.COMMON_MYSTERY_SAGE },
    ]);

    expect(EVENT_CARDS_YONGHENG.map(card => ({
      id: card.id,
      eventType: card.eventType,
      playPhase: card.playPhase,
      isActive: card.isActive,
      charges: card.charges,
      spriteIndex: card.spriteIndex,
    }))).toEqual([
      { id: CARD_IDS.YONGHENG_LEARNING, eventType: 'legendary', playPhase: 'magic', isActive: true, charges: 2, spriteIndex: SPRITE_INDEX_YONGHENG.EVENT_LEARNING },
      { id: CARD_IDS.YONGHENG_INSIGHT, eventType: 'common', playPhase: 'summon', isActive: true, charges: undefined, spriteIndex: SPRITE_INDEX_YONGHENG.EVENT_INSIGHT },
      { id: CARD_IDS.YONGHENG_SEARCH, eventType: 'common', playPhase: 'summon', isActive: true, charges: undefined, spriteIndex: SPRITE_INDEX_YONGHENG.EVENT_SEARCH },
      { id: CARD_IDS.YONGHENG_MENTAL_INVASION, eventType: 'common', playPhase: 'summon', isActive: true, charges: undefined, spriteIndex: SPRITE_INDEX_YONGHENG.EVENT_MENTAL_INVASION },
    ]);
  });
});

describe('永恒议会 - 自动充能与战力', () => {
  it('大议长艾迪雅攻击敌方单位后通过动能虹吸给自己充能', () => {
    const state = createState();
    state.phase = 'attack';
    const summoner = place(state, { row: 4, col: 4 }, SUMMONER_YONGHENG);
    place(state, { row: 4, col: 5 }, unitCard('enemy', '敌方单位', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: summoner.position,
      target: { row: 4, col: 5 },
    });

    expect(abilityTriggered(events, 'yongheng_kinetic_siphon')).toBe(true);
    expect(newState.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(1);
  });

  it('大议长艾迪雅被敌方单位攻击后充能，且同一回合第二次不再触发', () => {
    const state = createState();
    state.phase = 'attack';
    state.currentPlayer = '1';
    const summoner = place(state, { row: 4, col: 4 }, SUMMONER_YONGHENG);
    const firstAttacker = place(state, { row: 4, col: 5 }, unitCard('enemy-a', '敌方甲', [], {
      faction: 'necromancer',
      strength: 1,
      life: 5,
    }), '1');
    const secondAttacker = place(state, { row: 5, col: 4 }, unitCard('enemy-b', '敌方乙', [], {
      faction: 'necromancer',
      strength: 1,
      life: 5,
    }), '1');

    const first = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: firstAttacker.position,
      target: summoner.position,
    });
    const second = executeAndReduce(first.newState, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: secondAttacker.position,
      target: summoner.position,
    });

    expect(abilityTriggered(first.events, 'yongheng_kinetic_siphon')).toBe(true);
    expect(chargeEvents(first.events, 'yongheng_kinetic_siphon')).toHaveLength(1);
    expect(abilityTriggered(second.events, 'yongheng_kinetic_siphon')).toBe(false);
    expect(second.newState.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(1);
  });

  it('洞察在己方抓牌后给主动事件充能，并按单张事件最多 +5 提升召唤师战力', () => {
    const state = createState();
    state.phase = 'draw';
    state.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_INSIGHT, '洞察'));
    state.players['0'].deck.push(
      unitCard('draw-a', '待抓牌甲'),
      unitCard('draw-b', '待抓牌乙'),
    );
    const summoner = place(state, { row: 4, col: 4 }, SUMMONER_YONGHENG);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.END_PHASE, {});

    expect(events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
      payload: expect.objectContaining({ sourceAbilityId: 'yongheng_insight' }),
    }));
    expect(newState.players['0'].activeEvents.find(card => card.id === CARD_IDS.YONGHENG_INSIGHT)?.charges).toBe(1);

    const chargedState = createState();
    chargedState.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_INSIGHT, '洞察', 7));
    const chargedSummoner = place(chargedState, { row: 4, col: 4 }, SUMMONER_YONGHENG);
    expect(getEffectiveStrengthValue(chargedSummoner, chargedState)).toBe(8);
    expect(getEffectiveStrengthValue(summoner, state)).toBe(3);
  });

  it('学习被弃除时会把自身全部充能转移到大议长艾迪雅身上', () => {
    const state = createState();
    state.currentPlayer = '1';
    state.phase = 'draw';
    state.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_LEARNING, '学习', 2));
    const summoner = place(state, { row: 4, col: 4 }, SUMMONER_YONGHENG);

    const events = summonerWarsFlowHooks.onPhaseEnter!({
      state: { core: state, sys: {} } as MatchState<SummonerWarsCore>,
      from: 'draw',
      to: 'summon',
      command: { type: 'FLOW_PHASE_CHANGED', payload: {}, timestamp: 1000, playerId: '1' },
    });
    let newState = state;
    for (const event of events) {
      newState = SummonerWarsDomain.reduce(newState, event);
    }

    expect(events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
      payload: expect.objectContaining({ playerId: '0', cardId: CARD_IDS.YONGHENG_LEARNING }),
    }));
    expect(chargeEvents(events, 'yongheng_learning')).toHaveLength(1);
    expect(newState.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(2);
    expect(newState.players['0'].activeEvents.find(card => card.id === CARD_IDS.YONGHENG_LEARNING)).toBeUndefined();
  });

  it('学习在对手普通事件进入弃牌堆后移除 1 充能并拿回该事件', () => {
    const state = createState();
    state.currentPlayer = '1';
    state.phase = 'summon';
    state.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_LEARNING, '学习', 1));
    state.players['1'].hand.push(eventCard('enemy-tactic-event', '敌方战术事件'));

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'enemy-tactic-event',
    });

    expect(events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.EVENT_PLAYED,
      payload: expect.objectContaining({ playerId: '1', cardId: 'enemy-tactic-event' }),
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
      payload: expect.objectContaining({
        playerId: '0',
        eventCardId: CARD_IDS.YONGHENG_LEARNING,
        charges: 0,
        sourceAbilityId: 'yongheng_learning',
      }),
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: SW_EVENTS.CARD_RETRIEVED,
      payload: expect.objectContaining({
        fromPlayerId: '1',
        toPlayerId: '0',
        cardId: 'enemy-tactic-event',
        sourceAbilityId: 'yongheng_learning',
      }),
    }));
    expect(newState.players['0'].activeEvents.find(card => card.id === CARD_IDS.YONGHENG_LEARNING)?.charges).toBe(0);
    expect(newState.players['0'].hand.map(card => card.id)).toContain('enemy-tactic-event');
    expect(newState.players['1'].discard.map(card => card.id)).not.toContain('enemy-tactic-event');
  });

  it('延续在持续事件将被弃除前确认消耗 2 充能并保留该事件', () => {
    const core = createState();
    core.currentPlayer = '1';
    core.phase = 'draw';
    core.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_SEARCH, '探寻'));
    const summoner = place(core, { row: 4, col: 4 }, SUMMONER_YONGHENG, '0', { boosts: 2 });
    const systems = createFlowInteractionSystems();
    let state = runPipeline(
      createPipelineStateAtPhase(core, systems, 'draw'),
      systems,
      { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} },
    );

    expect(currentSwType(state)).toBe('yongheng_continuance');
    expect(state.core.players['0'].activeEvents.map(card => card.id)).toContain(CARD_IDS.YONGHENG_SEARCH);
    expect(state.core.players['0'].discard.map(card => card.id)).not.toContain(CARD_IDS.YONGHENG_SEARCH);
    expect(state.core.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(2);

    state = respondCurrent(state, systems, '0', 'confirm');

    expect(state.core.players['0'].activeEvents.map(card => card.id)).toContain(CARD_IDS.YONGHENG_SEARCH);
    expect(state.core.players['0'].discard.map(card => card.id)).not.toContain(CARD_IDS.YONGHENG_SEARCH);
    expect(state.core.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(0);
  });

  it('延续跳过后持续事件正常进入弃牌堆且不消耗充能', () => {
    const core = createState();
    core.currentPlayer = '1';
    core.phase = 'draw';
    core.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_SEARCH, '探寻'));
    const summoner = place(core, { row: 4, col: 4 }, SUMMONER_YONGHENG, '0', { boosts: 2 });
    const systems = createFlowInteractionSystems();
    let state = runPipeline(
      createPipelineStateAtPhase(core, systems, 'draw'),
      systems,
      { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} },
    );

    expect(currentSwType(state)).toBe('yongheng_continuance');

    state = respondCurrent(state, systems, '0', 'skip');

    expect(state.core.players['0'].activeEvents.map(card => card.id)).not.toContain(CARD_IDS.YONGHENG_SEARCH);
    expect(state.core.players['0'].discard.map(card => card.id)).toContain(CARD_IDS.YONGHENG_SEARCH);
    expect(state.core.board[summoner.position.row][summoner.position.col].unit?.boosts).toBe(2);
  });

  it('主管奥维按每两张手牌 +1 战力结算谋划', () => {
    const state = createState();
    const oviCard = CHAMPION_UNITS_YONGHENG.find(card => card.id === 'yongheng-supervisor-ovi')!;
    const ovi = place(state, { row: 4, col: 4 }, oviCard);

    state.players['0'].hand = [];
    expect(getEffectiveStrengthValue(ovi, state)).toBe(4);
    state.players['0'].hand = [unitCard('h1', '手牌1')];
    expect(getEffectiveStrengthValue(ovi, state)).toBe(4);
    state.players['0'].hand = [unitCard('h1', '手牌1'), unitCard('h2', '手牌2')];
    expect(getEffectiveStrengthValue(ovi, state)).toBe(5);
    state.players['0'].hand = [
      unitCard('h1', '手牌1'),
      unitCard('h2', '手牌2'),
      unitCard('h3', '手牌3'),
      unitCard('h4', '手牌4'),
      unitCard('h5', '手牌5'),
    ];
    expect(getEffectiveStrengthValue(ovi, state)).toBe(6);
  });

  it('主管卡图只在牌库为空的回合结束充能一次，力量强化最多 +5', () => {
    const emptyDeckState = createState();
    emptyDeckState.phase = 'draw';
    const katuCard = CHAMPION_UNITS_YONGHENG.find(card => card.id === 'yongheng-supervisor-katu')!;
    const katu = place(emptyDeckState, { row: 4, col: 4 }, katuCard);

    const charged = executeAndReduce(emptyDeckState, SW_COMMANDS.END_PHASE, {});
    expect(abilityTriggered(charged.events, 'yongheng_tenacity')).toBe(true);
    expect(chargeEvents(charged.events, 'yongheng_tenacity')).toHaveLength(1);
    expect(charged.newState.board[katu.position.row][katu.position.col].unit?.boosts).toBe(1);

    const nonEmptyDeckState = createState();
    nonEmptyDeckState.phase = 'draw';
    nonEmptyDeckState.players['0'].deck.push(unitCard('deck-card', '牌库牌'));
    const unchargedKatu = place(nonEmptyDeckState, { row: 4, col: 4 }, katuCard);
    const notCharged = executeAndReduce(nonEmptyDeckState, SW_COMMANDS.END_PHASE, {});
    expect(abilityTriggered(notCharged.events, 'yongheng_tenacity')).toBe(false);
    expect(notCharged.newState.board[unchargedKatu.position.row][unchargedKatu.position.col].unit?.boosts ?? 0).toBe(0);

    const cappedState = createState();
    const boostedKatu = place(cappedState, { row: 4, col: 4 }, katuCard, '0', { boosts: 9 });
    expect(getEffectiveStrengthValue(boostedKatu, cappedState)).toBe(11);
  });
});

describe('永恒议会 - 可选与强制交互闭环', () => {
  it('情报移动后必须提供确认/跳过；确认抓牌，跳过不抓牌', () => {
    const advisorCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-fortress-advisor')!;

    const confirmCore = createState();
    confirmCore.phase = 'move';
    confirmCore.players['0'].deck.push(unitCard('intel-draw', '情报抓牌'));
    const confirmAdvisor = place(confirmCore, { row: 4, col: 3 }, advisorCard);
    const confirmSystems = createInteractionSystems();
    let confirmState = runPipeline(
      createPipelineState(confirmCore, confirmSystems),
      confirmSystems,
      { type: SW_COMMANDS.MOVE_UNIT, playerId: '0', payload: { from: confirmAdvisor.position, to: { row: 4, col: 4 } } },
    );
    expect(currentSwType(confirmState)).toBe('yongheng_draw');
    expect(currentOptionIds(confirmState)).toEqual(['confirm', 'skip']);
    confirmState = respondCurrent(confirmState, confirmSystems, '0', 'confirm');
    expect(confirmState.core.players['0'].hand.map(card => card.id)).toContain('intel-draw');
    expect(hasActivePrompt(confirmState)).toBe(false);

    const skipCore = createState();
    skipCore.phase = 'move';
    skipCore.players['0'].deck.push(unitCard('intel-skip-draw', '情报跳过牌'));
    const skipAdvisor = place(skipCore, { row: 4, col: 3 }, advisorCard);
    const skipSystems = createInteractionSystems();
    let skipState = runPipeline(
      createPipelineState(skipCore, skipSystems),
      skipSystems,
      { type: SW_COMMANDS.MOVE_UNIT, playerId: '0', payload: { from: skipAdvisor.position, to: { row: 4, col: 4 } } },
    );
    skipState = respondCurrent(skipState, skipSystems, '0', 'skip');
    expect(skipState.core.players['0'].hand).toHaveLength(0);
    expect(skipState.core.players['0'].deck.map(card => card.id)).toContain('intel-skip-draw');
  });

  it('探寻在己方阶段开始提供确认/跳过抓牌', () => {
    const confirmCore = createState();
    confirmCore.phase = 'summon';
    confirmCore.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_SEARCH, '探寻'));
    confirmCore.players['0'].deck.push(unitCard('search-draw', '探寻抓牌'));
    place(confirmCore, { row: 4, col: 4 }, SUMMONER_YONGHENG);
    const confirmSystems = createInteractionSystems();
    let confirmState = runPipeline(
      createPipelineState(confirmCore, confirmSystems),
      confirmSystems,
      { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
    );
    expect(currentSwType(confirmState)).toBe('yongheng_draw');
    expect(currentOptionIds(confirmState)).toEqual(['confirm', 'skip']);
    confirmState = respondCurrent(confirmState, confirmSystems, '0', 'confirm');
    expect(confirmState.core.players['0'].hand.map(card => card.id)).toContain('search-draw');

    const skipCore = createState();
    skipCore.phase = 'summon';
    skipCore.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_SEARCH, '探寻'));
    skipCore.players['0'].deck.push(unitCard('search-skip-draw', '探寻跳过牌'));
    place(skipCore, { row: 4, col: 4 }, SUMMONER_YONGHENG);
    const skipSystems = createInteractionSystems();
    let skipState = runPipeline(
      createPipelineState(skipCore, skipSystems),
      skipSystems,
      { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
    );
    skipState = respondCurrent(skipState, skipSystems, '0', 'skip');
    expect(skipState.core.players['0'].hand).toHaveLength(0);
    expect(skipState.core.players['0'].deck.map(card => card.id)).toContain('search-skip-draw');
  });

  it('心念侵袭只在己方回合抓牌后选择召唤师 2 格内目标并造成 1 点伤害', () => {
    const core = createState();
    core.phase = 'draw';
    core.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_MENTAL_INVASION, '心念侵袭'));
    core.players['0'].deck.push(unitCard('mental-draw', '心念抓牌'));
    place(core, { row: 4, col: 4 }, SUMMONER_YONGHENG);
    place(core, { row: 4, col: 5 }, unitCard('mental-target', '心念目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    place(core, { row: 0, col: 0 }, unitCard('mental-far-target', '远处目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const systems = createInteractionSystems();
    let state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
    );
    expect(currentSwType(state)).toBe('yongheng_mental_invasion');
    expect(currentOptionIds(state)).toContain('pos:4,5');
    expect(currentOptionIds(state)).not.toContain('pos:0,0');

    state = respondCurrent(state, systems, '0', 'pos:4,5');
    expect(state.core.board[4][5].unit?.damage).toBe(1);
    expect(hasActivePrompt(state)).toBe(false);
  });

  it('心念侵袭跳过目标选择后不造成伤害', () => {
    const core = createState();
    core.phase = 'draw';
    core.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_MENTAL_INVASION, '心念侵袭'));
    core.players['0'].deck.push(unitCard('mental-skip-draw', '心念跳过抓牌'));
    place(core, { row: 4, col: 4 }, SUMMONER_YONGHENG);
    place(core, { row: 4, col: 5 }, unitCard('mental-skip-target', '心念跳过目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const systems = createInteractionSystems();
    let state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
    );
    expect(currentSwType(state)).toBe('yongheng_mental_invasion');
    expect(currentOptionIds(state)).toContain('skip');

    state = respondCurrent(state, systems, '0', 'skip');
    expect(state.core.board[4][5].unit?.damage ?? 0).toBe(0);
    expect(hasActivePrompt(state)).toBe(false);
  });

  it('心念侵袭没有合法目标时不生成目标选择', () => {
    const core = createState();
    core.phase = 'draw';
    core.players['0'].activeEvents.push(activeEvent(CARD_IDS.YONGHENG_MENTAL_INVASION, '心念侵袭'));
    core.players['0'].deck.push(unitCard('mental-no-target-draw', '心念无目标抓牌'));
    place(core, { row: 4, col: 4 }, SUMMONER_YONGHENG);
    place(core, { row: 0, col: 0 }, unitCard('mental-no-target-far', '心念远处目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const systems = createInteractionSystems();
    const state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
    );

    expect(state.core.players['0'].hand.map(card => card.id)).toContain('mental-no-target-draw');
    expect(hasActivePrompt(state)).toBe(false);
    expect(state.core.board[0][0].unit?.damage ?? 0).toBe(0);
  });

  it('冲撞先选相邻敌方单位，再选推拉落点', () => {
    const core = createState();
    core.phase = 'attack';
    const knightCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-psychic-knight')!;
    const knight = place(core, { row: 4, col: 4 }, knightCard);
    const enemy = place(core, { row: 4, col: 5 }, unitCard('collision-target', '冲撞目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const systems = createInteractionSystems();
    let state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: knight.position, target: enemy.position } },
    );
    expect(currentSwType(state)).toBe('yongheng_collision_target');
    expect(currentOptionIds(state)).toContain('pos:4,5');
    expect(currentOptionIds(state)).toContain('skip');

    state = respondCurrent(state, systems, '0', 'pos:4,5');
    expect(currentSwType(state)).toBe('yongheng_collision_position');
    expect(currentOptionIds(state)).toContain('pos:3,5');

    state = respondCurrent(state, systems, '0', 'pos:3,5');
    expect(state.core.board[3][5].unit?.instanceId).toBe(enemy.instanceId);
    expect(state.core.board[4][5].unit).toBeUndefined();
  });

  it('冲撞跳过目标选择或落点选择时不移动目标', () => {
    const knightCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-psychic-knight')!;

    const targetSkipCore = createState();
    targetSkipCore.phase = 'attack';
    const targetSkipKnight = place(targetSkipCore, { row: 4, col: 4 }, knightCard);
    const targetSkipEnemy = place(targetSkipCore, { row: 4, col: 5 }, unitCard('collision-target-skip', '冲撞目标跳过', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const targetSkipSystems = createInteractionSystems();
    let targetSkipState = runPipeline(
      createPipelineState(targetSkipCore, targetSkipSystems),
      targetSkipSystems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: targetSkipKnight.position, target: targetSkipEnemy.position } },
    );
    expect(currentSwType(targetSkipState)).toBe('yongheng_collision_target');
    targetSkipState = respondCurrent(targetSkipState, targetSkipSystems, '0', 'skip');
    expect(targetSkipState.core.board[4][5].unit?.instanceId).toBe(targetSkipEnemy.instanceId);
    expect(targetSkipState.core.board[3][5].unit).toBeUndefined();
    expect(hasActivePrompt(targetSkipState)).toBe(false);

    const positionSkipCore = createState();
    positionSkipCore.phase = 'attack';
    const positionSkipKnight = place(positionSkipCore, { row: 4, col: 4 }, knightCard);
    const positionSkipEnemy = place(positionSkipCore, { row: 4, col: 5 }, unitCard('collision-position-skip', '冲撞落点跳过', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const positionSkipSystems = createInteractionSystems();
    let positionSkipState = runPipeline(
      createPipelineState(positionSkipCore, positionSkipSystems),
      positionSkipSystems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: positionSkipKnight.position, target: positionSkipEnemy.position } },
    );
    positionSkipState = respondCurrent(positionSkipState, positionSkipSystems, '0', 'pos:4,5');
    expect(currentSwType(positionSkipState)).toBe('yongheng_collision_position');
    positionSkipState = respondCurrent(positionSkipState, positionSkipSystems, '0', 'skip');
    expect(positionSkipState.core.board[4][5].unit?.instanceId).toBe(positionSkipEnemy.instanceId);
    expect(positionSkipState.core.board[3][5].unit).toBeUndefined();
    expect(hasActivePrompt(positionSkipState)).toBe(false);
  });

  it('警告放一张手牌到牌库底，再移动大议长艾迪雅 1 格', () => {
    const core = createState();
    core.phase = 'attack';
    core.players['0'].hand.push(unitCard('warning-card', '警告手牌'));
    place(core, { row: 3, col: 3 }, SUMMONER_YONGHENG);
    const advisorCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-fortress-advisor')!;
    const advisor = place(core, { row: 4, col: 4 }, advisorCard);
    place(core, { row: 4, col: 5 }, unitCard('warning-target', '警告攻击目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const systems = createInteractionSystems();
    let state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: advisor.position, target: { row: 4, col: 5 } } },
    );
    expect(currentSwType(state)).toBe('yongheng_warning_card');
    expect(currentOptionIds(state)).toContain('card:warning-card');

    state = respondCurrent(state, systems, '0', 'card:warning-card');
    expect(currentSwType(state)).toBe('yongheng_warning_position');
    expect(currentOptionIds(state)).toContain('pos:3,4');

    state = respondCurrent(state, systems, '0', 'pos:3,4');
    expect(state.core.players['0'].deck.map(card => card.id)).toContain('warning-card');
    expect(state.core.board[3][4].unit?.card.id).toBe('yongheng-summoner');
    expect(state.core.board[3][3].unit).toBeUndefined();
  });

  it('警告跳过手牌选择或落点选择时不移牌也不移动大议长艾迪雅', () => {
    const advisorCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-fortress-advisor')!;

    const cardSkipCore = createState();
    cardSkipCore.phase = 'attack';
    cardSkipCore.players['0'].hand.push(unitCard('warning-card-skip', '警告手牌跳过'));
    place(cardSkipCore, { row: 3, col: 3 }, SUMMONER_YONGHENG);
    const cardSkipAdvisor = place(cardSkipCore, { row: 4, col: 4 }, advisorCard);
    place(cardSkipCore, { row: 4, col: 5 }, unitCard('warning-card-skip-target', '警告跳过攻击目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const cardSkipSystems = createInteractionSystems();
    let cardSkipState = runPipeline(
      createPipelineState(cardSkipCore, cardSkipSystems),
      cardSkipSystems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: cardSkipAdvisor.position, target: { row: 4, col: 5 } } },
    );
    expect(currentSwType(cardSkipState)).toBe('yongheng_warning_card');
    cardSkipState = respondCurrent(cardSkipState, cardSkipSystems, '0', 'skip');
    expect(cardSkipState.core.players['0'].hand.map(card => card.id)).toContain('warning-card-skip');
    expect(cardSkipState.core.players['0'].deck.map(card => card.id)).not.toContain('warning-card-skip');
    expect(cardSkipState.core.board[3][3].unit?.card.id).toBe('yongheng-summoner');
    expect(cardSkipState.core.board[3][4].unit).toBeUndefined();
    expect(hasActivePrompt(cardSkipState)).toBe(false);

    const positionSkipCore = createState();
    positionSkipCore.phase = 'attack';
    positionSkipCore.players['0'].hand.push(unitCard('warning-position-skip', '警告落点跳过'));
    place(positionSkipCore, { row: 3, col: 3 }, SUMMONER_YONGHENG);
    const positionSkipAdvisor = place(positionSkipCore, { row: 4, col: 4 }, advisorCard);
    place(positionSkipCore, { row: 4, col: 5 }, unitCard('warning-position-skip-target', '警告落点攻击目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const positionSkipSystems = createInteractionSystems();
    let positionSkipState = runPipeline(
      createPipelineState(positionSkipCore, positionSkipSystems),
      positionSkipSystems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: positionSkipAdvisor.position, target: { row: 4, col: 5 } } },
    );
    positionSkipState = respondCurrent(positionSkipState, positionSkipSystems, '0', 'card:warning-position-skip');
    expect(currentSwType(positionSkipState)).toBe('yongheng_warning_position');
    positionSkipState = respondCurrent(positionSkipState, positionSkipSystems, '0', 'skip');
    expect(positionSkipState.core.players['0'].hand.map(card => card.id)).toContain('warning-position-skip');
    expect(positionSkipState.core.players['0'].deck.map(card => card.id)).not.toContain('warning-position-skip');
    expect(positionSkipState.core.board[3][3].unit?.card.id).toBe('yongheng-summoner');
    expect(positionSkipState.core.board[3][4].unit).toBeUndefined();
    expect(hasActivePrompt(positionSkipState)).toBe(false);
  });

  it('警告没有手牌时不生成可选移动交互', () => {
    const core = createState();
    core.phase = 'attack';
    place(core, { row: 3, col: 3 }, SUMMONER_YONGHENG);
    const advisorCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-fortress-advisor')!;
    const advisor = place(core, { row: 4, col: 4 }, advisorCard);
    place(core, { row: 4, col: 5 }, unitCard('warning-no-hand-target', '警告无手牌目标', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const systems = createInteractionSystems();
    const state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: advisor.position, target: { row: 4, col: 5 } } },
    );

    expect(state.core.players['0'].hand).toHaveLength(0);
    expect(state.core.board[3][3].unit?.card.id).toBe('yongheng-summoner');
    expect(hasActivePrompt(state)).toBe(false);
  });

  it('运用放一张手牌到牌库底，再对相邻单位造成 1 点伤害', () => {
    const core = createState();
    core.phase = 'attack';
    core.players['0'].hand.push(unitCard('application-card', '运用手牌'));
    const sageCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-mystery-sage')!;
    const sage = place(core, { row: 4, col: 4 }, sageCard);
    place(core, { row: 4, col: 5 }, unitCard('application-target', '运用目标', [], {
      faction: 'necromancer',
      life: 20,
    }), '1');
    const systems = createInteractionSystems();
    let state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: sage.position, target: { row: 4, col: 5 } } },
    );
    expect(currentSwType(state)).toBe('yongheng_application_card');
    expect(currentOptionIds(state)).toContain('card:application-card');

    state = respondCurrent(state, systems, '0', 'card:application-card');
    expect(currentSwType(state)).toBe('yongheng_application_target');
    expect(currentOptionIds(state)).toContain('pos:4,5');

    const damageBefore = state.core.board[4][5].unit?.damage ?? 0;
    state = respondCurrent(state, systems, '0', 'pos:4,5');
    expect(state.core.players['0'].deck.map(card => card.id)).toContain('application-card');
    expect(state.core.board[4][5].unit?.damage).toBe(damageBefore + 1);
  });

  it('运用跳过手牌选择或目标选择时不移牌也不造成伤害', () => {
    const sageCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-mystery-sage')!;

    const cardSkipCore = createState();
    cardSkipCore.phase = 'attack';
    cardSkipCore.players['0'].hand.push(unitCard('application-card-skip', '运用手牌跳过'));
    const cardSkipSage = place(cardSkipCore, { row: 4, col: 4 }, sageCard);
    place(cardSkipCore, { row: 4, col: 5 }, unitCard('application-card-skip-target', '运用手牌跳过目标', [], {
      faction: 'necromancer',
      life: 20,
    }), '1');
    const cardSkipSystems = createInteractionSystems();
    let cardSkipState = runPipeline(
      createPipelineState(cardSkipCore, cardSkipSystems),
      cardSkipSystems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: cardSkipSage.position, target: { row: 4, col: 5 } } },
    );
    expect(currentSwType(cardSkipState)).toBe('yongheng_application_card');
    const cardSkipDamageBefore = cardSkipState.core.board[4][5].unit?.damage ?? 0;
    cardSkipState = respondCurrent(cardSkipState, cardSkipSystems, '0', 'skip');
    expect(cardSkipState.core.players['0'].hand.map(card => card.id)).toContain('application-card-skip');
    expect(cardSkipState.core.players['0'].deck.map(card => card.id)).not.toContain('application-card-skip');
    expect(cardSkipState.core.board[4][5].unit?.damage ?? 0).toBe(cardSkipDamageBefore);
    expect(hasActivePrompt(cardSkipState)).toBe(false);

    const targetSkipCore = createState();
    targetSkipCore.phase = 'attack';
    targetSkipCore.players['0'].hand.push(unitCard('application-target-skip', '运用目标跳过'));
    const targetSkipSage = place(targetSkipCore, { row: 4, col: 4 }, sageCard);
    place(targetSkipCore, { row: 4, col: 5 }, unitCard('application-target-skip-target', '运用目标跳过对象', [], {
      faction: 'necromancer',
      life: 20,
    }), '1');
    const targetSkipSystems = createInteractionSystems();
    let targetSkipState = runPipeline(
      createPipelineState(targetSkipCore, targetSkipSystems),
      targetSkipSystems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: targetSkipSage.position, target: { row: 4, col: 5 } } },
    );
    targetSkipState = respondCurrent(targetSkipState, targetSkipSystems, '0', 'card:application-target-skip');
    expect(currentSwType(targetSkipState)).toBe('yongheng_application_target');
    const targetSkipDamageBefore = targetSkipState.core.board[4][5].unit?.damage ?? 0;
    targetSkipState = respondCurrent(targetSkipState, targetSkipSystems, '0', 'skip');
    expect(targetSkipState.core.players['0'].hand.map(card => card.id)).toContain('application-target-skip');
    expect(targetSkipState.core.players['0'].deck.map(card => card.id)).not.toContain('application-target-skip');
    expect(targetSkipState.core.board[4][5].unit?.damage ?? 0).toBe(targetSkipDamageBefore);
    expect(hasActivePrompt(targetSkipState)).toBe(false);
  });

  it('运用没有手牌时不生成可选伤害交互', () => {
    const core = createState();
    core.phase = 'attack';
    const sageCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-mystery-sage')!;
    const sage = place(core, { row: 4, col: 4 }, sageCard);
    place(core, { row: 4, col: 5 }, unitCard('application-no-hand-target', '运用无手牌目标', [], {
      faction: 'necromancer',
      life: 20,
    }), '1');
    const systems = createInteractionSystems();
    const state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.DECLARE_ATTACK, playerId: '0', payload: { attacker: sage.position, target: { row: 4, col: 5 } } },
    );

    expect(state.core.players['0'].hand).toHaveLength(0);
    expect(state.core.players['0'].deck).toHaveLength(0);
    expect(hasActivePrompt(state)).toBe(false);
  });

  it('唤起恐惧在敌方移动到心灵骑士相邻时让敌方选择弃一张手牌', () => {
    const core = createState();
    core.phase = 'move';
    core.currentPlayer = '1';
    core.players['1'].hand.push(unitCard('fear-card', '恐惧弃牌', [], { faction: 'necromancer' }));
    const knightCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-psychic-knight')!;
    place(core, { row: 4, col: 4 }, knightCard, '0');
    const mover = place(core, { row: 4, col: 2 }, unitCard('fear-mover', '恐惧移动者', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const systems = createInteractionSystems();
    let state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.MOVE_UNIT, playerId: '1', payload: { from: mover.position, to: { row: 4, col: 3 } } },
    );
    expect(currentSwType(state)).toBe('yongheng_forced_discard');
    expect(getPromptPlayerId(state)).toBe('1');
    expect(currentOptionIds(state)).toEqual(['card:fear-card']);

    state = respondCurrent(state, systems, '1', 'card:fear-card');
    expect(state.core.players['1'].hand).toHaveLength(0);
    expect(state.core.players['1'].discard.map(card => card.id)).toContain('fear-card');
  });

  it('唤起恐惧和惩戒在目标玩家没有可弃手牌时不生成弃牌交互', () => {
    const knightCard = COMMON_UNITS_YONGHENG.find(card => card.id === 'yongheng-psychic-knight')!;

    const fearCore = createState();
    fearCore.phase = 'move';
    fearCore.currentPlayer = '1';
    place(fearCore, { row: 4, col: 4 }, knightCard, '0');
    const mover = place(fearCore, { row: 4, col: 2 }, unitCard('fear-no-hand-mover', '恐惧无手牌移动者', [], {
      faction: 'necromancer',
      life: 10,
    }), '1');
    const fearSystems = createInteractionSystems();
    const fearState = runPipeline(
      createPipelineState(fearCore, fearSystems),
      fearSystems,
      { type: SW_COMMANDS.MOVE_UNIT, playerId: '1', payload: { from: mover.position, to: { row: 4, col: 3 } } },
    );
    expect(fearState.core.players['1'].hand).toHaveLength(0);
    expect(hasActivePrompt(fearState)).toBe(false);

    const punishCore = createState();
    punishCore.phase = 'summon';
    punishCore.currentPlayer = '1';
    const marunaCard = CHAMPION_UNITS_YONGHENG.find(card => card.id === 'yongheng-supervisor-maruna')!;
    place(punishCore, { row: 4, col: 2 }, marunaCard, '0');
    punishCore.board[4][4].structure = {
      cardId: 'enemy-gate',
      card: {
        id: 'enemy-gate',
        cardType: 'structure',
        name: '敌方城门',
        faction: 'necromancer',
        cost: 0,
        life: 10,
        isGate: true,
        deckSymbols: [],
      },
      owner: '1',
      position: { row: 4, col: 4 },
      damage: 0,
    };
    punishCore.players['1'].hand.push(unitCard('punish-no-hand-summon', '惩戒无手牌召唤目标', [], {
      faction: 'necromancer',
      cost: 0,
    }));
    const punishSystems = createInteractionSystems();
    const punishState = runPipeline(
      createPipelineState(punishCore, punishSystems),
      punishSystems,
      { type: SW_COMMANDS.SUMMON_UNIT, playerId: '1', payload: { cardId: 'punish-no-hand-summon', position: { row: 4, col: 3 } } },
    );
    expect(punishState.core.board[4][3].unit?.card.id).toBe('punish-no-hand-summon');
    expect(punishState.core.players['1'].hand).toHaveLength(0);
    expect(hasActivePrompt(punishState)).toBe(false);
  });

  it('惩戒在敌方召唤到主管玛鲁娜 2 格内时让召唤者选择弃牌', () => {
    const core = createState();
    core.phase = 'summon';
    core.currentPlayer = '1';
    const marunaCard = CHAMPION_UNITS_YONGHENG.find(card => card.id === 'yongheng-supervisor-maruna')!;
    place(core, { row: 4, col: 2 }, marunaCard, '0');
    core.board[4][4].structure = {
      cardId: 'enemy-gate',
      card: {
        id: 'enemy-gate',
        cardType: 'structure',
        name: '敌方城门',
        faction: 'necromancer',
        cost: 0,
        life: 10,
        isGate: true,
        deckSymbols: [],
      },
      owner: '1',
      position: { row: 4, col: 4 },
      damage: 0,
    };
    core.players['1'].hand.push(
      unitCard('punish-summon', '惩戒召唤目标', [], { faction: 'necromancer', cost: 0 }),
      unitCard('punish-card', '惩戒弃牌', [], { faction: 'necromancer' }),
    );
    const systems = createInteractionSystems();
    let state = runPipeline(
      createPipelineState(core, systems),
      systems,
      { type: SW_COMMANDS.SUMMON_UNIT, playerId: '1', payload: { cardId: 'punish-summon', position: { row: 4, col: 3 } } },
    );
    expect(state.core.board[4][3].unit?.card.id).toBe('punish-summon');
    expect(currentSwType(state)).toBe('yongheng_forced_discard');
    expect(getPromptPlayerId(state)).toBe('1');
    expect(currentOptionIds(state)).toEqual(['card:punish-card']);

    state = respondCurrent(state, systems, '1', 'card:punish-card');
    expect(state.core.players['1'].hand).toHaveLength(0);
    expect(state.core.players['1'].discard.map(card => card.id)).toContain('punish-card');
  });
});
