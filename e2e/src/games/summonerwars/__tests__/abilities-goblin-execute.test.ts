/**
 * 召唤师战争 - 洞穴地精 execute 流程补充测试
 *
 * 覆盖 abilities-goblin.test.ts 中缺失的：
 * - grab（抓附）：ACTIVATE_ABILITY 跟随移动
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, PlayerId } from '../domain/types';
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

function createGoblinState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'goblin',
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

function makeGrabber(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '部落抓附手', unitClass: 'common',
    faction: 'goblin', strength: 2, life: 2, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['immobile', 'grab'], deckSymbols: [],
  };
}

function makeAlly(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '友方单位', unitClass: 'common',
    faction: 'goblin', strength: 1, life: 2, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
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
// 抓附 (grab) ACTIVATE_ABILITY 跟随测试
// ============================================================================

describe('部落抓附手 - 抓附 (grab) ACTIVATE_ABILITY', () => {
  it('抓附手跟随移动到目标空格', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const grabber = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'grab',
      sourceUnitId: grabber.instanceId,
      targetPosition: { row: 4, col: 3 },
    });

    // 应有移动事件
    const moveEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_MOVED && (e.payload as any).reason === 'grab'
    );
    expect(moveEvents.length).toBe(1);

    // 抓附手应在 (4,3)
    expect(newState.board[4][3].unit?.cardId).toBe('test-grabber');
    expect(newState.board[4][2].unit).toBeUndefined();
  });

  it('目标位置被占据时验证拒绝', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const grabber = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-blocker',
      card: makeAlly('test-blocker'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'grab',
        sourceUnitId: grabber.instanceId,
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('空');
  });

  it('友方单位移动时触发 GRAB_FOLLOW_REQUESTED', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 抓附手在 (4,2)
    const grabber = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    // 友方单位在 (4,3)，与抓附手相邻
    const mover = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-mover',
      card: makeAlly('test-mover'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';
    state.players['0'].moveCount = 0;

    const { events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 4, col: 4 },
    });

    // 应有 GRAB_FOLLOW_REQUESTED 事件
    const grabEvents = events.filter(e => e.type === SW_EVENTS.GRAB_FOLLOW_REQUESTED);
    expect(grabEvents.length).toBe(1);
    expect((grabEvents[0].payload as any).grabberUnitId).toBe(grabber.instanceId);
    expect((grabEvents[0].payload as any).movedUnitId).toBe(mover.instanceId);
  });
});
