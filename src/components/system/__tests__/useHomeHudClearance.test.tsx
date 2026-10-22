// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resolveHomeHudClearance, useHomeHudClearance } from '../useHomeHudClearance';
const viewport = vi.hoisted(() => ({ width: 390, height: 844 }));
vi.mock('../../../hooks/ui/useRuntimeViewport', () => ({ useRuntimeViewport: () => viewport }));
let resized: (() => void) | undefined;
beforeEach(() => {
    viewport.width = 390;
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: () => void) { resized = callback; }
        observe() {} disconnect() {}
    });
});
afterEach(() => { cleanup(); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('桌面和游戏路由不改变共享默认，只有手机首页的有效对局条需要避让', () => {
    expect(resolveHomeHudClearance(390, 844, '/', 710)).toBe(146);
    expect(resolveHomeHudClearance(1920, 1080, '/', 990)).toBe(0);
    expect(resolveHomeHudClearance(390, 844, '/play/betrayal', 710)).toBe(0);
    expect(resolveHomeHudClearance(390, 844, '/', null)).toBe(0);
    expect(resolveHomeHudClearance(390, 844, '/', 900)).toBe(0);
});
it('对局条出现、尺寸变化和移除时更新避让区，不改写悬浮球存储', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useHomeHudClearance('/'));
    expect(result.current).toBe(0);
    const banner = document.createElement('div'); banner.className = 'platform-active-match';
    let top = 710;
    vi.spyOn(banner, 'getBoundingClientRect').mockImplementation(() => ({ top, width: 366, height: 70 }) as DOMRect);
    await act(async () => { document.body.append(banner); });
    expect(result.current).toBe(146);
    act(() => { top = 680; resized?.(); });
    expect(result.current).toBe(176);
    await act(async () => { banner.remove(); });
    expect(result.current).toBe(0);
    expect(storage).not.toHaveBeenCalled();
});
