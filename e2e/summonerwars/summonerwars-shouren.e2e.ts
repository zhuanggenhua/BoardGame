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
import { ensureGameServerAvailable, joinMatchViaAPI, seedMatchCredentials } from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';
import { DESKTOP_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';
import {
  COMMON_UNITS_SHOUREN,
  EVENT_CARDS_SHOUREN,
  STRUCTURE_CARDS_SHOUREN,
  SUMMONER_SHOUREN,
} from '../../src/games/summonerwars/config/factions/shouren';
import { COMMON_UNITS as COMMON_UNITS_NECROMANCER, SUMMONER_NECROMANCER } from '../../src/games/summonerwars/config/factions/necromancer';
import type {
  BoardStructure,
  BoardUnit,
  CellCoord,
  EventCard,
  PlayerId,
  StructureCard,
  SummonerWarsCore,
  UnitCard,
} from '../../src/games/summonerwars/domain/types';

const frostShaman = COMMON_UNITS_SHOUREN.find((card) => card.id === 'shouren-frost-shaman');
const tundraCharger = COMMON_UNITS_SHOUREN.find((card) => card.id === 'shouren-tundra-charger');
const tundraFighter = COMMON_UNITS_SHOUREN.find((card) => card.id === 'shouren-tundra-fighter');
const freezeEvent = EVENT_CARDS_SHOUREN.find((card) => card.id === 'shouren-freeze');
const bruteForceEvent = EVENT_CARDS_SHOUREN.find((card) => card.id === 'shouren-brute-force');
const primalFuryEvent = EVENT_CARDS_SHOUREN.find((card) => card.id === 'shouren-primal-fury');
const necroWarrior = COMMON_UNITS_NECROMANCER.find((card) => card.id === 'necro-undead-warrior');

if (!frostShaman || !tundraCharger || !tundraFighter || !freezeEvent || !bruteForceEvent || !primalFuryEvent || !necroWarrior) {
  throw new Error('冰苔兽人 E2E 所需正式卡牌配置不完整');
}

const cloneCard = <T extends UnitCard | EventCard | StructureCard>(card: T): T => ({
  ...card,
  deckSymbols: [...card.deckSymbols],
  ...('abilities' in card && Array.isArray(card.abilities) ? { abilities: [...card.abilities] } : {}),
}) as T;

function makeUnit(card: UnitCard, id: string, overrides: Partial<UnitCard> = {}): UnitCard {
  return { ...cloneCard(card), id, ...overrides };
}

function makeEvent(card: EventCard, id: string, overrides: Partial<EventCard> = {}): EventCard {
  return { ...cloneCard(card), id, ...overrides };
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
    extraAttackSources: overrides.extraAttackSources,
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

function placeStructure(core: SummonerWarsCore, position: CellCoord, card: StructureCard): BoardStructure {
  const structure: BoardStructure = {
    cardId: card.id,
    card,
    owner: '0',
    position,
    damage: 0,
  };
  core.board[position.row][position.col].structure = structure;
  return structure;
}

function resetCore(core: SummonerWarsCore, phase: SummonerWarsCore['phase']) {
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
  core.pendingAttackRoll = undefined;
  core.abilityUsageCount = {};
  core.unitKillCountThisTurn = {};
  for (const playerId of ['0', '1'] as PlayerId[]) {
    core.players[playerId].magic = 10;
    core.players[playerId].hand = [];
    core.players[playerId].discard = [];
    core.players[playerId].activeEvents = [];
    core.players[playerId].moveCount = 0;
    core.players[playerId].attackCount = 0;
    core.players[playerId].hasAttackedEnemy = false;
  }
}

function addRequiredSummoners(core: SummonerWarsCore, myPosition: CellCoord = { row: 7, col: 2 }) {
  const mine = placeUnit(core, myPosition, makeUnit(SUMMONER_SHOUREN, `shouren-summoner-e2e-${myPosition.row}-${myPosition.col}`), '0', {
    instanceId: 'shouren-summoner-e2e',
  });
  placeUnit(core, { row: 0, col: 2 }, makeUnit(SUMMONER_NECROMANCER, 'necro-summoner-e2e'), '1', {
    instanceId: 'necro-summoner-e2e',
  });
  return mine;
}

function addEnemy(core: SummonerWarsCore, position: CellCoord, id: string): BoardUnit {
  return placeUnit(core, position, makeUnit(necroWarrior, id, { life: 20, abilities: [] }), '1', {
    instanceId: `${id}-instance`,
  });
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

async function dismissDiceResultOverlay(page: Page) {
  const overlay = page.getByTestId('sw-dice-result-overlay');
  if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
    await overlay.click({ force: true });
    await expect(overlay).toBeHidden({ timeout: 8000 });
  }
}

async function waitForSwInteraction(page: Page, matchId: string, type: string) {
  await expect.poll(async () => {
    const state = await getMatchState(matchId, page) as {
      sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
    };
    return state.sys?.interaction?.current?.data?.sw?.type ?? null;
  }, { timeout: 10000 }).toBe(type);
}

async function waitForNoInteraction(page: Page, matchId: string) {
  await expect.poll(async () => {
    const state = await getMatchState(matchId, page) as { sys?: { interaction?: { current?: unknown } } };
    return state.sys?.interaction?.current ?? null;
  }, { timeout: 10000 }).toBeNull();
}

async function joinGuest(page: Page, matchId: string) {
  const credentials = await joinMatchViaAPI(page, GAME_NAME, matchId, '1', 'Guest-SW-Shouren');
  if (!credentials) throw new Error(`无法加入召唤师战争对局：${matchId}`);
  await seedMatchCredentials(page, GAME_NAME, matchId, '1', credentials);
  await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
}

async function triggerAttack(page: Page, attacker: CellCoord, target: CellCoord, diceValues: number[]) {
  await setHarnessDiceValues(page, diceValues);
  await clickBoardElement(page, `[data-testid="sw-unit-${attacker.row}-${attacker.col}"][data-owner="0"]`);
  await clickBoardElement(page, `[data-testid="sw-unit-${target.row}-${target.col}"][data-owner="1"]`);
}

test.describe('召唤师战争冰苔兽人真实入口与关键交互 E2E', () => {
  test('真实阵营选择后按正式坐标生成格鲁纳克、冰苔斗士、冰霜萨满和起始城门', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({ baseURL, viewport: DESKTOP_REFERENCE_VIEWPORT });
    const guestContext = await browser.newContext({ baseURL, viewport: DESKTOP_REFERENCE_VIEWPORT });
    await initSWContext(hostContext, '__sw_shouren_entry_host');
    await initSWContext(guestContext, '__sw_shouren_entry_guest');
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const hostGame = new GameTestContext(hostPage);

    try {
      await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
      if (!(await ensureGameServerAvailable(hostPage))) test.skip(true, 'Game server unavailable');
      const matchId = await createSWRoomViaAPI(hostPage);
      if (!matchId) test.skip(true, 'Room creation failed');

      await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
      await waitForFactionSelectionReady(hostPage);
      await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
      await joinGuest(guestPage, matchId);
      await waitForFactionSelectionReady(guestPage);

      await expect(getFactionCard(hostPage, 'shouren')).toBeVisible({ timeout: 10000 });
      await hostGame.screenshot('01-冰苔兽人阵营入口可见', testInfo);
      await selectFactionById(hostPage, 'shouren');
      await expect(getFactionCard(hostPage, 'shouren')).toHaveAttribute('data-selected', 'true');
      await expect(getPlayerStatusCard(hostPage, '0')).toContainText(/冰苔兽人|Tundra Orcs/i);
      await hostGame.screenshot('02-冰苔兽人阵营已选择', testInfo);

      await selectFactionById(guestPage, 'necromancer');
      await clickFactionReady(guestPage);
      await expect(getFactionStartButton(hostPage)).toBeEnabled({ timeout: 10000 });
      await clickFactionStart(hostPage);
      await waitForSummonerWarsUI(hostPage, 30000);

      await expect(hostPage.locator('[data-testid="sw-unit-7-2"][data-unit-name="格鲁纳克"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid="sw-unit-4-3"][data-unit-name="冰苔斗士"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid="sw-unit-5-2"][data-unit-name="冰霜萨满"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid="sw-structure-5-3"][data-structure-name="起始城门"]')).toBeVisible({ timeout: 10000 });
      await hostGame.screenshot('03-冰苔兽人正式开局布局', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('激励：真实攻击骰面可以保留且不消耗充能', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'shouren', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext } = match;
    const hostGame = new GameTestContext(hostPage);
    const attackerPos = { row: 4, col: 2 };
    const targetPos = { row: 4, col: 3 };

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'attack');
      const summoner = addRequiredSummoners(core, { row: 3, col: 2 });
      summoner.boosts = 1;
      placeUnit(core, attackerPos, makeUnit(tundraFighter, 'shouren-encourage-keep-attacker'));
      addEnemy(core, targetPos, 'shouren-encourage-keep-target');
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      await triggerAttack(hostPage, attackerPos, targetPos, [1, 1]);
      const overlay = hostPage.getByTestId('sw-dice-result-overlay');
      await expect(overlay).toBeVisible({ timeout: 8000 });
      await expect(overlay.getByRole('button', { name: /保留|Keep/i })).toBeVisible();
      await expect(overlay.getByRole('button', { name: /重掷|Reroll/i })).toBeVisible();
      await hostGame.screenshot('04-激励骰面提供重掷与保留', testInfo);
      const pendingKeep = await readCoreState(hostPage) as SummonerWarsCore;
      const expectedKeepDamage = pendingKeep.pendingAttackRoll?.diceResults
        .flatMap((result) => result.marks)
        .filter((mark) => mark === 'melee').length ?? 0;
      expect(expectedKeepDamage).toBeGreaterThan(0);
      await overlay.getByRole('button', { name: /保留|Keep/i }).click();
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return { boosts: state.board[3][2].unit?.boosts, damage: state.board[4][3].unit?.damage };
      }, { timeout: 10000 }).toEqual({ boosts: 1, damage: expectedKeepDamage });

    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('激励：真实攻击骰面可以消耗充能重掷全部骰子', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'shouren', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext } = match;
    const hostGame = new GameTestContext(hostPage);
    const attackerPos = { row: 4, col: 2 };
    const targetPos = { row: 4, col: 3 };

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'attack');
      const summoner = addRequiredSummoners(core, { row: 3, col: 2 });
      summoner.boosts = 1;
      placeUnit(core, attackerPos, makeUnit(tundraFighter, 'shouren-encourage-reroll-attacker'));
      addEnemy(core, targetPos, 'shouren-encourage-reroll-target');
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      await triggerAttack(hostPage, attackerPos, targetPos, [5, 5]);
      const overlay = hostPage.getByTestId('sw-dice-result-overlay');
      await expect(overlay.getByRole('button', { name: /重掷|Reroll/i })).toBeVisible({ timeout: 8000 });
      await setHarnessDiceValues(hostPage, [6, 6]);
      await overlay.getByRole('button', { name: /重掷|Reroll/i }).click();
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return { boosts: state.board[3][2].unit?.boosts, damage: state.board[4][3].unit?.damage };
      }, { timeout: 10000 }).toEqual({ boosts: 0, damage: 2 });
      await hostGame.screenshot('05-激励重掷结算完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('冻结：从真实手牌打出并选择召唤师三格内未充能单位', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'shouren', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext } = match;
    const hostGame = new GameTestContext(hostPage);
    const targetPos = { row: 4, col: 4 };
    const cardId = 'shouren-freeze-0-1';

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'summon');
      addRequiredSummoners(core, { row: 4, col: 2 });
      const target = addEnemy(core, targetPos, 'shouren-freeze-target');
      core.players['0'].hand = [makeEvent(freezeEvent, cardId)];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');

      const card = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${cardId}"]`).first();
      await expect(card).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await card.click();
      await waitForSwInteraction(hostPage, match.matchId, 'event_target');
      await expect(hostPage.getByTestId(`sw-cell-${targetPos.row}-${targetPos.col}`)).toHaveAttribute('data-valid-event-target', 'true', { timeout: 8000 });
      await hostGame.screenshot('06-冻结选择合法目标', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${targetPos.row}-${targetPos.col}"][data-owner="1"]`);

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const active = state.players['0'].activeEvents.find((event) => event.id === cardId);
        return { targetUnitId: active?.targetUnitId ?? null, cardInHand: state.players['0'].hand.some((item) => item.id === cardId) };
      }, { timeout: 10000 }).toEqual({ targetUnitId: target.instanceId, cardInHand: false });
      await hostGame.screenshot('07-冻结已附着目标', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('血腥急袭：真实召唤后可以位移自伤，也可以跳过并留在原位', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'shouren', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const gatePos = { row: 4, col: 2 };
    const summonPos = { row: 4, col: 3 };
    const movePos = { row: 4, col: 4 };

    const prepare = async (cardId: string) => {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'summon');
      addRequiredSummoners(core);
      placeStructure(core, gatePos, { ...cloneCard(STRUCTURE_CARDS_SHOUREN[0]), id: `shouren-gate-${cardId}` });
      core.players['0'].hand = [makeUnit(tundraCharger, cardId)];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');
      const card = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${cardId}"]`).first();
      await expect(card).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await card.click();
      await expect(hostPage.getByTestId(`sw-cell-${summonPos.row}-${summonPos.col}`)).toHaveAttribute('data-valid-summon', 'true');
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${summonPos.row}-${summonPos.col}"]`);
      await waitForSwInteraction(hostPage, matchId, 'after_summon_shouren_bloody_rush');
      await expect(hostPage.getByTestId(`sw-cell-${movePos.row}-${movePos.col}`)).toHaveAttribute('data-valid-ability-pos', 'true', { timeout: 8000 });
      await expect(hostPage.getByRole('button', { name: /^跳过$|^Skip$/i })).toBeVisible();
    };

    try {
      await prepare('shouren-rush-move-e2e');
      await hostPage.waitForTimeout(600);
      await hostGame.screenshot('08-血腥急袭位移与跳过入口', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${movePos.row}-${movePos.col}"]`);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return { sourceEmpty: !state.board[4][3].unit, movedName: state.board[4][4].unit?.card.name, damage: state.board[4][4].unit?.damage };
      }, { timeout: 10000 }).toEqual({ sourceEmpty: true, movedName: '冰苔冲锋者', damage: 1 });

      await prepare('shouren-rush-skip-e2e');
      await hostPage.getByRole('button', { name: /^跳过$|^Skip$/i }).click();
      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return { name: state.board[4][3].unit?.card.name, damage: state.board[4][3].unit?.damage, moved: !!state.board[4][4].unit };
      }).toEqual({ name: '冰苔冲锋者', damage: 0, moved: false });
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('狂暴：特殊标记攻击后可以位移，也可以跳过', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'shouren', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const attackerPos = { row: 4, col: 2 };
    const targetPos = { row: 4, col: 3 };
    const movePos = { row: 4, col: 1 };

    const prepare = async (id: string) => {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'attack');
      addRequiredSummoners(core);
      placeUnit(core, attackerPos, makeUnit(tundraFighter, id), '0', { instanceId: `${id}-instance` });
      addEnemy(core, targetPos, `${id}-target`);
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await triggerAttack(hostPage, attackerPos, targetPos, [5, 5, 5]);
      await waitForSwInteraction(hostPage, matchId, 'after_attack_shouren_berserk');
      await dismissDiceResultOverlay(hostPage);
      await expect(hostPage.getByTestId(`sw-cell-${movePos.row}-${movePos.col}`)).toHaveAttribute('data-valid-ability-pos', 'true', { timeout: 8000 });
    };

    try {
      await prepare('shouren-berserk-move-e2e');
      await hostGame.screenshot('09-狂暴位移与跳过入口', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${movePos.row}-${movePos.col}"]`);
      await expect.poll(async () => (await readCoreState(hostPage) as SummonerWarsCore).board[4][1].unit?.card.name ?? null).toBe('冰苔斗士');

      await prepare('shouren-berserk-skip-e2e');
      await hostPage.getByRole('button', { name: /^跳过$|^Skip$/i }).click();
      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => (await readCoreState(hostPage) as SummonerWarsCore).board[4][2].unit?.card.name ?? null).toBe('冰苔斗士');
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('蛮力冲击：造成伤害后可以把目标推远一格，也可以跳过', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'shouren', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const attackerPos = { row: 4, col: 2 };
    const targetPos = { row: 4, col: 3 };
    const pushPos = { row: 4, col: 4 };

    const prepare = async (id: string) => {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'attack');
      addRequiredSummoners(core);
      core.players['0'].activeEvents = [makeEvent(bruteForceEvent, 'shouren-brute-force-0-1')];
      placeUnit(core, attackerPos, makeUnit(tundraCharger, id), '0', { instanceId: `${id}-instance` });
      addEnemy(core, targetPos, `${id}-target`);
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await triggerAttack(hostPage, attackerPos, targetPos, [1, 1]);
      await waitForSwInteraction(hostPage, matchId, 'after_attack_shouren_brute_impact');
      await dismissDiceResultOverlay(hostPage);
      await expect(hostPage.getByTestId(`sw-cell-${pushPos.row}-${pushPos.col}`)).toHaveAttribute('data-valid-ability-pos', 'true', { timeout: 8000 });
    };

    try {
      await prepare('shouren-brute-move-e2e');
      await hostGame.screenshot('10-蛮力冲击推拉与跳过入口', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${pushPos.row}-${pushPos.col}"]`);
      await expect.poll(async () => (await readCoreState(hostPage) as SummonerWarsCore).board[4][4].unit?.owner ?? null).toBe('1');

      await prepare('shouren-brute-skip-e2e');
      await hostPage.getByRole('button', { name: /^跳过$|^Skip$/i }).click();
      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => (await readCoreState(hostPage) as SummonerWarsCore).board[4][3].unit?.owner ?? null).toBe('1');
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('原始狂怒：召唤师攻击后可以位移两格获得额外攻击，也可以跳过', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'shouren', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const summonerPos = { row: 4, col: 2 };
    const targetPos = { row: 4, col: 3 };
    const movePos = { row: 4, col: 0 };

    const prepare = async (id: string) => {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'attack');
      const summoner = addRequiredSummoners(core, summonerPos);
      summoner.boosts = 0;
      core.players['0'].activeEvents = [makeEvent(primalFuryEvent, 'shouren-primal-fury-0-1')];
      addEnemy(core, targetPos, `${id}-target`);
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await triggerAttack(hostPage, summonerPos, targetPos, [1, 1, 1, 1]);
      await waitForSwInteraction(hostPage, matchId, 'after_attack_shouren_primal_fury');
      await dismissDiceResultOverlay(hostPage);
      await expect(hostPage.getByTestId(`sw-cell-${movePos.row}-${movePos.col}`)).toHaveAttribute('data-valid-ability-pos', 'true', { timeout: 8000 });
    };

    try {
      await prepare('shouren-primal-move-e2e');
      await hostGame.screenshot('11-原始狂怒一至两格位移与跳过入口', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${movePos.row}-${movePos.col}"]`);
      await expect.poll(async () => {
        const unit = (await readCoreState(hostPage) as SummonerWarsCore).board[4][0].unit;
        return { name: unit?.card.name ?? null, extraAttacks: unit?.extraAttacks ?? 0 };
      }, { timeout: 10000 }).toEqual({ name: '格鲁纳克', extraAttacks: 1 });

      await prepare('shouren-primal-skip-e2e');
      await hostPage.getByRole('button', { name: /^跳过$|^Skip$/i }).click();
      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const unit = (await readCoreState(hostPage) as SummonerWarsCore).board[4][2].unit;
        return { name: unit?.card.name ?? null, extraAttacks: unit?.extraAttacks ?? 0 };
      }).toEqual({ name: '格鲁纳克', extraAttacks: 0 });
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });
});
