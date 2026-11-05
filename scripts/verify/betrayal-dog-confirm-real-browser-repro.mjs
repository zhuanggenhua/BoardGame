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

function assertDogBridgeReturnedPoint(snapshot, failures) {
  const overlayText = snapshot?.overlay?.text ?? "";

  if (snapshot?.activeStepDom !== "move-to-grand-staircase") {
    addFailure(failures, "dog bridge did not resume at the current player's next decision", snapshot);
  }
  if (!overlayText.includes("回到你的回合")) {
    addFailure(failures, "dog bridge did not show the current player's resumed turn prompt", snapshot);
  }
  if (overlayText.includes("队友 1") || overlayText.includes("队友 2") || overlayText.includes("狗确认后")) {
    addFailure(failures, "dog or teammate automatic action leaked into visible tutorial copy", snapshot);
  }
  if (snapshot?.bodyText?.includes("队友 1 获得指环，作祟仍未开始；轮到队友 2 继续行动。")) {
    addFailure(failures, "removed teammate result copy is still visible in the page", snapshot);
  }
  if (snapshot?.core?.currentPlayer !== "0") {
    addFailure(failures, "dog bridge did not return control to player 0", snapshot);
  }
  if (snapshot?.core?.pendingCardResolutionQueueLength !== 0) {
    addFailure(failures, "dog bridge left a card confirmation pending", snapshot);
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
  if (overlayText.includes("队友")) {
    addFailure(failures, "teammate automatic action leaked into the hero reader prompt", snapshot);
  }
  if (snapshot?.core?.currentPlayer !== "2") {
    addFailure(failures, "hero reader should appear before player 2 formally ends the handoff turn", snapshot);
  }
  if (snapshot?.core?.pendingCardResolutionQueueLength !== 0) {
    addFailure(failures, "card confirmation queue is still pending after entering the hero reader", snapshot);
  }
  if (snapshot?.core?.scenarioRuntime?.hauntTriggered !== true) {
    addFailure(failures, "hero reader appeared before the haunt was marked as triggered", snapshot);
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
  await waitForStep(page, "move-to-grand-staircase", 45000);
  await page.waitForFunction(
    () => {
      const core = window.__BG_TEST_HARNESS__?.state?.get?.()?.core;
      return core?.currentPlayer === "0" && !core?.pendingCardResolutionQueue?.length;
    },
    undefined,
    { timeout: 45000 },
  );
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
  await waitForStep(page, "move-to-grand-staircase", 45000);
  await page.waitForFunction(
    () => {
      const core = window.__BG_TEST_HARNESS__?.state?.get?.()?.core;
      return core?.currentPlayer === "0" && !core?.pendingCardResolutionQueue?.length;
    },
    undefined,
    { timeout: 45000 },
  );
}

async function reachHauntConfirmationAfterDog(page) {
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

  await waitForStep(page, "haunt-hero-reader", 45000);
  await page.waitForFunction(
    () => {
      const state = window.__BG_TEST_HARNESS__?.state?.get?.();
      const core = state?.core;
      return Boolean(
        core?.currentPlayer === "2" &&
          core?.scenarioRuntime?.hauntTriggered &&
          !core?.pendingCardResolutionQueue?.length,
      );
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
    const bridgeReturnPoint = await savePoint(page, "01-after-dog-hidden-bridge-returned");
    result.points.push(bridgeReturnPoint);
    assertDogBridgeReturnedPoint(bridgeReturnPoint.snapshot, result.failures);

    await reachDogConfirmation(page);
    const dogBridgePoint = await savePoint(page, "02-dog-confirm-stays-hidden");
    result.points.push(dogBridgePoint);
    assertDogBridgeReturnedPoint(dogBridgePoint.snapshot, result.failures);

    if (result.failures.length === 0) {
      await reachHauntConfirmationAfterDog(page);
      const heroReaderPoint = await savePoint(page, "03-hidden-haunt-bridge-hero-reader");
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
