import type { Page } from '@playwright/test';
import { test, expect } from '../framework';

const BOARD_DICE_3D_STORAGE_KEY = 'dicethrone:boardDice3dEnabled';

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    const cardBox = await page.evaluate((nextCardId: string) => {
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

async function openFabSettingsPanel(page: Page) {
    const mainFabButton = page.locator('[data-fab-id="exit"]');
    await expect(mainFabButton).toBeVisible({ timeout: 10000 });
    await mainFabButton.click();

    const settingsButton = page.locator('[data-fab-id="settings"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    const settingsPanel = page.getByTestId('fab-panel-settings');
    await expect(settingsPanel).toBeVisible({ timeout: 5000 });
    return settingsPanel;
}

test.describe('DiceThrone - 棋盘内 3D 骰子开关', () => {
    test('默认关闭，打开后切到棋盘 3D 骰子，重投时不是原地静止', async ({ page, game }, testInfo) => {
        await page.addInitScript((storageKey) => {
            localStorage.removeItem(storageKey);
            localStorage.setItem('hud_fab_position', JSON.stringify({
                leftPercent: 0.82,
                topPercent: 0.66,
            }));
        }, BOARD_DICE_3D_STORAGE_KEY);

        await game.openTestGame('dicethrone');
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-worthy-of-me'],
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
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: { id: string }) => card.id === 'card-worthy-of-me'),
                rollCount: state?.core?.rollCount ?? state?.core?.G?.rollCount ?? state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
        });

        await dragHandCardToPlay(page, 'card-worthy-of-me');

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'selectDie',
            selectCount: 2,
        });

        await expect(page.getByTestId('dicethrone-board-dice-stage')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            return await page.evaluate((storageKey) => localStorage.getItem(storageKey), BOARD_DICE_3D_STORAGE_KEY);
        }, { timeout: 3000 }).not.toBe('true');

        await game.screenshot('01-默认关闭-仍使用右侧骰盘', testInfo);

        const settingsPanel = await openFabSettingsPanel(page);
        await expect(settingsPanel.getByText(/骰子显示|Dice Display/i)).toBeVisible({ timeout: 5000 });
        const board3dToggle = settingsPanel.locator('button').filter({ hasText: /棋盘内 3D 骰子|Board 3D Dice/i }).first();
        await expect(board3dToggle).toBeVisible({ timeout: 5000 });
        await board3dToggle.click();

        await expect.poll(async () => {
            return await page.evaluate((storageKey) => localStorage.getItem(storageKey), BOARD_DICE_3D_STORAGE_KEY);
        }, { timeout: 5000 }).toBe('true');
        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toHaveCount(0);

        await game.screenshot('02-打开设置后-切到棋盘内3D骰子', testInfo);

        const firstDieButton = page.locator('[data-testid="die-button-0"]');
        const secondDieButton = page.locator('[data-testid="die-button-1"]');
        await expect(firstDieButton).toBeVisible({ timeout: 5000 });
        await expect(secondDieButton).toBeVisible({ timeout: 5000 });
        await firstDieButton.click();
        await secondDieButton.click();

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });

        const movementPromise = page.evaluate(async () => {
            const readPositions = () => [0, 1].map((dieId) => {
                const node = document.querySelector(`[data-testid="die-button-${dieId}"]`) as HTMLElement | null;
                if (!node) {
                    return { dieId, x: null, y: null };
                }
                const rect = node.getBoundingClientRect();
                return {
                    dieId,
                    x: rect.left,
                    y: rect.top,
                };
            });

            const samples: Array<{
                t: number;
                positions: Array<{ dieId: number; x: number | null; y: number | null }>;
            }> = [];
            const startedAt = performance.now();

            while ((performance.now() - startedAt) < 450) {
                samples.push({
                    t: performance.now() - startedAt,
                    positions: readPositions(),
                });
                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            return samples;
        });

        await confirmButton.click();
        const movementSamples = await movementPromise;

        const movementDetected = movementSamples.some((sample, index) => {
            if (index === 0) return false;
            const previous = movementSamples[index - 1];
            return sample.positions.some((position, posIndex) => {
                const prevPosition = previous.positions[posIndex];
                if (position.x === null || position.y === null || prevPosition?.x === null || prevPosition?.y === null) {
                    return false;
                }
                return Math.abs(position.x - prevPosition.x) > 1.5
                    || Math.abs(position.y - prevPosition.y) > 1.5;
            });
        });

        expect(movementDetected).toBe(true);
        await game.screenshot('03-确认重投后-3D骰子发生位移弹跳', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-6);
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                lastEventTypes: lastEvents.map((entry: { event?: { type?: string } }) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: null,
        });
    });
});
