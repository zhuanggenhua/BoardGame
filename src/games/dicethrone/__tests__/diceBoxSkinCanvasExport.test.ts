import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadDiceThroneDiceBoxSkin } from '../ui/diceThroneDiceBoxSkins';

describe('DiceThrone 骰盒皮肤画布导出', () => {
    const originalImage = globalThis.Image;

    afterEach(() => {
        globalThis.Image = originalImage;
        vi.restoreAllMocks();
    });

    it('用正式骰面素材生成画布贴图，不再导出 dataURL 给第三方文本材质', async () => {
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
        const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');

        const skin = await loadDiceThroneDiceBoxSkin('monk-dice', 'zh-CN');

        expect(Object.keys(skin.faceCanvases)).toHaveLength(6);
        expect(Object.keys(skin.faceImages)).toHaveLength(6);
        expect('preferPresetMaterials' in skin).toBe(false);
        expect(skin.faceCanvases[1].width).toBe(1024);
        expect(skin.faceCanvases[1].height).toBe(1024);
        expect(skin.faceImages[1]).toBe(skin.faceCanvases[1]);
        expect(skin.edgeCanvas.width).toBe(1024);
        expect(skin.edgeCanvas.height).toBe(1024);
        expect(toDataURLSpy).not.toHaveBeenCalled();
    });
});
