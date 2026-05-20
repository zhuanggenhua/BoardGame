import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
} from '../framework/evidenceScreenshots';
import {
    createGuestId,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    seedMatchCredentials,
    waitForHomeGameList,
} from '../helpers/common';

type ManualAiSeatController = {
    type: 'local-ai';
    minimumActionDelayMs: number;
    manualFactionSelection: true;
};

async function createTwoPlayerSmashUpAiRoom(args: {
    page: Page;
    guestId: string;
}): Promise<string> {
    const base = getGameServerBaseURL();
    const response = await args.page.request.post(`${base}/games/smashup/create`, {
        data: {
            numPlayers: 2,
            setupData: {
                guestId: args.guestId,
                ownerKey: `guest:${args.guestId}`,
                ownerType: 'guest',
                enableAi: true,
                seatControllers: {
                    '1': {
                        type: 'local-ai',
                        minimumActionDelayMs: 0,
                        manualFactionSelection: true,
                    } satisfies ManualAiSeatController,
                },
            },
        },
    });
    expect(response.ok()).toBeTruthy();

    const data = (await response.json().catch(() => null)) as { matchID?: string } | null;
    expect(data?.matchID).toBeTruthy();
    if (!data?.matchID) {
        throw new Error('未能创建 SmashUp 两人 AI 在线房间');
    }
    return data.matchID;
}

async function claimSeat(args: {
    page: Page;
    matchId: string;
    playerId: string;
    playerName: string;
    guestId: string;
}): Promise<string> {
    const base = getGameServerBaseURL();
    const response = await args.page.request.post(`${base}/games/smashup/${args.matchId}/claim-seat`, {
        data: {
            playerID: args.playerId,
            playerName: args.playerName,
            guestId: args.guestId,
        },
    });
    expect(response.ok()).toBeTruthy();

    const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
    expect(data?.playerCredentials).toBeTruthy();
    if (!data?.playerCredentials) {
        throw new Error(`未能领取 SmashUp ${args.playerId} 号位凭据`);
    }
    return data.playerCredentials;
}

async function seedAiSeatCredentials(
    target: BrowserContext | Page,
    matchId: string,
    aiSeatCredentials: Record<string, string>,
) {
    await target.addInitScript(
        ({ targetMatchId, targetSeatCredentials }) => {
            localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(targetSeatCredentials));
            window.dispatchEvent(new Event('match-credentials-changed'));
        },
        { targetMatchId: matchId, targetSeatCredentials: aiSeatCredentials },
    );
}

async function prepareHostContext(context: BrowserContext, guestId: string) {
    await initContext(context, {
        storageKey: '__smashup_player_rail_online__',
        skipImageGate: true,
    });
    await context.addInitScript((id) => {
        localStorage.setItem('guest_id', id);
        sessionStorage.setItem('guest_id', id);
        document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
    }, guestId);
}

test.describe('SmashUp 在线派系选择 rail', () => {
    test('两人在线房的玩家卡与已选派系摘要不应被压成过小尺寸', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const hostContext = await browser.newContext({ baseURL });
        const guestId = createGuestId('su-rail-online');
        await prepareHostContext(hostContext, guestId);

        const page = await hostContext.newPage();

        try {
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await waitForHomeGameList(page);
            test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');

            const matchId = await createTwoPlayerSmashUpAiRoom({
                page,
                guestId,
            });

            const hostCredentials = await claimSeat({
                page,
                matchId,
                playerId: '0',
                playerName: 'Host-Rail',
                guestId,
            });
            const aiCredentials = await claimSeat({
                page,
                matchId,
                playerId: '1',
                playerName: 'AI-Rail',
                guestId,
            });

            await seedMatchCredentials(hostContext, 'smashup', matchId, '0', hostCredentials);
            await seedAiSeatCredentials(hostContext, matchId, { '1': aiCredentials });

            await page.goto(`/play/smashup/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i })).toBeVisible({ timeout: 30000 });
            await expect(page.getByTestId('faction-selection-player-rail')).toBeVisible({ timeout: 30000 });
            await expect(page.getByTestId('faction-selection-player-card-0')).toBeVisible({ timeout: 30000 });
            await expect(page.getByTestId('faction-selection-player-card-1')).toBeVisible({ timeout: 30000 });

            const metrics = await page.evaluate(() => {
                const cards = Array.from(document.querySelectorAll('[data-testid^="faction-selection-player-card-"]')) as HTMLElement[];
                return cards.map((card) => {
                    const rect = card.getBoundingClientRect();
                    const children = Array.from(card.children) as HTMLElement[];
                    const slotRow = children[1] ?? null;
                    const firstSlot = slotRow?.firstElementChild as HTMLElement | null;
                    const nameLabel = children[2]?.querySelector('span') as HTMLElement | null;
                    return {
                        width: rect.width,
                        height: rect.height,
                        slotWidth: firstSlot?.getBoundingClientRect().width ?? 0,
                        nameFontSize: nameLabel ? Number.parseFloat(window.getComputedStyle(nameLabel).fontSize) : 0,
                    };
                });
            });

            expect(metrics.length).toBeGreaterThanOrEqual(2);
            const widths = metrics.map((item) => item.width);
            const slotWidths = metrics.map((item) => item.slotWidth);
            const nameFontSizes = metrics.map((item) => item.nameFontSize);

            expect(Math.min(...widths), '两人在线房玩家卡不能再退化成 80px 级别便签宽度').toBeGreaterThanOrEqual(100);
            expect(Math.min(...slotWidths), '玩家卡中的已选派系摘要槽位必须保持可辨识尺寸').toBeGreaterThanOrEqual(28);
            expect(Math.min(...nameFontSizes), '玩家名字体不能再缩到 9px 以下').toBeGreaterThanOrEqual(9);

            await page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'two-player-online-selection'),
                fullPage: false,
            });
            await page.getByTestId('faction-selection-player-rail').screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'two-player-online-player-rail'),
            });
        } finally {
            await hostContext.close();
        }
    });
});
