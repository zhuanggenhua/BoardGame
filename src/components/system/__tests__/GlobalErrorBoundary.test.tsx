import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalErrorBoundary } from '../GlobalErrorBoundary';
import {
    GAME_PAGE_RESCUE_GRACE_MS,
    detectGamePageRescueSignal,
} from '../GamePageRescueGate';
import { ViewportDebugProbe } from '../ViewportDebugProbe';
import {
    BOARD_ERROR_BOUNDARY_MAX_RETRIES,
    isBoardRenderErrorRecoverable,
    shouldShowBoardRenderFallback,
} from '../../../engine/transport/react';
import {
    PLAY_ROUTE_LOADING_TIMEOUT_MS,
    resolvePlayRouteFallbackLobbyPath,
    shouldShowPlayRouteLoadingPrompt,
} from '../../../lib/gameRouteFallback';
import {
    readAndroidBackNavigationDepth,
    resolveAndroidBackNavigationAction,
} from '../../../lib/mobile/androidBackNavigation';
import {
    __resetAppVisibilityForTests,
    BG_SHELL_APP_HIDDEN_EVENT,
    BG_SHELL_APP_VISIBLE_EVENT,
    dispatchAppVisibilityChange,
    onAppVisible,
} from '../../../lib/mobile/appVisibility';
import { resolveInAppUrlPath } from '../../../lib/mobile/appUrlRouting';
import {
    isTextEntryElement,
    isTextEntryProxyEligible,
    readTextEntryValue,
    scrollTextEntryIntoView,
    syncProxyValueToTextEntry,
} from '../../../lib/textEntry';
import {
    applyRuntimeViewportCssVars,
    resolveRuntimeKeyboardInsetBottom,
    useRuntimeViewport,
} from '../../../hooks/ui/useRuntimeViewport';

// Mock Dependencies
vi.mock('react', async () => {
    const actual = await vi.importActual<any>('react');
    return {
        ...actual,
        Component: class extends actual.Component<any, any> {
            constructor(props: any) {
                super(props);
                this.state = {};
            }
            setState(state: any) {
                this.state = { ...this.state, ...state };
            }
        },
    };
});

vi.mock('../../../lib/staleChunkReloadGuard', async () => {
    const actual = await vi.importActual<any>('../../../lib/staleChunkReloadGuard');
    return {
        ...actual,
        isStaleChunkError: vi.fn(actual.isStaleChunkError),
        reloadForStaleChunkOnce: vi.fn(actual.reloadForStaleChunkOnce),
    };
});

describe('GlobalErrorBoundary', () => {
    it('Should be a React Component class', () => {
        expect(GlobalErrorBoundary).toBeDefined();
        // Since it's a class component
        expect(GlobalErrorBoundary.prototype).toBeDefined();
        // Check if it has the required lifecycle method
        expect(typeof GlobalErrorBoundary.getDerivedStateFromError).toBe('function');
    });

    it('getDerivedStateFromError should update state to hasError: true', () => {
        const error = new Error('Test Error');
        const state = GlobalErrorBoundary.getDerivedStateFromError(error);
        expect(state).toEqual({ hasError: true, error, errorInfo: null });
    });

    it('stale chunk 渲染错误会触发自动刷新而不是停留在错误页', async () => {
        const staleChunkReloadGuard = await import('../../../lib/staleChunkReloadGuard');
        vi.mocked(staleChunkReloadGuard.reloadForStaleChunkOnce).mockReturnValue(true);

        const error = new Error('Failed to fetch dynamically imported module');
        const errorInfo = {
            componentStack: '\n    at MatchRoomWithAudio',
        } as React.ErrorInfo;

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const boundary = new GlobalErrorBoundary({ children: null });
            boundary.componentDidCatch(error, errorInfo);

            expect(staleChunkReloadGuard.isStaleChunkError).toHaveBeenCalledWith(error);
            expect(staleChunkReloadGuard.reloadForStaleChunkOnce).toHaveBeenCalledWith('react-error-boundary', window);
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });
});

