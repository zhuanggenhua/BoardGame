import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BG_REPRO_URL ?? "http://127.0.0.1:4274";
const TARGET_PATH = "/play/betrayal/tutorial/basic-setup-and-turn";
const TARGET_URL = `${BASE_URL}${TARGET_PATH}`;
const HEADLESS = process.env.BG_REPRO_HEADLESS !== "0";
const SKIP_IMAGE_GATE = process.env.BG_REPRO_SKIP_IMAGE_GATE === "1";
const OUT_DIR = join(
  process.cwd(),
  "artifacts",
  "betrayal-e2e",
  "rabbit-foot-real-browser-repro",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  if (clearStorage) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("i18nextLng", "zh-CN");
      localStorage.setItem("boardgame:audio-muted", "true");
    });
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  }
}

async function waitForBoardOrSelection(page, timeout = 45000) {
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector('[data-testid="betrayal-board"]') ||
          document.querySelector('[data-testid="betrayal-character-select-screen"]'),
      ),
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
            rect: rect(confirmButton),
          }
        : null,
      bodyText: document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 1000) ?? "",
      storage,
    };
  });
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForDirectTutorialEntry(page, 90000);
  await sleep(500);
  const shot = join(OUT_DIR, "stale-character-select-restore.png");
  await page.screenshot({ path: shot, fullPage: true });
  const snap = await snapshot(page);
  diagnostics.write({ snapshot: snap, screenshot: shot });
  await context.close();
  return { ...snap, screenshot: shot };
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
  await waitForStep(page, "view-book");
  await clickNextUntil(page, "use-book", 3);
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
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').click();
  await waitForStep(page, "rabbit-foot-result", 45000);
  await page
    .locator('[data-testid="betrayal-discovery-continue"]')
    .waitFor({ state: "visible", timeout: 45000 });
  const beforeShot = join(OUT_DIR, "rabbit-before-confirm.png");
  await page.screenshot({ path: beforeShot, fullPage: true });
  const before = await snapshot(page);
  await page.locator('[data-testid="betrayal-discovery-continue"]').click();
  await sleep(800);
  const afterShot = join(OUT_DIR, "rabbit-after-confirm.png");
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
  await clickNextUntil(page, "use-book", 3);
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
  await page
    .locator('[data-testid="betrayal-discovery-continue"]')
    .waitFor({ state: "visible", timeout: 45000 });

  const beforeReloadShot = join(OUT_DIR, "rabbit-before-reload.png");
  await page.screenshot({ path: beforeReloadShot, fullPage: true });
  const beforeReload = await snapshot(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  const resumeButton = page.getByRole("button", { name: /从上次继续/ });
  if (await resumeButton.isVisible({ timeout: 15000 }).catch(() => false)) {
    await resumeButton.click();
  }
  await waitForStep(page, "rabbit-foot-result", 90000);
  await page
    .locator('[data-testid="betrayal-discovery-continue"]')
    .waitFor({ state: "visible", timeout: 45000 });
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
    result.directEntry = await runDirectEntry(browser);
    result.staleCharacterSelectRestore = await runStaleCharacterSelectRestore(browser);
    result.rabbitConfirm = await runRabbitConfirm(browser);
    result.rabbitConfirmAfterReload = await runRabbitConfirmAfterReload(browser);
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT_DIR, "result.json"), JSON.stringify(result, null, 2));

  const failures = [];
  if (result.directEntry.hasCharacterSelect) {
    failures.push("direct entry showed character selection");
  }
  if (result.directEntry.hasLoadingScreen) {
    failures.push("direct entry stayed behind loading screen");
  }
  if (!result.directEntry.hasTutorialOverlayCard || result.directEntry.activeStepDom !== "objective-and-turn") {
    failures.push("direct entry did not show an active tutorial overlay");
  }
  if (result.staleCharacterSelectRestore.hasResumePrompt) {
    failures.push("stale character-select snapshot still asked to continue");
  }
  if (result.staleCharacterSelectRestore.hasCharacterSelect) {
    failures.push("stale character-select snapshot restored character selection");
  }
  if (
    !result.staleCharacterSelectRestore.hasTutorialOverlayCard ||
    result.staleCharacterSelectRestore.activeStepDom !== "objective-and-turn"
  ) {
    failures.push("stale character-select snapshot did not restart to tutorial board");
  }
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
  if (rejected) {
    failures.push("FINALIZE_EVENT_ROLL was rejected by tutorial_command_blocked");
  }
  if (rabbitAfter.activeStepDom !== "finish" || rabbitAfter.core?.pendingDamageAllocation?.playerId !== "0") {
    failures.push("rabbit confirm did not advance to damage allocation");
  }
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
