/**
 * 大杀四方 - 远古之物多选交互 E2E 测试
 * 
 * 测试远古之物"消灭两个己方随从"的多选功能
 * 使用 TestHarness 直接注入状态，跳过派系选择
 */

import { test, expect } from '@playwright/test';
import { 
    initContext, 
    waitForTestHarness, 
    createGuestId,
    getGameServerBaseURL,
    seedMatchCredentials
} from '../helpers/common';

test.describe('远古之物 - 消灭两个己方随从（多选）', () => {
    test('选择消灭时应显示多选界面，选择2个随从后确认', async ({ browser }) => {
        // 创建房间
        const context = await browser.newContext();
        await initContext(context);
        const page = await context.newPage();
        
        const guestId = createGuestId('su_e2e');
        await page.addInitScript((id) => {
            localStorage.setItem('guest_id', id);
        }, guestId);
        
        const base = getGameServerBaseURL();
        const res = await page.request.post(`${base}/games/smashup/create`, {
            data: { numPlayers: 2, setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' } },
        });
        const data = await res.json() as { matchID: string };
        const matchId = data.matchID;
        
        const claimRes = await page.request.post(`${base}/games/smashup/${matchId}/claim-seat`, {
            data: { playerID: '0', playerName: 'Host', guestId },
        });
        const claimData = await claimRes.json() as { playerCredentials: string };
        await seedMatchCredentials(context, 'smashup', matchId, '0', claimData.playerCredentials);
        
        await page.goto(`/play/smashup/match/${matchId}?playerID=0`);
        
        // 等待 TestHarness 就绪
        await waitForTestHarness(page);

        // 等待 GameProvider 初始化（StateInjector 注册）
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 10000 }
        );

        // 直接注入游戏状态，跳过派系选择
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                phase: 'main',
                currentPlayer: '0',
                bases: [{
                    defId: 'base_the_homeworld',
                    breakpoint: 20,
                    minions: [
                        { uid: 'et-1', defId: 'elder_thing_elder_thing', controller: '0', owner: '0', power: 5 },
                        { uid: 'm1', defId: 'alien_invader', controller: '0', owner: '0', power: 3 },
                        { uid: 'm2', defId: 'alien_supreme_overlord', controller: '0', owner: '0', power: 4 },
                        { uid: 'm3', defId: 'alien_scout', controller: '0', owner: '0', power: 2 },
                    ],
                    ongoingActions: []
                }]
            });
        });

        // 触发远古之物 onPlay
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'ABILITY_ACTIVATE',
                payload: {
                    abilityId: 'elder_thing_elder_thing',
                    sourceUid: 'et-1',
                    trigger: 'onPlay',
                    baseIndex: 0
                }
            });
        });

        // 等待第一个选择：消灭 vs 放牌库底
        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_STATE__;
                return state?.sys?.interaction?.current?.data?.sourceId === 'elder_thing_elder_thing_choice';
            },
            { timeout: 5000 }
        );

        // 选择"消灭"
        await page.click('button:has-text("消灭两个己方其他随从")');

        // 等待多选界面
        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_STATE__;
                return state?.sys?.interaction?.current?.data?.sourceId === 'elder_thing_elder_thing_destroy_select';
            },
            { timeout: 5000 }
        );

        // 验证显示了3个选项（排除远古之物自己）
        const optionCount = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.sys?.interaction?.current?.data?.options?.length || 0;
        });
        expect(optionCount).toBe(3);

        // 选择2个随从（点击前两个卡牌）
        await page.evaluate(() => {
            const cards = document.querySelectorAll('[data-testid^="prompt-card-"]');
            if (cards.length >= 2) {
                (cards[0] as HTMLElement).click();
                (cards[1] as HTMLElement).click();
            }
        });

        // 等待一下让 UI 更新
        await page.waitForTimeout(500);

        // 验证确认按钮显示已选数量
        await expect(page.locator('button:has-text("确认 (2)")')).toBeVisible();

        // 点击确认
        await page.click('button:has-text("确认")');

        // 验证随从被消灭（只剩2个）
        await page.waitForFunction(() => {
            const state = (window as any).__BG_STATE__;
            const base = state?.bases?.[0];
            return base?.minions?.length === 2;
        }, { timeout: 5000 });

        const finalMinions = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state.bases[0].minions.map((m: any) => m.uid);
        });

        // 应该剩下远古之物和1个随从
        expect(finalMinions.length).toBe(2);
        expect(finalMinions).toContain('et-1');
        
        await context.close();
    });

    test('恰好2个随从时选择消灭应直接执行，无需多选', async ({ browser }) => {
        // 创建房间
        const context = await browser.newContext();
        await initContext(context);
        const page = await context.newPage();
        
        const guestId = createGuestId('su_e2e');
        await page.addInitScript((id) => {
            localStorage.setItem('guest_id', id);
        }, guestId);
        
        const base = getGameServerBaseURL();
        const res = await page.request.post(`${base}/games/smashup/create`, {
            data: { numPlayers: 2, setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' } },
        });
        const data = await res.json() as { matchID: string };
        const matchId = data.matchID;
        
        const claimRes = await page.request.post(`${base}/games/smashup/${matchId}/claim-seat`, {
            data: { playerID: '0', playerName: 'Host', guestId },
        });
        const claimData = await claimRes.json() as { playerCredentials: string };
        await seedMatchCredentials(context, 'smashup', matchId, '0', claimData.playerCredentials);
        
        await page.goto(`/play/smashup/match/${matchId}?playerID=0`);
        
        await waitForTestHarness(page);

        // 等待 GameProvider 初始化（StateInjector 注册）
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 10000 }
        );

        // 直接注入游戏状态
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                phase: 'main',
                currentPlayer: '0',
                bases: [{
                    defId: 'base_the_homeworld',
                    breakpoint: 20,
                    minions: [
                        { uid: 'et-1', defId: 'elder_thing_elder_thing', controller: '0', owner: '0', power: 5 },
                        { uid: 'm1', defId: 'alien_invader', controller: '0', owner: '0', power: 3 },
                        { uid: 'm2', defId: 'alien_scout', controller: '0', owner: '0', power: 2 },
                    ],
                    ongoingActions: []
                }]
            });
        });

        // 触发 onPlay
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'ABILITY_ACTIVATE',
                payload: {
                    abilityId: 'elder_thing_elder_thing',
                    sourceUid: 'et-1',
                    trigger: 'onPlay',
                    baseIndex: 0
                }
            });
        });

        // 等待选择
        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_STATE__;
                return state?.sys?.interaction?.current?.data?.sourceId === 'elder_thing_elder_thing_choice';
            },
            { timeout: 5000 }
        );

        // 选择消灭
        await page.click('button:has-text("消灭两个己方其他随从")');

        // 应该直接消灭，不显示多选界面
        await page.waitForFunction(() => {
            const state = (window as any).__BG_STATE__;
            const base = state?.bases?.[0];
            return base?.minions?.length === 1; // 只剩远古之物
        }, { timeout: 5000 });

        const finalMinions = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state.bases[0].minions.map((m: any) => m.uid);
        });

        expect(finalMinions).toEqual(['et-1']);
        
        await context.close();
    });
});
