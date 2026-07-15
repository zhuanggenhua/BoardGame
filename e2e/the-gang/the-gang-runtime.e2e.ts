import { expect, test } from '../framework/fixtures';
import type { Locator, Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const THE_GANG_GAME_ID = 'the-gang';
const THE_GANG_IMAGE_LOAD_TIMEOUT_MS = 15_000;

async function chooseVisibleChip(page: Page, chipLabel: string) {
    await page.getByRole('button', { name: chipLabel }).click();
}

async function ensureHeistStartedByCommand(page: Page) {
    const state = await getTheGangState(page);
    if (state?.core?.heistStarted) {
        return;
    }
    await dispatchTheGangCommand(page, '0', 'START_HEIST');
}

async function startHeistFromSetup(page: Page) {
    await expect(page.getByRole('button', { name: '开始抢劫' })).toBeVisible();
    await page.getByRole('button', { name: '开始抢劫' }).click();
    await expect(page.getByTestId('the-gang-start-heist')).toHaveCount(0);
}

async function clickControlCenter(page: Page, locator: Locator, label: string) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error(`无法定位控件中心点：${label}`);
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function chooseRoundChipsByCommand(page: Page, chipsByPlayer: Record<string, number>) {
    await ensureHeistStartedByCommand(page);
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
        heistStarted?: boolean;
        currentRoundChips?: Record<string, unknown>;
        communityCards?: unknown[];
        rules?: {
            config?: {
                gameMode?: string;
                exitChipMode?: string;
                omaha?: boolean;
                twoHand?: boolean;
                automode?: boolean;
                antiTroll?: boolean;
                challenges?: Record<string, number>;
            };
        };
        players?: Record<string, {
            pocketCards?: unknown[];
            communityCards?: unknown[];
            toolCards?: string[];
            specialistCards?: string[];
            activeTools?: string[];
            flashlightCards?: unknown[];
            nightVisionCards?: unknown[];
        }>;
        toolDeck?: string[];
        specialistDeck?: string[];
        toolDiscardPile?: string[];
    };
};

type TheGangTestWindow = Window & {
    __BG_TEST_HARNESS__?: {
        command?: {
            dispatch?: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void>;
        };
        state?: {
            get?: () => TheGangHarnessState | null;
            set?: (state: TheGangHarnessState) => Promise<void> | void;
        };
    };
};

async function getTheGangState(page: Page) {
    return page.evaluate(() => {
        const harness = (window as TheGangTestWindow).__BG_TEST_HARNESS__;
        return harness?.state?.get?.();
    });
}

async function prepareNightVisionToolState(page: Page) {
    await page.evaluate(async () => {
        const harness = (window as TheGangTestWindow).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!state?.core || !harness?.state?.set) {
            throw new Error('The Gang 测试状态注入代理未注册');
        }
        const localPlayer = state.core.players?.['0'];
        if (!localPlayer) {
            throw new Error('The Gang 本地玩家状态缺失');
        }
        await harness.state.set({
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...localPlayer,
                        toolCards: ['night-vision-goggles'],
                        activeTools: [],
                        flashlightCards: [],
                        nightVisionCards: [],
                    },
                },
                toolDeck: (state.core.toolDeck ?? []).filter((tool) => tool !== 'night-vision-goggles'),
                toolDiscardPile: [],
            },
        });
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

async function expectUtilityDockLayout(
    page: Page,
    expectedDirection: 'row' | 'column',
    options: { maxControlWidth?: number; maxControlHeight?: number } = {},
) {
    const dock = page.getByTestId('the-gang-utility-dock');
    const handRankButton = dock.locator('[data-tutorial-id="the-gang-hand-rank-reference"] summary');
    const rulesButton = dock.getByTestId('the-gang-rules-config').getByRole('button', { name: '扩展' });
    const toolsButton = dock.getByTestId('the-gang-tools-panel').getByRole('button', { name: /工具/u });

    await expect(dock).toBeVisible();
    await expect(dock).toHaveCSS('flex-direction', expectedDirection);
    for (const button of [handRankButton, rulesButton, toolsButton]) {
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box, '左下角辅助入口必须有可测量的真实尺寸').not.toBeNull();
        expect(box!.height, '左下角辅助入口点击高度不得小于 44px').toBeGreaterThanOrEqual(44);
        expect(box!.width, '左下角辅助入口点击宽度不得小于 44px').toBeGreaterThanOrEqual(44);
        if (options.maxControlHeight !== undefined) {
            expect(box!.height, '移动端左下角辅助入口只能压缩 PC 样式，不得维持桌面大按钮高度').toBeLessThanOrEqual(options.maxControlHeight);
        }
        if (options.maxControlWidth !== undefined) {
            expect(box!.width, '移动端左下角辅助入口只能压缩 PC 样式，不得维持桌面大按钮宽度').toBeLessThanOrEqual(options.maxControlWidth);
        }
    }

    const overlap = await page.evaluate(() => {
        const dockRect = document.querySelector('[data-testid="the-gang-utility-dock"]')?.getBoundingClientRect();
        const handRect = document.querySelector('[data-bgg-zone="hand-groupzone"]')?.getBoundingClientRect();
        if (!dockRect || !handRect) return null;
        return {
            dockLeft: dockRect.left,
            dockBottom: dockRect.bottom,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            intersectsHand: dockRect.left < handRect.right
                && dockRect.right > handRect.left
                && dockRect.top < handRect.bottom
                && dockRect.bottom > handRect.top,
        };
    });
    expect(overlap, '辅助栏和手牌区必须同时存在').not.toBeNull();
    expect(overlap!.dockLeft, '辅助栏必须贴近视口左侧安全区').toBeLessThanOrEqual(20);
    expect(overlap!.dockBottom, '辅助栏必须贴近视口底部安全区').toBeGreaterThanOrEqual(overlap!.viewportHeight - 24);
    expect(overlap!.intersectsHand, '辅助栏不得覆盖手牌区').toBe(false);
}

