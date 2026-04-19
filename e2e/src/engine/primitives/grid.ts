/**
 * engine/primitives/grid — 通用二维网格工具函数
 *
 * 适用于所有基于二维网格的桌游（战棋、象棋、围棋、塔防等）。
 * 纯函数，无副作用，不依赖任何游戏特定类型。
 */

// ============================================================================
// 类型
// ============================================================================

/** 通用网格坐标 */
export interface GridPosition {
  row: number;
  col: number;
}

/** 网格搜索结果 */
export interface GridSearchResult<T> {
  cell: T;
  position: GridPosition;
}

// ============================================================================
// 坐标工具
// ============================================================================

/** 检查坐标是否在网格边界内 */
export function isValidGridCoord(pos: GridPosition, rows: number, cols: number): boolean {
  return pos.row >= 0 && pos.row < rows && pos.col >= 0 && pos.col < cols;
}

/** 曼哈顿距离 */
export function manhattanDist(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/** 4 方向相邻检查（不含对角线） */
export function isGridAdjacent(a: GridPosition, b: GridPosition): boolean {
  return manhattanDist(a, b) === 1;
}

/** 获取有效的 4 方向相邻坐标列表 */
export function getAdjacentPositions(pos: GridPosition, rows: number, cols: number): GridPosition[] {
  const dirs: GridPosition[] = [
    { row: -1, col: 0 }, { row: 1, col: 0 },
    { row: 0, col: -1 }, { row: 0, col: 1 },
  ];
  return dirs
    .map(d => ({ row: pos.row + d.row, col: pos.col + d.col }))
    .filter(p => isValidGridCoord(p, rows, cols));
}

// ============================================================================
// 网格搜索
// ============================================================================

/**
 * 在二维网格上查找第一个满足条件的单元格
 *
 * @example
 * // 查找 cardId 为 'hero-1' 的单位
 * const result = findOnGrid(core.board, (cell, pos) => cell?.unit?.cardId === 'hero-1');
 * if (result) { console.log(result.cell, result.position); }
 */
export function findOnGrid<T>(
  grid: T[][],
  predicate: (cell: T, position: GridPosition) => boolean,
): GridSearchResult<T> | undefined {
  for (let row = 0; row < grid.length; row++) {
    const rowArr = grid[row];
    if (!rowArr) continue;
    for (let col = 0; col < rowArr.length; col++) {
      const cell = rowArr[col];
      if (cell !== undefined && cell !== null && predicate(cell, { row, col })) {
        return { cell, position: { row, col } };
      }
    }
  }
  return undefined;
}

/**
 * 收集二维网格上所有满足条件的单元格
 *
 * @example
 * // 收集所有属于玩家 '0' 的单位
 * const units = collectOnGrid(core.board, (cell) => cell?.unit?.owner === '0');
 */
export function collectOnGrid<T>(
  grid: T[][],
  predicate: (cell: T, position: GridPosition) => boolean,
): GridSearchResult<T>[] {
  const results: GridSearchResult<T>[] = [];
  for (let row = 0; row < grid.length; row++) {
    const rowArr = grid[row];
    if (!rowArr) continue;
    for (let col = 0; col < rowArr.length; col++) {
      const cell = rowArr[col];
      if (cell !== undefined && cell !== null && predicate(cell, { row, col })) {
        results.push({ cell, position: { row, col } });
      }
    }
  }
  return results;
}

/**
 * 遍历指定位置的 4 方向相邻单元格（自动跳过越界）
 *
 * @example
 * forEachAdjacent(core.board, { row: 3, col: 4 }, (cell, pos) => {
 *   if (cell?.unit?.owner === '1') damageTargets.push(pos);
 * });
 */
export function forEachAdjacent<T>(
  grid: T[][],
  pos: GridPosition,
  callback: (cell: T, position: GridPosition) => void,
): void {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const positions = getAdjacentPositions(pos, rows, cols);
  for (const adjPos of positions) {
    const cell = grid[adjPos.row]?.[adjPos.col];
    if (cell !== undefined && cell !== null) {
      callback(cell, adjPos);
    }
  }
}

// ============================================================================
// 直线路径
// ============================================================================

/** 检查两点是否在同一直线上（同行或同列） */
export function isInStraightGridLine(a: GridPosition, b: GridPosition): boolean {
  return a.row === b.row || a.col === b.col;
}

/**
 * 获取两点之间的直线路径（不含起点，含终点）
 * 仅适用于同行或同列的两点，否则返回空数组
 */
export function getStraightGridPath(from: GridPosition, to: GridPosition): GridPosition[] {
  if (!isInStraightGridLine(from, to)) return [];
  const path: GridPosition[] = [];
  const dr = Math.sign(to.row - from.row);
  const dc = Math.sign(to.col - from.col);
  let current = { row: from.row + dr, col: from.col + dc };
  while (current.row !== to.row || current.col !== to.col) {
    path.push({ ...current });
    current = { row: current.row + dr, col: current.col + dc };
  }
  path.push({ row: to.row, col: to.col });
  return path;
}

// ============================================================================
// BFS 路径寻找
// ============================================================================

/**
 * 格子可通行性判定回调
 * @param pos 待判定的格子坐标
 * @param isDestination 是否为终点（终点和中间格的通行规则可能不同）
 * @returns true 表示可通行
 */
export type GridPassableCheck = (pos: GridPosition, isDestination: boolean) => boolean;

/**
 * BFS 找从 from 到 to 的所有最短路径（不含起点，含终点）
 *
 * 通用实现，通过 isPassable 回调让游戏层决定哪些格子可通行。
 * 适用于战棋移动、践踏穿越、飞行等各种移动模式。
 *
 * @param from 起点
 * @param to 终点
 * @param maxSteps 最大步数
 * @param rows 网格行数
 * @param cols 网格列数
 * @param isPassable 格子可通行性判定
 * @returns 所有最短路径（每条路径不含起点，含终点）
 */
export function findAllShortestGridPaths(
  from: GridPosition,
  to: GridPosition,
  maxSteps: number,
  rows: number,
  cols: number,
  isPassable: GridPassableCheck,
): GridPosition[][] {
  const key = (c: GridPosition) => `${c.row},${c.col}`;
  const dist = new Map<string, number>();
  const parents = new Map<string, GridPosition[]>();
  const queue: GridPosition[] = [from];
  dist.set(key(from), 0);
  let found = false;
  let targetDist = Infinity;

  while (queue.length > 0) {
    const pos = queue.shift()!;
    const d = dist.get(key(pos))!;
    if (d >= maxSteps || d >= targetDist) continue;

    for (const adj of getAdjacentPositions(pos, rows, cols)) {
      const k = key(adj);
      const newDist = d + 1;
      const isDest = adj.row === to.row && adj.col === to.col;

      if (!isPassable(adj, isDest)) continue;

      if (isDest) {
        if (newDist < targetDist) {
          targetDist = newDist;
          dist.set(k, newDist);
          parents.set(k, [pos]);
          found = true;
        } else if (newDist === targetDist) {
          parents.get(k)!.push(pos);
        }
        continue;
      }

      const existingDist = dist.get(k);
      if (existingDist === undefined) {
        dist.set(k, newDist);
        parents.set(k, [pos]);
        queue.push(adj);
      } else if (newDist === existingDist) {
        parents.get(k)!.push(pos);
      }
    }
  }

  if (!found) return [];

  // 回溯所有最短路径
  const results: GridPosition[][] = [];
  const reconstruct = (current: GridPosition, path: GridPosition[]) => {
    if (current.row === from.row && current.col === from.col) {
      results.push([...path].reverse());
      return;
    }
    const pList = parents.get(key(current));
    if (!pList) return;
    for (const p of pList) {
      path.push(current);
      reconstruct(p, path);
      path.pop();
    }
  };
  reconstruct(to, []);

  return results;
}

/**
 * 路径评分回调
 * @param pos 路径上的中间格坐标（不含终点）
 * @returns [enemyScore, friendlyScore] — 敌方得分越高越好，友方得分越低越好
 */
export type GridPathScorer = (pos: GridPosition) => { enemy: number; friendly: number };

/**
 * 从多条路径中选择最优路径
 *
 * 评分规则：
 * 1. 优先选中间格敌方得分最高的路径（最大化穿越收益）
 * 2. 敌方得分相同时，优先选友方得分最低的路径（最小化友伤）
 * 3. 等价时返回第一条路径
 *
 * @param paths 候选路径列表（每条路径不含起点，含终点）
 * @param scorer 对路径中间格（不含终点）评分
 * @returns 最优路径，paths 为空时返回 undefined
 */
export function selectBestGridPath(
  paths: GridPosition[][],
  scorer: GridPathScorer,
): GridPosition[] | undefined {
  if (paths.length === 0) return undefined;

  let bestPath = paths[0];
  let bestEnemy = -1;
  let bestFriendly = Infinity;

  for (const path of paths) {
    const intermediates = path.slice(0, -1); // 不含终点
    let enemy = 0;
    let friendly = 0;
    for (const pos of intermediates) {
      const score = scorer(pos);
      enemy += score.enemy;
      friendly += score.friendly;
    }
    if (enemy > bestEnemy || (enemy === bestEnemy && friendly < bestFriendly)) {
      bestEnemy = enemy;
      bestFriendly = friendly;
      bestPath = path;
    }
  }

  return bestPath;
}
