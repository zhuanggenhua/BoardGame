import React from "react";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { HudPortal, UI_Z_INDEX } from "../../core";
import type {
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
  BetrayalMonsterStatusKind,
  BetrayalMonsterSummary,
} from "./game";
import type { BetrayalHauntTokenInstanceSummary } from "./hauntTokenModel";
import type { BetrayalPossessionAtlasVisual } from "./possessionAtlas";
import { PossessionAtlasFrame } from "./atlasFrameSurface";
import { ExplorerFigureToken, GirlBoardToken, MonsterBoardToken } from "./entityTokenSurface";
import { BETRAYAL_VISUAL_TRANSITION_DURATION_MS } from "./visualTiming";

export type BetrayalViewportRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type BetrayalVisualTransition = {
  id: string;
  kind: "explorer-move" | "monster-move" | "girl-transfer" | "possession-gain";
  sourceRect: BetrayalViewportRect;
  targetRect: BetrayalViewportRect | null;
  targetTestId: string;
  fallbackRoomTestId?: string;
  explorer?: BetrayalExplorerSummary;
  monster?: BetrayalMonsterSummary;
  monsterStatus?: BetrayalMonsterStatusKind;
  girlToken?: BetrayalHauntTokenInstanceSummary;
  possessionCard?: BetrayalInventoryCard;
  possessionVisual?: BetrayalPossessionAtlasVisual;
  locale: string;
  tokenLabel?: string;
  tone?: "self" | "ally";
  missingTokenLabel: string;
  attachedTo?: "room" | "explorer" | "mummy";
  onComplete?: () => void;
};

export function findBetrayalTestElement(testId: string): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  return Array.from(document.querySelectorAll<HTMLElement>("[data-testid]"))
    .find((element) => element.dataset.testid === testId) ?? null;
}

export function readBetrayalViewportRect(
  element: Element | null,
): BetrayalViewportRect | null {
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function centerBetrayalRect(
  roomRect: BetrayalViewportRect,
  width: number,
  height: number,
): BetrayalViewportRect {
  return {
    left: roomRect.left + (roomRect.width - width) / 2,
    top: roomRect.top + (roomRect.height - height) / 2,
    width,
    height,
  };
}

export function BetrayalVisualTransitionLayer({
  transition,
  onComplete,
}: {
  transition: BetrayalVisualTransition;
  onComplete: (transitionId: string) => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const [isAnimationTokenHidden, setIsAnimationTokenHidden] =
    React.useState(false);
  const completeTimerRef = React.useRef<number | null>(null);
  const targetRect = transition.targetRect;
  const sourceCenter = {
    x: transition.sourceRect.left + transition.sourceRect.width / 2,
    y: transition.sourceRect.top + transition.sourceRect.height / 2,
  };
  const targetCenter = targetRect
    ? {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      }
    : sourceCenter;
  const isMoveTransition =
    transition.kind === "explorer-move" || transition.kind === "monster-move";
  const finalScale =
    transition.kind === "possession-gain" ? 0.36 : isMoveTransition ? 1 : 0.9;
  const transitionWidth =
    transition.kind === "possession-gain"
      ? Math.min(transition.sourceRect.width, 220)
      : transition.sourceRect.width;
  const transitionHeight =
    transition.kind === "possession-gain"
      ? Math.min(transition.sourceRect.height, 320)
      : transition.sourceRect.height;
  const content = transition.explorer ? (
    <ExplorerFigureToken
      explorer={transition.explorer}
      locale={transition.locale}
      label={transition.tokenLabel ?? transition.explorer.displayName}
      tone={transition.tone ?? "self"}
      missingTokenLabel={transition.missingTokenLabel}
      testIdPrefix="betrayal-visual-transition-explorer-token"
    />
  ) : transition.monster ? (
    <MonsterBoardToken
      monster={transition.monster}
      locale={transition.locale}
      t={t}
      status={transition.monsterStatus ?? "active"}
      testIdPrefix="betrayal-visual-transition-monster-token"
    />
  ) : transition.girlToken ? (
    <GirlBoardToken
      token={transition.girlToken}
      t={t}
      attachedTo={transition.attachedTo ?? "room"}
      testIdPrefix="betrayal-visual-transition-girl-token"
    />
  ) : transition.possessionCard && transition.possessionVisual ? (
    <div className="relative h-full w-full overflow-hidden rounded-[8px] border border-[rgba(255,236,175,0.64)] bg-[rgba(10,8,6,0.96)] shadow-[0_18px_36px_rgba(0,0,0,0.52)]">
      <PossessionAtlasFrame
        visual={transition.possessionVisual}
        locale={transition.locale}
        alt={transition.possessionCard.name}
      />
    </div>
  ) : null;

  React.useEffect(() => {
    setIsAnimationTokenHidden(false);
    return () => {
      if (completeTimerRef.current !== null) {
        window.clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
    };
  }, [transition.id]);

  const handleAnimationComplete = React.useCallback(() => {
    if (!isMoveTransition) {
      onComplete(transition.id);
      return;
    }
    flushSync(() => {
      setIsAnimationTokenHidden(true);
    });
    completeTimerRef.current = window.setTimeout(() => {
      completeTimerRef.current = null;
      onComplete(transition.id);
    }, 0);
  }, [isMoveTransition, onComplete, transition.id]);

  return (
    <HudPortal>
      <div
        data-testid="betrayal-visual-transition-blocker"
        data-transition-kind={transition.kind}
        data-transition-target-testid={transition.targetTestId}
        data-transition-ready={targetRect ? "true" : "false"}
        aria-busy="true"
        className="pointer-events-auto fixed inset-0 cursor-wait"
        style={{ zIndex: UI_Z_INDEX.modalOverlay + 40 }}
      >
        {targetRect ? (
          <motion.div
            data-testid={`betrayal-visual-transition-${transition.id}`}
            data-transition-kind={transition.kind}
            data-transition-phase={
              isAnimationTokenHidden ? "finished" : "moving"
            }
            data-transition-source-center-x={sourceCenter.x}
            data-transition-source-center-y={sourceCenter.y}
            data-transition-target-center-x={targetCenter.x}
            data-transition-target-center-y={targetCenter.y}
            data-transition-delta-x={targetCenter.x - sourceCenter.x}
            data-transition-delta-y={targetCenter.y - sourceCenter.y}
            data-transition-token-visible={
              isAnimationTokenHidden ? "false" : "true"
            }
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center"
            style={{
              left: sourceCenter.x - transitionWidth / 2,
              top: sourceCenter.y - transitionHeight / 2,
              width: transitionWidth,
              height: transitionHeight,
              transformOrigin: "center center",
              visibility: isAnimationTokenHidden ? "hidden" : "visible",
            }}
            initial={{ scale: isMoveTransition ? 1 : 1.06, opacity: 1, x: 0, y: 0 }}
            animate={{
              scale: finalScale,
              opacity: isMoveTransition ? 1 : [1, 1, 0],
              x: targetCenter.x - sourceCenter.x,
              y: targetCenter.y - sourceCenter.y,
            }}
            transition={{
              duration: BETRAYAL_VISUAL_TRANSITION_DURATION_MS / 1000,
              ease: [0.22, 0.8, 0.24, 1],
              ...(isMoveTransition
                ? {}
                : {
                    opacity: {
                      duration: BETRAYAL_VISUAL_TRANSITION_DURATION_MS / 1000,
                      times: [0, 0.78, 1],
                    },
                  }),
            }}
            onAnimationComplete={handleAnimationComplete}
          >
            {content}
          </motion.div>
        ) : null}
      </div>
    </HudPortal>
  );
}
