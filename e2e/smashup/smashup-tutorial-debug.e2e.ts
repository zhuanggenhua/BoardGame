/**
 * SmashUp 教学调试 - 专注 opponentTurn 步骤
 * 通过注入浏览器端日志收集器来追踪事件流
 */
import { test, expect, type Page } from '@playwright/test';
import { setEnglishLocale, disableAudio, blockAudioRequests } from '../helpers/common';

const waitForStep = async (page: Page, stepId: string, timeout = 30000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};
const clickNext = async (page: Page) => {
    const btn = page.getByRole('button', { name: /^(Next|下一步)$/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click({ force: true });
    await page.waitForTimeout(300);
};
const waitForActionPrompt = async (page: Page) => {
    await expect(page.locator('[data-tutorial-step] .animate-pulse')).toBeVisible({ timeout: 15000 });
};

test.describe('SmashUp Tutorial Debug', () => {
    test('追踪 opponentTurn 事件流', async ({ context, page }, testInfo) => {
        test.setTimeout(180000);
        await setEnglishLocale(context);
        await disableAudio(context);
        await blockAudioRequests(context);

        const consoleLogs: string[] = [];
        page.on('console', (msg) => {
            const text = msg.text();
            if (
                text.includes('FlowSystem') || text.includes('TutorialSystem') ||
                text.includes('TURN_') || text.includes('autoContinue') ||
                text.includes('tutorial') || text.includes('ADVANCE_PHASE')
            ) {
                consoleLogs.push(`[${msg.type()}] ${text}`);
            }
        });

        await page.goto('/play/smashup/tutorial');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#root > *', { timeout: 15000 });

        // 快速推进到 opponentTurn 之前
        await waitForStep(page, 'welcome', 40000);
        await clickNext(page);
        for (const s of ['scoreboard', 'handIntro', 'turnTracker', 'endTurnBtn', 'playCardsExplain']) {
            await waitForStep(page, s, 10000);
            await clickNext(page);
        }

        // playMinion
        await waitForStep(page, 'playMinion', 10000);
        await waitForActionPrompt(page);
        await page.waitForTimeout(500);
        const handArea = page.locator('[data-testid="su-hand-area"]');
        const cards = handArea.locator('> div > div');
        await expect(cards.first()).toBeVisible({ timeout: 10000 });
        await cards.first().click({ force: true });
        await page.waitForTimeout(500);
        const bases = page.locator('.group\\/base');
        await expect(bases.first()).toBeVisible({ timeout: 5000 });
        await bases.first().click({ force: true });
        await page.waitForTimeout(1000);

        // playAction
        await waitForStep(page, 'playAction', 15000);
        await waitForActionPrompt(page);
        await page.waitForTimeout(500);
        const actionCards = handArea.locator('> div > div');
        const count = await actionCards.count();
        for (let i = 0; i < count; i++) {
            await actionCards.nth(i).click({ force: true });
            await page.waitForTimeout(300);
            if (await bases.first().isVisible().catch(() => false)) {
                await bases.first().click({ force: true });
                await page.waitForTimeout(500);
            }
            if (!(await page.locator('[data-tutorial-step="playAction"]').isVisible({ timeout: 1000 }).catch(() => false))) break;
        }

        // endPlayCards
        await waitForStep(page, 'endPlayCards', 15000);
        await waitForActionPrompt(page);
        const finishBtn = page.getByRole('button', { name: /Finish Turn|结束回合/i });
        await expect(finishBtn).toBeVisible({ timeout: 5000 });
        await finishBtn.click({ force: true });
        await page.waitForTimeout(500);

        // baseScoring + vpAwards
        await waitForStep(page, 'baseScoring', 15000);
        await clickNext(page);
        await waitForStep(page, 'vpAwards', 10000);
        await clickNext(page);

        // drawExplain + handLimit + endDraw
        await waitForStep(page, 'drawExplain', 20000);
        await clickNext(page);
        await waitForStep(page, 'handLimit', 10000);
        await clickNext(page);
        await waitForStep(page, 'endDraw', 10000);

        consoleLogs.length = 0;
        console.log('\n=== 点击 endDraw 的 Next，进入 opponentTurn ===\n');
        await clickNext(page);

        const found = await page.locator('[data-tutorial-step="talentIntro"]')
            .isVisible({ timeout: 45000 }).catch(() => false);

        console.log(`\n=== talentIntro 是否出现: ${found} ===`);
        console.log(`=== 收集到 ${consoleLogs.length} 条日志 ===\n`);
        consoleLogs.forEach((l) => console.log(l));

        if (!found) {
            const tutorialState = await page.evaluate(() => {
                const stepEl = document.querySelector('[data-tutorial-step]');
                const stepId = stepEl?.getAttribute('data-tutorial-step') ?? 'none';
                const mask = document.querySelector('[data-tutorial-mask]');
                return {
                    currentStepId: stepId,
                    hasMask: !!mask,
                    bodyText: document.body.innerText.substring(0, 500),
                };
            });
            console.log('\n=== 当前教学状态 ===');
            console.log(JSON.stringify(tutorialState, null, 2));
        }

        await page.screenshot({ path: testInfo.outputPath('debug-opponentTurn.png') });
        expect(found).toBe(true);
    });
});
