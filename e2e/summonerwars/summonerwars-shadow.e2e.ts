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
  waitForPhase,
  waitForFactionSelectionReady,
  waitForSummonerWarsUI,
} from '../helpers/summonerwars';
import { ensureGameServerAvailable, joinMatchViaAPI, seedMatchCredentials } from '../helpers/common';
import { DESKTOP_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';
import {
  CHAMPION_UNITS_SHADOW,
  COMMON_UNITS_SHADOW,
  EVENT_CARDS_SHADOW,
  SUMMONER_SHADOW,
  STRUCTURE_CARDS_SHADOW,
} from '../../src/games/summonerwars/config/factions/shadow';
import { COMMON_UNITS as COMMON_UNITS_NECROMANCER, SUMMONER_NECROMANCER } from '../../src/games/summonerwars/config/factions/necromancer';
import { getMatchState } from '../helpers/state-injection';
import type { BoardStructure, BoardUnit, CellCoord, SummonerWarsCore, UnitCard } from '../../src/games/summonerwars/domain/types';

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clearShadowScene(core: SummonerWarsCore, phase: SummonerWarsCore['phase']): SummonerWarsCore {
  const next = cloneState(core);
  for (const row of next.board) {
    for (const cell of row) {
      cell.unit = undefined;
      cell.structure = undefined;
    }
  }
  next.currentPlayer = '0';
  next.phase = phase;
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;
  next.abilityUsage = {};
  next.abilityUsageCount = {};
  next.unitKillCountThisTurn = {};
  next.players['0'].magic = 10;
  next.players['0'].hand = [];
  next.players['0'].discard = [];
  next.players['0'].activeEvents = [];
  next.players['0'].hasAttackedEnemy = false;
  next.players['0'].attackCount = 0;
  return next;
}

function placeUnit(
  core: SummonerWarsCore,
  position: CellCoord,
  card: UnitCard,
  owner: '0' | '1',
  overrides: Partial<BoardUnit> = {},
): BoardUnit {
  const unit: BoardUnit = {
    instanceId: overrides.instanceId ?? `${card.id}-shadow-e2e-${position.row}-${position.col}`,
    cardId: overrides.cardId ?? card.id,
    card: cloneState(card),
    owner,
    position,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
    ...overrides,
  };
  core.board[position.row][position.col].unit = unit;
  return unit;
}

function placeGate(core: SummonerWarsCore, position: CellCoord, owner: '0' | '1', damage = 0): BoardStructure {
  const structure: BoardStructure = {
    cardType: 'structure',
    card: { ...STRUCTURE_CARDS_SHADOW[1], id: `shadow-e2e-gate-${owner}-${position.row}-${position.col}` },
    owner,
    position,
    damage,
  };
  core.board[position.row][position.col].structure = structure;
  return structure;
}

async function readShadowInteractionType(page: import('@playwright/test').Page, matchId: string): Promise<string | null> {
  const state = await getMatchState(matchId, page) as {
    sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
  };
  return state.sys?.interaction?.current?.data?.sw?.type ?? null;
}

type ShadowInteractionOption = {
  id?: string;
  label?: string;
  value?: Record<string, unknown>;
};

async function readShadowInteraction(page: import('@playwright/test').Page, matchId: string): Promise<{
  type: string | null;
  options: ShadowInteractionOption[];
}> {
  const state = await getMatchState(matchId, page) as {
    sys?: {
      interaction?: {
        current?: {
          data?: {
            sw?: { type?: string };
            options?: ShadowInteractionOption[];
          };
        };
      };
    };
  };
  const current = state.sys?.interaction?.current;
  return {
    type: current?.data?.sw?.type ?? null,
    options: current?.data?.options ?? [],
  };
}

async function clickShadowBoardChoice(
  page: import('@playwright/test').Page,
  matchId: string,
  objectKind: 'unit' | 'structure' | 'cell',
  predicate: (option: ShadowInteractionOption) => boolean,
  highlightKind: 'unit' | 'pos' = objectKind === 'unit' ? 'unit' : 'pos',
): Promise<ShadowInteractionOption> {
  const interaction = await readShadowInteraction(page, matchId);
  const option = interaction.options.find(predicate);
  const value = option?.value;
  const position = (objectKind === 'structure'
    ? value?.gatePosition ?? value?.targetPosition
    : objectKind === 'cell'
      ? value?.newPosition ?? value?.targetPosition
      : value?.targetPosition) as CellCoord | undefined;
  if (!option || !position) {
    throw new Error(`找不到暗影精灵棋盘直选选项: ${JSON.stringify(interaction)}`);
  }
  await expect(page.getByTestId('sw-end-phase')).toBeHidden();
  await expect(page.getByTestId(`sw-cell-${position.row}-${position.col}`))
    .toHaveAttribute(`data-valid-ability-${highlightKind}`, 'true', { timeout: 8000 });
  const testId = objectKind === 'unit'
    ? `sw-unit-${position.row}-${position.col}`
    : objectKind === 'structure'
      ? `sw-structure-${position.row}-${position.col}`
      : `sw-cell-${position.row}-${position.col}`;
  await clickBoardElement(page, `[data-testid="${testId}"]`);
  return option;
}

async function setHarnessDiceValues(page: import('@playwright/test').Page, values: number[]): Promise<void> {
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

async function dismissShadowDiceOverlay(page: import('@playwright/test').Page): Promise<void> {
  const overlay = page.getByTestId('sw-dice-result-overlay');
  if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
    await overlay.click({ force: true });
    await expect(overlay).toBeHidden({ timeout: 8000 });
  }
}

async function waitForNoShadowInteraction(
  page: import('@playwright/test').Page,
  matchId: string,
): Promise<void> {
  await expect.poll(() => readShadowInteractionType(page, matchId), { timeout: 10000 }).toBeNull();
}

test.describe('召唤师战争暗影精灵真实入口', () => {
  test('从派系选择到真实开局生成暗影精灵起始部署', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({ baseURL, viewport: DESKTOP_REFERENCE_VIEWPORT });
    const guestContext = await browser.newContext({ baseURL, viewport: DESKTOP_REFERENCE_VIEWPORT });
    await initSWContext(hostContext, '__sw_shadow_entry_host');
    await initSWContext(guestContext, '__sw_shadow_entry_guest');
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const hostGame = new GameTestContext(hostPage);

    try {
      await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
      if (!(await ensureGameServerAvailable(hostPage))) {
        test.skip(true, 'Game server unavailable');
        return;
      }

      const matchId = await createSWRoomViaAPI(hostPage);
      if (!matchId) {
        test.skip(true, 'Room creation failed');
        return;
      }

      await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
      await waitForFactionSelectionReady(hostPage);

      await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
      const guestCredentials = await joinMatchViaAPI(guestPage, GAME_NAME, matchId, '1', 'Guest-SW-Shadow');
      if (!guestCredentials) {
        test.skip(true, 'Guest join failed');
        return;
      }
      await seedMatchCredentials(guestContext, GAME_NAME, matchId, '1', guestCredentials);
      await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
      await waitForFactionSelectionReady(guestPage);

      const shadowCard = getFactionCard(hostPage, 'shadow');
      const factionGrid = hostPage.getByTestId('sw-faction-grid');
      if (!(await shadowCard.isVisible().catch(() => false))) {
        await hostPage.getByTestId('sw-faction-page-next').click();
      }
      await expect.poll(async () => factionGrid.getAttribute('data-page')).toBe('2');
      await expect(shadowCard).toBeVisible({ timeout: 10000 });
      await expect(shadowCard).toBeInViewport();
      await hostPage.waitForTimeout(800);
      await hostGame.screenshot('01-暗影精灵派系入口可见', testInfo);
      await selectFactionById(hostPage, 'shadow');
      await expect(getFactionCard(hostPage, 'shadow')).toHaveAttribute('data-selected', 'true');
      await expect(getPlayerStatusCard(hostPage, '0')).toContainText(/暗影精灵|Shadow Elves/i);
      await hostGame.screenshot('02-暗影精灵派系已选择', testInfo);

      await selectFactionById(guestPage, 'necromancer');
      await clickFactionReady(guestPage);
      await expect(getFactionStartButton(hostPage)).toBeEnabled({ timeout: 10000 });
      await clickFactionStart(hostPage);
      await waitForSummonerWarsUI(hostPage, 30000);

      await expect(hostPage.locator('[data-testid^="sw-unit-"][data-unit-name="瑟伦达"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid^="sw-unit-"][data-unit-name="圣贤巡游者"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid^="sw-unit-"][data-unit-name="暗影法师"]')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.locator('[data-testid^="sw-structure-"][data-owner="0"][data-structure-name="起始城门"]')).toBeVisible({ timeout: 10000 });
      await hostGame.screenshot('03-暗影精灵真实开局布局', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面打出暗影脉冲并完成多目标选择', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    try {
      const core = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'attack');
      placeUnit(core, { row: 7, col: 3 }, SUMMONER_SHADOW, '0');
      placeUnit(core, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      placeGate(core, { row: 4, col: 4 }, '1', 1);
      const enemyTarget = placeUnit(
        core,
        { row: 4, col: 3 },
        { ...COMMON_UNITS_NECROMANCER[0], id: 'shadow-e2e-enemy-target', name: '受伤传送门旁敌方单位' },
        '1',
      );
      const friendlyTarget = placeUnit(
        core,
        { row: 3, col: 4 },
        { ...COMMON_UNITS_NECROMANCER[0], id: 'shadow-e2e-friendly-target', name: '受伤传送门旁友方单位' },
        '0',
      );
      const pulse = { ...EVENT_CARDS_SHADOW[3], id: 'shadow-shadow-pulse-0-99' };
      core.players['0'].hand = [pulse];

      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      const pulseCard = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${pulse.id}"]`).first();
      await expect(pulseCard).toBeVisible({ timeout: 8000 });
      await expect(pulseCard).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await pulseCard.click();

      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 })
        .toBe('shadow_pulse_select_targets');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/暗影脉冲|Shadow Pulse/i);
      await hostGame.screenshot('暗影脉冲真实多目标选择前', testInfo);

      await clickBoardElement(hostPage, `[data-testid="sw-cell-${enemyTarget.position.row}-${enemyTarget.position.col}"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${friendlyTarget.position.row}-${friendlyTarget.position.col}"]`);
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/2/);
      await hostPage.getByRole('button', { name: /^完成$|^Finish$/i }).click();

      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBeNull();
      await expect.poll(async () => {
        const updated = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          enemyDamage: updated.board[enemyTarget.position.row][enemyTarget.position.col].unit?.damage ?? 0,
          friendlyDamage: updated.board[friendlyTarget.position.row][friendlyTarget.position.col].unit?.damage ?? 0,
        };
      }, { timeout: 10000 }).toEqual({ enemyDamage: 1, friendlyDamage: 1 });
      await hostGame.screenshot('暗影脉冲真实多目标结算后', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面完成移动后审判与禁忌学识选择', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const sourcePosition = { row: 4, col: 2 };
    const movedPosition = { row: 4, col: 3 };

    const prepareMoveState = async (core: SummonerWarsCore) => {
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');
    };

    try {
      const judgmentCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'move');
      placeUnit(judgmentCore, { row: 7, col: 3 }, SUMMONER_SHADOW, '0');
      placeUnit(judgmentCore, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      placeUnit(
        judgmentCore,
        sourcePosition,
        { ...CHAMPION_UNITS_SHADOW[0], id: 'shadow-xumengan-0-99' },
        '0',
        { boosts: 2 },
      );
      const judgmentTarget = placeUnit(
        judgmentCore,
        { row: 4, col: 4 },
        { ...COMMON_UNITS_NECROMANCER[0], id: 'necro-judgment-target-0-99' },
        '1',
      );

      await prepareMoveState(judgmentCore);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${sourcePosition.row}-${sourcePosition.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${movedPosition.row}-${movedPosition.col}"]`);
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_judgment_select_target');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/审判|Judgment/i);
      await hostGame.screenshot('审判移动后目标与充能选择', testInfo);

      await clickShadowBoardChoice(hostPage, matchId, 'unit', (option) => {
        const value = option.value;
        return value?.action === 'shadow_judgment_target'
          && value.targetPosition
          && (value.targetPosition as CellCoord).row === judgmentTarget.position.row
          && (value.targetPosition as CellCoord).col === judgmentTarget.position.col;
      });
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_judgment_select_amount');
      await expect(hostPage.getByTestId('sw-end-phase')).toBeHidden();
      await expect(hostPage.getByRole('button', { name: /^2点$|^2 damage$/i })).toBeVisible();
      await hostPage.getByRole('button', { name: /^2点$|^2 damage$/i }).click();
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          damage: state.board[judgmentTarget.position.row][judgmentTarget.position.col].unit?.damage ?? 0,
          boosts: state.board[movedPosition.row][movedPosition.col].unit?.boosts ?? 0,
          interaction: await readShadowInteractionType(hostPage, matchId),
        };
      }, { timeout: 10000 }).toEqual({ damage: 2, boosts: 0, interaction: null });
      await hostGame.screenshot('审判消耗充能并完成伤害', testInfo);

      const forbiddenCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'move');
      placeUnit(forbiddenCore, { row: 7, col: 3 }, SUMMONER_SHADOW, '0');
      placeUnit(forbiddenCore, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      const forbiddenSource = placeUnit(
        forbiddenCore,
        sourcePosition,
        { ...COMMON_UNITS_SHADOW[0], id: 'shadow-shadow-mage-0-99' },
        '0',
      );
      placeGate(forbiddenCore, { row: 4, col: 4 }, '0');
      await prepareMoveState(forbiddenCore);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${sourcePosition.row}-${sourcePosition.col}"][data-owner="0"]`);
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${movedPosition.row}-${movedPosition.col}"]`);
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_forbidden_knowledge_select_target');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/禁忌学识|Forbidden Knowledge/i);
      await hostGame.screenshot('禁忌学识移动后自伤或传送门选择', testInfo);

      await clickShadowBoardChoice(hostPage, matchId, 'unit', (option) => {
        const value = option.value;
        return value?.action === 'shadow_forbidden_knowledge'
          && value.targetPosition
          && (value.targetPosition as CellCoord).row === movedPosition.row
          && (value.targetPosition as CellCoord).col === movedPosition.col;
      }, 'pos');
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          damage: state.board[movedPosition.row][movedPosition.col].unit?.damage ?? 0,
          handCount: state.players['0'].hand.length,
          sourceId: state.board[movedPosition.row][movedPosition.col].unit?.instanceId ?? null,
          interaction: await readShadowInteractionType(hostPage, matchId),
        };
      }, { timeout: 10000 }).toEqual({
        damage: 1,
        handCount: 1,
        sourceId: forbiddenSource.instanceId,
        interaction: null,
      });
      await hostGame.screenshot('禁忌学识自伤并抓牌完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面完成暗影召唤与急袭召唤后选择', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const gatePosition = { row: 4, col: 2 };
    const summonPosition = { row: 4, col: 3 };

    const prepareSummonState = async (core: SummonerWarsCore, card: UnitCard) => {
      core.players['0'].hand = [card];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');
      const handCard = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${card.id}"]`).first();
      await expect(handCard).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await handCard.click();
      await expect(hostPage.getByTestId(`sw-cell-${summonPosition.row}-${summonPosition.col}`)).toHaveAttribute('data-valid-summon', 'true', { timeout: 8000 });
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${summonPosition.row}-${summonPosition.col}"]`);
    };

    try {
      const shadowSummonCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'summon');
      placeUnit(shadowSummonCore, { row: 7, col: 3 }, SUMMONER_SHADOW, '0');
      placeUnit(shadowSummonCore, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      placeGate(shadowSummonCore, gatePosition, '0');
      const shadowKnight = { ...COMMON_UNITS_SHADOW[2], id: 'shadow-shadow-knight-0-99' };
      const shadowSummonTarget = placeUnit(
        shadowSummonCore,
        { row: 4, col: 5 },
        { ...COMMON_UNITS_SHADOW[0], id: 'shadow-shadow-mage-target-0-99' },
        '0',
      );
      await prepareSummonState(shadowSummonCore, shadowKnight);
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_shadow_summon_select_target');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/暗影召唤|Shadow Summon/i);
      await hostGame.screenshot('暗影召唤选择目标与放置位置', testInfo);
      await clickShadowBoardChoice(hostPage, matchId, 'unit', (option) => {
        const value = option.value;
        return value?.action === 'shadow_shadow_summon_target'
          && value.targetPosition
          && (value.targetPosition as CellCoord).row === shadowSummonTarget.position.row
          && (value.targetPosition as CellCoord).col === shadowSummonTarget.position.col;
      }, 'pos');
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_shadow_summon_select_position');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/空格|placement/i);
      await hostGame.screenshot('暗影召唤选中目标后选择放置格', testInfo);
      await clickShadowBoardChoice(hostPage, matchId, 'cell', (option) => {
        const value = option.value;
        return value?.action === 'shadow_shadow_summon'
          && value.newPosition
          && (value.newPosition as CellCoord).row === 4
          && (value.newPosition as CellCoord).col === 4;
      });
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          movedId: state.board[4][4].unit?.cardId ?? null,
          targetDamage: state.board[4][5].unit?.damage ?? 0,
          cardInHand: state.players['0'].hand.some((card) => card.id === shadowKnight.id),
          interaction: await readShadowInteractionType(hostPage, matchId),
        };
      }, { timeout: 10000 }).toEqual({
        movedId: shadowKnight.id,
        targetDamage: 1,
        cardInHand: false,
        interaction: null,
      });
      await hostGame.screenshot('暗影召唤完成位移与伤害', testInfo);

      const assaultCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'summon');
      placeUnit(assaultCore, { row: 7, col: 3 }, SUMMONER_SHADOW, '0');
      placeUnit(assaultCore, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      placeGate(assaultCore, gatePosition, '0');
      const sageRover = { ...COMMON_UNITS_SHADOW[3], id: 'shadow-sage-rover-0-99' };
      await prepareSummonState(assaultCore, sageRover);
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_sudden_assault_select_position');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/急袭|Sudden Assault/i);
      await hostGame.screenshot('急袭召唤后推拉选择', testInfo);
      await clickShadowBoardChoice(hostPage, matchId, 'cell', (option) => {
        const value = option.value;
        return value?.action === 'shadow_sudden_assault'
          && value.newPosition
          && (value.newPosition as CellCoord).row === 4
          && (value.newPosition as CellCoord).col === 4;
      });
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          movedId: state.board[4][4].unit?.cardId ?? null,
          sourceEmpty: state.board[summonPosition.row][summonPosition.col].unit == null,
          cardInHand: state.players['0'].hand.some((card) => card.id === sageRover.id),
          interaction: await readShadowInteractionType(hostPage, matchId),
        };
      }, { timeout: 10000 }).toEqual({
        movedId: sageRover.id,
        sourceEmpty: true,
        cardInHand: false,
        interaction: null,
      });
      await hostGame.screenshot('急袭完成召唤后推拉', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面完成回归暗影并触发迅如闪电替换', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const summonerPosition = { row: 4, col: 2 };
    const returnedUnitPosition = { row: 4, col: 4 };
    const replacementCard = { ...COMMON_UNITS_SHADOW[0], id: 'shadow-shadow-mage-return-0-99' };
    const lightningStep = { ...EVENT_CARDS_SHADOW[2], id: 'shadow-lightning-step-0-99' };

    try {
      const core = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'attack');
      placeUnit(core, summonerPosition, SUMMONER_SHADOW, '0', { boosts: 2 });
      placeUnit(core, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      placeUnit(core, returnedUnitPosition, replacementCard, '0');
      core.players['0'].hand = [lightningStep];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');

      const lightningCard = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${lightningStep.id}"]`).first();
      await expect(lightningCard).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await lightningCard.click();
      await lightningCard.click();
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          active: state.players['0'].activeEvents.some((card) => card.id === lightningStep.id),
          inHand: state.players['0'].hand.some((card) => card.id === lightningStep.id),
        };
      }, { timeout: 10000 }).toEqual({ active: true, inHand: false });

      await clickBoardElement(hostPage, `[data-testid="sw-unit-${summonerPosition.row}-${summonerPosition.col}"][data-owner="0"]`);
      const returnButton = hostPage.getByRole('button', { name: /回归暗影|Return to Shadow/i });
      await expect(returnButton).toBeVisible({ timeout: 8000 });
      await hostGame.screenshot('回归暗影主动技能入口', testInfo);
      await returnButton.click();
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('activated_ability_target');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/回归暗影|Return to Shadow/i);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${returnedUnitPosition.row}-${returnedUnitPosition.col}"][data-owner="0"]`);
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_lightning_step');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/迅如闪电|Lightning Step/i);
      await hostGame.screenshot('迅如闪电替换提示', testInfo);
      await hostPage.getByRole('button', { name: /使用迅闪步|Use Swift Step/i }).click();

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          summonerPosition: state.board[returnedUnitPosition.row][returnedUnitPosition.col].unit?.instanceId ?? null,
          oldSummonerEmpty: state.board[summonerPosition.row][summonerPosition.col].unit == null,
          returnedUnitInHand: state.players['0'].hand.some((card) => card.id === replacementCard.id),
          lightningStillActive: state.players['0'].activeEvents.some((card) => card.id === lightningStep.id),
          interaction: await readShadowInteractionType(hostPage, matchId),
        };
      }, { timeout: 10000 }).toEqual({
        summonerPosition: expect.any(String),
        oldSummonerEmpty: true,
        returnedUnitInHand: true,
        lightningStillActive: true,
        interaction: null,
      });
      await hostGame.screenshot('迅如闪电完成召唤师替换', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面完成隐入黑暗与玛尔典籍两步事件选择', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const summonerPosition = { row: 4, col: 2 };

    try {
      const hideCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'build');
      placeUnit(hideCore, summonerPosition, SUMMONER_SHADOW, '0');
      placeUnit(hideCore, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      const hiddenTarget = placeUnit(
        hideCore,
        { row: 4, col: 3 },
        { ...COMMON_UNITS_NECROMANCER[0], id: 'necro-hidden-target-0-99' },
        '1',
        { damage: 1 },
      );
      const hideCard = { ...EVENT_CARDS_SHADOW[0], id: 'shadow-hide-in-darkness-0-99' };
      hideCore.players['0'].hand = [hideCard];
      await applyCoreState(hostPage, hideCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'build');

      const hideHandCard = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${hideCard.id}"]`).first();
      await expect(hideHandCard).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await hideHandCard.click();
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('event_target');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/隐入黑暗|Hide in Darkness/i);
      await expect(hostPage.getByTestId(`sw-cell-${hiddenTarget.position.row}-${hiddenTarget.position.col}`)).toHaveAttribute('data-valid-event-target', 'true', { timeout: 8000 });
      await hostGame.screenshot('隐入黑暗选择受伤单位', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${hiddenTarget.position.row}-${hiddenTarget.position.col}"][data-owner="1"]`);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          removed: state.board[hiddenTarget.position.row][hiddenTarget.position.col].unit == null,
          returned: state.players['1'].hand.some((card) => card.id === hiddenTarget.card.id),
          interaction: await readShadowInteractionType(hostPage, matchId),
        };
      }, { timeout: 10000 }).toEqual({ removed: true, returned: true, interaction: null });
      await hostGame.screenshot('隐入黑暗完成回手', testInfo);

      const marlCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'summon');
      placeUnit(marlCore, summonerPosition, SUMMONER_SHADOW, '0');
      placeUnit(marlCore, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      const damageTarget = placeUnit(
        marlCore,
        { row: 4, col: 3 },
        { ...COMMON_UNITS_SHADOW[0], id: 'shadow-marl-damage-target-0-99' },
        '0',
      );
      const marlCard = { ...EVENT_CARDS_SHADOW[1], id: 'shadow-marl-grimoire-0-99' };
      const retrievedCard = { ...COMMON_UNITS_SHADOW[1], id: 'shadow-truth-seeker-discard-0-99' };
      marlCore.players['0'].hand = [marlCard];
      marlCore.players['0'].discard = [retrievedCard];
      await applyCoreState(hostPage, marlCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');

      const marlHandCard = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${marlCard.id}"]`).first();
      await expect(marlHandCard).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await marlHandCard.click();
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_marl_select_card');
      await expect(hostPage.getByTestId('sw-card-selector-overlay')).toBeVisible({ timeout: 8000 });
      await hostGame.screenshot('玛尔典籍选择弃牌回收卡牌', testInfo);
      await hostPage.getByTestId('sw-card-selector-overlay').locator(`[data-card-id="${retrievedCard.id}"]`).click();
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_marl_select_damage');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/玛尔典籍|Marl Grimoire/i);
      await expect(hostPage.getByTestId(`sw-cell-${damageTarget.position.row}-${damageTarget.position.col}`)).toHaveAttribute('data-valid-event-target', 'true', { timeout: 8000 });
      await hostGame.screenshot('玛尔典籍第一次友方伤害选择', testInfo);
      const damageTargetSelector = `[data-testid="sw-unit-${damageTarget.position.row}-${damageTarget.position.col}"][data-owner="0"]`;
      await clickBoardElement(hostPage, damageTargetSelector);
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_marl_select_damage');
      await expect(hostPage.getByTestId(`sw-cell-${damageTarget.position.row}-${damageTarget.position.col}`)).toHaveAttribute('data-valid-event-target', 'true', { timeout: 8000 });
      await clickBoardElement(hostPage, damageTargetSelector);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          damage: state.board[damageTarget.position.row][damageTarget.position.col].unit?.damage ?? 0,
          retrieved: state.players['0'].hand.some((card) => card.id === retrievedCard.id),
          marlInHand: state.players['0'].hand.some((card) => card.id === marlCard.id),
          marlInDiscard: state.players['0'].discard.some((card) => card.id === marlCard.id),
          interaction: await readShadowInteractionType(hostPage, matchId),
        };
      }, { timeout: 10000 }).toEqual({
        damage: 2,
        retrieved: true,
        marlInHand: false,
        marlInDiscard: true,
        interaction: null,
      });
      await hostGame.screenshot('玛尔典籍两次友方伤害与回收完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面触发鲜血魔法与黑暗预言的离场结算', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const summonerPosition = { row: 4, col: 2 };
    const targetPosition = { row: 4, col: 3 };
    const gatePosition = { row: 4, col: 4 };

    const preparePulse = async (
      core: SummonerWarsCore,
      target: BoardUnit,
      pulseId: string,
      source?: BoardUnit,
    ) => {
      placeUnit(core, summonerPosition, SUMMONER_SHADOW, '0');
      placeUnit(core, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      if (source) {
        core.board[source.position.row][source.position.col].unit = source;
      }
      core.board[target.position.row][target.position.col].unit = target;
      placeGate(core, gatePosition, '1', 1);
      const pulse = { ...EVENT_CARDS_SHADOW[3], id: pulseId };
      core.players['0'].hand = [pulse];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      const handCard = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${pulse.id}"]`).first();
      await expect(handCard).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await handCard.click();
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 })
        .toBe('shadow_pulse_select_targets');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/暗影脉冲|Shadow Pulse/i);
      await hostGame.screenshot(`暗影脉冲触发${target.card.name}受伤结算前`, testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${targetPosition.row}-${targetPosition.col}"]`);
      await hostPage.getByRole('button', { name: /^完成$|^Finish$/i }).click();
      await waitForNoShadowInteraction(hostPage, matchId);
      await dismissShadowDiceOverlay(hostPage);
    };

    try {
      const bloodCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'attack');
      const bloodTarget: BoardUnit = {
        instanceId: 'shadow-blood-target-0-99',
        cardId: COMMON_UNITS_SHADOW[0].id,
        card: { ...COMMON_UNITS_SHADOW[0], id: 'shadow-blood-target-card-0-99' },
        owner: '0',
        position: targetPosition,
        damage: 0,
        boosts: 0,
        hasMoved: false,
        hasAttacked: false,
      };
      await preparePulse(bloodCore, bloodTarget, 'shadow-shadow-pulse-90');
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          targetDamage: state.board[targetPosition.row][targetPosition.col].unit?.damage ?? null,
          summonerBoosts: state.board[summonerPosition.row][summonerPosition.col].unit?.boosts ?? null,
        };
      }, { timeout: 10000 }).toEqual({ targetDamage: 1, summonerBoosts: 1 });
      await hostGame.screenshot('鲜血魔法按友方卡牌受伤充能完成', testInfo);

      const prophecyCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'attack');
      const prophecySource = placeUnit(
        prophecyCore,
        { row: 3, col: 2 },
        { ...CHAMPION_UNITS_SHADOW[0], id: 'shadow-xumengan-prophecy-0-99' },
        '0',
      );
      const prophecyTarget: BoardUnit = {
        instanceId: 'shadow-prophecy-target-0-99',
        cardId: COMMON_UNITS_SHADOW[0].id,
        card: { ...COMMON_UNITS_SHADOW[0], id: 'shadow-prophecy-target-card-0-99' },
        owner: '0',
        position: targetPosition,
        damage: 3,
        boosts: 0,
        hasMoved: false,
        hasAttacked: false,
      };
      await preparePulse(prophecyCore, prophecyTarget, 'shadow-shadow-pulse-91', prophecySource);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        const sourceAfter = state.board[prophecySource.position.row][prophecySource.position.col].unit;
        return {
          targetOnBoard: !!state.board[targetPosition.row][targetPosition.col].unit,
          targetInDiscard: state.players['0'].discard.some(card => card.id === prophecyTarget.card.id),
          sourceBoosts: sourceAfter?.boosts ?? null,
        };
      }, { timeout: 10000 }).toEqual({ targetOnBoard: false, targetInDiscard: true, sourceBoosts: 1 });
      await hostGame.screenshot('黑暗预言在友方单位离场后充能完成', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面完成撕裂帷幕传送并验证可跳过', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const sourcePosition = { row: 4, col: 1 };
    const movedPosition = { row: 4, col: 2 };
    const gatePosition = { row: 4, col: 3 };
    const targetPosition = { row: 4, col: 0 };
    const destinationPosition = { row: 4, col: 4 };

    const prepare = async (id: string) => {
      const core = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'move');
      placeUnit(core, { row: 7, col: 3 }, SUMMONER_SHADOW, '0');
      placeUnit(core, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      placeUnit(core, sourcePosition, { ...CHAMPION_UNITS_SHADOW[1], id: `shadow-talia-${id}` }, '0');
      placeUnit(core, targetPosition, { ...COMMON_UNITS_SHADOW[3], id: `shadow-sage-target-${id}` }, '0');
      placeGate(core, gatePosition, '1', 1);
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${sourcePosition.row}-${sourcePosition.col}"][data-owner="0"]`);
      await expect(hostPage.getByTestId(`sw-cell-${movedPosition.row}-${movedPosition.col}`))
        .toHaveAttribute('data-valid-move', 'true', { timeout: 8000 });
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${movedPosition.row}-${movedPosition.col}"]`);
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 })
        .toBe('shadow_tear_the_veil_select_unit');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/撕裂帷幕|Tear the Veil/i);
    };

    try {
      await prepare('move');
      await hostGame.screenshot('撕裂帷幕选择友方士兵传送', testInfo);
      await clickShadowBoardChoice(hostPage, matchId, 'unit', (option) => {
        const value = option.value;
        return value?.action === 'shadow_tear_the_veil_target_unit'
          && value.targetUnitId === `shadow-sage-target-move-shadow-e2e-${targetPosition.row}-${targetPosition.col}`
          && (value.targetPosition as CellCoord | undefined)?.row === targetPosition.row
          && (value.targetPosition as CellCoord | undefined)?.col === targetPosition.col;
      });
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 })
        .toBe('shadow_tear_the_veil_select_gate');
      await clickShadowBoardChoice(hostPage, matchId, 'structure', (option) => {
        const value = option.value;
        const gate = value?.gatePosition as CellCoord | undefined;
        return value?.action === 'shadow_tear_the_veil_target_gate'
          && gate?.row === gatePosition.row
          && gate?.col === gatePosition.col;
      });
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 })
        .toBe('shadow_tear_the_veil_select_position');
      await clickShadowBoardChoice(hostPage, matchId, 'cell', (option) => {
        const value = option.value;
        const newPosition = value?.newPosition as CellCoord | undefined;
        const gate = value?.gatePosition as CellCoord | undefined;
        return value?.action === 'shadow_tear_the_veil'
          && value.targetUnitId === `shadow-sage-target-move-shadow-e2e-${targetPosition.row}-${targetPosition.col}`
          && gate?.row === gatePosition.row
          && gate?.col === gatePosition.col
          && newPosition?.row === destinationPosition.row
          && newPosition?.col === destinationPosition.col;
      });
      await waitForNoShadowInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          sourceEmpty: state.board[targetPosition.row][targetPosition.col].unit == null,
          movedName: state.board[destinationPosition.row][destinationPosition.col].unit?.card.name ?? null,
        };
      }, { timeout: 10000 }).toEqual({ sourceEmpty: true, movedName: '圣贤巡游者' });
      await hostGame.screenshot('撕裂帷幕完成友方士兵传送', testInfo);

      await prepare('skip');
      await hostPage.getByTestId('sw-ability-prompt').first().getByRole('button', { name: /^跳过$|^Skip$/i }).first().click();
      await waitForNoShadowInteraction(hostPage, matchId);
      await expect.poll(async () => (await readCoreState(hostPage) as SummonerWarsCore)
        .board[targetPosition.row][targetPosition.col].unit?.card.name ?? null).toBe('圣贤巡游者');
      await hostGame.screenshot('撕裂帷幕跳过后保持原位', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面结算难逃厄运的击杀与未击杀分支', async ({ browser }, testInfo) => {
    test.setTimeout(240000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;
    const hostGame = new GameTestContext(hostPage);
    const samaraPosition = { row: 4, col: 3 };
    const ownSummonerPosition = { row: 7, col: 3 };
    const enemySummonerPosition = { row: 0, col: 2 };

    const prepare = async (id: string, killed: boolean) => {
      const core = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'attack');
      placeUnit(core, ownSummonerPosition, SUMMONER_SHADOW, '0');
      placeUnit(core, enemySummonerPosition, SUMMONER_NECROMANCER, '1');
      const samara = placeUnit(core, samaraPosition, { ...CHAMPION_UNITS_SHADOW[2], id: `shadow-samara-${id}` }, '0');
      core.players['0'].hasAttackedEnemy = true;
      core.unitKillCountThisTurn = killed ? { [samara.instanceId]: 1 } : {};
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
    };

    try {
      await prepare('kill', true);
      await hostGame.screenshot('难逃厄运击杀分支触发前', testInfo);
      await hostPage.getByTestId('sw-end-phase').click();
      await waitForPhase(hostPage, 'magic');
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          enemyDamage: state.board[enemySummonerPosition.row][enemySummonerPosition.col].unit?.damage ?? null,
          ownDamage: state.board[ownSummonerPosition.row][ownSummonerPosition.col].unit?.damage ?? null,
        };
      }, { timeout: 10000 }).toEqual({ enemyDamage: 1, ownDamage: 0 });
      await hostGame.screenshot('难逃厄运击杀分支伤害敌方召唤师', testInfo);

      await prepare('no-kill', false);
      await hostGame.screenshot('难逃厄运未击杀分支触发前', testInfo);
      await hostPage.getByTestId('sw-end-phase').click();
      await waitForPhase(hostPage, 'magic');
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          enemyDamage: state.board[enemySummonerPosition.row][enemySummonerPosition.col].unit?.damage ?? null,
          ownDamage: state.board[ownSummonerPosition.row][ownSummonerPosition.col].unit?.damage ?? null,
        };
      }, { timeout: 10000 }).toEqual({ enemyDamage: 0, ownDamage: 1 });
      await hostGame.screenshot('难逃厄运未击杀分支伤害己方召唤师', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面验证真实探求者猛攻与佯攻的攻击后选择', async ({ browser }, testInfo) => {
    test.setTimeout(300000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    const attackerPosition = { row: 4, col: 2 };
    const targetPosition = { row: 4, col: 3 };
    const retreatPosition = { row: 4, col: 0 };

    const prepare = async (id: string) => {
      const core = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'attack');
      placeUnit(core, { row: 7, col: 3 }, SUMMONER_SHADOW, '0');
      placeUnit(core, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      placeUnit(core, attackerPosition, { ...COMMON_UNITS_SHADOW[1], id: `shadow-truth-seeker-${id}` }, '0', {
        summonedTurnNumber: core.turnNumber,
      });
      placeUnit(core, targetPosition, {
        ...COMMON_UNITS_NECROMANCER[0],
        id: `shadow-feint-target-${id}`,
        life: 20,
      }, '1');
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${attackerPosition.row}-${attackerPosition.col}"][data-owner="0"]`);
      await expect(hostPage.getByTestId(`sw-cell-${targetPosition.row}-${targetPosition.col}`))
        .toHaveAttribute('data-valid-attack', 'true', { timeout: 8000 });
      await setHarnessDiceValues(hostPage, [6, 6, 6]);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${targetPosition.row}-${targetPosition.col}"][data-owner="1"]`);
      await expect(hostPage.getByTestId('sw-dice-result-overlay')).toBeVisible({ timeout: 10000 });
      const matchState = await getMatchState(matchId, hostPage) as {
        sys?: {
          eventStream?: {
            entries?: Array<{
              event?: { type?: string; payload?: { diceCount?: number } };
            }>;
          };
        };
      };
      const attackEntry = [...(matchState.sys?.eventStream?.entries ?? [])]
        .reverse()
        .find((entry) => entry.event?.type === 'sw:unit_attacked');
      expect(attackEntry?.event?.payload?.diceCount).toBe(3);
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 }).toBe('shadow_feint_select_position');
      await expect(hostPage.getByTestId('sw-ability-prompt')).toContainText(/佯攻|Feint/i);
    };

    try {
      await prepare('move');
      await dismissShadowDiceOverlay(hostPage);
      await hostGame.screenshot('猛攻增加真实探求者当回合攻击骰数并出现佯攻', testInfo);
      await clickShadowBoardChoice(hostPage, matchId, 'cell', (option) => {
        const value = option.value;
        const newPosition = value?.newPosition as CellCoord | undefined;
        return value?.action === 'shadow_feint'
          && newPosition?.row === retreatPosition.row
          && newPosition?.col === retreatPosition.col;
      });
      await waitForNoShadowInteraction(hostPage, matchId);
      await dismissShadowDiceOverlay(hostPage);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          attackerName: state.board[retreatPosition.row][retreatPosition.col].unit?.card.name ?? null,
          targetDamage: state.board[targetPosition.row][targetPosition.col].unit?.damage ?? 0,
        };
      }, { timeout: 10000 }).toEqual({ attackerName: '真实探求者', targetDamage: expect.any(Number) });
      const movedState = await readCoreState(hostPage) as SummonerWarsCore;
      expect(movedState.board[targetPosition.row][targetPosition.col].unit?.damage ?? 0).toBeGreaterThan(0);
      await hostGame.screenshot('佯攻完成真实探求者两格内推拉', testInfo);

      await prepare('skip');
      await hostPage.getByTestId('sw-ability-prompt').first().getByRole('button', { name: /^跳过$|^Skip$/i }).first().click();
      await waitForNoShadowInteraction(hostPage, matchId);
      await dismissShadowDiceOverlay(hostPage);
      await expect.poll(async () => (await readCoreState(hostPage) as SummonerWarsCore)
        .board[attackerPosition.row][attackerPosition.col].unit?.card.name ?? null).toBe('真实探求者');
      await hostGame.screenshot('佯攻跳过后真实探求者保持原位', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test('真实页面验证死亡契约与穿透之光最终结算', async ({ browser }, testInfo) => {
    test.setTimeout(300000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'shadow', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const hostGame = new GameTestContext(hostPage);
    try {
      const deathCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'attack');
      const summonerPosition = { row: 4, col: 1 };
      const knightPosition = { row: 4, col: 3 };
      const gatePosition = { row: 4, col: 4 };
      placeUnit(deathCore, summonerPosition, SUMMONER_SHADOW, '0');
      placeUnit(deathCore, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      const knight = placeUnit(deathCore, knightPosition, { ...COMMON_UNITS_SHADOW[2], id: 'shadow-death-pact-knight-0-99' }, '0', {
        damage: 4,
      });
      placeGate(deathCore, gatePosition, '1', 1);
      const pulse = { ...EVENT_CARDS_SHADOW[3], id: 'shadow-shadow-pulse-92' };
      deathCore.players['0'].hand = [pulse];
      await applyCoreState(hostPage, deathCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      const pulseCard = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${pulse.id}"]`).first();
      await expect(pulseCard).toHaveAttribute('data-can-play', 'true', { timeout: 8000 });
      await pulseCard.click();
      await expect.poll(() => readShadowInteractionType(hostPage, matchId), { timeout: 10000 })
        .toBe('shadow_pulse_select_targets');
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${knightPosition.row}-${knightPosition.col}"][data-owner="0"]`);
      await hostPage.getByRole('button', { name: /^完成$|^Finish$/i }).click();
      await waitForNoShadowInteraction(hostPage, matchId);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          knightOnBoard: !!state.board[knightPosition.row][knightPosition.col].unit,
          knightInDiscard: state.players['0'].discard.some(card => card.id === knight.cardId),
          summonerDamage: state.board[summonerPosition.row][summonerPosition.col].unit?.damage ?? null,
        };
      }, { timeout: 10000 }).toEqual({ knightOnBoard: false, knightInDiscard: true, summonerDamage: 1 });
      await hostGame.screenshot('死亡契约在暗影骑士被消灭后伤害己方召唤师', testInfo);

      const piercingCore = clearShadowScene(await readCoreState(hostPage) as SummonerWarsCore, 'attack');
      const attackerPosition = { row: 4, col: 1 };
      const screenPosition = { row: 4, col: 2 };
      const targetPosition = { row: 4, col: 3 };
      placeUnit(piercingCore, { row: 7, col: 3 }, SUMMONER_SHADOW, '0');
      placeUnit(piercingCore, { row: 0, col: 2 }, SUMMONER_NECROMANCER, '1');
      placeUnit(piercingCore, attackerPosition, { ...COMMON_UNITS_SHADOW[3], id: 'shadow-piercing-sage-0-99' }, '0', {
        summonedTurnNumber: piercingCore.turnNumber,
      });
      placeUnit(piercingCore, screenPosition, { ...COMMON_UNITS_NECROMANCER[0], id: 'shadow-piercing-screen-0-99', life: 20 }, '1');
      placeUnit(piercingCore, targetPosition, { ...COMMON_UNITS_NECROMANCER[0], id: 'shadow-piercing-target-0-99', life: 20 }, '1');
      await applyCoreState(hostPage, piercingCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${attackerPosition.row}-${attackerPosition.col}"][data-owner="0"]`);
      await expect(hostPage.getByTestId(`sw-cell-${targetPosition.row}-${targetPosition.col}`))
        .toHaveAttribute('data-valid-attack', 'true', { timeout: 8000 });
      await setHarnessDiceValues(hostPage, [6, 6]);
      await hostPage.screenshot('穿透之光允许远程攻击穿过单位', testInfo);
      await clickBoardElement(hostPage, `[data-testid="sw-unit-${targetPosition.row}-${targetPosition.col}"][data-owner="1"]`);
      await expect(hostPage.getByTestId('sw-dice-result-overlay')).toBeVisible({ timeout: 10000 });
      const matchState = await getMatchState(matchId, hostPage) as {
        sys?: {
          eventStream?: {
            entries?: Array<{
              event?: { type?: string; payload?: { diceCount?: number } };
            }>;
          };
        };
      };
      const attackEntry = [...(matchState.sys?.eventStream?.entries ?? [])]
        .reverse()
        .find((entry) => entry.event?.type === 'sw:unit_attacked');
      expect(attackEntry?.event?.payload?.diceCount).toBe(2);
      await dismissShadowDiceOverlay(hostPage);
      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as SummonerWarsCore;
        return {
          screenDamage: state.board[screenPosition.row][screenPosition.col].unit?.damage ?? null,
          targetDamage: state.board[targetPosition.row][targetPosition.col].unit?.damage ?? null,
        };
      }, { timeout: 10000 }).toEqual({ screenDamage: 0, targetDamage: expect.any(Number) });
      const piercingState = await readCoreState(hostPage) as SummonerWarsCore;
      expect(piercingState.board[targetPosition.row][targetPosition.col].unit?.damage ?? 0).toBeGreaterThan(0);
      await hostGame.screenshot('穿透之光完成隔单位攻击结算', testInfo);
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });
});
