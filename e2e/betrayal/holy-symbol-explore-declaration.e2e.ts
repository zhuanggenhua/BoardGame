import { expect, test, type Page } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import type { BetrayalCore } from "../../src/games/betrayal/game";
import { BETRAYAL_DISCOVERY_POOLS } from "../../src/games/betrayal/scenarioConfig";
import { createStartedFirstScenarioCore } from "../../src/games/betrayal/testing/firstScenarioTestUtils";
import {
  clickDiscoveryBackdropAndExpectStillVisible,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/山屋惊魂-圣符探索前持有物完整链路";
const BEFORE_DECLARE_SCREENSHOT = `${EVIDENCE_DIR}/01-圣符选择前牌桌可操作.jpg`;
const DECLARED_SCREENSHOT = `${EVIDENCE_DIR}/02-圣符探索前持有物已选中.jpg`;
const CANCELED_SCREENSHOT = `${EVIDENCE_DIR}/03-取消圣符选择后回到未选中.jpg`;
const TARGET_SELECTION_SCREENSHOT = `${EVIDENCE_DIR}/04-重新声明后选择未知房间.jpg`;
const SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/05-圣符替换房间并结算事件.jpg`;
const DISMISSED_SCREENSHOT = `${EVIDENCE_DIR}/06-关闭后回牌桌继续可操作.jpg`;

type BetrayalStateReaderWindow = Window & {
  __BG_TEST_HARNESS__?: {
    state?: {
      get?: () => { core: BetrayalCore };
    };
  };
};

async function readCurrentCore(page: Page): Promise<BetrayalCore> {
  return page.evaluate(() => {
    const snapshot = (
      window as BetrayalStateReaderWindow
    ).__BG_TEST_HARNESS__?.state?.get?.();
    if (!snapshot) {
      throw new Error("山屋 E2E 无法读取当前核心状态");
    }
    return snapshot.core;
  });
}

async function dismissDiscoveryPanel(page: Page) {
  const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
  const continueButton = page.getByTestId("betrayal-discovery-continue");
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
    await expect(discoveryPanel).toBeHidden({ timeout: 30000 });
    return;
  }
  await clickDiscoveryBackdropAndExpectStillVisible(page, discoveryPanel);
  await expect(
    continueButton,
    "发现牌浮层必须提供明确继续/确认按钮，不能靠点击空白关闭。",
  ).toBeVisible();
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(discoveryPanel).toBeHidden({ timeout: 30000 });
}

function roomByVisualId(floor: "upper", visualId: string) {
  const room = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor[floor].find(
    (candidate) => candidate.visualId === visualId,
  );
  if (!room) {
    throw new Error(`山屋测试缺少房间模板：${visualId}`);
  }
  return room;
}

function createHolySymbolExploreDeclarationCore(): BetrayalCore {
  const core = createStartedFirstScenarioCore(["0", "1", "2", "3"]);
  core.drawOrder = ["event"];
  core.eventOrder = [
    {
      name: "滑落阶梯",
      text: "脚下阶梯突然松动。失去 1 点速度。",
      effect: {
        mode: "trait",
        trait: "speed",
        amount: -1,
        recommendedAction: "endTurn",
      },
    },
  ];
  core.roomDiscoveryOrderByFloor.upper = [
    roomByVisualId("upper", "gallery"),
    roomByVisualId("upper", "collapsedRoom"),
  ];
  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "upper-landing",
    inventory: [{ id: "holy-symbol", name: "圣符", kind: "omen" }],
  };
  core.activeRoomId = "upper-landing";
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.turnStartInventoryCardIds = ["holy-symbol"];
  core.usedCardIdsThisTurn = [];
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;
  core.recommendedAction = "explore";
  return core;
}

async function readHolySymbolButtonMetrics(page: Page) {
  return page
    .getByTestId("betrayal-explore-option-holy-symbol")
    .evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const style = window.getComputedStyle(button);
      return {
        width: rect.width,
        height: rect.height,
        backgroundColor: style.backgroundColor,
        borderTopStyle: style.borderTopStyle,
        borderTopWidth: style.borderTopWidth,
      };
    });
}

test.describe("山屋惊魂圣符探索前持有物完整链路", () => {
  test("真实页面选择圣符、取消、重新选择、探索并收口", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-holy-symbol-explore-declaration",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", {
      waitUntil: "commit",
      timeout: 30000,
    });
    await page
      .waitForLoadState("domcontentloaded", { timeout: 5000 })
      .catch(() => undefined);
    await waitForBetrayalPageReady(page);

    await injectCore(page, createHolySymbolExploreDeclarationCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByTestId("betrayal-inventory-holy-symbol"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-explore-option-holy-symbol"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await expect(
      page.getByTestId("betrayal-room-upper-north"),
    ).toHaveAccessibleName(/未探索.*(上层|二层).*尚未翻出/);
    const beforeMetrics = await readHolySymbolButtonMetrics(page);
    expect(
      beforeMetrics.height,
      "圣符声明按钮不能继续是 26px 小热区",
    ).toBeGreaterThanOrEqual(34);
    expect(
      beforeMetrics.width,
      "圣符声明按钮必须保留可点击宽度",
    ).toBeGreaterThanOrEqual(38);
    await saveScreenshot(page, BEFORE_DECLARE_SCREENSHOT);

    await page.getByTestId("betrayal-explore-option-holy-symbol").click();
    await expect(
      page.getByTestId("betrayal-explore-option-holy-symbol"),
    ).toHaveClass(/bg-\[rgba\(214,181,109,0\.24\)\]/);
    await saveScreenshot(page, DECLARED_SCREENSHOT);

    await page.getByTestId("betrayal-explore-option-holy-symbol").click();
    await expect(
      page.getByTestId("betrayal-explore-option-holy-symbol"),
    ).not.toHaveClass(/bg-\[rgba\(214,181,109,0\.24\)\]/);
    await saveScreenshot(page, CANCELED_SCREENSHOT);

    await page.getByTestId("betrayal-explore-option-holy-symbol").click();
    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-upper-north"),
    ).toBeVisible();
    await saveScreenshot(page, TARGET_SELECTION_SCREENSHOT);

    await page.getByTestId("betrayal-room-upper-north").click();
    const placementPanel = page.getByTestId("betrayal-room-placement-panel");
    await expect(placementPanel).toBeVisible({ timeout: 30000 });
    await expect(placementPanel).toContainText("长廊");
    await expect(placementPanel).toContainText("已掩埋：倒塌房间");
    await page.getByTestId("betrayal-room-placement-confirm").click();
    await expect(placementPanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 滑落阶梯/,
    );
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "速度 -1",
    );
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("圣符埋葬倒塌房间");
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("继续发现长廊");
    const settledCore = await readCurrentCore(page);
    const discoveredRoom = settledCore.rooms.find(
      (room) => room.id === "upper-north",
    );
    expect(
      discoveredRoom?.name,
      "圣符声明后最终进入牌桌的必须是替换后的房间",
    ).toBe("长廊");
    expect(discoveredRoom?.visualId).toBe("gallery");
    expect(discoveredRoom?.discoveryReward).toBe("event");
    expect(
      discoveredRoom?.endTurnEffect,
      "被圣符埋葬的倒塌房间坠落效果不能落到牌桌",
    ).toBeUndefined();
    expect(settledCore.currentExplorer.traits.speed).toBe(2);
    expect(
      settledCore.currentExplorer.inventory.map((card) => card.id),
    ).toContain("holy-symbol");
    await expect(
      page.getByTestId("betrayal-room-upper-north"),
    ).toHaveAccessibleName(/长廊/);
    await saveScreenshot(page, SETTLED_SCREENSHOT);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("betrayal-inventory-holy-symbol"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-upper-north"),
    ).toHaveAccessibleName(/长廊/);
    await saveScreenshot(page, DISMISSED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-holy-symbol-explore-declaration", diagnostics },
    ]);
  });
});
