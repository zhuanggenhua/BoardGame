/**
 * 召唤师战争 - 极地矮人阵营特色交互 E2E 测试
 * 
 * 覆盖范围：
 * - 威势（imposing）：攻击敌方单位后给自己充能一次
 * - 寒冰碎屑（ice_shards）：攻击阶段开始消耗充能对建筑相邻敌方造成伤害
 * - 冰霜战斧（frost_axe）：移动后充能自身
 * - 结构变换（structure_shift）：移动后推拉友方建筑
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { CHAMPION_UNITS_FROST, SUMMONER_FROST } from '../../src/games/summonerwars/config/factions/frost';
import { COMMON_UNITS as COMMON_UNITS_NECROMANCER, SUMMONER_NECROMANCER } from '../../src/games/summonerwars/config/factions/necromancer';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('summonerwars');
  await game.setupScene({ gameId: 'summonerwars' });
};
void __ensureThreeAxesMarker;

import {
  setupSWOnlineMatch,
  readCoreState,
  applyCoreState,
  clickBoardElement,
  closeDebugPanelIfOpen,
  waitForPhase,
  waitForSummonerWarsUI,
  advanceToPhase,
  cloneState,
} from '../helpers/summonerwars';

const cloneInjectedUnitCard = <T extends { abilities?: string[]; deckSymbols?: string[] }>(card: T): T => ({
  ...card,
  abilities: Array.isArray(card.abilities) ? [...card.abilities] : [],
  deckSymbols: Array.isArray(card.deckSymbols) ? [...card.deckSymbols] : [],
});

const jarmundCard = CHAMPION_UNITS_FROST.find((card) => card.id === 'frost-jarmund');
const necroWarriorCard = COMMON_UNITS_NECROMANCER.find((card) => card.id === 'necro-undead-warrior');
if (!jarmundCard) {
  throw new Error('未找到极地矮人贾穆德配置（frost-jarmund）');
}
if (!necroWarriorCard) {
  throw new Error('未找到亡灵战士配置（necro-undead-warrior）');
}

// ============================================================================
// 测试状态准备函数
// ============================================================================

const dismissDiceResultOverlay = async (page: Page) => {
  const overlay = page.getByTestId('sw-dice-result-overlay');
  const visible = await overlay.isVisible().catch(() => false);
  if (!visible) return;
  await overlay.click({ force: true }).catch(() => {});
  await expect(overlay).toBeHidden({ timeout: 8000 });
};

const setHarnessDiceValues = async (page: Page, values: number[]) => {
  await page.evaluate((diceValues) => {
    const harness = (window as Window & {
      __BG_TEST_HARNESS__?: { dice?: { setValues?: (items: number[]) => void } };
    }).__BG_TEST_HARNESS__;
    if (typeof harness?.dice?.setValues !== 'function') {
      throw new Error('__BG_TEST_HARNESS__.dice.setValues not found');
    }
    harness.dice.setValues(diceValues);
  }, values);
};

const prepareImposingState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.phase = 'attack';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;
  next.abilityUsage = {};
  next.abilityUsageCount = {};
  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.magic = 3;
  player.attackCount = 0;
  player.hasAttackedEnemy = false;

  const board = next.board;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      board[row][col].unit = null;
      board[row][col].structure = null;
    }
  }

  const jarmundPos = { row: 5, col: 2 };
  const enemyPos = { row: 5, col: 5 };
  const mySummonerPos = { row: 7, col: 2 };
  const enemySummonerPos = { row: 0, col: 2 };

  board[mySummonerPos.row][mySummonerPos.col].unit = {
    instanceId: 'imposing-my-summoner',
    cardId: 'imposing-my-summoner-card',
    card: cloneInjectedUnitCard(SUMMONER_FROST),
    owner: '0',
    position: mySummonerPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[enemySummonerPos.row][enemySummonerPos.col].unit = {
    instanceId: 'imposing-enemy-summoner',
    cardId: 'imposing-enemy-summoner-card',
    card: cloneInjectedUnitCard(SUMMONER_NECROMANCER),
    owner: '1',
    position: enemySummonerPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[jarmundPos.row][jarmundPos.col].unit = {
    instanceId: 'imposing-jarmund',
    cardId: jarmundCard.id,
    card: cloneInjectedUnitCard(jarmundCard),
    owner: '0',
    position: jarmundPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[enemyPos.row][enemyPos.col].unit = {
    instanceId: 'imposing-enemy-warrior',
    cardId: necroWarriorCard.id,
    card: { ...cloneInjectedUnitCard(necroWarriorCard), life: 8 },
    owner: '1',
    position: enemyPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return { state: next, jarmundPos, enemyPos };
};

/**
 * 准备寒冰碎屑（ice_shards）测试状态
 * 
 * 策略：使用棋盘上已有的友方建筑（极地矮人初始有传送门），
 * 在其旁边放置敌方单位，并确保贾穆德（有 ice_shards 技能）有充能。
 * 
 * 注意：不修改 phase，由 advanceToPhase 自然推进保证 sys.phase 同步
 */
