import { describe, expect, it } from 'vitest';
import { isNoCacheSpaEntryPath, shouldServeSpaFallback } from '../src/spa-fallback';

describe('SPA fallback guards', () => {
    it('should keep /assets requests out of SPA fallback', () => {
        expect(shouldServeSpaFallback('/assets')).toBe(false);
        expect(shouldServeSpaFallback('/assets/manifest-abc123.js')).toBe(false);
        expect(shouldServeSpaFallback('/assets/images/card.webp')).toBe(false);
    });

    it('should keep API-style routes out of SPA fallback', () => {
        expect(shouldServeSpaFallback('/auth/login')).toBe(false);
        expect(shouldServeSpaFallback('/games/list')).toBe(false);
        expect(shouldServeSpaFallback('/feedback')).toBe(false);
    });

    it('should still allow normal SPA routes to fall back to index.html', () => {
        expect(shouldServeSpaFallback('/')).toBe(true);
        expect(shouldServeSpaFallback('/ranked')).toBe(true);
        expect(shouldServeSpaFallback('/room/abc123')).toBe(true);
    });

    it('should preserve the explicit no-cache SPA entry for admin changelogs', () => {
        expect(isNoCacheSpaEntryPath('/admin/changelogs')).toBe(true);
        expect(isNoCacheSpaEntryPath('/admin/changelogs/')).toBe(true);
        expect(shouldServeSpaFallback('/admin/changelogs')).toBe(true);
        expect(shouldServeSpaFallback('/admin/changelogs/')).toBe(true);
    });
});
