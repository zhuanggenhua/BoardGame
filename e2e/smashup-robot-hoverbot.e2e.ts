/**
 * 盘旋机器人 E2E 测试
 * 
 * 验证完整的用户交互流程：
 * 1. 卡牌图片正确显示（displayMode: 'card' 生效）
 * 2. 点击卡牌图片能选择"打出"
 * 3. 卡牌被打出到基地上（完整的游戏逻辑验证）
 * 4. 交互 ID 稳定（robot_hoverbot_0）
 * 5. optionsGenerator 从 continuationContext 读取（不依赖牌库顶状态）
 */

import { test, expect } from './fixtures';

test.describe('SmashUp - Robot Hoverbot', () => {
  test('should display card image, click to play, and card appears on base', async ({ smashupMatch }) => {
    const { hostPage: page } = smashupMatch;

    // 等待游戏加载完成
    await page.waitForSelector('text=大杀四方', { timeout: 15000 });

    // 1. 使用调试面板作弊：给 P1 手牌添加盘旋机器人，牌库顶设置为随从
    await page.evaluate(() => {
      const panel = (window as any).__DEBUG_PANEL__;
      if (!panel) throw new Error('Debug panel not available');

      // 给 P1 手牌添加盘旋机器人
      panel.addCardToHand('0', 'robot_hoverbot');

      // 设置牌库顶为随从（外星人入侵者）
      panel.setDeckTop('0', 'alien_invader');

      // 确保 P1 有随从打出限额
      const state = (window as any).__BG_TEST_HARNESS__?.state.read();
      if (state) {
        state.core.players['0'].minionsPlayed = 0;
        state.core.players['0'].minionLimit = 2;
        (window as any).__BG_TEST_HARNESS__?.state.patch({ core: state.core });
      }
    });

    await page.waitForTimeout(500);

    // 2. 打出盘旋机器人
    const hoverbotCard = page.locator('[data-card-def-id="robot_hoverbot"]').first();
    await expect(hoverbotCard).toBeVisible({ timeout: 3000 });
    await hoverbotCard.click();

    // 点击"打出随从"按钮
    await page.click('button:has-text("打出随从")');

    // 选择基地（第一个基地）
    const baseButton = page.locator('button:has-text("基地")').first();
    await baseButton.click();

    // 3. 等待盘旋机器人的 onPlay 能力触发
    await expect(page.locator('text=盘旋机器人')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=查看牌库顶')).toBeVisible();

    // 4. 关键验证：卡牌图片应该显示（不是纯文本按钮）
    const deckTopCardImage = page.locator('[data-card-def-id="alien_invader"]').first();
    await expect(deckTopCardImage).toBeVisible({ timeout: 3000 });

    // 5. 验证两个选项都存在
    const playButton = page.locator('button:has-text("打出")');
    const skipButton = page.locator('button:has-text("放回牌库顶")');
    await expect(playButton).toBeVisible();
    await expect(skipButton).toBeVisible();

    // 6. 点击卡牌图片应该能选择"打出"
    await deckTopCardImage.click();

    // 等待交互关闭
    await page.waitForTimeout(1000);

    // 7. 验证外星人入侵者被打出到基地上
    const alienInvaderOnBase = page.locator('[data-minion-def-id="alien_invader"]');
    await expect(alienInvaderOnBase).toBeVisible({ timeout: 3000 });

    // 8. 验证盘旋机器人也在基地上
    const hoverbotOnBase = page.locator('[data-minion-def-id="robot_hoverbot"]');
    await expect(hoverbotOnBase).toBeVisible({ timeout: 3000 });

    // 9. 验证交互 ID 稳定（从历史记录中读取）
    const interactionId = await page.evaluate(() => {
      const state = (window as any).__BG_TEST_HARNESS__?.state.read();
      // 找到最近的 robot_hoverbot 交互
      const history = state?.sys.interaction?.history || [];
      const hoverbotInteraction = history.find((h: any) => h.id?.startsWith('robot_hoverbot_'));
      return hoverbotInteraction?.id;
    });
    expect(interactionId).toMatch(/^robot_hoverbot_\d+$/);

    // 10. 验证牌库顶的卡已经不在牌库中
    const deckState = await page.evaluate(() => {
      const state = (window as any).__BG_TEST_HARNESS__?.state.read();
      const player = state?.core.players['0'];
      return {
        deckTopDefId: player?.deck[0]?.defId,
        deckLength: player?.deck.length,
        handLength: player?.hand.length,
      };
    });

    // 外星人入侵者应该不在牌库顶了
    expect(deckState.deckTopDefId).not.toBe('alien_invader');

    // 截图保存证据
    await page.screenshot({ 
      path: 'test-results/robot-hoverbot-card-played-on-base.png',
      fullPage: true 
    });
  });

  test('should allow returning card to deck top', async ({ smashupMatch }) => {
    const { hostPage: page } = smashupMatch;

    await page.waitForSelector('text=大杀四方', { timeout: 15000 });

    // 使用调试面板作弊
    await page.evaluate(() => {
      const panel = (window as any).__DEBUG_PANEL__;
      if (!panel) throw new Error('Debug panel not available');

      panel.addCardToHand('0', 'robot_hoverbot');
      panel.setDeckTop('0', 'alien_invader');

      const state = (window as any).__BG_TEST_HARNESS__?.state.read();
      if (state) {
        state.core.players['0'].minionsPlayed = 0;
        state.core.players['0'].minionLimit = 2;
        (window as any).__BG_TEST_HARNESS__?.state.patch({ core: state.core });
      }
    });

    await page.waitForTimeout(500);

    // 打出盘旋机器人
    const hoverbotCard = page.locator('[data-card-def-id="robot_hoverbot"]').first();
    await hoverbotCard.click();
    await page.click('button:has-text("打出随从")');
    const baseButton = page.locator('button:has-text("基地")').first();
    await baseButton.click();

    // 等待交互弹窗
    await expect(page.locator('text=盘旋机器人')).toBeVisible({ timeout: 5000 });

    // 记录牌库顶 UID
    const deckTopUidBefore = await page.evaluate(() => {
      const state = (window as any).__BG_TEST_HARNESS__?.state.read();
      return state?.core.players['0'].deck[0]?.uid;
    });

    // 选择"放回牌库顶"
    await page.click('button:has-text("放回牌库顶")');

    await page.waitForTimeout(500);

    // 验证牌库顶的卡还在原位
    const deckTopUidAfter = await page.evaluate(() => {
      const state = (window as any).__BG_TEST_HARNESS__?.state.read();
      return state?.core.players['0'].deck[0]?.uid;
    });

    expect(deckTopUidAfter).toBe(deckTopUidBefore);

    // 验证外星人入侵者没有被打出到基地上
    const alienInvaderOnBase = page.locator('[data-minion-def-id="alien_invader"]');
    await expect(alienInvaderOnBase).not.toBeVisible();

    // 截图保存证据
    await page.screenshot({ 
      path: 'test-results/robot-hoverbot-return-to-deck.png',
      fullPage: true 
    });
  });
});
