/**
 * E2E 测试：便衣忍者"跳过"选项
 * 
 * 验证便衣忍者交互在 Me First! 窗口中正确显示，并且有"跳过"选项
 */

import { test, expect } from '@playwright/test';
import { setupOnlineMatch, waitForGameReady, readCoreState, applyCoreStateDirect } from './helpers/game-helpers';

test.describe('便衣忍者"跳过"选项', () => {
    test('便衣忍者交互应该显示浮动按钮（包含"跳过"选项）', async ({ page, context }) => {
        const { player1Page, player2Page, matchId } = await setupOnlineMatch(page, context, 'smashup');
        await waitForGameReady(player1Page);
        await waitForGameReady(player2Page);

        // 构造场景：托尔图加基地达到临界点，玩家1 手牌中有便衣忍者和随从
        const state = await readCoreState(player1Page);
        const modifiedState = {
            ...state,
            players: {
                '0': {
                    ...state.players['0'],
                    hand: [
                        { uid: 'c1', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
                        { uid: 'c2', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
                        { uid: 'c3', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
                    ],
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                },
                '1': {
                    ...state.players['1'],
                    hand: [],
                },
            },
            bases: [
                {
                    defId: 'base_tortuga',
                    minions: [
                        { uid: 'm1', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm3', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm4', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm5', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm6', defId: 'alien_scout', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_mothership',
                    minions: [],
                    ongoingActions: [],
                },
            ],
            turnNumber: 1,
            currentPlayerIndex: 0,
        };

        await applyCoreStateDirect(player1Page, modifiedState);

        // 玩家1 打出便衣忍者（special action）
        await player1Page.click('[data-card-uid="c1"]');
        await player1Page.waitForTimeout(500);

        // 点击托尔图加基地（触发 Me First! 响应窗口）
        await player1Page.click('[data-base-index="0"]');
        await player1Page.waitForTimeout(1000);

        // 验证：应该显示浮动按钮（包含"跳过"选项）
        const floatingButtons = player1Page.locator('.fixed.bottom-8.left-1\\/2.-translate-x-1\\/2');
        await expect(floatingButtons).toBeVisible({ timeout: 5000 });

        // 验证：浮动按钮中应该有"跳过"按钮
        const skipButton = floatingButtons.locator('button:has-text("跳过")');
        await expect(skipButton).toBeVisible();

        // 验证：点击"跳过"后交互应该关闭
        await skipButton.click();
        await player1Page.waitForTimeout(500);
        await expect(floatingButtons).not.toBeVisible();

        // 验证：没有随从被打出（基地上仍然是 6 个随从）
        const finalState = await readCoreState(player1Page);
        expect(finalState.bases[0].minions.length).toBe(6);
    });

    test('便衣忍者交互应该允许选择手牌中的随从', async ({ page, context }) => {
        const { player1Page, player2Page, matchId } = await setupOnlineMatch(page, context, 'smashup');
        await waitForGameReady(player1Page);
        await waitForGameReady(player2Page);

        // 构造场景：托尔图加基地达到临界点，玩家1 手牌中有便衣忍者和随从
        const state = await readCoreState(player1Page);
        const modifiedState = {
            ...state,
            players: {
                '0': {
                    ...state.players['0'],
                    hand: [
                        { uid: 'c1', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
                        { uid: 'c2', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
                    ],
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                },
                '1': {
                    ...state.players['1'],
                    hand: [],
                },
            },
            bases: [
                {
                    defId: 'base_tortuga',
                    minions: [
                        { uid: 'm1', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm3', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm4', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm5', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm6', defId: 'alien_scout', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_mothership',
                    minions: [],
                    ongoingActions: [],
                },
            ],
            turnNumber: 1,
            currentPlayerIndex: 0,
        };

        await applyCoreStateDirect(player1Page, modifiedState);

        // 玩家1 打出便衣忍者（special action）
        await player1Page.click('[data-card-uid="c1"]');
        await player1Page.waitForTimeout(500);

        // 点击托尔图加基地（触发 Me First! 响应窗口）
        await player1Page.click('[data-base-index="0"]');
        await player1Page.waitForTimeout(1000);

        // 验证：应该显示浮动按钮
        const floatingButtons = player1Page.locator('.fixed.bottom-8.left-1\\/2.-translate-x-1\\/2');
        await expect(floatingButtons).toBeVisible({ timeout: 5000 });

        // 点击手牌中的忍者侍从（在手牌区直接点击）
        await player1Page.click('[data-card-uid="c2"]');
        await player1Page.waitForTimeout(500);

        // 验证：忍者侍从应该被打出到托尔图加基地
        const finalState = await readCoreState(player1Page);
        expect(finalState.bases[0].minions.length).toBe(7);
        expect(finalState.bases[0].minions.some(m => m.uid === 'c2')).toBe(true);
    });
});