describe('ViewportDebugProbe', () => {
    it('未带调试参数时不渲染', () => {
        render(
            <MemoryRouter initialEntries={['/play/dicethrone/local']}>
                <ViewportDebugProbe />
            </MemoryRouter>,
        );

        expect(screen.queryByTestId('viewport-debug-probe')).toBeNull();
    });

    it('带调试参数时渲染诊断浮层', () => {
        render(
            <MemoryRouter initialEntries={['/play/dicethrone/local?bgViewportDebug=1']}>
                <ViewportDebugProbe />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('viewport-debug-probe')).toBeInTheDocument();
        expect(screen.getByText('真机视口诊断')).toBeInTheDocument();
    });
});

describe('BoardErrorBoundary helpers', () => {
    it('仅对可恢复的上下文类错误继续显示 loading fallback', () => {
        expect(isBoardRenderErrorRecoverable(new Error('AudioProvider not ready'))).toBe(true);
        expect(isBoardRenderErrorRecoverable(new Error('useAudio hook missing provider'))).toBe(true);
        expect(isBoardRenderErrorRecoverable(new Error('Context value is undefined'))).toBe(true);
        expect(isBoardRenderErrorRecoverable(new Error('Cannot read properties of undefined'))).toBe(false);
    });

    it('超过重试上限或错误不可恢复时不再显示黑色 loading fallback', () => {
        const fallback = <div>loading</div>;

        expect(shouldShowBoardRenderFallback({
            error: new Error('AudioProvider not ready'),
            retryCount: 0,
            fallback,
        })).toBe(true);

        expect(shouldShowBoardRenderFallback({
            error: new Error('AudioProvider not ready'),
            retryCount: BOARD_ERROR_BOUNDARY_MAX_RETRIES,
            fallback,
        })).toBe(false);

        expect(shouldShowBoardRenderFallback({
            error: new Error('Cannot read properties of undefined'),
            retryCount: 0,
            fallback,
        })).toBe(false);
    });
});

describe('GamePageRescueGate helpers', () => {
    it('在宽限期后检测到画布塌缩时切换到友好提示', () => {
        expect(detectGamePageRescueSignal({
            pathname: '/play/smashup/local',
            elapsedMs: GAME_PAGE_RESCUE_GRACE_MS + 1,
            hasFriendlyScreen: false,
            hasLoadingScreen: false,
            hasBootstrapLoader: false,
            viewportRect: { width: 960, height: 540 },
            shellRect: { width: 960, height: 540 },
            contentRect: { width: 0, height: 0 },
            meaningfulContentCount: 0,
        })).toBe('game-shell-collapsed');
    });

    it('已有 loading 或友好页时不重复触发救援提示', () => {
        expect(detectGamePageRescueSignal({
            pathname: '/play/smashup/local',
            elapsedMs: GAME_PAGE_RESCUE_GRACE_MS + 1,
            hasFriendlyScreen: false,
            hasLoadingScreen: true,
            hasBootstrapLoader: false,
            viewportRect: null,
            shellRect: null,
            contentRect: null,
            meaningfulContentCount: 0,
        })).toBeNull();

        expect(detectGamePageRescueSignal({
            pathname: '/play/smashup/local',
            elapsedMs: GAME_PAGE_RESCUE_GRACE_MS + 1,
            hasFriendlyScreen: true,
            hasLoadingScreen: false,
            hasBootstrapLoader: false,
            viewportRect: null,
            shellRect: null,
            contentRect: null,
            meaningfulContentCount: 0,
        })).toBeNull();
    });

    it('bootstrap loader 还在时不把首屏冷启动误判成救援页', () => {
        expect(detectGamePageRescueSignal({
            pathname: '/play/smashup/local',
            elapsedMs: GAME_PAGE_RESCUE_GRACE_MS + 1,
            hasFriendlyScreen: false,
            hasLoadingScreen: false,
            hasBootstrapLoader: true,
            viewportRect: null,
            shellRect: null,
            contentRect: null,
            meaningfulContentCount: 0,
        })).toBeNull();
    });
});

