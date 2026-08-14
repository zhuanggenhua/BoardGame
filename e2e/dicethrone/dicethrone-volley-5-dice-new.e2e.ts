/**
 * DiceThrone Volley (万箭齐发) 5 Dice Display E2E Test
 *
 * 验证：
 * 1. displayOnly 奖励骰结算会渲染 5 颗骰子
 * 2. 面板不应出现继续/确认伤害按钮
 */

import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { expectRightTrayBonusDiceConfirmation, getRightTrayDiceTray } from './bonus-dice-flow';

test.describe('骰子王座万箭齐发五骰展示', () => {
    test('万箭齐发使用奖励骰结算时整屏展示五颗骰子', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 3, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main2',
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
                hostStarted: true,
                pendingBonusDiceSettlement: {
                    id: 'volley-display-only',
                    attackerId: '0',
                    targetId: '1',
                    dice: [
                        { index: 0, value: 1, face: 'bow' },
                        { index: 1, value: 2, face: 'moon' },
                        { index: 2, value: 3, face: 'arrow' },
                        { index: 3, value: 4, face: 'bow' },
                        { index: 4, value: 5, face: 'moon' },
                    ],
                    rerollCostTokenId: '',
                    rerollCostAmount: 0,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    displayOnly: true,
                    showTotal: false,
                },
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                diceCount: settlement?.dice?.length ?? 0,
                displayOnly: settlement?.displayOnly ?? false,
                rerollCount: settlement?.rerollCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            diceCount: 5,
            displayOnly: true,
            rerollCount: 0,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
        const diceTray = getRightTrayDiceTray(page);

        const bonusDice = diceTray.locator('[data-testid^="die-button-"]');
        await expect(bonusDice).toHaveCount(5, { timeout: 5000 });
        await expect.poll(async () => diceTray
            .locator('[data-testid^="die-button-"]')
            .evaluateAll((nodes) => nodes.filter((node) => {
                const element = node as HTMLElement;
                const rect = element.getBoundingClientRect();
                const opacity = Number.parseFloat(getComputedStyle(element).opacity || '0');
                return rect.width > 40 && rect.height > 40 && opacity > 0.98;
            }).length), { timeout: 3000 }).toBe(5);
        await expect(
            page.getByRole('button', { name: /Confirm Damage|Continue|确认伤害|继续/i }),
        ).toHaveCount(0);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '01-万箭齐发五骰-整屏结果图', { requireChineseName: true }),
            fullPage: false,
        });
        const diceBounds = await diceTray
            .locator('[data-testid^="die-button-"]')
            .evaluateAll((nodes) => nodes.map((node) => {
                const rect = (node as HTMLElement).getBoundingClientRect();
                return {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                };
            }));
        expect(diceBounds).toHaveLength(5);

        const diceGroupBounds = diceBounds.reduce((bounds, rect) => ({
            left: Math.min(bounds.left, rect.left),
            top: Math.min(bounds.top, rect.top),
            right: Math.max(bounds.right, rect.right),
            bottom: Math.max(bounds.bottom, rect.bottom),
        }), {
            left: Number.POSITIVE_INFINITY,
            top: Number.POSITIVE_INFINITY,
            right: Number.NEGATIVE_INFINITY,
            bottom: Number.NEGATIVE_INFINITY,
        });
        const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
        const screenshotPadding = 32;
        const clip = {
            x: Math.max(0, Math.floor(diceGroupBounds.left - screenshotPadding)),
            y: Math.max(0, Math.floor(diceGroupBounds.top - screenshotPadding)),
            width: Math.min(
                viewport.width,
                Math.ceil((diceGroupBounds.right - diceGroupBounds.left) + screenshotPadding * 2),
            ),
            height: Math.min(
                viewport.height,
                Math.ceil((diceGroupBounds.bottom - diceGroupBounds.top) + screenshotPadding * 2),
            ),
        };
        clip.width = Math.min(clip.width, viewport.width - clip.x);
        clip.height = Math.min(clip.height, viewport.height - clip.y);

        for (const rect of diceBounds) {
            expect(rect.width).toBeGreaterThan(40);
            expect(rect.height).toBeGreaterThan(40);
            expect(rect.left).toBeGreaterThanOrEqual(clip.x);
            expect(rect.top).toBeGreaterThanOrEqual(clip.y);
            expect(rect.right).toBeLessThanOrEqual(clip.x + clip.width);
            expect(rect.bottom).toBeLessThanOrEqual(clip.y + clip.height);
        }

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '02-万箭齐发五骰-整屏几何核验后', { requireChineseName: true }),
            fullPage: false,
        });

        const state = await game.getState();
        const settlement = state?.core?.pendingBonusDiceSettlement;
        const finalState = {
            diceCount: settlement?.dice?.length ?? 0,
            displayOnly: settlement?.displayOnly ?? false,
            rerollCount: settlement?.rerollCount ?? null,
        };

        expect(finalState.diceCount).toBe(5);
        expect(finalState.displayOnly).toBe(true);
        expect(finalState.rerollCount).toBe(0);
    });
});
