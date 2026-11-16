import type { Browser, BrowserContext, Page } from '@playwright/test';
import { ensureGameServerAvailable, getGameServerBaseURL, initContext, setChineseLocale, waitForTestHarness } from './common';
import { claimDTSeatViaAPI, createDTRoomViaAPI, seedDTMatchCredentials } from './dicethrone';

/** 在线真人对 AI 房间的公共夹具；不替任一座位执行游戏动作。 */
export async function setupDTOnlineAiRoom(
    browser: Browser,
    baseURL: string | undefined,
    options: { guestPrefix: string; hostName: string; aiName: string; retryHarness?: boolean; seedWaitMs?: number },
): Promise<{ hostPage: Page; hostContext: BrowserContext; matchId: string } | null> {
    const hostContext = await browser.newContext({ baseURL });
    try {
        await initContext(hostContext, {
            storageKey: '__dicethrone_storage_reset_online_ai',
            skipTutorial: false,
            skipImageGate: true,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        await setChineseLocale(hostContext);
        const hostPage = await hostContext.newPage();
        const pageErrors: string[] = [];
        hostPage.on('console', message => {
            if (message.type() === 'error' || message.type() === 'warning') {
                pageErrors.push(`[${message.type()}] ${message.text().substring(0, 300)}`);
            }
        });
        hostPage.on('pageerror', error => pageErrors.push(`[pageerror] ${error.message.substring(0, 300)}`));
        await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
        if (!await ensureGameServerAvailable(hostPage, getGameServerBaseURL())) {
            await hostContext.close();
            return null;
        }
        const guestId = `${options.guestPrefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await hostPage.addInitScript(id => {
            localStorage.setItem('guest_id', id);
            sessionStorage.setItem('guest_id', id);
            document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
        }, guestId);
        const matchId = await createDTRoomViaAPI(hostPage, {
            guestId, numPlayers: 2, gameServerBaseURL: getGameServerBaseURL(),
            setupData: { enableAi: true, seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 2000 } } },
        });
        if (!matchId) {
            await hostContext.close();
            return null;
        }
        const credentials = await claimDTSeatViaAPI(hostPage, matchId, '0', {
            guestId, playerName: options.hostName, gameServerBaseURL: getGameServerBaseURL(),
        });
        const aiCredentials = credentials && await claimDTSeatViaAPI(hostPage, matchId, '1', {
            guestId, playerName: options.aiName, gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!credentials || !aiCredentials) {
            await hostContext.close();
            return null;
        }
        const aiSeatCredentials = { '1': aiCredentials };
        await hostContext.addInitScript(({ targetMatchId, values }) => {
            localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(values));
            window.dispatchEvent(new Event('match-credentials-changed'));
        }, { targetMatchId: matchId, values: aiSeatCredentials });
        await hostPage.evaluate(({ targetMatchId, values }) => {
            localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(values));
            window.dispatchEvent(new Event('match-credentials-changed'));
        }, { targetMatchId: matchId, values: aiSeatCredentials });
        if (options.seedWaitMs) await hostPage.waitForTimeout(options.seedWaitMs);
        await seedDTMatchCredentials(hostContext, matchId, '0', credentials);
        await hostPage.goto(`/play/dicethrone/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
        try {
            await waitForTestHarness(hostPage, 20000);
        } catch (error) {
            if (!options.retryHarness) throw error;
            if (pageErrors.length) console.log('[setupDTOnlineAiRoom] 页面错误:', pageErrors.slice(-5).join('\n'));
            await hostPage.reload({ waitUntil: 'domcontentloaded' });
            await waitForTestHarness(hostPage, 20000);
        }
        return { hostPage, hostContext, matchId };
    } catch (error) {
        await hostContext.close();
        throw error;
    }
}
