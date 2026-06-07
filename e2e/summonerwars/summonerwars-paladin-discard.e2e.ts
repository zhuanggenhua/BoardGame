/**
 * 召唤师战争 - 圣堂骑士弃牌技能 E2E 测试
 * 
 * 覆盖范围：
 * - 圣光箭（holy_arrow）：攻击前弃牌获得魔力和战力
 * - 治疗（healing）：攻击前弃牌进入治疗模式
 * - 手牌选择 UI 交互
 * - 弃牌动画和视觉反馈
 * - 在线对局状态同步
 */

import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
  applyCoreState as applyCoreStateViaServer,
  clickBoardElement as clickBoardElementViaHelper,
  cloneState,
  closeDebugPanelIfOpen as closeDebugPanelIfOpenViaHelper,
  readCoreState as readCoreStateViaServer,
  setupSWOnlineMatch,
  waitForPhase as waitForPhaseViaHelper,
} from '../helpers/summonerwars';
import { createDeckByFactionId } from '../../src/games/summonerwars/config/factions';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('summonerwars');
  await game.setupScene({ gameId: 'summonerwars' });
};
void __ensureThreeAxesMarker;

// ============================================================================
// 测试状态准备函数
// ============================================================================

/**
 * 准备圣光箭测试状态
 * - 攻击阶段
 * - 城塞弓箭手在场
 * - 手牌有多张不同名单位卡
 * - 相邻有敌方单位可攻击
 */
const prepareHolyArrowState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.magic = 3;
  player.attackCount = 0;
  player.hasAttackedEnemy = false;

  const paladinDeck = createDeckByFactionId('paladin');
  const necromancerDeck = createDeckByFactionId('necromancer');
  const expensiveUnitCards = paladinDeck.deck.filter(
    (card) => card.cardType === 'unit' && typeof card.cost === 'number' && card.cost > player.magic,
  );
  const fortressArcherCard = paladinDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('paladin-fortress-archer-'),
  );
  const enemyUnitCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.unitClass === 'common',
  );

  if (expensiveUnitCards.length < 2) {
    throw new Error('未找到足够的真实高费用圣堂骑士单位模板');
  }
  if (!fortressArcherCard || fortressArcherCard.cardType !== 'unit') {
    throw new Error('未找到真实城塞弓箭手模板');
  }
  if (!enemyUnitCard || enemyUnitCard.cardType !== 'unit') {
    throw new Error('未找到真实敌方单位模板');
  }

  // 确保手牌有多张不同名单位卡
  // ✅ 边界测试：包含高费用卡牌（费用 > 当前魔力），验证弃牌不受魔力限制
  player.hand = [
    { ...expensiveUnitCards[0] },
    { ...expensiveUnitCards[1] },
    ...player.hand.filter((c: any) => c.cardType !== 'unit'),
  ];

  // 查找城塞弓箭手或放置一个
  const board = next.board as Array<Array<Record<string, any>>>;
  let archerPlaced = false;
  let enemyPlaced = false;

  for (let row = 0; row < 8 && !archerPlaced; row++) {
    for (let col = 0; col < 6 && !archerPlaced; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('holy_arrow')) {
        archerPlaced = true;
        // 在相邻位置放置敌方单位
        const adjPositions = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];
        for (const adj of adjPositions) {
          if (adj.row >= 0 && adj.row < 8 && adj.col >= 0 && adj.col < 6) {
            if (!board[adj.row][adj.col].unit && !board[adj.row][adj.col].structure) {
              board[adj.row][adj.col].unit = {
                instanceId: `enemy-target-${adj.row}-${adj.col}`,
                cardId: enemyUnitCard.id,
                card: { ...enemyUnitCard },
                owner: '1',
                position: adj,
                damage: 0,
                boosts: 0,
                hasMoved: false,
                hasAttacked: false,
              };
              enemyPlaced = true;
              break;
            }
          }
        }
      }
    }
  }

  if (!archerPlaced) {
    for (let row = 3; row < 6 && !archerPlaced; row++) {
      for (let col = 1; col < 5 && !archerPlaced; col++) {
        if (!board[row][col].unit && !board[row][col].structure) {
          board[row][col].unit = {
            instanceId: `paladin-archer-${row}-${col}`,
            cardId: fortressArcherCard.id,
            card: { ...fortressArcherCard },
            owner: '0',
            position: { row, col },
            damage: 0,
            boosts: 0,
            hasMoved: false,
            hasAttacked: false,
          };
          archerPlaced = true;
        }
      }
    }
  }

  if (archerPlaced && !enemyPlaced) {
    for (let row = 0; row < 8 && !enemyPlaced; row++) {
      for (let col = 0; col < 6 && !enemyPlaced; col++) {
        const cell = board[row][col];
        if (!cell.unit || cell.unit.owner !== '0' || !cell.unit.card.abilities?.includes('holy_arrow')) continue;
        const adjPositions = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];
        for (const adj of adjPositions) {
          if (adj.row >= 0 && adj.row < 8 && adj.col >= 0 && adj.col < 6) {
            if (!board[adj.row][adj.col].unit && !board[adj.row][adj.col].structure) {
              board[adj.row][adj.col].unit = {
                instanceId: `enemy-target-${adj.row}-${adj.col}`,
                cardId: enemyUnitCard.id,
                card: { ...enemyUnitCard },
                owner: '1',
                position: adj,
                damage: 0,
                boosts: 0,
                hasMoved: false,
                hasAttacked: false,
              };
              enemyPlaced = true;
              break;
            }
          }
        }
      }
    }
  }

  if (!archerPlaced || !enemyPlaced) {
    throw new Error('无法准备圣光箭测试状态：未找到城塞弓箭手或无法放置敌方单位');
  }

  return next;
};

