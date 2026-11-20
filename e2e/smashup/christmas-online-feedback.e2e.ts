import { test, expect } from '../framework';
import { completeFactionSelection } from '../helpers/smashup';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import type { MatchState } from '../../src/engine/types';
import type { SmashUpCore } from '../../src/games/smashup/domain/types';
import { cleanupTwoPlayerMatch, setupTwoPlayerMatch, waitForHandArea } from './smashup-helpers';

test('圣诞节将属于我们只给出牌者看牌，借打后在回合结束时归还', async ({ browser }, testInfo) => {
    test.setTimeout(150_000);
    const match = await setupTwoPlayerMatch(browser, testInfo.project.use.baseURL as string, { skipImageGate: true });
    expect(match).not.toBeNull();
    if (!match) throw new Error('双人房间未建立');
    const { hostPage, guestPage, matchId } = match;
    try {
        await completeFactionSelection(hostPage, guestPage, ['aliens', 'dinosaurs'], ['wizards', 'ninjas']);
        await Promise.all([waitForHandArea(hostPage), waitForHandArea(guestPage)]);
        const state = structuredClone(await getMatchState(matchId, hostPage)) as MatchState<SmashUpCore>;
        Object.assign(state.core, { currentPlayerIndex: 0, turnOrder: ['0', '1'], activePlayerId: '0', phase: 'playCards' });
        Object.assign(state.sys, { currentPlayerIndex: 0, turnOrder: ['0', '1'], phase: 'playCards' });
        state.core.players['0'].actionsPlayed = 0;
        state.core.players['0'].hand = [{ uid: 'christmas', defId: 'nightmare_before_christmas_christmas_will_be_ours', type: 'action', owner: '0' }];
        state.core.players['1'].hand = [
            { uid: 'borrowed', defId: 'wizard_mystic_studies', type: 'action', owner: '1' },
            { uid: 'guest-minion', defId: 'wizard_neophyte', type: 'minion', owner: '1' },
        ];
        await injectMatchState(matchId, state, hostPage);

        const christmas = hostPage.getByTestId('su-hand-area').locator('[data-card-uid="christmas"]').first();
        await expect(christmas).toBeVisible();
        await christmas.click();
        await christmas.click();
        const reveal = hostPage.getByTestId('reveal-overlay');
        await expect(reveal).toBeVisible();
        await expect(reveal.getByTestId('reveal-card')).toHaveCount(2);
        await expect(guestPage.getByTestId('reveal-overlay')).toHaveCount(0);
        await hostPage.getByTestId('reveal-dismiss-btn').click();
        const borrowed = hostPage.getByTestId('prompt-card-grid').locator('[data-card-def-id="wizard_mystic_studies"]');
        await expect(borrowed).toBeVisible();
        await borrowed.click();
        const guestCard = guestPage.getByTestId('su-hand-area').locator('[data-card-uid="borrowed"]').first();
        await expect(guestCard).toHaveCount(0);
        await expect.poll(async () => {
            const actual = await getMatchState(matchId, hostPage) as MatchState<SmashUpCore>;
            return actual.core.players['1'].discard.some(card => card.uid === 'borrowed');
        }).toBe(true);
        await hostPage.getByTestId('su-end-turn-action-button').click();
        await expect(guestCard).toBeVisible();
    } finally {
        await cleanupTwoPlayerMatch(match);
    }
});
