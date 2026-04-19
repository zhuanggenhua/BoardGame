/* @vitest-environment happy-dom */
/**
 * useVisualStateBuffer 单元测试
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisualStateBuffer } from '../useVisualStateBuffer';

describe('useVisualStateBuffer', () => {
  it('初始状态：无快照', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    expect(result.current.snapshot).toBeNull();
    expect(result.current.isBuffering).toBe(false);
  });

  it('get 无快照时返回 fallback', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    expect(result.current.get('3-4', 5)).toBe(5);
  });

  it('freeze → get 返回快照值', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => { result.current.freeze('3-4', 2); });
    expect(result.current.isBuffering).toBe(true);
    expect(result.current.get('3-4', 5)).toBe(2);
    // 未冻结的 key 仍返回 fallback
    expect(result.current.get('0-0', 10)).toBe(10);
  });

  it('freezeBatch 批量冻结', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => {
      result.current.freezeBatch([
        { key: '3-4', value: 2 },
        { key: '5-6', value: 0 },
      ]);
    });
    expect(result.current.get('3-4', 99)).toBe(2);
    expect(result.current.get('5-6', 99)).toBe(0);
    expect(result.current.isBuffering).toBe(true);
  });

  it('release 释放指定 key，其余保留', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => {
      result.current.freezeBatch([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
      ]);
    });
    act(() => { result.current.release(['a']); });
    expect(result.current.get('a', 99)).toBe(99); // 已释放
    expect(result.current.get('b', 99)).toBe(2);  // 仍冻结
    expect(result.current.isBuffering).toBe(true);
  });

  it('release 全部 key 后 isBuffering 变 false', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => { result.current.freeze('a', 1); });
    act(() => { result.current.release(['a']); });
    expect(result.current.isBuffering).toBe(false);
    expect(result.current.snapshot).toBeNull();
  });

  it('clear 清空所有快照', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => {
      result.current.freezeBatch([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
      ]);
    });
    act(() => { result.current.clear(); });
    expect(result.current.isBuffering).toBe(false);
    expect(result.current.get('a', 99)).toBe(99);
    expect(result.current.get('b', 99)).toBe(99);
  });

  it('freeze 覆盖已有 key', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => { result.current.freeze('a', 1); });
    act(() => { result.current.freeze('a', 3); });
    expect(result.current.get('a', 99)).toBe(3);
  });

  it('release 不存在的 key 不报错', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => { result.current.freeze('a', 1); });
    act(() => { result.current.release(['nonexistent']); });
    expect(result.current.get('a', 99)).toBe(1);
    expect(result.current.isBuffering).toBe(true);
  });

  it('无快照时 release/clear 不报错', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => { result.current.release(['a']); });
    act(() => { result.current.clear(); });
    expect(result.current.isBuffering).toBe(false);
  });

  it('freezeBatch 空数组不创建快照', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => { result.current.freezeBatch([]); });
    expect(result.current.isBuffering).toBe(false);
  });

  it('snapshot 只读 Map 包含正确内容', () => {
    const { result } = renderHook(() => useVisualStateBuffer());
    act(() => {
      result.current.freezeBatch([
        { key: 'x', value: 10 },
        { key: 'y', value: 20 },
      ]);
    });
    const snap = result.current.snapshot;
    expect(snap).not.toBeNull();
    expect(snap!.get('x')).toBe(10);
    expect(snap!.get('y')).toBe(20);
    expect(snap!.size).toBe(2);
  });
});
