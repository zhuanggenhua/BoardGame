import React from "react";
import {
  BookOpen,
  Compass,
  Footprints,
  Handshake,
  House,
  Hourglass,
  RotateCcw,
  Search,
  Skull,
  Swords,
  X,
  type LucideIcon,
} from "lucide-react";

import type { ActionBarAction } from "../../core/ui/types";
import { BetrayalConfirmButton } from "./confirmButtonSurface";
import type { BetrayalCore } from "./game";

const ACTION_ICON_BY_ID: Partial<Record<ActionBarAction["id"], LucideIcon>> = {
  move: Footprints,
  monsterMove: Footprints,
  monsterAttack: Swords,
  bloodFromStoneSetupPlacement: House,
  bloodFromStoneConfirmSetupPlacement: House,
  monsterMovementRoll: RotateCcw,
  monsterTurnStart: Skull,
  bloodFromStoneMonsterTurnEnd: Hourglass,
  explore: Search,
  trade: Handshake,
  use: BookOpen,
  roomEffect: RotateCcw,
  endTurn: Hourglass,
  cancelTarget: X,
};

type BetrayalActionDockInteractionMode =
  | "move"
  | "trade"
  | "heal"
  | "attack"
  | "eventChoice"
  | "dustHauntSearch"
  | "dustHauntCure"
  | "inventoryTargetRoom"
  | "helpingHandsTrollMove"
  | "monsterMove"
  | "monsterAttack"
  | "bloodFromStoneSetupPlacement"
  | "hauntTargeting"
  | null;

type BetrayalActionDockSurfaceProps = {
  actions: ActionBarAction[];
  variant: "desktop" | "mobile";
  phase: BetrayalCore["phase"];
  recommendedAction: ActionBarAction["id"] | null | undefined;
  interactionMode: BetrayalActionDockInteractionMode;
  hauntActionKind: string | null | undefined;
  hauntTargetingActionKind: string | null | undefined;
  hasActiveHauntTargetGuide: boolean;
  hasSelectedInventoryCard: boolean;
  hasRoomEndTurnEffect: boolean;
  isBloodFromStoneSetupPlacementMode: boolean;
  isDustSicknessExchangeMode: boolean;
  isHauntTargetingMode: boolean;
  isPhoneLandscapeLayout: boolean;
  hideTradeAction: boolean;
  actionCueText: string;
  actionHandlers: Partial<Record<ActionBarAction["id"], () => void>>;
};

function resolveBetrayalActionButtonState({
  action,
  phase,
  recommendedAction,
  interactionMode,
  hauntActionKind,
  hauntTargetingActionKind,
  hasActiveHauntTargetGuide,
  hasSelectedInventoryCard,
  hasRoomEndTurnEffect,
  isBloodFromStoneSetupPlacementMode,
  isDustSicknessExchangeMode,
}: Pick<
  BetrayalActionDockSurfaceProps,
  | "phase"
  | "recommendedAction"
  | "interactionMode"
  | "hauntActionKind"
  | "hauntTargetingActionKind"
  | "hasActiveHauntTargetGuide"
  | "hasSelectedInventoryCard"
  | "hasRoomEndTurnEffect"
  | "isBloodFromStoneSetupPlacementMode"
  | "isDustSicknessExchangeMode"
> & {
  action: ActionBarAction;
}) {
  const isRoomEndTurnEffectAction =
    action.id === "endTurn" && hasRoomEndTurnEffect;
  const isHauntPrimaryButton =
    phase === "haunt" && action.id === "use" && !hasSelectedInventoryCard;
  const isHauntTargetCancelButton = action.id === "cancelTarget";
  const hauntPrimaryActionMode = isHauntTargetCancelButton
    ? "targeting"
    : isHauntPrimaryButton
      ? hasActiveHauntTargetGuide
        ? "targeting"
        : hauntActionKind === "use"
          ? "execute"
          : hauntActionKind
            ? "choose-target"
            : "unavailable"
      : undefined;
  const hauntPrimaryActionKind = isHauntTargetCancelButton
    ? (hauntTargetingActionKind ?? "none")
    : isHauntPrimaryButton
      ? (hauntActionKind ?? "none")
      : undefined;
  const isBloodFromStoneSetupPlacementButton =
    action.id === "bloodFromStoneSetupPlacement";
  const isBloodFromStoneSetupConfirmButton =
    action.id === "bloodFromStoneConfirmSetupPlacement";
  const isInventoryUseConfirmation =
    action.id === "use" && hasSelectedInventoryCard && !isHauntPrimaryButton;
  const isRecommended =
    action.id === recommendedAction ||
    (interactionMode === "move" && action.id === "move") ||
    (interactionMode === "monsterMove" && action.id === "monsterMove") ||
    (interactionMode === "monsterAttack" && action.id === "monsterAttack") ||
    (isBloodFromStoneSetupPlacementMode &&
      isBloodFromStoneSetupPlacementButton) ||
    (isBloodFromStoneSetupConfirmButton && !action.disabled) ||
    (isDustSicknessExchangeMode && action.id === "trade") ||
    action.id === "monsterTurnStart" ||
    action.id === "monsterMovementRoll" ||
    isRoomEndTurnEffectAction ||
    isHauntPrimaryButton ||
    isHauntTargetCancelButton;

  return {
    hauntPrimaryActionKind,
    hauntPrimaryActionMode,
    isHauntPrimaryButton,
    isHauntTargetCancelButton,
    isInventoryUseConfirmation,
    isRecommended,
    isRoomEndTurnEffectAction,
  };
}

