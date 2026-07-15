import type { Page } from '@playwright/test';
import { expect, test } from '../framework/fixtures';
import { setChineseLocale } from '../helpers/common';
import {
    buildShowdownResults,
    type ShowdownPlayerResult,
    type TheGangCore,
} from '../../src/games/the-gang/domain';

const THE_GANG_IMAGE_LOAD_TIMEOUT_MS = 15_000;

const strengthOrder = (left: ShowdownPlayerResult, right: ShowdownPlayerResult) => {
    const categoryDelta = left.strength.category - right.strength.category;
    if (categoryDelta !== 0) return categoryDelta;

    for (let index = 0; index < Math.max(left.strength.ranks.length, right.strength.ranks.length); index += 1) {
        const rankDelta = (left.strength.ranks[index] ?? 0) - (right.strength.ranks[index] ?? 0);
        if (rankDelta !== 0) return rankDelta;
    }

    return 0;
};

async function clearTheGangTutorialProgress(page: Page) {
    await page.addInitScript(() => {
        const prefixes = [
            'tutorial-progress:v1:the-gang',
            'boardgame:tutorial-completion:v1:the-gang',
        ];
        for (const key of Object.keys(localStorage)) {
            if (prefixes.some((prefix) => key.startsWith(prefix))) {
                localStorage.removeItem(key);
            }
        }
    });
}

async function nextTutorialStep(page: Page) {
    await page.getByTestId('tutorial-next-button').click();
}

async function clickHumanProgressAndWaitForAi(page: Page, buttonName: string) {
    await page.getByRole('button', { name: buttonName }).click();
}

async function computeFinalChipsForSuccessfulShowdown(page: Page) {
    const core = await page.evaluate(() => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { get?: () => unknown };
            };
        }).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.() as { core?: TheGangCore } | undefined;
        return state?.core ?? null;
    });
    if (!core) throw new Error('The Gang tutorial state is unavailable');

    const finalChips = [...buildShowdownResults(core)]
        .sort(strengthOrder)
        .reduce<Record<string, number>>((chips, result, index) => {
            chips[result.playerId] = index + 1;
            return chips;
        }, {});

    return finalChips;
}

async function expectImagesLoaded(page: Page, selector: string, expectedCount: number) {
    const images = page.locator(selector);
    await expect(images).toHaveCount(expectedCount);
    await expect
        .poll(
            async () =>
                images.evaluateAll((nodes) =>
                    nodes
                        .map((node) => {
                            const image = node as HTMLImageElement;
                            return {
                                alt: image.alt,
                                complete: image.complete,
                                naturalHeight: image.naturalHeight,
                                naturalWidth: image.naturalWidth,
                                src: image.currentSrc || image.src,
                            };
                        })
                        .filter((image) =>
                            !image.complete
                            || image.src.length === 0
                            || image.naturalWidth <= 1
                            || image.naturalHeight <= 1
                        ),
                ),
            {
                message: `等待 ${selector} 的真实图片资源加载完成`,
                timeout: THE_GANG_IMAGE_LOAD_TIMEOUT_MS,
            },
        )
        .toEqual([]);
    const emptySources = await images.evaluateAll((nodes) =>
        nodes
            .map((node) => {
                const image = node as HTMLImageElement;
                return image.currentSrc || image.src;
            })
            .filter((src) => src.length === 0),
    );
    expect(emptySources, `${selector} 存在空图片地址`).toEqual([]);
}

type TheGangHarnessState = {
    core?: TheGangCore;
};

type TheGangTestWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => TheGangHarnessState | null;
        };
    };
};

async function getTheGangCore(page: Page): Promise<TheGangCore> {
    const core = await page.evaluate(() => {
        const harness = (window as TheGangTestWindow).__BG_TEST_HARNESS__;
        return harness?.state?.get?.()?.core ?? null;
    });
    if (!core) throw new Error('The Gang tutorial state is unavailable');
    return core;
}

async function expectCurrentRoundChips(page: Page, expectedCount: number) {
    await expect
        .poll(
            async () => Object.keys((await getTheGangCore(page)).currentRoundChips ?? {}).length,
            { message: `等待当前轮 ${expectedCount} 名玩家完成筹码选择` },
        )
        .toBe(expectedCount);
}

async function getCurrentRoundChips(page: Page): Promise<Record<string, number>> {
    return (await getTheGangCore(page)).currentRoundChips;
}

async function expectTokenPileChipButtons(page: Page, chipPrefix: string, expectedValues: number[]) {
    const tokenPile = page.locator('[data-bgg-zone="token-pile"]');
    for (const value of [1, 2, 3]) {
        const chipButton = tokenPile.getByRole('button', { name: `${chipPrefix} ${value} 星` });
        if (expectedValues.includes(value)) {
            await expect(chipButton).toBeVisible();
        } else {
            await expect(chipButton).toHaveCount(0);
        }
    }
}

