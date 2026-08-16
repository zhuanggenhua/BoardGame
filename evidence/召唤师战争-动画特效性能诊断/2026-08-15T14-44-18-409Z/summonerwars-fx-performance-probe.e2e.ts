import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, type BrowserContext, type Page } from '@playwright/test';
import { test, expect } from '../framework';
import { createDeckByFactionId } from '../../src/games/summonerwars/config/factions';
import {
  GAME_NAME,
  applyCoreState,
  clickBoardElement,
  closeDebugPanelIfOpen,
  createSWRoomViaAPI,
  readCoreState,
  selectFactionsViaDispatch,
  selectFactionsViaUI,
  waitForFactionSelection,
  waitForSummonerWarsUI,
  waitForPhase,
} from '../helpers/summonerwars';
import {
  blockAudioRequests,
  blockLobbySocket,
  disableAudio,
  disableTutorial,
  ensureGameServerAvailable,
  injectDirectApiServerUrl,
  injectDirectGameServerUrl,
  joinMatchViaAPI,
  resetMatchStorage,
  seedMatchCredentials,
  setChineseLocale,
  waitForFrontendAssets,
  waitForMatchAvailable,
} from '../helpers/common';

type PerfWindow = {
  label: string;
  pagePerf: ReturnType<typeof summarizeFrames> & {
    longTaskCount: number;
    longTaskMaxMs: number;
    longTaskTotalMs: number;
    sampleDurationMs: number;
    memory?: unknown;
  };
  domInventory: unknown;
  trace: unknown;
  tracePath: string;
};

type ProbeMatch = {
  hostPage: Page;
  guestPage: Page;
  hostContext: BrowserContext;
  guestContext: BrowserContext;
  matchId: string;
};

const __filename = fileURLToPath(import.meta.url);
const timestamp = process.env.SW_FX_PROBE_TIMESTAMP
  ?? new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.join(
  process.cwd(),
  'evidence',
  '召唤师战争-动画特效性能诊断',
  timestamp,
);
const latestPointerPath = path.join(process.cwd(), 'temp', 'summonerwars-fx-performance-probe-latest.txt');

const traceCategories = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'blink.user_timing',
  'toplevel',
  'v8',
].join(',');

const cloneState = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const makeInjectedInstanceId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

async function configureProbeContext(context: BrowserContext, storageKey: string) {
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      configurable: true,
      get: () => false,
    });
    (window as Window & { __SW_DISABLE_AUTO_SKIP__?: boolean }).__SW_DISABLE_AUTO_SKIP__ = true;
  });
  await blockAudioRequests(context);
  await blockLobbySocket(context);
  await injectDirectGameServerUrl(context);
  await injectDirectApiServerUrl(context);
  await setChineseLocale(context);
  await resetMatchStorage(context, storageKey);
  await disableTutorial(context);
  await disableAudio(context);
}

async function setupFullFxOnlineMatch(browser: Browser, baseURL: string | undefined): Promise<ProbeMatch | null> {
  const hostContext = await browser.newContext({ baseURL });
  await configureProbeContext(hostContext, '__sw_perf_probe_host');
  const hostPage = await hostContext.newPage();
  hostPage.on('pageerror', (error) => console.log('[SW-FX-PROBE host pageerror]', error.message));
  hostPage.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[SW-FX-PROBE host console]', msg.text());
  });

  await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForFrontendAssets(hostPage, 30000);

  if (!(await ensureGameServerAvailable(hostPage))) {
    await hostContext.close();
    return null;
  }

  const matchId = await createSWRoomViaAPI(hostPage);
  if (!matchId) {
    await hostContext.close();
    return null;
  }
  if (!(await waitForMatchAvailable(hostPage, GAME_NAME, matchId, 20000))) {
    await hostContext.close();
    return null;
  }

  await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
  await waitForFactionSelection(hostPage, 30000);

  const guestContext = await browser.newContext({ baseURL });
  await configureProbeContext(guestContext, '__sw_perf_probe_guest');
  const guestPage = await guestContext.newPage();
  await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForFrontendAssets(guestPage, 30000);

  const guestCredentials = await joinMatchViaAPI(guestPage, GAME_NAME, matchId, '1', 'Guest-SW-FX-Probe');
  if (!guestCredentials) {
    await hostContext.close();
    await guestContext.close();
    return null;
  }
  await seedMatchCredentials(guestContext, GAME_NAME, matchId, '1', guestCredentials);
  await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

  try {
    await selectFactionsViaDispatch(hostPage, guestPage, 'necromancer', 'paladin');
  } catch {
    await selectFactionsViaUI(hostPage, guestPage, 0, 2);
  }

  await waitForSummonerWarsUI(hostPage, 30000);
  await waitForSummonerWarsUI(guestPage, 30000);
  return { hostPage, guestPage, hostContext, guestContext, matchId };
}

