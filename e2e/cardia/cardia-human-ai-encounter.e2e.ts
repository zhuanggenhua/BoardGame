import { test, expect } from '../framework';
import { readLiveState, setupCardiaTestScenario } from '../helpers/cardia';
import { getMatchState } from '../helpers/state-injection';

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


test('预置出牌阶段：AI 落败后自主处理能力并交还真人', async ({ browser }) => {
    test.setTimeout(90000);
    const setup = await setupCardiaTestScenario(browser, {
        player1: { hand: ['deck_i_card_15', 'deck_i_card_14'], deck: ['deck_i_card_13'] },
        player2: { hand: ['deck_i_card_01'], deck: ['deck_i_card_02', 'deck_i_card_03'] },
        phase: 'play',
        aiSeats: ['1'],
    });
    const page = setup.player1Page;
    try {
        await expect.poll(async () => {
            const state = await readLiveState(page);
            return state.core.players['0'].hand.map(card => card.defId);
        }, { timeout: 15000, message: '等待预置手牌同步到真人视角' }).toEqual(['deck_i_card_15', 'deck_i_card_14']);
        const before = await readLiveState(page);
        const humanCard = before.core.players['0'].hand[0];
        await page.getByTestId(`card-${humanCard.uid}`).click();
        await expect.poll(async () => {
            const state = await readLiveState(page);
            return state.core.encounterHistory.find(encounter =>
                encounter.player1Card.uid === humanCard.uid || encounter.player2Card.uid === humanCard.uid,
            )?.loserId;
        }, { timeout: 30000 }).toBe('1');
        await expect.poll(async () => {
            const state = await getMatchState(setup.matchId, page);
            return (state.sys?.eventStream?.entries ?? []).some(entry => {
                const event = entry.event as { type?: string; payload?: { playerId?: string } };
                return ['ABILITY_ACTIVATED', 'ABILITY_SKIPPED'].includes(event.type ?? '')
                    && event.payload?.playerId === '1';
            });
        }, { timeout: 30000, message: 'AI 落败后须自行激活或跳过能力' }).toBe(true);
        await expect.poll(async () => {
            const state = await readLiveState(page);
            return state.core.phase === 'play' && state.core.turnNumber > before.core.turnNumber;
        }, { timeout: 30000 }).toBe(true);
        await expect(page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first()).toBeVisible();
    } finally {
        await setup.cleanup();
    }
});

test('真人出牌后 AI 伏击者选择派系并弃掉对应手牌', async ({ browser }) => {
    test.setTimeout(90000);
    const setup = await setupCardiaTestScenario(browser, {
        player1: { hand: ['deck_i_card_15', 'deck_i_card_02', 'deck_i_card_03', 'deck_i_card_04', 'deck_i_card_05'], deck: ['deck_i_card_14'], playedCards: [] },
        player2: { hand: ['deck_i_card_09'], deck: ['deck_i_card_01', 'deck_i_card_06'], playedCards: [] },
        phase: 'play',
        aiSeats: ['1'],
        resetCurrentCards: true,
    });
    const page = setup.player1Page;
    try {
        await expect.poll(async () => (await readLiveState(page)).core.players['0'].hand.map(card => card.defId))
            .toEqual(['deck_i_card_15', 'deck_i_card_02', 'deck_i_card_03', 'deck_i_card_04', 'deck_i_card_05']);
        const before = await readLiveState(page);
        const humanCard = before.core.players['0'].hand[0];
        await page.getByTestId(`card-${humanCard.uid}`).click();
        let selectedFaction = '';
        await expect.poll(async () => {
            const state = await getMatchState(setup.matchId, page);
            const events = (state.sys?.eventStream?.entries ?? []).map(entry => entry.event as {
                type?: string; payload?: { playerId?: string; sourceId?: string; value?: { faction?: string } };
            });
            selectedFaction = events.find(event => event.type === 'SYS_INTERACTION_RESOLVED'
                && event.payload?.playerId === '1'
                && event.payload.sourceId === 'ability_i_ambusher')?.payload?.value?.faction ?? '';
            return selectedFaction;
        }, { timeout: 30000, message: '等待 AI 激活伏击者并选择派系' }).not.toBe('');
        await expect.poll(async () => {
            const state = await readLiveState(page);
            return state.core.phase === 'play' && state.core.turnNumber > before.core.turnNumber;
        }, { timeout: 30000 }).toBe(true);
        const after = await readLiveState(page);
        const remaining = new Set(after.core.players['0'].hand.map(card => card.uid));
        const originalCards = before.core.players['0'].hand.slice(1);
        expect(originalCards.some(card => card.faction === selectedFaction)).toBe(true);
        for (const card of originalCards) {
            expect(remaining.has(card.uid), `伏击者选择 ${selectedFaction} 后的 ${card.defId}`).toBe(card.faction !== selectedFaction);
        }
        await expect(page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first()).toBeVisible();
    } finally {
        await setup.cleanup();
    }
});
