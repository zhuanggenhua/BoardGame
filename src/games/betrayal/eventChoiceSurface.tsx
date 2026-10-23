import React from "react";
import { useTranslation } from "react-i18next";

import { UI_Z_INDEX } from "../../core";
import {
  resolveDiscoveryAtlasVisual,
  type BetrayalDiscoveryAtlasVisual,
} from "./discoveryAtlas";
import type { BetrayalPossessionAtlasVisual } from "./possessionAtlas";
import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
  BetrayalRecentRollState,
  BetrayalTraitKey,
  UseEffectProfile,
} from "./game";
import { DiscoveryAtlasFrame } from "./atlasFrameSurface";
import {
  BetrayalConfirmButton,
  BetrayalSecondaryButton,
} from "./confirmButtonSurface";
import { BetrayalDecisionActionDock } from "./decisionActionDockSurface";
import { BetrayalChoiceOptionButton } from "./choiceOptionSurface";
import { RecentRollPanel } from "./recentRollSurface";
import {
  ExplorerTraitOutcomePreview,
  TRAIT_CHOICE_TONE_CLASS,
  TRAIT_LABEL_LOCAL,
  TRAIT_TONE_CLASS,
} from "./traitTrackSurface";
import {
  countSelectedDamageTrait,
  resolveTraitDamageAssignableSteps,
} from "./traitPresentation";

type BetrayalPendingEventChoice = NonNullable<BetrayalCore["pendingEventChoice"]>;
type BetrayalRecentAllTraitCheck = NonNullable<BetrayalCore["recentAllTraitCheck"]>;
type BetrayalEventDamageChoice = Extract<
  UseEffectProfile,
  { mode: "generalDamageChoice" }
>;

