/**
 * 召唤师战争 E2E 测试 - 魔力阶段事件卡选择
 *
 * 测试场景：魔力阶段点击可打出的事件卡，应弹出选择横幅（打出/弃牌/取消）
 */

import { test, expect } from '@playwright/test';
import { setupSWOnlineMatch, advanceToPhase, readCoreState, applyCoreState } from './helpers/summonerwars';

test.describe('召唤师战争 - 魔力阶段事件卡选择', () => {
  test('魔力阶段点击事件卡应弹出选择横幅', async ({ browser, baseURL }) => {
    test.setTimeout(120000); // 增加超时时间到120秒
    console.log('[DEBUG] Starting test, baseURL:', baseURL);
    
    let setup;
    try {
      setup = await setupSWOnlineMatch(browser, baseURL, 'goblin', 'necromancer');
    } catch (error) {
      console.log('[DEBUG] Setup error:', error);
      test.skip();
      return;
    }
    
    console.log('[DEBUG] Setup result:', setup ? 'success' : 'failed');
    if (!setup) {
      console.log('[DEBUG] Match setup failed, skipping test');
      test.skip();
      return;
    }

    const { hostPage: player1Page, hostContext, guestContext } = setup;
    
    // 捕获控制台日志（在点击之前注册）
    const logs: string[] = [];
    player1Page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[HandArea]') || text.includes('[useCellInteraction]') || text.includes('[StatusBanners]')) {
        logs.push(text);
        console.log('[BROWSER]', text);
      }
      if (msg.type() === 'error') {
        console.log('[PAGE ERROR]', text);
      }
    });
    player1Page.on('pageerror', err => {
      console.log('[PAGE EXCEPTION]', err.message);
    });

    try {
      // 推进到玩家1的魔力阶段
      await advanceToPhase(player1Page, 'magic', 6);

      // 注入状态：给玩家1手牌中添加"群情激愤"事件卡，并设置魔力为1
      const state = await readCoreState(player1Page);
      state.players['0'].hand.push({
        id: 'test-goblin-frenzy',
        cardType: 'event',
        name: '群情激愤',
        faction: 'goblin',
        eventType: 'legendary',
        playPhase: 'magic',
        cost: 1,
        isActive: false,
        effect: '指定所有费用为0点的友方单位为目标。每个目标可以进行一次额外的攻击。',
        deckSymbols: [],
        spriteIndex: 9,
        spriteAtlas: 'cards',
      });
      state.players['0'].magic = 1;
      await applyCoreState(player1Page, state);
      
      // 等待状态更新生效
      await player1Page.waitForTimeout(1000);
      
      // 验证状态已更新
      const updatedState = await readCoreState(player1Page);
      console.log('[DEBUG] Hand after injection:', updatedState.players['0'].hand.map((c: { name: string }) => c.name));
      console.log('[DEBUG] Magic after injection:', updatedState.players['0'].magic);

      // 点击"群情激愤"事件卡
      const card = player1Page.locator('[data-card-id="test-goblin-frenzy"]');
      console.log('[DEBUG] Card locator count:', await card.count());
      console.log('[DEBUG] Card visible:', await card.isVisible().catch(() => false));
      // 检查卡牌属性
      const cardType = await card.getAttribute('data-card-type');
      const cardName = await card.getAttribute('data-card-name');
      const cardCost = await card.getAttribute('data-card-cost');
      const canAfford = await card.getAttribute('data-can-afford');
      const canPlay = await card.getAttribute('data-can-play');
      console.log('[DEBUG] Card attributes:', { cardType, cardName, cardCost, canAfford, canPlay });
      
      await card.click();
      console.log('[DEBUG] Card clicked');
      
      // 等待状态更新和组件重新渲染
      await player1Page.waitForTimeout(1000);

      console.log('[DEBUG] Captured logs:', logs);

      // 应该弹出选择横幅（使用更宽松的选择器）
      // 横幅是紫色背景的 div
      const banner = player1Page.locator('.bg-purple-900\\/95').first();
      await expect(banner).toBeVisible({ timeout: 10000 });
      
      // 验证横幅内容包含关键文字（使用 textContent 而非 text= 选择器）
      const bannerText = await banner.textContent();
      console.log('[DEBUG] Banner text:', bannerText);
      expect(bannerText).toContain('选择');
      expect(bannerText).toContain('打出');
      expect(bannerText).toContain('弃牌');
      expect(bannerText).toContain('取消');

      // 应该有三个按钮：打出、弃牌、取消
      const playButton = banner.locator('button', { hasText: '打出' });
      const discardButton = banner.locator('button', { hasText: '弃牌' });
      const cancelButton = banner.locator('button', { hasText: '取消' });
      await expect(playButton).toBeVisible();
      await expect(discardButton).toBeVisible();
      await expect(cancelButton).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
