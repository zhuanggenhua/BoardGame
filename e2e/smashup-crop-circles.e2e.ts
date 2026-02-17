import { test, expect } from '@playwright/test';
import { 
    setupSUOnlineMatch,
    readFullState as readCoreState, 
    applyCoreStateDirect,
    closeDebugPanel,
} from './smashup-debug-helpers';

test.describe('麦田怪圈端到端测试', () => {
    // 每个测试后清理
    test.afterEach(async (_fixture, testInfo) => {
        // Playwright 会自动关闭 context，这里只需要确保测试失败时有足够的信息
        if (testInfo.status !== 'passed') {
            console.log(`测试失败: ${testInfo.title}`);
        }
    });

    test('选择基地后一次性返回所有随从（3个随从）', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupSUOnlineMatch(browser, baseURL, ['aliens', 'pirates', 'robots', 'zombies']);
        if (!setup) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage: player1Page, hostContext, guestContext } = setup;

        // 注入初始状态：P0 手牌有麦田怪圈，基地上有 3 个随从（2个P0的，1个P1的）
        await applyCoreStateDirect(player1Page, {
            phase: 'playCards',
            playerIndex: 0,
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': {
                    hand: [
                        { uid: 'cc1', defId: 'alien_crop_circles', cardType: 'action', owner: '0' },
                    ],
                    deck: [],
                    discard: [],
                    factions: ['aliens', 'pirates'],
                    actionLimit: 1,
                    minionLimit: 1,
                    actionPlayed: 0,
                    minionPlayed: 0,
                    vp: 0,
                },
                '1': {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: ['robots', 'zombies'],
                    actionLimit: 1,
                    minionLimit: 1,
                    actionPlayed: 0,
                    minionPlayed: 0,
                    vp: 0,
                },
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    minions: [
                        { uid: 'm1', defId: 'alien_scout', owner: '0', controller: '0', cardType: 'minion' },
                        { uid: 'm2', defId: 'pirate_first_mate', owner: '0', controller: '0', cardType: 'minion' },
                        { uid: 'm3', defId: 'robot_microbot', owner: '1', controller: '1', cardType: 'minion' },
                    ],
                    actions: [],
                },
                {
                    defId: 'base_test_2',
                    breakpoint: 20,
                    minions: [],
                    actions: [],
                },
            ],
            baseDeck: ['base_test_3'],
        });

        await closeDebugPanel(player1Page);
        await player1Page.waitForTimeout(1000);

        // 等待手牌区域渲染
        const handArea = player1Page.getByTestId('su-hand-area');
        await expect(handArea).toBeVisible({ timeout: 5000 });
        
        // 等待麦田怪圈卡牌出现
        const cropCirclesCard = player1Page.locator('[data-card-uid="cc1"]');
        await expect(cropCirclesCard).toBeVisible({ timeout: 5000 });

        // 1. P0 打出麦田怪圈
        await cropCirclesCard.click();
        await player1Page.waitForTimeout(500);

        // 2. 应该出现基地选择交互
        const baseChoice = player1Page.locator('[data-testid="prompt-overlay"]');
        await expect(baseChoice).toBeVisible({ timeout: 3000 });

        // 验证标题
        const title = await baseChoice.locator('h2, h3, [class*="title"]').first().textContent();
        expect(title).toContain('选择');
        expect(title).toContain('基地');

        // 3. 选择第一个基地（有 3 个随从）
        const baseOptions = baseChoice.locator('[data-option-id^="base-"]');
        await expect(baseOptions).toHaveCount(2); // 两个基地
        await baseOptions.first().click();
        await player1Page.waitForTimeout(1000);

        // 4. 验证：不应该再有交互（不需要选择随从）
        await expect(baseChoice).not.toBeVisible({ timeout: 2000 });

        // 5. 读取最终状态
        const finalState = await readCoreState(player1Page);

        // 6. 验证：基地上没有随从了（所有 3 个都被返回）
        expect(finalState.bases[0].minions).toHaveLength(0);

        // 7. 验证：P0 手牌有 2 个随从（m1, m2）
        const p0Hand = finalState.players['0'].hand;
        expect(p0Hand).toHaveLength(2);
        expect(p0Hand.some((c: any) => c.uid === 'm1')).toBe(true);
        expect(p0Hand.some((c: any) => c.uid === 'm2')).toBe(true);

        // 8. 验证：P1 手牌有 1 个随从（m3）
        const p1Hand = finalState.players['1'].hand;
        expect(p1Hand).toHaveLength(1);
        expect(p1Hand.some((c: any) => c.uid === 'm3')).toBe(true);

        // 9. 验证：麦田怪圈进入弃牌堆
        const p0Discard = finalState.players['0'].discard;
        expect(p0Discard.some((c: any) => c.uid === 'cc1')).toBe(true);

        // 清理
        await hostContext.close();
        await guestContext.close();
    });

    test('选择空基地时不产生任何效果', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupSUOnlineMatch(browser, baseURL, ['aliens', 'pirates', 'robots', 'zombies']);
        if (!setup) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage: player1Page, hostContext, guestContext } = setup;

        await applyCoreStateDirect(player1Page, {
            phase: 'playCards',
            playerIndex: 0,
            players: {
                '0': {
                    hand: [
                        { uid: 'cc1', defId: 'alien_crop_circles', cardType: 'action', owner: '0' },
                    ],
                    deck: [],
                    discard: [],
                    factions: ['aliens', 'pirates'],
                    actionLimit: 1,
                    minionLimit: 1,
                    actionPlayed: 0,
                    minionPlayed: 0,
                    vp: 0,
                },
                '1': {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: ['robots', 'zombies'],
                    actionLimit: 1,
                    minionLimit: 1,
                    actionPlayed: 0,
                    minionPlayed: 0,
                    vp: 0,
                },
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    minions: [], // 空基地
                    actions: [],
                },
                {
                    defId: 'base_test_2',
                    breakpoint: 20,
                    minions: [
                        { uid: 'm1', defId: 'alien_scout', owner: '0', controller: '0', cardType: 'minion' },
                    ],
                    actions: [],
                },
            ],
            baseDeck: ['base_test_3'],
        });

        await closeDebugPanel(player1Page);
        await player1Page.waitForTimeout(1000);

        // 打出麦田怪圈
        await player1Page.click('[data-card-uid="cc1"]');
        await player1Page.waitForTimeout(500);

        // 选择空基地
        const baseChoice = player1Page.locator('[data-testid="prompt-overlay"]');
        await expect(baseChoice).toBeVisible({ timeout: 3000 });
        const baseOptions = baseChoice.locator('[data-option-id^="base-"]');
        await baseOptions.first().click();
        await player1Page.waitForTimeout(1000);

        // 验证：交互关闭
        await expect(baseChoice).not.toBeVisible({ timeout: 2000 });

        // 验证：状态不变（空基地仍然是空的，第二个基地的随从还在）
        const finalState = await readCoreState(player1Page);
        expect(finalState.bases[0].minions).toHaveLength(0);
        expect(finalState.bases[1].minions).toHaveLength(1);
        expect(finalState.players['0'].hand).toHaveLength(0); // 没有随从返回手牌

        // 清理
        await hostContext.close();
        await guestContext.close();
    });

    test('只返回选中基地的随从，不影响其他基地', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupSUOnlineMatch(browser, baseURL, ['aliens', 'pirates', 'robots', 'zombies']);
        if (!setup) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage: player1Page, hostContext, guestContext } = setup;

        await applyCoreStateDirect(player1Page, {
            phase: 'playCards',
            playerIndex: 0,
            players: {
                '0': {
                    hand: [
                        { uid: 'cc1', defId: 'alien_crop_circles', cardType: 'action', owner: '0' },
                    ],
                    deck: [],
                    discard: [],
                    factions: ['aliens', 'pirates'],
                    actionLimit: 1,
                    minionLimit: 1,
                    actionPlayed: 0,
                    minionPlayed: 0,
                    vp: 0,
                },
                '1': {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: ['robots', 'zombies'],
                    actionLimit: 1,
                    minionLimit: 1,
                    actionPlayed: 0,
                    minionPlayed: 0,
                    vp: 0,
                },
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    minions: [
                        { uid: 'm1', defId: 'alien_scout', owner: '0', controller: '0', cardType: 'minion' },
                        { uid: 'm2', defId: 'pirate_first_mate', owner: '0', controller: '0', cardType: 'minion' },
                    ],
                    actions: [],
                },
                {
                    defId: 'base_test_2',
                    breakpoint: 20,
                    minions: [
                        { uid: 'm3', defId: 'robot_microbot', owner: '1', controller: '1', cardType: 'minion' },
                        { uid: 'm4', defId: 'zombie_walker', owner: '1', controller: '1', cardType: 'minion' },
                    ],
                    actions: [],
                },
            ],
            baseDeck: ['base_test_3'],
        });

        await closeDebugPanel(player1Page);
        await player1Page.waitForTimeout(1000);

        // 打出麦田怪圈
        await player1Page.click('[data-card-uid="cc1"]');
        await player1Page.waitForTimeout(500);

        // 选择第一个基地
        const baseChoice = player1Page.locator('[data-testid="prompt-overlay"]');
        await expect(baseChoice).toBeVisible({ timeout: 3000 });
        const baseOptions = baseChoice.locator('[data-option-id^="base-"]');
        await baseOptions.first().click();
        await player1Page.waitForTimeout(1000);

        // 验证最终状态
        const finalState = await readCoreState(player1Page);

        // 第一个基地：空了（m1, m2 被返回）
        expect(finalState.bases[0].minions).toHaveLength(0);

        // 第二个基地：不受影响（m3, m4 还在）
        expect(finalState.bases[1].minions).toHaveLength(2);
        expect(finalState.bases[1].minions.some((m: any) => m.uid === 'm3')).toBe(true);
        expect(finalState.bases[1].minions.some((m: any) => m.uid === 'm4')).toBe(true);

        // P0 手牌：有 m1, m2
        expect(finalState.players['0'].hand).toHaveLength(2);
        expect(finalState.players['0'].hand.some((c: any) => c.uid === 'm1')).toBe(true);
        expect(finalState.players['0'].hand.some((c: any) => c.uid === 'm2')).toBe(true);

        // P1 手牌：空（m3, m4 还在基地上）
        expect(finalState.players['1'].hand).toHaveLength(0);

        // 清理
        await hostContext.close();
        await guestContext.close();
    });
});
