import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiceBoxThreeEngine, installWebGlInfoLogNullGuard, type DiceBoxDieSkin, type DiceBoxStyleProfile } from '../dice-box-threejs/engine';

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

    it('指定值首次投骰使用受控低抛向量，不再调用第三方默认高抛 roll', async () => {
        const makeVector = (x = 0, y = 0, z = 0) => ({
            x,
            y,
            z,
            set: vi.fn(function set(this: { x: number; y: number; z: number }, nextX: number, nextY: number, nextZ: number) {
                this.x = nextX;
                this.y = nextY;
                this.z = nextZ;
            }),
        });
        const makeQuaternion = () => ({
            x: 0,
            y: 0,
            z: 0,
            w: 1,
            set: vi.fn(function set(this: { x: number; y: number; z: number; w: number }, x: number, y: number, z: number, w: number) {
                this.x = x;
                this.y = y;
                this.z = z;
                this.w = w;
            }),
        });
        const vector = {
            index: 0,
            type: 'd6',
            pos: makeVector(480, -320, 300),
            velocity: makeVector(900, -700, -10),
            angle: makeVector(140, -160, 80),
        };
        const die = {
            position: makeVector(),
            quaternion: makeQuaternion(),
            rotation: makeVector(),
            body: {
                position: makeVector(),
                quaternion: makeQuaternion(),
                velocity: makeVector(),
                angularVelocity: makeVector(),
                aabbNeedsUpdate: false,
            },
            getLastValue: vi.fn(() => ({ value: 1 })),
            storeRolledValue: vi.fn(),
            material: [],
            updateMatrixWorld: vi.fn(),
        };
        const startStrengths: number[] = [];
        const box = {
            diceList: [] as Array<typeof die>,
            strength: 0.92,
            startClickThrow: vi.fn(() => {
                startStrengths.push(box.strength);
                return { vectors: [vector], result: [6] };
            }),
            spawnDice: vi.fn((_vector: typeof vector, targetDie?: typeof die) => {
                if (!targetDie) {
                    box.diceList.push(die);
                }
            }),
            simulateThrow: vi.fn(),
            animateThrow: vi.fn((_running: number | boolean, callback?: () => void) => {
                callback?.();
            }),
            clearDice: vi.fn(() => {
                box.diceList = [];
            }),
            roll: vi.fn().mockResolvedValue(undefined),
            swapDiceFace: vi.fn((targetDie: typeof die, value: number) => {
                targetDie.getLastValue.mockReturnValue({ value });
            }),
            getDiceResults: vi.fn(() => ({ total: 6 })),
            onRollComplete: vi.fn(),
            renderer: { render: vi.fn(), clear: vi.fn(), domElement: null },
            scene: { updateMatrixWorld: vi.fn() },
            camera: { updateProjectionMatrix: vi.fn(), updateMatrixWorld: vi.fn() },
        };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as DiceBoxThreeEngine & {
            box: typeof box;
            container: HTMLElement;
            worldBounds: { width: number; height: number };
            dieSkins: [];
            diceHighlights: [];
            diceHighlightShells: Map<number, unknown>;
            styleProfile: DiceBoxStyleProfile;
            finalizeSettledFrame: ReturnType<typeof vi.fn>;
            renderFrame: ReturnType<typeof vi.fn>;
        };
        engine.box = box;
        engine.container = { clientWidth: 360, clientHeight: 220 } as HTMLElement;
        engine.worldBounds = { width: 360, height: 220 };
        engine.dieSkins = [];
        engine.diceHighlights = [];
        engine.diceHighlightShells = new Map();
        engine.styleProfile = { baseScale: 64, strength: 0.16 };
        engine.finalizeSettledFrame = vi.fn();
        engine.renderFrame = vi.fn();

        await engine.rollToValues([6]);

        expect(box.roll).not.toHaveBeenCalled();
        expect(box.startClickThrow).toHaveBeenCalledWith('1d6@6');
        expect(startStrengths).toEqual([0.16]);
        expect(box.strength).toBe(0.92);
        expect(Math.abs(vector.pos.x)).toBeLessThanOrEqual(130);
        expect(Math.abs(vector.pos.y)).toBeLessThanOrEqual(81);
        expect(vector.pos.z).toBeGreaterThanOrEqual(7);
        expect(vector.pos.z).toBeLessThanOrEqual(13);
        expect(vector.velocity.z).toBeGreaterThanOrEqual(-2.2);
        expect(vector.velocity.z).toBeLessThanOrEqual(-1.5);
        expect(vector.velocity.x * vector.pos.x).toBeLessThanOrEqual(0);
        expect(vector.velocity.y * vector.pos.y).toBeLessThanOrEqual(0);
        expect(Math.abs(vector.angle.x)).toBeLessThanOrEqual(5);
        expect(Math.abs(vector.angle.y)).toBeLessThanOrEqual(5);
        expect(box.animateThrow).not.toHaveBeenCalled();
        expect(box.swapDiceFace).toHaveBeenCalledWith(die, 6);
        expect(box.onRollComplete).toHaveBeenCalledWith({ total: 6 });
        expect(engine.finalizeSettledFrame).toHaveBeenCalledTimes(1);
    });

    it('指定值重骰使用受控框内动画，并在动画结束后才应用目标结果', async () => {
        const makeVector = (x = 0, y = 0, z = 0) => ({
            x,
            y,
            z,
            set: vi.fn(function set(this: { x: number; y: number; z: number }, nextX: number, nextY: number, nextZ: number) {
                this.x = nextX;
                this.y = nextY;
                this.z = nextZ;
            }),
        });
        const makeQuaternion = () => ({
            x: 0,
            y: 0,
            z: 0,
            w: 1,
            set: vi.fn(function set(this: { x: number; y: number; z: number; w: number }, x: number, y: number, z: number, w: number) {
                this.x = x;
                this.y = y;
                this.z = z;
                this.w = w;
            }),
        });
        const makeDie = (value: number) => ({
            position: makeVector(1, 2, 3),
            quaternion: makeQuaternion(),
            rotation: makeVector(),
            body: {
                position: makeVector(1, 2, 3),
                quaternion: makeQuaternion(),
                velocity: makeVector(),
                angularVelocity: makeVector(),
                type: 1,
                mass: 1,
                updateMassProperties: vi.fn(),
                wakeUp: vi.fn(),
                sleep: vi.fn(),
                aabbNeedsUpdate: false,
            },
            getLastValue: vi.fn(() => ({ value })),
            storeRolledValue: vi.fn(),
            updateMatrixWorld: vi.fn(),
        });
        const rerolledDie = makeDie(1);
        const lockedDie = makeDie(2);
        const swapDiceFace = vi.fn((die: typeof rerolledDie, value: number) => {
            die.getLastValue.mockReturnValue({ value });
        });
        const box = {
            diceList: [rerolledDie, lockedDie],
            last_time: 12345,
            steps: 99,
            reroll: vi.fn().mockResolvedValue(undefined),
            swapDiceFace,
            renderer: { render: vi.fn(), domElement: null },
            scene: {},
            camera: {},
        };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as DiceBoxThreeEngine & {
            box: typeof box;
            dieSkins: [];
            diceHighlights: [];
            diceHighlightShells: Map<number, unknown>;
            styleProfile: DiceBoxStyleProfile;
            playContainedRerollSpin: ReturnType<typeof vi.fn>;
            finalizeSettledFrame: ReturnType<typeof vi.fn>;
        };
        engine.box = box;
        engine.dieSkins = [];
        engine.diceHighlights = [];
        engine.diceHighlightShells = new Map();
        engine.styleProfile = {};
        engine.playContainedRerollSpin = vi.fn().mockImplementation(async () => {
            expect(swapDiceFace).not.toHaveBeenCalled();
            expect(swapDiceFace).not.toHaveBeenCalledWith(lockedDie, expect.any(Number));
            expect(rerolledDie.storeRolledValue).not.toHaveBeenCalled();
        });
        engine.finalizeSettledFrame = vi.fn();

        await engine.rerollToValues([0], [6, 2], [1]);

        expect(box.reroll).not.toHaveBeenCalled();
        expect(engine.playContainedRerollSpin).toHaveBeenCalledWith([0]);
        expect(swapDiceFace).toHaveBeenCalledWith(rerolledDie, 6);
        expect(swapDiceFace).not.toHaveBeenCalledWith(lockedDie, expect.any(Number));
        expect(rerolledDie.storeRolledValue).toHaveBeenCalledWith('forced');
        expect(engine.finalizeSettledFrame).toHaveBeenCalledTimes(1);
    });

    it('指定值重骰不依赖第三方单骰 reroll 也能提交结果', async () => {
        const makeVector = (x = 0, y = 0, z = 0) => ({
            x,
            y,
            z,
            set: vi.fn(function set(this: { x: number; y: number; z: number }, nextX: number, nextY: number, nextZ: number) {
                this.x = nextX;
                this.y = nextY;
                this.z = nextZ;
            }),
        });
        const makeQuaternion = () => ({
            x: 0,
            y: 0,
            z: 0,
            w: 1,
            set: vi.fn(function set(this: { x: number; y: number; z: number; w: number }, x: number, y: number, z: number, w: number) {
                this.x = x;
                this.y = y;
                this.z = z;
                this.w = w;
            }),
        });
        const makeDie = (value: number) => ({
            position: makeVector(1, 2, 3),
            quaternion: makeQuaternion(),
            rotation: makeVector(),
            body: {
                position: makeVector(1, 2, 3),
                quaternion: makeQuaternion(),
                velocity: makeVector(),
                angularVelocity: makeVector(),
                type: 1,
                mass: 1,
                updateMassProperties: vi.fn(),
                wakeUp: vi.fn(),
                sleep: vi.fn(),
                aabbNeedsUpdate: false,
            },
            getLastValue: vi.fn(() => ({ value })),
            storeRolledValue: vi.fn(),
            updateMatrixWorld: vi.fn(),
        });
        const die = makeDie(1);
        const box = {
            diceList: [die],
            swapDiceFace: vi.fn((targetDie: typeof die, value: number) => {
                targetDie.getLastValue.mockReturnValue({ value });
            }),
            renderer: { render: vi.fn(), domElement: null },
            scene: {},
            camera: {},
        };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as DiceBoxThreeEngine & {
            box: typeof box;
            dieSkins: [];
            diceHighlights: [];
            diceHighlightShells: Map<number, unknown>;
            styleProfile: DiceBoxStyleProfile;
            playContainedRerollSpin: ReturnType<typeof vi.fn>;
            finalizeSettledFrame: ReturnType<typeof vi.fn>;
        };
        engine.box = box;
        engine.dieSkins = [];
        engine.diceHighlights = [];
        engine.diceHighlightShells = new Map();
        engine.styleProfile = {};
        engine.playContainedRerollSpin = vi.fn().mockResolvedValue(undefined);
        engine.finalizeSettledFrame = vi.fn();

        await engine.rerollToValues([0], [6], []);

        expect(engine.playContainedRerollSpin).toHaveBeenCalledWith([0]);
        expect(box.swapDiceFace).toHaveBeenCalledWith(die, 6);
        expect(engine.finalizeSettledFrame).toHaveBeenCalledTimes(1);
    });

    it('受控重掷过程会同步物理 body 旋转，避免渲染帧覆盖成闪现', async () => {
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        const originalCancelAnimationFrame = window.cancelAnimationFrame;
        const animationFrames: FrameRequestCallback[] = [];
        vi.useFakeTimers();
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            animationFrames.push(callback);
            return animationFrames.length;
        });
        window.cancelAnimationFrame = vi.fn();

        const makeVector = (x = 0, y = 0, z = 0) => ({
            x,
            y,
            z,
            set: vi.fn(function set(this: { x: number; y: number; z: number }, nextX: number, nextY: number, nextZ: number) {
                this.x = nextX;
                this.y = nextY;
                this.z = nextZ;
            }),
        });
        const makeQuaternion = () => ({
            x: 0,
            y: 0,
            z: 0,
            w: 1,
            set: vi.fn(function set(this: { x: number; y: number; z: number; w: number }, x: number, y: number, z: number, w: number) {
                this.x = x;
                this.y = y;
                this.z = z;
                this.w = w;
            }),
        });
        const die = {
            position: makeVector(1, 2, 3),
            quaternion: makeQuaternion(),
            rotation: makeVector(),
            scale: makeVector(1, 1, 1),
            body: {
                position: makeVector(1, 2, 3),
                quaternion: makeQuaternion(),
                velocity: makeVector(),
                angularVelocity: makeVector(),
                aabbNeedsUpdate: false,
            },
            material: [],
            updateMatrixWorld: vi.fn(),
        };
        const box = {
            diceList: [die],
            renderer: {
                render: vi.fn(),
                clear: vi.fn(),
                domElement: {
                    clientWidth: 240,
                    clientHeight: 160,
                    width: 240,
                    height: 160,
                    dataset: {},
                } as HTMLCanvasElement,
            },
            scene: { updateMatrixWorld: vi.fn() },
            camera: { updateProjectionMatrix: vi.fn(), updateMatrixWorld: vi.fn() },
        };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as DiceBoxThreeEngine & {
            box: typeof box;
            diceHighlights: [];
            diceHighlightShells: Map<number, unknown>;
            styleProfile: { baseScale: number };
        };
        engine.box = box;
        engine.diceHighlights = [];
        engine.diceHighlightShells = new Map();
        engine.styleProfile = { baseScale: 64 };
        const engineInternals = engine as unknown as {
            getProjectedLayout: ReturnType<typeof vi.fn>;
            translateDieByScreenDelta: ReturnType<typeof vi.fn>;
            keepProjectedDieInsideCanvas: ReturnType<typeof vi.fn>;
        };
        engineInternals.getProjectedLayout = vi.fn(() => ({
            id: 1,
            x: 120,
            y: 80,
            width: 48,
            height: 48,
            visualWidth: 44,
            visualHeight: 44,
            minX: 98,
            maxX: 142,
            minY: 58,
            maxY: 102,
            rotateX: 0,
            rotateY: 0,
            rotateZ: 0,
        }));
        engineInternals.translateDieByScreenDelta = vi.fn((
            targetDie: typeof die,
            _layout: unknown,
            dx: number,
            dy: number,
        ) => {
            const nextPosition = {
                x: targetDie.position.x + dx / 10,
                y: targetDie.position.y + dy / 10,
                z: targetDie.position.z,
            };
            targetDie.position.set(nextPosition.x, nextPosition.y, nextPosition.z);
            targetDie.body.position.set(nextPosition.x, nextPosition.y, nextPosition.z);
            return true;
        });
        engineInternals.keepProjectedDieInsideCanvas = vi.fn();

        try {
            const spin = (engine as unknown as {
                playContainedRerollSpin: (indices: number[], durationMs?: number) => Promise<void>;
            }).playContainedRerollSpin([0], 300);
            let resolved = false;
            void spin.then(() => {
                resolved = true;
            });

            animationFrames.shift()?.(1000);
            animationFrames.shift()?.(1150);

            await Promise.resolve();
            expect(resolved).toBe(false);
            expect(Math.abs(die.body.quaternion.x) + Math.abs(die.body.quaternion.y)).toBeGreaterThan(0.01);
            expect(Math.abs(die.quaternion.x) + Math.abs(die.quaternion.y)).toBeGreaterThan(0.01);
            expect(Math.hypot(die.body.position.x - 1, die.body.position.y - 2)).toBeGreaterThan(1);
            expect(die.body.position.z - 3).toBeLessThanOrEqual(5.25);
            expect(engineInternals.translateDieByScreenDelta).toHaveBeenCalled();
            expect(engineInternals.keepProjectedDieInsideCanvas).toHaveBeenCalled();

            for (let frame = 0; frame < 32; frame += 1) {
                animationFrames.shift()?.(1300 + frame * 33);
            }
            await spin;
            expect(resolved).toBe(true);

            expect(die.body.quaternion.x).toBeCloseTo(0, 5);
            expect(die.body.quaternion.y).toBeCloseTo(0, 5);
            expect(die.body.quaternion.z).toBeCloseTo(0, 5);
            expect(die.body.quaternion.w).toBeCloseTo(1, 5);
            expect(Math.hypot(die.body.position.x - 1, die.body.position.y - 2)).toBeGreaterThan(2.4);
            expect(Math.hypot(die.position.x - 1, die.position.y - 2)).toBeGreaterThan(2.4);
        } finally {
            window.requestAnimationFrame = originalRequestAnimationFrame;
            window.cancelAnimationFrame = originalCancelAnimationFrame;
            vi.useRealTimers();
        }
    });

});
