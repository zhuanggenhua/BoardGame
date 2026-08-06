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

const EVIDENCE_DIR = "evidence/山屋惊魂-幸运硬币重掷完整链路";
const BEFORE_REROLL_SCREENSHOT = `${EVIDENCE_DIR}/01-幸运硬币重掷前最近属性检定可见.jpg`;
const COIN_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-幸运硬币只开放空白骰重掷.jpg`;
const BLANK_REROLL_DAMAGE_SCREENSHOT = `${EVIDENCE_DIR}/03-幸运硬币重投仍空白进入精神伤害.jpg`;
const DAMAGE_RESOLVED_SCREENSHOT = `${EVIDENCE_DIR}/04-幸运硬币精神伤害收口后回牌桌.jpg`;

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
      knowledge: 3,
      sanity: 4,
    },
    inventory: [luckyCoin],
  };
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [{ ...luckyCoin }];
  core.turnStartInventoryCardIds = ["lucky-coin"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = {
    kind: "event",
    title: "幸运硬币属性检定",
    summary: "属性检定空白骰",
    detail: "知识检定 1：属性检定空白骰",
    tone: "warning",
  };
  core.latestDiscoveryOwnerPlayerId = "0";
  core.recentRoll = {
    id: "lucky-coin-reroll-e2e-roll",
    kind: "eventTraitCheck",
    playerId: "0",
    sourceTitle: "幸运硬币属性检定",
    trait: "knowledge",
    rollLabel: "知识检定",
    dice: [0, 1, 0],
    passiveBonus: 0,
    latestLabel: "属性检定空白骰",
    consumedRabbitFootCardIds: [],
  };

  return core;
}

test.describe("山屋惊魂幸运硬币重掷完整链路", () => {
  test("幸运硬币从真实牌桌选中后只开放空白骰，重投仍空白会进入精神伤害分配", async ({
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
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
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
    await expect(rerollDiceLayer).toHaveText(/选择要重掷的骰子/);
    await expect(rerollDiceLayer).toHaveAttribute(
      "data-reroll-target-count",
      "2",
    );
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-0"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-0"),
    ).toHaveAttribute("data-reroll-target-shape", "circle");
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-1"),
      "幸运硬币不能开放非空白骰",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-2"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-house-dice-reroll-target-2"),
    ).toHaveAttribute("data-reroll-target-shape", "circle");
    await saveScreenshot(page, COIN_SELECTED_SCREENSHOT);

    await setHarnessRandomQueue(page, [0.01, 0.99]);
    await page.getByTestId("betrayal-house-dice-reroll-target-0").click();
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
    expect(pendingState?.pendingDamageAllocation).toMatchObject({
      sourceTitle: "幸运硬币",
      damageKind: "mental",
      amount: 1,
      allowedTraits: ["knowledge", "sanity"],
      playerId: "0",
    });

    await page.getByTestId("betrayal-damage-allocation-trait-sanity").click();
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
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
      "幸运硬币重掷后不能残留已选物品",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-rabbit-foot-dice"),
      "幸运硬币重掷后选骰层必须清空",
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await saveScreenshot(page, DAMAGE_RESOLVED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-lucky-coin-reroll", diagnostics },
    ]);
  });
});
