/**
 * SmashUp - 状态注入功能测试
 * 
 * 测试目标：验证状态注入工具是否正常工作
 * 
 * 注意：这个测试跳过派系选择，直接进入游戏后测试状态注入
 */


import { initContext, getGameServerBaseURL } from '../helpers/common';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    waitForTestHarness,
    buildScene,
    readGameState,
} from '../helpers/smashup-state-builder';


type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

test.describe('状态注入功能测试', () => {
    test.beforeEach(async (_fixtures, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
    });

    test('应该能够注入手牌和牌库', async ({ browser }) => {
        // 创建一个简单的浏览器上下文
        const context = await browser.newContext();
        await initContext(context, '__test_storage');
        const page = await context.newPage();

        // 导航到首页
        await page.goto('/');
        
        // 等待页面加载
        await page.waitForTimeout(2000);

        // 等待测试工具就绪
        await waitForTestHarness(page);

        // 测试：注入状态
        await buildScene(page, {
            playerId: '0',
            hand: ['wizard_portal', 'wizard_familiar'],
            deck: ['wizard_archmage', 'wizard_chronomage'],
            currentPlayer: '0',
            phase: 'play',
        });

        // 验证：读取状态
        const state = await readGameState(page);
        
        console.log('注入后的状态:', JSON.stringify(state, null, 2));

        // 验证手牌
        expect(state.core.players['0'].hand.length).toBe(2);
        expect(state.core.players['0'].hand[0].defId).toBe('wizard_portal');
        expect(state.core.players['0'].hand[1].defId).toBe('wizard_familiar');

        // 验证牌库
        expect(state.core.players['0'].deck.length).toBe(2);
        expect(state.core.players['0'].deck[0].defId).toBe('wizard_archmage');
        expect(state.core.players['0'].deck[1].defId).toBe('wizard_chronomage');

        // 验证当前玩家
        expect(state.core.currentPlayer).toBe('0');

        // 验证阶段
        expect(state.core.phase).toBe('play');

        await context.close();
    });

    test('应该能够控制随机数', async ({ browser }) => {
        const context = await browser.newContext();
        await initContext(context, '__test_storage2');
        const page = await context.newPage();

        await page.goto('/');
        await page.waitForTimeout(2000);
        await waitForTestHarness(page);

        // 设置随机数队列
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.random.setQueue([0.1, 0.5, 0.9]);
        });

        // 验证随机数队列
        const queueLength = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.random.queueLength();
        });

        expect(queueLength).toBe(3);

        await context.close();
    });

    test('泰坦 hover 只应轻微放大卡面，不应把基地计分条一起放大', async ({ game, page }, testInfo) => {
        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['pirates', 'zombies'],
                field: [
                    { uid: 'pirate-minion-1', defId: 'pirate_first_mate', baseIndex: 0 },
                ],
            },
            player1: {
                factions: ['robots', 'dinosaurs'],
                field: [
                    { uid: 'robot-minion-1', defId: 'robot_microbot_alpha', baseIndex: 0 },
                ],
            },
            extra: {
                core: {
                    titans: [{
                        uid: 't-hover-kraken',
                        defId: 'pirates_the_kraken',
                        faction: 'pirates',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    }],
                },
            },
        });

        const titanCard = page.getByTestId('su-base-titan-t-hover-kraken');
        const scoreBadge = page.getByTestId('su-base-score-0-0');
        await expect(titanCard).toBeVisible({ timeout: 15000 });
        await expect(scoreBadge).toBeVisible({ timeout: 15000 });

        const captureCluster = async (name: string) => {
            const titanBox = await titanCard.boundingBox();
            const scoreBox = await scoreBadge.boundingBox();
            if (!titanBox || !scoreBox) {
                throw new Error('无法获取泰坦或计分条截图边界');
            }
            const left = Math.min(titanBox.x, scoreBox.x) - 24;
            const top = Math.min(titanBox.y, scoreBox.y) - 24;
            const right = Math.max(titanBox.x + titanBox.width, scoreBox.x + scoreBox.width) + 24;
            const bottom = Math.max(titanBox.y + titanBox.height, scoreBox.y + scoreBox.height) + 24;
            const path = getEvidenceScreenshotPath(testInfo, name, {
                filename: `${name}.png`,
            });
            await page.screenshot({
                path,
                clip: {
                    x: Math.max(left, 0),
                    y: Math.max(top, 0),
                    width: Math.max(right - Math.max(left, 0), 1),
                    height: Math.max(bottom - Math.max(top, 0), 1),
                },
            });
            return path;
        };

        const beforeTitanBox = await titanCard.boundingBox();
        const beforeScoreBox = await scoreBadge.boundingBox();
        if (!beforeTitanBox || !beforeScoreBox) {
            throw new Error('hover 前未拿到泰坦或计分条边界');
        }
        const beforeShot = await captureCluster('titan-hover-before');

        await titanCard.hover();
        await page.waitForTimeout(250);

        const afterTitanBox = await titanCard.boundingBox();
        const afterScoreBox = await scoreBadge.boundingBox();
        if (!afterTitanBox || !afterScoreBox) {
            throw new Error('hover 后未拿到泰坦或计分条边界');
        }
        const afterShot = await captureCluster('titan-hover-after');

        console.log('泰坦 hover 证据截图:', { beforeShot, afterShot });

        expect(afterTitanBox.height).toBeGreaterThan(beforeTitanBox.height * 1.05);
        expect(afterTitanBox.height).toBeLessThan(beforeTitanBox.height * 1.14);
        expect(Math.abs(afterScoreBox.height - beforeScoreBox.height)).toBeLessThan(1);
        expect(Math.abs(afterScoreBox.width - beforeScoreBox.width)).toBeLessThan(1);
    });
});
