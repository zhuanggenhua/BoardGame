/**
 * 大杀四方 - 响应窗口 Pass 测试
 * 
 * 测试场景：验证响应窗口在所有玩家 pass 后正确关闭
 */

import { test, expect } from '../framework';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;


test.describe('大杀四方 - 响应窗口 Pass 测试', () => {
    test('当后续玩家没有可响应内容时，第一次 pass 后响应窗口应自动收口', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        // 1. 导航到游戏
        await page.goto('/play/smashup');

        // 2. 等待游戏加载
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 }
        );

        // 3. 使用 TestHarness 直接打开响应窗口
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            
            // 直接修改状态，打开响应窗口
            const newState = {
                ...state,
                sys: {
                    ...state.sys,
                    responseWindow: {
                        current: {
                            id: 'test-window',
                            windowType: 'me_first',
                            responderQueue: ['0', '1'],
                            currentResponderIndex: 0,
                            passedPlayers: [],
                            actionTakenThisRound: false,
                            consecutivePassRounds: 0,
                        },
                    },
                },
            };
            
            harness.state.patch(newState);
        });

        await page.waitForTimeout(1000);
        await game.screenshot('01-window-opened', testInfo);

        // 4. 验证响应窗口已打开
        const windowState1 = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            return {
                hasWindow: !!state.sys.responseWindow?.current,
                windowId: state.sys.responseWindow?.current?.id,
                currentResponder: state.sys.responseWindow?.current?.responderQueue[state.sys.responseWindow?.current?.currentResponderIndex],
            };
        });

        console.log('[TEST] 窗口状态 1:', windowState1);
        expect(windowState1.hasWindow).toBe(true);
        expect(windowState1.currentResponder).toBe('0');

        // 5. P0 pass
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'RESPONSE_PASS',
                playerId: '0',
                payload: { windowId: 'test-window' },
            });
        });

        await page.waitForTimeout(1000);
        await game.screenshot('02-p0-passed', testInfo);

        // 6. 验证窗口已自动收口
        const windowState2 = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            return {
                hasWindow: !!state.sys.responseWindow?.current,
                windowId: state.sys.responseWindow?.current?.id,
            };
        });

        console.log('[TEST] 窗口状态 2:', windowState2);
        expect(windowState2.hasWindow).toBe(false);

        await game.screenshot('03-window-auto-closed', testInfo);
    });

    test('疯狂解放：弃两张疯狂卡后应立即获得两个额外战术额度，并能继续打出两张行动卡', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'madness-unleashed', defId: 'cthulhu_madness_unleashed', type: 'action' },
                    { uid: 'madness-1', defId: 'special_madness', type: 'action' },
                    { uid: 'madness-2', defId: 'special_madness', type: 'action' },
                    { uid: 'study-1', defId: 'wizard_mystic_studies', type: 'action' },
                    { uid: 'study-2', defId: 'wizard_mystic_studies', type: 'action' },
                ],
                deck: [
                    { uid: 'deck-1', defId: 'alien_invader', type: 'minion' },
                    { uid: 'deck-2', defId: 'wizard_apprentice', type: 'minion' },
                    { uid: 'deck-3', defId: 'pirate_first_mate', type: 'minion' },
                    { uid: 'deck-4', defId: 'robot_microbot_alpha', type: 'minion' },
                    { uid: 'deck-5', defId: 'zombie_walker', type: 'minion' },
                    { uid: 'deck-6', defId: 'alien_scout', type: 'minion' },
                ],
                discard: [],
                factions: ['minions_of_cthulhu', 'wizards'],
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayed: 0,
                minionLimit: 1,
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['aliens', 'robots'],
            },
            bases: [
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
                { defId: 'base_tortuga', minions: [], ongoingActions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await page.waitForTimeout(1200);

        const waitForNoInteraction = async () => {
            await expect.poll(async () => {
                const state = await game.getState();
                return state.sys.interaction?.current?.data?.sourceId ?? null;
            }, { timeout: 10000 }).toBe(null);
        };

        const dismissSpotlightQueueIfPresent = async () => {
            const spotlightQueue = page.getByTestId('card-spotlight-queue');
            const isVisible = await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false);
            if (!isVisible) return;

            await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
            await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
        };

        await game.playCard('cthulhu_madness_unleashed');
        await game.waitForInteraction('cthulhu_madness_unleashed', 10000);

        const promptState = await game.getState();
        expect(promptState.sys.interaction.current.data.multi).toEqual({ min: 0, max: 2 });
        const madnessOptions = (await game.getInteractionOptions()).filter((option: any) => option.value?.cardUid);
        expect(madnessOptions).toHaveLength(2);
        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i });
        const selectAllButton = page.getByRole('button', { name: /^(全选|Select All)$/i });

        await game.screenshot('01-madness-unleashed-prompt', testInfo);

        await expect(selectAllButton).toBeVisible({ timeout: 5000 });
        await selectAllButton.click();
        await expect(confirmButton).toHaveText(/^(确认|Confirm)\s*\(2\)$/i);
        await game.screenshot('01b-madness-unleashed-select-all', testInfo);

        await confirmButton.click();
        await waitForNoInteraction();

        const actionQuota = page.locator('.group\\/action').first();
        const actionQuotaText = await actionQuota.evaluate((node) => node.textContent?.replace(/\s+/g, '') ?? '');
        expect(actionQuotaText).toMatch(/(战术|Action)2/i);
        expect(actionQuotaText).toMatch(/(通用额度|GlobalQuota)2\/3/i);
        expect(actionQuotaText).toMatch(/(含额外行动额度|Includesextraactionquota)\+2/i);
        await game.screenshot('02-after-madness-unleashed-quota', testInfo);

        await dismissSpotlightQueueIfPresent();
        await game.playCard('wizard_mystic_studies');
        await page.waitForTimeout(500);
        await dismissSpotlightQueueIfPresent();
        await game.playCard('wizard_mystic_studies');
        await page.waitForTimeout(500);
        await dismissSpotlightQueueIfPresent();

        const finalState = await game.getState();
        const player0 = finalState.core.players['0'];

        expect(player0.actionsPlayed).toBe(3);
        expect(player0.actionLimit).toBe(3);
        expect(player0.discard.map((card: any) => card.uid).sort()).toEqual([
            'madness-1',
            'madness-2',
            'madness-unleashed',
            'study-1',
            'study-2',
        ]);
        expect(player0.hand.map((card: any) => card.uid).sort()).toEqual([
            'deck-1',
            'deck-2',
            'deck-3',
            'deck-4',
            'deck-5',
            'deck-6',
        ]);

        const finalQuotaText = await actionQuota.evaluate((node) => node.textContent?.replace(/\s+/g, '') ?? '');
        expect(finalQuotaText).toMatch(/(战术|Action)0/i);
        expect(finalQuotaText).toMatch(/(通用额度|GlobalQuota)0\/3/i);
        await game.screenshot('03-after-two-extra-actions', testInfo);
    });
});
