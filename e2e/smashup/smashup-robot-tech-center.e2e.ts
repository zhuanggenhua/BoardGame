import { test, expect } from '../framework';

const ROBOT_TECH_CENTER_QUERY = {
    p0: 'robots,pirates',
    p1: 'ninjas,dinosaurs',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

async function openRobotTechCenterScene(game: any): Promise<void> {
    await game.openTestGame('smashup', ROBOT_TECH_CENTER_QUERY, 20000);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [
                { uid: 'hand-tech-center', defId: 'robot_tech_center', type: 'action', owner: '0' },
            ],
            deck: [
                { uid: 'deck-draw-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                { uid: 'deck-draw-2', defId: 'robot_microbot_guard', type: 'minion', owner: '0' },
                { uid: 'deck-draw-3', defId: 'robot_zapbot', type: 'minion', owner: '0' },
            ],
            discard: [],
            factions: ['robots', 'pirates'],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['ninjas', 'dinosaurs'],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    { uid: 'p0-minion-1', defId: 'robot_microbot_alpha', owner: '0', controller: '0' },
                    { uid: 'p0-minion-2', defId: 'robot_microbot_alpha', owner: '0', controller: '0' },
                    { uid: 'p0-minion-3', defId: 'pirate_first_mate', owner: '0', controller: '0' },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_the_jungle',
                minions: [],
                ongoingActions: [],
            },
        ],
        currentPlayer: '0',
        phase: 'playCards',
    });
}

test.describe('SmashUp Robot Tech Center', () => {
    test('技术中心应通过真实 prompt resolve 按己方随从数抽牌', async ({ page, game }, testInfo) => {
        await openRobotTechCenterScene(game);

        const initialState = await game.getState();
        expect(initialState.core.players['0'].hand.map((card: any) => card.uid)).toEqual(['hand-tech-center']);
        expect(initialState.core.players['0'].deck.map((card: any) => card.uid)).toEqual([
            'deck-draw-1',
            'deck-draw-2',
            'deck-draw-3',
        ]);

        await game.playCard('robot_tech_center');
        await game.waitForInteraction('robot_tech_center', 10000);

        const promptState = await game.getState();
        expect(promptState.sys.interaction.current?.data?.sourceId).toBe('robot_tech_center');

        const options = await game.getInteractionOptions();
        const baseOption = options.find((entry: any) => entry?.value?.baseIndex === 0);
        expect(baseOption, '技术中心交互里未找到基地 0 选项').toBeTruthy();
        expect(options.filter((entry: any) => entry?.value?.baseIndex !== undefined)).toHaveLength(1);

        await game.screenshot('01-tech-center-prompt', testInfo);

        await game.selectOption(baseOption.id);
        await game.waitForNoInteraction(10000);

        await expect(page.locator('[data-card-uid="deck-draw-1"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-uid="deck-draw-2"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-uid="deck-draw-3"]')).toBeVisible({ timeout: 5000 });

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.map((card: any) => card.uid)).toEqual([
            'deck-draw-1',
            'deck-draw-2',
            'deck-draw-3',
        ]);
        expect(finalState.core.players['0'].deck).toHaveLength(0);
        expect(finalState.core.players['0'].discard.map((card: any) => card.uid)).toContain('hand-tech-center');
        expect(finalState.sys.interaction.current ?? null).toBe(null);

        await game.screenshot('02-tech-center-resolved', testInfo);
    });
});
