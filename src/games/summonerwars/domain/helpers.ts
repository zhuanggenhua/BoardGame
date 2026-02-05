/**
 * 召唤师战争 - 领域辅助函数
 */

import type {
  CellCoord,
  PlayerId,
  SummonerWarsCore,
  BoardUnit,
  BoardStructure,
  GamePhase,
} from './types';

import { BOARD_ROWS, BOARD_COLS } from '../config/board';

// ============================================================================
// 常量
// ============================================================================

// 重新导出棋盘尺寸，方便其他模块引用
export { BOARD_ROWS, BOARD_COLS };

/** 魔力范围 */
export const MAGIC_MIN = 0;
export const MAGIC_MAX = 15;

/** 每回合限制 */
export const MAX_MOVES_PER_TURN = 3;
export const MAX_ATTACKS_PER_TURN = 3;
export const MOVE_DISTANCE = 2;
export const RANGED_ATTACK_RANGE = 3;

/** 手牌相关 */
export const HAND_SIZE = 5;

/** 起始魔力 */
export const FIRST_PLAYER_MAGIC = 2;
export const SECOND_PLAYER_MAGIC = 3;

// ============================================================================
// 坐标辅助
// ============================================================================

/** 检查坐标是否在棋盘内 */
export function isValidCoord(coord: CellCoord): boolean {
  return coord.row >= 0 && coord.row < BOARD_ROWS &&
         coord.col >= 0 && coord.col < BOARD_COLS;
}

/** 检查两个坐标是否相邻（不含对角线） */
export function isAdjacent(a: CellCoord, b: CellCoord): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

/** 计算曼哈顿距离 */
export function manhattanDistance(a: CellCoord, b: CellCoord): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/** 获取相邻格子 */
export function getAdjacentCells(coord: CellCoord): CellCoord[] {
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];
  return directions
    .map(d => ({ row: coord.row + d.row, col: coord.col + d.col }))
    .filter(isValidCoord);
}

/** 检查是否在直线上（用于远程攻击） */
export function isInStraightLine(a: CellCoord, b: CellCoord): boolean {
  return a.row === b.row || a.col === b.col;
}

/** 获取两点之间的直线路径（不含起点） */
export function getStraightLinePath(from: CellCoord, to: CellCoord): CellCoord[] {
  if (!isInStraightLine(from, to)) return [];
  
  const path: CellCoord[] = [];
  const dr = Math.sign(to.row - from.row);
  const dc = Math.sign(to.col - from.col);
  
  let current = { row: from.row + dr, col: from.col + dc };
  while (current.row !== to.row || current.col !== to.col) {
    path.push({ ...current });
    current = { row: current.row + dr, col: current.col + dc };
  }
  path.push(to);
  
  return path;
}

// ============================================================================
// 棋盘查询
// ============================================================================

/** 获取格子内容 */
export function getCell(state: SummonerWarsCore, coord: CellCoord) {
  if (!isValidCoord(coord)) return undefined;
  return state.board[coord.row][coord.col];
}

/** 获取格子上的单位 */
export function getUnitAt(state: SummonerWarsCore, coord: CellCoord): BoardUnit | undefined {
  return getCell(state, coord)?.unit;
}

/** 获取格子上的建筑 */
export function getStructureAt(state: SummonerWarsCore, coord: CellCoord): BoardStructure | undefined {
  return getCell(state, coord)?.structure;
}

/** 检查格子是否为空 */
export function isCellEmpty(state: SummonerWarsCore, coord: CellCoord): boolean {
  const cell = getCell(state, coord);
  return !cell?.unit && !cell?.structure;
}

/** 获取玩家的所有单位 */
export function getPlayerUnits(state: SummonerWarsCore, playerId: PlayerId): BoardUnit[] {
  const units: BoardUnit[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = state.board[row][col].unit;
      if (unit && unit.owner === playerId) {
        units.push(unit);
      }
    }
  }
  return units;
}

