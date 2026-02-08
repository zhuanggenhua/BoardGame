import { describe, expect, it } from 'vitest';
import { resolveLayoutRect, resolveAnchorFromPosition } from '../utils/layout';

describe('UGC layout utils', () => {
  it('resolveLayoutRect 应基于 anchor/pivot/offset 计算像素坐标', () => {
    const rect = resolveLayoutRect(
      {
        anchor: { x: 0.5, y: 0.5 },
        pivot: { x: 0.5, y: 0.5 },
        offset: { x: 10, y: -20 },
        width: 200,
        height: 100,
      },
      { width: 1000, height: 500 }
    );

    expect(rect.x).toBe(410);
    expect(rect.y).toBe(180);
    expect(rect.width).toBe(200);
    expect(rect.height).toBe(100);
  });

  it('resolveAnchorFromPosition 应反推锚点并支持 clamp', () => {
    const anchor = resolveAnchorFromPosition({
      position: { x: 410, y: 180 },
      pivot: { x: 0.5, y: 0.5 },
      offset: { x: 10, y: -20 },
      size: { width: 200, height: 100 },
      canvas: { width: 1000, height: 500 },
    });

    expect(anchor.x).toBeCloseTo(0.5, 4);
    expect(anchor.y).toBeCloseTo(0.5, 4);

    const clamped = resolveAnchorFromPosition({
      position: { x: -200, y: -200 },
      pivot: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      canvas: { width: 1000, height: 500 },
    });

    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });

});
