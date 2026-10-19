import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { getEvidenceScreenshotPath, sanitizeEvidencePathSegment } from '../framework/evidenceScreenshots';
import { DESKTOP_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';

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

test.describe('DiceThrone - 玩家面板与提示卡固定控件图标', () => {
    test.use({
        viewport: { width: 936, height: 432 },
        screen: { width: 936, height: 432 },
        deviceScaleFactor: 2.5,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    });

    test('手机横屏下提示卡放大镜图标保持可读尺寸（与玩家面板独立断言）', async ({ page, game }, testInfo) => {
        await setupMagnifyAbilitySelectionScene(game);

        const readMetrics = async (button: ReturnType<typeof page.getByTestId>) => button.locator('svg').evaluate((svg) => {
            const buttonElement = svg.closest('button');
            const buttonBox = buttonElement?.getBoundingClientRect();
            const iconBox = svg.getBoundingClientRect();
            const visualBox = buttonElement?.querySelector<HTMLElement>('[data-fixed-control-visual="true"]')?.getBoundingClientRect();
            const surface = buttonElement?.closest('[data-testid$="-surface"]');
            const surfaceBox = surface?.getBoundingClientRect();
            const computed = buttonElement ? getComputedStyle(buttonElement) : null;
            const rootStyle = window.getComputedStyle(document.documentElement);
            return {
                buttonWidth: buttonBox?.width ?? 0,
                buttonX: buttonBox?.x ?? 0,
                buttonY: buttonBox?.y ?? 0,
                visualWidth: visualBox?.width ?? 0,
                visualRightGap: (surfaceBox?.right ?? 0) - (visualBox?.right ?? 0),
                visualTopGap: (visualBox?.top ?? 0) - (surfaceBox?.top ?? 0),
                iconWidth: iconBox.width,
                surfaceX: surfaceBox?.x ?? 0,
                surfaceY: surfaceBox?.y ?? 0,
                surfaceRight: surfaceBox?.right ?? 0,
                surfaceTop: surfaceBox?.top ?? 0,
                surfaceWidth: surfaceBox?.width ?? 0,
                surfaceHeight: surfaceBox?.height ?? 0,
                rightGap: (surfaceBox?.right ?? 0) - (buttonBox?.right ?? 0),
                topGap: (buttonBox?.top ?? 0) - (surfaceBox?.top ?? 0),
                offsetParent: buttonElement?.offsetParent instanceof HTMLElement ? buttonElement.offsetParent.dataset.testid ?? buttonElement.offsetParent.className : null,
                cssTop: computed?.top ?? '',
                cssRight: computed?.right ?? '',
                iconClass: svg.getAttribute('class') ?? '',
                shellScale: Number.parseFloat(rootStyle.getPropertyValue('--mobile-board-shell-scale')),
            };
        });

        const playerBoardMagnifyButton = page.getByTestId('player-board-magnify-button');
        await expect(playerBoardMagnifyButton).toBeVisible({ timeout: 5000 });
        const playerBoardMetrics = await readMetrics(playerBoardMagnifyButton);
        expect(playerBoardMetrics.shellScale).toBeLessThan(1);
        expect(playerBoardMetrics.iconClass).toContain('board-shell-fixed-icon');
        expect(playerBoardMetrics.buttonWidth).toBeGreaterThanOrEqual(40);
        // 圆形与锚点随恢复后的整体画布走；SVG保留此前已验收的独立屏幕尺寸。
        const screenUnit = (DESKTOP_REFERENCE_VIEWPORT.width / 100) * playerBoardMetrics.shellScale;
        expect(playerBoardMetrics.visualWidth).toBeCloseTo(2.6 * screenUnit, 1);
        expect(playerBoardMetrics.visualRightGap).toBeCloseTo(0.9 * screenUnit, 1);
        expect(playerBoardMetrics.visualTopGap).toBeCloseTo(1.85 * screenUnit, 1);
        expect(playerBoardMetrics.iconWidth).toBeCloseTo(13.824, 1);
        expect(playerBoardMetrics.iconWidth).toBeLessThan(playerBoardMetrics.visualWidth - 3);

        const tipBoardToggle = page.locator('[data-tutorial-id="tip-board"] > button').first();
        const tipBoardSurface = page.getByTestId('tip-board-surface');
        // The surface keeps its intrinsic width while the parent clips it at w-0.
        // Read the collapsible wrapper so the open/closed state matches what is visible.
        const tipBoardPanel = tipBoardSurface.locator('..');
        const readTipBoardSurfaceWidth = async () => (await tipBoardPanel.boundingBox())?.width ?? 0;
        const tipBoardImage = tipBoardSurface.getByTestId('tip-board-image');
        const tipBoardMagnifyButton = tipBoardSurface.getByTestId('tip-board-magnify-button');
        await expect(tipBoardToggle).toBeVisible({ timeout: 5000 });
        if (await readTipBoardSurfaceWidth() < 1) {
            await tipBoardToggle.click();
            await expect.poll(readTipBoardSurfaceWidth, { timeout: 5000 }).toBeGreaterThan(100);
        }
        await expect(tipBoardSurface).toBeVisible({ timeout: 5000 });
        await expect(tipBoardImage).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => tipBoardImage.evaluate((node) => {
            if (!(node instanceof HTMLImageElement)) return false;
            return node.complete && node.naturalWidth > 0 && node.naturalHeight > 0;
        }), { timeout: 5000 }).toBe(true);
        await expect.poll(async () => Number.parseFloat(await tipBoardImage.evaluate((node) => getComputedStyle(node).opacity)), { timeout: 5000 }).toBe(1);
        await expect(tipBoardMagnifyButton).toBeVisible({ timeout: 5000 });
        const tipBoardMetrics = await readMetrics(tipBoardMagnifyButton);
        expect(tipBoardMetrics.buttonWidth).toBeGreaterThanOrEqual(40);
        expect(tipBoardMetrics.visualWidth).toBeCloseTo(2.6 * screenUnit, 1);
        expect(tipBoardMetrics.visualRightGap).toBeCloseTo(0.25 * screenUnit, 1);
        expect(tipBoardMetrics.visualTopGap).toBeCloseTo(0.25 * screenUnit, 1);
        expect(tipBoardMetrics.iconWidth).toBeCloseTo(13.824, 1);
        expect(tipBoardMetrics.iconWidth).toBeLessThan(tipBoardMetrics.visualWidth - 3);

        // 完整视口上下文：先证明提示卡已加载，再拍目标态主证据。
        await game.screenshot('00-壳内固定控件-提示卡已加载-整屏', testInfo);

        await tipBoardToggle.click();
        await expect.poll(readTipBoardSurfaceWidth, { timeout: 5000 }).toBeLessThan(1);
        await game.screenshot('01-壳内固定控件-玩家面板放大镜-整屏', testInfo);

        await tipBoardToggle.click();
        await expect.poll(readTipBoardSurfaceWidth, { timeout: 5000 }).toBeGreaterThan(100);
        await expect(tipBoardSurface).toBeVisible({ timeout: 5000 });
        await expect(tipBoardImage).toBeVisible({ timeout: 5000 });
        await expect(tipBoardMagnifyButton).toBeVisible({ timeout: 5000 });
        await game.screenshot('02-壳内固定控件-提示卡放大镜-整屏', testInfo);
    });
});
