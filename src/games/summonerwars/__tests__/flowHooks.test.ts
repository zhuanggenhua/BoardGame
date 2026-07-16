/**
 * 召唤师战争 - FlowHooks 单元测试
 *
 * 覆盖 flowHooks.ts 中的阶段流转逻辑：
 * - onPhaseExit: 攻击阶段不活动惩罚、抽牌阶段自动抽牌与回合结束技能
 * - onPhaseEnter: 回合切换、主动事件弃置、阶段开始技能
 * - getNextPhase: 阶段循环
 * - canAdvance / getActivePlayerId: 基础行为
 */

import { describe, it, expect } from 'vitest';
import { summonerWarsFlowHooks } from '../domain/flowHooks';
import type { SummonerWarsCore, PlayerId, UnitCard, EventCard, BoardUnit, BoardCell, PlayerState, GamePhase } from '../domain/types';
import { SW_EVENTS } from '../domain/types';
import type { MatchState, GameEvent } from '../../../engine/types';
import { generateInstanceId } from '../domain/utils';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import type { RandomFn } from '../../../engine/types';

// ============================================================================
// 辅助
// ============================================================================

function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max * 0.5) || 1,
    range: (min: number, max: number) => Math.floor(min + (max - min) * 0.5),
  };
}

function makeUnitCard(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: `测试单位-${id}`, unitClass: 'common', faction: 'necromancer',
    strength: 2, life: 3, cost: 1, attackType: 'melee', attackRange: 1,
    deckSymbols: [], ...overrides,
  };
}

function makeSummonerCard(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return makeUnitCard(id, { unitClass: 'summoner', life: 7, strength: 3, ...overrides });
}

function makeEventCard(id: string, overrides?: Partial<EventCard>): EventCard {
  return {
    id, cardType: 'event', name: `测试事件-${id}`, cost: 0, playPhase: 'any',
    effect: '测试', deckSymbols: [], faction: 'necromancer', ...overrides,
  };
}

/** 创建最小可用的 core 状态（不走完整初始化，手动构建） */
function createMinimalCore(overrides?: Partial<SummonerWarsCore>): SummonerWarsCore {
  // 棋盘 8行×6列（与 config/board.ts 一致）
  const emptyBoard: BoardCell[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 6 }, () => ({}))
  );

  const defaultPlayer = (id: PlayerId): PlayerState => ({
    id,
    magic: 3,
    hand: [],
    deck: [],
    discard: [],
    activeEvents: [],
    summonerId: `summoner-${id}`,
    moveCount: 0,
    attackCount: 0,
    hasAttackedEnemy: false,
  });

  return {
    board: emptyBoard,
    players: { '0': defaultPlayer('0'), '1': defaultPlayer('1') },
    phase: 'summon' as GamePhase,
    currentPlayer: '0' as PlayerId,
    turnNumber: 1,
    selectedFactions: { '0': 'necromancer', '1': 'necromancer' },
    readyPlayers: { '0': true, '1': true },
    hostPlayerId: '0' as PlayerId,
    hostStarted: true,
    ...overrides,
  };
}

/** 包装为 MatchState */
function wrapState(core: SummonerWarsCore): MatchState<SummonerWarsCore> {
  return {
    core,
    sys: {
      phase: core.phase,
      turnNumber: core.turnNumber,
      activePlayerId: core.currentPlayer,
      undo: { history: [], future: [] },
      prompt: null,
      log: { entries: [] },
      eventStream: { entries: [], nextId: 0 },
      tutorial: { stepIndex: 0, completed: false },
      rematch: { votes: {} },
    },
  } as unknown as MatchState<SummonerWarsCore>;
}

/** 放置单位到棋盘 */
function placeUnit(core: SummonerWarsCore, row: number, col: number, unit: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId }): void {
  const { card, owner, cardId, ...rest } = unit;
  const resolvedCardId = cardId ?? card.id;
  core.board[row][col].unit = {
    instanceId: unit.instanceId ?? generateInstanceId(resolvedCardId),
    cardId: resolvedCardId,
    card,
    owner,
    position: { row, col },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
    ...rest,
  };
}

const dummyCommand = { type: 'ADVANCE_PHASE', payload: {}, playerId: '0' };

// ============================================================================
// getNextPhase 测试
// ============================================================================

