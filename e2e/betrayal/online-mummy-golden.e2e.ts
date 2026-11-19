import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { MatchState } from '../../src/engine/types';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import { groupRoomDiscoveryDeckByFloor, resolveExplorableRoomSlots, resolveNextRoomDiscoveryDeckKind } from '../../src/games/betrayal/roomDiscoveryModel';
import { createMummyTraitorVictoryReadyTutorialCore } from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import { createGuestId, getGameServerBaseURL, initContext, seedMatchCredentials } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { initBetrayalContext, waitForPhysicalDiceSettled, warmBetrayalFrontend } from './betrayalTestHelpers';

const seats = [
    { id: '0', explorer: 'isa-valencia' },
    { id: '1', explorer: 'anita-hernandez' },
    { id: '2', explorer: 'father-warren-leung' },
] as const;

async function openSeat(context: BrowserContext, page: Page, matchId: string, playerId: string, credentials: string) {
    await seedMatchCredentials(context, 'betrayal', matchId, playerId, credentials);
    await page.goto(`/play/betrayal/match/${matchId}?playerID=${playerId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 45000 });
}

test.use({ viewport: { width: 1600, height: 900 }, actionTimeout: 15000 });

test('木乃伊横行正式在线同房开局、轮序交接和叛徒终局', async ({ browser, context, page, baseURL }, testInfo) => {
    test.setTimeout(240000);
    const contexts = [context];
    const browserContextId = randomUUID();
    try {
        const players = [];
        for (const seat of seats) {
            const guestId = createGuestId(`betrayal-golden-${seat.id}`);
            const seatContext = seat.id === '0' ? context : await browser.newContext({
                baseURL, viewport: { width: 1600, height: 900 },
                recordVideo: process.env.PW_RECORD_VIDEO === 'true'
                    ? { dir: testInfo.outputPath(`seat-${seat.id}`), size: { width: 800, height: 450 } }
                    : undefined,
            });
            if (seatContext !== context) contexts.push(seatContext);
            await initContext(seatContext, { storageKey: `__betrayal_golden_${seat.id}`, locale: 'zh-CN' });
            await initBetrayalContext(seatContext);
            await seatContext.addInitScript((guest) => {
                localStorage.setItem('guest_id', guest);
                sessionStorage.setItem('guest_id', guest);
            }, guestId);
            players.push({ ...seat, guestId, context: seatContext, page: seat.id === '0' ? page : await seatContext.newPage() });
        }
        await warmBetrayalFrontend(context);
        const [host, second, third] = players;
        const api = `${getGameServerBaseURL()}/games/betrayal`;
        const created = await page.request.post(`${api}/create`, { data: {
            numPlayers: players.length,
            setupData: { guestId: host.guestId, ownerKey: `guest:${host.guestId}`, ownerType: 'guest' },
        } });
        expect(created.ok(), await created.text()).toBe(true);
        const { matchID: matchId } = await created.json() as { matchID: string };
        const roomApi = `${api}/${matchId}`;
        const read = async () => await getMatchState(matchId, page) as MatchState<BetrayalCore>;
        const end = 'betrayal-endgame-screen';
        const snapshots: Array<Record<string, unknown>> = [];
        const access = new Map<string, {playerId: string; credentials: string}>();
        const snapshot = async (id: string, active: Page) => {
            const { core, sys } = await read();
            const shot = testInfo.outputPath(`${id}.png`);
            await active.screenshot({ path: shot, animations: 'disabled' });
            snapshots.push({
                id, shot, visible: { url: active.url(), gameOver: await active.getByTestId(end).isVisible() },
                authoritative: { matchId, phase: core.phase, currentPlayer: core.currentPlayer, room: core.activeRoomId, gameOver: Boolean(sys.gameover),
                    characters: core.selectedExplorerByPlayerId, outcome: core.endgameResult?.outcome ?? null },
            });
        };
        for (const player of players) {
            const guest = player.guestId;
            const response = await player.page.request.post(`${roomApi}/${player.id === '0' ? 'claim-seat' : 'join'}`, {
                data: { playerID: player.id, playerName: `探索者${player.id}`, guestId: guest, data: { guestId: guest } },
            });
            expect(response.ok(), await response.text()).toBe(true);
            const { playerCredentials } = await response.json() as { playerCredentials: string };
            access.set(player.id, { playerId: player.id, credentials: playerCredentials });
            await openSeat(player.context, player.page, matchId, player.id, playerCredentials);
        }

        await snapshot('01-正式在线房选角', page);
        for (const player of players) {
            await player.page.getByTestId('betrayal-character-selection-grid')
                .getByTestId(`betrayal-character-card-${player.explorer}`).click();
            await player.page.getByTestId('betrayal-character-confirm').click();
        }
        await page.getByTestId('betrayal-character-scenario-button').click();
        await page.getByTestId('betrayal-scenario-option-mummy-rampage').click();
        await page.getByTestId('betrayal-scenario-select-current').click();
        for (const player of [second, third]) {
            const confirm = player.page.getByTestId('betrayal-character-confirm');
            await expect(confirm).toHaveText(/确认此剧本/);
            await confirm.click();
        }
        const start = page.getByTestId('betrayal-character-confirm');
        if (await start.isVisible()) {
            await expect(start).toHaveText(/开始剧本/);
            await start.click();
        }
        for (const player of players) {
            const opening = player.page.getByTestId('betrayal-start-scenario-opening-continue');
            const canvas = player.page.getByTestId('betrayal-three-map-canvas');
            await expect.poll(async () => await opening.isVisible() || await canvas.isVisible(), { timeout: 30000 }).toBe(true);
            if (await opening.isVisible()) await opening.click();
            await expect(player.page.getByTestId('betrayal-room-grid')).toHaveAttribute('data-visible-explorer-models', '3', { timeout: 30000 });
        }
        await expect.poll(async () => (await read()).core.currentPlayer).toBe('0');
        const target = page.getByTestId('betrayal-room-hallway');
        await target.click();
        await expect.poll(async () => (await read()).core.currentExplorer.roomId).toBe('hallway');
        await expect(second.page.getByTestId('betrayal-room-occupant-hallway-0')).toBeVisible();
        await snapshot('02-三维棋桌进门厅', page);

        // 保留同一牌堆，只把已存在的房间和事件移到顶部，让这一局走到可复验的检定。
        const beforeDiscovery = await read();
        const openingCore = beforeDiscovery.core;
        const kitchen = openingCore.roomDiscoveryDeck.find(entry => entry.floor === 'ground' && entry.room.visualId === 'kitchen');
        const geometry = openingCore.eventOrder.find(card => card.name === '外星几何');
        expect(kitchen).toBeDefined();
        expect(geometry).toBeDefined();
        openingCore.roomDiscoveryDeck = [kitchen!, ...openingCore.roomDiscoveryDeck.filter(entry => entry !== kitchen)];
        openingCore.roomDiscoveryOrderByFloor = groupRoomDiscoveryDeckByFloor(openingCore.roomDiscoveryDeck);
        openingCore.eventOrder = [geometry!, ...openingCore.eventOrder.filter(card => card !== geometry)];
        await injectMatchState(matchId, { ...beforeDiscovery, sys: {
            ...beforeDiscovery.sys, turnOrder: openingCore.playerIds,
            currentPlayerIndex: openingCore.playerIds.indexOf(openingCore.currentPlayer),
        } }, undefined, access.get(host.id));
        const eventRoom = resolveExplorableRoomSlots(openingCore).find(room =>
            room.floor === 'ground' && resolveNextRoomDiscoveryDeckKind(openingCore, { roomId: room.id }) === 'event');
        expect(eventRoom, '从门厅可探索带事件的房间').toBeDefined();
        await page.getByTestId(`betrayal-room-${eventRoom!.id}`).click();
        await expect(page.getByTestId('betrayal-room-placement-panel')).toBeVisible();
        await snapshot('03-探索房间并选择朝向', page);
        const rotate = page.getByTestId('betrayal-room-placement-rotate-right');
        if (await rotate.isEnabled()) await rotate.click();
        const place = page.getByTestId('betrayal-room-placement-confirm');
        if (await place.isDisabled()) await page.getByTestId('betrayal-room-placement-rotate-left').click();
        await place.click();
        const discovery = page.getByTestId('betrayal-discovery-panel');
        await expect(discovery).toBeVisible({ timeout: 30000 });
        await expect(discovery).toHaveAttribute('aria-label', /外星几何/);
        await snapshot('04-放置房间并翻出外星几何', page);
        await page.getByTestId('betrayal-event-roll-start').click();
        await waitForPhysicalDiceSettled(page.getByTestId('betrayal-recent-roll-panel'));
        await snapshot('05-知识检定骰停稳', page);
        const continueDiscovery = page.getByTestId('betrayal-discovery-continue');
        await expect(continueDiscovery).toBeEnabled({ timeout: 30000 });
        await continueDiscovery.click();
        await expect(discovery).toHaveCount(0);
        await expect.poll(async () => (await read()).core.pendingEventRollResolution).toBeNull();

        await page.getByTestId('betrayal-action-endTurn').click();
        await expect.poll(async () => (await read()).core.currentPlayer).toBe('1');
        await expect(second.page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
        await expect.poll(async () => {
            const action = page.getByTestId('betrayal-action-endTurn');
            return await action.isVisible() && await action.isEnabled();
        }).toBe(false);
        await snapshot('06-交回合给同房玩家', second.page);

        // 在已经结算的回合之间准备合法的胜利前态。中间探索、作祟与收集圣符须另行记录覆盖。
        const before = await read();
        expect(before.sys.gameover).toBeFalsy();
        expect(before.core.phase).toBe('preHaunt');
        expect(before.core.pendingEventChoice).toBeNull();
        const core = createMummyTraitorVictoryReadyTutorialCore();
        expect(core.currentPlayer).toBe('2');
        expect(core.selectedExplorerByPlayerId).toEqual(before.core.selectedExplorerByPlayerId);
        await injectMatchState(matchId, { ...before, core, sys: {
            ...before.sys, turnOrder: core.playerIds, currentPlayerIndex: 2,
        } }, undefined, access.get(third.id));

        for (const player of players) {
            const cue = player.page.getByTestId('betrayal-haunt-reveal-close');
            if (await cue.isVisible()) await cue.click();
            const reader = player.page.getByTestId('betrayal-scenario-reader-close');
            if (await reader.isVisible()) await reader.click();
        }
        const girl = third.page.getByTestId(`betrayal-room-haunt-token-${core.activeRoomId}-mummy-girl-token`);
        await expect(third.page.getByTestId('betrayal-room-grid')).toHaveAttribute('data-visible-monster-models', '1');
        await expect(third.page.getByTestId('betrayal-inventory-holy-symbol')).toBeVisible();
        const use = third.page.getByTestId('betrayal-action-use');
        for (const [index, title, status] of [
            ['07', '拾起女孩', 'placed'],
            ['08', '交出女孩', 'held-by-player'],
            ['09', '交出圣符', 'held-by-mummy'],
        ]) {
            await expect(girl).toHaveAttribute('data-token-status', status);
            await expect(use).toContainText(title);
            await snapshot(`${index}-${title}`, third.page);
            await use.click();
        }
        await expect.poll(async () => (await read()).core.endgameResult?.outcome).toBe('traitor');
        const terminal = await read();
        expect(terminal.sys.gameover).toBeTruthy();
        expect(terminal.core.endgameResult?.winners).toEqual([third.id]);
        const seatOutcomes: Record<string, string> = {};
        for (const player of players) {
            await expect(player.page.getByTestId(end)).toBeVisible();
            await player.page.getByTestId('betrayal-endgame-ending-continue').click();
            await expect(player.page.getByTestId('betrayal-endgame-result-report')).toBeVisible();
            const result = player.page.getByTestId('betrayal-endgame-outcome');
            await expect(result).toHaveText(player.id === third.id ? '胜利' : '失败');
            seatOutcomes[player.id] = await result.innerText();
        }
        expect(terminal.core.scenarioRuntime.mummy).toMatchObject({ girlHeldByMummy: true, mummyCarriedOmenIds: ['holy-symbol'] });
        await snapshot('10-同一在线房叛徒终局', page);
        await writeFile(testInfo.outputPath('match-evidence.json'), JSON.stringify({
            matchId, browserContextId, outcome: 'traitor', seatOutcomes, snapshots,
            injections: [
                { after: '02', purpose: '使用原牌堆的厨房和外星几何固定牌序', skipped: '无已结算的玩家操作' },
                { after: '06', purpose: '合法胜利前态', skipped: '作祟触发、圣符取得与木乃伊返棺准备' },
            ],
        }, null, 2));
    } finally {
        await Promise.all(contexts.slice(1).map(seat => seat.close()));
    }
});