function resolveDesktopActionButtonClassName({
  action,
  isHauntTargetCancelButton,
  isHauntTargetingMode,
  isInventoryUseConfirmation,
  isRecommended,
  isRoomEndTurnEffectAction,
}: {
  action: ActionBarAction;
  isHauntTargetCancelButton: boolean;
  isHauntTargetingMode: boolean;
  isInventoryUseConfirmation: boolean;
  isRecommended: boolean;
  isRoomEndTurnEffectAction: boolean;
}) {
  if (isInventoryUseConfirmation) {
    return "min-w-[132px] px-5 text-[14px] shadow-[0_10px_22px_rgba(0,0,0,0.34)]";
  }

  return `flex min-h-[48px] min-w-[80px] flex-col items-center justify-end gap-0.5 rounded-[5px] border-0 bg-transparent px-1.5 py-1 text-[13px] font-bold uppercase tracking-[0.08em] shadow-none transition ${
    isHauntTargetCancelButton && isHauntTargetingMode ? "absolute" : ""
  } ${
    action.disabled
      ? "cursor-not-allowed text-[#5f584d] opacity-55"
      : isRoomEndTurnEffectAction
        ? "text-[#ffd59a] underline decoration-[#f59e0b] decoration-2 underline-offset-4 hover:text-[#ffe6b8]"
        : isRecommended
          ? "text-[#f6ffc4] underline decoration-[#f2cc79] decoration-2 underline-offset-4 hover:text-[#fbffd2]"
          : "text-[#ead8a8] hover:text-[#fff0ba]"
  }`;
}

