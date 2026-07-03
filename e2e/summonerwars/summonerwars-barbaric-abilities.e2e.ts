/**
 * 召唤师战争 - 炽原精灵阵营特色交互 E2E 测试
 * 
 * 覆盖范围：
 * - 预备（prepare）：充能代替移动（按钮激活）
 * - 祖灵交流（spirit_bond）：移动后充能自身 或 消耗充能给友方
 * - 撤退（withdraw）：攻击后消耗充能/魔力推拉自身
 */


import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
  setupSWOnlineMatch,
  readCoreState,
  applyCoreState,
  clickBoardElement,
  closeDebugPanelIfOpen,
  waitForPhase,
  waitForSummonerWarsUI,
  cloneState,
} from '../helpers/summonerwars';
import { getMatchState, type TestMatchAccess } from '../helpers/state-injection';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { isCellEmpty, isValidCoord } from '../../src/games/summonerwars/domain/helpers';
import { COMMON_UNITS_BARBARIC, SUMMONER_BARBARIC } from '../../src/games/summonerwars/config/factions/barbaric';
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

const cloneInjectedUnitCard = <T extends { abilities?: string[]; deckSymbols?: string[] }>(card: T): T => ({
  ...card,
  abilities: Array.isArray(card.abilities) ? [...card.abilities] : [],
  deckSymbols: Array.isArray(card.deckSymbols) ? [...card.deckSymbols] : [],
});

const spiritMageCard = COMMON_UNITS_BARBARIC.find((card) => card.id === 'barbaric-spirit-mage');
const frontierArcherCard = COMMON_UNITS_BARBARIC.find((card) => card.id === 'barbaric-frontier-archer');
const lionessCard = COMMON_UNITS_BARBARIC.find((card) => card.id === 'barbaric-lioness');
const necroWarriorCard = COMMON_UNITS_NECROMANCER.find((card) => card.id === 'necro-undead-warrior');
if (!spiritMageCard) {
  throw new Error('未找到炽原精灵祖灵法师配置（barbaric-spirit-mage）');
}
if (!frontierArcherCard) {
  throw new Error('未找到炽原精灵边境弓箭手配置（barbaric-frontier-archer）');
}
if (!lionessCard) {
  throw new Error('未找到炽原精灵雌狮配置（barbaric-lioness）');
}
if (!necroWarriorCard) {
  throw new Error('未找到亡灵战士配置（necro-undead-warrior）');
}

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

const dismissDiceResultOverlay = async (page: Page) => {
  const overlay = page.getByTestId('sw-dice-result-overlay');
  const visible = await overlay.isVisible().catch(() => false);
  if (!visible) return;
  await overlay.click({ force: true }).catch(() => {});
  await expect(overlay).toBeHidden({ timeout: 8000 });
};

