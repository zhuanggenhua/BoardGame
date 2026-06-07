import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

const readAccountSettingsModal = () =>
    readFileSync(resolve(TEST_DIR, '..', 'AccountSettingsModal.tsx'), 'utf8');
const readEmailBindModal = () =>
    readFileSync(resolve(TEST_DIR, '..', 'EmailBindModal.tsx'), 'utf8');
const readAvatarUpdateModal = () =>
    readFileSync(resolve(TEST_DIR, '..', 'AvatarUpdateModal.tsx'), 'utf8');

describe('Account auth modals compatibility source guards', () => {
    it('账户设置与邮箱绑定弹层应使用 runtime modal inset/max height，而不是直接锁定 100vh', () => {
        const accountSettingsModal = readAccountSettingsModal();
        const emailBindModal = readEmailBindModal();

        for (const source of [accountSettingsModal, emailBindModal]) {
            expect(source).toContain('preserveKeyboardLayout');
            expect(source).toContain("paddingBottom: 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))'");
            expect(source).toContain('max-h-[var(--modal-max-height,var(--runtime-modal-max-height))]');
            expect(source).not.toContain('100dvh');
        }
    });

    it('头像裁剪预览应提供正方形 padding 兜底高度，避免旧 WebView 下只剩横条', () => {
        const avatarUpdateModal = readAvatarUpdateModal();

        expect(avatarUpdateModal).toContain("style={{ height: 0, paddingTop: '100%' }}");
        expect(avatarUpdateModal).toContain('data-testid="avatar-crop-frame"');
        expect(avatarUpdateModal).not.toContain('aspect-square bg-black/10 rounded-lg overflow-hidden');
    });
});
