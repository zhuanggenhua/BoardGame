/**
 * 游戏光标主题注入组件
 *
 * 包裹游戏 Board 容器，通过 <style> 注入游戏专属光标样式。
 * 支持用户偏好覆盖：
 * - overrideScope='home' → 游戏内用游戏自带光标
 * - overrideScope='all' → 用户选择的光标覆盖所有游戏
 */

import { useMemo } from 'react';
import { getCursorTheme, injectOutlineFilter, svgCursor } from './themes';
import { useCursorPreference } from './CursorPreferenceContext';
import type { CursorTheme } from './types';

interface GameCursorProviderProps {
    /** 游戏 manifest 中声明的光标主题 ID */
    themeId?: string;
    /**
     * 当前玩家 ID（如 '0'、'1'）。
     * 若主题声明了 playerThemes，则按此 ID 选择阵营专属光标；未匹配时回退到主题默认值。
     */
    playerID?: string;
    children: React.ReactNode;
}

/** 高对比模式：对 theme 的所有 cursor 值重新生成（注入白色外描边） */
function applyHighContrast(theme: CursorTheme, previewSvgs: CursorTheme['previewSvgs']): CursorTheme {
    const s = previewSvgs;
    return {
        ...theme,
        default: svgCursor(injectOutlineFilter(s.default), 6, 3, 'default'),
        pointer: svgCursor(injectOutlineFilter(s.pointer), 14, 3, 'pointer'),
        grab: svgCursor(injectOutlineFilter(s.pointer), 14, 3, 'grab'),
        ...(s.grabbing ? { grabbing: svgCursor(injectOutlineFilter(s.grabbing), 14, 16, 'grabbing') } : {}),
        ...(s.zoomIn ? { zoomIn: svgCursor(injectOutlineFilter(s.zoomIn), 13, 13, 'zoom-in') } : {}),
        ...(s.notAllowed ? { notAllowed: svgCursor(injectOutlineFilter(s.notAllowed), 16, 16, 'not-allowed') } : {}),
    };
}

/** 生成作用域 CSS，覆盖游戏容器内的光标样式 */
function buildCursorCSS(containerId: string, theme: CursorTheme): string {
    const scope = `#${containerId}`;
    const rules: string[] = [];

    rules.push(`${scope} { cursor: ${theme.default}; }`);
    rules.push(`${scope} button, ${scope} a, ${scope} [role="button"], ${scope} [style*="cursor: pointer"], ${scope} [style*="cursor:pointer"], ${scope} .cursor-pointer { cursor: ${theme.pointer}; }`);

    if (theme.grab) {
        rules.push(`${scope} [style*="cursor: grab"], ${scope} [style*="cursor:grab"], ${scope} .cursor-grab { cursor: ${theme.grab}; }`);
    }
    if (theme.grabbing) {
        rules.push(`${scope} [style*="cursor: grabbing"], ${scope} [style*="cursor:grabbing"], ${scope} .cursor-grabbing { cursor: ${theme.grabbing}; }`);
    }
    if (theme.notAllowed) {
        rules.push(`${scope} [disabled], ${scope} [style*="cursor: not-allowed"], ${scope} [style*="cursor:not-allowed"], ${scope} .cursor-not-allowed { cursor: ${theme.notAllowed}; }`);
    }
    if (theme.zoomIn) {
        rules.push(`${scope} [style*="cursor: zoom-in"], ${scope} [style*="cursor:zoom-in"], ${scope} .cursor-zoom-in { cursor: ${theme.zoomIn}; }`);
    }

    return rules.join('\n');
}

export function GameCursorProvider({ themeId, playerID, children }: GameCursorProviderProps) {
    const containerId = 'game-cursor-scope';
    const { preference } = useCursorPreference();

    // 决定实际使用的光标主题
    const effectiveThemeId = useMemo(() => {
        if (preference.overrideScope === 'all' && preference.cursorTheme !== 'default') {
            return preference.cursorTheme;
        }
        if (preference.overrideScope === 'all' && preference.cursorTheme === 'default') {
            return undefined;
        }
        return themeId;
    }, [preference, themeId]);

    const cssText = useMemo(() => {
        if (!effectiveThemeId) return null;
        const theme = getCursorTheme(effectiveThemeId);
        if (!theme) return null;

        // 阵营子主题：若主题声明了 playerThemes 且当前 playerID 有匹配，则合并覆盖
        const playerOverride = playerID != null ? theme.playerThemes?.[playerID] : undefined;
        const mergedTheme: CursorTheme = playerOverride
            ? { ...theme, ...playerOverride }
            : theme;

        const effectiveTheme = preference.highContrast
            ? applyHighContrast(mergedTheme, mergedTheme.previewSvgs)
            : mergedTheme;
        return buildCursorCSS(containerId, effectiveTheme);
    }, [effectiveThemeId, playerID, preference.highContrast]);

    if (!cssText) {
        return <>{children}</>;
    }

    return (
        <div id={containerId} className="w-full h-full">
            <style>{cssText}</style>
            {children}
        </div>
    );
}