/** 获取玩家的召唤师 */
export function getSummoner(state: SummonerWarsCore, playerId: PlayerId): BoardUnit | undefined {
  return getPlayerUnits(state, playerId).find(u => u.card.unitClass === 'summoner');
}

/** 获取玩家的城门 */
export function getPlayerGates(state: SummonerWarsCore, playerId: PlayerId): BoardStructure[] {
  const gates: BoardStructure[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const structure = state.board[row][col].structure;
      if (structure && structure.owner === playerId && structure.card.isGate) {
        gates.push(structure);
      }
    }
  }
  return gates;
}

// ============================================================================
// 移动验证
// ============================================================================

/** 检查单位是否可以移动到目标位置 */
export function canMoveTo(
  state: SummonerWarsCore,
  from: CellCoord,
  to: CellCoord
): boolean {
  const unit = getUnitAt(state, from);
  if (!unit) return false;
  
  // 建筑不能移动
  if (getStructureAt(state, from)) return false;
  
  // 目标必须为空
  if (!isCellEmpty(state, to)) return false;
  
  // 距离限制
  const distance = manhattanDistance(from, to);
  if (distance > MOVE_DISTANCE || distance === 0) return false;
  
  // 路径检查（不能穿过其他卡牌）
  if (distance === 2) {
    const dr = to.row - from.row;
    const dc = to.col - from.col;
    if (dr === 0 || dc === 0) {
      // 直线移动：只检查中间格
      const mid = {
        row: from.row + Math.sign(dr),
        col: from.col + Math.sign(dc),
      };
      if (!isCellEmpty(state, mid)) return false;
    } else {
      // L 形移动：任一路径可达即可
      const mid1 = { row: from.row, col: to.col };
      const mid2 = { row: to.row, col: from.col };
      if (!isCellEmpty(state, mid1) && !isCellEmpty(state, mid2)) return false;
    }
  }
  
  return true;
}

/** 获取移动路径（简化版，只处理1-2格移动） */
export function getMovePath(from: CellCoord, to: CellCoord): CellCoord[] {
  const distance = manhattanDistance(from, to);
  if (distance === 1) return [to];
  if (distance === 2) {
    const dr = to.row - from.row;
    const dc = to.col - from.col;
    if (dr === 0 || dc === 0) {
      const mid = {
        row: from.row + Math.sign(dr),
        col: from.col + Math.sign(dc),
      };
      return [mid, to];
    }
    const mid1 = { row: from.row, col: to.col };
    return [mid1, to]; // 简化：默认先走横向
  }
  return [];
}

/** 获取单位可移动的所有位置 */
export function getValidMoveTargets(state: SummonerWarsCore, from: CellCoord): CellCoord[] {
  const targets: CellCoord[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const to = { row, col };
      if (canMoveTo(state, from, to)) {
        targets.push(to);
      }
    }
  }
  return targets;
}

// ============================================================================
// 攻击验证
// ============================================================================

/** 检查是否可以攻击目标 */
export function canAttack(
  state: SummonerWarsCore,
  attacker: CellCoord,
  target: CellCoord
): boolean {
  const attackerUnit = getUnitAt(state, attacker);
  if (!attackerUnit) return false;
  
  const targetUnit = getUnitAt(state, target);
  const targetStructure = getStructureAt(state, target);
  if (!targetUnit && !targetStructure) return false;
  
  // 不能攻击自己的单位/建筑
  const targetOwner = targetUnit?.owner ?? targetStructure?.owner;
  if (targetOwner === attackerUnit.owner) return false;
  
  const distance = manhattanDistance(attacker, target);
  
  if (attackerUnit.card.attackType === 'melee') {
    // 近战：必须相邻
    return distance === 1;
  } else {
    // 远程：最多3格直线
    if (distance > RANGED_ATTACK_RANGE || distance === 0) return false;
    return isInStraightLine(attacker, target);
  }
}

/** 获取单位可攻击的所有目标 */
export function getValidAttackTargets(state: SummonerWarsCore, attacker: CellCoord): CellCoord[] {
  const targets: CellCoord[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const target = { row, col };
      if (canAttack(state, attacker, target)) {
        targets.push(target);
      }
    }
  }
  return targets;
}

