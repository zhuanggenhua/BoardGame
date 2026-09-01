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
  expectUnifiedEventRollConfirmButton,
  expectVisiblePhysicalDiceBox,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  waitForPhysicalDiceSettled,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/山屋惊魂-幸运硬币重掷完整链路";
const BEFORE_REROLL_SCREENSHOT = `${EVIDENCE_DIR}/01-幸运硬币重掷前最近属性检定可见.jpg`;
const COIN_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-幸运硬币只允许选择空白骰重掷.jpg`;
const COIN_DIE_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/03-幸运硬币选中空白骰等待确认使用.jpg`;
const BLANK_REROLL_DAMAGE_SCREENSHOT = `${EVIDENCE_DIR}/04-幸运硬币重投仍空白进入精神伤害.jpg`;
const DAMAGE_RESOLVED_SCREENSHOT = `${EVIDENCE_DIR}/05-精神伤害收口后返回牌桌可见.jpg`;
const EVENT_ROLL_FINALIZED_SCREENSHOT = `${EVIDENCE_DIR}/06-返回牌桌后结算事件分支.jpg`;

function createLuckyCoinRerollCore(): BetrayalCore {
  const core = createRuntimeCore();
  const luckyCoin: BetrayalInventoryCard = {
    id: "lucky-coin",
    name: "幸运硬币",
    kind: "item",
  };

  core.currentExplorer = {
    ...core.currentExplorer,
    traits: {
      ...core.currentExplorer.traits,
      speed: 4,
      knowledge: 3,
      sanity: 4,
    },
    inventory: [luckyCoin],
  };
  core.currentExplorer.traitTracks.speed = {
    ...core.currentExplorer.traitTracks.speed,
    values: [1, 3, 4, 5, 6],
    position: 2,
    startPosition: 2,
    criticalPosition: 0,
    skullPosition: -1,
    maxPosition: 4,
  };
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [{ ...luckyCoin }];
  core.turnStartInventoryCardIds = ["lucky-coin"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = {
    kind: "event",
    title: "外星几何",
    summary: "知识检定失败",
    detail: "知识检定 1：理解外星几何失败，失去 1 点速度；等待确认最终结果",
    tone: "warning",
  };
  core.latestDiscoveryOwnerPlayerId = "0";
  core.recentRoll = {
    id: "lucky-coin-reroll-e2e-roll",
    kind: "eventTraitCheck",
    playerId: "0",
    sourceTitle: "外星几何",
    trait: "knowledge",
    rollLabel: "知识检定",
    dice: [0, 1, 0],
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
    effect: {
      mode: "trait",
      trait: "speed",
      amount: -1,
      recommendedAction: "endTurn",
    },
  };

  return core;
}

test.describe("山屋惊魂幸运硬币重掷完整链路", () => {
  test("幸运硬币从真实牌桌选中后只允许选择空白骰，重投仍空白会进入精神伤害分配", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-lucky-coin-reroll",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createLuckyCoinRerollCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("betrayal-discovery-panel")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "知识检定 1",
    );
    await expectUnifiedEventRollConfirmButton(page, "确认 2/3");
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expectEventRollWorkbenchReadable(page, "幸运硬币重掷前", {
      expectedEventFrameIndex: "24",
    });
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, { minDiceCount: 3 });
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-values", "0,1,0");
    const luckyCoinCard = page.getByTestId("betrayal-inventory-lucky-coin");
    await expect(luckyCoinCard, "重掷前必须看得到幸运硬币本体").toBeVisible();
    await expect(luckyCoinCard).toHaveAttribute(
      "data-roll-modifier-available",
      "true",
    );
    await saveScreenshot(page, BEFORE_REROLL_SCREENSHOT);

    await luckyCoinCard.click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("幸运硬币");
    await expect(luckyCoinCard).toHaveAttribute("aria-pressed", "true");

    const rerollDiceLayer = page.getByTestId("betrayal-rabbit-foot-dice");
    await expect(rerollDiceLayer).toBeVisible();
    await expect(page.getByTestId("betrayal-reroll-prompt-outside-dice")).toHaveText(
      /选择要重掷的骰子/,
    );
    await expect(rerollDiceLayer).not.toContainText(/选择要重掷的骰子/);
    await expect(rerollDiceLayer).toHaveAttribute(
      "data-reroll-target-count",
      "2",
    );
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-0"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-0"),
    ).toHaveAttribute("data-reroll-target-shape", "die-face");
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-1"),
      "幸运硬币不能开放非空白骰",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-2"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-2"),
    ).toHaveAttribute("data-reroll-target-shape", "die-face");
    await expectEventRollWorkbenchReadable(page, "幸运硬币选中后", {
      expectedEventFrameIndex: "24",
    });
    await saveScreenshot(page, COIN_SELECTED_SCREENSHOT);

    await setHarnessRandomQueue(page, [0.01, 0.99]);
    await page.getByTestId("betrayal-house-dice-reroll-target-0").click();
    await expect(page.getByTestId("betrayal-roll-modifier-confirm")).toBeVisible();
    await expectEventRollWorkbenchReadable(page, "幸运硬币选中骰子后", {
      expectedEventFrameIndex: "24",
    });
    await saveScreenshot(page, COIN_DIE_SELECTED_SCREENSHOT);
    await page.getByTestId("betrayal-roll-modifier-confirm").click();
    await expect(rerollDiceLayer).toBeHidden();
    await waitForPhysicalDiceSettled(rollPanel);
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-values", "0,1,2");
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("使用幸运硬币重掷");
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("重投后仍有 1 个空白");

    const damagePanel = page.getByTestId("betrayal-damage-allocation-panel");
    await expect(damagePanel).toBeVisible();
    await expect(page.getByTestId("betrayal-damage-allocation-source")).toContainText(
      "幸运硬币",
    );
    await expect(page.getByTestId("betrayal-damage-allocation-amount")).toContainText(
      "1 点精神伤害",
    );
    await expect(page.getByTestId("betrayal-damage-allocation-traits")).toContainText(
      "知识",
    );
    await expect(page.getByTestId("betrayal-damage-allocation-traits")).toContainText(
      "神志",
    );
    await saveScreenshot(page, BLANK_REROLL_DAMAGE_SCREENSHOT);

    const pendingState = await page.evaluate(() => {
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
    expect(pendingState?.recentRoll?.dice).toEqual([0, 1, 2]);
    expect(pendingState?.recentRoll?.consumedRabbitFootCardIds).toContain(
      "lucky-coin",
    );
    expect(pendingState?.usedCardIdsThisTurn).toContain("lucky-coin");
    expect(pendingState?.pendingEventRollResolution).toMatchObject({
      sourceTitle: "外星几何",
      effect: { mode: "trait", trait: "speed", amount: -1 },
    });
    expect(pendingState?.pendingDamageAllocation).toMatchObject({
      sourceTitle: "幸运硬币",
      damageKind: "mental",
      amount: 1,
      allowedTraits: ["knowledge", "sanity"],
      playerId: "0",
    });

    await page
      .getByTestId("betrayal-damage-allocation-trait-sanity-increase")
      .click();
    await expect(
      page.getByTestId("betrayal-damage-allocation-trait-sanity"),
    ).toHaveAttribute("data-damage-selected-count", "1");
    await expect(
      page.getByTestId("betrayal-damage-allocation-trait-sanity-selected-count"),
    ).toHaveText("1");
    await expect(page.getByTestId("betrayal-damage-allocation-confirm")).toBeEnabled();
    await page.getByTestId("betrayal-damage-allocation-confirm").click();
    await expect(damagePanel).toHaveCount(0);

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
    expect(finalState?.pendingDamageAllocation).toBeNull();
    expect(finalState?.pendingEventRollResolution).toMatchObject({
      sourceTitle: "外星几何",
      effect: { mode: "trait", trait: "speed", amount: -1 },
    });
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
      "幸运硬币重掷后不能残留已选物品",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-rabbit-foot-dice"),
      "幸运硬币重掷后选骰层必须清空",
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-roll-finalize")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-roll-waiting")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-discovery-continue")).toHaveText(
      "返回牌桌",
    );
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await saveScreenshot(page, DAMAGE_RESOLVED_SCREENSHOT);

    await page.getByTestId("betrayal-discovery-continue").click();
    const finalizedState = await page.evaluate(() => {
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
    expect(finalizedState?.pendingEventRollResolution).toBeNull();
    expect(finalizedState?.currentExplorer.traits.speed).toBe(
      (finalState?.currentExplorer.traits.speed ?? 0) - 1,
    );
    await expect(page.getByTestId("betrayal-event-roll-finalize")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-discovery-continue")).toHaveCount(0);
    await saveScreenshot(page, EVENT_ROLL_FINALIZED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-lucky-coin-reroll", diagnostics },
    ]);
  });
});
