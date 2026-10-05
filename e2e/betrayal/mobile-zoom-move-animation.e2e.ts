import { expect, test } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  waitForBetrayalPageReady,
} from "./betrayalTestHelpers";
import { createStartedFirstScenarioCore } from "../../src/games/betrayal/testing/firstScenarioTestUtils";

test.describe("山屋惊魂移动端缩放后移动动画", () => {
  // Vivo V2314A 横屏：2388x1080 物理像素 / 3x density = 796x360 CSS px。
  test.use({ deviceScaleFactor: 3 });

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
    // 使用与真机相同的 CSS 视口与 DPR，截图物理尺寸为 2388x1080。
    await page.setViewportSize({ width: 796, height: 360 });
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);
    await injectCore(page, createStartedFirstScenarioCore(["0", "1", "2"]));
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await saveScreenshot(
      page,
      "evidence/betrayal-focus-2388x1080/01-before-zoom-pan.png",
    );

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
    await saveScreenshot(
      page,
      "evidence/betrayal-focus-2388x1080/02-after-zoom-pan.png",
    );

    const sourceToken = page
      .getByTestId("betrayal-room-occupant-entrance-hall-0")
      .getByTestId("betrayal-explorer-figure-token-0");
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

    const roomMap = page.getByTestId("betrayal-room-grid");
    await expect(roomMap).toHaveAttribute(
      "data-zoom-pan-target-settled",
      "true",
      { timeout: 5000 },
    );
    const focusGeometry = await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-room-grid"]',
      );
      const token = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-room-occupant-hallway-0"] [data-testid="betrayal-explorer-figure-token-0"]',
      );
      if (!viewport || !token) return null;
      const viewportRect = viewport.getBoundingClientRect();
      const tokenRect = token.getBoundingClientRect();
      const canvas = viewport.querySelector<HTMLElement>(
        '[data-testid="betrayal-room-canvas"]',
      );
      const leftRail = document.querySelector<HTMLElement>('[data-testid="betrayal-left-status-rail"]')?.getBoundingClientRect() ?? null;
      const statusRail = document.querySelector<HTMLElement>('[data-testid="betrayal-status-rail"]')?.getBoundingClientRect() ?? null;
      const leftInset = leftRail ? Math.max(0, leftRail.right - viewportRect.left) : 0;
      const rightInset = statusRail ? Math.max(0, viewportRect.right - statusRail.left) : 0;
      const visibleMapCenterX = viewportRect.left + leftInset + (viewportRect.width - leftInset - rightInset) / 2;
      return {
        viewportCenterX: (viewportRect.left + viewportRect.right) / 2,
        viewportCenterY: (viewportRect.top + viewportRect.bottom) / 2,
        tokenCenterX: (tokenRect.left + tokenRect.right) / 2,
        tokenCenterY: (tokenRect.top + tokenRect.bottom) / 2,
        visibleMapCenterX,
        visibleMapResidualX: (tokenRect.left + tokenRect.right) / 2 - visibleMapCenterX,
        viewportRect,
        tokenRect,
        canvasTransform: canvas?.style.transform ?? null,
        activeTarget: viewport.dataset.zoomPanActiveTarget ?? null,
        targetState: viewport.dataset.zoomPanTargetState ?? null,
        focusInstructionKey: viewport.dataset.roomFocusPanInstructionKey ?? null,
        leftRail: document.querySelector<HTMLElement>('[data-testid="betrayal-left-status-rail"]')?.getBoundingClientRect().toJSON() ?? null,
        statusRail: document.querySelector<HTMLElement>('[data-testid="betrayal-status-rail"]')?.getBoundingClientRect().toJSON() ?? null,
        actionRail: document.querySelector<HTMLElement>('[data-testid="betrayal-action-rail"]')?.getBoundingClientRect().toJSON() ?? null,
        hudPortal: document.querySelector<HTMLElement>('.betrayal-hud-portal-region')?.getBoundingClientRect().toJSON() ?? null,
        runtimeLogs: (window as Window & {
          __BOARDGAME_MOBILE_RUNTIME_LOGS__?: unknown[];
        }).__BOARDGAME_MOBILE_RUNTIME_LOGS__ ?? [],
      };
    });
    console.log(`FOCUS_DEBUG ${JSON.stringify(focusGeometry)}`);
    await saveScreenshot(
      page,
      "evidence/betrayal-focus-2388x1080/03-after-move-focus.png",
    );
    expect(focusGeometry).not.toBeNull();
    expect(Math.abs(focusGeometry!.tokenCenterX - focusGeometry!.viewportCenterX)).toBeLessThan(36);
    expect(Math.abs(focusGeometry!.tokenCenterY - focusGeometry!.viewportCenterY)).toBeLessThan(36);
    expect(Math.abs(focusGeometry!.visibleMapResidualX)).toBeLessThanOrEqual(8);

    assertNoFatalFrontendErrors([
      { label: "betrayal-mobile-zoom-move-animation", diagnostics },
    ]);
  });
});
