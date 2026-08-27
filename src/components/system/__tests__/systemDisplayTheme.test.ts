import { afterEach, describe, expect, it } from 'vitest';
import {
    SYSTEM_DISPLAY_THEME_STORAGE_KEY,
    applySystemDisplayThemeToDocument,
    normalizeSystemDisplayTheme,
    persistSystemDisplayThemePreference,
    readSystemDisplayThemePreference,
    subscribeSystemDisplayThemeChange,
} from '../systemDisplayTheme';

describe('system display theme preference', () => {
    afterEach(() => {
        window.localStorage.clear();
        delete document.documentElement.dataset.systemDisplayTheme;
        delete document.body.dataset.systemDisplayTheme;
        document.documentElement.style.colorScheme = '';
    });

    it('只接受 night，其他存储值回到日间模式', () => {
        expect(normalizeSystemDisplayTheme('night')).toBe('night');
        expect(normalizeSystemDisplayTheme('dark')).toBe('light');
        expect(normalizeSystemDisplayTheme(null)).toBe('light');
    });

    it('读取存储偏好时会归一化为合法主题', () => {
        window.localStorage.setItem(SYSTEM_DISPLAY_THEME_STORAGE_KEY, 'night');
        expect(readSystemDisplayThemePreference()).toBe('night');

        window.localStorage.setItem(SYSTEM_DISPLAY_THEME_STORAGE_KEY, 'unknown');
        expect(readSystemDisplayThemePreference()).toBe('light');
    });

    it('应用主题时同步更新 html 与 body 的页面属性', () => {
        applySystemDisplayThemeToDocument('night');

        expect(document.documentElement.dataset.systemDisplayTheme).toBe('night');
        expect(document.body.dataset.systemDisplayTheme).toBe('night');
        expect(document.documentElement.style.colorScheme).toBe('dark');

        applySystemDisplayThemeToDocument('light');

        expect(document.documentElement.dataset.systemDisplayTheme).toBe('light');
        expect(document.body.dataset.systemDisplayTheme).toBe('light');
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('保存偏好时写入本地存储并通知订阅者', () => {
        const observed: string[] = [];
        const unsubscribe = subscribeSystemDisplayThemeChange((theme) => {
            observed.push(theme);
        });

        persistSystemDisplayThemePreference('night');

        expect(window.localStorage.getItem(SYSTEM_DISPLAY_THEME_STORAGE_KEY)).toBe('night');
        expect(observed).toEqual(['night']);

        unsubscribe();
    });
});
