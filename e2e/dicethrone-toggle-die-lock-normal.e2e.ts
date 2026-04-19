import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect } from './framework';
import type { GameTestContext } from './framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';

async function openOffensiveRollScene(
    game: GameTestContext,
): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
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
            activePlayerId: state?.core?.activePlayerId ?? null,
            rollCount: state?.core?.rollCount ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            diceCount: state?.core?.dice?.length ?? 0,
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'offensiveRoll',
        activePlayerId: '0',
        rollCount: 1,
        rollConfirmed: false,
        diceCount: 5,
    });
}

async function waitForDieLockState(
    game: GameTestContext,
    dieId: number,
    isKept: boolean,
): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return state?.core?.dice?.some(
            (die: any) => die.id === dieId && die.isKept === isKept,
        ) ?? false;
    }, { timeout: 5000 }).toBe(true);
}

async function saveDiceSidebarScreenshot(
    page: Page,
    testInfo: TestInfo,
    name: string,
    locators: Locator[],
): Promise<string> {
    const boxes = (await Promise.all(locators.map((locator) => locator.boundingBox())))
        .filter((box): box is NonNullable<typeof box> => Boolean(box));
    if (boxes.length === 0) {
        throw new Error('未找到可用于裁切证据图的骰区元素');
    }

    const margin = 24;
    const minX = Math.max(0, Math.min(...boxes.map((box) => box.x)) - margin);
    const minY = Math.max(0, Math.min(...boxes.map((box) => box.y)) - margin);
    const maxX = Math.max(...boxes.map((box) => box.x + box.width)) + margin;
    const maxY = Math.max(...boxes.map((box) => box.y + box.height)) + margin;
    const viewport = page.viewportSize();
    const clip = {
        x: minX,
        y: minY,
        width: Math.min((viewport?.width ?? maxX), maxX) - minX,
        height: Math.min((viewport?.height ?? maxY), maxY) - minY,
    };

    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, clip });
    return path;
}

test.describe('DiceThrone - 正常模式下锁定骰子', () => {
    test('应能在进攻掷骰阶段锁定和解锁骰子', async ({ page, game }) => {
        await openOffensiveRollScene(game);

        const firstDieButton = page.getByTestId('die-button-0');
        const firstDie = page.locator('[data-testid="die"]').first();
        const lockedLabel = firstDie.getByText(/locked|锁定/i);

        await expect(firstDieButton).toHaveAttribute('data-clickable', 'true');

        await firstDieButton.click();
        await waitForDieLockState(game, 0, true);
        await expect(lockedLabel).toBeVisible({ timeout: 3000 });

        await firstDieButton.click();
        await waitForDieLockState(game, 0, false);
        await expect(lockedLabel).not.toBeVisible({ timeout: 3000 });

        await firstDieButton.click();
        await waitForDieLockState(game, 0, true);
        await expect(lockedLabel).toBeVisible({ timeout: 3000 });
    });

    test('正常锁骰后确认并推进到 main1 时应收紧骰区交互', async ({ page, game }, testInfo) => {
        await openOffensiveRollScene(game);

        const dieButton = page.getByTestId('die-button-0');
        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');
        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');

        await expect(dieButton).toHaveAttribute('data-clickable', 'true');

        await dieButton.click();
        await waitForDieLockState(game, 0, true);

        await confirmButton.click();
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                kept: state?.core?.dice?.find((die: any) => die.id === 0)?.isKept ?? null,
            };
        }, { timeout: 5000 }).toEqual({
            phase: 'offensiveRoll',
            rollConfirmed: true,
            kept: true,
        });

        await expect(advanceButton).toBeEnabled({ timeout: 5000 });
        await advanceButton.click();
        await page.getByRole('button', { name: '确定结束' }).click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                rollCount: state?.core?.rollCount ?? null,
                kept: state?.core?.dice?.find((die: any) => die.id === 0)?.isKept ?? null,
            };
        }, { timeout: 5000 }).toEqual({
            phase: 'main2',
            rollConfirmed: true,
            rollCount: 1,
            kept: true,
        });

        await expect(rollButton).toBeDisabled();
        await expect(confirmButton).toBeDisabled();
        await expect(dieButton).toHaveAttribute('data-clickable', 'false');

        await dieButton.click({ force: true });
        await page.waitForTimeout(300);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                kept: state?.core?.dice?.find((die: any) => die.id === 0)?.isKept ?? null,
            };
        }, { timeout: 3000 }).toEqual({
            phase: 'main2',
            kept: true,
        });

        await expect(page.getByText('当前阶段无法执行此操作')).toHaveCount(0);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveDiceSidebarScreenshot(page, testInfo, 'lock-confirm-advance-main1-guarded', [
            dieButton,
            rollButton,
            confirmButton,
            advanceButton,
        ]);
    });
});
