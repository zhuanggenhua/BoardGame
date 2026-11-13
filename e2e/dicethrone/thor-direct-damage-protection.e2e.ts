import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, dragDiceThroneHandCardToPlay, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { finalizeThorEvidenceSourceIdentity, shot, waitForDamageNumbersToSettle } from '../helpers/dicethroneThorEvidence';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import { getDieFaceByDefinition } from '../../src/games/dicethrone/domain/rules';
import { FAN_THE_HAMMER_2 } from '../../src/games/dicethrone/heroes/gunslinger/abilities';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

test('枪手实际发动枪托击打时索尔可用无懈可击防止独立伤害', async ({ browser }, info) => {
    test.setTimeout(180000);
    await clearEvidenceScreenshotsForTest(info);
    const match = await setupOnlineMatch(browser, info.project.use.baseURL as string ?? getGameServerBaseURL(), { skipImageGate: true, characterSelectionTimeout: 120000 });
    if (!match) throw new Error('未能建立双人房间');
    try {
        await selectCharacter(match.hostPage, 'thor');
        await selectCharacter(match.guestPage, 'gunslinger');
        await readyAndStartGame(match.hostPage, match.guestPage);
        await Promise.all([match.hostPage, match.guestPage].map(async page => {
            await page.setViewportSize({ width: 1920, height: 1080 });
            await waitForGameBoard(page);
            await closeDebugPanelIfOpen(page);
        }));
        // 预置合法升级、攻击骰和索尔资源；玩家后续实际发动技能与响应。
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core as DiceThroneCore;
        const thor = core.players['0'];
        const cardZone = [thor.hand, thor.deck, thor.discard].find(zone => zone.some(card => card.id === 'card-thor-impenetrable'));
        expect(cardZone).toBeTruthy();
        const card = cardZone!.splice(cardZone!.findIndex(item => item.id === 'card-thor-impenetrable'), 1)[0];
        thor.deck.push(...thor.hand); thor.hand = [card]; thor.resources.cp = 5; thor.tokens.electrokinesis = 2;
        const gunslinger = core.players['1'];
        gunslinger.deck.push(...gunslinger.hand); gunslinger.hand = [];
        gunslinger.abilities = gunslinger.abilities.map(ability => ability.id === FAN_THE_HAMMER_2.id ? FAN_THE_HAMMER_2 : ability);
        gunslinger.abilityLevels['fan-the-hammer'] = 2;
        const dice = [4, 4, 6, 1, 1].map((value, id) => {
            const symbol = getDieFaceByDefinition('gunslinger-dice', value)!;
            return { id, value, symbol, symbols: [symbol], isKept: false, definitionId: 'gunslinger-dice', ownerId: '1' };
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
        const skill = match.guestPage.locator('[data-ability-slot="calm"][data-can-click="true"]');
        await expect(skill).toBeVisible();
        await skill.click();
        const variant = match.guestPage.getByRole('button', { name: /枪托击打/ });
        if (await variant.isVisible().catch(() => false)) await variant.click();
        await expect.poll(async () => (await current()).core.pendingAttack?.sourceAbilityId).toBe('pistol-whip');
        await Promise.all([match.hostPage, match.guestPage].map(page => continueAttackShowcaseIfVisible(page)));
        await match.guestPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        const state = await current();
        if (state.sys.interaction.current?.kind === 'simple-choice') {
            const option = match.guestPage.locator('[data-option-id="option-1"]');
            await expect(option).toBeVisible();
            await option.click();
        }
        await expect.poll(async () => {
            const damage = (await current()).core.pendingDamage;
            return { target: damage?.targetPlayerId, scope: damage?.damageScope, amount: damage?.currentDamage };
        }).toEqual({ target: '0', scope: 'direct', amount: 1 });
        await continueAttackShowcaseIfVisible(match.hostPage);
        await shot(match.hostPage, info, '01-枪托独立伤害产生正式响应');
        await dragDiceThroneHandCardToPlay(match.hostPage, 'card-thor-impenetrable');
        await expect.poll(async () => {
            const live = await current();
            return { damage: live.core.pendingDamage?.currentDamage, electro: live.core.players['0'].tokens.electrokinesis ?? 0 };
        }).toEqual({ damage: 0, electro: 0 });
        await shot(match.hostPage, info, '02-无懈可击防止独立伤害');
        const pass = match.hostPage.getByTestId('dicethrone-response-pass-button');
        if (await pass.isVisible()) await pass.click();
        await expect.poll(async () => (await current()).core.pendingDamage ?? null).toBeNull();
        await expect.poll(async () => (await current()).core.players['0'].resources.hp).toBe(50);
        await waitForDamageNumbersToSettle(match.hostPage);
        await shot(match.hostPage, info, '03-独立伤害结算后索尔生命保持');
        await finalizeThorEvidenceSourceIdentity(match.hostPage);
    } finally { await cleanupDTMatch(match); }
});
