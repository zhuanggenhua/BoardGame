import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';

const OUT = 'temp/dice3d-reroll-flow/local-narrow/dice-stage-current-region-redbox.png';
const BOARD_DICE_3D_STORAGE_KEY = 'dicethrone:boardDice3dEnabled';

test.describe('DiceThrone 3D 骰子区域红框验收', () => {
    test.setTimeout(90000);

    test('画出当前 3D 骰子舞台区域并量手牌遮挡', async ({ page, game }) => {
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
                rollCount: 1,
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

        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(1200);

        const data = await page.evaluate(() => {
            const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
            const hand = document.querySelector('[data-testid="hand-area"]') as HTMLElement | null;
            if (!stage) throw new Error('未找到 3D 骰子舞台');
            if (!hand) throw new Error('未找到手牌区域');

            const rect = stage.getBoundingClientRect();
            const handRect = hand.getBoundingClientRect();
            const style = getComputedStyle(stage);
            const opponentHeaders = Array.from(document.querySelectorAll('[data-testid^="dt-top-header-"]')) as HTMLElement[];
            const opponentHeaderRects = opponentHeaders.map((node) => {
                const headerRect = node.getBoundingClientRect();
                return {
                    testId: node.dataset.testid ?? node.getAttribute('data-testid'),
                    x: headerRect.x,
                    y: headerRect.y,
                    width: headerRect.width,
                    height: headerRect.height,
                    bottom: headerRect.bottom,
                };
            });
            const opponentHeaderBottom = opponentHeaderRects.reduce((bottom, headerRect) => (
                Math.max(bottom, headerRect.bottom)
            ), 0);
            const viewportCenterX = window.innerWidth / 2;
            const stageCenterX = rect.x + (rect.width / 2);
            const payload = {
                className: stage.getAttribute('class'),
                rect: {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                },
                handRect: {
                    x: handRect.x,
                    y: handRect.y,
                    width: handRect.width,
                    height: handRect.height,
                    top: handRect.top,
                },
                overlapWithHandPx: Math.max(0, rect.bottom - handRect.top),
                computed: {
                    top: style.top,
                    width: style.width,
                    height: style.height,
                    position: style.position,
                },
                opponentHeaderRects,
                gapBelowOpponentHeaderPx: rect.y - opponentHeaderBottom,
                centerOffsetPx: stageCenterX - viewportCenterX,
            };

            const old = document.getElementById('__dice_stage_redbox_overlay__');
            old?.remove();
            const box = document.createElement('div');
            box.id = '__dice_stage_redbox_overlay__';
            Object.assign(box.style, {
                position: 'fixed',
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                border: '6px solid #ff0000',
                boxSizing: 'border-box',
                zIndex: '2147483647',
                pointerEvents: 'none',
                borderRadius: '8px',
                boxShadow: '0 0 0 9999px rgba(255,0,0,0.04)',
            });
            document.body.appendChild(box);

            return payload;
        });

        await mkdir(dirname(OUT), { recursive: true });
        await page.screenshot({ path: OUT, fullPage: false });
        console.log(JSON.stringify({ ...data, out: OUT }, null, 2));
        expect(data.overlapWithHandPx).toBe(0);
        expect(Math.abs(data.centerOffsetPx)).toBeLessThanOrEqual(2);
        expect(data.gapBelowOpponentHeaderPx).toBeGreaterThanOrEqual(8);
    });
});
