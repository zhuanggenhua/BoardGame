import { test, expect } from '../framework';

test.describe('SmashUp 远古埃及反馈回归', () => {
  test.setTimeout(120000);

  test('阿努比斯祭司在基地只有对手埋葬牌时不显示 +2', async ({ game, page }, testInfo) => {
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene({
      gameId: 'smashup',
      player0: { factions: ['ancient_egyptians', 'aliens'] },
      player1: { factions: ['pirates', 'ninjas'] },
      bases: [
        {
          defId: 'base_pyramids',
          minions: [{
            uid: 'feedback-priest',
            defId: 'ancient_egyptians_priest_of_anubis',
            controller: '0',
            owner: '0',
            basePower: 4,
          }],
          buriedCards: [{
            uid: 'feedback-enemy-buried',
            defId: 'buried_unknown',
            trueOwnerId: '1',
            controllerId: '1',
            buriedFrom: 'hand',
          }],
        },
        { defId: 'base_the_workshop', minions: [] },
        { defId: 'base_the_mothership', minions: [] },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await expect(page.locator('[data-minion-uid="feedback-priest"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="su-minion-power-badge-feedback-priest"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('feedback-69c92aa-anubis-no-bonus.png'), fullPage: true });
  });

  test('探究从真实手牌入口先选对手，再弃掉对手手牌中的随从', async ({ game, page }, testInfo) => {
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene({
      gameId: 'smashup',
      player0: {
        factions: ['aliens', 'dinosaurs'],
        hand: [{ uid: 'feedback-probe', defId: 'alien_probe', type: 'action', owner: '0' }],
      },
      player1: {
        factions: ['pirates', 'ninjas'],
        hand: [
          { uid: 'feedback-target-minion', defId: 'pirate_first_mate', type: 'minion', owner: '1' },
          { uid: 'feedback-target-action', defId: 'pirate_broadside', type: 'action', owner: '1' },
        ],
      },
      bases: [
        { defId: 'base_the_mothership', minions: [] },
        { defId: 'base_the_workshop', minions: [] },
        { defId: 'base_the_field_of_honor', minions: [] },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.playCard('alien_probe');
    await game.waitForInteraction('alien_probe_choose_target');
    await page.screenshot({ path: testInfo.outputPath('feedback-69a2ed9-probe-choose-player.png'), fullPage: true });
    const playerOptions = await game.getInteractionOptions();
    await game.selectOption(playerOptions[0].id);

    await game.waitForInteraction('alien_probe');
    const handOptions = await game.getInteractionOptions();
    expect(handOptions.some((option: any) => option.value?.cardUid === 'feedback-target-minion')).toBe(true);
    await game.selectOption(handOptions.find((option: any) => option.value?.cardUid === 'feedback-target-minion')?.id);
    await game.waitForNoInteraction();

    const state = await game.getState();
    expect(state.core.players['1'].hand.some((card: any) => card.uid === 'feedback-target-minion')).toBe(false);
    expect(state.core.players['1'].discard.some((card: any) => card.uid === 'feedback-target-minion')).toBe(true);
    expect(state.core.players['1'].hand.some((card: any) => card.uid === 'feedback-target-action')).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('feedback-69a2ed9-probe-resolved.png'), fullPage: true });
  });
});
