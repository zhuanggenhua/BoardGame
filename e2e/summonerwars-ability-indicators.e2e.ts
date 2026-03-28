import { test, expect, type GameTestContext } from './framework';
import type { GamePhase, SummonerWarsCore } from '../src/games/summonerwars/domain/types';
import { createInitializedCore, resetInstanceCounter } from '../src/games/summonerwars/__tests__/test-helpers';

const deterministicRandom = {
  shuffle: <T>(arr: T[]) => [...arr],
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
};

const findSummonerPosition = (core: SummonerWarsCore, playerId: '0' | '1') => {
  for (let row = 0; row < core.board.length; row += 1) {
    for (let col = 0; col < core.board[row].length; col += 1) {
      const unit = core.board[row][col]?.unit;
      if (unit && unit.owner === playerId && unit.card.unitClass === 'summoner') {
        return { row, col };
      }
    }
  }
  throw new Error(`未找到玩家 ${playerId} 的召唤师`);
};

const buildIndicatorCore = (phase: Extract<GamePhase, 'summon' | 'move'>): SummonerWarsCore => {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'necromancer',
    faction1: 'trickster',
  });

  core.currentPlayer = '0';
  core.phase = phase;
  core.selectedUnit = undefined;
  core.abilityUsageCount = {};

  if (phase === 'move') {
    core.players['0'].moveCount = 0;
  }

  return core;
};

const setupIndicatorScene = async (game: GameTestContext, core: SummonerWarsCore) => {
  await game.setupScene({
    gameId: 'summonerwars',
    currentPlayer: core.currentPlayer,
    phase: core.phase,
    extra: { core },
  });
};

test.describe('召唤师战争 - 能力指示器', () => {
  test('召唤阶段：召唤师位置存在能力指示器元素', async ({ page, game }) => {
    await game.openTestGame('summonerwars');

    const core = buildIndicatorCore('summon');
    const summonerPos = findSummonerPosition(core, '0');
    await setupIndicatorScene(game, core);

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-testid="ability-indicator-${summonerPos.row}-${summonerPos.col}"]`).first()).toBeVisible({ timeout: 5000 });
  });

  test('移动阶段：召唤师位置存在能力指示器元素', async ({ page, game }) => {
    await game.openTestGame('summonerwars');

    const core = buildIndicatorCore('move');
    const summonerPos = findSummonerPosition(core, '0');
    await setupIndicatorScene(game, core);

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-testid="ability-indicator-${summonerPos.row}-${summonerPos.col}"]`).first()).toBeVisible({ timeout: 5000 });
  });

  test('可操作指示器和能力指示器可以同时存在', async ({ page, game }) => {
    await game.openTestGame('summonerwars');

    const core = buildIndicatorCore('move');
    const summonerPos = findSummonerPosition(core, '0');
    await setupIndicatorScene(game, core);

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-testid="actionable-indicator-${summonerPos.row}-${summonerPos.col}"]`).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="ability-indicator-${summonerPos.row}-${summonerPos.col}"]`).first()).toBeVisible({ timeout: 5000 });
  });
});