function prepareSummonState(coreState: any) {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;
  next.summonTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取召唤师战争玩家0状态');
  const necromancerDeck = createDeckByFactionId('necromancer');
  const summonCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('necro-undead-warrior-'),
  );
  if (!summonCard || summonCard.cardType !== 'unit') {
    throw new Error('未找到亡灵战士召唤卡模板');
  }

  const handCardId = makeInjectedInstanceId('sw-fx-probe-summon-hand');
  player.magic = Math.max(Number(player.magic ?? 0), Number(summonCard.cost ?? 0), 3);
  player.hand = [
    { ...summonCard, id: handCardId, abilities: [] },
    ...(player.hand ?? []).filter((card: any) => card.id !== handCardId),
  ];
  return { core: next, handCardId };
}

function placeUnit(board: any[][], pos: { row: number; col: number }, unit: any) {
  board[pos.row][pos.col] = {
    ...board[pos.row][pos.col],
    unit: { ...unit, position: { ...pos } },
    structure: undefined,
  };
}

function clearRect(board: any[][], rowStart: number, rowEnd: number, colStart: number, colEnd: number) {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      if (board[row]?.[col]) {
        board[row][col] = { ...board[row][col], unit: undefined, structure: undefined };
      }
    }
  }
}

function prepareRangedKillState(coreState: any) {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取召唤师战争玩家0状态');
  player.attackCount = 0;
  player.hasAttackedEnemy = false;

  const necromancerDeck = createDeckByFactionId('necromancer');
  const paladinDeck = createDeckByFactionId('paladin');
  const archerCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('necro-undead-archer-'),
  );
  const targetCard = paladinDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('paladin-temple-priest-'),
  );
  if (!archerCard || archerCard.cardType !== 'unit') throw new Error('未找到亡灵弓箭手模板');
  if (!targetCard || targetCard.cardType !== 'unit') throw new Error('未找到敌方祭司模板');

  const board = next.board as Array<Array<Record<string, any>>>;
  const archerPosition = { row: 4, col: 2 };
  const targetPosition = { row: 4, col: 4 };
  clearRect(board, 3, 5, 1, 4);

  placeUnit(board, archerPosition, {
    instanceId: makeInjectedInstanceId('sw-fx-probe-archer'),
    cardId: archerCard.id,
    card: { ...archerCard, strength: 12, attackType: 'ranged', abilities: [] },
    owner: '0',
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  placeUnit(board, targetPosition, {
    instanceId: makeInjectedInstanceId('sw-fx-probe-target'),
    cardId: targetCard.id,
    card: { ...targetCard, life: 1, abilities: [] },
    owner: '1',
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  return { core: next, archerPosition, targetPosition };
}

async function installPageSampler(page: Page) {
  await page.evaluate(() => {
    const holder = window as Window & {
      __SW_PERF_PROBE__?: {
        active: boolean;
        label: string;
        startedAt: number;
        lastFrameAt: number;
        frames: number[];
        longTasks: Array<{ name: string; startTime: number; duration: number }>;
      };
      __SW_PERF_OBSERVER_INSTALLED__?: boolean;
    };

    if (!holder.__SW_PERF_PROBE__) {
      holder.__SW_PERF_PROBE__ = {
        active: false,
        label: '',
        startedAt: 0,
        lastFrameAt: performance.now(),
        frames: [],
        longTasks: [],
      };
    }

    if (!holder.__SW_PERF_OBSERVER_INSTALLED__) {
      holder.__SW_PERF_OBSERVER_INSTALLED__ = true;
      const loop = (now: number) => {
        const probe = holder.__SW_PERF_PROBE__;
        if (probe?.active) {
          probe.frames.push(now - probe.lastFrameAt);
        }
        if (probe) probe.lastFrameAt = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      try {
        const observer = new PerformanceObserver((list) => {
          const probe = holder.__SW_PERF_PROBE__;
          if (!probe?.active) return;
          for (const entry of list.getEntries()) {
            probe.longTasks.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
            });
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch {
        // Long Tasks API is not available in every browser channel.
      }
    }
  });
}

async function startPageSample(page: Page, label: string) {
  await page.evaluate((nextLabel) => {
    const holder = window as Window & { __SW_PERF_PROBE__?: any };
    const probe = holder.__SW_PERF_PROBE__;
    probe.active = true;
    probe.label = nextLabel;
    probe.startedAt = performance.now();
    probe.lastFrameAt = performance.now();
    probe.frames = [];
    probe.longTasks = [];
    performance.mark(`sw-fx-probe:${nextLabel}:start`);
  }, label);
}

async function stopPageSample(page: Page, label: string) {
  return await page.evaluate((nextLabel) => {
    const holder = window as Window & { __SW_PERF_PROBE__?: any; performance?: Performance & { memory?: unknown } };
    const probe = holder.__SW_PERF_PROBE__;
    performance.mark(`sw-fx-probe:${nextLabel}:end`);
    probe.active = false;
    return {
      label: nextLabel,
      sampleDurationMs: performance.now() - probe.startedAt,
      frames: [...probe.frames],
      longTasks: [...probe.longTasks],
      memory: (performance as Performance & { memory?: unknown }).memory,
    };
  }, label);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarizeFrames(sample: { frames: number[]; longTasks: Array<{ duration: number }>; sampleDurationMs?: number; memory?: unknown }) {
  const frames = sample.frames.filter((value) => Number.isFinite(value) && value >= 0);
  const longTasks = sample.longTasks.filter((value) => Number.isFinite(value.duration));
  return {
    frameCount: frames.length,
    avgFrameMs: frames.length ? frames.reduce((sum, value) => sum + value, 0) / frames.length : 0,
    p95FrameMs: percentile(frames, 95),
    maxFrameMs: frames.length ? Math.max(...frames) : 0,
    framesOver16_7ms: frames.filter((value) => value > 16.7).length,
    framesOver33ms: frames.filter((value) => value > 33).length,
    framesOver50ms: frames.filter((value) => value > 50).length,
    longTaskCount: longTasks.length,
    longTaskMaxMs: longTasks.length ? Math.max(...longTasks.map((task) => task.duration)) : 0,
    longTaskTotalMs: longTasks.reduce((sum, task) => sum + task.duration, 0),
    sampleDurationMs: sample.sampleDurationMs ?? 0,
    memory: sample.memory,
  };
}

async function collectDomInventory(page: Page) {
  return await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('*'));
    const highCost: Array<{ tag: string; testId: string | null; className: string; transition: string; boxShadow: string; filter: string; animation: string }> = [];
    const counts = {
      totalElements: elements.length,
      canvas: document.querySelectorAll('canvas').length,
      images: document.querySelectorAll('img').length,
      swCells: document.querySelectorAll('[data-testid^="sw-cell-"]').length,
      swUnits: document.querySelectorAll('[data-testid^="sw-unit-"]').length,
      transitionAll: 0,
      transitionColorOrBorder: 0,
      transitionBoxShadow: 0,
      boxShadow: 0,
      filter: 0,
      backdropFilter: 0,
      activeAnimation: 0,
      willChange: 0,
    };

    for (const el of elements) {
      const style = getComputedStyle(el);
      const transition = style.transitionProperty || '';
      const animation = style.animationName || '';
      const hasTransitionAll = transition.split(',').some((item) => item.trim() === 'all');
      const hasColorTransition = /(^|,|\s)(color|background-color|border-color|border-right-color|border-left-color|border-top-color|border-bottom-color)(,|\s|$)/.test(transition);
      const hasBoxShadowTransition = transition.includes('box-shadow');
      const hasBoxShadow = style.boxShadow && style.boxShadow !== 'none';
      const hasFilter = style.filter && style.filter !== 'none';
      const hasBackdrop = style.backdropFilter && style.backdropFilter !== 'none';
      const hasAnimation = animation && animation !== 'none';

      if (hasTransitionAll) counts.transitionAll += 1;
      if (hasColorTransition) counts.transitionColorOrBorder += 1;
      if (hasBoxShadowTransition) counts.transitionBoxShadow += 1;
      if (hasBoxShadow) counts.boxShadow += 1;
      if (hasFilter) counts.filter += 1;
      if (hasBackdrop) counts.backdropFilter += 1;
      if (hasAnimation) counts.activeAnimation += 1;
      if (style.willChange && style.willChange !== 'auto') counts.willChange += 1;

      if (
        highCost.length < 30
        && (hasTransitionAll || hasColorTransition || hasBoxShadowTransition || hasBoxShadow || hasFilter || hasBackdrop || hasAnimation)
      ) {
        highCost.push({
          tag: el.tagName.toLowerCase(),
          testId: el.getAttribute('data-testid'),
          className: typeof el.className === 'string' ? el.className.slice(0, 220) : '',
          transition,
          boxShadow: style.boxShadow,
          filter: style.filter,
          animation,
        });
      }
    }

    return { counts, highCost };
  });
}

async function startTrace(cdp: any) {
  await cdp.send('Tracing.start', {
    categories: traceCategories,
    transferMode: 'ReturnAsStream',
  });
}

async function stopTrace(cdp: any, outPath: string) {
  const complete = cdp.waitForEvent('Tracing.tracingComplete');
  await cdp.send('Tracing.end');
  const event = await complete;
  const handle = event.stream;
  let data = '';
  while (handle) {
    const chunk = await cdp.send('IO.read', { handle });
    data += chunk.data ?? '';
    if (chunk.eof) break;
  }
  if (handle) await cdp.send('IO.close', { handle }).catch(() => {});
  fs.writeFileSync(outPath, data, 'utf-8');
}

function summarizeTrace(tracePath: string) {
  const raw = fs.readFileSync(tracePath, 'utf-8');
  const trace = JSON.parse(raw) as { traceEvents?: Array<{ name?: string; dur?: number; ph?: string; ts?: number; cat?: string; args?: unknown }> };
  const events = trace.traceEvents ?? [];
  const names = new Map<string, { count: number; totalMs: number; maxMs: number }>();
  const focusedNames = new Set([
    'RunTask',
    'FunctionCall',
    'EvaluateScript',
    'FireAnimationFrame',
    'UpdateLayoutTree',
    'Layout',
    'Paint',
    'CompositeLayers',
    'DrawFrame',
    'ImageDecodeTask',
  ]);
  const longSlices: Array<{ name: string; durMs: number; ts: number; cat?: string }> = [];

  for (const event of events) {
    if (typeof event.name !== 'string' || typeof event.dur !== 'number') continue;
    const durMs = event.dur / 1000;
    if (focusedNames.has(event.name) || durMs >= 1) {
      const next = names.get(event.name) ?? { count: 0, totalMs: 0, maxMs: 0 };
      next.count += 1;
      next.totalMs += durMs;
      next.maxMs = Math.max(next.maxMs, durMs);
      names.set(event.name, next);
    }
    if (durMs >= 16.7) {
      longSlices.push({ name: event.name, durMs, ts: event.ts ?? 0, cat: event.cat });
    }
  }

  const textNeedles = [
    'border-right-color',
    'border-left-color',
    'border-top-color',
    'border-bottom-color',
    'border-color',
    'box-shadow',
    'filter',
    'backdrop-filter',
    'transition-all',
    'transition-colors',
    'UpdateLayoutTree',
    'FireAnimationFrame',
    'Layout',
    'Paint',
  ];

  return {
    fileBytes: Buffer.byteLength(raw),
    eventCount: events.length,
    textHits: Object.fromEntries(
      textNeedles.map((needle) => [needle, (raw.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length]),
    ),
    topDurations: [...names.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 25),
    longSlices: longSlices
      .sort((a, b) => b.durMs - a.durMs)
      .slice(0, 25),
  };
}

async function runMeasuredWindow(
  hostPage: Page,
  cdp: any,
  label: string,
  action: () => Promise<void>,
  waitAfterMs: number,
): Promise<PerfWindow> {
  const tracePath = path.join(evidenceDir, `chrome-trace-${label}.json`);
  await startPageSample(hostPage, label);
  await startTrace(cdp);
  await action();
  await hostPage.waitForTimeout(waitAfterMs);
  await stopTrace(cdp, tracePath);
  const sample = await stopPageSample(hostPage, label);
  return {
    label,
    pagePerf: summarizeFrames(sample),
    domInventory: await collectDomInventory(hostPage),
    trace: summarizeTrace(tracePath),
    tracePath,
  };
}

test.describe('召唤师战争动画特效性能探针', () => {
  test('采集召唤和远程击杀特效 trace', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.mkdirSync(path.dirname(latestPointerPath), { recursive: true });
    fs.writeFileSync(latestPointerPath, evidenceDir, 'utf-8');
    fs.copyFileSync(__filename, path.join(evidenceDir, 'summonerwars-fx-performance-probe.e2e.ts'));

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupFullFxOnlineMatch(browser, baseURL);
    if (!match) {
      test.skip(true, '召唤师战争服务器不可用或对局创建失败');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;
    const windows: PerfWindow[] = [];
    const cdp = await hostContext.newCDPSession(hostPage);

    try {
      await installPageSampler(hostPage);
      const environment = await hostPage.evaluate(() => ({
        webdriver: navigator.webdriver,
        e2eTestMode: Boolean((window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__),
        devicePixelRatio: window.devicePixelRatio,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }));

      const summon = prepareSummonState(await readCoreState(hostPage));
      await applyCoreState(hostPage, summon.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'summon', 10000);
      await expect(hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${summon.handCardId}"]`).first()).toBeVisible({ timeout: 5000 });
      windows.push(await runMeasuredWindow(hostPage, cdp, 'summon-full-fx', async () => {
        await hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${summon.handCardId}"]`).first().click();
        const summonTarget = hostPage.locator('[data-valid-summon="true"]').first();
        await expect(summonTarget).toBeVisible({ timeout: 5000 });
        const summonTargetId = await summonTarget.getAttribute('data-testid');
        if (!summonTargetId) throw new Error('无法解析召唤落点');
        await clickBoardElement(hostPage, `[data-testid="${summonTargetId}"]`);
      }, 3000));

      const ranged = prepareRangedKillState(await readCoreState(hostPage));
      await applyCoreState(hostPage, ranged.core);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack', 10000);
      const archerSelector = `[data-testid="sw-unit-${ranged.archerPosition.row}-${ranged.archerPosition.col}"][data-owner="0"]`;
      const targetSelector = `[data-testid="sw-unit-${ranged.targetPosition.row}-${ranged.targetPosition.col}"][data-owner="1"]`;
      await expect(hostPage.locator(archerSelector).first()).toBeVisible({ timeout: 5000 });
      await expect(hostPage.locator(targetSelector).first()).toBeVisible({ timeout: 5000 });
      windows.push(await runMeasuredWindow(hostPage, cdp, 'ranged-kill-full-fx', async () => {
        await clickBoardElement(hostPage, archerSelector);
        await clickBoardElement(hostPage, targetSelector);
        const overlay = hostPage.getByTestId('sw-dice-result-overlay');
        await expect(overlay).toBeVisible({ timeout: 8000 });
        await hostPage.waitForTimeout(900);
        await overlay.click({ force: true }).catch(() => {});
      }, 4500));

      const screenshotPath = path.join(evidenceDir, 'summonerwars-combat-fx.png');
      await hostPage.screenshot({ path: screenshotPath, fullPage: true });
      const finalDomInventory = await collectDomInventory(hostPage);
      const summary = {
        timestamp,
        matchId,
        target: '召唤师战争游戏内动画/特效性能',
        environment,
        notes: [
          '本探针不注入 __E2E_TEST_MODE__，并在浏览器初始化时覆盖 navigator.webdriver=false，用于采样完整战斗特效。',
          '音频请求已禁用，结果主要代表视觉动画/特效成本，不代表音频播放链路。',
          '这是修复前诊断基线，不是修复验收。',
        ],
        windows,
        finalDomInventory,
        screenshotPath,
      };
      fs.writeFileSync(path.join(evidenceDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
      fs.writeFileSync(
        path.join(evidenceDir, 'README.md'),
        [
          '# 召唤师战争动画特效性能诊断',
          '',
          '- 入口：本地 E2E runtime 创建召唤师战争在线对局。',
          '- 操作窗口：召唤落格、远程攻击击杀。',
          '- 采样：Chrome trace、页面 RAF 帧间隔、Long Task、DOM/CSS inventory。',
          '- 边界：禁用音频；覆盖 Playwright webdriver 标记以采样完整特效；本轮仍是修前诊断基线。',
          '',
          `summary: ${path.join(evidenceDir, 'summary.json')}`,
          `screenshot: ${screenshotPath}`,
        ].join('\n'),
        'utf-8',
      );

      expect(windows.length).toBe(2);
    } finally {
      await cdp.detach().catch(() => {});
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });
});
