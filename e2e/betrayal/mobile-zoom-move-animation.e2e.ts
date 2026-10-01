import { expect, test } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  initBetrayalContext,
  injectCore,
  waitForBetrayalPageReady,
} from "./betrayalTestHelpers";
import { createStartedFirstScenarioCore } from "../../src/games/betrayal/testing/firstScenarioTestUtils";

test.describe("山屋惊魂移动端缩放后移动动画", () => {
  test("缩放并平移地图后，移动动画仍与源 token 同比例并落到目标中心", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-mobile-zoom-move-animation",
    );

    await page.setViewportSize({ width: 796, height: 360 });
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);
    await injectCore(page, createStartedFirstScenarioCore(["0", "1", "2"]));
    await expect(page.getByTestId("betrayal-board")).toBeVisible();

    const roomGrid = page.getByTestId("betrayal-room-grid");
    const gridBox = await roomGrid.boundingBox();
    if (!gridBox) {
      throw new Error("移动端缩放回归缺少地图容器");
    }

    await page.mouse.move(
      gridBox.x + gridBox.width / 2,
      gridBox.y + gridBox.height / 2,
    );
    await page.mouse.wheel(0, -1000);
    await page.waitForTimeout(120);
    await page.mouse.move(
      gridBox.x + gridBox.width / 2,
      gridBox.y + gridBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      gridBox.x + gridBox.width / 2 + 90,
      gridBox.y + gridBox.height / 2 + 34,
      { steps: 4 },
    );
    await page.mouse.up();
    await page.waitForTimeout(120);

    const sourceToken = page.getByTestId("betrayal-explorer-figure-token-0");
    const sourceRect = await sourceToken.boundingBox();
    if (!sourceRect) {
      throw new Error("移动端缩放回归缺少移动源 token");
    }

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();

    const transition = page.locator(
      '[data-testid^="betrayal-visual-transition-transition-"]',
    );
    await transition.waitFor({ state: "visible" });
    await page.waitForTimeout(50);

    const geometry = await transition.evaluate((element) => {
      const node = element as HTMLElement;
      const child = node.firstElementChild as HTMLElement | null;
      const childRect = child?.getBoundingClientRect();
      return {
        sourceCenterX: Number(node.dataset.transitionSourceCenterX),
        sourceCenterY: Number(node.dataset.transitionSourceCenterY),
        targetCenterX: Number(node.dataset.transitionTargetCenterX),
        targetCenterY: Number(node.dataset.transitionTargetCenterY),
        childWidth: childRect?.width ?? 0,
        childHeight: childRect?.height ?? 0,
      };
    });
    const targetRect = await page
      .getByTestId("betrayal-room-occupant-hallway-0")
      .boundingBox();
    if (!targetRect) {
      throw new Error("移动端缩放回归缺少移动目标 token");
    }

    expect(geometry.childWidth).toBeCloseTo(sourceRect.width, 0);
    expect(geometry.childHeight).toBeCloseTo(sourceRect.height, 0);
    expect(geometry.sourceCenterX).toBeCloseTo(
      sourceRect.x + sourceRect.width / 2,
      0,
    );
    expect(geometry.sourceCenterY).toBeCloseTo(
      sourceRect.y + sourceRect.height / 2,
      0,
    );
    expect(geometry.targetCenterX).toBeCloseTo(
      targetRect.x + targetRect.width / 2,
      0,
    );
    expect(geometry.targetCenterY).toBeCloseTo(
      targetRect.y + targetRect.height / 2,
      0,
    );

    assertNoFatalFrontendErrors([
      { label: "betrayal-mobile-zoom-move-animation", diagnostics },
    ]);
  });
});
