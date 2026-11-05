import { describe, expect, it } from 'vitest';
import { resolveSpriteMotionFrame, resolveLandingRippleGeometry } from '../spriteMotionModel';

describe('Pixi sprite motion frames', () => {
    const hop = { id: 'hop', from: { x: 0, y: 0 }, kind: 'hop' as const, durationMs: 300, arcHeight: 16 };

    it('keeps a normal hop duration and its 120ms landing window', () => {
        expect(resolveSpriteMotionFrame(299, hop)).toMatchObject({ progress: 299 / 300, landingProgress: 0, shouldRenderRipple: false, complete: false });
        expect(resolveSpriteMotionFrame(300, hop)).toMatchObject({ progress: 1, landingProgress: 0, shouldRenderRipple: true, complete: false });
        expect(resolveSpriteMotionFrame(420, hop)).toMatchObject({ progress: 1, landingProgress: 1, shouldRenderRipple: true, complete: true });
    });

    it('completes a zero-duration hop without rendering an extra landing ripple', () => {
        expect(resolveSpriteMotionFrame(16, { ...hop, durationMs: 0, landingDurationMs: 0, arcHeight: 0 }))
            .toEqual({ progress: 1, landingProgress: 1, shouldRenderRipple: false, complete: true });
    });

    it('keeps the default landing window when only travel duration is zeroed', () => {
        expect(resolveSpriteMotionFrame(16, { ...hop, durationMs: 0 }))
            .toMatchObject({ progress: 1, landingProgress: 16 / 120, shouldRenderRipple: true, complete: false });
    });

    it('settles room reveals at fade completion without waiting for a hop landing window', () => {
        const reveal = { id: 'reveal', from: { x: 10, y: 20 }, kind: 'reveal' as const, durationMs: 360, startScale: 0.96 };
        expect(resolveSpriteMotionFrame(180, reveal)).toMatchObject({ progress: 0.5, complete: false, shouldRenderRipple: false });
        expect(resolveSpriteMotionFrame(360, reveal)).toMatchObject({ progress: 1, complete: true, shouldRenderRipple: false });
        expect(resolveSpriteMotionFrame(0, { ...reveal, durationMs: 0 })).toMatchObject({ progress: 1, complete: true });
    });
});


describe('landing ripple footprint', () => {
    it('expands under the feet and fades without becoming a second token outline', () => {
        const first = resolveLandingRippleGeometry(80, 80, 0);
        const middle = resolveLandingRippleGeometry(80, 80, .5);
        const end = resolveLandingRippleGeometry(80, 80, 1);
        expect(first.x).toBe(40); expect(first.y).toBe(86);
        expect(middle.radiusX).toBeGreaterThan(first.radiusX);
        expect(middle.radiusY).toBeLessThan(middle.radiusX / 2);
        expect(first.radiusX * 2).toBeCloseTo(56);
        expect(first.y - first.radiusY).toBeGreaterThan(80);
        expect(first.alpha).toBeGreaterThan(.8);
        expect(middle.alpha).toBeGreaterThan(.4);
        expect(end.alpha).toBe(0);
    });
});
