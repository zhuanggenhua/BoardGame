import { getLocalStorage } from './browserStorage';

/** Legacy preview URL now redirects to the active modern/classic home. */
export const HOME_V2_PREVIEW_PATH = '/dev/home-v2-preview';
export const HOME_ENTRY_STYLE_STORAGE_KEY = 'bg_home_entry_style';
export const HOME_ENTRY_STYLE_QUERY_VERSION_KEY = 'homeStyleVersion';
export const HOME_ENTRY_STYLE_VERSION = 'modern-classic-v2';
const HOME_ENTRY_STYLE_STORAGE_VERSION_KEY = 'bg_home_entry_style_version';

export type HomeEntryStyle = 'modern' | 'classic';

const HOME_ENTRY_STYLE_CHANGE_EVENT = 'bg-home-entry-style-change';

function normalizeHomeEntryStyle(value: string | null | undefined): HomeEntryStyle | null {
    if (value === 'modern' || value === 'classic') {
        return value;
    }
    if (value === 'book') {
        return 'modern';
    }
    return null;
}

function readHomeEntryStyleParam(search: string | URLSearchParams) {
    const searchParams = typeof search === 'string' ? new URLSearchParams(search) : search;
    return normalizeHomeEntryStyle(searchParams.get('homeStyle'));
}

function migrateStoredHomeEntryStyleIfNeeded() {
    const storage = getLocalStorage();
    if (!storage) {
        return;
    }

    try {
        const storedStyle = storage.getItem(HOME_ENTRY_STYLE_STORAGE_KEY);
        const storedVersion = storage.getItem(HOME_ENTRY_STYLE_STORAGE_VERSION_KEY);

        if (storedStyle === 'book') {
            storage.setItem(HOME_ENTRY_STYLE_STORAGE_KEY, 'modern');
        }
        if (storedVersion !== HOME_ENTRY_STYLE_VERSION) {
            storage.setItem(HOME_ENTRY_STYLE_STORAGE_VERSION_KEY, HOME_ENTRY_STYLE_VERSION);
        }
    } catch {
        // Ignore storage failures and fall back to the modern home.
    }
}

const normalizePathname = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

export function isHomeEntryRoute(pathname: string) {
    const normalizedPathname = normalizePathname(pathname);
    return normalizedPathname === '/' || normalizedPathname === '/index.html';
}

export function resolveHomeEntryStyle(search: string | URLSearchParams = ''): HomeEntryStyle {
    migrateStoredHomeEntryStyleIfNeeded();
    const queryStyle = readHomeEntryStyleParam(search);
    if (queryStyle) {
        return queryStyle;
    }

    const storage = getLocalStorage();
    try {
        return normalizeHomeEntryStyle(storage?.getItem(HOME_ENTRY_STYLE_STORAGE_KEY)) ?? 'modern';
    } catch {
        return 'modern';
    }
}

export function persistHomeEntryStyle(style: HomeEntryStyle) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        const storage = getLocalStorage();
        storage?.setItem(HOME_ENTRY_STYLE_STORAGE_KEY, style);
        storage?.setItem(HOME_ENTRY_STYLE_STORAGE_VERSION_KEY, HOME_ENTRY_STYLE_VERSION);
    } catch {
        // Keep the current session usable when storage is unavailable.
    }

    window.dispatchEvent(new CustomEvent<HomeEntryStyle>(HOME_ENTRY_STYLE_CHANGE_EVENT, { detail: style }));
}

export function subscribeHomeEntryStyleChange(listener: () => void) {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    const handleStorage = (event: StorageEvent) => {
        if (event.key === HOME_ENTRY_STYLE_STORAGE_KEY) {
            listener();
        }
    };
    const handleCustomEvent = () => {
        listener();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(HOME_ENTRY_STYLE_CHANGE_EVENT, handleCustomEvent);

    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(HOME_ENTRY_STYLE_CHANGE_EVENT, handleCustomEvent);
    };
}
