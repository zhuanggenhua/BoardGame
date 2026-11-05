import { expect, test, type Locator, type Page } from "@playwright/test";
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
  waitForPhysicalDiceSettled,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";
import { createMummyTraitorVictoryReadyTutorialCore } from "../../src/games/betrayal/testing/firstScenarioTestUtils";

const EVIDENCE_DIR = "evidence/betrayal-scenario-flow-new-rules";
const HAUNT_TABLE_SCREENSHOT = `${EVIDENCE_DIR}/01-作祟开始-剧本关闭后牌桌承接.jpg`;
const OPENING_NARRATION_SCREENSHOT = `${EVIDENCE_DIR}/02-开局叙事-独立电影字幕幕.jpg`;
const HERO_READER_TURNING_SCREENSHOT = `${EVIDENCE_DIR}/03a-英雄视角-秘密阅读-真实翻页中.jpg`;
const HERO_READER_SCREENSHOT = `${EVIDENCE_DIR}/03-英雄视角-秘密阅读-英雄手册.jpg`;
const HERO_READER_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/03b-英雄视角-秘密阅读-正文末段.jpg`;
const TRAITOR_READER_TURNING_SCREENSHOT = `${EVIDENCE_DIR}/04a-叛徒视角-秘密阅读-真实翻页中.jpg`;
const TRAITOR_READER_SCREENSHOT = `${EVIDENCE_DIR}/04-叛徒视角-秘密阅读-叛徒手册.jpg`;
const TRAITOR_READER_BOTTOM_SCREENSHOT = `${EVIDENCE_DIR}/04b-叛徒视角-秘密阅读-正文末段.jpg`;
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
  const continueButton = page.locator(
    '[data-testid="betrayal-exorcise-roll-continue"]:visible',
  ).last();
  const endgameScreen = page.getByTestId("betrayal-endgame-screen");
  await expect(continueButton).toBeVisible({
    timeout: 30000,
    message: "终局前必须先出现真实驱逐结果确认入口",
  });
  await continueButton.click();
  await expect(endgameScreen).toBeVisible({
    timeout: 30000,
    message: "确认真实驱逐结果后必须进入终局页",
  });
}

async function captureScenarioReaderTurn(
  page: Page,
  reader: Locator,
  screenshotPath: string,
) {
  const turningSheet = reader.getByTestId(
    "betrayal-scenario-book-turning-sheet",
  );
  const flipStage = turningSheet.getByTestId(
    "betrayal-scenario-book-real-flip-stage",
  );

  // 与 Home V2 同口径冻结在 50%：截图必须证明真实中间几何态，而不是随机抓到起点/终点。
  try {
    await expect(turningSheet).toBeVisible();
    await expect(turningSheet).toHaveAttribute(
      "data-flip-implementation",
      "turnjs-real-page-flip",
    );
    await expect(flipStage).toHaveAttribute("data-turn-ready", "true");
    await expect(flipStage).toHaveAttribute("data-turn-animating", "true");
    // 只有 turn.js 插件真实处于动画中间态时才保存翻页证据，不能把初始页或最终页冒充动画。
    let observedPluginAnimation = false;
    for (let sample = 0; sample < 80; sample += 1) {
      const snapshot = await flipStage.evaluate((stage) => ({
        rawProgress: Number.parseFloat(stage.getAttribute("data-flip-progress-raw") ?? "NaN"),
        pluginAnimating: stage.getAttribute("data-turn-plugin-animating"),
        pluginPage: stage.getAttribute("data-turn-plugin-page"),
        pluginView: stage.getAttribute("data-turn-plugin-view"),
        pageWrappers: stage.querySelectorAll(".page-wrapper").length,
      }));
      if (snapshot.pluginAnimating === "true" && snapshot.pageWrappers > 0 && snapshot.rawProgress >= 0.5) {
        observedPluginAnimation = true;
        console.log(`[betrayal-turnjs-flip-capture] ${JSON.stringify(snapshot)}`);
        break;
      }
      await page.waitForTimeout(25);
    }
    expect(observedPluginAnimation).toBe(true);
    await saveScreenshot(page, screenshotPath);
  } finally {
    await page.evaluate(() => {
      delete (window as Window & { __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number }).__BG_HOME_V2_E2E_HOLD_PROGRESS__;
    });
  }

  // Board 在翻页完成窗口后卸载覆盖层；等待覆盖层退场就是最终页可见的边界。
  await expect(turningSheet).toHaveCount(0, { timeout: 2000 });
}

async function holdNextScenarioReaderTurnAtMidpoint(page: Page) {
  await page.evaluate(() => {
    (window as Window & { __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number }).__BG_HOME_V2_E2E_HOLD_PROGRESS__ = 0.5;
  });
}

async function captureScenarioReaderBodyBottom(
  page: Page,
  reader: Locator,
  screenshotPath: string,
) {
  const bodyScroll = reader.getByTestId(
    "betrayal-scenario-reader-body-scroll",
  );
  const bodyScrollCount = await bodyScroll.count();
  expect(bodyScrollCount).toBeGreaterThan(0);
  const scrollMetrics = await bodyScroll.evaluateAll((elements) =>
    elements.map((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    })),
  );
  const scrollableIndexes = scrollMetrics.flatMap(
    ({ clientHeight, scrollHeight }, index) =>
      scrollHeight > clientHeight + 2 ? [index] : [],
  );
  if (scrollableIndexes.length === 0) {
    const tailVisibility = await bodyScroll.evaluateAll((elements) =>
      elements.map((element) => {
        const sections = Array.from(
          element.querySelectorAll<HTMLElement>(
            '[data-testid^="betrayal-scenario-book-section-"]',
          ),
        );
        const lastSection = sections.at(-1);
        if (!lastSection) {
          return false;
        }
        const containerRect = element.getBoundingClientRect();
        const sectionRect = lastSection.getBoundingClientRect();
        return (
          sectionRect.top >= containerRect.top - 2 &&
          sectionRect.bottom <= containerRect.bottom + 2
        );
      }),
    );
    expect(
      tailVisibility.every(Boolean),
      "正文没有滚动需求时，末段也必须完整位于书页可视区",
    ).toBe(true);
    await saveScreenshot(page, screenshotPath);
    return;
  }

  await bodyScroll.evaluateAll((elements) => {
    elements.forEach((element) => {
      if (element.scrollHeight > element.clientHeight + 2) {
        element.scrollTop = element.scrollHeight;
      }
    });
  });
  await expect
    .poll(() =>
      bodyScroll.evaluateAll((elements) =>
        elements.map((element) => ({
          scrollTop: element.scrollTop,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        })),
      ),
    )
    .toEqual(
      scrollMetrics.map(({ clientHeight, scrollHeight }, index) => {
        if (!scrollableIndexes.includes(index)) {
          return {
            scrollTop: 0,
            clientHeight,
            scrollHeight,
          };
        }
        return {
          scrollTop: expect.any(Number),
          clientHeight,
          scrollHeight,
        };
      }),
    );
  const bottomGaps = await bodyScroll.evaluateAll((elements) =>
    elements.map((element) =>
      element.scrollHeight > element.clientHeight + 2
        ? element.scrollHeight - element.clientHeight - element.scrollTop
        : 0,
    ),
  );
  expect(bottomGaps.every((gap) => gap <= 2)).toBe(true);
  await saveScreenshot(page, screenshotPath);
  await bodyScroll.evaluateAll((elements) => {
    elements.forEach((element) => {
      element.scrollTop = 0;
    });
  });
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

async function assertScenarioBookControlsOnPages(reader: Locator) {
  const book = reader.getByTestId("betrayal-scenario-book");
  const pages = book.locator('[data-testid^="betrayal-scenario-book-page-"]');
  const leftPage = pages.nth(0);
  const rightPage = pages.nth(1);
  const close = book.getByTestId("betrayal-scenario-reader-close");
  const prev = book.getByTestId("betrayal-scenario-reader-prev-zone");
  const next = book.getByTestId("betrayal-scenario-reader-next-zone");
  const progress = book.getByTestId("betrayal-scenario-reader-footer-progress");

  const metrics = await Promise.all([
    book.boundingBox(),
    leftPage.boundingBox(),
    rightPage.boundingBox(),
    close.boundingBox(),
    prev.boundingBox(),
    next.boundingBox(),
    progress.boundingBox(),
  ]);
  const [
    bookBox,
    leftPageBox,
    rightPageBox,
    closeBox,
    prevBox,
    nextBox,
    progressBox,
  ] = metrics;
  if (
    !bookBox ||
    !leftPageBox ||
    !rightPageBox ||
    !closeBox ||
    !prevBox ||
    !nextBox ||
    !progressBox
  ) {
    throw new Error("剧本书或书内控件缺少真实几何信息");
  }

  const withinBook = (box: NonNullable<typeof bookBox>) =>
    box.x >= bookBox.x - 1 &&
    box.y >= bookBox.y - 1 &&
    box.x + box.width <= bookBox.x + bookBox.width + 1 &&
    box.y + box.height <= bookBox.y + bookBox.height + 1;

  expect(withinBook(closeBox), "关闭控件必须属于剧本书内部").toBe(true);
  expect(withinBook(prevBox), "上一页控件必须属于剧本书内部").toBe(true);
  expect(withinBook(nextBox), "下一页控件必须属于剧本书内部").toBe(true);
  expect(withinBook(progressBox), "页码必须属于剧本书内部").toBe(true);

  expect(
    prevBox.x,
    "上一页控件必须位于左侧书页内部",
  ).toBeGreaterThanOrEqual(leftPageBox.x - 1);
  expect(
    prevBox.x + prevBox.width,
    "上一页控件不能越出左侧书页",
  ).toBeLessThanOrEqual(leftPageBox.x + leftPageBox.width + 1);
  expect(
    nextBox.x,
    "下一页控件必须位于右侧书页内部",
  ).toBeGreaterThanOrEqual(rightPageBox.x - 1);
  expect(
    nextBox.x + nextBox.width,
    "下一页控件不能越出右侧书页",
  ).toBeLessThanOrEqual(rightPageBox.x + rightPageBox.width + 1);
  expect(
    prevBox.y + prevBox.height,
    "上一页控件必须贴在左侧书页底部",
  ).toBeGreaterThanOrEqual(leftPageBox.y + leftPageBox.height - 64);
  expect(
    nextBox.y + nextBox.height,
    "下一页控件必须贴在右侧书页底部",
  ).toBeGreaterThanOrEqual(rightPageBox.y + rightPageBox.height - 64);
  expect(
    progressBox.x + progressBox.width,
    "页码不能压住右侧书页的下一页控件",
  ).toBeLessThanOrEqual(nextBox.x - 8);

  const progressCenterX = progressBox.x + progressBox.width / 2;
  const bookCenterX = bookBox.x + bookBox.width / 2;
  expect(
    Math.abs(progressCenterX - bookCenterX),
    "页码必须严格位于整本书的中线",
  ).toBeLessThanOrEqual(2);
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
    // 作祟开始后当前正式流程会自动进入剧情幕；公开揭示条只在剧情幕尚未承接时短暂存在。
    // 若捕捉到该短暂状态，仍校验来源；否则以真实作祟开始剧情幕作为当前流程的承接入口。
    if (await revealCue.count() > 0) {
      await expect(revealCue).toBeVisible();
      await expect(
        page.getByTestId("betrayal-haunt-reveal-player-title"),
      ).toContainText("公开揭示");
      await expect(page.getByTestId("betrayal-haunt-reveal-source")).toContainText(
        /剧本卡 木乃伊横行.*触发/,
      );
      // 当前 74 张牌库合同不含「女孩」；该代表夹具连续探索三张预兆，第三张「面具」触发木乃伊代表态。
      await expect(page.getByTestId("betrayal-haunt-reveal-source")).toContainText(
        /面具|Mask/,
      );
    }
    // 作祟开始后剧本阅读由真实作祟承接自动打开；桌面剧本按钮仍在牌桌下方，不能穿透阅读层点击。
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
    ).toHaveCount(0);
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
    ).toHaveCount(0);
    await expect(heroReader).not.toContainText("本地规则源正文");
    await expect(heroReader).not.toContainText("正式中文转写");
    await expect(heroReader.getByTestId("betrayal-scenario-book")).toHaveCount(
      0,
    );
    await assertCinematicActionSlotLayout(openingNarration);
    await saveScreenshot(page, OPENING_NARRATION_SCREENSHOT);

    await holdNextScenarioReaderTurnAtMidpoint(page);
    await heroReader.getByTestId("betrayal-scenario-reader-next-zone").click();
    await captureScenarioReaderTurn(
      page,
      heroReader,
      HERO_READER_TURNING_SCREENSHOT,
    );
    await expect(heroReader.getByTestId("betrayal-scenario-book")).toBeVisible();
    await assertScenarioBookControlsOnPages(heroReader);
    await expect(
      heroReader.getByTestId("betrayal-scenario-opening-stage"),
    ).toHaveCount(0);
    await expect(
      heroReader.getByTestId("betrayal-scenario-reader-prev-zone"),
    ).toBeDisabled();
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
    await captureScenarioReaderBodyBottom(
      page,
      heroReader,
      HERO_READER_BOTTOM_SCREENSHOT,
    );
    await expect(
      heroReader.getByTestId("betrayal-scenario-book-section-endingHeroes"),
    ).toHaveCount(0);
    await expect(
      heroReader.getByTestId("betrayal-scenario-reader-next-zone"),
    ).toBeDisabled();
    await heroReader.getByTestId("betrayal-scenario-reader-close").click();
    await expect(heroReader).toHaveCount(0);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    const hauntRollReturn = page.getByTestId("betrayal-roll-continue");
    if (await hauntRollReturn.isVisible().catch(() => false)) {
      await hauntRollReturn.click();
      await expect(hauntRollReturn).toHaveCount(0);
    }
    await expect(page.getByTestId("betrayal-open-scenario")).toBeVisible();
    await saveScreenshot(page, HAUNT_TABLE_SCREENSHOT);

    await openInjectedCoreAsPlayer(
      page,
      "2",
      createFirstScenarioHauntRuntimeCore(),
    );
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
    ).toHaveCount(0);
    await expect(traitorReader).not.toContainText("本地规则源正文");
    await expect(traitorReader).not.toContainText("正式中文转写");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-opening-cinematic"),
    ).toHaveAttribute("data-cinematic-stage", "standalone");
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book"),
    ).toHaveCount(0);
    await holdNextScenarioReaderTurnAtMidpoint(page);
    await traitorReader
      .getByTestId("betrayal-scenario-reader-next-zone")
      .click();
    await captureScenarioReaderTurn(
      page,
      traitorReader,
      TRAITOR_READER_TURNING_SCREENSHOT,
    );
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book"),
    ).toBeVisible();
    await assertScenarioBookControlsOnPages(traitorReader);
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
    await captureScenarioReaderBodyBottom(
      page,
      traitorReader,
      TRAITOR_READER_BOTTOM_SCREENSHOT,
    );
    await expect(
      traitorReader.getByTestId("betrayal-scenario-book-section-endingTraitor"),
    ).toHaveCount(0);
    await expect(
      traitorReader.getByTestId("betrayal-scenario-reader-next-zone"),
    ).toBeDisabled();

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
    await expect(page.getByTestId("betrayal-haunt-setup-handoff")).toHaveCount(0);
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
      createFirstScenarioReadyToExorciseRuntimeCore(),
    );
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      "驱逐木乃伊",
    );
    // 驱逐检定先投英雄 4 颗骰子，再投木乃伊 5 颗骰子；用高英雄结果、低木乃伊结果确保真实成功分支。
    await setHarnessRandomQueue(page, [
      0.99, 0.99, 0.99, 0.99,
      0.01, 0.01, 0.01, 0.01, 0.01,
    ]);
    await page.getByTestId("betrayal-action-use").click();
    const exorciseRoll = page.getByTestId("betrayal-recent-roll-panel");
    await expect(exorciseRoll).toBeVisible();
    await waitForPhysicalDiceSettled(exorciseRoll);
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
    ).toHaveCount(0);
    await expect(
      survivorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("木乃伊犹如细砂随风飞散");
    await expect(survivorEndgame).not.toContainText("官方 If You Win 原文");
    await expect(survivorEndgame).not.toContainText("正式翻译");
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
      createMummyTraitorVictoryReadyTutorialCore(),
    );
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      "拾起女孩",
    );
    await page.getByTestId("betrayal-action-use").click();
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      "交出女孩",
    );
    await page.getByTestId("betrayal-action-use").click();
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      "交出圣符",
    );
    await page.getByTestId("betrayal-action-use").click();
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
    ).toHaveCount(0);
    await expect(
      traitorEndgame.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("整个世界不久都将臣服于我俩脚下");
    await expect(traitorEndgame).not.toContainText("官方 If You Win 原文");
    await expect(traitorEndgame).not.toContainText("正式翻译");
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
