import type { Browser, BrowserContextOptions, Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
    cleanupDTMatch,
    readyAndStartGame,
    selectCharacter,
    setupDTOnlineMatchWithPlayers,
    waitForDiceThroneHarness,
    waitForGameBoard,
    type DTMultiMatchSetup,
} from '../helpers/dicethrone';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';

type JsonRecord = Record<string, unknown>;

type StatusAtlasTrafficEntry = {
    url: string;
    status?: number;
    contentType?: string;
    failure?: string;
};

type BadgeImageSnapshot = {
    src: string;
    sourceUrl: string;
    naturalWidth: number;
    naturalHeight: number;
};

const asRecord = (value: unknown): JsonRecord =>
    value && typeof value === 'object' ? value as JsonRecord : {};

const asRecordMap = (value: unknown): Record<string, JsonRecord> =>
    value && typeof value === 'object' ? value as Record<string, JsonRecord> : {};

const evidenceDir = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    'dicethrone',
    'DiceThrone-枪手状态token图集',
);

const MOBILE_CONTEXT_OPTIONS: BrowserContextOptions = {
    viewport: { width: 915, height: 412 },
    screen: { width: 915, height: 412 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

const localStatusAtlasRequestPattern =
    /\/assets\/i18n\/(?:zh-CN|en)\/dicethrone\/images\/(?:gunslinger|monk)\/(?:compressed\/)?status-icons-atlas\.(?:json|webp)(?:[?#].*)?$/;

const statusAtlasTrafficPattern =
    /dicethrone\/images\/(?:gunslinger|monk)\/(?:compressed\/)?status-icons-atlas\.(?:json|webp)(?:[?#].*)?$/;

const installBrokenLocalStatusAtlasRoutes = async (page: Page) => {
    await page.route(localStatusAtlasRequestPattern, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'text/html; charset=utf-8',
            body: '<!doctype html><html><head><title>易桌游</title></head><body>首页</body></html>',
        });
    });
};

const captureStatusAtlasTraffic = (page: Page, traffic: StatusAtlasTrafficEntry[]) => {
    page.on('requestfailed', (request) => {
        const url = request.url();
        if (!statusAtlasTrafficPattern.test(url)) {
            return;
        }
        traffic.push({
            url,
            failure: request.failure()?.errorText ?? 'unknown request failure',
        });
    });
    page.on('response', (response) => {
        const url = response.url();
        if (!statusAtlasTrafficPattern.test(url)) {
            return;
        }
        traffic.push({
            url,
            status: response.status(),
            contentType: response.headers()['content-type'] ?? '',
        });
    });
};

const setupGunslingerMatch = async (
    browser: Browser,
    baseURL: string | undefined,
    contextOptions?: BrowserContextOptions,
): Promise<{ match: DTMultiMatchSetup; traffic: StatusAtlasTrafficEntry[] }> => {
    const match = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
        numPlayers: 2,
        skipImageGate: true,
        characterSelectionTimeout: 240000,
        contextOptions,
    });
    if (!match || !match.guestPage) {
        test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
        throw new Error('DiceThrone online setup failed');
    }

    await installBrokenLocalStatusAtlasRoutes(match.hostPage);
    await installBrokenLocalStatusAtlasRoutes(match.guestPage);
    const traffic: StatusAtlasTrafficEntry[] = [];
    captureStatusAtlasTraffic(match.hostPage, traffic);
    captureStatusAtlasTraffic(match.guestPage, traffic);

    await selectCharacter(match.hostPage, 'gunslinger');
    await selectCharacter(match.guestPage, 'monk');
    await readyAndStartGame(match.hostPage, match.guestPage);
    await waitForGameBoard(match.hostPage);
    await waitForGameBoard(match.guestPage);
    await waitForDiceThroneHarness(match.hostPage);
    await waitForDiceThroneHarness(match.guestPage);

    if (!contextOptions?.viewport) {
        await match.hostPage.setViewportSize({ width: 1280, height: 720 });
        await match.guestPage.setViewportSize({ width: 1280, height: 720 });
    }

    return { match, traffic };
};

const injectVisibleGunslingerStatusIcons = async (match: DTMultiMatchSetup) => {
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
            [TOKEN_IDS.LOADED]: 1,
            [TOKEN_IDS.BOUNTY]: 1,
            [TOKEN_IDS.EVASIVE]: 1,
        },
        statusEffects: {
            ...asRecord(host.statusEffects),
            [STATUS_IDS.KNOCKDOWN]: 1,
        },
        resources: {
            ...hostResources,
            [RESOURCE_IDS.HP]: 50,
            [RESOURCE_IDS.CP]: 5,
        },
    };
    players['1'] = {
        ...guest,
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
    await match.guestPage?.waitForTimeout(800);
};

