/**
 * Cardia 教程模式调试测试
 * 
 * 目的：调试教程模式卡在资源加载页面的问题
 */

import { test, expect } from '../fixtures';

test.describe('Cardia Tutorial Debug', () => {
    test('should load tutorial mode successfully', async ({ page }) => {
        // 设置更长的超时时间
        test.setTimeout(120000);

        console.log('=== 开始教程模式调试 ===');

        // 监听控制台日志
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' || type === 'warning') {
                console.log(`[浏览器 ${type.toUpperCase()}]`, text);
            }
        });

        // 监听页面错误
        page.on('pageerror', error => {
            console.error('[页面错误]', error.message);
        });

        // 监听网络请求失败
        page.on('requestfailed', request => {
            console.error('[请求失败]', request.url(), request.failure()?.errorText);
        });

        // 1. 直接访问教程页面
        console.log('步骤 1: 直接访问教程页面');
        await page.goto('/play/cardia/tutorial');
        
        // 截图：教程页面
        await page.screenshot({ path: 'test-results/tutorial-debug-01-tutorial-page.png', fullPage: true });
        console.log('✓ 教程页面加载完成');

        // 2. 等待资源加载页面
        console.log('步骤 2: 等待资源加载页面');
        
        // 等待 URL 变化或资源加载页面出现
        await Promise.race([
            page.waitForURL(/\/tutorial/, { timeout: 5000 }).catch(() => null),
            page.waitForSelector('[data-testid="asset-loader"]', { timeout: 5000 }).catch(() => null),
            page.waitForSelector('text=/加载中|Loading/', { timeout: 5000 }).catch(() => null),
        ]);

        // 截图：资源加载页面
        await page.screenshot({ path: 'test-results/tutorial-debug-02-loading.png', fullPage: true });
        console.log('✓ 进入资源加载页面');

        // 3. 监控资源加载进度
        console.log('步骤 3: 监控资源加载进度');
        
        let lastProgress = -1;
        let stuckCount = 0;
        const maxStuckCount = 10; // 10秒无进度视为卡住
        
        for (let i = 0; i < 60; i++) { // 最多等待60秒
            await page.waitForTimeout(1000);
            
            // 检查是否已经进入游戏
            const isInGame = await page.locator('[data-testid="cardia-board"]').isVisible().catch(() => false);
            if (isInGame) {
                console.log('✓ 成功进入游戏！');
                break;
            }

            // 检查进度条
            const progressBar = page.locator('[role="progressbar"]').first();
            const progressText = page.locator('text=/\\d+%/').first();
            
            const hasProgressBar = await progressBar.isVisible().catch(() => false);
            const hasProgressText = await progressText.isVisible().catch(() => false);
            
            if (hasProgressBar || hasProgressText) {
                let currentProgress = -1;
                
                if (hasProgressText) {
                    const text = await progressText.textContent();
                    const match = text?.match(/(\d+)%/);
                    if (match) {
                        currentProgress = parseInt(match[1]);
                    }
                }
                
                if (currentProgress !== lastProgress) {
                    console.log(`  加载进度: ${currentProgress}%`);
                    lastProgress = currentProgress;
                    stuckCount = 0;
                } else {
                    stuckCount++;
                    if (stuckCount >= maxStuckCount) {
                        console.error(`✗ 资源加载卡住在 ${currentProgress}%`);
                        
                        // 截图：卡住状态
                        await page.screenshot({ path: 'test-results/tutorial-debug-03-stuck.png', fullPage: true });
                        
                        // 获取网络请求状态
                        console.log('检查网络请求状态...');
                        const pendingRequests = await page.evaluate(() => {
                            return {
                                performance: performance.getEntriesByType('resource').slice(-10).map(r => ({
                                    name: r.name,
                                    duration: r.duration,
                                })),
                            };
                        });
                        console.log('最近的网络请求:', JSON.stringify(pendingRequests, null, 2));
                        
                        // 获取控制台错误
                        const errors = await page.evaluate(() => {
                            return (window as any).__TEST_ERRORS__ || [];
                        });
                        if (errors.length > 0) {
                            console.error('控制台错误:', errors);
                        }
                        
                        throw new Error(`资源加载卡住在 ${currentProgress}%，超过 ${maxStuckCount} 秒无进度`);
                    }
                }
            } else {
                console.log(`  等待资源加载页面... (${i + 1}s)`);
            }
        }

        // 4. 验证是否成功进入游戏
        console.log('步骤 4: 验证是否成功进入游戏');
        
        const board = page.locator('[data-testid="cardia-board"]');
        await expect(board).toBeVisible({ timeout: 10000 });
        
        // 截图：游戏界面
        await page.screenshot({ path: 'test-results/tutorial-debug-04-game-board.png', fullPage: true });
        console.log('✓ 成功进入游戏界面');

        // 5. 检查教程系统是否激活
        console.log('步骤 5: 检查教程系统是否激活');
        
        const tutorialOverlay = page.locator('[data-testid="tutorial-overlay"]');
        const hasTutorialOverlay = await tutorialOverlay.isVisible().catch(() => false);
        
        if (hasTutorialOverlay) {
            console.log('✓ 教程覆盖层已显示');
            
            // 获取教程步骤信息
            const stepInfo = await page.evaluate(() => {
                const overlay = document.querySelector('[data-testid="tutorial-overlay"]');
                return {
                    visible: !!overlay,
                    content: overlay?.textContent?.substring(0, 100),
                };
            });
            console.log('教程步骤信息:', stepInfo);
        } else {
            console.warn('⚠ 未找到教程覆盖层');
        }

        // 截图：最终状态
        await page.screenshot({ path: 'test-results/tutorial-debug-05-final.png', fullPage: true });

        console.log('=== 教程模式调试完成 ===');
    });

    test('should check asset loading configuration', async ({ page }) => {
        console.log('=== 检查资源加载配置 ===');

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // 检查 Cardia 的资源配置
        const assetConfig = await page.evaluate(() => {
            return {
                // 检查图片预加载配置
                imagePreloadCache: (window as any).__IMAGE_PRELOAD_CACHE__,
                // 检查关键图片解析器
                criticalImageResolvers: Object.keys((window as any).__CRITICAL_IMAGE_RESOLVERS__ || {}),
                // 检查卡牌注册表
                cardRegistry: (window as any).__BG_CARD_REGISTRY__ ? 'exists' : 'missing',
            };
        });

        console.log('资源配置:', JSON.stringify(assetConfig, null, 2));

        // 检查 Cardia 的关键图片
        const cardiaImages = await page.evaluate(() => {
            const resolver = (window as any).__CRITICAL_IMAGE_RESOLVERS__?.cardia;
            if (!resolver) return null;
            
            return {
                hasResolver: true,
                // 尝试解析一些关键图片
                samples: [
                    'deck_i_card_01',
                    'deck_i_card_02',
                    'deck_i_card_03',
                ].map(defId => {
                    try {
                        return {
                            defId,
                            path: resolver(defId),
                        };
                    } catch (e) {
                        return {
                            defId,
                            error: (e as Error).message,
                        };
                    }
                }),
            };
        });

        console.log('Cardia 图片解析:', JSON.stringify(cardiaImages, null, 2));

        console.log('=== 资源配置检查完成 ===');
    });
});
