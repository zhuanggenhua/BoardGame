import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ??= "1";

const BASE_URL = process.env.BG_REPRO_URL ?? "http://127.0.0.1:4274";
const TARGET_PATH = "/play/betrayal/tutorial/basic-setup-and-turn";
const TARGET_URL = `${BASE_URL}${TARGET_PATH}`;
const OUT_DIR = join(
  process.cwd(),
  "artifacts",
  "betrayal-e2e",
  "dog-confirm-real-browser-repro",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function textOf(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim().slice(0, 1200) ?? null;
}

function addFailure(failures, message, snapshot) {
  failures.push({
    message,
    activeStepDom: snapshot?.activeStepDom ?? null,
    overlayText: snapshot?.overlay?.text ?? null,
    highlight: snapshot?.highlight ?? null,
    confirmButton: snapshot?.confirmButton ?? null,
    pendingCardResolution: snapshot?.core?.pendingCardResolution ?? null,
    currentPlayer: snapshot?.core?.currentPlayer ?? null,
  });
}

function assertDogConfirmWaitingPoint(snapshot, failures) {
  const overlayText = snapshot?.overlay?.text ?? "";
  const discoveryText = snapshot?.discoveryPanel?.text ?? "";
  const confirmText = snapshot?.confirmButton?.text ?? "";
  const pending = snapshot?.core?.pendingCardResolution ?? null;
  const highlight = snapshot?.highlight ?? null;

  if (snapshot?.activeStepDom !== "watch-teammate-two-omen-turn") {
    addFailure(failures, "dog confirm point is not on the teammate-two omen tutorial step", snapshot);
  }
  if (!overlayText.includes("翻出狗")) {
    addFailure(failures, "tutorial prompt does not mention Dog being revealed", snapshot);
  }
  if (!overlayText.includes("确认按钮显示等待") || !overlayText.includes("点“下一步”")) {
    addFailure(failures, "tutorial prompt does not explain why the Dog confirmation is waiting or how to proceed", snapshot);
  }
  if (!discoveryText.includes("狗")) {
    addFailure(failures, "foreground discovery panel does not show Dog", snapshot);
  }
  if (pending?.cardName !== "狗" || pending.playerId !== "2") {
    addFailure(failures, "formal pending card confirmation is not teammate 2 confirming Dog", snapshot);
  }
  if (!snapshot?.confirmButton?.visible || !snapshot.confirmButton.disabled || !confirmText.includes("等待确认 0/1")) {
    addFailure(failures, "waiting confirmation button is not visible, disabled, and readable as 0/1", snapshot);
  }
  if (highlight?.target !== "betrayal-discovery-continue" || !highlight.visible) {
    addFailure(failures, "tutorial highlight is not on the visible waiting confirmation button", snapshot);
  }
}

function assertDogConfirmClickAttempt(snapshot, failures) {
  if (snapshot?.activeStepDom !== "watch-teammate-two-omen-turn") {
    addFailure(failures, "clicking the disabled waiting button changed the tutorial step", snapshot);
  }
  if (snapshot?.core?.pendingCardResolution?.cardName !== "狗") {
    addFailure(failures, "clicking the disabled waiting button changed the pending Dog confirmation", snapshot);
  }
}

function assertDogConfirmResolvedPoint(snapshot, failures) {
  const overlayText = snapshot?.overlay?.text ?? "";
  if (snapshot?.activeStepDom !== "teammate-two-omen-results") {
    addFailure(failures, "after Next, tutorial did not advance to the Dog result step", snapshot);
  }
  if (!overlayText.includes("狗确认后") || !overlayText.includes("回合回到你")) {
    addFailure(failures, "result prompt does not say Dog was confirmed and the turn returned", snapshot);
  }
  if (snapshot?.core?.currentPlayer !== "0") {
    addFailure(failures, "after teammate 2 confirms Dog, current player is not back to player 0", snapshot);
  }
  if (snapshot?.core?.pendingCardResolutionQueueLength !== 0) {
    addFailure(failures, "Dog confirmation is still pending after teammate 2 confirmation automation", snapshot);
  }
}

function assertHauntConfirmWaitingPoint(snapshot, failures) {
  const overlayText = snapshot?.overlay?.text ?? "";
  const discoveryText = snapshot?.discoveryPanel?.text ?? "";
  const confirmText = snapshot?.confirmButton?.text ?? "";
  const pending = snapshot?.core?.pendingCardResolution ?? null;
  const highlight = snapshot?.highlight ?? null;

  if (snapshot?.activeStepDom !== "watch-teammate-haunt-trigger") {
    addFailure(failures, "haunt confirm waiting point is not on the visible teammate haunt trigger tutorial step", snapshot);
  }
  if (!overlayText.includes("队友 1") || !overlayText.includes("面具") || !overlayText.includes("等待") || !overlayText.includes("下一步")) {
    addFailure(failures, "tutorial prompt does not explain teammate 1 owns the Mask confirmation and Next will advance it", snapshot);
  }
  if (!discoveryText.includes("面具")) {
    addFailure(failures, "foreground discovery panel does not show Mask at the haunt confirmation point", snapshot);
  }
  if (pending?.cardName !== "面具" || pending.playerId !== "1") {
    addFailure(failures, "formal pending card confirmation is not teammate 1 confirming Mask", snapshot);
  }
  if (!snapshot?.confirmButton?.visible || !snapshot.confirmButton.disabled || !confirmText.includes("等待确认 0/1")) {
    addFailure(failures, "haunt waiting confirmation button is not visible, disabled, and readable as 0/1", snapshot);
  }
  if (highlight?.target !== "betrayal-discovery-continue" || !highlight.visible) {
    addFailure(failures, "tutorial highlight is not on the visible haunt waiting confirmation button", snapshot);
  }
}

function assertHeroReaderPoint(snapshot, failures) {
  const overlayText = snapshot?.overlay?.text ?? "";
  if (snapshot?.activeStepDom !== "haunt-hero-reader") {
    addFailure(failures, "after haunt confirmation, tutorial did not advance to the hero reader step", snapshot);
  }
  if (!overlayText.includes("英雄") || !overlayText.includes("开场")) {
    addFailure(failures, "hero reader prompt is not visible after haunt confirmation", snapshot);
  }
  if (snapshot?.core?.pendingCardResolutionQueueLength !== 0) {
    addFailure(failures, "card confirmation queue is still pending after entering the hero reader", snapshot);
  }
}

async function snapshot(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const rectOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const text = (element) =>
      element?.textContent?.replace(/\s+/g, " ").trim().slice(0, 1200) ?? null;

    const state = window.__BG_TEST_HARNESS__?.state?.get?.();
    const tutorial = state?.sys?.tutorial;
    const pendingCard = state?.core?.pendingCardResolutionQueue?.[0] ?? null;
    const overlayCard = document.querySelector('[data-testid="tutorial-overlay-card"]');
    const tutorialNext = document.querySelector('[data-testid="tutorial-next-button"]');
    const discoveryPanel = document.querySelector('[data-testid="betrayal-discovery-panel"]');
    const confirmButton = document.querySelector('[data-testid="betrayal-discovery-continue"]');
    const highlightTarget = tutorial?.step?.highlightTarget ?? null;
    const highlightElement = highlightTarget
      ? document.querySelector(`[data-tutorial-id="${highlightTarget}"]`) ??
        document.getElementById(highlightTarget) ??
        document.querySelector(`[data-testid="${highlightTarget}"]`)
      : null;

    return {
      href: window.location.href,
      bodyText: document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 1800) ?? "",
      boardVisible: isVisible(document.querySelector('[data-testid="betrayal-board"]')),
      characterSelectVisible: isVisible(document.querySelector('[data-testid="betrayal-character-select-screen"]')),
      scenarioReaderVisible: isVisible(document.querySelector('[data-testid="betrayal-scenario-reader-dialog"]')),
      activeStepDom: document.querySelector("[data-tutorial-step]")?.getAttribute("data-tutorial-step") ?? null,
      overlay: overlayCard
        ? {
            visible: isVisible(overlayCard),
            text: text(overlayCard),
            rect: rectOf(overlayCard),
          }
        : null,
      tutorialNext: tutorialNext
        ? {
            visible: isVisible(tutorialNext),
            disabled: tutorialNext.disabled === true,
            text: text(tutorialNext),
            rect: rectOf(tutorialNext),
          }
        : null,
      highlight: {
        target: highlightTarget,
        found: Boolean(highlightElement),
        visible: isVisible(highlightElement),
        rect: rectOf(highlightElement),
      },
      discoveryPanel: discoveryPanel
        ? {
            visible: isVisible(discoveryPanel),
            text: text(discoveryPanel),
            rect: rectOf(discoveryPanel),
          }
        : null,
      confirmButton: confirmButton
        ? {
            visible: isVisible(confirmButton),
            disabled: confirmButton.disabled === true,
            text: text(confirmButton),
            rect: rectOf(confirmButton),
            pendingCardResolutionId: confirmButton.getAttribute("data-pending-card-resolution-id"),
            pendingCardResolutionStep: confirmButton.getAttribute("data-pending-card-resolution-step"),
            cardConfirmed: confirmButton.getAttribute("data-card-resolution-confirmed-count"),
            cardRequired: confirmButton.getAttribute("data-card-resolution-required-count"),
            eventConfirmed: confirmButton.getAttribute("data-event-roll-confirmed-count"),
            eventRequired: confirmButton.getAttribute("data-event-roll-required-count"),
            eventReadable: confirmButton.getAttribute("data-event-roll-readable"),
          }
        : null,
      tutorial: tutorial
        ? {
            active: tutorial.active ?? null,
            manifestId: tutorial.manifestId ?? null,
            stepIndex: tutorial.stepIndex ?? null,
            stepId: tutorial.step?.id ?? null,
            infoStep: tutorial.step?.infoStep ?? null,
            requireAction: tutorial.step?.requireAction ?? null,
            allowedCommands: tutorial.step?.allowedCommands ?? null,
            aiActions: tutorial.step?.aiActions?.map((action) => ({
              commandType: action.commandType,
              playerId: action.playerId,
              payload: action.payload,
            })) ?? null,
            storedAiActions: tutorial.aiActions?.map((action) => ({
              commandType: action.commandType,
              playerId: action.playerId,
              payload: action.payload,
            })) ?? null,
          }
        : null,
      core: state?.core
        ? {
            phase: state.core.phase ?? null,
            currentPlayer: state.core.currentPlayer ?? null,
            activePlayerId: state.core.activePlayerId ?? null,
            activeRoomId: state.core.activeRoomId ?? null,
            currentExplorerRoomId: state.core.currentExplorer?.roomId ?? null,
            scenarioRuntime: state.core.scenarioRuntime
              ? {
                  hauntTriggered: state.core.scenarioRuntime.hauntTriggered ?? null,
                  hauntScenarioCardId: state.core.scenarioRuntime.hauntScenarioCardId ?? null,
                  hauntRevealerPlayerId: state.core.scenarioRuntime.hauntRevealerPlayerId ?? null,
                  traitorPlayerId: state.core.scenarioRuntime.traitorPlayerId ?? null,
                }
              : null,
            pendingCardResolution: pendingCard
              ? {
                  id: pendingCard.id ?? null,
                  playerId: pendingCard.playerId ?? null,
                  cardId: pendingCard.cardId ?? null,
                  cardName: pendingCard.cardName ?? null,
                  deckKind: pendingCard.deckKind ?? null,
                  requiredPlayerIds: pendingCard.requiredPlayerIds ?? null,
                  acknowledgedPlayerIds: pendingCard.acknowledgedPlayerIds ?? null,
                  index: pendingCard.index ?? null,
                  total: pendingCard.total ?? null,
                }
              : null,
            pendingCardResolutionQueueLength: state.core.pendingCardResolutionQueue?.length ?? 0,
            pendingEventRollResolution: state.core.pendingEventRollResolution
              ? {
                  rollId: state.core.pendingEventRollResolution.rollId ?? null,
                  playerId: state.core.pendingEventRollResolution.playerId ?? null,
                  requiredPlayerIds: state.core.pendingEventRollResolution.requiredPlayerIds ?? null,
                  acknowledgedPlayerIds: state.core.pendingEventRollResolution.acknowledgedPlayerIds ?? null,
                  requiresAcknowledgement: state.core.pendingEventRollResolution.requiresAcknowledgement ?? null,
                }
              : null,
            recentRoll: state.core.recentRoll
              ? {
                  kind: state.core.recentRoll.kind ?? null,
                  playerId: state.core.recentRoll.playerId ?? null,
                  dice: state.core.recentRoll.dice ?? null,
                }
              : null,
          }
        : null,
    };
  });
}

