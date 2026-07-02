import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';

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

test.describe('DiceThrone - 打牌验证', () => {
    test('点击手牌应只打开放大层，拖拽上抛才真正打出', async ({ page, game }, testInfo) => {
        await setupPlayCardValidationScene(page, game);

        const buddhaLightCard = page
            .locator('[data-card-id="card-buddha-light"], [data-card-key^="card-buddha-light-"]')
            .first();
        await expect(buddhaLightCard).toBeVisible({ timeout: 5000 });

        await buddhaLightCard.click();

        const magnifyOverlay = page.getByTestId('board-magnify-overlay');
        await expect(magnifyOverlay).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            const player0 = await game.getPlayerState('0');
            return player0?.hand?.map((card: any) => card.id) ?? [];
        }, { timeout: 5000 }).toContain('card-buddha-light');
        await game.screenshot('hand-click-magnify-open', testInfo);

        await page.getByRole('button', { name: /关闭预览|close preview/i }).click();
        await expect(magnifyOverlay).toBeHidden({ timeout: 5000 });

        await dragHandCardToPlay(page, 'card-buddha-light');

        await expect.poll(async () => {
            const player0 = await game.getPlayerState('0');
            return player0?.hand?.map((card: any) => card.id) ?? [];
        }, { timeout: 5000 }).toEqual([]);
        await game.screenshot('hand-drag-play-resolved', testInfo);
    });

    test('手牌中的合法卡牌应通过验证并成功执行', async ({ page, game }) => {
        await setupPlayCardValidationScene(page, game);

        const buddhaLightCard = page
            .locator('[data-card-id="card-buddha-light"], [data-card-key^="card-buddha-light-"]')
            .first();
        await expect(buddhaLightCard).toBeVisible({ timeout: 5000 });
        await dragHandCardToPlay(page, 'card-buddha-light');

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state?.core?.players?.['0'];
            const player1 = state?.core?.players?.['1'];
            return {
                handIds: player0?.hand?.map((card: any) => card.id) ?? [],
                tokens: player0?.tokens ?? {},
                cp: player0?.resources?.CP ?? player0?.resources?.cp ?? null,
                opponentKnockdown: player1?.statusEffects?.knockdown ?? player1?.statuses?.knockdown ?? player1?.tokens?.knockdown ?? null,
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
            opponentKnockdown: player1?.statusEffects?.knockdown ?? player1?.statuses?.knockdown ?? player1?.tokens?.knockdown ?? null,
        };

        expect(finalState.handIds).not.toContain('card-buddha-light');
        expect(finalState.tokens.taiji ?? 0).toBe(1);
        expect(finalState.tokens.evasive ?? 0).toBe(1);
        expect(finalState.tokens.purify ?? 0).toBe(1);
        expect(finalState.cp).toBe(2);
        expect(finalState.opponentKnockdown ?? 0).toBe(1);
    });

    test('不在手牌中的卡牌应命中 card_not_in_hand 校验', async ({ page, game }) => {
        await setupPlayCardValidationScene(page, game, { hand: [] });

        await page.evaluate(() => {
            (window as any).__BG_TEST_HARNESS__?.command?.dispatch?.({
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: 'non-existent-card-id' },
                timestamp: Date.now(),
            });
        });
        await expect(page.getByText('卡牌不在手牌中')).toBeVisible({ timeout: 5000 });

        const player0 = await game.getPlayerState('0');
        const finalHand = player0?.hand?.map((card: any) => card.id) ?? [];
        const finalCp = player0?.resources?.CP ?? player0?.resources?.cp ?? null;

        expect(finalHand).toEqual([]);
        expect(finalCp).toBe(5);
    });
});
