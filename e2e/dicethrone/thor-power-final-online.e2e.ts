import { test, expect } from '../framework';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, dragDiceThroneHandCardToPlay, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import { getDieFaceByDefinition } from '../../src/games/dicethrone/domain/rules';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

// 预期分别来自玩家板及升级卡：飞锤的独立伤害和主攻击必须分开结算。
for (const input of [
    { name: '雷神之锤基础最高档', upgrade: '', ability: '', dice: [1, 1, 1, 1, 1], slot: 'fist', source: 'thor-hammer-5', beforeHp: 49, finalHp: 42, electro: 0 },
    { name: '雷神之锤II最高档', upgrade: 'upgrade-thor-hammer-2', ability: 'thor-hammer', dice: [1, 1, 1, 1, 1], slot: 'fist', source: 'thor-hammer-2-5', beforeHp: 49, finalHp: 42, electro: 1 },
    { name: '雷神之锤III最高档', upgrade: 'upgrade-thor-hammer-3', ability: 'thor-hammer', dice: [1, 1, 1, 1, 1], slot: 'fist', source: 'thor-hammer-3-5', beforeHp: 49, finalHp: 41, electro: 1 },
    { name: '雷轰电掣基础', upgrade: '', ability: '', dice: [1, 2, 3, 4, 4], slot: 'combo', source: 'thor-thunder-strike', beforeHp: 50, finalHp: 43, electro: 1 },
    { name: '雷轰电掣II', upgrade: 'upgrade-thor-thunder-strike-2', ability: 'thor-thunder-strike', dice: [1, 2, 3, 4, 4], slot: 'combo', source: 'thor-thunder-strike', beforeHp: 49, finalHp: 40, electro: 1 },
    { name: '雷霆之力基础', upgrade: '', ability: '', dice: [1, 2, 3, 4, 5], slot: 'calm', source: 'thor-power-of-thunder', beforeHp: 49, finalHp: 39, electro: 2 },
    { name: '雷霆之力II', upgrade: 'upgrade-thor-power-of-thunder-2', ability: 'thor-power-of-thunder', dice: [1, 2, 3, 4, 5], slot: 'calm', source: 'thor-power-of-thunder-2', beforeHp: 49, finalHp: 37, electro: 2 },
    { name: '电闪雷鸣', upgrade: 'upgrade-thor-mighty-summon-2', ability: 'thor-mighty-summon', dice: [1, 1, 6, 6, 4], slot: 'chi', source: 'thor-flash-and-thunder', beforeHp: 50, finalHp: 44, electro: 2 },
]) test(`索尔在线${input.name}经对手防御完成伤害`, async ({ browser }, info) => {
    test.setTimeout(240000);
    const match = await setupOnlineMatch(browser, info.project.use.baseURL as string ?? getGameServerBaseURL(), { skipImageGate: true, characterSelectionTimeout: 120000 });
    if (!match) throw new Error('未能建立双人房间');
    try {
        await selectCharacter(match.hostPage, 'thor');
        await selectCharacter(match.guestPage, 'monk');
        await readyAndStartGame(match.hostPage, match.guestPage);
        await Promise.all([match.hostPage, match.guestPage].map(async page => {
            await waitForGameBoard(page);
            await closeDebugPanelIfOpen(page);
        }));
        const current = async () => { const value = await getMatchState(match.matchId, match.hostPage) as any; return value.G ?? value; };
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core as DiceThroneCore;
        const thor = core.players['0'];
        const zone = input.upgrade && [thor.hand, thor.deck, thor.discard].find(cards => cards.some(card => card.id === input.upgrade));
        if (input.upgrade) expect(zone).toBeTruthy();
        const upgrade = zone ? zone.splice(zone.findIndex(card => card.id === input.upgrade), 1)[0] : undefined;
        thor.deck.push(...thor.hand);
        thor.hand = upgrade ? [upgrade] : [];
        thor.resources.cp = 5;
        core.players['1'].deck.push(...core.players['1'].hand);
        core.players['1'].hand = [];
        Object.assign(core, { activePlayerId: '0', phase: 'main1', turnPhase: 'main1' });
        root.sys.turnOrder = Array.isArray(root.sys.turnOrder) ? root.sys.turnOrder : Object.keys(core.players);
        Object.assign(root.sys, { phase: 'main1', currentPlayerIndex: root.sys.turnOrder.findIndex((player: unknown) => String(player) === '0') });
        await injectMatchState(match.matchId, stored, match.hostPage);
        if (input.upgrade) {
            await dragDiceThroneHandCardToPlay(match.hostPage, input.upgrade);
            await expect.poll(async () => {
                const player = (await current()).core.players['0'];
                return { level: player.abilityLevels[input.ability], cp: player.resources.cp };
            }).toEqual({ level: input.upgrade === 'upgrade-thor-hammer-3' ? 3 : 2, cp: input.upgrade === 'upgrade-thor-hammer-2' ? 5 : 3 });
        }

        // 保留实际升级结果，仅预置合法已确认骰面；此后的攻击和防御均通过页面操作。
        const afterUpgrade = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const prepared = afterUpgrade.G ?? afterUpgrade;
        const attackCore = prepared.core as DiceThroneCore;
        const dice = input.dice.map((value, dieId) => {
            const symbol = getDieFaceByDefinition('thor-dice', value)!;
            return { id: dieId, value, symbol, symbols: [symbol], isKept: false, definitionId: 'thor-dice', ownerId: '0' };
        });
        Object.assign(attackCore, { activePlayerId: '0', phase: 'offensiveRoll', turnPhase: 'offensiveRoll', rollCount: 1, rollConfirmed: true, rollDiceCount: 5, dice, pendingAttack: null, pendingDamage: undefined });
        attackCore.currentRollContext = createMainRollContext(attackCore, { phase: 'offensiveRoll', ownerPlayerId: '0', dice });
        const sys = prepared.sys;
        sys.turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder : Object.keys(attackCore.players);
        Object.assign(sys, { phase: 'offensiveRoll', currentPlayerIndex: sys.turnOrder.findIndex((player: unknown) => String(player) === '0'), flowHalted: false });
        sys.interaction = { ...sys.interaction, current: undefined, queue: [] };
        sys.responseWindow = { ...sys.responseWindow, current: undefined };
        await injectMatchState(match.matchId, afterUpgrade, match.hostPage);
        await match.hostPage.locator(`[data-ability-slot="${input.slot}"][data-can-click="true"]`).first().click();
        await Promise.all([match.hostPage, match.guestPage].map(page => continueAttackShowcaseIfVisible(page)));
        await match.hostPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        await expect.poll(async () => {
            const state = await current();
            return { phase: state.sys.phase, hp: state.core.players['1'].resources.hp, source: state.core.pendingAttack?.sourceAbilityId };
        }).toEqual({ phase: 'defensiveRoll', hp: input.beforeHp, source: input.source });
        await continueAttackShowcaseIfVisible(match.guestPage);
        const spotlight = match.guestPage.getByTestId('spotlight-container-root');
        if (await spotlight.isVisible().catch(() => false)) await spotlight.click({ position: { x: 20, y: 20 }, timeout: 10000 });
        await match.guestPage.locator('[data-tutorial-id="dice-roll-button"]').click({ timeout: 15000 });
        await match.guestPage.locator('[data-tutorial-id="dice-confirm-button"]').click({ timeout: 15000 });
        await match.guestPage.locator('[data-tutorial-id="advance-phase-button"]').click({ timeout: 15000 });
        const pass = match.guestPage.getByTestId('dicethrone-response-pass-button');
        if (await pass.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) await pass.click();
        await expect.poll(async () => {
            const state = await current();
            return { phase: state.sys.phase, hp: state.core.players['1'].resources.hp, electro: state.core.players['0'].tokens.electrokinesis ?? 0, attack: state.core.pendingAttack ?? null };
        }).toEqual({ phase: 'main2', hp: input.finalHp, electro: input.electro, attack: null });
    } finally {
        await cleanupDTMatch(match);
    }
});
