import { test, expect } from '../framework';
import type { Page } from '@playwright/test';

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 5000 });
    const box = await card.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = box.x + (box.width / 2);
    const startY = box.y + (box.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

test.describe('DiceThrone 意不意外卡牌交互', () => {
    test('打出后应进入改骰交互', async ({ page, game }) => {
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
        await dragHandCardToPlay(page, 'card-unexpected');

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            return {
                currentKind: interaction?.kind ?? null,
                allowedDieCount: interaction?.data?.allowedDieIds?.length ?? 0,
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
            currentKind: interaction?.kind ?? null,
            allowedDieCount: interaction?.data?.allowedDieIds?.length ?? 0,
            dtType: interaction?.data?.meta?.dtType ?? null,
            handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            eventTypes: (state?.sys?.eventStream?.entries ?? [])
                .slice(-6)
                .map((entry: any) => entry.event?.type),
        };

        expect(interactionState.currentKind).toBeTruthy();
        expect(interactionState.dtType).toBe('modifyDie');
        expect(interactionState.allowedDieCount).toBeGreaterThan(0);
        expect(interactionState.handIds).not.toContain('card-unexpected');
        expect(interactionState.eventTypes).toContain('CARD_PLAYED');
    });
});
