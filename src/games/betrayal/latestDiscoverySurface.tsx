import React from "react";
import { useTranslation } from "react-i18next";

import { DiscoveryAtlasFrame } from "./atlasFrameSurface";
import {
  BetrayalConfirmButton,
  BETRAYAL_CONFIRM_BUTTON_CLASS,
} from "./confirmButtonSurface";
import type { BetrayalDiscoveryAtlasVisual } from "./discoveryAtlas";
import type {
  BetrayalDiscoveryResolutionStep,
  BetrayalDiscoverySummary,
  BetrayalPendingCardResolutionProcessCard,
  BetrayalRecentRollState,
} from "./game";
import type { RecentRollRerollSelection } from "./houseDiceSurface";
import type { BetrayalPossessionAtlasVisual } from "./possessionAtlas";
import { RecentRollPanel } from "./recentRollSurface";

type BetrayalLatestDiscoveryContinueButtonState = {
  label: string;
  disabled: boolean;
  pendingCardResolutionId?: string;
  pendingCardResolutionStep?: string;
  cardResolutionConfirmedCount?: number;
  cardResolutionRequiredCount?: number;
  eventRollConfirmedCount?: number;
  eventRollRequiredCount?: number;
};

type BetrayalLatestDiscoverySurfaceProps = {
  visible: boolean;
  discovery: BetrayalDiscoverySummary | null;
  displayedKindLabel: string;
  displayedTitle: string;
  displaySummary: string;
  panelVisual: BetrayalDiscoveryAtlasVisual | BetrayalPossessionAtlasVisual | null;
  resolutionSteps: readonly BetrayalDiscoveryResolutionStep[];
  visibleProcessCard: BetrayalPendingCardResolutionProcessCard | null;
  searchStepNumber: number;
  searchSequenceLength: number;
  searchFinalEffectText: string;
  shouldShowCardFace: boolean;
  shouldShowRoll: boolean;
  recentRoll: BetrayalRecentRollState | null;
  rerollSelection: RecentRollRerollSelection | null;
  canModifyRoll: boolean;
  rollActorLabel: string;
  rollModifierActionSlot: React.ReactNode;
  pendingEventRollRequiresNoAcknowledgement: boolean;
  hasPendingEventRollStart: boolean;
  canStartPendingEventRoll: boolean;
  continueButton: BetrayalLatestDiscoveryContinueButtonState;
  isPhoneLandscapeLayout: boolean;
  shouldUseMobileEventOpenTableChrome: boolean;
  effectiveLocale: string;
  canDismissByBackdrop: boolean;
  isPossessionGainTransitionActive: boolean;
  onDismiss: () => void;
  onRollLatestDiscoveryEvent: () => void;
  onContinue: () => void;
  onDiceSettledChange: (rollId: string, settled: boolean) => void;
};

