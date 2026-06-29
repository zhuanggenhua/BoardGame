import { test, expect } from '../framework';

type ResponseWindowSnapshot = {
    sys?: {
        phase?: string;
        responseWindow?: { current?: { windowType?: string } | null } | null;
        interaction?: { current?: unknown } | null;
    };
    core: {
        bases: Array<{ minions: Array<{ uid: string }> }>;
        pendingAfterScoringSpecials?: unknown[];
        triggerQueue?: unknown[];
    };
};

type InteractionOption = {
    value?: {
        minionUid?: string;
        baseIndex?: number;
    };
};

test.describe('SmashUp - zhongguo 复仇 afterScoring 链路', () => {
    test('计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'revenge-card', defId: 'vigilantes_the_revenge', type: 'action', owner: '0' },
                ],
                factions: ['vigilantes', 'truckers'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['kung_fu_fighters', 'disco_dancers'],
            },
            bases: [
                {
                    defId: 'base_the_jungle',
                    breakpoint: 12,
                    minions: [],
                },
                {
                    defId: 'base_central_brain',
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
                                    uid: 'revenge-target',
                                    defId: 'vigilantes_shift',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 4,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'winner-minion',
                                    defId: 'truckers_el_bandido',
                                    owner: '1',
                                    controller: '1',
                                    basePower: 9,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                        {
                            defId: 'base_central_brain',
                            minions: [],
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
                const state = (window as { __BG_TEST_HARNESS__?: { state?: { get?: () => ResponseWindowSnapshot } } })
                    .__BG_TEST_HARNESS__?.state?.get?.();
                const windowType = state?.sys?.responseWindow?.current?.windowType;
                return state?.sys?.phase === 'scoreBases' && (windowType === 'meFirst' || windowType === 'afterScoring');
            },
            { timeout: 10000, polling: 200 },
        );

        for (let attempt = 0; attempt < 4; attempt += 1) {
            const windowType = await page.evaluate(() => {
                const state = (window as { __BG_TEST_HARNESS__?: { state?: { get?: () => ResponseWindowSnapshot } } })
                    .__BG_TEST_HARNESS__?.state?.get?.();
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
        await game.screenshot('zhongguo-the-revenge-after-scoring-window', testInfo);

        await game.playCard('vigilantes_the_revenge', { targetBaseIndex: 0 });
        await game.waitForInteraction('vigilantes_the_revenge', 10000);
        await game.screenshot('zhongguo-the-revenge-choose-minion', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'revenge-target',
            '复仇要移动的己方随从',
        );

        await game.waitForInteraction('vigilantes_the_revenge_destination', 10000);
        await game.screenshot('zhongguo-the-revenge-choose-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '复仇移动目标基地',
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
        const scoringBaseMinions = finalState.core.bases[0].minions;
        const destinationBaseMinions = finalState.core.bases[1].minions;

        expect(scoringBaseMinions.some((minion: { uid: string }) => minion.uid === 'revenge-target')).toBe(false);
        expect(destinationBaseMinions.some((minion: { uid: string }) => minion.uid === 'revenge-target')).toBe(true);
        expect(finalState.core.pendingAfterScoringSpecials ?? []).toHaveLength(0);
        expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
        expect(finalState.sys.interaction?.current ?? null).toBeNull();
        expect(finalState.sys.responseWindow?.current ?? null).toBeNull();

        await game.screenshot('zhongguo-the-revenge-final-state', testInfo);
    });
});
