import { test, expect, initHome, record, switchStyle, capture } from './helpers/homeAcceptance';

test('已加载封面的 Blob 地址在挂载期间有效，切换页面返回仍可见', async ({ page }) => {
    await initHome(page);
    const covers = page.locator('.platform-game-card img');
    await expect(covers).toHaveCount(11);
    await expect.poll(() => covers.evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0)), { timeout: 25_000 }).toBe(true);
    const liveUrls = await covers.evaluateAll(async images => Promise.all(images.map(async image => {
        const url = (image as HTMLImageElement).currentSrc;
        if (!url.startsWith('blob:')) return { url, available: true };
        try { return { url, available: (await fetch(url)).ok }; }
        catch { return { url, available: false }; }
    })));
    await record('当前挂载封面URL', liveUrls);
    expect(liveUrls.every(image => image.available)).toBe(true);
    for (let index = 0; index < 3; index++) {
        await page.getByRole('button', { name: '收藏库', exact: true }).click();
        await page.getByRole('button', { name: '发现', exact: true }).click();
        await expect(covers).toHaveCount(11);
        await expect.poll(() => covers.evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0 && getComputedStyle(image).opacity === '1')), { timeout: 15_000 }).toBe(true);
    }
    await switchStyle(page, 'classic');
    await switchStyle(page, 'modern');
    await expect(covers).toHaveCount(11);
    await expect.poll(() => covers.evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0 && getComputedStyle(image).opacity === '1'))).toBe(true);
    await page.goto('/dev/home-v2-preview');
    await expect(covers).toHaveCount(11);
    await expect.poll(() => covers.evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0 && getComputedStyle(image).opacity === '1'))).toBe(true);
    await record('封面切页与风格重新挂载', { discoverLibraryCycles: 3, classicModernRemount: true, legacyRedirect: true, decoded: 11 });
});

for (const mobile of [false, true]) test(`${mobile ? '手机' : '桌面'}封面切页后缓存候选失效仍能恢复图片`, async ({ browser }, info) => {
    info.setTimeout(60_000);
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
    try {
        const page = await context.newPage();
        await initHome(page);
        const cover = page.locator('.platform-game-card[data-game-id="smashup"] img');
        await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth > 0 && getComputedStyle(image).opacity === '1'), { timeout: 25_000 }).toBe(true);
        const cachedUrl = await cover.getAttribute('data-debug-current-src');
        expect(cachedUrl).toBeTruthy();
        const imageResponse = await page.request.get(new URL(cachedUrl!, page.url()).href);
        expect(imageResponse.ok()).toBe(true);
        const originalImage = await imageResponse.body();
        await page.getByRole('button', { name: '收藏库', exact: true }).click();
        let rejected = 0;
        // 故障夹具只控制图片候选：首个缓存地址失败，下一候选返回同一正式素材的真实字节。
        // 不把远端 CDN 恰好可访问作为候选切换合同的前提，也不拦截任何业务 API。
        await page.route(/\/smashup\/thumbnails\//, async route => {
            if (!rejected++) await route.abort('failed');
            else await route.fulfill({ status: 200, contentType: imageResponse.headers()['content-type'], body: originalImage });
        });
        await page.getByRole('button', { name: '发现', exact: true }).click();
        await expect.poll(() => rejected).toBeGreaterThan(0);
        try {
            await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0 && getComputedStyle(image).opacity === '1'), { timeout: 15_000 }).toBe(true);
        } finally {
            await record(`${mobile ? '手机' : '桌面'}-恢复现场`, await cover.evaluate(image => ({ src: image.getAttribute('data-debug-current-src'), rendered: image.getAttribute('data-debug-rendered-src'), state: image.getAttribute('data-debug-local-fetch'), complete: (image as HTMLImageElement).complete, width: (image as HTMLImageElement).naturalWidth, opacity: getComputedStyle(image).opacity })));
        }
        await cover.scrollIntoViewIfNeeded();
        await capture(page, `${mobile ? '手机' : '桌面'}-封面缓存候选失败后恢复`);
        await record(`${mobile ? '手机' : '桌面'}-缓存候选恢复`, { cachedUrl, rejectedRequests: rejected, recoveredUrl: await cover.getAttribute('data-debug-current-src'), boundary: '可重复的候选失效场景，不声称复现用户未知入口的全部网络条件' });
    } finally { await context.close(); }
});