function resolveMobileActionButtonClassName({
  action,
  isHauntPrimaryButton,
  isHauntTargetCancelButton,
  isHauntTargetingMode,
  isInventoryUseConfirmation,
  isPhoneLandscapeLayout,
  isRecommended,
  isRoomEndTurnEffectAction,
}: {
  action: ActionBarAction;
  isHauntPrimaryButton: boolean;
  isHauntTargetCancelButton: boolean;
  isHauntTargetingMode: boolean;
  isInventoryUseConfirmation: boolean;
  isPhoneLandscapeLayout: boolean;
  isRecommended: boolean;
  isRoomEndTurnEffectAction: boolean;
}) {
  if (isInventoryUseConfirmation) {
    return "min-w-[132px] px-5 text-[14px] shadow-[0_10px_22px_rgba(0,0,0,0.34)]";
  }

  return `flex flex-col items-center justify-center transition ${
    isPhoneLandscapeLayout && isHauntTargetingMode
      ? isHauntTargetCancelButton
        ? "absolute"
        : isHauntPrimaryButton
          ? "absolute"
          : ""
      : ""
  } ${
    isPhoneLandscapeLayout
      ? "min-h-[56px] gap-0.5 rounded-[5px] border-0 bg-transparent px-1 py-1 text-[11px] font-bold uppercase tracking-[0.08em] shadow-none"
      : "min-h-[54px] gap-1 rounded-[14px] border px-1.5 py-1.5 text-[10px] font-medium"
  } ${
    action.disabled
      ? isPhoneLandscapeLayout
        ? "cursor-not-allowed text-[#5f584d] opacity-55"
        : "cursor-not-allowed border-[#3e3526] bg-[rgba(22,17,13,0.72)] text-[#6f6758]"
      : isRoomEndTurnEffectAction
        ? isPhoneLandscapeLayout
          ? "text-[#ffd59a] underline decoration-[#f59e0b] decoration-2 underline-offset-4 hover:text-[#ffe6b8]"
          : "border-[#b66b36] bg-[rgba(105,45,18,0.34)] text-[#ffd59a]"
        : isRecommended
          ? isPhoneLandscapeLayout
            ? "text-[#f6ffc4] underline decoration-[#f2cc79] decoration-2 underline-offset-4 hover:text-[#fbffd2]"
            : "border-[#c9a35e] bg-[rgba(201,163,94,0.16)] text-[#f3e0b4]"
          : isPhoneLandscapeLayout
            ? "text-[#ead8a8] hover:text-[#fff0ba]"
            : "border-[#5c4d35] bg-[rgba(30,22,17,0.88)] text-[#d8ccb0]"
  }`;
}

function resolveBetrayalActionButtonStyle({
  action,
  isHauntPrimaryButton,
  isHauntTargetCancelButton,
  isHauntTargetingMode,
  isInventoryUseConfirmation,
  isPhoneLandscapeLayout,
  isRecommended,
  isRoomEndTurnEffectAction,
  variant,
}: {
  action: ActionBarAction;
  isHauntPrimaryButton: boolean;
  isHauntTargetCancelButton: boolean;
  isHauntTargetingMode: boolean;
  isInventoryUseConfirmation: boolean;
  isPhoneLandscapeLayout: boolean;
  isRecommended: boolean;
  isRoomEndTurnEffectAction: boolean;
  variant: BetrayalActionDockSurfaceProps["variant"];
}): React.CSSProperties | undefined {
  if (isInventoryUseConfirmation) {
    return undefined;
  }

  const textShadow = action.disabled
    ? "none"
    : isRoomEndTurnEffectAction
      ? "0 1px 2px rgba(0,0,0,0.9), 0 0 16px rgba(245,158,11,0.52)"
      : isRecommended
        ? "0 1px 2px rgba(0,0,0,0.9), 0 0 14px rgba(238,244,168,0.48)"
        : "0 1px 2px rgba(0,0,0,0.88), 0 0 8px rgba(234,216,168,0.28)";

  if (variant === "desktop") {
    return {
      backgroundColor: "transparent",
      backgroundImage: "none",
      border: 0,
      boxShadow: "none",
      textShadow,
      ...(isHauntTargetCancelButton && isHauntTargetingMode
        ? {
            bottom: 0,
            left: "50%",
            position: "absolute",
            transform: "translateX(208px)",
          }
        : {}),
    };
  }

  return {
    ...(isPhoneLandscapeLayout
      ? {
          backgroundColor: "transparent",
          backgroundImage: "none",
          border: 0,
          boxShadow: "none",
          textShadow,
        }
      : {}),
    ...(isPhoneLandscapeLayout &&
    isHauntTargetingMode &&
    isHauntTargetCancelButton
      ? {
          bottom: 0,
          left: "50%",
          position: "absolute",
          transform: "translateX(184px)",
        }
      : {}),
    ...(isPhoneLandscapeLayout && isHauntTargetingMode && isHauntPrimaryButton
      ? {
          bottom: 0,
          left: "50%",
          position: "absolute",
          transform: "translateX(-50%)",
        }
      : {}),
  };
}

