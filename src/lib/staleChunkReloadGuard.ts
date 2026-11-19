import { STALE_LAZY_MODULE_MARKER } from './lazyModuleExport';

export const STALE_CHUNK_RELOAD_KEY = 'bg_stale_chunk_reload_guard';

export const isStaleChunkError = (value: unknown): boolean => {
    const message = value instanceof Error
        ? `${value.name}: ${value.message}`
        : String(value ?? '');
    const stack = value instanceof Error ? value.stack ?? '' : '';

    const normalized = `${message}\n${stack}`.toLowerCase();
    return normalized.includes(STALE_LAZY_MODULE_MARKER)
        || normalized.includes('failed to fetch dynamically imported module')
        || normalized.includes('error loading dynamically imported module')
        || normalized.includes('outdated optimize dep')
        || normalized.includes('importing a module script failed')
        || normalized.includes('expected a javascript module script')
        || normalized.includes('is not a valid javascript mime type')
        || (normalized.includes("typeerror: cannot read properties of undefined (reading 'default')")
            && normalized.includes('/assets/vendor-react'))
        || normalized.includes('chunkloaderror')
        || normalized.includes('loading chunk');
};

type ReloadOnceDeps = {
    currentLocation: string;
    getStoredLocation: () => string | null;
    setStoredLocation: (value: string) => void;
    reload: () => void;
    shouldReload?: () => boolean;
    warn?: (message: string, payload: { reason: string }) => void;
};

export const reloadForStaleChunkOnceWithDeps = (reason: string, deps: ReloadOnceDeps): boolean => {
    if (deps.shouldReload && !deps.shouldReload()) {
        deps.warn?.('[bootstrap] stale chunk detected after bootstrap window, skip auto reload', { reason });
        return false;
    }

    try {
        const previous = deps.getStoredLocation();
        const guardValue = `${reason}\n${deps.currentLocation}`;
        if (previous === guardValue) {
            return false;
        }
        deps.setStoredLocation(guardValue);
    } catch {
        // 无法持久化刷新标记时，不能保证刷新次数；保留错误供界面提示和手动重试。
        deps.warn?.('[bootstrap] stale chunk reload skipped because session storage is unavailable', { reason });
        return false;
    }

    deps.warn?.('[bootstrap] stale chunk detected, reloading page', { reason });
    deps.reload();
    return true;
};

let lastPreloadFailure: unknown;

export const reloadForStaleChunkOnce = (
    reason: string,
    win: Window = window,
    options?: { shouldReload?: () => boolean; failure?: unknown },
): boolean => {
    if (reason !== 'vite:preloadError' && options?.failure != null && options.failure === lastPreloadFailure) return false;
    const recovery = (win as Window & {
        __BG_MODULE_PRELOAD_RECOVERY__?: { getGuard(): string | null; setGuard(value: string): void };
    }).__BG_MODULE_PRELOAD_RECOVERY__;
    return reloadForStaleChunkOnceWithDeps(reason, {
        currentLocation: `${win.location.pathname}${win.location.search}${win.location.hash}`,
        getStoredLocation: () => recovery ? recovery.getGuard() : win.sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY),
        setStoredLocation: (value: string) => recovery ? recovery.setGuard(value) : win.sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, value),
        reload: () => win.location.reload(),
        shouldReload: options?.shouldReload,
        warn: (message, payload) => console.warn(message, payload),
    });
};

export const installVitePreloadRecovery = (win: Window, shouldReload: () => boolean): void => {
    win.addEventListener('vite:preloadError', (event) => {
        const eligible = shouldReload();
        if (eligible) lastPreloadFailure = (event as Event & { payload?: unknown }).payload;
        const recovery = (win as Window & {
            __BG_MODULE_PRELOAD_RECOVERY__?: { prepare(): void; clear(): void };
        }).__BG_MODULE_PRELOAD_RECOVERY__;
        // 后续错误边界仍可能刷新页面；窗口结束后也需为该次刷新保存失败模块。
        recovery?.prepare();
        reloadForStaleChunkOnce('vite:preloadError', win, { shouldReload: () => eligible });
    });
};