describe('Runtime viewport css vars', () => {
    it('board-shell 游戏页会把缩放变量写成旧 WebView 可消费的纯数字', () => {
        document.documentElement.setAttribute('data-game-page', 'true');
        document.documentElement.setAttribute('data-mobile-layout-preset', 'board-shell');
        document.documentElement.setAttribute('data-mobile-profile', 'landscape-adapted');
        document.documentElement.setAttribute('data-game-id', 'dicethrone');
        document.documentElement.setAttribute('data-mobile-board-shell-design-width', '940');

        applyRuntimeViewportCssVars({
            width: 802,
            height: 393,
            safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
            keyboardInsetBottom: 0,
        }, {
            layoutEngineCapabilities: {
                chromiumMajorVersion: 91,
                layoutMode: 'legacy',
                supportsCalcDivision: false,
                supportsDynamicViewportUnits: false,
                requiresJsScaleFallback: true,
                requiresLegacyViewportFallback: true,
            },
        });

        const rootStyle = document.documentElement.style;
        expect(document.documentElement.dataset.mobileLayoutEngine).toBe('legacy');
        expect(rootStyle.getPropertyValue('--mobile-board-shell-design-width')).toBe('940px');
        expect(rootStyle.getPropertyValue('--mobile-board-shell-scale')).toBe('0.853191');
        expect(rootStyle.getPropertyValue('--mobile-board-shell-inverse-scale')).toBe('1.172070');
        expect(rootStyle.getPropertyValue('--mobile-layout-inline-unit')).toBe('9.4000px');
        expect(rootStyle.getPropertyValue('--mobile-root-scale')).toBe('0.626563');

        document.documentElement.removeAttribute('data-game-page');
        document.documentElement.removeAttribute('data-mobile-layout-preset');
        document.documentElement.removeAttribute('data-mobile-profile');
        document.documentElement.removeAttribute('data-game-id');
        document.documentElement.removeAttribute('data-mobile-board-shell-design-width');
    });

    it('summonerwars 通过 manifest 数据属性提供 900 设计宽度', () => {
        document.documentElement.setAttribute('data-game-page', 'true');
        document.documentElement.setAttribute('data-mobile-layout-preset', 'board-shell');
        document.documentElement.setAttribute('data-mobile-profile', 'landscape-adapted');
        document.documentElement.setAttribute('data-game-id', 'summonerwars');
        document.documentElement.setAttribute('data-mobile-board-shell-design-width', '900');

        applyRuntimeViewportCssVars({
            width: 936,
            height: 432,
            safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
            keyboardInsetBottom: 0,
        }, {
            layoutEngineCapabilities: {
                chromiumMajorVersion: 91,
                layoutMode: 'legacy',
                supportsCalcDivision: false,
                supportsDynamicViewportUnits: false,
                requiresJsScaleFallback: true,
                requiresLegacyViewportFallback: true,
            },
        });

        const rootStyle = document.documentElement.style;
        expect(rootStyle.getPropertyValue('--mobile-board-shell-design-width')).toBe('900px');
        expect(rootStyle.getPropertyValue('--mobile-board-shell-scale')).toBe('1.040000');
        expect(rootStyle.getPropertyValue('--mobile-board-shell-inverse-scale')).toBe('0.961538');
        expect(rootStyle.getPropertyValue('--mobile-layout-inline-unit')).toBe('9.0000px');
        expect(rootStyle.getPropertyValue('--mobile-root-scale')).toBe('0.731250');

        document.documentElement.removeAttribute('data-game-page');
        document.documentElement.removeAttribute('data-mobile-layout-preset');
        document.documentElement.removeAttribute('data-mobile-profile');
        document.documentElement.removeAttribute('data-game-id');
        document.documentElement.removeAttribute('data-mobile-board-shell-design-width');
    });

    it('键盘弹出后会保留上一次非键盘 layout viewport 高度', () => {
        applyRuntimeViewportCssVars({
            width: 844,
            height: 844,
            safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
            keyboardInsetBottom: 0,
        });

        applyRuntimeViewportCssVars({
            width: 844,
            height: 444,
            safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
            keyboardInsetBottom: 400,
        });

        const rootStyle = document.documentElement.style;
        expect(rootStyle.getPropertyValue('--runtime-viewport-height')).toBe('444px');
        expect(rootStyle.getPropertyValue('--layout-viewport-height')).toBe('844px');
    });
});

