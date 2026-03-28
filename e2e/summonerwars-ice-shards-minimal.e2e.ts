import { test, expect } from './framework';
import { applyCoreState } from './helpers/summonerwars';
import type { CellCoord, SummonerWarsCore, UnitCard } from '../src/games/summonerwars/domain/types';
import { createDeckByFactionId } from '../src/games/summonerwars/config/factions';
import { createInitializedCore, placeTestUnit, resetInstanceCounter } from '../src/games/summonerwars/__tests__/test-helpers';

const deterministicRandom = {
  shuffle: <T>(arr: T[]) => [...arr],
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
};

const adjacentOffsets = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const findIceShardsCard = (): UnitCard => {
  const card = createDeckByFactionId('frost').deck.find(
    (entry): entry is UnitCard => entry.cardType === 'unit' && !!entry.abilities?.includes('ice_shards'),
  );
  if (!card) {
    throw new Error('未找到 ice_shards 对应单位');
  }
  return card;
};

const findEnemyUnitCard = (): UnitCard => {
  const card = createDeckByFactionId('necromancer').deck.find(
    (entry): entry is UnitCard => entry.cardType === 'unit',
  );
  if (!card) {
    throw new Error('未找到敌方测试单位');
  }
  return card;
};

const buildIceShardsSmokeCore = (): { core: SummonerWarsCore; enemyPos: CellCoord } => {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'frost',
    faction1: 'necromancer',
  });

  core.phase = 'build';
  core.currentPlayer = '0';
  core.selectedUnit = undefined;
  core.abilityUsageCount = {};

  const frostDeck = createDeckByFactionId('frost');
  const gatePos = frostDeck.startingGatePosition;

  let enemyPos: CellCoord | null = null;
  for (const offset of adjacentOffsets) {
    const row = gatePos.row + offset.row;
    const col = gatePos.col + offset.col;
    if (row < 0 || row >= core.board.length || col < 0 || col >= core.board[row].length) {
      continue;
    }
    core.board[row][col] = {};
    enemyPos = { row, col };
    break;
  }

  if (!enemyPos) {
    throw new Error('未找到可放置敌方单位的相邻格');
  }

  placeTestUnit(core, { row: 4, col: 2 }, {
    card: findIceShardsCard(),
    owner: '0',
    boosts: 2,
  });

  placeTestUnit(core, enemyPos, {
    card: findEnemyUnitCard(),
    owner: '1',
  });

  return { core, enemyPos };
};

test.describe('召唤师战争 - ice_shards 最小化链路', () => {
  test('build 结束时出现 confirm/skip 选择', async ({ page, game }, testInfo) => {
    await game.openTestGame('summonerwars');

    const { core, enemyPos } = buildIceShardsSmokeCore();
    await applyCoreState(page, core);

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('sw-end-phase')).toBeVisible({ timeout: 5000 });

    const injectedState = await game.getState();
    expect(injectedState?.core?.board?.[enemyPos.row]?.[enemyPos.col]?.unit?.owner).toBe('1');

    await page.getByTestId('sw-end-phase').click();

    await expect(page.getByRole('button', { name: /^(确认|Confirm)$/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /^(跳过|Skip)$/i })).toBeVisible({ timeout: 5000 });

    await game.screenshot('ice-shards-phase-end-choice', testInfo);
  });
});
