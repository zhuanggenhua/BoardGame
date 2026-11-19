import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(path.resolve('src/lib/preloadRecoveryBootstrap.js'), 'utf8');
const storageKey = 'bg_failed_module_preload';

function runBootstrap(initial?: string, userAgent = 'Mozilla/5.0 AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15') {
    const storage = new Map<string, string>();
    if (initial) storage.set(storageKey, JSON.stringify([initial]));
    const scripts: Array<{ type: string; textContent: string }> = [];
    let errorListener: ((event: { target: unknown }) => void) | undefined;
    const win = {
        location: new URL('https://example.test/play/smashup'),
        navigator: { userAgent },
        sessionStorage: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => { storage.set(key, value); },
            removeItem: (key: string) => { storage.delete(key); },
        },
        addEventListener: (_name: string, listener: typeof errorListener) => { errorListener = listener; },
        __BG_MODULE_PRELOAD_RECOVERY__: undefined as undefined | { prepare(): void; clear(): void },
    };
    const doc = {
        createElement: () => ({ type: '', textContent: '' }),
        head: { appendChild: (script: { type: string; textContent: string }) => { scripts.push(script); } },
    };
    runInNewContext(source, { window: win, document: doc, URL, Date, JSON });
    return { win, storage, scripts, dispatchError: (target: unknown) => errorListener?.({ target }) };
}

