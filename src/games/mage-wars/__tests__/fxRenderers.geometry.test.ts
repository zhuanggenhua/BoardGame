import { describe, expect, it } from 'vitest';
import { percentBoxToViewport } from '../ui/fxRenderers';

describe('Mage Wars FX percent viewport conversion', () => {
    it('maps a percent box into viewport coordinates relative to its host', () => {
        const host = { left: 100, top: 50, width: 400, height: 200 } as DOMRect;

        expect(percentBoxToViewport({ left: 25, top: 10, width: 40, height: 50 }, host)).toEqual({
            left: 200,
            top: 70,
            width: 160,
            height: 100,
        });
    });
});
