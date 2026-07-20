import { test, expect } from '../framework';
import type { Page } from '@playwright/test';

type BoogieWonderlandState = {
    core: {
        currentPlayerIndex: number;
        bases: Array<{
            minions: Array<{ uid: string; owner: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string }>;
            minionsPlayed: number;
            minionLimit: number;
            baseLimitedMinionQuota?: number[] | Record<number, number>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        phase?: string;
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 摇摆仙境链路', () => {
    test('摇摆仙境应在回合开始立刻给出低战力额外随从机会，并允许把力量 2 随从打到该基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '1',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'truckers'],
                hand: [
                    { uid: 'good-buddy', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                    { uid: 'cab-over-pete', defId: 'truckers_cab_over_pete', type: 'minion', owner: '0' },
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
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_boogie_wonderland',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_hideout',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.advancePhase();

        await game.waitForInteraction('smashup_immediate_extra_minion', 10000);
        await expect.poll(async () => {
            const state = await game.getState() as BoogieWonderlandState;
            return {
                currentPlayerIndex: state.core.currentPlayerIndex,
                phase: state.sys.phase,
                quota: state.core.players['0'].baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: state.core.players['0'].minionsPlayed,
                minionLimit: state.core.players['0'].minionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayerIndex: 0,
            phase: 'startTurn',
            quota: 0,
            minionsPlayed: 0,
            minionLimit: 1,
            interactionOpen: true,
        });

        await game.screenshot('zhongguo-boogie-wonderland-immediate-extra-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option?.value?.cardUid === 'good-buddy' || option?.value?.defId === 'truckers_good_buddy',
            '选择好伙伴作为摇摆仙境额外随从',
        );
        await game.waitForNoInteraction(10000);
        await dismissSpotlightIfPresent(page);

        await expect.poll(async () => {
            const state = await game.getState() as BoogieWonderlandState;
            const player = state.core.players['0'];
            return {
                goodBuddyOnBoogie: state.core.bases[0].minions.some(minion => minion.uid === 'good-buddy' && minion.owner === '0'),
                goodBuddyStillInHand: player.hand.some(card => card.uid === 'good-buddy'),
                quota: player.baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: player.minionsPlayed,
                minionLimit: player.minionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            goodBuddyOnBoogie: true,
            goodBuddyStillInHand: false,
            quota: 0,
            minionsPlayed: 0,
            minionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-boogie-wonderland-extra-minion-resolved', testInfo);
    });
});

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
        await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
        await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
    }
}
