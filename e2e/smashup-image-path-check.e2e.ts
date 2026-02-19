import { test, expect } from '@playwright/test';

/**
 * SmashUp 图片路径检查
 * 简化版：只检查图片请求的路径格式
 * 
 * 使用说明：
 * 1. 先启动开发服务器：npm run dev
 * 2. 运行测试：npm run test:e2e -- e2e/smashup-image-path-check.e2e.ts
 */

test('SmashUp 图片应该使用 i18n/zh-CN/ 前缀', async ({ page }) => {
    const imageRequests: string[] = [];
    const wrongPaths: string[] = [];

    // 监听所有请求
    page.on('request', (request) => {
        const url = request.url();
        // 只关注 SmashUp 的图片请求
        if (url.includes('.webp') && url.includes('smashup')) {
            imageRequests.push(url);
            
            // 检查路径格式
            const hasCorrectPrefix = url.includes('/i18n/zh-CN/smashup/') || url.includes('/official/i18n/zh-CN/smashup/');
            if (!hasCorrectPrefix) {
                wrongPaths.push(url);
                console.error('❌ 错误路径:', url);
            } else {
                console.log('✅ 正确路径:', url);
            }
        }
    });

    // 访问游戏页面
    await page.goto('http://localhost:5173/play/smashup/local');
    
    // 等待游戏加载
    await page.waitForTimeout(5000);

    // 输出统计
    console.log(`\n总共请求了 ${imageRequests.length} 个 SmashUp 图片`);
    console.log(`其中 ${wrongPaths.length} 个路径错误\n`);

    // 断言：所有图片都应该有正确的前缀
    if (wrongPaths.length > 0) {
        console.error('\n错误的图片路径列表:');
        wrongPaths.forEach((url, index) => {
            console.error(`${index + 1}. ${url}`);
        });
    }

    expect(wrongPaths, `发现 ${wrongPaths.length} 个错误的图片路径`).toHaveLength(0);
    expect(imageRequests.length, '应该至少加载一些图片').toBeGreaterThan(0);
});
