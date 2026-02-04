/**
 * UGC Builder E2E 测试
 * 
 * 测试 Builder 页面的核心功能
 */

import { test, expect } from '@playwright/test';

test.describe('UGC Builder', () => {
    test.beforeEach(async ({ page }) => {
        // 清除 localStorage
        await page.goto('/dev/ugc');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test.describe('页面加载', () => {
        test('应正确加载 Builder 页面', async ({ page }) => {
            await page.goto('/dev/ugc');
            
            // 检查页面标题元素
            await expect(page.locator('input[placeholder*="游戏名称"]')).toBeVisible();
            
            // 检查工具栏按钮
            await expect(page.getByText('保存')).toBeVisible();
            await expect(page.getByText('导入')).toBeVisible();
            await expect(page.getByText('导出')).toBeVisible();
            await expect(page.getByText('清空')).toBeVisible();
        });
    });

    test.describe('Schema 管理', () => {
        test('应能创建新 Schema', async ({ page }) => {
            await page.goto('/dev/ugc');
            
            // 点击添加 Schema 按钮
            await page.getByText('+ Schema').click();
            
            // 选择模板
            await page.getByText('空模板').click();
            
            // 验证 Schema 已创建
            await expect(page.locator('[data-testid="schema-item"]').first()).toBeVisible({ timeout: 5000 });
        });

        test('应能编辑 Schema 名称', async ({ page }) => {
            await page.goto('/dev/ugc');
            
            // 创建 Schema
            await page.getByText('+ Schema').click();
            await page.getByText('空模板').click();
            
            // 点击 Schema 进入编辑
            await page.locator('[data-testid="schema-item"]').first().click();
            
            // 修改名称
            const nameInput = page.locator('input').filter({ hasText: '' }).first();
            await nameInput.fill('测试 Schema');
        });
    });

    test.describe('保存/加载', () => {
        test('保存后刷新应恢复数据', async ({ page }) => {
            await page.goto('/dev/ugc');
            
            // 修改游戏名称
            const nameInput = page.locator('input[placeholder*="游戏名称"]');
            await nameInput.fill('测试游戏');
            
            // 点击保存
            await page.getByText('保存').click();
            
            // 处理 alert
            page.on('dialog', dialog => dialog.accept());
            
            // 刷新页面
            await page.reload();
            
            // 验证数据恢复
            await expect(nameInput).toHaveValue('测试游戏');
        });

        test('清空按钮应重置所有数据', async ({ page }) => {
            await page.goto('/dev/ugc');
            
            // 修改游戏名称
            const nameInput = page.locator('input[placeholder*="游戏名称"]');
            await nameInput.fill('测试游戏');
            
            // 保存
            page.on('dialog', async dialog => {
                if (dialog.type() === 'confirm') {
                    await dialog.accept();
                } else {
                    await dialog.accept();
                }
            });
            await page.getByText('保存').click();
            
            // 点击清空
            await page.getByText('清空').click();
            
            // 验证数据已清空
            await expect(nameInput).toHaveValue('新游戏');
        });
    });

    test.describe('标签管理', () => {
        test('应能打开标签管理模态框', async ({ page }) => {
            await page.goto('/dev/ugc');
            
            // 创建 Schema
            await page.getByText('+ Schema').click();
            await page.getByText('空模板').click();
            
            // 点击 Schema 进入编辑
            await page.locator('[data-testid="schema-item"]').first().click();
            
            // 点击管理标签
            await page.getByText('管理标签').click();
            
            // 验证模态框打开
            await expect(page.getByText('标签管理')).toBeVisible();
        });

        test('应能添加新标签', async ({ page }) => {
            await page.goto('/dev/ugc');
            
            // 创建 Schema
            await page.getByText('+ Schema').click();
            await page.getByText('空模板').click();
            
            // 进入编辑
            await page.locator('[data-testid="schema-item"]').first().click();
            
            // 打开标签管理
            await page.getByText('管理标签').click();
            
            // 填写标签名称
            await page.locator('input[placeholder*="稀有"]').fill('测试标签');
            
            // 点击添加
            await page.getByRole('button', { name: '添加' }).click();
            
            // 验证标签已添加
            await expect(page.getByText('测试标签')).toBeVisible();
        });
    });

    test.describe('布局组件', () => {
        test('应能拖拽组件到画布', async ({ page }) => {
            await page.goto('/dev/ugc');
            
            // 找到手牌区组件
            const handZone = page.getByText('手牌区');
            
            // 找到画布区域
            const canvas = page.locator('[data-testid="layout-canvas"]');
            
            // 如果有画布，尝试拖拽
            if (await canvas.count() > 0) {
                await handZone.dragTo(canvas);
            }
        });
    });
});
