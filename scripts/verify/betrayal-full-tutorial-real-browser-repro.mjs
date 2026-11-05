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
  "full-tutorial-real-browser-repro",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function compactText(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim().slice(0, 1600) ?? null;
}

function addFailure(failures, message, snapshot) {
  failures.push({
    message,
    activeStepDom: snapshot?.activeStepDom ?? null,
    overlayText: snapshot?.overlay?.text ?? null,
    highlight: snapshot?.highlight ?? null,
    currentPlayer: snapshot?.core?.currentPlayer ?? null,
    phase: snapshot?.core?.phase ?? null,
    pendingCardResolution: snapshot?.core?.pendingCardResolution ?? null,
    pendingEventRollResolution: snapshot?.core?.pendingEventRollResolution ?? null,
    recentRoll: snapshot?.core?.recentRoll ?? null,
  });
}

function assertIncludes(text, expected, failures, message, snapshot) {
  if (!String(text ?? "").includes(expected)) {
    addFailure(failures, message, snapshot);
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
      element?.textContent?.replace(/\s+/g, " ").trim().slice(0, 1600) ?? null;

    const state = window.__BG_TEST_HARNESS__?.state?.get?.();
    const tutorial = state?.sys?.tutorial;
    const pendingCard = state?.core?.pendingCardResolutionQueue?.[0] ?? null;
    const overlayCard = document.querySelector('[data-testid="tutorial-overlay-card"]');
    const tutorialNext = document.querySelector('[data-testid="tutorial-next-button"]');
    const discoveryPanel = document.querySelector('[data-testid="betrayal-discovery-panel"]');
    const discoveryConfirm = document.querySelector('[data-testid="betrayal-discovery-continue"]');
    const rollContinue = document.querySelector('[data-testid="betrayal-roll-continue"]');
    const recentRollPanel = document.querySelector('[data-testid="betrayal-recent-roll-panel"]');
    const scenarioReader = document.querySelector('[data-testid="betrayal-scenario-reader-dialog"]');
    const highlightTarget = tutorial?.step?.highlightTarget ?? null;
    const highlightElement = highlightTarget
      ? document.querySelector(`[data-tutorial-id="${highlightTarget}"]`) ??
        document.getElementById(highlightTarget) ??
        document.querySelector(`[data-testid="${highlightTarget}"]`)
      : null;

    return {
      href: window.location.href,
      bodyText: document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 2200) ?? "",
      boardVisible: isVisible(document.querySelector('[data-testid="betrayal-board"]')),
      characterSelectVisible: isVisible(document.querySelector('[data-testid="betrayal-character-select-screen"]')),
      loadingVisible: isVisible(document.querySelector('[data-testid="loading-screen"]')),
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
      discoveryConfirm: discoveryConfirm
        ? {
            visible: isVisible(discoveryConfirm),
            disabled: discoveryConfirm.disabled === true,
            text: text(discoveryConfirm),
            rect: rectOf(discoveryConfirm),
            pendingCardResolutionId: discoveryConfirm.getAttribute("data-pending-card-resolution-id"),
            cardConfirmed: discoveryConfirm.getAttribute("data-card-resolution-confirmed-count"),
            cardRequired: discoveryConfirm.getAttribute("data-card-resolution-required-count"),
            eventConfirmed: discoveryConfirm.getAttribute("data-event-roll-confirmed-count"),
            eventRequired: discoveryConfirm.getAttribute("data-event-roll-required-count"),
            eventReadable: discoveryConfirm.getAttribute("data-event-roll-readable"),
          }
        : null,
      rollContinue: rollContinue
        ? {
            visible: isVisible(rollContinue),
            disabled: rollContinue.disabled === true,
            text: text(rollContinue),
            rect: rectOf(rollContinue),
            confirmed: rollContinue.getAttribute("data-recent-roll-confirmed-count"),
            required: rollContinue.getAttribute("data-recent-roll-required-count"),
          }
        : null,
      recentRollPanel: recentRollPanel
        ? {
            visible: isVisible(recentRollPanel),
            text: text(recentRollPanel),
            rect: rectOf(recentRollPanel),
          }
        : null,
      scenarioReader: scenarioReader
        ? {
            visible: isVisible(scenarioReader),
            text: text(scenarioReader),
            rect: rectOf(scenarioReader),
          }
        : null,
      tutorial: tutorial
        ? {
            active: tutorial.active ?? null,
            manifestId: tutorial.manifestId ?? null,
            manifestRevision: tutorial.manifestRevision ?? null,
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
      tutorialContext: window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__
        ? { ...window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__ }
        : null,
      core: state?.core
        ? {
            phase: state.core.phase ?? null,
            currentPlayer: state.core.currentPlayer ?? null,
            activePlayerId: state.core.activePlayerId ?? null,
            activeRoomId: state.core.activeRoomId ?? null,
            currentExplorerRoomId: state.core.currentExplorer?.roomId ?? null,
            recommendedAction: state.core.recommendedAction ?? null,
            scenarioRuntime: state.core.scenarioRuntime
              ? {
                  hauntTriggered: state.core.scenarioRuntime.hauntTriggered ?? null,
                  hauntScenarioCardId: state.core.scenarioRuntime.hauntScenarioCardId ?? null,
                  hauntRevealerPlayerId: state.core.scenarioRuntime.hauntRevealerPlayerId ?? null,
                  traitorPlayerId: state.core.scenarioRuntime.traitorPlayerId ?? null,
                  mummyKnowledgeTokenCount: state.core.scenarioRuntime.mummy?.knowledgeTokenCount ?? null,
                  mummyTrueNameFound: state.core.scenarioRuntime.mummy?.trueNameFound ?? null,
                  mummyBanishmentSpellLearned: state.core.scenarioRuntime.mummy?.banishmentSpellLearned ?? null,
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
            pendingDamageAllocation: state.core.pendingDamageAllocation
              ? { playerId: state.core.pendingDamageAllocation.playerId ?? null }
              : null,
            recentRoll: state.core.recentRoll
              ? {
                  id: state.core.recentRoll.id ?? null,
                  kind: state.core.recentRoll.kind ?? null,
                  playerId: state.core.recentRoll.playerId ?? null,
                  dice: state.core.recentRoll.dice ?? null,
                  sourceTitle: state.core.recentRoll.sourceTitle ?? null,
                  label: state.core.recentRoll.label ?? null,
                  latestLabel: state.core.recentRoll.latestLabel ?? null,
                  acknowledgedPlayerIds: state.core.recentRoll.acknowledgedPlayerIds ?? null,
                  requiredPlayerIds: state.core.recentRoll.requiredPlayerIds ?? null,
                }
              : null,
          }
        : null,
    };
  });
}

