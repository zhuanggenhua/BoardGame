import { expect, it, vi } from 'vitest';

it('旧 WebView 缺少 Object.hasOwn 时可检查自身属性，包括无原型对象和继承属性', async () => {
    const original = Object.hasOwn;
    try {
        Object.hasOwn = undefined as unknown as typeof Object.hasOwn;
        vi.resetModules();
        await import('../objectHasOwnPolyfill');
        const value = Object.assign(Object.create({ inherited: 1 }), { own: 2 });
        expect(Object.hasOwn(value, 'own')).toBe(true);
        expect(Object.hasOwn(value, 'inherited')).toBe(false);
        expect(Object.hasOwn(Object.assign(Object.create(null), { key: 1 }), 'key')).toBe(true);
        expect(() => Object.hasOwn(null as never, 'key')).toThrow(TypeError);
    } finally {
        Object.hasOwn = original;
    }
});
