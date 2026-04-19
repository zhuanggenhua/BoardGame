/**
 * 光标主题注册表
 *
 * 游戏通过 registerCursorThemes() 自注册光标主题。
 * manifest 中 cursorTheme 引用默认变体的 id。
 *
 * 自动注册机制：每个游戏在自己的 cursor.ts 中定义并注册主题，
 * 由 src/games/cursorRegistry.ts 统一 import 触发注册。
 * 新增游戏只需：① 创建 cursor.ts ② 在 cursorRegistry.ts 加一行 import。
 */

import type { CursorTheme } from './types';

// ---------------------------------------------------------------------------
// SVG 工具函数
// ---------------------------------------------------------------------------

/**
 * 给 SVG 注入白色外描边光晕 filter，提升任意背景下的可见性。
 * 原理：feMorphology 膨胀图形轮廓 → 填充白色 → 叠在原图下方。
 * 注入位置：在 <svg> 标签内最前面插入 <defs> + 用 <g filter> 包裹原有内容。
 * 由 GameCursorProvider 在高对比模式下按需调用，不自动注入。
 */
export function injectOutlineFilter(svg: string): string {
    const filterId = 'cur-outline';
    const filterDef = `<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%"><feMorphology operator="dilate" radius="1.2" in="SourceAlpha" result="expanded"/><feFlood flood-color="white" result="color"/><feComposite in="color" in2="expanded" operator="in" result="outline"/><feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    // 把 <svg ...> 之后的内容包进 <g filter>
    return svg.replace(/(<svg[^>]*>)/, `$1${filterDef}<g filter="url(#${filterId})">`).replace(/<\/svg>/, '</g></svg>');
}

export function svgCursor(svg: string, hotX: number, hotY: number, fallback: string): string {
    const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
    return `url("data:image/svg+xml,${encoded}") ${hotX} ${hotY}, ${fallback}`;
}

export function buildCursors(
    svgs: { default: string; pointer: string; grabbing?: string; zoomIn?: string; notAllowed?: string; help?: string },
    hotspots?: { grabbing?: [number, number]; zoomIn?: [number, number]; notAllowed?: [number, number]; help?: [number, number] },
) {
    const gh = hotspots?.grabbing ?? [14, 16];
    const zh = hotspots?.zoomIn ?? [16, 16];
    const nh = hotspots?.notAllowed ?? [16, 16];
    const hh = hotspots?.help ?? [16, 16];
    return {
        default: svgCursor(svgs.default, 6, 3, 'default'),
        pointer: svgCursor(svgs.pointer, 14, 3, 'pointer'),
        grab: svgCursor(svgs.pointer, 14, 3, 'grab'),
        ...(svgs.grabbing ? { grabbing: svgCursor(svgs.grabbing, gh[0], gh[1], 'grabbing') } : {}),
        ...(svgs.zoomIn ? { zoomIn: svgCursor(svgs.zoomIn, zh[0], zh[1], 'zoom-in') } : {}),
        ...(svgs.notAllowed ? { notAllowed: svgCursor(svgs.notAllowed, nh[0], nh[1], 'not-allowed') } : {}),
        ...(svgs.help ? { help: svgCursor(svgs.help, hh[0], hh[1], 'help') } : {}),
    };
}

// ---------------------------------------------------------------------------
// 注册表
// ---------------------------------------------------------------------------

const ALL_THEMES: CursorTheme[] = [];
const THEMES_BY_ID: Record<string, CursorTheme> = {};
const THEMES_BY_GAME: Record<string, CursorTheme[]> = {};

/** 游戏自注册光标主题（在游戏的 cursor.ts 中调用） */
export function registerCursorThemes(themes: CursorTheme[]): void {
    for (const theme of themes) {
        if (THEMES_BY_ID[theme.id]) continue; // 防止重复注册
        ALL_THEMES.push(theme);
        THEMES_BY_ID[theme.id] = theme;
        if (!THEMES_BY_GAME[theme.gameId]) THEMES_BY_GAME[theme.gameId] = [];
        THEMES_BY_GAME[theme.gameId].push(theme);
    }
}

export function getCursorTheme(themeId: string): CursorTheme | undefined {
    return THEMES_BY_ID[themeId];
}

export function getAllCursorThemes(): CursorTheme[] {
    return ALL_THEMES;
}

export function getThemesByGameId(gameId: string): CursorTheme[] {
    return THEMES_BY_GAME[gameId] ?? [];
}

/**
 * 每个游戏的默认变体，用于主网格。
 * 优先使用 manifest 中配置的 cursorTheme，回退到第一个注册的主题。
 * 
 * @param manifests 游戏清单数组（可选），用于获取 manifest 中配置的默认主题
 */
export function getDefaultThemePerGame(manifests?: Array<{ id: string; cursorTheme?: string }>): CursorTheme[] {
    const seen = new Set<string>();
    const result: CursorTheme[] = [];
    
    // 如果提供了 manifests，优先使用 manifest 配置
    if (manifests) {
        for (const manifest of manifests) {
            if (seen.has(manifest.id)) continue;
            seen.add(manifest.id);
            
            // 优先使用 manifest 中配置的主题
            if (manifest.cursorTheme) {
                const theme = THEMES_BY_ID[manifest.cursorTheme];
                if (theme) {
                    result.push(theme);
                    continue;
                }
            }
            
            // 回退到该游戏的第一个注册主题
            const gameThemes = THEMES_BY_GAME[manifest.id];
            if (gameThemes && gameThemes.length > 0) {
                result.push(gameThemes[0]);
            }
        }
        return result;
    }
    
    // 兼容旧逻辑：没有 manifests 时，返回每个游戏的第一个注册主题
    return ALL_THEMES.filter((t) => {
        if (seen.has(t.gameId)) return false;
        seen.add(t.gameId);
        return true;
    });
}
