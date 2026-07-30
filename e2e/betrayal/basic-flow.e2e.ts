import { expect, test } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";
import { createStartedFirstScenarioCore } from "../../src/games/betrayal/testing/firstScenarioTestUtils";

const EVIDENCE_DIR = "evidence/betrayal-basic-flow";
const CHARACTER_CONFIRM_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-基本流程-角色确认前.png`;
const CHARACTER_DETAIL_SCROLLED_SCREENSHOT = `${EVIDENCE_DIR}/01b-山屋惊魂-角色详情滚动后看到特性.png`;
const SCENARIO_SELECT_ENTRY_SCREENSHOT = `${EVIDENCE_DIR}/02a-山屋惊魂-基本流程-剧本弹窗入口.png`;
const SCENARIO_SELECT_DETAIL_SCREENSHOT = `${EVIDENCE_DIR}/02b-山屋惊魂-基本流程-书本式剧本阅读首页.png`;
const SCENARIO_SELECT_DETAIL_TURNING_SCREENSHOT = `${EVIDENCE_DIR}/02c-山屋惊魂-基本流程-书本式剧本翻页中.png`;
const SCENARIO_SELECT_DETAIL_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/02d-山屋惊魂-基本流程-书本式剧本阅读末页.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-基本流程-运行时.png`;
const INVENTORY_PREVIEW_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-基本流程-持有物放大.png`;
const USE_ITEM_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-基本流程-使用物品.png`;
const MOVE_MODE_SCREENSHOT = `${EVIDENCE_DIR}/06-山屋惊魂-基本流程-移动选目标.png`;
const MOVE_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/07-山屋惊魂-基本流程-移动后.png`;
const MOVE_CONTINUED_SCREENSHOT = `${EVIDENCE_DIR}/07b-山屋惊魂-基本流程-不取消连续移动到大阶梯.png`;
const DIRECT_MOVE_MODE_SCREENSHOT = `${EVIDENCE_DIR}/07c-山屋惊魂-运行时-移动模式选择门厅.png`;
const DIRECT_MOVE_AFTER_FIRST_ROOM_SCREENSHOT = `${EVIDENCE_DIR}/07d-山屋惊魂-运行时-移动后仍可继续选择大阶梯.png`;
const DIRECT_MOVE_CHAIN_SCREENSHOT = `${EVIDENCE_DIR}/07e-山屋惊魂-运行时-不取消连续移动完成.png`;
const MOBILE_CHARACTER_SCREENSHOT = `${EVIDENCE_DIR}/08-山屋惊魂-移动端横屏-角色竖向滚动选中与能力提示.jpg`;
const MOBILE_SCENARIO_ENTRY_SCREENSHOT = `${EVIDENCE_DIR}/09a-山屋惊魂-移动端横屏-剧本弹窗入口.png`;
const MOBILE_SCENARIO_DETAIL_SCREENSHOT = `${EVIDENCE_DIR}/09b-山屋惊魂-移动端横屏-书本式剧本阅读首页.png`;
const MOBILE_SCENARIO_DETAIL_TURNING_SCREENSHOT = `${EVIDENCE_DIR}/09c-山屋惊魂-移动端横屏-书本式剧本翻页中.png`;
const MOBILE_SCENARIO_DETAIL_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/09d-山屋惊魂-移动端横屏-书本式剧本阅读末页.png`;
const MOBILE_SCENARIO_CLOSED_SCREENSHOT = `${EVIDENCE_DIR}/09e-山屋惊魂-移动端横屏-关闭剧本回选择页.png`;
const TOKEN_DETAIL_PANEL_SCREENSHOT = `${EVIDENCE_DIR}/10-山屋惊魂-队友面板详情不切视角.png`;
const TOKEN_DETAIL_MAP_SCREENSHOT = `${EVIDENCE_DIR}/11-山屋惊魂-地图token详情图像一致.png`;
const TURN_HANDOFF_NO_FOLLOW_SCREENSHOT = `${EVIDENCE_DIR}/12-山屋惊魂-换行动者不自动跟踪视角.png`;

