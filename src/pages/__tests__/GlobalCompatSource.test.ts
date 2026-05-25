import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readIndexCss = () =>
    readFileSync(resolve(TEST_DIR, '..', '..', 'index.css'), 'utf8');
const readModalBase = () =>
    readFileSync(resolve(TEST_DIR, '..', '..', 'components', 'common', 'overlays', 'ModalBase.tsx'), 'utf8');
const readFriendsChatModal = () =>
    readFileSync(resolve(TEST_DIR, '..', '..', 'components', 'social', 'FriendsChatModal.tsx'), 'utf8');
const readFeedbackModal = () =>
    readFileSync(resolve(TEST_DIR, '..', '..', 'components', 'system', 'FeedbackModal.tsx'), 'utf8');
const readGlobalErrorBoundary = () =>
    readFileSync(resolve(TEST_DIR, '..', '..', 'components', 'system', 'GlobalErrorBoundary.tsx'), 'utf8');
const readGameNamespaceLoadError = () =>
    readFileSync(resolve(TEST_DIR, '..', '..', 'components', 'system', 'GameNamespaceLoadError.tsx'), 'utf8');

describe('Global compatibility source guards', () => {
    it('modal 全局容器应回退到 runtime viewport + 100vh，而不是 100dvh fallback', () => {
        const source = readIndexCss();

        expect(source).toContain('height: var(--runtime-viewport-height, 100vh);');
        expect(source).toContain('max-height: var(--runtime-viewport-height, 100vh);');
        expect(source).toContain('height: var(--modal-active-viewport-height, var(--runtime-viewport-height, 100vh));');
        expect(source).toContain('max-height: var(--modal-active-viewport-height, var(--runtime-viewport-height, 100vh));');
        expect(source).toContain('--modal-active-viewport-height: var(--runtime-viewport-height, 100vh);');
        expect(source).not.toContain('height: var(--runtime-viewport-height, 100dvh);');
        expect(source).not.toContain('max-height: var(--runtime-viewport-height, 100dvh);');
        expect(source).not.toContain('height: var(--modal-active-viewport-height, var(--runtime-viewport-height, 100dvh));');
        expect(source).not.toContain('max-height: var(--modal-active-viewport-height, var(--runtime-viewport-height, 100dvh));');
    });

    it('全局样式应提供 backdrop-filter 不可用时的统一降级', () => {
        const source = readIndexCss();

        expect(source).toContain('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))');
        expect(source).toContain('[class*="backdrop-blur"]');
        expect(source).toContain('-webkit-backdrop-filter: none !important;');
        expect(source).toContain('backdrop-filter: none !important;');
    });

    it('board-shell 游戏在显示方向建议 banner 时应预留顶部让位变量，避免主界面被顶条压住', () => {
        const source = readIndexCss();

        expect(source).toContain('--mobile-orientation-banner-offset: 0px;');
        expect(source).toContain('max(var(--safe-area-top), var(--mobile-orientation-banner-offset, 0px))');
    });

    it('共享 modal 入口应使用 runtime viewport + 100vh fallback，而不是内联 100dvh', () => {
        const modalBase = readModalBase();
        const friendsChatModal = readFriendsChatModal();
        const feedbackModal = readFeedbackModal();

        expect(modalBase).toContain("var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))");
        expect(modalBase).toContain("const lockedBottomInset = visualStyle === 'home-v2'");
        expect(modalBase).toContain("? 'var(--safe-area-bottom)'");
        expect(modalBase).toContain(": 'var(--runtime-modal-bottom-inset)'");
        expect(modalBase).toContain("'--modal-active-bottom-inset': lockedBottomInset");
        expect(modalBase).toContain("var(--modal-active-bottom-inset, ${lockedBottomInset})");
        expect(modalBase).not.toContain('100dvh');

        expect(friendsChatModal).toContain("var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))");
        expect(friendsChatModal).toContain("'--modal-active-bottom-inset': 'var(--runtime-modal-bottom-inset)'");
        expect(friendsChatModal).not.toContain('100dvh');

        expect(feedbackModal).toContain("var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))");
        expect(feedbackModal).toContain("'--modal-active-bottom-inset': 'var(--runtime-modal-bottom-inset)'");
        expect(feedbackModal).not.toContain('100dvh');
    });

    it('错误兜底页面应使用 runtime viewport 变量，而不是直接锁 100dvh', () => {
        const globalErrorBoundary = readGlobalErrorBoundary();
        const gameNamespaceLoadError = readGameNamespaceLoadError();

        expect(globalErrorBoundary).toContain("style={{ minHeight: 'var(--runtime-viewport-height, 100vh)' }}");
        expect(globalErrorBoundary).not.toContain('min-h-[100dvh]');

        expect(gameNamespaceLoadError).toContain("style={{ height: 'var(--runtime-viewport-height, 100vh)' }}");
        expect(gameNamespaceLoadError).not.toContain('h-[100dvh]');
    });
});
