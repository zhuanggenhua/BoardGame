import { expect, test } from '@playwright/test';
import { createGuestId, getGameServerBaseURL, initContext, seedMatchCredentials } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { ARENA_ZONE_IDS, MAGE_IDS } from '../../src/games/mage-wars/domain/ids';
import type { MageWarsCore } from '../../src/games/mage-wars/domain/types';
import { getStandardStartingSpellbook, getStandardStartingSpellbookCount } from '../../src/games/mage-wars/domain/data/standardStartingSpellbooks';

/** 真人计划法术，AI 必须独立计划；代表正式联机交接，不声称完整对局。 */
test('法师战争在线真人计划后 AI 自主计划并进入行动阶段', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string | undefined });
    const guestId = createGuestId('mage-wars-human-ai');
    await initContext(context, { storageKey: '__mage_wars_human_ai_planning', skipImageGate: true, locale: 'zh-CN' });
    await context.addInitScript((id) => {
        localStorage.setItem('guest_id', id);
        sessionStorage.setItem('guest_id', id);
    }, guestId);
    const page = await context.newPage();
    const base = getGameServerBaseURL();
    try {
        const created = await page.request.post(`${base}/games/mage-wars/create`, { data: {
            numPlayers: 2,
            setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest', enableAi: true,
                seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 0 } } },
        } });
        expect(created.ok()).toBe(true);
        const { matchID } = await created.json() as { matchID: string };
        expect(matchID).toBeTruthy();
        const claim = async (playerID: string) => {
            const response = await page.request.post(`${base}/games/mage-wars/${matchID}/claim-seat`, {
                data: { playerID, playerName: playerID === '0' ? '玩家' : 'AI 玩家', guestId },
            });
            expect(response.ok()).toBe(true);
            const result = await response.json() as { playerCredentials: string };
            expect(result.playerCredentials).toBeTruthy();
            return result.playerCredentials;
        };
        const hostCredentials = await claim('0');
        const aiCredentials = await claim('1');
        await seedMatchCredentials(context, 'mage-wars', matchID, '0', hostCredentials);
        await context.addInitScript(({ match, credentials }) => {
            localStorage.setItem(`match_ai_creds_${match}`, JSON.stringify({ '1': credentials }));
        }, { match: matchID, credentials: aiCredentials });
        await page.goto(`/play/mage-wars/match/${matchID}?playerID=0`, { waitUntil: 'domcontentloaded' });
        const board = page.getByTestId('mage-wars-board');
        await expect(board).toBeVisible({ timeout: 90000 });
        const deadline = Date.now() + 45000;
        while (Date.now() < deadline && await board.getAttribute('data-mage-wars-phase') !== 'planning') {
            const end = page.getByTestId('mage-wars-turn-end');
            if (await end.isVisible().catch(() => false) && await end.isEnabled().catch(() => false)) await end.click();
            await page.waitForTimeout(250);
        }
        await expect(board).toHaveAttribute('data-mage-wars-phase', 'planning');
        await page.getByRole('button', { name: '生物', exact: true }).click();
        const creature = page.locator('[data-testid="mage-wars-desktop-spellbook-card"]:visible').first();
        await expect(creature).toBeEnabled();
        await creature.click();
        await page.getByTestId('mage-wars-plan-spells').click();
        const aiPlanned = new Set<string>();
        await expect.poll(async () => {
            const state = await getMatchState(matchID, page);
            for (const entry of state.sys?.eventStream?.entries ?? []) {
                const event = entry.event as { type?: string; payload?: { playerId?: string } };
                if (event.type === 'MW_SPELLS_PLANNED' && event.payload?.playerId) aiPlanned.add(event.payload.playerId);
            }
            return { players: [...aiPlanned].sort(), phase: state.sys?.phase };
        }, { timeout: 60000, message: '真人和 AI 都须实际计划，随后进入行动阶段' })
            .toMatchObject({ players: ['0', '1'] });
        await expect(board).not.toHaveAttribute('data-mage-wars-phase', 'planning', { timeout: 30000 });
    } finally {
        await context.close();
    }
});