describe('模块预加载失败恢复启动脚本', () => {
    it('会话存储不可用时跨刷新保留失败模块与刷新标记，不覆盖路由状态', () => {
        const url = 'https://example.test/assets/lazy-AbCd1234.js';
        const scripts: Array<{ type: string; textContent: string }> = [];
        let listener: ((event: { target: unknown }) => void) | undefined;
        const history = {
            state: { usr: { screen: 'room' }, key: 'abc', idx: 2 } as Record<string, unknown>,
            replaceState(state: Record<string, unknown>) { this.state = state; },
        };
        const win = {
            location: new URL('https://example.test/play/smashup?tab=1#room'), history,
            get sessionStorage(): Storage { throw new DOMException('blocked', 'SecurityError'); },
            addEventListener: (_name: string, callback: typeof listener) => { listener = callback; },
            __BG_MODULE_PRELOAD_RECOVERY__: undefined as undefined | {
                prepare(): void; getGuard(): string | null; setGuard(value: string): void;
            },
        };
        const doc = { createElement: () => ({ type: '', textContent: '' }), head: { appendChild: (script: { type: string; textContent: string }) => scripts.push(script) } };
        const boot = () => runInNewContext(source, { window: win, document: doc, URL, Date, JSON });
        boot();
        listener?.({ target: { tagName: 'LINK', rel: 'modulepreload', href: url } });
        win.__BG_MODULE_PRELOAD_RECOVERY__!.prepare();
        win.__BG_MODULE_PRELOAD_RECOVERY__!.setGuard('vite:preloadError\n/play/smashup?tab=1#room');
        boot();
        expect(JSON.parse(scripts[0].textContent).imports[url]).toMatch(/\?bg-preload-retry=/);
        expect(win.__BG_MODULE_PRELOAD_RECOVERY__!.getGuard()).toBe('vite:preloadError\n/play/smashup?tab=1#room');
        expect(history.state).toMatchObject({ usr: { screen: 'room' }, key: 'abc', idx: 2 });
        expect(win.location.href).toBe('https://example.test/play/smashup?tab=1#room');
    });

    it('会话存储可读但写入失败时优先使用较新的历史标记', () => {
        const history = {
            state: { key: 'route-key' } as Record<string, unknown>,
            replaceState(state: Record<string, unknown>) { this.state = state; },
        };
        const win = {
            location: new URL('https://example.test/'), history,
            sessionStorage: { getItem: () => 'old-location', setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: () => {} },
            addEventListener: () => {},
            __BG_MODULE_PRELOAD_RECOVERY__: undefined as undefined | { getGuard(): string | null; setGuard(value: string): void },
        };
        const doc = { createElement: () => ({ type: '', textContent: '' }), head: { appendChild: () => {} } };
        runInNewContext(source, { window: win, document: doc, URL, Date, JSON });
        win.__BG_MODULE_PRELOAD_RECOVERY__!.setGuard('new-location');
        expect(win.__BG_MODULE_PRELOAD_RECOVERY__!.getGuard()).toBe('new-location');
        expect(history.state).toMatchObject({ key: 'route-key' });
    });

    it('历史状态不是对象时不覆盖其他调用方的状态', () => {
        const history = { state: 'other-owner', replaceState: vi.fn() };
        const win = {
            location: new URL('https://example.test/'), history,
            get sessionStorage(): Storage { throw new DOMException('blocked', 'SecurityError'); },
            addEventListener: () => {},
            __BG_MODULE_PRELOAD_RECOVERY__: undefined as undefined | { setGuard(value: string): void },
        };
        const doc = { createElement: () => ({ type: '', textContent: '' }), head: { appendChild: () => {} } };
        runInNewContext(source, { window: win, document: doc, URL, Date, JSON });
        expect(() => win.__BG_MODULE_PRELOAD_RECOVERY__!.setGuard('guard')).toThrow();
        expect(history.state).toBe('other-owner');
        expect(history.replaceState).not.toHaveBeenCalled();
    });
    it('只对已记录的同源构建模块生成一次重试映射', () => {
        const url = 'https://example.test/assets/lazy-AbCd1234.js';
        const { scripts, storage } = runBootstrap(url);
        expect(storage.has(storageKey)).toBe(false);
        expect(scripts).toHaveLength(1);
        expect(scripts[0].type).toBe('importmap');
        expect(JSON.parse(scripts[0].textContent).imports[url]).toMatch(/^https:\/\/example\.test\/assets\/lazy-AbCd1234\.js\?bg-preload-retry=[a-z0-9]+-[a-z0-9]+$/);
        expect(JSON.parse(runBootstrap(url).scripts[0].textContent).imports[url]).not.toBe(JSON.parse(scripts[0].textContent).imports[url]);
        expect(runBootstrap().scripts).toHaveLength(0);
    });

    it('拒绝外站、带参数、无指纹和非构建目录的地址', () => {
        for (const url of [
            'https://evil.test/assets/lazy-AbCd1234.js',
            'https://example.test/assets/lazy-AbCd1234.js?token=private',
            'https://example.test/assets/lazy.js',
            'https://example.test/private/lazy-AbCd1234.js',
        ]) expect(runBootstrap(url).scripts).toHaveLength(0);
    });

    it('不同浏览器标识均可恢复，不依赖可伪装的 UA', () => {
        const url = 'https://example.test/assets/lazy-AbCd1234.js';
        const chromium = 'Mozilla/5.0 AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36';
        const iosChrome = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/145.0 Mobile Safari/604.1';
        expect(runBootstrap(url, chromium).scripts).toHaveLength(1);
        expect(runBootstrap(url, iosChrome).scripts).toHaveLength(1);
    });

    it('仅记录近期的模块预加载错误，并支持取消待重试', () => {
        vi.useFakeTimers();
        try {
            const url = 'https://example.test/assets/lazy-AbCd1234.js';
            const result = runBootstrap();
            result.dispatchError({ tagName: 'LINK', rel: 'stylesheet', href: url });
            result.win.__BG_MODULE_PRELOAD_RECOVERY__!.prepare();
            expect(result.storage.has(storageKey)).toBe(false);
            result.dispatchError({ tagName: 'LINK', rel: 'modulepreload', href: url });
            result.win.__BG_MODULE_PRELOAD_RECOVERY__!.prepare();
            expect(JSON.parse(result.storage.get(storageKey)!)).toEqual([url]);
            result.win.__BG_MODULE_PRELOAD_RECOVERY__!.clear();
            expect(result.storage.has(storageKey)).toBe(false);
            vi.advanceTimersByTime(8001);
            result.win.__BG_MODULE_PRELOAD_RECOVERY__!.prepare();
            expect(result.storage.has(storageKey)).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('同一轮多个模块失败时都保留，并限制记录数量', () => {
        const result = runBootstrap();
        const urls = Array.from({ length: 35 }, (_, i) => `https://example.test/assets/chunk${i}-AbCd1234.js`);
        for (const href of urls) result.dispatchError({ tagName: 'LINK', rel: 'modulepreload', href });
        result.win.__BG_MODULE_PRELOAD_RECOVERY__!.prepare();
        expect(JSON.parse(result.storage.get(storageKey)!)).toEqual(urls.slice(-32));
    });
});
