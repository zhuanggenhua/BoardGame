import { describe, expect, it } from 'vitest';
import { resolveWheelZoom } from '../wheelZoomModel';

const base = { currentZoom: 1, deltaY: -120, deltaMode: 0, pageHeight: 800, minimumZoom: 0.5, maximumZoom: 5 };
describe('map wheel zoom contract', () => {
    it('preserves the existing default sensitivity exactly', () => {
        expect(resolveWheelZoom(base)).toBe(Math.exp(120 * 0.0012));
    });
    it('honors the configured per-notch factor and continuous trackpad deltas', () => {
        expect(resolveWheelZoom({ ...base, wheelZoomFactor: 1.14 })).toBeCloseTo(1.14, 12);
        expect(resolveWheelZoom({ ...base, deltaY: -60, wheelZoomFactor: 1.44 })).toBeCloseTo(1.2, 12);
        const zoomed = resolveWheelZoom({ ...base, wheelZoomFactor: 1.14 });
        expect(resolveWheelZoom({ ...base, currentZoom: zoomed, deltaY: 120, wheelZoomFactor: 1.14 })).toBeCloseTo(1, 12);
    });
    it('normalizes line and page deltas before applying the same factor', () => {
        expect(resolveWheelZoom({ ...base, deltaMode: 1, deltaY: -7.5, wheelZoomFactor: 1.14 })).toBeCloseTo(1.14, 12);
        expect(resolveWheelZoom({ ...base, deltaMode: 2, deltaY: -0.15, wheelZoomFactor: 1.14 })).toBeCloseTo(1.14, 12);
    });
    it('retains zoom bounds and treats unit factor as no wheel zoom', () => {
        expect(resolveWheelZoom({ ...base, currentZoom: 4.9, wheelZoomFactor: 2 })).toBe(5);
        expect(resolveWheelZoom({ ...base, currentZoom: 0.6, deltaY: 120, wheelZoomFactor: 2 })).toBe(0.5);
        expect(resolveWheelZoom({ ...base, wheelZoomFactor: 1 })).toBe(1);
    });
    it.each([0, -1, Number.NaN, Infinity])('retains the default for invalid factor %s', wheelZoomFactor => {
        expect(resolveWheelZoom({ ...base, wheelZoomFactor })).toBe(resolveWheelZoom(base));
    });
});
