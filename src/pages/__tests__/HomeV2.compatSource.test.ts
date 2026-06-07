import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readHomeV2Source = () =>
    readFileSync(resolve(TEST_DIR, '..', 'HomeV2.tsx'), 'utf8');

describe('HomeV2 compatibility source guards', () => {
    it('HomeV2 主容器应使用 runtime viewport 变量，而不是纯 h-screen/100vh', () => {
        const homeV2 = readHomeV2Source();

        expect(homeV2).toContain("style={{ height: 'var(--runtime-viewport-height, 100vh)' }}");
        expect(homeV2).not.toContain('className="h-screen');
    });
});
