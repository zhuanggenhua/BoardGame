import { test, expect } from '../framework';
import type { Page } from '@playwright/test';

type RainingMenState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; owner: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string }>;
            discard: Array<{ defId: string }>;
            minionsPlayed: number;
            minionLimit: number;
            actionsPlayed: number;
            actionLimit: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 男人雨链路', () => {
    test('打出男人雨后，在普通随从额度已用完时仍应允许再打出一个随从', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'truckers'],
                hand: [
                    { uid: 'rain-card', defId: 'disco_dancers_its_raining_men', type: 'action', owner: '0' },
                    { uid: 'extra-minion', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'kung_fu_fighters'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_boogie_wonderland',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_mean_streets',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('disco_dancers_its_raining_men');

        await expect.poll(async () => {
            const state = await game.getState() as RainingMenState;
            const player = state.core.players['0'];
            return {
                handHasExtraMinion: player.hand.some(card => card.uid === 'extra-minion'),
                minionsPlayed: player.minionsPlayed,
                minionLimit: player.minionLimit,
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            handHasExtraMinion: true,
            minionsPlayed: 1,
            minionLimit: 2,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-its-raining-men-extra-minion-ready', testInfo);
        await dismissSpotlightIfPresent(page);

        await game.playCard('truckers_good_buddy', { targetBaseIndex: 1 });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as RainingMenState;
            const player = state.core.players['0'];
            return {
                extraMinionOnBase: state.core.bases[1].minions.some(minion => minion.uid === 'extra-minion' && minion.owner === '0'),
                handStillHasExtraMinion: player.hand.some(card => card.uid === 'extra-minion'),
                discardHasRainingMen: player.discard.some(card => card.defId === 'disco_dancers_its_raining_men'),
                minionsPlayed: player.minionsPlayed,
                minionLimit: player.minionLimit,
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            extraMinionOnBase: true,
            handStillHasExtraMinion: false,
            discardHasRainingMen: true,
            minionsPlayed: 2,
            minionLimit: 2,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-its-raining-men-extra-minion-resolved', testInfo);
    });
});

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
        await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
        await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
    }
}
