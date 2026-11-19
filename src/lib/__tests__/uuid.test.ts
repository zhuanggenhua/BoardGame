import { describe, expect, it, vi } from 'vitest';

describe('UUID 存储不可用', () => {
    it('浏览器拒绝访问会话存储时仍能加载模块并生成 UUID', async () => {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
        Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            get() { throw new DOMException('blocked', 'SecurityError'); },
        });
        vi.resetModules();
        try {
            const { generateUUID } = await import('../uuid');
            expect(generateUUID()).toMatch(/^[\da-f-]{36}$/i);
            vi.stubGlobal('crypto', {});
            vi.spyOn(console, 'error').mockImplementation(() => {});
            expect(generateUUID()).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
            if (descriptor) Object.defineProperty(window, 'sessionStorage', descriptor);
            vi.resetModules();
        }
    });
});
