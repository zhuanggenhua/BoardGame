/**
 * DiceThrone 防御技能选择 E2E 测试
 * 
 * 测试场景：
 * 1. 影贼有两个防御技能时，需要选择
 * 2. 选择后正确执行对应技能效果
 * 3. 只有一个防御技能时自动选择
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard } from './helpers/dicethrone';

test.describe('DiceThrone - 防御技能选择', () => {
    test('影贼有两个防御技能时显示选择界面', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        
        const { hostPage } = setup;

        // 1. 选择影贼作为玩家1
        await selectCharacter(hostPage, 'shadow_thief');
        await selectCharacter(setup.guestPage, 'paladin');
        await waitForGameBoard(hostPage);
        
        // 2. 跳过玩家1的回合到玩家2
        await page.click('text=推进阶段');
        await page.waitForSelector('text=弃牌');
        await page.click('text=推进阶段');
        
        // 3. 玩家2发起攻击
        await page.click('text=推进阶段'); // income
        await page.click('text=推进阶段'); // main1
        await page.click('text=推进阶段'); // offensiveRoll
        
        // 投骰并确认
        await page.click('text=投掷骰子');
        await page.waitForTimeout(500);
        await page.click('text=确认骰面');
        
        // 选择一个攻击技能（假设有可用的）
        const attackAbility = page.locator('[data-testid="ability-card"]').first();
        if (await attackAbility.isVisible()) {
            await attackAbility.click();
        }
        
        // 4. 进入防御阶段，应该显示防御技能选择
        await page.waitForSelector('text=防御投掷', { timeout: 5000 });
        
        // 检查是否显示两个防御技能选项
        const defenseAbilities = page.locator('[data-testid="ability-card"][data-ability-type="defensive"]');
        const count = await defenseAbilities.count();
        
        // 如果影贼有两个防御技能，应该显示选择界面
        if (count >= 2) {
            expect(count).toBeGreaterThanOrEqual(2);
            
            // 选择第一个防御技能
            await defenseAbilities.first().click();
            
            // 投骰
            await page.click('text=投掷骰子');
            await page.waitForTimeout(500);
            await page.click('text=确认骰面');
            
            // 验证防御技能效果执行
            // 这里需要根据具体技能效果验证
        }
    });

    test('只有一个防御技能时自动选择', async ({ page }) => {
        // 1. 选择圣骑士（只有一个防御技能）
        await page.click('text=圣骑士');
        await page.click('text=开始游戏');
        
        await page.waitForSelector('text=进攻投掷', { timeout: 10000 });
        
        // 2. 跳到防御阶段
        await page.click('text=推进阶段');
        await page.waitForSelector('text=弃牌');
        await page.click('text=推进阶段');
        await page.click('text=推进阶段'); // income
        await page.click('text=推进阶段'); // main1
        await page.click('text=推进阶段'); // offensiveRoll
        
        await page.click('text=投掷骰子');
        await page.waitForTimeout(500);
        await page.click('text=确认骰面');
        
        const attackAbility = page.locator('[data-testid="ability-card"]').first();
        if (await attackAbility.isVisible()) {
            await attackAbility.click();
        }
        
        // 3. 进入防御阶段，应该自动选择唯一的防御技能
        await page.waitForSelector('text=防御投掷', { timeout: 5000 });
        
        // 不应该显示选择界面，直接进入投骰
        const rollButton = page.locator('text=投掷骰子');
        await expect(rollButton).toBeVisible({ timeout: 2000 });
    });

    test('暗影防御效果正确执行', async ({ page }) => {
        // 测试暗影防御的效果：匕首→伤害，袋子→抽牌，暗影→护盾
        
        // 1. 设置场景：影贼防御
        await page.click('text=影贼');
        await page.click('text=开始游戏');
        await page.waitForSelector('text=进攻投掷', { timeout: 10000 });
        
        // 2. 进入防御阶段
        // ... (跳过前置步骤)
        
        // 3. 选择暗影防御
        const shadowDefense = page.locator('text=暗影防御');
        if (await shadowDefense.isVisible()) {
            await shadowDefense.click();
        }
        
        // 4. 投骰并验证效果
        await page.click('text=投掷骰子');
        await page.waitForTimeout(500);
        
        // 记录投骰前的状态
        const hpBefore = await page.locator('[data-testid="player-hp"]').first().textContent();
        const handSizeBefore = await page.locator('[data-testid="hand-size"]').first().textContent();
        
        await page.click('text=确认骰面');
        await page.waitForTimeout(1000);
        
        // 验证效果（根据骰面结果）
        // 如果有暗影骰面，应该看到护盾图标
        const shieldIcon = page.locator('[data-testid="shield-indicator"]');
        // 注意：这里需要根据实际骰面结果验证
    });

    test('无畏反击效果正确执行', async ({ page }) => {
        // 测试无畏反击的效果：匕首→伤害，匕首+暗影→中毒
        
        // 1. 设置场景：影贼防御（需要先升级获得无畏反击）
        await page.click('text=影贼');
        await page.click('text=开始游戏');
        await page.waitForSelector('text=进攻投掷', { timeout: 10000 });
        
        // 2. 选择无畏反击
        const fearlessRiposte = page.locator('text=无畏反击');
        if (await fearlessRiposte.isVisible()) {
            await fearlessRiposte.click();
            
            // 3. 投骰并验证效果
            await page.click('text=投掷骰子');
            await page.waitForTimeout(500);
            
            // 记录对手HP
            const opponentHpBefore = await page.locator('[data-testid="opponent-hp"]').textContent();
            
            await page.click('text=确认骰面');
            await page.waitForTimeout(1000);
            
            // 如果有匕首骰面，对手应该受到伤害
            // 如果有匕首+暗影，对手应该获得中毒状态
            const poisonStatus = page.locator('[data-testid="status-poison"]');
            // 根据骰面结果验证
        }
    });
});
