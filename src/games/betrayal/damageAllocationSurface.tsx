import React from "react";
import { useTranslation } from "react-i18next";

import { HudPortal, UI_Z_INDEX } from "../../core";
import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalPendingDamageAllocationState,
  BetrayalTraitKey,
} from "./game";
import { BetrayalConfirmButton } from "./confirmButtonSurface";
import {
  countSelectedDamageTrait,
  resolveTraitDamageAssignableSteps,
} from "./traitPresentation";
import { ExplorerTraitOutcomePreview } from "./traitTrackSurface";

type BetrayalDamageKind = BetrayalPendingDamageAllocationState["damageKind"];

export interface BetrayalDamageAllocationSurfaceProps {
  allocation: BetrayalPendingDamageAllocationState;
  explorer: BetrayalExplorerSummary;
  explorerName: string;
  phase: BetrayalCore["phase"];
  allowedTraits: BetrayalTraitKey[];
  selectedTraits: BetrayalTraitKey[];
  resolvedDamageKind: BetrayalDamageKind;
  reductionAmount: number;
  reductionSourceLabel: string;
  sourceHasVisibleOwner: boolean;
  canUseBrooch: boolean;
  usesBrooch: boolean;
  canAct: boolean;
  ready: boolean;
  locale: string;
  isPhoneLandscapeLayout: boolean;
  onToggleBrooch: () => void;
  onAdjustTrait: (trait: BetrayalTraitKey, delta: -1 | 1) => void;
  canIncrementTrait: (trait: BetrayalTraitKey) => boolean;
  onResolve: () => void;
}

function resolveDamageKindLabel(
  kind: BetrayalDamageKind,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (kind === "mental") {
    return t("board.status.damageKindMental");
  }
  if (kind === "general") {
    return t("board.status.damageKindGeneral");
  }
  return t("board.status.damageKindPhysical");
}

