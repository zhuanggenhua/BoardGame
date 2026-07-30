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
      /剧本卡 木乃伊横行.*触发/,
    );
    // 当前 74 张牌库合同只有 9 张预兆且不含「女孩」；运行时揭示源应呈现真实触发牌「书本」。
    await expect(page.getByTestId("betrayal-haunt-reveal-source")).toContainText(
      /书本|Book/,
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
    ).toContainText("本地规则源正文");
    const openingNarration = heroReader.getByTestId(
      "betrayal-scenario-opening-cinematic",
    );
    await expect(
      heroReader.getByTestId("betrayal-scenario-opening-stage"),
    ).toBeVisible();
    await expect(openingNarration).toContainText("挚爱散失于久远洪荒");
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
    ).toContainText("本地规则源正文");
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
    ).toContainText("将木乃伊驱逐回亡者之国");
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-heroes"),
    ).not.toContainText("木乃伊持有女孩");
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-special"),
    ).toContainText("6+知识考验");
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-special"),
    ).toContainText(/英雄.*不可用速度向木乃伊进行袭击/);
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-prologueHeroes"),
    ).toHaveCount(0);
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-prologueTraitor"),
    ).toHaveCount(0);
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-setup"),
    ).toHaveCount(0);
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-traitor"),
    ).toHaveCount(0);
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-monster"),
    ).toHaveCount(0);
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-endingTraitor"),
    ).toHaveCount(0);
    await saveScreenshot(page, HERO_READER_SCREENSHOT);
    await heroReader
      .getByTestId("betrayal-scenario-reader-next-zone")
      .click();
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-endingHeroes"),
    ).toContainText("木乃伊犹如细砂随风飞散");

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
    ).toContainText("本地规则源正文");
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
    ).toContainText("木乃伊持有女孩");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-traitor"),
    ).toContainText("圣符");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-monster"),
    ).toContainText("速度3、力量8、神志5");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-monster"),
    ).toContainText("造成2点或以上的损伤");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-setup"),
    ).toHaveCount(0);
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-prologueHeroes"),
    ).toHaveCount(0);
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-prologueTraitor"),
    ).toHaveCount(0);
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-heroes"),
    ).toHaveCount(0);
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-special"),
    ).toHaveCount(0);
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-endingHeroes"),
    ).toHaveCount(0);
    await saveScreenshot(page, TRAITOR_READER_SCREENSHOT);
    await traitorReader
      .getByTestId("betrayal-scenario-reader-next-zone")
      .click();
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-endingTraitor"),
    ).toContainText("整个世界不久都将臣服于我俩脚下");

    await openInjectedCoreAsPlayer(
      page,
      "0",
      createFirstScenarioReadyToExorciseRuntimeCore(),
    );
    await dismissHauntRevealIfPresent(page);
    await expect(page.getByTestId("betrayal-open-scenario")).toBeVisible();
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      "驱逐木乃伊",
    );
    await expect(page.getByTestId("betrayal-haunt-setup-handoff")).toBeVisible();
    await expect(
      page.getByTestId("betrayal-haunt-setup-handoff-text"),
    ).toContainText("木乃伊");
    await expect(
      page.getByTestId("betrayal-haunt-setup-handoff-text"),
    ).toContainText(/石棺|知识标记/);
    await expect(page.getByTestId("betrayal-board")).toContainText(
      "知识标记",
    );
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
    ).toContainText("官方 If You Win 原文");
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("木乃伊犹如细砂随风飞散");
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
    ).toContainText("官方 If You Win 原文");
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("整个世界不久都将臣服于我俩脚下");
    await expect(traitorEndgame).not.toContainText("杰克之灵消失");
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
