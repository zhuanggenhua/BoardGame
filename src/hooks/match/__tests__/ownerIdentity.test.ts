import { describe, expect, it, beforeEach } from 'vitest';
import { getOrCreateGuestId, getGuestName } from '../ownerIdentity';

describe('游客身份', () => {
    beforeEach(() => { localStorage.removeItem('guest_id'); sessionStorage.removeItem('guest_id'); document.cookie = 'bg_guest_id=; Max-Age=0; path=/'; });
    it('新身份使用长随机标识并跨读取保持，显示名称不暴露完整标识', () => {
        const id = getOrCreateGuestId();
        expect(id.length).toBeGreaterThan(20);
        expect(getOrCreateGuestId()).toBe(id);
        const t = ((_key: string, opts: { id: string }) => `游客${opts.id}`) as Parameters<typeof getGuestName>[0];
        expect(getGuestName(t, id)).toBe(`游客${id.slice(-4)}`);
    });
    it('保留已有游客身份，避免旧房间无法恢复', () => {
        localStorage.setItem('guest_id', '6433');
        expect(getOrCreateGuestId()).toBe('6433');
    });
});
