/**
 * 召唤师战争 - 炽原精灵阵营特色交互 E2E 测试
 * 
 * 覆盖范围：
 * - 预备（prepare）：充能代替移动（按钮激活）
 * - 祖灵交流（spirit_bond）：移动后充能自身 或 消耗充能给友方
 * - 撤退（withdraw）：攻击后消耗充能/魔力推拉自身
 */

import { test, expect } from '@playwright/test';
import {
  setupSWOnlineMatch,
  readCoreState,
  applyCoreState,
  clickBoardElement,
  closeDebugPanelIfOpen,
  waitForPhase,
  cloneState,
} from '../helpers/summonerwars';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { isCellEmpty, isValidCoord } from '../../src/games/summonerwars/domain/helpers';

// ============================================================================
// 测试状态准备函数
// ============================================================================

const preparePrepareState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.phase = 'move';
  next.selectedUnit = undefined;
  next.abilityUsage = {};
  if (next.players?.['0']) {
    next.players['0'].moveCount = 0;
  }
  const board = next.board;
  let prepareUnitPos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('prepare')) {
        cell.unit.hasMoved = false;
        cell.unit.hasAttacked = false;
        prepareUnitPos = { row, col };
        break;
      }
    }
    if (prepareUnitPos) break;
  }
  if (!prepareUnitPos) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        if (!board[row][col].unit && !board[row][col].structure) {
          board[row][col].unit = {
            instanceId: `barbaric-ranger-test-${row}-${col}`, cardId: 'barbaric-ranger-test',
            card: { id: 'barbaric-ranger', cardType: 'unit', name: '边境弓箭手', faction: 'barbaric',
              cost: 1, life: 2, strength: 2, attackType: 'ranged', attackRange: 3,
              unitClass: 'common', deckSymbols: [], abilities: ['prepare', 'rapid_fire'] },
            owner: '0', position: { row, col }, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
          };
          prepareUnitPos = { row, col };
          break;
        }
      }
      if (prepareUnitPos) break;
    }
  }
  if (!prepareUnitPos) throw new Error('无法放置有 prepare 技能的单位');
  return { state: next, prepareUnitPos };
};

const prepareWithdrawState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.phase = 'attack';
  next.selectedUnit = undefined;
  next.abilityUsage = {};
  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.magic = 3;
  player.attackCount = 0;
  const board = next.board;
  let kairuPos: { row: number; col: number } | null = null;
  let emptyPos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('withdraw')) {
        cell.unit.boosts = 2;
        kairuPos = { row, col };
        break;
      }
    }
    if (kairuPos) break;
  }
  if (!kairuPos) {
    for (let row = 2; row < 5; row++) {
      for (let col = 1; col < 5; col++) {
        if (!board[row][col].unit && !board[row][col].structure) {
          board[row][col].unit = {
            instanceId: `barbaric-kairu-test-${row}-${col}`, cardId: 'barbaric-kairu-test',
            card: { id: 'barbaric-kairu', cardType: 'unit', name: '凯鲁尊者', faction: 'barbaric',
              cost: 5, life: 7, strength: 3, attackType: 'melee', attackRange: 1,
              unitClass: 'champion', deckSymbols: [], abilities: ['inspire', 'withdraw'] },
            owner: '0', position: { row, col }, damage: 0, boosts: 2, hasMoved: false, hasAttacked: false,
          };
          kairuPos = { row, col };
          break;
        }
      }
      if (kairuPos) break;
    }
  }
  if (!kairuPos) throw new Error('无法放置凯鲁尊者');
  const retreatPositions = [
    { row: kairuPos.row - 1, col: kairuPos.col }, { row: kairuPos.row + 1, col: kairuPos.col },
    { row: kairuPos.row, col: kairuPos.col - 1 }, { row: kairuPos.row, col: kairuPos.col + 1 },
  ];
  for (const pos of retreatPositions) {
    if (pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 6) {
      if (!board[pos.row][pos.col].unit && !board[pos.row][pos.col].structure) {
        emptyPos = pos; break;
      }
    }
  }
  if (!emptyPos) {
    for (const pos of retreatPositions) {
      if (pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 6) {
        if (board[pos.row][pos.col].unit && board[pos.row][pos.col].unit.owner === '0'
            && board[pos.row][pos.col].unit.card.unitClass !== 'summoner') {
          board[pos.row][pos.col].unit = null;
          emptyPos = pos; break;
        }
      }
    }
  }
  if (!emptyPos) throw new Error('无法为凯鲁尊者找到撤退空位');
  return { state: next, kairuPos, emptyPos };
};

