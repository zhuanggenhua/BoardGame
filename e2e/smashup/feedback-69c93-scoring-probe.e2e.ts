import { test, expect } from '../framework';

test.describe('线上反馈 69c93 基地结算时机探针', () => {
  test.setTimeout(120000);

  test('前中后：海盗湾结算前 → 移动随从响应 → 目标基地与二次计分结果', async ({ game, page }, testInfo) => {
    await game.openTestGame('smashup');
    await game.setupScene({
      gameId: 'smashup',
      player0: { hand: [], deck: [], discard: [], vp: 12, factions: ['pirates', 'robots'] },
      player1: { hand: [], deck: [], discard: [], vp: 7, factions: ['wizards', 'tricksters'] },
      currentPlayer: '0',
      phase: 'playCards',
      bases: [
        {
          defId: 'base_the_jungle',
          minions: [{ uid: 'jungle-anchor', defId: 'dino_king_rex', owner: '0', controller: '0', baseIndex: 0, basePower: 1 }],
          ongoingActions: [],
        },
        {
          defId: 'base_pirate_cove',
          minions: [
            { uid: 'm1', defId: 'pirate_king', owner: '0', controller: '0', baseIndex: 1, basePower: 5 },
            { uid: 'm2', defId: 'robot_hoverbot', owner: '0', controller: '0', baseIndex: 1, basePower: 3 },
            { uid: 'm3', defId: 'wizard_chronomage', owner: '1', controller: '1', baseIndex: 1, basePower: 8 },
            { uid: 'm4', defId: 'robot_zapbot', owner: '0', controller: '0', baseIndex: 1, basePower: 2 },
            { uid: 'm5', defId: 'robot_zapbot', owner: '0', controller: '0', baseIndex: 1, basePower: 2 },
            { uid: 'm6', defId: 'trickster_brownie', owner: '1', controller: '1', baseIndex: 1, basePower: 6 },
          ],
          ongoingActions: [],
        },
        { defId: 'base_wizard_academy', minions: [], ongoingActions: [] },
      ],
      extra: {
        core: {
          baseDeck: ['base_the_factory', 'base_tar_pits', 'base_mushroom_kingdom'],
          nextUid: 3000,
        },
      },
    });

    const before = await game.getState();
    const beforeMinions = before.core.bases[1].minions.map((minion: any) => minion.uid);
    expect(beforeMinions).toEqual(expect.arrayContaining(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']));
    await game.screenshot('01-前态-海盗湾计分前基地与随从', testInfo);

    await game.advancePhase();
    await game.waitForInteraction('base_pirate_cove', 15000);
    await expect(page.getByText('海盗湾：选择移动一个随从到其他基地')).toBeVisible();
    const snapshot = await game.readSceneConsumptionSnapshot();
    const state = await game.getState();
    await game.screenshot('02-中态-海盗湾选择移动随从响应窗口', testInfo);
    console.log(JSON.stringify({
      phase: snapshot.phase,
      interaction: snapshot.interaction,
      responseWindow: snapshot.responseWindow,
      targetLocations: snapshot.targetUidLocations.filter(entry => ['m1', 'm3', 'm6', 'jungle-anchor'].includes(entry.uid)),
      actionLogTail: snapshot.actionLogTail,
      eventStreamTail: snapshot.eventStreamTail,
      vp: { p0: state.core.players['0']?.vp, p1: state.core.players['1']?.vp },
    }, null, 2));

    const scoredEvents = (snapshot.actionLogTail ?? [])
      .filter((entry: any) => entry?.kind === 'su:base_scored');
    expect(scoredEvents.length).toBeGreaterThanOrEqual(1);
    const eventTailText = JSON.stringify(snapshot.eventStreamTail);
    expect(eventTailText).toContain('base_pirate_cove');

    const moveOptions = await game.getInteractionOptions();
    const moveOption = moveOptions.find((option: any) => option.id !== 'skip');
    expect(moveOption).toBeTruthy();
    await game.selectOption(moveOption.id);
    await game.waitForInteraction('base_pirate_cove_choose_base', 15000);
    await expect(page.getByText('海盗湾：选择移动到的基地')).toBeVisible();
    await game.screenshot('03-中态-海盗湾选择目标基地响应窗口', testInfo);

    const destinationOptions = await game.getInteractionOptions();
    const destination = destinationOptions.find((option: any) => option.value?.baseIndex !== 1);
    expect(destination).toBeTruthy();
    await game.selectOption(destination.id);

    await game.waitForNoInteraction(15000).catch(() => undefined);
    const after = await game.readSceneConsumptionSnapshot();
    const afterState = await game.getState();
    expect(afterState.core.players['0']?.vp).toBeGreaterThanOrEqual(state.core.players['0']?.vp ?? 0);
    expect(afterState.core.players['1']?.vp).toBeGreaterThanOrEqual(state.core.players['1']?.vp ?? 0);
    const movedUid = moveOption.value?.minionUid;
    expect(movedUid).toBeTruthy();
    const movedAfter = afterState.core.bases.findIndex((base: any) => base.minions.some((minion: any) => minion.uid === movedUid));
    expect(movedAfter).toBeGreaterThanOrEqual(0);
    expect(movedAfter).not.toBe(1);
    await game.screenshot('04-后态-海盗湾移动随从与计分收口', testInfo);
    expect(snapshot.phase).toBeDefined();
    console.log(JSON.stringify({
      feedbackIds: ['69c93', '69c75'],
      chainId: 'feedback-69c93-69c75-20261006',
      stages: {
        before: { base: 'base_pirate_cove', minions: beforeMinions },
        during: { phase: snapshot.phase, interaction: snapshot.interaction, responseWindow: snapshot.responseWindow },
        after: { phase: after.phase, movedUid, movedAfter, targetLocations: after.targetUidLocations.filter(entry => ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].includes(entry.uid)) },
      },
      vpBefore: { p0: before.core.players['0']?.vp, p1: before.core.players['1']?.vp },
      vpAfter: { p0: afterState.core.players['0']?.vp, p1: afterState.core.players['1']?.vp },
    }, null, 2));
  });
});
