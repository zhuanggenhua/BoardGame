import { test, expect } from '../framework';
import type { CellCoord, SummonerWarsCore, UnitCard } from '../../src/games/summonerwars/domain/types';
import { createDeckByFactionId } from '../../src/games/summonerwars/config/factions';
import { createInitializedCore, placeTestUnit, resetInstanceCounter } from '../../src/games/summonerwars/__tests__/test-helpers';

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

const buildIceShardsSmokeCore = (): { core: SummonerWarsCore; enemyPos: CellCoord; jarmundPos: CellCoord } => {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'frost',
    faction1: 'necromancer',
  });

  core.phase = 'build';
  core.currentPlayer = '0';
  core.selectedUnit = undefined;
  core.abilityUsageCount = {};

  const gatePos = (() => {
    for (let row = 0; row < core.board.length; row++) {
      for (let col = 0; col < core.board[row].length; col++) {
        const structure = core.board[row][col]?.structure;
        if (structure && structure.owner === '0') {
          return { row, col };
        }
      }
    }
    return null;
  })();

  if (!gatePos) {
    throw new Error('未找到己方城门位置');
  }

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

  const jarmundPos = { row: 4, col: 2 };
  placeTestUnit(core, jarmundPos, {
    card: findIceShardsCard(),
    owner: '0',
    boosts: 2,
  });

  placeTestUnit(core, enemyPos, {
    card: findEnemyUnitCard(),
    owner: '1',
  });

  return { core, enemyPos, jarmundPos };
};

test.describe('召唤师战争 - ice_shards 最小化链路', () => {
    test('寒冰碎屑：攻击阶段开始自动结算伤害且不出现确认跳过', async ({ page, game }, testInfo) => {
        await game.openTestGame('summonerwars');
        await page.evaluate(() => {
          (window as Window & { __SW_DISABLE_AUTO_SKIP__?: boolean }).__SW_DISABLE_AUTO_SKIP__ = true;
        });

        const { core, enemyPos, jarmundPos } = buildIceShardsSmokeCore();
        await game.setupScene({
            gameId: 'summonerwars',
            phase: core.phase,
            extra: {
                core,
                sys: {
                    phase: core.phase,
                    flowHalted: false,
                    summonerWars: {
                        phaseEndAbilityResolved: {},
                    },
                    interaction: {
                        current: null,
                        queue: [],
                    },
                },
            },
        });

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    const endPhaseButton = page.getByTestId('sw-end-phase');
    await expect(endPhaseButton).toBeVisible({ timeout: 5000 });
    await expect(endPhaseButton).toBeEnabled({ timeout: 5000 });

    const injectedState = await game.getState();
    expect(injectedState?.core?.phase).toBe('build');
    expect(injectedState?.sys?.phase).toBe('build');
    expect(injectedState?.core?.board?.[enemyPos.row]?.[enemyPos.col]?.unit?.owner).toBe('1');
    expect(injectedState?.core?.board?.[enemyPos.row]?.[enemyPos.col]?.unit?.damage ?? 0).toBe(0);
    const jarmundBefore = injectedState?.core?.board?.[jarmundPos.row]?.[jarmundPos.col]?.unit;
    expect(jarmundBefore?.owner).toBe('0');
    expect(jarmundBefore?.boosts).toBe(2);
    await game.screenshot('01-寒冰碎屑-建造阶段触发前', testInfo);

    await endPhaseButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const enemy = state?.core?.board?.[enemyPos.row]?.[enemyPos.col]?.unit;
      const jarmund = state?.core?.board?.[jarmundPos.row]?.[jarmundPos.col]?.unit;
      return {
        corePhase: state?.core?.phase,
        sysPhase: state?.sys?.phase,
        interactionType: state?.sys?.interaction?.current?.data?.sw?.type ?? null,
        queueLength: state?.sys?.interaction?.queue?.length ?? 0,
        enemyDamage: enemy?.damage ?? 0,
        jarmundBoosts: jarmund?.boosts ?? null,
      };
    }, { timeout: 5000 }).toEqual({
      corePhase: 'attack',
      sysPhase: 'attack',
      interactionType: null,
      queueLength: 0,
      enemyDamage: 1,
      jarmundBoosts: 1,
    });

    const prompt = page.getByTestId('sw-ability-prompt');
    await expect(prompt).toHaveCount(0);
    await game.screenshot('02-寒冰碎屑-攻击阶段开始自动伤害结果', testInfo);
  });
});
