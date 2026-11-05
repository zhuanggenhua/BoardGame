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
import type { PreviewState } from "./previewStateModel";

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

type BetrayalActionDockSurfaceProps = {
  actions: ActionBarAction[];
  phase: BetrayalCore["phase"];
  recommendedAction: ActionBarAction["id"] | null | undefined;
  interactionMode: PreviewState["interactionMode"];
  hauntActionKind: string | null | undefined;
  hauntTargetingActionKind: string | null | undefined;
  hasActiveHauntTargetGuide: boolean;
  hasSelectedInventoryCard: boolean;
  hasRoomEndTurnEffect: boolean;
  isBloodFromStoneSetupPlacementMode: boolean;
  isDustSicknessExchangeMode: boolean;
  isHauntTargetingMode: boolean;
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

function resolveBetrayalActionButtonStyle({
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

export function BetrayalActionDockSurface({
  actions,
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
        const className = resolveDesktopActionButtonClassName({
          action,
          isHauntTargetCancelButton,
          isHauntTargetingMode,
          isInventoryUseConfirmation,
          isRecommended,
          isRoomEndTurnEffectAction,
        });
        const style = resolveBetrayalActionButtonStyle({
          action,
          isHauntTargetCancelButton,
          isHauntTargetingMode,
          isInventoryUseConfirmation,
          isRecommended,
          isRoomEndTurnEffectAction,
        });
        const testId = isHauntTargetCancelButton
          ? "betrayal-haunt-target-cancel"
          : `betrayal-action-${action.id}`;
        const key = action.id;
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
          event.stopPropagation();
          clickHandler?.();
        };
        const content = (
          <>
            <Icon size={20} />
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
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
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
