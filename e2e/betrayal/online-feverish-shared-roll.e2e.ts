import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createGuestId, getGameServerBaseURL, initContext, seedMatchCredentials } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import type { BetrayalCore } from '../../src/games/betrayal/game';

async function closeScenarioOverlays(page: Page) {
    const cue = page.getByTestId('betrayal-haunt-reveal-close');
    if (await cue.isVisible({ timeout: 1000 }).catch(() => false)) await cue.click();
    const reader = page.getByTestId('betrayal-scenario-reader-dialog');
    if (await reader.isVisible({ timeout: 1000 }).catch(() => false)) {
        await reader.getByTestId('betrayal-scenario-reader-close').click();
        await expect(reader).toBeHidden();
    }
}

test('六人在线代表态中两名病患控制者共享移动骰并按揭示者后轮序交接', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const contexts: BrowserContext[] = [];
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const ids = ['0', '1', '2', '3', '4', '5'];
    const guestIds = Object.fromEntries(ids.map((id) => [id, createGuestId(`betrayal-${id}`)]));
    const pages = new Map<string, Page>();
    const pageErrors: string[] = [];
    try {
        for (const id of ['2', '0', '3']) {
            const context = await browser.newContext({ baseURL });
            contexts.push(context);
            await initContext(context, { storageKey: `__betrayal_shared_roll_${id}`, skipImageGate: true, locale: 'zh-CN' });
            await context.addInitScript((guestId) => {
                localStorage.setItem('guest_id', guestId);
                sessionStorage.setItem('guest_id', guestId);
            }, guestIds[id]);
            const page = await context.newPage();
            page.on('pageerror', (error) => pageErrors.push(`${id}: ${error.message}`));
            pages.set(id, page);
        }
        const host = pages.get('2')!;
        const base = getGameServerBaseURL();
        const created = await host.request.post(`${base}/games/betrayal/create`, { data: {
            numPlayers: 6, setupData: { guestId: guestIds['0'], ownerKey: `guest:${guestIds['0']}`, ownerType: 'guest' },
        } });
        expect(created.ok()).toBe(true);
        const { matchID } = await created.json() as { matchID: string };
        expect(matchID).toBeTruthy();
        const credentials: Record<string, string> = {};
        for (const id of ids) {
            if (id !== '0') {
                const joined = await (pages.get(id) ?? host).request.post(`${base}/games/betrayal/${matchID}/join`, {
                    data: { playerID: id, playerName: `玩家${id}`, data: { guestId: guestIds[id] } },
                });
                expect(joined.ok(), `席位 ${id} 加入失败：${joined.status()} ${await joined.text()}`).toBe(true);
                credentials[id] = (await joined.json() as { playerCredentials: string }).playerCredentials;
                continue;
            }
            const response = await host.request.post(`${base}/games/betrayal/${matchID}/claim-seat`, {
                data: { playerID: id, playerName: `玩家${id}`, guestId: guestIds[id] },
            });
            expect(response.ok(), `席位 ${id} 占座失败：${response.status()}`).toBe(true);
            credentials[id] = (await response.json() as { playerCredentials: string }).playerCredentials;
            expect(credentials[id]).toBeTruthy();
        }
        for (const id of ['2', '0', '3']) {
            const page = pages.get(id)!;
            await seedMatchCredentials(page.context(), 'betrayal', matchID, id, credentials[id]);
            await page.goto(`/play/betrayal/match/${matchID}?playerID=${id}`, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).not.toBeEmpty({ timeout: 30000 });
        }

        // 前态来自六人正式规则夹具；只预置死亡、病患与揭示者，后续由页面操作。
        const core = await host.evaluate(async () => {
            const path = '/src/games/betrayal/testing/firstScenarioTestUtils.ts';
            const fixtures = await import(/* @vite-ignore */ path);
            const next = fixtures.createDustFeverishNaturalMonsterTurnBeforeRollCore(['0', '1', '2', '3', '4', '5']) as BetrayalCore;
            next.scenarioRuntime.hauntRevealerPlayerId = '2';
            next.scenarioRuntime.deadExplorerPlayerIds.push('3');
            next.scenarioRuntime.dust!.permanentTraitorPlayerIds.push('3');
            next.scenarioRuntime.dust!.feverishPlayerIds.push('3');
            const monster = next.monsters.find((item) => item.id === 'feverish-0')!;
            next.monsters.push({ ...monster, id: 'feverish-3' });
            const explorer = next.otherExplorers.find((item) => item.playerId === '3')!;
            explorer.inventory = [];
            return next;
        });
        const state = await getMatchState(matchID, host);
        await injectMatchState(matchID, { ...state, core, sys: { ...state.sys, turnOrder: ids, currentPlayerIndex: 2 } },
            undefined, { playerId: '2', credentials: credentials['2'] });
        for (const [id, page] of pages) {
            try {
                await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
            } catch (error) {
                console.log('联机入口诊断', JSON.stringify({ seat: id, url: page.url(),
                    body: (await page.locator('body').innerText().catch(() => '')).slice(0, 2000), pageErrors }));
                throw error;
            }
            await closeScenarioOverlays(page);
        }
        await expect.poll(async () => ((await getMatchState(matchID, host)).core as BetrayalCore).currentPlayer).toBe('2');
        await host.getByTestId('betrayal-action-endTurn').click({ timeout: 10000, noWaitAfter: true });
        await expect.poll(async () => ((await getMatchState(matchID, host)).core as BetrayalCore).currentPlayer,
            { timeout: 15000 }).toBe('0');
        const afterRoll = (await getMatchState(matchID, host)).core as BetrayalCore;
        expect(afterRoll.recentRoll).toMatchObject({ kind: 'monsterMoveRoll', playerId: '0' });
        const dice = afterRoll.recentRoll!.dice;
        const allowance = afterRoll.movesRemaining;
        const first = pages.get('0')!;
        const confirm = first.getByTestId('betrayal-roll-continue');
        await expect(confirm).toBeEnabled({ timeout: 60000 });
        await confirm.click();
        const destination = first.getByTestId('betrayal-room-entrance-hall');
        await expect(destination).toBeEnabled({ timeout: 15000 });
        await destination.click({ timeout: 10000, noWaitAfter: true });
        await expect.poll(async () => {
            const current = (await getMatchState(matchID, host)).core as BetrayalCore;
            return { room: current.monsters.find((item) => item.id === 'feverish-0')?.roomId,
                remaining: current.movesRemaining };
        }, { timeout: 15000 }).toEqual({ room: 'entrance-hall', remaining: Math.max(0, allowance - 2) });
        await expect(first.getByTestId('betrayal-action-endTurn')).toBeEnabled({ timeout: 15000 });
        await first.getByTestId('betrayal-action-endTurn').click({ timeout: 10000, noWaitAfter: true });
        await expect.poll(async () => ((await getMatchState(matchID, host)).core as BetrayalCore).currentPlayer,
            { timeout: 15000 }).toBe('3');
        const afterHandoff = (await getMatchState(matchID, host)).core as BetrayalCore;
        expect(afterHandoff.movesRemaining).toBe(allowance);
        expect(afterHandoff.scenarioRuntime.monsterTurn.movementRollsByGroupId['狂热病患:5'].dice).toEqual(dice);
        expect(afterHandoff.recentRoll).toBeNull();
        const second = pages.get('3')!;
        await expect(second.getByTestId('betrayal-action-endTurn')).toBeEnabled({ timeout: 15000 });
        await expect(pages.get('0')!.getByTestId('betrayal-action-endTurn')).toBeDisabled();
        await expect(second.getByTestId('betrayal-action-monsterTurnStart')).toBeEnabled();
        await expect(pages.get('0')!.getByTestId('betrayal-action-monsterTurnStart')).toBeDisabled();
        await second.getByTestId('betrayal-room-entrance-hall').click({ timeout: 10000, noWaitAfter: true });
        await expect.poll(async () => {
            const current = (await getMatchState(matchID, host)).core as BetrayalCore;
            return { room: current.monsters.find((item) => item.id === 'feverish-3')?.roomId,
                remaining: current.movesRemaining };
        }, { timeout: 15000 }).toEqual({ room: 'entrance-hall', remaining: Math.max(0, allowance - 2) });
        await second.getByTestId('betrayal-action-endTurn').click({ timeout: 10000, noWaitAfter: true });
        await expect.poll(async () => ((await getMatchState(matchID, host)).core as BetrayalCore).currentPlayer,
            { timeout: 15000 }).toBe('4');
    } finally {
        await Promise.all(contexts.map((context) => context.close()));
    }
});

