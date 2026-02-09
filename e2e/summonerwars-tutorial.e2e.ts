/**
 * 召唤师战争 - 教程 E2E 测试
 *
 * 覆盖范围：
 * - 教程初始化（自动阵营选择、作弊设置固定手牌/魔力/弃牌堆）
 * - 逐步界面元素介绍（召唤师、敌方召唤师、城门、手牌、卡牌属性、魔力、阶段）
 * - 召唤阶段交互（选卡、放置单位）
 * - 召唤师技能使用（复活死灵）
 * - 移动/建造/攻击/魔力/抽牌阶段
 * - 对手 AI 回合
 * - 教程完成
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// ============================================================================
// 工具函数
// ============================================================================

const setEnglishLocale = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
  });
};

const disableAudio = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('audio_muted', 'true');
    localStorage.setItem('audio_master_volume', '0');
    localStorage.setItem('audio_sfx_volume', '0');
    localStorage.setItem('audio_bgm_volume', '0');
    (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
  });
};

const blockAudioRequests = async (context: BrowserContext) => {
  await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
};

/** 等待教程覆盖层出现并显示指定步骤 */
const waitForTutorialStep = async (page: Page, stepId: string, timeout = 30000) => {
  await expect(
    page.locator(`[data-tutorial-step="${stepId}"]`)
  ).toBeVisible({ timeout });
};

/** 点击"下一步"按钮 */
const clickNext = async (page: Page) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const nextBtn = page.getByRole('button', { name: /^(Next|下一步)$/i });
    await expect(nextBtn).toBeVisible({ timeout: 10000 });
    try {
      await nextBtn.click({ timeout: 5000 });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }
  const nextBtn = page.getByRole('button', { name: /^(Next|下一步)$/i });
  await nextBtn.click({ force: true });
};

/** 点击"完成并返回"按钮 */
const clickFinish = async (page: Page) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const finishBtn = page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i });
    await expect(finishBtn).toBeVisible({ timeout: 10000 });
    try {
      await finishBtn.click({ timeout: 5000 });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }
  const finishBtn = page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i });
  await finishBtn.click({ force: true });
};

/** 等待教程步骤中的"请操作"提示（requireAction 步骤） */
const waitForActionPrompt = async (page: Page, timeout = 15000) => {
  await expect(page.locator('[data-tutorial-step] .animate-pulse')).toBeVisible({ timeout });
};

/** 点击结束阶段按钮（带重试） */
const clickEndPhase = async (page: Page) => {
  const btn = page.locator('[data-testid="sw-end-phase"]');
  await expect(btn).toBeVisible({ timeout: 5000 });
  await expect(btn).toBeEnabled({ timeout: 5000 });

  const stepBefore = await page.evaluate(() => {
    return document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
  });

  await page.waitForTimeout(300);

  for (let attempt = 0; attempt < 3; attempt++) {
    await btn.click({ force: true });
    await page.waitForTimeout(800);

    const stepAfter = await page.evaluate(() => {
      return document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
    });

    if (stepAfter !== stepBefore) return;
  }
};

