/**
 * 井字棋 (Tic Tac Toe) 光标主题
 *
 * 使用共享样式模板，无需重复定义 SVG。
 * 变体 1: 霓虹青（共享样式）
 * 变体 2: 霓虹粉（共享样式）
 */

import { registerCursorThemes } from '../../core/cursor/themes';
import { createThemeFromStyle, STYLE_NEON_CYAN, STYLE_NEON_PINK, STYLE_FUTURISTIC_TECH } from '../../core/cursor/cursorStyles';

const meta = { gameId: 'tictactoe', label: '井字棋' };

registerCursorThemes([
    createThemeFromStyle(STYLE_NEON_CYAN, { ...meta, id: 'tictactoe' }),
    createThemeFromStyle(STYLE_NEON_PINK, { ...meta }),
    createThemeFromStyle(STYLE_FUTURISTIC_TECH, { ...meta }),
]);
