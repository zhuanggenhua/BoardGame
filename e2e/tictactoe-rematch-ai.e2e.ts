import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { getGameServerBaseURL, setChineseLocale } from './helpers/common';
import { getMatchState, injectMatchState } from './helpers/state-injection';

type ClaimSeatResponse = {
    playerCredentials: string;
};

const postJson = async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const details = await response.text().catch(() => response.statusText);
        throw new Error(`POST ${url} failed: ${response.status} ${details}`);
    }
    return response.json() as Promise<T>;
};

const setupAiMatch = async (gameServerBaseURL: string, guestId: string) => {
    const createResult = await postJson<{ matchID: string }>(
        `${gameServerBaseURL}/games/tictactoe/create`,
        {
            numPlayers: 2,
            setupData: {
                guestId,
                enableAi: true,
                seatControllers: {
                    '1': { type: 'local-ai', minimumActionDelayMs: 0 },
                },
            },
            playerName: 'E2E Host',
            forceReplaceOwnerRoom: true,
        },
    );

    const hostClaim = await postJson<ClaimSeatResponse>(
        `${gameServerBaseURL}/games/tictactoe/${createResult.matchID}/claim-seat`,
        { playerID: '0', guestId, playerName: 'E2E Host' },
    );
    const aiClaim = await postJson<ClaimSeatResponse>(
        `${gameServerBaseURL}/games/tictactoe/${createResult.matchID}/claim-seat`,
        { playerID: '1', guestId, playerName: 'AI 玩家 2' },
    );

    return {
        matchId: createResult.matchID,
        hostCredentials: hostClaim.playerCredentials,
        aiCredentials: aiClaim.playerCredentials,
    };
};

const installMatchStorage = async (
    page: Page,
    match: { matchId: string; hostCredentials: string; aiCredentials: string },
    guestId: string,
) => {
    await page.addInitScript(
        ({ match, guestId }) => {
            localStorage.setItem('guest_id', guestId);
            sessionStorage.setItem('guest_id', guestId);
            localStorage.setItem(`match_creds_${match.matchId}`, JSON.stringify({
                matchID: match.matchId,
                playerID: '0',
                credentials: match.hostCredentials,
                gameName: 'tictactoe',
                playerName: 'E2E Host',
            }));
            localStorage.setItem(`match_ai_creds_${match.matchId}`, JSON.stringify({
                '1': match.aiCredentials,
            }));
        },
        { match, guestId },
    );
};

const injectFinishedGame = async (page: Page, matchId: string) => {
    const state = await getMatchState(matchId, page);
    await injectMatchState(matchId, {
        ...state,
        core: {
            ...(state.core as Record<string, unknown>),
            cells: ['0', '0', '0', null, '1', null, null, null, '1'],
            currentPlayer: '0',
            gameResult: { winner: '0' },
        },
        sys: {
            ...state.sys,
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            gameover: { winner: '0' },
        },
    }, page);
};

const waitForNewMatch = async (page: Page, oldMatchId: string) => {
    await page.waitForURL((url) => {
        const parsed = new URL(url);
        if (!parsed.pathname.includes('/play/tictactoe/match/')) return false;
        const matchId = parsed.pathname.split('/').pop();
        return !!matchId && matchId !== oldMatchId;
    }, { timeout: 20000 });
    const parsed = new URL(page.url());
    return parsed.pathname.split('/').pop();
};

test.describe('井字棋 AI 重赛 E2E', () => {
    test('人机房点一次再来一局后由 AI 自动同意并进入新房间', async ({ browser }, testInfo) => {
        test.setTimeout(90000);

        const pageDiagnostics: string[] = [];
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const gameServerBaseURL = getGameServerBaseURL();
        const evidenceDir = path.resolve('test-results/evidence-screenshots/tictactoe-rematch-ai');
        mkdirSync(evidenceDir, { recursive: true });
        const guestId = `rematch-ai-${Date.now()}`;
        const match = await setupAiMatch(gameServerBaseURL, guestId);

        const hostContext = await browser.newContext({ baseURL });
        await setChineseLocale(hostContext);
        const hostPage = await hostContext.newPage();
        hostPage.on('pageerror', (error) => {
            pageDiagnostics.push(`pageerror: ${error.name}: ${error.message}`);
        });
        hostPage.on('console', (message) => {
            if (message.type() === 'error') {
                pageDiagnostics.push(`console.error: ${message.text()}`);
            }
        });
        await installMatchStorage(hostPage, match, guestId);

        await hostPage.goto(`/play/tictactoe/match/${match.matchId}?playerID=0`);
        try {
            await expect(hostPage.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 15000 });
        } catch (error) {
            const rescueText = await hostPage.locator('[data-testid="game-page-rescue-gate"]').textContent().catch(() => null);
            throw new Error([
                error instanceof Error ? error.message : String(error),
                rescueText ? `rescue=${rescueText}` : 'rescue=<not shown>',
                pageDiagnostics.length > 0 ? pageDiagnostics.join('\n') : 'pageDiagnostics=<empty>',
            ].join('\n'));
        }

        await injectFinishedGame(hostPage, match.matchId);

        const playAgain = hostPage.getByRole('button', { name: '再来一局' });
        await expect(playAgain).toBeVisible({ timeout: 15000 });
        await expect(hostPage.locator('[data-testid="rematch-actions"]')).toHaveAttribute('data-rematch-mode', 'multi');
        await hostPage.screenshot({
            path: path.join(evidenceDir, '01-ai-rematch-before-click.png'),
            fullPage: true,
        });

        await playAgain.click();

        const nextMatchId = await waitForNewMatch(hostPage, match.matchId);
        expect(nextMatchId).toBeTruthy();
        await expect(hostPage.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 15000 });
        await hostPage.screenshot({
            path: path.join(evidenceDir, '02-ai-rematch-new-room.png'),
            fullPage: true,
        });

        const nextMatchInfo = await fetch(`${gameServerBaseURL}/games/tictactoe/${nextMatchId}`).then((response) => response.json()) as {
            setupData?: {
                enableAi?: boolean;
                seatControllers?: Record<string, { type?: string }>;
                prevMatchID?: string;
            };
        };
        expect(nextMatchInfo.setupData?.enableAi).toBe(true);
        expect(nextMatchInfo.setupData?.seatControllers?.['1']?.type).toBe('local-ai');

        await hostContext.close();
    });
});
