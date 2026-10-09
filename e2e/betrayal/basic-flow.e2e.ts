import { expect, test } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  expectBetrayalTransitionTargetsLocator,
  initBetrayalContext,
  injectCore,
  readLocatorClientRect,
  saveScreenshot,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";
import { createStartedFirstScenarioCore } from "../../src/games/betrayal/testing/firstScenarioTestUtils";

const EVIDENCE_DIR = "evidence/betrayal-basic-flow";
const FINAL_REVIEW_EVIDENCE_DIR = "evidence/betrayal-mobile-acceptance-20261008";
const MOBILE_RUNTIME_SCREENSHOT_FINAL = `${FINAL_REVIEW_EVIDENCE_DIR}/01-手机-主牌桌能力摘要与物品栏.png`;
const MOBILE_RUNTIME_ABILITY_DETAILS_SCREENSHOT = `${FINAL_REVIEW_EVIDENCE_DIR}/02-手机-点击放大查看完整能力说明.png`;
const CHARACTER_CONFIRM_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-基本流程-角色确认前.png`;
const CHARACTER_DETAIL_SCROLLED_SCREENSHOT = `${EVIDENCE_DIR}/01b-山屋惊魂-角色详情滚动后看到特性.png`;
const SCENARIO_SELECT_ENTRY_SCREENSHOT = `${EVIDENCE_DIR}/02a-山屋惊魂-基本流程-剧本弹窗入口.png`;
const SCENARIO_SELECT_DETAIL_SCREENSHOT = `${EVIDENCE_DIR}/02b-山屋惊魂-基本流程-书本式剧本阅读首页.png`;
const SCENARIO_SELECT_DETAIL_TURNING_SCREENSHOT = `${EVIDENCE_DIR}/02c-山屋惊魂-基本流程-书本式剧本翻页中.png`;
const SCENARIO_SELECT_DETAIL_NEXT_BODY_SCREENSHOT = `${EVIDENCE_DIR}/02d-山屋惊魂-基本流程-书本式剧本下一正文页.png`;
const SCENARIO_SELECT_DETAIL_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/02e-山屋惊魂-基本流程-书本式剧本阅读末页.png`;
const START_SCENARIO_OPENING_SCREENSHOT = `${EVIDENCE_DIR}/03a-山屋惊魂-开始剧本后开局过场.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-基本流程-运行时.png`;
const MOVE_MODE_SCREENSHOT = `${EVIDENCE_DIR}/06-山屋惊魂-基本流程-移动选目标.png`;
const MOVE_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/07-山屋惊魂-基本流程-移动后.png`;
const MOVE_CONTINUED_SCREENSHOT = `${EVIDENCE_DIR}/07b-山屋惊魂-基本流程-不取消连续移动到大阶梯.png`;
const DIRECT_MOVE_MODE_SCREENSHOT = `${EVIDENCE_DIR}/07c-山屋惊魂-运行时-移动模式选择门厅.png`;
const DIRECT_MOVE_AFTER_FIRST_ROOM_SCREENSHOT = `${EVIDENCE_DIR}/07d-山屋惊魂-运行时-移动后仍可继续选择大阶梯.png`;
const DIRECT_MOVE_CHAIN_SCREENSHOT = `${EVIDENCE_DIR}/07e-山屋惊魂-运行时-不取消连续移动完成.png`;
const MOBILE_CHARACTER_SCREENSHOT = `${EVIDENCE_DIR}/08-山屋惊魂-移动端横屏-角色竖向滚动选中与能力提示.jpg`;
const MOBILE_CHARACTER_DETAIL_SCROLLED_SCREENSHOT = `${EVIDENCE_DIR}/08b-山屋惊魂-移动端横屏-角色详情滚动后能力说明.jpg`;
const MOBILE_SCENARIO_ENTRY_SCREENSHOT = `${EVIDENCE_DIR}/09a-山屋惊魂-移动端横屏-剧本弹窗入口.png`;
const MOBILE_SCENARIO_DETAIL_SCREENSHOT = `${EVIDENCE_DIR}/09b-山屋惊魂-移动端横屏-书本式剧本阅读首页.png`;
const MOBILE_SCENARIO_DETAIL_TURNING_SCREENSHOT = `${EVIDENCE_DIR}/09c-山屋惊魂-移动端横屏-书本式剧本翻页中.png`;
const MOBILE_SCENARIO_DETAIL_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/09d-山屋惊魂-移动端横屏-书本式剧本阅读末页.png`;
const MOBILE_SCENARIO_CLOSED_SCREENSHOT = `${EVIDENCE_DIR}/09e-山屋惊魂-移动端横屏-关闭剧本回选择页.png`;
const MOBILE_START_SCENARIO_OPENING_SCREENSHOT = `${EVIDENCE_DIR}/09f-山屋惊魂-移动端横屏-过程文案继续按钮.png`;
const MOBILE_RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/09g-山屋惊魂-移动端横屏-关闭剧本后主桌面.png`;
const TOKEN_DETAIL_PANEL_SCREENSHOT = `${EVIDENCE_DIR}/10-山屋惊魂-队友面板详情不切视角.png`;
const TOKEN_DETAIL_MAP_SCREENSHOT = `${EVIDENCE_DIR}/11-山屋惊魂-地图token详情图像一致.png`;
const TURN_HANDOFF_NO_FOLLOW_SCREENSHOT = `${EVIDENCE_DIR}/12-山屋惊魂-换行动者不自动跟踪视角.png`;
// Vivo V2314A: 2388x1080 physical landscape / (480 / 160) density = 796x360 CSS.
const VIVO_V2314A_LANDSCAPE_VIEWPORT = { width: 796, height: 360 } as const;

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
    await expect(abilitySummary).toContainText("无特殊能力");
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
    ).toContainText("暂不可选");
    await expect(
      page.getByTestId("betrayal-scenario-option-friends-forever"),
    ).toContainText("暂不可选");
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
    ).toHaveCount(0);
    await expect(scenarioReaderDialog.getByTestId("betrayal-scenario-book")).toBeVisible();
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-1",
      ),
    ).toContainText("敌方情报 / 胜利条件");
    await expect(scenarioReaderDialog).not.toContainText("本地规则源正文");
    await expect(scenarioReaderDialog).not.toContainText("正式中文转写");
    const scenarioReaderNextZone = scenarioReaderDialog.getByTestId(
      "betrayal-scenario-reader-next-zone",
    );
    await expect(scenarioReaderNextZone).toBeEnabled();
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("驱逐木乃伊");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("查看书本");
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
    ).toBeDisabled();
    await expect(scenarioReaderNextZone).toBeEnabled();
    await expect(
      scenarioReaderDialog
        .getByTestId("betrayal-scenario-book")
        .getByTestId("betrayal-scenario-reader-prev-zone"),
    ).toBeVisible();
    await expect(
      scenarioReaderDialog
        .getByTestId("betrayal-scenario-book")
        .getByTestId("betrayal-scenario-reader-next-zone"),
    ).toBeVisible();
    await expect(
      scenarioReaderDialog
        .getByTestId("betrayal-scenario-book")
        .getByTestId("betrayal-scenario-reader-close"),
    ).toBeVisible();
    await saveScreenshot(page, SCENARIO_SELECT_DETAIL_SCREENSHOT);
    await page.evaluate(() => {
      (
        window as Window & {
          __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number;
        }
      ).__BG_HOME_V2_E2E_HOLD_PROGRESS__ = 0.5;
    });
    await scenarioReaderNextZone.click();
    const turningSheet = scenarioReaderDialog.getByTestId(
      "betrayal-scenario-book-turning-sheet",
    );
    await expect(turningSheet).toBeVisible();
    await expect(turningSheet).toHaveAttribute(
      "data-flip-direction",
      "forward",
    );
    await expect(turningSheet).toHaveAttribute(
      "data-flip-implementation",
      "turnjs-real-page-flip",
    );
    const flipStage = turningSheet.getByTestId(
      "betrayal-scenario-book-real-flip-stage",
    );
    await expect(flipStage).toBeVisible();
    await expect(flipStage).toHaveAttribute("data-turn-ready", "true");
    await expect(flipStage).toHaveAttribute("data-turn-animating", "true");
    await expect(flipStage).toHaveAttribute("data-turn-plugin-animating", "true");
    await saveScreenshot(page, SCENARIO_SELECT_DETAIL_TURNING_SCREENSHOT);
    await page.evaluate(() => {
      delete (
        window as Window & {
          __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number;
        }
      ).__BG_HOME_V2_E2E_HOLD_PROGRESS__;
    });
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
    ).toContainText("他们妄图将木乃伊驱逐回亡者之国");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-4",
      ),
    ).toContainText("速度3、力量8、神志5");
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-endingHeroes"),
    ).toHaveCount(0);
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-endingTraitor"),
    ).toHaveCount(0);
    await saveScreenshot(page, SCENARIO_SELECT_DETAIL_NEXT_BODY_SCREENSHOT);

    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-3",
      ),
    ).toContainText("他们妄图将木乃伊驱逐回亡者之国");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-4",
      ),
    ).toContainText("速度3、力量8、神志5");
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-endingHeroes"),
    ).toHaveCount(0);
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-endingTraitor"),
    ).toHaveCount(0);
    await saveScreenshot(page, SCENARIO_SELECT_DETAIL_BOTTOM_SCREENSHOT);
    await scenarioReaderDialog
      .getByTestId("betrayal-scenario-reader-close")
      .click();
    await expect(
      page.getByTestId("betrayal-scenario-reader-dialog"),
    ).toBeHidden();
    const scenarioSelectDialog = page.getByTestId(
      "betrayal-scenario-select-dialog",
    );
    await expect(scenarioSelectDialog).toBeVisible();
    await scenarioSelectDialog.getByTestId("betrayal-scenario-dialog-close").click();
    await expect(scenarioSelectDialog).toBeHidden({ timeout: 5000 });
    const characterConfirm = page.getByTestId("betrayal-character-confirm");
    await expect(characterConfirm).toBeVisible({ timeout: 10000 });
    await expect(characterConfirm).toHaveText(/确认此剧本卡/);
    await characterConfirm.click();

    const startScenarioOpeningStage = page.getByTestId(
      "betrayal-start-scenario-opening-stage",
    );
    const startedAfterScenarioConfirmation = await startScenarioOpeningStage
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!startedAfterScenarioConfirmation) {
      await expect(characterConfirm).toHaveText(/开始剧本/);
      await characterConfirm.click();
    }
    await expect(startScenarioOpeningStage).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByTestId("betrayal-start-scenario-opening-cinematic"),
    ).toContainText("英雄开场过场");
    await expect(
      page.getByTestId("betrayal-start-scenario-opening-cinematic"),
    ).toContainText("尘土飞扬");
    const openingNarrationLine = page
      .getByTestId("betrayal-start-scenario-opening-cinematic")
      .locator(".betrayal-cinematic-narration__line")
      .first();
    await expect(openingNarrationLine).toBeVisible();
    expect(
      await openingNarrationLine.evaluate((element) =>
        Number.parseFloat(window.getComputedStyle(element).fontSize),
      ),
      "过场字幕在移动端不得低于16px",
    ).toBeGreaterThanOrEqual(16);
    await expect(
      page.getByTestId("betrayal-start-scenario-opening-source-status"),
    ).toHaveCount(0);
    await expect(startScenarioOpeningStage).not.toContainText("本地规则源正文");
    await expect(startScenarioOpeningStage).not.toContainText("正式中文转写");
    await saveScreenshot(page, START_SCENARIO_OPENING_SCREENSHOT);
    await page.getByTestId("betrayal-start-scenario-opening-continue").click();
    await expect(startScenarioOpeningStage).toHaveCount(0);

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
    expect(
      await page.getByTestId("betrayal-current-ability").evaluate((element) =>
        Number.parseFloat(window.getComputedStyle(element).fontSize),
      ),
      "桌面端能力描述必须有有效字号",
    ).toBeGreaterThan(0);
    await expect(page.getByTestId("fab-menu")).toHaveAttribute(
      "data-fab-position",
      "bottom-right",
    );
    const fabBox = await page.getByTestId("fab-menu").boundingBox();
    expect(fabBox, "Betrayal 悬浮球必须回到右下角回归锚点").not.toBeNull();
    expect(fabBox!.x + fabBox!.width).toBeGreaterThan(796 - 96);
    expect(fabBox!.y + fabBox!.height).toBeGreaterThan(360 - 96);
    const startingInventory = await page.evaluate(() => {
      const harness = (
        window as Window & {
          __BG_TEST_HARNESS__?: {
            state?: { get?: () => { core?: { currentExplorer?: { inventory?: unknown[] } } } };
          };
        }
      ).__BG_TEST_HARNESS__;
      return harness?.state?.get?.().core?.currentExplorer?.inventory ?? null;
    });
    expect(startingInventory).toEqual([]);
    await expect(
      page.getByTestId("betrayal-inventory-omen-book"),
    ).toHaveCount(0);
    await saveScreenshot(page, RUNTIME_SCREENSHOT);
    const firstMoveSourceRoomId = await page.evaluate(() => {
      const harness = (
        window as Window & {
          __BG_TEST_HARNESS__?: {
            state?: { get?: () => { core?: { currentExplorer?: { roomId?: string } } } };
          };
        }
      ).__BG_TEST_HARNESS__;
      return harness?.state?.get?.().core?.currentExplorer?.roomId ?? null;
    });
    if (!firstMoveSourceRoomId) {
      throw new Error("山屋移动动画测试缺少移动前源房间");
    }
    const firstMoveSourceToken = page.getByTestId(
      `betrayal-room-occupant-${firstMoveSourceRoomId}-0`,
    );
    await expect(firstMoveSourceToken).toBeVisible();
    const firstMoveSourceRect = await readLocatorClientRect(
      firstMoveSourceToken,
    );

    await page.getByTestId("betrayal-action-move").click();
    await expect(page.getByTestId("betrayal-action-move")).toContainText(
      "取消移动",
    );
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await expect(page.getByTestId("betrayal-room-hallway")).toBeEnabled();
    await saveScreenshot(page, MOVE_MODE_SCREENSHOT);
    await page.getByTestId("betrayal-room-hallway").click();
    const moveTransitionBlocker = page.getByTestId(
      "betrayal-visual-transition-blocker",
    );
    await expect(moveTransitionBlocker).toBeVisible();
    await expect(moveTransitionBlocker).toHaveAttribute(
      "data-transition-kind",
      "explorer-move",
    );
    await expect(moveTransitionBlocker).toHaveAttribute(
      "data-transition-target-testid",
      "betrayal-room-occupant-hallway-0",
    );
    const firstMoveTargetToken = page.getByTestId(
      "betrayal-room-occupant-hallway-0",
    );
    await expect(firstMoveTargetToken).toHaveCount(1);
    await expect(firstMoveTargetToken).toHaveAttribute(
      "data-visual-transition-anchor-hidden",
      "true",
    );
    const firstMoveTransition = page.locator(
      '[data-testid^="betrayal-visual-transition-transition-"]',
    );
    await expectBetrayalTransitionTargetsLocator(
      firstMoveTransition,
      firstMoveTargetToken,
      "山屋惊魂向左移动动画",
      { sourceRect: firstMoveSourceRect },
    );
    await expect(
      page.getByTestId("betrayal-visual-transition-explorer-token-0"),
    ).toBeVisible();
    await expect(
      page.getByTestId(`betrayal-room-occupant-${firstMoveSourceRoomId}-0`),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator('[data-testid^="betrayal-visual-transition-transition-"]')
          .evaluate((node) => {
            const transform = getComputedStyle(node).transform;
            return transform !== "none" && !transform.endsWith("(1, 0, 0, 1, 0, 0)");
          }),
      )
      .toBe(true);
    await saveScreenshot(
      page,
      `${EVIDENCE_DIR}/07a-山屋惊魂-基本流程-移动到门厅动画中.png`,
    );
    await expect(moveTransitionBlocker).toHaveCount(0);
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
    const directMoveSourceToken = page.getByTestId(
      "betrayal-room-occupant-entrance-hall-0",
    );
    const directMoveSourceRect = await readLocatorClientRect(
      directMoveSourceToken,
    );

    await page.getByTestId("betrayal-action-move").click();
    await expect(page.getByTestId("betrayal-action-move")).toContainText(
      "取消移动",
    );
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await expect(page.getByTestId("betrayal-room-hallway")).toBeEnabled();
    await saveScreenshot(page, DIRECT_MOVE_MODE_SCREENSHOT);

    await page.getByTestId("betrayal-room-hallway").click();
    const directMoveTransitionBlocker = page.getByTestId(
      "betrayal-visual-transition-blocker",
    );
    await expect(directMoveTransitionBlocker).toBeVisible();
    await expect(directMoveTransitionBlocker).toHaveAttribute(
      "data-transition-kind",
      "explorer-move",
    );
    await expect(directMoveTransitionBlocker).toHaveAttribute(
      "data-transition-target-testid",
      "betrayal-room-occupant-hallway-0",
    );
    const directMoveTargetToken = page.getByTestId(
      "betrayal-room-occupant-hallway-0",
    );
    await expect(directMoveTargetToken).toHaveCount(1);
    await expect(directMoveTargetToken).toHaveAttribute(
      "data-visual-transition-anchor-hidden",
      "true",
    );
    await expectBetrayalTransitionTargetsLocator(
      page.locator('[data-testid^="betrayal-visual-transition-transition-"]'),
      directMoveTargetToken,
      "山屋惊魂运行时向左移动动画",
      { sourceRect: directMoveSourceRect },
    );
    await expect(directMoveTransitionBlocker).toHaveCount(0);
    await expect(directMoveTargetToken).toBeVisible();
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

  test.describe("Vivo V2314A 横屏物理比例", () => {
    test.use({ deviceScaleFactor: 3 });

    test("移动端横屏角色选择保持 PC 同构画布、选中态和能力提示", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-basic-flow-mobile-character-select",
    );

    await page.setViewportSize(VIVO_V2314A_LANDSCAPE_VIEWPORT);
    await warmBetrayalFrontend(context);
    await page.goto(
      "/play/betrayal?players=1&seat0=human&playerID=0&bgForceCoarsePointer=1",
      {
        waitUntil: "domcontentloaded",
      },
    );
    await waitForBetrayalPageReady(page);

    await expect(
      page.getByTestId("betrayal-character-select-screen"),
    ).toBeVisible({ timeout: 30000 });
    const selectionGrid = page.getByTestId("betrayal-character-selection-grid");
    await expect(selectionGrid).toBeVisible();
    await expect(selectionGrid).toHaveClass(/grid-cols-3/);
    await expect(
      selectionGrid.getByTestId("betrayal-character-card-isa-valencia"),
    ).toBeVisible();
    await expect(
      selectionGrid.getByTestId("betrayal-character-card-isa-valencia"),
    ).toHaveAttribute("aria-label", /已选择/);
    for (const explorerId of [
      "isa-valencia",
      "anita-hernandez",
      "father-warren-leung",
      "dan-nguyen-md",
      "michelle-monroe",
      "beat-box-bowen",
    ]) {
      await expect(
        selectionGrid.getByTestId(`betrayal-character-card-${explorerId}`),
      ).toBeInViewport();
    }
    await expect(
      page.getByTestId("betrayal-character-mobile-grid"),
    ).toHaveCount(0);

    await expect(
      page.getByTestId("betrayal-character-ability-summary"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-character-ability-summary"),
    ).toContainText("特性");
    await expect(
      page.getByTestId("betrayal-character-ability-summary"),
    ).toContainText("无特殊能力");
    const mobileAbilitySummaryTypography = await page
      .getByTestId("betrayal-character-ability-summary")
      .evaluate((element) => {
        let visualScale = 1;
        let current: HTMLElement | null = element as HTMLElement;
        while (current) {
          const style = window.getComputedStyle(current);
          const zoom = Number.parseFloat(style.zoom);
          if (Number.isFinite(zoom) && zoom > 0) {
            visualScale *= zoom;
          }
          const matrix = style.transform.match(/^matrix\(([^)]+)\)$/);
          if (matrix) {
            const values = matrix[1].split(",").map(Number);
            const scaleX = Math.hypot(values[0] ?? 1, values[1] ?? 0);
            if (Number.isFinite(scaleX) && scaleX > 0) {
              visualScale *= scaleX;
            }
          }
          current = current.parentElement;
        }
        const fontSize = Number.parseFloat(
          window.getComputedStyle(element).fontSize,
        );
        return {
          fontSize,
          visualScale,
          effectiveFontSize: fontSize * visualScale,
        };
      });
    expect(
      mobileAbilitySummaryTypography.fontSize,
      "选角能力摘要保持 PC 设计字号，由 board-shell 等比缩放",
    ).toBeCloseTo(16, 0);
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
    const mobileCharacterDetailScroll = page.getByTestId(
      "betrayal-character-detail-scroll",
    );
    await mobileCharacterDetailScroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(
      page.getByTestId("betrayal-character-ability-summary"),
    ).toBeInViewport();
    await saveScreenshot(page, MOBILE_CHARACTER_DETAIL_SCROLLED_SCREENSHOT);

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
    ).toContainText("暂不可选");
    await expect(
      page.getByTestId("betrayal-scenario-detail-toggle"),
    ).toContainText("阅读完整剧本");
    const scenarioSelectActions = page.getByTestId(
      "betrayal-scenario-select-actions",
    );
    await expect(scenarioSelectActions).toBeVisible();
    const scenarioActionMetrics = await scenarioSelectActions.evaluate(
      (element) => {
        const actionIds = [
          "betrayal-scenario-detail-toggle",
          "betrayal-scenario-select-current",
          "betrayal-scenario-dialog-close",
        ];
        const rects = actionIds.map((id) => {
          const action = element.querySelector<HTMLElement>(
            `[data-testid="${id}"]`,
          );
          if (!action) return null;
          const rect = action.getBoundingClientRect();
          const style = window.getComputedStyle(action);
          return {
            id,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            fontSize: Number.parseFloat(style.fontSize),
          };
        });
        return { rects, container: element.getBoundingClientRect().toJSON() };
      },
    );
    expect(
      scenarioActionMetrics.rects.every(Boolean),
      "剧本选择的三个主操作必须全部位于同一操作带",
    ).toBe(true);
    const scenarioActionRects = scenarioActionMetrics.rects.filter(
      (rect): rect is NonNullable<typeof rect> => Boolean(rect),
    );
    expect(
      Math.max(...scenarioActionRects.map((rect) => rect.top)) -
        Math.min(...scenarioActionRects.map((rect) => rect.top)),
      "阅读、确认、关闭必须在同一排",
    ).toBeLessThanOrEqual(1);
    expect(
      Math.min(...scenarioActionRects.map((rect) => rect.width)),
      "三个主操作必须均分操作带宽度",
    ).toBeGreaterThan(0);
    expect(
      Math.max(...scenarioActionRects.map((rect) => rect.fontSize)),
      "按钮文字不能继续使用12px小字",
    ).toBeGreaterThanOrEqual(16);
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
      if (label === "下一页") {
        expect(box?.width ?? 0, "书内下一页不能复用过程文案的大按钮热区").toBeLessThanOrEqual(96);
        expect(box?.height ?? 0, "书内下一页不能复用过程文案的大按钮热区").toBeLessThanOrEqual(96);
      }
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
    ).toHaveCount(0);
    await expect(mobileScenarioReaderDialog).not.toContainText("本地规则源正文");
    await expect(mobileScenarioReaderDialog).not.toContainText("正式中文转写");
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
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("驱逐木乃伊");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("查看书本");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-section-setup",
      ),
      ).toHaveCount(0);
    await expect(
      mobileScenarioReaderDialog.getByTestId("betrayal-scenario-reader-title"),
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
    const mobileBookBodyFontSize = await mobileScenarioReaderDialog
      .getByTestId("betrayal-scenario-book")
      .locator('[data-testid="betrayal-scenario-reader-body-scroll"] p')
      .first()
      .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize));
    expect(mobileBookBodyFontSize, "剧本正文在移动端不得低于16px").toBeGreaterThanOrEqual(16);
    await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_SCREENSHOT);
    await mobileScenarioReaderDialog.evaluate(() => {
      (
        window as Window & {
          __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number;
        }
      ).__BG_HOME_V2_E2E_HOLD_PROGRESS__ = 0.5;
    });
    await mobileScenarioReaderNextZone.click();
    const mobileTurningSheet = mobileScenarioReaderDialog.getByTestId(
      "betrayal-scenario-book-turning-sheet",
    );
    await expect(mobileTurningSheet).toBeVisible();
    await expect(mobileTurningSheet).toHaveAttribute(
      "data-flip-direction",
      "forward",
    );
    await saveScreenshot(page, MOBILE_SCENARIO_DETAIL_TURNING_SCREENSHOT);
    await mobileScenarioReaderDialog.evaluate(() => {
      delete (
        window as Window & {
          __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number;
        }
      ).__BG_HOME_V2_E2E_HOLD_PROGRESS__;
    });
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
    ).toContainText("他们妄图将木乃伊驱逐回亡者之国");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-4",
      ),
    ).toContainText("速度3、力量8、神志5");
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-section-endingHeroes",
      ),
    ).toHaveCount(0);
    await expect(
      mobileScenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-section-endingTraitor",
      ),
    ).toHaveCount(0);
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

    const mobileScenarioSelectDialog = page.getByTestId(
      "betrayal-scenario-select-dialog",
    );
    await mobileScenarioSelectDialog
      .getByTestId("betrayal-scenario-dialog-close")
      .click();
    await expect(mobileScenarioSelectDialog).toBeHidden({ timeout: 5000 });
    const mobileCharacterConfirm = page.getByTestId(
      "betrayal-character-confirm",
    );
    await expect(mobileCharacterConfirm).toHaveText(/确认此剧本卡/);
    await mobileCharacterConfirm.click();
    const mobileStartOpeningStage = page.getByTestId(
      "betrayal-start-scenario-opening-stage",
    );
    const startedAfterMobileScenarioConfirmation = await mobileStartOpeningStage
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!startedAfterMobileScenarioConfirmation) {
      await expect(mobileCharacterConfirm).toHaveText(/开始剧本/);
      await mobileCharacterConfirm.click();
    }
    await expect(mobileStartOpeningStage).toBeVisible({ timeout: 30000 });
    const mobileContinue = page.getByTestId(
      "betrayal-start-scenario-opening-continue",
    );
    const mobileContinueBox = await mobileContinue.boundingBox();
    expect(mobileContinueBox, "移动端过程文案继续按钮必须有真实热区").not.toBeNull();
    expect(Math.round(mobileContinueBox!.width)).toBeGreaterThanOrEqual(176);
    expect(Math.round(mobileContinueBox!.height)).toBeGreaterThanOrEqual(56);
    const mobileContinueTypography = await mobileContinue.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        minHeight: Number.parseFloat(style.minHeight),
      };
    });
    expect(mobileContinueTypography.fontSize).toBeGreaterThanOrEqual(16);
    expect(mobileContinueTypography.minHeight).toBeGreaterThanOrEqual(56);
    await saveScreenshot(page, MOBILE_START_SCENARIO_OPENING_SCREENSHOT);
    await mobileContinue.click();
    await expect(mobileStartOpeningStage).toHaveCount(0);

    await expect(page.getByTestId("betrayal-board")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("betrayal-room-grid")).toBeVisible();
    const mobileAbilitySummary = page.getByTestId("betrayal-current-ability");
    await expect(mobileAbilitySummary).toBeVisible();
    await expect(mobileAbilitySummary).toHaveAttribute(
      "data-ability-display",
      "compact",
    );
    expect(
      await mobileAbilitySummary.evaluate((element) =>
        Number.parseFloat(window.getComputedStyle(element).fontSize),
      ),
      "移动端能力摘要保持 PC 设计 16px，由 HUD 等比缩放",
    ).toBeCloseTo(16, 0);
    const abilityBox = await mobileAbilitySummary.boundingBox();
    const inventoryBox = await page
      .getByTestId("betrayal-inventory-section")
      .boundingBox();
    expect(abilityBox, "移动端能力摘要必须有真实布局盒").not.toBeNull();
    expect(inventoryBox, "移动端物品栏必须有真实布局盒").not.toBeNull();
    expect(
      abilityBox!.y + abilityBox!.height,
      "移动端能力摘要不得遮挡物品栏",
    ).toBeLessThanOrEqual(inventoryBox!.y + 1);
    await mobileAbilitySummary.click();
    const mobileAbilityDialog = page.getByTestId(
      "betrayal-current-ability-dialog",
    );
    await expect(mobileAbilityDialog).toBeVisible();
    await expect(
      mobileAbilityDialog.getByTestId("betrayal-current-ability-dialog-body"),
    ).toContainText("基础版角色背景不改变规则");
    expect(
      await mobileAbilityDialog
        .getByTestId("betrayal-current-ability-dialog-body")
        .evaluate((element) =>
          Number.parseFloat(window.getComputedStyle(element).fontSize),
        ),
      "移动端能力放大层正文必须保持16px可读",
    ).toBeGreaterThanOrEqual(16);
    await mobileAbilityDialog
      .getByTestId("betrayal-current-ability-dialog-close")
      .click();
    await expect(mobileAbilityDialog).toBeHidden();
    await expect(page.getByTestId("fab-menu")).toHaveAttribute(
      "data-fab-position",
      "bottom-right",
    );
    const mobileTurnHud = page.getByTestId("betrayal-status-chip");
    const mobileTurnHudBox = await mobileTurnHud.boundingBox();
    expect(mobileTurnHudBox, "当前回合 HUD 必须存在").not.toBeNull();
    expect(mobileTurnHudBox!.x, "当前回合 HUD 必须保持右上角锚点").toBeGreaterThan(400);
    const mobileFabBox = await page.getByTestId("fab-menu").boundingBox();
    expect(mobileFabBox, "移动端主桌面悬浮球必须位于右下角").not.toBeNull();
    expect(mobileFabBox!.x + mobileFabBox!.width).toBeGreaterThan(796 - 96);
    expect(mobileFabBox!.y + mobileFabBox!.height).toBeGreaterThan(360 - 96);
    await saveScreenshot(page, MOBILE_RUNTIME_SCREENSHOT);
    await saveScreenshot(page, MOBILE_RUNTIME_SCREENSHOT_FINAL);
    await mobileAbilitySummary.click();
    await expect(mobileAbilityDialog).toBeVisible();
    await saveScreenshot(page, MOBILE_RUNTIME_ABILITY_DETAILS_SCREENSHOT);
    await mobileAbilityDialog
      .getByTestId("betrayal-current-ability-dialog-close")
      .click();
    await expect(mobileAbilityDialog).toBeHidden();

    assertNoFatalFrontendErrors([
      { label: "betrayal-basic-flow-mobile-character-select", diagnostics },
    ]);
    });
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
      await expect(teammatePanel).toBeVisible();
      await expect(teammatePanel).not.toHaveAttribute("data-token-asset");
      const expectedTeammateTokenAsset =
        teammateOne.tokenAsset ?? teammateOne.portraitAsset;
      const desktopTeammatePanel = page.getByTestId(
        "betrayal-teammate-panel-1",
      );
      await expect(desktopTeammatePanel).not.toHaveAttribute("data-token-asset");
      await expect(
        page.getByTestId("betrayal-teammate-panel-token-1"),
      ).toHaveCount(0);

      await teammatePanel.click();
      await expect(teammatePanel).toHaveAttribute("data-observed-player", "true");
      await expect(
        page.getByTestId("betrayal-bottom-teammate-observed-1"),
      ).toBeVisible();
      await expect(
        page.getByTestId("betrayal-bottom-teammate-token-1"),
      ).toHaveCount(0);
      await expect(
        page.getByTestId("betrayal-explorer-detail-dialog-1"),
      ).toHaveCount(0);

    const mapTeammateToken = page.getByTestId(
      "betrayal-room-occupant-basement-landing-1",
    );
    await expect(mapTeammateToken).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-floor-basement"),
    ).toHaveAttribute("aria-pressed", "true");
    await mapTeammateToken.click();
    const panelDetail = page.getByTestId("betrayal-explorer-detail-dialog-1");
    await expect(panelDetail).toBeVisible();
    await expect(panelDetail).toHaveAttribute(
      "data-token-asset",
      expectedTeammateTokenAsset,
    );
    await expect(
      page.getByTestId("betrayal-explorer-detail-token-1"),
    ).toHaveAttribute("data-token-asset", expectedTeammateTokenAsset);
    await saveScreenshot(page, TOKEN_DETAIL_PANEL_SCREENSHOT);
    await page.getByTestId("betrayal-explorer-detail-close").click();
    await expect(panelDetail).toBeHidden();

    await page.getByTestId("betrayal-room-floor-up").click();
    await expect(page.getByTestId("betrayal-room-floor-ground")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
