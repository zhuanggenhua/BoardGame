import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTutorial } from "../../contexts/TutorialContext";
import { playSound } from "../../lib/audio/useGameAudio";
import { AudioManager } from "../../lib/audio/AudioManager";
import { UI_Z_INDEX } from "../../core";
import { MOBILE_MAX_VIEWPORT_WIDTH } from "../../shared/mobileSupport";
import { useRuntimeViewport } from "../../hooks/ui/useRuntimeViewport";

const TUTORIAL_NEXT_SOUND_KEY =
  "ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.buttons.tab_switching_button.uiclick_tab_switching_button_01_krst_none";

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getRectIntersectionArea = (
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) => {
  const overlapWidth = Math.max(
    0,
    Math.min(a.right, b.right) - Math.max(a.left, b.left),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  );
  return overlapWidth * overlapHeight;
};

const getPlacementAxisClearance = (
  placement: "top" | "bottom" | "left" | "right",
  candidateBounds: { left: number; top: number; right: number; bottom: number },
  targetBounds: { left: number; top: number; right: number; bottom: number },
) => {
  switch (placement) {
    case "top":
      return targetBounds.top - candidateBounds.bottom;
    case "bottom":
      return candidateBounds.top - targetBounds.bottom;
    case "left":
      return targetBounds.left - candidateBounds.right;
    case "right":
      return candidateBounds.left - targetBounds.right;
    default:
      return 0;
  }
};

type TutorialTooltipStyles = {
  style: React.CSSProperties;
  arrowClass: string;
  placement: string;
};

const areStyleObjectsEqual = (
  left: React.CSSProperties,
  right: React.CSSProperties,
) => {
  const leftKeys = Object.keys(left) as Array<keyof React.CSSProperties>;
  const rightKeys = Object.keys(right) as Array<keyof React.CSSProperties>;
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const areTooltipStylesEqual = (
  left: TutorialTooltipStyles,
  right: TutorialTooltipStyles,
) =>
  left.arrowClass === right.arrowClass &&
  left.placement === right.placement &&
  areStyleObjectsEqual(left.style, right.style);

const getCompactTutorialPanelMetrics = (
  viewportWidth: number,
  viewportHeight: number,
  safeArea: { top: number; right: number; bottom: number; left: number },
) => {
  const edgeInset = 12;
  const safeWidth = Math.max(
    220,
    viewportWidth - safeArea.left - safeArea.right - edgeInset * 2,
  );
  const safeHeight = Math.max(
    160,
    viewportHeight - safeArea.top - safeArea.bottom - edgeInset * 2,
  );
  const panelScale = clampNumber(viewportHeight / 440, 0.82, 0.94);
  const visualWidth = clampNumber(Math.round(viewportWidth * 0.36), 260, 300);
  const visualMaxHeight = clampNumber(
    Math.round(viewportHeight * 0.62),
    210,
    safeHeight - 8,
  );
  const panelWidth = Math.min(
    Math.round(visualWidth / panelScale),
    Math.floor(safeWidth / panelScale),
  );
  const panelMaxHeight = Math.min(
    Math.round(visualMaxHeight / panelScale),
    Math.floor(safeHeight / panelScale),
  );

  return {
    edgeInset,
    panelScale,
    panelWidth,
    panelMaxHeight,
  };
};

/** Check if an element is inside an overflow:hidden ancestor (before the viewport root). */
function hasOverflowHiddenAncestor(el: Element): boolean {
  let parent = el.parentElement;
  while (parent && parent !== document.documentElement) {
    const overflow = getComputedStyle(parent).overflow;
    if (overflow === "hidden") return true;
    parent = parent.parentElement;
  }
  return false;
}

const escapeTutorialTargetSelector = (value: string): string => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
};

