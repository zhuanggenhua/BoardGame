import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.resolve('package.json'));
const { chromium, expect } = require('@playwright/test');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const targetUrl = 'https://boardgame-betrayal-local-verification.blushbison1024.chatgpt.site/play/betrayal/local';
const caseArgIndex = process.argv.indexOf('--case');
const requestedCase = caseArgIndex === -1 ? null : process.argv[caseArgIndex + 1] ?? null;
const supportedCases = new Set(['pawn-selection-toggle']);
if (caseArgIndex !== -1 && !supportedCases.has(requestedCase)) {
  throw new Error(`Unsupported --case value: ${requestedCase ?? '(missing)'}. Supported: ${[...supportedCases].join(', ')}`);
}
const isPawnSelectionToggleCase = requestedCase === 'pawn-selection-toggle';
const viewport = { width: 1600, height: 900 };
const chromiumLaunchArgs = process.platform === 'win32' ? ['--disable-gpu'] : [];
const evidenceRoot = path.join(projectRoot, 'test-results/evidence-screenshots/betrayal/public-local-acceptance');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(evidenceRoot, `run-${runId}-${randomBytes(2).toString('hex')}`);
const videoTempDir = path.join(runDir, '.video-tmp');
const startedAt = new Date().toISOString();
const steps = [];
const media = [];
const diagnostics = { console: [], pageErrors: [], failedRequests: [], httpErrors: [], chunks: [], footstep404s: [], roomAtlasResponses: [], roomAtlasFinished: [], mapResourceSamples: [], reselectAfterCancel: null, pawnSelectionToggle: null, movementCancellation: null };
const pendingRoomAtlasFinishes = [];
const roomAtlasStartedAt = new WeakMap();
const isRoomAtlasUrl = (url) => /(?:room-front-atlas|room-back-atlas|trophy-oubliette-atlas|start-triple-room|start-upper-landing|start-basement-landing)/i.test(decodeURIComponent(url));
const reportPath = path.join(runDir, 'acceptance-report.json');
let browser;
let browserVersion = null;
let context;
let page;
let fatalError = null;
let primaryResponseStatus = null;
let pageMetrics = null;
let shotIndex = 0;
let recordingStartedAt = null;
let recordingStartedEpochMs = null;
let recordingStoppedAt = null;

