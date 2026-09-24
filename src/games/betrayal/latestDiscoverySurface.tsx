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
  eventRollReadable?: boolean;
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
  animateRerollMotion: boolean;
  rerollSelection: RecentRollRerollSelection | null;
  canModifyRoll: boolean;
  rollActorLabel: string;
  rollModifierActionSlot: React.ReactNode;
  pendingEventRollRequiresNoAcknowledgement: boolean;
  hasPendingEventRollStart: boolean;
  canStartPendingEventRoll: boolean;
  continueButton: BetrayalLatestDiscoveryContinueButtonState;
  effectiveLocale: string;
  canDismissByBackdrop: boolean;
  isPossessionGainTransitionActive: boolean;
  onDismiss: () => void;
  onRollLatestDiscoveryEvent: () => void;
  onContinue: () => void;
  onDiceSettledChange: (rollId: string, settled: boolean) => void;
};

export function resolveDisplayedDiscoveryDetail(
  discovery: BetrayalDiscoverySummary,
  resolutionSteps: readonly BetrayalDiscoveryResolutionStep[],
): string {
  const roomResolutionTexts = resolutionSteps
    .filter(
      (step) =>
        step.kind === "room-effect" ||
        step.kind === "room-discovery-card" ||
        step.kind === "buried-room-discovery-card",
    )
    .map((step) => step.text)
    .filter(Boolean);
  const detail = roomResolutionTexts.reduce(
    (currentDetail, roomResolutionText) =>
      currentDetail.replace(roomResolutionText, ""),
    discovery.detail,
  )
    .replace(
      /((?:抽到预兆后进行|选择进行|进行)?\s*作祟检定\s*[:：]\s*)总点数\s*[-+]?\d+\s*[（(]\s*(\d+)\s*颗骰子[^）)]*[）)]/g,
      "$1投 $2 颗骰子",
    )
    .replace(
      /预兆牌堆耗尽，自动触发作祟/g,
      "",
    )
    .replace(
      /(?:力量|速度|知识|神志)检定(?:\s*[-+]?\d+)?\s*[:：]\s*/g,
      "",
    )
    .replace(
      /(投\s*\d+\s*颗骰子)\s*[-+]?\d+\s*[:：]\s*/g,
      "$1：",
    );
  return detail
    .replace(/[；;]\s*[；;]/g, "；")
    .replace(/^[；;]\s*|[；;]\s*$/g, "")
    .trim();
}

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
  animateRerollMotion,
  rerollSelection,
  canModifyRoll,
  rollActorLabel,
  rollModifierActionSlot,
  pendingEventRollRequiresNoAcknowledgement,
  hasPendingEventRollStart,
  canStartPendingEventRoll,
  continueButton,
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
  const shouldHideExternalActionDock = Boolean(
    pendingEventRollRequiresNoAcknowledgement ||
      hasRollModifierActionSlot,
  );
  const displayedDiscoveryDetail = resolveDisplayedDiscoveryDetail(
    discovery,
    resolutionSteps,
  )
    .replace(/[；;]\s*没有事件、物品或预兆发现牌[。.]?\s*$/, "")
    .replace(/^没有事件、物品或预兆发现牌[。.]?\s*$/, "")
    .trim();

  return (
    <div
      data-testid="betrayal-discovery-panel"
      data-card-testid="betrayal-discovery-card-reveal"
      data-tutorial-id="betrayal-latest-discovery"
      aria-label={`${displayedKindLabel} ${displayedTitle}`}
      data-allows-inventory-roll-modifiers={canModifyRoll ? "true" : "false"}
      data-backdrop-dismiss={canDismissByBackdrop ? "enabled" : "disabled"}
      onClick={canDismissByBackdrop ? onDismiss : undefined}
      className={`${canDismissByBackdrop ? "pointer-events-auto" : "pointer-events-none"} absolute inset-0 z-[120] flex cursor-default items-center justify-center px-4 py-16 ${
        shouldShowRoll && recentRoll ? "" : "bg-[rgba(3,7,6,0.76)]"
      }`}
    >
      {panelVisual ? null : (
        <div
          data-testid="betrayal-discovery-top-banner"
          data-prompt-placement="top"
          className="pointer-events-none absolute left-4 right-4 top-4 z-30 flex min-h-[76px] flex-wrap items-center justify-center gap-2.5 rounded-[11px] border border-[rgba(238,204,126,0.48)] bg-[rgba(18,17,13,0.88)] px-5 py-3 text-center text-[16px] font-bold tracking-[0.05em] text-[#f3e0a6] shadow-[0_20px_42px_rgba(0,0,0,0.38),0_0_30px_rgba(238,204,126,0.20)] backdrop-blur-sm"
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
              className="text-[24px] text-[#fff7c8]"
          >
            {displayedTitle}
          </span>
          <span
            data-testid="betrayal-discovery-top-banner-detail"
            className="basis-full text-[16px] leading-snug text-[#e8d7a5]"
          >
            {displaySummary}
          </span>
        </div>
      )}
      <div
        data-testid="betrayal-discovery-panel-content"
        onClick={(event) => event.stopPropagation()}
        className={`pointer-events-none flex flex-col items-center ${
          shouldShowRoll && recentRoll ? "w-full" : "w-fit"
        } ${
          shouldShowRoll && recentRoll
            ? "relative isolate justify-center gap-3 max-h-[calc(1080px-8rem)] bg-transparent"
            : "relative isolate justify-center gap-3 max-h-[calc(1080px-8rem)] rounded-[28px] bg-[radial-gradient(ellipse_at_center,rgba(4,12,10,0.86),rgba(4,12,10,0.62)_52%,rgba(4,12,10,0.46)_72%,rgba(4,12,10,0)_88%)]"
        }`}
      >
        <span className="sr-only" data-testid="betrayal-discovery-detail">
          {displayedKindLabel} {displayedTitle} {displaySummary}{" "}
          {displayedDiscoveryDetail}
        </span>
        {displayedDiscoveryDetail ? (
          <div
            data-testid="betrayal-discovery-visible-detail"
            data-ui-role="visible-effect-description"
            className="pointer-events-none z-10 max-w-[680px] rounded-[10px] border border-[rgba(214,181,109,0.42)] bg-[rgba(14,12,8,0.78)] px-4 py-2 text-center text-[16px] font-bold leading-snug tracking-[0.04em] text-[#f4e3b5] shadow-[0_10px_24px_rgba(0,0,0,0.30)]"
          >
            {displayedDiscoveryDetail}
          </div>
        ) : null}
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
            className="pointer-events-none z-10 max-w-[520px] rounded-[10px] border border-[rgba(214,181,109,0.42)] bg-[rgba(14,12,8,0.78)] px-4 py-2 text-center text-[13px] font-bold leading-snug tracking-[0.04em] text-[#f4e3b5] shadow-[0_10px_24px_rgba(0,0,0,0.30)]"
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
            className={`flex min-h-0 max-w-[920px] flex-row items-center justify-center gap-5 ${
              shouldShowRoll && recentRoll
                ? canModifyRoll
                  ? "w-full max-w-[900px]"
                  : "w-full max-w-[920px]"
                : canModifyRoll
                  ? "max-w-[780px]"
                  : "max-w-[900px]"
            }`}
          >
            {shouldShowCardFace ? (
              <div
                className={`relative shrink-0 transition-opacity duration-100 ${
                  isPossessionGainTransitionActive ? "opacity-0" : "opacity-100"
                } w-[300px]`}
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
                className="h-[380px] min-h-[332px] w-[560px] shrink-0"
                diceClassName="min-h-[236px]"
                animateRerollMotion={animateRerollMotion}
                rerollSelection={rerollSelection}
                deferEventDamageStage={false}
                effectiveLocale={effectiveLocale}
                actorLabel={rollActorLabel}
                showSource={false}
                showRollLabel
                showOutcome={recentRoll.kind === "eventRolledDamage"}
                openTable
                compactResult
                denseResult={false}
                denseResultPlacement="stacked"
                actionSlot={rollModifierActionSlot}
                floatingResultClassName=""
                onDiceSettledChange={onDiceSettledChange}
              />
            ) : null}
          </div>
        ) : null}
        {shouldHideExternalActionDock ? null : (
          <div
            data-testid="betrayal-discovery-card-external-action-dock"
            className="pointer-events-none relative mt-2 flex min-h-[62px] w-full justify-center"
          >
            {hasPendingEventRollStart ? (
              <button
                type="button"
                data-testid="betrayal-event-roll-start"
                className={`pointer-events-auto ${BETRAYAL_CONFIRM_BUTTON_CLASS}`}
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
                data-event-roll-readable={
                  typeof continueButton.eventRollReadable === "boolean"
                    ? String(continueButton.eventRollReadable)
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
