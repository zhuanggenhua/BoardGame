import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  createFirstScenarioHauntRuntimeCore,
  createFirstScenarioReadyToExorciseRuntimeCore,
  createFirstScenarioSurvivorEndgameCore,
  createFirstScenarioTraitorEndgameCore,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/betrayal-scenario-flow-new-rules";
const PUBLIC_REVEAL_SCREENSHOT = `${EVIDENCE_DIR}/01-公开揭示-作祟开始横幅.jpg`;
const OPENING_NARRATION_SCREENSHOT = `${EVIDENCE_DIR}/02-开局叙事-独立电影字幕幕.jpg`;
const HERO_READER_SCREENSHOT = `${EVIDENCE_DIR}/03-英雄视角-秘密阅读-英雄手册.jpg`;
const TRAITOR_READER_SCREENSHOT = `${EVIDENCE_DIR}/04-叛徒视角-秘密阅读-叛徒手册.jpg`;
const OBJECTIVE_HANDOFF_SCREENSHOT = `${EVIDENCE_DIR}/05-目标承接-牌桌任务入口.jpg`;
const SURVIVOR_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/06-结局朗读-幸存者胜利.jpg`;
const TRAITOR_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/07-结局朗读-叛徒胜利.jpg`;

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
  await expect(
    page.locator(
      '[data-testid="betrayal-board"], [data-testid="betrayal-endgame-screen"]',
    ).first(),
  ).toBeVisible({ timeout: 30000 });
}

async function dismissHauntRevealIfPresent(page: Page) {
  const closeButton = page.getByTestId("betrayal-haunt-reveal-close");
  if ((await closeButton.count()) > 0 && (await closeButton.first().isVisible())) {
    await closeButton.first().click();
    await expect(page.getByTestId("betrayal-haunt-reveal-cue")).toHaveCount(0);
  }
}

async function continueToEndgameIfPresent(page: Page) {
  const continueButton = page.getByTestId("betrayal-exorcise-roll-continue");
  if (
    (await continueButton.count()) > 0 &&
    (await continueButton.first().isVisible())
  ) {
    await continueButton.first().click();
  }
}

async function assertCinematicActionSlotLayout(narration: Locator) {
  const actionSlot = narration.getByTestId("betrayal-cinematic-action-slot");
  const action = actionSlot.locator("button").first();
  const terminalMark = narration.getByTestId(
    "betrayal-cinematic-terminal-mark",
  );

  await expect(actionSlot).toBeVisible();
  await expect(action).toBeVisible();
  await expect(terminalMark).toBeVisible();

  const [narrationBox, actionBox, terminalMarkBox] = await Promise.all([
    narration.boundingBox(),
    action.boundingBox(),
    terminalMark.boundingBox(),
  ]);
  if (!narrationBox || !actionBox || !terminalMarkBox) {
    throw new Error("电影字幕幕动作槽几何信息缺失，无法证明按钮未重叠");
  }

  const narrationCenterX = narrationBox.x + narrationBox.width / 2;
  const actionCenterX = actionBox.x + actionBox.width / 2;
  expect(Math.abs(actionCenterX - narrationCenterX)).toBeLessThanOrEqual(4);
  expect(actionBox.y - (terminalMarkBox.y + terminalMarkBox.height)).toBeGreaterThanOrEqual(
    6,
  );
}