async function expectToolsPanelUsesPcTwoColumnLayout(page: Page) {
    const toolsPanel = page.getByTestId('the-gang-tools-panel');
    await toolsPanel.getByRole('button', { name: /工具/u }).click();
    const toolsModal = page.getByTestId('the-gang-tools-modal');
    await expect(toolsModal).toBeVisible();

    const metrics = await toolsModal.evaluate((modal) => {
        const grid = modal.querySelector('.grid');
        const sections = Array.from(grid?.querySelectorAll('section') ?? []).map((section) => {
            const rect = section.getBoundingClientRect();
            return {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            };
        });
        return {
            gridTemplateColumns: grid ? getComputedStyle(grid).gridTemplateColumns : '',
            sections,
        };
    });

    expect(metrics.sections.length, '工具面板必须保留工具牌和专家牌两个 PC 同源区块').toBeGreaterThanOrEqual(2);
    expect(metrics.gridTemplateColumns.trim().split(/\s+/u).length, '工具面板在手机横屏不得退回单列移动版').toBeGreaterThanOrEqual(2);
    expect(Math.abs(metrics.sections[0]!.top - metrics.sections[1]!.top), '工具牌和专家牌区块必须同一行排列，保持 PC 同源双栏').toBeLessThanOrEqual(4);
    expect(metrics.sections[0]!.width, '工具牌区块宽度必须是双栏面板，不得压成单列窄块').toBeGreaterThan(240);
    expect(metrics.sections[1]!.width, '专家牌区块宽度必须是双栏面板，不得压成单列窄块').toBeGreaterThan(240);

    await toolsModal.getByRole('button', { name: '关闭工具与专家牌' }).click();
    await expect(toolsModal).toHaveCount(0);
}

