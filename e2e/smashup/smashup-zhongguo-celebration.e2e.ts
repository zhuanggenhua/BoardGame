import { test, expect } from '../framework';

async function dismissSpotlightIfPresent(page: import('@playwright/test').Page): Promise<void> {
    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
        await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
        await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
    }
}

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type CelebrationState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            actionsPlayed: number;
            actionLimit: number;
            vp: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 庆祝链路', () => {
    test('打出庆祝后，应获得两次可实际消费的额外战术额度', async ({ game, page }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'truckers'],
                hand: [
                    { uid: 'celebration-1', defId: 'disco_dancers_celebration', type: 'action', owner: '0' },
                    { uid: 'last-dance-a', defId: 'disco_dancers_last_dance', type: 'action', owner: '0' },
                    { uid: 'last-dance-b', defId: 'disco_dancers_last_dance', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                vp: 0,
            },
            player1: {
                factions: ['vigilantes', 'kung_fu_fighters'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_funky_town',
                    minions: [
                        {
                            uid: 'target-a',
                            defId: 'disco_dancers_roller',
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
                            uid: 'target-b',
                            defId: 'truckers_good_buddy',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
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
        await game.screenshot('zhongguo-celebration-ready', testInfo);

        await game.playCard('disco_dancers_celebration');
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as CelebrationState;
            const player = state.core.players['0'];
            return {
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                handHasA: player.hand.some(card => card.uid === 'last-dance-a'),
                handHasB: player.hand.some(card => card.uid === 'last-dance-b'),
                celebrationDiscarded: player.discard.some(card => card.uid === 'celebration-1' && card.defId === 'disco_dancers_celebration'),
                interactionOpen: Boolean(state.sys.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            actionsPlayed: 1,
            actionLimit: 3,
            handHasA: true,
            handHasB: true,
            celebrationDiscarded: true,
            interactionOpen: false,
        });

        await game.screenshot('zhongguo-celebration-extra-actions-ready', testInfo);
        await dismissSpotlightIfPresent(page);

        await game.playCard('disco_dancers_last_dance');
        await game.waitForInteraction('disco_dancers_last_dance', 10000);
        await game.screenshot('zhongguo-celebration-first-target', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target-a',
            '第一次最后的舞曲目标',
        );
        await game.waitForNoInteraction(10000);
        await dismissSpotlightIfPresent(page);

        await game.playCard('disco_dancers_last_dance');
        await game.waitForInteraction('disco_dancers_last_dance', 10000);
        await game.screenshot('zhongguo-celebration-second-target', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target-b',
            '第二次最后的舞曲目标',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as CelebrationState;
            const player = state.core.players['0'];
            return {
                targetAStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'target-a'),
                targetBStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'target-b'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                vp: player.vp,
                handHasA: player.hand.some(card => card.uid === 'last-dance-a'),
                handHasB: player.hand.some(card => card.uid === 'last-dance-b'),
                celebrationDiscarded: player.discard.some(card => card.uid === 'celebration-1'),
                firstLastDanceDiscarded: player.discard.some(card => card.uid === 'last-dance-a'),
                secondLastDanceDiscarded: player.discard.some(card => card.uid === 'last-dance-b'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetAStillOnBase: false,
            targetBStillOnBase: false,
            actionsPlayed: 3,
            actionLimit: 3,
            vp: 2,
            handHasA: false,
            handHasB: false,
            celebrationDiscarded: true,
            firstLastDanceDiscarded: true,
            secondLastDanceDiscarded: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-celebration-resolved', testInfo);
    });
});
