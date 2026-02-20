/**
 * 全局光标样式 Hook
 *
 * 在非游戏页面（主页等）应用用户选择的光标主题。
 * 通过注入全局 <style> 标签覆盖所有光标形态（default/pointer/grabbing 等）。
 */

import { useEffect } from 'react';
import { useCursorPreference } from './CursorPreferenceContext';
import { getCursorTheme, injectOutlineFilter, svgCursor } from './themes';
import type { CursorTheme } from './types';

function buildGlobalCursorCSS(theme: CursorTheme, highContrast: boolean): string {
    const t = highContrast ? applyHighContrastGlobal(theme) : theme;
    const rules: string[] = [
        // 全局默认
        `body { cursor: ${t.default}; }`,
        // 可点击元素
        `button, a, [role="button"], [style*="cursor: pointer"], [style*="cursor:pointer"], .cursor-pointer { cursor: ${t.pointer}; }`,
    ];
    if (t.grab) {
        rules.push(`[style*="cursor: grab"], [style*="cursor:grab"], .cursor-grab { cursor: ${t.grab}; }`);
    }
    if (t.grabbing) {
        rules.push(`[style*="cursor: grabbing"], [style*="cursor:grabbing"], .cursor-grabbing { cursor: ${t.grabbing}; }`);
    }
    if (t.notAllowed) {
        rules.push(`[disabled], [style*="cursor: not-allowed"], [style*="cursor:not-allowed"], .cursor-not-allowed { cursor: ${t.notAllowed}; }`);
    }
    if (t.zoomIn) {
        rules.push(`[style*="cursor: zoom-in"], [style*="cursor:zoom-in"], .cursor-zoom-in { cursor: ${t.zoomIn}; }`);
    }
    return rules.join('\n');
}

function applyHighContrastGlobal(theme: CursorTheme): CursorTheme {
    const s = theme.previewSvgs;
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

const STYLE_ID = 'global-cursor-style';

export function useGlobalCursor() {
    const { preference } = useCursorPreference();

    useEffect(() => {
        // 清理旧 style 标签
        document.getElementById(STYLE_ID)?.remove();
        document.body.style.cursor = '';

        if (preference.cursorTheme === 'default') return;

        const theme = getCursorTheme(preference.cursorTheme);
        if (!theme) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = buildGlobalCursorCSS(theme, preference.highContrast);
        document.head.appendChild(style);

        return () => {
            document.getElementById(STYLE_ID)?.remove();
            document.body.style.cursor = '';
        };
    }, [preference.cursorTheme, preference.highContrast]);
}
