import { test, expect } from './framework';
import type { SummonerWarsCore } from '../src/games/summonerwars/domain/types';
import { createInitializedCore, resetInstanceCounter } from '../src/games/summonerwars/__tests__/test-helpers';

const deterministicRandom = {
  shuffle: <T>(arr: T[]) => [...arr],
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
};

const buildFrostBasicCore = (): SummonerWarsCore => {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'frost',
    faction1: 'necromancer',
  });

  core.currentPlayer = '0';
  core.phase = 'summon';
  return core;
};

test('Frost 阵营基础测试', async ({ page, game }) => {
  await game.openTestGame('summonerwars');

  const core = buildFrostBasicCore();
  await game.setupScene({
    gameId: 'summonerwars',
    currentPlayer: core.currentPlayer,
    phase: core.phase,
    extra: { core },
  });

  await expect(page.getByTestId('sw-action-banner')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('sw-end-phase')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 5000 });

  await expect.poll(async () => {
    const state = await game.getState();
    return state?.core?.phase ?? null;
  }, { timeout: 5000 }).toBe('summon');
});