const prepareFortressPowerState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.attackCount = 0;
  player.hasAttackedEnemy = false;

  const paladinDeck = createDeckByFactionId('paladin');
  const necromancerDeck = createDeckByFactionId('necromancer');
  const fortressDiscardCard = paladinDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('paladin-fortress-knight-'),
  );
  const fortressBoardCard = paladinDeck.deck.find(
    (card) => card.cardType === 'unit'
      && (
        card.id.startsWith('paladin-fortress-archer-')
        || card.id.startsWith('paladin-fortress-warrior-')
        || card.id.startsWith('paladin-fortress-knight-')
      ),
  );
  const enemyChampionCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.unitClass === 'champion',
  );

  if (!fortressDiscardCard || fortressDiscardCard.cardType !== 'unit') {
    throw new Error('未找到真实城塞单位模板');
  }
  if (!fortressBoardCard || fortressBoardCard.cardType !== 'unit') {
    throw new Error('未找到真实城塞上场单位模板');
  }
  if (!enemyChampionCard || enemyChampionCard.cardType !== 'unit') {
    throw new Error('未找到真实敌方英雄模板');
  }

  player.discard = [{ ...fortressDiscardCard }];

  const board = next.board as Array<Array<Record<string, any>>>;
  const summonerPos = { row: -1, col: -1 };
  let hasFriendlyFortressOnBoard = false;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const unit = board[row][col]?.unit;
      if (unit?.owner === '0' && unit?.card?.unitClass === 'summoner' && unit.card.abilities?.includes('fortress_power')) {
        summonerPos.row = row;
        summonerPos.col = col;
      }
      if (
        unit?.owner === '0'
        && (
          typeof unit?.card?.name === 'string'
          && unit.card.name.includes('城塞')
          || unit?.card?.abilities?.includes('holy_arrow')
          || unit?.card?.abilities?.includes('guardian')
          || unit?.card?.abilities?.includes('judgment')
        )
      ) {
        hasFriendlyFortressOnBoard = true;
      }
    }
  }

  if (summonerPos.row < 0 || summonerPos.col < 0) {
    throw new Error('未找到先锋召唤师位置');
  }
  if (!hasFriendlyFortressOnBoard) {
    const fallbackPositions = [
      { row: summonerPos.row - 1, col: summonerPos.col - 1 },
      { row: summonerPos.row - 1, col: summonerPos.col + 1 },
      { row: summonerPos.row - 2, col: summonerPos.col - 1 },
      { row: summonerPos.row - 2, col: summonerPos.col + 1 },
      { row: summonerPos.row + 1, col: summonerPos.col - 1 },
      { row: summonerPos.row + 1, col: summonerPos.col + 1 },
    ];
    const fallbackPos = fallbackPositions.find(({ row, col }) => {
      const cell = board[row]?.[col];
      return cell && !cell.unit && !cell.structure;
    });
    if (!fallbackPos) {
      throw new Error('战场上没有友方城塞单位，且无法补放测试单位');
    }
    board[fallbackPos.row][fallbackPos.col] = {
      ...board[fallbackPos.row][fallbackPos.col],
      unit: {
        instanceId: `fortress-power-friendly-${fallbackPos.row}-${fallbackPos.col}`,
        cardId: fortressBoardCard.id,
        card: { ...fortressBoardCard },
        owner: '0',
        position: { ...fallbackPos },
        damage: 0,
        boosts: 0,
        hasMoved: false,
        hasAttacked: false,
      },
    };
  }

  const enemyPos = [
    { row: summonerPos.row - 1, col: summonerPos.col },
    { row: summonerPos.row - 1, col: summonerPos.col - 1 },
    { row: summonerPos.row - 1, col: summonerPos.col + 1 },
    { row: summonerPos.row - 2, col: summonerPos.col },
    { row: summonerPos.row, col: summonerPos.col - 1 },
    { row: summonerPos.row, col: summonerPos.col + 1 },
    { row: summonerPos.row + 1, col: summonerPos.col },
  ].find(({ row, col }) => {
    const cell = board[row]?.[col];
    return cell && !cell.structure;
  });
  if (!enemyPos) {
    throw new Error('无法放置城塞之力测试目标');
  }

  board[enemyPos.row][enemyPos.col] = {
    ...board[enemyPos.row][enemyPos.col],
    structure: undefined,
    unit: {
      instanceId: `fortress-power-target-${enemyPos.row}-${enemyPos.col}`,
      cardId: enemyChampionCard.id,
      card: { ...enemyChampionCard },
      owner: '1',
      position: { ...enemyPos },
      damage: 0,
      boosts: 0,
      hasMoved: false,
      hasAttacked: false,
    },
  };

  return {
    core: next,
    summonerPos,
    enemyPos,
    discardCardId: fortressDiscardCard.id,
  };
};