async function captureCommandBoundary(page, label) {
  return {
    label,
    at: new Date().toISOString(),
    snapshot: await snapshot(page),
  };
}

async function savePoint(page, label, extra = {}) {
  const screenshot = join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  return { label, screenshot, snapshot: await snapshot(page), ...extra };
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

async function clickTutorialNext(page) {
  const next = page.locator('[data-testid="tutorial-next-button"]');
  await next.waitFor({ state: "visible", timeout: 15000 });
  await next.click();
  await sleep(250);
}

async function clickNextUntil(page, stepId, maxClicks = 20) {
  for (let index = 0; index < maxClicks; index += 1) {
    const current = await page.evaluate(
      () => document.querySelector("[data-tutorial-step]")?.getAttribute("data-tutorial-step") ?? null,
    );
    if (current === stepId) return;
    await clickTutorialNext(page);
  }
  const current = await snapshot(page);
  throw new Error(`Cannot reach tutorial step ${stepId}; current=${current.activeStepDom}`);
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

async function waitForEventRollConfirmReadable(page, timeout = 45000) {
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

async function waitForRecentRollConfirmReady(page, timeout = 45000) {
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[data-testid="betrayal-roll-continue"]');
      const rollPanel = document.querySelector('[data-testid="betrayal-recent-roll-panel"]');
      return Boolean(button && rollPanel && !button.hasAttribute("disabled"));
    },
    undefined,
    { timeout },
  );
}

async function playRabbitAndEndTurn(page, result) {
  await waitForStep(page, "objective-and-turn", 300000);
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
  await waitForEventRollConfirmReadable(page);
  result.points.push(await savePoint(page, "00-rabbit-foot-result-confirm"));
  result.boundaries.push(await captureCommandBoundary(page, "before-finalize-event-roll"));
  await page.locator('[data-testid="betrayal-discovery-continue"]').click();
  await sleep(100);
  result.boundaries.push(await captureCommandBoundary(page, "after-finalize-event-roll"));

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
  result.boundaries.push(await captureCommandBoundary(page, "before-end-turn"));
  await page.locator('[data-testid="betrayal-action-endTurn"]').click();
  await sleep(100);
  result.boundaries.push(await captureCommandBoundary(page, "after-end-turn"));
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

async function continueHeroReaderAndFirstObjective(page, result) {
  await waitForStep(page, "haunt-hero-reader", 45000);
  result.points.push(await savePoint(page, "05-hero-reader-opening"));

  await clickTutorialNext(page);
  await waitForStep(page, "haunt-hero-reader-turn-page", 15000);
  result.points.push(await savePoint(page, "06-hero-reader-turn-page"));

  await page.locator('[data-testid="betrayal-scenario-reader-next-zone"]').click();
  await waitForStep(page, "haunt-hero-reader-goal", 15000);
  await page.waitForFunction(
    () => {
      const reader = document.querySelector('[data-testid="betrayal-scenario-reader-dialog"]');
      const text = reader?.textContent ?? "";
      return text.includes("英雄剧本书") && text.includes("真名") && text.includes("图书馆");
    },
    undefined,
    { timeout: 15000 },
  );
  result.points.push(await savePoint(page, "07-hero-reader-goal"));

  await clickTutorialNext(page);
  await waitForStep(page, "haunt-hero-reader-close", 15000);
  result.points.push(await savePoint(page, "08-hero-reader-close"));
  await page.locator('[data-testid="betrayal-scenario-reader-close"]').click();
  await page.locator('[data-testid="betrayal-scenario-reader-dialog"]').waitFor({
    state: "hidden",
    timeout: 15000,
  });

  await waitForStep(page, "open-library-move-after-goal", 45000);
  await page.waitForFunction(
    () => {
      const core = window.__BG_TEST_HARNESS__?.state?.get?.()?.core;
      return core?.currentPlayer === "0" && core?.currentExplorer?.roomId === "upper-landing";
    },
    undefined,
    { timeout: 45000 },
  );
  result.points.push(await savePoint(page, "09-back-to-hero-turn-after-reader"));

  result.points.push(await savePoint(page, "10-open-library-move-action"));
  await page.locator('[data-testid="betrayal-action-move"]').click();

  await waitForStep(page, "move-to-library-after-goal", 15000);
  result.points.push(await savePoint(page, "11-library-target-visible"));
  await page.locator('[data-testid="betrayal-room-upper-west"]').click();
  await waitForNoVisualTransitionBlocker(page);

  await waitForStep(page, "hero-study-name-roll", 15000);
  result.points.push(await savePoint(page, "12-hero-study-name-action"));
  await page.locator('[data-testid="betrayal-action-use"]').click();

  await waitForStep(page, "hero-study-name-result", 45000);
  await page.locator('[data-testid="betrayal-recent-roll-panel"]').waitFor({
    state: "visible",
    timeout: 15000,
  });
  await waitForDiceSettled(page);
  await waitForRecentRollConfirmReady(page);
  result.points.push(await savePoint(page, "13-hero-study-name-result-confirm"));

  await page.locator('[data-testid="betrayal-roll-continue"]').click();
  await waitForStep(page, "hero-study-name-closeout", 15000);
  await page.locator('[data-testid="betrayal-recent-roll-panel"]').waitFor({
    state: "hidden",
    timeout: 15000,
  });
  result.points.push(await savePoint(page, "14-hero-study-name-closeout"));
}

function assertStep(point, stepId, failures) {
  if (point.snapshot.activeStepDom !== stepId) {
    addFailure(failures, `expected ${stepId}, saw ${point.snapshot.activeStepDom}`, point.snapshot);
  }
  if (!point.snapshot.overlay?.visible) {
    addFailure(failures, `tutorial prompt is not visible on ${stepId}`, point.snapshot);
  }
}

function assertTeammateBridgeReturnedToPlayer(point, failures) {
  const snapshotValue = point.snapshot;
  assertStep(point, "move-to-grand-staircase", failures);
  assertIncludes(snapshotValue.overlay?.text, "回到你的回合", failures, "teammate bridge did not resume at the current player's turn", snapshotValue);
  if (snapshotValue.overlay?.text?.includes("队友 1") || snapshotValue.overlay?.text?.includes("队友 2")) {
    addFailure(failures, "teammate automatic actions leaked into the visible tutorial prompt", snapshotValue);
  }
  if (snapshotValue.bodyText?.includes("队友 1 获得指环，作祟仍未开始；轮到队友 2 继续行动。")) {
    addFailure(failures, "removed teammate result copy is still visible in the page", snapshotValue);
  }
  if (snapshotValue.core?.currentPlayer !== "0") {
    addFailure(failures, "teammate bridge did not return control to the current player", snapshotValue);
  }
  if (snapshotValue.core?.pendingCardResolutionQueueLength !== 0) {
    addFailure(failures, "teammate bridge left a card confirmation pending", snapshotValue);
  }
}

function assertHeroReaderOpening(point, failures) {
  const snapshotValue = point.snapshot;
  assertStep(point, "haunt-hero-reader", failures);
  assertIncludes(snapshotValue.overlay?.text, "英雄开场过场", failures, "hero reader prompt did not show the hero opening", snapshotValue);
  if (snapshotValue.overlay?.text?.includes("队友")) {
    addFailure(failures, "teammate automatic action leaked into the hero reader prompt", snapshotValue);
  }
  if (snapshotValue.core?.currentPlayer !== "2") {
    addFailure(failures, "hero reader should appear before player 2 formally ends the handoff turn", snapshotValue);
  }
  if (snapshotValue.core?.pendingCardResolutionQueueLength !== 0) {
    addFailure(failures, "haunt bridge left a card confirmation pending before the hero reader", snapshotValue);
  }
  if (snapshotValue.core?.scenarioRuntime?.hauntTriggered !== true) {
    addFailure(failures, "hero reader appeared before the haunt was marked as triggered", snapshotValue);
  }
}

function assertHeroObjectiveCloseout(point, failures) {
  const snapshotValue = point.snapshot;
  assertStep(point, "hero-study-name-closeout", failures);
  assertIncludes(snapshotValue.overlay?.text, "结果已经落到英雄目标进度上", failures, "closeout prompt does not explain objective progress", snapshotValue);
  if (snapshotValue.core?.currentPlayer !== "0" || snapshotValue.core?.currentExplorerRoomId !== "upper-west") {
    addFailure(failures, "hero closeout is not back on current player in the Library", snapshotValue);
  }
  if (snapshotValue.core?.recentRoll) {
    addFailure(failures, "recent roll panel state was not cleared after confirmation", snapshotValue);
  }
  if (snapshotValue.core?.scenarioRuntime?.mummyKnowledgeTokenCount !== 1 || snapshotValue.core?.scenarioRuntime?.mummyTrueNameFound !== true) {
    addFailure(failures, "study-name result did not persist the first hero objective progress", snapshotValue);
  }
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.BG_REPRO_HEADLESS !== "0" });
  const logs = [];
  const result = {
    targetUrl: TARGET_URL,
    outDir: OUT_DIR,
    points: [],
    boundaries: [],
    logs,
    failures: [],
  };
  let context;
  let page;

  try {
    context = await browser.newContext({
      locale: "zh-CN",
      viewport: { width: 1366, height: 768 },
    });
    await context.addInitScript(() => {
      window.__E2E_TEST_MODE__ = true;
      window.__E2E_SKIP_IMAGE_GATE__ = true;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem("i18nextLng", "zh-CN");
      window.localStorage.setItem("boardgame:audio-muted", "true");
    });
    page = await context.newPage();
    page.on("console", (msg) => {
      logs.push({ at: new Date().toISOString(), type: msg.type(), text: msg.text() });
    });
    page.on("pageerror", (error) => {
      logs.push({ at: new Date().toISOString(), type: "pageerror", text: error.message });
    });
    page.on("requestfailed", (request) => {
      logs.push({
        at: new Date().toISOString(),
        type: "requestfailed",
        text: `${request.url()} ${request.failure()?.errorText ?? ""}`.trim(),
      });
    });

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 90000 });

    await playRabbitAndEndTurn(page, result);
    const teammateBridgePoint = await savePoint(page, "01-after-teammate-omen-bridge-returned");
    result.points.push(teammateBridgePoint);
    assertTeammateBridgeReturnedToPlayer(teammateBridgePoint, result.failures);

    await reachHauntConfirmationAfterDog(page);
    const heroReaderPoint = await savePoint(page, "02-after-hidden-haunt-bridge-hero-reader");
    result.points.push(heroReaderPoint);
    assertHeroReaderOpening(heroReaderPoint, result.failures);

    await continueHeroReaderAndFirstObjective(page, result);
    assertHeroObjectiveCloseout(result.points.at(-1), result.failures);

    const blockedLogs = logs.filter((entry) =>
      entry.text.includes("tutorial_command_blocked") ||
      entry.text.includes('"stage":"command-rejected"') ||
      entry.text.includes("命令执行失败"),
    );
    if (blockedLogs.length > 0) {
      result.failures.push({
        message: "real player flow produced command-rejected/tutorial_command_blocked logs",
        logs: blockedLogs,
      });
    }
    const diceFailureLogs = logs.filter((entry) =>
      entry.text.includes("dice-box-threejs failed") ||
      entry.text.includes("Cannot read properties of undefined (reading 'result')")
    );
    if (diceFailureLogs.length > 0) {
      result.failures.push({
        message: "real player flow produced dice-box-threejs failure logs",
        logs: diceFailureLogs,
      });
    }

    await context.close();
  } catch (error) {
    const failure = {
      message: "real player flow script threw before completing",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      lastPoint: result.points.at(-1)?.label ?? null,
    };
    if (page && !page.isClosed()) {
      const screenshot = join(OUT_DIR, "failure.png");
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
      failure.screenshot = screenshot;
      failure.snapshot = await snapshot(page).catch(() => null);
    }
    result.failures.push(failure);
    await context?.close().catch(() => undefined);
  } finally {
    await browser.close();
    writeFileSync(join(OUT_DIR, "result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({
      status: result.failures.length === 0 ? "PASS" : "FAIL",
      outDir: OUT_DIR,
      targetUrl: TARGET_URL,
      points: result.points.map((point) => ({
        label: point.label,
        screenshot: point.screenshot,
        activeStepDom: point.snapshot.activeStepDom,
        overlayText: point.snapshot.overlay?.text ?? null,
        highlight: point.snapshot.highlight,
        currentPlayer: point.snapshot.core?.currentPlayer ?? null,
        phase: point.snapshot.core?.phase ?? null,
        currentExplorerRoomId: point.snapshot.core?.currentExplorerRoomId ?? null,
        pendingCardResolution: point.snapshot.core?.pendingCardResolution ?? null,
        recentRoll: point.snapshot.core?.recentRoll ?? null,
        mummy: point.snapshot.core?.scenarioRuntime
          ? {
              knowledgeTokenCount: point.snapshot.core.scenarioRuntime.mummyKnowledgeTokenCount,
              trueNameFound: point.snapshot.core.scenarioRuntime.mummyTrueNameFound,
              banishmentSpellLearned: point.snapshot.core.scenarioRuntime.mummyBanishmentSpellLearned,
            }
          : null,
      })),
      boundaries: result.boundaries.map((boundary) => ({
        label: boundary.label,
        at: boundary.at,
        activeStepDom: boundary.snapshot.activeStepDom,
        tutorialContext: boundary.snapshot.tutorialContext,
        engineTutorial: boundary.snapshot.tutorial,
        discoveryConfirm: boundary.snapshot.discoveryConfirm,
        tutorialNext: boundary.snapshot.tutorialNext,
        core: boundary.snapshot.core,
      })),
      failures: result.failures,
    }, null, 2));
    if (result.failures.length > 0) {
      process.exitCode = 1;
    }
  }
}

run().catch((error) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "error.json"),
    JSON.stringify({ message: error.message, stack: error.stack }, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
});
