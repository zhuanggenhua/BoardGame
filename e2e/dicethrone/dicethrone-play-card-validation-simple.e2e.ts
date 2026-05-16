/**
 * DiceThrone - 简化的打牌验证测试
 *
 * 目标：快速诊断 PLAY_CARD 正向路由是否进入验证层并成功执行。
 */

import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import type { Page } from '@playwright/test';

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

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 5000 });
    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
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
        await dragHandCardToPlay(page, 'card-buddha-light');

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