describe('FlowHooks - getNextPhase', () => {
  it('按 PHASE_ORDER 循环：summon → move → build → attack → magic → draw → summon', () => {
    const expected: [GamePhase, string][] = [
      ['summon', 'move'],
      ['move', 'build'],
      ['build', 'attack'],
      ['attack', 'magic'],
      ['magic', 'draw'],
      ['draw', 'summon'],
    ];

    for (const [from, expectedNext] of expected) {
      const core = createMinimalCore({ phase: from });
      const state = wrapState(core);
      const next = summonerWarsFlowHooks.getNextPhase({ state, from, command: dummyCommand });
      expect(next, `${from} → ${expectedNext}`).toBe(expectedNext);
    }
  });
});

// ============================================================================
// canAdvance 测试
// ============================================================================

describe('FlowHooks - canAdvance', () => {
  it('始终返回 ok: true', () => {
    const core = createMinimalCore();
    const state = wrapState(core);
    const result = summonerWarsFlowHooks.canAdvance!({
      state,
      from: 'attack',
      command: dummyCommand,
    });
    expect(result).toEqual({ ok: true });
  });
});

// ============================================================================
// getActivePlayerId 测试
// ============================================================================

describe('FlowHooks - getActivePlayerId', () => {
  it('返回 currentPlayer', () => {
    const core = createMinimalCore({ currentPlayer: '1' });
    const state = wrapState(core);
    const result = summonerWarsFlowHooks.getActivePlayerId!({
      state,
      from: 'summon',
      to: 'move',
      command: dummyCommand,
    });
    expect(result).toBe('1');
  });
});

// ============================================================================
// onPhaseExit 测试
// ============================================================================

