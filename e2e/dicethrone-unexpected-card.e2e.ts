import { test, expect, type GameTestContext } from './framework';

async function setupUnexpectedScene(
    game: GameTestContext,
    options?: {
        cp?: number;
        diceValues?: number[];
    },
): Promise<void> {
    const cp = options?.cp ?? 10;
    const diceValues = options?.diceValues ?? [1, 2, 3, 4, 5];

    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['card-unexpected'],
            resources: { CP: cp, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: false,
            dice: diceValues.map((value, index) => ({
                id: index,
                value,
                isKept: false,
            })),
        },
    });

    await game.waitForPhase('offensiveRoll', 10000);
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            activePlayerId: state?.core?.activePlayerId ?? null,
            hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-unexpected'),
        };
    }, { timeout: 10000 }).toMatchObject({
        activePlayerId: '0',
        hasCard: true,
    });
}

test.describe('DiceThrone - 意不意外卡牌', () => {
    test('应能正常打出并进入改骰交互', async ({ page, game }) => {
        await setupUnexpectedScene(game);

        const unexpectedCard = page
            .locator('[data-card-id="card-unexpected"], [data-card-key^="card-unexpected-"]')
            .first();
        await expect(unexpectedCard).toBeVisible({ timeout: 5000 });
        await unexpectedCard.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            const eventTypes = (state?.sys?.eventStream?.entries ?? [])
                .slice(-6)
                .map((entry: any) => entry.event?.type);
            return {
                currentKind: interaction?.kind ?? null,
                optionCount: interaction?.data?.options?.length ?? 0,
                dtType: interaction?.data?.meta?.dtType ?? null,
                handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
                eventTypes,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'modifyDie',
        });

        const state = await game.getState();
        const interaction = state?.sys?.interaction?.current;
        const interactionState = {
            currentKind: interaction?.kind ?? null,
            optionCount: interaction?.data?.options?.length ?? 0,
            dtType: interaction?.data?.meta?.dtType ?? null,
            handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            eventTypes: (state?.sys?.eventStream?.entries ?? [])
                .slice(-6)
                .map((entry: any) => entry.event?.type),
        };

        expect(interactionState.currentKind).toBeTruthy();
        expect(interactionState.dtType).toBe('modifyDie');
        expect(interactionState.optionCount).toBeGreaterThan(0);
        expect(interactionState.handIds).not.toContain('card-unexpected');
        expect(interactionState.eventTypes).toContain('CARD_PLAYED');
    });

    test('骰子数量不足时不应打出', async ({ page, game }) => {
        await setupUnexpectedScene(game, { diceValues: [1] });

        const unexpectedCard = page
            .locator('[data-card-id="card-unexpected"], [data-card-key^="card-unexpected-"]')
            .first();
        await expect(unexpectedCard).toBeVisible({ timeout: 5000 });
        await unexpectedCard.click();
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
                cp: state?.core?.players?.['0']?.resources?.CP ?? state?.core?.players?.['0']?.resources?.cp ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                diceCount: state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 2000 }).toMatchObject({
            handIds: ['card-unexpected'],
            cp: 10,
            interactionKind: null,
            diceCount: 1,
        });

        const state = await game.getState();
        const finalState = {
            handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            cp: state?.core?.players?.['0']?.resources?.CP ?? state?.core?.players?.['0']?.resources?.cp ?? null,
            interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            diceCount: state?.core?.dice?.length ?? 0,
        };

        expect(finalState.handIds).toContain('card-unexpected');
        expect(finalState.cp).toBe(10);
        expect(finalState.interactionKind).toBeNull();
        expect(finalState.diceCount).toBe(1);
    });

    test('CP 不足时不应打出', async ({ page, game }) => {
        await setupUnexpectedScene(game, {
            cp: 2,
            diceValues: [1, 2],
        });

        const unexpectedCard = page
            .locator('[data-card-id="card-unexpected"], [data-card-key^="card-unexpected-"]')
            .first();
        await expect(unexpectedCard).toBeVisible({ timeout: 5000 });
        await unexpectedCard.click();
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
                cp: state?.core?.players?.['0']?.resources?.CP ?? state?.core?.players?.['0']?.resources?.cp ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            };
        }, { timeout: 2000 }).toMatchObject({
            handIds: ['card-unexpected'],
            cp: 2,
            interactionKind: null,
        });

        const state = await game.getState();
        const finalState = {
            handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            cp: state?.core?.players?.['0']?.resources?.CP ?? state?.core?.players?.['0']?.resources?.cp ?? null,
            interactionKind: state?.sys?.interaction?.current?.kind ?? null,
        };

        expect(finalState.handIds).toContain('card-unexpected');
        expect(finalState.cp).toBe(2);
        expect(finalState.interactionKind).toBeNull();
    });
});
