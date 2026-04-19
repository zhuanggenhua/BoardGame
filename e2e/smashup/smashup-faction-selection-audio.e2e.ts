import { test, expect, type Page } from '@playwright/test';

/**
 * SmashUp 阵营选择音效重复播放问题验证测试
 * 
 * 问题：点击确认选择阵营按钮时，音效播放两次
 * 根因：GameButton 播放一次 + FACTION_SELECTED 事件触发播放一次
 * 修复：audio.config.ts 中 FACTION_SELECTED 事件返回 null
 */

async function setupSmashUpMatch(page: Page) {
    await page.goto('/');
    await page.getByRole('button', { name: /创建房间|create room/i }).click();
    await page.waitForURL(/\/room\//);
    
    // 选择 SmashUp
    await page.getByText(/大杀四方|smash up/i).click();
    await page.getByRole('button', { name: /开始游戏|start game/i }).click();
    await page.waitForURL(/\/match\//);
}

test.describe('SmashUp Faction Selection Audio', () => {
    test('should play click sound only once when selecting faction', async ({ page }) => {
        // 监听控制台日志
        const playSoundLogs: string[] = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[DT_AUDIO_TRACE]') && text.includes('action=play')) {
                playSoundLogs.push(text);
                console.log(text);
            }
        });

        // 创建在线对局
        await setupSmashUpMatch(page);

        // 等待阵营选择界面加载
        await page.waitForSelector('[data-tutorial-id="su-faction-select"]', { timeout: 10000 });

        // 点击第一个阵营卡片打开详情
        const firstFactionCard = page.locator('.group.relative.flex.flex-col.items-center.cursor-pointer').first();
        await firstFactionCard.click();

        // 等待 Modal 打开
        await page.waitForSelector('text=/确认选择|confirm selection/i', { timeout: 5000 });

        // 清空日志，准备记录点击确认按钮的日志
        playSoundLogs.length = 0;

        // 点击确认选择按钮
        const confirmButton = page.getByRole('button', { name: /确认选择|confirm selection/i });
        await confirmButton.click();

        // 等待一小段时间让所有日志输出
        await page.waitForTimeout(300);

        // 分析日志：筛选出点击音效的播放日志
        const clickSoundLogs = playSoundLogs.filter(log => 
            log.includes('uiclick_dialog_choice_01')
        );

        console.log('\n=== 音效播放日志分析 ===');
        console.log(`点击音效播放次数: ${clickSoundLogs.length}`);
        clickSoundLogs.forEach((log, idx) => {
            console.log(`[${idx + 1}] ${log}`);
        });

        // 断言：点击音效应该只播放一次
        expect(clickSoundLogs.length).toBe(1);

        // 验证阵营已选择（Modal 应该关闭）
        await expect(page.getByRole('button', { name: /确认选择|confirm selection/i })).not.toBeVisible({ timeout: 2000 });
    });

    test('should not play sound when clicking backdrop to close modal', async ({ page }) => {
        // 监听控制台日志
        const playSoundLogs: string[] = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[DT_AUDIO_TRACE]') && text.includes('action=play')) {
                playSoundLogs.push(text);
            }
        });

        // 创建在线对局
        await setupSmashUpMatch(page);

        await page.waitForSelector('[data-tutorial-id="su-faction-select"]', { timeout: 10000 });

        // 点击第一个阵营卡片打开详情
        const firstFactionCard = page.locator('.group.relative.flex.flex-col.items-center.cursor-pointer').first();
        await firstFactionCard.click();

        await page.waitForSelector('text=/确认选择|confirm selection/i', { timeout: 5000 });

        playSoundLogs.length = 0;

        // 点击 backdrop（Modal 外部）关闭 Modal
        // 使用更精确的选择器：backdrop 是 fixed 容器内的第一个 absolute 元素
        await page.locator('.fixed.inset-0 > .absolute.inset-0').first().click({ position: { x: 10, y: 10 } });

        await page.waitForTimeout(300);

        // 断言：点击 backdrop 不应该播放任何音效
        const clickSoundLogs = playSoundLogs.filter(log => 
            log.includes('uiclick_dialog_choice')
        );
        expect(clickSoundLogs.length).toBe(0);

        // 验证 Modal 已关闭
        await expect(page.getByRole('button', { name: /确认选择|confirm selection/i })).not.toBeVisible({ timeout: 2000 });
    });

    test('should allow selecting two factions with correct sound feedback', async ({ page }) => {
        // 监听控制台日志
        const playSoundLogs: string[] = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[DT_AUDIO_TRACE]') && text.includes('action=play')) {
                playSoundLogs.push(text);
            }
        });

        // 创建在线对局
        await setupSmashUpMatch(page);

        await page.waitForSelector('[data-tutorial-id="su-faction-select"]', { timeout: 10000 });

        // 选择第一个阵营
        const firstFactionCard = page.locator('.group.relative.flex.flex-col.items-center.cursor-pointer').first();
        await firstFactionCard.click();
        await page.waitForSelector('text=/确认选择|confirm selection/i', { timeout: 5000 });
        
        playSoundLogs.length = 0;
        await page.getByRole('button', { name: /确认选择|confirm selection/i }).click();
        await page.waitForTimeout(300);

        const firstSelectionSounds = playSoundLogs.filter(log => log.includes('uiclick_dialog_choice'));
        expect(firstSelectionSounds.length).toBe(1);

        // 选择第二个阵营
        const secondFactionCard = page.locator('.group.relative.flex.flex-col.items-center.cursor-pointer').nth(1);
        await secondFactionCard.click();
        await page.waitForSelector('text=/确认选择|confirm selection/i', { timeout: 5000 });
        
        playSoundLogs.length = 0;
        await page.getByRole('button', { name: /确认选择|confirm selection/i }).click();
        await page.waitForTimeout(300);

        const secondSelectionSounds = playSoundLogs.filter(log => log.includes('uiclick_dialog_choice'));
        expect(secondSelectionSounds.length).toBe(1);

        // 验证两个阵营都已选择（应该进入游戏）
        await page.waitForTimeout(1000);
        // 阵营选择界面应该消失
        await expect(page.locator('[data-tutorial-id="su-faction-select"]')).not.toBeVisible({ timeout: 5000 });
    });
});
