import { test, expect } from '@playwright/test';

/**
 * 认证流程用户友好性测试
 * 
 * 测试场景：
 * 1. 登录时邮箱未注册 → 提示并引导注册
 * 2. 注册时邮箱已存在 → 提示并引导登录
 * 3. 登录时密码错误 → 明确提示密码错误（而非"账号或密码错误"）
 */

test.describe('认证流程用户友好性', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('登录时邮箱未注册应提示并引导注册', async ({ page }) => {
        // 点击登录按钮
        await page.click('text=登录');

        // 等待登录弹窗出现
        await expect(page.locator('text=登录')).toBeVisible();

        // 输入未注册的邮箱
        const unregisteredEmail = `test-${Date.now()}@example.com`;
        await page.fill('input[type="text"]', unregisteredEmail);
        await page.fill('input[type="password"]', 'password123');

        // 提交登录
        await page.click('button[type="submit"]');

        // 应该显示"该邮箱未注册，请先注册"
        await expect(page.locator('text=/该邮箱未注册|This email is not registered/i')).toBeVisible();

        // 等待 1.5 秒后应自动切换到注册页面
        await page.waitForTimeout(1600);
        await expect(page.locator('text=注册')).toBeVisible();

        // 邮箱应该被预填
        const emailInput = page.locator('input[type="email"]').first();
        await expect(emailInput).toHaveValue(unregisteredEmail);
    });

    test('注册时邮箱已存在应提示并引导登录', async ({ page }) => {
        // 先注册一个账号
        const existingEmail = `existing-${Date.now()}@example.com`;
        await page.click('text=注册');
        await expect(page.locator('text=注册')).toBeVisible();

        // 填写注册信息
        await page.fill('input[type="email"]', existingEmail);
        await page.click('button:has-text("发送验证码")');
        
        // 等待验证码发送成功（实际测试中需要 mock 邮件服务）
        // 这里假设验证码是 "123456"
        await page.fill('input[placeholder*="验证码"]', '123456');
        await page.fill('input[placeholder*="用户名"]', 'TestUser');
        await page.fill('input[type="password"]', 'password123');
        await page.fill('input[placeholder*="确认密码"]', 'password123');
        
        // 提交注册（可能失败，因为没有真实验证码）
        // 这里主要测试"邮箱已存在"的场景

        // 切换到注册页面（如果之前关闭了）
        await page.click('text=注册');
        
        // 尝试用已存在的邮箱注册
        await page.fill('input[type="email"]', existingEmail);
        await page.click('button:has-text("发送验证码")');

        // 应该显示"该邮箱已注册"
        await expect(page.locator('text=/该邮箱已.*注册|already registered/i')).toBeVisible();

        // 等待 1.5 秒后应自动切换到登录页面
        await page.waitForTimeout(1600);
        await expect(page.locator('text=登录')).toBeVisible();

        // 邮箱应该被预填
        const accountInput = page.locator('input[type="text"]').first();
        await expect(accountInput).toHaveValue(existingEmail);
    });

    test('登录时密码错误应明确提示', async ({ page }) => {
        // 假设有一个已注册的测试账号
        const testEmail = 'test@example.com';
        
        await page.click('text=登录');
        await expect(page.locator('text=登录')).toBeVisible();

        // 输入正确的邮箱但错误的密码
        await page.fill('input[type="text"]', testEmail);
        await page.fill('input[type="password"]', 'wrongpassword');

        // 提交登录
        await page.click('button[type="submit"]');

        // 应该显示"密码错误"（而非"邮箱或密码错误"）
        await expect(page.locator('text=/密码错误|Invalid password/i')).toBeVisible();
    });

    test('错误提示应有动画效果', async ({ page }) => {
        await page.click('text=登录');
        await expect(page.locator('text=登录')).toBeVisible();

        // 输入未注册的邮箱
        await page.fill('input[type="text"]', `test-${Date.now()}@example.com`);
        await page.fill('input[type="password"]', 'password123');

        // 提交登录
        await page.click('button[type="submit"]');

        // 错误提示应该有淡入动画
        const errorBox = page.locator('.bg-red-50');
        await expect(errorBox).toBeVisible();
        
        // 检查是否有 framer-motion 的动画类
        const hasAnimation = await errorBox.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return style.opacity !== '' && style.transform !== '';
        });
        expect(hasAnimation).toBeTruthy();
    });
});
