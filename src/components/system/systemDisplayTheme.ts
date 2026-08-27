import { readLocalStorageItem, writeLocalStorageItem } from '../../lib/browserStorage';

export type SystemDisplayTheme = 'light' | 'night';

export const SYSTEM_DISPLAY_THEME_STORAGE_KEY = 'system_display_theme';
export const SYSTEM_DISPLAY_THEME_CHANGE_EVENT = 'system-display-theme-change';

export const normalizeSystemDisplayTheme = (value: unknown): SystemDisplayTheme => (
    value === 'night' ? 'night' : 'light'
);

export const readSystemDisplayThemePreference = (): SystemDisplayTheme => (
    normalizeSystemDisplayTheme(readLocalStorageItem(SYSTEM_DISPLAY_THEME_STORAGE_KEY))
);

export const applySystemDisplayThemeToDocument = (theme: SystemDisplayTheme) => {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.systemDisplayTheme = theme;
    document.body.dataset.systemDisplayTheme = theme;
    document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light';
};
export const persistSystemDisplayThemePreference = (theme: SystemDisplayTheme) => {
    const normalizedTheme = normalizeSystemDisplayTheme(theme);

    writeLocalStorageItem(SYSTEM_DISPLAY_THEME_STORAGE_KEY, normalizedTheme);
    applySystemDisplayThemeToDocument(normalizedTheme);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SYSTEM_DISPLAY_THEME_CHANGE_EVENT, {
            detail: { theme: normalizedTheme },
        }));
    }

    return normalizedTheme;
};

export const subscribeSystemDisplayThemeChange = (listener: (theme: SystemDisplayTheme) => void) => {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    const handleThemeChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ theme?: unknown }>;
        listener(normalizeSystemDisplayTheme(customEvent.detail?.theme));
    };

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key !== SYSTEM_DISPLAY_THEME_STORAGE_KEY) {
            return;
        }
        listener(normalizeSystemDisplayTheme(event.newValue));
    };

    window.addEventListener(SYSTEM_DISPLAY_THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener(SYSTEM_DISPLAY_THEME_CHANGE_EVENT, handleThemeChange);
        window.removeEventListener('storage', handleStorageChange);
    };
};
