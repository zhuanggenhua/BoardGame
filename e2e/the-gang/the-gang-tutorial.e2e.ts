import type { Page } from '@playwright/test';
import { expect, test } from '../framework/fixtures';
import { setChineseLocale } from '../helpers/common';

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

async function selectHotseat(page: Page, seatName: string) {
    const seatButton = page
        .getByTestId('the-gang-hotseat-switcher')
        .getByRole('button', { name: seatName });
    await seatButton.click({ force: true });
    await expect(seatButton).toHaveAttribute('aria-pressed', 'true');
}

async function chooseChipForSeat(page: Page, seatName: string, chipLabel: string) {
    await selectHotseat(page, seatName);
    await page.getByRole('button', { name: chipLabel }).click();
}

async function chooseAllPlayerChips(page: Page, chipPrefix: string) {
    await chooseChipForSeat(page, '玩家 1', `${chipPrefix} 1 星`);
    await chooseChipForSeat(page, '玩家 2', `${chipPrefix} 2 星`);
    await chooseChipForSeat(page, '玩家 3', `${chipPrefix} 3 星`);
}

async function expectImagesLoaded(page: Page, selector: string, expectedCount: number) {
    const images = page.locator(selector);
    await expect(images).toHaveCount(expectedCount);
    await expect
        .poll(
            async () =>
                images.evaluateAll((nodes) =>
                    nodes.map((node) => {
                        const image = node as HTMLImageElement;
                        return {
                            alt: image.alt,
                            complete: image.complete,
                            naturalHeight: image.naturalHeight,
                            naturalWidth: image.naturalWidth,
                            src: image.currentSrc || image.src,
                        };
                    }),
                ),
            { message: `等待 ${selector} 的真实图片资源加载完成` },
        )
        .toEqual(
            expect.arrayContaining(
                Array.from({ length: expectedCount }, () =>
                    expect.objectContaining({
                        complete: true,
                        naturalHeight: expect.any(Number),
                        naturalWidth: expect.any(Number),
                        src: expect.any(String),
                    }),
                ),
            ),
        );

    const failedImages = await images.evaluateAll((nodes) =>
        nodes
            .map((node) => {
                const image = node as HTMLImageElement;
                return {
                    alt: image.alt,
                    naturalHeight: image.naturalHeight,
                    naturalWidth: image.naturalWidth,
                    src: image.currentSrc || image.src,
                };
            })
            .filter((image) => image.naturalWidth <= 1 || image.naturalHeight <= 1),
    );
    expect(failedImages, `${selector} 存在未真实加载的图片`).toEqual([]);
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
        await expect(page.locator('[data-tutorial-step="chip-choice"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-action-hint')).toBeVisible();
        await expect(page.getByRole('button', { name: '白筹码 1 星' })).toBeVisible();
        await page.getByRole('button', { name: '白筹码 1 星' }).click();

        await expect(page.locator('[data-tutorial-step="table-response"]')).toBeVisible();
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await chooseChipForSeat(page, '玩家 2', '白筹码 2 星');
        await chooseChipForSeat(page, '玩家 3', '白筹码 3 星');
        await selectHotseat(page, '玩家 1');
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await game.screenshot('教程首轮全员拿白筹码', testInfo);

        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="advance-round"]')).toBeVisible();
        await page.getByRole('button', { name: '下一轮' }).click();

        await expect(page.locator('[data-tutorial-step="community-cards"]')).toBeVisible();
        await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 3);
        await expect(page.getByText(/公共牌出现后/u)).toBeVisible();
        await game.screenshot('教程推进后公共牌出现', testInfo);

        await nextTutorialStep(page);

        await expect(page.locator('[data-tutorial-step="yellow-chip"]')).toBeVisible();
        await chooseAllPlayerChips(page, '黄筹码');
        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="turn-round"]')).toBeVisible();
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await page.getByRole('button', { name: '下一轮' }).click();

        await expect(page.locator('[data-tutorial-step="turn-card"]')).toBeVisible();
        await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 4);
        await nextTutorialStep(page);

        await expect(page.locator('[data-tutorial-step="orange-chip"]')).toBeVisible();
        await chooseAllPlayerChips(page, '橙筹码');
        await nextTutorialStep(page);
        await expect(page.locator('[data-tutorial-step="river-round"]')).toBeVisible();
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await page.getByRole('button', { name: '下一轮' }).click();
        await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 5);
        await expect(page.locator('[data-tutorial-step="final-chip"]')).toBeVisible();
        await expect(page.getByText(/红筹码是最终承诺/u)).toBeVisible();
        await game.screenshot('教程红筹码最终承诺', testInfo);

        await chooseChipForSeat(page, '玩家 1', '红筹码 1 星');
        await chooseChipForSeat(page, '玩家 2', '红筹码 2 星');
        await chooseChipForSeat(page, '玩家 3', '红筹码 3 星');
        await selectHotseat(page, '玩家 1');
        await nextTutorialStep(page);

        await expect(page.locator('[data-tutorial-step="reveal-showdown"]')).toBeVisible();
        await expect(page.getByRole('button', { name: '摊牌' })).toBeEnabled();
        await expect(page.locator('[data-bgg-zone="player-token"]')).toHaveCount(9);
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
        await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 5);
        await expectImagesLoaded(page, '[data-bgg-zone="player-token"] img', 9);
        await expectImagesLoaded(page, '[data-bgg-zone="player-current-token"] img', 3);
        await expectImagesLoaded(page, '[data-bgg-zone="hand-current-chip"] img', 1);
        await game.screenshot('教程满元素待摊牌', testInfo);

        await page.getByRole('button', { name: '摊牌' }).click();
        await expect(page.locator('[data-tutorial-step="showdown"]')).toBeVisible();
        await expect(page.getByLabel('摊牌结算')).toBeVisible();
        await expect(page.getByText(/抢劫成功|抢劫失败/u)).toBeVisible();
        await expect(page.getByText(/摊牌结果会显示/u)).toBeVisible();
        await game.screenshot('教程摊牌结果反馈', testInfo);
    });
});