async function savePoint(page, label, extra = {}) {
  const shot = join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  return { label, screenshot: shot, snapshot: await snapshot(page), ...extra };
}

async function waitForStep(page, stepId, timeout = 45000) {
  await page.waitForFunction(
    (expectedStepId) =>
      document.querySelector(`[data-tutorial-step="${expectedStepId}"]`) !== null,
    stepId,
    { timeout },
  );
}

async function waitForAiActionsConsumed(page, stepId, timeout = 60000) {
  await page.waitForFunction(
    (expectedStepId) => {
      const tutorial = window.__BG_TEST_HARNESS__?.state?.get?.()?.sys?.tutorial;
      return Boolean(
        tutorial?.step?.id === expectedStepId &&
          !tutorial.step?.aiActions?.length &&
          !tutorial.aiActions?.length,
      );
    },
    stepId,
    { timeout },
  );
}

async function waitForPersistedTutorialStep(page, stepId, timeout = 30000) {
  await page.waitForFunction(
    (expectedStepId) => {
      const key = Object.keys(localStorage).find((candidate) =>
        candidate.includes("local_match_snapshot_v1:betrayal:tutorial-progress:v1:betrayal:basic-setup-and-turn:r2"),
      );
      if (!key) return false;
      try {
        const payload = JSON.parse(localStorage.getItem(key) ?? "{}");
        return payload?.state?.sys?.tutorial?.step?.id === expectedStepId;
      } catch {
        return false;
      }
    },
    stepId,
    { timeout },
  );
}

