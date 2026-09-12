import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ??= "1";

const BASE_URL = process.env.BG_REPRO_URL ?? "http://127.0.0.1:4274";
const TARGET_PATH = "/play/betrayal/tutorial/basic-setup-and-turn";
const TARGET_URL = `${BASE_URL}${TARGET_PATH}`;
const HEADLESS = process.env.BG_REPRO_HEADLESS !== "0";
const SKIP_IMAGE_GATE = process.env.BG_REPRO_SKIP_IMAGE_GATE === "1";
const DICE_SETTLE_TIMEOUT_MS = Number(process.env.BG_REPRO_DICE_SETTLE_TIMEOUT_MS ?? 120000);
const DEFAULT_SCENARIOS = [
  "direct-entry",
  "stale-character-select",
  "rabbit-confirm",
  "rabbit-immediate-confirm",
  "rabbit-confirm-after-reload",
];
const SCENARIO_FILTER = new Set(
  (process.env.BG_REPRO_SCENARIOS ?? DEFAULT_SCENARIOS.join(","))
    .split(",")
    .map((scenario) => scenario.trim())
    .filter(Boolean),
);
const REAL_SNAPSHOT_EXPORT = process.env.BG_REPRO_STORAGE_EXPORT;
const OUT_DIR = join(
  process.cwd(),
  "artifacts",
  "betrayal-e2e",
  "rabbit-foot-real-browser-repro",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRerollTargetDieIndex(testId) {
  const match = String(testId ?? "").match(/betrayal-house-dice-reroll-target-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function getDebugDieLayout(visualState, dieIndex) {
  const dice = visualState?.debugSnapshot?.dice;
  if (!Array.isArray(dice) || typeof dieIndex !== "number") return null;
  const debugDie = dice.find((die) => die?.index === dieIndex);
  const layout = debugDie?.layout;
  if (!layout) return null;
  const x = Number(layout.x);
  const y = Number(layout.y);
  const width = Number(layout.visualWidth ?? layout.width);
  const height = Number(layout.visualHeight ?? layout.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return {
    x,
    y,
    width,
    height,
    minX: x - width / 2,
    maxX: x + width / 2,
    minY: y - height / 2,
    maxY: y + height / 2,
  };
}

function getDebugCanvasSize(visualState) {
  const canvas = visualState?.debugSnapshot?.canvas;
  const width = Number(canvas?.clientWidth ?? canvas?.width);
  const height = Number(canvas?.clientHeight ?? canvas?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function measureLayoutDelta(from, to) {
  if (!from || !to) return null;
  return {
    x: Math.round((to.x - from.x) * 10) / 10,
    y: Math.round((to.y - from.y) * 10) / 10,
    distance: Math.round(Math.hypot(to.x - from.x, to.y - from.y) * 10) / 10,
  };
}

function isLayoutInsideCanvas(layout, canvas, margin = 2) {
  if (!layout || !canvas) return false;
  return (
    layout.minX >= margin &&
    layout.maxX <= canvas.width - margin &&
    layout.minY >= margin &&
    layout.maxY <= canvas.height - margin
  );
}

function shouldRunScenario(name) {
  if (name === "real-snapshot" && !REAL_SNAPSHOT_EXPORT && SCENARIO_FILTER.has("all")) {
    return false;
  }
  return SCENARIO_FILTER.has("all") || SCENARIO_FILTER.has(name);
}

function ensureOutDir() {
  mkdirSync(OUT_DIR, { recursive: true });
}

async function attachDiagnostics(page, label) {
  const logs = [];
  page.on("console", (msg) => {
    logs.push({
      at: new Date().toISOString(),
      type: msg.type(),
      text: msg.text(),
    });
  });
  page.on("pageerror", (error) => {
    logs.push({
      at: new Date().toISOString(),
      type: "pageerror",
      text: error.message,
    });
  });
  page.on("requestfailed", (request) => {
    logs.push({
      at: new Date().toISOString(),
      type: "requestfailed",
      text: `${request.url()} ${request.failure()?.errorText ?? ""}`.trim(),
    });
  });
  return {
    logs,
    write(extra = {}) {
      writeFileSync(
        join(OUT_DIR, `${label}.json`),
        JSON.stringify({ label, ...extra, logs }, null, 2),
      );
    },
  };
}

async function gotoTutorial(page, { clearStorage = false } = {}) {
  // Each scenario uses a fresh browser context. Avoid loading the lobby root only
  // to clear storage; the lobby warms unrelated assets and can mask tutorial bugs.
  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  if (clearStorage) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("i18nextLng", "zh-CN");
      localStorage.setItem("boardgame:audio-muted", "true");
    });
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
  }
}

async function waitForBoardOrSelection(page, timeout = 120000) {
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector('[data-testid="betrayal-board"]') ||
          document.querySelector('[data-testid="betrayal-character-select-screen"]'),
      ),
    undefined,
    { timeout },
  );
}

async function waitForDirectTutorialEntry(page, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    const current = await readDirectEntryReadiness(page);
    last = current;
    if (current.hasCharacterSelect) {
      return current;
    }
    if (current.ready) {
      await sleep(1200);
      const stable = await readDirectEntryReadiness(page);
      last = stable;
      if (stable.ready) {
        return stable;
      }
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for stable direct tutorial entry: ${JSON.stringify(last)}`);
}

async function readDirectEntryReadiness(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const board = document.querySelector('[data-testid="betrayal-board"]');
    const selection = document.querySelector('[data-testid="betrayal-character-select-screen"]');
    const objectiveStep = document.querySelector('[data-tutorial-step="objective-and-turn"]');
    const tutorialOverlay = document.querySelector('[data-testid="tutorial-overlay-card"]');
    const loadingScreen = document.querySelector('[data-testid="loading-screen"]');
    return {
      hasBoard: isVisible(board),
      hasCharacterSelect: isVisible(selection),
      hasTutorialOverlayCard: isVisible(tutorialOverlay),
      hasLoadingScreen: isVisible(loadingScreen),
      activeStepDom: document.querySelector("[data-tutorial-step]")?.getAttribute("data-tutorial-step") ?? null,
      ready: Boolean(
        board &&
          objectiveStep &&
          tutorialOverlay &&
          !loadingScreen &&
          isVisible(board) &&
          isVisible(tutorialOverlay),
      ),
    };
  });
}

async function waitForStep(page, stepId, timeout = 45000) {
  await page.waitForFunction(
    (expectedStepId) =>
      document.querySelector(`[data-tutorial-step="${expectedStepId}"]`) !== null,
    stepId,
    { timeout },
  );
}

async function clickNextUntil(page, stepId, maxClicks = 14) {
  for (let i = 0; i < maxClicks; i += 1) {
    const current = await page.evaluate(
      () => document.querySelector("[data-tutorial-step]")?.getAttribute("data-tutorial-step") ?? null,
    );
    if (current === stepId) return;
    const next = page.locator('[data-testid="tutorial-next-button"]');
    await next.waitFor({ state: "visible", timeout: 5000 });
    await next.click();
    await sleep(150);
  }
  await waitForStep(page, stepId, 3000);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const text = (element) =>
      element?.textContent?.replace(/\s+/g, " ").trim().slice(0, 800) ?? null;
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    };
    const harnessState = window.__BG_TEST_HARNESS__?.state?.get?.();
    const tutorial = harnessState?.sys?.tutorial;
    const pendingRoll = harnessState?.core?.pendingEventRollResolution;
    const recentRoll = harnessState?.core?.recentRoll;
    const confirmButton = document.querySelector('[data-testid="betrayal-discovery-continue"]');
    const activeStep = document.querySelector("[data-tutorial-step]");
    const overlayCard = document.querySelector('[data-testid="tutorial-overlay-card"]');
    const loadingScreen = document.querySelector('[data-testid="loading-screen"]');
    const contextDiagnostics = window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__ ?? null;
    const storage = Object.keys(localStorage)
      .filter((key) => key.includes("tutorial") || key.includes("local_match_snapshot"))
      .sort()
      .map((key) => ({
        key,
        valueStart: localStorage.getItem(key)?.slice(0, 500) ?? null,
      }));
    const fullStorage = Object.keys(localStorage)
      .filter((key) => key.includes("tutorial") || key.includes("local_match_snapshot"))
      .sort()
      .map((key) => ({
        key,
        value: localStorage.getItem(key) ?? null,
      }));

    return {
      href: window.location.href,
      hasBoard: Boolean(document.querySelector('[data-testid="betrayal-board"]')),
      hasCharacterSelect: Boolean(document.querySelector('[data-testid="betrayal-character-select-screen"]')),
      hasTutorialOverlayCard: Boolean(overlayCard),
      hasLoadingScreen: Boolean(loadingScreen),
      hasResumePrompt: Boolean([...document.querySelectorAll("button")].some((button) =>
        button.textContent?.replace(/\s+/g, " ").trim().includes("从上次继续"),
      )),
      activeStepDom: activeStep?.getAttribute("data-tutorial-step") ?? null,
      overlayText: text(overlayCard),
      contextDiagnostics,
      tutorial: tutorial
        ? {
            active: tutorial.active ?? null,
            manifestId: tutorial.manifestId ?? null,
            manifestRevision: tutorial.manifestRevision ?? null,
            stepIndex: tutorial.stepIndex ?? null,
            stepId: tutorial.step?.id ?? null,
            stepAllowedCommands: tutorial.step?.allowedCommands ?? null,
            stepInfoStep: tutorial.step?.infoStep ?? null,
            stepRequireAction: tutorial.step?.requireAction ?? null,
          }
        : null,
      core: harnessState?.core
        ? {
            phase: harnessState.core.phase ?? null,
            currentPlayer: harnessState.core.currentPlayer ?? null,
            activePlayerId: harnessState.core.activePlayerId ?? null,
            selectedPlayerId: harnessState.core.selectedPlayerId ?? null,
            pendingEventRollResolution: pendingRoll
              ? {
                  rollId: pendingRoll.rollId ?? null,
                  playerId: pendingRoll.playerId ?? null,
                  requiredPlayerIds: pendingRoll.requiredPlayerIds ?? null,
                  acknowledgedPlayerIds: pendingRoll.acknowledgedPlayerIds ?? null,
                  requiresAcknowledgement: pendingRoll.requiresAcknowledgement ?? null,
                }
              : null,
            recentRoll: recentRoll
              ? {
                  id: recentRoll.id ?? null,
                  kind: recentRoll.kind ?? null,
                  trait: recentRoll.trait ?? null,
                  dice: recentRoll.dice ?? null,
                  consumedRabbitFootCardIds: recentRoll.consumedRabbitFootCardIds ?? null,
                }
              : null,
            usedCardIdsThisTurn: harnessState.core.usedCardIdsThisTurn ?? null,
            pendingDamageAllocation: harnessState.core.pendingDamageAllocation
              ? { playerId: harnessState.core.pendingDamageAllocation.playerId ?? null }
              : null,
          }
        : null,
      continueButton: confirmButton
        ? {
            text: text(confirmButton),
            disabled: confirmButton.disabled === true,
            confirmed: confirmButton.getAttribute("data-event-roll-confirmed-count"),
            required: confirmButton.getAttribute("data-event-roll-required-count"),
            eventRollReadable: confirmButton.getAttribute("data-event-roll-readable"),
            rect: rect(confirmButton),
          }
        : null,
      bodyText: document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 1000) ?? "",
      storage,
      fullStorage,
    };
  });
}

async function readDiceVisualState(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    };
    const datasetOf = (element) => {
      if (!element) return null;
      return Object.fromEntries(Object.entries(element.dataset ?? {}).sort());
    };
    const source = document.querySelector('[data-testid="betrayal-house-dice-physics-source"]');
    const canvas =
      document.querySelector('canvas[data-testid^="betrayal-house-dice-box-canvas-"]') ||
      document.querySelector('[data-dice-physics-source="dice-box-threejs"][data-testid^="betrayal-house-dice-box-canvas-"]');
    const canvasTestId = canvas?.getAttribute("data-testid") ?? null;
    const debugSnapshot = canvasTestId
      ? window.__diceBoxThreeDebug?.[canvasTestId]?.() ?? null
      : null;
    const rerollGroup = document.querySelector('[data-testid="betrayal-rabbit-foot-dice"]');
    const continueButton = document.querySelector('[data-testid="betrayal-discovery-continue"]');
    const targets = [...document.querySelectorAll('[data-testid^="betrayal-house-dice-reroll-target-"]')]
      .filter((target) => target.getAttribute("data-reroll-target-shape") === "die-face")
      .map((target) => {
        const testId = target.getAttribute("data-testid");
        const outline = testId
          ? document.querySelector(`[data-testid="${testId.replace("betrayal-house-dice-reroll-target-", "betrayal-house-dice-reroll-target-outline-")}"]`)
          : null;
        const outlineStyle = outline ? getComputedStyle(outline) : null;
        return {
          testId,
          selected: target.getAttribute("data-reroll-target-selected"),
          hitWidth: target.getAttribute("data-reroll-target-hit-width"),
          hitHeight: target.getAttribute("data-reroll-target-hit-height"),
          visualWidth: target.getAttribute("data-reroll-target-visual-width"),
          visualHeight: target.getAttribute("data-reroll-target-visual-height"),
          projectedWidth: target.getAttribute("data-reroll-target-projected-width"),
          projectedHeight: target.getAttribute("data-reroll-target-projected-height"),
          outlineWidth: target.getAttribute("data-reroll-target-outline-width"),
          outlineHeight: target.getAttribute("data-reroll-target-outline-height"),
          outlineGap: target.getAttribute("data-reroll-target-outline-gap"),
          outlinePaint: target.getAttribute("data-reroll-target-outline-paint"),
          visualLayer: target.getAttribute("data-reroll-target-visual-layer"),
          rect: rect(target),
          outlineRect: rect(outline),
          outlineBorderColor: outlineStyle?.borderTopColor ?? null,
          outlineBoxShadow: outlineStyle?.boxShadow ?? null,
          outlineSelected: outline?.getAttribute("data-reroll-target-outline-selected") ?? null,
        };
      });
    return {
      source: datasetOf(source),
      canvas: datasetOf(canvas),
      debugSnapshot,
      continueButton: continueButton
        ? {
            text: continueButton.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            disabled: continueButton.hasAttribute('disabled'),
            eventRollReadable: continueButton.getAttribute('data-event-roll-readable'),
            rect: rect(continueButton),
          }
        : null,
      rerollGroup: datasetOf(rerollGroup),
      targets,
    };
  });
}

async function captureDiceFrame(page, fileName, settleProbeTimeout = 1200) {
  let observedUnsettled = false;
  await page
    .waitForFunction(
      () =>
        document
          .querySelector('[data-testid="betrayal-house-dice-physics-source"]')
          ?.getAttribute("data-dice-settled") === "false",
      undefined,
      { timeout: settleProbeTimeout },
    )
    .then(() => {
      observedUnsettled = true;
    })
    .catch(() => {});
  await sleep(180);
  const stateBeforeScreenshot = await readDiceVisualState(page);
  const shot = join(OUT_DIR, fileName);
  await page.screenshot({ path: shot, fullPage: true });
  const stateAfterScreenshot = await readDiceVisualState(page);
  return {
    screenshot: shot,
    observedUnsettled,
    state: stateBeforeScreenshot,
    stateAfterScreenshot,
  };
}

async function waitForVisibleDiceSettled(page, diagnostics, label) {
  try {
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-testid="betrayal-house-dice-physics-source"]')]
          .some((node) => {
            if (node.getAttribute("data-dice-settled") === "true") {
              return true;
            }
            return [...node.querySelectorAll('canvas[data-testid^="betrayal-house-dice-box-canvas-"]')]
              .some((canvas) => canvas.getAttribute("data-dice-visual-settled") === "true");
          }),
      undefined,
      { timeout: DICE_SETTLE_TIMEOUT_MS },
    );
  } catch (error) {
    const failureShot = join(OUT_DIR, `${label}-dice-settle-timeout.png`);
    await page.screenshot({ path: failureShot, fullPage: true });
    diagnostics.write({
      label,
      snapshot: await snapshot(page),
      diceSources: await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="betrayal-house-dice-physics-source"]')].map((node) => ({
          settled: node.getAttribute("data-dice-settled"),
          visualSettled: node.getAttribute("data-dice-visual-settled"),
          motion: node.getAttribute("data-dice-motion-type"),
          motionId: node.getAttribute("data-dice-motion-id"),
          engineReady: node.getAttribute("data-dice-engine-ready"),
          skinsReady: node.getAttribute("data-dice-skins-ready"),
          stateCount: node.getAttribute("data-dice-physics-state-count"),
          sourceRect: (() => {
            const rect = node.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          })(),
          canvas: (() => {
            const canvas = node.querySelector('canvas[data-testid^="betrayal-house-dice-box-canvas-"]');
            if (!canvas) return null;
            const testId = canvas.getAttribute('data-testid');
            return {
              testId,
              dataset: { ...canvas.dataset },
              debugSnapshot: testId ? window.__diceBoxThreeDebug?.[testId]?.() ?? null : null,
            };
          })(),
        })),
      ),
      screenshot: failureShot,
      waitFailure: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function waitForEventRollConfirmReady(page, label, timeout = 45000) {
  try {
    await page.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="betrayal-discovery-continue"]');
        return Boolean(
          button &&
            !button.hasAttribute('disabled') &&
            button.getAttribute('data-event-roll-readable') === 'true',
        );
      },
      undefined,
      { timeout },
    );
  } catch (error) {
    const failureShot = join(OUT_DIR, `${label}-confirm-not-ready.png`);
    await page.screenshot({ path: failureShot, fullPage: true });
    throw new Error(
      `${label}: event roll confirm button did not become readable/enabled before timeout; screenshot=${failureShot}; ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function resolveDamageAndTryEndTurn(page) {
  await page
    .locator('[data-testid="betrayal-damage-allocation-panel"]')
    .waitFor({ state: "visible", timeout: 45000 });
  const beforeDamageShot = join(OUT_DIR, "rabbit-before-damage-allocation.png");
  await page.screenshot({ path: beforeDamageShot, fullPage: true });
  const beforeDamage = await snapshot(page);

  const damageTrait = page
    .locator('[data-testid^="betrayal-damage-allocation-trait-"][data-testid$="-increase"]')
    .first();
  await damageTrait.waitFor({ state: "visible", timeout: 10000 });
  await damageTrait.click();
  const damageConfirm = page.locator('[data-testid="betrayal-damage-allocation-confirm"]');
  await page.waitForFunction(
    () => {
      const confirm = document.querySelector('[data-testid="betrayal-damage-allocation-confirm"]');
      return Boolean(confirm && !confirm.hasAttribute("disabled"));
    },
    undefined,
    { timeout: 10000 },
  );
  await damageConfirm.click();
  await waitForStep(page, "return-to-table-after-damage", 15000);
  await sleep(800);

  const afterDamageShot = join(OUT_DIR, "rabbit-after-damage-allocation.png");
  await page.screenshot({ path: afterDamageShot, fullPage: true });
  const afterDamage = await snapshot(page);

  const beforeEndTurnShot = join(OUT_DIR, "rabbit-before-end-turn.png");
  await page.screenshot({ path: beforeEndTurnShot, fullPage: true });
  const beforeEndTurn = await snapshot(page);

  const endTurn = page.locator('[data-testid="betrayal-action-endTurn"]');
  await endTurn.waitFor({ state: "visible", timeout: 15000 });
  await endTurn.click();
  await sleep(1000);

  const afterEndTurnShot = join(OUT_DIR, "rabbit-after-end-turn.png");
  await page.screenshot({ path: afterEndTurnShot, fullPage: true });
  const afterEndTurn = await snapshot(page);

  return {
    beforeDamage,
    afterDamage,
    beforeEndTurn,
    afterEndTurn,
    screenshots: {
      beforeDamage: beforeDamageShot,
      afterDamage: afterDamageShot,
      beforeEndTurn: beforeEndTurnShot,
      afterEndTurn: afterEndTurnShot,
    },
  };
}

async function runDirectEntry(browser) {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1366, height: 768 },
  });
  await context.addInitScript((skipImageGate) => {
    window.__E2E_TEST_MODE__ = true;
    if (skipImageGate) {
      window.__E2E_SKIP_IMAGE_GATE__ = true;
    }
    window.localStorage.setItem("i18nextLng", "zh-CN");
    window.localStorage.setItem("boardgame:audio-muted", "true");
  }, SKIP_IMAGE_GATE);
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page, "direct-entry");
  await gotoTutorial(page, { clearStorage: true });
  await waitForDirectTutorialEntry(page, 90000);
  await sleep(500);
  const shot = join(OUT_DIR, "direct-entry.png");
  await page.screenshot({ path: shot, fullPage: true });
  const snap = await snapshot(page);
  diagnostics.write({ snapshot: snap, screenshot: shot });
  await context.close();
  return { ...snap, screenshot: shot };
}

