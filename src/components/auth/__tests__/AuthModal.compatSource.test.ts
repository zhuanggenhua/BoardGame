import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'AuthModal.tsx'), 'utf8');

describe('AuthModal compatibility source guards', () => {
    it('HomeV2 认证弹层应使用 modal max height 与键盘 bottom inset，而不是直接依赖 100vh 和 safe-area-bottom', () => {
        const source = readSource();

        expect(source).toContain("paddingBottom: isHomeV2Style");
        expect(source).toContain("? 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))'");
        expect(source).toContain("maxHeight: isCompactHomeV2Layout");
        expect(source).toContain(": 'min(var(--modal-max-height, var(--runtime-modal-max-height)), 42rem)'");
        expect(source).toContain("calc(var(--modal-max-height, var(--runtime-modal-max-height)) - 0.5rem)");
        expect(source).not.toContain("calc(100vh - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 2rem)");
    });

    it('经典首页认证弹层应保持独立卡片壳层，而不是复用 HomeV2 纸面外框', () => {
        const source = readSource();

        expect(source).toContain("const isClassicStandalone = !embedded && !isHomeV2Style;");
        expect(source).toContain("max-w-[400px]");
        expect(source).toContain("bg-[#fcfbf9]");
        expect(source).toContain("border-[#e5e0d0]");
        expect(source).toContain("bg-[#433422] py-3 text-[13px]");
    });
});
