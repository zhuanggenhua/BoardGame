import React from "react";
import { useTranslation } from "react-i18next";

import type { ActionBarAction } from "../../core/ui/types";
import { BetrayalActionDockSurface } from "./actionDockSurface";
import {
  BetrayalHelpingHandsRewardActionsSurface,
  BetrayalHelpingHandsTrollAttackActionsSurface,
  BetrayalMummyRewardActionsSurface,
  type BetrayalAttackRewardCardSummary,
} from "./attackRewardActionSurface";
import type { BetrayalCore } from "./game";
import type { BetrayalHelpingHandsTrollHandAttackOption } from "./hauntAttackRewardReadModel";
import type { PreviewState } from "./previewStateModel";
import { BetrayalMobileScenarioReferenceButton } from "./referenceQuickActionsSurface";
import {
  BetrayalMobileSicknessExchangePanelSurface,
  BetrayalMobileTradeAgreementPanelSurface,
  BetrayalMobileTradeRequestPanelSurface,
} from "./tradeCardSelectorSurface";

type BetrayalMobileActionRailRewardState = {
  isChooser: boolean;
  damage: number;
  stealableCards: readonly BetrayalAttackRewardCardSummary[];
};

type BetrayalMobileActionRailTrollAttackState = {
  attackOptions: readonly BetrayalHelpingHandsTrollHandAttackOption[];
  attackTargetsByOptionId: ReadonlyMap<string, { playerId: string }>;
  trollHandIds: readonly string[];
};

type BetrayalMobileActionRailProps = {
  hasActiveHauntTargetGuide: boolean;
  isTradeDraftActive: boolean;
  hasPendingSicknessExchange: boolean;
  hasPendingTradeAgreement: boolean;
  isDustSicknessExchangeMode: boolean;
  shouldShowInlineTradeConfirm: boolean;
  isEndgameExorciseRollReview: boolean;
  isPhoneLandscapeLayout: boolean;
  pendingEventFocusesMapTarget: boolean;
  shouldHideTableChromeForBlockingOverlay: boolean;
  selectedInventoryDisplayText: string;
  useStatusText: string;
  selectedCardUseDisabled: boolean;
  shouldShowBoardActionStatus: boolean;
  shouldShowMobileTradeStatus: boolean;
  hasSelectedTradeTarget: boolean;
  tradeStatusText: string;
  actionCueText: string;
  visibleDustProgressItems: readonly { label: string; value: React.ReactNode }[];
  activeHauntCaseLabel: string;
  activeHauntTitle: string;
  tradeInstructionText: string;
  tradeFlowTargetStepText: string;
  mummyReward: BetrayalMobileActionRailRewardState | null;
  helpingHandsReward: BetrayalMobileActionRailRewardState | null;
  isPendingSicknessForViewer: boolean;
  isPendingTradeForViewer: boolean;
  helpingHandsTrollAttack: BetrayalMobileActionRailTrollAttackState | null;
  scenarioReferenceAccessibleLabel: string;
  scenarioReferenceButtonLabel: string;
  visibleActionItems: ActionBarAction[];
  phase: BetrayalCore["phase"];
  recommendedAction: ActionBarAction["id"] | null | undefined;
  interactionMode: PreviewState["interactionMode"];
  hauntActionKind: string | null | undefined;
  hauntTargetingActionKind: string | null | undefined;
  hasSelectedInventoryCard: boolean;
  hasRoomEndTurnEffect: boolean;
  isBloodFromStoneSetupPlacementMode: boolean;
  isHauntTargetingMode: boolean;
  actionHandlers: Partial<Record<ActionBarAction["id"], () => void>>;
  onTradeAction: () => void;
  onResolveMummyDamage: () => void;
  onStealMummyCard: (cardId: string) => void;
  onResolveHelpingHandsDamage: () => void;
  onStealHelpingHandsCard: (cardId: string) => void;
  onAcceptSicknessExchange: () => void;
  onDeclineSicknessExchange: () => void;
  onAcceptTradeAgreement: () => void;
  onDeclineTradeAgreement: () => void;
  onHelpingHandsTrollHandAttack: (
    option: BetrayalHelpingHandsTrollHandAttackOption,
    targetPlayerId: string,
  ) => void;
  onOpenScenarioReference: () => void;
  onJumpInventory: () => void;
  onJumpDecks: () => void;
};

