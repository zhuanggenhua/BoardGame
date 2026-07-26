import { expect, test, type Page } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  createFirstScenarioHauntRuntimeCore,
  createFirstScenarioReadyToExorciseRuntimeCore,
  createFirstScenarioReadyToTraitorVictoryRuntimeCore,
  createFirstScenarioSurvivorEndgameCore,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/betrayal-scenario-flow-new-rules";
const PUBLIC_REVEAL_SCREENSHOT = `${EVIDENCE_DIR}/01-公开揭示-作祟开始横幅.jpg`;
const HERO_READER_SCREENSHOT = `${EVIDENCE_DIR}/02-英雄视角-秘密阅读-开局叙事.jpg`;
const TRAITOR_READER_SCREENSHOT = `${EVIDENCE_DIR}/03-叛徒视角-秘密阅读-叛徒手册.jpg`;
const OBJECTIVE_HANDOFF_SCREENSHOT = `${EVIDENCE_DIR}/04-目标承接-牌桌任务入口.jpg`;
const SURVIVOR_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/05-结局朗读-幸存者胜利.jpg`;
const TRAITOR_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/06-结局朗读-叛徒胜利.jpg`;

async function openBetrayalAsPlayer(page: Page, playerId: string) {
  await page.goto(
    `/play/betrayal?players=3&playerID=${playerId}&seat0=human&seat1=human&seat2=human`,
    { waitUntil: "domcontentloaded" },
  );
  await waitForBetrayalPageReady(page);
}

async function openInjectedCoreAsPlayer(
  page: Page,
  playerId: string,
  core: Parameters<typeof injectCore>[1],
) {
  await openBetrayalAsPlayer(page, playerId);
  await injectCore(page, core);
  await expect(page.getByTestId("betrayal-board")).toBeVisible({
    timeout: 30000,
  });
}

async function dismissHauntRevealIfPresent(page: Page) {
  const closeButton = page.getByTestId("betrayal-haunt-reveal-close");
  if ((await closeButton.count()) > 0 && (await closeButton.first().isVisible())) {
    await closeButton.first().click();
    await expect(page.getByTestId("betrayal-haunt-reveal-cue")).toHaveCount(0);
  }
}

test.describe("山屋惊魂剧本流程新规覆盖", () => {
  test("公开揭示、分阵营阅读、开局叙事、目标承接和结局朗读都有独立证据", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-scenario-flow-new-rules",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);

    await openInjectedCoreAsPlayer(
      page,
      "0",
      createFirstScenarioHauntRuntimeCore(),
    );
    const revealCue = page.getByTestId("betrayal-haunt-reveal-cue");
    await expect(revealCue).toBeVisible();
    await expect(
      page.getByTestId("betrayal-haunt-reveal-player-title"),
    ).toContainText("公开揭示");
    await expect(page.getByTestId("betrayal-haunt-reveal-source")).toContainText(
      /剧本卡 赤红杰克归来.*触发/,
    );
    await expect(page.getByTestId("betrayal-open-scenario")).toBeVisible();
    await saveScreenshot(page, PUBLIC_REVEAL_SCREENSHOT);

    await page.getByTestId("betrayal-open-scenario").click();
    const heroReader = page.getByTestId("betrayal-scenario-reader-dialog");
    await expect(heroReader).toBeVisible();
    await expect(
      heroReader.getByTestId("betrayal-scenario-objective-page"),
    ).toHaveAttribute("data-scenario-reader-scope", "heroes");
    await expect(
      heroReader.getByTestId("betrayal-scenario-reader-role"),
    ).toContainText("英雄剧本书");
    await expect(
      heroReader.getByTestId("betrayal-scenario-reader-source-status"),
    ).toContainText("非原文摘要");
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-prologue"),
    ).toContainText("山屋异象");
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-heroes"),
    ).toContainText("英雄手册");
    await expect(heroReader).not.toContainText("叛徒手册");
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-traitor"),
    ).toHaveCount(0);
    await saveScreenshot(page, HERO_READER_SCREENSHOT);

    await openInjectedCoreAsPlayer(
      page,
      "2",
      createFirstScenarioHauntRuntimeCore(),
    );
    await page.getByTestId("betrayal-open-scenario").click();
    const traitorReader = page.getByTestId("betrayal-scenario-reader-dialog");
    await expect(traitorReader).toBeVisible();
    await expect(
      traitorReader.getByTestId("betrayal-scenario-objective-page"),
    ).toHaveAttribute("data-scenario-reader-scope", "traitor");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-reader-role"),
    ).toContainText("叛徒剧本书");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-reader-source-status"),
    ).toContainText("非原文摘要");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-traitor"),
    ).toContainText("叛徒手册");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-monster"),
    ).toContainText("杰克之灵");
    await expect(traitorReader).not.toContainText("英雄手册");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-heroes"),
    ).toHaveCount(0);
    await saveScreenshot(page, TRAITOR_READER_SCREENSHOT);

    await openInjectedCoreAsPlayer(
      page,
      "0",
      createFirstScenarioReadyToExorciseRuntimeCore(),
    );
    await dismissHauntRevealIfPresent(page);
    await expect(page.getByTestId("betrayal-open-scenario")).toBeVisible();
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      /驱魔|驱散杰克之灵/,
    );
    await expect(page.getByTestId("betrayal-room-focus-target")).toContainText(
      /驱魔|驱散杰克之灵/,
    );
    await saveScreenshot(page, OBJECTIVE_HANDOFF_SCREENSHOT);

    await openInjectedCoreAsPlayer(
      page,
      "0",
      createFirstScenarioSurvivorEndgameCore(),
    );
    const survivorEndgame = page.getByTestId("betrayal-endgame-screen");
    await expect(survivorEndgame).toBeVisible({ timeout: 30000 });
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("结局朗读");
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-source-status"),
    ).toContainText("非原文摘要");
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("杰克之灵消失");
    await saveScreenshot(page, SURVIVOR_ENDING_SCREENSHOT);

    await openInjectedCoreAsPlayer(
      page,
      "2",
      createFirstScenarioReadyToTraitorVictoryRuntimeCore(),
    );
    await setHarnessRandomQueue(page, [
      0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    ]);
    const heroTarget = page.getByTestId("betrayal-room-occupant-ground-north-1");
    await expect(heroTarget).toBeVisible();
    await expect(heroTarget).toHaveAttribute("data-direct-target", "true");
    await heroTarget.click();
    const traitorEndgame = page.getByTestId("betrayal-endgame-screen");
    await expect(traitorEndgame).toBeVisible({ timeout: 30000 });
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("结局朗读");
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-source-status"),
    ).toContainText("非原文摘要");
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("吹起轻快的口哨");
    await saveScreenshot(page, TRAITOR_ENDING_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-scenario-flow-new-rules", diagnostics },
    ]);
  });
});
