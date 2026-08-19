import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath, withJpegEvidenceScreenshotOptions } from '../framework/evidenceScreenshots';
import { disableFabMenu, ensureDebugPanelClosed } from '../helpers/dicethrone';
import { waitForTestHarness } from '../helpers/common';

const OPEN_TIMEOUT_MS = 180000;
const HAND_CARD_IDS = ['card-just-this', 'card-play-six', 'card-unexpected'];
const DECK_CARD_IDS = ['card-flick', 'card-get-that-outta-here'];

type DiceThroneState = {
    core?: {
        players?: Record<string, {
            hand?: Array<{ id?: string }>;
            deck?: Array<{ id?: string }>;
        }>;
    };
};

type Rect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.jpg`,
        requireChineseName: true,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({ path, fullPage: false, timeout: 20000 }));
    return path;
};

const waitForHandCardsReady = async (page: Page, cardIds: string[]) => {
    await page.waitForFunction((expectedCardIds) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        return (expectedCardIds as string[]).every((cardId) => {
            const card = handArea.querySelector(`[data-card-id="${cardId}"]`);
            if (!card) return false;
            const rect = (card as HTMLElement).getBoundingClientRect();
            return rect.width > 0
                && rect.height > 0
                && card.getAttribute('data-is-flipped') === 'true';
        });
    }, cardIds, { timeout: 15000, polling: 100 });
    await page.waitForTimeout(500);
};

const getPlayerCards = async (page: Page) => page.evaluate(() => {
    const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.() as DiceThroneState | null | undefined;
    const player = state?.core?.players?.['0'];
    return {
        handIds: (player?.hand ?? []).map((card) => card.id),
        deckIds: (player?.deck ?? []).map((card) => card.id),
    };
});

const overlaps = (a: Rect, b: Rect) => (
    a.left < b.right
    && a.right > b.left
    && a.top < b.bottom
    && a.bottom > b.top
);

const assertHandToggleLayout = async (page: Page, expectedHidden: boolean) => {
    const snapshot = await page.evaluate(() => {
        const rectOf = (element: Element | null): Rect | null => {
            if (!element) return null;
            const rect = (element as HTMLElement).getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            };
        };
        const parseRgb = (value: string) => {
            const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return null;
            return {
                r: Number(match[1]),
                g: Number(match[2]),
                b: Number(match[3]),
            };
        };
        const luminance = (value: string) => {
            const rgb = parseRgb(value);
            if (!rgb) return -1;
            const channel = (next: number) => {
                const normalized = next / 255;
                return normalized <= 0.03928
                    ? normalized / 12.92
                    : ((normalized + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
        };

        const deck = document.querySelector('[data-tutorial-id="draw-deck"] > div');
        const toggle = document.querySelector('[data-testid="dicethrone-hand-visibility-toggle"]');
        const handArea = document.querySelector('[data-testid="hand-area"]') as HTMLElement | null;
        const handCards = Array.from(document.querySelectorAll('[data-testid="hand-area"] [data-card-id]'))
            .map((card) => rectOf(card))
            .filter((rect): rect is Rect => Boolean(rect));
        const toggleStyle = toggle ? window.getComputedStyle(toggle) : null;
        const handStyle = handArea ? window.getComputedStyle(handArea) : null;

        return {
            deckRect: rectOf(deck),
            toggleRect: rectOf(toggle),
            handCards,
            ariaPressed: toggle?.getAttribute('aria-pressed') ?? null,
            handHiddenAttr: handArea?.getAttribute('data-hand-hidden') ?? null,
            handDisplay: handStyle?.display ?? null,
            backgroundColor: toggleStyle?.backgroundColor ?? '',
            textColor: toggleStyle?.color ?? '',
            backgroundLuminance: toggleStyle ? luminance(toggleStyle.backgroundColor) : -1,
            textLuminance: toggleStyle ? luminance(toggleStyle.color) : -1,
            iconClass: toggle?.querySelector('svg')?.getAttribute('class') ?? '',
            viewportWidth: window.innerWidth,
        };
    });

    expect(snapshot.deckRect, '牌堆本体必须可定位').not.toBeNull();
    expect(snapshot.toggleRect, '手牌收起按钮必须可定位').not.toBeNull();
    expect(snapshot.toggleRect!.width, '按钮可见面不能过小').toBeGreaterThanOrEqual(44);
    expect(snapshot.toggleRect!.height, '按钮可见面不能过小').toBeGreaterThanOrEqual(44);
    expect(snapshot.toggleRect!.left, '按钮必须悬挂在牌堆右侧外面，不能压在牌堆上')
        .toBeGreaterThanOrEqual(snapshot.deckRect!.right + Math.max(6, snapshot.viewportWidth * 0.002));
    expect(overlaps(snapshot.toggleRect!, snapshot.deckRect!), '按钮不得和抽牌堆重叠').toBe(false);
    expect(snapshot.handCards.some((cardRect) => overlaps(snapshot.toggleRect!, cardRect)), '按钮不得压住任何手牌').toBe(false);
    expect(snapshot.backgroundLuminance, `按钮背景必须明亮可见，当前 ${snapshot.backgroundColor}`).toBeGreaterThan(0.65);
    expect(snapshot.textLuminance, `按钮图标必须是深色高对比，当前 ${snapshot.textColor}`).toBeLessThan(0.08);
    expect(snapshot.ariaPressed).toBe(expectedHidden ? 'true' : 'false');
    expect(snapshot.handHiddenAttr).toBe(expectedHidden ? 'true' : 'false');
    expect(snapshot.handDisplay).toBe(expectedHidden ? 'none' : 'flex');
    expect(snapshot.iconClass).toContain(expectedHidden ? 'lucide-chevron-up' : 'lucide-chevron-down');
};

test.describe('DiceThrone 手牌收起按钮', () => {
    test('收起按钮保持外悬挂且清晰可见，点击只隐藏 UI 不重新发牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('dicethrone', { playerID: '0' }, OPEN_TIMEOUT_MS);
        await waitForTestHarness(page, 40000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await ensureDebugPanelClosed(page);
        await disableFabMenu(page);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: HAND_CARD_IDS,
                deck: DECK_CARD_IDS,
                resources: { CP: 3, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
            },
        });

        await expect.poll(() => getPlayerCards(page), { timeout: 10000 }).toEqual({
            handIds: HAND_CARD_IDS,
            deckIds: DECK_CARD_IDS,
        });
        await waitForHandCardsReady(page, HAND_CARD_IDS);

        const toggle = page.getByTestId('dicethrone-hand-visibility-toggle');
        await expect(toggle).toBeVisible({ timeout: 10000 });
        await expect(toggle.locator('.lucide-chevron-down')).toBeVisible();
        await assertHandToggleLayout(page, false);
        const firstCardKey = await page.locator(`[data-testid="hand-area"] [data-card-id="${HAND_CARD_IDS[0]}"]`).first().getAttribute('data-card-key');
        await saveEvidenceScreenshot(page, testInfo, '01-手牌展开-收起按钮在抽牌堆右下外侧且清晰');

        await toggle.click();
        await expect(page.getByTestId('hand-area')).toHaveAttribute('data-hand-hidden', 'true');
        await expect(toggle.locator('.lucide-chevron-up')).toBeVisible();
        await assertHandToggleLayout(page, true);
        await expect.poll(() => getPlayerCards(page), { timeout: 5000 }).toEqual({
            handIds: HAND_CARD_IDS,
            deckIds: DECK_CARD_IDS,
        });
        const hiddenCardKey = await page.locator(`[data-testid="hand-area"] [data-card-id="${HAND_CARD_IDS[0]}"]`).first().getAttribute('data-card-key');
        expect(hiddenCardKey).toBe(firstCardKey);
        await saveEvidenceScreenshot(page, testInfo, '02-点击后手牌收起-按钮仍清晰可见且未重新发牌');
    });
});