async function writeMiddleLayoutMetrics(label: string, metrics: unknown) {
    const safeLabel = Array.from(label)
        .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '-' : char))
        .join('')
        .slice(0, 90);
    const path = join(process.cwd(), 'test-results', 'evidence-screenshots', 'the-gang', 'geometry', `${safeLabel}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(metrics, null, 2), 'utf8');
    return path;
}

async function expectMiddleCenterVerticallyCentered(page: Page, label: string) {
    const metrics = await page.evaluate(() => {
        const readRect = (selector: string) => {
            const node = document.querySelector(selector);
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height,
            };
        };
        const topZone = readRect('[data-bgg-zone="top-zone"]');
        const handZone = readRect('[data-bgg-zone="hand-groupzone"]');
        const middleCenter = readRect('[data-bgg-zone="middle-center"]');
        const tokenPile = readRect('[data-bgg-zone="token-pile"]');
        const cardRiver = readRect('[data-bgg-zone="card-river"]');
        if (!topZone || !handZone || !middleCenter || !tokenPile || !cardRiver) return null;
        const availableTop = topZone.bottom;
        const availableBottom = handZone.top;
        const contentTop = Math.min(tokenPile.top, cardRiver.top);
        const contentBottom = Math.max(tokenPile.bottom, cardRiver.bottom);
        const targetCenter = (availableTop + availableBottom) / 2;
        const contentCenter = (contentTop + contentBottom) / 2;
        const tokenCenter = (tokenPile.top + tokenPile.bottom) / 2;
        const riverCenter = (cardRiver.top + cardRiver.bottom) / 2;
        const tokenRiverGap = cardRiver.top - tokenPile.bottom;
        const cardCount = document.querySelectorAll('[data-bgg-zone="card-river"] img').length;
        return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            topZone,
            handZone,
            middleCenter,
            tokenPile,
            cardRiver,
            cardCount,
            availableHeight: availableBottom - availableTop,
            availableTop,
            availableBottom,
            targetCenter,
            contentTop,
            contentBottom,
            contentCenter,
            contentCenterDelta: contentCenter - targetCenter,
            tokenCenter,
            riverCenter,
            tokenCenterDelta: tokenCenter - targetCenter,
            riverCenterDelta: riverCenter - targetCenter,
            tokenRiverGap,
            tokenAboveRiver: tokenPile.bottom <= cardRiver.top + 1,
        };
    });
    expect(metrics, `${label}：中央区、玩家区和手牌区必须同时存在`).not.toBeNull();
    const metricsPath = await writeMiddleLayoutMetrics(label, metrics);
    const metricsDetail = JSON.stringify(metrics);
    const minAvailableHeight = metrics!.viewportHeight < 500 ? 70 : 160;
    expect(metrics!.availableHeight, `${label}：玩家区和手牌区之间必须有足够中央牌桌空间；几何数据 ${metricsPath} ${metricsDetail}`).toBeGreaterThan(minAvailableHeight);
    expect(metrics!.contentTop, `${label}：中央排不得侵入上方玩家区；几何数据 ${metricsPath} ${metricsDetail}`).toBeGreaterThanOrEqual(metrics!.availableTop - 4);
    expect(metrics!.contentBottom, `${label}：中央排不得侵入下方手牌区；几何数据 ${metricsPath} ${metricsDetail}`).toBeLessThanOrEqual(metrics!.availableBottom + 4);
    const allowedDelta = Math.max(36, metrics!.availableHeight * 0.12);
    expect(Math.abs(metrics!.contentCenterDelta), `${label}：中央排应围绕玩家区与手牌区之间的可视中线垂直居中；几何数据 ${metricsPath} ${metricsDetail}`).toBeLessThanOrEqual(allowedDelta);

    if (metrics!.cardCount > 0 && metrics!.cardRiver.height > 4 && metrics!.tokenPile.height > 4) {
        const minStackGap = metrics!.viewportHeight < 500 ? 8 : 12;
        const maxStackGap = Math.min(88, Math.max(32, metrics!.availableHeight * (metrics!.viewportHeight < 500 ? 0.22 : 0.28)));
        const maxSingleRowDelta = Math.max(56, metrics!.availableHeight * 0.34);
        const balanceRatio = Math.abs(metrics!.tokenCenterDelta) / Math.max(1, Math.abs(metrics!.riverCenterDelta));
        expect(metrics!.tokenAboveRiver, `${label}：筹码排必须稳定在公共牌排上方，不能两排重叠或反序；几何数据 ${metricsPath} ${metricsDetail}`).toBe(true);
        expect(metrics!.tokenRiverGap, `${label}：筹码排和公共牌排之间必须有清晰但不过大的垂直间距；几何数据 ${metricsPath} ${metricsDetail}`).toBeGreaterThanOrEqual(minStackGap);
        expect(metrics!.tokenRiverGap, `${label}：筹码排和公共牌排之间不能被拉成两个互不相关的区域；几何数据 ${metricsPath} ${metricsDetail}`).toBeLessThanOrEqual(maxStackGap);
        expect(metrics!.tokenCenterDelta, `${label}：有公共牌时不能只让筹码排自己居中，筹码排应位于可视中线上方；几何数据 ${metricsPath} ${metricsDetail}`).toBeLessThanOrEqual(-minStackGap * 0.4);
        expect(metrics!.riverCenterDelta, `${label}：有公共牌时不能只让公共牌排自己居中，公共牌排应位于可视中线下方；几何数据 ${metricsPath} ${metricsDetail}`).toBeGreaterThanOrEqual(minStackGap * 0.4);
        expect(Math.abs(metrics!.tokenCenterDelta), `${label}：筹码排不能被挤到上方玩家区附近；几何数据 ${metricsPath} ${metricsDetail}`).toBeLessThanOrEqual(maxSingleRowDelta);
        expect(Math.abs(metrics!.riverCenterDelta), `${label}：公共牌排不能被吸到手牌区附近；几何数据 ${metricsPath} ${metricsDetail}`).toBeLessThanOrEqual(maxSingleRowDelta);
        expect(balanceRatio, `${label}：筹码排和公共牌排必须共同围绕同一中线构成一个中区组合，不能只验一个合并盒子；几何数据 ${metricsPath} ${metricsDetail}`).toBeGreaterThanOrEqual(0.35);
        expect(balanceRatio, `${label}：筹码排和公共牌排必须共同围绕同一中线构成一个中区组合，不能只验一个合并盒子；几何数据 ${metricsPath} ${metricsDetail}`).toBeLessThanOrEqual(2.85);
    }
}

test.describe('The Gang 测试入口与代表态截图', () => {
    test('桌面端扩展选择和工具牌发放通过真实入口生效', async ({ game, page }, testInfo) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1366, height: 768 });
        await game.openTestGame(THE_GANG_GAME_ID, {
            players: 3,
            seed: 'the-gang-expansion-tools-e2e',
            seat1: 'human',
            seat2: 'human',
            seat3: 'human',
        }, 30000);

        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible();
        await expectUtilityDockLayout(page, 'row');
        await expectMiddleCenterVerticallyCentered(page, '桌面1366工具入口关闭态中央排');
        const rulesPanel = page.getByTestId('the-gang-rules-config');
        await expect(rulesPanel).toBeVisible();
        await rulesPanel.getByRole('button', { name: '扩展' }).click();
        await expect(page.getByTestId('the-gang-rules-modal')).toBeVisible();
        await page.getByTestId('the-gang-mode-seven-card-stud').click();
        await expect(page.getByTestId('the-gang-mode-seven-card-stud')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('the-gang-mode-seven-card-stud')).toHaveAttribute('data-state', 'selected');
        await expect(page.getByTestId('the-gang-mode-seven-card-stud')).toContainText('已选择');
        await expect(page.getByTestId('the-gang-rule-toggle-omaha')).toBeVisible();
        await expect(page.getByTestId('the-gang-rule-toggle-twoHand')).toBeVisible();
        await expect(page.getByTestId('the-gang-rule-toggle-automode')).toBeVisible();
        await expect(page.getByTestId('the-gang-rule-toggle-antiTroll')).toBeVisible();
        await expect(page.getByTestId('the-gang-exit-mode-mastermind')).toBeVisible();
        await page.getByTestId('the-gang-rule-toggle-omaha').click();
        await page.getByTestId('the-gang-exit-mode-mastermind').click();
        await expect(page.getByTestId('the-gang-rule-toggle-omaha')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('the-gang-exit-mode-mastermind')).toHaveAttribute('aria-pressed', 'true');
        const quickAccessCard = page.getByRole('img', { name: '快速通道' });
        await expect(quickAccessCard).toHaveAttribute('data-debug-current-src', /\/assets\/i18n\/zh-CN\/the-gang\/rule-assets\/challenges\/compressed\/quick-access\.webp/);
        const quickAccessChallenge = page.getByTestId('the-gang-challenge-quick-access');
        await expect(quickAccessChallenge).toHaveAttribute('aria-pressed', 'false');
        await quickAccessChallenge.click();
        await expect(quickAccessChallenge).toHaveAttribute('aria-pressed', 'true');
        await expect(quickAccessChallenge).toHaveAttribute('data-state', 'selected');
        await expect(quickAccessChallenge).toContainText('已启用');
        await game.screenshot('桌面正式规则设置弹窗已覆盖TTS开局配置', testInfo);
        await page.getByRole('button', { name: '确认设置' }).click();
        await expect
            .poll(async () => {
                const state = await getTheGangState(page);
                return {
                    gameMode: state?.core?.rules?.config?.gameMode,
                    exitChipMode: state?.core?.rules?.config?.exitChipMode,
                    omaha: state?.core?.rules?.config?.omaha,
                    twoHand: state?.core?.rules?.config?.twoHand,
                    automode: state?.core?.rules?.config?.automode,
                    antiTroll: state?.core?.rules?.config?.antiTroll,
                    quickAccess: state?.core?.rules?.config?.challenges?.['quick-access'] ?? 0,
                    handCards: state?.core?.players?.['0']?.pocketCards?.length,
                    personalCommunityCards: state?.core?.players?.['0']?.communityCards?.length,
                    sharedCommunityCards: state?.core?.communityCards?.length,
                };
            }, { message: '等待 TTS 开局配置通过真实入口生效' })
            .toEqual({
                gameMode: 'seven-card-stud',
                exitChipMode: 'mastermind',
                omaha: true,
                twoHand: false,
                automode: false,
                antiTroll: false,
                quickAccess: 1,
                handCards: 3,
                personalCommunityCards: 1,
                sharedCommunityCards: 0,
            });

        const toolsPanel = page.getByTestId('the-gang-tools-panel');
        await expect(toolsPanel).toBeVisible();
        await expect(toolsPanel.getByRole('button', { name: /工具/ })).toHaveAttribute('aria-expanded', 'false');
        await expect(toolsPanel.getByRole('button', { name: '重设工具牌' })).toHaveCount(0);
        await game.screenshot('桌面工具入口关闭态', testInfo);
        await toolsPanel.getByRole('button', { name: /工具/ }).click();
        const toolsModal = page.getByTestId('the-gang-tools-modal');
        await expect(toolsModal).toBeVisible();
        await expect(toolsModal).toHaveCSS('position', 'fixed');
        const toolsModalBox = await toolsModal.boundingBox();
        expect(toolsModalBox, '工具与专家牌必须由完整视口弹窗承载').not.toBeNull();
        expect(toolsModalBox!.x).toBeLessThanOrEqual(1);
        expect(toolsModalBox!.y).toBeLessThanOrEqual(1);
        expect(toolsModalBox!.width).toBeGreaterThanOrEqual(1365);
        expect(toolsModalBox!.height).toBeGreaterThanOrEqual(767);
        await expect(toolsModal.getByRole('button', { name: '关闭工具与专家牌' })).toBeVisible();
        await expect(toolsPanel.getByRole('button', { name: '重设工具牌' })).toBeVisible();
        await expect(toolsPanel.getByRole('button', { name: '重设专家牌' })).toBeVisible();
        await game.screenshot('桌面工具专家承载区空态', testInfo);

        let localTools: string[] = [];
        for (let attempt = 0; attempt < 12; attempt += 1) {
            await toolsPanel.getByRole('button', { name: '发放工具牌' }).click();
            await expect(toolsModal.getByTestId('the-gang-tools-deal-status')).toContainText('已向 3 名玩家各发 1 张工具牌');
            await expect(toolsPanel.getByRole('button', { name: '已发放' })).toHaveAttribute('aria-disabled', 'true');
            await expect
                .poll(async () => {
                    const state = await getTheGangState(page);
                    return {
                        allToolCounts: Object.values(state?.core?.players ?? {})
                            .map((player) => player.toolCards?.length ?? 0),
                        localTools: state?.core?.players?.['0']?.toolCards ?? [],
                    };
                }, { message: '等待工具牌通过真实入口发到每名玩家手中' })
                .toEqual({
                    allToolCounts: [1, 1, 1],
                    localTools: expect.arrayContaining([expect.any(String)]),
                });
            const state = await getTheGangState(page);
            localTools = state?.core?.players?.['0']?.toolCards ?? [];
            if (localTools.includes('burner-phone')) break;
            await toolsPanel.getByRole('button', { name: '重设工具牌' }).click();
            await expect
                .poll(async () => {
                    const stateAfterReset = await getTheGangState(page);
                    return {
                        allToolCounts: Object.values(stateAfterReset?.core?.players ?? {})
                            .map((player) => player.toolCards?.length ?? 0),
                        toolDeck: stateAfterReset?.core?.toolDeck?.length,
                    };
                }, { message: '等待工具牌重设回牌堆' })
                .toEqual({
                    allToolCounts: [0, 0, 0],
                    toolDeck: 12,
                });
        }
        expect(localTools).toContain('burner-phone');
        await expect
            .poll(async () => {
                const state = await getTheGangState(page);
                return {
                    allToolCounts: Object.values(state?.core?.players ?? {})
                        .map((player) => player.toolCards?.length ?? 0),
                    localTools: state?.core?.players?.['0']?.toolCards ?? [],
                };
            }, { message: '等待工具牌通过真实入口发到每名玩家手中' })
            .toEqual({
                allToolCounts: [1, 1, 1],
                localTools: expect.arrayContaining([expect.any(String)]),
            });
        const localToolGrid = page.getByTestId('the-gang-tool-card-grid');
        await expect(localToolGrid).toBeVisible();
        const dealtToolCard = localToolGrid.locator('img[data-debug-current-src*="/assets/i18n/zh-CN/the-gang/rule-assets/tools/compressed/"]').first();
        await expect(dealtToolCard).toBeVisible();
        await expect(dealtToolCard).toHaveAttribute('data-debug-current-src', /\/assets\/i18n\/zh-CN\/the-gang\/rule-assets\/tools\/compressed\//);
        await expect
            .poll(async () => dealtToolCard.evaluate((img) => {
                const rect = (img as HTMLImageElement).getBoundingClientRect();
                return Math.round(rect.width);
            }), { message: '等待 TTS 工具牌作为面板主体显示' })
            .toBeGreaterThanOrEqual(130);
        await expect
            .poll(async () => dealtToolCard.evaluate((img) => {
                const cardShell = img.parentElement;
                return cardShell ? window.getComputedStyle(cardShell).opacity : '';
            }), { message: '等待 TTS 工具牌正面不被禁用态透明度压暗' })
            .toBe('1');
        await game.screenshot('桌面工具专家牌区已发放工具牌', testInfo);

        await localToolGrid.getByRole('button', { name: /一次性手机/ }).click();
        await expect
            .poll(async () => {
                const state = await getTheGangState(page);
                return {
                    localTools: state?.core?.players?.['0']?.toolCards ?? [],
                    activeTools: state?.core?.players?.['0']?.activeTools ?? [],
                    localSpecialists: state?.core?.players?.['0']?.specialistCards ?? [],
                    specialistDeck: state?.core?.specialistDeck?.length,
                    toolDiscardPile: state?.core?.toolDiscardPile ?? [],
                };
            }, { message: '等待一次性手机按 TTS 脚本抽出 2 张专家牌' })
            .toEqual({
                localTools: [],
                activeTools: expect.arrayContaining(['burner-phone']),
                localSpecialists: expect.arrayContaining([expect.any(String), expect.any(String)]),
                specialistDeck: 8,
                toolDiscardPile: expect.arrayContaining(['burner-phone']),
            });
        const localSpecialistGrid = page.getByTestId('the-gang-specialist-card-grid');
        await expect(localSpecialistGrid).toBeVisible();
        const specialistCards = localSpecialistGrid.locator('img[data-debug-current-src*="/assets/i18n/zh-CN/the-gang/rule-assets/specialists/compressed/"]');
        await expect(specialistCards).toHaveCount(2);
        await expect(specialistCards.first()).toHaveAttribute('data-debug-current-src', /\/assets\/i18n\/zh-CN\/the-gang\/rule-assets\/specialists\/compressed\//);
        await game.screenshot('桌面一次性手机抽出专家牌', testInfo);

        await toolsPanel.getByRole('button', { name: '重设专家牌' }).click();
        await expect
            .poll(async () => {
                const state = await getTheGangState(page);
                return {
                    localSpecialists: state?.core?.players?.['0']?.specialistCards ?? [],
                    specialistDeck: state?.core?.specialistDeck?.length,
                    specialistDiscardPile: state?.core?.specialistDiscardPile ?? [],
                };
            }, { message: '等待专家牌重设回专家牌堆' })
            .toEqual({
                localSpecialists: [],
                specialistDeck: 10,
                specialistDiscardPile: [],
            });
        await expect(page.getByTestId('the-gang-specialist-card-grid')).toHaveCount(0);
        await game.screenshot('桌面专家牌区重设后回到承载面', testInfo);

        await toolsPanel.getByRole('button', { name: '重设工具牌' }).click();
        await expect
            .poll(async () => {
                const state = await getTheGangState(page);
                return {
                    localTools: state?.core?.players?.['0']?.toolCards ?? [],
                    activeTools: state?.core?.players?.['0']?.activeTools ?? [],
                    toolDeck: state?.core?.toolDeck?.length,
                    toolDiscardPile: state?.core?.toolDiscardPile ?? [],
                };
            }, { message: '等待工具牌重设回工具牌堆' })
            .toEqual({
                localTools: [],
                activeTools: [],
                toolDeck: 12,
                toolDiscardPile: [],
            });
        await expect(page.getByTestId('the-gang-tool-card-grid')).toHaveCount(0);
        await game.screenshot('桌面工具牌区重设后回到承载面', testInfo);

        await prepareNightVisionToolState(page);
        const nightVisionGrid = page.getByTestId('the-gang-tool-card-grid');
        await expect(nightVisionGrid).toBeVisible();
        await nightVisionGrid.getByRole('button', { name: /夜视眼镜/ }).click();
        const nightVisionPicker = page.getByTestId('the-gang-night-vision-picker');
        await expect(nightVisionPicker).toBeVisible();
        await expect(nightVisionPicker.getByRole('button', { name: /选择第 2 张手牌/ })).toBeVisible();
        await game.screenshot('桌面夜视眼镜选择手牌界面', testInfo);
        const beforeNightVision = await getTheGangState(page);
        const beforeHandCount = beforeNightVision?.core?.players?.['0']?.pocketCards?.length ?? 0;
        await nightVisionPicker.getByRole('button', { name: /选择第 2 张手牌/ }).click();
        await expect
            .poll(async () => {
                const state = await getTheGangState(page);
                return {
                    localTools: state?.core?.players?.['0']?.toolCards ?? [],
                    activeTools: state?.core?.players?.['0']?.activeTools ?? [],
                    handCards: state?.core?.players?.['0']?.pocketCards?.length ?? 0,
                    nightVisionCards: state?.core?.players?.['0']?.nightVisionCards?.length ?? 0,
                    toolDiscardPile: state?.core?.toolDiscardPile ?? [],
                };
            }, { message: '等待夜视眼镜通过真实选手牌 UI 生效' })
            .toEqual({
                localTools: [],
                activeTools: expect.arrayContaining(['night-vision-goggles']),
                handCards: beforeHandCount - 1,
                nightVisionCards: 1,
                toolDiscardPile: expect.arrayContaining(['night-vision-goggles']),
        });
        await toolsModal.getByRole('button', { name: '关闭工具与专家牌' }).click();
        await expect(page.getByTestId('the-gang-tool-cards')).toBeVisible();
        await game.screenshot('桌面夜视眼镜选牌后回到牌桌', testInfo);
    });

    test('移动横屏从大厅创建 AI 房间后扩展选择不会被 AI 抢先锁定', async ({ game, page }, testInfo) => {
        test.setTimeout(150000);
        await page.setViewportSize({ width: 812, height: 375 });
        await page.goto('/?game=the-gang&homeStyle=classic', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.getByTestId('game-details-open-create-room').waitFor({ state: 'visible' });
        await game.screenshot('真实开房移动横屏纸牌帮详情', testInfo);

        await page.getByTestId('game-details-open-create-room').click();
        await page.getByTestId('create-room-modal').waitFor({ state: 'visible' });
        await page.getByRole('button', { name: /加入 AI/u }).click();
        await game.screenshot('真实开房移动横屏创建房间AI开启', testInfo);
        await page.getByTestId('create-room-confirm-button').click();
        await page.waitForURL(/\/play\/the-gang\/match\//u, { timeout: 90000 });
        await page.getByTestId('the-gang-utility-dock').waitFor({ state: 'visible' });
        await expectUtilityDockLayout(page, 'row', { maxControlHeight: 46, maxControlWidth: 72 });

        await page.getByTestId('the-gang-rules-config').getByRole('button', { name: '扩展' }).click();
        await page.getByTestId('the-gang-rules-modal').waitFor({ state: 'visible' });
        const sevenCardStud = page.getByTestId('the-gang-mode-seven-card-stud');
        const quickAccess = page.getByTestId('the-gang-challenge-quick-access');
        await expect(sevenCardStud, '真实 AI 房间刚进入时模式选项不得被 AI 先手筹码锁死').toBeEnabled();
        await expect(quickAccess, '真实 AI 房间刚进入时挑战扩展不得被 AI 先手筹码锁死').toBeEnabled();
        await expect(sevenCardStud).toHaveAttribute('aria-pressed', 'false');
        await expect(quickAccess).toHaveAttribute('aria-pressed', 'false');

        await sevenCardStud.click();
        await quickAccess.click();
        await expect(sevenCardStud).toHaveAttribute('aria-pressed', 'true');
        await expect(sevenCardStud).toHaveAttribute('data-state', 'selected');
        await expect(quickAccess).toHaveAttribute('aria-pressed', 'true');
        await expect(quickAccess).toHaveAttribute('data-state', 'selected');
        await game.screenshot('真实开房移动横屏扩展已选中', testInfo);
        await page.getByRole('button', { name: '确认设置' }).click();
        await expect(page.getByTestId('the-gang-rules-modal')).toHaveCount(0);

        await page.getByTestId('the-gang-rules-config').getByRole('button', { name: '扩展' }).click();
        await expect(page.getByTestId('the-gang-mode-seven-card-stud')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('the-gang-challenge-quick-access')).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: '关闭规则设置' }).click();

        await page.getByRole('button', { name: '白筹码 1 星' }).click();
        await expect(page.getByText('房主开始抢劫后才能拿筹码。')).toBeVisible();
        await expectCurrentRoundChips(page, 0);

        await startHeistFromSetup(page);
        await page.getByTestId('the-gang-rules-config').getByRole('button', { name: '扩展' }).click();
        await expect(page.getByTestId('the-gang-mode-seven-card-stud')).toHaveAttribute('aria-disabled', 'true');
        await clickControlCenter(page, page.getByTestId('the-gang-mode-seven-card-stud'), '已锁定模式选项');
        await expect(page.getByText('本次抢劫已开始，扩展设置不能再修改。')).toBeVisible();
        await page.getByRole('button', { name: '关闭规则设置' }).click();

        await expectToolsPanelUsesPcTwoColumnLayout(page);
        await game.screenshot('真实开房移动横屏工具面板同源布局关闭后', testInfo);
    });

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
        await expect(page.getByTestId('the-gang-current-hand-rank')).toHaveCount(0);
        await expect(page.getByTestId('the-gang-hand-rank-nameplate-toggle')).toHaveCount(0);
        await expect(page.getByTestId('the-gang-hotseat-switcher')).toHaveCount(0);
        await expect(page.locator('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveCount(6);
        await expectChipRoundForPlayerCount(page, '白筹码', 6);
        await expect(page.locator('[data-bgg-zone="card-river"]')).toHaveCount(1);
        await expect(page.locator('[data-bgg-zone="hand-groupzone"]')).toBeVisible();
        await expect(page.locator('[data-bgg-zone="hand-chips"]')).toHaveCount(1);
        await expect(page.locator('[data-bgg-zone="player-tokens"]')).toHaveCount(6);
        await game.screenshot('桌面6人满人数首轮可操作状态', testInfo);

        await startHeistFromSetup(page);
        await chooseChipsForSeats(page, 6);
        await expectCurrentRoundChips(page, 6);
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(6);
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await expectImagesLoaded(page, '[data-bgg-zone="player-current-token"] img', 6);
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
        await startHeistFromSetup(page);
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
        const topZoneCoverTarget = await page.locator('[data-bgg-zone="top-zone"]').evaluate((node) => {
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
        expect(topZoneCoverTarget.isInsideReveal).toBe(true);
        expect(topZoneCoverTarget.topZone).not.toBe('top-zone');

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
        await expectUtilityDockLayout(page, 'row', { maxControlHeight: 46, maxControlWidth: 72 });
        await expectMiddleCenterVerticallyCentered(page, '移动横屏首轮中央排');
        await page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] summary').click();
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] li').filter({ hasText: '高牌' })).toBeVisible();
        await game.screenshot('移动横屏左下角辅助栏和牌型展开', testInfo);
        await page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] summary').click();
        await expectToolsPanelUsesPcTwoColumnLayout(page);
        await expectChipRound(page, '白筹码');
        await startHeistFromSetup(page);
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
        await expectUtilityDockLayout(page, 'column');
        await expect(page.locator('[data-bgg-zone="hand-groupzone"]')).toBeVisible();
        await expect(page.locator('[data-bgg-zone="token-pile"]')).toBeInViewport();
        await expect(page.locator('[data-bgg-zone="hand-cards"]')).toBeInViewport();
        await expectMiddleCenterVerticallyCentered(page, '移动竖屏首轮中央排');
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
        await expectUtilityDockLayout(page, 'row');
        await expect(page.getByTestId('the-gang-current-hand-rank')).toHaveCount(0);
        await expect(page.getByTestId('the-gang-hand-rank-nameplate-toggle')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"]')).toBeVisible();
        await page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] summary').click();
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] li').filter({ hasText: '高牌' })).toBeVisible();
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"] li').filter({ hasText: '皇家同花顺' })).toBeVisible();
        await game.screenshot('桌面左下角牌型辅助表展开且等待公共牌', testInfo);

        await expectChipRound(page, '白筹码');
        await expect(page.getByRole('button', { name: '下一轮' })).toHaveCount(0);
        await page.getByRole('button', { name: '白筹码 1 星' }).click();
        await expect(page.getByText('房主开始抢劫后才能拿筹码。')).toBeVisible();
        await expectCurrentRoundChips(page, 0);
        await startHeistFromSetup(page);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeDisabled();
        await expectMiddleCenterVerticallyCentered(page, '桌面首轮等待公共牌');
        const initialLayoutGeometry = await page.evaluate(() => {
            const hand = document.querySelector('[data-bgg-zone="hand-groupzone"]')?.getBoundingClientRect();
            const bottom = document.querySelector('[data-bgg-zone="bottom-zone"]');
            return {
                handBottomGap: window.innerHeight - (hand?.bottom ?? 0),
                bottomPosition: bottom ? getComputedStyle(bottom).position : '',
            };
        });
        expect(initialLayoutGeometry.bottomPosition).toBe('absolute');
        expect(initialLayoutGeometry.handBottomGap).toBeLessThan(140);
        await game.screenshot('桌面首轮可操作状态', testInfo);

        await chooseAllPlayerChips(page, '白筹码');
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await game.screenshot('桌面首轮全员筹码已选', testInfo);

        await confirmProgressForAllPlayers(page, '下一轮');
        await expectChipRound(page, '黄筹码');
        await expect(page.getByTestId('the-gang-current-hand-rank')).toHaveCount(0);
        await expect(page.getByTestId('the-gang-hand-rank-nameplate-toggle')).toHaveCount(0);
        await expect(page.getByTestId('the-gang-current-hand-rank-detail')).toHaveCount(0);
        await expect(page.getByTestId('the-gang-current-hand-rank-best-cards')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="the-gang-hand-rank-reference"]')).toBeVisible();
        await expectMiddleCenterVerticallyCentered(page, '桌面局中筹码与公共牌同时存在');
        await game.screenshot('桌面局中左下角牌型入口保持可用', testInfo);
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
        await expectMiddleCenterVerticallyCentered(page, '桌面中局满公共牌');
        const fullLayoutGeometry = await page.evaluate(() => {
            const hand = document.querySelector('[data-bgg-zone="hand-groupzone"]')?.getBoundingClientRect();
            return {
                handBottomGap: window.innerHeight - (hand?.bottom ?? 0),
            };
        });
        expect(fullLayoutGeometry.handBottomGap).toBeLessThan(140);
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
        await expect(page.getByRole('button', { name: '开始抢劫' })).toBeVisible();
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
        await startHeistFromSetup(page);

        await page.getByRole('button', { name: '白筹码 1 星' }).click();
        await expectCurrentRoundChips(page, 3);
        await expect(page.locator('[data-bgg-zone="player-current-token"]')).toHaveCount(3);
        await expect(page.locator('[data-bgg-zone="hand-current-chip"]')).toHaveCount(1);
        await expectAvailableChipButtons(page, '白筹码', []);
        await expect(page.getByRole('button', { name: '下一轮' })).toBeEnabled();

        await page.getByRole('button', { name: '下一轮' }).click();
        await expectChipRound(page, '黄筹码');
    });
});
