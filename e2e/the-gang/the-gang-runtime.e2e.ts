import { expect, test } from '../framework/fixtures';
import type { Page } from '@playwright/test';

const THE_GANG_GAME_ID = 'the-gang';

async function chooseVisibleChip(page: Page, chipLabel: string) {
    await page.getByRole('button', { name: chipLabel }).click();
}

async function chooseRoundChipsByCommand(page: Page, chipsByPlayer: Record<string, number>) {
    for (const [playerId, chip] of Object.entries(chipsByPlayer)) {
        await dispatchTheGangCommand(page, playerId, 'TAKE_CHIP', { chip });
    }
}

async function chooseAllPlayerChips(page: Page, chipPrefix: string) {
    await chooseVisibleChip(page, `${chipPrefix} 1 星`);
    await chooseRoundChipsByCommand(page, { 1: 2, 2: 3 });
}

async function chooseChipsForSeats(page: Page, playerCount: number) {
    const chipsByPlayer = Object.fromEntries(
        Array.from({ length: playerCount }, (_, index) => [String(index), index + 1]),
    );
    await chooseRoundChipsByCommand(page, chipsByPlayer);
}

async function commandTypeForProgressButton(buttonName: string) {
    if (buttonName === '下一轮') {
        return 'END_ROUND';
    }
    if (buttonName === '摊牌') {
        return 'REVEAL_SHOWDOWN';
    }
    if (buttonName === '下一次抢劫') {
        return 'START_NEXT_HEIST';
    }
    throw new Error(`未支持的纸牌帮进度按钮：${buttonName}`);
}

async function confirmProgressForAllPlayers(page: Page, buttonName: string) {
    await confirmProgressForSeats(page, buttonName, 3);
}

async function confirmProgressForSeats(page: Page, buttonName: string, playerCount: number) {
    const commandType = await commandTypeForProgressButton(buttonName);
    await page.getByRole('button', { name: buttonName }).click();
    if (playerCount > 1) {
        await expect(page.getByTestId('the-gang-progress-vote-dots').first().locator('[data-approved="true"]')).toHaveCount(1);
        await expect(page.getByRole('button', { name: '等待确认', exact: true })).toBeDisabled();
    }
    for (let seatIndex = 1; seatIndex < playerCount; seatIndex += 1) {
        await dispatchTheGangCommand(page, String(seatIndex), commandType);
    }
}

async function expectChipRound(page: Page, chipPrefix: string) {
    await expect(page.getByRole('button', { name: `${chipPrefix} 1 星` })).toBeVisible();
    await expect(page.getByRole('button', { name: `${chipPrefix} 2 星` })).toBeVisible();
    await expect(page.getByRole('button', { name: `${chipPrefix} 3 星` })).toBeVisible();
}

