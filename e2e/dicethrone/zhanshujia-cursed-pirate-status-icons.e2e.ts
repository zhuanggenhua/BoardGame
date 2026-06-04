import type { Browser, Page } from '@playwright/test';
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

const setupNewHeroMatch = async (browser: Browser, baseURL: string | undefined): Promise<DTMatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 240000,
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
    await match.hostPage.setViewportSize({ width: 1280, height: 720 });
    await match.guestPage.setViewportSize({ width: 1280, height: 720 });
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
            [TOKEN_IDS.TACTICAL_ADVANTAGE]: 1,
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
    className: string;
};

const readStatusTokenSpriteSnapshots = async (page: Page): Promise<BadgeSpriteSnapshot[]> =>
    page.evaluate(() => {
        const root = document.querySelector('[data-tutorial-id="status-tokens"]');
        if (!root) return [];

        return Array.from(root.querySelectorAll('.rounded-full'))
            .map((badge) => {
                const badgeElement = badge as HTMLElement;
                const icon = badgeElement.querySelector('span') as HTMLElement | null;
                const iconStyle = icon ? window.getComputedStyle(icon) : null;
                return {
                    backgroundImage: iconStyle?.backgroundImage ?? '',
                    backgroundSize: iconStyle?.backgroundSize ?? '',
                    backgroundPosition: iconStyle?.backgroundPosition ?? '',
                    className: badgeElement.className,
                };
            })
            .filter((entry) => entry.backgroundImage.includes('status-icons-atlas'));
    });

const waitForStatusTokenSprites = async (
    page: Page,
    minimumCount: number,
): Promise<BadgeSpriteSnapshot[]> => {
    await page.waitForFunction((count) => {
        const root = document.querySelector('[data-tutorial-id="status-tokens"]');
        if (!root) return false;
        const entries = Array.from(root.querySelectorAll('.rounded-full')).filter((badge) => {
            const badgeElement = badge as HTMLElement;
            const icon = badgeElement.querySelector('span') as HTMLElement | null;
            const iconStyle = icon ? window.getComputedStyle(icon) : null;
            return Boolean(
                iconStyle?.backgroundImage.includes('status-icons-atlas')
                && !badgeElement.className.includes('bg-gradient-to-br'),
            );
        });
        return entries.length >= count;
    }, minimumCount, { timeout: 15000, polling: 200 });

    return readStatusTokenSpriteSnapshots(page);
};

test.describe('DiceThrone 战术家 / 咒缚海盗状态图标', () => {
    test('血条上方新英雄 token/status 应命中状态图集 sprite，不应退回纯色圆形', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await injectVisibleNewHeroStatusIcons(match);

            const hostSprites = await waitForStatusTokenSprites(match.hostPage, 2);
            const guestSprites = await waitForStatusTokenSprites(match.guestPage, 4);

            expect(hostSprites).toHaveLength(2);
            expect(guestSprites).toHaveLength(4);
            for (const sprite of [...hostSprites, ...guestSprites]) {
                expect(sprite.backgroundImage).toContain('status-icons-atlas');
                expect(sprite.className).not.toContain('bg-gradient-to-br');
                expect(sprite.backgroundSize).not.toBe('');
                expect(sprite.backgroundPosition).not.toBe('');
            }

            await mkdir(statusIconEvidenceDir, { recursive: true });
            await match.hostPage.locator('[data-tutorial-id="status-tokens"]').screenshot({
                path: join(statusIconEvidenceDir, 'host-status-token-sprites.png'),
            });
            await match.guestPage.locator('[data-tutorial-id="status-tokens"]').screenshot({
                path: join(statusIconEvidenceDir, 'guest-status-token-sprites.png'),
            });
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
