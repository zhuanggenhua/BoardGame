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
  waitForPhysicalDiceSettled,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/betrayal-first-scenario";
const HAUNT_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-haunt运行时.png`;
const SCENARIO_REFERENCE_HOME_SCREENSHOT = `${EVIDENCE_DIR}/02a-山屋惊魂-首剧本查阅-当前剧本首页.png`;
const REFERENCE_SCREENSHOT = `${EVIDENCE_DIR}/02d-山屋惊魂-首剧本查阅-帮助参考卡.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-第一剧本-haunt牌桌.png`;
const ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-终局-幸存者胜利.png`;
const ENDGAME_REPORT_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-终局-结果报告.png`;

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
    ).toContainText(/作祟中|恶兆后|Haunt/i);
    const skipTurnIntroIfVisible = async () => {
      const turnIntroSkip = page.getByTestId("betrayal-turn-intro-skip");
      if (await turnIntroSkip.isVisible().catch(() => false)) {
        await turnIntroSkip.click();
        await expect(turnIntroSkip).toHaveCount(0);
      }
    };
    await skipTurnIntroIfVisible();
    const autoOpenedScenarioReader = page.getByTestId(
      "betrayal-scenario-reader-dialog",
    );
    await expect(autoOpenedScenarioReader).toBeVisible();
    await expect(
      autoOpenedScenarioReader.getByTestId("betrayal-scenario-opening-stage"),
    ).toBeVisible();
    await autoOpenedScenarioReader
      .getByTestId("betrayal-scenario-reader-close")
      .click();
    await expect(autoOpenedScenarioReader).toHaveCount(0);
    await skipTurnIntroIfVisible();
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
        "betrayal-scenario-book-page-mummyRampage-dossier-1",
      ),
    ).toContainText("敌方情报 / 胜利条件");
    await expect(
      scenarioReaderDialog.getByTestId(
        "betrayal-scenario-book-page-mummyRampage-dossier-2",
      ),
    ).toContainText("驱逐木乃伊");
    await saveScreenshot(page, SCENARIO_REFERENCE_HOME_SCREENSHOT);
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
    ).toContainText(/驱逐木乃伊|Exorcise/i);
    await setHarnessRandomQueue(page, [
      0.99, 0.99, 0.99, 0.99,
      0.01, 0.01, 0.01, 0.01, 0.01,
    ]);
    await page.getByTestId("betrayal-action-use").click();
    const exorciseRollReview = page.getByTestId(
      "betrayal-exorcise-roll-review",
    );
    await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
    await waitForPhysicalDiceSettled(
      exorciseRollReview.getByTestId("betrayal-recent-roll-panel"),
    );
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
    ).toContainText("木乃伊犹如细砂随风飞散");
    await saveScreenshot(page, ENDGAME_SCREENSHOT);
    await endgameScreen.getByTestId("betrayal-endgame-ending-continue").click();
    const endgameResultReport = endgameScreen.getByTestId(
      "betrayal-endgame-result-report",
    );
    await expect(endgameResultReport).toBeVisible();
    await expect(
      endgameScreen.getByTestId("betrayal-endgame-ending-narration"),
    ).toHaveCount(0);
    await saveScreenshot(page, ENDGAME_REPORT_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-first-scenario", diagnostics },
    ]);
  });
});
