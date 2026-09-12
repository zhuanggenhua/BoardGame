import { test, expect, type GameTestContext } from '../framework';
import type { Locator, Page } from '@playwright/test';
import type { SummonerWarsCore } from '../../src/games/summonerwars/domain/types';
import { createInitializedCore, resetInstanceCounter } from '../../src/games/summonerwars/__tests__/test-helpers';
import { isUndeadCard } from '../../src/games/summonerwars/domain/ids';

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

const moveUndeadCardToDiscard = (core: SummonerWarsCore) => {
  const discardUndeadIndex = core.players['0'].deck.findIndex(card => card.cardType === 'unit' && isUndeadCard(card));
  if (discardUndeadIndex < 0) {
    throw new Error('未找到可放入弃牌堆的亡灵单位，无法证明复活死灵处于可用状态');
  }
  const [discardUndead] = core.players['0'].deck.splice(discardUndeadIndex, 1);
  core.players['0'].discard = [{ ...discardUndead, id: `${discardUndead.id}-ability-ready-test` }];
};

const buildNecromancerSummonCore = (options?: { withReviveTarget?: boolean; selectedSummoner?: boolean }): SummonerWarsCore => {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'necromancer',
    faction1: 'trickster',
  });

  core.currentPlayer = '0';
  core.phase = 'summon';
  core.selectedUnit = undefined;
  core.abilityUsageCount = {};

  if (options?.withReviveTarget) {
    moveUndeadCardToDiscard(core);
  }

  if (options?.selectedSummoner) {
    core.selectedUnit = findSummonerPosition(core, '0');
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

const getAbilityReadyIndicator = (page: Page, row: number, col: number) => (
  page.getByTestId(`sw-unit-${row}-${col}`)
    .locator('[data-testid="sw-ability-ready-indicator"]')
    .first()
);

const expectAbilityReadyIndicatorRendered = async (page: Page, indicator: Locator, label: string) => {
  await expect(indicator, `${label}：场上单位必须挂载技能就绪指示器`).toBeVisible({ timeout: 5000 });
  const ripples = indicator.locator('[data-sw-ability-ready-ripple="true"]');
  await expect(ripples, `${label}：技能就绪指示器必须保留三层扩散波纹`).toHaveCount(3);

  await expect.poll(async () => (
    ripples.first().evaluate((element) => {
      const style = window.getComputedStyle(element);
      return `${style.borderTopStyle}|${style.borderTopWidth}`;
    })
  ), {
    timeout: 5000,
    message: `${label}：波纹边框必须实际绘制，不能只剩静态发光高亮`,
  }).toBe('solid|3px');

  const firstAnimationSample = await ripples.evaluateAll((elements) => elements
    .map((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return `${style.opacity}|${style.transform}|${Math.round(rect.width)}x${Math.round(rect.height)}`;
    })
    .join(';'));
  await page.waitForTimeout(350);
  const secondAnimationSample = await ripples.evaluateAll((elements) => elements
    .map((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return `${style.opacity}|${style.transform}|${Math.round(rect.width)}x${Math.round(rect.height)}`;
    })
    .join(';'));

  expect(secondAnimationSample, `${label}：波纹必须在连续帧里变化，不能退化成普通静态高亮`).not.toBe(firstAnimationSample);
};

test.describe('召唤师战争 - 能力指示器', () => {
  test('召唤阶段：死灵法师主动技能可用时棋盘单位显示呼吸波纹', async ({ page, game }) => {
    await game.openTestGame('summonerwars');

    const core = buildNecromancerSummonCore({ withReviveTarget: true });
    const summonerPos = findSummonerPosition(core, '0');
    await setupIndicatorScene(game, core);

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    await expectAbilityReadyIndicatorRendered(
      page,
      getAbilityReadyIndicator(page, summonerPos.row, summonerPos.col),
      '召唤阶段死灵法师可用主动技能',
    );
  });

  test('召唤阶段：选中死灵法师后按既有规则隐藏呼吸波纹', async ({ page, game }) => {
    await game.openTestGame('summonerwars');

    const core = buildNecromancerSummonCore({ withReviveTarget: true, selectedSummoner: true });
    const summonerPos = findSummonerPosition(core, '0');
    await setupIndicatorScene(game, core);

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    await expect(getAbilityReadyIndicator(page, summonerPos.row, summonerPos.col)).toHaveCount(0);
  });

  test('召唤阶段：死灵法师主动技能条件不满足时不显示呼吸波纹', async ({ page, game }) => {
    await game.openTestGame('summonerwars');

    const core = buildNecromancerSummonCore({ withReviveTarget: false });
    const summonerPos = findSummonerPosition(core, '0');
    await setupIndicatorScene(game, core);

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    await expect(getAbilityReadyIndicator(page, summonerPos.row, summonerPos.col)).toHaveCount(0);
  });

  test('充能标记尺寸跟随单位卡显示比例', async ({ page, game }) => {
    await game.openTestGame('summonerwars');

    const core = buildNecromancerSummonCore();
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
