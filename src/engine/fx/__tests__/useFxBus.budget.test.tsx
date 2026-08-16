import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FxRegistry } from '../FxRegistry';
import { useFxBus } from '../useFxBus';
import type { FxRendererProps } from '../types';
import { resetFxFrameClockForTests } from '../frameClock';

const NoopRenderer = (_props: FxRendererProps): null => null;

describe('useFxBus budget scheduling', () => {
  afterEach(() => {
    resetFxFrameClockForTests();
    vi.unstubAllGlobals();
  });

  it('降级同一帧连续触发的高成本特效', () => {
    const registry = new FxRegistry();
    registry.register('fx.test.high', NoopRenderer, {
      budget: {
        estimatedCost: 'high',
        allowAutoReduce: true,
        reduceWhenHighCostActiveAt: 1,
      },
    });

    const { result } = renderHook(() => useFxBus(registry, {
      quality: 'full',
      reduceWhenHighCostActiveAt: 1,
    }));

    act(() => {
      result.current.push('fx.test.high', { cell: { row: 0, col: 0 } });
      result.current.push('fx.test.high', { cell: { row: 0, col: 1 } });
    });

    expect(result.current.activeEffects).toHaveLength(2);
    expect(result.current.activeEffects[0].ctx.quality).toBe('full');
    expect(result.current.activeEffects[1].ctx.quality).toBe('reduced');
    expect(result.current.activeEffects[1].params?.quality).toBe('reduced');
  });

  it('设置为 reduced 时首个高成本特效也直接降级', () => {
    const registry = new FxRegistry();
    registry.register('fx.test.high', NoopRenderer, {
      budget: {
        estimatedCost: 'high',
      },
    });

    const { result } = renderHook(() => useFxBus(registry, { quality: 'reduced' }));

    act(() => {
      result.current.push('fx.test.high', { cell: { row: 0, col: 0 } });
    });

    expect(result.current.activeEffects).toHaveLength(1);
    expect(result.current.activeEffects[0].ctx.quality).toBe('reduced');
    expect(result.current.activeEffects[0].params?.quality).toBe('reduced');
  });

  it('把渲染管线 DPR 上限写入 FX 事件参数', () => {
    const registry = new FxRegistry();
    registry.register('fx.test.high', NoopRenderer, {
      budget: {
        estimatedCost: 'high',
        maxDpr: 1.5,
        reducedMaxDpr: 1,
      },
    });

    const { result } = renderHook(() => useFxBus(registry, {
      maxDpr: 1.25,
      reducedMaxDpr: 1,
    }));

    act(() => {
      result.current.push('fx.test.high', { cell: { row: 0, col: 0 } });
    });

    expect(result.current.activeEffects[0].params?.maxDpr).toBe(1.25);
    expect(result.current.activeEffects[0].params?.reducedMaxDpr).toBe(1);
  });

  it('高成本特效超过拒绝阈值时跳过新特效', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new FxRegistry();
    registry.register('fx.test.high', NoopRenderer, {
      budget: {
        estimatedCost: 'high',
        dropWhenHighCostActiveAt: 1,
      },
    });

    const { result } = renderHook(() => useFxBus(registry));

    let firstId: string | null = null;
    let secondId: string | null = null;
    act(() => {
      firstId = result.current.push('fx.test.high', { cell: { row: 0, col: 0 } });
      secondId = result.current.push('fx.test.high', { cell: { row: 0, col: 1 } });
    });

    expect(firstId).not.toBeNull();
    expect(secondId).toBeNull();
    expect(result.current.activeEffects).toHaveLength(1);
    expect(result.current.activeEffects[0].id).toBe(firstId);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('高成本特效超过预算'));
    warnSpy.mockRestore();
  });

  it('同一帧内连续入队只通知渲染层一次', () => {
    const pendingFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const registry = new FxRegistry();
    registry.register('fx.test.low', NoopRenderer, { timeoutMs: 0 });

    const { result } = renderHook(() => useFxBus(registry));
    const listener = vi.fn();
    const unsubscribe = result.current.subscribe?.(listener);

    act(() => {
      result.current.push('fx.test.low', { cell: { row: 0, col: 0 } });
      result.current.push('fx.test.low', { cell: { row: 0, col: 1 } });
    });

    expect(result.current.activeEffects).toHaveLength(2);
    expect(listener).not.toHaveBeenCalled();
    expect(pendingFrames).toHaveLength(1);

    act(() => {
      pendingFrames.shift()?.(100);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe?.();
  });

  it('安全超时通过共享帧时钟移除特效', () => {
    const pendingFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const registry = new FxRegistry();
    registry.register('fx.test.timeout', NoopRenderer, { timeoutMs: 32 });

    const { result } = renderHook(() => useFxBus(registry));

    act(() => {
      result.current.push('fx.test.timeout', { cell: { row: 0, col: 0 } });
    });
    expect(result.current.activeEffects).toHaveLength(1);

    act(() => {
      pendingFrames.shift()?.(100);
      pendingFrames.shift()?.(116);
    });
    expect(result.current.activeEffects).toHaveLength(1);

    act(() => {
      pendingFrames.shift()?.(132);
    });
    expect(result.current.activeEffects).toHaveLength(0);
  });

  it('序列步骤 delayAfter 通过共享帧时钟推进', () => {
    const pendingFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const registry = new FxRegistry();
    registry.register('fx.test.first', NoopRenderer, { timeoutMs: 0 });
    registry.register('fx.test.second', NoopRenderer, { timeoutMs: 0 });

    const { result } = renderHook(() => useFxBus(registry));

    act(() => {
      result.current.pushSequence([
        { cue: 'fx.test.first', ctx: { cell: { row: 0, col: 0 } }, delayAfter: 32 },
        { cue: 'fx.test.second', ctx: { cell: { row: 0, col: 1 } } },
      ]);
    });

    const firstId = result.current.activeEffects[0]?.id;
    expect(firstId).toBeTruthy();

    act(() => {
      result.current.removeEffect(firstId!);
    });
    expect(result.current.activeEffects).toHaveLength(0);

    act(() => {
      pendingFrames.shift()?.(100);
      pendingFrames.shift()?.(116);
    });
    expect(result.current.activeEffects).toHaveLength(0);

    act(() => {
      pendingFrames.shift()?.(132);
    });
    expect(result.current.activeEffects).toHaveLength(1);
    expect(result.current.activeEffects[0].cue).toBe('fx.test.second');
  });
});
