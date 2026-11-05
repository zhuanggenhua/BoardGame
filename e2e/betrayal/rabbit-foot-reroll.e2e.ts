import { expect, test, type Locator } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import type {
  BetrayalCore,
  BetrayalInventoryCard,
} from "../../src/games/betrayal/game";
import { BETRAYAL_DISCOVERY_POOLS } from "../../src/games/betrayal/scenarioConfig";
import {
  armPhysicalDiceRerollMotionCapture,
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

const EVIDENCE_DIR = "evidence/山屋惊魂-兔脚重掷完整链路/20260908-首次低抛与框内重掷-v2";
const INITIAL_ROLL_MOTION_SCREENSHOT = `${EVIDENCE_DIR}/01-首次投掷动画进行中.jpg`;
const BEFORE_REROLL_SCREENSHOT = `${EVIDENCE_DIR}/02-兔脚重掷前最近投骰可见.jpg`;
const RABBIT_FOOT_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/03-兔脚选中后可选骰子方框.jpg`;
const REROLL_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/04-选中骰子等待确认使用.jpg`;
const REROLL_MOTION_SCREENSHOT = `${EVIDENCE_DIR}/05-兔脚重掷动画进行中.jpg`;
const REROLL_RESULT_CONFIRM_SCREENSHOT = `${EVIDENCE_DIR}/06-兔脚重掷后自动结算骰面与属性.jpg`;
const REROLL_FINALIZED_SCREENSHOT = `${EVIDENCE_DIR}/07-兔脚自动结算返回牌桌.jpg`;
const REROLL_HIGHLIGHT_RENDERER = "threejs-backside-shader-shell";
const REROLL_VISUAL_CONTRACT =
  "projected-rounded-face-outline-plus-threejs-shell-plus-transparent-hitbox";
const REROLL_TARGET_OUTLINE_RENDERER = "svg-projected-rounded-die-face";
const REROLL_CANDIDATE_COLOR = 0x00e7ff;
const REROLL_SELECTED_COLOR = 0xff2dfb;

function createRabbitFootRerollCore(): BetrayalCore {
  const core = createRuntimeCore();
  const alienGeometryEvent = BETRAYAL_DISCOVERY_POOLS.events.find(
    (event) => event.name === "外星几何",
  );
  if (!alienGeometryEvent) {
    throw new Error("E2E 需要正式事件牌：外星几何");
  }
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
  core.eventOrder = [
    alienGeometryEvent,
    ...core.eventOrder.filter((event) => event.name !== alienGeometryEvent.name),
  ];
  core.latestDiscovery = {
    kind: "event",
    title: "外星几何",
    summary: "等待知识检定",
    detail: "知识检定：等待投骰",
    tone: "accent",
  };
  core.latestDiscoveryOwnerPlayerId = "0";
  core.recentRoll = null;
  core.pendingEventRollStart = {
    playerId: "0",
    roomId: core.currentExplorer.roomId,
    sourceTitle: "外星几何",
    eventDescription: alienGeometryEvent.description,
  };
  core.pendingEventRollResolution = null;

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
                color?: number;
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
                shaderIntensity?: number;
                shaderOutlineOffset?: number;
                blending?: number;
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
          const hitWidth = Number(target.dataset.rerollTargetHitWidth);
          const hitHeight = Number(target.dataset.rerollTargetHitHeight);
          const visibleWidth = Number(target.dataset.rerollTargetVisualWidth);
          const visibleHeight = Number(target.dataset.rerollTargetVisualHeight);
          const faceOutline = target.querySelector<SVGElement>(
            '[data-reroll-target-face-outline="true"]',
          );
          const outlineStroke = target.querySelector<SVGPathElement>(
            '[data-reroll-target-outline-stroke="true"]',
          );
          return {
            dieIndex,
            selected: target.dataset.rerollTargetSelected === "true",
            shape: target.dataset.rerollTargetShape ?? "",
            highlightRenderer: target.dataset.rerollTargetHighlightRenderer ?? "",
            visualContract: target.dataset.rerollTargetVisualContract ?? "",
            visualLayer: target.dataset.rerollTargetVisualLayer ?? "",
            outlinePaint: target.dataset.rerollTargetOutlinePaint ?? "",
            outlineRotateZ: Number(target.dataset.rerollTargetOutlineRotateZ),
            outlinePointCount: Number(target.dataset.rerollTargetOutlinePointCount),
            outlinePoints: target.dataset.rerollTargetOutlinePoints ?? "",
            outlineExists: Boolean(faceOutline),
            outlineState:
              faceOutline?.getAttribute("data-reroll-target-outline-state") ?? "",
            outlineStrokeWidth: Number(outlineStroke?.getAttribute("stroke-width") ?? "0"),
            outlineStrokeOpacity: Number(outlineStroke?.getAttribute("opacity") ?? "0"),
            targetTransform: getComputedStyle(target).transform,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            screenWidth: rect.width,
            screenHeight: rect.height,
            targetWidth: hitWidth,
            targetHeight: hitHeight,
            visibleWidth,
            visibleHeight,
            hitBoxPadding: Math.max(
              0,
              (hitWidth - visibleWidth) / 2,
              (hitHeight - visibleHeight) / 2,
            ),
            domCandidateVisualExists: Boolean(
              target.querySelector(
                '[data-reroll-target-candidate-underline="true"], [data-reroll-target-candidate-box="true"]',
              ),
            ),
            domSelectedBorderExists: Boolean(
              target.querySelector('[data-reroll-target-selected-border="true"]'),
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
        visualContract: layer?.dataset.rerollVisualContract ?? "",
        sourceRenderer: source?.dataset.diceHighlightRenderer ?? "",
        canvasRenderer: activeCanvas?.dataset.diceHighlightRenderer ?? "",
        domVisualBoxCount: layer
          ? layer.querySelectorAll(
              '[data-reroll-target-candidate-underline="true"], [data-reroll-target-candidate-box="true"], [data-reroll-target-selected-border="true"]',
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
        if (metrics.visualContract !== REROLL_VISUAL_CONTRACT)
          return `contract:${metrics.visualContract}`;
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
        `第 ${leftTarget.dieIndex + 1} 颗和第 ${rightTarget.dieIndex + 1} 颗改骰透明热区不能重叠：${JSON.stringify(metrics)}`,
      ).toBeLessThanOrEqual(1);
    }
  }
  for (const target of metrics.targets) {
    const evidence = JSON.stringify({ target, metrics });
    const isSelected = target.dieIndex === selectedDieIndex;
    expect(target.shape, `选骰热区必须绑定骰子本体：${evidence}`).toBe(
      "die-face",
    );
    expect(
      target.highlightRenderer,
      `WebGL 辅助高亮必须继续来自 Three.js 骰体描边：${evidence}`,
    ).toBe(REROLL_HIGHLIGHT_RENDERER);
    expect(target.visualContract).toBe(REROLL_VISUAL_CONTRACT);
    expect(target.visualLayer).toBe("transparent-hitbox-only");
    expect(target.outlinePaint).toBe(REROLL_TARGET_OUTLINE_RENDERER);
    expect(Number.isFinite(target.outlineRotateZ)).toBe(true);
    expect(
      target.outlinePointCount,
      `选骰可见框必须绑定当前骰面投影点，不能退回轴对齐大框：${evidence}`,
    ).toBeGreaterThanOrEqual(4);
    expect(
      target.outlinePoints,
      `选骰可见框必须保存当前骰面投影点：${evidence}`,
    ).not.toBe("");
    expect(target.outlineExists, `必须有贴脸 SVG 可见框：${evidence}`).toBe(true);
    expect(target.outlineState).toBe(isSelected ? "selected" : "candidate");
    expect(
      target.outlineStrokeWidth,
      `贴脸 SVG 描边要清楚，但不能用大框遮骰子：${evidence}`,
    ).toBeGreaterThanOrEqual(isSelected ? 3 : 2);
    expect(
      target.outlineStrokeOpacity,
      `贴脸 SVG 描边透明度要清晰可见：${evidence}`,
    ).toBeGreaterThanOrEqual(isSelected ? 0.95 : 0.85);
    expect(target.targetTransform).not.toBe("none");
    expect(Math.abs(target.targetWidth - target.visibleWidth)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(target.targetHeight - target.visibleHeight)).toBeLessThanOrEqual(1.5);
    expect(target.hitBoxPadding).toBeGreaterThanOrEqual(0);
    expect(target.hitBoxPadding).toBeLessThanOrEqual(1);
    expect(
      target.domCandidateVisualExists,
      `DOM 层不得保留候选底线或候选框，避免遮挡骰子或和 shader 外壳错位：${evidence}`,
    ).toBe(false);
    expect(
      target.domSelectedBorderExists,
      `DOM 层不得保留选中边框，选中高亮必须由 shader 外壳承担：${evidence}`,
    ).toBe(false);
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
    expect(target.shell?.blending).toBe(2);
    if (isSelected) {
      expect(target.highlight?.variant).toBe("selected");
      expect(
        target.highlight?.color,
        "选中骰子的高亮色必须和黄色骰子本体强对比，不能退回黄色外壳",
      ).toBe(REROLL_SELECTED_COLOR);
      expect(target.shell?.variant).toBe("selected");
      expect(target.shell?.scale).toBeGreaterThanOrEqual(1.06);
      expect(target.shell?.scale).toBeLessThanOrEqual(1.075);
      expect(target.shell?.opacity).toBeGreaterThanOrEqual(0.8);
      expect(target.shell?.shaderIntensity).toBeGreaterThanOrEqual(1.5);
      expect(target.shell?.shaderOutlineOffset).toBeGreaterThanOrEqual(0.024);
    } else {
      expect(target.highlight?.variant).toBe("candidate");
      expect(target.highlight?.color).toBe(REROLL_CANDIDATE_COLOR);
      expect(target.shell?.variant).toBe("candidate");
      expect(target.shell?.scale).toBeGreaterThanOrEqual(1.04);
      expect(target.shell?.scale).toBeLessThanOrEqual(1.055);
      expect(target.shell?.opacity).toBeGreaterThanOrEqual(0.65);
      expect(target.shell?.opacity).toBeLessThanOrEqual(0.78);
      expect(target.shell?.shaderIntensity).toBeLessThan(1.3);
      expect(target.shell?.shaderOutlineOffset).toBeLessThan(0.02);
    }
  }
}

test.describe("山屋惊魂兔脚重掷完整链路", () => {
  test("兔脚确认使用后显示新骰面并自动完成属性变更", async ({
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
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(discoveryPanel).toContainText("知识检定");
    await expect(discoveryPanel).toContainText("等待投骰");
    const eventRollStart = page.getByTestId("betrayal-event-roll-start");
    await expect(eventRollStart).toBeVisible();
    await expect(eventRollStart).toBeEnabled();
    await setHarnessRandomQueue(page, [0.99, 0.01, 0.01]);
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await eventRollStart.click();
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("知识检定");
    await expect(rollPanel).toContainText("总点数 2");
    const rabbitFootCard = page.getByTestId("betrayal-inventory-rope");
    await expect(rabbitFootCard, "重掷前必须看得到兔脚本体").toBeVisible();
    await expect(rabbitFootCard).toHaveAttribute("data-roll-modifier-available", "true", {
      timeout: 45000,
    });
    await rabbitFootCard.click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toHaveText("兔脚");
    await expect(rabbitFootCard).toHaveAttribute("aria-pressed", "true");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await saveScreenshot(page, INITIAL_ROLL_MOTION_SCREENSHOT);
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
    await saveScreenshot(page, BEFORE_REROLL_SCREENSHOT);

    await expect(rollPanel).toBeVisible();

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
    const targetBox = await rerollTargetDie.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        screenWidth: rect.width,
        screenHeight: rect.height,
        width: Number(element.dataset.rerollTargetHitWidth),
        height: Number(element.dataset.rerollTargetHitHeight),
        visualWidth: Number(element.dataset.rerollTargetVisualWidth),
        visualHeight: Number(element.dataset.rerollTargetVisualHeight),
        outlinePaint: element.dataset.rerollTargetOutlinePaint,
        outlineRotateZ: Number(element.dataset.rerollTargetOutlineRotateZ),
      };
    });
    expect(
      targetBox.outlinePaint,
      "选骰可见框必须来自骰面投影 SVG 描边，Three.js shell 只做低透明外壳辅助",
    ).toBe(REROLL_TARGET_OUTLINE_RENDERER);
    expect(
      Number.isFinite(targetBox.outlineRotateZ),
      "选骰方框必须暴露当前屏幕旋转角，不能退回轴对齐大框",
    ).toBe(true);
    expect(
      Math.abs(targetBox.width - targetBox.visualWidth),
      "选骰命中区宽度必须贴合骰面投影，不是旁路数字按钮",
    ).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(targetBox.height - targetBox.visualHeight),
      "选骰命中区高度必须贴合骰面投影，不是旁路数字按钮",
    ).toBeLessThanOrEqual(1.5);
    await expect(rollPanel).toBeVisible();
    await expectRabbitFootRerollHighlightState(rollPanel, {
      targetCount: 3,
      selectedDieIndex: null,
    });
    await saveScreenshot(page, RABBIT_FOOT_SELECTED_SCREENSHOT);

    await setHarnessRandomQueue(page, [0.99]);
    await rerollTargetDie.click();
    await expect(page.getByTestId("betrayal-roll-modifier-confirm")).toBeVisible();
    await expect(rollPanel).toBeVisible();
    await expectRabbitFootRerollHighlightState(rollPanel, {
      targetCount: 3,
      selectedDieIndex: 1,
    });
    await saveScreenshot(page, REROLL_SELECTED_SCREENSHOT);
    const rerollStartLayout = await rollPanel.evaluate((node) => {
      const panel = node as HTMLElement;
      const group = panel.querySelector<HTMLElement>(
        '[data-testid="betrayal-house-dice-3d-group"]',
      );
      const canvas =
        Array.from(panel.querySelectorAll("canvas"))
          .filter((candidate): candidate is HTMLCanvasElement =>
            candidate instanceof HTMLCanvasElement,
          )
          .find((candidate) => Boolean(candidate.dataset.testid)) ?? null;
      const debugKey = canvas?.dataset.testid ?? group?.dataset.diceDebugKey;
      const debugRegistry =
        (window as typeof window & {
          __diceBoxThreeDebug?: Record<string, () => {
            dice?: Array<{ layout?: { x: number; y: number } | null }>;
          } | null>;
        }).__diceBoxThreeDebug ?? {};
      return debugKey ? debugRegistry[debugKey]?.()?.dice?.[1]?.layout ?? null : null;
    });

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
      const rerollMotionEvidence = (await rerollMotionCapture.saveVisibleFrame(
        REROLL_MOTION_SCREENSHOT,
      )) as {
        motionEvidenceType?: string;
        screenShiftPx?: number;
        screenBoundsShiftPx?: number;
        positionShift?: number;
        rotationShift?: number;
        screenshotFrame?: {
          canvasWidth?: number;
          canvasHeight?: number;
          currentLayout?: {
            minX: number;
            maxX: number;
            minY: number;
            maxY: number;
          } | null;
          visibleShiftPx?: number;
          positionShift?: number;
          rotationShift?: number;
          motionEvidenceType?: string;
          currentValue?: number | null;
          currentValues?: Array<number | null>;
          visibleRuleValues?: string;
        };
      };
      const rerollMotionAmount = Math.max(
        rerollMotionEvidence.screenShiftPx ?? 0,
        rerollMotionEvidence.screenBoundsShiftPx ?? 0,
        rerollMotionEvidence.positionShift ?? 0,
        rerollMotionEvidence.rotationShift ?? 0,
        rerollMotionEvidence.screenshotFrame?.visibleShiftPx ?? 0,
        rerollMotionEvidence.screenshotFrame?.positionShift ?? 0,
        rerollMotionEvidence.screenshotFrame?.rotationShift ?? 0,
      );
      expect(
        rerollMotionEvidence.motionEvidenceType ??
          rerollMotionEvidence.screenshotFrame?.motionEvidenceType ??
          "",
        `兔脚重掷动画截图必须来自真实重掷过程中的位移、位置变化或旋转变化：${JSON.stringify(rerollMotionEvidence)}`,
      ).toMatch(/^(screen-shift|position-shift|rotation-shift)$/);
      expect(
        rerollMotionAmount,
        `兔脚重掷动画截图必须有可见运动量，而不是稳定骰盘或贴图闪切：${JSON.stringify(rerollMotionEvidence)}`,
      ).toBeGreaterThan(0);
      const motionFrame = rerollMotionEvidence.screenshotFrame;
      const motionLayout = motionFrame?.currentLayout;
      expect(
        motionLayout,
        `兔脚重掷过程帧必须能读到目标骰子的屏幕投影：${JSON.stringify(rerollMotionEvidence)}`,
      ).not.toBeNull();
      expect(
        motionLayout!.minX,
        `兔脚重掷过程帧不能水平离开骰盘画布：${JSON.stringify(rerollMotionEvidence)}`,
      ).toBeGreaterThanOrEqual(-2);
      expect(
        motionLayout!.maxX,
        `兔脚重掷过程帧不能水平离开骰盘画布：${JSON.stringify(rerollMotionEvidence)}`,
      ).toBeLessThanOrEqual((motionFrame?.canvasWidth ?? 0) + 2);
      expect(
        motionLayout!.minY,
        `兔脚重掷过程帧不能在俯视方向飞出可见画布：${JSON.stringify(rerollMotionEvidence)}`,
      ).toBeGreaterThanOrEqual(-2);
      expect(
        motionLayout!.maxY,
        `兔脚重掷过程帧不能在俯视方向飞出可见画布：${JSON.stringify(rerollMotionEvidence)}`,
      ).toBeLessThanOrEqual((motionFrame?.canvasHeight ?? 0) + 2);
      await expect(rabbitFootDice).toBeHidden();
    } finally {
      await rerollMotionCapture.stop();
    }
    await expect(
      page.getByText("使用兔脚重掷第 2 颗骰子", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
      "兔脚重掷后不能残留已选物品",
    ).toHaveText("未选卡牌");
    await expect(
      page.getByTestId("betrayal-rabbit-foot-dice"),
      "兔脚重掷后选骰层必须清空",
    ).toHaveCount(0);
    await waitForPhysicalDiceSettled(rollPanel);
    await expect(
      rollPanel.getByTestId("betrayal-house-dice-3d-group"),
      "兔脚重掷停稳后必须展示新骰面，再自动完成属性结算",
    ).toHaveAttribute("data-dice-visible-rule-values", "2,2,0");
    const rerollFinalLayout = await rollPanel.evaluate((node) => {
      const panel = node as HTMLElement;
      const group = panel.querySelector<HTMLElement>(
        '[data-testid="betrayal-house-dice-3d-group"]',
      );
      const canvas =
        Array.from(panel.querySelectorAll("canvas"))
          .filter((candidate): candidate is HTMLCanvasElement =>
            candidate instanceof HTMLCanvasElement,
          )
          .find((candidate) => Boolean(candidate.dataset.testid)) ?? null;
      const debugKey = canvas?.dataset.testid ?? group?.dataset.diceDebugKey;
      const debugRegistry =
        (window as typeof window & {
          __diceBoxThreeDebug?: Record<string, () => {
            dice?: Array<{ layout?: { x: number; y: number } | null }>;
          } | null>;
        }).__diceBoxThreeDebug ?? {};
      return debugKey ? debugRegistry[debugKey]?.()?.dice?.[1]?.layout ?? null : null;
    });
    if (rerollStartLayout && rerollFinalLayout) {
      const finalShift = Math.hypot(
        rerollFinalLayout.x - rerollStartLayout.x,
        rerollFinalLayout.y - rerollStartLayout.y,
      );
      expect(
        finalShift,
        `兔脚重掷后目标骰子不能回到完全相同屏幕位置，否则看起来像原地打转：${JSON.stringify({ rerollStartLayout, rerollFinalLayout })}`,
      ).toBeGreaterThanOrEqual(12);
    }
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
            rabbitFootUsed: core?.usedCardIdsThisTurn.includes("rope") ?? false,
            recentRollDice: core?.recentRoll?.dice ?? null,
            recentRollRerolledDieIndex:
              core?.recentRoll?.lastRabbitFootRerollDieIndex ?? null,
          };
        });
        return !state.pending &&
          state.knowledge === 4 &&
          state.speed === 4 &&
          state.rabbitFootUsed &&
          Array.isArray(state.recentRollDice) &&
          state.recentRollDice.join(",") === "2,2,0" &&
          state.recentRollRerolledDieIndex === 1
          ? "auto-finalized"
          : JSON.stringify(state);
      }, { timeout: 8000 })
      .toBe("auto-finalized");

    await expect(page.getByTestId("betrayal-event-roll-finalize")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-discovery-continue")).toHaveCount(0);
    await saveScreenshot(page, REROLL_RESULT_CONFIRM_SCREENSHOT);
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await saveScreenshot(page, REROLL_FINALIZED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-rabbit-foot-reroll", diagnostics },
    ]);
  });
});
