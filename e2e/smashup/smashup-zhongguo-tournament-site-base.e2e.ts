import { test, expect } from '../framework';

type TournamentSiteState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
        players: Record<string, {
            vp: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        phase?: string;
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
        eventStream?: { entries?: Array<{ event?: { type?: string } }> };
    };
};

test.describe('SmashUp - zhongguo 比赛会场基地链路', () => {
    test('比赛会场在唯一第一名时，应按零战力玩家数给额外 VP', async ({ page, game }, testInfo) => {
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
                vp: 0,
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
                vp: 0,
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_tournament_site',
                    minions: [
                        {
                            uid: 'winner',
                            defId: 'kung_fu_fighters_dragon_warrior',
                            owner: '0',
                            controller: '0',
                            basePower: 19,
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
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-tournament-site-before-scoring', testInfo);

        const finishButton = page.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible();
        await finishButton.click();

        await expect.poll(async () => {
            const state = await game.getState() as TournamentSiteState;
            return {
                player0Vp: state.core.players['0']?.vp ?? 0,
                player1Vp: state.core.players['1']?.vp ?? 0,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 20000 }).toEqual({
            player0Vp: 3,
            player1Vp: 0,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        const vpGainFeedback = page.getByTestId('su-vp-gain-feedback-0');
        await expect(vpGainFeedback).toBeVisible({ timeout: 5000 });
        await expect(vpGainFeedback).toContainText('3');
        await game.screenshot('zhongguo-tournament-site-vp-feedback', testInfo);

        const finalState = await game.getState() as TournamentSiteState;
        const eventTypes = (finalState.sys.eventStream?.entries ?? []).map((entry) => entry.event?.type ?? '');
        expect(eventTypes).toContain('su:base_scored');

        await game.screenshot('zhongguo-tournament-site-final-state', testInfo);
    });
});
