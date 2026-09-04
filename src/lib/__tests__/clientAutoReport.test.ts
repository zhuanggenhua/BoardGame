// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/server', () => ({
    FEEDBACK_API_URL: '/feedback',
    IS_DEV_API_DISABLED: false,
}));

const getFeedbackFetchCalls = () => (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(([input]) => String(input) === '/feedback');

describe('clientAutoReport', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        window.localStorage.clear();
        window.history.replaceState({}, '', '/play/smashup/match/match-1?seat=0');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
        }));
    });

    afterEach(async () => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        const { setCurrentGameFeedbackContext } = await import('../feedback/gameFeedbackContext');
        setCurrentGameFeedbackContext(null);
        const host = window as Window & {
            __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean;
            __BG_LAST_ERROR_CONTEXT__?: unknown;
            __BG_LAST_USER_ACTION__?: unknown;
            __BG_RECENT_USER_ACTIONS__?: unknown;
            __BG_LAST_ROUTE_CHANGE__?: unknown;
            __BG_RECENT_ROUTE_CHANGES__?: unknown;
            __BG_CLIENT_DIAGNOSTIC_CAPTURE_INSTALLED__?: boolean;
            __BG_HISTORY_PUSH_STATE_ORIGINAL__?: History['pushState'];
            __BG_HISTORY_REPLACE_STATE_ORIGINAL__?: History['replaceState'];
        };
        delete host.__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__;
        delete host.__BG_LAST_ERROR_CONTEXT__;
        delete host.__BG_LAST_USER_ACTION__;
        delete host.__BG_RECENT_USER_ACTIONS__;
        delete host.__BG_LAST_ROUTE_CHANGE__;
        delete host.__BG_RECENT_ROUTE_CHANGES__;
        delete host.__BG_CLIENT_DIAGNOSTIC_CAPTURE_INSTALLED__;
        if (host.__BG_HISTORY_PUSH_STATE_ORIGINAL__) {
            window.history.pushState = host.__BG_HISTORY_PUSH_STATE_ORIGINAL__;
            delete host.__BG_HISTORY_PUSH_STATE_ORIGINAL__;
        }
        if (host.__BG_HISTORY_REPLACE_STATE_ORIGINAL__) {
            window.history.replaceState = host.__BG_HISTORY_REPLACE_STATE_ORIGINAL__;
            delete host.__BG_HISTORY_REPLACE_STATE_ORIGINAL__;
        }
        document.documentElement.removeAttribute('data-game-page');
        document.documentElement.removeAttribute('data-game-id');
        document.documentElement.removeAttribute('data-mobile-layout-preset');
        document.documentElement.removeAttribute('data-mobile-profile');
        document.body.innerHTML = '';
    });

    it('会自动上报并写入最近错误上下文', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        vi.stubGlobal('__APP_VERSION__', '0.6.1-test');
        vi.stubGlobal('__APP_COMMIT_SHA__', 'abc123def456');
        vi.stubGlobal('__APP_BUILD_TIME__', '2026-06-19T10:00:00.000Z');
        vi.stubGlobal('__APP_RELEASE_CHANNEL__', 'production');
        const { installClientDiagnosticCapture } = await import('../feedback/clientFeedbackContext');
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');
        const { getLastErrorContext } = await import('../feedback/errorContext');
        installClientDiagnosticCapture();

        document.documentElement.setAttribute('data-game-page', 'true');
        document.documentElement.setAttribute('data-game-id', 'smashup');
        document.documentElement.setAttribute('data-mobile-layout-preset', 'board-shell');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '确认出牌';
        button.setAttribute('data-testid', 'confirm-play');
        document.body.appendChild(button);
        button.focus();
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        window.history.pushState({}, '', '/play/smashup/match/match-1?seat=0&step=confirm');

        await reportClientAutoFeedbackOnce('smashup-runtime-state-normalized:bases[0].ongoingActions:null', {
            content: '[auto][smashup-runtime-guard] test anomaly',
            autoReportKind: 'smashup-runtime-state-normalized',
            source: 'client-runtime-guard',
            gameId: 'smashup',
            gameName: 'smashup',
            playerId: '0',
            errorName: 'SmashUpRuntimeStateNormalized',
            errorMessage: '大杀四方运行时状态存在空数组合同破坏',
            errorSource: 'smashup.runtime_state_guard',
            stack: '{"phase":"scoreBases"}',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(1);
        expect(getLastErrorContext()).toMatchObject({
            name: 'SmashUpRuntimeStateNormalized',
            message: '大杀四方运行时状态存在空数组合同破坏',
            source: 'smashup.runtime_state_guard',
        });

        const requestInit = getFeedbackFetchCalls()[0]?.[1];
        const body = JSON.parse(String(requestInit?.body ?? '{}'));
        expect(body).toMatchObject({
            source: 'client-runtime-guard',
            autoReportKind: 'smashup-runtime-state-normalized',
            gameName: 'smashup',
            clientContext: {
                gameId: 'smashup',
                matchId: 'match-1',
                playerId: '0',
                appVersion: '0.6.1-test',
                appCommitSha: 'abc123def456',
                appBuildTime: '2026-06-19T10:00:00.000Z',
                appReleaseChannel: 'production',
                activeElement: {
                    tagName: 'button',
                    testId: 'confirm-play',
                },
                lastUserAction: {
                    type: 'click',
                },
                recentUserActions: [
                    {
                        type: 'click',
                    },
                ],
                lastRouteChange: {
                    to: '/play/smashup/match/match-1?seat=0&step=confirm',
                    trigger: 'pushState',
                },
                recentRouteChanges: [
                    {
                        to: '/play/smashup/match/match-1?seat=0',
                        trigger: 'init',
                    },
                    {
                        to: '/play/smashup/match/match-1?seat=0&step=confirm',
                        trigger: 'pushState',
                    },
                ],
                pageFlags: {
                    isGamePage: true,
                    gameId: 'smashup',
                    mobileLayoutPreset: 'board-shell',
                },
            },
            errorContext: {
                name: 'SmashUpRuntimeStateNormalized',
                source: 'smashup.runtime_state_guard',
            },
        });
    });

    it('通用来源会透传到自动反馈请求里', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('react-boundary-signature', {
            content: '[auto][react.error_boundary] render failed',
            autoReportKind: 'react-render-error',
            source: 'react-error-boundary',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: 'Cannot read properties of undefined',
            errorSource: 'react.error_boundary',
        });

        const body = JSON.parse(String(getFeedbackFetchCalls()[0]?.[1]?.body ?? '{}'));
        expect(body.source).toBe('react-error-boundary');
        expect(body.contactInfo).toBe('auto:react-error-boundary');
        expect(body.clientContext?.gameId).toBe('smashup');
    });

    it('React 类错误会把 JS 堆栈和组件栈分开附带', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('react-boundary-stack-split', {
            content: '[auto][react.error_boundary] render failed',
            autoReportKind: 'react-render-error',
            source: 'react-error-boundary',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: 'Cannot read properties of undefined',
            errorSource: 'react.error_boundary',
            jsStack: 'TypeError: Cannot read properties of undefined\n    at CardPanel (CardPanel.tsx:12:3)',
            componentStack: '\n    at CardPanel\n    at MatchRoomWithAudio',
        });

        const body = JSON.parse(String(getFeedbackFetchCalls()[0]?.[1]?.body ?? '{}'));
        expect(body.errorContext).toMatchObject({
            jsStack: expect.stringContaining('CardPanel'),
            componentStack: expect.stringContaining('MatchRoomWithAudio'),
        });
        expect(body.errorContext.stack).toContain('CardPanel');
        expect(body.errorContext.stack).toContain('MatchRoomWithAudio');
    });

    it('游戏页有现场时会自动附带操作日志和状态快照', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { setCurrentGameFeedbackContext } = await import('../feedback/gameFeedbackContext');
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        setCurrentGameFeedbackContext({
            state: {
                core: {
                    gameId: 'smashup',
                },
                sys: {
                    phase: 'play',
                    turnNumber: 7,
                    actionLog: {
                        entries: [
                            {
                                text: '打出一张牌',
                                event: { type: 'play-card' },
                                timestamp: 123,
                            },
                        ],
                    },
                    eventStream: {
                        entries: [],
                    },
                    undo: {
                        snapshots: [],
                    },
                    interaction: {
                        current: {
                            type: 'select',
                        },
                    },
                    responseWindow: {
                        current: {
                            triggerEvent: {
                                type: 'reaction-ready',
                            },
                        },
                    },
                },
            } as never,
            playerId: '0',
            isGameOver: false,
            isLocalMode: false,
        });

        await reportClientAutoFeedbackOnce('game-context-auto-report', {
            content: '[auto][react.error_boundary] render failed',
            autoReportKind: 'react-render-error',
            source: 'react-error-boundary',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: 'Cannot read properties of undefined',
            errorSource: 'react.error_boundary',
        });

        const body = JSON.parse(String(getFeedbackFetchCalls()[0]?.[1]?.body ?? '{}'));
        expect(body).toMatchObject({
            actionLog: expect.stringContaining('user-feedback-diagnostic'),
            stateSnapshot: expect.stringContaining('"turnNumber": 7'),
        });
    });

    it('同一签名在去重窗口内只会上报一次', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        const payload = {
            content: '[auto][smashup-runtime-guard] test anomaly',
            autoReportKind: 'smashup-runtime-state-normalized',
            gameId: 'smashup',
            gameName: 'smashup',
            playerId: '0',
            errorName: 'SmashUpRuntimeStateNormalized',
            errorMessage: '大杀四方运行时状态存在空数组合同破坏',
            errorSource: 'smashup.runtime_state_guard',
        };

        await reportClientAutoFeedbackOnce('dedupe-signature', payload);
        await reportClientAutoFeedbackOnce('dedupe-signature', payload);

        expect(getFeedbackFetchCalls()).toHaveLength(1);
    });

    it('测试模式下不会真的发请求，但仍会记录最近错误上下文', async () => {
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');
        const { getLastErrorContext } = await import('../feedback/errorContext');

        await reportClientAutoFeedbackOnce('test-mode-signature', {
            content: '[auto][smashup-runtime-guard] test anomaly',
            autoReportKind: 'smashup-runtime-state-normalized',
            gameId: 'smashup',
            gameName: 'smashup',
            errorName: 'SmashUpRuntimeStateNormalized',
            errorMessage: '仅记录上下文',
            errorSource: 'smashup.runtime_state_guard',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
        expect(getLastErrorContext()).toMatchObject({
            name: 'SmashUpRuntimeStateNormalized',
            message: '仅记录上下文',
        });
    });

    it('stale chunk 类错误会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('stale-chunk-signature', {
            content: '[auto][window.error] chunk failed',
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'ChunkLoadError',
            errorMessage: 'Loading chunk 42 failed',
            errorSource: 'window.error',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('动态导入模块加载失败噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('dynamic-import-module-error', {
            content: '[auto][unhandledrejection] error loading dynamically imported module: https://easyboardgame.top/assets/cursor-BonIRdwH.js',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: 'error loading dynamically imported module: https://easyboardgame.top/assets/cursor-BonIRdwH.js',
            errorSource: 'window.unhandledrejection',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('WKWebView 空堆栈 Load failed 噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('webkit-bare-load-failed', {
            content: '[auto][unhandledrejection] Load failed',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: 'Load failed',
            errorSource: 'window.unhandledrejection',
            stack: '',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('有站内堆栈的 Load failed 不会被 WKWebView 噪音规则误过滤', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('real-app-load-failed', {
            content: '[auto][unhandledrejection] Load failed',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: 'Load failed',
            errorSource: 'window.unhandledrejection',
            stack: 'TypeError: Load failed\n    at loadRoomDetails (https://easyboardgame.top/assets/index-Cmi8y5la.js:120:15)',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(1);
    });

    it('模块脚本 MIME type 噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('invalid-module-mime-type', {
            content: "[auto][react.error_boundary] 'text/html' is not a valid JavaScript MIME type.",
            autoReportKind: 'react-render-error',
            source: 'react-error-boundary',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: "'text/html' is not a valid JavaScript MIME type.",
            errorSource: 'react.error_boundary',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('音频设备启动失败噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('audio-device-invalid-state', {
            content: '[auto][unhandledrejection] Failed to start the audio device',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'InvalidStateError',
            errorMessage: 'Failed to start the audio device',
            errorSource: 'window.unhandledrejection',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('音频编解码不支持噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('audio-codec-unsupported', {
            content: '[auto][unhandledrejection] No codec support for selected audio sources.',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'Error',
            errorMessage: 'No codec support for selected audio sources.',
            errorSource: 'window.unhandledrejection',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('音频解码失败噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('audio-decoding-failed', {
            content: '[auto][unhandledrejection] Decoding audio data failed.',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'Error',
            errorMessage: 'Decoding audio data failed.',
            errorSource: 'window.unhandledrejection',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('音频资源 502 加载失败会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('audio-load-status-502', {
            content: '[auto][unhandledrejection] Failed loading audio file with status: 502.',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'Error',
            errorMessage: 'Failed loading audio file with status: 502.',
            errorSource: 'window.unhandledrejection',
            stack: 'Error: Failed loading audio file with status: 502.\n    at c (https://easyboardgame.top/assets/index.js:192:42706)\n    at _.<anonymous> (https://easyboardgame.top/assets/vendor-howler-Bp1HXCiM.js:1:19873)',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('Howler 音频错误码噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('audio-howler-error-code-4', {
            content: '[auto][unhandledrejection] 4',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'Error',
            errorMessage: '4',
            errorSource: 'window.unhandledrejection',
            stack: 'Error: 4\n    at c (https://easyboardgame.top/assets/index-Cmi8y5la.js:187:33412)\n    at _.<anonymous> (https://easyboardgame.top/assets/vendor-howler-Bp1HXCiM.js:1:19873)',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('旧 Android 壳缺少 App 插件时会过滤噪音，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('android-app-plugin-missing', {
            content: '[auto][unhandledrejection] "App" plugin is not implemented on android',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'Error',
            errorMessage: '"App" plugin is not implemented on android',
            errorSource: 'window.unhandledrejection',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('旧 Android 壳缺少 CapacitorUpdater 插件时会过滤噪音，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('android-capacitor-updater-plugin-missing', {
            content: '[auto][unhandledrejection] "CapacitorUpdater" plugin is not implemented on android',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'Error',
            errorMessage: '"CapacitorUpdater" plugin is not implemented on android',
            errorSource: 'window.unhandledrejection',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('通用 AbortError 噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('generic-abort-error', {
            content: '[auto][unhandledrejection] The operation was aborted.',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'AbortError',
            errorMessage: 'The operation was aborted.',
            errorSource: 'window.unhandledrejection',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('空堆栈的泛化 Unhandled rejection 会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('empty-generic-unhandled-rejection', {
            content: '[auto][unhandledrejection] Unhandled rejection',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'splendor',
            gameName: 'client',
            errorName: 'UnhandledRejection',
            errorMessage: 'Unhandled rejection',
            errorSource: 'window.unhandledrejection',
            stack: '',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('钱包扩展注入 ethereum 的噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('extension-ethereum-injection-noise', {
            content: '[auto][unhandledrejection] Cannot redefine property: ethereum',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: 'Cannot redefine property: ethereum',
            errorSource: 'window.unhandledrejection',
            stack: 'TypeError: Cannot redefine property: ethereum\n    at Object.defineProperty (<anonymous>)\n    at chrome-extension://mfgccjchihfkkindfppnaooecgfneiii/inpage.js:144:113558',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('扩展 inpage 脚本 sseError 噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('extension-sse-error-noise', {
            content: '[auto][unhandledrejection] func sseError not found',
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'Error',
            errorMessage: 'func sseError not found',
            errorSource: 'window.unhandledrejection',
            stack: 'Error: func sseError not found\n    at Object.<anonymous> (chrome-extension://cadiboklkpojfamcoggejbbdjcoiljjk/inpage.js:250:19715)',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('纯浏览器扩展栈的空节点 removeAttribute 报错会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('extension-remove-attribute-null-noise', {
            content: "[auto][unhandledrejection] Cannot read properties of null (reading 'removeAttribute')",
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: "Cannot read properties of null (reading 'removeAttribute')",
            errorSource: 'window.unhandledrejection',
            stack: "TypeError: Cannot read properties of null (reading 'removeAttribute')\n    at chrome-extension://iikmkjmpaadaobahmlepeloendndfphd/userscript.html?name=testcsdn.user.js&id=b6de601d-911a-4bd4-b2a6-f3c385814ac5:16:17\n    at Object.<anonymous> (chrome-extension://iikmkjmpaadaobahmlepeloendndfphd/userscript.html?name=testcsdn.user.js&id=b6de601d-911a-4bd4-b2a6-f3c385814ac5:25:3)",
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('扩展栈混入站内帧时仍会上报', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('extension-with-app-frame', {
            content: "[auto][unhandledrejection] Cannot read properties of null (reading 'removeAttribute')",
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: "Cannot read properties of null (reading 'removeAttribute')",
            errorSource: 'window.unhandledrejection',
            stack: "TypeError: Cannot read properties of null (reading 'removeAttribute')\n    at chrome-extension://iikmkjmpaadaobahmlepeloendndfphd/userscript.html:16:17\n    at reportAppError (https://easyboardgame.top/assets/index-Cmi8y5la.js:120:15)",
        });

        expect(getFeedbackFetchCalls()).toHaveLength(1);
    });

    it('Cloudflare 统计脚本 readyState 噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('cloudflare-beacon-ready-state-noise', {
            content: "[auto][unhandledrejection] Cannot read properties of undefined (reading 'readyState')",
            autoReportKind: 'unhandled-rejection',
            source: 'client-unhandled-rejection',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: "Cannot read properties of undefined (reading 'readyState')",
            errorSource: 'window.unhandledrejection',
            stack: "TypeError: Cannot read properties of undefined (reading 'readyState')\n    at r.onreadystatechange (https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496:1:12345)\n    at <anonymous>:1:32811",
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it.each([
        [
            'this.i.at is not a function',
            'TypeError: this.i.at is not a function\n    at e.u (https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496:1:136)',
        ],
        [
            't.entries.at is not a function',
            'TypeError: t.entries.at is not a function\n    at https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496:1:5773',
        ],
    ])('Cloudflare 统计脚本的旧 Safari at 兼容噪音会被过滤：%s', async (message, stack) => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce(`cloudflare-beacon-at-noise:${message}`, {
            content: `[auto][window.error] ${message}`,
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: message,
            errorSource: `https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496:1:136`,
            stack,
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('Cloudflare 堆栈中混入站内调用时不会按 at 兼容噪音过滤', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('cloudflare-beacon-at-with-app-frame', {
            content: '[auto][window.error] t.entries.at is not a function',
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: 't.entries.at is not a function',
            errorSource: 'https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496:1:5773',
            stack: 'TypeError: t.entries.at is not a function\n    at https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496:1:5773\n    at reportMetric (https://easyboardgame.top/src/lib/metrics.ts:12:3)',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(1);
    });

    it('dice-box-threejs 第三方渲染空值噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('dice-box-null-trim-render-noise', {
            content: "[auto][window.error] Cannot read properties of null (reading 'trim')",
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'client',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: "Cannot read properties of null (reading 'trim')",
            errorSource: 'https://easyboardgame.top/assets/dice-box-threejs.es-C-evTbCv.js:3105:314',
            stack: "TypeError: Cannot read properties of null (reading 'trim')\n    at new ou (https://easyboardgame.top/assets/dice-box-threejs.es-C-evTbCv.js:3105:314)\n    at Object._ [as acquireProgram] (https://easyboardgame.top/assets/dice-box-threejs.es-C-evTbCv.js:3109:9979)",
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('Script error. 浏览器通用噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('generic-script-error', {
            content: '[auto][window.error] Script error.',
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'Error',
            errorMessage: 'Script error.',
            errorSource: 'window.error',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('ResizeObserver 循环通知会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('resize-observer-loop-noise', {
            content: '[auto][window.error] ResizeObserver loop completed with undelivered notifications.',
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'summonerwars',
            gameName: 'summonerwars',
            errorName: 'Error',
            errorMessage: 'ResizeObserver loop completed with undelivered notifications.',
            errorSource: 'window.error',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('匿名页面级注入脚本的全局未定义噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        window.history.replaceState({}, '', '/?homeStyle=classic');
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('anonymous-global-reference-noise', {
            content: '[auto][window.error] LIDNotifyId is not defined',
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'ReferenceError',
            errorMessage: 'LIDNotifyId is not defined',
            errorSource: 'https://easyboardgame.top/?homeStyle=classic:1:1',
            stack: 'ReferenceError: LIDNotifyId is not defined\n    at <anonymous>:1:1',
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('匿名页面级注入脚本的属性读取噪音会被过滤，不进入自动反馈', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        window.history.replaceState({}, '', '/?homeStyle=classic');
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('anonymous-property-read-noise', {
            content: "[auto][window.error] Cannot read properties of undefined (reading 'logout')",
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: "Cannot read properties of undefined (reading 'logout')",
            errorSource: 'https://easyboardgame.top/?homeStyle=classic:1:26',
            stack: "TypeError: Cannot read properties of undefined (reading 'logout')\n    at <anonymous>:1:26",
        });

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('站内真实堆栈的 window error 不会被匿名注入噪音规则误过滤', async () => {
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');

        await reportClientAutoFeedbackOnce('real-app-window-error', {
            content: "[auto][window.error] Cannot read properties of undefined (reading 'logout')",
            autoReportKind: 'window-error',
            source: 'client-window-error',
            gameId: 'unknown',
            gameName: 'client',
            errorName: 'TypeError',
            errorMessage: "Cannot read properties of undefined (reading 'logout')",
            errorSource: 'https://easyboardgame.top/src/components/social/UserMenu.tsx:320:15',
            stack: "TypeError: Cannot read properties of undefined (reading 'logout')\n    at handleLogout (https://easyboardgame.top/src/components/social/UserMenu.tsx:320:15)",
        });

        expect(getFeedbackFetchCalls()).toHaveLength(1);
    });
});
