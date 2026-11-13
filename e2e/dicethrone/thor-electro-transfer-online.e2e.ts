import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, dragDiceThroneHandCardToPlay, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { finalizeThorEvidenceSourceIdentity, shot } from '../helpers/dicethroneThorEvidence';

test('非索尔玩家实际转移驭电后可在自己主要阶段用原入口抽牌', async ({ browser }, info) => {
    test.setTimeout(180000);
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
        // 预置双方合法驭电数量和手牌；状态转移由实际公共卡操作完成。
        const stored = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const root = stored.G ?? stored;
        const core = root.core;
        core.players['0'].tokens.electrokinesis = 1;
        core.players['1'].tokens.electrokinesis = 3;
        const monk = core.players['1'];
        const cardZone = [monk.hand, monk.deck, monk.discard].find((zone: Array<{id:string}>) => zone.some(card => card.id === 'card-transfer-status'));
        expect(cardZone).toBeTruthy();
        const card = cardZone.splice(cardZone.findIndex((item: {id:string}) => item.id === 'card-transfer-status'), 1)[0];
        monk.deck.push(...monk.hand);
        monk.hand = [card];
        monk.resources.cp = 5;
        core.activePlayerId = '1';
        core.phase = core.turnPhase = 'main1';
        core.passiveActionUsedThisTurn = {};
        root.sys.phase = 'main1';
        root.sys.turnOrder = Array.isArray(root.sys.turnOrder) ? root.sys.turnOrder : Object.keys(core.players);
        root.sys.currentPlayerIndex = root.sys.turnOrder.findIndex((id: unknown) => String(id) === '1');
        root.sys.interaction = { ...root.sys.interaction, current: undefined, queue: [] };
        root.sys.responseWindow = { ...root.sys.responseWindow, current: undefined };
        root.sys.flowHalted = false;
        await injectMatchState(match.matchId, stored, match.hostPage);
        const current = async () => { const value = await getMatchState(match.matchId, match.hostPage) as any; return value.G ?? value; };
        await dragDiceThroneHandCardToPlay(match.guestPage, 'card-transfer-status');
        const modal = match.guestPage.locator('#modal-root');
        await expect(modal.getByTestId('dt-status-effect-0-electrokinesis')).toBeVisible();
        await shot(match.guestPage, info, '00a-原状态转移入口选择索尔驭电');
        await modal.getByTestId('dt-status-effect-0-electrokinesis').click();
        await expect(modal.getByTestId('dt-transfer-target-1')).toBeVisible();
        await shot(match.guestPage, info, '00b-原状态转移入口选择僧侣为目标');
        await modal.getByTestId('dt-transfer-target-1').click();
        await modal.getByRole('button', { name: '确认', exact: true }).last().click();
        await expect.poll(async () => {
            const players = (await current()).core.players;
            return { thor: players['0'].tokens.electrokinesis ?? 0, monk: players['1'].tokens.electrokinesis ?? 0 };
        }).toEqual({ thor: 0, monk: 4 });
        const spotlight = match.hostPage.getByTestId('card-spotlight-overlay');
        if (await spotlight.isVisible().catch(() => false)) {
            await match.hostPage.mouse.click(15, 15);
            await expect(spotlight).toHaveCount(0);
        }
        for (let i = 0; i < 4; i++) {
            const window = (await current()).sys.responseWindow?.current;
            if (!window) break;
            const playerId = String(window.responderQueue[window.currentResponderIndex]);
            const responderPage = playerId === '0' ? match.hostPage : match.guestPage;
            const pass = responderPage.getByTestId('dicethrone-response-pass-button');
            await expect(pass).toBeVisible();
            await pass.click();
            await expect.poll(async () => {
                const next = (await current()).sys.responseWindow?.current;
                return !next || String(next.responderQueue[next.currentResponderIndex]) !== playerId;
            }).toBe(true);
        }
        expect((await current()).sys.responseWindow?.current).toBeFalsy();
        const action = match.guestPage.getByTestId('passive-action-electrokinesis-draw-0');
        await expect(action).toBeVisible();
        await expect(action).toBeEnabled();
        await shot(match.guestPage, info, '01-非索尔持有四驭电显示原主动入口');
        await action.click();
        await expect.poll(async () => {
            const player = (await current()).core.players['1'];
            return { electro: player.tokens.electrokinesis ?? 0, hand: player.hand.length };
        }).toEqual({ electro: 0, hand: 1 });
        await expect(action).toHaveCount(0);
        await shot(match.guestPage, info, '02-花四驭电抽牌后入口随状态消失');
        // 验证同回合再次获得四枚后的限制；保留真实消费产生的已使用记录。
        const reacquired = structuredClone(await getMatchState(match.matchId, match.hostPage)) as any;
        const next = reacquired.G ?? reacquired;
        expect(next.core.passiveActionUsedThisTurn?.['1']?.['electrokinesis-draw']).toBe(true);
        next.core.players['1'].tokens.electrokinesis = 4;
        await injectMatchState(match.matchId, reacquired, match.hostPage);
        await expect(action).toBeVisible();
        await expect(action).toBeDisabled();
        await shot(match.guestPage, info, '03-同回合重新持有四枚仍不可再次使用');
        await finalizeThorEvidenceSourceIdentity(match.guestPage);
    } finally {
        await cleanupDTMatch(match);
    }
});