const readBadgeImageSnapshot = async (page: Page, testId: string): Promise<BadgeImageSnapshot> => {
    const badge = page.getByTestId(testId);
    await expect(badge).toBeVisible({ timeout: 15000 });
    const image = badge.locator('img').first();
    await expect(image).toBeVisible({ timeout: 15000 });
    return image.evaluate((node) => {
        const img = node as HTMLImageElement;
        return {
            src: img.currentSrc || img.src || '',
            sourceUrl: img.dataset.statusSourceUrl ?? '',
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
        };
    });
};

const waitForBadgeImageFromAtlas = async (page: Page, testId: string, expectedPathPart: string) => {
    await expect.poll(async () => {
        const snapshot = await readBadgeImageSnapshot(page, testId).catch(() => null);
        if (!snapshot) return false;
        const source = snapshot.sourceUrl || snapshot.src;
        return snapshot.naturalWidth > 0
            && snapshot.naturalHeight > 0
            && source.includes(expectedPathPart);
    }, { timeout: 20000, intervals: [200, 400, 800] }).toBe(true);
};

const readStatusTokenImageSources = async (page: Page, rootSelector: string): Promise<string[]> =>
    page.evaluate((selector) => {
        const root = document.querySelector(selector);
        if (!root) return [];
        return Array.from(root.querySelectorAll('img'))
            .map((node) => {
                const img = node as HTMLImageElement;
                return img.naturalWidth > 0 && img.naturalHeight > 0
                    ? img.dataset.statusSourceUrl || img.currentSrc || img.src || ''
                    : '';
            })
            .filter(Boolean);
    }, rootSelector);

const readStatusTokenDebugSnapshot = async (page: Page, rootSelector: string) =>
    page.evaluate((selector) => {
        const roots = Array.from(document.querySelectorAll(selector));
        return {
            url: window.location.href,
            rootCount: roots.length,
            roots: roots.map((root, index) => ({
                index,
                text: (root.textContent ?? '').replace(/\s+/g, ' ').trim(),
                html: root.innerHTML.slice(0, 2500),
                badges: Array.from(root.querySelectorAll('[data-token-id]')).map((node) => {
                    const badge = node as HTMLElement;
                    const image = badge.querySelector('img') as HTMLImageElement | null;
                    const iconBox = badge.firstElementChild as HTMLElement | null;
                    return {
                        tokenId: badge.dataset.tokenId ?? '',
                        testId: badge.dataset.testid ?? '',
                        amount: badge.dataset.tokenAmount ?? '',
                        max: badge.dataset.tokenMax ?? '',
                        className: badge.className,
                        iconClassName: iconBox?.className ?? '',
                        imageSrc: image?.currentSrc || image?.src || '',
                        imageSourceUrl: image?.dataset.statusSourceUrl ?? '',
                        imageNaturalWidth: image?.naturalWidth ?? 0,
                        imageNaturalHeight: image?.naturalHeight ?? 0,
                        imageComplete: image?.complete ?? false,
                        imageCrossOrigin: image?.crossOrigin ?? '',
                    };
                }),
                imageCount: root.querySelectorAll('img').length,
                images: Array.from(root.querySelectorAll('img')).map((node) => {
                    const image = node as HTMLImageElement;
                    return {
                        src: image.currentSrc || image.src || '',
                        sourceUrl: image.dataset.statusSourceUrl ?? '',
                        naturalWidth: image.naturalWidth,
                        naturalHeight: image.naturalHeight,
                        complete: image.complete,
                        crossOrigin: image.crossOrigin,
                        className: image.className,
                        style: image.getAttribute('style') ?? '',
                    };
                }),
            })),
        };
    }, rootSelector);

const waitForStatusTokenAtlasImages = async (
    page: Page,
    rootSelector: string,
    minimumCount: number,
    traffic?: StatusAtlasTrafficEntry[],
): Promise<string[]> => {
    try {
        await expect.poll(async () => {
            const sources = await readStatusTokenImageSources(page, rootSelector);
            return sources.filter((src) => src.includes('status-icons-atlas')).length;
        }, { timeout: 20000, intervals: [200, 400, 800] }).toBeGreaterThanOrEqual(minimumCount);
    } catch (error) {
        const snapshot = await readStatusTokenDebugSnapshot(page, rootSelector).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const message = error instanceof Error ? error.message : String(error);
        const trafficText = traffic ? `\n状态图集网络记录:\n${JSON.stringify(traffic, null, 2)}` : '';
        throw new Error(`${message}\n状态 token DOM 快照:\n${JSON.stringify(snapshot, null, 2)}${trafficText}`);
    }

    return readStatusTokenImageSources(page, rootSelector);
};

