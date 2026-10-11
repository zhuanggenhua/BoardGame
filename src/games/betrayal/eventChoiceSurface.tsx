import React from "react";
import { useTranslation } from "react-i18next";

import { UI_Z_INDEX } from "../../core";
import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
  BetrayalRecentRollState,
  BetrayalTraitKey,
  UseEffectProfile,
} from "./game";
import type { BetrayalDiscoveryAtlasVisual } from "./discoveryAtlas";
import type { BetrayalPossessionAtlasVisual } from "./possessionAtlas";
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
  isEventSymbolSkip,
  awaitsMapTargetClick,
  hasMapTargetRooms,
  hasResultPanel,
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
  choice: BetrayalPendingEventChoice;
  isMobileViewport: boolean;
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
  const usesWideDamageChoiceLayout = showDamageChoice && !isEventSymbolSkip && !hasResultPanel;

  return (
    <div
        data-testid="betrayal-event-choice-backdrop"
        data-scene-visibility={hasMapTargetRooms ? "interactive-map" : "receded"}
        className={`${
          awaitsMapTargetClick ? "pointer-events-none" : "pointer-events-auto"
        } flex items-center ${
          isEventSymbolSkip
            ? "absolute bottom-[96px] left-[264px] right-[232px] top-[180px] items-end justify-center px-2 pb-6 pt-0"
            : "absolute bottom-[96px] left-[264px] right-[232px] top-[180px] items-start justify-center px-2 py-0"
        }`}
        style={{ zIndex: UI_Z_INDEX.overlayRaised + 160 }}
      >
        <div
          data-testid="betrayal-event-choice-panel"
          data-layout="main-stage"
          data-surface="open-table"
          aria-label={choice.sourceTitle}
          className={`${
            awaitsMapTargetClick
              ? "pointer-events-none [&_*]:pointer-events-none"
              : "pointer-events-auto"
          } flex min-h-0 flex-col overflow-visible text-[#f3e0a6] ${
            isEventSymbolSkip
              ? "max-h-[440px] w-[620px]"
              : hasResultPanel
                ? isMobileViewport
                  ? "max-h-full w-full max-w-[1420px]"
                  : "max-h-full w-full max-w-[1100px]"
                : usesWideDamageChoiceLayout
                  ? "max-h-full w-full max-w-[1000px]"
                  : "max-h-full w-full max-w-[820px]"
          }`}
        >
          <div
            className={`grid min-h-0 ${
              isEventSymbolSkip
                ? "grid-cols-1 gap-4"
                : hasResultPanel
                  ? isMobileViewport
                    ? "grid-cols-[minmax(230px,260px)_minmax(620px,1fr)_minmax(352px,360px)] items-start gap-[90px]"
                    : "grid-cols-[minmax(230px,260px)_minmax(330px,1fr)_minmax(352px,360px)] items-start gap-5"
                  : usesWideDamageChoiceLayout
                    ? "grid-cols-[minmax(240px,280px)_minmax(420px,1fr)] items-start gap-6"
                    : "grid-cols-[minmax(240px,280px)_minmax(380px,1fr)] items-start gap-6"
            }`}
          >
          {isEventSymbolSkip ? null : (
            <div className="pointer-events-none w-full min-w-0 justify-self-center drop-shadow-[0_26px_54px_rgba(0,0,0,0.58)]">
              {latestDiscoveryVisual ? (
                <DiscoveryAtlasFrame
                  visual={latestDiscoveryVisual}
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
          {allTraitCheck ? (
            <div
              data-testid="betrayal-event-choice-all-trait-check"
              className="pointer-events-none flex h-[430px] min-h-[340px] min-w-0 flex-col justify-center gap-4 border-l border-[rgba(214,191,129,0.24)] pl-6"
            >
              <span className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                {t("board.roll.allTraitCheckTitle")}
              </span>
              <div className="grid gap-3">
                {allTraitCheck.results.map((result) => (
                  <div
                    key={result.trait}
                    data-testid={`betrayal-event-choice-all-trait-check-${result.trait}`}
                    className="grid gap-1 border-b border-[rgba(214,191,129,0.18)] pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-[18px] font-black ${TRAIT_TONE_CLASS[result.trait].text}`}
                      >
                        {TRAIT_LABEL_LOCAL[result.trait]}
                      </span>
                      <span
                        className={
                          result.passed
                            ? "text-[18px] font-black text-[#c8f6a5]"
                            : "text-[18px] font-black text-[#ffb1a1]"
                        }
                      >
                        {result.total} /{" "}
                        {result.passed
                          ? t("board.roll.passed")
                          : t("board.roll.failed")}
                      </span>
                    </div>
                    <span className="text-[12px] font-semibold tracking-[0.08em] text-[#d6c498]">
                      {t("board.roll.diceFaces", {
                        value: result.dice.join(" + "),
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : roll ? (
            <RecentRollPanel
              roll={roll}
              className="col-start-2 row-start-1 h-[410px] min-h-[410px] w-full min-w-0 justify-self-start"
              diceClassName="min-h-[236px]"
              effectiveLocale={locale}
              actorLabel={rollActorLabel}
              showSource={false}
              showRollLabel={false}
              openTable
              compactResult={false}
              denseResult
              denseResultPlacement="stacked"
              openTableResultDocked={false}
              diceVisualScale={isMobileViewport ? 2.85 : 1}
              resultReadable={resultReadable}
              onDiceSettledChange={onDiceSettledChange}
            />
          ) : null}
            <div
              className={`flex min-h-0 min-w-0 flex-col justify-start ${
              isEventSymbolSkip
                ? "pointer-events-auto justify-start gap-4"
                : roll
                  ? "pointer-events-auto relative col-span-full row-start-2 z-[140] mt-2 w-full justify-start border-t border-[rgba(214,191,129,0.18)] pt-4"
                  : "pointer-events-auto"
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
              className={`custom-scrollbar min-h-0 flex flex-col overflow-y-auto pr-1 ${
                roll ? "max-h-[280px] w-full" : "flex-1"
              }`}
            >
              {traitChoices.length > 0 ? (
                <div
                  className="grid gap-3.5"
                  data-testid="betrayal-event-choice-traits"
                >
                  <span className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                    {choice.effect.mode === "allTraitChecks" &&
                    (!choice.effect.results ||
                      choice.effect.results.length < choice.effect.traits.length)
                      ? t("board.status.chooseCheckTrait")
                      : t("board.status.chooseTrait")}
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {traitChoices.map((trait) => {
                      const isSelectedTrait = selectedTrait === trait;
                      return (
                        <BetrayalChoiceOptionButton
                          key={trait}
                          type="button"
                          onClick={() => onSelectTrait(trait)}
                          data-testid={`betrayal-event-choice-trait-${trait}`}
                          selected={isSelectedTrait}
                          selectedClassName={TRAIT_CHOICE_TONE_CLASS[trait].selected}
                          idleClassName={TRAIT_CHOICE_TONE_CLASS[trait].idle}
                          className={
                            ""
                          }
                        >
                          {TRAIT_LABEL_LOCAL[trait]}
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
                    <div
                      className={
                        "flex flex-wrap gap-4"
                      }
                    >
                      {itemChoiceCards.map((card) => (
                        <BetrayalChoiceOptionButton
                          key={card.id}
                          type="button"
                          onClick={() => onSelectCard(card.id)}
                          data-testid={`betrayal-event-choice-card-${card.id}`}
                          selected={selectedCardId === card.id}
                          selectedClassName="border-[#f0d27f] bg-[#d1b05f] text-[#17130d] shadow-[0_0_18px_rgba(209,176,95,0.30)]"
                          idleClassName="border-[rgba(211,179,109,0.32)] bg-[rgba(18,15,10,0.44)] text-[#d6c498] hover:border-[rgba(211,179,109,0.54)] hover:bg-[rgba(209,176,95,0.12)]"
                          className={
                            "!min-h-[58px] !min-w-[136px] !px-4 !py-3 !text-[16px]"
                          }
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
                  <div
                    className="grid grid-cols-1 gap-2.5"
                  >
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
          </div>
          {choice.declineLabel || showAcceptButton ? (
            <BetrayalDecisionActionDock
              className={
                isEventSymbolSkip
                  ? "relative z-[200] mt-4 grid grid-cols-2 gap-4 border-t-[rgba(74,222,128,0.24)]"
                  : "relative z-[200] mt-5"
              }
            >
              {choice.declineLabel ? (
                <BetrayalSecondaryButton
                  type="button"
                  onClick={() => onResolve(false)}
                  disabled={!canDecline}
                  data-testid="betrayal-event-choice-decline"
                  className="min-h-[72px] min-w-[160px] rounded-[10px] px-8 text-[18px] font-black"
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
                  className="min-h-[72px] min-w-[160px] rounded-[10px] px-8 text-[18px] font-black shadow-[0_0_30px_rgba(209,176,95,0.42)]"
                >
                  {choice.acceptLabel ?? t("common:button.confirm")}
                </BetrayalConfirmButton>
              ) : null}
            </BetrayalDecisionActionDock>
          ) : null}
        </div>
      </div>
  );
}
