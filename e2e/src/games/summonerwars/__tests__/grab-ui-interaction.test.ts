/**
 * 召唤师战争 - 抓附 UI 交互测试
 * 
 * 测试抓附跟随的 UI 交互流程
 */

import { describe, it, expect } from 'vitest';
import { executeCommand } from '../domain/execute';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import type { SummonerWarsCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { CARD_IDS } from '../domain/ids';

function createGoblinState(): MatchState<SummonerWarsCore> {
  const core: SummonerWarsCore = {
    board: Array(8).fill(null).map(() => Array(12).fill(null).map(() => ({ unit: null, structure: null }))),
    players: {
      '0': {
        faction: 'goblin',
        deck: [],
        hand: [],
        discard: [],
        magic: 5,
        summoner: null,
        moveCount: 0,
        attackCount: 0,
        hasAttackedEnemy: false,
        activeEvents: [],
      },
      '1': {
        faction: 'paladin',
        deck: [],
        hand: [],
        discard: [],
        magic: 5,
        summoner: null,
        moveCount: 0,
        attackCount: 0,
        hasAttackedEnemy: false,
        activeEvents: [],
      },
    },
    phase: 'move',
    currentPlayer: '0',
    turnNumber: 1,
    selectedUnit: null,
    hostPlayerId: '0',
    hostStarted: true,
    selectedFactions: { '0': 'goblin', '1': 'paladin' },
    readyPlayers: {},
  };

  return {
    core,
    sys: {
      gameover: null,
      undo: { snapshots: [], currentIndex: -1 },
      eventStream: { entries: [], nextId: 0 },
      interaction: { queue: [] },
      responseWindow: { isOpen: false, allowedCommands: [], responseAdvanceEvents: [] },
      tutorial: null,
    },
  };
}

function clearArea(state: MatchState<SummonerWarsCore>, rows: number[], cols: number[]) {
  for (const row of rows) {
    for (const col of cols) {
      state.core.board[row][col] = { unit: null, structure: null };
    }
  }
}

describe('抓附 UI 交互', () => {
  it('友方单位移动后触发 GRAB_FOLLOW_REQUESTED 事件', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 放置抓附手
    const grabber = {
      instanceId: 'grabber-1',
      owner: '0' as const,
      position: { row: 4, col: 2 },
      damage: 0,
      boosts: 0,
      card: {
        id: CARD_IDS.GOBLIN_TRIBAL_GRAPPLER,
        name: '部落抓附手',
        faction: 'goblin' as const,
        cardType: 'unit' as const,
        unitClass: 'common' as const,
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        abilities: ['grab'],
        spriteIndex: 0,
      },
    };
    state.core.board[4][2] = { unit: grabber, structure: null };

    // 放置友方单位在抓附手相邻位置
    const ally = {
      instanceId: 'ally-1',
      owner: '0' as const,
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 0,
      card: {
        id: 'goblin-ally-1',
        name: '地精士兵',
        faction: 'goblin' as const,
        cardType: 'unit' as const,
        unitClass: 'common' as const,
        cost: 1,
        strength: 2,
        life: 2,
        move: 2,
        spriteIndex: 0,
      },
    };
    state.core.board[4][3] = { unit: ally, structure: null };

    // 友方单位移动（远离抓附手）
    const events = executeCommand(
      state,
      {
        type: SW_COMMANDS.MOVE_UNIT,
        payload: { from: { row: 4, col: 3 }, to: { row: 3, col: 3 } },
        playerId: '0',
      },
      { random: () => 0.5 }
    );

    // 应该触发 GRAB_FOLLOW_REQUESTED 事件
    const grabEvents = events.filter(e => e.type === SW_EVENTS.GRAB_FOLLOW_REQUESTED);
    expect(grabEvents.length).toBe(1);
    
    const grabEvent = grabEvents[0];
    expect((grabEvent.payload as any).grabberUnitId).toBe(grabber.instanceId);
    expect((grabEvent.payload as any).grabberPosition).toEqual({ row: 4, col: 2 });
    expect((grabEvent.payload as any).movedUnitId).toBe(ally.instanceId);
    expect((grabEvent.payload as any).movedTo).toEqual({ row: 3, col: 3 });
  });

  it('抓附手跟随移动到相邻空格', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 放置抓附手
    const grabber = {
      instanceId: 'grabber-1',
      owner: '0' as const,
      position: { row: 4, col: 2 },
      damage: 0,
      boosts: 0,
      card: {
        id: CARD_IDS.GOBLIN_TRIBAL_GRAPPLER,
        name: '部落抓附手',
        faction: 'goblin' as const,
        cardType: 'unit' as const,
        unitClass: 'common' as const,
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        abilities: ['grab'],
        spriteIndex: 0,
      },
    };
    state.core.board[4][2] = { unit: grabber, structure: null };

    // 执行抓附跟随命令
    const events = executeCommand(
      state,
      {
        type: SW_COMMANDS.ACTIVATE_ABILITY,
        payload: {
          abilityId: 'grab',
          sourceUnitId: grabber.instanceId,
          targetPosition: { row: 3, col: 2 }, // 相邻空格
        },
        playerId: '0',
      },
      { random: () => 0.5 }
    );

    // 应该生成 UNIT_MOVED 事件
    const moveEvents = events.filter(e => e.type === SW_EVENTS.UNIT_MOVED);
    expect(moveEvents.length).toBe(1);
    
    const moveEvent = moveEvents[0];
    expect((moveEvent.payload as any).from).toEqual({ row: 4, col: 2 });
    expect((moveEvent.payload as any).to).toEqual({ row: 3, col: 2 });
    expect((moveEvent.payload as any).unitId).toBe(grabber.instanceId);
  });

  it('抓附手不能跟随到被占据的格子', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 放置抓附手
    const grabber = {
      instanceId: 'grabber-1',
      owner: '0' as const,
      position: { row: 4, col: 2 },
      damage: 0,
      boosts: 0,
      card: {
        id: CARD_IDS.GOBLIN_TRIBAL_GRAPPLER,
        name: '部落抓附手',
        faction: 'goblin' as const,
        cardType: 'unit' as const,
        unitClass: 'common' as const,
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        abilities: ['grab'],
        spriteIndex: 0,
      },
    };
    state.core.board[4][2] = { unit: grabber, structure: null };

    // 目标位置已被占据
    state.core.board[3][2] = {
      unit: {
        instanceId: 'blocker-1',
        owner: '1' as const,
        position: { row: 3, col: 2 },
        damage: 0,
        boosts: 0,
        card: {
          id: 'blocker-card',
          name: '阻挡单位',
          faction: 'paladin' as const,
          cardType: 'unit' as const,
          unitClass: 'common' as const,
          cost: 1,
          strength: 1,
          life: 1,
          move: 1,
          spriteIndex: 0,
        },
      },
      structure: null,
    };

    // 尝试跟随到被占据的格子
    const events = executeCommand(
      state,
      {
        type: SW_COMMANDS.ACTIVATE_ABILITY,
        payload: {
          abilityId: 'grab',
          sourceUnitId: grabber.instanceId,
          targetPosition: { row: 3, col: 2 },
        },
        playerId: '0',
      },
      { random: () => 0.5 }
    );

    // 不应该生成 UNIT_MOVED 事件（验证失败）
    const moveEvents = events.filter(e => e.type === SW_EVENTS.UNIT_MOVED);
    expect(moveEvents.length).toBe(0);
  });

  it('敌方单位移动不触发抓附', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 放置抓附手（玩家0）
    const grabber = {
      instanceId: 'grabber-1',
      owner: '0' as const,
      position: { row: 4, col: 2 },
      damage: 0,
      boosts: 0,
      card: {
        id: CARD_IDS.GOBLIN_TRIBAL_GRAPPLER,
        name: '部落抓附手',
        faction: 'goblin' as const,
        cardType: 'unit' as const,
        unitClass: 'common' as const,
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        abilities: ['grab'],
        spriteIndex: 0,
      },
    };
    state.core.board[4][2] = { unit: grabber, structure: null };

    // 放置敌方单位在抓附手相邻位置
    const enemy = {
      instanceId: 'enemy-1',
      owner: '1' as const,
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 0,
      card: {
        id: 'enemy-card-1',
        name: '敌方单位',
        faction: 'paladin' as const,
        cardType: 'unit' as const,
        unitClass: 'common' as const,
        cost: 1,
        strength: 2,
        life: 2,
        move: 2,
        spriteIndex: 0,
      },
    };
    state.core.board[4][3] = { unit: enemy, structure: null };

    // 敌方单位移动
    state.core.currentPlayer = '1';
    const events = executeCommand(
      state,
      {
        type: SW_COMMANDS.MOVE_UNIT,
        payload: { from: { row: 4, col: 3 }, to: { row: 3, col: 3 } },
        playerId: '1',
      },
      { random: () => 0.5 }
    );

    // 不应该触发 GRAB_FOLLOW_REQUESTED（只对友方单位生效）
    const grabEvents = events.filter(e => e.type === SW_EVENTS.GRAB_FOLLOW_REQUESTED);
    expect(grabEvents.length).toBe(0);
  });
});
