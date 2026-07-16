import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { GameTestContext } from '../framework/GameTestContext';
import {
  applyCoreState,
  clickBoardElement,
  clickFactionReady,
  clickFactionStart,
  closeDebugPanelIfOpen,
  createSWRoomViaAPI,
  GAME_NAME,
  getFactionCard,
  getFactionStartButton,
  getPlayerStatusCard,
  initSWContext,
  readCoreState,
  selectFactionById,
  setupSWOnlineMatch,
  waitForFactionSelectionReady,
  waitForPhase,
  waitForSummonerWarsUI,
} from '../helpers/summonerwars';
import {
  ensureGameServerAvailable,
  joinMatchViaAPI,
  seedMatchCredentials,
} from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';
import { DESKTOP_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';
import {
  COMMON_UNITS_HUIJIN,
  SUMMONER_HUIJIN,
} from '../../src/games/summonerwars/config/factions/huijin';
import {
  COMMON_UNITS as COMMON_UNITS_NECROMANCER,
  SUMMONER_NECROMANCER,
} from '../../src/games/summonerwars/config/factions/necromancer';
import type {
  BoardUnit,
  CellCoord,
  PlayerId,
  SummonerWarsCore,
  UnitCard,
} from '../../src/games/summonerwars/domain/types';

const cloneInjectedUnitCard = <T extends { abilities?: string[]; deckSymbols?: string[] }>(card: T): T => ({
  ...card,
  abilities: Array.isArray(card.abilities) ? [...card.abilities] : [],
  deckSymbols: Array.isArray(card.deckSymbols) ? [...card.deckSymbols] : [],
});

const huijinRoyalGuardCard = COMMON_UNITS_HUIJIN.find((card) => card.id === 'huijin-royal-guard');
const huijinAshArcherCard = COMMON_UNITS_HUIJIN.find((card) => card.id === 'huijin-ash-archer');
const necroWarriorCard = COMMON_UNITS_NECROMANCER.find((card) => card.id === 'necro-undead-warrior');

if (!huijinRoyalGuardCard) {
  throw new Error('未找到灰烬皇家守卫配置（huijin-royal-guard）');
}
if (!huijinAshArcherCard) {
  throw new Error('未找到灰烬弓箭手配置（huijin-ash-archer）');
}
if (!necroWarriorCard) {
  throw new Error('未找到亡灵战士配置（necro-undead-warrior）');
}

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

const dismissDiceResultOverlay = async (page: Page) => {
  const overlay = page.getByTestId('sw-dice-result-overlay');
  const visible = await overlay.isVisible({ timeout: 500 }).catch(() => false);
  if (!visible) return;
  await overlay.click({ force: true }).catch(() => {});
  await expect(overlay).toBeHidden({ timeout: 8000 });
};

async function joinGuestToHuijinMatch(page: Page, matchId: string) {
  const credentials = await joinMatchViaAPI(page, GAME_NAME, matchId, '1', 'Guest-SW-Huijin');
  if (!credentials) {
    throw new Error(`Failed to join SummonerWars match: ${matchId}`);
  }

  await seedMatchCredentials(page, GAME_NAME, matchId, '1', credentials);
  await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
}

function makeCard<T extends UnitCard>(card: T, id: string, overrides: Partial<UnitCard> = {}): UnitCard {
  return {
    ...cloneInjectedUnitCard(card),
    id,
    ...overrides,
  };
}

function placeUnit(
  core: SummonerWarsCore,
  position: CellCoord,
  card: UnitCard,
  owner: PlayerId = '0',
  overrides: Partial<BoardUnit> = {},
): BoardUnit {
  const unit: BoardUnit = {
    instanceId: overrides.instanceId ?? `${card.id}-unit-${position.row}-${position.col}`,
    cardId: overrides.cardId ?? card.id,
    card,
    owner,
    position,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
    extraAttacks: overrides.extraAttacks,
    chargeBonusThisTurn: overrides.chargeBonusThisTurn,
    destroyAfterExtraAttackSource: overrides.destroyAfterExtraAttackSource,
    attachedCards: overrides.attachedCards,
    healingMode: overrides.healingMode,
    wasAttackedThisTurn: overrides.wasAttackedThisTurn,
    tempAbilities: overrides.tempAbilities,
    originalOwner: overrides.originalOwner,
    attachedUnits: overrides.attachedUnits,
  };
  core.board[position.row][position.col].unit = unit;
  return unit;
}

function clearBoard(core: SummonerWarsCore, phase: SummonerWarsCore['phase']) {
  for (const row of core.board) {
    for (const cell of row) {
      cell.unit = undefined;
      cell.structure = undefined;
    }
  }
  core.currentPlayer = '0';
  core.phase = phase;
  core.selectedUnit = undefined;
  core.attackTargetMode = undefined;
  core.abilityUsageCount = {};
  core.unitKillCountThisTurn = {};
  core.players['0'].magic = 10;
  core.players['0'].hand = [];
  core.players['0'].discard = [];
  core.players['0'].activeEvents = [];
  core.players['0'].moveCount = 0;
  core.players['0'].attackCount = 0;
  core.players['0'].hasAttackedEnemy = false;
  core.players['1'].magic = 10;
  core.players['1'].hand = [];
  core.players['1'].discard = [];
  core.players['1'].activeEvents = [];
  core.players['1'].moveCount = 0;
  core.players['1'].attackCount = 0;
  core.players['1'].hasAttackedEnemy = false;
}

function addSummoners(core: SummonerWarsCore, myPosition: CellCoord, enemyPosition: CellCoord) {
  placeUnit(core, myPosition, makeCard(SUMMONER_HUIJIN, 'huijin-summoner-e2e'), '0', {
    instanceId: 'huijin-summoner-e2e',
  });
  placeUnit(core, enemyPosition, makeCard(SUMMONER_NECROMANCER, 'necro-summoner-e2e'), '1', {
    instanceId: 'necro-summoner-e2e',
  });
}

function prepareCallGuardsState(core: SummonerWarsCore) {
  clearBoard(core, 'attack');
  const summonerPosition = { row: 4, col: 2 };
  const summonPosition = { row: 4, col: 3 };
  const handCard = makeCard(huijinAshArcherCard, 'huijin-ash-archer-e2e-call');
  const summoner = placeUnit(core, summonerPosition, makeCard(SUMMONER_HUIJIN, 'huijin-summoner-e2e-call'), '0', {
    instanceId: 'huijin-summoner-call',
    boosts: 1,
  });
  placeUnit(core, { row: 0, col: 2 }, makeCard(SUMMONER_NECROMANCER, 'necro-summoner-e2e-call'), '1', {
    instanceId: 'necro-summoner-call',
  });
  core.players['0'].hand = [handCard];
  return { core, summoner, summonerPosition, summonPosition, handCard };
}

function prepareRamState(core: SummonerWarsCore) {
  clearBoard(core, 'attack');
  addSummoners(core, { row: 7, col: 2 }, { row: 0, col: 2 });
  const guardPosition = { row: 4, col: 2 };
  const enemyPosition = { row: 4, col: 3 };
  const pushPosition = { row: 4, col: 4 };
  const guard = placeUnit(core, guardPosition, makeCard(huijinRoyalGuardCard, 'huijin-royal-guard-e2e-ram'), '0', {
    instanceId: 'huijin-royal-guard-ram',
  });
  placeUnit(core, enemyPosition, makeCard(necroWarriorCard, 'necro-warrior-e2e-ram', { life: 8 }), '1', {
    instanceId: 'necro-warrior-ram',
  });
  return { core, guard, guardPosition, enemyPosition, pushPosition };
}

function prepareQuickShotState(core: SummonerWarsCore) {
  clearBoard(core, 'move');
  addSummoners(core, { row: 7, col: 2 }, { row: 0, col: 2 });
  const archerStartPosition = { row: 4, col: 2 };
  const archerMovePosition = { row: 4, col: 3 };
  const enemyPosition = { row: 4, col: 5 };
  const archer = placeUnit(core, archerStartPosition, makeCard(huijinAshArcherCard, 'huijin-ash-archer-e2e-quick'), '0', {
    instanceId: 'huijin-ash-archer-quick',
  });
  placeUnit(core, enemyPosition, makeCard(necroWarriorCard, 'necro-warrior-e2e-quick', { life: 8 }), '1', {
    instanceId: 'necro-warrior-quick',
  });
  return { core, archer, archerStartPosition, archerMovePosition, enemyPosition };
}

async function waitForSwInteraction(
  page: Page,
  matchId: string,
  expected: { type: string; abilityId?: string; step?: string },
) {
  await expect.poll(async () => {
    const state = await getMatchState(matchId, page) as {
      sys?: { interaction?: { current?: { data?: { sw?: { type?: string; abilityId?: string; step?: string } } } } };
    };
    const sw = state.sys?.interaction?.current?.data?.sw;
    return {
      type: sw?.type ?? null,
      abilityId: sw?.abilityId ?? null,
      step: sw?.step ?? null,
    };
  }, { timeout: 10000 }).toEqual({
    type: expected.type,
    abilityId: expected.abilityId ?? null,
    step: expected.step ?? null,
  });
}

async function waitForNoInteraction(page: Page, matchId: string) {
  await expect.poll(async () => {
    const state = await getMatchState(matchId, page) as {
      sys?: { interaction?: { current?: unknown } };
    };
    return state.sys?.interaction?.current ?? null;
  }, { timeout: 10000 }).toBeNull();
}

test.describe('召唤师战争灰烬派系真实入口 E2E', () => {
  test('真实阵营选择入口可以选择灰烬并开局看到玛达莉雅女王、灰烬弓箭手和皇家守卫', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: DESKTOP_REFERENCE_VIEWPORT,
    });
    await initSWContext(hostContext, '__sw_huijin_entry_host');
    const hostPage = await hostContext.newPage();
    const hostGame = new GameTestContext(hostPage);

    const guestContext = await browser.newContext({
      baseURL,
      viewport: DESKTOP_REFERENCE_VIEWPORT,
    });
    await initSWContext(guestContext, '__sw_huijin_entry_guest');
    const guestPage = await guestContext.newPage();

    try {
      await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
      if (!(await ensureGameServerAvailable(hostPage))) {
        test.skip(true, 'Game server unavailable');
      }

      const matchId = await createSWRoomViaAPI(hostPage);
      if (!matchId) {
        test.skip(true, 'Room creation failed');
      }

      await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
      await waitForFactionSelectionReady(hostPage);

      await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
      await joinGuestToHuijinMatch(guestPage, matchId);
      await waitForFactionSelectionReady(guestPage);

      await expect(getFactionCard(hostPage, 'huijin')).toBeVisible({ timeout: 10000 });
      await hostGame.screenshot('01-灰烬阵营入口可见', testInfo);

      await selectFactionById(hostPage, 'huijin');
      await expect(getFactionCard(hostPage, 'huijin')).toHaveAttribute('data-selected', 'true');
      await expect(getPlayerStatusCard(hostPage, '0')).toContainText(/灰烬|Ashen Phoenix/i);
      await hostGame.screenshot('02-灰烬阵营已选择', testInfo);

      await selectFactionById(guestPage, 'necromancer');
      await clickFactionReady(guestPage);
      await expect(getFactionStartButton(hostPage)).toBeEnabled({ timeout: 10000 });
      await clickFactionStart(hostPage);

      await waitForSummonerWarsUI(hostPage, 30000);
      await waitForSummonerWarsUI(guestPage, 30000);

      await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible();
      await expect(hostPage.getByTestId('sw-hand-area')).toBeVisible();
      await expect(hostPage.getByTestId('sw-map-container')).toBeVisible();
      await expect(hostPage.locator('[data-unit-name="玛达莉雅女王"]').first()).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-unit-name="灰烬弓箭手"]').first()).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-unit-name="皇家守卫"]').first()).toBeVisible({ timeout: 10000 });

      await hostGame.screenshot('03-灰烬开局单位可见', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('召集护卫：阶段结束后真实手牌选择并召唤到相邻空格', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'huijin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareCallGuardsState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      await expect(hostPage.locator(`[data-testid="sw-unit-${prepared.summonerPosition.row}-${prepared.summonerPosition.col}"][data-owner="0"]`)).toBeVisible({ timeout: 8000 });
      await hostPage.getByTestId('sw-end-phase').click();

      await waitForSwInteraction(hostPage, matchId, { type: 'huijin_call_guards_select_card' });
      await expect(hostPage.getByTestId('sw-card-selector-overlay')).toContainText(/召集护卫|Call Guards/i);
      await expect(hostPage.locator(`[data-testid="sw-card-selector-overlay"] [data-card-id="${prepared.handCard.id}"]`)).toBeVisible({ timeout: 8000 });
      await hostGame.screenshot('01-召集护卫-选择手牌士兵', testInfo);

      await hostPage.locator(`[data-testid="sw-card-selector-overlay"] [data-card-id="${prepared.handCard.id}"]`).click();
      await waitForSwInteraction(hostPage, matchId, { type: 'huijin_call_guards_select_position' });
      await expect(hostPage.getByTestId(`sw-cell-${prepared.summonPosition.row}-${prepared.summonPosition.col}`)).toHaveAttribute('data-valid-ability-pos', 'true', { timeout: 8000 });
      await hostGame.screenshot('02-召集护卫-选择相邻空格', testInfo);

      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.summonPosition.row}-${prepared.summonPosition.col}"]`);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const summoned = state.board[prepared.summonPosition.row]?.[prepared.summonPosition.col]?.unit;
        const summoner = state.board[prepared.summonerPosition.row]?.[prepared.summonerPosition.col]?.unit;
        return {
          summonedName: summoned?.card.name ?? null,
          summonedOwner: summoned?.owner ?? null,
          cardStillInHand: state.players['0'].hand.some((card) => card.id === prepared.handCard.id),
          summonerBoosts: summoner?.boosts ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        summonedName: '灰烬弓箭手',
        summonedOwner: '0',
        cardStillInHand: false,
        summonerBoosts: 0,
      });

      await waitForNoInteraction(hostPage, matchId);
      await hostGame.screenshot('03-召集护卫-召唤完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('冲撞：皇家守卫攻击后真实选择相邻敌方并推到相邻空格', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'huijin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareRamState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await setHarnessDiceValues(hostPage, [1]);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.guardPosition.row}-${prepared.guardPosition.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}"][data-owner="1"]`);
      await dismissDiceResultOverlay(hostPage);

      await waitForSwInteraction(hostPage, matchId, { type: 'after_attack_huijin_ram_target' });
      await expect(hostPage.getByTestId(`sw-cell-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}`)).toHaveAttribute('data-valid-ability-unit', 'true', { timeout: 8000 });
      await hostGame.screenshot('01-冲撞-选择相邻敌方目标', testInfo);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}"][data-owner="1"]`);
      await waitForSwInteraction(hostPage, matchId, { type: 'after_attack_huijin_ram_position' });
      await expect(hostPage.getByTestId(`sw-cell-${prepared.pushPosition.row}-${prepared.pushPosition.col}`)).toHaveAttribute('data-valid-ability-pos', 'true', { timeout: 8000 });
      await hostGame.screenshot('02-冲撞-选择推拉落点', testInfo);

      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.pushPosition.row}-${prepared.pushPosition.col}"]`);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          originalCell: state.board[prepared.enemyPosition.row]?.[prepared.enemyPosition.col]?.unit?.card.name ?? null,
          pushedCell: state.board[prepared.pushPosition.row]?.[prepared.pushPosition.col]?.unit?.card.name ?? null,
          pushedOwner: state.board[prepared.pushPosition.row]?.[prepared.pushPosition.col]?.unit?.owner ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        originalCell: null,
        pushedCell: '亡灵战士',
        pushedOwner: '1',
      });

      await waitForNoInteraction(hostPage, matchId);
      await hostGame.screenshot('03-冲撞-推拉完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('快速射击：灰烬弓箭手移动后真实选择直线目标造成伤害', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'huijin', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const prepared = prepareQuickShotState(await readCoreState(hostPage) as SummonerWarsCore);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.archerStartPosition.row}-${prepared.archerStartPosition.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.archerMovePosition.row}-${prepared.archerMovePosition.col}"]`);

      await waitForSwInteraction(hostPage, matchId, { type: 'after_move_huijin_quick_shot' });
      await expect(hostPage.getByTestId(`sw-cell-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}`)).toHaveAttribute('data-valid-ability-unit', 'true', { timeout: 8000 });
      await hostGame.screenshot('01-快速射击-移动后选择目标', testInfo);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}"][data-owner="1"]`);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const archerAtStart = state.board[prepared.archerStartPosition.row]?.[prepared.archerStartPosition.col]?.unit;
        const archerAtMove = state.board[prepared.archerMovePosition.row]?.[prepared.archerMovePosition.col]?.unit;
        const enemy = state.board[prepared.enemyPosition.row]?.[prepared.enemyPosition.col]?.unit;
        return {
          archerAtStart: archerAtStart?.card.name ?? null,
          archerAtMove: archerAtMove?.card.name ?? null,
          enemyDamage: enemy?.damage ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        archerAtStart: null,
        archerAtMove: '灰烬弓箭手',
        enemyDamage: 1,
      });

      await waitForNoInteraction(hostPage, matchId);
      await hostGame.screenshot('02-快速射击-伤害完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });
});
