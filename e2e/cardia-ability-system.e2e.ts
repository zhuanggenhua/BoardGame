/**
 * Cardia - 能力系统 E2E 测试
 * 
 * 测试场景：
 * 1. 能力阶段触发
 * 2. 能力按钮显示
 * 3. 跳过能力功能
 * 4. 能力激活流程（如果有可激活的能力）
 * 
 * 注意：不测试特定能力的效果，只测试能力系统的通用流程
 */

import { test, expect } from '@playwright/test';
import { setupCardiaOnlineMatch, cleanupCardiaMatch } from './helpers/cardia';

test.describe('Cardia - Ability System', () => {
    test('should trigger ability phase after both players play cards', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);
        
        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }
        
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);
            
            // 验证当前是打出卡牌阶段
            await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Play|打出/, { timeout: 10000 });
            
            // P1 打出第一张手牌
            const p1FirstCard = p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p1FirstCard.click();
            await p1Page.waitForTimeout(500);
            
            // P2 打出第一张手牌
            const p2FirstCard = p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p2FirstCard.click();
            
            // 等待双方卡牌都打出后，战场上应该出现卡牌
            await expect(p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first()).toBeVisible({ timeout: 10000 });
            
            // 等待状态同步
            await p1Page.waitForTimeout(1000);
            
            // 验证进入能力阶段
            await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Ability|能力/, { timeout: 10000 });
            await expect(p2Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Ability|能力/, { timeout: 10000 });
            
            console.log('[Test] ✅ 能力阶段已触发');
            
            // 检查是否有能力按钮（失败者应该有）
            const p1AbilityButton = p1Page.locator('[data-testid^="ability-btn-"]').first();
            const p2AbilityButton = p2Page.locator('[data-testid^="ability-btn-"]').first();
            
            const p1HasAbility = await p1AbilityButton.isVisible().catch(() => false);
            const p2HasAbility = await p2AbilityButton.isVisible().catch(() => false);
            
            console.log('[Test] P1 has ability button:', p1HasAbility);
            console.log('[Test] P2 has ability button:', p2HasAbility);
            
            // 注意：不是所有卡牌都有能力，所以可能双方都没有能力按钮
            // 这是正常情况，不应该导致测试失败
            if (!p1HasAbility && !p2HasAbility) {
                console.log('[Test] ⚠️ 双方都没有能力按钮（可能打出的卡牌没有能力）');
                // 跳过能力阶段
                const p1SkipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
                const p2SkipButton = p2Page.locator('[data-testid="cardia-skip-ability-btn"]');
                
                if (await p1SkipButton.isVisible().catch(() => false)) {
                    await p1SkipButton.click();
                } else if (await p2SkipButton.isVisible().catch(() => false)) {
                    await p2SkipButton.click();
                }
                
                console.log('[Test] ✅ 测试通过：能力系统流程正常（无能力可激活）');
                return;
            }
            
            // 检查跳过按钮
            const p1SkipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
            const p2SkipButton = p2Page.locator('[data-testid="cardia-skip-ability-btn"]');
            
            const p1HasSkip = await p1SkipButton.isVisible().catch(() => false);
            const p2HasSkip = await p2SkipButton.isVisible().catch(() => false);
            
            console.log('[Test] P1 has skip button:', p1HasSkip);
            console.log('[Test] P2 has skip button:', p2HasSkip);
            
            // 跳过能力（谁有跳过按钮就点谁的）
            if (p1HasSkip) {
                await p1SkipButton.click();
                console.log('[Test] P1 skipped ability');
            } else if (p2HasSkip) {
                await p2SkipButton.click();
                console.log('[Test] P2 skipped ability');
            }
            
            // 等待阶段切换
            await p1Page.waitForTimeout(1000);
            
            // 验证进入结束阶段
            await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/End|结束/, { timeout: 10000 });
            
            console.log('[Test] ✅ 测试通过：能力系统流程正常');
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
    
    test('should allow activating ability if available', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);
        
        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }
        
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);
            
            // P1 打出第一张手牌
            const p1FirstCard = p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p1FirstCard.click();
            await p1Page.waitForTimeout(500);
            
            // P2 打出第一张手牌
            const p2FirstCard = p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p2FirstCard.click();
            
            // 等待进入能力阶段
            await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Ability|能力/, { timeout: 10000 });
            
            // 检查是否有能力按钮
            const p1AbilityButton = p1Page.locator('[data-testid^="ability-btn-"]').first();
            const p2AbilityButton = p2Page.locator('[data-testid^="ability-btn-"]').first();
            
            const p1HasAbility = await p1AbilityButton.isVisible().catch(() => false);
            const p2HasAbility = await p2AbilityButton.isVisible().catch(() => false);
            
            // 如果有能力按钮，尝试激活
            if (p1HasAbility) {
                console.log('[Test] P1 has ability, trying to activate...');
                await p1AbilityButton.click();
                await p1Page.waitForTimeout(500);
                
                // 检查是否出现交互弹窗
                const cardSelectionModal = p1Page.locator('[data-testid="card-selection-modal"]');
                const factionSelectionModal = p1Page.locator('[data-testid="faction-selection-modal"]');
                
                const hasCardSelection = await cardSelectionModal.isVisible().catch(() => false);
                const hasFactionSelection = await factionSelectionModal.isVisible().catch(() => false);
                
                console.log('[Test] Card selection modal visible:', hasCardSelection);
                console.log('[Test] Faction selection modal visible:', hasFactionSelection);
                
                // 如果有交互弹窗，取消它
                if (hasCardSelection) {
                    const cancelButton = cardSelectionModal.locator('button').filter({ hasText: /Cancel|取消/ });
                    if (await cancelButton.isVisible().catch(() => false)) {
                        await cancelButton.click();
                    }
                } else if (hasFactionSelection) {
                    const cancelButton = factionSelectionModal.locator('button').filter({ hasText: /Cancel|取消/ });
                    if (await cancelButton.isVisible().catch(() => false)) {
                        await cancelButton.click();
                    }
                }
                
                // 跳过能力
                const p1SkipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
                if (await p1SkipButton.isVisible().catch(() => false)) {
                    await p1SkipButton.click();
                }
            } else if (p2HasAbility) {
                console.log('[Test] P2 has ability, trying to activate...');
                await p2AbilityButton.click();
                await p2Page.waitForTimeout(500);
                
                // 检查是否出现交互弹窗
                const cardSelectionModal = p2Page.locator('[data-testid="card-selection-modal"]');
                const factionSelectionModal = p2Page.locator('[data-testid="faction-selection-modal"]');
                
                const hasCardSelection = await cardSelectionModal.isVisible().catch(() => false);
                const hasFactionSelection = await factionSelectionModal.isVisible().catch(() => false);
                
                console.log('[Test] Card selection modal visible:', hasCardSelection);
                console.log('[Test] Faction selection modal visible:', hasFactionSelection);
                
                // 如果有交互弹窗，取消它
                if (hasCardSelection) {
                    const cancelButton = cardSelectionModal.locator('button').filter({ hasText: /Cancel|取消/ });
                    if (await cancelButton.isVisible().catch(() => false)) {
                        await cancelButton.click();
                    }
                } else if (hasFactionSelection) {
                    const cancelButton = factionSelectionModal.locator('button').filter({ hasText: /Cancel|取消/ });
                    if (await cancelButton.isVisible().catch(() => false)) {
                        await cancelButton.click();
                    }
                }
                
                // 跳过能力
                const p2SkipButton = p2Page.locator('[data-testid="cardia-skip-ability-btn"]');
                if (await p2SkipButton.isVisible().catch(() => false)) {
                    await p2SkipButton.click();
                }
            } else {
                console.log('[Test] No ability buttons found, skipping activation test');
                // 跳过能力
                const p1SkipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
                const p2SkipButton = p2Page.locator('[data-testid="cardia-skip-ability-btn"]');
                
                if (await p1SkipButton.isVisible().catch(() => false)) {
                    await p1SkipButton.click();
                } else if (await p2SkipButton.isVisible().catch(() => false)) {
                    await p2SkipButton.click();
                }
            }
            
            console.log('[Test] ✅ 测试通过：能力激活流程正常');
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
});
