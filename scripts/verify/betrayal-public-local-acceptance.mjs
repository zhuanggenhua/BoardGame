import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireGlobalHeavyBudget } from '../infra/global-heavy-budget.mjs';
import { acquireTaskGuard } from '../infra/heavy-task-guard.mjs';
import {
  assertPublishedBundleIdentity,
  loadExpectedBundleManifest,
  resolveTargetUrl,
} from './betrayal-public-local-acceptance-config.mjs';
import { requireSettledBoard, startDeadline, waitForPendingDecisionOrSettledBoard, waitForPendingDecisionPresentation, withTimeout, writeCheckpoint } from './betrayal-public-local-acceptance-runtime.mjs';

const require = createRequire(path.resolve('package.json'));
const { chromium, expect } = require('@playwright/test');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const replaySeedArgIndex = process.argv.indexOf('--seed');
const replaySeed = replaySeedArgIndex === -1 ? null : process.argv[replaySeedArgIndex + 1] ?? null;
const targetUrlObject = resolveTargetUrl(process.env.BASE_URL);
if (replaySeed) targetUrlObject.searchParams.set('seed', replaySeed);
const expectedBundleManifest = loadExpectedBundleManifest(
  process.env.EXPECTED_BUNDLE_MANIFEST_PATH,
  { cwd: projectRoot },
);
const expectedDeployedBundles = expectedBundleManifest.bundles;
const expectedBundleFilenames = new Set(expectedDeployedBundles.map((bundle) => bundle.filename));
const caseArgIndex = process.argv.indexOf('--case');
const requestedCase = caseArgIndex === -1 ? null : process.argv[caseArgIndex + 1] ?? null;
const supportedCases = new Set(['pawn-selection-toggle', 'room-reveal-sequencing', 'local-ui-closeout', 'character-turn-prompt', 'map-readiness']);
if (caseArgIndex !== -1 && !supportedCases.has(requestedCase)) {
  throw new Error(`Unsupported --case value: ${requestedCase ?? '(missing)'}. Supported: ${[...supportedCases].join(', ')}`);
}
const isPawnSelectionToggleCase = requestedCase === 'pawn-selection-toggle';
const isRoomRevealSequenceCase = requestedCase === 'room-reveal-sequencing';
const isLocalUiCloseoutCase = requestedCase === 'local-ui-closeout';
const isCharacterTurnPromptCase = requestedCase === 'character-turn-prompt';
const isMapReadinessCase = requestedCase === 'map-readiness';
if (isMapReadinessCase) targetUrlObject.searchParams.set('mobileDebug', '1');
const targetUrl = targetUrlObject.toString();
const isNarrowCase = isPawnSelectionToggleCase || isRoomRevealSequenceCase || isLocalUiCloseoutCase || isCharacterTurnPromptCase || isMapReadinessCase;
const invocationStartedEpochMs = Date.now();
const viewport = { width: 1600, height: 900 };
const chromiumLaunchArgs = process.platform === 'win32' ? ['--disable-gpu'] : [];
const evidenceRoot = path.join(projectRoot, 'test-results/evidence-screenshots/betrayal/public-local-acceptance');
const suppliedRunId = process.env.BETRAYAL_PUBLIC_ACCEPTANCE_RUN_ID ?? null;
if (suppliedRunId && !/^[a-zA-Z0-9_-]+$/u.test(suppliedRunId)) throw new Error('Invalid externally supplied acceptance run ID.');
const runId = suppliedRunId ?? new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(evidenceRoot, `run-${runId}${suppliedRunId ? '' : `-${randomBytes(2).toString('hex')}`}`);
const videoTempDir = path.join(runDir, '.video-tmp');
const commandLine = process.argv.join(' ');
const taskGuard = acquireTaskGuard({
  name: 'e2e-run',
  command: commandLine,
  metadata: { mode: 'public-local-external', target: targetUrl, managedRuntime: false, runtimeScope: 'external-public-local', serviceReuse: 'none', listOnly: false, entrypoint: 'betrayal-public-local-acceptance' },
});
let globalBudgetHandle;
try {
  globalBudgetHandle = await acquireGlobalHeavyBudget({
    group: 'e2e',
    command: commandLine,
    waitForBudget: true,
    waitTimeoutMs: isMapReadinessCase ? 20_000 : 30 * 60 * 1000,
    metadata: { mode: 'public-local-external', target: targetUrl, runtimeScope: 'external-public-local', serviceReuse: 'none', entrypoint: 'betrayal-public-local-acceptance' },
  });
} catch (error) {
  taskGuard.release();
  throw error;
}
const startedAt = new Date().toISOString();
const steps = [];
const media = [];
const diagnostics = { console: [], pageErrors: [], failedRequests: [], httpErrors: [], pageResponses: [], chunks: [], footstep404s: [], roomAtlasResponses: [], roomAtlasFinished: [], mapResourceSamples: [], reselectAfterCancel: null, pawnSelectionToggle: null, movementCancellation: null, roomRevealSequence: null, characterTraitReadability: null, characterTurnPrompt: null };
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
let publishedBundleIdentity = null;
let pageMetrics = null;
let shotIndex = 0;
let recordingStartedAt = null;
let recordingStartedEpochMs = null;
let recordingStoppedAt = null;
const partialReportPath = path.join(runDir, 'acceptance-report.partial.json');
let mapDiagnosticPhase = 'preflight';
let mapReadinessStatus = 'NOT_STARTED';
let mapDiagnosticFailure = null;
let mapDiagnosticStartedEpochMs = null;
let mapDiagnosticFinishedAt = null;
let cancelMapDiagnosticDeadline = null;
let forceMapDiagnosticExitTimer = null;
const mapDiagnosticMaxMs = 180_000;
const mapDiagnosticDeadlineMs = 170_000;

const persistAcceptanceCheckpoint = async (phase = mapDiagnosticPhase) => {
  if (isMapReadinessCase) mapDiagnosticPhase = phase;
  const checkpoint = {
    schemaVersion: 1,
    type: 'public-local-acceptance-checkpoint',
    runId,
    case: requestedCase ?? 'full-flow',
    phase,
    status: isMapReadinessCase ? mapReadinessStatus : 'IN_PROGRESS',
    caseStatus: isMapReadinessCase ? mapReadinessStatus : isRoomRevealSequenceCase ? (fatalError ? 'FAIL' : diagnostics.nextTurnHandoff?.status === 'READY' && diagnostics.roomRevealSequence?.status === 'PASS' ? 'PASS' : diagnostics.roomRevealSequence?.status ?? 'IN_PROGRESS') : diagnostics.localUiCloseout?.status ?? diagnostics.pawnSelectionToggle?.status ?? diagnostics.characterTurnPrompt?.status ?? 'IN_PROGRESS',
    functionalStatus: 'NOT_VERIFIED',
    verdict: 'PENDING',
    startedAt: startedAt ?? null,
    checkpointAt: new Date().toISOString(),
    elapsedMs: Date.now() - invocationStartedEpochMs,
    maximumDurationMs: isMapReadinessCase || isRoomRevealSequenceCase ? 180_000 : null,
    target: targetUrl,
    expectedPublishedSiteVersion: expectedBundleManifest.siteVersion,
    expectedBundles: expectedDeployedBundles,
    primaryResponseStatus,
    publishedBundleIdentity,
    actualRemoteBundles: diagnostics.chunks,
    steps,
    screenshots: media.filter((item) => item.type === 'image'),
    diagnostics,
    failure: mapDiagnosticFailure ?? fatalError,
  };
  await withTimeout(writeCheckpoint(partialReportPath, checkpoint), 5_000, 'acceptance checkpoint write');
};

