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
  CHAMPION_UNITS_YONGHENG,
  COMMON_UNITS_YONGHENG,
  EVENT_CARDS_YONGHENG,
  SUMMONER_YONGHENG,
} from '../../src/games/summonerwars/config/factions/yongheng';
import {
  COMMON_UNITS as COMMON_UNITS_NECROMANCER,
  SUMMONER_NECROMANCER,
} from '../../src/games/summonerwars/config/factions/necromancer';
import type {
  BoardUnit,
  Card,
  CellCoord,
  EventCard,
  PlayerId,
  SummonerWarsCore,
  UnitCard,
} from '../../src/games/summonerwars/domain/types';

const fortressAdvisor = COMMON_UNITS_YONGHENG.find((card) => card.id === 'yongheng-fortress-advisor');
const psychicKnight = COMMON_UNITS_YONGHENG.find((card) => card.id === 'yongheng-psychic-knight');
const mysterySage = COMMON_UNITS_YONGHENG.find((card) => card.id === 'yongheng-mystery-sage');
const supervisorMaruna = CHAMPION_UNITS_YONGHENG.find((card) => card.id === 'yongheng-supervisor-maruna');
const searchEvent = EVENT_CARDS_YONGHENG.find((card) => card.id === 'yongheng-search');
const mentalInvasionEvent = EVENT_CARDS_YONGHENG.find((card) => card.id === 'yongheng-mental-invasion');
const necroWarrior = COMMON_UNITS_NECROMANCER.find((card) => card.id === 'necro-undead-warrior');

if (!fortressAdvisor || !psychicKnight || !mysterySage || !supervisorMaruna || !searchEvent || !mentalInvasionEvent || !necroWarrior) {
  throw new Error('永恒议会 E2E 所需正式卡牌配置不完整');
}

