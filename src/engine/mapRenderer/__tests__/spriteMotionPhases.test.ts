import { describe, expect, it } from 'vitest';
import { collectSpriteMotionPhases } from '../spriteMotionModel';

describe('sprite motion phases', () => {
    it('emits a hop landing at travel end and settles only after the landing window', () => {
        const state = { landingEmitted: false, settledEmitted: false };
        expect(collectSpriteMotionPhases({ progress: 299 / 300, complete: false }, 'hop', state)).toEqual([]);
        expect(collectSpriteMotionPhases({ progress: 1, complete: false }, 'hop', state)).toEqual(['landing']);
        expect(collectSpriteMotionPhases({ progress: 1, complete: false }, 'hop', state)).toEqual([]);
        expect(collectSpriteMotionPhases({ progress: 1, complete: true }, 'hop', state)).toEqual(['settled']);
        expect(collectSpriteMotionPhases({ progress: 1, complete: true }, 'hop', state)).toEqual([]);
    });

    it('emits landing and settled once on the same step for reduced-motion hops', () => {
        const state = { landingEmitted: false, settledEmitted: false };
        expect(collectSpriteMotionPhases({ progress: 1, complete: true }, 'hop', state)).toEqual(['landing', 'settled']);
        expect(collectSpriteMotionPhases({ progress: 1, complete: true }, 'hop', state)).toEqual([]);
    });

    it('settles fades without reporting a hop landing', () => {
        const state = { landingEmitted: false, settledEmitted: false };
        expect(collectSpriteMotionPhases({ progress: 1, complete: true }, 'fade', state)).toEqual(['settled']);
        expect(collectSpriteMotionPhases({ progress: 1, complete: true }, 'fade', state)).toEqual([]);
    });

    it('settles room reveals without adding a landing phase', () => {
        const state = { landingEmitted: false, settledEmitted: false };
        expect(collectSpriteMotionPhases({ progress: 1, complete: true }, 'reveal', state)).toEqual(['settled']);
        expect(collectSpriteMotionPhases({ progress: 1, complete: true }, 'reveal', state)).toEqual([]);
    });
});
