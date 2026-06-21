import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { getEvidenceScreenshotPath, sanitizeEvidencePathSegment } from '../framework/evidenceScreenshots';

async function setupMagnifyAbilitySelectionScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 5, HP: 50 },
            tokens: {},
            playerBoardFace: 'normal',
        } as any,
        player1: {
            resources: { CP: 5, HP: 50 },
            tokens: {},
        } as any,
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'cursed_pirate', '1': 'monk' },
            hostStarted: true,
            dice: [{ value: 6 }, { value: 6 }, { value: 6 }, { value: 6 }, { value: 6 }],
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        },
        sys: {
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        },
    });

    await game.waitForPhase('offensiveRoll', 10000);
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            activePlayerId: state?.core?.activePlayerId ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            selectedCharacter: state?.core?.selectedCharacters?.['0'] ?? null,
            selectedAbilityId: state?.core?.selectedAbilityId ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        activePlayerId: '0',
        rollConfirmed: true,
        selectedCharacter: 'cursed_pirate',
        selectedAbilityId: null,
    });
}

test.describe('DiceThrone - 玩家面板放大预览技能选择', () => {
    test('放大预览内仍可点击大招并继续进入技能执行链', async ({ page, game }, testInfo) => {
        await setupMagnifyAbilitySelectionScene(game);

        const playerBoardMagnifyButton = page.getByTestId('player-board-magnify-button');
        const boardUltimateSlot = page.locator('[data-ability-slot="ultimate"]').first();
        const boardMagnifyOverlay = page.getByTestId('board-magnify-overlay');
        const boardMagnifyImage = boardMagnifyOverlay.locator('img').first();
        const overlayCloseButton = boardMagnifyOverlay.getByRole('button', { name: /关闭预览|close preview/i }).first();
        const overlayUltimateSlot = boardMagnifyOverlay.locator('[data-ability-slot="ultimate"]').first();
        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        const guestChoiceModal = page.locator('#modal-root');

        await expect(boardUltimateSlot).toBeVisible({ timeout: 5000 });
        await expect(boardUltimateSlot).toHaveAttribute('data-base-ability-id', 'merciless-plunder', { timeout: 5000 });
        await expect(boardUltimateSlot).toHaveAttribute('data-resolved-ability-id', 'merciless-plunder', { timeout: 5000 });
        await expect(boardUltimateSlot).toHaveAttribute('data-should-highlight', 'true', { timeout: 5000 });
        await expect(page.getByTestId('dt-ability-highlight-ultimate').first()).toBeVisible({ timeout: 5000 });
        await game.screenshot('00-未放大玩家面板-大招槽位高亮整体', testInfo);
        const boardHighlightedSlotPath = getEvidenceScreenshotPath(testInfo, '00-未放大玩家面板-大招槽位高亮局部', {
            filename: `${sanitizeEvidencePathSegment('00-未放大玩家面板-大招槽位高亮局部')}.png`,
        });
        await mkdir(dirname(boardHighlightedSlotPath), { recursive: true });
        const boardHighlightedSlotBox = await boardUltimateSlot.boundingBox();
        if (!boardHighlightedSlotBox) {
            throw new Error('未能获取未放大玩家面板大招槽位坐标，无法输出高亮局部截图');
        }
        const boardPadding = 18;
        await page.screenshot({
            path: boardHighlightedSlotPath,
            clip: {
                x: Math.max(0, boardHighlightedSlotBox.x - boardPadding),
                y: Math.max(0, boardHighlightedSlotBox.y - boardPadding),
                width: boardHighlightedSlotBox.width + boardPadding * 2,
                height: boardHighlightedSlotBox.height + boardPadding * 2,
            },
        });

        await expect(playerBoardMagnifyButton).toBeVisible({ timeout: 5000 });
        await playerBoardMagnifyButton.click();

        await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
        await expect(boardMagnifyImage).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => boardMagnifyImage.evaluate((node) => {
            if (!(node instanceof HTMLImageElement)) return false;
            return node.complete && node.naturalWidth > 0 && node.naturalHeight > 0;
        }), { timeout: 5000 }).toBe(true);
        await expect(overlayCloseButton).toBeVisible({ timeout: 5000 });
        await expect(overlayUltimateSlot).toBeVisible({ timeout: 5000 });
        await expect(overlayUltimateSlot).toHaveAttribute('data-base-ability-id', 'merciless-plunder', { timeout: 5000 });
        await expect(overlayUltimateSlot).toHaveAttribute('data-resolved-ability-id', 'merciless-plunder', { timeout: 5000 });
        await expect(overlayUltimateSlot).toHaveAttribute('data-can-click', 'true', { timeout: 5000 });
        await expect(overlayUltimateSlot).toHaveAttribute('data-should-highlight', 'true', { timeout: 5000 });
        await expect(boardMagnifyOverlay.getByTestId('dt-ability-highlight-ultimate')).toBeVisible({ timeout: 5000 });
        await game.screenshot('01-玩家面板放大预览-大招槽位可点击', testInfo);
        const highlightedSlotPath = getEvidenceScreenshotPath(testInfo, '01a-玩家面板放大预览-大招槽位高亮局部', {
            filename: `${sanitizeEvidencePathSegment('01a-玩家面板放大预览-大招槽位高亮局部')}.png`,
        });
        await mkdir(dirname(highlightedSlotPath), { recursive: true });
        const highlightedSlotBox = await overlayUltimateSlot.boundingBox();
        if (!highlightedSlotBox) {
            throw new Error('未能获取放大预览大招槽位坐标，无法输出高亮局部截图');
        }
        const padding = 18;
        await page.screenshot({
            path: highlightedSlotPath,
            clip: {
                x: Math.max(0, highlightedSlotBox.x - padding),
                y: Math.max(0, highlightedSlotBox.y - padding),
                width: highlightedSlotBox.width + padding * 2,
                height: highlightedSlotBox.height + padding * 2,
            },
        });

        await overlayUltimateSlot.click();

        await expect(boardMagnifyOverlay).toBeHidden({ timeout: 5000 });
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                activatingAbilityId: state?.core?.activatingAbilityId ?? null,
                pendingAttackSourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttackAttackerId: state?.core?.pendingAttack?.attackerId ?? null,
                pendingAttackDefenderId: state?.core?.pendingAttack?.defenderId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            activatingAbilityId: 'merciless-plunder',
            pendingAttackSourceAbilityId: 'merciless-plunder',
            pendingAttackAttackerId: '0',
            pendingAttackDefenderId: '1',
        });
        await expect(advanceButton).toBeEnabled({ timeout: 5000 });
        await game.screenshot('02-放大预览内点击大招后-已选中并关闭预览', testInfo);

        await advanceButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                attackerId: state?.core?.pendingAttack?.attackerId ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                currentChoiceSourceAbilityId: state?.core?.currentChoiceSourceAbilityId ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            sourceAbilityId: 'merciless-plunder',
            attackerId: '0',
            defenderId: '1',
            currentChoiceSourceAbilityId: 'merciless-plunder',
            interactionKind: 'simple-choice',
        });
        await expect(guestChoiceModal).toContainText('是否获得诅咒金币？', { timeout: 10000 });
        await game.screenshot('03-大招执行后-进入诅咒金币选择', testInfo);
    });
});