const getWithdrawTargets = (core: any, sourcePosition: { row: number; col: number }) => {
  const result: { row: number; col: number }[] = [];
  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  for (const { dr, dc } of dirs) {
    for (let step = 1; step <= 2; step++) {
      const pos = { row: sourcePosition.row + dr * step, col: sourcePosition.col + dc * step };
      if (!isValidCoord(pos) || !isCellEmpty(core, pos)) break;
      result.push(pos);
    }
  }
  return result;
};

const prepareChantOfWeavingState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.phase = 'summon';
  next.selectedUnit = undefined;
  next.abilityUsage = {};
  if (next.players?.['0']) {
    next.players['0'].magic = 3;
    next.players['0'].moveCount = 0;
    next.players['0'].attackCount = 0;
    next.players['0'].hand = [{
      id: 'barbaric-chant-of-weaving-e2e',
      cardType: 'event',
      name: '编织颂歌',
      faction: 'barbaric',
      eventType: 'common',
      playPhase: 'summon',
      cost: 0,
      isActive: true,
      effect: '可在目标相邻召唤，召唤时充能目标。',
      deckSymbols: [],
    }];
  }

  const board = next.board;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      board[row][col].unit = null;
      board[row][col].structure = null;
    }
  }

  board[6][2].unit = {
    instanceId: 'chant-weaving-my-summoner',
    cardId: 'chant-weaving-my-summoner-card',
    card: {
      id: 'barbaric-summoner',
      cardType: 'unit',
      name: '阿布亚·石',
      faction: 'barbaric',
      cost: 0,
      life: 10,
      strength: 5,
      attackType: 'ranged',
      attackRange: 3,
      unitClass: 'summoner',
      deckSymbols: [],
      abilities: ['ancestral_bond'],
    },
    owner: '0',
    position: { row: 6, col: 2 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[1][3].unit = {
    instanceId: 'chant-weaving-enemy-summoner',
    cardId: 'chant-weaving-enemy-summoner-card',
    card: {
      id: 'necro-summoner',
      cardType: 'unit',
      name: '亡灵召唤师',
      faction: 'necromancer',
      cost: 0,
      life: 10,
      strength: 4,
      attackType: 'ranged',
      attackRange: 3,
      unitClass: 'summoner',
      deckSymbols: [],
      abilities: [],
    },
    owner: '1',
    position: { row: 1, col: 3 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  const targetPos = { row: 4, col: 3 };
  board[targetPos.row][targetPos.col].unit = {
    instanceId: 'chant-weaving-target',
    cardId: 'chant-weaving-target-card',
    card: {
      id: 'barbaric-lioness',
      cardType: 'unit',
      name: '雌狮',
      faction: 'barbaric',
      cost: 2,
      life: 2,
      strength: 3,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'common',
      deckSymbols: [],
      abilities: ['intimidate', 'life_up'],
    },
    owner: '0',
    position: targetPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return { state: next, targetPos };
};

const prepareChantOfPowerAttackState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.phase = 'attack';
  next.selectedUnit = undefined;
  next.abilityUsage = {};
  if (next.players?.['0']) {
    next.players['0'].magic = 3;
    next.players['0'].moveCount = 0;
    next.players['0'].attackCount = 0;
    next.players['0'].hand = [{
      id: 'barbaric-chant-of-power-0-99',
      cardType: 'event',
      name: '力量颂歌',
      faction: 'barbaric',
      eventType: 'legendary',
      playPhase: 'attack',
      cost: 1,
      isActive: false,
      effect: '目标获得力量强化直到回合结束。',
      deckSymbols: [],
    }];
  }

  const board = next.board;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      board[row][col].unit = null;
      board[row][col].structure = null;
    }
  }

  const mySummonerPos = { row: 6, col: 2 };
  const targetPos = { row: 4, col: 2 }; // 距离召唤师2格，满足力量颂歌目标范围

  board[mySummonerPos.row][mySummonerPos.col].unit = {
    instanceId: 'chant-power-my-summoner',
    cardId: 'chant-power-my-summoner-card',
    card: {
      id: 'barbaric-summoner',
      cardType: 'unit',
      name: '阿布亚·石',
      faction: 'barbaric',
      cost: 0,
      life: 10,
      strength: 5,
      attackType: 'ranged',
      attackRange: 3,
      unitClass: 'summoner',
      deckSymbols: [],
      abilities: ['ancestral_bond'],
    },
    owner: '0',
    position: mySummonerPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[targetPos.row][targetPos.col].unit = {
    instanceId: 'chant-power-target',
    cardId: 'chant-power-target-card',
    card: {
      id: 'barbaric-common-target',
      cardType: 'unit',
      name: '炽原战士',
      faction: 'barbaric',
      cost: 1,
      life: 2,
      strength: 2,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'common',
      deckSymbols: [],
      abilities: [],
    },
    owner: '0',
    position: targetPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[1][3].unit = {
    instanceId: 'chant-power-enemy-summoner',
    cardId: 'chant-power-enemy-summoner-card',
    card: {
      id: 'necro-summoner',
      cardType: 'unit',
      name: '亡灵召唤师',
      faction: 'necromancer',
      cost: 0,
      life: 10,
      strength: 4,
      attackType: 'ranged',
      attackRange: 3,
      unitClass: 'summoner',
      deckSymbols: [],
      abilities: [],
    },
    owner: '1',
    position: { row: 1, col: 3 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return { state: next, targetPos };
};

const prepareAncestralBondMoveState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.phase = 'move';
  next.selectedUnit = undefined;
  next.abilityUsage = {};
  if (next.players?.['0']) {
    next.players['0'].magic = 3;
    next.players['0'].moveCount = 0;
    next.players['0'].attackCount = 0;
  }

  const board = next.board;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      board[row][col].unit = null;
      board[row][col].structure = null;
    }
  }

  const summonerStart = { row: 6, col: 2 };
  const summonerMoveTo = { row: 5, col: 2 };
  const allyTargetPos = { row: 4, col: 3 };

  board[summonerStart.row][summonerStart.col].unit = {
    instanceId: 'ancestral-bond-my-summoner',
    cardId: 'ancestral-bond-my-summoner-card',
    card: {
      id: 'barbaric-summoner',
      cardType: 'unit',
      name: '阿布亚·石',
      faction: 'barbaric',
      cost: 0,
      life: 10,
      strength: 5,
      attackType: 'ranged',
      attackRange: 3,
      unitClass: 'summoner',
      deckSymbols: [],
      abilities: ['ancestral_bond'],
    },
    owner: '0',
    position: summonerStart,
    damage: 0,
    boosts: 2,
    hasMoved: false,
    hasAttacked: false,
  };

  board[allyTargetPos.row][allyTargetPos.col].unit = {
    instanceId: 'ancestral-bond-ally-target',
    cardId: 'ancestral-bond-ally-target-card',
    card: {
      id: 'barbaric-common-target',
      cardType: 'unit',
      name: '炽原战士',
      faction: 'barbaric',
      cost: 1,
      life: 2,
      strength: 2,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'common',
      deckSymbols: [],
      abilities: [],
    },
    owner: '0',
    position: allyTargetPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[1][3].unit = {
    instanceId: 'ancestral-bond-enemy-summoner',
    cardId: 'ancestral-bond-enemy-summoner-card',
    card: {
      id: 'necro-summoner',
      cardType: 'unit',
      name: '亡灵召唤师',
      faction: 'necromancer',
      cost: 0,
      life: 10,
      strength: 4,
      attackType: 'ranged',
      attackRange: 3,
      unitClass: 'summoner',
      deckSymbols: [],
      abilities: [],
    },
    owner: '1',
    position: { row: 1, col: 3 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return { state: next, summonerStart, summonerMoveTo, allyTargetPos };
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('炽原精灵阵营特色交互', () => {

  test('预备：充能代替移动', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: prepareCore, prepareUnitPos } = preparePrepareState(coreState);
      await applyCoreState(hostPage, prepareCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');
      await hostPage.waitForTimeout(500);
      const beforeState = await readCoreState(hostPage);
      const unitBefore = beforeState.board[prepareUnitPos.row][prepareUnitPos.col]?.unit;
      const initialBoosts = unitBefore?.boosts ?? 0;
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepareUnitPos.row}-${prepareUnitPos.col}"][data-owner="0"]`);
      await hostPage.waitForTimeout(800);
      const prepareButton = hostPage.locator('button').filter({ hasText: /预备|Prepare/i });
      await expect(prepareButton).toBeVisible({ timeout: 8000 });
      await prepareButton.click();
      await hostPage.waitForTimeout(1500);
      const afterState = await readCoreState(hostPage);
      const unitAfter = afterState.board[prepareUnitPos.row][prepareUnitPos.col]?.unit;
      expect(unitAfter).toBeTruthy();
      expect(unitAfter.boosts).toBe(initialBoosts + 1);
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('祖灵交流：充能自身', async () => {
    test.skip(true, 'spirit_bond 需要实际移动触发 EventStream，状态注入无法模拟，需要完整移动流程测试');
  });

  test('祖灵羁绊：移动后可点击友方单位并完成充能转移', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: ancestralCore, summonerStart, summonerMoveTo, allyTargetPos } = prepareAncestralBondMoveState(coreState);
      await applyCoreState(hostPage, ancestralCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');
      await hostPage.waitForTimeout(600);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${summonerStart.row}-${summonerStart.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${summonerMoveTo.row}-${summonerMoveTo.col}"]`);
      await hostPage.waitForTimeout(800);

      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(skipButton).toBeVisible({ timeout: 8000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'ancestral-bond-before-target', {
          filename: 'ancestral-bond-before-target.png',
        }),
        fullPage: false,
      });

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${allyTargetPos.row}-${allyTargetPos.col}"][data-owner="0"]`);
      await hostPage.waitForTimeout(900);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const sourceUnit = state?.board?.[summonerMoveTo.row]?.[summonerMoveTo.col]?.unit;
        const targetUnit = state?.board?.[allyTargetPos.row]?.[allyTargetPos.col]?.unit;
        return (sourceUnit?.boosts ?? -1) === 0 && (targetUnit?.boosts ?? -1) === 3;
      }, { timeout: 10000 }).toBe(true);

      const skipAfterResolve = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(skipAfterResolve).toBeHidden({ timeout: 5000 });

      // 回归保护：交互收口后再次点击目标，不应继续重复触发祖灵羁绊
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${allyTargetPos.row}-${allyTargetPos.col}"][data-owner="0"]`);
      await hostPage.waitForTimeout(700);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const sourceUnit = state?.board?.[summonerMoveTo.row]?.[summonerMoveTo.col]?.unit;
        const targetUnit = state?.board?.[allyTargetPos.row]?.[allyTargetPos.col]?.unit;
        return (sourceUnit?.boosts ?? -1) === 0 && (targetUnit?.boosts ?? -1) === 3;
      }, { timeout: 10000 }).toBe(true);

      await closeDebugPanelIfOpen(hostPage);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'ancestral-bond-after-target', {
          filename: 'ancestral-bond-after-target.png',
        }),
        fullPage: false,
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('撤退：攻击后消耗充能移动', async ({ browser }, testInfo) => {
    test.setTimeout(300000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: withdrawCore, kairuPos } = prepareWithdrawState(coreState);
      await applyCoreState(hostPage, withdrawCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(500);
      // 验证凯鲁尊者存在且有充能
      const verifyState = await readCoreState(hostPage);
      const kairu = verifyState.board[kairuPos.row][kairuPos.col]?.unit;
      expect(kairu).toBeTruthy();
      expect(kairu.boosts).toBeGreaterThanOrEqual(1);
      expect(kairu.card.abilities).toContain('withdraw');
      // 在凯鲁尊者旁边放一个敌方单位，然后攻击它
      const kairuState = cloneState(verifyState);
      const adjPositions = [
        { row: kairuPos.row - 1, col: kairuPos.col }, { row: kairuPos.row + 1, col: kairuPos.col },
        { row: kairuPos.row, col: kairuPos.col - 1 }, { row: kairuPos.row, col: kairuPos.col + 1 },
      ];
      let enemyPos: { row: number; col: number } | null = null;
      for (const adj of adjPositions) {
        if (adj.row >= 0 && adj.row < 8 && adj.col >= 0 && adj.col < 6) {
          if (!kairuState.board[adj.row][adj.col].unit && !kairuState.board[adj.row][adj.col].structure) {
            kairuState.board[adj.row][adj.col].unit = {
              instanceId: `enemy-dummy-${adj.row}-${adj.col}`, cardId: 'necro-skeleton-dummy',
              card: { id: 'necro-skeleton', cardType: 'unit', name: '骷髅兵', faction: 'necromancer',
                cost: 0, life: 1, strength: 1, attackType: 'melee', attackRange: 1,
                unitClass: 'common', deckSymbols: [], abilities: [] },
              owner: '1', position: adj, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
            };
            enemyPos = adj;
            break;
          }
        }
      }
      if (!enemyPos) { test.skip(true, '无法在凯鲁尊者旁放置敌方单位'); return; }
      const withdrawTargets = getWithdrawTargets(kairuState, kairuPos);
      const withdrawPos = withdrawTargets[0];
      if (!withdrawPos) { test.skip(true, '无法为凯鲁尊者找到撤退目标'); return; }
      kairuState.selectedUnit = undefined;
      kairuState.players['0'].attackCount = 0;
      await applyCoreState(hostPage, kairuState);
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.waitForTimeout(500);
      // 选中凯鲁尊者
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${kairuPos.row}-${kairuPos.col}"][data-owner="0"]`);
      await hostPage.waitForTimeout(1000);
      // 点击敌方单位进行攻击
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyPos.row}-${enemyPos.col}"][data-owner="1"]`);
      console.log('[withdraw-e2e] 攻击命令已发出');
      // 攻击后必须先进入 withdraw 费用选择
      console.log('[withdraw-e2e] 开始等待 withdraw 费用按钮');
      await expect.poll(async () => {
        return await hostPage.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).some((button) =>
            /Spend Charge|消耗充能/i.test(button.textContent ?? '')
          );
        });
      }, { timeout: 15000 }).toBe(true);
      console.log('[withdraw-e2e] withdraw 费用横幅已出现');
      const clickedWithdrawCost = await hostPage.evaluate(() => {
        const button = Array.from(document.querySelectorAll('button')).find((node) =>
          /Spend Charge|消耗充能/i.test(node.textContent ?? '')
        ) as HTMLButtonElement | undefined;
        button?.click();
        return Boolean(button);
      });
      expect(clickedWithdrawCost).toBe(true);
      console.log('[withdraw-e2e] 已点击消耗充能');
      await expect.poll(async () => {
        return await hostPage.evaluate(() => {
          return document.body.textContent?.includes('撤退：选择移动目标位置') ?? false;
        });
      }, { timeout: 10000 }).toBe(true);
      const targetCell = hostPage.getByTestId(`sw-cell-${withdrawPos.row}-${withdrawPos.col}`);
      await expect(targetCell).toBeVisible({ timeout: 10000 });
      await expect.poll(async () => {
        return await targetCell.evaluate((node) => {
          const style = window.getComputedStyle(node as HTMLElement);
          return style.borderColor !== 'transparent' || style.backgroundColor !== 'transparent';
        });
      }, { timeout: 10000 }).toBe(true);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${withdrawPos.row}-${withdrawPos.col}"]`);
      console.log('[withdraw-e2e] 已点击撤退目标格');
      await expect.poll(async () => {
        return await hostPage.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).some((button) =>
            /Spend Charge|消耗充能/i.test(button.textContent ?? '')
          );
        });
      }, { timeout: 10000 }).toBe(false);
      await hostPage.waitForTimeout(1200);
      const afterWithdraw = await readCoreState(hostPage);
      const movedUnit = afterWithdraw.board[withdrawPos.row][withdrawPos.col]?.unit;
      expect(movedUnit?.instanceId).toBe(kairu.instanceId);
      expect(movedUnit?.boosts ?? 0).toBeLessThan(kairu.boosts ?? 0);
      expect(afterWithdraw.board[kairuPos.row][kairuPos.col]?.unit?.instanceId ?? null).not.toBe(kairu.instanceId);
      console.log('[withdraw-e2e] 核心状态已确认撤退成功');
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('编织颂歌：召唤阶段可正常打出且不会被交互忙碌提示误拦截', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: weavingCore } = prepareChantOfWeavingState(coreState);
      await applyCoreState(hostPage, weavingCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');
      await hostPage.waitForTimeout(600);

      const weavingCard = hostPage.getByTestId('sw-hand-area')
        .locator('[data-card-id="barbaric-chant-of-weaving-e2e"]')
        .first();
      await expect(weavingCard).toBeVisible({ timeout: 5000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'chant-weaving-before-play', {
          filename: 'chant-weaving-before-play.png',
        }),
        fullPage: false,
      });

      await weavingCard.click();
      await hostPage.waitForTimeout(500);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        return !!state?.players?.['0']?.activeEvents?.some((event: any) => event.id === 'barbaric-chant-of-weaving-e2e');
      }, { timeout: 10000 }).toBe(true);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        return !!state?.players?.['0']?.hand?.some((card: any) => card.id === 'barbaric-chant-of-weaving-e2e');
      }, { timeout: 10000 }).toBe(false);

      expect(await hostPage.getByText('请先完成当前操作').isVisible().catch(() => false)).toBe(false);
      await closeDebugPanelIfOpen(hostPage);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'chant-weaving-after-play', {
          filename: 'chant-weaving-after-play.png',
        }),
        fullPage: false,
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('力量颂歌：攻击阶段可打出并完成目标选择', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: chantPowerCore, targetPos } = prepareChantOfPowerAttackState(coreState);
      await applyCoreState(hostPage, chantPowerCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(600);

      const chantPowerCard = hostPage.getByTestId('sw-hand-area')
        .locator('[data-card-id="barbaric-chant-of-power-0-99"]')
        .first();
      await expect(chantPowerCard).toBeVisible({ timeout: 5000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'chant-power-before-play', {
          filename: 'chant-power-before-play.png',
        }),
        fullPage: false,
      });

      await chantPowerCard.click();
      await hostPage.waitForTimeout(500);

      // 进入 event_target 交互后，点击目标单位完成施放。
      // 当目标唯一时系统可能自动结算，手动点击应保持幂等。
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${targetPos.row}-${targetPos.col}"][data-owner="0"]`);
      await hostPage.waitForTimeout(800);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        return !!state?.players?.['0']?.hand?.some((card: any) => card.id === 'barbaric-chant-of-power-0-99');
      }, { timeout: 10000 }).toBe(false);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const targetUnit = state?.board?.[targetPos.row]?.[targetPos.col]?.unit;
        const tempAbilities = Array.isArray(targetUnit?.tempAbilities) ? targetUnit.tempAbilities : [];
        return tempAbilities.includes('power_up');
      }, { timeout: 10000 }).toBe(true);
      await closeDebugPanelIfOpen(hostPage);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'chant-power-after-play', {
          filename: 'chant-power-after-play.png',
        }),
        fullPage: false,
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });
});
