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
        player1: { hand: ['deck_i_card_15', 'deck_i_card_14'], deck: ['deck_i_card_13'], playedCards: [] },
        player2: { hand: ['deck_i_card_01'], deck: ['deck_i_card_02', 'deck_i_card_03'], playedCards: [] },
        phase: 'play',
        aiSeats: ['1'],
        resetCurrentCards: true,
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
            const encounter = state.core.encounterHistory.find(encounter =>
                encounter.player1Card.uid === humanCard.uid || encounter.player2Card.uid === humanCard.uid,
            );
            return encounter ? { loser: encounter.loserId, human: encounter.player1Card.defId, ai: encounter.player2Card.defId } : null;
        }, { timeout: 30000, message: '确认真人 15 对 AI 1 的遭遇及失败方' }).toEqual({
            loser: '1', human: 'deck_i_card_15', ai: 'deck_i_card_01',
        });
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

for (const scenario of ['已有历史场牌', '首个遭遇仅两张场牌'] as const) {
    test(`真人出牌后 AI 发明家连续选择两张不同牌并交还真人：${scenario}`, async ({ browser }) => {
    test.setTimeout(90000);
    const setup = await setupCardiaTestScenario(browser, {
        player1: {
            hand: ['deck_i_card_16', 'deck_i_card_14'],
            deck: ['deck_i_card_13', 'deck_i_card_12'],
            playedCards: scenario === '已有历史场牌' ? [{ defId: 'deck_i_card_10', signets: 0, encounterIndex: 0 }] : [],
        },
        player2: {
            hand: ['deck_i_card_15'],
            deck: ['deck_i_card_02', 'deck_i_card_03'],
            playedCards: scenario === '已有历史场牌' ? [{ defId: 'deck_i_card_11', signets: 0, encounterIndex: 0 }] : [],
        },
        phase: 'play', aiSeats: ['1'], resetCurrentCards: true,
    });
    const page = setup.player1Page;
    try {
        await expect.poll(async () => (await readLiveState(page)).core.players['0'].hand.map(card => card.defId))
            .toEqual(['deck_i_card_16', 'deck_i_card_14']);
        const before = await readLiveState(page);
        await page.getByTestId(`card-${before.core.players['0'].hand[0].uid}`).click();

        await expect.poll(async () => {
            const state = await getMatchState(setup.matchId, page);
            const core = state.core as typeof before.core;
            const selections = (state.sys?.eventStream?.entries ?? []).map(entry => entry.event as {
                type?: string; payload?: { playerId?: string; sourceId?: string; interactionId?: string };
            }).filter(event => event.type === 'SYS_INTERACTION_RESOLVED'
                && event.payload?.playerId === '1' && event.payload.sourceId === 'ability_i_inventor');
            return {
                phase: core.phase,
                turnAdvanced: core.turnNumber > before.core.turnNumber,
                modifiers: core.modifierTokens.filter(token => token.source === 'ability_i_inventor')
                    .map(token => ({ cardId: token.cardId, value: token.value })).sort((a, b) => a.value - b.value),
                pending: core.inventorPending ?? null,
                selections: new Set(selections.map(event => event.payload?.interactionId)).size,
            };
        }, { timeout: 30000, message: '等待 AI 完成发明家两次选择并进入下一遭遇' }).toMatchObject({
            phase: 'play', turnAdvanced: true,
            modifiers: [{ cardId: expect.any(String), value: -3 }, { cardId: expect.any(String), value: 3 }],
            pending: null, selections: 2,
        });
        const after = await readLiveState(page);
        const modifiers = after.core.modifierTokens.filter(token => token.source === 'ability_i_inventor');
        expect(modifiers[0].cardId).not.toBe(modifiers[1].cardId);
        const field = new Set(Object.values(after.core.players).flatMap(player => player.playedCards.map(card => card.uid)));
        expect(modifiers.every(token => field.has(token.cardId))).toBe(true);
        const nextCard = page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
        await expect(nextCard).toBeVisible();
        await nextCard.click();
        await expect.poll(async () => (await readLiveState(page)).core.players['0'].playedCards.length,
            { timeout: 15000, message: '真人应能在下一遭遇继续出牌' }).toBeGreaterThan(after.core.players['0'].playedCards.length);
    } finally {
        await setup.cleanup();
    }
    });
}

test('首个遭遇：真人发明家先选对手牌，再选自己的发明家', async ({ browser }) => {
    test.setTimeout(90000);
    const setup = await setupCardiaTestScenario(browser, {
        player1: { hand: ['deck_i_card_15', 'deck_i_card_14'], deck: ['deck_i_card_13'] },
        player2: { hand: ['deck_i_card_16'], deck: ['deck_i_card_02', 'deck_i_card_03'] },
        phase: 'play', aiSeats: ['1'], resetCurrentCards: true,
    });
    const page = setup.player1Page;
    try {
        await expect.poll(async () => (await readLiveState(page)).core.players['0'].hand.map(card => card.defId))
            .toEqual(['deck_i_card_15', 'deck_i_card_14']);
        const before = await readLiveState(page);
        const inventorUid = before.core.players['0'].hand[0].uid;
        await page.getByTestId(`card-${inventorUid}`).click();
        const activate = page.getByTestId('cardia-activate-ability-btn');
        await expect(activate).toBeVisible({ timeout: 30000 });
        const encounter = await readLiveState(page);
        expect(encounter.core.players['0'].playedCards).toHaveLength(1);
        expect(encounter.core.players['1'].playedCards).toHaveLength(1);
        const opposingCard = encounter.core.players['1'].playedCards.find(card => card.defId === 'deck_i_card_16');
        expect(opposingCard).toBeDefined();
        await activate.click();
        const modal = page.getByTestId('card-selection-modal');
        await expect(modal).toBeVisible();
        await modal.getByTestId(`card-${opposingCard!.uid}`).click();
        await modal.getByRole('button', { name: /确认/ }).click();
        const inventorCard = modal.getByTestId(`card-${inventorUid}`);
        await expect(inventorCard).toBeVisible({ timeout: 15000 });
        await expect(inventorCard.locator('..')).toBeEnabled();
        await inventorCard.click();
        await modal.getByRole('button', { name: /确认/ }).click();
        await expect.poll(async () => {
            const state = await getMatchState(setup.matchId, page);
            const core = state.core as typeof before.core;
            return core.modifierTokens.filter(token => token.source === 'ability_i_inventor')
                .map(token => ({ cardId: token.cardId, value: token.value })).sort((a, b) => a.value - b.value);
        }, { timeout: 15000 }).toEqual([
            { cardId: inventorUid, value: -3 }, { cardId: opposingCard!.uid, value: 3 },
        ]);
        await expect.poll(async () => {
            const state = await readLiveState(page);
            return { phase: state.core.phase, pending: state.core.inventorPending ?? null };
        }, { timeout: 15000 }).toEqual({ phase: 'play', pending: null });
    } finally {
        await setup.cleanup();
    }
});
