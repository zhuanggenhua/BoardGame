import { expect, test } from '../framework/fixtures';
import type { BrowserContext, Page, WebSocketRoute } from '@playwright/test';
import { createGuestId, getGameServerBaseURL, joinMatchViaAPI, seedMatchCredentials } from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';
import type { TheGangCore } from '../../src/games/the-gang/domain/types';

type View = {
    core: {
        heistStarted: boolean;
        heistNumber: number;
        phase: string;
        round: number;
        currentRoundChips: Record<string, number>;
        pendingProgress?: { kind: string; approvals: string[] };
        players: Record<string, { pocketCards: unknown[]; secondaryPocketCards?: unknown[] }>;
    };
};

async function readView(page: Page): Promise<View> {
    return page.evaluate(() => {
        const state = window.__BG_TEST_HARNESS__?.state?.get?.();
        if (!state) throw new Error('纸牌帮客户端状态尚未就绪');
        return state as View;
    });
}

async function prepareGuestContext(context: BrowserContext, ports: { gameServer: number; apiServer: number }) {
    await context.addInitScript((workerPorts) => {
        (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
        (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__ = `http://127.0.0.1:${workerPorts.gameServer}`;
        (window as Window & { __FORCE_API_SERVER_URL__?: string }).__FORCE_API_SERVER_URL__ = `http://127.0.0.1:${workerPorts.apiServer}`;
        localStorage.setItem('bg_locale_preference', 'zh-CN');
        localStorage.setItem('i18nextLng', 'zh-CN');
        localStorage.setItem('tutorial_skip', '1');
    }, ports);
}

test('纸牌帮三人双手牌断线恢复后继续投票、摊牌并进入下一局', async ({ browser, page, workerPorts }, testInfo) => {
    test.setTimeout(180_000);
    const guestId = createGuestId('the-gang-reconnect-host');
    const created = await page.request.post(`${getGameServerBaseURL()}/games/the-gang/create`, { data: {
        numPlayers: 3, playerName: '纸牌帮房主', setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' },
    } });
    expect(created.ok()).toBe(true);
    const room = await created.json() as { matchID: string; ownerCredentials: string };
    expect(room.matchID && room.ownerCredentials).toBeTruthy();
    await page.addInitScript((id) => { localStorage.setItem('guest_id', id); sessionStorage.setItem('guest_id', id); }, guestId);
    await seedMatchCredentials(page, 'the-gang', room.matchID, '0', room.ownerCredentials);
    const guestContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string | undefined });
    const thirdContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string | undefined });
    try {
        await prepareGuestContext(guestContext, workerPorts);
        await prepareGuestContext(thirdContext, workerPorts);
        let gameSocket: { client: WebSocketRoute; server: WebSocketRoute } | undefined;
        await guestContext.routeWebSocket((url) => url.port === String(workerPorts.gameServer) && url.pathname.includes('socket.io'), (client) => {
            gameSocket = { client, server: client.connectToServer() };
        });
        const guest = await guestContext.newPage();
        const guestSeatId = createGuestId('the-gang-reconnect-guest');
        const credentials = await joinMatchViaAPI(guest, 'the-gang', room.matchID, '1', '玩家二', guestSeatId);
        expect(credentials).toBeTruthy();
        await seedMatchCredentials(guestContext, 'the-gang', room.matchID, '1', credentials!);
        const third = await thirdContext.newPage();
        const thirdSeatId = createGuestId('the-gang-reconnect-third');
        const thirdCredentials = await joinMatchViaAPI(third, 'the-gang', room.matchID, '2', '玩家三', thirdSeatId);
        expect(thirdCredentials).toBeTruthy();
        await seedMatchCredentials(thirdContext, 'the-gang', room.matchID, '2', thirdCredentials!);
        await page.goto(`/play/the-gang/match/${room.matchID}?playerID=0`, { waitUntil: 'domcontentloaded' });
        await guest.goto(`/play/the-gang/match/${room.matchID}?playerID=1`, { waitUntil: 'domcontentloaded' });
        await third.goto(`/play/the-gang/match/${room.matchID}?playerID=2`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: '纸牌帮' })).toBeVisible({ timeout: 30000 });
        await expect(guest.getByRole('heading', { name: '纸牌帮' })).toBeVisible({ timeout: 30000 });
        await expect(third.getByRole('heading', { name: '纸牌帮' })).toBeVisible({ timeout: 30000 });
        const rules = page.getByTestId('the-gang-rules-config');
        await rules.getByRole('button', { name: '扩展' }).click();
        await page.getByTestId('the-gang-rule-toggle-twoHand').click();
        await page.getByTestId('the-gang-apply-rules-config').click();
        await page.getByRole('button', { name: '开始抢劫' }).click();
        for (const [seat, viewPage] of [['0', page], ['1', guest], ['2', third]] as const) {
            await expect(viewPage.locator('[data-testid^="the-gang-local-hand-top-card-"] img')).toHaveCount(2);
            await expect(viewPage.locator('[data-testid^="the-gang-local-hand-bottom-card-"] img')).toHaveCount(2);
            await expect.poll(async () => (await readView(viewPage)).core.players[seat]?.secondaryPocketCards?.length).toBe(2);
            const view = await readView(viewPage);
            for (const other of ['0', '1', '2'].filter(id => id !== seat)) {
                expect(view.core.players[other].pocketCards).toEqual([]);
                expect(view.core.players[other].secondaryPocketCards).toEqual([]);
            }
        }
        const beforeHost = await readView(page);
        const beforeGuest = await readView(guest);
        const beforeThird = await readView(third);
        expect(beforeHost.core.players['1'].pocketCards).toEqual([]);
        expect(beforeHost.core.players['1'].secondaryPocketCards).toEqual([]);
        expect(beforeGuest.core.players['0'].pocketCards).toEqual([]);
        expect(beforeGuest.core.players['0'].secondaryPocketCards).toEqual([]);

        await guest.getByTestId('the-gang-chip-hand-selector-bottom').click();
        await guest.getByRole('button', { name: '白筹码 2 星' }).click();
        await expect.poll(async () => (await readView(page)).core.currentRoundChips['1:bottom']).toBe(2);
        await guest.reload({ waitUntil: 'domcontentloaded' });
        await expect(guest.getByRole('heading', { name: '纸牌帮' })).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await readView(guest)).core.currentRoundChips['1:bottom']).toBe(2);
        const afterGuest = await readView(guest);
        expect(afterGuest.core.round).toBe(beforeGuest.core.round);
        expect(afterGuest.core.players['1'].pocketCards).toEqual(beforeGuest.core.players['1'].pocketCards);
        expect(afterGuest.core.players['1'].secondaryPocketCards).toEqual(beforeGuest.core.players['1'].secondaryPocketCards);
        expect(afterGuest.core.players['0'].pocketCards).toEqual([]);
        expect(afterGuest.core.players['0'].secondaryPocketCards).toEqual([]);
        await expect(guest.locator('[data-testid^="the-gang-local-hand-bottom-card-"] img')).toHaveCount(2);

        const guestConnected = async () => {
            const response = await page.request.get(`${getGameServerBaseURL()}/games/the-gang/${room.matchID}`);
            expect(response.ok()).toBe(true);
            const detail = await response.json() as { players: Array<{ id: number; isConnected?: boolean }> };
            return detail.players.find((player) => player.id === 1)?.isConnected;
        };
        await expect.poll(guestConnected, { timeout: 30000 }).toBe(true);
        // 断网时由另一客户端产生新事实，恢复后必须从服务端补齐，而非读取旧客户端状态。
        await guestContext.setOffline(true);
        await expect.poll(() => guest.evaluate(() => navigator.onLine)).toBe(false);
        expect(gameSocket).toBeDefined();
        const interruptedSocket = gameSocket!;
        await interruptedSocket.server.close();
        await interruptedSocket.client.close();
        await expect.poll(guestConnected, { timeout: 45000 }).toBe(false);
        await page.getByTestId('the-gang-chip-hand-selector-bottom').click();
        await page.getByRole('button', { name: '白筹码 3 星' }).click();
        await expect.poll(async () => (await readView(page)).core.currentRoundChips['0:bottom']).toBe(3);
        await third.getByTestId('the-gang-chip-hand-selector-bottom').click();
        await third.getByRole('button', { name: '白筹码 4 星' }).click();
        await expect.poll(async () => (await readView(page)).core.currentRoundChips['2:bottom']).toBe(4);
        expect((await readView(guest)).core.currentRoundChips['0:bottom']).not.toBe(3);
        expect((await readView(guest)).core.currentRoundChips['2:bottom']).not.toBe(4);
        await guestContext.setOffline(false);
        await expect.poll(() => guest.evaluate(() => navigator.onLine)).toBe(true);
        await expect.poll(guestConnected, { timeout: 30000 }).toBe(true);
        await expect.poll(async () => (await readView(guest)).core.currentRoundChips['0:bottom'], { timeout: 30000 }).toBe(3);
        await expect.poll(async () => (await readView(guest)).core.currentRoundChips['2:bottom'], { timeout: 30000 }).toBe(4);
        const reconnected = await readView(guest);
        expect(reconnected.core.players['1'].pocketCards).toEqual(beforeGuest.core.players['1'].pocketCards);
        expect(reconnected.core.players['1'].secondaryPocketCards).toEqual(beforeGuest.core.players['1'].secondaryPocketCards);
        expect(reconnected.core.players['0'].pocketCards).toEqual([]);
        expect(reconnected.core.players['0'].secondaryPocketCards).toEqual([]);
        expect(reconnected.core.players['2'].pocketCards).toEqual([]);
        expect(reconnected.core.players['2'].secondaryPocketCards).toEqual([]);
        expect(reconnected.core.currentRoundChips['1:bottom']).toBe(2);
        const hostAfterReconnect = await readView(page);
        expect(hostAfterReconnect.core.players['1'].pocketCards).toEqual([]);
        expect(hostAfterReconnect.core.players['1'].secondaryPocketCards).toEqual([]);
        expect(hostAfterReconnect.core.players['2'].pocketCards).toEqual([]);
        expect(hostAfterReconnect.core.players['2'].secondaryPocketCards).toEqual([]);
        const thirdAfterReconnect = await readView(third);
        expect(thirdAfterReconnect.core.players['2'].pocketCards).toEqual(beforeThird.core.players['2'].pocketCards);
        expect(thirdAfterReconnect.core.players['2'].secondaryPocketCards).toEqual(beforeThird.core.players['2'].secondaryPocketCards);
        for (const other of ['0', '1']) {
            expect(thirdAfterReconnect.core.players[other].pocketCards).toEqual([]);
            expect(thirdAfterReconnect.core.players[other].secondaryPocketCards).toEqual([]);
        }
        await guest.getByTestId('the-gang-chip-hand-selector-top').click();
        await guest.getByRole('button', { name: '白筹码 1 星' }).click();
        await expect.poll(async () => (await readView(page)).core.currentRoundChips['1:top']).toBe(1);

        await page.getByTestId('the-gang-chip-hand-selector-top').click();
        await page.getByRole('button', { name: '白筹码 5 星' }).click();
        await third.getByTestId('the-gang-chip-hand-selector-top').click();
        await third.getByRole('button', { name: '白筹码 6 星' }).click();
        const vote = async (label: '下一轮' | '摊牌' | '下一次抢劫') => {
            const beforeVote = (await readView(page)).core;
            const kind = label === '下一轮' ? 'end-round' : label === '摊牌' ? 'reveal-showdown' : 'start-next-heist';
            for (const [index, voter] of [page, guest, third].entries()) {
                const button = voter.getByRole('button', { name: label, exact: true });
                await expect(button).toBeEnabled({ timeout: 15000 });
                await button.click();
                if (index < 2) {
                    await expect.poll(async () => {
                        const current = (await readView(page)).core;
                        return { round: current.round, heistNumber: current.heistNumber,
                            kind: current.pendingProgress?.kind, approvals: current.pendingProgress?.approvals };
                    }, { timeout: 15000, message: `${label} 等待全部玩家确认` }).toEqual({
                        round: beforeVote.round, heistNumber: beforeVote.heistNumber, kind,
                        approvals: ['0', '1'].slice(0, index + 1),
                    });
                }
            }
        };
        await vote('下一轮');
        await expect.poll(async () => (await readView(guest)).core.round, { timeout: 15000 }).toBe(2);
        for (const [index, color] of ['黄', '橙', '红'].entries()) {
            for (const [seatIndex, player] of [page, guest, third].entries()) {
                for (const [handIndex, hand] of (['top', 'bottom'] as const).entries()) {
                    await player.getByTestId(`the-gang-chip-hand-selector-${hand}`).click();
                    await player.getByRole('button', { name: `${color}筹码 ${seatIndex * 2 + handIndex + 1} 星` }).click();
                }
            }
            await vote(index === 2 ? '摊牌' : '下一轮');
            if (index < 2) await expect.poll(async () => (await readView(guest)).core.round, { timeout: 15000 }).toBe(index + 3);
        }
        const showdown = (await getMatchState(room.matchID, page)).core as TheGangCore;
        expect(showdown.lastShowdown?.heistNumber).toBe(1);
        expect(showdown.lastShowdown?.results).toHaveLength(6);
        expect(showdown.lastShowdown?.results.map(({ playerId, handSlot, chip }) => ({ playerId, handSlot, chip })))
            .toEqual([
                { playerId: '0', handSlot: 'top', chip: 1 }, { playerId: '0', handSlot: 'bottom', chip: 2 },
                { playerId: '1', handSlot: 'top', chip: 3 }, { playerId: '1', handSlot: 'bottom', chip: 4 },
                { playerId: '2', handSlot: 'top', chip: 5 }, { playerId: '2', handSlot: 'bottom', chip: 6 },
            ]);
        const initialViews = [beforeHost, beforeGuest, beforeThird];
        for (const result of showdown.lastShowdown!.results) {
            const original = initialViews[Number(result.playerId)].core.players[result.playerId];
            expect(result.pocketCards).toEqual(result.handSlot === 'top' ? original.pocketCards : original.secondaryPocketCards);
        }
        expect(showdown.heistHistory).toHaveLength(1);
        expect(showdown.heistHistory[0]).toEqual(showdown.lastShowdown);
        expect({ successes: showdown.successes, failures: showdown.failures }).toEqual(
            showdown.lastShowdown?.outcome === 'success' ? { successes: 1, failures: 0 } : { successes: 0, failures: 1 },
        );
        const resultText = showdown.lastShowdown?.outcome === 'success' ? '抢劫成功' : '抢劫失败';
        for (const player of [page, guest, third]) {
            await expect(player.getByLabel('摊牌结算')).toBeVisible({ timeout: 30000 });
            await expect(player.getByText(resultText)).toBeVisible();
        }
        await vote('下一次抢劫');
        for (const player of [page, guest, third]) {
            await expect.poll(async () => (await readView(player)).core.heistNumber, { timeout: 15000 }).toBe(2);
            await expect(player.getByText('抢劫 2')).toBeVisible();
        }
        const nextHeist = (await getMatchState(room.matchID, page)).core as TheGangCore;
        expect(nextHeist.heistHistory).toEqual(showdown.heistHistory);
        expect({ successes: nextHeist.successes, failures: nextHeist.failures })
            .toEqual({ successes: showdown.successes, failures: showdown.failures });
    } finally {
        await guestContext.close();
        await thirdContext.close();
    }
});