await mkdir(videoTempDir, { recursive: true });
const readMapResourceSnapshot = async () => page.evaluate(() => {
  const statuses = [...document.querySelectorAll('[data-map-resource-status]')].map((element) => ({ testId: element.getAttribute('data-testid'), status: element.getAttribute('data-map-resource-status'), renderer: element.getAttribute('data-map-renderer'), resourceUrl: element.getAttribute('data-map-resource-url') }));
  const map = document.querySelector('[data-testid=\"betrayal-room-grid\"]');
  const images = [...(map?.querySelectorAll('img') ?? [])].map((image) => { const rect=image.getBoundingClientRect(); const owner=image.closest('[data-testid^=\"betrayal-room-\"]'); return { roomTestId: owner?.getAttribute('data-testid') ?? null, src: image.getAttribute('src'), currentSrc: image.currentSrc || image.src, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, visible: rect.width > 0 && rect.height > 0, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, opacity: getComputedStyle(image).opacity, visibility: getComputedStyle(image).visibility }; });
  const resources = performance.getEntriesByType('resource').filter((entry) => /(?:room-front-atlas|room-back-atlas|trophy-oubliette-atlas|start-triple-room|start-upper-landing|start-basement-landing)/i.test(decodeURIComponent(entry.name))).map((entry) => ({ name: entry.name, startTime: entry.startTime, duration: entry.duration, responseEnd: entry.responseEnd, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }));
  return { statuses, images, resources };
});
const readPawnInteractionSample = async (token) => page.evaluate((testId) => {
  const token = document.querySelector(`[data-testid="${testId}"]`);
  const cue = document.querySelector('[data-testid="betrayal-action-cue"]');
  const detail = document.querySelector('[data-testid="betrayal-explorer-detail-overlay"]');
  const reach = document.querySelector('[data-testid="betrayal-map-move-reach-overlay"]');
  const door = document.querySelector('[data-testid="betrayal-room-move-door-breath-hallway-east"]');
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  return {
    sampledAt: new Date().toISOString(),
    tokenPresent: Boolean(token),
    ariaPressed: token?.getAttribute('aria-pressed') ?? null,
    dataMoveSource: token?.getAttribute('data-move-source') ?? null,
    isMovementSource: token?.getAttribute('data-move-source') === 'true',
    ariaLabel: token?.getAttribute('aria-label') ?? null,
    title: token?.getAttribute('title') ?? null,
    actionCueText: cue?.innerText?.trim() ?? null,
    actionCueVisible: visible(cue),
    detailOverlayVisible: visible(detail),
    detailOverlayText: detail?.innerText?.trim() ?? null,
    reachOverlayVisible: visible(reach),
    movementDoorVisible: visible(door),
  };
}, await token.getAttribute('data-testid'));
const capture = async (slug, sentence) => {
  shotIndex += 1;
  const file = `${String(shotIndex).padStart(2, '0')}-${slug}.png`;
  const absolutePath = path.join(runDir, file);
  await page.screenshot({ path: absolutePath, fullPage: false });
  const capturedAt = new Date().toISOString();
  const elapsedMs = recordingStartedEpochMs === null ? null : Date.now() - recordingStartedEpochMs;
  const mapSnapshot = await readMapResourceSnapshot();
  diagnostics.mapResourceSamples.push({ path: file, capturedAt, elapsedMs, ...mapSnapshot, consoleErrors: diagnostics.console.filter((entry) => entry.type === 'error').slice(-12), roomAtlasResponses: diagnostics.roomAtlasResponses.slice(), roomAtlasFinished: diagnostics.roomAtlasFinished.slice() });
  media.push({ path: file, type: 'image', label: sentence, viewport, capturedAt, elapsedMs });
  return absolutePath;
};
const recordStep = (name, status, detail = '') => steps.push({ name, status, detail, at: new Date().toISOString() });
const runStep = async (name, operation) => {
  const start = Date.now();
  try {
    const detail = await operation();
    recordStep(name, 'PASS', typeof detail === 'string' ? `${detail}; ${Date.now() - start}ms` : `${Date.now() - start}ms`);
    return detail;
  } catch (error) {
    recordStep(name, 'FAIL', error instanceof Error ? error.message : String(error));
    throw error;
  }
};
const waitForText = async (pattern, timeout = 180_000) => {
  await page.waitForFunction((source) => new RegExp(source, 'u').test(document.body?.innerText ?? ''), pattern, { timeout });
};
const readVisibleBoardMetrics = async () => page.evaluate(() => {
  const box = (id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
  };
  const canvas = document.querySelector('canvas');
  let graphics = null;
  if (canvas) {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      graphics = { vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) };
    }
  }
  const rail = document.querySelector('[data-testid="betrayal-action-rail"]');
  const railButtons = [...(rail?.querySelectorAll('button') ?? [])].map((button) => ({
    id: button.getAttribute('data-testid'), text: button.innerText.trim(), disabled: button.disabled,
    rect: (() => { const r = button.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
  }));
  const timing = performance.getEntriesByType('navigation')[0];
  return {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, screenWidth: screen.width, screenHeight: screen.height },
    canvas: canvas ? { width: canvas.width, height: canvas.height, cssWidth: canvas.getBoundingClientRect().width, cssHeight: canvas.getBoundingClientRect().height } : null,
    map: box('betrayal-room-grid'), currentRoom: box('betrayal-room-entrance-hall'), actionRail: box('betrayal-action-rail'), railButtons,
    navigation: timing ? { domContentLoadedMs: timing.domContentLoadedEventEnd, loadMs: timing.loadEventEnd, transferSize: timing.transferSize } : null,
    graphics, userAgent: navigator.userAgent,
  };
});