async function runStaleCharacterSelectRestore(browser) {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1366, height: 768 },
  });
  await context.addInitScript((skipImageGate) => {
    window.__E2E_TEST_MODE__ = true;
    if (skipImageGate) {
      window.__E2E_SKIP_IMAGE_GATE__ = true;
    }
    window.localStorage.setItem("i18nextLng", "zh-CN");
    window.localStorage.setItem("boardgame:audio-muted", "true");
  }, SKIP_IMAGE_GATE);
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page, "stale-character-select-restore");
  await gotoTutorial(page, { clearStorage: true });
  await waitForDirectTutorialEntry(page, 90000);
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.includes("local_match_snapshot_v1:betrayal:tutorial-progress:v1:betrayal:basic-setup-and-turn"),
    );
    if (!key) {
      throw new Error("Cannot find betrayal tutorial progress snapshot");
    }
    const payload = JSON.parse(localStorage.getItem(key) ?? "{}");
    payload.state ??= {};
    payload.state.core ??= {};
    payload.state.sys ??= {};
    payload.state.sys.tutorial ??= {};
    payload.state.core.phase = "characterSelect";
    payload.state.sys.tutorial.active = true;
    payload.state.sys.tutorial.manifestId = "basic-setup-and-turn";
    payload.state.sys.tutorial.stepIndex = 1;
    payload.state.sys.tutorial.step = {
      id: "objective-and-turn",
      content: "game-betrayal:tutorial.basicSetup.steps.objectiveAndTurn",
      highlightTarget: "betrayal-action-move",
      position: "top",
      infoStep: true,
      viewAs: "0",
    };
    localStorage.setItem(key, JSON.stringify(payload));
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForDirectTutorialEntry(page, 90000);
  await sleep(500);
  const shot = join(OUT_DIR, "stale-character-select-restore.png");
  await page.screenshot({ path: shot, fullPage: true });
  const snap = await snapshot(page);
  diagnostics.write({ snapshot: snap, screenshot: shot });
  await context.close();
  return { ...snap, screenshot: shot };
}

