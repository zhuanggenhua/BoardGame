import type { Page } from '@playwright/test';
import { test, expect } from '../../framework';
import { getEvidenceScreenshotPath } from '../../framework/evidenceScreenshots';

type DiceThroneDeckEntry = {
    id: string;
    atlasIndex: number | null;
};

async function setupDiceThroneDebugScene(page: Page, game: { openTestGame: (gameId: string) => Promise<void>; setupScene: (config: Record<string, unknown>) => Promise<void> }) {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 0, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'main1',
        extra: {
            selectedCharacters: { '0': 'barbarian', '1': 'paladin' },
            hostStarted: true,
        },
    });

    await page.getByTestId('debug-toggle').click();
    await expect(page.getByTestId('debug-panel')).toBeVisible({ timeout: 5000 });
}

async function readSeatDeckSnapshot(page: Page, playerId: '0' | '1') {
    return page.evaluate((pid) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const getAtlasIndex = (card: any) => (
            typeof card?.sourceAtlasIndex === 'number'
                ? card.sourceAtlasIndex
                : card?.previewRef?.type === 'atlas'
                    ? card.previewRef.index
                    : null
        );

        const player = state?.core?.players?.[pid];
        return {
            deck: (player?.deck ?? []).map((card: any) => ({
                id: card.id,
                atlasIndex: getAtlasIndex(card),
            })),
            hand: (player?.hand ?? []).map((card: any) => ({
                id: card.id,
                atlasIndex: getAtlasIndex(card),
            })),
        };
    }, playerId) as Promise<{ deck: DiceThroneDeckEntry[]; hand: DiceThroneDeckEntry[] }>;
}

function findUniqueDeckAtlas(entries: DiceThroneDeckEntry[]) {
    const counts = new Map<number, number>();
    for (const entry of entries) {
        if (typeof entry.atlasIndex !== 'number') continue;
        counts.set(entry.atlasIndex, (counts.get(entry.atlasIndex) ?? 0) + 1);
    }

    return entries.find((entry) => typeof entry.atlasIndex === 'number' && counts.get(entry.atlasIndex) === 1) ?? null;
}

test.describe('DiceThrone 调试面板', () => {
    test('状态页会反映注入后的生命值变更', async ({ page, game }) => {
        await setupDiceThroneDebugScene(page, game);

        const stateTab = page.getByTestId('debug-tab-state');
        if (await stateTab.isVisible().catch(() => false)) {
            await stateTab.click();
        }

        await page.waitForFunction(
            () => {
                const raw = document.querySelector('[data-testid="debug-state-json"]')?.textContent;
                if (!raw) return false;
                try {
                    const parsed = JSON.parse(raw);
                    const core = parsed?.core ?? parsed?.G?.core ?? parsed;
                    const hp = core?.players?.['0']?.resources?.HP ?? core?.players?.['0']?.resources?.hp;
                    return hp === 50;
                } catch {
                    return false;
                }
            },
            { timeout: 5000, polling: 200 },
        );

        await page.evaluate(() => {
            (window as any).__BG_TEST_HARNESS__?.state?.patch?.({
                core: {
                    players: {
                        '0': {
                            resources: { HP: 10 },
                        },
                    },
                },
            });
        });

        await page.waitForFunction(
            () => {
                const raw = document.querySelector('[data-testid="debug-state-json"]')?.textContent;
                if (!raw) return false;
                try {
                    const parsed = JSON.parse(raw);
                    const core = parsed?.core ?? parsed?.G?.core ?? parsed;
                    const hp = core?.players?.['0']?.resources?.HP ?? core?.players?.['0']?.resources?.hp;
                    return hp === 10;
                } catch {
                    return false;
                }
            },
            { timeout: 5000, polling: 200 },
        );

        const rawState = await page.getByTestId('debug-state-json').innerText();
        const parsed = JSON.parse(rawState);
        const core = parsed?.core ?? parsed?.G?.core ?? parsed;
        const hp = core?.players?.['0']?.resources?.HP ?? core?.players?.['0']?.resources?.hp;

        expect(hp).toBe(10);
    });

    test('seat1 调试发牌命中剩余牌库后，仍可继续补同 atlas 到手牌', async ({ page, game }, testInfo) => {
        await setupDiceThroneDebugScene(page, game);

        const seat1Before = await readSeatDeckSnapshot(page, '1');
        const targetEntry = findUniqueDeckAtlas(seat1Before.deck);

        expect(targetEntry).not.toBeNull();
        expect(typeof targetEntry?.atlasIndex).toBe('number');

        const dealSection = page.getByText('发牌调试 (图集索引)').locator('xpath=..');
        const playerSelect = dealSection.locator('select');
        const atlasInput = dealSection.locator('input[type="number"]');
        const dealButton = dealSection.getByRole('button', { name: /发到手牌|补到手牌|发指定牌/ });

        await playerSelect.selectOption('1');
        await atlasInput.fill(String(targetEntry!.atlasIndex));

        await expect(dealSection.getByText('牌库中存在:', { exact: false })).toBeVisible({ timeout: 5000 });

        const beforeScreenshot = getEvidenceScreenshotPath(testInfo, 'seat1-before-deal');
        await page.screenshot({ path: beforeScreenshot, fullPage: true });

        await dealButton.click();

        await expect.poll(async () => {
            const seat1After = await readSeatDeckSnapshot(page, '1');
            return {
                deckLength: seat1After.deck.length,
                handLength: seat1After.hand.length,
                deckTargetCount: seat1After.deck.filter((entry) => entry.id === targetEntry!.id).length,
                handTargetCount: seat1After.hand.filter((entry) => entry.id === targetEntry!.id).length,
            };
        }, { timeout: 5000 }).toMatchObject({
            deckLength: seat1Before.deck.length - 1,
            handLength: seat1Before.hand.length + 1,
            deckTargetCount: 0,
            handTargetCount: 1,
        });

        await atlasInput.fill(String(targetEntry!.atlasIndex));
        await expect(dealSection.getByText('当前不在剩余牌库，可直接补到手牌', { exact: false })).toBeVisible({ timeout: 5000 });
        await expect(dealButton).toBeEnabled();

        const afterFirstDealScreenshot = getEvidenceScreenshotPath(testInfo, 'seat1-after-first-deal-can-add');
        await page.screenshot({ path: afterFirstDealScreenshot, fullPage: true });

        await dealButton.click();

        await expect.poll(async () => {
            const seat1AfterSecondDeal = await readSeatDeckSnapshot(page, '1');
            return {
                deckLength: seat1AfterSecondDeal.deck.length,
                handLength: seat1AfterSecondDeal.hand.length,
                handTargetCount: seat1AfterSecondDeal.hand.filter((entry) => entry.id === targetEntry!.id).length,
            };
        }, { timeout: 5000 }).toMatchObject({
            deckLength: seat1Before.deck.length - 1,
            handLength: seat1Before.hand.length + 2,
            handTargetCount: 2,
        });

        const afterSecondDealScreenshot = getEvidenceScreenshotPath(testInfo, 'seat1-after-second-deal-direct-add');
        await page.screenshot({ path: afterSecondDealScreenshot, fullPage: true });
    });

});
