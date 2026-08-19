import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ConsoleMessage, Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
  blockAudioRequests,
  disableAudio,
  disableTutorial,
  ensureGameServerAvailable,
  setChineseLocale,
} from '../helpers/common';
import {
  createSWRoomViaAPI,
  ensurePlayerIdInUrl,
  initSWContext,
  readCoreState,
  waitForSummonerWarsUI,
} from '../helpers/summonerwars';
import { getMatchState, injectMatchState, type TestMatchAccess } from '../helpers/state-injection';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
  createSummonerWarsMobileEvidenceState,
  withSummonerWarsMobileEvidenceActionLog,
} from '../../src/games/summonerwars/mobileEvidence';

type AiConsoleEntry = {
  label: string;
  receivedAt: number;
  text: string;
  payload: unknown;
};

type CoreTimingSnapshot = {
  capturedAt: number;
  currentPlayer: unknown;
  phase: unknown;
  turnNumber: unknown;
  bannerText: string | null;
  endPhaseDisabled: boolean | null;
};

const AI_DELAY_FLOOR_MS = 900;
const AI_EMPTY_TURN_CEILING_MS = 3000;

function summarizeCore(core: Record<string, unknown> | null | undefined) {
  return {
    currentPlayer: core?.currentPlayer ?? null,
    phase: core?.phase ?? null,
    turnNumber: core?.turnNumber ?? null,
  };
}

async function captureCoreTiming(page: Page): Promise<CoreTimingSnapshot> {
  const core = await readCoreState(page) as Record<string, unknown> | null | undefined;
  const ui = await page.evaluate(() => {
    const banner = document.querySelector('[data-testid="sw-action-banner"]');
    const endPhase = document.querySelector('[data-testid="sw-end-phase"]') as HTMLButtonElement | null;
    return {
      bannerText: banner?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      endPhaseDisabled: endPhase ? endPhase.disabled : null,
    };
  }).catch(() => ({ bannerText: null, endPhaseDisabled: null }));
  return {
    capturedAt: Date.now(),
    ...summarizeCore(core),
    ...ui,
  };
}

function attachAiConsoleCapture(page: Page, entries: AiConsoleEntry[]) {
  page.on('console', async (msg: ConsoleMessage) => {
    const text = msg.text();
    const label = text.includes('[LOCAL_AI_PERF]')
      ? '[LOCAL_AI_PERF]'
      : text.includes('[AI_RUNTIME_TRUTH]')
        ? '[AI_RUNTIME_TRUTH]'
        : null;
    if (!label) return;

    const args = msg.args();
    const payload = args.length >= 2
      ? await args[1].jsonValue().catch(() => null)
      : null;
    entries.push({
      label,
      receivedAt: Date.now(),
      text,
      payload,
    });
  });
}

async function resolveMatchAccess(page: Page, matchId: string): Promise<TestMatchAccess> {
  const access = await page.evaluate((targetMatchId) => {
    const params = new URLSearchParams(window.location.search);
    const playerId = params.get('playerID');
    const raw = localStorage.getItem(`match_creds_${targetMatchId}`);
    if (!playerId || !raw) return null;
    try {
      const parsed = JSON.parse(raw) as {
        matchID?: string;
        playerID?: string;
        credentials?: string;
      };
      if (parsed.matchID !== targetMatchId || parsed.playerID !== playerId || typeof parsed.credentials !== 'string') {
        return null;
      }
      return {
        playerId,
        credentials: parsed.credentials,
      };
    } catch {
      return null;
    }
  }, matchId);
  if (!access) {
    throw new Error(`Unable to resolve match access for ${matchId}`);
  }
  return access;
}

