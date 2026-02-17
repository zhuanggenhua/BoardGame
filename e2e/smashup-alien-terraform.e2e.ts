/**
 * Smash Up - Alien Terraform (适居化) E2E Test
 * 
 * 测试适居化卡牌的完整交互流程：
 * 1. 打出适居化卡牌
 * 2. 选择要替换的基地
 * 3. 从基地牌库选择新基地
 * 4. 可选：在新基地打出一个随从
 */

import { test, expect } from '@playwright/test';
import { setupOnlineMatch, waitForGameReady, getDebugPanel } from './helpers/smashup';

test.describe('Smash Up - Alien Terraform', () => {
    test('should complete terraform interaction: select base → select replacement → optional minion play', async ({ page }) => {
        // 1. 设置对局：玩家 0 有适居化卡牌和一个随从
        const { matchId } = await setupOnlineMatch(page, {
            factions: [['aliens', 'pirates'], ['ninjas', 'robots']],
        });

        await waitForGameReady(page, matchId);

        const debug = getDebugPanel(page);

        // 2. 注入状态：玩家 0 手牌有适居化 + 一个随从，基地牌库有备用基地
        await debug.injectState({
            players: {
                '0': {
                    hand: [
                        { uid: 'terraform-1', defId: 'alien_terraform', type: 'action', owner: '0' },
                        { uid: 'minion-1', defId: 'alien_invader', type: 'minion', owner: '0' },
                    ],
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayed: 0,
                    minionLimit: 1,
                },
            },
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            ],
            baseDeck: ['base_the_space_station', 'base_the_wormhole'],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        await debug.advanceToPhase('playCards');

        // 3. 打出适居化卡牌
        console.log('[E2E] Playing alien_terraform card...');
        await page.locator('[data-card-uid="terraform-1"]').click();

        // 4. 等待基地选择交互出现（基地应该高亮）
        console.log('[E2E] Waiting for base selection...');
        await page.waitForTimeout(500);

        // 检查是否有提示文字
        const promptText = await page.locator('text=选择要替换的基地').first();
        await expect(promptText).toBeVisible({ timeout: 5000 });

        // 5. 点击第一个基地
        console.log('[E2E] Clicking first base...');
        const firstBase = page.locator('[data-base-index="0"]').first();
        await firstBase.click();

        // 6. 等待替换基地选择交互
        console.log('[E2E] Waiting for replacement base selection...');
        await page.waitForTimeout(500);

        // 应该出现弹窗让玩家选择替换基地
        const replacementPrompt = page.locator('text=从基地牌库中选择一张基地进行替换');
        await expect(replacementPrompt).toBeVisible({ timeout: 5000 });

        // 7. 选择第一个替换基地（Space Station）
        console.log('[E2E] Selecting replacement base...');
        const spaceStationOption = page.locator('text=太空站').or(page.locator('text=Space Station')).first();
        await spaceStationOption.click();

        // 8. 等待可选打随从交互
        console.log('[E2E] Waiting for optional minion play...');
        await page.waitForTimeout(500);

        // 应该出现可选打随从的提示
        const minionPrompt = page.locator('text=你可以在新基地上额外打出一个随从');
        await expect(minionPrompt).toBeVisible({ timeout: 5000 });

        // 9. 选择打出随从
        console.log('[E2E] Playing minion to new base...');
        const invaderOption = page.locator('text=入侵者').or(page.locator('text=Invader')).first();
        await invaderOption.click();

        // 10. 验证最终状态
        await page.waitForTimeout(1000);

        const finalState = await debug.readCoreState();
        
        // 验证基地已替换
        expect(finalState.bases[0].defId).toBe('base_the_space_station');
        
        // 验证随从已打出到新基地
        expect(finalState.bases[0].minions).toHaveLength(1);
        expect(finalState.bases[0].minions[0].defId).toBe('alien_invader');
        
        // 验证旧基地回到牌库
        expect(finalState.baseDeck).toContain('base_the_homeworld');
        
        // 验证适居化卡牌已进入弃牌堆
        expect(finalState.players['0'].discard.some((c: any) => c.defId === 'alien_terraform')).toBe(true);

        console.log('[E2E] Test passed! Terraform interaction completed successfully.');
    });

    test('should skip optional minion play', async ({ page }) => {
        // 测试跳过打随从的情况
        const { matchId } = await setupOnlineMatch(page, {
            factions: [['aliens', 'pirates'], ['ninjas', 'robots']],
        });

        await waitForGameReady(page, matchId);

        const debug = getDebugPanel(page);

        await debug.injectState({
            players: {
                '0': {
                    hand: [
                        { uid: 'terraform-1', defId: 'alien_terraform', type: 'action', owner: '0' },
                        { uid: 'minion-1', defId: 'alien_invader', type: 'minion', owner: '0' },
                    ],
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayed: 0,
                    minionLimit: 1,
                },
            },
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            ],
            baseDeck: ['base_the_space_station'],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        await debug.advanceToPhase('playCards');

        // 打出适居化
        await page.locator('[data-card-uid="terraform-1"]').click();
        await page.waitForTimeout(500);

        // 选择基地
        await page.locator('[data-base-index="0"]').first().click();
        await page.waitForTimeout(500);

        // 选择替换基地
        const spaceStationOption = page.locator('text=太空站').or(page.locator('text=Space Station')).first();
        await spaceStationOption.click();
        await page.waitForTimeout(500);

        // 跳过打随从
        const skipButton = page.locator('text=跳过额外随从').or(page.locator('button:has-text("跳过")'));
        await skipButton.click();

        // 验证状态
        await page.waitForTimeout(1000);
        const finalState = await debug.readCoreState();
        
        // 基地已替换
        expect(finalState.bases[0].defId).toBe('base_the_space_station');
        
        // 没有随从打出
        expect(finalState.bases[0].minions).toHaveLength(0);
        
        // 随从仍在手牌
        expect(finalState.players['0'].hand.some((c: any) => c.defId === 'alien_invader')).toBe(true);

        console.log('[E2E] Skip minion test passed!');
    });

    test('should handle empty base deck gracefully', async ({ page }) => {
        // 测试基地牌库为空的情况
        const { matchId } = await setupOnlineMatch(page, {
            factions: [['aliens', 'pirates'], ['ninjas', 'robots']],
        });

        await waitForGameReady(page, matchId);

        const debug = getDebugPanel(page);

        await debug.injectState({
            players: {
                '0': {
                    hand: [
                        { uid: 'terraform-1', defId: 'alien_terraform', type: 'action', owner: '0' },
                    ],
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
            },
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            ],
            baseDeck: [], // 空牌库
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        await debug.advanceToPhase('playCards');

        // 打出适居化
        await page.locator('[data-card-uid="terraform-1"]').click();
        await page.waitForTimeout(500);

        // 选择基地
        await page.locator('[data-base-index="0"]').first().click();
        await page.waitForTimeout(1000);

        // 应该显示反馈提示（基地牌库为空）
        // 注意：这里可能会显示 toast 或其他反馈
        
        const finalState = await debug.readCoreState();
        
        // 基地未替换
        expect(finalState.bases[0].defId).toBe('base_the_homeworld');

        console.log('[E2E] Empty base deck test passed!');
    });
});
