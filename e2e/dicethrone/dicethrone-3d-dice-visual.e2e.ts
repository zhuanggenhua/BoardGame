import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';

const OUT_DIR = 'temp/dice3d-reroll-flow';
const SCREENSHOTS = {
    beforeRoll: `${OUT_DIR}/01-开始投掷.png`,
    rolling: `${OUT_DIR}/02-投掷中.png`,
    rolled: `${OUT_DIR}/03-投掷动画结束.png`,
    selected: `${OUT_DIR}/04-打出选任意骰子重投卡牌-选择所有骰子.png`,
    rerolled: `${OUT_DIR}/05-点击重投后.png`,
} as const;
const BOARD_DICE_3D_STORAGE_KEY = 'dicethrone:boardDice3dEnabled';

async function saveScreenshot(page: import('@playwright/test').Page, path: string) {
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
}

async function readDiceValues(game: import('../framework').GameTestContext): Promise<number[]> {
    const state = await game.getState();
    return (state?.core?.dice ?? []).map((die: { value: number }) => die.value);
}

async function waitForValidDiceValues(
    game: import('../framework').GameTestContext,
    timeout = 8000,
): Promise<number[]> {
    await expect.poll(async () => {
        const state = await game.getState();
        const values = (state?.core?.dice ?? []).map((die: { value: number }) => die.value);
        return values.length === 5 && values.every((value: number) => value >= 1 && value <= 6)
            ? 'valid'
            : 'invalid';
    }, { timeout }).toBe('valid');
    return readDiceValues(game);
}

async function waitForBoardVisualAssets(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => {
        const boardImg = document.querySelector('[data-testid="player-board-image"]') as HTMLImageElement | null;
        const tipImg = document.querySelector('[data-testid="tip-board-image"]') as HTMLImageElement | null;
        return Boolean(
            boardImg
            && boardImg.complete
            && boardImg.naturalWidth > 0
            && tipImg
            && tipImg.complete
            && tipImg.naturalWidth > 0,
        );
    }, undefined, { timeout: 10000 });

    await page.waitForTimeout(350);
}

async function dragHandCardToPlay(page: import('@playwright/test').Page, cardId: string) {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });

    const box = await handCard.boundingBox();
    if (!box) throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);

    const startX = box.x + (box.width / 2);
    const startY = box.y + (box.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

async function closeMagnifyOverlayIfPresent(page: import('@playwright/test').Page) {
    const overlay = page.getByTestId('board-magnify-overlay').first();
    const hasOverlay = await overlay.count().catch(() => 0);
    if (!hasOverlay) return;

    const visible = await overlay.isVisible().catch(() => false);
    if (!visible) return;

    const closeButton = overlay.getByRole('button', { name: /关闭预览|close preview/i }).first();
    const closeButtonVisible = await closeButton.isVisible().catch(() => false);
    if (closeButtonVisible) {
        await closeButton.click({ force: true });
    } else {
        await overlay.click({ position: { x: 12, y: 12 }, force: true });
    }

    await expect(overlay).toBeHidden({ timeout: 5000 });
}

async function clickCenterDie(page: import('@playwright/test').Page, dieId: number) {
    await page.evaluate((nextDieId: number) => {
        const target = document.querySelector(`[data-testid="die-button-${nextDieId}"]`) as HTMLElement | null;
        if (!target) throw new Error(`未找到骰子点击层 ${nextDieId}`);
        target.click();
    }, dieId);
}

test.describe('DiceThrone 3D 骰子端到端视觉验收', () => {
    test.setTimeout(90000);

    test('真实投掷与重投流程生成五张截图', async ({ page, game }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.addInitScript((storageKey) => {
            window.localStorage.setItem(storageKey, 'true');
        }, BOARD_DICE_3D_STORAGE_KEY);
        await game.openTestGame('dicethrone');
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-i-can-again'],
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
                rollCount: 0,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false, definitionId: 'monk-dice' },
                    { id: 1, value: 2, isKept: false, definitionId: 'monk-dice' },
                    { id: 2, value: 3, isKept: false, definitionId: 'monk-dice' },
                    { id: 3, value: 4, isKept: false, definitionId: 'monk-dice' },
                    { id: 4, value: 5, isKept: false, definitionId: 'monk-dice' },
                ],
            },
        });

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 2, 3, 4, 5]);
        });
        await waitForBoardVisualAssets(page);

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();

        await expect(rollButton).toBeVisible({ timeout: 10000 });
        await expect(confirmButton).toBeVisible({ timeout: 10000 });
        await expect(confirmButton).toBeDisabled();
        await saveScreenshot(page, SCREENSHOTS.beforeRoll);

        await rollButton.click();
        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            return await page.evaluate(() => Boolean(
                document.querySelector('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]'),
            ));
        }, { timeout: 5000 }).toBe(true);
        await page.waitForTimeout(120);
        await saveScreenshot(page, SCREENSHOTS.rolling);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.rollCount ?? null;
        }, { timeout: 8000 }).toBe(1);
        const rolledValues = await waitForValidDiceValues(game);
        await page.waitForTimeout(450);
        await expect(confirmButton).toBeVisible({ timeout: 5000 });
        await saveScreenshot(page, SCREENSHOTS.rolled);

        await dragHandCardToPlay(page, 'card-i-can-again');
        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                kind: interaction?.kind ?? null,
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
            };
        }, { timeout: 8000 }).toMatchObject({
            kind: 'multistep-choice',
            dtType: 'selectDie',
            selectCount: 5,
        });
        await closeMagnifyOverlayIfPresent(page);

        for (const dieId of [0, 1, 2, 3, 4]) {
            const die = page.getByTestId(`die-button-${dieId}`);
            await expect(die).toBeVisible({ timeout: 5000 });
            await clickCenterDie(page, dieId);
        }

        await expect.poll(async () => {
            return page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="die-button-"]'))
                .filter((node) => (node as HTMLElement).dataset.selected === 'true').length);
        }, { timeout: 5000 }).toBe(5);
        await page.waitForTimeout(180);
        await saveScreenshot(page, SCREENSHOTS.selected);

        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6, 6, 6, 6, 6]);
        });
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const handIds = (state?.core?.players?.['0']?.hand ?? []).map((card: { id: string }) => card.id);
            const lastEventTypes = (state?.sys?.eventStream?.entries ?? [])
                .slice(-12)
                .map((entry: { event?: { type?: string } }) => entry.event?.type);
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds,
                rerolledCount: lastEventTypes.filter((type: string) => type === 'DIE_REROLLED').length,
            };
        }, { timeout: 8000 }).toMatchObject({
            interactionKind: null,
            handIds: [],
            rerolledCount: 5,
        });
        await expect.poll(async () => {
            return readDiceValues(game);
        }, { timeout: 8000 }).not.toEqual(rolledValues);
        await expect(page.locator('[data-testid="hand-area"] [data-card-id="card-i-can-again"]')).toHaveCount(0, { timeout: 5000 });
        await page.waitForTimeout(450);
        await saveScreenshot(page, SCREENSHOTS.rerolled);
    });
});