const expectOfficialStatusAtlasImageTraffic = async (traffic: StatusAtlasTrafficEntry[]) => {
    await expect.poll(() => {
        const official = traffic.filter((entry) =>
            entry.url.includes('https://assets.easyboardgame.top/official')
            && entry.status === 200,
        );
        return {
            gunslingerWebp: official.some((entry) =>
                entry.url.includes('/gunslinger/compressed/status-icons-atlas.webp')
                && entry.contentType.includes('image/webp'),
            ),
            monkWebp: official.some((entry) =>
                entry.url.includes('/monk/compressed/status-icons-atlas.webp')
                && entry.contentType.includes('image/webp'),
            ),
        };
    }, { timeout: 20000, intervals: [200, 400, 800] }).toEqual({
        gunslingerWebp: true,
        monkWebp: true,
    });
};

test.describe('DiceThrone 枪手状态 token 图集', () => {
    test('网页端本地图集错源时，枪手 token/status 应回退服务器素材主源并显示图标', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const { match, traffic } = await setupGunslingerMatch(browser, baseURL);

        try {
            await injectVisibleGunslingerStatusIcons(match);

            const statusRoot = '[data-tutorial-id="status-tokens"]';
            await waitForStatusTokenAtlasImages(match.hostPage, statusRoot, 4, traffic);

            await waitForBadgeImageFromAtlas(
                match.hostPage,
                `dt-player-0-token-${TOKEN_IDS.LOADED}`,
                '/gunslinger/compressed/status-icons-atlas.webp',
            );
            await waitForBadgeImageFromAtlas(
                match.hostPage,
                `dt-player-0-token-${TOKEN_IDS.BOUNTY}`,
                '/gunslinger/compressed/status-icons-atlas.webp',
            );
            await waitForBadgeImageFromAtlas(
                match.hostPage,
                `dt-player-0-token-${TOKEN_IDS.EVASIVE}`,
                '/monk/compressed/status-icons-atlas.webp',
            );
            await waitForBadgeImageFromAtlas(
                match.hostPage,
                `dt-player-0-status-${STATUS_IDS.KNOCKDOWN}`,
                '/monk/compressed/status-icons-atlas.webp',
            );
            await expectOfficialStatusAtlasImageTraffic(traffic);

            await mkdir(evidenceDir, { recursive: true });
            await match.hostPage.screenshot({
                path: join(evidenceDir, '01-网页端-枪手状态token图集回退后.png'),
                fullPage: false,
            });
            await match.hostPage.locator(statusRoot).screenshot({
                path: join(evidenceDir, '02-网页端-枪手状态token局部.png'),
            });
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('手机端本地图集错源时，玩家状态区中的枪手 token/status 应显示图标', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const { match, traffic } = await setupGunslingerMatch(browser, baseURL, MOBILE_CONTEXT_OPTIONS);

        try {
            await injectVisibleGunslingerStatusIcons(match);

            const statusRoot = '[data-tutorial-id="status-tokens"]';
            await waitForStatusTokenAtlasImages(match.hostPage, statusRoot, 4, traffic);

            await waitForBadgeImageFromAtlas(
                match.hostPage,
                `dt-player-0-token-${TOKEN_IDS.LOADED}`,
                '/gunslinger/compressed/status-icons-atlas.webp',
            );
            await waitForBadgeImageFromAtlas(
                match.hostPage,
                `dt-player-0-token-${TOKEN_IDS.BOUNTY}`,
                '/gunslinger/compressed/status-icons-atlas.webp',
            );
            await waitForBadgeImageFromAtlas(
                match.hostPage,
                `dt-player-0-token-${TOKEN_IDS.EVASIVE}`,
                '/monk/compressed/status-icons-atlas.webp',
            );
            await waitForBadgeImageFromAtlas(
                match.hostPage,
                `dt-player-0-status-${STATUS_IDS.KNOCKDOWN}`,
                '/monk/compressed/status-icons-atlas.webp',
            );
            await expectOfficialStatusAtlasImageTraffic(traffic);

            await mkdir(evidenceDir, { recursive: true });
            await match.hostPage.screenshot({
                path: join(evidenceDir, '03-手机端-枪手状态token玩家状态区.png'),
                fullPage: false,
            });
            await match.hostPage.locator(statusRoot).screenshot({
                path: join(evidenceDir, '04-手机端-枪手状态token局部.png'),
            });
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
