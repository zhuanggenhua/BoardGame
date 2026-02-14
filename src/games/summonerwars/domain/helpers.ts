/**
 * 召唤师战争 - 领域辅助函数
 */

import type {
  CellCoord,
  PlayerId,
  SummonerWarsCore,
  BoardUnit,
  BoardStructure,
  BoardCell,
  GamePhase,
} from './types';

import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import {
  isValidGridCoord,
  manhattanDist,
  isGridAdjacent,
  getAdjacentPositions as getAdjacentPositionsEngine,
  findOnGrid,
  collectOnGrid,
} from '../../../engine/primitives/grid';
import { getBaseCardId, CARD_IDS } from './ids';

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
  return isValidGridCoord(coord, BOARD_ROWS, BOARD_COLS);
}

/** 检查两个坐标是否相邻（不含对角线） */
export function isAdjacent(a: CellCoord, b: CellCoord): boolean {
  return isGridAdjacent(a, b);
}

/** 计算曼哈顿距离 */
export function manhattanDistance(a: CellCoord, b: CellCoord): number {
  return manhattanDist(a, b);
}

/** 获取相邻格子 */
export function getAdjacentCells(coord: CellCoord): CellCoord[] {
  return getAdjacentPositionsEngine(coord, BOARD_ROWS, BOARD_COLS);
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

/** 检查格子是否为空（越界坐标返回 false） */
export function isCellEmpty(state: SummonerWarsCore, coord: CellCoord): boolean {
  if (!isValidCoord(coord)) return false;
  const cell = getCell(state, coord);
  return !cell?.unit && !cell?.structure;
}

/** 获取玩家的所有单位 */
export function getPlayerUnits(state: SummonerWarsCore, playerId: PlayerId): BoardUnit[] {
  return collectOnGrid<BoardCell>(state.board, (cell) => !!cell.unit && cell.unit.owner === playerId)
    .map(r => r.cell.unit!);
}

/** 获取玩家的召唤师 */
export function getSummoner(state: SummonerWarsCore, playerId: PlayerId): BoardUnit | undefined {
  return getPlayerUnits(state, playerId).find(u => u.card.unitClass === 'summoner');
}

/** 按 cardId 查找单位在棋盘上的位置 */
export function findUnitPosition(state: SummonerWarsCore, cardId: string): CellCoord | null {
  const result = findOnGrid<BoardCell>(state.board, (cell) => !!cell.unit && cell.unit.cardId === cardId);
  return result ? result.position : null;
}

/** 按 cardId 查找棋盘上的单位（私有，仅返回 BoardUnit，不含位置） */
function findUnitByCardId(state: SummonerWarsCore, cardId: string): BoardUnit | undefined {
  const result = findOnGrid<BoardCell>(state.board, (cell) => !!cell.unit && cell.unit.cardId === cardId);
  return result ? result.cell.unit! : undefined;
}

/** 获取玩家的城门 */
export function getPlayerGates(state: SummonerWarsCore, playerId: PlayerId): BoardStructure[] {
  return collectOnGrid<BoardCell>(state.board, (cell) =>
    !!cell.structure && cell.structure.owner === playerId && !!cell.structure.card.isGate
  ).map(r => r.cell.structure!);
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

/**
 * 获取移动路径上被穿过的单位位置（用于践踏等穿越伤害）
 * 只返回中间格上的单位（不含终点），包括敌方和己方士兵（踩踏不区分敌我）
 */
export function getPassedThroughUnitPositions(
  state: SummonerWarsCore,
  from: CellCoord,
  to: CellCoord,
): CellCoord[] {
  const distance = manhattanDistance(from, to);
  if (distance <= 1) return []; // 1格移动没有中间格

  // 直线移动：中间格明确
  if (from.row === to.row || from.col === to.col) {
    const path = getStraightLinePath(from, to);
    // 不含终点的中间格
    const intermediates = path.slice(0, -1);
    return intermediates.filter(pos => {
      const u = getUnitAt(state, pos);
      // 踩踏对所有被穿过的士兵造成伤害，不区分敌我
      return u != null;
    });
  }

  // L 形移动（2格）：两条可能路径
  if (distance === 2) {
    const mid1 = { row: from.row, col: to.col };
    const mid2 = { row: to.row, col: from.col };
    const unit1 = isValidCoord(mid1) ? getUnitAt(state, mid1) : undefined;
    const unit2 = isValidCoord(mid2) ? getUnitAt(state, mid2) : undefined;
    // 踩踏不区分敌我，返回所有中间格上的单位
    const result: CellCoord[] = [];
    if (unit1) result.push(mid1);
    if (unit2) result.push(mid2);
    return result;
  }

  return [];
}

/** 获取单位可移动的所有位置 */
export function getValidMoveTargets(state: SummonerWarsCore, from: CellCoord): CellCoord[] {
  return collectOnGrid<BoardCell>(state.board, (_, pos) => canMoveTo(state, from, pos))
    .map(r => r.position);
}

// ============================================================================
// 攻击验证
// ============================================================================

/**
 * 检查远程攻击路径是否畅通（无遮挡）
 * 
 * 规则：远程攻击路径上的中间格子不能有任何卡牌（单位或建筑）。
 * 例外：友方护城墙（frost-parapet）允许友方远程攻击穿过。
 */
export function isRangedPathClear(
  state: SummonerWarsCore,
  attacker: CellCoord,
  target: CellCoord,
  attackerOwner: PlayerId,
): boolean {
  const path = getStraightLinePath(attacker, target);
  // path 包含终点，中间格子是 path 去掉最后一个
  for (let i = 0; i < path.length - 1; i++) {
    const pos = path[i];
    const unit = getUnitAt(state, pos);
    const structure = getStructureAt(state, pos);
    if (unit) return false; // 任何单位都遮挡
    if (structure) {
      // 友方护城墙允许穿过
      const isOwnParapet = structure.owner === attackerOwner
        && getBaseCardId(structure.card.id) === CARD_IDS.FROST_PARAPET;
      if (!isOwnParapet) return false;
    }
  }
  return true;
}

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
    // 远程：最多3格直线，路径必须无遮挡
    if (distance > RANGED_ATTACK_RANGE || distance === 0) return false;
    if (!isInStraightLine(attacker, target)) return false;
    return isRangedPathClear(state, attacker, target, attackerUnit.owner);
  }
}