const closeDiagnosticResources = async () => {
  for (const [label, close] of [
    ['page', () => page && !page.isClosed() ? page.close() : Promise.resolve()],
    ['context', () => context ? context.close() : Promise.resolve()],
    ['browser', () => browser ? browser.close() : Promise.resolve()],
  ]) {
    try { await withTimeout(close(), 2_000, `${label} close`); }
    catch (error) { diagnostics.cleanupErrors ??= []; diagnostics.cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  try { globalBudgetHandle?.release?.(); } catch (error) { diagnostics.cleanupErrors ??= []; diagnostics.cleanupErrors.push(`budget release: ${String(error)}`); }
  try { taskGuard.release(); } catch (error) { diagnostics.cleanupErrors ??= []; diagnostics.cleanupErrors.push(`task guard release: ${String(error)}`); }
};

const startMapDiagnosticDeadline = () => {
  if (!isMapReadinessCase) return;
  mapDiagnosticStartedEpochMs = invocationStartedEpochMs;
  const elapsedMs = Date.now() - invocationStartedEpochMs;
  const workDeadlineMs = Math.max(1, mapDiagnosticDeadlineMs - elapsedMs);
  forceMapDiagnosticExitTimer = setTimeout(() => process.exit(124), Math.max(1, mapDiagnosticMaxMs - elapsedMs));
  forceMapDiagnosticExitTimer.unref?.();
  cancelMapDiagnosticDeadline = startDeadline(workDeadlineMs, async () => {
    mapReadinessStatus = 'DEADLINE_EXCEEDED';
    mapDiagnosticFailure = `Diagnostic exceeded its ${mapDiagnosticDeadlineMs} ms work deadline (${mapDiagnosticMaxMs} ms total maximum).`;
    try { await persistAcceptanceCheckpoint('deadline-before-cleanup'); }
    catch (error) { console.error(`[public-local-acceptance] checkpoint failed at deadline: ${String(error)}`); }
    await closeDiagnosticResources();
    console.error(`[public-local-acceptance] map readiness diagnostic stopped at ${mapDiagnosticDeadlineMs} ms; report: ${partialReportPath}`);
    process.exit(124);
  });
};

await mkdir(isMapReadinessCase ? runDir : videoTempDir, { recursive: true });
await persistAcceptanceCheckpoint('initialized-before-browser');
const readMapResourceSnapshot = async () => withTimeout(page.evaluate(() => {
  const statuses = [...document.querySelectorAll('[data-map-resource-status]')].map((element) => ({ testId: element.getAttribute('data-testid'), status: element.getAttribute('data-map-resource-status'), renderer: element.getAttribute('data-map-renderer'), resourceUrl: element.getAttribute('data-map-resource-url') }));
  const map = document.querySelector('[data-testid=\"betrayal-room-grid\"]');
  const images = [...(map?.querySelectorAll('img') ?? [])].map((image) => { const rect=image.getBoundingClientRect(); const owner=image.closest('[data-testid^=\"betrayal-room-\"]'); return { roomTestId: owner?.getAttribute('data-testid') ?? null, src: image.getAttribute('src'), currentSrc: image.currentSrc || image.src, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, visible: rect.width > 0 && rect.height > 0, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, opacity: getComputedStyle(image).opacity, visibility: getComputedStyle(image).visibility }; });
  const resources = performance.getEntriesByType('resource').filter((entry) => /(?:room-front-atlas|room-back-atlas|trophy-oubliette-atlas|start-triple-room|start-upper-landing|start-basement-landing)/i.test(decodeURIComponent(entry.name))).map((entry) => ({ name: entry.name, startTime: entry.startTime, duration: entry.duration, responseEnd: entry.responseEnd, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }));
  return { statuses, images, resources };
}), isMapReadinessCase ? 8_000 : 15_000, 'map resource snapshot');
const readPublicPageSnapshot = async () => withTimeout(page.evaluate(() => {
  const safePath = (value) => {
    try {
      const parsed = new URL(value, location.href);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return String(value).slice(0, 240);
    }
  };
  const trace = window.__BG_MATCH_LOAD_TRACE__;
  const runtimeLogs = window.__BOARDGAME_MOBILE_RUNTIME_LOGS__;
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const relevantNodes = [...document.querySelectorAll('[data-testid], [role="alert"]')]
    .filter((element) => visible(element))
    .map((element) => ({
      testId: element.getAttribute('data-testid'),
      role: element.getAttribute('role'),
      text: (element.innerText ?? '').trim().slice(0, 500),
    }))
    .filter((element) => element.role === 'alert' || /loading|error|game|client|namespace/i.test(`${element.testId ?? ''} ${element.text}`))
    .slice(-40);
  const resources = performance.getEntriesByType('resource')
    .filter((entry) => /\/assets\/|\/locales\//i.test(entry.name))
    .slice(-60)
    .map((entry) => ({
      path: safePath(entry.name),
      initiatorType: entry.initiatorType,
      durationMs: Math.round(entry.duration),
      responseEndMs: Math.round(entry.responseEnd),
      transferSize: entry.transferSize,
    }));
  return {
    urlPath: location.pathname,
    title: document.title,
    readyState: document.readyState,
    bodyText: document.body?.innerText?.slice(0, 4000) ?? '',
    relevantNodes,
    matchLoadTrace: trace && Array.isArray(trace.entries)
      ? trace.entries.filter((entry) => !entry.gameId || entry.gameId === 'betrayal').slice(-80)
      : null,
    mobileRuntimeLogs: Array.isArray(runtimeLogs)
      ? runtimeLogs.filter((entry) => ['GameNamespace', 'GameRuntime'].includes(entry.scope)
        && (!entry.payload?.gameId || entry.payload.gameId === 'betrayal')).slice(-80)
      : null,
    resources,
  };
}), 5_000, 'public page diagnostic snapshot');
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
const readDiscoveryCardSample = async () => page.evaluate(() => {
  const panel = document.querySelector('[data-testid="betrayal-discovery-panel"]');
  const frame = panel?.querySelector('[data-testid="betrayal-discovery-card-front-atlas"]') ?? null;
  const image = frame?.querySelector('img') ?? null;
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  const rectOf = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const styleOf = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    return { transform: style.transform, width: style.width, height: style.height, left: style.left, top: style.top, objectFit: style.objectFit, objectPosition: style.objectPosition, clipPath: style.clipPath, opacity: style.opacity, visibility: style.visibility };
  };
  const ancestorsOf = (element) => {
    const ancestors = [];
    let current = element?.parentElement ?? null;
    while (current && ancestors.length < 5) {
      ancestors.push({ tagName: current.tagName, testId: current.getAttribute('data-testid'), className: typeof current.className === 'string' ? current.className : '', role: current.getAttribute('role'), ariaLabel: current.getAttribute('aria-label') });
      current = current.parentElement;
    }
    return ancestors;
  };
  const topVisibleTextNodes = [...document.querySelectorAll('body *')]
    .filter((element) => {
      if (element.children.length > 0 || !element.textContent?.trim()) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < 150 && rect.left > 450 && rect.right < 1150 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
    })
    .map((element) => ({ tagName: element.tagName, testId: element.getAttribute('data-testid'), className: typeof element.className === 'string' ? element.className : '', text: element.textContent?.trim() ?? '', rect: rectOf(element), ancestors: ancestorsOf(element) }))
    .slice(0, 40);
  const panelVisibleTextNodes = [...(panel?.querySelectorAll('*') ?? [])]
    .filter((element) => element.children.length === 0 && element.textContent?.trim() && visible(element))
    .map((element) => ({ tagName: element.tagName, testId: element.getAttribute('data-testid'), className: typeof element.className === 'string' ? element.className : '', text: element.textContent?.trim() ?? '', rect: rectOf(element), computedStyle: styleOf(element), ancestors: ancestorsOf(element) }))
    .slice(0, 80);
  const describeNode = (element) => element ? { tagName: element.tagName, testId: element.getAttribute('data-testid'), className: typeof element.className === 'string' ? element.className : '', text: element.textContent?.trim() ?? '', rect: rectOf(element), computedStyle: styleOf(element), ancestors: ancestorsOf(element) } : null;
  const bannerTitleNode = panel?.querySelector('[data-testid="betrayal-discovery-top-banner-title"]') ?? null;
  const bannerDetailNode = panel?.querySelector('[data-testid="betrayal-discovery-top-banner-detail"]') ?? null;
  return {
    sampledAt: new Date().toISOString(),
    panelVisible: visible(panel),
    panelAriaLabel: panel?.getAttribute('aria-label') ?? null,
    bannerTitle: bannerTitleNode?.textContent?.trim() ?? null,
    bannerTitleNode: describeNode(bannerTitleNode),
    bannerDetail: bannerDetailNode?.textContent?.trim() ?? null,
    bannerDetailNode: describeNode(bannerDetailNode),
    panelVisibleTextNodes,
    visibleDetail: panel?.querySelector('[data-testid="betrayal-discovery-visible-detail"]')?.textContent?.trim() ?? null,
    framePresent: Boolean(frame),
    frameIndex: frame?.getAttribute('data-atlas-frame-index') ?? null,
    frameAssetSrc: frame?.getAttribute('data-asset-src') ?? null,
    frameAriaLabel: frame?.getAttribute('aria-label') ?? null,
    frameRect: rectOf(frame),
    frameComputedStyle: styleOf(frame),
    imagePresent: Boolean(image),
    imageFrameIndex: image?.getAttribute('data-atlas-frame-index') ?? null,
    imageAssetSrc: image?.getAttribute('data-asset-src') ?? null,
    imageCurrentSrc: image?.currentSrc ?? null,
    imageAlt: image?.getAttribute('alt') ?? null,
    imageComplete: image?.complete ?? false,
    imageNaturalWidth: image?.naturalWidth ?? 0,
    imageNaturalHeight: image?.naturalHeight ?? 0,
    imageRect: rectOf(image),
    imageComputedStyle: styleOf(image),
    topVisibleTextNodes,
  };
});
const capture = async (slug, sentence) => {
  if (isCharacterTurnPromptCase && !slug.startsWith('ai-ack-')) return null;
  if (isRoomRevealSequenceCase && shotIndex > 0 && slug !== 'stable-next-ai-turn') {
    diagnostics.screenshotCaptureNotes ??= [];
    diagnostics.screenshotCaptureNotes.push({
      requestedState: slug,
      skippedAt: new Date().toISOString(),
      reason: 'This case reuses the existing same-seed event-card screenshot and avoids repeated WebGL readbacks during business verification.',
    });
    return null;
  }
  shotIndex += 1;
  const file = `${String(shotIndex).padStart(2, '0')}-${slug}.png`;
  const absolutePath = path.join(runDir, file);
  const screenshot = page.screenshot({ path: absolutePath, fullPage: false });
  if (isMapReadinessCase || isRoomRevealSequenceCase) await withTimeout(screenshot, 12_000, `screenshot ${slug}`);
  else await screenshot;
  console.log(`[public-local-acceptance] screenshot saved: ${file}`);
  const capturedAt = new Date().toISOString();
  const elapsedMs = recordingStartedEpochMs === null ? null : Date.now() - recordingStartedEpochMs;
  media.push({ path: file, type: 'image', label: sentence, viewport, capturedAt, elapsedMs });
  await persistAcceptanceCheckpoint(`screenshot-saved:${file}`);
  let mapSnapshot = null;
  try { mapSnapshot = await readMapResourceSnapshot(); }
  catch (error) {
    diagnostics.mapResourceSnapshotFailures ??= [];
    diagnostics.mapResourceSnapshotFailures.push({ path: file, at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
    if (!isMapReadinessCase) throw error;
  }
  if (mapSnapshot) diagnostics.mapResourceSamples.push({ path: file, capturedAt, elapsedMs, ...mapSnapshot, consoleErrors: diagnostics.console.filter((entry) => entry.type === 'error').slice(-12), roomAtlasResponses: diagnostics.roomAtlasResponses.slice(), roomAtlasFinished: diagnostics.roomAtlasFinished.slice() });
  console.log(`[public-local-acceptance] screenshot diagnostics ${mapSnapshot ? 'complete' : 'timed out'}: ${file}`);
  await persistAcceptanceCheckpoint(`screenshot-diagnosed:${file}`);
  return absolutePath;
};
const recordStep = (name, status, detail = '') => steps.push({ name, status, detail, at: new Date().toISOString() });
const runStep = async (name, operation, { timeoutMs } = {}) => {
  const start = Date.now();
  console.log(`[public-local-acceptance] start: ${name}`);
  await persistAcceptanceCheckpoint(`step-start:${name}`);
  try {
    const operationPromise = operation();
    const detail = isMapReadinessCase || isRoomRevealSequenceCase
      ? await withTimeout(operationPromise, timeoutMs ?? 60_000, `step ${name}`)
      : await operationPromise;
    recordStep(name, 'PASS', typeof detail === 'string' ? `${detail}; ${Date.now() - start}ms` : `${Date.now() - start}ms`);
    console.log(`[public-local-acceptance] pass: ${name}; ${Date.now() - start}ms`);
    await persistAcceptanceCheckpoint(`step-pass:${name}`);
    return detail;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (isRoomRevealSequenceCase) {
      const phase = diagnostics.roomRevealSequence?.phase ?? null;
      try {
        const snapshot = await withTimeout(page.evaluate(() => {
          const ids = ['betrayal-room-placement-panel', 'betrayal-room-placement-confirm', 'betrayal-event-choice-panel', 'betrayal-event-choice-confirm', 'betrayal-damage-allocation-panel', 'betrayal-discovery-panel', 'betrayal-action-rail', 'betrayal-action-endTurn'];
          const elements = ids.map(testId => { const element = document.querySelector('[data-testid=\"' + testId + '\"]'); if (!element) return { testId, present: false }; const rect = element.getBoundingClientRect(); return { testId, present: true, visible: rect.width > 0 && rect.height > 0, disabled: 'disabled' in element ? element.disabled : null, ariaLabel: element.getAttribute('aria-label'), text: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').slice(0, 240) }; });
          return { readyState: document.readyState, bodyText: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 1600), elements };
        }), 2_000, 'room reveal failure DOM snapshot');
        diagnostics.roomRevealFailureSnapshot = { phase, capturedAt: new Date().toISOString(), snapshot };
      } catch (snapshotError) {
        diagnostics.roomRevealFailureSnapshot = { phase, capturedAt: new Date().toISOString(), error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError) };
      }
    }
    const phase = diagnostics.roomRevealSequence?.phase;
    const failureDetail = phase ? errorMessage + '; roomRevealPhase=' + phase : errorMessage;
    recordStep(name, 'FAIL', failureDetail);
    console.error('[public-local-acceptance] fail: ' + name + '; ' + failureDetail);
    await persistAcceptanceCheckpoint(`step-fail:${name}`);
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
const readCharacterTraitReadability = async () => page.evaluate(async () => {
  const traitWord = String.fromCharCode(0x7279, 0x6027);
  const normalize = (value) => (value ?? '').replace(/\s+/gu, ' ').trim();
  const rectOf = (element) => { const rect = element?.getBoundingClientRect(); return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left } : null; };
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  const candidates = [...document.querySelectorAll('p,div,span,section,article')]
    .filter((element) => visible(element) && normalize(element.innerText).includes(traitWord) && normalize(element.innerText).length >= 20 && normalize(element.innerText).length <= 1500)
    .sort((left, right) => normalize(left.innerText).length - normalize(right.innerText).length);
  const trait = candidates[0] ?? null;
  if (!trait) return { traitFound: false, footerFound: Boolean(document.querySelector('[data-testid="betrayal-character-player-footer"]')) };
  const isScrollStyle = (value) => ['auto', 'scroll', 'overlay'].includes(value);
  let scroller = null;
  for (let ancestor = trait; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
    if (isScrollStyle(getComputedStyle(ancestor).overflowY)) { scroller = ancestor; break; }
  }
  if (!scroller) {
    scroller = [...document.querySelectorAll('*')]
      .filter((element) => element !== document.body && isScrollStyle(getComputedStyle(element).overflowY) && normalize(element.innerText).includes(traitWord))
      .sort((left, right) => {
        const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect();
        return (a.width * a.height) - (b.width * b.height);
      })[0] ?? null;
  }
  const footer = document.querySelector('[data-testid="betrayal-character-player-footer"]');
  const footerRect = rectOf(footer);
  const clipRect = rectOf(scroller) ?? { x: 0, y: 0, width: innerWidth, height: innerHeight, top: 0, right: innerWidth, bottom: innerHeight, left: 0 };
  const lineRects = () => {
    const range = document.createRange();
    range.selectNodeContents(trait);
    return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0).map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left }));
  };
  const within = (line, box) => Boolean(line && box && line.left >= box.left - 1 && line.right <= box.right + 1 && line.top >= box.top - 1 && line.bottom <= box.bottom + 1 && line.top >= -1 && line.bottom <= innerHeight + 1);
  const intersects = (left, right) => Boolean(left && right && left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top);
  const initialLines = lineRects();
  const initialFirstVisible = initialLines.length > 0 && within(initialLines[0], clipRect);
  const previousScrollTop = scroller?.scrollTop ?? 0;
  const maxScroll = scroller ? Math.max(0, scroller.scrollHeight - scroller.clientHeight) : 0;
  if (maxScroll > 1) {
    scroller.scrollTop = maxScroll;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  const endLines = lineRects();
  const endClipRect = rectOf(scroller) ?? clipRect;
  const endLastVisible = endLines.length > 0 && within(endLines.at(-1), endClipRect);
  const scrollTopAtEnd = scroller?.scrollTop ?? 0;
  const footerOverlap = [...initialLines.filter((line) => within(line, clipRect)), ...endLines.filter((line) => within(line, endClipRect))].some((line) => intersects(line, footerRect));
  if (scroller && maxScroll > 1) {
    scroller.scrollTop = previousScrollTop;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return {
    traitFound: true,
    traitText: normalize(trait.innerText),
    traitElement: { tagName: trait.tagName, testId: trait.getAttribute('data-testid'), className: String(trait.className ?? ''), rect: rectOf(trait) },
    scrollerFound: Boolean(scroller),
    scroller: scroller ? { tagName: scroller.tagName, testId: scroller.getAttribute('data-testid'), className: String(scroller.className ?? ''), overflowY: getComputedStyle(scroller).overflowY, rect: rectOf(scroller), scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight, maxScroll, scrollTopAtEnd } : null,
    footerFound: Boolean(footer && visible(footer)),
    footer: footer ? { testId: footer.getAttribute('data-testid'), rect: footerRect } : null,
    defaultTextVisible: initialFirstVisible,
    scrolledToEnd: maxScroll <= 1 || scrollTopAtEnd >= maxScroll - 1,
    endTextVisible: maxScroll <= 1 ? endLines.length > 0 && endLines.every((line) => within(line, endClipRect)) : endLastVisible,
    footerOverlap,
    initialTextRects: initialLines,
    endTextRects: endLines,
  };
});
const readTurnPromptSample = async () => page.evaluate(() => {
  const normalize = (value) => (value ?? '').replace(/\s+/gu, ' ').trim();
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  const yourTurnText = String.fromCharCode(0x4f60, 0x7684, 0x56de, 0x5408);
  const matches = [...document.querySelectorAll('div,span,p,h1,h2,h3')]
    .filter((element) => visible(element) && normalize(element.innerText).includes(yourTurnText) && normalize(element.innerText).length <= 160)
    .sort((left, right) => normalize(left.innerText).length - normalize(right.innerText).length);
  const cue = matches[0] ?? null;
  const skip = document.querySelector('[data-testid="betrayal-turn-intro-skip"]');
  const status = document.querySelector('[data-testid="betrayal-status-chip"]');
  const cueRect = cue?.getBoundingClientRect();
  return {
    sampledAt: new Date().toISOString(),
    statusText: normalize(status?.innerText),
    turnIntroSkipVisible: visible(skip),
    turnIntroSkipTestId: skip?.getAttribute('data-testid') ?? null,
    yourTurnVisible: Boolean(cue),
    yourTurnCue: cue ? { text: normalize(cue.innerText), tagName: cue.tagName, testId: cue.getAttribute('data-testid'), className: String(cue.className ?? ''), rect: cueRect ? { x: cueRect.x, y: cueRect.y, width: cueRect.width, height: cueRect.height } : null } : null,
  };
});

const readAiConfirmationUiSample = async () => page.evaluate(() => {
  const normalize = (value) => (value ?? '').replace(/\s+/gu, ' ').trim();
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  const buttonIds = ['betrayal-discovery-continue', 'betrayal-roll-continue'];
  const buttons = buttonIds.map((testId) => {
    const button = document.querySelector(`[data-testid="${testId}"]`);
    if (!button) return null;
    return {
      testId,
      visible: visible(button),
      disabled: Boolean(button.disabled),
      disabledAttribute: button.getAttribute('disabled'),
      ariaDisabled: button.getAttribute('aria-disabled'),
      text: normalize(button.innerText),
      pendingCardResolutionId: button.getAttribute('data-pending-card-resolution-id'),
      pendingCardResolutionStep: button.getAttribute('data-pending-card-resolution-step'),
      cardResolutionConfirmedCount: button.getAttribute('data-card-resolution-confirmed-count'),
      cardResolutionRequiredCount: button.getAttribute('data-card-resolution-required-count'),
      eventRollConfirmedCount: button.getAttribute('data-event-roll-confirmed-count'),
      eventRollRequiredCount: button.getAttribute('data-event-roll-required-count'),
      eventRollReadable: button.getAttribute('data-event-roll-readable'),
    };
  }).filter((button) => button?.visible);
  const discovery = document.querySelector('[data-testid="betrayal-discovery-panel"]');
  const status = document.querySelector('[data-testid="betrayal-status-chip"]');
  return {
    sampledAt: new Date().toISOString(),
    currentActorText: normalize(status?.innerText),
    discoveryPanelText: normalize(discovery?.innerText),
    visibleConfirmationButtons: buttons,
    explicitViewerPlayerId: new URL(location.href).searchParams.get('playerID'),
  };
});

const readPersistedLocalGameState = async () => page.evaluate(() => {
  const url = new URL(location.href);
  const gameId = url.pathname.match(/^\/play\/([^/]+)\/local\/?$/u)?.[1] ?? null;
  const seed = url.searchParams.get('seed');
  const snapshotKey = gameId && seed ? `local_match_snapshot_v1:${gameId}:${seed}` : null;
  let snapshot = null;
  let snapshotError = null;
  if (snapshotKey) {
    try {
      const raw = localStorage.getItem(snapshotKey);
      snapshot = raw ? JSON.parse(raw) : null;
    } catch (error) {
      snapshotError = error instanceof Error ? error.message : String(error);
    }
  }
  const state = snapshot?.state ?? null;
  const core = state?.core ?? null;
  const playerIds = Array.isArray(core?.playerIds) ? core.playerIds.map(String) : [];
  const numPlayers = Number(snapshot?.numPlayers) || playerIds.length || Number(url.searchParams.get('players')) || 0;
  const seatControllers = {};
  for (let index = 0; index < numPlayers; index += 1) {
    const playerId = String(index);
    const rawParam = url.searchParams.get(`seat${index}`);
    const paramType = rawParam?.split(':', 1)[0] ?? null;
    const defaultType = index > 0 && numPlayers > 1 ? 'local-ai' : 'human';
    const resolvedType = rawParam === null
      ? defaultType
      : paramType === 'local-ai'
        ? 'local-ai'
        : 'human';
    const coreOverride = core?.seatControllers?.[playerId] ?? null;
    seatControllers[playerId] = {
      type: typeof coreOverride?.type === 'string' ? coreOverride.type : resolvedType,
      source: typeof coreOverride?.type === 'string'
        ? 'local snapshot core override merged over route controller'
        : rawParam === null
          ? 'Betrayal manifest default: human seat 0, local AI opponents'
          : 'local route seat parameter',
      rawParam,
      difficultyParam: url.searchParams.get(`seat${index}Difficulty`),
      coreOverride,
    };
  }
  const controllerTypes = Object.fromEntries(Object.entries(seatControllers).map(([playerId, value]) => [playerId, value.type]));
  const normalizeResolution = (resolution) => {
    if (!resolution || typeof resolution !== 'object') return null;
    const hasPersistedRequiredPlayerIds = Array.isArray(resolution.requiredPlayerIds) && resolution.requiredPlayerIds.length > 0;
    const required = hasPersistedRequiredPlayerIds
      ? resolution.requiredPlayerIds.map(String)
      : resolution.playerId == null ? [] : [String(resolution.playerId)];
    const acknowledged = Array.isArray(resolution.acknowledgedPlayerIds)
      ? [...new Set(resolution.acknowledgedPlayerIds.map(String))]
      : [];
    return {
      id: resolution.id ?? resolution.rollId ?? null,
      playerId: resolution.playerId == null ? null : String(resolution.playerId),
      ownerPlayerId: resolution.ownerPlayerId == null ? null : String(resolution.ownerPlayerId),
      sourceTitle: resolution.sourceTitle ?? null,
      cardName: resolution.cardName ?? null,
      stepKind: resolution.stepKind ?? null,
      index: resolution.index ?? null,
      total: resolution.total ?? null,
      requiresAcknowledgement: resolution.requiresAcknowledgement ?? null,
      requiresPlayerAdvance: resolution.requiresPlayerAdvance ?? null,
      requiredPlayerIds: required,
      requiredPlayerIdsSource: hasPersistedRequiredPlayerIds ? 'persisted requiredPlayerIds' : 'derived from persisted playerId because requiredPlayerIds was absent',
      acknowledgedPlayerIds: acknowledged,
      missingPlayerIds: required.filter((id) => !acknowledged.includes(id)),
      confirmedCount: required.filter((id) => acknowledged.includes(id)).length,
      requiredCount: required.length,
    };
  };
  const pendingEvent = core?.pendingEventRollResolution ?? null;
  let eventRoll = normalizeResolution(pendingEvent);
  if (pendingEvent && eventRoll && (!Array.isArray(pendingEvent.requiredPlayerIds) || pendingEvent.requiredPlayerIds.length === 0)) {
    const requiresOwnerAdvance = pendingEvent.requiresPlayerAdvance || pendingEvent.requiresAcknowledgement === false;
    const humanSeats = playerIds.filter((id) => !controllerTypes[id] || controllerTypes[id] === 'human');
    const fallbackRequired = requiresOwnerAdvance
      ? (pendingEvent.playerId == null ? [] : [String(pendingEvent.playerId)])
      : humanSeats.length > 0
        ? humanSeats
        : pendingEvent.playerId == null ? [] : [String(pendingEvent.playerId)];
    eventRoll = {
      ...eventRoll,
      requiredPlayerIds: fallbackRequired,
      missingPlayerIds: fallbackRequired.filter((id) => !eventRoll.acknowledgedPlayerIds.includes(id)),
      requiredPlayerIdsSource: requiresOwnerAdvance ? 'owner seat by event-roll rules' : 'human seats from resolved local seatControllers',
    };
  }
  const pendingCards = Array.isArray(core?.pendingCardResolutionQueue)
    ? core.pendingCardResolutionQueue.map(normalizeResolution).filter(Boolean)
    : [];
  return {
    source: 'existing local_match_snapshot_v1 localStorage entry (read-only)',
    snapshotKey,
    snapshotError,
    snapshotFound: Boolean(snapshot),
    savedAt: snapshot?.savedAt ?? null,
    snapshotAgeMs: typeof snapshot?.savedAt === 'number' ? Math.max(0, Date.now() - snapshot.savedAt) : null,
    gameId: snapshot?.gameId ?? gameId,
    seedMatchesCurrentUrl: Boolean(seed && snapshot?.seed === seed),
    numPlayers: snapshot?.numPlayers ?? numPlayers,
    currentPlayerId: core?.currentPlayer == null ? null : String(core.currentPlayer),
    currentPlayerIdSource: 'persisted state.core.currentPlayer',
    activePlayerId: core?.activePlayerId == null ? null : String(core.activePlayerId),
    activePlayerIdSource: Object.hasOwn(core ?? {}, 'activePlayerId') ? 'persisted state.core.activePlayerId' : 'activePlayerId absent from persisted state.core',
    playerIds,
    viewerPlayerId: url.searchParams.get('playerID') ?? null,
    viewerPlayerIdSource: url.searchParams.has('playerID') ? 'explicit route query' : 'not exposed; do not infer from saved currentPlayerId',
    seatControllers,
    stateSeatControllers: core?.seatControllers ?? null,
    pendingCardResolutionQueueLength: pendingCards.length,
    pendingCardResolutions: pendingCards,
    pendingEventRollResolution: eventRoll,
    recentRoll: normalizeResolution(core?.recentRoll),
  };
});
const readMatchingPersistedLocalGameState = async (uiSample) => {
  let latest = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    latest = await readPersistedLocalGameState();
    const button = uiSample.visibleConfirmationButtons.find((item) => item.pendingCardResolutionId)
      ?? uiSample.visibleConfirmationButtons.find((item) => item.eventRollRequiredCount !== null);
    let matchesVisibleResolution = false;
    if (button?.pendingCardResolutionId) {
      matchesVisibleResolution = latest.pendingCardResolutions.some((item) => item.id === button.pendingCardResolutionId);
    } else if (button?.eventRollRequiredCount !== null && latest.pendingEventRollResolution) {
      matchesVisibleResolution = String(latest.pendingEventRollResolution.confirmedCount) === button.eventRollConfirmedCount
        && String(latest.pendingEventRollResolution.requiredCount) === button.eventRollRequiredCount;
    } else if (uiSample.discoveryPanelText) {
      const activeCard = latest.pendingCardResolutions[0];
      matchesVisibleResolution = Boolean(activeCard && [activeCard.cardName, activeCard.sourceTitle].some((value) => value && uiSample.discoveryPanelText.includes(value)));
    }
    if (latest.snapshotFound && latest.seedMatchesCurrentUrl && matchesVisibleResolution) {
      return { ...latest, matchesVisibleResolution, matchAttempts: attempt + 1 };
    }
    if (attempt < 4) await page.waitForTimeout(100);
  }
  return { ...(latest ?? {}), matchesVisibleResolution: false, matchAttempts: 5 };
};

try {
  if (isMapReadinessCase) startMapDiagnosticDeadline();
  const launchPromise = chromium.launch({ headless: true, chromiumSandbox: true, args: chromiumLaunchArgs });
  browser = isMapReadinessCase || isRoomRevealSequenceCase ? await withTimeout(launchPromise, 20_000, 'Chromium launch') : await launchPromise;
  browserVersion = browser.version();
  context = await browser.newContext({
    viewport,
    screen: viewport,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: false,
    ...(isMapReadinessCase || isRoomRevealSequenceCase ? {} : { recordVideo: { dir: videoTempDir, size: viewport } }),
  });
  const pagePromise = context.newPage();
  page = isMapReadinessCase || isRoomRevealSequenceCase ? await withTimeout(pagePromise, 10_000, 'browser page creation') : await pagePromise;
  recordingStartedAt = new Date().toISOString();
  recordingStartedEpochMs = Date.now();
  page.setDefaultTimeout(isMapReadinessCase ? 8_000 : 30_000);

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
    if (isMapReadinessCase && diagnostics.pageResponses.length < 160) {
      const request = response.request();
      const resourceType = request.resourceType();
      if (['document', 'script', 'xhr', 'fetch'].includes(resourceType) || /\/locales\//i.test(url)) {
        let pathOnly = url;
        try {
          const parsed = new URL(url);
          pathOnly = `${parsed.origin}${parsed.pathname}`;
        } catch { /* retain the response URL for malformed URLs */ }
        diagnostics.pageResponses.push({ status, path: pathOnly, resourceType, contentType: response.headers()['content-type'] ?? null, at: new Date().toISOString() });
      }
    }
    if (isRoomAtlasUrl(url)) diagnostics.roomAtlasResponses.push({ url, status, at: new Date().toISOString(), contentType: response.headers()['content-type'] ?? null, resourceType: response.request().resourceType() });
    if (status >= 400) diagnostics.httpErrors.push({ status, url });
    if (status === 404 && /footsteps\/Kenney%20Impact%20Sounds\/compressed\/footstep_/i.test(url)) diagnostics.footstep404s.push(url);
    const filename = path.posix.basename(new URL(url).pathname);
    if (expectedBundleFilenames.has(filename)) {
      pendingChunkDigests.push((async () => {
        const body = await response.body().catch(() => Buffer.alloc(0));
        diagnostics.chunks.push({ filename, status, url, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
      })());
    }
  });

  if (isMapReadinessCase) {
    mapReadinessStatus = 'IN_PROGRESS';
    await persistAcceptanceCheckpoint('browser-ready');
    await runStep('verify public page and bundle identity', async () => {
      const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      primaryResponseStatus = response?.status() ?? null;
      expect(primaryResponseStatus).toBe(200);
      await capture('public-page-entry', 'Actual public-site entry state immediately after loading the verified v92 build.');
      diagnostics.initialPageState = await readPublicPageSnapshot();
      await persistAcceptanceCheckpoint('public-page-state-sampled');
      await waitForText('选择探索者', 55_000);
      await expect(page.getByTestId('betrayal-character-selection-grid')).toBeVisible({ timeout: 8_000 });
      await withTimeout(Promise.allSettled(pendingChunkDigests), 12_000, 'published bundle digests');
      publishedBundleIdentity = assertPublishedBundleIdentity(expectedBundleManifest, diagnostics.chunks);
      return `HTTP ${primaryResponseStatus}; exact Site version ${expectedBundleManifest.siteVersion}; ${diagnostics.chunks.map((item) => `${item.filename} sha256=${item.sha256}`).join(', ')}`;
    }, { timeoutMs: 130_000 });
    await runStep('open the selected scenario and initial board', async () => {
      const characterCard = page.getByTestId('betrayal-character-selection-grid').getByTestId('betrayal-character-card-father-warren-leung');
      await characterCard.click();
      await expect(characterCard).toHaveAttribute('aria-label', /P1/u, { timeout: 5_000 });
          await page.getByTestId('betrayal-character-confirm').click();
    const openingStage = page.getByTestId('betrayal-start-scenario-opening-stage');
    const openingContinue = page.getByTestId('betrayal-start-scenario-opening-continue');
    const board = page.getByTestId('betrayal-board');
    let openingContinueShown = false;
    if (isRoomRevealSequenceCase) {
      await expect.poll(async () =>
        await openingContinue.isVisible().catch(() => false) ||
        await board.isVisible().catch(() => false),
      { timeout: 45_000 }).toBe(true);
      openingContinueShown = await openingContinue.isVisible().catch(() => false);
      if (openingContinueShown) {
        await expect(openingContinue).toBeEnabled();
        await openingContinue.click({ force: true });
        await expect(openingStage).toHaveCount(0, { timeout: 45_000 });
      }
      diagnostics.openingTransition = { status: 'READY', openingContinueShown };
    } else {
      await expect(openingStage).toBeVisible();
      await expect(page.getByTestId('betrayal-start-scenario-opening-cinematic')).toContainText('英雄降临');
      if (!isRoomRevealSequenceCase) await capture('英雄开场片头', 'The selected scenario opening is available.');
      await openingContinue.click();
      await expect(openingStage).toHaveCount(0);
    }
    await expect(board).toBeVisible({ timeout: 45_000 });
    const turnIntroSkip = page.getByTestId('betrayal-turn-intro-skip');
      await expect(turnIntroSkip).toBeVisible({ timeout: 25_000 });
      await expect(turnIntroSkip).toBeEnabled();
      await expect(turnIntroSkip).toHaveAttribute('data-presentation-stage', 'play');
      // The full-screen skip surface animates while remaining a valid pointer target.
      // Use a real mouse click while bypassing only Playwright's moving-box heuristic.
      await turnIntroSkip.click({ force: true });
      await expect(page.getByTestId('betrayal-room-grid')).toBeVisible({ timeout: 10_000 });
      await capture('map-before-ready', 'Initial cloud-hosted board before the map-ready signal; diagnostic only.');
      return 'Selected a real character and scenario, entered the exploration board, and captured its pre-ready state.';
    });
    await runStep('wait for map ready or error and test one pawn selection', async () => {
      const readStatuses = () => page.evaluate(() => [...document.querySelectorAll('[data-map-resource-status]')].map((element) => ({ testId: element.getAttribute('data-testid'), status: element.getAttribute('data-map-resource-status'), renderer: element.getAttribute('data-map-renderer'), resourceUrl: element.getAttribute('data-map-resource-url') })));
      const statusesBeforeWait = await withTimeout(readStatuses(), 5_000, 'initial map status sample');
      let readinessSignal = statusesBeforeWait.some((item) => item.status === 'ready') ? 'already-ready' : statusesBeforeWait.some((item) => item.status === 'error') ? 'already-error' : 'waiting';
      if (readinessSignal === 'waiting') {
        try {
          await page.waitForFunction(() => [...document.querySelectorAll('[data-map-resource-status]')].some((element) => ['ready', 'error'].includes(element.getAttribute('data-map-resource-status'))), null, { timeout: 45_000 });
          readinessSignal = 'ready-or-error-observed';
        } catch (error) {
          readinessSignal = 'readiness-timeout';
          diagnostics.mapReadinessWaitError = error instanceof Error ? error.message : String(error);
        }
      }
      const statusesAtEnd = await withTimeout(readStatuses(), 5_000, 'final map status sample').catch((error) => {
        diagnostics.finalMapStatusSampleError = error instanceof Error ? error.message : String(error);
        return [];
      });
      const ready = statusesAtEnd.some((item) => item.status === 'ready');
      const errorState = statusesAtEnd.some((item) => item.status === 'error');
      mapReadinessStatus = ready ? 'READY' : errorState ? 'MAP_ERROR' : 'MAP_TIMEOUT';
      const mapSnapshot = await readMapResourceSnapshot().catch((error) => {
        diagnostics.finalMapSnapshotError = error instanceof Error ? error.message : String(error);
        return null;
      });
      diagnostics.initialMapResourceGate = { statusesBeforeWait, statusesAtEnd, readinessSignal, observedAt: new Date().toISOString(), mapSnapshot };
      await persistAcceptanceCheckpoint('map-state-captured-before-final-screenshot');
      await capture(ready ? 'map-ready' : errorState ? 'map-error' : 'map-timeout', 'Cloud-hosted map readiness terminal state; diagnostic evidence only, not a visual verdict.');
      if (ready) {
        const pawn = page.getByTestId('betrayal-room-occupant-entrance-hall-0');
        const pawnVisible = await pawn.isVisible().catch(() => false);
        diagnostics.mapReadinessInteraction = { pawnVisible, selected: false, deselected: false };
        if (pawnVisible) {
          await pawn.click();
          await expect(pawn).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
          diagnostics.mapReadinessInteraction.selected = true;
          await pawn.click();
          await expect(pawn).toHaveAttribute('aria-pressed', 'false', { timeout: 5_000 });
          diagnostics.mapReadinessInteraction.deselected = true;
          mapReadinessStatus = 'READY_INTERACTIVE';
        } else {
          mapReadinessStatus = 'READY_NO_PAWN';
        }
      }
      diagnostics.mapReadiness = { status: mapReadinessStatus, readinessSignal, statusesBeforeWait, statusesAtEnd, browserSandbox: true, localServerStarted: false };
      await persistAcceptanceCheckpoint('map-diagnostic-result');
      return `Map status ${mapReadinessStatus}; readiness signal ${readinessSignal}; pawn selection ${JSON.stringify(diagnostics.mapReadinessInteraction ?? null)}`;
    }, { timeoutMs: 60_000 });
    mapDiagnosticFinishedAt = new Date().toISOString();
    await persistAcceptanceCheckpoint('before-browser-cleanup');
    cancelMapDiagnosticDeadline?.();
    throw Object.assign(new Error('map readiness diagnostic complete'), { code: 'MAP_DIAGNOSTIC_COMPLETE' });
  }
  await runStep('指定公开入口和资源版本', async () => {
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    primaryResponseStatus = response?.status() ?? null;
    expect(primaryResponseStatus).toBe(200);
    await waitForText('选择探索者');
    await Promise.allSettled(pendingChunkDigests);
    publishedBundleIdentity = assertPublishedBundleIdentity(expectedBundleManifest, diagnostics.chunks);
    const successfulChunks = diagnostics.chunks.filter((item) => item.status === 200);
    return `HTTP ${primaryResponseStatus}; ${successfulChunks.map((item) => `${item.filename} sha256=${item.sha256}`).join(', ')}`;
  });

  await runStep('真实选角和故事选择', async () => {
    const characterCard = page.getByTestId('betrayal-character-selection-grid').getByTestId('betrayal-character-card-father-warren-leung');
    await characterCard.click();
    if (!isRoomRevealSequenceCase) await capture('角色选择起点', '玩家从本地真实入口选中神父并查看当前角色属性。');
    await expect(characterCard).toHaveAttribute('aria-label', /P1已选择/);
    if (isCharacterTurnPromptCase) {
      diagnostics.characterTraitReadability = await readCharacterTraitReadability();
      const trait = diagnostics.characterTraitReadability;
      expect(trait.traitFound).toBe(true);
      expect(trait.footerFound).toBe(true);
      expect(trait.defaultTextVisible).toBe(true);
      expect(trait.scrolledToEnd).toBe(true);
      expect(trait.endTextVisible).toBe(true);
      expect(trait.footerOverlap).toBe(false);
    }
    const primaryAction = page.getByTestId('betrayal-character-confirm');
    const openingStage = page.getByTestId('betrayal-start-scenario-opening-stage');
    const openingContinue = page.getByTestId('betrayal-start-scenario-opening-continue');
    const board = page.getByTestId('betrayal-board');
    await primaryAction.click();
    if (isRoomRevealSequenceCase) {
      const scenarioButton = page.getByTestId('betrayal-character-scenario-button');
      await expect(scenarioButton).toContainText('\u6728\u4e43\u4f0a\u6a2a\u884c');
      await expect(primaryAction).toContainText('\u786e\u8ba4\u6b64\u5267\u672c\u5361');
      await scenarioButton.click();
      const scenarioDialog = page.getByTestId('betrayal-scenario-select-dialog');
      await expect(scenarioDialog).toBeVisible();
      const selectedScenario = scenarioDialog.getByTestId('betrayal-scenario-option-mummy-rampage');
      await expect(selectedScenario).toHaveAttribute('aria-pressed', 'true');
      await selectedScenario.click();
      await expect(selectedScenario).toHaveAttribute('aria-pressed', 'true');
      const detailToggle = page.getByTestId('betrayal-scenario-detail-toggle');
      await expect(detailToggle).toBeEnabled();
      await detailToggle.click();
      const scenarioReader = page.getByTestId('betrayal-scenario-reader-dialog');
      await expect(scenarioReader).toBeVisible();
      await page.getByTestId('betrayal-scenario-reader-close').click();
      await expect(scenarioReader).toHaveCount(0);
      const scenarioConfirmationCount = page.getByTestId('betrayal-scenario-confirmation-count');
      const scenarioConfirmationsBefore = await scenarioConfirmationCount.innerText().catch(() => null);
      await page.getByTestId('betrayal-scenario-select-current').click();
      await expect(scenarioDialog).toHaveCount(0);
      const readNextScenarioState = async () => {
        if (await openingStage.isVisible().catch(() => false)) return 'opening';
        if (await board.isVisible().catch(() => false)) return 'board';
        const countVisible = await scenarioConfirmationCount.isVisible().catch(() => false);
        const confirmations = countVisible ? (await scenarioConfirmationCount.innerText()).replace(/\s+/g, ' ').trim() : '';
        if (/3\s*\/\s*3/u.test(confirmations)) return 'ready-to-start';
        return null;
      };
      await expect.poll(readNextScenarioState, { timeout: 30_000 }).not.toBeNull();
      const nextScenarioStateValue = await readNextScenarioState();
      if (nextScenarioStateValue === 'ready-to-start') {
        await expect(primaryAction).toContainText('\u5f00\u59cb\u5267\u672c');
        await expect(primaryAction).toBeEnabled();
        await primaryAction.click();
      }
      diagnostics.selectedScenario = { id: 'mummy-rampage', confirmationsBefore: scenarioConfirmationsBefore?.replace(/\s+/g, ' ').trim() ?? null, transition: nextScenarioStateValue, readerOpenedAndClosed: true };
    }
    let openingContinueShown = false;
    if (isRoomRevealSequenceCase) {
      await expect.poll(async () =>
        await openingContinue.isVisible().catch(() => false) ||
        await board.isVisible().catch(() => false),
      { timeout: 45_000 }).toBe(true);
      openingContinueShown = await openingContinue.isVisible().catch(() => false);
      if (openingContinueShown) {
        await expect(openingContinue).toBeEnabled();
        await openingContinue.click({ force: true });
        await expect(openingStage).toHaveCount(0, { timeout: 45_000 });
      }
      diagnostics.openingTransition = { status: 'READY', openingContinueShown };
    } else {
      await expect(openingStage).toBeVisible();
      await expect(page.getByTestId('betrayal-start-scenario-opening-cinematic')).toContainText('英雄降临');
      if (!isRoomRevealSequenceCase) await capture('英雄开场片头', 'The selected scenario opening is available.');
      await openingContinue.click();
      await expect(openingStage).toHaveCount(0);
    }
    await expect(board).toBeVisible({ timeout: 45_000 });
    const turnIntroSkip = page.getByTestId('betrayal-turn-intro-skip');
    if (isRoomRevealSequenceCase) {
      const actionRail = page.getByTestId('betrayal-action-rail');
      await expect.poll(async () =>
        await turnIntroSkip.isVisible().catch(() => false) ||
        await actionRail.isVisible().catch(() => false),
      { timeout: 45_000 }).toBe(true);
      const introDisplayed = await turnIntroSkip.isVisible().catch(() => false);
      diagnostics.initialTurnPresentation = { status: 'READY', introDisplayed, boardActionable: !introDisplayed };
      if (introDisplayed) {
        await expect(turnIntroSkip).toBeEnabled();
        await expect(turnIntroSkip).toHaveAttribute('data-presentation-stage', 'play');
        await turnIntroSkip.click({ force: true });
        await expect(turnIntroSkip).toHaveCount(0);
      } else {
        await expect(actionRail).toBeVisible();
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
      }
    } else {
      await expect(turnIntroSkip).toBeVisible({ timeout: 45_000 });
      if (!isRoomRevealSequenceCase) await capture('turn-intro', 'The initial turn presentation appears after the opening.');
      if (isCharacterTurnPromptCase) {
        diagnostics.characterTurnPrompt = { status: 'IN_PROGRESS', humanInitial: await readTurnPromptSample(), aiFirst: null, humanReturned: null, aiAcknowledgementActions: [], aiStall: null };
        expect(diagnostics.characterTurnPrompt.humanInitial.turnIntroSkipVisible).toBe(true);
        expect(diagnostics.characterTurnPrompt.humanInitial.yourTurnVisible).toBe(true);
        expect(diagnostics.characterTurnPrompt.humanInitial.statusText).toMatch(/\u795e\u7236\s*\u6881\u6c83\u4f26/u);
      }
      await expect(turnIntroSkip).toBeEnabled();
      await expect(turnIntroSkip).toHaveAttribute('data-presentation-stage', 'play');
      await turnIntroSkip.click({ force: true });
      await expect(turnIntroSkip).toHaveCount(0);
    }
    await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
    if (!isRoomRevealSequenceCase) await capture('board-ready', 'The board, pawn and shared action rail are available.');
    const statusesBeforeMove = await page.evaluate(() => [...document.querySelectorAll('[data-map-resource-status]')].map((element) => element.getAttribute('data-map-resource-status')));
    let readyGate = statusesBeforeMove.includes('ready') ? 'already-ready' : 'waiting';
    if (readyGate === 'waiting') { try { await page.waitForFunction(() => [...document.querySelectorAll('[data-map-resource-status]')].some((element) => element.getAttribute('data-map-resource-status') === 'ready'), null, { timeout: 45_000 }); readyGate = 'ready-observed'; } catch { readyGate = 'ready-timeout'; } }
    const statusesAtReady = await page.evaluate(() => [...document.querySelectorAll('[data-map-resource-status]')].map((element) => element.getAttribute('data-map-resource-status')));
    const readyObservedAt = new Date().toISOString();
    const pawnAtReady = await page.getByTestId('betrayal-room-occupant-entrance-hall-0').isVisible().catch(() => false);
    const mapSnapshotAtReady = await readMapResourceSnapshot();
    diagnostics.initialMapResourceGate = { statusesBeforeMove, statusesAtReady, result: readyGate, readyObservedAt, mapSnapshotAtReady, pawnAtReady, movedByRunnerBeforeReady: false };
    if (isRoomRevealSequenceCase || isLocalUiCloseoutCase) expect(statusesAtReady).toContain('ready');
    await capture('ready瞬间未移动整屏地图', 'data-map-resource-status 首次为 ready 时的整屏地图；脚本尚未移动棋子。');
    const quietSampleMs = isRoomRevealSequenceCase ? 0 : 350;
    if (quietSampleMs > 0) await page.waitForTimeout(quietSampleMs);
    const statusesAfterQuiet = quietSampleMs > 0
      ? await page.evaluate(() => [...document.querySelectorAll('[data-map-resource-status]')].map((element) => element.getAttribute('data-map-resource-status')))
      : statusesAtReady;
    const pawnAfterQuiet = quietSampleMs > 0
      ? await page.getByTestId('betrayal-room-occupant-entrance-hall-0').isVisible().catch(() => false)
      : pawnAtReady;
    const mapSnapshotAfterQuiet = quietSampleMs > 0 ? await readMapResourceSnapshot() : null;
    diagnostics.initialMapResourceGate.afterQuietMs = quietSampleMs;
    diagnostics.initialMapResourceGate.sampledAgainAt = quietSampleMs > 0 ? new Date().toISOString() : null;
    diagnostics.initialMapResourceGate.statusesAfterQuiet = statusesAfterQuiet;
    diagnostics.initialMapResourceGate.mapSnapshotAfterQuiet = mapSnapshotAfterQuiet;
    diagnostics.initialMapResourceGate.pawnAfterQuiet = pawnAfterQuiet;
    if (isRoomRevealSequenceCase || isLocalUiCloseoutCase) {
      expect(statusesAfterQuiet).toContain('ready');
      expect(pawnAtReady && pawnAfterQuiet).toBe(true);
    }
    pageMetrics = await readVisibleBoardMetrics();
    await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
    const requiredButtons = ['betrayal-action-endTurn'];
    for (const id of requiredButtons) await expect(page.getByTestId(id)).toBeVisible();
    return `当前行动者：神父 梁沃伦；棋盘 ${pageMetrics.canvas?.width}×${pageMetrics.canvas?.height}；底栏按钮 ${requiredButtons.join(', ')}`;
  });

  if (isCharacterTurnPromptCase) {
    await runStep('Human to AI to human turn-prompt check', async () => {
      const state = diagnostics.characterTurnPrompt;
      const statusChip = page.getByTestId('betrayal-status-chip');
      const endTurn = page.getByTestId('betrayal-action-endTurn');
      const turnIntroSkip = page.getByTestId('betrayal-turn-intro-skip');
      const playerName = String.fromCharCode(0x795e,0x7236,0x20,0x6881,0x6c83,0x4f26);
      await expect(statusChip).toContainText(/\u795e\u7236\s*\u6881\u6c83\u4f26/u);
      await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
      await expect(endTurn).toBeEnabled();
      state.humanBeforeEndTurn = await readTurnPromptSample();
      await endTurn.click();
      await expect(statusChip).toContainText(/AI\s*\d+\s*\u53f7\u4f4d/u, { timeout: 30_000 });
      state.aiFirst = await readTurnPromptSample();
      state.aiSeat = state.aiFirst.statusText.match(/AI\s*\d+\s*\u53f7\u4f4d/u)?.[0] ?? null;
      expect(state.aiSeat).not.toBeNull();
      expect(state.aiFirst.turnIntroSkipVisible).toBe(false);
      expect(state.aiFirst.yourTurnVisible).toBe(false);

      let returnedToHuman = false;
      let stopReason = null;
      const deadline = Date.now() + 120_000;
      const clickedActions = new Set();
      let disabledFingerprint = null;
      let disabledSince = 0;
      state.aiAcknowledgementActions = [];
      while (Date.now() < deadline) {
        const turnSample = await readTurnPromptSample();
        if (turnSample.statusText.includes(playerName)) {
          returnedToHuman = true;
          break;
        }

        const uiSample = await readAiConfirmationUiSample();
        const visibleButtons = uiSample.visibleConfirmationButtons;
        const enabledAction = visibleButtons.find((button) => {
          if (button.disabled) return false;
          const text = button.text ?? '';
          if (/已确认|confirmed/iu.test(text)) return false;
          if (button.testId === 'betrayal-roll-continue') return true;
          return /确认|confirm|继续|continue|返回牌桌|back to board/iu.test(text);
        });

        if (enabledAction) {
          const fingerprint = [
            enabledAction.testId,
            enabledAction.pendingCardResolutionId,
            enabledAction.pendingCardResolutionStep,
            enabledAction.cardResolutionConfirmedCount,
            enabledAction.eventRollConfirmedCount,
            enabledAction.text,
            uiSample.discoveryPanelText,
          ].join('|');
          if (!clickedActions.has(fingerprint)) {
            const persistedStateBefore = await readMatchingPersistedLocalGameState(uiSample);
            const persistedResolution = enabledAction.pendingCardResolutionId
              ? persistedStateBefore.pendingCardResolutions.find((item) => item.id === enabledAction.pendingCardResolutionId) ?? null
              : persistedStateBefore.pendingEventRollResolution;
            const humanSeatIds = Object.entries(persistedStateBefore.seatControllers ?? {})
              .filter(([, controller]) => controller.type === 'human')
              .map(([playerId]) => playerId);
            const missingHumanAcknowledgementIds = (persistedResolution?.missingPlayerIds ?? [])
              .filter((playerId) => humanSeatIds.includes(String(playerId)));
            const actionRecord = {
              kind: 'visible-enabled-player-control',
              sampledAt: uiSample.sampledAt,
              button: enabledAction,
              stateBefore: persistedStateBefore,
              persistedResolution,
              humanSeatIds,
              missingHumanAcknowledgementIds,
              status: 'click-not-attempted-yet',
            };
            state.aiAcknowledgementActions.push(actionRecord);
            expect(persistedStateBefore.snapshotFound).toBe(true);
            expect(persistedStateBefore.seedMatchesCurrentUrl).toBe(true);
            expect(persistedStateBefore.matchesVisibleResolution).toBe(true);
            expect(persistedResolution).not.toBeNull();
            expect(persistedResolution.requiredPlayerIdsSource).toBe('persisted requiredPlayerIds');
            if (missingHumanAcknowledgementIds.length === 0) {
              actionRecord.status = 'skipped-no-unconfirmed-human-seat';
              actionRecord.statusDetail = 'The visible control is for a resolution whose persisted missingPlayerIds contain no human seat; left it untouched for local AI progression.';
              clickedActions.add(fingerprint);
              await page.waitForTimeout(100);
              continue;
            }
            const actionLocator = page.getByTestId(enabledAction.testId);
            const stillVisible = await actionLocator.isVisible().catch(() => false);
            const stillEnabled = stillVisible && await actionLocator.isEnabled().catch(() => false);
            if (!stillEnabled) {
              actionRecord.status = 'control-changed-before-click';
              actionRecord.afterUi = await readAiConfirmationUiSample();
              actionRecord.stateAfter = await readPersistedLocalGameState();
              clickedActions.add(fingerprint);
              await page.waitForTimeout(100);
              continue;
            }
            await capture('ai-ack-enabled', `Visible enabled player confirmation: ${enabledAction.text}; actor=${uiSample.currentActorText}`);
            try {
              actionRecord.clickAttemptedAt = new Date().toISOString();
              await actionLocator.click({ timeout: 1_500 });
              actionRecord.status = 'clicked-by-real-visible-ui';
              actionRecord.clickedAt = new Date().toISOString();
              clickedActions.add(fingerprint);
              disabledFingerprint = null;
              disabledSince = 0;
              await page.waitForTimeout(100);
              actionRecord.afterUi = await readAiConfirmationUiSample();
              actionRecord.stateAfter = await readPersistedLocalGameState();
            } catch (error) {
              actionRecord.status = 'control-disappeared-before-click';
              actionRecord.clickError = error instanceof Error ? error.message : String(error);
              actionRecord.afterUi = await readAiConfirmationUiSample();
              actionRecord.stateAfter = await readPersistedLocalGameState();
              clickedActions.add(fingerprint);
            }
            continue;
          }
        }

        const disabledAction = visibleButtons.find((button) => button.disabled);
        if (disabledAction) {
          const fingerprint = [
            disabledAction.testId,
            disabledAction.pendingCardResolutionId,
            disabledAction.pendingCardResolutionStep,
            disabledAction.cardResolutionConfirmedCount,
            disabledAction.eventRollConfirmedCount,
            disabledAction.text,
            uiSample.discoveryPanelText,
          ].join('|');
          if (fingerprint !== disabledFingerprint) {
            disabledFingerprint = fingerprint;
            disabledSince = Date.now();
          } else if (Date.now() - disabledSince >= 650) {
            const persistedState = await readMatchingPersistedLocalGameState(uiSample);
            state.aiStall = {
              observedAt: new Date().toISOString(),
              status: 'visible-confirmation-disabled',
              ui: uiSample,
              disabledButton: disabledAction,
              localMatchSnapshot: persistedState,
            };
            await capture('ai-ack-disabled', `Disabled player confirmation: ${disabledAction.text}; actor=${uiSample.currentActorText}; local snapshot match=${persistedState.matchesVisibleResolution}`);
            stopReason = 'A visible confirmation control remained disabled during the AI turn; the read-only local match snapshot was captured.';
            break;
          }
        } else {
          disabledFingerprint = null;
          disabledSince = 0;
        }

        await page.waitForTimeout(200);
      }

      if (!returnedToHuman) {
        state.status = 'FAIL';
        state.finishedAt = new Date().toISOString();
        if (!state.aiStall) {
          const ui = await readAiConfirmationUiSample();
          state.aiStall = {
            observedAt: new Date().toISOString(),
            status: stopReason ?? 'no-human-turn-within-timeout',
            ui,
            localMatchSnapshot: await readMatchingPersistedLocalGameState(ui),
          };
        }
        const reason = stopReason ?? `AI ${state.aiSeat} did not return to ${playerName} within 120s after ${state.aiAcknowledgementActions.length} real visible confirmation clicks; final state: ${JSON.stringify(state.aiStall)}`;
        state.failure = reason;
        throw new Error(reason);
      }

      await expect(turnIntroSkip).toBeVisible({ timeout: 30_000 });
      state.humanReturned = await readTurnPromptSample();
      state.persistedAfterHumanReturn = await readPersistedLocalGameState();
      expect(state.persistedAfterHumanReturn.snapshotFound).toBe(true);
      expect(state.persistedAfterHumanReturn.seedMatchesCurrentUrl).toBe(true);
      expect(state.persistedAfterHumanReturn.currentPlayerId).not.toBeNull();
      expect(state.persistedAfterHumanReturn.seatControllers[state.persistedAfterHumanReturn.currentPlayerId]?.type).toBe('human');
      expect(state.aiAcknowledgementActions.some((item) => item.status === 'clicked-by-real-visible-ui' && item.missingHumanAcknowledgementIds.length > 0)).toBe(true);
      expect(state.humanReturned.statusText).toMatch(/\u795e\u7236\s*\u6881\u6c83\u4f26/u);
      expect(state.humanReturned.turnIntroSkipVisible).toBe(true);
      expect(state.humanReturned.yourTurnVisible).toBe(true);
      await turnIntroSkip.click();
      await expect(turnIntroSkip).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
      await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
      state.status = 'PASS';
      state.finishedAt = new Date().toISOString();
      return 'Human turn returned after ' + state.aiAcknowledgementActions.length + ' real visible confirmation clicks; human prompt and turn intro are visible again.';
    });
  } else {
  if (!isRoomRevealSequenceCase) await runStep('棋子来源状态与重复点击采样', async () => {
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
    if (isLocalUiCloseoutCase) {
      const first = samples.afterFirstClick;
      const repeated = samples.afterRepeatClick;
      const ariaPressedRestored = Boolean(before.ariaPressed === 'false' && first?.ariaPressed === 'true' && repeated?.ariaPressed === 'false' && repeated?.ariaPressed === before.ariaPressed);
      const cueRestored = Boolean(before.actionCueVisible && before.actionCueText && repeated?.actionCueVisible && repeated?.actionCueText === before.actionCueText);
      const cancellationPassed = status === 'PASS' && ariaPressedRestored && cueRestored;
      diagnostics.movementCancellation = {
        status: cancellationPassed ? 'PASS' : 'FAIL',
        reason: 'Cancel selection is verified only by aria-pressed returning true-to-false and the visible action cue text returning to its exact baseline; reach visibility is intentionally not used.',
        ariaPressedRestored,
        cueRestored,
        baselineCue: before.actionCueText,
        finalCue: repeated?.actionCueText ?? null,
        before,
        afterFirstClick: first ?? null,
        afterRepeatClick: repeated ?? null,
        at: new Date().toISOString(),
      };
      diagnostics.localUiCloseout = { status: cancellationPassed ? 'IN_PROGRESS' : 'FAIL', stage: 'pawn-cancel', movementCancellation: diagnostics.movementCancellation };
      await capture('取消后提示恢复', '重复点击棋子后 aria-pressed 回到 false，底部提示恢复为移动前原文；reach 仍可见不作为失败。');
      if (!cancellationPassed) throw new Error('Pawn cancellation did not restore aria-pressed=false and the original visible action cue.');
    }
    if (status === 'FAIL') steps[steps.length - 1] = { ...steps[steps.length - 1], status: 'FAIL', detail: reason };

    if (isPawnSelectionToggleCase) return `case=${status}; classification=${classification}; ${reason}`;
    return `classification=${classification}; aria-pressed toggle=${status}; direct reach sampled independently from cancellation`;
  });

  if (!isNarrowCase) await runStep('逐格hop和门位状态', async () => {
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

  if (isLocalUiCloseoutCase) await runStep('实际移动 hop 并返回入口', async () => {
    const statusChip = page.getByTestId('betrayal-status-chip');
    const hallway = page.getByTestId('betrayal-room-hallway');
    await expect(hallway).toBeVisible();
    await hallway.click();
    await expect(page.getByTestId('betrayal-room-occupant-hallway-0')).toBeVisible({ timeout: 15_000 });
    await expect(statusChip).toContainText(/剩余移动\s*3/u, { timeout: 15_000 });
    await capture('移动到门厅', '直接点击门厅执行一格 hop，检查人物落位及剩余移动数。');
    await page.getByTestId('betrayal-room-entrance-hall').click();
    await expect(page.getByTestId('betrayal-room-occupant-entrance-hall-0')).toBeVisible({ timeout: 15_000 });
    await expect(statusChip).toContainText(/剩余移动\s*2/u, { timeout: 15_000 });
    await capture('移动返回入口', '第二格 hop 返回入口大厅，检查棋子落位与 HUD 更新。');
    return 'Executed two direct room hops, hallway then entrance, with movement count decreasing 4 to 3 to 2.';
  });
  if (!isNarrowCase) await runStep('门位探索中断、房间安置与发现收口', async () => {
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

  if (isRoomRevealSequenceCase || isLocalUiCloseoutCase) await runStep('Room placement, card choice, and confirmation', async () => {
    const revealDiagnostic = { status: 'IN_PROGRESS', phase: 'initialized', phaseHistory: [] };
    diagnostics.roomRevealSequence = revealDiagnostic;
    const setRevealPhase = (phase, detail = {}) => {
      const entry = { phase, at: new Date().toISOString(), ...detail };
      revealDiagnostic.phase = phase;
      revealDiagnostic.phaseHistory.push(entry);
      if (revealDiagnostic.phaseHistory.length > 24) revealDiagnostic.phaseHistory.shift();
      diagnostics.roomRevealSequence = { ...diagnostics.roomRevealSequence, ...revealDiagnostic };
    };
    setRevealPhase('checking-target-room');
    const movementSnapshot = page.getByTestId('betrayal-movement-snapshot');
    const movementRemainingBeforePlacement = Number(await movementSnapshot.getAttribute('data-moves-remaining'));
    expect(Number.isInteger(movementRemainingBeforePlacement) && movementRemainingBeforePlacement > 0).toBe(true);
    revealDiagnostic.movementRemainingBeforePlacement = movementRemainingBeforePlacement;
    const currentTraits = page.getByTestId('betrayal-current-traits');
    const explorerIdAtStart = await currentTraits.getAttribute('data-explorer-id');
    const playerIdAtStart = await currentTraits.getAttribute('data-player-id');
    const roomIdAtStart = await currentTraits.getAttribute('data-room-id');
    expect(explorerIdAtStart).toBeTruthy();
    expect(playerIdAtStart).toBeTruthy();
    expect(roomIdAtStart).toBeTruthy();
    revealDiagnostic.explorerIdAtStart = explorerIdAtStart;
    revealDiagnostic.playerIdAtStart = playerIdAtStart;
    revealDiagnostic.roomIdAtStart = roomIdAtStart;
    const targetRoom = page.getByTestId('betrayal-room-ground-east');
    await expect(targetRoom).toContainText('可探索');
    setRevealPhase('opening-placement-panel');
    await targetRoom.click();
    const placement = page.getByTestId('betrayal-room-placement-panel');
    await expect(placement).toBeVisible();
    const placementSlot = await placement.getAttribute('data-room-placement-slot');
    const connectingEdge = await placement.getAttribute('data-room-entry-edge');
    const connectingDoorCount = await placement.locator('[data-connecting-door="true"]').count();
    expect(placementSlot).toBeTruthy();
    expect(['north', 'east', 'south', 'west']).toContain(connectingEdge);
    expect(connectingDoorCount).toBe(1);
    revealDiagnostic.placementSlot = placementSlot;
    revealDiagnostic.connectingEdge = connectingEdge;
    const initialOrientation = await placement.getAttribute('data-room-orientation-turns');
    const rotateRight = page.getByTestId('betrayal-room-placement-rotate-right');
    setRevealPhase('checking-rotation-control');
    const rotationAvailable = await rotateRight.isEnabled();
    expect(rotationAvailable).toBe(true);
    setRevealPhase('applying-room-rotation', { rotationAvailable });
    await rotateRight.click();
    await expect.poll(async () => placement.getAttribute('data-room-orientation-turns')).not.toBe(initialOrientation);
    const selectedOrientation = await placement.getAttribute('data-room-orientation-turns');
    if (!isRoomRevealSequenceCase) await capture(
      rotationAvailable ? 'Room rotation used' : 'Room rotation disabled',
      'Room orientation turns: ' + selectedOrientation,
    );
    const discovery = page.getByTestId('betrayal-discovery-panel');
    await expect(discovery).toHaveCount(0);
    setRevealPhase('confirming-room-placement');
    const confirm = page.getByTestId('betrayal-room-placement-confirm');
    await expect(confirm).toBeEnabled();
    const roomConfirmAt = new Date().toISOString();
    setRevealPhase('room-placement-confirmed');
    await confirm.click();
    await expect(placement).toHaveCount(0, { timeout: 20_000 });

    const eventChoicePanel = page.getByTestId('betrayal-event-choice-panel');
    setRevealPhase('waiting-for-card-resolution');
    await expect.poll(async () =>
      await discovery.isVisible().catch(() => false) ||
      await eventChoicePanel.isVisible().catch(() => false),
    { timeout: 30_000 }).toBe(true);
    const playwrightWaitResolvedAt = new Date().toISOString();
    setRevealPhase('classifying-card-resolution');
    const resolutionKind = await discovery.isVisible().catch(() => false)
      ? 'discovery'
      : await eventChoicePanel.isVisible().catch(() => false) ? 'event-choice' : 'none';
    expect(resolutionKind).not.toBe('none');
    const itemCardLocator = page.locator('[data-testid="betrayal-inventory-row-item"] button[data-testid^="betrayal-inventory-"]');
    const itemCardCountBeforeResolution = await itemCardLocator.count();
    if (resolutionKind === 'discovery') {
      await expect(page.getByTestId('betrayal-discovery-panel-content')).toBeVisible();
      await expect(page.getByTestId('betrayal-discovery-continue')).toBeEnabled();
    } else {
      await expect(eventChoicePanel).toHaveAttribute('aria-label', '\u65ad\u624b');
      await expect(page.getByTestId('betrayal-event-choice-confirm')).toContainText('\u627f\u53d7\u4f24\u5bb3\u5e76\u62bd\u53d6\u7269\u54c1');
      const options = eventChoicePanel.locator('button[data-testid="betrayal-event-choice-confirm"], button[data-testid="betrayal-event-choice-decline"], button[data-testid^="betrayal-event-choice-trait-"], button[data-testid^="betrayal-event-choice-card-"], button[data-testid^="betrayal-room-"]');
      let hasLegalOption = false;
      for (let index = 0; index < await options.count(); index += 1) {
        const option = options.nth(index);
        if (await option.isVisible().catch(() => false) && await option.isEnabled().catch(() => false)) {
          hasLegalOption = true;
          break;
        }
      }
      expect(hasLegalOption).toBe(true);
    }
    const resolutionPanelAriaLabel = resolutionKind === 'discovery'
      ? await discovery.getAttribute('aria-label')
      : await eventChoicePanel.getAttribute('aria-label');
    await capture('Room reveal resolution', 'After confirming room placement, the game presents a discovery or event card with a legal action.');

    const discoveryCardSamples = [];
    diagnostics.roomRevealSequence = {
      ...revealDiagnostic,
      status: 'IN_PROGRESS',
      roomConfirmAt,
      playwrightWaitResolvedAt,
      resolutionAppearedAfterPlacementConfirmation: true,
      resolutionKind,
      resolutionPanelAriaLabel,
      actionTrace: [],
      discoveryConfirmClicks: 0,
      cardClosedAfterConfirmation: false,
    };

    const actionTrace = [];
    const visible = async (testId) => page.getByTestId(testId).isVisible().catch(() => false);
    const readResolutionState = async () => {
      const state = await page.evaluate(() => {
      const isVisible = (testId) => {
        const element = document.querySelector(`[data-testid="${testId}"]`);
        if (!element) return false;
        const style = getComputedStyle(element);
        return element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
      };
      const pendingTestIds = [
        'betrayal-event-roll-start',
        'betrayal-event-choice-panel',
        'betrayal-damage-allocation-panel',
        'betrayal-roll-result-backdrop',
        'betrayal-discovery-panel',
      ];
      const pendingKinds = pendingTestIds.filter(isVisible);
      const traits = document.querySelector('[data-testid="betrayal-current-traits"]');
      const movement = document.querySelector('[data-testid="betrayal-movement-snapshot"]');
      const target = document.querySelector('[data-testid="betrayal-room-ground-east"]');
      const endTurn = document.querySelector('[data-testid="betrayal-action-endTurn"]');
      const roomId = traits?.getAttribute('data-room-id') ?? null;
      const explorerId = traits?.getAttribute('data-explorer-id') ?? null;
      const movesRemaining = Number(movement?.getAttribute('data-moves-remaining'));
      const roomExplored = Boolean(target) && !target.innerText.includes('\u672a\u63a2\u7d22');
      const boardActionable = isVisible('betrayal-room-grid') && isVisible('betrayal-action-rail') && Boolean(endTurn && !endTurn.disabled);
      const roomResolved = roomId === 'ground-east' && Boolean(explorerId) && isVisible('betrayal-room-occupant-ground-east-0') && roomExplored && movesRemaining === 0;
      return { pendingKinds, roomId, explorerId, movesRemaining, roomExplored, boardActionable, roomResolved };
      });
      const persisted = await readPersistedLocalGameState().catch((error) => ({
        snapshotFound: false,
        snapshotError: error instanceof Error ? error.message : String(error),
        pendingCardResolutionQueueLength: null,
        pendingEventRollResolution: null,
      }));
      const persistedPendingKinds = [];
      if (Number(persisted.pendingCardResolutionQueueLength) > 0) persistedPendingKinds.push('persisted-card-resolution');
      if (persisted.pendingEventRollResolution) persistedPendingKinds.push('persisted-event-roll-resolution');
      const pendingKinds = [...new Set([...state.pendingKinds, ...persistedPendingKinds])];
      const persistedSettled = persisted.snapshotFound === true
        && persisted.seedMatchesCurrentUrl === true
        && Number(persisted.pendingCardResolutionQueueLength) === 0
        && !persisted.pendingEventRollResolution;
      return { ...state, pendingKinds, persisted, settledBoard: pendingKinds.length === 0 && persistedSettled && state.roomResolved && state.boardActionable };
    };
    let terminalResolutionState = null;
    while (actionTrace.length < 12) {
      const resolutionState = await waitForPendingDecisionOrSettledBoard(readResolutionState, { timeoutMs: 30_000, intervalMs: 200 });
      if (resolutionState.kind === 'settled') {
        terminalResolutionState = resolutionState;
        break;
      }
      if (await visible('betrayal-event-roll-start')) {
        const rollStart = page.getByTestId('betrayal-event-roll-start');
        await expect(rollStart).toBeEnabled();
        const label = (await rollStart.innerText()).trim();
        await capture('揭示后事件行动按钮', `发现事件卡提供“${label}”按钮；脚本以真实点击开始后续解析。`);
        await rollStart.click();
        actionTrace.push({ kind: 'event-roll-start', label, at: new Date().toISOString() });
        await expect(rollStart).toHaveCount(0, { timeout: 20_000 });
        await expect.poll(async () => {
          for (const testId of ['betrayal-roll-result-backdrop', 'betrayal-damage-allocation-panel', 'betrayal-event-choice-panel', 'betrayal-discovery-panel']) {
            if (await visible(testId)) return true;
          }
          return false;
        }, { timeout: 30_000 }).toBe(true);
        continue;
      }

        setRevealPhase('handling-event-choice');
      if (await visible('betrayal-event-choice-panel')) {
        const choicePanel = page.getByTestId('betrayal-event-choice-panel');
        const confirmChoice = page.getByTestId('betrayal-event-choice-confirm');
        if (!(await confirmChoice.isEnabled().catch(() => false))) {
          const options = choicePanel.locator('button[data-testid^="betrayal-event-choice-trait-"], button[data-testid^="betrayal-event-choice-card-"], button[data-testid^="betrayal-room-"]');
          const optionCount = await options.count();
          let selected = false;
          for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
            const option = options.nth(optionIndex);
            if (await option.isVisible().catch(() => false) && await option.isEnabled().catch(() => false)) {
              const optionTestId = await option.getAttribute('data-testid');
              await option.click();
              actionTrace.push({ kind: 'event-choice-option', testId: optionTestId, at: new Date().toISOString() });
              selected = true;
              break;
            }
          }
          expect(selected).toBe(true);
        }
        await expect(confirmChoice).toBeEnabled({ timeout: 10_000 });
        const label = (await confirmChoice.innerText()).trim();
        if (resolutionPanelAriaLabel === '\u65ad\u624b') {
          expect(label).toContain('\u627f\u53d7\u4f24\u5bb3\u5e76\u62bd\u53d6\u7269\u54c1');
        }
        await capture('事件选项确认前', `事件选项面板提供“${label}”确认；等待玩家选择后以真实按钮确认。`);
        setRevealPhase('confirming-event-choice');
        await confirmChoice.click();
        actionTrace.push({ kind: 'event-choice-confirm', label, at: new Date().toISOString() });
        setRevealPhase('waiting-for-event-card-close');
        await expect(choicePanel).toHaveCount(0, { timeout: 20_000 });
        if (resolutionPanelAriaLabel === '\u65ad\u624b') {
          await expect(discovery).toBeVisible({ timeout: 20_000 });
          await expect(discovery).toContainText('\u53d7\u5230 2 \u70b9\u7269\u7406\u4f24\u5bb3');
          await expect(discovery).toContainText('\u62bd\u53d6\u4e00\u5f20\u7269\u54c1\u5361');
          await expect.poll(() => itemCardLocator.count(), { timeout: 20_000 }).toBeGreaterThan(itemCardCountBeforeResolution);
          revealDiagnostic.eventEffect = {
            event: resolutionPanelAriaLabel,
            selectedOutcome: label,
            outcomeDetail: await discovery.innerText(),
            itemCardCountBefore: itemCardCountBeforeResolution,
            itemCardCountAfter: await itemCardLocator.count(),
          };
        }
        continue;
      }

      if (await visible('betrayal-damage-allocation-panel')) {
        const damagePanel = page.getByTestId('betrayal-damage-allocation-panel');
        const confirmDamage = page.getByTestId('betrayal-damage-allocation-confirm');
        for (let allocationIndex = 0; allocationIndex < 8 && !(await confirmDamage.isEnabled().catch(() => false)); allocationIndex += 1) {
          const increments = damagePanel.locator('button[data-testid^="betrayal-damage-allocation-trait-"][data-testid$="-increase"]');
          const incrementCount = await increments.count();
          let selected = false;
          for (let optionIndex = 0; optionIndex < incrementCount; optionIndex += 1) {
            const option = increments.nth(optionIndex);
            if (await option.isVisible().catch(() => false) && await option.isEnabled().catch(() => false)) {
              const optionTestId = await option.getAttribute('data-testid');
              await option.click();
              actionTrace.push({ kind: 'damage-allocation-trait', testId: optionTestId, at: new Date().toISOString() });
              selected = true;
              break;
            }
          }
          expect(selected).toBe(true);
        }
        await expect(confirmDamage).toBeEnabled({ timeout: 10_000 });
        const label = (await confirmDamage.innerText()).trim();
        await capture('伤害分配确认前', `事件结果要求分配伤害；已用可见属性选择控件完成分配，确认按钮“${label}”可用。`);
        await confirmDamage.click();
        actionTrace.push({ kind: 'damage-allocation-confirm', label, at: new Date().toISOString() });
        await expect(damagePanel).toHaveCount(0, { timeout: 20_000 });
        continue;
      }

      if (await visible('betrayal-roll-result-backdrop')) {
        const rollOutcome = page.getByTestId('betrayal-recent-roll-outcome');
        await expect(rollOutcome).toBeVisible();
        const outcomeText = (await rollOutcome.innerText()).trim();
        expect(outcomeText.length).toBeGreaterThan(0);
        const rollContinue = page.getByTestId('betrayal-roll-continue');
        await expect(rollContinue).toBeEnabled({ timeout: 20_000 });
        const label = (await rollContinue.innerText()).trim();
        await capture('事件骰结果确认前', `事件骰结果显示完成；可见按钮“${label}”用于返回发现流程。`);
        await rollContinue.click();
        actionTrace.push({ kind: 'roll-result-confirm', label, outcomeText, at: new Date().toISOString() });
        await expect(page.getByTestId('betrayal-roll-result-backdrop')).toHaveCount(0, { timeout: 20_000 });
        continue;
      }

      if (await visible('betrayal-discovery-panel')) {
        const continueButton = page.getByTestId('betrayal-discovery-continue');
        await expect(continueButton).toBeVisible();
        await expect(continueButton).toBeEnabled({ timeout: 30_000 });
        const label = (await continueButton.innerText()).trim();
        const previousCardText = (await discovery.innerText()).trim();
        await capture('发现流程确认前', `揭示后的发现步骤提供“${label}”按钮；脚本以真实点击继续。`);
        await continueButton.click();
        actionTrace.push({ kind: 'discovery-confirm', label, at: new Date().toISOString() });
        await expect.poll(async () => {
          if (!(await discovery.isVisible().catch(() => false))) return true;
          if (await visible('betrayal-event-choice-panel') || await visible('betrayal-damage-allocation-panel') || await visible('betrayal-roll-result-backdrop') || await visible('betrayal-event-roll-start')) return true;
          return (await discovery.innerText().catch(() => '')).trim() !== previousCardText;
        }, { timeout: 20_000 }).toBe(true);
        continue;
      }

      setRevealPhase('waiting-for-pending-decision-ui', { pendingKinds: resolutionState.state.pendingKinds });
      await waitForPendingDecisionPresentation(
        readResolutionState,
        async () => {
          for (const testId of ['betrayal-event-roll-start', 'betrayal-event-choice-panel', 'betrayal-damage-allocation-panel', 'betrayal-roll-result-backdrop', 'betrayal-discovery-panel']) {
            if (await visible(testId)) return true;
          }
          return false;
        },
        { timeoutMs: 15_000, intervalMs: 250 },
      );
      continue;
    }
    terminalResolutionState ??= await waitForPendingDecisionOrSettledBoard(readResolutionState, { timeoutMs: 10_000, intervalMs: 200 });
    const settledBusinessState = requireSettledBoard(terminalResolutionState);
    await expect(discovery).toHaveCount(0, { timeout: 20_000 });
    await expect(eventChoicePanel).toHaveCount(0, { timeout: 20_000 });
    const eventChoiceConfirmClicks = actionTrace.filter((action) => action.kind === 'event-choice-confirm').length;
    if (resolutionKind === 'event-choice') expect(eventChoiceConfirmClicks).toBe(1);
    await expect(targetRoom).not.toContainText('未探索');
    setRevealPhase('verifying-board-usable');
    await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
    await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
    await expect(page.getByTestId('betrayal-room-occupant-ground-east-0')).toBeVisible({ timeout: 15_000 });
    const movementRemainingAfterResolution = Number(await movementSnapshot.getAttribute('data-moves-remaining'));
    expect(movementRemainingAfterResolution).toBe(0);
    expect(await currentTraits.getAttribute('data-room-id')).toBe('ground-east');
    expect(await currentTraits.getAttribute('data-explorer-id')).toBe(explorerIdAtStart);
    expect(settledBusinessState.roomExplored).toBe(true);
    expect(settledBusinessState.boardActionable).toBe(true);
    expect(settledBusinessState.movesRemaining).toBe(0);
    revealDiagnostic.movementRemainingAfterResolution = movementRemainingAfterResolution;
    revealDiagnostic.roomIdAfterResolution = await currentTraits.getAttribute('data-room-id');
    revealDiagnostic.explorerIdAfterResolution = await currentTraits.getAttribute('data-explorer-id');
    revealDiagnostic.settledBusinessState = settledBusinessState;

    await capture('单次确认后回到稳定牌桌', '只点击一次发现卡正常确认按钮后，卡片收起，新房间与棋子留在稳定棋盘。');

    setRevealPhase('complete');
    diagnostics.roomRevealSequence = {
      ...revealDiagnostic,
      status: 'PASS',
      roomConfirmAt,
      playwrightWaitResolvedAt,
      resolutionAppearedAfterPlacementConfirmation: true,
      resolutionKind,
      resolutionPanelAriaLabel,
      actionTrace,
      discoveryCardSamples,
      discoveryConfirmClicks: actionTrace.filter(action => action.kind === 'discovery-confirm').length,
      eventChoiceConfirmClicks,
      cardClosedAfterConfirmation: true,
      boardUsableAfterResolution: true,
    };
    return 'Confirmed room placement, resolved ' + resolutionKind + ' with ' + actionTrace.length + ' visible actions, closed the card, and returned to a usable board.';
  });

  if (!isNarrowCase || isRoomRevealSequenceCase) await runStep('Next AI turn handoff', async () => {
    const rail = page.getByTestId('betrayal-action-rail');
    const endTurn = page.getByTestId('betrayal-action-endTurn');
    const statusChip = page.getByTestId('betrayal-status-chip');
    const turnIntroSkip = page.getByTestId('betrayal-turn-intro-skip');
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    const playerIdAtStart = diagnostics.roomRevealSequence?.playerIdAtStart ?? null;
    const expectedHumanTurnOwner = playerIdAtStart;
    expect(expectedHumanTurnOwner).toBeTruthy();
    const initialStatus = normalize(await statusChip.innerText());
    const initialPersisted = await readPersistedLocalGameState();
    const currentTurnOwnerBeforeHandoff = initialPersisted.currentPlayerId;
    const alreadyInNextAiTurn = /AI\s*\d+/u.test(initialStatus) && Boolean(currentTurnOwnerBeforeHandoff && currentTurnOwnerBeforeHandoff !== expectedHumanTurnOwner);
    const explorerBeforeTurnEnd = diagnostics.roomRevealSequence?.explorerIdAfterResolution ?? null;
    const handoffDiagnostic = {
      status: 'IN_PROGRESS',
      stage: 'initial-state',
      playerIdAtStart: expectedHumanTurnOwner,
      initialStatus,
      currentTurnOwnerBeforeHandoff,
      alreadyInNextAiTurn,
      explorerBeforeTurnEnd,
    };
    diagnostics.nextTurnHandoff = handoffDiagnostic;
    await persistAcceptanceCheckpoint('next-ai-handoff-initial-state');
    let endTurnClicked = false;
    if (!alreadyInNextAiTurn) {
      await expect(rail).toBeVisible();
      await expect(endTurn).toBeEnabled();
      await capture('player-turn-ready-before-handoff', 'The resolved room leaves the current human turn available before ending it.');
      await endTurn.click();
      endTurnClicked = true;
    }
    handoffDiagnostic.endTurnClicked = endTurnClicked;
    handoffDiagnostic.stage = 'waiting-for-next-ai-owner';
    diagnostics.nextTurnHandoff = handoffDiagnostic;
    await persistAcceptanceCheckpoint('next-ai-handoff-wait-started');
    try {
      await expect.poll(async () => {
        const status = normalize(await statusChip.innerText());
        const persisted = await readPersistedLocalGameState();
        return /AI\s*\d+/u.test(status) && persisted.currentPlayerId && persisted.currentPlayerId !== expectedHumanTurnOwner;
      }, { timeout: 30_000, intervals: [250, 500, 750] }).toBe(true);
    } catch (error) {
      const [statusAtTimeout, persistedAtTimeout, railVisibleAtTimeout, pendingDiscoveryAtTimeout] = await Promise.all([
        statusChip.innerText().catch(() => ''),
        readPersistedLocalGameState().catch((readError) => ({ error: String(readError) })),
        rail.isVisible().catch(() => false),
        page.getByTestId('betrayal-discovery-panel').isVisible().catch(() => false),
      ]);
      Object.assign(handoffDiagnostic, { stage: 'waiting-for-next-ai-owner-failed', status: 'FAIL', statusAtTimeout: normalize(statusAtTimeout), persistedAtTimeout, railVisibleAtTimeout, pendingDiscoveryAtTimeout, failure: error instanceof Error ? error.message : String(error) });
      diagnostics.nextTurnHandoff = handoffDiagnostic;
      await persistAcceptanceCheckpoint('next-ai-handoff-wait-failed');
      throw error;
    }

    let introDisplayed = await turnIntroSkip.isVisible().catch(() => false);
    if (introDisplayed) {
      await turnIntroSkip.click({ force: true });
      await expect(turnIntroSkip).toHaveCount(0, { timeout: 15_000 });
    }

    handoffDiagnostic.stage = 'resolving-next-ai-turn-prompts';
    handoffDiagnostic.introDisplayed = introDisplayed;
    const omenPanel = page.getByTestId('betrayal-discovery-panel');
    let omenAcknowledgements = 0;
    for (let index = 0; index < 5 && await omenPanel.isVisible().catch(() => false); index += 1) {
      const continueButton = page.getByTestId('betrayal-discovery-continue');
      await expect(continueButton).toBeEnabled();
      const previousText = normalize(await omenPanel.innerText());
      await continueButton.click();
      omenAcknowledgements += 1;
      await expect.poll(async () => {
        if (!(await omenPanel.isVisible().catch(() => false))) return true;
        return normalize(await omenPanel.innerText().catch(() => '')) !== previousText;
      }, { timeout: 20_000, intervals: [250, 500, 750] }).toBe(true);
      handoffDiagnostic.omenAcknowledgements = omenAcknowledgements;
      diagnostics.nextTurnHandoff = handoffDiagnostic;
      await persistAcceptanceCheckpoint('next-ai-handoff-omen-acknowledged');
    }

    handoffDiagnostic.stage = 'checking-stable-ai-turn-state';
    diagnostics.nextTurnHandoff = handoffDiagnostic;
    await persistAcceptanceCheckpoint('next-ai-handoff-stability-check');
    try {
      await expect.poll(async () => {
        const status = normalize(await statusChip.innerText());
        const persisted = await readPersistedLocalGameState();
        const pendingUi = await Promise.all(['betrayal-event-choice-panel', 'betrayal-damage-allocation-panel', 'betrayal-roll-result-backdrop', 'betrayal-event-roll-start', 'betrayal-discovery-panel'].map((testId) => page.getByTestId(testId).isVisible().catch(() => false)));
        const noPersistedDecision = persisted.snapshotFound && persisted.seedMatchesCurrentUrl && persisted.pendingCardResolutionQueueLength === 0 && !persisted.pendingEventRollResolution;
        handoffDiagnostic.lastObserved = { status, currentPlayerId: persisted.currentPlayerId, pendingUi, pendingCardResolutionQueueLength: persisted.pendingCardResolutionQueueLength, pendingEventRollResolution: persisted.pendingEventRollResolution };
        return /AI\s*\d+/u.test(status) && persisted.currentPlayerId && persisted.currentPlayerId !== expectedHumanTurnOwner && pendingUi.every((value) => !value) && noPersistedDecision;
      }, { timeout: 30_000, intervals: [500, 750, 1000] }).toBe(true);
    } catch (error) {
      handoffDiagnostic.stage = 'checking-stable-ai-turn-state-failed';
      handoffDiagnostic.status = 'FAIL';
      handoffDiagnostic.failure = error instanceof Error ? error.message : String(error);
      diagnostics.nextTurnHandoff = handoffDiagnostic;
      await persistAcceptanceCheckpoint('next-ai-handoff-stability-check-failed');
      throw error;
    }

    const turnStatus = normalize(await statusChip.innerText());
    const persistedAfterHandoff = await readPersistedLocalGameState();
    expect(persistedAfterHandoff.currentPlayerId).not.toBe(expectedHumanTurnOwner);
    await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
    diagnostics.nextTurnHandoff = {
      status: 'READY',
      endTurnClicked,
      alreadyInNextAiTurn,
      introDisplayed,
      omenAcknowledgements,
      playerIdAtStart: expectedHumanTurnOwner,
      currentTurnOwnerBeforeHandoff,
      currentTurnOwnerAfterHandoff: persistedAfterHandoff.currentPlayerId,
      explorerBeforeTurnEnd,
      turnText: turnStatus,
    };
    await capture('stable-next-ai-turn', 'The pending card decisions are resolved and the next AI turn is active on the board.');
    return 'Next-turn status: ' + turnStatus;
  });
  if (isLocalUiCloseoutCase) await runStep('结束玩家回合、经过 AI 并返回玩家', async () => {
    const state = {
      status: 'IN_PROGRESS',
      player: '神父 梁沃伦',
      aiStatuses: [],
      turnIntroSkipCount: 0,
      startedAt: new Date().toISOString(),
    };
    diagnostics.localUiCloseout.aiRoundtrip = state;
    const statusChip = page.getByTestId('betrayal-status-chip');
    const endTurn = page.getByTestId('betrayal-action-endTurn');
    const turnIntroSkip = page.getByTestId('betrayal-turn-intro-skip');
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
    await expect(endTurn).toBeEnabled();
    state.playerStatusBefore = normalize(await statusChip.innerText());
    await capture('结束回合前', '检查棋子取消后统一操作栏仍可用，再由玩家可见按钮结束回合。');
    await endTurn.click();
    await expect(statusChip).toContainText(/AI\s*\d+/u, { timeout: 30_000 });
    await expect(turnIntroSkip).toBeVisible({ timeout: 30_000 });
    await capture('AI 回合开始', '玩家结束回合后，状态进入 AI 并出现可见的回合提示。');

    const playerName = state.player;
    let returnedToPlayer = false;
    try {
      for (let turnIndex = 0; turnIndex < 8; turnIndex += 1) {
        const currentStatus = normalize(await statusChip.innerText());
        state.aiStatuses.push({ status: currentStatus, at: new Date().toISOString() });
        if (currentStatus.includes(playerName)) {
          returnedToPlayer = true;
          break;
        }
        const introVisible = await turnIntroSkip.isVisible().catch(() => false);
        if (introVisible) {
          await capture('AI 回合提示 ' + String(state.turnIntroSkipCount + 1), 'AI 回合转场提示可见；通过可见按钮继续，等待 AI 处理并返回玩家。');
          await turnIntroSkip.click();
          state.turnIntroSkipCount += 1;
          await expect(turnIntroSkip).toHaveCount(0, { timeout: 15_000 });
        }
        const afterSkip = normalize(await statusChip.innerText());
        if (afterSkip.includes(playerName)) {
          returnedToPlayer = true;
          break;
        }
        const aiMatch = afterSkip.match(/AI\s*\d+/u);
        const previousAiStatus = aiMatch ? aiMatch[0] : null;
        await page.waitForFunction(({ expectedPlayer, previousAI }) => {
          const status = document.querySelector('[data-testid="betrayal-status-chip"]')?.innerText?.replace(/\s+/g, ' ').trim() ?? '';
          const intro = document.querySelector('[data-testid="betrayal-turn-intro-skip"]');
          const introRect = intro?.getBoundingClientRect();
          const introStyle = intro ? getComputedStyle(intro) : null;
          const introVisible = Boolean(intro && introRect && introRect.width > 0 && introRect.height > 0 && introStyle?.display !== 'none' && introStyle?.visibility !== 'hidden' && Number(introStyle?.opacity) > 0);
          const aiStatus = status.match(/AI\s*\d+/u)?.[0] ?? null;
          return status.includes(expectedPlayer) || introVisible || Boolean(previousAI && aiStatus && aiStatus !== previousAI);
        }, { expectedPlayer: playerName, previousAI: previousAiStatus }, { timeout: 120_000 });
      }
      const statusBeforePlayerIntro = normalize(await statusChip.innerText());
      if (statusBeforePlayerIntro.includes(playerName)) returnedToPlayer = true;
      if (returnedToPlayer && await turnIntroSkip.isVisible().catch(() => false)) {
        await capture('玩家回合提示', '回合状态已回到神父梁沃伦，确认并跳过本人的回合提示。');
        await turnIntroSkip.click();
        state.turnIntroSkipCount += 1;
        await expect(turnIntroSkip).toHaveCount(0, { timeout: 15_000 });
      }
      state.returnedStatus = normalize(await statusChip.innerText());
      state.returnedToPlayer = returnedToPlayer && state.returnedStatus.includes(playerName);
      if (!state.returnedToPlayer) throw new Error('Did not observe the chosen player return after the AI turn sequence. Latest status: ' + state.returnedStatus);
      await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
      await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
      await expect(endTurn).toBeEnabled();
      await capture('玩家回合已恢复', 'AI 回合结束后回到已选玩家；棋盘和统一底栏操作重新可用。');
      state.status = 'PASS';
      state.finishedAt = new Date().toISOString();
      diagnostics.localUiCloseout.status = 'PASS';
      return 'Returned to the selected player after observing AI status and turn transition; the board and enabled end-turn action were restored.';
    } catch (error) {
      state.status = 'FAIL';
      state.failure = error instanceof Error ? error.message : String(error);
      state.finishedAt = new Date().toISOString();
      diagnostics.localUiCloseout.status = 'FAIL';
      throw error;
    }
  });
  }
  pageMetrics = await readVisibleBoardMetrics();
} catch (error) {
  if (isMapReadinessCase && error?.code === 'MAP_DIAGNOSTIC_COMPLETE') {
    fatalError = null;
  } else {
    fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (isMapReadinessCase) {
      mapReadinessStatus = 'FAIL';
      mapDiagnosticFailure = fatalError;
      try {
        await withTimeout(Promise.allSettled(pendingChunkDigests), 5_000, 'bundle digest drain at failure');
        publishedBundleIdentity = assertPublishedBundleIdentity(expectedBundleManifest, diagnostics.chunks);
      } catch (bundleError) {
        diagnostics.bundleIdentityAtFailureError = bundleError instanceof Error ? bundleError.message : String(bundleError);
      }
      if (page && !page.isClosed() && !diagnostics.pageStateAtFailure) {
        diagnostics.pageStateAtFailure = await readPublicPageSnapshot().catch((snapshotError) => ({
          snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        await persistAcceptanceCheckpoint('failure-page-state-sampled').catch(() => {});
        if (diagnostics.pageStateAtFailure?.bodyText?.trim() || diagnostics.pageStateAtFailure?.relevantNodes?.length) {
        try {
          await capture('diagnostic-failure-state', 'Actual page state at the bounded diagnostic failure.');
        } catch (captureError) {
          diagnostics.failureStateScreenshotError = captureError instanceof Error ? captureError.message : String(captureError);
        }
        } else {
          diagnostics.failureScreenshotSkipped = 'The page remained on the textless bootstrap loader; initial screenshot already records this state.';
        }
      }
      await persistAcceptanceCheckpoint('failure-before-browser-cleanup').catch((checkpointError) => console.error(`[public-local-acceptance] checkpoint failed: ${String(checkpointError)}`));
    } else if (page && !page.isClosed()) {
      try { await capture('failure-state', 'Partial acceptance state captured at failure.'); } catch { /* keep original failure */ }
    }
  }
} finally {
  if (isMapReadinessCase || isRoomRevealSequenceCase) {
    cancelMapDiagnosticDeadline?.();
    if (mapReadinessStatus !== 'DEADLINE_EXCEEDED') clearTimeout(forceMapDiagnosticExitTimer);
    await persistAcceptanceCheckpoint('before-browser-cleanup').catch((error) => console.error(`[public-local-acceptance] checkpoint failed before cleanup: ${String(error)}`));
    await closeDiagnosticResources();
    recordingStoppedAt = new Date().toISOString();
  } else {
  const video = page?.video();
  if (page && !page.isClosed()) await page.close().catch((error) => { diagnostics.pageCloseError = String(error); });
  if (context) await context.close().catch((error) => { diagnostics.closeError = String(error); });
  recordingStoppedAt = new Date().toISOString();
  if (browser) await browser.close().catch((error) => { diagnostics.browserCloseError = String(error); });
  globalBudgetHandle?.release?.();
  taskGuard.release();
  if (video) {
    try {
      const sourceVideoPath = await video.path();
      const videoFilename = isCharacterTurnPromptCase ? '00-public-local-v6-character-and-turn-recheck.webm' : isPawnSelectionToggleCase ? '00-棋子切换诊断录屏.webm' : isRoomRevealSequenceCase ? '00-房间揭示真实录屏.webm' : isLocalUiCloseoutCase ? '00-本地UI闭环真实录屏.webm' : '00-完整真实流程录屏.webm';
      const videoPath = path.join(runDir, videoFilename);
      await copyFile(sourceVideoPath, videoPath);
      const videoStat = await stat(videoPath);
      if (videoStat.size > 0) media.unshift({ path: path.basename(videoPath), type: 'video', label: isCharacterTurnPromptCase ? 'Narrow /local AI-turn confirmation diagnosis with real enabled-button clicks and read-only persisted-state samples.' : isPawnSelectionToggleCase ? 'Short diagnostic recording through the first stable map and pawn selection toggle.' : isRoomRevealSequenceCase ? 'Real user recording from /local through the Pixi room reveal and discovery confirmation.' : isLocalUiCloseoutCase ? 'Real /local flow with atlas DOM samples, pawn cancel, movement hops, room reveal, and AI turn roundtrip.' : 'Real user flow recording from the deployed /local entry.', viewport, recordingStartedAt, recordingStoppedAt });
    } catch (error) {
      diagnostics.videoError = error instanceof Error ? error.message : String(error);
    }
  }
  }
}

if (isMapReadinessCase || isRoomRevealSequenceCase) await withTimeout(Promise.allSettled(pendingRoomAtlasFinishes), 2_000, 'room atlas request diagnostics').catch((error) => { diagnostics.roomAtlasDrainError = error instanceof Error ? error.message : String(error); });
else await Promise.allSettled(pendingRoomAtlasFinishes);
for (const url of diagnostics.footstep404s) if (!diagnostics.footstep404s.includes(url)) diagnostics.footstep404s.push(url);
const uniqueSounds = [...new Set(diagnostics.footstep404s)];
const expectedChunks = expectedDeployedBundles.map((item) => item.filename);
const chunkNames = new Set(diagnostics.chunks.map((chunk) => chunk.filename));
const missingChunks = expectedChunks.filter((name) => !chunkNames.has(name));
const screenshots = media.filter((item) => item.type === 'image');
const videoPresent = media.some((item) => item.type === 'video');
const fullFlowPassed = fatalError === null && steps.length === 7 && steps.every((step) => step.status === 'PASS') && screenshots.length >= 10 && videoPresent;
const caseStatus = isMapReadinessCase ? mapReadinessStatus : isCharacterTurnPromptCase ? (fatalError ? 'FAIL' : diagnostics.characterTurnPrompt?.status ?? 'NOT_VERIFIED') : isPawnSelectionToggleCase ? diagnostics.pawnSelectionToggle?.status ?? 'NOT_VERIFIED' : isRoomRevealSequenceCase ? (fatalError ? 'FAIL' : diagnostics.roomRevealSequence?.status === 'PASS' ? (diagnostics.nextTurnHandoff?.status === 'READY' ? 'PASS' : 'NOT_VERIFIED') : diagnostics.roomRevealSequence?.status ?? 'NOT_VERIFIED') : isLocalUiCloseoutCase ? (fatalError ? 'FAIL' : diagnostics.localUiCloseout?.status ?? 'NOT_VERIFIED') : null;
const functionalStatus = isMapReadinessCase ? 'DIAGNOSTIC_ONLY' : isNarrowCase ? (caseStatus === 'PASS' ? 'PASS' : caseStatus === 'FAIL' ? 'FAIL' : 'NOT_VERIFIED') : fullFlowPassed ? 'PASS' : 'REVISE';
const report = {
  schemaVersion: 1,
  case: requestedCase ?? 'full-flow',
  caseStatus,
  runId,
  startedAt,
  finishedAt: new Date().toISOString(),
  ...(isMapReadinessCase ? { diagnosticStartedAt: startedAt, diagnosticFinishedAt: mapDiagnosticFinishedAt ?? new Date().toISOString(), diagnosticElapsedMs: mapDiagnosticStartedEpochMs === null ? null : Date.now() - mapDiagnosticStartedEpochMs, diagnosticMaximumDurationMs: mapDiagnosticMaxMs, localServerStarted: false, videoCapture: false } : {}),
  target: targetUrl,
  effectiveUrl: page?.url() ?? null,
  targetHttpStatus: primaryResponseStatus,
  expectedPublishedSiteVersion: expectedBundleManifest.siteVersion,
  verifiedBundleIdentity: publishedBundleIdentity,
  environment: { host: process.env.COMPUTERNAME ?? null, node: process.version, playwright: require('@playwright/test/package.json').version, chromium: browserVersion, mode: 'headless Chromium, project default launch settings', chromiumLaunchArgs, chromiumSandbox: true, ignoreHTTPSErrors: false, viewport, pageMetrics },
  actualRemoteBundles: diagnostics.chunks,
  expectedBundleNames: expectedChunks,
  expectedBundleSha256: expectedDeployedBundles.map((item) => ({ ...item })),
  missingBundles: missingChunks,
  knownSound404s: uniqueSounds,
  diagnostics,
  steps,
  media: media.map((item) => ({ ...item, absolutePath: path.join(runDir, item.path), bytes: null })),
  functionalStatus,
  visualReview: { status: isMapReadinessCase ? 'DIAGNOSTIC_ONLY' : isPawnSelectionToggleCase ? 'NOT_REQUESTED' : 'PENDING', reviewer: null, files: screenshots.map((item) => item.path) },
  verdict: isMapReadinessCase ? 'DIAGNOSTIC_ONLY' : isCharacterTurnPromptCase ? (caseStatus === 'PASS' ? 'REVIEW_PENDING' : 'REVISE') : isLocalUiCloseoutCase ? (caseStatus === 'PASS' ? 'REVIEW_PENDING' : 'REVISE') : isNarrowCase ? 'REVISE' : fullFlowPassed ? 'REVIEW_PENDING' : 'REVISE',
  failure: mapDiagnosticFailure ?? fatalError,
  limitations: isMapReadinessCase ? ['Bounded map-readiness diagnosis only; does not verify movement, events, turn progression, full gameplay, or final visual acceptance.', 'No video/audio capture; screenshots are diagnostic evidence for independent review.', 'Public Sites page v92; no local server; Chromium sandbox remains enabled.'] : ['仅验证指定公开 /local 页面；不证明固定座位的联机权限。', '本机 Chromium 使用无头软件渲染，视口为 1600×900；不代表有 GPU 加速的 headed 浏览器性能。', '截图均为整页可视视口，视频为同一真实交互运行。', ...(isCharacterTurnPromptCase ? ['本窄链真实结束真人回合并观察 AI 行动；仅当可见确认控件 enabled 时按正常页面点击；用项目现有 local_match_snapshot_v1 localStorage 存档只读采样 core 确认名单和座位控制。未启用或不存在支持的存档读取入口时不创建调试桥。'] : []), ...(isPawnSelectionToggleCase ? ['本次仅复验棋子来源切换；不能判定完整产品验收。移动 reach 可见性不用于推断取消状态。'] : isRoomRevealSequenceCase ? ['本次只验证未移动地图的 ready 前后采样、真实房间探索揭示与发现卡确认；不能替代完整移动/取消、后续回合或固定座位联机权限验收。整体验收保持 REVISE。'] : isLocalUiCloseoutCase ? ['本次覆盖真实 /local 入口、地图 ready、取消选中（aria-pressed 与动作提示恢复）、两个真实房间 hop、揭示卡 atlas 帧与资源信息、结束回合经过 AI 并回到所选玩家。它验证的是当前静态 local UI，不证明固定座位联机权限。首帧时间差以报告实测为准。'] : [])],
};
for (const item of report.media) {
  try { item.bytes = (await stat(item.absolutePath)).size; } catch { item.bytes = 0; }
}
if (isRoomRevealSequenceCase) {
  report.limitations = [
    'Narrow public /local business chain: one room placement, any resulting discovery/event decisions, the resolved room and explorer state, movement consumption, and the next AI turn.',
    'This does not establish full-game acceptance, all scenarios, complete map exploration, overall balance, animation/audio behavior, or final visual acceptance; verdict remains REVISE for independent review.',
    'Transition frames and intro presentations are intentionally not success criteria. Chromium sandbox remains enabled; no local server is started.',
  ];
}
await writeCheckpoint(reportPath, report);
const index = {
  title: '山屋惊魂公开本地入口验收',
  media: media.map((item, index) => ({
    path: item.path,
    label: item.label,
    sourceRun: runId,
    chainId: isMapReadinessCase ? 'public-local-map-readiness-diagnostic' : isCharacterTurnPromptCase ? 'public-local-character-turn-prompt' : isPawnSelectionToggleCase ? 'public-local-pawn-selection-toggle' : isRoomRevealSequenceCase ? 'public-local-room-reveal-sequencing' : isLocalUiCloseoutCase ? 'public-local-ui-closeout' : 'public-local-natural-flow',
    chainStep: index + 1,
    stage: item.type === 'video' ? '连续流程' : '可视状态',
    role: 'main-flow',
    viewport: '桌面 1600×900',
    transition: item.label,
    description: item.label,
  })),
};
await writeFile(path.join(runDir, '.e2e-image-index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
if (!isMapReadinessCase) await rm(videoTempDir, { recursive: true, force: true }).catch(() => {});
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
if (isMapReadinessCase) {
  if (fatalError || mapReadinessStatus === 'FAIL' || mapReadinessStatus === 'MAP_ERROR') process.exitCode = 1;
  else if (mapReadinessStatus === 'MAP_TIMEOUT' || mapReadinessStatus === 'DEADLINE_EXCEEDED' || mapReadinessStatus === 'READY_NO_PAWN') process.exitCode = 2;
} else if (isNarrowCase) {
  if (caseStatus === 'FAIL') process.exitCode = 1;
  else if (caseStatus !== 'PASS') process.exitCode = 2;
} else if (!fullFlowPassed) process.exitCode = 1;
