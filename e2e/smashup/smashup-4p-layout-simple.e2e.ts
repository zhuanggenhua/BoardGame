import { test, expect } from '../framework';

const FOUR_PLAYER_TEST_QUERY = {
    numPlayers: 4,
    skipInitialization: true,
} as const;

function buildFourPlayerLayoutScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    { uid: 'm1', defId: 'alien_invader', owner: '0', controller: '0' },
                    { uid: 'm2', defId: 'pirate_first_mate', owner: '0', controller: '0' },
                    { uid: 'm3', defId: 'ninja_shinobi', owner: '1', controller: '1' },
                ],
                ongoingActions: [
                    { uid: 'og1', defId: 'pirate_full_sail', ownerId: '0' },
                ],
            },
            {
                defId: 'base_the_jungle_oasis',
                minions: [
                    { uid: 'm4', defId: 'dino_king_rex', owner: '1', controller: '1' },
                    { uid: 'm5', defId: 'wizard_chronomage', owner: '2', controller: '2' },
                ],
            },
            {
                defId: 'base_the_tar_pits',
                minions: [
                    { uid: 'm6', defId: 'zombie_walker', owner: '2', controller: '2' },
                    { uid: 'm7', defId: 'robot_microbot_alpha', owner: '3', controller: '3' },
                ],
            },
            {
                defId: 'base_the_maze_of_the_minotaur',
                minions: [
                    { uid: 'm8', defId: 'trickster_leprechaun', owner: '3', controller: '3' },
                ],
            },
            {
                defId: 'base_the_temple_of_goju',
                minions: [],
            },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1', '2', '3'],
                turnNumber: 3,
                nextUid: 100,
                baseDeck: ['base_haunted_house', 'base_central_brain'],
                players: {
                    '0': {
                        id: '0',
                        vp: 8,
                        hand: [
                            { uid: 'h0-1', defId: 'alien_invader', type: 'minion', owner: '0' },
                            { uid: 'h0-2', defId: 'alien_scout', type: 'minion', owner: '0' },
                            { uid: 'h0-3', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                            { uid: 'h0-4', defId: 'pirate_full_sail', type: 'action', owner: '0' },
                        ],
                        deck: Array.from({ length: 30 }, (_, index) => ({
                            uid: `d0-${index}`,
                            defId: 'alien_invader',
                            type: 'minion',
                            owner: '0',
                        })),
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['aliens', 'pirates'],
                    },
                    '1': {
                        id: '1',
                        vp: 6,
                        hand: [
                            { uid: 'h1-1', defId: 'ninja_shinobi', type: 'minion', owner: '1' },
                            { uid: 'h1-2', defId: 'ninja_infiltrate', type: 'action', owner: '1' },
                            { uid: 'h1-3', defId: 'dino_king_rex', type: 'minion', owner: '1' },
                        ],
                        deck: Array.from({ length: 30 }, (_, index) => ({
                            uid: `d1-${index}`,
                            defId: 'ninja_shinobi',
                            type: 'minion',
                            owner: '1',
                        })),
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['ninjas', 'dinosaurs'],
                    },
                    '2': {
                        id: '2',
                        vp: 5,
                        hand: [
                            { uid: 'h2-1', defId: 'wizard_chronomage', type: 'minion', owner: '2' },
                            { uid: 'h2-2', defId: 'wizard_arcane_burst', type: 'action', owner: '2' },
                        ],
                        deck: Array.from({ length: 30 }, (_, index) => ({
                            uid: `d2-${index}`,
                            defId: 'wizard_chronomage',
                            type: 'minion',
                            owner: '2',
                        })),
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['wizards', 'zombies'],
                    },
                    '3': {
                        id: '3',
                        vp: 4,
                        hand: [
                            { uid: 'h3-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '3' },
                            { uid: 'h3-2', defId: 'robot_zapbot', type: 'minion', owner: '3' },
                        ],
                        deck: Array.from({ length: 30 }, (_, index) => ({
                            uid: `d3-${index}`,
                            defId: 'robot_microbot_alpha',
                            type: 'minion',
                            owner: '3',
                        })),
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['robots', 'tricksters'],
                    },
                },
            },
        },
    };
}

test.describe('大杀四方四人局布局', () => {
    test('四人局布局基础区域应稳定渲染', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', FOUR_PLAYER_TEST_QUERY, 20000);
        await game.setupScene(buildFourPlayerLayoutScene());

        const scoreboard = page.locator('[data-tutorial-id="su-scoreboard"]');
        const handArea = page.locator('[data-testid="su-hand-area"]');
        const deckStack = page.locator('[data-testid="su-deck-stack"]');
        const discardToggle = page.locator('[data-testid="su-discard-toggle"]');
        const baseSlots = page.locator('[data-base-index]');
        const firstBase = page.locator('[data-base-index="0"]');

        await expect(scoreboard).toBeVisible({ timeout: 15000 });
        await expect(scoreboard).toContainText('你');
        await expect(scoreboard).toContainText('P1');
        await expect(scoreboard).toContainText('P2');
        await expect(scoreboard).toContainText('P3');
        await expect(handArea).toBeVisible({ timeout: 15000 });
        await expect(deckStack).toBeVisible({ timeout: 15000 });
        await expect(discardToggle).toBeVisible({ timeout: 15000 });
        await expect(baseSlots).toHaveCount(5);
        await expect(firstBase).toBeVisible({ timeout: 15000 });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                playerCount: Object.keys(state.core.players).length,
                baseCount: state.core.bases.length,
                handCount: state.core.players['0']?.hand?.length ?? 0,
                turnOrder: state.core.turnOrder,
            };
        }, { timeout: 10000 }).toEqual({
            playerCount: 4,
            baseCount: 5,
            handCount: 4,
            turnOrder: ['0', '1', '2', '3'],
        });

        await game.screenshot('four-player-layout-simple', testInfo);
    });
});