/** 获取攻击类型（近战/远程） */
export function getAttackType(
  state: SummonerWarsCore,
  attacker: CellCoord,
  _target: CellCoord
): 'melee' | 'ranged' {
  const attackerUnit = getUnitAt(state, attacker);
  if (!attackerUnit) return 'melee';
  return attackerUnit.card.attackType;
}

// ============================================================================
// 召唤验证
// ============================================================================

/** 获取可召唤的位置（城门相邻的空格） */
export function getValidSummonPositions(state: SummonerWarsCore, playerId: PlayerId): CellCoord[] {
  const gates = getPlayerGates(state, playerId);
  const positions = new Set<string>();
  
  for (const gate of gates) {
    for (const adj of getAdjacentCells(gate.position)) {
      if (isCellEmpty(state, adj)) {
        positions.add(`${adj.row},${adj.col}`);
      }
    }
  }
  
  return Array.from(positions).map(s => {
    const [row, col] = s.split(',').map(Number);
    return { row, col };
  });
}

// ============================================================================
// 建造验证
// ============================================================================

/** 获取玩家的后方区域（后3行） */
export function getPlayerBackRows(playerId: PlayerId): number[] {
  // 数组坐标系：row 0 = 顶部，row 7 = 底部
  // 玩家0在底部（row 5-7），玩家1在顶部（row 0-2）
  if (playerId === '0') {
    return [5, 6, 7]; // 玩家0在底部，后3行是 row 5, 6, 7
  }
  return [0, 1, 2]; // 玩家1在顶部，后3行是 row 0, 1, 2
}

/** 获取可建造的位置 */
export function getValidBuildPositions(state: SummonerWarsCore, playerId: PlayerId): CellCoord[] {
  const positions: CellCoord[] = [];
  const backRows = getPlayerBackRows(playerId);
  const summoner = getSummoner(state, playerId);
  
  // 后3行的空格
  for (const row of backRows) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const coord = { row, col };
      if (isCellEmpty(state, coord)) {
        positions.push(coord);
      }
    }
  }
  
  // 召唤师相邻的空格
  if (summoner) {
    for (const adj of getAdjacentCells(summoner.position)) {
      if (isCellEmpty(state, adj) && !positions.some(p => p.row === adj.row && p.col === adj.col)) {
        positions.push(adj);
      }
    }
  }
  
  return positions;
}

// ============================================================================
// 阶段辅助
// ============================================================================

/** 获取下一个阶段 */
export function getNextPhase(current: GamePhase): GamePhase {
  const phaseOrder: GamePhase[] = ['summon', 'move', 'build', 'attack', 'magic', 'draw'];
  const index = phaseOrder.indexOf(current);
  return phaseOrder[(index + 1) % phaseOrder.length];
}

/** 检查是否为回合最后阶段 */
export function isLastPhase(phase: GamePhase): boolean {
  return phase === 'draw';
}

// ============================================================================
// 魔力辅助
// ============================================================================

/** 限制魔力在有效范围内 */
export function clampMagic(value: number): number {
  return Math.max(MAGIC_MIN, Math.min(MAGIC_MAX, value));
}

/** 检查是否有足够魔力 */
export function hasEnoughMagic(state: SummonerWarsCore, playerId: PlayerId, cost: number): boolean {
  return state.players[playerId].magic >= cost;
}


// ============================================================================
// 手牌辅助
// ============================================================================

/** 计算需要抽的牌数 */
export function getDrawCount(handSize: number): number {
  return Math.max(0, HAND_SIZE - handSize);
}

/** 从牌堆抽牌（返回抽到的牌和剩余牌堆） */
export function drawCards<T>(deck: T[], count: number): { drawn: T[]; remaining: T[] } {
  const actualCount = Math.min(count, deck.length);
  return {
    drawn: deck.slice(0, actualCount),
    remaining: deck.slice(actualCount),
  };
}
