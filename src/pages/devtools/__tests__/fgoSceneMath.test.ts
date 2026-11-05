import { describe, expect, it } from 'vitest';
import { clipValues, gradient, integrateCurve, keyCurve, sampleCurve } from '../cutscene/fgoSceneMath';

describe('FGO source animation curves', () => {
  it('uses streamed initial values and keys just before zero without evaluating the sentinel time', () => {
    const clip = { name: 'eye_open', duration: 1 / 30, sampleRate: 30, scalarCount: 2, constants: [],
      frames: [
        { time: -3.4028234663852886e38, keys: [[0, [0, 0, 0, 1]], [1, [0, 0, 0, 2]]] },
        { time: -7.450580596923828e-9, keys: [[0, [0, 0, 3, 1]]] },
      ] };
    const values = clipValues(clip as Parameters<typeof clipValues>[0], 0, false, true);
    expect(values[0]).toBeCloseTo(1);
    expect(values[1]).toBe(2);
    expect(values.every(Number.isFinite)).toBe(true);
  });
  it('evaluates both authored gradient bounds and their independent alpha tracks', () => {
    const red = { r: 1, g: 0, b: 0, a: 1 };
    const blue = { r: 0, g: 0, b: 1, a: 1 };
    const data = { state: 3, minColor: red, maxColor: blue,
      keys: [{ time: 0, color: blue }], alphaKeys: [{ time: 0, alpha: 1 }],
      minKeys: [{ time: 0, color: red }], minAlphaKeys: [{ time: 0, alpha: 0 }, { time: 1, alpha: 1 }] };
    expect(gradient(data, 0.5, 0)).toEqual({ ...red, a: 0.5 });
    expect(gradient(data, 0.5, 1)).toEqual(blue);
    expect(gradient(data, 0.5, 0.25)).toEqual({ r: 0.75, g: 0, b: 0.25, a: 0.625 });
  });
  it('applies the shared multiplier to both random curve bounds, not constantMin', () => {
    const curve = { state: 2, scalar: 10, minScalar: 0,
      minKeys: [{ time: 0, value: -1 }], keys: [{ time: 0, value: 2 }] };
    expect(sampleCurve(curve, 0.5, 0)).toBe(-10);
    expect(sampleCurve(curve, 0.5, 0.5)).toBe(5);
    expect(sampleCurve(curve, 0.5, 1)).toBe(20);
    expect(sampleCurve({ ...curve, state: 3 }, 0.5, 0.5)).toBe(5);
  });

  it('holds a stepped Unity key until the next key, then jumps exactly', () => {
    const keys = [
      { time: 11.608659744262695, value: -4.35, outSlope: -284.0266 },
      { time: 13.484013557434082, value: 12, stepIn: true },
    ];
    expect(keyCurve(keys, 11.9)).toBe(-4.35);
    expect(keyCurve(keys, 13.484013557434082)).toBe(12);
  });

  it('keeps ordinary Hermite interpolation between finite tangents', () => {
    expect(keyCurve([
      { time: 0, value: 0, outSlope: 0 },
      { time: 1, value: 10, inSlope: 0 },
    ], 0.5)).toBe(5);
  });

  it('integrates angular velocity instead of multiplying its last value by age', () => {
    const curve = { state: 1, scalar: 1, minScalar: 0,
      keys: [{ time: 0, value: 0, outSlope: 2 }, { time: 1, value: 2, inSlope: 2 }] };
    expect(integrateCurve(curve, 0, 0.5)).toBeCloseTo(0.25);
    expect(integrateCurve(curve, 0, 1)).toBeCloseTo(1);
    expect(integrateCurve(curve, 0, 0.3) + integrateCurve(curve, 0.3, 1)).toBeCloseTo(1);
    expect(integrateCurve({ ...curve, state: 2, scalar: 4, minKeys: [{ time: 0, value: -1 }] }, 0, 1, 0.25)).toBeCloseTo(-2);
    expect(integrateCurve({ ...curve, keys: [{ time: 0, value: 3, outSlope: Infinity }, { time: 0.5, value: 1 }] }, 0, 1)).toBeCloseTo(2);
  });
});
