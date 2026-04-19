/**
 * Cardia 光标主题
 */

import type { CursorTheme } from '../../core/cursor/types';
import { buildCursors, registerCursorThemes } from '../../core/cursor/themes';

const cardiaSvgs = {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path d="M8 4 L22 4 L28 10 L28 24 L14 24 L8 18 Z" fill="#f6e9c8" stroke="#7c4f1d" stroke-width="2" stroke-linejoin="round"/>
        <path d="M22 4 L22 10 L28 10" fill="#ead8af" stroke="#7c4f1d" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="18" cy="15" r="3.5" fill="#c88b2a" stroke="#7c4f1d" stroke-width="1.5"/>
    </svg>`,
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path d="M7 7 L24 14 L16 17 L13 25 Z" fill="#f6e9c8" stroke="#7c4f1d" stroke-width="2" stroke-linejoin="round"/>
        <path d="M14 14 L22 22" stroke="#c88b2a" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect x="8" y="8" width="16" height="16" rx="4" fill="#f6e9c8" stroke="#7c4f1d" stroke-width="2"/>
        <path d="M12 8 L12 24 M16 8 L16 24 M20 8 L20 24" stroke="#c88b2a" stroke-width="1.5"/>
    </svg>`,
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="14" cy="14" r="7" fill="none" stroke="#7c4f1d" stroke-width="2"/>
        <path d="M19 19 L26 26" stroke="#7c4f1d" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M14 10 V18 M10 14 H18" stroke="#c88b2a" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="10" fill="none" stroke="#7c4f1d" stroke-width="2"/>
        <path d="M10 22 L22 10" stroke="#c0392b" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    help: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="10" fill="#f6e9c8" stroke="#7c4f1d" stroke-width="2"/>
        <text x="16" y="22" text-anchor="middle" font-size="16" font-weight="bold" font-family="Arial,sans-serif" fill="#7c4f1d">?</text>
    </svg>`,
};

const baseTheme: CursorTheme = {
    id: 'cardia',
    gameId: 'cardia',
    label: 'Cardia',
    variantLabel: '默认',
    previewSvgs: cardiaSvgs,
    ...buildCursors(cardiaSvgs),
};

registerCursorThemes([baseTheme]);

export default {};
