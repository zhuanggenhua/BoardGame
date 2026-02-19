import { test, expect } from '@playwright/test';

/**
 * SmashUp 图片加载测试
 * 验证所有卡牌图片是否正确加载（带 i18n/zh-CN/ 前缀）
 * 
 * 运行前需要启动开发服务器：npm run dev
 */
test.describe('SmashUp Image Loading', () => {
    test.use({ 
        baseURL: 'http://localhost:5173',
        // 增加超时时间，因为图片加载可能较慢
        timeout: 60000
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/play/smashup/local');
        await page.waitForLoadState('networkidle');
    });

    test('应该加载带 i18n/zh-CN/ 前缀的卡牌图片', async ({ page }) => {
        // 等待游戏加载完成
        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 收集所有图片请求
        const imageRequests: string[] = [];
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.webp') && url.includes('smashup')) {
                imageRequests.push(url);
            }
        });

        // 等待一段时间让图片加载
        await page.waitForTimeout(3000);

        // 检查是否有图片请求
        expect(imageRequests.length).toBeGreaterThan(0);

        // 验证所有 SmashUp 图片都包含 i18n/zh-CN/ 前缀
        const wrongPaths = imageRequests.filter(url => {
            // 排除 CDN 域名前缀
            const path = url.replace(/^https?:\/\/[^/]+\//, '');
            // SmashUp 图片应该以 i18n/zh-CN/smashup/ 开头
            return path.includes('smashup') && !path.startsWith('official/i18n/zh-CN/smashup/');
        });

        if (wrongPaths.length > 0) {
            console.error('错误的图片路径（缺少 i18n/zh-CN/ 前缀）:');
            wrongPaths.forEach(url => console.error('  -', url));
        }

        expect(wrongPaths).toHaveLength(0);
    });

    test('应该成功加载派系选择界面的卡牌图片', async ({ page }) => {
        // 等待派系选择界面
        await page.waitForSelector('[data-testid="faction-selection"]', { timeout: 10000 });

        // 等待卡牌图片加载
        await page.waitForTimeout(2000);

        // 检查是否有加载失败的图片（通过检查 alt 属性或 broken image）
        const brokenImages = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images
                .filter(img => !img.complete || img.naturalHeight === 0)
                .map(img => img.src);
        });

        if (brokenImages.length > 0) {
            console.error('加载失败的图片:');
            brokenImages.forEach(src => console.error('  -', src));
        }

        expect(brokenImages).toHaveLength(0);
    });

    test('应该成功加载手牌区域的卡牌图片', async ({ page }) => {
        // 等待游戏开始
        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 选择派系（如果需要）
        const factionSelection = await page.$('[data-testid="faction-selection"]');
        if (factionSelection) {
            // 点击第一个派系
            await page.click('[data-testid="faction-card"]:first-child');
            await page.waitForTimeout(500);
            // 点击第二个派系
            await page.click('[data-testid="faction-card"]:nth-child(2)');
            await page.waitForTimeout(500);
            // 确认选择
            await page.click('button:has-text("确认")');
            await page.waitForTimeout(1000);
        }

        // 等待手牌区域
        await page.waitForSelector('[data-testid="hand-area"]', { timeout: 10000 });
        await page.waitForTimeout(2000);

        // 检查手牌区域的图片
        const handImages = await page.evaluate(() => {
            const handArea = document.querySelector('[data-testid="hand-area"]');
            if (!handArea) return [];
            const images = Array.from(handArea.querySelectorAll('img'));
            return images
                .filter(img => !img.complete || img.naturalHeight === 0)
                .map(img => img.src);
        });

        if (handImages.length > 0) {
            console.error('手牌区域加载失败的图片:');
            handImages.forEach(src => console.error('  -', src));
        }

        expect(handImages).toHaveLength(0);
    });

    test('应该成功加载弃牌堆的卡牌图片', async ({ page }) => {
        // 等待游戏开始
        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 跳过派系选择（如果需要）
        const factionSelection = await page.$('[data-testid="faction-selection"]');
        if (factionSelection) {
            await page.click('[data-testid="faction-card"]:first-child');
            await page.waitForTimeout(500);
            await page.click('[data-testid="faction-card"]:nth-child(2)');
            await page.waitForTimeout(500);
            await page.click('button:has-text("确认")');
            await page.waitForTimeout(1000);
        }

        // 等待弃牌堆区域
        await page.waitForSelector('[data-testid="discard-pile"]', { timeout: 10000 });
        await page.waitForTimeout(1000);

        // 点击弃牌堆查看
        await page.click('[data-testid="discard-pile"]');
        await page.waitForTimeout(1000);

        // 检查弃牌堆覆盖层的图片
        const discardImages = await page.evaluate(() => {
            const overlay = document.querySelector('[data-testid="discard-overlay"]');
            if (!overlay) return [];
            const images = Array.from(overlay.querySelectorAll('img'));
            return images
                .filter(img => !img.complete || img.naturalHeight === 0)
                .map(img => img.src);
        });

        if (discardImages.length > 0) {
            console.error('弃牌堆加载失败的图片:');
            discardImages.forEach(src => console.error('  -', src));
        }

        expect(discardImages).toHaveLength(0);
    });
});