function buildTimingState(
  liveState: Awaited<ReturnType<typeof getMatchState>>,
  options: {
    currentPlayer: '0' | '1';
    phase: 'summon' | 'draw';
    turnNumber?: number;
  },
) {
  const state = withSummonerWarsMobileEvidenceActionLog(
    createSummonerWarsMobileEvidenceState({
      faction0: 'necromancer',
      faction1: 'trickster',
    }),
    Date.now(),
  );
  const liveTurnOrder = Array.isArray((liveState.sys as { turnOrder?: unknown } | undefined)?.turnOrder)
    ? ((liveState.sys as { turnOrder?: unknown[] }).turnOrder ?? [])
      .filter((playerId): playerId is string => typeof playerId === 'string')
    : ['0', '1'];
  const liveCurrentPlayerIndex = typeof (liveState.sys as { currentPlayerIndex?: unknown } | undefined)?.currentPlayerIndex === 'number'
    ? (liveState.sys as { currentPlayerIndex: number }).currentPlayerIndex
    : 0;
  const currentPlayerIndex = liveTurnOrder.indexOf(options.currentPlayer);
  const turnNumber = options.turnNumber ?? Math.max(Number(state.core.turnNumber) || 0, 5);

  return {
    ...liveState,
    ...state,
    core: {
      ...liveState.core,
      ...state.core,
      currentPlayer: options.currentPlayer,
      phase: options.phase,
      turnNumber,
      selectedUnit: undefined,
      attackTargetMode: undefined,
      pendingAttackRoll: undefined,
    },
    sys: {
      ...liveState.sys,
      ...state.sys,
      matchId: liveState.sys?.matchId,
      turnOrder: liveTurnOrder,
      currentPlayerIndex: currentPlayerIndex >= 0 ? currentPlayerIndex : liveCurrentPlayerIndex,
      phase: options.phase,
      turnNumber,
      flowHalted: false,
      interaction: {
        ...state.sys.interaction,
        current: undefined,
        queue: [],
        isBlocked: false,
      },
      responseWindow: {
        ...state.sys.responseWindow,
        current: undefined,
      },
    },
  };
}

function removeAiPlayableActions(state: ReturnType<typeof buildTimingState>, playerId: '0' | '1') {
  const core = state.core as {
    players?: Record<string, {
      hand?: unknown[];
      deck?: unknown[];
      magic?: number;
      activeEvents?: unknown[];
    }>;
    board?: Array<Array<{
      unit?: {
        owner?: unknown;
        hasMoved?: boolean;
        hasAttacked?: boolean;
      };
    }>>;
  };
  const player = core.players?.[playerId];
  if (player) {
    player.hand = [];
    player.deck = [];
    player.magic = 0;
    player.activeEvents = [];
  }
  for (const row of core.board ?? []) {
    for (const cell of row ?? []) {
      if (cell.unit?.owner === playerId) {
        cell.unit.hasMoved = true;
        cell.unit.hasAttacked = true;
      }
    }
  }
  return state;
}

const VISIBLE_SUMMON_CARD_IDS = ['ai-visible-unit-a', 'ai-visible-unit-b'] as const;
const SW_UNIT_SUMMONED_EVENT = 'sw:unit_summoned';

function createVisibleSummonCard(id: typeof VISIBLE_SUMMON_CARD_IDS[number]) {
  return {
    id,
    cardType: 'unit' as const,
    name: id,
    unitClass: 'common' as const,
    faction: 'trickster' as const,
    strength: 1,
    life: 1,
    cost: 0,
    attackType: 'melee' as const,
    attackRange: 1 as const,
    deckSymbols: [],
  };
}

function buildConsecutiveVisibleSummonState(
  liveState: Awaited<ReturnType<typeof getMatchState>>,
) {
  const state = buildTimingState(liveState, {
    currentPlayer: '1',
    phase: 'summon',
    turnNumber: 5,
  });
  const player = state.core.players?.['1'];
  if (player) {
    player.magic = 5;
    player.hand = VISIBLE_SUMMON_CARD_IDS.map(createVisibleSummonCard);
    player.deck = [];
    player.activeEvents = [];
  }
  return state;
}

function countVisibleSummonedUnits(core: Record<string, unknown> | null | undefined): number {
  const board = Array.isArray(core?.board) ? core.board as Array<Array<{ unit?: { owner?: unknown; cardId?: unknown; card?: { id?: unknown } } }>> : [];
  let count = 0;
  for (const row of board) {
    for (const cell of row ?? []) {
      const unit = cell?.unit;
      const cardId = typeof unit?.cardId === 'string'
        ? unit.cardId
        : typeof unit?.card?.id === 'string'
          ? unit.card.id
          : null;
      if (unit?.owner === '1' && cardId && (VISIBLE_SUMMON_CARD_IDS as readonly string[]).includes(cardId)) {
        count += 1;
      }
    }
  }
  return count;
}