/** 导航到召唤师战争教程页面 */
const navigateToTutorial = async (page: Page) => {
  await page.goto('/play/summonerwars/tutorial');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#root > *', { timeout: 15000 });
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('Summoner Wars Tutorial E2E', () => {
  test.describe.configure({ retries: 1 });

  test.beforeEach(async ({ context }) => {
    await blockAudioRequests(context);
  });

  test('教程完整流程 - 从初始化到完成', async ({ page }) => {
    test.setTimeout(120000);
    await setEnglishLocale(page);
    await disableAudio(page);
    await navigateToTutorial(page);

    // Step 0: setup（AI 自动执行）
    // Step 1: welcome — 高亮棋盘
    await waitForTutorialStep(page, 'welcome', 40000);
    await expect(page.getByText(/Welcome to Summoner Wars/i)).toBeVisible();
    await clickNext(page);

    // Step 2: summoner-intro — 高亮己方召唤师
    await waitForTutorialStep(page, 'summoner-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-my-summoner"]')).toBeVisible();
    await clickNext(page);

    // Step 3: enemy-summoner — 高亮敌方召唤师
    await waitForTutorialStep(page, 'enemy-summoner', 10000);
    await expect(page.locator('[data-tutorial-id="sw-enemy-summoner"]')).toBeVisible();
    await clickNext(page);

    // Step 4: gate-intro — 高亮己方城门
    await waitForTutorialStep(page, 'gate-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-my-gate"]')).toBeVisible();
    await clickNext(page);

    // Step 5: hand-intro — 高亮手牌区
    await waitForTutorialStep(page, 'hand-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-hand-area"]')).toBeVisible();
    await clickNext(page);

    // Step 6: card-anatomy — 高亮第一张手牌
    await waitForTutorialStep(page, 'card-anatomy', 10000);
    await expect(page.locator('[data-tutorial-id="sw-first-hand-card"]')).toBeVisible();
    await clickNext(page);

    // Step 7: magic-intro — 高亮魔力条
    await waitForTutorialStep(page, 'magic-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-player-bar"]')).toBeVisible();
    await clickNext(page);

    // Step 8: phase-intro — 高亮阶段追踪器
    await waitForTutorialStep(page, 'phase-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-phase-tracker"]')).toBeVisible();
    await clickNext(page);

    // Step 9: summon-explain — 高亮状态横幅
    await waitForTutorialStep(page, 'summon-explain', 10000);
    await clickNext(page);

    // Step 10: summon-action（requireAction: 玩家需要召唤单位）
    await waitForTutorialStep(page, 'summon-action', 10000);
    await waitForActionPrompt(page);

    await page.waitForTimeout(1000);

    const playableUnits = page.locator('[data-card-type="unit"][data-can-play="true"]');
    await expect(playableUnits.first()).toBeVisible({ timeout: 10000 });
    await playableUnits.first().click({ force: true });
    await page.waitForTimeout(1000);

    const summonCells = page.locator('[data-valid-summon="true"]');
    await expect(summonCells.first()).toBeVisible({ timeout: 5000 });
    await summonCells.first().click({ force: true });
    await page.waitForTimeout(500);

    const stillOnSummon = await page.locator('[data-tutorial-step="summon-action"]')
      .isVisible({ timeout: 2000 }).catch(() => false);
    if (stillOnSummon) {
      await playableUnits.first().click({ force: true });
      await page.waitForTimeout(500);
      const summonCells2 = page.locator('[data-valid-summon="true"]');
      if (await summonCells2.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await summonCells2.first().dispatchEvent('click');
      }
    }

    // Step 11: ability-explain — 高亮己方召唤师
    await waitForTutorialStep(page, 'ability-explain', 15000);
    await clickNext(page);

    // Step 12: ability-action — 高亮弃牌堆（requireAction: 必须使用技能）
    await waitForTutorialStep(page, 'ability-action', 10000);
    await waitForActionPrompt(page);

    // 点击己方召唤师 → 在召唤阶段直接进入复活死灵的卡牌选择模式（无中间按钮）
    const summoner = page.locator('[data-testid^="sw-unit-"][data-unit-class="summoner"][data-owner="0"]');
    await expect(summoner.first()).toBeVisible({ timeout: 5000 });
    await summoner.first().click({ force: true });
    await page.waitForTimeout(800);

    // 弃牌堆卡牌选择浮层应自动弹出
    const cardSelectorOverlay = page.locator('[data-testid="sw-card-selector-overlay"]');
    const discardCard = cardSelectorOverlay.locator('[data-card-id]');
    await expect(discardCard.first()).toBeVisible({ timeout: 5000 });
    await discardCard.first().click({ force: true });
    await page.waitForTimeout(500);

    // 选择放置位置（复活死灵需要选择召唤师相邻空格）
    const reviveCells = page.locator('[data-valid-summon="true"]');
    if (await reviveCells.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await reviveCells.first().click({ force: true });
      await page.waitForTimeout(500);
    }

    // Step 13: end-summon
    await waitForTutorialStep(page, 'end-summon', 15000);
    await waitForActionPrompt(page);
    await clickEndPhase(page);

    // Step 14: move-explain
    await waitForTutorialStep(page, 'move-explain', 15000);
    await clickNext(page);

    // Step 15: move-action
    await waitForTutorialStep(page, 'move-action', 10000);
    await waitForActionPrompt(page);

    const myUnits = page.locator('[data-testid^="sw-unit-"][data-owner="0"]');
    await expect(myUnits.first()).toBeVisible({ timeout: 5000 });
    await myUnits.first().click({ force: true });
    await page.waitForTimeout(500);

    const moveCells = page.locator('[data-valid-move="true"]');
    if (await moveCells.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await moveCells.first().click({ force: true });
    }

    // Step 16: end-move
    await waitForTutorialStep(page, 'end-move', 15000);
    await waitForActionPrompt(page);
    await clickEndPhase(page);

    // Step 17: build-explain
    await waitForTutorialStep(page, 'build-explain', 15000);
    await clickNext(page);

    // Step 18: event-card-explain — 事件卡说明
    await waitForTutorialStep(page, 'event-card-explain', 10000);
    await clickNext(page);

    // Step 19: event-card-action — 施放事件卡（requireAction: 必须施放）
    await waitForTutorialStep(page, 'event-card-action', 10000);
    await waitForActionPrompt(page);

    // 点击手牌中的狱火铸剑事件卡
    const eventCards = page.locator('[data-card-type="event"][data-can-play="true"]');
    await expect(eventCards.first()).toBeVisible({ timeout: 10000 });
    await eventCards.first().click({ force: true });
    await page.waitForTimeout(500);

    // 选择一个友方士兵作为附着目标
    const eventTargets = page.locator('[data-valid-event-target="true"]');
    if (await eventTargets.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await eventTargets.first().click({ force: true });
      await page.waitForTimeout(500);
    } else {
      // 备选：直接点击友方非召唤师单位
      const friendlyCommons = page.locator('[data-testid^="sw-unit-"][data-owner="0"]:not([data-unit-class="summoner"])');
      if (await friendlyCommons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await friendlyCommons.first().click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // Step 20: build-action — 结束建造阶段
    await waitForTutorialStep(page, 'build-action', 15000);
    await waitForActionPrompt(page);
    await clickEndPhase(page);

    // Step 21: attack-explain
    await waitForTutorialStep(page, 'attack-explain', 15000);
    await clickNext(page);

    // Step 22: melee-explain
    await waitForTutorialStep(page, 'melee-explain', 10000);
    await clickNext(page);

    // Step 23: ranged-explain — 高亮己方召唤师
    await waitForTutorialStep(page, 'ranged-explain', 10000);
    await expect(page.locator('[data-tutorial-id="sw-my-summoner"]')).toBeVisible();
    await clickNext(page);

    // Step 24: attack-action（requireAction: 必须攻击）
    await waitForTutorialStep(page, 'attack-action', 10000);
    await waitForActionPrompt(page);
    await page.waitForTimeout(500);

    let attackSucceeded = false;
    const attackerUnits = page.locator('[data-testid^="sw-unit-"][data-owner="0"]');
    const attackerCount = await attackerUnits.count();

    for (let i = 0; i < attackerCount && !attackSucceeded; i++) {
      await attackerUnits.nth(i).click({ force: true });
      await page.waitForTimeout(500);
      const attackTargets = page.locator('[data-valid-attack="true"]');
      const targetCount = await attackTargets.count();
      if (targetCount > 0) {
        await attackTargets.first().click({ force: true });
        await page.waitForTimeout(500);
        attackSucceeded = true;
      }
    }

    if (attackSucceeded) {
      const diceOverlay = page.locator('[data-testid="sw-dice-result-overlay"]');
      if (await diceOverlay.isVisible({ timeout: 5000 }).catch(() => false)) {
        const diceConfirm = diceOverlay.locator('button');
        if (await diceConfirm.isVisible({ timeout: 5000 }).catch(() => false)) {
          await diceConfirm.click();
        }
      }
    }

    // Step 25: attack-result — 高亮敌方召唤师
    await waitForTutorialStep(page, 'attack-result', 15000);
    await clickNext(page);

    // Step 26: end-attack
    await waitForTutorialStep(page, 'end-attack', 15000);
    await waitForActionPrompt(page);
    await clickEndPhase(page);

    // Step 27: magic-explain
    await waitForTutorialStep(page, 'magic-explain', 15000);
    await clickNext(page);

    // Step 28: magic-action
    await waitForTutorialStep(page, 'magic-action', 10000);
    await waitForActionPrompt(page);
    await clickEndPhase(page);

    // Step 29: draw-explain
    await waitForTutorialStep(page, 'draw-explain', 15000);
    await clickNext(page);

    // Step 30: end-draw
    await waitForTutorialStep(page, 'end-draw', 10000);
    await waitForActionPrompt(page);
    await clickEndPhase(page);

    // Step 31: opponent-turn（AI 自动执行）

    // Step 32: inaction-penalty — 高亮敌方召唤师
    await waitForTutorialStep(page, 'inaction-penalty', 40000);
    await clickNext(page);

    // Step 33: victory-condition — 高亮己方召唤师
    await waitForTutorialStep(page, 'victory-condition', 10000);
    await clickNext(page);

    // Step 34: finish — 高亮棋盘
    await waitForTutorialStep(page, 'finish', 10000);
    await clickFinish(page);

    await expect(
      page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i })
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('教程入口可达性 - 从首页进入教程', async ({ page }) => {
    await setEnglishLocale(page);
    await disableAudio(page);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-game-id]').first()).toBeVisible({ timeout: 20000 });

    let card = page.locator('[data-game-id="summonerwars"]');
    if (await card.count() === 0) {
      const allTab = page.getByRole('button', { name: /All Games|全部游戏/i });
      if (await allTab.isVisible().catch(() => false)) {
        await allTab.click();
      }
    }
    await expect(card.first()).toBeVisible({ timeout: 15000 });
    await card.first().click();

    const tutorialBtn = page.getByRole('button', { name: /Tutorial|教程/i });
    await expect(tutorialBtn).toBeVisible({ timeout: 10000 });

    await tutorialBtn.click();
    await page.waitForURL(/\/play\/summonerwars\/tutorial/, { timeout: 15000 });

    await waitForTutorialStep(page, 'welcome', 40000);
    await expect(page.getByText(/Welcome to Summoner Wars|欢迎来到召唤师战争/i)).toBeVisible();
  });

  test('教程概览步骤 - 非交互步骤可正常点击推进', async ({ page }) => {
    test.setTimeout(60000);
    await setEnglishLocale(page);
    await disableAudio(page);

    await page.goto('/play/summonerwars/tutorial');
    await page.waitForLoadState('domcontentloaded');

    await waitForTutorialStep(page, 'welcome', 40000);

    // 验证所有概览步骤都有"下一步"按钮且可点击
    const overviewSteps = [
      'welcome', 'summoner-intro', 'enemy-summoner', 'gate-intro',
      'hand-intro', 'card-anatomy', 'magic-intro', 'phase-intro',
      'summon-explain',
    ];

    for (const stepId of overviewSteps) {
      await waitForTutorialStep(page, stepId, 10000);
      const nextBtn = page.getByRole('button', { name: /^(Next|下一步)$/i });
      await expect(nextBtn).toBeVisible({ timeout: 5000 });
      await nextBtn.click();
    }

    // 验证推进到了 summon-action（第一个交互步骤）
    await waitForTutorialStep(page, 'summon-action', 10000);
    const nextBtn = page.getByRole('button', { name: /^(Next|下一步)$/i });
    await expect(nextBtn).toHaveCount(0, { timeout: 3000 });
    await waitForActionPrompt(page);
  });

  test('教程高亮目标 - 每个步骤都高亮对应 UI 元素', async ({ page }) => {
    test.setTimeout(60000);
    await setEnglishLocale(page);
    await disableAudio(page);

    await page.goto('/play/summonerwars/tutorial');
    await page.waitForLoadState('domcontentloaded');

    // welcome: 高亮 sw-map-area
    await waitForTutorialStep(page, 'welcome', 40000);
    await expect(page.locator('[data-tutorial-id="sw-map-area"]')).toBeVisible();
    await clickNext(page);

    // summoner-intro: 高亮 sw-my-summoner
    await waitForTutorialStep(page, 'summoner-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-my-summoner"]')).toBeVisible();
    await clickNext(page);

    // enemy-summoner: 高亮 sw-enemy-summoner
    await waitForTutorialStep(page, 'enemy-summoner', 10000);
    await expect(page.locator('[data-tutorial-id="sw-enemy-summoner"]')).toBeVisible();
    await clickNext(page);

    // gate-intro: 高亮 sw-my-gate
    await waitForTutorialStep(page, 'gate-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-my-gate"]')).toBeVisible();
    await clickNext(page);

    // hand-intro: 高亮 sw-hand-area
    await waitForTutorialStep(page, 'hand-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-hand-area"]')).toBeVisible();
    await clickNext(page);

    // card-anatomy: 高亮 sw-first-hand-card
    await waitForTutorialStep(page, 'card-anatomy', 10000);
    await expect(page.locator('[data-tutorial-id="sw-first-hand-card"]')).toBeVisible();
    await clickNext(page);

    // magic-intro: 高亮 sw-player-bar
    await waitForTutorialStep(page, 'magic-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-player-bar"]')).toBeVisible();
    await clickNext(page);

    // phase-intro: 高亮 sw-phase-tracker
    await waitForTutorialStep(page, 'phase-intro', 10000);
    await expect(page.locator('[data-tutorial-id="sw-phase-tracker"]')).toBeVisible();
  });

  test('教程 UI 元素完整性 - 游戏界面关键组件可见', async ({ page }) => {
    test.setTimeout(60000);
    await setEnglishLocale(page);
    await disableAudio(page);

    await page.goto('/play/summonerwars/tutorial');
    await page.waitForLoadState('domcontentloaded');

    await waitForTutorialStep(page, 'welcome', 40000);
    await clickNext(page);
    await waitForTutorialStep(page, 'summoner-intro', 10000);

    // 验证关键 UI 组件都已渲染
    await expect(page.locator('[data-testid="sw-map-layer"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="sw-hand-area"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="sw-phase-tracker"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="sw-end-phase"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="sw-energy-player"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="sw-energy-opponent"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="sw-action-banner"]')).toBeVisible({ timeout: 5000 });

    // 验证新增的 tutorial-id 元素
    await expect(page.locator('[data-tutorial-id="sw-my-summoner"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-tutorial-id="sw-enemy-summoner"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-tutorial-id="sw-my-gate"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-tutorial-id="sw-first-hand-card"]')).toBeVisible({ timeout: 5000 });

    // 验证棋盘上有单位
    const units = page.locator('[data-testid^="sw-unit-"]');
    await expect(units.first()).toBeVisible({ timeout: 5000 });
    const unitCount = await units.count();
    expect(unitCount).toBeGreaterThanOrEqual(4);
  });
});