test('法师战争在线预置隐藏结界时真人施法后 AI 自主反制', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string | undefined });
    const guestId = createGuestId('mage-wars-ai-counter');
    await initContext(context, { storageKey: '__mage_wars_ai_counter', skipImageGate: true, locale: 'zh-CN' });
    await context.addInitScript((id) => {
        localStorage.setItem('guest_id', id);
        sessionStorage.setItem('guest_id', id);
    }, guestId);
    const page = await context.newPage();
    const base = getGameServerBaseURL();
    try {
        const created = await page.request.post(`${base}/games/mage-wars/create`, { data: {
            numPlayers: 2,
            setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest', enableAi: true,
                seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 0 } } },
        } });
        expect(created.ok()).toBe(true);
        const { matchID } = await created.json() as { matchID: string };
        const claim = async (playerID: string) => {
            const response = await page.request.post(`${base}/games/mage-wars/${matchID}/claim-seat`, {
                data: { playerID, playerName: playerID === '0' ? '玩家' : 'AI 玩家', guestId },
            });
            expect(response.ok()).toBe(true);
            return (await response.json() as { playerCredentials: string }).playerCredentials;
        };
        const hostCredentials = await claim('0');
        const aiCredentials = await claim('1');
        await seedMatchCredentials(context, 'mage-wars', matchID, '0', hostCredentials);
        await context.addInitScript(({ match, credentials }) => {
            localStorage.setItem(`match_ai_creds_${match}`, JSON.stringify({ '1': credentials }));
        }, { match: matchID, credentials: aiCredentials });
        await page.goto(`/play/mage-wars/match/${matchID}?playerID=0`, { waitUntil: 'domcontentloaded' });
        const board = page.getByTestId('mage-wars-board');
        await expect(board).toBeVisible({ timeout: 90000 });
        const state = await getMatchState(matchID, page);
        const core = state.core as MageWarsCore;
        const targetId = 'e2e-ai-counter-target';
        const responseId = 'e2e-ai-counter-enchantment';
        const zoneId = ARENA_ZONE_IDS.A2;
        const common = { ownerId: '1', zoneId, damage: 0, armor: 0, guarding: false, statusTokens: {} };
        const objects = {
            [targetId]: { ...common, id: targetId, kind: 'creature' as const, sourceSpellCardId: 2811,
                sourceObjectId: 'spell-2811', name: '阿希拉牧师', life: 12, actionReady: true,
                combatProfilesSource: 'config' as const, combatTraitsSource: 'config' as const,
                summonedTurnNumber: 1, typeLine: '生物 / 人类', schoolLine: '自然', attackOrTraitLine: '', rulesText: '' },
            [responseId]: { ...common, id: responseId, kind: 'enchantment' as const, sourceSpellCardId: 1901,
                sourceObjectId: 'spell-1901', name: '法力失效', life: 1, actionReady: false,
                typeLine: '结界 / 超魔', schoolLine: '超魔', attackOrTraitLine: '',
                rulesText: '当本生物成为对手控制的咒语或结界类法术的目标时，你必须在法术反制步骤中展示法力失效。',
                revealed: false, anchoredToObjectId: targetId },
        };
        const mageId = MAGE_IDS.WARLOCK_APPRENTICE;
        const players = {
            ...core.players,
            '0': { ...core.players['0'], mageId, mageZoneId: ARENA_ZONE_IDS.A1, mana: 20,
                actionReady: true, quickcastReady: true, preparedSpellSlots: 1, preparedSpellCardIds: [1800],
                spellbookCount: getStandardStartingSpellbookCount(mageId),
                spellbookEntries: getStandardStartingSpellbook(mageId).map((entry) => ({ spellCardId: entry.workshopCardIds[0], count: entry.quantity })) },
            '1': { ...core.players['1'], mageId: MAGE_IDS.PRIESTESS_APPRENTICE, mageZoneId: ARENA_ZONE_IDS.D3,
                mana: 10, discardSpellCardIds: [1901] },
        };
        await injectMatchState(matchID, {
            ...state,
            core: { ...core, currentPlayerId: '0', phaseActorId: '0', phaseReadyPlayerIds: [],
                gameResult: undefined, players, objects,
                arena: core.arena.map((zone) => ({ ...zone,
                    occupantIds: core.playerOrder.filter((id) => players[id]?.mageZoneId === zone.id),
                    objectIds: zone.id === zoneId ? [targetId, responseId] : [], conjurationIds: [] })) },
            sys: { ...state.sys, phase: 'initiativeQuickcast', turnOrder: ['0', '1'], currentPlayerIndex: 0,
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined }, resolution: undefined, flowHalted: false },
        }, undefined, { playerId: '0', credentials: hostCredentials });
        await expect(board).toHaveAttribute('data-mage-wars-phase', 'initiativeQuickcast');
        const target = page.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${targetId}"]`).first();
        await expect(target).toBeVisible();
        const spell = page.locator('[data-mage-wars-prepared-card="self"][aria-label="剧痛难当"]').first();
        await expect(spell).toBeEnabled();
        await spell.click();
        await expect(target.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
        await target.click();
        await expect.poll(async () => {
            const snapshot = await getMatchState(matchID, page);
            const current = snapshot.core as MageWarsCore;
            const events = (snapshot.sys?.eventStream?.entries ?? []).map((entry) => entry.event);
            return {
                countered: events.some((event) => event.type === 'MW_SPELL_COUNTERED'
                    && (event.payload as { responseObjectId?: string }).responseObjectId === responseId),
                revealed: events.some((event) => event.type === 'MW_ENCHANTMENT_REVEALED'
                    && (event.payload as { objectId?: string }).objectId === responseId),
                targetPresent: !!current.objects[targetId],
                responseGone: !current.objects[responseId],
                discarded: current.players['0'].discardSpellCardIds.includes(1800),
            };
        }, { timeout: 30000, message: 'AI 应自行揭示结界并反制真人法术' }).toEqual({
            countered: true, revealed: true, targetPresent: true, responseGone: true, discarded: true,
        });
        await expect(target).toBeVisible();
    } finally {
        await context.close();
    }
});

