/**
 * 大杀四方 (Smash Up) 光标主题
 *
 * 变体 1: 漫画手绘 — 粗描边圆润，黄色调
 * 变体 2: 爆裂涂鸦 — 不规则锯齿边缘，荧光绿喷漆风
 * 变体 3: 美漫波普 — 硬朗线条，高对比撞色，阴影偏移
 */

import type { CursorTheme } from '../../core/cursor/types';
import { buildCursors, registerCursorThemes } from '../../core/cursor/themes';

// --- 漫画手绘风（粗描边，圆润） ---
const comicSvgs = {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 3 L6 26 L12 20 L18 28 L22 26 L16 18 L24 18 Z" fill="#fef3c7" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/></svg>`,
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M14 3 C14 3 14 14 14 14 L10 12 C9 11.5 7.5 12 8 13.5 L12 20 L12 27 L22 27 L24 20 C24 20 26 14 26 13 C26 11.5 24 11 23 12 L22 13 C22 12 21 10.5 19.5 11 L19 12 C19 11 17.5 9.5 16.5 10.5 L16 12 L16 3 C16 1.5 14 1.5 14 3 Z" fill="#fef3c7" stroke="#1e293b" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M8 15 C8 13 10 12 11 13 L11 16 M11 13 C11 11 13 10 14 11 L14 16 M14 11 C14 9 16 9 17 10 L17 16 M17 10 C17 9 19 8.5 20 10 L20 16 L20 22 C20 25 17 28 13 28 C9 28 7 25 7 22 L7 18 C7 16 8 15 8 15 Z" fill="#fef3c7" stroke="#1e293b" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="13" cy="13" r="9" fill="#fef3c7" stroke="#1e293b" stroke-width="2"/><line x1="20" y1="20" x2="28" y2="28" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/><line x1="9" y1="13" x2="17" y2="13" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/><line x1="13" y1="9" x2="13" y2="17" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#ef4444" stroke="#1e293b" stroke-width="2"/><line x1="9" y1="9" x2="23" y2="23" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/><line x1="23" y1="9" x2="9" y2="23" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/></svg>`,
};
const comic: CursorTheme = {
    id: 'smashup', gameId: 'smashup', label: '大杀四方', variantLabel: '漫画手绘',
    previewSvgs: comicSvgs, ...buildCursors(comicSvgs, { zoomIn: [13, 13] }),
};

// --- 爆裂涂鸦风（不规则锯齿，荧光喷漆感） ---
const graffitiSvgs = {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M7 2 L5 10 L8 12 L5 18 L7 20 L4 26 L14 21 L12 19 L18 17 L15 15 L24 16 L10 8 Z" fill="#84cc16" stroke="#1a2e05" stroke-width="1.8" stroke-linejoin="bevel"/><circle cx="9" cy="14" r="1" fill="#facc15" opacity="0.8"/><circle cx="13" cy="10" r="0.8" fill="#facc15" opacity="0.6"/></svg>`,
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M15 2 L13 6 L10 5 L12 12 L8 14 L14 17 L11 22 L15 20 L14 28 L18 22 L22 24 L20 18 L26 16 L19 14 L22 8 L17 10 Z" fill="#84cc16" stroke="#1a2e05" stroke-width="1.5" stroke-linejoin="bevel"/><circle cx="16" cy="14" r="2" fill="#facc15" stroke="#1a2e05" stroke-width="0.8"/></svg>`,
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M8 15 C8 13 10 12 11 13 L11 16 M11 13 C11 11 13 10 14 11 L14 16 M14 11 C14 9 16 9 17 10 L17 16 M17 10 C17 9 19 8.5 20 10 L20 16 L20 22 C20 25 17 28 13 28 C9 28 7 25 7 22 L7 18 C7 16 8 15 8 15 Z" fill="#84cc16" stroke="#1a2e05" stroke-width="2" stroke-linejoin="bevel"/><line x1="4" y1="12" x2="7" y2="15" stroke="#facc15" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/><line x1="3" y1="17" x2="6" y2="19" stroke="#facc15" stroke-width="1" stroke-linecap="round" opacity="0.7"/></svg>`,
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M5 5 L9 3 L13 5 L17 3 L21 5 L23 9 L21 13 L23 17 L21 21 L17 23 L13 21 L9 23 L5 21 L3 17 L5 13 L3 9 Z" fill="#84cc16" stroke="#1a2e05" stroke-width="1.5" stroke-linejoin="bevel"/><line x1="22" y1="22" x2="29" y2="29" stroke="#1a2e05" stroke-width="3" stroke-linecap="round"/><line x1="9" y1="13" x2="17" y2="13" stroke="#1a2e05" stroke-width="2" stroke-linecap="round"/><line x1="13" y1="9" x2="13" y2="17" stroke="#1a2e05" stroke-width="2" stroke-linecap="round"/></svg>`,
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M4 8 L8 4 L16 6 L24 4 L28 8 L26 16 L28 24 L24 28 L16 26 L8 28 L4 24 L6 16 Z" fill="#dc2626" stroke="#1a2e05" stroke-width="2" stroke-linejoin="bevel"/><line x1="10" y1="10" x2="22" y2="22" stroke="#1a2e05" stroke-width="3" stroke-linecap="round"/><line x1="22" y1="10" x2="10" y2="22" stroke="#1a2e05" stroke-width="3" stroke-linecap="round"/></svg>`,
};
const graffiti: CursorTheme = {
    id: 'smashup-graffiti', gameId: 'smashup', label: '大杀四方', variantLabel: '爆裂涂鸦',
    previewSvgs: graffitiSvgs, ...buildCursors(graffitiSvgs, { zoomIn: [13, 13] }),
};

