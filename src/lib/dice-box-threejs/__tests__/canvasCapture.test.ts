// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { captureDiceCanvas, registerDiceCanvas, unregisterDiceCanvas } from '../canvasCapture';

describe('dice canvas capture', () => {
    it('renders immediately before copying and stops after unregister', () => {
        const source = document.createElement('canvas');
        source.width = 80;
        source.height = 60;
        const order: string[] = [];
        const drawImage = vi.fn(() => order.push('copy'));
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
        try {
            registerDiceCanvas(source, () => order.push('render'));
            const result = captureDiceCanvas(source)!;
            expect([result.width, result.height]).toEqual([80, 60]);
            expect(drawImage).toHaveBeenCalledWith(source, 0, 0);
            expect(order).toEqual(['render', 'copy']);
            unregisterDiceCanvas(source);
            expect(captureDiceCanvas(source)).toBeNull();
        } finally { getContext.mockRestore(); }
    });
});