test('法师战争在线 AI 从巢穴部署已计划生物并交还行动权', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string | undefined });
    const guestId = createGuestId('mage-wars-ai-deployment');
    await initContext(context, { storageKey: '__mage_wars_ai_deployment', skipImageGate: true, locale: 'zh-CN' });
    await context.addInitScript((id) => {
        localStorage.setItem('guest_id', id);
        sessionStorage.setItem('guest_id', id);
    }, guestId);
    const page = await context.newPage();
    const base = getGameServerBaseURL();
    let matchID = '';
    let access: { playerId: string; credentials: string } | undefined;
    try {
        const created = await page.request.post(`${base}/games/mage-wars/create`, { data: {
            numPlayers: 2,
            setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest', enableAi: true,
                seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 0 } } },
        } });
        expect(created.ok()).toBe(true);
        ({ matchID } = await created.json() as { matchID: string });
        const claim = async (playerID: string) => {
            const response = await page.request.post(`${base}/games/mage-wars/${matchID}/claim-seat`, {
                data: { playerID, playerName: playerID === '0' ? '玩家' : 'AI 玩家', guestId },
            });
            expect(response.ok()).toBe(true);
            return (await response.json() as { playerCredentials: string }).playerCredentials;
        };
        const hostCredentials = await claim('0');
        const aiCredentials = await claim('1');
        access = { playerId: '0', credentials: hostCredentials };
        await seedMatchCredentials(context, 'mage-wars', matchID, '0', hostCredentials);
        await context.addInitScript(({ match, credentials }) => {
            localStorage.setItem(`match_ai_creds_${match}`, JSON.stringify({ '1': credentials }));
        }, { match: matchID, credentials: aiCredentials });
        await page.goto(`/play/mage-wars/match/${matchID}?playerID=0`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('mage-wars-board')).toBeVisible({ timeout: 90000 });

        const state = await getMatchState(matchID, page);
        const core = state.core as MageWarsCore;
        const source = { abilityId: 'mw.source.2218.spawn-point', kind: 'spawn-point' as const,
            phase: 'deployment' as const, allowedSpellTypes: ['生物'], allowedTypeLineIncludes: ['动物'], channeling: 4 };
        const spawnId = 'e2e-ai-deployment-den';
        const zoneId = ARENA_ZONE_IDS.A1;
        await injectMatchState(matchID, {
            ...state,
            core: {
                ...core,
                currentPlayerId: '0', phaseActorId: '0', phaseReadyPlayerIds: [], gameResult: undefined,
                players: { ...core.players, '1': { ...core.players['1'], mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                    mana: 5, spellbookEntries: [{ spellCardId: 2819, count: 1 }], spellbookCount: 1 } },
                objects: { ...core.objects, [spawnId]: {
                    id: spawnId, kind: 'conjuration', ownerId: '1', sourceSpellCardId: 2218,
                    sourceObjectId: 'spell-2218', spellcastingSource: source, preparedSpellCardId: 2819,
                    mana: 4, name: '巢穴', zoneId, life: 13, damage: 0, armor: 3,
                    actionReady: false, guarding: false, statusTokens: {},
                } },
                arena: core.arena.map((zone) => zone.id === zoneId
                    ? { ...zone, objectIds: [...zone.objectIds, spawnId] } : zone),
            },
            sys: { ...state.sys, phase: 'deployment', turnOrder: ['0', '1'], currentPlayerIndex: 0,
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined }, resolution: undefined, flowHalted: false },
        }, undefined, access);
        await expect(page.getByTestId('mage-wars-board')).toHaveAttribute('data-mage-wars-phase', 'deployment');
        await page.getByTestId('mage-wars-turn-end').click();
        await expect.poll(async () => {
            const snapshot = await getMatchState(matchID, page);
            const current = snapshot.core as MageWarsCore;
            return JSON.stringify({
                deployed: Object.values(current.objects).some((object) =>
                    object.ownerId === '1' && object.sourceSpellCardId === 2819 && object.zoneId === zoneId),
                phase: snapshot.sys.phase, actor: current.phaseActorId,
                den: current.objects[spawnId],
            });
        }, { timeout: 20000, message: 'AI 应从巢穴实际施放并部署丛林灰狼' }).toContain('"deployed":true');
        await expect(page.locator('[data-testid="mage-wars-arena-zone-a1"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2819"]')).toBeVisible({ timeout: 15000 });
        await expect.poll(async () => ((await getMatchState(matchID, page)).core as MageWarsCore).phaseActorId,
            { timeout: 30000, message: 'AI 部署完成后应交还行动权' }).toBe('0');
    } finally {
        await context.close();
    }
});
