import React from "react";
import { useTranslation } from "react-i18next";
import { HudPortal, UI_Z_INDEX } from "../../core";
import type { DiceBoxStyleProfile } from "../../lib/dice-box-threejs/engine";
import type { BetrayalRecentRollState } from "./game";
import {
  BETRAYAL_HOUSE_DICE_MOBILE_STYLE_PROFILE,
  BETRAYAL_HOUSE_DICE_STYLE_PROFILE,
} from "./houseDicePresentation";
import {
  BetrayalHouseDice3DGroup,
  type RecentRollRerollSelection,
} from "./houseDiceSurface";
import { resolveRecentRollTotal } from "./recentRollPresentation";

export function RecentRollPanel({
  roll,
  className = "",
  diceClassName,
  animateInitialRoll = true,
  rerollSelection = null,
  effectiveLocale = "zh-CN",
  showSource = true,
  showOutcome = true,
  showRollLabel = true,
  showBreakdown = true,
  openTable = false,
  compactResult = false,
  denseResult = false,
  denseResultPlacement = "stacked",
  deferEventDamageStage = false,
  diceStyleProfile = BETRAYAL_HOUSE_DICE_STYLE_PROFILE,
  diceVisualScale = 1,
  landscapeResultDock = false,
  floatingResultClassName = "",
  openTableResultDocked = false,
  resultStageClassName = "",
  compactRowsClassName = "",
  actorLabel = null,
  actionSlot = null,
  onDiceSettledChange,
}: {
  roll: BetrayalRecentRollState;
  className?: string;
  diceClassName?: string;
  animateInitialRoll?: boolean;
  rerollSelection?: RecentRollRerollSelection | null;
  effectiveLocale?: string;
  showSource?: boolean;
  showOutcome?: boolean;
  showRollLabel?: boolean;
  showBreakdown?: boolean;
  openTable?: boolean;
  compactResult?: boolean;
  denseResult?: boolean;
  denseResultPlacement?: "stacked" | "floatingSide";
  deferEventDamageStage?: boolean;
  diceStyleProfile?: DiceBoxStyleProfile;
  diceVisualScale?: number;
  landscapeResultDock?: boolean;
  floatingResultClassName?: string;
  openTableResultDocked?: boolean;
  resultStageClassName?: string;
  compactRowsClassName?: string;
  actorLabel?: string | null;
  actionSlot?: React.ReactNode;
  onDiceSettledChange?: (rollId: string, settled: boolean) => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const diceSubtotal = roll.dice.reduce((sum, value) => sum + value, 0);
  const baseRollTotal = resolveRecentRollTotal(roll);
  const attackComparisonText = roll.attack
    ? t(
        (roll.attack.defenderDefenseExtraDice ?? 0) > 0
          ? "board.roll.attackComparisonWithExtraDice"
          : "board.roll.attackComparison",
        {
          attacker: baseRollTotal,
          defender: roll.attack.defenderRoll,
          extraDice: roll.attack.defenderDefenseExtraDice ?? 0,
        },
      )
    : null;
  const eventDamageResults =
    roll.kind === "eventRolledDamage"
      ? roll.eventRolledDamageResults ?? []
      : roll.eventEffectSnapshot?.rolledDamageResults ?? [];
  const eventDamageDiceForStage = eventDamageResults.flatMap(
    (damage) => damage.rolls,
  );
  const eventDamageDiceSubtotal = eventDamageDiceForStage.reduce(
    (sum, value) => sum + value,
    0,
  );
  const eventDamageDiceSignature = eventDamageDiceForStage.join(",");
  const showEventDamageDiceStage =
    !deferEventDamageStage && eventDamageDiceForStage.length > 0 && !rerollSelection;
  const eventDamageSummaries = eventDamageResults.map((damage) => {
    const damageKindLabel =
      damage.damageKind === "physical"
        ? t("board.status.damageKindPhysical")
        : t("board.status.damageKindMental");
    const rollsLabel = damage.rolls.join(" / ");
    const effectItemLabel = t("board.roll.eventDamageEffectItem", {
      applied: damage.appliedAmount,
      kind: damageKindLabel,
    });
    const resultLabel = t("board.roll.eventDamageResult", {
      diceCount: damage.rolls.length,
      rolls: rollsLabel,
      total: damage.total,
      applied: damage.appliedAmount,
      kind: damageKindLabel,
    });
    return {
      ...damage,
      rollsLabel,
      effectItemLabel,
      visibleLabel: resultLabel,
      srLabel: resultLabel,
    };
  });
  const visibleDiceSubtotal = showEventDamageDiceStage
    ? eventDamageDiceSubtotal
    : diceSubtotal;
  const visiblePassiveBonus = showEventDamageDiceStage ? 0 : roll.passiveBonus;
  const visibleBonusLabel =
    visiblePassiveBonus > 0
      ? `+${visiblePassiveBonus}`
      : String(visiblePassiveBonus);
  const visibleRollTotal = showEventDamageDiceStage
    ? eventDamageDiceSubtotal
    : baseRollTotal;
  const rollDetailText = t("board.roll.detail", {
    subtotal: visibleDiceSubtotal,
    bonus: visibleBonusLabel,
    total: visibleRollTotal,
  });
  const passiveBonusLabel = t("board.roll.passiveBonus", {
    value: visibleBonusLabel,
  });
  const bonusText =
    visiblePassiveBonus !== 0
      ? t("board.roll.bonus", { value: visibleBonusLabel })
      : t("board.roll.noBonus");
  const eventDamageDescriptionLabel = showEventDamageDiceStage
    ? roll.sourceEventRoll?.eventDescription ??
      roll.sourceEventRoll?.latestLabel ??
      roll.latestLabel
    : "";
  const eventDamageSubtitleLabel =
    showEventDamageDiceStage && roll.sourceEventRoll?.eventDescription
      ? roll.sourceEventRoll.latestLabel
      : "";
  const eventDamageEffectLabel =
    showEventDamageDiceStage && eventDamageSummaries.length > 0
      ? t("board.roll.eventDamageEffect", {
          effect: eventDamageSummaries
            .map((damage) => damage.effectItemLabel)
            .join("；"),
        })
      : "";
  const primaryOutcomeLabel = roll.latestLabel;
  const diceStageRoll: BetrayalRecentRollState = showEventDamageDiceStage
    ? roll.kind === "eventRolledDamage"
      ? roll
      : {
        ...roll,
        id: `${roll.id}-event-rolled-damage-${eventDamageDiceSignature}`,
        rollLabel: t("board.roll.eventDamageDiceLabel"),
        dice: eventDamageDiceForStage,
        passiveBonus: 0,
      }
    : roll;
  const totalLabel = t(
    showEventDamageDiceStage
      ? "board.roll.eventDamageDiceTotal"
      : "board.roll.total",
    {
      value: visibleRollTotal,
    },
  );
  const diceSubtotalLabel = t(
    showEventDamageDiceStage
      ? "board.roll.eventDamageDiceSubtotal"
      : "board.roll.diceSubtotal",
    {
      value: visibleDiceSubtotal,
    },
  );
  const safeRollId =
    diceStageRoll.id
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "roll";
  const canvasTestId = `betrayal-house-dice-box-canvas-${safeRollId}`;

  const diceStage = (
    <BetrayalHouseDice3DGroup
      roll={diceStageRoll}
      locale={effectiveLocale}
      canvasTestId={canvasTestId}
      animateInitialRoll={animateInitialRoll}
      rerollSelection={rerollSelection}
      styleProfile={diceStyleProfile}
      visualScale={diceVisualScale}
      onDiceSettledChange={onDiceSettledChange}
      className={`h-full w-full min-w-0 ${diceClassName ?? ""}`}
    />
  );
  const diceStagePromptLabel = rerollSelection?.promptLabel ?? "";
  const shouldShowDiceStagePrompt = Boolean(diceStagePromptLabel);
  const diceStageWithPrompt = (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-visible">
      <div
        data-testid="betrayal-reroll-prompt-outside-dice"
        aria-hidden={shouldShowDiceStagePrompt ? undefined : "true"}
        className={
          shouldShowDiceStagePrompt
            ? "pointer-events-none mb-1 justify-self-center px-2 py-0.5 text-[11px] font-semibold tracking-[0.14em] text-[#f7e6ab] drop-shadow-[0_2px_7px_rgba(0,0,0,0.72)]"
            : "pointer-events-none h-0 overflow-hidden p-0 text-[0px] leading-none opacity-0"
        }
      >
        {diceStagePromptLabel}
      </div>
      {diceStage}
    </div>
  );
  const shouldShowVisibleSource = showEventDamageDiceStage ? false : showSource;
  const shouldShowVisibleRollLabel = showRollLabel && !showEventDamageDiceStage;
  const shouldShowEventDamageDescription =
    showOutcome && showEventDamageDiceStage && Boolean(eventDamageDescriptionLabel);
  const shouldShowEventDamageSubtitle =
    showOutcome && showEventDamageDiceStage && Boolean(eventDamageSubtitleLabel);
  const shouldShowEventDamageEffect =
    showOutcome && showEventDamageDiceStage && Boolean(eventDamageEffectLabel);
  const shouldShowPrimaryOutcome = showOutcome && !showEventDamageDiceStage;
  const shouldShowEventDamageVisibleSummary =
    showOutcome && eventDamageSummaries.length > 0 && !showEventDamageDiceStage;
  const showResultCopy = Boolean(
    actorLabel ||
      shouldShowVisibleSource ||
      shouldShowVisibleRollLabel ||
      shouldShowEventDamageDescription ||
      shouldShowEventDamageSubtitle ||
      shouldShowEventDamageEffect ||
      shouldShowPrimaryOutcome ||
      shouldShowEventDamageVisibleSummary ||
      (showBreakdown && attackComparisonText),
  );
  const actionSlotBelowResult = Boolean(actionSlot && openTable && !denseResult);
  const resultGridColumns = actionSlotBelowResult
    ? showResultCopy
      ? "grid-cols-[minmax(0,1fr)_auto]"
      : "grid-cols-[auto]"
    : showResultCopy
      ? actionSlot
        ? "grid-cols-[minmax(0,1fr)_auto_auto]"
        : "grid-cols-[minmax(0,1fr)_auto]"
      : actionSlot
        ? "grid-cols-[auto_auto]"
        : "grid-cols-[auto]";
  const shouldShowVisibleBreakdown =
    showBreakdown && !(showEventDamageDiceStage && visiblePassiveBonus === 0);
  const breakdownStage = shouldShowVisibleBreakdown ? (
    <div
      data-testid="betrayal-recent-roll-breakdown"
      data-result-role="total-breakdown"
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-[7px] border border-[rgba(211,179,109,0.18)] bg-[rgba(211,179,109,0.06)] px-2 py-0.5 font-semibold text-[#d6c498] ${
        denseResult ? "text-[10px] leading-[14px]" : "text-[12px] leading-[16px]"
      }`}
    >
      <span data-testid="betrayal-recent-roll-detail" className="sr-only">
        {rollDetailText}
      </span>
      <span
        data-testid="betrayal-recent-roll-subtotal"
        className="text-[#e2cc91]"
      >
        {diceSubtotalLabel}
      </span>
      <span className="text-[rgba(214,191,129,0.42)]">/</span>
      <span
        data-testid="betrayal-recent-roll-passive-bonus"
        className="text-[#cdb783]"
      >
        {passiveBonusLabel}
      </span>
      <span
        data-testid="betrayal-recent-roll-a11y-summary"
        className="sr-only"
      >
        {rollDetailText}
      </span>
      <span data-testid="betrayal-recent-roll-bonus" className="sr-only">
        {bonusText}
      </span>
    </div>
  ) : null;
  const resultStage = (
    <div
      data-testid="betrayal-recent-roll-result-stage"
      data-result-layout="split-primary-total"
      data-result-surface={
        openTable
          ? compactResult
            ? "open-info-band"
            : "open-transparent"
          : "boxed"
      }
      className={`relative z-20 grid ${
        denseResult
          ? openTableResultDocked
            ? "h-[92px] max-h-[92px] w-[220px] max-w-full justify-self-end gap-1.5 px-2 py-1 text-right"
            : openTable
              ? "min-h-[72px] gap-2 px-2.5 py-1.5"
              : "min-h-[72px] gap-2 rounded-[10px] border border-[rgba(211,179,109,0.24)] bg-[rgba(5,9,8,0.86)] px-2.5 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.36)]"
          : compactResult
            ? "min-h-[92px] gap-4 px-3 py-2"
            : "min-h-[112px] gap-4 px-4 py-3"
      } ${resultGridColumns} ${
        showResultCopy ? "" : "justify-end"
      } items-center ${denseResult ? (actionSlot ? "overflow-visible" : "overflow-hidden") : "overflow-visible"} text-left ${resultStageClassName} ${
        denseResult
          ? openTable
            ? "bg-transparent shadow-none"
            : ""
        : openTable
          ? compactResult
            ? "rounded-[12px] border-0 bg-[rgba(7,11,9,0.34)] shadow-none"
            : "bg-transparent shadow-none"
          : "rounded-[12px] border border-[rgba(211,179,109,0.24)] bg-[rgba(9,10,8,0.72)] shadow-[0_8px_22px_rgba(0,0,0,0.28)]"
      }`}
    >
      {showResultCopy ? (
        <div className="min-w-0">
        {actorLabel ? (
          <div
            data-testid="betrayal-recent-roll-actor"
            className="mb-1 inline-flex max-w-full items-center rounded-[999px] border border-[rgba(214,181,109,0.30)] bg-[rgba(214,181,109,0.10)] px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-[#f4dda0]"
          >
            <span className="truncate">{actorLabel}</span>
          </div>
        ) : null}
        {shouldShowVisibleSource ? (
          <div
            data-testid="betrayal-recent-roll-source-title"
            data-result-role="source-title"
            className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c9a35e]"
          >
            {roll.sourceTitle}
          </div>
        ) : null}
        {shouldShowVisibleRollLabel ? (
          <div className="mt-0.5 truncate text-[12px] font-semibold text-[#d8c38b]">
            {roll.rollLabel ?? t("board.roll.fallbackLabel")}
          </div>
        ) : null}
        {shouldShowEventDamageDescription ? (
          <div
            data-testid="betrayal-recent-roll-event-description"
            data-result-role="event-damage-description"
            className={`max-w-full font-bold tracking-[0.03em] text-[#fff7c8] drop-shadow-[0_2px_8px_rgba(0,0,0,0.62)] ${
              denseResult
                ? openTableResultDocked
                  ? "max-h-[34px] overflow-hidden whitespace-normal break-words text-[12px] leading-[17px]"
                  : "whitespace-normal break-words text-[13px] leading-[18px]"
                : "truncate text-[16px] md:text-[18px]"
            }`}
          >
            {eventDamageDescriptionLabel}
          </div>
        ) : null}
        {shouldShowEventDamageSubtitle ? (
          <div
            data-testid="betrayal-recent-roll-event-subtitle"
            data-result-role="event-damage-subtitle"
            className={`max-w-full font-semibold tracking-[0.03em] text-[#e8d59b] drop-shadow-[0_2px_8px_rgba(0,0,0,0.62)] ${
              denseResult
                ? "mt-0.5 whitespace-normal break-words text-[11px] leading-[15px]"
                : "mt-1 truncate text-[12px] leading-[16px]"
            }`}
          >
            {eventDamageSubtitleLabel}
          </div>
        ) : null}
        {shouldShowEventDamageEffect ? (
          <div
            data-testid="betrayal-recent-roll-event-effect"
            data-result-role="event-damage-effect"
            className={`max-w-full font-semibold tracking-[0.03em] text-[#d8c38b] drop-shadow-[0_2px_8px_rgba(0,0,0,0.62)] ${
              denseResult
                ? "mt-0.5 whitespace-normal break-words text-[11px] leading-[15px]"
                : "mt-1 truncate text-[12px] leading-[16px]"
            }`}
          >
            {eventDamageEffectLabel}
          </div>
        ) : null}
        {shouldShowPrimaryOutcome ? (
          <div
            data-testid="betrayal-recent-roll-outcome"
            data-result-role="outcome-primary"
            className={`max-w-full font-bold tracking-[0.03em] text-[#fff7c8] drop-shadow-[0_2px_8px_rgba(0,0,0,0.62)] ${
              denseResult
                ? openTableResultDocked
                  ? "mt-0.5 max-h-[34px] overflow-hidden whitespace-normal break-words text-[12px] leading-[17px]"
                  : "mt-1 whitespace-normal break-words text-[13px] leading-[18px]"
                : "mt-2 truncate text-[16px] md:text-[18px]"
            }`}
          >
            {primaryOutcomeLabel}
          </div>
        ) : null}
        {showBreakdown && attackComparisonText ? (
          <div
            data-testid="betrayal-recent-roll-attack-comparison"
            className="mt-1 truncate text-[11px] font-semibold text-[#cdb783]"
          >
            {attackComparisonText}
          </div>
        ) : null}
        {shouldShowEventDamageVisibleSummary ? (
          <div
            data-testid="betrayal-recent-roll-effect-damage"
            className={`mt-1 grid max-w-full gap-0.5 font-semibold text-[#f0d99a] ${
              denseResult
                ? "text-[11px] leading-[15px]"
                : "text-[12px] leading-[16px]"
            }`}
          >
            {eventDamageSummaries.map((damage, index) => (
              <span
                key={`${damage.damageKind}-${index}-${damage.rollsLabel}`}
                data-testid="betrayal-recent-roll-damage-dice"
                data-damage-kind={damage.damageKind}
                data-damage-rolls={damage.rollsLabel}
                data-damage-total={damage.total}
                data-applied-damage={damage.appliedAmount}
                className="whitespace-normal break-words"
              >
                {damage.visibleLabel}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}
      <div
        data-testid="betrayal-recent-roll-total"
        data-result-emphasis="primary-total"
        className={`flex min-w-0 flex-col items-end gap-1 whitespace-nowrap text-right font-black tracking-[0.02em] text-[#fff0a3] drop-shadow-[0_3px_10px_rgba(0,0,0,0.72)] ${
          showResultCopy ? "border-l border-[rgba(211,179,109,0.20)]" : ""
        } ${
          denseResult
            ? openTableResultDocked
              ? "pl-1.5 text-[16px]"
              : "pl-2 text-[16px]"
          : "pl-4 text-[22px] md:text-[28px]"
        }`}
      >
        <span className="leading-none">{totalLabel}</span>
        {breakdownStage}
      </div>
      {actionSlot ? (
        <div
          className={`pointer-events-auto flex ${
            actionSlotBelowResult
              ? "col-span-full justify-center border-t border-[rgba(211,179,109,0.16)] pt-2"
              : "justify-end pl-1"
          }`}
        >
          {actionSlot}
        </div>
      ) : null}
    </div>
  );
  const srSummary = (
    <div className="sr-only">
      {actorLabel ? <span>{actorLabel}</span> : null}
      {showSource ? <span>{roll.sourceTitle}</span> : null}
      {showRollLabel ? (
        <span>{roll.rollLabel ?? t("board.roll.fallbackLabel")}</span>
      ) : roll.rollLabel && !showEventDamageDiceStage ? (
        <span>{roll.rollLabel}</span>
      ) : null}
      <span>{bonusText}</span>
      {attackComparisonText ? <span>{attackComparisonText}</span> : null}
      {eventDamageSummaries.map((damage, index) => (
        <span key={`${damage.damageKind}-${index}-${damage.rollsLabel}`}>
          {damage.srLabel}
        </span>
      ))}
      <span>{rollDetailText}</span>
      <span>{totalLabel}</span>
      {shouldShowEventDamageDescription ? <span>{eventDamageDescriptionLabel}</span> : null}
      {shouldShowEventDamageSubtitle ? <span>{eventDamageSubtitleLabel}</span> : null}
      {shouldShowEventDamageEffect ? <span>{eventDamageEffectLabel}</span> : null}
      {shouldShowPrimaryOutcome ? <span>{primaryOutcomeLabel}</span> : null}
    </div>
  );

  if (landscapeResultDock) {
    return (
      <div
        data-testid="betrayal-recent-roll-panel"
        data-tutorial-id="betrayal-recent-roll-panel"
        data-roll-panel-style="mobile-landscape-open-dock"
        data-visible-dice-source={
          showEventDamageDiceStage ? "event-rolled-damage" : "recent-roll"
        }
        className={`pointer-events-none min-h-[214px] text-[#f3e0a6] ${className}`}
      >
        <div className="grid h-full min-h-[214px] grid-cols-[minmax(260px,1fr)_minmax(190px,0.58fr)] items-center gap-3">
          <div className="relative h-full min-h-[214px] min-w-0">
            {diceStageWithPrompt}
          </div>
          <div className="pointer-events-auto flex min-h-0 min-w-0 flex-col justify-center gap-2">
            {resultStage}
          </div>
        </div>
        {srSummary}
      </div>
    );
  }

  return (
    <div
      data-testid="betrayal-recent-roll-panel"
      data-tutorial-id="betrayal-recent-roll-panel"
      data-roll-panel-style={openTable ? "open-table-transparent" : "boxed"}
      data-visible-dice-source={
        showEventDamageDiceStage ? "event-rolled-damage" : "recent-roll"
      }
      className={`pointer-events-none relative ${
        openTable ? "overflow-visible rounded-none" : "overflow-hidden rounded-[20px]"
      } ${denseResult ? "min-h-[236px]" : "min-h-[260px]"} text-[#f3e0a6] ${
        openTable
          ? "bg-transparent p-0 shadow-none"
          : "border border-[rgba(211,179,109,0.42)] bg-[linear-gradient(180deg,rgba(22,18,12,0.96),rgba(9,12,10,0.94))] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.38)]"
      } ${className}`}
    >
      {denseResult ? (
        openTable && denseResultPlacement === "floatingSide" ? (
          <div className="relative z-10 h-full min-h-[236px] overflow-visible">
            <div
              className="relative h-[214px] min-h-[214px] min-w-[240px] max-w-[300px] -translate-y-16 overflow-visible"
              style={{ width: "calc(100% - 224px)" }}
            >
              {diceStageWithPrompt}
            </div>
            <div
              className={`pointer-events-none absolute right-0 z-10 w-[220px] ${floatingResultClassName || "top-0"}`}
            >
              {resultStage}
            </div>
          </div>
        ) : openTable ? (
          <div
            className={`relative z-10 grid h-full min-h-[236px] grid-rows-[minmax(156px,1fr)_auto] gap-1 ${
              openTableResultDocked ? "overflow-hidden" : "overflow-visible"
            }`}
          >
            <div
              className={`relative min-h-[156px] min-w-0 ${
                openTableResultDocked ? "overflow-hidden" : "overflow-visible"
              }`}
              >
                {diceStageWithPrompt}
              </div>
            <div
              className={`pointer-events-none relative z-10 ${
                openTableResultDocked
                  ? "max-h-[88px] min-w-0 overflow-hidden"
                  : ""
              }`}
            >
              {resultStage}
            </div>
          </div>
        ) : (
          <div className="relative z-10 h-full min-h-[236px] overflow-hidden">
            {diceStageWithPrompt}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
              {resultStage}
            </div>
          </div>
        )
      ) : (
        <div
          className={`relative z-10 grid h-full min-h-[260px] ${
            compactResult
              ? compactRowsClassName || "grid-rows-[minmax(174px,1fr)_auto]"
              : "grid-rows-[minmax(154px,1fr)_auto]"
          } gap-2`}
        >
          {diceStageWithPrompt}
          {resultStage}
        </div>
      )}
      {srSummary}
    </div>
  );
}

export function StandardRecentRollOverlay({
  roll,
  isPhoneLandscapeLayout,
  canDismissByBackdrop,
  onDismiss,
  effectiveLocale,
  rerollSelection,
  actionSlot = null,
  actorLabel = null,
}: {
  roll: BetrayalRecentRollState;
  isPhoneLandscapeLayout: boolean;
  canDismissByBackdrop: boolean;
  onDismiss: () => void;
  effectiveLocale: string;
  rerollSelection?: RecentRollRerollSelection | null;
  actionSlot?: React.ReactNode;
  actorLabel?: string | null;
}) {
  const { t } = useTranslation("game-betrayal");
  const continueButton = (
    <button
      type="button"
      data-testid="betrayal-roll-continue"
      className={`pointer-events-auto inline-flex min-h-[42px] max-w-full shrink-0 items-center justify-center whitespace-nowrap border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a] ${
        isPhoneLandscapeLayout ? "min-w-[132px]" : "min-w-[168px]"
      }`}
      onClick={onDismiss}
    >
      {t("board.roll.backToBoard")}
    </button>
  );
  const dockedActionSlot = actionSlot ?? continueButton;
  const overlay = (
    <div
      data-testid="betrayal-roll-result-backdrop"
      data-backdrop-dismiss={canDismissByBackdrop ? "enabled" : "disabled"}
      data-render-layer={isPhoneLandscapeLayout ? "hud-portal" : "board-stage"}
      className={`${isPhoneLandscapeLayout ? "fixed inset-0" : "absolute inset-0 z-40"} ${
        canDismissByBackdrop ? "pointer-events-auto" : "pointer-events-none"
      }`}
      style={
        isPhoneLandscapeLayout
          ? {
              zIndex: UI_Z_INDEX.emergencyHud + 40,
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgba(6,18,13,0.86), rgba(2,8,6,0.94) 74%, rgba(2,8,6,0.98))",
            }
          : undefined
      }
      onClick={canDismissByBackdrop ? onDismiss : undefined}
    >
      <div
        data-testid="betrayal-roll-result-dock"
        className={
          isPhoneLandscapeLayout
            ? "pointer-events-auto absolute flex flex-col items-center gap-2"
            : "pointer-events-auto absolute bottom-[106px] left-[392px] right-[240px] z-40 flex flex-col items-center gap-2"
        }
        style={
          isPhoneLandscapeLayout
            ? {
                left: "50%",
                top: "clamp(82px, 22vh, 108px)",
                transform: "translateX(-50%)",
                width: "min(760px, calc(100vw - 5rem))",
              }
            : undefined
        }
        onClick={(event) => event.stopPropagation()}
      >
        <RecentRollPanel
          roll={roll}
          className={
            isPhoneLandscapeLayout
              ? "h-[min(54vh,238px)] min-h-[218px] w-full"
              : "h-[min(44vh,390px)] min-h-[360px] w-[min(700px,100%)]"
          }
          diceClassName={isPhoneLandscapeLayout ? "min-h-[214px]" : "min-h-[252px]"}
          rerollSelection={rerollSelection}
          openTable
          compactResult
          compactRowsClassName={
            isPhoneLandscapeLayout
              ? undefined
              : "grid-rows-[minmax(252px,1fr)_auto]"
          }
          resultStageClassName={isPhoneLandscapeLayout ? undefined : "mt-3"}
          denseResult={isPhoneLandscapeLayout}
          landscapeResultDock={isPhoneLandscapeLayout}
          diceStyleProfile={
            isPhoneLandscapeLayout
              ? BETRAYAL_HOUSE_DICE_MOBILE_STYLE_PROFILE
              : BETRAYAL_HOUSE_DICE_STYLE_PROFILE
          }
          diceVisualScale={isPhoneLandscapeLayout ? 1.16 : 1}
          effectiveLocale={effectiveLocale}
          actorLabel={actorLabel}
          actionSlot={isPhoneLandscapeLayout ? dockedActionSlot : null}
        />
        {isPhoneLandscapeLayout ? null : (
          <div
            data-testid="betrayal-roll-continue-dock"
            className="pointer-events-auto mt-2 flex w-[min(700px,100%)] justify-center"
          >
            {dockedActionSlot}
          </div>
        )}
      </div>
    </div>
  );

  return isPhoneLandscapeLayout ? <HudPortal>{overlay}</HudPortal> : overlay;
}