export function BetrayalDamageAllocationSurface({
  allocation,
  explorer,
  explorerName,
  phase,
  allowedTraits,
  selectedTraits,
  resolvedDamageKind,
  reductionAmount,
  reductionSourceLabel,
  sourceHasVisibleOwner,
  canUseBrooch,
  usesBrooch,
  canAct,
  ready,
  locale,
  isPhoneLandscapeLayout,
  onToggleBrooch,
  onAdjustTrait,
  canIncrementTrait,
  onResolve,
}: BetrayalDamageAllocationSurfaceProps) {
  const { t } = useTranslation("game-betrayal");
  const damageKindLabel = resolveDamageKindLabel(resolvedDamageKind, t);
  const originalDamageKindLabel = resolveDamageKindLabel(
    allocation.damageKind,
    t,
  );

  return (
    <HudPortal>
      <div
        data-testid="betrayal-damage-allocation-backdrop"
        className={`pointer-events-auto flex items-center justify-center ${
          isPhoneLandscapeLayout
            ? "fixed inset-0 px-3 pb-[74px] pt-6"
            : "fixed bottom-[96px] left-[248px] right-[232px] top-[92px] px-4 py-8"
        }`}
        style={{ zIndex: UI_Z_INDEX.overlayRaised + 170 }}
      >
        <div
          data-testid="betrayal-damage-allocation-panel"
          data-player-id={allocation.playerId}
          className={`grid w-full max-w-[720px] gap-4 border border-[rgba(214,181,109,0.38)] bg-[rgba(12,14,12,0.94)] p-5 text-[#f3e0a6] shadow-[0_26px_54px_rgba(0,0,0,0.58)] ${
            isPhoneLandscapeLayout ? "max-h-full overflow-y-auto" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#f2d27f]">
                {t("board.status.damageAllocationTitle")}
              </span>
              <span
                data-testid="betrayal-damage-allocation-amount"
                className="text-[22px] font-black leading-tight text-[#fff4c7]"
              >
                {t("board.status.damageAllocationHeading", {
                  amount: allocation.amount,
                  kind: damageKindLabel,
                })}
              </span>
              {allocation.sourceTitle ? (
                <span
                  data-testid="betrayal-damage-allocation-source"
                  data-visible-source-owner={
                    sourceHasVisibleOwner ? "discovery-card" : "panel"
                  }
                  className={
                    sourceHasVisibleOwner
                      ? "sr-only"
                      : "text-[12px] font-semibold leading-snug text-[#d6c498]"
                  }
                >
                  {sourceHasVisibleOwner
                    ? allocation.sourceTitle
                    : t("board.status.damageAllocationSource", {
                        source: allocation.sourceTitle,
                      })}
                </span>
              ) : null}
            </div>
            <div className="grid gap-1 text-right">
              <span
                data-testid="betrayal-damage-allocation-player"
                className="text-[12px] font-semibold text-[#d6c498]"
              >
                {explorerName}
              </span>
            </div>
          </div>

          {reductionAmount > 0 ? (
            <div
              data-testid="betrayal-damage-allocation-reduction"
              className="border border-[rgba(122,188,132,0.32)] bg-[rgba(42,82,48,0.24)] px-4 py-3 text-[12px] font-semibold leading-snug text-[#bce8b9]"
            >
              {t("board.status.damageAllocationReduction", {
                originalAmount: allocation.originalAmount,
                reducedAmount: allocation.amount,
                reductionAmount,
                kind: originalDamageKindLabel,
                source: reductionSourceLabel,
              })}
            </div>
          ) : null}

          {canUseBrooch && allocation.damageReplacement ? (
            <div
              data-testid="betrayal-damage-allocation-brooch"
              data-brooch-active={usesBrooch ? "true" : "false"}
              className="grid gap-2 border border-[rgba(169,230,242,0.32)] bg-[rgba(33,67,73,0.28)] px-4 py-3"
            >
              <button
                type="button"
                data-testid="betrayal-damage-allocation-brooch-toggle"
                data-brooch-active={usesBrooch ? "true" : "false"}
                disabled={!canAct}
                onClick={onToggleBrooch}
                className={`inline-flex min-h-[42px] items-center justify-center border px-4 py-2 text-[13px] font-black tracking-[0.08em] transition ${
                  usesBrooch
                    ? "border-[#a9e6f2] bg-[#a9e6f2] text-[#10272d] shadow-[0_0_22px_rgba(116,202,224,0.36)]"
                    : "border-[rgba(169,230,242,0.48)] bg-[rgba(12,14,12,0.38)] text-[#c6f3fb] hover:bg-[rgba(169,230,242,0.12)]"
                } disabled:cursor-not-allowed disabled:border-[rgba(169,230,242,0.20)] disabled:bg-[rgba(12,14,12,0.22)] disabled:text-[rgba(198,243,251,0.42)]`}
              >
                {t(
                  usesBrooch
                    ? "board.status.damageAllocationBroochActive"
                    : "board.status.damageAllocationBroochInactive",
                  {
                    cardName: allocation.damageReplacement.cardName,
                  },
                )}
              </button>
              <span
                data-testid="betrayal-damage-allocation-brooch-note"
                className="text-[12px] font-semibold leading-snug text-[#a9e6f2]"
              >
                {t("board.status.damageAllocationBroochNote")}
              </span>
            </div>
          ) : null}

          <div
            data-testid="betrayal-damage-allocation-traits"
            className="grid grid-cols-2 gap-2.5"
          >
            {allowedTraits.map((trait) => {
              const selectedDamageTraitCount = countSelectedDamageTrait(
                selectedTraits,
                trait,
              );
              const maxDamageTraitCount = resolveTraitDamageAssignableSteps(
                explorer,
                trait,
                phase,
              );
              const isSelectedDamageTrait = selectedDamageTraitCount > 0;
              const isDamageTraitDisabled =
                !canAct ||
                (!isSelectedDamageTrait &&
                  (maxDamageTraitCount <= 0 ||
                    selectedTraits.length >= allocation.amount));
              return (
                <ExplorerTraitOutcomePreview
                  key={`pending-damage-preview-${trait}`}
                  explorer={explorer}
                  trait={trait}
                  mode="damage"
                  phase={phase}
                  stepCount={selectedDamageTraitCount}
                  locale={locale}
                  t={t}
                  testIdPrefix="betrayal-damage-allocation-trait"
                  selected={isSelectedDamageTrait}
                  disabled={isDamageTraitDisabled}
                  selectedCount={selectedDamageTraitCount}
                  locked={maxDamageTraitCount <= 0}
                  onIncrement={() => onAdjustTrait(trait, 1)}
                  onDecrement={() => onAdjustTrait(trait, -1)}
                  canIncrement={canIncrementTrait(trait)}
                  canDecrement={canAct && selectedDamageTraitCount > 0}
                />
              );
            })}
          </div>

          <div className="flex justify-end">
            <BetrayalConfirmButton
              type="button"
              data-testid="betrayal-damage-allocation-confirm"
              disabled={!ready || !canAct}
              className="min-w-[132px] px-5 text-[14px] shadow-[0_10px_22px_rgba(0,0,0,0.34)]"
              onClick={onResolve}
            >
              {t(
                canAct
                  ? "board.status.damageAllocationConfirm"
                  : "board.status.damageAllocationWaiting",
              )}
            </BetrayalConfirmButton>
          </div>
        </div>
      </div>
    </HudPortal>
  );
}
