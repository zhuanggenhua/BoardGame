import { describe, expect, it } from 'vitest';
import {
    ATTACK_DIE_FACES,
    ATTACK_DIE_SETTLED_POSE,
    ATTACK_DIE_SETTLED_TILT,
    getAttackDieFaceKind,
    getAttackDieSettledFaceId,
    getAttackDieSettledTransform,
} from '../ui/attackDieGeometry';

describe('mage wars attack die cube net', () => {
    it('exposes six unique cube-net faces for a CSS d6', () => {
        expect(ATTACK_DIE_FACES).toHaveLength(6);
        expect(new Set(ATTACK_DIE_FACES.map((face) => face.id)).size).toBe(6);
        expect(ATTACK_DIE_FACES.map((face) => face.kind).sort()).toEqual([
            'blank',
            'blank',
            'burst',
            'hit1',
            'hit2',
            'hit2',
        ]);
        for (const face of ATTACK_DIE_FACES) {
            expect(face.uvSize[0]).toBeGreaterThan(0.2);
            expect(face.uvSize[1]).toBeGreaterThan(0.2);
            expect(face.uvMin[0] + face.uvSize[0]).toBeLessThanOrEqual(1.001);
            expect(face.uvMin[1] + face.uvSize[1]).toBeLessThanOrEqual(1.001);
        }
    });

    it('settles 0/1/2/burst onto the cube faces used by the official net', () => {
        expect(getAttackDieFaceKind(0)).toBe('blank');
        expect(getAttackDieFaceKind(1)).toBe('hit1');
        expect(getAttackDieFaceKind(2)).toBe('hit2');
        expect(getAttackDieFaceKind(3)).toBe('burst');
        expect(getAttackDieFaceKind(5)).toBe('burst');
        expect(getAttackDieSettledFaceId(0)).toBe('right-blank');
        expect(getAttackDieSettledFaceId(1)).toBe('back-hit1');
        expect(getAttackDieSettledFaceId(2)).toBe('front-hit2');
        expect(getAttackDieSettledFaceId(3)).toBe('left-burst');
        expect(getAttackDieSettledTransform(2)).toBe('rotateX(0deg) rotateY(0deg)');
        expect(getAttackDieSettledTransform(1)).toBe('rotateX(0deg) rotateY(180deg)');
        expect(getAttackDieSettledTransform(3)).toBe('rotateX(0deg) rotateY(90deg)');
        expect(getAttackDieSettledTransform(0)).toBe('rotateX(0deg) rotateY(-90deg)');
        expect(ATTACK_DIE_SETTLED_POSE).toBe('rotateX(-16deg) rotateY(18deg)');
        expect(ATTACK_DIE_SETTLED_TILT).toBe('camera-pose');
    });
});
