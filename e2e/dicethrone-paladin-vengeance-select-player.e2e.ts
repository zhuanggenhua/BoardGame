/**
 * 圣骑士复仇 II 技能 - 选择玩家授予反击 Token E2E 测试
 *
 * 测试场景：
 * 1. 触发复仇 II 技能（3盔+1祈祷）
 * 2. 出现选择玩家界面
 * 3. 选择自己或对手
 * 4. 确认选择
 * 5. 验证目标玩家获得反击 token
 */

import { test, expect } from '@playwright/test';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
import {
    setupDTOnlineMatch,
    selectCharacter,
    waitForGameBoard,
    readCoreState,
    applyDiceValues,
    closeDebugPanelIfOpen,
} from './helpers/dicethrone';

/** 读取指定玩家 tokens */
const getPlayerTokens = (core: Record<string, unknown>, playerId: string) => {
    const players = core.players as Record<string, Record<string, unknown>>;
    return (players[playerId]?.tokens as Record<string, number>) ?? {};
};

/** 读取指定玩家 CP */
const getPlayerCp = (core: Record<string, unknown>, playerId: string) => {
    const players = core.players as Record<string, Record<string, unknown>>;
    const resources = players[playerId]?.resources as Record<string, number> | undefined;
    return resources?.[RESOURCE_IDS.CP] ?? 0;
};

