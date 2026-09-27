import { describe, expect, it, vi } from 'vitest';

import { DiceBoxThreeEngine } from '../dice-box-threejs/engine';

describe('DiceBoxThreeEngine contained throw animation', () => {
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