async function expectChipRoundForPlayerCount(page: Page, chipPrefix: string, playerCount: number) {
    for (let chip = 1; chip <= playerCount; chip += 1) {
        await expect(page.getByRole('button', { name: `${chipPrefix} ${chip} 星` })).toBeVisible();
    }
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
            { message: `等待 ${selector} 的真实图片资源加载完成` },
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

async function expectMiddleRoundFullState(page: Page) {
    await expect(page.locator('[data-bgg-zone="hand-chips-previous"]')).toHaveCount(3);
    await expect(page.locator('[data-bgg-zone="player-token"]')).toHaveCount(9);
    await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
    await expectAvailableChipButtons(page, '红筹码', []);
    await expectImagesLoaded(page, '[data-bgg-zone="card-river"] img', 5);
    await expectImagesLoaded(page, '[data-bgg-zone="hand-chips-previous"] img', 3);
    await expectImagesLoaded(page, '[data-bgg-zone="player-token"] img', 9);
    await expectImagesLoaded(page, '[data-bgg-zone="player-current-token"] img', 3);
    await expectImagesLoaded(page, '[data-bgg-zone="hand-current-chip"] img', 1);
}

type TheGangHarnessState = {
    core?: {
        currentRoundChips?: Record<string, unknown>;
    };
};

type TheGangTestWindow = Window & {
    __BG_TEST_HARNESS__?: {
        command?: {
            dispatch?: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void>;
        };
        state?: {
            get?: () => TheGangHarnessState | null;
        };
    };
};

async function getTheGangState(page: Page) {
    return page.evaluate(() => {
        const harness = (window as TheGangTestWindow).__BG_TEST_HARNESS__;
        return harness?.state?.get?.();
    });
}

async function dispatchTheGangCommand(page: Page, playerId: string, type: string, payload: Record<string, unknown> = {}) {
    await page.evaluate(
        async ({ commandPlayerId, commandType, commandPayload }) => {
            const harness = (window as TheGangTestWindow).__BG_TEST_HARNESS__;
            if (!harness?.command?.dispatch) {
                throw new Error('The Gang 测试命令代理未注册');
            }
            await harness.command.dispatch({
                type: commandType,
                playerId: commandPlayerId,
                payload: commandPayload,
            });
        },
        { commandPlayerId: playerId, commandType: type, commandPayload: payload },
    );
}

async function expectCurrentRoundChips(page: Page, expectedCount: number) {
    await expect
        .poll(
            async () => {
                const state = await getTheGangState(page);
                return Object.keys(state?.core?.currentRoundChips ?? {}).length;
            },
            { message: `等待当前轮 ${expectedCount} 名玩家完成筹码选择` },
        )
        .toBe(expectedCount);
}

async function expectAvailableChipButtons(page: Page, chipPrefix: string, expectedValues: number[]) {
    const tokenPile = page.locator('[data-bgg-zone="token-pile"]');
    for (const value of [1, 2, 3, 4, 5, 6]) {
        const chipButton = tokenPile.getByRole('button', { name: `${chipPrefix} ${value} 星` });
        if (expectedValues.includes(value)) {
            await expect(chipButton).toBeVisible();
        } else {
            await expect(chipButton).toHaveCount(0);
        }
    }
}

async function openFabMenu(page: Page) {
    const fabMenu = page.getByTestId('fab-menu');
    await expect(fabMenu).toBeVisible();
    await expect(fabMenu).not.toHaveCSS('pointer-events', 'none');
    await fabMenu.locator('[data-fab-id]').first().click();
}

async function expectHudActionLogAndUndoAvailable(page: Page) {
    await openFabMenu(page);
    await expect(page.locator('[data-fab-id="action-log"]')).toBeVisible();
    await expect(page.locator('[data-fab-id="undo-request"]')).toBeVisible();

    await page.locator('[data-fab-id="action-log"]').click();
    await expect(page.getByTestId('hud-action-log-row').filter({ hasText: '选择 1★ 筹码' })).toBeVisible();

    await page.locator('[data-fab-id="undo-request"]').click();
    await expect(page.getByText('可以请求撤回上一步操作')).toBeVisible();
}

test.describe('The Gang 测试入口与代表态截图', () => {
    test('桌面端 6 人满人数布局可显示所有玩家席位', async ({ game, page }, testInfo) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await game.openTestGame(THE_GANG_GAME_ID, {
            players: 6,
            seed: 'the-gang-e2e-six-player',
            seat1: 'human',
            seat2: 'human',
            seat3: 'human',
            seat4: 'human',
            seat5: 'human',
            seat6: 'human',
        }, 30000);

        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible();
        await expect(page.getByTestId('the-gang-hotseat-switcher')).toHaveCount(0);
        await expect(page.locator('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveCount(5);
        await expectChipRoundForPlayerCount(page, '白筹码', 6);
        await expect(page.locator('[data-bgg-zone="card-river"]')).toHaveCount(1);
        await expect(page.locator('[data-bgg-zone="hand-groupzone"]')).toBeVisible();
        await expect(page.locator('[data-bgg-zone="hand-chips"]')).toHaveCount(1);
        await expect(page.locator('[data-bgg-zone="player-tokens"]')).toHaveCount(5);
        await game.screenshot('桌面6人满人数首轮可操作状态', testInfo);

        await chooseChipsForSeats(page, 6);
        await expectCurrentRoundChips(page, 6);
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(5);
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await expectImagesLoaded(page, '[data-bgg-zone="player-current-token"] img', 5);
        await expectImagesLoaded(page, '[data-bgg-zone="hand-current-chip"] img', 1);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await game.screenshot('桌面6人满人数全员筹码已选', testInfo);
    });

    test('桌面端 6 人摊牌结算可滚动并显示完整公共牌和底牌', async ({ game, page }, testInfo) => {
        test.setTimeout(180000);
        await page.setViewportSize({ width: 1366, height: 768 });
        await game.openTestGame(THE_GANG_GAME_ID, {
            players: 6,
            seed: 'the-gang-e2e-six-player-showdown',
            seat1: 'human',
            seat2: 'human',
            seat3: 'human',
            seat4: 'human',
            seat5: 'human',
            seat6: 'human',
        }, 30000);

        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible();
        await expectChipRoundForPlayerCount(page, '白筹码', 6);
        await chooseChipsForSeats(page, 6);

        await confirmProgressForSeats(page, '下一轮', 6);
        await expectChipRoundForPlayerCount(page, '黄筹码', 6);
        await chooseChipsForSeats(page, 6);

        await confirmProgressForSeats(page, '下一轮', 6);
        await expectChipRoundForPlayerCount(page, '橙筹码', 6);
        await chooseChipsForSeats(page, 6);

        await confirmProgressForSeats(page, '下一轮', 6);
        await expectChipRoundForPlayerCount(page, '红筹码', 6);
        await chooseChipsForSeats(page, 6);
        await expect(page.getByRole('button', { name: '摊牌' })).toBeEnabled();

        await confirmProgressForSeats(page, '摊牌', 6);

        const revealZone = page.getByLabel('摊牌结算');
        await expect(revealZone).toBeVisible();
        await game.screenshot('桌面6人摊牌底牌揭示过程帧-00-公共牌已公开', testInfo);
        await page.waitForTimeout(300);
        await game.screenshot('桌面6人摊牌底牌揭示过程帧-01-首批底牌揭示中', testInfo);
        await page.waitForTimeout(400);
        await game.screenshot('桌面6人摊牌底牌揭示过程帧-02-更多底牌揭示中', testInfo);
        await page.waitForTimeout(500);
        await game.screenshot('桌面6人摊牌底牌揭示过程帧-03-底牌揭示完成', testInfo);
        await expect(revealZone).toHaveClass(/fixed/);
        await expect(revealZone).toHaveClass(/inset-0/);
        await expect(revealZone).toHaveClass(/overflow-y-auto/);
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-result"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-community-cards"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-hole-cards"]')).toBeVisible();
        await expectImagesLoaded(page, '[data-bgg-zone="reveal-community-cards"] img', 5);
        await expect(page.locator('[data-bgg-zone="reveal-pocket-cards"]')).toHaveCount(6);
        await expectImagesLoaded(page, '[data-bgg-zone="reveal-pocket-cards"] img', 12);
        await expect(page.locator('[data-bgg-zone="reveal-community-cards"] [data-bgg-zone="reveal-card"]')).toHaveCount(0);
        await expect(page.locator('[data-bgg-zone="reveal-pocket-cards"] [data-bgg-zone="reveal-card"]')).toHaveCount(12);
        const revealAnimationContract = await page.locator('[data-bgg-zone="reveal-card"]').evaluateAll((nodes) => nodes.map((node) => {
            const element = node as HTMLElement;
            return {
                order: element.dataset.revealOrder,
                animationDelay: element.style.animationDelay,
                hasRevealAnimation: element.className.includes('the-gang-card-reveal'),
            };
        }));
        expect(revealAnimationContract).toEqual([
            { order: '0', animationDelay: '0ms', hasRevealAnimation: true },
            { order: '1', animationDelay: '90ms', hasRevealAnimation: true },
            { order: '2', animationDelay: '180ms', hasRevealAnimation: true },
            { order: '3', animationDelay: '270ms', hasRevealAnimation: true },
            { order: '4', animationDelay: '360ms', hasRevealAnimation: true },
            { order: '5', animationDelay: '450ms', hasRevealAnimation: true },
            { order: '6', animationDelay: '540ms', hasRevealAnimation: true },
            { order: '7', animationDelay: '630ms', hasRevealAnimation: true },
            { order: '8', animationDelay: '720ms', hasRevealAnimation: true },
            { order: '9', animationDelay: '810ms', hasRevealAnimation: true },
            { order: '10', animationDelay: '900ms', hasRevealAnimation: true },
            { order: '11', animationDelay: '990ms', hasRevealAnimation: true },
        ]);
        await expect(page.locator('[data-bgg-zone="top-zone"]').getByAltText('2♣')).toHaveCount(0);
        await expect(page.locator('[data-bgg-zone="top-zone"]').getByAltText('6♣')).toHaveCount(0);

        const revealMetrics = await page.locator('[data-bgg-zone="reveal-zone"]').evaluate((node) => {
            const element = node as HTMLElement;
            return {
                clientHeight: element.clientHeight,
                scrollTop: element.scrollTop,
                scrollHeight: element.scrollHeight,
            };
        });
        expect(revealMetrics.scrollTop).toBe(0);
        expect(revealMetrics.scrollHeight).toBeGreaterThan(revealMetrics.clientHeight);
        expect(revealMetrics.clientHeight).toBe(768);
        const handCoverTarget = await page.locator('[data-bgg-zone="hand-groupzone"]').evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const topElement = document.elementFromPoint(x, y);
            return {
                point: { x, y },
                isInsideReveal: !!topElement?.closest('[data-bgg-zone="reveal-zone"]'),
                topZone: topElement?.closest('[data-bgg-zone]')?.getAttribute('data-bgg-zone') ?? null,
                topTestId: topElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
            };
        });
        expect(handCoverTarget.isInsideReveal).toBe(true);
        expect(handCoverTarget.topZone).not.toBe('hand-groupzone');
        await page.locator('[data-bgg-zone="reveal-zone"]').evaluate((node) => {
            const element = node as HTMLElement;
            element.scrollTo({ top: element.scrollHeight, behavior: 'instant' });
        });
        const scrolledRevealMetrics = await page.locator('[data-bgg-zone="reveal-zone"]').evaluate((node) => {
            const element = node as HTMLElement;
            return {
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
                scrollTop: element.scrollTop,
            };
        });
        expect(scrolledRevealMetrics.scrollTop).toBeGreaterThan(0);
        await expect(page.getByRole('button', { name: '下一次抢劫' })).toBeInViewport();
        await game.screenshot('桌面6人摊牌结算完整公共牌和底牌', testInfo);
    });

    test('移动横屏可操作并保留行为日志和撤回入口', async ({ game, page }, testInfo) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 812, height: 375 });
        await game.openTestGame(THE_GANG_GAME_ID, {
            players: 3,
            seed: 'the-gang-e2e-mobile-landscape',
            seat1: 'human',
        }, 30000);

        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible();
        await expect(page.locator('html[data-game-page="true"][data-game-id="the-gang"]')).toHaveAttribute('data-mobile-layout-preset', 'board-shell');
        await expectChipRound(page, '白筹码');
        await dispatchTheGangCommand(page, '0', 'TAKE_CHIP', { chip: 1 });
        await dispatchTheGangCommand(page, '1', 'TAKE_CHIP', { chip: 2 });
        await dispatchTheGangCommand(page, '2', 'TAKE_CHIP', { chip: 3 });
        await expectCurrentRoundChips(page, 3);
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await expectImagesLoaded(page, '[data-bgg-zone="player-current-token"] img', 3);
        await expectImagesLoaded(page, '[data-bgg-zone="hand-current-chip"] img', 1);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await expect(page.getByTestId('the-gang-progress-vote-dots')).toBeVisible();
        await expectHudActionLogAndUndoAvailable(page);
        await game.screenshot('移动横屏首轮全员筹码已选且HUD可用', testInfo);
    });

    test('移动竖屏在横屏优先合同下仍保留关键牌桌区域', async ({ game, page }, testInfo) => {
        test.setTimeout(90000);
        await page.setViewportSize({ width: 390, height: 844 });
        await game.openTestGame(THE_GANG_GAME_ID, {
            players: 3,
            seed: 'the-gang-e2e-mobile-portrait',
            seat1: 'local-ai',
            seat2: 'local-ai',
        }, 30000);

        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible();
        await expect(page.locator('html[data-game-page="true"][data-game-id="the-gang"]')).toHaveAttribute('data-mobile-profile', 'landscape-adapted');
        await expect(page.locator('html[data-game-page="true"][data-game-id="the-gang"]')).toHaveAttribute('data-preferred-orientation', 'landscape');
        await expect(page.locator('html[data-game-page="true"][data-game-id="the-gang"]')).toHaveAttribute('data-mobile-layout-preset', 'board-shell');
        await expect(page.locator('[data-bgg-zone="hand-groupzone"]')).toBeVisible();
        await expect(page.locator('[data-bgg-zone="token-pile"]')).toBeInViewport();
        await expect(page.locator('[data-bgg-zone="hand-cards"]')).toBeInViewport();
        await expect(page.locator('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveCount(3);
        await expect(page.locator('[data-bgg-zone="top-zone"]')).toContainText('玩家 1');
        await expect(page.locator('[data-bgg-zone="top-zone"]')).toContainText('AI 2 号位');
        await expect(page.locator('[data-bgg-zone="top-zone"]')).toContainText('AI 3 号位');
        await expect(page.locator('[data-bgg-zone="top-zone"] [data-bgg-zone="opponent-cards"] img')).toHaveCount(0);
        await expect(page.locator('[data-bgg-zone="player-tokens"]')).toHaveCount(3);
        await expect(page.getByTestId('the-gang-hotseat-switcher')).not.toBeVisible();
        await expect(page.getByTestId('the-gang-showdown-hotseat-switcher')).toHaveCount(0);
        await expect(page.locator('[data-bgg-zone="top-zone"]')).toContainText('玩家 1');
        await expect(page.locator('[data-bgg-zone="hand-groupzone"]')).not.toContainText('玩家 1');

        await game.screenshot('移动竖屏横屏优先下仍保留关键牌桌区域', testInfo);
    });

    test('桌面端当前玩家使用可见 UI、其它座位用代表态完成四轮抢劫并显示摊牌结果', async ({ game, page }, testInfo) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await game.openTestGame(THE_GANG_GAME_ID, {
            players: 3,
            seed: 'the-gang-e2e-desktop',
            seat1: 'human',
            seat2: 'human',
            seat3: 'human',
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
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await game.screenshot('桌面首轮全员筹码已选', testInfo);

        await confirmProgressForAllPlayers(page, '下一轮');
        await expectChipRound(page, '黄筹码');
        await chooseAllPlayerChips(page, '黄筹码');

        await confirmProgressForAllPlayers(page, '下一轮');
        await expectChipRound(page, '橙筹码');
        await chooseAllPlayerChips(page, '橙筹码');

        await confirmProgressForAllPlayers(page, '下一轮');
        await expectChipRound(page, '红筹码');

        await chooseVisibleChip(page, '红筹码 2 星');
        await chooseRoundChipsByCommand(page, { 1: 1, 2: 3 });
        await expect(page.getByRole('button', { name: '摊牌' })).toBeEnabled();
        await expectMiddleRoundFullState(page);
        await game.screenshot('桌面中局满元素已拿新筹码待摊牌', testInfo);

        await confirmProgressForAllPlayers(page, '摊牌');

        await expect(page.getByLabel('摊牌结算')).toBeVisible();
        await expect(page.getByLabel('摊牌结算')).toHaveClass(/fixed/);
        await expect(page.getByLabel('摊牌结算')).toHaveClass(/inset-0/);
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-result"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-community-cards"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-showdown-hole-cards"]')).toBeVisible();
        await expectImagesLoaded(page, '[data-bgg-zone="reveal-community-cards"] img', 5);
        await expect(page.locator('[data-bgg-zone="reveal-pocket-cards"]')).toHaveCount(3);
        await expectImagesLoaded(page, '[data-bgg-zone="reveal-pocket-cards"] img', 6);
        await expect(page.getByText('抢劫成功')).toBeVisible();
        await expect(page.getByText(/抢劫成功|抢劫失败/u)).toBeVisible();
        await expect(page.getByRole('button', { name: '下一次抢劫' })).toBeVisible();
        await game.screenshot('桌面摊牌结果', testInfo);

        await confirmProgressForAllPlayers(page, '下一次抢劫');
        await expect(page.getByText('抢劫 2')).toBeVisible();
        await expectChipRound(page, '白筹码');
    });

    test('直接本地开局默认 AI 座位可自动选筹码并确认进入下一轮', async ({ game, page }) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await game.openTestGame(THE_GANG_GAME_ID, {
            players: 3,
            seed: 'the-gang-default-local-ai-e2e',
        }, 30000);

        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible();
        await expectChipRound(page, '白筹码');
        await expectAvailableChipButtons(page, '白筹码', [1, 2, 3]);

        await page.getByRole('button', { name: '白筹码 1 星' }).click();
        await expectCurrentRoundChips(page, 3);
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(2);
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await expectAvailableChipButtons(page, '白筹码', []);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();

        await page.getByRole('button', { name: '下一轮' }).click();
        await expectChipRound(page, '黄筹码');
    });
});