describe('Play route loading fallback helpers', () => {
    it('仅在对局路由超时后切换到友好提示', () => {
        expect(shouldShowPlayRouteLoadingPrompt('/play/smashup/local', PLAY_ROUTE_LOADING_TIMEOUT_MS - 1)).toBe(false);
        expect(shouldShowPlayRouteLoadingPrompt('/play/smashup/local', PLAY_ROUTE_LOADING_TIMEOUT_MS)).toBe(true);
        expect(shouldShowPlayRouteLoadingPrompt('/dev/audio', PLAY_ROUTE_LOADING_TIMEOUT_MS + 1)).toBe(false);
    });

    it('返回大厅路径优先带上当前 gameId', () => {
        expect(resolvePlayRouteFallbackLobbyPath('/play/smashup/local')).toBe('/?game=smashup');
        expect(resolvePlayRouteFallbackLobbyPath('/play/dicethrone/match/123')).toBe('/?game=dicethrone');
        expect(resolvePlayRouteFallbackLobbyPath('/maintenance')).toBe('/');
    });
});

describe('AndroidBackNavigation helpers', () => {
    it('优先读取 React Router 写入的 history idx', () => {
        expect(readAndroidBackNavigationDepth({
            historyState: { idx: 3 },
            historyLength: 1,
        })).toBe(3);
    });

    it('缺少 idx 时回退到浏览器 history.length', () => {
        expect(readAndroidBackNavigationDepth({
            historyState: null,
            historyLength: 4,
        })).toBe(3);
    });

    it('对局页即使有历史栈也统一回到大厅', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/play/smashup/match/room-1',
            search: '?playerID=0',
            historyState: { idx: 1 },
            historyLength: 2,
            modalStackDepth: 0,
        })).toEqual({ type: 'fallback-route', path: '/?game=smashup' });
    });

    it('有可关闭弹窗时优先关闭弹窗，而不是退路由', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/play/smashup/match/room-1',
            search: '?playerID=0',
            historyState: { idx: 3 },
            historyLength: 4,
            modalStackDepth: 1,
            isTopModalClosable: true,
        })).toEqual({ type: 'close-modal' });
    });

    it('有不可关闭弹窗时阻断返回穿透', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/play/smashup/tutorial',
            historyState: { idx: 2 },
            historyLength: 3,
            modalStackDepth: 1,
            isTopModalClosable: false,
        })).toEqual({ type: 'blocked' });
    });

    it('教程这类允许系统返回的不可关闭弹窗，不阻断对局页返回大厅', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/play/smashup/tutorial',
            historyState: { idx: 2 },
            historyLength: 3,
            modalStackDepth: 1,
            isTopModalClosable: false,
            isTopModalBackNavigationAllowed: true,
        })).toEqual({ type: 'fallback-route', path: '/?game=smashup' });
    });

    it('输入法激活时优先收起文本输入，而不是继续退路由', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/play/smashup/match/room-1',
            search: '?playerID=0',
            historyState: { idx: 3 },
            historyLength: 4,
            modalStackDepth: 1,
            isTopModalClosable: true,
            hasFocusedTextEntry: true,
        })).toEqual({ type: 'dismiss-text-entry' });
    });

    it('没有历史栈但仍在对局页时回到对应大厅', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/play/dicethrone/match/room-1',
            search: '?playerID=0',
            historyState: { idx: 0 },
            historyLength: 1,
            modalStackDepth: 0,
        })).toEqual({ type: 'fallback-route', path: '/?game=dicethrone' });
    });

    it('首页 query 弹窗没有历史栈时回退到纯首页', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/',
            search: '?game=smashup',
            historyState: { idx: 0 },
            historyLength: 1,
            modalStackDepth: 0,
        })).toEqual({ type: 'fallback-route', path: '/' });
    });

    it('非对局页仍保留 history.back 语义', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/maintenance',
            historyState: { idx: 1 },
            historyLength: 2,
            modalStackDepth: 0,
        })).toEqual({ type: 'history-back' });
    });

    it('根页且没有历史栈时允许退出 App', () => {
        expect(resolveAndroidBackNavigationAction({
            pathname: '/',
            search: '',
            historyState: { idx: 0 },
            historyLength: 1,
            modalStackDepth: 0,
        })).toEqual({ type: 'exit-app' });
    });
});

