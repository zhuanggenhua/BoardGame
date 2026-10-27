// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuthModalSession } from '../useAuthModalSession';

const session = vi.hoisted(() => ({ user: { id: 'alice' } as { id: string } | null }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => session }));
beforeEach(() => { session.user = { id: 'alice' }; });
afterEach(cleanup);
it('同一账户的资料或token更新不关闭窗口', () => {
    const close = vi.fn(); const { rerender } = renderHook(() => useAuthModalSession(true, close));
    session.user = { id: 'alice' }; rerender(); expect(close).not.toHaveBeenCalled();
});
it('另一标签退出后关闭原窗口', () => {
    const close = vi.fn(); const { rerender } = renderHook(() => useAuthModalSession(true, close));
    session.user = null; rerender(); expect(close).toHaveBeenCalledOnce();
});
it('直接切换账户也关闭原窗口', () => {
    const close = vi.fn(); const { rerender } = renderHook(() => useAuthModalSession(true, close));
    session.user = { id: 'bob' }; rerender(); expect(close).toHaveBeenCalledOnce();
});
it('关闭期间换账户，下一次打开绑定新账户', () => {
    const close = vi.fn(); const { rerender } = renderHook(({ open }) => useAuthModalSession(open, close), { initialProps: { open: false } });
    session.user = { id: 'bob' }; rerender({ open: false }); rerender({ open: true });
    expect(close).not.toHaveBeenCalled();
});
