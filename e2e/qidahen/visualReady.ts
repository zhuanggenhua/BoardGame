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
        await Promise.all(images.map(image => image.decode()));
        await document.fonts.ready;
        await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    });
}
