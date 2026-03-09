/**
 * SmashUp - Wizard Portal 新框架 E2E 试点
 */

import { test, expect } from './framework';

const SMASHUP_PORTAL_QUERY = {
    p0: 'wizards,aliens',
    p1: 'zombies,pirates',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

function getCurrentPlayer(state: any): any {
    const currentPlayerId = state.core.turnOrder[state.core.currentPlayerIndex];
    return state.core.players[currentPlayerId];
}

async function openWizardPortalScene(
    game: any,
    player0: {
        deck: string[];
        discard?: string[];
    },
): Promise<void> {
    await game.openTestGame('smashup', SMASHUP_PORTAL_QUERY, 20000);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: ['wizard_portal'],
            deck: player0.deck,
            discard: player0.discard ?? [],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
        },
        currentPlayer: '0',
        phase: 'playCards',
    });
}

async function selectInteractionOptionByDefId(game: any, defId: string): Promise<void> {
    const options = await game.getInteractionOptions();
    const option = options.find((entry: any) => entry?.value?.defId === defId);
    expect(option, `交互中未找到 defId=${defId} 的选项`).toBeTruthy();
    await game.selectOption(option.id);
}

async function waitForNoInteraction(game: any): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return state.sys.interaction?.current?.data?.sourceId ?? null;
    }).toBe(null);
}

test.describe('SmashUp Wizard Portal（新框架）', () => {
    test('应该能把选中的随从拿到手牌，并按选择顺序放回剩余牌', async ({ game }, testInfo) => {
        await openWizardPortalScene(game, {
            deck: ['alien_invader', 'pirate_cannon', 'pirate_shanghai', 'wizard_apprentice'],
        });

        await game.playCard('wizard_portal');
        await game.waitForInteraction('wizard_portal_pick');

        const pickState = await game.getState();
        expect(pickState.sys.interaction.current.data.multi).toEqual({ min: 0, max: 2 });
        await game.screenshot('01-portal-pick-single', testInfo);

        await selectInteractionOptionByDefId(game, 'alien_invader');
        await game.confirm();

        await game.waitForInteraction('wizard_portal_order');
        await selectInteractionOptionByDefId(game, 'pirate_cannon');
        await game.waitForInteraction('wizard_portal_order');
        await selectInteractionOptionByDefId(game, 'wizard_apprentice');
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const player0 = getCurrentPlayer(finalState);
        expect(player0.hand.map((card: any) => card.defId)).toContain('alien_invader');
        expect(player0.hand.map((card: any) => card.defId)).not.toContain('wizard_portal');
        expect(player0.discard.map((card: any) => card.defId)).toContain('wizard_portal');
        expect(player0.deck.slice(0, 3).map((card: any) => card.defId)).toEqual([
            'pirate_cannon',
            'wizard_apprentice',
            'pirate_shanghai',
        ]);

        await game.screenshot('02-portal-after-single-pick', testInfo);
    });

    test('应该能跳过随从领取，并只重排剩余牌库顶', async ({ game }, testInfo) => {
        await openWizardPortalScene(game, {
            deck: ['alien_invader', 'wizard_apprentice', 'pirate_cannon'],
        });

        await game.playCard('wizard_portal');
        await game.waitForInteraction('wizard_portal_pick');
        await game.screenshot('03-portal-pick-skip', testInfo);

        await game.confirm();

        await game.waitForInteraction('wizard_portal_order');
        await selectInteractionOptionByDefId(game, 'alien_invader');
        await game.waitForInteraction('wizard_portal_order');
        await selectInteractionOptionByDefId(game, 'wizard_apprentice');
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const player0 = getCurrentPlayer(finalState);
        expect(player0.hand.map((card: any) => card.defId)).not.toContain('alien_invader');
        expect(player0.hand.map((card: any) => card.defId)).not.toContain('wizard_apprentice');
        expect(player0.discard.map((card: any) => card.defId)).toContain('wizard_portal');
        expect(player0.deck.slice(0, 3).map((card: any) => card.defId)).toEqual([
            'alien_invader',
            'wizard_apprentice',
            'pirate_cannon',
        ]);

        await game.screenshot('04-portal-after-skip', testInfo);
    });

    test('应该支持多选多个随从加入手牌', async ({ game }, testInfo) => {
        await openWizardPortalScene(game, {
            deck: ['alien_invader', 'wizard_apprentice', 'pirate_cannon', 'pirate_shanghai'],
        });

        await game.playCard('wizard_portal');
        await game.waitForInteraction('wizard_portal_pick');

        const pickState = await game.getState();
        expect(pickState.sys.interaction.current.data.multi).toEqual({ min: 0, max: 2 });
        const pickOptions = await game.getInteractionOptions();
        expect(pickOptions.filter((option: any) => option.value?.defId).length).toBe(2);
        await game.screenshot('05-portal-pick-multi', testInfo);

        await selectInteractionOptionByDefId(game, 'alien_invader');
        await selectInteractionOptionByDefId(game, 'wizard_apprentice');
        await game.confirm();

        await game.waitForInteraction('wizard_portal_order');
        await selectInteractionOptionByDefId(game, 'pirate_shanghai');
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const player0 = getCurrentPlayer(finalState);
        expect(player0.hand.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['alien_invader', 'wizard_apprentice']),
        );
        expect(player0.discard.map((card: any) => card.defId)).toContain('wizard_portal');
        expect(player0.deck.slice(0, 2).map((card: any) => card.defId)).toEqual([
            'pirate_shanghai',
            'pirate_cannon',
        ]);

        await game.screenshot('06-portal-after-multi-pick', testInfo);
    });
});
