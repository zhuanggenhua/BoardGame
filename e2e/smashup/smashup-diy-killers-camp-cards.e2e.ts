import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

test('水晶湖只按基地上的牌筛选摧毁目标', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', {
    p0: 'diy_killers,dinosaurs', p1: 'pirates,ninjas', seat1: 'local-ai',
    skipFactionSelect: true, skipInitialization: false, seed: 20261120,
  }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [{ uid: 'preserve', defId: 'dino_wildlife_preserve', type: 'action', owner: '0' }],
      deck: [], discard: [], factions: ['diy_killers', 'dinosaurs'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0 },
    bases: [
      { defId: 'base_diy_killers_camp_crystal_lake', minions: [
        { uid: 'own', defId: 'diy_killers_jason', owner: '0', controller: '0', attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }] },
        { uid: 'low', defId: 'ninja_acolyte', owner: '1', controller: '1' },
        { uid: 'high', defId: 'ninja_shinobi', owner: '1', controller: '1' },
      ] },
      { defId: 'base_the_factory', minions: [] },
    ],
  });
  await game.playCard('dino_wildlife_preserve', { targetBaseIndex: 0 });
  await game.waitForInteraction('smashup_reaction_choose', 10000);
  await page.locator('[data-base-index="0"]').first().click();
  await game.waitForInteraction('base_diy_killers_camp_crystal_lake_destroy', 10000);
  await expect(page.getByRole('button', { name: '让过', exact: true })).toBeHidden({ timeout: 5000 });
  await expect(page.locator('[data-minion-uid="low"]')).toHaveAttribute('data-highlighted', 'true');
  await expect(page.locator('[data-minion-uid="high"]')).not.toHaveAttribute('data-highlighted', 'true');
  await game.screenshot('水晶湖-基地牌数筛选摧毁目标', testInfo);
  await page.getByRole('button', { name: '跳过', exact: true }).click();
  await game.waitForNoInteraction(10000);
  const state = await game.getState();
  expect(state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'low')).toBe(true);
  expect(state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'high')).toBe(true);
});

for (const destroy of [false, true]) {
test(`从泰坦栏打出到水晶湖后${destroy ? '摧毁并加力' : '跳过摧毁'}`, async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', {
    p0: 'diy_killers,tricksters_pod', p1: 'pirates,ninjas', seat1: 'local-ai',
    skipFactionSelect: true, skipInitialization: false, seed: 20261120,
  }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: { hand: [], deck: [], discard: [], factions: ['diy_killers', 'tricksters_pod'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
    player1: { hand: [], deck: [], discard: [], factions: ['pirates', 'ninjas'] },
    bases: [
      { defId: 'base_diy_killers_camp_crystal_lake', minions: [
        { uid: 'enemy', defId: 'robot_microbot_guard', owner: '1', controller: '1' },
        { uid: 'boost-target', defId: 'ninja_shinobi', owner: '1', controller: '1' },
      ] },
      { defId: 'base_the_factory', minions: [] },
    ],
    extra: { core: { enabledExpansions: ['titans'], titans: [{
      uid: 'titan', defId: 'tricksters_big_funny_giant_pod', faction: 'tricksters_pod', ownerId: '0', controllerId: '0',
      powerCounters: 0, talentUsed: false, location: { zone: 'setaside' },
    }] } },
  });
  const rail = page.getByTestId('su-titan-rail');
  await expect(rail).toBeVisible();
  await rail.locator('button').first().click();
  await page.locator('[data-base-index="0"]').first().click();
  await game.waitForInteraction('smashup_reaction_choose', 10000);
  await page.locator('[data-base-index="0"]').first().click();
  await game.waitForInteraction('base_diy_killers_camp_crystal_lake_destroy', 10000);
  await expect(page.getByRole('button', { name: '让过', exact: true })).toBeHidden({ timeout: 5000 });
  await expect(page.locator('[data-minion-uid="enemy"]')).toHaveAttribute('data-highlighted', 'true');
  await expect(page.locator('[data-minion-uid="boost-target"]')).not.toHaveAttribute('data-highlighted', 'true');
  await game.screenshot('水晶湖-泰坦打出后的摧毁选择', testInfo);
  if (destroy) {
    await page.locator('[data-minion-uid="enemy"]').click();
    await game.waitForInteraction('base_diy_killers_camp_crystal_lake_power', 10000);
    await expect(page.getByRole('button', { name: '跳过', exact: true })).toBeHidden({ timeout: 5000 });
    await expect(page.locator('[data-minion-uid="boost-target"]')).toHaveAttribute('data-highlighted', 'true');
    await game.screenshot('水晶湖-泰坦打出后选择加力', testInfo);
    await page.locator('[data-minion-uid="boost-target"]').click();
  } else {
    await page.getByRole('button', { name: '跳过', exact: true }).click();
  }
  await game.waitForNoInteraction(10000);
  const state = await game.getState();
  expect(state.core.titans.find((titan: { uid: string }) => titan.uid === 'titan')?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
  expect(state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'enemy')).toBe(!destroy);
  expect(state.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'boost-target')?.tempPowerModifier ?? 0).toBe(destroy ? 1 : 0);
});
}
