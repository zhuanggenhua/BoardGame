import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, '..', '..', '..');
const readHomeV2Source = () =>
    readFileSync(resolve(TEST_DIR, '..', 'HomeV2.tsx'), 'utf8');
const readHomeV2DraftSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'HomeV2Draft.tsx'), 'utf8');
const readCommonAssetsManifest = () =>
    JSON.parse(readFileSync(resolve(REPO_ROOT, 'public/assets/common/assets-manifest.json'), 'utf8')) as {
        files?: Record<string, { variants?: Record<string, { sha256?: string; bytes?: number; mime?: string }> }>;
    };

describe('HomeV2 compatibility source guards', () => {
    it('HomeV2 主容器应使用 runtime viewport 变量，而不是纯 h-screen/100vh', () => {
        const homeV2 = readHomeV2Source();

        expect(homeV2).toContain("style={{ height: 'var(--runtime-viewport-height, 100vh)' }}");
        expect(homeV2).not.toContain('className="h-screen');
    });

    it('HomeV2 背景图应指向宽版空书本原图，而不是错误替代底图', () => {
        const sources = [readHomeV2Source(), readHomeV2DraftSource()].join('\n');
        const commonManifest = readCommonAssetsManifest();
        const webpEntry = commonManifest.files?.['images/home-v2/book-catalog-wide/compressed/1']?.variants?.webp;

        expect(sources).toContain('book-catalog-wide/1.png');
        expect(sources).toContain('getOptimizedImageUrls');
        expect(sources).not.toContain('overview-homepage/compressed/1.webp');
        expect(sources).not.toContain('overview-spread/compressed/1.webp');
        expect(webpEntry).toMatchObject({
            sha256: '75d933d33c0db51eaf12a3f5308a69ab9f50af091e7455d2c877eecacf38c17a',
            bytes: 237612,
            mime: 'image/webp',
        });
    });
});
