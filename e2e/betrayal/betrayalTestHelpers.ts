import { mkdirSync } from "fs";
import { dirname } from "path";
import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  BETRAYAL_COMMANDS,
  type BetrayalCommand,
  type BetrayalCommandMap,
  type BetrayalCore,
  type BetrayalTraitKey,
  createBetrayalMonsterEncounterCore,
} from "../../src/games/betrayal/game";
import { BETRAYAL_DISCOVERY_POOLS } from "../../src/games/betrayal/scenarioConfig";
import {
  applyBetrayalCommand,
  createBetrayalScriptedRandom,
  createCorpseLootReadyCore,
  createDogTradeReadyCore,
  createDustHauntCore,
  createDustFeverishAttackReadyCore,
  createDustFeverishNaturalMonsterTurnBeforeRollCore,
  createExchangeReadyCore,
  createFirstScenarioHauntCore,
  createJackSpiritNaturalMonsterTurnBeforeRollCore,
  createJackSpiritMovementRollReadyCore,
  createJackSpiritReviveReadyCore,
  createJackSpiritPostReviveAttackReadyCore,
  createFirstScenarioReadyToLearnAboutJackCore,
  createFirstScenarioReadyToStudyExorcismCore,
  createFirstScenarioReadyToExorciseCore,
  createFirstScenarioReadyToTraitorVictoryCore,
  createHeroAttackTraitorReadyCore,
  createHolyWaterUseReadyCore,
  createMaskMoveReadyCore,
  createMedicalKitUseReadyCore,
  createSkeletonKeyMoveReadyCore,
  createStartedFirstScenarioCore,
  createTradeReadyCore,
  playFirstScenarioToSurvivorVictory,
} from "../../src/games/betrayal/testing/firstScenarioTestUtils";
import type { Command, MatchState } from "../../src/engine/types";
import {
  disableAudio,
  disableTutorial,
  setChineseLocale,
  waitForTestHarness,
} from "../helpers/common";

type BetrayalHarnessSnapshot = {
  core: BetrayalCore;
  sys?: MatchState<BetrayalCore>["sys"];
};

type BetrayalHarnessWindow = Window & {
  __E2E_TEST_MODE__?: boolean;
  __BG_TEST_HARNESS__?: {
    state?: {
      isRegistered?: () => boolean;
      get?: () => BetrayalHarnessSnapshot;
      set?: (state: BetrayalHarnessSnapshot) => Promise<void> | void;
    };
    command?: {
      isRegistered?: () => boolean;
      dispatch?: (command: Command) => Promise<void> | void;
    };
    random?: {
      setQueue?: (values: number[]) => void;
    };
  };
};

export const initBetrayalContext = async (
  context: BrowserContext,
  options?: { skipTutorial?: boolean },
) => {
  await setChineseLocale(context);
  if (options?.skipTutorial !== false) {
    await disableTutorial(context);
  }
  await disableAudio(context);
  await context.addInitScript(() => {
    (window as BetrayalHarnessWindow).__E2E_TEST_MODE__ = true;
  });
};

export const waitForBetrayalHarnessState = async (
  page: Page,
  timeout = 30000,
) => {
  await page.waitForFunction(
    () =>
      Boolean(
        (
          window as BetrayalHarnessWindow
        ).__BG_TEST_HARNESS__?.state?.isRegistered?.(),
      ),
    { timeout },
  );
};

export const waitForBetrayalHarnessCommand = async (
  page: Page,
  timeout = 30000,
) => {
  await page.waitForFunction(
    () =>
      Boolean(
        (
          window as BetrayalHarnessWindow
        ).__BG_TEST_HARNESS__?.command?.isRegistered?.(),
      ),
    { timeout },
  );
};

const readBetrayalPageDiagnostics = async (page: Page) => {
  return page
    .evaluate(() => {
      const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
      const rescueGate = document.querySelector(
        '[data-testid="game-page-rescue-gate"]',
      );
      const viewport = document.querySelector(".game-page-viewport");
      const shell = document.querySelector(".mobile-board-shell");
      const content = document.querySelector(".mobile-board-shell__content");
      const loadingScreen = document.querySelector(
        '[data-testid="loading-screen"]',
      );
      const viteOverlay = document.querySelector("vite-error-overlay");
      const rect = (element: Element | null) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return `${Math.round(box.width)}x${Math.round(box.height)}`;
      };

      return {
        href: window.location.href,
        testMode: Boolean((window as BetrayalHarnessWindow).__E2E_TEST_MODE__),
        hasHarness: Boolean(harness),
        harnessStatus:
          typeof harness?.getStatus === "function" ? harness.getStatus() : null,
        hasRescueGate: Boolean(rescueGate),
        rescueText:
          rescueGate?.textContent?.replace(/\s+/g, " ").trim().slice(0, 500) ??
          null,
        viewport: rect(viewport),
        shell: rect(shell),
        content: rect(content),
        hasLoadingScreen: Boolean(loadingScreen),
        hasViteOverlay: Boolean(viteOverlay),
        bodyText:
          document.body.textContent
            ?.replace(/\s+/g, " ")
            .trim()
            .slice(0, 700) ?? "",
      };
    })
    .catch((error) => ({
      diagnosticError: error instanceof Error ? error.message : String(error),
    }));
};