type BetrayalActionDockInteractionMode = React.ComponentProps<
  typeof BetrayalActionDockSurface
>["interactionMode"];

function resolveActionDockInteractionMode(
  interactionMode: PreviewState["interactionMode"],
): BetrayalActionDockInteractionMode {
  switch (interactionMode) {
    case "move":
    case "helpingHandsTrollMove":
    case "monsterMove":
    case "monsterAttack":
    case "bloodFromStoneSetupPlacement":
      return interactionMode;
    default:
      return null;
  }
}

export function BetrayalMobileActionRailSurface({
  hasActiveHauntTargetGuide,
  isTradeDraftActive,
  hasPendingSicknessExchange,
  hasPendingTradeAgreement,
  isDustSicknessExchangeMode,
  shouldShowInlineTradeConfirm,
  isEndgameExorciseRollReview,
  isPhoneLandscapeLayout,
  pendingEventFocusesMapTarget,
  shouldHideTableChromeForBlockingOverlay,
  selectedInventoryDisplayText,
  useStatusText,
  selectedCardUseDisabled,
  shouldShowBoardActionStatus,
  shouldShowMobileTradeStatus,
  hasSelectedTradeTarget,
  tradeStatusText,
  actionCueText,
  visibleDustProgressItems,
  activeHauntCaseLabel,
  activeHauntTitle,
  tradeInstructionText,
  tradeFlowTargetStepText,
  mummyReward,
  helpingHandsReward,
  isPendingSicknessForViewer,
  isPendingTradeForViewer,
  helpingHandsTrollAttack,
  scenarioReferenceAccessibleLabel,
  scenarioReferenceButtonLabel,
  visibleActionItems,
  phase,
  recommendedAction,
  interactionMode,
  hauntActionKind,
  hauntTargetingActionKind,
  hasSelectedInventoryCard,
  hasRoomEndTurnEffect,
  isBloodFromStoneSetupPlacementMode,
  isHauntTargetingMode,
  actionHandlers,
  onTradeAction,
  onResolveMummyDamage,
  onStealMummyCard,
  onResolveHelpingHandsDamage,
  onStealHelpingHandsCard,
  onAcceptSicknessExchange,
  onDeclineSicknessExchange,
  onAcceptTradeAgreement,
  onDeclineTradeAgreement,
  onHelpingHandsTrollHandAttack,
  onOpenScenarioReference,
  onJumpInventory,
  onJumpDecks,
}: BetrayalMobileActionRailProps) {
  const { t } = useTranslation("game-betrayal");
  const shouldHideMobileRail = Boolean(
    (!hasActiveHauntTargetGuide &&
      isTradeDraftActive &&
      !hasPendingTradeAgreement &&
      !hasPendingSicknessExchange &&
      !mummyReward &&
      !helpingHandsReward &&
      !isDustSicknessExchangeMode &&
      !shouldShowInlineTradeConfirm) ||
      isEndgameExorciseRollReview ||
      (isPhoneLandscapeLayout && pendingEventFocusesMapTarget) ||
      shouldHideTableChromeForBlockingOverlay,
  );

  if (shouldHideMobileRail) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${
        isPhoneLandscapeLayout ? "block" : "md:hidden"
      } ${
        isPhoneLandscapeLayout
          ? "px-1.5 pb-[calc(var(--safe-area-bottom)+0.2rem)]"
          : "px-3 pb-[calc(var(--safe-area-bottom)+0.75rem)]"
      }`}
    >
      <div
        data-testid="betrayal-mobile-action-rail"
        data-mobile-role={isPhoneLandscapeLayout ? "native-action-rail" : undefined}
        className={`pointer-events-auto ${
          isPhoneLandscapeLayout
            ? "min-h-[56px] border-0 bg-transparent p-0 shadow-none"
            : "rounded-[18px] border border-[#5f4d31] bg-[rgba(14,20,18,0.92)] p-2 shadow-[0_16px_32px_rgba(0,0,0,0.34)] backdrop-blur-sm"
        }`}
        style={isPhoneLandscapeLayout ? { minHeight: 56 } : undefined}
      >
        <div
          className={`${isPhoneLandscapeLayout ? "grid grid-cols-1 items-stretch gap-1.5" : "mb-2 flex items-center gap-2"}`}
        >
          {isPhoneLandscapeLayout ? (
            <div className="sr-only" data-testid="betrayal-mobile-a11y-status">
              <span data-testid="betrayal-mobile-selected-card">
                {selectedInventoryDisplayText}
              </span>
              <span data-testid="betrayal-mobile-use-status">
                {useStatusText}
              </span>
              {shouldShowBoardActionStatus && shouldShowMobileTradeStatus ? (
                <span data-testid="betrayal-mobile-trade-status">
                  {tradeStatusText}
                </span>
              ) : null}
              {shouldShowBoardActionStatus ? (
                <span data-testid="betrayal-mobile-action-cue">
                  {actionCueText}
                </span>
              ) : null}
              {visibleDustProgressItems.length > 0 ? (
                <span data-testid="betrayal-mobile-dust-progress-status">
                  {activeHauntCaseLabel} {activeHauntTitle}{" "}
                  {visibleDustProgressItems
                    .map((item) => `${item.label} ${item.value}`)
                    .join(" ")}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="min-w-0 flex-1 rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#a89d84]">
                {t("board.mobile.selectedLabel")}
              </div>
              <div
                className="truncate text-sm font-medium text-[#f3ead6]"
                data-testid="betrayal-mobile-selected-card"
              >
                {selectedInventoryDisplayText}
              </div>
              <div
                className={`mt-1 truncate text-[11px] ${selectedCardUseDisabled ? "text-[#f0c1a2]" : "text-[#8db29a]"}`}
                data-testid="betrayal-mobile-use-status"
              >
                {useStatusText}
              </div>
              {shouldShowBoardActionStatus && shouldShowMobileTradeStatus ? (
                <div
                  className={`mt-1 truncate text-[11px] ${
                    hasPendingTradeAgreement ||
                    hasPendingSicknessExchange ||
                    mummyReward ||
                    isDustSicknessExchangeMode ||
                    hasSelectedTradeTarget
                      ? "text-[#8db29a]"
                      : "text-[#b8ae98]"
                  }`}
                  data-testid="betrayal-mobile-trade-status"
                >
                  {tradeStatusText}
                </div>
              ) : null}
              {shouldShowInlineTradeConfirm ? (
                <BetrayalMobileTradeRequestPanelSurface
                  instructionText={tradeInstructionText}
                  targetStepText={tradeFlowTargetStepText}
                  requestLabel={t("board.status.tradeFlowRequest")}
                  onRequest={onTradeAction}
                />
              ) : mummyReward?.isChooser ? (
                <BetrayalMummyRewardActionsSurface
                  variant="mobile"
                  damage={mummyReward.damage}
                  stealableCards={mummyReward.stealableCards}
                  onResolveDamage={onResolveMummyDamage}
                  onStealCard={onStealMummyCard}
                />
              ) : helpingHandsReward?.isChooser ? (
                <BetrayalHelpingHandsRewardActionsSurface
                  variant="mobile"
                  damage={helpingHandsReward.damage}
                  stealableCards={helpingHandsReward.stealableCards}
                  onResolveDamage={onResolveHelpingHandsDamage}
                  onStealCard={onStealHelpingHandsCard}
                />
              ) : hasPendingSicknessExchange ? (
                <BetrayalMobileSicknessExchangePanelSurface
                  isPendingForViewer={isPendingSicknessForViewer}
                  acceptLabel={t("board.status.sicknessExchangeAccept")}
                  declineLabel={t("board.status.sicknessExchangeDecline")}
                  waitingLabel={t("board.status.tradeStepAgree")}
                  onAccept={onAcceptSicknessExchange}
                  onDecline={onDeclineSicknessExchange}
                />
              ) : hasPendingTradeAgreement ? (
                <BetrayalMobileTradeAgreementPanelSurface
                  instructionText={tradeInstructionText}
                  targetStepText={tradeFlowTargetStepText}
                  isPendingForViewer={isPendingTradeForViewer}
                  acceptLabel={t("board.status.tradeAgreementAccept")}
                  declineLabel={t("board.status.tradeAgreementDecline")}
                  waitingLabel={t("board.status.tradeStepAgree")}
                  onAccept={onAcceptTradeAgreement}
                  onDecline={onDeclineTradeAgreement}
                />
              ) : helpingHandsTrollAttack &&
                helpingHandsTrollAttack.attackOptions.length > 0 ? (
                <BetrayalHelpingHandsTrollAttackActionsSurface
                  variant="mobile"
                  attackOptions={helpingHandsTrollAttack.attackOptions}
                  attackTargetsByOptionId={
                    helpingHandsTrollAttack.attackTargetsByOptionId
                  }
                  trollHandIds={helpingHandsTrollAttack.trollHandIds}
                  onAttack={onHelpingHandsTrollHandAttack}
                />
              ) : null}
              {shouldShowBoardActionStatus ? (
                <div className="sr-only" data-testid="betrayal-mobile-action-cue">
                  {actionCueText}
                </div>
              ) : null}
            </div>
          )}
          <BetrayalMobileScenarioReferenceButton
            isVisible={
              isPhoneLandscapeLayout &&
              !hasPendingSicknessExchange &&
              !mummyReward &&
              !helpingHandsReward &&
              !isDustSicknessExchangeMode &&
              !pendingEventFocusesMapTarget
            }
            isDimmed={hasActiveHauntTargetGuide}
            scenarioReferenceAccessibleLabel={scenarioReferenceAccessibleLabel}
            scenarioReferenceButtonLabel={scenarioReferenceButtonLabel}
            onOpenScenarioReference={onOpenScenarioReference}
          />
          <button
            type="button"
            onClick={onJumpInventory}
            data-testid="betrayal-mobile-jump-inventory"
            className={`${isPhoneLandscapeLayout ? "hidden" : ""} shrink-0 rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2 text-xs font-medium text-[#dbcfae]`}
          >
            {t("board.sections.inventory")}
          </button>
          <button
            type="button"
            onClick={onJumpDecks}
            data-testid="betrayal-mobile-jump-decks"
            className={`${isPhoneLandscapeLayout ? "hidden" : ""} shrink-0 rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2 text-xs font-medium text-[#dbcfae]`}
          >
            {t("board.sections.decks")}
          </button>
          <div
            className={
              isHauntTargetingMode && isPhoneLandscapeLayout
                ? "relative min-h-[56px] min-w-0"
                : `grid min-w-0 ${
                    isPhoneLandscapeLayout ? "grid-cols-5" : "flex-1 grid-cols-5"
                  } ${isPhoneLandscapeLayout ? "min-h-[56px] items-stretch gap-3" : "gap-2"}`
            }
          >
            <BetrayalActionDockSurface
              actions={visibleActionItems}
              variant="mobile"
              phase={phase}
              recommendedAction={recommendedAction}
              interactionMode={resolveActionDockInteractionMode(interactionMode)}
              hauntActionKind={hauntActionKind}
              hauntTargetingActionKind={hauntTargetingActionKind}
              hasActiveHauntTargetGuide={hasActiveHauntTargetGuide}
              hasSelectedInventoryCard={hasSelectedInventoryCard}
              hasRoomEndTurnEffect={hasRoomEndTurnEffect}
              isBloodFromStoneSetupPlacementMode={
                isBloodFromStoneSetupPlacementMode
              }
              isDustSicknessExchangeMode={isDustSicknessExchangeMode}
              isHauntTargetingMode={isHauntTargetingMode}
              isPhoneLandscapeLayout={isPhoneLandscapeLayout}
              hideTradeAction={shouldShowInlineTradeConfirm}
              actionCueText={actionCueText}
              actionHandlers={actionHandlers}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
