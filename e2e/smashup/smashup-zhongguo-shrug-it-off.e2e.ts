import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type ShrugItOffState = {
    core: {
        bases: Array<{
            ongoingActions: Array<{ uid: string; talentUsed?: boolean }>;
            minions: Array<{ uid: string }>;
        }>;
        players: Record<string, {
            discard: Array<{ uid: string; defId: string }>;
            actionsPlayed: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 不屑一顾链路', () => {
    test('真实点击不屑一顾后，应压制当前基地能力，让原本受藏身处保护的随从重新进入打到穿越目标列表', async ({ game, page }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', { seat1: 'human' });
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '1',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'knock-card', defId: 'vigilantes_knocked_into_next_week', type: 'action', owner: '1' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_hideout',
                    minions: [
                        {
                            uid: 'protected-ally',
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
                        {
                            uid: 'enemy-on-hideout',
                            defId: 'truckers_good_buddy',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [
                        { uid: 'shrug-live', defId: 'vigilantes_shrug_it_off', ownerId: '1', controllerId: '1', talentUsed: false },
                    ],
                },
                {
                    defId: 'base_funky_town',
                    minions: [
                        {
                            uid: 'outside-target',
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
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('1');

        const shrugCard = page.locator('[data-ongoing-uid="shrug-live"]').first();
        await expect(shrugCard).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-shrug-it-off-ready', testInfo);

        await shrugCard.click({ force: true });
        await game.waitForNoInteraction(10000);
        await game.screenshot('zhongguo-shrug-it-off-suppressed', testInfo);

        await game.playCard('vigilantes_knocked_into_next_week');
        await game.waitForInteraction('vigilantes_knocked_into_next_week', 10000);
        await game.screenshot('zhongguo-shrug-it-off-target-options', testInfo);

        const options = await game.getInteractionOptions();
        const targetUids = options
            .map((option: InteractionOption) => option?.value?.minionUid)
            .filter((uid): uid is string => typeof uid === 'string');

        expect(targetUids).toContain('protected-ally');
        expect(targetUids).toContain('outside-target');

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'protected-ally',
            '打到穿越目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ShrugItOffState;
            return {
                protectedStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'protected-ally'),
                outsideStillOnBase: state.core.bases[1].minions.some(minion => minion.uid === 'outside-target'),
                knockDiscarded: state.core.players['1'].discard.some(card => card.uid === 'knock-card' && card.defId === 'vigilantes_knocked_into_next_week'),
                actionsPlayed: state.core.players['1'].actionsPlayed,
                shrugTalentUsed: state.core.bases[0].ongoingActions.find(action => action.uid === 'shrug-live')?.talentUsed ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            protectedStillOnBase: false,
            outsideStillOnBase: true,
            knockDiscarded: true,
            actionsPlayed: 1,
            shrugTalentUsed: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-shrug-it-off-resolved', testInfo);
    });
});