async function expectTutorialHighlightCoversVisibleTarget(page: Page, targetId: string) {
    await expect(page.locator(`[data-tutorial-id="${targetId}"]`)).toBeVisible();
    const ring = page.getByTestId('tutorial-highlight-ring');
    await expect(ring).toBeVisible();
    await expect(ring).toHaveAttribute('data-tutorial-highlight-target', targetId);
    const geometry = await page.evaluate((id) => {
        const target = document.querySelector<HTMLElement>(`[data-tutorial-id="${id}"]`);
        const highlight = document.querySelector<HTMLElement>('[data-testid="tutorial-highlight-ring"]');
        if (!target || !highlight) return null;
        const targetRect = target.getBoundingClientRect();
        const highlightRect = highlight.getBoundingClientRect();
        const horizontalOverlap = Math.max(
            0,
            Math.min(targetRect.right, highlightRect.right) - Math.max(targetRect.left, highlightRect.left),
        );
        const verticalOverlap = Math.max(
            0,
            Math.min(targetRect.bottom, highlightRect.bottom) - Math.max(targetRect.top, highlightRect.top),
        );
        const overlapArea = horizontalOverlap * verticalOverlap;
        const targetArea = targetRect.width * targetRect.height;
        return {
            targetWidth: targetRect.width,
            targetHeight: targetRect.height,
            highlightWidth: highlightRect.width,
            highlightHeight: highlightRect.height,
            overlapRatio: targetArea > 0 ? overlapArea / targetArea : 0,
            centerDeltaX: Math.abs((targetRect.left + targetRect.right) / 2 - (highlightRect.left + highlightRect.right) / 2),
            centerDeltaY: Math.abs((targetRect.top + targetRect.bottom) / 2 - (highlightRect.top + highlightRect.bottom) / 2),
        };
    }, targetId);
    expect(geometry, `${targetId} 必须有可测几何`).not.toBeNull();
    expect(geometry?.targetWidth, `${targetId} 不能是空宽度锚点`).toBeGreaterThan(1);
    expect(geometry?.targetHeight, `${targetId} 不能是空高度锚点`).toBeGreaterThan(1);
    expect(geometry?.highlightWidth, `${targetId} 蓝框不能是空宽度`).toBeGreaterThan(1);
    expect(geometry?.highlightHeight, `${targetId} 蓝框不能是空高度`).toBeGreaterThan(1);
    expect(geometry?.overlapRatio, `${targetId} 蓝框必须覆盖真实目标主体`).toBeGreaterThan(0.9);
    expect(geometry?.centerDeltaX, `${targetId} 蓝框水平中心必须贴住真实目标`).toBeLessThan(6);
    expect(geometry?.centerDeltaY, `${targetId} 蓝框垂直中心必须贴住真实目标`).toBeLessThan(6);
}

async function expectTutorialCardDoesNotCoverTarget(page: Page, targetId: string) {
    await expect(page.locator(`[data-tutorial-id="${targetId}"]`)).toBeVisible();
    const geometry = await page.evaluate((id) => {
        const target = document.querySelector<HTMLElement>(`[data-tutorial-id="${id}"]`);
        const card = document.querySelector<HTMLElement>('[data-testid="tutorial-overlay-card"]');
        if (!target || !card) return null;
        const targetRect = target.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const placement = card.getAttribute('data-tutorial-placement');
        const horizontalOverlap = Math.max(
            0,
            Math.min(targetRect.right, cardRect.right) - Math.max(targetRect.left, cardRect.left),
        );
        const verticalOverlap = Math.max(
            0,
            Math.min(targetRect.bottom, cardRect.bottom) - Math.max(targetRect.top, cardRect.top),
        );
        return {
            overlapArea: horizontalOverlap * verticalOverlap,
            targetArea: targetRect.width * targetRect.height,
            targetRect: {
                left: targetRect.left,
                top: targetRect.top,
                right: targetRect.right,
                bottom: targetRect.bottom,
                width: targetRect.width,
                height: targetRect.height,
            },
            cardRect: {
                left: cardRect.left,
                top: cardRect.top,
                right: cardRect.right,
                bottom: cardRect.bottom,
                width: cardRect.width,
                height: cardRect.height,
            },
            placement,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
        };
    }, targetId);
    expect(geometry, `${targetId} 必须能测量教程卡片与目标位置`).not.toBeNull();
    expect(geometry?.targetArea, `${targetId} 不能是空目标`).toBeGreaterThan(1);
    expect(
        geometry?.overlapArea,
        `${targetId} 教程文案框不能遮挡教学目标；geometry=${JSON.stringify(geometry)}`,
    ).toBe(0);
}