/** 获取单位可攻击的所有目标 */
export function getValidAttackTargets(state: SummonerWarsCore, attacker: CellCoord): CellCoord[] {
  return collectOnGrid<BoardCell>(state.board, (_, pos) => canAttack(state, attacker, pos))
    .map(r => r.position);
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

/** 获取可召唤的位置（城门 + 活体传送门相邻的空格） */
export function getValidSummonPositions(state: SummonerWarsCore, playerId: PlayerId): CellCoord[] {
  const gates = getPlayerGates(state, playerId);
  const positions = new Set<string>();
  
  // 真实建筑城门
  for (const gate of gates) {
    for (const adj of getAdjacentCells(gate.position)) {
      if (isCellEmpty(state, adj)) {
        positions.add(`${adj.row},${adj.col}`);
      }
    }
  }

  // 活体传送门（living_gate 技能的单位，如寒冰魔像，含交缠颂歌共享）
  const livingGateUnits = getPlayerUnits(state, playerId).filter(u =>
    getUnitAbilities(u, state).includes('living_gate')
  );
  for (const lgUnit of livingGateUnits) {
    for (const adj of getAdjacentCells(lgUnit.position)) {
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
// 阶段可操作性检查
// ============================================================================

/** 检查手牌中是否有可在指定阶段打出的事件卡（含 playPhase='any'）且魔力足够 */
function hasPlayableEvents(player: { hand: readonly import('./types').Card[]; magic: number }, phase: GamePhase): boolean {
  return player.hand.some(
    c => c.cardType === 'event'
      && ((c as import('./types').EventCard).playPhase === phase || (c as import('./types').EventCard).playPhase === 'any')
      && (c as import('./types').EventCard).cost <= player.magic
  );
}

/** 检查当前阶段是否有可用操作（用于自动跳过） */
export function hasAvailableActions(state: SummonerWarsCore, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  const phase = state.phase;

  switch (phase) {
    case 'summon': {
      const unitCards = player.hand.filter(c => c.cardType === 'unit');
      const positions = getValidSummonPositions(state, playerId);
      const canSummonUnit = unitCards.length > 0 && 
        positions.length > 0 && 
        unitCards.some(c => (c as import('./types').UnitCard).cost <= player.magic);
      return canSummonUnit || hasPlayableEvents(player, phase);
    }
    case 'move': {
      const canMoveUnit = player.moveCount < MAX_MOVES_PER_TURN &&
        getPlayerUnits(state, playerId).some(u => !u.hasMoved && !isImmobile(u, state) && getValidMoveTargetsEnhanced(state, u.position).length > 0);
      return canMoveUnit || hasPlayableEvents(player, phase);
    }
    case 'build': {
      const structureCards = player.hand.filter(c => c.cardType === 'structure');
      const positions = getValidBuildPositions(state, playerId);
      const canBuildStructure = structureCards.length > 0 && 
        positions.length > 0 && 
        structureCards.some(c => (c as import('./types').StructureCard).cost <= player.magic);
      return canBuildStructure || hasPlayableEvents(player, phase);
    }
    case 'attack': {
      const units = getPlayerUnits(state, playerId);
      const normalAttackAvailable = player.attackCount < MAX_ATTACKS_PER_TURN &&
        units.some(u => !u.hasAttacked && getValidAttackTargetsEnhanced(state, u.position).length > 0);
      const ferocityAvailable = units.some(u => 
        hasFerocityAbility(u, state) && !u.hasAttacked && getValidAttackTargetsEnhanced(state, u.position).length > 0
      );
      // 有额外攻击的单位（连续射击/群情激愤）不受3次限制
      const extraAttackAvailable = units.some(u =>
        (u.extraAttacks ?? 0) > 0 && !u.hasAttacked && getValidAttackTargetsEnhanced(state, u.position).length > 0
      );
      return normalAttackAvailable || ferocityAvailable || extraAttackAvailable || hasPlayableEvents(player, phase);
    }
    case 'magic': {
      // 魔力阶段总是可以手动跳过（弃牌是可选的）
      return true;
    }
    case 'draw': {
      // 抽牌阶段是自动的，直接跳过
      return false;
    }
    default:
      return true;
  }
}

// ============================================================================
// 手牌辅助
// ============================================================================

/** 计算需要抽的牌数 */
export function getDrawCount(handSize: number): number {
  return Math.max(0, HAND_SIZE - handSize);
}


// ============================================================================
// 技能增强的移动/攻击验证
// ============================================================================

import { abilityRegistry } from './abilities';

/**
 * 获取单位自身技能（base + temp），不含状态依赖的共享技能
 * 用于测试、纯单位查询等不需要游戏状态的场景
 */
export function getUnitBaseAbilities(unit: BoardUnit): string[] {
  const base = unit.card.abilities ?? [];
  const temp = unit.tempAbilities ?? [];
  return temp.length > 0 ? [...base, ...temp] : [...base];
}

/**
 * 获取单位在当前游戏状态下的所有有效技能（base + temp + 交缠颂歌共享）
 * state 必传，确保交缠颂歌等状态依赖逻辑始终生效
 * 所有规则判定/执行/验证必须使用此函数
 */
export function getUnitAbilities(unit: BoardUnit, state: SummonerWarsCore): string[] {
  const result = getUnitBaseAbilities(unit);

  // 交缠颂歌：检查主动事件区是否有交缠颂歌标记了本单位
  for (const pid of ['0', '1'] as PlayerId[]) {
    const player = state.players[pid];
    if (!player) continue;
    for (const ev of player.activeEvents) {
      if (getBaseCardId(ev.id) !== CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT) continue;
      if (!ev.entanglementTargets) continue;
      const [t1, t2] = ev.entanglementTargets;
      let partnerAbilities: string[] | undefined;
      if (t1 === unit.cardId) {
        // 本单位是目标1，获取目标2的基础技能（含 tempAbilities）
        const partner = findUnitByCardId(state, t2);
        if (partner) partnerAbilities = getUnitBaseAbilities(partner);
      } else if (t2 === unit.cardId) {
        // 本单位是目标2，获取目标1的基础技能（含 tempAbilities）
        const partner = findUnitByCardId(state, t1);
        if (partner) partnerAbilities = getUnitBaseAbilities(partner);
      }
      if (partnerAbilities) {
        for (const a of partnerAbilities) {
          if (!result.includes(a)) result.push(a);
        }
      }
    }
  }

  return result;
}

/**
 * 检查风暴侵袭主动事件的移动减少量
 * 任一玩家主动事件区有 trickster-storm-assault 时，所有单位减少移动1格
 */
export function getStormAssaultReduction(state: SummonerWarsCore): number {
  for (const pid of ['0', '1'] as PlayerId[]) {
    const player = state.players[pid];
    if (!player) continue;
    for (const ev of player.activeEvents) {
      if (getBaseCardId(ev.id) === CARD_IDS.TRICKSTER_STORM_ASSAULT) return 1;
    }
  }
  return 0;
}

/**
 * 检查单位是否有禁足（immobile）技能（需要游戏状态）
 */
export function isImmobile(unit: BoardUnit, state: SummonerWarsCore): boolean {
  return getUnitAbilities(unit, state).includes('immobile');
}

/**
 * 检查单位自身是否有禁足技能（不含状态依赖共享，用于测试）
 */
export function isImmobileBase(unit: BoardUnit): boolean {
  return getUnitBaseAbilities(unit).includes('immobile');
}

/**
 * 检查单位是否有冲锋（charge）技能（需要游戏状态）
 */
export function hasChargeAbility(unit: BoardUnit, state: SummonerWarsCore): boolean {
  return getUnitAbilities(unit, state).includes('charge');
}

/**
 * 检查单位自身是否有冲锋技能（不含状态依赖共享，用于测试）
 */
export function hasChargeAbilityBase(unit: BoardUnit): boolean {
  return getUnitBaseAbilities(unit).includes('charge');
}

/**
 * 检查单位是否有凶残（ferocity）技能（需要游戏状态）
 */
export function hasFerocityAbility(unit: BoardUnit, state: SummonerWarsCore): boolean {
  return getUnitAbilities(unit, state).includes('ferocity');
}

/**
 * 检查单位自身是否有凶残技能（不含状态依赖共享，用于测试）
 */
export function hasFerocityAbilityBase(unit: BoardUnit): boolean {
  return getUnitBaseAbilities(unit).includes('ferocity');
}

/**
 * 获取单位的移动增强参数
 * 返回 { extraDistance, canPassThrough, canPassStructures, isChargeUnit, isImmobileUnit } 
 */
export function getUnitMoveEnhancements(
  state: SummonerWarsCore,
  unitPos: CellCoord
): { extraDistance: number; canPassThrough: boolean; canPassStructures: boolean; isChargeUnit: boolean; isImmobileUnit: boolean; damageOnPassThrough: number } {
  const unit = getUnitAt(state, unitPos);
  if (!unit) return { extraDistance: 0, canPassThrough: false, canPassStructures: false, isChargeUnit: false, isImmobileUnit: false, damageOnPassThrough: 0 };

  // 禁足检查
  if (isImmobile(unit, state)) {
    return { extraDistance: 0, canPassThrough: false, canPassStructures: false, isChargeUnit: false, isImmobileUnit: true, damageOnPassThrough: 0 };
  }

  let extraDistance = 0;
  let canPassThrough = false;
  let canPassStructures = false;
  let damageOnPassThrough = 0;
  const abilities = getUnitAbilities(unit, state);
  const isChargeUnit = hasChargeAbility(unit, state);

  for (const abilityId of abilities) {
    const def = abilityRegistry.get(abilityId);
    if (!def) continue;

    if (def.trigger === 'onMove') {
      for (const effect of def.effects) {
        if (effect.type === 'extraMove') {
          extraDistance += effect.value;
          if (effect.canPassThrough === 'all' || effect.canPassThrough === 'units') {
            canPassThrough = true;
          }
          if (effect.canPassThrough === 'structures' || effect.canPassThrough === 'all') {
            canPassStructures = true;
          }
          if (effect.damageOnPassThrough) {
            damageOnPassThrough = Math.max(damageOnPassThrough, effect.damageOnPassThrough);
          }
        }
        // 速度强化：每点充能+1移动，最多+5
        if (effect.type === 'custom' && effect.actionId === 'speed_up_extra_move') {
          const boosts = unit.boosts ?? 0;
          extraDistance += Math.min(boosts, 5);
        }
      }
    }
  }

  // 浮空术光环：检查2格内是否有葛拉克（aerial_strike）
  if (unit.card.unitClass === 'common') {
    const aerialUnit = findOnGrid<BoardCell>(state.board, (cell, pos) =>
      !!cell.unit && cell.unit.owner === unit.owner && cell.unit.cardId !== unit.cardId
      && getUnitAbilities(cell.unit, state).includes('aerial_strike')
      && manhattanDistance(unitPos, pos) <= 2
    );
    if (aerialUnit) {
      // 获得飞行：额外移动1格 + 穿越
      extraDistance = Math.max(extraDistance, 1);
      canPassThrough = true;
      canPassStructures = true;
    }
  }

  // 风暴侵袭：任一玩家主动事件区有 storm-assault 时，所有单位减少移动1格
  const stormReduction = getStormAssaultReduction(state);
  extraDistance -= stormReduction;

  return { extraDistance, canPassThrough, canPassStructures, isChargeUnit, isImmobileUnit: false, damageOnPassThrough };
}

/**
 * 计算单位的动态移动增强量（用于 UI 显示）
 * 只返回外部因素（光环、事件卡等）带来的增强，排除印刷技能和蓝点已展示的速度强化
 */
export function getDynamicMoveBoostForDisplay(
  state: SummonerWarsCore,
  unitPos: CellCoord
): number {
  const unit = getUnitAt(state, unitPos);
  if (!unit) return 0;

  const enhancements = getUnitMoveEnhancements(state, unitPos);
  if (enhancements.isImmobileUnit) return 0;

  const abilityIds = getUnitAbilities(unit, state);

  // 扣除印刷技能自带的 extraDistance
  let innateExtra = 0;
  for (const id of abilityIds) {
    if (id === 'flying' || id === 'swift' || id === 'climb') {
      innateExtra += 1;
    }
  }

  let dynamicExtra = enhancements.extraDistance - innateExtra;
  // 速度强化的 boosts 已由蓝点展示，扣除
  if (abilityIds.includes('speed_up') && unit.boosts > 0) {
    dynamicExtra = Math.max(0, dynamicExtra - Math.min(unit.boosts, 5));
  }

  return Math.max(0, dynamicExtra);
}

/**
 * 增强版移动验证（考虑飞行/迅捷/攀爬/冲锋/禁足等技能）
 */
export function canMoveToEnhanced(
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

  const { extraDistance, canPassThrough, canPassStructures, isChargeUnit, isImmobileUnit } = getUnitMoveEnhancements(state, from);

  // 禁足：不能移动
  if (isImmobileUnit) return false;

  const distance = manhattanDistance(from, to);
  if (distance === 0) return false;

  // 冲锋单位：可以选择正常移动或冲锋（1-4格直线）
  if (isChargeUnit) {
    // 冲锋路径：必须直线且路径无阻挡（不能穿过单位/建筑）
    if (isInStraightLine(from, to) && distance >= 1 && distance <= 4) {
      const path = getStraightLinePath(from, to);
      // 检查路径上所有中间格（不含终点）是否为空
      const intermediates = path.slice(0, -1);
      const pathClear = intermediates.every(p => isCellEmpty(state, p));
      if (pathClear) return true;
    }
    // 也允许正常移动（2格+增强）
  }

  const maxDistance = MOVE_DISTANCE + extraDistance;
  if (distance > maxDistance) return false;

  // 飞行单位可以穿过其他卡牌（单位+建筑）
  if (canPassThrough) return true;

  // 非飞行单位的路径检查
  if (distance === 2) {
    const dr = to.row - from.row;
    const dc = to.col - from.col;
    if (dr === 0 || dc === 0) {
      const mid = {
        row: from.row + Math.sign(dr),
        col: from.col + Math.sign(dc),
      };
      if (!isCellEmptyOrPassable(state, mid, canPassStructures)) return false;
    } else {
      const mid1 = { row: from.row, col: to.col };
      const mid2 = { row: to.row, col: from.col };
      if (!isCellEmptyOrPassable(state, mid1, canPassStructures) && !isCellEmptyOrPassable(state, mid2, canPassStructures)) return false;
    }
  }

  // 3格以上移动（飞行/迅捷/攀爬/速度强化等）的路径检查
  if (distance >= 3 && !canPassThrough) {
    return hasValidPath(state, from, to, maxDistance, false, canPassStructures);
  }

  return true;
}

/**
 * 检查格子是否可通过（空格，或攀爬时可穿过建筑）
 */
function isCellEmptyOrPassable(state: SummonerWarsCore, coord: CellCoord, canPassStructures: boolean): boolean {
  const cell = getCell(state, coord);
  if (!cell) return false;
  if (cell.unit) return false;
  if (cell.structure && !canPassStructures) return false;
  return true;
}

/**
 * BFS 路径检查（用于3格以上移动）
 */
function hasValidPath(
  state: SummonerWarsCore,
  from: CellCoord,
  to: CellCoord,
  maxSteps: number,
  canPassThrough: boolean,
  canPassStructures: boolean = false
): boolean {
  const visited = new Set<string>();
  const queue: { pos: CellCoord; steps: number }[] = [{ pos: from, steps: 0 }];
  const key = (c: CellCoord) => `${c.row},${c.col}`;

  visited.add(key(from));

  while (queue.length > 0) {
    const { pos, steps } = queue.shift()!;
    if (steps >= maxSteps) continue;

    for (const adj of getAdjacentCells(pos)) {
      if (!isValidCoord(adj)) continue;
      const k = key(adj);
      if (visited.has(k)) continue;
      visited.add(k);

      if (adj.row === to.row && adj.col === to.col) {
        return isCellEmpty(state, adj);
      }

      // 中间格必须可通过
      if (canPassThrough || isCellEmptyOrPassable(state, adj, canPassStructures)) {
        queue.push({ pos: adj, steps: steps + 1 });
      }
    }
  }

  return false;
}

/**
 * 增强版获取可移动位置（考虑技能）
 */
export function getValidMoveTargetsEnhanced(state: SummonerWarsCore, from: CellCoord): CellCoord[] {
  return collectOnGrid<BoardCell>(state.board, (_, pos) => canMoveToEnhanced(state, from, pos))
    .map(r => r.position);
}

/**
 * 获取单位的有效攻击范围（需要游戏状态，考虑远射等共享技能）
 */
export function getEffectiveAttackRange(unit: BoardUnit, state: SummonerWarsCore): number {
  const abilities = getUnitAbilities(unit, state);
  if (abilities.includes('ranged')) {
    return 4; // 远射：4格
  }
  return unit.card.attackRange;
}

/**
 * 获取单位自身的有效攻击范围（不含状态依赖共享，用于测试）
 */
export function getEffectiveAttackRangeBase(unit: BoardUnit): number {
  const abilities = getUnitBaseAbilities(unit);
  if (abilities.includes('ranged')) {
    return 4;
  }
  return unit.card.attackRange;
}

/**
 * 增强版攻击验证（考虑远射等技能）
 */
export function canAttackEnhanced(
  state: SummonerWarsCore,
  attacker: CellCoord,
  target: CellCoord
): boolean {
  const attackerUnit = getUnitAt(state, attacker);
  if (!attackerUnit) return false;

  const targetUnit = getUnitAt(state, target);
  const targetStructure = getStructureAt(state, target);
  if (!targetUnit && !targetStructure) return false;

  const targetOwner = targetUnit?.owner ?? targetStructure?.owner;
  if (targetOwner === attackerUnit.owner) return false;

  const distance = manhattanDistance(attacker, target);

  if (attackerUnit.card.attackType === 'melee') {
    return distance === 1;
  } else {
    const range = getEffectiveAttackRange(attackerUnit, state);
    if (distance > range || distance === 0) return false;
    if (!isInStraightLine(attacker, target)) return false;
    return isRangedPathClear(state, attacker, target, attackerUnit.owner);
  }
}

/**
 * 增强版获取可攻击目标（考虑技能）
 */
export function getValidAttackTargetsEnhanced(state: SummonerWarsCore, attacker: CellCoord): CellCoord[] {
  return collectOnGrid<BoardCell>(state.board, (_, pos) => canAttackEnhanced(state, attacker, pos))
    .map(r => r.position);
}

/**
 * 检查单位是否有稳固（stable）技能（需要游戏状态）
 */
export function hasStableAbility(unit: BoardUnit, state: SummonerWarsCore): boolean {
  return getUnitAbilities(unit, state).includes('stable');
}

/**
 * 检查单位自身是否有稳固技能（不含状态依赖共享，用于测试）
 */
export function hasStableAbilityBase(unit: BoardUnit): boolean {
  return getUnitBaseAbilities(unit).includes('stable');
}

/**
 * 计算推拉后的目标位置
 * direction: 'push' = 远离 source, 'pull' = 靠近 source
 * 返回 null 表示无法推拉（出界或被阻挡）
 *
 * 对角线方向选择策略：当 source 和 target 处于对角线位置（|dr| == |dc|）时，
 * 规则要求强制移动沿单一方向（水平或垂直），此时优先选择行方向（垂直）。
 * 这是确定性的 tie-breaking 规则，确保同一局面下推拉结果一致。
 * 桌游中此场景由当前回合玩家自由选择，但数字版为简化交互采用自动选择。
 */
export function calculatePushPullPosition(
  state: SummonerWarsCore,
  targetPos: CellCoord,
  sourcePos: CellCoord,
  distance: number,
  direction: 'push' | 'pull'
): CellCoord | null {
  // 计算方向向量
  const dr = targetPos.row - sourcePos.row;
  const dc = targetPos.col - sourcePos.col;

  // 推拉必须沿直线（水平或垂直）
  // 如果不在直线上，选择主要方向（对角线时优先行方向）
  let moveRow = 0;
  let moveCol = 0;

  if (direction === 'push') {
    // 推：远离 source
    if (Math.abs(dr) >= Math.abs(dc)) {
      moveRow = dr > 0 ? 1 : -1;
    } else {
      moveCol = dc > 0 ? 1 : -1;
    }
  } else {
    // 拉：靠近 source
    if (Math.abs(dr) >= Math.abs(dc)) {
      moveRow = dr > 0 ? -1 : 1;
    } else {
      moveCol = dc > 0 ? -1 : 1;
    }
  }

  // 逐格移动
  let currentPos = { ...targetPos };
  for (let i = 0; i < distance; i++) {
    const nextPos = {
      row: currentPos.row + moveRow,
      col: currentPos.col + moveCol,
    };

    if (!isValidCoord(nextPos)) return currentPos.row === targetPos.row && currentPos.col === targetPos.col ? null : currentPos;
    if (!isCellEmpty(state, nextPos)) return currentPos.row === targetPos.row && currentPos.col === targetPos.col ? null : currentPos;

    currentPos = nextPos;
  }

  return currentPos;
}

/**
 * 获取推拉的所有可能目标位置（用于 UI 选择推或拉）
 */
export function getPushPullOptions(
  state: SummonerWarsCore,
  targetPos: CellCoord,
  sourcePos: CellCoord,
  distance: number
): { push: CellCoord | null; pull: CellCoord | null } {
  return {
    push: calculatePushPullPosition(state, targetPos, sourcePos, distance, 'push'),
    pull: calculatePushPullPosition(state, targetPos, sourcePos, distance, 'pull'),
  };
}

/**
 * 检查单位是否有缠斗（rebound/entangle）技能（需要游戏状态）
 */
export function hasEntangleAbility(unit: BoardUnit, state: SummonerWarsCore): boolean {
  const abilities = getUnitAbilities(unit, state);
  return abilities.includes('rebound') || abilities.includes('entangle');
}

/**
 * 获取离开某位置时会触发缠斗的相邻单位
 */
export function getEntangleUnits(
  state: SummonerWarsCore,
  leavingPos: CellCoord,
  leavingOwner: PlayerId
): BoardUnit[] {
  const units: BoardUnit[] = [];
  for (const adj of getAdjacentCells(leavingPos)) {
    if (!isValidCoord(adj)) continue;
    const unit = getUnitAt(state, adj);
    if (unit && unit.owner !== leavingOwner && hasEntangleAbility(unit, state)) {
      units.push(unit);
    }
  }
  return units;
}

/**
 * 检查单位是否有迷魂（evasion）技能（需要游戏状态）
 */
export function hasEvasionAbility(unit: BoardUnit, state: SummonerWarsCore): boolean {
  return getUnitAbilities(unit, state).includes('evasion');
}

/**
 * 获取攻击者相邻的具有迷魂技能的敌方单位
 */
export function getEvasionUnits(
  state: SummonerWarsCore,
  attackerPos: CellCoord,
  attackerOwner: PlayerId
): BoardUnit[] {
  const units: BoardUnit[] = [];
  for (const adj of getAdjacentCells(attackerPos)) {
    if (!isValidCoord(adj)) continue;
    const unit = getUnitAt(state, adj);
    if (unit && unit.owner !== attackerOwner && hasEvasionAbility(unit, state)) {
      units.push(unit);
    }
  }
  return units;
}
