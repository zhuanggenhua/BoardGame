import { test, expect } from '../framework';

test.describe('SmashUp - zhongguo 车友聚会 beforeScoring 链路', () => {
    test('计分前从真实响应窗口打出车友聚会，并给己方随从加临时战力', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'rally-card', defId: 'truckers_rally', type: 'action', owner: '0' },
                ],
                factions: ['truckers', 'vigilantes'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['disco_dancers', 'kung_fu_fighters'],
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    bases: [
                        {
                            defId: 'base_the_greasy_spoon',
                            minions: [
                                {
                                    uid: 'truck-target',
                                    defId: 'truckers_good_buddy',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 18,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'truck-rival',
                                    defId: 'disco_dancers_diva',
                                    owner: '1',
                                    controller: '1',
                                    basePower: 8,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [
                                { uid: 'truck-rally-ongoing-1', defId: 'truckers_convoy', ownerId: '0' },
                            ],
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

        const meFirstVisible = await page.getByTestId('me-first-overlay').isVisible().catch(() => false);
        if (meFirstVisible) {
            await expect(page.getByTestId('me-first-pass-button')).toBeVisible();
        }

        await game.playCard('truckers_rally', { targetBaseIndex: 0 });
        await game.waitForInteraction('truckers_rally', 10000);
        await game.screenshot('zhongguo-rally-before-scoring-window', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option?.value?.minionUid === 'truck-target',
            '车友聚会选择己方随从',
        );

        for (let attempt = 0; attempt < 4; attempt += 1) {
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
        const targetMinion = finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'truck-target');

        expect(targetMinion?.tempPowerModifier).toBe(2);
        expect(finalState.core.pendingAfterScoringSpecials ?? []).toHaveLength(0);
        expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
        expect(finalState.sys.interaction?.current ?? null).toBeNull();

        await game.screenshot('zhongguo-rally-before-scoring-final-state', testInfo);
    });
});
