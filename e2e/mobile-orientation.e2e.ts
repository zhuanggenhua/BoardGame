import { test, expect } from '@playwright/test';

test.describe('移动端横屏适配', () => {
  test('主页竖屏时正常显示（不显示提示）', async ({ page }) => {
    // 设置为移动设备竖屏尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // 主页不应该显示旋转建议
    await expect(page.locator('text=建议旋转至横屏')).not.toBeVisible();
    
    // 应该能看到正常的首页内容
    await page.waitForLoadState('networkidle');
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('游戏页面竖屏时显示旋转建议（可关闭）', async ({ page }) => {
    // 设置为移动设备竖屏尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    // 访问游戏页面（使用井字棋本地模式）
    await page.goto('/play/tictactoe/local');

    // 应该显示旋转建议（顶部横幅）
    const banner = page.locator('text=建议旋转至横屏以获得更佳体验');
    await expect(banner).toBeVisible();
    
    // 应该有关闭按钮
    const closeButton = page.locator('button[aria-label="关闭提示"]');
    await expect(closeButton).toBeVisible();
    
    // 点击关闭按钮
    await closeButton.click();
    
    // 建议应该消失
    await expect(banner).not.toBeVisible();
    
    // 游戏内容仍然可见
    await page.waitForLoadState('networkidle');
    const gameContainer = page.locator('[data-game-page]');
    await expect(gameContainer).toBeVisible();
  });

  test('游戏页面横屏时不显示建议', async ({ page }) => {
    // 设置为移动设备横屏尺寸
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/play/tictactoe/local');

    // 不应该显示旋转建议
    await expect(page.locator('text=建议旋转至横屏')).not.toBeVisible();
    
    // 应该能看到游戏界面
    await page.waitForLoadState('networkidle');
    const gameContainer = page.locator('[data-game-page]');
    await expect(gameContainer).toBeVisible();
  });

  test('PC 端不显示旋转建议', async ({ page }) => {
    // 设置为 PC 尺寸
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // 不应该显示旋转建议
    await expect(page.locator('text=建议旋转至横屏')).not.toBeVisible();
    
    // 访问游戏页面也不应该显示
    await page.goto('/play/tictactoe/local');
    await expect(page.locator('text=建议旋转至横屏')).not.toBeVisible();
  });

  test('游戏页面方向切换时动态更新建议显示', async ({ page }) => {
    // 初始为横屏
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/play/tictactoe/local');
    
    // 确认不显示建议
    await expect(page.locator('text=建议旋转至横屏')).not.toBeVisible();

    // 切换到竖屏
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 应该显示旋转建议
    const banner = page.locator('text=建议旋转至横屏以获得更佳体验');
    await expect(banner).toBeVisible();
    
    // 关闭建议
    await page.locator('button[aria-label="关闭提示"]').click();
    await expect(banner).not.toBeVisible();

    // 切换回横屏
    await page.setViewportSize({ width: 667, height: 375 });
    
    // 建议仍然不显示
    await expect(banner).not.toBeVisible();
    
    // 再次切换到竖屏
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 建议应该重新显示（横屏后重置关闭状态）
    await expect(banner).toBeVisible();
  });
});
