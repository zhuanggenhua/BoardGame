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
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/betrayal-inventory-density";
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-高密度持有区-运行时.png`;
const PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-高密度持有区-放大.png`;
const EXTREME_RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-极限持有区-运行时.png`;
const EXTREME_INVENTORY_SECTION_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-极限持有区-局部.png`;
const MOBILE_MAP_PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-手机横屏-地图卡放大完整显示.png`;
const MAP_USE_READY_SCREENSHOT = `${EVIDENCE_DIR}/06-山屋惊魂-地图物品-使用前牌桌可操作.png`;
const MAP_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/07-山屋惊魂-地图物品-地图本体已选中.png`;
const MAP_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/08-山屋惊魂-地图物品-房间牌直选目标.png`;
const MAP_TARGET_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/09-山屋惊魂-地图物品-房间目标已选中.png`;
const MAP_USED_SCREENSHOT = `${EVIDENCE_DIR}/10-山屋惊魂-地图物品-使用后探索者落位.png`;
const MAP_RETURNED_SCREENSHOT = `${EVIDENCE_DIR}/11-山屋惊魂-地图物品-收口后回牌桌.png`;

function createDenseInventoryCore(): BetrayalCore {
  const core = createRuntimeCore();
  const denseInventory: BetrayalInventoryCard[] = [
    { id: "rope", name: "兔脚", kind: "item" },
    { id: "flashlight", name: "手电筒", kind: "item" },
    { id: "medical-kit", name: "急救包", kind: "item" },
    { id: "camera", name: "魔法相机", kind: "item" },
    { id: "lockpick-tool", name: "骨制钥匙", kind: "item" },
    { id: "hunting-knife", name: "砍刀", kind: "item" },
    { id: "omen-book", name: "书本", kind: "omen" },
    { id: "dog", name: "狗", kind: "omen" },
  ];

  core.currentExplorer.inventory = denseInventory.map((card) => ({ ...card }));
  core.currentExplorerInventory = denseInventory.map((card) => ({ ...card }));
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";

  return core;
}

function createExtremeInventoryCore(): BetrayalCore {
  const core = createRuntimeCore();
  const extremeInventory: BetrayalInventoryCard[] = [
    { id: "rope", name: "兔脚", kind: "item" },
    { id: "flashlight", name: "手电筒", kind: "item" },
    { id: "medical-kit", name: "急救包", kind: "item" },
    { id: "camera", name: "魔法相机", kind: "item" },
    { id: "lockpick-tool", name: "骨制钥匙", kind: "item" },
    { id: "hunting-knife", name: "砍刀", kind: "item" },
    { id: "omen-book", name: "书本", kind: "omen" },
    { id: "dog", name: "狗", kind: "omen" },
    { id: "armor", name: "盔甲", kind: "omen" },
    { id: "idol", name: "雕像", kind: "omen" },
  ];

  core.currentExplorer.inventory = extremeInventory.map((card) => ({
    ...card,
  }));
  core.currentExplorerInventory = extremeInventory.map((card) => ({ ...card }));
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";

  return core;
}

