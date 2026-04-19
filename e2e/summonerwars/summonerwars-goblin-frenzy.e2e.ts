/**
 * 召唤师战争 E2E 测试 - 洞穴地精群情激愤事件卡
 * 
 * 测试场景：
 * 1. 打出群情激愤事件卡
 * 2. 验证所有0费单位获得额外攻击
 * 3. 验证单位可以进行额外攻击
 */

import { test, expect } from '@playwright/test';
import { setupSWOnlineMatch, readCoreState, applyCoreState } from '../helpers/summonerwars';
import { waitForTestHarness } from '../helpers/common';
import { waitForState } from '../helpers/waitForState';

test.describe('洞穴地精 - 群情激愤事件卡', () => {
  test('打出群情激愤后0费单位获得额外攻击', async ({ browser }, testInfo) => {
    // 创建在线对局
    const match = await setupSWOnlineMatch(
      browser,
      testInfo.project.use.baseURL,
      'goblin',
      'necromancer'
    );

    if (!match) {
      test.skip();
      return;
    }

    const { hostPage: player1Page } = match;

    // 等待测试工具就绪
    await waitForTestHarness(player1Page);

    // 注入测试状态：玩家1有群情激愤事件卡和0费单位
    const core = await readCoreState(player1Page);
    
    // 清空棋盘
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        core.board[r][c] = { unit: undefined, structure: undefined };
      }
    }

    // 放置玩家1的0费单位（地精）
    core.board[3][3] = {
      unit: {
        instanceId: 'goblin-1',
        cardId: 'goblin-grunt',
        owner: '0',
        position: { row: 3, col: 3 },
        damage: 0,
        hasMoved: false,
        hasAttacked: false,
        boosts: [],
        card: {
          id: 'goblin-grunt',
          cardType: 'unit',
          name: '地精步兵',
          unitClass: 'common',
          faction: 'goblin',
          cost: 0,
          life: 1,
          strength: 1,
          attackType: 'melee',
          attackRange: 1,
          abilities: [],
          deckSymbols: [],
        },
      },
      structure: undefined,
    };

    // 放置另一个0费单位
    core.board[3][4] = {
      unit: {
        instanceId: 'goblin-2',
        cardId: 'goblin-grunt',
        owner: '0',
        position: { row: 3, col: 4 },
        damage: 0,
        hasMoved: false,
        hasAttacked: false,
        boosts: [],
        card: {
          id: 'goblin-grunt',
          cardType: 'unit',
          name: '地精步兵',
          unitClass: 'common',
          faction: 'goblin',
          cost: 0,
          life: 1,
          strength: 1,
          attackType: 'melee',
          attackRange: 1,
          abilities: [],
          deckSymbols: [],
        },
      },
      structure: undefined,
    };

    // 放置敌方单位
    core.board[3][5] = {
      unit: {
        instanceId: 'enemy-1',
        cardId: 'paladin-soldier',
        owner: '1',
        position: { row: 3, col: 5 },
        damage: 0,
        hasMoved: false,
        hasAttacked: false,
        boosts: [],
        card: {
          id: 'paladin-soldier',
          cardType: 'unit',
          name: '圣殿士兵',
          unitClass: 'common',
          faction: 'paladin',
          cost: 1,
          life: 3,
          strength: 2,
          attackType: 'melee',
          attackRange: 1,
          abilities: [],
          deckSymbols: [],
        },
      },
      structure: undefined,
    };

    // 添加群情激愤事件卡到手牌
    core.players['0'].hand = [
      {
        id: 'goblin-frenzy-0-1',
        cardType: 'event',
        name: '群情激愤',
        faction: 'goblin',
        eventType: 'legendary',
        cost: 1,
        playPhase: 'magic',
        effect: '所有0费友方单位获得额外攻击',
        deckSymbols: [],
      },
    ];

    // 设置魔力阶段
    core.phase = 'magic';
    core.currentPlayer = '0';
    core.players['0'].magic = 5;

    await applyCoreState(player1Page, core);

    // 等待状态同步（使用 waitForState 确保状态已更新）
    await waitForState(player1Page, (state) => {
      return state.phase === 'magic' 
        && state.currentPlayer === '0'
        && state.players['0'].hand.length === 1
        && state.players['0'].hand[0].id === 'goblin-frenzy-0-1';
    }, { timeout: 5000 });

    // 验证初始状态：单位没有 extraAttacks
    let state = await readCoreState(player1Page);
    console.log('[DEBUG] Initial state - Unit at [3,3]:', JSON.stringify(state.board[3][3].unit, null, 2));
    expect(state.board[3][3].unit?.extraAttacks).toBeUndefined();
    expect(state.board[3][4].unit?.extraAttacks).toBeUndefined();

    // 点击群情激愤事件卡（进入选择模式）
    console.log('[DEBUG] Clicking goblin-frenzy card...');
    const cardElement = player1Page.locator('[data-card-id="goblin-frenzy-0-1"]');
    await expect(cardElement).toBeVisible({ timeout: 5000 });
    await cardElement.click();

    // 等待"打出"按钮出现
    console.log('[DEBUG] Waiting for play event button...');
    const playButton = player1Page.getByRole('button', { name: /打出|playEvent/i });
    await expect(playButton).toBeVisible({ timeout: 10000 });

    // 点击"打出"按钮
    console.log('[DEBUG] Clicking play event button...');
    await playButton.click();

    // 等待命令执行完成（使用 waitForState 确保状态已更新）
    await waitForState(player1Page, (state) => {
      return state.board[3][3].unit?.extraAttacks === 1
        && state.board[3][4].unit?.extraAttacks === 1
        && state.players['0'].hand.length === 0;
    }, { timeout: 5000 });

    // 验证事件卡已打出：单位获得额外攻击
    state = await readCoreState(player1Page);
    console.log('[DEBUG] After playing card - Unit at [3,3]:', JSON.stringify(state.board[3][3].unit, null, 2));
    console.log('[DEBUG] After playing card - Hand:', JSON.stringify(state.players['0'].hand, null, 2));
    expect(state.board[3][3].unit?.extraAttacks).toBe(1);
    expect(state.board[3][4].unit?.extraAttacks).toBe(1);

    // 验证事件卡从手牌移除
    expect(state.players['0'].hand.length).toBe(0);

    // 切换到攻击阶段
    await player1Page.click('button:has-text("结束阶段")');
    await player1Page.waitForTimeout(500);
    await player1Page.click('button:has-text("结束阶段")');
    await player1Page.waitForTimeout(500);
    await player1Page.click('button:has-text("结束阶段")');
    await player1Page.waitForTimeout(500);

    // 验证进入攻击阶段
    state = await readCoreState(player1Page);
    expect(state.phase).toBe('attack');

    // 验证单位有绿色边框（可攻击）
    const unit1 = player1Page.locator('[data-cell-row="3"][data-cell-col="3"]');
    await expect(unit1).toHaveClass(/border-green/);

    // 点击第一个单位
    await unit1.click();
    await player1Page.waitForTimeout(300);

    // 点击敌方单位进行攻击
    await player1Page.click('[data-cell-row="3"][data-cell-col="5"]');
    await player1Page.waitForTimeout(500);

    // 验证攻击成功：单位已攻击，但仍有额外攻击
    state = await readCoreState(player1Page);
    expect(state.board[3][3].unit?.hasAttacked).toBe(true);
    expect(state.board[3][3].unit?.extraAttacks).toBe(0); // 额外攻击已消耗

    // 验证敌方单位受到伤害
    expect(state.board[3][5].unit?.damage).toBeGreaterThan(0);

    console.log('✅ 群情激愤事件卡测试通过');
  });

  test('群情激愤只影响0费单位', async ({ browser }, testInfo) => {
    const match = await setupSWOnlineMatch(
      browser,
      testInfo.project.use.baseURL,
      'goblin',
      'necromancer'
    );

    if (!match) {
      test.skip();
      return;
    }

    const { hostPage: player1Page } = match;

    await waitForTestHarness(player1Page);

    // 注入测试状态：有0费和1费单位
    const core2 = await readCoreState(player1Page);
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        core2.board[r][c] = { unit: undefined, structure: undefined };
      }
    }

    // 0费单位
    core2.board[3][3] = {
      unit: {
        instanceId: 'goblin-1',
        cardId: 'goblin-grunt',
        owner: '0',
        position: { row: 3, col: 3 },
        damage: 0,
        hasMoved: false,
        hasAttacked: false,
        boosts: [],
        card: {
          id: 'goblin-grunt',
          cardType: 'unit',
          name: '地精步兵',
          unitClass: 'common',
          faction: 'goblin',
          cost: 0,
          life: 1,
          strength: 1,
          attackType: 'melee',
          attackRange: 1,
          abilities: [],
          deckSymbols: [],
        },
      },
      structure: undefined,
    };

    // 1费单位
    core2.board[3][4] = {
      unit: {
        instanceId: 'goblin-archer',
        cardId: 'goblin-archer',
        owner: '0',
        position: { row: 3, col: 4 },
        damage: 0,
        hasMoved: false,
        hasAttacked: false,
        boosts: [],
        card: {
          id: 'goblin-archer',
          cardType: 'unit',
          name: '地精弓箭手',
          unitClass: 'common',
          faction: 'goblin',
          cost: 1,
          life: 2,
          strength: 2,
          attackType: 'ranged',
          attackRange: 2,
          abilities: [],
          deckSymbols: [],
        },
      },
      structure: undefined,
    };

    core2.players['0'].hand = [
      {
        id: 'goblin-frenzy-0-1',
        cardType: 'event',
        name: '群情激愤',
        faction: 'goblin',
        eventType: 'legendary',
        cost: 1,
        playPhase: 'magic',
        effect: '所有0费友方单位获得额外攻击',
        deckSymbols: [],
      },
    ];

    core2.phase = 'magic';
    core2.currentPlayer = '0';
    core2.players['0'].magic = 5;

    await applyCoreState(player1Page, core2);

    // 等待状态同步
    await waitForState(player1Page, (state) => {
      return state.phase === 'magic' 
        && state.currentPlayer === '0'
        && state.players['0'].hand.length === 1;
    }, { timeout: 5000 });

    // 打出群情激愤
    const cardElement2 = player1Page.locator('[data-card-id="goblin-frenzy-0-1"]');
    await expect(cardElement2).toBeVisible({ timeout: 5000 });
    await cardElement2.click();
    
    // 等待"打出"按钮出现
    const playButton = player1Page.getByRole('button', { name: /打出|playEvent/i });
    await expect(playButton).toBeVisible({ timeout: 10000 });
    await playButton.click();
    
    // 等待命令执行完成
    await waitForState(player1Page, (state) => {
      return state.board[3][3].unit?.extraAttacks === 1
        && state.players['0'].hand.length === 0;
    }, { timeout: 5000 });

    // 验证：只有0费单位获得额外攻击
    const state = await readCoreState(player1Page);
    expect(state.board[3][3].unit?.extraAttacks).toBe(1); // 0费单位
    expect(state.board[3][4].unit?.extraAttacks).toBeUndefined(); // 1费单位

    console.log('✅ 群情激愤只影响0费单位测试通过');
  });
});
