import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { completeFactionSelection } from '../helpers/smashup';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { cleanupTwoPlayerMatch, setupTwoPlayerMatch, waitForHandArea } from './smashup-helpers';

for (const scenario of ['prevent', 'allow', 'house-rescue'] as const) {
  const prevent = scenario === 'prevent';
  test(`双人预置代表态：${scenario === 'house-rescue' ? '九命之屋救下后不再询问雄蜂' : `雄蜂${prevent ? '防止' : '放行'}杰森摧毁后大砍刀按结果回手`}`, async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupTwoPlayerMatch(browser, testInfo.project.use.baseURL as string | undefined, { skipImageGate: true });
    expect(match, '双人房间必须建立').not.toBeNull();
    if (!match) throw new Error('双人房间未建立');
    const { hostPage, guestPage, matchId } = match;
    hostPage.setDefaultTimeout(10000);
    guestPage.setDefaultTimeout(10000);
    try {
      await completeFactionSelection(hostPage, guestPage, ['aliens', 'dinosaurs'], ['wizards', 'ninjas']);
      await Promise.all([waitForHandArea(hostPage), waitForHandArea(guestPage)]);
      const state = structuredClone(await getMatchState(matchId, hostPage)) as any;
      Object.assign(state.core, { currentPlayerIndex: 0, turnOrder: ['0', '1'], activePlayerId: '0', phase: 'playCards', turnNumber: 7 });
      Object.assign(state.sys, { currentPlayerIndex: 0, turnOrder: ['0', '1'], phase: 'playCards' });
      Object.assign(state.core.players['0'], {
        factions: ['diy_killers', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        hand: [], deck: [
          { uid: 'draw1', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
          { uid: 'draw2', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
        ], discard: [],
      });
      Object.assign(state.core.players['1'], { factions: ['giant_ants', 'ninjas'], hand: [], deck: [], discard: [] });
      state.core.bases = [
        { defId: 'base_the_factory', minions: [{ uid: 'jason', defId: 'diy_killers_jason', owner: '0', controller: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }] }], ongoingActions: [] },
        { defId: 'base_the_mothership', minions: [{ uid: 'victim', defId: 'ninja_acolyte', owner: '1', controller: '1', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }], ongoingActions: [] },
        { defId: scenario === 'house-rescue' ? 'base_house_of_nine_lives' : 'base_the_jungle', minions: [{ uid: 'drone', defId: 'giant_ant_drone', owner: '1', controller: '1', basePower: 3, powerCounters: 1, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }], ongoingActions: [] },
      ];
      state.sys.interaction = { current: null, queue: [], isBlocked: false };
      await injectMatchState(matchId, state, hostPage);
      console.log('[大砍刀] 场景已注入，准备使用天赋');
      const host = hostPage.locator('[data-minion-uid="jason"]');
      await host.hover();
      await hostPage.locator('[data-attached-action-uid="machete"]').click({ force: true });
      await expect(hostPage.locator('[data-base-index="1"]').first()).toHaveAttribute('data-selectable', 'true');
      await hostPage.locator('[data-base-index="1"]').first().click();
      console.log('[大砍刀] 已选移动目的地');
      await expect.poll(async () => (await getMatchState(matchId, hostPage) as any).sys.interaction?.current?.data?.sourceId).toBe('smashup_reaction_choose');
      const reaction = await getMatchState(matchId, hostPage) as any;
      const option = reaction.sys.interaction.current.data.options.find((entry: any) => entry.value?.triggerId?.includes('diy_killers_jason'));
      expect(option).toBeDefined();
      await hostPage.locator('[data-minion-uid="jason"]').click();
      console.log('[大砍刀] 已选杰森反应');
      await expect.poll(async () => (await getMatchState(matchId, hostPage) as any).sys.interaction?.current?.data?.sourceId).toBe('diy_killers_jason_destroy');
      await hostPage.locator('[data-minion-uid="victim"]').click();
      console.log('[大砍刀] 已选摧毁目标');
      if (scenario === 'house-rescue') {
        await expect.poll(async () => (await getMatchState(matchId, guestPage) as any).sys.interaction?.current?.data?.sourceId).toBe('base_nine_lives_intercept');
        await guestPage.getByRole('button', { name: '移动到九命之家' }).click();
        await expect.poll(async () => {
          const current = await getMatchState(matchId, guestPage) as any;
          return current.core.bases[2].minions.some((minion: any) => minion.uid === 'victim');
        }).toBe(true);
        await guestPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '九命之屋救下后的防止选择'), type: 'jpeg' });
        const remaining = (await getMatchState(matchId, guestPage) as any).sys.interaction?.current?.data?.sourceId ?? null;
        if (remaining === 'giant_ant_drone_prevent_destroy') {
          await guestPage.locator('[data-minion-uid="drone"]').click();
          await expect.poll(async () => {
            const current = await getMatchState(matchId, guestPage) as any;
            return {
              victimSaved: current.core.bases[2].minions.some((minion: any) => minion.uid === 'victim'),
              droneCounters: current.core.bases[2].minions.find((minion: any) => minion.uid === 'drone')?.powerCounters,
              interaction: current.sys.interaction?.current?.data?.sourceId ?? null,
            };
          }).toEqual({ victimSaved: true, droneCounters: 1, interaction: null });
        }
        expect(remaining).toBeNull();
        return;
      }
      await expect.poll(async () => {
        const current = await getMatchState(matchId, guestPage) as any;
        return { source: current.sys.interaction?.current?.data?.sourceId, player: current.sys.interaction?.current?.playerId };
      }).toEqual({ source: 'giant_ant_drone_prevent_destroy', player: '1' });
      await guestPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '01-雄蜂防止选择'), type: 'jpeg' });
      if (prevent) {
        await guestPage.locator('[data-minion-uid="drone"]').click();
      } else {
        await guestPage.getByRole('button', { name: '不防止消灭' }).click();
      }
      await expect.poll(async () => {
        const current = await getMatchState(matchId, hostPage) as any;
        const jason = current.core.bases[1].minions.find((minion: any) => minion.uid === 'jason');
        return {
          victim: current.core.bases[1].minions.some((minion: any) => minion.uid === 'victim'),
          destroyedByJason: jason?.destroyedMinionThisTurn === true,
          interaction: current.sys.interaction?.current?.data?.sourceId ?? null,
        };
      }).toEqual({ victim: prevent, destroyedByJason: !prevent, interaction: null });
      await hostPage.getByRole('button', { name: /^结束回合$/ }).click();
      await expect.poll(async () => {
        const current = await getMatchState(matchId, hostPage) as any;
        const jason = current.core.bases[1].minions.find((minion: any) => minion.uid === 'jason');
        return {
          attached: jason?.attachedActions.some((action: any) => action.uid === 'machete') ?? false,
          hand: current.core.players['0'].hand.some((card: any) => card.uid === 'machete'),
          turn: current.core.currentPlayerIndex,
        };
      }, { timeout: 15000 }).toEqual({ attached: prevent, hand: !prevent, turn: 1 });
      await hostPage.screenshot({ path: getEvidenceScreenshotPath(testInfo, '02-回合结束大砍刀结果'), type: 'jpeg' });
    } finally {
      await cleanupTwoPlayerMatch(match);
    }
  });
}
