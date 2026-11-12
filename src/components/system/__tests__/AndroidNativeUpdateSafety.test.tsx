import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    listener: null as null | ((request: { interactive?: boolean }) => void),
    preload: vi.fn(), install: vi.fn(), availability: vi.fn(), prepared: vi.fn(),
}));
vi.mock('../../../lib/mobile/androidRuntime', () => ({ isNativeAndroidRuntime: () => true }));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ warning: vi.fn(), success: vi.fn(), info: vi.fn(), error: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../AndroidNativeUpdateGate', () => ({ AndroidNativeUpdateGate: ({ onDismiss }: { onDismiss: () => void }) => <button onClick={onDismiss}>取消</button> }));
vi.mock('../../../lib/mobile/androidNativeUpdates', () => ({
    HIDDEN_ANDROID_NATIVE_UPDATE_STATE: { phase: 'hidden', blocking: false },
    checkAndroidNativeUpdateAvailability: mocks.availability,
    readPreparedAndroidUpdateState: mocks.prepared,
    startAndroidNativeUpdatePreload: mocks.preload,
    continueAndroidNativeUpdateInstall: mocks.install,
    mapNativeUpdateEventToState: () => ({ phase: 'downloading', blocking: true }),
    readAndroidNativeUpdateConfig: () => ({ enabled: true }),
    subscribeAndroidNativeUpdateRequests: (listener: typeof mocks.listener) => { mocks.listener = listener; return () => {}; },
    subscribeAndroidNativeUpdateState: async () => ({ remove: async () => {} }),
    openAndroidUnknownSourcesSettings: vi.fn(), requestAndroidNativeUpdateCheck: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.listener = null; window.sessionStorage.clear(); });

describe('原生更新取消', () => {
    it('手动 OTA 重载后继续检查并安装已下载的原生更新', async () => {
        vi.resetModules();
        window.sessionStorage.setItem('bg-android-update-check-native-after-ota', '1');
        mocks.availability.mockResolvedValue({ available: true, manifest: { version: '2' } });
        mocks.prepared.mockResolvedValue({ version: '2', status: 'prepared' });
        mocks.install.mockResolvedValue({ status: 'installer-launched' });
        const { AndroidNativeUpdateManager } = await import('../AndroidNativeUpdateManager');
        render(<AndroidNativeUpdateManager />);
        await waitFor(() => expect(mocks.install).toHaveBeenCalledWith('2'));
        expect(window.sessionStorage.getItem('bg-android-update-check-native-after-ota')).toBeNull();
    });
    it('取消手动更新后，迟到的下载结果不打开安装器', async () => {
        vi.resetModules();
        let finish!: (value: { status: string }) => void;
        mocks.availability.mockResolvedValue({ available: true, manifest: { version: '2', forceUpdate: true } });
        mocks.prepared.mockResolvedValue(null);
        mocks.preload.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const { AndroidNativeUpdateManager } = await import('../AndroidNativeUpdateManager');
        render(<AndroidNativeUpdateManager />);
        await waitFor(() => expect(mocks.preload).toHaveBeenCalledTimes(1));
        await act(async () => { mocks.listener?.({ interactive: true }); });
        await waitFor(() => expect(mocks.preload).toHaveBeenCalledTimes(2));
        fireEvent.click(screen.getByText('取消'));
        await act(async () => { finish({ status: 'prepared' }); });
        expect(mocks.install).not.toHaveBeenCalled();
    });
    it('手动下载期间进入外站对局时，不打开安装器', async () => {
        vi.resetModules();
        let finish!: (value: { status: string }) => void;
        mocks.availability.mockResolvedValue({ available: true, manifest: { version: '2', forceUpdate: true } });
        mocks.prepared.mockResolvedValue(null);
        mocks.preload.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const { AndroidNativeUpdateManager } = await import('../AndroidNativeUpdateManager');
        render(<AndroidNativeUpdateManager />);
        await waitFor(() => expect(mocks.preload).toHaveBeenCalledTimes(1));
        await act(async () => { mocks.listener?.({ interactive: true }); });
        await waitFor(() => expect(mocks.preload).toHaveBeenCalledTimes(2));
        window.history.replaceState({}, '', '/external/example');
        await act(async () => { finish({ status: 'prepared' }); });
        expect(mocks.install).not.toHaveBeenCalled();
        window.history.replaceState({}, '', '/');
    });
});