describe('FlowHooks - onPhaseExit', () => {
  describe('攻击阶段退出', () => {
    it('未攻击敌方 → 召唤师受1点不活动惩罚', () => {
      const core = createMinimalCore({ phase: 'attack', currentPlayer: '0' });
      core.players['0'].hasAttackedEnemy = false;
      // 放置召唤师
      placeUnit(core, 0, 0, {
        card: makeSummonerCard('summoner-0'),
        owner: '0',
      });
      core.players['0'].summonerId = 'summoner-0';

      const state = wrapState(core);
      const result = summonerWarsFlowHooks.onPhaseExit!({
        state, from: 'attack', to: 'magic', command: dummyCommand, random: createTestRandom(),
      }) as PhaseExitResult;

      const damageEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
      expect(damageEvents.length).toBe(1);
      expect(damageEvents[0].payload).toMatchObject({
        position: { row: 0, col: 0 },
        damage: 1,
        reason: 'inaction',
      });
    });

    it('已攻击敌方 → 无惩罚', () => {
      const core = createMinimalCore({ phase: 'attack', currentPlayer: '0' });
      core.players['0'].hasAttackedEnemy = true;
      placeUnit(core, 0, 0, {
        card: makeSummonerCard('summoner-0'),
        owner: '0',
      });
      core.players['0'].summonerId = 'summoner-0';

      const state = wrapState(core);
      const result = summonerWarsFlowHooks.onPhaseExit!({
        state, from: 'attack', to: 'magic', command: dummyCommand, random: createTestRandom(),
      }) as PhaseExitResult;

      const damageEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
      expect(damageEvents.length).toBe(0);
    });

    it('未攻击敌方但召唤师不存在 → 无惩罚事件', () => {
      const core = createMinimalCore({ phase: 'attack', currentPlayer: '0' });
      core.players['0'].hasAttackedEnemy = false;
      // 不放置召唤师

      const state = wrapState(core);
      const result = summonerWarsFlowHooks.onPhaseExit!({
        state, from: 'attack', to: 'magic', command: dummyCommand, random: createTestRandom(),
      }) as PhaseExitResult;

      const damageEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
      expect(damageEvents.length).toBe(0);
    });
  });

  it('flowHalted=true 时重复结束阶段不应重复发射 feed_beast 提示事件', () => {
    const core = createMinimalCore({ phase: 'attack', currentPlayer: '0' });

    const beastCard = makeUnitCard('test-beast', {
      unitClass: 'champion',
      faction: 'goblin',
      strength: 3,
      life: 8,
      abilities: ['feed_beast'],
    });

    placeUnit(core, 3, 2, {
      card: beastCard,
      owner: '0',
    });

    const firstState = wrapState(core);
    const firstResult = summonerWarsFlowHooks.onPhaseExit!({
      state: firstState,
      from: 'attack',
      to: 'magic',
      command: dummyCommand,
      random: createTestRandom(),
    }) as PhaseExitResult;
    const firstAbilityEvents = (firstResult.events ?? []).filter((event) => event.type === SW_EVENTS.ABILITY_TRIGGERED);

    expect(firstResult.halt).toBe(true);
    expect(firstAbilityEvents.some((event) => {
      const payload = event.payload as { actionId?: string };
      return payload.actionId === 'feed_beast_check';
    })).toBe(true);

    const repeatedState = wrapState(core);
    repeatedState.sys.flowHalted = true;
    const repeatedResult = summonerWarsFlowHooks.onPhaseExit!({
      state: repeatedState,
      from: 'attack',
      to: 'magic',
      command: dummyCommand,
      random: createTestRandom(),
    }) as PhaseExitResult;
    const repeatedAbilityEvents = (repeatedResult.events ?? []).filter((event) => event.type === SW_EVENTS.ABILITY_TRIGGERED);

    expect(repeatedResult.halt).toBe(true);
    expect(repeatedAbilityEvents).toHaveLength(0);
  });

  describe('抽牌阶段退出', () => {
    it('手牌不足 HAND_SIZE 时自动抽牌', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      // 手牌2张，牌库10张 → 应抽 5-2=3 张
      core.players['0'].hand = [makeUnitCard('h1'), makeUnitCard('h2')];
      core.players['0'].deck = Array.from({ length: 10 }, (_, i) => makeUnitCard(`d${i}`));

      const state = wrapState(core);
      const result = summonerWarsFlowHooks.onPhaseExit!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as PhaseExitResult;

      const drawEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.CARD_DRAWN);
      expect(drawEvents.length).toBe(1);
      expect(drawEvents[0].payload).toMatchObject({ playerId: '0', count: 3 });
    });

    it('手牌已满 → 不抽牌', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      core.players['0'].hand = Array.from({ length: 5 }, (_, i) => makeUnitCard(`h${i}`));
      core.players['0'].deck = Array.from({ length: 10 }, (_, i) => makeUnitCard(`d${i}`));

      const state = wrapState(core);
      const result = summonerWarsFlowHooks.onPhaseExit!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as PhaseExitResult;

      const drawEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.CARD_DRAWN);
      expect(drawEvents.length).toBe(0);
    });

    it('牌库不足时只抽剩余数量', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      core.players['0'].hand = [makeUnitCard('h1')];
      core.players['0'].deck = [makeUnitCard('d1'), makeUnitCard('d2')]; // 只有2张

      const state = wrapState(core);
      const result = summonerWarsFlowHooks.onPhaseExit!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as PhaseExitResult;

      const drawEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.CARD_DRAWN);
      expect(drawEvents.length).toBe(1);
      const payload = (drawEvents[0] as GameEvent).payload as { count?: number };
      expect(payload.count).toBe(2); // min(4, 2)
    });

    it('牌库为空 → 不抽牌', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      core.players['0'].hand = [makeUnitCard('h1')];
      core.players['0'].deck = [];

      const state = wrapState(core);
      const result = summonerWarsFlowHooks.onPhaseExit!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as PhaseExitResult;

      const drawEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.CARD_DRAWN);
      expect(drawEvents.length).toBe(0);
    });
  });

  describe('非攻击/非抽牌阶段退出', () => {
    it('召唤阶段退出 → 无特殊事件（无阶段结束技能）', () => {
      const core = createMinimalCore({ phase: 'summon', currentPlayer: '0' });
      const state = wrapState(core);
      const result = summonerWarsFlowHooks.onPhaseExit!({
        state, from: 'summon', to: 'move', command: dummyCommand, random: createTestRandom(),
      }) as PhaseExitResult;

      expect(result.events ?? []).toHaveLength(0);
    });
  });
});


// ============================================================================
// onPhaseEnter 测试
// ============================================================================

