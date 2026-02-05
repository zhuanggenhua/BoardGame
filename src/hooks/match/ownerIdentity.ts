import type { TFunction } from 'i18next';

const GUEST_ID_KEY = 'guest_id';
const GUEST_ID_COOKIE_KEY = 'bg_guest_id';

/**
 * 多重存储策略：localStorage + sessionStorage + cookie
 * 确保 guestId 在各种浏览器设置下都能持久化
 */
const readGuestId = (): string | null => {
    if (typeof window === 'undefined') return null;
    
    // 优先读取 localStorage
    const fromLocal = localStorage.getItem(GUEST_ID_KEY);
    if (fromLocal) return fromLocal;
    
    // 回退到 sessionStorage（同一标签页内有效）
    const fromSession = sessionStorage.getItem(GUEST_ID_KEY);
    if (fromSession) return fromSession;
    
    // 回退到 cookie（跨标签页有效）
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === GUEST_ID_COOKIE_KEY && value) {
            return decodeURIComponent(value);
        }
    }
    
    return null;
};

const writeGuestId = (id: string): void => {
    if (typeof window === 'undefined') return;
    
    // 写入所有存储，确保至少一个生效
    try {
        localStorage.setItem(GUEST_ID_KEY, id);
    } catch {
        // localStorage 可能被禁用或已满
    }
    
    try {
        sessionStorage.setItem(GUEST_ID_KEY, id);
    } catch {
        // sessionStorage 可能被禁用
    }
    
    // 写入 cookie，有效期 30 天
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${GUEST_ID_COOKIE_KEY}=${encodeURIComponent(id)}; expires=${expires}; path=/; SameSite=Lax`;
};

/**
 * 生成 4 位数字 ID（1000-9999）
 */
const generateGuestId = (): string => {
    return String(Math.floor(Math.random() * 9000) + 1000);
};

export const getOrCreateGuestId = (): string => {
    if (typeof window === 'undefined') return 'guest';
    
    const existing = readGuestId();
    if (existing) {
        // 同步到所有存储（修复部分存储丢失的情况）
        writeGuestId(existing);
        return existing;
    }
    
    const id = generateGuestId();
    writeGuestId(id);
    return id;
};

export const getGuestName = (t: TFunction, guestId?: string): string => {
    const id = guestId || getOrCreateGuestId();
    return t('player.guest', { id, ns: 'lobby' });
};

export const getOwnerKey = (userId?: string | null, guestId?: string): string => {
    if (userId) return `user:${userId}`;
    const resolvedGuestId = guestId || getOrCreateGuestId();
    return `guest:${resolvedGuestId}`;
};

export const getOwnerType = (userId?: string | null): 'user' | 'guest' => (userId ? 'user' : 'guest');
