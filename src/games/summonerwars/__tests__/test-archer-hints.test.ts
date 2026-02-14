/**
 * 快速验证：弓箭手在移动阶段是否能获得青色波纹 hint
 */
import { describe, it, expect } from 'vitest';
import { getSummonerWarsUIHints } from '../domain/uiHints';
import { createInitializedCore } from './test-helpers';
import type { SummonerWarsCore, PlayerId, UnitCard, BoardUnit } from '../domain/types';
import type { RandomFn } from '../../../engine/types';

function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

function makeArcher(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '边境弓箭手', unitClass: 'common',
    faction: 'barbaric', strength: 2, life: 4, cost: 2,
    attackType: 'ranged', attackRange: 3,
    abilities: ['prepare', 'rapid_fire'], deckSymbols: [],
  };
}

function clearArea(state: SummonerWarsCore, rows: number[], cols: number[]) {
  for (const r of rows) {
    for (const c of cols) {
      state.board[r][c].unit = undefined;
      state.board[r][c].structure = undefined;
    }
  }
}

function placeUnit(
  state: SummonerWarsCore,
  pos: { row: number; col: number },
  overrides: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId }
): BoardUnit {
  const unit: BoardUnit = {
    cardId: overrides.cardId ?? `test-${pos.row}-${pos.col}`,
    card: overrides.card,
    owner: overrides.owner as PlayerId,
    position: pos,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
  };
  state.board[pos.row][pos.col].unit = unit;
  return unit;
}

describe('弓箭手青色波纹测试', () => {
  it('移动阶段未移动的弓箭手应该有 ability hint', () => {
    const state = createInitializedCore(['0', '1'], createTestRandom(), {
      faction0: 'barbaric',
      faction1: 'necromancer',
    });
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    state.phase = 'move';
    state.currentPlayer = '0' as PlayerId;

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-archer',
      card: makeArcher('test-archer'),
      owner: '0' as PlayerId,
      hasMoved: false,
    });

    const hints = getSummonerWarsUIHints(state, {
      types: ['ability'],
      playerId: '0',
      phase: 'move',
    });

    console.log('Ability hints:', JSON.stringify(hints, null, 2));
    
    const archerHint = hints.find(h => h.entityId === 'test-archer');
    expect(archerHint).toBeDefined();
    expect(archerHint?.type).toBe('ability');
    expect(archerHint?.actions).toContain('prepare');
  });

  it('移动阶段已移动的弓箭手不应该有 ability hint', () => {
    const state = createInitializedCore(['0', '1'], createTestRandom(), {
      faction0: 'barbaric',
      faction1: 'necromancer',
    });
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);
    state.phase = 'move';
    state.currentPlayer = '0' as PlayerId;

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-archer-moved',
      card: makeArcher('test-archer-moved'),
      owner: '0' as PlayerId,
      hasMoved: true,
    });

    const hints = getSummonerWarsUIHints(state, {
      types: ['ability'],
      playerId: '0',
      phase: 'move',
    });

    console.log('Hints for moved archer:', JSON.stringify(hints, null, 2));
    
    const archerHint = hints.find(h => h.entityId === 'test-archer-moved');
    expect(archerHint).toBeUndefined();
  });
});
