/**
 * 井字棋 (Tic Tac Toe) 光标主题
 *
 * 未来科技风格，按阵营切换颜色：
 * - P0（X，粉色阵营）→ #e879f9 粉紫
 * - P1（O，青色阵营）→ #22d3ee 青色
 * 未匹配时（旁观者/未知）回退到默认青色。
 */

import type { CursorTheme } from '../../core/cursor/types';
import { registerCursorThemes, buildCursors } from '../../core/cursor/themes';
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

// --- 霓虹手绘（Neon Sketch） ---

const neonSvgs = {
    // 荧光笔
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <defs>
            <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
        </defs>
        <!-- Pen Body -->
        <rect x="12" y="6" width="8" height="18" fill="#22d3ee" stroke="#e0f2fe" stroke-width="1.5"/>
        <!-- Tip -->
        <path d="M12 24 L16 30 L20 24 Z" fill="#22d3ee" stroke="#e0f2fe" stroke-width="1"/>
        <!-- Cap/Clip -->
        <rect x="11" y="6" width="10" height="4" fill="#0891b2" rx="1"/>
        <!-- Glow -->
        <circle cx="16" cy="30" r="3" fill="#22d3ee" opacity="0.5" filter="url(#neon)"/>
    </svg>`,

    // 落笔
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path d="M8 24 L24 8" stroke="#22d3ee" stroke-width="8" stroke-linecap="round"/>
        <path d="M8 24 L24 8" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round"/>
        <path d="M4 28 L8 24" stroke="#e879f9" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    </svg>`,

    // 握笔
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect x="10" y="8" width="12" height="16" rx="4" fill="#22d3ee" stroke="#e0f2fe" stroke-width="1.5"/>
        <line x1="8" y1="14" x2="24" y2="14" stroke="#0891b2" stroke-width="1.5"/>
        <path d="M6 14 L8 16 M26 14 L24 16" stroke="#e879f9" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

    // 检查细节
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path d="M6 6 L10 6 L10 10 M26 6 L22 6 L22 10 M6 26 L10 26 L10 22 M26 26 L22 26 L22 22" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/>
        <circle cx="16" cy="16" r="4" fill="none" stroke="#e879f9" stroke-width="1.5"/>
        <circle cx="16" cy="16" r="1.5" fill="#e879f9"/>
    </svg>`,

    // 禁止
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path d="M8 8 L24 24 M24 8 L8 24" stroke="#f472b6" stroke-width="3" stroke-linecap="round"/>
        <rect x="6" y="6" width="20" height="20" fill="none" stroke="#e0f2fe" stroke-width="1.5" stroke-dasharray="4 4"/>
    </svg>`
};

const neonSketch: CursorTheme = {
    id: 'tictactoe-neon', gameId: 'tictactoe', label: '井字棋', variantLabel: '霓虹手绘',
    previewSvgs: neonSvgs, ...buildCursors(neonSvgs, { zoomIn: [16, 16] }),
};

// 保持原有的科技风格作为选项，增加新的霓虹手绘
registerCursorThemes([base, neonSketch]);
