import { test, expect } from '../framework';

test.describe('SmashUp - zhongguo 我会活下去 afterScoring 链路', () => {
    test('计分后从真实响应窗口打出我会活下去，并把计分基地己方随从返回手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'survive-card', defId: 'disco_dancers_i_will_survive', type: 'action', owner: '0' },
                ],
                factions: ['disco_dancers', 'vigilantes'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['truckers', 'kung_fu_fighters'],
            },
            bases: [
                {
                    defId: 'base_the_jungle',
                    breakpoint: 12,
                    minions: [],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    bases: [
                        {
                            defId: 'base_the_jungle',
                            minions: [
                                {
                                    uid: 'survive-target',
                                    defId: 'disco_dancers_roller',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 8,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'rival-minion',
                                    defId: 'truckers_good_buddy',
                                    owner: '1',
                                    controller: '1',
                                    basePower: 5,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                    ],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        const finishButton = page.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible();
        await finishButton.click();
        await page.waitForTimeout(1000);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const windowType = state?.sys?.responseWindow?.current?.windowType;
                return state?.sys?.phase === 'scoreBases' && (windowType === 'meFirst' || windowType === 'afterScoring');
            },
            { timeout: 10000, polling: 200 },
        );

        for (let attempt = 0; attempt < 4; attempt += 1) {
            const windowType = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.responseWindow?.current?.windowType ?? null;
            });
            if (windowType === 'afterScoring') {
                break;
            }
            if (windowType !== 'meFirst') {
                throw new Error(`推进到 afterScoring 前遇到意外响应窗口: ${windowType}`);
            }
            await expect(page.getByTestId('me-first-pass-button')).toBeVisible({ timeout: 5000 });
            await page.getByTestId('me-first-pass-button').click();
        }

        await game.waitForResponseWindow('afterScoring', 10000);
        await game.screenshot('zhongguo-i-will-survive-after-scoring-window', testInfo);

        await game.playCard('disco_dancers_i_will_survive', { targetBaseIndex: 0 });
        await game.waitForInteraction('disco_dancers_i_will_survive', 10000);
        await game.screenshot('zhongguo-i-will-survive-choose-minion', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option?.value?.minionUid === 'survive-target',
            '我会活下去返回手牌的己方随从',
        );

        for (let attempt = 0; attempt < 6; attempt += 1) {
            const state = await game.getState();
            if (!state.sys.responseWindow?.current && !state.sys.interaction?.current) {
                break;
            }
            if (state.sys.interaction?.current) {
                await page.waitForTimeout(300);
                continue;
            }
            await game.passResponseWindow();
        }
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        const player0Hand = finalState.core.players['0'].hand;
        const scoringBaseMinions = finalState.core.bases[0].minions;

        expect(player0Hand.some((card: any) => card.uid === 'survive-target')).toBe(true);
        expect(scoringBaseMinions.some((minion: any) => minion.uid === 'survive-target')).toBe(false);
        expect(finalState.core.pendingAfterScoringSpecials ?? []).toHaveLength(0);
        expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
        expect(finalState.sys.interaction?.current ?? null).toBeNull();
        expect(finalState.sys.responseWindow?.current ?? null).toBeNull();

        await game.screenshot('zhongguo-i-will-survive-final-state', testInfo);
    });
});
