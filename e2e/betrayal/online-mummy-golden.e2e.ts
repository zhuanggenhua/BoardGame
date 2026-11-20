import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import msgpackParser from 'socket.io-msgpack-parser';
import type { MatchState } from '../../src/engine/types';
import { createTrackedRandom } from '../../src/engine/transport/trackedRandom';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import { syncCurrentExplorerProjection } from '../../src/games/betrayal/coreStateModel';
import { groupRoomDiscoveryDeckByFloor, resolveExplorableRoomSlots, resolveNextRoomDiscoveryDeckKind } from '../../src/games/betrayal/roomDiscoveryModel';
import { rollBetrayalDicePips } from '../../src/games/betrayal/diceRules';
import { applyTraitLoss } from '../../src/games/betrayal/traitTrackModel';
import {
    resolvePendingCardResolutionAcknowledgedPlayerIds,
    resolvePendingCardResolutionRequiredPlayerIds,
    resolveRecentRollAcknowledgedPlayerIds,
    resolveRecentRollRequiredPlayerIds,
} from '../../src/games/betrayal/acknowledgementReadModel';
import { createGuestId, getGameServerBaseURL, initContext, seedMatchCredentials } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { buildMummyGoldenSteps, type MummyGoldenMoment } from './onlineMummyGoldenEvidence';
import { clickBetrayalSceneFigure, clickBetrayalSceneGirl, getBetrayalSceneFigurePoint, initBetrayalContext, resolveBetrayalEvidencePath, waitForBetrayalFloatingTextGone, waitForPhysicalDiceSettled, warmBetrayalFrontend } from './betrayalTestHelpers';

function moveToFront<T>(records: T[], predicate: (record: T) => boolean): T[] {
    const record = records.find(predicate);
    expect(record, '原牌堆中有本次要合法揭示的对象').toBeDefined();
    return [record!, ...records.filter(entry => entry !== record)];
}

function arrangeGroundDiscovery(core: BetrayalCore, visualId: string) {
    core.roomDiscoveryDeck = moveToFront(core.roomDiscoveryDeck, entry =>
        entry.floor === 'ground' && entry.room.visualId === visualId);
    core.roomDiscoveryOrderByFloor = groupRoomDiscoveryDeckByFloor(core.roomDiscoveryDeck);
}

function chooseRollCursor(seed: string, counts: number[], accept: (totals: number[]) => boolean) {
    for (let cursor = 0; cursor < 1000; cursor++) {
        const { random } = createTrackedRandom(seed, cursor);
        const totals = counts.map(count => rollBetrayalDicePips(random, count).reduce((total, pip) => total + pip, 0));
        if (accept(totals)) return cursor;
    }
    throw new Error('无法为正式随机种子找到目标骰面段');
}

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

