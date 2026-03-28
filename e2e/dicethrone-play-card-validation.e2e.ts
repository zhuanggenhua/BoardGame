import type { Page } from '@playwright/test';
import { test, expect } from './framework';
import type { GameTestContext } from './framework';

async function setupPlayCardValidationScene(
    page: Page,
    game: GameTestContext,
    options?: {
        hand?: string[];
    },
): Promise<void> {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: options?.hand ?? ['card-buddha-light'],
            resources: { CP: 5, HP: 50 },
            tokens: { taiji: 0, evasive: 0, purify: 0 },
        },
        player1: {
            resources: { HP: 50 },
            tokens: { knockdown: 0 },
        },
        currentPlayer: '0',
        phase: 'main1',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            hostStarted: true,
        },
    });

    await game.waitForPhase('main1', 10000);
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            activePlayerId: state?.core?.activePlayerId ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        activePlayerId: '0',
    });
}

test.describe('DiceThrone - 打牌验证', () => {
    test('手牌中的合法卡牌应通过验证并成功执行', async ({ page, game }) => {
        const consoleLogs: string[] = [];
        page.on('console', (msg) => {
            const text = msg.text();
            if (
                text.includes('[validateCommand]')
                || text.includes('[validatePlayCard]')
                || text.includes('card_not_in_hand')
            ) {
                consoleLogs.push(text);
            }
        });

        await setupPlayCardValidationScene(page, game);

        const buddhaLightCard = page
            .locator('[data-card-id="card-buddha-light"], [data-card-key^="card-buddha-light-"]')
            .first();
        await expect(buddhaLightCard).toBeVisible({ timeout: 5000 });
        await buddhaLightCard.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state?.core?.players?.['0'];
            const player1 = state?.core?.players?.['1'];
            return {
                handIds: player0?.hand?.map((card: any) => card.id) ?? [],
                tokens: player0?.tokens ?? {},
                cp: player0?.resources?.CP ?? player0?.resources?.cp ?? null,
                opponentKnockdown: player1?.statuses?.knockdown ?? player1?.tokens?.knockdown ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            handIds: [],
            tokens: {
                taiji: 1,
                evasive: 1,
                purify: 1,
            },
            cp: 2,
            opponentKnockdown: 1,
        });

        const player0 = await game.getPlayerState('0');
        const player1 = await game.getPlayerState('1');
        const finalState = {
            handIds: player0?.hand?.map((card: any) => card.id) ?? [],
            tokens: player0?.tokens ?? {},
            cp: player0?.resources?.CP ?? player0?.resources?.cp ?? null,
            opponentKnockdown: player1?.statuses?.knockdown ?? player1?.tokens?.knockdown ?? null,
        };

        expect(consoleLogs.some((log) => log.includes('[validateCommand]'))).toBe(true);
        expect(consoleLogs.some((log) => log.includes('[validatePlayCard]'))).toBe(true);
        expect(consoleLogs.some((log) => log.includes('card_not_in_hand'))).toBe(false);

        expect(finalState.handIds).not.toContain('card-buddha-light');
        expect(finalState.tokens.taiji ?? 0).toBe(1);
        expect(finalState.tokens.evasive ?? 0).toBe(1);
        expect(finalState.tokens.purify ?? 0).toBe(1);
        expect(finalState.cp).toBe(2);
        expect(finalState.opponentKnockdown ?? 0).toBe(1);
    });

    test('不在手牌中的卡牌应命中 card_not_in_hand 校验', async ({ page, game }) => {
        const consoleLogs: string[] = [];
        page.on('console', (msg) => {
            const text = msg.text();
            if (
                text.includes('[validateCommand]')
                || text.includes('[validatePlayCard]')
                || text.includes('card_not_in_hand')
            ) {
                consoleLogs.push(text);
            }
        });

        await setupPlayCardValidationScene(page, game, { hand: [] });

        await page.evaluate(() => {
            (window as any).__BG_TEST_HARNESS__?.command?.dispatch?.({
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: 'non-existent-card-id' },
                timestamp: Date.now(),
            });
        });
        await expect.poll(
            () => ({
                hasValidateCommand: consoleLogs.some((log) => log.includes('[validateCommand]')),
                hasValidatePlayCard: consoleLogs.some((log) => log.includes('[validatePlayCard]')),
                hasCardNotInHand: consoleLogs.some((log) => log.includes('card_not_in_hand')),
            }),
            { timeout: 2000 },
        ).toMatchObject({
            hasValidateCommand: true,
            hasValidatePlayCard: true,
            hasCardNotInHand: true,
        });

        expect(consoleLogs.some((log) => log.includes('[validateCommand]'))).toBe(true);
        expect(consoleLogs.some((log) => log.includes('[validatePlayCard]'))).toBe(true);
        expect(consoleLogs.some((log) => log.includes('card_not_in_hand'))).toBe(true);

        const player0 = await game.getPlayerState('0');
        const finalHand = player0?.hand?.map((card: any) => card.id) ?? [];

        expect(finalHand).toEqual([]);
    });
});