function createMapInventoryCore(): BetrayalCore {
  const core = createRuntimeCore();
  const mapInventory: BetrayalInventoryCard[] = [
    { id: "map", name: "地图", kind: "item" },
  ];

  core.currentExplorer.inventory = mapInventory.map((card) => ({ ...card }));
  core.currentExplorerInventory = mapInventory.map((card) => ({ ...card }));
  core.turnStartInventoryCardIds = ["map"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";

  return core;
}

test.describe("山屋惊魂持有区高密度证据", () => {
  test("运行时能承载高密度物品与预兆", async ({ page, context }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-inventory-density",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createDenseInventoryCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    const itemRow = page.getByTestId("betrayal-inventory-row-item");
    const omenRow = page.getByTestId("betrayal-inventory-row-omen");
    await expect(itemRow.getByTestId("betrayal-inventory-rope")).toBeVisible();
    await expect(
      itemRow.getByTestId("betrayal-inventory-hunting-knife"),
    ).toBeVisible();
    await expect(omenRow.getByTestId("betrayal-inventory-dog")).toBeVisible();
    await saveScreenshot(page, RUNTIME_SCREENSHOT);

    const huntingKnifeCard = itemRow.getByTestId(
      "betrayal-inventory-hunting-knife",
    );
    await huntingKnifeCard.scrollIntoViewIfNeeded();
    await huntingKnifeCard.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("砍刀");
    await expect(
      page.getByTestId("betrayal-inventory-preview-overlay"),
    ).toBeVisible();
    await saveScreenshot(page, PREVIEW_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-inventory-density", diagnostics },
    ]);
  });

  test("运行时能承载极限持有区样本", async ({ page, context }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-inventory-density-extreme",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createExtremeInventoryCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    const itemRow = page.getByTestId("betrayal-inventory-row-item");
    const omenRow = page.getByTestId("betrayal-inventory-row-omen");
    await expect(
      itemRow.getByTestId("betrayal-inventory-hunting-knife"),
    ).toBeVisible();
    await expect(omenRow.getByTestId("betrayal-inventory-dog")).toBeVisible();
    await expect(omenRow.getByTestId("betrayal-inventory-idol")).toBeVisible();
    const rowMetrics = await page.evaluate(() => {
      const byId = (id: string) =>
        document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const itemRowEl = byId("betrayal-inventory-row-item");
      const omenRowEl = byId("betrayal-inventory-row-omen");
      const traitsEl = byId("betrayal-current-traits");
      const inventorySectionEl = document.querySelector<HTMLElement>(
        "#betrayal-inventory-section",
      );
      if (!itemRowEl || !omenRowEl) {
        return null;
      }
      const itemRect = itemRowEl.getBoundingClientRect();
      const omenRect = omenRowEl.getBoundingClientRect();
      return {
        itemBottom: itemRect.bottom,
        itemClientWidth: itemRowEl.clientWidth,
        itemScrollWidth: itemRowEl.scrollWidth,
        inventoryWidth: inventorySectionEl?.getBoundingClientRect().width ?? 0,
        omenTop: omenRect.top,
        omenHeight: omenRect.height,
        omenClientWidth: omenRowEl.clientWidth,
        omenScrollWidth: omenRowEl.scrollWidth,
        traitsWidth: traitsEl?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(rowMetrics).not.toBeNull();
    expect(rowMetrics!.omenHeight).toBeGreaterThan(56);
    expect(rowMetrics!.omenTop).toBeGreaterThanOrEqual(
      rowMetrics!.itemBottom - 2,
    );
    expect(rowMetrics!.inventoryWidth).toBeGreaterThan(
      rowMetrics!.traitsWidth + 120,
    );
    expect(rowMetrics!.itemScrollWidth).toBeGreaterThan(
      rowMetrics!.itemClientWidth,
    );
    await saveScreenshot(page, EXTREME_RUNTIME_SCREENSHOT);
    await page
      .locator("#betrayal-inventory-section")
      .screenshot({ path: EXTREME_INVENTORY_SECTION_SCREENSHOT });

    assertNoFatalFrontendErrors([
      { label: "betrayal-inventory-density-extreme", diagnostics },
    ]);
  });

  test("手机横屏地图卡放大完整显示并可点击关闭", async ({ page, context }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-map-card-mobile-preview",
    );

    await page.setViewportSize({ width: 932, height: 430 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createMapInventoryCore());
    await expect(page.getByTestId("betrayal-desktop-layout")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("betrayal-desktop-layout")).toHaveAttribute(
      "data-layout-mode",
      "desktop-board",
    );
    await expect(
      page.getByTestId("betrayal-mobile-landscape-layout"),
    ).toHaveCount(0);

    const mapCard = page.getByTestId("betrayal-inventory-map");
    await expect(mapCard).toBeVisible();
    await mapCard.scrollIntoViewIfNeeded();
    await mapCard.click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("地图");

    await page.getByTestId("betrayal-inventory-map-magnify").click();
    const previewOverlay = page.getByTestId(
      "betrayal-inventory-preview-overlay",
    );
    const previewCard = page.getByTestId("betrayal-inventory-preview-card");
    await expect(previewOverlay).toBeVisible();
    await expect(previewCard).toContainText("地图");

    const previewMetrics = await previewCard.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(previewMetrics.top).toBeGreaterThanOrEqual(0);
    expect(previewMetrics.left).toBeGreaterThanOrEqual(0);
    expect(previewMetrics.right).toBeLessThanOrEqual(
      previewMetrics.viewportWidth,
    );
    expect(previewMetrics.bottom).toBeLessThanOrEqual(
      previewMetrics.viewportHeight,
    );
    expect(previewMetrics.height).toBeGreaterThan(280);
    await saveScreenshot(page, MOBILE_MAP_PREVIEW_SCREENSHOT);

    const blankPoint = await previewOverlay.evaluate((overlay) => {
      const overlayRect = overlay.getBoundingClientRect();
      const previewCard = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-inventory-preview-card"]',
      );
      const cardRect = previewCard?.getBoundingClientRect();
      const candidates = [
        { x: overlayRect.left + 24, y: overlayRect.top + 24 },
        { x: overlayRect.right - 24, y: overlayRect.top + 24 },
        { x: overlayRect.left + 24, y: overlayRect.bottom - 24 },
        { x: overlayRect.right - 24, y: overlayRect.bottom - 24 },
      ];
      return (
        candidates.find(
          (point) =>
            !cardRect ||
            point.x < cardRect.left ||
            point.x > cardRect.right ||
            point.y < cardRect.top ||
            point.y > cardRect.bottom,
        ) ?? { x: overlayRect.left + 8, y: overlayRect.top + 8 }
      );
    });
    await page.mouse.click(blankPoint.x, blankPoint.y);
    await expect(previewOverlay).toBeHidden();

    assertNoFatalFrontendErrors([
      { label: "betrayal-map-card-mobile-preview", diagnostics },
    ]);
  });

  test("地图物品通过房间牌本体选择目标并放置探索者", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-map-card-room-target-flow",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createMapInventoryCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByTestId("betrayal-inventory-map"),
      "使用前必须看得到地图物品本体",
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-action-use"),
      "未选物品前使用按钮应禁用",
    ).toBeDisabled();
    await saveScreenshot(page, MAP_USE_READY_SCREENSHOT);

    await page.getByTestId("betrayal-inventory-map").click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("地图");
    await expect(
      page.getByTestId("betrayal-inventory-target-room-selector"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-action-use"),
      "已选地图但未选目标房间前不能直接使用",
    ).toBeDisabled();
    await saveScreenshot(page, MAP_SELECTED_SCREENSHOT);

    await page.getByTestId("betrayal-room-floor-up").click();
    await expect(
      page.getByTestId(
        "betrayal-room-inventory-target-card-highlight-upper-landing",
      ),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-upper-landing"),
      "地图目标必须走房间牌本体点击路径",
    ).toBeVisible();
    await saveScreenshot(page, MAP_TARGET_SCREENSHOT);

    await page.getByTestId("betrayal-room-upper-landing").click();
    await expect(
      page.getByTestId("betrayal-inventory-target-room-upper-landing"),
    ).toHaveClass(/text-\[#eef4a8\]/);
    await expect(
      page.getByTestId("betrayal-action-use"),
      "地图和目标房间都选中后使用按钮必须可点击",
    ).toBeEnabled();
    await saveScreenshot(page, MAP_TARGET_SELECTED_SCREENSHOT);

    await page.getByTestId("betrayal-action-use").click();
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("地图");
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("上层起始点");
    await expect(
      page.getByTestId("betrayal-room-occupant-upper-landing-0"),
    ).toBeVisible();
    await saveScreenshot(page, MAP_USED_SCREENSHOT);

    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
      "地图结算后不能残留已选物品",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-inventory-target-room-selector"),
      "地图结算后目标选择器必须清空",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-inventory-map"),
      "地图使用后必须从当前持有区消失",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-board"),
      "地图使用后必须回到可操作牌桌",
    ).toBeVisible();
    await saveScreenshot(page, MAP_RETURNED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-map-card-room-target-flow", diagnostics },
    ]);
  });
});
