import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dismissViteOverlay, initContext } from '../helpers/common';

/**
 * SmashUp 图片加载测试
 * 验证所有卡牌图片是否正确加载（带 i18n/zh-CN/ 前缀）
 * 
 * 运行前需要启动开发服务器：npm run dev
 */
test.describe('SmashUp Image Loading', () => {
    test.use({ 
        baseURL: process.env.VITE_FRONTEND_URL
            || `http://localhost:${process.env.PW_PORT || process.env.E2E_PORT || '6174'}`, 
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

test.describe('SmashUp Critical Image Gate', () => {
    test.use({
        baseURL: process.env.VITE_FRONTEND_URL
            || `http://localhost:${process.env.PW_PORT || process.env.E2E_PORT || '6174'}`,
        timeout: 60000,
    });

    test('进入本地对局时先显示 LoadingScreen，再进入派系选择界面', async ({ browser }, testInfo) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'add-critical-image-preloading');
        mkdirSync(evidenceDir, { recursive: true });
        const loadingShotPath = join(evidenceDir, 'critical-image-gate-loading.png');
        const readyShotPath = join(evidenceDir, 'critical-image-gate-faction-selection.png');
        const context = await browser.newContext({
            baseURL: testInfo.project.use.baseURL as string | undefined,
        });
        const delayedPixelPng = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==',
            'base64',
        );

        await initContext(context, {
            storageKey: '__smashup_real_image_gate__',
            skipImageGate: false,
        });

        await context.route(/assets\.easyboardgame\.top\/.*\.(png|jpg|jpeg|webp|avif|gif|svg)(\?.*)?$/i, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 250));
            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: delayedPixelPng,
            });
        });

        const page = await context.newPage();

        try {
            await page.goto('/play/smashup/local', { waitUntil: 'domcontentloaded' });
            await dismissViteOverlay(page);

            const loadingText = page.getByText(/Loading match resources|正在加载对局资源/i).first();
            await expect(loadingText).toBeVisible({ timeout: 10000 });
            await page.screenshot({ path: loadingShotPath });

            const factionHeading = page.locator('h1').filter({
                hasText: /Draft Your Factions|选择你的派系/i,
            });
            await expect(factionHeading).toBeVisible({ timeout: 20000 });
            await expect(loadingText).toBeHidden({ timeout: 10000 });

            const visibleFactionNames = page.getByText(
                /Aliens|Pirates|Ninjas|Dinosaurs|外星人|海盗|忍者|恐龙/i,
            );
            await expect(visibleFactionNames.first()).toBeVisible({ timeout: 5000 });

            const brokenVisibleImages = await page.evaluate(() =>
                Array.from(document.querySelectorAll('img'))
                    .filter((img) => {
                        const rect = img.getBoundingClientRect();
                        const visible = rect.width > 0 && rect.height > 0;
                        return visible && (!img.complete || img.naturalWidth === 0);
                    })
                    .map((img) => img.getAttribute('src') ?? ''),
            );
            expect(brokenVisibleImages).toEqual([]);

            await page.screenshot({ path: readyShotPath });
        } finally {
            await context.close();
        }
    });
});
