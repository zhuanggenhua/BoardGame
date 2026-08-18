/* @vitest-environment happy-dom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVisualEntityBuffer } from '../useVisualEntityBuffer';

interface TestEntity {
  id: string;
  label: string;
  damage?: number;
}

describe('useVisualEntityBuffer', () => {
  it('初始状态没有视觉保留实体', () => {
    const { result } = renderHook(() => useVisualEntityBuffer<TestEntity>());

    expect(result.current.snapshot).toBeNull();
    expect(result.current.heldSnapshots).toEqual([]);
    expect(result.current.isHolding).toBe(false);
  });

  it('按 owner 持有并释放实体快照', () => {
    const { result } = renderHook(() => useVisualEntityBuffer<TestEntity>());
    const entity = { id: 'unit-1', label: '目标' };

    act(() => {
      result.current.hold('fx-1', [{ id: entity.id, snapshot: entity }]);
    });

    expect(result.current.isHolding).toBe(true);
    expect(result.current.getSnapshot(entity.id)).toEqual(entity);
    expect(result.current.heldSnapshots).toEqual([entity]);

    act(() => {
      result.current.releaseOwner('fx-1');
    });

    expect(result.current.isHolding).toBe(false);
    expect(result.current.getSnapshot(entity.id)).toBeNull();
  });

  it('多个 owner 持有同一实体时只在最后一个 owner 释放后移除', () => {
    const { result } = renderHook(() => useVisualEntityBuffer<TestEntity>());
    const entity = { id: 'unit-1', label: '目标' };

    act(() => {
      result.current.hold('projectile-fx', [{ id: entity.id, snapshot: entity }]);
      result.current.hold('death-exit-fx', [{ id: entity.id, snapshot: entity }]);
    });

    act(() => {
      result.current.releaseOwner('projectile-fx');
    });

    expect(result.current.getSnapshot(entity.id)).toEqual(entity);
    expect(result.current.snapshot?.get(entity.id)?.owners.has('death-exit-fx')).toBe(true);

    act(() => {
      result.current.releaseOwner('death-exit-fx');
    });

    expect(result.current.getSnapshot(entity.id)).toBeNull();
    expect(result.current.snapshot).toBeNull();
  });

  it('可把预备 owner 转移成真实 FX id 后再释放', () => {
    const { result } = renderHook(() => useVisualEntityBuffer<TestEntity>());
    const entity = { id: 'unit-1', label: '目标' };

    act(() => {
      result.current.hold('pending:event-1', [{ id: entity.id, snapshot: entity }]);
      result.current.transferOwner('pending:event-1', 'fx-attack-1');
    });

    expect(result.current.snapshot?.get(entity.id)?.owners.has('pending:event-1')).toBe(false);
    expect(result.current.snapshot?.get(entity.id)?.owners.has('fx-attack-1')).toBe(true);

    act(() => {
      result.current.releaseOwner('pending:event-1');
    });
    expect(result.current.getSnapshot(entity.id)).toEqual(entity);

    act(() => {
      result.current.releaseOwner('fx-attack-1');
    });
    expect(result.current.getSnapshot(entity.id)).toBeNull();
  });

  it('实体已经在真实列表中时可过滤避免重影', () => {
    const { result } = renderHook(() => useVisualEntityBuffer<TestEntity>());
    const a = { id: 'unit-a', label: 'A' };
    const b = { id: 'unit-b', label: 'B' };

    act(() => {
      result.current.hold('fx-1', [
        { id: a.id, snapshot: a },
        { id: b.id, snapshot: b },
      ]);
    });

    expect(result.current.getHeldSnapshots(new Set(['unit-a']))).toEqual([b]);
    expect(result.current.getHeldEntries(['unit-b']).map((entry) => entry.id)).toEqual(['unit-a']);
  });

  it('同一实体被后续 owner 再持有时保留首次快照，避免动画中途跳变', () => {
    const { result } = renderHook(() => useVisualEntityBuffer<TestEntity>());
    const beforeHit = { id: 'unit-1', label: '目标', damage: 0 };
    const afterHit = { id: 'unit-1', label: '目标', damage: 4 };

    act(() => {
      result.current.hold('fx-hit', [{ id: beforeHit.id, snapshot: beforeHit }]);
      result.current.hold('fx-exit', [{ id: afterHit.id, snapshot: afterHit }]);
    });

    expect(result.current.getSnapshot('unit-1')).toEqual(beforeHit);
  });

  it('空 owner 或空实体 id 直接暴露调用错误', () => {
    const { result } = renderHook(() => useVisualEntityBuffer<TestEntity>());

    expect(() => {
      act(() => {
        result.current.hold('', [{ id: 'unit-1', snapshot: { id: 'unit-1', label: '目标' } }]);
      });
    }).toThrow(/ownerId/);

    expect(() => {
      act(() => {
        result.current.hold('fx-1', [{ id: '', snapshot: { id: '', label: '目标' } }]);
      });
    }).toThrow(/entity id/);
  });
});