test.describe("山屋惊魂基本流程", () => {
  test("桌面低高视口角色详情必须能滚动到特性", async ({ page, context }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-character-detail-scroll-target",
    );

    await page.setViewportSize({ width: 1280, height: 620 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await expect(
      page.getByTestId("betrayal-character-select-screen"),
    ).toBeVisible({ timeout: 30000 });
    const characterDetailScroll = page.getByTestId(
      "betrayal-character-detail-scroll",
    );
    const abilitySummary = page.getByTestId(
      "betrayal-character-ability-summary",
    );
    await expect(characterDetailScroll).toBeVisible();
    const scrollMetrics = await characterDetailScroll.evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    }));
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(
      scrollMetrics.clientHeight + 20,
    );
    expect(scrollMetrics.scrollTop).toBe(0);

    await characterDetailScroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect
      .poll(async () =>
        characterDetailScroll.evaluate((node) => node.scrollTop),
      )
      .toBeGreaterThan(0);
    await expect(abilitySummary).toBeInViewport();
    await expect(abilitySummary).toContainText("特性");
    await expect(abilitySummary).toContainText(/大胆|攻击投掷/);
    await saveScreenshot(page, CHARACTER_DETAIL_SCROLLED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-character-detail-scroll-target", diagnostics },
    ]);
  });

  test("从角色选择确认到恶兆前运行时", async ({ page, context }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, "betrayal-basic-flow");

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await expect(
      page.getByTestId("betrayal-character-select-screen"),
    ).toBeVisible({ timeout: 30000 });
    const characterDetailScroll = page.getByTestId(
      "betrayal-character-detail-scroll",
    );
    await expect(characterDetailScroll).toHaveClass(/overflow-y-auto/);
    await expect(characterDetailScroll).toHaveClass(/overflow-x-hidden/);
    await expect(page.getByTestId("betrayal-character-confirm")).toHaveText(
      /确认/,
    );
    await saveScreenshot(page, CHARACTER_CONFIRM_SCREENSHOT);

    await page.getByTestId("betrayal-character-confirm").click();
    await expect(page.getByTestId("betrayal-character-confirm")).toHaveText(
      /确认此剧本卡/,
    );
    await expect(
      page.getByTestId("betrayal-character-scenario-button"),
    ).toContainText("木乃伊横行");
    await page.getByTestId("betrayal-character-scenario-button").click();
    await expect(
      page.getByTestId("betrayal-scenario-select-dialog"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-scenario-candidate-list").locator("button"),
    ).toHaveCount(7);
    await expect(
      page.getByTestId("betrayal-scenario-option-mummy-rampage"),
    ).toContainText("木乃伊横行");
    await expect(
      page.getByTestId("betrayal-scenario-option-crimson-jack-returns"),
    ).toContainText("待接入");
    await expect(
      page.getByTestId("betrayal-scenario-option-friends-forever"),
    ).toContainText("待接入");
    await expect(
      page.getByTestId("betrayal-scenario-detail-toggle"),
    ).toContainText("阅读完整剧本");
    await saveScreenshot(page, SCENARIO_SELECT_ENTRY_SCREENSHOT);
    await page.getByTestId("betrayal-scenario-detail-toggle").click();
    const scenarioReaderDialog = page.getByTestId(
      "betrayal-scenario-reader-dialog",
    );
    await expect(scenarioReaderDialog).toBeVisible();
    await expect(
      page.getByTestId("betrayal-scenario-detail-panel"),
    ).not.toContainText("作祟档案");
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-opening-stage"),
    ).toBeVisible();
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-opening-cinematic"),
    ).toContainText("木乃伊横行");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-opening-source-status",
      ),
    ).toContainText("本地规则源正文");
    const scenarioReaderNextZone = scenarioReaderDialog.getByTestId(
      "betrayal-scenario-reader-next-zone",
    );
    await expect(scenarioReaderNextZone).toBeEnabled();
    await scenarioReaderNextZone.click();
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book"),
    ).toBeVisible();
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-1",
      ),
    ).toContainText("敌方情报 / 胜利条件");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-1",
      ),
    ).toContainText("驱逐木乃伊");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("他们妄图将木乃伊驱逐回亡者之国");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("木乃伊 / 战斗要诀");
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-setup"),
    ).toHaveCount(0);
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-reader-page-label-desktop-left",
      ),
    ).toHaveText("01");
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-reader-prev-zone"),
    ).toBeEnabled();
    await expect(scenarioReaderNextZone).toBeEnabled();
    await expect(
      scenarioReaderDialog.getByRole("button", { name: "上一页" }),
    ).toHaveClass(/bg-transparent/);
    await expect(
      scenarioReaderDialog.getByRole("button", { name: "下一页" }),
    ).toHaveClass(/bg-transparent/);
    await saveScreenshot(page, SCENARIO_SELECT_DETAIL_SCREENSHOT);
    await scenarioReaderNextZone.click();
    const turningSheet = scenarioReaderDialog.getByTestId(
      "betrayal-scenario-book-turning-sheet",
    );
    await expect(turningSheet).toBeVisible();
    await expect(turningSheet).toHaveAttribute(
      "data-turn-direction",
      "forward",
    );
    await saveScreenshot(page, SCENARIO_SELECT_DETAIL_TURNING_SCREENSHOT);
    await expect(turningSheet).toHaveCount(0, { timeout: 2000 });
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-reader-page-label-desktop-left",
      ),
    ).toHaveText("03");
    await expect(scenarioReaderNextZone).toBeDisabled();
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-3",
      ),
    ).toContainText("你合上书本后");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-4",
      ),
    ).toContainText("小女孩瑟缩于角落");
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-endingHeroes"),
    ).toContainText("结局");
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-endingTraitor"),
    ).toContainText("结局");
    await saveScreenshot(page, SCENARIO_SELECT_DETAIL_BOTTOM_SCREENSHOT);
    await page.waitForTimeout(400);
    await page.mouse.click(12, 12);
    await expect(
      page.getByTestId("betrayal-scenario-reader-dialog"),
    ).toBeHidden();
    const scenarioSelectDialog = page.getByTestId(
      "betrayal-scenario-select-dialog",
    );
    const scenarioSelectStillOpen = await scenarioSelectDialog
      .isVisible({ timeout: 800 })
      .catch(() => false);
    if (scenarioSelectStillOpen) {
      await Promise.race([
        scenarioSelectDialog
          .waitFor({ state: "hidden", timeout: 3000 })
          .catch(() => null),
        page
          .getByTestId("betrayal-scenario-select-current")
          .click({ timeout: 3000 })
          .catch(() => null),
      ]);
      await expect(scenarioSelectDialog).toBeHidden({ timeout: 5000 });
    }
    const boardOrConfirm = await Promise.race([
      page
        .getByTestId("betrayal-board")
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => "board" as const)
        .catch(() => null),
      page
        .getByTestId("betrayal-character-confirm")
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => "confirm" as const)
        .catch(() => null),
    ]);
    if (boardOrConfirm === "confirm") {
      await page.getByTestId("betrayal-character-confirm").click();
    }

    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("betrayal-room-grid")).toBeVisible();
    await expect(page.getByTestId("betrayal-action-explore")).toBeVisible();
    await expect(page.getByTestId("betrayal-open-scenario")).toBeVisible();
    await expect(page.getByTestId("betrayal-current-ability")).toBeVisible();
    await expect(page.getByTestId("betrayal-current-ability")).toContainText(
      "特性",
    );
    await saveScreenshot(page, RUNTIME_SCREENSHOT);

    await page.getByTestId("betrayal-inventory-omen-book-magnify").click();
    await expect(
      page.getByTestId("betrayal-inventory-preview-overlay"),
    ).toBeVisible();
    await saveScreenshot(page, INVENTORY_PREVIEW_SCREENSHOT);
    await page.mouse.click(24, 24);
    await expect(
      page.getByTestId("betrayal-inventory-preview-overlay"),
    ).toBeHidden();
    await page.getByTestId("betrayal-inventory-omen-book").click();
    await expect(page.getByTestId("betrayal-action-use")).toBeEnabled();
    await page.getByTestId("betrayal-action-use").click();
    await expect(page.getByTestId("betrayal-use-status")).toContainText(
      "本回合已用",
    );
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("书本");
    await expect(page.getByTestId("betrayal-action-use")).toBeDisabled();
    await saveScreenshot(page, USE_ITEM_SCREENSHOT);

    await page.getByTestId("betrayal-action-move").click();
    await expect(page.getByTestId("betrayal-action-move")).toContainText(
      "取消移动",
    );
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await expect(page.getByTestId("betrayal-room-hallway")).toBeEnabled();
    await saveScreenshot(page, MOVE_MODE_SCREENSHOT);
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("移动到门厅");
    await saveScreenshot(page, MOVE_RESULT_SCREENSHOT);
    await expect(page.getByTestId("betrayal-action-move")).toContainText(
      "取消移动",
    );
    await expect(
      page.getByTestId("betrayal-room-grand-staircase"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-grand-staircase"),
    ).toBeEnabled();
    await page.getByTestId("betrayal-room-grand-staircase").click();
    await expect(
      page.getByTestId("betrayal-room-occupant-grand-staircase-0"),
    ).toBeVisible();
    await saveScreenshot(page, MOVE_CONTINUED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-basic-flow", diagnostics },
    ]);
  });

  test("运行时移动后不点取消也能连续移动到第二个房间", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-continuous-move-without-cancel",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal?seat1=human&seat2=human&seat3=human", {
      waitUntil: "domcontentloaded",
    });
    await waitForBetrayalPageReady(page);
    await injectCore(page, createStartedFirstScenarioCore(["0", "1", "2"]));
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByTestId("betrayal-room-occupant-entrance-hall-0"),
    ).toBeVisible();

    await page.getByTestId("betrayal-action-move").click();
    await expect(page.getByTestId("betrayal-action-move")).toContainText(
      "取消移动",
    );
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await expect(page.getByTestId("betrayal-room-hallway")).toBeEnabled();
    await saveScreenshot(page, DIRECT_MOVE_MODE_SCREENSHOT);

    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-occupant-hallway-0"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-action-move")).toContainText(
      "取消移动",
    );
    await expect(
      page.getByTestId("betrayal-room-grand-staircase"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-grand-staircase"),
    ).toBeEnabled();
    await saveScreenshot(page, DIRECT_MOVE_AFTER_FIRST_ROOM_SCREENSHOT);

    await page.getByTestId("betrayal-room-grand-staircase").click();
    await expect(
      page.getByTestId("betrayal-room-occupant-grand-staircase-0"),
    ).toBeVisible();
    await saveScreenshot(page, DIRECT_MOVE_CHAIN_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-continuous-move-without-cancel", diagnostics },
    ]);
  });

  test("移动端横屏角色选择包含竖向滚动、选中态和能力提示", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-basic-flow-mobile-character-select",
    );

    await page.setViewportSize({ width: 896, height: 414 });
    await warmBetrayalFrontend(context);
    await page.goto(
      "/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=0&bgForceCoarsePointer=1",
      {
        waitUntil: "domcontentloaded",
      },
    );
    await waitForBetrayalPageReady(page);

    await expect(
      page.getByTestId("betrayal-character-select-screen"),
    ).toBeVisible({ timeout: 30000 });
    const mobileGrid = page.getByTestId("betrayal-character-mobile-grid");
    await expect(mobileGrid).toBeVisible();
    await expect(mobileGrid).toHaveClass(/grid-cols-3/);
    await expect(
      mobileGrid.getByTestId("betrayal-character-card-jaden-jones"),
    ).toBeVisible();
    await expect(
      mobileGrid.getByTestId("betrayal-character-card-jaden-jones"),
    ).toHaveAttribute("aria-label", /已选择/);
    for (const explorerId of [
      "jaden-jones",
      "rebecca-allen",
      "darryl-highla",
      "oliver-swift",
      "lia-valencia",
      "sam-yin",
    ]) {
      await expect(
        mobileGrid.getByTestId(`betrayal-character-card-${explorerId}`),
      ).toBeInViewport();
    }
    await expect(
      page.getByTestId("betrayal-character-mobile-page-label"),
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-character-page-down")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-character-page-up")).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-character-selection-grid"),
    ).toBeHidden();

    await expect(
      page.getByTestId("betrayal-character-ability-summary"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-character-ability-summary"),
    ).toContainText("特性");
    await expect(
      page.getByTestId("betrayal-character-ability-summary"),
    ).toContainText(/大胆|攻击投掷/);
    await expect(
      page.getByTestId("betrayal-character-ability-summary"),
    ).not.toContainText(/Bold|Attack/i);
    await expect(
      page.getByTestId("betrayal-character-ability-trigger"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-character-ability-tooltip"),
    ).toHaveCount(0);
    await saveScreenshot(page, MOBILE_CHARACTER_SCREENSHOT);

    await page.getByTestId("betrayal-character-confirm").click();
    await expect(page.getByTestId("betrayal-character-confirm")).toHaveText(
      /确认此剧本卡/,
    );
    await expect(
      page.getByTestId("betrayal-character-scenario-button"),
    ).toContainText("木乃伊横行");
    await page.getByTestId("betrayal-character-scenario-button").click();
    await expect(
      page.getByTestId("betrayal-scenario-select-dialog"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-scenario-candidate-list").locator("button"),
    ).toHaveCount(7);
    await expect(
      page.getByTestId("betrayal-scenario-option-mummy-rampage"),
    ).toContainText("木乃伊横行");
    await expect(
      page.getByTestId("betrayal-scenario-option-crimson-jack-returns"),
    ).toContainText("待接入");
    await expect(
      page.getByTestId("betrayal-scenario-detail-toggle"),
    ).toContainText("阅读完整剧本");
    for (const [label, target] of [
      ["阅读完整剧本", page.getByTestId("betrayal-scenario-detail-toggle")],
      ["确认此剧本卡", page.getByTestId("betrayal-scenario-select-current")],
      ["关闭剧本选择", page.getByTestId("betrayal-scenario-dialog-close")],
    ] as const) {
      const box = await target.boundingBox();
      expect(box, `${label}必须有真实触控热区`).not.toBeNull();
      expect(
        box?.height ?? 0,
        `${label}触控高度不能小于44px`,
      ).toBeGreaterThanOrEqual(44);
    }
    await saveScreenshot(page, MOBILE_SCENARIO_ENTRY_SCREENSHOT);
    await page.getByTestId("betrayal-scenario-detail-toggle").click();
    const mobileScenarioReaderDialog = page.getByTestId(
      "betrayal-scenario-reader-dialog",
    );
    await expect(mobileScenarioReaderDialog).toBeVisible();
    await expect(
      page.getByTestId("betrayal-scenario-detail-panel"),
    ).not.toContainText("作祟档案");
    await expect(
      mobileScenarioReaderDialog.getByTestId("betrayal-scenario-opening-stage"),
    ).toBeVisible();
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-opening-cinematic",
      ),
    ).toContainText("木乃伊横行");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-opening-source-status",
      ),
    ).toContainText("本地规则源正文");
    await mobileScenarioReaderDialog
      .getByTestId("betrayal-scenario-reader-next-zone")
      .click();
    await expect(
      mobileScenarioReaderDialog.getByTestId("betrayal-scenario-book"),
    ).toBeVisible();
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-1",
      ),
    ).toContainText("敌方情报 / 胜利条件");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-1",
      ),
    ).toContainText("驱逐木乃伊");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("他们妄图将木乃伊驱逐回亡者之国");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("木乃伊 / 战斗要诀");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-section-setup",
      ),
    ).toHaveCount(0);
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-reader-page-label-desktop-left",
      ),
    ).toHaveText("01");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-reader-page-label-desktop-right",
      ),
    ).toHaveText("02");
    await expect(mobileScenarioReaderDialog).not.toContainText("沉浸阅读");
    const mobileScenarioReaderClose = mobileScenarioReaderDialog.getByTestId(
      "betrayal-scenario-reader-close",
    );
    const mobileScenarioReaderPrevZone = mobileScenarioReaderDialog.getByTestId(
      "betrayal-scenario-reader-prev-zone",
    );
    const mobileScenarioReaderNextZone = mobileScenarioReaderDialog.getByTestId(
      "betrayal-scenario-reader-next-zone",
    );
    for (const [label, target] of [
      ["关闭剧本", mobileScenarioReaderClose],
      ["上一页", mobileScenarioReaderPrevZone],
      ["下一页", mobileScenarioReaderNextZone],
    ] as const) {
      const box = await target.boundingBox();
      expect(box, `${label}必须有真实触控热区`).not.toBeNull();
      expect(
        box?.width ?? 0,
        `${label}触控宽度不能小于44px`,
      ).toBeGreaterThanOrEqual(44);
      expect(
        box?.height ?? 0,
        `${label}触控高度不能小于44px`,
      ).toBeGreaterThanOrEqual(44);
    }
    const expectMobileBookContentReachable = async (label: string) => {
      const scrollers = mobileScenarioReaderDialog
        .getByTestId("betrayal-scenario-book")
        .locator(".overflow-y-auto");
      await expect(scrollers, `${label}必须显示左右两页正文`).toHaveCount(2);
      const pageSizes = await scrollers.evaluateAll((elements) =>
        elements.map((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        })),
      );
      for (const [index, size] of pageSizes.entries()) {
        expect(
          size.clientHeight,
          `${label}第${index + 1}页正文区域必须有可读高度`,
        ).toBeGreaterThan(120);
        expect(
          size.scrollHeight,
          `${label}第${index + 1}页正文高度必须至少覆盖可视区域`,
        ).toBeGreaterThanOrEqual(size.clientHeight);
        if (size.scrollHeight > size.clientHeight + 2) {
          const scroller = scrollers.nth(index);
          await scroller.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          await expect
            .poll(async () => scroller.evaluate((element) => element.scrollTop))
            .toBeGreaterThan(0);
          await scroller.evaluate((element) => {
            element.scrollTop = 0;
          });
        }
      }
    };
    await expectMobileBookContentReachable("剧本首页");
    await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_SCREENSHOT);
    await mobileScenarioReaderNextZone.click();
    const mobileTurningSheet = mobileScenarioReaderDialog.getByTestId(
      "betrayal-scenario-book-turning-sheet",
    );
    await expect(mobileTurningSheet).toBeVisible();
    await expect(mobileTurningSheet).toHaveAttribute(
      "data-turn-direction",
      "forward",
    );
    await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_TURNING_SCREENSHOT);
    await expect(mobileTurningSheet).toHaveCount(0, { timeout: 2000 });
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-reader-page-label-desktop-left",
      ),
    ).toHaveText("03");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-reader-page-label-desktop-right",
      ),
    ).toHaveText("04");
    await expect(mobileScenarioReaderNextZone).toBeDisabled();
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-3",
      ),
    ).toContainText("你合上书本后");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-4",
      ),
    ).toContainText("小女孩瑟缩于角落");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-section-endingHeroes",
      ),
    ).toContainText("结局");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-section-endingTraitor",
      ),
    ).toContainText("结局");
    await expectMobileBookContentReachable("剧本末页");
    await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_BOTTOM_SCREENSHOT);
    await mobileScenarioReaderClose.click();
    await expect(mobileScenarioReaderDialog).toBeHidden();
    await expect(
      page.getByTestId("betrayal-scenario-select-dialog"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-scenario-detail-toggle"),
    ).toContainText("阅读完整剧本");
    await saveScreenshot(page, MOBILE_SCENARIO_CLOSED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-basic-flow-mobile-character-select", diagnostics },
    ]);
  });

  test("真实页面队友详情与地图token图像一致，换行动者不自动跟踪视角", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-token-detail-no-camera-follow",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(
      "/play/betrayal?players=3&seat0=human&seat1=human&seat2=human",
      { waitUntil: "domcontentloaded" },
    );
    await waitForBetrayalPageReady(page);

    const core = createStartedFirstScenarioCore(["0", "1", "2"]);
    const teammateOne = core.otherExplorers.find(
      (explorer) => explorer.playerId === "1",
    );
    const teammateTwo = core.otherExplorers.find(
      (explorer) => explorer.playerId === "2",
    );
    if (!teammateOne || !teammateTwo) {
      throw new Error("山屋队友详情 E2E 缺少 1/2 号玩家");
    }
    core.currentExplorer = {
      ...core.currentExplorer,
      roomId: "entrance-hall",
    };
    core.otherExplorers = [
      { ...teammateOne, roomId: "basement-landing" },
      { ...teammateTwo, roomId: "upper-landing" },
    ];
    core.activeRoomId = "entrance-hall";
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.movesRemaining = 0;
    core.recommendedAction = "endTurn";

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByTestId("betrayal-room-floor-ground"),
    ).toHaveAttribute("aria-pressed", "true");

    const teammatePanel = page.getByTestId("betrayal-bottom-teammate-1");
    const teammatePanelToken = page.getByTestId(
      "betrayal-bottom-teammate-token-1",
    );
    await expect(teammatePanel).toBeVisible();
    await expect(teammatePanelToken).toBeVisible();
    const panelAsset = await teammatePanel.getAttribute("data-token-asset");
    await expect(teammatePanelToken).toHaveAttribute(
      "data-token-asset",
      panelAsset ?? "",
    );

    await teammatePanel.click();
    const panelDetail = page.getByTestId("betrayal-explorer-detail-dialog-1");
    await expect(panelDetail).toBeVisible();
    await expect(panelDetail).toHaveAttribute(
      "data-token-asset",
      panelAsset ?? "",
    );
    await expect(
      page.getByTestId("betrayal-explorer-detail-token-1"),
    ).toHaveAttribute("data-token-asset", panelAsset ?? "");
    await expect(
      page.getByTestId("betrayal-room-floor-ground"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByTestId("betrayal-room-shell-basement-landing"),
    ).toHaveCount(0);
    await saveScreenshot(page, TOKEN_DETAIL_PANEL_SCREENSHOT);
    await page.getByTestId("betrayal-explorer-detail-close").click();
    await expect(panelDetail).toBeHidden();

    await page.getByTestId("betrayal-room-floor-up").click();
    await expect(page.getByTestId("betrayal-room-floor-upper")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const mapToken = page.getByTestId("betrayal-room-occupant-upper-landing-2");
    const mapFigureToken = page.getByTestId("betrayal-explorer-figure-token-2");
    await expect(mapToken).toBeVisible();
    await expect(mapFigureToken).toBeVisible();
    const mapAsset = await mapFigureToken.getAttribute("data-token-asset");
    await mapToken.click();
    const mapDetail = page.getByTestId("betrayal-explorer-detail-dialog-2");
    await expect(mapDetail).toBeVisible();
    await expect(mapDetail).toHaveAttribute("data-token-asset", mapAsset ?? "");
    await expect(
      page.getByTestId("betrayal-explorer-detail-token-2"),
    ).toHaveAttribute("data-token-asset", mapAsset ?? "");
    await expect(page.getByTestId("betrayal-room-floor-upper")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await saveScreenshot(page, TOKEN_DETAIL_MAP_SCREENSHOT);
    await page.getByTestId("betrayal-explorer-detail-close").click();
    await expect(mapDetail).toBeHidden();

    await page.getByTestId("betrayal-action-endTurn").click();
    await expect(page.getByText("当前回合")).toBeVisible();
    await expect(page.getByTestId("betrayal-room-floor-upper")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByTestId("betrayal-room-shell-upper-landing"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-shell-basement-landing"),
    ).toHaveCount(0);
    await saveScreenshot(page, TURN_HANDOFF_NO_FOLLOW_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-token-detail-no-camera-follow", diagnostics },
    ]);
  });
});
