import { test, expect } from '../framework';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, readyMultiplePlayersAndStartGame, selectCharacter, setupDTOnlineMatchWithPlayers, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import { getDieFaceByDefinition } from '../../src/games/dicethrone/domain/rules';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { finalizeThorEvidenceSourceIdentity, shot, waitForDamageNumbersToSettle } from '../helpers/dicethroneThorEvidence';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

test('索尔四人连锁闪电选择另一个敌人承受附属伤害', async ({ browser, baseURL }, info) => {
    test.setTimeout(180000);
    await clearEvidenceScreenshotsForTest(info);
    const match = await setupDTOnlineMatchWithPlayers(browser, baseURL, { numPlayers: 4, gameServerBaseURL: getGameServerBaseURL(), skipImageGate: true, characterSelectionTimeout: 180000, sourceIdentityStartAtMatchRoute: true });
    if (!match || match.players.length !== 4) { if (match) await cleanupDTMatch(match); throw new Error('未能建立四人房间'); }
    const pages = match.players.map(player => player.page);
    const current = async () => { const value = await getMatchState(match.matchId, match.hostPage) as any; return value.G ?? value; };
    try {
        for (const [index, hero] of ['thor','monk','treant','samurai'].entries()) await selectCharacter(pages[index], hero);
        await readyMultiplePlayersAndStartGame(match.hostPage, pages.slice(1));
        await Promise.all(pages.map(async page => { await page.setViewportSize({ width: 1920, height: 1080 }); await waitForGameBoard(page); await closeDebugPanelIfOpen(page); }));
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core as DiceThroneCore;
        for (const player of Object.values(core.players)) { player.deck.push(...player.hand); player.hand = []; }
        const dice = [1,1,1,6,6].map((value,id) => { const symbol = getDieFaceByDefinition('thor-dice', value)!; return { id, value, symbol, symbols: [symbol], isKept: false, definitionId: 'thor-dice', ownerId: '0' }; });
        Object.assign(core, { activePlayerId: '0', phase: 'offensiveRoll', turnPhase: 'offensiveRoll', rollCount: 1, rollConfirmed: true, rollDiceCount: 5, dice, pendingAttack: null, pendingDamage: undefined });
        core.currentRollContext = createMainRollContext(core, { phase: 'offensiveRoll', ownerPlayerId: '0', dice });
        const sys = root.sys; sys.turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder : Object.keys(core.players);
        Object.assign(sys, { phase: 'offensiveRoll', currentPlayerIndex: sys.turnOrder.findIndex((id: unknown) => String(id) === '0'), flowHalted: false });
        sys.interaction = { ...sys.interaction, current: undefined, queue: [] }; sys.responseWindow = { ...sys.responseWindow, current: undefined };
        await injectMatchState(match.matchId, stored, match.hostPage);
        await match.hostPage.locator('[data-ability-slot="lotus"][data-can-click="true"]').first().click();
        await Promise.all(pages.map(page => continueAttackShowcaseIfVisible(page)));
        await match.hostPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        await match.hostPage.locator('[data-tutorial-id="dice-roll-button"]').click();
        await match.hostPage.locator('[data-tutorial-id="dice-confirm-button"]').click();
        await match.hostPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        let state = await current();
        if (state.sys.interaction.current?.kind === 'dt:defender-choice') {
            await pages[Number(state.sys.interaction.current.playerId)].getByTestId('dt-defender-choice-option-1').click();
        }
        await expect.poll(async () => (await current()).core.pendingAttack?.defenderId).toMatch(/^[13]$/);
        const defender = String((await current()).core.pendingAttack.defenderId);
        await expect.poll(async () => (await current()).core.pendingBonusDiceSettlement?.dice.length).toBe(3);
        await match.hostPage.locator('[data-tutorial-id="dice-confirm-button"]').click();
        await match.hostPage.getByTestId('die-button-0').click(); await match.hostPage.getByTestId('die-button-1').click();
        await match.hostPage.getByTestId('dice-interaction-confirm-button').click();
        await expect.poll(async () => (await current()).sys.interaction.current?.data?.options?.map((o: any) => o.value?.customId)).toContain('thor-chain-target');
        state = await current();
        const other = defender === '1' ? '3' : '1';
        const option = state.sys.interaction.current.data.options.find((o: any) => o.value?.customId === 'thor-chain-target' && o.value?.targetPlayerId === other);
        expect(option).toBeTruthy();
        for (const page of pages.slice(1)) {
            await expect(page.getByTestId(`dt-player-target-${other}`)).toHaveCount(0);
        }
        await shot(match.hostPage, info, '01-主攻击目标已确定后选择其他附属目标');
        await match.hostPage.getByTestId(`dt-player-target-${other}`).click();
        const confirm = match.hostPage.locator('#modal-root').getByRole('button', { name: '确认', exact: true }).last();
        await expect(confirm).toBeEnabled();
        await shot(match.hostPage, info, '02-选中附属目标后使用原确认');
        await confirm.click();
        await expect.poll(async () => { const s = await current(); return { defender: s.core.pendingAttack?.defenderId, hp: s.core.teamHealth.B, phase: s.sys.phase }; }).toEqual({ defender, hp: 48, phase: 'defensiveRoll' });
        await expect.poll(async () => {
            const entries = (await current()).sys.eventStream?.entries ?? [];
            return entries.some((entry: any) => entry.event?.type === 'DAMAGE_DEALT'
                && entry.event.payload?.sourceAbilityId === 'thor-chain-lightning'
                && entry.event.payload?.targetId === other
                && entry.event.payload?.damageScope === 'direct'
                && entry.event.payload?.amount === 2);
        }).toBe(true);
        await waitForDamageNumbersToSettle(match.hostPage);
        await shot(match.hostPage, info, '03-附属伤害结算并保留主攻击');
        await finalizeThorEvidenceSourceIdentity(match.hostPage);
    } finally { await cleanupDTMatch(match); }
});
