import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    createGuestId,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    seedMatchCredentials,
    waitForHomeGameList,
} from '../helpers/common';
import { waitForFactionDraft, waitForSmashUpUI } from '../helpers/smashup';
import { getMatchState } from '../helpers/state-injection';

type AutoAiSeatController = {
    type: 'local-ai';
    difficulty: 'expert';
};

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
}

async function createOnlineAiRoom(args: {
    page: Page;
    guestId: string;
    numPlayers: number;
    seatControllers: Record<string, AutoAiSeatController>;
}): Promise<string> {
    const base = getGameServerBaseURL();
    const response = await args.page.request.post(`${base}/games/smashup/create`, {
        data: {
            numPlayers: args.numPlayers,
            setupData: {
                guestId: args.guestId,
                ownerKey: `guest:${args.guestId}`,
                ownerType: 'guest',
                enableAi: true,
                seatControllers: args.seatControllers,
            },
        },
    });
    expect(response.ok()).toBeTruthy();

    const data = (await response.json().catch(() => null)) as { matchID?: string } | null;
    expect(data?.matchID).toBeTruthy();
    if (!data?.matchID) {
        throw new Error('未能创建 SmashUp 在线 AI 房间');
    }
    return data.matchID;
}

async function claimSeatViaApi(args: {
    page: Page;
    matchId: string;
    playerId: string;
    guestId: string;
    playerName: string;
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
        throw new Error(`未能为 SmashUp 的 ${args.playerId} 号位领取凭据`);
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

async function waitForAiSeatCredentials(page: Page, matchId: string, expectedSeatIds: string[]) {
    await expect.poll(async () => {
        return page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_ai_creds_${targetMatchId}`);
            if (!raw) return [];
            try {
                return Object.keys(JSON.parse(raw) as Record<string, string>).sort();
            } catch {
                return ['parse-error'];
            }
        }, matchId);
    }, {
        timeout: 10000,
        message: `等待 ${matchId} 的 AI 座位凭据写入本地`,
    }).toEqual([...expectedSeatIds].sort());
}

async function waitForOnlineAiSeatBridgeReady(page: Page, playerId: string) {
    await expect.poll(async () => {
        return page.evaluate((targetPlayerId) => {
            const debugApi = (window as Window & {
                __BG_ONLINE_AI_DEBUG__?: {
                    getSeatLatestState?: (pid: string) => unknown;
                };
            }).__BG_ONLINE_AI_DEBUG__;
            return Boolean(debugApi?.getSeatLatestState?.(targetPlayerId));
        }, playerId);
    }, {
        timeout: 20000,
        message: `等待在线 AI seat ${playerId} 的桥接客户端就绪`,
    }).toBe(true);
}

async function selectSmashUpFactionById(page: Page, factionId: string) {
    await expect(page.getByTestId(`faction-option-${factionId}`)).toBeVisible({ timeout: 10000 });
    await page.getByTestId(`faction-option-${factionId}`).click();

    const confirmButton = page.getByTestId('faction-confirm-button');
    await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(confirmButton).toBeEnabled({ timeout: 15000 });
    await confirmButton.click();
}

async function readSelectionProgress(matchId: string, page: Page) {
    const state = await getMatchState(matchId, page);
    return {
        phase: state.sys?.phase ?? null,
        currentPlayerIndex: state.core?.currentPlayerIndex ?? null,
        host: state.core?.factionSelection?.playerSelections?.['0']?.length ?? 0,
        ai1: state.core?.factionSelection?.playerSelections?.['1']?.length ?? 0,
        ai2: state.core?.factionSelection?.playerSelections?.['2']?.length ?? 0,
        ai3: state.core?.factionSelection?.playerSelections?.['3']?.length ?? 0,
    };
}

test('SmashUp 四人房 host + 3 AI 自动选派系应完整跑通并回到 playCards', async ({ browser }, testInfo) => {
    test.setTimeout(240000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({ baseURL });
    const guestId = createGuestId('su-auto-ai');
    await initContext(hostContext, {
        storageKey: '__smashup_auto_ai_faction_select',
        skipImageGate: true,
    });
    await hostContext.addInitScript((id) => {
        localStorage.setItem('guest_id', id);
        sessionStorage.setItem('guest_id', id);
        document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
    }, guestId);

    const page = await hostContext.newPage();

    try {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await waitForHomeGameList(page);
        test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');

        const matchId = await createOnlineAiRoom({
            page,
            guestId,
            numPlayers: 4,
            seatControllers: {
                '1': { type: 'local-ai', difficulty: 'expert' },
                '2': { type: 'local-ai', difficulty: 'expert' },
                '3': { type: 'local-ai', difficulty: 'expert' },
            },
        });

        const hostCredentials = await claimSeatViaApi({
            page,
            matchId,
            playerId: '0',
            guestId,
            playerName: 'SmashUp-Host',
        });
        await seedMatchCredentials(hostContext, 'smashup', matchId, '0', hostCredentials);

        const aiSeatCredentials = Object.fromEntries(
            await Promise.all(
                ['1', '2', '3'].map(async (playerId) => {
                    const credentials = await claimSeatViaApi({
                        page,
                        matchId,
                        playerId,
                        guestId,
                        playerName: `SmashUp-AI-${playerId}`,
                    });
                    return [playerId, credentials] as const;
                }),
            ),
        );
        await seedAiSeatCredentials(hostContext, matchId, aiSeatCredentials);

        await page.goto(`/play/smashup/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
        await waitForFactionDraft(page);
        await waitForAiSeatCredentials(page, matchId, ['1', '2', '3']);
        await waitForOnlineAiSeatBridgeReady(page, '1');
        await waitForOnlineAiSeatBridgeReady(page, '2');
        await waitForOnlineAiSeatBridgeReady(page, '3');

        await selectSmashUpFactionById(page, 'aliens');
        const aiStartAt = Date.now();

        await expect.poll(async () => readSelectionProgress(matchId, page), {
            timeout: 30000,
            message: '等待 3 个 AI 完成第二轮选派系并把选秀权交还 host',
        }).toEqual({
            phase: 'factionSelect',
            currentPlayerIndex: 0,
            host: 1,
            ai1: 2,
            ai2: 2,
            ai3: 2,
        });

        const allAiElapsedMs = Date.now() - aiStartAt;
        const firstRoundShot = await saveEvidenceScreenshot(page, testInfo, 'smashup-auto-ai-faction-mid-draft');
        await page.evaluate((timing) => {
            (window as Window & { __BG_AUTO_AI_FACTION_TIMING__?: unknown }).__BG_AUTO_AI_FACTION_TIMING__ = timing;
        }, {
            allAiElapsedMs,
        });

        await selectSmashUpFactionById(page, 'pirates');
        await waitForSmashUpUI(page, 45000);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return {
                phase: state.sys?.phase ?? null,
                factionSelection: state.core?.factionSelection ?? null,
                hostFactions: state.core?.players?.['0']?.factions?.length ?? 0,
                ai1Factions: state.core?.players?.['1']?.factions?.length ?? 0,
                ai2Factions: state.core?.players?.['2']?.factions?.length ?? 0,
                ai3Factions: state.core?.players?.['3']?.factions?.length ?? 0,
            };
        }, {
            timeout: 30000,
            message: '等待四人自动选派系完成并进入 playCards',
        }).toEqual({
            phase: 'playCards',
            factionSelection: null,
            hostFactions: 2,
            ai1Factions: 2,
            ai2Factions: 2,
            ai3Factions: 2,
        });

        const finalShot = await saveEvidenceScreenshot(page, testInfo, 'smashup-auto-ai-faction-playcards');
        console.log(JSON.stringify({
            matchId,
            allAiElapsedMs,
            screenshots: {
                firstRoundShot,
                finalShot,
            },
        }));
    } finally {
        await hostContext.close();
    }
});