test.describe('The Gang 教程 E2E', () => {
    test('桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈', async ({ game, page }, testInfo) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await setChineseLocale(page);
        await clearTheGangTutorialProgress(page);

        await page.goto('/play/the-gang/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="intro"]')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/完成 3 次抢劫就赢/u)).toBeVisible();
        await game.screenshot('教程开场目标和胜负条件', testInfo);

        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="goal-track"]')).toBeVisible();
        await expect(page.getByText(/金条先到 3 个全队获胜/u)).toBeVisible();

        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="hand"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-hand"]')).toBeVisible();
        await expect(page.getByText(/这是你的底牌和当前最佳牌型/u)).toBeVisible();
        await game.screenshot('教程读底牌和当前牌型', testInfo);

        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="hand-rank-reference"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"]')).toBeVisible();
        await expect(page.getByText(/局中速查入口/u)).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"]')).not.toHaveAttribute('open', /.*/u);
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] li').first()).toBeHidden();
        await game.screenshot('教程牌型查询入口', testInfo);

        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="start-heist"]')).toBeVisible();
        await expect(page.getByText(/房主先点右下角的开始抢劫/u)).toBeVisible();
        await expect(page.getByRole('button', { name: '开始抢劫' })).toBeVisible();
        await page.getByRole('button', { name: '开始抢劫' }).click();

        await expect(page.locator('[data-tutorial-step="chip-choice"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-action-hint')).toBeVisible();
        await expect(page.getByRole('button', { name: '白筹码 1 星' })).toBeVisible();
        await page.getByRole('button', { name: '白筹码 1 星' }).click();

        await expect(page.locator('[data-tutorial-step="table-response"]')).toBeVisible();
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await expectCurrentRoundChips(page, 3);
        await expectTokenPileChipButtons(page, '白筹码', []);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await expect(page.getByText(/中间筹码池是默认来源/u)).toBeVisible();
        await expect(page.getByText(/队友面前本轮刚拿的白筹码也还是可拿对象/u)).toBeVisible();
        await game.screenshot('教程首轮全员拿白筹码', testInfo);

        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="take-player-chip"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-action-hint')).toBeVisible();
        await expect(page.getByText(/实际试一次/u)).toBeVisible();
        await expect(page.getByText(/点队友面前发亮的当前轮白筹码/u)).toBeVisible();
        await expect(page.getByText(/把它从队友那里拿走/u)).toBeVisible();
        await expectTutorialHighlightCoversVisibleTarget(page, 'the-gang-opponent-state');
        const chipsBeforeSteal = await getCurrentRoundChips(page);
        const stolenTargetEntry = Object.entries(chipsBeforeSteal)
            .find(([playerId]) => playerId !== '0');
        expect(stolenTargetEntry, `必须有可被拿走的 AI 当前轮筹码: ${JSON.stringify(chipsBeforeSteal)}`).toBeDefined();
        const [stolenPlayerId, stolenChip] = stolenTargetEntry!;

        await page.getByTestId(`the-gang-take-player-chip-${stolenPlayerId}`).click();
        await expect
            .poll(
                async () => (await getCurrentRoundChips(page))['0'],
                { message: '等待真人实际拿走队友当前轮筹码' },
            )
            .toBe(stolenChip);
        await expect
            .poll(
                async () => (await getCurrentRoundChips(page))[stolenPlayerId] !== undefined,
                { message: '等待被拿走筹码的 AI 重新补筹码' },
            )
            .toBe(true);
        await expectCurrentRoundChips(page, 3);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await game.screenshot('教程实际拿走队友当前轮筹码', testInfo);

        await expect(page.locator('[data-tutorial-step="advance-round"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-step="advance-round"]').getByText(/全员确认/u)).toBeVisible();
        await expectTutorialCardDoesNotCoverTarget(page, 'the-gang-next-round');
        await clickHumanProgressAndWaitForAi(page, '下一轮');

        await expect(page.locator('[data-tutorial-step="community-cards"]')).toBeVisible();
        await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 3);
        await expect(page.getByText(/公共牌出现后/u)).toBeVisible();
        await game.screenshot('教程推进后公共牌出现', testInfo);

        await nextTutorialStep(page);

        await expect(page.locator('[data-tutorial-step="yellow-chip"]')).toBeVisible();
        await page.getByRole('button', { name: '黄筹码 1 星' }).click();
        await expect(page.locator('[data-tutorial-step="yellow-response"]')).toBeVisible();
        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="turn-round"]')).toBeVisible();
        await expectCurrentRoundChips(page, 3);
        await expectTokenPileChipButtons(page, '黄筹码', []);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await expectTutorialCardDoesNotCoverTarget(page, 'the-gang-next-round');
        await clickHumanProgressAndWaitForAi(page, '下一轮');

        await expect(page.locator('[data-tutorial-step="turn-card"]')).toBeVisible();
        await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 4);
        await nextTutorialStep(page);

        await expect(page.locator('[data-tutorial-step="orange-chip"]')).toBeVisible();
        await page.getByRole('button', { name: '橙筹码 1 星' }).click();
        await expect(page.locator('[data-tutorial-step="orange-response"]')).toBeVisible();
        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="river-round"]')).toBeVisible();
        await expectCurrentRoundChips(page, 3);
        await expectTokenPileChipButtons(page, '橙筹码', []);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await expectTutorialCardDoesNotCoverTarget(page, 'the-gang-next-round');
        await clickHumanProgressAndWaitForAi(page, '下一轮');
        await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 5);
        await expect(page.locator('[data-tutorial-step="final-chip"]')).toBeVisible();
        await expect(page.getByText(/红筹码是最终承诺/u)).toBeVisible();
        await game.screenshot('教程红筹码最终承诺', testInfo);

        const finalChips = await computeFinalChipsForSuccessfulShowdown(page);
        await page.getByRole('button', { name: `红筹码 ${finalChips['0']} 星` }).click();
        await expect(page.locator('[data-tutorial-step="final-response"]')).toBeVisible();
        await nextTutorialStep(page);
        await expectCurrentRoundChips(page, 3);
        await expectTokenPileChipButtons(page, '红筹码', []);

        await expect(page.locator('[data-tutorial-step="reveal-showdown"]')).toBeVisible();
        await expect(page.getByRole('button', { name: '摊牌' })).toBeEnabled();
        await expectTutorialCardDoesNotCoverTarget(page, 'the-gang-reveal-showdown');
        await expect(page.locator('[data-bgg-zone="player-token"]')).toHaveCount(9);
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
        await expect(page.locator('[data-bgg-zone="hand-chips-previous"]')).toHaveCount(3);
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 5);
        await expectImagesLoaded(page, '[data-bgg-zone="player-token"] img', 9);
        await expectImagesLoaded(page, '[data-bgg-zone="player-current-token"] img', 3);
        await expectImagesLoaded(page, '[data-bgg-zone="hand-chips-previous"] img', 3);
        await expectImagesLoaded(page, '[data-bgg-zone="hand-current-chip"] img', 1);
        await game.screenshot('教程满元素待摊牌', testInfo);

        await expect(page.getByText(/摊牌也需要全员确认/u)).toBeVisible();
        await clickHumanProgressAndWaitForAi(page, '摊牌');
        await expect(page.locator('[data-tutorial-step="showdown"]')).toBeVisible();
        await expectTutorialHighlightCoversVisibleTarget(page, 'the-gang-showdown-result');
        await expect(page.getByLabel('摊牌结算')).toBeVisible();
        await expect(page.getByLabel('摊牌结算')).toHaveClass(/fixed/);
        await expect(page.getByLabel('摊牌结算')).toHaveClass(/inset-0/);
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-community-cards"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-hole-cards"]')).toBeVisible();
        await expectImagesLoaded(page, '[data-bgg-zone="reveal-community-cards"] img', 5);
        await expect(page.locator('[data-bgg-zone="reveal-pocket-cards"]')).toHaveCount(3);
        await expectImagesLoaded(page, '[data-bgg-zone="reveal-pocket-cards"] img', 6);
        await expect(page.getByText(/抢劫成功|抢劫失败/u)).toBeVisible();
        await expect(page.getByText(/保留已经公开的 5 张公共牌/u)).toBeVisible();
        await expect(page.getByText(/逐张揭示每位玩家/u)).toBeVisible();
        await expect(page.getByText(/向下滚动查看所有人的真实牌/u)).toBeVisible();
        await game.screenshot('教程摊牌结果反馈', testInfo);

        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="showdown-reading"]')).toBeVisible();
        await expectTutorialHighlightCoversVisibleTarget(page, 'the-gang-showdown-hole-cards');
        await expect(page.getByText(/读摊牌时先看公共牌/u)).toBeVisible();
        await expect(page.getByText(/向下滚动看每位玩家/u)).toBeVisible();
        await expect(page.getByText(/真实牌型越强/u)).toBeVisible();
        await game.screenshot('教程摊牌读法', testInfo);
    });
});