export function BetrayalEventChoiceSurface({
  choice,
  isMobileViewport,
  isResolvingTraitRoll = false,
  disableTraitChoices = false,
  rollActionSlot,
  isEventSymbolSkip,
  awaitsMapTargetClick,
  hasMapTargetRooms,
  latestDiscoveryVisual,
  roll,
  resultReadable,
  onDiceSettledChange,
  rollActorLabel,
  allTraitCheck,
  traitChoices,
  selectedTrait,
  hasItemChoice,
  itemChoiceCards,
  selectedCardId,
  showDamageChoice,
  damageChoice,
  selectedDamageTraits,
  explorer,
  phase,
  locale,
  ready,
  canDecline,
  showAcceptButton,
  onSelectTrait,
  onSelectCard,
  onAdjustDamageTrait,
  canIncrementDamageTrait,
  onResolve,
}: {
  choice: Pick<BetrayalPendingEventChoice, "sourceTitle" | "effect" | "eventSymbolSkip" | "declineLabel" | "acceptLabel" | "allTraitCheckProgress">;
  isMobileViewport: boolean;
  isResolvingTraitRoll?: boolean;
  disableTraitChoices?: boolean;
  rollActionSlot?: React.ReactNode;
  isEventSymbolSkip: boolean;
  awaitsMapTargetClick: boolean;
  hasMapTargetRooms: boolean;
  hasResultPanel: boolean;
  latestDiscoveryVisual: BetrayalDiscoveryAtlasVisual | BetrayalPossessionAtlasVisual | null;
  roll: BetrayalRecentRollState | null;
  resultReadable: boolean;
  onDiceSettledChange?: (rollId: string, settled: boolean) => void;
  rollActorLabel: string | null;
  allTraitCheck: BetrayalRecentAllTraitCheck | null;
  traitChoices: BetrayalTraitKey[];
  selectedTrait: BetrayalTraitKey | null;
  hasItemChoice: boolean;
  itemChoiceCards: BetrayalInventoryCard[];
  selectedCardId: string | null;
  showDamageChoice: boolean;
  damageChoice: BetrayalEventDamageChoice | null;
  selectedDamageTraits: BetrayalTraitKey[];
  explorer: BetrayalExplorerSummary;
  phase: BetrayalCore["phase"];
  locale: string;
  ready: boolean;
  canDecline: boolean;
  showAcceptButton: boolean;
  onSelectTrait: (trait: BetrayalTraitKey) => void;
  onSelectCard: (cardId: string) => void;
  onAdjustDamageTrait: (trait: BetrayalTraitKey, delta: -1 | 1) => void;
  canIncrementDamageTrait: (trait: BetrayalTraitKey) => boolean;
  onResolve: (accept: boolean) => void;
}) {
  const { t } = useTranslation(["game-betrayal", "common"]);
  const isTraitCheckSelection = choice.effect.mode === "allTraitChecks";
  const visibleTraitChoices = isTraitCheckSelection
    ? (["might", "speed", "knowledge", "sanity"] as BetrayalTraitKey[]).filter(
        (trait) => traitChoices.includes(trait) || allTraitCheck?.results.some((result) => result.trait === trait),
      )
    : traitChoices;
  const traitChoiceGridClass =
    visibleTraitChoices.length >= 4
      ? "grid-cols-4 max-[700px]:grid-cols-2"
      : visibleTraitChoices.length === 3
        ? "grid-cols-3 max-[700px]:grid-cols-2"
        : visibleTraitChoices.length === 2
          ? "grid-cols-2"
          : "grid-cols-1";
  const hasDecisionChoices =
    visibleTraitChoices.length > 0 || hasItemChoice || showDamageChoice;
  const sourceEventVisual = !isEventSymbolSkip
    ? resolveDiscoveryAtlasVisual(
        {
          kind: "event",
          title: choice.sourceTitle,
          summary: "",
          detail: "",
          tone: "accent",
        },
        itemChoiceCards,
      )
    : null;
  const eventChoiceCardVisual = isEventSymbolSkip
    ? null
    : sourceEventVisual ?? latestDiscoveryVisual;
  return (
    <div
      data-testid="betrayal-event-choice-backdrop"
      data-scene-visibility={hasMapTargetRooms ? "interactive-map" : "receded"}
      className={`absolute inset-0 ${hasMapTargetRooms ? "pointer-events-none" : "pointer-events-auto bg-[rgba(3,7,6,0.88)]"}`}
      style={{ zIndex: UI_Z_INDEX.overlayRaised + 160 }}
    >
      <div
        data-testid="betrayal-event-choice-panel"
        data-layout="main-stage"
        data-surface="open-table"
        aria-label={choice.sourceTitle}
        className={`${awaitsMapTargetClick ? "pointer-events-none [&_*]:pointer-events-none" : "pointer-events-auto"} absolute flex min-h-0 flex-col gap-4 overflow-hidden text-[#f3e0a6]`}
        style={{ top: isMobileViewport ? 104 : 120, bottom: isMobileViewport ? 16 : 96, left: isMobileViewport ? 16 : 288, right: isMobileViewport ? 16 : 232 }}
      >
        <div
          data-testid="betrayal-event-choice-content"
          className={`custom-scrollbar grid min-h-0 flex-1 items-start gap-6 overflow-y-auto ${isEventSymbolSkip || isMobileViewport ? "grid-cols-1" : "grid-cols-[minmax(180px,280px)_minmax(0,1fr)] max-[1300px]:grid-cols-1"}`}
        >
          {isEventSymbolSkip ? null : (
            <div className="pointer-events-none w-full min-w-0 max-w-[280px] justify-self-center drop-shadow-[0_26px_54px_rgba(0,0,0,0.58)]">
              {eventChoiceCardVisual ? (
                <DiscoveryAtlasFrame
                  visual={eventChoiceCardVisual}
                  locale={locale}
                  alt={choice.sourceTitle}
                  testId="betrayal-event-choice-card-front-atlas"
                  className="w-full"
                />
              ) : (
                <div
                  data-testid="betrayal-event-choice-card-front-missing"
                  className="flex aspect-[675/1275] items-center justify-center border border-[rgba(211,179,109,0.34)] bg-[rgba(13,15,11,0.74)] px-3 text-center text-[14px] font-semibold leading-tight text-[#d6c498]"
                >
                  {choice.sourceTitle}
                </div>
              )}
            </div>
          )}
          <div
            data-testid="betrayal-event-choice-action-group"
            className={`flex min-h-0 min-w-0 w-full flex-col gap-3 ${isMobileViewport ? "" : "max-w-[680px] justify-self-start justify-center"}`}
          >
            {allTraitCheck && !(roll && (isTraitCheckSelection || isResolvingTraitRoll)) ? (
              <div
                data-testid="betrayal-event-choice-all-trait-check"
                className="pointer-events-none flex max-h-[220px] min-h-0 min-w-0 max-w-[500px] flex-col justify-center gap-3 overflow-y-auto border-l border-[rgba(214,191,129,0.24)] pl-4"
              >
                <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                  {t("board.roll.allTraitCheckTitle")}
                </span>
                <div className="grid gap-2">
                  {allTraitCheck.results.map((result) => (
                    <div
                      key={result.trait}
                      data-testid={`betrayal-event-choice-all-trait-check-${result.trait}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[rgba(214,191,129,0.18)] pb-2 last:border-b-0 last:pb-0"
                    >
                      <span
                        className={`text-[16px] font-black ${TRAIT_TONE_CLASS[result.trait].text}`}
                      >
                        {TRAIT_LABEL_LOCAL[result.trait]}
                      </span>
                      <span className="text-[11px] font-semibold tracking-[0.08em] text-[#d6c498]">
                        {t("board.roll.diceFaces", {
                          value: result.dice.join(" + "),
                        })}
                      </span>
                      <span
                        className={
                          result.passed
                            ? "text-[16px] font-black text-[#c8f6a5]"
                            : "text-[16px] font-black text-[#ffb1a1]"
                        }
                      >
                        {result.total} /{" "}
                        {result.passed
                          ? t("board.roll.passed")
                          : t("board.roll.failed")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : roll ? (
              <RecentRollPanel
                roll={roll}
                className="h-[260px] min-h-[260px] w-full min-w-0"
                diceClassName="min-h-[210px]"
                effectiveLocale={locale}
                actorLabel={rollActorLabel}
                showSource={false}
                showRollLabel
                openTable
                compactResult={false}
                denseResult
                denseResultPlacement="stacked"
                openTableResultDocked
                diceVisualScale={isMobileViewport ? 2.85 : 1}
                resultReadable={resultReadable}
                onDiceSettledChange={onDiceSettledChange}
                actionSlot={rollActionSlot}
              />
            ) : null}
            <BetrayalDecisionActionDock
              layout="inline"
              className={`${
                hasDecisionChoices && (showAcceptButton || choice.declineLabel)
                  ? "!items-end"
                  : "!items-center"
              } !justify-start !gap-3 !px-0 !pt-0 !pb-0 max-[700px]:flex-wrap`}
            >
              <div
                className={`min-w-0 ${
                  hasDecisionChoices || showAcceptButton || choice.declineLabel
                    ? "w-fit max-w-full"
                    : "flex-1"
                }`}
              >
                {isEventSymbolSkip ? (
                  <div
                    data-testid="betrayal-event-choice-symbol-summary"
                    className="rounded-[14px] border-2 border-[#4ade80] bg-[rgba(9,24,15,0.90)] px-5 py-4 text-center text-[#d9ffcf] shadow-[0_0_0_1px_rgba(5,46,22,0.92),0_14px_28px_rgba(0,0,0,0.34)]"
                  >
                    <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#86efac]">
                      {t("board.discovery.eventSymbol")}
                    </div>
                    <div className="mt-1 text-[22px] font-black leading-tight text-[#ecfdf5]">
                      {choice.eventSymbolSkip?.roomName ?? choice.sourceTitle}
                    </div>
                    <p className="mt-2 text-[14px] font-semibold leading-snug text-[#bbf7d0]">
                      {t("board.discovery.eventSymbolSkipPrompt")}
                    </p>
                  </div>
                ) : null}
                <div
                  className="custom-scrollbar flex max-h-[240px] min-h-0 flex-col overflow-y-auto pr-1"
                >
                  {visibleTraitChoices.length > 0 ? (
                    <div
                      className="grid w-fit max-w-full gap-2"
                      data-testid="betrayal-event-choice-traits"
                    >
                      <span className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                        {(isResolvingTraitRoll && !resultReadable) ||
                        (choice.effect.mode === "allTraitChecks" &&
                          (!choice.effect.results || choice.effect.results.length < choice.effect.traits.length))
                          ? t("board.status.chooseCheckTrait")
                          : choice.allTraitCheckProgress?.results.length
                            ? t("board.discovery.chooseRewardTrait")
                            : t("board.status.chooseTrait")}
                      </span>
                      <div
                        className={`grid ${traitChoiceGridClass} w-fit max-w-full gap-3`}
                      >
                        {visibleTraitChoices.map((trait) => {
                          const isSelectedTrait = selectedTrait === trait;
                          const completedCheck = isTraitCheckSelection
                            ? allTraitCheck?.results.find((result) => result.trait === trait)
                            : undefined;
                          return (
                            <BetrayalChoiceOptionButton
                              key={trait}
                              type="button"
                              onClick={() => onSelectTrait(trait)}
                              data-testid={`betrayal-event-choice-trait-${trait}`}
                              selected={isSelectedTrait}
                              disabled={disableTraitChoices || !traitChoices.includes(trait)}
                              selectedClassName={TRAIT_CHOICE_TONE_CLASS[trait].selected}
                              idleClassName={TRAIT_CHOICE_TONE_CLASS[trait].idle}
                              className="!min-h-[64px] !min-w-0 !px-3 !py-2 !text-[20px]"
                            >
                              <span className="flex flex-col items-center gap-1">
                                <span>{TRAIT_LABEL_LOCAL[trait]}</span>
                                {completedCheck && !(isResolvingTraitRoll && !resultReadable && roll?.trait === trait) ? (
                                  <span className="text-[12px] tracking-normal">
                                    {completedCheck.total} · {t(completedCheck.passed ? "board.roll.passed" : "board.roll.failed")}
                                  </span>
                                ) : null}
                              </span>
                            </BetrayalChoiceOptionButton>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {hasItemChoice ? (
                    <div
                      className="grid gap-3.5"
                      data-testid="betrayal-event-choice-items"
                    >
                      <span className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                        {t("board.inventory.eventItemChoice")}
                      </span>
                      {itemChoiceCards.length > 0 ? (
                        <div className="flex flex-wrap gap-4">
                          {itemChoiceCards.map((card) => (
                            <BetrayalChoiceOptionButton
                              key={card.id}
                              type="button"
                              onClick={() => onSelectCard(card.id)}
                              data-testid={`betrayal-event-choice-card-${card.id}`}
                              selected={selectedCardId === card.id}
                              selectedClassName="border-[#f0d27f] bg-[#d1b05f] text-[#17130d] shadow-[0_0_18px_rgba(209,176,95,0.30)]"
                              idleClassName="border-[rgba(211,179,109,0.32)] bg-[rgba(18,15,10,0.44)] text-[#d6c498] hover:border-[rgba(211,179,109,0.54)] hover:bg-[rgba(209,176,95,0.12)]"
                              className="!min-h-[58px] !min-w-[136px] !px-4 !py-3 !text-[16px]"
                            >
                              {card.name}
                            </BetrayalChoiceOptionButton>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[13px] font-semibold tracking-[0.06em] text-[#9f8c62]">
                          {t("board.inventory.noEventItemChoices")}
                        </span>
                      )}
                    </div>
                  ) : null}
                  {showDamageChoice && damageChoice ? (
                    <div
                      className="grid gap-3.5"
                      data-testid="betrayal-event-choice-damage-traits"
                    >
                      <span className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                        {t("board.status.damage")}
                      </span>
                      <div className="grid grid-cols-1 gap-2.5">
                        {damageChoice.allowedTraits.map((trait) => {
                          const selectedDamageTraitCount = countSelectedDamageTrait(
                            selectedDamageTraits,
                            trait,
                          );
                          const maxDamageTraitCount = resolveTraitDamageAssignableSteps(
                            explorer,
                            trait,
                            phase,
                          );
                          const isSelectedDamageTrait = selectedDamageTraitCount > 0;
                          const isDamageTraitDisabled =
                            !isSelectedDamageTrait &&
                            (maxDamageTraitCount <= 0 ||
                              selectedDamageTraits.length >= damageChoice.amount);
                          return (
                            <ExplorerTraitOutcomePreview
                              key={`damage-preview-${trait}`}
                              explorer={explorer}
                              trait={trait}
                              mode="damage"
                              phase={phase}
                              stepCount={selectedDamageTraitCount}
                              locale={locale}
                              t={t}
                              testIdPrefix="betrayal-event-choice-damage"
                              selected={isSelectedDamageTrait}
                              disabled={isDamageTraitDisabled}
                              selectedCount={selectedDamageTraitCount}
                              locked={maxDamageTraitCount <= 0}
                              onIncrement={() => onAdjustDamageTrait(trait, 1)}
                              onDecrement={() => onAdjustDamageTrait(trait, -1)}
                              canIncrement={canIncrementDamageTrait(trait)}
                              canDecrement={selectedDamageTraitCount > 0}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              {choice.declineLabel || showAcceptButton ? (
                <div className="flex shrink-0 items-center justify-center gap-3 max-[700px]:w-full">
                  {choice.declineLabel ? (
                    <BetrayalSecondaryButton
                      type="button"
                      onClick={() => onResolve(false)}
                      disabled={!canDecline}
                      data-testid="betrayal-event-choice-decline"
                      className="min-h-[64px] min-w-[144px] rounded-[10px] px-6 text-[16px] font-black max-[700px]:w-full"
                    >
                      {choice.declineLabel}
                    </BetrayalSecondaryButton>
                  ) : null}
                  {showAcceptButton ? (
                    <BetrayalConfirmButton
                      type="button"
                      onClick={() => onResolve(true)}
                      disabled={!ready}
                      data-testid="betrayal-event-choice-confirm"
                      className="min-h-[64px] min-w-[144px] rounded-[10px] px-6 text-[16px] font-black shadow-[0_0_30px_rgba(209,176,95,0.42)] max-[700px]:w-full"
                    >
                      {choice.acceptLabel ?? t("common:button.confirm")}
                    </BetrayalConfirmButton>
                  ) : null}
                </div>
              ) : null}
            </BetrayalDecisionActionDock>
          </div>
        </div>
      </div>
    </div>
  );
}
