import type { Browser, BrowserContextOptions, Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
    cleanupDTMatch,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
    type DTMatchSetup,
} from '../helpers/dicethrone';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
    value && typeof value === 'object' ? value as JsonRecord : {};

const asRecordMap = (value: unknown): Record<string, JsonRecord> =>
    value && typeof value === 'object' ? value as Record<string, JsonRecord> : {};

const statusIconEvidenceDir = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    'dicethrone',
    'zhanshujia-cursed-pirate-status-icons.e2e',
);

const MOBILE_STATUS_CONTEXT_OPTIONS: BrowserContextOptions = {
    viewport: { width: 915, height: 412 },
    screen: { width: 915, height: 412 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

const setupNewHeroMatch = async (
    browser: Browser,
    baseURL: string | undefined,
    contextOptions?: BrowserContextOptions,
): Promise<DTMatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 240000,
        contextOptions,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
        throw new Error('DiceThrone online setup failed');
    }

    await selectCharacter(match.hostPage, 'zhanshujia');
    await selectCharacter(match.guestPage, 'cursed_pirate');
    await readyAndStartGame(match.hostPage, match.guestPage);
    await waitForGameBoard(match.hostPage);
    await waitForGameBoard(match.guestPage);
    await waitForDiceThroneHarness(match.hostPage);
    await waitForDiceThroneHarness(match.guestPage);
    if (!contextOptions?.viewport) {
        await match.hostPage.setViewportSize({ width: 1280, height: 720 });
        await match.guestPage.setViewportSize({ width: 1280, height: 720 });
    }
    return match;
};

const injectVisibleNewHeroStatusIcons = async (match: DTMatchSetup) => {
    const current = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
    const next = structuredClone(current);
    const root = asRecord(next.G ?? next);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecordMap(core.players);
    const host = asRecord(players['0']);
    const guest = asRecord(players['1']);
    const hostResources = asRecord(host.resources);
    const guestResources = asRecord(guest.resources);
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(players);

    players['0'] = {
        ...host,
        tokens: {
            ...asRecord(host.tokens),
            [TOKEN_IDS.TACTICAL_ADVANTAGE]: 3,
        },
        statusEffects: {
            ...asRecord(host.statusEffects),
            [STATUS_IDS.BIND]: 1,
        },
        resources: {
            ...hostResources,
            [RESOURCE_IDS.HP]: 50,
            [RESOURCE_IDS.CP]: 5,
        },
    };
    players['1'] = {
        ...guest,
        tokens: asRecord(guest.tokens),
        statusEffects: {
            ...asRecord(guest.statusEffects),
            [STATUS_IDS.CURSED_COIN]: 1,
            [STATUS_IDS.POWDER_KEG]: 1,
            [STATUS_IDS.WITHER]: 1,
            [STATUS_IDS.PARLEY]: 1,
        },
        resources: {
            ...guestResources,
            [RESOURCE_IDS.HP]: 50,
            [RESOURCE_IDS.CP]: 5,
        },
    };

    root.core = {
        ...core,
        phase: typeof core.phase === 'string' ? core.phase : sys.phase,
        players,
    };
    root.sys = {
        ...sys,
        matchId: match.matchId,
        turnOrder,
        currentPlayerIndex: typeof sys.currentPlayerIndex === 'number' ? sys.currentPlayerIndex : 0,
    };

    await injectMatchState(match.matchId, next, match.hostPage);
    await match.guestPage.waitForTimeout(800);
};

type BadgeSpriteSnapshot = {
    backgroundImage: string;
    backgroundSize: string;
    backgroundPosition: string;
    imageSrc: string;
    className: string;
    width: number;
    height: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
};

const readIconBadgeSnapshots = async (page: Page, rootSelector: string): Promise<BadgeSpriteSnapshot[]> =>
    page.evaluate((selector) => {
        const root = document.querySelector(selector);
        if (!root) return [];

        return Array.from(root.querySelectorAll('.rounded-full'))
            .map((badge) => {
                const badgeElement = badge as HTMLElement;
                if (!badgeElement.className.includes('overflow-hidden')) {
                    return null;
                }
                const image = badgeElement.querySelector('img') as HTMLImageElement | null;
                const spriteSpan = Array.from(badgeElement.querySelectorAll('span')).find((node) => {
                    const style = window.getComputedStyle(node);
                    return Boolean(style.backgroundImage && style.backgroundImage !== 'none');
                }) as HTMLElement | undefined;
                const iconStyle = spriteSpan ? window.getComputedStyle(spriteSpan) : (image ? window.getComputedStyle(image) : null);
                const imageSrc = image ? image.currentSrc || image.src || '' : '';
                const rect = badgeElement.getBoundingClientRect();
                return {
                    backgroundImage: iconStyle?.backgroundImage ?? '',
                    backgroundSize: iconStyle?.backgroundSize ?? '',
                    backgroundPosition: iconStyle?.backgroundPosition ?? '',
                    imageSrc,
                    className: badgeElement.className,
                    width: rect.width,
                    height: rect.height,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                };
            })
            .filter((entry): entry is BadgeSpriteSnapshot => Boolean(entry));
    }, rootSelector);

