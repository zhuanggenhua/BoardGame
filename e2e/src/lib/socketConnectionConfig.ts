/**
 * 统一管理 socket.io 的握手策略。
 * 生产环境默认优先 websocket，避免慢链路上重连风暴。
 * 开发/测试环境允许 polling 回退，但仍优先 websocket，避免不必要的长轮询延迟。
 */
export const SOCKET_CONNECT_TIMEOUT_MS = 30_000;
export const SOCKET_COMPATIBILITY_MODE_STORAGE_KEY = 'boardgame.socketCompatibilityMode';

export type SocketIoTransport = 'websocket' | 'polling';

const SOCKET_IO_TRANSPORTS_DEFAULT: SocketIoTransport[] = ['websocket'];
const SOCKET_IO_TRANSPORTS_COMPATIBILITY: SocketIoTransport[] = ['websocket', 'polling'];
const SOCKET_IO_TRANSPORTS_DEV_FALLBACK: SocketIoTransport[] = ['websocket', 'polling'];

const metaEnv = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const isDev = metaEnv.DEV === true;
const mode = typeof metaEnv.MODE === 'string' ? metaEnv.MODE : '';
const isAndroidShellBuild = mode === 'android';
const allowPollingOverride = metaEnv.VITE_SOCKET_ALLOW_POLLING === 'true';
const allowPollingByEnvironment = isDev || mode === 'test' || isAndroidShellBuild || allowPollingOverride;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

/**
 * 开发/测试、Android 壳和显式 env 覆盖始终允许 polling，便于调试或规避 WebView / 代理链路不稳定。
 * 纯 Web 生产环境保留本地兼容模式开关，用于 websocket-only 被网络拦截时的降级。
 */
export const canToggleSocketCompatibilityMode = () => !allowPollingByEnvironment;

export const isSocketCompatibilityModeEnabled = (): boolean => {
    if (allowPollingByEnvironment) {
        return true;
    }
    if (!canUseStorage()) {
        return false;
    }
    return window.localStorage.getItem(SOCKET_COMPATIBILITY_MODE_STORAGE_KEY) === 'true';
};

export const setSocketCompatibilityModeEnabled = (enabled: boolean): void => {
    if (!canUseStorage() || allowPollingByEnvironment) {
        return;
    }

    if (enabled) {
        window.localStorage.setItem(SOCKET_COMPATIBILITY_MODE_STORAGE_KEY, 'true');
        return;
    }

    window.localStorage.removeItem(SOCKET_COMPATIBILITY_MODE_STORAGE_KEY);
};

export const getSocketIoTransports = (): SocketIoTransport[] => {
    if (allowPollingByEnvironment) {
        return [...SOCKET_IO_TRANSPORTS_DEV_FALLBACK];
    }

    return isSocketCompatibilityModeEnabled()
        ? [...SOCKET_IO_TRANSPORTS_COMPATIBILITY]
        : [...SOCKET_IO_TRANSPORTS_DEFAULT];
};

export const shouldTryAllSocketTransports = (): boolean => getSocketIoTransports().length > 1;