async function runRealSnapshotRestore(browser) {
  if (!REAL_SNAPSHOT_EXPORT) {
    throw new Error("BG_REPRO_STORAGE_EXPORT is required for the real-snapshot scenario");
  }
  const rawSnapshot = readFileSync(REAL_SNAPSHOT_EXPORT, "utf8");
  const snapshotPayload = JSON.parse(rawSnapshot);
  if (!snapshotPayload?.gameId || !snapshotPayload?.seed) {
    throw new Error(`Invalid local match snapshot export: ${REAL_SNAPSHOT_EXPORT}`);
  }
  const storageKey = `local_match_snapshot_v1:${snapshotPayload.gameId}:${snapshotPayload.seed}`;
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1366, height: 768 },
  });
  await context.addInitScript((skipImageGate) => {
    window.__E2E_TEST_MODE__ = true;
    if (skipImageGate) {
      window.__E2E_SKIP_IMAGE_GATE__ = true;
    }
    window.localStorage.setItem("i18nextLng", "zh-CN");
    window.localStorage.setItem("boardgame:audio-muted", "true");
  }, SKIP_IMAGE_GATE);
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page, "real-snapshot-restore");
  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("i18nextLng", "zh-CN");
    localStorage.setItem("boardgame:audio-muted", "true");
    localStorage.setItem(key, value);
  }, { key: storageKey, value: rawSnapshot });
  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  const resumeButton = page.getByRole("button", { name: /从上次继续/ });
  const hasResumePrompt = await resumeButton
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (hasResumePrompt) {
    await resumeButton.click();
  }

  await waitForBoardOrSelection(page, 90000);
  await sleep(1000);
  const beforeShot = join(OUT_DIR, "real-snapshot-before-confirm.png");
  await page.screenshot({ path: beforeShot, fullPage: true });
  const before = await snapshot(page);
  if (before.continueButton && !before.continueButton.disabled) {
    await page.locator('[data-testid="betrayal-discovery-continue"]').click();
    await sleep(1200);
  }
  const afterShot = join(OUT_DIR, "real-snapshot-after-confirm.png");
  await page.screenshot({ path: afterShot, fullPage: true });
  const after = await snapshot(page);
  diagnostics.write({
    storageKey,
    savedAt: snapshotPayload.savedAt ?? null,
    hasResumePrompt,
    before,
    after,
    screenshots: { before: beforeShot, after: afterShot },
  });
  await context.close();
  return {
    storageKey,
    savedAt: snapshotPayload.savedAt ?? null,
    hasResumePrompt,
    before,
    after,
    screenshots: { before: beforeShot, after: afterShot },
    logs: diagnostics.logs,
  };
}

