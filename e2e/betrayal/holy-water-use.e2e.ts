import { expect, test } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  createHolyWaterUseReadyRuntimeCore,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/山屋惊魂-奇怪的药品使用完整链路";
const USE_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-药品使用前牌桌可操作.jpg`;
const ITEM_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-奇怪的药品本体已选中.jpg`;
const USE_READY_AFTER_SELECT_SCREENSHOT = `${EVIDENCE_DIR}/03-药品无需目标可直接使用.jpg`;
const USE_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/04-药品结算结果可见.jpg`;
const USE_RETURNED_SCREENSHOT = `${EVIDENCE_DIR}/05-药品使用后回牌桌状态清空.jpg`;
const FINAL_BOARD_SCREENSHOT = `${EVIDENCE_DIR}/06-收口后牌桌继续可操作.jpg`;

async function readHolyWaterUseState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const rectOf = (testId: string) => {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
      };
    };
    const holder = window as unknown as {
      __BG_TEST_HARNESS__?: {
        state?: {
          get?: () => {
            core?: {
              currentExplorer?: {
                traits?: Record<string, number>;
                inventory?: Array<{ id: string; name: string }>;
              };
              currentExplorerInventory?: Array<{ id: string; name: string }>;
              currentExplorerTraits?: Record<string, number>;
              usedCardIdsThisTurn?: string[];
              activityLog?: Array<{ text: string }>;
            };
          };
        };
      };
      __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
    };
    const core = holder.__BG_TEST_HARNESS__?.state?.get?.().core;
    const useButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="betrayal-action-use"]',
    );
    return {
      cardRect: rectOf("betrayal-inventory-holy-water"),
      useButtonRect: rectOf("betrayal-action-use"),
      useButtonDisabled: Boolean(useButton?.disabled),
      selectedName:
        document
          .querySelector(
            '[data-testid="betrayal-selected-inventory-card-name"]',
          )
          ?.textContent?.trim() ?? "",
      useStatus:
        document
          .querySelector('[data-testid="betrayal-use-status"]')
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "",
      targetSelectorCount: document.querySelectorAll(
        '[data-testid="betrayal-inventory-target-player-selector"]',
      ).length,
      feedback:
        document
          .querySelector('[data-testid="betrayal-room-latest-feedback"]')
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "",
      inventory:
        core?.currentExplorer?.inventory?.map((card) => card.name) ?? [],
      currentInventory:
        core?.currentExplorerInventory?.map((card) => card.name) ?? [],
      traits: core?.currentExplorer?.traits ?? {},
      projectedTraits: core?.currentExplorerTraits ?? {},
      usedCards: core?.usedCardIdsThisTurn ?? [],
      latestLog: core?.activityLog?.[0]?.text ?? "",
      rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
    };
  });
}

test.describe("山屋惊魂奇怪的药品完整链路", () => {
  test("真实页面选择奇怪的药品、直接使用并恢复力量速度收口", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, "betrayal-holy-water-use");

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "commit", timeout: 30000 });
    await page
      .waitForLoadState("domcontentloaded", { timeout: 5000 })
      .catch(() => undefined);
    await waitForBetrayalPageReady(page);
    await injectCore(page, createHolyWaterUseReadyRuntimeCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await expect(
      page.getByTestId("betrayal-inventory-holy-water"),
      "使用前必须看得到奇怪的药品本体",
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-action-use"),
      "未选药品前使用按钮应禁用",
    ).toBeDisabled();
    let state = await readHolyWaterUseState(page);
    expect(
      state.cardRect?.width ?? 0,
      "奇怪的药品必须保持真实牌面宽度，不能退成小文字选项",
    ).toBeGreaterThanOrEqual(58);
    expect(
      state.useButtonRect?.width ?? 0,
      "使用按钮必须保持可点击尺寸",
    ).toBeGreaterThanOrEqual(80);
    expect(state.selectedName, "使用前不能已有选中物品").toBe("");
    expect(state.traits.might, "测试态必须先损失力量，才能证明药品结算").toBe(
      1,
    );
    expect(state.traits.speed, "测试态必须先损失速度，才能证明药品结算").toBe(
      1,
    );
    await saveScreenshot(page, USE_READY_SCREENSHOT);

    await page.getByTestId("betrayal-inventory-holy-water").click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("奇怪的药品");
    await expect(
      page.getByTestId("betrayal-action-use"),
      "奇怪的药品治疗自己，不应要求再选目标",
    ).toBeEnabled();
    state = await readHolyWaterUseState(page);
    expect(state.useStatus, "选中药品后必须说明本次使用效果").toContain("力量");
    expect(state.useStatus, "选中药品后必须说明本次使用效果").toContain("速度");
    expect(
      state.targetSelectorCount,
      "奇怪的药品治疗自己，不应出现队友目标选择器",
    ).toBe(0);
    await saveScreenshot(page, ITEM_SELECTED_SCREENSHOT);
    await saveScreenshot(page, USE_READY_AFTER_SELECT_SCREENSHOT);

    await page.getByTestId("betrayal-action-use").click();
    await expect
      .poll(async () => readHolyWaterUseState(page), {
        message: "奇怪的药品使用后必须消耗物品、恢复力量速度并写入活动反馈",
        timeout: 10000,
      })
      .toMatchObject({
        inventory: expect.not.arrayContaining(["奇怪的药品"]),
        currentInventory: expect.not.arrayContaining(["奇怪的药品"]),
        traits: {
          might: expect.any(Number),
          speed: expect.any(Number),
        },
        projectedTraits: {
          might: expect.any(Number),
          speed: expect.any(Number),
        },
        usedCards: expect.arrayContaining(["holy-water"]),
        latestLog: expect.stringContaining("埋葬奇怪的药品"),
        rejected: null,
      });
    state = await readHolyWaterUseState(page);
    expect(
      state.traits.might,
      "奇怪的药品应恢复当前探索者力量",
    ).toBeGreaterThan(1);
    expect(
      state.traits.speed,
      "奇怪的药品应恢复当前探索者速度",
    ).toBeGreaterThan(1);
    expect(
      state.projectedTraits.might,
      "UI 投影力量也必须同步恢复",
    ).toBeGreaterThan(1);
    expect(
      state.projectedTraits.speed,
      "UI 投影速度也必须同步恢复",
    ).toBeGreaterThan(1);
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("埋葬奇怪的药品");
    await expect(
      page.getByTestId("betrayal-inventory-holy-water"),
      "药品使用后必须从持有区消失",
    ).toHaveCount(0);
    await saveScreenshot(page, USE_SETTLED_SCREENSHOT);

    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
      "药品结算后不能残留已选物品",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-inventory-target-player-selector"),
      "药品结算后不能残留目标选择提示",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-board"),
      "药品使用后必须回到可操作牌桌",
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-action-use"),
      "药品已消耗后使用按钮应禁用",
    ).toBeDisabled();
    await saveScreenshot(page, USE_RETURNED_SCREENSHOT);
    await saveScreenshot(page, FINAL_BOARD_SCREENSHOT);

    await assertNoFatalFrontendErrors([
      { label: "betrayal-holy-water-use", diagnostics },
    ]);
  });
});
