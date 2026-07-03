import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadDiceThroneDiceBoxSkin } from '../ui/diceThroneDiceBoxSkins';

describe('DiceThrone 骰盒皮肤画布导出', () => {
    const originalImage = globalThis.Image;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

    afterEach(() => {
        globalThis.Image = originalImage;
        HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
        vi.restoreAllMocks();
    });

    it('骰面图集污染画布导致 toDataURL 抛安全异常时，会回退到安全骰面图', async () => {
        class AutoLoadImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            crossOrigin = '';
            complete = false;
            naturalWidth = 512;
            naturalHeight = 512;
            private _src = '';

            get src() {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                this.complete = true;
                queueMicrotask(() => this.onload?.());
            }
        }

        globalThis.Image = AutoLoadImage as unknown as typeof Image;

        let callCount = 0;
        HTMLCanvasElement.prototype.toDataURL = vi.fn(() => {
            callCount += 1;
            if (callCount % 2 === 1) {
                throw new DOMException('Tainted canvases may not be exported.', 'SecurityError');
            }
            return 'data:image/png;base64,ZmFsbGJhY2s=';
        });

        const skin = await loadDiceThroneDiceBoxSkin('monk-dice', 'zh-CN');

        expect(Object.keys(skin.faceImages)).toHaveLength(6);
        expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(12);
        expect(skin.faceImages[1].src).toBe('data:image/png;base64,ZmFsbGJhY2s=');
    });
});
