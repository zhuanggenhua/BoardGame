import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, readyMultiplePlayersAndStartGame, selectCharacter, setupDTOnlineMatchWithPlayers, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { finalizeThorEvidenceSourceIdentity, shot, waitForDamageNumbersToSettle } from '../helpers/dicethroneThorEvidence';
import { getDieFaceByDefinition } from '../../src/games/dicethrone/domain/rules';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

test('四人队伍败北时持有者的姆乔尔尼尔自动返回索尔', async ({ browser, baseURL }, info) => {
    test.setTimeout(180000);
    await clearEvidenceScreenshotsForTest(info);
    const match = await setupDTOnlineMatchWithPlayers(browser, baseURL, { numPlayers: 4, gameServerBaseURL: getGameServerBaseURL(), skipImageGate: true, characterSelectionTimeout: 180000, sourceIdentityStartAtMatchRoute: true });
    if (!match || match.players.length !== 4) {
        if (match) await cleanupDTMatch(match);
        throw new Error('未能建立四人房间');
    }
    const pages = match.players.map(player => player.page);
    const current = async () => { const value = await getMatchState(match.matchId, match.hostPage) as any; return value.G ?? value; };
    try {
        for (const [index, hero] of ['thor', 'monk', 'treant', 'samurai'].entries()) await selectCharacter(pages[index], hero);
        await readyMultiplePlayersAndStartGame(match.hostPage, pages.slice(1));
        await Promise.all(pages.map(async page => { await page.setViewportSize({ width: 1920, height: 1080 }); await waitForGameBoard(page); await closeDebugPanelIfOpen(page); }));
        // 预置双方合法低血量、锤持有者和已确认的小顺子；目标骰、技能和防御实际操作。
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core as DiceThroneCore;
        for (const player of Object.values(core.players)) { player.deck.push(...player.hand); player.hand = []; }
        core.players['0'].tokens.mjolnir = 0;
        core.players['0'].tokens.electrokinesis = 0;
        core.players['1'].tokens.mjolnir = 1;
        core.teamHealth!.B = 1;
        core.players['1'].resources.hp = core.players['3'].resources.hp = 1;
        const dice = [1, 2, 3, 4, 4].map((value, id) => {
            const symbol = getDieFaceByDefinition('thor-dice', value)!;
            return { id, value, symbol, symbols: [symbol], isKept: false, definitionId: 'thor-dice', ownerId: '0' };
        });
        Object.assign(core, { activePlayerId: '0', phase: 'offensiveRoll', turnPhase: 'offensiveRoll', rollCount: 1, rollConfirmed: true, rollDiceCount: 5, dice, pendingAttack: null, pendingDamage: undefined });
        core.currentRollContext = createMainRollContext(core, { phase: 'offensiveRoll', ownerPlayerId: '0', dice });
        const sys = root.sys;
        sys.phase = 'offensiveRoll';
        sys.turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder : Object.keys(core.players);
        sys.currentPlayerIndex = sys.turnOrder.findIndex((id: unknown) => String(id) === '0');
        sys.interaction = { ...sys.interaction, current: undefined, queue: [] };
        sys.responseWindow = { ...sys.responseWindow, current: undefined };
        sys.flowHalted = false;
        await injectMatchState(match.matchId, stored, match.hostPage);
        await expect.poll(async () => ({ holder: (await current()).core.players['1'].tokens.mjolnir, attack: (await current()).core.pendingAttack ?? null })).toEqual({ holder: 1, attack: null });
        await shot(match.hostPage, info, '01-四人预置低血量及敌人持锤');
        const skill = match.hostPage.locator('[data-ability-slot="combo"][data-can-click="true"]');
        await expect(skill).toBeVisible();
        await skill.click();
        await expect.poll(async () => (await current()).core.pendingAttack?.sourceAbilityId).toBe('thor-thunder-strike');
        await Promise.all(pages.map(page => continueAttackShowcaseIfVisible(page)));
        await match.hostPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        await match.hostPage.locator('[data-tutorial-id="dice-roll-button"]').click();
        await match.hostPage.locator('[data-tutorial-id="dice-confirm-button"]').click();
        await match.hostPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        let state = await current();
        if (state.sys.interaction.current?.kind === 'dt:defender-choice') {
            const chooser = pages[Number(state.sys.interaction.current.playerId)];
            await chooser.getByTestId('dt-defender-choice-option-1').click();
        }
        await expect.poll(async () => (await current()).core.pendingAttack?.defenderId).toMatch(/^[13]$/);
        state = await current();
        const target = String(state.core.pendingAttack.defenderId);
        const defender = pages[Number(target)];
        await Promise.all(pages.map(page => continueAttackShowcaseIfVisible(page)));
        const beginDefense = defender.getByRole('button', { name: '开始防御', exact: true });
        if (await beginDefense.isVisible()) await test.step('目标开始防御', async () => beginDefense.click({ timeout: 15000 }));
        await test.step('目标投掷防御骰', async () => defender.locator('[data-tutorial-id="dice-roll-button"]').click({ timeout: 15000 }));
        await test.step('目标确认防御骰', async () => defender.locator('[data-tutorial-id="dice-confirm-button"]').click({ timeout: 15000 }));
        await test.step('目标结束防御', async () => defender.locator('[data-tutorial-id="advance-phase-button"]').click({ timeout: 15000 }));
        // 防御后的伤害响应由当前玩家逐一处理，完成响应后才会结算败北。
        await expect.poll(async () => {
            const live = await current();
            return Boolean(live.sys.responseWindow?.current) || live.core.teamHealth.B === 0;
        }).toBe(true);
        for (let i = 0; i < 8; i++) {
            const window = (await current()).sys.responseWindow?.current;
            if (!window) break;
            const responderId = String(window.responderQueue[window.currentResponderIndex]);
            const pass = pages[Number(responderId)].getByTestId('dicethrone-response-pass-button');
            await expect(pass).toBeVisible();
            await pass.click();
            await expect.poll(async () => {
                const next = (await current()).sys.responseWindow?.current;
                return !next || String(next.responderQueue[next.currentResponderIndex]) !== responderId;
            }).toBe(true);
        }
        await expect.poll(async () => {
            const live = (await current()).core;
            return { health: live.teamHealth.B, owner: live.players['0'].tokens.mjolnir, holder: live.players['1'].tokens.mjolnir ?? 0 };
        }).toEqual({ health: 0, owner: 1, holder: 0 });
        expect((await current()).core.players['0'].tokens.electrokinesis).toBe(target === '1' ? 1 : 2);
        await waitForDamageNumbersToSettle(match.hostPage);
        await shot(match.hostPage, info, '02-队伍败北后神锤回到索尔');
        await finalizeThorEvidenceSourceIdentity(match.hostPage);
    } finally { await cleanupDTMatch(match); }
});
