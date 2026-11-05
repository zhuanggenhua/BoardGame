import { describe, expect, it } from 'vitest';
import { EFFECT_DIE_FACES } from '../ui/effectDieGeometry';

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

describe('native TTS effect die geometry', () => {
    it('forms a closed solid with 20 vertices, 30 edges, and five edges per face', () => {
        const vertices = new Set<string>();
        const edges = new Map<string, number>();
        for (const face of EFFECT_DIE_FACES) {
            expect(face.clip).toHaveLength(5);
            const points = face.clip.map(([x, y]) => face.center.map((c, axis) => (
                c + (x - 0.5) * face.width * face.u[axis] + (y - 0.5) * face.height * face.v[axis]
            )).map((v) => v.toFixed(4)).join(','));
            points.forEach((p) => vertices.add(p));
            points.forEach((p, i) => {
                const edge = [p, points[(i + 1) % 5]].sort().join('|');
                edges.set(edge, (edges.get(edge) ?? 0) + 1);
            });
        }
        expect(vertices.size).toBe(20);
        expect(edges.size).toBe(30);
        expect([...edges.values()].every((count) => count === 2)).toBe(true);
    });

    it('preserves the Workshop rotation-value normals and opposite faces', () => {
        // Workshop 2607721556.json, GUID f9cb19. Yaw does not change the upward normal.
        const rotations: Record<number, [number, number]> = {
            1: [27, 72], 2: [27, 144], 3: [27, -72], 4: [-27, 180],
            5: [90, 0], 6: [27, -144], 7: [-27, 36], 8: [-90, 0],
            9: [27, 0], 10: [-27, 108], 11: [-27, -36], 12: [-27, -108],
        };
        for (const face of EFFECT_DIE_FACES) {
            const [x, z] = rotations[face.value].map((v) => v * Math.PI / 180);
            const nativeNormal = [Math.sin(z) * Math.cos(x), -Math.cos(z) * Math.cos(x), Math.sin(x)];
            expect(dot(nativeNormal, face.normal)).toBeGreaterThan(0.9999);
            const opposite = EFFECT_DIE_FACES.find((other) => dot(face.normal, other.normal) < -0.9999);
            expect(opposite?.value).toBe(13 - face.value);
        }
    });
});
