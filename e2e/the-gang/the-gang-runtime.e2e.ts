import { expect, test } from '../framework/fixtures';
import type { Page } from '@playwright/test';

const THE_GANG_GAME_ID = 'the-gang';

async function selectHotseat(page: Page, seatName: string, scope: 'board' | 'showdown' = 'board') {
    const testId = scope === 'showdown'
        ? 'the-gang-showdown-hotseat-switcher'
        : 'the-gang-hotseat-switcher';
    const seatButton = page.getByTestId(testId).getByRole('button', { name: seatName });
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

async function confirmProgressForAllPlayers(page: Page, buttonName: string) {
    const hotseatScope = buttonName === '下一次抢劫' ? 'showdown' : 'board';
    await selectHotseat(page, '玩家 1', hotseatScope);
    await page.getByRole('button', { name: buttonName }).click();
    await expect(page.getByTestId('the-gang-progress-vote-dots').first().locator('[data-approved="true"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '等待确认', exact: true })).toBeDisabled();

    await selectHotseat(page, '玩家 2', hotseatScope);
    await page.getByRole('button', { name: buttonName }).click();
    await expect(page.getByTestId('the-gang-progress-vote-dots').first().locator('[data-approved="true"]')).toHaveCount(2);

    await selectHotseat(page, '玩家 3', hotseatScope);
    await page.getByRole('button', { name: buttonName }).click();
}

async function expectChipRound(page: Page, chipPrefix: string) {
    await expect(page.getByRole('button', { name: `${chipPrefix} 1 星` })).toBeVisible();
    await expect(page.getByRole('button', { name: `${chipPrefix} 2 星` })).toBeVisible();
    await expect(page.getByRole('button', { name: `${chipPrefix} 3 星` })).toBeVisible();
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

async function expectMiddleRoundFullState(page: Page) {
    await expect(page.locator('[data-bgg-zone="hand-chips-previous"]')).toHaveCount(3);
    await expect(page.locator('[data-bgg-zone="player-token"]')).toHaveCount(9);
    await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
    await expect(page.getByRole('button', { name: '红筹码 1 星' })).toBeVisible();
    await expect(page.getByRole('button', { name: '红筹码 2 星' })).toBeVisible();
    await expect(page.getByRole('button', { name: '红筹码 3 星' })).toBeVisible();
    await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 5);
    await expectImagesLoaded(page, '[data-bgg-zone="hand-chips-previous"] img', 3);
    await expectImagesLoaded(page, '[data-bgg-zone="player-token"] img', 9);
    await expectImagesLoaded(page, '[data-bgg-zone="player-current-token"] img', 3);
    await expectImagesLoaded(page, '[data-bgg-zone="hand-current-chip"] img', 1);
}

test.describe('The Gang 真实入口截图', () => {
    test('桌面端可通过真实 UI 完成一次四轮抢劫并显示摊牌结果', async ({ game, page }, testInfo) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await game.openTestGame(THE_GANG_GAME_ID, {
            players: 3,
            seed: 'the-gang-e2e-desktop',
            seat1: 'human',
        }, 30000);

        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible();
        await page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] summary').click();
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] li').filter({ hasText: '高牌' })).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] li').filter({ hasText: '皇家同花顺' })).toBeVisible();
        await game.screenshot('桌面牌型辅助表展开', testInfo);

        await expectChipRound(page, '白筹码');
        await expect(page.getByRole('button', { name: '下一轮' })).toBeDisabled();
        await game.screenshot('桌面首轮可操作状态', testInfo);

        await chooseAllPlayerChips(page, '白筹码');
        await selectHotseat(page, '玩家 1');
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
        await game.screenshot('桌面首轮全员筹码已选', testInfo);

        await confirmProgressForAllPlayers(page, '下一轮');
        await expectChipRound(page, '黄筹码');
        await chooseAllPlayerChips(page, '黄筹码');

        await confirmProgressForAllPlayers(page, '下一轮');
        await expectChipRound(page, '橙筹码');
        await chooseAllPlayerChips(page, '橙筹码');

        await confirmProgressForAllPlayers(page, '下一轮');
        await expectChipRound(page, '红筹码');

        await chooseChipForSeat(page, '玩家 1', '红筹码 2 星');
        await chooseChipForSeat(page, '玩家 2', '红筹码 1 星');
        await chooseChipForSeat(page, '玩家 3', '红筹码 3 星');
        await selectHotseat(page, '玩家 1');
        await expect(page.getByRole('button', { name: '摊牌' })).toBeEnabled();
        await expectMiddleRoundFullState(page);
        await game.screenshot('桌面中局满元素已拿新筹码待摊牌', testInfo);

        await confirmProgressForAllPlayers(page, '摊牌');

        await expect(page.getByLabel('摊牌结算')).toBeVisible();
        await expect(page.getByLabel('摊牌结算')).toHaveClass(/fixed/);
        await expect(page.getByLabel('摊牌结算')).toHaveClass(/inset-0/);
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-result"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-best-cards"]')).toBeVisible();
        await expect(page.locator('[data-bgg-zone="reveal-best-cards"]')).toHaveCount(3);
        await expectImagesLoaded(page, '[data-bgg-zone="reveal-best-cards"] img', 15);
        await expect(page.getByText('抢劫成功')).toBeVisible();
        await expect(page.getByText(/抢劫成功|抢劫失败/u)).toBeVisible();
        await expect(page.getByRole('button', { name: '下一次抢劫' })).toBeVisible();
        await game.screenshot('桌面摊牌结果', testInfo);

        await confirmProgressForAllPlayers(page, '下一次抢劫');
        await expect(page.getByText('抢劫 2')).toBeVisible();
        await expectChipRound(page, '白筹码');
    });
});
