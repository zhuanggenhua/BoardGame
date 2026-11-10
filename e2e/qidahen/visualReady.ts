import type { Page } from '@playwright/test';

/** 等正式画面中实际可见的素材解码并显示，不能把透明占位当成截图。 */
export async function waitForQidahenVisualReady(page: Page) {
    await page.waitForFunction(() => {
        const images = [...document.images].filter(image => {
            const r = image.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
        });
        return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0 && Number(getComputedStyle(image).opacity) >= 0.99);
    }, undefined, { timeout: 90_000 });
    await page.evaluate(async () => {
        const images = [...document.images].filter(image => {
            const r = image.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
        });
        // 多张卡可能共享同一张大图集；同一资源只解码一次，避免并发请求把浏览器解码器压垮。
        const unique = [...new Map(images.map(image => [image.currentSrc || image.src, image])).values()];
        for (const image of unique) {
            const source = image.currentSrc || image.src;
            try { await image.decode(); }
            catch (error) { throw new Error(`可见图片解码失败: ${source}; current=${image.currentSrc || image.src}; connected=${image.isConnected}; complete=${image.complete}; size=${image.naturalWidth}x${image.naturalHeight}; ${String(error)}`); }
        }
        if (images.some(image => image.isConnected && (!image.complete || image.naturalWidth === 0))) throw new Error('可见图片在解码期间发生变化');
        await document.fonts.ready;
        await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    });
}
