/**
 * 召唤师战争 - 领域核心
 * 
 * 入口文件，组装 execute/reduce/validate 并导出 DomainCore
 */

import type { DomainCore } from '../../../engine/types';
import type {
  SummonerWarsCore,
  PlayerId,
  PlayerState,
  GamePhase,
  BoardCell,
  FactionId,
} from './types';
import { BOARD_ROWS, BOARD_COLS, FIRST_PLAYER_MAGIC, SECOND_PLAYER_MAGIC, getSummoner } from './helpers';
import { executeCommand } from './execute';
import { reduceEvent } from './reduce';
import { validateCommand } from './validate';

// 重新导出类型和常量
export type { SummonerWarsCore } from './types';
export { SW_COMMANDS, SW_EVENTS } from './types';
export { getPhaseDisplayName } from './execute';

// ============================================================================
// 初始化辅助
// ============================================================================

/** 创建空棋盘 */
function createEmptyBoard(): BoardCell[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => ({}))
  );
}

/** 创建初始玩家状态 */
function createPlayerState(playerId: PlayerId, isFirst: boolean): PlayerState {
  return {
    id: playerId,
    magic: isFirst ? FIRST_PLAYER_MAGIC : SECOND_PLAYER_MAGIC,
    hand: [],
    deck: [],
    discard: [],
    activeEvents: [],
    summonerId: '',
    moveCount: 0,
    attackCount: 0,
    hasAttackedEnemy: false,
  };
}

// ============================================================================
// 领域核心实现
// ============================================================================

export const SummonerWarsDomain: DomainCore<SummonerWarsCore> = {
  gameId: 'summonerwars',

  /**
   * 初始化游戏状态
   * 初始阶段为选角，棋盘为空，等待双方选择阵营后再初始化牌组
   */
  setup: (_playerIds, _random, setupData?) => {
    const board = createEmptyBoard();

    // 重赛先手轮换：优先使用 setupData 中的 firstPlayerId
    const firstPlayer = (typeof setupData?.firstPlayerId === 'string' && ['0', '1'].includes(setupData.firstPlayerId))
        ? setupData.firstPlayerId as PlayerId
        : '0' as PlayerId;

    const players: Record<PlayerId, PlayerState> = {
      '0': createPlayerState('0', firstPlayer === '0'),
      '1': createPlayerState('1', firstPlayer === '1'),
    };

    return {
      board,
      players,
      phase: 'summon' as GamePhase,
      currentPlayer: firstPlayer,
      startingPlayerId: firstPlayer,
      turnNumber: 1,
      selectedFactions: { '0': 'unselected', '1': 'unselected' } as Record<PlayerId, FactionId | 'unselected'>,
      readyPlayers: { '0': false, '1': false } as Record<PlayerId, boolean>,
      hostPlayerId: '0' as PlayerId,
      hostStarted: false,
      abilityUsageCount: {},
      unitKillCountThisTurn: {},
    };
  },

  /** 执行命令并返回事件 */
  execute: (state, command, random) => executeCommand(state, command, random),

  /** 应用事件到状态 */
  reduce: (core, event) => reduceEvent(core, event),

  /** 验证命令合法性 */
  validate: (state, command) => validateCommand(state, command),

  /** 判定游戏是否结束 */
  isGameOver: (core) => {
    // 选角阶段棋盘为空，不判定结束
    if (!core.hostStarted) return undefined;

    const summoner0 = getSummoner(core, '0');
    const summoner1 = getSummoner(core, '1');

    if (!summoner0 && !summoner1) {
      return { winner: core.currentPlayer };
    }
    if (!summoner0) return { winner: '1' };
    if (!summoner1) return { winner: '0' };
    return undefined;
  },
};