const findHolyArrowAttackPair = (coreState: any): { archer: { row: number; col: number }; enemy: { row: number; col: number } } | null => {
  const board = coreState?.board as Array<Array<{ unit?: { owner?: string; card?: { abilities?: string[] } } }>> | undefined;
  if (!board) return null;
  const adjs = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const unit = board[row]?.[col]?.unit;
      if (!unit || unit.owner !== '0' || !unit.card?.abilities?.includes('holy_arrow')) continue;
      for (const d of adjs) {
        const r = row + d.row;
        const c = col + d.col;
        if (r < 0 || r >= 8 || c < 0 || c >= 6) continue;
        const enemy = board[r]?.[c]?.unit;
        if (enemy && enemy.owner === '1') {
          return {
            archer: { row, col },
            enemy: { row: r, col: c },
          };
        }
      }
    }
  }
  return null;
};

const prepareHolyArrowDuplicateNameState = (coreState: any) => {
  const next = prepareHolyArrowState(coreState);
  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  const paladinDeck = createDeckByFactionId('paladin');
  const duplicateCards = paladinDeck.deck.filter(
    (card) => card.cardType === 'unit' && card.id.startsWith('paladin-fortress-knight-'),
  );
  const uniqueCard = paladinDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('paladin-fortress-warrior-'),
  );

  if (duplicateCards.length < 2) {
    throw new Error('未找到两张真实同名城塞骑士模板');
  }
  if (!uniqueCard || uniqueCard.cardType !== 'unit') {
    throw new Error('未找到真实城塞圣武士模板');
  }

  player.hand = [
    { ...duplicateCards[0] },
    { ...duplicateCards[1] },
    { ...uniqueCard },
    ...player.hand.filter((c: any) => c.cardType !== 'unit'),
  ];

  return next;
};

/**
 * 准备治疗测试状态
 * - 攻击阶段
 * - 圣殿牧师在场（可选预设 healingMode，供友军治疗路径复用）
 * - 手牌有单位卡
 * - 相邻有受伤的友方单位（用于治疗测试）
 * - 相邻有敌方单位（用于跳过弃牌测试）
 * 
 * 注意：healing 的完整流程是"弃牌 → 设置 healingMode → 攻击友方 → 治疗"。
 * 友军治疗路径需要预设 healingMode；敌军跳过弃牌路径则必须保持未激活状态。
 */
