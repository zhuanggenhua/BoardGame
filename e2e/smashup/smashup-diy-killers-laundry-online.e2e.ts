import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { completeFactionSelection } from '../helpers/smashup';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { cleanupTwoPlayerMatch, setupTwoPlayerMatch, waitForHandArea } from './smashup-helpers';

for (const scenario of ['escape', 'decline-after-card', 'decline-immediately'] as const) {
test(`双人预置代表态：${scenario === 'escape' ? '对手选牌后逃离' : scenario === 'decline-after-card' ? '对手选牌后放弃逃离' : '对手直接放弃逃离后被摧毁'}`, async ({ browser }, testInfo) => {
  test.setTimeout(180000);
  const match = await setupTwoPlayerMatch(browser, testInfo.project.use.baseURL as string | undefined, { skipImageGate: true });
  expect(match, '双人房间必须建立').not.toBeNull();
  if (!match) throw new Error('双人房间未建立');
  const { hostPage, guestPage, matchId } = match;
  try {
    await completeFactionSelection(hostPage, guestPage, ['aliens', 'dinosaurs'], ['wizards', 'ninjas']);
    await Promise.all([waitForHandArea(hostPage), waitForHandArea(guestPage)]);
    const state = structuredClone(await getMatchState(matchId, hostPage)) as any;
    Object.assign(state.core, { currentPlayerIndex: 0, turnOrder: ['0', '1'], activePlayerId: '0', phase: 'playCards' });
    Object.assign(state.sys, { currentPlayerIndex: 0, turnOrder: ['0', '1'], phase: 'playCards' });
    Object.assign(state.core.players['0'], {
      factions: ['diy_killers', 'pirates'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
      hand: [
        { uid: 'laundry', defId: 'diy_killers_laundry_room', type: 'action', owner: '0' },
        { uid: 'jason', defId: 'diy_killers_jason', type: 'minion', owner: '0' },
      ], deck: [], discard: [],
    });
    Object.assign(state.core.players['1'], {
      factions: ['killer_plants', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
      hand: [{ uid: 'cost', defId: 'ninja_shinobi', type: 'minion', owner: '1' }], deck: [], discard: [],
    });
    state.core.bases = [
      { defId: 'base_the_factory', minions: [{ uid: 'host', defId: 'ninja_acolyte', owner: '1', controller: '1', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }], ongoingActions: [] },
      { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
      { defId: 'base_the_jungle', minions: [], ongoingActions: [] },
    ];
    state.sys.interaction = { current: null, queue: [], isBlocked: false };
    await injectMatchState(matchId, state, hostPage);
    await expect(hostPage.locator('[data-card-uid="laundry"]').first()).toBeVisible();
    await hostPage.locator('[data-card-uid="laundry"]').first().click();
    await hostPage.locator('[data-minion-uid="host"]').click();
    await expect.poll(async () => {
      const current = await getMatchState(matchId, hostPage) as any;
      return current.core.bases[0].minions[0]?.attachedActions?.some((action: { uid: string }) => action.uid === 'laundry');
    }).toBe(true);
    await hostPage.locator('[data-card-uid="jason"]').first().click();
    await hostPage.locator('[data-base-index="0"]').first().click();
    await expect.poll(async () => {
      const current = await getMatchState(matchId, hostPage) as any;
      return { player: current.sys.interaction?.current?.playerId, source: current.sys.interaction?.current?.data?.sourceId };
    }, { timeout: 15000 }).toEqual({ player: '1', source: 'diy_killers_laundry_room_escape' });
    const cost = guestPage.getByTestId('su-hand-area').locator('[data-card-uid="cost"]').first();
    await expect(cost).toBeVisible({ timeout: 15000 });
    await expect(guestPage.getByTestId('su-hand-prompt-skip-option')).toHaveText('不逃离');
    await guestPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '01-对手选择要弃的手牌'), type: 'jpeg' });
    if (scenario === 'decline-immediately') {
      await guestPage.getByTestId('su-hand-prompt-skip-option').click();
      await expect.poll(async () => {
        const current = await getMatchState(matchId, hostPage) as any;
        return { player: current.sys.interaction?.current?.playerId, source: current.sys.interaction?.current?.data?.sourceId };
      }, { timeout: 15000 }).toEqual({ player: '0', source: 'diy_killers_laundry_room_destroy' });
      await expect(hostPage.locator('[data-minion-uid="host"]')).toHaveAttribute('data-highlighted', 'true');
      await hostPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '02-控制者选择摧毁'), type: 'jpeg' });
      await hostPage.locator('[data-minion-uid="host"]').click();
      await expect.poll(async () => {
        const current = await getMatchState(matchId, hostPage) as any;
        return {
          hostPresent: current.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'host'),
          hostDiscarded: current.core.players['1'].discard.some((card: { uid: string }) => card.uid === 'host'),
          costStillInHand: current.core.players['1'].hand.some((card: { uid: string }) => card.uid === 'cost'),
          interaction: current.sys.interaction?.current?.data?.sourceId ?? null,
        };
      }, { timeout: 15000 }).toEqual({ hostPresent: false, hostDiscarded: true, costStillInHand: true, interaction: null });
      await hostPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '03-摧毁后的牌桌'), type: 'jpeg' });
      return;
    }
    await cost.click();
    await expect.poll(async () => {
      const current = await getMatchState(matchId, hostPage) as any;
      return {
        source: current.sys.interaction?.current?.data?.sourceId,
        cardStillInHand: current.core.players['1'].hand.some((card: { uid: string }) => card.uid === 'cost'),
      };
    }, { timeout: 15000 }).toEqual({ source: 'diy_killers_laundry_room_escape_base', cardStillInHand: true });
    const base = guestPage.locator('[data-base-index="1"]').first();
    await expect(base).toHaveAttribute('data-selectable', 'true', { timeout: 15000 });
    await expect(guestPage.locator('[data-base-index="2"]').first()).toHaveAttribute('data-selectable', 'true');
    await expect(guestPage.getByTestId('su-hand-prompt-skip-option')).toBeHidden();
    const declineEscape = guestPage.getByRole('button', { name: '不逃离', exact: true }).first();
    await expect(declineEscape).toBeVisible();
    await guestPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '02-对手选择安全基地'), type: 'jpeg' });
    if (scenario === 'decline-after-card') {
      await declineEscape.click();
      await expect.poll(async () => {
        const current = await getMatchState(matchId, hostPage) as any;
        return {
          player: current.sys.interaction?.current?.playerId,
          source: current.sys.interaction?.current?.data?.sourceId,
          hand: current.core.players['1'].hand.map((card: { uid: string }) => card.uid),
        };
      }, { timeout: 15000 }).toEqual({ player: '0', source: 'diy_killers_laundry_room_destroy', hand: ['cost'] });
      await hostPage.getByRole('button', { name: '跳过', exact: true }).click();
      await expect.poll(async () => {
        const current = await getMatchState(matchId, hostPage) as any;
        return {
          hostStillHere: current.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'host'),
          costStillInHand: current.core.players['1'].hand.some((card: { uid: string }) => card.uid === 'cost'),
          interaction: current.sys.interaction?.current?.data?.sourceId ?? null,
          queue: current.core.triggerQueue?.length ?? 0,
        };
      }, { timeout: 15000 }).toEqual({ hostStillHere: true, costStillInHand: true, interaction: null, queue: 0 });
      await guestPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '03-对手放弃逃离并保留手牌'), type: 'jpeg' });
      return;
    }
    await base.click();
    await expect.poll(async () => {
      const current = await getMatchState(matchId, hostPage) as any;
      const host = current.core.bases[1].minions.find((minion: { uid: string }) => minion.uid === 'host');
      return {
        hostMoved: Boolean(host),
        laundryAttached: host?.attachedActions?.some((action: { uid: string }) => action.uid === 'laundry') ?? false,
        discardedCost: current.core.players['1'].discard.some((card: { uid: string }) => card.uid === 'cost'),
        interaction: current.sys.interaction?.current?.data?.sourceId ?? null,
        queue: current.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 15000 }).toEqual({ hostMoved: true, laundryAttached: true, discardedCost: true, interaction: null, queue: 0 });
    await guestPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '03-对手弃牌并移动宿主'), type: 'jpeg' });
  } finally {
    await cleanupTwoPlayerMatch(match);
  }
});
}