describe('FlowHooks - onPhaseEnter', () => {
  describe('draw → summon（新回合开始）', () => {
    it('产生 TURN_CHANGED 事件，切换到对方玩家', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      const turnChanged = events.filter(e => e.type === SW_EVENTS.TURN_CHANGED);
      expect(turnChanged.length).toBe(1);
      expect(turnChanged[0].payload).toMatchObject({ from: '0', to: '1' });
    });

    it('弃置新回合玩家的普通主动事件', () => {
      // 当前玩家 0 的 draw 阶段结束，切换到玩家 1 的 summon 阶段
      // 应该弃置玩家 1 的主动事件（规则：主动事件在你回合开始时弃置）
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      const normalEvent = makeEventCard('normal-event-1-1', { isActive: true });
      core.players['1'].activeEvents = [normalEvent];

      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      const discarded = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
      expect(discarded.length).toBe(1);
      expect(discarded[0].payload).toMatchObject({ playerId: '1', cardId: 'normal-event-1-1' });
    });

    it('殉葬火堆有充能时不自动弃置', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      const funeralPyre = makeEventCard('necro-funeral-pyre-1-1', {
        isActive: true,
        charges: 2,
      });
      core.players['1'].activeEvents = [funeralPyre];

      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      const discarded = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
      expect(discarded.length).toBe(0);
      // 也不应有充能变化事件
      const charged = events.filter(e => e.type === SW_EVENTS.FUNERAL_PYRE_CHARGED);
      expect(charged.length).toBe(0);
    });

    it('殉葬火堆无充能时正常弃置', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      const funeralPyre = makeEventCard('necro-funeral-pyre-1-1', {
        isActive: true,
        charges: 0,
      });
      core.players['1'].activeEvents = [funeralPyre];

      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      const discarded = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
      expect(discarded.length).toBe(1);
    });

    it('圣洁审判有充能时消耗1充能代替弃置', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      const holyJudgment = makeEventCard('paladin-holy-judgment-1-1', {
        isActive: true,
        charges: 3,
      });
      core.players['1'].activeEvents = [holyJudgment];

      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      // 不弃置
      const discarded = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
      expect(discarded.length).toBe(0);
      // 充能减1
      const charged = events.filter(e => e.type === SW_EVENTS.FUNERAL_PYRE_CHARGED);
      expect(charged.length).toBe(1);
      expect(charged[0].payload).toMatchObject({
        playerId: '1',
        eventCardId: 'paladin-holy-judgment-1-1',
        charges: 2, // 3 - 1
      });
    });

    it('圣洁审判充能为0时正常弃置', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      const holyJudgment = makeEventCard('paladin-holy-judgment-1-1', {
        isActive: true,
        charges: 0,
      });
      core.players['1'].activeEvents = [holyJudgment];

      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      const discarded = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
      expect(discarded.length).toBe(1);
    });

    it('混合主动事件：普通弃置 + 殉葬火堆保留 + 圣洁审判扣充能', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '0' });
      core.players['1'].activeEvents = [
        makeEventCard('some-event-1-1', { isActive: true }),
        makeEventCard('necro-funeral-pyre-1-2', { isActive: true, charges: 1 }),
        makeEventCard('paladin-holy-judgment-1-3', { isActive: true, charges: 2 }),
      ];

      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      // 普通事件弃置
      const discarded = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
      expect(discarded.length).toBe(1);
      const discardedPayload = (discarded[0] as GameEvent).payload as { cardId?: string };
      expect(discardedPayload.cardId).toBe('some-event-1-1');

      // 圣洁审判扣充能
      const charged = events.filter(e => e.type === SW_EVENTS.FUNERAL_PYRE_CHARGED);
      expect(charged.length).toBe(1);
      const chargedPayload = (charged[0] as GameEvent).payload as { charges?: number };
      expect(chargedPayload.charges).toBe(1); // 2 - 1
    });

    it('无主动事件时只产生 TURN_CHANGED', () => {
      const core = createMinimalCore({ phase: 'draw', currentPlayer: '1' });
      core.players['0'].activeEvents = [];

      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      const turnChanged = events.filter(e => e.type === SW_EVENTS.TURN_CHANGED);
      expect(turnChanged.length).toBe(1);
      expect(turnChanged[0].payload).toMatchObject({ from: '1', to: '0' });

      // 无弃置事件
      const discarded = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
      expect(discarded.length).toBe(0);
    });
  });

  describe('非回合切换的阶段进入', () => {
    it('summon → move 不产生 TURN_CHANGED', () => {
      const core = createMinimalCore({ phase: 'summon', currentPlayer: '0' });
      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'summon', to: 'move', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      const turnChanged = (events ?? []).filter(e => e.type === SW_EVENTS.TURN_CHANGED);
      expect(turnChanged.length).toBe(0);
    });

    it('attack → magic 不产生 TURN_CHANGED', () => {
      const core = createMinimalCore({ phase: 'attack', currentPlayer: '0' });
      const state = wrapState(core);
      const events = summonerWarsFlowHooks.onPhaseEnter!({
        state, from: 'attack', to: 'magic', command: dummyCommand, random: createTestRandom(),
      }) as GameEvent[];

      const turnChanged = (events ?? []).filter(e => e.type === SW_EVENTS.TURN_CHANGED);
      expect(turnChanged.length).toBe(0);
    });
  });
});

// ============================================================================
// initialPhase 测试
// ============================================================================

describe('FlowHooks - initialPhase', () => {
  it('初始阶段为 summon', () => {
    expect(summonerWarsFlowHooks.initialPhase).toBe('summon');
  });
});