async function runRabbitConfirm(browser) {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1366, height: 768 },
  });
  await context.addInitScript((skipImageGate) => {
    window.__E2E_TEST_MODE__ = true;
    if (skipImageGate) {
      window.__E2E_SKIP_IMAGE_GATE__ = true;
    }
    window.localStorage.setItem("i18nextLng", "zh-CN");
    window.localStorage.setItem("boardgame:audio-muted", "true");
  }, SKIP_IMAGE_GATE);
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page, "rabbit-confirm");
  await gotoTutorial(page, { clearStorage: true });
  await waitForBoardOrSelection(page);
  await waitForStep(page, "objective-and-turn", 45000);
  await clickNextUntil(page, "open-move-targets", 10);
  await page.locator('[data-testid="betrayal-action-move"]').click();
  await waitForStep(page, "move-to-hallway");
  await page.locator('[data-testid="betrayal-room-hallway"]').click();
  await waitForStep(page, "explore-upper");
  await page.locator('[data-testid="betrayal-action-explore"]').click();
  await page.locator('[data-testid^="betrayal-room-explore-target-"]').first().waitFor({
    state: "visible",
    timeout: 15000,
  });
  const targetRoomTestId = await page
    .locator('[data-testid^="betrayal-room-explore-target-"]')
    .first()
    .getAttribute("data-testid");
  const roomId = targetRoomTestId?.replace("betrayal-room-explore-target-", "");
  await page.locator(`[data-testid="betrayal-room-${roomId}"]`).click();
  await waitForStep(page, "rotate-room-placement");
  await page.locator('[data-testid="betrayal-room-placement-rotate-right"]').click();
  await waitForStep(page, "confirm-room-placement");
  const adjustment = page.locator('[data-testid="betrayal-room-tile-adjustment-option"]').first();
  if (await adjustment.isVisible().catch(() => false)) {
    await adjustment.click();
  }
  await page.locator('[data-testid="betrayal-room-placement-confirm"]').click();
  await waitForStep(page, "discovery-card-type");
  await clickNextUntil(page, "roll-event", 3);
  await page.locator('[data-testid="betrayal-event-roll-start"]').click();
  const firstRollMotion = await captureDiceFrame(page, "first-roll-motion.png");
  await waitForStep(page, "view-book");
  await waitForVisibleDiceSettled(page, diagnostics, "rabbit-confirm-view-book");
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="betrayal-inventory-omen-book"]')
        ?.getAttribute("data-event-roll-book-available") === "true",
    undefined,
    { timeout: 45000 },
  );
  await page.locator('[data-testid="betrayal-inventory-omen-book-magnify"]').click();
  await page.locator('[data-testid="betrayal-inventory-preview-overlay"]').waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator('[data-testid="betrayal-inventory-preview-overlay-close"]').click();
  await page.locator('[data-testid="betrayal-inventory-preview-overlay"]').waitFor({
    state: "hidden",
    timeout: 10000,
  });
  await clickNextUntil(page, "use-book", 3);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="betrayal-inventory-omen-book"]')
        ?.getAttribute("data-event-roll-book-available") === "true",
    undefined,
    { timeout: 45000 },
  );
  await page.evaluate(() => window.__BG_TEST_HARNESS__?.random?.setQueue?.([0.99, 0, 0, 0, 0, 0]));
  await page.locator('[data-testid="betrayal-inventory-omen-book"]').click();
  await waitForStep(page, "use-rabbit-foot", 45000);
  await page.locator('[data-testid="betrayal-inventory-rope"]').click();
  await page.locator('[data-testid="betrayal-rabbit-foot-dice"]').waitFor({
    state: "visible",
    timeout: 45000,
  });
  const firstRerollTarget = page.locator('[data-testid^="betrayal-house-dice-reroll-target-"]').first();
  await firstRerollTarget.waitFor({
    state: "visible",
    timeout: 45000,
  });
  const selectedDieTestId = await firstRerollTarget.getAttribute("data-testid");
  if (!selectedDieTestId) {
    throw new Error("Cannot resolve visible rabbit-foot dice target test id");
  }
  await firstRerollTarget.click();
  await page.waitForFunction(
    (testId) =>
      document.querySelector(`[data-testid="${testId}"]`)?.getAttribute("data-reroll-target-selected") === "true",
    selectedDieTestId,
    { timeout: 5000 },
  );
  const selectedHighlight = {
    screenshot: join(OUT_DIR, "rabbit-selection-highlight.png"),
    state: await readDiceVisualState(page),
  };
  await page.screenshot({ path: selectedHighlight.screenshot, fullPage: true });
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').click();
  const rerollMotion = await captureDiceFrame(page, "rabbit-reroll-motion.png");
  await waitForStep(page, "rabbit-foot-result", 45000);
  await waitForVisibleDiceSettled(page, diagnostics, "rabbit-confirm-after-reroll");
  const settledAfterReroll = {
    screenshot: join(OUT_DIR, "rabbit-after-reroll-settled.png"),
    state: await readDiceVisualState(page),
  };
  await page.screenshot({ path: settledAfterReroll.screenshot, fullPage: true });
  const selectedDieIndex = parseRerollTargetDieIndex(selectedDieTestId);
  const rerollLanding = {
    selectedDieIndex,
    beforeLayout: getDebugDieLayout(selectedHighlight.state, selectedDieIndex),
    motionLayout: getDebugDieLayout(rerollMotion.state, selectedDieIndex),
    afterLayout: getDebugDieLayout(settledAfterReroll.state, selectedDieIndex),
    settledCanvas: getDebugCanvasSize(settledAfterReroll.state),
  };
  rerollLanding.motionDelta = measureLayoutDelta(rerollLanding.beforeLayout, rerollLanding.motionLayout);
  rerollLanding.finalDelta = measureLayoutDelta(rerollLanding.beforeLayout, rerollLanding.afterLayout);
  rerollLanding.afterInsideCanvas = isLayoutInsideCanvas(
    rerollLanding.afterLayout,
    rerollLanding.settledCanvas,
  );
  await page
    .locator('[data-testid="betrayal-discovery-continue"]')
    .waitFor({ state: "visible", timeout: 45000 });
  await waitForEventRollConfirmReady(page, "rabbit-confirm");
  const beforeShot = join(OUT_DIR, "rabbit-before-confirm.png");
  await page.screenshot({ path: beforeShot, fullPage: true });
  const before = await snapshot(page);
  await page.locator('[data-testid="betrayal-discovery-continue"]').click();
  await sleep(800);
  const afterShot = join(OUT_DIR, "rabbit-after-confirm.png");
  await page.screenshot({ path: afterShot, fullPage: true });
  const after = await snapshot(page);
  const endTurnFollowup = await resolveDamageAndTryEndTurn(page);
  diagnostics.write({
    before,
    after,
    endTurnFollowup,
    visual: {
      firstRollMotion,
      selectedHighlight,
      rerollMotion,
      settledAfterReroll,
      rerollLanding,
    },
    screenshots: { before: beforeShot, after: afterShot },
  });
  await context.close();
  return {
    before,
    after,
    endTurnFollowup,
    visual: {
      firstRollMotion,
      selectedHighlight,
      rerollMotion,
      settledAfterReroll,
      rerollLanding,
    },
    screenshots: { before: beforeShot, after: afterShot },
    logs: diagnostics.logs,
  };
}