async function clickResumePromptIfPresent(page, timeout = 15000) {
  const resumeButton = page.getByRole("button", { name: /从上次继续|Continue/i });
  const visible = await resumeButton
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
  if (visible) {
    await resumeButton.click();
  }
  return visible;
}

async function mutatePersistedDogStepToStaleHighlight(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.includes("local_match_snapshot_v1:betrayal:tutorial-progress:v1:betrayal:basic-setup-and-turn:r2"),
    );
    if (!key) {
      throw new Error("Cannot find persisted betrayal tutorial snapshot");
    }
    const payload = JSON.parse(localStorage.getItem(key) ?? "{}");
    const tutorial = payload?.state?.sys?.tutorial;
    if (!tutorial || tutorial.step?.id !== "watch-teammate-two-omen-turn") {
      throw new Error(`Persisted snapshot is not at Dog confirm step: ${tutorial?.step?.id ?? "missing"}`);
    }
    tutorial.step = {
      ...tutorial.step,
      content: "game-betrayal:tutorial.basicSetup.steps.objectiveAndTurn",
      highlightTarget: "betrayal-stale-dog-confirm-target",
      position: "top",
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return {
      key,
      stepId: tutorial.step.id,
      content: tutorial.step.content,
      highlightTarget: tutorial.step.highlightTarget,
    };
  });
}

