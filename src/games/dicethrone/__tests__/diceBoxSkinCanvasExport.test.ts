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

    it('用正式骰面素材导出透明符号层给插件原生骰体', async () => {
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
        HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,test-symbol');

        const skin = await loadDiceThroneDiceBoxSkin('monk-dice', 'zh-CN');

        expect(Object.keys(skin.faceCanvases)).toHaveLength(6);
        expect(Object.keys(skin.faceImages)).toHaveLength(6);
        expect(skin.preferPresetMaterials).toBe(true);
        expect(skin.faceCanvases[1].width).toBe(512);
        expect(skin.faceCanvases[1].height).toBe(512);
        expect(skin.edgeCanvas.width).toBe(512);
        expect(skin.edgeCanvas.height).toBe(512);
        expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(6);
    });
});
