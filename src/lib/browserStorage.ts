export type BrowserStorageKind = 'local' | 'session';

export function getBrowserStorage(kind: BrowserStorageKind): Storage | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
        return storage ?? null;
    } catch {
        return null;
    }
}

export const getLocalStorage = () => getBrowserStorage('local');
export const getSessionStorage = () => getBrowserStorage('session');

export function readLocalStorageItem(key: string): string | null {
    const storage = getLocalStorage();
    if (!storage) {
        return null;
    }

    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

export function writeLocalStorageItem(key: string, value: string): boolean {
    const storage = getLocalStorage();
    if (!storage) {
        return false;
    }

    try {
        storage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function removeLocalStorageItem(key: string): boolean {
    const storage = getLocalStorage();
    if (!storage) {
        return false;
    }

    try {
        storage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

export function readSessionStorageItem(key: string): string | null {
    const storage = getSessionStorage();
    if (!storage) {
        return null;
    }

    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

export function writeSessionStorageItem(key: string, value: string): boolean {
    const storage = getSessionStorage();
    if (!storage) {
        return false;
    }

    try {
        storage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}
