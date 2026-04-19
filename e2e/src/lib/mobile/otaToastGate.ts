const STORAGE_PREFIX = 'android-ota-toast-daily';

const buildStorageKey = (key: string) => `${STORAGE_PREFIX}:${key}`;

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const shouldShowAndroidOtaToastOncePerDay = (key: string, now: Date = new Date()) => {
    if (!key || !key.trim()) {
        return true;
    }

    if (typeof window === 'undefined' || !window.localStorage) {
        return true;
    }

    try {
        const storageKey = buildStorageKey(key);
        const today = formatLocalDate(now);
        const last = window.localStorage.getItem(storageKey);
        if (last === today) {
            return false;
        }
        window.localStorage.setItem(storageKey, today);
        return true;
    } catch {
        return true;
    }
};
