import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import {
  BETRAYAL_FLOOR_OVERLAY_RESTORE_EVIDENCE_DIR,
  initBetrayalContext,
  waitForBetrayalFloatingTextGone,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";
import {
  createMedicalKitUseReadyCore,
} from "../../src/games/betrayal/testing/firstScenarioTestUtils";
import { injectCore } from "./betrayalTestHelpers";

const ROUTE =
  "/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=0&bgForceCoarsePointer=1";
const PC_VIEWPORT = { width: 1920, height: 1080 } as const;
const VIVO_CSS_VIEWPORT = { width: 796, height: 360 } as const;
const EVIDENCE_DIR =
  "evidence/betrayal-mobile-readable-ability-and-book-20261008";
const HUD_EVIDENCE_DIR = BETRAYAL_FLOOR_OVERLAY_RESTORE_EVIDENCE_DIR;

async function enterStartedBoard(page: Page) {
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await waitForBetrayalPageReady(page);
  await injectCore(page, createMedicalKitUseReadyCore());
  await expect(page.getByTestId("betrayal-board")).toBeVisible();
  await waitForBetrayalFloatingTextGone(page);
  await expect(page.getByTestId("betrayal-inventory-medical-kit")).toBeVisible();
}

async function enterScenarioBook(page: Page) {
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await waitForBetrayalPageReady(page);
  await expect(page.getByTestId("betrayal-character-select-screen")).toBeVisible();
  await page.getByTestId("betrayal-character-confirm").click();
  const scenarioButton = page.getByTestId("betrayal-character-scenario-button");
  await expect(scenarioButton).toContainText("木乃伊横行");
  await scenarioButton.click();
  await expect(page.getByTestId("betrayal-scenario-select-dialog")).toBeVisible();
  await page.getByTestId("betrayal-scenario-detail-toggle").click();
  await expect(page.getByTestId("betrayal-scenario-reader-dialog")).toBeVisible();
  await expect(page.getByTestId("betrayal-scenario-book")).toBeVisible();
}

async function expectFloorSwitcherPinnedAboveEndTurn(page: Page) {
  const geometry = await page.getByTestId("betrayal-room-floor-switcher").evaluate((switcher) => {
    const overlay = switcher.parentElement;
    const dock =
      document.querySelector("[data-testid='betrayal-action-endTurn']") ??
      document.querySelector("[data-testid='betrayal-action-rail']");
    if (!overlay) {
      throw new Error("缺少楼层切换的地图覆盖层父节点");
    }
    if (!dock) {
      throw new Error("缺少结束回合或底部操作栏");
    }
    const switcherRect = switcher.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    return {
      switcherBottom: switcherRect.bottom,
      overlayBottom: overlayRect.bottom,
      dockBottom: dockRect.bottom,
    };
  });
  expect(geometry.overlayBottom - geometry.switcherBottom).toBeGreaterThanOrEqual(4);
  expect(geometry.overlayBottom - geometry.switcherBottom).toBeLessThan(36);
  expect(geometry.dockBottom - geometry.switcherBottom).toBeGreaterThan(12);
}

async function saveDeviceScaleScreenshot(page: Page, relativePath: string) {
  await page.mouse.move(2, 2).catch(() => undefined);
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  await page.waitForTimeout(100);
  const outputPath = resolve(relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  const image = await page.screenshot({
    fullPage: false,
    scale: "device",
    type: "jpeg",
    quality: 95,
  });
  writeFileSync(outputPath, image);
}

async function createContextPage(
  browser: Browser,
  viewport: typeof PC_VIEWPORT | typeof VIVO_CSS_VIEWPORT,
  mobile: boolean,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: "zh-CN",
  });
  await initBetrayalContext(context);
  await warmBetrayalFrontend(context);
  return { context, page: await context.newPage() };
}