export const waitForBetrayalPageReady = async (page: Page, attempts = 4) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await waitForTestHarness(page, 8000);
      await waitForBetrayalHarnessState(page, 8000);
      return;
    } catch (error) {
      lastError = error;
      const diagnostics = await readBetrayalPageDiagnostics(page);
      const rescueReloadButton = page.getByRole("button", {
        name: /刷新重试/i,
      });
      const rescueGate = page.getByTestId("game-page-rescue-gate");
      const rescueTitle = page.getByText("页面没有正常显示");
      const shouldReloadRescueGate =
        (await rescueGate.isVisible({ timeout: 800 }).catch(() => false)) ||
        (await rescueTitle.isVisible({ timeout: 800 }).catch(() => false));

      if (attempt === attempts - 1) {
        const detail = JSON.stringify(diagnostics, null, 2);
        throw new Error(
          `betrayal 页面未能进入 harness。最后错误：${error instanceof Error ? error.message : String(error)}\n诊断：${detail}`,
        );
      }

      if (shouldReloadRescueGate) {
        await rescueReloadButton
          .click()
          .catch(() => page.reload({ waitUntil: "domcontentloaded" }));
      } else {
        await page.reload({ waitUntil: "domcontentloaded" });
      }
      await page.waitForTimeout(1200);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("betrayal 页面未能稳定进入 harness");
};

export const warmBetrayalFrontend = async (
  context: BrowserContext,
  timeout = 45000,
) => {
  const warmupPage = await context.newPage();
  try {
    await warmupPage.goto("/play/betrayal", {
      waitUntil: "commit",
      timeout,
    });
    await warmupPage
      .waitForLoadState("domcontentloaded", { timeout: 5000 })
      .catch(() => undefined);
    await waitForBetrayalPageReady(warmupPage);
  } finally {
    await warmupPage.close();
  }
};

export const saveScreenshot = async (page: Page, path: string) => {
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false });
};

