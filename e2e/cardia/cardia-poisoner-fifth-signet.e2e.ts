import { test, expect } from '../framework';
import { setupCardiaTestScenario } from '../helpers/cardia';
import { getMatchState } from '../helpers/state-injection';

test('预置四枚印戒的在线遭遇：毒师结算前不提前判胜', async ({ browser }) => {
    test.setTimeout(120_000);
    const setup = await setupCardiaTestScenario(browser, {
        resetCurrentCards: true,
        phase: 'play',
        turnNumber: 4,
        player1: {
            hand: ['deck_ii_card_07'], deck: ['deck_ii_card_03'],
            playedCards: [2, 4, 6, 8].map((number, encounterIndex) => ({
                defId: `deck_i_card_${String(number).padStart(2, '0')}`, signets: 1, encounterIndex,
            })),
        },
        player2: { hand: ['deck_ii_card_01'], deck: ['deck_ii_card_04'], playedCards: [] },
    });
    try {
        const { player1Page, player2Page, matchId } = setup;
        const errors: string[] = [];
        player2Page.on('pageerror', error => errors.push(error.message));
        const player1Card = player1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
        const player2Card = player2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
        await expect(player1Card).toBeVisible();
        await expect(player2Card).toBeVisible();
        await player1Card.click();
        await player2Card.click();
        const activate = player2Page.getByTestId('cardia-activate-ability-btn');
        await expect(activate).toBeVisible({ timeout: 15_000 });
        const before = await getMatchState(matchId, player1Page) as any;
        expect(before.sys.phase).toBe('ability');
        expect(before.sys.gameover).toBeUndefined();
        expect(before.core.players['0'].playedCards.reduce((sum: number, card: { signets: number }) => sum + card.signets, 0)).toBe(5);
        await activate.click();
        await expect.poll(async () => {
            const state = await getMatchState(matchId, player1Page) as any;
            return { phase: state.sys.phase, gameover: state.sys.gameover ?? null, signets: state.core.players['0'].playedCards.reduce((sum: number, card: { signets: number }) => sum + card.signets, 0) };
        }, { timeout: 15_000 }).toEqual({ phase: 'play', gameover: null, signets: 4 });
        expect(errors).toEqual([]);
    } finally {
        await setup.cleanup();
    }
});

test('预置四枚印戒的在线遭遇：服务端 AI 可用毒师继续对局', async ({ browser }) => {
    test.setTimeout(120_000);
    const setup = await setupCardiaTestScenario(browser, {
        resetCurrentCards: true, phase: 'play', turnNumber: 4, aiSeats: ['1'],
        player1: {
            hand: ['deck_ii_card_07'], deck: ['deck_ii_card_03'],
            playedCards: [2, 4, 6, 8].map((number, encounterIndex) => ({
                defId: `deck_i_card_${String(number).padStart(2, '0')}`, signets: 1, encounterIndex,
            })),
        },
        player2: { hand: ['deck_ii_card_01'], deck: ['deck_ii_card_04'], playedCards: [] },
    });
    try {
        const { player1Page, matchId } = setup;
        const errors: string[] = [];
        player1Page.on('pageerror', error => errors.push(error.message));
        const card = player1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
        await expect(card).toBeVisible();
        await card.click();
        await expect.poll(async () => {
            const state = await getMatchState(matchId, player1Page) as any;
            return { phase: state.sys.phase, gameover: state.sys.gameover ?? null, signets: state.core.players['0'].playedCards.reduce((sum: number, played: { signets: number }) => sum + played.signets, 0), turn: state.core.turnNumber, poisoned: state.core.modifierTokens.some((token: { source: string }) => token.source === 'ability_ii_poisoner') };
        }, { timeout: 25_000 }).toEqual({ phase: 'play', gameover: null, signets: 4, turn: 5, poisoned: true });
        expect(errors).toEqual([]);
    } finally {
        await setup.cleanup();
    }
});
