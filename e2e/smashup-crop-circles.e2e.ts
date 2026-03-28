/**
 * SmashUp - 麦田怪圈 E2E 测试
 */

import { test, expect } from './framework';

const SMASHUP_CROP_CIRCLES_QUERY = {
    p0: 'aliens,pirates',
    p1: 'robots,zombies',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

const SMASHUP_BLOCK_THE_PATH_QUERY = {
    p0: 'tricksters,innsmouth',
    p1: 'killer_plants,aliens',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

async function openCropCirclesScene(
    game: any,
    config: {
        bases: Array<{
            defId: string;
            minions?: Array<{
                uid: string;
                defId: string;
                owner: string;
                controller: string;
                power: number;
            }>;
        }>;
    },
): Promise<void> {
    await game.openTestGame('smashup', SMASHUP_CROP_CIRCLES_QUERY, 20000);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: ['alien_crop_circles'],
            deck: [],
            discard: [],
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
        bases: config.bases.map((base) => ({
            defId: base.defId,
            minions: (base.minions ?? []).map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                owner: minion.owner,
                controller: minion.controller,
                power: minion.power,
            })),
            ongoingActions: [],
        })),
        currentPlayer: '0',
        phase: 'playCards',
    });
}

async function openBlockThePathScene(game: any): Promise<void> {
    await game.openTestGame('smashup', SMASHUP_BLOCK_THE_PATH_QUERY, 20000);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: ['trickster_block_the_path_pod'],
            deck: [],
            discard: [],
            factions: ['tricksters_pod', 'innsmouth_pod'],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['killer_plants_pod', 'aliens_pod'],
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_jungle', minions: [], ongoingActions: [] },
        ],
        currentPlayer: '0',
        phase: 'playCards',
    });
}

async function waitForNoInteraction(game: any): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return state.sys.interaction?.current?.data?.sourceId ?? null;
    }).toBe(null);
}

function getPlayer(state: any, playerId: '0' | '1'): any {
    return state.core.players[playerId];
}

test.describe('SmashUp - 麦田怪圈', () => {
    test('选择基地后应一次性返回该基地所有随从', async ({ game }, testInfo) => {
        await openCropCirclesScene(game, {
            bases: [
                {
                    defId: 'base_the_mothership',
                    minions: [
                        { uid: 'm1', defId: 'alien_scout', owner: '0', controller: '0', power: 2 },
                        { uid: 'm2', defId: 'pirate_first_mate', owner: '0', controller: '0', power: 2 },
                        { uid: 'm3', defId: 'robot_microbot_alpha', owner: '1', controller: '1', power: 1 },
                    ],
                },
                { defId: 'base_tortuga', minions: [] },
            ],
        });

        await game.playCard('alien_crop_circles');
        await game.waitForInteraction('alien_crop_circles');

        const options = await game.getInteractionOptions();
        expect(options.map((option: any) => option.value?.baseIndex)).toEqual([0]);
        await game.screenshot('crop-circles-single-base-prompt', testInfo);

        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions).toHaveLength(0);
        expect(getPlayer(finalState, '0').hand.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['alien_scout', 'pirate_first_mate']),
        );
        expect(getPlayer(finalState, '1').hand.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['robot_microbot_alpha']),
        );
        expect(getPlayer(finalState, '0').discard.map((card: any) => card.defId)).toContain('alien_crop_circles');

        await game.screenshot('crop-circles-single-base-result', testInfo);
    });

    test('只应返回选中基地的随从，不影响其他基地', async ({ game }, testInfo) => {
        await openCropCirclesScene(game, {
            bases: [
                {
                    defId: 'base_the_mothership',
                    minions: [
                        { uid: 'base0-m1', defId: 'alien_scout', owner: '0', controller: '0', power: 2 },
                    ],
                },
                {
                    defId: 'base_tortuga',
                    minions: [
                        { uid: 'base1-m1', defId: 'pirate_first_mate', owner: '0', controller: '0', power: 2 },
                        { uid: 'base1-m2', defId: 'zombie_walker', owner: '1', controller: '1', power: 2 },
                    ],
                },
            ],
        });

        await game.playCard('alien_crop_circles');
        await game.waitForInteraction('alien_crop_circles');

        const options = await game.getInteractionOptions();
        expect(options.map((option: any) => option.value?.baseIndex)).toEqual([0, 1]);
        await game.screenshot('crop-circles-multi-base-prompt', testInfo);

        await game.selectBase(1);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions).toHaveLength(1);
        expect(finalState.core.bases[0].minions[0].defId).toBe('alien_scout');
        expect(finalState.core.bases[1].minions).toHaveLength(0);
        expect(getPlayer(finalState, '0').hand.map((card: any) => card.defId)).toContain('pirate_first_mate');
        expect(getPlayer(finalState, '1').hand.map((card: any) => card.defId)).toContain('zombie_walker');

        await game.screenshot('crop-circles-selected-base-only', testInfo);
    });

    test('当场上没有随从时不应创建交互', async ({ game }, testInfo) => {
        await openCropCirclesScene(game, {
            bases: [
                { defId: 'base_the_mothership', minions: [] },
                { defId: 'base_tortuga', minions: [] },
            ],
        });

        await game.playCard('alien_crop_circles');
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions).toHaveLength(0);
        expect(finalState.core.bases[1].minions).toHaveLength(0);
        expect(getPlayer(finalState, '0').discard.map((card: any) => card.defId)).toContain('alien_crop_circles');
        expect(getPlayer(finalState, '0').hand).toHaveLength(0);

        await game.screenshot('crop-circles-no-targets', testInfo);
    });
});

test.describe('SmashUp - 通路禁止 POD', () => {
    test('打到基地后应弹出派系封锁选项，并把选择写入基地持续战术', async ({ game }, testInfo) => {
        await openBlockThePathScene(game);

        await game.playCard('trickster_block_the_path_pod', { targetBaseIndex: 0 });
        await game.waitForInteraction('trickster_block_the_path_pod');

        const options = await game.getInteractionOptions();
        const comboOptions = options.filter((option: any) => option?.value?.blocked?.['1']);
        expect(comboOptions).toHaveLength(2);

        const blockedFactions = comboOptions
            .map((option: any) => option?.value?.blocked?.['1'])
            .filter(Boolean)
            .sort();
        expect(blockedFactions).toEqual(['aliens_pod', 'killer_plants_pod'].sort());

        await game.screenshot('block-the-path-prompt', testInfo);

        await game.selectOption(comboOptions[0].id);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const ongoing = finalState.core.bases[0].ongoingActions.find(
            (action: any) => action.defId === 'trickster_block_the_path_pod',
        );

        expect(ongoing).toBeTruthy();
        expect(ongoing.metadata?.blockedFactionsByPlayer).toEqual(comboOptions[0].value.blocked);

        await (game as any).page.waitForTimeout(1500);
        await game.screenshot('block-the-path-resolved', testInfo);
    });
});