async function clickNextUntil(page, stepId, maxClicks = 20) {
  for (let index = 0; index < maxClicks; index += 1) {
    const current = await page.evaluate(
      () => document.querySelector("[data-tutorial-step]")?.getAttribute("data-tutorial-step") ?? null,
    );
    if (current === stepId) return;
    const next = page.locator('[data-testid="tutorial-next-button"]');
    await next.waitFor({ state: "visible", timeout: 10000 });
    await next.click();
    await sleep(250);
  }
  const current = await snapshot(page);
  throw new Error(`Cannot reach tutorial step ${stepId}; current=${current.activeStepDom}`);
}

async function waitForDiceSettled(page, timeout = 120000) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-testid="betrayal-house-dice-physics-source"]')]
        .some((node) => {
          if (node.getAttribute("data-dice-settled") === "true") return true;
          return [...node.querySelectorAll('canvas[data-testid^="betrayal-house-dice-box-canvas-"]')]
            .some((canvas) => canvas.getAttribute("data-dice-visual-settled") === "true");
        }),
    undefined,
    { timeout },
  );
}

async function waitForConfirmReadable(page, timeout = 45000) {
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[data-testid="betrayal-discovery-continue"]');
      return Boolean(
        button &&
          !button.hasAttribute("disabled") &&
          button.getAttribute("data-event-roll-readable") === "true",
      );
    },
    undefined,
    { timeout },
  );
}

