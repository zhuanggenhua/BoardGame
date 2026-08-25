/**
 * SmashUp 教学调试 - 专注 opponentTurn 步骤
 * 通过注入浏览器端日志收集器来追踪事件流
 */
import { type Page } from '@playwright/test';
import { test, expect } from '../framework';
import { setEnglishLocale, disableAudio, blockAudioRequests } from '../helpers/common';
import type { GameTestContext as __ThreeAxeFrameworkMarker } from '../framework';

type InteractionOption = {
    id: string;
    label?: string;
    value?: Record<string, unknown>;
};

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;


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

const clickHandCard = async (page: Page, cardUid: string) => {
    const spotlightClose = page.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i });
    if (await spotlightClose.isVisible().catch(() => false)) {
        await spotlightClose.click({ force: true });
        await page.waitForTimeout(300);
    }
    const card = page.locator(`[data-testid="su-hand-area"] [data-card-uid="${cardUid}"]`);
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click({ force: true });
    await page.waitForTimeout(300);
};

const clickLocatorCenter = async (page: Page, selector: string) => {
    const locator = page.locator(selector).first();
    await expect(locator).toBeVisible({ timeout: 10000 });
    const box = await locator.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(
        (box?.x ?? 0) + (box?.width ?? 0) / 2,
        (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    await page.waitForTimeout(300);
};

const playMinionToFirstBase = async (page: Page, stepId: string, cardUid: string) => {
    await waitForStep(page, stepId, 15000);
    await waitForActionPrompt(page);
    await clickHandCard(page, cardUid);
    await clickLocatorCenter(page, '[data-base-index="0"]');
    await page.waitForTimeout(800);
};

const playActionWithoutTarget = async (page: Page, stepId: string, cardUid: string) => {
    await waitForStep(page, stepId, 15000);
    await waitForActionPrompt(page);
    await clickHandCard(page, cardUid);
    await clickHandCard(page, cardUid);
    await page.waitForTimeout(800);
};

const waitForInteractionSource = async (game: { getState: () => Promise<unknown> }, sourceId: string) => {
    await expect.poll(async () => {
        const state = await game.getState() as {
            sys?: {
                interaction?: {
                    current?: {
                        data?: {
                            sourceId?: string | null;
                        };
                    };
                };
            };
        };
        return state.sys?.interaction?.current?.data?.sourceId ?? null;
    }, { timeout: 10000 }).toBe(sourceId);
};

const selectInteractionOption = async (
    game: {
        getInteractionOptions: () => Promise<unknown[]>;
        selectOption: (optionId: string) => Promise<void>;
    },
    matcher: (option: InteractionOption) => boolean,
    description: string,
) => {
    const options = await game.getInteractionOptions() as InteractionOption[];
    const option = options.find(matcher);
    expect(option, `未找到交互选项：${description}`).toBeTruthy();
    await game.selectOption(option!.id);
};

const playTechCenter = async (
    page: Page,
    game: {
        getState: () => Promise<unknown>;
        getInteractionOptions: () => Promise<unknown[]>;
        selectOption: (optionId: string) => Promise<void>;
    },
) => {
    await waitForStep(page, 'playTechCenter', 15000);
    await waitForActionPrompt(page);
    await clickHandCard(page, 'tut-tech');
    await clickHandCard(page, 'tut-tech');
    await waitForInteractionSource(game, 'robot_tech_center');
    await selectInteractionOption(
        game,
        option => option.value?.targetBaseIndex === 0 || option.value?.baseIndex === 0,
        '技术中心选择第一个基地',
    );
    await page.waitForTimeout(800);
};

test.describe('SmashUp Tutorial Debug', () => {
    test('追踪 opponentTurn 事件流', async ({ context, page, game }, testInfo) => {
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

        await page.goto('/play/smashup/tutorial/smashup-basic');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('[data-game-page][data-game-id="smashup"]', { timeout: 60000 });

        // 快速推进到 opponentTurn 之前
        await waitForStep(page, 'welcome', 40000);
        await clickNext(page);
        for (const s of [
            'scoreboard',
            'opponentView',
            'deckDiscardIntro',
            'handIntro',
            'turnTracker',
            'endTurnBtn',
            'playCardsExplain',
        ]) {
            await waitForStep(page, s, 10000);
            await clickNext(page);
        }

        await playMinionToFirstBase(page, 'playChronomage', 'tut-chrono');
        await playActionWithoutTarget(page, 'playSummon', 'tut-summon');
        await playMinionToFirstBase(page, 'extraZapbot', 'tut-zapbot');
        await waitForStep(page, 'comboBoardRead', 15000);
        await clickNext(page);
        await playTechCenter(page, game);
        await waitForStep(page, 'deckAfterDraw', 15000);
        await clickNext(page);

        // endPlayCards
        await waitForStep(page, 'endPlayCards', 15000);
        await waitForActionPrompt(page);
        const finishBtn = page.getByTestId('su-end-turn-action-button');
        await expect(finishBtn).toBeVisible({ timeout: 5000 });
        await finishBtn.click({ force: true });
        await page.waitForTimeout(500);

        // baseScoring + vpAwards
        await waitForStep(page, 'baseScoring', 15000);
        await clickNext(page);
        await waitForStep(page, 'vpAwards', 10000);
        await clickNext(page);
        await waitForStep(page, 'scoringPhase', 15000);
        await clickNext(page);

        // drawExplain + handLimit + endDraw
        await waitForStep(page, 'drawExplain', 20000);
        await clickNext(page);
        await waitForStep(page, 'handLimit', 10000);
        await clickNext(page);
        await waitForStep(page, 'endDraw', 10000);

        consoleLogs.length = 0;
        console.log('\n=== 点击 endDraw 的 Next，进入 opponentTurn 并等待回到己方回合 ===\n');
        await clickNext(page);

        const found = await page.locator('[data-tutorial-step="turnCycle"]')
            .isVisible({ timeout: 5000 }).catch(() => false);

        await expect.poll(async () => {
            const state = await game.getState() as {
                core: {
                    turnOrder: string[];
                    currentPlayerIndex: number;
                };
                sys?: {
                    phase?: string;
                };
            };
            return {
                currentPlayerId: state.core.turnOrder[state.core.currentPlayerIndex] ?? null,
                phase: state.sys?.phase ?? null,
            };
        }, { timeout: 45000 }).toEqual({
            currentPlayerId: '0',
            phase: 'playCards',
        });

        console.log(`\n=== turnCycle 是否出现: ${found} ===`);
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
    });
});
