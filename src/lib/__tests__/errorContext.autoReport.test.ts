// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/server', () => ({
    FEEDBACK_API_URL: '/feedback',
    IS_DEV_API_DISABLED: false,
}));

const getFeedbackFetchCalls = () => (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(([input]) => String(input) === '/feedback');

describe('errorContext 自动反馈', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        window.localStorage.clear();
        window.history.replaceState({}, '', '/play/smashup/match/match-2');
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
            text: async () => '',
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        const host = window as Window & {
            __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean;
            __BG_ERROR_CONTEXT_CAPTURE_INSTALLED__?: boolean;
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
        delete host.__BG_ERROR_CONTEXT_CAPTURE_INSTALLED__;
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
    });

    it('window error 会自动上报并写入最近错误上下文', async () => {
        const { installGlobalErrorContextCapture, getLastErrorContext } = await import('../feedback/errorContext');
        installGlobalErrorContextCapture();

        const errorEvent = new Event('error') as Event & {
            error?: Error;
            message?: string;
            filename?: string;
            lineno?: number;
            colno?: number;
        };
        errorEvent.error = new Error('window boom');
        errorEvent.message = 'window boom';
        errorEvent.filename = '/src/App.tsx';
        errorEvent.lineno = 12;
        errorEvent.colno = 34;
        window.dispatchEvent(errorEvent);

        await Promise.resolve();

        expect(getFeedbackFetchCalls()).toHaveLength(1);
        expect(getLastErrorContext()).toMatchObject({
            name: 'Error',
            message: 'window boom',
        });
        const body = JSON.parse(String(getFeedbackFetchCalls()[0]?.[1]?.body ?? '{}'));
        expect(body).toMatchObject({
            source: 'client-window-error',
            autoReportKind: 'window-error',
            errorContext: {
                message: 'window boom',
                jsStack: expect.stringContaining('window boom'),
            },
        });
    });

    it('unhandledrejection 会自动上报', async () => {
        const { installGlobalErrorContextCapture } = await import('../feedback/errorContext');
        installGlobalErrorContextCapture();

        const rejectionEvent = new Event('unhandledrejection') as Event & { reason?: unknown };
        rejectionEvent.reason = new Error('promise boom');
        window.dispatchEvent(rejectionEvent);

        await Promise.resolve();

        const body = JSON.parse(String(getFeedbackFetchCalls()[0]?.[1]?.body ?? '{}'));
        expect(body).toMatchObject({
            source: 'client-unhandled-rejection',
            autoReportKind: 'unhandled-rejection',
            errorContext: {
                message: 'promise boom',
            },
        });
    });

    it('stale chunk 类错误不会自动上报', async () => {
        const { installGlobalErrorContextCapture } = await import('../feedback/errorContext');
        installGlobalErrorContextCapture();

        const rejectionEvent = new Event('unhandledrejection') as Event & { reason?: unknown };
        rejectionEvent.reason = new Error('ChunkLoadError: Loading chunk 42 failed');
        window.dispatchEvent(rejectionEvent);

        await Promise.resolve();

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('动态导入模块加载失败不会自动上报', async () => {
        const { installGlobalErrorContextCapture } = await import('../feedback/errorContext');
        installGlobalErrorContextCapture();

        const rejectionEvent = new Event('unhandledrejection') as Event & { reason?: unknown };
        rejectionEvent.reason = new Error('error loading dynamically imported module: https://easyboardgame.top/assets/cursor-BonIRdwH.js');
        window.dispatchEvent(rejectionEvent);

        await Promise.resolve();

        expect(getFeedbackFetchCalls()).toHaveLength(0);
    });

    it('旧 Android 壳缺少 App 插件的 unhandledrejection 不会自动上报，但会保留最近错误上下文', async () => {
        const { installGlobalErrorContextCapture, getLastErrorContext } = await import('../feedback/errorContext');
        installGlobalErrorContextCapture();

        const rejectionEvent = new Event('unhandledrejection') as Event & { reason?: unknown };
        rejectionEvent.reason = new Error('"App" plugin is not implemented on android');
        window.dispatchEvent(rejectionEvent);

        await Promise.resolve();

        expect(getFeedbackFetchCalls()).toHaveLength(0);
        expect(getLastErrorContext()).toMatchObject({
            name: 'Error',
            message: '"App" plugin is not implemented on android',
            source: 'window.unhandledrejection',
        });
    });

    it('音频设备启动失败的 unhandledrejection 不会自动上报，但会保留最近错误上下文', async () => {
        const { installGlobalErrorContextCapture, getLastErrorContext } = await import('../feedback/errorContext');
        installGlobalErrorContextCapture();

        const rejectionEvent = new Event('unhandledrejection') as Event & { reason?: unknown };
        rejectionEvent.reason = Object.assign(new Error('Failed to start the audio device'), {
            name: 'InvalidStateError',
        });
        window.dispatchEvent(rejectionEvent);

        await Promise.resolve();

        expect(getFeedbackFetchCalls()).toHaveLength(0);
        expect(getLastErrorContext()).toMatchObject({
            name: 'InvalidStateError',
            message: 'Failed to start the audio device',
            source: 'window.unhandledrejection',
        });
    });

    it('Script error. 的 window error 不会自动上报，但会保留最近错误上下文', async () => {
        const { installGlobalErrorContextCapture, getLastErrorContext } = await import('../feedback/errorContext');
        installGlobalErrorContextCapture();

        const errorEvent = new Event('error') as Event & {
            error?: Error;
            message?: string;
            filename?: string;
            lineno?: number;
            colno?: number;
        };
        errorEvent.message = 'Script error.';
        errorEvent.filename = 'window.error';
        window.dispatchEvent(errorEvent);

        await Promise.resolve();

        expect(getFeedbackFetchCalls()).toHaveLength(0);
        expect(getLastErrorContext()).toMatchObject({
            name: 'Error',
            message: 'Script error.',
        });
    });
});
