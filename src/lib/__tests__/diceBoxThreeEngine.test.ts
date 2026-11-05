import { describe, expect, it, vi } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';

import { DiceBoxThreeEngine } from '../dice-box-threejs/engine';

describe('DiceBoxThreeEngine contained throw animation', () => {
    it.each([[0.99, 0.99, 0.8, 0.4], [0.15, 0.72, 0.94, 0.25], [0.32, 0.18, 0.66, 0.6]])(
        '原生随机投掷轴生成纯旋转，首帧不放大骰体：%j', (x, y, z, angle) => {
            const rawRotation = new Quaternion().setFromAxisAngle(new Vector3(x, y, z), angle * Math.PI * 2);
            expect(Math.abs(rawRotation.length() - 1)).toBeGreaterThan(0.01);
            const engine = Object.create(DiceBoxThreeEngine.prototype) as any;
            engine.styleProfile = { baseScale: 84 };
            engine.worldBounds = { width: 604, height: 244 };
            engine.container = { clientWidth: 604, clientHeight: 244 };
            engine.box = {};
            const vector = { index: 0, type: 'd10', axis: { x, y, z, a: angle },
                pos: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, angle: { x: 0, y: 0, z: 0 } };
            engine.constrainThrowVectorsToVisibleTray([vector]);
            // 与原库spawn相同的轴角公式；真实矩阵必须保长，不能靠画布钳位掩盖几何膨胀。
            const rotation = new Quaternion().setFromAxisAngle(new Vector3(vector.axis.x, vector.axis.y, vector.axis.z), vector.axis.a * Math.PI * 2);
            expect(rotation.length()).toBeCloseTo(1, 12);
            const matrix = new Matrix4().makeRotationFromQuaternion(rotation);
            for (const basis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
                expect(basis.applyMatrix4(matrix).length()).toBeCloseTo(1, 12);
            }
            expect(vector.axis.a).toBe(angle);
            expect(vector.type).toBe('d10');
            expect(vector.index).toBe(0);
        },
    );

    it.each(['animation-frame', 'timer-only'])('首帧后由%s持续调度可见运动直到稳定落地', async scheduler => {
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        const die = {
            position: { x: 0, y: 0, z: 0 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
            body: {
                position: { x: 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
                velocity: { x: 0, y: 0, z: 0 },
                angularVelocity: { x: 0, y: 0, z: 0 },
                sleep: vi.fn(),
                updateMassProperties: vi.fn(),
            },
            updateMatrixWorld: vi.fn(),
        };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as any;
        engine.styleProfile = { baseScale: 64 };
        engine.box = {
            diceList: [die],
            renderer: { domElement: { clientWidth: 320, clientHeight: 180 } },
            scene: { updateMatrixWorld: vi.fn() },
        };
        engine.setVector = vi.fn();
        engine.setQuaternion = vi.fn();
        engine.syncDiceHighlightShells = vi.fn();
        engine.keepProjectedDieInsideCanvas = vi.fn();
        engine.applyDieTransform = vi.fn();
        engine.renderFrame = vi.fn();

        window.requestAnimationFrame = scheduler === 'timer-only'
            ? () => 0
            : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0) as unknown as number;

        try {
            const result = await Promise.race([
                (engine as any).playContainedRollToSettledTransforms(
                    new Map([[0, {
                        position: { x: 1, y: 1, z: 1 },
                        quaternion: { x: 0, y: 0, z: 0, w: 1 },
                    }]]),
                    360,
                ).then(() => 'resolved').catch(() => 'rejected'),
                new Promise<string>((resolve) => window.setTimeout(() => resolve('timeout'), 1000)),
            ]);

            expect(result).toBe('resolved');
            expect(engine.renderFrame).toHaveBeenCalled();
            expect(die.body.sleep).toHaveBeenCalled();
        } finally {
            window.requestAnimationFrame = originalRequestAnimationFrame;
        }
    });

    it.each([30, 60, 144])('%s赫兹下运动仍按配置时长结束，不按帧数缩短', async refreshRate => {
        let clock = 0;
        const period = 1000 / refreshRate;
        const now = vi.spyOn(performance, 'now').mockImplementation(() => clock);
        const original = window.requestAnimationFrame;
        const die = { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, updateMatrixWorld: vi.fn() };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as any;
        engine.styleProfile = { baseScale: 84 };
        engine.box = { diceList: [die], renderer: { domElement: { clientWidth: 0, clientHeight: 0 } }, scene: { updateMatrixWorld: vi.fn() } };
        engine.syncDiceHighlightShells = vi.fn();
        const draws: number[] = [];
        engine.renderFrame = vi.fn(() => draws.push(clock));
        window.requestAnimationFrame = callback => window.setTimeout(() => { clock += period; callback(clock); }, 0);
        try {
            await engine.playContainedRollToSettledTransforms(new Map([[0, { position: { x: 1, y: 1, z: 1 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } }]]), 360);
            expect(draws.length).toBeGreaterThan(2);
            expect(draws.at(-1)! - draws[0]).toBeGreaterThanOrEqual(360);
            expect(draws.at(-1)! - draws[0]).toBeLessThan(360 + period + 0.01);
        } finally { window.requestAnimationFrame = original; now.mockRestore(); }
    });

    it('动画帧抛错时会拒绝 promise，而不是永久停在运动中', async () => {
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        const die = {
            position: { x: 0, y: 0, z: 0 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
            body: {
                position: { x: 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
                velocity: { x: 0, y: 0, z: 0 },
                angularVelocity: { x: 0, y: 0, z: 0 },
                sleep: vi.fn(),
                updateMassProperties: vi.fn(),
            },
            updateMatrixWorld: vi.fn(),
        };
        const engine = Object.create(DiceBoxThreeEngine.prototype) as any;
        engine.styleProfile = { baseScale: 64 };
        engine.box = {
            diceList: [die],
            renderer: { domElement: { clientWidth: 0, clientHeight: 0 } },
            scene: { updateMatrixWorld: vi.fn() },
        };
        engine.setVector = vi.fn();
        engine.setQuaternion = vi.fn();
        engine.syncDiceHighlightShells = vi.fn();
        engine.renderFrame = vi.fn(() => {
            throw new Error('frame render failed');
        });

        window.requestAnimationFrame = (callback: FrameRequestCallback) =>
            window.setTimeout(() => callback(performance.now()), 0) as unknown as number;

        try {
            const result = await Promise.race([
                (engine as any).playContainedRollToSettledTransforms(
                    new Map([[0, {
                        position: { x: 1, y: 1, z: 1 },
                        quaternion: { x: 0, y: 0, z: 0, w: 1 },
                    }]]),
                    360,
                ).then(() => 'resolved').catch(() => 'rejected'),
                new Promise<string>((resolve) => window.setTimeout(() => resolve('timeout'), 250)),
            ]);

            expect(result).toBe('rejected');
        } finally {
            window.requestAnimationFrame = originalRequestAnimationFrame;
        }
    });
});