function extractVisibleSummonEvents(
  state: Awaited<ReturnType<typeof getMatchState>>,
): Array<{ cardId: string; timestamp: number }> {
  const entries = Array.isArray((state.sys as { eventStream?: { entries?: unknown[] } } | undefined)?.eventStream?.entries)
    ? (state.sys as { eventStream: { entries: unknown[] } }).eventStream.entries
    : [];
  const summonEvents: Array<{ cardId: string; timestamp: number }> = [];
  for (const entry of entries) {
    const event = (entry as { event?: { type?: unknown; payload?: unknown; timestamp?: unknown } } | null)?.event;
    if (event?.type !== SW_UNIT_SUMMONED_EVENT) continue;
    const payload = event.payload as { cardId?: unknown } | null | undefined;
    const cardId = typeof payload?.cardId === 'string' ? payload.cardId : null;
    if (!cardId || !(VISIBLE_SUMMON_CARD_IDS as readonly string[]).includes(cardId)) continue;
    if (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)) {
      summonEvents.push({ cardId, timestamp: event.timestamp });
    }
  }
  return summonEvents.sort((a, b) => a.timestamp - b.timestamp);
}

test('诊断：在线 Summoner Wars AI 空回合不应瞬间或长时间交还真人', async ({ browser }, testInfo) => {
  test.setTimeout(120000);
  await clearEvidenceScreenshotsForTest(testInfo);

  const baseURL = testInfo.project.use.baseURL as string | undefined;
  const hostContext = await browser.newContext({ baseURL });
  await initSWContext(hostContext, '__sw_ai_delay_diagnostic');
  await blockAudioRequests(hostContext);
  await setChineseLocale(hostContext);
  await disableAudio(hostContext);
  await disableTutorial(hostContext);
  const hostPage = await hostContext.newPage();
  const aiConsoleEntries: AiConsoleEntry[] = [];
  attachAiConsoleCapture(hostPage, aiConsoleEntries);

  try {
    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for Summoner Wars AI delay diagnostic.');
    }

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    const matchId = await createSWRoomViaAPI(hostPage, {
      setupData: {
        enableAi: true,
        seatControllers: {
          '0': { type: 'human' },
          '1': { type: 'local-ai', minimumActionDelayMs: 1000 },
        },
      },
    });
    if (!matchId) {
      test.skip(true, 'AI room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');
    await hostPage.goto(`/play/summonerwars/match/${matchId!}?playerID=0`, { waitUntil: 'domcontentloaded' });

    const matchAccess = await resolveMatchAccess(hostPage, matchId!);
    const warmupState = buildTimingState(await getMatchState(matchId!, hostPage), {
      currentPlayer: '0',
      phase: 'summon',
      turnNumber: 5,
    });
    await injectMatchState(matchId!, warmupState as never, hostPage);
    await waitForSummonerWarsUI(hostPage, 30000);
    await expect.poll(async () => {
      const core = await readCoreState(hostPage) as Record<string, unknown> | null | undefined;
      return summarizeCore(core);
    }, {
      timeout: 5000,
      message: '等待诊断预热态进入真人召唤阶段',
    }).toEqual({
      currentPlayer: '0',
      phase: 'summon',
      turnNumber: 5,
    });

    const aiEmptyTurnState = removeAiPlayableActions(
      buildTimingState(await getMatchState(matchId!, hostPage), {
        currentPlayer: '1',
        phase: 'summon',
        turnNumber: 5,
      }),
      '1',
    );
    const injectionStartedAt = Date.now();
    await injectMatchState(matchId!, aiEmptyTurnState as never, undefined, matchAccess);

    const afterInjectState = await getMatchState(matchId!, hostPage);
    const afterInject = {
      capturedAt: Date.now(),
      ...summarizeCore(afterInjectState.core as Record<string, unknown> | null | undefined),
    };
    const serverSnapshots = [afterInject];
    const returnSnapshots: CoreTimingSnapshot[] = [];
    let returnedToHumanAt: number | null =
      afterInject.currentPlayer === '0' && afterInject.phase === 'summon'
        ? afterInject.capturedAt
        : null;

    const waitStartedAt = Date.now();
    while (returnedToHumanAt === null && Date.now() - waitStartedAt < 6000) {
      await hostPage.waitForTimeout(25);
      const latestState = await getMatchState(matchId!, hostPage);
      const snapshot = {
        capturedAt: Date.now(),
        ...summarizeCore(latestState.core as Record<string, unknown> | null | undefined),
      };
      serverSnapshots.push(snapshot);
      if (snapshot.currentPlayer === '0' && snapshot.phase === 'summon') {
        returnedToHumanAt = snapshot.capturedAt;
      }
    }

    returnSnapshots.push(await captureCoreTiming(hostPage));

    const beforePath = getEvidenceScreenshotPath(testInfo, 'ai-empty-turn-or-return-before-threshold', {
      filename: 'ai-empty-turn-or-return-before-threshold.png',
    });
    await hostPage.screenshot({ path: beforePath, fullPage: false });

    const diagnostic = {
      matchId,
      scenario: 'ai-empty-turn-from-summon',
      configuredMinimumActionDelayMs: 1000,
      expectedMinimumElapsedMs: AI_DELAY_FLOOR_MS,
      expectedMaximumElapsedMs: AI_EMPTY_TURN_CEILING_MS,
      injectionStartedAt,
      afterInject,
      returnedToHumanAt,
      returnedElapsedMs: returnedToHumanAt === null ? null : returnedToHumanAt - injectionStartedAt,
      localAiPerfEntries: aiConsoleEntries,
      serverSnapshots,
      returnSnapshots,
    };
    const diagnosticPath = testInfo.outputPath('summonerwars-ai-delay-diagnostic.json');
    await mkdir(dirname(diagnosticPath), { recursive: true });
    await writeFile(diagnosticPath, JSON.stringify(diagnostic, null, 2), 'utf8');
    console.log('[SW_AI_DELAY_DIAGNOSTIC]', diagnostic);

    expect(returnedToHumanAt, 'AI 应在诊断窗口内交还真人，才能判断延迟时长').not.toBeNull();
    expect(
      returnedToHumanAt! - injectionStartedAt,
      `AI 1000ms 可见动作延迟疑似无效，诊断见 ${diagnosticPath}`,
    ).toBeGreaterThanOrEqual(AI_DELAY_FLOOR_MS);
    expect(
      returnedToHumanAt! - injectionStartedAt,
      `AI 空回合疑似把静默阶段也逐段等待，诊断见 ${diagnosticPath}`,
    ).toBeLessThan(AI_EMPTY_TURN_CEILING_MS);
  } finally {
    await hostContext.close();
  }
});

