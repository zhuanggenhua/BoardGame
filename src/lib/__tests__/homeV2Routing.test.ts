import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalWindowLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

function replaceWindowLocalStorage(storage: Storage | null) {
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => storage,
    });
}

function restoreWindowLocalStorage() {
    if (originalWindowLocalStorageDescriptor) {
        Object.defineProperty(window, 'localStorage', originalWindowLocalStorageDescriptor);
    }
}

describe('home style preference', () => {
    beforeEach(() => {
        restoreWindowLocalStorage();
        window.localStorage.clear();
        vi.resetModules();
    });

    afterEach(() => {
        restoreWindowLocalStorage();
    });

    it('defaults to the current modern home and retains a stored classic choice', async () => {
        const { persistHomeEntryStyle, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('modern');
        persistHomeEntryStyle('classic');
        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('classic');
        expect(window.localStorage.getItem('bg_home_entry_style')).toBe('classic');
    });

    it('restores a modern selection after reload without touching unrelated settings', async () => {
        window.localStorage.setItem('unrelated-setting', 'keep-me');
        const { persistHomeEntryStyle } = await import('../homeV2Routing');
        persistHomeEntryStyle('modern');

        vi.resetModules();
        const { resolveHomeEntryStyle } = await import('../homeV2Routing');
        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('modern');
        expect(window.localStorage.getItem('unrelated-setting')).toBe('keep-me');
    });

    it('migrates a saved book style to modern and leaves other settings unchanged', async () => {
        window.localStorage.setItem('bg_home_entry_style', 'book');
        window.localStorage.setItem('bg_home_entry_style_version', 'classic-default-v1');
        window.localStorage.setItem('unrelated-setting', 'keep-me');
        const { HOME_ENTRY_STYLE_VERSION, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('modern');
        expect(window.localStorage.getItem('bg_home_entry_style')).toBe('modern');
        expect(window.localStorage.getItem('bg_home_entry_style_version')).toBe(HOME_ENTRY_STYLE_VERSION);
        expect(window.localStorage.getItem('unrelated-setting')).toBe('keep-me');
    });

    it('migrates a stored classic choice to modern when the home-style schema version changes', async () => {
        window.localStorage.setItem('bg_home_entry_style', 'classic');
        window.localStorage.setItem('bg_home_entry_style_version', 'modern-classic-v2');
        window.localStorage.setItem('unrelated-setting', 'keep-me');
        const { HOME_ENTRY_STYLE_VERSION, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('modern');
        expect(window.localStorage.getItem('bg_home_entry_style')).toBe('modern');
        expect(window.localStorage.getItem('bg_home_entry_style_version')).toBe(HOME_ENTRY_STYLE_VERSION);
        expect(window.localStorage.getItem('unrelated-setting')).toBe('keep-me');
    });

    it('keeps a classic choice stored under the current home-style schema version', async () => {
        const { HOME_ENTRY_STYLE_VERSION, persistHomeEntryStyle, resolveHomeEntryStyle } = await import('../homeV2Routing');
        persistHomeEntryStyle('classic');

        vi.resetModules();
        const { resolveHomeEntryStyle: resolveAfterReload } = await import('../homeV2Routing');
        expect(resolveAfterReload(new URLSearchParams())).toBe('classic');
        expect(window.localStorage.getItem('bg_home_entry_style')).toBe('classic');
        expect(window.localStorage.getItem('bg_home_entry_style_version')).toBe(HOME_ENTRY_STYLE_VERSION);
    });

    it('accepts modern and classic links and maps the retired book link to modern', async () => {
        const { resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams('homeStyle=modern'))).toBe('modern');
        expect(resolveHomeEntryStyle(new URLSearchParams('homeStyle=classic'))).toBe('classic');
        expect(resolveHomeEntryStyle(new URLSearchParams('homeStyle=book'))).toBe('modern');
        expect(resolveHomeEntryStyle(new URLSearchParams('homeV2Draft=1'))).toBe('modern');
    });

    it('notifies the active page when another control changes the selected style', async () => {
        const { persistHomeEntryStyle, subscribeHomeEntryStyleChange } = await import('../homeV2Routing');
        const onStyleChange = vi.fn();
        const unsubscribe = subscribeHomeEntryStyleChange(onStyleChange);

        persistHomeEntryStyle('classic');

        expect(onStyleChange).toHaveBeenCalledOnce();
        unsubscribe();
    });

    it('recognizes only the homepage URLs as home entry routes', async () => {
        const { isHomeEntryRoute } = await import('../homeV2Routing');

        expect(isHomeEntryRoute('/')).toBe(true);
        expect(isHomeEntryRoute('/index.html')).toBe(true);
        expect(isHomeEntryRoute('/dev/home-v2-preview')).toBe(false);
        expect(isHomeEntryRoute('/dev/home-v2-authoring')).toBe(false);
    });

    it('falls back safely when local storage is unavailable', async () => {
        replaceWindowLocalStorage(null);
        const { persistHomeEntryStyle, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('modern');
        expect(() => persistHomeEntryStyle('modern')).not.toThrow();
    });
});