const readIconBadgeCount = async (page: Page, rootSelector: string): Promise<number> =>
    page.evaluate((selector) => (
        Array.from(document.querySelectorAll(`${selector} .rounded-full`))
            .filter((badge) => (badge as HTMLElement).className.includes('overflow-hidden'))
            .length
    ), rootSelector);

const waitForIconBadges = async (
    page: Page,
    rootSelector: string,
    minimumCount: number,
): Promise<BadgeSpriteSnapshot[]> => {
    await page.waitForFunction(({ selector, count }) => {
        const root = document.querySelector(selector);
        if (!root) return false;
        const entries = Array.from(root.querySelectorAll('.rounded-full')).filter((badge) => {
            const badgeElement = badge as HTMLElement;
            return badgeElement.className.includes('overflow-hidden');
        });
        return entries.length >= count;
    }, { selector: rootSelector, count: minimumCount }, { timeout: 15000, polling: 200 });

    return readIconBadgeSnapshots(page, rootSelector);
};

test.describe('DiceThrone 战术家 / 咒缚海盗状态图标', () => {
    test('血条上方新英雄 token/status 应命中状态图集 sprite，不应退回纯色圆形', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await injectVisibleNewHeroStatusIcons(match);

            const hostSprites = await waitForIconBadges(match.hostPage, '[data-tutorial-id="status-tokens"]', 2);
            const guestSprites = await waitForIconBadges(match.guestPage, '[data-tutorial-id="status-tokens"]', 4);
            const guestEnemyHeader = match.guestPage.locator('[data-testid="dt-top-header-1"]');
            const guestEnemyToken = guestEnemyHeader.getByTestId(`dt-player-0-token-${TOKEN_IDS.TACTICAL_ADVANTAGE}`);

            expect(hostSprites).toHaveLength(2);
            expect(guestSprites).toHaveLength(4);
            await expect(guestEnemyHeader.getByTestId('dt-top-header-1-hp-dot')).toBeVisible();
            await expect(guestEnemyHeader.getByTestId('dt-top-header-1-cp-dot')).toBeVisible();
            await expect(guestEnemyToken).toHaveAttribute('data-token-amount', '3');
            await expect(guestEnemyToken).toContainText('3');
            for (const sprite of [...hostSprites, ...guestSprites]) {
                expect(Boolean(sprite.imageSrc) || sprite.backgroundImage !== 'none').toBe(true);
                if (!sprite.imageSrc) {
                    expect(sprite.backgroundSize).not.toBe('');
                }
                expect(sprite.width).toBeGreaterThan(0);
                expect(sprite.height).toBeGreaterThan(0);
            }

            await mkdir(statusIconEvidenceDir, { recursive: true });
            await match.hostPage.locator('[data-tutorial-id="status-tokens"]').screenshot({
                path: join(statusIconEvidenceDir, 'host-status-token-sprites.png'),
            });
            await match.guestPage.locator('[data-tutorial-id="status-tokens"]').screenshot({
                path: join(statusIconEvidenceDir, 'guest-status-token-sprites.png'),
            });
            await guestEnemyHeader.screenshot({
                path: join(statusIconEvidenceDir, 'guest-enemy-header-hp-cp-token-count.png'),
            });
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('手机端初始无 badge，注入后新英雄 token/status 应可见且不为空白圆形', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL, MOBILE_STATUS_CONTEXT_OPTIONS);

        try {
            const visibleHeaderSelector = '[data-testid="dt-top-header-1"]';
            const hostInitialCount = await readIconBadgeCount(match.hostPage, visibleHeaderSelector);
            const guestInitialCount = await readIconBadgeCount(match.guestPage, visibleHeaderSelector);
            expect(hostInitialCount).toBeLessThan(4);
            expect(guestInitialCount).toBeLessThan(2);

            await mkdir(statusIconEvidenceDir, { recursive: true });
            await match.hostPage.screenshot({ path: join(statusIconEvidenceDir, 'mobile-host-status-token-initial.png'), fullPage: false });
            await match.guestPage.screenshot({ path: join(statusIconEvidenceDir, 'mobile-guest-status-token-initial.png'), fullPage: false });

            await injectVisibleNewHeroStatusIcons(match);

            const hostBadges = await waitForIconBadges(match.hostPage, visibleHeaderSelector, 4);
            const guestBadges = await waitForIconBadges(match.guestPage, visibleHeaderSelector, 2);

            expect(hostBadges).toHaveLength(4);
            expect(guestBadges).toHaveLength(2);
            for (const badge of [...hostBadges, ...guestBadges]) {
                expect(Boolean(badge.imageSrc) || badge.backgroundImage !== 'none').toBe(true);
                expect(badge.width).toBeGreaterThan(8);
                expect(badge.height).toBeGreaterThan(8);
                expect(badge.right).toBeGreaterThan(0);
                expect(badge.bottom).toBeGreaterThan(0);
            }

            await match.hostPage.screenshot({ path: join(statusIconEvidenceDir, 'mobile-host-status-token-final.png'), fullPage: false });
            await match.guestPage.screenshot({ path: join(statusIconEvidenceDir, 'mobile-guest-status-token-final.png'), fullPage: false });
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
