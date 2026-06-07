/**
 * 大杀四方 - 多基地计分简单测试
 */

import { test, expect } from '../framework';

async function openScene(game: any): Promise<void> {
    await game.openTestGame('smashup', { skipInitialization: true });
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            vp: 0,
            factions: ['pirates', 'robots'],
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            vp: 0,
            factions: ['ninjas', 'dinosaurs'],
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    { uid: 'm0', defId: 'test_minion', owner: '0', controller: '0', baseIndex: 0, basePower: 7 },
                    { uid: 'm1', defId: 'test_minion', owner: '1', controller: '1', baseIndex: 0, basePower: 6 },
                ],
            },
            {
                defId: 'base_ninja_dojo',
                breakpoint: 18,
                minions: [
                    { uid: 'm2', defId: 'test_minion', owner: '0', controller: '0', baseIndex: 1, basePower: 10 },
                    { uid: 'm3', defId: 'test_minion', owner: '1', controller: '1', baseIndex: 1, basePower: 9 },
                ],
            },
            {
                defId: 'base_pirate_cove',
                breakpoint: 20,
                minions: [
                    { uid: 'm4', defId: 'test_minion', owner: '0', controller: '0', baseIndex: 2, basePower: 11 },
                    { uid: 'm5', defId: 'test_minion', owner: '1', controller: '1', baseIndex: 2, basePower: 10 },
                ],
            },
        ],
        extra: {
            core: {
                baseDeck: ['base_the_factory', 'base_tar_pits', 'base_mushroom_kingdom'],
                nextUid: 1000,
            },
        },
    });
}

async function selectBaseByDefId(game: any, defId: string): Promise<void> {
    await game.selectInteractionOptionBy(
        (option: any) => option.value?.baseDefId === defId,
        `选择基地 ${defId}`,
    );
}

test.describe('多基地计分简单测试', () => {
    test('两个以上基地同时爆点时，剩余基地不会拖到下个回合才继续结算', async ({ game }, testInfo) => {
        test.setTimeout(90000);
        await openScene(game);

        const initialState = await game.getState();
        expect(initialState.core.bases.map((base: any) => base.defId)).toEqual([
            'base_the_jungle',
            'base_ninja_dojo',
            'base_pirate_cove',
        ]);

        await game.advancePhase();
        await game.waitForInteraction('multi_base_scoring', 15000);
        await game.screenshot('multi-base-first-choice', testInfo);

        await selectBaseByDefId(game, 'base_the_jungle');
        await game.waitForInteraction('multi_base_scoring', 15000);

        await selectBaseByDefId(game, 'base_pirate_cove');
        await game.waitForInteraction('base_pirate_cove', 15000);
        await game.selectOption('skip');
        await game.screenshot('multi-base-after-pirate-cove-skip', testInfo);

        const afterPirateCoveState = await game.getState();
        expect(afterPirateCoveState.sys.phase).toBe('scoreBases');
        expect(afterPirateCoveState.core.currentPlayerIndex).toBe(0);
        expect(afterPirateCoveState.sys.interaction?.current?.data?.sourceId).toBe('smashup_reaction_choose');

        await game.selectInteractionOptionBy(
            (option: any) =>
                option.value?.sourceDefId === 'base_ninja_dojo'
                || option.label === '忍者道场'
                || option.id?.includes('base_ninja_dojo'),
            '选择忍者道场 afterScoring 反应',
        );

        await game.waitForInteraction('base_ninja_dojo', 15000);
        await game.selectOption('skip');
        await game.waitForNoInteraction(15000);

        const finalState = await game.getState();
        expect(finalState.sys.phase).toBe('playCards');
        expect(finalState.core.bases).toHaveLength(3);
        expect(finalState.core.bases[0].defId).not.toBe('base_the_jungle');
        expect(finalState.core.bases[1].defId).not.toBe('base_ninja_dojo');
        expect(finalState.core.bases[2].defId).not.toBe('base_pirate_cove');
        expect(finalState.core.players['0'].vp).toBe(7);
        expect(finalState.core.players['1'].vp).toBe(4);
    });
});
