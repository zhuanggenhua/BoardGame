/**
 * Cardia 教程模式调试测试
 * 
 * 目的：调试教程模式卡在资源加载页面的问题
 */

import { test, expect } from '../fixtures';
import type { Page, TestInfo } from '@playwright/test';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

declare global {
    interface Window {
        __TEST_ERRORS__?: unknown[];
        __IMAGE_PRELOAD_CACHE__?: unknown;
        __CRITICAL_IMAGE_RESOLVERS__?: Record<string, (defId: string) => unknown>;
        __BG_CARD_REGISTRY__?: unknown;
    }
}

const waitForTutorialStep = async (page: Page, stepId: string, timeout = 15000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

const clickNext = async (page: Page) => {
    const nextButton = page.getByTestId('tutorial-next-button');
    await expect(nextButton).toBeVisible({ timeout: 10000 });
    await nextButton.click();
};

const saveEvidenceScreenshot = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
) => {
    await page.screenshot({
        path: getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.png` }),
        fullPage: false,
    });
};

test.describe('Cardia Tutorial Debug', () => {
    test('教程完整流程应从欢迎步骤推进到完成', async ({ page }, testInfo) => {
        // 设置更长的超时时间
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);

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
                            return window.__TEST_ERRORS__ || [];
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
        
        // 5. 教程全流程：setup 是 AI 步骤，不渲染浮层；等待其自动推进到 welcome。
        console.log('步骤 5: 推进教程信息步骤');
        await waitForTutorialStep(page, 'welcome');
        await saveEvidenceScreenshot(page, testInfo, '01-welcome-visible');

        await clickNext(page);
        await waitForTutorialStep(page, 'handIntro');
        await clickNext(page);
        await waitForTutorialStep(page, 'battlefieldIntro');
        await clickNext(page);
        await waitForTutorialStep(page, 'signetIntro');
        await clickNext(page);
        await waitForTutorialStep(page, 'phaseIntro');
        await clickNext(page);
        await waitForTutorialStep(page, 'playPhaseExplain');
        await clickNext(page);

        // 6. 真实操作：点击教程固定手牌外科医生，等待教程自动执行对手出牌并进入能力阶段说明。
        console.log('步骤 6: 打出教程指定手牌并等待 AI 对手出牌');
        await waitForTutorialStep(page, 'playFirstCard');
        await saveEvidenceScreenshot(page, testInfo, '02-play-first-card-required');
        await expect(page.locator('[data-testid="card-tut-1"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="card-tut-1"]').click();
        await waitForTutorialStep(page, 'abilityPhaseExplain', 20000);
        await saveEvidenceScreenshot(page, testInfo, '03-ai-opponent-resolved-ability-phase');

        // 7. 真实操作：进入能力步骤并点击外科医生能力。
        console.log('步骤 7: 激活失败方能力');
        await clickNext(page);
        await waitForTutorialStep(page, 'activateAbility');
        await expect(page.locator('[data-testid="cardia-activate-ability-btn"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="cardia-activate-ability-btn"]').click();
        await waitForTutorialStep(page, 'encounterExplain', 20000);

        // 8. 收尾到 finish，并点击完成关闭教程。
        console.log('步骤 8: 推进到教程完成');
        await clickNext(page);
        await waitForTutorialStep(page, 'influenceExplain');
        await clickNext(page);
        await waitForTutorialStep(page, 'summary');
        await clickNext(page);
        await waitForTutorialStep(page, 'finish');
        await saveEvidenceScreenshot(page, testInfo, '04-finish-visible');
        await clickNext(page);
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0, { timeout: 10000 });

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
                imagePreloadCache: window.__IMAGE_PRELOAD_CACHE__,
                // 检查关键图片解析器
                criticalImageResolvers: Object.keys(window.__CRITICAL_IMAGE_RESOLVERS__ || {}),
                // 检查卡牌注册表
                cardRegistry: window.__BG_CARD_REGISTRY__ ? 'exists' : 'missing',
            };
        });

        console.log('资源配置:', JSON.stringify(assetConfig, null, 2));

        // 检查 Cardia 的关键图片
        const cardiaImages = await page.evaluate(() => {
            const resolver = window.__CRITICAL_IMAGE_RESOLVERS__?.cardia;
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
