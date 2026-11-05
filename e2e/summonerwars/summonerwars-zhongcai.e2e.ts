/**
 * 召唤师战争 - 仲裁派系真实入口与交互验收
 *
 * 覆盖：真实联机派系选择/开局、服从、圣言、抹消、鼓舞、律令。
 */

import { test, expect } from '../framework';
import { getEvidenceScreenshotPath, clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { getMatchState } from '../helpers/state-injection';
import {
  applyCoreState,
  clickBoardElement,
  closeDebugPanelIfOpen,
  readCoreState,
  setupSWOnlineMatch,
  waitForPhase,
  waitForSummonerWarsUI,
} from '../helpers/summonerwars';
import {
  CHAMPION_UNITS_ZHONGCAI,
  COMMON_UNITS_ZHONGCAI,
  EVENT_CARDS_ZHONGCAI,
  STRUCTURE_CARDS_ZHONGCAI,
  SUMMONER_ZHONGCAI,
} from '../../src/games/summonerwars/config/factions/zhongcai';

type CoreState = any;

const screenshot = async (page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo, name: string) => {
  await page.screenshot({
    path: getEvidenceScreenshotPath(testInfo, name, {
      filename: `${name}.jpg`,
      requireChineseName: true,
    }),
    type: 'jpeg',
    quality: 90,
    fullPage: false,
  });
};

const assertVisibleCellHighlight = async (
  page: import('@playwright/test').Page,
  selector: string,
  label: string,
) => {
  const visual = await page.locator(selector).evaluate((cell) => {
    const highlight = cell.firstElementChild;
    if (!(highlight instanceof HTMLElement)) {
      return { visible: false, reason: 'missing-highlight-layer' };
    }
    const style = window.getComputedStyle(highlight);
    const rect = highlight.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const opacity = Number.parseFloat(style.opacity || '0');
    return {
      visible: style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.isFinite(opacity)
        && opacity > 0
        && rect.width > 0
        && rect.height > 0,
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
      borderColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
      highlightWidth: rect.width,
      highlightHeight: rect.height,
      cellWidth: cellRect.width,
      cellHeight: cellRect.height,
    };
  });
  expect(visual.visible, `${label}：合法候选必须有实际可见的高亮层`).toBe(true);
  expect(visual.borderStyle, `${label}：高亮必须绘制边界`).toBe('solid');
  expect(visual.borderWidth, `${label}：高亮边界不能退化为 0`).not.toBe('0px');
  expect(visual.highlightWidth, `${label}：高亮宽度必须贴合格子`).toBeGreaterThan(0);
  expect(visual.highlightHeight, `${label}：高亮高度必须贴合格子`).toBeGreaterThan(0);
  expect(visual.highlightWidth / visual.cellWidth, `${label}：高亮不能脱离格子本体`).toBeGreaterThan(0.9);
  expect(visual.highlightHeight / visual.cellHeight, `${label}：高亮不能脱离格子本体`).toBeGreaterThan(0.9);
};

const assertAllVisibleCellHighlights = async (
  page: import('@playwright/test').Page,
  selector: string,
  label: string,
) => {
  const visuals = await page.locator(selector).evaluateAll((cells) => cells.map((cell) => {
    const highlight = cell.firstElementChild;
    if (!(highlight instanceof HTMLElement)) {
      return { visible: false, reason: 'missing-highlight-layer' };
    }
    const style = window.getComputedStyle(highlight);
    const rect = highlight.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const opacity = Number.parseFloat(style.opacity || '0');
    return {
      visible: style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.isFinite(opacity)
        && opacity > 0
        && rect.width > 0
        && rect.height > 0,
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
      highlightWidth: rect.width,
      highlightHeight: rect.height,
      cellWidth: cellRect.width,
      cellHeight: cellRect.height,
    };
  }));
  expect(visuals.length, `${label}：必须至少存在一个合法候选`).toBeGreaterThan(0);
  visuals.forEach((visual, index) => {
    expect(visual.visible, `${label}：第 ${index + 1} 个候选没有实际可见的高亮层`).toBe(true);
    expect(visual.borderStyle, `${label}：第 ${index + 1} 个候选高亮必须绘制边界`).toBe('solid');
    expect(visual.borderWidth, `${label}：第 ${index + 1} 个候选高亮边界不能退化为 0`).not.toBe('0px');
    expect(visual.highlightWidth / visual.cellWidth, `${label}：第 ${index + 1} 个候选高亮不能脱离格子本体`).toBeGreaterThan(0.9);
    expect(visual.highlightHeight / visual.cellHeight, `${label}：第 ${index + 1} 个候选高亮不能脱离格子本体`).toBeGreaterThan(0.9);
  });
};

const clearAndPrepareCore = (source: CoreState, phase: string): CoreState => {
  const next = JSON.parse(JSON.stringify(source)) as CoreState;
  next.phase = phase;
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;
  next.abilityUsage = {};
  next.abilityUsageCount = {};
  next.board = next.board.map((row: CoreState[]) => row.map((cell: CoreState) => ({
    ...cell,
    unit: undefined,
    structure: undefined,
  })));
  for (const playerId of ['0', '1']) {
    const player = next.players[playerId];
    if (!player) continue;
    player.hand = [];
    player.activeEvents = [];
    player.discard = [];
    player.moveCount = 0;
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
    player.magic = 10;
  }
  return next;
};

const putUnit = (
  core: CoreState,
  position: { row: number; col: number },
  card: CoreState,
  owner: '0' | '1',
  overrides: CoreState = {},
) => {
  const id = `${card.id}-${owner}-${position.row}-${position.col}`;
  const unit = {
    instanceId: id,
    cardId: id,
    card: { ...card, id },
    owner,
    position,
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
    ...overrides,
  };
  core.board[position.row][position.col].unit = unit;
  return unit;
};

const putStructure = (core: CoreState, position: { row: number; col: number }, owner: '0' | '1') => {
  const base = STRUCTURE_CARDS_ZHONGCAI[0];
  const id = `${base.id}-${owner}-${position.row}-${position.col}`;
  core.board[position.row][position.col].structure = {
    cardId: id,
    card: { ...base, id },
    owner,
    position,
    damage: 0,
  };
};

const putOpponentSummoner = (core: CoreState, source: CoreState) => {
  const opponentSummoner = source.board
    .flatMap((row: CoreState[]) => row.map((cell: CoreState) => cell.unit))
    .find((unit: CoreState) => unit?.owner === '1' && unit.card?.unitClass === 'summoner');
  if (!opponentSummoner) {
    throw new Error('仲裁 E2E 夹具缺少真实对手召唤师，不能安全执行交互验收');
  }
  putUnit(core, opponentSummoner.position, opponentSummoner.card, '1');
};

const putOwnSummoner = (core: CoreState, source: CoreState) => {
  const ownSummoner = source.board
    .flatMap((row: CoreState[]) => row.map((cell: CoreState) => cell.unit))
    .find((unit: CoreState) => unit?.owner === '0' && unit.card?.unitClass === 'summoner');
  if (!ownSummoner) {
    throw new Error('仲裁 E2E 夹具缺少真实己方召唤师，不能安全执行交互验收');
  }
  putUnit(core, ownSummoner.position, ownSummoner.card, '0');
};

const cardWithInstanceId = (card: CoreState, id: string) => ({ ...card, id });

const readInteraction = async (matchId: string, page: import('@playwright/test').Page): Promise<CoreState | null> => {
  const state = await getMatchState(matchId, page) as CoreState;
  return state?.sys?.interaction?.current ?? null;
};

const waitForInteractionType = async (
  matchId: string,
  page: import('@playwright/test').Page,
  type: string,
) => {
  await expect.poll(
    async () => (await readInteraction(matchId, page))?.data?.sw?.type ?? null,
    { timeout: 12000 },
  ).toBe(type);
};

const waitForNoInteraction = async (matchId: string, page: import('@playwright/test').Page) => {
  await expect.poll(
    async () => (await readInteraction(matchId, page))?.id ?? null,
    { timeout: 12000 },
  ).toBeNull();
};

const currentOptionPosition = async (
  matchId: string,
  page: import('@playwright/test').Page,
  predicate: (value: CoreState) => boolean,
) => {
  const interaction = await readInteraction(matchId, page);
  const option = (interaction?.data?.options ?? []).find((item: CoreState) => predicate(item.value));
  return option?.value?.newPosition ?? option?.value?.targetPosition ?? null;
};

test.describe('仲裁派系真实入口与交互', () => {
  test('真实派系选择入口进入对局并落地起始部署', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'zhongcai', 'necromancer');
    if (!match) {
      test.skip(true, '游戏服务器不可用或真实联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = match;
    try {
      await waitForSummonerWarsUI(hostPage);
      await waitForSummonerWarsUI(guestPage);
      const core = await readCoreState(hostPage);
      expect(core.selectedFactions?.['0']).toBe('zhongcai');
      expect(core.selectedFactions?.['1']).toBe('necromancer');
      expect(core.board[7][3].unit?.card?.id).toContain(SUMMONER_ZHONGCAI.id);
      expect(core.board[6][3].structure?.card?.isStartingGate).toBe(true);
      expect(core.board[5][3].unit?.card?.id).toContain('zhongcai-start-justice-arbiter');
      expect(core.board[5][2].unit?.card?.id).toContain('zhongcai-start-peace-arbiter');
      await screenshot(hostPage, testInfo, '仲裁派系真实入口开局');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('服从真实双步交互：选择士兵后放到召唤师相邻空格', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'zhongcai', 'necromancer');
    if (!match) {
      test.skip(true, '游戏服务器不可用或真实联机房间创建失败');
      return;
    }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const source = await readCoreState(hostPage);
      const core = clearAndPrepareCore(source, 'attack');
      putOpponentSummoner(core, source);
      putUnit(core, { row: 7, col: 3 }, SUMMONER_ZHONGCAI, '0');
      putUnit(core, { row: 5, col: 2 }, COMMON_UNITS_ZHONGCAI[1], '0');
      core.players['0'].hand = [cardWithInstanceId(EVENT_CARDS_ZHONGCAI[0], 'zhongcai-obedience-0-0')];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await screenshot(hostPage, testInfo, '仲裁服从触发前');

      const eventCard = hostPage.locator('[data-testid="sw-hand-area"] [data-card-id="zhongcai-obedience-0-0"]');
      await expect(eventCard).toBeVisible({ timeout: 5000 });
      await eventCard.click();
      await waitForInteractionType(match.matchId, hostPage, 'zhongcai_obedience_select_unit');
      await expect(hostPage.getByTestId('sw-cell-5-2')).toHaveAttribute('data-valid-zhongcai-obedience', 'true');
      await assertVisibleCellHighlight(hostPage, '[data-testid="sw-cell-5-2"]', '服从选择士兵');
      await assertAllVisibleCellHighlights(hostPage, '[data-valid-zhongcai-obedience="true"]', '服从选择士兵');
      await screenshot(hostPage, testInfo, '仲裁服从选择士兵');

      await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"][data-owner="0"]');
      await waitForInteractionType(match.matchId, hostPage, 'zhongcai_obedience_select_position');
      await expect(hostPage.locator('[data-valid-zhongcai-obedience="true"]')).not.toHaveCount(0);
      await expect(hostPage.getByTestId('sw-cell-7-2')).toHaveAttribute('data-valid-zhongcai-obedience', 'true');
      await assertVisibleCellHighlight(hostPage, '[data-testid="sw-cell-7-2"]', '服从选择召唤师相邻空格');
      await assertAllVisibleCellHighlights(hostPage, '[data-valid-zhongcai-obedience="true"]', '服从选择召唤师相邻空格');
      await screenshot(hostPage, testInfo, '仲裁服从选择相邻空格');
      await clickBoardElement(hostPage, '[data-testid="sw-cell-7-2"]');
      await waitForNoInteraction(match.matchId, hostPage);

      await expect.poll(async () => (await readCoreState(hostPage)).board[7][2].unit?.card?.id ?? null).toContain('zhongcai-peace-arbiter');
      await expect.poll(async () => (await readCoreState(hostPage)).players['0'].discard.some((card: CoreState) => card.id === 'zhongcai-obedience-0-0')).toBe(true);
      await screenshot(hostPage, testInfo, '仲裁服从结算完成');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('圣言、抹消与鼓舞均从真实棋盘入口进入目标选择并结算', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'zhongcai', 'necromancer');
    if (!match) {
      test.skip(true, '游戏服务器不可用或真实联机房间创建失败');
      return;
    }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const base = await readCoreState(hostPage);

      const wordCore = clearAndPrepareCore(base, 'move');
      putOpponentSummoner(wordCore, base);
      putUnit(wordCore, { row: 7, col: 3 }, SUMMONER_ZHONGCAI, '0');
      putUnit(wordCore, { row: 6, col: 4 }, COMMON_UNITS_ZHONGCAI[3], '0');
      await applyCoreState(hostPage, wordCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'move');
      await screenshot(hostPage, testInfo, '仲裁圣言触发前');
      await clickBoardElement(hostPage, '[data-testid="sw-unit-7-3"][data-owner="0"]');
      const wordSelected = await readCoreState(hostPage);
      const wordMoveHint = await hostPage.locator('[data-testid="sw-cell-7-4"]').getAttribute('data-valid-move');
      console.log('[DEBUG 仲裁圣言选中]', JSON.stringify({
        selectedUnit: wordSelected.selectedUnit,
        sourceUnit: wordSelected.board[7][3].unit,
        targetMoveHint: wordMoveHint,
      }));
      await screenshot(hostPage, testInfo, '仲裁圣言选择移动目标');
      await clickBoardElement(hostPage, '[data-testid="sw-cell-7-4"]');
      const wordAfterMove = await readCoreState(hostPage);
      const wordLive = await getMatchState(match.matchId, hostPage) as CoreState;
      console.log('[DEBUG 仲裁圣言移动]', JSON.stringify({
        phase: wordAfterMove.phase,
        currentPlayer: wordAfterMove.currentPlayer,
        movedUnit: wordAfterMove.board[7][4].unit,
        sourceCell: wordAfterMove.board[7][3].unit,
        targetUnit: wordAfterMove.board[6][4].unit,
        interaction: wordLive?.sys?.interaction,
        actionLogTail: wordLive?.sys?.actionLog?.entries?.slice?.(-5),
      }));
      await waitForInteractionType(match.matchId, hostPage, 'activated_ability_target');
      const wordTarget = await currentOptionPosition(match.matchId, hostPage, (value) => value?.abilityId === 'zhongcai_word');
      expect(wordTarget).toEqual({ row: 6, col: 4 });
      await expect(hostPage.getByTestId('sw-cell-6-4')).toHaveAttribute('data-valid-ability-unit', 'true');
      await assertVisibleCellHighlight(hostPage, '[data-testid="sw-cell-6-4"]', '圣言选择友方士兵');
      await assertAllVisibleCellHighlights(hostPage, '[data-valid-ability-unit="true"]', '圣言选择友方士兵');
      console.log('[DEBUG 仲裁圣言目标高亮]', JSON.stringify({
        targetUnitAbilityHint: await hostPage.locator('[data-testid="sw-unit-6-4"][data-owner="0"]').getAttribute('data-valid-ability-unit'),
        targetCellAbilityHint: await hostPage.locator('[data-testid="sw-cell-6-4"]').getAttribute('data-valid-ability-unit'),
      }));
      await screenshot(hostPage, testInfo, '仲裁圣言选择友方士兵');
      await clickBoardElement(hostPage, '[data-testid="sw-unit-6-4"][data-owner="0"]');
      const wordAfterTarget = await getMatchState(match.matchId, hostPage) as CoreState;
      console.log('[DEBUG 仲裁圣言目标响应后]', JSON.stringify({
        interaction: wordAfterTarget?.sys?.interaction,
        actionLogTail: wordAfterTarget?.sys?.actionLog?.entries?.slice?.(-4),
      }));
      await waitForInteractionType(match.matchId, hostPage, 'activated_ability_target');
      const wordDestination = await currentOptionPosition(match.matchId, hostPage, (value) => value?.abilityId === 'zhongcai_word' && !!value?.newPosition);
      expect(wordDestination).toBeTruthy();
      await expect(hostPage.getByTestId(`sw-cell-${wordDestination.row}-${wordDestination.col}`)).toHaveAttribute('data-valid-ability-pos', 'true');
      await assertVisibleCellHighlight(hostPage, `[data-testid="sw-cell-${wordDestination.row}-${wordDestination.col}"]`, '圣言选择推拉落点');
      await assertAllVisibleCellHighlights(hostPage, '[data-valid-ability-pos="true"]', '圣言选择推拉落点');
      await screenshot(hostPage, testInfo, '仲裁圣言选择推拉落点');
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${wordDestination.row}-${wordDestination.col}"]`);
      await waitForNoInteraction(match.matchId, hostPage);
      await expect.poll(async () => (await readCoreState(hostPage)).board[wordDestination.row][wordDestination.col].unit?.card?.id ?? null).toContain('zhongcai-war-arbiter');
      await screenshot(hostPage, testInfo, '仲裁圣言结算完成');

      const eraseCore = clearAndPrepareCore(await readCoreState(hostPage), 'summon');
      putOpponentSummoner(eraseCore, base);
      putOwnSummoner(eraseCore, base);
      putUnit(eraseCore, { row: 7, col: 1 }, CHAMPION_UNITS_ZHONGCAI[2], '0');
      putUnit(eraseCore, { row: 6, col: 1 }, COMMON_UNITS_ZHONGCAI[3], '0');
      putUnit(eraseCore, { row: 6, col: 2 }, COMMON_UNITS_ZHONGCAI[1], '1');
      await applyCoreState(hostPage, eraseCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');
      await screenshot(hostPage, testInfo, '仲裁抹消触发前');
      await hostPage.getByTestId('sw-end-phase').click();
      await waitForInteractionType(match.matchId, hostPage, 'activated_ability_target');
      await expect(hostPage.getByTestId('sw-cell-6-1')).toHaveAttribute('data-valid-ability-unit', 'true');
      await expect(hostPage.getByTestId('sw-cell-6-2')).toHaveAttribute('data-valid-ability-unit', 'true');
      await assertVisibleCellHighlight(hostPage, '[data-testid="sw-cell-6-1"]', '抹消选择目标');
      await assertVisibleCellHighlight(hostPage, '[data-testid="sw-cell-6-2"]', '抹消选择目标');
      await assertAllVisibleCellHighlights(hostPage, '[data-valid-ability-unit="true"]', '抹消选择目标');
      await screenshot(hostPage, testInfo, '仲裁抹消选择己方与敌方士兵');
      await clickBoardElement(hostPage, '[data-testid="sw-unit-6-2"][data-owner="1"]');
      await waitForNoInteraction(match.matchId, hostPage);
      const eraseAfter = await readCoreState(hostPage);
      const eraseLive = await getMatchState(match.matchId, hostPage) as CoreState;
      console.log('[DEBUG 仲裁抹消响应]', JSON.stringify({
        phase: eraseAfter.phase,
        currentPlayer: eraseAfter.currentPlayer,
        target: eraseAfter.board[6][2].unit,
        sourceAbilities: eraseAfter.board[7][1].unit?.card?.abilities,
        abilityUsageCount: eraseAfter.abilityUsageCount,
        interaction: eraseLive?.sys?.interaction,
        actionLogTail: eraseLive?.sys?.actionLog?.entries?.slice?.(-5),
      }));
      await expect.poll(async () => (await readCoreState(hostPage)).board[6][2].unit?.suppressedUntilTurnEnd ?? false).toBe(true);
      await screenshot(hostPage, testInfo, '仲裁抹消结算完成');

      const inspireCore = clearAndPrepareCore(await readCoreState(hostPage), 'summon');
      putOpponentSummoner(inspireCore, base);
      putStructure(inspireCore, { row: 6, col: 3 }, '0');
      putUnit(inspireCore, { row: 7, col: 3 }, SUMMONER_ZHONGCAI, '0');
      putUnit(inspireCore, { row: 5, col: 2 }, COMMON_UNITS_ZHONGCAI[3], '0', { damage: 1 });
      inspireCore.players['0'].hand = [cardWithInstanceId(COMMON_UNITS_ZHONGCAI[2], 'zhongcai-support-priest-0-0')];
      await applyCoreState(hostPage, inspireCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon');
      await screenshot(hostPage, testInfo, '仲裁鼓舞触发前');
      await hostPage.locator('[data-testid="sw-hand-area"] [data-card-id="zhongcai-support-priest-0-0"]').click();
      await clickBoardElement(hostPage, '[data-testid="sw-cell-6-2"]');
      await waitForInteractionType(match.matchId, hostPage, 'activated_ability_target');
      await expect(hostPage.getByTestId('sw-cell-5-2')).toHaveAttribute('data-valid-ability-unit', 'true');
      await assertVisibleCellHighlight(hostPage, '[data-testid="sw-cell-5-2"]', '鼓舞选择受伤士兵');
      await assertAllVisibleCellHighlights(hostPage, '[data-valid-ability-unit="true"]', '鼓舞选择受伤士兵');
      await screenshot(hostPage, testInfo, '仲裁鼓舞选择受伤士兵');
      await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"][data-owner="0"]');
      await waitForNoInteraction(match.matchId, hostPage);
      await expect.poll(async () => (await readCoreState(hostPage)).board[5][2].unit?.damage ?? null).toBe(0);
      await screenshot(hostPage, testInfo, '仲裁鼓舞结算完成');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('律令在真实回合开始提示消耗充能或保留持续效果', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'necromancer', 'zhongcai');
    if (!match) {
      test.skip(true, '游戏服务器不可用或真实联机房间创建失败');
      return;
    }
    const { hostPage, guestPage, hostContext, guestContext } = match;
    try {
      const source = await readCoreState(hostPage);
      const core = clearAndPrepareCore(source, 'draw');
      putOwnSummoner(core, source);
      putOpponentSummoner(core, source);
      core.currentPlayer = '0';
      core.players['1'].activeEvents = [cardWithInstanceId({ ...EVENT_CARDS_ZHONGCAI[1], charges: 1 }, 'zhongcai-holy-decree-1-0')];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'draw');
      await screenshot(guestPage, testInfo, '仲裁律令触发前');
      await hostPage.getByTestId('sw-end-phase').click();
      await waitForInteractionType(match.matchId, guestPage, 'zhongcai_decree_discard');
      await expect(guestPage.getByRole('button', { name: '消耗1点充能并弃置' })).toBeVisible({ timeout: 5000 });
      await expect(guestPage.getByRole('button', { name: '保留持续效果' })).toBeVisible({ timeout: 5000 });
      await screenshot(guestPage, testInfo, '仲裁律令回合开始提示');
      await guestPage.getByRole('button', { name: '保留持续效果' }).click();
      await waitForNoInteraction(match.matchId, guestPage);
      await expect.poll(async () => (await getMatchState(match.matchId, guestPage) as CoreState).core?.players?.['1']?.activeEvents?.[0]?.charges ?? null).toBe(1);
      await screenshot(guestPage, testInfo, '仲裁律令保留持续效果后');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('多个持续事件同时存在时真实棋盘按放大尺寸完整显示', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'zhongcai', 'necromancer');
    if (!match) {
      test.skip(true, '游戏服务器不可用或真实联机房间创建失败');
      return;
    }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const source = await readCoreState(hostPage);
      const core = clearAndPrepareCore(source, 'draw');
      putOwnSummoner(core, source);
      putOpponentSummoner(core, source);
      core.currentPlayer = '0';
      core.players['0'].activeEvents = [
        cardWithInstanceId({ ...EVENT_CARDS_ZHONGCAI[1], charges: 1 }, 'zhongcai-holy-decree-0-0'),
        cardWithInstanceId({ ...EVENT_CARDS_ZHONGCAI[2], charges: 1 }, 'zhongcai-loyalty-decree-0-0'),
      ];
      await applyCoreState(hostPage, core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'draw');

      await expect(hostPage.getByTestId('sw-my-active-events')).toBeVisible();
      await expect(hostPage.getByTestId('sw-player-active-event-zhongcai-holy-decree-0-0')).toBeVisible();
      await expect(hostPage.getByTestId('sw-player-active-event-zhongcai-loyalty-decree-0-0')).toBeVisible();
      await expect(hostPage.locator('[data-testid^="sw-player-active-event-"]')).toHaveCount(2);
      await screenshot(hostPage, testInfo, '仲裁多个持续事件同时显示');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
