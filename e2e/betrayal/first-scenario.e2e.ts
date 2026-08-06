import { expect, test } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  createFirstScenarioHauntRuntimeCore,
  createFirstScenarioReadyToExorciseRuntimeCore,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/betrayal-first-scenario";
const HAUNT_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-haunt运行时.png`;
const SCENARIO_REFERENCE_HOME_SCREENSHOT = `${EVIDENCE_DIR}/02a-山屋惊魂-首剧本查阅-当前剧本首页.png`;
const SCENARIO_REFERENCE_TURNING_SCREENSHOT = `${EVIDENCE_DIR}/02b-山屋惊魂-首剧本查阅-当前剧本翻页中.png`;
const SCENARIO_REFERENCE_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/02c-山屋惊魂-首剧本查阅-当前剧本末页.png`;
const REFERENCE_SCREENSHOT = `${EVIDENCE_DIR}/02d-山屋惊魂-首剧本查阅-帮助参考卡.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-第一剧本-haunt牌桌.png`;
const ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-终局-幸存者胜利.png`;

test.describe("山屋惊魂第一剧本", () => {
  test("从真实 haunt 运行时进入幸存者终局", async ({ page, context }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, "betrayal-first-scenario");

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createFirstScenarioHauntRuntimeCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    const pendingDiscoveryPanel = page.getByTestId("betrayal-discovery-panel");
    if (await pendingDiscoveryPanel.isVisible()) {
      await expect(pendingDiscoveryPanel).toContainText(/作祟检定|探索结果/);
      await page.getByTestId("betrayal-discovery-continue").click();
      await expect(pendingDiscoveryPanel).toHaveCount(0);
    }
    await expect(page.getByTestId("betrayal-open-scenario")).toBeVisible();
    await expect(
      page.getByTestId("betrayal-runtime-header-grid"),
    ).toContainText(/恶兆后|Haunt/i);
    await saveScreenshot(page, HAUNT_SCREENSHOT);

    await page.getByTestId("betrayal-open-scenario").click();
    const scenarioReaderDialog = page.getByTestId(
      "betrayal-scenario-reader-dialog",
    );
    const scenarioObjectivePage = scenarioReaderDialog.getByTestId(
      "betrayal-scenario-objective-page",
    );
    await expect(scenarioReaderDialog).toBeVisible();
    await expect(page.getByTestId("betrayal-reference-overlay")).toHaveCount(0);
    await expect(scenarioObjectivePage).toBeVisible();
    await expect(scenarioObjectivePage).toHaveAttribute(
      "data-scenario-reader-scope",
      "heroes",
    );
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-reader-role"),
    ).toContainText("英雄剧本书");
    await expect(scenarioObjectivePage).toContainText("剧本1");
    await expect(scenarioObjectivePage).not.toContainText(/剧本1查阅/);
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book"),
    ).toBeVisible();
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-crimsonJack-dossier-1",
      ),
    ).toContainText("山屋异象");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-crimsonJack-dossier-2",
      ),
    ).toContainText("英雄手册");
    await saveScreenshot(page, SCENARIO_REFERENCE_HOME_SCREENSHOT);
    const scenarioReaderNextZone = scenarioReaderDialog.getByTestId(
      "betrayal-scenario-reader-next-zone",
    );
    await scenarioReaderNextZone.click();
    const turningSheet = scenarioReaderDialog.getByTestId(
      "betrayal-scenario-book-turning-sheet",
    );
    await expect(turningSheet).toBeVisible();
    await expect(turningSheet).toHaveAttribute(
      "data-flip-direction",
      "forward",
    );
    await saveScreenshot(page, SCENARIO_REFERENCE_TURNING_SCREENSHOT);
    await expect(turningSheet).toHaveCount(0, { timeout: 2000 });
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-crimsonJack-dossier-3",
      ),
    ).toContainText("驱魔法阵");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-crimsonJack-dossier-4",
      ),
    ).toContainText("胜负判定");
    await expect(scenarioReaderDialog).not.toContainText("叛徒手册");
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-traitor"),
    ).toHaveCount(0);
    await expect(
      scenarioReaderDialog.getByTestId("betrayal-scenario-book-section-monster"),
    ).toHaveCount(0);
    await expect(scenarioReaderNextZone).toBeDisabled();
    await saveScreenshot(page, SCENARIO_REFERENCE_BOTTOM_SCREENSHOT);
    await page.getByTestId("betrayal-scenario-reader-close").click();
    await expect(scenarioReaderDialog).toBeHidden();
    await page.getByTestId("betrayal-open-reference").click();
    const referenceOverlay = page.getByTestId("betrayal-reference-overlay");
    await expect(referenceOverlay).toBeVisible();
    const referenceImage = page.getByTestId("betrayal-reference-card-image");
    await expect(referenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/player-reference-zh-front",
    );
    await page.getByTestId("betrayal-reference-toggle").click();
    await expect(referenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/player-reference-zh-back",
    );
    await page.getByTestId("betrayal-reference-toggle").click();
    await expect(referenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/traitor-reference-zh",
    );
    await page.getByTestId("betrayal-reference-toggle").click();
    await expect(referenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/monster-reference-zh",
    );
    await saveScreenshot(page, REFERENCE_SCREENSHOT);
    await page.getByTestId("betrayal-reference-close").click();
    await expect(page.getByTestId("betrayal-reference-overlay")).toBeHidden();
    await saveScreenshot(page, RUNTIME_SCREENSHOT);

    await injectCore(page, createFirstScenarioReadyToExorciseRuntimeCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/驱魔|驱散杰克之灵|Exorcise/i);
    await setHarnessRandomQueue(page, [0.99, 0.99, 0.99]);
    await page.getByTestId("betrayal-action-use").click();
    const exorciseRollReview = page.getByTestId(
      "betrayal-exorcise-roll-review",
    );
    await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
    const exorciseRollBackdrop = page.getByTestId(
      "betrayal-roll-review-backdrop",
    );
    await expect(exorciseRollBackdrop).toHaveAttribute(
      "data-backdrop-dismiss",
      "disabled",
    );
    await page.mouse.click(16, 16);
    await expect(exorciseRollReview).toBeVisible();
    await page.getByTestId("betrayal-exorcise-roll-continue").click();
    const endgameScreen = page.getByTestId("betrayal-endgame-screen");
    await expect(endgameScreen).toBeVisible({ timeout: 30000 });
    await expect(
      endgameScreen.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("结局朗读");
    await expect(
      endgameScreen.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("杰克之灵消失");
    await expect(
      endgameScreen
        .getByRole("main")
        .getByText("幸存者逃脱", { exact: true })
        .first(),
    ).toBeVisible();
    await endgameScreen.screenshot({ path: ENDGAME_SCREENSHOT });

    assertNoFatalFrontendErrors([
      { label: "betrayal-first-scenario", diagnostics },
    ]);
  });
});
