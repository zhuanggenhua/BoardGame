import { test, expect, type GameTestContext } from '../framework';
import type { GamePhase, SummonerWarsCore } from '../../src/games/summonerwars/domain/types';
import { createInitializedCore, resetInstanceCounter } from '../../src/games/summonerwars/__tests__/test-helpers';

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

  test('充能标记尺寸跟随单位卡显示比例', async ({ page, game }) => {
    await game.openTestGame('summonerwars');

    const core = buildIndicatorCore('move');
    const summonerPos = findSummonerPosition(core, '0');
    const summoner = core.board[summonerPos.row]?.[summonerPos.col]?.unit;
    if (!summoner) {
      throw new Error('未找到用于充能标记尺寸测试的召唤师');
    }
    summoner.boosts = 3;

    await setupIndicatorScene(game, core);

    const unit = page.locator(`[data-testid="sw-unit-${summonerPos.row}-${summonerPos.col}"]`).first();
    const chargeDot = unit.locator('.bg-blue-400.border-blue-200').first();
    await expect(unit).toBeVisible({ timeout: 10000 });
    await expect(chargeDot).toBeVisible({ timeout: 5000 });

    const geometry = await chargeDot.evaluate((dot) => {
      const dotRect = dot.getBoundingClientRect();
      const unitRoot = dot.closest('[data-testid^="sw-unit-"]');
      if (!unitRoot) {
        throw new Error('充能标记未挂在单位卡 DOM 内');
      }
      const unitRect = unitRoot.getBoundingClientRect();
      return {
        dotWidth: dotRect.width,
        dotHeight: dotRect.height,
        unitWidth: unitRect.width,
        unitHeight: unitRect.height,
      };
    });

    expect(geometry.dotWidth).toBeGreaterThanOrEqual(geometry.unitWidth * 0.075);
    expect(geometry.dotHeight).toBeGreaterThanOrEqual(geometry.unitWidth * 0.075);
  });
});