test.describe("山屋惊魂能力查看与剧本书 PC / Vivo 视口回归", () => {
  test("手机能力摘要不挡物品栏且可点击放大，剧本书不增加标题", async ({
    browser,
  }) => {
    test.setTimeout(240000);

    const pc = await createContextPage(browser, PC_VIEWPORT, false);
    try {
      await enterStartedBoard(pc.page);
      const pcAbility = pc.page.getByTestId("betrayal-current-ability");
      await expect(pcAbility).toBeVisible();
      await expect(pcAbility).toHaveAttribute("data-ability-display", "expanded");
      await expect(pc.page.getByTestId("betrayal-inventory-medical-kit")).toBeVisible();
      await expect(pc.page.getByTestId("betrayal-current-trait-track-speed")).toBeVisible();
      await saveDeviceScaleScreenshot(
        pc.page,
        `${EVIDENCE_DIR}/01-PC-1920x1080-能力与物品栏.jpg`,
      );
      await expectFloorSwitcherPinnedAboveEndTurn(pc.page);
      await saveDeviceScaleScreenshot(
        pc.page,
        `${HUD_EVIDENCE_DIR}/01-PC-1920x1080-切层贴地图底边高于结束回合.jpg`,
      );
    } finally {
      await pc.context.close();
    }

    const phone = await createContextPage(browser, VIVO_CSS_VIEWPORT, true);
    try {
      await enterStartedBoard(phone.page);
      const phoneViewport = await phone.page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      }));
      expect(phoneViewport).toEqual({ width: 796, height: 360, devicePixelRatio: 3 });

      const compactAbility = phone.page.getByTestId("betrayal-current-ability");
      const inventoryCard = phone.page.getByTestId("betrayal-inventory-medical-kit");
      await expect(compactAbility).toBeVisible();
      await expect(compactAbility).toHaveAttribute("data-ability-display", "compact");
      await expect(compactAbility).toContainText("特性：无特殊能力");
      const compactAbilityMetrics = await compactAbility.evaluate((element) => {
        const description = element.querySelector("[data-ability-description='true']");
        const descriptionStyle = description instanceof HTMLElement
          ? getComputedStyle(description)
          : null;
        return {
          text: element.textContent?.replace(/\s+/g, "") ?? "",
          whiteSpace: descriptionStyle?.whiteSpace ?? "",
          overflow: descriptionStyle?.overflow ?? "",
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      });
      expect(compactAbilityMetrics.text).toContain("特性：无特殊能力");
      expect(compactAbilityMetrics.whiteSpace).toContain("normal");
      expect(compactAbilityMetrics.overflow).not.toBe("hidden");
      expect(
        compactAbilityMetrics.scrollHeight,
        "能力描述换行后必须完整可见，不能裁成省略号",
      ).toBeLessThanOrEqual(compactAbilityMetrics.clientHeight + 1);
      await expect(inventoryCard).toBeVisible();

      const phoneRects = await phone.page.evaluate(() => {
        const ability = document.querySelector<HTMLElement>(
          '[data-testid="betrayal-current-ability"]',
        );
        const inventory = document.querySelector<HTMLElement>(
          '[data-testid="betrayal-inventory-medical-kit"]',
        );
        if (!ability || !inventory) throw new Error("缺少能力入口或物品栏卡牌");
        const abilityRect = ability.getBoundingClientRect();
        const inventoryRect = inventory.getBoundingClientRect();
        const overlapWidth = Math.max(
          0,
          Math.min(abilityRect.right, inventoryRect.right) -
            Math.max(abilityRect.left, inventoryRect.left),
        );
        const overlapHeight = Math.max(
          0,
          Math.min(abilityRect.bottom, inventoryRect.bottom) -
            Math.max(abilityRect.top, inventoryRect.top),
        );
        const cardHit = document.elementFromPoint(
          inventoryRect.left + inventoryRect.width / 2,
          inventoryRect.top + inventoryRect.height / 2,
        );
        return {
          ability: {
            left: abilityRect.left,
            top: abilityRect.top,
            right: abilityRect.right,
            bottom: abilityRect.bottom,
            width: abilityRect.width,
            height: abilityRect.height,
          },
          inventory: {
            left: inventoryRect.left,
            top: inventoryRect.top,
            right: inventoryRect.right,
            bottom: inventoryRect.bottom,
            width: inventoryRect.width,
            height: inventoryRect.height,
          },
          overlapArea: overlapWidth * overlapHeight,
          cardHitTestId:
            cardHit instanceof HTMLElement
              ? cardHit
                  .closest<HTMLElement>(
                    '[data-testid="betrayal-inventory-medical-kit-shell"]',
                  )
                  ?.dataset.testid ?? null
              : null,
          abilityFontSize: Number.parseFloat(getComputedStyle(ability).fontSize),
          abilityTransform: getComputedStyle(ability).transform,
        };
      });
      console.log("VIVO_ABILITY_INVENTORY_GEOMETRY", JSON.stringify(phoneRects));
      expect(phoneRects.overlapArea, "能力摘要不得覆盖物品卡").toBe(0);
      expect(phoneRects.cardHitTestId).toBe("betrayal-inventory-medical-kit-shell");
      expect(phoneRects.abilityFontSize, "compact 能力保持 PC 设计 16px").toBeCloseTo(16, 0);
      expect(
        phoneRects.ability.height,
        "compact 能力随 HUD 等比缩放，描述换行后仍不得膨胀成真实视口正文块",
      ).toBeLessThan(56);
      await saveDeviceScaleScreenshot(
        phone.page,
        `${EVIDENCE_DIR}/02-Vivo-796x360-DPR3-能力与物品栏.jpg`,
      );
      await expectFloorSwitcherPinnedAboveEndTurn(phone.page);
      await saveDeviceScaleScreenshot(
        phone.page,
        `${HUD_EVIDENCE_DIR}/02-Vivo-796x360-切层贴地图底边高于结束回合.jpg`,
      );

      await compactAbility.click();
      const dialog = phone.page.getByTestId("betrayal-current-ability-dialog");
      const body = phone.page.getByTestId("betrayal-current-ability-dialog-body");
      await expect(dialog).toBeVisible();
      await expect(body).not.toBeEmpty();
      const detailMetrics = await body.evaluate((element) => ({
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        lineHeight: getComputedStyle(element).lineHeight,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      }));
      expect(detailMetrics.fontSize).toBe(16);
      expect(detailMetrics.width).toBeGreaterThan(0);
      await saveDeviceScaleScreenshot(
        phone.page,
        `${EVIDENCE_DIR}/03-Vivo-796x360-DPR3-点击后的能力详情.jpg`,
      );
      await dialog.getByTestId("betrayal-current-ability-dialog-close").click();
      await expect(dialog).toBeHidden();
    } finally {
      await phone.context.close();
    }

    for (const [label, viewport, mobile, screenshotPath] of [
      [
        "PC",
        PC_VIEWPORT,
        false,
        `${EVIDENCE_DIR}/04-PC-1920x1080-剧本书正文无额外标题.jpg`,
      ],
      [
        "Vivo",
        VIVO_CSS_VIEWPORT,
        true,
        `${EVIDENCE_DIR}/05-Vivo-796x360-DPR3-剧本书正文无额外标题.jpg`,
      ],
    ] as const) {
      const current = await createContextPage(browser, viewport, mobile);
      try {
        await enterScenarioBook(current.page);
        const reader = current.page.getByTestId("betrayal-scenario-reader-dialog");
        await expect(
          reader.getByTestId("betrayal-scenario-reader-title"),
          `${label}不应出现额外的剧本标题浮层`,
        ).toHaveCount(0);
        await expect(
          reader,
          `${label}剧本书正文不应再重复出现剧本名标题`,
        ).not.toContainText("木乃伊横行");
        if (mobile) {
          await expect
            .poll(() =>
              current.page.evaluate(
                () => `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
              ),
            )
            .toBe("796x360@3");
        }
        await saveDeviceScaleScreenshot(current.page, screenshotPath);
        await reader.getByTestId("betrayal-scenario-reader-close").click();
        await expect(reader).toBeHidden();
        if (mobile) {
          await saveDeviceScaleScreenshot(
            current.page,
            `${EVIDENCE_DIR}/06-Vivo-796x360-DPR3-关闭剧本书返回选择页.jpg`,
          );
        }
      } finally {
        await current.context.close();
      }
    }
  });

  test("手机过程文案继续按钮保持可读且不膨胀", async ({ browser }) => {
    test.setTimeout(120000);
    const phone = await createContextPage(browser, VIVO_CSS_VIEWPORT, true);
    try {
      await phone.page.goto("/play/betrayal?playerID=0&bgForceCoarsePointer=1", {
        waitUntil: "domcontentloaded",
      });
      await waitForBetrayalPageReady(phone.page);
      await expect(
        phone.page.getByTestId("betrayal-character-select-screen"),
      ).toBeVisible({ timeout: 30000 });
      await phone.page.getByTestId("betrayal-character-confirm").click();
      const scenarioButton = phone.page.getByTestId(
        "betrayal-character-scenario-button",
      );
      await expect(scenarioButton).toContainText("木乃伊横行");
      await scenarioButton.click();
      await expect(
        phone.page.getByTestId("betrayal-scenario-select-dialog"),
      ).toBeVisible();
      await phone.page.getByTestId("betrayal-scenario-select-current").click();
      const openingStage = phone.page.getByTestId(
        "betrayal-start-scenario-opening-stage",
      );
      await expect(openingStage).toBeVisible({ timeout: 30000 });
      const continueButton = phone.page.getByTestId(
        "betrayal-start-scenario-opening-continue",
      );
      await expect(continueButton).toBeVisible();
      const continueBox = await continueButton.boundingBox();
      expect(continueBox, "过程文案继续按钮必须有真实热区").not.toBeNull();
      expect(Math.round(continueBox!.width)).toBeGreaterThanOrEqual(176);
      expect(Math.round(continueBox!.height)).toBeGreaterThanOrEqual(56);
      expect(
        Math.round(continueBox!.height),
        "Continue 必须可读，但不能膨胀成两倍正文高度",
      ).toBeLessThanOrEqual(72);
      const continueFontSize = await continueButton.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      expect(continueFontSize).toBeGreaterThanOrEqual(16);
      await saveDeviceScaleScreenshot(
        phone.page,
        `${EVIDENCE_DIR}/07-Vivo-796x360-DPR3-过程文案继续按钮.jpg`,
      );
    } finally {
      await phone.context.close();
    }
  });
});
