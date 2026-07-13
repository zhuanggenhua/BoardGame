import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FxRegistry } from '../FxRegistry';
import { useFxBus } from '../useFxBus';
import type { FxRendererProps } from '../types';

const NoopRenderer = (_props: FxRendererProps): null => null;

describe('useFxBus budget scheduling', () => {
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
});
