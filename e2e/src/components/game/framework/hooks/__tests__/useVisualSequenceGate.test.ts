/* @vitest-environment happy-dom */
/**
 * useVisualSequenceGate — 纯逻辑测试
 *
 * 由于 hook 内部是 ref + state，这里用 renderHook 测试行为。
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisualSequenceGate } from '../useVisualSequenceGate';

describe('useVisualSequenceGate', () => {
  it('初始状态 isVisualBusy 为 false', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    expect(result.current.isVisualBusy).toBe(false);
  });

  it('beginSequence 后 isVisualBusy 为 true', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    act(() => result.current.beginSequence());
    expect(result.current.isVisualBusy).toBe(true);
  });

  it('endSequence 后 isVisualBusy 恢复 false', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    act(() => result.current.beginSequence());
    act(() => result.current.endSequence());
    expect(result.current.isVisualBusy).toBe(false);
  });

  it('scheduleInteraction 在序列外立即执行', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    const fn = vi.fn();
    act(() => result.current.scheduleInteraction(fn));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('scheduleInteraction 在序列内入队，endSequence 时排空', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    act(() => result.current.beginSequence());
    act(() => {
      result.current.scheduleInteraction(fn1);
      result.current.scheduleInteraction(fn2);
    });

    // 序列进行中，不应执行
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();

    act(() => result.current.endSequence());

    // 排空后按 FIFO 执行
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(fn1.mock.invocationCallOrder[0]).toBeLessThan(fn2.mock.invocationCallOrder[0]);
  });

  it('嵌套序列：外层 endSequence 才排空队列', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    const fn = vi.fn();

    act(() => {
      result.current.beginSequence(); // depth=1
      result.current.beginSequence(); // depth=2
      result.current.scheduleInteraction(fn);
    });

    act(() => result.current.endSequence()); // depth=1
    expect(fn).not.toHaveBeenCalled();
    expect(result.current.isVisualBusy).toBe(true);

    act(() => result.current.endSequence()); // depth=0
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.isVisualBusy).toBe(false);
  });

  it('endSequence 不会低于 0（防御性）', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    // 多次 endSequence 不报错
    act(() => result.current.endSequence());
    act(() => result.current.endSequence());
    expect(result.current.isVisualBusy).toBe(false);
  });

  it('reset 清空所有状态', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    const fn = vi.fn();

    act(() => {
      result.current.beginSequence();
      result.current.scheduleInteraction(fn);
    });
    expect(result.current.isVisualBusy).toBe(true);

    act(() => result.current.reset());
    expect(result.current.isVisualBusy).toBe(false);
    // 队列被清空，fn 不应被执行
    expect(fn).not.toHaveBeenCalled();

    // reset 后 endSequence 也不会触发已清空的队列
    act(() => result.current.endSequence());
    expect(fn).not.toHaveBeenCalled();
  });

  it('序列无交互时 endSequence 正常结束', () => {
    const { result } = renderHook(() => useVisualSequenceGate());
    act(() => result.current.beginSequence());
    act(() => result.current.endSequence());
    expect(result.current.isVisualBusy).toBe(false);
  });
});