async function runRabbitImmediateConfirm(browser) {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1366, height: 768 },
  });
  await context.addInitScript((skipImageGate) => {
    window.__E2E_TEST_MODE__ = true;
    if (skipImageGate) {
      window.__E2E_SKIP_IMAGE_GATE__ = true;
    }
    window.localStorage.setItem("i18nextLng", "zh-CN");
    window.localStorage.setItem("boardgame:audio-muted", "true");
  }, SKIP_IMAGE_GATE);
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page, "rabbit-immediate-confirm");
  await gotoTutorial(page, { clearStorage: true });
  await waitForBoardOrSelection(page);
  await waitForStep(page, "objective-and-turn", 45000);
  await clickNextUntil(page, "open-move-targets", 10);
  await page.locator('[data-testid="betrayal-action-move"]').click();
  await waitForStep(page, "move-to-hallway");
  await page.locator('[data-testid="betrayal-room-hallway"]').click();
  await waitForStep(page, "explore-upper");
  await page.locator('[data-testid="betrayal-action-explore"]').click();
  await page.locator('[data-testid^="betrayal-room-explore-target-"]').first().waitFor({
    state: "visible",
    timeout: 15000,
  });
  const targetRoomTestId = await page
    .locator('[data-testid^="betrayal-room-explore-target-"]')
    .first()
    .getAttribute("data-testid");
  const roomId = targetRoomTestId?.replace("betrayal-room-explore-target-", "");
  await page.locator(`[data-testid="betrayal-room-${roomId}"]`).click();
  await waitForStep(page, "rotate-room-placement");
  await page.locator('[data-testid="betrayal-room-placement-rotate-right"]').click();
  await waitForStep(page, "confirm-room-placement");
  const adjustment = page.locator('[data-testid="betrayal-room-tile-adjustment-option"]').first();
  if (await adjustment.isVisible().catch(() => false)) {
    await adjustment.click();
  }
  await page.locator('[data-testid="betrayal-room-placement-confirm"]').click();
  await waitForStep(page, "discovery-card-type");
  await clickNextUntil(page, "roll-event", 3);
  await page.locator('[data-testid="betrayal-event-roll-start"]').click();
  await waitForStep(page, "view-book");
  await waitForVisibleDiceSettled(page, diagnostics, "rabbit-immediate-view-book");
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="betrayal-inventory-omen-book"]')
        ?.getAttribute("data-event-roll-book-available") === "true",
    undefined,
    { timeout: 45000 },
  );
  await page.locator('[data-testid="betrayal-inventory-omen-book-magnify"]').click();
  await page.locator('[data-testid="betrayal-inventory-preview-overlay"]').waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator('[data-testid="betrayal-inventory-preview-overlay-close"]').click();
  await page.locator('[data-testid="betrayal-inventory-preview-overlay"]').waitFor({
    state: "hidden",
    timeout: 10000,
  });
  await clickNextUntil(page, "use-book", 3);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="betrayal-inventory-omen-book"]')
        ?.getAttribute("data-event-roll-book-available") === "true",
    undefined,
    { timeout: 45000 },
  );
  await page.evaluate(() => window.__BG_TEST_HARNESS__?.random?.setQueue?.([0.99, 0, 0, 0, 0, 0]));
  await page.locator('[data-testid="betrayal-inventory-omen-book"]').click();
  await waitForStep(page, "use-rabbit-foot", 45000);
  await page.locator('[data-testid="betrayal-inventory-rope"]').click();
  await page.locator('[data-testid="betrayal-rabbit-foot-dice"]').waitFor({
    state: "visible",
    timeout: 45000,
  });
  const firstRerollTarget = page.locator('[data-testid^="betrayal-house-dice-reroll-target-"]').first();
  await firstRerollTarget.waitFor({
    state: "visible",
    timeout: 45000,
  });
  await firstRerollTarget.click();
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').click();
  const immediateButton = page.locator('[data-testid="betrayal-discovery-continue"]');
  await immediateButton.waitFor({ state: "visible", timeout: 45000 });
  await waitForVisibleDiceSettled(page, diagnostics, "rabbit-immediate-after-reroll");
  await waitForEventRollConfirmReady(page, "rabbit-immediate-confirm");
  const beforeShot = join(OUT_DIR, "rabbit-immediate-before-confirm.png");
  await page.screenshot({ path: beforeShot, fullPage: true });
  const before = await snapshot(page);
  await immediateButton.click();
  await page
    .waitForFunction(
      () =>
        document.querySelector('[data-tutorial-step="finish"]') ||
        document.querySelector('[data-testid="betrayal-damage-allocation-panel"]'),
      undefined,
      { timeout: 45000 },
    )
    .catch(() => {});
  const afterShot = join(OUT_DIR, "rabbit-immediate-after-confirm.png");
  await page.screenshot({ path: afterShot, fullPage: true });
  const after = await snapshot(page);
  diagnostics.write({ before, after, screenshots: { before: beforeShot, after: afterShot } });
  await context.close();
  return { before, after, screenshots: { before: beforeShot, after: afterShot }, logs: diagnostics.logs };
}