export function BetrayalActionDockSurface({
  actions,
  variant,
  phase,
  recommendedAction,
  interactionMode,
  hauntActionKind,
  hauntTargetingActionKind,
  hasActiveHauntTargetGuide,
  hasSelectedInventoryCard,
  hasRoomEndTurnEffect,
  isBloodFromStoneSetupPlacementMode,
  isDustSicknessExchangeMode,
  isHauntTargetingMode,
  isPhoneLandscapeLayout,
  hideTradeAction,
  actionCueText,
  actionHandlers,
}: BetrayalActionDockSurfaceProps) {
  return (
    <>
      {actions.map((action) => {
        if (action.id === "trade" && hideTradeAction) {
          return null;
        }

        const Icon = ACTION_ICON_BY_ID[action.id] ?? Compass;
        const {
          hauntPrimaryActionKind,
          hauntPrimaryActionMode,
          isHauntPrimaryButton,
          isHauntTargetCancelButton,
          isInventoryUseConfirmation,
          isRecommended,
          isRoomEndTurnEffectAction,
        } = resolveBetrayalActionButtonState({
          action,
          phase,
          recommendedAction,
          interactionMode,
          hauntActionKind,
          hauntTargetingActionKind,
          hasActiveHauntTargetGuide,
          hasSelectedInventoryCard,
          hasRoomEndTurnEffect,
          isBloodFromStoneSetupPlacementMode,
          isDustSicknessExchangeMode,
        });
        const className =
          variant === "desktop"
            ? resolveDesktopActionButtonClassName({
                action,
                isHauntTargetCancelButton,
                isHauntTargetingMode,
                isInventoryUseConfirmation,
                isRecommended,
                isRoomEndTurnEffectAction,
              })
            : resolveMobileActionButtonClassName({
                action,
                isHauntPrimaryButton,
                isHauntTargetCancelButton,
                isHauntTargetingMode,
                isInventoryUseConfirmation,
                isPhoneLandscapeLayout,
                isRecommended,
                isRoomEndTurnEffectAction,
              });
        const style = resolveBetrayalActionButtonStyle({
          action,
          isHauntPrimaryButton,
          isHauntTargetCancelButton,
          isHauntTargetingMode,
          isInventoryUseConfirmation,
          isPhoneLandscapeLayout,
          isRecommended,
          isRoomEndTurnEffectAction,
          variant,
        });
        const testId = isHauntTargetCancelButton
          ? "betrayal-haunt-target-cancel"
          : variant === "desktop"
            ? `betrayal-action-${action.id}`
            : `betrayal-mobile-dock-${action.id}`;
        const key = variant === "desktop" ? action.id : `mobile-dock-${action.id}`;
        const clickHandler = actionHandlers[action.id];
        const title =
          action.disabled && action.description
            ? action.description
            : actionCueText;
        const commonButtonProps = {
          type: "button" as const,
          disabled: action.disabled,
          "data-testid": testId,
          "data-tutorial-id": `betrayal-action-${action.id}`,
          "data-haunt-primary-action-mode": hauntPrimaryActionMode,
          "data-haunt-primary-action-kind": hauntPrimaryActionKind,
          "data-haunt-targeting-status":
            isHauntTargetCancelButton ||
            (isHauntPrimaryButton && hasActiveHauntTargetGuide)
              ? "true"
              : undefined,
          "data-action-disabled-reason":
            action.disabled && action.description
              ? action.description
              : undefined,
          title,
          className,
          style,
        };
        const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
          if (variant === "desktop") {
            event.stopPropagation();
          }
          clickHandler?.();
        };
        const content = (
          <>
            <Icon
              size={variant === "desktop" ? 20 : isPhoneLandscapeLayout ? 18 : 14}
              strokeWidth={
                variant === "mobile" && isPhoneLandscapeLayout ? 2.35 : undefined
              }
            />
            <span>{action.label}</span>
          </>
        );

        if (isInventoryUseConfirmation) {
          return (
            <BetrayalConfirmButton
              key={key}
              {...commonButtonProps}
              onClick={onClick}
            >
              {content}
            </BetrayalConfirmButton>
          );
        }

        return (
          <button
            key={key}
            {...(variant === "desktop"
              ? {
                  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) =>
                    event.stopPropagation(),
                  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) =>
                    event.stopPropagation(),
                }
              : {})}
            {...commonButtonProps}
            onClick={onClick}
          >
            {content}
          </button>
        );
      })}
    </>
  );
}
