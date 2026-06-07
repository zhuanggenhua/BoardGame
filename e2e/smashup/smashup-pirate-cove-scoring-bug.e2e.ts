/**
 * 海盗湾计分 Bug 复现测试
 */

import { test, expect } from '../framework';

async function openPirateCoveScene(game: any, minions: any[]): Promise<void> {
    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            vp: 12,
            factions: ['pirates', 'robots'],
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            vp: 7,
            factions: ['wizards', 'tricksters'],
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            { defId: 'base_cave_of_shinies', minions: [], ongoingActions: [] },
            { defId: 'base_pirate_cove', minions, ongoingActions: [] },
            { defId: 'base_wizard_academy', minions: [], ongoingActions: [] },
        ],
        extra: {
            core: {
                baseDeck: ['base_the_factory', 'base_tar_pits', 'base_mushroom_kingdom'],
                nextUid: 3000,
            },
        },
    });
}

test.describe('海盗湾计分流程', () => {
    test('海盗湾计分后应该创建移动随从交互', async ({ game }) => {
        test.setTimeout(90000);

        await openPirateCoveScene(game, [
            { uid: 'm1', defId: 'pirate_king', owner: '0', controller: '0', baseIndex: 1, basePower: 5 },
            { uid: 'm2', defId: 'robot_hoverbot', owner: '0', controller: '0', baseIndex: 1, basePower: 3 },
            { uid: 'm3', defId: 'wizard_chronomage', owner: '1', controller: '1', baseIndex: 1, basePower: 3 },
            { uid: 'm4', defId: 'robot_zapbot', owner: '0', controller: '0', baseIndex: 1, basePower: 2 },
            { uid: 'm5', defId: 'robot_zapbot', owner: '0', controller: '0', baseIndex: 1, basePower: 2 },
            { uid: 'm6', defId: 'trickster_brownie', owner: '1', controller: '1', baseIndex: 1, basePower: 4 },
        ]);

        await game.advancePhase();
        await game.waitForInteraction('base_pirate_cove', 15000);

        const state = await game.getState();
        const interaction = state.sys.interaction?.current;
        expect(interaction?.data?.sourceId).toBe('base_pirate_cove');
        expect(interaction?.playerId).toBe('1');

        await game.selectOption('skip');
        await game.waitForNoInteraction(15000);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].vp).toBeGreaterThan(12);
        expect(finalState.sys.interaction?.current).toBeUndefined();
    });

    test('海盗湾计分后移动随从不应该重复触发计分', async ({ game }) => {
        test.setTimeout(90000);

        await openPirateCoveScene(game, [
            { uid: 'm1', defId: 'pirate_king', owner: '0', controller: '0', baseIndex: 1, basePower: 5 },
            { uid: 'm2', defId: 'robot_hoverbot', owner: '0', controller: '0', baseIndex: 1, basePower: 3 },
            { uid: 'm3', defId: 'wizard_chronomage', owner: '1', controller: '1', baseIndex: 1, basePower: 3 },
            { uid: 'm4', defId: 'robot_zapbot', owner: '0', controller: '0', baseIndex: 1, basePower: 3 },
            { uid: 'm5', defId: 'trickster_brownie', owner: '1', controller: '1', baseIndex: 1, basePower: 3 },
        ]);

        await game.advancePhase();
        await game.waitForInteraction('base_pirate_cove', 15000);

        const firstOptions = await game.getInteractionOptions();
        const moveOption = firstOptions.find((option: any) => option.id !== 'skip');
        expect(moveOption).toBeTruthy();
        await game.selectOption(moveOption.id);

        await game.waitForInteraction('base_pirate_cove_choose_base', 15000);
        const baseOptions = await game.getInteractionOptions();
        const destination = baseOptions.find((option: any) => option.value?.baseIndex !== 1);
        expect(destination).toBeTruthy();
        await game.selectOption(destination.id);
        await game.waitForNoInteraction(15000);

        const finalState = await game.getState();
        const entries = finalState.sys.eventStream?.entries ?? [];
        const baseScoredCount = entries.filter((entry: any) => entry.event?.type === 'su:base_scored').length;
        expect(baseScoredCount).toBe(1);
        expect(finalState.core.players['0'].vp).toBeGreaterThan(12);
        expect(finalState.sys.interaction?.current).toBeUndefined();
        expect(finalState.core.bases).toHaveLength(3);
    });
});
