/**
 * DiceThrone - 简化的打牌验证测试
 *
 * 目标：快速诊断 PLAY_CARD 正向路由是否进入验证层并成功执行。
 */

import { test, expect } from './framework';
import type { GameTestContext } from './framework';

async function setupPlayCardValidationScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['card-buddha-light'],
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
            hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-buddha-light'),
        };
    }, { timeout: 10000 }).toMatchObject({
        activePlayerId: '0',
        hasCard: true,
    });
}

test.describe('DiceThrone - 打牌验证诊断', () => {
    test('诊断：打牌时的验证日志', async ({ page, game }) => {
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

        await setupPlayCardValidationScene(game);

        const buddhaLightCard = page
            .locator('[data-card-id="card-buddha-light"], [data-card-key^="card-buddha-light-"]')
            .first();
        await expect(buddhaLightCard).toBeVisible({ timeout: 5000 });
        await buddhaLightCard.click();

        await expect.poll(async () => {
            const player0 = await game.getPlayerState('0');
            const player1 = await game.getPlayerState('1');
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

        const hasValidateCommand = consoleLogs.some((log) => log.includes('[validateCommand]'));
        const hasValidatePlayCard = consoleLogs.some((log) => log.includes('[validatePlayCard]'));
        const hasCardNotInHand = consoleLogs.some((log) => log.includes('card_not_in_hand'));

        expect(hasValidateCommand).toBe(true);
        expect(hasValidatePlayCard).toBe(true);
        expect(hasCardNotInHand).toBe(false);

        expect(player0?.hand?.map((card: any) => card.id) ?? []).not.toContain('card-buddha-light');
        expect(player0?.tokens?.taiji ?? 0).toBe(1);
        expect(player0?.tokens?.evasive ?? 0).toBe(1);
        expect(player0?.tokens?.purify ?? 0).toBe(1);
        expect(player0?.resources?.CP ?? player0?.resources?.cp ?? null).toBe(2);
    });
});
