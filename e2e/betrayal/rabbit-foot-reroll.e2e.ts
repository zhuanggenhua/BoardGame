import { expect, test, type Locator } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import type {
  BetrayalCore,
  BetrayalInventoryCard,
} from "../../src/games/betrayal/game";
import {
  armPhysicalDiceRerollMotionCapture,
  clickDiscoveryBackdropAndExpectStillVisible,
  createRuntimeCore,
  expectEventRollWorkbenchReadable,
  expectPhysicalDiceSeparated,
  expectVisiblePhysicalDiceBox,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  waitForPhysicalDiceSettled,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/山屋惊魂-兔脚重掷完整链路";
const BEFORE_REROLL_SCREENSHOT = `${EVIDENCE_DIR}/01-兔脚重掷前最近投骰可见.jpg`;
const RABBIT_FOOT_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-兔脚本体已选中.jpg`;
const DIE_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/03-选择具体骰子高亮.jpg`;
const REROLL_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/04-选中骰子等待确认使用.jpg`;
const REROLL_MOTION_SCREENSHOT = `${EVIDENCE_DIR}/05-兔脚重掷动画进行中.jpg`;
const REROLL_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/06-重掷后结果等待自动结算.jpg`;
const REROLL_FINALIZED_SCREENSHOT = `${EVIDENCE_DIR}/07-自动结算后返回牌桌.jpg`;
const REROLL_HIGHLIGHT_RENDERER = "threejs-backside-shader-shell";

function createRabbitFootRerollCore(): BetrayalCore {
  const core = createRuntimeCore();
  const rabbitFoot: BetrayalInventoryCard = {
    id: "rope",
    name: "兔脚",
    kind: "item",
  };
  const traitsBeforeEvent = { ...core.currentExplorer.traits, knowledge: 3, speed: 4 };

  core.currentExplorer = {
    ...core.currentExplorer,
    traits: traitsBeforeEvent,
    inventory: [rabbitFoot],
  };
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [{ ...rabbitFoot }];
  core.turnStartInventoryCardIds = ["rope"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = {
    kind: "event",
    title: "外星几何",
    summary: "知识检定失败",
    detail: "知识检定 2：失去 1 点速度；等待可介入结果",
    tone: "warning",
  };
  core.latestDiscoveryOwnerPlayerId = "0";
  core.recentRoll = {
    id: "rabbit-foot-reroll-e2e-roll",
    kind: "eventTraitCheck",
    playerId: "0",
    sourceTitle: "外星几何",
    trait: "knowledge",
    rollLabel: "知识检定",
    dice: [2, 0, 0],
    passiveBonus: 0,
    latestLabel: "失去 1 点速度",
    consumedRabbitFootCardIds: [],
    branchThresholds: [
      {
        min: 4,
        label: "获得 1 点知识",
        effect: {
          mode: "trait",
          trait: "knowledge",
          amount: 1,
          recommendedAction: "explore",
        },
      },
      {
        min: 0,
        label: "失去 1 点速度",
        effect: {
          mode: "trait",
          trait: "speed",
          amount: -1,
          recommendedAction: "endTurn",
        },
      },
    ],
  };
  core.pendingEventRollResolution = {
    rollId: core.recentRoll.id,
    playerId: "0",
    sourceTitle: "外星几何",
    effect: { mode: "trait", trait: "speed", amount: -1, recommendedAction: "endTurn" },
  };

  return core;
}

async function expectRabbitFootRerollHighlightState(
  rollPanel: Locator,
  {
    targetCount,
    selectedDieIndex,
  }: {
    targetCount: number;
    selectedDieIndex: number | null;
  },
) {
  const readMetrics = async () =>
    rollPanel.evaluate((node) => {
      const panel = node as HTMLElement;
      const layer = panel.querySelector(
        '[data-testid="betrayal-rabbit-foot-dice"]',
      ) as HTMLElement | null;
      const source = panel.querySelector(
        '[data-testid="betrayal-house-dice-physics-source"]',
      ) as HTMLElement | null;
      const group = panel.querySelector(
        '[data-testid="betrayal-house-dice-3d-group"]',
      ) as HTMLElement | null;
      const canvases = Array.from(panel.querySelectorAll("canvas")).filter(
        (candidate): candidate is HTMLCanvasElement =>
          candidate instanceof HTMLCanvasElement,
      );
      const debugRegistry =
        (
          window as typeof window & {
            __diceBoxThreeDebug?: Record<string, () => {
              diceHighlights?: Array<{
                dieIndex?: number;
                variant?: string;
                scale?: number;
                opacity?: number;
              }>;
              diceHighlightShells?: Array<{
                dieIndex?: number;
                variant?: string;
                renderer?: string;
                visible?: boolean;
                scale?: number;
                opacity?: number;
                materialType?: string;
                materialSide?: number;
                depthWrite?: boolean;
                transparent?: boolean;
                shaderOpacity?: number;
              }>;
            } | null>;
          }
        ).__diceBoxThreeDebug ?? {};
      const activeCanvas =
        canvases.find((canvas) => {
          const testId = canvas.dataset.testid;
          return Boolean(testId && typeof debugRegistry[testId] === "function");
        }) ??
        canvases[0] ??
        null;
      const debugKey = activeCanvas?.dataset.testid ?? group?.dataset.diceDebugKey;
      const snapshot = debugKey ? debugRegistry[debugKey]?.() : null;
      const highlights = Array.isArray(snapshot?.diceHighlights)
        ? snapshot.diceHighlights
        : [];
      const shells = Array.isArray(snapshot?.diceHighlightShells)
        ? snapshot.diceHighlightShells
        : [];
      const targets = Array.from(
        layer?.querySelectorAll<HTMLElement>(
          '[data-testid^="betrayal-house-dice-reroll-target-"]',
        ) ?? [],
      )
        .filter((target) => target.offsetParent !== null)
        .map((target) => {
          const dieIndex = Number(
            target.dataset.testid?.match(/-(\d+)$/)?.[1] ?? "NaN",
          );
          const rect = target.getBoundingClientRect();
          const visibleWidth = Number(target.dataset.rerollTargetVisualWidth);
          const visibleHeight = Number(target.dataset.rerollTargetVisualHeight);
          const boxSize = Number(target.dataset.rerollTargetBoxSize);
          const visibleMax = Math.max(visibleWidth, visibleHeight);
          return {
            dieIndex,
            selected: target.dataset.rerollTargetSelected === "true",
            shape: target.dataset.rerollTargetShape ?? "",
            highlightRenderer: target.dataset.rerollTargetHighlightRenderer ?? "",
            visualLayer: target.dataset.rerollTargetVisualLayer ?? "",
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            targetWidth: rect.width,
            targetHeight: rect.height,
            hitBoxPadding: (boxSize - visibleMax) / 2,
            domCandidateBox: Boolean(
              target.querySelector('[data-reroll-target-candidate-box="true"]'),
            ),
            domSelectedBorder: Boolean(
              target.querySelector(
                '[data-reroll-target-selected-border="true"]',
              ),
            ),
            highlight:
              highlights.find((highlight) => highlight.dieIndex === dieIndex) ??
              null,
            shell:
              shells.find((shell) => shell.dieIndex === dieIndex) ?? null,
          };
        });

      return {
        layerRenderer: layer?.dataset.rerollHighlightRenderer ?? "",
        sourceRenderer: source?.dataset.diceHighlightRenderer ?? "",
        canvasRenderer: activeCanvas?.dataset.diceHighlightRenderer ?? "",
        domVisualBoxCount: layer
          ? layer.querySelectorAll(
              '[data-reroll-target-candidate-box="true"], [data-reroll-target-selected-border="true"]',
            ).length
          : 0,
        highlightCount: highlights.length,
        shellCount: shells.length,
        candidateCount: highlights.filter(
          (highlight) => highlight.variant === "candidate",
        ).length,
        selectedCount: highlights.filter(
          (highlight) => highlight.variant === "selected",
        ).length,
        targets,
      };
    });

  await expect
    .poll(
      async () => {
        const metrics = await readMetrics();
        const expectedSelectedCount = selectedDieIndex === null ? 0 : 1;
        if (metrics.layerRenderer !== REROLL_HIGHLIGHT_RENDERER)
          return `layer:${metrics.layerRenderer}`;
        if (metrics.sourceRenderer !== REROLL_HIGHLIGHT_RENDERER)
          return `source:${metrics.sourceRenderer}`;
        if (metrics.canvasRenderer !== REROLL_HIGHLIGHT_RENDERER)
          return `canvas:${metrics.canvasRenderer}`;
        if (metrics.domVisualBoxCount !== 0)
          return `dom-boxes:${metrics.domVisualBoxCount}`;
        if (metrics.targets.length !== targetCount)
          return `targets:${metrics.targets.length}/${targetCount}`;
        if (metrics.highlightCount !== targetCount)
          return `highlights:${metrics.highlightCount}/${targetCount}`;
        if (metrics.shellCount !== targetCount)
          return `shells:${metrics.shellCount}/${targetCount}`;
        if (metrics.selectedCount !== expectedSelectedCount)
          return `selected:${metrics.selectedCount}/${expectedSelectedCount}`;
        if (metrics.candidateCount !== targetCount - expectedSelectedCount)
          return `candidate:${metrics.candidateCount}`;
        return "ready";
      },
      { timeout: 5000 },
    )
    .toBe("ready");

  const metrics = await readMetrics();
  for (let leftIndex = 0; leftIndex < metrics.targets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < metrics.targets.length; rightIndex += 1) {
      const leftTarget = metrics.targets[leftIndex];
      const rightTarget = metrics.targets[rightIndex];
      const overlapWidth = Math.max(
        0,
        Math.min(leftTarget.right, rightTarget.right) -
          Math.max(leftTarget.left, rightTarget.left),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(leftTarget.bottom, rightTarget.bottom) -
          Math.max(leftTarget.top, rightTarget.top),
      );
      expect(
        overlapWidth * overlapHeight,
        `第 ${leftTarget.dieIndex + 1} 颗和第 ${rightTarget.dieIndex + 1} 颗改骰方框不能重叠：${JSON.stringify(metrics)}`,
      ).toBeLessThanOrEqual(1);
    }
  }
  for (const target of metrics.targets) {
    const evidence = JSON.stringify({ target, metrics });
    const isSelected = target.dieIndex === selectedDieIndex;
    expect(target.shape, `选骰热区必须绑定骰子本体：${evidence}`).toBe("die-face");
    expect(
      target.highlightRenderer,
      `可见高亮必须来自 Three.js shader 外壳：${evidence}`,
    ).toBe(REROLL_HIGHLIGHT_RENDERER);
    expect(
      target.visualLayer,
      `DOM 层只能保留透明命中区：${evidence}`,
    ).toBe("transparent-hitbox-only");
    expect(Math.abs(target.targetWidth - target.targetHeight)).toBeLessThanOrEqual(1);
    expect(target.hitBoxPadding).toBeGreaterThanOrEqual(0);
    expect(target.hitBoxPadding).toBeLessThanOrEqual(4);
    expect(target.domCandidateBox, `DOM 候选框不能回流：${evidence}`).toBe(false);
    expect(target.domSelectedBorder, `DOM 选中框不能回流：${evidence}`).toBe(false);
    expect(target.selected, `选中状态必须只落在目标骰子：${evidence}`).toBe(isSelected);
    expect(target.highlight, `缺少 WebGL 高亮状态：${evidence}`).not.toBeNull();
    expect(target.shell, `缺少 WebGL 描边外壳：${evidence}`).not.toBeNull();
    expect(target.shell?.renderer).toBe(REROLL_HIGHLIGHT_RENDERER);
    expect(target.shell?.visible).toBe(true);
    expect(target.shell?.materialType).toBe("ShaderMaterial");
    expect(target.shell?.materialSide).toBe(1);
    expect(target.shell?.depthWrite).toBe(false);
    expect(target.shell?.transparent).toBe(true);
    expect(target.shell?.shaderOpacity).toBe(target.shell?.opacity);
    if (isSelected) {
      expect(target.highlight?.variant).toBe("selected");
      expect(target.shell?.variant).toBe("selected");
      expect(target.shell?.scale).toBeGreaterThanOrEqual(1.045);
      expect(target.shell?.scale).toBeLessThanOrEqual(1.065);
      expect(target.shell?.opacity).toBeGreaterThanOrEqual(0.95);
    } else {
      expect(target.highlight?.variant).toBe("candidate");
      expect(target.shell?.variant).toBe("candidate");
      expect(target.shell?.scale).toBeGreaterThanOrEqual(1.025);
      expect(target.shell?.scale).toBeLessThanOrEqual(1.045);
      expect(target.shell?.opacity).toBeGreaterThanOrEqual(0.9);
    }
  }
}

test.describe("山屋惊魂兔脚重掷完整链路", () => {
  test("兔脚从最近投骰选择骰子、确认使用并等待自动结算", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-rabbit-foot-reroll",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createRabbitFootRerollCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("betrayal-discovery-panel")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "知识检定 2",
    );
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, {
      minDiceCount: 3,
      minCanvasEdgeMargin: 12,
      minNormalizedCenterDistance: 1.02,
      maxOverlapRatio: 0.03,
    });
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-values", "2,0,0");
    await expectEventRollWorkbenchReadable(page, "兔脚重掷前", {
      expectedEventFrameIndex: "24",
    });
    const rabbitFootCard = page.getByTestId("betrayal-inventory-rope");
    await expect(rabbitFootCard, "重掷前必须看得到兔脚本体").toBeVisible();
    await expect(rabbitFootCard).toHaveAttribute(
      "data-roll-modifier-available",
      "true",
    );
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await clickDiscoveryBackdropAndExpectStillVisible(page, discoveryPanel);
    await expect(rollPanel).toBeVisible();
    await saveScreenshot(page, BEFORE_REROLL_SCREENSHOT);

    await rabbitFootCard.click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("兔脚");
    await expect(rabbitFootCard).toHaveAttribute("aria-pressed", "true");
    await expectEventRollWorkbenchReadable(page, "兔脚本体选中后", {
      expectedEventFrameIndex: "24",
    });
    await saveScreenshot(page, RABBIT_FOOT_SELECTED_SCREENSHOT);

    const rabbitFootDice = page.getByTestId("betrayal-rabbit-foot-dice");
    await expect(rabbitFootDice).toBeVisible();
    await expect(rabbitFootDice).toHaveAttribute(
      "data-reroll-target-count",
      "3",
    );
    await expect(page.getByTestId("betrayal-rabbit-foot-die-1")).toHaveCount(0);
    const rerollTargetDie = page.getByTestId(
      "betrayal-house-dice-reroll-target-1",
    );
    await expect(rerollTargetDie).toBeVisible();
    await expect(rerollTargetDie).toHaveAttribute("role", "button");
    await expect(rerollTargetDie).toHaveAttribute(
      "data-reroll-target-shape",
      "die-face",
    );
    const targetBox = await rerollTargetDie.boundingBox();
    expect(
      Math.round(targetBox?.width ?? 0),
      "选骰命中区必须贴合骰面比例，不是旁路数字按钮",
    ).toBe(Math.round(targetBox?.height ?? 0));
    await expectEventRollWorkbenchReadable(page, "兔脚选骰目标高亮后", {
      expectedEventFrameIndex: "24",
    });
    await expectRabbitFootRerollHighlightState(rollPanel, {
      targetCount: 3,
      selectedDieIndex: null,
    });
    await saveScreenshot(page, DIE_TARGET_SCREENSHOT);

    await setHarnessRandomQueue(page, [0.99]);
    await rerollTargetDie.click();
    await expect(page.getByTestId("betrayal-roll-modifier-confirm")).toBeVisible();
    await expectEventRollWorkbenchReadable(page, "兔脚选中骰子后", {
      expectedEventFrameIndex: "24",
    });
    await expectRabbitFootRerollHighlightState(rollPanel, {
      targetCount: 3,
      selectedDieIndex: 1,
    });
    await saveScreenshot(page, REROLL_SELECTED_SCREENSHOT);

    const rerollMotionCapture = await armPhysicalDiceRerollMotionCapture(rollPanel, {
      dieIndex: 1,
    });
    try {
      const rollModifierConfirm = page.getByTestId("betrayal-roll-modifier-confirm");
      await expect(rollModifierConfirm).toBeVisible();
      await expect(rollModifierConfirm).toBeEnabled();
      const confirmBox = await rollModifierConfirm.boundingBox();
      expect(confirmBox, "确认使用兔脚按钮必须有真实可点击区域").not.toBeNull();
      await page.evaluate(
        ({ x, y }) => {
          const target = document.elementFromPoint(x, y);
          const button = target?.closest<HTMLButtonElement>(
            '[data-testid="betrayal-roll-modifier-confirm"]',
          );
          if (!button) {
            throw new Error("确认使用兔脚按钮中心没有命中真实按钮");
          }
          window.setTimeout(() => button.click(), 50);
        },
        {
          x: confirmBox!.x + confirmBox!.width / 2,
          y: confirmBox!.y + confirmBox!.height / 2,
        },
      );
      const rerollMotionVisible = rerollMotionCapture.expectVisible();
      await rerollMotionVisible;
      await saveScreenshot(page, REROLL_MOTION_SCREENSHOT);
      await expect(rabbitFootDice).toBeHidden();
    } finally {
      await rerollMotionCapture.stop();
    }
    await page.waitForTimeout(500);
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-values", "2,2,0");
    await expect(
      page.getByText("使用兔脚重掷第 2 颗骰子", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "知识检定 4",
    );
    await expect(page.getByTestId("betrayal-discovery-detail")).toContainText(
      "获得 1 点知识",
    );
    await expect(page.getByTestId("betrayal-discovery-continue")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-roll-finalize")).toHaveCount(0);
    await saveScreenshot(page, REROLL_RESULT_SCREENSHOT);

    const pendingAutoFinalizeState = await page.evaluate(() => {
      const harness = (
        window as Window & {
          __BG_TEST_HARNESS__?: {
            state?: {
              get?: () => { core?: BetrayalCore };
            };
          };
        }
      ).__BG_TEST_HARNESS__;
      return harness?.state?.get?.().core ?? null;
    });
    expect(pendingAutoFinalizeState?.recentRoll?.dice).toEqual([2, 2, 0]);
    expect(pendingAutoFinalizeState?.recentRoll?.lastRabbitFootRerollDieIndex).toBe(1);
    expect(pendingAutoFinalizeState?.recentRoll?.consumedRabbitFootCardIds).toContain("rope");
    expect(pendingAutoFinalizeState?.usedCardIdsThisTurn).toContain("rope");
    expect(pendingAutoFinalizeState?.pendingEventRollResolution).toMatchObject({
      requiresAcknowledgement: false,
      effect: { mode: "trait", trait: "knowledge", amount: 1 },
    });
    expect(pendingAutoFinalizeState?.currentExplorer.traits.knowledge).toBe(3);
    expect(pendingAutoFinalizeState?.currentExplorer.traits.speed).toBe(4);
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
      "兔脚重掷后不能残留已选物品",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-rabbit-foot-dice"),
      "兔脚重掷后选骰层必须清空",
    ).toHaveCount(0);
    await expect
      .poll(async () => {
        const state = await page.evaluate(() => {
          const harness = (
            window as Window & {
              __BG_TEST_HARNESS__?: {
                state?: { get?: () => { core?: BetrayalCore } };
              };
            }
          ).__BG_TEST_HARNESS__;
          const core = harness?.state?.get?.().core;
          return {
            pending: Boolean(core?.pendingEventRollResolution),
            knowledge: core?.currentExplorer.traits.knowledge ?? null,
            speed: core?.currentExplorer.traits.speed ?? null,
          };
        });
        return !state.pending && state.knowledge === 4 && state.speed === 4
          ? "auto-finalized"
          : JSON.stringify(state);
      }, { timeout: 8000 })
      .toBe("auto-finalized");
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await saveScreenshot(page, REROLL_FINALIZED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-rabbit-foot-reroll", diagnostics },
    ]);
  });
});
