/* @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useFxAnchorRegistry } from '../anchors';

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => null,
  } as DOMRect;
}

function setRect(element: HTMLElement, value: DOMRect): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => value,
  });
}

describe('useFxAnchorRegistry', () => {
  afterEach(() => {
    cleanup();
  });

  it('resolves visible anchors into surface-local spawn snapshots', () => {
    const surface = document.createElement('div');
    const anchor = document.createElement('div');
    setRect(surface, rect(100, 200, 400, 200));
    setRect(anchor, rect(140, 250, 80, 40));

    const { result } = renderHook(() => useFxAnchorRegistry('test:board', 'board'));

    act(() => {
      result.current.registerSurface(surface);
      result.current.registerAnchor({
        anchorId: 'unit-1',
        anchorKind: 'entity',
        entityRef: 'unit-1',
      })(anchor);
    });

    const snapshot = result.current.resolveSnapshot({
      surfaceId: 'test:board',
      anchorId: 'unit-1',
      anchorKind: 'entity',
    });

    expect(snapshot).toEqual(expect.objectContaining({
      surfaceId: 'test:board',
      anchorId: 'unit-1',
      anchorKind: 'entity',
      entityRef: 'unit-1',
      mode: 'spawn-snapshot',
      box: { left: 10, top: 25, width: 20, height: 20 },
      center: { xPct: 20, yPct: 35 },
      size: { widthPct: 20, heightPct: 20 },
    }));
  });

  it('fails close for unknown anchors and preserves the last snapshot after unmount', () => {
    const surface = document.createElement('div');
    const anchor = document.createElement('div');
    setRect(surface, rect(0, 0, 500, 500));
    setRect(anchor, rect(50, 100, 100, 150));

    const { result } = renderHook(() => useFxAnchorRegistry('test:table', 'table'));
    const registerAnchor = result.current.registerAnchor({
      anchorId: 'base:0',
      anchorKind: 'base',
      entityRef: 'base:0',
    });

    expect(result.current.resolveSnapshot('missing')).toBeNull();

    act(() => {
      result.current.registerSurface(surface);
      registerAnchor(anchor);
    });

    const beforeUnmount = result.current.resolveSnapshot('base:0');
    expect(beforeUnmount?.box).toEqual({ left: 10, top: 20, width: 20, height: 30 });

    act(() => {
      registerAnchor(null);
    });

    const afterUnmount = result.current.resolveSnapshot('base:0');
    expect(afterUnmount?.box).toEqual(beforeUnmount?.box);
    expect(afterUnmount?.capturedAt).toBe(beforeUnmount?.capturedAt);
  });
});
