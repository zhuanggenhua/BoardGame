import { describe, expect, it } from 'vitest';
import { ResourceCache } from '../ResourceCache';

describe('resource budgets', () => {
    it('counts one decoded object once across URL aliases and disposes its last reference', () => {
        const disposed: string[] = [];
        const image = { bytes: 8 };
        const cache = new ResourceCache<string, { bytes: number }>(3, 10, value => value.bytes, () => false, (_value, key) => disposed.push(key));
        cache.set('primary', image).set('fallback', image);
        expect(cache.size).toBe(2);
        expect(cache.estimatedBytes).toBe(8);
        cache.delete('primary');
        expect(cache.estimatedBytes).toBe(8);
        expect(disposed).toEqual([]);
        image.bytes = 9;
        cache.set('fallback', image);
        expect(cache.estimatedBytes).toBe(9);
        cache.clear();
        expect(cache.estimatedBytes).toBe(0);
        expect(disposed).toEqual(['fallback']);
    });
    it('evicts least recently used references by decoded bytes and entry count', () => {
        const cache = new ResourceCache<string, { bytes: number }>(3, 10, value => value.bytes);
        cache.set('a', { bytes: 4 }).set('b', { bytes: 4 });
        cache.get('a');
        cache.set('c', { bytes: 4 });
        expect([...cache.keys()]).toEqual(['a', 'c']);
        expect(cache.estimatedBytes).toBe(8);
        cache.set('c', { bytes: 2 });
        expect(cache.estimatedBytes).toBe(6);
        cache.clear();
        expect(cache.estimatedBytes).toBe(0);
    });
    it('retains mounted consumers while bounding idle catalog entries', () => {
        const active = new Set(['room']);
        const cache = new ResourceCache<string, number>(3, Infinity, () => 0, key => active.has(key));
        cache.set('room', 1);
        for (let index = 0; index < 100; index++) cache.set(`game-${index}`, index);
        expect(cache.size).toBe(3);
        expect(cache.get('room')).toBe(1);
        expect(cache.has('game-0')).toBe(false);
    });
});
