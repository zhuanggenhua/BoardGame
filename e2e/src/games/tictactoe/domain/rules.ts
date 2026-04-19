/**
 * 井字棋规则（胜负判定）
 * 
 * 公共模块，供 domain/index.ts 和 domain/reducer.ts 复用
 */

import type { PlayerId } from '../../../engine/types';

// ============================================================================
// 胜负判定常量与函数
// ============================================================================

/** 所有获胜位置（行、列、对角线） */
export const WIN_POSITIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // 行
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // 列
    [0, 4, 8], [2, 4, 6],            // 对角线
];

/**
 * 检查是否存在赢家
 * @param cells 棋盘格子数组
 * @returns 赢家 PlayerId 或 null
 */
export function checkWinner(cells: (PlayerId | null)[]): PlayerId | null {
    for (const [a, b, c] of WIN_POSITIONS) {
        if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) {
            return cells[a];
        }
    }
    return null;
}

/**
 * 检查是否平局（所有格子已填满且无赢家）
 * @param cells 棋盘格子数组
 * @returns 是否平局
 */
export function checkDraw(cells: (PlayerId | null)[]): boolean {
    return cells.every(cell => cell !== null);
}