test('在线两席按攻击方确认、受伤方分配的顺序交接', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const contexts: BrowserContext[] = [];
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const ids = ['0', '1', '2'];
    const guestIds = Object.fromEntries(ids.map(id => [id, createGuestId(`betrayal-attack-${id}`)]));
    const pages = new Map<string, Page>();
    try {
        for (const id of ['0', '1']) {
            const context = await browser.newContext({ baseURL });
            contexts.push(context);
            await initContext(context, { storageKey: `__betrayal_attack_${id}`, skipImageGate: true, locale: 'zh-CN' });
            await context.addInitScript(guestId => {
                localStorage.setItem('guest_id', guestId);
                sessionStorage.setItem('guest_id', guestId);
            }, guestIds[id]);
            pages.set(id, await context.newPage());
        }
        const attacker = pages.get('0')!;
        const defender = pages.get('1')!;
        const base = getGameServerBaseURL();
        const created = await attacker.request.post(`${base}/games/betrayal/create`, { data: {
            numPlayers: 3, setupData: { guestId: guestIds['0'], ownerKey: `guest:${guestIds['0']}`, ownerType: 'guest' },
        } });
        expect(created.ok()).toBe(true);
        const { matchID } = await created.json() as { matchID: string };
        const credentials: Record<string, string> = {};
        for (const id of ids) {
            const response = id === '0'
                ? await attacker.request.post(`${base}/games/betrayal/${matchID}/claim-seat`, {
                    data: { playerID: id, playerName: `玩家${id}`, guestId: guestIds[id] },
                })
                : await attacker.request.post(`${base}/games/betrayal/${matchID}/join`, {
                    data: { playerID: id, playerName: `玩家${id}`, data: { guestId: guestIds[id] } },
                });
            expect(response.ok()).toBe(true);
            credentials[id] = (await response.json() as { playerCredentials: string }).playerCredentials;
        }
        for (const [id, page] of pages) {
            await seedMatchCredentials(page.context(), 'betrayal', matchID, id, credentials[id]);
            await page.goto(`/play/betrayal/match/${matchID}?playerID=${id}`, { waitUntil: 'domcontentloaded' });
        }
        // 通过正式领域命令构造攻击后状态，两个浏览器负责后续真实联机操作。
        const core = await attacker.evaluate(async () => {
            const path = '/src/games/betrayal/testing/firstScenarioTestUtils.ts';
            const fixtures = await import(/* @vite-ignore */ path);
            return fixtures.applyBetrayalCommand(fixtures.createDustFeverishAttackReadyCore(),
                'MONSTER_ATTACK_HERO', '0', { monsterId: 'feverish-0', targetPlayerId: '1' },
                100, fixtures.createBetrayalScriptedRandom(2, 1, 1, 1, 1, 1, 1, 1, 1, 1)) as BetrayalCore;
        });
        expect(core.pendingDamageAllocation).toMatchObject({ playerId: '1', amount: 1 });
        const before = [core.currentExplorer, ...core.otherExplorers].find(explorer => explorer.playerId === '1')!.traitTracks.might.position;
        const state = await getMatchState(matchID, attacker);
        await injectMatchState(matchID, { ...state, core, sys: { ...state.sys, turnOrder: ids, currentPlayerIndex: 0 } },
            undefined, { playerId: '0', credentials: credentials['0'] });
        for (const page of pages.values()) {
            await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
            await closeScenarioOverlays(page);
        }
        await expect(attacker.getByTestId('betrayal-roll-continue')).toBeEnabled({ timeout: 60000 });
        await expect(defender.getByTestId('betrayal-damage-allocation-panel')).toHaveCount(0);
        await attacker.getByTestId('betrayal-roll-continue').click();
        const panel = defender.getByTestId('betrayal-damage-allocation-panel');
        await expect(panel).toBeVisible({ timeout: 30000 });
        await panel.getByTestId('betrayal-damage-allocation-trait-might-increase').click();
        await panel.getByTestId('betrayal-damage-allocation-confirm').click();
        await expect.poll(async () => {
            const current = (await getMatchState(matchID, attacker)).core as BetrayalCore;
            const hero = [current.currentExplorer, ...current.otherExplorers].find(explorer => explorer.playerId === '1');
            return { pending: current.pendingDamageAllocation, position: hero?.traitTracks.might.position };
        }, { timeout: 15000 }).toEqual({ pending: null, position: before - 1 });
        await expect(panel).toHaveCount(0);
    } finally {
        await Promise.all(contexts.map(context => context.close()));
    }
});