const cloneCard = <T extends Card>(card: T): T => ({
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

function resetCore(core: SummonerWarsCore, phase: SummonerWarsCore['phase'], currentPlayer: PlayerId = '0') {
  for (const row of core.board) {
    for (const cell of row) {
      cell.unit = undefined;
      cell.structure = undefined;
    }
  }
  core.currentPlayer = currentPlayer;
  core.phase = phase;
  core.selectedUnit = undefined;
  core.attackTargetMode = undefined;
  core.pendingAttackRoll = undefined;
  core.abilityUsageCount = {};
  core.unitKillCountThisTurn = {};
  for (const playerId of ['0', '1'] as PlayerId[]) {
    core.players[playerId].magic = 10;
    core.players[playerId].hand = [];
    core.players[playerId].deck = [];
    core.players[playerId].discard = [];
    core.players[playerId].activeEvents = [];
    core.players[playerId].moveCount = 0;
    core.players[playerId].attackCount = 0;
    core.players[playerId].hasAttackedEnemy = false;
  }
}

function addRequiredSummoners(core: SummonerWarsCore, myPosition: CellCoord = { row: 4, col: 4 }) {
  const mine = placeUnit(core, myPosition, makeUnit(SUMMONER_YONGHENG, `yongheng-summoner-e2e-${myPosition.row}-${myPosition.col}`), '0', {
    instanceId: 'yongheng-summoner-e2e',
  });
  placeUnit(core, { row: 0, col: 3 }, makeUnit(SUMMONER_NECROMANCER, 'necro-summoner-e2e'), '1', {
    instanceId: 'necro-summoner-e2e',
  });
  return mine;
}

function addEnemy(core: SummonerWarsCore, position: CellCoord, id: string): BoardUnit {
  return placeUnit(core, position, makeUnit(necroWarrior, id, { life: 20, abilities: [] }), '1', {
    instanceId: `${id}-instance`,
  });
}

async function setHarnessDiceValues(page: Page, values: number[]) {
  await page.evaluate((diceValues) => {
    const harness = (window as Window & {
      __BG_TEST_HARNESS__?: { dice?: { setValues?: (items: number[]) => void } };
    }).__BG_TEST_HARNESS__;
    if (typeof harness?.dice?.setValues !== 'function') {
      throw new Error('__BG_TEST_HARNESS__.dice.setValues not found');
    }
    harness.dice.setValues(diceValues);
  }, values);
}

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
  const credentials = await joinMatchViaAPI(page, GAME_NAME, matchId, '1', 'Guest-SW-Yongheng');
  if (!credentials) throw new Error(`无法加入召唤师战争对局：${matchId}`);
  await seedMatchCredentials(page, GAME_NAME, matchId, '1', credentials);
  await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
}

async function triggerAttack(page: Page, attacker: CellCoord, target: CellCoord, diceValues: number[] = [1, 1, 1]) {
  await setHarnessDiceValues(page, diceValues);
  await clickBoardElement(page, `[data-testid="sw-unit-${attacker.row}-${attacker.col}"][data-owner="0"]`);
  await clickBoardElement(page, `[data-testid="sw-unit-${target.row}-${target.col}"][data-owner="1"]`);
}

test.describe('召唤师战争永恒议会真实入口与关键交互 E2E', () => {
  test('真实阵营选择后按正式坐标生成大议长艾迪雅、城塞参谋、心灵骑士和起始城门', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({ baseURL, viewport: DESKTOP_REFERENCE_VIEWPORT });
    const guestContext = await browser.newContext({ baseURL, viewport: DESKTOP_REFERENCE_VIEWPORT });
    await initSWContext(hostContext, '__sw_yongheng_entry_host');
    await initSWContext(guestContext, '__sw_yongheng_entry_guest');
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

      await expect(getFactionCard(hostPage, 'yongheng')).toBeVisible({ timeout: 10000 });
      await hostGame.screenshot('01-永恒议会阵营入口可见', testInfo);
      await selectFactionById(hostPage, 'yongheng');
      await expect(getFactionCard(hostPage, 'yongheng')).toHaveAttribute('data-selected', 'true');
      await expect(getPlayerStatusCard(hostPage, '0')).toContainText(/永恒议会|Eternal/i);
      await hostGame.screenshot('02-永恒议会阵营已选择', testInfo);

      await selectFactionById(guestPage, 'necromancer');
      await clickFactionReady(guestPage);
      await expect(getFactionStartButton(hostPage)).toBeEnabled({ timeout: 10000 });
      await clickFactionStart(hostPage);
      await waitForSummonerWarsUI(hostPage, 30000);

      await expect(hostPage.locator('[data-testid="sw-unit-7-3"][data-unit-name="大议长艾迪雅"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid="sw-unit-5-2"][data-unit-name="城塞参谋"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid="sw-unit-5-3"][data-unit-name="心灵骑士"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid="sw-structure-6-3"][data-structure-name="起始城门"]')).toBeVisible({ timeout: 10000 });
      await hostGame.screenshot('03-永恒议会正式开局布局', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('延续：对手抽牌阶段结束前可确认保留己方持续事件', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'yongheng', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, guestPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'draw', '1');
      const summoner = addRequiredSummoners(core);
      summoner.boosts = 2;
      core.players['0'].activeEvents = [makeEvent(searchEvent, 'yongheng-search')];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await closeDebugPanelIfOpen(guestPage);
      await waitForPhase(guestPage, 'draw');

      await guestPage.getByTestId('sw-end-phase').click();
      await waitForSwInteraction(hostPage, matchId, 'yongheng_continuance');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/延续|保留|Continuance|retain/i, { timeout: 8000 });
      await expect(hostPage.getByRole('button', { name: /^确认$|^Confirm$/i })).toBeVisible();
      await expect(hostPage.getByRole('button', { name: /^跳过$|^Skip$/i })).toBeVisible();
      await hostGame.screenshot('04-延续保留持续事件确认入口', testInfo);

      await hostPage.getByRole('button', { name: /^确认$|^Confirm$/i }).click();
      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          active: state.players['0'].activeEvents.map(card => card.id),
          discard: state.players['0'].discard.map(card => card.id),
          boosts: state.board[4][4].unit?.boosts ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        active: ['yongheng-search'],
        discard: [],
        boosts: 0,
      });
      await hostGame.screenshot('05-延续确认后持续事件仍在场', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('探寻与心念侵袭：阶段开始确认抓牌后可指定召唤师两格内敌方造成伤害', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'yongheng', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const enemyPos = { row: 4, col: 5 };

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'summon');
      addRequiredSummoners(core);
      addEnemy(core, enemyPos, 'yongheng-mental-target');
      core.players['0'].activeEvents = [
        makeEvent(searchEvent, 'yongheng-search'),
        makeEvent(mentalInvasionEvent, 'yongheng-mental-invasion'),
      ];
      core.players['0'].deck = [makeUnit(fortressAdvisor, 'yongheng-draw-card-e2e')];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');

      await hostPage.getByTestId('sw-end-phase').click();
      await waitForSwInteraction(hostPage, matchId, 'yongheng_draw');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/永恒议会|抓\s*1\s*张牌|Search|draw/i, { timeout: 8000 });
      await hostGame.screenshot('06-探寻阶段开始抓牌确认入口', testInfo);
      await hostPage.getByRole('button', { name: /^确认$|^Confirm$/i }).click();

      await waitForSwInteraction(hostPage, matchId, 'yongheng_mental_invasion');
      await expect(hostPage.getByTestId(`sw-cell-${enemyPos.row}-${enemyPos.col}`)).toHaveAttribute('data-valid-ability-unit', 'true', { timeout: 8000 });
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/心念侵袭|目标|Mental|target/i, { timeout: 8000 });
      await hostGame.screenshot('07-心念侵袭选择两格内敌方', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyPos.row}-${enemyPos.col}"][data-owner="1"]`);

      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          handIds: state.players['0'].hand.map(card => card.id),
          deckCount: state.players['0'].deck.length,
          enemyDamage: state.board[enemyPos.row][enemyPos.col].unit?.damage ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        handIds: ['yongheng-draw-card-e2e'],
        deckCount: 0,
        enemyDamage: 1,
      });
      await hostGame.screenshot('08-心念侵袭伤害结算完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('冲撞：心灵骑士攻击相邻敌方后可选择目标并推拉到相邻空格', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'yongheng', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const attackerPos = { row: 4, col: 4 };
    const enemyPos = { row: 4, col: 5 };
    const pushPos = { row: 3, col: 5 };

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'attack');
      addRequiredSummoners(core, { row: 3, col: 3 });
      placeUnit(core, attackerPos, makeUnit(psychicKnight, 'yongheng-collision-knight'));
      addEnemy(core, enemyPos, 'yongheng-collision-target');
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      await triggerAttack(hostPage, attackerPos, enemyPos, [1, 1]);
      await waitForSwInteraction(hostPage, matchId, 'yongheng_collision_target');
      await dismissDiceResultOverlay(hostPage);
      await expect(hostPage.getByTestId(`sw-cell-${enemyPos.row}-${enemyPos.col}`)).toHaveAttribute('data-valid-ability-unit', 'true', { timeout: 8000 });
      await hostGame.screenshot('09-冲撞选择相邻敌方目标', testInfo);

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyPos.row}-${enemyPos.col}"][data-owner="1"]`);
      await waitForSwInteraction(hostPage, matchId, 'yongheng_collision_position');
      await expect(hostPage.getByTestId(`sw-cell-${pushPos.row}-${pushPos.col}`)).toHaveAttribute('data-valid-ability-pos', 'true', { timeout: 8000 });
      await hostGame.screenshot('10-冲撞选择推拉落点', testInfo);

      await clickBoardElement(hostPage, `[data-testid="sw-cell-${pushPos.row}-${pushPos.col}"]`);
      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          originalCell: state.board[enemyPos.row][enemyPos.col].unit?.card.name ?? null,
          pushedCell: state.board[pushPos.row][pushPos.col].unit?.card.name ?? null,
          pushedOwner: state.board[pushPos.row][pushPos.col].unit?.owner ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        originalCell: null,
        pushedCell: '亡灵战士',
        pushedOwner: '1',
      });
      await hostGame.screenshot('11-冲撞推拉完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('警告：城塞参谋攻击后可将手牌放到牌库底并移动大议长艾迪雅', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'yongheng', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const summonerPos = { row: 3, col: 3 };
    const movePos = { row: 3, col: 4 };
    const attackerPos = { row: 4, col: 4 };
    const enemyPos = { row: 4, col: 5 };
    const cardId = 'yongheng-warning-hand-e2e';

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'attack');
      addRequiredSummoners(core, summonerPos);
      placeUnit(core, attackerPos, makeUnit(fortressAdvisor, 'yongheng-warning-advisor'));
      addEnemy(core, enemyPos, 'yongheng-warning-target');
      core.players['0'].hand = [makeUnit(necroWarrior, cardId, { faction: 'yongheng', abilities: [] })];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      await triggerAttack(hostPage, attackerPos, enemyPos, [1]);
      await waitForSwInteraction(hostPage, matchId, 'yongheng_warning_card');
      await dismissDiceResultOverlay(hostPage);
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/警告|手牌|Warning|card/i, { timeout: 8000 });
      await expect(hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${cardId}"]`).first()).toBeVisible({ timeout: 8000 });
      await hostGame.screenshot('12-警告选择一张手牌', testInfo);

      await hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${cardId}"]`).first().click();
      await waitForSwInteraction(hostPage, matchId, 'yongheng_warning_position');
      await expect(hostPage.getByTestId(`sw-cell-${movePos.row}-${movePos.col}`)).toHaveAttribute('data-valid-ability-pos', 'true', { timeout: 8000 });
      await hostGame.screenshot('13-警告选择大议长移动落点', testInfo);

      await clickBoardElement(hostPage, `[data-testid="sw-cell-${movePos.row}-${movePos.col}"]`);
      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          deckIds: state.players['0'].deck.map(card => card.id),
          oldSummoner: state.board[summonerPos.row][summonerPos.col].unit?.card.name ?? null,
          newSummoner: state.board[movePos.row][movePos.col].unit?.card.name ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        deckIds: [cardId],
        oldSummoner: null,
        newSummoner: '大议长艾迪雅',
      });
      await hostGame.screenshot('14-警告结算完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('运用：玄谜贤者攻击后可将手牌放到牌库底并伤害相邻单位', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'yongheng', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const attackerPos = { row: 4, col: 4 };
    const enemyPos = { row: 4, col: 5 };
    const cardId = 'yongheng-application-hand-e2e';

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'attack');
      addRequiredSummoners(core, { row: 3, col: 3 });
      placeUnit(core, attackerPos, makeUnit(mysterySage, 'yongheng-application-sage'));
      addEnemy(core, enemyPos, 'yongheng-application-target');
      core.players['0'].hand = [makeUnit(fortressAdvisor, cardId)];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      await triggerAttack(hostPage, attackerPos, enemyPos, [1, 1]);
      await waitForSwInteraction(hostPage, matchId, 'yongheng_application_card');
      await dismissDiceResultOverlay(hostPage);
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/运用|手牌|Application|card/i, { timeout: 8000 });
      await hostGame.screenshot('15-运用选择一张手牌', testInfo);

      await hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${cardId}"]`).first().click();
      await waitForSwInteraction(hostPage, matchId, 'yongheng_application_target');
      await expect(hostPage.getByTestId(`sw-cell-${enemyPos.row}-${enemyPos.col}`)).toHaveAttribute('data-valid-ability-unit', 'true', { timeout: 8000 });
      await hostGame.screenshot('16-运用选择相邻伤害目标', testInfo);

      const before = (await readCoreState(hostPage) as SummonerWarsCore).board[enemyPos.row][enemyPos.col].unit?.damage ?? 0;
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyPos.row}-${enemyPos.col}"][data-owner="1"]`);
      await waitForNoInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          deckIds: state.players['0'].deck.map(card => card.id),
          enemyDamage: state.board[enemyPos.row][enemyPos.col].unit?.damage ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        deckIds: [cardId],
        enemyDamage: before + 1,
      });
      await hostGame.screenshot('17-运用伤害结算完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('唤起恐惧：敌方移动到心灵骑士相邻后由目标玩家弃一张手牌', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const match = await setupSWOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, 'yongheng', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed'); return; }
    const { hostPage, guestPage, hostContext, guestContext, matchId } = match;
    const guestGame = new GameTestContext(guestPage);
    const knightPos = { row: 4, col: 4 };
    const moverStart = { row: 4, col: 2 };
    const moverEnd = { row: 4, col: 3 };
    const discardCardId = 'yongheng-fear-discard-e2e';

    try {
      const core = await readCoreState(hostPage) as SummonerWarsCore;
      resetCore(core, 'move', '1');
      addRequiredSummoners(core, { row: 3, col: 3 });
      placeUnit(core, knightPos, makeUnit(psychicKnight, 'yongheng-fear-knight'));
      placeUnit(core, moverStart, makeUnit(necroWarrior, 'yongheng-fear-mover', { life: 20, abilities: [] }), '1', {
        instanceId: 'yongheng-fear-mover-instance',
      });
      core.players['1'].hand = [makeUnit(necroWarrior, discardCardId, { abilities: [] })];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await closeDebugPanelIfOpen(guestPage);
      await waitForPhase(guestPage, 'move');

      await clickBoardElement(guestPage, `[data-testid="sw-unit-${moverStart.row}-${moverStart.col}"][data-owner="1"]`);
      await clickBoardElement(guestPage, `[data-testid="sw-cell-${moverEnd.row}-${moverEnd.col}"]`);
      await waitForSwInteraction(guestPage, matchId, 'yongheng_forced_discard');
      await expect(guestPage.getByTestId('sw-ability-prompt')).toContainText(/唤起恐惧|弃除|Fear|discard/i, { timeout: 8000 });
      await expect(guestPage.getByTestId('sw-hand-area').locator(`[data-card-id="${discardCardId}"]`).first()).toBeVisible({ timeout: 8000 });
      await guestGame.screenshot('18-唤起恐惧由目标玩家选择弃牌', testInfo);

      await guestPage.getByTestId('sw-hand-area').locator(`[data-card-id="${discardCardId}"]`).first().click();
      await waitForNoInteraction(guestPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          handIds: state.players['1'].hand.map(card => card.id),
          discardIds: state.players['1'].discard.map(card => card.id),
          moverName: state.board[moverEnd.row][moverEnd.col].unit?.card.name ?? null,
        };
      }, { timeout: 10000 }).toEqual({
        handIds: [],
        discardIds: [discardCardId],
        moverName: '亡灵战士',
      });
      await guestGame.screenshot('19-唤起恐惧弃牌结算完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });
});