describe('App visibility helpers', () => {
    it('App 恢复可见事件只触发一次回调', () => {
        __resetAppVisibilityForTests();
        const onVisible = vi.fn();
        const cleanup = onAppVisible(onVisible);

        dispatchAppVisibilityChange(false);
        dispatchAppVisibilityChange(true);
        dispatchAppVisibilityChange(true);

        expect(onVisible).toHaveBeenCalledTimes(1);
        cleanup();
    });

    it('多个订阅者都能收到同一次前台恢复事件', () => {
        __resetAppVisibilityForTests();
        const onVisibleA = vi.fn();
        const onVisibleB = vi.fn();
        const cleanupA = onAppVisible(onVisibleA);
        const cleanupB = onAppVisible(onVisibleB);

        dispatchAppVisibilityChange(false);
        dispatchAppVisibilityChange(true);

        expect(onVisibleA).toHaveBeenCalledTimes(1);
        expect(onVisibleB).toHaveBeenCalledTimes(1);
        cleanupA();
        cleanupB();
    });

    it('外部派发的壳层可见事件也能唤醒回调', () => {
        __resetAppVisibilityForTests();
        const onVisible = vi.fn();
        const cleanup = onAppVisible(onVisible);

        window.dispatchEvent(new CustomEvent(BG_SHELL_APP_HIDDEN_EVENT));
        window.dispatchEvent(new CustomEvent(BG_SHELL_APP_VISIBLE_EVENT));

        expect(onVisible).toHaveBeenCalledTimes(1);
        cleanup();
    });
});

