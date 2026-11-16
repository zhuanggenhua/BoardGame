import { test, expect } from '../framework';
import { readLiveState, setupCardiaTestScenario } from '../helpers/cardia';

test('预置出牌阶段：真人出牌后 AI 自主回应并将行动交还真人', async ({ browser }) => {
    test.setTimeout(90000);
    const setup = await setupCardiaTestScenario(browser, {
        player1: { hand: ['deck_i_card_01', 'deck_i_card_02'], deck: ['deck_i_card_03', 'deck_i_card_04'] },
        player2: { hand: ['deck_i_card_05', 'deck_i_card_06'], deck: ['deck_i_card_07', 'deck_i_card_08'] },
        phase: 'play',
        aiSeats: ['1'],
    });
    const page = setup.player1Page;
    try {
        const before = await readLiveState(page);
        const initialEncounterCount = before.core.encounterHistory.length;
        const initialTurn = before.core.turnNumber;
        const handCard = page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
        await expect(handCard).toBeVisible();
        await handCard.click();
        await expect.poll(async () => {
            const state = await readLiveState(page);
            return state.core.encounterHistory.length;
        }, { timeout: 30000, message: '真人出牌后等待 AI 自主完成遭遇' }).toBeGreaterThan(initialEncounterCount);

        const afterEncounter = await readLiveState(page);
        expect(afterEncounter.core.players['0'].playedCards.length).toBeGreaterThan(0);
        expect(afterEncounter.core.players['1'].playedCards.length).toBeGreaterThan(0);
        await expect(page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first()).toBeVisible();
        if (afterEncounter.core.phase === 'ability' && afterEncounter.core.currentEncounter?.loserId === '0') {
            const skip = page.getByTestId('cardia-skip-ability-btn');
            await expect(skip).toBeVisible();
            await skip.click();
        }
        await expect.poll(async () => {
            const state = await readLiveState(page);
            return { phase: state.core.phase, turn: state.core.turnNumber };
        }, { timeout: 30000, message: '等待能力处理后回到真人出牌阶段' }).toMatchObject({
            phase: 'play',
            turn: expect.any(Number),
        });
        const next = await readLiveState(page);
        expect(next.core.turnNumber).toBeGreaterThan(initialTurn);
        await expect(page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first()).toBeVisible();
    } finally {
        await setup.cleanup();
    }
});
