import { test, expect } from '../framework';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, readDiceThroneHarnessState, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

test('索尔在线连锁闪电选骰时双方视角与结算', async ({ browser }, info) => {
    test.setTimeout(180000);
    const match = await setupOnlineMatch(browser, info.project.use.baseURL as string ?? getGameServerBaseURL(), { skipImageGate: true, characterSelectionTimeout: 120000 });
    if (!match) throw new Error('房间创建失败');
    try {
        await selectCharacter(match.hostPage, 'thor');
        await selectCharacter(match.guestPage, 'monk');
        await readyAndStartGame(match.hostPage, match.guestPage);
        await Promise.all([waitForGameBoard(match.hostPage), waitForGameBoard(match.guestPage)]);
        await Promise.all([closeDebugPanelIfOpen(match.hostPage), closeDebugPanelIfOpen(match.guestPage)]);
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core as DiceThroneCore;
        const dice = [1, 1, 1, 6, 6].map((value, id) => ({ id, value, symbol: value === 6 ? 'thor_thunder' : 'thor_hammer', symbols: [value === 6 ? 'thor_thunder' : 'thor_hammer'], isKept: false, definitionId: 'thor-dice', ownerId: '0' }));
        Object.assign(core, { activePlayerId: '0', phase: 'offensiveRoll', turnPhase: 'offensiveRoll', rollCount: 1, rollConfirmed: true, rollDiceCount: 5, dice, pendingAttack: null, pendingDamage: undefined });
        core.currentRollContext = createMainRollContext(core, { phase: 'offensiveRoll', ownerPlayerId: '0', dice });
        root.sys.turnOrder = Array.isArray(root.sys.turnOrder) ? root.sys.turnOrder : Object.keys(core.players);
        Object.assign(root.sys, { phase: 'offensiveRoll', currentPlayerIndex: root.sys.turnOrder.findIndex((id: unknown) => String(id) === '0') });
        root.sys.interaction = { ...root.sys.interaction, current: undefined, queue: [] };
        root.sys.responseWindow = { ...root.sys.responseWindow, current: undefined };
        await injectMatchState(match.matchId, stored, match.hostPage);
        await match.hostPage.locator('[data-ability-slot="lotus"][data-can-click="true"]').first().click();
        await match.hostPage.locator('[data-tutorial-id="advance-phase-button"]').click();
        await expect.poll(async () => ((await readDiceThroneHarnessState<any>(match.hostPage))?.G ?? (await readDiceThroneHarnessState<any>(match.hostPage)))?.core?.pendingBonusDiceSettlement?.dice?.length).toBe(3);
        await match.hostPage.locator('[data-tutorial-id="dice-confirm-button"]').click();
        await expect(match.hostPage.getByText('选择两颗效果骰', { exact: true })).toBeVisible();
        await continueAttackShowcaseIfVisible(match.guestPage);
        await expect.poll(async () => {
            const state = await getMatchState(match.matchId, match.hostPage) as any;
            return (state.G ?? state)?.sys?.interaction?.current?.data?.title;
        }).toBe('choices.thor.chainTitle');
        await expect(match.guestPage.locator('[data-option-id]')).toHaveCount(0);
        await expect(match.guestPage.getByText('正在思考中', { exact: false })).toBeVisible();
        await match.hostPage.screenshot({ path: 'temp/thor-chain-online-host.png' });
        await match.guestPage.screenshot({ path: 'temp/thor-chain-online-guest.png' });
        const beforeChoice = await getMatchState(match.matchId, match.hostPage) as any;
        const prompt = (beforeChoice.G ?? beforeChoice).sys.interaction.current;
        expect(prompt.playerId).toBe('0');
        const selectedOption = prompt.data.options.find((option: any) => {
            const indices = option.value?.dicePreview?.dice?.map((die: { index: number }) => die.index).sort();
            return JSON.stringify(indices) === '[0,1]';
        });
        expect(selectedOption).toBeDefined();
        const expectedDamage = selectedOption.value.value;
        await match.hostPage.getByTestId('die-button-0').click();
        await match.hostPage.getByTestId('die-button-1').click();
        await match.hostPage.getByTestId('dice-interaction-confirm-button').click();
        await expect.poll(async () => {
            const state = await getMatchState(match.matchId, match.hostPage) as any;
            const result = state.G ?? state;
            return { phase: result.sys.phase, bonus: result.core.pendingAttack?.bonusDamage, opponentHP: result.core.players['1'].resources.hp };
        }).toEqual({ phase: 'defensiveRoll', bonus: expectedDamage, opponentHP: 48 });
    } finally {
        await cleanupDTMatch(match);
    }
});
