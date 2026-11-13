import { test, expect } from '../framework';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, dragDiceThroneHandCardToPlay, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

test('索尔飞锤独立伤害被公共防护牌防止后主攻击继续', async ({ browser }, info) => {
    test.setTimeout(180000);
    const match = await setupOnlineMatch(browser, info.project.use.baseURL as string ?? getGameServerBaseURL(), { skipImageGate: true, characterSelectionTimeout: 120000 });
    if (!match) throw new Error('未能建立双人房间');
    try {
        await selectCharacter(match.hostPage, 'thor');
        await selectCharacter(match.guestPage, 'monk');
        await readyAndStartGame(match.hostPage, match.guestPage);
        await Promise.all([match.hostPage, match.guestPage].map(async page => { await waitForGameBoard(page); await closeDebugPanelIfOpen(page); }));
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core as DiceThroneCore;
        const thor = core.players['0'];
        thor.deck.push(...thor.hand); thor.hand = [];
        const monk = core.players['1'];
        const zone = [monk.hand, monk.deck, monk.discard].find(cards => cards.some(card => card.id === 'card-next-time'));
        expect(zone).toBeTruthy();
        const card = zone!.splice(zone!.findIndex(item => item.id === 'card-next-time'), 1)[0];
        monk.deck.push(...monk.hand); monk.hand = [card]; monk.resources.cp = 5; monk.tokens.taiji = 0;
        const dice = [1,1,1,1,1].map((value,id) => ({ id, value, symbol: 'thor_hammer', symbols: ['thor_hammer'], isKept: false, definitionId: 'thor-dice', ownerId: '0' }));
        Object.assign(core, { activePlayerId: '0', phase: 'offensiveRoll', turnPhase: 'offensiveRoll', rollCount: 1, rollConfirmed: true, rollDiceCount: 5, dice, pendingAttack: null, pendingDamage: undefined });
        core.currentRollContext = createMainRollContext(core, { phase: 'offensiveRoll', ownerPlayerId: '0', dice });
        const sys = root.sys;
        sys.turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder : Object.keys(core.players);
        Object.assign(sys, { phase: 'offensiveRoll', currentPlayerIndex: sys.turnOrder.findIndex((id: unknown) => String(id) === '0'), flowHalted: false });
        sys.interaction = { ...sys.interaction, current: undefined, queue: [] };
        sys.responseWindow = { ...sys.responseWindow, current: undefined };
        await injectMatchState(match.matchId, stored, match.hostPage);
        const current = async () => { const value = await getMatchState(match.matchId, match.hostPage) as any; return value.G ?? value; };
        await match.hostPage.locator('[data-ability-slot="fist"][data-can-click="true"]').first().click();
        await Promise.all([match.hostPage, match.guestPage].map(page => continueAttackShowcaseIfVisible(page)));
        await match.hostPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        await expect.poll(async () => {
            const state = await current();
            return { scope: state.core.pendingDamage?.damageScope, amount: state.core.pendingDamage?.currentDamage, target: state.core.pendingDamage?.targetPlayerId };
        }).toEqual({ scope: 'direct', amount: 1, target: '1' });
        await continueAttackShowcaseIfVisible(match.guestPage);
        await dragDiceThroneHandCardToPlay(match.guestPage, 'card-next-time');
        await expect.poll(async () => (await current()).core.pendingDamage?.currentDamage).toBe(0);
        const pass = match.guestPage.getByTestId('dicethrone-response-pass-button');
        if (await pass.isVisible()) await pass.click();
        await expect.poll(async () => {
            const state = await current();
            return { hp: state.core.players['1'].resources.hp, phase: state.sys.phase, resolved: state.core.pendingAttack?.damageResolved === true };
        }).toEqual({ hp: 50, phase: 'defensiveRoll', resolved: false });
    } finally { await cleanupDTMatch(match); }
});
