/**
 * 游戏光标主题注入组件
 *
 * 包裹游戏 Board 容器，通过 <style> 注入游戏专属光标样式。
 * 支持用户偏好覆盖：
 * - overrideScope='home' → 游戏内用游戏自带光标
 * - overrideScope='all' → 用户选择的光标覆盖所有游戏
 *
 * 阵营动态切换：
 * - 传入静态 playerID prop（联机模式，身份固定）
 * - 或在 Board 内部调用 useCursorPlayerID(currentPlayer) 动态更新（本地同屏模式）
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ensureCursorRegistryLoaded } from './ensureCursorRegistryLoaded';
import { getCursorTheme, injectOutlineFilter, svgCursor } from './themes';
import { useCursorPreference } from './CursorPreferenceContext';
import type { CursorTheme } from './types';

// ---------------------------------------------------------------------------
// 阵营动态更新 Context
// ---------------------------------------------------------------------------

interface CursorPlayerIDContextValue {
    /** 当前生效的 playerID（静态 prop 优先，动态更新次之） */
    playerID: string | null;
    /** Board 内部调用，动态设置当前回合玩家（仅在 prop playerID 为空时生效） */
    setDynamicPlayerID: (id: string | null) => void;
}

const CursorPlayerIDContext = createContext<CursorPlayerIDContextValue>({
    playerID: null,
    setDynamicPlayerID: () => {},
});

/**
 * 在 Board 内部调用，动态更新光标阵营。
 * 本地同屏模式下跟随 currentPlayer 变化，联机模式下 prop playerID 已固定，此 hook 无效。
 *
 * 用法：
 * ```tsx
 * useCursorPlayerID(G.core.currentPlayer);
 * ```
 */
export function useCursorPlayerID(currentPlayer: string | null | undefined) {
    const { setDynamicPlayerID } = useContext(CursorPlayerIDContext);
    // 必须在 useEffect 中更新，渲染期间跨组件 setState 会触发 React 警告
    const prev = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        if (prev.current !== currentPlayer) {
            prev.current = currentPlayer;
            setDynamicPlayerID(currentPlayer ?? null);
        }
    }, [currentPlayer, setDynamicPlayerID]);
}

interface GameCursorProviderProps {
    /** 游戏 manifest 中声明的光标主题 ID（回退默认值） */
    themeId?: string;
    /** 游戏 ID（用于查询 gameVariants 中用户选择的变体） */
    gameId?: string;
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
        ...(s.help ? { help: svgCursor(injectOutlineFilter(s.help), 16, 16, 'help') } : {}),
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
    if (theme.help) {
        rules.push(`${scope} [style*="cursor: help"], ${scope} [style*="cursor:help"], ${scope} .cursor-help { cursor: ${theme.help}; }`);
    }

    return rules.join('\n');
}

export function GameCursorProvider({ themeId, gameId, playerID: propPlayerID, children }: GameCursorProviderProps) {
    const containerId = 'game-cursor-scope';
    const { preference } = useCursorPreference();
    const [dynamicPlayerID, setDynamicPlayerIDState] = useState<string | null>(null);
    const [cssText, setCssText] = useState<string | null>(null);

    const setDynamicPlayerID = useCallback((id: string | null) => {
        // 只有 prop playerID 为空时，动态更新才生效
        if (propPlayerID == null) {
            setDynamicPlayerIDState(id);
        }
    }, [propPlayerID]);

    // prop 优先，否则用动态值
    const playerID = propPlayerID ?? dynamicPlayerID;

    // 决定实际使用的光标主题
    const effectiveThemeId = useMemo(() => {
        // 用户选了覆盖所有游戏
        if (preference.overrideScope === 'all' && preference.cursorTheme !== 'default') {
            return preference.cursorTheme;
        }
        if (preference.overrideScope === 'all' && preference.cursorTheme === 'default') {
            return undefined;
        }
        // 仅主页模式：优先使用用户为该游戏选择的变体，回退到 manifest 默认值
        if (gameId && preference.gameVariants[gameId]) {
            return preference.gameVariants[gameId];
        }
        return themeId;
    }, [preference, themeId, gameId]);

    useEffect(() => {
        if (!effectiveThemeId) {
            setCssText(null);
            return;
        }

        let cancelled = false;
        const applyCursorTheme = async () => {
            await ensureCursorRegistryLoaded();
            if (cancelled) return;

            const theme = getCursorTheme(effectiveThemeId);
            if (!theme) {
                setCssText(null);
                return;
            }

            // 阵营子主题：若主题声明了 playerThemes 且当前 playerID 有匹配，则合并覆盖
            const playerOverride = playerID != null ? theme.playerThemes?.[playerID] : undefined;
            const mergedTheme: CursorTheme = playerOverride
                ? { ...theme, ...playerOverride }
                : theme;

            const effectiveTheme = preference.highContrast
                ? applyHighContrast(mergedTheme, mergedTheme.previewSvgs)
                : mergedTheme;
            setCssText(buildCursorCSS(containerId, effectiveTheme));
        };

        void applyCursorTheme();

        return () => {
            cancelled = true;
        };
    }, [effectiveThemeId, playerID, preference.highContrast]);

    const contextValue = useMemo(
        () => ({ playerID, setDynamicPlayerID }),
        [playerID, setDynamicPlayerID],
    );

    if (!effectiveThemeId) {
        return (
            <CursorPlayerIDContext.Provider value={contextValue}>
                {children}
            </CursorPlayerIDContext.Provider>
        );
    }

    return (
        <CursorPlayerIDContext.Provider value={contextValue}>
            <div id={containerId} className="w-full h-full">
                {cssText ? <style>{cssText}</style> : null}
                {children}
            </div>
        </CursorPlayerIDContext.Provider>
    );
}
