import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiceBoxThreeEngine, installWebGlInfoLogNullGuard, type DiceBoxDieSkin } from '../dice-box-threejs/engine';

describe('DiceBoxThreeEngine', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('兼容返回 null 的 WebGL shader 日志，避免第三方 three trim 崩溃', () => {
        class MockWebGLRenderingContext {
            getShaderInfoLog(_shader: WebGLShader): string | null {
                return null;
            }

            getProgramInfoLog(_program: WebGLProgram): string | null {
                return null;
            }
        }

        vi.stubGlobal('WebGLRenderingContext', MockWebGLRenderingContext);

        installWebGlInfoLogNullGuard();

        const context = new MockWebGLRenderingContext() as unknown as WebGLRenderingContext;
        expect(context.getShaderInfoLog({} as WebGLShader)).toBe('');
        expect(context.getProgramInfoLog({} as WebGLProgram)).toBe('');
    });

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

    it('重掷预览从第一帧开始计时，避免第一帧晚到时直接跳到结束态', async () => {
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        const originalCancelAnimationFrame = window.cancelAnimationFrame;
        const originalSetTimeout = window.setTimeout;
        const originalClearTimeout = window.clearTimeout;
        const frames: FrameRequestCallback[] = [];
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        window.cancelAnimationFrame = vi.fn();
        window.setTimeout = vi.fn(() => 1) as unknown as typeof window.setTimeout;
        window.clearTimeout = vi.fn();

        try {
            const die = {
                position: { x: 1, y: 2, z: 3 },
                rotation: { x: 0, y: 0, z: 0 },
                updateMatrixWorld: vi.fn(),
                body: {
                    position: { x: 1, y: 2, z: 3 },
                    velocity: { x: 0, y: 0, z: 0 },
                    angularVelocity: { x: 0, y: 0, z: 0 },
                    aabbNeedsUpdate: false,
                },
            };
            const engine = Object.create(DiceBoxThreeEngine.prototype) as DiceBoxThreeEngine & {
                box: { diceList: [typeof die] };
                styleProfile: { baseScale: number };
                renderFrame: ReturnType<typeof vi.fn>;
                syncDiceHighlightShells: ReturnType<typeof vi.fn>;
            };
            engine.box = { diceList: [die] };
            engine.styleProfile = { baseScale: 64 };
            engine.renderFrame = vi.fn();
            engine.syncDiceHighlightShells = vi.fn();

            let resolved = false;
            const preview = engine.playRerollLaunchPreview([0], 1000).then(() => {
                resolved = true;
            });

            expect(frames).toHaveLength(1);
            frames.shift()?.(5000);
            await Promise.resolve();

            expect(resolved).toBe(false);
            expect(die.position.z).toBeGreaterThan(3);
            const firstVisibleZ = die.position.z;

            frames.shift()?.(5500);
            await Promise.resolve();

            expect(resolved).toBe(false);
            expect(die.position.z).toBeGreaterThan(firstVisibleZ);

            frames.shift()?.(6000);
            await preview;

            expect(resolved).toBe(true);
            expect(die.position.z).toBeCloseTo(3);
        } finally {
            window.requestAnimationFrame = originalRequestAnimationFrame;
            window.cancelAnimationFrame = originalCancelAnimationFrame;
            window.setTimeout = originalSetTimeout;
            window.clearTimeout = originalClearTimeout;
        }
    });

});
