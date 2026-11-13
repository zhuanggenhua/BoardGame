import { test, expect } from '../framework';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, dragDiceThroneHandCardToPlay, readDiceThroneHarnessState, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

test('索尔在线当之无愧由本人选定点数及骰子，对手不能代选', async ({ browser }, info) => {
    test.setTimeout(180000);
    const match = await setupOnlineMatch(browser, info.project.use.baseURL as string ?? getGameServerBaseURL(), { skipImageGate: true, characterSelectionTimeout: 120000 });
    expect(match, '必须建立真实双人房间').toBeTruthy();
    if (!match) throw new Error('房间创建失败');
    try {
        await selectCharacter(match.hostPage, 'thor');
        await selectCharacter(match.guestPage, 'monk');
        await readyAndStartGame(match.hostPage, match.guestPage);
        await Promise.all([waitForGameBoard(match.hostPage), waitForGameBoard(match.guestPage)]);
        await Promise.all([closeDebugPanelIfOpen(match.hostPage), closeDebugPanelIfOpen(match.guestPage)]);

        // 真实在线房间的合法代表态：把索尔原牌放入手牌，准备已投出的己方骰子。
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core as DiceThroneCore;
        const player = core.players['0'];
        const zones = [player.hand, player.deck, player.discard];
        const source = zones.find(zone => zone.some(card => card.id === 'card-thor-worthy'));
        expect(source, '索尔正式牌库应包含当之无愧').toBeTruthy();
        const card = source!.splice(source!.findIndex(item => item.id === 'card-thor-worthy'), 1)[0];
        player.hand.push(card);
        player.resources.cp = 5;
        const dice = [1, 1, 1, 1, 1].map((value, id) => ({ id, value, symbol: 'hammer', symbols: ['hammer'], isKept: false, definitionId: 'thor-dice', ownerId: '0' }));
        Object.assign(core, { activePlayerId: '0', phase: 'offensiveRoll', turnPhase: 'offensiveRoll', rollCount: 1, rollConfirmed: false, rollDiceCount: 5, dice, pendingAttack: null, pendingDamage: undefined });
        core.currentRollContext = createMainRollContext(core, { phase: 'offensiveRoll', ownerPlayerId: '0', dice });
        const sys = root.sys;
        sys.phase = 'offensiveRoll';
        sys.turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder : Object.keys(core.players);
        sys.currentPlayerIndex = sys.turnOrder.findIndex((id: unknown) => String(id) === '0');
        sys.interaction = { ...sys.interaction, current: undefined, queue: [] };
        sys.responseWindow = { ...sys.responseWindow, current: undefined };
        await injectMatchState(match.matchId, stored, match.hostPage);
        await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id="card-thor-worthy"]')).toBeVisible();

        await dragDiceThroneHandCardToPlay(match.hostPage, 'card-thor-worthy');
        await expect(match.hostPage.locator('[data-option-id="5"]')).toBeVisible();
        await expect.poll(async () => {
            const state = await readDiceThroneHarnessState<any>(match.guestPage);
            return (state?.G ?? state)?.core?.players?.['0']?.resources?.cp;
        }).toBe(4);
        await expect(match.guestPage.getByTestId('dt-choice-options')).toHaveCount(0);
        await match.hostPage.screenshot({ path: 'temp/thor-worthy-online-host.png' });
        const guestSpotlight = match.guestPage.getByTestId('card-spotlight-overlay');
        if (await guestSpotlight.isVisible().catch(() => false)) {
            await match.guestPage.mouse.click(15, 15);
            await expect(guestSpotlight).toHaveCount(0);
        }
        await match.guestPage.screenshot({ path: 'temp/thor-worthy-online-guest.png' });
        await match.hostPage.locator('[data-option-id="5"]').click();
        await match.hostPage.getByTestId('die-button-0').click();
        await expect.poll(async () => {
            const state = await getMatchState(match.matchId, match.hostPage) as any;
            return (state.G ?? state).core.currentRollContext?.dice.map((die: { value: number }) => die.value);
        }).toEqual([5, 1, 1, 1, 1]);
    } finally {
        await cleanupDTMatch(match);
    }
});