test('木乃伊横行正式在线黄金链：三类发现、物品、交易、公开作祟、攻防、返棺和三席终局', async ({ browser, context, page, baseURL }, testInfo) => {
    test.setTimeout(480000);
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
        const snapshots: MummyGoldenMoment[] = [];
        const injections: Array<{ after: string; purpose: string; skipped: string }> = [];
        let seed = '';
        page.on('websocket', socket => {
            if (!socket.url().includes('socket.io')) return;
            const decoder = new msgpackParser.Decoder();
            decoder.on('decoded', (packet: { nsp?: string; data?: unknown[] }) => {
                if (packet.nsp !== '/game' || packet.data?.[0] !== 'state:sync' || packet.data[1] !== matchId) return;
                const random = packet.data[4] as { seed?: string } | null;
                if (random?.seed) seed = random.seed;
            });
            socket.on('framereceived', ({ payload }) => {
                if (typeof payload !== 'string' && !seed) decoder.add(payload);
            });
        });
        const access = new Map<string, {playerId: string; credentials: string}>();
        const evidencePath = (file: string) => process.env.BG_E2E_EVIDENCE_STAGE_ROOT?.trim()
            ? resolveBetrayalEvidencePath(resolve('evidence/betrayal-online-golden', file))
            : testInfo.outputPath(file);
        const matchEvidenceFile = evidencePath('match-evidence.json');
        await mkdir(dirname(matchEvidenceFile), { recursive: true });
        const snapshot = async (id: string, active: Page) => {
            const { core, sys } = await read();
            const shot = evidencePath(`${id}.png`);
            await active.screenshot({ path: shot, animations: /^(12|24)-/.test(id) ? 'allow' : 'disabled' });
            snapshots.push({
                id, shot, visible: { url: active.url(), playerId: new URL(active.url()).searchParams.get('playerID'),
                    gameOver: await active.getByTestId(end).isVisible(), scenarioScope: id.startsWith('18-')
                        ? await active.getByTestId('betrayal-scenario-objective-page').getAttribute('data-scenario-reader-scope')
                        : null },
                authoritative: { matchId, phase: core.phase, currentPlayer: core.currentPlayer, activePlayer: core.activePlayerId, room: core.activeRoomId,
                    gameOver: Boolean(sys.gameover), characters: core.selectedExplorerByPlayerId, outcome: core.endgameResult?.outcome ?? null,
                    eventsDrawn: core.endgameResult?.stats.eventsDrawn ?? null,
                    inventory: [core.currentExplorer, ...core.otherExplorers].map(({playerId, inventory, roomId, traits}) => ({
                        playerId, roomId, traits, inventory: inventory.map(card => card.id),
                    })), discovery: core.latestDiscovery?.kind ?? null, roll: core.recentRoll?.kind ?? null,
                    pendingTrade: core.pendingTradeAgreement?.targetPlayerId ?? null,
                    pendingDamage: core.pendingDamageAllocation?.playerId ?? null, mummy: core.scenarioRuntime.mummy },
            });
            await writeFile(matchEvidenceFile, JSON.stringify({ matchId, browserContextId, snapshots, injections }, null, 2));
        };
        const prepare = async (after: string, purpose: string, skipped: string, update: (core: BetrayalCore) => void, randomCursor?: number) => {
            const state = await read();
            expect(state.sys.gameover).toBeFalsy();
            expect(state.core.pendingCardResolutionQueue).toHaveLength(0);
            expect(state.core.pendingEventRollResolution).toBeNull();
            expect(state.core.pendingEventChoice).toBeNull();
            expect(state.core.pendingTradeAgreement).toBeNull();
            expect(state.core.pendingDamageAllocation).toBeNull();
            update(state.core);
            injections.push({ after, purpose, skipped });
            await injectMatchState(matchId, { ...state, core: syncCurrentExplorerProjection(state.core), sys: {
                ...state.sys, turnOrder: state.core.playerIds, currentPlayerIndex: state.core.playerIds.indexOf(state.core.currentPlayer),
            } }, undefined, access.get(state.core.currentPlayer), { randomCursor });
        };
        const explorer = (core: BetrayalCore, id: string) => {
            const entry = [core.currentExplorer, ...core.otherExplorers].find(candidate => candidate.playerId === id);
            if (!entry) throw new Error(`正式对局缺少席位 ${id}`);
            return entry;
        };
        const givePreparationCard = (core: BetrayalCore, playerId: string, cardId: string) => {
            for (const kind of ['item', 'omen'] as const) {
                const pool = core.possessionOrderByKind[kind];
                const index = pool.findIndex(card => card.id === cardId);
                if (index < 0) continue;
                const [card] = pool.splice(index, 1);
                core.deckCounts[kind] = pool.length;
                explorer(core, playerId).inventory.push(card);
                if (playerId === core.currentPlayer) core.turnStartInventoryCardIds.push(card.id);
                return;
            }
            throw new Error(`牌堆缺少合法准备牌 ${cardId}`);
        };
        const reveal = async (active: Page, kind: 'event' | 'item' | 'omen', slotTitle: string) => {
            const core = (await read()).core;
            const slot = resolveExplorableRoomSlots(core).find(room =>
                room.floor === 'ground' && resolveNextRoomDiscoveryDeckKind(core, { roomId: room.id }) === kind);
            expect(slot, `当前席位有可探索的${kind}门位`).toBeDefined();
            await active.getByTestId(`betrayal-room-${slot!.id}`).click();
            await expect(active.getByTestId('betrayal-room-placement-panel')).toBeVisible();
            await snapshot(slotTitle, active);
            const rotate = active.getByTestId('betrayal-room-placement-rotate-right');
            if (await rotate.isEnabled()) await rotate.click();
            const place = active.getByTestId('betrayal-room-placement-confirm');
            if (await place.isDisabled()) await active.getByTestId('betrayal-room-placement-rotate-left').click();
            await place.click();
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
            await player.page.bringToFront();
            await player.page.getByTestId('betrayal-character-selection-grid')
                .getByTestId(`betrayal-character-card-${player.explorer}`).click();
            await expect.poll(async () => (await read()).core.selectedExplorerByPlayerId[player.id]).toBe(player.explorer);
            await player.page.getByTestId('betrayal-character-confirm').click();
            await expect.poll(async () => (await read()).core.readyPlayerIds.includes(player.id)).toBe(true);
        }
        await page.bringToFront();
        await page.getByTestId('betrayal-character-scenario-button').click();
        await page.getByTestId('betrayal-scenario-option-mummy-rampage').click();
        await page.getByTestId('betrayal-scenario-select-current').click();
        for (const player of [second, third]) {
            await player.page.bringToFront();
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
        await page.bringToFront();
        await expect(page.getByTestId('betrayal-turn-intro-skip')).toHaveCount(0);
        await snapshot('01a-剧本开场结束进入棋桌', page);
        await clickBetrayalSceneFigure(page.locator('button[data-scene-figure-id="player:0"]'));
        await expect(page.getByTestId('betrayal-room-grid'))
            .toHaveAttribute('data-map-figure-highlights', /"player:0":"selected"/);
        await snapshot('01b-房主席选中真实三维棋子', page);
        const target = page.getByTestId('betrayal-room-hallway');
        await target.click();
        await expect.poll(async () => (await read()).core.currentExplorer.roomId).toBe('hallway');
        await expect(second.page.getByTestId('betrayal-room-occupant-hallway-0')).toBeVisible();
        await snapshot('02-三维棋桌进门厅', page);

        await expect.poll(() => seed, { message: '从房主席的正常同步读取正式对局随机种子' }).not.toBe('');
        const inspect = await getBetrayalSceneFigurePoint(page.locator('button[data-scene-figure-id="player:0"]'));
        await page.mouse.click(inspect.x, inspect.y, { button: 'right' });
        await expect(page.getByTestId('betrayal-explorer-detail-dialog-0')).toBeVisible();
        await snapshot('03-右键检视己方模型', page);
        await page.getByTestId('betrayal-explorer-detail-close').click();
        await prepare('03', '固定厨房与外星几何的原牌序', '无', core => {
            arrangeGroundDiscovery(core, 'kitchen');
            core.eventOrder = moveToFront(core.eventOrder, card => card.name === '外星几何');
        });
        await reveal(page, 'event', '04-探索房间并选择朝向');
        const discovery = page.getByTestId('betrayal-discovery-panel');
        await expect(discovery).toBeVisible({ timeout: 30000 });
        await expect(discovery).toHaveAttribute('aria-label', /外星几何/);
        await snapshot('05-放置房间并翻出外星几何', page);
        await page.getByTestId('betrayal-event-roll-start').click();
        await waitForPhysicalDiceSettled(page.getByTestId('betrayal-recent-roll-panel'));
        await snapshot('06-知识检定骰停稳', page);
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
        await snapshot('07-房主席等待第二席行动', page);
        await snapshot('08-第二席接过回合', second.page);

        const go = async (player: typeof host, roomId: string) => {
            await player.page.bringToFront();
            await player.page.getByTestId(`betrayal-room-${roomId}`).click();
            await expect.poll(async () => explorer((await read()).core, player.id).roomId).toBe(roomId);
        };
        const endTurn = async (player: typeof host, next: typeof host) => {
            await player.page.bringToFront();
            await expect(player.page.getByTestId('betrayal-board')).toHaveAttribute('data-betrayal-visual-busy', 'false');
            const endAction = player.page.getByTestId('betrayal-action-endTurn');
            await expect(endAction).toBeEnabled();
            await endAction.click();
            await expect.poll(async () => (await read()).core.currentPlayer, { timeout: 15000 }).toBe(next.id);
        };
        const continueCards = async () => {
            for (const player of players) {
                const state = (await read()).core;
                const pending = state.pendingCardResolutionQueue[0];
                if (!pending || !resolvePendingCardResolutionRequiredPlayerIds(pending).includes(player.id)
                    || resolvePendingCardResolutionAcknowledgedPlayerIds(pending).includes(player.id)) continue;
                await player.page.bringToFront();
                await player.page.getByTestId('betrayal-discovery-continue').click();
            }
            await expect.poll(async () => (await read()).core.pendingCardResolutionQueue.length).toBe(0);
        };
        const continueRoll = async () => {
            for (const player of players) {
                const core = (await read()).core;
                const roll = core.recentRoll;
                if (!roll || !resolveRecentRollRequiredPlayerIds(core, roll).includes(player.id)
                    || resolveRecentRollAcknowledgedPlayerIds(roll).includes(player.id)) continue;
                await player.page.bringToFront();
                await player.page.getByTestId('betrayal-roll-continue').click();
            }
        };

        await go(second, 'hallway');
        await prepare('08', '固定血腥房间与急救包的原牌序', '无', core => {
            arrangeGroundDiscovery(core, 'bloodyRoom');
            core.possessionOrderByKind.item = moveToFront(core.possessionOrderByKind.item, card => card.id === 'medical-kit');
        });
        await reveal(second.page, 'item', '09-第二席选择物品房');
        await expect(second.page.getByTestId('betrayal-discovery-panel')).toHaveAttribute('aria-label', /急救包/, { timeout: 30000 });
        const { roomId: itemRoom, inventory } = explorer((await read()).core, second.id);
        const medicalKit = inventory.find(card => card.name === '急救包');
        expect(medicalKit).toBeDefined();
        const medicalKitCard = second.page.getByTestId(`betrayal-inventory-${medicalKit!.id}`);
        await snapshot('10-翻出并获得急救包', second.page);
        await continueCards();
        await endTurn(second, third);
        await endTurn(third, host);
        await go(host, 'hallway');
        await go(host, itemRoom);
        await endTurn(host, second);

        await prepare('10', '准备一个可治疗的同房队友和后续交易的两张原牌', '此前受伤及反复查找交易筹码', core => {
            expect(applyTraitLoss(explorer(core, host.id), ['might'], 1)).toBe(1);
            givePreparationCard(core, host.id, 'rope');
            givePreparationCard(core, second.id, 'map');
        });
        await second.page.bringToFront();
        const secondUse = second.page.getByTestId('betrayal-action-use');
        await medicalKitCard.click();
        await clickBetrayalSceneFigure(second.page.locator('button[data-scene-figure-id="player:0"]'));
        await expect(secondUse).toBeEnabled();
        await snapshot('11-急救包选中同房治疗对象', second.page);
        const beforeHeal = explorer((await read()).core, host.id).traits.might;
        await secondUse.click();
        await expect.poll(async () => explorer((await read()).core, host.id).traits.might).toBeGreaterThan(beforeHeal);
        await expect(medicalKitCard).toHaveCount(0);
        await snapshot('12-急救包消耗并恢复属性', second.page);
        await waitForBetrayalFloatingTextGone(second.page, 6000);

        const trade = second.page.getByTestId('betrayal-action-trade');
        await trade.click();
        const tradeTarget = second.page.locator('button[data-scene-figure-id="player:0"]');
        await expect(tradeTarget).toHaveAttribute('data-direct-target', 'true');
        await expect(second.page.getByTestId('betrayal-trade-banner-status')).toContainText('点同房间队友');
        await snapshot('12a-开启交易并高亮同房对象', second.page);
        await clickBetrayalSceneFigure(tradeTarget);
        await expect(second.page.getByTestId('betrayal-trade-return-selector')).toBeVisible();
        await second.page.getByTestId('betrayal-inventory-map').click();
        await second.page.getByTestId('betrayal-trade-return-card-rope').click();
        await snapshot('13-地图和兔脚交易确认前', second.page);
        await trade.click();
        await expect.poll(async () => (await read()).core.pendingTradeAgreement?.targetPlayerId).toBe(host.id);
        await page.bringToFront();
        const acceptTrade = page.getByTestId('betrayal-trade-agreement-accept');
        await expect(acceptTrade).toBeEnabled();
        await snapshot('14-房主席收到同房交易请求', page);
        await acceptTrade.click();
        await expect.poll(async () => explorer((await read()).core, host.id).inventory.map(card => card.id)).toContain('map');
        await expect.poll(async () => explorer((await read()).core, second.id).inventory.map(card => card.id)).toContain('rope');
        await snapshot('15-两席同意后双向交换', page);
        await second.page.bringToFront();
        await expect(second.page.getByTestId('betrayal-inventory-rope')).toBeVisible();
        await snapshot('15a-第二席收到兔脚', second.page);
        await endTurn(second, third);

        await third.page.bringToFront();
        expect(explorer((await read()).core, third.id).roomId).toBe('entrance-hall');
        const omenCursor = chooseRollCursor(seed, [3], ([total]) => total >= 5);
        await prepare('15', '准备两张已发现预兆并固定圣符所在的下次探索', '前两次低点预兆的重复探索，作祟检定与圣符仍由玩家实际触发', core => {
            givePreparationCard(core, host.id, 'omen-book');
            givePreparationCard(core, second.id, 'ring');
            arrangeGroundDiscovery(core, 'specimenRoom');
            core.possessionOrderByKind.omen = moveToFront(core.possessionOrderByKind.omen, card => card.id === 'holy-symbol');
        }, omenCursor);
        await reveal(third.page, 'omen', '16-第三席选择预兆房');
        const omen = third.page.getByTestId('betrayal-discovery-panel');
        await expect(omen).toHaveAttribute('aria-label', /圣符/, { timeout: 30000 });
        await waitForPhysicalDiceSettled(omen.getByTestId('betrayal-recent-roll-panel'));
        await expect(omen).toContainText('作祟开始');
        const hauntRoll = (await read()).core.recentRoll;
        expect(hauntRoll?.kind).toBe('hauntRoll');
        expect(hauntRoll?.dice.reduce((total, pip) => total + pip, 0)).toBeGreaterThanOrEqual(5);
        await snapshot('17-获得圣符并掷骰触发作祟', third.page);
        await continueCards();
        await expect.poll(async () => (await read()).core.phase).toBe('haunt');
        await expect.poll(async () => (await read()).core.scenarioRuntime.traitorPlayerId).toBe(third.id);
        const holySymbol = explorer((await read()).core, third.id).inventory.find(card => card.name === '圣符');
        expect(holySymbol).toBeDefined();
        for (const player of players) {
            await player.page.bringToFront();
            const cue = player.page.getByTestId('betrayal-haunt-reveal-close');
            const reader = player.page.getByTestId('betrayal-scenario-reader-dialog');
            const openReader = player.page.getByTestId('betrayal-open-scenario');
            await expect(cue.or(reader).or(openReader).first()).toBeVisible({ timeout: 30000 });
            if (await cue.isVisible()) await cue.click();
            if (!await reader.isVisible()) await openReader.click();
            const next = reader.getByTestId('betrayal-scenario-reader-next-zone');
            if (await reader.getByTestId('betrayal-scenario-opening-stage').isVisible()) await next.click();
            const role = player.id === third.id ? 'traitor' : 'heroes';
            await expect(reader.getByTestId('betrayal-scenario-objective-page')).toHaveAttribute('data-scenario-reader-scope', role);
            await expect(reader.getByTestId('betrayal-scenario-book-turning-sheet')).toHaveCount(0);
            await expect(reader.getByTestId(`betrayal-scenario-book-section-${role}`)).toBeVisible();
            await expect(reader.getByTestId(`betrayal-scenario-book-section-${role === 'heroes' ? 'traitor' : 'heroes'}`)).toHaveCount(0);
            await snapshot(`18-${player.id === third.id ? '叛徒' : '英雄' + player.id}读本与私有目标`, player.page);
            await reader.getByTestId('betrayal-scenario-reader-close').click();
        }
        await endTurn(host, second);
        await endTurn(second, third);

        const hauntState = (await read()).core;
        const mummyId = hauntState.scenarioRuntime.mummy!.mummyMonsterId;
        const coffinRoom = hauntState.scenarioRuntime.mummy!.sarcophagusRoomId;
        const mummyRoom = 'hallway';
        await prepare('18', '准备木乃伊与持图英雄在棺外同房的可战斗局面', '作祟开始后数轮位置准备', core => {
            explorer(core, host.id).roomId = mummyRoom;
            explorer(core, third.id).roomId = mummyRoom;
            core.monsters.find(monster => monster.id === mummyId)!.roomId = mummyRoom;
            core.scenarioRuntime.mummy!.girlRoomId = mummyRoom;
        }, chooseRollCursor(seed, [3], ([total]) => total === 1));
        const traitor = third.page;
        await traitor.bringToFront();
        await traitor.getByTestId('betrayal-action-monsterTurnStart').click();
        await traitor.getByTestId('betrayal-action-monsterMovementRoll').click();
        const mummyRoll = traitor.getByTestId('betrayal-recent-roll-panel');
        await waitForPhysicalDiceSettled(mummyRoll);
        await snapshot('19-木乃伊掷移动骰并公开结果', traitor);
        await continueRoll();
        const actor = (await read()).core.monsters.find(monster => monster.id === mummyId)!;
        const defender = explorer((await read()).core, host.id);
        const attackCursor = chooseRollCursor(seed, [actor.might, defender.traits.might],
            ([attack, defense]) => attack - defense === 2);
        await prepare('19', '固定攻击骰随机段以产生两点可分配伤害', '无', () => {}, attackCursor);
        await traitor.bringToFront();
        await traitor.getByTestId('betrayal-action-monsterAttack').click();
        const mummyToken = traitor.locator(`button[data-scene-figure-id="monster:${mummyId}"]`);
        await clickBetrayalSceneFigure(mummyToken);
        await expect(traitor.locator('[data-scene-marker-id="marker:mummy-girl"]')).toHaveCount(0);
        await snapshot('20-木乃伊选中后展示同房攻击目标', traitor);
        await clickBetrayalSceneFigure(traitor.locator('button[data-scene-figure-id="player:0"]'));
        await waitForPhysicalDiceSettled(traitor.getByTestId('betrayal-recent-roll-panel'));
        await expect(traitor.locator('[data-betrayal-screen-feedback] [data-attack-impact-trait]')).toHaveCount(0);
        await snapshot('21-攻击席查看停稳的攻防骰', traitor);
        await continueRoll();
        await traitor.bringToFront();
        await expect(traitor.getByTestId('betrayal-mummy-reward-banner')).toBeVisible();
        await snapshot('22-胜者可选择偷取或造成伤害', traitor);
        await traitor.getByTestId('betrayal-mummy-reward-damage').click();
        await page.bringToFront();
        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toBeVisible();
        await snapshot('23-受伤席打开伤害分配', page);
        const allocation = (await read()).core.pendingDamageAllocation;
        expect(allocation).toMatchObject({ playerId: host.id, amount: 2, forcedTraitSequence: ['speed', 'speed'] });
        for (const trait of ['speed', 'speed']) {
            await page.getByTestId(`betrayal-damage-allocation-trait-${trait}-increase`).click();
        }
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
        await snapshot('23a-已分配两点速度伤害待确认', page);
        await page.getByTestId('betrayal-damage-allocation-confirm').click();
        await expect.poll(async () => (await read()).core.pendingDamageAllocation).toBeNull();
        const damageFloating = page.locator('[data-betrayal-screen-feedback]')
            .getByTestId(`betrayal-room-occupant-trait-change-${mummyRoom}-${host.id}`);
        await expect(damageFloating).toBeVisible();
        await expect(damageFloating).toHaveCSS('font-size', '16px');
        const damagedFigure = page.getByTestId(`betrayal-room-occupant-${mummyRoom}-${host.id}`);
        await expect(damagedFigure).toHaveAttribute('data-screen-feedback-anchor-y', /\S/);
        const headY = Number(await damagedFigure.getAttribute('data-screen-feedback-anchor-y'));
        const damageBox = (await damageFloating.boundingBox())!;
        expect(Math.abs(headY - damageBox.y - damageBox.height / 2)).toBeLessThanOrEqual(36);
        await snapshot('24-受伤属性结算回到棋桌', page);
        await waitForBetrayalFloatingTextGone(page, 6000);
        await traitor.bringToFront();
        await waitForBetrayalFloatingTextGone(traitor, 6000);
        const girl = traitor.getByTestId(`betrayal-room-haunt-token-${mummyRoom}-mummy-girl-token`);
        const use = traitor.getByTestId('betrayal-action-use');
        await expect(girl).toHaveAttribute('data-token-status', 'placed');
        await expect(page.getByRole('button', { name: '拾起女孩', exact: true })).toHaveCount(0);
        await snapshot('25-叛徒从地面拾取女孩', traitor);
        await clickBetrayalSceneGirl(girl);
        await expect(girl).toHaveAttribute('data-token-status', 'held-by-player');
        await expect(use).toContainText('交出女孩');
        await snapshot('26-女孩挂在叛徒模型后可交付', traitor);
        await use.click();
        await expect(girl).toHaveAttribute('data-token-status', 'held-by-mummy');
        await expect(use).toContainText('交出圣符');
        await snapshot('27-木乃伊接过女孩后交付圣符', traitor);
        await use.click();
        await expect.poll(async () => (await read()).core.scenarioRuntime.mummy?.mummyCarriedOmenIds).toContain(holySymbol!.id);
        expect((await read()).sys.gameover).toBeFalsy();
        await expect(mummyToken).toHaveAttribute('data-direct-target', 'true');
        await clickBetrayalSceneFigure(mummyToken);
        if ((await read()).core.rooms.find(room => room.id === coffinRoom)?.floor === 'basement') {
            await traitor.getByTestId('betrayal-room-floor-down').click();
        }
        await expect.poll(async () => JSON.parse((await traitor.getByTestId('betrayal-room-grid').getAttribute('data-map-room-highlights')) ?? '{}')[coffinRoom]).toBe('candidate');
        await snapshot('28-木乃伊携带女孩和圣符选择石棺房', traitor);
        await traitor.getByTestId(`betrayal-room-${coffinRoom}`).click();
        await expect.poll(async () => (await read()).core.endgameResult?.outcome).toBe('traitor');
        const terminal = await read();
        expect(terminal.sys.gameover).toBeTruthy();
        expect(terminal.core.endgameResult?.winners).toEqual([third.id]);
        expect(terminal.core.endgameResult?.stats.eventsDrawn).toBe(1);
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).toBeVisible();
        await snapshot('29-返棺触发正式结局朗读', page);
        const seatOutcomes: Record<string, string> = {};
        for (const player of players) {
            await expect(player.page.getByTestId(end)).toBeVisible();
            await player.page.getByTestId('betrayal-endgame-ending-continue').click();
            await expect(player.page.getByTestId('betrayal-endgame-result-report')).toBeVisible();
            await expect(player.page.getByTestId('betrayal-endgame-survivor-0')).toBeVisible();
            await expect(player.page.getByTestId('betrayal-endgame-survivor-1')).toBeVisible();
            const result = player.page.getByTestId('betrayal-endgame-outcome');
            await expect(result).toHaveText(player.id === third.id ? '胜利' : '失败');
            await expect(player.page.getByTestId('betrayal-endgame-events-drawn')).toHaveText('1');
            seatOutcomes[player.id] = await result.innerText();
        }
        expect(terminal.core.scenarioRuntime.mummy).toMatchObject({ girlHeldByMummy: true, mummyCarriedOmenIds: [holySymbol!.id] });
        await snapshot('30-第二席看到失败报告', second.page);
        await snapshot('31-叛徒席看到胜利报告', third.page);
        await snapshot('32-房主席看到失败报告', page);
        const steps = buildMummyGoldenSteps(snapshots, matchId, holySymbol!.id);
        for (const step of steps) {
            for (const assertion of step.assertions) {
                expect(assertion.actual, `${step.id}：${assertion.name}`).toEqual(assertion.expected);
            }
        }
        await writeFile(matchEvidenceFile, JSON.stringify({
            matchId, browserContextId, goldenMode: 'state-injected', outcome: 'traitor', seatOutcomes, snapshots,
            terminalStepId: steps.at(-1)!.id, steps, injections,
        }, null, 2));
    } finally {
        await Promise.all(contexts.slice(1).map(seat => seat.close()));
    }
});