test.describe("山屋惊魂剧本流程新规覆盖", () => {
  test("公开揭示、分阵营阅读、开局叙事和目标承接都有独立证据", async ({
    page,
    context,
  }) => {
    test.setTimeout(150000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-scenario-flow-new-rules-opening",
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
    const openingNarration = heroReader.getByTestId(
      "betrayal-scenario-opening-cinematic",
    );
    await expect(
      heroReader.getByTestId("betrayal-scenario-opening-stage"),
    ).toBeVisible();
    await expect(openingNarration).toContainText("山屋异象");
    await expect(openingNarration).toHaveAttribute(
      "data-cinematic-narration",
      "opening",
    );
    await expect(openingNarration).toHaveAttribute(
      "data-cinematic-stage",
      "standalone",
    );
    await expect(
      heroReader.getByTestId("betrayal-scenario-opening-source-status"),
    ).toContainText("非原文摘要");
    await expect(heroReader.getByTestId("betrayal-scenario-book")).toHaveCount(
      0,
    );
    await assertCinematicActionSlotLayout(openingNarration);
    await saveScreenshot(page, OPENING_NARRATION_SCREENSHOT);

    await heroReader.getByTestId("betrayal-scenario-reader-next-zone").click();
    await expect(heroReader.getByTestId("betrayal-scenario-book")).toBeVisible();
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-prologue"),
    ).toHaveCount(0);
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-heroes"),
    ).not.toContainText("山屋异象");
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-heroes"),
    ).toContainText("英雄手册");
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-setup"),
    ).toHaveCount(0);
    await expect(heroReader).not.toContainText("开局记录");
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
      traitorReader.getByTestId("betrayal-scenario-opening-cinematic"),
    ).toHaveAttribute("data-cinematic-stage", "standalone");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book"),
    ).toHaveCount(0);
    await traitorReader
      .getByTestId("betrayal-scenario-reader-next-zone")
      .click();
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book"),
    ).toBeVisible();
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-prologue"),
    ).toHaveCount(0);
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-traitor"),
    ).toContainText("叛徒手册");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-monster"),
    ).toContainText("杰克之灵");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-setup"),
    ).toHaveCount(0);
    await expect(traitorReader).not.toContainText("开局记录");
    await expect(traitorReader).not.toContainText("英雄手册");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-heroes"),
    ).toHaveCount(0);
    await saveScreenshot(page, TRAITOR_READER_SCREENSHOT);
    await traitorReader
      .getByTestId("betrayal-scenario-reader-next-zone")
      .click();
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-ending"),
    ).toContainText("胜负判定");

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
    await expect(page.getByTestId("betrayal-haunt-setup-handoff")).toBeVisible();
    await expect(
      page.getByTestId("betrayal-haunt-setup-handoff-label"),
    ).toContainText("开局承接");
    await expect(
      page.getByTestId("betrayal-haunt-setup-handoff-text"),
    ).toContainText("驱魔法阵");
    await saveScreenshot(page, OBJECTIVE_HANDOFF_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-scenario-flow-new-rules-opening", diagnostics },
    ]);
  });

  test("幸存者和叛徒结局都有朗读正文和来源状态", async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-scenario-flow-new-rules-endings",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);

    await openInjectedCoreAsPlayer(
      page,
      "0",
      createFirstScenarioSurvivorEndgameCore(),
    );
    await continueToEndgameIfPresent(page);
    const survivorEndgame = page.getByTestId("betrayal-endgame-screen");
    await expect(survivorEndgame).toBeVisible({ timeout: 30000 });
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-stage"),
    ).toBeVisible();
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("结局朗读");
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toHaveAttribute("data-cinematic-narration", "ending-survivors");
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toHaveAttribute("data-cinematic-stage", "standalone");
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-result-report"),
    ).toHaveCount(0);
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-source-status"),
    ).toContainText("非原文摘要");
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("杰克之灵消失");
    await assertCinematicActionSlotLayout(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    );
    await saveScreenshot(page, SURVIVOR_ENDING_SCREENSHOT);
    await survivorEndgame
      .getByTestId("betrayal-endgame-ending-continue")
      .click();
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-result-report"),
    ).toBeVisible();
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toHaveCount(0);

    await openInjectedCoreAsPlayer(
      page,
      "2",
      createFirstScenarioTraitorEndgameCore(),
    );
    const traitorEndgame = page.getByTestId("betrayal-endgame-screen");
    await expect(traitorEndgame).toBeVisible({ timeout: 30000 });
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-stage"),
    ).toBeVisible();
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("结局朗读");
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toHaveAttribute("data-cinematic-narration", "ending-traitor");
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toHaveAttribute("data-cinematic-stage", "standalone");
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-result-report"),
    ).toHaveCount(0);
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-source-status"),
    ).toContainText("非原文摘要");
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("吹起轻快的口哨");
    await expect(traitorEndgame).not.toContainText("总点数 8");
    await assertCinematicActionSlotLayout(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    );
    await saveScreenshot(page, TRAITOR_ENDING_SCREENSHOT);
    await traitorEndgame
      .getByTestId("betrayal-endgame-ending-continue")
      .click();
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-result-report"),
    ).toBeVisible();
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toHaveCount(0);

    assertNoFatalFrontendErrors([
      { label: "betrayal-scenario-flow-new-rules-endings", diagnostics },
    ]);
  });
});
