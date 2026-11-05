// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/server', () => ({ FEEDBACK_API_URL: '/feedback', IS_DEV_API_DISABLED: false }));

const payload = {
    content: '[auto][react.error_boundary] broken', autoReportKind: 'react-error',
    gameId: 'dicethrone', gameName: 'dicethrone', errorName: 'TypeError',
    errorMessage: 'render failed', errorSource: 'react.error_boundary', stack: 'App.js:1:12',
};
const feedbackCalls = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.filter(([url]) => url === '/feedback');

describe('自动反馈投递', () => {
    beforeEach(() => {
        vi.resetModules();
        window.localStorage.clear();
        (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ = true;
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        delete (window as Window & { __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean }).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__;
    });

    it('首次请求返回 HTTP 失败时自动重发同一份现场，成功后才去重', async () => {
        let attempts = 0;
        const fetchMock = vi.fn(async (url: unknown) => url === '/feedback' && attempts++ === 0
            ? { ok: false, status: 503 } : { ok: true });
        vi.stubGlobal('fetch', fetchMock);
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');
        await reportClientAutoFeedbackOnce('delivery-http-retry', payload);
        expect(feedbackCalls(fetchMock)).toHaveLength(2);
        expect(feedbackCalls(fetchMock)[0][1].body).toBe(feedbackCalls(fetchMock)[1][1].body);
        await reportClientAutoFeedbackOnce('delivery-http-retry', payload);
        expect(feedbackCalls(fetchMock)).toHaveLength(2);
    });

    it('发送失败时不能把未送达的现场标记为成功', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
        vi.stubGlobal('fetch', fetchMock);
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');
        await reportClientAutoFeedbackOnce('delivery-failure', payload);
        expect(window.localStorage.getItem('bg:auto-feedback:v1:delivery-failure')).toBeNull();
    });

    it('同一页面内去重窗口过期后允许新事故上报', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');
        await reportClientAutoFeedbackOnce('delivery-expired', payload);
        now.mockReturnValue(1_000_000 + 6 * 60 * 60 * 1000 + 1);
        await reportClientAutoFeedbackOnce('delivery-expired', payload);
        expect(feedbackCalls(fetchMock)).toHaveLength(2);
        now.mockRestore();
    });

    it('首次请求尚未完成时并发的相同错误只会共享一次投递', async () => {
        let finish!: (response: { ok: boolean }) => void;
        const pending = new Promise<{ ok: boolean }>(resolve => { finish = resolve; });
        const fetchMock = vi.fn((url: unknown) => url === '/feedback' ? pending : Promise.resolve({ ok: true }));
        vi.stubGlobal('fetch', fetchMock);
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');
        const first = reportClientAutoFeedbackOnce('delivery-in-flight', payload);
        await reportClientAutoFeedbackOnce('delivery-in-flight', payload);
        expect(feedbackCalls(fetchMock)).toHaveLength(1);
        finish({ ok: true });
        await first;
        expect(feedbackCalls(fetchMock)).toHaveLength(1);
    });

    it('在线权威现场无法采集时，反馈本身仍提交并标明采集缺失', async () => {
        window.history.pushState({}, '', '/play/dicethrone/match/m1');
        (window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__ = 'online';
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ _id: '0123456789abcdef01234567' }) });
        vi.stubGlobal('fetch', fetchMock);
        const { reportClientAutoFeedbackOnce } = await import('../feedback/clientAutoReport');
        await reportClientAutoFeedbackOnce('capture-missing', { ...payload, playerId: '0' });
        const body = JSON.parse(feedbackCalls(fetchMock)[0][1].body);
        const packet = JSON.parse(body.diagnosticPacket);
        expect(packet.collectionStatus).toBe('partial');
        expect(packet.collectionErrors).toContain('private_replay_prepare_failed');
        delete (window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__;
        window.history.pushState({}, '', '/');
    });
});
