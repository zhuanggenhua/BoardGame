/**
 * 共享光标样式模板库
 *
 * 游戏的 cursor.ts 通过 createThemeFromStyle() 工厂函数引用样式模板。
 * 新增共享样式只需在本文件添加一个 CursorStyleTemplate 对象并导出。
 */

import type { CursorTheme, CursorPreviewSvgs } from './types';
import { buildCursors } from './themes';

/** 共享样式模板：SVG 定义 + 热点配置 */
export interface CursorStyleTemplate {
    styleId: string;
    styleLabel: string;
    svgs: CursorPreviewSvgs & { default: string; pointer: string; grabbing?: string; zoomIn?: string; notAllowed?: string; help?: string };
    hotspots?: { grabbing?: [number, number]; zoomIn?: [number, number]; notAllowed?: [number, number]; help?: [number, number] };
}

/** 从共享样式模板创建游戏光标主题 */
export function createThemeFromStyle(
    style: CursorStyleTemplate,
    meta: { gameId: string; label: string; id?: string; variantLabel?: string },
): CursorTheme {
    return {
        id: meta.id ?? `${meta.gameId}-${style.styleId}`,
        gameId: meta.gameId,
        label: meta.label,
        variantLabel: meta.variantLabel ?? style.styleLabel,
        previewSvgs: style.svgs,
        ...buildCursors(style.svgs, style.hotspots),
    };
}

// ===========================================================================
// 未来科技 SVG 工厂
// ===========================================================================

/**
 * 生成未来科技风格的 SVG 集合。
 *
 * 设计语言（参考图片"未来科技金属光标"）：
 * - 深灰金属渐变填充（#4a5568 → #1a202c）
 * - 彩色描边 + 双层高斯模糊发光 filter
 * - 箭头内部高光线（半透明描边）
 * - notAllowed：圆环 + 横杠（明确的禁止符号）
 *
 * @param color 主色调（描边 + 发光），如 '#00e5ff'（青）或 '#e879f9'（粉）
 * @param filterId SVG filter id 前缀，同页面多实例时避免冲突
 */