async function playRabbitAndEndTurn(page) {
  await waitForStep(page, "objective-and-turn", 90000);
  await clickNextUntil(page, "open-move-targets");
  await page.locator('[data-testid="betrayal-action-move"]').click();
  await waitForStep(page, "move-to-hallway");
  await page.locator('[data-testid="betrayal-room-hallway"]').click();
  await waitForStep(page, "explore-upper");
  await page.locator('[data-testid="betrayal-action-explore"]').click();

  const targetRoom = page.locator('[data-testid^="betrayal-room-explore-target-"]').first();
  await targetRoom.waitFor({ state: "visible", timeout: 15000 });
  const targetRoomTestId = await targetRoom.getAttribute("data-testid");
  const roomId = targetRoomTestId?.replace("betrayal-room-explore-target-", "");
  if (!roomId) throw new Error("Cannot resolve tutorial explore target room");
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
  await clickNextUntil(page, "roll-event", 5);
  await page.locator('[data-testid="betrayal-event-roll-start"]').click();
  await waitForStep(page, "view-book", 90000);
  await waitForDiceSettled(page);
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

  await clickNextUntil(page, "use-book", 5);
  await page.evaluate(() => window.__BG_TEST_HARNESS__?.random?.setQueue?.([0.99, 0, 0, 0, 0, 0]));
  await page.locator('[data-testid="betrayal-inventory-omen-book"]').click();
  await waitForStep(page, "use-rabbit-foot", 90000);
  await page.locator('[data-testid="betrayal-inventory-rope"]').click();
  await page.locator('[data-testid="betrayal-rabbit-foot-dice"]').waitFor({
    state: "visible",
    timeout: 45000,
  });
  const rerollTarget = page.locator('[data-testid^="betrayal-house-dice-reroll-target-"]').first();
  await rerollTarget.waitFor({ state: "visible", timeout: 45000 });
  await rerollTarget.click();
  await page.locator('[data-testid="betrayal-roll-modifier-confirm"]').click();

  await waitForStep(page, "rabbit-foot-result", 90000);
  await waitForDiceSettled(page);
  await waitForConfirmReadable(page);
  await page.locator('[data-testid="betrayal-discovery-continue"]').click();

  await waitForStep(page, "finish", 45000);
  await page.locator('[data-testid="betrayal-damage-allocation-panel"]').waitFor({
    state: "visible",
    timeout: 45000,
  });
  const damageTrait = page
    .locator('[data-testid^="betrayal-damage-allocation-trait-"][data-testid$="-increase"]')
    .first();
  await damageTrait.click();
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[data-testid="betrayal-damage-allocation-confirm"]');
      return Boolean(button && !button.hasAttribute("disabled"));
    },
    undefined,
    { timeout: 10000 },
  );
  await page.locator('[data-testid="betrayal-damage-allocation-confirm"]').click();
  await waitForStep(page, "return-to-table-after-damage", 45000);
  await page.locator('[data-testid="betrayal-action-endTurn"]').click();
  await waitForStep(page, "watch-teammate-one-omen-turn", 45000);
}

async function waitForNoVisualTransitionBlocker(page, timeout = 30000) {
  await page.locator('[data-testid="betrayal-visual-transition-blocker"]').waitFor({
    state: "detached",
    timeout,
  }).catch(async () => {
    await page.locator('[data-testid="betrayal-visual-transition-blocker"]').waitFor({
      state: "hidden",
      timeout: 1000,
    });
  });
}

