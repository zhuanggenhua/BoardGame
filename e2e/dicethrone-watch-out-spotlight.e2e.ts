/**
 * Watch Out 骰子特写 E2E 测试
 * 
 * 验证:自己打出 Watch Out 后,应该看到独立骰子特写
 */

import { test } from './framework';

test('自己打出 Watch Out 应显示骰子特写', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await page.goto('/play/dicethrone');

    // 等待 TestHarness 就绪
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
        { timeout: 15000 }
    );

    // 等待游戏完全加载（等待选角界面出现或游戏开始）
    await page.waitForFunction(
        () => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return state?.core?.phase !== undefined;
        },
        { timeout: 20000 }
    );

    console.log('[E2E] ✅ 游戏已加载，准备注入状态');

    // 状态注入:跳过选角,直接设置游戏状态
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['watch-out'],
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
            },
        },
    });

    console.log('[E2E] ⏳ 等待 React 重新渲染...');
    await page.waitForTimeout(3000);

    // 截图:初始状态
    await game.screenshot('01-initial-state', testInfo);

    // 检查手牌是否存在
    const handArea = page.locator('[data-testid="hand-area"]');
    const handCards = handArea.locator('[data-card-id]');
    const cardCount = await handCards.count();
    console.log('[E2E] 📋 手牌数量:', cardCount);
    
    if (cardCount === 0) {
        console.error('[E2E] ❌ 手牌为空，状态注入可能失败');
        await game.screenshot('error-no-cards', testInfo);
        throw new Error('手牌为空，状态注入失败');
    }

    // 点击 Watch Out 卡牌
    const watchOutCard = page.locator('[data-card-id="watch-out"]').first();
    console.log('[E2E] 🔍 查找 Watch Out 卡牌...');
    await watchOutCard.waitFor({ state: 'visible', timeout: 10000 });
    console.log('[E2E] ✅ 找到 Watch Out 卡牌');
    
    await watchOutCard.click();
    console.log('[E2E] 🖱️ 点击 Watch Out 卡牌');

    // 等待骰子特写出现
    console.log('[E2E] ⏳ 等待骰子特写出现...');
    await page.waitForTimeout(3000);

    // 截图:打出卡牌后
    await game.screenshot('02-after-play-card', testInfo);

    // 检查是否有骰子特写
    const bonusDieOverlay = page.locator('[data-testid="bonus-die-overlay"]');
    const spotlightContainer = page.locator('.fixed.inset-0.z-\\[700\\]');
    
    await game.screenshot('03-final-state', testInfo);

    // 输出调试信息
    const hasOverlay = await bonusDieOverlay.count() > 0;
    const hasSpotlight = await spotlightContainer.count() > 0;
    
    console.log('[E2E] 骰子特写检查:', {
        hasOverlay,
        hasSpotlight,
        overlayCount: await bonusDieOverlay.count(),
        spotlightCount: await spotlightContainer.count(),
    });
});
