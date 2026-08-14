import { expect, test } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import type {
  BetrayalCore,
  BetrayalInventoryCard,
} from "../../src/games/betrayal/game";
import {
  createRuntimeCore,
  expectEventRollWorkbenchReadable,
  expectPhysicalDiceSeparated,
  expectVisiblePhysicalDiceBox,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  waitForPhysicalDiceSettled,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/山屋惊魂-恐怖玩偶重掷完整链路";
const BEFORE_REROLL_SCREENSHOT = `${EVIDENCE_DIR}/01-恐怖玩偶重掷前最近属性检定可见.jpg`;
const DOLL_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-恐怖玩偶选中后三颗骰子均可重掷.jpg`;
const REROLL_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/03-恐怖玩偶选中骰子等待确认使用.jpg`;
const REROLL_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/04-恐怖玩偶重掷后等待确认最终结果.jpg`;
const REROLL_FINALIZED_SCREENSHOT = `${EVIDENCE_DIR}/05-恐怖玩偶确认最终结果后结算.jpg`;

function createScaryDollRerollCore(): BetrayalCore {
  const core = createRuntimeCore();
  const scaryDoll: BetrayalInventoryCard = {
    id: "scary-doll",
    name: "恐怖玩偶",
    kind: "item",
  };
  const traitsBeforeEvent = { ...core.currentExplorer.traits, knowledge: 3, speed: 4 };

  core.currentExplorer = {
    ...core.currentExplorer,
    traits: traitsBeforeEvent,
    inventory: [scaryDoll],
  };
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [{ ...scaryDoll }];
  core.turnStartInventoryCardIds = ["scary-doll"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = {
    kind: "event",
    title: "外星几何",
    summary: "知识检定失败",
    detail: "知识检定 0：理解外星几何失败，失去 1 点速度；等待确认最终结果",
    tone: "warning",
  };
  core.latestDiscoveryOwnerPlayerId = "0";
  core.recentRoll = {
    id: "scary-doll-reroll-e2e-roll",
    kind: "eventTraitCheck",
    playerId: "0",
    sourceTitle: "外星几何",
    trait: "knowledge",
    rollLabel: "知识检定",
    dice: [0, 0, 0],
    passiveBonus: 0,
    latestLabel: "理解失败，失去 1 点速度",
    consumedRabbitFootCardIds: [],
    branchThresholds: [
      {
        min: 5,
        label: "看懂几何，获得 1 点知识",
        effect: {
          mode: "trait",
          trait: "knowledge",
          amount: 1,
          recommendedAction: "explore",
        },
      },
      {
        min: 0,
        label: "理解失败，失去 1 点速度",
        effect: {
          mode: "trait",
          trait: "speed",
          amount: -1,
          recommendedAction: "endTurn",
        },
      },
    ],
  };
  core.pendingEventRollResolution = {
    rollId: core.recentRoll.id,
    playerId: "0",
    sourceTitle: "外星几何",
    effect: { mode: "trait", trait: "speed", amount: -1, recommendedAction: "endTurn" },
  };

  return core;
}

test.describe("山屋惊魂恐怖玩偶重掷完整链路", () => {
  test("恐怖玩偶从真实牌桌选中后开放全部骰子，点击任一骰子会重掷全部属性检定骰", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-scary-doll-reroll",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createScaryDollRerollCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("betrayal-discovery-panel")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "知识检定 0",
    );
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, {
      minDiceCount: 3,
      minCanvasEdgeMargin: 12,
    });
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-values", "0,0,0");
    await expectEventRollWorkbenchReadable(page, "恐怖玩偶重掷前", {
      expectedEventFrameIndex: "24",
    });
    const scaryDollCard = page.getByTestId("betrayal-inventory-scary-doll");
    await expect(scaryDollCard, "重掷前必须看得到恐怖玩偶本体").toBeVisible();
    await expect(scaryDollCard).toHaveAttribute(
      "data-roll-modifier-available",
      "true",
    );
    await saveScreenshot(page, BEFORE_REROLL_SCREENSHOT);

    await scaryDollCard.click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("恐怖玩偶");
    await expect(scaryDollCard).toHaveAttribute("aria-pressed", "true");

    const rerollDiceLayer = page.getByTestId("betrayal-rabbit-foot-dice");
    await expect(rerollDiceLayer).toBeVisible();
    await expect(page.getByTestId("betrayal-reroll-prompt-outside-dice")).toHaveText(
      /选择要重掷的骰子/,
    );
    await expect(rerollDiceLayer).not.toContainText(/选择要重掷的骰子/);
    await expect(rerollDiceLayer).toHaveAttribute(
      "data-reroll-target-count",
      "3",
    );
    for (const dieIndex of [0, 1, 2]) {
      await expect(
        page.getByTestId(`betrayal-house-dice-reroll-target-${dieIndex}`),
      ).toBeVisible();
    }
    await expectEventRollWorkbenchReadable(page, "恐怖玩偶选中后", {
      expectedEventFrameIndex: "24",
    });
    await saveScreenshot(page, DOLL_SELECTED_SCREENSHOT);

    await setHarnessRandomQueue(page, [0.99, 0.99, 0.99]);
    await page.getByTestId("betrayal-house-dice-reroll-target-1").click({ force: true });
    await expect(page.getByTestId("betrayal-roll-modifier-confirm")).toBeVisible();
    await expectEventRollWorkbenchReadable(page, "恐怖玩偶选中骰子后", {
      expectedEventFrameIndex: "24",
    });
    await saveScreenshot(page, REROLL_SELECTED_SCREENSHOT);
    await page.getByTestId("betrayal-roll-modifier-confirm").click();
    await expect(rerollDiceLayer).toBeHidden();

    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, {
      minDiceCount: 3,
      minCanvasEdgeMargin: 12,
    });
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-values", "2,2,2");
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("使用恐怖玩偶重掷3 颗骰子");
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "知识检定 6",
    );
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "获得 1 点知识",
    );
    await expect(page.getByTestId("betrayal-event-roll-finalize")).toBeVisible();
    await saveScreenshot(page, REROLL_RESULT_SCREENSHOT);

    const finalState = await page.evaluate(() => {
      const harness = (
        window as Window & {
          __BG_TEST_HARNESS__?: {
            state?: {
              get?: () => { core?: BetrayalCore };
            };
          };
        }
      ).__BG_TEST_HARNESS__;
      return harness?.state?.get?.().core ?? null;
    });
    expect(finalState?.recentRoll?.dice).toEqual([2, 2, 2]);
    expect(finalState?.recentRoll?.lastRabbitFootRerollDieIndex).toBeUndefined();
    expect(finalState?.recentRoll?.consumedRabbitFootCardIds).toContain(
      "scary-doll",
    );
    expect(finalState?.usedCardIdsThisTurn).toContain("scary-doll");
    expect(finalState?.currentExplorer.traits.knowledge).toBe(3);
    expect(finalState?.currentExplorer.traits.speed).toBe(4);
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
      "恐怖玩偶重掷后不能残留已选物品",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-rabbit-foot-dice"),
      "恐怖玩偶重掷后选骰层必须清空",
    ).toHaveCount(0);
    await page.getByTestId("betrayal-event-roll-finalize").click();
    const finalizedState = await page.evaluate(() => {
      const harness = (window as Window & { __BG_TEST_HARNESS__?: { state?: { get?: () => { core?: BetrayalCore } } } }).__BG_TEST_HARNESS__;
      return harness?.state?.get?.().core ?? null;
    });
    expect(finalizedState?.pendingEventRollResolution).toBeNull();
    expect(finalizedState?.currentExplorer.traits.knowledge).toBe(4);
    expect(finalizedState?.currentExplorer.traits.speed).toBe(4);
    await saveScreenshot(page, REROLL_FINALIZED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-scary-doll-reroll", diagnostics },
    ]);
  });
});
