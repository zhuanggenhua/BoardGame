import { test, expect } from '../framework';

test.describe('DiceThrone - 选择骰子修改', () => {
    test('card-play-six 应通过 framework 场景完成改骰到 6', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-play-six'],
                resources: { CP: 2, HP: 50 },
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
                dice: [
                    { id: 0, value: 2, isKept: false },
                    { id: 1, value: 3, isKept: false },
                    { id: 2, value: 4, isKept: false },
                    { id: 3, value: 5, isKept: false },
                    { id: 4, value: 1, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-play-six'),
                diceCount: state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
            diceCount: 5,
        });

        const modifyCard = page
            .locator('[data-card-id="card-play-six"], [data-card-key^="card-play-six-"]')
            .first();
        await expect(modifyCard).toBeVisible({ timeout: 5000 });
        await modifyCard.click();

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                mode: meta?.dieModifyConfig?.mode ?? null,
                targetValue: meta?.dieModifyConfig?.targetValue ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'modifyDie',
            mode: 'set',
            targetValue: 6,
        });

        const dieButton = page.locator('[data-testid="die-button-0"]');
        await expect(dieButton).toBeVisible({ timeout: 5000 });
        await dieButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-6);
            return {
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                lastEventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            firstDie: 6,
            interactionKind: null,
            handIds: [],
        });

        const finalState = await game.getState();
        const finalHandIds = (finalState?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id);
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-6)
            .map((entry: any) => entry.event?.type);

        expect(finalState?.core?.dice?.[0]?.value ?? null).toBe(6);
        expect(finalHandIds).not.toContain('card-play-six');
        expect(finalEventTypes).toContain('CARD_PLAYED');
        expect(finalEventTypes).toContain('DIE_MODIFIED');
    });
});
