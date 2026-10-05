import { test, expect } from '../framework';

test.describe('线上反馈 69c93 基地结算时机探针', () => {
  test.setTimeout(120000);

  test('记录海盗湾结算后的真实阶段、交互、响应窗口和事件尾部', async ({ game, page }) => {
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene({
      gameId: 'smashup',
      player0: { hand: [], deck: [], discard: [], vp: 12, factions: ['pirates', 'robots'] },
      player1: { hand: [], deck: [], discard: [], vp: 7, factions: ['wizards', 'tricksters'] },
      currentPlayer: '0',
      phase: 'playCards',
      bases: [
        {
          defId: 'base_the_jungle',
          minions: [{ uid: 'jungle-anchor', defId: 'dino_king_rex', owner: '0', controller: '0', baseIndex: 0, basePower: 10 }],
          ongoingActions: [],
        },
        {
          defId: 'base_pirate_cove',
          minions: [
            { uid: 'm1', defId: 'pirate_king', owner: '0', controller: '0', baseIndex: 1, basePower: 5 },
            { uid: 'm2', defId: 'robot_hoverbot', owner: '0', controller: '0', baseIndex: 1, basePower: 3 },
            { uid: 'm3', defId: 'wizard_chronomage', owner: '1', controller: '1', baseIndex: 1, basePower: 3 },
            { uid: 'm4', defId: 'robot_zapbot', owner: '0', controller: '0', baseIndex: 1, basePower: 2 },
            { uid: 'm5', defId: 'robot_zapbot', owner: '0', controller: '0', baseIndex: 1, basePower: 2 },
            { uid: 'm6', defId: 'trickster_brownie', owner: '1', controller: '1', baseIndex: 1, basePower: 4 },
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

    await game.advancePhase();
    const snapshot = await game.readSceneConsumptionSnapshot();
    const state = await game.getState();
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
    expect(scoredEvents.length).toBeGreaterThanOrEqual(2);
    const eventTailText = JSON.stringify(snapshot.eventStreamTail);
    expect(eventTailText).toContain('"baseIndex":0');
    expect(eventTailText).toContain('wizard_chronomage');

    await page.screenshot({ path: 'test-results/evidence-screenshots/smashup/feedback-69c93-scoring-probe.png', fullPage: true });
    expect(snapshot.phase).toBeDefined();
  });
});
