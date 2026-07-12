import { describe, expect, it, vi } from 'vitest';

import { DiceBoxThreeEngine, type DiceBoxDieSkin } from '../dice-box-threejs/engine';

describe('DiceBoxThreeEngine', () => {
    it('应用 DiceThrone 画布皮肤时不应把画布写入第三方骰子预设 labels', () => {
        const preset = {
            labels: ['', '', '1', '2', '3', '4', '5', '6'],
        };
        const box = {
            DiceFactory: {
                get: vi.fn(() => preset),
                materials_cache: { old: true },
            },
            diceList: [],
        };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as DiceBoxThreeEngine & {
            box: typeof box;
            dieSkins: Array<DiceBoxDieSkin | null>;
            activePresetSkinId: string | null;
        };
        const canvas = document.createElement('canvas');
        const skin: DiceBoxDieSkin = {
            id: 'dicethrone:monk-dice:zh-CN',
            faceCanvases: {
                1: canvas,
                2: canvas,
                3: canvas,
                4: canvas,
                5: canvas,
                6: canvas,
            },
            faceImages: {
                1: canvas,
                2: canvas,
                3: canvas,
                4: canvas,
                5: canvas,
                6: canvas,
            },
        };

        engine.box = box;
        engine.styleProfile = {};
        engine.dieSkins = [];
        engine.activePresetSkinId = null;
        engine.setDieSkins([skin]);

        expect(box.DiceFactory.get).toHaveBeenCalledWith('d6');
        expect(preset.labels).toEqual(['', '', '', '', '', '', '', '']);
        expect(box.DiceFactory.materials_cache).toEqual({});
    });

    it('只有显式字符串标签皮肤才会更新第三方骰子预设 labels', () => {
        const preset = {
            labels: ['', '', '1', '2', '3', '4', '5', '6'],
        };
        const box = {
            DiceFactory: {
                get: vi.fn(() => preset),
                materials_cache: { old: true },
            },
            diceList: [],
        };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as DiceBoxThreeEngine & {
            box: typeof box;
            dieSkins: Array<DiceBoxDieSkin | null>;
            activePresetSkinId: string | null;
        };
        const canvas = document.createElement('canvas');
        const skin: DiceBoxDieSkin = {
            id: 'custom-labels',
            faceCanvases: {
                1: canvas,
                2: canvas,
                3: canvas,
                4: canvas,
                5: canvas,
                6: canvas,
            },
            faceLabels: {
                1: '拳',
                2: '掌',
                3: '禅',
                4: '莲',
                5: '太极',
                6: '终极',
            },
        };

        engine.box = box;
        engine.styleProfile = {};
        engine.dieSkins = [];
        engine.activePresetSkinId = null;
        engine.setDieSkins([skin]);

        expect(preset.labels).toEqual(['', '', '拳', '掌', '禅', '莲', '太极', '终极']);
        expect(box.DiceFactory.materials_cache).toEqual({});
    });
});