try {
  browser = await chromium.launch({ headless: true, chromiumSandbox: true, args: chromiumLaunchArgs });
  browserVersion = browser.version();
  context = await browser.newContext({
    viewport,
    screen: viewport,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: false,
    recordVideo: { dir: videoTempDir, size: viewport },
  });
  page = await context.newPage();
  recordingStartedAt = new Date().toISOString();
  recordingStartedEpochMs = Date.now();
  page.setDefaultTimeout(30_000);

  const pendingChunkDigests = [];

  page.on('console', (message) => {
    const entry = { type: message.type(), text: message.text() };
    if (message.type() === 'error' || message.type() === 'warning') diagnostics.console.push(entry);
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('request', (request) => { if (isRoomAtlasUrl(request.url())) roomAtlasStartedAt.set(request, new Date().toISOString()); });
  page.on('requestfailed', (request) => {
    diagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? null });
    if (isRoomAtlasUrl(request.url())) diagnostics.roomAtlasFinished.push({ url: request.url(), requestedAt: roomAtlasStartedAt.get(request) ?? null, finishedAt: new Date().toISOString(), status: null, error: request.failure()?.errorText ?? null });
  });
  page.on('requestfinished', (request) => { if (isRoomAtlasUrl(request.url())) pendingRoomAtlasFinishes.push((async () => { const response=await request.response(); const timing=request.timing(); diagnostics.roomAtlasFinished.push({ url: request.url(), requestedAt: roomAtlasStartedAt.get(request) ?? null, finishedAt: new Date().toISOString(), status: response?.status() ?? null, responseStartMs: timing.responseStart, responseEndMs: timing.responseEnd, resourceType: request.resourceType() }); })()); });
  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (isRoomAtlasUrl(url)) diagnostics.roomAtlasResponses.push({ url, status, at: new Date().toISOString(), contentType: response.headers()['content-type'] ?? null, resourceType: response.request().resourceType() });
    if (status >= 400) diagnostics.httpErrors.push({ status, url });
    if (status === 404 && /footsteps\/Kenney%20Impact%20Sounds\/compressed\/footstep_/i.test(url)) diagnostics.footstep404s.push(url);
    if (/(?:PixiMapSceneHost|Board)-[A-Za-z0-9_-]+\.js(?:\?|$)/.test(url)) {
      pendingChunkDigests.push((async () => {
        const body = await response.body().catch(() => Buffer.alloc(0));
        diagnostics.chunks.push({ filename: path.posix.basename(new URL(url).pathname), status, url, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
      })());
    }
  });

  await runStep('指定公开入口和资源版本', async () => {
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    primaryResponseStatus = response?.status() ?? null;
    expect(primaryResponseStatus).toBe(200);
    await waitForText('选择探索者');
    await Promise.allSettled(pendingChunkDigests);
    const names = new Set(diagnostics.chunks.filter((item) => item.status === 200).map((item) => item.filename));
    expect(names.has('PixiMapSceneHost-CBHDQRMf.js')).toBe(true);
    expect(names.has('Board-CPvzOEfz.js')).toBe(true);
    return `HTTP ${primaryResponseStatus}; ${[...names].join(', ')}`;
  });

  await runStep('真实选角和故事选择', async () => {
    const characterCard = page.getByTestId('betrayal-character-selection-grid').getByTestId('betrayal-character-card-father-warren-leung');
    await characterCard.click();
    await capture('角色选择起点', '玩家从本地真实入口选中神父并查看当前角色属性。');
    await expect(characterCard).toHaveAttribute('aria-label', /P1已选择/);
    await page.getByTestId('betrayal-character-confirm').click();
    await expect(page.getByTestId('betrayal-character-confirm')).toContainText('确认此剧本卡');
    await page.getByTestId('betrayal-character-scenario-button').click();
    await expect(page.getByTestId('betrayal-scenario-select-dialog')).toBeVisible();
    await page.getByTestId('betrayal-scenario-option-mummy-rampage').click();
    await expect(page.getByTestId('betrayal-scenario-option-mummy-rampage')).toContainText('当前提议');
    await capture('故事候选与胜利条件', '玩家确认角色后选择木乃伊横行，候选卡上显示可开局与胜利条件。');
    await page.getByTestId('betrayal-scenario-detail-toggle').click();
    await expect(page.getByTestId('betrayal-scenario-reader-dialog')).toBeVisible();
    await capture('故事正文阅读', '玩家打开完整剧本阅读页，故事正文与章节页在同一屏中显示。');
    await page.getByTestId('betrayal-scenario-reader-close').click();
    await page.getByTestId('betrayal-scenario-dialog-close').click();
    await expect(page.getByTestId('betrayal-scenario-select-dialog')).toBeHidden();
    return '角色、故事卡选择与正文阅读均由可见按钮完成';
  });

  await runStep('片头和本回合提示', async () => {
    await page.getByTestId('betrayal-character-confirm').click();
    await expect(page.getByTestId('betrayal-start-scenario-opening-stage')).toBeVisible();
    await expect(page.getByTestId('betrayal-start-scenario-opening-cinematic')).toContainText('英雄开场过场');
    await capture('英雄开场片头', '玩家确认故事卡后看到英雄开场片头与序章文字。');
    await page.getByTestId('betrayal-start-scenario-opening-continue').click();
    await expect(page.getByTestId('betrayal-start-scenario-opening-stage')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('betrayal-turn-intro-skip')).toBeVisible({ timeout: 45_000 });
    await capture('你的回合提示', '片头继续后出现神父本回合提示，玩家可从提示上跳过进入牌桌。');
    await page.getByTestId('betrayal-turn-intro-skip').click();
    await expect(page.getByTestId('betrayal-turn-intro-skip')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
    await capture('主地图与底部操作栏', '玩家跳过本回合提示后看到入口大厅、探索门位和统一底部操作按钮。');
    const statusesBeforeMove = await page.evaluate(() => [...document.querySelectorAll('[data-map-resource-status]')].map((element) => element.getAttribute('data-map-resource-status')));
    let readyGate = statusesBeforeMove.length === 0 || statusesBeforeMove.some((status) => status === 'ready' || status === 'error') ? 'already-terminal-or-unavailable' : 'waiting';
    if (readyGate === 'waiting') { try { await page.waitForFunction(() => [...document.querySelectorAll('[data-map-resource-status]')].some((element) => ['ready', 'error'].includes(element.getAttribute('data-map-resource-status'))), null, { timeout: 45_000 }); readyGate = 'terminal'; } catch { readyGate = 'timeout'; } }
    diagnostics.initialMapResourceGate = { statusesBeforeMove, result: readyGate, sampledAt: new Date().toISOString() };
    await capture('资源状态终结后的未移动地图', '首次hop前的data-map-resource-status及房间图片加载状态已保存。');
    pageMetrics = await readVisibleBoardMetrics();
    const requiredButtons = ['betrayal-action-trade', 'betrayal-action-use', 'betrayal-action-endTurn'];
    for (const id of requiredButtons) await expect(page.getByTestId(id)).toBeVisible();
    return `当前行动者：神父 梁沃伦；棋盘 ${pageMetrics.canvas?.width}×${pageMetrics.canvas?.height}；底栏按钮 ${requiredButtons.join(', ')}`;
  });

  await runStep('棋子来源状态与重复点击采样', async () => {
    const token = page.getByTestId('betrayal-room-occupant-entrance-hall-0');
    await expect(token).toBeVisible();
    const before = await readPawnInteractionSample(token);
    await capture('棋子状态-重复点击前', '首次稳定地图上的当前棋子来源状态、aria-pressed、提示、详情层和 reach 状态。');

    const samples = { before };
    let classification = 'MOVEMENT_SOURCE_TOGGLE';
    let status = 'NOT_VERIFIED';
    let reason = '';

    if (!before.isMovementSource) {
      classification = 'NON_MOVEMENT_SOURCE_DETAIL_INTERACTION';
      await token.click();
      await page.waitForTimeout(250);
      samples.afterClick = await readPawnInteractionSample(token);
      await capture('非移动来源棋子点击后', '当前棋子不是 movement source；单击后按详情交互/非来源状态记录，不计作取消移动。');
      if (samples.afterClick.detailOverlayVisible) {
        const close = page.getByTestId('betrayal-explorer-detail-close');
        if (await close.isVisible().catch(() => false)) {
          await close.click();
          await expect(page.getByTestId('betrayal-explorer-detail-overlay')).toHaveCount(0);
        }
        classification = 'DETAIL_INTERACTION';
      } else {
        classification = 'NON_MOVEMENT_SOURCE';
      }
      status = 'NOT_APPLICABLE';
      reason = 'The sampled token was not the active movement source, so this click is not evidence of movement cancellation.';
    } else {
      await token.click();
      await page.waitForTimeout(250);
      samples.afterFirstClick = await readPawnInteractionSample(token);
      await capture('棋子状态-第一次点击后', '记录 movement source 第一次点击后的 aria-pressed、可见提示、详情层与直接移动 reach。');

      if (samples.afterFirstClick.detailOverlayVisible) {
        classification = 'DETAIL_INTERACTION';
        status = 'NOT_APPLICABLE';
        reason = 'The first click opened the explorer detail layer; classify it as a detail interaction, not a movement-cancel attempt.';
        const close = page.getByTestId('betrayal-explorer-detail-close');
        if (await close.isVisible().catch(() => false)) {
          await close.click();
          await expect(page.getByTestId('betrayal-explorer-detail-overlay')).toHaveCount(0);
        }
      } else {
        await token.click();
        await page.waitForTimeout(250);
        samples.afterRepeatClick = await readPawnInteractionSample(token);
        await capture('棋子状态-重复点击后', '记录同一 movement source 重复点击后的 aria-pressed、可见提示、详情层与直接移动 reach。');

        const ariaAttributeAvailable = before.ariaPressed !== null && samples.afterFirstClick.ariaPressed !== null && samples.afterRepeatClick.ariaPressed !== null;
        const toggledOnFirstClick = ariaAttributeAvailable && samples.afterFirstClick.ariaPressed !== before.ariaPressed;
        const toggledOnRepeatClick = ariaAttributeAvailable && samples.afterRepeatClick.ariaPressed !== samples.afterFirstClick.ariaPressed;
        const returnedToInitialState = ariaAttributeAvailable && samples.afterRepeatClick.ariaPressed === before.ariaPressed;
        status = !ariaAttributeAvailable ? 'NOT_VERIFIED' : toggledOnFirstClick && toggledOnRepeatClick && returnedToInitialState ? 'PASS' : 'FAIL';
        reason = !ariaAttributeAvailable
          ? 'aria-pressed was unavailable in one or more samples.'
          : `aria-pressed toggle: first=${toggledOnFirstClick}, repeat=${toggledOnRepeatClick}, returnedToInitial=${returnedToInitialState}.`;
      }
    }

    diagnostics.pawnSelectionToggle = { status, classification, reason, samples };
    diagnostics.movementCancellation = {
      status: 'NOT_VERIFIED',
      reason: 'Persistent reach is a direct-move affordance; the run did not activate a separate cancel control, so reach visibility is not a cancellation verdict.',
      at: new Date().toISOString(),
    };
    if (status === 'FAIL') steps[steps.length - 1] = { ...steps[steps.length - 1], status: 'FAIL', detail: reason };

    if (isPawnSelectionToggleCase) return `case=${status}; classification=${classification}; ${reason}`;
    return `classification=${classification}; aria-pressed toggle=${status}; direct reach sampled independently from cancellation`;
  });

  if (!isPawnSelectionToggleCase) await runStep('逐格hop和门位状态', async () => {
    const reach = page.getByTestId('betrayal-map-move-reach-overlay');
    let hops = 0;
    if (await reach.isVisible().catch(() => false)) {
    await page.getByTestId('betrayal-room-hallway').click();
    const hallwayToken = page.getByTestId('betrayal-room-occupant-hallway-0');
    await expect(hallwayToken).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('betrayal-status-chip')).toContainText('剩余移动 3');
    await expect(reach).toBeVisible();
    await capture('第一次hop后地图与后续路径', '首次hop后记录地图资源、房间atlas和剩余移动，棋子位于门厅。');
    hops = 1;
    if (await reach.isVisible().catch(() => false)) {
      await page.getByTestId('betrayal-room-entrance-hall').click();
      await expect(page.getByTestId('betrayal-room-occupant-entrance-hall-0')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('betrayal-status-chip')).toContainText('剩余移动 2');
      await capture('第二次hop返回入口大厅', '第二次hop返回入口大厅，棋子和移动HUD可见。');
      hops = 2;
    }
    }
    return `真实完成 ${hops} 次逐格hop；取消/重选状态见独立步骤`;
  });

  if (!isPawnSelectionToggleCase) await runStep('门位探索中断、房间安置与发现收口', async () => {
    const targetRoom = page.getByTestId('betrayal-room-ground-east');
    await expect(targetRoom).toContainText('可探索');
    await targetRoom.click();
    const placement = page.getByTestId('betrayal-room-placement-panel');
    await expect(placement).toBeVisible();
    await expect(page.getByTestId('betrayal-room-placement-confirm')).toBeEnabled();
    await capture('未知门位朝向确认', '玩家点击未知门位后看到新房间卡面、入口方向与旋转确认。');
    await page.getByTestId('betrayal-room-placement-cancel').click();
    await expect(placement).toHaveCount(0);
    await expect(targetRoom).toContainText('未探索');
    await capture('取消安置后地图恢复', '玩家取消房间安置后门位仍保持未翻出，棋盘恢复可继续操作。');
    await targetRoom.click();
    await expect(placement).toBeVisible();
    await page.getByTestId('betrayal-room-placement-confirm').click();
    await capture('新房间落下过程', '玩家确认房间朝向后新房间落到入口相邻门位，连续录屏保留落下过程。');
    await expect(placement).toHaveCount(0, { timeout: 20_000 });

    const discovery = page.getByTestId('betrayal-discovery-panel');
    const discoveryOpen = await discovery.isVisible().catch(() => false);
    if (discoveryOpen) {
      await capture('新房间发现结果', '新房间揭示后出现对应发现结果，地图与结果内容同时可见。');
      for (let index = 0; index < 5 && await discovery.isVisible().catch(() => false); index += 1) {
        const next = page.getByTestId('betrayal-discovery-continue');
        await expect(next).toBeEnabled();
        const previousText = await discovery.innerText();
        await next.click();
        await page.waitForFunction((previous) => { const panel = document.querySelector('[data-testid=\"betrayal-discovery-panel\"]'); return !panel || panel.innerText.trim() !== previous.trim(); }, previousText, { timeout: 20_000 });
      }
      await expect(discovery).toBeHidden({ timeout: 20_000 });
    }
    const placedRoom = page.getByTestId('betrayal-room-ground-east');
    await expect(placedRoom).not.toContainText('未探索');
    await expect(page.getByTestId('betrayal-room-occupant-ground-east-0')).toBeVisible({ timeout: 15_000 });
    await capture('新房间稳定落点', '发现结果收口后，已翻开的新房间、神父棋子和后续门位完整留在牌桌上。');
    const finalBoard = await page.evaluate(() => {
      const tile = document.querySelector('[data-testid="betrayal-room-ground-east"]')?.getBoundingClientRect();
      const token = document.querySelector('[data-testid="betrayal-room-occupant-ground-east-0"]')?.getBoundingClientRect();
      const map = document.querySelector('[data-testid="betrayal-room-grid"]')?.getBoundingClientRect();
      return { tileVisible: Boolean(tile && tile.width > 0 && tile.height > 0), tokenVisible: Boolean(token && token.width > 0 && token.height > 0), mapVisible: Boolean(map && map.width > 0 && map.height > 0), tileCenter: tile ? { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 } : null, map: map ? { x: map.x, y: map.y, width: map.width, height: map.height } : null };
    });
    expect(finalBoard.tileVisible && finalBoard.tokenVisible && finalBoard.mapVisible).toBe(true);
    return `${discoveryOpen ? '发现结果已由可见按钮收口' : '未出现阻塞发现层'}；地图、已探索房间和棋子均可见`;
  });

  if (!isPawnSelectionToggleCase) await runStep('统一底栏和后续回合', async () => {
    const rail = page.getByTestId('betrayal-action-rail');
    await expect(rail).toBeVisible();
    const endTurn = page.getByTestId('betrayal-action-endTurn');
    await expect(endTurn).toBeEnabled();
    await capture('探索完成后的统一操作栏', '探索安置完成后玩家仍能看到同一底部操作栏和结束回合按钮。');
    await endTurn.click();
    const statusChip = page.getByTestId('betrayal-status-chip');
    await expect(statusChip).toContainText(/AI \d+ 号位/, { timeout: 20_000 });
    await expect(page.getByTestId('betrayal-turn-intro-skip')).toBeVisible({ timeout: 20_000 });
    await capture('AI post-turn intro', 'The next AI turn intro is visible after the player ends their turn.');
    await page.getByTestId('betrayal-turn-intro-skip').click();
    await expect(page.getByTestId('betrayal-turn-intro-skip')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
    await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
    await expect(statusChip).toContainText(/AI \d+ 号位/);
    await capture('Stable next AI turn board', 'After skipping the turn intro, the board, pawn and shared bottom action rail are visible.');
    const currentState = await statusChip.innerText();
    return `Next-turn status: ${currentState.replace(/\s+/g, ' ').trim()}`;
  });

  pageMetrics = await readVisibleBoardMetrics();
} catch (error) {
  fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (page && !page.isClosed()) {
    try { await capture('故障现场', '本次真实浏览器流程在此处停止，画面保留用于诊断。'); } catch { /* keep original failure */ }
  }
} finally {
  const video = page?.video();
  if (page && !page.isClosed()) await page.close().catch((error) => { diagnostics.pageCloseError = String(error); });
  if (context) await context.close().catch((error) => { diagnostics.closeError = String(error); });
  recordingStoppedAt = new Date().toISOString();
  if (browser) await browser.close().catch((error) => { diagnostics.browserCloseError = String(error); });
  if (video) {
    try {
      const sourceVideoPath = await video.path();
      const videoPath = path.join(runDir, '00-完整真实流程录屏.webm');
      await copyFile(sourceVideoPath, videoPath);
      const videoStat = await stat(videoPath);
      if (videoStat.size > 0) media.unshift({ path: path.basename(videoPath), type: 'video', label: 'Real user flow recording from the deployed /local entry.', viewport, recordingStartedAt, recordingStoppedAt });
    } catch (error) {
      diagnostics.videoError = error instanceof Error ? error.message : String(error);
    }
  }
}

await Promise.allSettled(pendingRoomAtlasFinishes);
for (const url of diagnostics.footstep404s) if (!diagnostics.footstep404s.includes(url)) diagnostics.footstep404s.push(url);
const uniqueSounds = [...new Set(diagnostics.footstep404s)];
const expectedChunks = ['PixiMapSceneHost-CBHDQRMf.js', 'Board-CPvzOEfz.js'];
const chunkNames = new Set(diagnostics.chunks.map((chunk) => chunk.filename));
const missingChunks = expectedChunks.filter((name) => !chunkNames.has(name));
const screenshots = media.filter((item) => item.type === 'image');
const videoPresent = media.some((item) => item.type === 'video');
const fullFlowPassed = fatalError === null && steps.length === 7 && steps.every((step) => step.status === 'PASS') && screenshots.length >= 10 && videoPresent;
const caseStatus = isPawnSelectionToggleCase ? diagnostics.pawnSelectionToggle?.status ?? 'NOT_VERIFIED' : null;
const functionalStatus = isPawnSelectionToggleCase ? 'NOT_VERIFIED' : fullFlowPassed ? 'PASS' : 'REVISE';
const report = {
  schemaVersion: 1,
  case: requestedCase ?? 'full-flow',
  caseStatus,
  runId,
  startedAt,
  finishedAt: new Date().toISOString(),
  target: targetUrl,
  effectiveUrl: page?.url() ?? null,
  targetHttpStatus: primaryResponseStatus,
  environment: { host: process.env.COMPUTERNAME ?? null, node: process.version, playwright: require('@playwright/test/package.json').version, chromium: browserVersion, mode: 'headless Chromium, project default launch settings', chromiumLaunchArgs, chromiumSandbox: true, ignoreHTTPSErrors: false, viewport, pageMetrics },
  actualRemoteBundles: diagnostics.chunks,
  expectedBundleNames: expectedChunks,
  missingBundles: missingChunks,
  knownSound404s: uniqueSounds,
  diagnostics,
  steps,
  media: media.map((item) => ({ ...item, absolutePath: path.join(runDir, item.path), bytes: null })),
  functionalStatus: functionalStatus ? 'PASS' : 'REVISE',
  visualReview: { status: isPawnSelectionToggleCase ? 'NOT_REQUESTED' : 'PENDING', reviewer: null, files: screenshots.map((item) => item.path) },
  verdict: isPawnSelectionToggleCase ? 'REVISE' : fullFlowPassed ? 'REVIEW_PENDING' : 'REVISE',
  failure: fatalError,
  limitations: ['仅验证指定公开 /local 页面；不证明固定座位的联机权限。', '本机 Chromium 使用无头软件渲染，视口为 1600×900；不代表有 GPU 加速的 headed 浏览器性能。', '截图均为整页可视视口，视频为同一真实交互运行。', ...(isPawnSelectionToggleCase ? ['本次仅复验棋子来源切换；不能判定完整产品验收。移动 reach 可见性不用于推断取消状态。'] : [])],
};
for (const item of report.media) {
  try { item.bytes = (await stat(item.absolutePath)).size; } catch { item.bytes = 0; }
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const index = {
  title: '山屋惊魂公开本地入口验收',
  media: media.map((item, index) => ({
    path: item.path,
    label: item.label,
    sourceRun: runId,
    chainId: isPawnSelectionToggleCase ? 'public-local-pawn-selection-toggle' : 'public-local-natural-flow',
    chainStep: index + 1,
    stage: item.type === 'video' ? '连续流程' : '可视状态',
    role: 'main-flow',
    viewport: '桌面 1600×900',
    transition: item.label,
    description: item.label,
  })),
};
await writeFile(path.join(runDir, '.e2e-image-index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
await rm(videoTempDir, { recursive: true, force: true }).catch(() => {});
console.log(JSON.stringify({
  case: report.case,
  caseStatus: report.caseStatus,
  verdict: report.verdict,
  functionalStatus: report.functionalStatus,
  runDirectory: runDir,
  report: reportPath,
  screenshots: screenshots.length,
  video: media.find((item) => item.type === 'video')?.path ?? null,
  bundles: diagnostics.chunks.map((chunk) => ({ filename: chunk.filename, status: chunk.status, sha256: chunk.sha256 })),
  footstep404Count: uniqueSounds.length,
  failure: fatalError,
  completedSteps: steps,
}, null, 2));
if (isPawnSelectionToggleCase) {
  if (caseStatus === 'FAIL') process.exitCode = 1;
  else if (caseStatus !== 'PASS') process.exitCode = 2;
} else if (!fullFlowPassed) process.exitCode = 1;
