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

  test('游戏页面竖屏时显示旋转建议（不阻止访问）', async ({ page }) => {
    // 设置为移动设备竖屏尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    // 访问游戏页面（使用井字棋本地模式）
    await page.goto('/play/tictactoe/local');

    // 应该显示旋转建议（顶部横幅）
    await expect(page.locator('text=建议旋转至横屏以获得更佳体验')).toBeVisible();
    
    // 游戏内容仍然可见（不被遮挡）
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

  test('游戏页面移动端横屏时应用缩放样式', async ({ page }) => {
    // 设置为移动设备横屏尺寸
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/play/tictactoe/local');

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 检查 #root 是否应用了缩放样式
    const root = page.locator('#root');
    const transform = await root.evaluate((el) => {
      return window.getComputedStyle(el).transform;
    });

    // 应该有 scale 变换（不是 'none'）
    expect(transform).not.toBe('none');
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
    await expect(page.locator('text=建议旋转至横屏以获得更佳体验')).toBeVisible();

    // 再切换回横屏
    await page.setViewportSize({ width: 667, height: 375 });
    
    // 旋转建议应该消失
    await expect(page.locator('text=建议旋转至横屏')).not.toBeVisible();
  });

  test('主页横屏时不应用游戏缩放', async ({ page }) => {
    // 设置为移动设备横屏尺寸
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 检查 #root 不应该有缩放样式（主页自适应）
    const root = page.locator('#root');
    const transform = await root.evaluate((el) => {
      return window.getComputedStyle(el).transform;
    });

    // 主页不应该有 scale 变换
    expect(transform).toBe('none');
  });
});
