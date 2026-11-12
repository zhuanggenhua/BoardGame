import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    current: vi.fn(), list: vi.fn(), download: vi.fn(), next: vi.fn(), set: vi.fn(),
    reload: vi.fn(), setMultiDelay: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
    registerPlugin: () => ({}),
}));
vi.mock('@capgo/capacitor-updater', () => ({
    CapacitorUpdater: { ...mocks, notifyAppReady: vi.fn(), addListener: vi.fn(async () => ({ remove: async () => undefined })) },
}));

const env = { VITE_ANDROID_OTA_ENABLED: 'true', VITE_ANDROID_OTA_MANIFEST_URL: 'https://example.com/latest.json', VITE_ANDROID_OTA_CHANNEL: 'stable' };
const bundle = { id: 'new', version: '6.0.0-ota-2026-11-12', status: 'success', checksum: 'abc', downloaded: 'now' };

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'Capacitor', { configurable: true, value: { isNativePlatform: () => true, getPlatform: () => 'android' } });
    mocks.current.mockResolvedValue({ native: '0.6.0', bundle: { ...bundle, id: 'old', version: '5.0.0' } });
    mocks.list.mockResolvedValue({ bundles: [] });
    mocks.next.mockResolvedValue(bundle);
    mocks.setMultiDelay.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true,
        headers: { get: () => 'application/json' }, json: async () => ({ version: bundle.version, url: 'https://example.com/update.zip', channel: 'stable', forceUpdate: true }) }));
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

describe('Android OTA 安全更新', () => {
    it('旧强制清单的自动检查只下载，不在后台排队切换', async () => {
        mocks.download.mockResolvedValue(bundle);
        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        const result = await startAndroidLiveUpdateBackgroundCheck({ envOverride: env, applyMode: 'background' });
        expect(result).toMatchObject({ status: 'queued', mode: 'background' });
        expect(mocks.set).not.toHaveBeenCalled();
        expect(mocks.setMultiDelay).not.toHaveBeenCalled();
        expect(mocks.next).not.toHaveBeenCalled();
    });
    it('取消后即使下载返回也不会安装或排队', async () => {
        let finish!: (value: typeof bundle) => void;
        mocks.download.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const { startAndroidLiveUpdateBackgroundCheck, cancelAndroidLiveUpdateCheck } = await import('../mobile/androidLiveUpdates');
        const run = startAndroidLiveUpdateBackgroundCheck({ envOverride: env, applyMode: 'immediate' });
        await vi.waitFor(() => expect(mocks.download).toHaveBeenCalled());
        cancelAndroidLiveUpdateCheck();
        finish(bundle);
        expect(await run).toEqual({ status: 'cancelled' });
        expect(mocks.set).not.toHaveBeenCalled();
        expect(mocks.next).not.toHaveBeenCalled();
    });
    it('取消正在检查的更新后，不会继续开始下载', async () => {
        let finish!: (value: unknown) => void;
        const response = { status: 200, ok: true, headers: { get: () => 'application/json' },
            json: async () => ({ version: bundle.version, url: 'https://example.com/update.zip', channel: 'stable' }) };
        vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
        const { startAndroidLiveUpdateBackgroundCheck, cancelAndroidLiveUpdateCheck } = await import('../mobile/androidLiveUpdates');
        const run = startAndroidLiveUpdateBackgroundCheck({ envOverride: env, applyMode: 'immediate' });
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        cancelAndroidLiveUpdateCheck();
        finish(response);
        expect(await run).toEqual({ status: 'cancelled' });
        expect(mocks.download).not.toHaveBeenCalled();
    });
    it('下次启动发现已下载的版本时才切换', async () => {
        mocks.list.mockResolvedValue({ bundles: [bundle] });
        mocks.set.mockResolvedValue(undefined);
        mocks.reload.mockResolvedValue(undefined);
        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        await startAndroidLiveUpdateBackgroundCheck({ envOverride: env, applyMode: 'background' });
        expect(mocks.download).not.toHaveBeenCalled();
        expect(mocks.set).toHaveBeenCalledWith({ id: 'new' });
    });
    it('App 切到后台后不会激活已缓存版本', async () => {
        mocks.list.mockResolvedValue({ bundles: [bundle] });
        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        window.dispatchEvent(new Event('bg-shell-app-hidden'));
        try {
            await startAndroidLiveUpdateBackgroundCheck({ envOverride: env, applyMode: 'background' });
            expect(mocks.set).not.toHaveBeenCalled();
            expect(mocks.next).not.toHaveBeenCalled();
        } finally {
            window.dispatchEvent(new Event('bg-shell-app-visible'));
        }
    });
    it('手动下载期间进入对局时不立即切换', async () => {
        let finish!: (value: typeof bundle) => void;
        mocks.download.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        const run = startAndroidLiveUpdateBackgroundCheck({ envOverride: env, applyMode: 'immediate' });
        await vi.waitFor(() => expect(mocks.download).toHaveBeenCalled());
        window.history.replaceState({}, '', '/play/example');
        finish(bundle);
        await run;
        expect(mocks.set).not.toHaveBeenCalled();
        expect(mocks.next).not.toHaveBeenCalled();
    });
    it('后台下载已经开始时，手动更新可以继续，后台旧结果不再排队', async () => {
        let finish!: (value: typeof bundle) => void;
        mocks.download.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(bundle);
        mocks.set.mockResolvedValue(undefined);
        mocks.reload.mockResolvedValue(undefined);
        const { startAndroidLiveUpdateBackgroundCheck } = await import('../mobile/androidLiveUpdates');
        const background = startAndroidLiveUpdateBackgroundCheck({ envOverride: env, applyMode: 'background' });
        await vi.waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
        const manual = await startAndroidLiveUpdateBackgroundCheck({ envOverride: env, applyMode: 'immediate' });
        expect(manual).toMatchObject({ status: 'queued', mode: 'immediate' });
        expect(mocks.set).toHaveBeenCalledWith({ id: 'new' });
        finish(bundle);
        expect(await background).toEqual({ status: 'cancelled' });
        expect(mocks.next).not.toHaveBeenCalled();
    });
});
