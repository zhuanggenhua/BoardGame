// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/server', () => ({
    FEEDBACK_API_URL: '/feedback',
    IS_DEV_API_DISABLED: false,
}));

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
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__;
        delete (window as Window & { __BG_ERROR_CONTEXT_CAPTURE_INSTALLED__?: boolean }).__BG_ERROR_CONTEXT_CAPTURE_INSTALLED__;
        delete (window as Window & { __BG_LAST_ERROR_CONTEXT__?: unknown }).__BG_LAST_ERROR_CONTEXT__;
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

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(getLastErrorContext()).toMatchObject({
            name: 'Error',
            message: 'window boom',
        });
        const body = JSON.parse(String((globalThis.fetch as any).mock.calls[0]?.[1]?.body ?? '{}'));
        expect(body).toMatchObject({
            source: 'client-window-error',
            autoReportKind: 'window-error',
            errorContext: {
                message: 'window boom',
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

        const body = JSON.parse(String((globalThis.fetch as any).mock.calls[0]?.[1]?.body ?? '{}'));
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

        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});
