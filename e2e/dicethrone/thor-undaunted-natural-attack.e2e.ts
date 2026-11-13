import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, dragDiceThroneHandCardToPlay, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { finalizeThorEvidenceSourceIdentity, shot, waitForDamageNumbersToSettle } from '../helpers/dicethroneThorEvidence';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import { getDieFaceByDefinition } from '../../src/games/dicethrone/domain/rules';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

for (const input of [
    { cardId: 'card-thor-undaunted', label: '不屈的意志', electro: 0 },
    { cardId: 'card-thor-impenetrable', label: '无懈可击', electro: 2 },
]) test(`索尔在线由实际攻击产生致命响应后打出${input.label}`, async ({ browser }, info) => {
    test.setTimeout(240000);
    await clearEvidenceScreenshotsForTest(info);
    const match = await setupOnlineMatch(browser, info.project.use.baseURL as string ?? getGameServerBaseURL(), { skipImageGate: true, characterSelectionTimeout: 120000 });
    if (!match) throw new Error('未能建立双人房间');
    try {
        await selectCharacter(match.hostPage, 'thor');
        await selectCharacter(match.guestPage, 'monk');
        await readyAndStartGame(match.hostPage, match.guestPage);
        await Promise.all([match.hostPage, match.guestPage].map(async page => {
            await page.setViewportSize({ width: 1920, height: 1080 });
            await waitForGameBoard(page);
            await closeDebugPanelIfOpen(page);
        }));
        // 开局后预置合法骰面与手牌；攻击和待伤害响应均由玩家操作自然生成。
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core as DiceThroneCore;
        const thor = core.players['0'];
        const cardZone = [thor.hand, thor.deck, thor.discard].find(zone => zone.some(card => card.id === input.cardId));
        expect(cardZone).toBeTruthy();
        const card = cardZone!.splice(cardZone!.findIndex(item => item.id === input.cardId), 1)[0];
        thor.deck.push(...thor.hand);
        thor.hand = [card];
        thor.resources.hp = 5;
        thor.resources.cp = 5;
        thor.tokens.electrokinesis = input.electro;
        core.players['1'].deck.push(...core.players['1'].hand);
        core.players['1'].hand = [];
        const dice = [6, 6, 6, 6, 1].map((value, id) => {
            const symbol = getDieFaceByDefinition('monk-dice', value)!;
            return { id, value, symbol, symbols: [symbol], isKept: false, definitionId: 'monk-dice', ownerId: '1' };
        });
        Object.assign(core, { activePlayerId: '1', phase: 'offensiveRoll', turnPhase: 'offensiveRoll', rollCount: 1, rollConfirmed: true, rollDiceCount: 5, dice, pendingAttack: null, pendingDamage: undefined });
        core.currentRollContext = createMainRollContext(core, { phase: 'offensiveRoll', ownerPlayerId: '1', dice });
        const sys = root.sys;
        sys.phase = 'offensiveRoll';
        sys.turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder : Object.keys(core.players);
        sys.currentPlayerIndex = sys.turnOrder.findIndex((id: unknown) => String(id) === '1');
        sys.interaction = { ...sys.interaction, current: undefined, queue: [] };
        sys.responseWindow = { ...sys.responseWindow, current: undefined };
        sys.flowHalted = false;
        await injectMatchState(match.matchId, stored, match.hostPage);
        const current = async () => { const value = await getMatchState(match.matchId, match.hostPage) as any; return value.G ?? value; };
        await expect.poll(async () => ({ attack: (await current()).core.pendingAttack ?? null, damage: (await current()).core.pendingDamage ?? null })).toEqual({ attack: null, damage: null });
        await expect(match.guestPage.locator('[data-ability-slot="lightning"][data-resolved-ability-id="lotus-palm"][data-can-click="true"]')).toBeVisible();
        await match.guestPage.locator('[data-ability-slot="lightning"][data-resolved-ability-id="lotus-palm"]').click();
        await expect.poll(async () => (await current()).core.pendingAttack?.sourceAbilityId).toBe('lotus-palm');
        await Promise.all([match.hostPage, match.guestPage].map(page => continueAttackShowcaseIfVisible(page)));
        await match.guestPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        await expect.poll(async () => {
            const damage = (await current()).core.pendingDamage;
            return { target: damage?.targetPlayerId, amount: damage?.currentDamage, source: damage?.sourceAbilityId };
        }).toEqual({ target: '0', amount: 5, source: 'lotus-palm' });
        await continueAttackShowcaseIfVisible(match.hostPage);
        await shot(match.hostPage, info, '01-实际攻击生成致命伤害响应');
        await dragDiceThroneHandCardToPlay(match.hostPage, input.cardId);
        let expectedHp = 5;
        if (input.cardId === 'card-thor-undaunted') {
            await expect.poll(async () => (await current()).core.pendingBonusDiceSettlement?.dice?.[0]?.value).toBeGreaterThanOrEqual(1);
            const roll = (await current()).core.pendingBonusDiceSettlement.dice[0].value as number;
            expect(roll).toBeLessThanOrEqual(6);
            expectedHp = roll === 4 || roll === 5 ? 1 : 0;
            await shot(match.hostPage, info, '02-不屈意志使用原效果骰盘');
            await match.hostPage.locator('[data-tutorial-id="dice-confirm-button"]').click();
        } else {
            await expect.poll(async () => {
                const state = await current();
                return { damage: state.core.pendingDamage?.currentDamage, electro: state.core.players['0'].tokens.electrokinesis ?? 0 };
            }).toEqual({ damage: 0, electro: 0 });
            await shot(match.hostPage, info, '02-无懈可击支付驭电并防止全部伤害');
        }
        const pass = match.hostPage.getByTestId('dicethrone-response-pass-button');
        if (await pass.isVisible()) await pass.click();
        await expect.poll(async () => (await current()).core.pendingDamage ?? null).toBeNull();
        await expect.poll(async () => (await current()).core.players['0'].resources.hp).toBe(expectedHp);
        await expect.poll(async () => {
            const player = (await current()).core.players['0'];
            return { cp: player.resources.cp, discarded: player.discard.some((card: { id: string }) => card.id === input.cardId) };
        }).toEqual({ cp: 3, discarded: true });
        await continueAttackShowcaseIfVisible(match.hostPage);
        await waitForDamageNumbersToSettle(match.hostPage);
        await shot(match.hostPage, info, input.cardId === 'card-thor-undaunted'
            ? '03-实际骰值对应的致命伤害结算'
            : '03-无懈可击防护后生命保持');
        await finalizeThorEvidenceSourceIdentity(match.hostPage);
    } finally {
        await cleanupDTMatch(match);
    }
});
