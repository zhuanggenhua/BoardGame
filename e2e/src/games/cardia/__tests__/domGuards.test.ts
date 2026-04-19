import { describe, expect, it } from 'vitest';
import { isNodeContainedBy } from '../ui/domGuards';

describe('isNodeContainedBy', () => {
    it('returns true for descendants', () => {
        const container = document.createElement('div');
        const child = document.createElement('button');
        container.appendChild(child);

        expect(isNodeContainedBy(container, child)).toBe(true);
    });

    it('returns false for non-Node related targets instead of throwing', () => {
        const container = document.createElement('div');

        expect(isNodeContainedBy(container, { not: 'a node' } as unknown as EventTarget)).toBe(false);
    });

    it('returns false for nullish input', () => {
        const container = document.createElement('div');

        expect(isNodeContainedBy(container, null)).toBe(false);
        expect(isNodeContainedBy(null, document.createElement('div'))).toBe(false);
    });
});
