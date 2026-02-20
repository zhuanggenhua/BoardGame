/**
 * 井字棋 (Tic Tac Toe) 光标主题
 *
 * 未来科技风格，按阵营切换颜色：
 * - P0（X，粉色阵营）→ #e879f9 粉紫
 * - P1（O，青色阵营）→ #22d3ee 青色
 * 未匹配时（旁观者/未知）回退到默认青色。
 */

import { registerCursorThemes } from '../../core/cursor/themes';
import { createThemeFromStyle, createFuturisticPlayerTheme, STYLE_FUTURISTIC_TECH } from '../../core/cursor/cursorStyles';

const base = createThemeFromStyle(STYLE_FUTURISTIC_TECH, {
    id: 'tictactoe',
    gameId: 'tictactoe',
    label: '井字棋',
});

// 按阵营注入专属颜色，与棋子风格一致：X=粉色，O=青色
base.playerThemes = {
    '0': createFuturisticPlayerTheme('#e879f9', 'tt-p0'), // X 粉色
    '1': createFuturisticPlayerTheme('#22d3ee', 'tt-p1'), // O 青色
};

registerCursorThemes([base]);
