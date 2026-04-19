/**
 * SmashUp 出牌调试 — 检查卡牌和基地选择器
 */
import { test, expect } from '@playwright/test';
import { setEnglishLocale, disableAudio, blockAudioRequests } from '../helpers/common';

test('SmashUp 出牌调试 — 检查卡牌和基地选择器', async ({ page }) => {
    test.setTimeout(60000);
    await setEnglishLocale(page);
    await disableAudio(page);
    await blockAudioRequests(page.context());

    await page.goto('/play/smashup/tutorial');
    await page.waitForLoadState('networkidle');

    // 等待 welcome 步骤
    await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 40000 });

    // 快速跳过到 playMinion 步骤
    const introSteps = ['welcome', 'scoreboard', 'handIntro', 'turnTracker', 'endTurnBtn', 'playCardsExplain'];
    for (const stepId of introSteps) {
        await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: /^(Next|下一步)$/i }).click();
    }

    await expect(page.locator('[data-tutorial-step="playMinion"]')).toBeVisible({ timeout: 10000 });

    const handArea = page.locator('[data-tutorial-id="su-hand-area"]');
    await expect(handArea).toBeVisible();

    const handCards = handArea.locator('[data-testid="su-hand-area"]').locator('> div > div');
    const cardCount = await handCards.count();
    console.log(`=== 手牌数量: ${cardCount} ===`);

    const bases = page.locator('.group\\/base');
    console.log(`=== 基地数量: ${await bases.count()} ===`);

    console.log('=== 点击第一张手牌 ===');
    await handCards.first().click({ force: true });
    await page.waitForTimeout(1000);

    const highlightedBase = page.locator('.group\\/base.scale-105');
    console.log(`=== 高亮基地数量: ${await highlightedBase.count()} ===`);

    console.log('=== 点击第一个基地 ===');
    await bases.first().click({ force: true });
    await page.waitForTimeout(2000);

    const isOnPlayAction = await page.locator('[data-tutorial-step="playAction"]')
        .isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`=== 是否推进到 playAction: ${isOnPlayAction} ===`);

    expect(isOnPlayAction).toBe(true);
});
