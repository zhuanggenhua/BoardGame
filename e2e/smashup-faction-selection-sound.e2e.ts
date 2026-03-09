/**
 * 大杀四方 - 角色选择音效测试
 * 验证确认选择按钮是否播放音效
 */

import { test, expect } from '@playwright/test';
import {
    initContext,
    openSmashUpModal,
    waitForFactionSelection,
    openFactionCard,
} from './smashup-helpers';

test.describe('SmashUp 角色选择音效', () => {
    test('确认选择按钮应该播放音效', async ({ browser }) => {
        test.setTimeout(60000);

        const baseURL = process.env.VITE_FRONTEND_URL
            || `http://localhost:${process.env.PW_PORT || process.env.E2E_PORT || '6173'}`;
        const context = await browser.newContext({ baseURL });
        await initContext(context, { storageKey: '__smashup_sound_test' });
        const page = await context.newPage();

        // 监听音频播放
        let audioPlayed = false;
        await page.route('**/*.ogg', (route) => {
            const url = route.request().url();
            if (url.includes('UIClick_Dialog Choice 01_KRST_NONE.ogg')) {
                audioPlayed = true;
            }
            route.continue();
        });

        // 打开游戏并创建房间
        await openSmashUpModal(page);
        await page.getByRole('button', { name: /Create Room|创建房间/i }).click();
        const createModal = page.locator('[role="dialog"]').filter({ hasText: /Create Room|创建房间/i });
        await expect(createModal).toBeVisible({ timeout: 8000 });
        await createModal.getByRole('button', { name: /Confirm|确认/i }).click();

        try {
            await page.waitForURL(/\/play\/smashup\/match\//, { timeout: 8000 });
        } catch {
            test.skip(true, '房间创建失败或后端不可用');
            return;
        }

        // 等待角色选择界面
        await waitForFactionSelection(page);

        // 打开第一个角色卡片
        await openFactionCard(page, 0);

        // 点击确认按钮
        const confirmButton = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
        await expect(confirmButton).toBeVisible({ timeout: 8000 });
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        
        // 重置音频标志
        audioPlayed = false;
        
        // 点击按钮
        await confirmButton.click();
        
        // 等待一下让音频请求发出
        await page.waitForTimeout(500);

        // 验证音效是否播放
        expect(audioPlayed).toBe(true);

        await context.close();
    });
});
