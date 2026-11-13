// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptimizedImage } from '../OptimizedImage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'zh-CN' } }) }));
vi.mock('../../../../core/AssetLoader', () => ({
    isImagePreloaded: () => true,
    getResolvedImageCacheUrl: () => '/cached-cover.webp',
    getRuntimeImageCandidateUrls: () => ['/cached-cover.webp', '/fallback-cover.webp'],
    markImageCandidateFailed: vi.fn(),
    markImageLoaded: vi.fn(),
}));

describe('封面缓存与加载占位', () => {
    it('浏览器未派发 load 时，图片实际解码完成仍通知调用方', async () => {
        const onReady = vi.fn();
        const { container } = render(<OptimizedImage src="cover" onReady={onReady} />);
        const image = container.querySelector('img')!;
        Object.defineProperty(image, 'complete', { configurable: true, value: true });
        Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 200 });
        await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
        expect(image.style.opacity).toBe('1');
    });
    it('默认扫光加载及失败切换时不显示浏览器破图文本，成功后恢复图片说明', () => {
        const { container } = render(<OptimizedImage src="cover" alt="正式卡面" />);
        const image = container.querySelector('img')!;
        expect(image.alt).toBe('');
        expect(image.getAttribute('aria-label')).toBe('正式卡面');
        expect(image.style.animation).toContain('img-shimmer');
        fireEvent.error(image);
        expect(image.alt).toBe('');
        expect(image.style.animation).toContain('img-shimmer');
        fireEvent.load(image);
        expect(image.alt).toBe('正式卡面');
        expect(image.style.animation).toBe('');
    });
    it('已有缓存提示时，当前图片解码前和失败切换期间仍隐藏原生缺图显示', () => {
        const { container } = render(<OptimizedImage src="cover" alt="封面" placeholder={false} />);
        const image = container.querySelector('img')!;
        expect(image.style.opacity).toBe('0');
        fireEvent.error(image);
        expect(image.style.opacity).toBe('0');
    });
    it('重新挂载后曾成功的缓存地址失败时，继续切换下一候选而不是卡在旧地址', () => {
        const { container } = render(<OptimizedImage src="cover" alt="封面" placeholder={false} />);
        const image = container.querySelector('img')!;
        fireEvent.error(image);
        expect(image.getAttribute('src')).toBe('/fallback-cover.webp');
        expect(image.style.opacity).toBe('0');
        fireEvent.load(image);
        expect(image.style.opacity).toBe('1');
    });
});
