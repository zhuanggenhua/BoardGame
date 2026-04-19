import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../contexts/ToastContext';

describe('ToastContext - Deduplication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should deduplicate toasts with same dedupeKey', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    const { result } = renderHook(() => useToast(), { wrapper });

    // 第一次显示
    act(() => {
      result.current.warning('Test message', undefined, { dedupeKey: 'test.key' });
    });

    expect(result.current.toasts).toHaveLength(1);
    const firstId = result.current.toasts[0].id;

    // 第二次显示（相同 dedupeKey）
    act(() => {
      result.current.warning('Test message', undefined, { dedupeKey: 'test.key' });
    });

    // 应该仍然只有一个 toast
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe(firstId);
  });

  it('should allow multiple toasts without dedupeKey', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    const { result } = renderHook(() => useToast(), { wrapper });

    // 第一次显示
    act(() => {
      result.current.warning('Test message 1');
    });

    expect(result.current.toasts).toHaveLength(1);

    // 第二次显示（无 dedupeKey）
    act(() => {
      result.current.warning('Test message 2');
    });

    // 应该有两个 toast
    expect(result.current.toasts).toHaveLength(2);
  });

  it('should allow toasts with different dedupeKeys', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    const { result } = renderHook(() => useToast(), { wrapper });

    // 第一次显示
    act(() => {
      result.current.warning('Test message 1', undefined, { dedupeKey: 'key1' });
    });

    expect(result.current.toasts).toHaveLength(1);

    // 第二次显示（不同 dedupeKey）
    act(() => {
      result.current.warning('Test message 2', undefined, { dedupeKey: 'key2' });
    });

    // 应该有两个 toast
    expect(result.current.toasts).toHaveLength(2);
  });

  it('should allow new toast after previous one is dismissed', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    const { result } = renderHook(() => useToast(), { wrapper });

    // 第一次显示
    act(() => {
      result.current.warning('Test message', undefined, { dedupeKey: 'test.key' });
    });

    expect(result.current.toasts).toHaveLength(1);
    const firstId = result.current.toasts[0].id;

    // 手动关闭
    act(() => {
      result.current.dismiss(firstId);
    });

    expect(result.current.toasts).toHaveLength(0);

    // 再次显示（相同 dedupeKey）
    act(() => {
      result.current.warning('Test message', undefined, { dedupeKey: 'test.key' });
    });

    // 应该允许显示新的 toast
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).not.toBe(firstId);
  });

  it('should deduplicate repeated toasts in the same act batch', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.warning('Test message', undefined, { dedupeKey: 'batch.key' });
      result.current.warning('Test message', undefined, { dedupeKey: 'batch.key' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].dedupeKey).toBe('batch.key');
  });
});
