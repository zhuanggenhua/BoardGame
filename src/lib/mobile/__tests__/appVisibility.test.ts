import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    __resetAppVisibilityForTests,
    dispatchAppVisibilityChange,
    onAppVisible,
} from '../appVisibility';

const mockDocumentVisibility = (visibilityState: DocumentVisibilityState) => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibilityState);
};

afterEach(() => {
    vi.restoreAllMocks();
    __resetAppVisibilityForTests();
});

describe('onAppVisible', () => {
    it('页面已可见时，窗口重新聚焦也会触发恢复回调', () => {
        mockDocumentVisibility('visible');
        __resetAppVisibilityForTests();
        const callback = vi.fn();
        const cleanup = onAppVisible(callback);

        window.dispatchEvent(new Event('focus'));

        expect(callback).toHaveBeenCalledTimes(1);
        cleanup();
    });

    it('页面仍处于隐藏状态时，focus 不会误触发恢复回调', () => {
        mockDocumentVisibility('hidden');
        __resetAppVisibilityForTests();
        const callback = vi.fn();
        const cleanup = onAppVisible(callback);

        window.dispatchEvent(new Event('focus'));

        expect(callback).not.toHaveBeenCalled();
        cleanup();
    });

    it('原生壳从隐藏恢复到可见时仍会触发恢复回调', () => {
        mockDocumentVisibility('visible');
        __resetAppVisibilityForTests();
        const callback = vi.fn();
        const cleanup = onAppVisible(callback);

        dispatchAppVisibilityChange(false);
        dispatchAppVisibilityChange(true);

        expect(callback).toHaveBeenCalledTimes(1);
        cleanup();
    });
});