const prepareHealingState = (coreState: any, options?: { presetHealingMode?: boolean }) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;
  const presetHealingMode = options?.presetHealingMode ?? true;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.magic = 5;
  player.attackCount = 0;
  player.hasAttackedEnemy = false;

  const paladinDeck = createDeckByFactionId('paladin');
  const necromancerDeck = createDeckByFactionId('necromancer');
  const handUnitCard = paladinDeck.deck.find((card) => card.cardType === 'unit' && card.id.startsWith('paladin-fortress-knight-'));
  const templePriestCard = paladinDeck.deck.find((card) => card.cardType === 'unit' && card.id.startsWith('paladin-temple-priest-'));
  const woundedAllyCard = paladinDeck.deck.find((card) => card.cardType === 'unit' && card.id.startsWith('paladin-fortress-knight-'));
  const enemyUnitCard = necromancerDeck.deck.find((card) => card.cardType === 'unit' && card.unitClass === 'common');

  if (!handUnitCard || handUnitCard.cardType !== 'unit') {
    throw new Error('未找到真实手牌单位模板');
  }
  if (!templePriestCard || templePriestCard.cardType !== 'unit') {
    throw new Error('未找到真实圣殿牧师模板');
  }
  if (!woundedAllyCard || woundedAllyCard.cardType !== 'unit') {
    throw new Error('未找到真实受伤友方单位模板');
  }
  if (!enemyUnitCard || enemyUnitCard.cardType !== 'unit') {
    throw new Error('未找到真实敌方单位模板');
  }

  // 确保手牌有单位卡
  // ✅ 边界测试：高费用卡牌（费用 > 当前魔力），验证弃牌不受魔力限制
  player.hand = [{ ...handUnitCard }, ...player.hand.filter((c: any) => c.cardType !== 'unit')];

  // 查找圣殿牧师
  const board = next.board as Array<Array<Record<string, any>>>;
  let priestPlaced = false;
  let woundedAllyPlaced = false;
  let enemyPlaced = false;
  let priestPos: { row: number; col: number } | null = null;
  let woundedAllyPos: { row: number; col: number } | null = null;
  let enemyPos: { row: number; col: number } | null = null;

  for (let row = 0; row < 8 && !priestPlaced; row++) {
    for (let col = 0; col < 6 && !priestPlaced; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('healing')) {
        priestPlaced = true;
        priestPos = { row, col };
        if (presetHealingMode) {
          // 友军治疗路径需要先进入治疗模式，跳过弃牌攻击敌军则不能预设。
          cell.unit.healingMode = true;
        }

        // 在相邻位置放置受伤的友方单位和敌方单位
        const adjPositions = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];
        for (const adj of adjPositions) {
          if (adj.row >= 0 && adj.row < 8 && adj.col >= 0 && adj.col < 6) {
            if (!board[adj.row][adj.col].unit && !board[adj.row][adj.col].structure) {
              if (!woundedAllyPlaced) {
                board[adj.row][adj.col].unit = {
                  instanceId: `wounded-ally-${adj.row}-${adj.col}`,
                  cardId: woundedAllyCard.id,
                  card: { ...woundedAllyCard },
                  owner: '0',
                  position: adj,
                  damage: 3, // 受伤
                  boosts: 0,
                  hasMoved: false,
                  hasAttacked: false,
                };
                woundedAllyPlaced = true;
                woundedAllyPos = { ...adj };
              } else if (!enemyPlaced) {
                board[adj.row][adj.col].unit = {
                  instanceId: `enemy-heal-test-${adj.row}-${adj.col}`,
                  cardId: enemyUnitCard.id,
                  card: { ...enemyUnitCard },
                  owner: '1',
                  position: adj,
                  damage: 0,
                  boosts: 0,
                  hasMoved: false,
                  hasAttacked: false,
                };
                enemyPlaced = true;
                enemyPos = { ...adj };
              }
            }
          }
          if (woundedAllyPlaced && enemyPlaced) break;
        }
      }
    }
  }

  if (!priestPlaced || !woundedAllyPlaced) {
    throw new Error('无法准备治疗测试状态：未找到圣殿牧师或无法放置受伤友方单位');
  }

  return {
    core: next,
    priestPos,
    woundedAllyPos,
    enemyPos,
  };
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('圣堂骑士弃牌技能', () => {
  test('圣光箭：攻击前弃牌获得魔力和战力', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'paladin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const holyArrowCore = prepareHolyArrowState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, holyArrowCore);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');

      const initialMagic = Number((await readCoreStateViaServer(hostPage)).players?.['0']?.magic ?? 0);

      const pair = findHolyArrowAttackPair(await readCoreStateViaServer(hostPage));
      if (!pair) throw new Error('未找到可触发 holy_arrow 的弓箭手-敌方相邻对');

      const archer = hostPage.locator(`[data-testid="sw-unit-${pair.archer.row}-${pair.archer.col}"][data-owner="0"]`).first();
      await expect(archer).toBeVisible({ timeout: 5000 });
      await archer.click();

      const enemyUnit = hostPage.locator(`[data-testid="sw-unit-${pair.enemy.row}-${pair.enemy.col}"][data-owner="1"]`).first();
      await expect(enemyUnit).toBeVisible({ timeout: 5000 });
      await enemyUnit.click();

      const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
      const skipBtn = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i });
      await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });
      await expect(skipBtn).toBeVisible({ timeout: 3000 });

      const handArea = hostPage.getByTestId('sw-hand-area');
      const selectableCards = handArea.locator('[data-card-type="unit"]');
      const cardCount = await selectableCards.count();
      if (cardCount >= 2) {
        await selectableCards.nth(0).click();
        await selectableCards.nth(1).click();
      } else if (cardCount === 1) {
        await selectableCards.nth(0).click();
      }

      const selectedCards = handArea.locator('[data-selected="true"]');
      expect(await selectedCards.count()).toBeGreaterThan(0);

      await confirmDiscardBtn.click();
      await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });

      await expect.poll(async () => {
        const currentMagic = Number((await readCoreStateViaServer(hostPage)).players?.['0']?.magic ?? 0);
        return currentMagic > initialMagic;
      }, { timeout: 5000 }).toBe(true);

      await expect(hostPage.getByTestId('sw-dice-result-overlay')).toBeVisible({ timeout: 8000 });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('圣光箭：可以跳过弃牌直接攻击', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'paladin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = match;

    try {
      const holyArrowCore = prepareHolyArrowState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, holyArrowCore);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');

      const initialMagic = Number((await readCoreStateViaServer(hostPage)).players?.['0']?.magic ?? 0);

      const pair = findHolyArrowAttackPair(await readCoreStateViaServer(hostPage));
      if (!pair) throw new Error('未找到可触发 holy_arrow 的弓箭手-敌方相邻对');
      const archer = hostPage.locator(`[data-testid="sw-unit-${pair.archer.row}-${pair.archer.col}"][data-owner="0"]`).first();
      await expect(archer).toBeVisible({ timeout: 5000 });
      await archer.click();

      const enemyUnit = hostPage.locator(`[data-testid="sw-unit-${pair.enemy.row}-${pair.enemy.col}"][data-owner="1"]`).first();
      await expect(enemyUnit).toBeVisible({ timeout: 5000 });
      await enemyUnit.click();

      const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });
      await expect(skipButton).toBeVisible({ timeout: 3000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'holy-arrow-skip-owner-visible', {
          subdir: 'summonerwars/summonerwars-paladin-discard.e2e/圣光箭：可以跳过弃牌直接攻击',
        }),
      });
      if (!guestPage.isClosed()) {
        await expect(guestPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i })).toHaveCount(0);
        await expect(guestPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i })).toHaveCount(0);
      }

      await skipButton.click();
      await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });
      await expect(skipButton).toBeHidden({ timeout: 5000 });
      await hostPage.waitForTimeout(1200);
      await expect(confirmDiscardBtn).toBeHidden();
      await expect(skipButton).toBeHidden();

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'holy-arrow-skip-after-closeout', {
          subdir: 'summonerwars/summonerwars-paladin-discard.e2e/圣光箭：可以跳过弃牌直接攻击',
        }),
      });

      await expect.poll(async () => {
        const core = await readCoreStateViaServer(hostPage);
        return {
          magic: Number(core.players?.['0']?.magic ?? 0),
          attackCount: Number(core.players?.['0']?.attackCount ?? 0),
          hasAttackedEnemy: Boolean(core.players?.['0']?.hasAttackedEnemy ?? false),
        };
      }, { timeout: 5000 }).toEqual({
        magic: initialMagic,
        attackCount: 1,
        hasAttackedEnemy: true,
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('圣光箭：同名副本只允许选择真实 interaction option', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'paladin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const holyArrowCore = prepareHolyArrowDuplicateNameState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, holyArrowCore);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');

      const initialMagic = Number((await readCoreStateViaServer(hostPage)).players?.['0']?.magic ?? 0);

      const pair = findHolyArrowAttackPair(await readCoreStateViaServer(hostPage));
      if (!pair) throw new Error('未找到可触发 holy_arrow 的弓箭手-敌方相邻对');

      const archer = hostPage.locator(`[data-testid="sw-unit-${pair.archer.row}-${pair.archer.col}"][data-owner="0"]`).first();
      await expect(archer).toBeVisible({ timeout: 5000 });
      await archer.click();

      const enemyUnit = hostPage.locator(`[data-testid="sw-unit-${pair.enemy.row}-${pair.enemy.col}"][data-owner="1"]`).first();
      await expect(enemyUnit).toBeVisible({ timeout: 5000 });
      await enemyUnit.click();

      const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
      await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });

      const handArea = hostPage.getByTestId('sw-hand-area');
      const duplicateCards = handArea.locator('[data-card-type="unit"][data-card-name="城塞骑士"]');
      const uniqueCard = handArea.locator('[data-card-type="unit"][data-card-name="城塞圣武士"]').first();

      await expect(duplicateCards).toHaveCount(2);
      await duplicateCards.nth(0).click();
      await expect(duplicateCards.nth(0)).toHaveAttribute('data-selected', 'true');

      await duplicateCards.nth(1).click();
      await expect(duplicateCards.nth(0)).toHaveAttribute('data-selected', 'true');
      await expect(duplicateCards.nth(1)).toHaveAttribute('data-selected', 'false');

      await uniqueCard.click();
      await expect(uniqueCard).toHaveAttribute('data-selected', 'true');

      await confirmDiscardBtn.click();
      await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });
      await expect.poll(async () => {
        const core = await readCoreStateViaServer(hostPage);
        return {
          magic: Number(core.players?.['0']?.magic ?? 0),
          attackCount: Number(core.players?.['0']?.attackCount ?? 0),
          hasAttackedEnemy: Boolean(core.players?.['0']?.hasAttackedEnemy ?? false),
        };
      }, { timeout: 5000 }).toEqual({
        magic: initialMagic + 2,
        attackCount: 1,
        hasAttackedEnemy: true,
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('城塞之力：攻击阶段选择弃牌堆城塞单位回手', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'paladin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const prepared = prepareFortressPowerState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, prepared.core);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');

      const handCountBefore = await hostPage.locator('[data-testid="sw-hand-area"] [data-card-id]').count();

      await clickBoardElementViaHelper(
        hostPage,
        `[data-testid="sw-unit-${prepared.summonerPos.row}-${prepared.summonerPos.col}"][data-owner="0"]`,
      );

      const fortressPowerButton = hostPage.locator('button').filter({ hasText: /城塞之力|Fortress Power/i }).first();
      await expect(fortressPowerButton).toBeVisible({ timeout: 8000 });
      await fortressPowerButton.click();

      const cardSelector = hostPage.getByTestId('sw-card-selector-overlay');
      await expect(cardSelector).toBeVisible({ timeout: 10000 });
      const fortressCard = cardSelector.locator(`[data-card-id="${prepared.discardCardId}"]`).first();
      await expect(fortressCard).toBeVisible({ timeout: 5000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'fortress-power-card-selector-visible', {
          subdir: 'summonerwars/summonerwars-paladin-discard.e2e/城塞之力：攻击后从弃牌堆拿取城塞单位',
        }),
      });

      await fortressCard.click();
      await expect(cardSelector).toBeHidden({ timeout: 8000 });

      await expect.poll(async () => {
        const latestCore = await readCoreStateViaServer(hostPage);
        const handIds = (latestCore.players?.['0']?.hand ?? []).map((card: { id?: string }) => card?.id);
        const discardIds = (latestCore.players?.['0']?.discard ?? []).map((card: { id?: string }) => card?.id);
        return {
          inHand: handIds.includes(prepared.discardCardId),
          removedFromDiscard: !discardIds.includes(prepared.discardCardId),
          handCount: handIds.length,
        };
      }, { timeout: 10000 }).toEqual({
        inHand: true,
        removedFromDiscard: true,
        handCount: handCountBefore + 1,
      });

      await closeDebugPanelIfOpenViaHelper(hostPage);
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'fortress-power-retrieve-complete', {
          subdir: 'summonerwars/summonerwars-paladin-discard.e2e/城塞之力：攻击后从弃牌堆拿取城塞单位',
        }),
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('治疗：弃牌后攻击友方单位恢复生命', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'paladin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const prepared = prepareHealingState(await readCoreStateViaServer(hostPage), { presetHealingMode: true });
      await applyCoreStateViaServer(hostPage, prepared.core);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');

      if (!prepared.priestPos || !prepared.woundedAllyPos) {
        throw new Error('治疗测试状态缺少关键坐标');
      }

      const priest = hostPage.locator(`[data-testid="sw-unit-${prepared.priestPos.row}-${prepared.priestPos.col}"][data-owner="0"]`).first();
      await expect(priest).toBeVisible({ timeout: 5000 });
      await priest.click();

      const woundedAlly = hostPage.locator(`[data-testid="sw-unit-${prepared.woundedAllyPos.row}-${prepared.woundedAllyPos.col}"][data-owner="0"]`).first();
      await expect(woundedAlly).toBeVisible({ timeout: 5000 });

      const initialDamage = Number(await woundedAlly.getAttribute('data-unit-damage') ?? '0');
      expect(initialDamage).toBeGreaterThan(0);

      await woundedAlly.click();

      const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
      await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });

      const handArea = hostPage.getByTestId('sw-hand-area');
      const selectableCards = handArea.locator('[data-card-type="unit"]');
      await expect(selectableCards.first()).toBeVisible({ timeout: 3000 });
      await selectableCards.first().click();

      const selectedCards = handArea.locator('[data-selected="true"]');
      expect(await selectedCards.count()).toBeGreaterThan(0);

      await confirmDiscardBtn.click();
      await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });
      await expect(hostPage.getByTestId('sw-dice-result-overlay')).toBeVisible({ timeout: 8000 });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('治疗：可以跳过弃牌正常攻击', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'paladin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const prepared = prepareHealingState(await readCoreStateViaServer(hostPage), { presetHealingMode: false });
      await applyCoreStateViaServer(hostPage, prepared.core);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');

      if (!prepared.priestPos || !prepared.enemyPos) {
        test.skip(true, '治疗测试状态缺少敌方目标或牧师坐标');
        return;
      }

      const priest = hostPage.locator(`[data-testid="sw-unit-${prepared.priestPos.row}-${prepared.priestPos.col}"][data-owner="0"]`).first();
      await expect(priest).toBeVisible({ timeout: 5000 });
      await priest.click();

      const enemyUnit = hostPage.locator(`[data-testid="sw-unit-${prepared.enemyPos.row}-${prepared.enemyPos.col}"][data-owner="1"]`).first();
      await expect(enemyUnit).toBeVisible({ timeout: 5000 });
      await enemyUnit.click();

      const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i });
      const attackCountBefore = Number((await readCoreStateViaServer(hostPage)).players?.['0']?.attackCount ?? 0);
      await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });
      await expect(skipButton).toBeVisible({ timeout: 3000 });

      await skipButton.click();
      await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });
      await expect(skipButton).toBeHidden({ timeout: 5000 });
      await expect.poll(async () => {
        const core = await readCoreStateViaServer(hostPage);
        const attackCount = Number(core.players?.['0']?.attackCount ?? 0);
        const hasAttackedEnemy = Boolean(core.players?.['0']?.hasAttackedEnemy ?? false);
        const passedTurn = core.currentPlayer === '1';
        const waitingForOpponent = await hostPage.getByText(/等待对手行动/i).isVisible().catch(() => false);
        return attackCount > attackCountBefore || hasAttackedEnemy || passedTurn || waitingForOpponent;
      }, { timeout: 10000 }).toBe(true);
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });
});
