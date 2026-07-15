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

const EVIDENCE_DIR = "evidence/山屋惊魂-兔脚重掷完整链路";
const BEFORE_REROLL_SCREENSHOT = `${EVIDENCE_DIR}/01-兔脚重掷前最近投骰可见.jpg`;
const RABBIT_FOOT_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-兔脚本体已选中.jpg`;
const DIE_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/03-选择具体骰子高亮.jpg`;
const REROLL_RUNNING_SCREENSHOT = `${EVIDENCE_DIR}/04-重掷后骰盘更新.jpg`;
const REROLL_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/05-重掷结算结果可见.jpg`;
const REROLL_CLOSED_SCREENSHOT = `${EVIDENCE_DIR}/06-收口后回牌桌可操作.jpg`;

function createRabbitFootRerollCore(): BetrayalCore {
  const core = createRuntimeCore();
  const rabbitFoot: BetrayalInventoryCard = {
    id: "rope",
    name: "兔脚",
    kind: "item",
  };
  const traitsBeforeEvent = {
    ...core.currentExplorer.traits,
    knowledge: 3,
    speed: 4,
  };

  core.currentExplorer = {
    ...core.currentExplorer,
    traits: {
      ...traitsBeforeEvent,
      speed: 3,
    },
    inventory: [rabbitFoot],
  };
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [{ ...rabbitFoot }];
  core.turnStartInventoryCardIds = ["rope"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = {
    kind: "event",
    title: "外星几何",
    summary: "知识检定失败",
    detail: "知识检定 2：失去 1 点速度；速度 -1",
    tone: "warning",
  };
  core.latestDiscoveryOwnerPlayerId = "0";
  core.recentRoll = {
    id: "rabbit-foot-reroll-e2e-roll",
    kind: "eventTraitCheck",
    playerId: "0",
    sourceTitle: "外星几何",
    trait: "knowledge",
    rollLabel: "知识检定",
    dice: [2, 0, 0],
    passiveBonus: 0,
    latestLabel: "失去 1 点速度",
    eventEffectSnapshot: {
      traitsBeforeEffect: traitsBeforeEvent,
      roomIdBeforeEffect: core.currentExplorer.roomId,
      damageRolls: [],
      drawnCards: [],
    },
    consumedRabbitFootCardIds: [],
    branchThresholds: [
      {
        min: 4,
        label: "获得 1 点知识",
        effect: {
          mode: "trait",
          trait: "knowledge",
          amount: 1,
          recommendedAction: "explore",
        },
      },
      {
        min: 0,
        label: "失去 1 点速度",
        effect: {
          mode: "trait",
          trait: "speed",
          amount: -1,
          recommendedAction: "endTurn",
        },
      },
    ],
  };

  return core;
}

test.describe("山屋惊魂兔脚重掷完整链路", () => {
  test("兔脚从最近投骰点击本体、选择骰子、重掷结算并收口", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-rabbit-foot-reroll",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createRabbitFootRerollCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("betrayal-discovery-panel")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "知识检定 2",
    );
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, { minDiceCount: 3 });
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-values", "2,0,0");
    const rabbitFootCard = page.getByTestId("betrayal-inventory-rope");
    await expect(rabbitFootCard, "重掷前必须看得到兔脚本体").toBeVisible();
    await expect(rabbitFootCard).toHaveAttribute(
      "data-roll-modifier-available",
      "true",
    );
    await saveScreenshot(page, BEFORE_REROLL_SCREENSHOT);

    await rabbitFootCard.click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("兔脚");
    await expect(rabbitFootCard).toHaveAttribute("aria-pressed", "true");
    await saveScreenshot(page, RABBIT_FOOT_SELECTED_SCREENSHOT);

    const rabbitFootDice = page.getByTestId("betrayal-rabbit-foot-dice");
    await expect(rabbitFootDice).toBeVisible();
    await expect(rabbitFootDice).toHaveAttribute(
      "data-reroll-target-count",
      "3",
    );
    await expect(page.getByTestId("betrayal-rabbit-foot-die-1")).toHaveCount(0);
    const rerollTargetDie = page.getByTestId(
      "betrayal-house-dice-reroll-target-1",
    );
    await expect(rerollTargetDie).toBeVisible();
    await expect(rerollTargetDie).toHaveAttribute("role", "button");
    await expect(rerollTargetDie).toHaveAttribute(
      "data-reroll-target-shape",
      "circle",
    );
    const targetBox = await rerollTargetDie.boundingBox();
    expect(
      Math.round(targetBox?.width ?? 0),
      "选骰命中区必须是贴合骰子的正圆，不是旁路数字按钮",
    ).toBe(Math.round(targetBox?.height ?? 0));
    await saveScreenshot(page, DIE_TARGET_SCREENSHOT);

    await setHarnessRandomQueue(page, [0.99]);
    await rerollTargetDie.click();
    await expect(rabbitFootDice).toBeHidden();
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rerolling-die-index", "1");
    await saveScreenshot(page, REROLL_RUNNING_SCREENSHOT);

    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, { minDiceCount: 3 });
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-values", "2,2,0");
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("使用兔脚重掷第 2 颗骰子");
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "知识检定 4",
    );
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "获得 1 点知识",
    );
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
    expect(finalState?.recentRoll?.dice).toEqual([2, 2, 0]);
    expect(finalState?.recentRoll?.lastRabbitFootRerollDieIndex).toBe(1);
    expect(finalState?.recentRoll?.consumedRabbitFootCardIds).toContain("rope");
    expect(finalState?.usedCardIdsThisTurn).toContain("rope");
    expect(finalState?.currentExplorer.traits.knowledge).toBe(4);
    expect(finalState?.currentExplorer.traits.speed).toBe(4);
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
      "兔脚重掷后不能残留已选物品",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-rabbit-foot-dice"),
      "兔脚重掷后选骰层必须清空",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-board"),
      "兔脚重掷后必须回到可操作牌桌",
    ).toBeVisible();
    await saveScreenshot(page, REROLL_CLOSED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-rabbit-foot-reroll", diagnostics },
    ]);
  });
});