async function runRabbitConfirmAfterReload(browser) {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1366, height: 768 },
  });
  await context.addInitScript((skipImageGate) => {
    window.__E2E_TEST_MODE__ = true;
    if (skipImageGate) {
      window.__E2E_SKIP_IMAGE_GATE__ = true;
    }
    window.localStorage.setItem("i18nextLng", "zh-CN");
    window.localStorage.setItem("boardgame:audio-muted", "true");
  }, SKIP_IMAGE_GATE);
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page, "rabbit-confirm-after-reload");
  await gotoTutorial(page, { clearStorage: true });
  await waitForBoardOrSelection(page);
  await waitForStep(page, "objective-and-turn", 45000);
  await clickNextUntil(page, "open-move-targets", 10);
  await page.locator('[data-testid="betrayal-action-move"]').click();
  await waitForStep(page, "move-to-hallway");
  await page.locator('[data-testid="betrayal-room-hallway"]').click();
  await waitForStep(page, "explore-upper");
  await page.locator('[data-testid="betrayal-action-explore"]').click();
  await page.locator('[data-testid^="betrayal-room-explore-target-"]').first().waitFor({
    state: "visible",
    timeout: 15000,
  });
  const targetRoomTestId = await page
    .locator('[data-testid^="betrayal-room-explore-target-"]')
    .first()
    .getAttribute("data-testid");
  const roomId = targetRoomTestId?.replace("betrayal-room-explore-target-", "");
  await page.locator(`[data-testid="betrayal-room-${roomId}"]`).click();
  await waitForStep(page, "rotate-room-placement");
  await page.locator('[data-testid="betrayal-room-placement-rotate-right"]').click();
  await waitForStep(page, "confirm-room-placement");
  const adjustment = page.locator('[data-testid="betrayal-room-tile-adjustment-option"]').first();
  if (await adjustment.isVisible().catch(() => false)) {
    await adjustment.click();
  }
  await page.locator('[data-testid="betrayal-room-placement-confirm"]').click();
  await waitForStep(page, "discovery-card-type");
  await clickNextUntil(page, "roll-event", 3);
  await page.locator('[data-testid="betrayal-event-roll-start"]').click();
  await waitForStep(page, "view-book");
  await waitForVisibleDiceSettled(page, diagnostics, "rabbit-reload-view-book");
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="betrayal-inventory-omen-book"]')
        ?.getAttribute("data-event-roll-book-available") === "true",
    undefined,
    { timeout: 45000 },
  );
  await page.locator('[data-testid="betrayal-inventory-omen-book-magnify"]').click();
  await page.locator('[data-testid="betrayal-inventory-preview-overlay"]').waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator('[data-testid="betrayal-inventory-preview-overlay-close"]').click();
  await page.locator('[data-testid="betrayal-inventory-preview-overlay"]').waitFor({
    state: "hidden",
    timeout: 10000,
  });
  await clickNextUntil(page, "use-book", 3);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="betrayal-inventory-omen-book"]')
        ?.getAttribute("data-event-roll-book-available") === "true",
    undefined,
    { timeout: 45000 },
  );
  await page.evaluate(() => window.__BG_TEST_HARNESS__?.random?.setQueue?.([0.99, 0, 0, 0, 0, 0]));
  await page.locator('[data-testid="betrayal-inventory-omen-book"]').click();
  await waitForStep(page, "use-rabbit-foot", 45000);
  await page.locator('[data-testid="betrayal-inventory-rope"]').click();
  await page.locator('[data-testid="betrayal-rabbit-foot-dice"]').waitFor({
    state: "visible",
    timeout: 45000,
  });
  const firstRerollTarget = page.locator('[data-testid^="betrayal-house-dice-reroll-target-"]').first();
  await firstRerollTarget.waitFor({
    state: "visible",
    timeout: 45000,
  });
  await firstRerollTarget.click();
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').click();
  await waitForStep(page, "rabbit-foot-result", 45000);
  await waitForVisibleDiceSettled(page, diagnostics, "rabbit-immediate-after-reroll");
  await page
    .locator('[data-testid="betrayal-discovery-continue"]')
    .waitFor({ state: "visible", timeout: 45000 });
  await waitForEventRollConfirmReady(page, "rabbit-reload-before-reload");

  const beforeReloadShot = join(OUT_DIR, "rabbit-before-reload.png");
  await page.screenshot({ path: beforeReloadShot, fullPage: true });
  const beforeReload = await snapshot(page);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  const resumeButton = page.getByRole("button", { name: /从上次继续/ });
  if (await resumeButton.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false)) {
    await resumeButton.click();
  }
  try {
    await waitForStep(page, "rabbit-foot-result", 90000);
  } catch (error) {
    const afterReloadFailureShot = join(OUT_DIR, "rabbit-after-reload-failure.png");
    await page.screenshot({ path: afterReloadFailureShot, fullPage: true });
    const afterReloadFailure = await snapshot(page);
    diagnostics.write({
      beforeReload,
      afterReloadFailure,
      screenshots: {
        beforeReload: beforeReloadShot,
        afterReloadFailure: afterReloadFailureShot,
      },
      waitFailure: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
  await page
    .locator('[data-testid="betrayal-discovery-continue"]')
    .waitFor({ state: "visible", timeout: 45000 });
  await waitForVisibleDiceSettled(page, diagnostics, "rabbit-after-reload-reroll");
  await waitForEventRollConfirmReady(page, "rabbit-after-reload-confirm");
  const beforeConfirmShot = join(OUT_DIR, "rabbit-after-reload-before-confirm.png");
  await page.screenshot({ path: beforeConfirmShot, fullPage: true });
  const beforeConfirm = await snapshot(page);

  await page.locator('[data-testid="betrayal-discovery-continue"]').click();
  await sleep(800);
  const afterConfirmShot = join(OUT_DIR, "rabbit-after-reload-after-confirm.png");
  await page.screenshot({ path: afterConfirmShot, fullPage: true });
  const afterConfirm = await snapshot(page);
  diagnostics.write({
    beforeReload,
    beforeConfirm,
    afterConfirm,
    screenshots: {
      beforeReload: beforeReloadShot,
      beforeConfirm: beforeConfirmShot,
      afterConfirm: afterConfirmShot,
    },
  });
  await context.close();
  return {
    beforeReload,
    beforeConfirm,
    afterConfirm,
    screenshots: {
      beforeReload: beforeReloadShot,
      beforeConfirm: beforeConfirmShot,
      afterConfirm: afterConfirmShot,
    },
    logs: diagnostics.logs,
  };
}

async function main() {
  ensureOutDir();
  const browser = await chromium.launch({ headless: HEADLESS });
  const result = { outDir: OUT_DIR, targetUrl: TARGET_URL, skipImageGate: SKIP_IMAGE_GATE };
  try {
    if (shouldRunScenario("direct-entry")) {
      result.directEntry = await runDirectEntry(browser);
    }
    if (shouldRunScenario("stale-character-select")) {
      result.staleCharacterSelectRestore = await runStaleCharacterSelectRestore(browser);
    }
    if (shouldRunScenario("real-snapshot")) {
      result.realSnapshotRestore = await runRealSnapshotRestore(browser);
    }
    if (shouldRunScenario("rabbit-confirm")) {
      result.rabbitConfirm = await runRabbitConfirm(browser);
    }
    if (shouldRunScenario("rabbit-immediate-confirm")) {
      result.rabbitImmediateConfirm = await runRabbitImmediateConfirm(browser);
    }
    if (shouldRunScenario("rabbit-confirm-after-reload")) {
      result.rabbitConfirmAfterReload = await runRabbitConfirmAfterReload(browser);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT_DIR, "result.json"), JSON.stringify(result, null, 2));

  const failures = [];
  if (result.directEntry?.hasCharacterSelect) {
    failures.push("direct entry showed character selection");
  }
  if (result.directEntry?.hasLoadingScreen) {
    failures.push("direct entry stayed behind loading screen");
  }
  if (result.directEntry && (!result.directEntry.hasTutorialOverlayCard || result.directEntry.activeStepDom !== "objective-and-turn")) {
    failures.push("direct entry did not show an active tutorial overlay");
  }
  if (result.staleCharacterSelectRestore?.hasResumePrompt) {
    failures.push("stale character-select snapshot still asked to continue");
  }
  if (result.staleCharacterSelectRestore?.hasCharacterSelect) {
    failures.push("stale character-select snapshot restored character selection");
  }
  if (
    result.staleCharacterSelectRestore &&
    (!result.staleCharacterSelectRestore.hasTutorialOverlayCard ||
    result.staleCharacterSelectRestore.activeStepDom !== "objective-and-turn"
    )
  ) {
    failures.push("stale character-select snapshot did not restart to tutorial board");
  }
  if (result.realSnapshotRestore) {
    const real = result.realSnapshotRestore;
    const rejected = real.logs.some((entry) =>
      entry.text.includes("FINALIZE_EVENT_ROLL") && entry.text.includes("tutorial_command_blocked"),
    );
    if (real.hasResumePrompt) {
      failures.push("real legacy snapshot was still restorable");
    }
    if (real.before.activeStepDom !== "objective-and-turn") {
      failures.push(`real legacy snapshot did not restart from the current tutorial; saw ${real.before.activeStepDom}`);
    }
    if (real.before.continueButton || rejected) {
      failures.push("real legacy snapshot still exposed the stale event confirm path");
    }
  }
  if (result.rabbitConfirm) {
    const rabbitBefore = result.rabbitConfirm.before;
    const rabbitAfter = result.rabbitConfirm.after;
    const rejected = result.rabbitConfirm.logs.some((entry) =>
      entry.text.includes("FINALIZE_EVENT_ROLL") && entry.text.includes("tutorial_command_blocked"),
    );
    if (rabbitBefore.activeStepDom !== "rabbit-foot-result") {
      failures.push(`rabbit confirm started from ${rabbitBefore.activeStepDom}`);
    }
    if (!rabbitBefore.tutorial?.stepAllowedCommands?.includes("FINALIZE_EVENT_ROLL")) {
      failures.push("rabbit-foot-result did not allow FINALIZE_EVENT_ROLL before click");
    }
    if (!rabbitBefore.continueButton || rabbitBefore.continueButton.disabled || rabbitBefore.continueButton.eventRollReadable !== "true") {
      failures.push("rabbit confirm did not expose an enabled readable confirm button after dice settled");
    }
    if (rejected) {
      failures.push("FINALIZE_EVENT_ROLL was rejected by tutorial_command_blocked");
    }
    if (rabbitAfter.activeStepDom !== "finish" || rabbitAfter.core?.pendingDamageAllocation?.playerId !== "0") {
      failures.push("rabbit confirm did not advance to damage allocation");
    }
    const endTurnFollowup = result.rabbitConfirm.endTurnFollowup;
    const endTurnRejected = result.rabbitConfirm.logs.some((entry) =>
      entry.text.includes("END_TURN") && entry.text.includes("tutorial_command_blocked"),
    );
    if (endTurnRejected) {
      failures.push("END_TURN after rabbit-foot damage allocation was rejected by tutorial_command_blocked");
    }
    if (!endTurnFollowup?.afterDamage) {
      failures.push("rabbit confirm did not capture the post-damage end-turn follow-up state");
    } else {
      const afterDamage = endTurnFollowup.afterDamage;
      if (afterDamage.activeStepDom !== "return-to-table-after-damage") {
        failures.push(`rabbit post-damage step was ${afterDamage.activeStepDom}`);
      }
      if (!afterDamage.tutorial?.stepAllowedCommands?.includes("END_TURN")) {
        failures.push("rabbit post-damage tutorial step did not allow END_TURN before click");
      }
      if (afterDamage.overlayText?.includes("返回牌桌")) {
        failures.push("rabbit post-damage tutorial still told the player to return to table");
      }
      if (!afterDamage.overlayText?.includes("结束回合")) {
        failures.push("rabbit post-damage tutorial did not tell the player to end the turn");
      }
      if (afterDamage.continueButton) {
        failures.push(
          `rabbit post-damage still exposed stale discovery continue button: ${afterDamage.continueButton.text ?? "missing label"}`,
        );
      }
    }
    if (!endTurnFollowup?.afterEndTurn) {
      failures.push("rabbit confirm did not capture the state after clicking End Turn");
    } else {
      const afterEndTurn = endTurnFollowup.afterEndTurn;
      if (afterEndTurn.core?.currentPlayer !== "1") {
        failures.push(`rabbit post-damage END_TURN did not pass play to player 1; saw ${afterEndTurn.core?.currentPlayer ?? "missing"}`);
      }
      if (afterEndTurn.activeStepDom === "return-to-table-after-damage") {
        failures.push("rabbit post-damage END_TURN left the tutorial on the stale post-damage step");
      }
      if (!["watch-teammate-one-omen-turn", "teammate-one-omen-results"].includes(afterEndTurn.activeStepDom)) {
        failures.push(`rabbit post-damage END_TURN did not advance to teammate follow-up; saw ${afterEndTurn.activeStepDom}`);
      }
    }
    const firstRollMotion = result.rabbitConfirm.visual.firstRollMotion.state.source;
    if (firstRollMotion?.diceMotionType !== "roll" || firstRollMotion?.diceSettled !== "false") {
      failures.push("first event roll did not expose a visible rolling process frame");
    }
    const selectedHighlight = result.rabbitConfirm.visual.selectedHighlight.state;
    const selectedHighlightScale = Number(selectedHighlight.rerollGroup?.rerollHighlightSelectedScale ?? "0");
    const candidateHighlightScale = Number(selectedHighlight.rerollGroup?.rerollHighlightCandidateScale ?? "0");
    const selectedHighlightTarget = selectedHighlight.targets.find((target) => target.selected === "true");
    const selectedHitWidth = Number(selectedHighlightTarget?.hitWidth ?? "0");
    const selectedHitHeight = Number(selectedHighlightTarget?.hitHeight ?? "0");
    const selectedProjectedWidth = Number(selectedHighlightTarget?.projectedWidth ?? "0");
    const selectedProjectedHeight = Number(selectedHighlightTarget?.projectedHeight ?? "0");
    const selectedOutlineWidth = Number(selectedHighlightTarget?.outlineWidth ?? "0");
    const selectedOutlineHeight = Number(selectedHighlightTarget?.outlineHeight ?? "0");
    const selectedDieIndex = parseRerollTargetDieIndex(selectedHighlightTarget?.testId);
    const selectedHighlightState = selectedHighlight.debugSnapshot?.diceHighlights?.find(
      (highlight) => highlight?.dieIndex === selectedDieIndex,
    );
    const selectedHighlightShell = selectedHighlight.debugSnapshot?.diceHighlightShells?.find(
      (shell) => shell?.dieIndex === selectedDieIndex,
    );
    if (
      !selectedHighlightTarget ||
      !(candidateHighlightScale >= 1.04 && candidateHighlightScale <= 1.055) ||
      !(selectedHighlightScale > candidateHighlightScale && selectedHighlightScale <= 1.075) ||
      selectedHighlightTarget.outlinePaint !== "threejs-backside-shader-shell" ||
      selectedHighlightTarget.visualLayer !== "transparent-hitbox-only" ||
      selectedHighlightTarget.outlineSelected !== null ||
      Math.abs(selectedHitWidth - selectedHitHeight) > 1 ||
      selectedHighlightState?.variant !== "selected" ||
      selectedHighlightShell?.variant !== "selected" ||
      selectedHighlightShell?.visible !== true ||
      selectedHighlightShell?.materialType !== "ShaderMaterial" ||
      selectedHighlightShell?.depthWrite !== false ||
      selectedHighlightShell?.transparent !== true ||
      !(selectedOutlineWidth >= selectedProjectedWidth - 0.5 && selectedOutlineWidth - selectedProjectedWidth <= 10) ||
      !(selectedOutlineHeight >= selectedProjectedHeight - 0.5 && selectedOutlineHeight - selectedProjectedHeight <= 10) ||
      Math.abs(selectedHitWidth - selectedOutlineWidth) > 1.5 ||
      Math.abs(selectedHitHeight - selectedOutlineHeight) > 1.5
    ) {
      failures.push("rabbit-foot dice highlight was not shader-shell tight with a body-aligned transparent hitbox");
    }
    const rerollMotion = result.rabbitConfirm.visual.rerollMotion.state.source;
    if (rerollMotion?.diceMotionType !== "reroll" || rerollMotion?.diceSettled !== "false") {
      failures.push("rabbit-foot reroll did not expose a visible reroll process frame");
    }
    const rerollLanding = result.rabbitConfirm.visual.rerollLanding;
    if (!rerollLanding?.beforeLayout || !rerollLanding?.motionLayout || !rerollLanding?.afterLayout) {
      failures.push("rabbit-foot reroll did not expose before/motion/after dice layouts for the selected die");
    }
    if (!rerollLanding?.motionDelta || rerollLanding.motionDelta.distance < 16) {
      failures.push(
        `rabbit-foot reroll process looked stationary; motion delta=${rerollLanding?.motionDelta?.distance ?? "missing"}px`,
      );
    }
    if (
      !rerollLanding?.finalDelta ||
      rerollLanding.finalDelta.distance < 24 ||
      rerollLanding.finalDelta.distance > 80
    ) {
      failures.push(
        `rabbit-foot reroll final landing did not visibly change without a large gap; final delta=${rerollLanding?.finalDelta?.distance ?? "missing"}px`,
      );
    }
    if (rerollLanding?.afterInsideCanvas !== true) {
      failures.push("rabbit-foot reroll final landing was not fully visible inside the dice tray");
    }
    if (
      result.rabbitConfirm.visual.rerollMotion.state.continueButton &&
      result.rabbitConfirm.visual.rerollMotion.state.continueButton.disabled !== true
    ) {
      failures.push("rabbit-foot reroll exposed enabled confirm before dice settled");
    }
    if (result.rabbitConfirm.visual.rerollMotion.state.continueButton?.eventRollReadable === "true") {
      failures.push("rabbit-foot reroll marked event result readable before dice settled");
    }
  }
  if (result.rabbitImmediateConfirm) {
    const rabbitImmediateBefore = result.rabbitImmediateConfirm.before;
    const rabbitImmediateAfter = result.rabbitImmediateConfirm.after;
    const immediateRejected = result.rabbitImmediateConfirm.logs.some((entry) =>
      entry.text.includes("FINALIZE_EVENT_ROLL") && entry.text.includes("tutorial_command_blocked"),
    );
    if (!rabbitImmediateBefore.continueButton || rabbitImmediateBefore.continueButton.disabled) {
      failures.push("rabbit immediate confirm did not find an enabled confirm button");
    }
    if (rabbitImmediateBefore.continueButton?.eventRollReadable !== "true") {
      failures.push("rabbit immediate confirm did not wait for readable dice result");
    }
    if (rabbitImmediateBefore.activeStepDom !== "rabbit-foot-result") {
      failures.push(`rabbit immediate confirm button appeared on ${rabbitImmediateBefore.activeStepDom}`);
    }
    if (!rabbitImmediateBefore.tutorial?.stepAllowedCommands?.includes("FINALIZE_EVENT_ROLL")) {
      failures.push("rabbit immediate confirm did not allow FINALIZE_EVENT_ROLL before click");
    }
    if (immediateRejected) {
      failures.push("immediate FINALIZE_EVENT_ROLL was rejected by tutorial_command_blocked");
    }
    if (rabbitImmediateAfter.activeStepDom !== "finish" || rabbitImmediateAfter.core?.pendingDamageAllocation?.playerId !== "0") {
      failures.push("rabbit immediate confirm did not advance to damage allocation");
    }
  }
  if (result.rabbitConfirmAfterReload) {
    const rabbitReloadBefore = result.rabbitConfirmAfterReload.beforeConfirm;
    const rabbitReloadAfter = result.rabbitConfirmAfterReload.afterConfirm;
    const reloadRejected = result.rabbitConfirmAfterReload.logs.some((entry) =>
      entry.text.includes("FINALIZE_EVENT_ROLL") && entry.text.includes("tutorial_command_blocked"),
    );
    if (rabbitReloadBefore.activeStepDom !== "rabbit-foot-result") {
      failures.push(`rabbit confirm after reload started from ${rabbitReloadBefore.activeStepDom}`);
    }
    if (!rabbitReloadBefore.tutorial?.stepAllowedCommands?.includes("FINALIZE_EVENT_ROLL")) {
      failures.push("rabbit-foot-result after reload did not allow FINALIZE_EVENT_ROLL before click");
    }
    if (reloadRejected) {
      failures.push("FINALIZE_EVENT_ROLL after reload was rejected by tutorial_command_blocked");
    }
    if (rabbitReloadAfter.activeStepDom !== "finish" || rabbitReloadAfter.core?.pendingDamageAllocation?.playerId !== "0") {
      failures.push("rabbit confirm after reload did not advance to damage allocation");
    }
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ status: "FAIL", outDir: OUT_DIR, failures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ status: "PASS", outDir: OUT_DIR }, null, 2));
}

main().catch((error) => {
  ensureOutDir();
  writeFileSync(
    join(OUT_DIR, "error.json"),
    JSON.stringify({ message: error.message, stack: error.stack }, null, 2),
  );
  console.error(error);
  process.exit(1);
});