async function reachDogConfirmation(page) {
  await waitForAiActionsConsumed(page, "watch-teammate-one-omen-turn");
  await page.locator('[data-testid="tutorial-next-button"]').click();
  await waitForStep(page, "teammate-one-omen-results", 45000);
  await waitForAiActionsConsumed(page, "teammate-one-omen-results");
  await page.waitForFunction(
    () => window.__BG_TEST_HARNESS__?.state?.get?.()?.core?.currentPlayer === "2",
    undefined,
    { timeout: 45000 },
  );

  await page.locator('[data-testid="tutorial-next-button"]').click();
  await waitForStep(page, "watch-teammate-two-omen-turn", 45000);
  await waitForAiActionsConsumed(page, "watch-teammate-two-omen-turn");
  await page.waitForFunction(
    () => {
      const state = window.__BG_TEST_HARNESS__?.state?.get?.();
      const dogInPanel = document
        .querySelector('[data-testid="betrayal-discovery-panel"]')
        ?.textContent?.includes("狗");
      const pendingDog = state?.core?.pendingCardResolutionQueue?.[0]?.cardName === "狗";
      return Boolean(dogInPanel || pendingDog);
    },
    undefined,
    { timeout: 45000 },
  );
}

async function reachHauntConfirmationAfterDog(page) {
  await page.locator('[data-testid="tutorial-next-button"]').click();
  await waitForStep(page, "move-to-grand-staircase", 45000);
  await page.locator('[data-testid="betrayal-action-move"]').click();
  for (const roomId of ["hallway", "grand-staircase"]) {
    const room = page.locator(`[data-testid="betrayal-room-${roomId}"]`);
    await room.waitFor({ state: "visible", timeout: 15000 });
    await room.click();
    await waitForNoVisualTransitionBlocker(page);
  }

  await waitForStep(page, "switch-to-upper-floor", 45000);
  await page.locator('[data-testid="betrayal-room-floor-up"]').click();
  await waitForStep(page, "move-to-upper-landing", 45000);
  await page.locator('[data-testid="betrayal-room-upper-landing"]').click();
  await waitForNoVisualTransitionBlocker(page);
  await waitForStep(page, "end-turn-from-upper-landing", 45000);
  await page.locator('[data-testid="betrayal-action-endTurn"]').click();

  await waitForStep(page, "watch-teammate-haunt-trigger", 45000);
  await waitForAiActionsConsumed(page, "watch-teammate-haunt-trigger");
  await page.waitForFunction(
    () => {
      const state = window.__BG_TEST_HARNESS__?.state?.get?.();
      const maskInPanel = document
        .querySelector('[data-testid="betrayal-discovery-panel"]')
        ?.textContent?.includes("面具");
      const pendingMask = state?.core?.pendingCardResolutionQueue?.[0]?.cardName === "面具";
      return Boolean(maskInPanel || pendingMask);
    },
    undefined,
    { timeout: 45000 },
  );
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.BG_REPRO_HEADLESS !== "0" });
  const logs = [];
  const result = {
    targetUrl: TARGET_URL,
    outDir: OUT_DIR,
    points: [],
    logs,
    failures: [],
  };

  try {
    const context = await browser.newContext({
      locale: "zh-CN",
      viewport: { width: 1366, height: 768 },
    });
    await context.addInitScript(() => {
      window.__E2E_TEST_MODE__ = true;
      window.__E2E_SKIP_IMAGE_GATE__ = true;
      window.localStorage.setItem("i18nextLng", "zh-CN");
      window.localStorage.setItem("boardgame:audio-muted", "true");
    });
    const page = await context.newPage();
    page.on("console", (msg) => {
      logs.push({ at: new Date().toISOString(), type: msg.type(), text: msg.text() });
    });
    page.on("pageerror", (error) => {
      logs.push({ at: new Date().toISOString(), type: "pageerror", text: error.message });
    });

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("i18nextLng", "zh-CN");
      localStorage.setItem("boardgame:audio-muted", "true");
    });
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 90000 });

    await playRabbitAndEndTurn(page);
    result.points.push(await savePoint(page, "01-after-player-end-turn"));

    await reachDogConfirmation(page);
    const dogConfirmPoint = await savePoint(page, "02-dog-confirm-before-click");
    result.points.push(dogConfirmPoint);
    assertDogConfirmWaitingPoint(dogConfirmPoint.snapshot, result.failures);

    await waitForPersistedTutorialStep(page, "watch-teammate-two-omen-turn");
    result.staleDogSnapshotMutation = await mutatePersistedDogStepToStaleHighlight(page);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    result.dogResumePromptVisible = await clickResumePromptIfPresent(page);
    await waitForStep(page, "watch-teammate-two-omen-turn", 15000).catch((error) => {
      result.dogResumeWaitError = error instanceof Error ? error.message : String(error);
    });
    await waitForAiActionsConsumed(page, "watch-teammate-two-omen-turn", 15000).catch((error) => {
      result.dogResumeAiWaitError = error instanceof Error ? error.message : String(error);
    });
    const dogConfirmRestoredPoint = await savePoint(page, "03-dog-confirm-after-reload-resume");
    result.points.push(dogConfirmRestoredPoint);
    assertDogConfirmWaitingPoint(dogConfirmRestoredPoint.snapshot, result.failures);

    const button = page.locator('[data-testid="betrayal-discovery-continue"]');
    const buttonVisible = await button.isVisible().catch(() => false);
    const buttonEnabled = buttonVisible ? await button.isEnabled().catch(() => false) : false;
    result.dogButtonBeforeClick = { buttonVisible, buttonEnabled };
    if (buttonVisible) {
      await button.click({ timeout: 5000 }).catch((error) => {
        result.normalClickError = error instanceof Error ? error.message : String(error);
      });
      await sleep(1200);
    }
    const clickAttemptPoint = await savePoint(page, "04-dog-confirm-after-click-attempt");
    result.points.push(clickAttemptPoint);
    assertDogConfirmClickAttempt(clickAttemptPoint.snapshot, result.failures);

    const nextButton = page.locator('[data-testid="tutorial-next-button"]');
    const nextVisible = await nextButton.isVisible().catch(() => false);
    if (nextVisible) {
      await nextButton.click();
      await waitForStep(page, "teammate-two-omen-results", 15000);
      await waitForAiActionsConsumed(page, "teammate-two-omen-results", 15000);
      const dogResolvedPoint = await savePoint(page, "05-after-tutorial-next-from-dog");
      result.points.push(dogResolvedPoint);
      assertDogConfirmResolvedPoint(dogResolvedPoint.snapshot, result.failures);
    } else {
      addFailure(result.failures, "tutorial Next button is not visible from the Dog waiting-confirmation point", await snapshot(page));
    }

    if (result.failures.length === 0) {
      await reachHauntConfirmationAfterDog(page);
      const hauntTriggerPoint = await savePoint(page, "06-after-player-end-turn-mask-revealed");
      result.points.push(hauntTriggerPoint);
      assertHauntConfirmWaitingPoint(hauntTriggerPoint.snapshot, result.failures);

      await page.locator('[data-testid="tutorial-next-button"]').click();
      await waitForStep(page, "haunt-hero-reader", 30000);
      const heroReaderPoint = await savePoint(page, "07-after-mask-confirm-hero-reader");
      result.points.push(heroReaderPoint);
      assertHeroReaderPoint(heroReaderPoint.snapshot, result.failures);
    }

    await context.close();
  } finally {
    await browser.close();
    const rejectedLogs = logs.filter((entry) =>
      entry.text.includes("tutorial_command_blocked") ||
      entry.text.includes("ACKNOWLEDGE_CARD_RESOLUTION") ||
      entry.text.includes("END_TURN"),
    );
    result.rejectedLogs = rejectedLogs;
    writeFileSync(join(OUT_DIR, "result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({
      outDir: OUT_DIR,
      targetUrl: TARGET_URL,
      points: result.points.map((point) => ({
        label: point.label,
        screenshot: point.screenshot,
        activeStepDom: point.snapshot.activeStepDom,
        overlayVisible: point.snapshot.overlay?.visible ?? false,
        overlayText: point.snapshot.overlay?.text ?? null,
        highlight: point.snapshot.highlight,
        confirmButton: point.snapshot.confirmButton,
        core: point.snapshot.core,
        tutorial: point.snapshot.tutorial,
      })),
      dogResumePromptVisible: result.dogResumePromptVisible,
      dogResumeWaitError: result.dogResumeWaitError,
      dogResumeAiWaitError: result.dogResumeAiWaitError,
      staleDogSnapshotMutation: result.staleDogSnapshotMutation,
      dogButtonBeforeClick: result.dogButtonBeforeClick,
      normalClickError: result.normalClickError,
      failures: result.failures,
      rejectedLogs,
    }, null, 2));
    if (result.failures.length > 0) {
      process.exitCode = 1;
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
