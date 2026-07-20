import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { clickHandCard } from './smashup-helpers';

async function setupHiddenNinjaInteractionScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [
                { uid: 'hand-hidden-ninja', defId: 'ninja_hidden_ninja', type: 'action' },
                { uid: 'hand-tiger-assassin', defId: 'ninja_tiger_assassin', type: 'minion' },
                { uid: 'hand-acolyte', defId: 'ninja_acolyte', type: 'minion' },
            ],
            field: [
                { uid: 'base-buccaneer-a', defId: 'pirate_buccaneer', baseIndex: 0, owner: '0', controller: '0', basePower: 4 },
                { uid: 'base-buccaneer-b', defId: 'pirate_buccaneer', baseIndex: 0, owner: '0', controller: '0', basePower: 4 },
            ],
            factions: ['ninjas', 'pirates'],
        },
        player1: {
            hand: [],
            field: [],
            factions: ['robots', 'zombies'],
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
            id: 'me-first-hidden-ninja-create',
            windowType: 'meFirst',
            sourceId: 'scoreBases',
            responderQueue: ['0', '1'],
            currentResponderIndex: 0,
            passedPlayers: [],
            actionTakenThisRound: false,
            consecutivePassRounds: 0,
        },
    });
}

test.describe('便衣忍者交互创建回归', () => {
    test('在 Me First! 窗口打出便衣忍者后应创建 hand 交互并包含跳过', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await setupHiddenNinjaInteractionScene(game);
        await page.waitForTimeout(2000);

        await game.playCard('ninja_hidden_ninja', { targetBaseIndex: 0 });
        await game.waitForInteraction('ninja_hidden_ninja');

        const options = await game.getInteractionOptions();
        const optionIds = options.map((option: any) => option.id);
        const displayModes = options.map((option: any) => option.displayMode);

        expect(optionIds).toEqual(expect.arrayContaining(['hand-0', 'hand-1', 'skip']));
        expect(displayModes).toEqual(expect.arrayContaining(['card', 'button']));

        const state = await game.getState();
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('ninja_hidden_ninja');
        expect(state.sys.interaction?.current?.data?.targetType).toBe('hand');
        expect(state.sys.interaction?.current?.data?.options).toHaveLength(3);

        await game.screenshot('hidden-ninja-interaction-created', testInfo);
    });

    test('便衣忍者交互应允许选择非影舞者的其他随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-hidden-ninja', defId: 'ninja_hidden_ninja', type: 'action' },
                    { uid: 'hand-acolyte', defId: 'ninja_acolyte', type: 'minion' },
                    { uid: 'hand-pirate', defId: 'pirate_first_mate', type: 'minion' },
                ],
                field: [
                    { uid: 'base-buccaneer-a', defId: 'pirate_buccaneer', baseIndex: 0, owner: '0', controller: '0', basePower: 4 },
                    { uid: 'base-buccaneer-b', defId: 'pirate_buccaneer', baseIndex: 0, owner: '0', controller: '0', basePower: 4 },
                ],
                factions: ['ninjas', 'pirates'],
            },
            player1: {
                hand: [],
                field: [],
                factions: ['robots', 'zombies'],
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
                id: 'me-first-hidden-ninja-number-player-id',
                windowType: 'meFirst',
                sourceId: 'scoreBases',
                responderQueue: ['0', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
                actionTakenThisRound: false,
                consecutivePassRounds: 0,
            },
        });

        await game.playCard('ninja_hidden_ninja', { targetBaseIndex: 0 });
        await game.waitForInteraction('ninja_hidden_ninja');

        const spotlightQueue = page.getByTestId('card-spotlight-queue');
        if (await spotlightQueue.isVisible().catch(() => false)) {
            await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
            await page.waitForTimeout(200);
        }

        await game.screenshot('hidden-ninja-other-minion-prompt', testInfo);

        await clickHandCard(page, 1);

        await expect.poll(async () => {
            const state = await game.getState();
            return state.sys.interaction?.current?.data?.sourceId ?? null;
        }).not.toBe('ninja_hidden_ninja');

        const finalState = await game.getState();
        const player0 = finalState.core.players['0'];
        const base0Minions = finalState.core.bases[0].minions;

        expect(base0Minions).toHaveLength(3);
        expect(base0Minions.some((minion: any) => minion.defId === 'pirate_first_mate')).toBe(true);
        expect(player0.hand.map((card: any) => card.defId)).toEqual(['ninja_acolyte']);
        expect(player0.discard.map((card: any) => card.defId)).toContain('ninja_hidden_ninja');

        await game.screenshot('hidden-ninja-other-minion-after', testInfo);
    });
});
