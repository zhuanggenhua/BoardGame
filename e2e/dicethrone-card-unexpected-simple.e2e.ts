/**
 * DiceThrone "意不意外" 卡牌简化 E2E 测试
 *
 * 目标：验证卡牌能正常打出并创建修改骰子交互。
 */

import { test, expect } from './framework';

test.describe('DiceThrone 意不意外卡牌', () => {
    test('验证卡牌能正常打出', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-unexpected'],
                resources: { CP: 10, HP: 50 },
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
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await game.waitForPhase('offensiveRoll', 10000);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                activePlayerId: state?.core?.activePlayerId ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-unexpected'),
                diceCount: state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            activePlayerId: '0',
            hasCard: true,
            diceCount: 5,
        });

        const unexpectedCard = page
            .locator('[data-card-id="card-unexpected"], [data-card-key^="card-unexpected-"]')
            .first();
        await expect(unexpectedCard).toBeVisible({ timeout: 5000 });
        await unexpectedCard.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            return {
                currentKind: interaction?.kind ?? null,
                optionCount: interaction?.data?.options?.length ?? 0,
                dtType: interaction?.data?.meta?.dtType ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-unexpected'),
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'modifyDie',
            hasCard: false,
        });

        const state = await game.getState();
        const interaction = state?.sys?.interaction?.current;
        const interactionState = {
            handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            currentKind: interaction?.kind ?? null,
            optionCount: interaction?.data?.options?.length ?? 0,
            dtType: interaction?.data?.meta?.dtType ?? null,
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
});
