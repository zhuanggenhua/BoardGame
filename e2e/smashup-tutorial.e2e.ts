/**
 * 大杀四方 (Smash Up) - 教程 E2E 测试
 *
 * 覆盖范围：
 * - 教程初始化（自动派系选择、作弊设置固定手牌）
 * - 逐步 UI 元素介绍（基地区、记分板、手牌、回合追踪器、结束按钮）
 * - 出牌阶段交互（打出随从、打出行动、结束出牌）
 * - 基地记分与抽牌阶段（信息步骤 + AI 自动推进）
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

/** 点击"下一步"按钮（带重试） */
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

/** 导航到大杀四方教程页面 */
const navigateToTutorial = async (page: Page) => {
    await page.goto('/play/smashup/tutorial');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#root > *', { timeout: 15000 });
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('Smash Up Tutorial E2E', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ context }) => {
        await blockAudioRequests(context);
    });

    // ========================================================================
    // 9.1 教程初始化与 UI 介绍
    // ========================================================================

    test('教程初始化与 UI 介绍 — 自动派系选择 + 逐步 Next 推进', async ({ page }) => {
        test.setTimeout(90000);
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        // Step 0: setup（AI 自动执行蛇形选秀 + 作弊设置手牌）
        // Step 1: welcome — 高亮基地区域
        await waitForTutorialStep(page, 'welcome', 40000);
        await expect(page.locator('[data-tutorial-id="su-base-area"]')).toBeVisible();
        await clickNext(page);

        // Step 2: scoreboard — 高亮记分板
        await waitForTutorialStep(page, 'scoreboard', 10000);
        await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible();
        await clickNext(page);

        // Step 3: handIntro — 高亮手牌区
        await waitForTutorialStep(page, 'handIntro', 10000);
        await expect(page.locator('[data-tutorial-id="su-hand-area"]')).toBeVisible();
        await clickNext(page);

        // Step 4: turnTracker — 高亮回合追踪器
        await waitForTutorialStep(page, 'turnTracker', 10000);
        await expect(page.locator('[data-tutorial-id="su-turn-tracker"]')).toBeVisible();
        await clickNext(page);

        // Step 5: endTurnBtn — 高亮结束按钮
        await waitForTutorialStep(page, 'endTurnBtn', 10000);
        await expect(page.locator('[data-tutorial-id="su-end-turn-btn"]')).toBeVisible();
        await clickNext(page);

        // Step 6: playCardsExplain — 出牌阶段说明
        await waitForTutorialStep(page, 'playCardsExplain', 10000);
        await expect(page.locator('[data-tutorial-id="su-hand-area"]')).toBeVisible();
        await clickNext(page);

        // 验证推进到了 playMinion（第一个交互步骤）
        await waitForTutorialStep(page, 'playMinion', 10000);
        // requireAction 步骤没有 Next 按钮
        const nextBtn = page.getByRole('button', { name: /^(Next|下一步)$/i });
        await expect(nextBtn).toHaveCount(0, { timeout: 3000 });
        await waitForActionPrompt(page);
    });

    // ========================================================================
    // 9.2 出牌阶段交互
    // ========================================================================

    test('出牌阶段交互 — 打出随从 + 行动 + 结束出牌', async ({ page }) => {
        test.setTimeout(120000);
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        // 快速跳过 UI 介绍步骤（steps 1-6）
        await waitForTutorialStep(page, 'welcome', 40000);
        const introSteps = ['welcome', 'scoreboard', 'handIntro', 'turnTracker', 'endTurnBtn', 'playCardsExplain'];
        for (const stepId of introSteps) {
            await waitForTutorialStep(page, stepId, 10000);
            await clickNext(page);
        }

        // Step 7: playMinion — 玩家必须打出一张随从卡
        await waitForTutorialStep(page, 'playMinion', 10000);
        await waitForActionPrompt(page);
        await page.waitForTimeout(500);

        // 点击手牌中的随从卡
        const handArea = page.locator('[data-tutorial-id="su-hand-area"]');
        await expect(handArea).toBeVisible();

        // 点击第一张手牌（战争猛禽，随从）
        const handCards = handArea.locator('[data-testid="su-hand-area"]').locator('> div > div');
        await expect(handCards.first()).toBeVisible({ timeout: 10000 });
        await handCards.first().click({ force: true });
        await page.waitForTimeout(500);

        // 选择基地放置
        const bases = page.locator('.group\\/base');
        await expect(bases.first()).toBeVisible({ timeout: 5000 });
        await bases.first().click({ force: true });
        await page.waitForTimeout(1000);

        // Step 8: playAction — 玩家必须打出一张行动卡（advanceOnEvents 自动推进）
        await waitForTutorialStep(page, 'playAction', 15000);
        await waitForActionPrompt(page);
        await page.waitForTimeout(500);

        // 点击行动卡（手牌中剩余的行动卡）
        const remainingCards = handArea.locator('[data-testid="su-hand-area"]').locator('> div > div');
        const cardCount = await remainingCards.count();
        // 遍历手牌找到行动卡并点击
        for (let i = 0; i < cardCount; i++) {
            await remainingCards.nth(i).click({ force: true });
            await page.waitForTimeout(300);
            // 尝试选择基地
            if (await bases.first().isVisible().catch(() => false)) {
                await bases.first().click({ force: true });
                await page.waitForTimeout(500);
            }
            // 检查是否推进到下一步
            const stillOnAction = await page.locator('[data-tutorial-step="playAction"]')
                .isVisible({ timeout: 1000 }).catch(() => false);
            if (!stillOnAction) break;
        }

        // Step 9: endPlayCards — 引导点击结束按钮
        await waitForTutorialStep(page, 'endPlayCards', 15000);
        await waitForActionPrompt(page);

        // 点击结束回合按钮
        const endTurnBtn = page.locator('[data-tutorial-id="su-end-turn-btn"]');
        await expect(endTurnBtn).toBeVisible({ timeout: 5000 });
        // 点击按钮内的实际 button 元素
        const finishTurnButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
        await expect(finishTurnButton).toBeVisible({ timeout: 5000 });
        await finishTurnButton.click({ force: true });
        await page.waitForTimeout(500);

        // 验证推进到了基地记分阶段
        await waitForTutorialStep(page, 'baseScoring', 15000);
    });

    // ========================================================================
    // 9.3 完整教程流程
    // ========================================================================

    test('完整教程流程 — 从初始化到完成', async ({ page }, testInfo) => {
        test.setTimeout(180000);
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        // Step 0: setup（AI 自动执行）
        // Step 1: welcome
        await waitForTutorialStep(page, 'welcome', 40000);
        await clickNext(page);

        // Steps 2-6: UI 介绍（快速点击 Next）
        for (const stepId of ['scoreboard', 'handIntro', 'turnTracker', 'endTurnBtn', 'playCardsExplain']) {
            await waitForTutorialStep(page, stepId, 10000);
            await clickNext(page);
        }

        // Step 7: playMinion — 打出随从
        await waitForTutorialStep(page, 'playMinion', 10000);
        await waitForActionPrompt(page);
        await page.waitForTimeout(500);

        const handArea = page.locator('[data-testid="su-hand-area"]');
        const handCards = handArea.locator('> div > div');
        await expect(handCards.first()).toBeVisible({ timeout: 10000 });
        await handCards.first().click({ force: true });
        await page.waitForTimeout(500);

        const bases = page.locator('.group\\/base');
        await expect(bases.first()).toBeVisible({ timeout: 5000 });
        await bases.first().click({ force: true });
        await page.waitForTimeout(1000);

        // Step 8: playAction — 打出行动
        await waitForTutorialStep(page, 'playAction', 15000);
        await waitForActionPrompt(page);
        await page.waitForTimeout(500);

        // 遍历手牌找到行动卡
        const actionCards = handArea.locator('> div > div');
        const actionCardCount = await actionCards.count();
        for (let i = 0; i < actionCardCount; i++) {
            await actionCards.nth(i).click({ force: true });
            await page.waitForTimeout(300);
            if (await bases.first().isVisible().catch(() => false)) {
                await bases.first().click({ force: true });
                await page.waitForTimeout(500);
            }
            const stillOnAction = await page.locator('[data-tutorial-step="playAction"]')
                .isVisible({ timeout: 1000 }).catch(() => false);
            if (!stillOnAction) break;
        }

        // Step 9: endPlayCards — 结束出牌
        await waitForTutorialStep(page, 'endPlayCards', 15000);
        await waitForActionPrompt(page);
        const finishTurnButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
        await expect(finishTurnButton).toBeVisible({ timeout: 5000 });
        await finishTurnButton.click({ force: true });
        await page.waitForTimeout(500);

        // Steps 10-11: 基地记分概念 + VP 奖励说明
        await waitForTutorialStep(page, 'baseScoring', 15000);
        await clickNext(page);

        await waitForTutorialStep(page, 'vpAwards', 10000);
        await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible();
        await clickNext(page);

        // Step 12: scoringPhase — AI 自动推进（showMask，不显示 overlay）
        // Step 13: drawExplain — 抽牌阶段说明
        await waitForTutorialStep(page, 'drawExplain', 20000);
        await expect(page.locator('[data-tutorial-id="su-deck-discard"]')).toBeVisible();
        await clickNext(page);

        // Step 14: handLimit — 手牌上限说明
        await waitForTutorialStep(page, 'handLimit', 10000);
        await clickNext(page);

        // Step 15: endDraw — 结束抽牌（requireAction）
        await waitForTutorialStep(page, 'endDraw', 10000);
        await waitForActionPrompt(page);
        const finishTurnButton2 = page.getByRole('button', { name: /Finish Turn|结束回合/i });
        await expect(finishTurnButton2).toBeVisible({ timeout: 5000 });
        await finishTurnButton2.click({ force: true });
        await page.waitForTimeout(500);

        // Step 16: opponentTurn — AI 自动执行对手回合（showMask）
        // Step 17: talentIntro — 天赋能力说明
        await waitForTutorialStep(page, 'talentIntro', 40000);
        await clickNext(page);

        // Step 18: turnCycle — 回合循环说明
        await waitForTutorialStep(page, 'turnCycle', 10000);
        await clickNext(page);

        // Step 19: summary — 教学总结
        await waitForTutorialStep(page, 'summary', 10000);
        await clickNext(page);

        // Step 20: finish — 教学完成
        await waitForTutorialStep(page, 'finish', 10000);
        await expect(page.locator('[data-tutorial-id="su-base-area"]')).toBeVisible();
        await clickFinish(page);

        // 验证教程结束后 overlay 消失
        await expect(
            page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i })
        ).toHaveCount(0, { timeout: 10000 });

        await page.screenshot({ path: testInfo.outputPath('tutorial-complete.png') });
    });

    // ========================================================================
    // 教程入口可达性
    // ========================================================================

    test('教程入口可达性 — 从首页进入教程', async ({ page }) => {
        test.setTimeout(60000);
        await setEnglishLocale(page);
        await disableAudio(page);

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('[data-game-id]').first()).toBeVisible({ timeout: 20000 });

        // 找到大杀四方卡片
        let card = page.locator('[data-game-id="smashup"]');
        if (await card.count() === 0) {
            const allTab = page.getByRole('button', { name: /All Games|全部游戏/i });
            if (await allTab.isVisible().catch(() => false)) {
                await allTab.click();
            }
        }
        await expect(card.first()).toBeVisible({ timeout: 15000 });
        await card.first().click();

        // 点击教程按钮
        const tutorialBtn = page.getByRole('button', { name: /Tutorial|教程/i });
        await expect(tutorialBtn).toBeVisible({ timeout: 10000 });
        await tutorialBtn.click();

        // 验证导航到教程页面
        await page.waitForURL(/\/play\/smashup\/tutorial/, { timeout: 15000 });

        // 验证教程启动
        await waitForTutorialStep(page, 'welcome', 40000);
    });

    // ========================================================================
    // 高亮目标验证
    // ========================================================================

    test('教程高亮目标 — 每个 UI 介绍步骤都高亮对应元素', async ({ page }) => {
        test.setTimeout(60000);
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        // welcome: 高亮 su-base-area
        await waitForTutorialStep(page, 'welcome', 40000);
        await expect(page.locator('[data-tutorial-id="su-base-area"]')).toBeVisible();
        await clickNext(page);

        // scoreboard: 高亮 su-scoreboard
        await waitForTutorialStep(page, 'scoreboard', 10000);
        await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible();
        await clickNext(page);

        // handIntro: 高亮 su-hand-area
        await waitForTutorialStep(page, 'handIntro', 10000);
        await expect(page.locator('[data-tutorial-id="su-hand-area"]')).toBeVisible();
        await clickNext(page);

        // turnTracker: 高亮 su-turn-tracker
        await waitForTutorialStep(page, 'turnTracker', 10000);
        await expect(page.locator('[data-tutorial-id="su-turn-tracker"]')).toBeVisible();
        await clickNext(page);

        // endTurnBtn: 高亮 su-end-turn-btn
        await waitForTutorialStep(page, 'endTurnBtn', 10000);
        await expect(page.locator('[data-tutorial-id="su-end-turn-btn"]')).toBeVisible();
    });
});