test('诊断：在线 Summoner Wars AI 连续可见召唤动作之间应保留节奏延迟', async ({ browser }, testInfo) => {
  test.setTimeout(120000);
  await clearEvidenceScreenshotsForTest(testInfo);

  const baseURL = testInfo.project.use.baseURL as string | undefined;
  const hostContext = await browser.newContext({ baseURL });
  await initSWContext(hostContext, '__sw_ai_visible_summon_delay_diagnostic');
  await blockAudioRequests(hostContext);
  await setChineseLocale(hostContext);
  await disableAudio(hostContext);
  await disableTutorial(hostContext);
  const hostPage = await hostContext.newPage();
  const aiConsoleEntries: AiConsoleEntry[] = [];
  attachAiConsoleCapture(hostPage, aiConsoleEntries);

  try {
    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for Summoner Wars visible AI delay diagnostic.');
    }

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    const matchId = await createSWRoomViaAPI(hostPage, {
      setupData: {
        enableAi: true,
        seatControllers: {
          '0': { type: 'human' },
          '1': { type: 'local-ai', minimumActionDelayMs: 1000 },
        },
      },
    });
    if (!matchId) {
      test.skip(true, 'AI room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');
    await hostPage.goto(`/play/summonerwars/match/${matchId!}?playerID=0`, { waitUntil: 'domcontentloaded' });
    const matchAccess = await resolveMatchAccess(hostPage, matchId!);

    const readyState = buildTimingState(await getMatchState(matchId!, hostPage), {
      currentPlayer: '0',
      phase: 'summon',
      turnNumber: 5,
    });
    await injectMatchState(matchId!, readyState as never, hostPage);
    await waitForSummonerWarsUI(hostPage, 30000);
    await expect.poll(async () => {
      const core = await readCoreState(hostPage) as Record<string, unknown> | null | undefined;
      return summarizeCore(core);
    }, {
      timeout: 5000,
      message: '等待连续可见召唤诊断预热态进入真人召唤阶段',
    }).toEqual({
      currentPlayer: '0',
      phase: 'summon',
      turnNumber: 5,
    });

    const aiSummonState = buildConsecutiveVisibleSummonState(await getMatchState(matchId!, hostPage));
    const injectionStartedAt = Date.now();
    await injectMatchState(matchId!, aiSummonState as never, undefined, matchAccess);

    const summonSnapshots: Array<{
      capturedAt: number;
      visibleSummonedUnits: number;
      currentPlayer: unknown;
      phase: unknown;
      turnNumber: unknown;
    }> = [];
    const firstSummonAtRef: { current: number | null } = { current: null };
    const secondSummonAtRef: { current: number | null } = { current: null };

    const waitStartedAt = Date.now();
    while (Date.now() - waitStartedAt < 5000 && secondSummonAtRef.current === null) {
      await hostPage.waitForTimeout(25);
      const latestState = await getMatchState(matchId!, hostPage);
      const core = latestState.core as Record<string, unknown> | null | undefined;
      const visibleSummonedUnits = countVisibleSummonedUnits(core);
      const snapshot = {
        capturedAt: Date.now(),
        visibleSummonedUnits,
        ...summarizeCore(core),
      };
      summonSnapshots.push(snapshot);
      if (visibleSummonedUnits >= 1 && firstSummonAtRef.current === null) {
        firstSummonAtRef.current = snapshot.capturedAt;
      }
      if (visibleSummonedUnits >= 2 && secondSummonAtRef.current === null) {
        secondSummonAtRef.current = snapshot.capturedAt;
      }
    }

    const afterPath = getEvidenceScreenshotPath(testInfo, 'ai-visible-summon-delay-after', {
      filename: 'ai-visible-summon-delay-after.png',
    });
    await hostPage.screenshot({ path: afterPath, fullPage: false });
    const finalState = await getMatchState(matchId!, hostPage);
    const summonEvents = extractVisibleSummonEvents(finalState);
    const firstSummonEventAt = summonEvents[0]?.timestamp ?? null;
    const secondSummonEventAt = summonEvents[1]?.timestamp ?? null;

    const diagnostic = {
      matchId,
      scenario: 'ai-consecutive-visible-summon',
      configuredMinimumActionDelayMs: 1000,
      expectedMinimumGapMs: AI_DELAY_FLOOR_MS,
      injectionStartedAt,
      firstSummonAt: firstSummonAtRef.current,
      secondSummonAt: secondSummonAtRef.current,
      firstSummonElapsedMs: firstSummonAtRef.current === null ? null : firstSummonAtRef.current - injectionStartedAt,
      secondSummonElapsedMs: secondSummonAtRef.current === null ? null : secondSummonAtRef.current - injectionStartedAt,
      firstToSecondSummonGapMs: firstSummonAtRef.current === null || secondSummonAtRef.current === null
        ? null
        : secondSummonAtRef.current - firstSummonAtRef.current,
      firstSummonEventAt,
      secondSummonEventAt,
      firstToSecondSummonEventGapMs: firstSummonEventAt === null || secondSummonEventAt === null
        ? null
        : secondSummonEventAt - firstSummonEventAt,
      summonEvents,
      localAiPerfEntries: aiConsoleEntries,
      summonSnapshots,
    };
    const diagnosticPath = testInfo.outputPath('summonerwars-visible-summon-delay-diagnostic.json');
    await mkdir(dirname(diagnosticPath), { recursive: true });
    await writeFile(diagnosticPath, JSON.stringify(diagnostic, null, 2), 'utf8');
    console.log('[SW_AI_VISIBLE_SUMMON_DELAY_DIAGNOSTIC]', diagnostic);

    expect(firstSummonAtRef.current, `AI 第一张可见召唤未发生，诊断见 ${diagnosticPath}`).not.toBeNull();
    expect(secondSummonAtRef.current, `AI 第二张可见召唤未发生，诊断见 ${diagnosticPath}`).not.toBeNull();
    expect(
      firstSummonAtRef.current! - injectionStartedAt,
      `AI 第一张召唤疑似没有等待 minimumActionDelayMs，诊断见 ${diagnosticPath}`,
    ).toBeGreaterThanOrEqual(AI_DELAY_FLOOR_MS);
    expect(firstSummonEventAt, `AI 第一张召唤事件时间戳缺失，诊断见 ${diagnosticPath}`).not.toBeNull();
    expect(secondSummonEventAt, `AI 第二张召唤事件时间戳缺失，诊断见 ${diagnosticPath}`).not.toBeNull();
    expect(
      secondSummonEventAt! - firstSummonEventAt!,
      `AI 连续可见召唤之间疑似没有保留 1 秒节奏延迟，诊断见 ${diagnosticPath}`,
    ).toBeGreaterThanOrEqual(AI_DELAY_FLOOR_MS);
  } finally {
    await hostContext.close();
  }
});
