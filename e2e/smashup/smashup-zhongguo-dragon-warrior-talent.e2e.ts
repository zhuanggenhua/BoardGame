import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type DragonWarriorState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                powerCounters?: number;
                talentUsed?: boolean;
            }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 神龙武者天赋链路', () => {
    test('真实点击神龙武者后，应转移指定数量的力量指示物并完成结算清理', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_ancient_dojo',
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
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'source',
                            defId: 'truckers_good_buddy',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 2,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_tournament_site',
                    minions: [
                        {
                            uid: 'target',
                            defId: 'vigilantes_jacky_bill',
                            owner: '0',
                            controller: '0',
                            basePower: 4,
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
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const dragonWarrior = page.locator('[data-minion-uid="dragon"]').first();
        await expect(dragonWarrior).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-dragon-warrior-ready', testInfo);

        await dragonWarrior.click({ force: true });

        await game.waitForInteraction('kung_fu_counter_transfer_source', 10000);
        await game.screenshot('zhongguo-dragon-warrior-source', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'source',
            '神龙武者标记来源随从',
        );

        await game.waitForInteraction('kung_fu_counter_transfer_target', 10000);
        await game.screenshot('zhongguo-dragon-warrior-target', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '神龙武者标记接收随从',
        );

        await game.waitForInteraction('kung_fu_counter_transfer_amount', 10000);
        const slider = page.getByLabel(/slider-choice|滑杆选择/i);
        await expect(slider).toBeVisible();
        await slider.evaluate((element) => {
            const input = element as HTMLInputElement;
            input.value = '2';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await game.screenshot('zhongguo-dragon-warrior-amount', testInfo);

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const interaction = state?.sys?.interaction?.current;
            if (!interaction?.playerId) {
                throw new Error('当前没有可响应的数量选择交互');
            }
            harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: interaction.playerId,
                payload: { optionId: 'confirm-transfer', mergedValue: { amount: 2, value: 2 } },
            });
        });
        await page.waitForTimeout(300);
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as DragonWarriorState;
            return {
                sourceCounters: state.core.bases[1]?.minions.find((minion) => minion.uid === 'source')?.powerCounters ?? 0,
                targetCounters: state.core.bases[2]?.minions.find((minion) => minion.uid === 'target')?.powerCounters ?? 0,
                dragonTalentUsed: state.core.bases[0]?.minions.find((minion) => minion.uid === 'dragon')?.talentUsed ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceCounters: 0,
            targetCounters: 2,
            dragonTalentUsed: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-dragon-warrior-resolved', testInfo);
    });
});
