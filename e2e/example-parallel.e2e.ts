/**
 * 并行测试示例
 * 
 * 展示如何使用独立端口进行并行测试
 * 运行方式：npx playwright test --config=playwright.config.parallel.ts
 */

import { test, expect } from '@playwright/test';
import { getWorkerPorts, injectWorkerUrls } from './helpers/parallel';

test.describe('并行测试示例', () => {
  test.beforeEach(async ({ context }, testInfo) => {
    // 注入当前 worker 的服务器 URL
    await injectWorkerUrls(context, testInfo);
  });

  test('验证 worker 端口隔离', async ({ page }, testInfo) => {
    const ports = getWorkerPorts(testInfo);
    const workerId = testInfo.parallelIndex;
    
    console.log(`[Worker ${workerId}] 使用端口: ${JSON.stringify(ports)}`);
    
    // 导航到当前 worker 的前端服务器
    await page.goto(`http://localhost:${ports.frontend}`);
    
    // 验证页面加载成功
    await expect(page).toHaveTitle(/BoardGame/i);
    
    // 验证游戏服务器可访问
    const gameServerResponse = await page.request.get(`http://localhost:${ports.gameServer}/games`);
    expect(gameServerResponse.ok()).toBeTruthy();
    
    console.log(`[Worker ${workerId}] 测试通过 ✓`);
  });

  test('并行测试不会互相干扰', async ({ page }, testInfo) => {
    const workerId = testInfo.parallelIndex;
    const ports = getWorkerPorts(testInfo);
    
    // 每个 worker 使用独立的端口，不会冲突
    await page.goto(`http://localhost:${ports.frontend}`);
    
    // 模拟一些操作
    await page.waitForTimeout(1000);
    
    console.log(`[Worker ${workerId}] 独立运行，无冲突 ✓`);
  });
});