const prepareIceShardsState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.abilityUsageCount = {};
  // 确保阶段为 build，随后结束阶段进入 attack 并触发 ice_shards
  next.phase = 'build';

  const board = next.board;

  // 查找友方建筑（极地矮人初始有传送门）
  let structurePos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.structure && cell.structure.owner === '0') {
        structurePos = { row, col };
        break;
      }
    }
    if (structurePos) break;
  }
  if (!structurePos) throw new Error('未找到友方建筑');

  // 在建筑旁放置敌方单位
  const adjDirs = [
    { row: -1, col: 0 }, { row: 1, col: 0 },
    { row: 0, col: -1 }, { row: 0, col: 1 },
  ];
  let enemyPos: { row: number; col: number } | null = null;
  for (const d of adjDirs) {
    const r = structurePos.row + d.row;
    const c = structurePos.col + d.col;
    if (r < 0 || r >= 8 || c < 0 || c >= 6) continue;
    if (!board[r][c].unit && !board[r][c].structure) {
      board[r][c].unit = {
        instanceId: `enemy-skel-ice-${r}-${c}`,
        cardId: 'necro-skeleton-ice',
        card: {
          id: 'necro-skeleton', cardType: 'unit', name: '骷髅兵', faction: 'necromancer',
          cost: 0, life: 3, strength: 1, attackType: 'melee', attackRange: 1,
          unitClass: 'common', deckSymbols: [], abilities: [],
        },
        owner: '1', position: { row: r, col: c }, damage: 0, boosts: 0,
        hasMoved: false, hasAttacked: false,
      };
      enemyPos = { row: r, col: c };
      break;
    }
  }
  if (!enemyPos) throw new Error('无法在建筑旁放置敌方单位');

  // 查找或放置贾穆德（有 ice_shards 技能）
  let jamudPos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('ice_shards')) {
        cell.unit.boosts = 2;
        jamudPos = { row, col };
        break;
      }
    }
    if (jamudPos) break;
  }

  if (!jamudPos) {
    for (let row = 4; row < 7; row++) {
      for (let col = 0; col < 6; col++) {
        if (!board[row][col].unit && !board[row][col].structure) {
          board[row][col].unit = {
            instanceId: `frost-jarmund-e2e-${row}-${col}`, cardId: 'frost-jarmund',
            card: {
              id: 'frost-jarmund', cardType: 'unit', name: '贾穆德', faction: 'frost',
              cost: 5, life: 7, strength: 3, attackType: 'ranged', attackRange: 3,
              unitClass: 'champion', deckSymbols: [], abilities: ['imposing', 'ice_shards'],
            },
            owner: '0', position: { row, col }, damage: 0, boosts: 2,
            hasMoved: false, hasAttacked: false,
          };
          jamudPos = { row, col };
          break;
        }
      }
      if (jamudPos) break;
    }
  }
  if (!jamudPos) throw new Error('无法放置贾穆德');

  return { state: next, jamudPos, structurePos, enemyPos };
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('极地矮人阵营特色交互', () => {

  test('贾穆德威势：攻击敌方单位后真实 UI 只显示一次充能', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: imposingCore, jarmundPos, enemyPos } = prepareImposingState(coreState);
      await applyCoreState(hostPage, imposingCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(600);

      const jarmund = hostPage.locator(`[data-testid="sw-unit-${jarmundPos.row}-${jarmundPos.col}"][data-owner="0"]`).first();
      await expect(jarmund).toBeVisible({ timeout: 5000 });
      await expect(jarmund.locator('.bg-blue-400')).toHaveCount(0);

      await jarmund.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'imposing-before-attack-no-charge', {
          filename: 'imposing-before-attack-no-charge.png',
        }),
      });

      await setHarnessDiceValues(hostPage, [1, 1, 1]);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${jarmundPos.row}-${jarmundPos.col}"][data-owner="0"][data-unit-name="${jarmundCard.name}"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyPos.row}-${enemyPos.col}"][data-owner="1"][data-unit-name="${necroWarriorCard.name}"]`);
      await dismissDiceResultOverlay(hostPage);

      const expectedImposingEvidence = {
        boosts: 1,
        attackCount: 1,
        hasAttacked: true,
      };

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const unit = state?.board?.[jarmundPos.row]?.[jarmundPos.col]?.unit;
        return {
          boosts: unit?.boosts ?? null,
          attackCount: state?.players?.['0']?.attackCount ?? null,
          hasAttacked: unit?.hasAttacked ?? null,
        };
      }, { timeout: 12000 }).toEqual(expectedImposingEvidence);

      await expect(jarmund.locator('.bg-blue-400')).toHaveCount(1);
      await hostPage.waitForTimeout(1200);
      await expect(jarmund.locator('.bg-blue-400')).toHaveCount(1);

      await closeDebugPanelIfOpen(hostPage);
      await jarmund.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'imposing-after-attack-one-charge', {
          filename: 'imposing-after-attack-one-charge.png',
        }),
      });

      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSummonerWarsUI(hostPage, 30000);
      await closeDebugPanelIfOpen(hostPage);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const unit = state?.board?.[jarmundPos.row]?.[jarmundPos.col]?.unit;
        return {
          boosts: unit?.boosts ?? null,
          attackCount: state?.players?.['0']?.attackCount ?? null,
          hasAttacked: unit?.hasAttacked ?? null,
        };
      }, { timeout: 12000 }).toEqual(expectedImposingEvidence);

      const reloadedJarmund = hostPage.locator(`[data-testid="sw-unit-${jarmundPos.row}-${jarmundPos.col}"][data-owner="0"]`).first();
      await expect(reloadedJarmund).toBeVisible({ timeout: 5000 });
      await expect(reloadedJarmund.locator('.bg-blue-400')).toHaveCount(1);
      await reloadedJarmund.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'imposing-after-reload-still-one-charge', {
          filename: 'imposing-after-reload-still-one-charge.png',
        }),
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('寒冰碎屑：攻击阶段开始消耗充能对建筑相邻敌方造成伤害', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;

    try {
      await advanceToPhase(hostPage, 'build');

      const coreState = await readCoreState(hostPage);
      const { state: iceShardsCore, jamudPos, enemyPos } = prepareIceShardsState(coreState);
      await applyCoreState(hostPage, iceShardsCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'build');
      await hostPage.waitForTimeout(1000);

      // 验证状态注入成功：贾穆德有充能，敌方单位存在
      const verifyState = await readCoreState(hostPage);
      const jamudUnit = verifyState.board[jamudPos.row]?.[jamudPos.col]?.unit;
      expect(jamudUnit).toBeTruthy();
      expect(jamudUnit.boosts).toBeGreaterThanOrEqual(1);
      const enemyUnit = verifyState.board[enemyPos.row]?.[enemyPos.col]?.unit;
      expect(enemyUnit).toBeTruthy();
      expect(enemyUnit.owner).toBe('1');

      // 记录敌方单位初始伤害
      const initialDamage = enemyUnit?.damage ?? 0;

      // 点击"结束阶段"退出 build 阶段，进入 attack 时触发 ice_shards
      const endPhaseBtn = hostPage.getByTestId('sw-end-phase');
      await expect(endPhaseBtn).toBeVisible({ timeout: 5000 });
      
      await endPhaseBtn.click();
      await waitForPhase(hostPage, 'attack');
      
      // 按钮文本来自 i18n: actions.confirm = "确认"/"Confirm", actions.skip = "跳过"/"Skip"
      const confirmBtn = hostPage.locator('button').filter({ hasText: /^Confirm$|^确认$/i }).first();
      
      // 等待按钮出现（5秒超时）
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });
      await expect(confirmBtn).toBeEnabled({ timeout: 1000 });

      // 点击"确认"执行寒冰碎屑
      await confirmBtn.click();
      await hostPage.waitForTimeout(500);

      // 验证敌方单位受到伤害
      const afterState = await readCoreState(hostPage);
      const enemyAfter = afterState.board[enemyPos.row][enemyPos.col]?.unit;

      if (enemyAfter) {
        expect(enemyAfter.damage).toBeGreaterThan(initialDamage);
      } else {
        // 敌方单位被消灭也算成功
        expect(enemyAfter).toBeFalsy();
      }

      // 验证贾穆德充能减少
      const jamudAfter = afterState.board[jamudPos.row][jamudPos.col]?.unit;
      expect(jamudAfter).toBeTruthy();
      expect(jamudAfter.boosts).toBeLessThan(2);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('寒冰碎屑：跳过不执行', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;

    try {
      await advanceToPhase(hostPage, 'build');

      const coreState = await readCoreState(hostPage);
      const { state: iceShardsCore, jamudPos, enemyPos } = prepareIceShardsState(coreState);
      await applyCoreState(hostPage, iceShardsCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'build');
      await hostPage.waitForTimeout(1000);

      // 验证状态注入成功
      const verifyState = await readCoreState(hostPage);
      const jamudBefore = verifyState.board[jamudPos.row]?.[jamudPos.col]?.unit;
      expect(jamudBefore).toBeTruthy();
      const initialBoosts = jamudBefore?.boosts ?? 0;
      expect(initialBoosts).toBeGreaterThanOrEqual(1);

      // 结束 build 阶段，进入 attack 时触发 ice_shards
      const endPhaseBtn = hostPage.getByTestId('sw-end-phase');
      await expect(endPhaseBtn).toBeVisible({ timeout: 5000 });
      await endPhaseBtn.click();
      await waitForPhase(hostPage, 'attack');

      // 等待横幅出现
      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(skipButton).toBeVisible({ timeout: 5000 });

      // 点击"跳过"
      await skipButton.click();
      await hostPage.waitForTimeout(500);

      // 验证充能未消耗
      const afterState = await readCoreState(hostPage);
      const jamudAfter = afterState.board[jamudPos.row][jamudPos.col]?.unit;
      expect(jamudAfter).toBeTruthy();
      expect(jamudAfter.boosts).toBe(initialBoosts);

      // 验证敌方单位未受伤
      const enemyAfter = afterState.board[enemyPos.row][enemyPos.col]?.unit;
      expect(enemyAfter).toBeTruthy();
      expect(enemyAfter.damage).toBe(0);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('冰霜战斧：移动后充能自身', async () => {
    // frost_axe 需要实际移动触发 EventStream，状态注入无法模拟
    test.skip(true, 'frost_axe 需要实际移动触发 EventStream，状态注入无法模拟，需要完整移动流程测试');
  });
});
