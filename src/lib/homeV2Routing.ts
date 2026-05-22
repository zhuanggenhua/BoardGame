import { isAndroidShellBuildMode, isNativeAndroidRuntime } from './mobile/androidRuntime';

export const HOME_V2_PREVIEW_PATH = '/dev/home-v2-preview';
export const HOME_ENTRY_STYLE_STORAGE_KEY = 'bg_home_entry_style';

export type HomeEntryStyle = 'book' | 'classic';

const HOME_ENTRY_STYLE_CHANGE_EVENT = 'bg-home-entry-style-change';

function normalizeHomeEntryStyle(value: string | null | undefined): HomeEntryStyle | null {
    if (value === 'book' || value === 'classic') {
        return value;
    }
    return null;
}

function readHomeEntryStyleParam(search: string | URLSearchParams) {
    const searchParams = typeof search === 'string' ? new URLSearchParams(search) : search;
    return normalizeHomeEntryStyle(searchParams.get('homeStyle'));
}

function readStoredHomeEntryStyle() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return normalizeHomeEntryStyle(window.localStorage.getItem(HOME_ENTRY_STYLE_STORAGE_KEY));
    } catch {
        return null;
    }
}

const normalizePathname = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

function isHomeV2AppRuntimeEnabled() {
    return isAndroidShellBuildMode() || isNativeAndroidRuntime();
}

export function isHomeEntryRoute(pathname: string) {
    const normalizedPathname = normalizePathname(pathname);
    return normalizedPathname === '/' || normalizedPathname === '/index.html';
}

export function isHomeV2PreviewRoute(pathname: string) {
    return normalizePathname(pathname) === HOME_V2_PREVIEW_PATH;
}

export function resolveHomeEntryStyle(search: string | URLSearchParams): HomeEntryStyle {
    const canUseBookHome = isHomeV2AppRuntimeEnabled();
    const queryStyle = readHomeEntryStyleParam(search);
    if (queryStyle === 'classic') {
        return 'classic';
    }
    if (queryStyle === 'book' && canUseBookHome) {
        return 'book';
    }

    const storedStyle = readStoredHomeEntryStyle();
    if (storedStyle === 'classic') {
        return 'classic';
    }
    if (storedStyle === 'book' && canUseBookHome) {
        return 'book';
    }

    return canUseBookHome ? 'book' : 'classic';
}

export function persistHomeEntryStyle(style: HomeEntryStyle) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(HOME_ENTRY_STYLE_STORAGE_KEY, style);
    } catch {
        // ignore storage failures
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

export function isHomeV2DraftEnabled(search: string | URLSearchParams) {
    void search;
    return isHomeV2AppRuntimeEnabled();
}

export function isHomeV2DraftRoute(pathname: string, search: string | URLSearchParams) {
    return normalizePathname(pathname) === '/' && isHomeV2DraftEnabled(search);
}

export function isBookHomeRoute(pathname: string, search: string | URLSearchParams) {
    if (isHomeV2PreviewRoute(pathname)) {
        return true;
    }

    return isHomeEntryRoute(pathname) && resolveHomeEntryStyle(search) === 'book';
}

export function isClassicHomeRoute(pathname: string, search: string | URLSearchParams) {
    return isHomeEntryRoute(pathname) && resolveHomeEntryStyle(search) === 'classic';
}