function makeFuturisticSvgs(color: string, filterId: string): CursorStyleTemplate['svgs'] {
    const glow = `<filter id="${filterId}-g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    const metalGrad = (id: string) =>
        `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4a5568"/><stop offset="55%" stop-color="#2d3748"/><stop offset="100%" stop-color="#1a202c"/></linearGradient>`;
    const hi = `rgba(${hexToRgb(color)},0.45)`;

    return {
        // 箭头：金属渐变填充 + 彩色描边 + 内部高光线
        default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs>${metalGrad(`${filterId}-mg`)}${glow}</defs><path d="M6 3 L6 26 L12 20 L18 28 L22 26 L16 18 L24 18 Z" fill="url(#${filterId}-mg)" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" filter="url(#${filterId}-g)"/><path d="M8 6 L8 21 L11 18" fill="none" stroke="${hi}" stroke-width="0.9" stroke-linecap="round"/></svg>`,
        // 手型：金属填充 + 彩色描边 + 指尖高光点
        pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs>${metalGrad(`${filterId}-pg`)}${glow}</defs><path d="M14 3 C14 3 14 14 14 14 L10 12 C9 11.5 7.5 12 8 13.5 L12 20 L12 27 L22 27 L24 20 C24 20 26 14 26 13 C26 11.5 24 11 23 12 L22 13 C22 12 21 10.5 19.5 11 L19 12 C19 11 17.5 9.5 16.5 10.5 L16 12 L16 3 C16 1.5 14 1.5 14 3 Z" fill="url(#${filterId}-pg)" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" filter="url(#${filterId}-g)"/><line x1="14" y1="5" x2="14" y2="12" stroke="${hi}" stroke-width="0.8" stroke-linecap="round"/><line x1="16" y1="4" x2="16" y2="11" stroke="${hi}" stroke-width="0.8" stroke-linecap="round"/></svg>`,
        // 抓取：收拢手 + 彩色描边
        grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs>${glow}</defs><path d="M8 15 C8 13 10 12 11 13 L11 16 M11 13 C11 11 13 10 14 11 L14 16 M14 11 C14 9 16 9 17 10 L17 16 M17 10 C17 9 19 8.5 20 10 L20 16 L20 22 C20 25 17 28 13 28 C9 28 7 25 7 22 L7 18 C7 16 8 15 8 15 Z" fill="rgba(45,55,72,0.92)" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" filter="url(#${filterId}-g)"/></svg>`,
        // 放大：双圆环准星 + 十字线
        zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs>${glow}</defs><circle cx="13" cy="13" r="8.5" fill="none" stroke="${color}" stroke-width="1.6" filter="url(#${filterId}-g)"/><circle cx="13" cy="13" r="5" fill="none" stroke="${hi}" stroke-width="0.8"/><line x1="13" y1="4" x2="13" y2="7" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/><line x1="13" y1="19" x2="13" y2="22" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/><line x1="4" y1="13" x2="7" y2="13" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/><line x1="19" y1="13" x2="22" y2="13" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/><line x1="10" y1="13" x2="16" y2="13" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/><line x1="13" y1="10" x2="13" y2="16" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/><line x1="20" y1="20" x2="28" y2="28" stroke="${color}" stroke-width="2.5" stroke-linecap="round" filter="url(#${filterId}-g)"/></svg>`,
        // 禁止：圆环 + 横杠（明确禁止符）
        notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs>${glow}</defs><circle cx="16" cy="16" r="11" fill="rgba(26,32,44,0.65)" stroke="${color}" stroke-width="1.6" filter="url(#${filterId}-g)"/><line x1="8" y1="16" x2="24" y2="16" stroke="#ff1744" stroke-width="2.8" stroke-linecap="round" filter="url(#${filterId}-g)"/></svg>`,
        // 帮助：圆环 + 问号
        help: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs>${glow}</defs><circle cx="16" cy="16" r="11" fill="rgba(26,32,44,0.65)" stroke="${color}" stroke-width="1.6" filter="url(#${filterId}-g)"/><text x="16" y="21" text-anchor="middle" font-size="16" font-weight="bold" font-family="Arial,sans-serif" fill="${color}">?</text></svg>`,
    };
}

/** hex 颜色转 'r,g,b' 字符串，用于 rgba() */
function hexToRgb(hex: string): string {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// ===========================================================================
// 共享样式模板库
// ===========================================================================

/**
 * 未来科技 — 默认青色版本（保底样式）
 *
 * 深灰金属渐变 + 青色 #00e5ff 描边 + 发光 filter
 * 参考：图片"未来科技金属光标"六边形蜂巢风格
 */
export const STYLE_FUTURISTIC_TECH: CursorStyleTemplate = {
    styleId: 'futuristic-tech',
    styleLabel: '未来科技',
    svgs: makeFuturisticSvgs('#00e5ff', 'ft'),
    hotspots: { zoomIn: [13, 13] },
};

/**
 * 创建未来科技风格的阵营专属子主题 CSS 值集合。
 *
 * 用于 CursorTheme.playerThemes，按 playerID 映射不同颜色。
 * 其他游戏可直接调用此函数构建自己的阵营光标。
 *
 * @param color 阵营主色（如 '#e879f9' 粉色、'#22d3ee' 青色）
 * @param filterId SVG filter id 前缀（每个阵营用不同前缀避免冲突）
 */
export function createFuturisticPlayerTheme(
    color: string,
    filterId: string,
): Pick<import('./types').CursorTheme, 'default' | 'pointer' | 'grabbing' | 'grab' | 'zoomIn' | 'notAllowed' | 'help' | 'previewSvgs'> {
    const svgs = makeFuturisticSvgs(color, filterId);
    const built = buildCursors(svgs, { zoomIn: [13, 13] });
    return { ...built, previewSvgs: svgs };
}