export const TutorialOverlay: React.FC = () => {
  const { isActive, currentStep, nextStep, isLastStep, tutorial } = useTutorial();
  const stepNamespace = currentStep?.content?.includes(":")
    ? currentStep.content.split(":")[0]
    : undefined;
  const namespaces = stepNamespace ? ["tutorial", stepNamespace] : ["tutorial"];
  const { t } = useTranslation(namespaces);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const lastStepIdRef = useRef<string | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const [positionedStepId, setPositionedStepId] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const viewport = useRuntimeViewport();

  const [tooltipStyles, setTooltipStyles] = useState<TutorialTooltipStyles>({
    style: {},
    arrowClass: "",
    placement: "hidden",
  });
  const isMobileViewport =
    viewport.width > 0 && viewport.width <= MOBILE_MAX_VIEWPORT_WIDTH;
  const isCompactTutorialLayout =
    isMobileViewport && viewport.width > viewport.height;
  const visibleTargetRect =
    positionedStepId === currentStep?.id ? targetRect : null;
  const isBottomConfirmStep =
    currentStep?.position === "center" &&
    currentStep.infoStep &&
    Boolean(currentStep.highlightTarget);
  const rootViewportWidth =
    viewport.width > 0
      ? viewport.width
      : typeof document !== "undefined"
        ? document.documentElement.clientWidth
        : 0;
  const rootViewportHeight =
    viewport.height > 0
      ? viewport.height
      : typeof document !== "undefined"
        ? document.documentElement.clientHeight
        : 0;

  useEffect(() => {
    if (!isActive) return;
    AudioManager.preloadKeys([TUTORIAL_NEXT_SOUND_KEY]);
  }, [isActive]);

  // 统一布局 effect：找元素 + 算位置在同一个回调里完成，不会有过期数据
  useEffect(() => {
    if (!isActive || !currentStep) return;

    const stepId = currentStep.id;
    const highlightTarget = currentStep.highlightTarget;
    const position = currentStep.position;
    const viewportWidth = rootViewportWidth;
    const viewportHeight = rootViewportHeight;
    const safeArea = viewport.safeArea;

    if (lastStepIdRef.current !== stepId) {
      lastStepIdRef.current = stepId;
      hasAutoScrolledRef.current = false;
      // 新步骤先解除旧步骤留下的高度上限，再按当前正文重新测量。
      // 否则长说明会继承上一张气泡的 max-height，测量结果也会被永久截短。
      if (tooltipRef.current) {
        tooltipRef.current.style.maxHeight = "none";
      }
    }

    let resizeObserver: ResizeObserver | null = null;
    let rafId: number | null = null;

    const commitTooltipLayout = (nextStyles: TutorialTooltipStyles) => {
      setTooltipStyles((prev) =>
        areTooltipStylesEqual(prev, nextStyles) ? prev : nextStyles,
      );
      setPositionedStepId((prev) => (prev === stepId ? prev : stepId));
    };

    /** 从 DOMRect 直接算出提示框位置，和 targetRect 一起原子更新 */
    const applyLayout = (rect: DOMRect | null) => {
      // 1. 更新高亮区域
      setTargetRect((prev) => {
        if (!rect) return null;
        if (
          prev &&
          Math.abs(prev.top - rect.top) < 0.5 &&
          Math.abs(prev.left - rect.left) < 0.5 &&
          Math.abs(prev.width - rect.width) < 0.5 &&
          Math.abs(prev.height - rect.height) < 0.5
        ) {
          return prev;
        }
        return rect;
      });

      // 2. 计算提示框位置
      const isCenterPosition = position === "center";
      const bottomConfirmInset = safeArea.bottom + 60;
      if (isCompactTutorialLayout) {
        const compactPanel = getCompactTutorialPanelMetrics(
          viewportWidth,
          viewportHeight,
          safeArea,
        );
        const scaledWidth = compactPanel.panelWidth * compactPanel.panelScale;
        const estimatedHeight =
          compactPanel.panelMaxHeight * compactPanel.panelScale;
        const lateralTop = rect
          ? rect.bottom >= viewportHeight * 0.68
            ? safeArea.top + compactPanel.edgeInset
            : rect.top <= viewportHeight * 0.32
              ? viewportHeight -
                safeArea.bottom -
                compactPanel.edgeInset -
                estimatedHeight
              : clampNumber(
                  rect.top + rect.height / 2 - estimatedHeight / 2,
                  safeArea.top + compactPanel.edgeInset,
                  viewportHeight -
                    safeArea.bottom -
                    compactPanel.edgeInset -
                    estimatedHeight,
                )
          : (viewportHeight - estimatedHeight) / 2;
        const preferredPlacement =
          position === "left" ||
          position === "right" ||
          position === "top" ||
          position === "bottom"
            ? position
            : null;
        const compactCandidates = [
          {
            placement: "bottom",
            style: {
              position: "fixed",
              left: "50%",
              bottom: safeArea.bottom + compactPanel.edgeInset,
              transform: `translateX(-50%) scale(${compactPanel.panelScale})`,
              transformOrigin: "bottom center",
              width: compactPanel.panelWidth,
              maxWidth: compactPanel.panelWidth,
              zIndex: UI_Z_INDEX.tutorial,
              maxHeight: compactPanel.panelMaxHeight,
            } satisfies React.CSSProperties,
            bounds: {
              left: (viewportWidth - scaledWidth) / 2,
              top:
                viewportHeight -
                safeArea.bottom -
                compactPanel.edgeInset -
                estimatedHeight,
              right: (viewportWidth + scaledWidth) / 2,
              bottom: viewportHeight - safeArea.bottom - compactPanel.edgeInset,
            },
          },
          {
            placement: "top",
            style: {
              position: "fixed",
              left: "50%",
              top: safeArea.top + compactPanel.edgeInset,
              transform: `translateX(-50%) scale(${compactPanel.panelScale})`,
              transformOrigin: "top center",
              width: compactPanel.panelWidth,
              maxWidth: compactPanel.panelWidth,
              zIndex: UI_Z_INDEX.tutorial,
              maxHeight: compactPanel.panelMaxHeight,
            } satisfies React.CSSProperties,
            bounds: {
              left: (viewportWidth - scaledWidth) / 2,
              top: safeArea.top + compactPanel.edgeInset,
              right: (viewportWidth + scaledWidth) / 2,
              bottom: safeArea.top + compactPanel.edgeInset + estimatedHeight,
            },
          },
          {
            placement: "left",
            style: {
              position: "fixed",
              left: safeArea.left + compactPanel.edgeInset,
              top: lateralTop,
              transform: `scale(${compactPanel.panelScale})`,
              transformOrigin: "left top",
              width: compactPanel.panelWidth,
              maxWidth: compactPanel.panelWidth,
              zIndex: UI_Z_INDEX.tutorial,
              maxHeight: compactPanel.panelMaxHeight,
            } satisfies React.CSSProperties,
            bounds: {
              left: safeArea.left + compactPanel.edgeInset,
              top: lateralTop,
              right: safeArea.left + compactPanel.edgeInset + scaledWidth,
              bottom: lateralTop + estimatedHeight,
            },
          },
          {
            placement: "right",
            style: {
              position: "fixed",
              right: safeArea.right + compactPanel.edgeInset,
              top: lateralTop,
              transform: `scale(${compactPanel.panelScale})`,
              transformOrigin: "right top",
              width: compactPanel.panelWidth,
              maxWidth: compactPanel.panelWidth,
              zIndex: UI_Z_INDEX.tutorial,
              maxHeight: compactPanel.panelMaxHeight,
            } satisfies React.CSSProperties,
            bounds: {
              left:
                viewportWidth -
                safeArea.right -
                compactPanel.edgeInset -
                scaledWidth,
              top: lateralTop,
              right: viewportWidth - safeArea.right - compactPanel.edgeInset,
              bottom: lateralTop + estimatedHeight,
            },
          },
        ];

        const compactTargetBounds = rect
          ? {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            }
          : null;
        const prefersLateralPlacement = compactTargetBounds
          ? (() => {
              const targetWidth =
                compactTargetBounds.right - compactTargetBounds.left;
              const targetHeight =
                compactTargetBounds.bottom - compactTargetBounds.top;
              const targetCenterX =
                (compactTargetBounds.left + compactTargetBounds.right) / 2;
              const isTopOrBottomBand =
                compactTargetBounds.bottom >= viewportHeight * 0.68 ||
                compactTargetBounds.top <= viewportHeight * 0.32;
              const overlapsViewportCenterLane =
                compactTargetBounds.left <= viewportWidth * 0.58 &&
                compactTargetBounds.right >= viewportWidth * 0.42;
              const isStripLikeTarget =
                targetWidth >= viewportWidth * 0.18 ||
                Math.abs(targetCenterX - viewportWidth / 2) <=
                  viewportWidth * 0.18;

              return (
                isTopOrBottomBand &&
                targetHeight <= viewportHeight * 0.36 &&
                isStripLikeTarget &&
                overlapsViewportCenterLane
              );
            })()
          : false;
        const rankedCompactCandidates = compactCandidates
          .map((candidate, index) => {
            const overlap = compactTargetBounds
              ? getRectIntersectionArea(candidate.bounds, compactTargetBounds)
              : 0;
            const lateralPenalty =
              prefersLateralPlacement &&
              (candidate.placement === "top" ||
                candidate.placement === "bottom")
                ? 1
                : 0;
            const axisClearance = compactTargetBounds
              ? getPlacementAxisClearance(
                  candidate.placement as "top" | "bottom" | "left" | "right",
                  candidate.bounds,
                  compactTargetBounds,
                )
              : 0;
            const preferencePenalty =
              preferredPlacement && candidate.placement !== preferredPlacement
                ? 1
                : 0;
            const centerDistancePenalty = rect
              ? Math.abs(
                  (candidate.bounds.left + candidate.bounds.right) / 2 -
                    (rect.left + rect.right) / 2,
                )
              : 0;
            return {
              candidate,
              overlap,
              lateralPenalty,
              axisClearance,
              preferencePenalty,
              centerDistancePenalty,
              index,
            };
          })
          .sort((a, b) => {
            if (a.overlap !== b.overlap) return a.overlap - b.overlap;
            if (a.lateralPenalty !== b.lateralPenalty)
              return a.lateralPenalty - b.lateralPenalty;
            if (a.axisClearance !== b.axisClearance)
              return b.axisClearance - a.axisClearance;
            if (a.preferencePenalty !== b.preferencePenalty)
              return a.preferencePenalty - b.preferencePenalty;
            if (a.centerDistancePenalty !== b.centerDistancePenalty)
              return b.centerDistancePenalty - a.centerDistancePenalty;
            return a.index - b.index;
          });
        const explicitVerticalCandidate =
          preferredPlacement === "top" || preferredPlacement === "bottom"
            ? compactCandidates.find(
                (candidate) => candidate.placement === preferredPlacement,
              )
            : undefined;
        const chosenCompactCandidate =
          explicitVerticalCandidate ??
          rankedCompactCandidates[0]?.candidate ??
          compactCandidates[0];

        commitTooltipLayout({
          style: chosenCompactCandidate.style,
          arrowClass: "hidden",
          placement: chosenCompactCandidate.placement,
        });
        return;
      }

      if (!rect || isCenterPosition) {
        commitTooltipLayout({
          style: {
            position: "fixed",
            bottom: isBottomConfirmStep
              ? bottomConfirmInset
              : safeArea.bottom + 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: UI_Z_INDEX.tutorial,
            maxWidth: Math.max(
              240,
              viewportWidth - safeArea.left - safeArea.right - 24,
            ),
          },
          arrowClass: "hidden",
          placement: isCenterPosition ? "center" : "floating",
        });
        return;
      }

      const padding = 12;
      const tooltipWidth = 384;
      // 用实际 DOM 尺寸，首次渲染前 fallback 到估算值
      const measured = tooltipRef.current?.getBoundingClientRect();
      const tooltipHeight = measured ? measured.height : 160;
      const actualTooltipWidth = measured ? measured.width : tooltipWidth;

      const spaceRight = viewportWidth - rect.right;
      const spaceLeft = rect.left;
      const spaceBottom = viewportHeight - rect.bottom;

      type TooltipPlacement = "right" | "left" | "bottom" | "top";

      let pos: TooltipPlacement;
      if (position) {
        pos = position;
      } else if (spaceRight > tooltipWidth + 20) {
        pos = "right";
      } else if (spaceLeft > tooltipWidth + 20) {
        pos = "left";
      } else if (spaceBottom > tooltipHeight + 20) {
        pos = "bottom";
      } else {
        pos = "top";
      }

      const arrowBase =
        "bg-white w-4 h-4 absolute rotate-45 border-gray-100 z-0";
      const safeMargin = 8;
      const minTop = safeArea.top + safeMargin;
      const maxTop =
        viewportHeight - tooltipHeight - safeArea.bottom - safeMargin;
      const minLeft = safeArea.left + safeMargin;
      const maxLeft =
        viewportWidth - actualTooltipWidth - safeArea.right - safeMargin;
      const targetBounds = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
      const buildPlacement = (placement: TooltipPlacement) => {
        const styles: React.CSSProperties = {
          position: "fixed",
          zIndex: UI_Z_INDEX.tutorial,
        };
        let arrow = "";
        switch (placement) {
          case "right":
            styles.left = rect.right + padding;
            styles.top = rect.top + rect.height / 2 - tooltipHeight / 2;
            arrow = "-left-[6px] top-[40px] border-b border-l";
            break;
          case "left":
            styles.left = rect.left - actualTooltipWidth - padding;
            styles.top = rect.top + rect.height / 2 - tooltipHeight / 2;
            arrow = "-right-[6px] top-[40px] border-t border-r";
            break;
          case "bottom":
            styles.top = rect.bottom + padding;
            styles.left = rect.left + rect.width / 2 - actualTooltipWidth / 2;
            arrow = "-top-[6px] left-1/2 -translate-x-1/2 border-t border-l";
            break;
          case "top":
            styles.top = rect.top - tooltipHeight - padding;
            styles.left = rect.left + rect.width / 2 - actualTooltipWidth / 2;
            arrow = "-bottom-[6px] left-1/2 -translate-x-1/2 border-b border-r";
            break;
        }
        // 视口边界约束后再计算真实重叠，避免“先不遮挡、夹紧后遮挡”。
        if (typeof styles.top === "number") {
          styles.top = Math.max(minTop, Math.min(styles.top as number, maxTop));
        }
        if (typeof styles.left === "number") {
          styles.left = Math.max(
            minLeft,
            Math.min(styles.left as number, maxLeft),
          );
        }
        if (typeof styles.left !== "number" || typeof styles.top !== "number")
          return null;
        const bounds = {
          left: styles.left,
          top: styles.top,
          right: styles.left + actualTooltipWidth,
          bottom: styles.top + tooltipHeight,
        };
        return {
          styles,
          arrow,
          placement,
          bounds,
          overlapArea: getRectIntersectionArea(bounds, targetBounds),
        };
      };

      const placementOrder = [
        pos,
        "right",
        "left",
        "bottom",
        "top",
      ].filter(
        (placement, index, placements) =>
          placements.indexOf(placement) === index,
      ) as TooltipPlacement[];
      const selectedPlacement = placementOrder
        .map((placement, index) => ({
          candidate: buildPlacement(placement),
          index,
        }))
        .filter(
          (
            entry,
          ): entry is {
            candidate: NonNullable<ReturnType<typeof buildPlacement>>;
            index: number;
          } => Boolean(entry.candidate),
        )
        .sort(
          (left, right) =>
            left.candidate.overlapArea - right.candidate.overlapArea ||
            left.index - right.index,
        )[0]?.candidate;
      const styles = selectedPlacement?.styles ?? {
        position: "fixed",
        zIndex: UI_Z_INDEX.tutorial,
      };
      const isLateralPlacement =
        selectedPlacement?.placement === "left" ||
        selectedPlacement?.placement === "right";
      const minimumLateralHeight = Math.min(
        320,
        viewportHeight - safeArea.top - safeArea.bottom - safeMargin * 2,
      );
      const topValue =
        typeof styles.top === "number"
          ? isLateralPlacement
            ? Math.max(
                minTop,
                Math.min(
                  styles.top,
                  viewportHeight -
                    Math.max(tooltipHeight, minimumLateralHeight) -
                    safeArea.bottom -
                    safeMargin,
                ),
              )
            : styles.top
          : minTop;
      if (isLateralPlacement && typeof styles.top === "number") {
        styles.top = topValue;
      }
      styles.maxHeight =
        viewportHeight - topValue - safeArea.bottom - safeMargin;

      commitTooltipLayout({
        style: styles,
        arrowClass: `${arrowBase} ${selectedPlacement?.arrow ?? ""}`,
        placement: selectedPlacement?.placement ?? pos,
      });
    };

    const updateLayout = () => {
      if (highlightTarget) {
        const escapedHighlightTarget =
          escapeTutorialTargetSelector(highlightTarget);
        const el =
          document.querySelector(
            `[data-tutorial-id="${escapedHighlightTarget}"]`,
          ) ||
          document.getElementById(highlightTarget) ||
          document.querySelector(`[data-testid="${escapedHighlightTarget}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          applyLayout(rect);
          if (!hasAutoScrolledRef.current) {
            const tolerance = 50;
            const inView =
              rect.top >= -tolerance &&
              rect.left >= -tolerance &&
              rect.bottom <= viewportHeight + tolerance &&
              rect.right <= viewportWidth + tolerance;
            // Only scrollIntoView if the element is NOT inside an overflow:hidden
            // ancestor. Those containers (e.g. transform-based map panning) manage
            // their own visibility; scrollIntoView would produce an unwanted
            // scrollTop offset that conflicts with CSS transform positioning.
            if (!inView && !hasOverflowHiddenAncestor(el)) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            hasAutoScrolledRef.current = true;
          }
          if (!resizeObserver) {
            resizeObserver = new ResizeObserver(() => updateLayout());
            resizeObserver.observe(el);
          }
        } else {
          applyLayout(null);
        }
      } else {
        applyLayout(null);
      }
    };

    // rAF 轮询（~10fps）：追踪元素位置变化（transform 动画等）
    let lastPollTime = 0;
    const POLL_INTERVAL = 100;
    const poll = () => {
      const now = performance.now();
      if (now - lastPollTime >= POLL_INTERVAL) {
        lastPollTime = now;
        updateLayout();
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
    };
  }, [
    currentStep,
    isActive,
    isBottomConfirmStep,
    isCompactTutorialLayout,
    rootViewportHeight,
    rootViewportWidth,
    viewport.height,
    viewport.safeArea,
    viewport.width,
  ]);

  if (!isActive || !currentStep) {
    return null;
  }

  const isPureAiStep =
    currentStep.aiActions &&
    currentStep.aiActions.length > 0 &&
    !currentStep.requireAction &&
    !currentStep.infoStep;

  // 纯自动步骤不显示遮罩层；若当前玩家仍需操作/阅读，浮层必须继续出现。
  if (isPureAiStep) {
    return null;
  }

  // 依赖高亮目标的步骤必须等目标真实出现在 DOM 后再显示，
  // 否则提示卡会提前盖在 loading 或未完成装载的页面上。
  if (currentStep.highlightTarget && !visibleTargetRect) {
    return null;
  }

  // 矢量路径用于带孔洞的遮罩
  const viewportWidth = rootViewportWidth;
  const viewportHeight = rootViewportHeight;
  let maskPath = `M0 0 h${viewportWidth} v${viewportHeight} h-${viewportWidth} z`;
  if (visibleTargetRect) {
    // 逆时针矩形用于创建挖空效果（偶奇填充规则）
    const { left, top, right, bottom } = visibleTargetRect;
    const p = 8;
    maskPath += ` M${left - p} ${top - p} v${bottom - top + p * 2} h${right - left + p * 2} v-${bottom - top + p * 2} z`;
  }

  const maskOpacity = currentStep.showMask && visibleTargetRect ? 0.6 : 0;
  const highlightStyle = visibleTargetRect
    ? ({
        top: visibleTargetRect.top,
        left: visibleTargetRect.left,
        width: visibleTargetRect.width,
        height: visibleTargetRect.height,
        boxSizing: "border-box",
        borderRadius: "8px",
        boxShadow:
          "inset 0 0 0 2px rgba(96, 165, 250, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.55), 0 0 12px rgba(59, 130, 246, 0.35)",
      } satisfies React.CSSProperties)
    : undefined;
  const showHighlightFrame = currentStep.highlightFrame !== "none";

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: UI_Z_INDEX.tutorial }}
      data-tutorial-step={currentStep.id ?? "unknown"}
    >
      {/* 遮罩层 - 仅在遮罩开关为真且目标存在时阻止点击 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300">
        <path
          d={maskPath}
          fill={`rgba(0, 0, 0, ${maskOpacity})`}
          // 当遮罩透明时，允许所有点击穿透
          // 当遮罩可见时，仍需要允许在“孔洞”区域点击
          style={{
            pointerEvents:
              currentStep.showMask && visibleTargetRect ? "auto" : "none",
          }}
          fillRule="evenodd"
        />
      </svg>

      {/* 目标高亮环（苹果风格蓝色光晕）- 目标存在时始终可见 */}
      {visibleTargetRect && showHighlightFrame && (
        <div
          data-testid="tutorial-highlight-ring"
          data-tutorial-highlight-target={currentStep.highlightTarget}
          data-tutorial-highlight-step={currentStep.id ?? "unknown"}
          data-tutorial-highlight-shape="rect"
          className="absolute pointer-events-none"
          style={highlightStyle}
        />
      )}

      {/* 提示框弹窗 - requireAction 时不拦截点击，让用户与游戏 UI 交互 */}
      <div
        ref={tooltipRef}
        className={`${currentStep.requireAction || isBottomConfirmStep ? "pointer-events-none" : "pointer-events-auto"} flex flex-col items-center absolute transition-opacity duration-150`}
        style={{
          ...tooltipStyles.style,
          opacity: positionedStepId === currentStep.id ? 1 : 0,
        }}
      >
        {/* 样式三角箭头 */}
        <div
          className={`absolute w-0 h-0 border-solid ${tooltipStyles.arrowClass}`}
        />

        {/* 内容卡片 */}
        <div
          data-testid="tutorial-overlay-card"
          data-tutorial-placement={tooltipStyles.placement}
          className={`animate-in fade-in zoom-in-95 duration-200 relative font-serif flex flex-col ${currentStep.requireAction || isBottomConfirmStep ? "pointer-events-none" : "pointer-events-auto"} ${
            isBottomConfirmStep
              ? "w-[min(320px,calc(100vw-2rem))]"
              : isCompactTutorialLayout
                ? "w-full max-w-full rounded-xl p-4 bg-[#fcfbf9] shadow-[0_8px_30px_rgba(67,52,34,0.12)] border border-[#e5e0d0]"
                : "max-w-sm w-72 rounded-sm p-5 bg-[#fcfbf9] shadow-[0_8px_30px_rgba(67,52,34,0.12)] border border-[#e5e0d0]"
          }`}
          style={{
            maxHeight: isBottomConfirmStep ? undefined : "inherit",
            width: isBottomConfirmStep ? undefined : "100%",
          }}
        >
          {/* 装饰性边角（右上）*/}
          {!isBottomConfirmStep ? (
            <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-[#c0a080] opacity-40" />
          ) : null}

          {tutorial.skippedStepIds && tutorial.skippedStepIds.length > 0 ? (
            <div
              data-testid="tutorial-skipped-notice"
              className="mb-3 border border-[#e5d8b8] bg-[#f8f2e4] px-3 py-2 text-left text-xs font-bold leading-relaxed text-[#765f3d]"
            >
              {t("overlay.skipped", { count: tutorial.skippedStepIds.length })}
            </div>
          ) : null}

          <div
            data-testid="tutorial-overlay-content"
            className={`text-[#433422] font-bold overflow-y-auto flex-1 min-h-0 whitespace-pre-line ${
              isBottomConfirmStep
                ? "mb-2 max-h-[92px] rounded-sm border border-[#f3e8cc]/20 bg-[rgba(252,251,249,0.92)] px-3 py-2 text-left font-serif text-[12px] leading-[1.45] shadow-[0_6px_18px_rgba(0,0,0,0.22)]"
                : isCompactTutorialLayout
                  ? "mb-2.5 text-left text-[15px] leading-[1.55]"
                  : "mb-4 text-left text-lg leading-relaxed"
            }`}
          >
            {t(currentStep.content)}
          </div>

          {!currentStep.requireAction && (
            <button
              data-testid="tutorial-next-button"
              onClick={() => {
                playSound(TUTORIAL_NEXT_SOUND_KEY);
                nextStep("manual");
              }}
              className={`touch-target-min w-full bg-[#433422] hover:bg-[#2b2114] text-[#fcfbf9] font-bold uppercase transition-all cursor-pointer flex items-center justify-center text-center relative z-10 pointer-events-auto ${
                isBottomConfirmStep
                  ? "rounded-sm border border-[#f3e8cc]/70 py-2.5 text-xs tracking-[0.12em] shadow-[0_6px_18px_rgba(0,0,0,0.34)]"
                  : isCompactTutorialLayout
                    ? "py-2 text-[12px] tracking-[0.14em] rounded-lg"
                    : "py-2 text-sm tracking-widest"
              }`}
            >
              {isBottomConfirmStep
                ? t("overlay.next")
                : isLastStep
                  ? t("overlay.finish")
                  : t("overlay.next")}
            </button>
          )}

          {currentStep.requireAction && (
            <div
              data-testid="tutorial-action-hint"
              className={`flex items-center gap-2 font-bold text-[#8c7b64] bg-[#f3f0e6]/50 border border-[#e5e0d0]/50 justify-center italic ${isCompactTutorialLayout ? "text-[11px] rounded-lg p-2" : "text-sm p-2"}`}
            >
              <span className="animate-pulse w-2 h-2 rounded-full bg-[#c0a080]"></span>
              {t("overlay.clickToContinue")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
