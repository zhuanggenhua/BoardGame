import { test, expect } from '@playwright/test';

test.describe('移动端横屏适配', () => {
  test('竖屏时显示旋转提示', async ({ page }) => {
    // 设置为移动设备竖屏尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // 应该显示旋转提示
    await expect(page.locator('text=请旋转设备')).toBeVisible();
    await expect(page.locator('text=为获得最佳游戏体验，请将设备旋转至横屏模式')).toBeVisible();
    
    // 应该有旋转图标
    const rotateIcon = page.locator('text=📱').first();
    await expect(rotateIcon).toBeVisible();
  });

  test('横屏时正常显示内容', async ({ page }) => {
    // 设置为移动设备横屏尺寸
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');

    // 不应该显示旋转提示
    await expect(page.locator('text=请旋转设备')).not.toBeVisible();
    
    // 应该能看到正常的首页内容（等待页面加载完成）
    await page.waitForLoadState('networkidle');
    
    // 验证首页关键元素存在（根据实际首页内容调整）
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('PC 端不显示旋转提示', async ({ page }) => {
    // 设置为 PC 尺寸
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // 不应该显示旋转提示
    await expect(page.locator('text=请旋转设备')).not.toBeVisible();
  });

  test('移动端横屏时应用缩放样式', async ({ page }) => {
    // 设置为移动设备横屏尺寸
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');

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

  test('方向切换时动态更新显示', async ({ page }) => {
    // 初始为横屏
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');
    
    // 确认正常显示
    await expect(page.locator('text=请旋转设备')).not.toBeVisible();

    // 切换到竖屏
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 应该显示旋转提示
    await expect(page.locator('text=请旋转设备')).toBeVisible();

    // 再切换回横屏
    await page.setViewportSize({ width: 667, height: 375 });
    
    // 旋转提示应该消失
    await expect(page.locator('text=请旋转设备')).not.toBeVisible();
  });
});