const prepareRapidFireState = (coreState: any) => {
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
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      board[row][col].unit = null;
      board[row][col].structure = null;
    }
  }

  const archerPos = { row: 5, col: 2 };
  const enemyOnePos = { row: 5, col: 5 };
  const enemyTwoPos = { row: 2, col: 2 };
  const mySummonerPos = { row: 7, col: 2 };
  const enemySummonerPos = { row: 0, col: 2 };

  board[mySummonerPos.row][mySummonerPos.col].unit = {
    instanceId: 'rapid-fire-my-summoner',
    cardId: 'rapid-fire-my-summoner-card',
    card: cloneInjectedUnitCard(SUMMONER_BARBARIC),
    owner: '0',
    position: mySummonerPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[enemySummonerPos.row][enemySummonerPos.col].unit = {
    instanceId: 'rapid-fire-enemy-summoner',
    cardId: 'rapid-fire-enemy-summoner-card',
    card: cloneInjectedUnitCard(SUMMONER_NECROMANCER),
    owner: '1',
    position: enemySummonerPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[archerPos.row][archerPos.col].unit = {
    instanceId: 'rapid-fire-archer',
    cardId: frontierArcherCard.id,
    card: cloneInjectedUnitCard(frontierArcherCard),
    owner: '0',
    position: archerPos,
    damage: 0,
    boosts: 2,
    hasMoved: false,
    hasAttacked: false,
  };

  board[enemyOnePos.row][enemyOnePos.col].unit = {
    instanceId: 'rapid-fire-enemy-1',
    cardId: necroWarriorCard.id,
    card: { ...cloneInjectedUnitCard(necroWarriorCard), life: 8 },
    owner: '1',
    position: enemyOnePos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[enemyTwoPos.row][enemyTwoPos.col].unit = {
    instanceId: 'rapid-fire-enemy-2',
    cardId: necroWarriorCard.id,
    card: { ...cloneInjectedUnitCard(necroWarriorCard), life: 8 },
    owner: '1',
    position: enemyTwoPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return { state: next, archerPos, enemyOnePos, enemyTwoPos };
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

const readVisibleAbilityPromptText = async (page: Page) => page.evaluate(() => {
  const isVisible = (node: Element | null) => {
    if (!(node instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const overlayVisible = isVisible(document.querySelector('[data-testid="sw-dice-result-overlay"]'));
  if (overlayVisible) return '';
  const prompt = Array.from(document.querySelectorAll('[data-testid="sw-ability-prompt"]'))
    .find((node) => isVisible(node));
  if (!(prompt instanceof HTMLElement)) return '';
  return (prompt.innerText || prompt.textContent || '').trim();
}).catch(() => '');

const clickAbilityPromptButton = async (page: Page, pattern: string) => page.evaluate((patternSource) => {
  const isVisible = (node: Element | null) => {
    if (!(node instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const regex = new RegExp(patternSource, 'i');
  const prompt = Array.from(document.querySelectorAll('[data-testid="sw-ability-prompt"]'))
    .find((node) => isVisible(node));
  if (!(prompt instanceof HTMLElement)) {
    return { clicked: false, reason: 'prompt-not-visible', promptText: '' };
  }
  const button = Array.from(prompt.querySelectorAll('button'))
    .find((node) => regex.test(node.textContent ?? ''));
  if (!(button instanceof HTMLButtonElement)) {
    return { clicked: false, reason: 'button-not-found', promptText: prompt.innerText || prompt.textContent || '' };
  }
  if (button.disabled) {
    return { clicked: false, reason: 'button-disabled', promptText: prompt.innerText || prompt.textContent || '' };
  }
  button.click();
  return { clicked: true, reason: 'clicked', promptText: prompt.innerText || prompt.textContent || '' };
}, pattern).catch(() => ({ clicked: false, reason: 'page-evaluate-failed', promptText: '' }));

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

const prepareIntimidateState = (coreState: any) => {
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

  const lionessPos = { row: 5, col: 2 };
  const enemyPos = { row: 5, col: 3 };
  const mySummonerPos = { row: 7, col: 2 };
  const enemySummonerPos = { row: 0, col: 2 };

  board[mySummonerPos.row][mySummonerPos.col].unit = {
    instanceId: 'intimidate-my-summoner',
    cardId: 'intimidate-my-summoner-card',
    card: cloneInjectedUnitCard(SUMMONER_BARBARIC),
    owner: '0',
    position: mySummonerPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[enemySummonerPos.row][enemySummonerPos.col].unit = {
    instanceId: 'intimidate-enemy-summoner',
    cardId: 'intimidate-enemy-summoner-card',
    card: cloneInjectedUnitCard(SUMMONER_NECROMANCER),
    owner: '1',
    position: enemySummonerPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[lionessPos.row][lionessPos.col].unit = {
    instanceId: 'intimidate-lioness',
    cardId: lionessCard.id,
    card: cloneInjectedUnitCard(lionessCard),
    owner: '0',
    position: lionessPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[enemyPos.row][enemyPos.col].unit = {
    instanceId: 'intimidate-enemy-target',
    cardId: necroWarriorCard.id,
    card: { ...cloneInjectedUnitCard(necroWarriorCard), life: 8 },
    owner: '1',
    position: enemyPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return { state: next, lionessPos, enemyPos };
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

const prepareSpiritBondNoChargeMoveState = (coreState: any) => {
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

  const shamanStart = { row: 6, col: 2 };
  const shamanMoveTo = { row: 5, col: 2 };
  const allyTargetPos = { row: 4, col: 3 };
  const mySummonerPos = { row: 7, col: 2 };

  board[mySummonerPos.row][mySummonerPos.col].unit = {
    instanceId: 'spirit-bond-my-summoner',
    cardId: 'spirit-bond-my-summoner-card',
    card: cloneInjectedUnitCard(SUMMONER_BARBARIC),
    owner: '0',
    position: mySummonerPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[shamanStart.row][shamanStart.col].unit = {
    instanceId: 'spirit-bond-shaman',
    cardId: 'spirit-bond-shaman-card',
    card: cloneInjectedUnitCard(spiritMageCard),
    owner: '0',
    position: shamanStart,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[allyTargetPos.row][allyTargetPos.col].unit = {
    instanceId: 'spirit-bond-ally',
    cardId: 'spirit-bond-ally-card',
    card: cloneInjectedUnitCard(spiritMageCard),
    owner: '0',
    position: allyTargetPos,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[1][3].unit = {
    instanceId: 'spirit-bond-enemy-summoner',
    cardId: 'spirit-bond-enemy-summoner-card',
    card: cloneInjectedUnitCard(SUMMONER_NECROMANCER),
    owner: '1',
    position: { row: 1, col: 3 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return { state: next, shamanStart, shamanMoveTo, allyTargetPos };
};

const prepareSpiritBondTransferMoveState = (coreState: any) => {
  const prepared = prepareSpiritBondNoChargeMoveState(coreState);
  const shaman = prepared.state.board[prepared.shamanStart.row]?.[prepared.shamanStart.col]?.unit;
  if (!shaman) {
    throw new Error('未找到祖灵法师，无法准备 transfer 测试状态');
  }
  shaman.boosts = 1;
  return prepared;
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('炽原精灵阵营特色交互', () => {

  test('雌狮威势：攻击敌方单位后真实 UI 只显示一次充能', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: intimidateCore, lionessPos, enemyPos } = prepareIntimidateState(coreState);
      await applyCoreState(hostPage, intimidateCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(600);

      const lioness = hostPage.locator(`[data-testid="sw-unit-${lionessPos.row}-${lionessPos.col}"][data-owner="0"]`).first();
      await expect(lioness).toBeVisible({ timeout: 5000 });
      await expect(lioness.locator('.bg-blue-400')).toHaveCount(0);

      await lioness.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'intimidate-before-attack-no-charge', {
          filename: 'intimidate-before-attack-no-charge.png',
        }),
      });

      await setHarnessDiceValues(hostPage, [1, 1, 1]);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${lionessPos.row}-${lionessPos.col}"][data-owner="0"][data-unit-name="${lionessCard.name}"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyPos.row}-${enemyPos.col}"][data-owner="1"][data-unit-name="${necroWarriorCard.name}"]`);
      await dismissDiceResultOverlay(hostPage);

      const expectedIntimidateEvidence = {
        boosts: 1,
        attackCount: 1,
        hasAttacked: true,
      };

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const unit = state?.board?.[lionessPos.row]?.[lionessPos.col]?.unit;
        return {
          boosts: unit?.boosts ?? null,
          attackCount: state?.players?.['0']?.attackCount ?? null,
          hasAttacked: unit?.hasAttacked ?? null,
        };
      }, { timeout: 12000 }).toEqual(expectedIntimidateEvidence);

      await expect(lioness.locator('.bg-blue-400')).toHaveCount(1);
      await hostPage.waitForTimeout(1200);
      await expect(lioness.locator('.bg-blue-400')).toHaveCount(1);

      await closeDebugPanelIfOpen(hostPage);
      await lioness.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'intimidate-after-attack-one-charge', {
          filename: 'intimidate-after-attack-one-charge.png',
        }),
      });

      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSummonerWarsUI(hostPage, 30000);
      await closeDebugPanelIfOpen(hostPage);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const unit = state?.board?.[lionessPos.row]?.[lionessPos.col]?.unit;
        return {
          boosts: unit?.boosts ?? null,
          attackCount: state?.players?.['0']?.attackCount ?? null,
          hasAttacked: unit?.hasAttacked ?? null,
        };
      }, { timeout: 12000 }).toEqual(expectedIntimidateEvidence);

      const reloadedLioness = hostPage.locator(`[data-testid="sw-unit-${lionessPos.row}-${lionessPos.col}"][data-owner="0"]`).first();
      await expect(reloadedLioness).toBeVisible({ timeout: 5000 });
      await expect(reloadedLioness.locator('.bg-blue-400')).toHaveCount(1);
      await reloadedLioness.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'intimidate-after-reload-still-one-charge', {
          filename: 'intimidate-after-reload-still-one-charge.png',
        }),
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('预备：充能代替移动', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
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

  test('祖灵交流：无充能时不能给队友转移，只能充能自身', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: spiritBondCore, shamanStart, shamanMoveTo, allyTargetPos } =
        prepareSpiritBondNoChargeMoveState(coreState);
      await applyCoreState(hostPage, spiritBondCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');
      await hostPage.waitForTimeout(600);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${shamanStart.row}-${shamanStart.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${shamanMoveTo.row}-${shamanMoveTo.col}"]`);
      await hostPage.waitForTimeout(900);

      const chargeSelfButton = hostPage.locator('button').filter({ hasText: /Charge Self|充能自身/i }).first();
      await expect(chargeSelfButton).toBeVisible({ timeout: 8000 });
      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(skipButton).toBeVisible({ timeout: 8000 });
      await closeDebugPanelIfOpen(hostPage);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'spirit-bond-no-charge-before-click-ally', {
          filename: 'spirit-bond-no-charge-before-click-ally.png',
        }),
        fullPage: false,
      });
      const allyUnitBefore = hostPage.locator(`[data-testid="sw-unit-${allyTargetPos.row}-${allyTargetPos.col}"][data-owner="0"]`);
      await expect(allyUnitBefore).toBeVisible({ timeout: 5000 });
      await allyUnitBefore.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'spirit-bond-no-charge-before-click-ally-unit', {
          filename: 'spirit-bond-no-charge-before-click-ally-unit.png',
        }),
      });

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${allyTargetPos.row}-${allyTargetPos.col}"][data-owner="0"]`);
      await hostPage.waitForTimeout(900);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const shaman = state?.board?.[shamanMoveTo.row]?.[shamanMoveTo.col]?.unit;
        const ally = state?.board?.[allyTargetPos.row]?.[allyTargetPos.col]?.unit;
        return (shaman?.boosts ?? -1) === 0 && (ally?.boosts ?? -1) === 0;
      }, { timeout: 10000 }).toBe(true);

      await chargeSelfButton.click();
      await hostPage.waitForTimeout(900);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const shaman = state?.board?.[shamanMoveTo.row]?.[shamanMoveTo.col]?.unit;
        const ally = state?.board?.[allyTargetPos.row]?.[allyTargetPos.col]?.unit;
        return (shaman?.boosts ?? -1) === 1 && (ally?.boosts ?? -1) === 0;
      }, { timeout: 10000 }).toBe(true);

      const skipAfterResolve = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(skipAfterResolve).toBeHidden({ timeout: 6000 });
      await closeDebugPanelIfOpen(hostPage);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'spirit-bond-no-charge-after-charge-self', {
          filename: 'spirit-bond-no-charge-after-charge-self.png',
        }),
        fullPage: false,
      });
      const shamanUnitAfter = hostPage.locator(`[data-testid="sw-unit-${shamanMoveTo.row}-${shamanMoveTo.col}"][data-owner="0"]`);
      await expect(shamanUnitAfter).toBeVisible({ timeout: 5000 });
      await shamanUnitAfter.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'spirit-bond-no-charge-after-charge-self-shaman-unit', {
          filename: 'spirit-bond-no-charge-after-charge-self-shaman-unit.png',
        }),
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('祖灵交流：转移充能后不应再次弹出“只能充能自身”', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: spiritBondCore, shamanStart, shamanMoveTo, allyTargetPos } =
        prepareSpiritBondTransferMoveState(coreState);
      await applyCoreState(hostPage, spiritBondCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');
      await hostPage.waitForTimeout(600);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${shamanStart.row}-${shamanStart.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${shamanMoveTo.row}-${shamanMoveTo.col}"]`);
      await hostPage.waitForTimeout(900);

      const chargeSelfButton = hostPage.locator('button').filter({ hasText: /Charge Self|充能自身/i }).first();
      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(chargeSelfButton).toBeVisible({ timeout: 8000 });
      await expect(skipButton).toBeVisible({ timeout: 8000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'spirit-bond-transfer-before-target', {
          filename: 'spirit-bond-transfer-before-target.png',
        }),
        fullPage: false,
      });

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${allyTargetPos.row}-${allyTargetPos.col}"][data-owner="0"]`);
      await hostPage.waitForTimeout(900);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const shaman = state?.board?.[shamanMoveTo.row]?.[shamanMoveTo.col]?.unit;
        const ally = state?.board?.[allyTargetPos.row]?.[allyTargetPos.col]?.unit;
        return (shaman?.boosts ?? -1) === 0 && (ally?.boosts ?? -1) === 1;
      }, { timeout: 10000 }).toBe(true);

      await expect(skipButton).toBeHidden({ timeout: 6000 });
      await expect(chargeSelfButton).toBeHidden({ timeout: 6000 });

      // 回归保护：转移收口后不应再弹出第二轮 spirit_bond 选择。
      await hostPage.waitForTimeout(1500);
      await expect(skipButton).toBeHidden({ timeout: 4000 });
      await expect(chargeSelfButton).toBeHidden({ timeout: 4000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'spirit-bond-transfer-after-resolve', {
          filename: 'spirit-bond-transfer-after-resolve.png',
        }),
        fullPage: false,
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
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

  test('连续射击：攻击后确认消耗充能并完成额外攻击', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'barbaric', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: rapidFireCore, archerPos, enemyOnePos, enemyTwoPos } = prepareRapidFireState(coreState);
      await applyCoreState(hostPage, rapidFireCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(600);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${archerPos.row}-${archerPos.col}"][data-owner="0"][data-unit-name="${frontierArcherCard.name}"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyOnePos.row}-${enemyOnePos.col}"][data-owner="1"][data-unit-name="${necroWarriorCard.name}"]`);

      let rapidFirePromptText = '';
      await expect.poll(async () => {
        rapidFirePromptText = await readVisibleAbilityPromptText(hostPage);
        return rapidFirePromptText;
      }, { timeout: 12000 }).not.toBe('');
      expect(rapidFirePromptText).toMatch(/连续射击|Rapid Fire/i);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'rapid-fire-prompt-visible', {
          filename: 'rapid-fire-prompt-visible.png',
        }),
        fullPage: false,
      });

      const confirmResult = await clickAbilityPromptButton(hostPage, '^Confirm(?: Fire)?$|^确认(?:射击)?$');
      expect(confirmResult.clicked, `rapid_fire 确认点击失败: ${JSON.stringify(confirmResult)}`).toBe(true);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const archer = state?.board?.[archerPos.row]?.[archerPos.col]?.unit;
        return {
          boosts: archer?.boosts ?? null,
          extraAttacks: archer?.extraAttacks ?? 0,
          hasAttacked: archer?.hasAttacked ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        boosts: 1,
        extraAttacks: 1,
        hasAttacked: false,
      });

      let rapidFireSelectedUnit: { row: number; col: number } | null = null;
      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        rapidFireSelectedUnit = state?.selectedUnit ?? null;
        return rapidFireSelectedUnit;
      }, { timeout: 5000 }).not.toBeNull();
      if (
        rapidFireSelectedUnit.row !== archerPos.row
        || rapidFireSelectedUnit.col !== archerPos.col
      ) {
        await clickBoardElement(hostPage, `[data-testid="sw-unit-${archerPos.row}-${archerPos.col}"][data-owner="0"][data-unit-name="${frontierArcherCard.name}"]`);
      }
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyTwoPos.row}-${enemyTwoPos.col}"][data-owner="1"][data-unit-name="${necroWarriorCard.name}"]`);

      await dismissDiceResultOverlay(hostPage);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage);
        const archer = state?.board?.[archerPos.row]?.[archerPos.col]?.unit;
        return {
          attackCount: state?.players?.['0']?.attackCount ?? null,
          extraAttacks: archer?.extraAttacks ?? 0,
          hasAttacked: archer?.hasAttacked ?? null,
        };
      }, { timeout: 12000 }).toEqual({
        attackCount: 1,
        extraAttacks: 0,
        hasAttacked: true,
      });

      await expect.poll(async () => {
        const promptText = await readVisibleAbilityPromptText(hostPage);
        return /连续射击|Rapid Fire/i.test(promptText);
      }, { timeout: 5000 }).toBe(false);

      await closeDebugPanelIfOpen(hostPage);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'rapid-fire-extra-attack-complete', {
          filename: 'rapid-fire-extra-attack-complete.png',
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
    const { hostPage, guestPage, hostContext, guestContext, matchId } = match;
    try {
      browser.on('disconnected', () => {
        console.log('[WITHDRAW BROWSER DISCONNECTED]');
      });
      hostPage.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('[SW-ATTACK-DEBUG')) {
          console.log(`[WITHDRAW HOST ${msg.type().toUpperCase()}]`, msg.text());
        }
      });
      hostPage.on('dialog', async (dialog) => {
        console.log('[WITHDRAW HOST DIALOG]', dialog.type(), dialog.message());
        await dialog.dismiss().catch(() => {});
      });
      hostPage.on('crash', () => {
        console.log('[WITHDRAW HOST CRASH]');
      });
      hostPage.on('close', () => {
        console.log('[WITHDRAW HOST CLOSE]');
      });
      hostContext.on('close', () => {
        console.log('[WITHDRAW HOST CONTEXT CLOSE]');
      });
      guestPage.on('close', () => {
        console.log('[WITHDRAW GUEST CLOSE]');
      });
      guestContext.on('close', () => {
        console.log('[WITHDRAW GUEST CONTEXT CLOSE]');
      });
      await hostPage.evaluate(() => {
        window.localStorage.setItem('sw_attack_debug', '1');
        window.__SW_ATTACK_DEBUG__ = true;
      });
      const matchAccess = await hostPage.evaluate((targetMatchId) => {
        const params = new URLSearchParams(window.location.search);
        const playerId = params.get('playerID');
        const raw = localStorage.getItem(`match_creds_${targetMatchId}`);
        if (!playerId || !raw) return null;
        try {
          const parsed = JSON.parse(raw) as { credentials?: string };
          return typeof parsed.credentials === 'string'
            ? { playerId, credentials: parsed.credentials }
            : null;
        } catch {
          return null;
        }
      }, matchId) as TestMatchAccess | null;
      expect(matchAccess).toBeTruthy();

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
      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, undefined, matchAccess ?? undefined) as any;
        const serverKairu = serverState?.core?.board?.[kairuPos.row]?.[kairuPos.col]?.unit;
        const serverEnemy = serverState?.core?.board?.[enemyPos.row]?.[enemyPos.col]?.unit;
        return Boolean(serverKairu?.instanceId === kairu.instanceId && serverEnemy?.owner === '1');
      }, { timeout: 10000 }).toBe(true);
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.waitForTimeout(500);
      await setHarnessDiceValues(hostPage, [1, 1, 1]);
      // 选中凯鲁尊者
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${kairuPos.row}-${kairuPos.col}"][data-owner="0"]`);
      await hostPage.waitForTimeout(1000);
      // 点击敌方单位进行攻击
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyPos.row}-${enemyPos.col}"][data-owner="1"]`);
      console.log('[withdraw-e2e] 攻击命令已发出');

      console.log('[withdraw-e2e] 开始等待 withdraw 费用交互');
      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, undefined, matchAccess ?? undefined) as any;
        const serverType = serverState?.sys?.interaction?.current?.data?.sw?.type ?? null;
        console.log('[withdraw-e2e] server interaction type =', serverType);
        return serverType;
      }, { timeout: 15000 }).toBe('after_attack_withdraw_cost');
      console.log('[withdraw-e2e] 进入费用提示前 closed=', hostPage.isClosed(), 'contextPages=', hostContext.pages().length);
      console.log('[withdraw-e2e] guest 状态 closed=', guestPage.isClosed(), 'contextPages=', guestContext.pages().length);
      if (hostPage.isClosed()) {
        throw new Error(`withdraw 费用提示出现时 hostPage 已关闭，contextPages=${hostContext.pages().length}`);
      }
      let withdrawCostPromptText = '';
      await expect.poll(async () => {
        withdrawCostPromptText = await readVisibleAbilityPromptText(hostPage);
        return withdrawCostPromptText;
      }, { timeout: 10000 }).not.toBe('');
      console.log('[withdraw-e2e] 当前提示 =', withdrawCostPromptText);
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'withdraw-cost-visible', {
          filename: 'withdraw-cost-visible.png',
        }),
        fullPage: false,
      });
      const chargeClickResult = await clickAbilityPromptButton(hostPage, 'Spend Charge|消耗充能');
      expect(chargeClickResult.clicked, `withdraw 费用提示点击失败: ${JSON.stringify(chargeClickResult)}`).toBe(true);
      console.log('[withdraw-e2e] 已点击消耗充能');

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, undefined, matchAccess ?? undefined) as any;
        return serverState?.sys?.interaction?.current?.data?.sw?.type ?? null;
      }, { timeout: 10000 }).toBe('after_attack_withdraw_position');

      let withdrawPositionPromptText = '';
      await expect.poll(async () => {
        withdrawPositionPromptText = await readVisibleAbilityPromptText(hostPage);
        return withdrawPositionPromptText;
      }, { timeout: 10000 }).not.toBe('');
      console.log('[withdraw-e2e] 当前位置提示 =', withdrawPositionPromptText);
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'withdraw-position-visible', {
          filename: 'withdraw-position-visible.png',
        }),
        fullPage: false,
      });
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${withdrawPos.row}-${withdrawPos.col}"]`);
      console.log('[withdraw-e2e] 已点击撤退目标格');
      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, undefined, matchAccess ?? undefined) as any;
        return serverState?.sys?.interaction?.current?.data?.sw?.type ?? null;
      }, { timeout: 10000 }).toBe(null);
      await hostPage.waitForTimeout(1200);
      const afterWithdraw = await readCoreState(hostPage);
      const movedUnit = afterWithdraw.board[withdrawPos.row][withdrawPos.col]?.unit;
      expect(movedUnit?.instanceId).toBe(kairu.instanceId);
      expect(movedUnit?.boosts ?? 0).toBeLessThan(kairu.boosts ?? 0);
      expect(afterWithdraw.board[kairuPos.row][kairuPos.col]?.unit?.instanceId ?? null).not.toBe(kairu.instanceId);
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'withdraw-after-move', {
          filename: 'withdraw-after-move.png',
        }),
        fullPage: false,
      });
      console.log('[withdraw-e2e] 核心状态已确认撤退成功');
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
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