test.describe('圣骑士复仇 II - 选择玩家授予反击', () => {

    test('选择自己授予反击 token', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        if (!setup) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            // 选择英雄：圣骑士 vs 野蛮人
            await selectCharacter(hostPage, 'paladin');
            await selectCharacter(guestPage, 'barbarian');
            
            // 等待游戏开始
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);
            
            await hostPage.waitForTimeout(1000);

            // 圣骑士是玩家 0（host）
            const page = hostPage;
            const paladinId = '0';

            // 推进到攻击掷骰阶段
            const nextPhaseBtn = page.locator('[data-tutorial-id="advance-phase-button"]');
            await nextPhaseBtn.click();
            await page.waitForTimeout(500);

            // 注入骰面：3盔+1祈祷（触发复仇 II 主技能）
            await applyDiceValues(page, [3, 3, 3, 6, 1, 1]); // 3个盔(3) + 1个祈祷(6) + 2个剑(1)
            await page.waitForTimeout(500);

            // 确认骰面
            const confirmBtn = page.locator('button:has-text("确认")').first();
            await confirmBtn.click();
            await page.waitForTimeout(1000);

            // 选择技能（复仇 II）
            const abilityBtn = page.locator('[data-ability-id="vengeance"]').first();
            await abilityBtn.click();
            await page.waitForTimeout(1000);

            // 应该出现选择玩家界面
            const modalTitle = page.locator('text=选择一名玩家');
            await expect(modalTitle).toBeVisible({ timeout: 5000 });

            // 截图：选择玩家界面
            await page.screenshot({ path: testInfo.outputPath('vengeance-select-player-modal.png'), fullPage: false });

            // 选择自己（圣骑士）
            const selfOption = page.locator('text=自己').first();
            await expect(selfOption).toBeVisible();
            
            // 验证可以点击（不是 disabled 状态）
            const selfContainer = selfOption.locator('xpath=ancestor::div[contains(@class, "cursor-pointer")]').first();
            await expect(selfContainer).toBeVisible();
            
            await selfOption.click();
            await page.waitForTimeout(500);

            // 截图：选择后状态
            await page.screenshot({ path: testInfo.outputPath('vengeance-player-selected.png'), fullPage: false });

            // 确认选择
            const confirmSelectBtn = page.locator('button:has-text("确认")').last();
            await confirmSelectBtn.click();
            await page.waitForTimeout(1000);

            // 验证圣骑士获得了反击 token
            const core = await readCoreState(page) as Record<string, unknown>;
            const tokens = getPlayerTokens(core, paladinId);
            expect(tokens[TOKEN_IDS.RETRIBUTION], '圣骑士应获得 1 层反击').toBe(1);

            // 验证获得了 4 CP（复仇 II 的第二个效果）
            const cp = getPlayerCp(core, paladinId);
            expect(cp, '圣骑士应获得 4 CP').toBeGreaterThanOrEqual(4);

            await closeDebugPanelIfOpen(page);
            await page.screenshot({ path: testInfo.outputPath('vengeance-self-complete.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('选择对手授予反击 token', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        if (!setup) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            // 选择英雄：圣骑士 vs 野蛮人
            await selectCharacter(hostPage, 'paladin');
            await selectCharacter(guestPage, 'barbarian');
            
            // 等待游戏开始
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);
            
            await hostPage.waitForTimeout(1000);

            // 圣骑士是玩家 0（host），对手是玩家 1
            const page = hostPage;
            const paladinId = '0';
            const opponentId = '1';

            // 推进到攻击掷骰阶段
            const nextPhaseBtn = page.locator('[data-tutorial-id="advance-phase-button"]');
            await nextPhaseBtn.click();
            await page.waitForTimeout(500);

            // 注入骰面：3盔+1祈祷
            await applyDiceValues(page, [3, 3, 3, 6, 1, 1]);
            await page.waitForTimeout(500);

            // 确认骰面
            const confirmBtn = page.locator('button:has-text("确认")').first();
            await confirmBtn.click();
            await page.waitForTimeout(1000);

            // 选择技能
            const abilityBtn = page.locator('[data-ability-id="vengeance"]').first();
            await abilityBtn.click();
            await page.waitForTimeout(1000);

            // 选择对手
            const opponentOption = page.locator('text=对手').first();
            await expect(opponentOption).toBeVisible({ timeout: 5000 });
            
            // 验证可以点击
            const opponentContainer = opponentOption.locator('xpath=ancestor::div[contains(@class, "cursor-pointer")]').first();
            await expect(opponentContainer).toBeVisible();
            
            await opponentOption.click();
            await page.waitForTimeout(500);

            // 确认选择
            const confirmSelectBtn = page.locator('button:has-text("确认")').last();
            await confirmSelectBtn.click();
            await page.waitForTimeout(1000);

            // 验证对手获得了反击 token
            const core = await readCoreState(page) as Record<string, unknown>;
            const opponentTokens = getPlayerTokens(core, opponentId);
            expect(opponentTokens[TOKEN_IDS.RETRIBUTION], '对手应获得 1 层反击').toBe(1);

            // 验证圣骑士没有获得反击
            const paladinTokens = getPlayerTokens(core, paladinId);
            expect(paladinTokens[TOKEN_IDS.RETRIBUTION] ?? 0, '圣骑士不应获得反击').toBe(0);

            await closeDebugPanelIfOpen(page);
            await page.screenshot({ path: testInfo.outputPath('vengeance-opponent-complete.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('取消选择应关闭界面', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        if (!setup) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            // 选择英雄：圣骑士 vs 野蛮人
            await selectCharacter(hostPage, 'paladin');
            await selectCharacter(guestPage, 'barbarian');
            
            // 等待游戏开始
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);
            
            await hostPage.waitForTimeout(1000);

            // 圣骑士是玩家 0（host）
            const page = hostPage;
            const paladinId = '0';

            // 推进到攻击掷骰阶段
            const nextPhaseBtn = page.locator('[data-tutorial-id="advance-phase-button"]');
            await nextPhaseBtn.click();
            await page.waitForTimeout(500);

            // 注入骰面
            await applyDiceValues(page, [3, 3, 3, 6, 1, 1]);
            await page.waitForTimeout(500);

            // 确认骰面
            const confirmBtn = page.locator('button:has-text("确认")').first();
            await confirmBtn.click();
            await page.waitForTimeout(1000);

            // 选择技能
            const abilityBtn = page.locator('[data-ability-id="vengeance"]').first();
            await abilityBtn.click();
            await page.waitForTimeout(1000);

            // 验证界面出现
            const modalTitle = page.locator('text=选择一名玩家');
            await expect(modalTitle).toBeVisible({ timeout: 5000 });

            // 点击取消
            const cancelBtn = page.locator('button:has-text("取消")').last();
            await cancelBtn.click();
            await page.waitForTimeout(1000);

            // 验证界面关闭
            await expect(modalTitle).not.toBeVisible();

            // 验证没有获得 token
            const core = await readCoreState(page) as Record<string, unknown>;
            const tokens = getPlayerTokens(core, paladinId);
            expect(tokens[TOKEN_IDS.RETRIBUTION] ?? 0, '取消后不应获得反击').toBe(0);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});

