import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

test('预置代表态：摧毁对手随从后从手牌响应哦不并强化己方随从', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', {
    p0: 'diy_killers,pirates', p1: 'ninjas,aliens', seat1: 'human',
    skipFactionSelect: true, skipInitialization: false, seed: 20261120,
  }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [
        { uid: 'chacha', defId: 'diy_killers_cha_cha_cha_ha_ha_ha', type: 'action', owner: '0' },
        { uid: 'oh-no', defId: 'diy_killers_oh_no', type: 'action', owner: '0' },
      ],
      deck: [], discard: [], factions: ['diy_killers', 'pirates'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    player1: {
      hand: [], deck: [], discard: [], factions: ['ninjas', 'aliens'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    bases: [
      { defId: 'base_the_factory', minions: [
        { uid: 'jason', defId: 'diy_killers_jason', owner: '0', controller: '0' },
        { uid: 'boost', defId: 'pirate_first_mate', owner: '0', controller: '0' },
      ] },
      { defId: 'base_the_mothership', minions: [
        { uid: 'victim', defId: 'ninja_acolyte', owner: '1', controller: '1' },
      ] },
    ],
  });
  await game.playCard('diy_killers_cha_cha_cha_ha_ha_ha');
  await game.waitForInteraction('diy_killers_cha_cha_cha_ha_ha_ha', 10000);
  await page.locator('[data-minion-uid="jason"]').click();
  await game.waitForInteraction('diy_killers_cha_cha_cha_ha_ha_ha_base', 10000);
  await page.locator('[data-base-index="1"]').first().click();
  await game.waitForInteraction('diy_killers_cha_cha_cha_ha_ha_ha_followup', 10000);
  await page.getByRole('button', { name: /^跳过$/ }).first().click();
  await game.waitForInteraction('smashup_reaction_choose', 15000);
  await page.locator('[data-minion-uid="jason"]').click();
  await game.waitForInteraction('diy_killers_jason_destroy', 10000);
  await page.locator('[data-minion-uid="victim"]').click();
  await game.waitForInteraction('smashup_reaction_choose', 15000);
  const reactionCard = page.getByTestId('su-hand-area').locator('[data-card-uid="oh-no"]');
  await expect(reactionCard).toHaveAttribute('data-highlighted', 'true');
  await expect(page.getByRole('button', { name: /^哦 不！！！$/ })).toHaveCount(0);
  await game.screenshot('01-预置代表态-摧毁后手牌特殊响应', testInfo);
  await reactionCard.click();
  await game.waitForInteraction('diy_killers_oh_no', 10000);
  await game.screenshot('02-预置代表态-选择己方强化目标', testInfo);
  await page.locator('[data-minion-uid="boost"]').click();
  await game.waitForNoInteraction(15000);
  await expect.poll(async () => {
    const state = await game.getState();
    return {
      victim: state.core.players['1'].discard.some((card: { uid: string }) => card.uid === 'victim'),
      ohNo: state.core.players['0'].discard.some((card: { uid: string }) => card.uid === 'oh-no'),
      power: state.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'boost')?.tempPowerModifier,
      interactionQueue: state.sys.interaction?.queue?.length ?? 0,
      triggerQueue: state.core.triggerQueue?.length ?? 0,
    };
  }).toEqual({ victim: true, ohNo: true, power: 3, interactionQueue: 0, triggerQueue: 0 });
  await page.getByRole('button', { name: /^结束回合$/ }).click();
  await expect.poll(async () => {
    const state = await game.getState();
    return state.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'boost')?.tempPowerModifier ?? 0;
  }, { timeout: 20000 }).toBe(0);
});
