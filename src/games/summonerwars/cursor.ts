/**
 * 召唤师战争 (Summoner Wars) 光标主题
 *
 * 变体 1: 冷蓝钢 — 渐变箭头 + 十字准星
 * 变体 2: 符文魔法 — 尖锐棱角，魔法符文装饰
 */

import type { CursorTheme } from '../../core/cursor/types';
import { buildCursors, registerCursorThemes } from '../../core/cursor/themes';

// --- 冷蓝钢（渐变箭头 + 十字准星） ---
const steelSvgs = {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient></defs><path d="M6 3 L6 26 L12 20 L18 28 L22 26 L16 18 L24 18 Z" fill="url(#sg)" stroke="#334155" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="sp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient></defs><path d="M14 3 C14 3 14 14 14 14 L10 12 C9 11.5 7.5 12 8 13.5 L12 20 L12 27 L22 27 L24 20 C24 20 26 14 26 13 C26 11.5 24 11 23 12 L22 13 C22 12 21 10.5 19.5 11 L19 12 C19 11 17.5 9.5 16.5 10.5 L16 12 L16 3 C16 1.5 14 1.5 14 3 Z" fill="url(#sp)" stroke="#334155" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="sgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient></defs><path d="M8 15 C8 13 10 12 11 13 L11 16 M11 13 C11 11 13 10 14 11 L14 16 M14 11 C14 9 16 9 17 10 L17 16 M17 10 C17 9 19 8.5 20 10 L20 16 L20 22 C20 25 17 28 13 28 C9 28 7 25 7 22 L7 18 C7 16 8 15 8 15 Z" fill="url(#sgr)" stroke="#334155" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="sz" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient></defs><circle cx="13" cy="13" r="9" fill="url(#sz)" stroke="#334155" stroke-width="2"/><line x1="20" y1="20" x2="28" y2="28" stroke="#334155" stroke-width="3" stroke-linecap="round"/><line x1="9" y1="13" x2="17" y2="13" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="13" y1="9" x2="13" y2="17" stroke="#334155" stroke-width="2" stroke-linecap="round"/></svg>`,
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#475569" stroke="#334155" stroke-width="2"/><line x1="8" y1="16" x2="24" y2="16" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/></svg>`,
};
const steel: CursorTheme = {
    id: 'summonerwars', gameId: 'summonerwars', label: '召唤师战争', variantLabel: '冷蓝钢',
    previewSvgs: steelSvgs, ...buildCursors(steelSvgs, { zoomIn: [13, 13] }),
};

// --- 符文魔法风（尖锐棱角，魔法符文装饰） ---
const runeSvgs = {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M8 2 L6 16 L8 18 L4 28 L16 20 L14 18 L26 14 Z" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.5" stroke-linejoin="bevel"/><line x1="10" y1="10" x2="14" y2="14" stroke="#c7d2fe" stroke-width="0.8" opacity="0.6"/></svg>`,
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 2 L12 10 L8 10 L14 18 L12 26 L16 20 L20 26 L18 18 L24 10 L20 10 Z" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.5" stroke-linejoin="bevel"/><circle cx="16" cy="14" r="2" fill="#c7d2fe" opacity="0.8"/></svg>`,
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M8 15 C8 13 10 12 11 13 L11 16 M11 13 C11 11 13 10 14 11 L14 16 M14 11 C14 9 16 9 17 10 L17 16 M17 10 C17 9 19 8.5 20 10 L20 16 L20 22 C20 25 17 28 13 28 C9 28 7 25 7 22 L7 18 C7 16 8 15 8 15 Z" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.5" stroke-linejoin="bevel"/><circle cx="10" cy="8" r="1.5" fill="#c7d2fe" opacity="0.7"/><circle cx="20" cy="6" r="1" fill="#818cf8" opacity="0.6"/></svg>`,
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="13" cy="13" r="9" fill="#1e1b4b" stroke="#818cf8" stroke-width="2"/><line x1="20" y1="20" x2="28" y2="28" stroke="#818cf8" stroke-width="3" stroke-linecap="round"/><line x1="9" y1="13" x2="17" y2="13" stroke="#c7d2fe" stroke-width="2" stroke-linecap="round"/><line x1="13" y1="9" x2="13" y2="17" stroke="#c7d2fe" stroke-width="2" stroke-linecap="round"/></svg>`,
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 2,16 16,30 30,16" fill="#1e1b4b" stroke="#818cf8" stroke-width="2"/><line x1="8" y1="16" x2="24" y2="16" stroke="#f43f5e" stroke-width="3" stroke-linecap="round"/></svg>`,
};
const rune: CursorTheme = {
    id: 'summonerwars-rune', gameId: 'summonerwars', label: '召唤师战争', variantLabel: '符文魔法',
    previewSvgs: runeSvgs, ...buildCursors(runeSvgs, { zoomIn: [13, 13] }),
};

// --- 召唤之灵 (Ethereal Summoner) ---
const etherealSvgs = {
    // 召唤法阵：浮动的魔法圆环与琥珀核心
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <defs>
            <filter id="ethereal-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
            <style>
                @keyframes sw-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .sw-ring { transform-origin: center; animation: sw-rotate 4s linear infinite; }
                .sw-ring-reverse { transform-origin: center; animation: sw-rotate 6s linear infinite reverse; }
            </style>
        </defs>
        <g transform="translate(4,4)">
            {/* 核心光点 */}
            <path d="M12 2 L15 10 L22 12 L15 14 L12 22 L9 14 L2 12 L9 10 Z" fill="#fbbf24" filter="url(#ethereal-glow)"/>
            {/* 魔法外环 */}
            <circle cx="12" cy="12" r="9" fill="none" stroke="#d97706" stroke-width="0.8" stroke-dasharray="2 4" className="sw-ring"/>
            <circle cx="12" cy="12" r="11" fill="none" stroke="#78350f" stroke-width="0.5" stroke-dasharray="6 2" className="sw-ring-reverse"/>
        </g>
    </svg>`,

    // 焦聚之芒：指向性魔力迸发
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <g transform="translate(4,4)">
            {/* 指向光芒 */}
            <path d="M4 2 L20 12 L4 22 L8 12 Z" fill="#fbbf24" filter="url(#ethereal-glow)"/>
            {/* 拖尾粒子 */}
            <circle cx="2" cy="6" r="1.5" fill="#fcd34d">
                <animate attributeName="opacity" values="1;0;1" duration="0.8s" repeatCount="indefinite"/>
            </circle>
            <circle cx="0" cy="12" r="1" fill="#d97706">
                <animate attributeName="opacity" values="0;1;0" duration="1.2s" repeatCount="indefinite"/>
            </circle>
        </g>
    </svg>`,

    // 灵魂羁绊：扩张的魔力力场
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <g transform="translate(4,4)">
            <circle cx="12" cy="12" r="10" fill="none" stroke="#fbbf24" stroke-width="2">
                <animate attributeName="r" values="8;11;8" duration="1s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;0.3;0.8" duration="1s" repeatCount="indefinite"/>
            </circle>
            <path d="M6 12 L18 12 M12 6 L12 18" stroke="#fcd34d" stroke-width="1" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="4" fill="#d97706" opacity="0.6"/>
        </g>
    </svg>`,

    // 真实之眼：魔法门户预览
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="13" cy="13" r="10" fill="rgba(69, 26, 3, 0.4)" stroke="#fbbf24" stroke-width="1.5"/>
        <circle cx="13" cy="13" r="4" fill="#78350f" stroke="#fbbf24" stroke-width="1"/>
        <path d="M11 11 L15 15 M15 11 L11 15" stroke="#fff" stroke-width="0.5" opacity="0.8"/>
        <path d="M21 21 L28 28" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
    </svg>`,

    // 破碎封禁：虚空裂纹
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="11" fill="#451a03" stroke="#7f1d1d" stroke-width="2"/>
        <path d="M10 10 L22 22 M22 10 L10 22" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M12 16 L20 16" stroke="#ef4444" stroke-width="1" opacity="0.5"/>
    </svg>`
};

const ethereal: CursorTheme = {
    id: 'summonerwars-ethereal', gameId: 'summonerwars', label: '召唤师战争', variantLabel: '召唤之灵',
    previewSvgs: etherealSvgs, ...buildCursors(etherealSvgs, { zoomIn: [13, 13] }),
};

registerCursorThemes([steel, rune, ethereal]);
