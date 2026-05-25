import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'CreateRoomModal.tsx'), 'utf8');

describe('CreateRoomModal compatibility source guards', () => {
    it('HomeV2 房间创建弹层应锁 layout viewport，并在键盘弹出时保持纸面位置稳定', () => {
        const source = readSource();

        expect(source).toContain("const lockedViewportHeight = 'var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))'");
        expect(source).toContain("const lockedBottomInset = isHomeV2Style");
        expect(source).toContain("? 'var(--safe-area-bottom)'");
        expect(source).toContain(": 'var(--runtime-modal-bottom-inset)'");
        expect(source).toContain("height: lockedViewportHeight");
        expect(source).toContain("maxHeight: lockedViewportHeight");
        expect(source).toContain("paddingBottom: isHomeV2Style");
        expect(source).toContain("? 'max(1rem, var(--modal-active-bottom-inset, var(--safe-area-bottom)))'");
        expect(source).toContain(": 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))'");
        expect(source).toContain(": 'min(var(--modal-max-height, var(--runtime-modal-max-height)), 42rem)'");
        expect(source).not.toContain("'--modal-active-viewport-height': 'var(--layout-viewport-height, var(--runtime-viewport-height, 100dvh))'");
        expect(source).not.toContain("height: '100vh'");
    });
});
