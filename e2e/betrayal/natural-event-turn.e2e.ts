import { expect, test, type Page } from "@playwright/test";
import type { BetrayalCore } from "../../src/games/betrayal/game";
import {
  resolveRoomPlacementContext,
  resolveRoomDraw,
  resolveRoomTemplateDiscoveryDeckKind,
  resolveExplorableRoomSlots,
} from "../../src/games/betrayal/roomDiscoveryModel";
import {
  initBetrayalContext,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";

type HarnessWindow = Window & {
  __BG_TEST_HARNESS__?: {
    state?: { get?: () => { core?: BetrayalCore } };
  };
};

async function readCore(page: Page): Promise<BetrayalCore> {
  const core = await page.evaluate(
    () => (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.().core,
  );
  if (!core) throw new Error("Natural Betrayal game core is unavailable");
  return core;
}

function firstEventRoomSlot(core: BetrayalCore): string | null {
  for (const slot of resolveExplorableRoomSlots(core)) {
    const roomDraw = resolveRoomDraw(core, slot.floor, {
      placement: resolveRoomPlacementContext(core, slot),
    });
    if (
      roomDraw.roomTemplate &&
      resolveRoomTemplateDiscoveryDeckKind(roomDraw.roomTemplate) === "event"
    ) {
      return slot.id;
    }
  }
  return null;
}

test("自然开局探索事件后 AI 自主行动并交回真人", async ({ page, context }) => {
  test.setTimeout(180000);
  await initBetrayalContext(context);
  const diagnostics = attachPageDiagnostics(page, "betrayal-natural-event-turn");

  await page.setViewportSize({ width: 1600, height: 900 });
  await warmBetrayalFrontend(context);
  await page.goto(
    "/play/betrayal?players=3&seat0=human&seat1=local-ai&seat2=local-ai&playerID=0",
    { waitUntil: "domcontentloaded" },
  );
  await waitForBetrayalPageReady(page);

  await page.getByTestId("betrayal-character-confirm").click();
  await page.getByTestId("betrayal-character-scenario-button").click();
  await page.getByTestId("betrayal-scenario-option-mummy-rampage").click();
  await page.getByTestId("betrayal-scenario-select-current").click();
  const opening = page.getByTestId("betrayal-start-scenario-opening-stage");
  const confirm = page.getByTestId("betrayal-character-confirm");
  for (const label of [/确认此剧本/, /开始剧本/]) {
    await expect
      .poll(async () =>
        (await opening.isVisible()) ||
        ((await confirm.isVisible()) && (await confirm.isEnabled())),
      )
      .toBe(true);
    if (await opening.isVisible()) break;
    if (label.test((await confirm.textContent()) ?? "")) await confirm.click();
  }
  await expect(opening).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByTestId("betrayal-start-scenario-opening-cinematic"),
  ).toContainText("英雄序章");
  await saveScreenshot(page, "evidence/betrayal-natural-event-turn/01-opening.png");
  await page.getByTestId("betrayal-start-scenario-opening-continue").click();
  await expect(opening).toHaveCount(0);

  const turnIntro = page.getByTestId("betrayal-turn-intro-skip");
  if (await turnIntro.isVisible().catch(() => false)) await turnIntro.click();
  await expect(turnIntro).toHaveCount(0);
  await expect(page.getByTestId("betrayal-board")).toBeVisible({ timeout: 30000 });

  const initialCore = await readCore(page);
  expect(initialCore.currentPlayer).toBe("0");
  const moveTarget = page.getByTestId("betrayal-room-hallway");
  await expect(moveTarget).toBeVisible();
  await moveTarget.click();
  await expect
    .poll(async () => (await readCore(page)).currentExplorer.roomId)
    .toBe("hallway");

  const eventSlotId = firstEventRoomSlot(await readCore(page));
  if (!eventSlotId) {
    throw new Error("No legal event room is reachable from the natural starting board");
  }
  const eventRoom = page.getByTestId(`betrayal-room-${eventSlotId}`);
  await expect(eventRoom).toBeVisible();
  await eventRoom.click();
  const placementPanel = page.getByTestId("betrayal-room-placement-panel");
  await expect(placementPanel).toBeVisible();
  await expect(placementPanel).toContainText("事件");
  await saveScreenshot(page, "evidence/betrayal-natural-event-turn/02-event-room-source.png");

  // Randomness is fixed for reproducibility; the live core and all actions remain natural.
  await setHarnessRandomQueue(page, [0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
  await page.getByTestId("betrayal-room-placement-confirm").click();
  const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
  const eventChoice = page.getByTestId("betrayal-event-choice-panel");
  await expect(discoveryPanel.or(eventChoice)).toBeVisible({ timeout: 30000 });
  if (await discoveryPanel.isVisible().catch(() => false)) {
    await expect(discoveryPanel).toHaveAttribute("aria-label", /事件/);
  } else {
    await expect(eventChoice).toHaveAttribute("aria-label", /.+/);
  }
  await saveScreenshot(page, "evidence/betrayal-natural-event-turn/03-event-revealed.png");

  const eventRollStart = page.getByTestId("betrayal-event-roll-start");
  if (await eventRollStart.isVisible().catch(() => false)) {
    await eventRollStart.click();
    await expect(eventRollStart).toHaveCount(0, { timeout: 30000 });
    await expect(
      page.getByTestId("betrayal-recent-roll-result-stage"),
    ).toBeVisible({ timeout: 30000 });
  }

  for (let step = 0; step < 4; step += 1) {
    if (!(await eventChoice.isVisible().catch(() => false))) break;
    const decline = page.getByTestId("betrayal-event-choice-decline");
    if (await decline.isVisible().catch(() => false)) {
      await decline.click();
    } else {
      const choiceSelectors = [
        'button[data-testid^="betrayal-event-choice-trait-"]',
        'button[data-testid^="betrayal-event-choice-card-"]',
      ];
      let selected = false;
      for (const selector of choiceSelectors) {
        const choices = eventChoice.locator(selector);
        for (let choiceIndex = 0; choiceIndex < (await choices.count()); choiceIndex += 1) {
          const choice = choices.nth(choiceIndex);
          if (await choice.isEnabled().catch(() => false)) {
            await choice.click();
            selected = true;
            break;
          }
        }
        if (selected) break;
      }
      if (!selected) {
        throw new Error("Natural event choice has no enabled UI option to resolve");
      }
    }
    const choiceConfirm = page.getByTestId("betrayal-event-choice-confirm");
    if (await choiceConfirm.isVisible().catch(() => false)) {
      for (let damageStep = 0; damageStep < 4; damageStep += 1) {
        if (await choiceConfirm.isEnabled().catch(() => false)) break;
        const damageIncrements = eventChoice.locator(
          '[data-testid^="betrayal-event-choice-damage-"][data-testid$="-increase"]',
        );
        let assignedDamage = false;
        for (
          let damageIndex = 0;
          damageIndex < (await damageIncrements.count());
          damageIndex += 1
        ) {
          const damageIncrement = damageIncrements.nth(damageIndex);
          if (await damageIncrement.isEnabled().catch(() => false)) {
            await damageIncrement.click();
            assignedDamage = true;
            break;
          }
        }
        if (!assignedDamage) break;
      }
      await expect(choiceConfirm).toBeEnabled();
      await choiceConfirm.click();
    }
  }
  await expect(eventChoice).toHaveCount(0, { timeout: 30000 });

  for (let step = 0; step < 4; step += 1) {
    const continueButton = page.getByTestId("betrayal-discovery-continue");
    if (!(await continueButton.isVisible().catch(() => false))) break;
    if (/返回牌桌/.test((await continueButton.textContent()) ?? "")) break;
    await continueButton.click();
    if (!(await discoveryPanel.isVisible().catch(() => false))) break;
  }
  const returnToBoard = page.getByTestId("betrayal-discovery-continue");
  if (await discoveryPanel.isVisible()) {
    await expect(returnToBoard).toBeVisible({ timeout: 30000 });
    await expect(returnToBoard).toHaveText(/返回牌桌/);
    await expect(returnToBoard).toBeEnabled();
    await returnToBoard.click();
  }
  await expect(discoveryPanel).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByTestId("betrayal-board")).toBeVisible();
  const beforeEndTurn = await readCore(page);
  expect(beforeEndTurn.pendingEventChoice).toBeNull();
  expect(beforeEndTurn.pendingEventRollResolution).toBeNull();
  const endingPlayerId = beforeEndTurn.currentPlayer;
  const endTurn = page.getByTestId("betrayal-action-endTurn");
  await expect(endTurn).toBeVisible();
  await expect(endTurn).toBeEnabled();
  await saveScreenshot(page, "evidence/betrayal-natural-event-turn/04-event-resolved-board.png");
  await endTurn.click();
  await expect
    .poll(async () => (await readCore(page)).currentPlayer, { timeout: 30000 })
    .not.toBe(endingPlayerId);
  const nextTurnCore = await readCore(page);
  expect(nextTurnCore.currentPlayer).not.toBe(beforeEndTurn.currentPlayer);
  await expect(turnIntro).toHaveCount(0);
  await saveScreenshot(page, "evidence/betrayal-natural-event-turn/05-next-turn.png");

  // 记录 AI 探索者的实际位置，防止只凭回合计数增长误认为 AI 已行动。
  const initialAiRooms = Object.fromEntries(
    beforeEndTurn.otherExplorers.map((explorer) => [explorer.playerId, explorer.roomId]),
  );
  await expect.poll(async () => {
    const core = await readCore(page);
    const explorers = [core.currentExplorer, ...core.otherExplorers];
    return explorers.some((explorer) =>
      explorer.playerId !== endingPlayerId && initialAiRooms[explorer.playerId] !== undefined
      && explorer.roomId !== initialAiRooms[explorer.playerId],
    );
  }, { timeout: 60000, message: "至少一名 AI 应自主移动，不能以回合数字代替行动" }).toBe(true);
  // 公共事件投骰结果可能需要真人确认；只能通过可见按钮确认。
  const handoffDeadline = Date.now() + 60000;
  while (Date.now() < handoffDeadline && (await readCore(page)).currentPlayer !== endingPlayerId) {
    const confirm = page.locator('[data-testid="betrayal-roll-continue"]:visible, [data-testid="betrayal-discovery-continue"]:visible')
      .filter({ hasText: /^确认/ });
    if (await confirm.count() && await confirm.first().isEnabled()) {
      await confirm.first().click();
    } else {
      await page.waitForTimeout(250);
    }
  }
  const handoffCore = await readCore(page);
  expect(handoffCore.currentPlayer, JSON.stringify({
    currentPlayer: handoffCore.currentPlayer,
    turnNumber: handoffCore.turnNumber,
    movesRemaining: handoffCore.movesRemaining,
    pendingEventRollStart: handoffCore.pendingEventRollStart,
    recentRoll: handoffCore.recentRoll && {
      kind: handoffCore.recentRoll.kind,
      playerId: handoffCore.recentRoll.playerId,
      sourceTitle: handoffCore.recentRoll.sourceTitle,
      requiredPlayerIds: handoffCore.recentRoll.requiredPlayerIds,
      acknowledgedPlayerIds: handoffCore.recentRoll.acknowledgedPlayerIds,
    },
  })).toBe(endingPlayerId);

  // 回到真人席时展示片头，玩家可以点击横幅外的区域跳过。
  await expect(page.getByTestId("betrayal-turn-intro-title")).toHaveText("你的回合");
  await expect(turnIntro).toHaveCSS("opacity", "1");
  await saveScreenshot(page, "evidence/betrayal-natural-event-turn/06-player-turn-intro.png", { prepare: false, waitMs: 0 });
  await turnIntro.click({ position: { x: 24, y: 24 } });
  await expect(turnIntro).toHaveCount(0);
  await expect(endTurn).toBeEnabled({ timeout: 30000 });
  expect((await readCore(page)).currentPlayer).toBe(endingPlayerId);
  await saveScreenshot(page, "evidence/betrayal-natural-event-turn/07-player-turn-after-skip.png");

  assertNoFatalFrontendErrors([
    { label: "betrayal-natural-event-turn", diagnostics },
  ]);
});
