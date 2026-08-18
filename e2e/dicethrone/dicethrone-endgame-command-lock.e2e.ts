import { test, expect } from '../framework';
import {
    dispatchDiceThroneCommand,
    readDiceThroneHarnessState,
} from '../helpers/dicethrone';

const OPEN_TIMEOUT_MS = 180000;

type DiceThroneEndgameHarnessState = {
    sys?: {
        phase?: string;
        gameover?: { winner?: string };
        eventStream?: { entries?: Array<{ event?: { type?: string } }> };
    };
    core?: {
        rollCount?: number;
        dice?: unknown[];
    };
};

test.describe('DiceThrone 终局胜负画面操作锁', () => {
    test('胜利失败画面出现后用透明点击层拦住棋盘操作，并在移动横屏保留完整按钮', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('dicethrone', { playerID: '0' }, OPEN_TIMEOUT_MS);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: { resources: { CP: 2, HP: 50 } },
            player1: { resources: { CP: 2, HP: 0 } },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'barbarian', '1': 'monk' },
                hostStarted: true,
                rollCount: 0,
                rollLimit: 3,
                rollDiceCount: 5,
                dice: [],
            },
            sys: {
                phase: 'offensiveRoll',
                currentPlayerIndex: 0,
                gameover: { winner: '0' },
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            },
        });

        const endgameTitle = page.getByTestId('dt-endgame-title');
        const endgameOverlay = page.getByTestId('endgame-overlay');
        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(endgameTitle).toBeVisible({ timeout: 10000 });
        await expect(rollButton).toBeVisible({ timeout: 10000 });

        const overlayPaint = await endgameOverlay.evaluate((overlay) => {
            const style = window.getComputedStyle(overlay);
            const webkitStyle = style as CSSStyleDeclaration & { webkitBackdropFilter?: string };
            return {
                backgroundColor: style.backgroundColor,
                backdropFilter: style.backdropFilter || webkitStyle.webkitBackdropFilter || 'none',
                pointerEvents: style.pointerEvents,
            };
        });
        expect(overlayPaint).toEqual({
            backgroundColor: 'rgba(0, 0, 0, 0)',
            backdropFilter: 'none',
            pointerEvents: 'auto',
        });

        const topmostAtRollButton = await rollButton.evaluate((button) => {
            const rect = button.getBoundingClientRect();
            const topmost = document.elementFromPoint(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2,
            );
            return topmost?.closest('[data-testid="endgame-overlay"]')?.getAttribute('data-testid') ?? null;
        });
        expect(topmostAtRollButton).toBe('endgame-overlay');

        await page.setViewportSize({ width: 812, height: 375 });
        await expect(endgameTitle).toBeVisible({ timeout: 10000 });
        const rematchActions = page.getByTestId('rematch-actions');
        await expect(rematchActions).toBeVisible({ timeout: 10000 });
        await expect(rematchActions).toHaveCSS('margin-top', '16px');
        await expect(rematchActions).toHaveCSS('column-gap', '12px');
        const rematchButtonRects = await page.locator('[data-testid="rematch-actions"] button').evaluateAll((buttons) => (
            buttons.map((button) => {
                const rect = button.getBoundingClientRect();
                return {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                };
            })
        ));
        expect(rematchButtonRects.length).toBeGreaterThan(0);
        for (const rect of rematchButtonRects) {
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.height).toBeGreaterThanOrEqual(44);
            expect(rect.left).toBeGreaterThanOrEqual(0);
            expect(rect.top).toBeGreaterThanOrEqual(0);
            expect(rect.right).toBeLessThanOrEqual(812);
            expect(rect.bottom).toBeLessThanOrEqual(375);
        }

        await dispatchDiceThroneCommand(page, { type: 'ROLL_DICE', playerId: '0' });
        await expect(page.getByText('对局已结束', { exact: true })).toBeVisible();
        await expect(page.getByText('game_over', { exact: true })).toHaveCount(0);
        await expect.poll(async () => {
            const state = await readDiceThroneHarnessState<DiceThroneEndgameHarnessState>(page);
            return {
                phase: state.sys?.phase ?? null,
                winner: state.sys?.gameover?.winner ?? null,
                rollCount: state.core?.rollCount ?? null,
                diceCount: state.core?.dice?.length ?? null,
                hasRolledEvent: state.sys?.eventStream?.entries?.some((entry) => entry.event?.type === 'DICE_ROLLED') ?? false,
            };
        }).toEqual({
            phase: 'offensiveRoll',
            winner: '0',
            rollCount: 0,
            diceCount: 0,
            hasRolledEvent: false,
        });

        await game.screenshot('胜利失败画面透明拦截且移动横屏按钮完整', testInfo);
    });
});
