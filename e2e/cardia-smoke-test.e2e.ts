import { test, expect } from '@playwright/test';

/**
 * Cardia 烟雾测试 - 验证基础游戏流程
 * 
 * 目标：确保游戏能够正常启动、创建房间、进入游戏
 * 不涉及复杂的能力系统，只验证最基本的流程
 */

test.describe('Cardia 烟雾测试', () => {
  test('应该能够访问游戏列表页面', async ({ page }) => {
    // 访问首页
    await page.goto('/');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题或关键元素存在
    const title = await page.title();
    expect(title).toBeTruthy();
    
    console.log('✅ 页面加载成功');
  });

  test('应该能够看到 Cardia 游戏', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 查找 Cardia 游戏卡片或链接
    const cardiaElement = page.locator('text=/cardia/i').first();
    
    // 等待元素出现（最多10秒）
    await cardiaElement.waitFor({ timeout: 10000 });
    
    const isVisible = await cardiaElement.isVisible();
    expect(isVisible).toBe(true);
    
    console.log('✅ Cardia 游戏可见');
  });

  test('应该能够创建 Cardia 游戏房间', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 点击 Cardia 游戏
    const cardiaLink = page.locator('text=/cardia/i').first();
    await cardiaLink.click();
    
    // 等待导航完成
    await page.waitForLoadState('networkidle');
    
    // 验证 URL 包含 cardia
    const url = page.url();
    expect(url).toContain('cardia');
    
    console.log('✅ 成功进入 Cardia 游戏页面');
  });
});
