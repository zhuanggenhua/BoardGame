import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';

function getPlayer(state: any, playerId: '0' | '1') {
    return state.core.players[playerId];
}

async function openHiddenNinjaGame(game: GameTestContext): Promise<void> {
    await game.openTestGame('smashup');
}

async function setupHiddenNinjaMeFirstScene(
    game: GameTestContext,
    options?: {
        hand?: Array<{ uid: string; defId: string; type: 'action' | 'minion' }>;
        baseMinions?: Array<{ uid: string; defId: string; owner: '0' | '1'; controller: '0' | '1'; basePower: number }>;
    },
): Promise<void> {
    const hand = options?.hand ?? [
        { uid: 'hand-hidden-ninja', defId: 'ninja_hidden_ninja', type: 'action' },
        { uid: 'hand-acolyte-a', defId: 'ninja_acolyte', type: 'minion' },
        { uid: 'hand-acolyte-b', defId: 'ninja_acolyte', type: 'minion' },
    ];

    const baseMinions = options?.baseMinions ?? [
        { uid: 'base-buccaneer-a', defId: 'pirate_buccaneer', owner: '0', controller: '0', basePower: 4 },
        { uid: 'base-buccaneer-b', defId: 'pirate_buccaneer', owner: '0', controller: '0', basePower: 4 },
    ];

    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand,
            field: baseMinions.map((minion) => ({
                ...minion,
                baseIndex: 0,
            })),
            factions: ['ninjas', 'pirates'],
        },
        player1: {
            hand: [],
            field: [],
            factions: ['robots', 'aliens'],
        },
        bases: [
            {
                defId: 'base_tortuga',
                breakpoint: 8,
                minions: [],
            },
        ],
        currentPlayer: '0',
        phase: 'scoreBases',
        responseWindow: {
            id: 'me-first-hidden-ninja',
            windowType: 'meFirst',
            sourceId: 'scoreBases',
            responderQueue: ['0', '1'],
            currentResponderIndex: 0,
            passedPlayers: [],
            actionTakenThisRound: false,
            consecutivePassRounds: 0,
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state.sys.phase,
            responseWindow: state.sys.responseWindow?.current?.windowType ?? null,
            currentResponder: state.sys.responseWindow?.current?.responderQueue?.[state.sys.responseWindow?.current?.currentResponderIndex] ?? null,
            hand: getPlayer(state, '0').hand.map((card: any) => card.defId),
            base0Minions: state.core.bases[0].minions.length,
        };
    }).toEqual({
        phase: 'scoreBases',
        responseWindow: 'meFirst',
        currentResponder: '0',
        hand: hand.map((card) => card.defId),
        base0Minions: baseMinions.length,
    });
}

test.describe('便衣忍者跳过与手牌选择', () => {
    test('便衣忍者交互应允许跳过且不额外打出随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await openHiddenNinjaGame(game);
        await setupHiddenNinjaMeFirstScene(game);
        await page.waitForTimeout(2000);

        await game.playCard('ninja_hidden_ninja', { targetBaseIndex: 0 });
        await game.waitForInteraction('ninja_hidden_ninja');

        await expect(page.getByRole('button', { name: /^(跳过|Skip)(?:\s*\(\d+\))?$/i })).toBeVisible();
        await game.screenshot('hidden-ninja-skip-prompt', testInfo);

        await game.skip();

        await expect.poll(async () => {
            const state = await game.getState();
            return state.sys.interaction?.current?.data?.sourceId ?? null;
        }).not.toBe('ninja_hidden_ninja');

        const finalState = await game.getState();
        const base0Minions = finalState.core.bases[0].minions;
        const player0 = getPlayer(finalState, '0');

        expect(base0Minions).toHaveLength(2);
        expect(base0Minions.some((minion: any) => minion.defId === 'ninja_acolyte')).toBe(false);
        expect(player0.hand.map((card: any) => card.defId)).toEqual([
            'ninja_acolyte',
            'ninja_acolyte',
        ]);
        expect(player0.discard.map((card: any) => card.defId)).toContain('ninja_hidden_ninja');

        await game.screenshot('hidden-ninja-skip-after', testInfo);
    });

    test('便衣忍者交互应允许从手牌打出随从到计分基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await openHiddenNinjaGame(game);
        await setupHiddenNinjaMeFirstScene(game, {
            hand: [
                { uid: 'hand-hidden-ninja', defId: 'ninja_hidden_ninja', type: 'action' },
                { uid: 'hand-acolyte-a', defId: 'ninja_acolyte', type: 'minion' },
            ],
        });
        await page.waitForTimeout(2000);

        await game.playCard('ninja_hidden_ninja', { targetBaseIndex: 0 });
        await game.waitForInteraction('ninja_hidden_ninja');
        await game.screenshot('hidden-ninja-play-prompt', testInfo);

        await game.selectOption('hand-0');

        await expect.poll(async () => {
            const state = await game.getState();
            return state.sys.interaction?.current?.data?.sourceId ?? null;
        }).not.toBe('ninja_hidden_ninja');

        const finalState = await game.getState();
        const player0 = getPlayer(finalState, '0');
        const base0Minions = finalState.core.bases[0].minions;

        expect(base0Minions).toHaveLength(3);
        expect(base0Minions.some((minion: any) => minion.defId === 'ninja_acolyte')).toBe(true);
        expect(player0.hand.map((card: any) => card.defId)).toEqual([]);
        expect(player0.discard.map((card: any) => card.defId)).toContain('ninja_hidden_ninja');
        expect(player0.minionsPlayed).toBe(0);

        await game.screenshot('hidden-ninja-play-after', testInfo);
    });
});