describe('Runtime viewport helpers', () => {
    it('仅在文本输入获得焦点时计算键盘底部 inset', () => {
        expect(resolveRuntimeKeyboardInsetBottom({
            visualViewportHeight: 520,
            visualViewportOffsetTop: 0,
            innerHeight: 800,
            documentClientHeight: 800,
            hasFocusedTextEntry: true,
        })).toBe(280);

        expect(resolveRuntimeKeyboardInsetBottom({
            visualViewportHeight: 520,
            visualViewportOffsetTop: 0,
            innerHeight: 800,
            documentClientHeight: 800,
            hasFocusedTextEntry: false,
        })).toBe(0);
    });

    it('同一 tick 内连续 visualViewport resize 只合并一次 viewport 状态刷新', async () => {
        vi.useFakeTimers();
        try {
            const resizeListeners = new Set<(event: Event) => void>();
            const visualViewport = {
                width: 915,
                height: 412,
                offsetTop: 0,
                addEventListener: vi.fn((eventName: string, handler: (event: Event) => void) => {
                    if (eventName === 'resize') {
                        resizeListeners.add(handler);
                    }
                }),
                removeEventListener: vi.fn((eventName: string, handler: (event: Event) => void) => {
                    if (eventName === 'resize') {
                        resizeListeners.delete(handler);
                    }
                }),
            };

            Object.defineProperty(window, 'visualViewport', {
                configurable: true,
                value: visualViewport,
            });
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 915 });
            Object.defineProperty(window, 'innerHeight', { configurable: true, value: 412 });
            Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 915 });
            Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 412 });

            const renderHeights: number[] = [];
            const Probe = () => {
                const viewport = useRuntimeViewport();
                renderHeights.push(viewport.height);
                return <div data-testid="viewport-height-probe">{viewport.height}</div>;
            };

            render(<Probe />);

            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });

            visualViewport.height = 410;
            resizeListeners.forEach((listener) => listener(new Event('resize')));
            visualViewport.height = 409;
            resizeListeners.forEach((listener) => listener(new Event('resize')));
            visualViewport.height = 408;
            resizeListeners.forEach((listener) => listener(new Event('resize')));

            expect(screen.getByTestId('viewport-height-probe')).toHaveTextContent('412');

            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });

            expect(screen.getByTestId('viewport-height-probe')).toHaveTextContent('408');
            expect(renderHeights).toContain(408);
            expect(renderHeights).not.toContain(410);
            expect(renderHeights).not.toContain(409);
        } finally {
            vi.useRealTimers();
        }
    });

    it('过滤非文本控件，只识别真实输入目标', () => {
        const input = document.createElement('input');
        input.type = 'email';
        const rangeInput = document.createElement('input');
        rangeInput.type = 'range';
        const textarea = document.createElement('textarea');
        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');

        expect(isTextEntryElement(input)).toBe(true);
        expect(isTextEntryElement(textarea)).toBe(true);
        expect(isTextEntryElement(editable)).toBe(true);
        expect(isTextEntryElement(rangeInput)).toBe(false);
        expect(isTextEntryElement(document.createElement('button'))).toBe(false);
    });

    it('仅对真实文本输入执行 scrollIntoView', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.scrollIntoView = vi.fn();
        const button = document.createElement('button');
        button.scrollIntoView = vi.fn();

        expect(scrollTextEntryIntoView(input, 'auto')).toBe(true);
        expect(input.scrollIntoView).toHaveBeenCalledWith({
            block: 'center',
            inline: 'nearest',
            behavior: 'auto',
        });

        expect(scrollTextEntryIntoView(button, 'smooth')).toBe(false);
        expect(button.scrollIntoView).not.toHaveBeenCalled();
    });

    it('仅在移动端运行时（coarse pointer 或键盘 inset）启用输入代理', () => {
        document.documentElement.style.removeProperty('--layout-viewport-height');
        document.documentElement.style.removeProperty('--keyboard-inset-height');
        const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
        Object.defineProperty(window, 'matchMedia', {
            value: matchMediaMock,
            configurable: true,
        });

        const modalRoot = document.createElement('div');
        modalRoot.id = 'modal-root';
        const modalInput = document.createElement('input');
        modalInput.type = 'text';
        modalRoot.appendChild(modalInput);
        document.body.appendChild(modalRoot);

        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-base-container';
        const nestedModalInput = document.createElement('input');
        nestedModalInput.type = 'text';
        modalContainer.appendChild(nestedModalInput);
        document.body.appendChild(modalContainer);

        const outsideInput = document.createElement('input');
        outsideInput.type = 'text';
        document.body.appendChild(outsideInput);

        expect(isTextEntryProxyEligible(modalInput)).toBe(true);
        expect(isTextEntryProxyEligible(nestedModalInput)).toBe(true);
        expect(isTextEntryProxyEligible(outsideInput)).toBe(true);

        matchMediaMock.mockReturnValue({ matches: false });
        expect(isTextEntryProxyEligible(modalInput)).toBe(false);
        expect(isTextEntryProxyEligible(nestedModalInput)).toBe(false);
        expect(isTextEntryProxyEligible(outsideInput)).toBe(false);

        document.documentElement.style.setProperty('--keyboard-inset-height', '280px');
        expect(isTextEntryProxyEligible(modalInput)).toBe(true);
        expect(isTextEntryProxyEligible(nestedModalInput)).toBe(true);
        expect(isTextEntryProxyEligible(outsideInput)).toBe(true);
    });

    it('代理输入会把值同步回原始输入目标', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'old';
        const onInput = vi.fn();
        const onChange = vi.fn();
        input.addEventListener('input', onInput);
        input.addEventListener('change', onChange);

        expect(syncProxyValueToTextEntry(input, 'next value')).toBe(true);
        expect(readTextEntryValue(input)).toBe('next value');
        expect(onInput).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('代理输入会把值同步回 contenteditable 目标', () => {
        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        editable.textContent = 'before';
        const onInput = vi.fn();
        editable.addEventListener('input', onInput);

        expect(syncProxyValueToTextEntry(editable, 'after')).toBe(true);
        expect(readTextEntryValue(editable)).toBe('after');
        expect(onInput).toHaveBeenCalledTimes(1);
    });

    it('优先滚动最近的可滚容器，而不是把整个弹窗顶飞', () => {
        document.documentElement.style.setProperty('--runtime-viewport-height', '564px');
        document.documentElement.style.setProperty('--safe-area-top', '0px');
        document.documentElement.style.setProperty('--safe-area-bottom', '0px');
        document.documentElement.style.setProperty('--keyboard-inset-height', '280px');

        const scrollContainer = document.createElement('div');
        scrollContainer.style.overflowY = 'auto';
        Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1200, configurable: true });
        Object.defineProperty(scrollContainer, 'clientHeight', { value: 320, configurable: true });
        Object.defineProperty(scrollContainer, 'scrollTop', {
            value: 0,
            writable: true,
            configurable: true,
        });
        scrollContainer.scrollTo = vi.fn(({ top }: { top: number }) => {
            scrollContainer.scrollTop = top;
        });
        scrollContainer.getBoundingClientRect = vi.fn(() => ({
            top: 80,
            bottom: 400,
            left: 0,
            right: 300,
            width: 300,
            height: 320,
            x: 0,
            y: 80,
            toJSON: () => ({}),
        }));

        const input = document.createElement('input');
        input.type = 'text';
        input.scrollIntoView = vi.fn();
        input.getBoundingClientRect = vi.fn(() => ({
            top: 380,
            bottom: 420,
            left: 0,
            right: 260,
            width: 260,
            height: 40,
            x: 0,
            y: 380,
            toJSON: () => ({}),
        }));

        scrollContainer.appendChild(input);
        document.body.appendChild(scrollContainer);

        expect(scrollTextEntryIntoView(input, 'smooth')).toBe(true);
        expect(scrollContainer.scrollTo).toHaveBeenCalledWith({
            top: 132,
            behavior: 'smooth',
        });
        expect(input.scrollIntoView).not.toHaveBeenCalled();
    });
});

describe('App URL routing helpers', () => {
    it('支持自定义 scheme 深链到应用内路由', () => {
        expect(resolveInAppUrlPath('top.easyboardgame.app://play/smashup/match/123?playerID=0')).toBe('/play/smashup/match/123?playerID=0');
    });

    it('支持 https App Link 直接映射 pathname', () => {
        expect(resolveInAppUrlPath('https://easyboardgame.top/play/dicethrone/local?seed=abc')).toBe('/play/dicethrone/local?seed=abc');
    });

    it('根路径或非法 URL 不生成应用内跳转', () => {
        expect(resolveInAppUrlPath('top.easyboardgame.app://')).toBeNull();
        expect(resolveInAppUrlPath('not a url')).toBeNull();
    });
});