export const expectVisiblePhysicalDiceBox = async (rollPanel: Locator) => {
  const diceGroup = rollPanel.getByTestId("betrayal-house-dice-3d-group");
  await expect(diceGroup).toBeVisible();
  await expect(diceGroup).toHaveAttribute(
    "data-render-mode",
    "betrayal-house-dice-box-visible",
  );
  await expect(diceGroup).toHaveAttribute(
    "data-dice-tray-style",
    "transparent-virtual",
  );
  await expect(diceGroup).toHaveAttribute("data-dice-count", /[1-9]/);
  try {
    await expect
      .poll(async () => diceGroup.getAttribute("data-dice-physics-ready"), {
        timeout: 30000,
      })
      .toBe("true");
  } catch (error) {
    const diagnostics = await rollPanel.evaluate((node) => {
      const panel = node as HTMLElement;
      const group = panel.querySelector(
        '[data-testid="betrayal-house-dice-3d-group"]',
      ) as HTMLElement | null;
      const source = panel.querySelector(
        '[data-testid="betrayal-house-dice-physics-source"]',
      ) as HTMLElement | null;
      const canvases = Array.from(panel.querySelectorAll("canvas")).filter(
        (canvas): canvas is HTMLCanvasElement =>
          canvas instanceof HTMLCanvasElement,
      );
      const debugRegistry =
        (
          window as typeof window & {
            __diceBoxThreeDebug?: Record<string, () => unknown>;
          }
        ).__diceBoxThreeDebug ?? {};
      const activeCanvas =
        canvases.find((canvas) => {
          const testId = canvas.dataset.testid;
          return Boolean(testId && typeof debugRegistry[testId] === "function");
        }) ??
        canvases[0] ??
        null;
      const activeCanvasTestId =
        activeCanvas?.dataset.testid ?? group?.dataset.diceDebugKey;
      const describeElement = (element: HTMLElement | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          dataset: { ...element.dataset },
        };
      };

      return {
        panel: describeElement(panel),
        group: describeElement(group),
        source: describeElement(source),
        canvasCount: canvases.length,
        canvases: canvases.map((canvas) => {
          const rect = canvas.getBoundingClientRect();
          const style = window.getComputedStyle(canvas);
          return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            dataset: { ...canvas.dataset },
          };
        }),
        activeCanvasTestId,
        engineDebug: activeCanvasTestId
          ? (debugRegistry[activeCanvasTestId]?.() ?? null)
          : (debugRegistry["betrayal-house-dice-box-canvas"]?.() ?? null),
      };
    });
    throw new Error(
      `山屋物理骰子没有渲染就绪：${JSON.stringify(diagnostics)}\n${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const physicsSource = rollPanel.getByTestId(
    "betrayal-house-dice-physics-source",
  );
  await expect(physicsSource).toHaveAttribute(
    "data-dice-physics-source",
    "dice-box-threejs",
  );
  await expect(physicsSource).toHaveAttribute(
    "data-dice-physics-mode",
    "debug-visible",
  );
  await expect(physicsSource).toHaveAttribute(
    "data-dice-face-system",
    "betrayal-house-0-1-2-per-die-skin",
  );
  const readableFaceOverlay = rollPanel.getByTestId(
    "betrayal-house-dice-readable-faces",
  );
  await expect(readableFaceOverlay).toHaveAttribute(
    "data-visual-layer",
    "diagnostic-only",
  );
  await expect(readableFaceOverlay).toHaveClass(/sr-only/);
  await expect
    .poll(
      async () =>
        readableFaceOverlay.evaluate((node) => {
          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return {
            position: style.position,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            overflow: style.overflow,
          };
        }),
      { timeout: 5000 },
    )
    .toEqual({
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
    });
  await expect
    .poll(
      async () =>
        diceGroup.evaluate((node) => {
          const canvases = Array.from(node.querySelectorAll("canvas")).filter(
            (canvas): canvas is HTMLCanvasElement =>
              canvas instanceof HTMLCanvasElement,
          );
          const source = node.querySelector(
            '[data-testid="betrayal-house-dice-physics-source"]',
          ) as HTMLElement | null;
          if (source?.dataset.dicePhysicsSource !== "dice-box-threejs")
            return false;
          if (
            source?.dataset.diceFaceSystem !==
            "betrayal-house-0-1-2-per-die-skin"
          )
            return false;

          return canvases.some((canvas) => {
            const rect = canvas.getBoundingClientRect();
            const style = window.getComputedStyle(canvas);
            return (
              rect.width >= 160 &&
              rect.height >= 120 &&
              canvas.dataset.skinsReady === "true" &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity || "1") > 0.5
            );
          });
        }),
      { timeout: 10000 },
    )
    .toBe(true);
};

export const waitForPhysicalDiceSettled = async (rollPanel: Locator) => {
  const physicsSource = rollPanel.getByTestId(
    "betrayal-house-dice-physics-source",
  );
  await expect
    .poll(async () => physicsSource.getAttribute("data-dice-settled"), {
      timeout: 15000,
    })
    .toBe("true");
  await rollPanel.page().waitForTimeout(450);
};

export const expectPhysicalDiceSeparated = async (
  rollPanel: Locator,
  options: {
    minDiceCount?: number;
    minNormalizedCenterDistance?: number;
    maxOverlapRatio?: number;
    minNormalizedCenterSpan?: number;
    minDieVisualSize?: number;
    minCanvasEdgeMargin?: number;
    minCanvasClientWidth?: number;
    minCanvasClientHeight?: number;
  } = {},
) => {
  const minDiceCount = options.minDiceCount ?? 2;
  const minNormalizedCenterDistance =
    options.minNormalizedCenterDistance ?? 0.72;
  const maxOverlapRatio = options.maxOverlapRatio ?? 0.45;
  const minNormalizedCenterSpan =
    options.minNormalizedCenterSpan ??
    Math.min(2.3, 0.64 * Math.max(1, minDiceCount - 1));

  const metrics = await rollPanel.evaluate((node) => {
    type Layout = {
      x: number;
      y: number;
      width: number;
      height: number;
      visualWidth?: number;
      visualHeight?: number;
    };
    type DebugDie = { layout?: Layout | null };
    type DebugSnapshot = {
      dice?: DebugDie[];
      canvas?: { clientWidth?: number; clientHeight?: number } | null;
    };
    const panel = node as HTMLElement;
    const debugRegistry =
      (
        window as typeof window & {
          __diceBoxThreeDebug?: Record<string, () => DebugSnapshot | null>;
        }
      ).__diceBoxThreeDebug ?? {};
    const canvases = Array.from(panel.querySelectorAll("canvas")).filter(
      (canvas): canvas is HTMLCanvasElement =>
        canvas instanceof HTMLCanvasElement,
    );
    const activeCanvas =
      canvases.find((canvas) => {
        const testId = canvas.dataset.testid;
        return Boolean(testId && typeof debugRegistry[testId] === "function");
      }) ??
      canvases[0] ??
      null;
    const group = panel.querySelector(
      '[data-testid="betrayal-house-dice-3d-group"]',
    ) as HTMLElement | null;
    const activeCanvasTestId =
      activeCanvas?.dataset.testid ?? group?.dataset.diceDebugKey;
    const snapshot = activeCanvasTestId
      ? (debugRegistry[activeCanvasTestId]?.() ?? null)
      : (debugRegistry["betrayal-house-dice-box-canvas"]?.() ?? null);
    const canvasClientWidth = snapshot?.canvas?.clientWidth ?? 0;
    const canvasClientHeight = snapshot?.canvas?.clientHeight ?? 0;
    const canvasRect = activeCanvas?.getBoundingClientRect();
    const displayScaleX =
      canvasRect && canvasClientWidth > 0
        ? canvasRect.width / canvasClientWidth
        : 1;
    const displayScaleY =
      canvasRect && canvasClientHeight > 0
        ? canvasRect.height / canvasClientHeight
        : 1;
    const layouts = (snapshot?.dice ?? [])
      .map((die) => die.layout)
      .filter(
        (layout): layout is Layout =>
          Boolean(layout) &&
          Number.isFinite(layout.x) &&
          Number.isFinite(layout.y) &&
          Number.isFinite(layout.width) &&
          Number.isFinite(layout.height),
      );

    const minDimensions = layouts.map((layout) =>
      Math.min(
        layout.visualWidth ?? layout.width,
        layout.visualHeight ?? layout.height,
      ),
    );
    const displayedMinDimensions = layouts.map((layout) =>
      Math.min(
        (layout.visualWidth ?? layout.width) * displayScaleX,
        (layout.visualHeight ?? layout.height) * displayScaleY,
      ),
    );
    const averageMinDimension = minDimensions.length
      ? minDimensions.reduce((sum, value) => sum + value, 0) /
        minDimensions.length
      : 0;
    const centerXs = layouts.map((layout) => layout.x);
    const centerYs = layouts.map((layout) => layout.y);
    const horizontalCenterSpan = centerXs.length
      ? Math.max(...centerXs) - Math.min(...centerXs)
      : 0;
    const verticalCenterSpan = centerYs.length
      ? Math.max(...centerYs) - Math.min(...centerYs)
      : 0;
    const normalizedCenterSpan =
      averageMinDimension > 0
        ? Math.hypot(horizontalCenterSpan, verticalCenterSpan) /
          averageMinDimension
        : 0;
    let minPairDistance = Number.POSITIVE_INFINITY;
    let minPairNormalizedCenterDistance = Number.POSITIVE_INFINITY;
    let maxPairOverlapRatio = 0;
    let minCanvasEdgeMargin = Number.POSITIVE_INFINITY;

    for (const layout of layouts) {
      const width = layout.visualWidth ?? layout.width;
      const height = layout.visualHeight ?? layout.height;
      minCanvasEdgeMargin = Math.min(
        minCanvasEdgeMargin,
        (layout.x - width / 2) * displayScaleX,
        (canvasClientWidth - (layout.x + width / 2)) * displayScaleX,
        (layout.y - height / 2) * displayScaleY,
        (canvasClientHeight - (layout.y + height / 2)) * displayScaleY,
      );
    }

    for (let leftIndex = 0; leftIndex < layouts.length; leftIndex += 1) {
      const left = layouts[leftIndex];
      const leftWidth = left.visualWidth ?? left.width;
      const leftHeight = left.visualHeight ?? left.height;
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < layouts.length;
        rightIndex += 1
      ) {
        const right = layouts[rightIndex];
        const rightWidth = right.visualWidth ?? right.width;
        const rightHeight = right.visualHeight ?? right.height;
        const centerDistance = Math.hypot(left.x - right.x, left.y - right.y);
        const pairAverageMinDimension =
          (Math.min(leftWidth, leftHeight) +
            Math.min(rightWidth, rightHeight)) /
          2;
        minPairDistance = Math.min(minPairDistance, centerDistance);
        minPairNormalizedCenterDistance = Math.min(
          minPairNormalizedCenterDistance,
          pairAverageMinDimension > 0
            ? centerDistance / pairAverageMinDimension
            : 0,
        );

        const overlapWidth = Math.max(
          0,
          Math.min(left.x + leftWidth / 2, right.x + rightWidth / 2) -
            Math.max(left.x - leftWidth / 2, right.x - rightWidth / 2),
        );
        const overlapHeight = Math.max(
          0,
          Math.min(left.y + leftHeight / 2, right.y + rightHeight / 2) -
            Math.max(left.y - leftHeight / 2, right.y - rightHeight / 2),
        );
        const smallerArea = Math.min(
          leftWidth * leftHeight,
          rightWidth * rightHeight,
        );
        maxPairOverlapRatio = Math.max(
          maxPairOverlapRatio,
          smallerArea > 0 ? (overlapWidth * overlapHeight) / smallerArea : 0,
        );
      }
    }

    return {
      hasSnapshot: Boolean(snapshot),
      activeCanvasTestId,
      diceCount: layouts.length,
      canvasClientWidth,
      canvasClientHeight,
      displayScaleX,
      displayScaleY,
      minDieVisualSize: displayedMinDimensions.length
        ? Math.min(...displayedMinDimensions)
        : 0,
      averageDieVisualSize: averageMinDimension,
      minCanvasEdgeMargin: Number.isFinite(minCanvasEdgeMargin)
        ? minCanvasEdgeMargin
        : 0,
      minPairDistance: Number.isFinite(minPairDistance) ? minPairDistance : 0,
      minNormalizedCenterDistance: Number.isFinite(
        minPairNormalizedCenterDistance,
      )
        ? minPairNormalizedCenterDistance
        : 0,
      maxOverlapRatio: maxPairOverlapRatio,
      normalizedCenterSpan,
      layouts: layouts.map((layout) => ({
        x: Math.round(layout.x),
        y: Math.round(layout.y),
        width: Math.round(layout.visualWidth ?? layout.width),
        height: Math.round(layout.visualHeight ?? layout.height),
      })),
    };
  });

  expect(
    metrics.hasSnapshot,
    `山屋骰盘必须暴露真实 Three.js 调试快照：${JSON.stringify(metrics)}`,
  ).toBe(true);
  expect(
    metrics.diceCount,
    `山屋骰盘必须显示期望数量的独立骰子：${JSON.stringify(metrics)}`,
  ).toBeGreaterThanOrEqual(minDiceCount);
  expect(
    metrics.canvasClientWidth,
    `山屋骰盘 canvas 必须有可见宽度：${JSON.stringify(metrics)}`,
  ).toBeGreaterThanOrEqual(options.minCanvasClientWidth ?? 300);
  expect(
    metrics.canvasClientHeight,
    `山屋骰盘 canvas 必须有可见高度：${JSON.stringify(metrics)}`,
  ).toBeGreaterThanOrEqual(options.minCanvasClientHeight ?? 210);
  if (typeof options.minDieVisualSize === "number") {
    expect(
      metrics.minDieVisualSize,
      `山屋骰子本体不能小到不可读：${JSON.stringify(metrics)}`,
    ).toBeGreaterThanOrEqual(options.minDieVisualSize);
  }
  if (typeof options.minCanvasEdgeMargin === "number") {
    expect(
      metrics.minCanvasEdgeMargin,
      `山屋骰子不能贴边或被裁切：${JSON.stringify(metrics)}`,
    ).toBeGreaterThanOrEqual(options.minCanvasEdgeMargin);
  }
  expect(
    metrics.minNormalizedCenterDistance,
    `山屋多骰不能中心塌缩或明显重叠：${JSON.stringify(metrics)}`,
  ).toBeGreaterThanOrEqual(minNormalizedCenterDistance);
  expect(
    metrics.maxOverlapRatio,
    `山屋多骰不能大面积互相覆盖：${JSON.stringify(metrics)}`,
  ).toBeLessThanOrEqual(maxOverlapRatio);
  expect(
    metrics.normalizedCenterSpan,
    `山屋多骰必须在骰盘内形成可辨散布：${JSON.stringify(metrics)}`,
  ).toBeGreaterThanOrEqual(minNormalizedCenterSpan);
};

function command<Type extends keyof BetrayalCommandMap>(
  type: Type,
  playerId: string,
  payload: BetrayalCommandMap[Type],
): BetrayalCommand {
  return {
    type,
    playerId,
    payload,
    timestamp: 100,
  } as Command<Type & string, BetrayalCommandMap[Type]> as BetrayalCommand;
}

export function createRuntimeCore(): BetrayalCore {
  return createStartedFirstScenarioCore(["0", "1", "2"]);
}

export function createFirstScenarioHauntRuntimeCore(): BetrayalCore {
  return createFirstScenarioHauntCore();
}

export function createMonsterEncounterCore(): BetrayalCore {
  return createBetrayalMonsterEncounterCore(["0", "1", "2"]);
}

export function createFirstScenarioSurvivorEndgameCore(): BetrayalCore {
  return playFirstScenarioToSurvivorVictory();
}

export function createFirstScenarioReadyToExorciseRuntimeCore(): BetrayalCore {
  return createFirstScenarioReadyToExorciseCore();
}

export function createFirstScenarioReadyToLearnAboutJackRuntimeCore(): BetrayalCore {
  return createFirstScenarioReadyToLearnAboutJackCore();
}

export function createFirstScenarioReadyToStudyExorcismRuntimeCore(): BetrayalCore {
  return createFirstScenarioReadyToStudyExorcismCore();
}

export function createTradeReadyRuntimeCore(): BetrayalCore {
  return createTradeReadyCore();
}

export function createDogTradeReadyRuntimeCore(): BetrayalCore {
  return createDogTradeReadyCore();
}

export function createExchangeReadyRuntimeCore(): BetrayalCore {
  return createExchangeReadyCore();
}

export function createMedicalKitUseReadyRuntimeCore(): BetrayalCore {
  return createMedicalKitUseReadyCore();
}

export function createHolyWaterUseReadyRuntimeCore(): BetrayalCore {
  return createHolyWaterUseReadyCore();
}

export function createSkeletonKeyMoveReadyRuntimeCore(): BetrayalCore {
  return createSkeletonKeyMoveReadyCore();
}

export function createMaskMoveReadyRuntimeCore(): BetrayalCore {
  return createMaskMoveReadyCore();
}

export function createHeroAttackTraitorReadyRuntimeCore(): BetrayalCore {
  return createHeroAttackTraitorReadyCore();
}

export function createFirstScenarioReadyToTraitorVictoryRuntimeCore(): BetrayalCore {
  return createFirstScenarioReadyToTraitorVictoryCore();
}

export function createCorpseLootReadyRuntimeCore(): BetrayalCore {
  return createCorpseLootReadyCore();
}

export function createJackSpiritReviveReadyRuntimeCore(): BetrayalCore {
  return createJackSpiritReviveReadyCore();
}

export function createJackSpiritNaturalMonsterTurnBeforeRollRuntimeCore(): BetrayalCore {
  return createJackSpiritNaturalMonsterTurnBeforeRollCore();
}

export function createJackSpiritMovementRollReadyRuntimeCore(): BetrayalCore {
  return createJackSpiritMovementRollReadyCore();
}

export function createJackSpiritPostReviveAttackReadyRuntimeCore(): BetrayalCore {
  return createJackSpiritPostReviveAttackReadyCore();
}

export function createDustFeverishNaturalMonsterTurnBeforeRollRuntimeCore(): BetrayalCore {
  return createDustFeverishNaturalMonsterTurnBeforeRollCore();
}

export function createDustFeverishAttackReadyRuntimeCore(): BetrayalCore {
  return createDustFeverishAttackReadyCore();
}

const BETRAYAL_E2E_TRAIT_KEYS: BetrayalTraitKey[] = [
  "might",
  "speed",
  "knowledge",
  "sanity",
];

function findBetrayalE2EExplorer(core: BetrayalCore, playerId: string) {
  const explorer = [core.currentExplorer, ...core.otherExplorers].find(
    (candidate) => candidate.playerId === playerId,
  );
  if (!explorer) {
    throw new Error(`山屋 E2E 夹具缺少玩家 ${playerId}`);
  }
  return explorer;
}

function cloneBetrayalE2EExplorer(
  explorer: BetrayalCore["currentExplorer"],
): BetrayalCore["currentExplorer"] {
  return {
    ...explorer,
    traits: { ...explorer.traits },
    traitTracks: Object.fromEntries(
      Object.entries(explorer.traitTracks).map(([trait, track]) => [
        trait,
        { ...track, values: [...track.values] },
      ]),
    ) as BetrayalCore["currentExplorer"]["traitTracks"],
    inventory: explorer.inventory.map((card) => ({ ...card })),
  };
}

function focusBetrayalE2EExplorer(
  core: BetrayalCore,
  playerId: string,
): BetrayalCore {
  const explorers = [core.currentExplorer, ...core.otherExplorers].map(
    cloneBetrayalE2EExplorer,
  );
  const active = explorers.find((explorer) => explorer.playerId === playerId);
  if (!active) {
    throw new Error(`山屋 E2E 夹具不能切到缺失玩家 ${playerId}`);
  }
  core.currentPlayer = playerId;
  core.currentExplorer = active;
  core.otherExplorers = explorers.filter(
    (explorer) => explorer.playerId !== playerId,
  );
  core.activeRoomId = active.roomId;
  core.currentExplorerRoomId = active.roomId;
  core.currentExplorerTraits = { ...active.traits };
  core.currentExplorerInventory = active.inventory.map((card) => ({ ...card }));
  core.turnStartInventoryCardIds = active.inventory.map((card) => card.id);
  return core;
}

function syncBetrayalE2ECurrentExplorer(core: BetrayalCore): void {
  core.activeRoomId = core.currentExplorer.roomId;
  core.currentExplorerRoomId = core.currentExplorer.roomId;
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({
    ...card,
  }));
  core.turnStartInventoryCardIds = core.currentExplorer.inventory.map(
    (card) => card.id,
  );
}

function moveStrangeAmuletForHelpingHandsE2E(
  core: BetrayalCore,
  holderPlayerId: string | null,
): void {
  const explorers = [core.currentExplorer, ...core.otherExplorers];
  let strangeAmulet =
    explorers
      .flatMap((explorer) => explorer.inventory)
      .find((card) => card.id === "strange-amulet") ?? null;
  for (const explorer of explorers) {
    explorer.inventory = explorer.inventory.filter(
      (card) => card.id !== "strange-amulet",
    );
  }
  if (!holderPlayerId) {
    syncBetrayalE2ECurrentExplorer(core);
    return;
  }
  const holder = explorers.find(
    (explorer) => explorer.playerId === holderPlayerId,
  );
  if (!holder) {
    throw new Error(`山屋 E2E 夹具缺少奇异护符目标玩家 ${holderPlayerId}`);
  }
  strangeAmulet ??= { id: "strange-amulet", name: "奇异护符", kind: "item" };
  holder.inventory = [...holder.inventory, { ...strangeAmulet }];
  syncBetrayalE2ECurrentExplorer(core);
}

function setBetrayalE2ETraitTrack(
  core: BetrayalCore,
  playerId: string,
  trait: BetrayalTraitKey,
  values: number[],
  position: number,
  startPosition = 3,
): void {
  const explorer = findBetrayalE2EExplorer(core, playerId);
  explorer.traitTracks[trait] = {
    trackId: `e2e-${playerId}-${trait}`,
    values: [...values],
    position,
    startPosition,
    criticalPosition: 0,
    skullPosition: -1,
    maxPosition: values.length - 1,
  };
  explorer.traits[trait] = values[position] ?? 0;
  if (core.currentExplorer.playerId === playerId) {
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
  }
}

export function createDustEndTurnDamageAllocationRuntimeCore(): BetrayalCore {
  let core = createDustHauntCore();
  core = focusBetrayalE2EExplorer(core, "1");
  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "hallway",
  };
  core.otherExplorers = core.otherExplorers.map((explorer) =>
    explorer.playerId === "0"
      ? { ...explorer, roomId: "ground-north" }
      : { ...explorer, roomId: "entrance-hall" },
  );
  for (const trait of BETRAYAL_E2E_TRAIT_KEYS) {
    setBetrayalE2ETraitTrack(
      core,
      "1",
      trait,
      Array.from({ length: 16 }, () => 4),
      14,
      14,
    );
  }
  if (core.scenarioRuntime.dust) {
    core.scenarioRuntime.dust.exchangedSicknessThisTurnPlayerIds = [];
  }
  syncBetrayalE2ECurrentExplorer(core);
  core.activePlayerId = null;
  core.recommendedAction = "endTurn";
  return dismissBetrayalE2EBlockingOverlays(core);
}

function dismissBetrayalE2EBlockingOverlays(core: BetrayalCore): BetrayalCore {
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;
  core.pendingEventChoice = null;
  core.recentRoll = null;
  return core;
}

function isMagicCameraE2ECard(card: { id: string; name: string }): boolean {
  return card.id === "camera" || card.name === "魔法相机";
}

function removeMagicCameraFromE2EExplorer(
  explorer: BetrayalCore["currentExplorer"],
): BetrayalCore["currentExplorer"] {
  return {
    ...explorer,
    inventory: explorer.inventory.filter((card) => !isMagicCameraE2ECard(card)),
  };
}

export function createMagicCameraHauntRuntimeCore(
  cameraOwnerPlayerId: string | null = "1",
): BetrayalCore {
  let core = createStartedFirstScenarioCore(["0", "1", "2"]);
  const magicCameraEvent = BETRAYAL_DISCOVERY_POOLS.events.find(
    (event) => event.name === "说“茄子”！",
  );
  if (!magicCameraEvent) {
    throw new Error("山屋 E2E 夹具缺少作祟 33 事件：说“茄子”！");
  }

  core.drawOrder = ["event"];
  core.eventOrder = [magicCameraEvent];
  core.currentExplorer = removeMagicCameraFromE2EExplorer(core.currentExplorer);
  core.otherExplorers = core.otherExplorers.map(removeMagicCameraFromE2EExplorer);
  core.currentExplorer.inventory = [
    ...core.currentExplorer.inventory,
    { id: "omen-book", name: "书本", kind: "omen" },
    { id: "dog", name: "狗", kind: "omen" },
    { id: "mask", name: "面具", kind: "omen" },
  ];
  if (cameraOwnerPlayerId === "0") {
    core.currentExplorer.inventory = [
      ...core.currentExplorer.inventory,
      { id: "camera", name: "魔法相机", kind: "item" },
    ];
  }
  core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({
    ...card,
  }));
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.otherExplorers = core.otherExplorers.map((explorer) =>
    explorer.playerId === cameraOwnerPlayerId
      ? {
          ...explorer,
          inventory: [
            ...explorer.inventory,
            { id: "camera", name: "魔法相机", kind: "item" },
          ],
        }
      : explorer,
  );
  if (!cameraOwnerPlayerId) {
    core.possessionOrderByKind.item = [
      { id: "camera", name: "魔法相机", kind: "item" },
      ...core.possessionOrderByKind.item.filter(
        (card) => !isMagicCameraE2ECard(card),
      ),
    ];
  }

  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, "0", {
    roomId: "ground-north",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
    "0",
    { accept: true },
    100,
    createBetrayalScriptedRandom(3, 3, 3),
  );
  core.recommendedAction = "use";
  return dismissBetrayalE2EBlockingOverlays(core);
}

function createHelpingHandsHauntRuntimeCore(
  playerIds: string[] = ["0", "1", "2"],
): BetrayalCore {
  let core = createStartedFirstScenarioCore(playerIds);
  const helpingHandsEvent = BETRAYAL_DISCOVERY_POOLS.events.find(
    (event) => event.name === "大宅饿了",
  );
  if (!helpingHandsEvent) {
    throw new Error("山屋 E2E 夹具缺少作祟 12 事件：大宅饿了");
  }

  core.drawOrder = ["event"];
  core.eventOrder = [helpingHandsEvent];
  core.currentExplorer.inventory = [
    ...core.currentExplorer.inventory,
    { id: "omen-book", name: "书本", kind: "omen" },
    { id: "dog", name: "狗", kind: "omen" },
    { id: "mask", name: "面具", kind: "omen" },
  ];
  core.currentExplorer.traits = {
    ...core.currentExplorer.traits,
    might: 5,
    sanity: 5,
  };
  core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({
    ...card,
  }));
  core.currentExplorerTraits = { ...core.currentExplorer.traits };

  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, "0", {
    roomId: "ground-north",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
    "0",
    { accept: true },
    100,
    createBetrayalScriptedRandom(3, 3, 3),
  );
  core.recommendedAction = "use";
  return dismissBetrayalE2EBlockingOverlays(core);
}

export function createHelpingHandsPendingRewardRuntimeCore(): BetrayalCore {
  let core = createHelpingHandsHauntRuntimeCore(["0", "1", "2"]);
  core = focusBetrayalE2EExplorer(core, "0");
  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "entrance-hall",
    inventory: [
      ...core.currentExplorer.inventory.filter((card) => card.id !== "rope"),
      { id: "rope", name: "兔脚", kind: "item" },
    ],
    traits: {
      ...core.currentExplorer.traits,
      might: 5,
    },
  };
  core.otherExplorers = core.otherExplorers.map((explorer) =>
    explorer.playerId === "1"
      ? {
          ...explorer,
          roomId: "entrance-hall",
          inventory: [{ id: "medical-kit", name: "急救包", kind: "item" }],
          traits: {
            ...explorer.traits,
            might: 1,
          },
        }
      : explorer,
  );
  core.activeRoomId = "entrance-hall";
  core.currentExplorerRoomId = "entrance-hall";
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({
    ...card,
  }));
  core.turnStartInventoryCardIds = core.currentExplorer.inventory.map(
    (card) => card.id,
  );
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    "0",
    { target: "hero", targetPlayerId: "1" },
    100,
    createBetrayalScriptedRandom(3, 3, 3, 3, 3, 1, 1, 1, 1, 1),
  );
  return core;
}

export function createHelpingHandsTrollHandAttackRuntimeCore(): BetrayalCore {
  let core = createHelpingHandsHauntRuntimeCore(["0", "1", "2"]);
  core = focusBetrayalE2EExplorer(core, "0");
  const sharedRoomId = "entrance-hall";
  const trollHandIds = core.scenarioRuntime.helpingHands?.trollHandIds ?? [];
  core.monsters = core.monsters.map((monster) =>
    trollHandIds.includes(monster.id)
      ? { ...monster, roomId: sharedRoomId }
      : monster,
  );
  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "hallway",
  };
  core.otherExplorers = core.otherExplorers.map((explorer) =>
    explorer.playerId === "1"
      ? { ...explorer, roomId: sharedRoomId }
      : explorer,
  );
  for (const trait of BETRAYAL_E2E_TRAIT_KEYS) {
    setBetrayalE2ETraitTrack(
      core,
      "1",
      trait,
      [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      10,
      10,
    );
  }
  core.activeRoomId = sharedRoomId;
  core.currentExplorerRoomId = core.currentExplorer.roomId;
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({
    ...card,
  }));
  core.recommendedAction = "use";
  return startHelpingHandsMonsterTurnForE2E(core);
}

function startHelpingHandsMonsterTurnForE2E(core: BetrayalCore): BetrayalCore {
  core = focusBetrayalE2EExplorer(core, "0");
  return applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.END_TURN,
    "0",
    {},
    100,
    createBetrayalScriptedRandom(1, 2, 3),
  );
}

function placeHelpingHandsTrollHandsAndTargets(
  core: BetrayalCore,
  currentPlayerId: string,
): BetrayalCore {
  const sharedRoomId = "entrance-hall";
  const trollHandIds = core.scenarioRuntime.helpingHands?.trollHandIds ?? [];
  core.monsters = core.monsters.map((monster) =>
    trollHandIds.includes(monster.id)
      ? { ...monster, roomId: sharedRoomId }
      : monster,
  );
  core = focusBetrayalE2EExplorer(core, currentPlayerId);
  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: currentPlayerId === "0" ? "hallway" : sharedRoomId,
  };
  core.otherExplorers = core.otherExplorers.map((explorer) =>
    explorer.playerId === "2"
      ? { ...explorer, roomId: sharedRoomId }
      : explorer.playerId === "1"
        ? { ...explorer, roomId: sharedRoomId }
        : { ...explorer, roomId: "hallway" },
  );
  syncBetrayalE2ECurrentExplorer(core);
  core.recommendedAction = "use";
  return core;
}

export function createHelpingHandsTransferredAmuletOldHolderRuntimeCore(): BetrayalCore {
  let core = createHelpingHandsHauntRuntimeCore(["0", "1", "2"]);
  moveStrangeAmuletForHelpingHandsE2E(core, "1");
  core = placeHelpingHandsTrollHandsAndTargets(core, "0");
  return startHelpingHandsMonsterTurnForE2E(core);
}

export function createHelpingHandsTransferredAmuletControllerRuntimeCore(): BetrayalCore {
  let core = createHelpingHandsHauntRuntimeCore(["0", "1", "2"]);
  moveStrangeAmuletForHelpingHandsE2E(core, "1");
  core = placeHelpingHandsTrollHandsAndTargets(core, "1");
  return startHelpingHandsMonsterTurnForE2E(core);
}

export function createHelpingHandsNoAmuletRuntimeCore(): BetrayalCore {
  let core = createHelpingHandsHauntRuntimeCore(["0", "1", "2"]);
  moveStrangeAmuletForHelpingHandsE2E(core, null);
  core = placeHelpingHandsTrollHandsAndTargets(core, "0");
  return core;
}

export const injectCore = async (page: Page, core: BetrayalCore) => {
  await page.evaluate((nextCore) => {
    const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
    const state = harness?.state;
    const snapshot = state?.get?.();
    if (!snapshot || !state?.set) {
      throw new Error("betrayal test harness state injector unavailable");
    }
    return state.set({ ...snapshot, core: nextCore });
  }, core);
};

export const dispatchHarnessCommand = async <
  Type extends keyof BetrayalCommandMap,
>(
  page: Page,
  type: Type,
  playerId: string,
  payload: BetrayalCommandMap[Type],
) => {
  await waitForBetrayalHarnessCommand(page);
  await page.evaluate(
    async ({ nextCommand }) => {
      const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
      if (!harness?.command?.dispatch) {
        throw new Error("betrayal test harness command dispatcher unavailable");
      }
      await harness.command.dispatch(nextCommand);
    },
    {
      nextCommand: command(type, playerId, payload),
    },
  );
};

export const setHarnessRandomQueue = async (page: Page, values: number[]) => {
  await page.evaluate((queueValues) => {
    const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
    if (!harness?.random?.setQueue) {
      throw new Error("betrayal test harness random queue unavailable");
    }
    harness.random.setQueue(queueValues);
  }, values);
};
