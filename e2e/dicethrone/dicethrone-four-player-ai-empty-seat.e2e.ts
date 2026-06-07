import { test, expect } from '../framework';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    claimDTSeatViaAPI,
    createDTRoomViaAPI,
    seedDTMatchCredentials,
} from '../helpers/dicethrone';
import {
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    setChineseLocale,
    waitForTestHarness,
} from '../helpers/common';

test.describe('DiceThrone 四人 AI 空真人座位', () => {
    test('四人房第三座保持真人空位时，房主加载对局页不应被自动踢回大厅', async ({ browser, baseURL }) => {
        test.setTimeout(90_000);
        const context = await browser.newContext({ baseURL });
        await initContext(context, {
            storageKey: '__dicethrone_four_player_ai_empty_seat',
            skipImageGate: true,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        await setChineseLocale(context);

        const page = await context.newPage();
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        test.skip(!(await ensureGameServerAvailable(page, getGameServerBaseURL())), '游戏服务器不可用');

        const guestId = `dt_four_ai_empty_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await context.addInitScript((id) => {
            localStorage.setItem('guest_id', id);
            sessionStorage.setItem('guest_id', id);
            document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
        }, guestId);

        const matchId = await createDTRoomViaAPI(page, {
            guestId,
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
            setupData: {
                enableAi: true,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', minimumActionDelayMs: 0 },
                    '2': { type: 'human' },
                    '3': { type: 'local-ai', minimumActionDelayMs: 0 },
                },
            },
        });
        expect(matchId).toBeTruthy();

        const hostCredentials = await claimDTSeatViaAPI(page, matchId!, '0', {
            guestId,
            playerName: '四人房房主',
            gameServerBaseURL: getGameServerBaseURL(),
        });
        expect(hostCredentials).toBeTruthy();
        await seedDTMatchCredentials(context, matchId!, '0', hostCredentials!);

        const aiSeatCredentials: Record<string, string> = {};
        for (const playerId of ['1', '3']) {
            const credentials = await claimDTSeatViaAPI(page, matchId!, playerId, {
                guestId,
                playerName: `AI-${playerId}`,
                gameServerBaseURL: getGameServerBaseURL(),
            });
            expect(credentials).toBeTruthy();
            aiSeatCredentials[playerId] = credentials!;
        }

        await context.addInitScript(({ targetMatchId, credentials }) => {
            localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(credentials));
        }, { targetMatchId: matchId!, credentials: aiSeatCredentials });

        await page.goto(`/play/dicethrone/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
        await waitForTestHarness(page, 20000);
        await page.waitForTimeout(12000);

        await expect(page).toHaveURL(new RegExp(`/play/dicethrone/match/${matchId}\\?playerID=0`));
        await expect.poll(async () => page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_creds_${targetMatchId}`);
            return raw ? JSON.parse(raw).playerID : null;
        }, matchId), {
            timeout: 5000,
        }).toBe('0');

        const aiCreds = await page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_ai_creds_${targetMatchId}`);
            return raw ? JSON.parse(raw) : null;
        }, matchId);
        expect(aiCreds).toEqual({
            '1': aiSeatCredentials['1'],
            '3': aiSeatCredentials['3'],
        });

        const evidenceDir = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            '_shared',
            'dicethrone-four-player-ai-empty-seat',
        );
        mkdirSync(evidenceDir, { recursive: true });
        await page.screenshot({
            path: join(evidenceDir, 'dicethrone-four-player-ai-empty-seat-still-in-match.png'),
            fullPage: false,
            timeout: 5000,
        });

        await context.close();
    });
});
