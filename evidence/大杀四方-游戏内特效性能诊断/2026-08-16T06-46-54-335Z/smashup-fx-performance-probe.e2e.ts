import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from './framework';
import { setChineseLocale } from './helpers/common';

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

const __filename = fileURLToPath(import.meta.url);
const timestamp = process.env.SU_FX_PROBE_TIMESTAMP
  ?? new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.join(process.cwd(), 'evidence', '大杀四方-游戏内特效性能诊断', timestamp);
const latestPointerPath = path.join(process.cwd(), 'temp', 'smashup-fx-performance-probe-latest.txt');

const traceCategories = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'blink.user_timing',
  'toplevel',
  'v8',
].join(',');

async function installPageSampler(page: Page) {
  await page.evaluate(() => {
    const holder = window as Window & {
      __SU_PERF_PROBE__?: {
        active: boolean;
        label: string;
        startedAt: number;
        lastFrameAt: number;
        frames: number[];
        longTasks: Array<{ name: string; startTime: number; duration: number }>;
      };
      __SU_PERF_OBSERVER_INSTALLED__?: boolean;
    };

    if (!holder.__SU_PERF_PROBE__) {
      holder.__SU_PERF_PROBE__ = {
        active: false,
        label: '',
        startedAt: 0,
        lastFrameAt: performance.now(),
        frames: [],
        longTasks: [],
      };
    }

    if (!holder.__SU_PERF_OBSERVER_INSTALLED__) {
      holder.__SU_PERF_OBSERVER_INSTALLED__ = true;
      const loop = (now: number) => {
        const probe = holder.__SU_PERF_PROBE__;
        if (probe?.active) {
          probe.frames.push(now - probe.lastFrameAt);
        }
        if (probe) probe.lastFrameAt = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      try {
        const observer = new PerformanceObserver((list) => {
          const probe = holder.__SU_PERF_PROBE__;
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
    const holder = window as Window & { __SU_PERF_PROBE__?: any };
    const probe = holder.__SU_PERF_PROBE__;
    probe.active = true;
    probe.label = nextLabel;
    probe.startedAt = performance.now();
    probe.lastFrameAt = performance.now();
    probe.frames = [];
    probe.longTasks = [];
    performance.mark(`su-fx-probe:${nextLabel}:start`);
  }, label);
}

async function stopPageSample(page: Page, label: string) {
  return await page.evaluate((nextLabel) => {
    const holder = window as Window & { __SU_PERF_PROBE__?: any; performance?: Performance & { memory?: unknown } };
    const probe = holder.__SU_PERF_PROBE__;
    performance.mark(`su-fx-probe:${nextLabel}:end`);
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
    const highCost: Array<{
      tag: string;
      testId: string | null;
      className: string;
      transition: string;
      boxShadow: string;
      filter: string;
      animation: string;
    }> = [];
    const counts = {
      totalElements: elements.length,
      canvas: document.querySelectorAll('canvas').length,
      images: document.querySelectorAll('img').length,
      smashupBases: document.querySelectorAll('[data-base-index]').length,
      smashupMinions: document.querySelectorAll('[data-minion-uid]').length,
      triggeredFxCanvases: document.querySelectorAll('[data-testid="smashup-triggered-fx-canvas"]').length,
      triggeredFxLines: document.querySelectorAll('[data-testid="smashup-triggered-fx-line"]').length,
      triggeredFxTargets: document.querySelectorAll('[data-testid="smashup-triggered-fx-target-card"]').length,
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
        highCost.length < 40
        && (hasTransitionAll || hasColorTransition || hasBoxShadowTransition || hasBoxShadow || hasFilter || hasBackdrop || hasAnimation)
      ) {
        highCost.push({
          tag: el.tagName.toLowerCase(),
          testId: el.getAttribute('data-testid'),
          className: typeof el.className === 'string' ? el.className.slice(0, 260) : '',
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

function waitForCdpEvent(cdp: any, eventName: string) {
  return new Promise<any>((resolve) => {
    const handler = (event: any) => {
      if (typeof cdp.off === 'function') cdp.off(eventName, handler);
      else if (typeof cdp.removeListener === 'function') cdp.removeListener(eventName, handler);
      resolve(event);
    };
    cdp.on(eventName, handler);
  });
}

async function stopTrace(cdp: any, outPath: string) {
  const complete = waitForCdpEvent(cdp, 'Tracing.tracingComplete');
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
  const trace = JSON.parse(raw) as {
    traceEvents?: Array<{ name?: string; dur?: number; ph?: string; ts?: number; cat?: string; args?: unknown }>;
  };
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
    'ImageDecodeTask',
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
  page: Page,
  cdp: any,
  label: string,
  action: () => Promise<void>,
  waitAfterMs: number,
): Promise<PerfWindow> {
  const tracePath = path.join(evidenceDir, `chrome-trace-${label}.json`);
  await startPageSample(page, label);
  await startTrace(cdp);
  await action();
  await page.waitForTimeout(waitAfterMs);
  await stopTrace(cdp, tracePath);
  const sample = await stopPageSample(page, label);
  return {
    label,
    pagePerf: summarizeFrames(sample),
    domInventory: await collectDomInventory(page),
    trace: summarizeTrace(tracePath),
    tracePath,
  };
}

async function appendSmashUpEvent(page: Page, event: { type: string; payload: Record<string, unknown> }) {
  await page.evaluate((nextEvent) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    if (!harness || !state) {
      throw new Error('TestHarness state is not available');
    }
    const currentStream = state.sys?.eventStream ?? { entries: [], nextId: 1, maxEntries: 200 };
    const nextId = typeof currentStream.nextId === 'number'
      ? currentStream.nextId
      : ((currentStream.entries?.at?.(-1)?.id ?? 0) + 1);
    const maxEntries = Number.isFinite(currentStream.maxEntries) ? currentStream.maxEntries : 200;
    const entries = [
      ...(Array.isArray(currentStream.entries) ? currentStream.entries : []),
      { id: nextId, event: { ...nextEvent, timestamp: Date.now() } },
    ].slice(-maxEntries);
    harness.state.set({
      ...state,
      sys: {
        ...state.sys,
        eventStream: {
          ...currentStream,
          entries,
          maxEntries,
          nextId: nextId + 1,
        },
      },
    });
  }, event);
}

test.describe('大杀四方游戏内触发特效性能探针', () => {
  test('采集普通棋盘与触发销毁特效 trace', async ({ page, context, game }) => {
    test.setTimeout(180000);
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.mkdirSync(path.dirname(latestPointerPath), { recursive: true });
    fs.writeFileSync(latestPointerPath, evidenceDir, 'utf-8');
    fs.copyFileSync(__filename, path.join(evidenceDir, 'smashup-fx-performance-probe.e2e.ts'));

    await setChineseLocale(context);
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['sharks', 'robots'],
        hand: [],
        deck: [],
        discard: [],
        field: [
          { uid: 'source-1', defId: 'sharks_hammerhead', baseIndex: 0, owner: '0', controller: '0' },
        ],
      },
      player1: {
        factions: ['robots', 'wizards'],
        hand: [],
        deck: [],
        discard: [],
        field: [
          { uid: 'target-1', defId: 'robot_microbot_alpha', baseIndex: 0, owner: '1', controller: '1' },
          { uid: 'target-2', defId: 'wizard_archmage', baseIndex: 1, owner: '1', controller: '1' },
        ],
      },
      bases: [
        { defId: 'base_the_mothership' },
        { defId: 'base_the_jungle' },
        { defId: 'base_the_factory' },
      ],
      sys: {
        eventStream: { entries: [], nextId: 1, maxEntries: 200 },
      },
    });

    await expect(page.locator('[data-base-index="0"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="source-1"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="target-1"]').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);

    await installPageSampler(page);
    const cdp = await context.newCDPSession(page);
    const windows: PerfWindow[] = [];

    try {
      const environment = await page.evaluate(() => ({
        webdriver: navigator.webdriver,
        e2eTestMode: Boolean((window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__),
        imageGateSkipped: Boolean((window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__),
        devicePixelRatio: window.devicePixelRatio,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        href: window.location.href,
      }));

      windows.push(await runMeasuredWindow(page, cdp, 'baseline-board-idle', async () => {
        await page.waitForTimeout(50);
      }, 2500));

      windows.push(await runMeasuredWindow(page, cdp, 'ability-triggered-destroy-fx', async () => {
        await appendSmashUpEvent(page, {
          type: 'su:minion_destroyed',
          payload: {
            minionUid: 'target-1',
            minionDefId: 'robot_microbot_alpha',
            fromBaseIndex: 0,
            baseIndex: 0,
            ownerId: '1',
            controllerId: '1',
            reason: 'sharks_hammerhead',
            sourceCardUid: 'source-1',
            sourceDefId: 'sharks_hammerhead',
          },
        });
        await expect(page.getByTestId('smashup-triggered-fx-destroy-marker')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('smashup-triggered-fx-target-card')).toBeVisible({ timeout: 5000 });
      }, 4200));

      await page.waitForTimeout(800);

      windows.push(await runMeasuredWindow(page, cdp, 'ability-triggered-buff-fx', async () => {
        await appendSmashUpEvent(page, {
          type: 'su:power_counter_added',
          payload: {
            minionUid: 'source-1',
            baseIndex: 0,
            amount: 1,
            reason: 'sharks_hammerhead',
            sourceCardUid: 'source-1',
            sourceDefId: 'sharks_hammerhead',
          },
        });
        await expect(page.getByTestId('smashup-triggered-fx-buff-marker')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('smashup-triggered-fx-target-card')).toBeVisible({ timeout: 5000 });
      }, 3200));

      const screenshotPath = path.join(evidenceDir, 'smashup-triggered-fx-after-sampling.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const finalDomInventory = await collectDomInventory(page);
      const summary = {
        timestamp,
        target: '大杀四方游戏内触发/攻击相关特效性能',
        userSymptom: '大杀四方现在有点卡，怀疑最近新增攻击/触发特效导致',
        environment,
        notes: [
          '本探针通过 TestHarness 打开 /play/smashup 并注入状态，验证页面渲染性能。',
          '本次 E2E 入口跳过关键图片门禁，只代表页面/特效渲染性能，不代表图片预加载链路健康。',
          '触发窗口通过正式 EventStream 追加 su:minion_destroyed / su:power_counter_added 事件，不直接调用 React 内部组件。',
          '这是定位证据，不是修复验收。',
        ],
        windows,
        finalDomInventory,
        screenshotPath,
      };
      fs.writeFileSync(path.join(evidenceDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
      fs.writeFileSync(
        path.join(evidenceDir, 'README.md'),
        [
          '# 大杀四方游戏内特效性能诊断',
          '',
          '- 入口：本地 E2E TestHarness 打开 `/play/smashup`。',
          '- 场景：普通棋盘空闲、触发器导致随从销毁、触发器导致力量增加。',
          '- 采样：Chrome trace、页面 RAF 帧间隔、Long Task、DOM/CSS inventory。',
          '- 边界：测试入口跳过关键图片门禁；本轮仍是定位基线。',
          '',
          `summary: ${path.join(evidenceDir, 'summary.json')}`,
          `screenshot: ${screenshotPath}`,
        ].join('\n'),
        'utf-8',
      );

      expect(windows).toHaveLength(3);
    } finally {
      await cdp.detach().catch(() => {});
    }
  });
});
