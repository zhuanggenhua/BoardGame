import { test, expect } from '../framework';

type InteractionOptionValue = {
    mode?: string;
    minionUid?: string;
    actionUid?: string;
};

type InteractionOption = {
    value?: InteractionOptionValue;
};

type HarnessState = {
    sys?: {
        phase?: string;
        responseWindow?: { current?: { windowType?: string } | null };
        interaction?: { current?: unknown } | null;
    };
    core: {
        bases: Array<{
            ongoingActions: Array<{ uid: string; metadata?: { powerCounters?: number } }>;
            minions: Array<{
                uid: string;
                powerCounters?: number;
                metadata?: {
                    mythicHorsesSeastarExtraTalent?: boolean;
                    mythicHorsesSeastarExtraTalentConsumed?: boolean;
                };
            }>;
        }>;
        pendingAfterScoringSpecials?: unknown[];
        triggerQueue?: unknown[];
    };
};

test.describe('SmashUp - zhongguo 掌握时机 beforeScoring 链路', () => {
    test('计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'expert-card', defId: 'kung_fu_fighters_expert_timing', type: 'action', owner: '0' },
                ],
                factions: ['kung_fu_fighters', 'vigilantes'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['truckers', 'disco_dancers'],
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
                                    uid: 'dragon',
                                    defId: 'kung_fu_fighters_dragon_warrior',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 5,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: true,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'receiver',
                                    defId: 'kung_fu_fighters_cricket',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 2,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'rival',
                                    defId: 'truckers_good_buddy',
                                    owner: '1',
                                    controller: '1',
                                    basePower: 18,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [
                                {
                                    uid: 'art-1',
                                    defId: 'kung_fu_fighters_ancient_chinese_art',
                                    ownerId: '0',
                                    talentUsed: false,
                                    metadata: { powerCounters: 2 },
                                },
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
                const state = (window as unknown as {
                    __BG_TEST_HARNESS__?: { state?: { get?: () => HarnessState | undefined } };
                }).__BG_TEST_HARNESS__?.state?.get?.();
                const windowType = state?.sys?.responseWindow?.current?.windowType;
                return state?.sys?.phase === 'scoreBases' && windowType === 'meFirst';
            },
            { timeout: 10000, polling: 200 },
        );

        const meFirstVisible = await page.getByTestId('me-first-overlay').isVisible().catch(() => false);
        if (meFirstVisible) {
            await expect(page.getByTestId('me-first-pass-button')).toBeVisible();
        } else {
            await expect(page.getByText(/选择一个反应动作|Choose a reaction/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /掌握时机|Expert Timing/i })).toBeVisible();
            await expect(page.getByRole('button', { name: /让过|Pass|Skip/i })).toBeVisible();
        }
        await game.screenshot('zhongguo-expert-timing-before-scoring-window', testInfo);

        await game.playCard('kung_fu_fighters_expert_timing');
        await game.waitForInteraction('kung_fu_fighters_expert_timing_mode', 10000);
        await game.screenshot('zhongguo-expert-timing-mode', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.mode === 'both',
            '掌握时机选择两者都做',
        );

        await game.waitForInteraction('kung_fu_fighters_expert_timing_talent', 10000);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.minionUid === 'dragon',
            '掌握时机额外天赋目标',
        );

        await game.waitForInteraction('kung_fu_fighters_expert_timing_source', 10000);
        await game.screenshot('zhongguo-expert-timing-source', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.actionUid === 'art-1',
            '掌握时机标记来源牌',
        );

        await game.waitForInteraction('kung_fu_fighters_expert_timing_target', 10000);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.minionUid === 'receiver',
            '掌握时机标记接收者',
        );

        await expect(page.getByTestId('su-minion-extra-talent-badge-dragon')).toBeVisible();

        await game.screenshot('zhongguo-expert-timing-resolved-before-pass', testInfo);

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
        const scoringBase = finalState.core.bases[0];
        const ancientChineseArt = scoringBase.ongoingActions.find((action: { uid: string }) => action.uid === 'art-1');
        const receiver = scoringBase.minions.find((minion: { uid: string }) => minion.uid === 'receiver');
        const dragon = scoringBase.minions.find((minion: { uid: string }) => minion.uid === 'dragon');

        expect(ancientChineseArt?.metadata?.powerCounters).toBe(0);
        expect(receiver?.powerCounters).toBe(2);
        expect(dragon?.metadata).toMatchObject({
            mythicHorsesSeastarExtraTalent: true,
            mythicHorsesSeastarExtraTalentConsumed: false,
        });
        expect(finalState.core.pendingAfterScoringSpecials ?? []).toHaveLength(0);
        expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
        expect(finalState.sys.interaction?.current ?? null).toBeNull();
        expect(finalState.sys.responseWindow?.current ?? null).toBeNull();

        await expect(page.getByTestId('su-minion-extra-talent-badge-dragon')).toBeVisible();

        await game.screenshot('zhongguo-expert-timing-final-state', testInfo);
    });
});
