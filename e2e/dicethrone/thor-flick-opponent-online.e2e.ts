import { test, expect } from '../framework';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, dragDiceThroneHandCardToPlay, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { shot } from '../helpers/dicethroneThorEvidence';
import { createThorBehaviorEvidence } from '../helpers/thorBehaviorEvidence';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import { waitForDiceThroneVisualIdle } from './bonus-dice-flow';

test('索尔在线用弹一手修改对手锁定骰子', async ({ browser }, info) => {
    test.setTimeout(180000);
    const match = await setupOnlineMatch(browser, info.project.use.baseURL as string ?? getGameServerBaseURL(), { skipImageGate: true, characterSelectionTimeout: 120000 });
    expect(match).toBeTruthy();
    if (!match) throw new Error('房间创建失败');
    const evidence = await createThorBehaviorEvidence(match.hostPage, info, 'thor-common-adjust', async () => {
        const state = await getMatchState(match.matchId, match.hostPage) as any;
        const current = state.G ?? state;
        return { dice: current.core.dice.map((die: { value: number }) => die.value), kept: current.core.dice[0]?.isKept ?? false };
    }, 'e2e/dicethrone/thor-common-dice-required-ui-states.json', '真实双人开局后预置对手合法锁骰、索尔手牌及资源；响应和改骰由玩家操作产生。');
    try {
        await selectCharacter(match.hostPage, 'thor');
        await selectCharacter(match.guestPage, 'monk');
        await readyAndStartGame(match.hostPage, match.guestPage);
        await Promise.all([waitForGameBoard(match.hostPage), waitForGameBoard(match.guestPage)]);
        await Promise.all([closeDebugPanelIfOpen(match.hostPage), closeDebugPanelIfOpen(match.guestPage)]);
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core;
        const player = core.players['0'];
        const zone = [player.hand, player.deck, player.discard].find((cards: any[]) => cards.some(card => card.id === 'card-flick'));
        expect(zone, '索尔牌库必须有弹一手').toBeTruthy();
        player.hand.push(zone.splice(zone.findIndex((card: any) => card.id === 'card-flick'), 1)[0]);
        player.resources.cp = 5;
        const dice = [3, 2, 4, 5, 1].map((value, id) => {
            const symbol = value <= 2 ? 'fist' : value === 3 ? 'palm' : 'taiji';
            return { id, value, symbol, symbols: [symbol], isKept: id === 0, definitionId: 'monk-dice', ownerId: '1' };
        });
        Object.assign(core, { activePlayerId: '1', phase: 'offensiveRoll', turnPhase: 'offensiveRoll', rollCount: 1, rollConfirmed: false, rollDiceCount: 5, dice, pendingAttack: null, pendingDamage: undefined });
        core.currentRollContext = createMainRollContext(core, { phase: 'offensiveRoll', ownerPlayerId: '1', dice });
        root.sys.phase = 'offensiveRoll';
        root.sys.turnOrder = Array.isArray(root.sys.turnOrder) ? root.sys.turnOrder : Object.keys(core.players);
        root.sys.currentPlayerIndex = root.sys.turnOrder.findIndex((id: unknown) => String(id) === '1');
        root.sys.interaction = { ...root.sys.interaction, current: undefined, queue: [] };
        root.sys.responseWindow = { ...root.sys.responseWindow, current: undefined };
        await injectMatchState(match.matchId, stored, match.hostPage);
        await match.guestPage.locator('[data-tutorial-id="dice-confirm-button"]').click();
        await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id="card-flick"]')).toHaveAttribute('data-can-drag', 'true');
        await shot(match.hostPage, info, '01-对手确认骰后索尔手牌可响应');
        await evidence.step('play-common-adjust', '从原手牌打出弹一手', async () => {
            await dragDiceThroneHandCardToPlay(match.hostPage, 'card-flick');
            await expect(match.hostPage.getByTestId('dice-interaction-hint')).toContainText('选择要调整的骰子');
        }, after => [{ name: '原对手锁骰仍为三', actual: { value: (after.authoritative.dice as number[])[0], kept: after.authoritative.kept }, expected: { value: 3, kept: true } }]);
        await evidence.step('preview-common-adjust', '在原骰盘将对手锁骰预览增加一点', async () => {
            await match.hostPage.getByTestId('die-adjust-increment-0').click();
            await expect(match.hostPage.getByTestId('dice-interaction-confirm-button')).toBeEnabled();
        }, after => [{ name: '确认前对手权威骰值仍为三', actual: (after.authoritative.dice as number[])[0], expected: 3 }]);
        await waitForDiceThroneVisualIdle(match.hostPage);
        await evidence.capture('thor-common-adjust-preview', 'preview-common-adjust', '02-原骰盘将对手锁定骰调整一格待确认', 'interaction-mode');
        await evidence.step('confirm-common-adjust', '点击原确认按钮提交对手锁骰调整', async () => {
            await match.hostPage.getByTestId('dice-interaction-confirm-button').click();
            await expect.poll(async () => {
                const state = await getMatchState(match.matchId, match.hostPage) as any;
                const current = state.G ?? state;
                return { value: current.core.dice[0].value, kept: current.core.dice[0].isKept, cp: current.core.players['0'].resources.cp,
                    discarded: current.core.players['0'].discard.some((card: any) => card.id === 'card-flick'), interaction: current.sys.interaction.current ?? null };
            }).toEqual({ value: 4, kept: true, cp: 4, discarded: true, interaction: null });
            await expect(match.hostPage.getByTestId('die-button-0')).toHaveAttribute('data-display-value', '4');
        }, after => [{ name: '对手骰为四且仍锁定', actual: { value: (after.authoritative.dice as number[])[0], kept: after.authoritative.kept }, expected: { value: 4, kept: true } },
            { name: '玩家画面显示四点', actual: (after.visible.dice as Array<string | null>)[0], expected: '4' }]);
        await waitForDiceThroneVisualIdle(match.hostPage);
        await shot(match.hostPage, info, '03-对手锁定骰改面完成且原交互退出');
        await evidence.finish('索尔沿原骰盘将对手锁定骰从三调为四。');
    } finally {
        await cleanupDTMatch(match);
    }
});
