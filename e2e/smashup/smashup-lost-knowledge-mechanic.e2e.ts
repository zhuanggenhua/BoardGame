import { test, expect } from '../framework';
import { MADNESS_CARD_DEF_ID } from '../../src/games/smashup/domain/types';

test.describe('SmashUp - 通往超凡的门与机械师', () => {
    test('通往超凡的门：点击基地持续天赋后，应抽疯狂并允许在该基地额外打出一名随从', async ({ game, page }, testInfo) => {
        test.setTimeout(60000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['miskatonic_university', 'robots'],
                hand: [
                    { uid: 'extra-warbot', defId: 'robot_warbot', type: 'minion', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['steampunks', 'pirates'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_factory',
                    minions: [
                        { uid: 'anchor-bot', defId: 'robot_nukebot', owner: '0', controller: '0' },
                    ],
                    ongoingActions: [
                        { uid: 'lost-knowledge-1', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false },
                    ],
                },
                { defId: 'base_the_factory' },
                { defId: 'base_great_library' },
            ],
            extra: {
                core: {
                    madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
                },
            },
        });

        const lostKnowledgeCard = page.locator('[data-ongoing-uid="lost-knowledge-1"]');
        await expect(lostKnowledgeCard).toBeVisible({ timeout: 15000 });
        await game.screenshot('lost-knowledge-ready', testInfo);

        await lostKnowledgeCard.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                talentUsed: state.core.bases[0].ongoingActions.find((action: any) => action.uid === 'lost-knowledge-1')?.talentUsed ?? false,
                madnessInHand: state.core.players['0'].hand.filter((card: any) => card.defId === MADNESS_CARD_DEF_ID).length,
                quota: state.core.players['0'].baseLimitedMinionQuota?.[0] ?? 0,
            };
        }, { timeout: 8000 }).toEqual({
            talentUsed: true,
            madnessInHand: 1,
            quota: 1,
        });

        await game.screenshot('lost-knowledge-talent-used', testInfo);

        await game.playCard('robot_warbot', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                onBase: state.core.bases[0].minions.some((minion: any) => minion.uid === 'extra-warbot'),
                stillInHand: state.core.players['0'].hand.some((card: any) => card.uid === 'extra-warbot'),
                quota: state.core.players['0'].baseLimitedMinionQuota?.[0] ?? 0,
            };
        }, { timeout: 8000 }).toEqual({
            onBase: true,
            stillInHand: false,
            quota: 0,
        });

        await game.screenshot('lost-knowledge-extra-minion-resolved', testInfo);
    });

    test('机械师：真实点击弃牌候选和工坊基地后，应把持续行动附着到指定的 base_the_workshop', async ({ game, page }, testInfo) => {
        test.setTimeout(60000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['steampunks', 'minions_of_cthulhu'],
                hand: [
                    { uid: 'mechanic-1', defId: 'steampunk_mechanic', type: 'minion', owner: '0' },
                ],
                deck: [],
                discard: [
                    { uid: 'discard-ritual', defId: 'cthulhu_complete_the_ritual', type: 'action', owner: '0' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'ghosts'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                { defId: 'base_inventors_salon' },
                {
                    defId: 'base_the_workshop',
                    minions: [
                        { uid: 'ally-mid', defId: 'steampunk_steam_man', owner: '0', controller: '0' },
                    ],
                },
                { defId: 'base_great_library' },
            ],
        });

        await game.playCard('steampunk_mechanic', { targetBaseIndex: 0 });
        await game.waitForInteraction('steampunk_mechanic');
        await game.screenshot('mechanic-discard-choice', testInfo);

        const discardOptions = await game.getInteractionOptions();
        const discardOption = discardOptions.find((option: any) => option?.value?.cardUid === 'discard-ritual');
        expect(discardOption, '机械师未展示弃牌堆中的完成仪式').toBeTruthy();

        const discardCard = page.locator(`[data-option-id="${discardOption.id}"]`);
        await expect(discardCard).toBeVisible({ timeout: 5000 });
        await discardCard.click();

        await game.waitForInteraction('steampunk_mechanic_target');
        await game.screenshot('mechanic-base-choice', testInfo);

        const baseOptions = await game.getInteractionOptions();
        expect(baseOptions.map((option: any) => option?.value?.baseIndex)).toEqual([0, 1]);
        expect(baseOptions.find((option: any) => option?.value?.baseIndex === 1)?.value?.baseDefId).toBe('base_the_workshop');

        const middleBaseZone = page.locator('[data-base-index="1"]').first();
        await expect(middleBaseZone).toBeVisible({ timeout: 5000 });
        await middleBaseZone.click();

        await game.waitForNoInteraction();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                mechanicOnBase0: state.core.bases[0].minions.some((minion: any) => minion.uid === 'mechanic-1'),
                base1DefId: state.core.bases[1].defId,
                ritualOnBase1: state.core.bases[1].ongoingActions.some((action: any) => action.uid === 'discard-ritual'),
                stillInDiscard: state.core.players['0'].discard.some((card: any) => card.uid === 'discard-ritual'),
            };
        }, { timeout: 8000 }).toEqual({
            mechanicOnBase0: true,
            base1DefId: 'base_the_workshop',
            ritualOnBase1: true,
            stillInDiscard: false,
        });

        await game.screenshot('mechanic-middle-base-resolved', testInfo);
    });
});