// --- 美漫波普风（Pop Art Vigilante） ---
// 关键词：硬朗线条，高对比，偏移阴影，速度感
const popArtSvgs = {
    // 闪电箭头
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <!-- Shadow (Offset) -->
        <path d="M6 6 L15 28 L19 21 L27 21 L6 6 Z" fill="#000000" />
        <!-- Main Body -->
        <path d="M4 4 L13 26 L17 19 L25 19 L4 4 Z" fill="#FFE600" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>
        <!-- Highlight -->
        <path d="M7 6 L14 20" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

    // 漫画英雄指
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <!-- Shadow -->
        <path d="M14 6 C14 6 15 15 15 15 L12 14 C12 14 10 14 10 15 L14 22 L14 29 L24 29 L26 22 L24 16 L23 15 L20 15 L20 13 L17 12 L17 6 Z" fill="#000000" transform="translate(2, 2)"/>
        <!-- Glove Body -->
        <path d="M14 4 C14 4 15 13 15 13 L12 12 C12 12 10 12 10 13 L14 20 L14 27 L24 27 L26 20 L24 14 L23 13 L20 13 L20 11 L17 10 L17 4 Z" fill="#FFE600" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>
        <!-- Detail Lines -->
        <line x1="17" y1="13" x2="17" y2="20" stroke="#000000" stroke-width="1.5"/>
        <line x1="20" y1="13" x2="20" y2="20" stroke="#000000" stroke-width="1.5"/>
        <!-- Action Lines -->
        <path d="M8 2 L10 6 M14 1 L15 4 M5 7 L8 9" stroke="#FF2A2A" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

    // 强力抓取（拳头）
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
         <!-- Shadow -->
         <path d="M10 12 C10 10 12 9 13 10 L13 13 M13 10 C13 8 15 7 16 8 L16 13 M16 8 C16 6 18 6 19 7 L19 13 M19 7 C19 6 21 5 22 7 L22 13 L22 19 C22 22 19 25 15 25 C11 25 9 22 9 19 L9 15 C9 13 10 12 10 12 Z" fill="#000000" stroke="#000000" stroke-width="4" transform="translate(2, 2)"/>
         <!-- Fist -->
         <path d="M10 12 C10 10 12 9 13 10 L13 13 M13 10 C13 8 15 7 16 8 L16 13 M16 8 C16 6 18 6 19 7 L19 13 M19 7 C19 6 21 5 22 7 L22 13 L22 19 C22 22 19 25 15 25 C11 25 9 22 9 19 L9 15 C9 13 10 12 10 12 Z" fill="#FFE600" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>
         <!-- Impact -->
         <path d="M6 14 L4 12 M6 18 L3 19 M24 22 L27 24" stroke="#FF2A2A" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

    // 发现（放大镜）
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
         <circle cx="15" cy="15" r="9" fill="#000000" transform="translate(2, 2)"/>
         <line x1="22" y1="22" x2="30" y2="30" stroke="#000000" stroke-width="5" stroke-linecap="round" transform="translate(2, 2)"/>
         
         <circle cx="13" cy="13" r="9" fill="#AEEEEE" stroke="#000000" stroke-width="2.5"/>
         <path d="M10 10 L12 9" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
         <line x1="20" y1="20" x2="28" y2="28" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
         <path d="M13 10 L13 16 M10 13 L16 13" stroke="#000000" stroke-width="2"/>
    </svg>`,

    // 禁止（停止符号）
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="12" fill="#000000" transform="translate(2, 2)"/>
        <circle cx="16" cy="16" r="12" fill="#FF2A2A" stroke="#000000" stroke-width="2.5"/>
        <line x1="10" y1="10" x2="22" y2="22" stroke="#000000" stroke-width="3" stroke-linecap="round"/>
        <line x1="22" y1="10" x2="10" y2="22" stroke="#000000" stroke-width="3" stroke-linecap="round"/>
    </svg>`
};

const popArt: CursorTheme = {
    id: 'smashup-popart', gameId: 'smashup', label: '大杀四方', variantLabel: '美漫波普',
    previewSvgs: popArtSvgs, ...buildCursors(popArtSvgs, { zoomIn: [13, 13] }),
};

registerCursorThemes([comic, graffiti, popArt]);
