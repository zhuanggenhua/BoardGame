import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'GameDetails.tsx'), 'utf8');

describe('HomeV2 GameDetails compatibility source guards', () => {
    it('房间密码纸面弹层应使用 runtime viewport 变量，而不是直接依赖 100vh', () => {
        const source = readSource();

        expect(source).toContain("var(--runtime-viewport-height, 100vh)");
        expect(source).not.toContain("min(calc(100vh - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 0.5rem), 11.75rem)");
    });
});
