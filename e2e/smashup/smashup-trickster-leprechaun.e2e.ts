import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';

async function captureLeprechaunEvidence(
    page: Page,
    testInfo: TestInfo,
    name: string,
) {
    const baseZone = page.getByTestId('base-zone-0');
    const handArea = page.getByTestId('su-hand-area');
    await expect(baseZone).toBeVisible({ timeout: 10000 });
    await expect(handArea).toBeVisible({ timeout: 10000 });

    const baseBox = await baseZone.boundingBox();
    const handBox = await handArea.boundingBox();
    if (!baseBox || !handBox) {
        throw new Error('无法获取矮妖验证截图边界');
    }

    const left = Math.max(0, Math.min(baseBox.x, handBox.x) - 24);
    const top = Math.max(0, Math.min(baseBox.y, handBox.y) - 24);
    const right = Math.max(baseBox.x + baseBox.width, handBox.x + handBox.width) + 24;
    const bottom = Math.max(baseBox.y + baseBox.height, handBox.y + handBox.height) + 24;
    const screenshotPath = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });

    await page.screenshot({
        path: screenshotPath,
        clip: {
            x: left,
            y: top,
            width: Math.max(right - left, 1),
            height: Math.max(bottom - top, 1),
        },
    });

    return screenshotPath;
}

test.describe('矮妖真实页面触发链', () => {
    test.beforeEach(async ({ page: _page }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
    });

    test('单只矮妖在真实页面中应消灭对手打到同基地的弱随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 20000, polling: 200 },
        );
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['tricksters', 'aliens'],
                hand: [],
            },
            player1: {
                factions: ['pirates', 'ninjas'],
                hand: [
                    { uid: 'weak-hand-1', defId: 'pirate_first_mate', type: 'minion', owner: '1' },
                ],
            },
            bases: [
                {
                    defId: 'base_tortuga',
                    minions: [
                        {
                            uid: 'lep-1',
                            defId: 'trickster_leprechaun',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            currentPlayer: '1',
            phase: 'playCards',
        });

        await expect.poll(async () => {
            const state = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null);
            return {
                currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
                currentPlayerId: state?.core?.turnOrder?.[state?.core?.currentPlayerIndex ?? -1] ?? null,
                hand: state?.core?.players?.['1']?.hand?.map((card: any) => card.uid) ?? [],
                base0Minions: state?.core?.bases?.[0]?.minions?.map((minion: any) => minion.uid) ?? [],
                phase: state?.sys?.phase ?? null,
            };
        }).toEqual({
            currentPlayerIndex: 1,
            currentPlayerId: '1',
            hand: ['weak-hand-1'],
            base0Minions: ['lep-1'],
            phase: 'playCards',
        });

        await hideSmashUpDebugPanelForEvidence(page);

        const weakCard = page.locator('[data-card-uid="weak-hand-1"]');
        const baseZone = page.getByTestId('base-zone-0');
        await expect(weakCard).toBeVisible({ timeout: 10000 });
        await expect(baseZone).toBeVisible({ timeout: 10000 });

        const beforePath = await captureLeprechaunEvidence(page, testInfo, 'smashup-leprechaun-before-play');

        await weakCard.click();
        await page.waitForTimeout(300);
        await baseZone.click();

        const triggerFx = page.getByTestId('smashup-triggered-fx');
        const triggerFxEffect = page.getByTestId('smashup-triggered-fx-effect');
        await expect(triggerFx).toBeVisible({ timeout: 5000 });
        await expect(triggerFx).toContainText('矮妖');
        await expect(triggerFxEffect).toContainText('消灭');
        await expect(triggerFxEffect).toContainText('大副');
        await page.waitForTimeout(240);

        const triggeredPath = await captureLeprechaunEvidence(page, testInfo, 'smashup-leprechaun-triggered');

        await expect.poll(async () => {
            const state = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null);
            return {
                hand: state?.core?.players?.['1']?.hand?.map((card: any) => card.uid) ?? [],
                discard: state?.core?.players?.['1']?.discard?.map((card: any) => card.defId) ?? [],
                base0Minions: state?.core?.bases?.[0]?.minions?.map((minion: any) => minion.uid) ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            hand: [],
            discard: ['pirate_first_mate'],
            base0Minions: ['lep-1'],
        });

        const afterPath = await captureLeprechaunEvidence(page, testInfo, 'smashup-leprechaun-after-resolve');

        const finalState = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null);
        expect(finalState?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === 'weak-hand-1')).toBe(false);
        expect(finalState?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === 'lep-1')).toBe(true);
        expect(finalState?.core?.players?.['1']?.discard?.map((card: any) => card.defId)).toContain('pirate_first_mate');

        console.log('矮妖 E2E 证据截图:', { beforePath, triggeredPath, afterPath });
    });
});