export function BetrayalLatestDiscoverySurface({
  visible,
  discovery,
  displayedKindLabel,
  displayedTitle,
  displaySummary,
  panelVisual,
  resolutionSteps,
  visibleProcessCard,
  searchStepNumber,
  searchSequenceLength,
  searchFinalEffectText,
  shouldShowCardFace,
  shouldShowRoll,
  recentRoll,
  rerollSelection,
  canModifyRoll,
  rollActorLabel,
  rollModifierActionSlot,
  pendingEventRollRequiresNoAcknowledgement,
  hasPendingEventRollStart,
  canStartPendingEventRoll,
  continueButton,
  isPhoneLandscapeLayout,
  shouldUseMobileEventOpenTableChrome,
  effectiveLocale,
  canDismissByBackdrop,
  isPossessionGainTransitionActive,
  onDismiss,
  onRollLatestDiscoveryEvent,
  onContinue,
  onDiceSettledChange,
}: BetrayalLatestDiscoverySurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  if (!visible || !discovery) {
    return null;
  }

  const hasRollModifierActionSlot = Boolean(rollModifierActionSlot);
  const shouldDockRollModifierInPhoneCorner = Boolean(
    isPhoneLandscapeLayout &&
      shouldShowRoll &&
      recentRoll &&
      hasRollModifierActionSlot,
  );
  const shouldHideExternalActionDock = Boolean(
    pendingEventRollRequiresNoAcknowledgement ||
      shouldDockRollModifierInPhoneCorner ||
      hasRollModifierActionSlot,
  );

  return (
    <div
      data-testid="betrayal-discovery-panel"
      data-card-testid="betrayal-discovery-card-reveal"
      data-tutorial-id="betrayal-latest-discovery"
      aria-label={`${displayedKindLabel} ${displayedTitle}`}
      data-allows-inventory-roll-modifiers={canModifyRoll ? "true" : "false"}
      data-backdrop-dismiss={canDismissByBackdrop ? "enabled" : "disabled"}
      onClick={canDismissByBackdrop ? onDismiss : undefined}
      className={`pointer-events-auto absolute flex cursor-default ${
        isPhoneLandscapeLayout
          ? shouldUseMobileEventOpenTableChrome
            ? "inset-0 z-50 items-start justify-end bg-transparent px-2 pb-[74px] pr-[8.25rem] pt-[92px]"
            : "inset-0 z-[120] items-center justify-center bg-[rgba(3,7,6,0.92)] px-3 pb-[76px] pt-[5.75rem]"
          : `inset-0 z-[120] items-center justify-center px-4 py-16 ${
              shouldShowRoll && recentRoll ? "" : "bg-[rgba(3,7,6,0.76)]"
            }`
      }`}
    >
      {panelVisual ? null : (
        <div
          data-testid="betrayal-discovery-top-banner"
          data-prompt-placement="top"
          className={`pointer-events-none absolute z-30 flex min-h-[76px] flex-wrap items-center justify-center gap-2.5 rounded-[11px] border border-[rgba(238,204,126,0.48)] bg-[rgba(18,17,13,0.88)] px-5 py-3 text-center font-bold tracking-[0.05em] text-[#f3e0a6] shadow-[0_20px_42px_rgba(0,0,0,0.38),0_0_30px_rgba(238,204,126,0.20)] backdrop-blur-sm ${
            isPhoneLandscapeLayout
              ? shouldUseMobileEventOpenTableChrome
                ? "left-2 right-[8.25rem] top-1 min-h-[58px] px-3 py-2 text-[12px]"
                : "left-3 right-3 top-2 min-h-[60px] px-3 py-2 text-[13px]"
              : "left-4 right-4 top-4 text-[16px]"
          }`}
          style={{
            textShadow:
              "0 1px 2px rgba(0,0,0,0.88), 0 0 14px rgba(238,204,126,0.34)",
          }}
        >
          <span className="rounded-[6px] border border-[rgba(238,204,126,0.26)] bg-[rgba(238,204,126,0.12)] px-2 py-1 text-[#fff1b8]">
            {t("board.discovery.label")}
          </span>
          <span className="text-[#d8c692]">{displayedKindLabel}</span>
          <span
            data-testid="betrayal-discovery-top-banner-title"
            className={`text-[#fff7c8] ${
              isPhoneLandscapeLayout ? "text-[17px]" : "text-[24px]"
            }`}
          >
            {displayedTitle}
          </span>
          <span
            data-testid="betrayal-discovery-top-banner-detail"
            className={`basis-full leading-snug text-[#e8d7a5] ${
              isPhoneLandscapeLayout ? "text-[13px]" : "text-[16px]"
            }`}
          >
            {displaySummary}
          </span>
        </div>
      )}
      <div
        data-testid="betrayal-discovery-panel-content"
        onClick={(event) => event.stopPropagation()}
        className={`flex flex-col items-center ${
          shouldShowRoll && recentRoll ? "w-full" : "w-fit"
        } ${
          isPhoneLandscapeLayout
            ? shouldUseMobileEventOpenTableChrome
              ? "relative justify-start gap-1.5 max-h-[calc(100vh-5.25rem)] w-[min(604px,calc(100vw-20.75rem))] max-w-[calc(100vw-20.75rem)] px-2 py-2"
              : "justify-center gap-3 max-h-[calc(100vh-4.5rem)] max-w-[calc(100vw-2rem)]"
            : shouldShowRoll && recentRoll
              ? "relative isolate justify-center gap-3 max-h-[calc(100vh-8rem)] bg-transparent"
              : "relative isolate justify-center gap-3 max-h-[calc(100vh-8rem)] rounded-[28px] bg-[radial-gradient(ellipse_at_center,rgba(4,12,10,0.86),rgba(4,12,10,0.62)_52%,rgba(4,12,10,0.46)_72%,rgba(4,12,10,0)_88%)]"
        }`}
      >
        {shouldDockRollModifierInPhoneCorner ? (
          <div className="pointer-events-auto absolute right-2 top-2 z-20">
            {rollModifierActionSlot}
          </div>
        ) : null}
        <span className="sr-only" data-testid="betrayal-discovery-detail">
          {displayedKindLabel} {displayedTitle} {displaySummary}{" "}
          {discovery.detail ?? ""}
        </span>
        {resolutionSteps.length > 0 ? (
          <ol
            hidden
            aria-hidden="true"
            data-testid="betrayal-discovery-resolution-steps"
            data-ui-role="nonvisual-resolution-ledger"
          >
            {resolutionSteps.map((step) => (
              <li
                key={step.id}
                data-testid="betrayal-discovery-resolution-step"
                data-resolution-step-kind={step.kind}
                data-resolution-step-deck-kind={step.deckKind ?? undefined}
                data-resolution-step-card-id={step.cardId ?? undefined}
              >
                {step.text}
              </li>
            ))}
          </ol>
        ) : null}
        {visibleProcessCard ? (
          <div
            data-testid="betrayal-discovery-search-step"
            data-room-discovery-search-index={String(searchStepNumber)}
            data-room-discovery-search-total={String(searchSequenceLength)}
            data-room-discovery-search-outcome={visibleProcessCard.outcome}
            className="pointer-events-none z-10 max-w-[min(520px,calc(100vw-2rem))] rounded-[10px] border border-[rgba(214,181,109,0.42)] bg-[rgba(14,12,8,0.78)] px-4 py-2 text-center text-[13px] font-bold leading-snug tracking-[0.04em] text-[#f4e3b5] shadow-[0_10px_24px_rgba(0,0,0,0.30)]"
          >
            {visibleProcessCard.text}
          </div>
        ) : null}
        {searchFinalEffectText ? (
          <div data-testid="betrayal-discovery-final-effect" className="sr-only">
            {searchFinalEffectText}
          </div>
        ) : null}
        {shouldShowCardFace || (shouldShowRoll && recentRoll) ? (
          <div
            data-testid="betrayal-discovery-panel-main"
            className={`flex min-h-0 items-center justify-center ${
              isPhoneLandscapeLayout && shouldShowRoll && recentRoll
                ? "h-[min(228px,calc(100vh-10.625rem))] w-full max-w-[calc(100vw-1rem)] flex-row gap-3"
                : `max-w-[calc(100vw-2rem)] flex-col gap-4 md:flex-row ${
                    shouldShowRoll && recentRoll
                      ? canModifyRoll
                        ? "w-full md:max-w-[900px] md:gap-5"
                        : "w-full md:max-w-[920px] md:gap-5"
                      : canModifyRoll
                        ? "md:max-w-[min(780px,calc(100vw-18rem))]"
                        : "md:max-w-[900px]"
                  }`
            }`}
          >
            {shouldShowCardFace ? (
              <div
                className={`relative shrink-0 transition-opacity duration-100 ${
                  isPossessionGainTransitionActive ? "opacity-0" : "opacity-100"
                } ${
                  isPhoneLandscapeLayout && shouldShowRoll && recentRoll
                    ? "w-[120px]"
                    : shouldShowRoll && recentRoll
                      ? "w-[min(300px,calc(100vw-2rem))] md:w-[300px]"
                      : "w-[min(300px,calc(100vw-2rem))] md:w-[300px]"
                }`}
              >
                {panelVisual ? (
                  <DiscoveryAtlasFrame
                    visual={panelVisual}
                    locale={effectiveLocale}
                    alt={displayedTitle}
                    testId="betrayal-discovery-card-front-atlas"
                  />
                ) : (
                  <div
                    data-testid="betrayal-discovery-card-front-missing"
                    className="flex aspect-[675/1275] flex-col items-center justify-center gap-2 rounded-[10px] border border-[rgba(211,179,109,0.28)] bg-[rgba(13,15,11,0.94)] px-4 text-center leading-tight text-[#d6c498]"
                  >
                    <span className="text-[11px] font-semibold tracking-[0.12em] text-[#9d8f66]">
                      {displayedKindLabel}
                    </span>
                    <span className="text-[18px] font-black text-[#eadbb0]">
                      {discovery.title}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
            {shouldShowRoll && recentRoll ? (
              <RecentRollPanel
                roll={recentRoll}
                className={
                  isPhoneLandscapeLayout
                    ? "h-full min-h-[208px] min-w-0 flex-1"
                    : "h-[min(46vh,380px)] min-h-[332px] w-[min(640px,calc(100vw-2rem))] shrink-0 md:w-[560px]"
                }
                diceClassName={
                  isPhoneLandscapeLayout ? "min-h-[164px]" : "min-h-[236px]"
                }
                rerollSelection={rerollSelection}
                deferEventDamageStage={false}
                effectiveLocale={effectiveLocale}
                actorLabel={rollActorLabel}
                showSource={false}
                showRollLabel={false}
                openTable
                compactResult
                denseResult={isPhoneLandscapeLayout}
                denseResultPlacement={
                  isPhoneLandscapeLayout ? "floatingSide" : "stacked"
                }
                actionSlot={rollModifierActionSlot}
                floatingResultClassName={isPhoneLandscapeLayout ? "top-[52px]" : ""}
                onDiceSettledChange={onDiceSettledChange}
              />
            ) : null}
          </div>
        ) : null}
        {shouldHideExternalActionDock ? null : (
          <div
            data-testid="betrayal-discovery-card-external-action-dock"
            className={`pointer-events-auto z-10 flex min-h-[62px] justify-center ${
              isPhoneLandscapeLayout ? "relative w-full" : "relative mt-2 w-full"
            }`}
          >
            {hasPendingEventRollStart ? (
              <button
                type="button"
                data-testid="betrayal-event-roll-start"
                className={BETRAYAL_CONFIRM_BUTTON_CLASS}
                disabled={!canStartPendingEventRoll}
                onClick={onRollLatestDiscoveryEvent}
              >
                {t("board.discovery.rollEvent")}
              </button>
            ) : (
              <BetrayalConfirmButton
                type="button"
                data-testid="betrayal-discovery-continue"
                data-discovery-action-position="bottom"
                data-discovery-action-surface="card-external-dock"
                data-pending-card-resolution-id={
                  continueButton.pendingCardResolutionId
                }
                data-pending-card-resolution-step={
                  continueButton.pendingCardResolutionStep
                }
                data-card-resolution-confirmed-count={
                  typeof continueButton.cardResolutionConfirmedCount === "number"
                    ? String(continueButton.cardResolutionConfirmedCount)
                    : undefined
                }
                data-card-resolution-required-count={
                  typeof continueButton.cardResolutionRequiredCount === "number"
                    ? String(continueButton.cardResolutionRequiredCount)
                    : undefined
                }
                data-event-roll-confirmed-count={
                  typeof continueButton.eventRollConfirmedCount === "number"
                    ? String(continueButton.eventRollConfirmedCount)
                    : undefined
                }
                data-event-roll-required-count={
                  typeof continueButton.eventRollRequiredCount === "number"
                    ? String(continueButton.eventRollRequiredCount)
                    : undefined
                }
                disabled={continueButton.disabled}
                className={`pointer-events-auto min-w-[132px] shrink-0 ${BETRAYAL_CONFIRM_BUTTON_CLASS}`}
                onClick={onContinue}
              >
                {continueButton.label}
              </BetrayalConfirmButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
